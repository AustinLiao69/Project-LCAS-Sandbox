/**
 * DD1_核心協調模組_3.0.0
 * @module 核心協調模組
 * @description 根據預定義的規則將數據分配到不同的資料庫表中，處理時間戳轉換，處理Rich menu指令與使用者訊息 - 完全Firestore版本
 * @author AustinLiao69
 * @update 2025-01-09: 升級版本至3.0.0，完全遷移至Firestore資料庫，移除Google Sheets依賴，每個使用者獨立帳本
 */

/**
 * 99. 初始化檢查 - 在模組載入時執行，確保關鍵資源可用
 */
try {
  console.log(`DD模組初始化檢查 [${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}]`);
  console.log(`DD模組版本: 3.0.0 (2025-01-09) - 完全Firestore版本`);
  console.log(`執行時間 (UTC+8): ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);

  // 檢查 Firestore 連接
  console.log(`Firestore 連接檢查: ${db ? "成功" : "失敗"}`);
  
  console.log(
    `BK_processBookkeeping函數檢查: ${BK && typeof BK.BK_processBookkeeping === "function" ? "存在" : "不存在"}`,
  );
} catch (error) {
  console.log(`DD模組初始化錯誤: ${error.toString()}`);
  if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
}

/**
 * 98. 各種定義
 */
const DD_TARGET_MODULE_BK = "BK"; // 記帳處理模組
const DD_TARGET_MODULE_WH = "WH"; // Webhook 模組
const DD_MODULE_PREFIX = "DD_";
const DD_CONFIG = {
  DEBUG: false, // 關閉DEBUG模式減少日誌輸出
  TIMEZONE: "Asia/Taipei", // GMT+8 台灣時區
  DEFAULT_SUBJECT: "其他支出",
};

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

// 引入 Firebase Admin SDK
const admin = require("firebase-admin");

// 初始化 Firebase（如果尚未初始化）
if (!admin.apps.length) {
  const serviceAccount = require("./Serviceaccountkey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

// 直接載入模組
const BK = require("./2001. BK.js");
const DL = require("./2010. DL.js");

// 替代 Google Apps Script 的 Utilities 物件
const Utilities = {
  getUuid: () => uuidv4(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// 定義重試配置
const DD_MAX_RETRIES = 3; // 最大重試次數
const DD_RETRY_DELAY = 1000; // 重試延遲時間（毫秒）

/**
 * 01. 獲取所有科目資料 - Firestore版本
 * @version 2025-01-09-V3.0.0
 * @date 2025-01-09 16:00:00
 * @update: 完全重寫，移除預設ledgerID，每個使用者獨立帳本
 * @param {string} userId - 使用者ID (必須提供)
 * @returns {Array} 科目陣列
 */
async function DD_getAllSubjects(userId) {
  try {
    // 檢查必要參數
    if (!userId) {
      throw new Error("缺少使用者ID，每個使用者都需要獨立的帳本");
    }

    // 使用用戶獨立帳本
    const ledgerId = `user_${userId}`;
    console.log(`開始從Firestore獲取科目資料，使用者帳本: ${ledgerId}`);

    const subjectsRef = db
      .collection("ledgers")
      .doc(ledgerId)
      .collection("subjects");
    const snapshot = await subjectsRef.where("isActive", "==", true).get();

    if (snapshot.empty) {
      console.log(`使用者 ${userId} 沒有找到任何科目資料`);
      return [];
    }

    const subjects = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // 跳過template文件
      if (doc.id === "template") return;

      subjects.push({
        majorCode: data.大項代碼,
        majorName: data.大項名稱,
        subCode: data.子項代碼,
        subName: data.子項名稱,
        synonyms: data.同義詞 || "",
      });
    });

    console.log(`成功獲取使用者 ${userId} 的 ${subjects.length} 個科目`);
    return subjects;
  } catch (error) {
    console.log(`獲取科目資料失敗: ${error.toString()}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    throw error;
  }
}

