/**
 * WH_Webhook處理模組_2.5.3
 * @module Webhook模組
 * @description LINE Webhook處理模組 - 階段三完成：支援連續性Quick Reply處理，識別Pending Record相關事件
 * @update 2025-12-19: 升級至v2.5.3，新增Pending Record postback識別和路由邏輯，支援多階段處理流程
 */

// 首先引入其他模組 - 增強安全載入
let DD, BK, LBK, SR, DL, AM;

try {
  DD = require("./1331. DD1.js");
} catch (error) {
  console.log("DD模組載入失敗:", error.message);
}

try {
  BK = require("./1301. BK.js");
} catch (error) {
  console.log("BK模組載入失敗:", error.message);
}

try {
  SR = require('./1305. SR.js');
} catch (error) {
  console.log("SR模組載入失敗:", error.message);
}

try {
  DL = require("./1310. DL.js");
} catch (error) {
  console.log("DL模組載入失敗:", error.message);
}

try {
  AM = require("./1309. AM.js");
} catch (error) {
  console.log("AM模組載入失敗:", error.message);
}

// FS模組已移除 - 階段五完成：職責分散至專門模組


// 引入必要的 Node.js 模組 - 移除Express相關依賴
const axios = require("axios");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const NodeCache = require("node-cache");

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

// 初始化Firebase（使用動態配置）
let admin, db;

try {
  // 取得Firebase Admin實例
  admin = firebaseConfig.admin;

  // 初始化Firebase（如果尚未初始化）
  firebaseConfig.initializeFirebaseAdmin();

  // 取得 Firestore 實例
  db = firebaseConfig.getFirestoreInstance();

  

} catch (error) {
  console.error("❌ WH模組：Firebase動態配置初始化失敗:", error.message);

  // 檢查環境變數設定狀態
  const envCheck = firebaseConfig.checkEnvironmentVariables();
  if (!envCheck.isComplete) {
    console.log('💡 WH模組：請檢查Replit Secrets中的Firebase環境變數設定');
    console.log(`缺少變數: ${envCheck.missingVars.join(', ')}`);
  }
}

// 1. 配置參數 - 階段二：優化日誌記錄
const WH_CONFIG = {
  DEBUG: true, // 統一環境：允許所有環境輸出調試日誌
  TEST_MODE: true, // 測試模式：跳過簽章驗證
  LOG_MESSAGE_CONTENT: true, // 統一環境：允許所有環境記錄訊息內容
  MESSAGE_DEDUPLICATION: true, // 啟用消息去重
  MESSAGE_RETENTION_HOURS: 24, // 消息ID保留時間(小時)
  ASYNC_PROCESSING: true, // 啟用異步處理（快速回應）

  // 階段二新增：記憶體追蹤
  MEMORY_TRACKING: {
    enabled: true,
    maxEntries: 50,
    trackingData: new Map() // 使用Map追蹤處理狀態
  },
  FIRESTORE: {
    COLLECTION: "ledgers", // Firestore集合名稱
    LOG_SUBCOLLECTION: "log", // 日誌子集合名稱
  },
  LINE: {
    CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET, // 從環境變數獲取 LINE Channel Secret
    CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN, // 從環境變數獲取 LINE Channel Access Token
    Webhook_URL: process.env.Webhook_URL, // 從環境變數獲取 Webhook URL
  },
  RETRY: {
    MAX_COUNT: 2, // 減少重試次數
    DELAY_MS: 1000,
  },
  TIMEZONE: "Asia/Taipei", // 台灣時區
};

// Quick Reply 配置
const WH_QUICK_REPLY_CONFIG = {
  MAX_ITEMS: 4,
  STATISTICS_KEYWORDS: ['本日統計', '本週統計', '本月統計'],
  PREMIUM_KEYWORDS: ['upgrade_premium', '試用', '功能介紹'],
  REMINDER_KEYWORDS: ['setup_daily_reminder', 'setup_weekly_reminder', 'setup_monthly_reminder'],
  WALLET_KEYWORDS: ['wallet_confirm_yes', 'wallet_confirm_no']
};

/**
 * 環境變數完整性檢查函數
 * @version 2025-01-28-V2.3.0
 * @description 檢查所有必要的環境變數是否已正確設定
 */
function WH_checkEnvironmentVariables() {
  const requiredEnvVars = [
    'LINE_CHANNEL_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'Webhook_URL'
  ];

  const missingVars = [];
  const envStatus = {};

  // 檢查每個必要的環境變數
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    envStatus[varName] = {
      exists: !!value,
      hasValue: value && value.trim() !== '',
      length: value ? value.length : 0
    };

    if (!value || value.trim() === '') {
      missingVars.push(varName);
    }
  });

  const isComplete = missingVars.length === 0;

  

  if (!isComplete) {
    console.warn(`⚠️  缺少必要環境變數: ${missingVars.join(', ')}`);
    console.warn('💡 請在Replit Secrets中設定這些環境變數');
  }

  return {
    isComplete,
    missingVars,
    envStatus,
    requiredVars: requiredEnvVars
  };
}

// 初始化檢查 - 在全局執行一次


// 執行環境變數完整性檢查
const envCheckResult = WH_checkEnvironmentVariables();

// 統一環境：始終記錄環境變數檢查結果
if (!envCheckResult.isComplete) {
  console.warn('⚠️ WH模組環境變數不完整，建議在部署前設定完整');
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    `WH 2.3.0: 環境變數檢查未通過，缺少: ${envCheckResult.missingVars.join(', ')}`,
    "模組初始化",
    "",
    "ENV_INCOMPLETE",
    "WH",
    "部分必要環境變數未設定，請檢查Replit Secrets配置",
    0,
    "WH_init",
    "WARNING",
  ]);
} else {
  console.log('✅ WH模組環境變數檢查完整');
  WH_directLogWrite([
    WH_formatDateTime(new Date()),
    `WH 2.3.0: 環境變數檢查完整`,
    "模組初始化",
    "",
    "",
    "WH",
    "",
    0,
    "WH_init",
    "INFO",
  ]);
}

// 創建緩存服務 - 保留核心功能
const cache = new NodeCache({ stdTTL: 600 }); // 10分鐘緩存

