/**
 * 記帳處理模組_1.7.0
 * 處理用戶的記帳操作，接收來自DD的記帳指令，並將整理後的數據存儲至Google Sheets
 * @update 2025-07-03: 版本升級到1.7.0，統一日誌管理系統，替換所有console調用為BK統一日誌函數
 */

// BK.js 頂部引入 DL 模組
const DL = require('./2010. DL.js');

// 引入所需模組
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { google } = require('googleapis');
const sheets = google.sheets('v4');

// 引入 Firestore 模組
const FS = require('./2011. FS.js');

// 配置參數
const BK_CONFIG = {
  DEBUG: true,                            // 調試模式開關 - 設置為true以顯示所有日誌
  LOG_LEVEL: "DEBUG",                     // 日誌級別: DEBUG, INFO, WARNING, ERROR, CRITICAL
  SPREADSHEET_ID: getEnvVar('SPREADSHEET_ID'), // 從環境變數獲取試算表ID
  LEDGER_SHEET_NAME: getEnvVar('LEDGER_SHEET_NAME'), // 從環境變數獲取記帳表名稱
  FIRESTORE_ENABLED: getEnvVar('FIRESTORE_ENABLED') || 'true', // 是否啟用 Firestore
  DEFAULT_LEDGER_ID: getEnvVar('DEFAULT_LEDGER_ID') || 'ledger_structure_001', // 預設帳本ID
  TIMEZONE: "Asia/Taipei",                // 時區設置
  INITIALIZATION_INTERVAL: 300000,        // 初始化間隔(毫秒)，5分鐘
  TEXT_PROCESSING: {
    ENABLE_SMART_PARSING: true,           // 是否啟用智能文本解析
    MIN_AMOUNT_DIGITS: 3,                 // 金額最小位數(避免誤判)
    MAX_REMARK_LENGTH: 20                 // 備註最大長度(避免過長)
  },
  STORAGE: {
    USE_HYBRID: true,                     // 使用混合存儲（Sheets + Firestore）
    FIRESTORE_ONLY: false,                // 僅使用 Firestore（將來可切換）
    SHEETS_ONLY: false                    // 僅使用 Google Sheets
  }
};

// 初始化狀態追蹤
let BK_INIT_STATUS = {
  lastInitTime: 0,         // 上次初始化時間
  initialized: false,      // 是否已初始化
  spreadsheet: null,       // 試算表引用
  ledgerSheet: null,       // 記帳表引用
  DL_initialized: false,   // DL模組是否已初始化
  authClient: null         // Google API 認證客戶端
};

// 定義BK模組自己的日誌級別（作為備用）
const BK_SEVERITY_DEFAULTS = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4
};

/** 
 * 99. 安全獲取DL級別函數
 */
function getDLSeverity(level, defaultValue) {
  try {
    if (typeof DL_SEVERITY_LEVELS === 'object' && DL_SEVERITY_LEVELS !== null && 
        typeof DL_SEVERITY_LEVELS[level] === 'number') {
      return DL_SEVERITY_LEVELS[level];
    }
  } catch (e) {
    BK_logWarning("無法訪問 DL_SEVERITY_LEVELS." + level, "系統初始化", "", "getBKSeverityLevel");
  }
  return defaultValue;
}

// 模組邏輯等級映射（防禦性版本）
const BK_LOG_LEVEL_MAP = {
  "DEBUG": getDLSeverity("DEBUG", BK_SEVERITY_DEFAULTS.DEBUG),
  "INFO": getDLSeverity("INFO", BK_SEVERITY_DEFAULTS.INFO),
  "WARNING": getDLSeverity("WARNING", BK_SEVERITY_DEFAULTS.WARNING),
  "ERROR": getDLSeverity("ERROR", BK_SEVERITY_DEFAULTS.ERROR),
  "CRITICAL": getDLSeverity("ERROR", BK_SEVERITY_DEFAULTS.ERROR) // DL沒有CRITICAL，映射到ERROR
};

/**
 * 從環境變數獲取配置
 */
function getEnvVar(key) {
  return process.env[key] || '';
}

/**
 * 初始化Google API認證
 */
async function initializeGoogleAuth() {
  try {
    // 如果已經初始化過，直接返回
    if (BK_INIT_STATUS.authClient) return BK_INIT_STATUS.authClient;

    // 讀取憑證 JSON 內容
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentialsJson) {
      throw new Error('未設置GOOGLE_SHEETS_CREDENTIALS環境變數');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentialsJson),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const authClient = await auth.getClient();
    BK_INIT_STATUS.authClient = authClient;
    return authClient;
  } catch (error) {
    BK_logError('Google API認證初始化失敗', "認證初始化", "", "AUTH_INIT_ERROR", error.toString(), "initializeGoogleAuth");
    throw error;
  }
}

/**
 * 1. 診斷函數 - 測試日誌映射
 */
function BK_testLogMapping() {
  BK_logDebug("===BK診斷=== 開始測試日誌映射 ===BK診斷===", "診斷測試", "", "BK_testLogMapping");

  try {
    if (typeof DL_info === 'function') {
      BK_logDebug("測試DL_info直接調用", "診斷測試", "", "BK_testLogMapping");
      // 修正：確保函數名稱以BK_開頭
      DL_info("測試訊息", "測試操作", "測試用戶", "", "", 0, "BK_testLogMapping", "BK_testLogMapping");
    }

    if (typeof DL_log === 'function') {
      BK_logDebug("測試DL_log對象調用", "診斷測試", "", "BK_testLogMapping");
      DL_log({
        message: "對象測試訊息",
        operation: "對象測試操作",
        userId: "對象測試用戶",
        errorCode: "",
        source: "BK",  // 確保來源正確
        details: "",
        retryCount: 0,
        location: "BK_testLogMapping",  // 修正：用函數名代替位置
        severity: "INFO",
        function: "BK_testLogMapping"
      });
    }
  } catch (e) {
    BK_logError("診斷測試失敗", "診斷測試", "", "TEST_ERROR", e.toString(), "BK_testLogMapping");
  }

  BK_logDebug("===BK診斷=== 日誌映射測試完成 ===BK診斷===", "診斷測試", "", "BK_testLogMapping");
}

// 初始化檢查 - 使用緩存機制避免頻繁初始化
async function BK_initialize() {
  const currentTime = new Date().getTime();

  // 如果已初始化且未超過初始化間隔，直接返回
  if (BK_INIT_STATUS.initialized && 
      (currentTime - BK_INIT_STATUS.lastInitTime) < BK_CONFIG.INITIALIZATION_INTERVAL) {
    return true;
  }

  try {
    // 合併初始化日誌，減少輸出次數
    let initMessages = ["BK模組初始化開始 [" + new Date().toISOString() + "]"];

    // 初始化DL模組 (若尚未初始化)
    if (!BK_INIT_STATUS.DL_initialized) {
      if (typeof DL_initialize === 'function') {
        DL_initialize();
        BK_INIT_STATUS.DL_initialized = true;
        initMessages.push("DL模組初始化: 成功");

        // 設置DL日誌級別為DEBUG以顯示所有日誌
        if (typeof DL_setLogLevels === 'function') {
          DL_setLogLevels('DEBUG', 'DEBUG');
          initMessages.push("DL日誌級別設置為DEBUG");
        }

        // 檢查當前模式而不是切換到緊急模式
        if (typeof DL_getModeStatus === 'function') {
          const modeStatus = DL_getModeStatus();
          initMessages.push("DL當前模式: " + modeStatus.currentMode);
        }

        // 執行日誌映射測試
        BK_testLogMapping();
      } else {
        BK_logWarning("DL模組未找到，將使用原生日誌系統", "系統初始化", "", "BK_initialize");
        initMessages.push("DL模組初始化: 失敗 (未找到DL模組)");
      }
    }

    // 初始化Google認證
    const authClient = await initializeGoogleAuth();

    // 獲取試算表引用
    const response = await sheets.spreadsheets.get({
      auth: authClient,
      spreadsheetId: BK_CONFIG.SPREADSHEET_ID,
      includeGridData: false
    });

    BK_INIT_STATUS.spreadsheet = response.data;

    // 檢查記帳表是否存在
    const sheetsInfo = response.data.sheets;
    const ledgerSheet = sheetsInfo.find(sheet => 
      sheet.properties.title === BK_CONFIG.LEDGER_SHEET_NAME
    );

    if (!ledgerSheet) {
      initMessages.push("嚴重錯誤：找不到記帳表：" + BK_CONFIG.LEDGER_SHEET_NAME);
      BK_logCritical(initMessages.join(" | "), "系統初始化", "", "MISSING_SHEET", "缺少必要工作表", "BK_initialize");
      return false;
    }

    BK_INIT_STATUS.ledgerSheet = ledgerSheet;

    // 僅輸出一條合併的初始化成功日誌
    initMessages.push("記帳表檢查: 成功");
    BK_logInfo(initMessages.join(" | "), "系統初始化", "", "BK_initialize");

    // 更新初始化狀態
    BK_INIT_STATUS.lastInitTime = currentTime;
    BK_INIT_STATUS.initialized = true;

    return true;
  } catch (error) {
    BK_logCritical("BK模組初始化錯誤: " + error.toString(), "系統初始化", "", "INIT_ERROR", error.toString(), "BK_initialize");
    return false;
  }
}

