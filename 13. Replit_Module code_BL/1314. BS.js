/**
 * BS_備份服務模組_2.0.0
 * @module BS模組 
 * @description 備份服務系統 - 完全遷移至Firestore資料庫，每個使用者獨立帳本，遵循2011模組資料庫結構
 * @update 2025-01-10: 升級版本至2.0.0，完全遷移至Firestore，移除Google Sheets依賴，移除預設ledgerID
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs').promises;
const path = require('path');

// 確保 Firebase 已初始化
if (!admin.apps.length) {
  const serviceAccount = require('./Serviceaccountkey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

// 引入依賴模組
let DL, BK, CM, DD1;
try {
  DL = require('./1310. DL.js');
  BK = require('./1301. BK.js');
  CM = require('./1313. CM.js');
  DD1 = require('./1331. DD1.js');
} catch (error) {
  console.warn('BS模組依賴載入警告:', error.message);
}

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = 'Asia/Taipei';

// 模組初始化狀態
const BS_INIT_STATUS = {
  initialized: false,
  firestoreConnected: false,
  cloudProvidersEnabled: {
    googleDrive: false,
    oneDrive: false
  },
  lastInitTime: null,
  activeBackups: new Map(),
  scheduleJobs: new Map()
};

// 備份配置
const BS_CONFIG = {
  MAX_BACKUP_SIZE: 100 * 1024 * 1024, // 100MB
  BACKUP_RETENTION_DAYS: 90,
  MAX_VERSIONS_PER_USER: 50,
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  COMPRESSION_LEVEL: 6,
  BACKUP_TEMP_DIR: '/tmp/bs_backups'
};

// 備份類型定義
const BS_BACKUP_TYPES = {
  MANUAL: 'manual',
  SCHEDULED: 'scheduled',
  AUTO: 'auto'
};

// 雲端服務提供者
const BS_CLOUD_PROVIDERS = {
  GOOGLE_DRIVE: 'google_drive',
  ONEDRIVE: 'onedrive'
};

/**
 * 日誌函數封裝
 */
function BS_logInfo(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_logInfo === 'function') {
    DL.DL_logInfo(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.log(`[BS-INFO] ${message}`);
  }
}

function BS_logError(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_logError === 'function') {
    DL.DL_logError(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.error(`[BS-ERROR] ${message}`, errorDetails);
  }
}

function BS_logWarning(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_logWarning === 'function') {
    DL.DL_logWarning(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.warn(`[BS-WARNING] ${message}`);
  }
}

function BS_logDebug(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_logDebug === 'function') {
    DL.DL_logDebug(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.debug(`[BS-DEBUG] ${message}`);
  }
}

/**
 * 01. 建立手動備份 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 立即建立指定範圍的資料備份，遵循2011模組資料庫結構
 */
async function BS_createManualBackup(userId, backupScope, backupOptions = {}) {
  const functionName = "BS_createManualBackup";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    BS_logInfo(`開始建立手動備份: ${userId}`, "建立備份", userId, "", "", functionName);

    // 生成備份ID
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 收集備份資料（遵循2011模組結構）
    const backupData = await BS_collectBackupData(userId, backupScope);

    // 建立備份檔案
    const archiveResult = await BS_createBackupArchive(backupId, backupData, userId);
    if (!archiveResult.success) {
      throw new Error(`建立備份檔案失敗: ${archiveResult.error}`);
    }

    // 建立備份記錄到backups collection
    const backupRecord = {
      backupId,
      userId,
      backupType: BS_BACKUP_TYPES.MANUAL,
      backupScope,
      fileName: archiveResult.fileName,
      fileSize: archiveResult.fileSize,
      encrypted: backupOptions.encrypted !== false,
      cloudProviders: backupOptions.cloudProviders || [],
      cloudFileIds: {},
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + BS_CONFIG.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      ),
      status: "completed"
    };

    // 儲存備份記錄到 Firestore 的 backups collection
    await db.collection('backups').doc(backupId).set(backupRecord);

    // 上傳到雲端 (如果指定)
    if (backupOptions.cloudProviders && backupOptions.cloudProviders.length > 0) {
      for (const provider of backupOptions.cloudProviders) {
        try {
          const uploadResult = await BS_uploadToCloud(backupId, provider, {
            filePath: archiveResult.filePath
          });
          if (uploadResult.uploaded) {
            backupRecord.cloudFileIds[provider] = uploadResult.cloudFileId;
          }
        } catch (uploadError) {
          BS_logWarning(`雲端上傳失敗 ${provider}: ${uploadError.message}`, "建立備份", userId, "CLOUD_UPLOAD_ERROR", uploadError.toString(), functionName);
        }
      }

      // 更新雲端檔案ID
      await db.collection('backups').doc(backupId).update({
        cloudFileIds: backupRecord.cloudFileIds
      });
    }

    BS_logInfo(`手動備份建立成功: ${backupId}`, "建立備份", userId, "", "", functionName);

    return {
      success: true,
      backupId,
      fileSize: archiveResult.fileSize,
      message: "備份建立成功"
    };

  } catch (error) {
    BS_logError(`建立手動備份失敗: ${error.message}`, "建立備份", userId, "BS_CREATE_ERROR", error.toString(), functionName);
    return {
      success: false,
      backupId: null,
      fileSize: 0,
      message: error.message
    };
  }
}

/**
 * 02. 設定自動備份排程 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 設定定期自動備份的頻率和範圍，儲存於backup_schedules collection
 */
async function BS_setupBackupSchedule(userId, scheduleConfig) {
  const functionName = "BS_setupBackupSchedule";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    BS_logInfo(`設定備份排程: ${userId}`, "設定排程", userId, "", "", functionName);

    // 驗證排程配置
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(scheduleConfig.frequency)) {
      throw new Error(`無效的備份頻率: ${scheduleConfig.frequency}`);
    }

    // 生成排程ID
    const scheduleId = `schedule_${Date.now()}_${userId}`;

    // 計算下次備份時間
    const nextBackupTime = BS_calculateNextBackupTime(scheduleConfig.frequency, scheduleConfig.time);

    // 建立排程記錄
    const scheduleRecord = {
      scheduleId,
      userId,
      frequency: scheduleConfig.frequency,
      backupScope: scheduleConfig.backupScope || ['all'],
      cloudProviders: scheduleConfig.cloudProviders || [],
      nextExecution: admin.firestore.Timestamp.fromDate(nextBackupTime),
      lastExecution: null,
      active: true,
      createdAt: admin.firestore.Timestamp.now(),
      config: scheduleConfig
    };

    // 儲存排程到 Firestore 的 backup_schedules collection
    await db.collection('backup_schedules').doc(scheduleId).set(scheduleRecord);

    // 註冊排程任務
    BS_INIT_STATUS.scheduleJobs.set(scheduleId, {
      userId,
      nextExecution: nextBackupTime,
      config: scheduleConfig
    });

    BS_logInfo(`備份排程設定成功: ${scheduleId}`, "設定排程", userId, "", "", functionName);

    return {
      success: true,
      scheduleId,
      nextBackupTime: nextBackupTime.toISOString()
    };

  } catch (error) {
    BS_logError(`設定備份排程失敗: ${error.message}`, "設定排程", userId, "BS_SCHEDULE_ERROR", error.toString(), functionName);
    return {
      success: false,
      scheduleId: null,
      nextBackupTime: null
    };
  }
}

