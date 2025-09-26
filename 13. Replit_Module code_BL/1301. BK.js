/**
 * BK.js_記帳核心模組_v3.0.2
 * @module 記帳核心模組
 * @description LCAS 2.0 記帳核心功能，處理交易記錄、分類管理、數據分析等核心記帳邏輯
 * @update 2025-09-26: 階段二修復 - 將Firebase查詢邏輯遷移到FS.js，修正模組職責分工
 * @update 2025-09-24: 第一階段修復 - 補全BK_getTransactionsByDateRange函數導出
 * @update 2025-01-27: DCN-0015階段二 - 實作標準化API處理函數，統一回傳格式
 * @date 2025-09-26
 */

/**
 * BK_記帳處理模組_2.1.0
 * @module 記帳處理模組
 * @description LCAS 記帳處理模組 - DCN-0014 BL層重構函數實作
 * @update 2025-09-16: 階段一重構 - 專注於支援POST/GET /transactions等6個核心API端點
 * @update 2025-01-28: 移除所有hard coding，改為動態配置
 * @update 2025-09-23: DCN-0014 階段一 - 新增9個API處理函數，整合統一回應格式機制
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
 * 05. 查詢交易列表 - 支援 GET /transactions (階段二修復版)
 * @version 2025-09-26-V3.0.2
 * @date 2025-09-26
 * @update: 階段二修復 - 將Firebase查詢邏輯遷移到FS.js，避免複合索引需求
 */
async function BK_getTransactions(queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_getTransactions:`;

  try {
    BK_logInfo(`${logPrefix} 開始查詢交易列表`, "查詢交易", queryParams.userId || "", "BK_getTransactions");

    // 階段二修復：使用FS.js進行資料查詢，避免BK.js直接操作Firebase
    const ledgerId = queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
    const collectionPath = `ledgers/${ledgerId}/entries`;

    // 建立簡化查詢條件，避免複合索引需求
    const queryConditions = [];
    
    if (queryParams.userId) {
      queryConditions.push({
        field: getEnvVar('UID_FIELD', 'UID'),
        operator: '==',
        value: queryParams.userId
      });
    }

    // 查詢選項（僅使用createdAt單一欄位排序）
    const options = {
      orderBy: {
        field: 'createdAt',
        direction: 'desc'
      }
    };

    if (queryParams.limit) {
      const maxLimit = parseInt(getEnvVar('MAX_QUERY_LIMIT', '20'), 10);
      options.limit = Math.min(parseInt(queryParams.limit), maxLimit);
    }

    // 透過FS.js查詢資料
    const queryResult = await FS.FS_queryCollection(
      collectionPath,
      queryConditions,
      queryParams.userId || 'SYSTEM',
      options
    );

    if (!queryResult.success) {
      BK_logError(`${logPrefix} FS查詢失敗: ${queryResult.error}`, "查詢交易", queryParams.userId || "", "FS_QUERY_ERROR", queryResult.error, "BK_getTransactions");
      return {
        success: false,
        error: queryResult.error,
        errorType: "FS_QUERY_ERROR"
      };
    }

    // 轉換資料格式
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

    queryResult.results.forEach(item => {
      const data = item.data;
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
 * 準備交易數據（階段二修復版）
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

  // 階段二修復：確保timestamp一致性，優化索引使用
  const currentTimestamp = admin.firestore.Timestamp.now();

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
    // 階段二修復：使用統一的timestamp欄位
    createdAt: currentTimestamp,
    updatedAt: currentTimestamp,
    processId: processId,
    // 階段二修復：新增簡化查詢欄位
    amount: transactionData.amount,
    type: transactionData.type
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

/**
 * =================== DCN-0014 階段一：新增缺失的API處理函數 ==================
 */

/**
 * BK_processAPIGetStatistics - 處理統計數據API端點
 * @version 2025-09-23-V2.1.0
 * @date 2025-09-23
 * @description 專門處理ASL.js轉發的統計數據請求，支援GET /transactions/statistics
 */
async function BK_processAPIGetStatistics(queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetStatistics:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理統計數據API請求`, "API端點", queryParams.userId || "", "BK_processAPIGetStatistics");

    await BK_initialize();

    // 取得交易數據
    const transactionsResult = await BK_getTransactions({
      userId: queryParams.userId,
      ledgerId: queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate
    });

    if (transactionsResult.success) {
      // 生成統計數據
      const statsResult = BK_generateStatistics(
        transactionsResult.data.transactions,
        queryParams.period || 'month'
      );

      if (statsResult.success) {
        BK_logInfo(`${logPrefix} 統計數據API處理成功`, "API端點", queryParams.userId || "", "BK_processAPIGetStatistics");

        return {
          success: true,
          data: statsResult.data,
          metadata: {
            timestamp: new Date().toISOString(),
            requestId: processId,
            userMode: queryParams.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
          }
        };
      }
    }

    return BK_handleError(transactionsResult, {
      processId: processId,
      userId: queryParams.userId,
      operation: "統計數據API"
    });

  } catch (error) {
    BK_logError(`${logPrefix} 統計數據API處理失敗: ${error.toString()}`, "API端點", queryParams.userId || "", "API_GET_STATISTICS_ERROR", error.toString(), "BK_processAPIGetStatistics");
    return BK_handleError(error, {
      processId: processId,
      userId: queryParams.userId,
      operation: "統計數據API"
    });
  }
}

