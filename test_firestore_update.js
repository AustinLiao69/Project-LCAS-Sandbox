
/**
 * test_firestore_update.js_測試用Firestore資料庫建立腳本_2.0.1
 * @module 測試資料庫建立模組
 * @description 建立 TEST 集合和 TEST123 文件，包含 TEST456 欄位
 * @update 2025-07-08: 修改為建立 TEST 集合、TEST123 文件和 TEST456 欄位
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

// 連接到 Firestore 資料庫
const db = admin.firestore();

console.log('📊 使用 Firestore 資料庫實例');
console.log(`📊 專案 ID: ${serviceAccount.project_id}`);

/**
 * 01. 建立 TEST 集合和 TEST123 文件，包含 TEST456 欄位
 * @version 2025-07-08-V2.0.1
 * @date 2025-07-08 12:45:00
 * @description 在 Firestore 中建立 TEST 集合，並在其中建立 TEST123 文件，包含 TEST456 欄位
 */
async function createTestCollectionAndDocument() {
  try {
    console.log('🚀 開始建立 TEST 集合和 TEST123 文件...');
    console.log('📁 目標集合: TEST');
    console.log('📄 目標文件: TEST123');
    console.log('🏷️ 目標欄位: TEST456');
    
    // 取得 TEST 集合的 TEST123 文件引用
    const docRef = db.collection('TEST').doc('TEST123');
    
    // 檢查文件是否存在
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      console.log('📄 TEST123 文件不存在，建立新文件...');
      
      // 建立測試資料，包含 TEST456 欄位
      const testData = {
        TEST456: 'Hello from TEST456 field!',
        name: 'TEST123',
        description: '測試文件 - 在 TEST 集合中建立的 TEST123 文件',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        database: 'default',
        collection: 'TEST',
        document: 'TEST123',
        status: 'active',
        version: '1.0.0',
        metadata: {
          creator: 'LCAS System',
          purpose: 'TEST 集合測試資料',
          environment: 'test',
          projectId: serviceAccount.project_id,
          specialField: 'TEST456'
        }
      };
      
      await docRef.set(testData);
      console.log('✅ 已建立 TEST123 文件，包含 TEST456 欄位');
      
    } else {
      console.log('📄 TEST123 文件已存在，更新 TEST456 欄位和時間戳記...');
      
      await docRef.update({
        TEST456: 'Updated TEST456 field value!',
        updatedAt: admin.firestore.Timestamp.now(),
        lastModified: admin.firestore.Timestamp.now(),
        modificationCount: admin.firestore.FieldValue.increment(1)
      });
      console.log('✅ 已更新 TEST123 文件的 TEST456 欄位');
    }
    
    // 驗證建立結果
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();
    
    console.log('📊 文件內容:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data) {
      console.log('🎉 TEST123 文件操作成功！');
      console.log(`📁 集合名稱: TEST`);
      console.log(`📄 文件名稱: TEST123`);
      console.log(`🏷️ TEST456 欄位值: ${data.TEST456 || '未設定'}`);
      console.log(`📝 描述: ${data.description || '未設定'}`);
      console.log(`📅 建立時間: ${data.createdAt ? data.createdAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '未設定'}`);
      console.log(`🔄 更新時間: ${data.updatedAt ? data.updatedAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '未設定'}`);
      console.log('🔗 完整路徑: /databases/(default)/documents/TEST/TEST123');
    } else {
      console.log('❌ 無法讀取文件資料');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 建立測試資料時發生錯誤:', error);
    console.error('錯誤詳情:', error.message);
    console.error('錯誤代碼:', error.code);
    
    if (error.code === 5) {
      console.log('💡 可能的問題：');
      console.log('1. Firestore 資料庫可能尚未在 Firebase Console 中啟用');
      console.log('2. Service Account 權限可能不足');
      console.log('3. 請確認在 Firebase Console 中已啟用 Firestore 資料庫');
      console.log('4. 檢查專案 ID 是否正確');
    }
    
    return false;
  }
}

/**
 * 02. 主執行函數
 * @version 2025-07-08-V2.0.1
 * @date 2025-07-08 12:45:00
 * @description 執行 TEST 集合和 TEST123 文件建立操作的主函數
 */
async function main() {
  try {
    console.log('🎯 開始執行 TEST 集合和 TEST123 文件建立操作...');
    console.log('=' * 60);
    console.log(`📊 專案 ID: ${serviceAccount.project_id}`);
    console.log(`🔧 目標資料庫: default (預設資料庫)`);
    console.log(`📁 目標集合: TEST`);
    console.log(`📄 目標文件: TEST123`);
    console.log(`🏷️ 目標欄位: TEST456`);
    console.log('=' * 60);
    
    const result = await createTestCollectionAndDocument();
    
    if (result) {
      console.log('✅ TEST 集合和 TEST123 文件建立操作完成！');
      console.log('🎉 您現在可以在 Firebase Console 中查看建立的資料：');
      console.log('📍 路徑: Firebase Console → Firestore Database → (default) → TEST → TEST123');
      console.log('🏷️ 欄位: TEST456');
    } else {
      console.log('❌ 建立操作失敗！');
      console.log('💡 請檢查 Firebase Console 中是否已啟用 Firestore 資料庫');
    }
    
  } catch (error) {
    console.error('💥 主執行函數發生錯誤:', error);
  }
}

// 執行主函數
main();

// 導出函數供其他模組使用
module.exports = {
  createTestCollectionAndDocument
};
