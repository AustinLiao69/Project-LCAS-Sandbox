/**
 * WH_Webhook處理模組_2_0_6
 * @module Webhook模組
 * @description LINE Webhook處理模組
*/

// 引入必要的 Node.js 模組
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const NodeCache = require('node-cache');

// 1. 配置參數
const WH_CONFIG = {
  DEBUG: true,
  TEST_MODE: true,           // 測試模式：跳過簽章驗證
  LOG_MESSAGE_CONTENT: true, // 提前記錄訊息內容
  MESSAGE_DEDUPLICATION: true, // 啟用消息去重
  MESSAGE_RETENTION_HOURS: 24, // 消息ID保留時間(小時)
  ASYNC_PROCESSING: true,    // 啟用異步處理（快速回應）
  SHEET: {
    ID: process.env.SPREADSHEET_ID, // 從環境變數獲取試算表 ID
    NAME: "999. Test ledger",
    LOG_SHEET_NAME: process.env.LOG_SHEET_NAME // 從環境變數獲取日誌表名
  },
  LINE: {
    CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET, // 從環境變數獲取 LINE Channel Secret
    CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN // 從環境變數獲取 LINE Channel Access Token
  },
  RETRY: {
    MAX_COUNT: 2,            // 減少重試次數
    DELAY_MS: 1000
  },
  TIMEZONE: "Asia/Taipei" // 台灣時區
};

// 初始化檢查 - 在全局執行一次
console.log("WH模組初始化，版本: 2.0.6 (2025-06-19)");

// 創建 Express 應用
const app = express();
app.use(express.json());

// 創建緩存服務
const cache = new NodeCache({ stdTTL: 600 }); // 10分鐘緩存

// 創建持久化存儲 (模擬 PropertiesService)
const WH_PROPS = {
  properties: {},
  getProperty: function(key) {
    return this.properties[key];
  },
  setProperty: function(key, value) {
    this.properties[key] = value;
    return this;
  },
  deleteProperty: function(key) {
    delete this.properties[key];
    return this;
  }
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
 * 1. 主要的POST處理函數 - 極速回應版本
 * 目標：<1秒內完成回應
 */
function doPost(req, res) {
  // 生成請求ID
  const requestId = uuidv4().substring(0, 8);

  // 快速錯誤檢查
  if (!req || !req.body) {
    return res.status(400).json({
      error: "無效的請求格式"
    });
  }

  try {
    // 記錄請求接收
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.0: 收到LINE Webhook請求 [${requestId}]`,
      "請求接收",
      "",
      "",
      "WH",
      "",
      0,
      "doPost",
      "INFO"
    ]);

    // 極速儲存請求
    // 使用 NodeCache 替代 CacheService
    cache.set('WH_REQ_' + requestId, JSON.stringify(req.body), 600); // 緩存10分鐘

    // 立即預定後台處理
    try {
      // 使用 setTimeout 替代 trigger
      setTimeout(() => {
        processWebhookAsync({requestId: requestId});
      }, 1000); // 1秒後執行
    } catch (triggerError) {
      // 如果創建計時器失敗，忽略錯誤繼續執行
      console.log("計時器創建失敗，將改用直接調用: " + triggerError);
      // 嘗試直接調用，但不等待結果
      processWebhookAsync({requestId: requestId});
    }

    // 立即回應LINE - 不進行任何額外處理
    return res.status(200).json({
      status: "ok", 
      request_id: requestId
    });

  } catch (error) {
    // 即使發生錯誤，也確保返回響應
    console.log("發生錯誤，但仍快速回應: " + error);

    // 記錄錯誤
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.0: 處理請求時出錯: ${error.toString()} [${requestId}]`,
      "請求處理",
      "",
      "REQUEST_ERROR",
      "WH",
      error.toString(),
      0,
      "doPost",
      "ERROR"
    ]);

    return res.status(200).json({
      status: "received",
      error: "請求已接收但處理可能出錯"
    });
  }
}

/**
 * 2. 非同步處理Webhook請求
 * 由時間觸發器調用
 * @param {Object} e - 觸發器事件對象，包含requestId
 */
