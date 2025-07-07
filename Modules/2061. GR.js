/**
 * 報表生成模組_1.0.7
 * 負責生成各種財務報表數據，包括日報、週報、月報和自訂報表
 */

/**
 * 1. 配置參數
 */
const GR_CONFIG = {
  DEBUG: true,                            // 調試模式開關 (僅作為標記，實際控制權交給DL模組)
  LOG_LEVEL: "DEBUG",                     // 日誌級別: DEBUG, INFO, WARNING, ERROR, CRITICAL
  SPREADSHEET_ID: getScriptProperty('SPREADSHEET_ID'), // 從 Config_Sandbox 獲取試算表 ID
  LEDGER_SHEET_NAME: "999. Test ledger", // 記帳表名稱
  TIMEZONE: "Asia/Taipei",                // 時區設置
  INITIALIZATION_INTERVAL: 600000,        // 初始化間隔 (10分鐘)
  MAX_RECURSIVE_DEPTH: 10,                // 最大遞迴深度，防止無限循環
  DEFAULT_CURRENCY: "TWD",                // 預設貨幣代碼
  LOCALE: "zh-TW",                        // 預設區域設定
  DATE_FORMAT: "yyyy/MM/dd"               // 預設日期格式
};

/**
 * 2. 初始化狀態追蹤
 */
let GR_INIT_STATUS = {
  initialized: false,
  lastInitTime: 0,
  DL_initialized: false,
  spreadsheet: null,
  ledgerSheet: null
};

/**
 * 3. 定義嚴重等級（作為DL模組備用）
 */
const GR_SEVERITY_DEFAULTS = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50
};

/**
 * 4. 全局請求深度追蹤器
 */
let GR_requestDepth = {
  depth: 0,
  maxDepth: GR_CONFIG.MAX_RECURSIVE_DEPTH,
  stack: []
};

/**
 * 5. 安全獲取DL級別函數
 */
function GR_getDLSeverity(level, defaultValue) {
  try {
    if (typeof DL_SEVERITY === 'object' && DL_SEVERITY[level] !== undefined) {
      return DL_SEVERITY[level];
    }
  } catch (e) {
    // 忽略任何錯誤，使用默認值
  }
  return defaultValue;
}

/**
 * 6. 模組日誌等級映射
 */
const GR_LOG_LEVEL_MAP = {
  "DEBUG": GR_getDLSeverity("DEBUG", GR_SEVERITY_DEFAULTS.DEBUG),
  "INFO": GR_getDLSeverity("INFO", GR_SEVERITY_DEFAULTS.INFO),
  "WARNING": GR_getDLSeverity("WARNING", GR_SEVERITY_DEFAULTS.WARNING),
  "ERROR": GR_getDLSeverity("ERROR", GR_SEVERITY_DEFAULTS.ERROR),
  "CRITICAL": GR_getDLSeverity("CRITICAL", GR_SEVERITY_DEFAULTS.CRITICAL)
};

/**
 * 7. 初始化函數 - 確保模組正確設置
 * @returns {boolean} 初始化是否成功
 */
function GR_initialize() {
  const currentTime = new Date().getTime();

  // 如果已初始化且未超過初始化間隔，直接返回
  if (GR_INIT_STATUS.initialized && 
      (currentTime - GR_INIT_STATUS.lastInitTime) < GR_CONFIG.INITIALIZATION_INTERVAL) {
    return true;
  }

  try {
    // 合併初始化日誌，減少輸出次數
    let initMessages = ["GR模組初始化開始 [" + new Date().toISOString() + "]"];

    // 初始化DL模組 (若尚未初始化)
    if (!GR_INIT_STATUS.DL_initialized) {
      if (typeof DL_initialize === 'function') {
        DL_initialize();
        GR_INIT_STATUS.DL_initialized = true;
        initMessages.push("DL模組初始化: 成功");

        // 設置DL日誌級別為DEBUG以顯示所有日誌
        if (typeof DL_setLogLevels === 'function') {
          DL_setLogLevels('DEBUG', 'DEBUG');
          initMessages.push("DL日誌級別設置為DEBUG");
        }
      } else {
        console.log("警告: DL模組未找到，將使用原生日誌系統");
        initMessages.push("DL模組初始化: 失敗 (未找到DL模組)");
      }
    }

    // 初始化試算表連接
    const spreadsheet = SpreadsheetApp.openById(GR_CONFIG.SPREADSHEET_ID);
    GR_INIT_STATUS.spreadsheet = spreadsheet;

    const sheet = spreadsheet.getSheetByName(GR_CONFIG.LEDGER_SHEET_NAME);
    GR_INIT_STATUS.ledgerSheet = sheet;

    if (!sheet) {
      GR_logCritical("找不到記帳表: " + GR_CONFIG.LEDGER_SHEET_NAME, "系統初始化", "", "MISSING_SHEET", "缺少必要工作表", "GR_initialize");
      initMessages.push("嚴重錯誤：找不到記帳表：" + GR_CONFIG.LEDGER_SHEET_NAME);
      return false;
    }

    // 僅輸出一條合併的初始化成功日誌
    initMessages.push("記帳表檢查: 成功");
    GR_logInfo(initMessages.join(" | "), "系統初始化", "", "GR_initialize");

    // 更新初始化狀態
    GR_INIT_STATUS.lastInitTime = currentTime;
    GR_INIT_STATUS.initialized = true;

    return true;
  } catch (error) {
    GR_logCritical("GR模組初始化錯誤: " + error.toString(), "系統初始化", "", "INIT_ERROR", error.toString(), "GR_initialize");
    return false;
  }
}

/**
 * 8. 日誌記錄函數 - 統一的日誌接口
 * @param {string} level 日誌等級
 * @param {string} message 日誌訊息
 * @param {string} operationType 操作類型
 * @param {string} userId 使用者ID
 * @param {Object} options 其他選項
 * @returns {boolean} 是否成功記錄
 */
