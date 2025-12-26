/**
 * LBK_快速記帳模組_1.3.1
 * @module LBK模組
 * @description LINE OA 專用快速記帳處理模組 - 階段三：修復統計路由邏輯，完善SR模組調用和降級機制
 * @update 2025-12-26: 階段三版本，修復LBK_handleStatisticsRequest函數中的SR模組調用邏輯，增加動態載入、錯誤處理和降級統計功能，確保統計請求能正確處理。
 */

// 引入所需模組
const moment = require('moment-timezone');
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs'); // Added for file system operations
const path = require('path'); // Added for path operations
const cache = require("node-cache"); // Added for caching

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

// 確保 Firebase Admin 在模組載入時就初始化
if (!admin.apps.length) {
  try {
    firebaseConfig.initializeFirebaseAdmin();
    console.log('🔥 LBK模組: Firebase Admin 動態配置初始化完成');
  } catch (error) {
    console.error('❌ LBK模組: Firebase Admin 動態配置初始化失敗:', error);
  }
}

/**
 * 初始化Firestore連線
 * @version 2025-12-19-V1.6.0
 */
async function LBK_initializeFirestore() {
  try {
    if (LBK_INIT_STATUS.firestore_db) {
      return LBK_INIT_STATUS.firestore_db;
    }

    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK 未初始化');
    }

    LBK_INIT_STATUS.firestore_db = admin.firestore();
    LBK_logInfo('Firestore連線初始化成功', '資料庫', '', 'LBK_initializeFirestore');

    return LBK_INIT_STATUS.firestore_db;
  } catch (error) {
    LBK_logError(`Firestore連線初始化失敗: ${error.toString()}`, '資料庫', '', 'FIRESTORE_INIT_ERROR', error.toString(), 'LBK_initializeFirestore');
    throw error;
  }
}

// 引入依賴模組
const DL = require('./1310. DL.js');

// 引入SR模組 (保留用於其他非統計功能，如推播服務等)
let SR = null;
try {
  SR = require('./1305. SR.js');
} catch (error) {
  console.warn('LBK模組: SR模組載入失敗，部分進階功能將受限:', error.message);
}

// 配置參數 - 階段三：記憶體管理和批次處理優化
const LBK_CONFIG = {
  DEBUG: process.env.LBK_DEBUG === 'true' || process.env.NODE_ENV !== 'production',
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? "ERROR" : "DEBUG",
  FIRESTORE_ENABLED: 'true',
  TIMEZONE: "Asia/Taipei",
  TEXT_PROCESSING: {
    ENABLE_SMART_PARSING: true,
    MIN_AMOUNT_DIGITS: 3,
    MAX_REMARK_LENGTH: 20
  },

  // 階段二保留：智能日誌控制
  SMART_LOGGING: {
    SUCCESS_LOGGING: process.env.NODE_ENV !== 'production',
    PARSING_DETAILS: process.env.NODE_ENV !== 'production',
    MEMORY_CACHE: [],
    MAX_CACHE_SIZE: 100 // 階段三：增加記憶體快取大小
  },

  // 階段三新增：記憶體Session管理
  MEMORY_SESSIONS: new Map(), // 記憶體Session快取
  MEMORY_SESSION_EXPIRY: 30 * 60 * 1000, // 30分鐘過期
  MEMORY_CLEANUP_TIMER: null, // 清理定時器

  // 階段三新增：批次寫入配置
  AUXILIARY_WRITE_QUEUE: [], // 輔助資料寫入佇列
  AUXILIARY_TIMER: null, // 批次寫入定時器
  BATCH_WRITE_THRESHOLD: 10, // 批次寫入閾值
  BATCH_WRITE_INTERVAL: 5 * 60 * 1000, // 5分鐘批次間隔

  // 階段三新增：原子性操作配置
  ATOMIC_OPERATIONS: true, // 啟用原子性操作
  SKIP_INTERMEDIATE_STATES: true, // 跳過中間狀態
  ONLY_FINAL_STATES: ['memory_active', 'completed'], // 只記錄最終狀態

  // cache 配置
  CACHE_CONFIG: {
    stdTTL: 600,
    checkPeriod: 120
  }
};

// 初始化快取實例
const cacheInstance = new cache(LBK_CONFIG.CACHE_CONFIG);

// 日誌輔助函數
function LBK_logInfo(message, category, userId, functionName) {
  if (typeof DL !== 'undefined' && DL && typeof DL.DL_info === 'function') {
    DL.DL_info(message, category, userId, 'INFO', '', 0, functionName, 'LBK');
  } else {
    console.log(`[INFO] [LBK] ${message}`);
  }
}

function LBK_logDebug(message, category, userId, functionName) {
  // 階段二：智能調試日誌
  if (LBK_CONFIG.DEBUG) {
    if (process.env.NODE_ENV === 'production') {
      // 正式環境：僅存入記憶體快取
      LBK_CONFIG.SMART_LOGGING.MEMORY_CACHE.push({
        timestamp: new Date().toISOString(),
        message: message,
        category: category,
        userId: userId,
        functionName: functionName
      });

      // 限制快取大小
      if (LBK_CONFIG.SMART_LOGGING.MEMORY_CACHE.length > LBK_CONFIG.SMART_LOGGING.MAX_CACHE_SIZE) {
        LBK_CONFIG.SMART_LOGGING.MEMORY_CACHE.shift();
      }
    } else {
      // 開發環境：正常記錄
      if (typeof DL !== 'undefined' && DL && typeof DL.DL_debug === 'function') {
        DL.DL_debug(message, category, userId, 'DEBUG', '', 0, functionName, 'LBK');
      } else {
        console.log(`[DEBUG] [LBK] ${message}`);
      }
    }
  }
}

function LBK_logWarning(message, category, userId, functionName) {
  if (typeof DL !== 'undefined' && DL && typeof DL.DL_warning === 'function') {
    DL.DL_warning(message, category, userId, 'WARNING', '', 0, functionName, 'LBK');
  } else {
    console.warn(`[WARNING] [LBK] ${message}`);
  }
}

function LBK_logError(message, category, userId, errorType, errorDetails, functionName) {
  if (typeof DL !== 'undefined' && DL && typeof DL.DL_error === 'function') {
    DL.DL_error(message, category, userId, errorType, errorDetails, 0, functionName, 'LBK');
  } else {
    console.error(`[ERROR] [LBK] ${message}`);
  }
}

// 初始化狀態追蹤
let LBK_INIT_STATUS = {
  lastInitTime: 0,
  initialized: false,
  DL_initialized: false,
  firestore_db: null
};

// 定義 Pending Record 狀態機常量
const PENDING_STATES = {
  PENDING_CATEGORY: "PENDING_CATEGORY",
  PENDING_WALLET: "PENDING_WALLET",
  COMPLETED: "COMPLETED"
};


/**
 * 01. 處理快速記帳的主函數 - 新增智慧路由功能
 * @version 2025-07-22-V1.1.0
 * @date 2025-07-22 10:30:00
 * @description 接收WH模組請求，智慧判斷是記帳還是統計查詢，並路由到對應處理邏輯
 */
async function LBK_processQuickBookkeeping(inputData) {
  const processId = inputData.processId || crypto.randomUUID().substring(0, 8);
  const userId = inputData.userId; // 獲取 userId

  try {
    LBK_logInfo(`開始處理LINE OA請求 [${processId}]`, "智慧路由", userId || "", "LBK_processQuickBookkeeping");

    // v1.4.2 階段三：檢查是否為科目歸類postback事件
    if (inputData.eventType === 'classification_postback' && inputData.classificationData) {
      LBK_logInfo(`檢測到科目歸類postback事件 [${processId}]`, "科目歸類", userId, "LBK_processQuickBookkeeping");
      return await LBK_handleClassificationPostback(inputData, processId);
    }

    // v1.4.5 新增：檢查是否為 wallet confirmation postback 事件
    if (inputData.eventType === 'wallet_confirmation_postback') {
      LBK_logInfo(`檢測到wallet確認postback事件 [${processId}]`, "Wallet確認", userId, "LBK_processQuickBookkeeping");
      return await LBK_handleWalletConfirmationPostback(inputData.postbackData, userId, processId);
    }

    // v1.4.7 階段一新增：檢查是否為wallet類型選擇postback事件
    if (inputData.messageText && LBK_isWalletTypePostback(inputData.messageText)) {
      LBK_logInfo(`檢測到wallet類型選擇postback事件: ${inputData.messageText} [${processId}]`, "支付方式分類", userId, "LBK_processQuickBookkeeping");
      return await LBK_handleWalletConfirmationPostback(inputData.messageText, userId, processId);
    }

    // v1.4.5 新增：檢查是否為 wallet postback 格式的訊息文本
    if (inputData.messageText && (inputData.messageText.startsWith('wallet_yes_') || inputData.messageText.startsWith('wallet_no_'))) {
      LBK_logInfo(`檢測到wallet postback格式訊息 [${processId}]`, "Wallet確認", userId, "LBK_processQuickBookkeeping");
      return await LBK_handleWalletConfirmationPostback(inputData.messageText, userId, processId);
    }

    // v1.4.3 新增：檢查是否為 postback 事件且包含科目歸類資料
    if (inputData.eventType === 'postback' && inputData.messageText && inputData.messageText.startsWith('classify_')) {
      LBK_logInfo(`檢測到科目歸類postback格式訊息 [${processId}]`, "科目歸類", userId, "LBK_processQuickBookkeeping");

      // 階段一修復：改進 postback 解析邏輯
      const postbackParts = inputData.messageText.split('_');
      if (postbackParts.length >= 3) {
        const categoryId = postbackParts[1];
        const jsonPart = postbackParts.slice(2).join('_');

        try {
          const pendingData = JSON.parse(jsonPart);

          // 構建分類資料
          const classificationData = {
            success: true,
            categoryId: categoryId,
            pendingData: pendingData
          };

          // 階段一修復：直接調用完成記帳，避免重新觸發歧義消除
          LBK_logInfo(`科目選擇完成，開始執行記帳: categoryId=${categoryId} [${processId}]`, "科目歧義消除", userId, "LBK_processQuickBookkeeping");

          return await LBK_handleClassificationPostback({
            ...inputData,
            eventType: 'classification_postback',
            classificationData: classificationData
          }, processId);

        } catch (jsonError) {
          LBK_logError(`解析postback JSON失敗: ${jsonError.message} [${processId}]`, "科目歸類", userId, "JSON_PARSE_ERROR", jsonError.toString(), "LBK_processQuickBookkeeping");

          return {
            success: false,
            message: "科目選擇資料解析失敗，請重新選擇",
            responseMessage: "科目選擇資料解析失敗，請重新選擇",
            moduleCode: "LBK",
            module: "LBK",
            processingTime: 0,
            moduleVersion: "1.4.3",
            errorType: "JSON_PARSE_ERROR"
          };
        }
      }
    }

    // 第一步：檢查是否為統計查詢關鍵字
    const keywordCheckResult = await LBK_checkStatisticsKeyword(inputData.messageText, userId, processId);

    if (keywordCheckResult.isStatisticsRequest) {
      // 路由到SR模組處理統計查詢
      LBK_logInfo(`檢測到統計查詢關鍵字，路由至SR模組 [${processId}]`, "統計路由", userId || "", "LBK_processQuickBookkeeping");
      return await LBK_handleStatisticsRequest(keywordCheckResult.statisticsType, inputData, processId);
    }

    // 第二步：解析用戶訊息，檢查是否需要創建Pending Record
    const parseResult = await LBK_parseUserMessage(inputData.messageText, userId, processId);

    if (!parseResult.success) {
      // 檢查是否需要新科目歸類
      if (parseResult.requiresClassification) {
        LBK_logInfo(`觸發新科目歸類流程: ${parseResult.originalSubject} [${processId}]`, "新科目歸類", userId, "LBK_processQuickBookkeeping");

        // 階段四：檢查是否需要新科目歸類，創建 Pending Record
        if (parseResult.requiresClassification) {
          LBK_logInfo(`觸發新科目歧義消除流程: ${parseResult.originalSubject} [${processId}]`, "新科目歧義消除", userId, "LBK_processQuickBookkeeping");

          // 創建 Pending Record
          const pendingResult = await LBK_createPendingRecord(
            userId,
            inputData.messageText,
            parseResult.parsedData,
            PENDING_STATES.PENDING_CATEGORY, // 初始狀態
            processId
          );

          if (!pendingResult.success) {
            return LBK_formatErrorResponse("PENDING_RECORD_CREATION_FAILED", pendingResult.error);
          }

          // 修改科目歧義消除以支援 Pending Record
          return await LBK_handleNewSubjectClassification(
            parseResult.originalSubject,
            { ...parseResult.parsedData, pendingId: pendingResult.pendingId },
            inputData,
            processId
          );
        }
      }

      const errorMessage = parseResult.error || "解析失敗";
      // 使用LBK_formatReplyMessage統一格式化錯誤回覆
      const formattedErrorMessage = LBK_formatReplyMessage(null, "LBK", {
        originalInput: inputData.messageText,
        error: errorMessage,
        success: false
      });

      return {
        success: false,
        message: formattedErrorMessage,
        responseMessage: formattedErrorMessage,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: 0,
        moduleVersion: "1.4.0",
        errorType: parseResult.errorType || "PARSE_ERROR"
      };
    }

    // 階段二：統一錯誤處理的支付方式解析流程
    const walletResult = await LBK_parsePaymentMethod(inputData.messageText, userId, processId);

    if (walletResult.systemError) { // 檢查 systemError 屬性
      LBK_logError(`階段二：支付方式解析失敗: ${walletResult.error} [${processId}]`, "快速記帳", userId, "PAYMENT_METHOD_SYSTEM_ERROR", walletResult.error, "LBK_processQuickBookkeeping");
      // 階段二：統一錯誤格式化
      const formattedErrorMessage = LBK_formatReplyMessage(null, "LBK", {
        originalInput: inputData.messageText,
        error: walletResult.error,
        success: false,
        partialData: parseResult.data
      });
      return {
        success: false,
        message: formattedErrorMessage,
        responseMessage: formattedErrorMessage,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: 0,
        moduleVersion: "2.1.0", // 更新至階段二版本
        errorType: "PAYMENT_METHOD_SYSTEM_ERROR"
      };
    }

    // 階段二：檢查是否需要創建Pending Record（處理錢包歧義）
    if (!walletResult.walletId && walletResult.requiresWalletConfirmation) {
      LBK_logInfo(`檢測到需要Wallet確認流程: ${walletResult.walletName} [${processId}]`, "Pending Record", userId, "LBK_processQuickBookkeeping");
      // 創建Pending Record，處理錢包歧義
      const pendingRecordResult = await LBK_createPendingRecord(
        userId,
        inputData.messageText,
        parseResult.data, // 包含科目解析結果
        PENDING_STATES.PENDING_WALLET, // 初始狀態為 PENDING_WALLET
        processId
      );

      if (!pendingRecordResult.success) {
        return LBK_formatErrorResponse("PENDING_RECORD_CREATION_FAILED", pendingRecordResult.error);
      }

      // 返回需要用戶選擇的訊息
      return await LBK_handleNewWallet(
        walletResult.walletName,
        { ...parseResult.data, pendingId: pendingRecordResult.pendingId }, // 傳遞 pendingId
        { userId: userId, messageText: inputData.messageText }, // 傳遞原始訊息和用戶ID
        processId
      );
    }

    // 階段二：如果wallet已確定，直接驗證
    // 這裡需要使用 walletResult.walletId 和 walletResult.walletName
    const finalWalletValidationResult = await LBK_validateWalletExists(userId, walletResult.walletId, walletResult.walletName, processId);

    if (!finalWalletValidationResult.success) {
      // 檢查是否需要觸發歧義消除
      if (finalWalletValidationResult.requiresUserConfirmation) {
        LBK_logInfo(`階段二：觸發Wallet歧義消除流程: ${walletResult.walletName} [${processId}]`, "Pending Record", userId, "LBK_processQuickBookkeeping");
        // 創建Pending Record，處理錢包歧義
        const pendingRecordResult = await LBK_createPendingRecord(
          userId,
          inputData.messageText,
          parseResult.data,
          PENDING_STATES.PENDING_WALLET, // 初始狀態為 PENDING_WALLET
          processId
        );

        if (!pendingRecordResult.success) {
          // 階段二：Pending Record創建失敗也統一格式化
          const formattedErrorMessage = LBK_formatReplyMessage(null, "LBK", {
            originalInput: inputData.messageText,
            error: `Pending Record創建失敗: ${pendingRecordResult.error}`,
            success: false,
            partialData: parseResult.data
          });
          return {
            success: false,
            message: formattedErrorMessage,
            responseMessage: formattedErrorMessage,
            moduleCode: "LBK",
            module: "LBK",
            processingTime: 0,
            moduleVersion: "2.1.0",
            errorType: "PENDING_RECORD_CREATION_FAILED"
          };
        }

        // 返回需要用戶選擇的訊息
        return await LBK_handleNewWallet(
          walletResult.walletName,
          { ...parseResult.data, pendingId: pendingRecordResult.pendingId }, // 傳遞 pendingId
          { userId: userId, messageText: inputData.messageText },
          processId
        );
      }

      // 階段二：統一錢包驗證錯誤格式化
      const errorMessage = finalWalletValidationResult.error || "wallet驗證失敗";
      const formattedErrorMessage = LBK_formatReplyMessage(null, "LBK", {
        originalInput: parseResult.data?.subject || inputData.messageText,
        error: `非指定支付方式，請使用系統認可的支付方式`,
        success: false,
        partialData: parseResult.data
      });

      return {
        success: false,
        message: formattedErrorMessage,
        responseMessage: formattedErrorMessage,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: 0,
        moduleVersion: "2.1.0", // 更新至階段二版本
        errorType: finalWalletValidationResult.errorType || "WALLET_VALIDATION_ERROR"
      };
    }

    // 使用驗證過的wallet資訊更新記帳資料
    parseResult.data.paymentMethod = finalWalletValidationResult.walletName;
    parseResult.data.walletId = finalWalletValidationResult.walletId;
    parseResult.data.ledgerId = `user_${userId}`; // Ensure ledgerId is set for bookkeeping

    // 執行記帳
    const bookkeepingResult = await LBK_executeBookkeeping(parseResult.data, processId);

    if (!bookkeepingResult.success) {
      const errorMessage = bookkeepingResult.error || "記帳失敗";
      // 使用LBK_formatReplyMessage統一格式化錯誤回覆
      const formattedErrorMessage = LBK_formatReplyMessage(null, "LBK", {
        originalInput: parseResult.data.subject,
        error: errorMessage,
        success: false,
        partialData: parseResult.data
      });

      return {
        success: false,
        message: formattedErrorMessage,
        responseMessage: formattedErrorMessage,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: 0,
        moduleVersion: "1.1.0",
        errorType: bookkeepingResult.errorType || "BOOKING_ERROR"
      };
    }

    // 階段三改進：移除主記帳流程中的synonyms更新，這部分邏輯已移至wallet確認時執行
    // 階段二：成功記錄簡化
      if (LBK_CONFIG.SMART_LOGGING.SUCCESS_LOGGING) {
        console.log(`✅ 記帳成功: ${bookkeepingResult.data.transactionId}`);
        LBK_logInfo(`快速記帳完成 [${processId}]`, "快速記帳", userId || "", "LBK_processQuickBookkeeping");
      }

    // 格式化回覆訊息，傳遞原始輸入作為參考
    const replyMessage = LBK_formatReplyMessage(bookkeepingResult.data, "LBK", {
      originalInput: parseResult.data.subject
    });

    return {
      success: true,
      message: replyMessage,
      responseMessage: replyMessage,
      moduleCode: "LBK",
      module: "LBK",
      data: bookkeepingResult.data,
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.9.2", // Updated module version
      errorType: "SUCCESS" // Added success error type for clarity
    };

  } catch (error) {
    LBK_logError(`快速記帳處理失敗: ${error.toString()} [${processId}]`, "快速記帳", userId || "", "PROCESS_ERROR", error.toString(), "LBK_processQuickBookkeeping");

    // 使用LBK_formatReplyMessage統一格式化系統錯誤回覆
    const formattedErrorMessage = LBK_formatReplyMessage(null, "LBK", {
      originalInput: inputData.messageText,
      error: "系統錯誤，請稍後再試",
      success: false
    });

    return {
      success: false,
      message: formattedErrorMessage,
      responseMessage: formattedErrorMessage,
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.9.2", // Updated module version
      errorType: "SYSTEM_ERROR"
    };
  }
}

/**
 * 02. 解析用戶訊息
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 解析LINE OA用戶的文字訊息，提取記帳資訊
 */
async function LBK_parseUserMessage(messageText, userId, processId) {
  try {
    // 階段二：僅在解析過程啟用時記錄詳情
    if (LBK_CONFIG.SMART_LOGGING.PARSING_DETAILS) {
      LBK_logDebug(`用戶訊息解析: "${messageText}" [${processId}]`, "訊息解析", userId, "LBK_parseUserMessage");
    }

    if (!messageText || messageText.trim() === "") {
      // 失敗時必須記錄
      LBK_logError(`空訊息解析失敗 [${processId}]`, "訊息解析", userId, "EMPTY_MESSAGE", "", "LBK_parseUserMessage");
      return {
        success: false,
        error: "空訊息",
        errorType: "EMPTY_MESSAGE"
      };
    }

    // 使用輸入格式解析
    const parseResult = LBK_parseInputFormat(messageText.trim(), processId);

    if (!parseResult) {
      return {
        success: false,
        error: "無法識別記帳格式",
        errorType: "FORMAT_NOT_RECOGNIZED"
      };
    }

    // 提取金額
    const amountResult = LBK_extractAmount(parseResult.subject + parseResult.amount, processId);

    // 識別科目
    // 替換 LBK_identifySubject 調用為 LBK_getcategoryId
    const subjectResult = await LBK_getcategoryId(parseResult.subject, userId, processId);

    if (!subjectResult.success) { // 這裡應該是判斷 subjectResult 是否成功，而不是 LBK_getcategoryId
      // 檢查是否需要新科目歸類
      if (subjectResult.requiresClassification) {
        LBK_logInfo(`需要新科目歸類: ${parseResult.subject}`, "訊息解析", userId, "LBK_parseUserMessage");
        return {
          success: false,
          error: `找不到科目: ${parseResult.subject}`,
          errorType: "SUBJECT_NOT_FOUND",
          requiresClassification: true,
          originalSubject: subjectResult.originalSubject,
          parsedData: {
            subject: parseResult.subject,
            amount: parseResult.amount,
            rawAmount: parseResult.rawAmount,
            paymentMethod: parseResult.paymentMethod,
            userId: userId
          }
        };
      }

      LBK_logError(`科目識別失敗: ${parseResult.subject}`, "訊息解析", userId, "SUBJECT_NOT_FOUND", subjectResult.error || "科目不存在", "LBK_parseUserMessage");
      return {
        success: false,
        error: `找不到科目: ${parseResult.subject}`,
        errorType: "SUBJECT_NOT_FOUND"
      };
    }

    // 驗證科目資料完整性
    if (!subjectResult.categoryId || !subjectResult.categoryName) {
      LBK_logError(`科目資料不完整: ${JSON.stringify(subjectResult)}`, "訊息解析", userId, "SUBJECT_DATA_INCOMPLETE", "科目資料缺少必要欄位", "LBK_parseUserMessage");
      return {
        success: false,
        error: `科目資料不完整: ${parseResult.subject}`,
        errorType: "SUBJECT_DATA_INCOMPLETE"
      };
    }

    // 根據科目代碼判斷收支類型，並設定正確的支付方式
    const isIncome = String(subjectResult.categoryId).startsWith('2'); // categoryId is used instead of majorCode
    const finalPaymentMethod = parseResult.paymentMethod === "刷卡" ?
      subjectResult.defaultPaymentMethod : parseResult.paymentMethod;

    return {
      success: true,
      data: {
        subject: parseResult.subject,
        amount: parseResult.amount,
        rawAmount: parseResult.rawAmount,
        paymentMethod: finalPaymentMethod,
        categoryId: subjectResult.categoryId,
        categoryName: subjectResult.categoryName,
        action: isIncome ? "收入" : "支出",
        userId: userId
      }
    };

  } catch (error) {
    LBK_logError(`用戶訊息解析失敗: ${error.toString()} [${processId}]`, "訊息解析", userId, "PARSE_ERROR", error.toString(), "LBK_parseUserMessage");

    return {
      success: false,
      error: "解析失敗",
      errorType: "PARSE_ERROR"
    };
  }
}