function processWebhookAsync(e) {
  // 從參數獲取請求ID
  const requestId = e && e.requestId ? e.requestId : "unknown";

  try {
    console.log(`開始非同步處理請求 [${requestId}]`);
    // 使用直接日誌寫入
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.0: 開始非同步處理請求 [${requestId}]`,
      "非同步處理",
      "",
      "",
      "WH",
      "",
      0,
      "processWebhookAsync",
      "INFO"
    ]);

    // 從緩存獲取請求數據
    const rawData = cache.get('WH_REQ_' + requestId);

    if (!rawData) {
      console.log(`無法獲取請求數據 [${requestId}]`);
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.0: 無法獲取請求數據 [${requestId}]`,
        "非同步處理",
        "",
        "DATA_MISSING",
        "WH",
        "",
        0,
        "processWebhookAsync",
        "ERROR"
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
          if (WH_CONFIG.MESSAGE_DEDUPLICATION && 
              event.type === 'message' && event.message && event.message.id) {

            // 在非同步處理中檢查重複
            const isDuplicate = WH_checkDuplicateMessage(event.message.id, requestId);
            if (isDuplicate) {
              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH 2.0.0: 跳過重複消息ID: ${event.message.id} [${requestId}]`,
                "消息去重",
                userId,
                "",
                "WH",
                "",
                0,
                "processWebhookAsync",
                "INFO"
              ]);
              continue; // 跳過此消息的處理
            }
          }

          if (event.type === 'message') {
            // 處理消息事件
            WH_processEventAsync(event, requestId, userId);
          } else {
            // 記錄其他類型事件
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.0: 收到${event.type}事件 [${requestId}]`,
              "事件處理",
              userId,
              "",
              "WH",
              "",
              0,
              "processWebhookAsync",
              "INFO"
            ]);
          }
        } catch (eventError) {
          console.log(`處理事件錯誤: ${eventError} [${requestId}]`);
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.0: 處理事件錯誤 [${requestId}]`,
            "事件處理",
            "",
            "",
            "WH",
            eventError.toString(),
            0,
            "processWebhookAsync",
            "ERROR"
          ]);
        }
      }
    } else {
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.0: 請求中沒有事件 [${requestId}]`,
        "事件處理",
        "",
        "",
        "WH",
        "",
        0,
        "processWebhookAsync",
        "WARNING"
      ]);
    }

    // 清理緩存
    cache.del('WH_REQ_' + requestId);
    console.log(`非同步處理完成，已清理數據 [${requestId}]`);

    // 記錄處理完成
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.0: 非同步處理完成 [${requestId}]`,
      "非同步處理",
      "",
      "",
      "WH",
      "",
      0,
      "processWebhookAsync",
      "INFO"
    ]);

  } catch (error) {
    console.log(`非同步處理主錯誤: ${error} [${requestId}]`);
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.0: 非同步處理錯誤 [${requestId}]`,
      "非同步處理",
      "",
      "ASYNC_ERROR",
      "WH",
      error.toString(),
      0,
      "processWebhookAsync",
      "ERROR"
    ]);
  }
}

/**
 * 3. 處理來自 LINE 的 Webhook 事件
 * @version 2.0.0 (2025-05-16)
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
    if (event.type === 'message' && event.message) {
      // 提取用戶ID和回覆Token
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      // 處理不同類型的訊息
      if (event.message.type === 'text') {
        // 處理文字訊息
        const messageText = event.message.text;

        // 添加時間戳記錄
        console.log(`接收訊息: "${messageText}" 從用戶: ${userId}, 時間: ${new Date().toISOString()}`);

        // 創建發送到 DD 模組的數據對象
        const data = {
          text: messageText,
          userId: userId,
          timestamp: event.timestamp,
          replyToken: replyToken // 重要：保存回覆令牌
        };

        // 調用 DD 分發處理數據並獲取結果
        const result = DD_distributeData(data, "LINE");

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
 * 4. 檢查消息是否已處理過（使用 NodeCache 以提高速度）
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
 * 5. 向LINE用戶發送回覆消息
 * @deprecated 請使用 WH_replyMessage 代替
 */
function WH_replyToUser(replyToken, message, eventId) {
  if (!replyToken) return { success: false, error: "缺少回覆令牌" };

  try {
    // 準備LINE消息API請求數據
    const payload = {
      "replyToken": replyToken,
      "messages": [{ "type": "text", "text": message }]
    };

    // 設置API請求選項
    const options = {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + WH_CONFIG.LINE.CHANNEL_ACCESS_TOKEN
      }
    };

    // 發送請求到LINE API
    return axios.post("https://api.line.me/v2/bot/message/reply", payload, options)
      .then(response => {
        // 檢查回應狀態
        if (response.status === 200) {
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.0: 成功發送回覆 [${eventId}]`,
            "用戶回覆",
            "",
            "",
            "WH",
            "",
            0,
            "WH_replyToUser",
            "INFO"
          ]);
          return { success: true };
        } else {
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.0: LINE API回應異常，狀態碼: ${response.status} [${eventId}]`,
            "用戶回覆",
            "",
            "",
            "WH",
            JSON.stringify(response.data),
            0,
            "WH_replyToUser",
            "WARNING"
          ]);
          return { success: false, error: `API回應異常 (${response.status})` };
        }
      })
      .catch(error => {
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.0.0: 發送LINE回覆失敗 [${eventId}]`,
          "用戶回覆",
          "",
          "",
          "WH",
          error.toString(),
          0,
          "WH_replyToUser",
          "ERROR"
        ]);
        return { success: false, error: error.toString() };
      });
  } catch (error) {
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.0.0: 發送LINE回覆失敗 [${eventId}]`,
      "用戶回覆",
      "",
      "",
      "WH",
      error.toString(),
      0,
      "WH_replyToUser",
      "ERROR"
    ]);
    return { success: false, error: error.toString() };
  }
}

