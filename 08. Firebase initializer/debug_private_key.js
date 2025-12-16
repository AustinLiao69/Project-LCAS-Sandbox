

/**
 * Firebase 私鑰格式診斷腳本
 * 用於檢查和修復 FIREBASE_PRIVATE_KEY 格式問題
 */

const fs = require('fs');

function debugPrivateKey() {
  console.log('🔍 Firebase 私鑰格式診斷開始...\n');

  // 1. 檢查環境變數
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  console.log('📋 基本檢查:');
  console.log(`✓ FIREBASE_PRIVATE_KEY 是否設定: ${privateKey ? '是' : '否'}`);
  
  if (!privateKey) {
    console.log('❌ FIREBASE_PRIVATE_KEY 未設定');
    console.log('💡 請在 Replit Secrets 中設定 FIREBASE_PRIVATE_KEY');
    return;
  }

  console.log(`✓ 私鑰長度: ${privateKey.length} 字元`);

  // 2. 檢查 PEM 格式標頭和標尾
  const hasBeginHeader = privateKey.includes('-----BEGIN PRIVATE KEY-----');
  const hasEndFooter = privateKey.includes('-----END PRIVATE KEY-----');
  
  console.log(`✓ 包含 BEGIN 標頭: ${hasBeginHeader ? '是' : '否'}`);
  console.log(`✓ 包含 END 標尾: ${hasEndFooter ? '是' : '否'}`);

  // 3. 檢查換行符號
  const hasUnixNewlines = privateKey.includes('\n');
  const hasEscapedNewlines = privateKey.includes('\\n');
  
  console.log(`✓ 包含 Unix 換行符號 (\\n): ${hasUnixNewlines ? '是' : '否'}`);
  console.log(`✓ 包含轉義換行符號 (\\\\n): ${hasEscapedNewlines ? '是' : '否'}`);

  // 4. 顯示私鑰前後部分
  console.log('\n📋 私鑰內容檢查:');
  console.log('前100字元:', privateKey.substring(0, 100));
  console.log('後100字元:', privateKey.substring(privateKey.length - 100));

  // 5. 檢查是否包含必要的 Base64 內容
  const lines = privateKey.split('\n');
  const base64Content = lines.filter(line => 
    !line.includes('-----BEGIN') && 
    !line.includes('-----END') && 
    line.trim().length > 0
  ).join('');
  
  console.log(`✓ Base64 內容長度: ${base64Content.length} 字元`);

  // 6. 嘗試修復私鑰格式
  console.log('\n🔧 嘗試修復私鑰格式...');
  
  let fixedKey = privateKey;
  
  // 修復雙斜線換行符號
  if (privateKey.includes('\\\\n')) {
    fixedKey = fixedKey.replace(/\\\\n/g, '\n');
    console.log('✓ 修復雙斜線換行符號');
  }
  
  // 修復單斜線換行符號
  if (fixedKey.includes('\\n')) {
    fixedKey = fixedKey.replace(/\\n/g, '\n');
    console.log('✓ 修復單斜線換行符號');
  }
  
  // 清理首尾空白
  fixedKey = fixedKey.trim();
  
  // 檢查修復後的格式
  const fixedHasBegin = fixedKey.includes('-----BEGIN PRIVATE KEY-----');
  const fixedHasEnd = fixedKey.includes('-----END PRIVATE KEY-----');
  
  console.log('\n📋 修復後檢查:');
  console.log(`✓ 修復後長度: ${fixedKey.length} 字元`);
  console.log(`✓ 修復後包含 BEGIN 標頭: ${fixedHasBegin ? '是' : '否'}`);
  console.log(`✓ 修復後包含 END 標尾: ${fixedHasEnd ? '是' : '否'}`);

  // 7. 生成建議的私鑰格式
  if (fixedHasBegin && fixedHasEnd) {
    console.log('\n✅ 私鑰格式修復成功！');
    
    // 將修復後的私鑰寫入臨時檔案供參考
    fs.writeFileSync('temp_fixed_private_key.txt', fixedKey);
    console.log('💾 修復後的私鑰已儲存至: temp_fixed_private_key.txt');
    
    // 測試解析
    try {
      const admin = require('firebase-admin');
      const testConfig = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID || "test-project",
        private_key_id: "test-key-id",
        private_key: fixedKey,
        client_email: "test@test.iam.gserviceaccount.com",
        client_id: "123456789",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token"
      };
      
      // 測試憑證建立（不初始化應用程式）
      const credential = admin.credential.cert(testConfig);
      console.log('✅ 私鑰格式驗證通過！可以正常解析');
      
    } catch (testError) {
      console.log('❌ 私鑰格式仍有問題:', testError.message);
    }
  } else {
    console.log('\n❌ 私鑰格式仍不正確');
    
    if (!fixedHasBegin) {
      console.log('💡 缺少 "-----BEGIN PRIVATE KEY-----" 標頭');
    }
    if (!fixedHasEnd) {
      console.log('💡 缺少 "-----END PRIVATE KEY-----" 標尾');
    }
  }

  // 8. 提供修復建議
  console.log('\n💡 修復建議:');
  console.log('1. 確保私鑰包含完整的 PEM 格式標頭和標尾');
  console.log('2. 在 Replit Secrets 中重新設定 FIREBASE_PRIVATE_KEY');
  console.log('3. 私鑰格式應該像這樣:');
  console.log('-----BEGIN PRIVATE KEY-----');
  console.log('MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKc...');
  console.log('(多行 Base64 編碼內容)');
  console.log('-----END PRIVATE KEY-----');
}

// 執行診斷
if (require.main === module) {
  debugPrivateKey();
}

module.exports = { debugPrivateKey };

