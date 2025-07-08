
/**
 * create_test_data.js_測試資料庫建立腳本_1.0.0
 * @module 測試資料建立模組
 * @description 在 test00000 資料庫中建立 test 集合和 test123 文件
 * @update 2025-07-08: 初版建立，專門用於測試資料庫操作
 */

const admin = require('firebase-admin');
const serviceAccount = require('./Serviceaccountkey.json');

/**
 * 01. 初始化 Firebase Admin SDK 連接到 test00000 資料庫
 * @version 2025-07-08-V1.0.0
 * @date 2025-07-08 12:30:00
 * @description 建立專門連接到 test00000 資料庫的 Firebase 實例
 */
function initializeTestDatabase() {
  try {
    console.log('🔧 初始化 Firebase Admin SDK 連接到 test00000 資料庫...');
    
    // 檢查是否已經有 app 實例
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    
    // 連接到 test00000 資料庫
    const db = admin.firestore();
    const testDb = db.database('test00000');
    
    console.log('✅ Firebase Admin SDK 初始化成功');
    console.log(`📊 連接到資料庫: test00000`);
    console.log(`📋 專案 ID: ${serviceAccount.project_id}`);
    
    return testDb;
    
  } catch (error) {
    console.error('❌ Firebase 初始化失敗:', error);
    throw error;
  }
}

/**
 * 02. 在 test00000 資料庫中建立 test 集合和 test123 文件
 * @version 2025-07-08-V1.0.0
 * @date 2025-07-08 12:30:00
 * @description 建立測試集合和文件，包含基本測試資料
 */
async function createTestCollectionAndDocument() {
  try {
    console.log('🚀 開始在 test00000 資料庫中建立測試資料...');
    
    // 獲取 test00000 資料庫實例
    const testDb = initializeTestDatabase();
    
    // 取得 test 集合的 test123 文件引用
    const testCollection = testDb.collection('test');
    const testDoc = testCollection.doc('test123');
    
    console.log('📝 建立 test123 文件...');
    
    // 建立文件並添加初始資料
    const testData = {
      name: 'test123',
      description: '測試文件',
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
        environment: 'test'
      }
    };
    
    await testDoc.set(testData);
    
    console.log('✅ test123 文件建立成功！');
    console.log('📊 文件資料:');
    console.log(JSON.stringify(testData, null, 2));
    
    // 驗證文件是否建立成功
    const docSnapshot = await testDoc.get();
    
    if (docSnapshot.exists) {
      console.log('🎉 驗證成功：test123 文件已成功建立在 test00000 資料庫中！');
      console.log('📋 文件內容:');
      console.log(JSON.stringify(docSnapshot.data(), null, 2));
      
      // 顯示文件路徑
      console.log('📍 文件路徑: test00000/test/test123');
      console.log('🔗 完整路徑: /databases/test00000/documents/test/test123');
      
    } else {
      console.log('❌ 驗證失敗：文件未建立成功');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 建立測試資料時發生錯誤:', error);
    console.error('錯誤詳情:', error.message);
    
    if (error.code === 5) {
      console.log('💡 可能的問題：');
      console.log('1. test00000 資料庫可能尚未建立');
      console.log('2. 資料庫名稱可能不正確');
      console.log('3. 權限設定可能有問題');
    }
    
    return false;
  }
}

/**
 * 03. 主執行函數
 * @version 2025-07-08-V1.0.0
 * @date 2025-07-08 12:30:00
 * @description 執行完整的測試資料建立流程
 */
async function main() {
  try {
    console.log('🎯 開始建立 test00000 資料庫測試資料...');
    console.log('=' * 50);
    
    const result = await createTestCollectionAndDocument();
    
    if (result) {
      console.log('✅ 測試資料建立完成！');
      console.log('🎉 您現在可以在 Firebase Console 中查看：');
      console.log('📍 路徑: Firebase Console → Firestore Database → test00000 → test → test123');
    } else {
      console.log('❌ 測試資料建立失敗！');
    }
    
  } catch (error) {
    console.error('💥 主執行函數發生錯誤:', error);
  }
}

// 執行主函數
main();

// 導出函數供其他模組使用
module.exports = {
  initializeTestDatabase,
  createTestCollectionAndDocument
};
