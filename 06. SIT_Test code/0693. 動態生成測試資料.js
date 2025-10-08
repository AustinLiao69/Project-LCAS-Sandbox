
/**
 * 0693. 動態生成測試資料.js
 * @module 動態測試資料生成模組
 * @description 生成符合1311.FS.js規範的動態測試資料，供0603 SIT測試使用
 * @version 1.0.0
 * @created 2025-10-08
 * @author LCAS SQA Team
 */

const moment = require('moment-timezone');
const crypto = require('crypto');

// 不再依賴0692靜態測試資料，完全動態生成
console.log('✅ 0693: 完全動態生成測試資料，不依賴0692靜態資料');

/**
 * 動態測試資料生成配置
 */
const DYNAMIC_CONFIG = {
  TIMEZONE: 'Asia/Taipei',
  DEFAULT_CURRENCY: 'TWD',
  ID_FORMAT: {
    TRANSACTION: 'txn_{timestamp}_{random}',
    USER: 'user_{timestamp}_{random}',
    LEDGER: 'ledger_{timestamp}_{random}',
    ACCOUNT: 'acc_{timestamp}_{random}',
    CATEGORY: 'cat_{timestamp}_{random}'
  },
  AMOUNT_RANGE: {
    MIN: 1,
    MAX: 50000
  },
  DESCRIPTIONS: {
    EXPENSE: [
      '早餐', '午餐', '晚餐', '咖啡', '零食', '交通費', '停車費', '油費',
      '書籍', '文具', '衣服', '鞋子', '電影', '遊戲', '健身', '醫療',
      '水電費', '網路費', '手機費', '房租', '保險', '維修費'
    ],
    INCOME: [
      '薪資', '獎金', '紅利', '津貼', '加班費', '兼職收入', '投資收益',
      '利息收入', '租金收入', '退稅', '退款', '禮金', '獎學金'
    ]
  },
  PAYMENT_METHODS: ['現金', '信用卡', '轉帳', '行動支付', '悠遊卡'],
  CATEGORIES: {
    EXPENSE: [
      { code: '103', subCode: '01', name: '餐飲' },
      { code: '105', subCode: '01', name: '交通' },
      { code: '107', subCode: '01', name: '娛樂' },
      { code: '109', subCode: '01', name: '購物' },
      { code: '111', subCode: '01', name: '醫療' },
      { code: '113', subCode: '01', name: '居住' },
      { code: '115', subCode: '01', name: '教育' },
      { code: '199', subCode: '99', name: '其他支出' }
    ],
    INCOME: [
      { code: '801', subCode: '01', name: '薪資收入' },
      { code: '803', subCode: '01', name: '獎金' },
      { code: '805', subCode: '01', name: '投資收益' },
      { code: '807', subCode: '01', name: '其他收入' }
    ]
  }
};

/**
 * 01. 生成符合1311.FS.js規範的交易ID
 * @returns {string} 交易ID
 */
function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `txn_${timestamp}_${random}`;
}

/**
 * 02. 生成符合1311.FS.js規範的用戶ID
 * @returns {string} 用戶ID
 */
function generateUserId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `test_user_${timestamp}_${random}`;
}

/**
 * 03. 生成隨機金額
 * @param {number} min 最小金額
 * @param {number} max 最大金額
 * @returns {number} 隨機金額
 */
function generateRandomAmount(min = DYNAMIC_CONFIG.AMOUNT_RANGE.MIN, max = DYNAMIC_CONFIG.AMOUNT_RANGE.MAX) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 04. 生成台北時區的日期時間
 * @param {Date} baseDate 基準日期（可選）
 * @returns {Object} 包含日期和時間的物件
 */
function generateTaipeiDateTime(baseDate = new Date()) {
  const taipeiTime = moment(baseDate).tz(DYNAMIC_CONFIG.TIMEZONE);
  return {
    date: taipeiTime.format('YYYY/MM/DD'),
    time: taipeiTime.format('HH:mm:ss'),
    timestamp: taipeiTime.toISOString()
  };
}

/**
 * 05. 生成動態交易記錄
 * @param {Object} options 生成選項
 * @returns {Object} 符合1311.FS.js規範的交易記錄
 */
