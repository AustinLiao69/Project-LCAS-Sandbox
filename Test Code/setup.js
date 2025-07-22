
/**
 * 測試環境設定_1.3.0
 * @module 測試環境設定
 * @description 測試前的全域設定與準備 - 整合動態模組偵測，Markdown 報告支援，純靜態資料管理機制
 * @version 1.3.0
 * @update 2025-01-09: 新增動態測試模組偵測支援，整合智慧報告生成
 * @date 2025-01-09 20:00:00
 */

// 全域測試設定
global.console = {
  ...console,
  log: jest.fn(console.log),
  error: jest.fn(console.error),
  warn: jest.fn(console.warn),
  info: jest.fn(console.info)
};

// 純靜態測試資料庫
const testDatabase = {
  ledgers: new Map(),
  activities: new Map(),
  users: new Map(),
  staticSubjects: new Map(), // 靜態科目快取
  testCaseHistory: new Map()  // 測試案例歷史
};

// 基於 9999.json 的靜態測試工具
global.staticTestUtils = {
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
   * 從 9999.json 載入科目（靜態）
   * @returns {Array} 科目陣列
   */
  loadSubjectsFrom9999: () => {
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../Miscellaneous/9999. Subject_code.json');
      const subjectData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      
      return subjectData.map(item => ({
        name: item.子項名稱,
        code: item.子項代碼,
        majorCode: item.大項代碼,
        category: item.大項名稱,
        synonyms: item.同義詞 ? item.同義詞.split(',').map(s => s.trim()) : []
      }));
    } catch (error) {
      console.error(`❌ 載入 9999.json 失敗: ${error.message}`);
      return [];
    }
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
      data: data,
      dataSource: '9999.json'
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

// 動態測試模組偵測工具
global.dynamicTestModuleDetector = {
  /**
   * 偵測當前執行的測試模組
   * @returns {Object} 模組資訊
   */
  detectCurrentModule: () => {
    const args = process.argv;
    
    // 尋找測試檔案參數
    let testFile = '';
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // 檢查是否為測試檔案路徑
      if (arg.includes('TC_') || arg.includes('Test Code/')) {
        testFile = arg;
        break;
      }
    }
    
    // 解析模組資訊
    let moduleInfo = {
      code: '0000',
      name: 'UNKNOWN',
      type: 'TC-UNKNOWN',
      displayName: '未知模組',
      description: '未識別的測試模組'
    };
    
    if (testFile.includes('3005') || testFile.includes('TC_SR')) {
      moduleInfo = {
        code: '3005',
        name: 'SR',
        type: 'TC-SR',
        displayName: 'SR',
        description: '排程提醒模組'
      };
    } else if (testFile.includes('3115') || testFile.includes('TC_LBK')) {
      moduleInfo = {
        code: '3115',
        name: 'LBK',
        type: 'TC-LBK',
        displayName: 'LBK',
        description: '快速記帳模組'
      };
    } else if (testFile.includes('3151') || testFile.includes('TC_MLS')) {
      moduleInfo = {
        code: '3151',
        name: 'MLS',
        type: 'TC-MLS',
        displayName: 'MLS',
        description: '多帳本模組'
      };
    }
    
    return moduleInfo;
  },

  /**
   * 記錄模組偵測結果
   * @param {Object} moduleInfo - 模組資訊
   */
  logModuleDetection: (moduleInfo) => {
    console.log(`🎯 動態偵測測試模組: ${moduleInfo.displayName} (${moduleInfo.code})`);
    console.log(`📋 模組描述: ${moduleInfo.description}`);
    console.log(`🏷️  測試類型: ${moduleInfo.type}`);
  }
};

