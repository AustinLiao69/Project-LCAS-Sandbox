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

// 配置參數
const BK_CONFIG = {
  DEBUG: true,                            // 調試模式開關
  LOG_LEVEL: "DEBUG",                     // 日誌級別
  FIRESTORE_ENABLED: getEnvVar('FIRESTORE_ENABLED') || 'true',
  DEFAULT_LEDGER_ID: getEnvVar('DEFAULT_LEDGER_ID') || 'ledger_structure_001',
  TIMEZONE: "Asia/Taipei",                // 時區設置
  INITIALIZATION_INTERVAL: 300000,        // 初始化間隔(毫秒)
  VERSION: "2.2.0",                       // 模組版本
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

// === 階段二：API端點輔助與驗證函數 ===

/**
 * 09. 記帳數據驗證 - 支援所有交易相關端點
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段二重構 - 完整交易數據驗證機制
 */
function BK_validateTransactionData(data) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_validateTransactionData:`;

  try {
    // 必要欄位驗證
    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
      return { 
        success: false, 
        error: "金額必須是大於0的數字",
        errorType: "AMOUNT_INVALID"
      };
    }

    if (!data.type || !['income', 'expense'].includes(data.type)) {
      return { 
        success: false, 
        error: "交易類型必須是income或expense",
        errorType: "TYPE_INVALID"
      };
    }

    // 金額範圍驗證
    if (data.amount > 999999999) {
      return {
        success: false,
        error: "金額不能超過999,999,999",
        errorType: "AMOUNT_TOO_LARGE"
      };
    }

    // 描述長度驗證
    if (data.description && data.description.length > 200) {
      return {
        success: false,
        error: "備註不能超過200個字元",
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
    if (data.userId && !/^U[a-fA-F0-9]{32}$/.test(data.userId)) {
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
        paymentMethod: data.paymentMethod || "現金",
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段二重構 - 強化交易ID生成演算法
 */
async function BK_generateTransactionId(processId) {
  const logPrefix = `[${processId}] BK_generateTransactionId:`;

  try {
    const now = moment().tz(BK_CONFIG.TIMEZONE);
    const dateStr = now.format("YYYYMMDD");
    const timeStr = now.format("HHmmss");
    const millisStr = now.format("SSS");

    // 生成隨機後綴
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

    // 組合交易ID：日期-時間-毫秒-隨機碼
    const transactionId = `${dateStr}-${timeStr}${millisStr}-${randomSuffix}`;

    // 檢查ID唯一性
    const uniqueCheck = await BK_checkTransactionIdUnique(transactionId);
    if (!uniqueCheck.success) {
      // 如果重複，重新生成
      const fallbackId = `${dateStr}-${Date.now().toString().slice(-8)}-${randomSuffix}`;
      BK_logWarning(`${logPrefix} 交易ID重複，使用備用ID: ${fallbackId}`, "ID生成", "", "BK_generateTransactionId");
      return fallbackId;
    }

    BK_logInfo(`${logPrefix} 交易ID生成成功: ${transactionId}`, "ID生成", "", "BK_generateTransactionId");
    return transactionId;

  } catch (error) {
    BK_logError(`${logPrefix} 交易ID生成失敗: ${error.toString()}`, "ID生成", "", "ID_GENERATION_ERROR", error.toString(), "BK_generateTransactionId");

    // 降級方案：使用時間戳
    const fallbackId = `${moment().tz(BK_CONFIG.TIMEZONE).format("YYYYMMDD")}-${Date.now()}`;
    return fallbackId;
  }
}

/**
 * 11. 支付方式驗證 - 支援所有交易端點
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段二重構 - 完整支付方式驗證
 */
function BK_validatePaymentMethod(paymentMethod) {
  const validMethods = [
    '現金', '刷卡', '轉帳', '行動支付', 
    'LINE Pay', '街口支付', '悠遊卡', '一卡通',
    '信用卡', '金融卡', '支票', '其他'
  ];

  if (!paymentMethod || typeof paymentMethod !== 'string') {
    return {
      success: false,
      error: "支付方式不能為空",
      validMethods: validMethods
    };
  }

  const trimmedMethod = paymentMethod.trim();

  if (!validMethods.includes(trimmedMethod)) {
    return {
      success: false,
      error: `不支援的支付方式: ${trimmedMethod}`,
      validMethods: validMethods
    };
  }

  return {
    success: true,
    paymentMethod: trimmedMethod
  };
}

/**
 * 12. 統計數據生成 - 支援GET /transactions/dashboard
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段二重構 - 強化儀表板統計功能
 */
function BK_generateStatistics(transactions, period = 'month') {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_generateStatistics:`;

  try {
    if (!Array.isArray(transactions)) {
      transactions = [];
    }

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
      const category = transaction.category || '其他';
      const paymentMethod = transaction.paymentMethod || '現金';
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
 * @version 2025-09-16-V2.2.0
 * @date 2025-09-16 
 * @update: 階段一重構完成 - 強化查詢過濾功能
 */
function BK_buildTransactionQuery(queryParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_buildTransactionQuery:`;

  try {
    let query = BK_INIT_STATUS.firestore_db
      .collection('ledgers')
      .doc(queryParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID)
      .collection('entries');

    const appliedFilters = [];

    // 用戶過濾
    if (queryParams.userId) {
      query = query.where('UID', '==', queryParams.userId);
      appliedFilters.push(`userId: ${queryParams.userId}`);
    }

    // 日期範圍過濾
    if (queryParams.startDate) {
      query = query.where('日期', '>=', queryParams.startDate);
      appliedFilters.push(`startDate: ${queryParams.startDate}`);
    }

    if (queryParams.endDate) {
      query = query.where('日期', '<=', queryParams.endDate);
      appliedFilters.push(`endDate: ${queryParams.endDate}`);
    }

    // 交易類型過濾
    if (queryParams.type) {
      if (queryParams.type === 'income') {
        query = query.where('收入', '>', 0);
      } else if (queryParams.type === 'expense') {
        query = query.where('支出', '>', 0);
      }
      appliedFilters.push(`type: ${queryParams.type}`);
    }

    // 金額範圍過濾
    if (queryParams.minAmount || queryParams.maxAmount) {
      // Firestore 複合查詢限制，這部分需要在結果中進行後處理
      appliedFilters.push(`amount range: ${queryParams.minAmount || '0'} - ${queryParams.maxAmount || '∞'}`);
    }

    // 支付方式過濾
    if (queryParams.paymentMethod) {
      query = query.where('支付方式', '==', queryParams.paymentMethod);
      appliedFilters.push(`paymentMethod: ${queryParams.paymentMethod}`);
    }

    // 排序
    const orderField = queryParams.orderBy || '日期';
    const orderDirection = queryParams.orderDirection || 'desc';

    // 確保至少有一個排序字段
    if (!orderField) {
        query = query.orderBy('日期', 'desc');
    } else {
        query = query.orderBy(orderField, orderDirection);
        // 如果排序欄位不是時間，且時間欄位存在，則也按時間排序
        if (orderField !== '時間') {
            query = query.orderBy('時間', orderDirection);
        }
    }

    // 分頁限制
    if (queryParams.limit) {
      const limit = Math.min(parseInt(queryParams.limit), 1000); // 最大1000筆
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段二重構 - 統一錯誤處理機制
 */
function BK_handleError(error, context = {}) {
  const processId = context.processId || require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_handleError:`;

  try {
    // 錯誤分類
    const errorTypes = {
      'VALIDATION_ERROR': { severity: 'WARNING', httpCode: 400 },
      'NOT_FOUND': { severity: 'INFO', httpCode: 404 },
      'STORAGE_ERROR': { severity: 'ERROR', httpCode: 500 },
      'FIREBASE_ERROR': { severity: 'ERROR', httpCode: 503 },
      'AUTHENTICATION_ERROR': { severity: 'WARNING', httpCode: 401 },
      'AUTHORIZATION_ERROR': { severity: 'WARNING', httpCode: 403 },
      'RATE_LIMIT_ERROR': { severity: 'WARNING', httpCode: 429 },
      'PROCESS_ERROR': { severity: 'ERROR', httpCode: 500 },
      'UNKNOWN_ERROR': { severity: 'ERROR', httpCode: 500 }
    };

    const errorInfo = errorTypes[error.errorType] || errorTypes['UNKNOWN_ERROR'];

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
    if (process.env.NODE_ENV === 'production') {
      delete errorResponse.stack;
      if (errorInfo.severity === 'ERROR') {
        errorResponse.error = "系統發生錯誤，請稍後再試";
      }
    }

    return errorResponse;

  } catch (handlingError) {
    // 錯誤處理本身發生錯誤
    BK_logCritical(`${logPrefix} 錯誤處理失敗: ${handlingError.toString()}`, "錯誤處理", context.userId || "", "ERROR_HANDLING_FAILED", handlingError.toString(), "BK_handleError");

    return {
      success: false,
      error: "系統錯誤處理失敗",
      errorType: "ERROR_HANDLING_FAILED",
      httpCode: 500,
      timestamp: new Date().toISOString(),
      processId: processId
    };
  }
}

// === 階段三：API整合優化函數 ===

/**
 * 15. API響應格式標準化 - 支援所有端點
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段三重構 - 統一API響應格式，提升用戶體驗
 */
function BK_formatAPIResponse(data, operation = '', success = true, metadata = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_formatAPIResponse:`;

  try {
    const responseFormat = {
      success: success,
      timestamp: new Date().toISOString(),
      operation: operation,
      data: success ? data : null,
      error: success ? null : data,
      metadata: {
        version: BK_CONFIG.VERSION,
        processId: processId,
        userMode: metadata.userMode || 'Expert',
        endpoint: metadata.endpoint || '',
        executionTime: metadata.executionTime || 0,
        ...metadata
      }
    };

    // 根據操作類型添加特定格式化
    switch (operation) {
      case 'createTransaction':
        if (success && data) {
          responseFormat.metadata.transactionCreated = true;
          responseFormat.metadata.amount = data.amount;
          responseFormat.metadata.type = data.type;
        }
        break;

      case 'getTransactions':
        if (success && data) {
          responseFormat.metadata.totalResults = data.transactions?.length || 0;
          responseFormat.metadata.pagination = {
            page: data.page || 1,
            limit: data.limit || 20,
            hasMore: data.transactions?.length === data.limit
          };
        }
        break;

      case 'getDashboard':
        if (success && data) {
          responseFormat.metadata.dashboardGenerated = true;
          responseFormat.metadata.summaryIncluded = !!data.summary;
          responseFormat.metadata.recentTransactionsCount = data.recentTransactions?.length || 0;
        }
        break;

      case 'quickBooking':
        if (success && data) {
          responseFormat.metadata.parsedInput = !!data.parsed;
          responseFormat.metadata.autoConfirmation = !!data.confirmation;
        }
        break;

      case 'updateTransaction':
      case 'deleteTransaction':
        if (success) {
          responseFormat.metadata.operationCompleted = true;
          responseFormat.metadata.affectedTransactionId = data?.transactionId;
        }
        break;
    }

    // 錯誤格式化增強
    if (!success) {
      responseFormat.error = {
        message: typeof data === 'string' ? data : data?.message || data?.error || 'Unknown error',
        code: data?.errorType || data?.code || 'UNKNOWN_ERROR',
        details: data?.details || null
      };

      // 用戶友善錯誤訊息
      responseFormat.userMessage = BK_getUserFriendlyErrorMessage(responseFormat.error.code);
    }

    BK_logInfo(`${logPrefix} API響應格式化完成 - ${operation}`, "響應格式化", metadata.userId || "", "BK_formatAPIResponse");

    return responseFormat;

  } catch (error) {
    BK_logError(`${logPrefix} API響應格式化失敗: ${error.toString()}`, "響應格式化", metadata.userId || "", "FORMAT_ERROR", error.toString(), "BK_formatAPIResponse");

    // 降級回應
    return {
      success: false,
      timestamp: new Date().toISOString(),
      operation: operation,
      data: null,
      error: {
        message: "響應格式化失敗",
        code: "FORMAT_ERROR",
        details: error.toString()
      },
      metadata: {
        version: BK_CONFIG.VERSION,
        processId: processId,
        formatError: true
      }
    };
  }
}

/**
 * 16. 四模式差異化處理 - 支援所有端點
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段三重構 - 根據使用者模式調整處理邏輯和回應內容
 */
function BK_processFourModeData(baseData, userMode = 'Expert', operation = '') {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processFourModeData:`;

  try {
    const supportedModes = ['Expert', 'Inertial', 'Cultivation', 'Guiding'];

    if (!supportedModes.includes(userMode)) {
      userMode = 'Expert'; // 預設模式
      BK_logWarning(`${logPrefix} 無效的使用者模式，使用預設Expert模式`, "模式處理", "", "BK_processFourModeData");
    }

    let processedData = JSON.parse(JSON.stringify(baseData)); // 深拷貝

    // 根據模式調整資料處理
    switch (userMode) {
      case 'Expert':
        // 專家模式：提供完整詳細資訊
        processedData = BK_processExpertModeData(processedData, operation);
        break;

      case 'Inertial':
        // 慣性模式：簡化介面，突出常用功能
        processedData = BK_processInertialModeData(processedData, operation);
        break;

      case 'Cultivation':
        // 培養模式：教育性引導，提供學習資源
        processedData = BK_processCultivationModeData(processedData, operation);
        break;

      case 'Guiding':
        // 引導模式：步驟式引導，簡化複雜操作
        processedData = BK_processGuidingModeData(processedData, operation);
        break;
    }

    // 添加模式特定的元數據
    processedData.modeMetadata = {
      userMode: userMode,
      processingApplied: true,
      recommendations: BK_getModeSpecificRecommendations(userMode, operation),
      nextSuggestions: BK_getModeSpecificNextSteps(userMode, operation)
    };

    BK_logInfo(`${logPrefix} ${userMode}模式資料處理完成 - ${operation}`, "模式處理", "", "BK_processFourModeData");

    return processedData;

  } catch (error) {
    BK_logError(`${logPrefix} 模式資料處理失敗: ${error.toString()}`, "模式處理", "", "MODE_PROCESS_ERROR", error.toString(), "BK_processFourModeData");

    // 回退到原始資料
    return {
      ...baseData,
      modeMetadata: {
        userMode: userMode,
        processingApplied: false,
        error: "模式處理失敗",
        fallbackUsed: true
      }
    };
  }
}

/**
 * 17. 批次操作優化 - 增強 POST /transactions
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段三重構 - 優化批次交易處理，提升效能
 */
async function BK_optimizeBatchOperations(transactions, options = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_optimizeBatchOperations:`;

  try {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return {
        success: true,
        data: {
          processed: 0,
          successful: 0,
          failed: 0,
          results: []
        }
      };
    }

    BK_logInfo(`${logPrefix} 開始批次操作，共${transactions.length}筆交易`, "批次操作", options.userId || "", "BK_optimizeBatchOperations");

    const batchSize = options.batchSize || 10; // 預設批次大小
    const maxConcurrency = options.maxConcurrency || 5; // 最大併發數
    const results = [];
    let successful = 0;
    let failed = 0;

    // 將交易分組處理
    const batches = [];
    for (let i = 0; i < transactions.length; i += batchSize) {
      batches.push(transactions.slice(i, i + batchSize));
    }

    // 批次驗證
    const validationResults = await BK_validateBatchTransactions(transactions);
    if (validationResults.hasErrors) {
      BK_logWarning(`${logPrefix} 批次驗證發現${validationResults.errorCount}個錯誤`, "批次操作", options.userId || "", "BK_optimizeBatchOperations");
    }

    // 併發處理批次
    const batchPromises = batches.map(async (batch, batchIndex) => {
      const batchResults = [];

      try {
        // 準備批次資料
        const preparedBatch = await BK_prepareBatchData(batch, processId);

        // 批次執行
        const batchOperations = preparedBatch.map(async (transaction) => {
          try {
            const result = await BK_createTransaction({
              ...transaction,
              processId: processId,
              batchId: `${processId}-${batchIndex}`
            });

            if (result.success) {
              successful++;
            } else {
              failed++;
            }

            return {
              originalIndex: transaction.originalIndex,
              success: result.success,
              data: result.data,
              error: result.error
            };
          } catch (error) {
            failed++;
            return {
              originalIndex: transaction.originalIndex,
              success: false,
              error: error.toString()
            };
          }
        });

        const batchResults = await Promise.allSettled(batchOperations);
        return batchResults.map(result => result.value || result.reason);

      } catch (batchError) {
        BK_logError(`${logPrefix} 批次${batchIndex}處理失敗: ${batchError.toString()}`, "批次操作", options.userId || "", "BATCH_ERROR", batchError.toString(), "BK_optimizeBatchOperations");

        return batch.map((transaction, index) => ({
          originalIndex: transaction.originalIndex,
          success: false,
          error: `批次處理失敗: ${batchError.message}`
        }));
      }
    });

    // 等待所有批次完成
    const allBatchResults = await Promise.all(batchPromises);
    const flatResults = allBatchResults.flat();

    // 排序結果以保持原始順序
    flatResults.sort((a, b) => (a.originalIndex || 0) - (b.originalIndex || 0));

    const processingStats = {
      processed: transactions.length,
      successful: successful,
      failed: failed,
      successRate: (successful / transactions.length * 100).toFixed(2) + '%',
      batchCount: batches.length,
      avgBatchSize: (transactions.length / batches.length).toFixed(1)
    };

    BK_logInfo(`${logPrefix} 批次操作完成 - 成功率: ${processingStats.successRate}`, "批次操作", options.userId || "", "BK_optimizeBatchOperations");

    return {
      success: true,
      data: {
        ...processingStats,
        results: flatResults,
        metadata: {
          processId: processId,
          executionTime: Date.now() - parseInt(processId, 16), // 簡化時間計算
          optimizationApplied: true,
          batchConfiguration: {
            batchSize: batchSize,
            maxConcurrency: maxConcurrency,
            totalBatches: batches.length
          }
        }
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 批次操作優化失敗: ${error.toString()}`, "批次操作", options.userId || "", "BATCH_OPTIMIZATION_ERROR", error.toString(), "BK_optimizeBatchOperations");

    return {
      success: false,
      error: error.toString(),
      errorType: "BATCH_OPTIMIZATION_ERROR"
    };
  }
}

