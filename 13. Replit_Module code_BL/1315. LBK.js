/**
 * LBK_快速記帳模組_1.1.3
 * @module LBK模組
 * @description LINE OA 專用快速記帳處理模組 - 修復循環依賴和回覆格式問題
 * @update 2025-07-22: 升級至v1.1.1，修復循環依賴問題，統一回覆格式標準，確保與WH模組相容性
 */

// 引入所需模組
const moment = require('moment-timezone');
const admin = require('firebase-admin');
const crypto = require('crypto');

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
const DL = require('./2010. DL.js');

// 引入SR模組 (延遲載入避免循環依賴)
let SR = null;
try {
  SR = require('./2005. SR.js');
} catch (error) {
  console.warn('LBK模組: SR模組載入失敗，統計功能將受限:', error.message);
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
  }
};

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

  try {
    LBK_logInfo(`開始處理LINE OA請求 [${processId}]`, "智慧路由", inputData.userId || "", "LBK_processQuickBookkeeping");

    // 第一步：檢查是否為統計查詢關鍵字
    const keywordCheckResult = await LBK_checkStatisticsKeyword(inputData.messageText, inputData.userId, processId);

    if (keywordCheckResult.isStatisticsRequest) {
      // 路由到SR模組處理統計查詢
      LBK_logInfo(`檢測到統計查詢關鍵字，路由至SR模組 [${processId}]`, "統計路由", inputData.userId || "", "LBK_processQuickBookkeeping");
      return await LBK_handleStatisticsRequest(keywordCheckResult.statisticsType, inputData, processId);
    }

    // 第二步：執行記帳處理邏輯
    LBK_logInfo(`執行記帳處理流程 [${processId}]`, "快速記帳", inputData.userId || "", "LBK_processQuickBookkeeping");

    // 解析用戶訊息
    const parseResult = await LBK_parseUserMessage(inputData.messageText, inputData.userId, processId);

    if (!parseResult.success) {
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
        moduleVersion: "1.1.1",
        errorType: parseResult.errorType || "PARSE_ERROR"
      };
    }

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

    // 格式化回覆訊息，傳遞原始輸入作為參考
    const replyMessage = LBK_formatReplyMessage(bookkeepingResult.data, "LBK", {
      originalInput: parseResult.data.subject
    });

    LBK_logInfo(`快速記帳完成 [${processId}]`, "快速記帳", inputData.userId || "", "LBK_processQuickBookkeeping");

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
    LBK_logError(`快速記帳處理失敗: ${error.toString()} [${processId}]`, "快速記帳", inputData.userId || "", "PROCESS_ERROR", error.toString(), "LBK_processQuickBookkeeping");

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
      return {
        success: false,
        error: `找不到科目: ${parseResult.subject}`,
        errorType: "SUBJECT_NOT_FOUND"
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
 * @version 2025-07-15-V1.0.3
 * @date 2025-07-15 09:30:00
 * @description 解析標準輸入格式，移除正負號邏輯，基於科目代碼判斷收支類型
 */
function LBK_parseInputFormat(message, processId) {
  LBK_logDebug(`開始解析格式: "${message}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");

  if (!message || message.trim() === "") {
    return null;
  }

  message = message.trim();

  try {
    // 只支援標準格式處理 (早餐33333)
    const standardPattern = /^(.+?)(\d+)(.*)$/;
    const standardMatch = message.match(standardPattern);

    if (standardMatch) {
      const subject = standardMatch[1].trim();
      const rawAmount = standardMatch[2];
      const amount = parseInt(rawAmount, 10);

      // 檢查前導零
      if (rawAmount.length > 1 && rawAmount.startsWith('0')) {
        LBK_logWarning(`金額格式錯誤：前導零不被允許 "${rawAmount}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
        return null;
      }

      if (amount <= 0) {
        LBK_logWarning(`金額錯誤：金額必須大於0 [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
        return null;
      }

      // 預設支付方式為刷卡（後續會根據科目代碼調整）
      let paymentMethod = "刷卡";
      let remainingText = standardMatch[3].trim();

      // 移除支援的幣別單位
      const supportedUnits = /(元|塊|圓)$/i;
      const unsupportedUnits = /(NT|USD|\$)$/i;

      if (unsupportedUnits.test(remainingText)) {
        LBK_logWarning(`不支援的幣別單位 "${remainingText}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
        return null;
      }

      remainingText = remainingText.replace(supportedUnits, '').trim();

      // 檢查是否指定支付方式
      const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳"];
      for (const method of paymentMethods) {
        if (remainingText.includes(method)) {
          paymentMethod = method;
          break;
        }
      }

      return {
        subject: subject,
        amount: amount,
        rawAmount: rawAmount,
        paymentMethod: paymentMethod
      };
    }

    return null;

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

    const snapshot = await db.collection("ledgers").doc(ledgerId).collection("subjects").where("isActive", "==", true).get();

    if (snapshot.empty) {
      throw new Error("科目表為空");
    }

    // 優化的匹配算法
    let exactMatch = null;
    let synonymMatch = null;
    let partialMatches = [];

    for (const doc of snapshot.docs) {
      if (doc.id === "template") continue;

      const data = doc.data();
      const subName = String(data.子項名稱).trim().toLowerCase();

      // 1. 精確匹配 - 最高優先級
      if (subName === normalizedInput) {
        exactMatch = {
          majorCode: String(data.大項代碼),
          majorName: String(data.大項名稱),
          subCode: String(data.子項代碼),
          subName: String(data.子項名稱)
        };
        break;
      }

      // 2. 同義詞精確匹配 - 第二優先級
      const synonymsStr = data.同義詞 || "";
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const synonym of synonyms) {
          const synonymLower = synonym.trim().toLowerCase();
          if (synonymLower === normalizedInput) {
            synonymMatch = {
              majorCode: String(data.大項代碼),
              majorName: String(data.大項名稱),
              subCode: String(data.子項代碼),
              subName: String(data.子項名稱)
            };
            break;
          }
        }
      }

      // 3. 部分匹配 - 包含關係
      if (subName.includes(normalizedInput) || normalizedInput.includes(subName)) {
        partialMatches.push({
          majorCode: String(data.大項代碼),
          majorName: String(data.大項名稱),
          subCode: String(data.子項代碼),
          subName: String(data.子項名稱),
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

      // 3. 同義詞匹配
      if (subject.synonyms) {
        const synonymsList = subject.synonyms.split(",").map(syn => syn.trim().toLowerCase());
        for (const synonym of synonymsList) {
          if (synonym === inputLower) {
            matches.push({
              ...subject,
              score: 0.98,
              matchType: "synonym_exact_match"
            });
          } else if (synonym.includes(inputLower) && inputLower.length >= 2) {
            const score = (inputLower.length / synonym.length) * 0.85;
            matches.push({
              ...subject,
              score: Math.min(0.85, score),
              matchType: "synonym_contains_input"
            });
          } else if (inputLower.includes(synonym) && synonym.length >= 2) {
            const score = (synonym.length / inputLower.length) * 0.8;
            matches.push({
              ...subject,
              score: Math.min(0.8, score),
              matchType: "input_contains_synonym"
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
    const subjectsRef = db.collection("ledgers").doc(ledgerId).collection("subjects");
    const snapshot = await subjectsRef.where("isActive", "==", true).get();

    if (snapshot.empty) {
      return [];
    }

    const subjects = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (doc.id === "template") return;

      subjects.push({
        majorCode: data.大項代碼,
        majorName: data.大項名稱,
        subCode: data.子項代碼,
        subName: data.子項名稱,
        synonyms: data.同義詞 || ""
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

      // 生成記帳ID
      const bookkeepingId = await LBK_generateBookkeepingId(bookkeepingData.userId, processId);

      // 準備記帳資料
      const preparedData = LBK_prepareBookkeepingData(bookkeepingId, bookkeepingData, processId);

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

      return {
        success: true,
        data: {
          id: bookkeepingId,
          amount: bookkeepingData.amount,
          type: bookkeepingData.action === "收入" ? "income" : "expense",
          subject: bookkeepingData.subjectName,
          paymentMethod: bookkeepingData.paymentMethod,
          timestamp: new Date().toISOString()
        }
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
 * 09. 生成唯一記帳ID - 強化唯一性保證
 * @version 2025-07-15-V1.0.7
 * @date 2025-07-15 19:10:00
 * @description 生成格式為YYYYMMDD-NNNNN的唯一記帳ID，加強併發安全性和唯一性保證
 */
async function LBK_generateBookkeepingId(userId, processId) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;

    // 使用事務確保併發安全性
    const result = await db.runTransaction(async (transaction) => {
      // 查詢當天的所有記錄
      const todayQuery = await db
        .collection('ledgers')
        .doc(`user_${userId}`)
        .collection('entries')
        .where('收支ID', '>=', dateStr + '-00000')
        .where('收支ID', '<=', dateStr + '-99999')
        .orderBy('收支ID', 'desc')
        .limit(1)
        .get();

      let maxSerialNumber = 0;

      if (!todayQuery.empty) {
        const lastDoc = todayQuery.docs[0];
        const lastId = lastDoc.data().收支ID;
        if (lastId && lastId.startsWith(dateStr + '-')) {
          const serialPart = lastId.split('-')[1];
          if (serialPart) {
            const serialNumber = parseInt(serialPart, 10);
            if (!isNaN(serialNumber)) {
              maxSerialNumber = serialNumber;
            }
          }
        }
      }

      // 生成新的序列號
      const nextSerialNumber = maxSerialNumber + 1;
      const formattedNumber = nextSerialNumber.toString().padStart(5, '0');
      const bookkeepingId = `${dateStr}-${formattedNumber}`;

      // 加入微秒時間戳確保唯一性
      const microTimestamp = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      const uniqueId = `${bookkeepingId}-${microTimestamp.toString(36)}`;

      // 檢查ID是否已存在（雙重驗證）
      const existingDoc = await db
        .collection('ledgers')
        .doc(`user_${userId}`)
        .collection('entries')
        .where('收支ID', '==', bookkeepingId)
        .limit(1)
        .get();

      if (!existingDoc.empty) {
        // 如果ID已存在，使用帶時間戳的唯一ID
        return uniqueId;
      }

      return bookkeepingId;
    });

    return result;

  } catch (error) {
    LBK_logError(`生成記帳ID失敗: ${error.toString()} [${processId}]`, "ID生成", userId, "ID_GEN_ERROR", error.toString(), "LBK_generateBookkeepingId");

    // 強化的備用ID生成
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    const processHash = processId ? processId.slice(-4) : '0000';
    const fallbackId = `F${timestamp}-${random}-${processHash}`;
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
 * 11. 儲存記帳資料至Firestore - 加入併發處理優化
 * @version 2025-07-```javascript
15-V1.0.1
 * @date 2025-07-15 19:10:00
 * @description 將記帳資料儲存至Firestore，確保資料一致性和併發安全性
 */
async function LBK_saveToFirestore(bookkeepingData, processId) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await LBK_initializeFirestore();
      const db = LBK_INIT_STATUS.firestore_db;

      const firestoreData = {
        收支ID: bookkeepingData[0],
        使用者類型: bookkeepingData[1],
        日期: bookkeepingData[2],
        時間: bookkeepingData[3],
        大項代碼: bookkeepingData[4],
        子項代碼: bookkeepingData[5],
        支付方式: bookkeepingData[6],
        子項名稱: bookkeepingData[7],
        UID: bookkeepingData[8],
        備註: bookkeepingData[9],
        收入: bookkeepingData[10] || null,
        支出: bookkeepingData[11] || null,
        同義詞: bookkeepingData[12] || '',
        currency: 'NTD',
        timestamp: admin.firestore.Timestamp.now(),
        processId: processId || '',
        attempt: attempt
      };

      // 確保使用正確的用戶帳本格式
    const userId = bookkeepingData[8];
    const ledgerId = `user_${userId}`;

    LBK_logInfo(`使用用戶帳本: ${ledgerId} [${processId}]`, "資料儲存", userId, "LBK_saveToFirestore");

    // 使用事務確保併發安全性
    const result = await db.runTransaction(async (transaction) => {
      // 檢查是否已存在相同的收支ID
      const existingQuery = await db
        .collection('ledgers')
        .doc(ledgerId)
        .collection('entries')
        .where('收支ID', '==', bookkeepingData[0])
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        throw new Error(`收支ID已存在: ${bookkeepingData[0]}`);
      }

      // 新增文檔到正確的用戶帳本
      const docRef = db
        .collection('ledgers')
        .doc(ledgerId)
        .collection('entries')
        .doc();

      transaction.set(docRef, firestoreData);
      return docRef;
    });

      return {
        success: true,
        docId: result.id,
        firestoreData: firestoreData,
        attempt: attempt
      };

    } catch (error) {
      lastError = error.toString();

      if (attempt < maxRetries) {
        LBK_logWarning(`Firestore儲存嘗試 ${attempt} 失敗，準備重試: ${error.toString()} [${processId}]`, "資料儲存", "", "LBK_saveToFirestore");

        // 指數退避延遲
        const delay = Math.pow(2, attempt - 1) * 500 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      LBK_logError(`儲存到Firestore失敗 (${maxRetries}次重試後): ${error.toString()} [${processId}]`, "資料儲存", "", "SAVE_ERROR", error.toString(), "LBK_saveToFirestore");
    }
  }

  return {
    success: false,
    error: `儲存失敗 (${maxRetries}次重試後): ${lastError}`,
    totalAttempts: maxRetries
  };
}

/**
 * 12. 準備記帳資料
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 將解析後的資料轉換為Firestore格式
 */
function LBK_prepareBookkeepingData(bookkeepingId, data, processId) {
  try {
    const today = new Date();
    const formattedDate = moment(today).tz(LBK_CONFIG.TIMEZONE).format("YYYY/MM/DD");
    const formattedTime = moment(today).tz(LBK_CONFIG.TIMEZONE).format("HH:mm");

    let income = '', expense = '';

    if (data.action === "收入") {
      income = data.amount.toString();
    } else {
      expense = data.amount.toString();
    }

    const remarkContent = data.subject || '';

    return [
      bookkeepingId,                    // 1. 收支ID
      "J",                             // 2. 使用者類型
      formattedDate,                   // 3. 日期
      formattedTime,                   // 4. 時間
      data.majorCode,                  // 5. 大項代碼
      data.subjectCode,                // 6. 子項代碼
      data.paymentMethod,              // 7. 支付方式
      data.subjectName,                // 8. 子項名稱
      data.userId,                     // 9. UID
      remarkContent,                   // 10. 備註
      income,                          // 11. 收入
      expense,                         // 12. 支出
      ''                              // 13. 同義詞
    ];

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

    // 檢查是否為成功的記帳結果
    if (resultData && resultData.id) {
      // 從原始資料中提取用戶輸入的備註（去除金額後的部分）
      const originalInput = options.originalInput || resultData.subject;
      const remark = LBK_removeAmountFromText(originalInput, resultData.amount, resultData.paymentMethod);

      return `記帳成功！\n` +
             `金額：${resultData.amount}元 (${resultData.type === 'income' ? '收入' : '支出'})\n` +
             `支付方式：${resultData.paymentMethod}\n` +
             `時間：${currentDateTime}\n` +
             `科目：${resultData.subject}\n` +
             `備註：${remark}\n` +
             `收支ID：${resultData.id}\n` +
             `使用者類型：J`;
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

      // 統一的7行錯誤格式
      return `記帳失敗！\n` +
             `金額：${amount}元\n` +
             `支付方式：${paymentMethod}\n` +
             `時間：${currentDateTime}\n` +
             `科目：${subject}\n` +
             `備註：${originalInput}\n` +
             `使用者類型：J\n` +
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
           `使用者類型：J\n` +
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

// 輔助函數：識別科目
async function LBK_identifySubject(subject, userId, processId) {
  try {
    // 首先嘗試精確匹配
    const exactMatch = await LBK_getSubjectCode(subject, userId, processId);

    // 判斷收支類型：8和9開頭為收入，其他為支出
    const majorCode = exactMatch.majorCode;
    const isIncome = String(majorCode).startsWith('8') || String(majorCode).startsWith('9');

    return {
      success: true,
      data: {
        subjectCode: exactMatch.subCode,
        subjectName: exactMatch.subName,
        majorCode: exactMatch.majorCode,
        isIncome: isIncome,
        defaultPaymentMethod: isIncome ? "現金" : "刷卡"
      }
    };

  } catch (error) {
    // 嘗試模糊匹配
    const fuzzyMatch = await LBK_fuzzyMatch(subject, 0.7, userId, processId);

    if (fuzzyMatch) {
      // 判斷收支類型
      const majorCode = fuzzyMatch.majorCode;
      const isIncome = String(majorCode).startsWith('8') || String(majorCode).startsWith('9');

      return {
        success: true,
        data: {
          subjectCode: fuzzyMatch.subCode,
          subjectName: fuzzyMatch.subName,
          majorCode: fuzzyMatch.majorCode,
          isIncome: isIncome,
          defaultPaymentMethod: isIncome ? "現金" : "刷卡"
        }
      };
    }

    return {
      success: false,
      error: `找不到科目: ${subject}`
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
 * 45. 檢查統計查詢關鍵字 - 直接使用SR模組關鍵字配置
 * @version 2025-01-09-V1.1.0
 * @date 2025-01-09 20:30:00
 * @description 直接從SR模組讀取統計查詢關鍵字配置，確保關鍵字統一管理和自動同步
 */
async function LBK_checkStatisticsKeyword(messageText, userId, processId) {
  try {
    if (!messageText || typeof messageText !== 'string') {
      return { isStatisticsRequest: false };
    }

    const normalizedText = messageText.trim().toLowerCase();

    // 直接使用SR模組的關鍵字配置，確保一致性
    let statisticsKeywords = {};

    // 檢查SR模組是否可用並有配置
    if (SR && SR.SR_QUICK_REPLY_CONFIG && SR.SR_QUICK_REPLY_CONFIG.STATISTICS) {
      const srConfig = SR.SR_QUICK_REPLY_CONFIG.STATISTICS;
      statisticsKeywords = {
        [srConfig.TODAY.label]: { type: 'daily', postbackData: srConfig.TODAY.postbackData },
        [srConfig.WEEKLY.label]: { type: 'weekly', postbackData: srConfig.WEEKLY.postbackData },
        [srConfig.MONTHLY.label]: { type: 'monthly', postbackData: srConfig.MONTHLY.postbackData },
        // 額外的常用別名
        '週統計': { type: 'weekly', postbackData: srConfig.WEEKLY.postbackData },
        '月統計': { type: 'monthly', postbackData: srConfig.MONTHLY.postbackData },
        '統計': { type: 'daily', postbackData: srConfig.TODAY.postbackData },
        'stats': { type: 'daily', postbackData: srConfig.TODAY.postbackData }
      };

      LBK_logDebug(`從SR模組載入統計關鍵字配置 [${processId}]`, "關鍵字檢核", userId, "LBK_checkStatisticsKeyword");
    } else {
      // SR模組不可用時的備用配置
      statisticsKeywords = {
        '今日統計': { type: 'daily', postbackData: '今日統計' },
        '本週統計': { type: 'weekly', postbackData: '本週統計' },
        '本月統計': { type: 'monthly', postbackData: '本月統計' },
        '週統計': { type: 'weekly', postbackData: '本週統計' },
        '月統計': { type: 'monthly', postbackData: '本月統計' },
        '統計': { type: 'daily', postbackData: '今日統計' },
        'stats': { type: 'daily', postbackData: '今日統計' }
      };

      LBK_logWarning(`SR模組不可用，使用備用關鍵字配置 [${processId}]`, "關鍵字檢核", userId, "LBK_checkStatisticsKeyword");
    }

    // 精確匹配檢查
    for (const [keyword, config] of Object.entries(statisticsKeywords)) {
      if (normalizedText === keyword.toLowerCase() || normalizedText === keyword) {
        LBK_logInfo(`匹配統計關鍵字: "${keyword}" -> ${config.type} [${processId}]`, "關鍵字檢核", userId, "LBK_checkStatisticsKeyword");

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
 * 46. 處理統計查詢請求
 * @version 2025-07-22-V1.1.0
 * @date 2025-07-22 10:30:00
 * @description 呼叫SR模組處理統計查詢，並格式化回應訊息
 */
async function LBK_handleStatisticsRequest(statisticsType, inputData, processId) {
  try {
    LBK_logInfo(`處理統計請求: ${statisticsType} [${processId}]`, "統計處理", inputData.userId || "", "LBK_handleStatisticsRequest");

    // 檢查SR模組可用性
    if (!SR || typeof SR.SR_processQuickReplyStatistics !== 'function') {
      throw new Error('SR模組不可用或缺少必要函數');
    }

    // 建構postbackData
    const postbackDataMap = {
      'daily': '今日統計',
      'weekly': '本週統計', 
      'monthly': '本月統計'
    };

    const postbackData = postbackDataMap[statisticsType] || '今日統計';

    // 呼叫SR模組處理統計
    const srResult = await SR.SR_processQuickReplyStatistics(inputData.userId, postbackData);

    if (srResult.success) {
      // 統計查詢成功
      return {
        success: true,
        message: srResult.message,
        responseMessage: srResult.message,
        quickReply: srResult.quickReply,
        moduleCode: "SR",
        module: "SR",
        processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
        moduleVersion: "1.4.2",
        statisticsType: statisticsType
      };
    } else {
      // 統計查詢失敗，返回友善錯誤訊息
      const errorMessage = `📊 ${postbackData}\n\n暫時無法取得統計資料，請稍後再試。\n\n💡 您也可以嘗試輸入記帳格式開始記帳`;

      return {
        success: false,
        message: errorMessage,
        responseMessage: errorMessage,
        moduleCode: "SR",
        module: "SR", 
        processingTime: 0,
        moduleVersion: "1.4.2",
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
      moduleVersion: "1.1.0",
      errorType: "SYSTEM_ERROR"
    };
  }
}

/**
 * 47. 建立統計Quick Reply按鈕
 * @version 2025-07-22-V1.1.0
 * @date 2025-07-22 10:30:00This commit modifies the `LBK_saveToFirestore` function to use the correct user-specific ledger ID when saving data.
```javascript
 * @description 為統計查詢結果建立Quick Reply按鈕選項
 */
function LBK_buildStatisticsQuickReply(userId, currentType) {
  try {
    const quickReplyItems = [];

    // 基礎統計選項
    if (currentType !== 'daily') {
      quickReplyItems.push({ label: '今日統計', postbackData: '今日統計' });
    }
    if (currentType !== 'weekly') {
      quickReplyItems.push({ label: '本週統計', postbackData: '本週統計' });
    }
    if (currentType !== 'monthly') {
      quickReplyItems.push({ label: '本月統計', postbackData: '本月統計' });
    }

    // 確保至少有一個選項
    if (quickReplyItems.length === 0) {
      quickReplyItems.push({ label: '今日統計', postbackData: '今日統計' });
    }

    // 限制最多4個選項
    return {
      type: 'quick_reply',
      items: quickReplyItems.slice(0, 4)
    };

  } catch (error) {
    return {
      type: 'quick_reply',
      items: [{ label: '今日統計', postbackData: '今日統計' }]
    };
  }
}

// 確保所有函數都正確導出，避免循環依賴問題
const LBK_MODULE = {
  // 核心函數 - 確保正確導出
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

  // 新增函數
  LBK_checkStatisticsKeyword: LBK_checkStatisticsKeyword,
  LBK_handleStatisticsRequest: LBK_handleStatisticsRequest,
  LBK_buildStatisticsQuickReply: LBK_buildStatisticsQuickReply,

  // 版本資訊
  MODULE_VERSION: "1.1.3",
  MODULE_NAME: "LBK"
};

// 導出模組
module.exports = LBK_MODULE;