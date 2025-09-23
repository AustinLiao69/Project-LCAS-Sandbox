
/**
 * BK_記帳處理模組_2.2.0
 * @module 記帳處理模組
 * @description LCAS 記帳處理模組 - 實現 BK 2.2 版本，重構為支援Phase 1的6個核心API端點
 * @update 2025-09-16: 階段一重構 - 專注於支援POST/GET /transactions等6個核心API端點
 * @update 2025-01-28: 移除所有hard coding，改為動態配置
 */

// 引入所需模組
const moment = require('moment-timezone');
const admin = require('firebase-admin');

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

// Helper function to get environment variables
function getEnvVar(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

// 確保 Firebase Admin 在模組載入時就初始化
if (!admin.apps.length) {
  try {
    firebaseConfig.initializeFirebaseAdmin();
    console.log('🔥 BK模組: Firebase Admin 自動初始化完成');
  } catch (error) {
    console.error('❌ BK模組: Firebase Admin 自動初始化失敗:', error);
  }
}

// 引入DL和FS模組
const DL = require('./1310. DL.js');
const FS = require('./1311. FS.js');

// 配置參數 - 從環境變數和配置文件動態讀取
const BK_CONFIG = {
  DEBUG: getEnvVar('BK_DEBUG', 'true') === 'true',
  LOG_LEVEL: getEnvVar('BK_LOG_LEVEL', 'DEBUG'),
  FIRESTORE_ENABLED: getEnvVar('FIRESTORE_ENABLED', 'true') === 'true',
  DEFAULT_LEDGER_ID: getEnvVar('DEFAULT_LEDGER_ID', 'ledger_structure_001'),
  TIMEZONE: getEnvVar('TIMEZONE', 'Asia/Taipei'),
  INITIALIZATION_INTERVAL: parseInt(getEnvVar('BK_INIT_INTERVAL', '300000'), 10),
  VERSION: getEnvVar('BK_VERSION', '2.2.0'),
  MAX_AMOUNT: parseInt(getEnvVar('BK_MAX_AMOUNT', '999999999'), 10),
  DEFAULT_CURRENCY: getEnvVar('DEFAULT_CURRENCY', 'NTD'),
  DEFAULT_PAYMENT_METHOD: getEnvVar('DEFAULT_PAYMENT_METHOD', '現金'),
  BATCH_SIZE: parseInt(getEnvVar('BK_BATCH_SIZE', '10'), 10),
  MAX_CONCURRENCY: parseInt(getEnvVar('BK_MAX_CONCURRENCY', '5'), 10),
  DESCRIPTION_MAX_LENGTH: parseInt(getEnvVar('BK_DESC_MAX_LENGTH', '200'), 10),
  API_ENDPOINTS: {
    POST_TRANSACTIONS: getEnvVar('API_POST_TRANSACTIONS', '/transactions'),
    GET_TRANSACTIONS: getEnvVar('API_GET_TRANSACTIONS', '/transactions'),
    PUT_TRANSACTIONS: getEnvVar('API_PUT_TRANSACTIONS', '/transactions/{id}'),
    DELETE_TRANSACTIONS: getEnvVar('API_DELETE_TRANSACTIONS', '/transactions/{id}'),
    POST_QUICK: getEnvVar('API_POST_QUICK', '/transactions/quick'),
    GET_DASHBOARD: getEnvVar('API_GET_DASHBOARD', '/transactions/dashboard')
  },
  SUPPORTED_PAYMENT_METHODS: (getEnvVar('SUPPORTED_PAYMENT_METHODS', '現金,刷卡,轉帳,行動支付')).split(','),
  INCOME_KEYWORDS: (getEnvVar('INCOME_KEYWORDS', '薪水,收入,獎金,紅利')).split(','),
  CURRENCY_UNITS: (getEnvVar('CURRENCY_UNITS', '元,塊,圓')).split(','),
  UNSUPPORTED_CURRENCIES: (getEnvVar('UNSUPPORTED_CURRENCIES', 'NT,USD,$')).split(',')
};

// 初始化狀態追蹤
let BK_INIT_STATUS = {
  lastInitTime: 0,
  initialized: false,
  DL_initialized: false,
  firestore_db: null,
  moduleVersion: BK_CONFIG.VERSION,
  subjectCache: new Map(),
  cacheExpiry: 0,
  cacheTimeout: parseInt(getEnvVar('BK_CACHE_TIMEOUT', '300000'), 10) // 5分鐘
};

/**
 * 01. 模組初始化與配置管理
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_initialize() {
  const currentTime = new Date().getTime();

  if (BK_INIT_STATUS.initialized && 
      (currentTime - BK_INIT_STATUS.lastInitTime) < BK_CONFIG.INITIALIZATION_INTERVAL) {
    return true;
  }

  try {
    let initMessages = [`BK模組v${BK_CONFIG.VERSION}初始化開始 [${new Date().toISOString()}]`];

    // 初始化DL模組
    if (!BK_INIT_STATUS.DL_initialized) {
      if (typeof DL.DL_initialize === 'function') {
        DL.DL_initialize();
        BK_INIT_STATUS.DL_initialized = true;
        initMessages.push("DL模組初始化: 成功");

        if (typeof DL.DL_setLogLevels === 'function') {
          DL.DL_setLogLevels('DEBUG', 'DEBUG');
          initMessages.push("DL日誌級別設置為DEBUG");
        }
      } else {
        BK_logWarning("DL模組未找到，將使用原生日誌系統", "系統初始化", "", "BK_initialize");
        initMessages.push("DL模組初始化: 失敗 (未找到DL模組)");
      }
    }

    // 初始化Firestore
    await BK_initializeFirebase();
    initMessages.push("Firebase初始化: 成功");

    // 驗證API端點支援
    initMessages.push(`支援API端點: ${Object.keys(BK_CONFIG.API_ENDPOINTS).length}個`);

    BK_logInfo(initMessages.join(" | "), "系統初始化", "", "BK_initialize");

    BK_INIT_STATUS.lastInitTime = currentTime;
    BK_INIT_STATUS.initialized = true;

    return true;
  } catch (error) {
    BK_logCritical("BK模組初始化錯誤: " + error.toString(), "系統初始化", "", "INIT_ERROR", error.toString(), "BK_initialize");
    return false;
  }
}

/**
 * 02. Firebase連接初始化
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 移除hard coding，使用動態配置
 */
async function BK_initializeFirebase() {
  try {
    if (BK_INIT_STATUS.firestore_db) return BK_INIT_STATUS.firestore_db;

    // 檢查 Firebase Admin 是否已初始化
    if (!admin.apps.length) {
      console.log('🔄 BK模組: Firebase Admin 尚未初始化，開始初始化...');
      firebaseConfig.initializeFirebaseAdmin();
      console.log('✅ BK模組: Firebase Admin 初始化完成');
    }

    // 取得 Firestore 實例
    const db = admin.firestore();

    // 測試連線
    const healthCheckCollection = getEnvVar('HEALTH_CHECK_COLLECTION', '_health_check');
    await db.collection(healthCheckCollection).doc('bk_init_test').set({
      timestamp: admin.firestore.Timestamp.now(),
      module: 'BK',
      version: BK_CONFIG.VERSION,
      status: 'initialized'
    });

    // 刪除測試文檔
    await db.collection(healthCheckCollection).doc('bk_init_test').delete();

    BK_INIT_STATUS.firestore_db = db;

    BK_logInfo(`Firebase連接初始化成功 v${BK_CONFIG.VERSION}`, "系統初始化", "", "BK_initializeFirebase");
    return db;
  } catch (error) {
    BK_logError('Firebase初始化失敗', "系統初始化", "", "FIREBASE_INIT_ERROR", error.toString(), "BK_initializeFirebase");
    throw error;
  }
}

/**
 * 03. 新增交易記錄 - 支援 POST /transactions
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_createTransaction(transactionData) {
  const processId = transactionData.processId || require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_createTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理新增交易請求`, "新增交易", transactionData.userId || "", "BK_createTransaction");

    // 驗證必要資料
    const validation = BK_validateTransactionData(transactionData);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
        errorType: validation.errorType || "VALIDATION_ERROR"
      };
    }

    // 生成交易ID
    const transactionId = await BK_generateTransactionId(processId);

    // 準備交易數據
    const preparedData = await BK_prepareTransactionData(transactionId, transactionData, processId);

    // 儲存到Firestore
    const result = await BK_saveTransactionToFirestore(preparedData, processId);

    if (!result.success) {
      return {
        success: false,
        error: "交易儲存失敗",
        errorType: "STORAGE_ERROR"
      };
    }

    BK_logInfo(`${logPrefix} 交易新增成功: ${transactionId}`, "新增交易", transactionData.userId || "", "BK_createTransaction");

    return {
      success: true,
      data: {
        transactionId: transactionId,
        amount: transactionData.amount,
        type: transactionData.type,
        category: transactionData.categoryId,
        date: preparedData.date,
        description: transactionData.description
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 新增交易失敗: ${error.toString()}`, "新增交易", transactionData.userId || "", "CREATE_ERROR", error.toString(), "BK_createTransaction");
    return {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR"
    };
  }
}

/**
 * 04. 快速記帳處理 - 支援 POST /transactions/quick
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_processQuickTransaction(quickData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processQuickTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理快速記帳: "${quickData.input}"`, "快速記帳", quickData.userId || "", "BK_processQuickTransaction");

    // 解析快速輸入
    const parsed = BK_parseQuickInput(quickData.input);
    if (!parsed.success) {
      return {
        success: false,
        error: "無法解析輸入內容",
        errorType: "PARSE_ERROR"
      };
    }

    // 轉換為標準交易格式
    const transactionData = {
      amount: parsed.amount,
      type: parsed.type,
      description: parsed.description,
      userId: quickData.userId,
      ledgerId: quickData.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      processId: processId
    };

    // 調用標準新增交易流程
    const result = await BK_createTransaction(transactionData);

    if (result.success) {
      // 生成快速記帳回應訊息
      const incomeText = getEnvVar('INCOME_TEXT', '收入');
      const expenseText = getEnvVar('EXPENSE_TEXT', '支出');
      const currencySymbol = getEnvVar('CURRENCY_SYMBOL', 'NT$');
      
      const confirmation = `✅ 已記錄${parsed.type === 'income' ? incomeText : expenseText} ${currencySymbol}${parsed.amount} - ${parsed.description}`;

      return {
        success: true,
        data: {
          ...result.data,
          parsed: parsed,
          confirmation: confirmation
        }
      };
    }

    return result;

  } catch (error) {
    BK_logError(`${logPrefix} 快速記帳失敗: ${error.toString()}`, "快速記帳", quickData.userId || "", "QUICK_ERROR", error.toString(), "BK_processQuickTransaction");
    return {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR"
    };
  }
}

/**
 * 05. 查詢交易列表 - 支援 GET /transactions
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_getTransactions(queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_getTransactions:`;

  try {
    BK_logInfo(`${logPrefix} 開始查詢交易列表`, "查詢交易", queryParams.userId || "", "BK_getTransactions");

    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 建立查詢
    const ledgerCollection = getEnvVar('LEDGER_COLLECTION', 'ledgers');
    const entriesCollection = getEnvVar('ENTRIES_COLLECTION', 'entries');
    
    let query = db.collection(ledgerCollection)
      .doc(queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID)
      .collection(entriesCollection);

    // 應用篩選條件
    if (queryParams.userId) {
      const uidField = getEnvVar('UID_FIELD', 'UID');
      query = query.where(uidField, '==', queryParams.userId);
    }

    if (queryParams.startDate && queryParams.endDate) {
      const dateField = getEnvVar('DATE_FIELD', '日期');
      query = query.where(dateField, '>=', queryParams.startDate)
                   .where(dateField, '<=', queryParams.endDate);
    }

    if (queryParams.type) {
      const incomeField = getEnvVar('INCOME_FIELD', '收入');
      const expenseField = getEnvVar('EXPENSE_FIELD', '支出');
      
      if (queryParams.type === 'income') {
        query = query.where(incomeField, '>', '');
      } else if (queryParams.type === 'expense') {
        query = query.where(expenseField, '>', '');
      }
    }

    // 排序和分頁
    const dateField = getEnvVar('DATE_FIELD', '日期');
    const timeField = getEnvVar('TIME_FIELD', '時間');
    query = query.orderBy(dateField, 'desc').orderBy(timeField, 'desc');

    if (queryParams.limit) {
      const maxLimit = parseInt(getEnvVar('MAX_QUERY_LIMIT', '1000'), 10);
      const limit = Math.min(parseInt(queryParams.limit), maxLimit);
      query = query.limit(limit);
    }

    const querySnapshot = await query.get();
    const transactions = [];

    const fieldNames = {
      id: getEnvVar('ID_FIELD', '收支ID'),
      income: getEnvVar('INCOME_FIELD', '收入'),
      expense: getEnvVar('EXPENSE_FIELD', '支出'),
      date: getEnvVar('DATE_FIELD', '日期'),
      time: getEnvVar('TIME_FIELD', '時間'),
      description: getEnvVar('DESCRIPTION_FIELD', '備註'),
      category: getEnvVar('CATEGORY_FIELD', '子項名稱'),
      paymentMethod: getEnvVar('PAYMENT_METHOD_FIELD', '支付方式'),
      uid: getEnvVar('UID_FIELD', 'UID')
    };

    querySnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: data[fieldNames.id],
        amount: parseFloat(data[fieldNames.income] || data[fieldNames.expense] || 0),
        type: data[fieldNames.income] ? 'income' : 'expense',
        date: data[fieldNames.date],
        time: data[fieldNames.time],
        description: data[fieldNames.description],
        category: data[fieldNames.category],
        paymentMethod: data[fieldNames.paymentMethod],
        userId: data[fieldNames.uid]
      });
    });

    BK_logInfo(`${logPrefix} 查詢完成，返回${transactions.length}筆交易`, "查詢交易", queryParams.userId || "", "BK_getTransactions");

    return {
      success: true,
      data: {
        transactions: transactions,
        total: transactions.length,
        page: queryParams.page || 1,
        limit: queryParams.limit || transactions.length
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 查詢交易失敗: ${error.toString()}`, "查詢交易", queryParams.userId || "", "QUERY_ERROR", error.toString(), "BK_getTransactions");
    return {
      success: false,
      error: error.toString(),
      errorType: "QUERY_ERROR"
    };
  }
}

/**
 * 06. 查詢儀表板數據 - 支援 GET /transactions/dashboard
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_getDashboardData(params = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_getDashboardData:`;

  try {
    BK_logInfo(`${logPrefix} 開始生成儀表板數據`, "儀表板查詢", params.userId || "", "BK_getDashboardData");

    // 取得今日和本月數據
    const today = moment().tz(BK_CONFIG.TIMEZONE).format(getEnvVar('DATE_FORMAT', 'YYYY/MM/DD'));
    const monthStart = moment().tz(BK_CONFIG.TIMEZONE).startOf('month').format(getEnvVar('DATE_FORMAT', 'YYYY/MM/DD'));
    const monthEnd = moment().tz(BK_CONFIG.TIMEZONE).endOf('month').format(getEnvVar('DATE_FORMAT', 'YYYY/MM/DD'));

    // 查詢今日交易
    const todayTransactions = await BK_getTransactions({
      userId: params.userId,
      ledgerId: params.ledgerId,
      startDate: today,
      endDate: today
    });

    // 查詢本月交易
    const monthTransactions = await BK_getTransactions({
      userId: params.userId,
      ledgerId: params.ledgerId,
      startDate: monthStart,
      endDate: monthEnd
    });

    // 計算統計數據
    const todayStats = BK_calculateTransactionStats(todayTransactions.data?.transactions || []);
    const monthStats = BK_calculateTransactionStats(monthTransactions.data?.transactions || []);

    // 取得最近交易
    const recentLimit = parseInt(getEnvVar('RECENT_TRANSACTIONS_LIMIT', '10'), 10);
    const recentTransactions = await BK_getTransactions({
      userId: params.userId,
      ledgerId: params.ledgerId,
      limit: recentLimit
    });

    const quickActionLabels = {
      addTransaction: getEnvVar('QUICK_ACTION_ADD', '快速記帳'),
      viewTransactions: getEnvVar('QUICK_ACTION_VIEW', '查看記錄')
    };

    const dashboardData = {
      summary: {
        todayIncome: todayStats.totalIncome,
        todayExpense: todayStats.totalExpense,
        monthIncome: monthStats.totalIncome,
        monthExpense: monthStats.totalExpense,
        balance: monthStats.totalIncome - monthStats.totalExpense
      },
      recentTransactions: recentTransactions.data?.transactions || [],
      quickActions: [
        { action: "addTransaction", label: quickActionLabels.addTransaction },
        { action: "viewTransactions", label: quickActionLabels.viewTransactions }
      ]
    };

    BK_logInfo(`${logPrefix} 儀表板數據生成完成`, "儀表板查詢", params.userId || "", "BK_getDashboardData");

    return {
      success: true,
      data: dashboardData
    };

  } catch (error) {
    BK_logError(`${logPrefix} 儀表板數據生成失敗: ${error.toString()}`, "儀表板查詢", params.userId || "", "DASHBOARD_ERROR", error.toString(), "BK_getDashboardData");
    return {
      success: false,
      error: error.toString(),
      errorType: "DASHBOARD_ERROR"
    };
  }
}

/**
 * 07. 更新交易記錄 - 支援 PUT /transactions/{id}
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_updateTransaction(transactionId, updateData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_updateTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始更新交易: ${transactionId}`, "更新交易", updateData.userId || "", "BK_updateTransaction");

    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 查找交易記錄
    const ledgerCollection = getEnvVar('LEDGER_COLLECTION', 'ledgers');
    const entriesCollection = getEnvVar('ENTRIES_COLLECTION', 'entries');
    const idField = getEnvVar('ID_FIELD', '收支ID');
    
    const ledgerId = updateData.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
    const querySnapshot = await db.collection(ledgerCollection)
      .doc(ledgerId)
      .collection(entriesCollection)
      .where(idField, '==', transactionId)
      .get();

    if (querySnapshot.empty) {
      return {
        success: false,
        error: "交易記錄不存在",
        errorType: "NOT_FOUND"
      };
    }

    const doc = querySnapshot.docs[0];
    const currentData = doc.data();

    // 準備更新數據
    const fieldNames = {
      description: getEnvVar('DESCRIPTION_FIELD', '備註'),
      paymentMethod: getEnvVar('PAYMENT_METHOD_FIELD', '支付方式'),
      majorCode: getEnvVar('MAJOR_CODE_FIELD', '大項代碼'),
      minorCode: getEnvVar('MINOR_CODE_FIELD', '子項代碼'),
      categoryName: getEnvVar('CATEGORY_FIELD', '子項名稱'),
      income: getEnvVar('INCOME_FIELD', '收入'),
      expense: getEnvVar('EXPENSE_FIELD', '支出')
    };

    const updatedData = {
      ...currentData,
      [fieldNames.description]: updateData.description || currentData[fieldNames.description],
      [fieldNames.paymentMethod]: updateData.paymentMethod || currentData[fieldNames.paymentMethod],
      [fieldNames.majorCode]: updateData.majorCode || currentData[fieldNames.majorCode],
      [fieldNames.minorCode]: updateData.minorCode || currentData[fieldNames.minorCode],
      [fieldNames.categoryName]: updateData.categoryName || currentData[fieldNames.categoryName]
    };

    // 更新金額
    if (updateData.amount !== undefined) {
      if (updateData.type === 'income') {
        updatedData[fieldNames.income] = updateData.amount.toString();
        updatedData[fieldNames.expense] = '';
      } else {
        updatedData[fieldNames.expense] = updateData.amount.toString();
        updatedData[fieldNames.income] = '';
      }
    }

    // 執行更新
    await doc.ref.update(updatedData);

    BK_logInfo(`${logPrefix} 交易更新成功: ${transactionId}`, "更新交易", updateData.userId || "", "BK_updateTransaction");

    return {
      success: true,
      data: {
        transactionId: transactionId,
        updated: true
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 交易更新失敗: ${error.toString()}`, "更新交易", updateData.userId || "", "UPDATE_ERROR", error.toString(), "BK_updateTransaction");
    return {
      success: false,
      error: error.toString(),
      errorType: "UPDATE_ERROR"
    };
  }
}

/**
 * 08. 刪除交易記錄 - 支援 DELETE /transactions/{id}
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_deleteTransaction(transactionId, params = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_deleteTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始刪除交易: ${transactionId}`, "刪除交易", params.userId || "", "BK_deleteTransaction");

    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 查找交易記錄
    const ledgerCollection = getEnvVar('LEDGER_COLLECTION', 'ledgers');
    const entriesCollection = getEnvVar('ENTRIES_COLLECTION', 'entries');
    const idField = getEnvVar('ID_FIELD', '收支ID');
    
    const ledgerId = params.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
    const querySnapshot = await db.collection(ledgerCollection)
      .doc(ledgerId)
      .collection(entriesCollection)
      .where(idField, '==', transactionId)
      .get();

    if (querySnapshot.empty) {
      return {
        success: false,
        error: "交易記錄不存在",
        errorType: "NOT_FOUND"
      };
    }

    const doc = querySnapshot.docs[0];

    // 執行刪除
    await doc.ref.delete();

    // 記錄刪除日誌
    const logCollection = getEnvVar('LOG_COLLECTION', 'log');
    await db.collection(ledgerCollection)
      .doc(ledgerId)
      .collection(logCollection)
      .add({
        時間: admin.firestore.Timestamp.now(),
        訊息: `交易記錄已刪除: ${transactionId}`,
        操作類型: getEnvVar('DELETE_OPERATION_TYPE', '刪除交易'),
        UID: params.userId || '',
        來源: 'BK',
        嚴重等級: getEnvVar('LOG_LEVEL_INFO', 'INFO')
      });

    BK_logInfo(`${logPrefix} 交易刪除成功: ${transactionId}`, "刪除交易", params.userId || "", "BK_deleteTransaction");

    return {
      success: true,
      data: {
        transactionId: transactionId,
        deleted: true
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 交易刪除失敗: ${error.toString()}`, "刪除交易", params.userId || "", "DELETE_ERROR", error.toString(), "BK_deleteTransaction");
    return {
      success: false,
      error: error.toString(),
      errorType: "DELETE_ERROR"
    };
  }
}

// === 階段二：API端點輔助與驗證函數 ===

/**
 * 09. 記帳數據驗證 - 支援所有交易相關端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
function BK_validateTransactionData(data) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_validateTransactionData:`;

  try {
    // 必要欄位驗證
    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
      return { 
        success: false, 
        error: getEnvVar('ERROR_INVALID_AMOUNT', '金額必須是大於0的數字'),
        errorType: "AMOUNT_INVALID"
      };
    }

    const validTypes = (getEnvVar('VALID_TRANSACTION_TYPES', 'income,expense')).split(',');
    if (!data.type || !validTypes.includes(data.type)) {
      return { 
        success: false, 
        error: `交易類型必須是${validTypes.join('或')}`,
        errorType: "TYPE_INVALID"
      };
    }

    // 金額範圍驗證
    if (data.amount > BK_CONFIG.MAX_AMOUNT) {
      return {
        success: false,
        error: `金額不能超過${BK_CONFIG.MAX_AMOUNT.toLocaleString()}`,
        errorType: "AMOUNT_TOO_LARGE"
      };
    }

    // 描述長度驗證
    if (data.description && data.description.length > BK_CONFIG.DESCRIPTION_MAX_LENGTH) {
      return {
        success: false,
        error: `備註不能超過${BK_CONFIG.DESCRIPTION_MAX_LENGTH}個字元`,
        errorType: "DESCRIPTION_TOO_LONG"
      };
    }

    // 支付方式驗證
    if (data.paymentMethod && !BK_validatePaymentMethod(data.paymentMethod).success) {
      return {
        success: false,
        error: "無效的支付方式",
        errorType: "PAYMENT_METHOD_INVALID"
      };
    }

    // 用戶ID驗證
    const userIdPattern = getEnvVar('USER_ID_PATTERN', '^U[a-fA-F0-9]{32}$');
    if (data.userId && !new RegExp(userIdPattern).test(data.userId)) {
      return {
        success: false,
        error: "無效的用戶ID格式",
        errorType: "USER_ID_INVALID"
      };
    }

    BK_logInfo(`${logPrefix} 數據驗證通過`, "數據驗證", data.userId || "", "BK_validateTransactionData");

    return { 
      success: true,
      validatedData: {
        amount: parseFloat(data.amount.toFixed(2)),
        type: data.type,
        description: data.description || "",
        paymentMethod: data.paymentMethod || BK_CONFIG.DEFAULT_PAYMENT_METHOD,
        userId: data.userId || "",
        ledgerId: data.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 驗證過程失敗: ${error.toString()}`, "數據驗證", data.userId || "", "VALIDATION_ERROR", error.toString(), "BK_validateTransactionData");
    return {
      success: false,
      error: "數據驗證過程發生錯誤",
      errorType: "VALIDATION_PROCESS_ERROR"
    };
  }
}

/**
 * 10. 生成唯一交易ID - 支援POST相關端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
async function BK_generateTransactionId(processId) {
  const logPrefix = `[${processId}] BK_generateTransactionId:`;

  try {
    const now = moment().tz(BK_CONFIG.TIMEZONE);
    const dateFormat = getEnvVar('ID_DATE_FORMAT', 'YYYYMMDD');
    const timeFormat = getEnvVar('ID_TIME_FORMAT', 'HHmmss');
    const millisFormat = getEnvVar('ID_MILLIS_FORMAT', 'SSS');
    
    const dateStr = now.format(dateFormat);
    const timeStr = now.format(timeFormat);
    const millisStr = now.format(millisFormat);

    // 生成隨機後綴
    const randomLength = parseInt(getEnvVar('ID_RANDOM_LENGTH', '4'), 10);
    const randomSuffix = Math.random().toString(36).substring(2, 2 + randomLength).toUpperCase();

    // 組合交易ID
    const idSeparator = getEnvVar('ID_SEPARATOR', '-');
    const transactionId = `${dateStr}${idSeparator}${timeStr}${millisStr}${idSeparator}${randomSuffix}`;

    // 檢查ID唯一性
    const uniqueCheck = await BK_checkTransactionIdUnique(transactionId);
    if (!uniqueCheck.success) {
      // 如果重複，重新生成
      const fallbackId = `${dateStr}${idSeparator}${Date.now().toString().slice(-8)}${idSeparator}${randomSuffix}`;
      BK_logWarning(`${logPrefix} 交易ID重複，使用備用ID: ${fallbackId}`, "ID生成", "", "BK_generateTransactionId");
      return fallbackId;
    }

    BK_logInfo(`${logPrefix} 交易ID生成成功: ${transactionId}`, "ID生成", "", "BK_generateTransactionId");
    return transactionId;

  } catch (error) {
    BK_logError(`${logPrefix} 交易ID生成失敗: ${error.toString()}`, "ID生成", "", "ID_GENERATION_ERROR", error.toString(), "BK_generateTransactionId");

    // 降級方案：使用時間戳
    const dateFormat = getEnvVar('ID_DATE_FORMAT', 'YYYYMMDD');
    const idSeparator = getEnvVar('ID_SEPARATOR', '-');
    const fallbackId = `${moment().tz(BK_CONFIG.TIMEZONE).format(dateFormat)}${idSeparator}${Date.now()}`;
    return fallbackId;
  }
}

/**
 * 11. 支付方式驗證 - 支援所有交易端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
function BK_validatePaymentMethod(paymentMethod) {
  if (!paymentMethod || typeof paymentMethod !== 'string') {
    return {
      success: false,
      error: getEnvVar('ERROR_PAYMENT_METHOD_EMPTY', '支付方式不能為空'),
      validMethods: BK_CONFIG.SUPPORTED_PAYMENT_METHODS
    };
  }

  const trimmedMethod = paymentMethod.trim();

  if (!BK_CONFIG.SUPPORTED_PAYMENT_METHODS.includes(trimmedMethod)) {
    return {
      success: false,
      error: `不支援的支付方式: ${trimmedMethod}`,
      validMethods: BK_CONFIG.SUPPORTED_PAYMENT_METHODS
    };
  }

  return {
    success: true,
    paymentMethod: trimmedMethod
  };
}

/**
 * 12. 統計數據生成 - 支援GET /transactions/dashboard
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
function BK_generateStatistics(transactions, period = 'month') {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_generateStatistics:`;

  try {
    if (!Array.isArray(transactions)) {
      transactions = [];
    }

    const defaultCategory = getEnvVar('DEFAULT_CATEGORY', '其他');
    const defaultPaymentMethod = BK_CONFIG.DEFAULT_PAYMENT_METHOD;

    const stats = {
      totalIncome: 0,
      totalExpense: 0,
      transactionCount: transactions.length,
      averageTransaction: 0,
      categories: {},
      paymentMethods: {},
      dailyTrends: {},
      period: period
    };

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      const category = transaction.category || defaultCategory;
      const paymentMethod = transaction.paymentMethod || defaultPaymentMethod;
      const date = transaction.date || '';

      // 計算收入支出
      if (transaction.type === 'income') {
        stats.totalIncome += amount;
      } else {
        stats.totalExpense += amount;
      }

      // 分類統計
      if (!stats.categories[category]) {
        stats.categories[category] = { income: 0, expense: 0, count: 0 };
      }
      stats.categories[category][transaction.type] += amount;
      stats.categories[category].count += 1;

      // 支付方式統計
      if (!stats.paymentMethods[paymentMethod]) {
        stats.paymentMethods[paymentMethod] = { amount: 0, count: 0 };
      }
      stats.paymentMethods[paymentMethod].amount += amount;
      stats.paymentMethods[paymentMethod].count += 1;

      // 每日趨勢
      if (date) {
        if (!stats.dailyTrends[date]) {
          stats.dailyTrends[date] = { income: 0, expense: 0 };
        }
        stats.dailyTrends[date][transaction.type] += amount;
      }
    });

    // 計算平均值
    stats.averageTransaction = stats.transactionCount > 0 
      ? ((stats.totalIncome + stats.totalExpense) / stats.transactionCount) 
      : 0;

    // 計算淨收入
    stats.netIncome = stats.totalIncome - stats.totalExpense;

    // 計算儲蓄率
    stats.savingsRate = stats.totalIncome > 0 
      ? ((stats.netIncome / stats.totalIncome) * 100) 
      : 0;

    BK_logInfo(`${logPrefix} 統計數據生成完成，處理${stats.transactionCount}筆交易`, "統計生成", "", "BK_generateStatistics");

    return {
      success: true,
      data: stats
    };

  } catch (error) {
    BK_logError(`${logPrefix} 統計生成失敗: ${error.toString()}`, "統計生成", "", "STATS_ERROR", error.toString(), "BK_generateStatistics");
    return {
      success: false,
      error: error.toString(),
      errorType: "STATISTICS_ERROR"
    };
  }
}

/**
 * 13. 交易查詢過濾 - 支援GET /transactions
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
function BK_buildTransactionQuery(queryParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_buildTransactionQuery:`;

  try {
    const ledgerCollection = getEnvVar('LEDGER_COLLECTION', 'ledgers');
    const entriesCollection = getEnvVar('ENTRIES_COLLECTION', 'entries');
    
    let query = BK_INIT_STATUS.firestore_db
      .collection(ledgerCollection)
      .doc(queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID)
      .collection(entriesCollection);

    const appliedFilters = [];

    // 用戶過濾
    if (queryParams.userId) {
      const uidField = getEnvVar('UID_FIELD', 'UID');
      query = query.where(uidField, '==', queryParams.userId);
      appliedFilters.push(`userId: ${queryParams.userId}`);
    }

    // 日期範圍過濾
    const dateField = getEnvVar('DATE_FIELD', '日期');
    if (queryParams.startDate) {
      query = query.where(dateField, '>=', queryParams.startDate);
      appliedFilters.push(`startDate: ${queryParams.startDate}`);
    }

    if (queryParams.endDate) {
      query = query.where(dateField, '<=', queryParams.endDate);
      appliedFilters.push(`endDate: ${queryParams.endDate}`);
    }

    // 交易類型過濾
    if (queryParams.type) {
      const incomeField = getEnvVar('INCOME_FIELD', '收入');
      const expenseField = getEnvVar('EXPENSE_FIELD', '支出');
      
      if (queryParams.type === 'income') {
        query = query.where(incomeField, '>', 0);
      } else if (queryParams.type === 'expense') {
        query = query.where(expenseField, '>', 0);
      }
      appliedFilters.push(`type: ${queryParams.type}`);
    }

    // 金額範圍過濾
    if (queryParams.minAmount || queryParams.maxAmount) {
      appliedFilters.push(`amount range: ${queryParams.minAmount || '0'} - ${queryParams.maxAmount || '∞'}`);
    }

    // 支付方式過濾
    if (queryParams.paymentMethod) {
      const paymentMethodField = getEnvVar('PAYMENT_METHOD_FIELD', '支付方式');
      query = query.where(paymentMethodField, '==', queryParams.paymentMethod);
      appliedFilters.push(`paymentMethod: ${queryParams.paymentMethod}`);
    }

    // 排序
    const orderField = queryParams.orderBy || dateField;
    const orderDirection = queryParams.orderDirection || 'desc';
    const timeField = getEnvVar('TIME_FIELD', '時間');

    if (!orderField) {
        query = query.orderBy(dateField, 'desc');
    } else {
        query = query.orderBy(orderField, orderDirection);
        if (orderField !== timeField) {
            query = query.orderBy(timeField, orderDirection);
        }
    }

    // 分頁限制
    if (queryParams.limit) {
      const maxLimit = parseInt(getEnvVar('MAX_QUERY_LIMIT', '1000'), 10);
      const limit = Math.min(parseInt(queryParams.limit), maxLimit);
      query = query.limit(limit);
      appliedFilters.push(`limit: ${limit}`);
    }

    BK_logInfo(`${logPrefix} 查詢條件建立完成: [${appliedFilters.join(', ')}]`, "查詢過濾", queryParams.userId || "", "BK_buildTransactionQuery");

    return {
      success: true,
      query: query,
      appliedFilters: appliedFilters,
      postProcessFilters: {
        minAmount: queryParams.minAmount,
        maxAmount: queryParams.maxAmount,
        categoryId: queryParams.categoryId,
        search: queryParams.search
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 查詢建立失敗: ${error.toString()}`, "查詢過濾", queryParams.userId || "", "QUERY_BUILD_ERROR", error.toString(), "BK_buildTransactionQuery");
    return {
      success: false,
      error: error.toString(),
      errorType: "QUERY_BUILD_ERROR"
    };
  }
}

/**
 * 14. 錯誤處理機制 - 支援所有端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28 
 * @update: 移除hard coding，使用動態配置
 */
function BK_handleError(error, context = {}) {
  const processId = context.processId || require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_handleError:`;

  try {
    // 從環境變數讀取錯誤類型配置
    const errorTypes = {};
    const errorTypeKeys = (getEnvVar('ERROR_TYPES', 'VALIDATION_ERROR,NOT_FOUND,STORAGE_ERROR,FIREBASE_ERROR,AUTHENTICATION_ERROR,AUTHORIZATION_ERROR,RATE_LIMIT_ERROR,PROCESS_ERROR,UNKNOWN_ERROR')).split(',');
    
    errorTypeKeys.forEach(key => {
      const severity = getEnvVar(`ERROR_${key}_SEVERITY`, 'ERROR');
      const httpCode = parseInt(getEnvVar(`ERROR_${key}_HTTP_CODE`, '500'), 10);
      errorTypes[key] = { severity, httpCode };
    });

    const errorInfo = errorTypes[error.errorType] || errorTypes['UNKNOWN_ERROR'] || { severity: 'ERROR', httpCode: 500 };

    // 構建標準化錯誤響應
    const errorResponse = {
      success: false,
      error: error.message || error.toString(),
      errorType: error.errorType || 'UNKNOWN_ERROR',
      httpCode: errorInfo.httpCode,
      timestamp: new Date().toISOString(),
      processId: processId
    };

    // 添加上下文資訊
    if (context.userId) errorResponse.userId = context.userId;
    if (context.operation) errorResponse.operation = context.operation;
    if (context.requestId) errorResponse.requestId = context.requestId;

    // 記錄錯誤日誌
    const logFunction = errorInfo.severity === 'ERROR' ? BK_logError : 
                       errorInfo.severity === 'WARNING' ? BK_logWarning : BK_logInfo;

    logFunction(
      `${logPrefix} ${errorResponse.error}`,
      context.operation || "錯誤處理",
      context.userId || "",
      error.errorType || "UNKNOWN_ERROR",
      error.stack || error.toString(),
      "BK_handleError"
    );

    // 敏感資訊過濾
    const environment = getEnvVar('NODE_ENV', 'development');
    if (environment === 'production') {
      delete errorResponse.stack;
      if (errorInfo.severity === 'ERROR') {
        errorResponse.error = getEnvVar('GENERIC_ERROR_MESSAGE', '系統發生錯誤，請稍後再試');
      }
    }

    return errorResponse;

  } catch (handlingError) {
    // 錯誤處理本身發生錯誤
    BK_logCritical(`${logPrefix} 錯誤處理失敗: ${handlingError.toString()}`, "錯誤處理", context.userId || "", "ERROR_HANDLING_FAILED", handlingError.toString(), "BK_handleError");

    return {
      success: false,
      error: getEnvVar('ERROR_HANDLING_FAILED_MESSAGE', '系統錯誤處理失敗'),
      errorType: "ERROR_HANDLING_FAILED",
      httpCode: 500,
      timestamp: new Date().toISOString(),
      processId: processId
    };
  }
}

// === 其他輔助函數 ===

/**
 * 快速記帳輸入解析
 */
function BK_parseQuickInput(inputText, options = {}) {
  try {
    if (!inputText || typeof inputText !== 'string') {
      return {
        success: false,
        error: "輸入文字不能為空",
        errorType: "INVALID_INPUT"
      };
    }

    const trimmedInput = inputText.trim();

    // 標準格式解析：午餐150、薪水35000轉帳
    const standardPattern = /^(.+?)(\d+)(.*)$/;
    const match = trimmedInput.match(standardPattern);

    if (match) {
      const subject = match[1].trim();
      const amount = parseInt(match[2], 10);
      const remaining = match[3].trim();

      // 判斷收支類型
      const isIncome = BK_CONFIG.INCOME_KEYWORDS.some(keyword => subject.includes(keyword));

      // 判斷支付方式
      let paymentMethod = BK_CONFIG.DEFAULT_PAYMENT_METHOD;
      for (const method of BK_CONFIG.SUPPORTED_PAYMENT_METHODS) {
        if (remaining.includes(method)) {
          paymentMethod = method;
          break;
        }
      }

      return {
        success: true,
        amount: amount,
        type: isIncome ? 'income' : 'expense',
        description: subject,
        paymentMethod: paymentMethod,
        confidence: 0.9,
        strategy: 'standard_format'
      };
    }

    return {
      success: false,
      error: "無法解析輸入內容",
      errorType: "PARSE_FAILED"
    };

  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      errorType: "PARSE_ERROR"
    };
  }
}

/**
 * 記帳處理核心函數
 */
async function BK_processBookkeeping(inputData, options = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processBookkeeping:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理記帳請求`, "記帳處理", inputData.userId || "", "BK_processBookkeeping");

    if (!inputData || typeof inputData !== 'object') {
      return {
        success: false,
        error: "無效的輸入數據",
        errorType: "INVALID_INPUT"
      };
    }

    // 標準化處理：將輸入轉換為BK_createTransaction格式
    const transactionData = {
      amount: inputData.amount || 0,
      type: inputData.type || 'expense',
      description: inputData.description || inputData.subject || '',
      userId: inputData.userId || '',
      ledgerId: inputData.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      paymentMethod: inputData.paymentMethod || BK_CONFIG.DEFAULT_PAYMENT_METHOD,
      processId: processId
    };

    // 調用新的交易創建函數
    const result = await BK_createTransaction(transactionData);

    if (result.success) {
      BK_logInfo(`${logPrefix} 記帳處理成功: ${result.data.transactionId}`, "記帳處理", inputData.userId || "", "BK_processBookkeeping");

      const successMessage = getEnvVar('BOOKKEEPING_SUCCESS_MESSAGE', '記帳成功！金額：{amount}元，科目：{description}');
      const responseMessage = successMessage
        .replace('{amount}', transactionData.amount)
        .replace('{description}', transactionData.description);

      return {
        success: true,
        data: result.data,
        responseMessage: responseMessage,
        moduleCode: 'BK',
        processId: processId
      };
    } else {
      return {
        success: false,
        error: result.error,
        errorType: result.errorType || "PROCESS_ERROR",
        processId: processId
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 記帳處理失敗: ${error.toString()}`, "記帳處理", inputData.userId || "", "PROCESS_ERROR", error.toString(), "BK_processBookkeeping");
    return {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR",
      processId: processId
    };
  }
}

/**
 * 檢查交易ID唯一性
 */
async function BK_checkTransactionIdUnique(transactionId) {
  try {
    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    const ledgerCollection = getEnvVar('LEDGER_COLLECTION', 'ledgers');
    const entriesCollection = getEnvVar('ENTRIES_COLLECTION', 'entries');
    const idField = getEnvVar('ID_FIELD', '收支ID');

    const querySnapshot = await db.collection(ledgerCollection)
      .doc(BK_CONFIG.DEFAULT_LEDGER_ID)
      .collection(entriesCollection)
      .where(idField, '==', transactionId)
      .limit(1)
      .get();

    return {
      success: querySnapshot.empty,
      exists: !querySnapshot.empty
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 準備交易數據
 */
async function BK_prepareTransactionData(transactionId, transactionData, processId) {
  const now = moment().tz(BK_CONFIG.TIMEZONE);
  
  const dateFormat = getEnvVar('DATE_FORMAT', 'YYYY/MM/DD');
  const timeFormat = getEnvVar('TIME_FORMAT', 'HH:mm:ss');

  const fieldNames = {
    id: getEnvVar('ID_FIELD', '收支ID'),
    uid: getEnvVar('UID_FIELD', 'UID'),
    date: getEnvVar('DATE_FIELD', '日期'),
    time: getEnvVar('TIME_FIELD', '時間'),
    income: getEnvVar('INCOME_FIELD', '收入'),
    expense: getEnvVar('EXPENSE_FIELD', '支出'),
    description: getEnvVar('DESCRIPTION_FIELD', '備註'),
    paymentMethod: getEnvVar('PAYMENT_METHOD_FIELD', '支付方式'),
    majorCode: getEnvVar('MAJOR_CODE_FIELD', '大項代碼'),
    minorCode: getEnvVar('MINOR_CODE_FIELD', '子項代碼'),
    categoryName: getEnvVar('CATEGORY_FIELD', '子項名稱')
  };

  const defaultMajorCode = getEnvVar('DEFAULT_MAJOR_CODE', '01');
  const defaultMinorCode = getEnvVar('DEFAULT_MINOR_CODE', '01');
  const defaultCategoryName = getEnvVar('DEFAULT_CATEGORY', '其他');

  const preparedData = {
    [fieldNames.id]: transactionId,
    [fieldNames.uid]: transactionData.userId || '',
    [fieldNames.date]: now.format(dateFormat),
    [fieldNames.time]: now.format(timeFormat),
    [fieldNames.income]: transactionData.type === 'income' ? transactionData.amount.toString() : '',
    [fieldNames.expense]: transactionData.type === 'expense' ? transactionData.amount.toString() : '',
    [fieldNames.description]: transactionData.description || '',
    [fieldNames.paymentMethod]: transactionData.paymentMethod || BK_CONFIG.DEFAULT_PAYMENT_METHOD,
    [fieldNames.majorCode]: transactionData.majorCode || defaultMajorCode,
    [fieldNames.minorCode]: transactionData.minorCode || defaultMinorCode,
    [fieldNames.categoryName]: transactionData.categoryName || defaultCategoryName,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    processId: processId
  };

  return preparedData;
}

/**
 * 儲存交易到Firestore
 */
async function BK_saveTransactionToFirestore(transactionData, processId) {
  try {
    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    const ledgerCollection = getEnvVar('LEDGER_COLLECTION', 'ledgers');
    const entriesCollection = getEnvVar('ENTRIES_COLLECTION', 'entries');
    const ledgerId = BK_CONFIG.DEFAULT_LEDGER_ID;
    
    await db.collection(ledgerCollection)
      .doc(ledgerId)
      .collection(entriesCollection)
      .add(transactionData);

    return { success: true };
  } catch (error) {
    const uidField = getEnvVar('UID_FIELD', 'UID');
    BK_logError(`儲存交易失敗: ${error.toString()}`, "儲存交易", transactionData[uidField] || "", "SAVE_TRANSACTION_ERROR", error.toString(), "BK_saveTransactionToFirestore");
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}

/**
 * 計算交易統計
 */
function BK_calculateTransactionStats(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(transaction => {
    const amount = parseFloat(transaction.amount) || 0;
    if (transaction.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }
  });

  return {
    totalIncome,
    totalExpense,
    netIncome: totalIncome - totalExpense,
    transactionCount: transactions.length
  };
}

// === 日誌函數 ===

function BK_logInfo(message, category, userId, functionName) {
    if (DL && typeof DL.DL_info === 'function') {
        try {
            DL.DL_info(message, category || getEnvVar('DEFAULT_LOG_CATEGORY', '系統操作'), userId || '', '', '', functionName || 'BK_logInfo');
        } catch (error) {
            console.log(`[BK INFO] ${message} [DL_log錯誤: ${error.message}]`);
        }
    } else {
        console.log(`[BK INFO] ${message}`);
    }
}

function BK_logWarning(message, category, userId, functionName) {
    if (DL && typeof DL.DL_warning === 'function') {
        try {
            DL.DL_warning(message, category || getEnvVar('DEFAULT_WARNING_CATEGORY', '系統警告'), userId || '', '', '', functionName || 'BK_logWarning');
        } catch (error) {
            console.log(`[BK WARNING] ${message} [DL_log錯誤: ${error.message}]`);
        }
    } else {
        console.log(`[BK WARNING] ${message}`);
    }
}

function BK_logError(message, category, userId, errorType, errorDetail, functionName) {
    if (DL && typeof DL.DL_error === 'function') {
        try {
            DL.DL_error(message, category || getEnvVar('DEFAULT_ERROR_CATEGORY', '系統錯誤'), userId || '', errorType || 'UNKNOWN_ERROR', errorDetail || '', functionName || 'BK_logError');
        } catch (error) {
            console.error(`[BK ERROR] ${message} [DL_log錯誤: ${error.message}]`);
        }
    } else {
        console.error(`[BK ERROR] ${message}`);
    }
}

function BK_logCritical(message, category, userId, errorType, errorDetail, functionName) {
    if (DL && typeof DL.DL_critical === 'function') {
        DL.DL_critical(message, category, userId, errorType, errorDetail, functionName);
    } else {
        console.error(`[BK CRITICAL] ${message}`);
    }
}

// === API端點處理函數 ===

/**
 * BK_processAPIQuickTransaction - 處理快速記帳API端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 新增API端點處理函數，支援POST /transactions/quick
 */
async function BK_processAPIQuickTransaction(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIQuickTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理快速記帳API請求`, "API端點", requestData.userId || "", "BK_processAPIQuickTransaction");

    // 初始化模組
    await BK_initialize();

    // 呼叫快速記帳處理函數
    const result = await BK_processQuickTransaction({
      input: requestData.input,
      userId: requestData.userId,
      ledgerId: requestData.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      context: requestData.context || {},
      processId: processId
    });

    if (result.success) {
      BK_logInfo(`${logPrefix} 快速記帳API處理成功`, "API端點", requestData.userId || "", "BK_processAPIQuickTransaction");
      
      return {
        success: true,
        data: {
          transactionId: result.data.transactionId,
          parsed: result.data.parsed,
          confirmation: result.data.confirmation,
          balance: result.data.balance || {},
          achievement: result.data.achievement || {},
          suggestions: result.data.suggestions || []
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: processId,
          userMode: requestData.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
        }
      };
    } else {
      return BK_handleError(result, {
        processId: processId,
        userId: requestData.userId,
        operation: "快速記帳API"
      });
    }

  } catch (error) {
    BK_logError(`${logPrefix} 快速記帳API處理失敗: ${error.toString()}`, "API端點", requestData.userId || "", "API_QUICK_TRANSACTION_ERROR", error.toString(), "BK_processAPIQuickTransaction");
    return BK_handleError(error, {
      processId: processId,
      userId: requestData.userId,
      operation: "快速記帳API"
    });
  }
}

