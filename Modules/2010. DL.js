/**
 * DL_診斷與日誌模組_3.0.5
 * 提供統一的日誌記錄和系統診斷功能
 * @update: V3.0.5 - 直接使用serviceaccountkey.json初始化Firebase，移除FB_Serviceaccountkey.js依賴
 * @author: AustinLiao69
 * @lastUpdate: 2025-07-08
 */

// 直接使用 Firebase Admin SDK 和 serviceaccountkey.json
const admin = require('firebase-admin');
const serviceAccount = require('./Serviceaccountkey.json');

// 初始化 Firebase Admin（防重複初始化）
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
}

// 取得 Firestore 實例
const db = admin.firestore();
const { v4: uuidv4 } = require("uuid");
const moment = require("moment-timezone");

// 1. 配置參數
const DL_CONFIG = {
  // 1.1 日誌記錄基本設置
  enableConsoleLog: true, // 是否啟用控制台日誌
  enableFirestoreLog: true, // 是否啟用Firestore日誌
  consoleLogLevel: 0, // 控制台日誌級別 (0=DEBUG, 1=INFO, 2=WARNING, 3=ERROR)
  firestoreLogLevel: 0, // Firestore日誌級別

  // 1.2 日誌存儲位置
  logCollection: "log", // Firestore日誌集合名稱
  timezone: "Asia/Taipei", // 時區設置

  // 1.3 緩衝區設置
  logBufferSize: 10, // 緩衝區大小 (減少到10條，更快寫入)
  bufferFlushInterval: 30000, // 緩衝區刷新間隔 (30秒)
  logBuffer: [], // 日誌緩衝區
  lastBufferFlush: 0, // 上次緩衝區刷新時間

  // 1.4 過濾設置
  enabledModules: ["ALL"], // 啟用的模組列表 (ALL 表示全部)
  disabledModules: [], // 禁用的模組列表
  enabledFunctions: ["ALL"], // 啟用的函數列表
  disabledFunctions: [], // 禁用的函數列表

  // 1.5 模式設置
  mode: "NORMAL", // 日誌模式: NORMAL, EMERGENCY
  emergencyReason: "", // 緊急模式原因

  // 1.6 Firestore 連接狀態
  firestoreInitialized: false, // Firestore 初始化狀態
};

// 2. 嚴重等級定義
const DL_SEVERITY_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
};

// 3. 常量定義
const DL_MAX_LOGS_PER_SHEET = 10000; // 每個日誌表的最大行數

/**
 * 獲取配置屬性 - 模擬 GAS 的 getScriptProperty 函數
 */
function getScriptProperty(key) {
  return process.env[key] || null;
}

/**
 * 初始化Firestore連接
 */
function DL_initializeFirestore() {
  try {
    if (DL_CONFIG.firestoreInitialized) return true;

    // 檢查Firebase Admin是否已初始化
    if (!admin.apps.length) {
      throw new Error("Firebase Admin未初始化，請檢查FB_Serviceaccountkey.js");
    }

    // 測試Firestore連接
    if (!db) {
      throw new Error("Firestore資料庫實例未找到");
    }

    DL_CONFIG.firestoreInitialized = true;
    return true;
  } catch (error) {
    console.error("Firestore連接初始化失敗:", error);
    throw error;
  }
}

/**
 * 3.1 初始化日誌模組
 */
async function DL_initialize() {
  try {
    // 從本地設置中恢復模式設置（如果有的話）
    try {
      const storedMode = process.env.DL_MODE || "NORMAL";
      const storedReason = process.env.DL_EMERGENCY_REASON || "";
      if (storedMode) {
        DL_CONFIG.mode = storedMode;
        DL_CONFIG.emergencyReason = storedReason;
        console.log(`DL模組從環境變數恢復模式設置: ${storedMode}`);
      }
    } catch (e) {
      console.warn(`無法從環境變數恢復模式設置: ${e.toString()}`);
    }

    console.log("DL模組初始化開始 - Firestore版本");

    // 初始化Firestore連接
    DL_initializeFirestore();

    // 測試Firestore連接並創建初始化日誌
    try {
      await db.collection(DL_CONFIG.logCollection).add({
        時間: admin.firestore.Timestamp.now(),
        訊息: "日誌模組初始化",
        操作類型: "系統初始化",
        UID: "",
        錯誤代碼: "",
        來源: "DL",
        錯誤詳情: "",
        重試次數: 0,
        程式碼位置: "DL_initialize",
        嚴重等級: "INFO",
      });

      console.log("已創建初始化記錄到Firestore log集合");
    } catch (firestoreError) {
      console.error(`無法寫入Firestore log集合:`, firestoreError);
      return false;
    }

    // 初始化緩衝區
    DL_CONFIG.logBuffer = [];
    DL_CONFIG.lastBufferFlush = Date.now();

    console.log("DL模組初始化成功 - Firestore版本");
    return true;
  } catch (error) {
    console.error(`DL_initialize錯誤: ${error.toString()}`);
    return false;
  }
}