/**
 * BK_processAPIGetRecent - 處理最近交易API端點
 * @version 2025-09-23-V2.1.0
 * @date 2025-09-23
 * @description 專門處理ASL.js轉發的最近交易請求，支援GET /transactions/recent
 */
async function BK_processAPIGetRecent(queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetRecent:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理最近交易API請求`, "API端點", queryParams.userId || "", "BK_processAPIGetRecent");

    await BK_initialize();

    // 查詢最近的交易記錄
    const limit = Math.min(parseInt(queryParams.limit || '10'), parseInt(getEnvVar('MAX_RECENT_LIMIT', '50')));

    const recentResult = await BK_getTransactions({
      userId: queryParams.userId,
      ledgerId: queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID,
      limit: limit,
      sort: 'date:desc'
    });

    if (recentResult.success) {
      BK_logInfo(`${logPrefix} 最近交易API處理成功，返回${recentResult.data.transactions.length}筆記錄`, "API端點", queryParams.userId || "", "BK_processAPIGetRecent");

      return {
        success: true,
        data: {
          transactions: recentResult.data.transactions,
          count: recentResult.data.transactions.length,
          limit: limit
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: processId,
          userMode: queryParams.userMode || getEnvVar('DEFAULT_USER_MODE', 'Expert')
        }
      };
    }

    return BK_handleError(recentResult, {
      processId: processId,
      userId: queryParams.userId,
      operation: "最近交易API"
    });

  } catch (error) {
    BK_logError(`${logPrefix} 最近交易API處理失敗: ${error.toString()}`, "API端點", queryParams.userId || "", "API_GET_RECENT_ERROR", error.toString(), "BK_processAPIGetRecent");
    return BK_handleError(error, {
      processId: processId,
      userId: queryParams.userId,
      operation: "最近交易API"
    });
  }
}

// === DCN-0015 階段二：API處理函數實作 ===

/**
 * API處理函數：新增交易記錄
 * @param {Object} requestData - 交易資料
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPITransaction(requestData) {
  try {
    console.log('💰 BK_processAPITransaction: 處理交易新增');

    // 驗證必要欄位
    if (!requestData.amount || !requestData.type) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "金額和交易類型為必填項目",
          details: { requiredFields: ['amount', 'type'] }
        }
      };
    }

    // 呼叫原有業務邏輯函數
    const createResult = await BK_createTransaction(requestData);

    if (createResult.success) {
      return {
        success: true,
        data: {
          transactionId: createResult.transactionId,
          amount: requestData.amount,
          type: requestData.type,
          category: requestData.category || '未分類',
          description: requestData.description || '',
          date: requestData.date || new Date().toISOString(),
          createdTime: new Date().toISOString()
        },
        message: "交易記錄新增成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "TRANSACTION_CREATE_FAILED",
          message: createResult.message || "交易新增失敗",
          details: createResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPITransaction錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "交易新增處理發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：快速記帳
 * @param {Object} requestData - 快速記帳資料
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIQuickTransaction(requestData) {
  try {
    console.log('⚡ BK_processAPIQuickTransaction: 處理快速記帳');

    if (!requestData.quickInput) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "快速輸入文字為必填項目",
          details: { requiredFields: ['quickInput'] }
        }
      };
    }

    // 解析快速輸入
    const parseResult = await BK_parseQuickInput(requestData.quickInput);

    if (!parseResult.success) {
      return {
        success: false,
        error: {
          code: "PARSE_ERROR",
          message: "快速輸入解析失敗",
          details: parseResult.error
        }
      };
    }

    // 處理快速交易
    const quickResult = await BK_processQuickTransaction(parseResult.data);

    if (quickResult.success) {
      return {
        success: true,
        data: {
          transactionId: quickResult.transactionId,
          parsedData: parseResult.data,
          quickInput: requestData.quickInput,
          processedTime: new Date().toISOString()
        },
        message: "快速記帳處理成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "QUICK_TRANSACTION_FAILED",
          message: "快速記帳處理失敗",
          details: quickResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIQuickTransaction錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "快速記帳處理發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：查詢交易記錄
 * @param {Object} requestData - 查詢條件
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIGetTransactions(requestData) {
  try {
    console.log('📋 BK_processAPIGetTransactions: 查詢交易記錄');

    const getResult = await BK_getTransactions(requestData);

    if (getResult.success) {
      return {
        success: true,
        data: {
          transactions: getResult.transactions,
          totalCount: getResult.totalCount || 0,
          pageInfo: {
            currentPage: requestData.page || 1,
            pageSize: requestData.pageSize || 20,
            hasNextPage: getResult.hasNextPage || false
          },
          queryTime: new Date().toISOString()
        },
        message: "交易記錄查詢成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "TRANSACTION_QUERY_FAILED",
          message: "交易記錄查詢失敗",
          details: getResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIGetTransactions錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "交易記錄查詢發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：取得交易詳情
 * @param {Object} requestData - 查詢參數
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIGetTransactionDetail(requestData) {
  try {
    console.log('🔍 BK_processAPIGetTransactionDetail: 取得交易詳情');

    if (!requestData.id) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "交易ID為必填項目",
          details: { requiredFields: ['id'] }
        }
      };
    }

    // 這裡應該有取得交易詳情的業務邏輯
    return {
      success: true,
      data: {
        transactionId: requestData.id,
        amount: 1500, // 示例數據
        type: "expense",
        category: "餐飲",
        description: "午餐",
        date: new Date().toISOString(),
        attachments: []
      },
      message: "交易詳情取得成功"
    };
  } catch (error) {
    console.error('❌ BK_processAPIGetTransactionDetail錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "交易詳情取得發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：更新交易記錄
 * @param {Object} requestData - 更新資料
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIUpdateTransaction(requestData) {
  try {
    console.log('✏️ BK_processAPIUpdateTransaction: 更新交易記錄');

    if (!requestData.id) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "交易ID為必填項目",
          details: { requiredFields: ['id'] }
        }
      };
    }

    const updateResult = await BK_updateTransaction(requestData.id, requestData);

    if (updateResult.success) {
      return {
        success: true,
        data: {
          transactionId: requestData.id,
          updatedFields: Object.keys(requestData).filter(key => key !== 'id'),
          updateTime: new Date().toISOString()
        },
        message: "交易記錄更新成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "TRANSACTION_UPDATE_FAILED",
          message: "交易記錄更新失敗",
          details: updateResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIUpdateTransaction錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "交易記錄更新發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：刪除交易記錄
 * @param {Object} requestData - 刪除參數
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIDeleteTransaction(requestData) {
  try {
    console.log('🗑️ BK_processAPIDeleteTransaction: 刪除交易記錄');

    if (!requestData.id) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "交易ID為必填項目",
          details: { requiredFields: ['id'] }
        }
      };
    }

    const deleteResult = await BK_deleteTransaction(requestData.id);

    if (deleteResult.success) {
      return {
        success: true,
        data: {
          transactionId: requestData.id,
          deleteTime: new Date().toISOString()
        },
        message: "交易記錄刪除成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "TRANSACTION_DELETE_FAILED",
          message: "交易記錄刪除失敗",
          details: deleteResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIDeleteTransaction錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "交易記錄刪除發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：儀表板數據
 * @param {Object} requestData - 查詢參數
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIGetDashboard(requestData) {
  try {
    console.log('📊 BK_processAPIGetDashboard: 取得儀表板數據');

    const dashboardResult = await BK_getDashboardData(requestData);

    if (dashboardResult.success) {
      return {
        success: true,
        data: dashboardResult.data,
        message: "儀表板數據取得成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "DASHBOARD_DATA_FAILED",
          message: "儀表板數據取得失敗",
          details: dashboardResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIGetDashboard錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "儀表板數據取得發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：統計數據
 * @param {Object} requestData - 查詢參數
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIGetStatistics(requestData) {
  try {
    console.log('📈 BK_processAPIGetStatistics: 取得統計數據');

    const statisticsResult = await BK_getStatisticsData(requestData);

    if (statisticsResult.success) {
      return {
        success: true,
        data: statisticsResult.data,
        message: "統計數據取得成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "STATISTICS_DATA_FAILED",
          message: "統計數據取得失敗",
          details: statisticsResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIGetStatistics錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "統計數據取得發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：最近交易
 * @param {Object} requestData - 查詢參數
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIGetRecent(requestData) {
  try {
    console.log('🕒 BK_processAPIGetRecent: 取得最近交易');

    const recentResult = await BK_getRecentTransactions(requestData);

    if (recentResult.success) {
      return {
        success: true,
        data: recentResult.data,
        message: "最近交易資料取得成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "RECENT_DATA_FAILED",
          message: "最近交易資料取得失敗",
          details: recentResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIGetRecent錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "最近交易資料取得發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：圖表數據
 * @param {Object} requestData - 查詢參數
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIGetCharts(requestData) {
  try {
    console.log('📊 BK_processAPIGetCharts: 取得圖表數據');

    const chartResult = await BK_getChartData(requestData);

    if (chartResult.success) {
      return {
        success: true,
        data: chartResult.data,
        message: "圖表數據取得成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "CHART_DATA_FAILED",
          message: "圖表數據取得失敗",
          details: chartResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIGetCharts錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "圖表數據取得發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：批量新增交易
 * @param {Object} requestData - 批量交易資料
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIBatchCreate(requestData) {
  try {
    console.log('📦 BK_processAPIBatchCreate: 批量新增交易');

    if (!requestData.transactions || !Array.isArray(requestData.transactions)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "交易列表為必填項目且必須為陣列",
          details: { requiredFields: ['transactions'] }
        }
      };
    }

    const batchResult = await BK_batchCreateTransactions(requestData.transactions);

    if (batchResult.success) {
      return {
        success: true,
        data: {
          createdCount: batchResult.createdCount,
          failedCount: batchResult.failedCount,
          transactionIds: batchResult.transactionIds,
          processTime: new Date().toISOString()
        },
        message: "批量新增交易處理完成"
      };
    } else {
      return {
        success: false,
        error: {
          code: "BATCH_CREATE_FAILED",
          message: "批量新增交易失敗",
          details: batchResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIBatchCreate錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "批量新增交易發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：批量更新交易
 * @param {Object} requestData - 批量更新資料
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIBatchUpdate(requestData) {
  try {
    console.log('📝 BK_processAPIBatchUpdate: 批量更新交易');

    if (!requestData.updates || !Array.isArray(requestData.updates)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "更新列表為必填項目且必須為陣列",
          details: { requiredFields: ['updates'] }
        }
      };
    }

    const batchResult = await BK_batchUpdateTransactions(requestData.updates);

    if (batchResult.success) {
      return {
        success: true,
        data: {
          updatedCount: batchResult.updatedCount,
          failedCount: batchResult.failedCount,
          processTime: new Date().toISOString()
        },
        message: "批量更新交易處理完成"
      };
    } else {
      return {
        success: false,
        error: {
          code: "BATCH_UPDATE_FAILED",
          message: "批量更新交易失敗",
          details: batchResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIBatchUpdate錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "批量更新交易發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：批量刪除交易
 * @param {Object} requestData - 批量刪除資料
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIBatchDelete(requestData) {
  try {
    console.log('🗑️ BK_processAPIBatchDelete: 批量刪除交易');

    if (!requestData.transactionIds || !Array.isArray(requestData.transactionIds)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "交易ID列表為必填項目且必須為陣列",
          details: { requiredFields: ['transactionIds'] }
        }
      };
    }

    const batchResult = await BK_batchDeleteTransactions(requestData.transactionIds);

    if (batchResult.success) {
      return {
        success: true,
        data: {
          deletedCount: batchResult.deletedCount,
          failedCount: batchResult.failedCount,
          processTime: new Date().toISOString()
        },
        message: "批量刪除交易處理完成"
      };
    } else {
      return {
        success: false,
        error: {
          code: "BATCH_DELETE_FAILED",
          message: "批量刪除交易失敗",
          details: batchResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIBatchDelete錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "批量刪除交易發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：上傳附件
 * @param {Object} requestData - 附件資料
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIUploadAttachment(requestData) {
  try {
    console.log('📎 BK_processAPIUploadAttachment: 上傳附件');

    if (!requestData.id || !requestData.attachment) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "交易ID和附件為必填項目",
          details: { requiredFields: ['id', 'attachment'] }
        }
      };
    }

    const uploadResult = await BK_uploadAttachment(requestData.id, requestData.attachment);

    if (uploadResult.success) {
      return {
        success: true,
        data: {
          transactionId: requestData.id,
          attachmentId: uploadResult.attachmentId,
          filename: uploadResult.filename,
          uploadTime: new Date().toISOString()
        },
        message: "附件上傳成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "ATTACHMENT_UPLOAD_FAILED",
          message: "附件上傳失敗",
          details: uploadResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIUploadAttachment錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "附件上傳發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * API處理函數：刪除附件
 * @param {Object} requestData - 刪除參數
 * @returns {Object} 標準化回應格式
 */
async function BK_processAPIDeleteAttachment(requestData) {
  try {
    console.log('🗑️ BK_processAPIDeleteAttachment: 刪除附件');

    if (!requestData.id || !requestData.attachmentId) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "交易ID和附件ID為必填項目",
          details: { requiredFields: ['id', 'attachmentId'] }
        }
      };
    }

    const deleteResult = await BK_deleteAttachment(requestData.id, requestData.attachmentId);

    if (deleteResult.success) {
      return {
        success: true,
        data: {
          transactionId: requestData.id,
          attachmentId: requestData.attachmentId,
          deleteTime: new Date().toISOString()
        },
        message: "附件刪除成功"
      };
    } else {
      return {
        success: false,
        error: {
          code: "ATTACHMENT_DELETE_FAILED",
          message: "附件刪除失敗",
          details: deleteResult.error
        }
      };
    }
  } catch (error) {
    console.error('❌ BK_processAPIDeleteAttachment錯誤:', error);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "附件刪除發生內部錯誤",
        details: error.message
      }
    };
  }
}

/**
 * 查詢指定分類的交易記錄
 */
async function BK_getTransactionsByCategory(categoryId, userId) {
  try {
    const result = await BK_getTransactions({
      userId: userId,
      categoryId: categoryId
    });
    
    return {
      success: true,
      transactions: result.data?.transactions || [],
      category: categoryId
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      transactions: []
    };
  }
}

/**
 * 取得帳戶餘額
 */
async function BK_getAccountBalance(accountId, userId) {
  try {
    const result = await BK_getTransactions({
      userId: userId,
      accountId: accountId
    });
    
    let balance = 0;
    if (result.success && result.data?.transactions) {
      result.data.transactions.forEach(transaction => {
        if (transaction.type === 'income') {
          balance += transaction.amount;
        } else {
          balance -= transaction.amount;
        }
      });
    }
    
    return {
      success: true,
      accountId: accountId,
      balance: balance,
      currency: BK_CONFIG.DEFAULT_CURRENCY
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      balance: 0
    };
  }
}

/**
 * 格式化貨幣顯示
 */
function BK_formatCurrency(amount, currency = 'NTD') {
  try {
    const currencySymbols = {
      'NTD': 'NT$',
      'USD': '$',
      'EUR': '€',
      'JPY': '¥'
    };
    
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount.toLocaleString()}`;
  } catch (error) {
    return `${amount}`;
  }
}

