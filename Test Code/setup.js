
/**
 * 測試環境設定_1.1.1
 * @module 測試環境設定
 * @description 測試前的全域設定與準備 - 移除Firebase Mock，使用真實Firebase
 * @version 1.1.1
 * @update 2025-07-15: 移除Firebase Admin Mock，直接使用真實Firebase進行測試
 * @date 2025-07-15 15:30:00
 */

// 全域測試設定
global.console = {
  ...console,
  log: jest.fn(console.log),
  error: jest.fn(console.error),
  warn: jest.fn(console.warn),
  info: jest.fn(console.info)
};

// Firebase Admin Mock 已移除 - 直接使用真實 Firebase Admin
// 測試環境將使用實際的 Firestore 連接進行測試

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