/**
 * 直接寫入日誌到日誌文件，不使用緩衝區
 * @version 2.0.0 (2025-05-16)
 * @param {Array} logData - 日誌數據行
 */
function WH_directLogWrite(logData) {
  try {
    // 確保來源欄位為WH
    logData[5] = "WH";

    // 直接向控制台輸出完整日誌
    console.log(`[WH 2.0.0 LOG] ${logData[1]} (${logData[9]})`);

    // 寫入日誌文件
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = moment().format('YYYY-MM-DD');
    const logFile = path.join(logDir, `webhook-${today}.log`);

    // 將日誌數據寫入文件
    fs.appendFileSync(
      logFile, 
      logData.join('\t') + '\n', 
      { encoding: 'utf8' }
    );

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
      WH_formatDateTime(new Date()),  // 1. 時間戳記
      message,                        // 2. 訊息
      operationType,                  // 3. 操作類型
      userId,                         // 4. 使用者ID
      "",                             // 5. 錯誤代碼
      "WH",                           // 6. 來源 - 明確標記為WH
      "",                             // 7. 錯誤詳情
      0,                              // 8. 重試次數
      location || "",                 // 9. 程式碼位置
      "DEBUG"                         // 10. 嚴重等級
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
      WH_formatDateTime(new Date()),  // 1. 時間戳記
      message,                        // 2. 訊息
      operationType,                  // 3. 操作類型
      userId,                         // 4. 使用者ID
      "",                             // 5. 錯誤代碼
      "WH",                           // 6. 來源 - 明確標記為WH
      "",                             // 7. 錯誤詳情
      0,                              // 8. 重試次數
      location || "",                 // 9. 程式碼位置
      "INFO"                          // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

function WH_logWarning(message, operationType = "", userId = "", errorDetails = "", location = "") {
  console.log(`[WH-WARNING] ${message}`);

  try {
    const logData = [
      WH_formatDateTime(new Date()),  // 1. 時間戳記
      message,                        // 2. 訊息
      operationType,                  // 3. 操作類型
      userId,                         // 4. 使用者ID
      "",                             // 5. 錯誤代碼
      "WH",                           // 6. 來源 - 明確標記為WH
      errorDetails,                   // 7. 錯誤詳情
      0,                              // 8. 重試次數
      location || "",                 // 9. 程式碼位置
      "WARNING"                       // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

function WH_logError(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "") {
  console.log(`[WH-ERROR] ${message}`);

  try {
    const logData = [
      WH_formatDateTime(new Date()),  // 1. 時間戳記
      message,                        // 2. 訊息
      operationType,                  // 3. 操作類型
      userId,                         // 4. 使用者ID
      errorCode,                      // 5. 錯誤代碼
      "WH",                           // 6. 來源 - 明確標記為WH
      errorDetails,                   // 7. 錯誤詳情
      0,                              // 8. 重試次數
      location || "",                 // 9. 程式碼位置
      "ERROR"                         // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

function WH_logCritical(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "") {
  console.log(`[WH-CRITICAL] ${message}`);

  try {
    const logData = [
      WH_formatDateTime(new Date()),  // 1. 時間戳記
      message,                        // 2. 訊息
      operationType,                  // 3. 操作類型
      userId,                         // 4. 使用者ID
      errorCode,                      // 5. 錯誤代碼
      "WH",                           // 6. 來源 - 明確標記為WH
      errorDetails,                   // 7. 錯誤詳情
      0,                              // 8. 重試次數
      location || "",                 // 9. 程式碼位置
      "CRITICAL"                      // 10. 嚴重等級
    ];

    // 直接寫入日誌
    WH_directLogWrite(logData);
  } catch (e) {
    console.log("日誌記錄失敗: " + e);
  }
}

/**
 * 6. 回覆訊息給 LINE 用戶 - 智能訊息處理版本
 * @version 2.0.3 (2025-06-16 02:13:23)
 * @author AustinLiao69
 * @update: 深度強化對複雜訊息對象的處理能力，確保負數金額和支付方式正確顯示
 * @param {string} replyToken - LINE 回覆令牌
 * @param {string|Object} message - 要發送的訊息內容或包含訊息的對象
 * @returns {Object} 發送結果
 */
function WH_replyMessage(replyToken, message) {
  try {
    // 1. 智能訊息提取 - 檢查輸入類型並從對象中提取訊息
    let textMessage = "";

    // 記錄收到的訊息類型，包括預覽
    console.log(`WH_replyMessage: 收到類型 ${typeof message} 的訊息對象`);
    if (typeof message === 'object' && message !== null) {
      console.log(`WH_replyMessage: 訊息對象結構: ${JSON.stringify(Object.keys(message))}`);

      // 物件內容預覽
      const preview = JSON.stringify(message).substring(0, 200);
      console.log(`WH_replyMessage: 訊息對象預覽: ${preview}...`);
    }

    // 2. 根據不同類型的訊息對象提取文本
    if (typeof message === 'object' && message !== null) {
      // 詳細記錄各種可能的屬性
      if (message.responseMessage) {
        console.log(`WH_replyMessage: 發現responseMessage屬性 (${typeof message.responseMessage}), 長度=${message.responseMessage.length || 0}`);
      }
      if (message.message) {
        console.log(`WH_replyMessage: 發現message屬性 (${typeof message.message})`);
      }
      if (message.userFriendlyMessage) {
        console.log(`WH_replyMessage: 發現userFriendlyMessage屬性 (${typeof message.userFriendlyMessage})`);
      }

      // 階層式提取優先順序
      if (message.responseMessage && typeof message.responseMessage === 'string') {
        textMessage = message.responseMessage;
        console.log(`WH_replyMessage: 使用responseMessage屬性 (${textMessage.substring(0, 30)}...)`);
      } 
      else if (message.message && typeof message.message === 'string') {
        textMessage = message.message;
        console.log(`WH_replyMessage: 使用message屬性 (${textMessage.substring(0, 30)}...)`);
      }
      else if (message.userFriendlyMessage && typeof message.userFriendlyMessage === 'string') {
        textMessage = message.userFriendlyMessage;
        console.log(`WH_replyMessage: 使用userFriendlyMessage屬性 (${textMessage.substring(0, 30)}...)`);
      }
      // 嘗試自行構建訊息 - 如果有partialData
      else if (message.partialData) {
        try {
          console.log(`WH_replyMessage: 嘗試從partialData構建訊息`);
          const pd = message.partialData;
          const isSuccess = message.success === true;
          const errorMsg = message.error || "未知錯誤";
          const currentDateTime = moment().tz(WH_CONFIG.TIMEZONE || "Asia/Taipei").format("YYYY/MM/DD HH:mm");

          // 提取並記錄關鍵屬性
          const subject = pd.subject || "未知科目";
          console.log(`WH_replyMessage: 使用科目=${subject}`);

          const displayAmount = pd.rawAmount || (pd.amount !== undefined ? String(pd.amount) : "0");
          console.log(`WH_replyMessage: 使用金額=${displayAmount}`);

          const paymentMethod = pd.paymentMethod || "未指定支付方式";
          console.log(`WH_replyMessage: 使用支付方式=${paymentMethod}`);

          const remark = pd.remark || "無";
          console.log(`WH_replyMessage: 使用備註=${remark}`);

          // 構建標準訊息格式
          if (isSuccess) {
            textMessage = `記帳成功！\n` +
                         `金額：${displayAmount}元\n` +
                         `付款方式：${paymentMethod}\n` +
                         `時間：${currentDateTime}\n` +
                         `科目：${subject}\n` +
                         `備註：${remark}\n` +
                         `使用者類型：J`;
          } else {
            textMessage = `記帳失敗！\n` +
                         `金額：${displayAmount}元\n` +
                         `支付方式：${paymentMethod}\n` +
                         `時間：${currentDateTime}\n` +
                         `科目：${subject}\n` +
                         `備註：${remark}\n` +
                         `使用者類型：J\n` +
                         `錯誤原因：${errorMsg}`;
          }
          console.log(`WH_replyMessage: 自行構建的訊息: ${textMessage.substring(0, 50)}...`);
        } catch (formatError) {
          console.log(`WH_replyMessage: 自行構建訊息失敗: ${formatError}`);
          textMessage = `處理您的請求時發生錯誤，請稍後再試。(Error: FORMAT_MESSAGE)`;
        }
      }
      else {
        // 最後嘗試將整個對象轉為字符串
        try {
          textMessage = JSON.stringify(message);
          console.log(`WH_replyMessage: 將對象轉換為字符串: ${textMessage.substring(0, 50)}...`);
        } catch (jsonError) {
          textMessage = "處理您的請求時發生錯誤，請稍後再試。(Error: JSON_CONVERSION)";
          console.log(`WH_replyMessage: 對象轉換為JSON失敗，使用預設訊息: ${jsonError}`);
        }
      }
    } else if (typeof message === 'string') {
      // 直接使用字符串
      textMessage = message;
      console.log(`WH_replyMessage: 使用直接傳入的字符串訊息 (${textMessage.substring(0, 30)}...)`);
    } else {
      // 未知類型，使用預設訊息
      textMessage = "您的請求已收到，但處理過程中出現未知錯誤。(Error: UNKNOWN_TYPE)";
      console.log(`WH_replyMessage: 未知訊息類型: ${typeof message}`);
    }

    // 3. 確保消息不超過LINE的最大長度
    const maxLength = 5000; // LINE消息最大長度
    if (textMessage.length > maxLength) {
      console.log(`WH_replyMessage: 訊息太長 (${textMessage.length}字符)，截斷至${maxLength}字符`);
      textMessage = textMessage.substring(0, maxLength - 3) + '...';
    }

    // 4. 記錄準備發送的訊息
    console.log(`WH_replyMessage: 開始回覆訊息: ${textMessage.substring(0, 50)}${textMessage.length > 50 ? '...' : ''}`);

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
      "INFO"
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
        "ERROR"
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
        "ERROR"
      ]);

      return { success: false, error: "找不到 CHANNEL_ACCESS_TOKEN" };
    }

    // 設置請求頭
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN
    };

    // 設置請求體
    const payload = {
      "replyToken": replyToken,
      "messages": [{
        "type": "text",
        "text": textMessage
      }]
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
      "INFO"
    ]);

    // 使用 axios 發送 HTTP 請求
    return axios.post(url, payload, { headers: headers })
      .then(response => {
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
            "INFO"
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
            "ERROR"
          ]);

          return { success: false, error: JSON.stringify(response.data) };
        }
      })
      .catch(error => {
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
          "ERROR"
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
      "ERROR"
    ]);

    return { success: false, error: error.toString() };
  }
}