/**
 * 02. 寫入日誌到Firestore - 完全重寫版本
 * @version 2025-01-09-V3.0.0
 * @date 2025-01-09 16:00:00
 * @update: 完全重寫，移除預設ledgerID，每個使用者獨立帳本
 * @param {string} severity - 嚴重等級
 * @param {string} message - 日誌訊息
 * @param {string} operationType - 操作類型
 * @param {string} userId - 使用者ID (必須提供)
 * @param {string} errorCode - 錯誤代碼
 * @param {string} source - 來源模組，預設為"DD"
 * @param {string} errorDetails - 錯誤詳情
 * @param {number} retryCount - 重試次數
 * @param {string} location - 程式碼位置
 * @param {string} functionName - 函數名稱
 */
async function DD_writeToLogSheet(
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
    // 檢查必要參數
    if (!userId) {
      throw new Error("缺少使用者ID，每個使用者都需要獨立的帳本");
    }

    // 使用用戶獨立帳本
    const ledgerId = `user_${userId}`;

    // 建立日誌資料
    const logData = {
      時間: admin.firestore.Timestamp.now(),
      訊息: message,
      操作類型: operationType,
      UID: userId,
      錯誤代碼: errorCode,
      來源: source,
      錯誤詳情: errorDetails,
      重試次數: retryCount,
      程式碼位置: location,
      嚴重等級: severity,
      函數名稱: functionName,
    };

    // 寫入 Firestore
    await db.collection("ledgers").doc(ledgerId).collection("log").add(logData);
  } catch (error) {
    // 如果寫入日誌失敗，只能在控制台輸出
    console.log(`寫入日誌失敗: ${error.toString()}. 原始消息: ${message}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
  }
}

/**
 * 03. 從Firestore獲取帳本資訊
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 16:00:00
 * @param {string} userId - 使用者ID
 * @returns {Object|null} 帳本資訊或null
 */
async function DD_getLedgerInfo(userId) {
  try {
    if (!userId) {
      throw new Error("缺少使用者ID");
    }

    const ledgerId = `user_${userId}`;
    const ledgerDoc = await db.collection("ledgers").doc(ledgerId).get();

    if (!ledgerDoc.exists) {
      console.log(`使用者 ${userId} 的帳本不存在`);
      return null;
    }

    const data = ledgerDoc.data();
    return {
      id: ledgerId,
      name: data.name || `${userId}的帳本`,
      type: data.type || "個人帳本",
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      isActive: data.isActive || true,
    };
  } catch (error) {
    console.log(`獲取帳本資訊失敗: ${error.toString()}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    return null;
  }
}

/**
 * 05. 主要的資料分配函數（支援重試機制）
 * @version 2025-01-09-V3.0.0
 * @author AustinLiao691
 * @update: 整合DD_formatSystemReplyMessage統一處理訊息，適配Firestore異步操作，移除預設ledgerID
 * @param {object} data - 需要分配的原始數據
 * @param {string} source - 數據來源 (例如: 'Rich menu', '使用者訊息')
 * @param {number} retryCount - 當前重試次數（內部使用）
 * @returns {object} - 處理結果
 */