// 創建持久化存儲 (模擬 PropertiesService) - 保留核心功能
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
          // 獲取用戶ID - 增強空值檢查
          let userId = "";
          if (event && event.source && event.source.userId) {
            userId = event.source.userId;
          } else {
            console.log(`事件缺少用戶ID: ${JSON.stringify(event)} [${requestId}]`);
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.1.3: 事件缺少用戶ID，跳過處理 [${requestId}]`,
              "事件驗證",
              userId,
              "MISSING_USER_ID",
              "WH",
              JSON.stringify(event),
              0,
              "processWebhookAsync",
              "WARNING",
            ], userId);
            continue; // 跳過此事件的處理
          }

          // 檢查消息去重 - 使用NodeCache進行去重檢查
          if (
            WH_CONFIG.MESSAGE_DEDUPLICATION &&
            event.type === "message" &&
            event.message &&
            typeof event.message === 'object' &&
            event.message.id
          ) {
            // 安全訪問message.id屬性
            const messageId = event.message.id;
            if (messageId && typeof messageId === 'string') {
              // 使用NodeCache進行消息去重檢查
              try {
                const isDuplicate = WH_checkDuplicateMessage(messageId, requestId);
                if (isDuplicate) {
                  WH_directLogWrite([
                    WH_formatDateTime(new Date()),
                    `WH 2.4.0: 跳過重複消息ID: ${messageId} [${requestId}]`,
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
              } catch (cacheError) {
                console.log(`NodeCache去重檢查失敗: ${cacheError.message} [${requestId}]`);
                WH_directLogWrite([
                  WH_formatDateTime(new Date()),
                  `WH 2.4.0: NodeCache去重檢查失敗: ${cacheError.message} [${requestId}]`,
                  "消息去重",
                  userId,
                  "CACHE_ERROR",
                  "WH",
                  cacheError.toString(),
                  0,
                  "processWebhookAsync",
                  "WARNING",
                ], userId);
              }
            } else {
              console.log(`訊息ID格式無效: ${JSON.stringify(event.message)} [${requestId}]`);
              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH 2.4.0: 訊息ID格式無效 [${requestId}]`,
                "消息驗證",
                userId,
                "INVALID_MESSAGE_ID",
                "WH",
                JSON.stringify(event.message),
                0,
                "processWebhookAsync",
                "WARNING",
              ], userId);
            }
          }

          if (event.type === "message") {
            // 處理消息事件 - 增強安全檢查
            if (event.message && typeof event.message === 'object') {
              await WH_processEventAsync(event, requestId, userId);
            } else {
              console.log(`訊息事件缺少message物件: ${JSON.stringify(event)} [${requestId}]`);
              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH 2.1.3: 訊息事件缺少message物件 [${requestId}]`,
                "事件驗證",
                userId,
                "INVALID_MESSAGE_OBJECT",
                "WH",
                JSON.stringify(event),
                0,
                "processWebhookAsync",
                "ERROR",
              ]);
            }
          } else if (event.type === 'postback') {
            const postbackData = event.postback.data;
            console.log(`WH v2.5.3: 收到postback事件: ${postbackData}`);

            // 階段一修復：明確標記postback事件類型並正確路由
            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 2.5.3: 階段一修復 - 識別postback事件類型: ${postbackData} [${requestId}]`,
              "Postback路由",
              userId,
              "",
              "WH",
              "",
              0,
              "WH_processEventAsync",
              "INFO",
            ]);

            const postbackInputData = {
              userId: userId,
              messageText: postbackData,
              replyToken: event.replyToken,
              timestamp: event.timestamp,
              processId: requestId,
              eventType: 'postback', // 階段一修復：明確標記為postback事件
              postbackData: postbackData
            };

            // 階段一修復：統一路由到LBK處理
            const postbackResult = await WH_callLBKSafely(postbackInputData);

            // 確保正確傳遞quickReply和回覆結果
            if (postbackResult && event.replyToken) {
              await WH_replyMessage(event.replyToken, postbackResult, postbackResult.quickReply);

              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH 2.5.3: postback處理完成並回覆用戶 [${requestId}]`,
                "Postback完成",
                userId,
                "",
                "WH",
                "",
                0,
                "WH_processEventAsync",
                "INFO",
              ]);
            }
          } else {
            // 處理非消息事件 (follow, unfollow, join 等)
            console.log(`收到非消息事件: ${event.type} [${requestId}]`);
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

                  // 帳號建立成功，不回覆歡迎訊息
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

                  // 即使建立失敗，不回覆歡迎訊息
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

                // 不發送歡迎訊息
              }
            } else if (event.type === "unfollow") {
              // 處理用戶取消關注事件 - 無法回覆
              console.log(`用戶 ${userId} 取消關注 [${requestId}]`);
            } else if (event.type === "join") {
              // 處理加入群組事件，不回覆歡迎訊息
            }
            // 可處理其他事件類型...
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

    // 處理消息事件
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
  // 統一環境：始終輸出調試日誌
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
 * 09. 回覆訊息到LINE
 * @version 2025-07-21-V2.1.0
 * @date 2025-07-21 10:30:00
 * @update: 支援Quick Reply訊息格式，擴展回覆功能
 */
async function WH_replyMessage(replyToken, message, quickReply = null) {
  try {
    // 擴展格式驗證：支援字串訊息和格式化物件訊息
    let isValidFormat = false;

    if (typeof message === 'string') {
      // 直接接受字串格式
      isValidFormat = true;
    } else if (message && typeof message === 'object') {
      // 檢查是否為有效的格式化物件
      if (message.responseMessage || message.message) {
        isValidFormat = true;
      } else if (message.moduleCode === 'BK' || message.module === 'BK' ||
        message.moduleCode === 'LBK' || message.module === 'LBK') {
        isValidFormat = true;
      }
    }

    if (!isValidFormat) {
      console.error('WH_replyMessage: 拒絕未經正確格式化的訊息');
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.1.2: 拒絕未經格式化的訊息，type=${typeof message}, moduleCode=${message?.moduleCode || "未定義"}`,
        "訊息驗證",
        "",
        "INVALID_MESSAGE_FORMAT",
        "WH",
        "訊息格式不符合規範",
        0,
        "WH_replyMessage",
        "ERROR",
      ]);
      return {
        success: false,
        error: "訊息格式不符合規範"
      };
    }

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

    // 3. 確保消息不超過LINE Makarna長度
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

      return {
        success: false,
        error: "無效的回覆令牌"
      };
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

      return {
        success: false,
        error: "找不到 CHANNEL_ACCESS_TOKEN"
      };
    }

    // 建立基本訊息
    const messageObj = {
      type: 'text',
      text: textMessage
    };

    // 如果有Quick Reply，加入快速回覆選項
    if (quickReply && quickReply.items && quickReply.items.length > 0) {
      messageObj.quickReply = {
        items: quickReply.items.map(item => {
          // 處理不同的item格式
          if (item.type === 'action' && item.action) {
            // 已經是正確的LINE格式
            return item;
          } else {
            // 舊格式，需要轉換
            return {
              type: 'action',
              action: {
                type: 'postback',
                label: item.label || item.text || 'Unknown',
                data: item.postbackData || item.data || 'unknown',
                displayText: item.label || item.text || 'Unknown'
              }
            };
          }
        })
      };
    }

    const replyData = {
      replyToken: replyToken,
      messages: [messageObj]
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

    // 設定請求標頭
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    };

    // 使用 axios 發送 HTTP 請求
    return axios
      .post(url, replyData, {
        headers: headers
      })
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

          return {
            success: true
          };
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

          return {
            success: false,
            error: JSON.stringify(response.data)
          };
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

        return {
          success: false,
          error: error.toString()
        };
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

    return {
      success: false,
      error: error.toString()
    };
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
 * 06. 安全調用LBK模組處理函數
 * @version 2025-12-16-V2.5.0
 * @date 2025-12-16 14:00:00
 * @description DCN-0024階段二：純粹轉發機制，支援科目歸類兩階段對話
 */
async function WH_callLBKSafely(inputData) {
  try {
    // 動態載入LBK模組
    if (!LBK) {
      LBK = require("./1315. LBK.js");
    }

    // 驗證函數存在性
    if (!LBK || typeof LBK.LBK_processQuickBookkeeping !== 'function') {
      throw new Error('LBK模組不可用或函數不存在');
    }

    // v2.5.0: 純粹調用LBK處理函數，不做任何業務判斷
    console.log(`WH v2.5.0: 純粹轉發至LBK處理 - ${inputData.messageText}`);
    const result = await LBK.LBK_processQuickBookkeeping(inputData);

    // v2.5.0: 最小化格式調整，確保模組標識
    if (result && !result.moduleCode) {
      result.moduleCode = 'LBK';
      result.module = 'LBK';
    }

    // v2.5.0: 完全信任LBK結果，包含科目歸類流程
    return result;

  } catch (error) {
    console.log(`WH v2.5.0: LBK調用失敗，返回最小錯誤格式: ${error.toString()}`);

    // v2.5.0: 最小化錯誤回覆格式
    return {
      success: false,
      message: "系統暫時無法處理您的請求，請稍後再試",
      responseMessage: "系統暫時無法處理您的請求，請稍後再試",
      moduleCode: 'LBK',
      module: 'LBK',
      error: error.toString()
    };
  }
}

/**
 * 07. 處理事件 (非同步版) - LINE文字訊息完全分離處理
 * @version 2025-07-14-V2.0.20
 * @date 2025-07-14 15:00:00
 * @update: 實現LINE文字訊息與DD模組完全分離，所有LINE文字訊息強制走BK 2.0直連路徑，不經過DD模組
 * @param {Object} event - LINE事件對象
 * @param {string} requestId - 請求ID
 * @param {string} userId - 用戶ID
 */