/**
 * 18. 記帳處理核心函數 - 新增缺失函數
 * @version 2025-09-18-V2.2.0
 * @date 2025-09-18 
 * @update: 新增BK_processBookkeeping函數以修復依賴問題
 */
async function BK_processBookkeeping(inputData, options = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processBookkeeping:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理記帳請求`, "記帳處理", inputData.userId || "", "BK_processBookkeeping");

    // 驗證輸入數據
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
      paymentMethod: inputData.paymentMethod || '現金',
      processId: processId
    };

    // 調用新的交易創建函數
    const result = await BK_createTransaction(transactionData);

    if (result.success) {
      BK_logInfo(`${logPrefix} 記帳處理成功: ${result.data.transactionId}`, "記帳處理", inputData.userId || "", "BK_processBookkeeping");

      // 返回兼容格式
      return {
        success: true,
        data: result.data,
        responseMessage: `記帳成功！金額：${transactionData.amount}元，科目：${transactionData.description}`,
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
 * 19. 快速記帳輸入解析 - 修復函數導出
 * @version 2025-01-28-V2.1.1
 * @date 2025-01-28 
 * @update: 修復BK_parseQuickInput函數缺失問題
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
      const incomeKeywords = ['薪水', '收入', '獎金', '紅利'];
      const isIncome = incomeKeywords.some(keyword => subject.includes(keyword));

      // 判斷支付方式
      let paymentMethod = "現金";
      const paymentMethods = ["現金", "刷卡", "轉帳", "行動支付"];
      for (const method of paymentMethods) {
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
 * 19. 快速記帳智能解析 - 增強 POST /transactions/quick
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段三重構 - 增強快速記帳解析能力，支援更多自然語言格式
 */
function BK_enhanceQuickBookingParsing(inputText, options = {}) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_enhanceQuickBookingParsing:`;

  try {
    if (!inputText || typeof inputText !== 'string') {
      return {
        success: false,
        error: "輸入文字不能為空",
        errorType: "INVALID_INPUT"
      };
    }

    const trimmedInput = inputText.trim();
    BK_logInfo(`${logPrefix} 開始智能解析: "${trimmedInput}"`, "智能解析", options.userId || "", "BK_enhanceQuickBookingParsing");

    // 多層解析策略
    const parsingStrategies = [
      BK_parseStandardFormat,        // 標準格式：午餐100現金
      BK_parseNaturalLanguage,       // 自然語言：今天中午吃飯花了一百塊
      BK_parseNumberFirstFormat,     // 數字優先：100午餐現金
      BK_parseKeywordBasedFormat,    // 關鍵詞：收入薪水50000轉帳
      BK_parseFallbackFormat         // 備用解析
    ];

    let bestResult = null;
    let bestConfidence = 0;

    // 嘗試所有解析策略
    for (const strategy of parsingStrategies) {
      try {
        const result = strategy(trimmedInput, options);

        if (result.success && result.confidence > bestConfidence) {
          bestResult = result;
          bestConfidence = result.confidence;

          // 如果置信度很高，直接使用
          if (result.confidence >= 0.9) {
            break;
          }
        }
      } catch (strategyError) {
        BK_logWarning(`${logPrefix} 解析策略失敗: ${strategy.name} - ${strategyError.message}`, "智能解析", options.userId || "", "BK_enhanceQuickBookingParsing");
      }
    }

    if (!bestResult || bestResult.confidence < 0.3) {
      return {
        success: false,
        error: "無法解析輸入內容",
        errorType: "PARSE_FAILED",
        suggestions: BK_getParsingHelp()
      };
    }

    // 增強解析結果
    const enhancedResult = BK_enhanceParsingResult(bestResult, trimmedInput, options);

    // 添加智能建議
    enhancedResult.smartSuggestions = BK_generateSmartSuggestions(enhancedResult, options);

    // 添加置信度評估
    enhancedResult.confidenceLevel = BK_getConfidenceLevel(enhancedResult.confidence);

    BK_logInfo(`${logPrefix} 智能解析完成，置信度: ${enhancedResult.confidence.toFixed(2)}`, "智能解析", options.userId || "", "BK_enhanceQuickBookingParsing");

    return {
      success: true,
      data: enhancedResult,
      metadata: {
        originalInput: trimmedInput,
        parsingStrategy: bestResult.strategy || 'unknown',
        processingTime: Date.now() - parseInt(processId, 16), // 簡化時間計算
        enhancementsApplied: true
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 智能解析失敗: ${error.toString()}`, "智能解析", options.userId || "", "ENHANCED_PARSING_ERROR", error.toString(), "BK_enhanceQuickBookingParsing");

    return {
      success: false,
      error: error.toString(),
      errorType: "ENHANCED_PARSING_ERROR",
      fallbackSuggestion: "請使用格式：[科目][金額][支付方式]，例如：午餐100現金"
    };
  }
}

/**
 * =============== DCN-0012 階段二：補充API端點處理函數 ===============
 * 基於P1-2範圍，補充缺失的記帳交易API端點處理函數
 */

/**
 * 20. 處理新增交易API - POST /api/v1/transactions
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的新增交易請求，替代原BK_createTransaction
 */
async function BK_processAPITransaction(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPITransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理新增交易API請求`, "API新增交易", requestData.userId || "", "BK_processAPITransaction");

    // 調用現有的創建交易函數
    const result = await BK_createTransaction({
      ...requestData,
      processId: processId
    });

    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: result.message || "交易新增成功"
      };
    } else {
      return {
        success: false,
        message: result.error || "交易新增失敗",
        errorCode: result.errorType || "TRANSACTION_CREATE_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 新增交易API處理失敗: ${error.toString()}`, "API新增交易", requestData.userId || "", "API_TRANSACTION_ERROR", error.toString(), "BK_processAPITransaction");
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 21. 處理快速記帳API - POST /api/v1/transactions/quick
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的快速記帳請求，替代原BK_processQuickTransaction
 */
async function BK_processAPIQuickTransaction(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIQuickTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理快速記帳API請求`, "API快速記帳", requestData.userId || "", "BK_processAPIQuickTransaction");

    // 調用現有的快速記帳函數
    const result = await BK_processQuickTransaction({
      ...requestData,
      processId: processId
    });

    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: result.message || "快速記帳成功"
      };
    } else {
      return {
        success: false,
        message: result.error || "快速記帳失敗",
        errorCode: result.errorType || "QUICK_TRANSACTION_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 快速記帳API處理失敗: ${error.toString()}`, "API快速記帳", requestData.userId || "", "API_QUICK_TRANSACTION_ERROR", error.toString(), "BK_processAPIQuickTransaction");
    return {
      success: false,
      message: "快速記帳失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 22. 處理查詢交易API - GET /api/v1/transactions
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的查詢交易請求，替代原BK_getTransactions
 */
async function BK_processAPIGetTransactions(queryParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetTransactions:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理查詢交易API請求`, "API查詢交易", queryParams.userId || "", "BK_processAPIGetTransactions");

    // 調用現有的查詢交易函數
    const result = await BK_getTransactions(queryParams);

    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: result.message || "交易查詢成功"
      };
    } else {
      return {
        success: false,
        message: result.error || "交易查詢失敗",
        errorCode: result.errorType || "TRANSACTION_QUERY_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 查詢交易API處理失敗: ${error.toString()}`, "API查詢交易", queryParams.userId || "", "API_GET_TRANSACTIONS_ERROR", error.toString(), "BK_processAPIGetTransactions");
    return {
      success: false,
      message: "交易查詢失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 23. 處理交易詳情API - GET /api/v1/transactions/{id}
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的交易詳情查詢請求
 */
async function BK_processAPIGetTransactionDetail(requestParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetTransactionDetail:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理交易詳情API請求: ${requestParams.id}`, "API交易詳情", requestParams.userId || "", "BK_processAPIGetTransactionDetail");

    if (!requestParams.id) {
      return {
        success: false,
        message: "交易ID為必填參數",
        errorCode: "MISSING_TRANSACTION_ID"
      };
    }

    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    // 查詢特定交易
    const ledgerId = requestParams.ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
    const querySnapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('entries')
      .where('收支ID', '==', requestParams.id)
      .get();

    if (querySnapshot.empty) {
      return {
        success: false,
        message: "交易記錄不存在",
        errorCode: "TRANSACTION_NOT_FOUND"
      };
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();

    const transactionDetail = {
      id: data.收支ID,
      amount: parseFloat(data.收入 || data.支出 || 0),
      type: data.收入 ? 'income' : 'expense',
      date: data.日期,
      time: data.時間,
      description: data.備註,
      category: data.子項名稱,
      majorCode: data.大項代碼,
      minorCode: data.子項代碼,
      paymentMethod: data.支付方式,
      userId: data.UID,
      ledgerId: ledgerId,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null
    };

    BK_logInfo(`${logPrefix} 交易詳情查詢成功: ${requestParams.id}`, "API交易詳情", requestParams.userId || "", "BK_processAPIGetTransactionDetail");

    return {
      success: true,
      data: {
        transaction: transactionDetail
      },
      message: "交易詳情查詢成功"
    };

  } catch (error) {
    BK_logError(`${logPrefix} 交易詳情API處理失敗: ${error.toString()}`, "API交易詳情", requestParams.userId || "", "API_GET_TRANSACTION_DETAIL_ERROR", error.toString(), "BK_processAPIGetTransactionDetail");
    return {
      success: false,
      message: "交易詳情查詢失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 24. 處理更新交易API - PUT /api/v1/transactions/{id}
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的更新交易請求，替代原BK_updateTransaction
 */
async function BK_processAPIUpdateTransaction(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIUpdateTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理更新交易API請求: ${requestData.id}`, "API更新交易", requestData.userId || "", "BK_processAPIUpdateTransaction");

    if (!requestData.id) {
      return {
        success: false,
        message: "交易ID為必填參數",
        errorCode: "MISSING_TRANSACTION_ID"
      };
    }

    // 調用現有的更新交易函數
    const result = await BK_updateTransaction(requestData.id, requestData);

    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: result.message || "交易更新成功"
      };
    } else {
      return {
        success: false,
        message: result.error || "交易更新失敗",
        errorCode: result.errorType || "TRANSACTION_UPDATE_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 更新交易API處理失敗: ${error.toString()}`, "API更新交易", requestData.userId || "", "API_UPDATE_TRANSACTION_ERROR", error.toString(), "BK_processAPIUpdateTransaction");
    return {
      success: false,
      message: "交易更新失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 25. 處理刪除交易API - DELETE /api/v1/transactions/{id}
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的刪除交易請求，替代原BK_deleteTransaction
 */
async function BK_processAPIDeleteTransaction(requestParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIDeleteTransaction:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理刪除交易API請求: ${requestParams.id}`, "API刪除交易", requestParams.userId || "", "BK_processAPIDeleteTransaction");

    if (!requestParams.id) {
      return {
        success: false,
        message: "交易ID為必填參數",
        errorCode: "MISSING_TRANSACTION_ID"
      };
    }

    // 調用現有的刪除交易函數
    const result = await BK_deleteTransaction(requestParams.id, requestParams);

    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: result.message || "交易刪除成功"
      };
    } else {
      return {
        success: false,
        message: result.error || "交易刪除失敗",
        errorCode: result.errorType || "TRANSACTION_DELETE_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 刪除交易API處理失敗: ${error.toString()}`, "API刪除交易", requestParams.userId || "", "API_DELETE_TRANSACTION_ERROR", error.toString(), "BK_processAPIDeleteTransaction");
    return {
      success: false,
      message: "交易刪除失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 26. 處理儀表板API - GET /api/v1/transactions/dashboard
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的儀表板查詢請求，替代原BK_getDashboardData
 */
async function BK_processAPIGetDashboard(queryParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetDashboard:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理儀表板API請求`, "API儀表板", queryParams.userId || "", "BK_processAPIGetDashboard");

    // 調用現有的儀表板函數
    const result = await BK_getDashboardData(queryParams);

    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: result.message || "儀表板數據查詢成功"
      };
    } else {
      return {
        success: false,
        message: result.error || "儀表板數據查詢失敗",
        errorCode: result.errorType || "DASHBOARD_QUERY_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 儀表板API處理失敗: ${error.toString()}`, "API儀表板", queryParams.userId || "", "API_GET_DASHBOARD_ERROR", error.toString(), "BK_processAPIGetDashboard");
    return {
      success: false,
      message: "儀表板數據查詢失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 27. 處理統計數據API - GET /api/v1/transactions/statistics
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的統計數據查詢請求
 */
async function BK_processAPIGetStatistics(queryParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetStatistics:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理統計數據API請求`, "API統計數據", queryParams.userId || "", "BK_processAPIGetStatistics");

    // 查詢交易數據
    const transactionsResult = await BK_getTransactions(queryParams);

    if (!transactionsResult.success) {
      return {
        success: false,
        message: "無法取得交易數據",
        errorCode: "TRANSACTION_QUERY_FAILED"
      };
    }

    // 生成統計
    const statsResult = BK_generateStatistics(transactionsResult.data.transactions || [], queryParams.period || 'month');

    if (statsResult.success) {
      return {
        success: true,
        data: statsResult.data,
        message: "統計數據查詢成功"
      };
    } else {
      return {
        success: false,
        message: "統計數據生成失敗",
        errorCode: "STATISTICS_GENERATION_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 統計數據API處理失敗: ${error.toString()}`, "API統計數據", queryParams.userId || "", "API_GET_STATISTICS_ERROR", error.toString(), "BK_processAPIGetStatistics");
    return {
      success: false,
      message: "統計數據查詢失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 28. 處理最近交易API - GET /api/v1/transactions/recent
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的最近交易查詢請求
 */
async function BK_processAPIGetRecent(queryParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetRecent:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理最近交易API請求`, "API最近交易", queryParams.userId || "", "BK_processAPIGetRecent");

    // 設定查詢參數：最近的交易
    const recentQueryParams = {
      ...queryParams,
      limit: queryParams.limit || 20,
      orderBy: '日期',
      orderDirection: 'desc'
    };

    // 調用查詢交易函數
    const result = await BK_getTransactions(recentQueryParams);

    if (result.success) {
      return {
        success: true,
        data: {
          recentTransactions: result.data.transactions,
          total: result.data.total,
          limit: recentQueryParams.limit
        },
        message: "最近交易查詢成功"
      };
    } else {
      return {
        success: false,
        message: result.error || "最近交易查詢失敗",
        errorCode: result.errorType || "RECENT_TRANSACTIONS_QUERY_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 最近交易API處理失敗: ${error.toString()}`, "API最近交易", queryParams.userId || "", "API_GET_RECENT_ERROR", error.toString(), "BK_processAPIGetRecent");
    return {
      success: false,
      message: "最近交易查詢失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 29. 處理圖表數據API - GET /api/v1/transactions/charts
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的圖表數據查詢請求
 */
async function BK_processAPIGetCharts(queryParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIGetCharts:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理圖表數據API請求`, "API圖表數據", queryParams.userId || "", "BK_processAPIGetCharts");

    // 查詢交易數據
    const transactionsResult = await BK_getTransactions(queryParams);

    if (!transactionsResult.success) {
      return {
        success: false,
        message: "無法取得交易數據",
        errorCode: "TRANSACTION_QUERY_FAILED"
      };
    }

    const transactions = transactionsResult.data.transactions || [];

    // 生成圖表所需的數據格式
    const chartData = {
      pieChart: {
        categories: {},
        total: 0
      },
      lineChart: {
        daily: {},
        monthly: {}
      },
      barChart: {
        incomeVsExpense: {
          income: 0,
          expense: 0
        }
      }
    };

    // 處理交易數據生成圖表格式
    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      const category = transaction.category || '其他';
      const date = transaction.date || '';

      // 圓餅圖：支出分類
      if (transaction.type === 'expense') {
        chartData.pieChart.categories[category] = (chartData.pieChart.categories[category] || 0) + amount;
        chartData.pieChart.total += amount;
      }

      // 折線圖：每日趨勢
      if (date) {
        if (!chartData.lineChart.daily[date]) {
          chartData.lineChart.daily[date] = { income: 0, expense: 0 };
        }
        chartData.lineChart.daily[date][transaction.type] += amount;
      }

      // 長條圖：收入vs支出
      chartData.barChart.incomeVsExpense[transaction.type] += amount;
    });

    BK_logInfo(`${logPrefix} 圖表數據生成成功`, "API圖表數據", queryParams.userId || "", "BK_processAPIGetCharts");

    return {
      success: true,
      data: {
        charts: chartData,
        dataPoints: transactions.length,
        period: queryParams.period || 'month'
      },
      message: "圖表數據查詢成功"
    };

  } catch (error) {
    BK_logError(`${logPrefix} 圖表數據API處理失敗: ${error.toString()}`, "API圖表數據", queryParams.userId || "", "API_GET_CHARTS_ERROR", error.toString(), "BK_processAPIGetCharts");
    return {
      success: false,
      message: "圖表數據查詢失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 30. 處理批量新增API - POST /api/v1/transactions/batch
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的批量新增交易請求
 */
async function BK_processAPIBatchCreate(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIBatchCreate:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理批量新增API請求`, "API批量新增", requestData.userId || "", "BK_processAPIBatchCreate");

    if (!requestData.transactions || !Array.isArray(requestData.transactions)) {
      return {
        success: false,
        message: "交易列表為必填欄位且必須為陣列",
        errorCode: "INVALID_TRANSACTIONS_DATA"
      };
    }

    // 調用批量操作優化函數
    const result = await BK_optimizeBatchOperations(requestData.transactions, {
      userId: requestData.userId,
      batchSize: requestData.batchSize || 10,
      maxConcurrency: requestData.maxConcurrency || 5
    });

    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: "批量新增處理完成"
      };
    } else {
      return {
        success: false,
        message: result.error || "批量新增失敗",
        errorCode: result.errorType || "BATCH_CREATE_FAILED"
      };
    }

  } catch (error) {
    BK_logError(`${logPrefix} 批量新增API處理失敗: ${error.toString()}`, "API批量新增", requestData.userId || "", "API_BATCH_CREATE_ERROR", error.toString(), "BK_processAPIBatchCreate");
    return {
      success: false,
      message: "批量新增失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 31. 處理批量更新API - PUT /api/v1/transactions/batch
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的批量更新交易請求
 */
async function BK_processAPIBatchUpdate(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIBatchUpdate:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理批量更新API請求`, "API批量更新", requestData.userId || "", "BK_processAPIBatchUpdate");

    if (!requestData.updates || !Array.isArray(requestData.updates)) {
      return {
        success: false,
        message: "更新列表為必填欄位且必須為陣列",
        errorCode: "INVALID_UPDATES_DATA"
      };
    }

    const results = [];
    let successful = 0;
    let failed = 0;

    // 依序處理批量更新
    for (const update of requestData.updates) {
      try {
        if (!update.id) {
          results.push({
            success: false,
            id: update.id,
            error: "缺少交易ID"
          });
          failed++;
          continue;
        }

        const updateResult = await BK_updateTransaction(update.id, update);

        if (updateResult.success) {
          successful++;
          results.push({
            success: true,
            id: update.id,
            data: updateResult.data
          });
        } else {
          failed++;
          results.push({
            success: false,
            id: update.id,
            error: updateResult.error
          });
        }
      } catch (updateError) {
        failed++;
        results.push({
          success: false,
          id: update.id,
          error: updateError.toString()
        });
      }
    }

    BK_logInfo(`${logPrefix} 批量更新完成 - 成功: ${successful}, 失敗: ${failed}`, "API批量更新", requestData.userId || "", "BK_processAPIBatchUpdate");

    return {
      success: true,
      data: {
        results: results,
        summary: {
          total: requestData.updates.length,
          successful: successful,
          failed: failed,
          successRate: ((successful / requestData.updates.length) * 100).toFixed(2) + '%'
        }
      },
      message: "批量更新處理完成"
    };

  } catch (error) {
    BK_logError(`${logPrefix} 批量更新API處理失敗: ${error.toString()}`, "API批量更新", requestData.userId || "", "API_BATCH_UPDATE_ERROR", error.toString(), "BK_processAPIBatchUpdate");
    return {
      success: false,
      message: "批量更新失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 32. 處理批量刪除API - DELETE /api/v1/transactions/batch
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的批量刪除交易請求
 */
async function BK_processAPIBatchDelete(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIBatchDelete:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理批量刪除API請求`, "API批量刪除", requestData.userId || "", "BK_processAPIBatchDelete");

    if (!requestData.transactionIds || !Array.isArray(requestData.transactionIds)) {
      return {
        success: false,
        message: "交易ID列表為必填欄位且必須為陣列",
        errorCode: "INVALID_TRANSACTION_IDS"
      };
    }

    const results = [];
    let successful = 0;
    let failed = 0;

    // 依序處理批量刪除
    for (const transactionId of requestData.transactionIds) {
      try {
        const deleteResult = await BK_deleteTransaction(transactionId, { userId: requestData.userId });

        if (deleteResult.success) {
          successful++;
          results.push({
            success: true,
            id: transactionId,
            message: "刪除成功"
          });
        } else {
          failed++;
          results.push({
            success: false,
            id: transactionId,
            error: deleteResult.error
          });
        }
      } catch (deleteError) {
        failed++;
        results.push({
          success: false,
          id: transactionId,
          error: deleteError.toString()
        });
      }
    }

    BK_logInfo(`${logPrefix} 批量刪除完成 - 成功: ${successful}, 失敗: ${failed}`, "API批量刪除", requestData.userId || "", "BK_processAPIBatchDelete");

    return {
      success: true,
      data: {
        results: results,
        summary: {
          total: requestData.transactionIds.length,
          successful: successful,
          failed: failed,
          successRate: ((successful / requestData.transactionIds.length) * 100).toFixed(2) + '%'
        }
      },
      message: "批量刪除處理完成"
    };

  } catch (error) {
    BK_logError(`${logPrefix} 批量刪除API處理失敗: ${error.toString()}`, "API批量刪除", requestData.userId || "", "API_BATCH_DELETE_ERROR", error.toString(), "BK_processAPIBatchDelete");
    return {
      success: false,
      message: "批量刪除失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 33. 處理上傳附件API - POST /api/v1/transactions/{id}/attachments
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的附件上傳請求
 */
async function BK_processAPIUploadAttachment(requestData) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIUploadAttachment:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理上傳附件API請求: ${requestData.id}`, "API上傳附件", requestData.userId || "", "BK_processAPIUploadAttachment");

    if (!requestData.id) {
      return {
        success: false,
        message: "交易ID為必填參數",
        errorCode: "MISSING_TRANSACTION_ID"
      };
    }

    if (!requestData.attachment) {
      return {
        success: false,
        message: "附件數據為必填欄位",
        errorCode: "MISSING_ATTACHMENT_DATA"
      };
    }

    // 模擬附件上傳處理（實際應整合Cloud Storage）
    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // 實際專案中應該：
    // 1. 上傳檔案到Cloud Storage
    // 2. 在Firestore中記錄附件資訊
    // 3. 更新交易記錄的附件列表

    const attachmentInfo = {
      id: attachmentId,
      transactionId: requestData.id,
      fileName: requestData.attachment.fileName || 'attachment',
      fileSize: requestData.attachment.fileSize || 0,
      fileType: requestData.attachment.fileType || 'image/jpeg',
      uploadedAt: new Date().toISOString(),
      uploadedBy: requestData.userId
    };

    BK_logInfo(`${logPrefix} 附件上傳成功: ${attachmentId}`, "API上傳附件", requestData.userId || "", "BK_processAPIUploadAttachment");

    return {
      success: true,
      data: {
        attachment: attachmentInfo
      },
      message: "附件上傳成功"
    };

  } catch (error) {
    BK_logError(`${logPrefix} 上傳附件API處理失敗: ${error.toString()}`, "API上傳附件", requestData.userId || "", "API_UPLOAD_ATTACHMENT_ERROR", error.toString(), "BK_processAPIUploadAttachment");
    return {
      success: false,
      message: "附件上傳失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 34. 處理刪除附件API - DELETE /api/v1/transactions/{id}/attachments/{attachmentId}
 * @version 2025-09-22-V2.2.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的附件刪除請求
 */
async function BK_processAPIDeleteAttachment(requestParams) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processAPIDeleteAttachment:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理刪除附件API請求: ${requestParams.attachmentId}`, "API刪除附件", requestParams.userId || "", "BK_processAPIDeleteAttachment");

    if (!requestParams.id || !requestParams.attachmentId) {
      return {
        success: false,
        message: "交易ID和附件ID為必填參數",
        errorCode: "MISSING_REQUIRED_IDS"
      };
    }

    // 實際專案中應該：
    // 1. 驗證附件屬於指定交易
    // 2. 從Cloud Storage刪除檔案
    // 3. 從Firestore刪除附件記錄
    // 4. 更新交易記錄的附件列表

    BK_logInfo(`${logPrefix} 附件刪除成功: ${requestParams.attachmentId}`, "API刪除附件", requestParams.userId || "", "BK_processAPIDeleteAttachment");

    return {
      success: true,
      data: {
        message: "附件已成功刪除",
        transactionId: requestParams.id,
        attachmentId: requestParams.attachmentId
      },
      message: "附件刪除成功"
    };

  } catch (error) {
    BK_logError(`${logPrefix} 刪除附件API處理失敗: ${error.toString()}`, "API刪除附件", requestParams.userId || "", "API_DELETE_ATTACHMENT_ERROR", error.toString(), "BK_processAPIDeleteAttachment");
    return {
      success: false,
      message: "附件刪除失敗",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 新增缺失的輔助函數
 */

/**
 * 檢查交易ID唯一性
 */
async function BK_checkTransactionIdUnique(transactionId) {
  try {
    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    const querySnapshot = await db.collection('ledgers')
      .doc(BK_CONFIG.DEFAULT_LEDGER_ID)
      .collection('entries')
      .where('收支ID', '==', transactionId)
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

  return {
    收支ID: transactionId,
    UID: transactionData.userId || '',
    日期: now.format("YYYY/MM/DD"),
    時間: now.format("HH:mm:ss"),
    收入: transactionData.type === 'income' ? transactionData.amount.toString() : '',
    支出: transactionData.type === 'expense' ? transactionData.amount.toString() : '',
    備註: transactionData.description || '',
    支付方式: transactionData.paymentMethod || '現金',
    大項代碼: transactionData.majorCode || '01',
    子項代碼: transactionData.minorCode || '01',
    子項名稱: transactionData.categoryName || '其他',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    processId: processId
  };
}

/**
 * 儲存交易到Firestore
 */
async function BK_saveTransactionToFirestore(transactionData, processId) {
  try {
    await BK_initialize();
    const db = BK_INIT_STATUS.firestore_db;

    const ledgerId = BK_CONFIG.DEFAULT_LEDGER_ID;
    await db.collection('ledgers')
      .doc(ledgerId)
      .collection('entries')
      .add(transactionData);

    return { success: true };
  } catch (error) {
    BK_logError(`儲存交易失敗: ${error.toString()}`, "儲存交易", transactionData.UID || "", "SAVE_TRANSACTION_ERROR", error.toString(), "BK_saveTransactionToFirestore");
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

// === 階段三輔助函數 ===

/**
 * 取得用戶友善錯誤訊息
 */
function BK_getUserFriendlyErrorMessage(errorCode) {
  const errorMessages = {
    'VALIDATION_ERROR': '輸入資料格式不正確，請檢查後重試',
    'NOT_FOUND': '找不到相關記錄',
    'STORAGE_ERROR': '資料儲存失敗，請稍後再試',
    'FIREBASE_ERROR': '資料庫連線異常，請稍後再試',
    'PARSE_ERROR': '無法解析輸入內容，請使用標準格式',
    'PROCESS_ERROR': '處理過程發生錯誤，請聯繫客服',
    'UNKNOWN_ERROR': '發生未知錯誤，請稍後再試'
  };

  return errorMessages[errorCode] || errorMessages['UNKNOWN_ERROR'];
}

/**
 * 專家模式資料處理
 */
function BK_processExpertModeData(data, operation) {
  // 專家模式提供完整詳細資訊
  data.expertFeatures = {
    detailedMetrics: true,
    advancedFilters: true,
    rawDataAccess: true,
    performanceStats: true
  };
  return data;
}

/**
 * 慣性模式資料處理
 */
function BK_processInertialModeData(data, operation) {
  // 慣性模式簡化介面
  data.inertialFeatures = {
    quickAccess: true,
    recentItems: true,
    simplifiedUI: true,
    commonActions: true
  };
  return data;
}

/**
 * 培養模式資料處理
 */
function BK_processCultivationModeData(data, operation) {
  // 培養模式提供教育性內容
  data.cultivationFeatures = {
    learningTips: true,
    tutorials: true,
    progressTracking: true,
    educationalContent: true
  };
  return data;
}

/**
 * 引導模式資料處理
 */
function BK_processGuidingModeData(data, operation) {
  // 引導模式提供步驟式指導
  data.guidingFeatures = {
    stepByStep: true,
    wizardInterface: true,
    contextualHelp: true,
    progressIndicator: true
  };
  return data;
}

/**
 * 取得模式特定建議
 */
function BK_getModeSpecificRecommendations(userMode, operation) {
  const recommendations = {
    'Expert': ['查看詳細分析', '使用進階篩選', '匯出原始資料'],
    'Inertial': ['快速記帳', '查看最近記錄', '使用常用科目'],
    'Cultivation': ['學習記帳技巧', '查看教學影片', '了解財務概念'],
    'Guiding': ['跟隨步驟指南', '使用記帳精靈', '查看操作說明']
  };

  return recommendations[userMode] || recommendations['Expert'];
}

/**
 * 取得模式特定下一步建議
 */
function BK_getModeSpecificNextSteps(userMode, operation) {
  const nextSteps = {
    'Expert': ['分析支出趨勢', '設定預算目標', '產生詳細報表'],
    'Inertial': ['繼續記帳', '查看本月統計', '檢視支出分類'],
    'Cultivation': ['完成今日記帳挑戰', '閱讀理財文章', '參與社群討論'],
    'Guiding': ['進行下一步操作', '查看操作提示', '完成設定精靈']
  };

  return nextSteps[userMode] || nextSteps['Expert'];
}

/**
 * 驗證批次交易
 */
async function BK_validateBatchTransactions(transactions) {
  let errorCount = 0;
  const errors = [];

  transactions.forEach((transaction, index) => {
    const validation = BK_validateTransactionData(transaction);
    if (!validation.success) {
      errorCount++;
      errors.push({
        index: index,
        error: validation.error
      });
    }
  });

  return {
    hasErrors: errorCount > 0,
    errorCount: errorCount,
    errors: errors,
    validCount: transactions.length - errorCount
  };
}

/**
 * 準備批次資料
 */
async function BK_prepareBatchData(batch, processId) {
  return batch.map((item, index) => ({
    ...item,
    originalIndex: index,
    processId: processId
  }));
}

/**
 * 標準格式解析
 */
function BK_parseStandardFormat(input, options) {
  // 解析標準格式：午餐100現金
  const standardPattern = /^(.+?)(\d+(?:\.\d{1,2})?)(.*)$/;
  const match = input.match(standardPattern);

  if (match) {
    return {
      success: true,
      confidence: 0.8,
      strategy: 'standard',
      amount: parseFloat(match[2]),
      description: match[1].trim(),
      paymentMethod: match[3].trim() || '現金',
      type: 'expense'
    };
  }

  return { success: false, confidence: 0 };
}

/**
 * 自然語言解析
 */
function BK_parseNaturalLanguage(input, options) {
  // 解析自然語言：今天中午吃飯花了一百塊
  const patterns = [
    /花了?(\d+(?:\.\d{1,2})?)/,
    /(\d+(?:\.\d{1,2})?)元/,
    /收到(\d+(?:\.\d{1,2})?)/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return {
        success: true,
        confidence: 0.6,
        strategy: 'natural',
        amount: parseFloat(match[1]),
        description: input.replace(pattern, '').trim() || '記帳',
        paymentMethod: '現金',
        type: input.includes('收到') ? 'income' : 'expense'
      };
    }
  }

  return { success: false, confidence: 0 };
}

/**
 * 數字優先格式解析
 */
function BK_parseNumberFirstFormat(input, options) {
  const numberFirstPattern = /^(\d+(?:\.\d{1,2})?)(.+)$/;
  const match = input.match(numberFirstPattern);

  if (match) {
    return {
      success: true,
      confidence: 0.7,
      strategy: 'numberFirst',
      amount: parseFloat(match[1]),
      description: match[2].trim() || '記帳',
      paymentMethod: '現金',
      type: 'expense'
    };
  }

  return { success: false, confidence: 0 };
}

/**
 * 關鍵詞格式解析
 */
function BK_parseKeywordBasedFormat(input, options) {
  const incomeKeywords = ['收入', '薪水', '獎金', '紅利'];
  const isIncome = incomeKeywords.some(keyword => input.includes(keyword));

  const numberPattern = /(\d+(?:\.\d{1,2})?)/;
  const match = input.match(numberPattern);

  if (match) {
    return {
      success: true,
      confidence: 0.75,
      strategy: 'keyword',
      amount: parseFloat(match[1]),
      description: input.replace(numberPattern, '').trim() || '記帳',
      paymentMethod: '現金',
      type: isIncome ? 'income' : 'expense'
    };
  }

  return { success: false, confidence: 0 };
}

/**
 * 備用格式解析
 */
function BK_parseFallbackFormat(input, options) {
  const numberPattern = /(\d+(?:\.\d{1,2})?)/;
  const match = input.match(numberPattern);

  if (match) {
    return {
      success: true,
      confidence: 0.3,
      strategy: 'fallback',
      amount: parseFloat(match[1]),
      description: '記帳',
      paymentMethod: '現金',
      type: 'expense'
    };
  }

  return { success: false, confidence: 0 };
}

/**
 * 增強解析結果
 */
function BK_enhanceParsingResult(result, originalInput, options) {
  // 科目智能匹配（簡化版）
  if (result.description) {
    const categoryMapping = {
      '午餐': '餐飲',
      '晚餐': '餐飲',
      '早餐': '餐飲',
      '咖啡': '餐飲',
      '公車': '交通',
      '捷運': '交通',
      '計程車': '交通',
      '薪水': '薪資收入'
    };

    const matchedCategory = Object.keys(categoryMapping).find(key => 
      result.description.includes(key)
    );

    if (matchedCategory) {
      result.suggestedCategory = categoryMapping[matchedCategory];
    }
  }

  return result;
}

/**
 * 產生智能建議
 */
function BK_generateSmartSuggestions(result, options) {
  const suggestions = [];

  if (result.confidence < 0.7) {
    suggestions.push('建議使用更清楚的格式，例如：午餐100現金');
  }

  if (result.amount > 1000) {
    suggestions.push('建議確認金額是否正確');
  }

  if (!result.suggestedCategory) {
    suggestions.push('建議手動選擇適當的支出類別');
  }

  return suggestions;
}

/**
 * 取得置信度等級
 */
function BK_getConfidenceLevel(confidence) {
  if (confidence >= 0.9) return '很高';
  if (confidence >= 0.7) return '高';
  if (confidence >= 0.5) return '中等';
  if (confidence >= 0.3) return '低';
  return '很低';
}

/**
 * 取得解析幫助
 */
function BK_getParsingHelp() {
  return [
    '標準格式：午餐100現金',
    '自然語言：今天吃飯花了100元',
    '數字優先：100午餐',
    '收入格式：收入薪水50000'
  ];
}

// === 日誌函數 ===

function BK_logInfo(message, category, userId, functionName) {
    if (DL && typeof DL.DL_info === 'function') {
        DL.DL_info(message, category, userId, '', '', functionName);
    } else {
        console.log(`[BK INFO] ${message}`);
    }
}

function BK_logWarning(message, category, userId, functionName) {
    if (DL && typeof DL.DL_warning === 'function') {
        DL.DL_warning(message, category, userId, '', '', functionName);
    } else {
        console.log(`[BK WARNING] ${message}`);
    }
}

function BK_logError(message, category, userId, errorType, errorDetail, functionName) {
    if (DL && typeof DL.DL_error === 'function') {
        DL.DL_error(message, category, userId, errorType, errorDetail, functionName);
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

  // DCN-0012 階段二：新增API端點處理函數 (20-34)
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
  BK_processAPIDeleteAttachment,

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
  BK_formatAPIResponse,
  BK_processFourModeData,
  BK_optimizeBatchOperations,
  BK_enhanceQuickBookingParsing,

  // 新增輔助函數
  BK_checkTransactionIdUnique,
  BK_prepareTransactionData,
  BK_saveTransactionToFirestore,
  BK_calculateTransactionStats,

  // 內部輔助函數 (通常不導出，但為了完整性包含)
  BK_getUserFriendlyErrorMessage,
  BK_processExpertModeData,
  BK_processInertialModeData,
  BK_processCultivationModeData,
  BK_processGuidingModeData,
  BK_getModeSpecificRecommendations,
  BK_getModeSpecificNextSteps,
  BK_validateBatchTransactions,
  BK_prepareBatchData,
  BK_parseStandardFormat,
  BK_parseNaturalLanguage,
  BK_parseNumberFirstFormat,
  BK_parseKeywordBasedFormat,
  BK_parseFallbackFormat,
  BK_enhanceParsingResult,
  BK_generateSmartSuggestions,
  BK_getConfidenceLevel,
  BK_getParsingHelp,

  // 配置
  BK_CONFIG,

  // 日誌函數
  BK_logInfo,
  BK_logWarning,
  BK_logError,
  BK_logCritical,
};