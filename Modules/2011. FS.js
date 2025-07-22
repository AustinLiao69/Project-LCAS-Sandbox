/**
* FS_FirestoreStructure_資料庫結構模組_1.2.2
* @module 資料庫結構模組
* @description LCAS 2.0 Firestore資料庫結構初始化 - 建立完整架構（含Database層級）
* @update 2025-07-22: 升級至1.2.2版本，修復函數聲明順序問題，解決所有ReferenceError異常
*/

// 直接使用 Firebase Admin SDK 和 serviceaccountkey.json
const admin = require('firebase-admin');
const serviceAccount = require('./Serviceaccountkey.json');

// 初始化 Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

// 從 serviceAccount 取得專案資訊，並處理可能的 undefined 情況
const PROJECT_ID = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'default-project';
const UNIVERSE_DOMAIN = 'googleapis.com';

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = 'Asia/Taipei';

// =============== 核心函數聲明區 ===============

/**
 * 27. 取得文檔 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 從Firestore中取得指定文檔
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
 * 28. 更新文檔 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 更新Firestore中的文檔
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
 * 29. 刪除文檔 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 從Firestore中刪除文檔
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
 * 30. 合併文檔 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 合併更新Firestore中的文檔
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
 * 31. 查詢集合 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 查詢Firestore集合
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
 * 32. 新增到集合 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 新增文檔到Firestore集合
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
 * 33. 設置文檔 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 在Firestore中設置文檔，支援完整覆蓋或合併更新
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

/**
 * 34. 記錄操作日誌 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 記錄系統操作日誌到Firestore
 */
function FS_logOperation(message, operation, userId, errorCode, details, functionName) {
  try {
    console.log(`[FS_LOG] ${new Date().toISOString()} | ${operation} | ${message} | User: ${userId} | Function: ${functionName}`);
    return true;
  } catch (error) {
    console.error(`[FS_LOG_ERROR] ${error.toString()}`);
    return false;
  }
}

/**
 * 35. 錯誤處理 - 核心函數聲明
 * @version 2025-07-22-V1.2.2
 * @date 2025-07-22 10:20:00
 * @description 統一錯誤處理機制
 */
function FS_handleError(message, operation, userId, errorCode, details, functionName) {
  try {
    console.error(`[FS_ERROR] ${new Date().toISOString()} | ${operation} | ${message} | Error: ${errorCode} | Function: ${functionName}`);
    
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
* 00. 檢查並初始化 Firestore Database
* @version 2025-07-08-V1.0.2
* @date 2025-07-08 14:55:00
* @description 確保 Firestore Database 層級存在並可正常運作，修正project_id取得方式
*/
async function initFirestoreDatabase() {
  try {
    console.log('🔍 檢查 Firestore Database 連接狀態...');

    // 檢查 Database 連接
    const testRef = db.collection('_health_check').doc('connection_test');

    // 建立測試資料，避免 undefined 值
    const testData = {
      timestamp: admin.firestore.Timestamp.now(),
      status: 'database_initialized',
      message: 'Database connection verified',
      test_id: `test_${Date.now()}`
    };

    // 只有在 PROJECT_ID 有值時才加入
    if (PROJECT_ID && PROJECT_ID !== 'default-project') {
      testData.project_id = PROJECT_ID;
    }

    await testRef.set(testData);

    // 立即刪除測試文件
    await testRef.delete();

    console.log('✅ Firestore Database 連接正常');
    console.log(`📊 Database Project ID: ${PROJECT_ID}`);
    console.log(`🌐 Universe Domain: ${UNIVERSE_DOMAIN}`);

    return true;
  } catch (error) {
    console.error('❌ Firestore Database 初始化失敗:', error);
    throw error;
  }
}

/**
* 01. 初始化完整資料庫結構主函數
* @version 2025-07-08-V1.0.9
* @date 2025-07-08 15:00:00
* @update: 修正project_id undefined問題，加入UTC+8時區支援和完整錯誤處理
*/
async function initDatabaseStructure() {
  const lineUID = process.env.UID_TEST;
  if (!lineUID) {
    console.error('❌ 找不到 UID_TEST 環境變數，請在 Replit Secrets 中設定');
    console.error('💡 請至 Tools > Secrets 新增 UID_TEST 變數');
    return;
  }

  console.log(`📱 使用 Secrets 中的 LINE UID: ${lineUID}`);

  const ledgerId = 'ledger_structure_001';
  const currentTime = new Date();
  const utcPlus8Time = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000));

  try {
    console.log(`🚀 開始建立 LCAS 2.0 完整資料庫結構... (執行者: AustinLiao69)`);
    console.log(`⏰ 當前 UTC 時間: ${currentTime.toISOString()}`);
    console.log(`🇹🇼 當前 UTC+8 時間: ${utcPlus8Time.toISOString()}`);

    // 步驟 0：初始化 Database 層級
    await initFirestoreDatabase();

    // 步驟 1-6：依序建立各項資料庫結構
    await createUserCollection(lineUID);
    await createLedgerCollection(ledgerId, lineUID);
    await createSubjectsCollection(ledgerId);
    await createEntriesCollection(ledgerId, lineUID);
    await createLogCollection(ledgerId, lineUID, currentTime);
    await createAccountMappingsCollection();

    // 步驟 6：建立系統層級的 metadata
    await createSystemMetadata(currentTime);

    console.log('✅ LCAS 2.0 完整資料庫結構建立完成！');
    console.log(`✅ UTC 時間: ${currentTime.toISOString()}`);
    console.log(`✅ 執行者: AustinLiao69`);
    console.log(`✅ 使用者 ID: ${lineUID}`);
    console.log(`✅ 帳本 ID: ${ledgerId}`);
    console.log('🎉 Database → Collections → Documents → Fields 完整架構已建立！');

  } catch (error) {
    console.error('❌ 資料庫結構建立失敗:', error);
    await logError(ledgerId, lineUID, error, currentTime);
  }
}