/**
 * 03. 執行排程備份 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 執行自動排程的備份任務，從backup_schedules collection讀取設定
 */
async function BS_executeScheduledBackup(scheduleId, executionContext = {}) {
  const functionName = "BS_executeScheduledBackup";
  try {
    BS_logInfo(`執行排程備份: ${scheduleId}`, "執行排程", "", "", "", functionName);

    // 取得排程資訊
    const scheduleDoc = await db.collection('backup_schedules').doc(scheduleId).get();
    if (!scheduleDoc.exists) {
      throw new Error("排程不存在");
    }

    const scheduleData = scheduleDoc.data();
    if (!scheduleData.active) {
      throw new Error("排程已停用");
    }

    // 執行備份
    const backupResult = await BS_createManualBackup(scheduleData.userId, scheduleData.backupScope, {
      cloudProviders: scheduleData.cloudProviders,
      automated: true
    });

    // 更新排程執行記錄
    const nextExecution = BS_calculateNextBackupTime(scheduleData.frequency, scheduleData.config.time);
    await scheduleDoc.ref.update({
      lastExecution: admin.firestore.Timestamp.now(),
      nextExecution: admin.firestore.Timestamp.fromDate(nextExecution),
      lastBackupId: backupResult.backupId,
      lastExecutionStatus: backupResult.success ? "success" : "failed"
    });

    const uploadResults = [];
    if (backupResult.success && scheduleData.cloudProviders.length > 0) {
      uploadResults.push(...scheduleData.cloudProviders.map(provider => ({
        provider,
        success: true
      })));
    }

    return {
      executed: true,
      backupId: backupResult.backupId,
      uploadResults
    };

  } catch (error) {
    BS_logError(`執行排程備份失敗: ${error.message}`, "執行排程", "", "BS_EXECUTE_ERROR", error.toString(), functionName);
    return {
      executed: false,
      backupId: null,
      uploadResults: []
    };
  }
}

/**
 * 04. 設定雲端儲存認證 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 設定和驗證雲端儲存服務的認證資訊，儲存於cloud_credentials collection
 */
async function BS_setupCloudAuth(userId, cloudProvider, authCredentials) {
  const functionName = "BS_setupCloudAuth";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    BS_logInfo(`設定雲端認證: ${cloudProvider}`, "設定認證", userId, "", "", functionName);

    // 驗證雲端服務提供者
    const validProviders = Object.values(BS_CLOUD_PROVIDERS);
    if (!validProviders.includes(cloudProvider)) {
      throw new Error(`不支援的雲端服務: ${cloudProvider}`);
    }

    // 驗證認證資訊
    let authResult = { valid: false, expiresAt: null };

    switch (cloudProvider) {
      case BS_CLOUD_PROVIDERS.GOOGLE_DRIVE:
        authResult = await BS_validateGoogleDriveAuth(authCredentials);
        break;
      case BS_CLOUD_PROVIDERS.ONEDRIVE:
        authResult = await BS_validateOneDriveAuth(authCredentials);
        break;
    }

    if (!authResult.valid) {
      throw new Error("認證驗證失敗");
    }

    // 儲存認證資訊 (加密存儲)
    const encryptedCredentials = BS_encryptCredentials(authCredentials, userId);

    await db.collection('cloud_credentials').doc(userId).set({
      [cloudProvider]: {
        encrypted: true,
        credentials: encryptedCredentials,
        expiresAt: authResult.expiresAt ? admin.firestore.Timestamp.fromDate(authResult.expiresAt) : null,
        verifiedAt: admin.firestore.Timestamp.now()
      }
    }, { merge: true });

    // 更新模組狀態
    BS_INIT_STATUS.cloudProvidersEnabled[cloudProvider.replace('_', '')] = true;

    BS_logInfo(`雲端認證設定成功: ${cloudProvider}`, "設定認證", userId, "", "", functionName);

    return {
      authenticated: true,
      provider: cloudProvider,
      expiresAt: authResult.expiresAt
    };

  } catch (error) {
    BS_logError(`設定雲端認證失敗: ${error.message}`, "設定認證", userId, "BS_AUTH_ERROR", error.toString(), functionName);
    return {
      authenticated: false,
      provider: cloudProvider,
      expiresAt: null
    };
  }
}

/**
 * 05. 上傳備份至雲端 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 將備份檔案上傳至指定的雲端儲存服務
 */
async function BS_uploadToCloud(backupId, cloudProvider, uploadOptions) {
  const functionName = "BS_uploadToCloud";
  try {
    BS_logInfo(`上傳備份至雲端: ${backupId} -> ${cloudProvider}`, "雲端上傳", "", "", "", functionName);

    // 取得備份記錄
    const backupDoc = await db.collection('backups').doc(backupId).get();
    if (!backupDoc.exists) {
      throw new Error("備份不存在");
    }

    const backupData = backupDoc.data();
    const filePath = uploadOptions.filePath || path.join(BS_CONFIG.BACKUP_TEMP_DIR, backupData.fileName);

    // 檢查檔案是否存在
    try {
      await fs.access(filePath);
    } catch {
      throw new Error("備份檔案不存在");
    }

    // 加密備份檔案
    let encryptedFilePath = filePath;
    if (backupData.encrypted) {
      encryptedFilePath = await BS_encryptBackupData(filePath, backupData.userId, null);
    }

    // 根據雲端服務上傳
    let uploadResult = { success: false, cloudFileId: null };

    switch (cloudProvider) {
      case BS_CLOUD_PROVIDERS.GOOGLE_DRIVE:
        uploadResult = await BS_uploadToGoogleDrive(encryptedFilePath, backupData);
        break;
      case BS_CLOUD_PROVIDERS.ONEDRIVE:
        uploadResult = await BS_uploadToOneDrive(encryptedFilePath, backupData);
        break;
      default:
        throw new Error(`不支援的雲端服務: ${cloudProvider}`);
    }

    if (!uploadResult.success) {
      throw new Error("雲端上傳失敗");
    }

    // 記錄上傳時間
    const uploadTime = Date.now();

    BS_logInfo(`雲端上傳成功: ${uploadResult.cloudFileId}`, "雲端上傳", backupData.userId, "", "", functionName);

    return {
      uploaded: true,
      cloudFileId: uploadResult.cloudFileId,
      uploadTime
    };

  } catch (error) {
    BS_logError(`雲端上傳失敗: ${error.message}`, "雲端上傳", "", "BS_UPLOAD_ERROR", error.toString(), functionName);
    return {
      uploaded: false,
      cloudFileId: null,
      uploadTime: 0
    };
  }
}

/**
 * 06. 從雲端下載備份 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 從雲端儲存下載指定的備份檔案
 */
