
/**
 * BK_記帳處理模組_2.1.0
 * @module 記帳處理模組
 * @description LCAS 記帳處理模組 - 實現 BK 2.1 版本，重構為支援Phase 1的6個核心API端點
 * @update 2025-09-16: 階段一重構 - 專注於支援POST/GET /transactions等6個核心API端點
 */

// 引入所需模組
const moment = require('moment-timezone');
const admin = require('firebase-admin');

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

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

// 配置參數
const BK_CONFIG = {
  DEBUG: true,                            // 調試模式開關
  LOG_LEVEL: "DEBUG",                     // 日誌級別
  FIRESTORE_ENABLED: getEnvVar('FIRESTORE_ENABLED') || 'true',
  DEFAULT_LEDGER_ID: getEnvVar('DEFAULT_LEDGER_ID') || 'ledger_structure_001',
  TIMEZONE: "Asia/Taipei",                // 時區設置
  INITIALIZATION_INTERVAL: 300000,        // 初始化間隔(毫秒)
  VERSION: "2.1.0",                       // 模組版本
  API_ENDPOINTS: {
    POST_TRANSACTIONS: '/transactions',
    GET_TRANSACTIONS: '/transactions',
    PUT_TRANSACTIONS: '/transactions/{id}',
    DELETE_TRANSACTIONS: '/transactions/{id}',
    POST_QUICK: '/transactions/quick',
    GET_DASHBOARD: '/transactions/dashboard'
  }
};

// 初始化狀態追蹤
let BK_INIT_STATUS = {
  lastInitTime: 0,         // 上次初始化時間
  initialized: false,      // 是否已初始化
  DL_initialized: false,   // DL模組是否已初始化
  firestore_db: null,      // Firestore 實例
  moduleVersion: "2.1.0"   // 模組版本追蹤
};

/**
 * 01. 模組初始化與配置管理
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段一重構 - 專注於6個核心API端點支援
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
      if (typeof DL_initialize === 'function') {
        DL_initialize();
        BK_INIT_STATUS.DL_initialized = true;
        initMessages.push("DL模組初始化: 成功");

        if (typeof DL_setLogLevels === 'function') {
          DL_setLogLevels('DEBUG', 'DEBUG');
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @update: 優化Firebase連接管理，支援API端點需求
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
    await db.collection('_health_check').doc('bk_init_test').set({
      timestamp: admin.firestore.Timestamp.now(),
      module: 'BK',
      version: BK_CONFIG.VERSION,
      status: 'initialized'
    });

    // 刪除測試文檔
    await db.collection('_health_check').doc('bk_init_test').delete();

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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 專門支援POST /transactions API端點
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
        errorType: "VALIDATION_ERROR"
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 專門支援POST /transactions/quick API端點
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
      const confirmation = `✅ 已記錄${parsed.type === 'income' ? '收入' : '支出'} NT$${parsed.amount} - ${parsed.description}`;
      
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 專門支援GET /transactions API端點
 */
