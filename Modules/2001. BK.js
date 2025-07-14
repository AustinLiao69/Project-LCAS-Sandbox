/**
 * BK_記帳處理模組_2.0.1
 * @module 記帳處理模組
 * @description LCAS 記帳處理模組 - 實現 BK 2.0 版本，支援簡化記帳路徑
 * @update 2025-07-11: 升級至2.0.0版本，實現 BR-0007 簡化記帳路徑，整合 DD 核心函數
 */

// 引入所需模組
const moment = require('moment-timezone');
const admin = require('firebase-admin');

// 確保 Firebase Admin 在模組載入時就初始化
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./Serviceaccountkey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
    });
    console.log('🔥 BK模組: Firebase Admin 自動初始化完成');
  } catch (error) {
    console.error('❌ BK模組: Firebase Admin 自動初始化失敗:', error);
  }
}

// 引入DL和FS模組
const DL = require('./2010. DL.js');
const FS = require('./2011. FS.js');

// 配置參數
const BK_CONFIG = {
  DEBUG: true,                            // 調試模式開關
  LOG_LEVEL: "DEBUG",                     // 日誌級別
  FIRESTORE_ENABLED: getEnvVar('FIRESTORE_ENABLED') || 'true',
  DEFAULT_LEDGER_ID: getEnvVar('DEFAULT_LEDGER_ID') || 'ledger_structure_001',
  TIMEZONE: "Asia/Taipei",                // 時區設置
  INITIALIZATION_INTERVAL: 300000,        // 初始化間隔(毫秒)
  TEXT_PROCESSING: {
    ENABLE_SMART_PARSING: true,           // 是否啟用智能文本解析
    MIN_AMOUNT_DIGITS: 3,                 // 金額最小位數
    MAX_REMARK_LENGTH: 20                 // 備註最大長度
  },
  STORAGE: {
    FIRESTORE_ONLY: true,                 // 僅使用 Firestore
    USE_HYBRID: false,                    // 不再使用混合存儲
    SHEETS_ONLY: false                    // 不使用 Google Sheets
  }
};

// 初始化狀態追蹤
let BK_INIT_STATUS = {
  lastInitTime: 0,         // 上次初始化時間
  initialized: false,      // 是否已初始化
  DL_initialized: false,   // DL模組是否已初始化
  firestore_db: null       // Firestore 實例
};

// 定義BK模組日誌級別
const BK_SEVERITY_DEFAULTS = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4
};

/**
 * 01. 安全獲取DL級別函數
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 安全獲取DL模組的日誌級別函數
 */
function getDLSeverity(level, defaultValue) {
  try {
    if (typeof DL_SEVERITY_LEVELS === 'object' && DL_SEVERITY_LEVELS !== null && 
        typeof DL_SEVERITY_LEVELS[level] === 'number') {
      return DL_SEVERITY_LEVELS[level];
    }
  } catch (e) {
    BK_logWarning("無法訪問 DL_SEVERITY_LEVELS." + level, "系統初始化", "", "getDLSeverity");
  }
  return defaultValue;
}

// 模組日誌等級映射
const BK_LOG_LEVEL_MAP = {
  "DEBUG": getDLSeverity("DEBUG", BK_SEVERITY_DEFAULTS.DEBUG),
  "INFO": getDLSeverity("INFO", BK_SEVERITY_DEFAULTS.INFO),
  "WARNING": getDLSeverity("WARNING", BK_SEVERITY_DEFAULTS.WARNING),
  "ERROR": getDLSeverity("ERROR", BK_SEVERITY_DEFAULTS.ERROR),
  "CRITICAL": getDLSeverity("ERROR", BK_SEVERITY_DEFAULTS.ERROR)
};

/**
 * 02. 從環境變數獲取配置
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 安全獲取環境變數配置
 */
function getEnvVar(key) {
  return process.env[key] || '';
}

/**
 * 03. 初始化Firestore連接
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 18:30:00
 * @description 初始化Firestore數據庫連接，確保 Firebase Admin 正確初始化
 */
async function initializeFirestore() {
  try {
    if (BK_INIT_STATUS.firestore_db) return BK_INIT_STATUS.firestore_db;

    // 檢查 Firebase Admin 是否已初始化
    if (!admin.apps.length) {
      console.log('🔄 BK模組: Firebase Admin 尚未初始化，開始初始化...');
      
      // 載入服務帳號金鑰
      const serviceAccount = require('./Serviceaccountkey.json');
      
      // 初始化 Firebase Admin
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
      });
      
      console.log('✅ BK模組: Firebase Admin 初始化完成');
    }

    // 取得 Firestore 實例
    const db = admin.firestore();
    
    // 測試連線
    await db.collection('_health_check').doc('bk_init_test').set({
      timestamp: admin.firestore.Timestamp.now(),
      module: 'BK',
      status: 'initialized'
    });
    
    // 刪除測試文檔
    await db.collection('_health_check').doc('bk_init_test').delete();
    
    BK_INIT_STATUS.firestore_db = db;

    BK_logInfo("Firestore連接初始化成功", "系統初始化", "", "initializeFirestore");
    return db;
  } catch (error) {
    BK_logError('Firestore初始化失敗', "系統初始化", "", "FIRESTORE_INIT_ERROR", error.toString(), "initializeFirestore");
    throw error;
  }
}

/**
 * 04. 診斷函數 - 測試日誌映射
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 診斷BK模組的日誌映射功能
 */
function BK_testLogMapping() {
  BK_logDebug("===BK診斷=== 開始測試日誌映射 ===BK診斷===", "診斷測試", "", "BK_testLogMapping");

  try {
    if (typeof DL_info === 'function') {
      BK_logDebug("測試DL_info直接調用", "診斷測試", "", "BK_testLogMapping");
      DL_info("測試訊息", "測試操作", "測試用戶", "", "", 0, "BK_testLogMapping", "BK_testLogMapping");
    }

    if (typeof DL_log === 'function') {
      BK_logDebug("測試DL_log對象調用", "診斷測試", "", "BK_testLogMapping");
      DL_log({
        message: "對象測試訊息",
        operation: "對象測試操作",
        userId: "對象測試用戶",
        errorCode: "",
        source: "BK",
        details: "",
        retryCount: 0,
        location: "BK_testLogMapping",
        severity: "INFO",
        function: "BK_testLogMapping"
      });
    }
  } catch (e) {
    BK_logError("診斷測試失敗", "診斷測試", "", "TEST_ERROR", e.toString(), "BK_testLogMapping");
  }

  BK_logDebug("===BK診斷=== 日誌映射測試完成 ===BK診斷===", "診斷測試", "", "BK_testLogMapping");
}

/**
 * 05. BK模組初始化
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 初始化BK模組，建立Firestore連接
 */
async function BK_initialize() {
  const currentTime = new Date().getTime();

  if (BK_INIT_STATUS.initialized && 
      (currentTime - BK_INIT_STATUS.lastInitTime) < BK_CONFIG.INITIALIZATION_INTERVAL) {
    return true;
  }

  try {
    let initMessages = ["BK模組初始化開始 [" + new Date().toISOString() + "]"];

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

        if (typeof DL_getModeStatus === 'function') {
          const modeStatus = DL_getModeStatus();
          initMessages.push("DL當前模式: " + modeStatus.currentMode);
        }

        BK_testLogMapping();
      } else {
        BK_logWarning("DL模組未找到，將使用原生日誌系統", "系統初始化", "", "BK_initialize");
        initMessages.push("DL模組初始化: 失敗 (未找到DL模組)");
      }
    }

    // 初始化Firestore
    await initializeFirestore();
    initMessages.push("Firestore初始化: 成功");

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
 * 06. 日期時間格式化
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 格式化日期時間為台北時區
 */
