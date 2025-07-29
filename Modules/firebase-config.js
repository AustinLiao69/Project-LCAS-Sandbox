
/**
 * Firebase動態配置模組_1.0.0
 * @module Firebase配置模組
 * @description LCAS 2.0 Firebase動態配置 - 從環境變數安全載入配置
 * @update 2025-01-24: 建立動態配置模組，取代靜態serviceaccountkey.json
 */

const admin = require('firebase-admin');

/**
 * 01. 從環境變數動態建立Firebase配置
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 12:00:00
 * @description 從Replit Secrets動態載入Firebase服務帳號配置
 */
function createFirebaseConfig() {
  try {
    // 檢查必要的環境變數
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID', 
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`缺少必要的環境變數: ${missingVars.join(', ')}`);
    }

    // 建立動態配置物件
    const firebaseConfig = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // 處理換行符
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || "googleapis.com"
    };

    // 驗證配置完整性
    validateFirebaseConfig(firebaseConfig);

    console.log('✅ Firebase動態配置建立成功');
    return firebaseConfig;

  } catch (error) {
    console.error('❌ Firebase動態配置建立失敗:', error.message);
    throw error;
  }
}

/**
 * 02. 驗證Firebase配置完整性
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 12:00:00
 * @description 驗證Firebase配置是否完整有效
 */
function validateFirebaseConfig(config) {
  const requiredFields = [
    'type', 'project_id', 'private_key_id', 'private_key', 
    'client_email', 'client_id', 'auth_uri', 'token_uri'
  ];

  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Firebase配置缺少必要欄位: ${missingFields.join(', ')}`);
  }

  // 驗證私鑰格式
  if (!config.private_key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('私鑰格式無效');
  }

  // 驗證email格式
  if (!config.client_email.includes('@')) {
    throw new Error('客戶端email格式無效');
  }

  console.log('✅ Firebase配置驗證通過');
}

/**
 * 03. 初始化Firebase Admin SDK
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 12:00:00
 * @description 使用動態配置初始化Firebase Admin SDK
 */
function initializeFirebaseAdmin() {
  try {
    // 如果已經初始化，直接返回
    if (admin.apps.length > 0) {
      console.log('✅ Firebase Admin SDK已初始化');
      return admin.app();
    }

    // 建立動態配置
    const serviceAccount = createFirebaseConfig();

    // 初始化Firebase Admin
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
    });

    console.log('✅ Firebase Admin SDK初始化成功');
    return app;

  } catch (error) {
    console.error('❌ Firebase Admin SDK初始化失敗:', error.message);
    throw error;
  }
}

/**
 * 04. 取得Firestore實例
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 12:00:00
 * @description 安全取得Firestore資料庫實例
 */
function getFirestoreInstance() {
  try {
    // 確保Firebase已初始化
    initializeFirebaseAdmin();
    
    // 取得Firestore實例
    const db = admin.firestore();
    console.log('✅ Firestore實例取得成功');
    return db;

  } catch (error) {
    console.error('❌ Firestore實例取得失敗:', error.message);
    throw error;
  }
}

/**
 * 05. 取得專案資訊
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 12:00:00
 * @description 安全取得Firebase專案相關資訊
 */
function getProjectInfo() {
  try {
    return {
      PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'default-project',
      UNIVERSE_DOMAIN: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com',
      CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL
    };
  } catch (error) {
    console.error('❌ 專案資訊取得失敗:', error.message);
    return {
      PROJECT_ID: 'default-project',
      UNIVERSE_DOMAIN: 'googleapis.com',
      CLIENT_EMAIL: null
    };
  }
}

/**
 * 06. 檢查環境變數設定狀態
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 12:00:00
 * @description 檢查所有必要的環境變數是否已設定
 */
function checkEnvironmentVariables() {
  const envVars = {
    FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY_ID: !!process.env.FIREBASE_PRIVATE_KEY_ID,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_CLIENT_ID: !!process.env.FIREBASE_CLIENT_ID,
    FIREBASE_AUTH_URI: !!process.env.FIREBASE_AUTH_URI,
    FIREBASE_TOKEN_URI: !!process.env.FIREBASE_TOKEN_URI,
    FIREBASE_AUTH_PROVIDER_X509_CERT_URL: !!process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    FIREBASE_CLIENT_X509_CERT_URL: !!process.env.FIREBASE_CLIENT_X509_CERT_URL
  };

  const setVars = Object.entries(envVars).filter(([key, value]) => value).map(([key]) => key);
  const missingVars = Object.entries(envVars).filter(([key, value]) => !value).map(([key]) => key);

  console.log('📊 環境變數設定狀態:');
  console.log(`✅ 已設定 (${setVars.length}/9):`, setVars);
  console.log(`❌ 未設定 (${missingVars.length}/9):`, missingVars);

  return {
    total: 9,
    set: setVars.length,
    missing: missingVars.length,
    setVars,
    missingVars,
    isComplete: missingVars.length === 0
  };
}

// 模組導出
module.exports = {
  createFirebaseConfig,
  validateFirebaseConfig,
  initializeFirebaseAdmin,
  getFirestoreInstance,
  getProjectInfo,
  checkEnvironmentVariables,
  admin
};