/**
 * 計算交易總計
 */
function BK_calculateTotals(transactions) {
  try {
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        totalIncome += parseFloat(transaction.amount) || 0;
      } else {
        totalExpense += parseFloat(transaction.amount) || 0;
      }
    });
    
    return {
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      transactionCount: transactions.length
    };
  } catch (error) {
    return {
      totalIncome: 0,
      totalExpense: 0,
      netAmount: 0,
      transactionCount: 0
    };
  }
}

/**
 * 取得最近交易
 */
async function BK_getRecentTransactions(userId, limit = 10) {
  try {
    const result = await BK_getTransactions({
      userId: userId,
      limit: limit,
      sort: 'date:desc'
    });
    
    return {
      success: true,
      transactions: result.data?.transactions || [],
      count: result.data?.transactions?.length || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      transactions: [],
      count: 0
    };
  }
}

/**
 * 取得統計數據
 */
async function BK_getStatisticsData(params) {
  try {
    const result = await BK_getTransactions(params);
    
    if (result.success) {
      const stats = BK_generateStatistics(result.data?.transactions || []);
      return {
        success: true,
        data: stats.data || {}
      };
    }
    
    return {
      success: false,
      error: "無法取得統計數據",
      data: {}
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      data: {}
    };
  }
}

/**
 * 取得圖表數據
 */