/**
 * 3.8 檢查緩衝區是否需要刷新
 */
async function DL_checkAndFlushBuffer() {
  const currentTime = Date.now();

  if (
    DL_CONFIG.logBuffer.length >= DL_CONFIG.logBufferSize ||
    currentTime - DL_CONFIG.lastBufferFlush >= DL_CONFIG.bufferFlushInterval
  ) {
    await DL_flushLogBuffer();
  }
}

/**
 * 3.9 強制刷新日誌緩衝區到Firestore
 */
async function DL_flushLogBuffer() {
  if (DL_CONFIG.logBuffer.length === 0) return;

  try {
    // 使用Firestore batch write批次寫入
    const batch = db.batch();

    DL_CONFIG.logBuffer.forEach((logData) => {
      const docRef = db.collection(DL_CONFIG.logCollection).doc();
      batch.set(docRef, {
        時間: admin.firestore.Timestamp.fromDate(new Date(logData[0])), // 時間戳記
        訊息: logData[1], // 訊息
        操作類型: logData[2], // 操作類型
        UID: logData[3], // 使用者ID
        錯誤代碼: logData[4], // 錯誤代碼
        來源: logData[5], // 來源
        錯誤詳情: logData[6], // 錯誤詳情
        重試次數: logData[7], // 重試次數
        程式碼位置: logData[8], // 程式碼位置
        嚴重等級: logData[9], // 嚴重等級
      });
    });

    // 執行批次寫入
    await batch.commit();

    console.log(`成功寫入 ${DL_CONFIG.logBuffer.length} 條日誌到 Firestore`);

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
 * 3.10 輪換日誌集合（在Firestore中，這主要是記錄輪換事件）
 */
async function DL_rotateLogSheet() {
  try {
    // 在Firestore中，不需要像Google Sheets那樣手動輪換
    // 但保留此函數以維持介面一致性，主要用於記錄輪換事件

    // 檢查當前日誌集合的文檔數量
    const snapshot = await db.collection(DL_CONFIG.logCollection).get();
    const currentDocCount = snapshot.size;

    if (currentDocCount >= DL_MAX_LOGS_PER_SHEET) {
      // 記錄輪換事件
      await db.collection(DL_CONFIG.logCollection).add({
        時間: admin.firestore.Timestamp.now(),
        訊息: `日誌集合已達到 ${currentDocCount} 條記錄，建議考慮歸檔`,
        操作類型: "日誌輪換",
        UID: "",
        錯誤代碼: "",
        來源: "DL",
        錯誤詳情: "",
        重試次數: 0,
        程式碼位置: "DL_rotateLogSheet",
        嚴重等級: "INFO",
      });

      console.log(
        `DL_rotateLogSheet: 日誌集合已達到 ${currentDocCount} 條記錄`,
      );
      return true;
    }

    return false; // 不需要輪換
  } catch (error) {
    console.error(`DL_rotateLogSheet錯誤: ${error.toString()}`);
    return false;
  }
}

/**
 * 3.11 設置緊急模式 - 適配環境變數存儲
 */
async function DL_toggleMode(enabled, reason = "") {
  const prevMode = DL_CONFIG.mode;

  if (enabled) {
    DL_CONFIG.mode = "EMERGENCY";
    DL_CONFIG.emergencyReason = reason || "未指定原因";

    // 持久化存儲模式設置到環境變數（僅在記憶體中）
    process.env.DL_MODE = "EMERGENCY";
    process.env.DL_EMERGENCY_REASON = DL_CONFIG.emergencyReason;

    if (prevMode !== "EMERGENCY") {
      await DL_warning(
        `已切換到緊急模式 - ${DL_CONFIG.emergencyReason}`,
        "模式切換",
      );
    }
  } else {
    DL_CONFIG.mode = "NORMAL";
    DL_CONFIG.emergencyReason = "";

    // 持久化存儲模式設置到環境變數（僅在記憶體中）
    process.env.DL_MODE = "NORMAL";
    process.env.DL_EMERGENCY_REASON = "";

    if (prevMode !== "NORMAL") {
      await DL_info("已恢復到正常模式", "模式切換");
    }
  }
}

/**
 * 3.12 開啟普通模式
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
 * 3.14 強制重置緊急模式
 */
async function DL_resetEmergencyMode() {
  try {
    // 直接設置配置
    DL_CONFIG.mode = "NORMAL";
    DL_CONFIG.emergencyReason = "";

    // 強制持久化存儲
    process.env.DL_MODE = "NORMAL";
    process.env.DL_EMERGENCY_REASON = "";

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
 */
function DL_setLogLevels(consoleLevel, firestoreLevel) {
  if (
    consoleLevel &&
    DL_SEVERITY_LEVELS.hasOwnProperty(consoleLevel.toUpperCase())
  ) {
    DL_CONFIG.consoleLogLevel = DL_SEVERITY_LEVELS[consoleLevel.toUpperCase()];
  }

  if (
    firestoreLevel &&
    DL_SEVERITY_LEVELS.hasOwnProperty(firestoreLevel.toUpperCase())
  ) {
    DL_CONFIG.firestoreLogLevel =
      DL_SEVERITY_LEVELS[firestoreLevel.toUpperCase()];
  }
}

/**
 * 4. 記錄日誌的統一函數
 */
async function DL_log(logData) {
  // 檢查必要參數
  if (!logData.message) {
    console.error("DL_log錯誤: 缺少必要參數 message");
    return false;
  }

  if (!logData.operation) {
    console.error("DL_log錯誤: 缺少必要參數 operation");
  }

  // 修改這部分：尊重傳入的source參數
  if (!logData.source) {
    // 只有在未提供source時才嘗試自動檢測
    logData.source = DL_detectCallerModule();
  }

  if (!logData.severity) {
    logData.severity = "INFO";
  }

  // 標準化嚴重等級
  logData.severity = logData.severity.toUpperCase();
  if (!Object.keys(DL_SEVERITY_LEVELS).includes(logData.severity)) {
    console.error(`DL_log錯誤: 無效的嚴重等級 ${logData.severity}`);
    logData.severity = "INFO";
  }

  // 獲取當前時間戳
  const timestamp = new Date();

  // 自動獲取位置（如果未提供）- 修改為優先使用函數名
  if (!logData.location) {
    try {
      throw new Error();
    } catch (e) {
      const stackLines = e.stack.split("\n");
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

  // 檢查模組和函數過濾
  const source = logData.source;
  const func = logData.function || "";

  // 只有在普通模式下才應用過濾
  if (DL_CONFIG.mode === "NORMAL") {
    // 模組過濾
    if (
      DL_CONFIG.enabledModules.indexOf("ALL") === -1 &&
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
      DL_CONFIG.enabledFunctions.indexOf("ALL") === -1 &&
      DL_CONFIG.enabledFunctions.indexOf(func) === -1
    ) {
      return false; // 該函數未啟用，不記錄日誌
    }

    if (func && DL_CONFIG.disabledFunctions.indexOf(func) !== -1) {
      return false; // 該函數已禁用，不記錄日誌
    }
  }

  // 獲取嚴重等級數值
  const severityLevel = DL_SEVERITY_LEVELS[logData.severity];

  // 控制台日誌
  if (
    DL_CONFIG.enableConsoleLog &&
    severityLevel >= DL_CONFIG.consoleLogLevel
  ) {
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
      case "DEBUG":
        console.log(consoleMessage);
        break;
      case "INFO":
        console.info(consoleMessage);
        break;
      case "WARNING":
        console.warn(consoleMessage);
        break;
      case "ERROR":
      case "CRITICAL":
        console.error(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }
  }

  // Firestore 日誌
  if (
    DL_CONFIG.enableFirestoreLog &&
    severityLevel >= DL_CONFIG.firestoreLogLevel
  ) {
    try {
      // 格式化時間戳
      const formattedTimestamp = moment(timestamp)
        .tz(DL_CONFIG.timezone)
        .format("YYYY-MM-DD HH:mm:ss");

      // 準備日誌數據行 - 確保使用正確的source欄位
      const logRow = [
        formattedTimestamp, // 1. 時間戳記
        logData.message || "", // 2. 訊息
        logData.operation || "", // 3. 操作類型
        logData.userId || "", // 4. 使用者ID
        logData.errorCode || "", // 5. 錯誤代碼
        logData.source || "", // 6. 來源
        logData.details || "", // 7. 錯誤詳情
        logData.retryCount || 0, // 8. 重試次數
        logData.location || "", // 9. 程式碼位置
        logData.severity || "INFO", // 10. 嚴重等級
      ];

      // 將日誌添加到緩衝區
      DL_CONFIG.logBuffer.push(logRow);

      // 檢查緩衝區是否需要刷新
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
 */
function DL_detectCallerModule() {
  try {
    throw new Error();
  } catch (e) {
    const stackLines = e.stack.split("\n");
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
    return "DL"; // 默認返回DL
  }
}

/**
 * 6. 輔助函數 - 將日誌直接寫入 Firestore（緊急情況下使用，繞過緩衝區）
 */
async function DL_writeToFirestore(logData, timestamp) {
  try {
    const formattedTimestamp = timestamp
      ? moment(timestamp).tz(DL_CONFIG.timezone).format("YYYY-MM-DD HH:mm:ss")
      : moment().tz(DL_CONFIG.timezone).format("YYYY-MM-DD HH:mm:ss");

    // 直接寫入 Firestore
    await db.collection(DL_CONFIG.logCollection).add({
      時間: admin.firestore.Timestamp.fromDate(
        timestamp ? new Date(timestamp) : new Date(),
      ),
      訊息: logData.message || "",
      操作類型: logData.operation || "",
      UID: logData.userId || "",
      錯誤代碼: logData.errorCode || "",
      來源: logData.source || "",
      錯誤詳情: logData.details || "",
      重試次數: logData.retryCount || 0,
      程式碼位置: logData.location || "",
      嚴重等級: logData.severity || "INFO",
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
async function DL_debug(
  message,
  operation,
  userId,
  errorCode,
  details,
  retryCount,
  location,
  functionName,
) {
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
    source: source,
  });
}

// 7.2 INFO級別日誌
async function DL_info(
  message,
  operation,
  userId,
  errorCode,
  details,
  retryCount,
  location,
  functionName,
) {
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
    source: source,
  });
}

// 7.3 WARNING級別日誌
async function DL_warning(
  message,
  operation,
  userId,
  errorCode,
  details,
  retryCount,
  location,
  functionName,
) {
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
    source: source,
  });
}

// 7.4 ERROR級別日誌
async function DL_error(
  message,
  operation,
  userId,
  errorCode,
  details,
  retryCount,
  location,
  functionName,
) {
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
    source: source,
  });
}

// 7.5 CRITICAL級別日誌
async function DL_critical(
  message,
  operation,
  userId,
  errorCode,
  details,
  retryCount,
  location,
  functionName,
) {
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
    source: source,
  });
}

/**
 * 8. 系統診斷功能 - 適配Firestore
 */
async function DL_diagnose() {
  try {
    const diagnoseStartTime = new Date();
    const diagnoseId = uuidv4().substring(0, 8);

    await DL_info(
      `開始系統診斷 [${diagnoseId}]`,
      "系統診斷",
      "",
      "",
      "",
      0,
      "DL_diagnose",
    );

    // 8.1 檢查DL模組配置
    const dlConfigStatus = {
      enableConsoleLog: DL_CONFIG.enableConsoleLog,
      enableFirestoreLog: DL_CONFIG.enableFirestoreLog,
      consoleLogLevel: DL_CONFIG.consoleLogLevel,
      firestoreLogLevel: DL_CONFIG.firestoreLogLevel,
      mode: DL_CONFIG.mode,
      bufferSize: DL_CONFIG.logBuffer.length,
      lastFlushTime: new Date(DL_CONFIG.lastBufferFlush).toISOString(),
    };

    // 8.2 檢查 Firestore 連接
    let firestoreStatus = "未檢查";
    let logCollectionStatus = "未檢查";

    try {
      // 嘗試連接 Firestore
      const testDoc = await db
        .collection(DL_CONFIG.logCollection)
        .limit(1)
        .get();
      firestoreStatus = "連接成功";

      // 檢查日誌集合
      const logSnapshot = await db.collection(DL_CONFIG.logCollection).get();
      logCollectionStatus = `${logSnapshot.size} 條記錄`;

      // 8.3 分析最近日誌
      const recentLogs = [];

      // 獲取最近50條日誌
      const logsSnapshot = await db
        .collection(DL_CONFIG.logCollection)
        .orderBy("時間", "desc")
        .limit(50)
        .get();

      logsSnapshot.forEach((doc) => {
        const data = doc.data();
        recentLogs.push({
          timestamp: data.時間,
          message: data.訊息,
          operation: data.操作類型,
          userId: data.UID,
          errorCode: data.錯誤代碼,
          source: data.來源,
          details: data.錯誤詳情,
          retryCount: data.重試次數,
          location: data.程式碼位置,
          severity: data.嚴重等級,
        });
      });

      // 8.4 統計嚴重程度分布
      const severityCounts = {
        DEBUG: 0,
        INFO: 0,
        WARNING: 0,
        ERROR: 0,
        CRITICAL: 0,
      };

      // 8.5 統計模組錯誤數量
      const moduleErrors = {};

      // 8.6 統計常見錯誤
      const commonErrors = {};

      // 分析日誌
      recentLogs.forEach((log) => {
        const severity = log.severity;
        const module = log.source;
        const message = log.message;

        // 更新嚴重程度計數
        if (severityCounts.hasOwnProperty(severity)) {
          severityCounts[severity]++;
        }

        // 統計每個模組的錯誤數
        if (severity === "ERROR" || severity === "CRITICAL") {
          moduleErrors[module] = (moduleErrors[module] || 0) + 1;

          // 統計常見錯誤
          commonErrors[message] = (commonErrors[message] || 0) + 1;
        }
      });

      // 8.7 獲取診斷完成時間和持續時間
      const diagnoseEndTime = new Date();
      const diagnoseDuration =
        diagnoseEndTime.getTime() - diagnoseStartTime.getTime();

      await DL_info(
        `系統診斷完成 [${diagnoseId}] 耗時: ${diagnoseDuration}ms`,
        "系統診斷",
        "",
        "",
        "",
        0,
        "DL_diagnose",
      );

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
          commonErrors: commonErrors,
        },
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
      error: "診斷過程中斷",
    };
  } catch (error) {
    await DL_error(
      `診斷過程失敗: ${error.toString()}`,
      "系統診斷",
      "",
      "DIAGNOSE_ERROR",
      error.toString(),
      0,
      "DL_diagnose",
    );

    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: `診斷過程失敗: ${error.toString()}`,
    };
  }
}

/**
 * 9. 獲取當前模式狀態 - 適配環境變數存儲
 */
async function DL_getModeStatus() {
  try {
    // 從環境變數讀取持久化存儲的模式
    const storedMode = process.env.DL_MODE || "NORMAL";
    const storedReason = process.env.DL_EMERGENCY_REASON || "";

    return {
      success: true,
      currentMode: DL_CONFIG.mode,
      storedMode: storedMode,
      currentReason: DL_CONFIG.emergencyReason,
      storedReason: storedReason,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `獲取模式狀態失敗: ${error.toString()}`,
      currentMode: DL_CONFIG.mode,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 10. 依賴注入函數 - 用於支持從 index.js 設置依賴
 * 雖然DL模組通常是基礎模組，但保留此函數以保持模組接口一致性
 * @param {Object} whModule - Webhook模組
 * @param {Object} bkModule - 記帳處理模組
 * @param {Object} ddModule - 資料分配模組
 */
function setDependencies(whModule, bkModule, ddModule) {
  console.log("DL模組設置依賴關係");

  // DL作為基礎模組通常不依賴其他模組，但為了架構一致性保留此函數
  // 未來如有需要可以在此處設置模組間依賴
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
  DL_SEVERITY_LEVELS,
  DL_rotateLogSheet, // 保留但改為適用於Firestore
  DL_writeToFirestore, // 新增，替代原來的DL_writeToGoogleSheets

  // 新增依賴注入函數
  setDependencies,
};