async function BS_downloadFromCloud(backupId, cloudProvider, downloadPath) {
  const functionName = "BS_downloadFromCloud";
  try {
    BS_logInfo(`從雲端下載備份: ${backupId}`, "雲端下載", "", "", "", functionName);

    // 取得備份記錄
    const backupDoc = await db.collection('backups').doc(backupId).get();
    if (!backupDoc.exists) {
      throw new Error("備份不存在");
    }

    const backupData = backupDoc.data();
    const cloudFileId = backupData.cloudFileIds[cloudProvider];

    if (!cloudFileId) {
      throw new Error(`在 ${cloudProvider} 中找不到備份檔案`);
    }

    // 設定下載路徑
    const localPath = downloadPath || path.join(BS_CONFIG.BACKUP_TEMP_DIR, `downloaded_${backupData.fileName}`);

    // 根據雲端服務下載
    let downloadResult = { success: false, filePath: null };

    switch (cloudProvider) {
      case BS_CLOUD_PROVIDERS.GOOGLE_DRIVE:
        downloadResult = await BS_downloadFromGoogleDrive(cloudFileId, localPath);
        break;
      case BS_CLOUD_PROVIDERS.ONEDRIVE:
        downloadResult = await BS_downloadFromOneDrive(cloudFileId, localPath);
        break;
      default:
        throw new Error(`不支援的雲端服務: ${cloudProvider}`);
    }

    if (!downloadResult.success) {
      throw new Error("雲端下載失敗");
    }

    // 解密備份檔案
    let finalPath = downloadResult.filePath;
    if (backupData.encrypted) {
      finalPath = await BS_decryptBackupData(downloadResult.filePath, backupData.userId, null);
    }

    // 取得檔案大小
    const stats = await fs.stat(finalPath);
    const fileSize = stats.size;

    return {
      downloaded: true,
      localPath: finalPath,
      fileSize
    };

  } catch (error) {
    BS_logError(`雲端下載失敗: ${error.message}`, "雲端下載", "", "BS_DOWNLOAD_ERROR", error.toString(), functionName);
    return {
      downloaded: false,
      localPath: null,
      fileSize: 0
    };
  }
}

/**
 * 07. 查詢備份版本歷史 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 查詢用戶的所有備份版本和詳細資訊，從backups collection讀取
 */
async function BS_getBackupHistory(userId, filterOptions = {}, sortOrder = 'desc') {
  const functionName = "BS_getBackupHistory";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    BS_logInfo(`查詢備份歷史: ${userId}`, "查詢歷史", userId, "", "", functionName);

    // 建立查詢條件
    let query = db.collection('backups').where('userId', '==', userId);

    // 套用過濾條件
    if (filterOptions.backupType) {
      query = query.where('backupType', '==', filterOptions.backupType);
    }

    if (filterOptions.startDate) {
      query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(filterOptions.startDate)));
    }

    if (filterOptions.endDate) {
      query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(filterOptions.endDate)));
    }

    // 排序和限制
    query = query.orderBy('createdAt', sortOrder).limit(filterOptions.limit || 50);

    // 執行查詢
    const snapshot = await query.get();

    const backups = [];
    let totalStorageUsed = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      backups.push({
        backupId: data.backupId,
        backupType: data.backupType,
        fileName: data.fileName,
        fileSize: data.fileSize,
        encrypted: data.encrypted,
        cloudProviders: Object.keys(data.cloudFileIds || {}),
        createdAt: data.createdAt.toDate().toISOString(),
        expiresAt: data.expiresAt.toDate().toISOString(),
        status: data.status
      });

      totalStorageUsed += data.fileSize;
    });

    return {
      backups,
      totalCount: backups.length,
      storageUsed: totalStorageUsed
    };

  } catch (error) {
    BS_logError(`查詢備份歷史失敗: ${error.message}`, "查詢歷史", userId, "BS_HISTORY_ERROR", error.toString(), functionName);
    return {
      backups: [],
      totalCount: 0,
      storageUsed: 0
    };
  }
}

/**
 * 08. 刪除備份版本 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 刪除指定的備份版本（含雲端檔案清理），從backups collection刪除
 */
async function BS_deleteBackupVersion(backupId, userId, confirmationToken) {
  const functionName = "BS_deleteBackupVersion";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    BS_logInfo(`刪除備份版本: ${backupId}`, "刪除備份", userId, "", "", functionName);

    // 驗證確認令牌 (安全機制)
    const expectedToken = crypto.createHash('sha256').update(`${backupId}_${userId}_delete`).digest('hex').substr(0, 16);
    if (confirmationToken !== expectedToken) {
      throw new Error("確認令牌無效");
    }

    // 取得備份記錄
    const backupDoc = await db.collection('backups').doc(backupId).get();
    if (!backupDoc.exists) {
      throw new Error("備份不存在");
    }

    const backupData = backupDoc.data();

    // 驗證擁有者
    if (backupData.userId !== userId) {
      throw new Error("權限不足：只能刪除自己的備份");
    }

    let freedSpace = backupData.fileSize;

    // 刪除雲端檔案
    for (const [provider, cloudFileId] of Object.entries(backupData.cloudFileIds || {})) {
      try {
        await BS_deleteCloudFile(provider, cloudFileId, userId);
      } catch (cloudError) {
        BS_logWarning(`刪除雲端檔案失敗 ${provider}: ${cloudError.message}`, "刪除備份", userId, "CLOUD_DELETE_WARNING", cloudError.toString(), functionName);
      }
    }

    // 刪除本地檔案 (如果存在)
    try {
      const localPath = path.join(BS_CONFIG.BACKUP_TEMP_DIR, backupData.fileName);
      await fs.unlink(localPath);
    } catch (localError) {
      // 本地檔案可能已經不存在，不視為錯誤
    }

    // 刪除 Firestore 記錄
    await backupDoc.ref.delete();

    // 查詢剩餘版本數量
    const remainingSnapshot = await db.collection('backups')
      .where('userId', '==', userId)
      .get();
    const remainingVersions = remainingSnapshot.size;

    BS_logWarning(`備份版本已刪除: ${backupId}`, "刪除備份", userId, "", "", functionName);

    return {
      deleted: true,
      freedSpace,
      remainingVersions
    };

  } catch (error) {
    BS_logError(`刪除備份版本失敗: ${error.message}`, "刪除備份", userId, "BS_DELETE_ERROR", error.toString(), functionName);
    return {
      deleted: false,
      freedSpace: 0,
      remainingVersions: 0
    };
  }
}

/**
 * 09. 備份版本比較 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 比較不同備份版本間的差異，從backups collection讀取資料
 */
async function BS_compareBackupVersions(backupId1, backupId2, comparisonType = 'summary') {
  const functionName = "BS_compareBackupVersions";
  try {
    BS_logInfo(`比較備份版本: ${backupId1} vs ${backupId2}`, "版本比較", "", "", "", functionName);

    // 取得兩個備份的記錄
    const [backup1Doc, backup2Doc] = await Promise.all([
      db.collection('backups').doc(backupId1).get(),
      db.collection('backups').doc(backupId2).get()
    ]);

    if (!backup1Doc.exists || !backup2Doc.exists) {
      throw new Error("其中一個備份不存在");
    }

    const backup1Data = backup1Doc.data();
    const backup2Data = backup2Doc.data();

    // 基本資訊比較
    const differences = [];
    const changesSummary = {
      fileSize: {
        backup1: backup1Data.fileSize,
        backup2: backup2Data.fileSize,
        difference: backup2Data.fileSize - backup1Data.fileSize
      },
      timeSpan: {
        backup1: backup1Data.createdAt.toDate(),
        backup2: backup2Data.createdAt.toDate(),
        daysDifference: Math.floor((backup2Data.createdAt.toDate() - backup1Data.createdAt.toDate()) / (1000 * 60 * 60 * 24))
      },
      scope: {
        backup1: backup1Data.backupScope,
        backup2: backup2Data.backupScope,
        scopeChanged: JSON.stringify(backup1Data.backupScope) !== JSON.stringify(backup2Data.backupScope)
      }
    };

    // 大小變化分析
    if (changesSummary.fileSize.difference > 0) {
      differences.push(`備份大小增加 ${Math.round(changesSummary.fileSize.difference / 1024)} KB`);
    } else if (changesSummary.fileSize.difference < 0) {
      differences.push(`備份大小減少 ${Math.round(Math.abs(changesSummary.fileSize.difference) / 1024)} KB`);
    } else {
      differences.push("備份大小無變化");
    }

    // 範圍變化分析
    if (changesSummary.scope.scopeChanged) {
      differences.push("備份範圍已變更");
    }

    // 建議動作
    let recommendedAction = "no_action";
    if (changesSummary.fileSize.difference > 1024 * 1024) { // 超過1MB差異
      recommendedAction = "investigate_size_increase";
    } else if (changesSummary.scope.scopeChanged) {
      recommendedAction = "review_scope_changes";
    } else if (changesSummary.timeSpan.daysDifference > 30) {
      recommendedAction = "consider_newer_backup";
    }

    return {
      differences,
      changesSummary,
      recommendedAction
    };

  } catch (error) {
    BS_logError(`備份版本比較失敗: ${error.message}`, "版本比較", "", "BS_COMPARE_ERROR", error.toString(), functionName);
    return {
      differences: [],
      changesSummary: {},
      recommendedAction: "comparison_failed"
    };
  }
}

