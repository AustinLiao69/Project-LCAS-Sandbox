/**
 * WH_Webhook處理模組_2.0.17
 * @module Webhook模組
 * @description LINE Webhook處理模組 - 實現 BR-0007 簡化記帳路徑
 * @update 2025-07-11: 實現 BR-0007 簡化記帳路徑，WH → BK 2.0 → Firestore
 */

// 首先引入其他模組
const DD = require("./2031. DD1.js");
const BK = require("./2001. BK.js");
const DL = require("./2010. DL.js");
const AM = require("./2009. AM.js");

// 引入必要的 Node.js 模組
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const NodeCache = require("node-cache");

// 引入Firebase Admin SDK
const admin = require("firebase-admin");

// 初始化Firebase（如果尚未初始化）
if (!admin.apps.length) {
  try {
    const serviceAccount = require("./Serviceaccountkey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("WH模組：Firebase初始化成功");
  } catch (error) {
    console.error("WH模組：Firebase初始化失敗:", error);
  }
}

const db = admin.firestore();

// 1. 配置參數
const WH_CONFIG = {
  DEBUG: true,
  TEST_MODE: true, // 測試模式：跳過簽章驗證
  LOG_MESSAGE_CONTENT: true, // 提前記錄訊息內容
  MESSAGE_DEDUPLICATION: true, // 啟用消息去重
  MESSAGE_RETENTION_HOURS: 24, // 消息ID保留時間(小時)
  ASYNC_PROCESSING: true, // 啟用異步處理（快速回應）
  FIRESTORE: {
    COLLECTION: "ledgers", // Firestore集合名稱
    LOG_SUBCOLLECTION: "log", // 日誌子集合名稱
  },
  LINE: {
    CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET, // 從環境變數獲取 LINE Channel Secret
    CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN, // 從環境變數獲取 LINE Channel Access Token
  },
  RETRY: {
    MAX_COUNT: 2, // 減少重試次數
    DELAY_MS: 1000,
  },
  TIMEZONE: "Asia/Taipei", // 台灣時區
};

// 初始化檢查 - 在全局執行一次
console.log("WH模組初始化，版本: 2.0.16 (2025-07-09)");

// 創建 Express 應用
const app = express();
app.use(express.json());

// 創建緩存服務
const cache = new NodeCache({ stdTTL: 600 }); // 10分鐘緩存

// 創建持久化存儲 (模擬 PropertiesService)
const WH_PROPS = {
  properties: {},
  getProperty: function (key) {
    return this.properties[key];
  },
  setProperty: function (key, value) {
    this.properties[key] = value;
    return this;
  },
  deleteProperty: function (key) {
    delete this.properties[key];
    return this;
  },
};

// 從環境變量獲取腳本屬性 (模擬 getScriptProperty)
function getScriptProperty(key) {
  return process.env[key];
}



// 日期時間格式化
function WH_formatDateTime(date) {
  return moment(date).tz(WH_CONFIG.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * 01. 主要的POST處理函數 - 智慧處理版本
 * @version 2025-07-11-V2.0.17
 * @date 2025-07-11 12:20:00
 * @update: 智慧處理機制 - 對需要回覆的訊息使用同步處理，確保 replyToken 有效性
 */
function doPost(req, res) {
  // 生成請求ID
  const requestId = uuidv4().substring(0, 8);

  // 快速錯誤檢查
  if (!req || !req.body) {
    return res.status(400).json({
      error: "無效的請求格式",
    });
  }

  try {
    // 記錄請求接收
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.7: 收到LINE Webhook請求 [${requestId}]`,
      "請求接收",
      "",
      "",
      "WH",
      "",
      0,
      "doPost",
      "INFO",
    ]);

    // 極速儲存請求
    // 使用 NodeCache 替代 CacheService
    cache.set("WH_REQ_" + requestId, JSON.stringify(req.body), 600); // 緩存10分鐘

    // 智慧處理：檢查是否為需要回覆的訊息事件
    const postData = req.body;
    let needsReply = false;

    if (postData && postData.events && postData.events.length > 0) {
      for (const event of postData.events) {
        if (event.type === "message" && event.message && event.replyToken) {
          needsReply = true;
          break;
        }
      }
    }

    if (needsReply) {
      // 需要回覆的訊息：立即同步處理以確保 replyToken 有效
      console.log(`檢測到需要回覆的訊息，啟用同步處理 [${requestId}]`);
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.16: 檢測到需要回覆的訊息，啟用同步處理 [${requestId}]`,
        "同步處理",
        "",
        "",
        "WH",
        "",
        0,
        "doPost",
        "INFO",
      ]);

      // 立即處理，不延遲
      try {
        processWebhookAsync({ requestId: requestId }).catch((err) => {
          console.log("同步處理失敗:", err);
        });
      } catch (syncError) {
        console.log("同步處理異常:", syncError);
      }
    } else {
      // 不需要回覆的事件：使用非同步處理
      console.log(`非回覆事件，使用非同步處理 [${requestId}]`);
      try {
        // 使用 setTimeout 替代 trigger
        setTimeout(async () => {
          await processWebhookAsync({ requestId: requestId });
        }, 1000); // 1秒後執行
      } catch (triggerError) {
        // 如果創建計時器失敗，忽略錯誤繼續執行
        console.log("計時器創建失敗，將改用直接調用: " + triggerError);
        // 嘗試直接調用，但不等待結果
        processWebhookAsync({ requestId: requestId }).catch((err) => {
          console.log("直接調用異步處理失敗:", err);
        });
      }
    }

    // 立即回應LINE - 不進行任何額外處理
    return res.status(200).json({
      status: "ok",
      request_id: requestId,
    });
  } catch (error) {
    // 即使發生錯誤，也確保返回響應
    console.log("發生錯誤，但仍快速回應: " + error);

    // 記錄錯誤
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.7: 處理請求時出錯: ${error.toString()} [${requestId}]`,
      "請求處理",
      "",
      "REQUEST_ERROR",
      "WH",
      error.toString(),
      0,
      "doPost",
      "ERROR",
    ]);

    return res.status(200).json({
      status: "received",
      error: "請求已接收但處理可能出錯",
    });
  }
}

/**
 * 02. 智慧處理Webhook請求（同步/非同步）
 * @version 2025-07-11-V2.0.17
 * @date 2025-07-11 12:20:00
 * @update: 支援同步處理以確保 replyToken 有效性
 * @param {Object} e - 觸發器事件對象，包含requestId
 */
async function processWebhookAsync(e) {
  // 從參數獲取請求ID
  const requestId = e && e.requestId ? e.requestId : "unknown";

  try {
    console.log(`開始非同步處理請求 [${requestId}]`);
    // 使用直接日誌寫入
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.7: 開始非同步處理請求 [${requestId}]`,
      "非同步處理",
      "",
      "",
      "WH",
      "",
      0,
      "processWebhookAsync",
      "INFO",
    ]);

    // 從緩存獲取請求數據
    const rawData = cache.get("WH_REQ_" + requestId);

    if (!rawData) {
      console.log(`無法獲取請求數據 [${requestId}]`);
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.7: 無法獲取請求數據 [${requestId}]`,
        "非同步處理",
        "",
        "DATA_MISSING",
        "WH",
        "",
        0,
        "processWebhookAsync",
        "ERROR",
      ]);
      return;
    }

    // 解析數據
    const postData = JSON.parse(rawData);

    // 記錄基本信息
    if (postData.events && postData.events.length > 0) {
      // 處理每個事件
      for (const event of postData.events) {
        try {
          // 獲取用戶ID
          let userId = "";
          if (event.source) {
            userId = event.source.userId || "";
          }

          // 檢查消息去重
          if (
            WH_CONFIG.MESSAGE_DEDUPLICATION &&
            event.type === "message" &&
            event.message &&
            event.message.id
          ) {
            // 在非同步處理中檢查重複
            const isDuplicate = WH_checkDuplicateMessage(
              event.message.id,
              requestId,
            );
            if (isDuplicate) {
              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH 2.0.16: 跳過重複消息ID: ${event.message.id} [${requestId}]`,
                "消息去重",
                userId,
                "",
                "WH",
                "",
                0,
                "processWebhookAsync",
                "INFO",
              ], userId);
              continue; // 跳過此消息的處理
            }
          }

          if (event.type === "message") {
            // 處理消息事件
            await WH_processEventAsync(event, requestId, userId);
          } else {
            // 記錄其他類型事件
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.7: 收到${event.type}事件 [${requestId}]`,
              "事件處理",
              userId,
              "",
              "WH",
              "",
              0,
              "processWebhookAsync",
              "INFO",
            ]);
          }
        } catch (eventError) {
          console.log(`處理事件錯誤: ${eventError} [${requestId}]`);
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.7: 處理事件錯誤 [${requestId}]`,
            "事件處理",
            "",
            "",
            "WH",
            eventError.toString(),
            0,
            "processWebhookAsync",
            "ERROR",
          ]);
        }
      }
    } else {
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.7: 請求中沒有事件 [${requestId}]`,
        "事件處理",
        "",
        "",
        "WH",
        "",
        0,
        "processWebhookAsync",
        "WARNING",
      ]);
    }

    // 清理緩存
    cache.del("WH_REQ_" + requestId);
    console.log(`非同步處理完成，已清理數據 [${requestId}]`);

    // 記錄處理完成
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.7: 非同步處理完成 [${requestId}]`,
      "非同步處理",
      "",
      "",
      "WH",
      "",
      0,
      "processWebhookAsync",
      "INFO",
    ]);
  } catch (error) {
    console.log(`非同步處理主錯誤: ${error} [${requestId}]`);
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.7: 非同步處理錯誤 [${requestId}]`,
      "非同步處理",
      "",
      "ASYNC_ERROR",
      "WH",
      error.toString(),
      0,
      "processWebhookAsync",
      "ERROR",
    ]);
  }
}

/**
 * 03. 處理來自 LINE 的 Webhook 事件
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore
 * @param {Object} event - LINE Webhook 事件對象
 */
function WH_processEvent(event) {
  try {
    // 記錄事件類型和來源
    console.log(`收到 LINE 事件: ${event.type}, 來源: ${event.source.type}`);

    // 確保 event 包含必要屬性
    if (!event || !event.type) {
      console.log("無效事件物件");
      return;
    }

    // 處理訊息事件
    if (event.type === "message" && event.message) {
      // 提取用戶ID和回覆Token
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      // 處理不同類型的訊息
      if (event.message.type === "text") {
        // 處理文字訊息
        const messageText = event.message.text;

        // 添加時間戳記錄
        console.log(
          `接收訊息: "${messageText}" 從用戶: ${userId}, 時間: ${new Date().toISOString()}`,
        );

        // 創建發送到 DD 模組的數據對象
        const data = {
          text: messageText,
          userId: userId,
          timestamp: event.timestamp,
          replyToken: replyToken, // 重要：保存回覆令牌
        };

        // 使用模組引用调用函数
        const result = DD.DD_distributeData(data, "LINE");

        // 判斷結果是否包含回應訊息並回覆用戶
        if (result && result.responseMessage) {
          console.log(`發現回應訊息，準備回覆用戶: ${result.responseMessage}`);
          WH_replyMessage(replyToken, result.responseMessage);
        } else {
          console.log("結果中沒有回應訊息，不回覆用戶");
        }
      }
      // 可以處理其他類型的訊息 (圖片、影片等)
    }
    // 處理其他類型事件 (follow, unfollow, join 等)
  } catch (error) {
    console.log(`WH_processEvent 錯誤: ${error}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
  }
}

