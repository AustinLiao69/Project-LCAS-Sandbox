
/**
* FB_Serviceaccountkey_Firebase初始化模組_1.0.0
* @module Firebase初始化模組
* @description LCAS 2.0 Firebase Admin SDK 統一初始化模組
* @update 2025-07-08: 初版建立，提供統一的 Firebase 實例
*/

const admin = require('firebase-admin');
const serviceAccount = require('../Serviceaccountkey.json');

// 檢查是否已經初始化，避免重複初始化
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      // 可選：設定其他 Firebase 服務
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/`,
      storageBucket: `${serviceAccount.project_id}.appspot.com`
    });
    
    console.log('🔥 Firebase Admin SDK 初始化成功');
    console.log(`📊 Project ID: ${serviceAccount.project_id}`);
    
  } catch (error) {
    console.error('❌ Firebase Admin SDK 初始化失敗:', error);
    throw error;
  }
} else {
  console.log('🔥 Firebase Admin SDK 已初始化，重複使用現有實例');
}

// 取得 Firestore 實例
const db = admin.firestore();

// 設定 Firestore 參數
db.settings({
  timestampsInSnapshots: true,
  ignoreUndefinedProperties: true
});

console.log('📄 Firestore 實例建立成功');

// 導出實例供其他模組使用
module.exports = {
  admin,
  db
};