function BK_formatDateTime(date) {
  return moment(date).tz(BK_CONFIG.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * 07. 統一日誌處理函數
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 完全重構的日誌處理函數
 */
function BK_log(level, message, operationType = "", userId = "", options = {}) {
  const {
    errorCode = "", 
    errorDetails = "", 
    location = "", 
    functionName = "",
    retryCount = 0
  } = options;

  if (level === "DEBUG" && !BK_CONFIG.DEBUG) return;

  try {
    if (typeof DL_initialize === 'function' && !BK_INIT_STATUS.DL_initialized) {
      DL_initialize();
      BK_INIT_STATUS.DL_initialized = true;
    }

    const callerFunction = functionName || "BK_log";
    const actualLocation = location || callerFunction;

    switch(level) {
      case "DEBUG":
        if (typeof DL_debug === 'function') {
          return DL_debug(message, operationType || "BK系統", userId || "", errorCode || "", errorDetails || "", retryCount || 0, actualLocation, callerFunction);
        }
        break;
      case "INFO":
        if (typeof DL_info === 'function') {
          return DL_info(message, operationType || "BK系統", userId || "", errorCode || "", errorDetails || "", retryCount || 0, actualLocation, callerFunction);
        }
        break;
      case "WARNING":
        if (typeof DL_warning === 'function') {
          return DL_warning(message, operationType || "BK系統", userId || "", errorCode || "", errorDetails || "", retryCount || 0, actualLocation, callerFunction);
        }
        break;
      case "ERROR":
        if (typeof DL_error === 'function') {
          return DL_error(message, operationType || "BK系統", userId || "", errorCode || "", errorDetails || "", retryCount || 0, actualLocation, callerFunction);
        }
        break;
      case "CRITICAL":
        if (typeof DL_error === 'function') {
          return DL_error("[CRITICAL] " + message, operationType || "BK系統", userId || "", errorCode || "CRITICAL_ERROR", errorDetails || "", retryCount || 0, actualLocation, callerFunction);
        }
        break;
    }

    if (typeof DL_log === 'function') {
      return DL_log({
        message: message,
        operation: operationType || "BK系統",
        userId: userId || "",
        errorCode: errorCode || "",
        source: "BK",
        details: errorDetails || "",
        retryCount: retryCount || 0,
        location: actualLocation,
        severity: level,
        function: callerFunction
      });
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [BK] ${message} | ${operationType} | ${userId} | ${actualLocation}`);

  } catch (e) {
    console.error(`BK日誌錯誤: ${e.toString()} - 堆疊: ${e.stack || "無堆疊信息"}`);
    console.error(`嘗試記錄: ${level} | ${message} | ${operationType} | ${userId}`);
  }

  return true;
}

// 日誌包裝函數
function BK_logDebug(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_log("DEBUG", message, operationType || "BK系統", userId, { location: location || "BK_logDebug", functionName: functionName || "BK_logDebug" });
}

function BK_logInfo(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_log("INFO", message, operationType || "BK系統", userId, { location: location || "BK_logInfo", functionName: functionName || "BK_logInfo" });
}

function BK_logWarning(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_log("WARNING", message, operationType || "BK系統", userId, { location: location || "BK_logWarning", functionName: functionName || "BK_logWarning" });
}

function BK_logWarn(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_logWarning(message, operationType || "BK系統", userId, location || "BK_logWarn", functionName || "BK_logWarn");
}

function BK_logError(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  return BK_log("ERROR", message, operationType || "BK系統", userId, { errorCode, errorDetails, location: location || "BK_logError", functionName: functionName || "BK_logError" });
}

function BK_logCritical(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  return BK_log("CRITICAL", message, operationType || "BK系統", userId, { errorCode, errorDetails, location: location || "BK_logCritical", functionName: functionName || "BK_logCritical" });
}

/**
 * 08. 生成唯一的收支ID
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 使用Firestore查詢生成唯一收支ID
 */
async function BK_generateBookkeepingId(processId) {
  BK_logDebug(`開始生成收支ID [${processId}]`, "ID生成", "", "BK_generateBookkeepingId");

  try {
    await BK_initialize();

    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const db = BK_INIT_STATUS.firestore_db;

    // 查詢當天的所有記錄
    const todayQuery = await db
      .collection('ledgers')
      .doc(BK_CONFIG.DEFAULT_LEDGER_ID)
      .collection('entries')
      .where('收支ID', '>=', dateStr + '-00000')
      .where('收支ID', '<=', dateStr + '-99999')
      .orderBy('收支ID', 'desc')
      .limit(1)
      .get();

    let maxSerialNumber = 0;

    if (!todayQuery.empty) {
      const lastDoc = todayQuery.docs[0];
      const lastId = lastDoc.data().收支ID;
      if (lastId && lastId.startsWith(dateStr + '-')) {
        const serialPart = lastId.split('-')[1];
        if (serialPart) {
          const serialNumber = parseInt(serialPart, 10);
          if (!isNaN(serialNumber)) {
            maxSerialNumber = serialNumber;
          }
        }
      }
    }

    const nextSerialNumber = maxSerialNumber + 1;
    const formattedNumber = nextSerialNumber.toString().padStart(5, '0');
    const bookkeepingId = `${dateStr}-${formattedNumber}`;

    BK_logInfo(`生成收支ID: ${bookkeepingId} [${processId}]`, "ID生成", "", "BK_generateBookkeepingId");
    return bookkeepingId;

  } catch (error) {
    BK_logError(`生成收支ID失敗: ${error} [${processId}]`, "ID生成", "", "ID_GEN_ERROR", error.toString(), "BK_generateBookkeepingId");

    const timestamp = new Date().getTime();
    const fallbackId = `F${timestamp}`;
    BK_logWarning(`使用備用ID: ${fallbackId} [${processId}]`, "ID生成", "", "BK_generateBookkeepingId");

    return fallbackId;
  }
}

/**
 * 09. 驗證記帳數據
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 驗證記帳數據的完整性
 */
function BK_validateData(data) {
  try {
    if (!data.date) return { success: false, error: "缺少日期信息" };
    if (!data.time) return { success: false, error: "缺少時間信息" };
    if (!data.majorCode) return { success: false, error: "缺少主科目代碼" };
    if (!data.minorCode) return { success: false, error: "缺少子科目代碼" };

    let hasValidAmount = false;

    if (data.income !== undefined && data.income !== '') {
      hasValidAmount = true;
    }

    if (data.expense !== undefined && data.expense !== '') {
      hasValidAmount = true;
    }

    if (!hasValidAmount) {
      return { success: false, error: "缺少有效的收入或支出金額" };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: "數據驗證過程出錯: " + error.toString() };
  }
}

/**
 * 10. 處理記帳操作的主函數
 * @version 2025-01-03-V1.9.0
 * @date 2025-01-03 17:30:00
 * @update: 移除Google Sheets相關代碼，改用純Firestore存儲，完善版本管理
 */
async function BK_processBookkeeping(bookkeepingData) {
  const processId = bookkeepingData.processId || require('crypto').randomUUID().substring(0, 8);
  const logPrefix = `[${processId}] BK_processBookkeeping:`;

  try {
    BK_logInfo(`${logPrefix} 開始處理記帳請求`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");

    if (!bookkeepingData) {
      BK_logError(`${logPrefix} 記帳數據為空`, "數據驗證", "", "DATA_EMPTY", "記帳數據為空", "BK_processBookkeeping");
      throw new Error("記帳數據為空");
    }

    const requiredFields = ['action', 'subjectName', 'amount', 'majorCode', 'subCode'];
    const missingFields = requiredFields.filter(field => !bookkeepingData[field]);

    if (missingFields.length > 0) {
      BK_logError(`${logPrefix} 缺少必要欄位: ${missingFields.join(', ')}`, "數據驗證", bookkeepingData.userId || "", "MISSING_FIELDS", "缺少必要欄位", "BK_processBookkeeping");

      return {
        success: false,
        error: `缺少必要欄位: ${missingFields.join(', ')}`,
        errorDetails: {
          processId: processId,
          errorType: "VALIDATION_ERROR",
          module: "BK"
        },
        partialData: {
          subject: bookkeepingData.subjectName || "未知科目",
          amount: bookkeepingData.amount || 0,
          rawAmount: bookkeepingData.rawAmount || String(bookkeepingData.amount || 0),
          paymentMethod: bookkeepingData.paymentMethod,
          remark: bookkeepingData.text || bookkeepingData.originalSubject || ""
        },
        userFriendlyMessage: `記帳處理失敗 (VALIDATION_ERROR)：缺少必要欄位\n請重新嘗試或聯繫管理員。`
      };
    }

    const numericAmount = typeof bookkeepingData.amount === 'string' 
      ? parseFloat(bookkeepingData.amount.replace(/,/g, '')) 
      : bookkeepingData.amount;

    if (numericAmount < 0) {
      BK_logError(`${logPrefix} 檢測到負數金額: ${numericAmount}`, "數據驗證", bookkeepingData.userId || "", "NEGATIVE_AMOUNT", `金額: ${numericAmount}`, "BK_processBookkeeping");

      return {
        success: false,
        error: "金額不可為負數",
        errorDetails: {
          processId: processId,
          errorType: "VALIDATION_ERROR",
          module: "BK"
        },
        partialData: {
          subject: bookkeepingData.subjectName || "未知科目",
          amount: numericAmount,
          rawAmount: bookkeepingData.rawAmount || String(numericAmount),
          paymentMethod: bookkeepingData.paymentMethod,
          remark: bookkeepingData.originalSubject || bookkeepingData.text || ""
        },
        userFriendlyMessage: `記帳處理失敗 (VALIDATION_ERROR)：金額不可為負數\n請重新嘗試使用正數金額。`
      };
    }

    const today = new Date();
    const formattedDate = moment(today).tz(BK_CONFIG.TIMEZONE).format("YYYY/MM/DD HH:mm");
    const formattedTime = moment(today).tz(BK_CONFIG.TIMEZONE).format("HH:mm");
    const formattedDay = moment(today).tz(BK_CONFIG.TIMEZONE).format("YYYY/MM/DD");
    BK_logDebug(`${logPrefix} 格式化日期: ${formattedDate}, 時間: ${formattedTime}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");

    const bookkeepingId = await BK_generateBookkeepingId(processId);
    BK_logInfo(`${logPrefix} 生成記帳ID: ${bookkeepingId}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");

    let income = '', expense = '';
    const rawAmount = bookkeepingData.rawAmount || bookkeepingData.amount.toLocaleString('zh-TW');

    if (bookkeepingData.action === "收入") {
      income = numericAmount.toString();
      BK_logInfo(`${logPrefix} 處理收入金額: ${income}，原始格式: ${rawAmount}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");
    } else {
      expense = numericAmount.toString();
      BK_logInfo(`${logPrefix} 處理支出金額: ${expense}，原始格式: ${rawAmount}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");
    }

    let remark = "";
    try {
      if (typeof DD_generateIntelligentRemark === 'function') {
        remark = DD_generateIntelligentRemark(bookkeepingData);
        BK_logInfo(`${logPrefix} 使用智能備註生成: "${remark}"`, "備註處理", bookkeepingData.userId || "", "BK_processBookkeeping");
      } else {
        remark = bookkeepingData.text || bookkeepingData.originalSubject || "";
        BK_logInfo(`${logPrefix} 使用原始文本作為備註: "${remark}"`, "備註處理", bookkeepingData.userId || "", "BK_processBookkeeping");
      }
    } catch (remarkError) {
      BK_logWarning(`${logPrefix} 備註生成失敗: ${remarkError}, 使用原始文本`, "備註處理", bookkeepingData.userId || "", "BK_processBookkeeping");
      remark = bookkeepingData.text || bookkeepingData.originalSubject || "";
    }

    let userId = bookkeepingData.userId;
    if (!userId) {
      try {
        userId = process.env.USER || process.env.USERNAME || "";
        BK_logInfo(`${logPrefix} 使用系統環境使用者: ${userId}`, "使用者處理", userId, "BK_processBookkeeping");
      } catch (e) {
        BK_logWarning(`${logPrefix} 無法獲取系統環境使用者: ${e}`, "使用者處理", "", "BK_processBookkeeping");
      }

      if (!userId || userId === "") {
        userId = "AustinLiao691";
        BK_logInfo(`${logPrefix} 使用預設使用者ID: ${userId}`, "使用者處理", userId, "BK_processBookkeeping");
      }

      if (!userId || userId === "") {
        userId = "SYSTEM_" + new Date().getTime();
        BK_logInfo(`${logPrefix} 使用系統生成的使用者ID: ${userId}`, "使用者處理", userId, "BK_processBookkeeping");
      }

      BK_logWarning(`記帳缺少使用者ID，使用替代值: ${userId} [${processId}]`, "數據修正", "", "BK_processBookkeeping");
    }

    let userType = bookkeepingData.userType;
    if (!userType) {
      if (userId === "AustinLiao691") {
        userType = "M";
      } else if (userId.includes("SYSTEM_")) {
        userType = "S";
      } else {
        userType = "J";
      }

      BK_logInfo(`${logPrefix} 設定使用者類型: ${userType} 給使用者: ${userId}`, "使用者分類", userId, "BK_processBookkeeping");
    }

    const adaptedData = {
      id: bookkeepingId,
      userType: userType,
      date: formattedDay,
      time: formattedTime,
      majorCode: bookkeepingData.majorCode,
      minorCode: bookkeepingData.subCode,
      paymentMethod: bookkeepingData.paymentMethod,
      minorName: bookkeepingData.subjectName,
      userId: userId,
      remark: remark,
      income: income,
      expense: expense,
      rawAmount: rawAmount,
      synonym: bookkeepingData.originalSubject || ""
    };

    BK_logInfo(`${logPrefix} 準備記帳數據: ID=${bookkeepingId}, 使用者=${userId}, 類型=${userType}, 支付方式=${bookkeepingData.paymentMethod || "未設置"}` + 
              `, 原始金額=${rawAmount}`, "記帳處理", userId, "BK_processBookkeeping");

    const bookkeepingDataForFirestore = BK_prepareBookkeepingData(bookkeepingId, adaptedData, processId);

    BK_logInfo(`${logPrefix} 開始保存數據到Firestore`, "數據存儲", userId, "BK_processBookkeeping");
    const result = await BK_saveToFirestore(bookkeepingDataForFirestore, processId);

    if (!result.success) {
      BK_logError(`${logPrefix} Firestore存儲失敗: ${result.error}`, "數據存儲", userId, "SAVE_ERROR", result.error, "BK_processBookkeeping");

      return {
        success: false,
        error: "Firestore存儲失敗",
        errorDetails: {
          processId: processId,
          errorTime: BK_formatDateTime(new Date()),
          errorType: "STORAGE_ERROR",
          module: "BK",
          storageResults: result
        },
        partialData: {
          subject: bookkeepingData.subjectName,
          amount: numericAmount,
          rawAmount: rawAmount, 
          paymentMethod: bookkeepingData.paymentMethod,
          remark: remark
        },
        userFriendlyMessage: `記帳處理失敗 (STORAGE_ERROR)：Firestore存儲失敗\n請重新嘗試或聯繫管理員。`
      };
    }

    BK_logInfo(`${logPrefix} Firestore存儲成功，文檔ID: ${result.docId}`, "數據存儲", userId, "BK_processBookkeeping");

    if (bookkeepingData.originalSubject && 
        userId &&
        typeof DD_userPreferenceManager === 'function') {
      try {
        BK_logInfo(`${logPrefix} 開始處理用戶偏好學習`, "用戶偏好學習", userId, "BK_processBookkeeping");
        DD_userPreferenceManager(
          userId, 
          bookkeepingData.originalSubject, 
          `${bookkeepingData.majorCode}-${bookkeepingData.subCode}`
        );
        BK_logInfo(`${logPrefix} 用戶偏好學習處理完成`, "用戶偏好學習", userId, "BK_processBookkeeping");
      } catch (prefError) {
        BK_logWarning(`${logPrefix} 用戶偏好記錄失敗: ${prefError}`, "用戶偏好學習", userId, "BK_processBookkeeping");
      }
    }

    if (bookkeepingData.formatId && 
        userId &&
        typeof DD_learnInputPatterns === 'function') {
      try {
        BK_logInfo(`${logPrefix} 開始處理格式學習`, "格式學習", userId, "BK_processBookkeeping");
        DD_learnInputPatterns(
          userId,
          bookkeepingData.formatId,
          bookkeepingData.text
        );
        BK_logInfo(`${logPrefix} 格式學習處理完成`, "格式學習", userId, "BK_processBookkeeping");
      } catch (formatError) {
        BK_logWarning(`${logPrefix} 格式學習失敗: ${formatError}`, "格式學習", userId, "BK_processBookkeeping");
      }
    }

    const finalPaymentMethod = bookkeepingDataForFirestore[6];
    BK_logInfo(`${logPrefix} 最終確認的支付方式: ${finalPaymentMethod}`, "記帳處理", userId, "BK_processBookkeeping");

    BK_logInfo(`${logPrefix} 記帳處理成功: ${bookkeepingId}, 使用者類型: ${userType}, 原始金額: ${rawAmount}, 支付方式: ${finalPaymentMethod}`, "記帳完成", userId, "BK_processBookkeeping");

    return {
      success: true,
      message: "記帳成功！",
      data: {
        id: bookkeepingId,
        date: formattedDate,
        subjectName: bookkeepingData.subjectName,
        amount: numericAmount,
        rawAmount: rawAmount,
        action: bookkeepingData.action,
        paymentMethod: finalPaymentMethod,
        remark: remark,
        userId: userId,
        userType: userType
      }
    };

  } catch (error) {
    BK_logError(`${logPrefix} 記帳處理失敗: ${error.toString()}`, "記帳處理", bookkeepingData ? bookkeepingData.userId : "", "PROCESS_ERROR", error.toString(), "BK_processBookkeeping");

    let errorType = "GENERAL_ERROR";
    let errorMessage = error.toString();
    if (error.message) {
      if (error.message.includes("缺少必要欄位") || error.message.includes("數據為空") || error.message.includes("未明確指定科目名稱")) {
        errorType = "VALIDATION_ERROR";
        errorMessage = `驗證失敗: ${error.message}`;
      } else if (error.message.includes("儲存") || error.message.includes("ID重複")) {
        errorType = "STORAGE_ERROR";
        errorMessage = `儲存失敗: ${error.message}`;
      } else if (error.message.includes("權限")) {
        errorType = "PERMISSION_ERROR";
        errorMessage = `權限不足: ${error.message}`;
      }
    }

    if (error instanceof Error && error.stack) {
      BK_logError(`錯誤堆疊: ${error.stack}`, "記帳處理", bookkeepingData ? bookkeepingData.userId : "", "STACK_TRACE", "", "BK_processBookkeeping");
    }

    let partialData = {};

    try {
      const currentDateTime = moment(new Date()).tz(BK_CONFIG.TIMEZONE).format("YYYY/MM/DD HH:mm");

      if (bookkeepingData) {
        partialData = {
          date: currentDateTime,
          subject: bookkeepingData.subjectName,
          rawAmount: bookkeepingData.rawAmount || 
                    (bookkeepingData.amount ? String(bookkeepingData.amount) : undefined),
          amount: bookkeepingData.amount,
          action: bookkeepingData.action,
          paymentMethod: bookkeepingData.paymentMethod,
          remark: bookkeepingData.text || bookkeepingData.originalSubject
        };
      }

      Object.keys(partialData).forEach(key => {
        if (partialData[key] === undefined) {
          delete partialData[key];
        }
      });
    } catch (e) {
      BK_logError(`${logPrefix} 無法提取部分數據: ${e.toString()}`, "錯誤處理", "", "PARTIAL_DATA_ERROR", e.toString(), "BK_processBookkeeping");
    }

    if (!partialData.subject) partialData.subject = "未知科目";

    return {
      success: false,
      message: `記帳失敗: ${errorMessage}`,
      error: error.toString(),
      errorDetails: {
        processId: processId,
        errorTime: BK_formatDateTime(new Date()),
        errorType: errorType,
        module: "BK"
      },
      partialData: partialData,
      userFriendlyMessage: `記帳處理失敗${errorType !== "GENERAL_ERROR" ? " (" + errorType + ")" : ""}：${errorMessage}\n請重新嘗試或聯繫管理員。`    };
  }
}

/**
 * 11. 準備記帳數據
 * @version 2025-01-03-V1.9.0
 * @date 2025-01-03 17:30:00
 * @description 準備記帳數據，移除Google Sheets格式，改為Firestore格式
 */
function BK_prepareBookkeepingData(bookkeepingId, data, processId) {
  BK_logInfo(`準備記帳數據 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  BK_logInfo(`收到數據: ${JSON.stringify(data).substring(0, 100)}...`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  const remarkContent = data.remark || data.notes || '';
  BK_logInfo(`備註內容: "${remarkContent}" [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  let income = '', expense = '';

  // 優先使用 action 參數進行判斷
  if (data.action === "收入") {
    income = data.income || data.amount || '';
    expense = '';
    BK_logInfo(`根據action判定為收入，金額=${income} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
  } 
  else if (data.action === "支出") {
    expense = data.expense || data.amount || '';
    income = '';
    BK_logInfo(`根據action判定為支出，金額=${expense} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
  }
  else {
    BK_logWarn(`未設置action (${data.action})，退回到傳統判斷方式 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

    // 傳統判斷方式：依序檢查 income/expense 參數
    if (data.income !== undefined && data.income !== '') {
      income = data.income;
      expense = '';
      BK_logInfo(`傳統方式：使用收入金額: ${income} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

      if (data.expense !== undefined && data.expense !== '') {
        BK_logWarn(`收到同時設置income和expense的矛盾數據，優先使用income [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
      }
    } else if (data.expense !== undefined && data.expense !== '') {
      expense = data.expense;
      income = '';
      BK_logInfo(`傳統方式：使用支出金額: ${expense} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
    } else if (data.amount !== undefined && data.amount !== '') {
      // 如果只有 amount，根據科目代碼判斷收入/支出
      const majorCode = data.majorCode;
      if (majorCode && String(majorCode).startsWith('8')) {
        income = data.amount;
        expense = '';
        BK_logInfo(`根據科目代碼${majorCode}判定為收入，金額=${income} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
      } else {
        expense = data.amount;
        income = '';
        BK_logInfo(`根據科目代碼${majorCode}判定為支出，金額=${expense} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
      }
    } else {
      BK_logWarn(`未收到任何金額信息 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
    }
  }

  let paymentMethod = data.paymentMethod;

  if (!paymentMethod || paymentMethod === '') {
    const majorCode = data.majorCode;
    if (majorCode && (String(majorCode).startsWith('8') || String(majorCode).startsWith('9'))) {
      paymentMethod = "現金";
      BK_logInfo(`科目代碼${majorCode}為8或9開頭，預設支付方式為現金 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
    } else {
      paymentMethod = BK_validatePaymentMethod(paymentMethod, data.majorCode);
    }
  } else {
    paymentMethod = BK_validatePaymentMethod(paymentMethod, data.majorCode);
  }

  BK_logInfo(`記帳數據準備完成: 收入=${income}, 支出=${expense}, 支付方式=${paymentMethod}, 備註="${remarkContent}" [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  // 返回Firestore格式的數據陣列
  const bookkeepingData = [
    bookkeepingId,                     // 1. 收支ID
    data.userType,                     // 2. User類型
    data.date,                         // 3. 日期
    data.time,                         // 4. 時間
    data.majorCode,                    // 5. 大項代碼
    data.minorCode,                    // 6. 子項代碼
    paymentMethod,                     // 7. 支付方式
    data.minorName,                    // 8. 子項名稱
    data.userId,                       // 9. 登錄者
    remarkContent,                     // 10. 備註
    income,                            // 11. 收入
    expense,                           // 12. 支出
    data.synonym || ''                 // 13. 同義詞
  ];

  return bookkeepingData;
}

/**
 * 12. 儲存數據到Firestore
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 18:30:00
 * @description 將記帳數據存儲到Firestore，增強連線檢查
 */
async function BK_saveToFirestore(bookkeepingData, processId, ledgerId = null) {
  const actualLedgerId = ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
  BK_logDebug(`開始儲存數據到 Firestore [${processId}]`, "Firestore存儲", "", "BK_saveToFirestore");

  try {
    // 確保 Firestore 已初始化
    if (!BK_INIT_STATUS.firestore_db) {
      BK_logWarning(`Firestore 未初始化，嘗試重新初始化 [${processId}]`, "Firestore存儲", "", "BK_saveToFirestore");
      await initializeFirestore();
    }

    // 檢查 db 是否為 null
    if (!BK_INIT_STATUS.firestore_db) {
      BK_logError(`Firestore 實例為 null，無法存儲數據 [${processId}]`, "Firestore存儲", "", "FIRESTORE_NULL", "Firestore 實例為 null", "BK_saveToFirestore");
      throw new Error("資料庫連接失敗，無法儲存記帳數據");
    }
    const firestoreData = {
      收支ID: bookkeepingData[0],
      使用者類型: bookkeepingData[1],
      日期: bookkeepingData[2],
      時間: bookkeepingData[3],
      大項代碼: bookkeepingData[4],
      子項代碼: bookkeepingData[5],
      支付方式: bookkeepingData[6],
      子項名稱: bookkeepingData[7],
      UID: bookkeepingData[8],
      備註: bookkeepingData[9],
      收入: bookkeepingData[10] || null,
      支出: bookkeepingData[11] || null,
      同義詞: bookkeepingData[12] || '',
      currency: 'NTD',
      timestamp: admin.firestore.Timestamp.now()
    };

    const db = BK_INIT_STATUS.firestore_db;

    const docRef = await db
      .collection('ledgers')
      .doc(actualLedgerId)
      .collection('entries')
      .add(firestoreData);

    BK_logInfo(`數據成功儲存到 Firestore，文檔ID: ${docRef.id} [${processId}]`, "Firestore存儲", "", "BK_saveToFirestore");

    await db
      .collection('ledgers')
      .doc(actualLedgerId)
      .collection('log')
      .add({
        時間: admin.firestore.Timestamp.now(),
        訊息: `BK模組成功新增記帳記錄: ${bookkeepingData[0]}`,
        操作類型: '記帳新增',
        UID: bookkeepingData[8],
        錯誤代碼: null,
        來源: 'BK',
        錯誤詳情: `處理ID: ${processId}`,
        重試次數: 0,
        程式碼位置: 'BK_saveToFirestore',
        嚴重等級: 'INFO'
      });

    return {
      success: true,
      docId: docRef.id,
      firestoreData: firestoreData
    };

  } catch (error) {
    BK_logError(`儲存到 Firestore 失敗 [${processId}]`, "Firestore存儲", "", "FIRESTORE_ERROR", error.toString(), "BK_saveToFirestore");

    let detailedError = error.toString();
    if (error.message && error.message.includes("Permission denied")) {
      detailedError = "無權限存取 Firestore，請檢查服務帳戶權限";
    } else if (error.message && error.message.includes("Collection")) {
      detailedError = "Firestore 集合結構錯誤，請檢查資料庫結構";
    }

    return {
      success: false,
      error: "儲存到 Firestore 失敗: " + detailedError
    };
  }
}

/**
 * 13. 獲取支付方式列表
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 獲取支援的支付方式列表
 */
function BK_getPaymentMethods() {
  return ["現金", "刷卡", "轉帳", "行動支付", "其他"];
}

/**
 * 14. 確認並標準化支付方式
 * @version 2025-01-03-V1.9.0
 * @date 2025-01-03 17:30:00
 * @description 驗證並標準化支付方式
 */
function BK_validatePaymentMethod(method, majorCode) {
  try {
    BK_logDebug(`BK_validatePaymentMethod: 驗證支付方式 "${method}" 對應科目代碼 ${majorCode}`, "支付方式驗證", "", "BK_validatePaymentMethod");

    if (!method || method === "" || method === "預設") {
      if (majorCode && (String(majorCode).startsWith('8') || String(majorCode).startsWith('9'))) {
        BK_logDebug(`BK_validatePaymentMethod: 科目代碼 ${majorCode} 為8或9開頭，使用默認支付方式"現金"`, "支付方式驗證", "", "BK_validatePaymentMethod");
        return "現金";
      } else {
        BK_logDebug(`BK_validatePaymentMethod: 未指定支付方式或值為"預設"，使用默認支付方式"刷卡"`, "支付方式驗證", "", "BK_validatePaymentMethod");
        return "刷卡";
      }
    }

    const validPaymentMethods = ["現金", "刷卡", "轉帳", "行動支付"];

    if (validPaymentMethods.includes(method)) {
      BK_logDebug(`BK_validatePaymentMethod: 使用有效支付方式 "${method}"`, "支付方式驗證", "", "BK_validatePaymentMethod");
      return method;
    }

    const errorMessage = `不支援的支付方式: "${method}"，僅支援 "現金"、"刷卡"、"轉帳"、"行動支付"`;
    BK_logError(`BK_validatePaymentMethod: ${errorMessage}`, "支付方式驗證", "", "INVALID_PAYMENT_METHOD", errorMessage, "BK_validatePaymentMethod");
    throw new Error(errorMessage);

  } catch (error) {
    BK_logError(`BK_validatePaymentMethod 發生錯誤: ${error.toString()}`, "支付方式驗證", "", "PAYMENT_VALIDATION_ERROR", error.toString(), "BK_validatePaymentMethod");

    try {
      BK_logError(`支付方式驗證失敗: ${error}`, "支付方式處理", "", "PAYMENT_ERROR", error.toString(), "BK_validatePaymentMethod", "BK_validatePaymentMethod");
    } catch(e) {
      // 日誌記錄失敗也不影響主流程
    }

    throw error;
  }
}

/**
 * 15. 智能文本解析
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 分離文本中的備註和金額
 */
function BK_smartTextParsing(text, processId) {
  BK_logDebug(`開始智能文本解析: "${text}" [${processId}]`, "文本解析", "", "BK_smartTextParsing");

  if (!text || text.length === 0) {
    return { detected: false, remark: text, amount: 0 };
  }

  try {
    const defaultResult = { detected: false, remark: text, amount: 0 };

    const numbersMatches = text.match(/\d+/g);
    if (!numbersMatches || numbersMatches.length === 0) {
      BK_logDebug(`未找到數字 [${processId}]`, "文本解析", "", "BK_smartTextParsing");
      return defaultResult;
    }

    let bestMatch = "";
    let bestMatchLength = 0;

    for (const match of numbersMatches) {
      if (match.length > bestMatchLength) {
        bestMatchLength = match.length;
        bestMatch = match;
      }
    }

    if (bestMatchLength < BK_CONFIG.TEXT_PROCESSING.MIN_AMOUNT_DIGITS) {
      BK_logDebug(`找到的數字太短 (${bestMatch})，不符合金額標準 [${processId}]`, "文本解析", "", "BK_smartTextParsing");
      return defaultResult;
    }

    const amount = parseInt(bestMatch, 10);
    const remark = text.replace(new RegExp(bestMatch, 'g'), '').trim();

    if (remark.length > BK_CONFIG.TEXT_PROCESSING.MAX_REMARK_LENGTH) {
      BK_logDebug(`備註太長 (${remark.length} > ${BK_CONFIG.TEXT_PROCESSING.MAX_REMARK_LENGTH})，不進行分離 [${processId}]`, 
               "文本解析", "", "BK_smartTextParsing");
      return defaultResult;
    }

    if (!remark || remark.replace(/[^\w\s]/g, '').trim() === '') {
      const nonDigitPrefix = text.replace(/\d+.*$/, '').trim();
      if (nonDigitPrefix) {
        BK_logDebug(`備註為空，使用前綴文本: "${nonDigitPrefix}" [${processId}]`, "文本解析", "", "BK_smartTextParsing");
        return { detected: true, remark: nonDigitPrefix, amount: amount };
      }
    }

    BK_logInfo(`成功分離: "${text}" -> 備註="${remark}", 金額=${amount} [${processId}]`, "文本解析", "", "BK_smartTextParsing");
    return { detected: true, remark: remark, amount: amount };

  } catch (error) {
    BK_logError(`智能文本解析錯誤: ${error.toString()} [${processId}]`, "文本解析", "", "PARSE_ERROR", error.toString(), "BK_smartTextParsing");
    return { detected: false, remark: text, amount: 0 };
  }
}

/**
 * 16. 從Firestore獲取記帳數據
 * @version 2025-01-03-V1.9.0
 * @date 2025-01-03 17:30:00
 * @description 從Firestore獲取指定日期範圍的記帳數據
 */
async function BK_getBookkeepingData(startDate, endDate, userId = null, ledgerId = null) {
  const actualLedgerId = ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
  BK_logDebug(`獲取${startDate}至${endDate}的記帳數據${userId ? ` (使用者: ${userId})` : ''}`, "數據查詢", userId || "", "BK_getBookkeepingData");

  try {
    if (!BK_INIT_STATUS.initialized) {
      await BK_initialize();
    }

    const db = BK_INIT_STATUS.firestore_db;

    // 解析日期範圍
    const startMoment = moment(startDate, "YYYY/MM/DD");
    const endMoment = moment(endDate, "YYYY/MM/DD");

    if (!startMoment.isValid() || !endMoment.isValid()) {
      throw new Error(`無效的日期格式: ${startDate} 或 ${endDate}，請使用YYYY/MM/DD格式`);
    }

    let query = db.collection('ledgers').doc(actualLedgerId).collection('entries');

    // 如果指定了使用者ID，則篩選特定使用者的資料
    if (userId) {
      query = query.where('UID', '==', userId);
    }

    // 依據日期範圍篩選
    query = query.where('日期', '>=', startDate)
                 .where('日期', '<=', endDate)
                 .orderBy('日期', 'desc')
                 .orderBy('時間', 'desc');

    const querySnapshot = await query.get();

    const filteredData = [];

    querySnapshot.forEach(doc => {
      const data = doc.data();

      // 轉換收入/支出為數值
      let income = data.收入 ? parseFloat(data.收入) : 0;
      let expense = data.支出 ? parseFloat(data.支出) : 0;

      if (isNaN(income)) income = 0;
      if (isNaN(expense)) expense = 0;

      const record = {
        id: data.收支ID || "",
        userType: data.使用者類型 || "",
        date: data.日期 || "",
        time: data.時間 || "",
        majorCode: data.大項代碼 || "",
        minorCode: data.子項代碼 || "",
        paymentMethod: data.支付方式 || "",
        minorName: data.子項名稱 || "",
        userId: data.UID || "",
        remark: data.備註 || "",
        income: income,
        expense: expense,
        synonym: data.同義詞 || "",
        currency: data.currency || 'NTD',
        timestamp: data.timestamp
      };

      filteredData.push(record);
    });

    BK_logInfo(`從Firestore查詢到${filteredData.length}條記帳數據`, "數據查詢", userId || "", "BK_getBookkeepingData");
    return filteredData;

  } catch (error) {
    BK_logError(`從Firestore獲取記帳數據失敗: ${error.toString()}`, "數據查詢", userId || "", "QUERY_ERROR", error.toString(), "BK_getBookkeepingData");
    throw new Error(`獲取記帳數據失敗: ${error.toString()}`);
  }
}

/**
 * 17. 依科目代碼從Firestore獲取記帳數據
 * @version 2025-01-03-V1.9.0
 * @date 2025-01-03 17:30:00
 * @description 從Firestore獲取指定科目代碼的記帳數據
 */
async function BK_getDataBySubjectCode(startDate, endDate, majorCode, minorCode = null, userId = null, ledgerId = null) {
  const actualLedgerId = ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
  const logPrefix = `獲取科目[${majorCode}${minorCode ? '-'+minorCode : ''}]`;
  BK_logDebug(`${logPrefix}從${startDate}至${endDate}的記帳數據${userId ? ` (使用者: ${userId})` : ''}`, "科目查詢", userId || "", "BK_getDataBySubjectCode");

  try {
    const allData = await BK_getBookkeepingData(startDate, endDate, userId, actualLedgerId);

    const filteredData = allData.filter(record => {
      if (record.majorCode !== majorCode) {
        return false;
      }

      if (minorCode && record.minorCode !== minorCode) {
        return false;
      }

      return true;
    });

    BK_logInfo(`從Firestore查詢到科目[${majorCode}${minorCode ? '-'+minorCode : ''}]的${filteredData.length}條記帳數據`, "科目查詢", userId || "", "BK_getDataBySubjectCode");
    return filteredData;

  } catch (error) {
    BK_logError(`${logPrefix}記帳數據失敗: ${error.toString()}`, "科目查詢", userId || "", "SUBJECT_QUERY_ERROR", error.toString(), "BK_getDataBySubjectCode");
    throw new Error(`獲取科目[${majorCode}${minorCode ? '-'+minorCode : ''}]記帳數據失敗: ${error.toString()}`);
  }
}

/**
 * 18. 生成記帳摘要報告
 * @version 2025-01-03-V1.9.0
 * @date 2025-01-03 17:30:00
 * @description 從Firestore數據生成記帳摘要報告
 */
async function BK_generateSummaryReport(startDate, endDate, userId = null, ledgerId = null) {
  const actualLedgerId = ledgerId || BK_CONFIG.DEFAULT_LEDGER_ID;
  BK_logDebug(`生成${startDate}至${endDate}的記帳摘要報告${userId ? ` (使用者: ${userId})` : ''}`, "報表生成", userId || "", "BK_generateSummaryReport");

  try {
    const data = await BK_getBookkeepingData(startDate, endDate, userId, actualLedgerId);

    const summary = {
      startDate: startDate,
      endDate: endDate,
      userId: userId,
      ledgerId: actualLedgerId,
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      majorCategories: {},
      paymentMethods: {},
      records: data.length,
      generatedAt: BK_formatDateTime(new Date())
    };

    data.forEach(record => {
      if (record.income) {
        summary.totalIncome += record.income;
      }

      if (record.expense) {
        summary.totalExpense += record.expense;
      }

      const majorCode = record.majorCode;
      if (!summary.majorCategories[majorCode]) {
        summary.majorCategories[majorCode] = {
          code: majorCode,
          income: 0,
          expense: 0,
          minorCategories: {}
        };
      }

      if (record.income) {
        summary.majorCategories[majorCode].income += record.income;
      }
      if (record.expense) {
        summary.majorCategories[majorCode].expense += record.expense;
      }

      const minorCode = record.minorCode;
      if (!summary.majorCategories[majorCode].minorCategories[minorCode]) {
        summary.majorCategories[majorCode].minorCategories[minorCode] = {
          code: minorCode,
          name: record.minorName,
          income: 0,
          expense: 0
        };
      }

      if (record.income) {
        summary.majorCategories[majorCode].minorCategories[minorCode].income += record.income;
      }
      if (record.expense) {
        summary.majorCategories[majorCode].minorCategories[minorCode].expense += record.expense;
      }

      const paymentMethod = record.paymentMethod || '未知';
      if (!summary.paymentMethods[paymentMethod]) {
        summary.paymentMethods[paymentMethod] = {
          method: paymentMethod,
          income: 0,
          expense: 0
        };
      }

      if (record.income) {
        summary.paymentMethods[paymentMethod].income += record.income;
      }
      if (record.expense) {
        summary.paymentMethods[paymentMethod].expense += record.expense;
      }
    });

    summary.balance = summary.totalIncome - summary.totalExpense;

    const majorCategoriesArray = [];
    Object.keys(summary.majorCategories).forEach(majorCode => {
      const majorCategory = summary.majorCategories[majorCode];

      const minorCategoriesArray = [];
      Object.keys(majorCategory.minorCategories).forEach(minorCode => {
        minorCategoriesArray.push(majorCategory.minorCategories[minorCode]);
      });

      majorCategory.minorCategories = minorCategoriesArray;
      majorCategoriesArray.push(majorCategory);
    });

    const paymentMethodsArray = [];
    Object.keys(summary.paymentMethods).forEach(method => {
      paymentMethodsArray.push(summary.paymentMethods[method]);
    });

    summary.majorCategories = majorCategoriesArray;
    summary.paymentMethods = paymentMethodsArray;

    BK_logInfo(`生成記帳摘要報告成功: ${summary.records}條記錄, 總收入=${summary.totalIncome}, 總支出=${summary.totalExpense}`, "報表生成", userId || "", "BK_generateSummaryReport");
    return summary;
  } catch (error) {
    BK_logError(`生成記帳摘要報告失敗: ${error.toString()}`, "報表生成", userId || "", "REPORT_ERROR", error.toString(), "BK_generateSummaryReport");
    throw new Error(`生成記帳摘要報告失敗: ${error.toString()}`);
  }
}

/**
 * 19. 判斷模組是否已初始化
 * @version 2025-01-03-V1.1.0
 * @date 2025-01-03 17:30:00
 * @description 檢查BK模組初始化狀態
 */
function BK_isInitialized() {
  return BK_INIT_STATUS.initialized;
}

/**
 * 20. 處理用戶消息並提取記帳信息 - 從 DD2 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD2 模組複製，支援 BK 2.0 直連路徑
 */
async function BK_processUserMessage(message, userId = "", timestamp = "", ledgerId = "") {
  const msgId = require('crypto').randomUUID().substring(0, 8);

  if (!userId) {
    BK_logError(`缺少必要的用戶ID [${msgId}]`, "訊息處理", "", "MISSING_USER_ID", "每個用戶都需要獨立的帳本", "BK_processUserMessage");
    return {
      type: "記帳",
      processed: false,
      reason: "缺少用戶ID",
      processId: msgId,
      errorType: "MISSING_USER_ID"
    };
  }

  if (!ledgerId) {
    ledgerId = `user_${userId}`;
  }

  BK_logInfo(`處理用戶消息: "${message}" (帳本: ${ledgerId})`, "訊息處理", userId, "BK_processUserMessage");

  // 檢查並確保用戶有科目數據
  try {
    const AM = require('./2009. AM.js');
    if (typeof AM.AM_ensureUserSubjects === 'function') {
      BK_logInfo(`檢查用戶 ${userId} 科目數據 [${msgId}]`, "科目檢查", userId, "BK_processUserMessage");
      const subjectCheckResult = await AM.AM_ensureUserSubjects(userId);
      if (!subjectCheckResult.success) {
        BK_logWarning(`用戶 ${userId} 科目數據檢查失敗: ${subjectCheckResult.error} [${msgId}]`, "科目檢查", userId, "BK_processUserMessage");
      } else {
        BK_logInfo(`用戶 ${userId} 科目數據檢查完成 [${msgId}]`, "科目檢查", userId, "BK_processUserMessage");
      }
    }
  } catch (amError) {
    BK_logWarning(`調用 AM 模組檢查科目失敗: ${amError.toString()} [${msgId}]`, "科目檢查", userId, "BK_processUserMessage");
  }

  try {
    if (!message || message.trim() === "") {
      BK_logWarning(`空訊息 [${msgId}]`, "訊息處理", userId, "BK_processUserMessage");
      return {
        type: "記帳",
        processed: false,
        reason: "空訊息",
        processId: msgId,
        errorType: "EMPTY_MESSAGE"
      };
    }

    message = message.trim();

    const parseResult = await BK_parseInputFormat(message, msgId);
    if (!parseResult) {
      BK_logWarning(`無法解析訊息格式: "${message}" [${msgId}]`, "訊息處理", userId, "BK_processUserMessage");
      return {
        type: "記帳",
        processed: false,
        reason: "無法識別記帳意圖",
        processId: msgId,
        errorType: "FORMAT_NOT_RECOGNIZED"
      };
    }

    const subject = parseResult.subject;
    const amount = parseResult.amount;
    const rawAmount = parseResult.rawAmount || String(amount);
    const paymentMethod = parseResult.paymentMethod;

    if (subject) {
      let subjectInfo = null;
      let matchMethod = "unknown";
      let confidence = 0;
      let originalSubject = subject;

      try {
        subjectInfo = await BK_getSubjectCode(subject, userId);
        if (subjectInfo) {
          matchMethod = "exact_match";
          confidence = 1.0;
          BK_logInfo(`精確匹配成功 "${subject}" -> ${subjectInfo.subName} [${msgId}]`, "科目匹配", userId, "BK_processUserMessage");
        }
      } catch (matchError) {
        BK_logWarning(`精確匹配發生錯誤 ${matchError.toString()} [${msgId}]`, "科目匹配", userId, "BK_processUserMessage");
      }

      if (!subjectInfo) {
        try {
          const fuzzyThreshold = 0.7;
          const fuzzyMatch = await BK_fuzzyMatch(subject, fuzzyThreshold, userId);
          if (fuzzyMatch && fuzzyMatch.score >= fuzzyThreshold) {
            subjectInfo = fuzzyMatch;
            matchMethod = "fuzzy_match";
            confidence = fuzzyMatch.score;
            BK_logInfo(`模糊匹配成功 "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)} [${msgId}]`, "科目匹配", userId, "BK_processUserMessage");
          }
        } catch (fuzzyError) {
          BK_logWarning(`模糊匹配發生錯誤 ${fuzzyError.toString()} [${msgId}]`, "科目匹配", userId, "BK_processUserMessage");
        }
      }

      if (subjectInfo) {
        let action = "支出";
        if (amount < 0) {
          action = "支出";
        } else {
          if (subjectInfo.majorCode && subjectInfo.majorCode.toString().startsWith("8")) {
            action = "收入";
          } else {
            action = "支出";
          }
        }

        const remarkText = BK_removeAmountFromText(message, amount) || subject;

        const result = {
          type: "記帳",
          processed: true,
          subject: subject,
          subjectName: subjectInfo.subName,
          majorCode: subjectInfo.majorCode,
          majorName: subjectInfo.majorName,
          subCode: subjectInfo.subCode,
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          action: action,
          confidence: confidence,
          matchMethod: matchMethod,
          text: remarkText,
          originalSubject: originalSubject,
          processId: msgId,
          ledgerId: ledgerId,
        };

        return result;
      } else {
        BK_logWarning(`科目匹配失敗 [${msgId}]`, "科目匹配", userId, "BK_processUserMessage");
        return {
          type: "記帳",
          processed: false,
          reason: `無法識別科目: "${subject}"`,
          processId: msgId,
          errorType: "UNKNOWN_SUBJECT"
        };
      }
    } else {
      BK_logWarning(`科目為空 [${msgId}]`, "科目匹配", userId, "BK_processUserMessage");
      return {
        type: "記帳",
        processed: false,
        reason: "未指定科目",
        processId: msgId,
        errorType: "MISSING_SUBJECT"
      };
    }
  } catch (error) {
    BK_logError(`處理用戶消息時發生異常: ${error.toString()}`, "訊息處理", userId, "PROCESS_ERROR", error.toString(), "BK_processUserMessage");
    return {
      type: "記帳",
      processed: false,
      reason: error.toString(),
      processId: msgId,
      errorType: "PROCESS_ERROR"
    };
  }
}

/**
 * 21. 解析輸入格式 - 從 DD2 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD2 模組複製，支援 BK 2.0 直連路徑
 */
function BK_parseInputFormat(message, processId) {
  BK_logDebug(`開始解析文本「${message}」[${processId}]`, "文本解析", "", "BK_parseInputFormat");

  if (!message || message.trim() === "") {
    BK_logDebug(`空文本 [${processId}]`, "文本解析", "", "BK_parseInputFormat");
    return null;
  }

  message = message.trim();

  try {
    // 檢測負數模式
    const negativePattern = /^(.+?)(-\d+)(.*)$/;
    const negativeMatch = message.match(negativePattern);

    if (negativeMatch) {
      const subject = negativeMatch[1].trim();
      const rawAmount = negativeMatch[2];
      const amount = parseFloat(rawAmount);

      let paymentMethod = "預設";
      const remainingText = negativeMatch[3].trim();

      const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
      for (const method of paymentMethods) {
        if (remainingText.includes(method)) {
          paymentMethod = method;
          break;
        }
      }

      if (paymentMethod === "預設" && remainingText) {
        paymentMethod = remainingText;
      }

      BK_logInfo(`識別負數格式 - 科目:「${subject}」, 金額:${rawAmount}, 支付方式:「${paymentMethod}」 [${processId}]`, "文本解析", "", "BK_parseInputFormat");

      if (amount < 0) {
        BK_logWarning(`檢測到負數金額 ${amount} [${processId}]`, "文本解析", "", "BK_parseInputFormat");
        return null; // 返回 null 表示格式錯誤
      }

      return {
        subject: subject,
        amount: Math.abs(amount),
        rawAmount: String(Math.abs(amount)),
        paymentMethod: paymentMethod,
      };
    }

    // 標準格式處理
    const regex = /^(.+?)(\d+)(.*)$/;
    const match = message.match(regex);

    if (match) {
      const subject = match[1].trim();
      const amount = parseInt(match[2], 10);
      const rawAmount = match[2];

      let paymentMethod = "預設";
      const remainingText = match[3].trim();

      const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
      for (const method of paymentMethods) {
        if (remainingText.includes(method)) {
          paymentMethod = method;
          break;
        }
      }

      if (paymentMethod === "預設" && remainingText) {
        paymentMethod = remainingText;
      }

      BK_logInfo(`識別標準格式 - 科目:「${subject}」, 金額:${amount}, 支付方式:「${paymentMethod}」 [${processId}]`, "文本解析", "", "BK_parseInputFormat");

      if (subject === "") {
        BK_logWarning(`未明確指定科目名稱 [${processId}]`, "文本解析", "", "BK_parseInputFormat");
        return null;
      }

      return {
        subject: subject,
        amount: amount,
        rawAmount: rawAmount,
        paymentMethod: paymentMethod,
      };
    } else {
      BK_logDebug(`無法解析格式 [${processId}]`, "文本解析", "", "BK_parseInputFormat");
      return null;
    }
  } catch (error) {
    BK_logError(`解析錯誤 ${error} [${processId}]`, "文本解析", "", "PARSE_ERROR", error.toString(), "BK_parseInputFormat");
    return null;
  }
}

/**
 * 22. 從文字中移除金額 - 從 DD2 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD2 模組複製，支援 BK 2.0 直連路徑
 */
function BK_removeAmountFromText(text, amount, paymentMethod) {
  if (!text || !amount) return text;

  BK_logDebug(`處理文字移除金額和支付方式: 原始文字="${text}", 金額=${amount}, 支付方式=${paymentMethod || "未指定"}`, "文本處理", "", "BK_removeAmountFromText");

  const amountStr = String(amount);
  let result = text;

  try {
    if (paymentMethod && text.includes(" " + amountStr + " " + paymentMethod)) {
      result = text.replace(" " + amountStr + " " + paymentMethod, "").trim();
      return result;
    }

    if (text.includes(" " + amountStr)) {
      result = text.replace(" " + amountStr, "").trim();
      if (paymentMethod && result.includes(" " + paymentMethod)) {
        result = result.replace(" " + paymentMethod, "").trim();
      }
      return result;
    }

    if (text.endsWith(amountStr)) {
      result = text.substring(0, text.length - amountStr.length).trim();
      if (paymentMethod && result.includes(paymentMethod)) {
        result = result.replace(paymentMethod, "").trim();
      }
      return result;
    }

    const amountEndRegex = new RegExp(`${amountStr}(元|塊|圓|NT|USD)?$`, "i");
    const match = text.match(amountEndRegex);
    if (match && match.index > 0) {
      result = text.substring(0, match.index).trim();
      if (paymentMethod && result.includes(paymentMethod)) {
        result = result.replace(paymentMethod, "").trim();
      }
      return result;
    }

    if (paymentMethod && result.includes(paymentMethod)) {
      result = result.replace(paymentMethod, "").trim();
      return result;
    }

    return text;
  } catch (error) {
    BK_logError(`移除金額和支付方式失敗: ${error.toString()}, 返回原始文字`, "文本處理", "", "TEXT_PROCESS_ERROR", error.toString(), "BK_removeAmountFromText");
    return text;
  }
}

/**
 * 23. 獲取科目代碼 - 從 DD2 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD2 模組複製，支援 BK 2.0 直連路徑，增強 Firestore 連線檢查
 */
async function BK_getSubjectCode(subjectName, userId) {
  const scId = require('crypto').randomUUID().substring(0, 8);
  BK_logInfo(`查詢科目代碼: "${subjectName}", 用戶ID: ${userId}, ID=${scId}`, "科目查詢", userId, "BK_getSubjectCode");

  try {
    if (!subjectName || !userId) {
      BK_logError(`科目名稱或用戶ID為空，無法查詢科目代碼 [${scId}]`, "科目查詢", userId, "MISSING_PARAMS", "缺少必要參數", "BK_getSubjectCode");
      throw new Error("找不到科目「" + (subjectName || "未知") + "」，請確認科目名稱或使用其他相近詞彙");
    }

    const ledgerId = `user_${userId}`;
    const normalizedInput = String(subjectName).trim();
    const inputLower = normalizedInput.toLowerCase();

    // 確保 Firestore 已初始化
    if (!BK_INIT_STATUS.firestore_db) {
      BK_logWarning(`Firestore 未初始化，嘗試重新初始化 [${scId}]`, "科目查詢", userId, "BK_getSubjectCode");
      await initializeFirestore();
    }

    const db = BK_INIT_STATUS.firestore_db;
    
    // 再次檢查 db 是否為 null
    if (!db) {
      BK_logError(`Firestore 實例為 null，無法查詢科目 [${scId}]`, "科目查詢", userId, "FIRESTORE_NULL", "Firestore 實例為 null", "BK_getSubjectCode");
      throw new Error("系統科目表暫時無法使用，請留言給客服人員。");
    }
    const snapshot = await db.collection("ledgers").doc(ledgerId).collection("subjects").where("isActive", "==", true).get();

    if (snapshot.empty) {
      BK_logError(`用戶 ${userId} 科目表為空 [${scId}]`, "科目查詢", userId, "EMPTY_SUBJECTS", "科目代碼表無數據", "BK_getSubjectCode");
      throw new Error("系統科目表暫時無法使用，請留言給客服人員。");
    }

    BK_logInfo(`讀取用戶 ${userId} 科目表: ${snapshot.size}筆數據 [${scId}]`, "科目查詢", userId, "BK_getSubjectCode");

    let docCount = 0;
    for (const doc of snapshot.docs) {
      if (doc.id === "template") continue;

      const data = doc.data();
      docCount++;

      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
      const synonymsStr = data.同義詞 || "";

      const normalizedSubName = String(subName).trim();
      const subNameLower = normalizedSubName.toLowerCase();

      // 精確匹配檢查
      if (subNameLower === inputLower) {
        BK_logInfo(`成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`, "科目查詢", userId, "BK_getSubjectCode");
        return {
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        };
      }

      // 同義詞匹配
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (let j = 0; j < synonyms.length; j++) {
          const normalizedSynonym = synonyms[j].trim();
          const synonymLower = normalizedSynonym.toLowerCase();
          if (synonymLower === inputLower) {
            BK_logInfo(`通過同義詞成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`, "科目查詢", userId, "BK_getSubjectCode");
            return {
              majorCode: String(majorCode),
              majorName: String(majorName),
              subCode: String(subCode),
              subName: String(subName),
            };
          }
        }
      }
    }

    // 複合詞匹配
    const matches = [];
    for (const doc of snapshot.docs) {
      if (doc.id === "template") continue;
      const data = doc.data();
      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
      const synonymsStr = data.同義詞 || "";
      const subNameLower = String(subName).toLowerCase().trim();

      if (subNameLower.length >= 2 && inputLower.includes(subNameLower)) {
        const score = subNameLower.length / inputLower.length;
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
          score: score,
          matchType: "compound_name",
        });
      }

      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const syn of synonyms) {
          const synonym = syn.trim().toLowerCase();
          if (synonym.length >= 2 && inputLower.includes(synonym)) {
            const score = synonym.length / inputLower.length;
            matches.push({
              majorCode: String(majorCode),
              majorName: String(majorName),
              subCode: String(subCode),
              subName: String(subName),
              score: score,
              matchType: "compound_synonym",
            });
          }
        }
      }
    }

    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];
      BK_logInfo(`複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}`, "複合詞匹配", userId, "BK_getSubjectCode");
      return {
        majorCode: bestMatch.majorCode,
        majorName: bestMatch.majorName,
        subCode: bestMatch.subCode,
        subName: bestMatch.subName,
      };
    }

    BK_logWarning(`科目代碼查詢失敗: "${normalizedInput}" [${scId}]`, "科目查詢", userId, "BK_getSubjectCode");
    throw new Error("找不到科目「" + normalizedInput + "」，請確認科目名稱或使用其他相近詞彙");
  } catch (error) {
    BK_logError(`科目查詢出錯: ${error} [${scId}]`, "科目查詢", userId, "QUERY_ERROR", error.toString(), "BK_getSubjectCode");
    if (error.message.includes("找不到科目") || error.message.includes("系統科目表暫時無法使用")) {
      throw error;
    }
    throw new Error("系統科目表暫時無法使用，請留言給客服人員。");
  }
}

/**
 * 24. 模糊匹配函數 - 從 DD2 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD2 模組複製，支援 BK 2.0 直連路徑
 */
async function BK_fuzzyMatch(input, threshold = 0.6, userId = null) {
  if (!input || !userId) return null;

  BK_logDebug(`【模糊匹配】開始處理: "${input}", 閾值: ${threshold}, 用戶: ${userId}`, "模糊匹配", userId, "BK_fuzzyMatch");

  const inputLower = input.toLowerCase().trim();
  const allSubjects = await BK_getAllSubjects(userId);
  if (!allSubjects || !allSubjects.length) {
    BK_logWarning(`【模糊匹配】無法獲取科目列表`, "模糊匹配", userId, "BK_fuzzyMatch");
    return null;
  }

  const containsMatches = [];
  allSubjects.forEach((subject) => {
    const subNameLower = subject.subName.toLowerCase();
    if (subNameLower.length >= 2 && inputLower.includes(subNameLower)) {
      const score = (subNameLower.length / inputLower.length) * 0.9;
      containsMatches.push({
        ...subject,
        score: Math.min(0.9, score),
        matchType: "input_contains_subject_name",
        matchedTerm: subNameLower,
      });
    }

    if (subject.synonyms) {
      const synonymsList = subject.synonyms.split(",").map((syn) => syn.trim().toLowerCase());
      for (const synonym of synonymsList) {
        if (synonym.length >= 2 && inputLower.includes(synonym)) {
          const score = (synonym.length / inputLower.length) * 0.95;
          containsMatches.push({
            ...subject,
            score: Math.min(0.95, score),
            matchType: "input_contains_synonym",
            matchedTerm: synonym,
          });
        }
      }
    }
  });

  if (containsMatches.length > 0) {
    containsMatches.sort((a, b) => b.score - a.score);
    const bestMatch = containsMatches[0];
    BK_logInfo(`【模糊匹配】複合詞最佳匹配: "${input}" -> "${bestMatch.subName}", 包含詞: "${bestMatch.matchedTerm}", 分數: ${bestMatch.score.toFixed(2)}`, "模糊匹配", userId, "BK_fuzzyMatch");
    return {
      majorCode: bestMatch.majorCode,
      majorName: bestMatch.majorName,
      subCode: bestMatch.subCode,
      subName: bestMatch.subName,
      synonyms: bestMatch.synonyms,
      score: bestMatch.score,
      matchType: bestMatch.matchType,
    };
  }

  return null;
}

/**
 * 25. 獲取所有科目資料 - 從 DD1 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD1 模組複製，支援 BK 2.0 直連路徑，增強 Firestore 連線檢查
 */
async function BK_getAllSubjects(userId) {
  try {
    if (!userId) {
      throw new Error("缺少使用者ID，每個使用者都需要獨立的帳本");
    }

    const ledgerId = `user_${userId}`;
    BK_logInfo(`開始從Firestore獲取科目資料，使用者帳本: ${ledgerId}`, "科目查詢", userId, "BK_getAllSubjects");

    // 確保 Firestore 已初始化
    if (!BK_INIT_STATUS.firestore_db) {
      BK_logWarning(`Firestore 未初始化，嘗試重新初始化`, "科目查詢", userId, "BK_getAllSubjects");
      await initializeFirestore();
    }

    const db = BK_INIT_STATUS.firestore_db;
    
    // 檢查 db 是否為 null
    if (!db) {
      BK_logError(`Firestore 實例為 null，無法獲取科目資料`, "科目查詢", userId, "FIRESTORE_NULL", "Firestore 實例為 null", "BK_getAllSubjects");
      throw new Error("系統科目表暫時無法使用，請留言給客服人員。");
    }
    const subjectsRef = db.collection("ledgers").doc(ledgerId).collection("subjects");
    const snapshot = await subjectsRef.where("isActive", "==", true).get();

    if (snapshot.empty) {
      BK_logWarning(`使用者 ${userId} 沒有找到任何科目資料`, "科目查詢", userId, "BK_getAllSubjects");
      return [];
    }

    const subjects = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (doc.id === "template") return;

      subjects.push({
        majorCode: data.大項代碼,
        majorName: data.大項名稱,
        subCode: data.子項代碼,
        subName: data.子項名稱,
        synonyms: data.同義詞 || "",
      });
    });

    BK_logInfo(`成功獲取使用者 ${userId} 的 ${subjects.length} 個科目`, "科目查詢", userId, "BK_getAllSubjects");
    return subjects;
  } catch (error) {
    BK_logError(`獲取科目資料失敗: ${error.toString()}`, "科目查詢", userId, "SUBJECTS_ERROR", error.toString(), "BK_getAllSubjects");
    throw error;
  }
}

/**
 * 26. 格式化系統回覆訊息 - 從 DD3 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD3 模組複製，支援 BK 2.0 直連路徑
 */
async function BK_formatSystemReplyMessage(resultData, moduleCode, options = {}) {
  const userId = options.userId || "";
  const processId = options.processId || require('crypto').randomUUID().substring(0, 8);
  let errorMsg = "未知錯誤";

  const currentDateTime = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  BK_logDebug(`開始格式化訊息 [${processId}], 模組: ${moduleCode}`, "訊息格式化", userId, "BK_formatSystemReplyMessage");

  try {
    if (resultData && resultData.responseMessage) {
      BK_logDebug(`使用現有回覆訊息 [${processId}]`, "訊息格式化", userId, "BK_formatSystemReplyMessage");
      return {
        success: resultData.success === true,
        responseMessage: resultData.responseMessage,
        originalResult: resultData.originalResult || resultData,
        processId: processId,
        errorType: resultData.errorType || null,
        moduleCode: moduleCode,
        partialData: resultData.partialData || {},
        error: resultData.success === true ? undefined : errorMsg,
      };
    }

    if (!resultData) {
      resultData = {
        success: false,
        error: "無處理結果資料",
        errorType: "MISSING_RESULT_DATA",
        message: "無處理結果資料",
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "支付方式未指定",
          timestamp: new Date().getTime(),
        },
      };
    }

    let responseMessage = "";
    const isSuccess = resultData.success === true;
    let partialData = resultData.parsedData || resultData.partialData || resultData.data || {};

    if (isSuccess) {
      if (resultData.responseMessage) {
        responseMessage = resultData.responseMessage;
      } else if (resultData.data) {
        const data = resultData.data;
        const subjectName = data.subjectName || partialData.subject || "";
        const amount = data.rawAmount || partialData.rawAmount || data.amount || 0;
        const action = data.action || resultData.action || "支出";
        const paymentMethod = data.paymentMethod || partialData.paymentMethod || "";
        const date = data.date || currentDateTime;
        const remark = data.remark || partialData.remark || "無";
        const userType = data.userType || "J";

        responseMessage =
          `記帳成功！\n` +
          `金額：${amount}元 (${action})\n` +
          `支付方式：${paymentMethod}\n` +
          `時間：${date}\n` +
          `科目：${subjectName}\n` +
          `備註：${remark}\n` +
          `使用者類型：${userType}`;
      } else {
        responseMessage = `操作成功！\n處理ID: ${processId}`;
      }
    } else {
      errorMsg = resultData.error || resultData.message || resultData.errorData?.error || "未知錯誤";
      const subject = partialData.subject || "未知科目";
      const displayAmount = partialData.rawAmount || (partialData.amount !== undefined ? String(partialData.amount) : "0");
      const paymentMethod = partialData.paymentMethod || "未指定支付方式";
      const remark = partialData.remark || "無";

      responseMessage =
        `記帳失敗！\n` +
        `金額：${displayAmount}元\n` +
        `支付方式：${paymentMethod}\n` +
        `時間：${currentDateTime}\n` +
        `科目：${subject}\n` +
        `備註：${remark}\n` +
        `使用者類型：J\n` +
        `錯誤原因：${errorMsg}`;
    }

    BK_logDebug(`訊息格式化完成 [${processId}]`, "訊息格式化", userId, "BK_formatSystemReplyMessage");

    return {
      success: isSuccess,
      responseMessage: responseMessage,
      originalResult: resultData,
      processId: processId,
      errorType: resultData.errorType || null,
      moduleCode: moduleCode,
      partialData: partialData,
      error: isSuccess ? undefined : errorMsg,
    };
  } catch (error) {
    BK_logError(`格式化過程出錯: ${error.message} [${processId}]`, "訊息格式化", userId, "FORMAT_ERROR", error.toString(), "BK_formatSystemReplyMessage");

    const fallbackMessage = `記帳失敗！\n時間：${currentDateTime}\n科目：未知科目\n金額：0元\n支付方式：未指定支付方式\n備註：無\n使用者類型：J\n錯誤原因：訊息格式化錯誤`;

    return {
      success: false,
      responseMessage: fallbackMessage,
      processId: processId,
      errorType: "FORMAT_ERROR",
      moduleCode: moduleCode,
      error: error.toString(),
    };
  }
}

/**
 * 27. 轉換時間戳 - 從 DD1 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD1 模組複製，支援 BK 2.0 直連路徑
 */
function BK_convertTimestamp(timestamp) {
  const tsId = require('crypto').randomUUID().substring(0, 8);
  BK_logDebug(`開始轉換時間戳: ${timestamp} [${tsId}]`, "時間處理", "", "BK_convertTimestamp");

  try {
    if (timestamp === null || timestamp === undefined) {
      BK_logDebug(`時間戳為空 [${tsId}]`, "時間處理", "", "BK_convertTimestamp");
      return null;
    }

    let date;
    if (typeof timestamp === "number" || /^\d+$/.test(timestamp)) {
      date = new Date(Number(timestamp));
    } else if (typeof timestamp === "string" && timestamp.includes("T")) {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) {
      BK_logDebug(`無法轉換為有效日期: ${timestamp} [${tsId}]`, "時間處理", "", "BK_convertTimestamp");
      return null;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const taiwanDate = `${year}/${month}/${day}`;

    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const taiwanTime = `${hours}:${minutes}`;

    const result = { date: taiwanDate, time: taiwanTime };
    BK_logDebug(`時間戳轉換結果: ${taiwanDate} ${taiwanTime} [${tsId}]`, "時間處理", "", "BK_convertTimestamp");
    return result;
  } catch (error) {
    BK_logError(`時間戳轉換錯誤: ${error.toString()} [${tsId}]`, "時間處理", "", "TIMESTAMP_ERROR", error.toString(), "BK_convertTimestamp");
    return null;
  }
}

/**
 * 28. 檢查多重映射 - 從 DD2 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD2 模組複製，支援 BK 2.0 直連路徑
 */
async function BK_checkMultipleMapping(subjectName, userId) {
  const cmdId = require('crypto').randomUUID().substring(0, 8);
  BK_logDebug(`檢查多重映射: "${subjectName}", 用戶: ${userId} [${cmdId}]`, "多重映射檢查", userId, "BK_checkMultipleMapping");

  try {
    if (!subjectName || !userId) {
      BK_logWarning(`檢查多重映射缺少參數 [${cmdId}]`, "多重映射檢查", userId, "BK_checkMultipleMapping");
      return null;
    }

    const ledgerId = `user_${userId}`;
    const normalizedInput = String(subjectName).trim().toLowerCase();

    const db = BK_INIT_STATUS.firestore_db;
    const snapshot = await db.collection("ledgers").doc(ledgerId).collection("subjects").where("isActive", "==", true).get();

    if (snapshot.empty) {
      BK_logWarning(`用戶 ${userId} 科目表為空 [${cmdId}]`, "多重映射檢查", userId, "BK_checkMultipleMapping");
      return null;
    }

    const matches = [];
    
    snapshot.forEach(doc => {
      if (doc.id === "template") return;
      
      const data = doc.data();
      const subName = String(data.子項名稱).trim().toLowerCase();
      const synonymsStr = data.同義詞 || "";
      
      // 檢查科目名稱匹配
      if (subName === normalizedInput) {
        matches.push({
          majorCode: data.大項代碼,
          majorName: data.大項名稱,
          subCode: data.子項代碼,
          subName: data.子項名稱,
          matchType: "exact_name"
        });
      }
      
      // 檢查同義詞匹配
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const synonym of synonyms) {
          const normalizedSynonym = synonym.trim().toLowerCase();
          if (normalizedSynonym === normalizedInput) {
            matches.push({
              majorCode: data.大項代碼,
              majorName: data.大項名稱,
              subCode: data.子項代碼,
              subName: data.子項名稱,
              matchType: "exact_synonym"
            });
          }
        }
      }
    });

    if (matches.length > 1) {
      BK_logWarning(`檢測到多重映射: "${subjectName}" 匹配到 ${matches.length} 個科目 [${cmdId}]`, "多重映射檢查", userId, "BK_checkMultipleMapping");
      return {
        hasMultipleMatches: true,
        matches: matches,
        count: matches.length
      };
    } else if (matches.length === 1) {
      BK_logDebug(`科目映射唯一: "${subjectName}" [${cmdId}]`, "多重映射檢查", userId, "BK_checkMultipleMapping");
      return {
        hasMultipleMatches: false,
        matches: matches,
        count: 1
      };
    } else {
      BK_logDebug(`無匹配科目: "${subjectName}" [${cmdId}]`, "多重映射檢查", userId, "BK_checkMultipleMapping");
      return null;
    }
  } catch (error) {
    BK_logError(`檢查多重映射錯誤: ${error.toString()} [${cmdId}]`, "多重映射檢查", userId, "MULTIPLE_MAPPING_ERROR", error.toString(), "BK_checkMultipleMapping");
    return null;
  }
}

/**
 * 29. 獲取帳本資訊 - 從 DD1 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD1 模組複製，支援 BK 2.0 直連路徑
 */
async function BK_getLedgerInfo(userId) {
  const lgiId = require('crypto').randomUUID().substring(0, 8);
  BK_logDebug(`獲取帳本資訊，用戶: ${userId} [${lgiId}]`, "帳本查詢", userId, "BK_getLedgerInfo");

  try {
    if (!userId) {
      BK_logError(`缺少用戶ID [${lgiId}]`, "帳本查詢", "", "MISSING_USER_ID", "缺少用戶ID", "BK_getLedgerInfo");
      throw new Error("缺少用戶ID");
    }

    const ledgerId = `user_${userId}`;
    
    const db = BK_INIT_STATUS.firestore_db;
    
    // 獲取帳本基本資訊
    const ledgerDoc = await db.collection("ledgers").doc(ledgerId).get();
    
    if (!ledgerDoc.exists) {
      BK_logWarning(`用戶 ${userId} 帳本不存在 [${lgiId}]`, "帳本查詢", userId, "BK_getLedgerInfo");
      return {
        exists: false,
        ledgerId: ledgerId,
        userId: userId
      };
    }

    const ledgerData = ledgerDoc.data();
    
    // 獲取科目數量
    const subjectsSnapshot = await db.collection("ledgers").doc(ledgerId).collection("subjects").where("isActive", "==", true).get();
    
    // 獲取記帳記錄數量（最近30天）
    const thirtyDaysAgo = moment().subtract(30, 'days').format("YYYY/MM/DD");
    const entriesSnapshot = await db.collection("ledgers").doc(ledgerId).collection("entries")
      .where("日期", ">=", thirtyDaysAgo)
      .get();

    const ledgerInfo = {
      exists: true,
      ledgerId: ledgerId,
      userId: userId,
      createdAt: ledgerData.createdAt || null,
      lastModified: ledgerData.lastModified || null,
      userType: ledgerData.userType || "J",
      subjectsCount: subjectsSnapshot.size,
      entriesCount30Days: entriesSnapshot.size,
      metadata: ledgerData.metadata || {}
    };

    BK_logInfo(`獲取帳本資訊成功: ${subjectsSnapshot.size}個科目, ${entriesSnapshot.size}條記錄(30天) [${lgiId}]`, "帳本查詢", userId, "BK_getLedgerInfo");
    return ledgerInfo;

  } catch (error) {
    BK_logError(`獲取帳本資訊失敗: ${error.toString()} [${lgiId}]`, "帳本查詢", userId, "LEDGER_INFO_ERROR", error.toString(), "BK_getLedgerInfo");
    throw error;
  }
}

/**
 * 30. 寫入日誌表 - 從 DD1 複製並適配 Firestore
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD1 模組複製，改用 Firestore 存儲
 */
async function BK_writeToLogSheet(logData, userId = null) {
  const wlsId = require('crypto').randomUUID().substring(0, 8);
  BK_logDebug(`寫入日誌表 [${wlsId}]`, "日誌寫入", userId || "", "BK_writeToLogSheet");

  try {
    if (!logData || !Array.isArray(logData) || logData.length < 10) {
      BK_logError(`無效的日誌數據格式 [${wlsId}]`, "日誌寫入", userId || "", "INVALID_LOG_DATA", "日誌數據格式錯誤", "BK_writeToLogSheet");
      return false;
    }

    // 準備 Firestore 日誌文檔
    const logDoc = {
      時間戳記: logData[0] || admin.firestore.Timestamp.now().toDate().toISOString(),
      訊息: logData[1] || "",
      操作類型: logData[2] || "",
      使用者ID: logData[3] || userId || "",
      錯誤代碼: logData[4] || "",
      來源: logData[5] || "BK",
      錯誤詳情: logData[6] || "",
      重試次數: logData[7] || 0,
      程式碼位置: logData[8] || "",
      嚴重等級: logData[9] || "INFO",
      createdAt: admin.firestore.Timestamp.now()
    };

    const db = BK_INIT_STATUS.firestore_db;
    let collectionPath;

    // 決定寫入位置
    if (userId) {
      // 寫入用戶專屬日誌
      collectionPath = db.collection('ledgers').doc(`user_${userId}`).collection('log');
    } else {
      // 寫入系統日誌
      collectionPath = db.collection('system_logs');
    }

    const docRef = await collectionPath.add(logDoc);

    BK_logDebug(`日誌寫入成功，文檔ID: ${docRef.id} [${wlsId}]`, "日誌寫入", userId || "", "BK_writeToLogSheet");
    return true;

  } catch (error) {
    BK_logError(`寫入日誌表失敗: ${error.toString()} [${wlsId}]`, "日誌寫入", userId || "", "LOG_WRITE_ERROR", error.toString(), "BK_writeToLogSheet");
    return false;
  }
}

/**
 * 31. 計算字串相似度 - 從 DD2 複製
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 從 DD2 模組複製，支援 BK 2.0 直連路徑
 */
function BK_calculateLevenshteinDistance(str1, str2) {
  const cldId = require('crypto').randomUUID().substring(0, 8);
  BK_logDebug(`計算字串相似度: "${str1}" vs "${str2}" [${cldId}]`, "相似度計算", "", "BK_calculateLevenshteinDistance");

  try {
    if (!str1 || !str2) {
      BK_logWarning(`字串為空，返回最大距離 [${cldId}]`, "相似度計算", "", "BK_calculateLevenshteinDistance");
      return Math.max(str1 ? str1.length : 0, str2 ? str2.length : 0);
    }

    const s1 = String(str1).toLowerCase().trim();
    const s2 = String(str2).toLowerCase().trim();

    if (s1 === s2) {
      BK_logDebug(`字串完全相同，距離為0 [${cldId}]`, "相似度計算", "", "BK_calculateLevenshteinDistance");
      return 0;
    }

    const len1 = s1.length;
    const len2 = s2.length;

    // 創建距離矩陣
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    // 初始化第一行和第一列
    for (let i = 0; i <= len1; i++) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // 填充矩陣
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // 刪除
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j - 1] + cost // 替換
        );
      }
    }

    const distance = matrix[len1][len2];
    BK_logDebug(`計算完成，編輯距離: ${distance} [${cldId}]`, "相似度計算", "", "BK_calculateLevenshteinDistance");
    
    return distance;

  } catch (error) {
    BK_logError(`計算字串相似度錯誤: ${error.toString()} [${cldId}]`, "相似度計算", "", "LEVENSHTEIN_ERROR", error.toString(), "BK_calculateLevenshteinDistance");
    return Math.max(str1 ? str1.length : 0, str2 ? str2.length : 0);
  }
}

