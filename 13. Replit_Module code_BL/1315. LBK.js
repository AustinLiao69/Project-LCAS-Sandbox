/**
 * LBK_快速記帳模組_1.4.7
 * @module LBK模組
 * @description LINE OA 專用快速記帳處理模組 - DCN-0024階段一：實作LBK_updateWalletSynonyms函數，確保記帳流程完整
 * @update 2025-12-18: 升級至v1.4.7，實作LBK_updateWalletSynonyms函數，補全缺失的wallet synonyms更新邏輯
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

// 引入依賴模組
const DL = require('./1310. DL.js');

// 引入SR模組 (保留用於其他非統計功能，如推播服務等)
let SR = null;
try {
  SR = require('./1305. SR.js');
} catch (error) {
  console.warn('LBK模組: SR模組載入失敗，部分進階功能將受限:', error.message);
}

// 配置參數
const LBK_CONFIG = {
  DEBUG: true,
  LOG_LEVEL: "DEBUG",
  FIRESTORE_ENABLED: 'true',
  TIMEZONE: "Asia/Taipei",
  TEXT_PROCESSING: {
    ENABLE_SMART_PARSING: true,
    MIN_AMOUNT_DIGITS: 3,
    MAX_REMARK_LENGTH: 20
  },
  // 新增預設支付方式配置
  DEFAULT_PAYMENT_METHOD: "現金",
  // 新增 cache 配置
  CACHE_CONFIG: {
    stdTTL: 600, // 10 minutes
    checkPeriod: 120 // Check every 2 minutes
  }
};

// 初始化快取實例
const cacheInstance = new cache(LBK_CONFIG.CACHE_CONFIG);

// 初始化狀態追蹤
let LBK_INIT_STATUS = {
  lastInitTime: 0,
  initialized: false,
  DL_initialized: false,
  firestore_db: null
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

      // 解析 postback 資料
      const postbackParts = inputData.messageText.split('_');
      if (postbackParts.length >= 3) {
        const subjectId = postbackParts[1];
        const jsonPart = postbackParts.slice(2).join('_');

        try {
          const pendingData = JSON.parse(jsonPart);

          // 構建分類資料
          const classificationData = {
            success: true,
            subjectId: subjectId,
            pendingData: pendingData
          };

          // 構建分類輸入資料
          const classificationInput = {
            ...inputData,
            eventType: 'classification_postback',
            classificationData: classificationData
          };

          return await LBK_handleClassificationPostback(classificationInput, processId);
        } catch (jsonError) {
          LBK_logError(`解析postback JSON失敗: ${jsonError.message} [${processId}]`, "科目歸類", userId, "JSON_PARSE_ERROR", jsonError.toString(), "LBK_processQuickBookkeeping");
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

    // 第二步：執行記帳處理邏輯
    LBK_logInfo(`執行記帳處理流程 [${processId}]`, "快速記帳", userId || "", "LBK_processQuickBookkeeping");

    // 解析用戶訊息
    const parseResult = await LBK_parseUserMessage(inputData.messageText, userId, processId);

    if (!parseResult.success) {
      // 檢查是否需要新科目歸類
      if (parseResult.requiresClassification) {
        LBK_logInfo(`觸發新科目歸類流程: ${parseResult.originalSubject} [${processId}]`, "新科目歸類", userId, "LBK_processQuickBookkeeping");
        return await LBK_handleNewSubjectClassification(parseResult.originalSubject, parseResult.parsedData, inputData, processId);
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

    // 解析支付方式（使用動態錢包查詢）
    const paymentMethodResult = await LBK_parsePaymentMethod(inputData.messageText, userId, processId);
    const paymentMethod = paymentMethodResult.method;
    const walletId = paymentMethodResult.walletId;
    const walletName = paymentMethodResult.walletName;

    // 階段二：驗證wallet存在性
    const walletValidationResult = await LBK_validateWalletExists(userId, walletId, walletName, processId);

    if (!walletValidationResult.success) {
      // 檢查是否需要新wallet確認流程
      if (walletValidationResult.requiresUserConfirmation) {
        LBK_logInfo(`觸發新wallet確認流程: ${walletName} [${processId}]`, "wallet驗證", userId, "LBK_processQuickBookkeeping");
        return await LBK_handleNewWallet(walletName, parseResult.data, inputData, processId);
      }

      const errorMessage = walletValidationResult.error || "wallet驗證失敗";
      const formattedErrorMessage = LBK_formatReplyMessage(null, "LBK", {
        originalInput: inputData.messageText,
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
        moduleVersion: "1.4.4",
        errorType: walletValidationResult.errorType || "WALLET_VALIDATION_ERROR"
      };
    }

    // 使用驗證過的wallet資訊更新記帳資料
    parseResult.data.paymentMethod = walletValidationResult.walletName;
    parseResult.data.walletId = walletValidationResult.walletId;
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

    // 記帳成功後，更新wallet synonyms
    console.log(`✅ wallet確認後記帳成功: ${bookkeepingResult.data.transactionId}`);

    try {
      // 更新wallet synonyms - 將原始支付方式名稱加入synonyms
      const synonymsUpdateResult = await LBK_updateWalletSynonyms(
        `user_${userId}`, // ledgerId
        walletValidationResult.walletId, // Use the validated walletId
        walletName // originalPaymentMethod is the name detected from input text
      );

      if (synonymsUpdateResult.success) {
        LBK_logInfo(`wallet synonyms更新成功: ${walletName} -> ${walletValidationResult.walletId}`, "LBK_processQuickBookkeeping");
      } else {
        LBK_logWarning(`wallet synonyms更新失敗: ${synonymsUpdateResult.message}`, "LBK_processQuickBookkeeping");
        // 不影響記帳結果，只記錄警告
      }
    } catch (synonymsError) {
      LBK_logError(`wallet synonyms更新異常: ${synonymsError.message}`, "LBK_processQuickBookkeeping");
      // 不影響記帳結果，只記錄錯誤
    }


    // 格式化回覆訊息，傳遞原始輸入作為參考
    const replyMessage = LBK_formatReplyMessage(bookkeepingResult.data, "LBK", {
      originalInput: parseResult.data.subject
    });

    LBK_logInfo(`快速記帳完成 [${processId}]`, "快速記帳", userId || "", "LBK_processQuickBookkeeping");

    return {
      success: true,
      message: replyMessage,
      responseMessage: replyMessage,
      moduleCode: "LBK",
      module: "LBK",
      data: bookkeepingResult.data,
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.1.1"
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
      moduleVersion: "1.1.1",
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
    LBK_logDebug(`解析用戶訊息: "${messageText}" [${processId}]`, "訊息解析", userId, "LBK_parseUserMessage");

    if (!messageText || messageText.trim() === "") {
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
    const subjectResult = await LBK_identifySubject(parseResult.subject, userId, processId);

    if (!subjectResult.success) {
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
    if (!subjectResult.data || !subjectResult.data.subjectCode || !subjectResult.data.subjectName) {
      LBK_logError(`科目資料不完整: ${JSON.stringify(subjectResult.data)}`, "訊息解析", userId, "SUBJECT_DATA_INCOMPLETE", "科目資料缺少必要欄位", "LBK_parseUserMessage");
      return {
        success: false,
        error: `科目資料不完整: ${parseResult.subject}`,
        errorType: "SUBJECT_DATA_INCOMPLETE"
      };
    }

    // 根據科目代碼判斷收支類型，並設定正確的支付方式
    const isIncome = subjectResult.data.isIncome;
    const finalPaymentMethod = parseResult.paymentMethod === "刷卡" ?
      subjectResult.data.defaultPaymentMethod : parseResult.paymentMethod;

    return {
      success: true,
      data: {
        subject: parseResult.subject,
        amount: parseResult.amount,
        rawAmount: parseResult.rawAmount,
        paymentMethod: finalPaymentMethod,
        subjectCode: subjectResult.data.subjectCode,
        subjectName: subjectResult.data.subjectName,
        majorCode: subjectResult.data.majorCode,
        action: isIncome ? "收入" : "支出",
        userId: userId
      }
    };

  } catch (error) {
    LBK_logError(`解析用戶訊息失敗: ${error.toString()} [${processId}]`, "訊息解析", userId, "PARSE_ERROR", error.toString(), "LBK_parseUserMessage");

    return {
      success: false,
      error: "解析失敗",
      errorType: "PARSE_ERROR"
    };
  }
}

/**
 * 03. 解析輸入格式
 * @version 2025-12-17-V1.4.5
 * @date 2025-12-17 15:30:00
 * @description 修復版：正確解析包含銀行名稱的輸入格式，增強支付方式識別準確度
 */