/**
 * 04. 檢查消息是否已處理過（使用 NodeCache 以提高速度）
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore
 */
function WH_checkDuplicateMessage(messageId, requestId) {
  if (!messageId) return false;

  try {
    const cacheKey = "WH_MSG_" + messageId;

    // 檢查消息是否已處理
    const existingValue = cache.get(cacheKey);
    if (existingValue) {
      return true;
    }

    // 標記消息為已處理
    cache.set(cacheKey, new Date().toISOString(), 86400); // 24小時

    // 同時在持久化存儲中記錄
    try {
      WH_PROPS.setProperty(cacheKey, new Date().toISOString());
    } catch (propError) {
      // 如果持久化存儲失敗，僅記錄錯誤但繼續處理
      console.log(`持久化存儲設置失敗: ${propError}`);
    }

    return false;
  } catch (error) {
    console.log(`消息去重檢查出錯: ${error}`);
    return false; // 如果檢查失敗，假設不是重複消息
  }
}

/**
 * 05. 直接寫入日誌到Firestore，不使用緩衝區
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore資料庫
 * @param {Array} logData - 日誌數據行
 * @param {string} userId - 用戶ID，用於確定寫入哪個帳本
 */
async function WH_directLogWrite(logData, userId = null) {
  try {
    // 確保來源欄位為WH
    logData[5] = "WH";

    // 直接向控制台輸出完整日誌
    console.log(`[WH 2.0.16 LOG] ${logData[1]} (${logData[9]})`);

    // 寫入本地日誌文件作為備援
    const logDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = moment().format("YYYY-MM-DD");
    const logFile = path.join(logDir, `webhook-${today}.log`);
    fs.appendFileSync(logFile, logData.join("\t") + "\n", { encoding: "utf8" });

    // 寫入Firestore（如果有用戶ID）
    if (userId && db) {
      try {
        const logDoc = {
          timestamp: logData[0],
          message: logData[1],
          operationType: logData[2],
          userId: logData[3],
          errorCode: logData[4],
          source: logData[5],
          errorDetails: logData[6],
          retryCount: logData[7],
          location: logData[8],
          severity: logData[9],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection(WH_CONFIG.FIRESTORE.COLLECTION)
                .doc(userId)
                .collection(WH_CONFIG.FIRESTORE.LOG_SUBCOLLECTION)
                .add(logDoc);

      } catch (firestoreError) {
        console.log(`Firestore寫入失敗，已保存至本地: ${firestoreError.toString()}`);
      }
    }
  } catch (error) {
    console.log(`WH_directLogWrite 錯誤: ${error.toString()}`);
  }
}

// 日誌函數（使用直接寫入）
function WH_logDebug(message, operationType = "", userId = "", location = "") {
  if (!WH_CONFIG.DEBUG) return;
  console.log(`[WH-DEBUG] ${message}`);

  // 使用try-catch包裹日誌寫入，確保不會影響主要流程
  try {
    const logData = [
      WH_formatDateTime(new Date()), // 1. 時間戳記
      message, // 2. 訊息
      operationType, // 3. 操作類型
      userId, // 4. 使用者ID
      "", // 5. 錯誤代碼
      "WH", // 6. 來源 - 明確標記為WH
      "", // 7. 錯誤詳情
      0, // 8. 重試次數
      location || "", // 9. 程式碼位置
      "DEBUG", // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

function WH_logInfo(message, operationType = "", userId = "", location = "") {
  console.log(`[WH-INFO] ${message}`);

  try {
    const logData = [
      WH_formatDateTime(new Date()), // 1. 時間戳記
      message, // 2. 訊息
      operationType, // 3. 操作類型
      userId, // 4. 使用者ID
      "", // 5. 錯誤代碼
      "WH", // 6. 來源 - 明確標記為WH
      "", // 7. 錯誤詳情
      0, // 8. 重試次數
      location || "", // 9. 程式碼位置
      "INFO", // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

function WH_logWarning(
  message,
  operationType = "",
  userId = "",
  errorDetails = "",
  location = "",
) {
  console.log(`[WH-WARNING] ${message}`);

  try {
    const logData = [
      WH_formatDateTime(new Date()), // 1. 時間戳記
      message, // 2. 訊息
      operationType, // 3. 操作類型
      userId, // 4. 使用者ID
      "", // 5. 錯誤代碼
      "WH", // 6. 來源 - 明確標記為WH
      errorDetails, // 7. 錯誤詳情
      0, // 8. 重試次數
      location || "", // 9. 程式碼位置
      "WARNING", // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

function WH_logError(
  message,
  operationType = "",
  userId = "",
  errorCode = "",
  errorDetails = "",
  location = "",
) {
  console.log(`[WH-ERROR] ${message}`);

  try {
    const logData = [
      WH_formatDateTime(new Date()), // 1. 時間戳記
      message, // 2. 訊息
      operationType, // 3. 操作類型
      userId, // 4. 使用者ID
      errorCode, // 5. 錯誤代碼
      "WH", // 6. 來源 - 明確標記為WH
      errorDetails, // 7. 錯誤詳情
      0, // 8. 重試次數
      location || "", // 9. 程式碼位置
      "ERROR", // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

function WH_logCritical(
  message,
  operationType = "",
  userId = "",
  errorCode = "",
  errorDetails = "",
  location = "",
) {
  console.log(`[WH-CRITICAL] ${message}`);

  try {
    const logData = [
      WH_formatDateTime(new Date()), // 1. 時間戳記
      message, // 2. 訊息
      operationType, // 3. 操作類型
      userId, // 4. 使用者ID
      errorCode, // 5. 錯誤代碼
      "WH", // 6. 來源 - 明確標記為WH
      errorDetails, // 7. 錯誤詳情
      0, // 8. 重試次數
      location || "", // 9. 程式碼位置
      "CRITICAL", // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

/**
 * 06. 回覆訊息給 LINE 用戶 - 智慧訊息處理版本
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore，深度強化對複雜訊息對象的處理能力，確保負數金額和支付方式正確顯示
 * @param {string} replyToken - LINE 回覆令牌
 * @param {string|Object} message - 要發送的訊息內容或包含訊息的對象
 * @returns {Object} 發送結果
 */
function WH_replyMessage(replyToken, message) {
  try {
    // 1. 智慧訊息提取 - 檢查輸入類型並從對象中提取訊息
    let textMessage = "";

    // 記錄收到的訊息類型，包括預覽
    console.log(`WH_replyMessage: 收到類型 ${typeof message} 的訊息對象`);
    if (typeof message === "object" && message !== null) {
      console.log(
        `WH_replyMessage: 訊息對象結構: ${JSON.stringify(Object.keys(message))}`,
      );

      // 物件內容預覽
      const preview = JSON.stringify(message).substring(0, 200);
      console.log(`WH_replyMessage: 訊息對象預覽: ${preview}...`);
    }

    // 2. 根據不同類型的訊息對象提取文本
    if (typeof message === "object" && message !== null) {
      // 詳細記錄各種可能的屬性
      if (message.responseMessage) {
        console.log(
          `WH_replyMessage: 發現responseMessage屬性 (${typeof message.responseMessage}), 長度=${message.responseMessage.length || 0}`,
        );
      }
      if (message.message) {
        console.log(
          `WH_replyMessage: 發現message屬性 (${typeof message.message})`,
        );
      }
      if (message.userFriendlyMessage) {
        console.log(
          `WH_replyMessage: 發現userFriendlyMessage屬性 (${typeof message.userFriendlyMessage})`,
        );
      }

      // 階層式提取優先順序
      if (
        message.responseMessage &&
        typeof message.responseMessage === "string"
      ) {
        textMessage = message.responseMessage;
        console.log(
          `WH_replyMessage: 使用responseMessage屬性 (${textMessage.substring(0, 30)}...)`,
        );
      } else if (message.message && typeof message.message === "string") {
        textMessage = message.message;
        console.log(
          `WH_replyMessage: 使用message屬性 (${textMessage.substring(0, 30)}...)`,
        );
      } else if (
        message.userFriendlyMessage &&
        typeof message.userFriendlyMessage === "string"
      ) {
        textMessage = message.userFriendlyMessage;
        console.log(
          `WH_replyMessage: 使用userFriendlyMessage屬性 (${textMessage.substring(0, 30)}...)`,
        );
      }
      // 嘗試自行構建訊息 - 如果有partialData
      else if (message.partialData) {
        try {
          console.log(`WH_replyMessage: 嘗試從partialData構建訊息`);
          const pd = message.partialData;
          const isSuccess = message.success === true;
          const errorMsg = message.error || "未知錯誤";
          const currentDateTime = moment()
            .tz("Asia/Taipei")
            .format("YYYY/MM/DD HH:mm");

          // 提取並記錄關鍵屬性
          const subject = pd.subject || "未知科目";
          console.log(`WH_replyMessage: 使用科目=${subject}`);

          const displayAmount =
            pd.rawAmount || (pd.amount !== undefined ? String(pd.amount) : "0");
          console.log(`WH_replyMessage: 使用金額=${displayAmount}`);

          const paymentMethod = pd.paymentMethod || "未指定支付方式";
          console.log(`WH_replyMessage: 使用支付方式=${paymentMethod}`);

          const remark = pd.remark || "無";
          console.log(`WH_replyMessage: 使用備註=${remark}`);

          // 構建標準訊息格式
          if (isSuccess) {
            textMessage =
              `記帳成功！\n` +
              `金額：${displayAmount}元\n` +
              `付款方式：${paymentMethod}\n` +
              `時間：${currentDateTime}\n` +
              `科目：${subject}\n` +
              `備註：${remark}\n` +
              `使用者類型：J`;
          } else {
            textMessage =
              `記帳失敗！\n` +
              `金額：${displayAmount}元\n` +
              `支付方式：${paymentMethod}\n` +
              `時間：${currentDateTime}\n` +
              `科目：${subject}\n` +
              `備註：${remark}\n` +
              `使用者類型：J\n` +
              `錯誤原因：${errorMsg}`;
          }
          console.log(
            `WH_replyMessage: 自行構建的訊息: ${textMessage.substring(0, 50)}...`,
          );
        } catch (formatError) {
          console.log(`WH_replyMessage: 自行構建訊息失敗: ${formatError}`);
          textMessage = `處理您的請求時發生錯誤，請稍後再試。(Error: FORMAT_MESSAGE)`;
        }
      } else {
        // 最後嘗試將整個對象轉為字符串
        try {
          textMessage = JSON.stringify(message);
          console.log(
            `WH_replyMessage: 將對象轉換為字符串: ${textMessage.substring(0, 50)}...`,
          );
        } catch (jsonError) {
          textMessage =
            "處理您的請求時發生錯誤，請稍後再試。(Error: JSON_CONVERSION)";
          console.log(
            `WH_replyMessage: 對象轉換為JSON失敗，使用預設訊息: ${jsonError}`,
          );
        }
      }
    } else if (typeof message === "string") {
      // 直接使用字符串
      textMessage = message;
      console.log(
        `WH_replyMessage: 使用直接傳入的字符串訊息 (${textMessage.substring(0, 30)}...)`,
      );
    } else {
      // 未知類型，使用預設訊息
      textMessage =
        "您的請求已收到，但處理過程中出現未知錯誤。(Error: UNKNOWN_TYPE)";
      console.log(`WH_replyMessage: 未知訊息類型: ${typeof message}`);
    }

    // 3. 確保消息不超過LINE的最大長度
    const maxLength = 5000; // LINE消息最大長度
    if (textMessage.length > maxLength) {
      console.log(
        `WH_replyMessage: 訊息太長 (${textMessage.length}字符)，截斷至${maxLength}字符`,
      );
      textMessage = textMessage.substring(0, maxLength - 3) + "...";
    }

    // 4. 記錄準備發送的訊息
    console.log(
      `WH_replyMessage: 開始回覆訊息: ${textMessage.substring(0, 50)}${textMessage.length > 50 ? "..." : ""}`,
    );

    // 使用直接寫入記錄開始回覆請求
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.3: 開始回覆訊息: ${textMessage.substring(0, 50)}${textMessage.length > 50 ? "..." : ""}`,
      "訊息回覆",
      "",
      "",
      "WH",
      "",
      0,
      "WH_replyMessage",
      "INFO",
    ]);

    // 5. 檢查回覆令牌是否有效
    if (!replyToken || replyToken === "00000000000000000000000000000000") {
      console.log("無效的回覆令牌，跳過回覆");

      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.3: 無效的回覆令牌，跳過回覆`,
        "訊息回覆",
        "",
        "INVALID_TOKEN",
        "WH",
        "回覆令牌無效或為測試令牌",
        0,
        "WH_replyMessage",
        "ERROR",
      ]);

      return { success: false, error: "無效的回覆令牌" };
    }

    // LINE Messaging API URL
    const url = "https://api.line.me/v2/bot/message/reply";

    // 使用配置中定義的 Channel Access Token
    const CHANNEL_ACCESS_TOKEN = WH_CONFIG.LINE.CHANNEL_ACCESS_TOKEN;

    if (!CHANNEL_ACCESS_TOKEN) {
      console.log("找不到 CHANNEL_ACCESS_TOKEN，無法回覆訊息");

      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.3: 找不到 CHANNEL_ACCESS_TOKEN，無法回覆訊息`,
        "訊息回覆",
        "",
        "MISSING_TOKEN",
        "WH",
        "配置中缺少 CHANNEL_ACCESS_TOKEN",
        0,
        "WH_replyMessage",
        "ERROR",
      ]);

      return { success: false, error: "找不到 CHANNEL_ACCESS_TOKEN" };
    }

    // 設置請求頭
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + CHANNEL_ACCESS_TOKEN,
    };

    // 設置請求體
    const payload = {
      replyToken: replyToken,
      messages: [
        {
          type: "text",
          text: textMessage,
        },
      ],
    };

    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.3: 發送API請求到LINE平台`,
      "訊息回覆",
      "",
      "",
      "WH",
      "",
      0,
      "WH_replyMessage",
      "INFO",
    ]);

    // 使用 axios 發送 HTTP 請求 
    return axios
      .post(url, payload, { headers: headers })
      .then((response) => {
        // 記錄回覆結果
        console.log(`LINE API 回覆結果: ${response.status}`);

        // 檢查響應是否成功
        if (response.status === 200) {
          console.log("回覆訊息成功");

          // 回覆成功日誌
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            "WH 2.0.3: 回覆訊息成功發送",
            "訊息回覆",
            "",
            "",
            "WH",
            "",
            0,
            "WH_replyMessage",
            "INFO",
          ]);

          return { success: true };
        } else {
          console.log(`回覆訊息失敗: ${JSON.stringify(response.data)}`);

          // 回覆失敗日誌
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.3: 回覆訊息失敗: ${response.status} - ${JSON.stringify(response.data)}`,
            "訊息回覆",
            "",
            "API_ERROR",
            "WH",
            JSON.stringify(response.data),
            0,
            "WH_replyMessage",
            "ERROR",
          ]);

          return { success: false, error: JSON.stringify(response.data) };
        }
      })
      .catch((error) => {
        console.log(`WH_replyMessage 錯誤: ${error}`);
        if (error.response) {
          console.log(`錯誤響應: ${JSON.stringify(error.response.data)}`);
        }

        // 異常日誌
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.0.3: 回覆訊息異常: ${error.toString()}`,
          "訊息回覆",
          "",
          "EXCEPTION",
          "WH",
          error.toString(),
          0,
          "WH_replyMessage",
          "ERROR",
        ]);

        return { success: false, error: error.toString() };
      });
  } catch (error) {
    console.log(`WH_replyMessage 錯誤: ${error}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);

    // 異常日誌
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.3: 回覆訊息異常: ${error.toString()}`,
      "訊息回覆",
      "",
      "EXCEPTION",
      "WH",
      error.toString(),
      0,
      "WH_replyMessage",
      "ERROR",
    ]);

    return { success: false, error: error.toString() };
  }
}

// 依賴注入函數 - 用於支持從 index.js 設置依賴
function setDependencies(ddModule, bkModule, dlModule) {
  // 可以替換全局引用，或設置內部變數
  global.DD_distributeData = ddModule.DD_distributeData;
  global.DD_generateIntelligentRemark = ddModule.DD_generate智慧Remark;
  global.DD_userPreferenceManager = ddModule.DD_userPreferenceManager;
  global.DD_learnInputPatterns = ddModule.DD_learnInputPatterns;

  global.BK_processBookkeeping = bkModule.BK_processBookkeeping;
  global.BK_validatePaymentMethod = bkModule.BK_validatePaymentMethod;

  global.DL_initialize = dlModule.DL_initialize;
  global.DL_info = dlModule.DL_info;
  global.DL_warning = dlModule.DL_warning;
  global.DL_error = dlModule.DL_error;
  global.DL_debug = dlModule.DL_debug;
}

/**
 * 07. 處理事件 (非同步版) - 修正訊息處理和數據傳遞問題
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore，保留原始數據和完整的錯誤訊息，確保正確顯示負數金額與支付方式
 * @param {Object} event - LINE事件對象
 * @param {string} requestId - 請求ID
 * @param {string} userId - 用戶ID
 */
async function WH_processEventAsync(event, requestId, userId) {
  // 檢查基本參數
  if (!event || !event.type) {
    console.log(`無效事件或缺少類型: ${JSON.stringify(event)} [${requestId}]`);
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.3: 無效事件或缺少類型 [${requestId}]`,
      "事件處理",
      userId,
      "INVALID_EVENT",
      "WH",
      JSON.stringify(event),
      0,
      "WH_processEventAsync",
      "ERROR",
    ]);
    return;
  }

  try {
    // 記錄開始處理事件
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.3: 開始處理事件: ${event.type} [${requestId}]`,
      "事件處理",
      userId,
      "",
      "WH",
      "",
      0,
      "WH_processEventAsync",
      "INFO",
    ]);

    // 確保設置了預處理的replyToken屬性
    if (!event.replyToken && event.type === "message") {
      const errorMsg = `缺少replyToken: ${JSON.stringify(event)} [${requestId}]`;
      console.log(errorMsg);
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        errorMsg,
        "事件處理",
        userId,
        "MISSING_REPLY_TOKEN",
        "WH",
        "",
        0,
        "WH_processEventAsync",
        "ERROR",
      ]);
      return;
    }

    // 根據事件類型處理
    if (event.type === "message") {
      // 處理消息類型的事件
      console.log(
        `處理消息事件: ${event.message ? event.message.type : "unknown"} [${requestId}]`,
      );
      let result;

      if (event.message.type === "text") {
        // 安全提取和記錄文本內容
        const text = event.message.text || "";
        console.log(
          `收到文本消息: "${text.substr(0, 50)}${text.length > 50 ? "..." : ""}" [${requestId}]`,
        );

        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.0.3: 收到文本消息: "${text.substr(0, 50)}${text.length > 50 ? "..." : ""}" [${requestId}]`,
          "訊息接收",
          userId,
          "",
          "WH",
          "",
          0,
          "WH_processEventAsync",
          "INFO",
        ]);

        // 準備分發參數 - 明確包含replyToken
        const messageData = {
          text: text,
          userId: userId,
          timestamp: event.timestamp,
          replyToken: event.replyToken, // 確保replyToken被傳遞
        };

        // 記錄完整的消息數據
        console.log(
          `準備訊息數據: ${JSON.stringify(messageData)} [${requestId}]`,
        );

        // 調用分發函數 - 根據 BR-0007 實現簡化路徑
        try {
          // 檢查是否為簡單記帳格式
          const isSimpleBookkeeping = /^[\u4e00-\u9fff\w\s]+\s*\d+(\.\d+)?/.test(text.trim());

          if (isSimpleBookkeeping) {
            // 簡化路徑：WH → BK 2.0 → Firestore
            console.log(`檢測到簡單記帳格式，使用 BK 2.0 直連路徑 [${requestId}]`);

            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.17: 使用 BK 2.0 簡化路徑處理簡單記帳 [${requestId}]`,
              "簡化路徑",
              userId,
              "",
              "WH",
              "",
              0,
              "WH_processEventAsync",
              "INFO",
            ]);

            // 直接調用 BK 2.0 處理
            result = await BK.BK_processDirectBookkeeping(event);
          } else {
            // 標準路徑：WH → DD → BK → Firestore
            console.log(`使用標準路徑處理複雜訊息 [${requestId}]`);

            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.17: 使用標準路徑調用DD_distributeData [${requestId}]`,
              "標準路徑",
              userId,
              "",
              "WH",
              "",
              0,
              "WH_processEventAsync",
              "INFO",
            ]);

            // 關鍵：調用DD_distributeData並保留完整結果 - 修復：使用await處理異步
            result = await DD.DD_distributeData(messageData, "LINE", 0);
          }

          // 記錄DD_distributeData處理結果預覽
          if (result) {
            // 安全地記錄結果預覽，避免過大物件導致日誌問題
            const resultPreview = {
              success: result.success,
              hasResponseMessage: !!result.responseMessage,
              responseMsgLength: result.responseMessage
                ? result.responseMessage.length
                : 0,
              errorType: result.errorType || "無",
              moduleCode: result.moduleCode || "無",
              hasPartialData: !!result.partialData,
            };

            console.log(
              `DD_distributeData處理完成，結果預覽: ${JSON.stringify(resultPreview)} [${requestId}]`,
            );

            // 詳細記錄partialData內容，這對於診斷負數金額和支付方式問題很關鍵
            if (result.partialData) {
              console.log(
                `partialData內容: ${JSON.stringify(result.partialData)} [${requestId}]`,
              );
            }
          } else {
            console.log(`DD_distributeData返回空結果 [${requestId}]`);
          }

          // 處理空結果或缺少responseMessage的情況
          if (!result) {
            result = {
              success: false,
              responseMessage: "處理您的請求時發生錯誤，請稍後再試。",
              error: "返回空結果",
              partialData: {
                subject: "未知科目",
                amount: 0,
                rawAmount: "0",
                paymentMethod: "未指定支付方式",
              },
            };

            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.3: DD_distributeData返回空結果 [${requestId}]`,
              "處理異常",
              userId,
              "EMPTY_RESULT",
              "WH",
              "",
              0,
              "WH_processEventAsync",
              "ERROR",
            ]);
          }

          // 確保失敗時也有回覆訊息 - 但保留所有原始數據
          if (result.success === false && !result.responseMessage) {
            // 從partialData中嘗試提取有用資訊
            const subject = result.partialData?.subject || "未知科目";
            const amount = result.partialData?.rawAmount || "0";
            const paymentMethod =
              result.partialData?.paymentMethod || "未指定支付方式";
            const errorMsg = result.error || result.message || "未知錯誤";

            result.responseMessage =
              `記帳失敗！\n` +
              `金額：${amount}元\n` +
              `支付方式：${paymentMethod}\n` +
              `時間：${WH_formatDateTime(new Date())}\n` +
              `科目：${subject}\n` +
              `備註：無\n` +
              `使用者類型：J\n` +
              `錯誤原因：${errorMsg}`;

            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.3: 生成失敗回覆訊息 [${requestId}]`,
              "訊息生成",
              userId,
              "",
              "WH",
              "",
              0,
              "WH_processEventAsync",
              "INFO",
            ]);
          }

          // 關鍵：將完整result對象傳給WH_replyMessage，而非僅傳responseMessage
          console.log(`準備回覆訊息 [${requestId}]`);
          const replyResult = WH_replyMessage(event.replyToken, result);

          // 記錄回覆結果
          console.log(
            `訊息回覆結果: ${JSON.stringify(replyResult)} [${requestId}]`,
          );
        } catch (ddError) {
          // 異常捕獲處理 - 保留所有可用資訊
          console.log(
            `DD_distributeData調用失敗: ${ddError.toString()} [${requestId}]`,
          );
          if (ddError.stack) {
            console.log(`錯誤堆疊: ${ddError.stack} [${requestId}]`);
          }

          // 提取可能的原始輸入信息
          const originalInput = text.split("-");
          const possibleSubject = originalInput[0]?.trim() || "未知科目";
          let possibleAmount = originalInput[1]?.trim() || "0";
          let possiblePaymentMethod = "未指定支付方式";

          // 嘗試識別支付方式
          const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
          for (const method of paymentMethods) {
            if (text.includes(method)) {
              possiblePaymentMethod = method;
              // 從possibleAmount中移除支付方式
              possibleAmount = possibleAmount.replace(method, "").trim();
              break;
            }
          }

          // 構建包含原始資料的結果對象
          result = {
            success: false,
            responseMessage: "處理記帳時發生系統錯誤，請稍後再試或聯繫管理員。",
            error: ddError.toString(),
            partialData: {
              subject: possibleSubject,
              amount: possibleAmount.replace(/[^\d-]/g, ""),
              rawAmount: possibleAmount.replace(/[^\d-]/g, ""),
              paymentMethod: possiblePaymentMethod,
              remark: possibleSubject,
            },
          };

          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.3: 捕獲DD_distributeData異常，生成預設回覆 [${requestId}]`,
            "異常處理",
            userId,
            "DD_ERROR",
            "WH",
            ddError.toString(),
            0,
            "WH_processEventAsync",
            "ERROR",
          ]);

          // 仍然嘗試回覆用戶 - 使用完整的result對象
          WH_replyMessage(event.replyToken, result);
        }
      } else if (event.message.type === "location") {
        console.log(`收到位置消息 [${requestId}]`);
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.0.3: 收到位置消息 [${requestId}]`,
          "事件處理",
          userId,
          "",
          "WH",
          "",
          0,
          "WH_processEventAsync",
          "INFO",
        ]);

        // 位置消息處理 (如需要可在此處添加)
      } else {
        // 其他類型消息處理
        console.log(`收到其他類型消息: ${event.message.type} [${requestId}]`);
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.0.3: 收到其他類型消息: ${event.message.type} [${requestId}]`,
          "事件處理",
          userId,
          "",
          "WH",
          "",
          0,
          "WH_processEventAsync",
          "INFO",
        ]);

        // 發送簡單提示訊息
        WH_replyMessage(event.replyToken, {
          success: false,
          responseMessage: "很抱歉，目前僅支援文字訊息處理。",
        });
      }
    } else {
      // 處理非消息事件 (follow, unfollow, join 等)
      console.log(`收到非消息事件: ${event.type} [${requestId}]`);
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.3: 收到非消息事件: ${event.type} [${requestId}]`,
        "事件處理",
        userId,
        "",
        "WH",
        "",
        0,
        "WH_processEventAsync",
        "INFO",
      ]);

      // 處理特定非消息事件類型
      if (event.type === "follow") {
        // 處理用戶關注事件 - 自動建立帳號
        try {
          console.log(`處理用戶關注事件: ${userId} [${requestId}]`);

          // 調用AM模組建立LINE帳號
          const createResult = await AM.AM_createLineAccount(userId, null, 'J');

          if (createResult.success) {
            console.log(`成功為用戶 ${userId} 建立帳號 [${requestId}]`);

            // 記錄成功日誌
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.3: 用戶關注事件 - 成功建立帳號 ${userId} [${requestId}]`,
              "用戶關注",
              userId,
              "",
              "WH",
              "",
              0,
              "WH_processEventAsync",
              "INFO",
            ]);

            // 回覆歡迎訊息
            WH_replyMessage(event.replyToken, {
              success: true,
              responseMessage:
                "🎉 感謝您加入LCAS記帳助手！\n\n您的帳號已自動建立完成。\n\n📝 輸入 '幫助' 或 '?' 可獲取使用說明\n💡 直接輸入如 '午餐-100' 即可開始記帳！",
            });

          } else {
            // 帳號建立失敗的處理
            console.log(`用戶 ${userId} 帳號建立失敗: ${createResult.error} [${requestId}]`);

            // 記錄失敗日誌
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.3: 用戶關注事件 - 帳號建立失敗 ${userId}: ${createResult.error} [${requestId}]`,
              "用戶關注",
              userId,
              "ACCOUNT_CREATE_FAILED",
              "WH",
              createResult.error,
              0,
              "WH_processEventAsync",
              "ERROR",
            ]);

            // 即使建立失敗，仍然歡迎用戶（可能是重複加入）
            WH_replyMessage(event.replyToken, {
              success: true,
              responseMessage:
                "感謝您加入LCAS記帳助手！\n\n📝 輸入 '幫助' 或 '?' 可獲取使用說明\n💡 直接輸入如 '午餐-100' 即可開始記帳！",
            });
          }

        } catch (followError) {
          console.log(`處理用戶關注事件錯誤: ${followError} [${requestId}]`);

          // 記錄錯誤日誌
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.3: 處理用戶關注事件錯誤 ${userId}: ${followError.toString()} [${requestId}]`,
            "用戶關注",
            userId,
            "FOLLOW_EVENT_ERROR",
            "WH",
            followError.toString(),
            0,
            "WH_processEventAsync",
            "ERROR",
          ]);

          // 發送簡化的歡迎訊息
          WH_replyMessage(event.replyToken, {
            success: true,
            responseMessage:
              "感謝您加入記帳助手！\n輸入 '幫助' 或 '?' 可獲取使用說明。",
          });
        }
      } else if (event.type === "unfollow") {
        // 處理用戶取消關注事件 - 無法回覆
        console.log(`用戶 ${userId} 取消關注 [${requestId}]`);
      } else if (event.type === "join") {
        // 處理加入群組事件
        WH_replyMessage(event.replyToken, {
          success: true,
          responseMessage:
            "感謝邀請記帳助手加入！\n輸入 '幫助' 或 '?' 可獲取使用說明。",
        });
      }
      // 可處理其他事件類型...
    }
  } catch (error) {
    // 捕獲所有處理錯誤
    console.log(`事件處理主錯誤: ${error} [${requestId}]`);
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.3: 事件處理錯誤: ${error.toString()} [${requestId}]`,
      "事件處理",
      userId,
      "EVENT_ERROR",
      "WH",
      error.toString(),
      0,
      "WH_processEventAsync",
      "ERROR",
    ]);

    // 嘗試回覆用戶錯誤信息（如果可能）
    try {
      if (event && event.replyToken) {
        WH_replyMessage(event.replyToken, {
          success: false,
          responseMessage: "處理您的請求時發生系統錯誤，請稍後再試。",
        });
      }
    } catch (replyError) {
      console.log(`回覆錯誤訊息失敗: ${replyError} [${requestId}]`);
    }
  }
}

/**
 * 08. 驗證 LINE 平台簽章 - 增強安全性
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore
 * @param {string} signature - LINE 平台簽章
 * @param {string} body - 請求主體
 * @returns {boolean} 驗證結果
 */
function WH_verifySignature(signature, body) {
  if (WH_CONFIG.TEST_MODE) {
    console.log("WH_verifySignature: 測試模式，跳過簽章驗證");
    return true;
  }

  try {
    if (!signature) {
      console.log("WH_verifySignature: 缺少簽章");
      return false;
    }

    // 獲取 Channel Secret
    const channelSecret = WH_CONFIG.LINE.CHANNEL_SECRET;
    if (!channelSecret) {
      console.log("WH_verifySignature: 缺少 Channel Secret");
      return false;
    }

    // 使用 crypto 模組計算簽章
    const hmac = crypto.createHmac("sha256", channelSecret);
    hmac.update(body);
    const calculatedSignature = hmac.digest("base64");

    // 比較計算出的簽章與收到的簽章
    const isValid = signature === calculatedSignature;

    if (!isValid) {
      console.log(`WH_verifySignature: 簽章驗證失敗
        收到: ${signature}
        計算: ${calculatedSignature}`);
    }

    return isValid;
  } catch (error) {
    console.log(`WH_verifySignature 錯誤: ${error}`);
    return false;
  }
}

// 測試端點 - 檢查服務狀態和HTTPS支持
app.get("/", (req, res) => {
  const isHTTPS =
    req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";

  res.send(`
    <h1>LCAS Webhook Service is running! 🤖</h1>
    <p>版本: 2.0.7 (2025-06-25)</p>
    <p>協議: ${req.protocol.toUpperCase()} ${isHTTPS ? "✅ 支持HTTPS" : "❌ 僅HTTP"}</p>
    <p>Webhook URL: <code>${req.protocol}://${req.get("host")}/webhook</code></p>
    <p>建議的LINE Webhook URL: <code>https://${req.get("host")}/webhook</code></p>
    <p>時間: ${WH_formatDateTime(new Date())}</p>
    <hr>
    <h2>配置狀態:</h2>
    <ul>
      <li>LINE_CHANNEL_SECRET: ${WH_CONFIG.LINE.CHANNEL_SECRET ? "✅ 已設置" : "❌ 未設置"}</li>
      <li>LINE_CHANNEL_ACCESS_TOKEN: ${WH_CONFIG.LINE.CHANNEL_ACCESS_TOKEN ? "✅ 已設置" : "❌ 未設置"}</li>
      <li>SPREADSHEET_ID: ${WH_CONFIG.SHEET.ID ? "✅ 已設置" : "❌ 未設置"}</li>
      <li>測試模式: ${WH_CONFIG.TEST_MODE ? "🟡 開啟 (跳過簽章驗證)" : "🔴 關閉"}</li>
      <li>調試模式: ${WH_CONFIG.DEBUG ? "🟡 開啟" : "🔴 關閉"}</li>
    </ul>
    ${!isHTTPS ? '<p style="color:red;font-weight:bold;">⚠️ 警告：LINE Webhook需要HTTPS！請確認您的Replit支持HTTPS訪問。</p>' : ""}
    <hr>
    <p><strong>⚠️ 注意：這是連通測試版本</strong></p>
    <p>由於DD_distributeData函數未載入，在LINE中發送訊息會導致錯誤，但可以測試webhook連接。</p>
    <p>💡 在LINE Bot中發送任意訊息進行webhook連接測試</p>
    <p>📋 訪問 <a href="/test-wh">/test-wh</a> 查看詳細狀態</p>
    <p>🔍 訪問 <a href="/check-https">/check-https</a> 檢查HTTPS支持</p>
  `);
});

// 測試WH模組功能
app.get("/test-wh", async (req, res) => {
  try {
    const testResults = {
      success: true,
      timestamp: WH_formatDateTime(new Date()),
      server: {
        status: "運行中",
        port: process.env.PORT || 5000,
        protocol: req.protocol,
      },
      config: {
        lineChannelSecret: !!WH_CONFIG.LINE.CHANNEL_SECRET,
        lineChannelAccessToken: !!WH_CONFIG.LINE.CHANNEL_ACCESS_TOKEN,
        spreadsheetId: !!WH_CONFIG.SHEET.ID,
        testMode: WH_CONFIG.TEST_MODE,
        debugMode: WH_CONFIG.DEBUG,
      },
      webhook: {
        endpoint: `${req.protocol}://${req.get("host")}/webhook`,
        httpsSupported:
          req.protocol === "https" ||
          req.headers["x-forwarded-proto"] === "https",
      },
      note: "⚠️ 連通測試版本 - DD_distributeData函數未載入，發送訊息會出錯但可測試連接",
    };

    // 測試日誌寫入
    WH_logInfo("WH模組測試執行", "測試", "", "test-wh");

    res.json(testResults);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: WH_formatDateTime(new Date()),
    });
  }
});