/**
* 02. 建立使用者集合結構
* @version 2025-07-02-V1.0.3
* @date 2025-07-02 03:34:16
* @update: 使用統一的Firebase實例
*/
async function createUserCollection(lineUID) {
  await db.collection('users').doc(lineUID).set({
    createdAt: admin.firestore.Timestamp.now(), // 自動記錄註冊時間
    joined_ledgers: [],                        // 參加的帳本陣列
    lastActive: admin.firestore.Timestamp.now(), // 最後活動時間
    settings: {                                // 用戶設定
      timezone: 'Asia/Taipei',                 // 時區設定
      notifications: true                      // 通知設定
    }
  });
  console.log('✅ Users Collection 結構建立完成');
}

/**
* 03. 建立帳本集合結構
* @version 2025-07-02-V1.0.3
* @date 2025-07-02 03:34:16
* @update: 修正欄位命名，移除settings和statistics
*/
async function createLedgerCollection(ledgerId, lineUID) {
  await db.collection('ledgers').doc(ledgerId).set({
    ledgername: '',                            // 帳本名稱 (修改自name)
    description: '',                           // 帳本描述
    ownerUID: '',                              // 擁有者 LINE UID (修改自owner)
    MemberUID: [],                             // 成員陣列 (修改自members)
    createdAt: admin.firestore.Timestamp.now(), // 自動記錄建立時間
    updatedAt: admin.firestore.Timestamp.now()  // 最後更新時間
  });
  console.log('✅ Ledgers Collection 結構建立完成');
}

/**
* 04. 建立科目代碼集合結構並導入完整科目資料
* @version 2025-07-11-V1.0.4
* @date 2025-07-11 16:00:00
* @update: 從 9999. Subject_code.json 導入完整科目資料
*/
async function createSubjectsCollection(ledgerId) {
  try {
    // 先建立 template 文件
    await db.collection('ledgers').doc(ledgerId).collection('subjects').doc('template').set({
      大項代碼: '',                              // 3碼大項代碼 (如: 100)
      大項名稱: '',                              // 大項名稱 (如: 食物飲料)
      子項代碼: '',                              // 5碼完整代碼 (如: 10001)
      子項名稱: '',                              // 子項名稱 (如: 早餐)
      同義詞: '',                                // 同義詞字串，逗號分隔
      isActive: true,                            // 是否啟用
      sortOrder: 0,                              // 排序順序
      createdAt: admin.firestore.Timestamp.now(), // 自動記錄建立時間
      updatedAt: admin.firestore.Timestamp.now()  // 最後更新時間
    });

    // 導入完整科目資料
    const subjectData = require('../Miscellaneous/9999. Subject_code.json');
    const batch = db.batch();

    console.log(`🔄 開始導入 ${subjectData.length} 筆科目資料...`);

    let importCount = 0;
    for (const subject of subjectData) {
      const docId = `${subject.大項代碼}_${subject.子項代碼}`;
      const subjectRef = db.collection('ledgers').doc(ledgerId).collection('subjects').doc(docId);

      batch.set(subjectRef, {
        大項代碼: String(subject.大項代碼),
        大項名稱: subject.大項名稱 || '',
        子項代碼: String(subject.子項代碼),
        子項名稱: subject.子項名稱 || '',
        同義詞: subject.同義詞 || '',
        isActive: true,
        sortOrder: importCount,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });

      importCount++;

      // 每 400 筆提交一次 batch（Firestore 限制 500 筆）
      if (importCount % 400 === 0) {
        await batch.commit();
        console.log(`📦 已提交 ${importCount} 筆科目資料...`);
      }
    }

    // 提交剩餘的資料
    if (importCount % 400 !== 0) {
      await batch.commit();
    }

    console.log(`✅ 科目資料導入完成，共 ${importCount} 筆`);
    console.log('✅ Subjects Sub-Collection 結構建立完成');

  } catch (error) {
    console.error('❌ 科目表初始化失敗:', error);
    console.log('✅ Subjects Sub-Collection 結構建立完成（僅 template）');
  }
}

