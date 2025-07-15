
/**
 * 測試環境設定_1.1.2
 * @module 測試環境設定
 * @description 測試前的全域設定與準備 - 加入動態測試資料生成工具支援
 * @version 1.1.2
 * @update 2025-07-15: 版次升級，加入動態測試資料生成工具函數，強化Firestore測試支援
 * @date 2025-07-15 16:00:00
 */

// 全域測試設定
global.console = {
  ...console,
  log: jest.fn(console.log),
  error: jest.fn(console.error),
  warn: jest.fn(console.warn),
  info: jest.fn(console.info)
};

// 測試資料庫設定
const testDatabase = {
  ledgers: new Map(),
  activities: new Map(),
  users: new Map(),
  dynamicSubjects: new Map(), // 動態科目快取
  testCaseHistory: new Map()  // 測試案例歷史
};

// 動態測試資料生成工具
global.dynamicTestUtils = {
  /**
   * 生成隨機用戶ID
   * @returns {string} 隨機用戶ID
   */
  generateRandomUserId: () => {
    return `test_user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  },

  /**
   * 生成隨機金額
   * @param {string} range - 金額範圍 ('small', 'medium', 'large')
   * @returns {number} 隨機金額
   */
  generateRandomAmount: (range = 'medium') => {
    const ranges = {
      small: [10, 500],
      medium: [500, 5000],
      large: [5000, 50000]
    };
    const [min, max] = ranges[range] || ranges.medium;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * 生成隨機科目名稱
   * @param {string} category - 科目分類
   * @returns {string} 隨機科目名稱
   */
  generateRandomSubject: (category = 'general') => {
    const subjects = {
      general: ['測試科目', '隨機項目', '動態測試'],
      food: ['午餐', '晚餐', '早餐', '咖啡', '下午茶'],
      transport: ['捷運', '公車', '計程車', '油費', '停車費'],
      income: ['薪水', '獎金', '兼職', '投資收益', '利息']
    };
    const subjectList = subjects[category] || subjects.general;
    return subjectList[Math.floor(Math.random() * subjectList.length)];
  },

  /**
   * 生成隨機ProcessID
   * @param {string} prefix - 前綴
   * @returns {string} 隨機ProcessID
   */
  generateRandomProcessId: (prefix = 'TEST') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  },

  /**
   * 記錄測試案例到歷史
   * @param {string} testCase - 測試案例名稱
   * @param {Object} data - 測試資料
   */
  recordTestCase: (testCase, data) => {
    if (!testDatabase.testCaseHistory.has(testCase)) {
      testDatabase.testCaseHistory.set(testCase, []);
    }
    testDatabase.testCaseHistory.get(testCase).push({
      timestamp: new Date().toISOString(),
      data: data
    });
  },

  /**
   * 獲取測試案例歷史
   * @param {string} testCase - 測試案例名稱
   * @returns {Array} 測試歷史
   */
  getTestCaseHistory: (testCase) => {
    return testDatabase.testCaseHistory.get(testCase) || [];
  },

  /**
   * 清理測試案例歷史
   * @param {string} testCase - 測試案例名稱（可選）
   */
  clearTestCaseHistory: (testCase = null) => {
    if (testCase) {
      testDatabase.testCaseHistory.delete(testCase);
    } else {
      testDatabase.testCaseHistory.clear();
    }
  }
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
  
  /**
   * 動態創建測試科目
   * @param {string} userId - 用戶ID
   * @param {number} count - 科目數量
   * @returns {Array} 測試科目陣列
   */
  createDynamicTestSubjects: (userId, count = 10) => {
    const subjects = [];
    const categories = ['餐飲', '交通', '娛樂', '購物', '醫療'];
    
    for (let i = 0; i < count; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const subject = {
        id: `subject_${userId}_${i}`,
        name: `${category}${i + 1}`,
        code: `${4000 + i}001`,
        majorCode: `${4000 + i}`,
        category: category,
        userId: userId,
        createdAt: new Date(),
        active: true
      };
      subjects.push(subject);
    }
    
    // 儲存到快取
    testDatabase.dynamicSubjects.set(userId, subjects);
    return subjects;
  },

  /**
   * 獲取動態測試科目
   * @param {string} userId - 用戶ID
   * @returns {Array} 科目陣列
   */
  getDynamicTestSubjects: (userId) => {
    return testDatabase.dynamicSubjects.get(userId) || [];
  },

  /**
   * 生成測試統計報告
   * @returns {Object} 統計報告
   */
  generateTestStatistics: () => {
    const stats = {
      totalUsers: testDatabase.users.size,
      totalLedgers: testDatabase.ledgers.size,
      totalActivities: testDatabase.activities.size,
      dynamicSubjects: Array.from(testDatabase.dynamicSubjects.values()).flat().length,
      testCaseHistory: testDatabase.testCaseHistory.size,
      timestamp: new Date().toISOString()
    };
    
    return stats;
  },
  
  cleanupTestData: () => {
    testDatabase.ledgers.clear();
    testDatabase.activities.clear();
    testDatabase.users.clear();
    testDatabase.dynamicSubjects.clear();
    testDatabase.testCaseHistory.clear();
  }
};

// Firestore 測試支援工具
global.firestoreTestUtils = {
  /**
   * 模擬 Firestore 查詢結果
   * @param {Array} data - 模擬資料
   * @returns {Object} 模擬 Firestore 查詢結果
   */
  mockFirestoreQuery: (data) => ({
    docs: data.map(item => ({
      id: item.id || Math.random().toString(36),
      data: () => item
    })),
    forEach: (callback) => {
      data.forEach((item, index) => {
        callback({
          id: item.id || Math.random().toString(36),
          data: () => item
        });
      });
    },
    size: data.length,
    empty: data.length === 0
  }),

  /**
   * 生成模擬 Firestore 文檔
   * @param {string} id - 文檔ID
   * @param {Object} data - 文檔資料
   * @returns {Object} 模擬文檔
   */
  mockFirestoreDoc: (id, data) => ({
    id: id,
    data: () => data,
    exists: true,
    ref: {
      id: id,
      collection: () => ({
        doc: () => ({ id: Math.random().toString(36) })
      })
    }
  }),

  /**
   * 驗證 Firestore 連接狀態
   * @returns {boolean} 連接狀態
   */
  validateFirestoreConnection: () => {
    try {
      const admin = require('firebase-admin');
      return admin.apps.length > 0;
    } catch (error) {
      return false;
    }
  }
};

// 測試前準備
beforeAll(async () => {
  console.log('🔧 全域測試環境準備中...');
  
  // 建立測試用戶
  const testUsers = ['test_owner_1', 'test_owner_2', 'test_admin_1', 'test_admin_2', 
                     'test_member_1', 'test_member_2', 'test_viewer_1', 'test_viewer_2'];
  
  testUsers.forEach(userId => {
    testDatabase.users.set(userId, global.testUtils.createTestUser(userId));
  });
  
  // 初始化動態測試資料
  console.log('🎲 初始化動態測試資料生成器...');
  
  // 為主要測試用戶準備動態科目
  const mainTestUsers = ['test_lbk_user_001', 'test_lbk_user_002'];
  mainTestUsers.forEach(userId => {
    global.testUtils.createDynamicTestSubjects(userId, 15);
  });
  
  // 驗證 Firestore 連接
  const firestoreConnected = global.firestoreTestUtils.validateFirestoreConnection();
  console.log(`📊 Firestore 連接狀態: ${firestoreConnected ? '已連接' : '未連接'}`);
  
  console.log('✅ 全域測試環境準備完成');
  console.log('🎯 動態測試資料生成器已啟用');
  console.log('🔍 每次測試執行將使用不同的隨機測試資料');
});

// 測試後清理
afterAll(async () => {
  console.log('🧹 全域測試環境清理中...');
  
  // 生成測試統計報告
  const stats = global.testUtils.generateTestStatistics();
  console.log('📊 測試執行統計:');
  console.log(`   動態科目生成: ${stats.dynamicSubjects} 個`);
  console.log(`   測試案例記錄: ${stats.testCaseHistory} 個`);
  console.log(`   測試執行時間: ${stats.timestamp}`);
  
  // 清理測試資料
  global.testUtils.cleanupTestData();
  global.dynamicTestUtils.clearTestCaseHistory();
  
  console.log('✅ 全域測試環境清理完成');
  console.log('🎲 動態測試資料生成器已重置');
});

// 每個測試案例前的準備
beforeEach(() => {
  // 記錄測試開始時間
  global.testStartTime = Date.now();
});

// 每個測試案例後的清理
afterEach(() => {
  // 計算測試執行時間
  const testDuration = Date.now() - (global.testStartTime || 0);
  
  // 如果測試時間超過預期，記錄警告
  if (testDuration > 10000) { // 10秒
    console.warn(`⚠️  測試執行時間過長: ${testDuration}ms`);
  }
});
