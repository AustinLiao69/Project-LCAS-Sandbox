/**
 * Firebase動態配置模組_1.0.0
 * @module Firebase配置模組
 * @description LCAS 2.0 Firebase動態配置 - 從環境變數安全載入配置
 * @update 2025-01-24: 建立動態配置模組，取代靜態serviceaccountkey.json
 */

const admin = require('firebase-admin');

let firebaseApp = null;
let firestoreInstance = null;

/**
 * 01. 從環境變數動態建立Firebase配置
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 10:00:00
 * @description 從Replit Secrets動態建立Firebase服務帳號配置
 */
function createFirebaseConfig() {
  try {
    // 從環境變數讀取Firebase配置
    const firebaseConfig = {
      type: process.env.FIREBASE_TYPE || "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY ? 
        process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').trim() : null,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };

    // 驗證必要欄位
    const requiredFields = ['project_id', 'private_key', 'client_email'];
    for (const field of requiredFields) {
      if (!firebaseConfig[field]) {
        throw new Error(`缺少必要的Firebase配置: ${field}`);
      }
    }

    // 驗證私鑰格式
    if (!firebaseConfig.private_key.includes('-----BEGIN PRIVATE KEY-----') || 
        !firebaseConfig.private_key.includes('-----END PRIVATE KEY-----')) {
      console.error('⚠️ 私鑰格式異常，長度:', firebaseConfig.private_key.length);
      console.error('⚠️ 私鑰前100字元:', firebaseConfig.private_key.substring(0, 100));
      throw new Error('私鑰格式不正確：缺少 PEM 標頭或標尾');
    }

    console.log('✅ Firebase動態配置建立成功');
    return firebaseConfig;

  } catch (error) {
    console.error('❌ Firebase動態配置建立失敗:', error.message);
    throw error;
  }
}

/**
 * 02. 初始化Firebase Admin SDK
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 10:00:00
 * @description 使用動態配置初始化Firebase Admin SDK
 */
function initializeFirebaseAdmin() {
  try {
    // 檢查是否已初始化
    if (admin.apps.length > 0) {
      console.log('✅ Firebase Admin SDK已初始化');
      firebaseApp = admin.app();
      return firebaseApp;
    }

    // 建立動態配置
    const serviceAccountKey = createFirebaseConfig();

    // 初始化Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      databaseURL: `https://${serviceAccountKey.project_id}-default-rtdb.firebaseio.com`
    });

    console.log('✅ Firebase Admin SDK初始化成功');
    return firebaseApp;

  } catch (error) {
    console.error('❌ Firebase Admin SDK初始化失敗:', error.message);
    throw error;
  }
}

/**
 * 03. 取得Firestore實例
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 10:00:00
 * @description 安全取得Firestore資料庫實例
 */
function getFirestoreInstance() {
  try {
    if (!firestoreInstance) {
      if (!firebaseApp) {
        initializeFirebaseAdmin();
      }
      firestoreInstance = admin.firestore();
      console.log('✅ Firestore實例取得成功');
    }
    return firestoreInstance;
  } catch (error) {
    console.error('❌ Firestore實例取得失敗:', error.message);
    throw error;
  }
}

/**
 * 04. 驗證Firebase配置
 * @version 2025-01-24-V1.0.0
 * @date 2025-01-24 10:00:00
 * @description 驗證Firebase配置是否正確
 */
async function validateFirebaseConfig() {
  try {
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`缺少必要的環境變數: ${missingVars.join(', ')}`);
    }

    console.log('✅ Firebase配置驗證通過');
    return true;
  } catch (error) {
    console.error('❌ Firebase配置驗證失敗:', error.message);
    throw error;
  }
}

/**
 * 05. 取得專案資訊
 * @version 2025-08-22-V1.1.0
 * @date 2025-08-22 10:00:00
 * @description 取得Firebase專案的基本資訊
 */
function getProjectInfo() {
  try {
    return {
      PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'default-project',
      UNIVERSE_DOMAIN: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com',
      CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
      AUTH_URI: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth'
    };
  } catch (error) {
    console.error('❌ 取得專案資訊失敗:', error.message);
    return {
      PROJECT_ID: 'default-project',
      UNIVERSE_DOMAIN: 'googleapis.com',
      CLIENT_EMAIL: '',
      AUTH_URI: 'https://accounts.google.com/o/oauth2/auth'
    };
  }
}

/**
 * 06. 檢查環境變數
 * @version 2025-08-22-V1.1.0
 * @date 2025-08-22 10:00:00
 * @description 檢查Firebase相關環境變數的設定狀態
 */
function checkEnvironmentVariables() {
  try {
    const requiredVars = {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? '已設定' : '未設定',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID,
      FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID
    };

    const status = {
      allSet: true,
      missing: [],
      present: [],
      details: requiredVars
    };

    Object.keys(requiredVars).forEach(key => {
      if (!process.env[key]) {
        status.allSet = false;
        status.missing.push(key);
      } else {
        status.present.push(key);
      }
    });

    console.log(`✅ 環境變數檢查完成: ${status.present.length}個已設定, ${status.missing.length}個缺失`);
    
    if (status.missing.length > 0) {
      console.warn('⚠️ 缺失的環境變數:', status.missing.join(', '));
    }

    return status;
  } catch (error) {
    console.error('❌ 環境變數檢查失敗:', error.message);
    return {
      allSet: false,
      missing: [],
      present: [],
      error: error.message
    };
  }
}

// 導出模組
module.exports = {
  admin,
  initializeFirebaseAdmin,
  getFirestoreInstance,
  createFirebaseConfig,
  validateFirebaseConfig,
  getProjectInfo,
  checkEnvironmentVariables
};

// 自動驗證配置（僅在模組載入時執行一次）
if (process.env.NODE_ENV !== 'test') {
  try {
    validateFirebaseConfig();
  } catch (error) {
    console.warn('Firebase配置驗證警告:', error.message);
  }
}