/**
* 05. 建立帳本紀錄集合結構
* @version 2025-07-02-V1.0.3
* @date 2025-07-02 03:34:16
* @update: 修改為範本文件建立，使用.doc('template').set()而非.add()
*/
async function createEntriesCollection(ledgerId, lineUID) {
  await db.collection('ledgers').doc(ledgerId).collection('entries').doc('template').set({
    收支ID: '',                                // YYYYMMDD-序號格式
    使用者類型: '',                            // M/S/J (多人/單人/訪客)
    日期: '',                                  // YYYY/MM/DD 格式 (用戶輸入的顯示日期)
    時間: '',                                  // HH:MM 格式 (用戶輸入的顯示時間)
    大項代碼: '',                              // 3碼大項代碼
    子項代碼: '',                              // 5碼完整代碼
    支付方式: '',                              // 現金/刷卡/轉帳/行動支付 (8開頭預設現金)
    子項名稱: '',                              // 科目名稱
    UID: '',                                   // LINE UID (統一使用UID)
    備註: '',                                  // 備註說明
    收入: null,                                // 收入金額 (8開頭科目)
    支出: null,                                // 支出金額 (非8開頭科目)
    同義詞: '',                                // 用戶輸入的原始文字
    currency: 'NTD',                           // 該筆記帳的幣別 (預設新台幣)
    timestamp: admin.firestore.Timestamp.now() // 系統自動記錄的精確時間戳記
  });
  console.log('✅ Entries Sub-Collection 結構建立完成');
}

/**
* 06. 建立系統日誌集合結構
* @version 2025-07-02-V1.0.3
* @date 2025-07-02 03:34:16
* @update: 簡化log結構，統一使用UID
*/
async function createLogCollection(ledgerId, lineUID, currentTime) {
  await db.collection('ledgers').doc(ledgerId).collection('log').add({
    時間: admin.firestore.Timestamp.now(),      // 自動記錄當前時間
    訊息: 'LCAS 2.0 完整資料庫結構初始化完成',  // 日誌訊息
    操作類型: '完整結構建立',                    // 操作類型分類
    UID: lineUID,                              // 操作者 LINE UID (統一使用UID)
    錯誤代碼: null,                            // 錯誤代碼 (無錯誤時為null)
    來源: 'Replit',                            // 來源系統
    錯誤詳情: `執行者: AustinLiao69, UTC時間: ${currentTime.toISOString()}`, // 詳細資訊
    重試次數: 0,                               // 重試次數
    程式碼位置: '2011-FS-Enhanced.js:createLogCollection', // 程式碼位置
    嚴重等級: 'INFO'                           // DEBUG/INFO/WARNING/ERROR/CRITICAL
  });
  console.log('✅ Log Sub-Collection 結構建立完成');
}

/**
* 07. 建立跨平台帳號映射集合結構（新增）
* @version 2025-01-09-V1.0.0
* @date 2025-01-09 00:34:00
* @description 建立account_mappings collection，記錄跨平台帳號關聯
*/
async function createAccountMappingsCollection() {
  await db.collection('account_mappings').doc('template').set({
    primary_UID: '',                           // 主要用戶ID
    platform_accounts: {                      // 平台帳號對應
      LINE: '',                               // LINE UID
      iOS: '',                                // iOS UID  
      Android: ''                             // Android UID
    },
    email: '',                                // 用於關聯的Email（可選）
    created_at: admin.firestore.Timestamp.now(), // 建立時間
    updated_at: admin.firestore.Timestamp.now(), // 更新時間
    status: 'active'                          // 狀態: active/suspended/deactivated
  });
  console.log('✅ Account Mappings Collection 結構建立完成');
}

