
/**
 * DD2_資料處理模組_3.0.0
 * @module 資料處理模組
 * @description LCAS 2.0 資料處理模組 - 完全遷移至Firestore資料庫
 * @update 2025-07-09: 升級版本至3.0.0，完全遷移至Firestore，移除Google Sheets依賴，遵循2011模組資料庫結構
 */

// 引入 Firebase Admin SDK
const admin = require('firebase-admin');

// 確保 Firebase 已初始化
if (!admin.apps.length) {
  const serviceAccount = require('./Serviceaccountkey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = 'Asia/Taipei';

// 模組配置
const DD_CONFIG = {
  DEBUG: false,
  TIMEZONE: TIMEZONE,
  SYNONYM: {
    FUZZY_MATCH_THRESHOLD: 0.7,
    ENABLE_COMPOUND_WORDS: true
  }
};

/**
 * 01. 配置初始化
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 遷移至Firestore配置
 */
function DD_initConfig() {
  console.log('DD2模組配置初始化 - Firestore版本');
  
  // 確保配置對象存在
  if (!global.DD_CONFIG) {
    global.DD_CONFIG = DD_CONFIG;
  }
  
  return true;
}

/**
 * 02. 從Firestore獲取所有科目資料
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore查詢
 */
async function DD_getAllSubjects() {
  try {
    console.log('從Firestore獲取所有科目資料...');
    
    // 使用預設帳本ID (每個用戶將有獨立帳本)
    const ledgerId = process.env.DEFAULT_LEDGER_ID || 'ledger_structure_001';
    
    const snapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('subjects')
      .where('isActive', '==', true)
      .get();
    
    if (snapshot.empty) {
      console.log('未找到任何科目資料');
      return [];
    }
    
    const subjects = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // 跳過template文件
      if (doc.id === 'template') return;
      
      subjects.push({
        majorCode: data.大項代碼,
        majorName: data.大項名稱,
        subCode: data.子項代碼,
        subName: data.子項名稱,
        synonyms: data.同義詞 || ''
      });
    });
    
    console.log(`成功獲取 ${subjects.length} 個科目`);
    return subjects;
    
  } catch (error) {
    console.log(`獲取科目資料失敗: ${error.toString()}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    return [];
  }
}

/**
 * 03. 日誌處理函數 - 寫入Firestore
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore寫入日誌
 */
async function DD_writeToLogSheet(
  severity,
  message,
  operationType = "",
  userId = "",
  errorCode = "",
  source = "DD2",
  errorDetails = "",
  retryCount = 0,
  location = "",
  functionName = ""
) {
  try {
    const ledgerId = process.env.DEFAULT_LEDGER_ID || 'ledger_structure_001';
    
    // 建立日誌資料，遵循2011模組結構
    const logData = {
      時間: admin.firestore.Timestamp.now(),
      訊息: message,
      操作類型: operationType,
      UID: userId,
      錯誤代碼: errorCode || null,
      來源: source,
      錯誤詳情: errorDetails,
      重試次數: retryCount,
      程式碼位置: location,
      嚴重等級: severity,
      函數名稱: functionName
    };

    // 寫入到指定帳本的log子集合
    await db.collection('ledgers')
      .doc(ledgerId)
      .collection('log')
      .add(logData);

    console.log(`[${severity}] [DD2] ${message}`);

  } catch (error) {
    console.log(`寫入日誌失敗: ${error.toString()}. 原始消息: ${message}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
  }
}

/**
 * 04. 統一的日誌處理函數
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @param {string} level - 日誌級別: DEBUG|INFO|WARNING|ERROR|CRITICAL
 * @param {string} message - 日誌訊息
 * @param {string} operationType - 操作類型
 * @param {string} userId - 使用者ID
 * @param {Object} options - 額外選項
 */
function DD_log(level, message, operationType = "", userId = "", options = {}) {
  const {
    errorCode = "",
    errorDetails = "",
    location = "",
    functionName = "",
  } = options;

  // 對DEBUG級別特殊處理 - 只在DEBUG模式開啟時執行
  if (level === "DEBUG" && !DD_CONFIG.DEBUG) return;

  // 記錄到控制台
  console.log(`[${level}] [DD2] ${message}`);

  // 為ERROR和CRITICAL級別設置源
  const source = level === "ERROR" || level === "CRITICAL" ? "DD2" : "";

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
function DD_logDebug(message, operationType = "", userId = "", location = "", functionName = "") {
  DD_log("DEBUG", message, operationType, userId, { location, functionName });
}

function DD_logInfo(message, operationType = "", userId = "", location = "", functionName = "") {
  DD_log("INFO", message, operationType, userId, { location, functionName });
}

function DD_logWarning(message, operationType = "", userId = "", location = "", functionName = "") {
  DD_log("WARNING", message, operationType, userId, { location, functionName });
}

function DD_logError(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  DD_log("ERROR", message, operationType, userId, {
    errorCode,
    errorDetails,
    location,
    functionName,
  });
}

function DD_logCritical(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "", functionName = "") {
  DD_log("CRITICAL", message, operationType, userId, {
    errorCode,
    errorDetails,
    location,
    functionName,
  });
}

/**
 * 05. 從Firestore查詢科目代碼
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore查詢科目代碼
 */
async function DD_getSubjectByCode(subjectCode) {
  try {
    if (!subjectCode) return null;

    // 拆分科目代碼 (格式: majorCode-subCode)
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return null;

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    const ledgerId = process.env.DEFAULT_LEDGER_ID || 'ledger_structure_001';

    // 查詢Firestore subjects子集合
    const snapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('subjects')
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      majorCode: data.大項代碼,
      majorName: data.大項名稱,
      subCode: data.子項代碼,
      subName: data.子項名稱,
      synonyms: data.同義詞 || ''
    };

  } catch (error) {
    console.log(`查詢科目代碼失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 14. 從文字中移除金額部分
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 保持原有邏輯，更新版本資訊
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
 * 15. 處理用戶消息並提取記帳信息 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore資料庫，移除預設ledgerId依賴
 * @param {string} message - 用戶輸入的消息
 * @param {string} userId - 用戶ID (必須提供，用於確定用戶帳本)
 * @param {string} timestamp - 時間戳 (可選)
 * @param {string} ledgerId - 帳本ID (可選，不提供時使用用戶的預設帳本)
 * @return {Object} 處理結果
 */
async function DD_processUserMessage(message, userId = "", timestamp = "", ledgerId = "") {
  // 1. 生成處理ID
  const msgId = uuidv4().substring(0, 8);

  // 2. 檢查必要參數
  if (!userId) {
    DD_logError(
      `缺少必要的用戶ID [${msgId}]`,
      "訊息處理",
      "",
      "MISSING_USER_ID",
      "每個用戶都需要獨立的帳本",
      "DD_processUserMessage"
    );
    
    return {
      type: "記帳",
      processed: false,
      reason: "缺少用戶ID",
      processId: msgId,
      errorType: "MISSING_USER_ID",
      errorData: {
        success: false,
        error: "缺少用戶ID",
        errorType: "MISSING_USER_ID",
        message: "記帳失敗: 每個用戶都需要獨立的帳本",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: false
      }
    };
  }

  // 3. 確定帳本ID - 每個用戶獨立帳本
  if (!ledgerId) {
    ledgerId = `ledger_${userId}`;
  }

  // 4. 開始日誌記錄
  DD_logInfo(
    `處理用戶消息: "${message}" (帳本: ${ledgerId})`,
    "訊息處理",
    userId,
    "DD_processUserMessage"
  );
  console.log(
    `DD_processUserMessage: 開始處理用戶訊息 "${message}" [${msgId}]`,
  );

  try {
    // 5. 確保配置初始化
    DD_initConfig();

    // 6. 檢查空訊息
    if (!message || message.trim() === "") {
      DD_logWarning(
        `空訊息 [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage"
      );

      const errorData = {
        success: false,
        error: "空訊息",
        errorType: "EMPTY_MESSAGE",
        message: "記帳失敗: 空訊息",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "",
          timestamp: new Date().getTime(),
        },
        userFriendlyMessage:
          "記帳處理失敗 (VALIDATION_ERROR)：訊息為空\n請重新嘗試或聯繫管理員。",
      };

      return {
        type: "記帳",
        processed: false,
        reason: "空訊息",
        processId: msgId,
        errorType: "EMPTY_MESSAGE",
        errorData: errorData,
      };
    }

    // 7. 清理輸入訊息
    message = message.trim();
    console.log(`DD_processUserMessage: 清理後訊息: "${message}" [${msgId}]`);

    // 8. 解析輸入格式 (這裡需要實作DD_parseInputFormat)
    const parseResult = await DD_parseInputFormat(message, msgId);
    console.log(
      `DD_processUserMessage: DD_parseInputFormat回傳結果: ${JSON.stringify(parseResult)} [${msgId}]`,
    );

    // 9. 檢查解析結果
    if (!parseResult) {
      DD_logWarning(
        `DD_parseInputFormat回傳null，無法解析訊息格式: "${message}" [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage"
      );

      const errorData = {
        success: false,
        error: "無法識別記帳意圖",
        errorType: "FORMAT_NOT_RECOGNIZED",
        message: "記帳失敗: 無法識別記帳意圖",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: true,
        partialData: {
          subject: message,
          amount: 0,
          rawAmount: "0",
          paymentMethod: "",
          timestamp: new Date().getTime(),
        },
      };

      return {
        type: "記帳",
        processed: false,
        reason: "無法識別記帳意圖",
        processId: msgId,
        errorType: "FORMAT_NOT_RECOGNIZED",
        errorData: errorData,
      };
    }

    // 10. 提取成功解析的結果
    const subject = parseResult.subject;
    const amount = parseResult.amount;
    const rawAmount = parseResult.rawAmount || String(amount);
    const paymentMethod = parseResult.paymentMethod;

    console.log(
      `DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 支付方式=${paymentMethod || "未指定"} [${msgId}]`,
    );

    // 11. 科目匹配處理
    if (subject) {
      console.log(`DD_processUserMessage: 開始科目匹配階段 [${msgId}]`);

      let subjectInfo = null;
      let matchMethod = "unknown";
      let confidence = 0;
      let originalSubject = subject;

      // 11.1 嘗試用戶偏好匹配
      try {
        const userPref = await DD_userPreferenceManager(userId, subject, "", true, ledgerId);
        if (userPref) {
          const prefSubject = await DD_getSubjectByCode(userPref.subjectCode);
          if (prefSubject) {
            subjectInfo = prefSubject;
            matchMethod = "user_preference";
            confidence = 0.9;
            console.log(
              `DD_processUserMessage: 用戶偏好匹配成功 "${subject}" -> ${prefSubject.subName} [${msgId}]`,
            );
          }
        }
      } catch (prefError) {
        console.log(
          `DD_processUserMessage: 用戶偏好匹配錯誤 ${prefError.toString()} [${msgId}]`,
        );
      }

      // 11.2 嘗試精確匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試精確匹配 [${msgId}]`);
        
        try {
          subjectInfo = await DD_getSubjectCode(subject, ledgerId);

          if (subjectInfo) {
            matchMethod = "exact_match";
            confidence = 1.0;
            console.log(
              `DD_processUserMessage: 精確匹配成功 "${subject}" -> ${subjectInfo.subName} [${msgId}]`,
            );
          }
        } catch (matchError) {
          console.log(
            `DD_processUserMessage: 精確匹配發生錯誤 ${matchError.toString()} [${msgId}]`,
          );
        }
      }

      // 11.3 嘗試模糊匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試模糊匹配 [${msgId}]`);
        
        try {
          const fuzzyThreshold = DD_CONFIG.SYNONYM?.FUZZY_MATCH_THRESHOLD || 0.7;
          const fuzzyMatch = await DD_fuzzyMatch(subject, fuzzyThreshold, ledgerId);

          if (fuzzyMatch && fuzzyMatch.score >= fuzzyThreshold) {
            subjectInfo = fuzzyMatch;
            matchMethod = "fuzzy_match";
            confidence = fuzzyMatch.score;
            console.log(
              `DD_processUserMessage: 模糊匹配成功 "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)} [${msgId}]`,
            );
          }
        } catch (fuzzyError) {
          console.log(
            `DD_processUserMessage: 模糊匹配發生錯誤 ${fuzzyError.toString()} [${msgId}]`,
          );
        }
      }

      // 12. 準備回傳結果
      if (subjectInfo) {
        console.log(
          `DD_processUserMessage: 科目匹配完成，準備回傳結果 [${msgId}]`,
        );

        // 12.1 決定收支類型
        let action = "支出"; // 預設為支出

        if (amount < 0) {
          action = "支出";
          console.log(
            `DD_processUserMessage: 檢測到負數金額: ${amount}，設定為支出類型 [${msgId}]`,
          );
        } else {
          // 根據科目大類判斷收支類型 - 以8開頭的為收入，其他為支出
          if (
            subjectInfo.majorCode &&
            subjectInfo.majorCode.toString().startsWith("8")
          ) {
            action = "收入";
          } else {
            action = "支出";
          }
        }

        // 12.2 建構回傳結果
        const remarkText = DD_removeAmountFromText(message, amount) || subject;

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
          paymentMethod: paymentMethod,
          action: action,
          confidence: confidence,
          matchMethod: matchMethod,
          text: remarkText,
          originalSubject: originalSubject,
          processId: msgId,
          ledgerId: ledgerId, // 新增：包含帳本ID
        };

        console.log(
          `DD_processUserMessage: 回傳結果: ${JSON.stringify(result)} [${msgId}]`,
        );
        return result;
      } else {
        // 12.3 科目匹配失敗處理
        console.log(`DD_processUserMessage: 科目匹配失敗 [${msgId}]`);

        const errorData = {
          success: false,
          error: `無法識別科目: "${subject}"`,
          errorType: "UNKNOWN_SUBJECT",
          message: `記帳失敗: 無法識別科目: "${subject}"`,
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "DD2",
          },
          isRetryable: true,
          partialData: {
            subject: subject,
            amount: amount,
            rawAmount: rawAmount,
            paymentMethod: paymentMethod,
            timestamp: new Date().getTime(),
          },
        };

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
      // 13. 科目缺失處理
      console.log(`DD_processUserMessage: 科目為空 [${msgId}]`);

      const errorData = {
        success: false,
        error: "未指定科目",
        errorType: "MISSING_SUBJECT",
        message: "記帳失敗: 未指定科目",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          timestamp: new Date().getTime(),
        },
      };

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
    // 14. 異常處理
    console.log(`DD_processUserMessage異常: ${error.toString()} [${msgId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);

    DD_logError(
      `處理用戶消息時發生異常: ${error.toString()}`,
      "訊息處理",
      userId,
      "PROCESS_ERROR",
      error.toString(),
      "DD_processUserMessage"
    );

    const errorData = {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR",
      message: `記帳失敗: 處理異常: ${error.toString()}`,
      errorDetails: {
        processId: msgId,
        errorType: "SYSTEM_ERROR",
        module: "DD2",
      },
      isRetryable: false,
    };

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
 * 16. 查詢科目代碼表的函數 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore查詢科目代碼表
 * @param {string} subjectName - 要查詢的科目名稱
 * @param {string} ledgerId - 帳本ID (可選)
 * @returns {object|null} - 如果找到，返回包含科目資訊的物件，否則返回 null
 */
async function DD_getSubjectCode(subjectName, ledgerId = "") {
  const scId = uuidv4().substring(0, 8);
  console.log(`### 使用Firestore版本DD_getSubjectCode ###`);
  console.log(`查詢科目代碼: "${subjectName}", ID=${scId}`);

  try {
    // 檢查參數
    if (!subjectName) {
      console.log(`科目名稱為空 [${scId}]`);
      DD_logWarning(
        `科目名稱為空，無法查詢科目代碼 [${scId}]`,
        "科目查詢",
        "",
        "DD_getSubjectCode"
      );
      return null;
    }

    // 使用預設帳本ID (如果未提供)
    if (!ledgerId) {
      ledgerId = process.env.DEFAULT_LEDGER_ID || 'ledger_structure_001';
    }

    // 標準化輸入科目名稱
    const normalizedInput = String(subjectName).trim();
    const inputLower = normalizedInput.toLowerCase();
    console.log(`標準化後的輸入: "${normalizedInput}" [${scId}]`);

    // 從Firestore查詢科目表
    const snapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('subjects')
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) {
      console.log(`科目表為空 [${scId}]`);
      DD_logError(
        `科目表為空 [${scId}]`,
        "科目查詢",
        "",
        "EMPTY_SUBJECTS",
        "科目代碼表無數據",
        "DD_getSubjectCode"
      );
      return null;
    }

    console.log(`讀取科目表: ${snapshot.size}筆數據 [${scId}]`);

    // 詳細診斷日誌
    console.log(`---科目查詢診斷信息開始---[${scId}]`);
    console.log(`尋找科目: "${normalizedInput}"`);

    // ===== 第一階段：進行精確匹配 =====
    console.log(`正在進行精確匹配查詢...`);

    let docCount = 0;
    for (const doc of snapshot.docs) {
      if (doc.id === 'template') continue; // 跳過template文件
      
      const data = doc.data();
      docCount++;
      
      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
      const synonymsStr = data.同義詞 || "";

      // 標準化表內科目名稱
      const normalizedSubName = String(subName).trim();
      const subNameLower = normalizedSubName.toLowerCase();

      // 記錄查詢過程（前10行及關鍵行）
      if (docCount < 10 || normalizedSubName === normalizedInput) {
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
          "",
          "DD_getSubjectCode"
        );
        console.log(`---科目查詢診斷信息結束---[${scId}]`);

        return {
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        };
      }

      // 同義詞匹配
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
              "",
              "DD_getSubjectCode"
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
      if (doc.id === 'template') continue;
      
      const data = doc.data();
      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
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
        "",
        "DD_getSubjectCode"
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
      "DD_getSubjectCode"
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
      "DD_getSubjectCode"
    );
    return null;
  }
}

