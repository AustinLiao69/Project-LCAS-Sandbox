const admin = require('firebase-admin');

const serviceAccount = {
  type: process.env.FB_TYPE || "service_account",
  project_id: process.env.FB_PROJECT_ID,
  private_key_id: process.env.FB_PRIVATE_KEY_ID,
  private_key: process.env.FB_PRIVATE_KEY ? process.env.FB_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  client_email: process.env.FB_CLIENT_EMAIL,
  client_id: process.env.FB_CLIENT_ID,
  auth_uri: process.env.FB_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FB_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FB_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FB_UNIVERSE_DOMAIN || "googleapis.com"
};

// 初始化 Firebase Admin（避免重複初始化）
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 匯出 admin 和 firestore 實例供其他模組使用
const db = admin.firestore();

module.exports = {
  admin,
  db,
  serviceAccount
};

console.log("Firebase 初始化完成，Universe Domain:", serviceAccount.universe_domain);