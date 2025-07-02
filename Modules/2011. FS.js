/**
* FS_FirestoreStructure_資料庫結構模組_1.0.3
* @module 資料庫結構模組
* @description LCAS 2.0 Firestore資料庫結構初始化 - 建立完整欄位架構
* @update 2025-07-02: 簡化結構，修正命名規範，移除不必要欄位
*/

const admin = require('firebase-admin');
const serviceAccount = require('./FB_Serviceaccountkey.js');

// Firebase 初始化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
* 01. 初始化資料庫結構主函數
* @version 2025-07-02-V1.0.2
* @date 2025-07-02 02:39:48
* @update: 簡化結構，修正命名規範，移除settings和statistics
*/
async function initDatabaseStructure() {
  const lineUID = process.env.UID_TEST;
  if (!lineUID) {
    console.error('❌ 找不到 UID_TEST 環境變數，請在 Replit Secrets 中設定');
    return;
  }

  const ledgerId = 'ledger_structure_001';
  const currentTime = new Date();

  try {
    console.log(`🚀 開始建立 LCAS 2.0 資料庫結構... (執行者: AustinLiao69)`);
    console.log(`⏰ 當前 UTC 時間: ${currentTime.toISOString()}`);

    // 依序建立各項資料庫結構
    await createUserCollection(lineUID);
    await createLedgerCollection(ledgerId, lineUID);
    await createSubjectsCollection(ledgerId);
    await createEntriesCollection(ledgerId, lineUID);
    await createLogCollection(ledgerId, lineUID, currentTime);

    console.log('✅ LCAS 2.0 資料庫結構建立完成！');
    console.log(`✅ UTC 時間: ${currentTime.toISOString()}`);
    console.log(`✅ 執行者: AustinLiao69`);
    console.log(`✅ 使用者 ID: ${lineUID}`);
    console.log(`✅ 帳本 ID: ${ledgerId}`);
    console.log('🎉 所有 Collection 欄位結構已準備就緒！');

  } catch (error) {
    console.error('❌ 資料庫結構建立失敗:', error);
    await logError(ledgerId, lineUID, error, currentTime);
  }
}

/**
* 02. 建立使用者集合結構
* @version 2025-07-02-V1.0.2
* @date 2025-07-02 02:39:48
* @update: 保持簡化的用戶資料結構
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
* @version 2025-07-02-V1.0.2
* @date 2025-07-02 02:39:48
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
* @version 2025-07-02-V1.0.2
* @date 2025-07-02 02:39:48
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
* @version 2025-07-02-V1.0.2
* @date 2025-07-02 02:39:48
* @update: 修改幣別預設值為NTD，保留日期/時間與timestamp的差異說明
*/
async function createEntriesCollection(ledgerId, lineUID) {
  await db.collection('ledgers').doc(ledgerId).collection('entries').add({
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
* @version 2025-07-02-V1.0.2
* @date 2025-07-02 02:39:48
* @update: 簡化log結構，統一使用UID
*/
async function createLogCollection(ledgerId, lineUID, currentTime) {
  await db.collection('ledgers').doc(ledgerId).collection('log').add({
    時間: admin.firestore.Timestamp.now(),      // 自動記錄當前時間
    訊息: 'LCAS 2.0 資料庫結構初始化完成',      // 日誌訊息
    操作類型: '結構建立',                        // 操作類型分類
    UID: '',                                   // 操作者 LINE UID (統一使用UID)
    錯誤代碼: null,                            // 錯誤代碼 (無錯誤時為null)
    來源: 'Replit',                            // 來源系統
    錯誤詳情: `執行者: AustinLiao69, UTC時間: ${currentTime.toISOString()}`, // 詳細資訊
    重試次數: 0,                               // 重試次數
    程式碼位置: 'initUserData.js:createLogCollection', // 程式碼位置
    嚴重等級: 'INFO'                           // DEBUG/INFO/WARNING/ERROR/CRITICAL
  });
  console.log('✅ Log Sub-Collection 結構建立完成');
}

/**
* 07. 錯誤處理與日誌記錄
* @version 2025-07-02-V1.0.2
* @date 2025-07-02 02:39:48
* @update: 統一使用UID，簡化錯誤處理
*/
async function logError(ledgerId, lineUID, error, currentTime) {
  try {
    await db.collection('ledgers').doc(ledgerId).collection('log').add({
      時間: admin.firestore.Timestamp.now(),
      訊息: '資料庫結構建立過程發生錯誤',
      操作類型: '結構建立',
      UID: lineUID || 'unknown',               // 統一使用UID
      錯誤代碼: error.code || 'UNKNOWN_ERROR',
      來源: 'Replit',
      錯誤詳情: `錯誤訊息: ${error.message}, 執行者: AustinLiao69, UTC時間: ${currentTime.toISOString()}`,
      重試次數: 0,
      程式碼位置: 'initUserData.js:logError',
      嚴重等級: 'ERROR'
    });
  } catch (logError) {
    console.error('❌ 連錯誤 Log 都寫入失敗:', logError);
  }
}

// 執行資料庫結構初始化
initDatabaseStructure();