async function DD_distributeData(data, source, retryCount = 0) {
  // 檢查必要參數
  const userId = data.user_id || data.userId;
  if (!userId) {
    console.log("DD_distributeData: 缺少使用者ID");
    return {
      success: false,
      error: "缺少使用者ID，每個使用者都需要獨立的帳本",
      errorType: "MISSING_USER_ID",
    };
  }

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
    `DD_distributeData被調用，數據源: ${source}, 用戶ID: ${userId}, 時間: ${new Date().toISOString()}`,
  );

  const processId = Utilities.getUuid().substring(0, 8);
  console.log(`處理ID: ${processId}`);
  await DD_logInfo(
    `開始處理數據 [${processId}]`,
    "數據分配",
    userId,
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
    await DD_logDebug(
      `處理數據: ${dataPreview}, 來源: ${source}`,
      "數據接收",
      userId,
      "DD_distributeData",
      "DD_distributeData",
    );

    // 處理時間戳（如果存在）
    if (data && data.timestamp) {
      console.log(`處理時間戳: ${data.timestamp}`);
      await DD_logDebug(
        `處理時間戳: ${data.timestamp}`,
        "數據處理",
        userId,
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
        await DD_logDebug(
          `時間戳轉換結果: ${data.convertedDate} ${data.convertedTime}`,
          "數據處理",
          userId,
          "DD_distributeData",
          "DD_distributeData",
        );
      } else {
        console.log(`警告: 時間戳轉換失敗: ${data.timestamp}`);
        await DD_logWarning(
          `時間戳轉換失敗: ${data.timestamp}`,
          "數據處理",
          userId,
          "DD_distributeData",
          "DD_distributeData",
        );
      }
    }

    // 如果是使用者訊息，先處理訊息內容
    if (source === "使用者訊息" && data && data.text) {
      console.log(`處理用戶訊息: "${data.text}"`);
      await DD_logInfo(
        `處理用戶訊息: "${data.text}"`,
        "訊息處理",
        userId,
        "DD_distributeData",
        "DD_distributeData",
      );

      const processedData = await DD2.DD_processUserMessage(
        data.text,
        userId,
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
        await DD_logInfo(
          `成功解析訊息: 科目=${processedData.subjectName}, 金額=${processedData.amount}, 支付方式=${processedData.paymentMethod || "預設"}`,
          "訊息處理",
          userId,
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
        await DD_logWarning(
          `訊息解析失敗但有錯誤訊息: ${processedData.errorMessage}`,
          "訊息處理",
          userId,
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
            userId: userId,
            replyToken: data.replyToken,
            processId: processId,
          },
        );
      } else {
        // 處理失敗的情況
        console.log(
          `訊息解析失敗: ${processedData ? processedData.reason : "未知原因"}`,
        );
        await DD_logWarning(
          `訊息解析失敗: ${processedData ? processedData.reason : "未知原因"}`,
          "訊息處理",
          userId,
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
            userId: userId,
            replyToken: data.replyToken,
            processId: processId,
            errorMessage: "無法解析您的記帳信息，請檢查格式後重試。",
          },
        );
      }
    }

    // 6. 根據數據屬性進行分類
    console.log(`開始分類數據`);
    await DD_logInfo(
      `開始分類數據`,
      "數據分類",
      userId,
      "DD_distributeData",
      "DD_distributeData",
    );

    const category = DD_classifyData(data, source);
    console.log(`數據分類結果: ${category}`);
    await DD_logInfo(
      `數據分類結果: ${category}`,
      "數據分類",
      userId,
      "DD_distributeData",
      "DD_distributeData",
    );

    // 7. 根據分類結果分發數據
    console.log(`開始分發數據至 ${category}`);
    await DD_logInfo(
      `開始分發數據至 ${category}`,
      "數據分發",
      userId,
      "DD_distributeData",
      "DD_distributeData",
    );

    const dispatchResult = await DD_dispatchData(data, category);
    console.log(`數據分發完成，結果: ${JSON.stringify(dispatchResult)}`);
    await DD_logInfo(
      `數據分發完成，結果: ${JSON.stringify(dispatchResult)}`,
      "數據分發",
      userId,
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
        userId: userId,
        replyToken: data.replyToken,
        processId: processId,
      },
    );
  } catch (error) {
    // 記錄原始錯誤
    console.log(`數據處理錯誤: ${error.toString()}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_logError(
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
      await DD_logWarning(
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
 * 09. 數據分類函數
 * @param {object} data - 需要分類的數據
 * @param {string} source - 數據來源
 * @returns {string} - 數據的類別 (用於決定分發到哪個模組)
 */
function DD_classifyData(data, source) {
  let category = "default";
  const userId = data.user_id || data.userId;

  // 獲取進程ID用於日誌追蹤
  const classifyId = Utilities.getUuid().substring(0, 8);
  console.log(`開始分類，來源: ${source} [${classifyId}]`);
  DD_logDebug(
    `開始分類，來源: ${source} [${classifyId}]`,
    "數據分類",
    userId,
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
          userId,
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
          userId,
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
        userId,
        "DD_classifyData",
        "DD_classifyData",
      );
    }

    console.log(`分類結果: ${category} [${classifyId}]`);
    DD_logDebug(
      `分類結果: ${category} [${classifyId}]`,
      "數據分類",
      userId,
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
      userId,
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
 * @author AustinLiao691
 * @date 2025-01-09 16:00:00
 * @update: 統一使用58號函數(DD_formatSystemReplyMessage)處理系統回覆訊息，適配Firestore異步操作
 * @param {object} data - 需要分發的數據
 * @param {string} targetModule - 目標模組的名稱
 * @returns {object} - 處理結果
 */
async function DD_dispatchData(data, targetModule) {
  const dispatchId = Utilities.getUuid().substring(0, 8);
  const userId = data.user_id || data.userId || "";

  console.log(`開始分發數據至 ${targetModule} [${dispatchId}]`);
  await DD_logInfo(
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
        await DD_logInfo(
          `轉發到BK模組 [${dispatchId}]`,
          "數據分發",
          userId,
          "DD_dispatchData",
          "DD_dispatchData",
        );

        // 檢查DD_processForBK函數是否存在
        if (typeof DD_processForBK !== "function") {
          console.log(`DD_processForBK函數不存在 [${dispatchId}]`);
          await DD_logError(
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
            await DD_logError(
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
        await DD_logInfo(
          `轉發到WH模組 [${dispatchId}]`,
          "數據分發",
          userId,
          "DD_dispatchData",
          "DD_dispatchData",
        );

        // 檢查DD_processForWH函數是否存在
        if (typeof DD_processForWH !== "function") {
          console.log(`DD_processForWH函數不存在 [${dispatchId}]`);
          await DD_logError(
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
            await DD_logError(
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
        await DD_logError(
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
    await DD_logInfo(
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
    await DD_logError(
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
 * @date 2025-01-09 16:00:00
 * @update: 修正用词"付款方式"为"支付方式"，移除支付方式默認值，增加收支ID显示，適配Firestore異步操作
 * @param {Object} data - 來自DD_processUserMessage或其他來源的數據
 * @return {Object} 處理結果
 */
async function DD_processForBK(data) {
  try {
    // 確保處理ID存在
    const processId = data.processId || Utilities.getUuid().substring(0, 8);

    // 正確獲取userId - 修復：從data物件中提取userId
    const userId = data.userId || data.user_id || "";

    // 檢查必要參數
    if (!userId) {
      throw new Error("缺少使用者ID，每個使用者都需要獨立的帳本");
    }

    // 記錄開始處理
    await DD_logInfo(
      `開始處理記帳數據 [${processId}]`,
      "記帳處理",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );

    // 檢查必要字段
    if (!data.action) {
      await DD_logWarning(
        `缺少必要字段: action [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("缺少必要字段: action");
    }
    if (!data.subjectName) {
      await DD_logWarning(
        `缺少必要字段: subjectName [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("缺少必要字段: subjectName");
    }
    if (!data.amount || data.amount <= 0) {
      await DD_logWarning(
        `無效的金額: ${data.amount} [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("無效的金額");
    }
    if (!data.majorCode) {
      await DD_logWarning(
        `缺少必要字段: majorCode [${processId}]`,
        "數據驗證",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
      throw new Error("缺少必要字段: majorCode");
    }
    if (!data.subCode) {
      await DD_logWarning(
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
      text: data.text || "", // 使用DD處理過的文字（已移除金額）
      formatId: data.formatId || "", // 匹配的格式ID
      originalSubject: data.originalSubject || "", // 用戶輸入的原始科目
      userId: userId, // 用戶ID
      userType: userType, // 用戶類型
      processId: processId, // 處理ID
    };

    // 記錄完整數據
    await DD_logDebug(
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
    await DD_logInfo(
      `開始調用BK_processBookkeeping [${processId}]`,
      "模組調用",
      userId,
      "DD_processForBK",
      "DD_processForBK",
    );

    console.log(
      `[${processId}] 即將調用 BK.BK_processBookkeeping，數據: ${JSON.stringify(bookkeepingData).substring(0, 200)}...`,
    );
    const result = await BK.BK_processBookkeeping(bookkeepingData);
    console.log(
      `[${processId}] BK.BK_processBookkeeping 返回結果: ${JSON.stringify(result).substring(0, 300)}...`,
    );

    await DD_logInfo(
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
      await DD_logInfo(
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
      await DD_logWarning(
        `記帳失敗: ${result.error || result.message} [${processId}]`,
        "記帳結果",
        userId,
        "DD_processForBK",
        "DD_processForBK",
      );
    }

    await DD_logInfo(
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
    const userId =
      data && (data.userId || data.user_id) ? data.userId || data.user_id : "";

    // 記錄錯誤
    await DD_logError(
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
async function DD_log(
  level,
  message,
  operationType = "",
  userId = "",
  options = {},
) {
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
  await DD_writeToLogSheet(
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
async function DD_logDebug(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  await DD_log("DEBUG", message, operationType, userId, {
    location,
    functionName,
  });
}

async function DD_logInfo(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  await DD_log("INFO", message, operationType, userId, {
    location,
    functionName,
  });
}

async function DD_logWarning(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  await DD_log("WARNING", message, operationType, userId, {
    location,
    functionName,
  });
}

async function DD_logError(
  message,
  operationType = "",
  userId = "",
  errorCode = "",
  errorDetails = "",
  location = "",
  functionName = "",
) {
  await DD_log("ERROR", message, operationType, userId, {
    errorCode,
    errorDetails,
    location,
    functionName,
  });
}

async function DD_logCritical(
  message,
  operationType = "",
  userId = "",
  errorCode = "",
  errorDetails = "",
  location = "",
  functionName = "",
) {
  await DD_log("CRITICAL", message, operationType, userId, {
    errorCode,
    errorDetails,
    location,
    functionName,
  });
}

/**
 * 60. 產生處理ID
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 16:00:00
 */
function generateProcessId() {
  return uuidv4().substring(0, 8);
}

/**
 * 61. 時間戳轉換函數 - Firestore版本
 * @version 2025-01-09-V3.0.0
 * @date 2025-01-09 16:00:00
 * @update: 完全重寫，使用Firestore資料庫
 */
function DD_convertTimestamp(timestamp) {
  const tsId = uuidv4().substring(0, 8);
  console.log(`開始轉換時間戳: ${timestamp} [${tsId}]`);

  try {
    if (timestamp === null || timestamp === undefined) {
      console.log(`時間戳為空 [${tsId}]`);
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
      console.log(`無法轉換為有效日期: ${timestamp} [${tsId}]`);
      return null;
    }

    // 轉換為台灣時區
    const taiwanDate = formatDate(date);
    const taiwanTime = formatTime(date);

    const result = {
      date: taiwanDate,
      time: taiwanTime,
    };

    console.log(`時間戳轉換結果: ${taiwanDate} ${taiwanTime} [${tsId}]`);
    return result;
  } catch (error) {
    console.log(`時間戳轉換錯誤: ${error.toString()} [${tsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    return null;
  }
}

// 格式化時間函數
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// 引入DD3模組的格式化函數
const DD3 = require("./2033. DD3.js");
const { DD_formatSystemReplyMessage } = DD3;

// 引入其他模組
const WH = require('./2020. WH.js');
const DD2 = require('./2032. DD2.js');

// 導出需要的函數
module.exports = {
  DD_distributeData,
  DD_getAllSubjects,
  DD_writeToLogSheet,
  DD_getLedgerInfo,
  DD_convertTimestamp,
  DD_formatSystemReplyMessage,
  DD_log,
  DD_logDebug,
  DD_logInfo,
  DD_logWarning,
  DD_logError,
  DD_logCritical,
  generateProcessId,
};