/**
 * 03. 解析輸入格式 - 階段三簡化版
 * @version 2025-12-24-V1.8.0
 * @date 2025-12-24 14:00:00
 * @description 階段三：簡化支付方式處理邏輯 - 未輸入=信用卡，有輸入=查詢wallets synonyms
 */
function LBK_parseInputFormat(message, processId) {
  LBK_logDebug(`階段三：開始簡化格式解析: "${message}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");

  if (!message || message.trim() === "") {
    return null;
  }

  message = message.trim();

  // 檢測系統內部 postback 格式，直接返回 null
  if (message.startsWith('classify_')) {
    LBK_logDebug(`檢測到系統內部postback格式，跳過解析: "${message}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
    return null;
  }

  try {
    // 基本格式匹配：科目名稱 + 數字金額 + 可選的支付方式
    const basicPattern = /^(.+?)(\d+)(.*)$/;
    const match = message.match(basicPattern);

    if (!match) {
      LBK_logWarning(`無法匹配輸入格式: "${message}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
      return null;
    }

    const rawCategory = match[1].trim();
    const rawAmount = match[2];
    const suffixPart = match[3].trim();

    // 驗證金額格式
    if (rawAmount.length > 1 && rawAmount.startsWith('0')) {
      LBK_logWarning(`金額格式錯誤：前導零不被允許 "${rawAmount}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
      return null;
    }

    const amount = parseInt(rawAmount, 10);
    if (amount <= 0) {
      LBK_logWarning(`金額錯誤：金額必須大於0 [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
      return null;
    }

    // 階段三：簡化支付方式識別邏輯
    let paymentMethod = null;
    let finalSubject = rawCategory;
    let processedSuffix = suffixPart;

    // 移除幣別單位
    const supportedUnits = /(元|塊)$/i;
    const unsupportedUnits = /(NT|USD|\$)$/i;

    if (unsupportedUnits.test(processedSuffix)) {
      LBK_logWarning(`不支援的幣別單位 "${processedSuffix}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
      return null;
    }

    processedSuffix = processedSuffix.replace(supportedUnits, '').trim();

    // 階段三：簡化邏輯 - 如果有後綴文字，就當作支付方式處理
    if (processedSuffix && processedSuffix.length > 0) {
      paymentMethod = processedSuffix;
      LBK_logDebug(`階段三：提取支付方式: "${paymentMethod}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
    }

    // 階段三：移除所有硬編碼檢查，保持paymentMethod為用戶實際輸入或null
    LBK_logInfo(`階段三：簡化解析結果: 科目="${finalSubject}", 金額=${amount}, 支付方式="${paymentMethod || '未指定'}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");

    return {
      subject: finalSubject,
      amount: amount,
      rawAmount: rawAmount,
      paymentMethod: paymentMethod // null將觸發預設值查詢，有值將查詢synonyms
    };

  } catch (error) {
    LBK_logError(`格式解析錯誤: ${error.toString()} [${processId}]`, "格式解析", "", "PARSE_ERROR", error.toString(), "LBK_parseInputFormat");
    return null;
  }
}

/**
 * 04. 從文字中提取金額
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 從用戶輸入中提取並驗證金額
 */
function LBK_extractAmount(text, processId) {
  LBK_logDebug(`提取金額: "${text}" [${processId}]`, "金額提取", "", "LBK_extractAmount");

  if (!text || text.length === 0) {
    return { amount: 0, currency: "NTD", success: false };
  }

  try {
    // 提取數字
    const numbersMatches = text.match(/\d+/g);
    if (!numbersMatches || numbersMatches.length === 0) {
      return { amount: 0, currency: "NTD", success: false };
    }

    // 找到最長的數字
    let bestMatch = "";
    let bestMatchLength = 0;

    for (const match of numbersMatches) {
      if (match.length > bestMatchLength) {
        bestMatchLength = match.length;
        bestMatch = match;
      }
    }

    if (bestMatchLength < LBK_CONFIG.TEXT_PROCESSING.MIN_AMOUNT_DIGITS) {
      return { amount: 0, currency: "NTD", success: false };
    }

    const amount = parseInt(bestMatch, 10);

    if (amount <= 0) {
      return { amount: 0, currency: "NTD", success: false };
    }

    return { amount: amount, currency: "NTD", success: true };

  } catch (error) {
    LBK_logError(`提取金額錯誤: ${error.toString()} [${processId}]`, "金額提取", "", "EXTRACT_ERROR", error.toString(), "LBK_extractAmount");
    return { amount: 0, currency: "NTD", success: false };
  }
}

/**
 * 05. 獲取科目代碼 - 優化匹配精準度
 * @version 2025-12-22-V1.0.2
 * @date 2025-12-22 17:30:00
 * @description 根據科目名稱查詢對應的科目代碼，強化匹配算法精準度，修復同義詞匹配日誌
 */
async function LBK_getcategoryId(categoryName, userId, processId) {
  try {
    LBK_logDebug(`查詢科目代碼: "${categoryName}" [${processId}]`, "科目查詢", userId, "LBK_getcategoryId");

    if (!categoryName || !userId) {
      throw new Error("科目名稱或用戶ID為空");
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    const ledgerId = `user_${userId}`;
    const normalizedInput = String(categoryName).trim().toLowerCase();

    // 記錄同義詞匹配過程
    LBK_logDebug(`開始同義詞匹配，輸入: "${normalizedInput}" [${processId}]`, "同義詞匹配", userId, "LBK_getcategoryId");

    const snapshot = await db.collection("ledgers").doc(ledgerId).collection("categories").where("isActive", "==", true).get();

    LBK_logDebug(`查詢categories集合結果: ${snapshot.size} 筆資料 [${processId}]`, "科目查詢", userId, "LBK_getcategoryId");

    if (snapshot.empty) {
      // 嘗試查詢所有categories文檔（不限制isActive）
      const allSnapshot = await db.collection("ledgers").doc(ledgerId).collection("categories").get();
      LBK_logDebug(`categories集合總數: ${allSnapshot.size} 筆資料 [${processId}]`, "科目查詢", userId, "LBK_getcategoryId");

      if (!allSnapshot.empty) {
        // 列出所有文檔的基本信息用於調試
        allSnapshot.forEach(doc => {
          const data = doc.data();
          LBK_logDebug(`文檔 ${doc.id}: categoryId=${data.categoryId}, categoryName=${data.categoryName}, name=${data.name}, isActive=${data.isActive}`, "科目查詢", userId, "LBK_getcategoryId");
        });
      }

      throw new Error("科目表為空或無啟用的科目");
    }

    // 強化的匹配算法 - 支援同義詞模糊匹配
    let exactMatch = null;
    let synonymMatch = null;
    let partialMatches = [];

    for (const doc of snapshot.docs) {
      if (doc.id === "template") continue;

      const data = doc.data();
      // 使用0070標準欄位名稱
      const subName = String(data.name || data.subCategoryName || data.categoryName || '').trim().toLowerCase();

      // 1. 精確匹配 - 最高優先級
      if (subName === normalizedInput) {
        exactMatch = {
          categoryId: String(data.categoryId || data.parentId),
          categoryName: String(data.categoryName || ''),
          subCategoryId: String(data.subCategoryId || data.categoryId),
          name: String(data.name || data.subCategoryName || data.categoryName || '')
        };
        break;
      }

      // 2. 同義詞精確匹配 - 第二優先級（不跳過，即使synonyms為空）
      const synonymsStr = data.synonyms || "";
      // 將同義詞字串分割為陣列，即使為空字串也進行處理
      const synonyms = synonymsStr ? synonymsStr.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];

      // 記錄同義詞處理過程，包含實際同義詞內容
      LBK_logDebug(`處理同義詞匹配: "${normalizedInput}"，科目: "${data.categoryName}"，同義詞數量: ${synonyms.length}，同義詞內容: [${synonyms.join(', ')}] [${processId}]`, "同義詞匹配", userId, "LBK_getcategoryId");

      for (const synonym of synonyms) {
        const synonymLower = synonym.toLowerCase();
        LBK_logDebug(`比較同義詞: "${synonymLower}" vs "${normalizedInput}" [${processId}]`, "同義詞匹配", userId, "LBK_getcategoryId");

        if (synonymLower === normalizedInput) {
          synonymMatch = {
            categoryId: String(data.categoryId || data.parentId),
            categoryName: String(data.categoryName || ''),
            subCategoryId: String(data.subCategoryId || data.categoryId),
            name: String(data.name || data.subCategoryName || data.categoryName || '')
          };
          LBK_logInfo(`找到精確同義詞匹配: "${normalizedInput}" → 同義詞:"${synonym}" → 科目:"${synonymMatch.name}" [${processId}]`, "同義詞匹配", userId, "LBK_getcategoryId");
          break;
        }

        // 新增：同義詞包含匹配（例如：飯糰 可以匹配到 御飯糰）
        if (synonymLower.includes(normalizedInput) && normalizedInput.length >= 2) {
          if (!synonymMatch) { // 只在沒有精確匹配時使用
            synonymMatch = {
              categoryId: String(data.parentId || data.categoryId),
              categoryName: String(data.categoryName || ''),
              subCategoryId: String(data.categoryId || ''),
              name: String(data.subCategoryName || data.categoryName || '')
            };
            LBK_logDebug(`找到同義詞包含匹配: "${normalizedInput}" → "${synonymLower}" → "${synonymMatch.name}" [${processId}]`, "同義詞匹配", userId, "LBK_getcategoryId");
          }
        }

        // 新增：反向包含匹配（例如：停車費 可以匹配到 停車）
        if (normalizedInput.includes(synonymLower) && synonymLower.length >= 2) {
          if (!synonymMatch) { // 只在沒有精確匹配時使用
            synonymMatch = {
              categoryId: String(data.parentId || data.categoryId),
              categoryName: String(data.categoryName || ''),
              subCategoryId: String(data.categoryId || ''),
              name: String(data.subCategoryName || data.categoryName || '')
            };
            LBK_logDebug(`找到反向包含匹配: "${normalizedInput}" → "${synonymLower}" → "${synonymMatch.name}" [${processId}]`, "同義詞匹配", userId, "LBK_getcategoryId");
          }
        }
      }

      // 3. 部分匹配 - 包含關係
      if (subName.includes(normalizedInput) || normalizedInput.includes(subName)) {
        partialMatches.push({
          categoryId: String(data.categoryId || data.parentId),
          categoryName: String(data.categoryName || ''),
          subCategoryId: String(data.subCategoryId || data.categoryId),
          name: String(data.name || data.subCategoryName || data.categoryName || ''),
          score: subName.length === normalizedInput.length ? 1.0 : 0.8
        });
      }
    }

    // 按優先級返回結果
    if (exactMatch) {
      return {
        success: true,
        categoryId: exactMatch.categoryId,
        categoryName: exactMatch.categoryName
      };
    }
    if (synonymMatch) {
      return {
        success: true,
        categoryId: synonymMatch.categoryId,
        categoryName: synonymMatch.categoryName
      };
    }
    if (partialMatches.length > 0) {
      // 返回評分最高的部分匹配
      partialMatches.sort((a, b) => b.score - a.score);
      const bestMatch = partialMatches[0];
      return {
        success: true,
        categoryId: bestMatch.categoryId,
        categoryName: bestMatch.categoryName
      };
    }

    // 觸發科目歧義消除流程
    return {
      success: false,
      requiresClassification: true,
      originalSubject: categoryName,
      error: `找不到科目: ${categoryName}`
    };

  } catch (error) {
    LBK_logError(`查詢科目代碼失敗: ${error.toString()} [${processId}]`, "科目查詢", userId, "SUBJECT_ERROR", error.toString(), "LBK_getcategoryId");

    // 如果是查詢錯誤，也觸發科目歧義消除流程
    return {
      success: false,
      requiresClassification: true,
      originalSubject: categoryName,
      error: error.toString()
    };
  }
}

/**
 * 06. 模糊匹配科目 - 優化匹配算法
 * @version 2025-07-15-V1.0.1
 * @date 2025-07-15 19:10:00
 * @description 當精確匹配失敗時，使用優化的模糊匹配尋找最相似的科目
 */
async function LBK_fuzzyMatch(input, userId, processId) {
  if (!input || !userId) return null;

  try {
    LBK_logDebug(`模糊匹配: "${input}" [${processId}]`, "模糊匹配", userId, "LBK_fuzzyMatch");

    const inputLower = input.toLowerCase().trim();
    const allSubjects = await LBK_getAllSubjects(userId);

    if (!allSubjects || !allSubjects.length) {
      return null;
    }

    const matches = [];

    allSubjects.forEach((subject) => {
      const subNameLower = subject.name.toLowerCase(); // Use 'name' for subject name

      // 1. 精確匹配（最高分）
      if (subNameLower === inputLower) {
        matches.push({
          ...subject,
          score: 1.0,
          matchType: "exact_match"
        });
        return;
      }

      // 2. 包含匹配
      if (subNameLower.includes(inputLower)) {
        const score = (inputLower.length / subNameLower.length) * 0.95;
        matches.push({
          ...subject,
          score: Math.min(0.95, score),
          matchType: "subject_contains_input"
        });
      }

      if (inputLower.includes(subNameLower) && subNameLower.length >= 2) {
        const score = (subNameLower.length / inputLower.length) * 0.9;
        matches.push({
          ...subject,
          score: Math.min(0.9, score),
          matchType: "input_contains_subject"
        });
      }

      // 3. 強化同義詞匹配（支援部分匹配，不跳過空同義詞）
      const synonymsStr = subject.synonyms || "";
      const synonymsList = synonymsStr ? synonymsStr.split(",").map(syn => syn.trim().toLowerCase()).filter(syn => syn.length > 0) : [];

      // 記錄同義詞處理過程，即使為空也記錄
      if (synonymsList.length === 0) {
        LBK_logDebug(`模糊匹配：科目 "${subject.name}" 無同義詞，跳過同義詞匹配但保持流程完整 [${processId}]`, "模糊匹配", userId, "LBK_fuzzyMatch");
      }

      for (const synonym of synonymsList) {
        if (synonym === inputLower) {
          matches.push({
            ...subject,
            score: 0.98,
            matchType: "synonym_exact_match"
          });
        } else if (synonym.includes(inputLower) && inputLower.length >= 2) {
          // 提高包含匹配的分數，例如：飯糰 → 御飯糰
          const score = Math.min(0.9, (inputLower.length / synonym.length) * 0.9);
          matches.push({
            ...subject,
            score: score,
            matchType: "synonym_contains_input"
          });
        } else if (inputLower.includes(synonym) && synonym.length >= 2) {
          // 反向包含匹配，例如：停車費 → 停車，給予較高分數
          const score = Math.min(0.95, (synonym.length / inputLower.length) * 0.95);
          matches.push({
            ...subject,
            score: score,
            matchType: "input_contains_synonym"
          });
        }
        // 新增：模糊相似度匹配（例如：飯糰 vs 飯团）
        else {
          const similarity = LBK_calculateStringSimilarity(inputLower, synonym);
          if (similarity > 0.7) {
            matches.push({
              ...subject,
              score: similarity * 0.75,
              matchType: "synonym_fuzzy_match"
            });
          }
        }
      }

      // 4. 字符相似度匹配
      const similarity = LBK_calculateStringSimilarity(inputLower, subNameLower);
      if (similarity > 0.6) {
        matches.push({
          ...subject,
          score: similarity * 0.75,
          matchType: "string_similarity"
        });
      }
    });

    if (matches.length > 0) {
      // 去重並按分數排序
      const uniqueMatches = [];
      const seen = new Set();

      matches.forEach(match => {
        const key = `${match.categoryId}-${match.subCategoryId}`; // Use categoryId and subCategoryId for uniqueness
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMatches.push(match);
        } else {
          // 如果已存在，保留分數更高的
          const existingIndex = uniqueMatches.findIndex(m => `${m.categoryId}-${m.subCategoryId}` === key);
          if (existingIndex >= 0 && match.score > uniqueMatches[existingIndex].score) {
            uniqueMatches[existingIndex] = match;
          }
        }
      });

      uniqueMatches.sort((a, b) => b.score - a.score);
      const bestMatch = uniqueMatches[0];
      // threshold is removed as it's not used in the original code logic.
      // if (bestMatch.score >= threshold) {
      return bestMatch;
      // }
    }

    return null;

  } catch (error) {
    LBK_logError(`模糊匹配失敗: ${error.toString()} [${processId}]`, "模糊匹配", userId, "FUZZY_ERROR", error.toString(), "LBK_fuzzyMatch");
    return null;
  }
}

/**
 * 07. 獲取所有科目資料
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 從Firestore獲取用戶的完整科目清單
 */
async function LBK_getAllSubjects(userId, processId) {
  try {
    if (!userId) {
      throw new Error("缺少用戶ID");
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    const ledgerId = `user_${userId}`;
    const categoriesRef = db.collection("ledgers").doc(ledgerId).collection("categories");
    const snapshot = await categoriesRef.where("isActive", "==", true).get();

    if (snapshot.empty) {
      LBK_logWarning(`用戶 ${userId} 的categories集合為空`, "科目查詢", userId, "LBK_getAllSubjects");
      return [];
    }

    const subjects = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (doc.id === "template" || doc.id === "_init") return;

      subjects.push({
        categoryId: data.categoryId || data.parentId, // Use categoryId as majorCode
        categoryName: data.categoryName || '',
        subCategoryId: data.subCategoryId || data.categoryId,
        name: data.name || data.subCategoryName || data.categoryName || '', // Use name for subName
        synonyms: data.synonyms || ""
      });
    });

    return subjects;

  } catch (error) {
    LBK_logError(`獲取科目資料失敗: ${error.toString()}`, "科目查詢", userId, "SUBJECTS_ERROR", error.toString(), "LBK_getAllSubjects");
    throw error;
  }
}

/**
 * 08. 執行記帳操作 - 加入重retry機制
 * @version 2025-07-15-V1.0.1
 * @date 2025-07-15 19:10:00
 * @description 執行實際的記帳操作，包含資料驗證、儲存和重retry機制
 */
async function LBK_executeBookkeeping(bookkeepingData, processId) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      LBK_logDebug(`執行記帳操作 [${processId}] (嘗試 ${attempt}/${maxRetries})`, "記帳執行", bookkeepingData.userId, "LBK_executeBookkeeping");

      // 驗證資料
      const validationResult = LBK_validateBookkeepingData(bookkeepingData, processId);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error,
          errorType: "VALIDATION_ERROR"
        };
      }

      // 識別科目
      // 替換 LBK_identifySubject 調用為 LBK_getcategoryId
      const subjectResult = await LBK_getcategoryId(bookkeepingData.subject, bookkeepingData.userId, processId);

      if (!subjectResult.success) { // 這裡應該是判斷 subjectResult 是否成功，而不是 LBK_getcategoryId
        LBK_logError(`科目識別失敗: ${bookkeepingData.subject}`, "記帳執行", bookkeepingData.userId, "SUBJECT_NOT_FOUND", subjectResult.error || "科目不存在", "LBK_executeBookkeeping");
        return {
          success: false,
          error: `找不到科目: ${bookkeepingData.subject}`,
          errorType: "SUBJECT_NOT_FOUND"
        };
      }

      // 驗證科目資料完整性
      if (!subjectResult.categoryId || !subjectResult.categoryName) {
        LBK_logError(`科目資料不完整: ${JSON.stringify(subjectResult)}`, "記帳執行", bookkeepingData.userId, "SUBJECT_DATA_INCOMPLETE", "科目資料缺少必要欄位", "LBK_executeBookkeeping");
        return {
          success: false,
          error: `科目資料不完整: ${bookkeepingData.subject}`,
          errorType: "SUBJECT_DATA_INCOMPLETE"
        };
      }

      // 根據科目代碼判斷收支類型，並設定正確的支付方式
      const isIncome = String(subjectResult.categoryId).startsWith('2'); // Use categoryId
      const finalPaymentMethod = bookkeepingData.paymentMethod === "刷卡" ?
        subjectResult.defaultPaymentMethod : bookkeepingData.paymentMethod;

      // 更新記帳資料，加入科目資訊和正確的支付方式
      const updatedBookkeepingData = {
        ...bookkeepingData,
        categoryId: subjectResult.categoryId,
        categoryName: subjectResult.categoryName,
        action: isIncome ? "收入" : "支出",
        paymentMethod: finalPaymentMethod
      };

      // 生成記帳ID
      const bookkeepingId = await LBK_generateBookkeepingId(updatedBookkeepingData.userId, processId);

      // 準備記帳資料
      const preparedData = LBK_prepareBookkeepingData(bookkeepingId, updatedBookkeepingData, processId);

      // 儲存到Firestore（帶重retry）
      const saveResult = await LBK_saveToFirestore(preparedData, processId);

      if (!saveResult.success) {
        lastError = saveResult.error;

        if (attempt < maxRetries) {
          // 等待遞增延遲後重retry
          const delay = Math.pow(2, attempt - 1) * 1000; // 指數退避
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return {
          success: false,
          error: `儲存失敗 (${maxRetries}次重retry後): ${lastError}`,
          errorType: "STORAGE_ERROR"
        };
      }

      // 格式化返回的記帳資料，確保包含所有必要的欄位
      const processedData = {
        id: bookkeepingId,
        transactionId: bookkeepingId,
        amount: updatedBookkeepingData.amount,
        type: updatedBookkeepingData.action === "收入" ? "income" : "expense",
        category: updatedBookkeepingData.categoryId,
        subject: updatedBookkeepingData.categoryName,
        categoryName: updatedBookkeepingData.categoryName,
        description: updatedBookkeepingData.subject,
        paymentMethod: updatedBookkeepingData.paymentMethod,
        date: preparedData.date,
        timestamp: new Date().toISOString(),
        ledgerId: preparedData.ledgerId,
        remark: updatedBookkeepingData.subject || ""
      };

      return {
        success: true,
        data: processedData
      };

    } catch (error) {
      lastError = error.toString();

      if (attempt < maxRetries) {
        LBK_logWarning(`記帳操作嘗試 ${attempt} 失敗，準備重retry: ${error.toString()} [${processId}]`, "記帳執行", bookkeepingData.userId, "LBK_executeBookkeeping");

        // 等待後重retry
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      LBK_logError(`執行記帳操作失敗 (${maxRetries}次重retry後): ${error.toString()} [${processId}]`, "記帳執行", bookkeepingData.userId, "EXECUTE_ERROR", error.toString(), "LBK_executeBookkeeping");
    }
  }

  return {
    success: false,
    error: `記帳操作失敗 (${maxRetries}次重retry後): ${lastError}`,
    errorType: "EXECUTE_ERROR"
  };
}

/**
 * 09. 生成唯一記帳ID - 純毫秒時間戳格式
 * @version 2025-12-12-V1.3.3
 * @date 2025-12-12 12:00:00
 * @description 生成純毫秒時間戳的唯一記帳ID，與BK模組保持一致
 */