// 日期時間格式化
function BK_formatDateTime(date) {
  return moment(date).tz(BK_CONFIG.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * 2. 完全重構的日誌處理函數 - 修復欄位映射問題
 * @param {string} level - 日誌級別: DEBUG|INFO|WARNING|ERROR|CRITICAL
 * @param {string} message - 日誌訊息
 * @param {string} operationType - 操作類型 
 * @param {string} userId - 使用者ID
 * @param {Object} options - 額外選項
 */
function BK_log(level, message, operationType = "", userId = "", options = {}) {
  // 預設值設定
  const {
    errorCode = "", 
    errorDetails = "", 
    location = "", 
    functionName = "",
    retryCount = 0
  } = options;

  // DEBUG模式檢查
  if (level === "DEBUG" && !BK_CONFIG.DEBUG) return;

  try {
    // 確保DL模組已初始化
    if (typeof DL_initialize === 'function' && !BK_INIT_STATUS.DL_initialized) {
      DL_initialize();
      BK_INIT_STATUS.DL_initialized = true;
    }

    // 修正：優先使用傳入的函數名，否則使用預設函數名作為location
    const callerFunction = functionName || "BK_log";
    // 修正：確保location始終以"BK_"開頭，這有助於DL模組識別來源
    const actualLocation = location || callerFunction;

    // 根據日誌級別使用正確的函數
    // 修正：確保函數名稱(最後一個參數)以"BK_"開頭，有助於DL模組自動識別來源
    switch(level) {
      case "DEBUG":
        if (typeof DL_debug === 'function') {
          return DL_debug(
            message,                      // 訊息 
            operationType || "BK系統",    // 操作類型
            userId || "",                 // 使用者ID
            errorCode || "",              // 錯誤代碼
            errorDetails || "",           // 錯誤詳情
            retryCount || 0,              // 重試次數
            actualLocation,               // 程式碼位置
            callerFunction                // 函數名稱
          );
        }
        break;
      case "INFO":
        if (typeof DL_info === 'function') {
          return DL_info(
            message, 
            operationType || "BK系統", 
            userId || "", 
            errorCode || "", 
            errorDetails || "", 
            retryCount || 0, 
            actualLocation,
            callerFunction
          );
        }
        break;
      case "WARNING":
        if (typeof DL_warning === 'function') {
          return DL_warning(
            message, 
            operationType || "BK系統", 
            userId || "", 
            errorCode || "", 
            errorDetails || "", 
            retryCount || 0, 
            actualLocation,
            callerFunction
          );
        }
        break;
      case "ERROR":
        if (typeof DL_error === 'function') {
          return DL_error(
            message, 
            operationType || "BK系統", 
            userId || "", 
            errorCode || "", 
            errorDetails || "", 
            retryCount || 0, 
            actualLocation,
            callerFunction
          );
        }
        break;
      case "CRITICAL":
        if (typeof DL_error === 'function') {
          return DL_error(
            "[CRITICAL] " + message, 
            operationType || "BK系統", 
            userId || "", 
            errorCode || "CRITICAL_ERROR", 
            errorDetails || "", 
            retryCount || 0, 
            actualLocation,
            callerFunction
          );
        }
        break;
    }

    // 如果級別函數都不可用，回退到DL_log但使用更嚴格的參數映射
    if (typeof DL_log === 'function') {
      return DL_log({
        message: message,
        operation: operationType || "BK系統",
        userId: userId || "",
        errorCode: errorCode || "",
        source: "BK",  // 明確設置來源為BK
        details: errorDetails || "",
        retryCount: retryCount || 0,
        location: actualLocation,
        severity: level,
        function: callerFunction
      });
    }

    // 最終備用方案：直接控制台輸出
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [BK] ${message} | ${operationType} | ${userId} | ${actualLocation}`);

  } catch (e) {
    // 詳細記錄日誌失敗信息
    console.error(`BK日誌錯誤: ${e.toString()} - 堆疊: ${e.stack || "無堆疊信息"}`);
    console.error(`嘗試記錄: ${level} | ${message} | ${operationType} | ${userId}`);
  }

  return true;
}

// 包裝函數，保持原有API但使用標準字段順序
function BK_logDebug(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_log("DEBUG", message, operationType || "BK系統", userId, { 
    location: location || "BK_logDebug", 
    functionName: functionName || "BK_logDebug" 
  });
}

function BK_logInfo(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_log("INFO", message, operationType || "BK系統", userId, { 
    location: location || "BK_logInfo", 
    functionName: functionName || "BK_logInfo" 
  });
}

function BK_logWarning(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_log("WARNING", message, operationType || "BK系統", userId, { 
    location: location || "BK_logWarning", 
    functionName: functionName || "BK_logWarning" 
  });
}

function BK_logWarn(message, operationType = "", userId = "", location = "", functionName = "") {
  return BK_logWarning(message, operationType || "BK系統", userId, location || "BK_logWarn", functionName || "BK_logWarn");
}

function BK_logError(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  return BK_log("ERROR", message, operationType || "BK系統", userId, { 
    errorCode, 
    errorDetails, 
    location: location || "BK_logError", 
    functionName: functionName || "BK_logError" 
  });
}

function BK_logCritical(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  return BK_log("CRITICAL", message, operationType || "BK系統", userId, { 
    errorCode, 
    errorDetails, 
    location: location || "BK_logCritical", 
    functionName: functionName || "BK_logCritical" 
  });
}

/**
 * 3. 生成唯一的收支ID
 * @param {string} processId - 處理ID(用於日誌)
 * @returns {string} - 唯一收支ID (格式: YYYYMMDD-00001)
 */
async function BK_generateBookkeepingId(processId) {
  BK_logDebug(`開始生成收支ID [${processId}]`, "ID生成", "", "BK_generateBookkeepingId");

  try {
    // 確保模組已初始化
    await BK_initialize();

    // 獲取今天的日期字符串 (YYYYMMDD)
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const authClient = BK_INIT_STATUS.authClient;

    // 讀取試算表數據
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: BK_CONFIG.SPREADSHEET_ID,
      range: `${BK_CONFIG.LEDGER_SHEET_NAME}!A:A`
    });

    const data = response.data.values || [];
    let maxSerialNumber = 0;

    // 遍歷所有記錄，查找當天的最大序號
    for (let i = 1; i < data.length; i++) {
      const idCell = data[i] ? data[i][0] : null; // 假設ID在第一列

      // 檢查是否是當天的ID (格式: YYYYMMDD-#####)
      if (typeof idCell === 'string' && idCell.startsWith(dateStr + '-')) {
        // 提取序號部分並轉為數字
        const serialPart = idCell.split('-')[1];
        if (serialPart) {
          const serialNumber = parseInt(serialPart, 10);
          if (!isNaN(serialNumber) && serialNumber > maxSerialNumber) {
            maxSerialNumber = serialNumber;
          }
        }
      }
    }

    // 下一個序號 = 最大序號 + 1 (如果沒有當天記錄，從1開始)
    const nextSerialNumber = maxSerialNumber + 1;

    // 格式化為5位數，前導補0
    const formattedNumber = nextSerialNumber.toString().padStart(5, '0');

    // 組合最終ID
    const bookkeepingId = `${dateStr}-${formattedNumber}`;

    BK_logInfo(`生成收支ID: ${bookkeepingId} [${processId}]`, "ID生成", "", "BK_generateBookkeepingId");
    return bookkeepingId;

  } catch (error) {
    BK_logError(`生成收支ID失敗: ${error} [${processId}]`, "ID生成", "", "ID_GEN_ERROR", error.toString(), "BK_generateBookkeepingId");

    // 發生錯誤時使用備用ID格式以確保系統繼續運作
    const timestamp = new Date().getTime();
    const fallbackId = `F${timestamp}`;
    BK_logWarning(`使用備用ID: ${fallbackId} [${processId}]`, "ID生成", "", "BK_generateBookkeepingId");

    return fallbackId;
  }
}

/**
 * 4. 驗證記帳數據
 * @param {Object} data - 需要驗證的數據
 * @returns {Object} - 驗證結果 {success: boolean, error: string}
 */
function BK_validateData(data) {
  try {
    // 檢查必填基本字段
    if (!data.date) return { success: false, error: "缺少日期信息" };
    if (!data.time) return { success: false, error: "缺少時間信息" };
    if (!data.majorCode) return { success: false, error: "缺少主科目代碼" };
    if (!data.minorCode) return { success: false, error: "缺少子科目代碼" };

    // 驗證金額
    let hasValidAmount = false;

    // 檢查收入金額
    if (data.income !== undefined && data.income !== '') {
      hasValidAmount = true;
    }

    // 檢查支出金額
    if (data.expense !== undefined && data.expense !== '') {
      hasValidAmount = true;
    }

    // 確保至少有一個有效金額
    if (!hasValidAmount) {
      return { success: false, error: "缺少有效的收入或支出金額" };
    }

    // 所有驗證通過
    return { success: true };

  } catch (error) {
    return { success: false, error: "數據驗證過程出錯: " + error.toString() };
  }
}

/**
 * 5. 處理記帳操作的主函數 - 移除支付方式默認值處理
 * @version 2025-06-17-V3.0.0
 * @author AustinLiao691
 * @date 2025-06-17 01:22:25
 * @update: 移除支付方式默認值，完全交由BK_validatePaymentMethod處理
 * @param {Object} bookkeepingData - 記帳數據對象，包含以下屬性:
 * @return {Object} 處理結果
 */
async function BK_processBookkeeping(bookkeepingData) {
  const processId = bookkeepingData.processId || require('crypto').randomUUID().substring(0, 8);

  // 1. 設置日誌前綴
  const logPrefix = `[${processId}] BK_processBookkeeping:`;

  try {
    // 2. 記錄流程開始
    BK_logInfo(`${logPrefix} 開始處理記帳請求`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");

    // 3. 數據驗證
    if (!bookkeepingData) {
      BK_logError(`${logPrefix} 記帳數據為空`, "數據驗證", "", "DATA_EMPTY", "記帳數據為空", "BK_processBookkeeping");
      throw new Error("記帳數據為空");
    }

    // 4. 必要欄位檢查
    const requiredFields = ['action', 'subjectName', 'amount', 'majorCode', 'subCode'];
    const missingFields = requiredFields.filter(field => !bookkeepingData[field]);

    if (missingFields.length > 0) {
      BK_logError(`${logPrefix} 缺少必要欄位: ${missingFields.join(', ')}`, "數據驗證", bookkeepingData.userId || "", "MISSING_FIELDS", "缺少必要欄位", "BK_processBookkeeping");

      // 增強：返回部分資料，即使缺少欄位
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
          paymentMethod: bookkeepingData.paymentMethod, // 不設置默認值
          remark: bookkeepingData.text || bookkeepingData.originalSubject || ""
        },
        userFriendlyMessage: `記帳處理失敗 (VALIDATION_ERROR)：缺少必要欄位\n請重新嘗試或聯繫管理員。`
      };
    }

    // 4.1 檢查金額是否為負數
    const numericAmount = typeof bookkeepingData.amount === 'string' 
      ? parseFloat(bookkeepingData.amount.replace(/,/g, '')) 
      : bookkeepingData.amount;

    if (numericAmount < 0) {
      BK_logError(`${logPrefix} 檢測到負數金額: ${numericAmount}`, "數據驗證", bookkeepingData.userId || "", "NEGATIVE_AMOUNT", `金額: ${numericAmount}`, "BK_processBookkeeping");

      // 返回錯誤信息，但保留所有原始資料用於顯示
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
          amount: numericAmount, // 保留負數金額
          rawAmount: bookkeepingData.rawAmount || String(numericAmount), // 保留原始格式
          paymentMethod: bookkeepingData.paymentMethod, // 不設置默認值
          remark: bookkeepingData.originalSubject || bookkeepingData.text || ""
        },
        userFriendlyMessage: `記帳處理失敗 (VALIDATION_ERROR)：金額不可為負數\n請重新嘗試使用正數金額。`
      };
    }

    // 5. 數據準備與格式化
    const today = new Date();
    const formattedDate = moment(today).tz(BK_CONFIG.TIMEZONE).format("YYYY/MM/DD HH:mm");
    const formattedTime = moment(today).tz(BK_CONFIG.TIMEZONE).format("HH:mm");
    const formattedDay = moment(today).tz(BK_CONFIG.TIMEZONE).format("YYYY/MM/DD");
    BK_logDebug(`${logPrefix} 格式化日期: ${formattedDate}, 時間: ${formattedTime}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");

    // 6. 生成ID
    const bookkeepingId = await BK_generateBookkeepingId(processId);
    BK_logInfo(`${logPrefix} 生成記帳ID: ${bookkeepingId}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");

    // 7. 確定金額與收支類型
    let income = '', expense = '';
    // 保存原始金額格式（帶千分位）和數字金額
    const rawAmount = bookkeepingData.rawAmount || bookkeepingData.amount.toLocaleString('zh-TW');

    if (bookkeepingData.action === "收入") {
      income = numericAmount.toString();
      BK_logInfo(`${logPrefix} 處理收入金額: ${income}，原始格式: ${rawAmount}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");
    } else {
      expense = numericAmount.toString();
      BK_logInfo(`${logPrefix} 處理支出金額: ${expense}，原始格式: ${rawAmount}`, "記帳處理", bookkeepingData.userId || "", "BK_processBookkeeping");
    }

    // 8. 使用智能備註生成（如果可用）
    let remark = "";
    try {
      if (typeof DD_generateIntelligentRemark === 'function') {
        remark = DD_generateIntelligentRemark(bookkeepingData);
        BK_logInfo(`${logPrefix} 使用智能備註生成: "${remark}"`, "備註處理", bookkeepingData.userId || "", "BK_processBookkeeping");
      } else {
        // 備用方案：直接使用text作為備註，如無則使用originalSubject
        remark = bookkeepingData.text || bookkeepingData.originalSubject || "";
        BK_logInfo(`${logPrefix} 使用原始文本作為備註: "${remark}"`, "備註處理", bookkeepingData.userId || "", "BK_processBookkeeping");
      }
    } catch (remarkError) {
      BK_logWarning(`${logPrefix} 備註生成失敗: ${remarkError}, 使用原始文本`, "備註處理", bookkeepingData.userId || "", "BK_processBookkeeping");
      remark = bookkeepingData.text || bookkeepingData.originalSubject || "";
    }

    // 9. 確保使用者ID始終有值
    let userId = bookkeepingData.userId;
    if (!userId) {
      // 嘗試獲取活動使用者
      try {
        userId = process.env.USER || process.env.USERNAME || "";
        BK_logInfo(`${logPrefix} 使用系統環境使用者: ${userId}`, "使用者處理", userId, "BK_processBookkeeping");
      } catch (e) {
        BK_logWarning(`${logPrefix} 無法獲取系統環境使用者: ${e}`, "使用者處理", "", "BK_processBookkeeping");
      }

      // 如果仍然沒有，使用預設值
      if (!userId || userId === "") {
        userId = "AustinLiao691"; // 使用預設使用者
        BK_logInfo(`${logPrefix} 使用預設使用者ID: ${userId}`, "使用者處理", userId, "BK_processBookkeeping");
      }

      // 最後的備用方案：使用時間戳生成唯一ID
      if (!userId || userId === "") {
        userId = "SYSTEM_" + new Date().getTime();
        BK_logInfo(`${logPrefix} 使用系統生成的使用者ID: ${userId}`, "使用者處理", userId, "BK_processBookkeeping");
      }

      // 記錄缺少使用者ID的情況
      BK_logWarning(`記帳缺少使用者ID，使用替代值: ${userId} [${processId}]`, "數據修正", "", "BK_processBookkeeping");
    }

    // 10. 使用者類型決定邏輯 - 根據使用者ID決定類型
    let userType = bookkeepingData.userType;
    if (!userType) {
      // 使用者類型設為M、S、J三種
      if (userId === "AustinLiao691") {
        userType = "M"; // 主帳本擁有者(Master)
      } else if (userId.includes("SYSTEM_")) {
        userType = "S"; // 單獨帳本擁有者(Single)
      } else {
        userType = "J"; // 加入主帳本之成員(Joined)
      }

      BK_logInfo(`${logPrefix} 設定使用者類型: ${userType} 給使用者: ${userId}`, "使用者分類", userId, "BK_processBookkeeping");
    }

    // 11. 準備記帳數據 - 移除支付方式默認值，由BK_validatePaymentMethod處理
    const adaptedData = {
      id: bookkeepingId,
      userType: userType,
      date: formattedDay,
      time: formattedTime,
      majorCode: bookkeepingData.majorCode,
      minorCode: bookkeepingData.subCode,
      paymentMethod: bookkeepingData.paymentMethod, // 不設置默認值
      minorName: bookkeepingData.subjectName,
      userId: userId,
      remark: remark,
      income: income,
      expense: expense,
      rawAmount: rawAmount, // 新增: 保存原始金額格式
      synonym: bookkeepingData.originalSubject || ""
    };
    BK_logInfo(`${logPrefix} 準備記帳數據: ID=${bookkeepingId}, 使用者=${userId}, 類型=${userType}, 支付方式=${bookkeepingData.paymentMethod || "未設置"}` + 
              `, 原始金額=${rawAmount}`, "記帳處理", userId, "BK_processBookkeeping");

    // 12. 準備記帳數據數組
    const bookkeepingDataArray = BK_prepareBookkeepingData(bookkeepingId, adaptedData, processId);

    // 13. 執行記帳操作（混合存儲：試算表 + Firestore）
    BK_logInfo(`${logPrefix} 開始保存數據到混合存儲（Sheets + Firestore）`, "數據存儲", userId, "BK_processBookkeeping");
    const result = await BK_saveToHybridStorage(bookkeepingDataArray, processId);

    if (!result.overall.success) {
      const errorMsg = `Sheets: ${result.sheets.error || 'Unknown'}, Firestore: ${result.firestore.error || 'Unknown'}`;
      BK_logError(`${logPrefix} 混合存儲全部失敗: ${errorMsg}`, "數據存儲", userId, "SAVE_ERROR", errorMsg, "BK_processBookkeeping");

      return {
        success: false,
        error: "混合存儲全部失敗",
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
        userFriendlyMessage: `記帳處理失敗 (STORAGE_ERROR)：混合存儲全部失敗\n請重新嘗試或聯繫管理員。`
      };
    }
    
    // 記錄存儲成功詳情
    const storageStatus = `Sheets: ${result.sheets.success ? '✅' : '❌'}, Firestore: ${result.firestore.success ? '✅' : '❌'}`;
    BK_logInfo(`${logPrefix} 混合存儲成功 - ${storageStatus}`, "數據存儲", userId, "BK_processBookkeeping");
    
    if (result.sheets.success) {
      BK_logInfo(`${logPrefix} Google Sheets 存儲成功，行號: ${result.sheets.row}`, "數據存儲", userId, "BK_processBookkeeping");
    }
    if (result.firestore.success) {
      BK_logInfo(`${logPrefix} Firestore 存儲成功，文檔ID: ${result.firestore.docId}`, "數據存儲", userId, "BK_processBookkeeping");
    }

    // 處理用戶偏好學習（如果啟用）
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
        BK_logWarning(`用戶偏好記錄失敗: ${prefError} [${processId}]`, "偏好學習", userId, "PREF_LEARN_ERROR", prefError.toString(), "BK_processBookkeeping");
      }
    }

    // 處理格式學習（如果啟用）
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

    // 16. 從BK_prepareBookkeepingData獲取經過驗證的支付方式
    const finalPaymentMethod = bookkeepingDataArray[6]; // 索引6是支付方式
    BK_logInfo(`${logPrefix} 最終確認的支付方式: ${finalPaymentMethod}`, "記帳處理", userId, "BK_processBookkeeping");

    // 格式化回傳結果
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
        paymentMethod: finalPaymentMethod, // 使用經過驗證的最終支付方式
        remark: remark,
        userId: userId,
        userType: userType
      }
    };

  } catch (error) {
    // 17. 記錄錯誤
    BK_logError(`${logPrefix} 記帳處理失敗: ${error.toString()}`, "記帳處理", bookkeepingData ? bookkeepingData.userId : "", "PROCESS_ERROR", error.toString(), "BK_processBookkeeping");

    // 識別特定類型的錯誤
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

    // 關鍵改進：保留已解析的部分數據，確保在DD模組可以顯示
    let partialData = {};

    // 安全地提取已知數據
    try {
      // 獲取當前日期時間
      const currentDateTime = moment(new Date()).tz(BK_CONFIG.TIMEZONE).format("YYYY/MM/DD HH:mm");

      // 從bookkeepingData中安全提取數據
      if (bookkeepingData) {
        partialData = {
          date: currentDateTime,
          subject: bookkeepingData.subjectName,
          rawAmount: bookkeepingData.rawAmount || 
                    (bookkeepingData.amount ? String(bookkeepingData.amount) : undefined),
          amount: bookkeepingData.amount,
          action: bookkeepingData.action,
          paymentMethod: bookkeepingData.paymentMethod, // 不設置默認值
          remark: bookkeepingData.text || bookkeepingData.originalSubject
        };
      }

      // 移除undefined值
      Object.keys(partialData).forEach(key => {
        if (partialData[key] === undefined) {
          delete partialData[key];
        }

/**
 * 16. 儲存數據到 Firestore（新增函數）
 * @version 2025-07-08-V1.0.0
 * @author AustinLiao69
 * @date 2025-07-08 15:30:00
 * @description 將記帳數據存儲到 Firestore，作為 Google Sheets 的替代方案
 * @param {Array} bookkeepingData - 記帳數據數組
 * @param {string} processId - 處理ID
 * @param {string} ledgerId - 帳本ID（預設使用環境變數）
 * @returns {Object} 儲存結果
 */
async function BK_saveToFirestore(bookkeepingData, processId, ledgerId = 'ledger_structure_001') {
  BK_logDebug(`開始儲存數據到 Firestore [${processId}]`, "Firestore存儲", "", "BK_saveToFirestore");

  try {
    // 準備 Firestore 文檔數據
    const firestoreData = {
      收支ID: bookkeepingData[0],           // 收支ID
      使用者類型: bookkeepingData[1],       // 使用者類型
      日期: bookkeepingData[2],             // 日期
      時間: bookkeepingData[3],             // 時間
      大項代碼: bookkeepingData[4],         // 大項代碼
      子項代碼: bookkeepingData[5],         // 子項代碼
      支付方式: bookkeepingData[6],         // 支付方式
      子項名稱: bookkeepingData[7],         // 子項名稱
      UID: bookkeepingData[8],              // 使用者ID
      備註: bookkeepingData[9],             // 備註
      收入: bookkeepingData[10] || null,    // 收入（如果為空則設為null）
      支出: bookkeepingData[11] || null,    // 支出（如果為空則設為null）
      同義詞: bookkeepingData[12] || '',    // 同義詞
      currency: 'NTD',                      // 幣別
      timestamp: new Date()                 // 系統時間戳
    };

    // 使用 FS 模組的 Firebase 實例存儲數據
    const admin = require('firebase-admin');
    const db = admin.firestore();
    
    // 存儲到 ledgers/{ledgerId}/entries 集合
    const docRef = await db
      .collection('ledgers')
      .doc(ledgerId)
      .collection('entries')
      .add(firestoreData);

    BK_logInfo(`數據成功儲存到 Firestore，文檔ID: ${docRef.id} [${processId}]`, "Firestore存儲", "", "BK_saveToFirestore");

    // 記錄到日誌集合
    await db
      .collection('ledgers')
      .doc(ledgerId)
      .collection('log')
      .add({
        時間: new Date(),
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

    // 詳細錯誤分析
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
 * 17. 混合存儲策略（Google Sheets + Firestore）
 * @version 2025-07-08-V1.0.0
 * @author AustinLiao69
 * @date 2025-07-08 15:35:00
 * @description 同時存儲到 Google Sheets 和 Firestore，提供雙重備份
 * @param {Array} bookkeepingData - 記帳數據數組
 * @param {string} processId - 處理ID
 * @returns {Object} 儲存結果
 */
async function BK_saveToHybridStorage(bookkeepingData, processId) {
  BK_logDebug(`開始混合存儲（Sheets + Firestore）[${processId}]`, "混合存儲", "", "BK_saveToHybridStorage");

  const results = {
    sheets: { success: false },
    firestore: { success: false },
    overall: { success: false }
  };

  try {
    // 並行執行兩種存儲方式
    const [sheetsResult, firestoreResult] = await Promise.allSettled([
      BK_saveToSpreadsheet(bookkeepingData, processId),
      BK_saveToFirestore(bookkeepingData, processId)
    ]);

    // 處理 Google Sheets 結果
    if (sheetsResult.status === 'fulfilled') {
      results.sheets = sheetsResult.value;
    } else {
      results.sheets = { success: false, error: sheetsResult.reason.toString() };
    }

    // 處理 Firestore 結果
    if (firestoreResult.status === 'fulfilled') {
      results.firestore = firestoreResult.value;
    } else {
      results.firestore = { success: false, error: firestoreResult.reason.toString() };
    }

    // 判斷整體成功狀態（至少一個成功即為成功）
    results.overall.success = results.sheets.success || results.firestore.success;

    if (results.overall.success) {
      BK_logInfo(`混合存儲成功 - Sheets: ${results.sheets.success ? '✅' : '❌'}, Firestore: ${results.firestore.success ? '✅' : '❌'} [${processId}]`, 
                "混合存儲", "", "BK_saveToHybridStorage");
    } else {
      BK_logError(`混合存儲全部失敗 [${processId}]`, "混合存儲", "", "HYBRID_STORAGE_ERROR", 
                 `Sheets: ${results.sheets.error || 'Unknown'}, Firestore: ${results.firestore.error || 'Unknown'}`, "BK_saveToHybridStorage");
    }

    return results;

  } catch (error) {
    BK_logError(`混合存儲異常 [${processId}]`, "混合存儲", "", "HYBRID_STORAGE_EXCEPTION", error.toString(), "BK_saveToHybridStorage");
    
    results.overall = { success: false, error: error.toString() };
    return results;
  }
}

      });
    } catch (e) {
      BK_logError(`${logPrefix} 無法提取部分數據: ${e.toString()}`, "錯誤處理", "", "PARTIAL_DATA_ERROR", e.toString(), "BK_processBookkeeping");
    }

    // 確保partialData有合理默認值
    if (!partialData.subject) partialData.subject = "未知科目";

    // 返回更詳細的錯誤信息結構
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
      userFriendlyMessage: `記帳處理失敗${errorType !== "GENERAL_ERROR" ? " (" + errorType + ")" : ""}：${errorMessage}\n請重新嘗試或聯繫管理員。`
    };
  }
}

/**
 * 6. 準備記帳數據 - 修訂版本，支援支付方式和備註欄位修復
 * @version 2025-05-19-V5.2.0
 * @author AustinLiao69
 * @update: 增加智能文本解析，分離備註與金額
 * @param {string} bookkeepingId - 收支ID
 * @param {Object} data - 記帳數據
 * @param {string} processId - 處理ID
 * @returns {Array} - 格式化的記帳數據數組
 */
function BK_prepareBookkeepingData(bookkeepingId, data, processId) {
  BK_logInfo(`準備記帳數據 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  // 1. 記錄接收到的數據
  BK_logInfo(`收到數據: ${JSON.stringify(data).substring(0, 100)}...`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  // 新增：特別檢查和記錄備註資訊
  const remarkContent = data.remark || data.notes || '';
  BK_logInfo(`備註內容: "${remarkContent}" [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  // 2. 初始化收入/支出變數
  let income = '', expense = '';

  // 3. 優先使用action判斷收入/支出
  if (data.action === "收入") {
    // 如果action為收入，則使用income值（保持原始格式）
    income = data.income || '';
    expense = ''; // 明確設置expense為空字符串
    BK_logInfo(`根據action判定為收入，金額=${income} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
  } 
  else if (data.action === "支出") {
    // 如果action為支出，則使用expense值（保持原始格式）
    expense = data.expense || '';
    income = ''; // 明確設置income為空字符串
    BK_logInfo(`根據action判定為支出，金額=${expense} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
  }
  // 4. 如果沒有設置action，退回到原來的判斷邏輯（兼容性處理）
  else {
    BK_logWarn(`未設置action，退回到傳統判斷方式 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

    // 使用原始字符串值，不使用parseFloat
    if (data.income !== undefined && data.income !== '') {
      income = data.income;
      expense = '';
      BK_logInfo(`使用收入金額: ${income} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

      // 如果同時也設置了expense，記錄警告
      if (data.expense !== undefined && data.expense !== '') {
        BK_logWarn(`收到同時設置income和expense的矛盾數據，優先使用income [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
      }
    } else if (data.expense !== undefined && data.expense !== '') {
      expense = data.expense;
      income = '';
      BK_logInfo(`使用支出金額: ${expense} [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
    } else {
      // 如果檢測到amount但沒有income/expense，記錄嚴重錯誤
      if (data.amount !== undefined && data.amount !== '') {
        BK_logCritical(`收到未處理的amount=${data.amount}，但BK模組不處理amount! DD模組應負責轉換 [${processId}]`, 
                      "數據錯誤", data.userId || "", "DD_ERROR", "DD模組未正確轉換amount", "BK_prepareBookkeepingData");
      } else {
        BK_logWarn(`未收到任何金額信息 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
      }
    }
  }

  // 處理支付方式 - 增加8,9開頭科目代碼檢查
  let paymentMethod = data.paymentMethod;

  // 如果未設置支付方式，根據科目代碼判斷默認值
  if (!paymentMethod || paymentMethod === '') {
    const majorCode = data.majorCode;
    if (majorCode && (String(majorCode).startsWith('8') || String(majorCode).startsWith('9'))) {
      paymentMethod = "現金";
      BK_logInfo(`科目代碼${majorCode}為8或9開頭，預設支付方式為現金 [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");
    } else {
      // 其他情況使用標準驗證邏輯
      paymentMethod = BK_validatePaymentMethod(paymentMethod, data.majorCode);
    }
  } else {
    // 有設置支付方式但需要驗證
    paymentMethod = BK_validatePaymentMethod(paymentMethod, data.majorCode);
  }

  // 5. 記錄最終結果，確保使用正確的支付方式和備註
  BK_logInfo(`記帳數據準備完成: 收入=${income}, 支出=${expense}, 支付方式=${paymentMethod}, 備註="${remarkContent}" [${processId}]`, "數據準備", data.userId || "", "BK_prepareBookkeepingData");

  // 6. 組織數據 - 修改備註欄位的取值邏輯
  const bookkeepingData = [
    bookkeepingId,                     // 1. 收支ID
    data.userType,                     // 2. User類型
    data.date,                         // 3. 日期
    data.time,                         // 4. 時間
    data.majorCode,                    // 5. 大項代碼
    data.minorCode,                    // 6. 子項代碼
    paymentMethod,                     // 7. 支付方式 (原費用種類)
    data.minorName,                    // 8. 子項名稱
    data.userId,                       // 9. 登錄者
    remarkContent,                     // 10. 備註 - 修正：使用remark或notes
    income,                            // 11. 收入
    expense,                           // 12. 支出
    data.synonym || ''                 // 13. 同義詞
  ];

  return bookkeepingData;
}

/**
 * 7. 儲存數據到Google Sheets，處理ID重複情況
 * @param {Array} bookkeepingData - 記帳數據數組
 * @param {string} processId - 處理ID
 * @param {number} retryCount - 重試次數（用於內部重試）
 * @return {Object} 儲存結果
 */
async function BK_saveToSpreadsheet(bookkeepingData, processId, retryCount = 0) {
  BK_logDebug(`開始儲存數據到Google Sheets [${processId}]${retryCount > 0 ? ` (重試 #${retryCount})` : ''}`, "數據存儲", "", "BK_saveToSpreadsheet");

  try {
    // 確保已初始化
    if (!BK_INIT_STATUS.initialized) {
      await BK_initialize();
    }

    const authClient = BK_INIT_STATUS.authClient;

    // 獲取現有數據以檢查ID重複
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: BK_CONFIG.SPREADSHEET_ID,
      range: `${BK_CONFIG.LEDGER_SHEET_NAME}!A:A`
    });

    const existingData = response.data.values || [];

    // 檢查是否有重複的收支ID
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i] && existingData[i][0] === bookkeepingData[0]) {
        // 發現重複ID
        BK_logWarning(`發現重複的收支ID: ${bookkeepingData[0]} [${processId}]`, "數據存儲", "", "BK_saveToSpreadsheet");

        // 如果已嘗試重試3次以上，則返回錯誤
        if (retryCount >= 3) {
          BK_logError(`超過重試次數限制，無法解決ID重複問題 [${processId}]`, "數據存儲", "", "RETRY_LIMIT", "重試次數達到上限", "BK_saveToSpreadsheet");
          return {
            success: false,
            error: "收支ID重複且無法自動修復，請稍後再試",
            duplicateId: bookkeepingData[0]
          };
        }

        // 生成新ID，使用時間戳確保唯一性
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;

        // 使用時間戳最後5位 + 重試次數作為序列號
        const timestamp = today.getTime().toString().slice(-5);
        const newSerialNumber = String(parseInt(timestamp) + retryCount).padStart(5, '0');
        const newId = `${dateString}-${newSerialNumber}`;

        BK_logInfo(`自動重新生成ID: ${bookkeepingData[0]} → ${newId} [${processId}]`, "數據存儲", "", "BK_saveToSpreadsheet");

        // 更新數據中的ID
        bookkeepingData[0] = newId;

        // 遞迴重試，增加重試計數
        return BK_saveToSpreadsheet(bookkeepingData, processId, retryCount + 1);
      }
    }

    // 獲取當前表格最後一行
    const rowCountResponse = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: BK_CONFIG.SPREADSHEET_ID,
      range: `${BK_CONFIG.LEDGER_SHEET_NAME}!A:A`
    });

    const nextRow = (rowCountResponse.data.values || []).length + 1;

    // 將數據追加到表格
    await sheets.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId: BK_CONFIG.SPREADSHEET_ID,
      range: `${BK_CONFIG.LEDGER_SHEET_NAME}!A${nextRow}`,
      valueInputOption: 'RAW',
      resource: {
        values: [bookkeepingData]
      }
    });

    BK_logInfo(`數據成功儲存到行號: ${nextRow} [${processId}]`, "數據存儲", "", "BK_saveToSpreadsheet");
    return {
      success: true,
      row: nextRow
    };
  } catch (error) {
    BK_logError(`儲存到Google Sheets失敗 [${processId}]`, "數據存儲", "", "SHEETS_ERROR", error.toString(), "BK_saveToSpreadsheet");

    // 嘗試提供更具體的錯誤信息
    let detailedError = error.toString();
    if (error.message && error.message.includes("Access denied")) {
      detailedError = "無權限存取記帳表，請檢查權限設定";
      BK_logError("無權限存取記帳表", "權限錯誤", "", "ACCESS_DENIED", error.toString(), "BK_saveToSpreadsheet");
    } else if (error.message && error.message.includes("Range")) {
      detailedError = "範圍錯誤，可能是嘗試寫入超出表格範圍的數據";
      BK_logError("表格範圍錯誤", "範圍錯誤", "", "RANGE_ERROR", error.toString(), "BK_saveToSpreadsheet");
    }

    return {
      success: false,
      error: "儲存到Google Sheets失敗: " + detailedError
    };
  }
}

/**
 * 8. 獲取支付方式列表
 * @returns {Array<string>} 支付方式列表
 */
function BK_getPaymentMethods() {
  return ["現金", "刷卡", "轉帳", "行動支付", "其他"];
}

/**
 * 9. 確認並標準化支付方式
 * @version 2025-06-27-V3.0.0
 * @author AustinLiao69
 * @date 2025-06-27 02:05:30
 * @update: 改為嚴格檢查支付方式，對不匹配支付方式拋出錯誤而非默認為刷卡
 * @param {string|null} method - 輸入的支付方式，可能為空/null/undefined
 * @param {string} majorCode - 科目大類代碼，用於判斷某些科目特定的默認支付方式 
 * @returns {string} 標準化後的支付方式
 * @throws {Error} 當支付方式不匹配四種有效值時拋出錯誤
 */
function BK_validatePaymentMethod(method, majorCode) {
  try {
    BK_logDebug(`BK_validatePaymentMethod: 驗證支付方式 "${method}" 對應科目代碼 ${majorCode}`, "支付方式驗證", "", "BK_validatePaymentMethod");

    // 1. 空值處理 - 如果輸入為空/null/undefined/預設
    if (!method || method === "" || method === "預設") {
      if (majorCode && (String(majorCode).startsWith('8') || String(majorCode).startsWith('9'))) {
        // 8或9開頭的科目默認用現金
        BK_logDebug(`BK_validatePaymentMethod: 科目代碼 ${majorCode} 為8或9開頭，使用默認支付方式"現金"`, "支付方式驗證", "", "BK_validatePaymentMethod");
        return "現金";
      } else {
        // 其他科目默認用刷卡
        BK_logDebug(`BK_validatePaymentMethod: 未指定支付方式或值為"預設"，使用默認支付方式"刷卡"`, "支付方式驗證", "", "BK_validatePaymentMethod");
        return "刷卡";
      }
    }

    // 2. 嚴格支付方式檢查 - 僅允許四種精確支付方式名稱
    const validPaymentMethods = ["現金", "刷卡", "轉帳", "行動支付"];

    if (validPaymentMethods.includes(method)) {
      BK_logDebug(`BK_validatePaymentMethod: 使用有效支付方式 "${method}"`, "支付方式驗證", "", "BK_validatePaymentMethod");
      return method;
    }

    // 3. 不支援的支付方式 - 拋出錯誤而非默認為刷卡
    const errorMessage = `不支援的支付方式: "${method}"，僅支援 "現金"、"刷卡"、"轉帳"、"行動支付"`;
    BK_logError(`BK_validatePaymentMethod: ${errorMessage}`, "支付方式驗證", "", "INVALID_PAYMENT_METHOD", errorMessage, "BK_validatePaymentMethod");
    throw new Error(errorMessage);

  } catch (error) {
    // 4. 異常處理 - 重新拋出錯誤以供上層函數處理
    BK_logError(`BK_validatePaymentMethod 發生錯誤: ${error.toString()}`, "支付方式驗證", "", "PAYMENT_VALIDATION_ERROR", error.toString(), "BK_validatePaymentMethod");

    // 記錄到BK日誌系統(如果可用)
    try {
      BK_logError(`支付方式驗證失敗: ${error}`, "支付方式處理", "", "PAYMENT_ERROR", error.toString(), "BK_validatePaymentMethod", "BK_validatePaymentMethod");
    } catch(e) {
      // 日誌記錄失敗也不影響主流程
    }

    // 關鍵變更：將錯誤向上拋出，而不是返回默認值
    throw error;
  }
}

/**
 * 10. 智能文本解析 - 分離沒有空格的備註和金額
 * @version 1.0.0 (2025-05-19)
 * @author AustinLiao69
 * @param {string} text - 原始文本 (例如 "薪水13457643")
 * @param {string} processId - 處理ID (用於日誌)
 * @returns {Object} - 解析結果 {detected: boolean, remark: string, amount: number}
 */
function BK_smartTextParsing(text, processId) {
  BK_logDebug(`開始智能文本解析: "${text}" [${processId}]`, "文本解析", "", "BK_smartTextParsing");

  // 如果文本為空，直接返回未檢測結果
  if (!text || text.length === 0) {
    return { detected: false, remark: text, amount: 0 };
  }

  try {
    // 創建默認返回對象
    const defaultResult = { detected: false, remark: text, amount: 0 };

    // 策略1: 使用正則表達式匹配所有數字組合
    const numbersMatches = text.match(/\d+/g);
    if (!numbersMatches || numbersMatches.length === 0) {
      // 沒有找到數字
      BK_logDebug(`未找到數字 [${processId}]`, "文本解析", "", "BK_smartTextParsing");
      return defaultResult;
    }

    // 找到最長的數字組合，很可能是金額
    let bestMatch = "";
    let bestMatchLength = 0;

    for (const match of numbersMatches) {
      if (match.length > bestMatchLength) {
        bestMatchLength = match.length;
        bestMatch = match;
      }
    }

    // 檢查最佳匹配是否符合最小位數要求
    if (bestMatchLength < BK_CONFIG.TEXT_PROCESSING.MIN_AMOUNT_DIGITS) {
      BK_logDebug(`找到的數字太短 (${bestMatch})，不符合金額標準 [${processId}]`, "文本解析", "", "BK_smartTextParsing");
      return defaultResult;
    }

    // 將匹配的數字轉為金額
    const amount = parseInt(bestMatch, 10);

    // 從原始文本中移除金額
    const remark = text.replace(new RegExp(bestMatch, 'g'), '').trim();

    // 檢查備註長度限制
    if (remark.length > BK_CONFIG.TEXT_PROCESSING.MAX_REMARK_LENGTH) {
      BK_logDebug(`備註太長 (${remark.length} > ${BK_CONFIG.TEXT_PROCESSING.MAX_REMARK_LENGTH})，不進行分離 [${processId}]`, 
               "文本解析", "", "BK_smartTextParsing");
      return defaultResult;
    }

    // 如果備註為空或只包含標點符號，考慮保留部分原始文本
    if (!remark || remark.replace(/[^\w\s]/g, '').trim() === '') {
      // 嘗試提取字母數字之外的文本部分
      const nonDigitPrefix = text.replace(/\d+.*$/, '').trim();
      if (nonDigitPrefix) {
        BK_logDebug(`備註為空，使用前綴文本: "${nonDigitPrefix}" [${processId}]`, "文本解析", "", "BK_smartTextParsing");
        return { detected: true, remark: nonDigitPrefix, amount: amount };
      }
    }

    // 記錄成功分離結果
    BK_logInfo(`成功分離: "${text}" -> 備註="${remark}", 金額=${amount} [${processId}]`, "文本解析", "", "BK_smartTextParsing");
    return { detected: true, remark: remark, amount: amount };

  } catch (error) {
    // 發生錯誤時返回原始文本
    BK_logError(`智能文本解析錯誤: ${error.toString()} [${processId}]`, "文本解析", "", "PARSE_ERROR", error.toString(), "BK_smartTextParsing");
    return { detected: false, remark: text, amount: 0 };
  }
}

/**
 * 11. 獲取特定日期範圍的記帳數據
 * @param {string} startDate - 開始日期 (YYYY/MM/DD)
 * @param {string} endDate - 結束日期 (YYYY/MM/DD)
 * @param {string} userId - 使用者ID (可選)
 * @returns {Array} - 記帳數據陣列
 */
async function BK_getBookkeepingData(startDate, endDate, userId = null) {
  BK_logDebug(`獲取${startDate}至${endDate}的記帳數據${userId ? ` (使用者: ${userId})` : ''}`, "數據查詢", userId || "", "BK_getBookkeepingData");

  try {
    // 確保已初始化
    if (!BK_INIT_STATUS.initialized) {
      await BK_initialize();
    }

    const authClient = BK_INIT_STATUS.authClient;

    // 獲取記帳表所有數據
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: BK_CONFIG.SPREADSHEET_ID,
      range: `${BK_CONFIG.LEDGER_SHEET_NAME}!A:M`
    });

    // 解析日期範圍
    const startMoment = moment(startDate, "YYYY/MM/DD");
    const endMoment = moment(endDate, "YYYY/MM/DD");

    if (!startMoment.isValid() || !endMoment.isValid()) {
      throw new Error(`無效的日期格式: ${startDate} 或 ${endDate}，請使用YYYY/MM/DD格式`);
    }

    // 篩選符合條件的記錄
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return []; // 只有標題行或沒有數據
    }

    // 取得標題行
    const headerRow = rows[0];

    // 定義欄位索引
    const idIndex = 0;         // 收支ID (A列)
    const userTypeIndex = 1;    // 使用者類型 (B列)
    const dateIndex = 2;        // 日期 (C列)
    const timeIndex = 3;        // 時間 (D列)
    const majorCodeIndex = 4;   // 主科目代碼 (E列)
    const minorCodeIndex = 5;   // 子科目代碼 (F列)
    const paymentMethodIndex = 6; // 支付方式 (G列)
    const minorNameIndex = 7;   // 子科目名稱 (H列)
    const userIdIndex = 8;      // 使用者ID (I列)
    const remarkIndex = 9;      // 備註 (J列)
    const incomeIndex = 10;     // 收入 (K列)
    const expenseIndex = 11;    // 支出 (L列)
    const synonymIndex = 12;    // 同義詞 (M列)

    // 過濾數據
    const filteredData = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // 跳過空行
      if (!row || row.length === 0) continue;

      // 確保至少有日期欄位
      if (!row[dateIndex]) continue;

      const recordDate = moment(row[dateIndex], "YYYY/MM/DD");

      // 檢查日期是否在範圍內
      if (recordDate.isBetween(startMoment, endMoment, null, '[]')) {
        // 如果指定了使用者ID，則篩選特定使用者的資料
        if (userId && row[userIdIndex] !== userId) {
          continue;
        }

        // 轉換收入/支出為數值
        let income = row[incomeIndex] ? parseFloat(row[incomeIndex]) : 0;
        let expense = row[expenseIndex] ? parseFloat(row[expenseIndex]) : 0;

        // 檢查收入/支出是否為數字
        if (isNaN(income)) income = 0;
        if (isNaN(expense)) expense = 0;

        // 建立記錄物件
        const record = {
          id: row[idIndex] || "",
          userType: row[userTypeIndex] || "",
          date: row[dateIndex] || "",
          time: row[timeIndex] || "",
          majorCode: row[majorCodeIndex] || "",
          minorCode: row[minorCodeIndex] || "",
          paymentMethod: row[paymentMethodIndex] || "",
          minorName: row[minorNameIndex] || "",
          userId: row[userIdIndex] || "",
          remark: row[remarkIndex] || "",
          income: income,
          expense: expense,
          synonym: row[synonymIndex] || ""
        };

        filteredData.push(record);
      }
    }

    BK_logInfo(`查詢到${filteredData.length}條記帳數據`, "數據查詢", userId || "", "BK_getBookkeepingData");
    return filteredData;

  } catch (error) {
    BK_logError(`獲取記帳數據失敗: ${error.toString()}`, "數據查詢", userId || "", "QUERY_ERROR", error.toString(), "BK_getBookkeepingData");
    throw new Error(`獲取記帳數據失敗: ${error.toString()}`);
  }
}