/**
 * 32. 處理簡單記帳的主函數 - BK 2.0 核心函數
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 16:00:00
 * @update: 實現 BK 2.0 直連路徑，WH → BK 2.0 → Firestore
 */
async function BK_processDirectBookkeeping(event) {
  const processId = require('crypto').randomUUID().substring(0, 8);
  BK_logInfo(`BK 2.0: 開始處理簡單記帳 [${processId}]`, "簡單記帳", event.source?.userId || "", "BK_processDirectBookkeeping");

  try {
    // 1. 提取用戶資訊
    const userId = event.source?.userId;
    const replyToken = event.replyToken;
    const messageText = event.message?.text;

    if (!userId) {
      BK_logError(`BK 2.0: 缺少用戶ID [${processId}]`, "簡單記帳", "", "MISSING_USER_ID", "缺少用戶ID", "BK_processDirectBookkeeping");
      return {
        success: false,
        error: "缺少用戶ID",
        errorType: "MISSING_USER_ID"
      };
    }

    if (!messageText) {
      BK_logError(`BK 2.0: 缺少訊息文字 [${processId}]`, "簡單記帳", userId, "MISSING_MESSAGE", "缺少訊息文字", "BK_processDirectBookkeeping");
      return {
        success: false,
        error: "缺少訊息文字",
        errorType: "MISSING_MESSAGE"
      };
    }

    BK_logInfo(`BK 2.0: 處理用戶 ${userId} 的訊息: "${messageText}" [${processId}]`, "簡單記帳", userId, "BK_processDirectBookkeeping");

    // 2. 處理用戶訊息
    const messageData = {
      text: messageText,
      userId: userId,
      timestamp: event.timestamp,
      replyToken: replyToken,
    };

    const processedData = await BK_processUserMessage(messageText, userId, event.timestamp);
    BK_logInfo(`BK 2.0: 訊息處理結果: ${JSON.stringify(processedData)} [${processId}]`, "簡單記帳", userId, "BK_processDirectBookkeeping");

    if (processedData && processedData.processed) {
      // 3. 建立記帳數據
      const bookkeepingData = {
        action: processedData.action,
        subjectName: processedData.subjectName,
        amount: processedData.amount,
        majorCode: processedData.majorCode,
        subCode: processedData.subCode,
        majorName: processedData.majorName,
        paymentMethod: processedData.paymentMethod,
        text: processedData.text,
        originalSubject: processedData.originalSubject,
        userId: userId,
        userType: "J",
        processId: processId,
        rawAmount: processedData.rawAmount,
      };

      BK_logInfo(`BK 2.0: 準備調用 BK_processBookkeeping [${processId}]`, "簡單記帳", userId, "BK_processDirectBookkeeping");

      // 4. 準備完整的記帳數據，確保 action 參數正確傳遞
      const completeBookkeepingData = {
        action: bookkeepingData.action,
        subjectName: bookkeepingData.subjectName,
        amount: bookkeepingData.amount,
        majorCode: bookkeepingData.majorCode,
        subCode: bookkeepingData.subCode,
        majorName: bookkeepingData.majorName,
        paymentMethod: bookkeepingData.paymentMethod,
        text: bookkeepingData.text,
        originalSubject: bookkeepingData.originalSubject,
        userId: bookkeepingData.userId,
        userType: bookkeepingData.userType,
        processId: processId,
        rawAmount: bookkeepingData.rawAmount,
        // 明確設置 income 和 expense 參數
        income: bookkeepingData.action === "收入" ? bookkeepingData.amount : '',
        expense: bookkeepingData.action === "支出" ? bookkeepingData.amount : ''
      };

      BK_logInfo(`BK 2.0: 準備完整記帳數據，action=${completeBookkeepingData.action}, income=${completeBookkeepingData.income}, expense=${completeBookkeepingData.expense} [${processId}]`, "簡單記帳", userId, "BK_processDirectBookkeeping");

      // 5. 執行記帳
      const result = await BK_processBookkeeping(completeBookkeepingData);
      BK_logInfo(`BK 2.0: 記帳結果: ${result && result.success ? "成功" : "失敗"} [${processId}]`, "簡單記帳", userId, "BK_processDirectBookkeeping");

      // 5. 格式化回覆訊息
      let responseMessage = "";
      if (result.success) {
        responseMessage = `記帳成功！\n金額：${bookkeepingData.rawAmount}元 (${bookkeepingData.action})\n支付方式：${result.data.paymentMethod}\n時間：${result.data.date}\n科目：${bookkeepingData.subjectName}\n備註：${result.data.remark || "無"}\n收支ID：${result.data.id || "未知"}\n使用者類型：${result.data.userType || "J"}`;
      } else {
        responseMessage = `記帳失敗！\n原因：${result.error || result.message}\n請重新嘗試或聯繫管理員。`;
      }

      return {
        success: result.success,
        result: result,
        module: "BK",
        responseMessage: responseMessage,
        processId: processId,
        userId: userId,
        replyToken: replyToken
      };

    } else {
      // 處理失敗
      BK_logWarning(`BK 2.0: 訊息解析失敗 [${processId}]`, "簡單記帳", userId, "BK_processDirectBookkeeping");
      
      const errorMessage = processedData?.reason || "無法解析記帳訊息";
      const responseMessage = `記帳失敗！\n原因：${errorMessage}\n請檢查格式後重試。`;

      return {
        success: false,
        error: errorMessage,
        errorType: processedData?.errorType || "MESSAGE_PARSE_ERROR",
        responseMessage: responseMessage,
        processId: processId,
        userId: userId,
        replyToken: replyToken
      };
    }
  } catch (error) {
    BK_logError(`BK 2.0: 處理簡單記帳時發生錯誤: ${error.toString()} [${processId}]`, "簡單記帳", event.source?.userId || "", "PROCESS_ERROR", error.toString(), "BK_processDirectBookkeeping");

    const responseMessage = `記帳處理發生錯誤：${error.message}\n請重新嘗試或聯繫管理員。`;

    return {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR",
      responseMessage: responseMessage,
      processId: processId,
      userId: event.source?.userId || "",
      replyToken: event.replyToken
    };
  }
}

// 導出需要被外部使用的函數
module.exports = {
  BK_processBookkeeping,
  BK_getBookkeepingData,
  BK_getDataBySubjectCode,
  BK_generateSummaryReport,
  BK_getPaymentMethods,
  BK_validatePaymentMethod,
  BK_smartTextParsing,
  BK_isInitialized,
  BK_initialize,
  // BK 2.0 新增函數（從 DD 複製的 16 個函數）
  BK_processUserMessage,
  BK_parseInputFormat,
  BK_removeAmountFromText,
  BK_getSubjectCode,
  BK_fuzzyMatch,
  BK_getAllSubjects,
  BK_formatSystemReplyMessage,
  BK_convertTimestamp,
  BK_processDirectBookkeeping,
  // BR-0007 補齊的 4 個函數
  BK_checkMultipleMapping,
  BK_getLedgerInfo,
  BK_writeToLogSheet,
  BK_calculateLevenshteinDistance
};