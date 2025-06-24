/**
 * DL_診斷與日誌模組_3_0_0
 * 提供統一的日誌記錄和系統診斷功能
 * @update: V3.0.0 - 從 GAS 轉換為 Node.js/Firebase
 * @author: AustinLiao69
 * @lastUpdate: 2025-06-19
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const { zhTW } = require('date-fns/locale');

// 1. 配置參數
const DL_CONFIG = {
  // 1.1 日誌記錄基本設置
  enableConsoleLog: true,          // 是否啟用控制台日誌
  enableFirestoreLog: true,        // 是否啟用 Firestore 日誌
  consoleLogLevel: 0,              // 控制台日誌級別 (0=DEBUG, 1=INFO, 2=WARNING, 3=ERROR)
  firestoreLogLevel: 0,            // Firestore 日誌級別

  // 1.2 日誌存儲位置
  collectionName: process.env.LOG_COLLECTION_NAME || 'logs',  // 從環境變數獲取日誌集合名稱
  timezone: "Asia/Taipei",         // 時區設置

  // 1.3 緩衝區設置
  logBufferSize: 50,               // 緩衝區大小 (多少條日誌批量寫入一次)
  bufferFlushInterval: 60000,      // 緩衝區刷新間隔 (毫秒)
  logBuffer: [],                   // 日誌緩衝區
  lastBufferFlush: 0,              // 上次緩衝區刷新時間

  // 1.4 過濾設置
  enabledModules: ["ALL"],         // 啟用的模組列表 (ALL 表示全部)
  disabledModules: [],             // 禁用的模組列表
  enabledFunctions: ["ALL"],       // 啟用的函數列表
  disabledFunctions: [],           // 禁用的函數列表

  // 1.5 模式設置
  mode: "NORMAL",                  // 日誌模式: NORMAL, EMERGENCY
  emergencyReason: "",             // 緊急模式原因
};

// 2. 嚴重等級定義
const DL_SEVERITY_LEVELS = {
  "DEBUG": 0,
  "INFO": 1,
  "WARNING": 2,
  "ERROR": 3,
  "CRITICAL": 4
};

// 3. 常量定義
const DL_MAX_LOGS_PER_COLLECTION = 50000;  // 每個日誌集合的最大文檔數

/**
 * 獲取配置屬性 - 模擬 GAS 的 getScriptProperty 函數
 * @param {string} key - 屬性鍵名
 * @returns {string} - 屬性值
 */
function getScriptProperty(key) {
  return process.env[key] || null;
}

/**
 * 3.1 初始化日誌模組
 * @returns {Promise<boolean>} - 初始化是否成功
 */
async function DL_initialize() {
  try {
    // 3.1.0 首先從 Firestore 中恢復模式設置
    try {
      const settingsRef = admin.firestore().collection('settings').doc('logger');
      const settingsDoc = await settingsRef.get();

      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        if (data.mode) {
          DL_CONFIG.mode = data.mode;
          DL_CONFIG.emergencyReason = data.reason || "";
          console.log(`DL模組從 Firestore 恢復模式設置: ${data.mode}`);
        }
      }
    } catch (e) {
      console.warn(`無法從 Firestore 恢復模式設置: ${e.toString()}`);
    }

    // 3.1.1 檢查是否已有日誌集合
    const logSnapshot = await admin.firestore().collection(DL_CONFIG.collectionName).limit(1).get();

    // 3.1.2 如果日誌集合不存在，則創建第一條初始化日誌
    if (logSnapshot.empty) {
      console.log(`DL_initialize: 創建日誌集合 ${DL_CONFIG.collectionName}`);

      // 3.1.3 創建初始化日誌
      await admin.firestore().collection(DL_CONFIG.collectionName).add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        message: "日誌模組初始化",
        operation: "系統初始化",
        userId: "",
        errorCode: "",
        source: "DL",
        details: "",
        retryCount: 0,
        location: "DL_initialize",
        severity: "INFO",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 3.6 初始化緩衝區
    DL_CONFIG.logBuffer = [];
    DL_CONFIG.lastBufferFlush = Date.now();

    // 3.7 記錄初始化成功
    console.log("DL模組初始化成功");
    return true;

  } catch (error) {
    console.error(`DL_initialize錯誤: ${error.toString()}`);
    return false;
  }
}

