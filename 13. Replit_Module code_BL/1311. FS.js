/**
* FS_FirestoreStructure_資料庫結構模組_2.1.0
* @module 資料庫結構模組
* @description LCAS 2.0 Firestore資料庫結構模組 - Phase 1核心進入流程專用版本
* @update 2025-09-16: 階段一重構，升級至2.1.0版本，專注Phase 1核心功能
*/

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

// 初始化 Firebase Admin（使用動態配置）
let admin, db, PROJECT_ID, UNIVERSE_DOMAIN;

try {
  // 取得Firebase Admin實例
  admin = firebaseConfig.admin;

  // 初始化Firebase（如果尚未初始化）
  firebaseConfig.initializeFirebaseAdmin();

  // 取得 Firestore 實例
  db = firebaseConfig.getFirestoreInstance();

  // 取得專案資訊
  const projectInfo = firebaseConfig.getProjectInfo();
  PROJECT_ID = projectInfo.PROJECT_ID;
  UNIVERSE_DOMAIN = projectInfo.UNIVERSE_DOMAIN;

  console.log('✅ FS模組2.1.0：Firebase動態配置載入成功');

} catch (error) {
  console.error('❌ FS模組2.1.0：Firebase動態配置載入失敗:', error.message);

  // 檢查環境變數設定狀態
  try {
    const envCheck = firebaseConfig.checkEnvironmentVariables();
    console.log('💡 請檢查Replit Secrets中的Firebase環境變數設定');
    if (envCheck.missing.length > 0) {
      console.log('🔍 缺失的環境變數:', envCheck.missing.join(', '));
    }
  } catch (checkError) {
    console.warn('⚠️ 無法檢查環境變數:', checkError.message);
  }

  // 設定預設值以避免模組完全失效
  PROJECT_ID = 'default-project';
  UNIVERSE_DOMAIN = 'googleapis.com';
}

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = 'Asia/Taipei';

// =============== 階段一：核心基礎函數區 ===============

/**
 * 01. 模組初始化與配置管理
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 模組初始化
 */
function FS_initializeModule() {
  const functionName = "FS_initializeModule";
  try {
    FS_logOperation('FS模組2.1.0初始化', '模組初始化', 'system', '', '', functionName);

    // 驗證Firebase配置
    if (!db) {
      throw new Error('Firestore資料庫實例未正確初始化');
    }

    // 驗證專案資訊
    if (!PROJECT_ID || PROJECT_ID === 'default-project') {
      console.warn('⚠️ 使用預設專案ID，請檢查Firebase配置');
    }

    return {
      success: true,
      version: '2.1.0',
      projectId: PROJECT_ID,
      timezone: TIMEZONE,
      message: 'FS模組2.1.0初始化成功'
    };

  } catch (error) {
    FS_handleError(`模組初始化失敗: ${error.message}`, '模組初始化', 'system', 'FS_INIT_ERROR', error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_INIT_ERROR'
    };
  }
}

/**
 * 02. Firebase連接初始化
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - Firebase連接驗證
 */
async function FS_initializeConnection() {
  const functionName = "FS_initializeConnection";
  try {
    FS_logOperation('Firebase連接初始化', 'Firebase連接', 'system', '', '', functionName);

    // 測試Firestore連接
    const testRef = db.collection('_health_check').doc('connection_test');
    const testData = {
      timestamp: admin.firestore.Timestamp.now(),
      status: 'connection_verified',
      version: '2.1.0',
      test_id: `test_${Date.now()}`
    };

    await testRef.set(testData);
    await testRef.delete();

    return {
      success: true,
      projectId: PROJECT_ID,
      universeDomain: UNIVERSE_DOMAIN,
      message: 'Firebase連接驗證成功'
    };

  } catch (error) {
    FS_handleError(`Firebase連接失敗: ${error.message}`, 'Firebase連接', 'system', 'FS_CONNECTION_ERROR', error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CONNECTION_ERROR'
    };
  }
}

/**
 * 03. 基礎文檔操作 - 建立文檔
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 基礎文檔建立
 */