async function LBK_generateBookkeepingId(userId, processId) {
  try {
    // 使用純毫秒時間戳作為交易ID
    const timestamp = Date.now();
    const transactionId = timestamp.toString();

    // 檢查ID唯一性
    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    // 檢查是否已存在相同的ID
    const existingDoc = await db
      .collection('ledgers')
      .doc(`user_${userId}`)
      .collection('transactions')
      .where('id', '==', transactionId)
      .limit(1)
      .get();

    if (!existingDoc.empty) {
      // 如果ID重複，等待1毫秒後重新生成
      await new Promise(resolve => setTimeout(resolve, 1));
      const fallbackId = Date.now().toString();
      LBK_logWarning(`記帳ID重複，使用備用ID: ${fallbackId} [${processId}]`, "ID生成", userId, "LBK_generateBookkeepingId");
      return fallbackId;
    }

    LBK_logInfo(`記帳ID生成成功（純毫秒時間戳）: ${transactionId} [${processId}]`, "ID生成", userId, "LBK_generateBookkeepingId");
    return transactionId;

  } catch (error) {
    LBK_logError(`生成記帳ID失敗: ${error.toString()} [${processId}]`, "ID生成", userId, "ID_GEN_ERROR", error.toString(), "LBK_generateBookkeepingId");

    // 備用ID生成（使用純毫秒時間戳）
    const fallbackId = Date.now().toString();
    return fallbackId;
  }
}

/**
 * 10. 驗證記帳資料
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 驗證記帳資料的完整性和正確性
 */
function LBK_validateBookkeepingData(data, processId) {
  try {
    if (!data) {
      return { success: false, error: "記帳資料為空" };
    }

    const requiredFields = ['amount', 'subject', 'userId'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      return { success: false, error: `缺少必要欄位: ${missingFields.join(', ')}` };
    }

    if (data.amount <= 0) {
      return { success: false, error: "金額必須大於0" };
    }

    return { success: true };

  } catch (error) {
    LBK_logError(`驗證記帳資料失敗: ${error.toString()} [${processId}]`, "資料驗證", "", "VALIDATE_ERROR", error.toString(), "LBK_validateBookkeepingData");
    return { success: false, error: "資料驗證失敗" };
  }
}

/**
 * 11. 儲存記帳資料至Firestore - 完全對齊1301 BK模組標準
 * @version 2025-12-09-V1.2.0
 * @date 2025-12-09
 * @description 使用1301標準路徑和資料格式儲存至Firestore
 */
async function LBK_saveToFirestore(bookkeepingData, processId) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await LBK_initializeFirestore();
      const db = LBK_INIT_STATUS.firestore_db;

      // bookkeepingData現在是1301標準格式的物件
      const ledgerId = bookkeepingData.ledgerId;

      LBK_logInfo(`使用1301標準路徑儲存: ledgers/${ledgerId}/transactions [${processId}]`, "資料儲存", bookkeepingData.userId, "LBK_saveToFirestore");

      // 使用事務確保併發安全性
      const result = await db.runTransaction(async (transaction) => {
        // 檢查是否已存在相同的ID - 使用1301標準欄位
        const existingQuery = await db
          .collection('ledgers')
          .doc(ledgerId)
          .collection('transactions')
          .where('id', '==', bookkeepingData.id)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          throw new Error(`交易ID已存在: ${bookkeepingData.id}`);
        }

        // 使用1301標準路徑：ledgers/{ledgerId}/transactions
        const docRef = db
          .collection('ledgers')
          .doc(ledgerId)
          .collection('transactions')
          .doc(bookkeepingData.id);

        // 儲存1301標準格式資料
        transaction.set(docRef, {
          ...bookkeepingData,
          savedAt: admin.firestore.Timestamp.now(),
          attempt: attempt
        });

        return docRef;
      });

      return {
        success: true,
        docId: result.id,
        transactionData: bookkeepingData,
        attempt: attempt,
        path: `ledgers/${ledgerId}/transactions`
      };

    } catch (error) {
      lastError = error.toString();

      if (attempt < maxRetries) {
        LBK_logWarning(`Firestore儲存嘗試 ${attempt} 失敗，準備重retry: ${error.toString()} [${processId}]`, "資料儲存", bookkeepingData.userId, "LBK_saveToFirestore");

        // 指數退避延遲
        const delay = Math.pow(2, attempt - 1) * 500 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      LBK_logError(`儲存到Firestore失敗 (${maxRetries}次重retry後): ${error.toString()} [${processId}]`, "資料儲存", bookkeepingData.userId, "SAVE_ERROR", error.toString(), "LBK_saveToFirestore");
    }
  }

  return {
    success: false,
    error: `儲存失敗 (${maxRetries}次重retry後): ${lastError}`,
    totalAttempts: maxRetries
  };
}

/**
 * 12. 準備記帳資料 - 完全對齊1301 BK模組標準
 * @version 2025-12-09-V1.2.0
 * @date 2025-12-09
 * @description 將解析後的資料轉換為1301 BK標準的Firestore格式
 */
function LBK_prepareBookkeepingData(bookkeepingId, data, processId) {
  try {
    const now = moment().tz(LBK_CONFIG.TIMEZONE);
    const currentTimestamp = admin.firestore.Timestamp.now();

    // 階段四修復：使用0070規範標準欄位格式，移除違規欄位
    const preparedData = {
      // 核心欄位 - 符合0070規範
      id: bookkeepingId,
      amount: parseFloat(data.amount) || 0,
      type: data.action === "收入" ? "income" : "expense",
      description: data.subject || '',
      categoryId: data.categoryId || 'default',
      // 階段四修復：移除accountId欄位（不符合0070規範）

      // 時間欄位 - 0070標準格式
      date: now.format('YYYY-MM-DD'),
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,

      // 來源和用戶資訊 - 0070標準
      source: 'quick',
      userId: data.userId || '',
      paymentMethod: data.paymentMethod || '',

      // 記帳特定欄位 - 0070標準
      ledgerId: `user_${data.userId}`,

      // 狀態欄位 - 0070標準
      status: 'active',
      verified: false,

      // 元數據 - 0070標準
      metadata: {
        processId: processId,
        module: 'LBK',
        version: '1.9.0',
        categoryName: data.categoryName // Added categoryName to metadata
      }
    };

    return preparedData;

  } catch (error) {
    LBK_logError(`準備記帳資料失敗: ${error.toString()} [${processId}]`, "資料準備", "", "PREPARE_ERROR", error.toString(), "LBK_prepareBookkeepingData");
    throw error;
  }
}

/**
 * 13. 格式化回覆訊息
 * @version 2025-07-15-V1.0.6
 * @date 2025-07-15 16:45:00
 * @description 格式化成功或失敗的回覆訊息，統一所有錯誤格式為7行標準格式 - 修復語法錯誤
 */
function LBK_formatReplyMessage(resultData, moduleCode, options = {}) {
  try {
    const currentDateTime = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    // 檢查是否為成功的記帳結果 - 1301標準格式
    if (resultData && resultData.id) {
      // 從原始資料中提取用戶輸入的備註（去除金額後的部分）
      const originalInput = options.originalInput || resultData.description;
      const remark = LBK_removeAmountFromText(originalInput, resultData.amount, resultData.paymentMethod);

      // 確保科目名稱正確顯示
      const subjectDisplay = resultData.categoryName || resultData.subject || resultData.description || "未知科目";

      let replyText = `記帳成功！\n` +
             `金額：${resultData.amount}元 (${resultData.type === 'income' ? '收入' : '支出'})\n` +
             `支付方式：${resultData.paymentMethod}\n` +
             `時間：${currentDateTime}\n` +
             `科目：${subjectDisplay}\n` +
             `備註：${remark}\n` +
             `收支ID：${resultData.id}`;
      return replyText;
    } else {
      // 處理錯誤情況 - 統一使用7行詳細格式
      const errorMessage = options.error || "處理失敗";
      const originalInput = options.originalInput || "";

      // 嘗試從partialData提取資訊
      let amount = "未知";
      let paymentMethod = "未指定";
      let subject = "未知科目";

      if (options.partialData) {
        amount = options.partialData.amount || "未知";
        paymentMethod = options.partialData.paymentMethod || "未指定";
        subject = options.partialData.subject || "未知科目";
      } else {
        // 即使沒有partialData，也嘗試從originalInput中提取資訊
        if (originalInput) {
          // 嘗試提取金額
          const amountMatch = originalInput.match(/(\d+)/);
          if (amountMatch) {
            amount = amountMatch[1];
          }

          // 嘗試識別支付方式
          const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳"];
          for (const method of paymentMethods) {
            if (originalInput.includes(method)) {
              paymentMethod = method;
              break;
            }
          }

          // 嘗試提取科目（移除數字和支付方式後的文字）
          const subjectMatch = originalInput.replace(/\d+/g, '').replace(/(現金|刷卡|行動支付|轉帳|元|塊)/g, '').trim();
          if (subjectMatch) {
            subject = subjectMatch;
          }
        }
      }

      // 統一的6行錯誤格式（移除使用者類型）
      return `記帳失敗！\n` +
             `金額：${amount}元\n` +
             `支付方式：${paymentMethod}\n` +
             `時間：${currentDateTime}\n` +
             `科目：${subject}\n` +
             `備註：${originalInput}\n` +
             `錯誤原因：${errorMessage}`;
    }

  } catch (error) {
    // 即使格式化過程出錯，也要保持統一格式
    const currentDateTime = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    return `記帳失敗！\n` +
           `金額：未知元\n` +
           `支付方式：未指定\n` +
           `時間：${currentDateTime}\n` +
           `科目：未知科目\n` +
           `備註：${options.originalInput || ''}\n` +
           `錯誤原因：訊息格式化錯誤`;
  }
}

/**
 * 14. 移除文字中的金額和支付方式 - 階段二修復版
 * @version 2025-12-19-V1.6.0
 * @date 2025-12-19 16:45:00
 * @description 階段二修復：從文字中移除金額和支付方式，確保備註只保留科目部分
 */
function LBK_removeAmountFromText(text, amount, paymentMethod, processId) {
  if (!text || !amount) return text;

  try {
    LBK_logDebug(`階段二：開始處理備註文字: "${text}", 金額: ${amount}, 支付方式: "${paymentMethod}" [${processId}]`, "備註處理", "", "LBK_removeAmountFromText");

    const amountStr = String(amount);
    let result = text;

    // 階段二修復：先移除金額部分
    if (text.includes(" " + amountStr)) {
      result = text.replace(" " + amountStr, "").trim();
    } else if (text.endsWith(amountStr)) {
      result = text.substring(0, text.length - amountStr.length).trim();
    } else {
      // 階段二新增：處理金額直接連接在科目後面的情況
      const amountIndex = text.indexOf(amountStr);
      if (amountIndex > 0) {
        result = text.substring(0, amountIndex).trim();
      }
    }

    // 階段二修復：移除支付方式，增強識別邏輯
    if (paymentMethod && result.includes(paymentMethod)) {
      result = result.replace(paymentMethod, "").trim();
    }

    // 階段二新增：移除常見的銀行名稱，確保「一銀」等被移除
    const debitNames = [
      "台銀", "土銀", "合庫", "第一", "華南", "彰銀", "上海", "國泰", "中信", "玉山",
      "台新", "永豐", "兆豐", "日盛", "安泰", "中國信託", "聯邦", "遠東", "元大",
      "凱基", "台北富邦", "國票", "新光", "陽信", "三信", "聯邦商銀", "台企銀",
      "高雄銀", "花旗", "渣打", "匯豐", "星展", "澳盛", "一銀" // 階段二重點：確保「一銀」被移除
    ];

    for (const debitName of debitNames) {
      if (result.includes(debitName)) {
        result = result.replace(debitName, "").trim();
        LBK_logDebug(`階段二：移除銀行名稱: "${debitName}" [${processId}]`, "備註處理", "", "LBK_removeAmountFromText");
        break; // 只移除第一個匹配的銀行名稱
      }
    }

    // 階段二新增：移除常見支付方式關鍵字
    const paymentKeywords = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
    for (const keyword of paymentKeywords) {
      if (result.includes(keyword)) {
        result = result.replace(keyword, "").trim();
        LBK_logDebug(`階段二：移除支付方式關鍵字: "${keyword}" [${processId}]`, "備註處理", "", "LBK_removeAmountFromText");
      }
    }

    // 階段二保留：移除幣別單位
    const amountEndRegex = new RegExp(amountStr + "(元|塊)$", "i");
    const match = result.match(amountEndRegex);
    if (match && match.index > 0) {
      result = result.substring(0, match.index).trim();
    }

    // 階段二新增：清理多餘的空格和標點符號
    result = result.replace(/\s+/g, ' ').trim();

    LBK_logInfo(`階段二：備註處理完成: "${text}" → "${result}" [${processId}]`, "備註處理", "", "LBK_removeAmountFromText");

    return result || text;

  } catch (error) {
    LBK_logError(`階段二：移除金額和支付方式失敗: ${error.toString()} [${processId}]`, "文本處理", "", "TEXT_PROCESS_ERROR", error.toString(), "LBK_removeAmountFromText");
    return text;
  }
}

/**
 * 17. LBK模組初始化
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 初始化LBK模組，建立必要的連線和配置
 */
async function LBK_initialize() {
  try {
    console.log('🔧 LBK模組初始化開始...');

    // 初始化DL模組
    if (!LBK_INIT_STATUS.DL_initialized) {
      if (typeof DL.DL_initialize === 'function') {
        DL.DL_initialize();
        LBK_INIT_STATUS.DL_initialized = true;
        console.log('✅ DL模組初始化成功');
      }
    }

    // 初始化Firestore
    await LBK_initializeFirestore();

    LBK_INIT_STATUS.initialized = true;
    LBK_INIT_STATUS.lastInitTime = new Date().getTime();

    console.log('✅ LBK模組初始化完成');
    return true;

  } catch (error) {
    console.error('❌ LBK模組初始化失敗:', error);
    return false;
  }
}

/**
 * 18. 錯誤處理
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 統一的錯誤處理機制
 */
function LBK_handleError(error, context, userId, processId) {
  try {
    const errorMessage = `LBK模組錯誤 [${context}] [${processId}]: ${error.toString()}`;

    // 記錄到DL模組
    if (typeof DL.DL_error === 'function') {
      DL.DL_error(errorMessage, context, userId || "", "LBK_ERROR", error.toString(), 0, "LBK_handleError", "LBK_handleError");
    } else {
      console.error(errorMessage);
    }

    return {
      success: false,
      error: errorMessage,
      errorType: "LBK_ERROR",
      processId: processId,
      context: context
    };

  } catch (e) {
    console.error(`LBK錯誤處理失敗: ${e.toString()}`);
    return {
      success: false,
      error: "系統錯誤",
      errorType: "SYSTEM_ERROR"
    };
  }
}

/**
 * 21. 字符串相似度計算 - 新增輔助函數
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 19:10:00
 * @description 計算兩個字符串的相似度，用於提升模糊匹配精準度
 */
function LBK_calculateStringSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);

  // 計算編輯距離
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  const editDistance = matrix[len1][len2];
  return 1 - (editDistance / maxLen);
}

/**
 * 統計查詢相關函數 - v1.3.0新增
 */

/**
 * 檢查統計查詢關鍵字
 * @version 2025-12-19-V1.3.0
 * @param {string} messageText - 用戶輸入訊息
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 檢查結果
 */
async function LBK_checkStatisticsKeyword(messageText, userId, processId) {
  const functionName = "LBK_checkStatisticsKeyword";
  try {
    LBK_logDebug(`檢查統計查詢關鍵字: "${messageText}" [${processId}]`, "統計查詢", userId, functionName);

    if (!messageText || typeof messageText !== 'string') {
      return {
        isStatisticsRequest: false,
        statisticsType: null
      };
    }

    const normalizedText = messageText.trim().toLowerCase();

    // 統計查詢關鍵字
    const statisticsKeywords = [
      { keywords: ['統計', '報表', '分析'], type: 'general_statistics' },
      { keywords: ['月統計', '月報表'], type: 'monthly_statistics' }
    ];

    for (const keywordGroup of statisticsKeywords) {
      for (const keyword of keywordGroup.keywords) {
        if (normalizedText.includes(keyword)) {
          LBK_logInfo(`檢測到統計查詢關鍵字: "${keyword}" → ${keywordGroup.type} [${processId}]`, "統計查詢", userId, functionName);
          return {
            isStatisticsRequest: true,
            statisticsType: keywordGroup.type,
            matchedKeyword: keyword
          };
        }
      }
    }

    return {
      isStatisticsRequest: false,
      statisticsType: null
    };

  } catch (error) {
    LBK_logError(`檢查統計查詢關鍵字失敗: ${error.toString()} [${processId}]`, "統計查詢", userId, "CHECK_STATISTICS_KEYWORD_ERROR", error.toString(), functionName);
    return {
      isStatisticsRequest: false,
      statisticsType: null,
      error: error.toString()
    };
  }
}

/**
 * 處理統計查詢請求 - 階段三修復版
 * @version 2025-12-26-V1.3.1
 * @param {string} statisticsType - 統計類型
 * @param {object} inputData - 輸入資料
 * @param {string} processId - 處理ID
 * @returns {Object} 處理結果
 * @description 階段三修復：完善SR模組調用邏輯，增加動態載入和錯誤處理機制
 */
async function LBK_handleStatisticsRequest(statisticsType, inputData, processId) {
  const functionName = "LBK_handleStatisticsRequest";
  try {
    LBK_logInfo(`階段三：處理統計查詢請求: ${statisticsType} [${processId}]`, "統計查詢", inputData.userId, functionName);

    // 階段三修復：動態檢查並載入SR模組
    let srModuleAvailable = false;
    let srModule = null;

    // 嘗試動態載入SR模組（避免循環依賴）
    try {
      if (!SR) {
        LBK_logInfo(`階段三：嘗試動態載入SR模組 [${processId}]`, "統計查詢", inputData.userId, functionName);
        const dynamicSR = require('./1305. SR.js');
        if (dynamicSR && typeof dynamicSR.SR_processQuickStatistics === 'function') {
          srModule = dynamicSR;
          srModuleAvailable = true;
          LBK_logInfo(`階段三：SR模組動態載入成功 [${processId}]`, "統計查詢", inputData.userId, functionName);
        }
      } else if (typeof SR.SR_processQuickStatistics === 'function') {
        srModule = SR;
        srModuleAvailable = true;
        LBK_logInfo(`階段三：使用已載入的SR模組 [${processId}]`, "統計查詢", inputData.userId, functionName);
      }
    } catch (srLoadError) {
      LBK_logWarning(`階段三：SR模組載入失敗: ${srLoadError.message} [${processId}]`, "統計查詢", inputData.userId, functionName);
    }

    // 如果SR模組可用，委派處理
    if (srModuleAvailable && srModule) {
      try {
        LBK_logInfo(`階段三：委派統計查詢給SR模組處理 [${processId}]`, "統計查詢", inputData.userId, functionName);
        
        const srResult = await srModule.SR_processQuickStatistics({
          ...inputData,
          statisticsType: statisticsType,
          processId: processId
        });

        // 驗證SR模組回應格式
        if (srResult && typeof srResult === 'object') {
          LBK_logInfo(`階段三：SR模組處理完成，結果類型: ${srResult.success ? '成功' : '失敗'} [${processId}]`, "統計查詢", inputData.userId, functionName);
          return {
            ...srResult,
            moduleVersion: "1.3.1",
            routedFrom: "LBK",
            routedTo: "SR"
          };
        } else {
          throw new Error("SR模組返回格式異常");
        }

      } catch (srError) {
        LBK_logError(`階段三：SR模組處理失敗: ${srError.message} [${processId}]`, "統計查詢", inputData.userId, "SR_PROCESSING_ERROR", srError.toString(), functionName);
        // 繼續執行降級處理
      }
    }

    // 階段三降級機制：提供基礎統計功能
    LBK_logInfo(`階段三：執行降級統計處理 [${processId}]`, "統計查詢", inputData.userId, functionName);
    
    const fallbackResult = await LBK_provideFallbackStatistics(statisticsType, inputData, processId);
    
    return {
      success: true,
      message: fallbackResult.message,
      responseMessage: fallbackResult.message,
      quickReply: fallbackResult.quickReply,
      moduleCode: "LBK",
      module: "LBK",
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.3.1",
      statisticsHandled: true,
      fallbackMode: true,
      statisticsType: statisticsType
    };

  } catch (error) {
    LBK_logError(`階段三：處理統計查詢請求失敗: ${error.toString()} [${processId}]`, "統計查詢", inputData.userId, "HANDLE_STATISTICS_REQUEST_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: "統計查詢處理失敗，請稍後再試",
      responseMessage: "統計查詢處理失敗，請稍後再試",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.3.1",
      errorType: "HANDLE_STATISTICS_REQUEST_ERROR"
    };
  }
}

/**
 * 建立統計 Quick Reply
 * @version 2025-12-19-V1.3.0
 * @param {string} statisticsType - 統計類型
 * @param {string} processId - 處理ID
 * @returns {Object} Quick Reply配置
 */
function LBK_buildStatisticsQuickReply(statisticsType, processId) {
  const functionName = "LBK_buildStatisticsQuickReply";
  try {
    LBK_logDebug(`建立統計Quick Reply: ${statisticsType} [${processId}]`, "統計查詢", "", functionName);

    const quickReplyItems = [
      {
        type: 'action',
        action: {
          type: 'postback',
          label: '📊 本月統計',
          data: 'statistics_monthly',
          displayText: '本月統計'
        }
      }
    ];

    return {
      items: quickReplyItems
    };

  } catch (error) {
    LBK_logError(`建立統計Quick Reply失敗: ${error.toString()} [${processId}]`, "統計查詢", "", "BUILD_STATISTICS_QR_ERROR", error.toString(), functionName);
    return { items: [] };
  }
}

/**
 * 處理直接統計查詢
 * @version 2025-12-19-V1.3.0
 * @param {string} query - 查詢內容
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 處理結果
 */
