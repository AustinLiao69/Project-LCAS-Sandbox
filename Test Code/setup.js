
/**
 * 測試環境設定_1.1.0
 * @module 測試環境設定
 * @description 測試前的全域設定與準備 - 增強錯誤處理機制
 * @version 1.1.0
 * @update 2025-07-15: 增強測試環境設定，改善錯誤處理與版本追蹤
 * @date 2025-07-15 11:46:00
 */

// 全域測試設定
global.console = {
  ...console,
  log: jest.fn(console.log),
  error: jest.fn(console.error),
  warn: jest.fn(console.warn),
  info: jest.fn(console.info)
};

// 模擬 Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          exists: true,
          data: () => ({
            id: 'test_id',
            name: 'test_name',
            type: 'project',
            owner_id: 'test_owner',
            members: ['test_owner'],
            permissions: {
              owner: 'test_owner',
              admins: [],
              members: [],
              viewers: [],
              settings: {
                allow_invite: true,
                allow_edit: true,
                allow_delete: false
              }
            }
          })
        })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve())
      })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({
          docs: []
        }))
      })),
      add: jest.fn(() => Promise.resolve({ id: 'test_doc_id' }))
    }))
  })),
  FieldValue: {
    serverTimestamp: jest.fn()
  }
}));

// 測試資料庫設定
const testDatabase = {
  ledgers: new Map(),
  activities: new Map(),
  users: new Map()
};

// 測試工具函數
global.testUtils = {
  createTestUser: (id, role = 'member') => ({
    id,
    role,
    email: `${id}@test.com`,
    name: `Test User ${id}`
  }),
  
  createTestLedger: (id, type = 'project', ownerId = 'test_owner') => ({
    id,
    type,
    name: `Test Ledger ${id}`,
    owner_id: ownerId,
    members: [ownerId],
    permissions: {
      owner: ownerId,
      admins: [],
      members: [],
      viewers: [],
      settings: {
        allow_invite: true,
        allow_edit: true,
        allow_delete: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  }),
  
  cleanupTestData: () => {
    testDatabase.ledgers.clear();
    testDatabase.activities.clear();
    testDatabase.users.clear();
  }
};

// 測試前準備
beforeAll(async () => {
  console.log('🔧 全域測試環境準備...');
  
  // 建立測試用戶
  const testUsers = ['test_owner_1', 'test_owner_2', 'test_admin_1', 'test_admin_2', 
                     'test_member_1', 'test_member_2', 'test_viewer_1', 'test_viewer_2'];
  
  testUsers.forEach(userId => {
    testDatabase.users.set(userId, global.testUtils.createTestUser(userId));
  });
  
  console.log('✅ 測試環境準備完成');
});

// 測試後清理
afterAll(async () => {
  console.log('🧹 全域測試環境清理...');
  global.testUtils.cleanupTestData();
  console.log('✅ 測試環境清理完成');
});