// HTTPS支持檢查端點
app.get("/check-https", (req, res) => {
  const protocol = req.protocol;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHTTPS = protocol === "https" || forwardedProto === "https";

  res.json({
    protocol: protocol,
    forwardedProto: forwardedProto,
    isHTTPS: isHTTPS,
    recommendedWebhookURL: isHTTPS
      ? `https://${req.get("host")}/webhook`
      : `⚠️ HTTPS不可用，LINE Webhook無法使用`,
    testURLs: {
      http: `http://${req.get("host")}/`,
      https: `https://${req.get("host")}/`,
    },
    headers: {
      host: req.get("host"),
      "x-forwarded-proto": req.headers["x-forwarded-proto"],
      "x-forwarded-for": req.headers["x-forwarded-for"],
    },
    lineWebhookCompatible: isHTTPS,
    message: isHTTPS
      ? "✅ 支持HTTPS，可以用於LINE Webhook"
      : "❌ 僅支持HTTP，無法用於LINE Webhook",
  });
});

// 更新 Express 路由處理以包含簽章驗證（保持原版本）
app.post("/webhook", (req, res) => {
  // 獲取 LINE 平台簽章
  const signature = req.headers["x-line-signature"];

  // 獲取請求主體
  const body = JSON.stringify(req.body);

  // 驗證簽章
  if (!WH_verifySignature(signature, body)) {
    // 簽章驗證失敗
    console.log("簽章驗證失敗");
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      "WH 2.0.7: 簽章驗證失敗",
      "安全檢查",
      "",
      "INVALID_SIGNATURE",
      "WH",
      "",
      0,
      "app.post(/webhook)",
      "ERROR",
    ]);

    return res.status(403).json({
      status: "error",
      error: "簽章驗證失敗",
    });
  }

  // 簽章驗證成功，調用處理函數
  doPost(req, res);
});

