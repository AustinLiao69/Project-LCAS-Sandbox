

/**
 * Firestore 資料庫初始化腳本
 * 根據 0070. DB schema.md 建立必要的集合和預設資料
 */

const admin = require('firebase-admin');
const firebaseConfig = require('../13. Replit_Module code_BL/1399. firebase-config');

async function initializeFirestore() {
  try {
    console.log('🔥 開始初始化 Firestore 資料庫...');

    // 初始化 Firebase Admin
    const app = firebaseConfig.initializeFirebaseAdmin();
    const db = firebaseConfig.getFirestoreInstance();

    console.log('✅ Firebase 連接成功');

    // 1. 建立系統配置集合
    await createSystemConfigurations(db);

    // 2. 建立索引配置
    await createIndexConfiguration(db);

    // 3. 建立預設使用者（測試用）
    await createDefaultTestUser(db);

    // 4. 建立協作架構定義
    await createCollaborationStructure(db);

    console.log('🎉 Firestore 資料庫初始化完成！');

  } catch (error) {
    console.error('❌ 初始化失敗:', error);
    throw error;
  }
}

async function createSystemConfigurations(db) {
  console.log('📋 建立系統配置...');

  // 載入預設配置
  const fs = require('fs');
  const path = require('path');

  try {
    // 載入預設配置文件
    const defaultConfig = JSON.parse(fs.readFileSync('../03. Default_config/0301. Default_config.json', 'utf8'));
    const defaultWallet = JSON.parse(fs.readFileSync('../03. Default_config/0302. Default_wallet.json', 'utf8'));
    const defaultCurrency = JSON.parse(fs.readFileSync('../03. Default_config/0303. Default_currency.json', 'utf8'));

    // 儲存到 _system 集合
    await db.collection('_system').doc('default_config').set({
      ...defaultConfig,
      created_at: admin.firestore.Timestamp.now(),
      version: '1.0.0',
      source: '0301. Default_config.json'
    });

    await db.collection('_system').doc('default_wallet_config').set({
      ...defaultWallet,
      created_at: admin.firestore.Timestamp.now(),
      version: '1.0.0',
      source: '0302. Default_wallet.json'
    });

    await db.collection('_system').doc('default_currency_config').set({
      ...defaultCurrency,
      created_at: admin.firestore.Timestamp.now(),
      version: '1.0.0',
      source: '0303. Default_currency.json'
    });

    console.log('✅ 系統配置建立完成');
  } catch (error) {
    console.warn('⚠️ 預設配置載入失敗:', error.message);
  }
}

async function createIndexConfiguration(db) {
  console.log('📊 建立索引配置...');

  const indexConfig = {
    indexes: [
      {
        collectionGroup: "collaborations",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "ledgerId", order: "ASCENDING" },
          { fieldPath: "userId", order: "ASCENDING" },
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "DESCENDING" }
        ]
      },
      {
        collectionGroup: "budgets",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "type", order: "ASCENDING" },
          { fieldPath: "start_date", order: "ASCENDING" }
        ]
      },
      {
        collectionGroup: "wallets",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "userId", order: "ASCENDING" },
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "type", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "DESCENDING" }
        ]
      },
      {
        collectionGroup: "categories",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "userId", order: "ASCENDING" },
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "type", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "DESCENDING" }
        ]
      }
    ],
    created_at: admin.firestore.Timestamp.now(),
    version: '1.0.0'
  };

  await db.collection('_system').doc('firestore_indexes').set(indexConfig);
  console.log('✅ 索引配置建立完成');
}

async function createDefaultTestUser(db) {
  console.log('👤 建立測試使用者...');

  const testUserId = 'test_user_001';
  const testUser = {
    UID: testUserId,
    displayName: '測試使用者',
    userType: 'S',
    email: 'test@lcas.app',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    lastActive: admin.firestore.Timestamp.now(),
    timezone: 'Asia/Taipei',
    linkedAccounts: {
      LINE_UID: '',
      iOS_UID: '',
      Android_UID: ''
    },
    settings: {
      notifications: true,
      language: 'zh-TW'
    },
    joined_ledgers: [],
    metadata: {
      source: 'SYSTEM_INIT'
    },
    status: 'active'
  };

  await db.collection('users').doc(testUserId).set(testUser);

  // 建立預設帳本
  const ledgerId = `user_${testUserId}`;
  const testLedger = {
    id: ledgerId,
    name: '測試帳本',
    owner: testUserId,
    type: 'personal',
    userId: testUserId,
    description: '系統初始化建立的測試帳本',
    status: 'active',
    initializationComplete: true,
    subjectCount: 0,
    walletCount: 0,
    settings: {
      currency: 'TWD',
      timezone: 'Asia/Taipei',
      dateFormat: 'YYYY-MM-DD',
      language: 'zh-TW'
    },
    metadata: {
      version: '1.0.0',
      createdBy: 'SYSTEM',
      initializationStage: 'complete'
    },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  };

  await db.collection('ledgers').doc(ledgerId).set(testLedger);

  console.log('✅ 測試使用者和帳本建立完成');
}

async function createCollaborationStructure(db) {
  console.log('🤝 建立協作架構...');

  const collaborationStructure = {
    version: '2.3.0',
    description: '協作管理模組Firebase集合架構',
    last_updated: '2025-12-15',
    architecture: 'collaboration_based',
    collections: {
      'collaborations': {
        description: '協作主集合 - 帳本協作資訊管理',
        collection_path: 'collaborations',
        subcollections: ['members', 'invitations', 'permissions']
      }
    },
    created_at: admin.firestore.Timestamp.now(),
    managed_by: 'CM_v2.3.0'
  };

  await db.collection('_system').doc('collaboration_structure').set(collaborationStructure);

  // 建立協作集合佔位符
  await db.collection('collaborations').doc('_placeholder').set({
    type: 'collection_placeholder',
    purpose: '確保 collaborations 集合存在',
    version: '1.0.0',
    createdAt: admin.firestore.Timestamp.now()
  });

  console.log('✅ 協作架構建立完成');
}

// 執行初始化
if (require.main === module) {
  initializeFirestore().catch(console.error);
}

module.exports = { initializeFirestore };

