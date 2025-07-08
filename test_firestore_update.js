
/**
 * test_firestore_update.js_測試用Firestore資料庫建立腳本_2.0.0
 * @module 測試資料庫建立模組
 * @description 連接到 test00000 資料庫，建立 test 集合和 test123 文件
 * @update 2025-07-08: 修改為專門操作 test00000 資料庫
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

// 連接到 test00000 資料庫
const db = admin.firestore();
const testDb = db.database('test00000');

/**
 * 01. 在 test00000 資料庫中建立 test 集合和 test123 文件
 * @version 2025-07-08-V2.0.0
 * @date 2025-07-08 12:35:00
 * @description 在 test00000 資料庫中建立 test 集合，並在其中建立 test123 文件
 */
async function createTestCollectionAndDocument() {
  try {
    console.log('🚀 開始在 test00000 資料庫中建立 test 集合和 test123 文件...');
    console.log('📊 目標資料庫: test00000');
    console.log('📁 目標集合: test');
    console.log('📄 目標文件: test123');
    
    // 取得 test00000 資料庫中 test 集合的 test123 文件引用
    const docRef = testDb.collection('test').doc('test123');
    
    // 檢查文件是否存在
    const docSnapshot = await docRef.get();
    
    if (!docSnapshot.exists) {
      console.log('📄 test123 文件不存在，建立新文件...');
      
      // 建立測試資料
      const testData = {
        name: 'test123',
        description: '測試文件 - 在 test00000 資料庫中建立',
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        database: 'test00000',
        collection: 'test',
        status: 'active',
        testField: 'Hello from test00000 database!',
        version: '1.0.0',
        metadata: {
          creator: 'LCAS System',
          purpose: 'Database connection test',
          environment: 'test',
          projectId: serviceAccount.project_id
        }
      };
      
      await docRef.set(testData);
      console.log('✅ 已建立 test123 文件');
      
    } else {
      console.log('📄 test123 文件已存在，更新時間戳記...');
      
      await docRef.update({
        updatedAt: admin.firestore.Timestamp.now(),
        lastModified: admin.firestore.Timestamp.now(),
        modificationCount: admin.firestore.FieldValue.increment(1)
      });
      console.log('✅ 已更新 test123 文件時間戳記');
    }
    
    // 驗證建立結果
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();
    
    console.log('📊 文件內容:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data) {
      console.log('🎉 test123 文件操作成功！');
      console.log(`📝 文件名稱: ${data.name || '未設定'}`);
      console.log(`📋 描述: ${data.description || '未設定'}`);
      console.log(`📊 資料庫: ${data.database || '未設定'}`);
      console.log(`📁 集合: ${data.collection || '未設定'}`);
      console.log(`📅 建立時間: ${data.createdAt ? data.createdAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '未設定'}`);
      console.log(`🔄 更新時間: ${data.updatedAt ? data.updatedAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '未設定'}`);
      console.log('🔗 完整路徑: /databases/test00000/documents/test/test123');
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
      console.log('1. test00000 資料庫可能尚未在 Firebase Console 中建立');
      console.log('2. 資料庫名稱可能不正確');
      console.log('3. Service Account 權限可能不足');
      console.log('4. 請確認在 Firebase Console 中已建立 test00000 資料庫');
    }
    
    return false;
  }
}

/**
 * 02. 主執行函數
 * @version 2025-07-08-V2.0.0
 * @date 2025-07-08 12:35:00
 * @description 執行 test00000 資料庫測試資料建立操作的主函數
 */
async function main() {
  try {
    console.log('🎯 開始執行 test00000 資料庫測試資料建立操作...');
    console.log('=' * 60);
    console.log(`📊 專案 ID: ${serviceAccount.project_id}`);
    console.log(`🔧 目標資料庫: test00000`);
    console.log(`📁 目標集合: test`);
    console.log(`📄 目標文件: test123`);
    console.log('=' * 60);
    
    const result = await createTestCollectionAndDocument();
    
    if (result) {
      console.log('✅ 測試資料建立操作完成！');
      console.log('🎉 您現在可以在 Firebase Console 中查看建立的資料：');
      console.log('📍 路徑: Firebase Console → Firestore Database → test00000 → test → test123');
    } else {
      console.log('❌ 測試資料建立操作失敗！');
      console.log('💡 請檢查 Firebase Console 中是否已建立 test00000 資料庫');
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
