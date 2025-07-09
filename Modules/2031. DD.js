/**
 * DD_資料分配模組_3.0.0
 * @module 資料分配模組
 * @description 根據預定義的規則將數據分配到不同的Firestore collections中，處理時間戳轉換，處理Rich menu指令與使用者訊息。
 * @author AustinLiao69
 * @update 2025-01-09: 升級至3.0.0版本，遷移至Firestore資料庫架構，移除Google Sheets依賴
 */

// 引入其他模組
const BK = require("./2001. BK.js");
const DL = require("./2010. DL.js");
const FS = require("./2011. FS.js"); // 引入Firestore模組

// 確保BK函數正確引用
const { BK_processBookkeeping } = BK;

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

// 從2011模組獲取Firestore實例
const admin = require('firebase-admin');
const db = admin.firestore();

// 替代 Google Apps Script 的 Utilities 物件
const Utilities = {
  getUuid: () => uuidv4(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  formatDate: (date, timezone, format) => {
    const momentDate = moment(date).tz(timezone || "Asia/Taipei");

    if (format === "yyyy/MM/dd HH:mm") {
      return momentDate.format("YYYY/MM/DD HH:mm");
    } else if (format === "yyyy/M/d") {
      return momentDate.format("YYYY/M/D");
    } else if (format === "HH:mm") {
      return momentDate.format("HH:mm");
    } else if (format === "yyyy-MM-dd HH:mm:ss") {
      return momentDate.format("YYYY-MM-DD HH:mm:ss");
    }
    return momentDate.format();
  }
};

/**
 * 99. 初始化檢查 - 在模組載入時執行，確保關鍵資源可用
 */
try {
  console.log(`DD模組初始化檢查 [${new Date().toISOString()}]`);
  console.log(`DD模組版本: 3.0.0 (2025-01-09)`);
  console.log(`執行時間: ${new Date().toLocaleString()}`);

  // 檢查Firestore連接
  console.log(`Firestore連接檢查: ${db ? "成功" : "失敗"}`);

  // 檢查BK模組函數
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
const DD_MODULE_PREFIX = "DD_";
const DD_CONFIG = {
  DEBUG: false,                // 關閉DEBUG模式減少日誌輸出
  TIMEZONE: "Asia/Taipei",     // GMT+8 台灣時區
  DEFAULT_SUBJECT: "其他支出",
  LEDGER_ID: process.env.DEFAULT_LEDGER_ID || "ledger_structure_001", // 預設帳本ID
};

/**
 * 4. 定義重試配置
 */
const DD_MAX_RETRIES = 3; // 最大重試次數
const DD_RETRY_DELAY = 1000; // 重試延遲時間（毫秒）

/**
 * 5. 主要的資料分配函數（支援重試機制）
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @update: 整合Firestore架構，移除Google Sheets依賴
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

      const processedData = await DD_processUserMessage(
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

        // 關鍵修正：使用處理過的文字作為備註
        data.text = processedData.text || processedData.subjectName;

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

    const dispatchResult = await DD_dispatchData(data, category);
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
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @date 2025-01-09 15:30:00
 * @update: 統一使用58號函數(DD_formatSystemReplyMessage)處理系統回覆訊息
 * @param {object} data - 需要分發的數據
 * @param {string} targetModule - 目標模組的名稱
 * @returns {object} - 處理結果
 */
async function DD_dispatchData(data, targetModule) {
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
            result = await DD_processForBK(data);
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
 * 11. 處理 Webhook 模組 (WH) 的數據
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
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @date 2025-01-09 15:30:00
 * @update: 移除Google Sheets依賴，使用Firestore架構
 * @param {Object} data - 來自DD_processUserMessage或其他來源的數據
 * @return {Object} 處理結果
 */
async function DD_processForBK(data) {
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
      // 必需字段:
      action: data.action, // 收入/支出
      subjectName: data.subjectName, // 科目名稱
      amount: data.amount, // 金額
      majorCode: data.majorCode, // 主科目代碼
      subCode: data.subCode, // 子科目代碼

      // 可選但重要字段
      majorName: data.majorName || "", // 主科目名稱
      paymentMethod: data.paymentMethod, // 支付方式 - 移除默認值
      text: data.text || "", // 使用DD處理過的文字（已移除金額）
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

    console.log(`[${processId}] 即將調用 BK.BK_processBookkeeping，數據: ${JSON.stringify(bookkeepingData).substring(0, 200)}...`);
    const result = await BK.BK_processBookkeeping(bookkeepingData);
    console.log(`[${processId}] BK.BK_processBookkeeping 返回結果: ${JSON.stringify(result).substring(0, 300)}...`);

    DD_logInfo(
      `BK_processBookkeeping調用完成，結果: ${result && result.success ? "成功" : "失敗"} [${processId}]`,
      "模組調用",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );

    // 構建回覆訊息
    let responseMessage = "";
    if (result.success) {
      // 成功回覆 - 修正"付款方式"為"支付方式"，並添加收支ID、備註和使用者類型
      responseMessage = `記帳成功！\n金額：${bookkeepingData.amount}元 (${bookkeepingData.action})\n支付方式：${result.data.paymentMethod}\n時間：${result.data.date}\n科目：${bookkeepingData.subjectName}\n備註：${result.data.remark || "無"}\n收支ID：${result.data.id || "未知"}\n使用者類型：${result.data.userType || userType || "J"}`;

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
    // 安全獲取 userId（在 catch 區塊中重新定義以確保作用域）
    const userId = data && (data.userId || data.user_id) ? (data.userId || data.user_id) : "";

    // 記錄錯誤
    DD_logError(
      `處理BK數據時出錯: ${error}`,
      "數據處理",
      userId,
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
 * 15. 處理用戶消息並提取記帳信息 - 遷移至Firestore
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @date 2025-01-09 15:30:00
 * @update: 遷移至Firestore架構，移除Google Sheets依賴，科目查詢使用Firestore collections
 * @param {string} message - 用戶輸入的消息
 * @param {string} userId - 用戶ID (可選)
 * @param {string} timestamp - 時間戳 (可選)
 * @return {Object} 處理結果
 */
async function DD_processUserMessage(message, userId = "", timestamp = "") {
  // 1. 生成處理ID
  const msgId = Utilities.getUuid().substring(0, 8);

  // 2. 開始日誌記錄
  DD_logInfo(
    `處理用戶消息: "${message}"`,
    "訊息處理",
    userId,
    "DD_processUserMessage",
    "DD_processUserMessage",
  );
  console.log(
    `DD_processUserMessage: 開始處理用戶訊息 "${message}" [${msgId}]`,
  );

  try {
    // 3. 確保配置初始化
    DD_initConfig();

    // 4. 檢查空訊息
    if (!message || message.trim() === "") {
      DD_logWarning(
        `空訊息 [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );
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
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "", // 不設置預設值，由BK處理
          timestamp: new Date().getTime(),
        },
        userFriendlyMessage:
          "記帳處理失敗 (VALIDATION_ERROR)：訊息為空\n請重新嘗試或聯繫管理員。",
      };

      // 4.3 回傳統一格式的錯誤結果
      return {
        type: "記帳",
        processed: false,
        reason: "空訊息",
        processId: msgId,
        errorType: "EMPTY_MESSAGE",
        errorData: errorData,
      };
    }

    // 5. 清理輸入訊息
    message = message.trim();
    console.log(`DD_processUserMessage: 清理後訊息: "${message}" [${msgId}]`);

    // 6. 使用DD_parseInputFormat解析輸入格式
    console.log(`DD_processUserMessage: 調用DD_parseInputFormat [${msgId}]`);
    const parseResult = DD_parseInputFormat(message, msgId);
    console.log(
      `DD_processUserMessage: DD_parseInputFormat回傳結果: ${JSON.stringify(parseResult)} [${msgId}]`,
    );

    // 7. 檢查解析結果 - 快速攔截錯誤
    if (!parseResult) {
      DD_logWarning(
        `DD_parseInputFormat回傳null，無法解析訊息格式: "${message}" [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );
      console.log(
        `DD_processUserMessage: DD_parseInputFormat回傳null [${msgId}]`,
      );

      // 7.1 建立標準錯誤資料結構，與BK模組格式相容
      const errorData = {
        success: false,
        error: "無法識別記帳意圖",
        errorType: "FORMAT_NOT_RECOGNIZED",
        message: "記帳失敗: 無法識別記帳意圖",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: message,
          amount: 0,
          rawAmount: "0",
          paymentMethod: "", // 不設置預設值，由BK處理
          timestamp: new Date().getTime(),
        },
      };

      // 7.3 回傳統一格式的錯誤結果
      return {
        type: "記帳",
        processed: false,
        reason: "無法識別記帳意圖",
        processId: msgId,
        errorType: "FORMAT_NOT_RECOGNIZED",
        errorData: errorData,
      };
    }

    // 8. 處理回傳的格式錯誤
    if (parseResult._formatError || parseResult._missingSubject) {
      DD_logWarning(
        `輸入格式錯誤: "${message}" [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );
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
          type: "記帳",
          processed: false,
          reason:
            parseResult.errorData.error ||
            parseResult._errorDetail ||
            "輸入格式問題",
          processId: msgId,
          errorType: parseResult.errorData.errorType || "FORMAT_ERROR",
          errorData: parseResult.errorData,
        };
      }

      // 8.2 自行建構符合BK模組格式的錯誤資料
      console.log(`DD_processUserMessage: 自行建構errorData [${msgId}]`);
      const errorType = parseResult._missingSubject
        ? "MISSING_SUBJECT"
        : "FORMAT_ERROR";
      const errorMsg = parseResult._errorDetail || "輸入格式錯誤";

      const errorData = {
        success: false,
        error: errorMsg,
        errorType: errorType,
        message: `記帳失敗: ${errorMsg}`,
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: parseResult.subject || "",
          amount: parseResult.amount || 0,
          rawAmount: parseResult.rawAmount || "0",
          paymentMethod: parseResult.paymentMethod || "", // 不設預設值
          timestamp: new Date().getTime(),
        },
      };

      // 8.2.2 回傳統一格式的錯誤結果
      return {
        type: "記帳",
        processed: false,
        reason: errorMsg,
        processId: msgId,
        errorType: errorType,
        errorData: errorData,
      };
    }

    // 9. 提取成功解析的結果
    const subject = parseResult.subject;
    const amount = parseResult.amount;
    const rawAmount = parseResult.rawAmount || String(amount);
    const paymentMethod = parseResult.paymentMethod; // 直接使用解析結果，不設預設值

    // 9.1 記錄解析結果，包括支付方式
    if (paymentMethod) {
      console.log(
        `DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 支付方式=${paymentMethod} [${msgId}]`,
      );
    } else {
      console.log(
        `DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 未指定支付方式 [${msgId}]`,
      );
    }

    // 10. 科目匹配處理 - 繼續現有流程
    if (subject) {
      // 只檢查科目是否存在
      console.log(`DD_processUserMessage: 開始科目匹配階段 [${msgId}]`);

      // 10.2 嘗試精確匹配
      let subjectInfo = null;
      let matchMethod = "unknown";
      let confidence = 0;
      let originalSubject = subject; // 保存原始輸入詞彙

      console.log(`DD_processUserMessage: 嘗試精確匹配 [${msgId}]`);
      DD_logInfo(
        `嘗試查詢科目代碼: "${subject}" [${msgId}]`,
        "科目匹配",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );

      try {
        subjectInfo = await DD_getSubjectCode(subject, userId);

        if (subjectInfo) {
          matchMethod = "exact_match";
          confidence = 1.0;
          console.log(
            `DD_processUserMessage: 精確匹配成功 "${subject}" -> ${subjectInfo.subName} [${msgId}]`,
          );
          DD_logInfo(
            `精確匹配成功: "${subject}" -> ${subjectInfo.subName}, 科目代碼=${subjectInfo.majorCode}-${subjectInfo.subCode}`,
            "科目匹配",
            userId,
            "DD_processUserMessage",
            "DD_processUserMessage",
          );
        } else {
          console.log(`DD_processUserMessage: 精確匹配失敗 [${msgId}]`);
          DD_logWarning(
            `精確匹配失敗: "${subject}" [${msgId}]`,
            "科目匹配",
            userId,
            "DD_processUserMessage",
            "DD_processUserMessage",
          );
        }
      } catch (matchError) {
        console.log(
          `DD_processUserMessage: 精確匹配發生錯誤 ${matchError.toString()} [${msgId}]`,
        );
      }

      // 10.4 嘗試模糊匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試模糊匹配 [${msgId}]`);
        DD_logInfo(
          `嘗試模糊匹配: "${subject}" [${msgId}]`,
          "科目匹配",
          userId,
          "DD_processUserMessage",
          "DD_processUserMessage",
        );

        try {
          const fuzzyThreshold = 0.7;
          const fuzzyMatch = await DD_fuzzyMatch(subject, userId);

          if (fuzzyMatch && fuzzyMatch.score >= fuzzyThreshold) {
            subjectInfo = fuzzyMatch;
            matchMethod = "fuzzy_match";
            confidence = fuzzyMatch.score;
            console.log(
              `DD_processUserMessage: 模糊匹配成功 "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)} [${msgId}]`,
            );
            DD_logInfo(
              `模糊匹配成功: "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)}`,
              "科目匹配",
              userId,
              "DD_processUserMessage",
              "DD_processUserMessage",
            );
          } else {
            console.log(
              `DD_processUserMessage: 模糊匹配失敗或分數低於閾值 [${msgId}]`,
            );
            DD_logWarning(
              `模糊匹配失敗或分數低於閾值: "${subject}" [${msgId}]`,
              "科目匹配",
              userId,
              "DD_processUserMessage",
              "DD_processUserMessage",
            );
          }
        } catch (fuzzyError) {
          console.log(
            `DD_processUserMessage: 模糊匹配發生錯誤 ${fuzzyError.toString()} [${msgId}]`,
          );
        }
      }

      // 11. 準備回傳結果
      if (subjectInfo) {
        console.log(
          `DD_processUserMessage: 科目匹配完成，準備回傳結果 [${msgId}]`,
        );
        DD_logInfo(
          `科目匹配完成: "${subject}" -> ${subjectInfo.subName} (${matchMethod})`,
          "科目匹配",
          userId,
          "DD_processUserMessage",
          "DD_processUserMessage",
        );

        // 11.1 決定收支類型 - 修正邏輯!
        let action = "支出"; // 預設為支出

        // 修改：處理負數金額，仍設定為支出但保留負號
        if (amount < 0) {
          action = "支出";
          console.log(
            `DD_processUserMessage: 檢測到負數金額: ${amount}，設定為支出類型 [${msgId}]`,
          );
          DD_logInfo(
            `檢測到負數金額: ${amount}，設定為支出類型`,
            "金額處理",
            userId,
            "DD_processUserMessage",
            "DD_processUserMessage",
          );
        } else {
          // 根據科目大類判斷收支類型 - 修正：以8開頭的為收入，其他為支出
          if (
            subjectInfo.majorCode &&
            subjectInfo.majorCode.toString().startsWith("8")
          ) {
            action = "收入";
            console.log(
              `DD_processUserMessage: 根據科目代碼 ${subjectInfo.majorCode} 判斷為收入 [${msgId}]`,
            );
          } else {
            action = "支出";
            console.log(
              `DD_processUserMessage: 根據科目代碼 ${subjectInfo.majorCode} 判斷為支出 [${msgId}]`,
            );
          }
        }

        // 11.2 建構回傳結果
        // 處理備註：從原始文字中移除金額部分
        const remarkText = DD_removeAmountFromText(message, amount) || subject;

        // 11.3 建構完整回傳結果
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
          paymentMethod: paymentMethod, // 直接傳遞原始值，不設預設值
          action: action,
          confidence: confidence,
          matchMethod: matchMethod,
          text: remarkText, // 移除金額後的文字作為備註
          originalSubject: originalSubject,
          processId: msgId,
        };

        // 記錄支付方式狀態
        if (paymentMethod) {
          console.log(
            `DD_processUserMessage: 用戶指定了支付方式: ${paymentMethod} [${msgId}]`,
          );
        } else {
          console.log(
            `DD_processUserMessage: 用戶未指定支付方式，保留為空 [${msgId}]`,
          );
        }

        console.log(
          `DD_processUserMessage: 回傳結果: ${JSON.stringify(result)} [${msgId}]`,
        );
        return result;
      } else {
        // 11.3 科目匹配失敗處理
        console.log(`DD_processUserMessage: 科目匹配失敗 [${msgId}]`);
        DD_logWarning(
          `科目匹配失敗: "${subject}"`,
          "科目匹配",
          userId,
          "DD_processUserMessage",
          "DD_processUserMessage",
        );

        // 建構標準錯誤資料結構
        const errorData = {
          success: false,
          error: `無法識別科目: "${subject}"`,
          errorType: "UNKNOWN_SUBJECT",
          message: `記帳失敗: 無法識別科目: "${subject}"`,
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "BK",
          },
          isRetryable: true,
          partialData: {
            subject: subject,
            amount: amount,
            rawAmount: rawAmount,
            paymentMethod: paymentMethod, // 不設預設值
            timestamp: new Date().getTime(),
          },
        };

        // 回傳統一格式的錯誤結果
        return {
          type: "記帳",
          processed: false,
          reason: `無法識別科目: "${subject}"`,
          processId: msgId,
          errorType: "UNKNOWN_SUBJECT",
          errorData: errorData,
        };
      }
    } else {
      // 12. 科目缺失處理
      console.log(`DD_processUserMessage: 科目為空 [${msgId}]`);
      DD_logWarning(
        `科目為空`,
        "科目匹配",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );

      // 建構標準錯誤資料結構
      const errorData = {
        success: false,
        error: "未指定科目",
        errorType: "MISSING_SUBJECT",
        message: "記帳失敗: 未指定科目",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod, // 不設預設值
          timestamp: new Date().getTime(),
        },
      };

      // 回傳統一格式的錯誤結果
      return {
        type: "記帳",
        processed: false,
        reason: "未指定科目",
        processId: msgId,
        errorType: "MISSING_SUBJECT",
        errorData: errorData,
      };
    }
  } catch (error) {
    // 13. 異常處理
    console.log(`DD_processUserMessage異常: ${error.toString()} [${msgId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);

    DD_logError(
      `處理用戶消息時發生異常: ${error.toString()}`,
      "訊息處理",
      userId,
      "PROCESS_ERROR",
      error.toString(),
      "DD_processUserMessage",
      "DD_processUserMessage",
    );

    // 建構標準錯誤資料結構
    const errorData = {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR",
      message: `記帳失敗: 處理異常: ${error.toString()}`,
      errorDetails: {
        processId: msgId,
        errorType: "SYSTEM_ERROR",
        module: "BK",
      },
      isRetryable: false,
    };

    // 回傳統一格式的錯誤結果
    return {
      type: "記帳",
      processed: false,
      reason: error.toString(),
      processId: msgId,
      errorType: "PROCESS_ERROR",
      errorData: errorData,
    };
  }
}

/**
 * 16. 查詢科目代碼表的函數 - 遷移至Firestore
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @date 2025-01-09 15:30:00
 * @update: 遷移至Firestore架構，支持多帳本科目查詢
 * @param {string} subjectName - 要查詢的科目名稱
 * @param {string} userId - 用戶ID（用於確定帳本）
 * @returns {object|null} - 如果找到，返回包含 {majorCode, majorName, subCode, subName} 的物件，否則返回 null
 */
async function DD_getSubjectCode(subjectName, userId = "") {
  const scId = Utilities.getUuid().substring(0, 8);
  console.log(`### 使用Firestore版本DD_getSubjectCode ###`);
  console.log(`查詢科目代碼: "${subjectName}", 用戶ID: ${userId}, ID=${scId}`);

  try {
    // 檢查參數
    if (!subjectName) {
      console.log(`科目名稱為空 [${scId}]`);
      DD_logWarning(
        `科目名稱為空，無法查詢科目代碼 [${scId}]`,
        "科目查詢",
        userId,
        "DD_getSubjectCode",
      );
      return null;
    }

    // 標準化輸入科目名稱
    const normalizedInput = String(subjectName).trim();
    const inputLower = normalizedInput.toLowerCase();
    console.log(`標準化後的輸入: "${normalizedInput}" [${scId}]`);

    // 確定帳本ID - 使用預設帳本或用戶特定帳本
    const ledgerId = DD_CONFIG.LEDGER_ID;
    console.log(`使用帳本ID: ${ledgerId} [${scId}]`);

    // 從Firestore讀取科目數據
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef.get();

    if (snapshot.empty) {
      console.log(`帳本 ${ledgerId} 的科目表為空 [${scId}]`);
      DD_logError(
        `帳本 ${ledgerId} 的科目表為空 [${scId}]`,
        "科目查詢",
        userId,
        "EMPTY_SUBJECTS",
        "科目代碼表無數據",
        "DD_getSubjectCode",
      );
      return null;
    }

    console.log(`讀取科目表: ${snapshot.docs.length}個文檔 [${scId}]`);

    // 詳細診斷日誌
    console.log(`---科目查詢診斷信息開始---[${scId}]`);
    console.log(`尋找科目: "${normalizedInput}"`);

    // ===== 第一階段：進行精確匹配 =====
    console.log(`正在進行精確匹配查詢...`);

    let docCount = 0;
    for (const doc of snapshot.docs) {
      docCount++;
      const data = doc.data();

      // 跳過template文檔
      if (doc.id === 'template') {
        continue;
      }

      const majorCode = data.大項代碼 || "";
      const majorName = data.大項名稱 || "";
      const subCode = data.子項代碼 || "";
      const subName = data.子項名稱 || "";
      const synonymsStr = data.同義詞 || "";

      // 標準化表內科目名稱
      const normalizedSubName = String(subName).trim();
      const subNameLower = normalizedSubName.toLowerCase();

      // 記錄查詢過程（前10個文檔及關鍵行）
      if (docCount <= 10 || normalizedSubName === normalizedInput) {
        console.log(
          `科目表項目 #${docCount}: 代碼=${majorCode}-${subCode}, 名稱="${normalizedSubName}"`,
        );
      }

      // 精確匹配檢查
      if (subNameLower === inputLower) {
        console.log(`找到精確匹配: "${subNameLower}" === "${inputLower}"`);

        DD_logInfo(
          `成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
          "科目查詢",
          userId,
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

      // ===== 同義詞匹配 =====
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");

        for (let j = 0; j < synonyms.length; j++) {
          const normalizedSynonym = synonyms[j].trim();
          const synonymLower = normalizedSynonym.toLowerCase();

          if (synonymLower === inputLower) {
            console.log(
              `通過同義詞匹配成功: "${synonymLower}" === "${inputLower}"`,
            );

            DD_logInfo(
              `通過同義詞成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
              "科目查詢",
              userId,
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
    console.log(`精確匹配失敗，嘗試複合詞匹配...`);

    const matches = [];

    for (const doc of snapshot.docs) {
      // 跳過template文檔
      if (doc.id === 'template') {
        continue;
      }

      const data = doc.data();
      const majorCode = data.大項代碼 || "";
      const majorName = data.大項名稱 || "";
      const subCode = data.子項代碼 || "";
      const subName = data.子項名稱 || "";
      const synonymsStr = data.同義詞 || "";
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

      // 檢查同義詞是否包含在輸入中
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const syn of synonyms) {
          const synonym = syn.trim().toLowerCase();

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
        }
      }
    }

    // 如果找到複合詞匹配，返回最佳匹配
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];

      console.log(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}, 匹配類型=${bestMatch.matchType}`,
      );
      DD_logInfo(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}`,
        "複合詞匹配",
        userId,
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
      userId,
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
      userId,
      "QUERY_ERROR",
      error.toString(),
      "DD_getSubjectCode",
    );
    return null;
  }
}

/**
 * 49. 生成記帳結果回覆訊息
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
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @date 2025-01-09 15:30:00
 * @update: 移除Google Sheets依賴，適配Firestore架構
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
      // 成功訊息
      const successResult = DD_formatUserSuccessFeedback(data, "BK", {
        operationType: "記帳",
        userId: data.userId || data.user_id || "",
      });

      return successResult.userFriendlyMessage;
    } else {
      // 失敗訊息
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
 * 55. 獲取所有科目列表（包括同義詞）- 遷移至Firestore
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @date 2025-01-09 15:30:00
 * @update: 遷移至Firestore架構，支持多帳本科目查詢
 * @param {string} userId - 用戶ID（用於確定帳本）
 * @return {Array} 科目列表
 */
async function DD_getAllSubjects(userId = "") {
  try {
    console.log("【模糊匹配】開始獲取科目列表，用戶ID:", userId);

    // 確定帳本ID
    const ledgerId = DD_CONFIG.LEDGER_ID;
    console.log("【模糊匹配】使用帳本ID:", ledgerId);

    // 獲取科目資料表
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef.get();

    if (snapshot.empty) {
      console.log("【模糊匹配】科目表為空");
      return [];
    }

    console.log(`【模糊匹配】成功讀取 ${snapshot.docs.length} 個文檔`);

    // 處理文檔數據
    const subjects = [];
    for (const doc of snapshot.docs) {
      // 跳過template文檔
      if (doc.id === 'template') {
        continue;
      }

      const data = doc.data();
      if (data.大項代碼) {
        subjects.push({
          majorCode: data.大項代碼.toString(),
          majorName: data.大項名稱 || "",
          subCode: data.子項代碼.toString(),
          subName: data.子項名稱 || "",
          synonyms: data.同義詞 || "",
        });
      }
    }

    console.log(`【模糊匹配】處理完成，共 ${subjects.length} 個科目`);
    return subjects;
  } catch (error) {
    console.log(`【模糊匹配】獲取科目列表失敗: ${error}`);
    return [];
  }
}

/**
 * 58. 格式化系統回覆訊息
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao69
 * @date 2025-01-09 15:30:00
 * @update: 保持原有訊息格式化邏輯，適配Firestore架構
 * @param {Object} resultData - 處理結果數據
 * @param {string} moduleCode - 模組代碼
 * @param {Object} options - 附加選項
 * @returns {Object} 格式化後的回覆訊息
 */
function DD_formatSystemReplyMessage(resultData, moduleCode, options = {}) {
  // 1. 初始化處理
  const userId = options.userId || "";
  const processId = options.processId || Utilities.getUuid().substring(0, 8);
  let errorMsg = "未知錯誤";
  const currentDateTime = Utilities.formatDate(
    new Date(),
    DD_CONFIG.TIMEZONE || "Asia/Taipei",
    "yyyy/MM/dd HH:mm",
  );

  console.log(
    `DD_formatSystemReplyMessage: 開始格式化訊息 [${processId}], 模組: ${moduleCode}`,
  );
  console.log(
    `DD_formatSystemReplyMessage: 輸入數據: ${JSON.stringify(resultData).substring(0, 300)}...`,
  );

  try {
    // 2. 檢查resultData是否已經包含完整的responseMessage
    if (resultData && resultData.responseMessage) {
      console.log(
        `DD_formatSystemReplyMessage: 檢測到完整responseMessage，將直接使用 [${processId}]`,
      );

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

    // 5. 從resultData中提取資料
    let partialData = null;

    const dataSources = [
      resultData.parsedData,
      resultData.partialData,
      resultData.errorData?.partialData,
      resultData.originalResult?.partialData,
      resultData._partialData,
      resultData.data,
    ];

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

    if (!partialData) {
      partialData = {};
    }

    // 6. 依照成功或失敗格式化訊息
    if (isSuccess) {
      // 6.1 成功訊息模板
      if (resultData.responseMessage) {
        responseMessage = resultData.responseMessage;
        console.log(
          `DD_formatSystemReplyMessage: 使用現有回覆訊息 [${processId}]`,
        );
      } else if (resultData.data) {
        console.log(
          `DD_formatSystemReplyMessage: 基於回覆數據構建成功訊息 [${processId}]`,
        );

        const data = resultData.data;
        const subjectName = data.subjectName || partialData.subject || "";
        const amount =
          data.rawAmount || partialData.rawAmount || data.amount || 0;
        const action = data.action || resultData.action || "支出";
        const paymentMethod =
          data.paymentMethod || partialData.paymentMethod || "";
        const date = data.date || currentDateTime;
        const remark = data.remark || partialData.remark || "無";
        const userType = data.userType || "J";

        responseMessage =
          `記帳成功！\n` +
          `金額：${amount}元 (${action})\n` +
          `付款方式：${paymentMethod}\n` +
          `時間：${date}\n` +
          `科目：${subjectName}\n` +
          `備註：${remark}\n` +
          `使用者類型：${userType}`;
      } else {
        console.log(
          `DD_formatSystemReplyMessage: 構建簡易成功訊息 [${processId}]`,
        );
        responseMessage = `操作成功！\n處理ID: ${processId}`;
      }

      console.log(
        `DD_formatSystemReplyMessage: 格式化成功訊息完成 [${processId}]`,
      );
    } else {
      // 6.2 失敗訊息模板
      console.log(
        `DD_formatSystemReplyMessage: 構建錯誤訊息，錯誤類型: ${resultData.errorType || "未指定"} [${processId}]`,
      );

      // 收集錯誤訊息
      const possibleErrorSources = [
        resultData.error,
        resultData.message,
        resultData.errorData?.error,
        resultData.originalResult?.error,
        resultData.originalResult?.message,
        resultData._errorDetail,
      ];

      for (const source of possibleErrorSources) {
        if (source) {
          errorMsg = source;
          console.log(
            `DD_formatSystemReplyMessage: 找到錯誤訊息: ${errorMsg} [${processId}]`,
          );
          break;
        }
      }

      // 準備顯示數據
      const subject =
        partialData.subject ||
        resultData.errorData?.parsedData?.subject ||
        resultData.originalSubject ||
        resultData.text?.split("-")?.[0]?.trim() ||
        "未知科目";

      const displayAmount =
        partialData.rawAmount ||
        (partialData.amount !== undefined ? String(partialData.amount) : "0");

      const paymentMethod =
        partialData.paymentMethod ||
        resultData.paymentMethod ||
        resultData.errorData?.parsedData?.paymentMethod ||
        "未指定支付方式";

      const remark =
        partialData.remark || resultData.text?.split("-")?.[0]?.trim() || "無";

      // 構建標準錯誤訊息模板
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

    // 8. 返回完整結果
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

// 輔助函數
function DD_removeAmountFromText(text, amount) {
  if (!text || !amount) return text;

  console.log(`處理文字移除金額: 原始文字="${text}", 金額=${amount}`);

  const amountStr = String(amount).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = text;

  try {
    // 1. 處理 "科目 金額" 格式
    const spacePattern = new RegExp(`\\s+${amountStr}(?:\\s|$)`, 'g');
    if (spacePattern.test(text)) {
      result = text.replace(spacePattern, '').trim();
      console.log(`使用空格格式匹配: "${result}"`);
      return result;
    }

    // 2. 處理 "科目金額" 格式
    const endPattern = new RegExp(`${amountStr}$`);
    if (endPattern.test(text)) {
      result = text.replace(endPattern, '').trim();
      console.log(`使用尾部匹配: "${result}"`);
      return result;
    }

    // 3. 處理貨幣單位
    const currencyPattern = new RegExp(`${amountStr}(元|塊|圓|NT|USD)?$`, "i");
    const match = text.match(currencyPattern);
    if (match) {
      result = text.substring(0, match.index).trim();
      console.log(`使用貨幣單位匹配: "${result}"`);
      return result;
    }

    console.log(`無法確定金額位置，保留原始文字: "${text}"`);
    return text;
  } catch (error) {
    console.log(`移除金額失敗: ${error.toString()}, 返回原始文字`);
    return text;
  }
}

// 計算Levenshtein編輯距離
function calculateLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// 模組匯出
module.exports = {
  DD_distributeData,
  DD_classifyData,
  DD_dispatchData,
  DD_processForWH,
  DD_processForBK,
  DD_CONFIG,
  DD_MAX_RETRIES,
  DD_RETRY_DELAY,
  DD_TARGET_MODULE_BK,
  DD_TARGET_MODULE_WH,
  DD_MODULE_PREFIX,
  // 主要函數
  DD_processUserMessage,
  DD_getSubjectCode,
  DD_convertTimestamp,
  DD_getAllSubjects,
  DD_fuzzyMatch,
  DD_formatSystemReplyMessage,
  DD_parseInputFormat,
  DD_removeAmountFromText,
};