// 設定端口和啟動服務器
const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 WH Webhook Server is running on port ${port}`);
  console.log(`📅 啟動時間: ${WH_formatDateTime(new Date())}`);
  console.log(`🌐 Server is accessible at http://0.0.0.0:${port}`);
  console.log(`📡 Webhook endpoint: http://0.0.0.0:${port}/webhook`);

  // 記錄服務器啟動
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    `WH 2.0.7: 服務器啟動成功，監聽端口 ${port}`,
    "服務器啟動",
    "",
    "",
    "WH",
    "",
    0,
    "app.listen",
    "INFO",
  ]);
});

// 優雅關閉處理
process.on("SIGTERM", () => {
  console.log("🛑 收到SIGTERM信號，正在關閉服務器...");
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    "WH 2.0.7: 收到SIGTERM信號，正在關閉服務器",
    "服務器關閉",
    "",
    "",
    "WH",
    "",
    0,
    "process.SIGTERM",
    "INFO",
  ]);

  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 收到SIGINT信號，正在關閉服務器...");
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    "WH 2.0.7: 收到SIGINT信號，正在關閉服務器",
    "服務器關閉",
    "",
    "",
    "WH",
    "",
    0,
    "process.SIGINT",
    "INFO",
  ]);

  process.exit(0);
});