/**
 * BK_processAPITransaction - 處理交易記錄API端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 新增API端點處理函數，支援POST /transactions
 */
async function BK_processAPITransaction(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPITransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理交易記錄API請求`, "API端點", requestData.userId || "", "BK_processAPITransaction");

    // 初始化模組
    await BK_initialize();

    // 驗證請求資料
    const validation = BK_validateTransactionData(requestData);
    if (!validation.success) {
      return BK_handleError({
        message: validation.error,
        errorType: validation.errorType
      }, {
        processId: processId,
        userId: requestData.userId,
        operation: "交易記錄API"
      });
    }

    // 呼叫交易創建函數
    const result = await BK_createTransaction({
      amount: requestData.amount,
      type: requestData.type,
      categoryId: requestData.categoryId,
      accountId: requestData.accountId,
      ledgerId: requestData.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      date: requestData.date,
      description: requestData.description || '',
      notes: requestData.notes || '',
      tags: requestData.tags || [],
      userId: requestData.userId,
      processId: processId,
      // 轉帳專用
      toAccountId: requestData.toAccountId,
      // 進階欄位
      attachmentIds: requestData.attachmentIds || [],
      location: requestData.location || {},
      recurring: requestData.recurring || {}
    });

    if (result.success) {
      BK_logInfo(`${logPrefix} 交易記錄API處理成功`, "API端點", requestData.userId || "", "BK_processAPITransaction");
      
      return {
        success: true,
        data: {
          transactionId: result.data.transactionId,
          amount: result.data.amount,
          type: result.data.type,
          category: result.data.category,
          account: result.data.account,
          date: result.data.date,
          accountBalance: result.data.accountBalance || 0,
          monthlyTotal: result.data.monthlyTotal || 0,
          categoryBudget: result.data.categoryBudget || {},
          achievement: result.data.achievement || {},
          message: result.data.message || getEnvVar('TRANSACTION_SUCCESS_MESSAGE', '記帳成功'),
          recurringId: result.data.recurringId,
          createdAt: new Date().toISOString()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: processId,
          userMode: requestData.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
        }
      };
    } else {
      return BK_handleError(result, {
        processId: processId,
        userId: requestData.userId,
        operation: "交易記錄API"
      });
    }

  } catch (error) {
    BK_logError(`${logPrefix} 交易記錄API處理失敗: ${error.toString()}`, "API端點", requestData.userId || "", "API_TRANSACTION_ERROR", error.toString(), "BK_processAPITransaction");
    return BK_handleError(error, {
      processId: processId,
      userId: requestData.userId,
      operation: "交易記錄API"
    });
  }
}

/**
 * BK_processAPIGetTransactions - 處理交易查詢API端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 新增API端點處理函數，支援GET /transactions
 */
async function BK_processAPIGetTransactions(queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetTransactions:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理交易查詢API請求`, "API端點", queryParams.userId || "", "BK_processAPIGetTransactions");

    // 初始化模組
    await BK_initialize();

    // 呼叫交易查詢函數
    const result = await BK_getTransactions({
      userId: queryParams.userId,
      ledgerId: queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      categoryId: queryParams.categoryId,
      accountId: queryParams.accountId,
      type: queryParams.type,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      minAmount: queryParams.minAmount,
      maxAmount: queryParams.maxAmount,
      search: queryParams.search,
      page: parseInt(queryParams.page || '1', 10),
      limit: Math.min(parseInt(queryParams.limit || '20', 10), parseInt(getEnvVar('MAX_QUERY_LIMIT', '100'), 10)),
      sort: queryParams.sort || 'date:desc'
    });

    if (result.success) {
      BK_logInfo(`${logPrefix} 交易查詢API處理成功，返回${result.data.total}筆記錄`, "API端點", queryParams.userId || "", "BK_processAPIGetTransactions");
      
      // 計算分頁資訊
      const page = parseInt(queryParams.page || '1', 10);
      const limit = parseInt(queryParams.limit || '20', 10);
      const total = result.data.total;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          transactions: result.data.transactions,
          pagination: {
            page: page,
            limit: limit,
            total: total,
            totalPages: totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null
          },
          summary: result.data.summary || {
            totalIncome: 0,
            totalExpense: 0,
            netAmount: 0,
            recordCount: total
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: processId,
          userMode: queryParams.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
        }
      };
    } else {
      return BK_handleError(result, {
        processId: processId,
        userId: queryParams.userId,
        operation: "交易查詢API"
      });
    }

  } catch (error) {
    BK_logError(`${logPrefix} 交易查詢API處理失敗: ${error.toString()}`, "API端點", queryParams.userId || "", "API_GET_TRANSACTIONS_ERROR", error.toString(), "BK_processAPIGetTransactions");
    return BK_handleError(error, {
      processId: processId,
      userId: queryParams.userId,
      operation: "交易查詢API"
    });
  }
}