/**
 * 10. 一鍵資料還原 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 從指定備份版本還原用戶資料，遵循2011模組資料庫結構
 */
async function BS_restoreFromBackup(backupId, userId, restoreOptions = {}) {
  const functionName = "BS_restoreFromBackup";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    BS_logInfo(`開始資料還原: ${backupId}`, "資料還原", userId, "", "", functionName);

    // 取得備份記錄
    const backupDoc = await db.collection('backups').doc(backupId).get();
    if (!backupDoc.exists) {
      throw new Error("備份不存在");
    }

    const backupData = backupDoc.data();

    // 驗證擁有者
    if (backupData.userId !== userId) {
      throw new Error("權限不足：只能還原自己的備份");
    }

    // 下載備份檔案
    let downloadResult = null;

    // 優先從本地查找
    const localPath = path.join(BS_CONFIG.BACKUP_TEMP_DIR, backupData.fileName);
    try {
      await fs.access(localPath);
      downloadResult = { downloaded: true, localPath, fileSize: backupData.fileSize };
    } catch {
      // 本地不存在，從雲端下載
      const cloudProviders = Object.keys(backupData.cloudFileIds || {});
      if (cloudProviders.length === 0) {
        throw new Error("無可用的備份來源");
      }

      downloadResult = await BS_downloadFromCloud(backupId, cloudProviders[0], localPath);
      if (!downloadResult.downloaded) {
        throw new Error("下載備份檔案失敗");
      }
    }

    // 解析備份檔案
    const restoredData = await BS_parseBackupArchive(downloadResult.localPath, userId);

    const restoredItems = [];
    const failedItems = [];

    // 還原帳本資料（遵循2011模組結構）
    if (restoredData.ledgers) {
      try {
        for (const ledgerData of restoredData.ledgers) {
          await db.collection('ledgers').doc(ledgerData.ledgerId).set(ledgerData, { merge: true });
        }
        restoredItems.push({ type: 'ledgers', count: restoredData.ledgers.length });
      } catch (ledgerError) {
        failedItems.push({ type: 'ledgers', error: ledgerError.message });
      }
    }

    // 還原記帳資料（entries子集合）
    if (restoredData.entries) {
      try {
        for (const entryData of restoredData.entries) {
          const ledgerId = entryData.ledgerId;
          const entryId = entryData.收支ID;
          delete entryData.ledgerId; // 移除ledgerId，因為它不應該存在於entry文件中

          await db.collection('ledgers').doc(ledgerId).collection('entries').doc(entryId).set(entryData, { merge: true });
        }
        restoredItems.push({ type: 'entries', count: restoredData.entries.length });
      } catch (entriesError) {
        failedItems.push({ type: 'entries', error: entriesError.message });
      }
    }

    // 還原科目資料（subjects子集合）
    if (restoredData.subjects) {
      try {
        for (const subjectData of restoredData.subjects) {
          const ledgerId = subjectData.ledgerId;
          const subjectId = subjectData.子項代碼;
          delete subjectData.ledgerId; // 移除ledgerId

          await db.collection('ledgers').doc(ledgerId).collection('subjects').doc(subjectId).set(subjectData, { merge: true });
        }
        restoredItems.push({ type: 'subjects', count: restoredData.subjects.length });
      } catch (subjectsError) {
        failedItems.push({ type: 'subjects', error: subjectsError.message });
      }
    }

    // 還原用戶設定
    if (restoredData.userSettings) {
      try {
        await db.collection('users').doc(userId).set(restoredData.userSettings, { merge: true });
        restoredItems.push({ type: 'user_settings', count: 1 });
      } catch (settingsError) {
        failedItems.push({ type: 'user_settings', error: settingsError.message });
      }
    }

    const restored = restoredItems.length > 0;

    if (restored) {
      BS_logInfo(`資料還原完成: ${restoredItems.length} 項成功`, "資料還原", userId, "", "", functionName);
    }

    if (failedItems.length > 0) {
      BS_logWarning(`部分資料還原失敗: ${failedItems.length} 項`, "資料還原", userId, "PARTIAL_RESTORE_FAILURE", JSON.stringify(failedItems), functionName);
    }

    return {
      restored,
      restoredItems,
      failedItems
    };

  } catch (error) {
    BS_logError(`資料還原失敗: ${error.message}`, "資料還原", userId, "BS_RESTORE_ERROR", error.toString(), functionName);
    return {
      restored: false,
      restoredItems: [],
      failedItems: [{ type: 'system', error: error.message }]
    };
  }
}

/**
 * 11. 驗證還原資料完整性 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 驗證還原後的資料完整性和一致性，檢查2011模組結構符合性
 */