/**
* 07. 建立系統級 Metadata（新增）
* @version 2025-07-08-V1.0.2
* @date 2025-07-08 14:55:00
* @description 建立系統層級的metadata，記錄資料庫結構版本等資訊，修正project_id取得方式
*/
async function createSystemMetadata(currentTime) {
  // 取得 UTC+8 時間
  const utcPlus8Time = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000));

  const metadataDoc = {
    database_version: '2.0',                   // 資料庫版本
    structure_version: '1.0.8',               // 結構版本（更新至當前版本）
    last_structure_update: admin.firestore.Timestamp.now(), // 最後結構更新時間
    creator: 'AustinLiao69',                   // 建立者
    environment: 'production',                // 環境標識
    lcas_version: '2.0',                      // LCAS 版本
    timezone: TIMEZONE,                       // 時區設定
    structure_modules: [                       // 結構模組清單
      'users',
      'ledgers',
      'subjects',
      'entries', 
      'log',
      'account_mappings'
    ],
    created_utc: currentTime.toISOString(),    // UTC 建立時間
    created_local: utcPlus8Time.toISOString(), // UTC+8 建立時間
    notes: 'Complete Firestore structure with Database → Collections → Documents → Fields hierarchy'
  };

  // 只有在 PROJECT_ID 有效時才加入
  if (PROJECT_ID && PROJECT_ID !== 'default-project') {
    metadataDoc.project_id = PROJECT_ID;
  }

  await db.collection('_system').doc('metadata').set(metadataDoc);
  console.log('✅ System Metadata 建立完成');
}

/**
* 08. 錯誤處理與日誌記錄
* @version 2025-07-02-V1.0.3
* @date 2025-07-02 03:34:16
* @update: 統一使用UID，簡化錯誤處理
*/
async function logError(ledgerId, lineUID, error, currentTime) {
  try {
    await db.collection('ledgers').doc(ledgerId).collection('log').add({
      時間: admin.firestore.Timestamp.now(),
      訊息: '完整資料庫結構建立過程發生錯誤',
      操作類型: '完整結構建立',
      UID: lineUID || 'unknown',               // 統一使用UID
      錯誤代碼: error.code || 'UNKNOWN_ERROR',
      來源: 'Replit',
      錯誤詳情: `錯誤訊息: ${error.message}, 執行者: AustinLiao69, UTC時間: ${currentTime.toISOString()}`,
      重試次數: 0,
      程式碼位置: '2011-FS-Enhanced.js:logError', // 修正程式碼位置
      嚴重等級: 'ERROR'
    });
  } catch (logError) {
    console.error('❌ 連錯誤 Log 都寫入失敗:', logError);
  }
}

// 執行完整資料庫結構初始化
initDatabaseStructure();