async function LBK_processDirectStatistics(query, userId, processId) {
  const functionName = "LBK_processDirectStatistics";
  try {
    LBK_logInfo(`處理直接統計查詢: ${query} [${processId}]`, "統計查詢", userId, functionName);

    // 備用實現：返回提示訊息
    return {
      success: true,
      data: {
        query: query,
        result: "統計功能需要SR模組完整支援",
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    LBK_logError(`處理直接統計查詢失敗: ${error.toString()} [${processId}]`, "統計查詢", userId, "PROCESS_DIRECT_STATISTICS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 取得直接統計資料
 * @version 2025-12-19-V1.3.0
 * @param {string} statisticsType - 統計類型
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 統計資料
 */
async function LBK_getDirectStatistics(statisticsType, userId, processId) {
  const functionName = "LBK_getDirectStatistics";
  try {
    LBK_logInfo(`取得直接統計資料: ${statisticsType} [${processId}]`, "統計查詢", userId, functionName);

    // 備用實現：返回空資料結構
    return {
      success: true,
      data: {
        type: statisticsType,
        userId: userId,
        statistics: [],
        summary: {
          totalTransactions: 0,
          totalAmount: 0,
          period: "未指定"
        },
        generatedAt: new Date().toISOString(),
        note: "需要SR模組提供完整統計功能"
      }
    };

  } catch (error) {
    LBK_logError(`取得直接統計資料失敗: ${error.toString()} [${processId}]`, "統計查詢", userId, "GET_DIRECT_STATISTICS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 提供降級統計處理 - 階段三新增
 * @version 2025-12-26-V1.3.1
 * @param {string} statisticsType - 統計類型
 * @param {object} inputData - 輸入資料
 * @param {string} processId - 處理ID
 * @returns {Object} 降級統計結果
 * @description 階段三新增：當SR模組不可用時，提供基礎統計查詢功能
 */
async function LBK_provideFallbackStatistics(statisticsType, inputData, processId) {
  const functionName = "LBK_provideFallbackStatistics";
  try {
    LBK_logInfo(`階段三：提供降級統計處理: ${statisticsType} [${processId}]`, "降級統計", inputData.userId, functionName);

    const currentDateTime = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    // 嘗試直接查詢Firestore獲取基礎統計資料
    let statisticsData = null;
    try {
      statisticsData = await LBK_getBasicStatistics(inputData.userId, statisticsType, processId);
    } catch (dbError) {
      LBK_logWarning(`階段三：直接查詢統計失敗: ${dbError.message} [${processId}]`, "降級統計", inputData.userId, functionName);
    }

    // 根據統計類型建立訊息
    let message = '';
    let periodName = '';

    switch (statisticsType) {
      case 'monthly_statistics':
        periodName = '本月';
        break;
      case 'general_statistics':
      default:
        periodName = '今日';
        break;
    }

    if (statisticsData && statisticsData.success) {
      const data = statisticsData.data;
      message = `📊 ${periodName}統計報表\n\n`;
      message += `💰 總收入：${data.totalIncome || 0} 元\n`;
      message += `💸 總支出：${data.totalExpense || 0} 元\n`;
      message += `📈 淨收支：${(data.totalIncome || 0) - (data.totalExpense || 0)} 元\n`;
      message += `📝 交易筆數：${data.recordCount || 0} 筆\n\n`;
      message += `⏰ 查詢時間：${currentDateTime}\n`;
    } else {
      message = `📊 ${periodName}統計報表\n\n`;
      message += `暫無統計資料\n\n`;
      message += `💡 開始記帳以獲得統計分析\n`;
      message += `⏰ 查詢時間：${currentDateTime}\n`;
    }

    // 建立基礎Quick Reply選項
    const quickReply = {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📊 今日統計',
            data: 'general_statistics',
            displayText: '今日統計'
          }
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📈 本月統計', 
            data: 'monthly_statistics',
            displayText: '本月統計'
          }
        }
      ]
    };

    return {
      message: message,
      quickReply: quickReply,
      statisticsData: statisticsData
    };

  } catch (error) {
    LBK_logError(`階段三：降級統計處理失敗: ${error.toString()} [${processId}]`, "降級統計", inputData.userId, "FALLBACK_STATISTICS_ERROR", error.toString(), functionName);
    
    return {
      message: `📊 統計查詢服務暫時不可用\n\n💡 請稍後再試，或聯繫系統管理員\n⏰ ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
      quickReply: { items: [] }
    };
  }
}

/**
 * 取得基礎統計資料 - 階段三新增
 * @version 2025-12-26-V1.3.1
 * @param {string} userId - 用戶ID
 * @param {string} statisticsType - 統計類型
 * @param {string} processId - 處理ID
 * @returns {Object} 統計資料結果
 * @description 階段三新增：直接查詢Firestore獲取基礎統計資料
 */
async function LBK_getBasicStatistics(userId, statisticsType, processId) {
  const functionName = "LBK_getBasicStatistics";
  try {
    LBK_logDebug(`階段三：查詢基礎統計資料: ${statisticsType} [${processId}]`, "基礎統計", userId, functionName);

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const ledgerId = `user_${userId}`;

    // 設定查詢時間範圍
    const now = new Date();
    let startDate, endDate;

    switch (statisticsType) {
      case 'monthly_statistics':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'general_statistics':
      default:
        // 今日統計
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
    }

    // 查詢transactions集合
    const transactionsRef = db.collection('ledgers').doc(ledgerId).collection('transactions');
    const snapshot = await transactionsRef
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .get();

    let totalIncome = 0;
    let totalExpense = 0;
    let recordCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount || 0);
      
      if (data.type === 'income') {
        totalIncome += amount;
      } else if (data.type === 'expense') {
        totalExpense += amount;
      }
      recordCount++;
    });

    LBK_logInfo(`階段三：統計查詢完成: 收入${totalIncome}, 支出${totalExpense}, ${recordCount}筆 [${processId}]`, "基礎統計", userId, functionName);

    return {
      success: true,
      data: {
        totalIncome,
        totalExpense,
        recordCount,
        period: statisticsType,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }
    };

  } catch (error) {
    LBK_logError(`階段三：查詢基礎統計失敗: ${error.toString()} [${processId}]`, "基礎統計", userId, "BASIC_STATISTICS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString(),
      data: {
        totalIncome: 0,
        totalExpense: 0,
        recordCount: 0
      }
    };
  }
}

/**
 * 格式化統計訊息
 * @version 2025-12-19-V1.3.0
 * @param {object} statisticsData - 統計資料
 * @param {string} processId - 處理ID
 * @returns {string} 格式化的訊息
 */
function LBK_formatStatisticsMessage(statisticsData, processId) {
  const functionName = "LBK_formatStatisticsMessage";
  try {
    LBK_logDebug(`格式化統計訊息 [${processId}]`, "統計查詢", "", functionName);

    if (!statisticsData || !statisticsData.data) {
      return "統計資料格式錯誤";
    }

    const data = statisticsData.data;
    const currentDateTime = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    let message = `📊 統計報表\n`;
    message += `類型：${data.type || '未指定'}\n`;
    message += `時間：${currentDateTime}\n`;
    message += `交易筆數：${data.summary?.totalTransactions || 0}\n`;
    message += `總金額：${data.summary?.totalAmount || 0}元\n`;
    message += `統計期間：${data.summary?.period || '未指定'}\n`;

    if (data.note) {
      message += `\n📝 ${data.note}`;
    }

    return message;

  } catch (error) {
    LBK_logError(`格式化統計訊息失敗: ${error.toString()} [${processId}]`, "統計查詢", "", "FORMAT_STATISTICS_MESSAGE_ERROR", error.toString(), functionName);
    return "統計訊息格式化失敗";
  }
}

/**
 * 從輸入中提取支付方式名稱
 * @version 2025-12-19-V1.4.9
 * @param {string} originalInput - 原始輸入
 * @param {string} processId - 處理ID
 * @returns {string|null} 支付方式名稱
 */
function LBK_extractPaymentMethodFromInput(originalInput, processId) {
  const functionName = "LBK_extractPaymentMethodFromInput";
  try {
    if (!originalInput) return null;

    // 使用 LBK_parseInputFormat 解析輸入
    const parseResult = LBK_parseInputFormat(originalInput, processId);
    if (parseResult && parseResult.paymentMethod) {
      LBK_logDebug(`從輸入中提取支付方式: "${originalInput}" → "${parseResult.paymentMethod}" [${processId}]`, "支付方式提取", "", functionName);
      return parseResult.paymentMethod;
    }

    return null;

  } catch (error) {
    LBK_logError(`從輸入中提取支付方式失敗: ${error.toString()} [${processId}]`, "支付方式提取", "", "EXTRACT_PAYMENT_METHOD_ERROR", error.toString(), functionName);
    return null;
  }
}

/**
 * 階段二新增：處理錢包確認postback事件
 * @version 2025-12-19-V1.4.9
 * @param {string} postbackData - postback數據
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 處理結果
 * @description 處理錢包確認相關的postback事件，包括wallet_yes_, wallet_no_, wallet_type_等
 */
async function LBK_handleWalletConfirmationPostback(postbackData, userId, processId) {
  const functionName = "LBK_handleWalletConfirmationPostback";
  try {
    LBK_logInfo(`處理錢包確認postback: ${postbackData} [${processId}]`, "錢包確認", userId, functionName);

    // 處理wallet_type_開頭的postback（支付方式類型選擇）
    if (postbackData.startsWith('wallet_type_')) {
      const parts = postbackData.split('_');
      if (parts.length >= 4) {
        const walletType = parts[2]; // cash, debit, credit
        const pendingId = parts[3];

        LBK_logInfo(`處理支付方式類型選擇: type=${walletType}, pendingId=${pendingId} [${processId}]`, "支付方式類型", userId, functionName);

        return await LBK_handleWalletTypeSelection(userId, pendingId, walletType, processId);
      }
    }

    // 處理wallet_yes_和wallet_no_格式的postback
    if (postbackData.startsWith('wallet_yes_') || postbackData.startsWith('wallet_no_')) {
      const isConfirmed = postbackData.startsWith('wallet_yes_');
      const walletData = postbackData.substring(isConfirmed ? 11 : 10); // 移除 'wallet_yes_' 或 'wallet_no_'

      try {
        const parsedData = JSON.parse(walletData);
        LBK_logInfo(`錢包確認選擇: ${isConfirmed ? '確認' : '拒絕'}, 錢包: ${parsedData.walletName} [${processId}]`, "錢包確認", userId, functionName);

        if (isConfirmed) {
          // 用戶確認使用此錢包
          return await LBK_processConfirmedWallet(parsedData, userId, processId);
        } else {
          // 用戶拒絕，返回錯誤訊息
          return {
            success: false,
            message: "已取消錢包選擇，請重新輸入記帳資訊",
            responseMessage: "已取消錢包選擇，請重新輸入記帳資訊",
            moduleCode: "LBK",
            module: "LBK",
            processingTime: 0,
            moduleVersion: "1.4.9",
            errorType: "WALLET_CANCELLED"
          };
        }
      } catch (parseError) {
        LBK_logError(`解析錢包postback數據失敗: ${parseError.toString()} [${processId}]`, "錢包確認", userId, "WALLET_POSTBACK_PARSE_ERROR", parseError.toString(), functionName);
        return {
          success: false,
          message: "錢包確認資料錯誤，請重新輸入",
          responseMessage: "錢包確認資料錯誤，請重新輸入",
          moduleCode: "LBK",
          module: "LBK",
          processingTime: 0,
          moduleVersion: "1.4.9",
          errorType: "WALLET_POSTBACK_PARSE_ERROR"
        };
      }
    }

    // 未知的postback格式
    LBK_logWarning(`未知的錢包postback格式: ${postbackData} [${processId}]`, "錢包確認", userId, functionName);
    return {
      success: false,
      message: "未知的錢包確認格式，請重新輸入",
      responseMessage: "未知的錢包確認格式，請重新輸入",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.4.9",
      errorType: "UNKNOWN_WALLET_POSTBACK"
    };

  } catch (error) {
    LBK_logError(`處理錢包確認postback失敗: ${error.toString()} [${processId}]`, "錢包確認", userId, "WALLET_CONFIRMATION_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: "錢包確認處理失敗，請稍後再試",
      responseMessage: "錢包確認處理失敗，請稍後再試",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.4.9",
      errorType: "WALLET_CONFIRMATION_ERROR"
    };
  }
}

/**
 * 處理已確認的錢包選擇
 * @version 2025-12-19-V1.4.9
 * @param {object} walletData - 錢包資料
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 處理結果
 */
async function LBK_processConfirmedWallet(walletData, userId, processId) {
  try {
    // 如果有pendingId，從Pending Record繼續處理
    if (walletData.pendingId) {
      const updateResult = await LBK_updatePendingRecord(
        userId,
        walletData.pendingId,
        {
          stageData: {
            walletSelected: true,
            selectedWallet: {
              walletId: walletData.walletId || 'confirmed_wallet',
              walletName: walletData.walletName,
              type: walletData.type || 'unknown'
            }
          }
        },
        PENDING_STATES.PENDING_WALLET,
        processId
      );

      if (updateResult.success) {
        // 階段四：在這裡調用同義詞學習
        if (walletData.originalInput && walletData.walletName) {
          const synonymsResult = await LBK_executeWalletSynonymsUpdate(
            walletData.originalInput,
            walletData.walletId, // 傳入 walletId
            userId,
            processId
          );
          if (!synonymsResult.success) {
            LBK_logWarning(`階段四：執行wallet synonyms更新失敗: ${synonymsResult.error} [${processId}]`, "同義詞學習", userId, "LBK_processConfirmedWallet");
          }
        }
        return await LBK_completePendingRecord(userId, walletData.pendingId, processId);
      }
    }

    // 更新錢包synonyms（如果需要）
    if (walletData.originalInput && walletData.walletName) {
      await LBK_updateWalletSynonyms(walletData.originalInput, walletData.walletName, userId, processId);
    }

    return {
      success: true,
      message: `已確認使用錢包：${walletData.walletName}`,
      responseMessage: `已確認使用錢包：${walletData.walletName}`,
      moduleCode: "LBK",
      module: "LBK",
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.4.9"
    };

  } catch (error) {
    LBK_logError(`處理確認錢包失敗: ${error.toString()} [${processId}]`, "錢包確認", userId, "PROCESS_CONFIRMED_WALLET_ERROR", error.toString(), "LBK_processConfirmedWallet");
    return {
      success: false,
      message: "處理錢包確認失敗，請稍後再試",
      responseMessage: "處理錢包確認失敗，請稍後再試",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.4.9",
      errorType: "PROCESS_CONFIRMED_WALLET_ERROR"
    };
  }
}

/**
 * 階段二：優化支付方式專項處理 - 信任第一階段解析結果，動態查詢wallet配置
 * @version 2025-12-23-V2.2.0
 * @param {string} messageText - 用戶輸入訊息
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 支付方式解析結果
 * @description 階段二：建立階段間信任機制，優先使用第一階段解析結果，動態查詢0302配置
 */
async function LBK_parsePaymentMethod(messageText, userId, processId) {
  const functionName = "LBK_parsePaymentMethod";
  try {
    LBK_logDebug(`階段二：開始支付方式專項處理: "${messageText}" [${processId}]`, "支付方式解析", userId, functionName);

    if (!messageText || !userId) {
      return {
        success: false,
        systemError: true,
        error: "缺少必要參數",
        needsUnifiedFormatting: true
      };
    }

    // 第一步：信任第一階段解析結果
    const parseResult = LBK_parseInputFormat(messageText, processId);
    if (!parseResult) {
      return {
        success: false,
        systemError: true,
        error: "無法解析輸入格式",
        needsUnifiedFormatting: true
      };
    }

    let paymentMethodName = parseResult.paymentMethod;
    LBK_logInfo(`階段二：信任第一階段解析結果: "${paymentMethodName || '未檢測到'}" [${processId}]`, "支付方式解析", userId, functionName);

    // 第二步：優先使用第一階段解析結果進行wallet查詢
    if (paymentMethodName) {
      LBK_logDebug(`階段二：使用第一階段結果查詢wallet: "${paymentMethodName}" [${processId}]`, "支付方式解析", userId, functionName);

      // 查詢wallet是否存在於用戶的wallets子集合中
      const walletResult = await LBK_getWalletByName(paymentMethodName, userId, processId);

      if (walletResult && walletResult.walletId) {
        LBK_logInfo(`階段二：成功匹配wallet: "${paymentMethodName}" → "${walletResult.walletName}" [${processId}]`, "支付方式解析", userId, functionName);
        return {
          success: true,
          walletId: walletResult.walletId,
          walletName: walletResult.walletName,
          requiresWalletConfirmation: false,
          matchSource: "wallet_subcollection"
        };
      } else {
        // 未在wallet子集合中找到，需要歧義消除
        LBK_logInfo(`階段二：未在wallet子集合中找到"${paymentMethodName}"，觸發歧義消除 [${processId}]`, "支付方式解析", userId, functionName);
        return {
          success: false,
          requiresWalletConfirmation: true,
          walletName: paymentMethodName,
          error: `支付方式"${paymentMethodName}"需要用戶確認`,
          needsUserSelection: true
        };
      }
    }

    // 第三步：用戶未提供支付方式時，動態查詢0302預設配置
    LBK_logDebug(`階段二：用戶未提供支付方式，動態查詢0302預設配置 [${processId}]`, "支付方式解析", userId, functionName);
    const defaultWalletResult = await LBK_getDefaultPaymentMethod(userId, processId);

    if (defaultWalletResult.success) {
      LBK_logInfo(`階段二：使用0302預設配置: "${defaultWalletResult.walletName}" [${processId}]`, "支付方式解析", userId, functionName);
      return {
        success: true,
        walletId: defaultWalletResult.walletId,
        walletName: defaultWalletResult.walletName,
        requiresWalletConfirmation: false,
        isDefault: true,
        matchSource: "default_config_0302"
      };
    } else {
      // 系統錯誤：無法取得預設值
      return {
        success: false,
        systemError: true,
        error: "無法取得預設支付方式配置",
        needsUnifiedFormatting: true
      };
    }

  } catch (error) {
    LBK_logError(`階段二：支付方式專項處理失敗: ${error.toString()} [${processId}]`, "支付方式解析", userId, "PAYMENT_METHOD_PARSE_ERROR", error.toString(), functionName);
    return {
      success: false,
      systemError: true,
      error: error.toString(),
      needsUnifiedFormatting: true
    };
  }
}

/**
 * 階段二修正：驗證錢包是否存在 - 移除自動接受未知銀行名稱的邏輯
 * @version 2025-12-19-V1.6.0
 * @description 階段二修正：嚴格驗證錢包存在性，不自動接受任何未在 wallets 子集合中定義的支付方式
 */
async function LBK_validateWalletExists(userId, walletId, walletName, processId) {
  const functionName = "LBK_validateWalletExists";
  try {
    LBK_logDebug(`階段二：嚴格驗證錢包存在: walletId="${walletId}", walletName="${walletName}" [${processId}]`, "錢包驗證", userId, functionName);

    if (!walletId && !walletName) {
      LBK_logDebug(`階段二：錢包ID和名稱不能同時為空 [${processId}]`, "錢包驗證", userId, functionName);
      return {
        success: false,
        error: "錢包ID和名稱不能同時為空",
        errorType: "INVALID_WALLET_PARAMS"
      };
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const ledgerId = `user_${userId}`;

    // 階段二修正：如果有 walletId，優先使用 walletId 查詢
    if (walletId) {
      LBK_logDebug(`階段二：使用 walletId 查詢: ${walletId} [${processId}]`, "錢包驗證", userId, functionName);
      const walletDoc = await db.collection("ledgers").doc(ledgerId).collection("wallets").doc(walletId).get();

      if (walletDoc.exists) {
        const data = walletDoc.data();

        // 階段二：檢查錢包是否為 active 狀態
        if (data.status !== 'active') {
          LBK_logWarning(`階段二：錢包存在但狀態非 active: ${walletId}, 狀態: ${data.status} [${processId}]`, "錢包驗證", userId, functionName);
          return {
            success: false,
            requiresUserConfirmation: true,
            error: `錢包存在但已停用: ${walletName || walletId}`,
            errorType: "WALLET_INACTIVE"
          };
        }

        LBK_logInfo(`階段二：透過 walletId 驗證成功: ${walletId} → ${data.walletName || data.name} [${processId}]`, "錢包驗證", userId, functionName);
        return {
          success: true,
          walletId: walletId,
          walletName: data.walletName || data.name,
          walletData: data
        };
      }
    }

    // 階段二修正：使用 walletName 查詢，嚴格依賴 LBK_getWalletByName 的結果
    if (walletName) {
      LBK_logDebug(`階段二：使用 walletName 嚴格查詢: "${walletName}" [${processId}]`, "錢包驗證", userId, functionName);
      const wallet = await LBK_getWalletByName(walletName, userId, processId);

      if (wallet && wallet.walletId) {
        LBK_logInfo(`階段二：透過 walletName 驗證成功: "${walletName}" → 錢包ID: ${wallet.walletId} [${processId}]`, "錢包驗證", userId, functionName);
        return {
          success: true,
          walletId: wallet.walletId,
          walletName: wallet.walletName,
          walletData: wallet
        };
      }
    }

    // 階段二修正：錢包不存在於 wallets 子集合中，必須觸發用戶確認
    LBK_logInfo(`階段二：錢包未在 wallets 子集合中找到，觸發用戶確認: ${walletName || walletId} [${processId}]`, "錢包驗證", userId, functionName);
    return {
      success: false,
      requiresUserConfirmation: true,
      error: `未在 wallets 子集合中找到錢包: ${walletName || walletId}`,
      errorType: "WALLET_NOT_IN_SUBCOLLECTION"
    };

  } catch (error) {
    LBK_logError(`階段二：驗證錢包存在失敗: ${error.toString()} [${processId}]`, "錢包驗證", userId, "WALLET_VALIDATION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString(),
      errorType: "WALLET_VALIDATION_ERROR"
    };
  }
}

/**
 * 處理新錢包流程
 * @version 2025-12-19-V1.4.9
 * @param {string} walletName - 錢包名稱
 * @param {object} parsedData - 解析後的資料
 * @param {object} inputData - 原始輸入資料
 * @param {string} processId - 處理ID
 * @returns {Object} 處理結果
 */
async function LBK_handleNewWallet(walletName, parsedData, inputData, processId) {
  const functionName = "LBK_handleNewWallet";
  try {
    LBK_logInfo(`處理新錢包: ${walletName} [${processId}]`, "新錢包處理", inputData.userId, functionName);

    // 階段五修復：動態生成錢包類型選擇Quick Reply，移除硬編碼ID
    const quickReply = {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '💵 現金',
            data: `wallet_yes_${JSON.stringify({
              walletName: '現金',
              walletId: 'dynamic_cash',
              type: 'cash',
              originalInput: walletName,
              pendingId: parsedData.pendingId,
              dynamicQuery: true
            })}`,
            displayText: '選擇現金'
          }
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🏦 銀行轉帳',
            data: `wallet_yes_${JSON.stringify({
              walletName: '銀行轉帳',
              walletId: 'debit',
              originalInput: walletName,
              pendingId: parsedData.pendingId,
              dynamicQuery: true
            })}`,
            displayText: '選擇銀行轉帳'
          }
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '💳 信用卡',
            data: `wallet_yes_${JSON.stringify({
              walletName: '信用卡',
              walletId: 'dynamic_credit',
              type: 'credit_card',
              originalInput: walletName,
              pendingId: parsedData.pendingId,
              dynamicQuery: true
            })}`,
            displayText: '選擇信用卡'
          }
        }
      ]
    };

    const message = `檢測到未知支付方式「${walletName}」，請問這屬於何種支付方式：`;

    return {
      success: true,
      message: message,
      responseMessage: message,
      quickReply: quickReply,
      moduleCode: "LBK",
      module: "LBK",
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.4.9",
      requiresUserSelection: true
    };

  } catch (error) {
    LBK_logError(`處理新錢包失敗: ${error.toString()} [${processId}]`, "新錢包處理", inputData.userId, "NEW_WALLET_HANDLE_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: "處理新錢包失敗，請稍後再試",
      responseMessage: "處理新錢包失敗，請稍後再試",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.4.9",
      errorType: "NEW_WALLET_HANDLE_ERROR"
    };
  }
}

/**
 * 更新錢包同義詞
 * @version 2025-12-19-V1.4.9
 * @param {string} originalInput - 原始輸入
 * @param {string} walletName - 錢包名稱
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 更新結果
 */
async function LBK_updateWalletSynonyms(originalInput, walletName, userId, processId) {
  const functionName = "LBK_updateWalletSynonyms";
  try {
    // 這裡可以添加同義詞更新邏輯
    LBK_logInfo(`更新錢包同義詞: ${originalInput} → ${walletName} [${processId}]`, "錢包同義詞", userId, functionName);

    return {
      success: true,
      message: "同義詞更新成功"
    };

  } catch (error) {
    LBK_logError(`更新錢包同義詞失敗: ${error.toString()} [${processId}]`, "錢包同義詞", userId, "WALLET_SYNONYMS_UPDATE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 階段三修復：執行錢包同義詞更新 - 確保使用正確提取的支付方式名稱
 * @version 2025-12-19-V1.8.0
 * @param {string} originalInput - 原始輸入
 * @param {string} targetWalletType - 目標錢包類型
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 執行結果
 * @description 階段三修復：確保同義詞學習使用正確提取的支付方式名稱，而非硬編碼的「刷卡」
 */
async function LBK_executeWalletSynonymsUpdate(originalInput, targetWalletType, userId, processId) {
  const functionName = "LBK_executeWalletSynonymsUpdate";
  try {
    LBK_logInfo(`階段一修復：執行錢包同義詞更新: ${originalInput} → 類型:${targetWalletType} [${processId}]`, "錢包同義詞", userId, functionName);

    // 階段一修復：確保所有變數在使用前都已正確初始化
    let paymentMethodToLearn = null;
    let resolvedWallet = null;
    let finalTargetWalletId = null;
    let finalTargetWalletName = null;

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const ledgerId = `user_${userId}`;

    // 階段一修復：正確提取支付方式名稱，確保不使用硬編碼的「刷卡」
    const parseResult = LBK_parseInputFormat(originalInput, processId);
    if (parseResult && parseResult.paymentMethod) {
      paymentMethodToLearn = parseResult.paymentMethod;
      LBK_logInfo(`階段一修復：從原始輸入正確提取支付方式名稱: "${paymentMethodToLearn}" [${processId}]`, "錢包同義詞", userId, functionName);
    } else {
      // 階段一修復：如果解析失敗，嘗試直接從輸入字串中識別銀行名稱
      // 階段二修復：移除硬編碼銀行名稱列表，改為動態查詢機制
      // 如果parseResult解析失敗，將跳過同義詞學習
    }

    // 階段一修復：如果仍無法識別，記錄警告但繼續處理
    if (!paymentMethodToLearn) {
      LBK_logWarning(`階段一修復：無法從原始輸入中提取支付方式名稱: "${originalInput}"，跳過同義詞學習 [${processId}]`, "錢包同義詞", userId, functionName);
      return {
        success: false,
        error: "無法提取支付方式名稱",
        skipped: true
      };
    }

    // 階段一修復：根據錢包類型動態查詢目標錢包，確保變數正確初始化
    const walletTypeMapping = {
      'cash': ['現金', 'cash'],
      'debit': ['銀行轉帳', '銀行'],
      'credit': ['信用卡', '信用', 'credit']
    };

    // 階段一修復：動態查詢匹配的錢包
    const possibleNames = walletTypeMapping[targetWalletType];
    if (!possibleNames) {
      throw new Error(`階段一修復：未知的錢包類型: ${targetWalletType}`);
    }

    for (const walletName of possibleNames) {
      const dynamicWallet = await LBK_getWalletByName(walletName, userId, processId);
      if (dynamicWallet && dynamicWallet.walletId) {
        resolvedWallet = {
          walletId: dynamicWallet.walletId,
          walletName: dynamicWallet.walletName,
          type: targetWalletType
        };
        LBK_logInfo(`階段一修復：動態查詢成功匹配錢包: ${walletName} → ${resolvedWallet.walletName} [${processId}]`, "錢包同義詞", userId, functionName);
        break;
      }
    }

    if (!resolvedWallet) {
      // 階段一修復：如果都沒匹配到，嘗試查詢所有活躍錢包並按類型匹配
      const walletsSnapshot = await db.collection("ledgers").doc(ledgerId).collection("wallets").where("status", "==", "active").get();

      if (walletsSnapshot.empty) {
        throw new Error(`用戶無可用的活躍錢包，無法更新同義詞`);
      }

      // 階段一修復：按類型匹配邏輯，確保變數正確初始化
      let matchedWallet = null;
      for (const doc of walletsSnapshot.docs) {
        const walletData = doc.data();
        const walletType = walletData.type || '';
        const walletName = walletData.walletName || walletData.name || '';

        // 階段一修復：類型匹配優先級
        if ((targetWalletType === 'cash' && (walletType === 'cash' || walletName.includes('現金'))) ||
            (targetWalletType === 'debit' && (walletType === 'debit' || walletName.includes('銀行'))) ||
            (targetWalletType === 'credit' && (walletType === 'credit_card' || walletName.includes('信用卡')))) {
          matchedWallet = {
            walletId: walletData.walletId || doc.id,
            walletName: walletName,
            type: walletType
          };
          break;
        }
      }

      if (!matchedWallet) {
        // 階段一修復：如果都沒匹配到，使用第一個活躍錢包作為備選
        const firstWallet = walletsSnapshot.docs[0];
        const firstWalletData = firstWallet.data();
        matchedWallet = {
          walletId: firstWalletData.walletId || firstWallet.id,
          walletName: firstWalletData.walletName || firstWalletData.name || '預設錢包',
          type: firstWalletData.type || 'unknown'
        };
        LBK_logWarning(`階段一修復：無法精確匹配錢包類型，使用第一個活躍錢包: ${matchedWallet.walletName} [${processId}]`, "錢包同義詞", userId, functionName);
      }

      resolvedWallet = matchedWallet;
    }

    if (!resolvedWallet) {
      throw new Error(`無法動態解析或匹配到有效的錢包`);
    }

    // 階段一修復：確保變數正確賦值
    finalTargetWalletId = resolvedWallet.walletId;
    finalTargetWalletName = resolvedWallet.walletName;

    LBK_logInfo(`階段一修復：動態查詢到目標錢包: ID=${finalTargetWalletId}, 名稱=${finalTargetWalletName} [${processId}]`, "錢包同義詞", userId, functionName);

    // 階段一修復：查找目標錢包文檔並更新同義詞
    const walletRef = db.collection("ledgers").doc(ledgerId).collection("wallets").doc(finalTargetWalletId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      throw new Error(`動態查詢的錢包不存在: ${finalTargetWalletId}`);
    }

    const walletData = walletDoc.data();
    const existingSynonyms = walletData.synonyms || "";
    const synonymsArray = existingSynonyms ? existingSynonyms.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];

    // 階段一修復：使用正確提取的支付方式名稱作為同義詞，並確保不重複
    const trimmedPaymentMethod = paymentMethodToLearn.trim();
    if (!synonymsArray.includes(trimmedPaymentMethod) && trimmedPaymentMethod.length > 0) {
      synonymsArray.push(trimmedPaymentMethod);
      const updatedSynonyms = synonymsArray.join(",");

      // 階段一修復：使用事務確保更新成功
      await db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(walletRef);
        if (docSnapshot.exists) {
          transaction.update(walletRef, {
            synonyms: updatedSynonyms,
            updatedAt: admin.firestore.Timestamp.now(),
            // lastSynonymAdded: trimmedPaymentMethod, // 移除不符合0070規範的欄位
            synonymsCount: synonymsArray.length
          });
        } else {
          throw new Error(`錢包文檔不存在: ${finalTargetWalletId}`);
        }
      });

      LBK_logInfo(`階段一修復：錢包同義詞事務更新成功: "${trimmedPaymentMethod}" → 錢包: "${finalTargetWalletName}" [${processId}]`, "錢包同義詞", userId, functionName);
    } else {
      LBK_logInfo(`階段一修復：同義詞已存在，無需重複添加: "${trimmedPaymentMethod}" [${processId}]`, "錢包同義詞", userId, functionName);
    }

    return {
      success: true,
      message: "階段一修復：同義詞更新成功",
      targetWalletId: finalTargetWalletId,
      targetWalletName: finalTargetWalletName,
      learnedPaymentMethod: trimmedPaymentMethod,
      synonymsUpdated: !synonymsArray.includes(trimmedPaymentMethod)
    };

  } catch (error) {
    LBK_logError(`階段一修復：執行錢包同義詞更新失敗: ${error.toString()} [${processId}]`, "錢包同義詞", userId, "EXECUTE_WALLET_SYNONYMS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 階段五新增：取得錢包顯示名稱
 * @version 2025-12-19-V1.4.9
 * @param {string} walletId - 錢包ID
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 顯示名稱結果
 */
async function LBK_getWalletDisplayName(walletId, userId, processId) {
  const functionName = "LBK_getWalletDisplayName";
  try {
    LBK_logDebug(`取得錢包顯示名稱: ${walletId} [${processId}]`, "錢包顯示", userId, functionName);

    if (!walletId || !userId) {
      return {
        success: false,
        error: "缺少必要參數"
      };
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const ledgerId = `user_${userId}`;

    const walletDoc = await db.collection("ledgers").doc(ledgerId).collection("wallets").doc(walletId).get();

    if (!walletDoc.exists) {
      return {
        success: false,
        error: `錢包不存在: ${walletId}`
      };
    }

    const walletData = walletDoc.data();
    const displayName = walletData.walletName || walletData.name || walletId;

    return {
      success: true,
      displayName: displayName,
      walletData: walletData
    };

  } catch (error) {
    LBK_logError(`取得錢包顯示名稱失敗: ${error.toString()} [${processId}]`, "錢包顯示", userId, "GET_WALLET_DISPLAY_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 添加科目同義詞
 * @version 2025-12-19-V1.4.9
 * @param {string} originalSubject - 原始科目輸入
 * @param {string} categoryId - 科目ID
 * @param {string} categoryName - 科目名稱
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Object} 添加結果
 */
async function LBK_addSubjectSynonym(originalSubject, categoryId, categoryName, userId, processId) {
  const functionName = "LBK_addSubjectSynonym";
  try {
    LBK_logInfo(`階段一修復：添加科目同義詞: ${originalSubject} → ${categoryName} (ID: ${categoryId}) [${processId}]`, "科目同義詞", userId, functionName);

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const ledgerId = `user_${userId}`;

    // 階段一修復：增強的科目記錄查找邏輯
    const categoryRef = db.collection("ledgers").doc(ledgerId).collection("categories").doc(categoryId);
    const categoryDoc = await categoryRef.get();

    if (categoryDoc.exists) {
      const data = categoryDoc.data();
      const existingSynonyms = data.synonyms || "";
      const synonymsArray = existingSynonyms ? existingSynonyms.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];

      LBK_logInfo(`階段一修復：現有同義詞: [${synonymsArray.join(', ')}] [${processId}]`, "科目同義詞", userId, functionName);

      // 階段一修復：確保同義詞不重複且有效
      if (!synonymsArray.includes(originalSubject.trim()) && originalSubject.trim().length > 0) {
        synonymsArray.push(originalSubject.trim());
        const updatedSynonyms = synonymsArray.join(",");

        // 階段一修復：使用事務確保寫入成功
        await db.runTransaction(async (transaction) => {
          const docSnapshot = await transaction.get(categoryRef);
          if (docSnapshot.exists) {
            transaction.update(categoryRef, {
              synonyms: updatedSynonyms,
              updatedAt: admin.firestore.Timestamp.now(),
              // lastSynonymAdded: originalSubject.trim(), // 移除不符合0070規範的欄位
              synonymsCount: synonymsArray.length
            });
          } else {
            throw new Error(`科目文檔不存在: ${categoryId}`);
          }
        });

        LBK_logInfo(`階段一修復：科目同義詞事務更新成功: "${updatedSynonyms}" [${processId}]`, "科目同義詞", userId, functionName);
      } else {
        LBK_logInfo(`階段一修復：同義詞已存在或無效，跳過添加: "${originalSubject}" [${processId}]`, "科目同義詞", userId, functionName);
      }
    } else {
      // 階段一修復：科目文檔不存在時的詳細錯誤處理
      LBK_logError(`階段一修復：科目文檔不存在: ${categoryId}，路徑: ${categoryRef.path} [${processId}]`, "科目同義詞", userId, "CATEGORY_DOC_NOT_FOUND", "科目文檔不存在", functionName);
      throw new Error(`科目文檔不存在: ${categoryId}`);
    }

    return {
      success: true,
      message: "階段一修復：同義詞添加成功"
    };

  } catch (error) {
    LBK_logError(`階段一修復：添加科目同義詞失敗: ${error.toString()} [${processId}]`, "科目同義詞", userId, "ADD_SUBJECT_SYNONYM_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Pending Record 相關函數
 */

/**
 * 創建記憶體Pending Session - 階段三優化
 * @version 2025-12-24-V3.0.0
 * @param {string} userId - 用戶ID
 * @param {string} originalInput - 原始輸入
 * @param {object} parsedData - 解析後的資料
 * @param {string} initialState - 初始狀態
 * @param {string} processId - 處理ID
 * @returns {Object} 創建結果
 * @description 階段三：歧義消除過程完全在記憶體中進行，不寫入Firestore
 */
async function LBK_createPendingRecord(userId, originalInput, parsedData, initialState, processId) {
  const functionName = "LBK_createPendingRecord";
  try {
    const pendingId = Date.now().toString();

    // 階段三：創建記憶體Session，不寫入資料庫
    const memorySession = {
      pendingId: pendingId,
      userId: userId,
      ledgerId: `user_${userId}`,
      originalInput: originalInput,
      parsedData: {
        amount: parsedData.amount || 0,
        description: parsedData.subject || parsedData.description || originalInput || '未知科目',
        rawCategory: parsedData.subject || parsedData.categoryName || '未知科目',
        rawWallet: parsedData.paymentMethod || '未指定'
      },
      // 階段三：簡化狀態管理，只保留必要狀態
      currentStage: initialState,
      ambiguityData: {
        type: initialState === PENDING_STATES.PENDING_CATEGORY ? 'subject' : 'wallet',
        options: [],
        userSelection: null
      },
      // 階段三：核心元數據
      coreMetadata: {
        source: 'LINE',
        module: 'LBK',
        version: '3.0.0',
        createdAt: Date.now(),
        inMemory: true
      },
      status: 'memory_active'
    };

    // 階段三：儲存到記憶體快取，不寫入Firestore
    LBK_CONFIG.MEMORY_SESSIONS = LBK_CONFIG.MEMORY_SESSIONS || new Map();
    LBK_CONFIG.MEMORY_SESSIONS.set(pendingId, memorySession);

    // 階段三：記憶體快取大小限制
    if (LBK_CONFIG.MEMORY_SESSIONS.size > (LBK_CONFIG.SMART_LOGGING.MAX_CACHE_SIZE || 100)) {
      const oldestKey = LBK_CONFIG.MEMORY_SESSIONS.keys().next().value;
      LBK_CONFIG.MEMORY_SESSIONS.delete(oldestKey);
      LBK_logDebug(`階段三：記憶體快取清理，移除過期Session: ${oldestKey} [${processId}]`, "記憶體管理", userId, functionName);
    }

    LBK_logInfo(`階段三：記憶體Pending Session創建成功: ${pendingId} (不寫入Firestore) [${processId}]`, "記憶體Session", userId, functionName);

    return {
      success: true,
      pendingId: pendingId,
      data: memorySession,
      memoryMode: true
    };

  } catch (error) {
    LBK_logError(`階段三：創建記憶體Session失敗: ${error.toString()} [${processId}]`, "記憶體Session", userId, "CREATE_MEMORY_SESSION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 階段三：更新記憶體Session - 不寫入Firestore
 * @version 2025-12-24-V3.0.0
 * @param {string} userId - 用戶ID
 * @param {string} pendingId - Session ID
 * @param {object} updateData - 要更新的資料
 * @param {string} newState - 新狀態
 * @param {string} processId - 處理ID
 * @returns {Object} 更新結果
 * @description 階段三：記憶體中更新Session狀態，避免中間狀態寫入
 */
async function LBK_updatePendingRecord(userId, pendingId, updateData, newState, processId) {
  const functionName = "LBK_updatePendingRecord";
  try {
    // 階段三：從記憶體快取中獲取Session
    let memorySession = LBK_CONFIG.MEMORY_SESSIONS?.get(pendingId);

    if (!memorySession) {
      // 階段三：記憶體Session不存在，嘗試從Firestore查詢（向後相容）
      LBK_logWarning(`階段三：記憶體Session不存在，嘗試Firestore查詢: ${pendingId} [${processId}]`, "記憶體Session", userId, functionName);

      await LBK_initializeFirestore();
      const db = LBK_INIT_STATUS.firestore_db;
      const ledgerId = `user_${userId}`;
      const doc = await db.collection('ledgers').doc(ledgerId).collection('pendingTransactions').doc(pendingId).get();

      if (!doc.exists) {
        throw new Error(`階段三：Session不存在於記憶體或Firestore: ${pendingId}`);
      }

      // 將Firestore資料遷移到記憶體
      memorySession = {
        ...doc.data(), // Use doc.data() to get the data
        status: 'migrated_to_memory',
        inMemory: true
      };
      LBK_CONFIG.MEMORY_SESSIONS.set(pendingId, memorySession);
    }

    // 階段三：記憶體中更新Session
    if (updateData.stageData) {
      memorySession.stageData = { // Directly assign stageData
        ...(memorySession.stageData || {}), // Merge with existing stageData if any
        ...updateData.stageData
      };
      // Ensure stageData.electedCategory and stageData.selectedWallet are correctly merged
      if (updateData.stageData.electedCategory) {
        memorySession.stageData.electedCategory = updateData.stageData.electedCategory;
      }
      if (updateData.stageData.selectedWallet) {
        memorySession.stageData.selectedWallet = updateData.stageData.selectedWallet;
      }
      // Ensure categorySelected and walletSelected are correctly set
      memorySession.stageData.categorySelected = !!memorySession.stageData.electedCategory;
      memorySession.stageData.walletSelected = !!memorySession.stageData.selectedWallet;
    }

    memorySession.currentStage = newState;
    memorySession.lastUpdated = Date.now();
    memorySession.updateCount = (memorySession.updateCount || 0) + 1;

    LBK_logInfo(`階段三：記憶體Session更新成功: ${pendingId} → ${newState} (更新次數: ${memorySession.updateCount}) [${processId}]`, "記憶體Session", userId, functionName);

    return {
      success: true,
      pendingId: pendingId,
      newState: newState,
      memoryMode: true,
      updatedSession: memorySession
    };

  } catch (error) {
    LBK_logError(`階段三：更新記憶體Session失敗: ${error.toString()} [${processId}]`, "記憶體Session", userId, "UPDATE_MEMORY_SESSION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 階段三：排程輔助元數據批次寫入
 * @version 2025-12-24-V3.0.0
 * @param {string} transactionId - 交易ID
 * @param {object} auxiliaryData - 輔助元數據
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @description 階段三：非阻塞批次寫入輔助元數據
 */
function LBK_scheduleAuxiliaryDataWrite(transactionId, auxiliaryData, userId, processId) {
  try {
    // 階段三：將輔助資料加入批次佇列
    LBK_CONFIG.AUXILIARY_WRITE_QUEUE = LBK_CONFIG.AUXILIARY_WRITE_QUEUE || [];

    const auxiliaryRecord = {
      transactionId: transactionId,
      data: auxiliaryData,
      userId: userId,
      processId: processId,
      scheduledAt: Date.now(),
      retryCount: 0
    };

    LBK_CONFIG.AUXILIARY_WRITE_QUEUE.push(auxiliaryRecord);

    LBK_logDebug(`階段三：輔助元數據已排程批次寫入: ${transactionId} (佇列長度: ${LBK_CONFIG.AUXILIARY_WRITE_QUEUE.length}) [${processId}]`, "批次寫入", userId, "LBK_scheduleAuxiliaryDataWrite");

    // 階段三：達到批次寫入閾值時執行
    if (LBK_CONFIG.AUXILIARY_WRITE_QUEUE.length >= (LBK_CONFIG.BATCH_WRITE_THRESHOLD || 10)) {
      LBK_processAuxiliaryDataBatch();
    }

    // 階段三：定期處理佇列（防止積壓）
    if (!LBK_CONFIG.AUXILIARY_TIMER) {
      LBK_CONFIG.AUXILIARY_TIMER = setInterval(() => {
        if (LBK_CONFIG.AUXILIARY_WRITE_QUEUE && LBK_CONFIG.AUXILIARY_WRITE_QUEUE.length > 0) {
          LBK_processAuxiliaryDataBatch();
        }
      }, 300000); // 5分鐘執行一次
    }

  } catch (error) {
    LBK_logError(`階段三：排程輔助元數據寫入失敗: ${error.toString()} [${processId}]`, "批次寫入", userId, "SCHEDULE_AUXILIARY_ERROR", error.toString(), "LBK_scheduleAuxiliaryDataWrite");
  }
}

/**
 * 階段三：處理輔助元數據批次寫入
 * @version 2025-12-24-V3.0.0
 * @description 階段三：批次處理輔助元數據寫入，減少Firestore寫入次數
 */
async function LBK_processAuxiliaryDataBatch() {
  const functionName = "LBK_processAuxiliaryDataBatch";
  try {
    if (!LBK_CONFIG.AUXILIARY_WRITE_QUEUE || LBK_CONFIG.AUXILIARY_WRITE_QUEUE.length === 0) {
      return;
    }

    const batchSize = Math.min(LBK_CONFIG.AUXILIARY_WRITE_QUEUE.length, 10); // Firestore batch限制
    const currentBatch = LBK_CONFIG.AUXILIARY_WRITE_QUEUE.splice(0, batchSize);

    LBK_logInfo(`階段三：開始批次處理輔助元數據: ${batchSize} 筆`, "批次寫入", "", functionName);

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const batch = db.batch();

    for (const record of currentBatch) {
      try {
        const auxiliaryDocRef = db
          .collection('ledgers')
          .doc(`user_${record.userId}`)
          .collection('transactionMetadata')
          .doc(record.transactionId);

        const auxiliaryDoc = {
          ...record.data,
          batchProcessedAt: admin.firestore.Timestamp.now(),
          batchId: Date.now().toString()
        };

        batch.set(auxiliaryDocRef, auxiliaryDoc);

      } catch (recordError) {
        LBK_logError(`階段三：批次處理單筆輔助資料失敗: ${record.transactionId}, ${recordError.toString()}`, "批次寫入", record.userId, "BATCH_RECORD_ERROR", recordError.toString(), functionName);
      }
    }

    await batch.commit();
    LBK_logInfo(`階段三：批次寫入輔助元數據完成: ${batchSize} 筆`, "批次寫入", "", functionName);

  } catch (error) {
    LBK_logError(`階段三：批次處理輔助元數據失敗: ${error.toString()}`, "批次寫入", "", "BATCH_PROCESS_ERROR", error.toString(), functionName);

    // 階段三：失敗的批次重新排程（避免資料遺失）
    if (currentBatch) {
      currentBatch.forEach(record => {
        record.retryCount = (record.retryCount || 0) + 1;
        if (record.retryCount < 3) {
          LBK_CONFIG.AUXILIARY_WRITE_QUEUE.unshift(record); // 重新排程
        } else {
          LBK_logError(`階段三：輔助資料重試次數超限，丟棄: ${record.transactionId}`, "批次寫入", record.userId, "AUXILIARY_DATA_DROPPED", "超過最大重試次數", functionName);
        }
      });
    }
  }
}

/**
 * 階段三：記憶體Session清理
 * @version 2025-12-24-V3.0.0
 * @description 階段三：定期清理過期的記憶體Session
 */
function LBK_cleanupMemorySessions() {
  const functionName = "LBK_cleanupMemorySessions";
  try {
    if (!LBK_CONFIG.MEMORY_SESSIONS) {
      return;
    }

    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of LBK_CONFIG.MEMORY_SESSIONS.entries()) {
      const sessionAge = now - (session.coreMetadata?.createdAt || session.lastUpdated || now);

      // 階段三：30分鐘過期清理
      if (sessionAge > 30 * 60 * 1000) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      LBK_CONFIG.MEMORY_SESSIONS.delete(sessionId);
    });

    if (expiredSessions.length > 0) {
      LBK_logInfo(`階段三：記憶體Session清理完成: ${expiredSessions.length} 筆過期Session`, "記憶體管理", "", functionName);
    }

  } catch (error) {
    LBK_logError(`階段三：記憶體Session清理失敗: ${error.toString()}`, "記憶體管理", "", "MEMORY_CLEANUP_ERROR", error.toString(), functionName);
  }
}

// 階段三：初始化記憶體管理定時器
if (!LBK_CONFIG.MEMORY_CLEANUP_TIMER) {
  LBK_CONFIG.MEMORY_CLEANUP_TIMER = setInterval(() => {
    LBK_cleanupMemorySessions();
  }, 30 * 60 * 1000); // 每30分鐘清理一次
}

/**
 * 階段三：獲取記憶體Session - 優先記憶體查詢
 * @version 2025-12-24-V3.0.0
 * @param {string} userId - 用戶ID
 * @param {string} pendingId - Session ID
 * @param {string} processId - 處理ID
 * @returns {Object} 獲取結果
 * @description 階段三：優先從記憶體獲取Session，降低Firestore讀取
 */
async function LBK_getPendingRecord(userId, pendingId, processId) {
  const functionName = "LBK_getPendingRecord";
  try {
    // 階段三：優先從記憶體快取獲取
    const memorySession = LBK_CONFIG.MEMORY_SESSIONS?.get(pendingId);

    if (memorySession) {
      LBK_logDebug(`階段三：從記憶體獲取Session成功: ${pendingId} [${processId}]`, "記憶體Session", userId, functionName);
      return {
        success: true,
        data: memorySession,
        source: 'memory'
      };
    }

    // 階段三：記憶體中不存在，檢查Firestore（向後相容）
    LBK_logDebug(`階段三：記憶體中無Session，查詢Firestore: ${pendingId} [${processId}]`, "記憶體Session", userId, functionName);

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const ledgerId = `user_${userId}`;
    const doc = await db.collection('ledgers').doc(ledgerId).collection('pendingTransactions').doc(pendingId).get();

    if (!doc.exists) {
      return {
        success: false,
        error: `階段三：Session不存在於記憶體或Firestore: ${pendingId}`
      };
    }

    const firestoreData = doc.data();

    // 階段三：將Firestore資料快取到記憶體
    if (LBK_CONFIG.MEMORY_SESSIONS) {
      LBK_CONFIG.MEMORY_SESSIONS.set(pendingId, {
        ...firestoreData,
        status: 'migrated_to_memory',
        inMemory: true
      });
      LBK_logInfo(`階段三：Firestore資料已快取到記憶體: ${pendingId} [${processId}]`, "記憶體Session", userId, functionName);
    }

    return {
      success: true,
      data: firestoreData,
      source: 'firestore_migrated'
    };

  } catch (error) {
    LBK_logError(`階段三：獲取Session失敗: ${error.toString()} [${processId}]`, "記憶體Session", userId, "GET_MEMORY_SESSION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 格式化錯誤回覆
 * @version 2025-12-19-V1.4.9
 * @param {string} errorType - 錯誤類型
 * @param {string} errorMessage - 錯誤訊息
 * @returns {Object} 格式化的錯誤回覆
 */
function LBK_formatErrorResponse(errorType, errorMessage) {
  return {
    success: false,
    message: errorMessage || "系統錯誤，請稍後再試",
    responseMessage: errorMessage || "系統錯誤，請稍後再試",
    moduleCode: "LBK",
    module: "LBK",
    processingTime: 0,
    moduleVersion: "1.4.9",
    errorType: errorType
  };
}

/**
 * 階段二：動態讀取0302預設支付方式配置
 * @version 2025-12-23-V2.2.0
 * @param {string} userId - 用戶ID
 * @param {string} processId - 處理ID
 * @returns {Promise<Object>} 預設支付方式結果
 * @description 階段二：移除硬編碼，動態從0302.json讀取預設wallet配置
 */
async function LBK_getDefaultPaymentMethod(userId, processId) {
  const functionName = "LBK_getDefaultPaymentMethod";
  try {
    LBK_logDebug(`階段二：動態讀取0302預設支付方式配置 [${processId}]`, "預設支付方式", userId, functionName);

    // 讀取0302配置文件
    try {
      const configPath = path.join(__dirname, '../03. Default_config/0302. Default_wallet.json');

      if (!fs.existsSync(configPath)) {
        throw new Error(`0302配置文件不存在: ${configPath}`);
      }

      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      if (!configData.default_wallets || !Array.isArray(configData.default_wallets)) {
        throw new Error("0302配置格式錯誤：缺少default_wallets陣列");
      }

      // 查找標記為isDefault=true的錢包
      const defaultWallet = configData.default_wallets.find(wallet => wallet.isDefault === true && wallet.isActive === true);

      if (defaultWallet) {
        LBK_logInfo(`階段二：從0302配置讀取到預設錢包: "${defaultWallet.walletName}" [${processId}]`, "預設支付方式", userId, functionName);
        return {
          success: true,
          walletId: defaultWallet.walletId,
          walletName: defaultWallet.walletName,
          type: defaultWallet.type || "unknown",
          isDefault: true,
          queryMethod: "dynamic_0302_config",
          configVersion: configData.version
        };
      }

      // 如果沒有明確標記isDefault的，使用第一個active的錢包
      const firstActiveWallet = configData.default_wallets.find(wallet => wallet.isActive === true);

      if (firstActiveWallet) {
        LBK_logInfo(`階段二：使用0302配置中第一個活躍錢包: "${firstActiveWallet.walletName}" [${processId}]`, "預設支付方式", userId, functionName);
        return {
          success: true,
          walletId: firstActiveWallet.walletId,
          walletName: firstActiveWallet.walletName,
          type: firstActiveWallet.type || "unknown",
          isDefault: false,
          queryMethod: "dynamic_0302_first_active",
          configVersion: configData.version
        };
      }

      throw new Error("0302配置中沒有可用的活躍錢包");

    } catch (configError) {
      LBK_logError(`階段二：讀取0302配置失敗: ${configError.toString()} [${processId}]`, "預設支付方式", userId, "CONFIG_READ_ERROR", configError.toString(), functionName);

      // 階段一修復：最後備選使用正確的 walletId 和統一的 fallback 值
      LBK_logWarning(`階段一：0302配置讀取失敗，使用系統安全網: 信用卡 [${processId}]`, "預設支付方式", userId, functionName);
      return {
        success: true,
        walletId: "credit",
        walletName: "信用卡",
        isDefault: true,
        queryMethod: "system_fallback",
        fallbackReason: configError.toString()
      };
    }

  } catch (error) {
    LBK_logError(`階段二：取得預設支付方式失敗: ${error.toString()} [${processId}]`, "預設支付方式", userId, "DEFAULT_PAYMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString(),
      needsUnifiedFormatting: true
    };
  }
}

/**
 * 階段二修正：根據支付方式名稱查詢錢包 - 確保只匹配 wallets 子集合中的確實存在項目
 * @version 2025-12-19-V1.6.0
 * @description 階段二修正：移除模糊匹配，只接受明確在 wallets 子集合 synonyms 中定義的支付方式
 */
async function LBK_getWalletByName(paymentMethodName, userId, processId) {
  const functionName = "LBK_getWalletByName";
  try {
    LBK_logDebug(`階段二：嚴格查詢錢包: "${paymentMethodName}" [${processId}]`, "錢包查詢", userId, functionName);

    if (!paymentMethodName || !userId) {
      LBK_logDebug(`階段二：缺少必要參數，返回 null [${processId}]`, "錢包查詢", userId, functionName);
      return null;
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    const ledgerId = `user_${userId}`;
    const normalizedInput = String(paymentMethodName).trim().toLowerCase();

    LBK_logDebug(`階段二：開始嚴格匹配，輸入: "${normalizedInput}" [${processId}]`, "錢包同義詞匹配", userId, functionName);

    // 階段二修正：只查詢 active 狀態的錢包
    const snapshot = await db.collection("ledgers").doc(ledgerId).collection("wallets").where("status", "==", "active").get();

    LBK_logDebug(`階段二：查詢 wallets 集合結果: ${snapshot.size} 筆 active 資料 [${processId}]`, "錢包查詢", userId, functionName);

    if (snapshot.empty) {
      LBK_logInfo(`階段二：用戶 ${userId} 的 wallets 子集合為空或無 active 錢包 [${processId}]`, "錢包查詢", userId, functionName);
      return null;
    }

    // 階段二修正：僅進行精確匹配，移除模糊匹配邏輯
    let exactWalletNameMatch = null;
    let exactSynonymMatch = null;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const walletName = String(data.walletName || data.name || '').trim().toLowerCase();

      // 1. 精確錢包名稱匹配
      if (walletName === normalizedInput) {
        exactWalletNameMatch = {
          walletId: data.walletId || doc.id,
          walletName: data.walletName || data.name,
          type: data.type,
          matchType: 'wallet_name_exact'
        };
        LBK_logInfo(`階段二：找到精確錢包名稱匹配: "${normalizedInput}" → "${exactWalletNameMatch.walletName}" [${processId}]`, "錢包查詢", userId, functionName);
        break;
      }

      // 2. 精確同義詞匹配
      const synonymsStr = data.synonyms || "";
      const synonyms = synonymsStr ? synonymsStr.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];

      LBK_logDebug(`階段二：檢查同義詞: "${normalizedInput}"，錢包: "${data.walletName || data.name}"，同義詞: [${synonyms.join(', ')}] [${processId}]`, "錢包同義詞匹配", userId, functionName);

      for (const synonym of synonyms) {
        const synonymLower = synonym.toLowerCase();
        if (synonymLower === normalizedInput) {
          exactSynonymMatch = {
            walletId: data.walletId || doc.id,
            walletName: data.walletName || data.name,
            type: data.type,
            matchType: 'synonym_exact',
            matchedSynonym: synonym
          };
          LBK_logInfo(`階段二：找到精確同義詞匹配: "${normalizedInput}" → 同義詞:"${synonym}" → 錢包:"${exactSynonymMatch.walletName}" [${processId}]`, "錢包查詢", userId, functionName);
          break;
        }
      }

      // 如果已找到同義詞匹配，跳出循環
      if (exactSynonymMatch) break;
    }

    // 階段二：按優先級返回結果 - 錢包名稱匹配優於同義詞匹配
    if (exactWalletNameMatch) {
      LBK_logInfo(`階段二：返回錢包名稱精確匹配結果: ${exactWalletNameMatch.walletName} [${processId}]`, "錢包查詢", userId, functionName);
      return exactWalletNameMatch;
    }

    if (exactSynonymMatch) {
      LBK_logInfo(`階段二：返回同義詞精確匹配結果: ${exactSynonymMatch.walletName} (匹配同義詞: ${exactSynonymMatch.matchedSynonym}) [${processId}]`, "錢包查詢", userId, functionName);
      return exactSynonymMatch;
    }

    // 階段二修正：未找到任何精確匹配
    LBK_logInfo(`階段二：未在 wallets 子集合中找到精確匹配: "${paymentMethodName}" [${processId}]`, "錢包查詢", userId, functionName);
    return null;

  } catch (error) {
    LBK_logError(`階段二：查詢錢包失敗: ${error.toString()} [${processId}]`, "錢包查詢", userId, "WALLET_QUERY_ERROR", error.toString(), functionName);
    return null;
  }
}

/**
 * 階段一新增：識別wallet類型postback事件
 * @version 2025-12-18-V1.4.7
 * @date 2025-12-18 15:30:00
 * @description 識別wallet_type_開頭的postback事件，用於支付方式類型選擇流程
 */
function LBK_isWalletTypePostback(messageText) {
  try {
    if (!messageText || typeof messageText !== 'string') {
      return false;
    }

    // 檢查是否為wallet_type_開頭的postback格式
    return messageText.startsWith('wallet_type_');
  } catch (error) {
    LBK_logError(`檢查wallet類型postback失敗: ${error.toString()}`, "Postback識別", "", "WALLET_TYPE_CHECK_ERROR", error.toString(), "LBK_isWalletTypePostback");
    return false;
  }
}

/**
 * v1.4.2 處理科目歸類postback事件 - 完整版：歸類+記帳
 * @version 2025-12-17-V1.4.3
 * @date 2025-12-17 09:30:00
 * @description DCN-0024階段三修復：處理科目歸類完成後自動執行記帳流程
 */
async function LBK_handleClassificationPostback(inputData, processId) {
  try {
    LBK_logInfo(`處理科目歸類postback: categoryId=${inputData.classificationData.categoryId} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");

    const categoryId = inputData.classificationData.categoryId;

    // 載入0099配置以取得科目資訊
    const subjectConfig = LBK_load0099SubjectConfig();
    const categoryMapping = LBK_buildCategoryMapping();

    // 找到選擇的科目 - categoryMapping 是對象，不是數組
    const selectedCategory = categoryMapping[categoryId];
    if (!selectedCategory) {
      LBK_logError(`無效的科目ID: ${categoryId} [${processId}]`, "科目歸類", inputData.userId, "INVALID_CATEGORY", `可用科目: ${Object.keys(categoryMapping).join(', ')}`, "LBK_handleClassificationPostback");

      return {
        success: false,
        message: `無效的科目ID: ${categoryId}，請重新選擇`,
        responseMessage: `無效的科目ID: ${categoryId}，請重新選擇`,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: 0,
        moduleVersion: "1.4.3",
        errorType: "INVALID_CATEGORY"
      };
    }

    LBK_logInfo(`科目歸類選擇: ${selectedCategory.categoryName} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");

    // 階段三修復：從pendingData中取得原始記帳資料
    const pendingData = inputData.classificationData.pendingData;
    if (!pendingData) {
      LBK_logError(`缺少pending記帳資料 [${processId}]`, "科目歸類", inputData.userId, "MISSING_PENDING_DATA", "無法執行記帳", "LBK_handleClassificationPostback");

      return {
        success: true,
        message: `已完成科目歸類！\n選擇科目：${categoryId} ${selectedCategory.categoryName}\n歸類狀態：完成\n\n💡 後續相同輸入將自動歸類至此科目\n\n⚠️ 原始記帳資料遺失，請重新輸入進行記帳`,
        responseMessage: `已完成科目歸類！\n選擇科目：${categoryId} ${selectedCategory.categoryName}\n歸類狀態：完成\n\n💡 後續相同輸入將自動歸類至此科目\n\n⚠️ 原始記帳資料遺失，請重新輸入進行記帳`,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.4.3",
        classificationCompleted: true
      };
    }

    // 步驟1：建立同義詞關聯到Firebase
    const synonymResult = await LBK_addSubjectSynonym(pendingData.subject, categoryId, selectedCategory.categoryName, inputData.userId, processId);
    if (synonymResult.success) {
      LBK_logInfo(`成功建立同義詞關聯: ${pendingData.subject} → ${selectedCategory.categoryName} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");
    } else {
      LBK_logWarning(`同義詞建立失敗但繼續處理: ${synonymResult.error} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");
    }

    // 步驟2：階段一修復 - 更新 Pending Record 的科目資訊
    if (pendingData.pendingId) {
      const updateResult = await LBK_updatePendingRecord(
        inputData.userId,
        pendingData.pendingId,
        {
          stageData: {
            categorySelected: true,
            electedCategory: {
              categoryId: categoryId,
              categoryName: selectedCategory.categoryName,
              // majorCode: selectedCategory.categoryId // majorCode removed
            },
            walletSelected: false,
            selectedWallet: null
          }
        },
        PENDING_STATES.PENDING_CATEGORY,
        processId
      );

      if (!updateResult.success) {
        LBK_logError(`階段一修復：更新 Pending Record 科目資訊失敗: ${updateResult.error} [${processId}]`, "科目歸類", inputData.userId, "PENDING_UPDATE_ERROR", updateResult.error, "LBK_handleClassificationPostback");
      } else {
        LBK_logInfo(`階段一修復：Pending Record 科目資訊更新成功: ${selectedCategory.categoryName} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");
      }
    }

    // 步驟3：檢查支付方式是否需要歧義消除
    // 階段二修復：正確提取支付方式名稱
    let paymentMethodName = pendingData.paymentMethod;

    // 如果 paymentMethod 為空或無效，從原始輸入中重新解析
    if (!paymentMethodName || paymentMethodName === 'undefined') {
      const parseResult3 = LBK_parseInputFormat(pendingData.originalInput || inputData.messageText, processId);
      paymentMethodName = parseResult3?.paymentMethod;

      // 如果仍然為空，嘗試從 Pending Record 中的其他欄位獲取
      if (!paymentMethodName && pendingData.parsedData?.paymentMethod) {
        paymentMethodName = pendingData.parsedData.paymentMethod;
      }

      // 階段一修復：使用統一邏輯入口點，移除硬編碼
      if (!paymentMethodName) {
        const defaultPaymentResult = await LBK_getDefaultPaymentMethod(inputData.userId, processId);
        if (defaultPaymentResult.success) {
          paymentMethodName = defaultPaymentResult.walletName;
          LBK_logInfo(`階段一：科目歧義消除完成後使用預設支付方式: ${paymentMethodName} [${processId}]`, "支付方式檢查", inputData.userId, "LBK_handleClassificationPostback");
        } else {
          paymentMethodName = '信用卡'; // 系統安全網
          LBK_logWarning(`階段一：預設支付方式查詢失敗，使用系統安全網: ${paymentMethodName} [${processId}]`, "支付方式檢查", inputData.userId, "LBK_handleClassificationPostback");
        }
      }
    }

    LBK_logInfo(`階段二修復：科目選擇完成，檢查支付方式: ${paymentMethodName} [${processId}]`, "支付方式檢查", inputData.userId, "LBK_handleClassificationPostback");

    // 使用修復後的支付方式名稱進行驗證
    const walletResult = await LBK_validateWalletExists(inputData.userId, null, paymentMethodName, processId);

    if (walletResult.systemError) {
      LBK_logError(`支付方式解析系統錯誤: ${walletResult.error} [${processId}]`, "支付方式檢查", inputData.userId, "PAYMENT_METHOD_SYSTEM_ERROR", walletResult.error, "LBK_handleClassificationPostback");

      return {
        success: false,
        message: `科目歸類完成，但支付方式檢查失敗：${walletResult.error}`,
        responseMessage: `科目歸類完成，但支付方式檢查失敗：${walletResult.error}`,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.6.0",
        errorType: "PAYMENT_METHOD_SYSTEM_ERROR"
      };
    }

    // 如果支付方式需要歧義消除
    if (walletResult.requiresUserConfirmation) {
      LBK_logInfo(`支付方式需要歧義消除: ${walletResult.walletName}，轉入PENDING_WALLET狀態 [${processId}]`, "支付方式檢查", inputData.userId, "LBK_handleClassificationPostback");

      // 更新Pending Record狀態為PENDING_WALLET
      if (pendingData.pendingId) {
        const updateResult = await LBK_updatePendingRecord(
          inputData.userId,
          pendingData.pendingId,
          {
            stageData: {
              categorySelected: true,
              electedCategory: {
                categoryId: categoryId,
                categoryName: selectedCategory.categoryName,
                // majorCode: categoryId // majorCode removed
              },
              walletSelected: false,
              selectedWallet: null
            }
          },
          PENDING_STATES.PENDING_WALLET,
          processId
        );

        if (!updateResult.success) {
          LBK_logError(`更新Pending Record狀態失敗: ${updateResult.error} [${processId}]`, "支付方式檢查", inputData.userId, "PENDING_UPDATE_ERROR", updateResult.error, "LBK_handleClassificationPostback");
        }
      }

      // 生成支付方式選擇 Quick Reply
      const walletQuickReply = LBK_generateWalletSelectionQuickReply(pendingData.pendingId);

      return {
        success: true,
        message: `科目歸類完成！已選擇「${selectedCategory.categoryName}」\n\n檢測到未知支付方式「${paymentMethodName}」，請問這屬於何種支付方式：`,
        responseMessage: `科目歸類完成！已選擇「${selectedCategory.categoryName}」\n\n檢測到未知支付方式「${paymentMethodName}」，請問這屬於何種支付方式：`,
        quickReply: walletQuickReply,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.6.0",
        requiresUserSelection: true,
        classificationCompleted: true,
        nextStage: "PENDING_WALLET"
      };
    }

    // 步驟4：支付方式明確，直接進行記帳
    LBK_logInfo(`階段二修復：支付方式明確: ${walletResult.walletName || paymentMethodName}，開始執行記帳 [${processId}]`, "支付方式檢查", inputData.userId, "LBK_handleClassificationPostback");

    const transactionId = Date.now().toString();
    const now = moment().tz(LBK_CONFIG.TIMEZONE);

    // 階段四修復：準備0070規範格式的記帳資料，移除違規欄位
    const preparedData = {
      // 核心欄位 - 符合0070規範
      id: transactionId,
      amount: parseFloat(pendingData.amount) || 0,
      type: selectedCategory.type === "income" ? "income" : "expense", // 使用 type 屬性
      description: pendingData.subject,
      categoryId: categoryId,
      // 階段四修復：移除accountId欄位（不符合0070規範）

      // 時間欄位 - 0070標準格式
      date: now.format('YYYY-MM-DD'),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),

      // 來源和用戶資訊 - 0070標準
      source: 'classification',
      userId: inputData.userId,
      paymentMethod: walletResult.walletName || paymentMethodName || '刷卡',

      // 記帳特定欄位 - 0070標準
      ledgerId: `user_${inputData.userId}`,

      // 狀態欄位 - 0070標準
      status: 'active',
      verified: false,

      // 元數據 - 0070標準
      metadata: {
        processId: processId,
        module: 'LBK',
        version: '1.9.0',
        categoryName: selectedCategory.categoryName,
        classificationSource: 'user_selection'
      }
    };

    LBK_logInfo(`開始執行歸類後記帳: ${pendingData.subject} ${pendingData.amount}元 → ${selectedCategory.categoryName} [${processId}]`, "記帳執行", inputData.userId, "LBK_handleClassificationPostback");

    // 步驟5：直接儲存記帳資料到Firestore
    const saveResult = await LBK_saveToFirestore(preparedData, processId);

    let bookkeepingResult;
    if (saveResult.success) {
      bookkeepingResult = {
        success: true,
        data: {
          id: transactionId,
          transactionId: transactionId,
          amount: preparedData.amount,
          type: preparedData.type,
          category: preparedData.categoryId,
          subject: selectedCategory.categoryName,
          categoryName: selectedCategory.categoryName,
          description: preparedData.description,
          paymentMethod: preparedData.paymentMethod,
          date: preparedData.date,
          timestamp: new Date().toISOString(),
          ledgerId: preparedData.ledgerId,
          remark: pendingData.subject
        }
      };
      LBK_logInfo(`歸類後記帳成功: ID=${transactionId} [${processId}]`, "記帳執行", inputData.userId, "LBK_handleClassificationPostback");
    } else {
      bookkeepingResult = {
        success: false,
        error: saveResult.error
      };
      LBK_logError(`歸類後記帳失敗: ${saveResult.error} [${processId}]`, "記帳執行", inputData.userId, "BOOKKEEPING_SAVE_ERROR", saveResult.error, "LBK_handleClassificationPostback");
    }

    if (!bookkeepingResult.success) {
      LBK_logError(`歸類後記帳執行失敗: ${bookkeepingResult.error} [${processId}]`, "記帳執行", inputData.userId, "BOOKKEEPING_AFTER_CLASSIFICATION_ERROR", bookkeepingResult.error, "LBK_handleClassificationPostback");

      return {
        success: false,
        message: `科目歸類完成，但記帳失敗：${bookkeepingResult.error}`,
        responseMessage: `科目歸類完成，但記帳失敗：${bookkeepingResult.error}`,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.6.0",
        errorType: "BOOKKEEPING_AFTER_CLASSIFICATION_ERROR"
      };
    }

    // 步驟6：格式化成功回覆訊息
    const successMessage = LBK_formatReplyMessage(bookkeepingResult.data, "LBK", {
      originalInput: `${pendingData.subject}${pendingData.rawAmount}`,
      classificationCompleted: true,
      selectedCategory: selectedCategory.categoryName
    });

    LBK_logInfo(`科目歸類+記帳完整流程成功完成 [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");

    return {
      success: true,
      message: successMessage,
      responseMessage: successMessage,
      moduleCode: "LBK",
      module: "LBK",
      data: bookkeepingResult.data,
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.6.0",
      classificationCompleted: true,
      bookkeepingCompleted: true
    };

  } catch (error) {
    LBK_logError(`科目歸類postback處理失敗: ${error.toString()} [${processId}]`, "科目歸類", inputData.userId, "CLASSIFICATION_POSTBACK_ERROR", error.toString(), "LBK_handleClassificationPostback");

    return {
      success: false,
      message: "科目歸類處理失敗，請稍後再試",
      responseMessage: "科目歸類處理失敗，請稍後再試",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.4.3",
      errorType: "CLASSIFICATION_POSTBACK_ERROR"
    };
  }
}

/**
 * v1.4.2 處理新科目歸類流程 - 修復版：正確儲存記帳資料
 * @version 2025-12-17-V1.4.3
 * @date 2025-12-17 09:30:00
 * @description DCN-0024階段二修復：處理新科目，生成Quick Reply並正確儲存pending記帳資料
 */
async function LBK_handleNewSubjectClassification(originalSubject, parsedData, inputData, processId) {
  try {
    LBK_logInfo(`處理新科目歸類: ${originalSubject} [${processId}]`, "新科目歸類", inputData.userId, "LBK_handleNewSubjectClassification");

    // 生成科目歸類訊息和Quick Reply
    const classificationResult = LBK_buildClassificationMessage(originalSubject, parsedData, processId);

    if (!classificationResult.success) {
      return LBK_formatErrorResponse("CLASSIFICATION_BUILD_ERROR", classificationResult.error);
    }

    // 修復：正確儲存完整的記帳資料到pendingData
    const pendingBookkeepingData = {
      subject: originalSubject,
      amount: parsedData.amount,
      rawAmount: parsedData.rawAmount,
      paymentMethod: parsedData.paymentMethod,
      userId: inputData.userId,
      timestamp: new Date().toISOString(),
      processId: processId,
      originalInput: inputData.messageText,
      // 階段四：將 categoryId, categoryName, majorCode 存入 stageData
      stageData: {
        electedCategory: {
          categoryId: classificationResult.categoryId, // 來自LBK_buildClassificationMessage
          categoryName: classificationResult.categoryName, // 來自LBK_buildClassificationMessage
          // majorCode: classificationResult.categoryId // majorCode removed
        },
        categorySelected: true // 標記科目已選擇
      }
    };

    // v1.4.3修復: 返回包含完整pending資料的Quick Reply回應
    return {
      success: true,
      message: classificationResult.message,
      responseMessage: classificationResult.message,
      quickReply: classificationResult.quickReply,
      moduleCode: "LBK",
      module: "LBK",
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.4.3",
      requiresUserSelection: true,
      pendingData: pendingBookkeepingData
    };

  } catch (error) {
    LBK_logError(`新科目歸類處理失敗: ${error.toString()} [${processId}]`, "新科目歸類", inputData.userId, "NEW_SUBJECT_CLASSIFICATION_ERROR", error.toString(), "LBK_handleNewSubjectClassification");

    return {
      success: false,
      message: "新科目歸類處理失敗，請稍後再試",
      responseMessage: "新科目歸類處理失敗，請稍後再試",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.4.3",
      errorType: "NEW_SUBJECT_CLASSIFICATION_ERROR"
    };
  }
}

/**
 * 處理使用者科目選擇 - v1.4.1 基於0099配置
 * @version 2025-12-16-V1.4.1
 * @description 使用0099.json動態配置處理使用者的科目選擇
 */
async function LBK_processUserSelection(selection, originalSubject, parsedData, inputData, processId) {
  try {
    LBK_logInfo(`處理使用者選擇: ${selection} for ${originalSubject} [${processId}]`, "科目歸類", inputData.userId, "LBK_processUserSelection");

    // 使用動態的科目映射（基於0099.json）
    const categoryMapping = LBK_buildCategoryMapping();
    const selectedCategory = categoryMapping[selection];

    if (!selectedCategory) {
      LBK_logError(`無效的科目選擇: ${selection}，可用選項: ${Object.keys(categoryMapping).join(', ')}`, "科目歸類", inputData.userId, "INVALID_SELECTION", "", "LBK_processUserSelection");
      return {
        success: false,
        error: "無效的科目選擇"
      };
    }

    LBK_logInfo(`選擇科目: ${selectedCategory.categoryId} ${selectedCategory.categoryName} (${selectedCategory.type})`, "科目歸類", inputData.userId, "LBK_processUserSelection");

    // 建立新的科目記錄並儲存到categories集合
    const newCategoryResult = await LBK_saveNewCategoryToFirestore(
      originalSubject,
      selectedCategory,
      inputData.userId,
      processId
    );

    if (!newCategoryResult.success) {
      return {
        success: false,
        error: newCategoryResult.error
      };
    }

    // 階段四：更新Pending Record的stageData
    await LBK_updatePendingRecord(
      inputData.userId,
      parsedData.pendingId, // 從parsedData中獲取pendingId
      {
        stageData: {
          categorySelected: true,
          electedCategory: {
            categoryId: newCategoryResult.categoryId,
            categoryName: selectedCategory.categoryName,
            // majorCode: selectedCategory.categoryId // majorCode removed
          }
        }
      },
      PENDING_STATES.PENDING_CATEGORY, // 保持在PENDING_CATEGORY狀態，等待下一步處理
      processId
    );

    // 繼續完成記帳流程
    const updatedParsedData = {
      ...parsedData,
      categoryId: newCategoryResult.categoryId,
      categoryName: selectedCategory.categoryName,
      // majorCode: selectedCategory.categoryId, // majorCode removed
      action: selectedCategory.type === "income" ? "收入" : "支出",
      paymentMethod: parsedData.paymentMethod // 保持原始解析的支付方式
    };

    const bookkeepingResult = await LBK_executeBookkeeping(updatedParsedData, processId);

    if (bookkeepingResult.success) {
      const confirmationMessage = `已將${originalSubject}歸類至 ${selection} ${selectedCategory.categoryName}\n\n${LBK_formatReplyMessage(bookkeepingResult.data, "LBK", {
        originalInput: originalSubject
      })}`;

      // 階段四：完成Pending Record
      await LBK_updatePendingRecord(
        inputData.userId,
        parsedData.pendingId,
        { completedTransactionId: bookkeepingResult.data.id },
        PENDING_STATES.COMPLETED,
        processId
      );

      return {
        success: true,
        message: confirmationMessage,
        data: bookkeepingResult.data
      };
    } else {
      return {
        success: false,
        error: bookkeepingResult.error
      };
    }

  } catch (error) {
    LBK_logError(`處理使用者選擇失敗: ${error.toString()} [${processId}]`, "科目歸類", inputData.userId, "USER_SELECTION_ERROR", error.toString(), "LBK_processUserSelection");
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 儲存新科目至categories集合 - v1.4.1 基於categoryId
 * @version 2025-12-16-V1.4.1
 * @description 將新歸類的科目儲存至Firestore categories集合
 */
async function LBK_saveNewCategoryToFirestore(originalSubject, selectedCategory, userId, processId) {
  try {
    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    const ledgerId = `user_${userId}`;
    const categoryId = `${selectedCategory.categoryId}${Date.now().toString().slice(-6)}`; // 生成唯一ID

    const newCategoryData = {
      id: categoryId,
      categoryId: categoryId,
      // majorCode: selectedCategory.categoryId, // majorCode removed
      categoryName: selectedCategory.categoryName, // DCN-0024 簡化策略
      name: selectedCategory.categoryName, // DCN-0024 簡化策略
      synonyms: originalSubject, // 將原始輸入作為同義詞
      isActive: true,
      userId: userId,
      ledgerId: ledgerId,
      dataSource: "USER_CLASSIFICATION_LBK",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      module: "LBK",
      version: "1.4.1"
    };

    const docRef = db.collection("ledgers")
      .doc(ledgerId)
      .collection("categories")
      .doc(categoryId);

    await docRef.set(newCategoryData);

    LBK_logInfo(`新科目儲存成功: ${originalSubject} → ${selectedCategory.categoryName} (ID: ${categoryId}) [${processId}]`, "科目歸類", userId, "LBK_saveNewCategoryToFirestore");

    return {
      success: true,
      categoryId: categoryId,
      categoryData: newCategoryData
    };

  } catch (error) {
    LBK_logError(`儲存新科目失敗: ${error.toString()} [${processId}]`, "科目歸類", userId, "SAVE_CATEGORY_ERROR", error.toString(), "LBK_saveNewCategoryToFirestore");
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 載入0099科目配置 - v1.4.1 統一科目管理
 * @version 2025-12-16-V1.4.1
 * @description 統一的0099.json檔案讀取函數，提供完整的科目配置數據
 */
function LBK_load0099SubjectConfig() {
  try {
    const categoryIdPath = path.join(__dirname, '../00. Master_Project document/0099. Subject_code.json');

    if (!fs.existsSync(categoryIdPath)) {
      LBK_logError(`0099.json檔案不存在: ${categoryIdPath}`, "科目配置", "", "CONFIG_FILE_MISSING", "", "LBK_load0099SubjectConfig");
      return null;
    }

    const categoryIdData = JSON.parse(fs.readFileSync(categoryIdPath, 'utf8'));
    LBK_logDebug(`成功載入0099.json，共${categoryIdData.length}筆科目資料`, "科目配置", "", "LBK_load0099SubjectConfig");

    return categoryIdData;

  } catch (error) {
    LBK_logError(`載入0099.json失敗: ${error.toString()}`, "科目配置", "", "CONFIG_LOAD_ERROR", error.toString(), "LBK_load0099SubjectConfig");
    return null;
  }
}

/**
 * 取得LINE記帳主科目清單 - v1.4.1 基於0099配置
 * @version 2025-12-16-V1.4.1
 * @description 從0099.json動態取得適用於LINE記帳的主科目清單
 */
function LBK_getLineMainCategories() {
  try {
    const categoryIdData = LBK_load0099SubjectConfig();

    if (!categoryIdData) {
      LBK_logWarning(`無法載入0099配置，返回空陣列`, "科目配置", "", "LBK_getLineMainCategories");
      return [];
    }

    // DCN-0024 規範：使用0099.json中的categoryId作為主科目ID
    const uniqueCategories = new Map();

    // 從0099.json提取所有有效的主科目
    categoryIdData.forEach(item => {
      if (item.categoryId && item.categoryName) {
        const key = `${item.categoryId}`;        if (!uniqueCategories.has(key)) {
          uniqueCategories.set(key, {
            categoryId: item.categoryId,
            categoryName: item.categoryName
          });
        }
      }
    });

    // 轉換為陣列並排序（數字由小到大）
    const categories = Array.from(uniqueCategories.values())
      .sort((a, b) => a.categoryId - b.categoryId);

    LBK_logInfo(`從0099配置取得${categories.length}個主科目`, "科目配置", "", "LBK_getLineMainCategories");

    return categories;

  } catch (error) {
    LBK_logError(`取得LINE主科目失敗: ${error.toString()}`, "科目配置", "", "GET_CATEGORIES_ERROR", error.toString(), "LBK_getLineMainCategories");
    return [];
  }
}

/**
 * 科目選擇映射表 - v1.4.4 直接使用0099配置
 * @version 2025-12-17-V1.4.4
 * @description 直接從0099.json建立科目選擇映射表，不進行額外映射
 */
function LBK_buildCategoryMapping() {
  try {
    const subjectConfig = LBK_load0099SubjectConfig();
    if (!subjectConfig || !Array.isArray(subjectConfig)) {
      LBK_logWarning(`無法載入0099配置，使用最小映射表`, "科目配置", "", "LBK_buildCategoryMapping");
      return {
        "999": { categoryId: 999, categoryName: "其他", type: "expense" }
      };
    }

    const mapping = {};

    // 直接從0099.json建立科目映射表，不做額外映射
    subjectConfig.forEach(category => {
      if (category.categoryId && category.categoryName) {
        const key = category.categoryId.toString();
        mapping[key] = {
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          type: (category.categoryId === 201) ? "income" : "expense"
        };
      }
    });

    LBK_logDebug(`建立科目映射表，共${Object.keys(mapping).length}個選項 (來源:0099.json)`, "科目配置", "", "LBK_buildCategoryMapping");

    return mapping;

  } catch (error) {
    LBK_logError(`建立科目映射失敗: ${error.toString()}`, "科目配置", "", "BUILD_MAPPING_ERROR", error.toString(), "LBK_buildCategoryMapping");
    return {
      "999": { categoryId: 999, categoryName: "其他", type: "expense" }
    };
  }
}

/**
 * 建立科目歸類選單訊息和Quick Reply - v1.4.3 動態調用0099.json配置
 * @version 2025-12-17-V1.4.3
 * @description 同時生成文字訊息和Quick Reply按鈕陣列，動態從0099.json載入科目選項
 */
function LBK_buildClassificationMessage(originalSubject, parsedData, processId) {
  try {
    // 從0099.json動態載入科目選項
    const subjectConfig = LBK_load0099SubjectConfig();
    if (!subjectConfig || !Array.isArray(subjectConfig)) {
      LBK_logError(`無法載入0099科目配置 [${processId}]`, "科目歸類", "", "CONFIG_LOAD_ERROR", "0099.json載入失敗", "LBK_buildClassificationMessage");
      // 使用備用的最小配置
      const fallbackCategories = [
        { categoryId: 104, categoryName: "餐飲費用" },
        { categoryId: 999, categoryName: "其他" }
      ];
      return LBK_buildClassificationMessageInternal(originalSubject, parsedData, fallbackCategories, processId);
    }

    // 從0099.json提取所有科目並排序
    const dynamicCategories = subjectConfig
      .filter(item => item.categoryId && item.categoryName)
      .sort((a, b) => a.categoryId - b.categoryId);

    return LBK_buildClassificationMessageInternal(originalSubject, parsedData, dynamicCategories, processId);

  } catch (error) {
    LBK_logError(`建立科目歸類選單失敗: ${error.toString()}`, "科目歸類", "", "CLASSIFICATION_MESSAGE_ERROR", error.toString(), "LBK_buildClassificationMessage");

    return {
      success: false,
      error: `系統錯誤：無法建立科目選單 (${error.message})，請稍後再試`
    };
  }
}

/**
 * 內部函數：建立科目歸類訊息和Quick Reply
 * @version 2025-12-17-V1.4.3
 * @description 根據傳入的科目陣列生成選單訊息和Quick Reply按鈕
 */
function LBK_buildClassificationMessageInternal(originalSubject, parsedData, categories, processId) {
  try {
    // 建立文字訊息選項格式
    const classificationOptions = categories.map(category => {
      const id = category.categoryId.toString();
      return `${id} ${category.categoryName}`;
    });

    const message = `您的科目庫無此科目，請問「${originalSubject}」屬於什麼科目？\n\n${classificationOptions.join('\n')}`;

    // 建立符合LINE API格式的Quick Reply按鈕陣列，限制最多13個按鈕
    const maxButtons = 13; // LINE Quick Reply最多支援13個按鈕
    const limitedCategories = categories.slice(0, maxButtons);

    const quickReplyItems = limitedCategories.map(category => {
      const categoryCode = category.categoryId.toString();
      const displayLabel = `${categoryCode} ${category.categoryName}`;

      // 確保label不超過20字符限制
      const truncatedLabel = displayLabel.length > 20 ? displayLabel.substring(0, 17) + "..." : displayLabel;

      return {
        type: "action",
        action: {
          type: "postback",
          label: truncatedLabel,
          // v1.4.3修復：postback data 包含 pendingData
          data: `classify_${category.categoryId}_${JSON.stringify({
            subject: originalSubject,
            amount: parsedData.amount,
            rawAmount: parsedData.rawAmount,
            paymentMethod: parsedData.paymentMethod,
            userId: parsedData.userId,
            originalInput: parsedData.originalInput,
            pendingId: parsedData.pendingId // 階段四：傳遞 pendingId
          })}`,
          displayText: truncatedLabel
        }
      };
    });

    const quickReply = {
      items: quickReplyItems
    };

    LBK_logInfo(`v1.4.3 生成科目歸類選單和Quick Reply，共${limitedCategories.length}個動態選項 (來源:0099.json)`, "科目歸類", "", "LBK_buildClassificationMessage");

    return {
      success: true,
      message: message,
      quickReply: quickReply
    };

  } catch (error) {
    LBK_logError(`建立科目歸類選單失敗: ${error.toString()}`, "科目歸類", "", "CLASSIFICATION_MESSAGE_ERROR", error.toString(), "LBK_buildClassificationMessage");

    return {
      success: false,
      error: `系統錯誤：無法建立科目選單 (${error.message})，請稍後再試`
    };
  }
}

/**
 * 階段四新增：處理科目選擇完成後的流程
 * @version 2025-12-19-V1.4.9
 * @param {object} classificationResult - 分類結果包含pendingData
 * @param {string} processId - 處理ID
 * @returns {Object} 處理結果
 */
async function LBK_handleSubjectSelectionComplete(classificationResult, processId) {
  try {
    const { categoryId, pendingData } = classificationResult;
    const userId = pendingData.userId;

    LBK_logInfo(`處理科目選擇完成: categoryId=${categoryId}, pendingId=${pendingData.pendingId} [${processId}]`, "狀態機", userId, "LBK_handleSubjectSelectionComplete");

    // 獲取科目詳細信息
    const subjectConfig = LBK_load0099SubjectConfig();
    const categoryMapping = LBK_buildCategoryMapping();
    const selectedCategory = categoryMapping[categoryId];

    if (!selectedCategory) {
      throw new Error(`無效的科目ID: ${categoryId}`);
    }

    // 更新Pending Record的stageData
    await LBK_updatePendingRecord(
      userId,
      pendingData.pendingId,
      {
        stageData: {
          categorySelected: true,
          electedCategory: {
            categoryId: categoryId,
            categoryName: selectedCategory.categoryName,
            // majorCode: selectedCategory.categoryId // majorCode removed
          }
        }
      },
      PENDING_STATES.PENDING_CATEGORY, // 保持在PENDING_CATEGORY狀態，等待下一步處理
      processId
    );

    // 建立同義詞關聯
    await LBK_addSubjectSynonym(pendingData.subject, categoryId, selectedCategory.categoryName, userId, processId);

    // 推進流程，檢查是否需要選擇錢包
    return await LBK_advancePendingFlow(userId, pendingData.pendingId, processId);

  } catch (error) {
    LBK_logError(`處理科目選擇完成失敗: ${error.toString()} [${processId}]`, "狀態機", pendingData?.userId || "", "SUBJECT_SELECTION_COMPLETE_ERROR", error.toString(), "LBK_handleSubjectSelectionComplete");
    return {
      success: false,
      error: error.toString()
    };
  }
}


/**
 * 階段四新增：根據用戶選擇的支付方式類型，更新Pending Record狀態
 * @version 2025-12-19-V1.4.9
 * @param {string} userId - 用戶ID
 * @param {string} pendingId - Pending Record ID
 * @param {string} selectedWalletType - 用戶選擇的錢包類型 (cash, debit, credit)
 * @param {string} processId - 處理ID
 * @returns {Object} 更新結果
 */
async function LBK_handleWalletTypeSelection(userId, pendingId, selectedWalletType, processId) {
  const functionName = "LBK_handleWalletTypeSelection";
  try {
    LBK_logInfo(`階段四：處理支付方式類型選擇: type=${selectedWalletType}, pendingId=${pendingId} [${processId}]`, "狀態機", userId, functionName);

    // 獲取Pending Record資料
    const pendingRecordResult = await LBK_getPendingRecord(userId, pendingId, processId);
    if (!pendingRecordResult.success) {
      throw new Error(pendingRecordResult.error);
    }
    const pendingData = pendingRecordResult.data;

    // 階段五修復：完全移除硬編碼，使用動態查詢機制
    let resolvedWallet = null;

    // 階段五修復：動態查詢對應的錢包
    const walletTypeMapping = {
      'cash': ['現金', 'cash'],
      'debit': ['銀行轉帳', '銀行', 'debit'],
      'credit': ['信用卡', '信用', 'credit']
    };

    const possibleNames = walletTypeMapping[selectedWalletType];
    if (!possibleNames) {
      throw new Error(`階段五：未知的錢包類型: ${selectedWalletType}`);
    }

    // 階段五修復：動態查詢匹配的錢包
    for (const walletName of possibleNames) {
      const dynamicWallet = await LBK_getWalletByName(walletName, userId, processId);
      if (dynamicWallet && dynamicWallet.walletId) {
        resolvedWallet = {
          walletId: dynamicWallet.walletId,
          walletName: dynamicWallet.walletName,
          type: selectedWalletType
        };
        LBK_logInfo(`階段五：動態查詢成功匹配錢包: ${walletName} → ${resolvedWallet.walletName} [${processId}]`, "狀態機", userId, functionName);
        break;
      }
    }

    // 階段五修復：如果動態查詢失敗，返回錯誤
    if (!resolvedWallet) {
      throw new Error(`階段五：動態查詢未找到類型為 ${selectedWalletType} 的錢包`);
    }

    // 更新Pending Record的stageData
    const updateResult = await LBK_updatePendingRecord(
      userId,
      pendingId,
      {
        stageData: {
          walletSelected: true,
          selectedWallet: resolvedWallet
        }
      },
      PENDING_STATES.PENDING_WALLET, // 保持在PENDING_WALLET狀態，因為下一步是完整記帳
      processId
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error);
    }

    // 階段三修復：執行同義詞學習，使用錢包類型而非硬編碼ID
    // 獲取原始輸入中的支付方式名稱
    const paymentMethodName = LBK_extractPaymentMethodFromInput(pendingData.originalInput, processId);
    if (paymentMethodName) {
      const synonymsResult = await LBK_executeWalletSynonymsUpdate(
        paymentMethodName,
        selectedWalletType, // 階段三修復：使用錢包類型而非硬編碼ID
        userId,
        processId
      );
      if (!synonymsResult.success) {
        LBK_logWarning(`階段三：執行wallet synonyms更新失敗: ${synonymsResult.error} [${processId}]`, "同義詞學習", userId, functionName);
      } else {
        LBK_logInfo(`階段三：同義詞學習完成: ${paymentMethodName} → ${synonymsResult.targetWalletName} [${processId}]`, "同義詞學習", userId, functionName);
      }
    }

    // 推進流程，完成記帳
    const completionResult = await LBK_completePendingRecord(userId, pendingId, processId);

    // 階段四：在成功回覆中提及同義詞學習
    if (completionResult.success && paymentMethodName) {
      const originalMessage = completionResult.message || "記帳成功";
      const enhancedMessage = originalMessage + `\n\n💡 系統已學習支付方式「${paymentMethodName}」，下次輸入相同方式將自動識別`;

      return {
        ...completionResult,
        message: enhancedMessage,
        responseMessage: enhancedMessage,
        moduleVersion: "1.7.0", // 更新版本號
        synonymsLearned: true
      };
    }

    return completionResult;

  } catch (error) {
    LBK_logError(`階段四：處理支付方式類型選擇失敗: ${error.toString()} [${processId}]`, "狀態機", userId, "WALLET_TYPE_SELECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 階段四新增：生成支付方式選擇 Quick Reply
 * @version 2025-12-19-V1.4.9
 * @param {string} pendingId - Pending Record ID
 * @returns {object} Quick Reply 配置
 */
function LBK_generateWalletSelectionQuickReply(pendingId) {
  try {
    return {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '💵 現金',
            data: `wallet_type_cash_${pendingId}`,
            displayText: '選擇現金'
          }
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🏦 銀行轉帳',
            data: `wallet_type_debit_${pendingId}`,
            displayText: '選擇銀行轉帳'
          }        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '💳 信用卡',
            data: `wallet_type_credit_${pendingId}`,
            displayText: '選擇信用卡'
          }
        }
      ]
    };
  } catch (error) {
    LBK_logError(`生成支付方式選擇 Quick Reply 失敗: ${error.toString()}`, "Quick Reply", "", "WALLET_QR_GEN_ERROR", error.toString(), "LBK_generateWalletSelectionQuickReply");
    return {}; // 返回空物件以避免錯誤
  }
}


/**
 * 階段三：原子性完成記帳 - 只記錄created和completed狀態
 * @version 2025-12-24-V3.0.0
 * @param {string} userId - 用戶ID
 * @param {string} pendingId - Session ID
 * @param {string} processId - 處理ID
 * @returns {Object} 轉換結果
 * @description 階段三：原子性操作，跳過中間狀態，只寫入最終結果
 */
async function LBK_completePendingRecord(userId, pendingId, processId) {
  const functionName = "LBK_completePendingRecord";
  try {
    // 階段三：從記憶體獲取完整Session資料
    const sessionResult = await LBK_getPendingRecord(userId, pendingId, processId);
    if (!sessionResult.success) {
      throw new Error(`階段三：Session獲取失敗: ${sessionResult.error}`);
    }

    const sessionData = sessionResult.data;
    const pendingData = sessionData;
    const ledgerId = `user_${userId}`;
    const stageData = sessionData.stageData || {};
    const ambiguityData = sessionData.ambiguityData || {};

    LBK_logInfo(`階段四：開始完成Pending Record，科目已選: ${stageData.categorySelected}, 錢包已選: ${stageData.walletSelected} [${processId}]`, "記帳完成", userId, functionName);

    // 階段三修復：構建最終記帳資料，優先使用已選擇的資訊，並驗證所有必要欄位
    const finalBookkeepingData = {
      ...(pendingData.parsedData || {}),
      userId: userId,
      ledgerId: ledgerId
    };

    // 階段一修復：強化科目資訊驗證，支援多種欄位名稱格式
    LBK_logInfo(`階段一修復：開始驗證科目資訊 - stageData: ${JSON.stringify(stageData)} [${processId}]`, "記帳完成", userId, functionName);

    const electedCategory = stageData.electedCategory;
    const categorySelected = stageData.categorySelected;

    if (electedCategory && categorySelected) {
      // 階段一修復：支援多種科目欄位名稱格式，確保相容性
      const categoryId = electedCategory.categoryId || electedCategory.categoryId;
      const categoryName = electedCategory.categoryName || electedCategory.name;
      // const majorCode = electedCategory.majorCode || selectedCategory.categoryId; // majorCode removed

      LBK_logInfo(`階段一修復：科目欄位提取結果 - categoryId: ${categoryId}, categoryName: ${categoryName} [${processId}]`, "記帳完成", userId, functionName);

      if (categoryId && categoryName) {
        finalBookkeepingData.categoryId = categoryId;
        finalBookkeepingData.categoryName = categoryName;
        // finalBookkeepingData.majorCode = majorCode; // majorCode removed

        // 根據科目代碼判斷收支類型，增加容錯處理
        const codeToCheck = String(categoryId || '1'); // Use categoryId as fallback
        const isIncome = codeToCheck.startsWith('2');
        finalBookkeepingData.action = isIncome ? "收入" : "支出";

        LBK_logInfo(`階段一修復：科目資料驗證完成: ${categoryName} (代碼: ${categoryId}) [${processId}]`, "記帳完成", userId, functionName);
      } else {
        // 階段一修復：科目資料不完整時拋出詳細錯誤，便於調試
        LBK_logError(`階段一修復：科目資料不完整詳細資訊 - electedCategory: ${JSON.stringify(electedCategory)}, 提取結果: categoryId=${categoryId}, categoryName=${categoryName} [${processId}]`, "記帳完成", userId, "SUBJECT_DATA_INCOMPLETE", "科目資料缺少必要欄位", functionName);
        throw new Error(`階段一修復：Pending Record 科目資料不完整: categoryId=${categoryId}, categoryName=${categoryName}`);
      }
    } else {
      // 階段一修復：提供詳細的調試資訊，便於排查問題
      LBK_logError(`階段一修復：科目選擇狀態檢查失敗 - electedCategory存在: ${!!electedCategory}, categorySelected: ${categorySelected}, stageData完整內容: ${JSON.stringify(stageData)} [${processId}]`, "記帳完成", userId, "MISSING_SUBJECT_INFO", "科目資訊缺失", functionName);
      throw new Error(`階段一修復：Pending Record 缺少科目資訊，electedCategory: ${!!electedCategory}, categorySelected: ${categorySelected} (違反0098規範)`);
    }

    // 階段五修復：動態驗證並設置錢包資訊，移除硬編碼
    if (stageData.selectedWallet && stageData.walletSelected) {
      const walletName = stageData.selectedWallet.walletName || '動態查詢錢包';
      const walletId = stageData.selectedWallet.walletId || 'dynamic_wallet';

      finalBookkeepingData.paymentMethod = walletName;
      finalBookkeepingData.walletId = walletId;

      LBK_logInfo(`階段五：錢包資料驗證完成: ${walletName} (ID: ${walletId}) [${processId}]`, "記帳完成", userId, functionName);
    } else {
      // 階段一修復：使用統一邏輯入口點，移除硬編碼fallback值
      const dynamicDefaultResult = await LBK_getDefaultPaymentMethod(userId, processId);
      if (dynamicDefaultResult.success) {
        finalBookkeepingData.paymentMethod = dynamicDefaultResult.walletName;
        finalBookkeepingData.walletId = dynamicDefaultResult.walletId;
        LBK_logInfo(`階段一：統一邏輯入口點查詢預設錢包成功: ${dynamicDefaultResult.walletName} [${processId}]`, "記帳完成", userId, functionName);
      } else {
        finalBookkeepingData.paymentMethod = finalBookkeepingData.paymentMethod || '信用卡';
        finalBookkeepingData.walletId = 'credit';
        LBK_logWarning(`階段一：統一邏輯入口點查詢失敗，使用系統安全網: 信用卡 [${processId}]`, "記帳完成", userId, functionName);
      }
    }

    // 階段三新增：驗證其他核心欄位，防止undefined值
    finalBookkeepingData.amount = parseFloat(finalBookkeepingData.amount) || 0;
    finalBookkeepingData.subject = finalBookkeepingData.subject || pendingData.parsedData?.subject || '記帳項目';

    // 階段三新增：記錄最終驗證結果
    LBK_logInfo(`階段三：最終記帳資料驗證 - 金額: ${finalBookkeepingData.amount}, 科目: ${finalBookkeepingData.categoryName}, 支付方式: ${finalBookkeepingData.paymentMethod} [${processId}]`, "記帳完成", userId, functionName);

    // 階段四修復：直接進行記帳，跳過 LBK_executeBookkeeping 中的重複科目查詢
    const transactionId = Date.now().toString();
    const now = moment().tz(LBK_CONFIG.TIMEZONE);

    // 階段三：分離核心與輔助元數據，只保留必要追溯資訊
    const coreTransactionData = {
      // 核心欄位 - 符合0070規範
      id: transactionId,
      amount: parseFloat(finalBookkeepingData.amount) || 0,
      type: (finalBookkeepingData.action === "收入") ? "income" : "expense",
      description: finalBookkeepingData.description || '記帳項目',
      categoryId: finalBookkeepingData.categoryId || 'default',

      // 時間欄位 - 0070標準格式
      date: now.format('YYYY-MM-DD'),
      createdAt: admin.firestore.Timestamp.now(),

      // 來源和用戶資訊 - 0070標準
      source: 'memory_completion',
      userId: userId,
      paymentMethod: finalBookkeepingData.paymentMethod || '信用卡',
      ledgerId: ledgerId,

      // 階段三：原子性狀態 - 直接設為completed
      status: 'completed',

      // 階段三：核心元數據，只保留必要追溯資訊
      metadata: {
        module: 'LBK',
        version: '3.0.0',
        completionSource: 'atomic_operation',
        memorySession: true
      }
    };

    // 階段三：輔助元數據，將批次寫入（稍後處理）
    const auxiliaryMetadata = {
      transactionId: transactionId,
      processId: processId,
      pendingId: pendingId,
      categoryName: finalBookkeepingData.categoryName,
      originalInput: sessionData.originalInput,
      processingTime: Date.now() - (sessionData.coreMetadata?.createdAt || Date.now()),
      ambiguityResolved: !!ambiguityData.resolved,
      detailedValidation: {
        amountValidated: !isNaN(parseFloat(finalBookkeepingData.amount)),
        subjectValidated: !!finalBookkeepingData.categoryName,
        paymentMethodValidated: !!finalBookkeepingData.paymentMethod
      }
    };

    // 階段三新增：記帳前最終驗證日誌
    LBK_logInfo(`階段三：Firestore記帳資料最終驗證 - ID: ${coreTransactionData.id}, 金額: ${coreTransactionData.amount}, 類型: ${coreTransactionData.type}, 科目: ${coreTransactionData.metadata.categoryName}, categoryId: ${coreTransactionData.categoryId} [${processId}]`, "記帳完成", userId, functionName);

    LBK_logInfo(`階段四：直接執行記帳儲存，跳過重複科目查詢 [${processId}]`, "記帳完成", userId, functionName);

    // 階段三：原子性儲存核心記帳資料
    const saveResult = await LBK_saveToFirestore(coreTransactionData, processId);

    if (!saveResult.success) {
      throw new Error(`階段三：原子性記帳儲存失敗: ${saveResult.error}`);
    }

    // 階段三：排程輔助元數據批次寫入（非阻塞）
    LBK_scheduleAuxiliaryDataWrite(transactionId, auxiliaryMetadata, userId, processId);

    // 階段三修復：構建記帳結果資料，確保所有欄位都有有效值
    const bookkeepingData = {
      id: transactionId,
      transactionId: transactionId,
      amount: coreTransactionData.amount,
      type: coreTransactionData.type,
      category: coreTransactionData.categoryId || 'default',
      subject: finalBookkeepingData.categoryName || coreTransactionData.description || '記帳項目',
      categoryName: finalBookkeepingData.categoryName || coreTransactionData.description || '記帳項目',
      description: coreTransactionData.description || '記帳項目',
      paymentMethod: coreTransactionData.paymentMethod || '刷卡',
      date: coreTransactionData.date,
      timestamp: new Date().toISOString(),
      ledgerId: coreTransactionData.ledgerId || `user_${userId}`,
      remark: pendingData.parsedData?.subject || coreTransactionData.description || '記帳項目',
      // 階段三新增：額外驗證欄位
      // majorCode: finalBookkeepingData.majorCode || 'default', // majorCode removed
      validated: true
    };

    // 階段三新增：記帳結果驗證日誌
    LBK_logInfo(`階段三：記帳結果資料構建完成 - 所有欄位已驗證無undefined值 [${processId}]`, "記帳完成", userId, functionName);

    // 階段三：立即清理記憶體Session（原子性完成）
    if (LBK_CONFIG.MEMORY_SESSIONS) {
      LBK_CONFIG.MEMORY_SESSIONS.delete(pendingId);
      LBK_logDebug(`階段三：記憶體Session清理完成: ${pendingId} [${processId}]`, "記憶體管理", userId, functionName);
    }

    LBK_logInfo(`階段四：Pending Record 記帳完成: ${pendingId} → ${transactionId} [${processId}]`, "記帳完成", userId, functionName);

    return {
      success: true,
      action: 'transaction_completed',
      transactionId: transactionId,
      bookkeepingData: bookkeepingData,
      message: LBK_formatReplyMessage(bookkeepingData, "LBK", {
        originalInput: pendingData.originalInput
      }),
      responseMessage: LBK_formatReplyMessage(bookkeepingData, "LBK", {
        originalInput: pendingData.originalInput
      })
    };

  } catch (error) {
    LBK_logError(`階段四：完成Pending Record失敗: ${error.toString()} [${processId}]`, "記帳完成", userId, "PENDING_COMPLETE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString(),
      message: "記帳完成失敗，請稍後再試",
      responseMessage: "記帳完成失敗，請稍後再試"
    };
  }
}

/**
 * 階段五新增：初始化 pendingTransactions 子集合
 * @version 2025-12-19-V1.5.0
 * @param {string} userLedgerId - 用戶帳本ID
 * @param {object} context - 上下文資訊，包含 userId
 * @param {object} options - 選項，支援 createStructure 等
 * @returns {Promise<Object>} 初始化結果
 * @description 階段五：為用戶建立 pendingTransactions 子集合基礎結構，類似 WCM 模組的批量初始化機制
 */
async function LBK_initializePendingTransactionsSubcollection(userLedgerId, context, options = {}) {
  const functionName = "LBK_initializePendingTransactionsSubcollection";
  try {
    LBK_logInfo(`開始初始化 pendingTransactions 子集合: ${userLedgerId}`, "子集合初始化", context.userId, functionName);

    if (!userLedgerId || !context.userId) {
      throw new Error("userLedgerId 和 context.userId 為必填參數");
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    // 檢查是否已經初始化
    const existingInit = await db
      .collection('ledgers')
      .doc(userLedgerId)
      .collection('pendingTransactions')
      .doc('_init')
      .get();

    if (existingInit.exists) {
      LBK_logInfo(`pendingTransactions 子集合已存在: ${userLedgerId}`, "子集合初始化", context.userId, functionName);
      return {
        success: true,
        data: {
          alreadyExists: true,
          subcollectionCreated: false,
          message: "pendingTransactions 子集合已存在"
        }
      };
    }

    // 建立初始化文檔，確保子集合存在
    const initDocData = {
      initialized: true,
      createdAt: admin.firestore.Timestamp.now(),
      userId: context.userId,
      ledgerId: userLedgerId,
      module: "LBK",
      version: "v1.5.0",
      note: "Initial document to ensure pendingTransactions subcollection exists",
      configVersion: "0305",
      structure: {
        stateTransitions: ["PENDING_CATEGORY", "PENDING_WALLET", "COMPLETED", "CANCELLED"],
        defaultExpirationMinutes: 30,
        autoCleanupEnabled: true
      }
    };

    await db
      .collection('ledgers')
      .doc(userLedgerId)
      .collection('pendingTransactions')
      .doc('_init')
      .set(initDocData);

    LBK_logInfo(`pendingTransactions 子集合初始化完成: ${userLedgerId}`, "子集合初始化", context.userId, functionName);

    return {
      success: true,
      data: {
        subcollectionCreated: true,
        initDocId: "_init",
        structure: initDocData.structure,
        message: "pendingTransactions 子集合初始化成功"
      }
    };

  } catch (error) {
    LBK_logError(`初始化 pendingTransactions 子集合失敗: ${error.toString()}`, "子集合初始化", context.userId, "INIT_PENDING_SUBCOLLECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * 階段四新增：推進Pending Record流程
 * @version 2025-12-19-V1.4.9
 * @param {string} userId - 用戶ID
 * @param {string} pendingId - Pending Record ID
 * @param {string} processId - 處理ID
 * @returns {Object} 推進結果
 * @description 檢查Pending Record當前狀態，並推進到下一階段處理
 */
async function LBK_advancePendingFlow(userId, pendingId, processId) {
  const functionName = "LBK_advancePendingFlow";
  try {
    LBK_logInfo(`推進Pending Record流程: pendingId=${pendingId} [${processId}]`, "狀態機", userId, functionName);

    // 獲取Pending Record的當前狀態
    const pendingRecordResult = await LBK_getPendingRecord(userId, pendingId, processId);
    if (!pendingRecordResult.success) {
      throw new Error(pendingRecordResult.error);
    }

    const pendingData = pendingRecordResult.data;
    const currentStage = pendingData.processingStage;
    const stageData = pendingData.stageData || {};

    LBK_logInfo(`當前狀態: ${currentStage}, 科目已選: ${stageData.categorySelected}, 錢包已選: ${stageData.walletSelected} [${processId}]`, "狀態機", userId, functionName);

    // 根據當前狀態決定下一步動作
    if (currentStage === PENDING_STATES.PENDING_CATEGORY) {
      // 如果科目已選，檢查是否需要選擇錢包
      if (stageData.categorySelected) {
        // 檢查支付方式是否需要歧義消除
        // 更新調用：替換 LBK_parsePaymentMethod 為 LBK_validateWalletExists
        const parseResult3 = LBK_parseInputFormat(pendingData.originalInput, processId);
        const walletResult = await LBK_validateWalletExists(userId, null, parseResult3?.paymentMethod, processId);

        if (walletResult.requiresUserConfirmation) {
          // 轉入錢包選擇狀態
          await LBK_updatePendingRecord(
            userId,
            pendingId,
            {},
            PENDING_STATES.PENDING_WALLET,
            processId
          );

          // 返回錢包選擇介面
          return await LBK_handleNewWallet(
            walletResult.walletName,
            { ...pendingData.parsedData, pendingId: pendingId },
            { userId: userId, messageText: pendingData.originalInput },
            processId
          );
        } else {
          // 支付方式明確，直接完成記帳
          return await LBK_completePendingRecord(userId, pendingId, processId);
        }
      } else {
        // 科目未選，需要用戶選擇科目
        return {
          success: false,
          error: "科目尚未選擇，請先選擇科目",
          action: "requires_subject_selection"
        };
      }
    } else if (currentStage === PENDING_STATES.PENDING_WALLET) {
      // 如果錢包已選，完成記帳
      if (stageData.walletSelected) {
        return await LBK_completePendingRecord(userId, pendingId, processId);
      } else {
        // 錢包未選，需要用戶選擇錢包
        return {
          success: false,
          error: "支付方式尚未選擇，請先選擇支付方式",
          action: "requires_wallet_selection"
        };
      }
    } else if (currentStage === PENDING_STATES.COMPLETED) {
      // 已完成，無需進一步處理
      return {
        success: true,
        message: "記帳已完成",
        action: "already_completed"
      };
    }

    // 未知狀態
    return {
      success: false,
      error: `未知的處理狀態: ${currentStage}`,
      action: "unknown_state"
    };

  } catch (error) {
    LBK_logError(`推進Pending Record流程失敗: ${error.toString()} [${processId}]`, "狀態機", userId, "ADVANCE_PENDING_FLOW_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 更新模組導出，添加新的初始化函數
module.exports = {
  LBK_processQuickBookkeeping: LBK_processQuickBookkeeping,
  LBK_parseUserMessage: LBK_parseUserMessage,
  LBK_parseInputFormat: LBK_parseInputFormat,
  LBK_extractAmount: LBK_extractAmount,
  LBK_getcategoryId: LBK_getcategoryId, // Deprecated: LBK_identifySubject
  LBK_fuzzyMatch: LBK_fuzzyMatch,
  LBK_getAllSubjects: LBK_getAllSubjects,
  LBK_executeBookkeeping: LBK_executeBookkeeping,
  LBK_generateBookkeepingId: LBK_generateBookkeepingId,
  LBK_validateBookkeepingData: LBK_validateBookkeepingData,
  LBK_saveToFirestore: LBK_saveToFirestore,
  LBK_prepareBookkeepingData: LBK_prepareBookkeepingData,
  LBK_formatReplyMessage: LBK_formatReplyMessage,
  LBK_removeAmountFromText: LBK_removeAmountFromText,
  LBK_initialize: LBK_initialize,
  // 階段五新增：子集合初始化函數
  LBK_initializePendingTransactionsSubcollection: LBK_initializePendingTransactionsSubcollection,
  LBK_handleError: LBK_handleError,
  LBK_calculateStringSimilarity: LBK_calculateStringSimilarity,

  // 統計查詢函數 - v1.3.0新增
  LBK_checkStatisticsKeyword: LBK_checkStatisticsKeyword,
  LBK_handleStatisticsRequest: LBK_handleStatisticsRequest,
  LBK_buildStatisticsQuickReply: LBK_buildStatisticsQuickReply,
  LBK_processDirectStatistics: LBK_processDirectStatistics,
  LBK_getDirectStatistics: LBK_getDirectStatistics,
  LBK_formatStatisticsMessage: LBK_formatStatisticsMessage,

  // 輔助函數
  LBK_extractPaymentMethodFromInput: LBK_extractPaymentMethodFromInput,
  LBK_initializeFirestore: LBK_initializeFirestore,

  // 新增支付方式解析函數
  LBK_parsePaymentMethod: LBK_parsePaymentMethod,
  // 階段一新增：動態預設支付方式查詢函數
  LBK_getDefaultPaymentMethod: LBK_getDefaultPaymentMethod,
  // 新增wallet確認postback處理函數 v1.4.5
  LBK_handleWalletConfirmationPostback: LBK_handleWalletConfirmationPostback,
  LBK_processConfirmedWallet: LBK_processConfirmedWallet,

  LBK_validateWalletExists: LBK_validateWalletExists,
  LBK_handleNewWallet: LBK_handleNewWallet, // Kept for backward compatibility, though now LBK_handleWalletConfirmationPostback is the primary handler

  // 新科目歸類函數 - v1.4.2增強（支援Quick Reply和postback處理）
  LBK_handleNewSubjectClassification: LBK_handleNewSubjectClassification,
  LBK_handleClassificationPostback: LBK_handleClassificationPostback,
  LBK_buildClassificationMessage: LBK_buildClassificationMessage,
  LBK_buildClassificationMessageInternal: LBK_buildClassificationMessageInternal,
  LBK_processUserSelection: LBK_processUserSelection,
  LBK_saveNewCategoryToFirestore: LBK_saveNewCategoryToFirestore,

  // 0099科目配置調用函數 - v1.4.1新增
  LBK_load0099SubjectConfig: LBK_load0099SubjectConfig,
  LBK_getLineMainCategories: LBK_getLineMainCategories,
  LBK_buildCategoryMapping: LBK_buildCategoryMapping,

  // 新增同義詞管理函數
  LBK_addSubjectSynonym: LBK_addSubjectSynonym,

  // 新增wallet驗證函數 - v1.4.4
  LBK_validateWalletExists: LBK_validateWalletExists,
  LBK_handleNewWallet: LBK_handleNewWallet, // Kept for backward compatibility, though now LBK_handleWalletConfirmationPostback is the primary handler

  // 階段一新增：wallet類型postback識別函數 - v1.4.7
  LBK_isWalletTypePostback: LBK_isWalletTypePostback,

  // 階段三新增：wallet synonyms更新函數 - v1.4.8
  LBK_updateWalletSynonyms: LBK_updateWalletSynonyms,
  LBK_executeWalletSynonymsUpdate: LBK_executeWalletSynonymsUpdate,
  LBK_getWalletDisplayName: LBK_getWalletDisplayName,

  // 階段二新增：Pending Record 函數
  LBK_createPendingRecord,
  LBK_updatePendingRecord,
  LBK_getPendingRecord,
  LBK_processPendingToTransaction: LBK_completePendingRecord, // Rename for phase 4
  LBK_handleSubjectSelectionComplete, // Exported for phase 4 integration

  // 階段四新增：狀態機相關函數
  LBK_advancePendingFlow,
  LBK_completePendingRecord, // Now handles the final transaction completion
  LBK_generateWalletSelectionQuickReply,
  LBK_handleWalletTypeSelection, // Exported for phase 4 integration

  // PENDING_STATES constants for the state machine
  PENDING_STATES,

  // 版本資訊
  MODULE_VERSION: "3.0.0", // 階段三：優化狀態管理版本
  MODULE_NAME: "LBK",
  MODULE_UPDATE: "階段三優化狀態管理完成：1)PendingTransactions機制改善：歧義消除過程完全在記憶體中進行，只在用戶確定選擇時寫入最終結果，移除所有中間狀態寫入。2)Metadata記錄精簡：將元數據分為核心與輔助兩類，輔助資料改為批次寫入，核心交易只保留必要追溯資訊。3)事務狀態優化：處理狀態改為原子性操作，移除processing、validation等中間狀態，只記錄memory_active和completed狀態。預期效果：每筆記帳寫入量降至5-10筆，大幅減少Firestore寫入量60-80筆。"
};