async function BS_validateRestoredData(userId, restoreId, validationLevel = 'basic') {
  const functionName = "BS_validateRestoredData";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    BS_logInfo(`驗證還原資料完整性: ${restoreId}`, "驗證完整性", userId, "", "", functionName);

    const validationReport = {
      validationId: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      restoreId,
      validationLevel,
      startTime: new Date().toISOString(),
      checks: {}
    };

    const issues = [];

    // 基本驗證：檢查帳本資料（遵循2011模組結構）
    try {
      const ledgersSnapshot = await db.collection('ledgers').where('ownerUID', '==', userId).get();
      const ledgerCount = ledgersSnapshot.size;

      validationReport.checks.ledgers = {
        valid: ledgerCount > 0,
        count: ledgerCount,
        issues: []
      };

      if (ledgerCount === 0) {
        issues.push('沒有找到任何帳本資料');
      }
    } catch (ledgerError) {
      validationReport.checks.ledgers = { valid: false, error: ledgerError.message };
      issues.push(`帳本驗證失敗: ${ledgerError.message}`);
    }

    // 驗證記帳資料（entries子集合）
    try {
      const userLedgers = await db.collection('ledgers').where('ownerUID', '==', userId).get();
      let totalEntries = 0;

      for (const ledgerDoc of userLedgers.docs) {
        const entriesSnapshot = await ledgerDoc.ref.collection('entries').get();
        totalEntries += entriesSnapshot.size;
      }

      validationReport.checks.entries = {
        valid: true,
        count: totalEntries,
        issues: []
      };
    } catch (entriesError) {
      validationReport.checks.entries = { valid: false, error: entriesError.message };
      issues.push(`記帳資料驗證失敗: ${entriesError.message}`);
    }

    // 驗證科目資料（subjects子集合）
    try {
      const userLedgers = await db.collection('ledgers').where('ownerUID', '==', userId).get();
      let totalSubjects = 0;

      for (const ledgerDoc of userLedgers.docs) {
        const subjectsSnapshot = await ledgerDoc.ref.collection('subjects').get();
        totalSubjects += subjectsSnapshot.size;
      }

      validationReport.checks.subjects = {
        valid: true,
        count: totalSubjects,
        issues: []
      };
    } catch (subjectsError) {
      validationReport.checks.subjects = { valid: false, error: subjectsError.message };
      issues.push(`科目資料驗證失敗: ${subjectsError.message}`);
    }

    // 驗證用戶資料
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      validationReport.checks.user = {
        valid: userDoc.exists,
        count: userDoc.exists ? 1 : 0,
        issues: []
      };

      if (!userDoc.exists) {
        issues.push('用戶資料不存在');
      }
    } catch (userError) {
      validationReport.checks.user = { valid: false, error: userError.message };
      issues.push(`用戶資料驗證失敗: ${userError.message}`);
    }

    // 高級驗證 (如果指定)
    if (validationLevel === 'advanced') {
      try {
        const consistencyCheck = await BS_checkDataConsistency(userId);
        validationReport.checks.consistency = consistencyCheck;
        if (!consistencyCheck.consistent) {
          issues.push(...consistencyCheck.issues);
        }
      } catch (consistencyError) {
        issues.push(`一致性檢查失敗: ${consistencyError.message}`);
      }
    }

    // 完成驗證
    validationReport.endTime = new Date().toISOString();
    validationReport.valid = issues.length === 0;
    validationReport.issueCount = issues.length;

    // 記錄驗證結果
    BS_logInfo(`資料完整性驗證完成: ${validationReport.valid ? '通過' : '失敗'}`, "驗證完整性", userId, "", "", functionName);

    return {
      valid: validationReport.valid,
      validationReport,
      issues
    };

  } catch (error) {
    BS_logError(`驗證資料完整性失敗: ${error.message}`, "驗證完整性", userId, "BS_VALIDATION_ERROR", error.toString(), functionName);
    return {
      valid: false,
      validationReport: { error: error.message },
      issues: [error.message]
    };
  }
}

/**
 * 12. 加密備份資料 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 使用AES-256-GCM加密備份檔案
 */
async function BS_encryptBackupData(backupData, userId, encryptionKey) {
  const functionName = "BS_encryptBackupData";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    // 取得或生成加密金鑰
    const key = encryptionKey || await BS_getUserEncryptionKey(userId);
    if (!key) {
      throw new Error("無法取得加密金鑰");
    }

    // 生成初始化向量
    const iv = crypto.randomBytes(16);

    // 建立加密器 (使用GCM模式)
    const cipher = crypto.createCipher('aes-256-gcm', key);
    cipher.setAAD(Buffer.from(userId)); // 使用用戶ID作為額外認證資料

    let encrypted = '';
    let authTag = null;

    if (typeof backupData === 'string') {
      // 處理檔案路徑
      const inputData = await fs.readFile(backupData);
      encrypted = Buffer.concat([cipher.update(inputData), cipher.final()]);
      authTag = cipher.getAuthTag();

      // 寫入加密檔案
      const encryptedPath = backupData + '.encrypted';
      const encryptedPackage = Buffer.concat([iv, authTag, encrypted]);
      await fs.writeFile(encryptedPath, encryptedPackage);

      BS_logInfo(`檔案加密完成: ${encryptedPath}`, "加密資料", userId, "", "", functionName);

      return encryptedPath;

    } else {
      // 處理資料物件
      const dataString = JSON.stringify(backupData);
      encrypted = Buffer.concat([cipher.update(Buffer.from(dataString)), cipher.final()]);
      authTag = cipher.getAuthTag();

      const encryptedPackage = Buffer.concat([iv, authTag, encrypted]);

      return {
        encrypted: true,
        encryptedSize: encryptedPackage.length,
        encryptionMethod: BS_CONFIG.ENCRYPTION_ALGORITHM,
        data: encryptedPackage.toString('base64')
      };
    }

  } catch (error) {
    BS_logError(`加密備份資料失敗: ${error.message}`, "加密資料", userId, "BS_ENCRYPT_ERROR", error.toString(), functionName);
    throw error;
  }
}

/**
 * 13. 解密備份資料 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 解密下載的備份檔案
 */
async function BS_decryptBackupData(encryptedData, userId, decryptionKey) {
  const functionName = "BS_decryptBackupData";
  try {
    if (!userId) {
      throw new Error("必須提供使用者ID");
    }

    // 取得解密金鑰
    const key = decryptionKey || await BS_getUserEncryptionKey(userId);
    if (!key) {
      throw new Error("無法取得解密金鑰");
    }

    let encryptedBuffer;
    let decryptedFilePath = null;

    if (typeof encryptedData === 'string') {
      // 處理檔案路徑
      encryptedBuffer = await fs.readFile(encryptedData);
      decryptedFilePath = encryptedData.replace('.encrypted', '.decrypted');
    } else {
      // 處理 base64 資料
      encryptedBuffer = Buffer.from(encryptedData, 'base64');
    }

    // 提取 IV、認證標籤和加密資料
    const iv = encryptedBuffer.slice(0, 16);
    const authTag = encryptedBuffer.slice(16, 32);
    const encrypted = encryptedBuffer.slice(32);

    // 建立解密器
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(authTag);

    // 解密資料
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    if (decryptedFilePath) {
      // 寫入解密檔案
      await fs.writeFile(decryptedFilePath, decrypted);

      BS_logInfo(`檔案解密完成: ${decryptedFilePath}`, "解密資料", userId, "", "", functionName);

      return decryptedFilePath;

    } else {
      // 回傳解密的資料物件
      const decryptedData = JSON.parse(decrypted.toString());

      return decryptedData;
    }

  } catch (error) {
    BS_logWarning(`解密備份資料失敗: ${error.message}`, "解密資料", userId, "BS_DECRYPT_ERROR", error.toString(), functionName);
    throw error;
  }
}

/**
 * 14. 處理備份異常 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 統一處理備份過程中的各種異常情況
 */
