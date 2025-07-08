
/**
 * FB_Serviceaccountkey_Firebase服務帳戶金鑰模組_2.0.0
 * @module Firebase服務帳戶金鑰模組
 * @description LCAS Firebase 服務帳戶金鑰初始化模組 - 優化環境變數處理和錯誤提示
 * @update 2025-07-08: 修正模組結構，符合專案編碼規範，增強錯誤處理
 */

const admin = require('firebase-admin');

/**
 * 01. 環境變數驗證與服務帳戶配置
 * @version 2025-07-08-V2.0.0
 * @date 2025-07-08 09:45:00
 * @description 檢查並建立Firebase服務帳戶配置物件
 */
function validateAndCreateServiceAccount() {
  console.log('🔍 開始驗證 Firebase 環境變數...');
  
  const requiredVars = [
    'FB_PROJECT_ID',
    'FB_PRIVATE_KEY_ID', 
    'FB_PRIVATE_KEY',
    'FB_CLIENT_EMAIL',
    'FB_CLIENT_ID',
    'FB_CLIENT_X509_CERT_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的 Firebase 環境變數:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.log('💡 請在 Replit Secrets 中設定這些環境變數');
    throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
  }
  
  console.log('✅ Firebase 環境變數驗證通過');
  
  return {
    type: process.env.FB_TYPE || "service_account",
    project_id: process.env.FB_PROJECT_ID,
    private_key_id: process.env.FB_PRIVATE_KEY_ID,
    private_key: process.env.FB_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FB_CLIENT_EMAIL,
    client_id: process.env.FB_CLIENT_ID,
    auth_uri: process.env.FB_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
    token_uri: process.env.FB_TOKEN_URI || "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FB_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FB_UNIVERSE_DOMAIN || "googleapis.com"
  };
}

/**
 * 02. Firebase Admin SDK 初始化
 * @version 2025-07-08-V2.0.0
 * @date 2025-07-08 09:45:00
 * @description 初始化Firebase Admin SDK，避免重複初始化
 */
function initializeFirebaseAdmin(serviceAccount) {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK 初始化完成');
      console.log(`📊 專案 ID: ${serviceAccount.project_id}`);
      console.log(`🌐 Universe Domain: ${serviceAccount.universe_domain}`);
    } catch (error) {
      console.error('❌ Firebase Admin SDK 初始化失敗:', error.message);
      throw error;
    }
  } else {
    console.log('ℹ️  Firebase Admin SDK 已經初始化');
  }
}

/**
 * 03. Firestore 資料庫實例建立
 * @version 2025-07-08-V2.0.0
 * @date 2025-07-08 09:45:00
 * @description 建立並配置Firestore資料庫實例
 */
function createFirestoreInstance() {
  try {
    const db = admin.firestore();
    
    // 設定 Firestore 配置
    db.settings({
      ignoreUndefinedProperties: true
    });
    
    console.log('✅ Firestore 資料庫連接建立完成');
    return db;
  } catch (error) {
    console.error('❌ Firestore 資料庫連接失敗:', error.message);
    throw error;
  }
}

// 執行初始化流程
let serviceAccount, db;

try {
  serviceAccount = validateAndCreateServiceAccount();
  initializeFirebaseAdmin(serviceAccount);
  db = createFirestoreInstance();
} catch (error) {
  console.error('💥 Firebase 初始化過程中發生錯誤:', error.message);
  throw error;
}

/**
 * 04. 模組導出
 * @version 2025-07-08-V2.0.0
 * @date 2025-07-08 09:45:00
 * @description 導出 Firebase Admin、Firestore 實例和服務帳戶配置
 */
module.exports = {
  admin,
  db,
  serviceAccount
};