// Markdown 報告工具
global.markdownReportUtils = {
  /**
   * 生成測試案例 Markdown 報告片段
   * @param {string} testName - 測試案例名稱
   * @param {Object} result - 測試結果
   * @returns {string} Markdown 格式的報告片段
   */
  generateTestCaseMarkdown: (testName, result) => {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const status = result.passed ? '✅ 通過' : '❌ 失敗';
    
    return `### ${status} ${testName}
- **執行時間**: ${timestamp}
- **耗時**: ${result.duration || 0}ms
- **狀態**: ${result.passed ? 'PASSED' : 'FAILED'}
${result.error ? `- **錯誤**: \`${result.error}\`` : ''}

`;
  },

  /**
   * 記錄測試案例到 Markdown 歷史
   * @param {string} testCase - 測試案例名稱
   * @param {Object} data - 測試資料
   */
  recordTestCaseMarkdown: (testCase, data) => {
    const markdown = global.markdownReportUtils.generateTestCaseMarkdown(testCase, data);
    global.staticTestUtils.recordTestCase(`${testCase}_markdown`, {
      markdown: markdown,
      timestamp: new Date().toISOString(),
      format: 'markdown'
    });
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
   * 創建靜態測試科目（基於 9999.json）
   * @param {string} userId - 用戶ID
   * @param {number} count - 科目數量
   * @returns {Array} 測試科目陣列
   */
  createStaticTestSubjects: (userId, count = 10) => {
    const allSubjects = global.staticTestUtils.loadSubjectsFrom9999();
    
    if (allSubjects.length === 0) {
      console.warn('⚠️ 無法載入 9999.json，使用預設科目');
      return [];
    }
    
    // 隨機選取指定數量的科目
    const shuffled = allSubjects.sort(() => 0.5 - Math.random());
    const selectedSubjects = shuffled.slice(0, Math.min(count, allSubjects.length));
    
    // 儲存到快取
    testDatabase.staticSubjects.set(userId, selectedSubjects);
    return selectedSubjects;
  },

  /**
   * 獲取靜態測試科目
   * @param {string} userId - 用戶ID
   * @returns {Array} 科目陣列
   */
  getStaticTestSubjects: (userId) => {
    return testDatabase.staticSubjects.get(userId) || [];
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
      staticSubjects: Array.from(testDatabase.staticSubjects.values()).flat().length,
      testCaseHistory: testDatabase.testCaseHistory.size,
      dataSource: '9999.json',
      firestoreRemoved: true,
      markdownReportEnabled: true,
      reportFormats: ['markdown'],
      timestamp: new Date().toISOString()
    };
    
    return stats;
  },
  
  cleanupTestData: () => {
    testDatabase.ledgers.clear();
    testDatabase.activities.clear();
    testDatabase.users.clear();
    testDatabase.staticSubjects.clear();
    testDatabase.testCaseHistory.clear();
  }
};

// 9999.json 驗證工具
global.subject9999Utils = {
  /**
   * 驗證 9999.json 檔案存在
   * @returns {boolean} 檔案是否存在
   */
  validate9999JsonExists: () => {
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../Miscellaneous/9999. Subject_code.json');
      return fs.existsSync(jsonPath);
    } catch (error) {
      return false;
    }
  },

  /**
   * 驗證 9999.json 資料完整性
   * @returns {Object} 驗證結果
   */
  validate9999JsonIntegrity: () => {
    try {
      const subjects = global.staticTestUtils.loadSubjectsFrom9999();
      
      const validation = {
        fileExists: true,
        totalSubjects: subjects.length,
        categoriesCount: new Set(subjects.map(s => s.category)).size,
        subjectsWithSynonyms: subjects.filter(s => s.synonyms.length > 0).length,
        validationPassed: subjects.length === 63, // 預期63筆科目
        timestamp: new Date().toISOString()
      };
      
      return validation;
    } catch (error) {
      return {
        fileExists: false,
        error: error.message,
        validationPassed: false,
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * 獲取 9999.json 統計摘要
   * @returns {Object} 統計摘要
   */
  get9999JsonSummary: () => {
    const subjects = global.staticTestUtils.loadSubjectsFrom9999();
    const categories = new Map();
    
    subjects.forEach(subject => {
      if (!categories.has(subject.category)) {
        categories.set(subject.category, []);
      }
      categories.get(subject.category).push(subject);
    });
    
    return {
      totalSubjects: subjects.length,
      categories: Array.from(categories.keys()),
      categorySubjectCount: Object.fromEntries(
        Array.from(categories.entries()).map(([cat, subs]) => [cat, subs.length])
      ),
      dataSource: '9999.json',
      loadTime: new Date().toISOString()
    };
  }
};

// 測試前準備
beforeAll(async () => {
  console.log('🔧 全域測試環境準備中（動態模組偵測版本）...');
  
  // 動態偵測當前測試模組
  const moduleInfo = global.dynamicTestModuleDetector.detectCurrentModule();
  global.dynamicTestModuleDetector.logModuleDetection(moduleInfo);
  
  // 驗證 9999.json 檔案
  const fileExists = global.subject9999Utils.validate9999JsonExists();
  console.log(`📋 9999.json 檔案檢查: ${fileExists ? '存在' : '不存在'}`);
  
  if (fileExists) {
    const validation = global.subject9999Utils.validate9999JsonIntegrity();
    console.log(`📊 9999.json 驗證結果:`);
    console.log(`   總科目數: ${validation.totalSubjects}`);
    console.log(`   分類數量: ${validation.categoriesCount}`);
    console.log(`   有同義詞科目: ${validation.subjectsWithSynonyms}`);
    console.log(`   驗證通過: ${validation.validationPassed ? '是' : '否'}`);
  }
  
  // 建立測試用戶
  const testUsers = ['test_owner_1', 'test_owner_2', 'test_admin_1', 'test_admin_2', 
                     'test_member_1', 'test_member_2', 'test_viewer_1', 'test_viewer_2'];
  
  testUsers.forEach(userId => {
    testDatabase.users.set(userId, global.testUtils.createTestUser(userId));
  });
  
  // 初始化靜態測試資料
  console.log('🎲 初始化靜態測試資料生成器...');
  
  // 為主要測試用戶準備靜態科目
  const mainTestUsers = ['test_lbk_user_001', 'test_lbk_user_002'];
  mainTestUsers.forEach(userId => {
    global.testUtils.createStaticTestSubjects(userId, 15);
  });
  
  console.log('✅ 全域測試環境準備完成');
  console.log('🎯 動態模組偵測已啟用 (Jest 1.3.0)');
  console.log('🎲 靜態測試資料生成器已啟用（基於 9999.json）');
  console.log('🚫 Firestore 依賴已完全移除');
  console.log('📋 每次測試執行使用 9999.json 中的真實科目資料');
  console.log('📊 智慧 Markdown 報告生成器已啟用 (1.1.0)');
  console.log('📁 報告格式: 純 Markdown (.md)');
  console.log('🎯 報告檔名: 動態生成（根據執行的測試模組）');
});

// 測試後清理
afterAll(async () => {
  console.log('🧹 全域測試環境清理中...');
  
  // 生成測試統計報告
  const stats = global.testUtils.generateTestStatistics();
  console.log('📊 測試執行統計:');
  console.log(`   靜態科目使用: ${stats.staticSubjects} 個`);
  console.log(`   測試案例記錄: ${stats.testCaseHistory} 個`);
  console.log(`   資料來源: ${stats.dataSource}`);
  console.log(`   Firestore移除: ${stats.firestoreRemoved ? '是' : '否'}`);
  console.log(`   測試執行時間: ${stats.timestamp}`);
  
  // 獲取 9999.json 使用摘要
  const summary = global.subject9999Utils.get9999JsonSummary();
  console.log('📋 9999.json 使用摘要:');
  console.log(`   使用科目總數: ${summary.totalSubjects}`);
  console.log(`   使用分類: ${summary.categories.join(', ')}`);
  
  // 清理測試資料
  global.testUtils.cleanupTestData();
  global.staticTestUtils.clearTestCaseHistory();
  
  console.log('✅ 全域測試環境清理完成');
  console.log('🎲 靜態測試資料生成器已重置');
  console.log('📋 9999.json 資料源驗證完成');
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