/**
 * BK_processAPIGetTransactionDetail - 處理單一交易詳情API端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 新增API端點處理函數，支援GET /transactions/{id}
 */
async function BK_processAPIGetTransactionDetail(transactionId, queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetTransactionDetail:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理交易詳情API請求: ${transactionId}`, "API端點", queryParams.userId || "", "BK_processAPIGetTransactionDetail");

    // 初始化模組
    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 查找交易記錄
    const ledgerCollection = getEnvVar('LEDGER_COLLECTION', 'ledgers');
    const entriesCollection = getEnvVar('ENTRIES_COLLECTION', 'entries');
    const idField = getEnvVar('ID_FIELD', '收支ID');
    
    const ledgerId = queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
    const querySnapshot = await db.collection(ledgerCollection)
      .doc(ledgerId)
      .collection(entriesCollection)
      .where(idField, '==', transactionId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return BK_handleError({
        message: getEnvVar('TRANSACTION_NOT_FOUND_MESSAGE', '交易記錄不存在'),
        errorType: "NOT_FOUND"
      }, {
        processId: processId,
        userId: queryParams.userId,
        operation: "交易詳情API"
      });
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    // 組織回應資料
    const fieldNames = {
      id: getEnvVar('ID_FIELD', '收支ID'),
      income: getEnvVar('INCOME_FIELD', '收入'),
      expense: getEnvVar('EXPENSE_FIELD', '支出'),
      date: getEnvVar('DATE_FIELD', '日期'),
      time: getEnvVar('TIME_FIELD', '時間'),
      description: getEnvVar('DESCRIPTION_FIELD', '備註'),
      category: getEnvVar('CATEGORY_FIELD', '子項名稱'),
      paymentMethod: getEnvVar('PAYMENT_METHOD_FIELD', '支付方式'),
      uid: getEnvVar('UID_FIELD', 'UID'),
      majorCode: getEnvVar('MAJOR_CODE_FIELD', '大項代碼'),
      minorCode: getEnvVar('MINOR_CODE_FIELD', '子項代碼')
    };

    const transactionDetail = {
      id: data[fieldNames.id],
      amount: parseFloat(data[fieldNames.income] || data[fieldNames.expense] || 0),
      type: data[fieldNames.income] ? 'income' : 'expense',
      date: data[fieldNames.date],
      description: data[fieldNames.description] || '',
      notes: data.notes || '',
      category: {
        id: `${data[fieldNames.majorCode]}_${data[fieldNames.minorCode]}`,
        name: data[fieldNames.category],
        icon: data.categoryIcon || getEnvVar('DEFAULT_CATEGORY_ICON', '💰'),
        parentId: data[fieldNames.majorCode]
      },
      account: {
        id: data.accountId || 'default_account',
        name: data[fieldNames.paymentMethod] || BK_CONFIG.DEFAULT_PAYMENT_METHOD,
        type: data.accountType || 'cash',
        balance: data.accountBalance || 0
      },
      ledger: {
        id: ledgerId,
        name: data.ledgerName || getEnvVar('DEFAULT_LEDGER_NAME', '預設帳本'),
        type: 'personal'
      },
      tags: data.tags || [],
      attachments: data.attachments || [],
      location: data.location || {},
      recurring: data.recurring || {},
      transferInfo: data.transferInfo || {},
      auditInfo: {
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
        createdBy: data[fieldNames.uid],
        source: data.source || 'manual',
        modificationHistory: data.modificationHistory || []
      }
    };

    BK_logInfo(`${logPrefix} 交易詳情API處理成功: ${transactionId}`, "API端點", queryParams.userId || "", "BK_processAPIGetTransactionDetail");

    return {
      success: true,
      data: transactionDetail,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: processId,
        userMode: queryParams.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 交易詳情API處理失敗: ${error.toString()}`, "API端點", queryParams.userId || "", "API_GET_TRANSACTION_DETAIL_ERROR", error.toString(), "BK_processAPIGetTransactionDetail");
    return BK_handleError(error, {
      processId: processId,
      userId: queryParams.userId,
      operation: "交易詳情API"
    });
  }
}