/**
 * 7. 處理事件 (非同步版) - 修正訊息處理和數據傳遞問題
 * @version 2.0.3 (2025-06-16 03:18:55)
 * @author AustinLiao69
 * @update: 保留原始數據和完整的錯誤訊息，確保正確顯示負數金額與支付方式
 * @param {Object} event - LINE事件對象
 * @param {string} requestId - 請求ID
 * @param {string} userId - 用戶ID
 */
function WH_processEventAsync(event, requestId, userId) {
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
      "ERROR"
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
      "INFO"
    ]);

    // 確保設置了預處理的replyToken屬性
    if (!event.replyToken && event.type === 'message') {
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
        "ERROR"
      ]);
      return;
    }

    // 根據事件類型處理
    if (event.type === 'message') {
      // 處理消息類型的事件
      console.log(`處理消息事件: ${event.message ? event.message.type : 'unknown'} [${requestId}]`);
      let result;

      if (event.message.type === 'text') {
        // 安全提取和記錄文本內容
        const text = event.message.text || '';
        console.log(`收到文本消息: "${text.substr(0, 50)}${text.length > 50 ? '...' : ''}" [${requestId}]`);

        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.0.3: 收到文本消息: "${text.substr(0, 50)}${text.length > 50 ? '...' : ''}" [${requestId}]`,
          "訊息接收",
          userId,
          "",
          "WH",
          "",
          0,
          "WH_processEventAsync",
          "INFO"
        ]);

        // 準備分發參數 - 明確包含replyToken
        const messageData = {
          text: text,
          userId: userId,
          timestamp: event.timestamp,
          replyToken: event.replyToken // 確保replyToken被傳遞
        };

        // 記錄完整的消息數據
        console.log(`準備訊息數據: ${JSON.stringify(messageData)} [${requestId}]`);

        // 調用分發函數
        try {
          console.log(`準備調用DD_distributeData [${requestId}]`);

          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.3: 準備調用DD_distributeData [${requestId}]`,
            "數據分發",
            userId,
            "",
            "WH",
            "",
            0,
            "WH_processEventAsync",
            "INFO"
          ]);

          // 關鍵：調用DD_distributeData並保留完整結果
          result = DD_distributeData(messageData, 'LINE', 0);

          // 記錄DD_distributeData處理結果預覽
          if (result) {
            // 安全地記錄結果預覽，避免過大物件導致日誌問題
            const resultPreview = {
              success: result.success,
              hasResponseMessage: !!result.responseMessage,
              responseMsgLength: result.responseMessage ? result.responseMessage.length : 0,
              errorType: result.errorType || "無",
              moduleCode: result.moduleCode || "無",
              hasPartialData: !!result.partialData
            };

            console.log(`DD_distributeData處理完成，結果預覽: ${JSON.stringify(resultPreview)} [${requestId}]`);

            // 詳細記錄partialData內容，這對於診斷負數金額和支付方式問題很關鍵
            if (result.partialData) {
              console.log(`partialData內容: ${JSON.stringify(result.partialData)} [${requestId}]`);
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
                paymentMethod: "未指定支付方式"
              }
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
              "ERROR"
            ]);
          }

          // 確保失敗時也有回覆訊息 - 但保留所有原始數據
          if (result.success === false && !result.responseMessage) {
            // 從partialData中嘗試提取有用資訊
            const subject = result.partialData?.subject || "未知科目";
            const amount = result.partialData?.rawAmount || "0";
            const paymentMethod = result.partialData?.paymentMethod || "未指定支付方式";
            const errorMsg = result.error || result.message || "未知錯誤";

            result.responseMessage = `記帳失敗！\n` +
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
              "INFO"
            ]);
          }

          // 關鍵：將完整result對象傳給WH_replyMessage，而非僅傳responseMessage
          console.log(`準備回覆訊息 [${requestId}]`);
          const replyResult = WH_replyMessage(event.replyToken, result);

          // 記錄回覆結果
          console.log(`訊息回覆結果: ${JSON.stringify(replyResult)} [${requestId}]`);

        } catch (ddError) {
          // 異常捕獲處理 - 保留所有可用資訊
          console.log(`DD_distributeData調用失敗: ${ddError.toString()} [${requestId}]`);
          if (ddError.stack) {
            console.log(`錯誤堆疊: ${ddError.stack} [${requestId}]`);
          }

          // 提取可能的原始輸入信息
          const originalInput = text.split('-');
          const possibleSubject = originalInput[0]?.trim() || "未知科目";
          let possibleAmount = originalInput[1]?.trim() || "0";
          let possiblePaymentMethod = "未指定支付方式";

          // 嘗試識別支付方式
          const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
          for (const method of paymentMethods) {
            if (text.includes(method)) {
              possiblePaymentMethod = method;
              // 從possibleAmount中移除支付方式
              possibleAmount = possibleAmount.replace(method, '').trim();
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
              amount: possibleAmount.replace(/[^\d-]/g, ''),
              rawAmount: possibleAmount.replace(/[^\d-]/g, ''),
              paymentMethod: possiblePaymentMethod,
              remark: possibleSubject
            }
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
            "ERROR"
          ]);

          // 仍然嘗試回覆用戶 - 使用完整的result對象
          WH_replyMessage(event.replyToken, result);
        }
      }
      else if (event.message.type === 'location') {
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
          "INFO"
        ]);

        // 位置消息處理 (如需要可在此處添加)
      }
      else {
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
          "INFO"
        ]);

        // 發送簡單提示訊息
        WH_replyMessage(event.replyToken, {
          success: false,
          responseMessage: "很抱歉，目前僅支援文字訊息處理。"
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
        "INFO"
      ]);

      // 處理特定非消息事件類型
      if (event.type === 'follow') {
        // 處理用戶關注事件
        WH_replyMessage(event.replyToken, {
          success: true,
          responseMessage: "感謝您加入記帳助手！\n輸入 '幫助' 或 '?' 可獲取使用說明。"
        });
      }
      else if (event.type === 'unfollow') {
        // 處理用戶取消關注事件 - 無法回覆
        console.log(`用戶 ${userId} 取消關注 [${requestId}]`);
      }
      else if (event.type === 'join') {
        // 處理加入群組事件
        WH_replyMessage(event.replyToken, {
          success: true,
          responseMessage: "感謝邀請記帳助手加入！\n輸入 '幫助' 或 '?' 可獲取使用說明。"
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
      "ERROR"
    ]);

    // 嘗試回覆用戶錯誤信息（如果可能）
    try {
      if (event && event.replyToken) {
        WH_replyMessage(event.replyToken, {
          success: false,
          responseMessage: "處理您的請求時發生系統錯誤，請稍後再試。"
        });
      }
    } catch (replyError) {
      console.log(`回覆錯誤訊息失敗: ${replyError} [${requestId}]`);
    }
  }
}