// 未捕獲異常處理
process.on("uncaughtException", (error) => {
  console.error("💥 未捕獲的異常:", error);
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    `WH 2.0.7: 未捕獲的異常: ${error.toString()}`,
    "系統異常",
    "",
    "UNCAUGHT_EXCEPTION",
    "WH",
    error.stack || error.toString(),
    0,
    "process.uncaughtException",
    "CRITICAL",
  ]);

  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 未處理的Promise拒絕:", reason);
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    `WH 2.0.7: 未處理的Promise拒絕: ${reason}`,
    "系統異常",
    "",
    "UNHANDLED_REJECTION",
    "WH",
    reason.toString(),
    0,
    "process.unhandledRejection",
    "CRITICAL",
  ]);
});

// 更新模組導出，添加 setDependencies 函數 
module.exports = {
  // 已有的導出
  WH_processEvent,
  WH_replyMessage,
  WH_checkDuplicateMessage,
  WH_formatDateTime,
  WH_logDebug,
  WH_logInfo,
  WH_logWarning,
  WH_logError,
  WH_logCritical,

  // 新增的導出
  WH_processEventAsync,
  WH_verifySignature,
  doPost, // 導出主要處理函數
  processWebhookAsync,
  WH_directLogWrite,
  WH_ReceiveDDdata,

  // 新增依賴注入函數
  setDependencies,

  // 配置導出
  WH_CONFIG,
};