async function BK_getTransactions(queryParams = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_getTransactions:`;

  try {
    BK_logInfo(`${logPrefix} 開始查詢交易列表`, "查詢交易", queryParams.userId || "", "BK_getTransactions");

    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 建立查詢
    let query = db.collection('ledgers')
      .doc(queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID)
      .collection('entries');

    // 應用篩選條件
    if (queryParams.userId) {
      query = query.where('UID', '==', queryParams.userId);
    }

    if (queryParams.startDate && queryParams.endDate) {
      query = query.where('日期', '>=', queryParams.startDate)
                   .where('日期', '<=', queryParams.endDate);
    }

    if (queryParams.type) {
      if (queryParams.type === 'income') {
        query = query.where('收入', '>', '');
      } else if (queryParams.type === 'expense') {
        query = query.where('支出', '>', '');
      }
    }

    // 排序和分頁
    query = query.orderBy('日期', 'desc').orderBy('時間', 'desc');
    
    if (queryParams.limit) {
      query = query.limit(parseInt(queryParams.limit));
    }

    const querySnapshot = await query.get();
    const transactions = [];

    querySnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: data.收支ID,
        amount: parseFloat(data.收入 || data.支出 || 0),
        type: data.收入 ? 'income' : 'expense',
        date: data.日期,
        time: data.時間,
        description: data.備註,
        category: data.子項名稱,
        paymentMethod: data.支付方式,
        userId: data.UID
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 專門支援GET /transactions/dashboard API端點
 */
async function BK_getDashboardData(params = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_getDashboardData:`;

  try {
    BK_logInfo(`${logPrefix} 開始生成儀表板數據`, "儀表板查詢", params.userId || "", "BK_getDashboardData");

    // 取得今日和本月數據
    const today = moment().tz(BK_CONFIG.TIMEZONE).format("YYYY/MM/DD");
    const monthStart = moment().tz(BK_CONFIG.TIMEZONE).startOf('month').format("YYYY/MM/DD");
    const monthEnd = moment().tz(BK_CONFIG.TIMEZONE).endOf('month').format("YYYY/MM/DD");

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

    // 取得最近交易（最多10筆）
    const recentTransactions = await BK_getTransactions({
      userId: params.userId,
      ledgerId: params.ledgerId,
      limit: 10
    });

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
        { action: "addTransaction", label: "快速記帳" },
        { action: "viewTransactions", label: "查看記錄" }
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 專門支援PUT /transactions/{id} API端點
 */
async function BK_updateTransaction(transactionId, updateData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_updateTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始更新交易: ${transactionId}`, "更新交易", updateData.userId || "", "BK_updateTransaction");

    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 查找交易記錄
    const ledgerId = updateData.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
    const querySnapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('entries')
      .where('收支ID', '==', transactionId)
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
    const updatedData = {
      ...currentData,
      備註: updateData.description || currentData.備註,
      支付方式: updateData.paymentMethod || currentData.支付方式,
      大項代碼: updateData.majorCode || currentData.大項代碼,
      子項代碼: updateData.minorCode || currentData.子項代碼,
      子項名稱: updateData.categoryName || currentData.子項名稱
    };

    // 更新金額
    if (updateData.amount !== undefined) {
      if (updateData.type === 'income') {
        updatedData.收入 = updateData.amount.toString();
        updatedData.支出 = '';
      } else {
        updatedData.支出 = updateData.amount.toString();
        updatedData.收入 = '';
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 專門支援DELETE /transactions/{id} API端點
 */
async function BK_deleteTransaction(transactionId, params = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_deleteTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始刪除交易: ${transactionId}`, "刪除交易", params.userId || "", "BK_deleteTransaction");

    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 查找交易記錄
    const ledgerId = params.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
    const querySnapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('entries')
      .where('收支ID', '==', transactionId)
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
    await db.collection('ledgers')
      .doc(ledgerId)
      .collection('log')
      .add({
        時間: admin.firestore.Timestamp.now(),
        訊息: `交易記錄已刪除: ${transactionId}`,
        操作類型: '刪除交易',
        UID: params.userId || '',
        來源: 'BK',
        嚴重等級: 'INFO'
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

// === 輔助函數 ===

/**
 * 從環境變數獲取配置
 */
function getEnvVar(key) {
  return process.env[key] || '';
}

/**
 * 驗證交易數據
 */
function BK_validateTransactionData(data) {
  if (!data.amount || data.amount <= 0) {
    return { success: false, error: "金額必須大於0" };
  }
  
  if (!data.type || !['income', 'expense'].includes(data.type)) {
    return { success: false, error: "交易類型必須是income或expense" };
  }

  return { success: true };
}

/**
 * 生成交易ID
 */
async function BK_generateTransactionId(processId) {
  const today = new Date();
  const dateStr = moment(today).tz(BK_CONFIG.TIMEZONE).format("YYYYMMDD");
  const timestamp = today.getTime();
  return `${dateStr}-${timestamp.toString().slice(-8)}`;
}

/**
 * 準備交易數據
 */
async function BK_prepareTransactionData(transactionId, data, processId) {
  const now = moment().tz(BK_CONFIG.TIMEZONE);
  
  return {
    收支ID: transactionId,
    使用者類型: data.userType || "J",
    日期: now.format("YYYY/MM/DD"),
    時間: now.format("HH:mm"),
    大項代碼: data.majorCode || "1",
    子項代碼: data.minorCode || "1",
    支付方式: data.paymentMethod || "現金",
    子項名稱: data.categoryName || "其他",
    UID: data.userId || "",
    備註: data.description || "",
    收入: data.type === 'income' ? data.amount.toString() : '',
    支出: data.type === 'expense' ? data.amount.toString() : '',
    同義詞: data.synonym || '',
    currency: 'NTD',
    timestamp: admin.firestore.Timestamp.now()
  };
}

/**
 * 儲存交易到Firestore
 */
async function BK_saveTransactionToFirestore(transactionData, processId) {
  try {
    const db = BK_INIT_STATUS.firestore_db;
    const ledgerId = BK_CONFIG.DEFAULT_LEDGER_ID;

    const docRef = await db
      .collection('ledgers')
      .doc(ledgerId)
      .collection('entries')
      .add(transactionData);

    return {
      success: true,
      docId: docRef.id
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 解析快速輸入
 */
function BK_parseQuickInput(input) {
  const trimmedInput = input.trim();
  
  // 簡單的解析邏輯：查找數字
  const numberMatch = trimmedInput.match(/\d+/);
  if (!numberMatch) {
    return { success: false, error: "未找到金額" };
  }

  const amount = parseInt(numberMatch[0]);
  const description = trimmedInput.replace(/\d+/g, '').trim() || "快速記帳";
  
  return {
    success: true,
    amount: amount,
    type: 'expense', // 預設為支出
    description: description
  };
}

/**
 * 計算交易統計
 */
function BK_calculateTransactionStats(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(transaction => {
    if (transaction.type === 'income') {
      totalIncome += transaction.amount;
    } else {
      totalExpense += transaction.amount;
    }
  });

  return {
    totalIncome,
    totalExpense,
    count: transactions.length
  };
}

/**
 * 日誌功能（簡化版）
 */
function BK_logInfo(message, operationType, userId, functionName) {
  console.log(`[INFO] [BK] ${message} | ${operationType} | ${userId} | ${functionName}`);
}

function BK_logError(message, operationType, userId, errorCode, errorDetails, functionName) {
  console.error(`[ERROR] [BK] ${message} | ${operationType} | ${userId} | ${errorCode} | ${functionName}`);
}

function BK_logWarning(message, operationType, userId, functionName) {
  console.warn(`[WARN] [BK] ${message} | ${operationType} | ${userId} | ${functionName}`);
}

function BK_logCritical(message, operationType, userId, errorCode, errorDetails, functionName) {
  console.error(`[CRITICAL] [BK] ${message} | ${operationType} | ${userId} | ${errorCode} | ${functionName}`);
}

// 導出模組 - 階段一的8個核心函數
module.exports = {
  // 階段一：核心架構重建與基礎功能 (8個函數)
  BK_initialize,                    // 01. 模組初始化與配置管理
  BK_initializeFirebase,           // 02. Firebase連接初始化  
  BK_createTransaction,            // 03. 新增交易記錄 - 支援 POST /transactions
  BK_processQuickTransaction,      // 04. 快速記帳處理 - 支援 POST /transactions/quick
  BK_getTransactions,              // 05. 查詢交易列表 - 支援 GET /transactions
  BK_getDashboardData,             // 06. 查詢儀表板數據 - 支援 GET /transactions/dashboard
  BK_updateTransaction,            // 07. 更新交易記錄 - 支援 PUT /transactions/{id}
  BK_deleteTransaction,            // 08. 刪除交易記錄 - 支援 DELETE /transactions/{id}
  
  // 版本資訊
  BK_VERSION: BK_CONFIG.VERSION,
  BK_API_ENDPOINTS: BK_CONFIG.API_ENDPOINTS
};