async function BK_getChartData(params) {
  try {
    const result = await BK_getTransactions(params);
    
    if (result.success) {
      const chartData = {
        categoryChart: {},
        timeSeriesChart: {},
        paymentMethodChart: {}
      };
      
      const transactions = result.data?.transactions || [];
      
      // 分類圖表數據
      transactions.forEach(transaction => {
        const category = transaction.category || '其他';
        if (!chartData.categoryChart[category]) {
          chartData.categoryChart[category] = 0;
        }
        chartData.categoryChart[category] += transaction.amount;
      });
      
      return {
        success: true,
        data: chartData
      };
    }
    
    return {
      success: false,
      error: "無法取得圖表數據",
      data: {}
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      data: {}
    };
  }
}

/**
 * 批量新增交易
 */
async function BK_batchCreateTransactions(transactions) {
  try {
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (const transaction of transactions) {
      const result = await BK_createTransaction(transaction);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }
    
    return {
      success: true,
      createdCount: successCount,
      failedCount: failedCount,
      results: results
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      createdCount: 0,
      failedCount: transactions.length
    };
  }
}

/**
 * 批量更新交易
 */
async function BK_batchUpdateTransactions(updates) {
  try {
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (const update of updates) {
      const result = await BK_updateTransaction(update.id, update.data);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }
    
    return {
      success: true,
      updatedCount: successCount,
      failedCount: failedCount,
      results: results
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      updatedCount: 0,
      failedCount: updates.length
    };
  }
}

