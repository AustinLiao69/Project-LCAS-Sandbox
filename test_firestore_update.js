
/**
 * test_firestore_update.js_測試用Firestore更新腳本_1.0.0
 * @module 測試更新模組
 * @description 在 Test 集合的 TEST123 文件中新增 TEST456 字串欄位
 * @update 2025-07-08: 初版建立，新增指定欄位到現有文件
 */

// 直接使用 Firebase Admin SDK 和 Serviceaccountkey.json
const admin = require('firebase-admin');
const serviceAccount = require('./Serviceaccountkey.json');

// 初始化 Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

/**
 * 01. 新增 TEST456 欄位到 TEST123 文件
 * @version 2025-07-08-V1.0.0
 * @date 2025-07-08 10:52:00
 * @description 在 Test 集合的 TEST123 文件中新增 TEST456 字串欄位
 */
async function addTEST456Field() {
  try {
    console.log('🚀 開始在 Test/TEST123 文件中新增 TEST456 欄位...');
    
    // 取得 Test 集合中的 TEST123 文件引用
    const docRef = db.collection('Test').doc('TEST123');
    
    // 檢查文件是否存在
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      console.log('📄 TEST123 文件不存在，將建立新文件並新增欄位');
      // 如果文件不存在，建立新文件並加入 TEST456 欄位
      await docRef.set({
        TEST456: '',  // 初始值為空字串
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      console.log('✅ 已建立 TEST123 文件並新增 TEST456 欄位');
    } else {
      console.log('📄 TEST123 文件已存在，更新欄位...');
      // 如果文件存在，更新文件並新增 TEST456 欄位
      await docRef.update({
        TEST456: '',  // 初始值為空字串
        updatedAt: admin.firestore.Timestamp.now()
      });
      console.log('✅ 已在現有 TEST123 文件中新增 TEST456 欄位');
    }
    
    // 驗證更新結果
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();
    
    console.log('📊 更新後的文件內容:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data && data.hasOwnProperty('TEST456')) {
      console.log('🎉 TEST456 欄位新增成功！');
      console.log(`📝 TEST456 欄位值: "${data.TEST456}"`);
      console.log(`📅 更新時間: ${data.updatedAt ? data.updatedAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '未設定'}`);
    } else {
      console.log('❌ TEST456 欄位新增失敗');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 新增 TEST456 欄位時發生錯誤:', error);
    console.error('錯誤詳情:', error.message);
    return false;
  }
}

/**
 * 02. 主執行函數
 * @version 2025-07-08-V1.0.0
 * @date 2025-07-08 10:52:00
 * @description 執行欄位新增操作的主函數
 */
async function main() {
  try {
    console.log('🔧 開始執行 Firestore 欄位新增操作...');
    const result = await addTEST456Field();
    
    if (result) {
      console.log('✅ 操作完成！');
    } else {
      console.log('❌ 操作失敗！');
    }
    
  } catch (error) {
    console.error('💥 主執行函數發生錯誤:', error);
  }
}

// 執行主函數
main();

// 導出函數供其他模組使用
module.exports = {
  addTEST456Field
};