/**
 * 09. 接收DD模組處理後需WH執行的具體操作
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore
 * @param {Object} data - 需處理的數據
 * @param {string} action - 需執行的操作類型(如"reply"、"push"等)
 * @returns {Object} 執行結果
 */
function WH_ReceiveDDdata(data, action) {
  // 記錄接收請求
  console.log(`WH_ReceiveDDdata: 收到DD模組請求，執行${action}操作`);

  // 記錄操作日誌
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    `WH 2.0.7: 從DD模組接收數據，執行${action}操作`,
    "DD交互",
    data.userId || "",
    "",
    "WH",
    "",
    0,
    "WH_ReceiveDDdata",
    "INFO",
  ]);

  try {
    // 根據操作類型執行不同功能
    switch (action) {
      case "reply":
        // 直接調用reply功能，而非入口函數
        if (data && data.replyToken) {
          console.log(
            `執行回覆訊息操作，Token: ${data.replyToken.substring(0, 6)}...`,
          );
          return WH_replyMessage(data.replyToken, data.message || data);
        } else {
          const error = "回覆操作缺少replyToken或消息內容";
          console.log(error);
          return { success: false, error: error };
        }

      case "push":
        // 如果需要實現消息推送功能
        console.log(`推送訊息功能尚未實現`);
        return {
          success: false,
          error: "推送訊息功能尚未實現，請在WH模組中添加此功能",
        };

      case "multicast":
        // 如果需要實現群發功能
        console.log(`群發訊息功能尚未實現`);
        return {
          success: false,
          error: "群發訊息功能尚未實現，請在WH模組中添加此功能",
        };

      default:
        const errorMsg = `未知操作類型: ${action}`;
        console.log(errorMsg);

        // 記錄未知操作錯誤
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.0.7: 接收到未知操作請求: ${action}`,
          "DD交互錯誤",
          data.userId || "",
          "UNKNOWN_ACTION",
          "WH",
          errorMsg,
          0,
          "WH_ReceiveDDdata",
          "ERROR",
        ]);

        return { success: false, error: errorMsg };
    }
  } catch (error) {
    // 捕獲處理錯誤
    console.log(`WH_ReceiveDDdata錯誤: ${error}`);

    // 記錄操作錯誤
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.7: 執行DD請求操作時發生錯誤`,
      "DD交互錯誤",
      data.userId || "",
      "OPERATION_ERROR",
      "WH",
      error.toString(),
      0,
      "WH_ReceiveDDdata",
      "ERROR",
    ]);

    return { success: false, error: error.toString() };
  }
}