/**
 * 3.8 檢查緩衝區是否需要刷新
 * @returns {Promise<void>}
 */
async function DL_checkAndFlushBuffer() {
  const currentTime = Date.now();

  // 滿足以下條件之一時刷新緩衝區:
  // 1. 緩衝區大小達到配置的閾值
  // 2. 距離上次刷新超過配置的時間間隔
  if (DL_CONFIG.logBuffer.length >= DL_CONFIG.logBufferSize || 
      (currentTime - DL_CONFIG.lastBufferFlush) >= DL_CONFIG.bufferFlushInterval) {
    await DL_flushLogBuffer();
  }
}

/**
 * 3.9 強制刷新日誌緩衝區
 * @returns {Promise<void>}
 */
async function DL_flushLogBuffer() {
  if (DL_CONFIG.logBuffer.length === 0) return;

  try {
    const batch = admin.firestore().batch();
    const logsCollection = admin.firestore().collection(DL_CONFIG.collectionName);

    // 批量寫入日誌
    for (const logData of DL_CONFIG.logBuffer) {
      const docRef = logsCollection.doc();
      batch.set(docRef, {
        timestamp: new Date(logData[0]),        // 1. 時間戳記
        message: logData[1] || '',              // 2. 訊息
        operation: logData[2] || '',            // 3. 操作類型
        userId: logData[3] || '',               // 4. 使用者ID
        errorCode: logData[4] || '',            // 5. 錯誤代碼
        source: logData[5] || '',               // 6. 來源
        details: logData[6] || '',              // 7. 錯誤詳情
        retryCount: logData[7] || 0,            // 8. 重試次數
        location: logData[8] || '',             // 9. 程式碼位置
        severity: logData[9] || 'INFO',         // 10. 嚴重等級
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    // 清空緩衝區並更新最後刷新時間
    DL_CONFIG.logBuffer = [];
    DL_CONFIG.lastBufferFlush = Date.now();

  } catch (error) {
    console.error(`DL_flushLogBuffer錯誤: ${error.toString()}`);
    // 發生錯誤時，清空緩衝區避免累積過多日誌
    DL_CONFIG.logBuffer = [];
    DL_CONFIG.lastBufferFlush = Date.now();
  }
}

/**
 * 3.10 輪換日誌集合（當日誌數量超過限制時）
 * @returns {Promise<boolean>}
 */
async function DL_rotateLogCollection() {
  try {
    // 獲取當前時間戳以創建新集合名
    const timestamp = new Date();
    const archiveCollectionName = `${DL_CONFIG.collectionName}_${timestamp.getFullYear()}${(timestamp.getMonth()+1).toString().padStart(2, '0')}${timestamp.getDate().toString().padStart(2, '0')}`;

    // 在 Firestore 創建新的存檔集合
    await admin.firestore().collection(archiveCollectionName).add({
      message: "日誌集合輪換初始化",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: "DL",
      severity: "INFO"
    });

    console.log(`DL_rotateLogCollection: 日誌集合輪換完成，新集合名稱: ${archiveCollectionName}`);
    return true;

  } catch (error) {
    console.error(`DL_rotateLogCollection錯誤: ${error.toString()}`);
    return false;
  }
}

/**
 * 3.11 設置緊急模式 - 增加持久化存儲
 * @param {boolean} enabled - 是否啟用緊急模式
 * @param {string} reason - 啟用緊急模式的原因
 * @returns {Promise<void>}
 */
async function DL_toggleMode(enabled, reason = "") {
  const prevMode = DL_CONFIG.mode;

  if (enabled) {
    DL_CONFIG.mode = "EMERGENCY";
    DL_CONFIG.emergencyReason = reason || "未指定原因";

    // 持久化存儲模式設置到 Firestore
    try {
      await admin.firestore().collection('settings').doc('logger').set({
        mode: "EMERGENCY",
        reason: DL_CONFIG.emergencyReason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error(`無法保存緊急模式設置: ${e.toString()}`);
    }

    if (prevMode !== "EMERGENCY") {
      await DL_warning(`已切換到緊急模式 - ${DL_CONFIG.emergencyReason}`, "模式切換");
    }
  } else {
    DL_CONFIG.mode = "NORMAL";
    DL_CONFIG.emergencyReason = "";

    // 持久化存儲模式設置到 Firestore
    try {
      await admin.firestore().collection('settings').doc('logger').set({
        mode: "NORMAL",
        reason: "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error(`無法保存正常模式設置: ${e.toString()}`);
    }

    if (prevMode !== "NORMAL") {
      await DL_info("已恢復到正常模式", "模式切換");
    }
  }
}

/**
 * 3.12 開啟普通模式
 * 過濾非必要日誌，只記錄符合條件的日誌
 * @returns {Promise<boolean>} - 切換成功返回true
 */
async function DL_enableNormalMode() {
  try {
    await DL_toggleMode(false);
    console.log("[DL] 已切換到普通模式");
    return true;
  } catch (error) {
    console.error(`[DL] 切換到普通模式失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 3.13 開啟緊急模式
 * 記錄所有日誌，不進行過濾
 * @param {string} reason - 緊急模式原因，例如"系統故障排查"或"BK模組測試"
 * @returns {Promise<boolean>} - 切換成功返回true
 */
async function DL_enableEmergencyMode(reason = "未指定原因") {
  try {
    await DL_toggleMode(true, reason);
    console.log(`[DL] 已切換到緊急模式 - ${reason}`);
    return true;
  } catch (error) {
    console.error(`[DL] 切換到緊急模式失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 3.14 強制重置緊急模式 - 新增函數，用於緊急情況下強制切換到正常模式
 * @returns {Promise<boolean>} - 重置成功返回true
 */
async function DL_resetEmergencyMode() {
  try {
    // 直接設置配置
    DL_CONFIG.mode = "NORMAL";
    DL_CONFIG.emergencyReason = "";

    // 強制持久化存儲到 Firestore
    await admin.firestore().collection('settings').doc('logger').set({
      mode: "NORMAL",
      reason: "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      resetBy: "DL_resetEmergencyMode"
    });

    // 記錄重置操作
    await DL_info("已強制重置緊急模式到正常模式", "模式重置");
    console.log("[DL] 已強制重置緊急模式到正常模式");
    return true;
  } catch (error) {
    console.error(`[DL] 強制重置緊急模式失敗: ${error.toString()}`);
    return false;
  }
}

/**
 * 3.15 設置日誌級別
 * @param {string} consoleLevel - 控制台日誌級別 (DEBUG/INFO/WARNING/ERROR)
 * @param {string} firestoreLevel - Firestore 日誌級別 (DEBUG/INFO/WARNING/ERROR)
 */
function DL_setLogLevels(consoleLevel, firestoreLevel) {
  if (consoleLevel && DL_SEVERITY_LEVELS.hasOwnProperty(consoleLevel.toUpperCase())) {
    DL_CONFIG.consoleLogLevel = DL_SEVERITY_LEVELS[consoleLevel.toUpperCase()];
  }

  if (firestoreLevel && DL_SEVERITY_LEVELS.hasOwnProperty(firestoreLevel.toUpperCase())) {
    DL_CONFIG.firestoreLogLevel = DL_SEVERITY_LEVELS[firestoreLevel.toUpperCase()];
  }
}

/**
 * 4. 記錄日誌的統一函數 - 修正來源欄位問題
 * @param {Object} logData - 日誌數據對象
 * @returns {Promise<boolean>} - 日誌記錄是否成功
 */
async function DL_log(logData) {
  // 4.1 檢查必要參數
  if (!logData.message) {
    console.error('DL_log錯誤: 缺少必要參數 message');
    return false;
  }

  if (!logData.operation) {
    console.error('DL_log錯誤: 缺少必要參數 operation');
    return false;
  }

  // 修改這部分：尊重傳入的source參數
  if (!logData.source) {
    // 只有在未提供source時才嘗試自動檢測
    logData.source = DL_detectCallerModule();
  }

  if (!logData.severity) {
    logData.severity = 'INFO';
  }

  // 4.2 標準化嚴重等級
  logData.severity = logData.severity.toUpperCase();
  if (!Object.keys(DL_SEVERITY_LEVELS).includes(logData.severity)) {
    console.error(`DL_log錯誤: 無效的嚴重等級 ${logData.severity}`);
    logData.severity = 'INFO';
  }

  // 4.3 獲取當前時間戳
  const timestamp = new Date();

  // 4.4 自動獲取位置（如果未提供）- 修改為優先使用函數名
  if (!logData.location) {
    try {
      throw new Error();
    } catch (e) {
      const stackLines = e.stack.split('\n');
      if (stackLines.length >= 3) {
        // 嘗試從堆疊中提取函數名稱而非檔案名稱
        const callerLine = stackLines[2].trim();
        // 正則表達式匹配 "at 函數名稱"
        const match = callerLine.match(/at\s+([^(\s]+)/);
        if (match && match[1]) {
          logData.location = match[1]; // 僅使用函數名稱作為位置
        } else {
          // 備用方案：使用原始函數名稱提取機制
          const fullMatch = callerLine.match(/at (.+) \((.+)\)/);
          if (fullMatch) {
            logData.location = fullMatch[1]; // 提取函數名稱
          }
        }
      }
    }
  }

  // 4.5 檢查模組和函數過濾
  const source = logData.source;
  const func = logData.function || '';

  // 只有在普通模式下才應用過濾
  if (DL_CONFIG.mode === 'NORMAL') {
    // 模組過濾
    if (
      DL_CONFIG.enabledModules.indexOf('ALL') === -1 && 
      DL_CONFIG.enabledModules.indexOf(source) === -1
    ) {
      return false; // 該模組未啟用，不記錄日誌
    }

    if (DL_CONFIG.disabledModules.indexOf(source) !== -1) {
      return false; // 該模組已禁用，不記錄日誌
    }

    // 函數過濾
    if (
      func &&
      DL_CONFIG.enabledFunctions.indexOf('ALL') === -1 && 
      DL_CONFIG.enabledFunctions.indexOf(func) === -1
    ) {
      return false; // 該函數未啟用，不記錄日誌
    }

    if (func && DL_CONFIG.disabledFunctions.indexOf(func) !== -1) {
      return false; // 該函數已禁用，不記錄日誌
    }
  }

  // 4.6 獲取嚴重等級數值
  const severityLevel = DL_SEVERITY_LEVELS[logData.severity];

  // 4.7 控制台日誌
  if (DL_CONFIG.enableConsoleLog && severityLevel >= DL_CONFIG.consoleLogLevel) {
    let consoleMessage = `[${timestamp.toISOString()}] [${logData.severity}] [${logData.source}] ${logData.message}`;

    if (logData.userId) {
      consoleMessage += ` [User: ${logData.userId}]`;
    }

    if (logData.errorCode) {
      consoleMessage += ` [Code: ${logData.errorCode}]`;
    }

    if (logData.location) {
      consoleMessage += ` [Location: ${logData.location}]`;
    }

    // 根據嚴重等級使用不同的日誌函數
    switch (logData.severity) {
      case 'DEBUG':
        console.log(consoleMessage);
        break;
      case 'INFO':
        console.info(consoleMessage);
        break;
      case 'WARNING':
        console.warn(consoleMessage);
        break;
      case 'ERROR':
      case 'CRITICAL':
        console.error(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }
  }

  // 4.8 Firestore 日誌
  if (DL_CONFIG.enableFirestoreLog && severityLevel >= DL_CONFIG.firestoreLogLevel) {
    try {
      // 4.8.1 格式化時間戳
      const formattedTimestamp = format(timestamp, 'yyyy-MM-dd HH:mm:ss', { locale: zhTW });

      // 4.8.2 準備日誌數據行 - 確保使用正確的source欄位
      const logRow = [
        formattedTimestamp,            // 1. 時間戳記
        logData.message || '',         // 2. 訊息
        logData.operation || '',       // 3. 操作類型
        logData.userId || '',          // 4. 使用者ID
        logData.errorCode || '',       // 5. 錯誤代碼
        logData.source || '',          // 6. 來源
        logData.details || '',         // 7. 錯誤詳情
        logData.retryCount || 0,       // 8. 重試次數
        logData.location || '',        // 9. 程式碼位置
        logData.severity || 'INFO'     // 10. 嚴重等級
      ];

      // 4.8.3 將日誌添加到緩衝區
      DL_CONFIG.logBuffer.push(logRow);

      // 4.8.4 檢查緩衝區是否需要刷新
      await DL_checkAndFlushBuffer();

      return true;
    } catch (error) {
      console.error(`DL_log錯誤: 添加日誌到緩衝區失敗: ${error.toString()}`);
      return false;
    }
  }

  return true;
}

/**
 * 5. 檢測調用當前函數的模組名稱 - 改進版本
 * @returns {string} - 模組名稱或'DL'
 */
function DL_detectCallerModule() {
  try {
    throw new Error();
  } catch (e) {
    const stackLines = e.stack.split('\n');
    if (stackLines.length >= 3) {
      // 嘗試從堆疊中提取調用者
      const callerLine = stackLines[2].trim();

      // 優先嘗試匹配函數名前綴 (如 BK_, DD_, WH_ 等)
      const modulePrefixMatch = callerLine.match(/at\s+([A-Z]{2})_/);
      if (modulePrefixMatch && modulePrefixMatch[1]) {
        return modulePrefixMatch[1]; // 返回模組前綴
      }

      // 次優先：檢查函數名
      if (callerLine.includes("BK_")) return "BK";
      if (callerLine.includes("DD_")) return "DD";
      if (callerLine.includes("WH_")) return "WH";

      // 檢查函數所在文件
      const fileMatch = callerLine.match(/\((.+?):\d+/);
      if (fileMatch && fileMatch[1]) {
        const filePath = fileMatch[1];
        if (filePath.includes("BK")) return "BK";
        if (filePath.includes("DD")) return "DD";
        if (filePath.includes("WH")) return "WH";
      }
    }
    return 'DL'; // 默認返回DL
  }
}

/**
 * 6. 輔助函數 - 將日誌直接寫入 Firestore（緊急情況下使用，繞過緩衝區）
 * @param {Object} logData - 日誌數據
 * @param {Date} timestamp - 時間戳
 * @returns {Promise<boolean>} - 操作是否成功
 */
async function DL_writeToFirestore(logData, timestamp) {
  try {
    const formattedTimestamp = timestamp ? format(timestamp, 'yyyy-MM-dd HH:mm:ss', { locale: zhTW }) : 
                                          format(new Date(), 'yyyy-MM-dd HH:mm:ss', { locale: zhTW });

    // 直接寫入 Firestore
    await admin.firestore().collection(DL_CONFIG.collectionName).add({
      timestamp: formattedTimestamp,
      message: logData.message || '',
      operation: logData.operation || '',
      userId: logData.userId || '',
      errorCode: logData.errorCode || '',
      source: logData.source || '',
      details: logData.details || '',
      retryCount: logData.retryCount || 0,
      location: logData.location || '',
      severity: logData.severity || 'INFO',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error(`DL_writeToFirestore錯誤: ${error.toString()}`);
    return false;
  }
}

/**
 * 7. 創建各種級別的日誌記錄函數
 */

// 7.1 DEBUG級別日誌
async function DL_debug(message, operation, userId, errorCode, details, retryCount, location, functionName) {
  // 從函數名提取模組名稱
  let source = "DL";
  if (functionName && functionName.match(/^[A-Z]{2}_/)) {
    source = functionName.substring(0, 2);
  }

  return await DL_log({
    message: message,
    operation: operation,
    userId: userId,
    errorCode: errorCode,
    details: details,
    retryCount: retryCount,
    location: location,
    function: functionName,
    severity: "DEBUG",
    source: source
  });
}

// 7.2 INFO級別日誌
async function DL_info(message, operation, userId, errorCode, details, retryCount, location, functionName) {
  // 從函數名提取模組名稱
  let source = "DL";
  if (functionName && functionName.match(/^[A-Z]{2}_/)) {
    source = functionName.substring(0, 2);
  }

  return await DL_log({
    message: message,
    operation: operation,
    userId: userId,
    errorCode: errorCode,
    details: details,
    retryCount: retryCount,
    location: location,
    function: functionName,
    severity: "INFO",
    source: source
  });
}

// 7.3 WARNING級別日誌
async function DL_warning(message, operation, userId, errorCode, details, retryCount, location, functionName) {
  // 從函數名提取模組名稱
  let source = "DL";
  if (functionName && functionName.match(/^[A-Z]{2}_/)) {
    source = functionName.substring(0, 2);
  }

  return await DL_log({
    message: message,
    operation: operation,
    userId: userId,
    errorCode: errorCode,
    details: details,
    retryCount: retryCount,
    location: location,
    function: functionName,
    severity: "WARNING",
    source: source
  });
}

// 7.4 ERROR級別日誌
async function DL_error(message, operation, userId, errorCode, details, retryCount, location, functionName) {
  // 從函數名提取模組名稱
  let source = "DL";
  if (functionName && functionName.match(/^[A-Z]{2}_/)) {
    source = functionName.substring(0, 2);
  }

  return await DL_log({
    message: message,
    operation: operation,
    userId: userId,
    errorCode: errorCode,
    details: details,
    retryCount: retryCount,
    location: location,
    function: functionName,
    severity: "ERROR",
    source: source
  });
}

// 7.5 CRITICAL級別日誌
async function DL_critical(message, operation, userId, errorCode, details, retryCount, location, functionName) {
  // 從函數名提取模組名稱
  let source = "DL";
  if (functionName && functionName.match(/^[A-Z]{2}_/)) {
    source = functionName.substring(0, 2);
  }

  return await DL_log({
    message: message,
    operation: operation,
    userId: userId,
    errorCode: errorCode,
    details: details,
    retryCount: retryCount,
    location: location,
    function: functionName,
    severity: "CRITICAL",
    source: source
  });
}

/**
 * 8. 系統診斷功能
 * @returns {Promise<Object>} - 診斷結果對象
 */
async function DL_diagnose() {
  try {
    const diagnoseStartTime = new Date();
    const diagnoseId = uuidv4().substring(0, 8);

    await DL_info(`開始系統診斷 [${diagnoseId}]`, "系統診斷", "", "", "", 0, "DL_diagnose");

    // 8.1 檢查DL模組配置
    const dlConfigStatus = {
      enableConsoleLog: DL_CONFIG.enableConsoleLog,
      enableFirestoreLog: DL_CONFIG.enableFirestoreLog,
      consoleLogLevel: DL_CONFIG.consoleLogLevel,
      firestoreLogLevel: DL_CONFIG.firestoreLogLevel,
      mode: DL_CONFIG.mode,
      bufferSize: DL_CONFIG.logBuffer.length,
      lastFlushTime: new Date(DL_CONFIG.lastBufferFlush).toISOString()
    };

    // 8.2 檢查 Firestore 連接
    let firestoreStatus = "未檢查";
    let logCollectionStatus = "未檢查";

    try {
      // 嘗試連接 Firestore
      const testDoc = await admin.firestore().collection('test').doc('connectivity').set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        message: "連接測試"
      });
      firestoreStatus = "連接成功";

      // 檢查日誌集合
      const logQuery = await admin.firestore().collection(DL_CONFIG.collectionName).limit(1).get();
      logCollectionStatus = logQuery.empty ? "集合為空" : "集合存在";

      // 8.3 分析最近日誌
      const recentLogs = [];

      // 獲取最近50條日誌
      const logsSnapshot = await admin.firestore()
        .collection(DL_CONFIG.collectionName)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      logsSnapshot.forEach(doc => {
        recentLogs.push(doc.data());
      });

      // 8.4 統計嚴重程度分布
      const severityCounts = {
        DEBUG: 0,
        INFO: 0,
        WARNING: 0,
        ERROR: 0,
        CRITICAL: 0
      };

      // 8.5 統計模組錯誤數量
      const moduleErrors = {};

      // 8.6 統計常見錯誤
      const commonErrors = {};

      // 分析日誌
      recentLogs.forEach(log => {
        const severity = log.severity;
        const module = log.source;
        const message = log.message;

        // 更新嚴重程度計數
        if (severityCounts.hasOwnProperty(severity)) {
          severityCounts[severity]++;
        }

        // 統計每個模組的錯誤數
        if (severity === 'ERROR' || severity === 'CRITICAL') {
          moduleErrors[module] = (moduleErrors[module] || 0) + 1;

          // 統計常見錯誤
          commonErrors[message] = (commonErrors[message] || 0) + 1;
        }
      });

      // 8.7 獲取診斷完成時間和持續時間
      const diagnoseEndTime = new Date();
      const diagnoseDuration = diagnoseEndTime.getTime() - diagnoseStartTime.getTime();

      await DL_info(`系統診斷完成 [${diagnoseId}] 耗時: ${diagnoseDuration}ms`, "系統診斷", "", "", "", 0, "DL_diagnose");

      // 8.8 返回診斷結果
      return {
        success: true,
        diagnoseId: diagnoseId,
        timestamp: diagnoseEndTime.toISOString(),
        duration: diagnoseDuration,
        config: dlConfigStatus,
        firestore: firestoreStatus,
        logCollection: logCollectionStatus,
        recentLogs: {
          count: recentLogs.length,
          severityCounts: severityCounts,
          moduleErrors: moduleErrors,
          commonErrors: commonErrors
        }
      };
    } catch (error) {
      firestoreStatus = `連接錯誤: ${error.toString()}`;
    }

    return {
      success: false,
      diagnoseId: diagnoseId,
      timestamp: new Date().toISOString(),
      config: dlConfigStatus,
      firestore: firestoreStatus,
      logCollection: logCollectionStatus,
      error: "診斷過程中斷"
    };

  } catch (error) {
    await DL_error(`診斷過程失敗: ${error.toString()}`, "系統診斷", "", "DIAGNOSE_ERROR", error.toString(), 0, "DL_diagnose");

    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: `診斷過程失敗: ${error.toString()}`
    };
  }
}

/**
 * 9. 獲取當前模式狀態 - 新增函數，方便診斷使用
 * @returns {Promise<Object>} - 模式狀態信息
 */
async function DL_getModeStatus() {
  try {
    // 從 Firestore 讀取持久化存儲的模式
    const settingsDoc = await admin.firestore().collection('settings').doc('logger').get();
    const storedMode = settingsDoc.exists ? settingsDoc.data().mode : "未設置";
    const storedReason = settingsDoc.exists ? settingsDoc.data().reason : "";

    return {
      success: true,
      currentMode: DL_CONFIG.mode,
      storedMode: storedMode,
      currentReason: DL_CONFIG.emergencyReason,
      storedReason: storedReason,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: `獲取模式狀態失敗: ${error.toString()}`,
      currentMode: DL_CONFIG.mode,
      timestamp: new Date().toISOString()
    };
  }
}

// 導出所有函數
module.exports = {
  DL_initialize,
  DL_log,
  DL_debug,
  DL_info,
  DL_warning,
  DL_error,
  DL_critical,
  DL_enableNormalMode,
  DL_enableEmergencyMode,
  DL_resetEmergencyMode,
  DL_setLogLevels,
  DL_diagnose,
  DL_getModeStatus,
  DL_SEVERITY_LEVELS
};