/**
 * BK_processAPIUpdateTransaction - 處理交易更新API端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 新增API端點處理函數，支援PUT /transactions/{id}
 */
async function BK_processAPIUpdateTransaction(transactionId, updateData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIUpdateTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理交易更新API請求: ${transactionId}`, "API端點", updateData.userId || "", "BK_processAPIUpdateTransaction");

    // 初始化模組
    await BK_initialize();

    // 呼叫交易更新函數
    const result = await BK_updateTransaction(transactionId, {
      amount: updateData.amount,
      type: updateData.type,
      categoryId: updateData.categoryId,
      accountId: updateData.accountId,
      date: updateData.date,
      description: updateData.description,
      notes: updateData.notes,
      tags: updateData.tags,
      attachmentIds: updateData.attachmentIds,
      userId: updateData.userId,
      ledgerId: updateData.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      processId: processId
    });

    if (result.success) {
      BK_logInfo(`${logPrefix} 交易更新API處理成功: ${transactionId}`, "API端點", updateData.userId || "", "BK_processAPIUpdateTransaction");
      
      return {
        success: true,
        data: {
          transactionId: transactionId,
          message: getEnvVar('TRANSACTION_UPDATE_SUCCESS_MESSAGE', '交易記錄更新成功'),
          updatedFields: result.data.updatedFields || [],
          updatedAt: new Date().toISOString(),
          accountBalanceChanges: result.data.accountBalanceChanges || []
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: processId,
          userMode: updateData.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
        }
      };
    } else {
      return BK_handleError(result, {
        processId: processId,
        userId: updateData.userId,
        operation: "交易更新API"
      });
    }

  } catch (error) {
    BK_logError(`${logPrefix} 交易更新API處理失敗: ${error.toString()}`, "API端點", updateData.userId || "", "API_UPDATE_TRANSACTION_ERROR", error.toString(), "BK_processAPIUpdateTransaction");
    return BK_handleError(error, {
      processId: processId,
      userId: updateData.userId,
      operation: "交易更新API"
    });
  }
}

/**
 * BK_processAPIDeleteTransaction - 處理交易刪除API端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 新增API端點處理函數，支援DELETE /transactions/{id}
 */
async function BK_processAPIDeleteTransaction(transactionId, queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIDeleteTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理交易刪除API請求: ${transactionId}`, "API端點", queryParams.userId || "", "BK_processAPIDeleteTransaction");

    // 初始化模組
    await BK_initialize();

    // 呼叫交易刪除函數
    const result = await BK_deleteTransaction(transactionId, {
      userId: queryParams.userId,
      ledgerId: queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      deleteRecurring: queryParams.deleteRecurring === 'true',
      processId: processId
    });

    if (result.success) {
      BK_logInfo(`${logPrefix} 交易刪除API處理成功: ${transactionId}`, "API端點", queryParams.userId || "", "BK_processAPIDeleteTransaction");
      
      return {
        success: true,
        data: {
          transactionId: transactionId,
          message: getEnvVar('TRANSACTION_DELETE_SUCCESS_MESSAGE', '交易記錄已刪除'),
          deletedAt: new Date().toISOString(),
          affectedData: result.data.affectedData || {
            accountBalance: 0,
            recurringDeleted: false,
            attachmentsDeleted: 0
          }
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: processId,
          userMode: queryParams.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
        }
      };
    } else {
      return BK_handleError(result, {
        processId: processId,
        userId: queryParams.userId,
        operation: "交易刪除API"
      });
    }

  } catch (error) {
    BK_logError(`${logPrefix} 交易刪除API處理失敗: ${error.toString()}`, "API端點", queryParams.userId || "", "API_DELETE_TRANSACTION_ERROR", error.toString(), "BK_processAPIDeleteTransaction");
    return BK_handleError(error, {
      processId: processId,
      userId: queryParams.userId,
      operation: "交易刪除API"
    });
  }
}