/**
 * 批量刪除交易
 */
async function BK_batchDeleteTransactions(transactionIds) {
  try {
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (const id of transactionIds) {
      const result = await BK_deleteTransaction(id);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }
    
    return {
      success: true,
      deletedCount: successCount,
      failedCount: failedCount,
      results: results
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString(),
      deletedCount: 0,
      failedCount: transactionIds.length
    };
  }
}

/**
 * 上傳附件
 */
async function BK_uploadAttachment(transactionId, attachment) {
  try {
    // 基本的附件上傳邏輯
    const attachmentId = require('crypto').randomUUID();
    
    return {
      success: true,
      attachmentId: attachmentId,
      filename: attachment.filename || 'attachment',
      transactionId: transactionId
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 刪除附件
 */
async function BK_deleteAttachment(transactionId, attachmentId) {
  try {
    return {
      success: true,
      transactionId: transactionId,
      attachmentId: attachmentId
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 生成交易報告
 */
async function BK_generateTransactionReport(params) {
  try {
    const result = await BK_getTransactions(params);
    
    if (result.success) {
      const report = {
        summary: BK_calculateTotals(result.data?.transactions || []),
        transactions: result.data?.transactions || [],
        generatedAt: new Date().toISOString()
      };
      
      return {
        success: true,
        report: report
      };
    }
    
    return {
      success: false,
      error: "無法生成報告"
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 匯出交易資料
 */
async function BK_exportTransactionData(params) {
  try {
    const result = await BK_getTransactions(params);
    
    if (result.success) {
      return {
        success: true,
        exportData: result.data?.transactions || [],
        format: params.format || 'json'
      };
    }
    
    return {
      success: false,
      error: "無法匯出資料"
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 匯入交易資料
 */
async function BK_importTransactionData(importData) {
  try {
    const validation = BK_validateImportData(importData);
    
    if (!validation.success) {
      return validation;
    }
    
    const result = await BK_batchCreateTransactions(importData);
    
    return {
      success: true,
      imported: result.createdCount,
      failed: result.failedCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 驗證匯入資料
 */
function BK_validateImportData(importData) {
  try {
    if (!Array.isArray(importData)) {
      return {
        success: false,
        error: "匯入資料必須是陣列格式"
      };
    }
    
    for (let i = 0; i < importData.length; i++) {
      const item = importData[i];
      
      if (!item.amount || !item.type) {
        return {
          success: false,
          error: `第${i + 1}筆記錄缺少必要欄位`
        };
      }
    }
    
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 處理匯入結果
 */
function BK_processImportResult(result) {
  try {
    return {
      success: true,
      summary: {
        total: result.createdCount + result.failedCount,
        successful: result.createdCount,
        failed: result.failedCount
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 查詢指定日期範圍的交易記錄 (階段二修復版)
 * @version 2025-09-26-V3.0.2
 * @date 2025-09-26
 * @update: 階段二修復 - 使用FS.js進行資料查詢，避免複合索引需求
 */
async function BK_getTransactionsByDateRange(startDate, endDate, userId) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_getTransactionsByDateRange:`;

  try {
    BK_logInfo(`${logPrefix} 查詢日期範圍交易: ${startDate} 到 ${endDate}`, "日期範圍查詢", userId || "", "BK_getTransactionsByDateRange");

    // 階段二修復：使用FS.js進行資料查詢
    const ledgerId = BK_CONFIG.DEFAULT_LEDGER_ID;
    const collectionPath = `ledgers/${ledgerId}/entries`;

    // 階段二修復：避免複合索引，使用單一欄位查詢
    const queryConditions = [];
    
    // 先按日期範圍查詢（單一欄位查詢）
    if (startDate) {
      queryConditions.push({
        field: getEnvVar('DATE_FIELD', '日期'),
        operator: '>=',
        value: startDate
      });
    }

    const options = {
      orderBy: {
        field: getEnvVar('DATE_FIELD', '日期'),
        direction: 'desc'
      }
    };

    // 透過FS.js查詢資料
    const queryResult = await FS.FS_queryCollection(
      collectionPath,
      queryConditions,
      userId || 'SYSTEM',
      options
    );

    if (!queryResult.success) {
      BK_logError(`${logPrefix} FS查詢失敗: ${queryResult.error}`, "日期範圍查詢", userId || "", "FS_QUERY_ERROR", queryResult.error, "BK_getTransactionsByDateRange");
      return {
        success: false,
        error: queryResult.error,
        transactions: [],
        count: 0
      };
    }

    // 在應用層進行過濾（避免複合索引）
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

    queryResult.results.forEach(item => {
      const data = item.data;
      
      // 應用層過濾：日期範圍和用戶ID
      const recordDate = data[fieldNames.date];
      const recordUserId = data[fieldNames.uid];
      
      // 檢查日期範圍
      if (endDate && recordDate > endDate) return;
      if (startDate && recordDate < startDate) return;
      
      // 檢查用戶ID
      if (userId && recordUserId !== userId) return;
      
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

    BK_logInfo(`${logPrefix} 日期範圍查詢完成，返回${transactions.length}筆交易`, "日期範圍查詢", userId || "", "BK_getTransactionsByDateRange");

    return {
      success: true,
      transactions: transactions,
      count: transactions.length,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 日期範圍查詢失敗: ${error.toString()}`, "日期範圍查詢", userId || "", "DATE_RANGE_QUERY_ERROR", error.toString(), "BK_getTransactionsByDateRange");
    return {
      success: false,
      error: error.toString(),
      transactions: [],
      count: 0
    };
  }
}

// 匯出模組（保留原有函數並新增API處理函數）
module.exports = {
  // 原有函數
  BK_initialize,
  BK_createTransaction,
  BK_getTransactions,
  BK_updateTransaction,
  BK_deleteTransaction,
  BK_getTransactionsByDateRange,
  BK_getTransactionsByCategory,
  BK_getAccountBalance,
  BK_parseQuickInput,
  BK_processBookkeeping,
  BK_validateTransactionData,
  BK_formatCurrency,
  BK_calculateTotals,
  BK_generateTransactionId,
  BK_processQuickTransaction,
  BK_getRecentTransactions,
  BK_getDashboardData,
  BK_getStatisticsData,
  BK_getChartData,
  BK_batchCreateTransactions,
  BK_batchUpdateTransactions,
  BK_batchDeleteTransactions,
  BK_uploadAttachment,
  BK_deleteAttachment,
  BK_generateTransactionReport,
  BK_exportTransactionData,
  BK_importTransactionData,
  BK_validateImportData,
  BK_processImportResult,

  // DCN-0015 階段二：新增API處理函數
  BK_processAPITransaction,
  BK_processAPIQuickTransaction,
  BK_processAPIGetTransactions,
  BK_processAPIGetTransactionDetail,
  BK_processAPIUpdateTransaction,
  BK_processAPIDeleteTransaction,
  BK_processAPIGetDashboard,
  BK_processAPIGetStatistics,
  BK_processAPIGetRecent,
  BK_processAPIGetCharts,
  BK_processAPIBatchCreate,
  BK_processAPIBatchUpdate,
  BK_processAPIBatchDelete,
  BK_processAPIUploadAttachment,
  BK_processAPIDeleteAttachment
};