/**
 * 12. 依科目代碼獲取記帳數據
 * @param {string} startDate - 開始日期 (YYYY/MM/DD)
 * @param {string} endDate - 結束日期 (YYYY/MM/DD)
 * @param {string} majorCode - 主科目代碼
 * @param {string} minorCode - 子科目代碼 (可選)
 * @param {string} userId - 使用者ID (可選)
 * @returns {Array} - 記帳數據陣列
 */
async function BK_getDataBySubjectCode(startDate, endDate, majorCode, minorCode = null, userId = null) {
  const logPrefix = `獲取科目[${majorCode}${minorCode ? '-'+minorCode : ''}]`;
  BK_logDebug(`${logPrefix}從${startDate}至${endDate}的記帳數據${userId ? ` (使用者: ${userId})` : ''}`, "科目查詢", userId || "", "BK_getDataBySubjectCode");

  try {
    // 獲取指定日期範圍的所有記帳數據
    const allData = await BK_getBookkeepingData(startDate, endDate, userId);

    // 依科目代碼篩選
    const filteredData = allData.filter(record => {
      // 主科目必須匹配
      if (record.majorCode !== majorCode) {
        return false;
      }

      // 如果指定了子科目，則子科目也必須匹配
      if (minorCode && record.minorCode !== minorCode) {
        return false;
      }

      return true;
    });

    BK_logInfo(`查詢到科目[${majorCode}${minorCode ? '-'+minorCode : ''}]的${filteredData.length}條記帳數據`, "科目查詢", userId || "", "BK_getDataBySubjectCode");
    return filteredData;

  } catch (error) {
    BK_logError(`${logPrefix}記帳數據失敗: ${error.toString()}`, "科目查詢", userId || "", "SUBJECT_QUERY_ERROR", error.toString(), "BK_getDataBySubjectCode");
    throw new Error(`獲取科目[${majorCode}${minorCode ? '-'+minorCode : ''}]記帳數據失敗: ${error.toString()}`);
  }
}