async function BS_handleBackupError(errorType, errorData, operationContext) {
  const functionName = "BS_handleBackupError";
  try {
    const errorCode = `BS_${errorType.toUpperCase()}_ERROR`;
    const timestamp = new Date().toISOString();

    // 記錄詳細錯誤資訊
    BS_logError(`備份錯誤: ${errorType}`, "錯誤處理", operationContext.userId || "", errorCode, JSON.stringify(errorData), functionName);

    let retryAction = "none";

    // 根據錯誤類型執行恢復操作
    switch (errorType) {
      case "storage_full":
        retryAction = "cleanup_old_backups";
        // 自動清理過期備份
        if (operationContext.userId) {
          await BS_cleanupExpiredBackups({ userId: operationContext.userId });
        }
        break;

      case "cloud_upload_failed":
        retryAction = "retry_upload";
        // 3秒後重試上傳
        if (operationContext.backupId && operationContext.cloudProvider) {
          setTimeout(() => {
            BS_uploadToCloud(operationContext.backupId, operationContext.cloudProvider, operationContext.uploadOptions || {});
          }, 3000);
        }
        break;

      case "encryption_failed":
        retryAction = "regenerate_keys";
        break;

      case "file_corruption":
        retryAction = "restore_from_cloud";
        break;

      case "permission_denied":
        retryAction = "check_credentials";
        break;

      default:
        retryAction = "manual_intervention_required";
    }

    return {
      handled: true,
      errorCode,
      retryAction,
      timestamp
    };

  } catch (handleError) {
    console.error(`處理備份錯誤時發生異常:`, handleError);
    return {
      handled: false,
      errorCode: "BS_ERROR_HANDLER_FAILED",
      retryAction: "system_restart_required",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 15. 監控備份服務狀態 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 即時監控備份服務的運行狀態和效能
 */
async function BS_monitorBackupService() {
  const functionName = "BS_monitorBackupService";
  try {
    const monitoringData = {
      timestamp: new Date().toISOString(),
      healthy: true,
      activeBackups: 0,
      storageUsage: {}
    };

    // 檢查活動備份數量
    monitoringData.activeBackups = BS_INIT_STATUS.activeBackups.size;

    // 檢查 Firestore 連線狀態
    try {
      const testQuery = await db.collection('backups').limit(1).get();
      monitoringData.storageUsage.firestoreStatus = "connected";
      monitoringData.storageUsage.firestoreLatency = Date.now();
    } catch (firestoreError) {
      monitoringData.healthy = false;
      monitoringData.storageUsage.firestoreStatus = "error";
      monitoringData.storageUsage.firestoreError = firestoreError.message;
    }

    // 檢查雲端服務狀態
    for (const provider of Object.values(BS_CLOUD_PROVIDERS)) {
      try {
        const status = await BS_checkCloudServiceStatus(provider);
        monitoringData.storageUsage[provider] = status;
        if (!status.available) {
          monitoringData.healthy = false;
        }
      } catch (cloudError) {
        monitoringData.storageUsage[provider] = { available: false, error: cloudError.message };
        monitoringData.healthy = false;
      }
    }

    // 檢查磁碟空間
    try {
      await fs.access(BS_CONFIG.BACKUP_TEMP_DIR);
      const stats = await fs.stat(BS_CONFIG.BACKUP_TEMP_DIR);
      monitoringData.storageUsage.localStorage = {
        available: true,
        path: BS_CONFIG.BACKUP_TEMP_DIR
      };
    } catch (diskError) {
      monitoringData.storageUsage.localStorage = {
        available: false,
        error: diskError.message
      };
    }

    // 檢查記憶體使用狀況
    const memUsage = process.memoryUsage();
    monitoringData.performance = {
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
      },
      uptime: Math.round(process.uptime()),
      activeSchedules: BS_INIT_STATUS.scheduleJobs.size
    };

    if (monitoringData.healthy) {
      BS_logInfo(`備份服務健康檢查通過`, "系統監控", "", "", "", functionName);
    } else {
      BS_logWarning(`備份服務健康檢查發現問題`, "系統監控", "", "BS_HEALTH_WARNING", JSON.stringify(monitoringData.storageUsage), functionName);
    }

    return monitoringData;

  } catch (error) {
    BS_logError(`備份服務狀態監控失敗: ${error.message}`, "系統監控", "", "BS_MONITOR_ERROR", error.toString(), functionName);
    return {
      timestamp: new Date().toISOString(),
      healthy: false,
      activeBackups: 0,
      storageUsage: {
        error: error.message
      }
    };
  }
}

/**
 * 16. 清理過期備份 - Firestore版本
 * @version 2025-01-10-V2.0.0
 * @date 2025-01-10 14:23:11
 * @description 自動清理超過保留期限的備份檔案，從backups collection刪除
 */
async function BS_cleanupExpiredBackups(retentionPolicy = {}) {
  const functionName = "BS_cleanupExpiredBackups";
  try {
    BS_logInfo(`開始清理過期備份`, "清理備份", "", "", "", functionName);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (retentionPolicy.retentionDays || BS_CONFIG.BACKUP_RETENTION_DAYS));

    // 查詢過期備份
    let query = db.collection('backups')
      .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(cutoffDate));

    // 如果指定用戶，限制範圍
    if (retentionPolicy.userId) {
      query = query.where('userId', '==', retentionPolicy.userId);
    }

    const expiredSnapshot = await query.get();

    let deletedCount = 0;
    let freedSpace = 0;

    for (const doc of expiredSnapshot.docs) {
      const backupData = doc.data();

      try {
        // 使用內部刪除函數
        const deleteResult = await BS_deleteBackupVersionInternal(backupData.backupId, backupData.userId);
        if (deleteResult.deleted) {
          deletedCount++;
          freedSpace += deleteResult.freedSpace;
        }
      } catch (deleteError) {
        BS_logWarning(`清理備份失敗: ${backupData.backupId}`, "清理備份", "", "DELETE_FAILED", deleteError.toString(), functionName);
      }
    }

    BS_logInfo(`過期備份清理完成: 刪除 ${deletedCount} 個備份，釋放 ${Math.round(freedSpace / 1024 / 1024)} MB`, "清理備份", "", "", "", functionName);

    return {
      cleaned: true,
      deletedCount,
      freedSpace
    };

  } catch (error) {
    BS_logError(`清理過期備份失敗: ${error.message}`, "清理備份", "", "BS_CLEANUP_ERROR", error.toString(), functionName);
    return {
      cleaned: false,
      deletedCount: 0,
      freedSpace: 0
    };
  }
}

// =============== 輔助函數 - 遵循2011模組資料庫結構 ===============

/**
 * 收集備份資料 - 遵循2011模組結構
 */