/**
 * BK_processAPIGetDashboard - 處理儀表板數據API端點
 * @version 2025-01-28-V2.2.0
 * @date 2025-01-28
 * @update: 新增API端點處理函數，支援GET /transactions/dashboard
 */
async function BK_processAPIGetDashboard(queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetDashboard:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理儀表板數據API請求`, "API端點", queryParams.userId || "", "BK_processAPIGetDashboard");

    // 初始化模組
    await BK_initialize();

    // 呼叫儀表板數據函數
    const result = await BK_getDashboardData({
      userId: queryParams.userId,
      ledgerId: queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      period: queryParams.period || 'month'
    });

    if (result.success) {
      BK_logInfo(`${logPrefix} 儀表板數據API處理成功`, "API端點", queryParams.userId || "", "BK_processAPIGetDashboard");
      
      return {
        success: true,
        data: result.data,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: processId,
          userMode: queryParams.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
        }
      };
    } else {
      return BK_handleError(result, {
        processId: processId,
        userId: queryParams.userId,
        operation: "儀表板數據API"
      });
    }

  } catch (error) {
    BK_logError(`${logPrefix} 儀表板數據API處理失敗: ${error.toString()}`, "API端點", queryParams.userId || "", "API_GET_DASHBOARD_ERROR", error.toString(), "BK_processAPIGetDashboard");
    return BK_handleError(error, {
      processId: processId,
      userId: queryParams.userId,
      operation: "儀表板數據API"
    });
  }
}

// === 模組導出 ===
module.exports = {
  // 初始化函數
  BK_initialize,
  BK_initializeFirebase,

  // 核心API端點函數
  BK_createTransaction,
  BK_processQuickTransaction,
  BK_getTransactions,
  BK_getDashboardData,
  BK_updateTransaction,
  BK_deleteTransaction,

  // 新增的API端點處理函數
  BK_processAPIQuickTransaction,
  BK_processAPITransaction,
  BK_processAPIGetTransactions,
  BK_processAPIGetTransactionDetail,
  BK_processAPIUpdateTransaction,
  BK_processAPIDeleteTransaction,
  BK_processAPIGetDashboard,

  // 相容性函數
  BK_processBookkeeping,

  // 輔助函數
  BK_parseQuickInput,
  BK_validateTransactionData,
  BK_generateTransactionId,
  BK_validatePaymentMethod,
  BK_generateStatistics,
  BK_buildTransactionQuery,
  BK_handleError,

  // 工具函數
  BK_checkTransactionIdUnique,
  BK_prepareTransactionData,
  BK_saveTransactionToFirestore,
  BK_calculateTransactionStats,

  // 配置
  BK_CONFIG,

  // 日誌函數
  BK_logInfo,
  BK_logWarning,
  BK_logError,
  BK_logCritical,
};