function GR_log(level, message, operationType = "", userId = "", options = {}) {
  const {
    errorCode = "",
    errorDetails = "",
    retryCount = 0,
    location = "",
    functionName = ""
  } = options;

  try {
    // 確保DL模組已初始化
    if (typeof DL_initialize === 'function' && !GR_INIT_STATUS.DL_initialized) {
      DL_initialize();
      GR_INIT_STATUS.DL_initialized = true;
    }

    // 修正：優先使用傳入的函數名，否則使用預設函數名作為location
    const callerFunction = functionName || "GR_log";
    // 修正：確保location始終以"GR_"開頭，這有助於DL模組識別來源
    const actualLocation = location || callerFunction;

    // 根據日誌級別使用正確的函數
    switch(level) {
      case "DEBUG":
        if (typeof DL_debug === 'function') {
          return DL_debug(
            message,
            operationType || "GR系統",
            userId || "",
            errorCode || "",
            errorDetails || "",
            retryCount || 0,
            actualLocation,
            callerFunction
          );
        }
        break;
      case "INFO":
        if (typeof DL_info === 'function') {
          return DL_info(
            message, 
            operationType || "GR系統", 
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
            operationType || "GR系統", 
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
            operationType || "GR系統", 
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
            operationType || "GR系統", 
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
        operation: operationType || "GR系統",
        userId: userId || "",
        errorCode: errorCode || "",
        source: "GR",  // 明確設置來源為GR
        details: errorDetails || "",
        retryCount: retryCount || 0,
        location: actualLocation,
        severity: level,
        function: callerFunction
      });
    }

    // 最終備用方案：直接控制台輸出
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [GR] ${message} | ${operationType} | ${userId} | ${actualLocation}`);

  } catch (e) {
    // 詳細記錄日誌失敗信息
    console.error(`GR日誌錯誤: ${e.toString()} - 堆疊: ${e.stack || "無堆疊信息"}`);
    console.error(`嘗試記錄: ${level} | ${message} | ${operationType} | ${userId}`);
  }

  return true;
}

/**
 * 9. 包裝日誌函數，保持簡潔API
 */
function GR_logDebug(message, operationType = "", userId = "", location = "", functionName = "") {
  return GR_log("DEBUG", message, operationType || "GR系統", userId, { 
    location: location || "GR_logDebug", 
    functionName: functionName || "GR_logDebug" 
  });
}

function GR_logInfo(message, operationType = "", userId = "", location = "", functionName = "") {
  return GR_log("INFO", message, operationType || "GR系統", userId, { 
    location: location || "GR_logInfo", 
    functionName: functionName || "GR_logInfo" 
  });
}

function GR_logWarning(message, operationType = "", userId = "", location = "", functionName = "") {
  return GR_log("WARNING", message, operationType || "GR系統", userId, { 
    location: location || "GR_logWarning", 
    functionName: functionName || "GR_logWarning" 
  });
}

function GR_logWarn(message, operationType = "", userId = "", location = "", functionName = "") {
  return GR_logWarning(message, operationType || "GR系統", userId, location || "GR_logWarn", functionName || "GR_logWarn");
}

function GR_logError(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  return GR_log("ERROR", message, operationType || "GR系統", userId, { 
    errorCode: errorCode, 
    errorDetails: errorDetails,
    location: location || "GR_logError", 
    functionName: functionName || "GR_logError" 
  });
}

function GR_logCritical(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  return GR_log("CRITICAL", message, operationType || "GR系統", userId, { 
    errorCode: errorCode || "CRITICAL_ERROR", 
    errorDetails: errorDetails,
    location: location || "GR_logCritical", 
    functionName: functionName || "GR_logCritical" 
  });
}

/**
 * 10. 從帳本獲取資料
 * @param {Object} options 查詢選項
 * @param {string} options.startDate 開始日期 (YYYY/MM/DD)
 * @param {string} options.endDate 結束日期 (YYYY/MM/DD)
 * @param {string} options.userId 使用者ID (可選)
 * @param {string} options.categoryCode 科目代碼 (可選)
 * @returns {Object} 帳本數據和查詢結果
 */
function GR_fetchLedgerData(options) {
  const processId = Utilities.getUuid().substring(0, 8);
  GR_logInfo(`開始獲取帳本數據 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");

  // 確保模組已初始化
  GR_logDebug(`檢查模組初始化狀態 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
  if (!GR_INIT_STATUS.initialized) {
    GR_logDebug(`模組未初始化，嘗試初始化 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
    if (!GR_initialize()) {
      GR_logError(`初始化失敗，無法獲取帳本數據 [${processId}]`, "數據獲取", options.userId || "", "INIT_ERROR", "", "GR_fetchLedgerData");
      return { success: false, error: "初始化失敗" };
    }
    GR_logDebug(`模組初始化成功 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
  }

  try {
    // 獲取記帳表
    GR_logDebug(`嘗試獲取記帳表 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
    const sheet = GR_INIT_STATUS.ledgerSheet;
    if (!sheet) {
      GR_logError(`記帳表不存在 [${processId}]`, "數據獲取", options.userId || "", "SHEET_NOT_FOUND", "", "GR_fetchLedgerData");
      return { success: false, error: "記帳表不存在" };
    }

    // 獲取所有數據
    GR_logDebug(`開始讀取記帳表數據 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      GR_logInfo(`記帳表為空 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
      return { success: true, data: [], totalRecords: 0, filteredRecords: 0 };
    }

    // 獲取表頭
    GR_logDebug(`獲取表頭數據 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
    const headers = data[0];

    // 從第二行開始遍歷數據（跳過表頭）
    GR_logDebug(`開始將數據轉換為對象格式 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
    let allRecords = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const record = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = row[j];
      }
      allRecords.push(record);
    }

    GR_logInfo(`獲取了 ${allRecords.length} 條原始記錄 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");

    // 應用過濾條件
    let filteredRecords = allRecords;

    // 按日期過濾
    if (options.startDate && options.endDate) {
      GR_logDebug(`開始按日期過濾數據：${options.startDate} 至 ${options.endDate} [${processId}]`, "數據過濾", options.userId || "", "GR_fetchLedgerData");
      const startDate = new Date(options.startDate);
      const endDate = new Date(options.endDate);
      endDate.setHours(23, 59, 59, 999); // 設置為當天結束時間

      filteredRecords = filteredRecords.filter(record => {
        const recordDate = new Date(record['日期']);
        return recordDate >= startDate && recordDate <= endDate;
      });

      GR_logInfo(`按日期過濾後剩餘 ${filteredRecords.length} 條記錄 [${processId}]`, "數據過濾", options.userId || "", "GR_fetchLedgerData");
    }

    // 按使用者ID過濾
    if (options.userId) {
      GR_logDebug(`開始按使用者ID過濾數據：${options.userId} [${processId}]`, "數據過濾", options.userId || "", "GR_fetchLedgerData");
      filteredRecords = filteredRecords.filter(record => record['登錄者'] === options.userId);
      GR_logInfo(`按使用者ID過濾後剩餘 ${filteredRecords.length} 條記錄 [${processId}]`, "數據過濾", options.userId || "", "GR_fetchLedgerData");
    }

    // 按科目代碼過濾
    if (options.categoryCode) {
      GR_logDebug(`開始按科目代碼過濾數據：${options.categoryCode} [${processId}]`, "數據過濾", options.userId || "", "GR_fetchLedgerData");
      filteredRecords = filteredRecords.filter(record => {
        return record['大項代碼'] === options.categoryCode || 
               record['子項代碼'] === options.categoryCode;
      });
      GR_logInfo(`按科目代碼過濾後剩餘 ${filteredRecords.length} 條記錄 [${processId}]`, "數據過濾", options.userId || "", "GR_fetchLedgerData");
    }

    GR_logDebug(`數據獲取和過濾完成，準備返回結果 [${processId}]`, "數據獲取", options.userId || "", "GR_fetchLedgerData");
    return {
      success: true,
      data: filteredRecords,
      totalRecords: allRecords.length,
      filteredRecords: filteredRecords.length
    };

  } catch (error) {
    GR_logError(`獲取帳本數據失敗: ${error.message} [${processId}]`, "數據獲取", options.userId || "", "DATA_FETCH_ERROR", error.toString(), "GR_fetchLedgerData");
    return {
      success: false,
      error: `獲取帳本數據失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 11. 處理報表數據
 * @param {Array} data 記帳數據
 * @param {Object} options 處理選項
 * @returns {Object} 處理後的報表數據
 */
function GR_processReportData(data, options = {}) {
  const processId = Utilities.getUuid().substring(0, 8);
  GR_logInfo(`開始處理報表數據 [${processId}]`, "數據處理", options.userId || "", "GR_processReportData");

  try {
    if (!data || data.length === 0) {
      GR_logInfo(`無可用數據處理 [${processId}]`, "數據處理", options.userId || "", "GR_processReportData");
      return {
        success: true,
        summary: {
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          recordCount: 0
        },
        categories: [],
        records: []
      };
    }

    GR_logDebug(`處理 ${data.length} 條記錄 [${processId}]`, "數據處理", options.userId || "", "GR_processReportData");

    // 計算總收入、總支出和餘額
    let totalIncome = 0;
    let totalExpense = 0;

    // 分類統計
    let categories = {};

    // 處理每條記錄
    data.forEach(record => {
      const income = parseFloat(record['收入']) || 0;
      const expense = parseFloat(record['支出']) || 0;

      totalIncome += income;
      totalExpense += expense;

      // 按科目分類統計
      const categoryCode = record['子項代碼'] || record['大項代碼'];
      const categoryName = record['子項名稱'] || categoryCode;

      if (expense > 0) {
        if (!categories[categoryCode]) {
          categories[categoryCode] = {
            code: categoryCode,
            name: categoryName,
            amount: 0,
            count: 0
          };
        }
        categories[categoryCode].amount += expense;
        categories[categoryCode].count += 1;
      }
    });

    // 將分類轉為數組並按金額排序
    const categoriesArray = Object.values(categories).sort((a, b) => b.amount - a.amount);

    // 計算餘額
    const balance = totalIncome - totalExpense;

    GR_logInfo(`報表數據處理完成: 收入=${totalIncome}, 支出=${totalExpense}, 餘額=${balance} [${processId}]`, "數據處理", options.userId || "", "GR_processReportData");

    return {
      success: true,
      summary: {
        totalIncome: totalIncome,
        totalExpense: totalExpense,
        balance: balance,
        recordCount: data.length
      },
      categories: categoriesArray,
      records: data
    };

  } catch (error) {
    GR_logError(`處理報表數據失敗: ${error.message} [${processId}]`, "數據處理", options.userId || "", "DATA_PROCESS_ERROR", error.toString(), "GR_processReportData");
    return {
      success: false,
      error: `處理報表數據失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 12. 格式化金額為指定貨幣格式
 * @param {number} amount 金額
 * @param {string} currencyCode 貨幣代碼 (預設為TWD)
 * @param {string} locale 地區設定 (預設為zh-TW)
 * @returns {string} 格式化後的金額字串
 */
function GR_formatCurrency(amount, currencyCode = GR_CONFIG.DEFAULT_CURRENCY, locale = GR_CONFIG.LOCALE) {
  try {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '0';
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    GR_logWarning(`金額格式化失敗: ${error.message}`, "系統功能", "", "FORMAT_ERROR", error.toString(), "GR_formatCurrency");
    // 基本備用格式化
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * 12.2 格式化日期
 * @param {Date|string} date 日期對象或日期字串
 * @param {string} format 格式 (預設為GR_CONFIG.DATE_FORMAT)
 * @returns {string} 格式化後的日期字串
 */
function GR_formatDate(date, format = GR_CONFIG.DATE_FORMAT) {
  try {
    if (!date) {
      return '';
    }

    // 如果是字符串，先轉為日期對象
    if (typeof date === 'string') {
      date = new Date(date);
    }

    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }

    // 基本格式化 (可根據需要擴展)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // 根據指定格式返回
    let result = format;
    result = result.replace('yyyy', year);
    result = result.replace('MM', month);
    result = result.replace('dd', day);

    return result;
  } catch (error) {
    GR_logWarning(`日期格式化失敗: ${error.message}`, "系統功能", "", "FORMAT_ERROR", error.toString(), "GR_formatDate");
    // 基本備用格式化
    return date instanceof Date ? date.toISOString().split('T')[0] : String(date);
  }
}

/**
 * 12.3 解析日期字串為Date對象
 * @param {string} dateString 日期字串 (支援多種格式)
 * @returns {Date|null} 解析後的Date對象，解析失敗返回null
 */
function GR_parseDate(dateString) {
  if (!dateString) {
    return null;
  }

  try {
    // 處理常見的日期格式
    let date;

    // 處理 yyyy/MM/dd 或 yyyy-MM-dd 格式
    if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(dateString)) {
      // 將日期字串分解為年、月、日
      const parts = dateString.split(/[/-]/);
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 月份從0開始
      const day = parseInt(parts[2], 10);

      date = new Date(year, month, day);
    } else {
      // 嘗試使用標準解析
      date = new Date(dateString);
    }

    // 檢查日期是否有效
    if (isNaN(date.getTime())) {
      GR_logWarning(`無效的日期字串: ${dateString}`, "系統功能", "", "PARSE_ERROR", "", "GR_parseDate");
      return null;
    }

    return date;
  } catch (error) {
    GR_logWarning(`日期解析失敗: ${error.message}, 日期字串: ${dateString}`, "系統功能", "", "PARSE_ERROR", error.toString(), "GR_parseDate");
    return null;
  }
}

/**
 * 12.4 計算兩個日期之間的天數
 * @param {string|Date} startDate 開始日期
 * @param {string|Date} endDate 結束日期
 * @returns {number} 相差的天數 (包含首尾日期)
 */
function GR_calculateDateDifference(startDate, endDate) {
  try {
    // 確保日期是Date對象
    const start = startDate instanceof Date ? startDate : GR_parseDate(startDate);
    const end = endDate instanceof Date ? endDate : GR_parseDate(endDate);

    if (!start || !end) {
      throw new Error("無效的日期");
    }

    // 設置為當天的開始時間，避免時區影響
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    // 計算差異毫秒數並轉換為天數
    const diffTime = Math.abs(endDay - startDay);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 包含首尾日期，所以加1
    return diffDays + 1;
  } catch (error) {
    GR_logError(`計算日期差異失敗: ${error.message}`, "系統功能", "", "CALCULATION_ERROR", error.toString(), "GR_calculateDateDifference");
    return 0;
  }
}

/**
 * 13. 應用過濾器
 * @param {Array} data 記帳數據
 * @param {Object} filters 過濾條件
 * @returns {Object} 過濾後的數據
 */
function GR_applyFilters(data, filters = {}) {
  const processId = Utilities.getUuid().substring(0, 8);
  GR_logInfo(`開始應用過濾器 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
  GR_logDebug(`過濾條件: ${JSON.stringify(filters)} [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");

  try {
    if (!data || data.length === 0) {
      GR_logDebug(`輸入數據為空，跳過過濾 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
      return { success: true, data: [] };
    }

    GR_logDebug(`輸入數據: ${data.length} 條記錄 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
    let filteredData = [...data];

    // 按金額範圍過濾
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      GR_logDebug(`開始按金額範圍過濾 (最小: ${filters.minAmount}, 最大: ${filters.maxAmount}) [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
      filteredData = filteredData.filter(record => {
        const amount = Math.max(
          parseFloat(record['收入']) || 0,
          parseFloat(record['支出']) || 0
        );

        let passesFilter = true;
        if (filters.minAmount !== undefined) {
          passesFilter = passesFilter && amount >= filters.minAmount;
        }
        if (filters.maxAmount !== undefined) {
          passesFilter = passesFilter && amount <= filters.maxAmount;
        }

        return passesFilter;
      });

      GR_logInfo(`應用金額過濾後剩餘 ${filteredData.length} 條記錄 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
    }

    // 按照支付方式過濾
    if (filters.paymentMethod) {
      GR_logDebug(`開始按支付方式過濾: ${filters.paymentMethod} [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
      filteredData = filteredData.filter(record => {
        return record['支付方式'] === filters.paymentMethod;
      });
      GR_logInfo(`應用支付方式過濾後剩餘 ${filteredData.length} 條記錄 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
    }

    // 關鍵字搜索（在備註或名稱中搜索）
    if (filters.keyword) {
      GR_logDebug(`開始按關鍵字過濾: ${filters.keyword} [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
      const keyword = filters.keyword.toLowerCase();
      filteredData = filteredData.filter(record => {
        return (
          (record['備註'] && record['備註'].toString().toLowerCase().includes(keyword)) ||
          (record['子項名稱'] && record['子項名稱'].toString().toLowerCase().includes(keyword))
        );
      });
      GR_logInfo(`應用關鍵字過濾後剩餘 ${filteredData.length} 條記錄 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
    }

    // 新增：按標籤過濾
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      GR_logDebug(`開始按標籤過濾: ${filters.tags.join(', ')} [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
      filteredData = filteredData.filter(record => {
        // 假設標籤存儲在記錄的'標籤'字段，格式為逗號分隔的字符串
        if (!record['標籤']) return false;

        const recordTags = record['標籤'].toString().toLowerCase().split(',').map(tag => tag.trim());
        return filters.tags.some(tag => recordTags.includes(tag.toLowerCase().trim()));
      });
      GR_logInfo(`應用標籤過濾後剩餘 ${filteredData.length} 條記錄 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
    }

    GR_logDebug(`過濾完成，最終返回 ${filteredData.length} 條記錄 [${processId}]`, "數據過濾", filters.userId || "", "GR_applyFilters");
    return { success: true, data: filteredData };

  } catch (error) {
    GR_logError(`應用過濾器失敗: ${error.message} [${processId}]`, "數據過濾", filters.userId || "", "FILTER_ERROR", error.toString(), "GR_applyFilters");
    return {
      success: false,
      error: `應用過濾器失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 14. 查找最高支出日
 * @param {Array} data 記帳數據
 * @returns {Object} 最高支出日信息
 */
function GR_findHighestExpenseDay(data) {
  const processId = Utilities.getUuid().substring(0, 8);
  GR_logDebug(`開始查找最高支出日 [${processId}]`, "數據分析", "", "GR_findHighestExpenseDay");

  try {
    if (!data || data.length === 0) {
      return { date: null, amount: 0, formattedAmount: GR_formatCurrency(0) };
    }

    // 按日期分組
    const expenseByDate = {};

    data.forEach(record => {
      const dateStr = record['日期'];
      if (!dateStr) return;

      const expense = parseFloat(record['支出']) || 0;
      if (expense <= 0) return;

      if (!expenseByDate[dateStr]) {
        expenseByDate[dateStr] = 0;
      }

      expenseByDate[dateStr] += expense;
    });

    // 找出最高支出日
    let highestDate = null;
    let highestAmount = 0;

    Object.keys(expenseByDate).forEach(date => {
      if (expenseByDate[date] > highestAmount) {
        highestAmount = expenseByDate[date];
        highestDate = date;
      }
    });

    GR_logDebug(`找到最高支出日: ${highestDate}, 金額: ${highestAmount} [${processId}]`, "數據分析", "", "GR_findHighestExpenseDay");

    // 返回格式化的金額
    return { 
      date: highestDate, 
      amount: highestAmount,
      formattedAmount: GR_formatCurrency(highestAmount),
      formattedDate: GR_formatDate(highestDate)
    };

  } catch (error) {
    GR_logError(`查找最高支出日失敗: ${error.message} [${processId}]`, "數據分析", "", "ANALYSIS_ERROR", error.toString(), "GR_findHighestExpenseDay");
    return { 
      date: null, 
      amount: 0, 
      error: error.message,
      formattedAmount: GR_formatCurrency(0)
    };
  }
}

/**
 * 14.1 查找最高收入日
 * @param {Array} data 記帳數據
 * @returns {Object} 最高收入日信息
 */
function GR_findHighestIncomeDay(data) {
  const processId = Utilities.getUuid().substring(0, 8);
  GR_logDebug(`開始查找最高收入日 [${processId}]`, "數據分析", "", "GR_findHighestIncomeDay");

  try {
    if (!data || data.length === 0) {
      return { date: null, amount: 0, formattedAmount: GR_formatCurrency(0) };
    }

    // 按日期分組
    const incomeByDate = {};

    data.forEach(record => {
      const dateStr = record['日期'];
      if (!dateStr) return;

      const income = parseFloat(record['收入']) || 0;
      if (income <= 0) return;

      if (!incomeByDate[dateStr]) {
        incomeByDate[dateStr] = 0;
      }

      incomeByDate[dateStr] += income;
    });

    // 找出最高收入日
    let highestDate = null;
    let highestAmount = 0;

    Object.keys(incomeByDate).forEach(date => {
      if (incomeByDate[date] > highestAmount) {
        highestAmount = incomeByDate[date];
        highestDate = date;
      }
    });

    GR_logDebug(`找到最高收入日: ${highestDate}, 金額: ${highestAmount} [${processId}]`, "數據分析", "", "GR_findHighestIncomeDay");

    // 返回格式化的金額
    return { 
      date: highestDate, 
      amount: highestAmount,
      formattedAmount: GR_formatCurrency(highestAmount),
      formattedDate: GR_formatDate(highestDate)
    };

  } catch (error) {
    GR_logError(`查找最高收入日失敗: ${error.message} [${processId}]`, "數據分析", "", "ANALYSIS_ERROR", error.toString(), "GR_findHighestIncomeDay");
    return { 
      date: null, 
      amount: 0, 
      error: error.message,
      formattedAmount: GR_formatCurrency(0)
    };
  }
}

/**
 * 14.2 尋找最常使用支付方式
 * @param {Array} data 記帳數據
 * @returns {Object} 最常用支付方式信息
 */
function GR_findTopPaymentMethod(data) {
  const processId = Utilities.getUuid().substring(0, 8);
  GR_logDebug(`開始分析最常用支付方式 [${processId}]`, "數據分析", "", "GR_findTopPaymentMethod");

  try {
    if (!data || data.length === 0) {
      return { method: null, count: 0, percentage: 0 };
    }

    // 統計各支付方式使用次數
    const methodCounts = {};
    let totalTransactions = 0;

    data.forEach(record => {
      if (!record['支付方式']) return;

      const method = record['支付方式'].toString().trim();
      if (!method) return;

      if (!methodCounts[method]) {
        methodCounts[method] = 0;
      }

      methodCounts[method]++;
      totalTransactions++;
    });

    // 找出最常用的支付方式
    let topMethod = null;
    let topCount = 0;

    Object.keys(methodCounts).forEach(method => {
      if (methodCounts[method] > topCount) {
        topCount = methodCounts[method];
        topMethod = method;
      }
    });

    // 計算百分比
    const percentage = totalTransactions === 0 ? 0 : (topCount / totalTransactions) * 100;

    GR_logDebug(`最常用支付方式: ${topMethod}, 使用次數: ${topCount}, 佔比: ${percentage.toFixed(2)}% [${processId}]`, "數據分析", "", "GR_findTopPaymentMethod");

    return {
      method: topMethod,
      count: topCount,
      percentage: percentage,
      formattedPercentage: `${percentage.toFixed(2)}%`
    };

  } catch (error) {
    GR_logError(`分析最常用支付方式失敗: ${error.message} [${processId}]`, "數據分析", "", "ANALYSIS_ERROR", error.toString(), "GR_findTopPaymentMethod");
    return { method: null, count: 0, percentage: 0, error: error.message };
  }
}

/**
 * 14. 計算平均支出
 * @param {Array} data 記帳數據
 * @returns {Object} 平均支出信息
 */
function GR_calculateAverageExpense(data) {
  const processId = Utilities.getUuid().substring(0, 8);
  GR_logDebug(`開始計算平均支出 [${processId}]`, "數據分析", "", "GR_calculateAverageExpense");

  try {
    if (!data || data.length === 0) {
      return { 
        daily: 0, 
        formattedDaily: GR_formatCurrency(0),
        weekly: 0,
        formattedWeekly: GR_formatCurrency(0),
        monthly: 0,
        formattedMonthly: GR_formatCurrency(0)
      };
    }

    const total = data.reduce((sum, item) => sum + (parseFloat(item['支出']) || 0), 0);
    const uniqueDates = new Set();

    data.forEach(record => {
      if (record['日期']) {
        uniqueDates.add(record['日期']);
      }
    });

    const days = uniqueDates.size;
    const daily = days === 0 ? 0 : total / days;
    const weekly = daily * 7;
    const monthly = daily * 30.5; // 使用平均月天數

    GR_logDebug(`計算完成 - 總支出: ${total}, 天數: ${days}, 日均: ${daily.toFixed(2)} [${processId}]`, "數據分析", "", "GR_calculateAverageExpense");

    return { 
      daily: daily,
      formattedDaily: GR_formatCurrency(daily),
      weekly: weekly,
      formattedWeekly: GR_formatCurrency(weekly),
      monthly: monthly,
      formattedMonthly: GR_formatCurrency(monthly)
    };
  } catch (error) {
    GR_logError(`計算平均支出失敗: ${error.message} [${processId}]`, "數據分析", "", "ANALYSIS_ERROR", error.toString(), "GR_calculateAverageExpense");
    return { 
      daily: 0, 
      formattedDaily: GR_formatCurrency(0),
      weekly: 0,
      formattedWeekly: GR_formatCurrency(0),
      monthly: 0,
      formattedMonthly: GR_formatCurrency(0),
      error: error.message 
    };
  }
}

/**
 * 15. 生成日報表數據
 * @param {Object} options 報表選項
 * @param {string} options.date 日期 (YYYY/MM/DD)
 * @param {string} options.userId 使用者ID (可選)
 * @param {boolean} options.isRecursiveCall 是否是遞迴調用 (內部使用)
 * @returns {Object} 日報表數據
 */
function GR_generateDailyReport(options = {}) {
  const processId = Utilities.getUuid().substring(0, 8);

  // 檢查是否為遞迴調用，若不是，則增加深度計數
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(`daily-${processId}`);
  }

  GR_logInfo(`開始生成日報表 [${processId}] (遞迴深度: ${GR_requestDepth.depth})`, "報表生成", options.userId || "", "GR_generateDailyReport");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateDailyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "日報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    // 如果未指定日期，使用當天
    const date = options.date || new Date().toISOString().split('T')[0].replace(/-/g, '/');
    GR_logDebug(`報表日期: ${date} [${processId}]`, "報表生成", options.userId || "", "GR_generateDailyReport");

    // 構建獲取資料的選項
    const fetchOptions = {
      startDate: date,
      endDate: date,
      userId: options.userId
    };

    GR_logDebug(`開始獲取帳本數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateDailyReport");
    const dataResult = GR_fetchLedgerData(fetchOptions);
    if (!dataResult.success) {
      throw new Error(dataResult.error || "獲取帳本數據失敗");
    }

    // 處理數據，傳遞遞迴標記
    GR_logDebug(`開始處理報表數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateDailyReport");
    const reportDataOptions = { ...options, isRecursiveCall: true };
    const reportData = GR_processReportData(dataResult.data, reportDataOptions);
    if (!reportData.success) {
      throw new Error(reportData.error || "處理報表數據失敗");
    }

    // 創建結果對象
    const result = {
      success: true,
      type: "日報表",
      date: date,
      reportData: reportData
    };

    GR_logInfo(`日報表生成完成 [${processId}]`, "報表生成", options.userId || "", "GR_generateDailyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成日報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), "GR_generateDailyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "日報表",
      error: `生成日報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 16. 生成週報表數據
 * @param {Object} options 報表選項
 * @param {string} options.startDate 週開始日期 (YYYY/MM/DD) (可選)
 * @param {string} options.userId 使用者ID (可選)
 * @param {boolean} options.isRecursiveCall 是否是遞迴調用 (內部使用)
 * @returns {Object} 週報表數據
 */
function GR_generateWeeklyReport(options = {}) {
  const processId = Utilities.getUuid().substring(0, 8);

  // 檢查是否為遞迴調用，若不是，則增加深度計數
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(`weekly-${processId}`);
  }

  GR_logInfo(`開始生成週報表 [${processId}] (遞迴深度: ${GR_requestDepth.depth})`, "報表生成", options.userId || "", "GR_generateWeeklyReport");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateWeeklyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "週報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    // 計算報表時間範圍
    let startDate, endDate;
    if (options.startDate) {
      startDate = new Date(options.startDate);
      if (isNaN(startDate.getTime())) {
        throw new Error("無效的開始日期格式");
      }
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
    }
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // 格式化日期為 YYYY/MM/DD
    const formatDate = function(date) {
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      return year + "/" + month + "/" + day;
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    GR_logDebug(`報表日期範圍: ${startDateStr} 至 ${endDateStr} [${processId}]`, "報表生成", options.userId || "", "GR_generateWeeklyReport");

    // 構建數據獲取選項
    const fetchOptions = {
      startDate: startDateStr,
      endDate: endDateStr,
      userId: options.userId
    };

    // 獲取帳本數據
    GR_logDebug(`開始獲取帳本數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateWeeklyReport");
    const dataResult = GR_fetchLedgerData(fetchOptions);
    if (!dataResult.success) {
      throw new Error(dataResult.error || "獲取帳本數據失敗");
    }

    // 處理數據，傳遞遞迴標記
    GR_logDebug(`開始處理報表數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateWeeklyReport");
    const reportDataOptions = { ...options, isRecursiveCall: true };
    const reportData = GR_processReportData(dataResult.data, reportDataOptions);
    if (!reportData.success) {
      throw new Error(reportData.error || "處理報表數據失敗");
    }

    // 計算最高支出日
    GR_logDebug(`計算最高支出日 [${processId}]`, "報表生成", options.userId || "", "GR_generateWeeklyReport");
    const highestDay = GR_findHighestExpenseDay(dataResult.data);
    reportData.highestExpenseDay = highestDay;

    // 計算平均支出
    GR_logDebug(`計算平均支出 [${processId}]`, "報表生成", options.userId || "", "GR_generateWeeklyReport");
    const averageExpense = GR_calculateAverageExpense(dataResult.data);
    reportData.averageExpense = averageExpense;

    // 創建結果對象
    const result = {
      success: true,
      type: "週報表",
      startDate: startDateStr,
      endDate: endDateStr,
      reportData: reportData
    };

    GR_logInfo(`週報表生成完成 [${processId}]`, "報表生成", options.userId || "", "GR_generateWeeklyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    // 記錄錯誤日誌
    GR_logError(`生成週報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), "GR_generateWeeklyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "週報表",
      error: `生成週報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 17. 生成月報表數據
 * @param {Object} options 報表選項
 * @param {string} options.year 年份 (YYYY) (可選)
 * @param {string} options.month 月份 (MM) (可選)
 * @param {string} options.userId 使用者ID (可選)
 * @param {boolean} options.isRecursiveCall 是否是遞迴調用 (內部使用)
 * @returns {Object} 月報表數據
 */
function GR_generateMonthlyReport(options = {}) {
  const processId = Utilities.getUuid().substring(0, 8);

  // 檢查是否為遞迴調用，若不是，則增加深度計數
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(`monthly-${processId}`);
  }

  GR_logInfo(`開始生成月報表 [${processId}] (遞迴深度: ${GR_requestDepth.depth})`, "報表生成", options.userId || "", "GR_generateMonthlyReport");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateMonthlyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "月報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    // 計算報表時間範圍
    let year, month;

    if (options.year && options.month) {
      year = parseInt(options.year);
      month = parseInt(options.month);
    } else {
      // 默認使用當前年月
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1; // JavaScript 月份從0開始
    }

    GR_logDebug(`報表年月: ${year}年${month}月 [${processId}]`, "報表生成", options.userId || "", "GR_generateMonthlyReport");

    // 計算月的第一天和最後一天
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // 格式化日期為YYYY/MM/DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    GR_logDebug(`報表日期範圍: ${startDateStr} 至 ${endDateStr} [${processId}]`, "報表生成", options.userId || "", "GR_generateMonthlyReport");

    // 獲取數據
    const fetchOptions = {
      startDate: startDateStr,
      endDate: endDateStr,
      userId: options.userId
    };

    GR_logDebug(`開始獲取帳本數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateMonthlyReport");
    const dataResult = GR_fetchLedgerData(fetchOptions);
    if (!dataResult.success) {
      throw new Error(dataResult.error || "獲取帳本數據失敗");
    }

    // 處理數據，傳遞遞迴標記
    GR_logDebug(`開始處理報表數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateMonthlyReport");
    const reportDataOptions = { ...options, isRecursiveCall: true };
    const reportData = GR_processReportData(dataResult.data, reportDataOptions);
    if (!reportData.success) {
      throw new Error(reportData.error || "處理報表數據失敗");
    }

    // 計算高支出日
    GR_logDebug(`計算最高支出日 [${processId}]`, "報表生成", options.userId || "", "GR_generateMonthlyReport");
    const highestDay = GR_findHighestExpenseDay(dataResult.data);
    reportData.highestExpenseDay = highestDay;

    // 計算平均支出
    GR_logDebug(`計算平均支出 [${processId}]`, "報表生成", options.userId || "", "GR_generateMonthlyReport");
    const averageExpense = GR_calculateAverageExpense(dataResult.data);
    reportData.averageExpense = averageExpense;

    // 創建結果對象
    const result = {
      success: true,
      type: "月報表",
      year: year,
      month: month,
      startDate: startDateStr,
      endDate: endDateStr,
      reportData: reportData
    };

    GR_logInfo(`月報表生成完成 [${processId}]`, "報表生成", options.userId || "", "GR_generateMonthlyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成月報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), "GR_generateMonthlyReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "月報表",
      error: `生成月報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 18. 生成自訂報表數據
 * @version 2025-06-17-V1.0.4
 * @author AustinLiao69
 * @update: 新增完整的自訂報表生成功能，支援靈活的日期範圍和過濾條件
 * @param {Object} options 報表選項
 * @param {string} options.startDate 開始日期 (YYYY/MM/DD)
 * @param {string} options.endDate 結束日期 (YYYY/MM/DD)
 * @param {string} options.userId 使用者ID (可選)
 * @param {string} options.categoryCode 科目代碼 (可選)
 * @param {Object} options.filters 額外過濾條件 (可選)
 * @param {boolean} options.isRecursiveCall 是否是遞迴調用 (內部使用)
 * @returns {Object} 自訂報表數據
 */
function GR_generateCustomReport(options = {}) {
  const processId = require('uuid').v4().substring(0, 8);

  // 檢查是否為遞迴調用，若不是，則增加深度計數
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(`custom-${processId}`);
  }

  GR_logInfo(`開始生成自訂報表 [${processId}] (遞迴深度: ${GR_requestDepth.depth})`, "報表生成", options.userId || "", "GR_generateCustomReport");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateCustomReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "自訂報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    // 驗證必要參數
    if (!options.startDate || !options.endDate) {
      throw new Error("自訂報表需要指定開始日期和結束日期");
    }

    // 日期格式驗證
    const dateValidation = GR_validateDateFormat(options.startDate, options.endDate);
    if (!dateValidation.isValid) {
      throw new Error(`日期格式錯誤: ${dateValidation.error}`);
    }

    GR_logDebug(`自訂報表日期範圍: ${options.startDate} 至 ${options.endDate} [${processId}]`, "報表生成", options.userId || "", "GR_generateCustomReport");

    // 構建數據獲取選項
    const fetchOptions = {
      startDate: options.startDate,
      endDate: options.endDate,
      userId: options.userId,
      categoryCode: options.categoryCode
    };

    // 獲取帳本數據
    GR_logDebug(`開始獲取帳本數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateCustomReport");
    const dataResult = GR_fetchLedgerData(fetchOptions);
    if (!dataResult.success) {
      throw new Error(dataResult.error || "獲取帳本數據失敗");
    }

    // 應用額外過濾條件
    let processedData = dataResult.data;
    if (options.filters) {
      GR_logDebug(`應用額外過濾條件 [${processId}]`, "報表生成", options.userId || "", "GR_generateCustomReport");
      const filterResult = GR_applyFilters(processedData, options.filters);
      if (!filterResult.success) {
        throw new Error(filterResult.error || "應用過濾條件失敗");
      }
      processedData = filterResult.data;
    }

    // 處理數據，傳遞遞迴標記
    GR_logDebug(`開始處理報表數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateCustomReport");
    const reportDataOptions = { ...options, isRecursiveCall: true };
    const reportData = GR_processReportData(processedData, reportDataOptions);
    if (!reportData.success) {
      throw new Error(reportData.error || "處理報表數據失敗");
    }

    // 計算額外統計信息
    GR_logDebug(`計算額外統計信息 [${processId}]`, "報表生成", options.userId || "", "GR_generateCustomReport");
    const highestDay = GR_findHighestExpenseDay(processedData);
    const averageExpense = GR_calculateAverageExpense(processedData);

    // 添加統計信息到報表數據
    reportData.highestExpenseDay = highestDay;
    reportData.averageExpense = averageExpense;
    reportData.dateRange = {
      startDate: options.startDate,
      endDate: options.endDate,
      totalDays: GR_calculateDateDifference(options.startDate, options.endDate)
    };

    // 創建結果對象
    const result = {
      success: true,
      type: "自訂報表",
      startDate: options.startDate,
      endDate: options.endDate,
      reportData: reportData,
      appliedFilters: options.filters || {}
    };

    GR_logInfo(`自訂報表生成完成 [${processId}]`, "報表生成", options.userId || "", "GR_generateCustomReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成自訂報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), "GR_generateCustomReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "自訂報表",
      error: `生成自訂報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

 /**
 * 19. 處理報表請求 - 主要入口函數
 * @param {Object} request 請求參數
 * @param {string} request.reportType 報表類型 (daily, weekly, monthly, custom)
 * @param {Object} request.options 報表選項
 * @returns {Object} 處理結果
 */
function GR_processReportRequest(request) {
  const processId = require('uuid').v4().substring(0, 8);

  // 遞迴深度控制
  GR_requestDepth.depth++;
  GR_requestDepth.stack.push(`${request.reportType || "unknown"}-${processId}`);

  GR_logInfo(`開始處理報表請求 [${processId}], 類型: ${request.reportType || "未指定"} (遞迴深度: ${GR_requestDepth.depth})`, "報表請求", request.options?.userId || "", "GR_processReportRequest");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表請求", request.options?.userId || "", "GR_processReportRequest");

    // 重置深度計數器並返回錯誤
    const stackTrace = [...GR_requestDepth.stack];
    GR_requestDepth.depth = 0;
    GR_requestDepth.stack = [];

    return {
      success: false,
      reportType: request.reportType,
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${stackTrace.join(' -> ')}`,
    };
  }

  try {
    // 確保模組已初始化
    if (!GR_initialize()) {
      throw new Error("GR模組初始化失敗");
    }

    if (!request || !request.reportType) {
      throw new Error("缺少必要的報表類型參數");
    }

    const options = request.options || {};
    const reportType = request.reportType.toLowerCase();

    let result;

    // 根據報表類型調用不同的報表生成函數
    switch (reportType) {
      case "daily":
        GR_logDebug(`處理日報表請求 [${processId}]`, "報表請求", options.userId || "", "GR_processReportRequest");
        result = GR_generateDailyReport(options);
        break;

      case "weekly":
        GR_logDebug(`處理週報表請求 [${processId}]`, "報表請求", options.userId || "", "GR_processReportRequest");
        result = GR_generateWeeklyReport(options);
        break;

      case "monthly":
        GR_logDebug(`處理月報表請求 [${processId}]`, "報表請求", options.userId || "", "GR_processReportRequest");
        result = GR_generateMonthlyReport(options);
        break;

      case "custom":
        GR_logDebug(`處理自訂報表請求 [${processId}]`, "報表請求", options.userId || "", "GR_processReportRequest");
        if (!options.startDate || !options.endDate) {
          throw new Error("自訂報表需要提供開始和結束日期");
        }
        result = GR_generateCustomReport(options);
        break;

      default:
        throw new Error(`不支援的報表類型: ${reportType}`);
    }

    if (!result.success) {
      throw new Error(result.error || "報表生成失敗");
    }

    GR_logInfo(`報表請求處理完成 [${processId}], 類型: ${reportType}`, "報表請求", options.userId || "", "GR_processReportRequest");

    // 處理完成後減少深度計數
    GR_requestDepth.depth--;
    GR_requestDepth.stack.pop();

    return {
      success: true,
      reportType: reportType,
      reportData: result.reportData,
      ...result
    };

  } catch (error) {
    GR_logError(`處理報表請求失敗: ${error.message} [${processId}]`, "報表請求", request.options?.userId || "", "REQUEST_ERROR", error.toString(), "GR_processReportRequest");

    // 發生錯誤時也要減少深度計數
    GR_requestDepth.depth--;
    GR_requestDepth.stack.pop();

    return {
      success: false,
      reportType: request.reportType,
      error: `處理報表請求失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 20. 生成同比報表數據
 * @param {Object} options 報表選項
 * @param {string} options.year 年份 (YYYY)
 * @param {string} options.month 月份 (MM)
 * @param {string} options.userId 使用者ID (可選)
 * @param {boolean} options.isRecursiveCall 是否是遞迴調用 (內部使用)
 * @returns {Object} 同比報表數據
 */
function GR_generateYoYReport(options = {}) {
  const processId = require('uuid').v4().substring(0, 8);

  // 檢查是否為遞迴調用，若不是，則增加深度計數
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(`yoy-${processId}`);
  }

  GR_logInfo(`開始生成同比報表 [${processId}] (遞迴深度: ${GR_requestDepth.depth})`, "報表生成", options.userId || "", "GR_generateYoYReport");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateYoYReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "同比報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.year || !options.month) {
      throw new Error("缺少必要的年份或月份參數");
    }

    const year = parseInt(options.year);
    const month = parseInt(options.month);

    // 計算去年同期
    const lastYear = year - 1;

    // 獲取當期報表
    GR_logDebug(`獲取當期 (${year}年${month}月) 月報表 [${processId}]`, "報表生成", options.userId || "", "GR_generateYoYReport");
    const currentPeriodOptions = {
      year: year,
      month: month,
      userId: options.userId,
      isRecursiveCall: true
    };

    const currentPeriodReport = GR_generateMonthlyReport(currentPeriodOptions);
    if (!currentPeriodReport.success) {
      throw new Error(`獲取當期報表失敗: ${currentPeriodReport.error}`);
    }

    // 獲取去年同期報表
    GR_logDebug(`獲取去年同期 (${lastYear}年${month}月) 月報表 [${processId}]`, "報表生成", options.userId || "", "GR_generateYoYReport");
    const lastYearOptions = {
      year: lastYear,
      month: month,
      userId: options.userId,
      isRecursiveCall: true
    };

    const lastYearReport = GR_generateMonthlyReport(lastYearOptions);
    if (!lastYearReport.success) {
      throw new Error(`獲取去年同期報表失敗: ${lastYearReport.error}`);
    }

    // 計算同比變化
    const currentData = currentPeriodReport.reportData;
    const lastYearData = lastYearReport.reportData;

    // 收入同比變化
    const incomeYoY = {
      current: currentData.summary.totalIncome,
      previous: lastYearData.summary.totalIncome,
      change: currentData.summary.totalIncome - lastYearData.summary.totalIncome,
      changePercentage: lastYearData.summary.totalIncome === 0 ? null : 
        ((currentData.summary.totalIncome - lastYearData.summary.totalIncome) / lastYearData.summary.totalIncome * 100)
    };

    // 支出同比變化
    const expenseYoY = {
      current: currentData.summary.totalExpense,
      previous: lastYearData.summary.totalExpense,
      change: currentData.summary.totalExpense - lastYearData.summary.totalExpense,
      changePercentage: lastYearData.summary.totalExpense === 0 ? null : 
        ((currentData.summary.totalExpense - lastYearData.summary.totalExpense) / lastYearData.summary.totalExpense * 100)
    };

    // 餘額同比變化
    const balanceYoY = {
      current: currentData.summary.balance,
      previous: lastYearData.summary.balance,
      change: currentData.summary.balance - lastYearData.summary.balance,
      changePercentage: lastYearData.summary.balance === 0 ? null : 
        ((currentData.summary.balance - lastYearData.summary.balance) / lastYearData.summary.balance * 100)
    };

    // 類別支出同比變化
    const categoriesYoY = [];
    currentData.categories.forEach(currentCategory => {
      const lastYearCategory = lastYearData.categories.find(c => c.code === currentCategory.code);

      if (lastYearCategory) {
        categoriesYoY.push({
          code: currentCategory.code,
          name: currentCategory.name,
          current: currentCategory.amount,
          previous: lastYearCategory.amount,
          change: currentCategory.amount - lastYearCategory.amount,
          changePercentage: lastYearCategory.amount === 0 ? null : 
            ((currentCategory.amount - lastYearCategory.amount) / lastYearCategory.amount * 100)
        });
      } else {
        categoriesYoY.push({
          code: currentCategory.code,
          name: currentCategory.name,
          current: currentCategory.amount,
          previous: 0,
          change: currentCategory.amount,
          changePercentage: null // 無法計算百分比
        });
      }
    });

    // 創建結果對象
    const result = {
      success: true,
      type: "同比報表",
      year: year,
      month: month,
      lastYear: lastYear,
      income: incomeYoY,
      expense: expenseYoY,
      balance: balanceYoY,
      categories: categoriesYoY
    };

    GR_logInfo(`同比報表生成完成 [${processId}]`, "報表生成", options.userId || "", "GR_generateYoYReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成同比報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), "GR_generateYoYReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "同比報表",
      error: `生成同比報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 21. 生成環比報表數據
 * @param {Object} options 報表選項
 * @param {string} options.year 年份 (YYYY)
 * @param {string} options.month 月份 (MM)
 * @param {string} options.userId 使用者ID (可選)
 * @param {boolean} options.isRecursiveCall 是否是遞迴調用 (內部使用)
 * @returns {Object} 環比報表數據
 */
function GR_generateMoMReport(options = {}) {
  const processId = require('uuid').v4().substring(0, 8);

  // 檢查是否為遞迴調用，若不是，則增加深度計數
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(`mom-${processId}`);
  }

  GR_logInfo(`開始生成環比報表 [${processId}] (遞迴深度: ${GR_requestDepth.depth})`, "報表生成", options.userId || "", "GR_generateMoMReport");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateMoMReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "環比報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.year || !options.month) {
      throw new Error("缺少必要的年份或月份參數");
    }

    const year = parseInt(options.year);
    const month = parseInt(options.month);

    // 計算上個月
    let lastMonth = month - 1;
    let lastMonthYear = year;

    if (lastMonth < 1) {
      lastMonth = 12;
      lastMonthYear = year - 1;
    }

    // 獲取當期報表
    GR_logDebug(`獲取當期 (${year}年${month}月) 月報表 [${processId}]`, "報表生成", options.userId || "", "GR_generateMoMReport");
    const currentPeriodOptions = {
      year: year,
      month: month,
      userId: options.userId,
      isRecursiveCall: true
    };

    const currentPeriodReport = GR_generateMonthlyReport(currentPeriodOptions);
    if (!currentPeriodReport.success) {
      throw new Error(`獲取當期報表失敗: ${currentPeriodReport.error}`);
    }

    // 獲取上個月報表
    GR_logDebug(`獲取上個月 (${lastMonthYear}年${lastMonth}月) 月報表 [${processId}]`, "報表生成", options.userId || "", "GR_generateMoMReport");
    const lastMonthOptions = {
      year: lastMonthYear,
      month: lastMonth,
      userId: options.userId,
      isRecursiveCall: true
    };

    const lastMonthReport = GR_generateMonthlyReport(lastMonthOptions);
    if (!lastMonthReport.success) {
      throw new Error(`獲取上個月報表失敗: ${lastMonthReport.error}`);
    }

    // 計算環比變化
    const currentData = currentPeriodReport.reportData;
    const lastMonthData = lastMonthReport.reportData;

    // 收入環比變化
    const incomeMoM = {
      current: currentData.summary.totalIncome,
      previous: lastMonthData.summary.totalIncome,
      change: currentData.summary.totalIncome - lastMonthData.summary.totalIncome,
      changePercentage: lastMonthData.summary.totalIncome === 0 ? null : 
        ((currentData.summary.totalIncome - lastMonthData.summary.totalIncome) / lastMonthData.summary.totalIncome * 100)
    };

    // 支出環比變化
    const expenseMoM = {
      current: currentData.summary.totalExpense,
      previous: lastMonthData.summary.totalExpense,
      change: currentData.summary.totalExpense - lastMonthData.summary.totalExpense,
      changePercentage: lastMonthData.summary.totalExpense === 0 ? null : 
        ((currentData.summary.totalExpense - lastMonthData.summary.totalExpense) / lastMonthData.summary.totalExpense * 100)
    };

    // 餘額環比變化
    const balanceMoM = {
      current: currentData.summary.balance,
      previous: lastMonthData.summary.balance,
      change: currentData.summary.balance - lastMonthData.summary.balance,
      changePercentage: lastMonthData.summary.balance === 0 ? null : 
        ((currentData.summary.balance - lastMonthData.summary.balance) / lastMonthData.summary.balance * 100)
    };

    // 類別支出環比變化
    const categoriesMoM = [];
    currentData.categories.forEach(currentCategory => {
      const lastMonthCategory = lastMonthData.categories.find(c => c.code === currentCategory.code);

      if (lastMonthCategory) {
        categoriesMoM.push({
          code: currentCategory.code,
          name: currentCategory.name,
          current: currentCategory.amount,
          previous: lastMonthCategory.amount,
          change: currentCategory.amount - lastMonthCategory.amount,
          changePercentage: lastMonthCategory.amount === 0 ? null : 
            ((currentCategory.amount - lastMonthCategory.amount) / lastMonthCategory.amount * 100)
        });
      } else {
        categoriesMoM.push({
          code: currentCategory.code,
          name: currentCategory.name,
          current: currentCategory.amount,
          previous: 0,
          change: currentCategory.amount,
          changePercentage: null // 無法計算百分比
        });
      }
    });

    // 創建結果對象
    const result = {
      success: true,
      type: "環比報表",
      year: year,
      month: month,
      lastMonthYear: lastMonthYear,
      lastMonth: lastMonth,
      income: incomeMoM,
      expense: expenseMoM,
      balance: balanceMoM,
      categories: categoriesMoM
    };

    GR_logInfo(`環比報表生成完成 [${processId}]`, "報表生成", options.userId || "", "GR_generateMoMReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成環比報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), "GR_generateMoMReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "環比報表",
      error: `生成環比報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 22. 生成趨勢報表數據
 * @param {Object} options 報表選項
 * @param {string} options.startDate 開始日期 (YYYY/MM/DD)
 * @param {string} options.endDate 結束日期 (YYYY/MM/DD)
 * @param {string} options.interval 間隔 (daily, weekly, monthly) 默認monthly
 * @param {string} options.userId 使用者ID (可選)
 * @param {boolean} options.isRecursiveCall 是否是遞迴調用 (內部使用)
 * @returns {Object} 趨勢報表數據
 */
function GR_generateTrendReport(options = {}) {
  const processId = require('uuid').v4().substring(0, 8);

  // 檢查是否為遞迴調用，若不是，則增加深度計數
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(`trend-${processId}`);
  }

  GR_logInfo(`開始生成趨勢報表 [${processId}] (遞迴深度: ${GR_requestDepth.depth})`, "報表生成", options.userId || "", "GR_generateTrendReport");

  // 檢查遞迴深度
  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logWarning(`檢測到可能的遞迴循環，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateTrendReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "趨勢報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.startDate || !options.endDate) {
      throw new Error("缺少必要的開始日期或結束日期");
    }

    const interval = options.interval || "monthly";
    GR_logDebug(`報表日期範圍: ${options.startDate} 至 ${options.endDate}, 間隔: ${interval} [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");

    // 解析開始和結束日期
    const startDate = new Date(options.startDate);
    const endDate = new Date(options.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error("無效的日期格式");
    }

    if (startDate > endDate) {
      throw new Error("開始日期不能晚於結束日期");
    }

    // 準備數據點
    const trendData = {
      income: [],
      expense: [],
      balance: [],
      timePoints: []
    };

    // 根據間隔生成時間點和報表
    switch (interval) {
      case "daily":
        GR_logDebug(`生成每日趨勢數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");

        // 限制日報表最多30天，避免過多請求
        const dayDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        if (dayDiff > 30) {
          throw new Error("日趨勢報表最多支援30天範圍");
        }

        // 迭代生成每天的報表
        for (let current = new Date(startDate); current <= endDate; current.setDate(current.getDate() + 1)) {
          const dateStr = `${current.getFullYear()}/${String(current.getMonth() + 1).padStart(2, '0')}/${String(current.getDate()).padStart(2, '0')}`;

          // 獲取日報表
          const dailyOptions = {
            date: dateStr,
            userId: options.userId,
            isRecursiveCall: true
          };

          GR_logDebug(`獲取 ${dateStr} 日報表 [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");
          const dailyReport = GR_generateDailyReport(dailyOptions);

          // 添加數據點
          trendData.timePoints.push(dateStr);

          if (dailyReport.success) {
            trendData.income.push(dailyReport.reportData.summary.totalIncome);
            trendData.expense.push(dailyReport.reportData.summary.totalExpense);
            trendData.balance.push(dailyReport.reportData.summary.balance);
          } else {
            // 如果獲取失敗，填充0
            trendData.income.push(0);
            trendData.expense.push(0);
            trendData.balance.push(0);
          }
        }
        break;

      case "weekly":
        GR_logDebug(`生成每週趨勢數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");

        // 計算開始日期的週一
        const getMonday = (d) => {
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 調整週日
          return new Date(d.setDate(diff));
        };

        let currentWeekStart = getMonday(new Date(startDate));

        // 限制週報表最多12週，避免過多請求
        const weekCount = Math.ceil((endDate - currentWeekStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
        if (weekCount > 12) {
          throw new Error("週趨勢報表最多支援12週範圍");
        }

        // 迭代生成每週的報表
        while (currentWeekStart <= endDate) {
          const weekEndDate = new Date(currentWeekStart);
          weekEndDate.setDate(currentWeekStart.getDate() + 6);

          const startDateStr = `${currentWeekStart.getFullYear()}/${String(currentWeekStart.getMonth() + 1).padStart(2, '0')}/${String(currentWeekStart.getDate()).padStart(2, '0')}`;
          const endDateStr = `${weekEndDate.getFullYear()}/${String(weekEndDate.getMonth() + 1).padStart(2, '0')}/${String(weekEndDate.getDate()).padStart(2, '0')}`;

          // 如果週結束日期超過了報表結束日期，則調整
          const adjustedEndDateStr = weekEndDate > endDate ? 
            `${endDate.getFullYear()}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${String(endDate.getDate()).padStart(2, '0')}` : 
            endDateStr;

          // 獲取週報表
          const weeklyOptions = {
            startDate: startDateStr,
            endDate: adjustedEndDateStr,
            userId: options.userId,
            isRecursiveCall: true
          };

          GR_logDebug(`獲取 ${startDateStr} 至 ${adjustedEndDateStr} 週報表 [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");
          const weeklyReport = GR_generateCustomReport(weeklyOptions);

          // 添加數據點
          trendData.timePoints.push(`${startDateStr} ~ ${adjustedEndDateStr}`);

          if (weeklyReport.success) {
            trendData.income.push(weeklyReport.reportData.summary.totalIncome);
            trendData.expense.push(weeklyReport.reportData.summary.totalExpense);
            trendData.balance.push(weeklyReport.reportData.summary.balance);
          } else {
            // 如果獲取失敗，填充0
            trendData.income.push(0);
            trendData.expense.push(0);
            trendData.balance.push(0);
          }

          // 移動到下一週
          currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }
        break;

      case "monthly":
      default:
        GR_logDebug(`生成每月趨勢數據 [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");

        // 計算起始年月和結束年月
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth() + 1;
        const endYear = endDate.getFullYear();
        const endMonth = endDate.getMonth() + 1;

        // 計算月份數量
        const monthCount = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

        // 限制月報表最多24個月，避免過多請求
        if (monthCount > 24) {
          throw new Error("月趨勢報表最多支援24個月範圍");
        }

        // 迭代生成每月的報表
        for (let y = startYear; y <= endYear; y++) {
          const monthStart = y === startYear ? startMonth : 1;
          const monthEnd = y === endYear ? endMonth : 12;

          for (let m = monthStart; m <= monthEnd; m++) {
            // 獲取月報表
            const monthlyOptions = {
              year: y,
              month: m,
              userId: options.userId,
              isRecursiveCall: true
            };

            GR_logDebug(`獲取 ${y}年${m}月 月報表 [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");
            const monthlyReport = GR_generateMonthlyReport(monthlyOptions);

            // 添加數據點
            trendData.timePoints.push(`${y}/${String(m).padStart(2, '0')}`);

            if (monthlyReport.success) {
              trendData.income.push(monthlyReport.reportData.summary.totalIncome);
              trendData.expense.push(monthlyReport.reportData.summary.totalExpense);
              trendData.balance.push(monthlyReport.reportData.summary.balance);
            } else {
              // 如果獲取失敗，填充0
              trendData.income.push(0);
              trendData.expense.push(0);
              trendData.balance.push(0);
            }
          }
        }
        break;
    }

    // 計算趨勢線 (簡單線性回歸)
    const calculateTrendLine = (data) => {
      const n = data.length;
      if (n <= 1) return { slope: 0, intercept: 0, forecast: [] };

      const x = Array.from({ length: n }, (_, i) => i);

      // 計算平均值
      const meanX = x.reduce((sum, val) => sum + val, 0) / n;
      const meanY = data.reduce((sum, val) => sum + val, 0) / n;

      // 計算斜率和截距
      let numerator = 0;
      let denominator = 0;

      for (let i = 0; i < n; i++) {
        numerator += (x[i] - meanX) * (data[i] - meanY);
        denominator += (x[i] - meanX) * (x[i] - meanX);
      }

      const slope = denominator === 0 ? 0 : numerator / denominator;
      const intercept = meanY - slope * meanX;

      // 計算預測值 (包括未來兩個點)
      const forecast = [];
      for (let i = 0; i < n + 2; i++) {
        forecast.push(slope * i + intercept);
      }

      return { slope, intercept, forecast };
    };

    // 計算各項趨勢線
    const incomeTrend = calculateTrendLine(trendData.income);
    const expenseTrend = calculateTrendLine(trendData.expense);
    const balanceTrend = calculateTrendLine(trendData.balance);

    // 創建結果對象
    const result = {
      success: true,
      type: "趨勢報表",
      interval: interval,
      startDate: options.startDate,
      endDate: options.endDate,
      timePoints: trendData.timePoints,
      income: {
        data: trendData.income,
        trend: incomeTrend.forecast,
        slope: incomeTrend.slope
      },
      expense: {
        data: trendData.expense,
        trend: expenseTrend.forecast,
        slope: expenseTrend.slope
      },
      balance: {
        data: trendData.balance,
        trend: balanceTrend.forecast,
        slope: balanceTrend.slope
      }
    };

    GR_logInfo(`趨勢報表生成完成 [${processId}]`, "報表生成", options.userId || "", "GR_generateTrendReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成趨勢報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), "GR_generateTrendReport");

    // 不是遞迴調用時需要減少深度
    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "趨勢報表",
      error: `生成趨勢報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 23. 驗證日期格式
 * @param {string} startDate 開始日期字符串 (YYYY/MM/DD)
 * @param {string} endDate 結束日期字符串 (YYYY/MM/DD)
 * @returns {Object} 驗證結果，包含isValid和可能的error訊息
 */
function GR_validateDateFormat(startDate, endDate) {
  const processId = require('uuid').v4().substring(0, 8);
  GR_logDebug(`開始驗證日期格式: ${startDate} 至 ${endDate} [${processId}]`, "日期驗證", "", "GR_validateDateFormat");

  try {
    // 檢查日期格式是否符合YYYY/MM/DD
    const dateRegex = /^\d{4}\/\d{2}\/\d{2}$/;
    if (!dateRegex.test(startDate)) {
      GR_logWarning(`開始日期格式錯誤: ${startDate} [${processId}]`, "日期驗證", "", "GR_validateDateFormat");
      return { isValid: false, error: `開始日期格式錯誤: ${startDate}，應為YYYY/MM/DD` };
    }
    if (!dateRegex.test(endDate)) {
      GR_logWarning(`結束日期格式錯誤: ${endDate} [${processId}]`, "日期驗證", "", "GR_validateDateFormat");
      return { isValid: false, error: `結束日期格式錯誤: ${endDate}，應為YYYY/MM/DD` };
    }

    // 將字符串轉換為Date對象並檢查有效性
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime())) {
      GR_logWarning(`無效的開始日期: ${startDate} [${processId}]`, "日期驗證", "", "GR_validateDateFormat");
      return { isValid: false, error: `無效的開始日期: ${startDate}` };
    }

    if (isNaN(endDateObj.getTime())) {
      GR_logWarning(`無效的結束日期: ${endDate} [${processId}]`, "日期驗證", "", "GR_validateDateFormat");
      return { isValid: false, error: `無效的結束日期: ${endDate}` };
    }

    // 確保開始日期不晚於結束日期
    if (startDateObj > endDateObj) {
      GR_logWarning(`開始日期晚於結束日期: ${startDate} > ${endDate} [${processId}]`, "日期驗證", "", "GR_validateDateFormat");
      return { isValid: false, error: `開始日期 ${startDate} 不能晚於結束日期 ${endDate}` };
    }

    GR_logDebug(`日期格式驗證成功: ${startDate} 至 ${endDate} [${processId}]`, "日期驗證", "", "GR_validateDateFormat");
    return { isValid: true };
  } catch (error) {
    GR_logError(`日期驗證出錯: ${error.message} [${processId}]`, "日期驗證", "", "FORMAT_ERROR", error.toString(), "GR_validateDateFormat");
    return { isValid: false, error: `日期驗證錯誤: ${error.message}` };
  }
}

/**
 * 24. 計算兩個日期之間的天數差異
 * @param {string} startDate 開始日期 (YYYY/MM/DD)
 * @param {string} endDate 結束日期 (YYYY/MM/DD)
 * @returns {number} 天數差異，包含頭尾兩天
 */
function GR_calculateDateDifference(startDate, endDate) {
  const processId = require('uuid').v4().substring(0, 8);
  GR_logDebug(`開始計算日期差異: ${startDate} 至 ${endDate} [${processId}]`, "日期計算", "", "GR_calculateDateDifference");

  try {
    // 將日期字符串轉換為Date對象
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    // 確保日期有效
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      GR_logWarning(`計算日期差異時遇到無效日期: ${startDate} 至 ${endDate} [${processId}]`, "日期計算", "", "GR_calculateDateDifference");
      return 0;
    }

    // 計算日期差異（毫秒）
    const diffTime = Math.abs(endDateObj - startDateObj);
    // 將毫秒轉換為天數，加1是為了包含頭尾兩天
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    GR_logDebug(`日期差異計算結果: ${diffDays}天 (${startDate} 至 ${endDate}) [${processId}]`, "日期計算", "", "GR_calculateDateDifference");
    return diffDays;
  } catch (error) {
    GR_logError(`計算日期差異失敗: ${error.message} [${processId}]`, "日期計算", "", "CALC_ERROR", error.toString(), "GR_calculateDateDifference");
    return 0; // 發生錯誤時返回0
  }
}