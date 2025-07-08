/**
* FS_FirestoreStructure_資料庫結構模組_1.0.9
* @module 資料庫結構模組
* @description LCAS 2.0 Firestore資料庫結構初始化 - 建立完整架構（含Database層級）
* @update 2025-07-08: 升級至1.0.9版本，修正project_id undefined問題，加入UTC+8時區支援
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
* 04. 建立科目代碼集合結構
* @version 2025-07-02-V1.0.3
* @date 2025-07-02 03:34:16
* @update: 保持科目代碼結構不變
*/
async function createSubjectsCollection(ledgerId) {
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
  console.log('✅ Subjects Sub-Collection 結構建立完成');
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