async function WH_processEventAsync(event, requestId, userId) {
  // 增強基本參數檢查
  if (!event || typeof event !== 'object') {
    console.log(`無效事件物件: ${JSON.stringify(event)} [${requestId}]`);
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.1.3: 無效事件物件 [${requestId}]`,
      "事件處理",
      userId || "",
      "INVALID_EVENT_OBJECT",
      "WH",
      typeof event === 'object' ? JSON.stringify(event) : String(event),
      0,
      "WH_processEventAsync",
      "ERROR",
    ]);
    return;
  }

  if (!event.type) {
    console.log(`事件缺少type屬性: ${JSON.stringify(event)} [${requestId}]`);
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.1.3: 事件缺少type屬性 [${requestId}]`,
      "事件處理",
      userId || "",
      "MISSING_EVENT_TYPE",
      "WH",
      JSON.stringify(event),
      0,
      "WH_processEventAsync",
      "ERROR",
    ]);
    return;
  }

  // 確保userId存在
  if (!userId) {
    console.log(`缺少用戶ID: ${JSON.stringify(event)} [${requestId}]`);
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.1.3: 缺少用戶ID [${requestId}]`,
      "事件處理",
      "",
      "MISSING_USER_ID",
      "WH",
      JSON.stringify(event),
      0,
      "WH_processEventAsync",
      "ERROR",
    ]);
    return;
  }

  try {
    // 階段一修復：統一所有環境的日誌輸出
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

    // 同時使用記憶體追蹤（保留原有功能）
    WH_CONFIG.MEMORY_TRACKING.trackingData.set(requestId, {
      eventType: event.type,
      userId: userId,
      startTime: Date.now(),
      status: 'processing'
    });

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

        // 根據事件類型實現完全路徑分離
        try {
          // 階段一：實施WH→AM→LBK直接轉發流程
          console.log(`開始AM用戶驗證流程 [${requestId}]`);

          // 階段一修復：統一所有環境的AM驗證日誌
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 階段一: 開始AM用戶驗證流程 [${requestId}]`,
            "AM驗證",
            userId,
            "",
            "WH",
            "",
            0,
            "WH_processEventAsync",
            "INFO",
          ]);

          // 步驟1：文字訊息處理前，安全調用 AM.AM_validateAccountExists
          let accountValidation;
          try {
            // 動態載入AM模組避免循環依賴
            const AM_Module = require("./1309. AM.js");
            if (AM_Module && typeof AM_Module.AM_validateAccountExists === 'function') {
              accountValidation = await AM_Module.AM_validateAccountExists(userId, "LINE");
            } else {
              throw new Error("AM_validateAccountExists函數不可用");
            }
          } catch (amError) {
            console.error(`AM模組調用失敗: ${amError.message}`);
            // 降級處理：假設用戶存在，繼續處理
            accountValidation = {
              exists: true,
              UID: userId
            };
          }

          if (!accountValidation.exists) {
            // 用戶不存在，自動建立LINE帳號並初始化帳本
            console.log(`用戶不存在，開始自動註冊流程: ${userId} [${requestId}]`);

            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 階段一: 用戶不存在，開始自動註冊 ${userId} [${requestId}]`,
              "AM註冊",
              userId,
              "",
              "WH",
              "",
              0,
              "WH_processEventAsync",
              "INFO",
            ]);

            try {
              // 動態載入AM模組避免循環依賴
              const AM_Module = require("./1309. AM.js");
              if (AM_Module && typeof AM_Module.AM_createLineAccount === 'function') {
                // 建立LINE帳號（使用J類型用戶）
                const createResult = await AM_Module.AM_createLineAccount(userId, null, 'J');

                if (createResult.success) {
                  console.log(`✅ 自動註冊成功: ${userId}, 帳本ID: ${createResult.accountId} [${requestId}]`);

                  WH_directLogWrite([
                    WH_formatDateTime(new Date()),
                    `WH 階段一: 自動註冊成功 ${userId} [${requestId}]`,
                    "AM註冊",
                    userId,
                    "",
                    "WH",
                    "",
                    0,
                    "WH_processEventAsync",
                    "INFO",
                  ]);

                  // 註冊成功，繼續後續流程（不需要return，讓程式繼續執行）
                } else {
                  throw new Error(`自動註冊失敗: ${createResult.error}`);
                }
              } else {
                throw new Error("AM_createLineAccount函數不可用");
              }
            } catch (createError) {
              console.error(`❌ 自動註冊失敗: ${createError.message} [${requestId}]`);

              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH 階段一: 自動註冊失敗 ${userId}: ${createError.message} [${requestId}]`,
                "AM註冊",
                userId,
                "AUTO_REGISTER_FAILED",
                "WH",
                createError.message,
                0,
                "WH_processEventAsync",
                "ERROR",
              ]);

              // 註冊失敗，回覆錯誤訊息
              const errorMessage = "系統初始化失敗，請稍後再試或聯繫客服";
              await WH_replyMessage(event.replyToken, errorMessage);
              return;
            }
          }

          console.log(`用戶帳本驗證流程完成: ${userId} [${requestId}]`);

          // 步驟2：確保帳本正確初始化，安全調用 AM.AM_getUserDefaultLedger
          let ledgerResult;
          try {
            // 動態載入AM模組避免循環依賴
            const AM_Module = require("./1309. AM.js");
            if (AM_Module && typeof AM_Module.AM_getUserDefaultLedger === 'function') {
              ledgerResult = await AM_Module.AM_getUserDefaultLedger(userId);
            } else {
              throw new Error("AM_getUserDefaultLedger函數不可用");
            }
          } catch (amError) {
            console.error(`AM模組調用失敗: ${amError.message}`);
            // 降級處理：生成預設帳本ID
            ledgerResult = {
              success: true,
              ledgerId: `user_${userId}`,
              initialized: false
            };
          }

          if (!ledgerResult.success) {
            // 帳本初始化失敗，直接回覆錯誤訊息
            const errorMessage = "帳本初始化失敗，請稍後再試";

            WH_directLogWrite([
              WH_formatDateTime(new Date()),
              `WH 階段一: 帳本初始化失敗 ${userId}: ${ledgerResult.error} [${requestId}]`,
              "AM驗證",
              userId,
              "LEDGER_INIT_FAILED",
              "WH",
              ledgerResult.error,
              0,
              "WH_processEventAsync",
              "ERROR",
            ]);

            await WH_replyMessage(event.replyToken, errorMessage);
            return;
          }

          console.log(`用戶帳本驗證通過: ${ledgerResult.ledgerId} [${requestId}]`);

          // 階段一修復：統一所有環境的轉發流程日誌
          console.log(`AM驗證完成，轉發至LBK [${requestId}]`);
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 階段一: AM驗證完成，轉發至LBK [${requestId}]`,
            "轉發流程",
            userId,
            "",
            "WH",
            "",
            0,
            "WH_processEventAsync",
            "INFO",
          ]);

          // 步驟3：初始化完成後，轉發給 LBK 處理（包含科目歸類）
          const lbkInputData = {
            userId: userId,
            messageText: text,
            replyToken: event.replyToken,
            timestamp: event.timestamp,
            processId: requestId,
            ledgerId: ledgerResult.ledgerId, // 傳遞已驗證的帳本ID
            eventType: 'text_message' // v2.5.0: 標記事件類型
          };

          // v2.5.0: 純粹轉發機制 - 不做任何業務判斷
          const lbkResult = await WH_callLBKSafely(lbkInputData);

          if (lbkResult && event.replyToken) {
            // 修復：如果LBK返回需要用戶選擇的結果，將pending資料儲存到快取
            if (lbkResult.requiresUserSelection && lbkResult.pendingData) {
              try {
                const pendingDataKey = `WH_PENDING_${userId}`;
                cache.set(pendingDataKey, JSON.stringify(lbkResult.pendingData), 600); // 10分鐘過期
                console.log(`已儲存pending記帳資料到快取: ${pendingDataKey} [${requestId}]`);

                WH_directLogWrite([
                  WH_formatDateTime(new Date()),
                  `WH 2.5.1: 已儲存pending記帳資料，等待用戶選擇科目 [${requestId}]`,
                  "科目歸類",
                  userId,
                  "",
                  "WH",
                  "",
                  0,
                  "WH_processEventAsync",
                  "INFO",
                ]);
              } catch (cacheError) {
                console.log(`儲存pending資料失敗: ${cacheError.message} [${requestId}]`);
              }
            }

            await WH_replyMessage(event.replyToken, lbkResult, lbkResult.quickReply);

            // 階段二：只記錄最終處理結果
            if (lbkResult && !lbkResult.success) {
              // 處理失敗時才寫入日誌
              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH: LBK處理失敗 [${requestId}]: ${lbkResult.error || '未知錯誤'}`,
                "記帳處理",
                userId,
                "LBK_PROCESS_ERROR",
                "WH",
                lbkResult.error || "",
                0,
                "WH_processEventAsync",
                "ERROR",
              ]);
            } else {
              // 階段一修復：統一所有環境的處理完成日誌
              console.log(`LBK處理完成 [${requestId}]`);
              WH_directLogWrite([
                WH_formatDateTime(new Date()),
                `WH 階段一: LBK處理完成 [${requestId}]`,
                "處理完成",
                userId,
                "",
                "WH",
                "",
                0,
                "WH_processEventAsync",
                "INFO",
              ]);
            }

            // 更新記憶體追蹤狀態
            if (WH_CONFIG.MEMORY_TRACKING.trackingData.has(requestId)) {
              const tracking = WH_CONFIG.MEMORY_TRACKING.trackingData.get(requestId);
              tracking.status = 'completed';
              tracking.endTime = Date.now();
              tracking.success = lbkResult ? lbkResult.success : false;
            }
          }

          // 記錄DD_distributeData處理結果預覽
          if (lbkResult) {
            // 安全地記錄結果預覽，避免過大物件導致日誌問題
            const resultPreview = {
              success: lbkResult.success,
              hasResponseMessage: !!lbkResult.responseMessage,
              responseMsgLength: lbkResult.responseMessage
                ? lbkResult.responseMessage.length
                : 0,
              errorType: lbkResult.errorType || "無",
              moduleCode: lbkResult.moduleCode || "無",
              hasPartialData: !!lbkResult.partialData,
            };

            console.log(
              `DD_distributeData處理完成，結果預覽: ${JSON.stringify(resultPreview)} [${requestId}]`,
            );

            // 詳細記錄partialData內容，這對於診斷負數金額和支付方式問題很關鍵
            if (lbkResult.partialData) {
              console.log(
                `partialData內容: ${JSON.stringify(lbkResult.partialData)} [${requestId}]`,
              );
            }
          } else {
            console.log(`DD_distributeData返回空結果 [${requestId}]`);
          }

          // v2.5.0: 完全信任LBK模組處理結果，準備轉發回覆 [${requestId}]`);
          console.log(`WH v2.5.0: 完全信任LBK處理結果，準備轉發回覆 [${requestId}]`);

          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.5.1: DCN-0024 階段二 - 正確傳遞Quick Reply參數 [${requestId}]`,
            "純粹轉發",
            userId,
            "",
            "WH",
            "",
            0,
            "WH_processEventAsync",
            "INFO",
          ]);

          // 記錄處理結果
          console.log(
            `訊息處理結果: ${JSON.stringify(lbkResult)} [${requestId}]`,
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

          // 仍然嘗試回覆用戶 - 使用完整的result對象，包含quickReply
          WH_replyMessage(event.replyToken, result, result.quickReply);
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
    } else if (event.type === 'postback') {
      const postbackData = event.postback.data;
      console.log(`WH v2.5.0: 收到postback事件，純粹轉發: ${postbackData}`);

      // v2.5.0: 所有postback事件都轉發給LBK處理（包含科目歸類選擇）
      const postbackInputData = {
        userId: userId,
        messageText: postbackData,
        replyToken: event.replyToken,
        timestamp: event.timestamp,
        processId: generateProcessId(),
        eventType: 'postback', // 標記為postback事件
        postbackData: postbackData
      };

      // v2.5.1: 階段二 - 確保postback事件也正確處理quickReply
      const postbackResult = await WH_callLBKSafely(postbackInputData);

      // 如果有回應結果，確保正確傳遞quickReply
      if (postbackResult && event.replyToken) {
        await WH_replyMessage(event.replyToken, postbackResult, postbackResult.quickReply);
      }
    } else {
      // 處理非消息事件 (follow, unfollow, join 等)
      console.log(`收到非消息事件: ${event.type} [${requestId}]`);
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

            // 帳號建立成功，不回覆歡迎訊息
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

            // 不發送歡迎訊息
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

          // 不發送歡迎訊息
        }
      } else if (event.type === "unfollow") {
        // 處理用戶取消關注事件 - 無法回覆
        console.log(`用戶 ${userId} 取消關注 [${requestId}]`);
      } else if (event.type === "join") {
        // 處理加入群組事件，不回覆歡迎訊息
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
 * 15. 處理Quick Reply事件
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:30:00
 * @description 統一處理 Quick Reply 按鈕點擊事件，路由到對應的SR模組處理
 */
async function WH_handleQuickReplyEvent(event) {
  const processId = uuidv4().substring(0, 8);

  try {
    WH_logInfo(`處理Quick Reply事件 [${processId}]`, "Quick Reply", event.source.userId, "WH_handleQuickReplyEvent");

    if (!event.postback || !event.postback.data) {
      throw new Error('無效的Quick Reply事件');
    }

    const userId = event.source.userId;
    const postbackData = event.postback.data;

    // 路由到SR模組處理
    const srResult = await WH_routeToSRModule(userId, postbackData, event);

    if (srResult && srResult.success) {
      // 回覆處理結果
      await WH_replyMessage(event.replyToken, srResult.message, srResult.quickReply);

      WH_logInfo(`Quick Reply處理成功 [${processId}]`, "Quick Reply", userId, "WH_handleQuickReplyEvent");
      return srResult;
    } else {
      throw new Error(srResult?.error || 'SR模組處理失敗');
    }

  } catch (error) {
    WH_logError(`Quick Reply處理失敗: ${error.message} [${processId}]`, "Quick Reply", event.source?.userId || "", "QUICKREPLY_ERROR", error.toString(), "WH_handleQuickReplyEvent");

    // 發送錯誤回覆
    await WH_replyMessage(event.replyToken, '處理失敗，請稍後再試');

    return {
      success: false,
      error: error.message,
      processId
    };
  }
}

/**
 * 16. 路由到SR模組
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:30:00
 * @description 將Quick Reply事件路由到SR模組處理
 */
async function WH_routeToSRModule(userId, postbackData, event) {
  const functionName = "WH_routeToSRModule";
  try {
    WH_logInfo(`路由到SR模組: ${postbackData}`, "模組路由", userId, "WH_routeToSRModule");

    if (!SR || typeof SR.SR_handleQuickReplyInteraction !== 'function') {
      throw new Error('SR模組不可用');
    }

    // 調用SR模組處理Quick Reply
    const result = await SR.SR_handleQuickReplyInteraction(userId, postbackData, event);

    return result;

  } catch (error) {
    WH_logError(`路由到SR模組失敗: ${error.message}`, "模組路由", userId, "SR_ROUTE_ERROR", error.toString(), "WH_routeToSRModule");
    return {
      success: false,
      error: error.message
    };
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

// 處理文字訊息的函數
async function WH_processTextMessage(event) {
  try {
    // 確保訊息是文字類型
    if (event.message.type !== 'text') {
      console.log('收到的不是文字訊息');
      return {
        success: false,
        message: '收到的不是文字訊息',
        event
      };
    }

    // 提取訊息文字
    const messageText = event.message.text;

    // 記錄收到的文字訊息
    console.log(`收到文字訊息: ${messageText}`);

    // 準備 LBK 處理所需的數據
    const lbkInputData = {
      userId: event.source.userId,
      messageText: messageText,
      replyToken: event.replyToken,
      timestamp: event.timestamp,
      processId: uuidv4().substring(0, 8)
    };

    // 調用 LBK 處理，完全跳過 DD 模組
    const result = await LBK.LBK_processQuickBookkeeping(lbkInputData);

    // 驗證結果
    if (!result || !result.message) {
      console.log(`LBK 模組處理失敗`);
      return {
        success: false,
        message: 'LBK 模組處理失敗',
        event
      };
    }

    // 訊息格式化和回覆
    const replyResult = await WH_replyMessage(event.replyToken, [result]);

    // 記錄回覆結果
    console.log(`訊息回覆結果: ${JSON.stringify(replyResult)}`);
    return replyResult;

  } catch (error) {
    console.error(`處理文字訊息時發生錯誤: ${error}`);
    return {
      success: false,
      message: `處理文字訊息時發生錯誤: ${error}`,
      event
    };
  }
}

// 生成 processId 的函數
function generateProcessId() {
  return uuidv4().substring(0, 8);
}

// ⚠️ 所有Express路由和服務器啟動邏輯已移除
// WH模組v2.2.0現在專注於業務邏輯處理，由index.js統一管理服務器

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

  // Wallet處理函數 (階段三新增)
  WH_isWalletConfirmationPostback,
  WH_handleWalletConfirmationPostback,

  // 階段三新增：Pending Record處理函數
  WH_handlePendingRecordPostback,
  WH_identifyPostbackType,

  // 新增依賴注入函數
  setDependencies,

  // 環境變數檢查函數
  WH_checkEnvironmentVariables,

  // 配置導出
  WH_CONFIG,
  WH_QUICK_REPLY_CONFIG,
};

/**
 * 09. 接收DD模組處理後需WH執行的具體操作
 * @version 2025-07-09-V2.0.16
 * @date 2025-07-09 10:48:00
 * @update: 遷移至Firestore
 * @param {Object} data - 需處理的數據
 * @param {string} action - 需處理的數據
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
          return {
            success: false,
            error: error
          };
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

        return {
          success: false,
          error: errorMsg
        };
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

    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 14. 處理 Quick Reply 事件
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:30:00
 * @description 統一處理 Quick Reply 按鈕點擊事件，路由到對應的SR模組處理
 */
async function WH_handleQuickReplyEvent(userId, postbackData, messageContext, event) {
  const functionName = "WH_handleQuickReplyEvent";
  try {
    WH_logInfo(`處理Quick Reply事件: ${postbackData}`, "Quick Reply處理", userId, "", "", functionName);

    // 檢查SR模組是否可用
    if (!SR || typeof SR.SR_handleQuickReplyInteraction !== 'function') {
      throw new Error('SR模組不可用或函數不存在');
    }

    // 路由到SR模組處理
    const srResponse = await SR.SR_handleQuickReplyInteraction(userId, postbackData, messageContext);

    if (srResponse.success) {
      // 建立回覆訊息
      let replyMessage = {
        type: 'text',
        text: srResponse.message
      };

      // 添加 Quick Reply 按鈕（如果有）
      if (srResponse.quickReply && srResponse.quickReply.items) {
        replyMessage.quickReply = {
          items: srResponse.quickReply.items.map(item => ({
            type: 'action',
            action: {
              type: 'postback',
              label: item.label,
              data: item.postbackData
            }
          }))
        };
      }

      // 發送回覆
      await WH_replyMessage(event.replyToken, [replyMessage]);

      WH_logInfo(`Quick Reply處理成功: ${postbackData}`, "Quick Reply處理", userId, "", "", functionName);
      return {
        success: true,
        processed: true,
        responseType: srResponse.quickReply ? 'with_quick_reply' : 'text_only'
      };
    } else {
      throw new Error(srResponse.error || 'SR模組處理失敗');
    }

  } catch (error) {
    WH_logError(`Quick Reply事件處理失敗: ${error.message}`, "Quick Reply處理", userId, "WH_QUICKREPLY_ERROR", error.toString(), functionName);

    // 發送錯誤回覆
    const errorMessage = {
      type: 'text',
      text: '抱歉，系統暫時無法處理您的請求，請稍後再試'
    };

    try {
      await WH_replyMessage(event.replyToken, [errorMessage]);
    } catch (replyError) {
      WH_logError(`錯誤回覆發送失敗: ${replyError.message}`, "Quick Reply處理", userId, "WH_REPLY_ERROR", replyError.toString(), functionName);
    }

    return {
      success: false,
      error: error.message,
      processed: true
    };
  }
}

/**
 * 15. 路由到SR模組處理
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:30:00
 * @description 統一路由機制，將特定事件轉發給SR模組處理
 */
async function WH_routeToSRModule(userId, actionType, actionData, context) {
  const functionName = "WH_routeToSRModule";
  try {
    WH_logInfo(`路由到SR模組: ${actionType}`, "SR路由", userId, "", "", functionName);

    if (!SR) {
      throw new Error('SR模組不可用');
    }

    let result = null;

    switch (actionType) {
      case 'QUICK_REPLY_STATISTICS':
        if (typeof SR.SR_processQuickReplyStatistics === 'function') {
          result = await SR.SR_processQuickReplyStatistics(userId, actionData.postbackData);
        }
        break;

      case 'PREMIUM_FEATURE_ACCESS':
        if (typeof SR.SR_validatePremiumFeature === 'function') {
          result = await SR.SR_validatePremiumFeature(userId, actionData.featureName);
        }
        break;

      case 'PAYWALL_INTERACTION':
        if (typeof SR.SR_handlePaywallQuickReply === 'function') {
          result = await SR.SR_handlePaywallQuickReply(userId, actionData.actionType, context);
        }
        break;

      default:
        throw new Error(`未知的路由類型: ${actionType}`);
    }

    if (result) {
      WH_logInfo(`SR模組路由成功: ${actionType}`, "SR路由", userId, "", "", functionName);
      return {
        success: true,
        data: result,
        actionType
      };
    } else {
      throw new Error('SR模組返回空結果');
    }

  } catch (error) {
    WH_logError(`SR模組路由失敗: ${error.message}`, "SR路由", userId, "WH_SR_ROUTE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      actionType
    };
  }
}

/**
 * 16. 處理用戶文本消息並調用LBK進行快速記帳 - 修正異步處理和函數聲明
 */
async function WH_processTextMessageWithLBK(userId, messageText, replyToken, event) {
  const functionName = "WH_processTextMessageWithLBK";
  try {
    WH_logInfo(`處理文字訊息: ${messageText}`, "文字訊息處理", userId, "", "", functionName);

    // 準備 LBK 處理所需的數據
    const lbkInputData = {
      userId: userId,
      messageText: messageText,
      replyToken: replyToken,
      timestamp: event.timestamp,
      processId: generateProcessId()
    };

    // 調用 LBK 處理，完全跳過 DD 模組
    const result = await LBK.LBK_processQuickBookkeeping(lbkInputData);

    if (!result) {
      WH_logError(`LBK 模組處理失敗，返回空結果`, "文字訊息處理", userId, "LBK_ERROR", "", functionName);
      return {
        success: false,
        message: 'LBK 模組處理失敗',
        event
      };
    }

    // 訊息格式化和回覆
    const replyResult = await WH_replyMessage(replyToken, [result]);
    WH_logInfo(`訊息回覆結果: ${JSON.stringify(replyResult)}`, "文字訊息處理", userId, "", "", functionName);

    return replyResult;

  } catch (error) {
    WH_logError(`處理文字訊息時發生錯誤: ${error.message}`, "文字訊息處理", userId, "WH_TEXT_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: `處理文字訊息時發生錯誤: ${error}`,
      event
    };
  }
}

/**
 * 17. 處理LINE的Postback事件
 */
async function WH_handlePostbackEvent(userId, postbackData, event) {
  const functionName = "WH_handlePostbackEvent";
  try {
    WH_logInfo(`處理 postback 事件: ${postbackData}`, "Postback處理", userId, "", "", functionName);

    // 在這裡添加您的 postback 事件處理邏輯
    // 示例：
    if (postbackData === 'SHOW_HELP') {
      const helpMessage = WH_buildHelpMessage();
      await WH_replyMessage(event.replyToken, [helpMessage]);
    } else {
      WH_logWarning(`未知的 postback 數據: ${postbackData}`, "Postback處理", userId, "UNKNOWN_POSTBACK", "", functionName);
      await WH_replyMessage(event.replyToken, [{
        type: 'text',
        text: '抱歉，無法識別此操作。'
      }]);
    }

  } catch (error) {
    WH_logError(`處理 postback 事件時發生錯誤: ${error.message}`, "Postback處理", userId, "WH_POSTBACK_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: `處理 postback 事件時發生錯誤: ${error}`,
      event
    };
  }
}

/**
 * 18. 構建使用說明訊息
 */
function WH_buildHelpMessage() {
  return {
    type: 'text',
    text:
      "【LCAS記帳助手使用說明】\n" +
      "1. 直接輸入訊息即可快速記帳，例如：'午餐-100'\n" +
      "2. 支援自定義科目，例如：'交通-50'\n" +
      "3. 輸入 '幫助' 或 '?' 獲取使用說明\n" +
      "4. 輸入 '本日統計'、'本週統計'、'本月統計' 查詢統計資訊"
  };
}

/**
 * 19. 處理主要的 Webhook 事件
 */
async function WH_handleWebhook(event, reqId) {
  const functionName = "WH_handleWebhook";
  const eventType = event.type;
  const userId = event.source.userId;
  let messageText = '';

  try {
    WH_logInfo(`開始處理事件: ${eventType}`, "事件處理", userId, "", "", functionName);

    // 檢查是否為用戶的文字輸入、postback 事件或 Quick Reply
    if (eventType === 'message' && event.message && event.message.type === 'text') {
      messageText = event.message.text;
      WH_logInfo(`用戶發送文字訊息: ${messageText}`, "處理訊息", userId, "", "", functionName);

      // 先調用AM模組進行用戶驗證和帳本初始化
      const userValidation = await AM.AM_validateAccountExists(userId, "LINE");

      if (!userValidation.exists) {
        // 用戶不存在，自動建立帳號
        const createResult = await AM.AM_createLineAccount(userId, null, 'J');
        if (!createResult.success) {
          await WH_replyMessage(event.replyToken, [{
            type: 'text',
            text: '系統初始化失敗，請稍後再試'
          }]);
          return;
        }
      }

      // 確保用戶帳本完整初始化
      const ledgerResult = await AM.AM_getUserDefaultLedger(userId);
      if (!ledgerResult.success) {
        await WH_replyMessage(event.replyToken, [{
          type: 'text',
          text: '帳本初始化失敗，請稍後再試'
        }]);
        return;
      }

      // AM驗證完成後，調用LBK處理記帳
      await WH_processTextMessageWithLBK(userId, messageText, event.replyToken, event);

    } else if (eventType === 'postback') {
      const postbackData = event.postback.data;
      console.log(`WH v2.5.0: 收到postback事件，純粹轉發: ${postbackData}`);

      // v2.5.0: 所有postback事件都轉發給LBK處理（包含科目歸類選擇）
      const postbackInputData = {
        userId: userId,
        messageText: postbackData,
        replyToken: event.replyToken,
        timestamp: event.timestamp,
        processId: generateProcessId(),
        eventType: 'postback', // 標記為postback事件
        postbackData: postbackData
      };

      // v2.5.1: 階段二 - 確保postback事件也正確處理quickReply
      const postbackResult = await WH_callLBKSafely(postbackInputData);

      // 如果有回應結果，確保正確傳遞quickReply
      if (postbackResult && event.replyToken) {
        await WH_replyMessage(event.replyToken, postbackResult, postbackResult.quickReply);
      }

    } else if (eventType === 'follow') {
      // 處理加入好友事件
      WH_logInfo(`收到 follow 事件`, "事件處理", userId, "", "", functionName);
      // 不發送歡迎訊息

    } else {
      WH_logWarning(`收到未處理的事件類型: ${eventType}`, "事件處理", userId, "UNHANDLED_EVENT", "", functionName);
      await WH_replyMessage(event.replyToken, [{
        type: 'text',
        text: `抱歉，目前無法處理此類型的事件：${eventType}`
      }]);
    }

  } catch (error) {
    WH_logError(`處理 Webhook 事件時發生錯誤: ${error.message}`, "事件處理", userId, "WEBHOOK_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: `處理 Webhook 事件時發生錯誤: ${error}`,
      event
    };
  }
}

// Wallet確認postback處理已移至LBK模組統一管理

/**
 * 21. 檢查是否為Quick Reply相關的postback
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:30:00
 * @description 判斷postback資料是否屬於Quick Reply系統
 */
function WH_isQuickReplyPostback(postbackData) {
  const quickReplyKeywords = [
    ...WH_QUICK_REPLY_CONFIG.STATISTICS_KEYWORDS,
    ...WH_QUICK_REPLY_CONFIG.PREMIUM_KEYWORDS,
    ...WH_QUICK_REPLY_CONFIG.REMINDER_KEYWORDS
  ];

  return quickReplyKeywords.some(keyword => postbackData.includes(keyword));
}

/**
 * 21. 發送推播訊息（支援SR模組推播服務）
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:30:00
 * @description 統一的推播訊息發送介面，支援SR模組的自動推播功能
 */
async function WH_sendPushMessage(userId, message, messageType = 'text') {
  const functionName = "WH_sendPushMessage";
  try {
    WH_logInfo(`發送推播訊息給用戶: ${userId}`, "推播服務", userId, "", "", functionName);

    // 構建推播訊息
    let pushMessage = null;

    if (typeof message === 'string') {
      pushMessage = {
        type: 'text',
        text: message
      };
    } else if (typeof message === 'object') {
      pushMessage = message;
    } else {
      throw new Error('不支援的訊息格式');
    }

    // 確保 lineClient 已經初始化
    if (!lineClient) {
      throw new Error('lineClient 未初始化');
    }

    // 發送推播
    await lineClient.pushMessage(userId, pushMessage);

    WH_logInfo(`推播訊息發送成功: ${userId}`, "推播服務", userId, "", "", functionName);

    // 記錄推播活動（透過SR模組）
    if (SR && typeof SR.SR_logScheduledActivity === 'function') {
      await SR.SR_logScheduledActivity('push_message_sent', {
        userId,
        messageType,
        messageLength: typeof message === 'string' ? message.length : JSON.stringify(message).length
      }, userId);
    }

    return {
      success: true,
      messageId: `push_${Date.now()}`,
      userId
    };

  } catch (error) {
    WH_logError(`推播訊息發送失敗: ${error.message}`, "推播服務", userId, "WH_PUSH_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      userId
    };
  }
}

// 階段三新增函數：科目歸類 Postback 識別
/**
 * 識別科目歸類 postback 事件
 * @param {string} postbackData - postback 事件的 data 欄位
 * @returns {boolean} - 如果是科目歸類 postback，則返回 true
 */
function WH_isSubjectClassificationPostback(postbackData) {
  // 修復識別規則：postbackData 格式為 "classify_XXX_..."，其中 XXX 是科目 ID
  return postbackData && postbackData.startsWith("classify_");
}

// 階段三新增函數：wallet確認 Postback 識別
/**
 * 識別wallet確認 postback 事件
 * @param {string} postbackData - postback 事件的 data 欄位
 * @returns {boolean} - 如果是wallet確認 postback，則返回 true
 */
function WH_isWalletConfirmationPostback(postbackData) {
  return postbackData && (postbackData.startsWith("confirm_wallet_") || postbackData.startsWith("cancel_wallet_"));
}

// 階段三新增函數：解析科目歸類 postback 數據
/**
 * 解析科目歸類 postback 數據
 * @param {string} postbackData - postback 事件的 data 欄位
 * @returns {object} - 包含 success 狀態、原始科目、解析後的科目 ID 等資訊的物件
 */
function WH_parseClassificationPostback(postbackData) {
  try {
    // 修復解析邏輯：postbackData 格式為 "classify_XXX_JSON"
    if (!postbackData.startsWith("classify_")) {
      throw new Error("Postback data 格式不正確，不是科目歸類事件");
    }

    // 解析格式：classify_104_{"subject":"飯糰","amount":28,...}
    const parts = postbackData.split("_");
    if (parts.length >= 3 && parts[0] === "classify") {
      const subjectId = parts[1]; // 科目 ID
      const jsonPart = parts.slice(2).join("_"); // 重新組合 JSON 部分

      let pendingData = null;
      try {
        pendingData = JSON.parse(jsonPart);
      } catch (jsonError) {
        console.log(`JSON 解析失敗，使用基本資料: ${jsonError.message}`);
        // 如果 JSON 解析失敗，仍然返回基本的科目 ID
      }

      return {
        success: true,
        originalSubject: pendingData ? pendingData.subject : "未知科目",
        subjectId: subjectId,
        pendingData: pendingData
      };
    } else {
      throw new Error("Postback data 格式不正確，無法解析科目 ID");
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 階段三新增函數：解析wallet確認 postback 數據
/**
 * 解析wallet確認 postback 數據
 * @param {string} postbackData - postback 事件的 data 欄位
 * @returns {object} - 包含 success 狀態、action、wallet資訊等的物件
 */
function WH_parseWalletConfirmationPostback(postbackData) {
  try {
    let action, jsonPart;

    if (postbackData.startsWith("confirm_wallet_")) {
      action = "confirm";
      jsonPart = postbackData.substring("confirm_wallet_".length);
    } else if (postbackData.startsWith("cancel_wallet_")) {
      action = "cancel";
      jsonPart = postbackData.substring("cancel_wallet_".length);
    } else {
      throw new Error("Postback data 格式不正確，不是wallet確認事件");
    }

    let walletData = null;
    try {
      walletData = JSON.parse(jsonPart);
    } catch (jsonError) {
      console.log(`Wallet postback JSON 解析失敗: ${jsonError.message}`);
      throw new Error("無法解析wallet確認資料");
    }

    return {
      success: true,
      action: action,
      walletName: walletData.walletName,
      originalData: walletData.originalData,
      userId: walletData.userId,
      originalInput: walletData.originalInput
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 階段三新增：處理wallet確認postback事件
 * @version 2025-12-17-V2.5.2
 * @description 處理用戶對新wallet的確認回應，支援Quick Reply按鈕互動
 * @param {string} postbackData - postback事件的data欄位
 * @param {string} userId - 用戶ID
 * @param {string} replyToken - LINE回覆Token
 * @param {string} requestId - 請求ID
 * @returns {Promise<Object>} 處理結果
 */
async function WH_handleWalletConfirmationPostback(postbackData, userId, replyToken, requestId) {
  const functionName = "WH_handleWalletConfirmationPostback";

  try {
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.5.2: 開始處理wallet確認postback: ${postbackData} [${requestId}]`,
      "Wallet確認",
      userId,
      "",
      "WH",
      "",
      0,
      functionName,
      "INFO",
    ]);

    // 解析postback資料
    const walletConfirmation = WH_parseWalletConfirmationPostback(postbackData);
    if (!walletConfirmation.success) {
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.5.2: wallet postback解析失敗: ${walletConfirmation.error} [${requestId}]`,
        "Wallet確認",
        userId,
        "PARSE_ERROR",
        "WH",
        walletConfirmation.error,
        0,
        functionName,
        "ERROR",
      ]);

      return {
        success: false,
        message: "處理wallet確認時發生錯誤",
        responseMessage: "處理wallet確認時發生錯誤",
        moduleCode: "WH",
        module: "WH"
      };
    }

    const { action, walletName, originalData, originalInput } = walletConfirmation;

    if (action === "confirm") {
      // 用戶選擇「確認新增」wallet
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.5.2: 用戶確認新增wallet: ${walletName} [${requestId}]`,
        "Wallet確認",
        userId,
        "",
        "WH",
        "",
        0,
        functionName,
        "INFO",
      ]);

      try {
        // 調用WCM模組新增wallet到wallets子集合
        const WCM = require('./1350. WCM.js');
        const ledgerId = `user_${userId}`;

        const walletData = {
          name: walletName,
          type: WH_determineWalletType(walletName),
          currency: 'TWD',
          balance: 0,
          userId: userId,
          description: `用戶自訂錢包：${walletName}`
        };

        const createWalletResult = await WCM.WCM_createWallet(ledgerId, walletData);

        if (createWalletResult.success) {
          // wallet創建成功，繼續執行原始記帳
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.5.2: wallet創建成功，繼續執行記帳 [${requestId}]`,
            "Wallet確認",
            userId,
            "",
            "WH",
            "",
            0,
            functionName,
            "INFO",
          ]);

          // 使用LBK執行記帳，更新支付方式為新創建的wallet
          if (originalData) {
            originalData.paymentMethod = walletName;
            originalData.walletId = createWalletResult.data.walletId;
          }

          const lbkInputData = {
            userId: userId,
            messageText: originalInput,
            replyToken: replyToken,
            timestamp: Date.now(),
            processId: requestId,
            eventType: 'wallet_confirmed_bookkeeping',
            confirmedWalletData: originalData
          };

          const bookkeepingResult = await WH_callLBKSafely(lbkInputData);

          if (bookkeepingResult && bookkeepingResult.success) {
            const successMessage = `✅ 已新增支付方式「${walletName}」並完成記帳！\n\n${bookkeepingResult.responseMessage || bookkeepingResult.message}`;

            return {
              success: true,
              message: successMessage,
              responseMessage: successMessage,
              moduleCode: "WH",
              module: "WH",
              walletCreated: true,
              bookkeepingCompleted: true
            };
          } else {
            const partialSuccessMessage = `✅ 已新增支付方式「${walletName}」\n❌ 但記帳失敗：${bookkeepingResult?.error || '未知錯誤'}\n\n請重新輸入記帳資訊`;

            return {
              success: true,
              message: partialSuccessMessage,
              responseMessage: partialSuccessMessage,
              moduleCode: "WH",
              module: "WH",
              walletCreated: true,
              bookkeepingCompleted: false
            };
          }
        } else {
          // wallet創建失敗
          const errorMessage = `❌ 新增支付方式失敗：${createResult.message}\n\n請重新嘗試或使用現有的支付方式`;
          WH_directLogWrite([
            WH_formatDateTime(new Date()),
            `WH 2.5.2: wallet創建失敗: ${createResult.message} [${requestId}]`,
            "Wallet確認",
            userId,
            "WALLET_CREATE_FAILED",
            "WH",
            createResult.message,
            0,
            functionName,
            "ERROR",
          ]);

          return {
            success: false,
            message: errorMessage,
            responseMessage: errorMessage,
            moduleCode: "WH",
            module: "WH",
            walletCreated: false,
          };
        }
      } catch (error) {
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.5.2: wallet創建過程發生錯誤: ${error.toString()} [${requestId}]`,
          "Wallet確認",
          userId,
          "WALLET_CREATE_ERROR",
          "WH",
          error.toString(),
          0,
          functionName,
          "ERROR",
        ]);

        const errorMessage = `❌ 新增支付方式時發生系統錯誤\n\n請稍後再試或使用現有的支付方式`;

        return {
          success: false,
          message: errorMessage,
          responseMessage: errorMessage,
          moduleCode: "WH",
          module: "WH",
          walletCreated: false,
        };
      }
    } else if (action === "cancel") {
      // 用戶選擇「取消記帳」
      WH_directLogWrite([
        WH_formatDateTime(new Date()),
        `WH 2.5.2: 用戶取消wallet新增和記帳 [${requestId}]`,
        "Wallet確認",
        userId,
        "",
        "WH",
        "",
        0,
        functionName,
        "INFO",
      ]);

      // 清理pending資料
      const pendingDataKey = `WH_PENDING_${userId}`;
      cache.del(pendingDataKey);

      // 格式化失敗訊息，符合LBK模組的標準格式
      const currentDateTime = new Date().toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });

      const cancelMessage = `記帳失敗！\n金額：未知\n支付方式：${walletName}\n時間：${currentDateTime}\n科目：未知科目\n備註：\n錯誤原因：非指定支付方式，請使用系統認可的支付方式`;

      return {
        success: false,
        message: cancelMessage,
        responseMessage: cancelMessage,
        moduleCode: "WH",
        module: "WH",
        userCancelled: true,
        errorType: "USER_CANCELLED_NON_STANDARD_WALLET"
      };
    }

  } catch (error) {
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.5.2: wallet確認postback處理失敗: ${error.toString()} [${requestId}]`,
      "Wallet確認",
      userId,
      "WALLET_POSTBACK_ERROR",
      "WH",
      error.toString(),
      0,
      functionName,
      "ERROR",
    ]);

    return {
      success: false,
      message: "處理wallet確認時發生錯誤",
      responseMessage: "處理wallet確認時發生錯誤",
      moduleCode: "WH",
      module: "WH"
    };
  }
}

/**
 * 階段三輔助函數：根據wallet名稱判斷wallet類型
 * @param {string} walletName - wallet名稱
 * @returns {string} wallet類型
 */
function WH_determineWalletType(walletName) {
  const nameKey = walletName.toLowerCase();

  if (nameKey.includes('現金') || nameKey.includes('cash')) {
    return 'cash';
  } else if (nameKey.includes('信用卡') || nameKey.includes('credit') || nameKey.includes('刷卡')) {
    return 'credit_card';
  } else if (nameKey.includes('銀行') || nameKey.includes('bank') || nameKey.includes('轉帳')) {
    return 'bank';
  } else if (nameKey.includes('行動支付') || nameKey.includes('mobile') || nameKey.includes('支付')) {
    return 'mobile_payment';
  } else {
    return 'other';
  }
}

/**
 * 階段三新增：處理Pending Record相關的postback事件
 * @version 2025-12-19-V2.5.3
 * @description 識別和處理科目歧義、支付方式歧義等Pending Record相關的postback事件
 * @param {string} postbackData - postback事件的data欄位
 * @param {string} userId - 用戶ID
 * @param {string} replyToken - LINE回覆Token
 * @param {string} requestId - 請求ID
 * @returns {Promise<Object>} 處理結果，包含handled標記和result
 */
async function WH_handlePendingRecordPostback(postbackData, userId, replyToken, requestId) {
  const functionName = "WH_handlePendingRecordPostback";

  try {
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.5.3: 開始識別Pending Record postback: ${postbackData} [${requestId}]`,
      "Pending Record",
      userId,
      "",
      "WH",
      "",
      0,
      functionName,
      "INFO",
    ]);

    // 階段三核心邏輯：識別不同類型的Pending Record postback
    let postbackType = WH_identifyPostbackType(postbackData);
    let handled = false;
    let result = null;

    switch (postbackType) {
      case 'SUBJECT_CLASSIFICATION':
        // 科目歧義消除的postback (格式: classify_XXX_...)
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.5.3: 識別為科目歧義消除postback [${requestId}]`,
          "科目歧義",
          userId,
          "",
          "WH",
          "",
          0,
          functionName,
          "INFO",
        ]);

        const classificationInputData = {
          userId: userId,
          messageText: postbackData,
          replyToken: replyToken,
          timestamp: Date.now(),
          processId: requestId,
          eventType: 'classification_postback',
          postbackData: postbackData
        };

        result = await WH_callLBKSafely(classificationInputData);
        handled = true;
        break;

      case 'WALLET_CONFIRMATION':
        // 支付方式確認的postback (格式: wallet_type_XXX_... 或 confirm_wallet_... 等)
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.5.3: 識別為支付方式確認postback [${requestId}]`,
          "支付方式確認",
          userId,
          "",
          "WH",
          "",
          0,
          functionName,
          "INFO",
        ]);

        const walletInputData = {
          userId: userId,
          messageText: postbackData,
          replyToken: replyToken,
          timestamp: Date.now(),
          processId: requestId,
          eventType: 'wallet_confirmation_postback',
          postbackData: postbackData
        };

        result = await WH_callLBKSafely(walletInputData);
        handled = true;
        break;

      case 'STATISTICS_REQUEST':
        // 統計查詢的postback (格式: 本日統計, 本週統計, 本月統計)
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.5.3: 識別為統計查詢postback [${requestId}]`,
          "統計查詢",
          userId,
          "",
          "WH",
          "",
          0,
          functionName,
          "INFO",
        ]);

        const statisticsInputData = {
          userId: userId,
          messageText: postbackData,
          replyToken: replyToken,
          timestamp: Date.now(),
          processId: requestId,
          eventType: 'statistics_postback',
          postbackData: postbackData
        };

        result = await WH_callLBKSafely(statisticsInputData);
        handled = true;
        break;

      case 'UNKNOWN':
      default:
        // 非Pending Record相關的postback，交由原有邏輯處理
        WH_directLogWrite([
          WH_formatDateTime(new Date()),
          `WH 2.5.3: 未識別為Pending Record postback，交由原有邏輯: ${postbackData} [${requestId}]`,
          "Postback路由",
          userId,
          "",
          "WH",
          "",
          0,
          functionName,
          "INFO",
        ]);
        handled = false;
        break;
    }

    return {
      handled: handled,
      result: result,
      postbackType: postbackType
    };

  } catch (error) {
    WH_directLogWrite([
      WH_formatDateTime(new Date()),
      `WH 2.5.3: Pending Record postback處理失敗: ${error.toString()} [${requestId}]`,
      "Pending Record",
      userId,
      "PENDING_POSTBACK_ERROR",
      "WH",
      error.toString(),
      0,
      functionName,
      "ERROR",
    ]);

    return {
      handled: false,
      result: null,
      error: error.toString()
    };
  }
}

/**
 * 階段三輔助函數：識別postback類型
 * @version 2025-12-19-V2.5.3
 * @description 根據postback data格式識別事件類型
 * @param {string} postbackData - postback事件的data欄位
 * @returns {string} postback類型
 */
function WH_identifyPostbackType(postbackData) {
  try {
    if (!postbackData || typeof postbackData !== 'string') {
      return 'UNKNOWN';
    }

    // 科目歧義消除：classify_XXX_...格式
    if (postbackData.startsWith('classify_')) {
      return 'SUBJECT_CLASSIFICATION';
    }

    // 支付方式確認：多種格式
    if (postbackData.startsWith('wallet_type_') ||
      postbackData.startsWith('confirm_wallet_') ||
      postbackData.startsWith('cancel_wallet_') ||
      postbackData.startsWith('wallet_yes_') ||
      postbackData.startsWith('wallet_no_')) {
      return 'WALLET_CONFIRMATION';
    }

    // 統計查詢：特定關鍵字
    const statisticsKeywords = ['本日統計', '本週統計', '本月統計'];
    if (statisticsKeywords.includes(postbackData)) {
      return 'STATISTICS_REQUEST';
    }

    return 'UNKNOWN';

  } catch (error) {
    console.log(`識別postback類型失敗: ${error.toString()}`);
    return 'UNKNOWN';
  }
}

// ✅ 健康檢查API已移除 - 由index.js統一提供