/**
 * 17. 用戶偏好記憶管理 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore存儲用戶偏好
 * @param {string} userId - 用戶ID
 * @param {string} inputTerm - 輸入詞彙
 * @param {string} selectedSubjectCode - 用戶選擇的科目代碼
 * @param {boolean} isQuery - 是否為查詢操作
 * @param {string} ledgerId - 帳本ID (可選)
 * @returns {object|null} 查詢操作時返回偏好信息，存儲操作時返回null
 */
async function DD_userPreferenceManager(
  userId,
  inputTerm,
  selectedSubjectCode,
  isQuery = false,
  ledgerId = ""
) {
  const upId = uuidv4().substring(0, 8);
  console.log(
    `${isQuery ? "查詢" : "存儲"}用戶偏好: userId=${userId}, term="${inputTerm}" [${upId}]`,
  );

  try {
    if (!userId || !inputTerm) {
      console.log(`用戶ID或輸入詞彙為空 [${upId}]`);
      return null;
    }

    if (!ledgerId) {
      ledgerId = `ledger_${userId}`;
    }

    const normalizedTerm = inputTerm.toLowerCase().trim();

    // 查詢模式
    if (isQuery) {
      // 從users collection查詢用戶偏好
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.log(`用戶不存在 [${upId}]`);
        return null;
      }

      const userData = userDoc.data();
      const preferences = userData.preferences || {};
      const termPrefs = preferences[normalizedTerm];

      if (termPrefs && termPrefs.length > 0) {
        // 按使用次數排序
        const sortedPrefs = termPrefs.sort((a, b) => b.count - a.count);
        const bestPref = sortedPrefs[0];
        
        console.log(
          `找到用戶偏好: ${bestPref.subjectCode}, 使用次數=${bestPref.count} [${upId}]`,
        );
        
        return {
          subjectCode: bestPref.subjectCode,
          count: bestPref.count,
          lastUse: bestPref.lastUse,
        };
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

      const now = admin.firestore.Timestamp.now();
      const userRef = db.collection('users').doc(userId);

      // 使用事務來更新用戶偏好
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        
        let userData = {};
        if (userDoc.exists) {
          userData = userDoc.data();
        }

        const preferences = userData.preferences || {};
        const termPrefs = preferences[normalizedTerm] || [];

        // 找到現有記錄
        const existingIndex = termPrefs.findIndex(
          pref => pref.subjectCode === selectedSubjectCode
        );

        if (existingIndex >= 0) {
          // 更新現有記錄
          termPrefs[existingIndex].count += 1;
          termPrefs[existingIndex].lastUse = now;
          console.log(
            `更新用戶偏好: "${inputTerm}" -> ${selectedSubjectCode}, 新計數=${termPrefs[existingIndex].count} [${upId}]`,
          );
        } else {
          // 添加新記錄
          termPrefs.push({
            subjectCode: selectedSubjectCode,
            count: 1,
            lastUse: now,
          });
          console.log(
            `新增用戶偏好: "${inputTerm}" -> ${selectedSubjectCode} [${upId}]`,
          );
        }

        preferences[normalizedTerm] = termPrefs;
        userData.preferences = preferences;
        userData.lastActive = now;

        transaction.set(userRef, userData, { merge: true });
      });

      return null;
    }
  } catch (error) {
    console.log(`用戶偏好管理錯誤: ${error} [${upId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `用戶偏好管理錯誤: ${error}`,
      "用戶偏好",
      userId,
      "USER_PREF_ERROR",
      error.toString(),
      "DD_userPreferenceManager"
    );
    return null;
  }
}

/**
 * 18. 模糊匹配函數 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore查詢科目資料
 * @param {string} input - 用戶輸入的字符串
 * @param {number} threshold - 匹配閾值
 * @param {string} ledgerId - 帳本ID (可選)
 * @return {Object|null} 匹配結果或null
 */
async function DD_fuzzyMatch(input, threshold = 0.6, ledgerId = "") {
  // 確保配置初始化
  DD_initConfig();

  if (!input) return null;

  if (!ledgerId) {
    ledgerId = process.env.DEFAULT_LEDGER_ID || 'ledger_structure_001';
  }

  console.log(`【模糊匹配】開始處理: "${input}", 閾值: ${threshold}, 帳本: ${ledgerId}`);

  const inputLower = input.toLowerCase().trim();

  // 獲取所有科目
  const allSubjects = await DD_getAllSubjects();
  if (!allSubjects || !allSubjects.length) {
    console.log(`【模糊匹配】無法獲取科目列表`);
    return null;
  }

  console.log(`【模糊匹配】科目列表項目數: ${allSubjects.length}`);

  // 優先處理複合詞
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

  // 標準匹配邏輯
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

  console.log(`【模糊匹配】無匹配結果: "${input}"`);
  return null;
}

// Levenshtein距離計算函數
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

/**
 * 19. 輸入格式解析函數 - 簡化版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 簡化版本，基本解析輸入格式
 * @param {string} message - 用戶輸入訊息
 * @param {string} msgId - 訊息ID
 * @returns {object|null} 解析結果
 */
async function DD_parseInputFormat(message, msgId) {
  console.log(`DD_parseInputFormat: 開始解析 "${message}" [${msgId}]`);

  try {
    // 基本格式: "科目 金額 [支付方式]"
    // 例如: "午餐 150" 或 "午餐 150 現金"
    
    const parts = message.trim().split(/\s+/);
    
    if (parts.length < 2) {
      console.log(`DD_parseInputFormat: 格式不正確，至少需要科目和金額 [${msgId}]`);
      return {
        _formatError: true,
        _errorDetail: "格式不正確，至少需要科目和金額",
        errorData: {
          success: false,
          error: "格式不正確",
          errorType: "FORMAT_ERROR",
          message: "記帳失敗: 格式不正確，至少需要科目和金額",
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "DD2",
          },
          isRetryable: true
        }
      };
    }

    // 提取金額 (假設最後的數字是金額)
    let amount = 0;
    let amountIndex = -1;
    let paymentMethod = "";

    // 從後往前找數字
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      const num = parseFloat(part);
      if (!isNaN(num)) {
        amount = num;
        amountIndex = i;
        break;
      }
    }

    if (amountIndex === -1) {
      console.log(`DD_parseInputFormat: 找不到有效金額 [${msgId}]`);
      return {
        _formatError: true,
        _errorDetail: "找不到有效金額",
        errorData: {
          success: false,
          error: "找不到有效金額",
          errorType: "INVALID_AMOUNT",
          message: "記帳失敗: 找不到有效金額",
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "DD2",
          },
          isRetryable: true
        }
      };
    }

    // 提取科目 (金額前面的部分)
    const subjectParts = parts.slice(0, amountIndex);
    if (subjectParts.length === 0) {
      console.log(`DD_parseInputFormat: 找不到科目 [${msgId}]`);
      return {
        _formatError: true,
        _missingSubject: true,
        _errorDetail: "找不到科目",
        errorData: {
          success: false,
          error: "找不到科目",
          errorType: "MISSING_SUBJECT",
          message: "記帳失敗: 找不到科目",
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "DD2",
          },
          isRetryable: true
        }
      };
    }

    const subject = subjectParts.join(" ");

    // 提取支付方式 (金額後面的部分)
    if (amountIndex < parts.length - 1) {
      const paymentParts = parts.slice(amountIndex + 1);
      paymentMethod = paymentParts.join(" ");
    }

    const result = {
      subject: subject,
      amount: amount,
      rawAmount: String(amount),
      paymentMethod: paymentMethod || undefined // 如果沒有支付方式就不設置
    };

    console.log(`DD_parseInputFormat: 解析成功 ${JSON.stringify(result)} [${msgId}]`);
    return result;

  } catch (error) {
    console.log(`DD_parseInputFormat: 解析異常 ${error.toString()} [${msgId}]`);
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

// 時間戳轉換函數
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

// 模組匯出
module.exports = {
  DD_processUserMessage,
  DD_getSubjectCode,
  DD_removeAmountFromText,
  DD_getAllSubjects,
  DD_userPreferenceManager,
  DD_fuzzyMatch,
  DD_convertTimestamp,
  DD_parseInputFormat,
  DD_initConfig,
  DD_log,
  DD_logDebug,
  DD_logInfo,
  DD_logWarning,
  DD_logError,
  DD_logCritical,
  formatDate,
  formatTime,
  calculateLevenshteinDistance,
  DD_CONFIG
};