/**
 * 13. 生成記帳摘要報告
 * @param {string} startDate - 開始日期 (YYYY/MM/DD)
 * @param {string} endDate - 結束日期 (YYYY/MM/DD)
 * @param {string} userId - 使用者ID (可選)
 * @returns {Object} - 包含收入、支出和結餘的摘要報告
 */
async function BK_generateSummaryReport(startDate, endDate, userId = null) {
  BK_logDebug(`生成${startDate}至${endDate}的記帳摘要報告${userId ? ` (使用者: ${userId})` : ''}`, "報表生成", userId || "", "BK_generateSummaryReport");

  try {
    // 獲取指定日期範圍的所有記帳數據
    const data = await BK_getBookkeepingData(startDate, endDate, userId);

    // 初始化摘要資料
    const summary = {
      startDate: startDate,
      endDate: endDate,
      userId: userId,
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      majorCategories: {}, // 主科目分類摘要
      paymentMethods: {},  // 支付方式摘要
      records: data.length,
      generatedAt: BK_formatDateTime(new Date())
    };

    // 計算總收入和總支出
    data.forEach(record => {
      // 累計總收入
      if (record.income) {
        summary.totalIncome += record.income;
      }

      // 累計總支出
      if (record.expense) {
        summary.totalExpense += record.expense;
      }

      // 依主科目累計
      const majorCode = record.majorCode;
      if (!summary.majorCategories[majorCode]) {
        summary.majorCategories[majorCode] = {
          code: majorCode,
          income: 0,
          expense: 0,
          minorCategories: {}
        };
      }

      // 累計主科目收入/支出
      if (record.income) {
        summary.majorCategories[majorCode].income += record.income;
      }
      if (record.expense) {
        summary.majorCategories[majorCode].expense += record.expense;
      }

      // 依子科目累計
      const minorCode = record.minorCode;
      if (!summary.majorCategories[majorCode].minorCategories[minorCode]) {
        summary.majorCategories[majorCode].minorCategories[minorCode] = {
          code: minorCode,
          name: record.minorName, // 使用子科目名稱
          income: 0,
          expense: 0
        };
      }

      // 累計子科目收入/支出
      if (record.income) {
        summary.majorCategories[majorCode].minorCategories[minorCode].income += record.income;
      }
      if (record.expense) {
        summary.majorCategories[majorCode].minorCategories[minorCode].expense += record.expense;
      }

      // 依支付方式累計
      const paymentMethod = record.paymentMethod || '未知';
      if (!summary.paymentMethods[paymentMethod]) {
        summary.paymentMethods[paymentMethod] = {
          method: paymentMethod,
          income: 0,
          expense: 0
        };
      }

      // 累計支付方式收入/支出
      if (record.income) {
        summary.paymentMethods[paymentMethod].income += record.income;
      }
      if (record.expense) {
        summary.paymentMethods[paymentMethod].expense += record.expense;
      }
    });

    // 計算結餘 (收入 - 支出)
    summary.balance = summary.totalIncome - summary.totalExpense;

    // 將主科目和子科目轉換為陣列格式，方便前端處理
    const majorCategoriesArray = [];
    Object.keys(summary.majorCategories).forEach(majorCode => {
      const majorCategory = summary.majorCategories[majorCode];

      // 轉換子科目物件為陣列
      const minorCategoriesArray = [];
      Object.keys(majorCategory.minorCategories).forEach(minorCode => {
        minorCategoriesArray.push(majorCategory.minorCategories[minorCode]);
      });

      // 用陣列替換原物件
      majorCategory.minorCategories = minorCategoriesArray;
      majorCategoriesArray.push(majorCategory);
    });

    // 將支付方式轉換為陣列
    const paymentMethodsArray = [];
    Object.keys(summary.paymentMethods).forEach(method => {
      paymentMethodsArray.push(summary.paymentMethods[method]);
    });

    // 用陣列替換原物件
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
 * 14. 獲取所有已啟用的科目類別
 * @returns {Object} - 包含主科目和子科目的映射關係
 */
async function BK_getEnabledSubjectCategories() {
  BK_logDebug(`獲取所有已啟用的科目類別`, "科目查詢", "", "BK_getEnabledSubjectCategories");

  try {
    // 檢查是否有緩存的科目類別數據
    const cacheKey = 'SUBJECT_CATEGORIES';
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      BK_logDebug(`使用緩存的科目類別數據`, "科目查詢", "", "BK_getEnabledSubjectCategories");
      return cachedData;
    }

    // 如果沒有緩存，則從環境變數或外部源獲取科目表
    // 這裡我們使用本地緩存的科目對應表，在實際應用中可以從資料庫或API獲取
    const subjectList = {
      '1': {
        name: '薪資收入',
        subCategories: {
          '1': { name: '正職薪資', enabled: true },
          '2': { name: '兼職薪資', enabled: true },
          '3': { name: '獎金', enabled: true },
          '4': { name: '加班費', enabled: true },
          '5': { name: '其他薪資', enabled: true }
        }
      },
      '2': {
        name: '其他收入',
        subCategories: {
          '1': { name: '投資收益', enabled: true },
          '2': { name: '租金收入', enabled: true },
          '3': { name: '利息收入', enabled: true },
          '4': { name: '贈與', enabled: true },
          '5': { name: '退款', enabled: true },
          '6': { name: '其他', enabled: true }
        }
      },
      '3': {
        name: '飲食支出',
        subCategories: {
          '1': { name: '正餐', enabled: true },
          '2': { name: '點心飲料', enabled: true },
          '3': { name: '食材', enabled: true },
          '4': { name: '外食', enabled: true },
          '5': { name: '其他', enabled: true }
        }
      },
      '4': {
        name: '交通支出',
        subCategories: {
          '1': { name: '大眾運輸', enabled: true },
          '2': { name: '計程車', enabled: true },
          '3': { name: '共享交通', enabled: true },
          '4': { name: '油費', enabled: true },
          '5': { name: '停車費', enabled: true },
          '6': { name: '維修保養', enabled: true },
          '7': { name: '其他', enabled: true }
        }
      }
      // 此處省略其他科目...
    };

    // 過濾出已啟用的科目
    const enabledCategories = {};

    Object.keys(subjectList).forEach(majorCode => {
      const majorCategory = subjectList[majorCode];
      const enabledSubCategories = {};

      Object.keys(majorCategory.subCategories).forEach(minorCode => {
        const subCategory = majorCategory.subCategories[minorCode];

        if (subCategory.enabled) {
          enabledSubCategories[minorCode] = {
            code: minorCode,
            name: subCategory.name
          };
        }
      });

      if (Object.keys(enabledSubCategories).length > 0) {
        enabledCategories[majorCode] = {
          code: majorCode,
          name: majorCategory.name,
          subCategories: enabledSubCategories
        };
      }
    });

    // 設置緩存
    setCachedData(cacheKey, enabledCategories, 3600); // 緩存1小時

    BK_logInfo(`獲取${Object.keys(enabledCategories).length}個主科目類別`, "科目查詢", "", "BK_getEnabledSubjectCategories");
    return enabledCategories;

  } catch (error) {
    BK_logError(`獲取科目類別失敗: ${error.toString()}`, "科目查詢", "", "CATEGORY_ERROR", error.toString(), "BK_getEnabledSubjectCategories");
    throw new Error(`獲取科目類別失敗: ${error.toString()}`);
  }
}

// 緩存相關輔助函數
const _cache = new Map();

function getCachedData(key) {
  if (!_cache.has(key)) return null;

  const cachedItem = _cache.get(key);
  if (cachedItem.expiresAt < Date.now()) {
    _cache.delete(key);
    return null;
  }

  return cachedItem.data;
}

function setCachedData(key, data, ttlSeconds = 3600) {
  _cache.set(key, {
    data: data,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

/**
 * 15. 判斷模組是否已初始化
 * @returns {boolean} - 是否已初始化
 */
function BK_isInitialized() {
  return BK_INIT_STATUS.initialized;
}

// 導出需要被外部使用的函數
module.exports = {
  BK_processBookkeeping,
  BK_getBookkeepingData,
  BK_getDataBySubjectCode,
  BK_generateSummaryReport,
  BK_getEnabledSubjectCategories,
  BK_getPaymentMethods,
  BK_validatePaymentMethod,
  BK_smartTextParsing,
  BK_isInitialized,
  BK_initialize
};