/**
 * 8. 驗證 LINE 平台簽章 - 增強安全性
 * @version 2.0.5 (2025-06-19)
 * @author AustinLiao69
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
    const hmac = crypto.createHmac('sha256', channelSecret);
    hmac.update(body);
    const calculatedSignature = hmac.digest('base64');

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

/**
 * 9. 向 LINE 用戶推送訊息（主動推送）
 * @version 2.0.5 (2025-06-19)
 * @author AustinLiao69
 * @param {string} userId - LINE 用戶 ID
 * @param {string|Object} message - 要發送的訊息內容
 * @returns {Promise<Object>} 發送結果
 */
function WH_pushMessage(userId, message) {
  return new Promise((resolve, reject) => {
    try {
      // 檢查用戶ID是否有效
      if (!userId || userId.trim() === '') {
        console.log("WH_pushMessage: 無效的用戶ID");
        return resolve({ success: false, error: "無效的用戶ID" });
      }

      // 處理訊息內容
      let textMessage = "";

      if (typeof message === 'object' && message !== null) {
        if (message.responseMessage && typeof message.responseMessage === 'string') {
          textMessage = message.responseMessage;
        } else if (message.message && typeof message.message === 'string') {
          textMessage = message.message;
        } else {
          try {
            textMessage = JSON.stringify(message);
          } catch (jsonError) {
            textMessage = "系統訊息";
            console.log(`WH_pushMessage: 轉換訊息失敗: ${jsonError}`);
          }
        }
      } else if (typeof message === 'string') {
        textMessage = message;
      } else {
        textMessage = "系統訊息";
      }

      // 確保訊息長度不超過限制
      const maxLength = 5000;
      if (textMessage.length > maxLength) {
        textMessage = textMessage.substring(0, maxLength - 3) + '...';
      }

      // LINE Messaging API URL
      const url = 'https://api.line.me/v2/bot/message/push';

      // 獲取 Channel Access Token
      const channelAccessToken = WH_CONFIG.LINE.CHANNEL_ACCESS_TOKEN;
      if (!channelAccessToken) {
        console.log("WH_pushMessage: 缺少 Channel Access Token");
        return resolve({ success: false, error: "缺少 Channel Access Token" });
      }

      // 設置請求
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      };

      const payload = {
        to: userId,
        messages: [{
          type: 'text',
          text: textMessage
        }]
      };

      // 發送 HTTP 請求
      console.log(`WH_pushMessage: 開始向用戶 ${userId} 推送訊息`);

      // 記錄推送嘗試
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.5: 開始向用戶推送訊息`,
        "訊息推送",
        userId,
        "",
        "WH",
        "",
        0,
        "WH_pushMessage",
        "INFO"
      ]);

      // 使用 axios 發送請求
      axios.post(url, payload, { headers: headers })
        .then(response => {
          if (response.status === 200) {
            console.log(`WH_pushMessage: 成功推送訊息給用戶 ${userId}`);

            // 記錄推送成功
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.5: 成功推送訊息給用戶`,
              "訊息推送",
              userId,
              "",
              "WH",
              "",
              0,
              "WH_pushMessage",
              "INFO"
            ]);

            resolve({ success: true });
          } else {
            console.log(`WH_pushMessage: API回應異常 ${response.status}`);

            // 記錄推送失敗
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.5: API回應異常 ${response.status}`,
              "訊息推送",
              userId,
              "API_ERROR",
              "WH",
              JSON.stringify(response.data),
              0,
              "WH_pushMessage",
              "ERROR"
            ]);

            resolve({ 
              success: false, 
              error: `API回應異常 (${response.status})`,
              details: response.data
            });
          }
        })
        .catch(error => {
          console.log(`WH_pushMessage: 推送訊息錯誤 ${error}`);

          // 記錄推送錯誤
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.5: 推送訊息錯誤`,
            "訊息推送",
            userId,
            "PUSH_ERROR",
            "WH",
            error.toString(),
            0,
            "WH_pushMessage",
            "ERROR"
          ]);

          resolve({ 
            success: false, 
            error: error.toString() 
          });
        });

    } catch (error) {
      console.log(`WH_pushMessage: 主錯誤 ${error}`);

      // 記錄函數級錯誤
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.5: 推送訊息主錯誤`,
        "訊息推送",
        userId,
        "FUNCTION_ERROR",
        "WH",
        error.toString(),
        0,
        "WH_pushMessage",
        "ERROR"
      ]);

      resolve({ 
        success: false, 
        error: error.toString() 
      });
    }
  });
}

/**
 * 10. 批次向多個 LINE 用戶推送相同訊息
 * @version 2.0.5 (2025-06-19)
 * @author AustinLiao69
 * @param {Array<string>} userIds - LINE 用戶 ID 陣列
 * @param {string|Object} message - 要發送的訊息內容
 * @returns {Promise<Object>} 發送結果
 */
function WH_multicastMessage(userIds, message) {
  return new Promise((resolve, reject) => {
    try {
      // 檢查用戶ID陣列是否有效
      if (!Array.isArray(userIds) || userIds.length === 0) {
        console.log("WH_multicastMessage: 無效的用戶ID陣列");
        return resolve({ success: false, error: "無效的用戶ID陣列" });
      }

      // 處理訊息內容
      let textMessage = "";

      if (typeof message === 'object' && message !== null) {
        if (message.responseMessage && typeof message.responseMessage === 'string') {
          textMessage = message.responseMessage;
        } else if (message.message && typeof message.message === 'string') {
          textMessage = message.message;
        } else {
          try {
            textMessage = JSON.stringify(message);
          } catch (jsonError) {
            textMessage = "系統訊息";
            console.log(`WH_multicastMessage: 轉換訊息失敗: ${jsonError}`);
          }
        }
      } else if (typeof message === 'string') {
        textMessage = message;
      } else {
        textMessage = "系統訊息";
      }

      // 確保訊息長度不超過限制
      const maxLength = 5000;
      if (textMessage.length > maxLength) {
        textMessage = textMessage.substring(0, maxLength - 3) + '...';
      }

      // LINE Messaging API URL
      const url = 'https://api.line.me/v2/bot/message/multicast';

      // 獲取 Channel Access Token
      const channelAccessToken = WH_CONFIG.LINE.CHANNEL_ACCESS_TOKEN;
      if (!channelAccessToken) {
        console.log("WH_multicastMessage: 缺少 Channel Access Token");
        return resolve({ success: false, error: "缺少 Channel Access Token" });
      }

      // 設置請求
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      };

      const payload = {
        to: userIds,
        messages: [{
          type: 'text',
          text: textMessage
        }]
      };

      // 發送 HTTP 請求
      console.log(`WH_multicastMessage: 開始向 ${userIds.length} 個用戶推送訊息`);

      // 記錄批次推送嘗試
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.5: 開始向 ${userIds.length} 個用戶批次推送訊息`,
        "批次推送",
        userIds.slice(0, 3).join(',') + (userIds.length > 3 ? '...' : ''),
        "",
        "WH",
        "",
        0,
        "WH_multicastMessage",
        "INFO"
      ]);

      // 使用 axios 發送請求
      axios.post(url, payload, { headers: headers })
        .then(response => {
          if (response.status === 200) {
            console.log(`WH_multicastMessage: 成功批次推送訊息給 ${userIds.length} 個用戶`);

            // 記錄批次推送成功
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.5: 成功批次推送訊息給 ${userIds.length} 個用戶`,
              "批次推送",
              userIds.slice(0, 3).join(',') + (userIds.length > 3 ? '...' : ''),
              "",
              "WH",
              "",
              0,
              "WH_multicastMessage",
              "INFO"
            ]);

            resolve({ success: true, count: userIds.length });
          } else {
            console.log(`WH_multicastMessage: API回應異常 ${response.status}`);

            // 記錄批次推送失敗
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.0.5: 批次推送API回應異常 ${response.status}`,
              "批次推送",
              userIds.slice(0, 3).join(',') + (userIds.length > 3 ? '...' : ''),
              "API_ERROR",
              "WH",
              JSON.stringify(response.data),
              0,
              "WH_multicastMessage",
              "ERROR"
            ]);

            resolve({ 
              success: false, 
              error: `API回應異常 (${response.status})`,
              details: response.data
            });
          }
        })
        .catch(error => {
          console.log(`WH_multicastMessage: 批次推送訊息錯誤 ${error}`);

          // 記錄批次推送錯誤
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.0.5: 批次推送訊息錯誤`,
            "批次推送",
            userIds.slice(0, 3).join(',') + (userIds.length > 3 ? '...' : ''),
            "MULTICAST_ERROR",
            "WH",
            error.toString(),
            0,
            "WH_multicastMessage",
            "ERROR"
          ]);

          resolve({ 
            success: false, 
            error: error.toString() 
          });
        });

    } catch (error) {
      console.log(`WH_multicastMessage: 主錯誤 ${error}`);

      // 記錄函數級錯誤
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.0.5: 批次推送主錯誤`,
        "批次推送",
        userIds ? (userIds.slice(0, 3).join(',') + (userIds.length > 3 ? '...' : '')) : 'unknown',
        "FUNCTION_ERROR",
        "WH",
        error.toString(),
        0,
        "WH_multicastMessage",
        "ERROR"
      ]);

      resolve({ 
        success: false, 
        error: error.toString() 
      });
    }
  });
}

// 更新 Express 路由處理以包含簽章驗證
app.post('/webhook', (req, res) => {
  // 獲取 LINE 平台簽章
  const signature = req.headers['x-line-signature'];

  // 獲取請求主體
  const body = JSON.stringify(req.body);

  // 驗證簽章
  if (!WH_verifySignature(signature, body)) {
    // 簽章驗證失敗
    console.log("簽章驗證失敗");
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      "WH 2.0.5: 簽章驗證失敗",
      "安全檢查",
      "",
      "INVALID_SIGNATURE",
      "WH",
      "",
      0,
      "app.post(/webhook)",
      "ERROR"
    ]);

    return res.status(403).json({
      status: "error",
      error: "簽章驗證失敗"
    });
  }

  // 簽章驗證成功，調用處理函數
  doPost(req, res);
});

// 導出更多函數供其他模組使用
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
  WH_pushMessage,
  WH_multicastMessage,
  doPost  // 導出主要處理函數
};