function LBK_parseInputFormat(message, processId) {
  LBK_logDebug(`開始解析格式: "${message}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");

  if (!message || message.trim() === "") {
    return null;
  }

  message = message.trim();

  try {
    // v1.4.5 修復：改用更精確的正則表達式，支援銀行名稱識別
    // 匹配格式：科目名稱 + 數字金額 + 可選的支付方式/銀行名稱
    const enhancedPattern = /^(.+?)(\d+)(.*)$/;
    const match = message.match(enhancedPattern);

    if (!match) {
      LBK_logWarning(`無法匹配輸入格式: "${message}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
      return null;
    }

    const rawSubject = match[1].trim();
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

    // v1.4.5 增強：支付方式識別邏輯
    let paymentMethod = "刷卡"; // 預設值
    let finalSubject = rawSubject;
    let processedSuffix = suffixPart;

    // 移除幣別單位
    const supportedUnits = /(元|塊|圓)$/i;
    const unsupportedUnits = /(NT|USD|\$)$/i;

    if (unsupportedUnits.test(processedSuffix)) {
      LBK_logWarning(`不支援的幣別單位 "${processedSuffix}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
      return null;
    }

    processedSuffix = processedSuffix.replace(supportedUnits, '').trim();

    // v1.4.5 增強的銀行名稱識別
    const bankNames = [
      "台銀", "土銀", "合庫", "第一", "華南", "彰銀", "上海", "國泰", "中信", "玉山",
      "台新", "永豐", "兆豐", "日盛", "安泰", "中國信託", "聯邦", "遠東", "元大",
      "凱基", "台北富邦", "國票", "新光", "陽信", "三信", "聯邦商銀", "台企銀",
      "高雄銀", "花旗", "渣打", "匯豐", "星展", "澳盛"
    ];

    // 檢查是否包含銀行名稱（優先級最高）
    let detectedBank = null;
    for (const bankName of bankNames) {
      if (processedSuffix.includes(bankName)) {
        detectedBank = bankName;
        paymentMethod = bankName; // 直接使用銀行名稱作為支付方式
        LBK_logDebug(`檢測到銀行名稱: ${bankName} [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
        break;
      }
    }

    // 如果沒有檢測到銀行，檢查標準支付方式關鍵字
    if (!detectedBank) {
      const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳"];
      for (const method of paymentMethods) {
        if (processedSuffix.includes(method)) {
          paymentMethod = method;
          LBK_logDebug(`檢測到支付方式: ${method} [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
          break;
        }
      }
    }

    // v1.4.5 修復：確保科目名稱正確提取
    // 例如：「飯糰28星展」→ 科目「飯糰」、金額「28」、支付方式「星展」
    LBK_logInfo(`解析結果: 科目="${finalSubject}", 金額=${amount}, 支付方式="${paymentMethod}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");

    return {
      subject: finalSubject,
      amount: amount,
      rawAmount: rawAmount,
      paymentMethod: paymentMethod
    };

  } catch (error) {
    LBK_logError(`解析格式錯誤: ${error.toString()} [${processId}]`, "格式解析", "", "PARSE_ERROR", error.toString(), "LBK_parseInputFormat");
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
 * @version 2025-07-15-V1.0.1
 * @date 2025-07-15 19:10:00
 * @description 根據科目名稱查詢對應的科目代碼，強化匹配算法精準度
 */
async function LBK_getSubjectCode(subjectName, userId, processId) {
  try {
    LBK_logDebug(`查詢科目代碼: "${subjectName}" [${processId}]`, "科目查詢", userId, "LBK_getSubjectCode");

    if (!subjectName || !userId) {
      throw new Error("科目名稱或用戶ID為空");
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    const ledgerId = `user_${userId}`;
    const normalizedInput = String(subjectName).trim().toLowerCase();

    // 記錄同義詞匹配過程
    LBK_logDebug(`開始同義詞匹配，輸入: "${normalizedInput}" [${processId}]`, "同義詞匹配", userId, "LBK_getSubjectCode");

    const snapshot = await db.collection("ledgers").doc(ledgerId).collection("categories").where("isActive", "==", true).get();

    LBK_logDebug(`查詢categories集合結果: ${snapshot.size} 筆資料 [${processId}]`, "科目查詢", userId, "LBK_getSubjectCode");

    if (snapshot.empty) {
      // 嘗試查詢所有categories文檔（不限制isActive）
      const allSnapshot = await db.collection("ledgers").doc(ledgerId).collection("categories").get();
      LBK_logDebug(`categories集合總數: ${allSnapshot.size} 筆資料 [${processId}]`, "科目查詢", userId, "LBK_getSubjectCode");

      if (!allSnapshot.empty) {
        // 列出所有文檔的基本信息用於調試
        allSnapshot.forEach(doc => {
          const data = doc.data();
          LBK_logDebug(`文檔 ${doc.id}: subCategoryId=${data.subCategoryId}, name=${data.name}, categoryName=${data.categoryName}, isActive=${data.isActive}`, "科目查詢", userId, "LBK_getSubjectCode");
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
          majorCode: String(data.categoryId || data.parentId),
          majorName: String(data.categoryName || ''),
          subCode: String(data.subCategoryId || data.categoryId),
          subName: String(data.name || data.subCategoryName || data.categoryName || '')
        };
        break;
      }

      // 2. 同義詞精確匹配 - 第二優先級（不跳過，即使synonyms為空）
      const synonymsStr = data.synonyms || "";
      // 將同義詞字串分割為陣列，即使為空字串也進行處理
      const synonyms = synonymsStr ? synonymsStr.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];

      // 即使synonyms陣列為空，也記錄此步驟以利後續歸類機制
      LBK_logDebug(`處理同義詞匹配: "${normalizedInput}"，科目: "${data.categoryName}"，同義詞數量: ${synonyms.length} [${processId}]`, "同義詞匹配", userId, "LBK_getSubjectCode");

      for (const synonym of synonyms) {
        const synonymLower = synonym.toLowerCase();
        if (synonymLower === normalizedInput) {
          synonymMatch = {
            majorCode: String(data.categoryId || data.parentId),
            majorName: String(data.categoryName || ''),
            subCode: String(data.subCategoryId || data.categoryId),
            subName: String(data.name || data.subCategoryName || data.categoryName || '')
          };
          break;
        }

        // 新增：同義詞包含匹配（例如：飯糰 可以匹配到 御飯糰）
        if (synonymLower.includes(normalizedInput) && normalizedInput.length >= 2) {
          if (!synonymMatch) { // 只在沒有精確匹配時使用
            synonymMatch = {
              majorCode: String(data.parentId || data.categoryId),
              majorName: String(data.categoryName || ''),
              subCode: String(data.categoryId || ''),
              subName: String(data.subCategoryName || data.categoryName || '')
            };
            LBK_logDebug(`找到同義詞包含匹配: "${normalizedInput}" → "${synonymLower}" → "${synonymMatch.subName}" [${processId}]`, "同義詞匹配", userId, "LBK_getSubjectCode");
          }
        }

        // 新增：反向包含匹配（例如：停車費 可以匹配到 停車）
        if (normalizedInput.includes(synonymLower) && synonymLower.length >= 2) {
          if (!synonymMatch) { // 只在沒有精確匹配時使用
            synonymMatch = {
              majorCode: String(data.parentId || data.categoryId),
              majorName: String(data.categoryName || ''),
              subCode: String(data.categoryId || ''),
              subName: String(data.subCategoryName || data.categoryName || '')
            };
            LBK_logDebug(`找到反向包含匹配: "${normalizedInput}" → "${synonymLower}" → "${synonymMatch.subName}" [${processId}]`, "同義詞匹配", userId, "LBK_getSubjectCode");
          }
        }
      }

      // 3. 部分匹配 - 包含關係
      if (subName.includes(normalizedInput) || normalizedInput.includes(subName)) {
        partialMatches.push({
          majorCode: String(data.categoryId || data.parentId),
          majorName: String(data.categoryName || ''),
          subCode: String(data.subCategoryId || data.categoryId),
          subName: String(data.name || data.subCategoryName || data.categoryName || ''),
          score: subName.length === normalizedInput.length ? 1.0 : 0.8
        });
      }
    }

    // 按優先級返回結果
    if (exactMatch) {
      return exactMatch;
    }
    if (synonymMatch) {
      return synonymMatch;
    }
    if (partialMatches.length > 0) {
      // 返回評分最高的部分匹配
      partialMatches.sort((a, b) => b.score - a.score);
      const bestMatch = partialMatches[0];
      return {
        majorCode: bestMatch.majorCode,
        majorName: bestMatch.majorName,
        subCode: bestMatch.subCode,
        subName: bestMatch.subName
      };
    }

    throw new Error(`找不到科目: ${subjectName}`);

  } catch (error) {
    LBK_logError(`查詢科目代碼失敗: ${error.toString()} [${processId}]`, "科目查詢", userId, "SUBJECT_ERROR", error.toString(), "LBK_getSubjectCode");
    throw error;
  }
}

/**
 * 06. 模糊匹配科目 - 優化匹配算法
 * @version 2025-07-15-V1.0.1
 * @date 2025-07-15 19:10:00
 * @description 當精確匹配失敗時，使用優化的模糊匹配尋找最相似的科目
 */
async function LBK_fuzzyMatch(input, threshold, userId, processId) {
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
      const subNameLower = subject.subName.toLowerCase();

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
        LBK_logDebug(`模糊匹配：科目 "${subject.subName}" 無同義詞，跳過同義詞匹配但保持流程完整 [${processId}]`, "模糊匹配", userId, "LBK_fuzzyMatch");
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
        const key = `${match.majorCode}-${match.subCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMatches.push(match);
        } else {
          // 如果已存在，保留分數更高的
          const existingIndex = uniqueMatches.findIndex(m => `${m.majorCode}-${m.subCode}` === key);
          if (existingIndex >= 0 && match.score > uniqueMatches[existingIndex].score) {
            uniqueMatches[existingIndex] = match;
          }
        }
      });

      uniqueMatches.sort((a, b) => b.score - a.score);
      const bestMatch = uniqueMatches[0];

      if (bestMatch.score >= threshold) {
        return bestMatch;
      }
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
        majorCode: data.categoryId || data.parentId,
        majorName: data.categoryName || '',
        subCode: data.subCategoryId || data.categoryId,
        subName: data.name || data.subCategoryName || data.categoryName || '',
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
 * 08. 執行記帳操作 - 加入重試機制
 * @version 2025-07-15-V1.0.1
 * @date 2025-07-15 19:10:00
 * @description 執行實際的記帳操作，包含資料驗證、儲存和重試機制
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
      const subjectResult = await LBK_identifySubject(bookkeepingData.subject, bookkeepingData.userId, processId);

      if (!subjectResult.success) {
        LBK_logError(`科目識別失敗: ${bookkeepingData.subject}`, "記帳執行", bookkeepingData.userId, "SUBJECT_NOT_FOUND", subjectResult.error || "科目不存在", "LBK_executeBookkeeping");
        return {
          success: false,
          error: `找不到科目: ${bookkeepingData.subject}`,
          errorType: "SUBJECT_NOT_FOUND"
        };
      }

      // 驗證科目資料完整性
      if (!subjectResult.data || !subjectResult.data.subjectCode || !subjectResult.data.subjectName) {
        LBK_logError(`科目資料不完整: ${JSON.stringify(subjectResult.data)}`, "記帳執行", bookkeepingData.userId, "SUBJECT_DATA_INCOMPLETE", "科目資料缺少必要欄位", "LBK_executeBookkeeping");
        return {
          success: false,
          error: `科目資料不完整: ${bookkeepingData.subject}`,
          errorType: "SUBJECT_DATA_INCOMPLETE"
        };
      }

      // 根據科目代碼判斷收支類型，並設定正確的支付方式
      const isIncome = subjectResult.data.isIncome;
      const finalPaymentMethod = bookkeepingData.paymentMethod === "刷卡" ?
        subjectResult.data.defaultPaymentMethod : bookkeepingData.paymentMethod;

      // 更新記帳資料，加入科目資訊和正確的支付方式
      const updatedBookkeepingData = {
        ...bookkeepingData,
        subjectCode: subjectResult.data.subjectCode,
        subjectName: subjectResult.data.subjectName,
        majorCode: subjectResult.data.majorCode,
        action: isIncome ? "收入" : "支出",
        paymentMethod: finalPaymentMethod
      };

      // 生成記帳ID
      const bookkeepingId = await LBK_generateBookkeepingId(updatedBookkeepingData.userId, processId);

      // 準備記帳資料
      const preparedData = LBK_prepareBookkeepingData(bookkeepingId, updatedBookkeepingData, processId);

      // 儲存到Firestore（帶重試）
      const saveResult = await LBK_saveToFirestore(preparedData, processId);

      if (!saveResult.success) {
        lastError = saveResult.error;

        if (attempt < maxRetries) {
          // 等待遞增延遲後重試
          const delay = Math.pow(2, attempt - 1) * 1000; // 指數退避
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return {
          success: false,
          error: `儲存失敗 (${maxRetries}次重試後): ${lastError}`,
          errorType: "STORAGE_ERROR"
        };
      }

      // 格式化返回的記帳資料，確保包含所有必要的欄位
      const processedData = {
        id: bookkeepingId,
        transactionId: bookkeepingId,
        amount: updatedBookkeepingData.amount,
        type: updatedBookkeepingData.action === "收入" ? "income" : "expense",
        category: updatedBookkeepingData.subjectCode,
        subject: updatedBookkeepingData.subjectName,
        subjectName: updatedBookkeepingData.subjectName,
        description: updatedBookkeepingData.subject, // 使用原始科目作為描述
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
        LBK_logWarning(`記帳操作嘗試 ${attempt} 失敗，準備重試: ${error.toString()} [${processId}]`, "記帳執行", bookkeepingData.userId, "LBK_executeBookkeeping");

        // 等待後重試
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      LBK_logError(`執行記帳操作失敗 (${maxRetries}次重試後): ${error.toString()} [${processId}]`, "記帳執行", bookkeepingData.userId, "EXECUTE_ERROR", error.toString(), "LBK_executeBookkeeping");
    }
  }

  return {
    success: false,
    error: `記帳操作失敗 (${maxRetries}次重試後): ${lastError}`,
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
        LBK_logWarning(`Firestore儲存嘗試 ${attempt} 失敗，準備重試: ${error.toString()} [${processId}]`, "資料儲存", bookkeepingData.userId, "LBK_saveToFirestore");

        // 指數退避延遲
        const delay = Math.pow(2, attempt - 1) * 500 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      LBK_logError(`儲存到Firestore失敗 (${maxRetries}次重試後): ${error.toString()} [${processId}]`, "資料儲存", bookkeepingData.userId, "SAVE_ERROR", error.toString(), "LBK_saveToFirestore");
    }
  }

  return {
    success: false,
    error: `儲存失敗 (${maxRetries}次重試後): ${lastError}`,
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

    // 完全使用1301 BK標準欄位格式
    const preparedData = {
      // 核心欄位 - 符合1301標準
      id: bookkeepingId,
      amount: parseFloat(data.amount) || 0,
      type: data.action === "收入" ? "income" : "expense",
      description: data.subject || '',
      categoryId: data.subjectCode || 'default',
      accountId: 'default',

      // 時間欄位 - 1301標準格式
      date: now.format('YYYY-MM-DD'),
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,

      // 來源和用戶資訊 - 1301標準
      source: 'quick',
      userId: data.userId || '',
      paymentMethod: data.paymentMethod || LBK_CONFIG.DEFAULT_PAYMENT_METHOD || '現金',

      // 記帳特定欄位 - 1301標準
      ledgerId: `user_${data.userId}`,

      // 狀態欄位 - 1301標準
      status: 'active',
      verified: false,

      // 元數據 - 1301標準
      metadata: {
        processId: processId,
        module: 'LBK',
        version: '1.2.0',
        majorCode: data.majorCode,
        subjectName: data.subjectName
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
      const subjectDisplay = resultData.subjectName || resultData.subject || resultData.description || "未知科目";

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
          const subjectMatch = originalInput.replace(/\d+/g, '').replace(/(現金|刷卡|行動支付|轉帳|元|塊|圓)/g, '').trim();
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
 * 14. 移除文字中的金額和支付方式
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 從文字中移除金額和支付方式，保留備註內容
 */
function LBK_removeAmountFromText(text, amount, paymentMethod, processId) {
  if (!text || !amount) return text;

  try {
    const amountStr = String(amount);
    let result = text;

    // 移除金額
    if (text.includes(" " + amountStr)) {
      result = text.replace(" " + amountStr, "").trim();
    } else if (text.endsWith(amountStr)) {
      result = text.substring(0, text.length - amountStr.length).trim();
    }

    // 移除支付方式
    if (paymentMethod && result.includes(paymentMethod)) {
      result = result.replace(paymentMethod, "").trim();
    }

    // 移除幣別單位
    const amountEndRegex = new RegExp(amountStr + "(元|塊|圓)$", "i");
    const match = result.match(amountEndRegex);
    if (match && match.index > 0) {
      result = result.substring(0, match.index).trim();
    }

    return result || text;

  } catch (error) {
    LBK_logError(`移除金額和支付方式失敗: ${error.toString()}`, "文本處理", "", "TEXT_PROCESS_ERROR", error.toString(), "LBK_removeAmountFromText");
    return text;
  }
}

/**
 * 15. 驗證支付方式
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 驗證並標準化支付方式
 */
function LBK_validatePaymentMethod(method, majorCode, processId) {
  try {
    if (!method || method === "" || method === "預設") {
      if (majorCode && (String(majorCode).startsWith('8') || String(majorCode).startsWith('9'))) {
        return { success: true, paymentMethod: "現金" };
      } else {
        return { success: true, paymentMethod: "刷卡" };
      }
    }

    const validPaymentMethods = ["現金", "刷卡", "轉帳", "行動支付"];

    if (validPaymentMethods.includes(method)) {
      return { success: true, paymentMethod: method };
    }

    return {
      success: false,
      error: `不支援的支付方式: "${method}"`,
      validMethod: "刷卡"
    };

  } catch (error) {
    LBK_logError(`驗證支付方式失敗: ${error.toString()}`, "支付方式驗證", "", "PAYMENT_VALIDATION_ERROR", error.toString(), "LBK_validatePaymentMethod");

    return {
      success: false,
      error: error.toString(),
      validMethod: "刷卡"
    };
  }
}

/**
 * 16. 時間格式化
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 格式化時間為台灣時區
 */
function LBK_formatDateTime(date, processId) {
  try {
    return moment(date).tz(LBK_CONFIG.TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
  } catch (error) {
    LBK_logError(`時間格式化失敗: ${error.toString()}`, "時間處理", "", "TIME_FORMAT_ERROR", error.toString(), "LBK_formatDateTime");
    return new Date().toISOString();
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
 * 19. 統一金額處理核心函數 (內部使用)
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 統一的金額處理邏輯，被其他金額相關函數調用
 */
function LBK_processAmountInternal(text, processId) {
  try {
    if (!text || text.trim() === "") {
      return {
        amount: 0,
        amountMatch: "",
        cleanText: text,
        currency: "NTD",
        hasAmount: false
      };
    }

    // 金額正則表達式
    const amountRegex = /(-?\d+)(元|塊|圓)?/g;
    const matches = [...text.matchAll(amountRegex)];

    if (matches.length === 0) {
      return {
        amount: 0,
        amountMatch: "",
        cleanText: text,
        currency: "NTD",
        hasAmount: false
      };
    }

    // 找最大的金額
    let bestMatch = null;
    let bestAmount = 0;

    for (const match of matches) {
      const amount = Math.abs(parseInt(match[1], 10));
      if (amount > bestAmount) {
        bestAmount = amount;
        bestMatch = match;
      }
    }

    if (bestMatch) {
      const cleanText = text.replace(bestMatch[0], '').trim();

      return {
        amount: bestAmount,
        amountMatch: bestMatch[0],
        cleanText: cleanText,
        currency: "NTD",
        hasAmount: true
      };
    }

    return {
      amount: 0,
      amountMatch: "",
      cleanText: text,
      currency: "NTD",
      hasAmount: false
    };

  } catch (error) {
    LBK_logError(`統一金額處理失敗: ${error.toString()} [${processId}]`, "金額處理", "", "AMOUNT_PROCESS_ERROR", error.toString(), "LBK_processAmountInternal");

    return {
      amount: 0,
      amountMatch: "",
      cleanText: text,
      currency: "NTD",
      hasAmount: false
    };
  }
}

/**
 * 20. 統一驗證框架 (內部使用)
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 統一的資料驗證邏輯框架
 */
function LBK_validateDataInternal(data, validationType, rules, processId) {
  try {
    switch (validationType) {
      case 'AMOUNT':
        if (!data.amount || data.amount <= 0) {
          return { success: false, error: "金額無效" };
        }
        if (rules.min && data.amount < rules.min) {
          return { success: false, error: `金額不能小於${rules.min}` };
        }
        if (rules.max && data.amount > rules.max) {
          return { success: false, error: `金額不能大於${rules.max}` };
        }
        break;

      case 'PAYMENT_METHOD':
        if (!rules.allowedMethods.includes(data.method)) {
          return { success: false, error: `不支援的支付方式: ${data.method}` };
        }
        break;

      case 'BOOKKEEPING_DATA':
        for (const field of rules.required) {
          if (!data[field]) {
            return { success: false, error: `缺少必要欄位: ${field}` };
          }
        }
        break;

      default:
        return { success: false, error: "未知的驗證類型" };
    }

    return { success: true };

  } catch (error) {
    LBK_logError(`統一驗證框架失敗: ${error.toString()} [${processId}]`, "資料驗證", "", "VALIDATE_INTERNAL_ERROR", error.toString(), "LBK_validateDataInternal");
    return { success: false, error: "驗證失敗" };
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

// 輔助函數：識別科目 - v1.4.0 增強新科目檢測邏輯
async function LBK_identifySubject(subjectText, userId, processId) {
  try {
    LBK_logDebug(`開始識別科目: "${subjectText}"`, "科目識別", userId, "LBK_identifySubject");

    const subjectCode = await LBK_getSubjectCode(subjectText, userId, processId);

    if (!subjectCode) {
      LBK_logWarning(`找不到匹配的科目: ${subjectText}，觸發新科目歸類流程`, "科目識別", userId, "LBK_identifySubject");
      return {
        success: false,
        error: "找不到匹配的科目",
        requiresClassification: true,
        originalSubject: subjectText
      };
    }

    // 檢查返回的科目資料完整性
    if (!subjectCode.subCode || !subjectCode.subName) {
      LBK_logError(`科目資料不完整: ${JSON.stringify(subjectCode)}`, "科目識別", userId, "SUBJECT_DATA_ERROR", "缺少必要欄位", "LBK_identifySubject");
      return {
        success: false,
        error: "科目資料不完整",
        requiresClassification: true,
        originalSubject: subjectText
      };
    }

    // 根據科目代碼判斷收支類型和預設支付方式
    const majorCodeNum = parseInt(subjectCode.majorCode);
    const isIncome = [801, 899].includes(majorCodeNum);
    const defaultPaymentMethod = isIncome ? "轉帳" : "刷卡";

    LBK_logDebug(`科目識別成功: ${subjectCode.subName} (代碼: ${subjectCode.subCode})`, "科目識別", userId, "LBK_identifySubject");

    return {
      success: true,
      data: {
        subjectCode: subjectCode.subCode,
        subjectName: subjectCode.subName,
        majorCode: subjectCode.majorCode,
        isIncome: isIncome,
        defaultPaymentMethod: defaultPaymentMethod
      }
    };

  } catch (error) {
    LBK_logError(`識別科目失敗: ${error.toString()}`, "科目識別", userId, "IDENTIFY_ERROR", error.toString(), "LBK_identifySubject");

    // v1.4.0: 當發生錯誤時也觸發新科目歸類流程
    return {
      success: false,
      error: error.toString(),
      requiresClassification: true,
      originalSubject: subjectText
    };
  }
}

// 輔助函數：初始化Firestore
async function LBK_initializeFirestore() {
  try {
    if (LBK_INIT_STATUS.firestore_db) {
      return LBK_INIT_STATUS.firestore_db;
    }

    // 檢查 Firebase Admin 是否已初始化
    if (!admin.apps.length) {
      console.log('🔄 LBK模組: Firebase Admin 尚未初始化，開始初始化...');

      firebaseConfig.initializeFirebaseAdmin();

      console.log('✅ LBK模組: Firebase Admin 動態配置初始化完成');
    }

    // 取得 Firestore 實例
    const db = admin.firestore();

    // 測試連線
    await db.collection('_health_check').doc('lbk_init_test').set({
      timestamp: admin.firestore.Timestamp.now(),
      module: 'LBK',
      status: 'initialized'
    });

    // 刪除測試文檔
    await db.collection('_health_check').doc('lbk_init_test').delete();

    LBK_INIT_STATUS.firestore_db = db;

    return db;

  } catch (error) {
    console.error('❌ LBK模組: Firestore初始化失敗:', error);
    throw error;
  }
}

// 日誌函數
function LBK_logDebug(message, operationType = "", userId = "", location = "") {
  if (LBK_CONFIG.DEBUG) {
    console.log(`[DEBUG] [LBK] ${message} | ${operationType} | ${userId} | ${location}`);
  }
}

function LBK_logInfo(message, operationType = "", userId = "", location = "") {
  console.log(`[INFO] [LBK] ${message} | ${operationType} | ${userId} | ${location}`);
}

function LBK_logWarning(message, operationType = "", userId = "", location = "") {
  console.warn(`[WARNING] [LBK] ${message} | ${operationType} | ${userId} | ${location}`);
}

function LBK_logError(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "") {
  console.error(`[ERROR] [LBK] ${message} | ${operationType} | ${userId} | ${errorCode} | ${errorDetails} | ${location}`);
}

/**
 * 45. 檢查統計查詢關鍵字 - LBK獨立關鍵字配置
 * @version 2025-12-10-V1.3.0
 * @date 2025-12-10 20:30:00
 * @description 使用LBK獨立的統計關鍵字配置，完全移除對SR模組的依賴
 */
async function LBK_checkStatisticsKeyword(messageText, userId, processId) {
  try {
    if (!messageText || typeof messageText !== 'string') {
      return { isStatisticsRequest: false };
    }

    const normalizedText = messageText.trim().toLowerCase();

    // LBK獨立的統計關鍵字配置
    const statisticsKeywords = {
      '本日統計': { type: 'daily', postbackData: '本日統計' },
      '本週統計': { type: 'weekly', postbackData: '本週統計' },
      '本月統計': { type: 'monthly', postbackData: '本月統計' },
      '週統計': { type: 'weekly', postbackData: '本週統計' },
      '月統計': { type: 'monthly', postbackData: '本月統計' },
      '統計': { type: 'daily', postbackData: '本日統計' },
      'stats': { type: 'daily', postbackData: '本日統計' },
      'today': { type: 'daily', postbackData: '本日統計' },
      'week': { type: 'weekly', postbackData: '本週統計' },
      'month': { type: 'monthly', postbackData: '本月統計' }
    };

    LBK_logDebug(`使用LBK獨立統計關鍵字配置 [${processId}]`, "關鍵字檢核", userId, "LBK_checkStatisticsKeyword");

    // 精確匹配檢查
    for (const [keyword, config] of Object.entries(statisticsKeywords)) {
      if (normalizedText === keyword.toLowerCase() || normalizedText === keyword) {
        LBK_logInfo(`匹配統計關鍵字: "${keyword}" → ${config.type} [${processId}]`, "關鍵字檢核", userId, "LBK_checkStatisticsKeyword");

        return {
          isStatisticsRequest: true,
          statisticsType: config.type,
          originalKeyword: keyword,
          postbackData: config.postbackData
        };
      }
    }

    return { isStatisticsRequest: false };

  } catch (error) {
    LBK_logError(`檢查統計關鍵字失敗: ${error.toString()} [${processId}]`, "關鍵字檢核", userId, "KEYWORD_CHECK_ERROR", error.toString(), "LBK_checkStatisticsKeyword");
    return { isStatisticsRequest: false };
  }
}

/**
 * 46. 處理統計查詢請求 - 完全獨立處理
 * @version 2025-12-10-V1.3.0
 * @date 2025-12-10 20:00:00
 * @description 完全移除對SR模組的依賴，LBK統計功能自主運作
 */
async function LBK_handleStatisticsRequest(statisticsType, inputData, processId) {
  try {
    LBK_logInfo(`處理統計請求: ${statisticsType} [${processId}]`, "統計處理", inputData.userId || "", "LBK_handleStatisticsRequest");

    // 建構postbackData
    const postbackDataMap = {
      'daily': '本日統計',
      'weekly': '本週統計',
      'monthly': '本月統計'
    };

    const postbackData = postbackDataMap[statisticsType] || '本日統計';

    // 調用內部統計處理函數
    const statsResult = await LBK_processDirectStatistics(inputData.userId, postbackData);

    if (statsResult.success) {
      // 統計查詢成功
      return {
        success: true,
        message: statsResult.message,
        responseMessage: statsResult.message,
        quickReply: statsResult.quickReply,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.3.0",
        statisticsType: statisticsType
      };
    } else {
      // 統計查詢失敗，返回友善錯誤訊息
      const errorMessage = `📊 ${postbackData}\n\n暫時無法取得統計資料，請稍後再試。\n\n💡 您也可以嘗試輸入記帳格式開始記帳`;

      return {
        success: false,
        message: errorMessage,
        responseMessage: errorMessage,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: 0,
        moduleVersion: "1.3.0",
        errorType: "STATISTICS_ERROR"
      };
    }

  } catch (error) {
    LBK_logError(`處理統計請求失敗: ${error.toString()} [${processId}]`, "統計處理", inputData.userId || "", "STATISTICS_HANDLE_ERROR", error.toString(), "LBK_handleStatisticsRequest");

    // 返回統一格式的錯誤訊息
    const fallbackMessage = `📊 統計查詢\n\n系統暫時無法處理統計查詢，請稍後再試。\n\n💡 您可以繼續使用記帳功能`;

    return {
      success: false,
      message: fallbackMessage,
      responseMessage: fallbackMessage,
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.3.0",
      errorType: "SYSTEM_ERROR"
    };
  }
}

/**
 * 47. 建立統計Quick Reply按鈕 - LBK獨立版本
 * @version 2025-12-10-V1.3.0
 * @date 2025-12-10 20:30:00
 * @description LBK獨立建立統計查詢結果的Quick Reply按鈕選項
 */
function LBK_buildStatisticsQuickReply(userId, currentType) {
  try {
    const quickReplyItems = [];

    // LBK獨立的統計選項配置
    const statisticsOptions = [
      { type: 'daily', label: '本日統計', postbackData: '本日統計' },
      { type: 'weekly', label: '本週統計', postbackData: '本週統計' },
      { type: 'monthly', label: '本月統計', postbackData: '本月統計' }
    ];

    // 排除當前類型，提供其他選項
    statisticsOptions.forEach(option => {
      if (option.type !== currentType) {
        quickReplyItems.push({
          label: option.label,
          postbackData: option.postbackData
        });
      }
    });

    // 確保至少有一個選項
    if (quickReplyItems.length === 0) {
      quickReplyItems.push({ label: '本日統計', postbackData: '本日統計' });
    }

    // 限制最多4個選項
    return {
      type: 'quick_reply',
      items: quickReplyItems.slice(0, 4),
      source: 'LBK_independent'
    };

  } catch (error) {
    LBK_logError(`建立Quick Reply失敗: ${error.toString()}`, "Quick Reply", userId, "QUICK_REPLY_ERROR", error.toString(), "LBK_buildStatisticsQuickReply");

    return {
      type: 'quick_reply',
      items: [{ label: '本日統計', postbackData: '本日統計' }],
      source: 'LBK_fallback'
    };
  }
}

/**
 * 48. 處理直接統計查詢 - 複製自SR模組
 * @version 2025-12-10-V1.3.0
 * @date 2025-12-10 20:00:00
 * @description 複製SR的SR_processQuickReplyStatistics邏輯，實現LBK獨立統計查詢
 */
async function LBK_processDirectStatistics(userId, postbackData) {
  const functionName = "LBK_processDirectStatistics";
  try {
    LBK_logInfo(`處理直接統計查詢: ${postbackData}`, "統計查詢", userId, "", "", functionName);

    let statsResult = null;
    let period = '';

    // 根據 postback 資料取得對應統計
    switch (postbackData) {
      case '本日統計':
        period = 'today';
        statsResult = await LBK_getDirectStatistics(userId, 'daily');
        break;

      case '本週統計':
        period = 'week';
        statsResult = await LBK_getDirectStatistics(userId, 'weekly');
        break;

      case '本月統計':
        period = 'month';
        statsResult = await LBK_getDirectStatistics(userId, 'monthly');
        break;
    }

    // 建立統計回覆訊息
    const replyMessage = LBK_formatStatisticsMessage(period, statsResult?.success ? statsResult.data : null);

    // 建立基礎 Quick Reply 按鈕
    const quickReplyButtons = LBK_buildStatisticsQuickReply(userId, period.replace('today', 'daily').replace('week', 'weekly').replace('month', 'monthly'));

    return {
      success: true,
      message: replyMessage,
      quickReply: quickReplyButtons,
      period: period
    };

  } catch (error) {
    LBK_logError(`處理直接統計查詢失敗: ${error.message}`, "統計查詢", userId, "LBK_STATS_ERROR", error.toString(), functionName);

    return {
      success: false,
      message: '統計查詢失敗，請稍後再試',
      error: error.message
    };
  }
}

/**
 * 49. 直接統計查詢函數 - 複製自SR模組
 * @version 2025-12-10-V1.3.0
 * @date 2025-12-10 20:00:00
 * @description 複製SR的SR_getDirectStatistics邏輯，直接查詢Firestore取得統計資料
 */
async function LBK_getDirectStatistics(userId, period) {
  const functionName = "LBK_getDirectStatistics";
  try {
    LBK_logInfo(`直接查詢統計資料: ${period}`, "統計查詢", userId, "", "", functionName);

    const ledgerId = `user_${userId}`;
    const now = moment().tz(LBK_CONFIG.TIMEZONE);
    let startDate, endDate;

    // 設定查詢時間範圍
    switch (period) {
      case 'daily':
        startDate = now.clone().startOf('day').toDate();
        endDate = now.clone().endOf('day').toDate();
        break;
      case 'weekly':
        startDate = now.clone().startOf('week').toDate();
        endDate = now.clone().endOf('week').toDate();
        break;
      case 'monthly':
        startDate = now.clone().startOf('month').toDate();
        endDate = now.clone().endOf('month').toDate();
        break;
      default:
        startDate = now.clone().startOf('day').toDate();
        endDate = now.clone().endOf('day').toDate();
    }

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    // 查詢Firestore transactions集合 - 使用1301標準路徑
    const transactionsRef = db.collection('ledgers').doc(ledgerId).collection('transactions');
    const snapshot = await transactionsRef
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .get();

    if (snapshot.empty) {
      LBK_logInfo(`無統計資料: ${period}`, "統計查詢", userId, "", "", functionName);
      return {
        success: true,
        data: {
          totalIncome: 0,
          totalExpense: 0,
          recordCount: 0
        }
      };
    }

    // 計算統計資料，過濾掉_init等非交易文檔
    let totalIncome = 0;
    let totalExpense = 0;
    let recordCount = 0;

    snapshot.forEach(doc => {
      // 過濾掉_init等系統文檔
      if (doc.id === '_init' || doc.id.startsWith('_')) {
        return;
      }

      const data = doc.data();
      const amount = parseFloat(data.amount || 0);
      const type = data.type;

      // 確保這是有效的交易記錄
      if (type && amount > 0) {
        recordCount++;
        if (type === 'income') {
          totalIncome += amount;
        } else if (type === 'expense') {
          totalExpense += amount;
        }
      }
    });

    const statsData = {
      totalIncome,
      totalExpense,
      recordCount
    };

    LBK_logInfo(`統計查詢成功: 收入${totalIncome}，支出${totalExpense}，${recordCount}筆`, "統計查詢", userId, "", "", functionName);

    return {
      success: true,
      data: statsData
    };

  } catch (error) {
    LBK_logError(`直接統計查詢失敗: ${error.message}`, "統計查詢", userId, "LBK_DIRECT_STATS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      data: {
        totalIncome: 0,
        totalExpense: 0,
        recordCount: 0
      }
    };
  }
}

/**
 * 50. 格式化統計訊息 - 複製自SR模組
 * @version 2025-12-10-V1.3.0
 * @date 2025-12-10 20:00:00
 * @description 複製SR的SR_buildStatisticsReplyMessage邏輯，建立LINE友善的統計回覆訊息
 */
function LBK_formatStatisticsMessage(period, statsData) {
  const periodNames = {
    'today': '今日',
    'week': '本週',
    'month': '本月'
  };

  const periodName = periodNames[period] || period;

  if (!statsData) {
    return `📊 ${periodName}統計

暫無記帳數據

💡 開始記帳以獲得統計分析`;
  }

  const totalIncome = statsData.totalIncome || 0;
  const totalExpense = statsData.totalExpense || 0;
  const balance = totalIncome - totalExpense;
  const recordCount = statsData.recordCount || 0;

  return `📊 ${periodName}統計

💰 收入：${totalIncome}元
💸 支出：${totalExpense}元
📈 淨額：${balance >= 0 ? '+' : ''}${balance}元
📝 筆數：${recordCount}筆

${balance >= 0 ? '✅ 收支狀況良好' : '⚠️ 支出大於收入'}`;
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
    LBK_logInfo(`處理科目歸類postback: subjectId=${inputData.classificationData.subjectId} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");

    const subjectId = inputData.classificationData.subjectId;

    // 載入0099配置以取得科目資訊
    const subjectConfig = LBK_load0099SubjectConfig();
    const mainCategories = LBK_getLineMainCategories();
    const categoryMapping = LBK_buildCategoryMapping();

    // 找到選擇的科目 - categoryMapping 是對象，不是數組
    const selectedCategory = categoryMapping[subjectId];
    if (!selectedCategory) {
      LBK_logError(`無效的科目ID: ${subjectId} [${processId}]`, "科目歸類", inputData.userId, "INVALID_CATEGORY", `可用科目: ${Object.keys(categoryMapping).join(', ')}`, "LBK_handleClassificationPostback");

      return {
        success: false,
        message: `無效的科目ID: ${subjectId}，請重新選擇`,
        responseMessage: `無效的科目ID: ${subjectId}，請重新選擇`,
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
        message: `已完成科目歸類！\n選擇科目：${subjectId} ${selectedCategory.categoryName}\n歸類狀態：完成\n\n💡 後續相同輸入將自動歸類至此科目\n\n⚠️ 原始記帳資料遺失，請重新輸入進行記帳`,
        responseMessage: `已完成科目歸類！\n選擇科目：${subjectId} ${selectedCategory.categoryName}\n歸類狀態：完成\n\n💡 後續相同輸入將自動歸類至此科目\n\n⚠️ 原始記帳資料遺失，請重新輸入進行記帳`,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.4.3",
        classificationCompleted: true
      };
    }

    // 步驟1：建立同義詞關聯到Firebase
    const synonymResult = await LBK_addSubjectSynonym(pendingData.subject, subjectId, selectedCategory.categoryName, inputData.userId, processId);
    if (synonymResult.success) {
      LBK_logInfo(`成功建立同義詞關聯: ${pendingData.subject} → ${selectedCategory.categoryName} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");
    } else {
      LBK_logWarning(`同義詞建立失敗但繼續處理: ${synonymResult.error} [${processId}]`, "科目歸類", inputData.userId, "LBK_handleClassificationPostback");
    }

    // 步驟2：準備記帳資料，直接使用選擇的科目資訊進行記帳（不再依賴科目識別）
    const transactionId = Date.now().toString();
    const now = moment().tz(LBK_CONFIG.TIMEZONE);

    // 直接準備1301標準格式的記帳資料
    const preparedData = {
      // 核心欄位 - 符合1301標準
      id: transactionId,
      amount: parseFloat(pendingData.amount) || 0,
      type: selectedCategory.categoryName.includes('收入') ? "income" : "expense",
      description: pendingData.subject,
      categoryId: subjectId,
      accountId: 'default',

      // 時間欄位 - 1301標準格式
      date: now.format('YYYY-MM-DD'),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),

      // 來源和用戶資訊 - 1301標準
      source: 'classification',
      userId: inputData.userId,
      paymentMethod: pendingData.paymentMethod || '刷卡',

      // 記帳特定欄位 - 1301標準
      ledgerId: `user_${inputData.userId}`,

      // 狀態欄位 - 1301標準
      status: 'active',
      verified: false,

      // 元數據 - 1301標準
      metadata: {
        processId: processId,
        module: 'LBK',
        version: '1.4.3',
        majorCode: subjectId,
        subjectName: selectedCategory.categoryName,
        classificationSource: 'user_selection'
      }
    };

    LBK_logInfo(`開始執行歸類後記帳: ${pendingData.subject} ${pendingData.amount}元 → ${selectedCategory.categoryName} [${processId}]`, "記帳執行", inputData.userId, "LBK_handleClassificationPostback");

    // 步驟3：直接儲存記帳資料到Firestore
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
          subjectName: selectedCategory.categoryName,
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
        moduleVersion: "1.4.3",
        errorType: "BOOKKEEPING_AFTER_CLASSIFICATION_ERROR"
      };
    }

    // 步驟4：格式化成功回覆訊息
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
      moduleVersion: "1.4.3",
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
      originalInput: inputData.messageText
    };

    LBK_logInfo(`儲存pending記帳資料: ${originalSubject} ${parsedData.amount}元 [${processId}]`, "新科目歸類", inputData.userId, "LBK_handleNewSubjectClassification");

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

    // 繼續完成記帳流程
    const updatedParsedData = {
      ...parsedData,
      subjectCode: newCategoryResult.categoryId,
      subjectName: selectedCategory.categoryName,
      majorCode: selectedCategory.categoryId,
      action: selectedCategory.type === "income" ? "收入" : "支出"
    };

    const bookkeepingResult = await LBK_executeBookkeeping(updatedParsedData, processId);

    if (bookkeepingResult.success) {
      const confirmationMessage = `已將${originalSubject}歸類至 ${selection} ${selectedCategory.categoryName}\n\n${LBK_formatReplyMessage(bookkeepingResult.data, "LBK", {
        originalInput: originalSubject
      })}`;

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
      parentId: selectedCategory.categoryId,
      categoryName: selectedCategory.categoryName,
      subCategoryName: selectedCategory.categoryName, // DCN-0024 簡化策略
      synonyms: originalSubject, // 將原始輸入作為同義詞
      isActive: true,
      userId: userId,
      ledgerId: ledgerId,
      dataSource: "USER_CLASSIFICATION_v1.4.1",
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
    const subjectCodePath = path.join(__dirname, '../00. Master_Project document/0099. Subject_code.json');

    if (!fs.existsSync(subjectCodePath)) {
      LBK_logError(`0099.json檔案不存在: ${subjectCodePath}`, "科目配置", "", "CONFIG_FILE_MISSING", "", "LBK_load0099SubjectConfig");
      return null;
    }

    const subjectCodeData = JSON.parse(fs.readFileSync(subjectCodePath, 'utf8'));
    LBK_logDebug(`成功載入0099.json，共${subjectCodeData.length}筆科目資料`, "科目配置", "", "LBK_load0099SubjectConfig");

    return subjectCodeData;

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
    const subjectCodeData = LBK_load0099SubjectConfig();

    if (!subjectCodeData) {
      LBK_logWarning(`無法載入0099配置，返回空陣列`, "科目配置", "", "LBK_getLineMainCategories");
      return [];
    }

    // DCN-0024 規範：使用0099.json中的categoryId作為主科目ID
    const uniqueCategories = new Map();

    // 從0099.json提取所有有效的主科目
    subjectCodeData.forEach(item => {
      if (item.categoryId && item.categoryName) {
        const key = `${item.categoryId}`;
        if (!uniqueCategories.has(key)) {
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
        { categoryId: 999, categoryName: "不歸類" }
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
            originalInput: parsedData.originalInput
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
 * 驗證wallet是否存在於用戶的wallets子集合中
 * @version 2025-12-17-V1.4.4
 * @description 階段二：檢查指定的wallet是否存在於用戶的wallets子集合中
 */
async function LBK_validateWalletExists(userId, walletId, walletName, processId) {
  try {
    LBK_logInfo(`開始驗證wallet存在性: ${walletName} (${walletId}) [${processId}]`, "wallet驗證", userId, "LBK_validateWalletExists");

    // 取得用戶預設帳本ID
    const ledgerId = `user_${userId}`;

    // 從Firestore查詢用戶的錢包列表
    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    // 如果walletId是預設值，直接查詢對應的錢包
    if (walletId === 'default_cash' || walletId === 'default_bank' || walletId === 'default_credit') {
      const walletDoc = await db.collection(`ledgers/${ledgerId}/wallets`)
        .doc(walletId)
        .get();

      if (walletDoc.exists) {
        const walletData = walletDoc.data();
        if (walletData.userId === userId && walletData.status === 'active') {
          LBK_logInfo(`wallet驗證成功: ${walletName} (${walletId}) [${processId}]`, "wallet驗證", userId, "LBK_validateWalletExists");
          return {
            success: true,
            walletId: walletId,
            walletName: walletData.name,
            walletType: walletData.type
          };
        }
      }
    }

    // 查詢用戶所有可用的錢包
    const walletsSnapshot = await db.collection(`ledgers/${ledgerId}/wallets`)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    if (walletsSnapshot.empty) {
      LBK_logWarning(`用戶 ${userId} 沒有可用的錢包 [${processId}]`, "wallet驗證", userId, "NO_WALLETS_FOUND", "", "LBK_validateWalletExists");
      return {
        success: false,
        error: "用戶沒有可用的錢包",
        errorType: "NO_WALLETS_FOUND",
        requiresUserConfirmation: true
      };
    }

    // 檢查是否存在匹配的錢包
    let foundWallet = null;
    walletsSnapshot.forEach(doc => {
      const walletData = doc.data();
      // 精確匹配wallet ID或名稱
      if (walletData.id === walletId ||
          walletData.name.toLowerCase() === walletName.toLowerCase()) {
        foundWallet = {
          walletId: walletData.id,
          walletName: walletData.name,
          walletType: walletData.type
        };
      }
    });

    if (foundWallet) {
      LBK_logInfo(`wallet驗證成功: ${foundWallet.walletName} (${foundWallet.walletId}) [${processId}]`, "wallet驗證", userId, "LBK_validateWalletExists");
      return {
        success: true,
        ...foundWallet
      };
    }

    // 如果找不到匹配的錢包，觸發用戶確認流程
    LBK_logWarning(`找不到匹配的錢包: ${walletName} [${processId}]`, "wallet驗證", userId, "WALLET_NOT_FOUND", "", "LBK_validateWalletExists");
    return {
      success: false,
      error: `找不到錢包: ${walletName}`,
      errorType: "WALLET_NOT_FOUND",
      requiresUserConfirmation: true
    };

  } catch (error) {
    LBK_logError(`驗證wallet存在性失敗: ${error.message} [${processId}]`, "wallet驗證", userId, "WALLET_VALIDATION_ERROR", error.toString(), "LBK_validateWalletExists");
    return {
      success: false,
      error: error.message,
      errorType: "WALLET_VALIDATION_ERROR"
    };
  }
}

/**
 * 解析支付方式 - 動態從用戶錢包取得
 * @version 2025-12-12-V2.0.0
 * @description 從用戶的錢包子集合中動態取得支付方式，移除hardcoded邏輯
 */
async function LBK_parsePaymentMethod(text, userId, processId) {
  try {
    // 取得用戶預設帳本ID
    const ledgerId = `user_${userId}`;

    // 從Firestore取得用戶的錢包列表
    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const walletsSnapshot = await db.collection(`ledgers/${ledgerId}/wallets`)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    if (walletsSnapshot.empty) {
      LBK_logWarning(`用戶 ${userId} 沒有可用的錢包，使用預設現金 [${processId}]`, "支付方式解析", userId, "LBK_parsePaymentMethod");
      return { method: 'cash', walletId: 'default_cash', walletName: '現金' };
    }

    // 建立錢包關鍵字映射
    const userWallets = [];
    walletsSnapshot.forEach(doc => {
      const walletData = doc.data();
      userWallets.push({
        id: walletData.id,
        name: walletData.name,
        type: walletData.type
      });
    });

    LBK_logDebug(`找到 ${userWallets.length} 個可用錢包 [${processId}]`, "支付方式解析", userId, "LBK_parsePaymentMethod");

    // 在文字中尋找匹配的錢包名稱
    const normalizedText = text.toLowerCase();
    for (const wallet of userWallets) {
      const walletNameLower = wallet.name.toLowerCase();
      if (normalizedText.includes(walletNameLower)) {
        LBK_logInfo(`匹配到錢包: ${wallet.name} (${wallet.id}) [${processId}]`, "支付方式解析", userId, "LBK_parsePaymentMethod");
        return {
          method: wallet.type,
          walletId: wallet.id,
          walletName: wallet.name
        };
      }
    }

    // 如果沒有匹配到特定錢包，使用預設錢包
    const defaultWallet = userWallets.find(w => w.isDefault) || userWallets[0];
    LBK_logInfo(`使用預設錢包: ${defaultWallet.name} (${defaultWallet.id}) [${processId}]`, "支付方式解析", userId, "LBK_parsePaymentMethod");

    return {
      method: defaultWallet.type,
      walletId: defaultWallet.id,
      walletName: defaultWallet.name
    };

  } catch (error) {
    LBK_logError(`解析支付方式失敗: ${error.message} [${processId}]`, "支付方式解析", userId, "PAYMENT_METHOD_PARSE_ERROR", error.toString(), "LBK_parsePaymentMethod");

    // 錯誤時返回預設值
    return { method: 'cash', walletId: 'default_cash', walletName: '現金' };
  }
}


/**
 * 25. 解析支付方式 - 動態錢包查詢版本，增強銀行識別
 * @version 2025-12-17-V1.4.4
 * @date 2025-12-17 15:30:00
 * @description 從文字中解析支付方式，支援動態錢包查詢，並增強銀行名稱識別
 */
async function LBK_parsePaymentMethod(messageText, userId, processId) {
  const functionName = "LBK_parsePaymentMethod";
  try {
    LBK_logDebug(`解析支付方式: "${messageText}" [${processId}]`, "支付方式解析", userId, functionName);

    // 預設支付方式邏輯
    let detectedMethod = "刷卡"; // 預設值
    let walletId = "default_credit"; // 對應刷卡的預設wallet
    let walletName = "信用卡";

    // 增強的銀行名稱識別
    const bankNames = [
      "台銀", "土銀", "合庫", "第一", "華南", "彰銀", "上海", "國泰", "中信", "玉山", "台新", "永豐", "兆豐", "日盛", "安泰", "中國信託",
      "聯邦", "遠東", "元大", "凱基", "台北富邦", "國票", "新光", "陽信", "三信", "聯邦商銀", "台企銀",
      "高雄銀", "花旗", "渣打", "匯豐", "星展", "澳盛", "法國巴黎", "瑞士銀行", "德意志", "荷蘭", "比利時", "奧地利", "義大利", "西班牙", "葡萄牙"
    ];

    // 檢查是否包含特定支付方式關鍵字
    const paymentKeywords = [
      { keywords: ["現金"], method: "現金", walletId: "default_cash", walletName: "現金" },
      { keywords: ["刷卡", "信用卡"], method: "刷卡", walletId: "default_credit", walletName: "信用卡" },
      { keywords: ["轉帳", "銀行"], method: "轉帳", walletId: "default_bank", walletName: "銀行帳戶" },
      { keywords: ["行動支付", "支付寶", "微信", "Apple Pay", "Google Pay", "LINE Pay"], method: "行動支付", walletId: "default_mobile", walletName: "行動支付" }
    ];

    // 先檢查銀行名稱
    let detectedBank = null;
    for (const bankName of bankNames) {
      if (messageText.includes(bankName)) {
        detectedBank = bankName;
        detectedMethod = "轉帳"; // 檢測到銀行名稱時，預設為轉帳
        walletId = `bank_${bankName.toLowerCase()}`;
        walletName = `${bankName}銀行`;
        LBK_logDebug(`檢測到銀行名稱: ${bankName} → 轉帳`, "支付方式解析", userId, functionName);
        break;
      }
    }

    // 如果沒有檢測到銀行，再檢查一般支付方式關鍵字
    if (!detectedBank) {
      for (const paymentType of paymentKeywords) {
        for (const keyword of paymentType.keywords) {
          if (messageText.includes(keyword)) {
            detectedMethod = paymentType.method;
            walletId = paymentType.walletId;
            walletName = paymentType.walletName;
            LBK_logDebug(`檢測到支付方式關鍵字: ${keyword} → ${detectedMethod}`, "支付方式解析", userId, functionName);
            break;
          }
        }
        if (detectedMethod !== "刷卡") break; // 如果找到了就停止搜尋
      }
    }

    // 查詢用戶的可用錢包
    let userWallets = [];
    try {
      await LBK_initializeFirestore();
      const db = LBK_INIT_STATUS.firestore_db;
      const ledgerId = `user_${userId}`;

      const walletsSnapshot = await db.collection("ledgers").doc(ledgerId).collection("wallets")
        .where("status", "==", "active")
        .where("userId", "==", userId)
        .get();

      walletsSnapshot.forEach(doc => {
        const walletData = doc.data();
        userWallets.push({
          id: walletData.id || doc.id,
          name: walletData.name,
          type: walletData.type
        });
      });

      LBK_logDebug(`查詢到 ${userWallets.length} 個可用錢包`, "支付方式解析", userId, functionName);

    } catch (walletQueryError) {
      LBK_logWarning(`查詢用戶錢包失敗: ${walletQueryError.message}，使用預設設定`, "支付方式解析", userId, functionName);
    }

    // 嘗試在用戶錢包中找到匹配的支付方式
    const matchedWallet = userWallets.find(wallet => {
      // 精確匹配錢包名稱
      if (wallet.name === walletName) return true;
      // 如果檢測到銀行，嘗試匹配包含銀行名稱的錢包
      if (detectedBank && wallet.name.includes(detectedBank)) return true;
      // 匹配錢包類型
      if (wallet.type === detectedMethod.toLowerCase().replace("支付", "payment")) return true;
      return false;
    });

    if (matchedWallet) {
      LBK_logDebug(`在用戶錢包中找到匹配: ${matchedWallet.name}`, "支付方式解析", userId, functionName);
      return {
        method: matchedWallet.name,
        walletId: matchedWallet.id,
        walletName: matchedWallet.name
      };
    } else {
      // 沒找到匹配的錢包，返回檢測到的方式（用於新wallet流程）
      LBK_logDebug(`未在用戶錢包中找到 ${detectedMethod}(${walletName})，返回檢測結果用於新wallet流程`, "支付方式解析", userId, functionName);
      return {
        method: detectedMethod,
        walletId: walletId,
        walletName: walletName
      };
    }

  } catch (error) {
    LBK_logError(`解析支付方式失敗: ${error.toString()} [${processId}]`, "支付方式解析", userId, "PARSE_PAYMENT_ERROR", error.toString(), functionName);

    // 發生錯誤時返回預設預設現金
    return {
      method: "現金",
      walletId: "default_cash",
      walletName: "現金"
    };
  }
}


/**
 * 22. 處理新wallet分類選擇流程 - 階段二：支付方式類型選擇模式
 * @version 2025-12-18-V1.4.6
 * @description 當檢測到未知wallet時，引導用戶選擇支付方式類型（現金、銀行帳戶、信用卡）
 */
async function LBK_handleNewWallet(walletName, parsedData, inputData, processId) {
  const functionName = "LBK_handleNewWallet";
  try {
    LBK_logInfo(`處理支付方式類型選擇: ${walletName} [${processId}]`, "支付方式分類", parsedData.userId, functionName);

    // 儲存pending記帳資料到快取 - 使用簡短的key
    const shortKey = `W_${processId.slice(-6)}_${Date.now().toString().slice(-4)}`;

    const pendingWalletData = {
      walletName: walletName,
      originalData: parsedData,
      timestamp: new Date().toISOString(),
      processId: processId
    };

    // 使用短key儲存資料
    cacheInstance.set(shortKey, JSON.stringify(pendingWalletData), 600);

    // 生成支付方式類型選擇Quick Reply
    LBK_logInfo(`生成支付方式類型選單: ${walletName} [${processId}]`, "支付方式分類", parsedData.userId, functionName);

    const quickReply = {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '💵 現金',
            data: `wallet_type_cash_${shortKey}`,
            displayText: '歸類為現金'
          }
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '🏦 銀行帳戶',
            data: `wallet_type_bank_${shortKey}`,
            displayText: '歸類為銀行帳戶'
          }
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '💳 信用卡',
            data: `wallet_type_credit_${shortKey}`,
            displayText: '歸類為信用卡'
          }
        }
      ]
    };

    const responseMessage = `檢測到未知支付方式「${walletName}」\n\n請選擇此支付方式的類型：\n\n💵 現金\n🏦 銀行帳戶\n💳 信用卡\n\n選擇後將自動完成記帳`;

    return {
      success: true,
      message: responseMessage,
      responseMessage: responseMessage,
      quickReply: quickReply,
      moduleCode: "LBK",
      module: "LBK",
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.4.6",
      requiresUserSelection: true,
      walletTypeSelection: true,
      pendingWalletData: {
        key: shortKey,
        expiresAt: Date.now() + (600 * 1000), // 10分鐘
        walletName: walletName
      }
    };

  } catch (error) {
    LBK_logError(`處理支付方式類型選擇失敗: ${error.toString()} [${processId}]`, "支付方式分類", parsedData?.userId || "", "WALLET_TYPE_SELECTION_ERROR", error.toString(), functionName);

    return {
      success: false,
      message: "系統錯誤，無法處理支付方式類型選擇",
      responseMessage: "系統錯誤，無法處理支付方式類型選擇",
      moduleCode: "LBK",
      module: "LBK",
      processingTime: 0,
      moduleVersion: "1.4.6",
      errorType: "WALLET_TYPE_SELECTION_ERROR"
    };
  }
}

/**
 * 處理支付方式類型選擇postback事件 - 階段一：支付方式分類選擇模式，加入wallet synonyms更新邏輯
 * @version 2025-12-18-V1.4.6
 * @description 處理用戶對支付方式類型的選擇，直接將記帳資料映射到對應的預設錢包類型，並更新wallet synonyms欄位
 */
async function LBK_handleWalletConfirmationPostback(postbackData, userId, processId) {
  const functionName = "LBK_handleWalletConfirmationPostback";
  try {
    LBK_logInfo(`處理支付方式類型選擇postback: ${postbackData} [${processId}]`, "支付方式分類", userId, functionName);

    // 解析postback資料：wallet_type_{type}_{shortKey} 格式
    const parts = postbackData.split('_');
    if (parts.length < 4 || parts[0] !== 'wallet' || parts[1] !== 'type') {
      throw new Error('無效的支付方式類型選擇postback格式');
    }

    const selectedType = parts[2]; // cash, bank, credit
    const shortKey = parts.slice(3).join('_'); // 重組pending key

    // 從快取中取得原始資料
    let walletData = null;
    try {
      const cachedData = cacheInstance.get(shortKey);
      if (cachedData) {
        walletData = JSON.parse(cachedData);
      }
    } catch (cacheError) {
      throw new Error('無法取得支付方式選擇資料');
    }

    if (!walletData) {
      throw new Error('支付方式選擇資料已過期');
    }

    const walletName = walletData.walletName;
    const originalData = walletData.originalData;

    // 根據選擇的類型映射到對應的預設錢包
    const walletTypeMapping = {
      'cash': { walletId: 'default_cash', walletName: '現金', displayName: '現金' },
      'bank': { walletId: 'default_bank', walletName: '銀行帳戶', displayName: '銀行帳戶' },
      'credit': { walletId: 'default_credit', walletName: '信用卡', displayName: '信用卡' }
    };

    const selectedWallet = walletTypeMapping[selectedType];
    if (!selectedWallet) {
      throw new Error(`無效的支付方式類型: ${selectedType}`);
    }

    LBK_logInfo(`用戶選擇支付方式類型: ${walletName} → ${selectedWallet.displayName} [${processId}]`, "支付方式分類", userId, functionName);

    // 階段一修復：更新對應wallet的synonyms欄位
    const walletSynonymResult = await LBK_updateWalletSynonyms(
      `user_${userId}`, // ledgerId
      selectedWallet.walletId, // Use the mapped walletId
      walletName // original payment method name from user input
    );
    if (walletSynonymResult.success) {
      LBK_logInfo(`成功更新wallet synonyms: ${walletName} → ${selectedWallet.walletId} [${processId}]`, "支付方式分類", userId, functionName);
    } else {
      LBK_logWarning(`更新wallet synonyms失敗但繼續處理: ${walletSynonymResult.error} [${processId}]`, "支付方式分類", userId, functionName);
    }

    // 更新記帳資料的支付方式資訊
    originalData.paymentMethod = selectedWallet.walletName;
    originalData.walletId = selectedWallet.walletId;

    // 執行記帳
    const bookkeepingResult = await LBK_executeBookkeeping(originalData, processId);

    if (bookkeepingResult.success) {
      LBK_logInfo(`支付方式分類+記帳完整流程成功: ${walletName} → ${selectedWallet.displayName} [${processId}]`, "支付方式分類", userId, functionName);

      const successMessage = `✅ 已將「${walletName}」歸類為${selectedWallet.displayName}並完成記帳！\n\n${LBK_formatReplyMessage(bookkeepingResult.data, "LBK", { originalInput: `${originalData.subject}${originalData.rawAmount}` })}`;

      // 清除快取資料
      cacheInstance.del(shortKey);

      return {
        success: true,
        message: successMessage,
        responseMessage: successMessage,
        moduleCode: "LBK",
        module: "LBK",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.4.6",
        walletTypeMapped: true,
        originalWalletName: walletName,
        mappedWalletType: selectedWallet.displayName,
        walletId: selectedWallet.walletId,
        bookkeepingCompleted: true,
        transactionId: bookkeepingResult.data.id,
        synonymsUpdated: walletSynonymResult.success
      };
    } else {
      LBK_logError(`支付方式分類後記帳失敗: ${bookkeepingResult.error} [${processId}]`, "支付方式分類", userId, "BOOKKEEPING_AFTER_TYPE_SELECTION_ERROR", bookkeepingResult.error, functionName);

      const errorMessage = `✅ 已將「${walletName}」歸類為${selectedWallet.displayName}\n❌ 但記帳失敗：${bookkeepingResult.error}\n\n請重新輸入記帳資訊`;

      return {
        success: false,
        message: errorMessage,
        responseMessage: errorMessage,
        moduleCode: "LBK",
        module: "LBK",
        moduleVersion: "1.4.6",
        walletTypeMapped: true,
        originalWalletName: walletName,
        mappedWalletType: selectedWallet.displayName,
        bookkeepingCompleted: false,
        bookkeepingError: bookkeepingResult.error,
        errorType: "BOOKKEEPING_AFTER_TYPE_SELECTION_ERROR"
      };
    }

  } catch (error) {
    LBK_logError(`支付方式類型選擇postback處理失敗: ${error.toString()} [${processId}]`, "支付方式分類", userId, "WALLET_TYPE_POSTBACK_ERROR", error.toString(), functionName);

    return {
      success: false,
      message: "處理支付方式類型選擇時發生錯誤",
      responseMessage: "處理支付方式類型選擇時發生錯誤",
      moduleCode: "LBK",
      module: "LBK",
      moduleVersion: "1.4.6",
      errorType: "WALLET_TYPE_POSTBACK_ERROR",
      systemError: error.toString()
    };
  }
}

/**
 * 根據wallet名稱判斷wallet類型 - 統一邏輯
 */
function LBK_determineWalletType(walletName) {
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
 * 獲取wallet顯示名稱
 * @version 2025-12-18-V1.4.7
 * @param {string} walletId - 錢包ID
 * @param {string} ledgerId - 帳本ID
 * @returns {string} wallet顯示名稱
 */
function LBK_getWalletDisplayName(walletId, ledgerId = null) {
  try {
    // 預設wallet顯示名稱映射
    const defaultWalletNames = {
      'default_cash': '現金',
      'default_bank': '銀行帳戶', 
      'default_credit': '信用卡',
      'default_mobile': '行動支付'
    };

    // 如果是預設wallet，直接返回對應名稱
    if (defaultWalletNames[walletId]) {
      return defaultWalletNames[walletId];
    }

    // 如果不是預設wallet，返回wallet ID本身作為顯示名稱
    return walletId || '未知錢包';

  } catch (error) {
    LBK_logError(`獲取wallet顯示名稱失敗: ${error.toString()}`, "Wallet顯示", "", "GET_WALLET_DISPLAY_ERROR", error.toString(), "LBK_getWalletDisplayName");
    return walletId || '未知錢包';
  }
}

/**
 * 更新wallet同義詞
 * @version 2025-12-18-V1.4.7
 * @param {string} ledgerId - 帳本ID  
 * @param {string} walletId - 錢包ID
 * @param {string} originalPaymentMethod - 原始支付方式名稱
 * @returns {Object} 更新結果
 */
async function LBK_updateWalletSynonyms(ledgerId, walletId, originalPaymentMethod) {
  try {
    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    // 從Firestore讀取現有wallet資料
    const walletRef = db.collection(`ledgers/${ledgerId}/wallets`).doc(walletId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      return { success: false, message: `Wallet不存在: ${walletId}` };
    }

    const walletData = walletDoc.data();
    const currentSynonyms = walletData.synonyms || '';

    // 檢查是否已包含該同義詞
    const synonymsList = currentSynonyms ? currentSynonyms.split(',').map(s => s.trim()) : [];
    if (!synonymsList.includes(originalPaymentMethod)) {
      synonymsList.push(originalPaymentMethod);

      // 更新synonyms欄位
      await walletRef.update({
        synonyms: synonymsList.join(','),
        updatedAt: admin.firestore.Timestamp.now()
      });
    }

    return { success: true, message: 'Wallet synonyms更新成功' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * 輔助函數：建立科目同義詞關聯 - 修復版：正確查找科目文檔
 * @version 2025-12-17-V1.4.4
 * @description 確保同義詞關聯正確更新或創建科目記錄
 */
async function LBK_addSubjectSynonym(originalSubject, subjectId, subjectName, userId, processId) {
  try {
    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    const ledgerId = `user_${userId}`;

    LBK_logInfo(`開始新增同義詞: ${originalSubject} → 科目ID ${subjectId} (${subjectName}) [${processId}]`, "科目同義詞", userId, "LBK_addSubjectSynonym");

    // 修復：查找與 categoryId 匹配的文檔，而不是使用 subjectId 作為文檔ID
    const categoryQuery = await db.collection("ledgers").doc(ledgerId).collection("categories")
      .where("categoryId", "==", parseInt(subjectId))
      .limit(1)
      .get();

    if (categoryQuery.empty) {
      LBK_logWarning(`嘗試按categoryId查找失敗，改用文檔ID查找: ${subjectId} [${processId}]`, "科目同義詞", userId, "LBK_addSubjectSynonym");

      // 備用：直接嘗試用subjectId作為文檔ID
      const categoryRef = db.collection("ledgers").doc(ledgerId).collection("categories").doc(subjectId);
      const categoryDoc = await categoryRef.get();

      if (!categoryDoc.exists) {
        // 如果都找不到，創建新的科目記錄
        LBK_logInfo(`科目不存在，創建新科目記錄: ${subjectId} [${processId}]`, "科目同義詞", userId, "LBK_addSubjectSynonym");

        const newCategoryData = {
          categoryId: parseInt(subjectId),
          categoryName: subjectName,
          name: subjectName,
          synonyms: originalSubject, // 將原始輸入作為同義詞
          isActive: true,
          userId: userId,
          ledgerId: ledgerId,
          dataSource: "USER_CLASSIFICATION_LBK",
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        await categoryRef.set(newCategoryData);
        LBK_logInfo(`成功創建科目並新增同義詞: ${originalSubject} → ${subjectName} [${processId}]`, "科目同義詞", userId, "LBK_addSubjectSynonym");
        return { success: true, message: "科目已創建並新增同義詞" };
      } else {
        // 文檔存在，更新同義詞
        const categoryData = categoryDoc.data();
        const currentSynonyms = categoryData.synonyms ? categoryData.synonyms.split(',') : [];

        if (!currentSynonyms.includes(originalSubject)) {
          currentSynonyms.push(originalSubject);
          await categoryRef.update({
            synonyms: currentSynonyms.join(','),
            updatedAt: admin.firestore.Timestamp.now()
          });
          LBK_logInfo(`成功新增同義詞到現有科目: ${originalSubject} → ${subjectName} [${processId}]`, "科目同義詞", userId, "LBK_addSubjectSynonym");
        }
        return { success: true };
      }
    } else {
      // 找到匹配的科目，更新同義詞
      const categoryDoc = categoryQuery.docs[0];
      const categoryData = categoryDoc.data();
      const currentSynonyms = categoryData.synonyms ? categoryData.synonyms.split(',') : [];

      if (!currentSynonyms.includes(originalSubject)) {
        currentSynonyms.push(originalSubject);
        await categoryDoc.ref.update({
          synonyms: currentSynonyms.join(','),
          updatedAt: admin.firestore.Timestamp.now()
        });
        LBK_logInfo(`成功新增同義詞: ${originalSubject} → ${subjectName} [${processId}]`, "科目同義詞", userId, "LBK_addSubjectSynonym");
      } else {
        LBK_logInfo(`同義詞已存在: ${originalSubject} → ${subjectName} [${processId}]`, "科目同義詞", userId, "LBK_addSubjectSynonym");
      }

      return { success: true };
    }

  } catch (error) {
    LBK_logError(`新增科目同義詞失敗: ${error.toString()} [${processId}]`, "科目同義詞", userId, "ADD_SYNONYM_ERROR", error.toString(), "LBK_addSubjectSynonym");
    // 不拋出錯誤，讓上層函數繼續處理記帳
    return { success: false, error: error.toString() };
  }
}


// 導出模組
module.exports = {
  LBK_processQuickBookkeeping: LBK_processQuickBookkeeping,
  LBK_parseUserMessage: LBK_parseUserMessage,
  LBK_parseInputFormat: LBK_parseInputFormat,
  LBK_extractAmount: LBK_extractAmount,
  LBK_getSubjectCode: LBK_getSubjectCode,
  LBK_fuzzyMatch: LBK_fuzzyMatch,
  LBK_getAllSubjects: LBK_getAllSubjects,
  LBK_executeBookkeeping: LBK_executeBookkeeping,
  LBK_generateBookkeepingId: LBK_generateBookkeepingId,
  LBK_validateBookkeepingData: LBK_validateBookkeepingData,
  LBK_saveToFirestore: LBK_saveToFirestore,
  LBK_prepareBookkeepingData: LBK_prepareBookkeepingData,
  LBK_formatReplyMessage: LBK_formatReplyMessage,
  LBK_removeAmountFromText: LBK_removeAmountFromText,
  LBK_validatePaymentMethod: LBK_validatePaymentMethod,
  LBK_formatDateTime: LBK_formatDateTime,
  LBK_initialize: LBK_initialize,
  LBK_handleError: LBK_handleError,
  LBK_processAmountInternal: LBK_processAmountInternal,
  LBK_validateDataInternal: LBK_validateDataInternal,
  LBK_calculateStringSimilarity: LBK_calculateStringSimilarity,

  // 統計查詢函數 - v1.3.0新增
  LBK_checkStatisticsKeyword: LBK_checkStatisticsKeyword,
  LBK_handleStatisticsRequest: LBK_handleStatisticsRequest,
  LBK_buildStatisticsQuickReply: LBK_buildStatisticsQuickReply,
  LBK_processDirectStatistics: LBK_processDirectStatistics,
  LBK_getDirectStatistics: LBK_getDirectStatistics,
  LBK_formatStatisticsMessage: LBK_formatStatisticsMessage,

  // 新增支付方式解析函數
  LBK_parsePaymentMethod: LBK_parsePaymentMethod,
  // 新增wallet確認postback處理函數 v1.4.5
  LBK_handleWalletConfirmationPostback: LBK_handleWalletConfirmationPostback,
  LBK_determineWalletType: LBK_determineWalletType,

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

  // 階段一新增：wallet synonyms更新函數 - v1.4.7
  LBK_updateWalletSynonyms: LBK_updateWalletSynonyms,
  LBK_getWalletDisplayName: LBK_getWalletDisplayName,

  // 版本資訊
  MODULE_VERSION: "1.4.7",
  MODULE_NAME: "LBK",
  MODULE_UPDATE: "階段一：實作LBK_updateWalletSynonyms函數 - 補全缺失的wallet synonyms更新邏輯，確保記帳流程完整"
};