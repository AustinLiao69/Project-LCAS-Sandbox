
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
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16 
 * @update: 階段二重構 - 強化查詢過濾功能
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
    query = query.orderBy(orderField, orderDirection);

    if (orderField !== '時間') {
      query = query.orderBy('時間', orderDirection);
    }

    // 分頁限制
    if (queryParams.limit) {
      const limit = Math.min(parseInt(queryParams.limit), 1000); // 最大1000筆
      query = query.limit(limit);
      appliedFilters.push(`limit: ${limit}`);
    }

    BK_logInfo(`${logPrefix} 查詢條件建立完成: [${appliedFilters.join(', ')}]`, "查詢建立", queryParams.userId || "", "BK_buildTransactionQuery");

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
    BK_logError(`${logPrefix} 查詢建立失敗: ${error.toString()}`, "查詢建立", queryParams.userId || "", "QUERY_BUILD_ERROR", error.toString(), "BK_buildTransactionQuery");
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

// === 階段一輔助函數（保留） ===

/**
 * 從環境變數獲取配置
 */
function getEnvVar(key) {
  return process.env[key] || '';
}

/**
 * 檢查交易ID唯一性
 */
async function BK_checkTransactionIdUnique(transactionId) {
  try {
    const db = BK_INIT_STATUS.firestore_db;
    const querySnapshot = await db.collectionGroup('entries')
      .where('收支ID', '==', transactionId)
      .limit(1)
      .get();

    return {
      success: querySnapshot.empty,
      exists: !querySnapshot.empty
    };
  } catch (error) {
    return { success: true, exists: false }; // 查詢失敗時假設不存在
  }
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

// 導出模組 - 階段一+階段二的14個函數
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
  
  // 階段二：API端點輔助與驗證函數 (6個函數)
  BK_validateTransactionData,      // 09. 記帳數據驗證 - 支援所有交易相關端點
  BK_generateTransactionId,        // 10. 生成唯一交易ID - 支援 POST 相關端點
  BK_validatePaymentMethod,        // 11. 支付方式驗證 - 支援所有交易端點
  BK_generateStatistics,           // 12. 統計數據生成 - 支援 GET /transactions/dashboard
  BK_buildTransactionQuery,        // 13. 交易查詢過濾 - 支援 GET /transactions
  BK_handleError,                  // 14. 錯誤處理機制 - 支援所有端點
  
  // 版本資訊
  BK_VERSION: BK_CONFIG.VERSION,
  BK_API_ENDPOINTS: BK_CONFIG.API_ENDPOINTS
};
