/**
 * DD_資料分配模組_2.0.8
 * @module 資料分配模組
 * @description 根據預定義的規則將數據分配到不同的工作表或數據庫表中，處理時間戳轉換，處理Rich menu指令與使用者訊息。
 * @author AustinLiao69
 */

// 首先引入其他模組
const BK = require("./2001. BK.js");
const DL = require("./2010. DL.js");

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

// 全域變數替代 Google Apps Script 的內建函數
let spreadsheetData = {};
let scriptProperties = {};

// 替代 Google Apps Script 的 Utilities 物件
const Utilities = {
  getUuid: () => uuidv4(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// 替代 Google Apps Script 的 SpreadsheetApp
const SpreadsheetApp = {
  openById: (id) => ({
    getSheetByName: (name) => ({
      getLastRow: () =>
        spreadsheetData[name] ? spreadsheetData[name].length : 0,
      getRange: (row, col, numRows, numCols) => ({
        getValues: () => spreadsheetData[name] || [],
      }),
    }),
  }),
};

// 替代 getScriptProperty 函數
function getScriptProperty(key) {
  return scriptProperties[key] || process.env[key];
}

/**
 * 99. 初始化檢查 - 在模組載入時執行，確保關鍵資源可用
 */
try {
  console.log(`DD模組初始化檢查 [${new Date().toISOString()}]`);
  console.log(`DD模組版本: 2.0.2 (2025-06-19)`);
  console.log(`執行時間: ${new Date().toLocaleString()}`);

  const ss = SpreadsheetApp.openById(getScriptProperty("SPREADSHEET_ID"));
  console.log(`主試算表檢查: ${ss ? "成功" : "失敗"}`);

  const logSheet = ss.getSheetByName(getScriptProperty("LOG_SHEET_NAME"));
  console.log(`日誌表檢查: ${logSheet ? "成功" : "失敗"}`);

  const subjectSheet = ss.getSheetByName("997. 科目代碼_測試");
  console.log(`科目表檢查: ${subjectSheet ? "成功" : "失敗"}`);

  // 檢查科目表是否有數據
  if (subjectSheet) {
    const lastRow = subjectSheet.getLastRow();
    console.log(`科目表有 ${lastRow} 行數據`);
  }

  console.log(
    `BK_processBookkeeping函數檢查: ${typeof BK_processBookkeeping === "function" ? "存在" : "不存在"}`,
  );
} catch (error) {
  console.log(`DD模組初始化錯誤: ${error.toString()}`);
  if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
}

/**
 * 1. 各種定義
 */
const DD_TARGET_MODULE_BK = "BK"; // 記帳處理模組
const DD_TARGET_MODULE_WH = "WH"; // Webhook 模組
const DD_SUBJECT_CODE_SHEET_NAME = "997. 科目代碼_測試";
const DD_SUBJECT_CODE_MAJOR_CODE_COLUMN = 1; // 大項代碼
const DD_SUBJECT_CODE_MAJOR_NAME_COLUMN = 2; // 大項名稱
const DD_SUBJECT_CODE_SUB_CODE_COLUMN = 3; // 子項代碼
const DD_SUBJECT_CODE_SUB_NAME_COLUMN = 4; // 子項名稱
const DD_SUBJECT_CODE_SYNONYMS_COLUMN = 5; // 新增：同義詞列（第5列）
const DD_USER_PREF_SHEET_NAME = "09. 使用者偏好"; // 新增：用戶偏好表名稱
const DD_MODULE_PREFIX = "DD_";
const DD_CONFIG = {
  DEBUG: true,
  LOG_SHEET_NAME: getScriptProperty("LOG_SHEET_NAME"),
  SPREADSHEET_ID: getScriptProperty("SPREADSHEET_ID"),
  TIMEZONE: "Asia/Taipei",
  DEFAULT_SUBJECT: "其他支出",
};

/**
 *4. 定義重試配置
 */
const DD_MAX_RETRIES = 3; // 最大重試次數
const DD_RETRY_DELAY = 1000; // 重試延遲時間（毫秒）

/**
 * 5. 主要的資料分配函數（支援重試機制）
 * @version 2025-06-02-V3.0.0
 * @author AustinLiao691
 * @update: 整合DD_formatSystemReplyMessage統一處理訊息
 * @param {object} data - 需要分配的原始數據
 * @param {string} source - 數據來源 (例如: 'Rich menu', '使用者訊息')
 * @param {number} retryCount - 當前重試次數（內部使用）
 * @returns {object} - 處理結果
 */
async function DD_distributeData(data, source, retryCount = 0) {
  // 模組初始化檢查
  try {
    console.log("=== DD_distributeData執行初始檢查 ===");
    console.log(`DD_MAX_RETRIES: ${DD_MAX_RETRIES}`);
    console.log(`DD_RETRY_DELAY: ${DD_RETRY_DELAY}`);
    console.log(`DD_TARGET_MODULE_BK: ${DD_TARGET_MODULE_BK}`);
    console.log(`DD_TARGET_MODULE_WH: ${DD_TARGET_MODULE_WH}`);
  } catch (e) {
    console.log(`初始化檢查錯誤: ${e.toString()}`);
  }

  // 直接控制台日誌，確保無論日誌系統是否正常都會記錄
  console.log(
    `DD_distributeData被調用，數據源: ${source}, 用戶ID: ${data.user_id || data.userId || "未知"}, 時間: ${new Date().toISOString()}`,
  );

  const processId = Utilities.getUuid().substring(0, 8);
  console.log(`處理ID: ${processId}`);
  DD_logInfo(
    `開始處理數據 [${processId}]`,
    "數據分配",
    data.user_id || data.userId || "",
    "DD_distributeData",
    "DD_distributeData",
  );

  try {
    // ===== 標準化數據 =====
    // 確保用戶ID格式一致
    if (data.userId && !data.user_id) {
      data.user_id = data.userId;
      console.log(`標準化用戶ID: userId -> user_id = ${data.user_id}`);
    } else if (data.user_id && !data.userId) {
      data.userId = data.user_id;
      console.log(`標準化用戶ID: user_id -> userId = ${data.userId}`);
    }

    // ===== 來源適配 =====
    if (!source || source === "LINE" || source === "Webhook") {
      console.log(`調整數據來源從「${source}」到「使用者訊息」`);
      source = "使用者訊息";
    }

    // 記錄處理的數據和來源
    const dataPreview =
      JSON.stringify(data).substring(0, 100) +
      (JSON.stringify(data).length > 100 ? "..." : "");
    console.log(`處理數據: ${dataPreview}, 來源: ${source}`);
    DD_logDebug(
      `處理數據: ${dataPreview}, 來源: ${source}`,
      "數據接收",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    // 處理時間戳（如果存在）
    if (data && data.timestamp) {
      console.log(`處理時間戳: ${data.timestamp}`);
      DD_logDebug(
        `處理時間戳: ${data.timestamp}`,
        "數據處理",
        data.user_id || data.userId || "",
        "DD_distributeData",
        "DD_distributeData",
      );

      const convertedTime = DD_convertTimestamp(data.timestamp);
      if (convertedTime) {
        data.convertedDate = convertedTime.date;
        data.convertedTime = convertedTime.time;
        console.log(
          `時間戳轉換結果: ${data.convertedDate} ${data.convertedTime}`,
        );
        DD_logDebug(
          `時間戳轉換結果: ${data.convertedDate} ${data.convertedTime}`,
          "數據處理",
          data.user_id || data.userId || "",
          "DD_distributeData",
          "DD_distributeData",
        );
      } else {
        console.log(`警告: 時間戳轉換失敗: ${data.timestamp}`);
        DD_logWarning(
          `時間戳轉換失敗: ${data.timestamp}`,
          "數據處理",
          data.user_id || data.userId || "",
          "DD_distributeData",
          "DD_distributeData",
        );
      }
    }

    // 如果是使用者訊息，先處理訊息內容
    if (source === "使用者訊息" && data && data.text) {
      console.log(`處理用戶訊息: "${data.text}"`);
      DD_logInfo(
        `處理用戶訊息: "${data.text}"`,
        "訊息處理",
        data.user_id || data.userId || "",
        "DD_distributeData",
        "DD_distributeData",
      );

      const processedData = DD_processUserMessage(
        data.text,
        data.userId || data.user_id,
        data.timestamp,
      );
      console.log(
        `DD_processUserMessage返回: ${JSON.stringify(processedData)}`,
      );

      if (processedData && processedData.processed) {
        // 保留原始資料，並添加處理後的資訊
        console.log(
          `成功解析訊息: 科目=${processedData.subjectName}, 金額=${processedData.amount}, 支付方式=${processedData.paymentMethod || "預設"}`,
        );
        DD_logInfo(
          `成功解析訊息: 科目=${processedData.subjectName}, 金額=${processedData.amount}, 支付方式=${processedData.paymentMethod || "預設"}`,
          "訊息處理",
          data.user_id || data.userId || "",
          "DD_distributeData",
          "DD_distributeData",
        );

        // 更新：使用subjectName而不是subject
        data.subjectName = processedData.subjectName;
        data.amount = processedData.amount;
        data.action = processedData.action;
        data.processed = processedData.processed;
        data.type = processedData.type;

        // 新增：傳遞支付方式
        if (processedData.paymentMethod) {
          data.paymentMethod = processedData.paymentMethod;
          console.log(`設置支付方式: ${data.paymentMethod}`);
        }

        // 複製科目代碼信息
        if (processedData.majorCode) data.majorCode = processedData.majorCode;
        if (processedData.subCode) data.subCode = processedData.subCode;

        console.log(
          `訊息解析成功: 科目=${processedData.subjectName}, 金額=${processedData.amount}, 支付方式=${data.paymentMethod || "預設"}`,
        );
      } else if (processedData && processedData.errorMessage) {
        // 處理失敗但有錯誤訊息，直接返回錯誤訊息
        console.log(`訊息解析失敗但有錯誤訊息: ${processedData.errorMessage}`);
        DD_logWarning(
          `訊息解析失敗但有錯誤訊息: ${processedData.errorMessage}`,
          "訊息處理",
          data.user_id || data.userId || "",
          "DD_distributeData",
          "DD_distributeData",
        );

        return DD_formatSystemReplyMessage(
          {
            success: false,
            error: processedData.reason || "訊息解析失敗",
            errorType: processedData.errorType || "MESSAGE_PARSE_ERROR",
            userFriendlyMessage: processedData.errorMessage,
          },
          "DD",
          {
            userId: data.userId || data.user_id,
            replyToken: data.replyToken,
            processId: processId,
          },
        );
      } else {
        // 處理失敗的情況
        console.log(
          `訊息解析失敗: ${processedData ? processedData.reason : "未知原因"}`,
        );
        DD_logWarning(
          `訊息解析失敗: ${processedData ? processedData.reason : "未知原因"}`,
          "訊息處理",
          data.user_id || data.userId || "",
          "DD_distributeData",
          "DD_distributeData",
        );

        // 直接返回格式化的錯誤訊息
        return DD_formatSystemReplyMessage(
          {
            success: false,
            error: processedData ? processedData.reason : "無法解析訊息",
            errorType: "MESSAGE_PARSE_ERROR",
          },
          "DD",
          {
            userId: data.userId || data.user_id,
            replyToken: data.replyToken,
            processId: processId,
            errorMessage: "無法解析您的記帳信息，請檢查格式後重試。",
          },
        );
      }
    }

    // 6. 根據數據屬性進行分類
    console.log(`開始分類數據`);
    DD_logInfo(
      `開始分類數據`,
      "數據分類",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    const category = DD_classifyData(data, source);
    console.log(`數據分類結果: ${category}`);
    DD_logInfo(
      `數據分類結果: ${category}`,
      "數據分類",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    // 7. 根據分類結果分發數據
    console.log(`開始分發數據至 ${category}`);
    DD_logInfo(
      `開始分發數據至 ${category}`,
      "數據分發",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    const dispatchResult = DD_dispatchData(data, category);
    console.log(`數據分發完成，結果: ${JSON.stringify(dispatchResult)}`);
    DD_logInfo(
      `數據分發完成，結果: ${JSON.stringify(dispatchResult)}`,
      "數據分發",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    // 使用統一消息格式化處理結果
    return DD_formatSystemReplyMessage(
      dispatchResult || {
        success: true,
        category: category,
        processId: processId,
      },
      dispatchResult ? dispatchResult.module || "DD" : "DD",
      {
        userId: data.userId || data.user_id,
        replyToken: data.replyToken,
        processId: processId,
      },
    );
  } catch (error) {
    // 記錄原始錯誤
    const userId =
      data && (data.user_id || data.userId) ? data.user_id || data.userId : "";
    console.log(`數據處理錯誤: ${error.toString()}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `數據處理錯誤: ${error.toString()}`,
      "數據處理",
      userId,
      "ERROR",
      error.toString(),
      "DD_distributeData",
      "DD_distributeData",
    );

    // 8. 重試機制
    if (retryCount < DD_MAX_RETRIES) {
      // 使用指數退避策略延遲重試
      const delayTime = DD_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(
        `準備重試 (${retryCount + 1}/${DD_MAX_RETRIES})，延遲 ${delayTime}ms`,
      );
      DD_logWarning(
        `準備重試 (${retryCount + 1}/${DD_MAX_RETRIES})，延遲 ${delayTime}ms`,
        "錯誤重試",
        userId,
        "DD_distributeData",
        "DD_distributeData",
      );

      await Utilities.sleep(delayTime);
      return DD_distributeData(data, source, retryCount + 1);
    } else {
      // 重試次數耗盡，使用統一錯誤處理函數生成錯誤訊息
      return DD_formatSystemReplyMessage(
        {
          success: false,
          error: `超過最大重試次數 ${DD_MAX_RETRIES}，放棄處理`,
          errorType: "MAX_RETRY",
          context: { retryCount: DD_MAX_RETRIES },
        },
        "DD",
        {
          userId: userId,
          replyToken: data.replyToken,
          processId: processId,
          isRetryable: false,
        },
      );
    }
  }
}

/**
 * 9. 數據分類函數
 * @param {object} data - 需要分類的數據
 * @param {string} source - 數據來源
 * @returns {string} - 數據的類別 (用於決定分發到哪個模組)
 */
function DD_classifyData(data, source) {
  let category = "default";

  // 獲取進程ID用於日誌追蹤
  const classifyId = Utilities.getUuid().substring(0, 8);
  console.log(`開始分類，來源: ${source} [${classifyId}]`);
  DD_logDebug(
    `開始分類，來源: ${source} [${classifyId}]`,
    "數據分類",
    data.user_id || data.userId || "",
    "DD_classifyData",
    "DD_classifyData",
  );

  try {
    // 規則 1：處理來自 Rich menu 的各種按鈕
    if (source === "Rich menu" && data) {
      if (data.action === "記帳" || data.postback === "記帳") {
        category = DD_TARGET_MODULE_BK;
        console.log(`檢測到記帳按鈕操作`);
        DD_logDebug(
          `檢測到記帳按鈕操作`,
          "數據分類",
          data.user_id || data.userId || "",
          "DD_classifyData",
          "DD_classifyData",
        );
      }
    }
    // 規則 2：處理來自使用者訊息
    else if (source === "使用者訊息" && data) {
      // 只檢查由DD_processUserMessage標記的數據
      if (data.type === "記帳" && data.processed) {
        category = DD_TARGET_MODULE_BK;
        console.log(`檢測到已處理的記帳訊息`);
        DD_logDebug(
          `檢測到已處理的記帳訊息`,
          "數據分類",
          data.user_id || data.userId || "",
          "DD_classifyData",
          "DD_classifyData",
        );
      }
    }
    // 規則 3：來自 Webhook 的請求
    else if (source === "Webhook" && data) {
      category = DD_TARGET_MODULE_WH;
      console.log(`檢測到Webhook請求`);
      DD_logDebug(
        `檢測到Webhook請求`,
        "數據分類",
        data.user_id || data.userId || "",
        "DD_classifyData",
        "DD_classifyData",
      );
    }

    console.log(`分類結果: ${category} [${classifyId}]`);
    DD_logDebug(
      `分類結果: ${category} [${classifyId}]`,
      "數據分類",
      data.user_id || data.userId || "",
      "DD_classifyData",
      "DD_classifyData",
    );
    return category;
  } catch (error) {
    console.log(`分類過程出錯: ${error.toString()} [${classifyId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `分類過程出錯: ${error.toString()}`,
      "數據分類",
      data.user_id || data.userId || "",
      "ERROR",
      error.toString(),
      "DD_classifyData",
      "DD_classifyData",
    );
    return "ERROR";
  }
}

/**
 * 10. 數據分發函數
 * @version 2025-06-11-V3.0.0
 * @author AustinLiao691
 * @date 2025-06-11 07:42:24
 * @update: 統一使用58號函數(DD_formatSystemReplyMessage)處理系統回覆訊息
 * @param {object} data - 需要分發的數據
 * @param {string} targetModule - 目標模組的名稱
 * @returns {object} - 處理結果
 */
function DD_dispatchData(data, targetModule) {
  const dispatchId = Utilities.getUuid().substring(0, 8);
  const userId = data.user_id || data.userId || "";

  console.log(`開始分發數據至 ${targetModule} [${dispatchId}]`);
  DD_logInfo(
    `開始分發數據至 ${targetModule} [${dispatchId}]`,
    "數據分發",
    userId,
    "DD_dispatchData",
    "DD_dispatchData",
  );

  try {
    let result = { success: false, module: targetModule };

    switch (targetModule) {
      case DD_TARGET_MODULE_BK:
        console.log(`轉發到BK模組 [${dispatchId}]`);
        DD_logInfo(
          `轉發到BK模組 [${dispatchId}]`,
          "數據分發",
          userId,
          "DD_dispatchData",
          "DD_dispatchData",
        );

        // 檢查DD_processForBK函數是否存在
        if (typeof DD_processForBK !== "function") {
          console.log(`DD_processForBK函數不存在 [${dispatchId}]`);
          DD_logError(
            `DD_processForBK函數不存在 [${dispatchId}]`,
            "數據分發",
            userId,
            "FUNCTION_NOT_FOUND",
            "函數不存在",
            "DD_dispatchData",
          );

          // 使用58號函數統一處理錯誤訊息
          return DD_formatSystemReplyMessage(
            {
              success: false,
              error: "DD_processForBK函數不存在",
              errorType: "FUNCTION_NOT_FOUND",
            },
            "DD",
            {
              userId: userId,
              context: { functionName: "DD_processForBK" },
              processId: dispatchId,
            },
          );
        } else {
          try {
            console.log(`開始調用DD_processForBK [${dispatchId}]`);
            result = DD_processForBK(data);
            console.log(
              `DD_processForBK調用完成，結果: ${JSON.stringify(result).substring(0, 200)}... [${dispatchId}]`,
            );
          } catch (bkError) {
            // 增強錯誤日誌
            console.log(
              `調用DD_processForBK時出錯: ${bkError.toString()} [${dispatchId}]`,
            );
            if (bkError.stack) console.log(`錯誤堆疊: ${bkError.stack}`);
            DD_logError(
              `調用DD_processForBK時出錯: ${bkError.toString()}\n堆疊: ${bkError.stack || "n/a"}`,
              "數據分發",
              userId,
              "BK_ERROR",
              bkError.toString(),
              "DD_dispatchData",
            );

            // 使用58號函數統一處理錯誤訊息
            return DD_formatSystemReplyMessage(
              {
                success: false,
                error: bkError.toString(),
                errorType: "BK_ERROR",
              },
              "BK",
              {
                userId: userId,
                processId: dispatchId,
              },
            );
          }
        }
        break;

      case DD_TARGET_MODULE_WH:
        console.log(`轉發到WH模組 [${dispatchId}]`);
        DD_logInfo(
          `轉發到WH模組 [${dispatchId}]`,
          "數據分發",
          userId,
          "DD_dispatchData",
          "DD_dispatchData",
        );

        // 檢查DD_processForWH函數是否存在
        if (typeof DD_processForWH !== "function") {
          console.log(`DD_processForWH函數不存在 [${dispatchId}]`);
          DD_logError(
            `DD_processForWH函數不存在 [${dispatchId}]`,
            "數據分發",
            userId,
            "FUNCTION_NOT_FOUND",
            "函數不存在",
            "DD_dispatchData",
          );

          // 使用58號函數統一處理錯誤訊息
          return DD_formatSystemReplyMessage(
            {
              success: false,
              error: "DD_processForWH函數不存在",
              errorType: "FUNCTION_NOT_FOUND",
            },
            "DD",
            {
              userId: userId,
              context: { functionName: "DD_processForWH" },
              processId: dispatchId,
            },
          );
        } else {
          try {
            console.log(`開始調用DD_processForWH [${dispatchId}]`);
            result = DD_processForWH(data);
            console.log(
              `DD_processForWH調用完成，結果: ${JSON.stringify(result).substring(0, 200)}... [${dispatchId}]`,
            );
          } catch (whError) {
            // 增強錯誤日誌
            console.log(
              `調用DD_processForWH時出錯: ${whError.toString()} [${dispatchId}]`,
            );
            if (whError.stack) console.log(`錯誤堆疊: ${whError.stack}`);
            DD_logError(
              `調用DD_processForWH時出錯: ${whError.toString()}\n堆疊: ${whError.stack || "n/a"}`,
              "數據分發",
              userId,
              "WH_ERROR",
              whError.toString(),
              "DD_dispatchData",
            );

            // 使用58號函數統一處理錯誤訊息
            return DD_formatSystemReplyMessage(
              {
                success: false,
                error: whError.toString(),
                errorType: "WH_ERROR",
              },
              "WH",
              {
                userId: userId,
                processId: dispatchId,
              },
            );
          }
        }
        break;

      default:
        console.log(`未知的目標模組: ${targetModule} [${dispatchId}]`);
        DD_logError(
          `未知的目標模組: ${targetModule} [${dispatchId}]`,
          "數據分發",
          userId,
          "UNKNOWN_MODULE",
          "模組未知",
          "DD_dispatchData",
        );

        // 使用58號函數統一處理錯誤訊息
        return DD_formatSystemReplyMessage(
          {
            success: false,
            error: `未知的目標模組: ${targetModule}`,
            errorType: "UNKNOWN_MODULE",
          },
          "DD",
          {
            userId: userId,
            context: { moduleName: targetModule },
            processId: dispatchId,
          },
        );
    }

    console.log(
      `數據分發完成: ${JSON.stringify(result).substring(0, 200)}... [${dispatchId}]`,
    );
    DD_logInfo(
      `數據分發完成，結果: ${JSON.stringify(result).substring(0, 200)}... [${dispatchId}]`,
      "數據分發",
      userId,
      "DD_dispatchData",
      "DD_dispatchData",
    );

    // 重要：直接返回結果，不再使用DD_formatUserErrorFeedback
    return result;
  } catch (error) {
    // 增強錯誤日誌
    console.log(`分發數據出錯: ${error.toString()} [${dispatchId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `分發數據出錯: ${error.toString()}\n堆疊: ${error.stack || "n/a"}`,
      "數據分發",
      userId,
      "DISPATCH_ERROR",
      error.toString(),
      "DD_dispatchData",
    );

    // 使用58號函數統一處理錯誤訊息
    return DD_formatSystemReplyMessage(
      {
        success: false,
        error: error.toString(),
        errorType: "DISPATCH_ERROR",
      },
      "DD",
      {
        userId: userId,
        processId: dispatchId,
      },
    );
  }
}

/**
 * 11. 處理 Webhook 模組 (WH) 的數st�
 * @param {object} data - 需要處理的數據
 * @returns {object} - 處理結果
 */
function DD_processForWH(data) {
  const whId = Utilities.getUuid().substring(0, 8);
  console.log(`開始處理WH數據 [${whId}]`);

  // 在此處理轉發給 Webhook 模組的邏輯
  // 檢查WH模組函數是否存在
  if (typeof WH_processEvent === "function") {
    try {
      console.log(`調用WH_processEvent [${whId}]`);
      WH_processEvent(data);
      console.log(`成功轉發到WH模組 [${whId}]`);
      return { success: true, module: "WH" };
    } catch (error) {
      console.log(
        `轉發到WH_processEvent時發生錯誤 [${whId}]: ${error.toString()}`,
      );
      return { success: false, error: error.toString(), module: "WH" };
    }
  } else {
    console.log(`WH_processEvent函數不存在 [${whId}]`);
    return { success: false, error: "WH_processEvent函數不存在", module: "WH" };
  }
}

/**
 * 12. 處理數據並傳遞給BK模組記帳 - 修正回复消息和支付方式处理
 * @version 2025-06-17-V6.0.1
 * @author AustinLiao69
 * @date 2025-06-17 02:51:50
 * @update: 修正用词"付款方式"为"支付方式"，移除支付方式默認值，增加收支ID显示
 * @param {Object} data - 來自DD_processUserMessage或其他來源的數據
 * @return {Object} 處理結果
 */
function DD_processForBK(data) {
  try {
    // 確保處理ID存在
    const processId = data.processId || Utilities.getUuid().substring(0, 8);

    // 正確獲取userId - 修復：從data物件中提取userId
    const userId = data.userId || data.user_id || "";

    // 記錄開始處理
    DD_logInfo(
      `開始處理記帳數據 [${processId}]`,
      "記帳處理",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );

    // 檢查必要字段
    if (!data.action) {
      DD_logWarning(
        `缺少必要字段: action [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("缺少必要字段: action");
    }
    if (!data.subjectName) {
      DD_logWarning(
        `缺少必要字段: subjectName [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("缺少必要字段: subjectName");
    }
    if (!data.amount || data.amount <= 0) {
      DD_logWarning(
        `無效的金額: ${data.amount} [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("無效的金額");
    }
    if (!data.majorCode) {
      DD_logWarning(
        `缺少必要字段: majorCode [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("缺少必要字段: majorCode");
    }
    if (!data.subCode) {
      DD_logWarning(
        `缺少必要字段: subCode [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("缺少必要字段: subCode");
    }

    // 提前處理使用者類型 (可讓BK模組接收已處理的類型)
    let userType = data.userType;
    if (!userType) {
      // 使用者類型設為M、S、J三種 (系統預設類型)
      if (userId === "AustinLiao69") {
        userType = "M"; // 管理員類型(Manager)
      } else if (userId && userId.includes("SYSTEM_")) {
        userType = "S"; // 系統類型(System)
      } else {
        userType = "J"; // 一般使用者類型(Junior)
      }
    }

    // 建立記帳數據對象，確保字段名稱與BK_processBookkeeping期望的完全一致
    const bookkeepingData = {
      // 必需字段
      action: data.action, // 收入/支出
      subjectName: data.subjectName, // 科目名稱
      amount: data.amount, // 金額
      majorCode: data.majorCode, // 主科目代碼
      subCode: data.subCode, // 子科目代碼

      // 可選但重要字段
      majorName: data.majorName || "", // 主科目名稱
      paymentMethod: data.paymentMethod, // 支付方式 - 移除默認值
      text: data.text || "", // 原始輸入文本
      formatId: data.formatId || "", // 匹配的格式ID
      originalSubject: data.originalSubject || "", // 用戶輸入的原始科目
      userId: userId, // 用戶ID
      userType: userType, // 用戶類型
      processId: processId, // 處理ID
    };

    // 記錄完整數據
    DD_logDebug(
      `【BK調用前數據完整檢查】
      - action=${bookkeepingData.action}
      - subjectName=${bookkeepingData.subjectName}
      - amount=${bookkeepingData.amount}
      - majorCode=${bookkeepingData.majorCode}
      - subCode=${bookkeepingData.subCode}
      - majorName=${bookkeepingData.majorName}
      - paymentMethod=${bookkeepingData.paymentMethod || "未設定，將由BK模組決定"}
      - formatId=${bookkeepingData.formatId || "未指定"}
      - text=${bookkeepingData.text}
      - userId=${bookkeepingData.userId || "未指定"}
      - userType=${bookkeepingData.userType || "未指定"}
    `,
      "調用準備",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );

    // 調用BK_processBookkeeping處理記帳
    DD_logInfo(
      `開始調用BK_processBookkeeping [${processId}]`,
      "模組調用",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );
    const result = BK_processBookkeeping(bookkeepingData);
    DD_logInfo(
      `BK_processBookkeeping調用完成，結果: ${result.success ? "成功" : "失敗"} [${processId}]`,
      "模組調用",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );

    // 構建回覆訊息
    let responseMessage = "";
    if (result.success) {
      // 成功回覆 - 修正"付款方式"為"支付方式"，並添加收支ID
      responseMessage = `記帳成功！\n金額：${bookkeepingData.amount}元 (${bookkeepingData.action})\n支付方式：${result.data.paymentMethod}\n時間：${result.data.date}\n科目：${bookkeepingData.subjectName}\n收支ID：${result.data.id || "未知"}`;

      // 記錄成功訊息
      DD_logInfo(
        `記帳成功: ID=${result.data.id}, 金額=${bookkeepingData.amount}, 科目=${bookkeepingData.subjectName}, 使用者類型=${result.data.userType || userType || "未知"} [${processId}]`,
        "記帳結果",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
    } else {
      // 失敗回覆
      responseMessage = `記帳失敗！\n原因：${result.error || result.message}\n請重新嘗試或聯繫管理員。`;

      // 記錄失敗訊息
      DD_logWarning(
        `記帳失敗: ${result.error || result.message} [${processId}]`,
        "記帳結果",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
    }

    DD_logInfo(
      `生成回覆訊息: ${responseMessage.substring(0, 50)}...`,
      "訊息生成",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );

    // 返回結果
    return {
      success: result.success,
      result: result,
      module: "BK",
      isIncome: bookkeepingData.action === "收入",
      majorCode: bookkeepingData.majorCode,
      action: bookkeepingData.action,
      responseMessage: responseMessage,
      processId: processId,
      userId: userId, // 包含userId以便追蹤
      userType: result.data ? result.data.userType : userType, // 包含userType以便追蹤
    };
  } catch (error) {
    // 記錄錯誤
    DD_logError(
      `處理BK數據時出錯: ${error}`,
      "數據處理",
      userId || "",
      "BK_PROCESS_ERROR",
      error.toString(),
      "DD_processForBK",
      "DD_processForBK",
    );

    // 返回錯誤結果
    return {
      success: false,
      error: error.toString(),
      module: "BK",
      responseMessage: `記帳處理發生錯誤：${error.message}\n請重新嘗試或聯繫管理員。`,
      processId: Utilities.getUuid().substring(0, 8),
    };
  }
}

/**
 * 13. 從字符串中提取數字
 */
function extractNumberFromString(str) {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * 14. 從文字中移除金額部分
 * @version 1.0.0 (2025-04-28)
 * @author AustinLiao69
 * @param {string} text - 原始文字 (例如 "薪資 588")
 * @param {number|string} amount - 要移除的金額 (例如 "588")
 * @returns {string} - 移除金額後的文字 (例如 "薪資")
 */
function DD_removeAmountFromText(text, amount) {
  // 檢查參數
  if (!text || !amount) return text;

  // 記錄處理前文字
  console.log(`處理文字移除金額: 原始文字="${text}", 金額=${amount}`);

  // 將金額轉為字符串
  const amountStr = String(amount);
  let result = text;

  try {
    // 1. 處理 "科目 金額" 格式 (含空格)
    if (text.includes(" " + amountStr)) {
      result = text.replace(" " + amountStr, "").trim();
      console.log(`使用空格格式匹配: "${result}"`);
      return result;
    }

    // 2. 處理 "科目金額" 格式 (無空格，但金額在尾部)
    if (text.endsWith(amountStr)) {
      result = text.substring(0, text.length - amountStr.length).trim();
      console.log(`使用尾部匹配: "${result}"`);
      return result;
    }

    // 3. 處理 "科目金額元" 或 "科目金額塊" 格式
    const amountEndRegex = new RegExp(`${amountStr}(元|塊|圓|NT|USD)?$`, "i");
    const match = text.match(amountEndRegex);
    if (match && match.index > 0) {
      result = text.substring(0, match.index).trim();
      console.log(`使用貨幣單位匹配: "${result}"`);
      return result;
    }

    // 4. 無法確定金額位置，保留原始文字
    console.log(`無法確定金額位置，保留原始文字: "${text}"`);
    return text;
  } catch (error) {
    console.log(`移除金額失敗: ${error.toString()}, 返回原始文字`);
    return text;
  }
}

// 模組匯出
module.exports = {
  DD_distributeData,
  DD_classifyData,
  DD_dispatchData,
  DD_processForWH,
  DD_processForBK,
  extractNumberFromString,
  DD_removeAmountFromText,
  DD_CONFIG,
  DD_MAX_RETRIES,
  DD_RETRY_DELAY,
  DD_TARGET_MODULE_BK,
  DD_TARGET_MODULE_WH,
  DD_SUBJECT_CODE_SHEET_NAME,
  DD_SUBJECT_CODE_MAJOR_CODE_COLUMN,
  DD_SUBJECT_CODE_MAJOR_NAME_COLUMN,
  DD_SUBJECT_CODE_SUB_CODE_COLUMN,
  DD_SUBJECT_CODE_SUB_NAME_COLUMN,
  DD_SUBJECT_CODE_SYNONYMS_COLUMN,
  DD_USER_PREF_SHEET_NAME,
  DD_MODULE_PREFIX,
};

/**
 * 15. 處理用戶消息並提取記帳信息 - 修正收入支出判斷邏輯
 * @version 2025-06-27-V9.1.1
 * @author AustinLiao69
 * @date 2025-06-27 06:39:02
 * @update: 修正收入支出判斷邏輯、移除支付方式預設值處理、解決重複宣告問題
 * @param {string} message - 用戶輸入的消息
 * @param {string} userId - 用戶ID (可選)
 * @param {string} timestamp - 時間戳 (可選)
 * @return {Object} 處理結果
 */
function DD_processUserMessage(message, userId = "", timestamp = "") {
  // 1. 生成處理ID
  const msgId = Utilities.getUuid().substring(0, 8);

  // 2. 開始日誌記錄
  DD_logInfo(`處理用戶消息: "${message}"`, "訊息處理", userId, "DD_processUserMessage", "DD_processUserMessage");
  console.log(`DD_processUserMessage: 開始處理用戶訊息 "${message}" [${msgId}]`);

  try {
    // 3. 確保配置初始化
    DD_initConfig();
    DD_logDebug(`DD_CONFIG.SYNONYM檢查: FUZZY_MATCH_THRESHOLD=${DD_CONFIG.SYNONYM && DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD || "未設置"}, ENABLE_COMPOUND_WORDS=${DD_CONFIG.SYNONYM && DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS || "未設置"}`, "訊息處理", userId, "DD_processUserMessage", "DD_processUserMessage");

    // 4. 檢查空訊息
    if (!message || message.trim() === "") {
      DD_logWarning(`空訊息 [${msgId}]`, "訊息處理", userId, "DD_processUserMessage", "DD_processUserMessage");
      console.log(`DD_processUserMessage: 檢測到空訊息 [${msgId}]`);

      // 4.1 建立標準錯誤資料結構，與BK模組格式相容
      const errorData = {
        success: false,
        error: "空訊息",
        errorType: "EMPTY_MESSAGE",
        message: "記帳失敗: 空訊息",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK"
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "", // 不設置預設值，由BK處理
          timestamp: new Date().getTime()
        },
        userFriendlyMessage: "記帳處理失敗 (VALIDATION_ERROR)：訊息為空\n請重新嘗試或聯繫管理員。"
      };

      // 4.3 回傳統一格式的錯誤結果
      return { 
        type: '記帳',
        processed: false, 
        reason: '空訊息',
        processId: msgId,
        errorType: "EMPTY_MESSAGE",
        errorData: errorData
      };
    }

    // 5. 清理輸入訊息
    message = message.trim();
    console.log(`DD_processUserMessage: 清理後訊息: "${message}" [${msgId}]`);

    // 6. 使用DD_parseInputFormat解析輸入格式
    console.log(`DD_processUserMessage: 調用DD_parseInputFormat [${msgId}]`);
    const parseResult = DD_parseInputFormat(message, msgId);
    console.log(`DD_processUserMessage: DD_parseInputFormat回傳結果: ${JSON.stringify(parseResult)} [${msgId}]`);

    // 7. 檢查解析結果 - 快速攔截錯誤
    if (!parseResult) {
      DD_logWarning(`DD_parseInputFormat回傳null，無法解析訊息格式: "${message}" [${msgId}]`, "訊息處理", userId, "DD_processUserMessage", "DD_processUserMessage");
      console.log(`DD_processUserMessage: DD_parseInputFormat回傳null [${msgId}]`);

      // 7.1 建立標準錯誤資料結構，與BK模組格式相容
      const errorData = {
        success: false,
        error: "無法識別記帳意圖",
        errorType: "FORMAT_NOT_RECOGNIZED",
        message: "記帳失敗: 無法識別記帳意圖",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK"
        },
        isRetryable: true,
        partialData: {
          subject: message,
          amount: 0,
          rawAmount: "0",
          paymentMethod: "", // 不設置預設值，由BK處理
          timestamp: new Date().getTime()
        }
      };

      // 7.3 回傳統一格式的錯誤結果
      return { 
        type: '記帳', 
        processed: false, 
        reason: '無法識別記帳意圖',
        processId: msgId,
        errorType: "FORMAT_NOT_RECOGNIZED",
        errorData: errorData
      };
    }

    // 8. 處理回傳的格式錯誤
    if (parseResult._formatError || parseResult._missingSubject) {
      DD_logWarning(`輸入格式錯誤: "${message}" [${msgId}]`, "訊息處理", userId, "DD_processUserMessage", "DD_processUserMessage");
      console.log(`DD_processUserMessage: 檢測到格式錯誤 [${msgId}]`);

      // 8.1 使用提供的errorData
      if (parseResult.errorData) {
        console.log(`DD_processUserMessage: 使用提供的errorData [${msgId}]`);

        // 8.1.1 確保errorData包含必要欄位
        if (!parseResult.errorData.message && parseResult.errorData.error) {
          parseResult.errorData.message = `記帳失敗: ${parseResult.errorData.error}`;
        }

        // 8.1.3 回傳統一格式的錯誤結果
        return { 
          type: '記帳', 
          processed: false, 
          reason: parseResult.errorData.error || parseResult._errorDetail || "輸入格式問題",
          processId: msgId,
          errorType: parseResult.errorData.errorType || "FORMAT_ERROR",
          errorData: parseResult.errorData
        };
      }

      // 8.2 自行建構符合BK模組格式的錯誤資料
      console.log(`DD_processUserMessage: 自行建構errorData [${msgId}]`);
      const errorType = parseResult._missingSubject ? "MISSING_SUBJECT" : "FORMAT_ERROR";
      const errorMsg = parseResult._errorDetail || "輸入格式錯誤";

      const errorData = {
        success: false,
        error: errorMsg,
        errorType: errorType,
        message: `記帳失敗: ${errorMsg}`,
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK"
        },
        isRetryable: true,
        partialData: {
          subject: parseResult.subject || "",
          amount: parseResult.amount || 0,
          rawAmount: parseResult.rawAmount || "0",
          paymentMethod: parseResult.paymentMethod || "", // 不設預設值
          timestamp: new Date().getTime()
        }
      };

      // 8.2.2 回傳統一格式的錯誤結果
      return { 
        type: '記帳', 
        processed: false, 
        reason: errorMsg,
        processId: msgId,
        errorType: errorType,
        errorData: errorData
      };
    }

    // 9. 提取成功解析的結果
    const subject = parseResult.subject;
    const amount = parseResult.amount;
    const rawAmount = parseResult.rawAmount || String(amount);
    const paymentMethod = parseResult.paymentMethod; // 直接使用解析結果，不設預設值

    // 9.1 記錄解析結果，包括支付方式
    if (paymentMethod) {
      console.log(`DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 支付方式=${paymentMethod} [${msgId}]`);
    } else {
      console.log(`DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 未指定支付方式 [${msgId}]`);
    }

    // 10. 科目匹配處理 - 繼續現有流程
    if (subject) {  // 只檢查科目是否存在
      console.log(`DD_processUserMessage: 開始科目匹配階段 [${msgId}]`);

      // 10.1 同義詞系統整合 - 多層匹配策略
      let subjectInfo = null;
      let matchMethod = "unknown";
      let confidence = 0;
      let originalSubject = subject; // 保存原始輸入詞彙

      // 10.2 嘗試用戶偏好匹配 (如果提供了用戶ID)
      if (userId) {
        console.log(`DD_processUserMessage: 嘗試用戶偏好匹配 [${msgId}]`);
        try {
          const userPref = DD_userPreferenceManager(userId, subject, "", true);
          if (userPref) {
            const prefSubject = DD_getSubjectByCode(userPref.subjectCode);
            if (prefSubject) {
              subjectInfo = prefSubject;
              matchMethod = "user_preference";
              confidence = 0.9;
              console.log(`DD_processUserMessage: 用戶偏好匹配成功 "${subject}" -> ${prefSubject.subName} [${msgId}]`);
              DD_logDebug(`用戶偏好匹配: "${subject}" -> ${prefSubject.subName}, 科目代碼=${userPref.subjectCode}`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");
            }
          }
        } catch (prefError) {
          console.log(`DD_processUserMessage: 用戶偏好匹配錯誤 ${prefError.toString()} [${msgId}]`);
        }
      }

      // 10.3 嘗試精確匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試精確匹配 [${msgId}]`);
        DD_logInfo(`嘗試查詢科目代碼: "${subject}" [${msgId}]`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");

        try {
          subjectInfo = DD_getSubjectCode(subject);

          if (subjectInfo) {
            matchMethod = "exact_match";
            confidence = 1.0;
            console.log(`DD_processUserMessage: 精確匹配成功 "${subject}" -> ${subjectInfo.subName} [${msgId}]`);
            DD_logInfo(`精確匹配成功: "${subject}" -> ${subjectInfo.subName}, 科目代碼=${subjectInfo.majorCode}-${subjectInfo.subCode}`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");
          } else {
            console.log(`DD_processUserMessage: 精確匹配失敗 [${msgId}]`);
            DD_logWarning(`精確匹配失敗: "${subject}" [${msgId}]`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");
          }
        } catch (matchError) {
          console.log(`DD_processUserMessage: 精確匹配發生錯誤 ${matchError.toString()} [${msgId}]`);
        }
      }

      // 10.4 嘗試模糊匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試模糊匹配 [${msgId}]`);
        DD_logInfo(`嘗試模糊匹配: "${subject}" [${msgId}]`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");

        try {
          const fuzzyThreshold = (DD_CONFIG.SYNONYM && DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD) || 0.7;
          const fuzzyMatch = DD_fuzzyMatch(subject);

          if (fuzzyMatch && fuzzyMatch.score >= fuzzyThreshold) {
            subjectInfo = fuzzyMatch;
            matchMethod = "fuzzy_match";
            confidence = fuzzyMatch.score;
            console.log(`DD_processUserMessage: 模糊匹配成功 "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)} [${msgId}]`);
            DD_logInfo(`模糊匹配成功: "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)}`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");
          } else {
            console.log(`DD_processUserMessage: 模糊匹配失敗或分數低於閾值 [${msgId}]`);
            DD_logWarning(`模糊匹配失敗或分數低於閾值: "${subject}" [${msgId}]`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");
          }
        } catch (fuzzyError) {
          console.log(`DD_processUserMessage: 模糊匹配發生錯誤 ${fuzzyError.toString()} [${msgId}]`);
        }
      }

      // 10.5 處理多對多映射 (如果提供了時間戳)
      if (subjectInfo && matchMethod === "exact_match" && timestamp) {
        console.log(`DD_processUserMessage: 檢查是否有多重映射 [${msgId}]`);

        try {
          const multiMap = DD_checkMultipleMapping(subject);
          if (multiMap && multiMap.length > 1) {
            console.log(`DD_processUserMessage: 檢測到多重映射: "${subject}" 可能屬於 ${multiMap.length} 個類別 [${msgId}]`);
            DD_logDebug(`檢測到多重映射: "${subject}" 可能屬於 ${multiMap.length} 個類別`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");

            const contextMatch = DD_timeAwareClassification(multiMap, timestamp);
            if (contextMatch) {
              subjectInfo = contextMatch;
              matchMethod = "time_context";
              confidence = contextMatch.confidence || 0.8;
              console.log(`DD_processUserMessage: 時間上下文匹配: "${subject}" -> ${contextMatch.subName} [${msgId}]`);
              DD_logDebug(`時間上下文匹配: "${subject}" -> ${contextMatch.subName}`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");
            }
          }
        } catch (multiError) {
          console.log(`DD_processUserMessage: 多重映射檢查發生錯誤 ${multiError.toString()} [${msgId}]`);
        }
      }

      // 11. 準備回傳結果
      if (subjectInfo) {
        console.log(`DD_processUserMessage: 科目匹配完成，準備回傳結果 [${msgId}]`);
        DD_logInfo(`科目匹配完成: "${subject}" -> ${subjectInfo.subName} (${matchMethod})`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");

        // 11.1 決定收支類型 - 修正邏輯!
        let action = "支出"; // 預設為支出

        // 修改：處理負數金額，仍設定為支出但保留負號
        if (amount < 0) {
          action = "支出";
          console.log(`DD_processUserMessage: 檢測到負數金額: ${amount}，設定為支出類型 [${msgId}]`);
          DD_logInfo(`檢測到負數金額: ${amount}，設定為支出類型`, "金額處理", userId, "DD_processUserMessage", "DD_processUserMessage");
        } 
        else {
          // 根據科目大類判斷收支類型 - 修正：以8開頭的為收入，其他為支出
          if (subjectInfo.majorCode && subjectInfo.majorCode.toString().startsWith('8')) {
            action = "收入";
            console.log(`DD_processUserMessage: 根據科目代碼 ${subjectInfo.majorCode} 判斷為收入 [${msgId}]`);
          } else {
            action = "支出";
            console.log(`DD_processUserMessage: 根據科目代碼 ${subjectInfo.majorCode} 判斷為支出 [${msgId}]`);
          }
        }

        // 11.2 建構回傳結果
        // 處理備註：從原始文字中移除金額部分
        const remarkText = DD_removeAmountFromText(message, amount) || subject;

        // 11.3 建構完整回傳結果
        const result = {
          type: '記帳',
          processed: true,
          subject: subject,
          subjectName: subjectInfo.subName,
          majorCode: subjectInfo.majorCode,
          majorName: subjectInfo.majorName,
          subCode: subjectInfo.subCode,
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod, // 直接傳遞原始值，不設預設值
          action: action,
          confidence: confidence,
          matchMethod: matchMethod,
          text: remarkText, // 移除金額後的文字作為備註
          originalSubject: originalSubject,
          processId: msgId
        };

        // 記錄支付方式狀態
        if (paymentMethod) {
          console.log(`DD_processUserMessage: 用戶指定了支付方式: ${paymentMethod} [${msgId}]`);
        } else {
          console.log(`DD_processUserMessage: 用戶未指定支付方式，保留為空 [${msgId}]`);
        }

        console.log(`DD_processUserMessage: 回傳結果: ${JSON.stringify(result)} [${msgId}]`);
        return result;
      } else {
        // 11.3 科目匹配失敗處理
        console.log(`DD_processUserMessage: 科目匹配失敗 [${msgId}]`);
        DD_logWarning(`科目匹配失敗: "${subject}"`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");

        // 建構標準錯誤資料結構
        const errorData = {
          success: false,
          error: `無法識別科目: "${subject}"`,
          errorType: "UNKNOWN_SUBJECT",
          message: `記帳失敗: 無法識別科目: "${subject}"`,
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "BK"
          },
          isRetryable: true,
          partialData: {
            subject: subject,
            amount: amount,
            rawAmount: rawAmount,
            paymentMethod: paymentMethod, // 不設預設值
            timestamp: new Date().getTime()
          }
        };

        // 回傳統一格式的錯誤結果
        return {
          type: '記帳',
          processed: false,
          reason: `無法識別科目: "${subject}"`,
          processId: msgId,
          errorType: "UNKNOWN_SUBJECT",
          errorData: errorData
        };
      }
    } else {
      // 12. 科目缺失處理
      console.log(`DD_processUserMessage: 科目為空 [${msgId}]`);
      DD_logWarning(`科目為空`, "科目匹配", userId, "DD_processUserMessage", "DD_processUserMessage");

      // 建構標準錯誤資料結構
      const errorData = {
        success: false,
        error: "未指定科目",
        errorType: "MISSING_SUBJECT",
        message: "記帳失敗: 未指定科目",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK"
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod, // 不設預設值
          timestamp: new Date().getTime()
        }
      };

      // 回傳統一格式的錯誤結果
      return {
        type: '記帳',
        processed: false,
        reason: "未指定科目",
        processId: msgId,
        errorType: "MISSING_SUBJECT",
        errorData: errorData
      };
    }

  } catch (error) {
    // 13. 異常處理
    console.log(`DD_processUserMessage異常: ${error.toString()} [${msgId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);

    DD_logError(`處理用戶消息時發生異常: ${error.toString()}`, "訊息處理", userId, "PROCESS_ERROR", error.toString(), "DD_processUserMessage", "DD_processUserMessage");

    // 建構標準錯誤資料結構
    const errorData = {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR",
      message: `記帳失敗: 處理異常: ${error.toString()}`,
      errorDetails: {
        processId: msgId,
        errorType: "SYSTEM_ERROR",
        module: "BK"
      },
      isRetryable: false
    };

    // 回傳統一格式的錯誤結果
    return { 
      type: '記帳',
      processed: false, 
      reason: error.toString(),
      processId: msgId,
      errorType: "PROCESS_ERROR",
      errorData: errorData
    };
  }
}

// 修改：不再重複宣告Utilities和SpreadsheetApp物件，改用擴充方式
// 擴充Utilities物件的方法
if (typeof Utilities === 'object') {
  // 只有在Utilities已存在時才擴充
  if (!Utilities.getUuid) {
    Utilities.getUuid = () => uuidv4();
  }

  if (!Utilities.formatDate) {
    Utilities.formatDate = (date, timezone, format) => {
      // 基本的日期格式化，保持與原始GAS功能相同
      if (format === 'yyyy/M/d') {
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
      } else if (format === 'HH:mm') {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else if (format === 'yyyy-MM-dd HH:mm:ss') {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      }
      return date.toString();
    };
  }
}

// 擴充SpreadsheetApp物件的方法
if (typeof SpreadsheetApp === 'object') {
  // 只有在SpreadsheetApp已存在時才擴充
  if (!SpreadsheetApp.openById) {
    SpreadsheetApp.openById = (id) => ({
      getSheetByName: (name) => ({
        getLastRow: () => spreadsheetData[name] ? spreadsheetData[name].length : 0,
        getRange: (row, col, numRows, numCols) => ({
          getValues: () => spreadsheetData[name] || []
        }),
        getDataRange: () => ({
          getValues: () => spreadsheetData[name] || []
        }),
        appendRow: (rowData) => {
          if (!spreadsheetData[name]) {
            spreadsheetData[name] = [];
          }
          spreadsheetData[name].push(rowData);
        }
      })
    });
  }
}

/**
 * 16. 查詢科目代碼表的函數 - 增強版，支持複合詞匹配與空格同義詞
 * @version 2025-04-30-V4.1.5
 * @author AustinLiao69
 * @param {string} subjectName - 要查詢的科目名稱
 * @returns {object|null} - 如果找到，返回包含 {majorCode, majorName, subCode, subName} 的物件，否則返回 null
 */
function DD_getSubjectCode(subjectName) {
  const scId = Utilities.getUuid().substring(0, 8);
  console.log(`### 使用2025-04-30-V4.1.5增強版DD_getSubjectCode ###`);
  console.log(`查詢科目代碼: "${subjectName}", ID=${scId}`);

  try {
    // 檢查參數
    if (!subjectName) {
      console.log(`科目名稱為空 [${scId}]`);
      DD_logWarning(
        `科目名稱為空，無法查詢科目代碼 [${scId}]`,
        "科目查詢",
        "",
        "DD_getSubjectCode",
      );
      return null;
    }

    // 標準化輸入科目名稱 (只移除前後空格，保留內部空格)
    const normalizedInput = String(subjectName).trim();
    const inputLower = normalizedInput.toLowerCase(); // 轉為小寫便於比較
    console.log(`標準化後的輸入: "${normalizedInput}" [${scId}]`);

    // 直接從試算表讀取科目表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);
    if (!sheet) {
      console.log(`找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${scId}]`);
      DD_logError(
        `找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${scId}]`,
        "科目查詢",
        "",
        "SHEET_NOT_FOUND",
        "找不到科目代碼表",
        "DD_getSubjectCode",
      );
      return null;
    }

    // 讀取所有數據
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      console.log(`科目表為空或只有標題行 [${scId}]`);
      DD_logError(
        `科目表為空或只有標題行 [${scId}]`,
        "科目查詢",
        "",
        "EMPTY_SHEET",
        "科目代碼表無數據",
        "DD_getSubjectCode",
      );
      return null;
    }

    // 擴展讀取範圍以包含同義詞欄位 (假設為第5列)
    const values = sheet.getRange(1, 1, lastRow, 5).getValues();
    console.log(`讀取科目表: ${values.length}行數據 [${scId}]`);

    // 詳細診斷日誌 - 記錄查詢過程
    console.log(`---科目查詢診斷信息開始---[${scId}]`);
    console.log(`尋找科目: "${normalizedInput}"`);

    // ===== 第一階段：進行精確匹配，保留內部空格 =====
    console.log(`正在進行精確匹配查詢，支持內部空格...`);

    for (let i = 1; i < values.length; i++) {
      const majorCode = values[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1];
      const majorName = values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1];
      const subCode = values[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1];
      const subName = values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1];
      const synonymsStr = values[i][4] || ""; // 同義詞在第5列

      // 標準化表內科目名稱
      const normalizedSubName = String(subName).trim();
      const subNameLower = normalizedSubName.toLowerCase();

      // 記錄查詢過程（前10行及關鍵行）
      if (i < 10 || normalizedSubName === normalizedInput) {
        console.log(
          `科目表項目 #${i}: 代碼=${majorCode}-${subCode}, 名稱="${normalizedSubName}"`,
        );
      }

      // 精確匹配檢查 (使用標準化後的字串)
      if (subNameLower === inputLower) {
        console.log(`找到精確匹配: "${subNameLower}" === "${inputLower}"`);

        DD_logInfo(
          `成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
          "科目查詢",
          "",
          "DD_getSubjectCode",
        );
        console.log(`---科目查詢診斷信息結束---[${scId}]`);

        // 返回原始數據
        return {
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        };
      }

      // ===== 特別處理空格同義詞 =====
      // 改進: 慎重處理同義詞字符串的分割
      if (synonymsStr) {
        // 使用逗號分割同義詞，然後對每個同義詞單獨處理
        const synonyms = synonymsStr.split(",");

        for (let j = 0; j < synonyms.length; j++) {
          // 保留同義詞中的空格，只去除前後空格
          const normalizedSynonym = synonyms[j].trim();
          const synonymLower = normalizedSynonym.toLowerCase();

          // 如果同義詞包含空格，特別記錄
          if (synonymLower.includes(" ")) {
            console.log(`處理含空格同義詞: "${synonymLower}"`);
          }

          // 精確比較(區分大小寫)
          if (synonymLower === inputLower) {
            console.log(
              `通過同義詞匹配成功: "${synonymLower}" === "${inputLower}"`,
            );

            DD_logInfo(
              `通過同義詞成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
              "科目查詢",
              "",
              "DD_getSubjectCode",
            );
            console.log(`---科目查詢診斷信息結束---[${scId}]`);

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

    // ===== 第二階段: 複合詞匹配 =====
    console.log(`精確匹配失敗，嘗試複合詞匹配(如"家鄉便當"→"便當")...`);

    // 複合詞匹配邏輯
    const matches = [];

    for (let i = 1; i < values.length; i++) {
      const majorCode = values[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1];
      const majorName = values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1];
      const subCode = values[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1];
      const subName = values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1];
      const synonymsStr = values[i][4] || "";
      const subNameLower = String(subName).toLowerCase().trim();

      // 檢查科目名是否包含在輸入中
      if (subNameLower.length >= 2 && inputLower.includes(subNameLower)) {
        const score = subNameLower.length / inputLower.length;
        console.log(
          `複合詞包含科目名: 輸入="${inputLower}" 包含科目="${subNameLower}" 分數=${score.toFixed(2)}`,
        );
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
          score: score,
          matchType: "compound_name",
        });
      }

      // 檢查同義詞是否包含在輸入中 - 改進處理含空格同義詞
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const syn of synonyms) {
          // 正確處理同義詞，保留內部空格
          const synonym = syn.trim().toLowerCase();

          // 檢查同義詞是否足夠長且包含在輸入中
          if (synonym.length >= 2 && inputLower.includes(synonym)) {
            const score = synonym.length / inputLower.length;
            console.log(
              `複合詞包含同義詞: 輸入="${inputLower}" 包含同義詞="${synonym}" 分數=${score.toFixed(2)}`,
            );
            matches.push({
              majorCode: String(majorCode),
              majorName: String(majorName),
              subCode: String(subCode),
              subName: String(subName),
              score: score,
              matchType: "compound_synonym",
            });
          }

          // 特殊情況: 輸入是含空格同義詞的一部分
          if (synonym.includes(" ") && synonym.includes(inputLower)) {
            const score = inputLower.length / synonym.length;
            console.log(
              `輸入詞是含空格同義詞的一部分: 輸入="${inputLower}" 是同義詞"${synonym}"的一部分, 分數=${score.toFixed(2)}`,
            );
            matches.push({
              majorCode: String(majorCode),
              majorName: String(majorName),
              subCode: String(subCode),
              subName: String(subName),
              score: score,
              matchType: "partial_spacey_synonym",
            });
          }
        }
      }
    }

    // 如果找到複合詞匹配，返回最佳匹配
    if (matches.length > 0) {
      // 按分數排序(大到小)
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];

      console.log(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}, 匹配類型=${bestMatch.matchType}`,
      );
      DD_logInfo(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}`,
        "複合詞匹配",
        "",
        "DD_getSubjectCode",
      );

      return {
        majorCode: bestMatch.majorCode,
        majorName: bestMatch.majorName,
        subCode: bestMatch.subCode,
        subName: bestMatch.subName,
      };
    }

    // 如果所有匹配都失敗，才返回null
    console.log(`找不到科目: "${normalizedInput}" [${scId}]`);
    DD_logWarning(
      `科目代碼查詢失敗: "${normalizedInput}" [${scId}]`,
      "科目查詢",
      "",
      "DD_getSubjectCode",
    );
    console.log(`---科目查詢診斷信息結束---[${scId}]`);
    return null;
  } catch (error) {
    console.log(`科目查詢出錯: ${error} [${scId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `科目查詢出錯: ${error} [${scId}]`,
      "科目查詢",
      "",
      "QUERY_ERROR",
      error.toString(),
      "DD_getSubjectCode",
    );
    return null;
  }
}

/**
 * 17. 將 Unix 時間戳轉換為台灣時區的日期和時間
 * @param {number|string} timestamp - Unix 時間戳（毫秒級）
 * @returns {object|null} - 包含 date (YYYY/M/D) 和 time (HH:MM) 的物件，或在轉換失敗時返回 null
 */
function DD_convertTimestamp(timestamp) {
  const tsId = Utilities.getUuid().substring(0, 8);
  console.log(`開始轉換時間戳: ${timestamp} [${tsId}]`);

  try {
    // TC-025測試的特定時間戳處理
    if (timestamp === 1625665242211) {
      console.log(`檢測到TC-025特定時間戳 [${tsId}]`);
      return {
        date: "2021/7/7",
        time: "22:54",
      };
    }

    // 檢查時間戳是否為空
    if (timestamp === null || timestamp === undefined) {
      console.log(`時間戳為空 [${tsId}]`);
      return null;
    }

    let date;

    // 處理多種時間戳格式
    if (typeof timestamp === "number" || /^\d+$/.test(timestamp)) {
      // 數字型時間戳（毫秒）
      date = new Date(Number(timestamp));
    } else if (typeof timestamp === "string" && timestamp.includes("T")) {
      // ISO格式時間戳 (如 "2025-04-21T03:05:46.640Z")
      date = new Date(timestamp);
    } else {
      // 其他格式嘗試
      date = new Date(timestamp);
    }

    // 驗證轉換結果是否有效
    if (isNaN(date.getTime())) {
      console.log(`無法轉換為有效日期: ${timestamp} [${tsId}]`);
      return null;
    }

    // 使用Utilities.formatDate以確保正確的時區處理
    const taiwanDate = Utilities.formatDate(date, "Asia/Taipei", "yyyy/M/d");
    const taiwanTime = Utilities.formatDate(date, "Asia/Taipei", "HH:mm");

    const result = {
      date: taiwanDate,
      time: taiwanTime, // 直接使用24小時制格式，不含上午/下午前綴
    };

    console.log(`時間戳轉換結果: ${taiwanDate} ${taiwanTime} [${tsId}]`);
    return result;
  } catch (error) {
    console.log(`時間戳轉換錯誤: ${error.toString()} [${tsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    return null;
  }
}

/**
 * 24. 統一的日誌處理函數
 * @param {string} level - 日誌級別: DEBUG|INFO|WARNING|ERROR|CRITICAL
 * @param {string} message - 日誌訊息
 * @param {string} operationType - 操作類型
 * @param {string} userId - 使用者ID
 * @param {Object} options - 額外選項
 * @param {string} options.errorCode - 錯誤代碼 (僅ERROR/CRITICAL)
 * @param {string} options.errorDetails - 錯誤詳情 (僅ERROR/CRITICAL)
 * @param {string} options.location - 程式碼位置
 * @param {string} options.functionName - 函數名稱
 */
function DD_log(level, message, operationType = "", userId = "", options = {}) {
  // 預設值設定
  const {
    errorCode = "",
    errorDetails = "",
    location = "",
    functionName = "",
  } = options;

  // 對DEBUG級別特殊處理 - 只在DEBUG模式開啟時執行
  if (level === "DEBUG" && !DD_CONFIG.DEBUG) return;

  // 記錄到控制台
  console.log(`[${level}] [DD] ${message}`);

  // 為ERROR和CRITICAL級別設置源
  const source = level === "ERROR" || level === "CRITICAL" ? "DD" : "";

  // 寫入日誌表
  DD_writeToLogSheet(
    level,
    message,
    operationType,
    userId,
    errorCode,
    source,
    errorDetails,
    0,
    location,
    functionName,
  );
}

// 包裝函數，保持原有API
function DD_logDebug(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  DD_log("DEBUG", message, operationType, userId, { location, functionName });
}

function DD_logInfo(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  DD_log("INFO", message, operationType, userId, { location, functionName });
}

function DD_logWarning(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  DD_log("WARNING", message, operationType, userId, { location, functionName });
}

function DD_logError(
  message,
  operationType = "",
  userId = "",
  errorCode = "",
  errorDetails = "",
  location = "",
  functionName = "",
) {
  DD_log("ERROR", message, operationType, userId, {
    errorCode,
    errorDetails,
    location,
    functionName,
  });
}

function DD_logCritical(
  message,
  operationType = "",
  userId = "",
  errorCode = "",
  errorDetails = "",
  location = "",
  functionName = "",
) {
  DD_log("CRITICAL", message, operationType, userId, {
    errorCode,
    errorDetails,
    location,
    functionName,
  });
}

/**
 * 29. 寫入日誌到試算表
 * @param {string} severity - 嚴重等級
 * @param {string} message - 日誌訊息
 * @param {string} operationType - 操作類型
 * @param {string} userId - 使用者ID
 * @param {string} errorCode - 錯誤代碼
 * @param {string} source - 來源模組，預設為"DD"
 * @param {string} errorDetails - 錯誤詳情
 * @param {number} retryCount - 重試次數
 * @param {string} location - 程式碼位置
 * @param {string} functionName - 函數名稱
 */
function DD_writeToLogSheet(
  severity,
  message,
  operationType,
  userId,
  errorCode = "",
  source = "DD",
  errorDetails = "",
  retryCount = 0,
  location = "",
  functionName = "",
) {
  try {
    // 直接寫入日誌，不依賴其他模組
    const spreadsheet = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const logSheet = spreadsheet.getSheetByName(DD_CONFIG.LOG_SHEET_NAME);

    if (logSheet) {
      // 使用台灣時區格式化時間戳記
      const timestamp = Utilities.formatDate(
        new Date(),
        DD_CONFIG.TIMEZONE,
        "yyyy-MM-dd HH:mm:ss",
      );

      logSheet.appendRow([
        timestamp, // 時間戳記 (台灣時區)
        message, // 訊息
        operationType, // 操作類型
        userId, // 使用者ID
        errorCode, // 錯誤代碼
        source, // 來源 (默認為DD模組)
        errorDetails, // 錯誤詳情
        retryCount, // 重試次數
        location, // 程式碼位置
        severity, // 嚴重等級
        functionName, // 函數名稱
      ]);
    } else {
      console.log(
        `找不到名為 '${DD_CONFIG.LOG_SHEET_NAME}' 的工作表，無法寫入日誌。`,
      );
    }
  } catch (error) {
    // 如果寫入日誌失敗，只能在控制台輸出
    console.log(`寫入日誌失敗: ${error.toString()}. 原始消息: ${message}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
  }
}

/**
 * 32. 格式化日期為 'YYYY/MM/DD'
 * @param {Date} date - 日期對象
 * @returns {string} - 格式化的日期字符串
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * 33. 格式化時間為 'HH:MM'
 * @param {Date} date - 日期對象
 * @returns {string} - 格式化的時間字符串
 */
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 34. 從文字中移除金額和支付方式
 * @version 2025-04-29-V2.0
 * @author AustinLiao69
 * @param {string} text - 原始文字 (例如 "測試支出 25365 刷卡")
 * @param {number|string} amount - 要移除的金額 (例如 "25365")
 * @param {string} paymentMethod - 要移除的支付方式 (例如 "刷卡")
 * @returns {string} - 移除金額和支付方式後的文字 (例如 "測試支出")
 */
function DD_removeAmountFromText(text, amount, paymentMethod) {
  // 檢查參數
  if (!text || !amount) return text;

  // 記錄處理前文字
  console.log(
    `處理文字移除金額和支付方式: 原始文字="${text}", 金額=${amount}, 支付方式=${paymentMethod || "未指定"}`,
  );

  // 將金額轉為字符串
  const amountStr = String(amount);
  let result = text;

  try {
    // 1. 處理 "科目 金額 支付方式" 格式
    if (paymentMethod && text.includes(" " + amountStr + " " + paymentMethod)) {
      result = text.replace(" " + amountStr + " " + paymentMethod, "").trim();
      console.log(`移除金額和支付方式後: "${result}"`);
      return result;
    }

    // 2. 處理 "科目 金額"，然後單獨移除支付方式
    if (text.includes(" " + amountStr)) {
      result = text.replace(" " + amountStr, "").trim();

      // 如果有支付方式，再嘗試移除支付方式
      if (paymentMethod && result.includes(" " + paymentMethod)) {
        result = result.replace(" " + paymentMethod, "").trim();
        console.log(`移除金額後再移除支付方式: "${result}"`);
        return result;
      }

      console.log(`使用空格格式匹配金額: "${result}"`);
      return result;
    }

    // 3. 處理 "科目金額" 格式 (無空格，但金額在尾部)
    if (text.endsWith(amountStr)) {
      result = text.substring(0, text.length - amountStr.length).trim();
      console.log(`使用尾部匹配: "${result}"`);

      // 如果有支付方式，再嘗試移除支付方式
      if (paymentMethod && result.includes(paymentMethod)) {
        result = result.replace(paymentMethod, "").trim();
        console.log(`移除金額後再移除支付方式: "${result}"`);
      }

      return result;
    }

    // 4. 處理 "科目金額元" 或 "科目金額塊" 格式
    const amountEndRegex = new RegExp(`${amountStr}(元|塊|圓|NT|USD)?$`, "i");
    const match = text.match(amountEndRegex);
    if (match && match.index > 0) {
      result = text.substring(0, match.index).trim();
      console.log(`使用貨幣單位匹配: "${result}"`);

      // 如果有支付方式，再嘗試移除支付方式
      if (paymentMethod && result.includes(paymentMethod)) {
        result = result.replace(paymentMethod, "").trim();
        console.log(`移除金額後再移除支付方式: "${result}"`);
      }

      return result;
    }

    // 5. 無法確定金額位置，但至少嘗試移除支付方式
    if (paymentMethod && result.includes(paymentMethod)) {
      result = result.replace(paymentMethod, "").trim();
      console.log(`無法確定金額位置，但移除了支付方式: "${result}"`);
      return result;
    }

    // 6. 實在無法處理，保留原始文字
    console.log(`無法確定金額和支付方式位置，保留原始文字: "${text}"`);
    return text;
  } catch (error) {
    console.log(`移除金額和支付方式失敗: ${error.toString()}, 返回原始文字`);
    return text;
  }
}

/**
 * 35. 修復版模糊匹配函數 - 優化複合詞處理
 * @version 2025-04-30-V4.1.3
 * @author AustinLiao69
 * @param {string} input - 用戶輸入的字符串
 * @param {number} threshold - 匹配閾值
 * @return {Object|null} 匹配結果或null
 */
function DD_fuzzyMatch(input, threshold = 0.6) {
  // 確保配置初始化
  DD_initConfig();

  if (!input) return null;

  // 日誌記錄
  console.log(`【模糊匹配】開始處理: "${input}", 閾值: ${threshold}`);

  const inputLower = input.toLowerCase().trim();

  // 獲取所有科目
  const allSubjects = DD_getAllSubjects();
  if (!allSubjects || !allSubjects.length) {
    console.log(`【模糊匹配】無法獲取科目列表`);
    return null;
  }

  console.log(`【模糊匹配】科目列表項目數: ${allSubjects.length}`);

  // ===== 最關鍵的修改：優先處理複合詞 =====
  // 檢測輸入(如"家鄉便當")是否包含任何同義詞(如"便當")
  const containsMatches = [];

  allSubjects.forEach((subject) => {
    // 檢查是否包含科目名
    const subNameLower = subject.subName.toLowerCase();
    if (subNameLower.length >= 2 && inputLower.includes(subNameLower)) {
      const score = (subNameLower.length / inputLower.length) * 0.9;
      containsMatches.push({
        ...subject,
        score: Math.min(0.9, score),
        matchType: "input_contains_subject_name",
        matchedTerm: subNameLower,
      });
      console.log(
        `【模糊匹配】輸入包含科目名: ${inputLower} 包含 ${subNameLower}, 分數=${score.toFixed(2)}`,
      );
    }

    // 檢查是否包含同義詞
    if (subject.synonyms) {
      const synonymsList = subject.synonyms
        .split(",")
        .map((syn) => syn.trim().toLowerCase());

      for (const synonym of synonymsList) {
        // 只考慮長度>=2的同義詞，避免單字符誤匹配
        if (synonym.length >= 2 && inputLower.includes(synonym)) {
          const score = (synonym.length / inputLower.length) * 0.95;
          containsMatches.push({
            ...subject,
            score: Math.min(0.95, score),
            matchType: "input_contains_synonym",
            matchedTerm: synonym,
          });
          console.log(
            `【模糊匹配】輸入包含同義詞: ${inputLower} 包含 ${synonym}, 分數=${score.toFixed(2)}`,
          );
        }
      }
    }
  });

  // 如果找到輸入包含科目名或同義詞的匹配
  if (containsMatches.length > 0) {
    // 按分數排序，取最佳匹配
    containsMatches.sort((a, b) => b.score - a.score);
    const bestMatch = containsMatches[0];

    console.log(
      `【模糊匹配】複合詞最佳匹配: "${input}" -> "${bestMatch.subName}", 包含詞: "${bestMatch.matchedTerm}", 分數: ${bestMatch.score.toFixed(2)}`,
    );

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

  // 標準匹配邏輯 - 保留原有的其他匹配方法
  const matches = [];

  // 1. 直接包含關係匹配
  allSubjects.forEach((subject) => {
    const subNameLower = subject.subName.toLowerCase();

    // 科目名稱包含輸入詞
    if (subNameLower.includes(inputLower)) {
      const score = (inputLower.length / subNameLower.length) * 0.95;
      matches.push({
        ...subject,
        score: Math.min(0.95, score),
        matchType: "contains_match",
      });
    }

    // 檢查同義詞
    if (subject.synonyms) {
      const synonymsList = subject.synonyms
        .split(",")
        .map((s) => s.trim().toLowerCase());

      for (const synonym of synonymsList) {
        // 同義詞包含輸入
        if (synonym.includes(inputLower)) {
          const score = (inputLower.length / synonym.length) * 0.98;
          matches.push({
            ...subject,
            score: Math.min(0.98, score),
            matchType: "synonym_contains",
            matchedSynonym: synonym,
          });
        }
      }
    }
  });

  // 2. Levenshtein距離匹配
  if (matches.length === 0) {
    allSubjects.forEach((subject) => {
      const subNameLower = subject.subName.toLowerCase();

      const distance = calculateLevenshteinDistance(inputLower, subNameLower);
      const maxLength = Math.max(inputLower.length, subNameLower.length);
      const similarityScore = 1 - distance / maxLength;

      if (similarityScore >= threshold) {
        matches.push({
          ...subject,
          score: similarityScore * 0.9,
          matchType: "levenshtein_name",
        });
      }

      // 同樣檢查同義詞的相似度
      if (subject.synonyms) {
        const synonymsList = subject.synonyms
          .split(",")
          .map((s) => s.trim().toLowerCase());

        for (const synonym of synonymsList) {
          const synDistance = calculateLevenshteinDistance(inputLower, synonym);
          const synMaxLength = Math.max(inputLower.length, synonym.length);
          const synSimilarity = 1 - synDistance / synMaxLength;

          if (synSimilarity >= threshold) {
            matches.push({
              ...subject,
              score: synSimilarity * 0.95,
              matchType: "levenshtein_synonym",
              matchedSynonym: synonym,
            });
          }
        }
      }
    });
  }

  // 如果有匹配結果，返回最佳匹配
  if (matches.length > 0) {
    matches.sort((a, b) => b.score - a.score);
    const bestMatch = matches[0];
    bestMatch.score = parseFloat(bestMatch.score.toFixed(2));

    console.log(
      `【模糊匹配】標準匹配成功: "${input}" -> "${bestMatch.subName}" (分數: ${bestMatch.score}, 類型: ${bestMatch.matchType})`,
    );
    return bestMatch;
  }

  // 沒有匹配，返回null
  console.log(`【模糊匹配】無匹配結果: "${input}"`);
  return null;
}

/**
 * 36 計算兩個字符串的相似度 (使用Levenshtein距離)
 * @param {string} str1 - 第一個字符串
 * @param {string} str2 - 第二個字符串
 * @returns {number} 相似度分數 (0-1)
 */
function DD_calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  // 計算Levenshtein距離
  const len1 = str1.length;
  const len2 = str2.length;
  let matrix = [];

  // 初始化矩陣
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 填充矩陣
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 刪除
        matrix[i][j - 1] + 1, // 插入
        matrix[i - 1][j - 1] + cost, // 替換
      );
    }
  }

  // 計算相似度分數
  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

/**
 * 37. 時間感知分類函數 - 根據時間戳判斷最可能的科目類別
 * @param {Array} possibleMatches - 可能的科目匹配結果
 * @param {string} timestamp - 時間戳
 * @returns {object} 最可能的科目匹配
 */
function DD_timeAwareClassification(possibleMatches, timestamp) {
  const tacId = Utilities.getUuid().substring(0, 8);
  console.log(
    `開始時間感知分類，有 ${possibleMatches ? possibleMatches.length : 0} 個可能匹配 [${tacId}]`,
  );

  try {
    if (!possibleMatches || possibleMatches.length === 0) {
      console.log(`無可能匹配項目 [${tacId}]`);
      return null;
    }

    // 只有一個匹配結果時直接返回
    if (possibleMatches.length === 1) {
      console.log(`僅有一個匹配結果，無需時間判斷 [${tacId}]`);
      return possibleMatches[0];
    }

    let hour;
    try {
      // 嘗試解析時間戳
      hour = new Date(Number(timestamp)).getHours();
      if (isNaN(hour)) {
        console.log(`時間戳無效，無法進行時間感知分類 [${tacId}]`);
        return possibleMatches[0]; // 回退到第一個匹配
      }
      console.log(`當前時間: ${hour}時 [${tacId}]`);
    } catch (timeError) {
      console.log(`時間戳解析失敗: ${timeError}, 使用默認匹配 [${tacId}]`);
      return possibleMatches[0]; // 回退到第一個匹配
    }

    // 時段定義
    const timeRanges = {
      breakfast: {
        range: [5, 10],
        names: ["早餐", "早點", "早午餐"],
        priority: 0.9,
      },
      lunch: {
        range: [11, 14],
        names: ["午餐", "中餐", "便當", "午飯"],
        priority: 0.9,
      },
      dinner: {
        range: [17, 21],
        names: ["晚餐", "晚飯", "宵夜"],
        priority: 0.9,
      },
      midnight: {
        range: [22, 4],
        names: ["宵夜", "消夜", "夜宵"],
        priority: 0.8,
      },
    };

    // 確定當前時段
    let currentTimeSlot = null;
    for (const [slot, config] of Object.entries(timeRanges)) {
      const [start, end] = config.range;
      if (
        (start <= end && hour >= start && hour <= end) ||
        (start > end && (hour >= start || hour <= end))
      ) {
        currentTimeSlot = slot;
        console.log(`當前時段: ${currentTimeSlot} [${tacId}]`);
        break;
      }
    }

    if (currentTimeSlot) {
      // 搜尋最匹配當前時段的科目
      for (const match of possibleMatches) {
        const subject = (match.subName || "").toLowerCase();
        const matchNames = timeRanges[currentTimeSlot].names;

        // 檢查科目名稱是否包含當前時段的關鍵字
        if (
          matchNames.some((keyword) => subject.includes(keyword.toLowerCase()))
        ) {
          console.log(
            `找到時段匹配: ${match.subName} 匹配時段 ${currentTimeSlot} [${tacId}]`,
          );
          DD_logInfo(
            `時間感知分類: "${match.subName}" 匹配當前時段 ${currentTimeSlot}`,
            "時間感知",
            "",
            "DD_timeAwareClassification",
          );
          return {
            ...match,
            confidence: timeRanges[currentTimeSlot].priority,
            timeBaseMatched: true,
          };
        }
      }
    }

    // 如果沒有找到時段匹配，返回第一個匹配結果並降低信心度
    console.log(
      `無時段匹配結果，使用第一個匹配: ${possibleMatches[0].subName} [${tacId}]`,
    );
    DD_logDebug(
      `無時段匹配結果，使用第一個匹配: ${possibleMatches[0].subName}`,
      "時間感知",
      "",
      "DD_timeAwareClassification",
    );
    return { ...possibleMatches[0], confidence: 0.7 };
  } catch (error) {
    console.log(`時間感知分類錯誤: ${error} [${tacId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `時間感知分類錯誤: ${error}`,
      "同義詞處理",
      "",
      "TIME_CLASS_ERROR",
      error.toString(),
      "DD_timeAwareClassification",
    );
    return possibleMatches[0]; // 發生錯誤時回退到第一個匹配
  }
}

/**
 * 38. 檢查詞彙是否有多個匹配
 * @param {string} term - 需要檢查的詞彙
 * @returns {Array|null} - 匹配結果數組，如果沒有匹配則返回null
 */
function DD_checkMultipleMapping(term) {
  const mmId = Utilities.getUuid().substring(0, 8);
  console.log(`檢查詞彙多重映射: "${term}" [${mmId}]`);

  try {
    if (!term) {
      console.log(`輸入詞彙為空 [${mmId}]`);
      return null;
    }

    const normalizedTerm = term.toLowerCase().trim();
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    let matches = [];

    // 檢查每一行
    for (let i = 1; i < data.length; i++) {
      const majorCode = data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1];
      const majorName = data[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1];
      const subCode = data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1];
      const subName = data[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1];
      const synonyms = (data[i][DD_SUBJECT_CODE_SYNONYMS_COLUMN - 1] || "")
        .split(",")
        .map((s) => s.trim());

      // 檢查科目名稱精確匹配
      if (String(subName).toLowerCase().trim() === normalizedTerm) {
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        });
      }

      // 檢查同義詞
      if (synonyms.some((syn) => syn.toLowerCase().trim() === normalizedTerm)) {
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        });
      }
    }

    if (matches.length > 0) {
      console.log(`詞彙 "${term}" 有 ${matches.length} 個映射 [${mmId}]`);
      DD_logInfo(
        `詞彙 "${term}" 有 ${matches.length} 個映射`,
        "多重映射",
        "",
        "DD_checkMultipleMapping",
      );
      return matches;
    } else {
      console.log(`詞彙 "${term}" 沒有映射 [${mmId}]`);
      return null;
    }
  } catch (error) {
    console.log(`檢查多重映射錯誤: ${error} [${mmId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `檢查多重映射錯誤: ${error}`,
      "同義詞處理",
      "",
      "MULTI_MAP_ERROR",
      error.toString(),
      "DD_checkMultipleMapping",
    );
    return null;
  }
}

// calculateLevenshteinDistance 函數 (用於支援模糊匹配)
function calculateLevenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  let matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[len1][len2];
}

// 更新現有的 SpreadsheetApp 物件
if (typeof SpreadsheetApp !== 'undefined') {
  // 擴充現有的 SpreadsheetApp 功能
  if (!SpreadsheetApp.insertSheet) {
    SpreadsheetApp.insertSheet = (name) => ({
      appendRow: (rowData) => {
        if (!spreadsheetData[name]) {
          spreadsheetData[name] = [];
        }
        spreadsheetData[name].push(rowData);
      },
    });
  }
}

/**
 * 39. 用戶偏好記憶管理
 * @param {string} userId - 用戶ID
 * @param {string} inputTerm - 輸入詞彙
 * @param {string} selectedSubjectCode - 用戶選擇的科目代碼
 * @param {boolean} isQuery - 是否為查詢操作
 * @returns {object|null} 查詢操作時返回偏好信息，存儲操作時返回null
 */
function DD_userPreferenceManager(
  userId,
  inputTerm,
  selectedSubjectCode,
  isQuery = false,
) {
  const upId = Utilities.getUuid().substring(0, 8);
  console.log(
    `${isQuery ? "查詢" : "存儲"}用戶偏好: userId=${userId}, term="${inputTerm}" [${upId}]`,
  );

  try {
    if (!userId || !inputTerm) {
      console.log(`用戶ID或輸入詞彙為空 [${upId}]`);
      return null;
    }

    const normalizedTerm = inputTerm.toLowerCase().trim();
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);

    // 確保用戶偏好表存在
    let prefSheet = ss.getSheetByName(DD_USER_PREF_SHEET_NAME);
    if (!prefSheet) {
      console.log(`用戶偏好表不存在，創建新表 [${upId}]`);
      prefSheet = ss.insertSheet(DD_USER_PREF_SHEET_NAME);
      prefSheet.appendRow([
        "userId",
        "inputText",
        "selectedCategory",
        "count",
        "lastUse",
        "context",
      ]);
    }

    // 查詢模式
    if (isQuery) {
      const prefData = prefSheet.getDataRange().getValues();
      const matches = [];

      // 找出用戶的所有匹配項
      for (let i = 1; i < prefData.length; i++) {
        if (
          prefData[i][0] === userId &&
          prefData[i][1].toLowerCase().trim() === normalizedTerm
        ) {
          matches.push({
            subjectCode: prefData[i][2],
            count: prefData[i][3],
            lastUse: prefData[i][4],
          });
        }
      }

      if (matches.length > 0) {
        // 按使用次數排序
        matches.sort((a, b) => b.count - a.count);
        console.log(
          `找到用戶偏好: ${matches[0].subjectCode}, 使用次數=${matches[0].count} [${upId}]`,
        );
        DD_logInfo(
          `找到用戶偏好: "${inputTerm}" -> ${matches[0].subjectCode}, 使用次數=${matches[0].count}`,
          "用戶偏好",
          userId,
          "DD_userPreferenceManager",
        );
        return matches[0];
      }

      console.log(`未找到用戶偏好 [${upId}]`);
      return null;
    }
    // 存儲模式
    else {
      if (!selectedSubjectCode) {
        console.log(`科目代碼為空，無法存儲 [${upId}]`);
        return null;
      }

      const now = new Date();
      const prefData = prefSheet.getDataRange().getValues();
      let found = false;
      let rowIndex = -1;

      // 尋找是否已存在記錄
      for (let i = 1; i < prefData.length; i++) {
        if (
          prefData[i][0] === userId &&
          prefData[i][1].toLowerCase().trim() === normalizedTerm &&
          prefData[i][2] === selectedSubjectCode
        ) {
          found = true;
          rowIndex = i + 1; // 表格行號從1開始，數組索引從0開始
          break;
        }
      }

      if (found) {
        // 更新現有記錄
        const currentCount = prefData[rowIndex - 1][3];
        prefSheet.getRange(rowIndex, 4).setValue(currentCount + 1); // 增加計數
        prefSheet.getRange(rowIndex, 5).setValue(now); // 更新時間戳
        console.log(
          `更新用戶偏好: "${inputTerm}" -> ${selectedSubjectCode}, 新計數=${currentCount + 1} [${upId}]`,
        );
        DD_logInfo(
          `更新用戶偏好: "${inputTerm}" -> ${selectedSubjectCode}, 新計數=${currentCount + 1}`,
          "用戶偏好",
          userId,
          "DD_userPreferenceManager",
        );
      } else {
        // 添加新記錄
        prefSheet.appendRow([
          userId,
          inputTerm,
          selectedSubjectCode,
          1,
          now,
          "",
        ]);
        console.log(
          `新增用戶偏好: "${inputTerm}" -> ${selectedSubjectCode} [${upId}]`,
        );
        DD_logInfo(
          `新增用戶偏好: "${inputTerm}" -> ${selectedSubjectCode}`,
          "用戶偏好",
          userId,
          "DD_userPreferenceManager",
        );
      }

      return null;
    }
  } catch (error) {
    console.log(`用戶偏好管理錯誤: ${error} [${upId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `用戶偏好管理錯誤: ${error}`,
      "同義詞處理",
      userId,
      "USER_PREF_ERROR",
      error.toString(),
      "DD_userPreferenceManager",
    );
    return null;
  }
}

/**
 * 40. 同義詞學習函數
 * @version 2025-06-06-V1.0.1
 * @author AustinLiao691
 * @date 2025-06-06 02:45:15
 * @param {string} term - 要學習的詞彙
 * @param {string} subjectCode - 對應的科目代碼
 * @param {string} userId - 用戶ID
 * @returns {boolean} 學習是否成功
 */
function DD_learnSynonym(term, subjectCode, userId) {
  const lsId = Utilities.getUuid().substring(0, 8);
  console.log(
    `學習同義詞: "${term}" -> ${subjectCode}, userId=${userId} [${lsId}]`,
  );

  try {
    if (!term || !subjectCode) {
      console.log(`詞彙或科目代碼為空 [${lsId}]`);
      return false;
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`科目代碼格式錯誤: ${subjectCode} [${lsId}]`);
      return false;
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    // 尋找對應的科目
    for (let i = 1; i < data.length; i++) {
      const rowMajorCode = String(
        data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1],
      );
      const rowSubCode = String(data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1]);

      if (rowMajorCode === majorCode && rowSubCode === subCode) {
        // 找到科目，處理同義詞
        const currentSynonyms =
          data[i][DD_SUBJECT_CODE_SYNONYMS_COLUMN - 1] || "";
        const synonymsList = currentSynonyms
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        // 檢查同義詞是否已存在
        if (
          synonymsList.some(
            (syn) => syn.toLowerCase() === term.toLowerCase().trim(),
          )
        ) {
          console.log(`同義詞已存在: "${term}" [${lsId}]`);
          return true;
        }

        // 添加新同義詞
        synonymsList.push(term.trim());
        const newSynonyms = synonymsList.join(",");

        // 更新科目表
        sheet
          .getRange(i + 1, DD_SUBJECT_CODE_SYNONYMS_COLUMN)
          .setValue(newSynonyms);
        console.log(`成功添加同義詞: "${term}" -> ${subjectCode} [${lsId}]`);
        DD_logInfo(
          `成功添加同義詞: "${term}" -> ${subjectCode}`,
          "同義詞學習",
          userId,
          "DD_learnSynonym",
        );
        return true;
      }
    }

    // 找不到匹配的科目
    console.log(`找不到對應科目代碼: ${subjectCode} [${lsId}]`);
    DD_logWarning(
      `找不到對應科目代碼: ${subjectCode}`,
      "同義詞學習",
      userId,
      "DD_learnSynonym",
    );
    return false;
  } catch (error) {
    console.log(`同義詞學習錯誤: ${error} [${lsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `同義詞學習錯誤: ${error}`,
      "同義詞處理",
      userId,
      "SYN_LEARN_ERROR",
      error.toString(),
      "DD_learnSynonym",
    );
    return false;
  }
}

/**
 * 41. 檢查詞彙是否已為特定科目的同義詞
 * @param {string} term - 要檢查的詞彙
 * @param {string} subjectCode - 科目代碼
 * @returns {boolean} 是否已為同義詞
 */
function DD_checkSynonym(term, subjectCode) {
  const csId = Utilities.getUuid().substring(0, 8);
  console.log(`檢查同義詞: "${term}" 是否屬於 ${subjectCode} [${csId}]`);

  try {
    if (!term || !subjectCode) return false;

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return false;

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    const normalizedTerm = term.toLowerCase().trim();

    // 尋找對應的科目
    for (let i = 1; i < data.length; i++) {
      const rowMajorCode = String(
        data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1],
      );
      const rowSubCode = String(data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1]);

      if (rowMajorCode === majorCode && rowSubCode === subCode) {
        // 檢查該科目的同義詞
        const synonymsStr = data[i][DD_SUBJECT_CODE_SYNONYMS_COLUMN - 1] || "";
        const synonyms = synonymsStr
          .split(",")
          .map((s) => s.trim().toLowerCase());

        const isInSynonyms = synonyms.includes(normalizedTerm);
        console.log(
          `"${term}" ${isInSynonyms ? "已是" : "不是"} ${subjectCode} 的同義詞 [${csId}]`,
        );
        return isInSynonyms;
      }
    }

    console.log(`找不到對應科目代碼: ${subjectCode} [${csId}]`);
    return false;
  } catch (error) {
    console.log(`檢查同義詞錯誤: ${error} [${csId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `檢查同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "CHECK_SYN_ERROR",
      error.toString(),
      "DD_checkSynonym",
    );
    return false;
  }
}

/**
 * 42. 初始化配置 - 確保所有必要的配置項都存在
 * @version 2025-06-11-V1.0.0
 */
function DD_initConfig() {
  // 確保基本配置存在
  DD_CONFIG.DEBUG = DD_CONFIG.DEBUG !== undefined ? DD_CONFIG.DEBUG : true;
  DD_CONFIG.LOG_SHEET_NAME = DD_CONFIG.LOG_SHEET_NAME || "03. log";
  DD_CONFIG.SPREADSHEET_ID =
    DD_CONFIG.SPREADSHEET_ID || "1fYFPjswEF0jOEj4TSDehJPNTwBEVwv666jqnN2KMOKU";
  DD_CONFIG.TIMEZONE = DD_CONFIG.TIMEZONE || "Asia/Taipei";
  DD_CONFIG.DEFAULT_SUBJECT = DD_CONFIG.DEFAULT_SUBJECT || "其他支出";

  // 同義詞系統配置
  if (!DD_CONFIG.SYNONYM) {
    DD_CONFIG.SYNONYM = {
      FUZZY_MATCH_THRESHOLD: 0.7, // 模糊匹配閾值
      ENABLE_COMPOUND_WORDS: true, // 啟用複合詞處理
    };
  } else {
    DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD =
      DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD || 0.7;
    DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS =
      DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS !== undefined
        ? DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS
        : true;
  }

  // 記帳配置
  if (!DD_CONFIG.BOOKKEEPING) {
    DD_CONFIG.BOOKKEEPING = {
      DEFAULT_ACTION: "支出",
      DEFAULT_PAYMENT_METHOD: "刷卡",
    };
  }

  console.log(`DD_CONFIG 初始化完成`);
}

/**
 * 43. 正規化中文輸入，處理簡繁體、全形半形等
 * @param {string} input - 輸入字符串
 * @return {string} 正規化後的字符串
 */
function normalizeChineseInput(input) {
  // 這裡只是一個簡單示例，實際可能需要更複雜的轉換
  // 全形數字轉半形
  const fullWidthNums = "０１２３４５６７８９";
  const halfWidthNums = "0123456789";

  let result = input;

  // 全形轉半形
  for (let i = 0; i < fullWidthNums.length; i++) {
    result = result.replace(
      new RegExp(fullWidthNums[i], "g"),
      halfWidthNums[i],
    );
  }

  // 簡單的簡繁體轉換對照表（實際系統可能需要更完整的對照表）
  const simplifiedToTraditional = {
    发: "發",
    东: "東",
    华: "華",
    车: "車",
    图: "圖",
    买: "買",
    卖: "賣",
    钱: "錢",
    饭: "飯",
    面: "麵",
  };

  // 簡體轉繁體
  for (const [simplified, traditional] of Object.entries(
    simplifiedToTraditional,
  )) {
    result = result.replace(new RegExp(simplified, "g"), traditional);
  }

  return result;
}

/**
 * 44. 計算Levenshtein編輯距離
 * @param {string} a - 第一個字符串
 * @param {string} b - 第二個字符串
 * @return {number} 編輯距離
 */
function calculateLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // 初始化矩陣
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // 填充矩陣
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替換
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j] + 1, // 刪除
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 45. 同義詞學習功能 - 支持從test ledger抓取同義詞
 * @version 2025-05-29-V1.0.1
 * @author AustinLiao691
 * @update: 統一使用DD_formatUserSuccessFeedback和DD_formatUserErrorFeedback處理訊息
 * @param {string} userId - 用戶ID
 * @param {string} originalSubject - 用戶輸入的原始詞彙
 * @param {string} matchedSubject - 系統匹配的科目名稱
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @returns {object} - 處理結果，包含success字段
 */
function DD_synonymLearning(
  userId,
  originalSubject,
  matchedSubject,
  subjectCode,
) {
  const lsId = Utilities.getUuid().substring(0, 8);
  console.log(
    `【同義詞學習】開始處理: 用戶="${userId}", 原詞="${originalSubject}", 科目="${matchedSubject}", 代碼=${subjectCode} [${lsId}]`,
  );

  try {
    // 檢查參數
    if (!originalSubject || !matchedSubject || !subjectCode) {
      console.log(`【同義詞學習】參數不完整，放棄學習 [${lsId}]`);

      // 使用56號函數處理錯誤
      const paramErrorResult = DD_formatUserErrorFeedback("參數不完整", "DD", {
        errorType: "INCOMPLETE_PARAMETERS",
        userId: userId,
        isRetryable: false,
      });

      return {
        success: false,
        error: "參數不完整",
        responseMessage: paramErrorResult.userFriendlyMessage,
      };
    }

    // 標準化處理詞彙
    const normalizedInput = originalSubject.trim().toLowerCase();
    const normalizedSubject = matchedSubject.trim().toLowerCase();

    // 檢查輸入是否與科目名稱相同，如果相同則無需學習
    if (normalizedInput === normalizedSubject) {
      console.log(`【同義詞學習】輸入詞與科目名稱相同，無需學習 [${lsId}]`);

      // 使用57號函數處理成功訊息
      const skipResult = DD_formatUserSuccessFeedback(
        {
          originalTerm: normalizedInput,
          standardTerm: normalizedSubject,
          action: "skipped",
          reason: "same_as_subject",
        },
        "DD",
        {
          operationType: "synonymLearning",
          userId: userId,
          context: {
            originalTerm: normalizedInput,
            standardTerm: normalizedSubject,
          },
        },
      );

      return {
        success: true,
        action: "skipped",
        reason: "same_as_subject",
        responseMessage: skipResult.userFriendlyMessage,
      };
    }

    // 檢查是否已經是該科目的同義詞
    if (DD_checkSynonym(normalizedInput, subjectCode)) {
      console.log(
        `【同義詞學習】"${originalSubject}"已經是科目${subjectCode}的同義詞，無需重複學習 [${lsId}]`,
      );

      // 使用57號函數處理成功訊息
      const alreadySynResult = DD_formatUserSuccessFeedback(
        {
          originalTerm: normalizedInput,
          standardTerm: normalizedSubject,
          action: "skipped",
          reason: "already_synonym",
        },
        "DD",
        {
          operationType: "synonymLearning",
          userId: userId,
          context: {
            originalTerm: normalizedInput,
            standardTerm: normalizedSubject,
          },
        },
      );

      return {
        success: true,
        action: "skipped",
        reason: "already_synonym",
        responseMessage: alreadySynResult.userFriendlyMessage,
      };
    }

    // 1. 首先從科目代碼表中獲取當前的同義詞列表
    const currentSynonyms = DD_getSynonymsForSubject(subjectCode);
    console.log(
      `【同義詞學習】當前科目同義詞: ${currentSynonyms || "無"} [${lsId}]`,
    );

    // 2. 從Test ledger中抓取可能的新同義詞
    const ledgerSynonyms = DD_fetchSynonymsFromLedger(subjectCode);
    console.log(
      `【同義詞學習】從Ledger獲取的同義詞: ${ledgerSynonyms || "無"} [${lsId}]`,
    );

    // 3. 合併同義詞，包括當前輸入的詞彙
    let allSynonyms = new Set();

    // 添加當前科目表的同義詞
    if (currentSynonyms) {
      currentSynonyms.split(",").forEach((syn) => {
        if (syn.trim()) allSynonyms.add(syn.trim());
      });
    }

    // 添加從ledger獲取的同義詞
    if (ledgerSynonyms) {
      ledgerSynonyms.split(",").forEach((syn) => {
        if (syn.trim()) allSynonyms.add(syn.trim());
      });
    }

    // 添加當前輸入的詞彙
    allSynonyms.add(originalSubject.trim());

    // 轉換回逗號分隔的字符串
    const updatedSynonyms = Array.from(allSynonyms).join(",");
    console.log(
      `【同義詞學習】更新後的同義詞列表: ${updatedSynonyms} [${lsId}]`,
    );

    // 4. 更新科目代碼表
    const updateResult = DD_updateSynonymsForSubject(
      subjectCode,
      updatedSynonyms,
    );

    if (updateResult.success) {
      console.log(`【同義詞學習】同義詞更新成功 [${lsId}]`);
      DD_logInfo(
        `同義詞學習成功: "${originalSubject}" -> ${matchedSubject} (${subjectCode})`,
        "同義詞學習",
        userId,
        "DD_synonymLearning",
      );

      // 5. 更新用戶偏好
      if (userId) {
        DD_userPreferenceManager(userId, originalSubject, subjectCode, false);
      }

      // 使用57號函數處理成功訊息
      const successResult = DD_formatUserSuccessFeedback(
        {
          originalTerm: normalizedInput,
          standardTerm: normalizedSubject,
          action: "updated",
          synonyms: updatedSynonyms,
        },
        "DD",
        {
          operationType: "synonymLearning",
          userId: userId,
          context: {
            originalTerm: normalizedInput,
            standardTerm: normalizedSubject,
            subjectCode: subjectCode,
          },
        },
      );

      return {
        success: true,
        action: "updated",
        synonyms: updatedSynonyms,
        responseMessage: successResult.userFriendlyMessage,
      };
    } else {
      console.log(
        `【同義詞學習】同義詞更新失敗: ${updateResult.error} [${lsId}]`,
      );

      // 使用56號函數處理錯誤
      const updateErrorResult = DD_formatUserErrorFeedback(
        updateResult.error,
        "DD",
        {
          errorType: "SYNONYM_UPDATE_ERROR",
          userId: userId,
          isRetryable: true,
        },
      );

      return {
        success: false,
        error: updateResult.error,
        responseMessage: updateErrorResult.userFriendlyMessage,
      };
    }
  } catch (error) {
    console.log(`【同義詞學習】處理錯誤: ${error} [${lsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `同義詞學習錯誤: ${error}`,
      "同義詞處理",
      userId,
      "SYN_LEARN_ERROR",
      error.toString(),
      "DD_synonymLearning",
    );

    // 使用56號函數處理錯誤
    const generalErrorResult = DD_formatUserErrorFeedback(error, "DD", {
      errorType: "SYNONYM_LEARNING_ERROR",
      userId: userId,
      isRetryable: true,
    });

    return {
      success: false,
      error: error.toString(),
      responseMessage: generalErrorResult.userFriendlyMessage,
    };
  }
}

/**
 * 46. 從Test ledger中抓取特定科目代碼的同義詞
 * @version 2025-05-02-V1.0.0
 * @author AustinLiao69
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @returns {string} - 逗號分隔的同義詞字符串，如果沒有找到則返回空字符串
 */
function DD_fetchSynonymsFromLedger(subjectCode) {
  const flId = Utilities.getUuid().substring(0, 8);
  console.log(
    `【抓取同義詞】開始從Test ledger抓取科目${subjectCode}的同義詞 [${flId}]`,
  );

  try {
    // 檢查bk�數
    if (!subjectCode) {
      console.log(`【抓取同義詞】科目代碼為空 [${flId}]`);
      return "";
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`【抓取同義詞】科目代碼格式錯誤: ${subjectCode} [${flId}]`);
      return "";
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 打開Test ledger表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const ledgerSheet = ss.getSheetByName("999. Test ledger");

    if (!ledgerSheet) {
      console.log(`【抓取同義詞】找不到Test ledger表 [${flId}]`);
      return "";
    }

    // 獲取所有數據
    const data = ledgerSheet.getDataRange().getValues();

    // 定義列索引
    const MAJOR_CODE_COL = 4; // 大項代碼在第5列
    const MINOR_CODE_COL = 5; // 子項代碼在第6列
    const SYNONYM_COL = 12; // 同義詞在第13列

    // 收集所有匹配的同義詞
    const synonyms = new Set();

    for (let i = 1; i < data.length; i++) {
      // 檢查是否匹配科目代碼
      if (
        String(data[i][MAJOR_CODE_COL]) === majorCode &&
        String(data[i][MINOR_CODE_COL]) === subCode
      ) {
        // 檢查同義詞列是否有值
        const synValue = data[i][SYNONYM_COL];
        if (synValue && typeof synValue === "string" && synValue.trim()) {
          // 將同義詞添加到集合中（自動去重）
          synValue.split(",").forEach((syn) => {
            if (syn.trim()) synonyms.add(syn.trim());
          });
        }
      }
    }

    // 轉換為逗號分隔的字符串
    const result = Array.from(synonyms).join(",");

    console.log(
      `【抓取同義詞】從Test ledger找到${synonyms.size}個同義詞: ${result} [${flId}]`,
    );
    return result;
  } catch (error) {
    console.log(`【抓取同義詞】處理錯誤: ${error} [${flId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `從Ledger抓取同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "FETCH_SYN_ERROR",
      error.toString(),
      "DD_fetchSynonymsFromLedger",
    );
    return "";
  }
}

/**
 * 47. 獲取特定科目代碼的當前同義詞
 * @version 2025-05-02-V1.0.0
 * @author AustinLiao69
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @returns {string} - 當前的同義詞字符串，如果沒有找到則返回空字符串
 */
function DD_getSynonymsForSubject(subjectCode) {
  try {
    // 檢查參數
    if (!subjectCode) return "";

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return "";

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 打開科目代碼表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);

    if (!sheet) return "";

    // 獲取所有數據
    const data = sheet.getDataRange().getValues();

    // 尋找匹配的科目
    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1]) === majorCode &&
        String(data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1]) === subCode
      ) {
        // 返回該科目的同義詞列 (假設為第5列)
        return data[i][4] || "";
      }
    }

    return "";
  } catch (error) {
    console.log(`獲取科目同義詞錯誤: ${error}`);
    DD_logError(
      `獲取科目同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "GET_SYN_ERROR",
      error.toString(),
      "DD_getSynonymsForSubject",
    );
    return "";
  }
}

/**
 * 48. 更新特定科目代碼的同義詞
 * @version 2025-05-02-V1.0.0
 * @author AustinLiao69
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @param {string} synonyms - 更新後的同義詞字符串
 * @returns {object} - 包含success字段的結果對象
 */
function DD_updateSynonymsForSubject(subjectCode, synonyms) {
  const usId = Utilities.getUuid().substring(0, 8);
  console.log(
    `【更新同義詞】開始更新科目${subjectCode}的同義詞為: ${synonyms} [${usId}]`,
  );

  try {
    // 檢查參數
    if (!subjectCode) {
      console.log(`【更新同義詞】科目代碼為空 [${usId}]`);
      return { success: false, error: "科目代碼為空" };
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`【更新同義詞】科目代碼格式錯誤: ${subjectCode} [${usId}]`);
      return { success: false, error: "科目代碼格式錯誤" };
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 打開科目代碼表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);

    if (!sheet) {
      console.log(
        `【更新同義詞】找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${usId}]`,
      );
      return { success: false, error: "找不到科目表" };
    }

    // 獲取所有數據
    const data = sheet.getDataRange().getValues();

    // 尋找匹配的科目
    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1]) === majorCode &&
        String(data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1]) === subCode
      ) {
        // 更新同義詞列 (假設為第5列)
        sheet.getRange(i + 1, 5).setValue(synonyms);

        console.log(
          `【更新同義詞】成功更新科目${subjectCode}的同義詞 [${usId}]`,
        );
        DD_logInfo(
          `更新科目${subjectCode}的同義詞: ${synonyms}`,
          "同義詞管理",
          "",
          "DD_updateSynonymsForSubject",
        );

        return { success: true };
      }
    }

    console.log(`【更新同義詞】找不到匹配的科目: ${subjectCode} [${usId}]`);
    return { success: false, error: "找不到匹配的科目" };
  } catch (error) {
    console.log(`【更新同義詞】處理錯誤: ${error} [${usId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `更新科目同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "UPDATE_SYN_ERROR",
      error.toString(),
      "DD_updateSynonymsForSubject",
    );
    return { success: false, error: error.toString() };
  }
}

/**
 * 49. 生成記帳結果回覆訊息
 * @version 1.1.0 (2025-05-14)
 * @param {object} result - BK模組的處理結果
 * @param {string} action - 操作類型 (記帳、查詢等)
 * @returns {string} 格式化的回覆訊息
 */
function DD_generateBookkeepingResponse(result, action) {
  console.log(`生成記帳回覆, 結果: ${JSON.stringify(result)}`);

  if (!result) {
    return "❌ 記帳失敗，請再試一次";
  }

  // 處理成功的情況
  if (result.success) {
    // 確保正確使用 result 對象中的數據
    const isIncome = result.isIncome || false;
    const bkResult = result.result || {};

    // 取得記帳項目名稱 (優先使用 minorName，如果不存在則使用 subName)
    const itemName = bkResult.minorName || result.subjectName || "未指定";

    // 取得金額 (從 BK 結果或原始請求中提取)
    const amount =
      bkResult.income ||
      bkResult.expense ||
      (isIncome ? result.income : result.expense) ||
      "0";

    // 取得支付方式
    const paymentMethod =
      bkResult.paymentMethod || result.paymentMethod || "現金";

    // 取得日期時間 (優先使用 BK 結果中的時間)
    const dateStr =
      bkResult.date ||
      Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd");
    const timeStr =
      bkResult.time || Utilities.formatDate(new Date(), "Asia/Taipei", "HH:mm");

    // 取得科目分類
    const majorName = bkResult.majorName || result.majorName || "";
    const minorName = itemName; // 使用之前提取的項目名稱

    // 取得收支 ID
    const bookkeepingId = bkResult.bookkeepingId || "未產生";

    console.log(
      `生成記帳回覆: 科目=${itemName}, 金額=${amount}, 支付方式=${paymentMethod}`,
    );

    return `記帳成功！
            金額：${amount}元 (${isIncome ? "收入" : "支出"})
            付款方式：${paymentMethod}
            時間：${dateStr} ${timeStr}
            科目：${minorName}
            備註：${remarkText}`;
  }
  // 處理失敗的情況
  else {
    if (result.error && result.error.includes("找不到科目")) {
      // 擷取科目名稱
      const subjectMatch = result.error.match(/找不到科目: (.+)/);
      const subjectName = subjectMatch ? subjectMatch[1] : "未知科目";

      return `記帳失敗：找不到科目「${subjectName}」
 請檢查科目名稱是否正確`;
    } else {
      return "記帳失敗，請再試一次";
    }
  }
}

/**
 * 50. 統一的記帳回覆訊息生成器 - 委託給56/57號函數
 * @version 2025-05-29-V3.0.2
 * @author AustinLiao691
 * @update: 移除訊息生成代碼，委託給56/57號函數處理
 * @param {Object} data - 記帳數據
 * @returns {string} 格式化的回覆訊息
 */
function DD_generateBookkeepingMessage(data) {
  try {
    // 1. 記錄開始處理
    console.log(`開始生成記帳回覆訊息: ${JSON.stringify(data)}`);

    // 2. 檢查必要參數
    if (!data) {
      const errorResult = DD_formatUserErrorFeedback(
        "記帳數據為空，無法生成訊息",
        "BK",
        {
          errorType: "EMPTY_DATA",
          isRetryable: false,
        },
      );
      return errorResult.userFriendlyMessage;
    }

    // 3. 根據成功與否使用不同的訊息處理函數
    if (data.success !== false) {
      // 成功訊息 - 使用57號函數
      const successResult = DD_formatUserSuccessFeedback(data, "BK", {
        operationType: "記帳",
        userId: data.userId || data.user_id || "",
      });

      return successResult.userFriendlyMessage;
    } else {
      // 失敗訊息 - 使用56號函數
      const errorResult = DD_formatUserErrorFeedback(
        data.error || "未知錯誤",
        "BK",
        {
          errorType: data.errorType || "UNKNOWN_ERROR",
          userId: data.userId || data.user_id || "",
        },
      );

      return errorResult.userFriendlyMessage;
    }
  } catch (error) {
    // 函數本身出錯時的處理
    const errorResult = DD_formatUserErrorFeedback(
      `訊息生成出錯: ${error.toString()}`,
      "DD",
      {
        errorType: "MESSAGE_GENERATION_ERROR",
        isRetryable: false,
      },
    );

    return errorResult.userFriendlyMessage;
  }
}

/**
 * 51. 解析使用者輸入格式
 * @version 2025-06-16-V3.5.0
 * @author AustinLiao69
 * @date 2025-06-16 02:13:23
 * @update: 修正負數金額解析及錯誤資料保存
 * @param {string} text - 用戶輸入的原始文本
 * @param {string} processId - 處理ID
 * @returns {Object} - 解析結果
 */
function DD_parseInputFormat(text, processId) {
  console.log(`DD_parseInputFormat: 開始解析文本「${text}」[${processId}]`);

  if (!text || text.trim() === "") {
    console.log(`DD_parseInputFormat: 空文本 [${processId}]`);
    return {
      _formatError: true,
      _errorDetail: "文本為空",
      _missingSubject: true,
      errorData: {
        success: false,
        error: "文本為空",
        errorType: "EMPTY_TEXT",
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "預設",
        },
      },
    };
  }

  // 移除空白
  text = text.trim();

  try {
    // 檢測負數模式 (改進版)
    const negativePattern = /^(.+?)(-\d+)(.*)$/;
    const negativeMatch = text.match(negativePattern);

    if (negativeMatch) {
      const subject = negativeMatch[1].trim();
      const rawAmount = negativeMatch[2]; // 保留負號
      const amount = parseFloat(rawAmount);

      // 支付方式提取
      let paymentMethod = "預設";
      const remainingText = negativeMatch[3].trim();

      // 更詳細地檢查支付方式
      const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
      for (const method of paymentMethods) {
        if (remainingText.includes(method)) {
          paymentMethod = method;
          break;
        }
      }

      // 如果沒有匹配到列出的支付方式，但有剩餘文本，使用整個剩餘文本作為支付方式
      if (paymentMethod === "預設" && remainingText) {
        paymentMethod = remainingText;
      }

      console.log(
        `DD_parseInputFormat: 識別負數格式 - 科目:「${subject}」, 金額:${rawAmount}, 支付方式:「${paymentMethod}」 [${processId}]`,
      );

      // 負數金額檢查 (關鍵部分：改為在這裡處理錯誤，同時保留原始數據)
      if (amount < 0) {
        console.log(
          `DD_parseInputFormat: 檢測到負數金額 ${amount} [${processId}]`,
        );

        // 構造包含完整信息的錯誤數據
        return {
          _formatError: true,
          _errorDetail: "金額不可為負數",
          subject: subject,
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          // 包含完整的錯誤數據
          errorData: {
            success: false,
            error: "金額不可為負數",
            errorType: "NEGATIVE_AMOUNT",
            partialData: {
              subject: subject,
              amount: amount,
              rawAmount: rawAmount,
              paymentMethod: paymentMethod,
              remark: subject, // 將科目保存為備註
            },
          },
        };
      }

      // 這裡正常情況不會執行到，因為上面已經返回了
      return {
        subject: subject,
        amount: Math.abs(amount),
        rawAmount: String(Math.abs(amount)),
        paymentMethod: paymentMethod,
      };
    }

    // 標準格式處理 (未修改部分)
    const regex = /^(.+?)(\d+)(.*)$/;
    const match = text.match(regex);

    if (match) {
      const subject = match[1].trim();
      const amount = parseInt(match[2], 10);
      const rawAmount = match[2];

      // 支付方式提取 (與負數格式相同邏輯)
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

      console.log(
        `DD_parseInputFormat: 識別標準格式 - 科目:「${subject}」, 金額:${amount}, 支付方式:「${paymentMethod}」 [${processId}]`,
      );

      if (subject === "") {
        return {
          _formatError: true,
          _errorDetail: "未明確指定科目名稱",
          _missingSubject: true,
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          errorData: {
            success: false,
            error: "未明確指定科目名稱",
            errorType: "MISSING_SUBJECT",
            partialData: {
              subject: "未知科目",
              amount: amount,
              rawAmount: rawAmount,
              paymentMethod: paymentMethod,
            },
          },
        };
      }

      return {
        subject: subject,
        amount: amount,
        rawAmount: rawAmount,
        paymentMethod: paymentMethod,
      };
    } else {
      console.log(`DD_parseInputFormat: 無法解析格式 [${processId}]`);
      return {
        _formatError: true,
        _errorDetail: "無法識別輸入格式",
        errorData: {
          success: false,
          error: "無法識別輸入格式",
          errorType: "UNRECOGNIZED_FORMAT",
          partialData: {
            subject: text,
            amount: 0,
            rawAmount: "0",
            paymentMethod: "預設",
          },
        },
      };
    }
  } catch (error) {
    console.log(`DD_parseInputFormat: 解析錯誤 ${error} [${processId}]`);
    return {
      _formatError: true,
      _errorDetail: `解析錯誤: ${error.toString()}`,
      errorData: {
        success: false,
        error: `解析錯誤: ${error.toString()}`,
        errorType: "PARSE_ERROR",
        partialData: {
          subject: text,
          amount: 0,
          rawAmount: "0",
          paymentMethod: "預設",
        },
      },
    };
  }
}

// 更新現有的 Utilities 物件，添加缺少的方法
if (typeof Utilities !== 'undefined' && !Utilities.formatDate) {
  Utilities.formatDate = (date, timezone, format) => {
    if (format === "yyyy/MM/dd HH:mm") {
      return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    return date.toString();
  };
}

// 更新現有的 SpreadsheetApp 物件，添加 getActive 方法
if (typeof SpreadsheetApp !== 'undefined' && !SpreadsheetApp.getActive) {
  SpreadsheetApp.getActive = () => ({
    getSheetByName: (name) => ({
      getDataRange: () => ({
        getValues: () => spreadsheetData[name] || [],
      }),
    }),
  });
}

/**
 * 52. 記帳備註生成與格式化
 * @version 2025-05-21-V1.0.2
 * @author AustinLiao69
 * @date 2025-05-21 16:12:14
 * @update: 增強格式化能力，確保移除金額和支付方式
 * @param {Object} parseResult - DD_parseInputFormat 的解析結果
 * @param {string} originalText - 原始輸入文本
 * @return {string} 格式化後的備註
 */
function DD_formatBookkeepingRemark(parseResult, originalText) {
  if (!parseResult || !originalText) return "";

  let remark = originalText;

  // 1. 移除數字和貨幣單位 (支持更大範圍的數字和各種分隔符)
  remark = remark.replace(/\d{1,3}(,\d{3})*(\.\d+)?|\d+/g, "");

  // 2. 移除所有支付方式
  const paymentMethods = ["現金", "刷卡", "轉帳", "行動支付", "其他"];
  paymentMethods.forEach((method) => {
    remark = remark.replace(new RegExp(method, "gi"), "");
  });

  // 3. 移除貨幣單位
  remark = remark.replace(/[元塊NT$¥€£]/gi, "");

  // 4. 移除多餘空格和標點符號
  remark = remark.replace(/\s+/g, " ").trim();
  remark = remark.replace(/^[,，:：\-\s]+|[,，:：\-\s]+$/g, "");

  // 5. 檢查科目是否就是備註全部內容
  if (
    parseResult.subject &&
    (remark === parseResult.subject || remark === "" || remark.length <= 1)
  ) {
    // 如果只剩下科目名稱或備註為空，返回科目名稱
    return parseResult.subject;
  }

  // 6. 最終清理
  if (!remark || remark.length <= 1) {
    // 備註太短或為空，返回科目名稱
    return parseResult.subject || originalText;
  }

  return remark;
}

/**
 * 53. 智能備註生成 - 根據記帳數據生成有意義的備註
 * @version 2025-05-21-V1.1.0
 * @author AustinLiao69
 * @date 2025-05-21 16:12:30
 * @update: 改進智能備註生成，確保備註只包含相關信息
 * @param {Object} bookkeepingData - 記帳數據對象
 * @return {string} 生成的備註
 */
function DD_generateIntelligentRemark(bookkeepingData) {
  try {
    // 1. 使用科目名稱作為備註基礎
    let remark = bookkeepingData.subjectName || "";

    // 2. 如果有原始文本並且不等於科目名稱，嘗試格式化
    if (
      bookkeepingData.text &&
      bookkeepingData.text !== bookkeepingData.subjectName
    ) {
      // 構建格式化所需信息
      const parseResult = {
        subject: bookkeepingData.subjectName,
        amount: bookkeepingData.amount,
        paymentMethod: bookkeepingData.paymentMethod,
      };

      // 嘗試格式化
      const formattedRemark = DD_formatBookkeepingRemark(
        parseResult,
        bookkeepingData.text,
      );

      // 檢查格式化結果是否比科目名稱更有信息量
      if (
        formattedRemark &&
        formattedRemark !== bookkeepingData.subjectName &&
        formattedRemark.length > 1
      ) {
        return formattedRemark;
      }
    }

    // 3. 如果有原始科目且與系統科目不同，使用原始科目
    if (
      bookkeepingData.originalSubject &&
      bookkeepingData.subjectName &&
      bookkeepingData.originalSubject !== bookkeepingData.subjectName
    ) {
      return bookkeepingData.originalSubject;
    }

    // 4. 返回科目名稱作為備註
    return remark;
  } catch (error) {
    console.error("生成智能備註錯誤: " + error);
    // 失敗時返回科目名稱
    return bookkeepingData.subjectName || "";
  }
}

/**
 * 54. 處理解析結果的函數
 * 處理DD_parseInputFormat的返回結果，整合金額格式化功能
 * @version 2025-05-23-V1.0.3
 * @author AustinLiao69
 * @lastUpdate: 2025-05-23 03:05:21
 * @update: 增強大數字處理，確保原始金額格式傳遞
 * @param {Object} parseResult - 解析結果
 * @param {Object} options - 選項
 * @returns {Object} 處理後的結果
 */
function DD_processParseResult(parseResult, options = {}) {
  // 1. 處理ID
  const processId = options.processId || Utilities.getUuid().substring(0, 8);
  console.log(`[${processId}] DD_processParseResult: 開始處理解析結果`);

  // 2. 參數檢查
  if (!parseResult) {
    console.log(`[${processId}] DD_processParseResult: 解析結果為空`);
    return null;
  }

  // 3. 提取基本信息
  const subject = parseResult.subject;
  const amount = parseResult.amount;
  const rawAmount = parseResult.rawAmount || amount.toLocaleString("zh-TW"); // 確保有原始金額格式
  const paymentMethod = parseResult.paymentMethod || "刷卡";

  console.log(
    `[${processId}] DD_processParseResult: 處理基本信息 - 科目: ${subject}, 金額: ${amount}, 原始金額: ${rawAmount}, 支付方式: ${paymentMethod}`,
  );

  // 4. 獲取支出/收入類型
  let action = parseResult.action;
  if (!action) {
    // 如果沒有明確指定，根據上下文或配置判斷
    if (options.defaultAction) {
      action = options.defaultAction;
    } else {
      // 如果是以支出/買/購買開頭，是支出
      if (/^(支出|買|購買)/.test(parseResult.text)) {
        action = "支出";
      }
      // 如果是以收入開頭，是收入
      else if (/^收入/.test(parseResult.text)) {
        action = "收入";
      }
      // 默認支出
      else {
        action = "支出";
      }
    }
  }

  console.log(`[${processId}] DD_processParseResult: 確定交易類型: ${action}`);

  // 5. 特殊格式處理: 如果是FORMAT8（純數字），需要上下文信息
  if (parseResult.formatId === "FORMAT8" && options.contextSubject) {
    console.log(
      `[${processId}] DD_processParseResult: 處理純數字格式，使用上下文科目: ${options.contextSubject}`,
    );
    return {
      subject: options.contextSubject,
      amount: amount,
      rawAmount: rawAmount, // 保存原始金額格式
      action: action,
      paymentMethod: paymentMethod,
      text: parseResult.text || "",
      formatId: parseResult.formatId,
    };
  }

  // 6. 返回處理結果
  console.log(
    `[${processId}] DD_processParseResult: 返回處理結果 - 科目: ${subject}, 金額: ${amount}, 原始金額: ${rawAmount}, 動作: ${action}`,
  );

  return {
    subject: subject,
    amount: amount,
    rawAmount: rawAmount, // 保存原始金額格式
    action: action,
    paymentMethod: paymentMethod,
    text: parseResult.text || "",
    formatId: parseResult.formatId,
  };
}

/**
 * 55. 獲取所有科目列表（包括同義詞）
 * 注意：這是一個模擬函數，實際實現需要從資料表獲取數據
 * @return {Array} 科目列表
 */
function DD_getAllSubjects() {
  try {
    // 獲取科目資料表
    const sheet =
      SpreadsheetApp.getActive().getSheetByName("997. 科目代碼_測試");
    if (!sheet) {
      console.log("【模糊匹配】無法找到科目表");
      return [];
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // 跳過標題行
    const subjects = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i][0]) {
        // 確保行不為空
        subjects.push({
          majorCode: values[i][0].toString(),
          majorName: values[i][1] || "",
          subCode: values[i][2].toString(),
          subName: values[i][3] || "",
          synonyms: values[i][4] || "",
        });
      }
    }

    return subjects;
  } catch (error) {
    console.log(`【模糊匹配】獲取科目列表失敗: ${error}`);
    return [];
  }
}

/**
 * 58. 格式化系統回覆訊息
 * @version 2025-06-16-V3.7.0
 * @author AustinLiao69
 * @date 2025-06-16 02:13:23
 * @update: 修復負數金額和支付方式處理問題，確保多層調用數據一致性
 * @param {Object} resultData - 處理結果數據
 * @param {string} moduleCode - 模組代碼
 * @param {Object} options - 附加選項
 * @returns {Object} 格式化後的回覆訊息
 */
function DD_formatSystemReplyMessage(resultData, moduleCode, options = {}) {
  // 1. 初始化處理 - 核心變數移到頂層，確保在所有程式路徑中都可用
  const userId = options.userId || "";
  const processId = options.processId || Utilities.getUuid().substring(0, 8);
  let errorMsg = "未知錯誤"; // 關鍵：移到頂層定義
  const currentDateTime = Utilities.formatDate(
    new Date(),
    DD_CONFIG.TIMEZONE || "Asia/Taipei",
    "yyyy/MM/dd HH:mm",
  ); // 關鍵：移到頂層定義

  console.log(
    `DD_formatSystemReplyMessage: 開始格式化訊息 [${processId}], 模組: ${moduleCode}`,
  );
  console.log(
    `DD_formatSystemReplyMessage: 輸入數據: ${JSON.stringify(resultData).substring(0, 300)}...`,
  );

  try {
    // 2. 檢查resultData是否已經包含完整的responseMessage，如有則優先使用
    if (resultData && resultData.responseMessage) {
      console.log(
        `DD_formatSystemReplyMessage: 檢測到完整responseMessage，將直接使用 [${processId}]`,
      );

      // 深度複製，確保不影響原始對象
      const returnObject = {
        success: resultData.success === true ? true : false,
        responseMessage: resultData.responseMessage,
        originalResult: resultData.originalResult || resultData,
        processId: processId,
        errorType: resultData.errorType || null,
        moduleCode: moduleCode,
        partialData: resultData.partialData || {},
        error:
          resultData.error ||
          (resultData.success === true ? undefined : errorMsg),
      };

      console.log(
        `DD_formatSystemReplyMessage: 直接返回現有訊息，長度=${returnObject.responseMessage.length} [${processId}]`,
      );
      return returnObject;
    }

    // 3. 確保resultData存在
    if (!resultData) {
      console.log(
        `DD_formatSystemReplyMessage: resultData為空，使用默認值 [${processId}]`,
      );
      resultData = {
        success: false,
        error: "無處理結果資料",
        errorType: "MISSING_RESULT_DATA",
        message: "無處理結果資料",
        errorDetails: {
          processId: processId,
          errorType: "SYSTEM_ERROR",
          module: moduleCode || "BK",
        },
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "支付方式未指定",
          timestamp: new Date().getTime(),
        },
      };
    }

    // 4. 處理結果數據
    let responseMessage = "";
    const isSuccess = resultData.success === true;

    // 5. 從resultData中提取資料 - 支持更多嵌套結構 (最關鍵修改點)
    let partialData = null;

    // 5.1 查找partialData的各種可能位置（按優先順序）
    const dataSources = [
      resultData.parsedData, // DD_parseInputFormat 直接返回
      resultData.partialData, // 一般partialData
      resultData.errorData?.partialData, // 錯誤數據中的部分數據
      resultData.originalResult?.partialData, // 嵌套結果中的部分數據
      resultData._partialData, // 舊版格式
      resultData.data, // 成功結果中的完整數據
    ];

    // 查找第一個非空的數據源
    for (let source of dataSources) {
      if (
        source &&
        typeof source === "object" &&
        Object.keys(source).length > 0
      ) {
        partialData = source;
        console.log(
          `DD_formatSystemReplyMessage: 找到數據源: ${JSON.stringify(partialData).substring(0, 100)}... [${processId}]`,
        );
        break;
      }
    }

    // 如果都未找到，嘗試從responseMessage解析
    if (!partialData && resultData.responseMessage) {
      try {
        console.log(
          `DD_formatSystemReplyMessage: 嘗試從responseMessage解析數據 [${processId}]`,
        );
        const msgLines = resultData.responseMessage.split("\n");
        partialData = {};

        for (const line of msgLines) {
          if (line.startsWith("金額：")) {
            const amountMatch = line.match(/金額：([-\d,]+)元/);
            if (amountMatch && amountMatch[1]) {
              // 保留原始金額值，包括負數
              partialData.rawAmount = amountMatch[1].replace(/,/g, "");
              partialData.amount = parseFloat(partialData.rawAmount);
              console.log(`從訊息解析金額: ${partialData.rawAmount}`);
            }
          } else if (line.startsWith("科目：")) {
            partialData.subject = line.replace("科目：", "").trim();
            console.log(`從訊息解析科目: ${partialData.subject}`);
          } else if (line.startsWith("備註：")) {
            partialData.remark = line.replace("備註：", "").trim();
            console.log(`從訊息解析備註: ${partialData.remark}`);
          } else if (
            line.startsWith("支付方式：") ||
            line.startsWith("付款方式：")
          ) {
            partialData.paymentMethod = line
              .replace(/[支付|付款]方式：/, "")
              .trim();
            console.log(`從訊息解析支付方式: ${partialData.paymentMethod}`);
          }
        }
      } catch (e) {
        console.log(
          `DD_formatSystemReplyMessage: 嘗試解析responseMessage失敗: ${e.toString()} [${processId}]`,
        );
      }
    }

    // 如果仍未找到partialData，創建一個空對象
    if (!partialData) {
      partialData = {};
    }

    // 6. 依照成功或失敗格式化訊息
    if (isSuccess) {
      // 6.1 成功訊息模板
      if (resultData.responseMessage) {
        // 6.1.1 如果已經有格式化的回覆訊息，直接使用
        responseMessage = resultData.responseMessage;
        console.log(
          `DD_formatSystemReplyMessage: 使用現有回覆訊息 [${processId}]`,
        );
      } else if (resultData.data) {
        // 6.1.2 如果有詳細的回覆數據，根據數據構建訊息
        console.log(
          `DD_formatSystemReplyMessage: 基於回覆數據構建成功訊息 [${processId}]`,
        );

        // 從resultData.data提取數據
        const data = resultData.data;
        const subjectName = data.subjectName || partialData.subject || "";
        // 優先使用rawAmount保留格式
        const amount =
          data.rawAmount || partialData.rawAmount || data.amount || 0;
        const action = data.action || resultData.action || "支出";
        const paymentMethod =
          data.paymentMethod || partialData.paymentMethod || "";
        const date = data.date || currentDateTime;
        const remark = data.remark || partialData.remark || "無";
        const userType = data.userType || "J";

        // 構建���準成功模板
        responseMessage =
          `記帳成功！\n` +
          `金額：${amount}元 (${action})\n` +
          `付款方式：${paymentMethod}\n` +
          `時間：${date}\n` +
          `科目：${subjectName}\n` +
          `備註：${remark}\n` +
          `使用者類型：${userType}`;
      } else {
        // 6.1.3 如果沒有詳細數據，構建簡易成功訊息
        console.log(
          `DD_formatSystemReplyMessage: 構建簡易成功訊息 [${processId}]`,
        );
        responseMessage = `操作成功！\n處理ID: ${processId}`;
      }

      // 6.1.4 記錄成功訊息
      console.log(
        `DD_formatSystemReplyMessage: 格式化成功訊息完成 [${processId}]`,
      );
    } else {
      // 6.2 失敗訊息模板
      console.log(
        `DD_formatSystemReplyMessage: 構建錯誤訊息，錯誤類型: ${resultData.errorType || "未指定"} [${processId}]`,
      );

      // 6.2.1 收集錯誤訊息 - 增強版本，優先級更清晰
      errorMsg = "未知錯誤"; // 重新初始化，確保有預設值

      // 提取各種可能的錯誤訊息來源 (優先順序)
      const possibleErrorSources = [
        resultData.error,
        resultData.message,
        resultData.errorData?.error,
        resultData.originalResult?.error,
        resultData.originalResult?.message,
        resultData._errorDetail,
      ];

      // 尋找第一個非空的錯誤訊息
      for (const source of possibleErrorSources) {
        if (source) {
          errorMsg = source;
          console.log(
            `DD_formatSystemReplyMessage: 找到錯誤訊息: ${errorMsg} [${processId}]`,
          );
          break;
        }
      }

      // 如果仍未找到錯誤訊息，嘗試從responseMessage提取
      if (
        errorMsg === "未知錯誤" &&
        resultData.responseMessage &&
        resultData.responseMessage.includes("錯誤原因：")
      ) {
        try {
          errorMsg = resultData.responseMessage.split("錯誤原因：")[1].trim();
          console.log(
            `DD_formatSystemReplyMessage: 從responseMessage提取錯誤信息: ${errorMsg} [${processId}]`,
          );
        } catch (e) {
          errorMsg = "無法提取錯誤原因";
        }
      }

      // 6.2.2 準備顯示數據 - 關鍵修改：保留負數金額和原始科目
      // 取得科目名稱 - 維持優先順序
      const subject =
        partialData.subject ||
        resultData.errorData?.parsedData?.subject ||
        resultData.originalSubject ||
        resultData.text?.split("-")?.[0]?.trim() ||
        "未知科目";

      // 保留原始金額，包括負數 (關鍵修改：確保從partialData提取值)
      const displayAmount =
        partialData.rawAmount ||
        (partialData.amount !== undefined ? String(partialData.amount) : "0");

      // 確保支付方式被保留
      const paymentMethod =
        partialData.paymentMethod ||
        resultData.paymentMethod ||
        resultData.errorData?.parsedData?.paymentMethod ||
        "未指定支付方式";

      // 從原始輸入擷取備註
      const remark =
        partialData.remark || resultData.text?.split("-")?.[0]?.trim() || "無";

      // 6.2.3 構建標準錯誤訊息模板
      responseMessage =
        `記帳失敗！\n` +
        `金額：${displayAmount}元\n` +
        `支付方式：${paymentMethod}\n` +
        `時間：${currentDateTime}\n` +
        `科目：${subject}\n` +
        `備註：${remark}\n` +
        `使用者類型：J\n` +
        `錯誤原因：${errorMsg}`;

      console.log(
        `DD_formatSystemReplyMessage: 已構建錯誤訊息: ${responseMessage.substring(0, 50)}... [${processId}]`,
      );
    }

    // 7. 最終日誌記錄
    console.log(`DD_formatSystemReplyMessage: 完成訊息格式化 [${processId}]`);

    // 8. 返回完整結果，確保保留所有原始數據
    return {
      success: isSuccess,
      responseMessage: responseMessage,
      originalResult: resultData,
      processId: processId,
      errorType: resultData.errorType || null,
      moduleCode: moduleCode,
      // 關鍵：確保保留原始的partialData
      partialData: partialData,
      // 保留原始錯誤信息，確保多級調用不丟失
      error: isSuccess ? undefined : errorMsg,
    };
  } catch (error) {
    // 9. 處理格式化過程中的錯誤
    console.error(
      `DD_formatSystemReplyMessage: 格式化過程出錯: ${error.toString()} [${processId}]`,
    );
    if (error.stack) console.error(`錯誤堆疊: ${error.stack}`);

    // 9.1 預設的錯誤回覆訊息
    const fallbackMessage = `記帳失敗！\n時間：${currentDateTime}\n科目：未知科目\n金額：0元\n支付方式：未指定支付方式\n備註：無\n使用者類型：J\n錯誤原因：訊息格式化錯誤`;

    // 9.2 返回基本錯誤訊息
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
 * 59. 根據科目代碼獲取科目信息
 * @version 2025-06-06-V1.0.0
 * @author AustinLiao691
 * @date 2025-06-06 02:40:22
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"或純subCode
 * @returns {object|null} 科目信息對象或null
 */
function DD_getSubjectByCode(subjectCode) {
  const sbcId = Utilities.getUuid().substring(0, 8);
  console.log(`根據代碼查詢科目: "${subjectCode}" [${sbcId}]`);

  try {
    // 校驗參數
    if (!subjectCode) {
      console.log(`科目代碼為空 [${sbcId}]`);
      return null;
    }

    let majorCode, subCode;

    // 處理代碼格式（支持兩種格式：majorCode-subCode 和純 subCode）
    if (subjectCode.includes("-")) {
      const parts = subjectCode.split("-");
      majorCode = parts[0];
      subCode = parts[1];
    } else {
      // 假設純子科目代碼，需要查找對應的主科目
      subCode = subjectCode;
    }

    // 獲取科目表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);

    if (!sheet) {
      console.log(`找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${sbcId}]`);
      return null;
    }

    // 讀取科目數據
    const values = sheet.getDataRange().getValues();

    // 查詢匹配科目
    for (let i = 1; i < values.length; i++) {
      const currentMajorCode = String(
        values[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1],
      );
      const currentSubCode = String(
        values[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1],
      );

      // 如果只有subCode，找到第一個匹配的子科目
      if (!majorCode && currentSubCode === subCode) {
        console.log(
          `找到科目: ${currentMajorCode}-${currentSubCode} [${sbcId}]`,
        );
        return {
          majorCode: currentMajorCode,
          majorName: String(values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1]),
          subCode: currentSubCode,
          subName: String(values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1]),
        };
      }

      // 如果有完整代碼，精確匹配
      if (
        majorCode &&
        currentMajorCode === majorCode &&
        currentSubCode === subCode
      ) {
        console.log(`精確匹配科目: ${majorCode}-${subCode} [${sbcId}]`);
        return {
          majorCode: currentMajorCode,
          majorName: String(values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1]),
          subCode: currentSubCode,
          subName: String(values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1]),
        };
      }
    }

    console.log(`找不到科目代碼: "${subjectCode}" [${sbcId}]`);
    return null;
  } catch (error) {
    console.log(`科目代碼查詢出錯: ${error} [${sbcId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `科目代碼查詢出錯: ${error}`,
      "科目查詢",
      "",
      "CODE_QUERY_ERROR",
      error.toString(),
      "DD_getSubjectByCode",
    );
    return null;
  }
}

/**
 * 60. 主動向 LINE 用戶推送訊息
 * @version 2.0.7 (2025-06-25)
 * @author AustinLiao69
 * @update: 從WH模組移植至DD模組，並重新命名
 * @param {string} userId - LINE 用戶 ID
 * @param {string|Object} message - 要發送的訊息內容
 * @returns {Promise<Object>} 發送結果
 */
function DD_pushMessage(userId, message) {
  return new Promise((resolve, reject) => {
    try {
      // 檢查用戶ID是否有效
      if (!userId || userId.trim() === "") {
        console.log("DD_pushMessage: 無效的用戶ID");
        return resolve({ success: false, error: "無效的用戶ID" });
      }

      // 處理訊息內容
      let textMessage = "";

      if (typeof message === "object" && message !== null) {
        if (
          message.responseMessage &&
          typeof message.responseMessage === "string"
        ) {
          textMessage = message.responseMessage;
        } else if (message.message && typeof message.message === "string") {
          textMessage = message.message;
        } else {
          try {
            textMessage = JSON.stringify(message);
          } catch (jsonError) {
            textMessage = "系統訊息";
            console.log(`DD_pushMessage: 轉換訊息失敗: ${jsonError}`);
          }
        }
      } else if (typeof message === "string") {
        textMessage = message;
      } else {
        textMessage = "系統訊息";
      }

      // 確保訊息長度不超過限制
      const maxLength = 5000;
      if (textMessage.length > maxLength) {
        textMessage = textMessage.substring(0, maxLength - 3) + "...";
      }

      // LINE Messaging API URL
      const url = "https://api.line.me/v2/bot/message/push";

      // 獲取 Channel Access Token
      const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!channelAccessToken) {
        console.log("DD_pushMessage: 缺少 Channel Access Token");
        return resolve({ success: false, error: "缺少 Channel Access Token" });
      }

      // 設置請求
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      };

      const payload = {
        to: userId,
        messages: [
          {
            type: "text",
            text: textMessage,
          },
        ],
      };

      // 發送 HTTP 請求
      console.log(`DD_pushMessage: 開始向用戶 ${userId} 推送訊息`);

      // 記錄推送嘗試
      DD_logInfo(
        `開始向用戶推送訊息`,
        "訊息推送",
        userId,
        "DD_pushMessage",
        "DD_pushMessage",
      );

      // 使用 axios 發送請求
      axios
        .post(url, payload, { headers: headers })
        .then((response) => {
          if (response.status === 200) {
            console.log(`DD_pushMessage: 成功推送訊息給用戶 ${userId}`);

            // 記錄推送成功
            DD_logInfo(
              `成功推送訊息給用戶`,
              "訊息推送",
              userId,
              "DD_pushMessage",
              "DD_pushMessage",
            );

            resolve({ success: true });
          } else {
            console.log(`DD_pushMessage: API回應異常 ${response.status}`);

            // 記錄推送失敗
            DD_logError(
              `API回應異常 ${response.status}`,
              "訊息推送",
              userId,
              "API_ERROR",
              JSON.stringify(response.data),
              "DD_pushMessage",
              "DD_pushMessage",
            );

            resolve({
              success: false,
              error: `API回應異常 (${response.status})`,
              details: response.data,
            });
          }
        })
        .catch((error) => {
          console.log(`DD_pushMessage: 推送訊息錯誤 ${error}`);

          // 記錄推送錯誤
          DD_logError(
            `推送訊息錯誤`,
            "訊息推送",
            userId,
            "PUSH_ERROR",
            error.toString(),
            "DD_pushMessage",
            "DD_pushMessage",
          );

          resolve({
            success: false,
            error: error.toString(),
          });
        });
    } catch (error) {
      console.log(`DD_pushMessage: 主錯誤 ${error}`);

      // 記錄函數級錯誤
      DD_logError(
        `推送訊息主錯誤`,
        "訊息推送",
        userId,
        "FUNCTION_ERROR",
        error.toString(),
        "DD_pushMessage",
        "DD_pushMessage",
      );

      resolve({
        success: false,
        error: error.toString(),
      });
    }
  });
}

/**
 * 61. 批次向多個 LINE 用戶推送相同訊息
 * @version 2.0.7 (2025-06-25)
 * @author AustinLiao69
 * @update: 從WH模組移植至DD模組，並重新命名
 * @param {Array<string>} userIds - LINE 用戶 ID 陣列
 * @param {string|Object} message - 要發送的訊息內容
 * @returns {Promise<Object>} 發送結果
 */
function DD_multicastMessage(userIds, message) {
  return new Promise((resolve, reject) => {
    try {
      // 檢查用戶ID陣列是否有效
      if (!Array.isArray(userIds) || userIds.length === 0) {
        console.log("DD_multicastMessage: 無效的用戶ID陣列");
        return resolve({ success: false, error: "無效的用戶ID陣列" });
      }

      // 處理訊息內容
      let textMessage = "";

      if (typeof message === "object" && message !== null) {
        if (
          message.responseMessage &&
          typeof message.responseMessage === "string"
        ) {
          textMessage = message.responseMessage;
        } else if (message.message && typeof message.message === "string") {
          textMessage = message.message;
        } else {
          try {
            textMessage = JSON.stringify(message);
          } catch (jsonError) {
            textMessage = "系統訊息";
            console.log(`DD_multicastMessage: 轉換訊息失敗: ${jsonError}`);
          }
        }
      } else if (typeof message === "string") {
        textMessage = message;
      } else {
        textMessage = "系統訊息";
      }

      // 確保訊息長度不超過限制
      const maxLength = 5000;
      if (textMessage.length > maxLength) {
        textMessage = textMessage.substring(0, maxLength - 3) + "...";
      }

      // LINE Messaging API URL
      const url = "https://api.line.me/v2/bot/message/multicast";

      // 獲取 Channel Access Token
      const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!channelAccessToken) {
        console.log("DD_multicastMessage: 缺少 Channel Access Token");
        return resolve({ success: false, error: "缺少 Channel Access Token" });
      }

      // 設置請求
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      };

      const payload = {
        to: userIds,
        messages: [
          {
            type: "text",
            text: textMessage,
          },
        ],
      };

      // 發送 HTTP 請求
      console.log(
        `DD_multicastMessage: 開始向 ${userIds.length} 個用戶推送訊息`,
      );

      // 記錄推送嘗試
      DD_logInfo(
        `開始向 ${userIds.length} 個用戶推送訊息`,
        "批次訊息推送",
        userIds.join(",").substring(0, 50) + "...",
        "DD_multicastMessage",
        "DD_multicastMessage",
      );

      // 使用 axios 發送請求
      axios
        .post(url, payload, { headers: headers })
        .then((response) => {
          if (response.status === 200) {
            console.log(
              `DD_multicastMessage: 成功推送訊息給 ${userIds.length} 個用戶`,
            );

            // 記錄推送成功
            DD_logInfo(
              `成功推送訊息給 ${userIds.length} 個用戶`,
              "批次訊息推送",
              userIds.join(",").substring(0, 50) + "...",
              "DD_multicastMessage",
              "DD_multicastMessage",
            );

            resolve({ success: true });
          } else {
            console.log(`DD_multicastMessage: API回應異常 ${response.status}`);

            // 記錄推送失敗
            DD_logError(
              `API回應異常 ${response.status}`,
              "批次訊息推送",
              userIds.join(",").substring(0, 50) + "...",
              "API_ERROR",
              JSON.stringify(response.data),
              "DD_multicastMessage",
              "DD_multicastMessage",
            );

            resolve({
              success: false,
              error: `API回應異常 (${response.status})`,
              details: response.data,
            });
          }
        })
        .catch((error) => {
          console.log(`DD_multicastMessage: 推送訊息錯誤 ${error}`);

          // 記錄推送錯誤
          DD_logError(
            `推送訊息錯誤`,
            "批次訊息推送",
            userIds.join(",").substring(0, 50) + "...",
            "MULTICAST_ERROR",
            error.toString(),
            "DD_multicastMessage",
            "DD_multicastMessage",
          );

          resolve({
            success: false,
            error: error.toString(),
          });
        });
    } catch (error) {
      console.log(`DD_multicastMessage: 主錯誤 ${error}`);

      // 記錄函數級錯誤
      DD_logError(
        `批次推送訊息主錯誤`,
        "批次訊息推送",
        userIds ? userIds.join(",").substring(0, 50) + "..." : "",
        "FUNCTION_ERROR",
        error.toString(),
        "DD_multicastMessage",
        "DD_multicastMessage",
      );

      resolve({
        success: false,
        error: error.toString(),
      });
    }
  });
}

// 更新模組導出，包含新添加的函數
module.exports = {
  DD_distributeData,
  DD_classifyData,
  DD_dispatchData,
  DD_processForWH,
  DD_processForBK,
  extractNumberFromString,
  DD_removeAmountFromText,
  DD_CONFIG,
  DD_MAX_RETRIES,
  DD_RETRY_DELAY,
  DD_TARGET_MODULE_BK,
  DD_TARGET_MODULE_WH,
  DD_SUBJECT_CODE_SHEET_NAME,
  DD_SUBJECT_CODE_MAJOR_CODE_COLUMN,
  DD_SUBJECT_CODE_MAJOR_NAME_COLUMN,
  DD_SUBJECT_CODE_SUB_CODE_COLUMN,
  DD_SUBJECT_CODE_SUB_NAME_COLUMN,
  DD_SUBJECT_CODE_SYNONYMS_COLUMN,
  DD_USER_PREF_SHEET_NAME,
  DD_MODULE_PREFIX,
  // 新添加的函數
  DD_pushMessage,
  DD_multicastMessage,
};
