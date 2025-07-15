
/**
 * LBK_快速記帳模組_1.0.0
 * @module LBK模組
 * @description LINE OA 專用快速記帳處理模組 - 簡化記帳流程，實現極速處理
 * @update 2025-07-15: 初版建立，從BK模組分離核心功能，專門處理LINE OA快速記帳
 */

// 引入所需模組
const moment = require('moment-timezone');
const admin = require('firebase-admin');
const crypto = require('crypto');

// 確保 Firebase Admin 在模組載入時就初始化
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./Serviceaccountkey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
    });
    console.log('🔥 LBK模組: Firebase Admin 自動初始化完成');
  } catch (error) {
    console.error('❌ LBK模組: Firebase Admin 自動初始化失敗:', error);
  }
}

// 引入DL模組
const DL = require('./2010. DL.js');

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
 * 01. 處理快速記帳的主函數
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 接收WH模組的記帳請求，執行完整的記帳處理流程
 */
async function LBK_processQuickBookkeeping(inputData) {
  const processId = inputData.processId || crypto.randomUUID().substring(0, 8);
  
  try {
    LBK_logInfo(`開始處理快速記帳 [${processId}]`, "快速記帳", inputData.userId || "", "LBK_processQuickBookkeeping");
    
    // 解析用戶訊息
    const parseResult = await LBK_parseUserMessage(inputData.messageText, inputData.userId, processId);
    
    if (!parseResult.success) {
      return {
        success: false,
        message: parseResult.error || "解析失敗",
        processingTime: 0,
        moduleVersion: "1.0.0",
        errorType: parseResult.errorType || "PARSE_ERROR"
      };
    }
    
    // 執行記帳
    const bookkeepingResult = await LBK_executeBookkeeping(parseResult.data, processId);
    
    if (!bookkeepingResult.success) {
      return {
        success: false,
        message: bookkeepingResult.error || "記帳失敗",
        processingTime: 0,
        moduleVersion: "1.0.0",
        errorType: bookkeepingResult.errorType || "BOOKING_ERROR"
      };
    }
    
    // 格式化回覆訊息
    const replyMessage = LBK_formatReplyMessage(bookkeepingResult.data, "LBK");
    
    LBK_logInfo(`快速記帳完成 [${processId}]`, "快速記帳", inputData.userId || "", "LBK_processQuickBookkeeping");
    
    return {
      success: true,
      message: replyMessage,
      data: bookkeepingResult.data,
      processingTime: (Date.now() - parseInt(processId, 16)) / 1000,
      moduleVersion: "1.0.0"
    };
    
  } catch (error) {
    LBK_logError(`快速記帳處理失敗: ${error.toString()} [${processId}]`, "快速記帳", inputData.userId || "", "PROCESS_ERROR", error.toString(), "LBK_processQuickBookkeeping");
    
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      processingTime: 0,
      moduleVersion: "1.0.0",
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
    
    return {
      success: true,
      data: {
        subject: parseResult.subject,
        amount: parseResult.amount,
        rawAmount: parseResult.rawAmount,
        paymentMethod: parseResult.paymentMethod,
        subjectCode: subjectResult.data.subjectCode,
        subjectName: subjectResult.data.subjectName,
        majorCode: subjectResult.data.majorCode,
        action: parseResult.amount > 0 ? "收入" : "支出",
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
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 解析各種輸入格式，支援正負號、金額、科目識別
 */
function LBK_parseInputFormat(message, processId) {
  LBK_logDebug(`開始解析格式: "${message}" [${processId}]`, "格式解析", "", "LBK_parseInputFormat");
  
  if (!message || message.trim() === "") {
    return null;
  }
  
  message = message.trim();
  
  try {
    // 檢測負數模式 (午餐-100)
    const negativePattern = /^(.+?)(-\d+)(.*)$/;
    const negativeMatch = message.match(negativePattern);
    
    if (negativeMatch) {
      const subject = negativeMatch[1].trim();
      const rawAmount = negativeMatch[2];
      const amount = Math.abs(parseFloat(rawAmount));
      
      let paymentMethod = "現金";
      const remainingText = negativeMatch[3].trim();
      
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
        rawAmount: String(amount),
        paymentMethod: paymentMethod,
        isNegative: true
      };
    }
    
    // 標準格式處理 (午餐100)
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
        paymentMethod: paymentMethod,
        isNegative: false
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
 * 05. 獲取科目代碼
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 根據科目名稱查詢對應的科目代碼
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
    
    // 精確匹配
    for (const doc of snapshot.docs) {
      if (doc.id === "template") continue;
      
      const data = doc.data();
      const subName = String(data.子項名稱).trim().toLowerCase();
      
      if (subName === normalizedInput) {
        return {
          majorCode: String(data.大項代碼),
          majorName: String(data.大項名稱),
          subCode: String(data.子項代碼),
          subName: String(data.子項名稱)
        };
      }
      
      // 同義詞匹配
      const synonymsStr = data.同義詞 || "";
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const synonym of synonyms) {
          const synonymLower = synonym.trim().toLowerCase();
          if (synonymLower === normalizedInput) {
            return {
              majorCode: String(data.大項代碼),
              majorName: String(data.大項名稱),
              subCode: String(data.子項代碼),
              subName: String(data.子項名稱)
            };
          }
        }
      }
    }
    
    throw new Error(`找不到科目: ${subjectName}`);
    
  } catch (error) {
    LBK_logError(`查詢科目代碼失敗: ${error.toString()} [${processId}]`, "科目查詢", userId, "SUBJECT_ERROR", error.toString(), "LBK_getSubjectCode");
    throw error;
  }
}

/**
 * 06. 模糊匹配科目
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 當精確匹配失敗時，使用模糊匹配尋找最相似的科目
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
    
    const containsMatches = [];
    
    allSubjects.forEach((subject) => {
      const subNameLower = subject.subName.toLowerCase();
      
      // 包含匹配
      if (subNameLower.length >= 2 && inputLower.includes(subNameLower)) {
        const score = (subNameLower.length / inputLower.length) * 0.9;
        containsMatches.push({
          ...subject,
          score: Math.min(0.9, score),
          matchType: "input_contains_subject_name"
        });
      }
      
      // 同義詞包含匹配
      if (subject.synonyms) {
        const synonymsList = subject.synonyms.split(",").map(syn => syn.trim().toLowerCase());
        for (const synonym of synonymsList) {
          if (synonym.length >= 2 && inputLower.includes(synonym)) {
            const score = (synonym.length / inputLower.length) * 0.95;
            containsMatches.push({
              ...subject,
              score: Math.min(0.95, score),
              matchType: "input_contains_synonym"
            });
          }
        }
      }
    });
    
    if (containsMatches.length > 0) {
      containsMatches.sort((a, b) => b.score - a.score);
      const bestMatch = containsMatches[0];
      
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
 * 08. 執行記帳操作
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 執行實際的記帳操作，包含資料驗證和儲存
 */
async function LBK_executeBookkeeping(bookkeepingData, processId) {
  try {
    LBK_logDebug(`執行記帳操作 [${processId}]`, "記帳執行", bookkeepingData.userId, "LBK_executeBookkeeping");
    
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
    const bookkeepingId = await LBK_generateBookkeepingId(processId);
    
    // 準備記帳資料
    const preparedData = LBK_prepareBookkeepingData(bookkeepingId, bookkeepingData, processId);
    
    // 儲存到Firestore
    const saveResult = await LBK_saveToFirestore(preparedData, processId);
    
    if (!saveResult.success) {
      return {
        success: false,
        error: saveResult.error,
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
    LBK_logError(`執行記帳操作失敗: ${error.toString()} [${processId}]`, "記帳執行", bookkeepingData.userId, "EXECUTE_ERROR", error.toString(), "LBK_executeBookkeeping");
    
    return {
      success: false,
      error: error.toString(),
      errorType: "EXECUTE_ERROR"
    };
  }
}

/**
 * 09. 生成唯一記帳ID
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 生成格式為YYYYMMDD-NNNNN的唯一記帳ID
 */
async function LBK_generateBookkeepingId(processId) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    await LBK_initializeFirestore();
    const db = LBK_INIT_STATUS.firestore_db;
    
    // 查詢當天的所有記錄
    const todayQuery = await db
      .collection('ledgers')
      .doc('ledger_structure_001')
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
    
    const nextSerialNumber = maxSerialNumber + 1;
    const formattedNumber = nextSerialNumber.toString().padStart(5, '0');
    const bookkeepingId = `${dateStr}-${formattedNumber}`;
    
    return bookkeepingId;
    
  } catch (error) {
    LBK_logError(`生成記帳ID失敗: ${error.toString()} [${processId}]`, "ID生成", "", "ID_GEN_ERROR", error.toString(), "LBK_generateBookkeepingId");
    
    const timestamp = new Date().getTime();
    const fallbackId = `F${timestamp}`;
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
 * 11. 儲存記帳資料至Firestore
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 將記帳資料儲存至Firestore，確保資料一致性
 */
async function LBK_saveToFirestore(bookkeepingData, processId) {
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
      timestamp: admin.firestore.Timestamp.now()
    };
    
    const docRef = await db
      .collection('ledgers')
      .doc(`user_${bookkeepingData[8]}`)
      .collection('entries')
      .add(firestoreData);
    
    return {
      success: true,
      docId: docRef.id,
      firestoreData: firestoreData
    };
    
  } catch (error) {
    LBK_logError(`儲存到Firestore失敗: ${error.toString()} [${processId}]`, "資料儲存", "", "SAVE_ERROR", error.toString(), "LBK_saveToFirestore");
    
    return {
      success: false,
      error: "儲存失敗: " + error.toString()
    };
  }
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
 * @version 2025-07-15-V1.0.0
 * @date 2025-07-15 09:30:00
 * @description 格式化成功或失敗的回覆訊息
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
    
    if (resultData && resultData.id) {
      return `記帳成功！\n` +
             `收支ID：${resultData.id}\n` +
             `金額：${resultData.amount}元 (${resultData.type === 'income' ? '收入' : '支出'})\n` +
             `支付方式：${resultData.paymentMethod}\n` +
             `時間：${currentDateTime}\n` +
             `科目：${resultData.subject}\n` +
             `備註：${resultData.subject}\n` +
             `使用者類型：J`;
    } else {
      return `記帳失敗！\n` +
             `時間：${currentDateTime}\n` +
             `錯誤原因：處理失敗`;
    }
    
  } catch (error) {
    return `記帳失敗！\n時間：${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}\n錯誤原因：訊息格式化錯誤`;
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
    const amountEndRegex = new RegExp(`${amountStr}(元|塊|圓)$`, "i");
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

// 輔助函數：識別科目
async function LBK_identifySubject(subject, userId, processId) {
  try {
    // 首先嘗試精確匹配
    const exactMatch = await LBK_getSubjectCode(subject, userId, processId);
    
    return {
      success: true,
      data: {
        subjectCode: exactMatch.subCode,
        subjectName: exactMatch.subName,
        majorCode: exactMatch.majorCode
      }
    };
    
  } catch (error) {
    // 嘗試模糊匹配
    const fuzzyMatch = await LBK_fuzzyMatch(subject, 0.7, userId, processId);
    
    if (fuzzyMatch) {
      return {
        success: true,
        data: {
          subjectCode: fuzzyMatch.subCode,
          subjectName: fuzzyMatch.subName,
          majorCode: fuzzyMatch.majorCode
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
      
      const serviceAccount = require('./Serviceaccountkey.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
      });
      
      console.log('✅ LBK模組: Firebase Admin 初始化完成');
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

// 導出模組函數
module.exports = {
  LBK_processQuickBookkeeping,
  LBK_parseUserMessage,
  LBK_parseInputFormat,
  LBK_extractAmount,
  LBK_getSubjectCode,
  LBK_fuzzyMatch,
  LBK_getAllSubjects,
  LBK_executeBookkeeping,
  LBK_generateBookkeepingId,
  LBK_validateBookkeepingData,
  LBK_saveToFirestore,
  LBK_prepareBookkeepingData,
  LBK_formatReplyMessage,
  LBK_removeAmountFromText,
  LBK_validatePaymentMethod,
  LBK_formatDateTime,
  LBK_initialize,
  LBK_handleError,
  LBK_processAmountInternal,
  LBK_validateDataInternal
};