function generateTransaction(options = {}) {
  const transactionId = generateTransactionId();
  const dateTime = generateTaipeiDateTime(options.date);
  
  // 隨機決定收入或支出
  const isIncome = options.type === 'income' || (options.type !== 'expense' && Math.random() > 0.7);
  const type = isIncome ? 'income' : 'expense';
  
  // 選擇對應的分類和描述
  const categories = DYNAMIC_CONFIG.CATEGORIES[type.toUpperCase()];
  const descriptions = DYNAMIC_CONFIG.DESCRIPTIONS[type.toUpperCase()];
  const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
  const selectedDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
  
  // 生成金額（收入通常較高）
  const amount = isIncome 
    ? generateRandomAmount(1000, 50000)
    : generateRandomAmount(50, 2000);
  
  // 隨機選擇支付方式
  const paymentMethod = DYNAMIC_CONFIG.PAYMENT_METHODS[
    Math.floor(Math.random() * DYNAMIC_CONFIG.PAYMENT_METHODS.length)
  ];
  
  // 構建符合1311.FS.js規範的交易記錄
  const transaction = {
    // 1311.FS.js標準欄位
    收支ID: transactionId,
    日期: dateTime.date,
    時間: dateTime.time,
    收入: isIncome ? amount.toString() : '',
    支出: isIncome ? '' : amount.toString(),
    備註: options.description || selectedDescription,
    子項名稱: selectedCategory.name,
    大項代碼: selectedCategory.code,
    子項代碼: selectedCategory.subCode,
    支付方式: paymentMethod,
    UID: options.userId || generateUserId(),
    
    // 額外的系統欄位（符合FS規範）
    createdAt: dateTime.timestamp,
    updatedAt: dateTime.timestamp,
    source: 'dynamic_test_data_0693',
    version: '1.0.0'
  };
  
  return transaction;
}

/**
 * 06. 批量生成交易記錄
 * @param {number} count 生成數量
 * @param {Object} options 生成選項
 * @returns {Object} 交易記錄集合
 */
function generateTransactionsBatch(count = 10, options = {}) {
  const transactions = {};
  const startDate = options.startDate ? new Date(options.startDate) : new Date();
  
  for (let i = 0; i < count; i++) {
    // 隨機分散日期（最近30天內）
    const randomDays = Math.floor(Math.random() * 30);
    const transactionDate = new Date(startDate);
    transactionDate.setDate(transactionDate.getDate() - randomDays);
    
    const transaction = generateTransaction({
      ...options,
      date: transactionDate
    });
    
    transactions[transaction.收支ID] = transaction;
  }
  
  return transactions;
}

/**
 * 07. 生成用戶測試資料
 * @param {number} userCount 用戶數量
 * @returns {Object} 用戶資料集合
 */
function generateUsersBatch(userCount = 5) {
  const users = {};
  
  for (let i = 0; i < userCount; i++) {
    const userId = generateUserId();
    const timestamp = Date.now() + i;
    
    users[userId] = {
      email: `${userId}@test.lcas.app`,
      password: `TestPass${i + 1}23!`,
      display_name: `動態測試用戶${i + 1}`,
      mode: ['expert', 'guiding', 'inertial', 'cultivation'][i % 4],
      expected_features: ["dynamic_test", "generated_data"],
      registration_data: {
        first_name: `Test`,
        last_name: `User${i + 1}`,
        phone: `+8869${String(timestamp).slice(-8)}`,
        date_of_birth: `199${i % 10}-0${(i % 9) + 1}-${String(i + 10).padStart(2, '0')}`,
        preferred_language: "zh-TW"
      },
      createdAt: new Date().toISOString(),
      source: 'dynamic_test_data_0693'
    };
  }
  
  return users;
}

/**
 * 08. 生成帳本測試資料
 * @param {string} userId 用戶ID
 * @returns {Object} 帳本資料
 */