async function BS_collectBackupData(userId, backupScope) {
  const backupData = {
    metadata: {
      version: "2.0",
      created_at: new Date().toISOString(),
      user_id: userId,
      backup_id: null, // 將在主函數中設定
      compression: "gzip",
      encryption: "AES-256-GCM",
      database_structure: "2011_compliant"
    },
    data: {}
  };

  // 收集帳本資料（遵循2011模組結構：ledgers collection）
  if (backupScope.includes('ledgers') || backupScope.includes('all')) {
    try {
      const ledgersSnapshot = await db.collection('ledgers')
        .where('ownerUID', '==', userId)
        .get();

      const ledgers = [];
      ledgersSnapshot.forEach(doc => {
        ledgers.push({
          ledgerId: doc.id,
          ...doc.data()
        });
      });

      backupData.data.ledgers = ledgers;
    } catch (error) {
      BS_logWarning(`收集帳本資料失敗: ${error.message}`, "收集備份", userId, "COLLECT_LEDGERS_ERROR", error.toString(), "BS_collectBackupData");
    }
  }

  // 收集記帳資料（遵循2011模組結構：entries子集合）
  if (backupScope.includes('entries') || backupScope.includes('all')) {
    try {
      const userLedgers = await db.collection('ledgers')
        .where('ownerUID', '==', userId)
        .get();

      const entries = [];
      for (const ledgerDoc of userLedgers.docs) {
        const entriesSnapshot = await ledgerDoc.ref.collection('entries').get();
        entriesSnapshot.forEach(entryDoc => {
          if (entryDoc.id !== 'template') { // 跳過template文件
            entries.push({
              ledgerId: ledgerDoc.id,
              ...entryDoc.data()
            });
          }
        });
      }

      backupData.data.entries = entries;
    } catch (error) {
      BS_logWarning(`收集記帳資料失敗: ${error.message}`, "收集備份", userId, "COLLECT_ENTRIES_ERROR", error.toString(), "BS_collectBackupData");
    }
  }

  // 收集科目資料（遵循2011模組結構：subjects子集合）
  if (backupScope.includes('subjects') || backupScope.includes('all')) {
    try {
      const userLedgers = await db.collection('ledgers')
        .where('ownerUID', '==', userId)
        .get();

      const subjects = [];
      for (const ledgerDoc of userLedgers.docs) {
        const subjectsSnapshot = await ledgerDoc.ref.collection('subjects').get();
        subjectsSnapshot.forEach(subjectDoc => {
          if (subjectDoc.id !== 'template') { // 跳過template文件
            subjects.push({
              ledgerId: ledgerDoc.id,
              ...subjectDoc.data()
            });
          }
        });
      }

      backupData.data.subjects = subjects;
    } catch (error) {
      BS_logWarning(`收集科目資料失敗: ${error.message}`, "收集備份", userId, "COLLECT_SUBJECTS_ERROR", error.toString(), "BS_collectBackupData");
    }
  }

  // 收集日誌資料（遵循2011模組結構：log子集合）
  if (backupScope.includes('logs') || backupScope.includes('all')) {
    try {
      const userLedgers = await db.collection('ledgers')
        .where('ownerUID', '==', userId)
        .get();

      const logs = [];
      for (const ledgerDoc of userLedgers.docs) {
        const logsSnapshot = await ledgerDoc.ref.collection('log').get();
        logsSnapshot.forEach(logDoc => {
          logs.push({
            ledgerId: ledgerDoc.id,
            logId: logDoc.id,
            ...logDoc.data()
          });
        });
      }

      backupData.data.logs = logs;
    } catch (error) {
      BS_logWarning(`收集日誌資料失敗: ${error.message}`, "收集備份", userId, "COLLECT_LOGS_ERROR", error.toString(), "BS_collectBackupData");
    }
  }

  // 收集用戶設定（遵循2011模組結構：users collection）
  if (backupScope.includes('user_settings') || backupScope.includes('all')) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        backupData.data.userSettings = userDoc.data();
      }
    } catch (error) {
      BS_logWarning(`收集用戶設定失敗: ${error.message}`, "收集備份", userId, "COLLECT_USER_ERROR", error.toString(), "BS_collectBackupData");
    }
  }

  // 收集帳號映射（遵循2011模組結構：account_mappings collection）
  if (backupScope.includes('account_mappings') || backupScope.includes('all')) {
    try {
      const mappingsSnapshot = await db.collection('account_mappings')
        .where('primary_UID', '==', userId)
        .get();

      const mappings = [];
      mappingsSnapshot.forEach(doc => {
        if (doc.id !== 'template') { // 跳過template文件
          mappings.push({
            mappingId: doc.id,
            ...doc.data()
          });
        }
      });

      backupData.data.accountMappings = mappings;
    } catch (error) {
      BS_logWarning(`收集帳號映射失敗: ${error.message}`, "收集備份", userId, "COLLECT_MAPPINGS_ERROR", error.toString(), "BS_collectBackupData");
    }
  }

  return backupData;
}

/**
 * 建立備份檔案
 */