async function FS_createDocument(collectionPath, documentId, data, requesterId) {
  const functionName = "FS_createDocument";
  try {
    FS_logOperation(`建立文檔: ${collectionPath}/${documentId}`, "建立文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId || !data) {
      throw new Error("缺少必要參數: collectionPath, documentId, data");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 建立文檔
    await docRef.set(data);

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      operation: 'created'
    };

  } catch (error) {
    FS_handleError(`建立文檔失敗: ${error.message}`, "建立文檔", requesterId || "", "FS_CREATE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 04. 基礎文檔操作 - 取得文檔
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 基礎文檔取得
 */
async function FS_getDocument(collectionPath, documentId, requesterId) {
  const functionName = "FS_getDocument";
  try {
    FS_logOperation(`取得文檔: ${collectionPath}/${documentId}`, "取得文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId) {
      throw new Error("缺少必要參數: collectionPath, documentId");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 取得文檔
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        success: false,
        exists: false,
        error: "文檔不存在",
        errorCode: 'FS_DOCUMENT_NOT_FOUND'
      };
    }

    return {
      success: true,
      exists: true,
      data: doc.data(),
      documentId: documentId,
      path: `${collectionPath}/${documentId}`
    };

  } catch (error) {
    FS_handleError(`取得文檔失敗: ${error.message}`, "取得文檔", requesterId || "", "FS_GET_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_GET_DOCUMENT_ERROR'
    };
  }
}

/**
 * 05. 基礎文檔操作 - 更新文檔
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 基礎文檔更新
 */
async function FS_updateDocument(collectionPath, documentId, updateData, requesterId) {
  const functionName = "FS_updateDocument";
  try {
    FS_logOperation(`更新文檔: ${collectionPath}/${documentId}`, "更新文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId || !updateData) {
      throw new Error("缺少必要參數: collectionPath, documentId, updateData");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 執行更新操作
    await docRef.update(updateData);

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      updatedFields: Object.keys(updateData)
    };

  } catch (error) {
    FS_handleError(`更新文檔失敗: ${error.message}`, "更新文檔", requesterId || "", "FS_UPDATE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_UPDATE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 06. 基礎文檔操作 - 刪除文檔
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 基礎文檔刪除
 */
async function FS_deleteDocument(collectionPath, documentId, requesterId) {
  const functionName = "FS_deleteDocument";
  try {
    FS_logOperation(`刪除文檔: ${collectionPath}/${documentId}`, "刪除文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId) {
      throw new Error("缺少必要參數: collectionPath, documentId");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 執行刪除操作
    await docRef.delete();

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      operation: 'deleted'
    };

  } catch (error) {
    FS_handleError(`刪除文檔失敗: ${error.message}`, "刪除文檔", requesterId || "", "FS_DELETE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_DELETE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 07. 基礎集合操作 - 查詢集合
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 基礎集合查詢
 */
async function FS_queryCollection(collectionPath, queryConditions, requesterId, options = {}) {
  const functionName = "FS_queryCollection";
  try {
    FS_logOperation(`查詢集合: ${collectionPath}`, "查詢集合", requesterId || "", "", "", functionName);

    // 建立查詢
    let query = db.collection(collectionPath);

    // 套用查詢條件
    if (queryConditions && Array.isArray(queryConditions)) {
      queryConditions.forEach(condition => {
        query = query.where(condition.field, condition.operator, condition.value);
      });
    }

    // 套用排序
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }

    // 套用限制
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // 執行查詢
    const snapshot = await query.get();

    const results = [];
    snapshot.forEach(doc => {
      results.push({
        id: doc.id,
        data: doc.data()
      });
    });

    return {
      success: true,
      results: results,
      count: results.length,
      collectionPath: collectionPath
    };

  } catch (error) {
    FS_handleError(`查詢集合失敗: ${error.message}`, "查詢集合", requesterId || "", "FS_QUERY_COLLECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_QUERY_COLLECTION_ERROR'
    };
  }
}

/**
 * 08. 錯誤處理機制
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 統一錯誤處理
 */
function FS_handleError(message, operation, userId, errorCode, details, functionName) {
  try {
    console.error(`[FS_ERROR_v2.1.0] ${new Date().toISOString()} | ${operation} | ${message} | Error: ${errorCode} | Function: ${functionName}`);

    if (details) {
      console.error(`[FS_ERROR_DETAILS] ${details}`);
    }

    return true;
  } catch (error) {
    console.error(`[FS_CRITICAL_ERROR] ${error.toString()}`);
    return false;
  }
}

/**
 * 09. 日誌記錄機制
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 統一日誌記錄
 */
function FS_logOperation(message, operation, userId, errorCode, details, functionName) {
  try {
    console.log(`[FS_LOG_v2.1.0] ${new Date().toISOString()} | ${operation} | ${message} | User: ${userId} | Function: ${functionName}`);
    return true;
  } catch (error) {
    console.error(`[FS_LOG_ERROR] ${error.toString()}`);
    return false;
  }
}

// =============== 相容性函數保留區 ===============

/**
 * 30. 合併文檔 - 相容性函數
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @description 合併更新Firestore中的文檔（保留相容性）
 */
async function FS_mergeDocument(collectionPath, documentId, mergeData, requesterId) {
  const functionName = "FS_mergeDocument";
  try {
    FS_logOperation(`合併文檔: ${collectionPath}/${documentId}`, "合併文檔", requesterId || "", "", "", functionName);

    // 使用 FS_setDocument 進行合併操作
    return await FS_setDocument(collectionPath, documentId, mergeData, requesterId, { merge: true });

  } catch (error) {
    FS_handleError(`合併文檔失敗: ${error.message}`, "合併文檔", requesterId || "", "FS_MERGE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_MERGE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 32. 新增到集合 - 相容性函數
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @description 新增文檔到Firestore集合（保留相容性）
 */
async function FS_addToCollection(collectionPath, data, requesterId) {
  const functionName = "FS_addToCollection";
  try {
    FS_logOperation(`新增到集合: ${collectionPath}`, "新增文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !data) {
      throw new Error("缺少必要參數: collectionPath, data");
    }

    // 新增文檔
    const docRef = await db.collection(collectionPath).add(data);

    return {
      success: true,
      documentId: docRef.id,
      path: `${collectionPath}/${docRef.id}`,
      data: data
    };

  } catch (error) {
    FS_handleError(`新增到集合失敗: ${error.message}`, "新增文檔", requesterId || "", "FS_ADD_TO_COLLECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_ADD_TO_COLLECTION_ERROR'
    };
  }
}

/**
 * 33. 設置文檔 - 相容性函數
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @description 在Firestore中設置文檔（保留相容性）
 */
async function FS_setDocument(collectionPath, documentId, data, requesterId, options = {}) {
  const functionName = "FS_setDocument";
  try {
    FS_logOperation(`設置文檔: ${collectionPath}/${documentId}`, "設置文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId || !data) {
      throw new Error("缺少必要參數: collectionPath, documentId, data");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 設置選項
    const setOptions = options.merge ? { merge: true } : {};

    // 執行設置操作
    await docRef.set(data, setOptions);

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      operation: options.merge ? 'merge' : 'overwrite'
    };

  } catch (error) {
    FS_handleError(`設置文檔失敗: ${error.message}`, "設置文檔", requesterId || "", "FS_SET_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SET_DOCUMENT_ERROR'
    };
  }
}

// =============== 模組導出區 ===============

// 導出階段一核心函數
module.exports = {
  // 階段一核心基礎函數
  FS_initializeModule,
  FS_initializeConnection,
  FS_createDocument,
  FS_getDocument,
  FS_updateDocument,
  FS_deleteDocument,
  FS_queryCollection,
  FS_handleError,
  FS_logOperation,

  // 相容性函數（保留現有調用）
  FS_mergeDocument,
  FS_addToCollection,
  FS_setDocument,

  // 基礎配置
  db,
  admin,

  // 模組資訊
  moduleVersion: '2.1.0',
  phase: 'Phase1',
  lastUpdate: '2025-09-16'
};

// 自動初始化模組
try {
  const initResult = FS_initializeModule();
  if (initResult.success) {
    console.log('🎉 FS模組2.1.0階段一重構完成！');
    console.log(`📌 模組版本: ${initResult.version}`);
    console.log(`🎯 專注功能: Phase 1核心進入流程`);
  }
} catch (error) {
  console.error('❌ FS模組2.1.0初始化失敗:', error.message);
}