/**
* 17. 為指定用戶初始化科目數據
* @version 2025-07-11-V1.0.0
* @date 2025-07-11 18:00:00
* @description 從系統科目表複製預設科目到用戶個人帳本
*/
async function initUserSubjects(userUID, ledgerIdPrefix = 'user_') {
  try {
    console.log(`🔄 開始為用戶 ${userUID} 初始化科目數據...`);

    const userLedgerId = `${ledgerIdPrefix}${userUID}`;

    // 導入完整科目資料
    const subjectData = require('../Miscellaneous/9999. Subject_code.json');
    const batch = db.batch();

    console.log(`📋 準備導入 ${subjectData.length} 筆科目資料到 ${userLedgerId}...`);

    let importCount = 0;
    for (const subject of subjectData) {
      const docId = `${subject.大項代碼}_${subject.子項代碼}`;
      const subjectRef = db.collection('ledgers').doc(userLedgerId).collection('subjects').doc(docId);

      batch.set(subjectRef, {
        大項代碼: String(subject.大項代碼),
        大項名稱: subject.大項名稱 || '',
        子項代碼: String(subject.子項代碼),
        子項名稱: subject.子項名稱 || '',
        同義詞: subject.同義詞 || '',
        isActive: true,
        sortOrder: importCount,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });

      importCount++;

      // 每 400 筆提交一次 batch
      if (importCount % 400 === 0) {
        await batch.commit();
        console.log(`📦 已提交 ${importCount} 筆科目資料到用戶帳本...`);
      }
    }

    // 提交剩餘的資料
    if (importCount % 400 !== 0) {
      await batch.commit();
    }

    console.log(`✅ 用戶 ${userUID} 科目初始化完成，共導入 ${importCount} 筆科目`);
    return {
      success: true,
      importCount: importCount,
      userLedgerId: userLedgerId
    };

  } catch (error) {
    console.error(`❌ 用戶 ${userUID} 科目初始化失敗:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
* 18. 立即執行測試用戶科目初始化
* @version 2025-07-11-V1.0.0
* @date 2025-07-11 18:00:00
* @description 為測試用戶 Uae47d9d496e4596d70ed724a7d6e2948 初始化科目
*/
async function fixTestUserSubjects() {
  const testUID = 'Uae47d9d496e4596d70ed724a7d6e2948';
  console.log(`🔧 開始修復測試用戶 ${testUID} 的科目數據...`);

  const result = await initUserSubjects(testUID);

  if (result.success) {
    console.log(`🎉 測試用戶科目修復完成！`);
    console.log(`📊 帳本 ID: ${result.userLedgerId}`);
    console.log(`📋 導入科目數量: ${result.importCount}`);
  } else {
    console.error(`❌ 測試用戶科目修復失敗: ${result.error}`);
  }

  return result;
}

// =============== SR模組專用集合操作函數 ===============

/**
 * 21. 建立SR排程提醒記錄
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 在scheduled_reminders集合中建立新的提醒記錄
 */
async function FS_createSRReminder(reminderData, requesterId) {
  const functionName = "FS_createSRReminder";
  try {
    FS_logOperation(`建立SR提醒記錄: ${reminderData.reminderId}`, "建立文件", reminderData.userId, "", "", functionName);

    // 驗證必要欄位
    const requiredFields = ['reminderId', 'userId', 'reminderType', 'cronExpression'];
    for (const field of requiredFields) {
      if (!reminderData[field]) {
        throw new Error(`缺少必要欄位: ${field}`);
      }
    }

    // 建立完整的提醒記錄
    const reminderRecord = {
      ...reminderData,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      createdBy: requesterId,
      active: true,
      executionCount: 0,
      failureCount: 0
    };

    const result = await FS_setDocument('scheduled_reminders', reminderData.reminderId, reminderRecord, requesterId);

    if (result.success) {
      return {
        success: true,
        reminderId: reminderData.reminderId,
        data: reminderRecord
      };
    }

    return result;

  } catch (error) {
    FS_handleError(`建立SR提醒失敗: ${error.message}`, "建立文件", reminderData?.userId || "", "FS_SR_CREATE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SR_CREATE_ERROR'
    };
  }
}

/**
 * 22. 更新SR排程提醒記錄
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 更新scheduled_reminders集合中的提醒記錄
 */
async function FS_updateSRReminder(reminderId, updateData, requesterId) {
  const functionName = "FS_updateSRReminder";
  try {
    FS_logOperation(`更新SR提醒: ${reminderId}`, "更新文件", updateData.userId || "", "", "", functionName);

    // 新增更新時間戳
    const dataWithTimestamp = {
      ...updateData,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: requesterId
    };

    const result = await FS_updateDocument('scheduled_reminders', reminderId, dataWithTimestamp, requesterId);

    return result;

  } catch (error) {
    FS_handleError(`更新SR提醒失敗: ${error.message}`, "更新文件", "", "FS_SR_UPDATE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SR_UPDATE_ERROR'
    };
  }
}

/**
 * 23. 查詢SR排程提醒
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 查詢scheduled_reminders集合中的提醒記錄
 */
async function FS_querySRReminders(userId, filters, requesterId) {
  const functionName = "FS_querySRReminders";
  try {
    FS_logOperation(`查詢SR提醒: ${userId}`, "查詢集合", userId, "", "", functionName);

    // 建立查詢條件
    const queryConditions = [
      { field: 'userId', operator: '==', value: userId }
    ];

    // 新增額外篩選條件
    if (filters) {
      if (filters.active !== undefined) {
        queryConditions.push({ field: 'active', operator: '==', value: filters.active });
      }
      if (filters.reminderType) {
        queryConditions.push({ field: 'reminderType', operator: '==', value: filters.reminderType });
      }
    }

    const result = await FS_queryCollection('scheduled_reminders', queryConditions, requesterId, {
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: filters?.limit || 50
    });

    return result;

  } catch (error) {
    FS_handleError(`查詢SR提醒失敗: ${error.message}`, "查詢集合", userId, "FS_SR_QUERY_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SR_QUERY_ERROR'
    };
  }
}

/**
 * 24. 管理SR用戶配額
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 管理user_quotas集合中的用戶配額資訊
 */
async function FS_manageSRUserQuota(userId, operation, quotaData, requesterId) {
  const functionName = "FS_manageSRUserQuota";
  try {
    FS_logOperation(`管理SR配額: ${operation}`, "配額管理", userId, "", "", functionName);

    let result;

    switch (operation) {
      case 'get':
        result = await FS_getDocument('user_quotas', userId, requesterId);
        break;

      case 'set':
        const quotaRecord = {
          ...quotaData,
          userId,
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: requesterId
        };
        result = await FS_setDocument('user_quotas', userId, quotaRecord, requesterId);
        break;

      case 'update':
        const updateData = {
          ...quotaData,
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: requesterId
        };
        result = await FS_updateDocument('user_quotas', userId, updateData, requesterId);
        break;

      case 'increment':
        // 增量更新配額使用量
        const incrementData = {};
        Object.keys(quotaData).forEach(key => {
          incrementData[key] = admin.firestore.FieldValue.increment(quotaData[key]);
        });
        incrementData.updatedAt = admin.firestore.Timestamp.now();
        result = await FS_updateDocument('user_quotas', userId, incrementData, requesterId);
        break;

      default:
        throw new Error(`不支援的操作: ${operation}`);
    }

    return result;

  } catch (error) {
    FS_handleError(`管理SR配額失敗: ${error.message}`, "配額管理", userId, "FS_SR_QUOTA_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SR_QUOTA_ERROR'
    };
  }
}

/**
 * 25. 記錄SR活動日誌
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 在scheduler_logs集合中記錄SR模組活動
 */
async function FS_logSRActivity(activityData, requesterId) {
  const functionName = "FS_logSRActivity";
  try {
    // 建立日誌記錄
    const logRecord = {
      ...activityData,
      timestamp: admin.firestore.Timestamp.now(),
      source: 'SR_module',
      loggedBy: requesterId,
      processed: false
    };

    const result = await FS_addToCollection('scheduler_logs', logRecord, requesterId);

    return result;

  } catch (error) {
    FS_handleError(`記錄SR活動失敗: ${error.message}`, "活動記錄", "", "FS_SR_LOG_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SR_LOG_ERROR'
    };
  }
}

/**
 * 26. 處理SR Quick Reply會話
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 管理quick_reply_sessions集合中的Quick Reply會話資料
 */
async function FS_handleSRQuickReply(userId, interactionData, requesterId) {
  const functionName = "FS_handleSRQuickReply";
  try {
    FS_logOperation(`處理SR Quick Reply: ${userId}`, "Quick Reply", userId, "", "", functionName);

    // 建立會話記錄
    const sessionRecord = {
      userId,
      ...interactionData,
      timestamp: admin.firestore.Timestamp.now(),
      source: 'SR_module',
      processed: false
    };

    const result = await FS_addToCollection('quick_reply_sessions', sessionRecord, requesterId);

    return result;

  } catch (error) {
    FS_handleError(`處理SR Quick Reply失敗: ${error.message}`, "Quick Reply", userId, "FS_SR_QR_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SR_QR_ERROR'
    };
  }
}

// 導出所有函數
module.exports = {
  // 核心文件操作函數
  FS_getDocument,
  FS_setDocument,
  FS_updateDocument,
  FS_deleteDocument,
  FS_mergeDocument,

  // 核心集合操作函數
  FS_queryCollection,
  FS_addToCollection,

  // SR模組專用集合操作
  FS_createSRReminder,
  FS_updateSRReminder,
  FS_querySRReminders,
  FS_manageSRUserQuota,
  FS_logSRActivity,
  FS_handleSRQuickReply,

  // 系統管理函數
  FS_logOperation,
  FS_handleError,

  // 資料庫初始化函數
  initDatabaseStructure,
  initUserSubjects,
  fixTestUserSubjects,

  // 基礎配置
  db,
  admin
};