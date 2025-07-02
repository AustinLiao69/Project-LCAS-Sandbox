/**
 * Firestore 啟用狀態檢查工具
 */

console.log('🔍 Firestore 啟用狀態檢查');
console.log('=' * 50);

const projectId = process.env.FB_PROJECT_ID;
console.log(`📋 檢查專案: ${projectId}`);

try {
  const { admin, db } = require('./FB_Serviceaccountkey.js');

  (async () => {
    try {
      console.log('\n🔌 測試 Firestore 服務狀態...');

      // 測試 1: 嘗試獲取資料庫實例
      console.log('📝 測試 1: 獲取資料庫實例...');
      const firestoreInstance = admin.firestore();
      console.log('✅ Firestore 實例創建成功');

      // 測試 2: 嘗試列出現有的 collections
      console.log('📝 測試 2: 列出現有 collections...');
      const collections = await db.listCollections();
      console.log(`✅ 成功列出 collections (數量: ${collections.length})`);

      if (collections.length === 0) {
        console.log('ℹ️  資料庫是空的，這是正常的（新資料庫）');
      } else {
        console.log('📂 現有 collections:');
        collections.forEach((col, index) => {
          console.log(`   ${index + 1}. ${col.id}`);
        });
      }

      // 測試 3: 嘗試讀取一個不存在的文件（測試讀取權限）
      console.log('📝 測試 3: 測試讀取權限...');
      const testDocRef = db.collection('_test').doc('non-existent');
      const docSnapshot = await testDocRef.get();
      console.log(`✅ 讀取權限正常 (文件存在: ${docSnapshot.exists})`);

      // 測試 4: 嘗試寫入測試文件（測試寫入權限）
      console.log('📝 測試 4: 測試寫入權限...');
      const writeTestRef = db.collection('_firestore_test').doc('connection_test');

      await writeTestRef.set({
        test: true,
        message: 'Firestore 連線測試',
        timestamp: admin.firestore.Timestamp.now(),
        from: 'Replit',
        user: 'AustinLiao69'
      });

      console.log('✅ 寫入權限正常');

      // 測試 5: 讀取剛寫入的文件
      console.log('📝 測試 5: 驗證寫入的資料...');
      const verifyDoc = await writeTestRef.get();
      if (verifyDoc.exists) {
        const data = verifyDoc.data();
        console.log('✅ 資料驗證成功');
        console.log(`   訊息: ${data.message}`);
        console.log(`   時間: ${data.timestamp.toDate().toISOString()}`);
      }

      // 清理測試資料
      console.log('📝 清理測試資料...');
      await writeTestRef.delete();
      console.log('✅ 測試資料已清理');

      console.log('\n🎉 Firestore 完全正常運作！');
      console.log('✅ 資料庫已啟用');
      console.log('✅ 讀取權限正常');
      console.log('✅ 寫入權限正常');
      console.log('✅ 可以執行您的主程式了');

    } catch (error) {
      console.error('\n❌ Firestore 測試失敗');
      console.error(`錯誤碼: ${error.code}`);
      console.error(`錯誤訊息: ${error.message}`);

      // 根據錯誤碼提供具體建議
      switch (error.code) {
        case 5: // NOT_FOUND
          console.log('\n💡 錯誤碼 5 (NOT_FOUND) 表示:');
          console.log('🔴 Firestore 資料庫尚未建立');
          console.log('');
          console.log('📋 解決步驟:');
          console.log('1. 前往 Firebase Console');
          console.log('2. 選擇您的專案');
          console.log('3. 點擊「Firestore Database」');
          console.log('4. 點擊「建立資料庫」');
          console.log('5. 選擇「以測試模式啟動」');
          console.log('6. 選擇資料庫位置（建議: asia-east1）');
          break;

        case 7: // PERMISSION_DENIED
          console.log('\n💡 錯誤碼 7 (PERMISSION_DENIED) 表示:');
          console.log('🔴 服務帳戶權限不足');
          console.log('📋 檢查服務帳戶是否有 Firestore 管理員權限');
          break;

        case 3: // INVALID_ARGUMENT
          console.log('\n💡 錯誤碼 3 (INVALID_ARGUMENT) 表示:');
          console.log('🔴 請求參數錯誤');
          console.log('📋 檢查專案 ID 或服務帳戶設定');
          break;

        default:
          console.log(`\n💡 未知錯誤碼 ${error.code}`);
          console.log('📋 建議重新檢查所有 Firebase 設定');
      }
    }
  })();

} catch (error) {
  console.error('❌ 無法載入 Firebase 模組:', error.message);
}