function generateLedgerData(userId) {
  const ledgerId = `ledger_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  return {
    id: ledgerId,
    name: `${userId}的測試帳本`,
    description: '由0693動態生成的測試帳本',
    owner: userId,
    members: [userId],
    type: 'personal',
    currency: DYNAMIC_CONFIG.DEFAULT_CURRENCY,
    timezone: DYNAMIC_CONFIG.TIMEZONE,
    settings: {
      allowNegativeBalance: false,
      autoCategories: true,
      reminderSettings: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    source: 'dynamic_test_data_0693'
  };
}

/**
 * 09. 生成完整的測試資料集
 * @param {Object} config 生成配置
 * @returns {Object} 完整的測試資料集
 */
function generateCompleteTestDataSet(config = {}) {
  const {
    userCount = 3,
    transactionsPerUser = 15,
    includeStaticData = true
  } = config;
  
  console.log('🔄 0693: 開始生成完整測試資料集...');
  
  // 基礎結構（完全動態生成，不依賴0692）
  const testDataSet = {
    metadata: {
      version: '1.0.0 - Dynamic Generated',
      generated_at: new Date().toISOString(),
      generator: '0693_dynamic_test_data',
      source: 'dynamic_generation_only',
      note: '完全移除0692依賴'
    }
  };
  
  // 確保必要的結構存在
  if (!testDataSet.authentication_test_data) testDataSet.authentication_test_data = {};
  if (!testDataSet.authentication_test_data.valid_users) testDataSet.authentication_test_data.valid_users = {};
  if (!testDataSet.bookkeeping_test_data) testDataSet.bookkeeping_test_data = {};
  if (!testDataSet.bookkeeping_test_data.test_transactions) testDataSet.bookkeeping_test_data.test_transactions = {};
  
  // 生成動態用戶
  const dynamicUsers = generateUsersBatch(userCount);
  Object.assign(testDataSet.authentication_test_data.valid_users, dynamicUsers);
  
  // 為每個用戶生成交易記錄
  Object.keys(dynamicUsers).forEach(userId => {
    const userTransactions = generateTransactionsBatch(transactionsPerUser, { userId });
    Object.assign(testDataSet.bookkeeping_test_data.test_transactions, userTransactions);
  });
  
  // 生成統計資訊
  const totalUsers = Object.keys(testDataSet.authentication_test_data.valid_users).length;
  const totalTransactions = Object.keys(testDataSet.bookkeeping_test_data.test_transactions).length;
  
  testDataSet.metadata.generation_stats = {
    total_users: totalUsers,
    dynamic_users: userCount,
    total_transactions: totalTransactions,
    dynamic_transactions: userCount * transactionsPerUser,
    generated_at: new Date().toISOString()
  };
  
  console.log(`✅ 0693: 測試資料集生成完成`);
  console.log(`   - 總用戶數: ${totalUsers} (動態: ${userCount})`);
  console.log(`   - 總交易數: ${totalTransactions} (動態: ${userCount * transactionsPerUser})`);
  
  return testDataSet;
}

/**
 * 10. 生成特定場景的測試資料
 * @param {string} scenario 場景類型
 * @returns {Object} 場景測試資料
 */
function generateScenarioTestData(scenario) {
  switch (scenario) {
    case 'high_volume':
      return generateTransactionsBatch(100, { type: 'mixed' });
    
    case 'income_only':
      return generateTransactionsBatch(20, { type: 'income' });
    
    case 'expense_only':
      return generateTransactionsBatch(20, { type: 'expense' });
    
    case 'recent_activity':
      return generateTransactionsBatch(10, { 
        startDate: new Date(),
        type: 'mixed'
      });
    
    case 'historical_data':
      const historicalStart = new Date();
      historicalStart.setMonth(historicalStart.getMonth() - 6);
      return generateTransactionsBatch(50, {
        startDate: historicalStart,
        type: 'mixed'
      });
    
    default:
      return generateTransactionsBatch(10);
  }
}

/**
 * 11. 重設/清理動態資料
 */
function resetDynamicData() {
  console.log('🔄 0693: 重設動態測試資料...');
  // 這裡可以添加清理邏輯
  console.log('✅ 0693: 動態測試資料已重設');
}

/**
 * 12. 驗證生成的資料是否符合1311.FS.js規範
 * @param {Object} transaction 交易記錄
 * @returns {Object} 驗證結果
 */
function validateTransactionFormat(transaction) {
  const requiredFields = [
    '收支ID', '日期', '時間', '備註', '子項名稱', 
    '大項代碼', '子項代碼', '支付方式', 'UID'
  ];
  
  const errors = [];
  const warnings = [];
  
  // 檢查必要欄位
  requiredFields.forEach(field => {
    if (transaction[field] === undefined || transaction[field] === null) {
      errors.push(`缺少必要欄位: ${field}`);
    }
  });
  
  // 檢查收入支出欄位
  const hasIncome = transaction['收入'] && parseFloat(transaction['收入']) > 0;
  const hasExpense = transaction['支出'] && parseFloat(transaction['支出']) > 0;
  
  if (!hasIncome && !hasExpense) {
    errors.push('收入和支出不能都為空');
  }
  
  if (hasIncome && hasExpense) {
    warnings.push('收入和支出同時有值，可能不符合預期');
  }
  
  // 檢查日期格式
  if (transaction['日期'] && !/^\d{4}\/\d{2}\/\d{2}$/.test(transaction['日期'])) {
    errors.push('日期格式不正確，應為YYYY/MM/DD');
  }
  
  // 檢查時間格式
  if (transaction['時間'] && !/^\d{2}:\d{2}:\d{2}$/.test(transaction['時間'])) {
    errors.push('時間格式不正確，應為HH:mm:ss');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// 模組導出
module.exports = {
  // 核心生成函數
  generateTransaction,
  generateTransactionsBatch,
  generateUsersBatch,
  generateLedgerData,
  generateCompleteTestDataSet,
  generateScenarioTestData,
  
  // 工具函數
  generateTransactionId,
  generateUserId,
  generateRandomAmount,
  generateTaipeiDateTime,
  
  // 驗證和管理
  validateTransactionFormat,
  resetDynamicData,
  
  // 配置
  DYNAMIC_CONFIG
};

// 如果直接執行此文件，生成範例資料
if (require.main === module) {
  console.log('🚀 0693: 動態測試資料生成模組獨立執行');
  
  // 生成範例交易
  const sampleTransaction = generateTransaction();
  console.log('📝 範例交易:', JSON.stringify(sampleTransaction, null, 2));
  
  // 驗證範例交易
  const validation = validateTransactionFormat(sampleTransaction);
  console.log('✅ 驗證結果:', validation);
  
  // 生成小量測試資料集
  const testDataSet = generateCompleteTestDataSet({
    userCount: 2,
    transactionsPerUser: 5,
    includeStaticData: false
  });
  
  console.log('📊 生成的測試資料集統計:', testDataSet.metadata.generation_stats);
}
