/**
* Debug 版本 - 檢查 Firebase 連線和環境變數
*/

// 使用已初始化的 Firebase 實例
const { admin, db } = require('./FB_Serviceaccountkey.js');

async function debugFirebaseConnection() {
  console.log('🔍 開始 Firebase 連線診斷...');

  // 檢查環境變數
  console.log('📋 環境變數檢查:');
  console.log(`- FB_PROJECT_ID: ${process.env.FB_PROJECT_ID ? '✅ 已設定' : '❌ 未設定'}`);
  console.log(`- FB_CLIENT_EMAIL: ${process.env.FB_CLIENT_EMAIL ? '✅ 已設定' : '❌ 未設定'}`);
  console.log(`- FB_PRIVATE_KEY_ID: ${process.env.FB_PRIVATE_KEY_ID ? '✅ 已設定' : '❌ 未設定'}`);
  console.log(`- UID_TEST: ${process.env.UID_TEST ? '✅ 已設定' : '❌ 未設定'}`);

  // 測試基本連線
  try {
    console.log('\n🔌 測試 Firestore 連線...');

    // 嘗試讀取一個簡單的文件（不存在也沒關係）
    const testRef = db.collection('test').doc('connection-test');
    await testRef.get();

    console.log('✅ Firestore 連線成功！');

    // 嘗試寫入測試
    console.log('\n✍️ 測試寫入權限...');
    await testRef.set({
      test: true,
      timestamp: admin.firestore.Timestamp.now()
    });

    console.log('✅ 寫入權限正常！');

    // 清理測試文件
    await testRef.delete();
    console.log('✅ 測試文件已清理');

  } catch (error) {
    console.error('❌ Firebase 連線失敗:', error.message);
    console.error('錯誤碼:', error.code);

    if (error.code === 5) {
      console.log('\n💡 錯誤碼 5 (NOT_FOUND) 可能原因:');
      console.log('1. Firebase 專案 ID 不正確');
      console.log('2. Firestore 資料庫未啟用');
      console.log('3. 服務帳戶權限不足');
      console.log('4. 專案不存在或已刪除');
    }
  }
}

// 執行診斷
debugFirebaseConnection();