async function BS_createBackupArchive(backupId, backupData, userId) {
  try {
    // 設定備份ID
    backupData.metadata.backup_id = backupId;

    // 產生檢查碼
    const dataString = JSON.stringify(backupData.data);
    const checksum = crypto.createHash('sha256').update(dataString).digest('hex');
    backupData.checksum = checksum;

    // 壓縮資料
    const jsonData = JSON.stringify(backupData);
    const compressed = zlib.gzipSync(Buffer.from(jsonData), { level: BS_CONFIG.COMPRESSION_LEVEL });

    // 建立檔案名稱
    const fileName = `backup_${userId}_${backupId}_${Date.now()}.gz`;
    const filePath = path.join(BS_CONFIG.BACKUP_TEMP_DIR, fileName);

    // 確保目錄存在
    await fs.mkdir(BS_CONFIG.BACKUP_TEMP_DIR, { recursive: true });

    // 寫入檔案
    await fs.writeFile(filePath, compressed);

    return {
      success: true,
      fileName,
      filePath,
      fileSize: compressed.length
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 解析備份檔案
 */
async function BS_parseBackupArchive(filePath, userId) {
  try {
    // 讀取檔案
    const compressed = await fs.readFile(filePath);

    // 解壓縮
    const decompressed = zlib.gunzipSync(compressed);
    const backupData = JSON.parse(decompressed.toString());

    // 驗證檢查碼
    const dataString = JSON.stringify(backupData.data);
    const checksum = crypto.createHash('sha256').update(dataString).digest('hex');

    if (checksum !== backupData.checksum) {
      throw new Error("備份檔案檢查碼不符，可能已損壞");
    }

    return backupData.data;

  } catch (error) {
    throw new Error(`解析備份檔案失敗: ${error.message}`);
  }
}

/**
 * 計算下次備份時間
 */
function BS_calculateNextBackupTime(frequency, timeConfig = {}) {
  const now = new Date();
  const nextTime = new Date(now);

  switch (frequency) {
    case 'daily':
      nextTime.setDate(nextTime.getDate() + 1);
      break;
    case 'weekly':
      nextTime.setDate(nextTime.getDate() + 7);
      break;
    case 'monthly':
      nextTime.setMonth(nextTime.getMonth() + 1);
      break;
  }

  // 設定執行時間 (預設凌晨2點)
  nextTime.setHours(timeConfig.hour || 2);
  nextTime.setMinutes(timeConfig.minute || 0);
  nextTime.setSeconds(0);
  nextTime.setMilliseconds(0);

  return nextTime;
}

/**
 * 取得用戶加密金鑰
 */
async function BS_getUserEncryptionKey(userId) {
  try {
    // 從用戶設定取得加密金鑰，這裡簡化處理
    return crypto.createHash('sha256').update(`${userId}_encryption_key_v2`).digest();
  } catch (error) {
    return null;
  }
}

/**
 * 加密憑證
 */
function BS_encryptCredentials(credentials, userId) {
  try {
    const key = crypto.createHash('sha256').update(`${userId}_credentials_key_v2`).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);

    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  } catch (error) {
    throw new Error(`憑證加密失敗: ${error.message}`);
  }
}

/**
 * 驗證 Google Drive 認證 (模擬)
 */
async function BS_validateGoogleDriveAuth(credentials) {
  // 這裡應該實際驗證 Google Drive API 認證
  return {
    valid: true,
    expiresAt: new Date(Date.now() + 3600000) // 1小時後過期
  };
}

/**
 * 驗證 OneDrive 認證 (模擬)
 */
async function BS_validateOneDriveAuth(credentials) {
  // 這裡應該實際驗證 OneDrive API 認證
  return {
    valid: true,
    expiresAt: new Date(Date.now() + 3600000) // 1小時後過期
  };
}

/**
 * 上傳到 Google Drive (模擬)
 */
async function BS_uploadToGoogleDrive(filePath, backupData) {
  // 這裡應該實際使用 Google Drive API 上傳檔案
  return {
    success: true,
    cloudFileId: `gdrive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * 上傳到 OneDrive (模擬)
 */
async function BS_uploadToOneDrive(filePath, backupData) {
  // 這裡應該實際使用 OneDrive API 上傳檔案
  return {
    success: true,
    cloudFileId: `onedrive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

/**
 * 從 Google Drive 下載 (模擬)
 */
async function BS_downloadFromGoogleDrive(cloudFileId, localPath) {
  // 這裡應該實際使用 Google Drive API 下載檔案
  return {
    success: true,
    filePath: localPath
  };
}

/**
 * 從 OneDrive 下載 (模擬)
 */
async function BS_downloadFromOneDrive(cloudFileId, localPath) {
  // 這裡應該實際使用 OneDrive API 下載檔案
  return {
    success: true,
    filePath: localPath
  };
}

/**
 * 刪除雲端檔案
 */
async function BS_deleteCloudFile(provider, cloudFileId, userId) {
  switch (provider) {
    case BS_CLOUD_PROVIDERS.GOOGLE_DRIVE:
      // 實際應該呼叫 Google Drive API 刪除檔案
      return { deleted: true };
    case BS_CLOUD_PROVIDERS.ONEDRIVE:
      // 實際應該呼叫 OneDrive API 刪除檔案
      return { deleted: true };
    default:
      throw new Error(`不支援的雲端服務: ${provider}`);
  }
}

/**
 * 檢查雲端服務狀態
 */
async function BS_checkCloudServiceStatus(provider) {
  // 這裡應該實際檢查各雲端服務的可用性
  return {
    available: true,
    latency: Math.floor(Math.random() * 100) + 50, // 模擬延遲
    lastCheck: new Date().toISOString()
  };
}

/**
 * 檢查資料一致性 - 遵循2011模組結構
 */
async function BS_checkDataConsistency(userId) {
  try {
    const issues = [];

    // 檢查用戶是否存在於users collection
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      issues.push('用戶資料不存在於users collection');
    }

    // 檢查帳本結構一致性
    const ledgersSnapshot = await db.collection('ledgers').where('ownerUID', '==', userId).get();

    for (const ledgerDoc of ledgersSnapshot.docs) {
      const ledgerData = ledgerDoc.data();

      // 檢查必要欄位
      if (!ledgerData.ledgername) {
        issues.push(`帳本 ${ledgerDoc.id} 缺少 ledgername 欄位`);
      }

      if (!ledgerData.ownerUID) {
        issues.push(`帳本 ${ledgerDoc.id} 缺少 ownerUID 欄位`);
      }

      // 檢查子集合是否存在
      const entriesSnapshot = await ledgerDoc.ref.collection('entries').limit(1).get();
      const subjectsSnapshot = await ledgerDoc.ref.collection('subjects').limit(1).get();
      const logsSnapshot = await ledgerDoc.ref.collection('log').limit(1).get();

      if (entriesSnapshot.empty) {
        issues.push(`帳本 ${ledgerDoc.id} 的 entries 子集合為空`);
      }

      if (subjectsSnapshot.empty) {
        issues.push(`帳本 ${ledgerDoc.id} 的 subjects 子集合為空`);
      }
    }

    return {
      consistent: issues.length === 0,
      issues
    };

  } catch (error) {
    return {
      consistent: false,
      issues: [`一致性檢查失敗: ${error.message}`]
    };
  }
}

/**
 * 內部刪除備份版本 (略過確認令牌)
 */
async function BS_deleteBackupVersionInternal(backupId, userId) {
  try {
    const backupDoc = await db.collection('backups').doc(backupId).get();
    if (!backupDoc.exists) {
      throw new Error("備份不存在");
    }

    const backupData = backupDoc.data();
    const freedSpace = backupData.fileSize;

    // 刪除雲端檔案
    for (const [provider, cloudFileId] of Object.entries(backupData.cloudFileIds || {})) {
      try {
        await BS_deleteCloudFile(provider, cloudFileId, userId);
      } catch (cloudError) {
        // 雲端刪除失敗不阻擋本地清理
      }
    }

    // 刪除 Firestore 記錄
    await backupDoc.ref.delete();

    return {
      deleted: true,
      freedSpace
    };

  } catch (error) {
    return {
      deleted: false,
      freedSpace: 0
    };
  }
}

/**
 * 模組初始化函數 - Firestore版本
 */
async function BS_initialize() {
  const functionName = "BS_initialize";
  try {
    console.log('💾 BS 備份服務模組初始化中... (v2.0.0 - Firestore版本)');

    // 檢查 Firestore 連線
    if (!admin.apps.length) {
      throw new Error("Firebase Admin 未初始化");
    }

    // 建立備份暫存目錄
    await fs.mkdir(BS_CONFIG.BACKUP_TEMP_DIR, { recursive: true });

    // 驗證 Firestore collections 存在（遵循2011模組結構）
    try {
      // 檢查 backups collection
      await db.collection('backups').limit(1).get();

      // 檢查 backup_schedules collection
      await db.collection('backup_schedules').limit(1).get();

      // 檢查 cloud_credentials collection
      await db.collection('cloud_credentials').limit(1).get();

      BS_logInfo("Firestore collections 驗證成功", "模組初始化", "", "", "", functionName);
    } catch (firestoreError) {
      BS_logWarning(`Firestore collections 檢查警告: ${firestoreError.message}`, "模組初始化", "", "FIRESTORE_CHECK_WARNING", firestoreError.toString(), functionName);
    }

    // 設定模組初始化狀態
    BS_INIT_STATUS.initialized = true;
    BS_INIT_STATUS.firestoreConnected = true;
    BS_INIT_STATUS.lastInitTime = new Date();

    BS_logInfo("BS 備份服務模組初始化完成 (v2.0.0 - Firestore版本)", "模組初始化", "", "", "", functionName);
    console.log('✅ BS 備份服務模組已成功啟動 (遵循2011模組資料庫結構)');

    return true;
  } catch (error) {
    BS_logError(`BS 模組初始化失敗: ${error.message}`, "模組初始化", "", "BS_INIT_ERROR", error.toString(), functionName);
    console.error('❌ BS 備份服務模組初始化失敗:', error);
    return false;
  }
}

// 導出模組函數
module.exports = {
  // 備份建立函數
  BS_createManualBackup,
  BS_setupBackupSchedule,
  BS_executeScheduledBackup,

  // 雲端儲存整合函數
  BS_setupCloudAuth,
  BS_uploadToCloud,
  BS_downloadFromCloud,

  // 備份版本管理函數
  BS_getBackupHistory,
  BS_deleteBackupVersion,
  BS_compareBackupVersions,

  // 資料還原函數
  BS_restoreFromBackup,
  BS_validateRestoredData,

  // 備份加密與安全函數
  BS_encryptBackupData,
  BS_decryptBackupData,

  // 錯誤處理與監控函數
  BS_handleBackupError,
  BS_monitorBackupService,
  BS_cleanupExpiredBackups,

  // 模組初始化
  BS_initialize,

  // 常數與配置
  BS_CONFIG,
  BS_BACKUP_TYPES,
  BS_CLOUD_PROVIDERS,
  BS_INIT_STATUS
};

// 自動初始化模組
BS_initialize().catch(error => {
  console.error('BS 模組自動初始化失敗:', error);
});