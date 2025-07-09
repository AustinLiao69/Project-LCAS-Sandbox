
/**
 * DD_資料分配模組_2.1.0
 * @module 資料分配模組
 * @description 根據預定義的規則將數據分配到不同的資料庫表中，處理時間戳轉換，處理Rich menu指令與使用者訊息 - Firestore版本
 * @author AustinLiao69
 * @update 2025-07-09: 升級版本至2.1.0，完全遷移至Firestore資料庫，移除Google Sheets依賴
 */

// 引入其他模組
const BK = require("./2001. BK.js");
const DL = require("./2010. DL.js");

// 引入 Firebase Admin SDK
const admin = require('firebase-admin');

// 確保BK函數正確引用
const { BK_processBookkeeping } = BK;

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

// 初始化 Firebase（如果尚未初始化）
if (!admin.apps.length) {
  const serviceAccount = require('./Serviceaccountkey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

// 替代 Google Apps Script 的 Utilities 物件
const Utilities = {
  getUuid: () => uuidv4(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * 99. 初始化檢查 - 在模組載入時執行，確保關鍵資源可用
 */
try {
  console.log(`DD模組初始化檢查 [${new Date().toISOString()}]`);
  console.log(`DD模組版本: 2.1.0 (2025-07-09) - Firestore版本`);
  console.log(`執行時間: ${new Date().toLocaleString()}`);

  // 檢查 Firestore 連接
  console.log(`Firestore 連接檢查: ${db ? "成功" : "失敗"}`);
  
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
};

/**
 * 4. 定義重試配置
 */
const DD_MAX_RETRIES = 3; // 最大重試次數
const DD_RETRY_DELAY = 1000; // 重試延遲時間（毫秒）

/**
 * 01. 獲取所有科目資料 - Firestore版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 11:30:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} ledgerId - 帳本ID，預設使用用戶獨立帳本
 * @returns {Array} 科目陣列
 */
async function DD_getAllSubjects(ledgerId = null) {
  try {
    // 如果沒有指定ledgerId，使用預設結構帳本
    const targetLedgerId = ledgerId || 'ledger_structure_001';
    
    console.log(`開始從Firestore獲取科目資料，帳本ID: ${targetLedgerId}`);
    
    const subjectsRef = db.collection('ledgers').doc(targetLedgerId).collection('subjects');
    const snapshot = await subjectsRef.where('isActive', '==', true).get();
    
    if (snapshot.empty) {
      console.log('沒有找到任何科目資料');
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
 * 02. 寫入日誌到Firestore - 完全重寫版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 11:35:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} severity - 嚴重等級
 * @param {string} message - 日誌訊息
 * @param {string} operationType - 操作類型
 * @param {string} userId - 使用者ID
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
    // 確定使用者的帳本ID
    const ledgerId = userId ? `user_${userId}` : 'ledger_structure_001';
    
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
      函數名稱: functionName
    };
    
    // 寫入 Firestore
    await db.collection('ledgers').doc(ledgerId).collection('log').add(logData);
    
  } catch (error) {
    // 如果寫入日誌失敗，只能在控制台輸出
    console.log(`寫入日誌失敗: ${error.toString()}. 原始消息: ${message}`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
  }
}

/**
 * 03. 用戶偏好記憶管理 - Firestore版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 11:40:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} userId - 用戶ID
 * @param {string} inputTerm - 輸入詞彙
 * @param {string} selectedSubjectCode - 用戶選擇的科目代碼
 * @param {boolean} isQuery - 是否為查詢操作
 * @returns {object|null} 查詢操作時返回偏好信息，存儲操作時返回null
 */
async function DD_userPreferenceManager(
  userId,
  inputTerm,
  selectedSubjectCode,
  isQuery = false,
) {
  const upId = Utilities.getUuid().substring(0, 8);
  console.log(
    `${isQuery ? "查詢" : "存儲"}用戶偏好: userId=${userId}, term="${inputTerm}" [${upId}]`,
  );

  try {
    if (!userId || !inputTerm) {
      console.log(`用戶ID或輸入詞彙為空 [${upId}]`);
      return null;
    }

    const normalizedTerm = inputTerm.toLowerCase().trim();
    
    // 使用 users collection 下的 preferences subcollection
    const preferencesRef = db.collection('users').doc(userId).collection('preferences');

    // 查詢模式
    if (isQuery) {
      const snapshot = await preferencesRef
        .where('inputText', '==', normalizedTerm)
        .orderBy('count', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log(
          `找到用戶偏好: ${data.selectedCategory}, 使用次數=${data.count} [${upId}]`,
        );
        return {
          subjectCode: data.selectedCategory,
          count: data.count,
          lastUse: data.lastUse
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

      // 查找是否已存在記錄
      const existingSnapshot = await preferencesRef
        .where('inputText', '==', normalizedTerm)
        .where('selectedCategory', '==', selectedSubjectCode)
        .limit(1)
        .get();

      const now = admin.firestore.Timestamp.now();

      if (!existingSnapshot.empty) {
        // 更新現有記錄
        const doc = existingSnapshot.docs[0];
        const currentData = doc.data();
        await doc.ref.update({
          count: (currentData.count || 0) + 1,
          lastUse: now
        });
        console.log(
          `更新用戶偏好: "${inputTerm}" -> ${selectedSubjectCode}, 新計數=${(currentData.count || 0) + 1} [${upId}]`,
        );
      } else {
        // 添加新記錄
        await preferencesRef.add({
          inputText: inputTerm,
          selectedCategory: selectedSubjectCode,
          count: 1,
          lastUse: now,
          context: ""
        });
        console.log(
          `新增用戶偏好: "${inputTerm}" -> ${selectedSubjectCode} [${upId}]`,
        );
      }

      return null;
    }
  } catch (error) {
    console.log(`用戶偏好管理錯誤: ${error} [${upId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_writeToLogSheet(
      "ERROR",
      `用戶偏好管理錯誤: ${error}`,
      "同義詞處理",
      userId,
      "USER_PREF_ERROR",
      "DD",
      error.toString(),
      0,
      "DD_userPreferenceManager",
      "DD_userPreferenceManager"
    );
    return null;
  }
}

/**
 * 04. 同義詞學習函數 - Firestore版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 11:45:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} term - 要學習的詞彙
 * @param {string} subjectCode - 對應的科目代碼
 * @param {string} userId - 用戶ID
 * @returns {boolean} 學習是否成功
 */
async function DD_learnSynonym(term, subjectCode, userId) {
  const lsId = Utilities.getUuid().substring(0, 8);
  console.log(
    `學習同義詞: "${term}" -> ${subjectCode}, userId=${userId} [${lsId}]`,
  );

  try {
    if (!term || !subjectCode) {
      console.log(`詞彙或科目代碼為空 [${lsId}]`);
      return false;
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`科目代碼格式錯誤: ${subjectCode} [${lsId}]`);
      return false;
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 確定使用者的帳本ID
    const ledgerId = userId ? `user_${userId}` : 'ledger_structure_001';
    
    // 查找對應的科目
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`找不到對應科目代碼: ${subjectCode} [${lsId}]`);
      await DD_writeToLogSheet(
        "WARNING",
        `找不到對應科目代碼: ${subjectCode}`,
        "同義詞學習",
        userId,
        "",
        "DD",
        "",
        0,
        "DD_learnSynonym",
        "DD_learnSynonym"
      );
      return false;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // 處理同義詞
    const currentSynonyms = data.同義詞 || "";
    const synonymsList = currentSynonyms
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 檢查同義詞是否已存在
    if (
      synonymsList.some(
        (syn) => syn.toLowerCase() === term.toLowerCase().trim(),
      )
    ) {
      console.log(`同義詞已存在: "${term}" [${lsId}]`);
      return true;
    }

    // 添加新同義詞
    synonymsList.push(term.trim());
    const newSynonyms = synonymsList.join(",");

    // 更新科目文檔
    await doc.ref.update({
      同義詞: newSynonyms,
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`成功添加同義詞: "${term}" -> ${subjectCode} [${lsId}]`);
    await DD_writeToLogSheet(
      "INFO",
      `成功添加同義詞: "${term}" -> ${subjectCode}`,
      "同義詞學習",
      userId,
      "",
      "DD",
      "",
      0,
      "DD_learnSynonym",
      "DD_learnSynonym"
    );
    return true;

  } catch (error) {
    console.log(`同義詞學習錯誤: ${error} [${lsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_writeToLogSheet(
      "ERROR",
      `同義詞學習錯誤: ${error}`,
      "同義詞處理",
      userId,
      "SYN_LEARN_ERROR",
      "DD",
      error.toString(),
      0,
      "DD_learnSynonym",
      "DD_learnSynonym"
    );
    return false;
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
async function DD_log(level, message, operationType = "", userId = "", options = {}) {
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
  await DD_log("DEBUG", message, operationType, userId, { location, functionName });
}

async function DD_logInfo(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  await DD_log("INFO", message, operationType, userId, { location, functionName });
}

async function DD_logWarning(
  message,
  operationType = "",
  userId = "",
  location = "",
  functionName = "",
) {
  await DD_log("WARNING", message, operationType, userId, { location, functionName });
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
 * 32. 格式化日期為 'YYYY/MM/DD'
 * @param {Date} date - 日期對象
 * @returns {string} - 格式化的日期字符串
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * 33. 格式化時間為 'HH:MM'
 * @param {Date} date - 日期對象
 * @returns {string} - 格式化的時間字符串
 */
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 34. 從文字中移除金額和支付方式
 * @version 2025-04-29-V2.0
 * @author AustinLiao69
 * @param {string} text - 原始文字 (例如 "測試支出 25365 刷卡")
 * @param {number|string} amount - 要移除的金額 (例如 "25365")
 * @param {string} paymentMethod - 要移除的支付方式 (例如 "刷卡")
 * @returns {string} - 移除金額和支付方式後的文字 (例如 "測試支出")
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
 * 35. 修復版模糊匹配函數 - 優化複合詞處理，支持異步調用
 * @version 2025-07-09-V4.3.0
 * @author AustinLiao69
 * @param {string} input - 用戶輸入的字符串
 * @param {number} threshold - 匹配閾值
 * @param {string} userId - 用戶ID，用於獲取用戶專屬科目
 * @return {Object|null} 匹配結果或null
 */
async function DD_fuzzyMatch(input, threshold = 0.6, userId = null) {
  if (!input) return null;

  // 日誌記錄
  console.log(`【模糊匹配】開始處理: "${input}", 閾值: ${threshold}, 用戶: ${userId || "預設"}`);

  const inputLower = input.toLowerCase().trim();

  // 獲取所有科目 - 使用用戶專屬帳本
  const ledgerId = userId ? `user_${userId}` : null;
  const allSubjects = await DD_getAllSubjects(ledgerId);
  if (!allSubjects || !allSubjects.length) {
    console.log(`【模糊匹配】無法獲取科目列表`);
    return null;
  }

  console.log(`【模糊匹配】科目列表項目數: ${allSubjects.length}`);

  // ===== 最關鍵的修改：優先處理複合詞 =====
  // 檢測輸入(如"家鄉便當")是否包含任何同義詞(如"便當")
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
        // 只考慮長度>=2的同義詞，避免單字符誤匹配
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
    // 按分數排序，取最佳匹配
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

  // 標準匹配邏輯 - 保留原有的其他匹配方法
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

  // 沒有匹配，返回null
  console.log(`【模糊匹配】無匹配結果: "${input}"`);
  return null;
}

/**
 * 36 計算兩個字符串的相似度 (使用Levenshtein距離)
 * @param {string} str1 - 第一個字符串
 * @param {string} str2 - 第二個字符串
 * @returns {number} 相似度分數 (0-1)
 */
function DD_calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  // 計算Levenshtein距離
  const len1 = str1.length;
  const len2 = str2.length;
  let matrix = [];

  // 初始化矩陣
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 填充矩陣
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 刪除
        matrix[i][j - 1] + 1, // 插入
        matrix[i - 1][j - 1] + cost, // 替換
      );
    }
  }

  // 計算相似度分數
  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

/**
 * 37. 時間感知分類函數 - 根據時間戳判斷最可能的科目類別
 * @param {Array} possibleMatches - 可能的科目匹配結果
 * @param {string} timestamp - 時間戳
 * @returns {object} 最可能的科目匹配
 */
function DD_timeAwareClassification(possibleMatches, timestamp) {
  const tacId = Utilities.getUuid().substring(0, 8);
  console.log(
    `開始時間感知分類，有 ${possibleMatches ? possibleMatches.length : 0} 個可能匹配 [${tacId}]`,
  );

  try {
    if (!possibleMatches || possibleMatches.length === 0) {
      console.log(`無可能匹配項目 [${tacId}]`);
      return null;
    }

    // 只有一個匹配結果時直接返回
    if (possibleMatches.length === 1) {
      console.log(`僅有一個匹配結果，無需時間判斷 [${tacId}]`);
      return possibleMatches[0];
    }

    let hour;
    try {
      // 嘗試解析時間戳
      hour = new Date(Number(timestamp)).getHours();
      if (isNaN(hour)) {
        console.log(`時間戳無效，無法進行時間感知分類 [${tacId}]`);
        return possibleMatches[0]; // 回退到第一個匹配
      }
      console.log(`當前時間: ${hour}時 [${tacId}]`);
    } catch (timeError) {
      console.log(`時間戳解析失敗: ${timeError}, 使用默認匹配 [${tacId}]`);
      return possibleMatches[0]; // 回退到第一個匹配
    }

    // 時段定義
    const timeRanges = {
      breakfast: {
        range: [5, 10],
        names: ["早餐", "早點", "早午餐"],
        priority: 0.9,
      },
      lunch: {
        range: [11, 14],
        names: ["午餐", "中餐", "便當", "午飯"],
        priority: 0.9,
      },
      dinner: {
        range: [17, 21],
        names: ["晚餐", "晚飯", "宵夜"],
        priority: 0.9,
      },
      midnight: {
        range: [22, 4],
        names: ["宵夜", "消夜", "夜宵"],
        priority: 0.8,
      },
    };

    // 確定當前時段
    let currentTimeSlot = null;
    for (const [slot, config] of Object.entries(timeRanges)) {
      const [start, end] = config.range;
      if (
        (start <= end && hour >= start && hour <= end) ||
        (start > end && (hour >= start || hour <= end))
      ) {
        currentTimeSlot = slot;
        console.log(`當前時段: ${currentTimeSlot} [${tacId}]`);
        break;
      }
    }

    if (currentTimeSlot) {
      // 搜尋最匹配當前時段的科目
      for (const match of possibleMatches) {
        const subject = (match.subName || "").toLowerCase();
        const matchNames = timeRanges[currentTimeSlot].names;

        // 檢查科目名稱是否包含當前時段的關鍵字
        if (
          matchNames.some((keyword) => subject.includes(keyword.toLowerCase()))
        ) {
          console.log(
            `找到時段匹配: ${match.subName} 匹配時段 ${currentTimeSlot} [${tacId}]`,
          );
          DD_logInfo(
            `時間感知分類: "${match.subName}" 匹配當前時段 ${currentTimeSlot}`,
            "時間感知",
            "",
            "DD_timeAwareClassification",
          );
          return {
            ...match,
            confidence: timeRanges[currentTimeSlot].priority,
            timeBaseMatched: true,
          };
        }
      }
    }

    // 如果沒有找到時段匹配，返回第一個匹配結果並降低信心度
    console.log(
      `無時段匹配結果，使用第一個匹配: ${possibleMatches[0].subName} [${tacId}]`,
    );
    DD_logDebug(
      `無時段匹配結果，使用第一個匹配: ${possibleMatches[0].subName}`,
      "時間感知",
      "",
      "DD_timeAwareClassification",
    );
    return { ...possibleMatches[0], confidence: 0.7 };
  } catch (error) {
    console.log(`時間感知分類錯誤: ${error} [${tacId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `時間感知分類錯誤: ${error}`,
      "同義詞處理",
      "",
      "TIME_CLASS_ERROR",
      error.toString(),
      "DD_timeAwareClassification",
    );
    return possibleMatches[0]; // 發生錯誤時回退到第一個匹配
  }
}

/**
 * 38. 檢查詞彙是否有多個匹配 - Firestore版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 12:00:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} term - 需要檢查的詞彙
 * @param {string} userId - 用戶ID
 * @returns {Array|null} - 匹配結果數組，如果沒有匹配則返回null
 */
async function DD_checkMultipleMapping(term, userId = null) {
  const mmId = Utilities.getUuid().substring(0, 8);
  console.log(`檢查詞彙多重映射: "${term}", 用戶: ${userId || "預設"} [${mmId}]`);

  try {
    if (!term) {
      console.log(`輸入詞彙為空 [${mmId}]`);
      return null;
    }

    const normalizedTerm = term.toLowerCase().trim();
    
    // 確定使用者的帳本ID
    const ledgerId = userId ? `user_${userId}` : 'ledger_structure_001';
    
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef.where('isActive', '==', true).get();

    if (snapshot.empty) {
      console.log(`沒有找到任何科目資料 [${mmId}]`);
      return null;
    }

    let matches = [];

    // 檢查每個科目
    snapshot.forEach(doc => {
      // 跳過template文件
      if (doc.id === 'template') return;
      
      const data = doc.data();
      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
      const synonyms = (data.同義詞 || "").split(",").map((s) => s.trim());

      // 檢查科目名稱精確匹配
      if (String(subName).toLowerCase().trim() === normalizedTerm) {
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        });
      }

      // 檢查同義詞
      if (synonyms.some((syn) => syn.toLowerCase().trim() === normalizedTerm)) {
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        });
      }
    });

    if (matches.length > 0) {
      console.log(`詞彙 "${term}" 有 ${matches.length} 個映射 [${mmId}]`);
      await DD_logInfo(
        `詞彙 "${term}" 有 ${matches.length} 個映射`,
        "多重映射",
        userId || "",
        "DD_checkMultipleMapping",
      );
      return matches;
    } else {
      console.log(`詞彙 "${term}" 沒有映射 [${mmId}]`);
      return null;
    }
  } catch (error) {
    console.log(`檢查多重映射錯誤: ${error} [${mmId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_logError(
      `檢查多重映射錯誤: ${error}`,
      "同義詞處理",
      userId || "",
      "MULTI_MAP_ERROR",
      error.toString(),
      "DD_checkMultipleMapping",
    );
    return null;
  }
}

// calculateLevenshteinDistance 函數 (用於支援模糊匹配)
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
 * 5. 主要的資料分配函數（支援重試機制）
 * @version 2025-07-09-V3.1.0
 * @author AustinLiao691
 * @update: 整合DD_formatSystemReplyMessage統一處理訊息，適配Firestore異步操作
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
  await DD_logInfo(
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
    await DD_logDebug(
      `處理數據: ${dataPreview}, 來源: ${source}`,
      "數據接收",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    // 處理時間戳（如果存在）
    if (data && data.timestamp) {
      console.log(`處理時間戳: ${data.timestamp}`);
      await DD_logDebug(
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
        await DD_logDebug(
          `時間戳轉換結果: ${data.convertedDate} ${data.convertedTime}`,
          "數據處理",
          data.user_id || data.userId || "",
          "DD_distributeData",
          "DD_distributeData",
        );
      } else {
        console.log(`警告: 時間戳轉換失敗: ${data.timestamp}`);
        await DD_logWarning(
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
      await DD_logInfo(
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
        await DD_logInfo(
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
        await DD_logWarning(
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
        await DD_logWarning(
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
    await DD_logInfo(
      `開始分類數據`,
      "數據分類",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    const category = DD_classifyData(data, source);
    console.log(`數據分類結果: ${category}`);
    await DD_logInfo(
      `數據分類結果: ${category}`,
      "數據分類",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    // 7. 根據分類結果分發數據
    console.log(`開始分發數據至 ${category}`);
    await DD_logInfo(
      `開始分發數據至 ${category}`,
      "數據分發",
      data.user_id || data.userId || "",
      "DD_distributeData",
      "DD_distributeData",
    );

    const dispatchResult = await DD_dispatchData(data, category);
    console.log(`數據分發完成，結果: ${JSON.stringify(dispatchResult)}`);
    await DD_logInfo(
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
 * @version 2025-07-09-V3.1.0
 * @author AustinLiao691
 * @date 2025-07-09 12:10:00
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
 * @version 2025-07-09-V6.1.0
 * @author AustinLiao69
 * @date 2025-07-09 12:15:00
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

    console.log(`[${processId}] 即將調用 BK.BK_processBookkeeping，數據: ${JSON.stringify(bookkeepingData).substring(0, 200)}...`);
    const result = await BK.BK_processBookkeeping(bookkeepingData);
    console.log(`[${processId}] BK.BK_processBookkeeping 返回結果: ${JSON.stringify(result).substring(0, 300)}...`);

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
    const userId = data && (data.userId || data.user_id) ? (data.userId || data.user_id) : "";

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

// 導出需要的函數
module.exports = {
  DD_distributeData,
  DD_getAllSubjects,
  DD_writeToLogSheet,
  DD_userPreferenceManager,
  DD_learnSynonym,
  DD_fuzzyMatch,
  DD_checkMultipleMapping,
  DD_logDebug,
  DD_logInfo,
  DD_logWarning,
  DD_logError,
  DD_logCritical
};


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

/**
 * 32. 格式化日期為 'YYYY/MM/DD'
 * @param {Date} date - 日期對象
 * @returns {string} - 格式化的日期字符串
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * 33. 格式化時間為 'HH:MM'
 * @param {Date} date - 日期對象
 * @returns {string} - 格式化的時間字符串
 */
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}


/**
 * DD4_同義詞管理與用戶偏好模組_3.0.0
 * @module DD4模組
 * @description DD4 同義詞管理與用戶偏好模組 - 完全遷移至Firestore資料庫
 * @update 2025-07-09: 升級至3.0.0版本，完全移除Google Sheets依賴，使用Firestore資料庫
 */

// 引入Firebase Admin SDK
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * 41. 檢查詞彙是否已為特定科目的同義詞
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} term - 要檢查的詞彙
 * @param {string} subjectCode - 科目代碼
 * @param {string} ledgerId - 帳本ID
 * @returns {boolean} 是否已為同義詞
 */
async function DD_checkSynonym(term, subjectCode, ledgerId) {
  const csId = Math.random().toString(36).substring(2, 10);
  console.log(`檢查同義詞: "${term}" 是否屬於 ${subjectCode} [${csId}]`);

  try {
    if (!term || !subjectCode || !ledgerId) return false;

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return false;

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    const normalizedTerm = term.toLowerCase().trim();

    // 從Firestore查詢科目資料
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .get();

    if (snapshot.empty) {
      console.log(`找不到對應科目代碼: ${subjectCode} [${csId}]`);
      return false;
    }

    // 檢查該科目的同義詞
    const subjectDoc = snapshot.docs[0];
    const subjectData = subjectDoc.data();
    const synonymsStr = subjectData.同義詞 || "";

    if (!synonymsStr) return false;

    const synonyms = synonymsStr
      .split(",")
      .map((s) => s.trim().toLowerCase());

    const isInSynonyms = synonyms.includes(normalizedTerm);
    console.log(
      `"${term}" ${isInSynonyms ? "已是" : "不是"} ${subjectCode} 的同義詞 [${csId}]`,
    );
    return isInSynonyms;

  } catch (error) {
    console.log(`檢查同義詞錯誤: ${error} [${csId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_logError(
      `檢查同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "CHECK_SYN_ERROR",
      error.toString(),
      "DD_checkSynonym",
      ledgerId
    );
    return false;
  }
}

/**
 * 42. 初始化配置 - 確保所有必要的配置項都存在
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 移除Google Sheets相關配置，適配Firestore
 */
function DD_initConfig() {
  // 確保基本配置存在
  DD_CONFIG.DEBUG = DD_CONFIG.DEBUG !== undefined ? DD_CONFIG.DEBUG : true;
  DD_CONFIG.TIMEZONE = DD_CONFIG.TIMEZONE || "Asia/Taipei";
  DD_CONFIG.DEFAULT_SUBJECT = DD_CONFIG.DEFAULT_SUBJECT || "其他支出";

  // 同義詞系統配置
  if (!DD_CONFIG.SYNONYM) {
    DD_CONFIG.SYNONYM = {
      FUZZY_MATCH_THRESHOLD: 0.7, // 模糊匹配閾值
      ENABLE_COMPOUND_WORDS: true, // 啟用複合詞處理
    };
  } else {
    DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD =
      DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD || 0.7;
    DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS =
      DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS !== undefined
        ? DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS
        : true;
  }

  // 記帳配置
  if (!DD_CONFIG.BOOKKEEPING) {
    DD_CONFIG.BOOKKEEPING = {
      DEFAULT_ACTION: "支出",
      DEFAULT_PAYMENT_METHOD: "刷卡",
    };
  }

  console.log(`DD_CONFIG 初始化完成`);
}

/**
 * 43. 正規化中文輸入，處理簡繁體、全形半形等
 * @param {string} input - 輸入字符串
 * @return {string} 正規化後的字符串
 */
function normalizeChineseInput(input) {
  // 這裡只是一個簡單示例，實際可能需要更複雜的轉換
  // 全形數字轉半形
  const fullWidthNums = "０１２３４５６７８９";
  const halfWidthNums = "0123456789";

  let result = input;

  // 全形轉半形
  for (let i = 0; i < fullWidthNums.length; i++) {
    result = result.replace(
      new RegExp(fullWidthNums[i], "g"),
      halfWidthNums[i],
    );
  }

  // 簡單的簡繁體轉換對照表（實際系統可能需要更完整的對照表）
  const simplifiedToTraditional = {
    发: "發",
    东: "東",
    华: "華",
    车: "車",
    图: "圖",
    买: "買",
    卖: "賣",
    钱: "錢",
    饭: "飯",
    面: "麵",
  };

  // 簡體轉繁體
  for (const [simplified, traditional] of Object.entries(
    simplifiedToTraditional,
  )) {
    result = result.replace(new RegExp(simplified, "g"), traditional);
  }

  return result;
}

/**
 * 44. 計算Levenshtein編輯距離
 * @param {string} a - 第一個字符串
 * @param {string} b - 第二個字符串
 * @return {number} 編輯距離
 */
function calculateLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // 初始化矩陣
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // 填充矩陣
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替換
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j] + 1, // 刪除
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 45. 同義詞學習功能 - 支持從entries collection抓取同義詞
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} userId - 用戶ID
 * @param {string} originalSubject - 用戶輸入的原始詞彙
 * @param {string} matchedSubject - 系統匹配的科目名稱
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @param {string} ledgerId - 帳本ID
 * @returns {object} - 處理結果，包含success字段
 */
async function DD_synonymLearning(
  userId,
  originalSubject,
  matchedSubject,
  subjectCode,
  ledgerId,
) {
  const lsId = Math.random().toString(36).substring(2, 10);
  console.log(
    `【同義詞學習】開始處理: 用戶="${userId}", 原詞="${originalSubject}", 科目="${matchedSubject}", 代碼=${subjectCode} [${lsId}]`,
  );

  try {
    // 檢查參數
    if (!originalSubject || !matchedSubject || !subjectCode || !ledgerId) {
      console.log(`【同義詞學習】參數不完整，放棄學習 [${lsId}]`);

      // 使用56號函數處理錯誤
      const paramErrorResult = await DD_formatUserErrorFeedback("參數不完整", "DD", {
        errorType: "INCOMPLETE_PARAMETERS",
        userId: userId,
        isRetryable: false,
      });

      return {
        success: false,
        error: "參數不完整",
        responseMessage: paramErrorResult.userFriendlyMessage,
      };
    }

    // 標準化處理詞彙
    const normalizedInput = originalSubject.trim().toLowerCase();
    const normalizedSubject = matchedSubject.trim().toLowerCase();

    // 檢查輸入是否與科目名稱相同，如果相同則無需學習
    if (normalizedInput === normalizedSubject) {
      console.log(`【同義詞學習】輸入詞與科目名稱相同，無需學習 [${lsId}]`);

      // 使用57號函數處理成功訊息
      const skipResult = await DD_formatUserSuccessFeedback(
        {
          originalTerm: normalizedInput,
          standardTerm: normalizedSubject,
          action: "skipped",
          reason: "same_as_subject",
        },
        "DD",
        {
          operationType: "synonymLearning",
          userId: userId,
          context: {
            originalTerm: normalizedInput,
            standardTerm: normalizedSubject,
          },
        },
      );

      return {
        success: true,
        action: "skipped",
        reason: "same_as_subject",
        responseMessage: skipResult.userFriendlyMessage,
      };
    }

    // 檢查是否已經是該科目的同義詞
    if (await DD_checkSynonym(normalizedInput, subjectCode, ledgerId)) {
      console.log(
        `【同義詞學習】"${originalSubject}"已經是科目${subjectCode}的同義詞，無需重複學習 [${lsId}]`,
      );

      // 使用57號函數處理成功訊息
      const alreadySynResult = await DD_formatUserSuccessFeedback(
        {
          originalTerm: normalizedInput,
          standardTerm: normalizedSubject,
          action: "skipped",
          reason: "already_synonym",
        },
        "DD",
        {
          operationType: "synonymLearning",
          userId: userId,
          context: {
            originalTerm: normalizedInput,
            standardTerm: normalizedSubject,
          },
        },
      );

      return {
        success: true,
        action: "skipped",
        reason: "already_synonym",
        responseMessage: alreadySynResult.userFriendlyMessage,
      };
    }

    // 1. 首先從科目代碼表中獲取當前的同義詞列表
    const currentSynonyms = await DD_getSynonymsForSubject(subjectCode, ledgerId);
    console.log(
      `【同義詞學習】當前科目同義詞: ${currentSynonyms || "無"} [${lsId}]`,
    );

    // 2. 從entries collection中抓取可能的新同義詞
    const entriesSynonyms = await DD_fetchSynonymsFromEntries(subjectCode, ledgerId);
    console.log(
      `【同義詞學習】從Entries獲取的同義詞: ${entriesSynonyms || "無"} [${lsId}]`,
    );

    // 3. 合併同義詞，包括當前輸入的詞彙
    let allSynonyms = new Set();

    // 添加當前科目表的同義詞
    if (currentSynonyms) {
      currentSynonyms.split(",").forEach((syn) => {
        if (syn.trim()) allSynonyms.add(syn.trim());
      });
    }

    // 添加從entries獲取的同義詞
    if (entriesSynonyms) {
      entriesSynonyms.split(",").forEach((syn) => {
        if (syn.trim()) allSynonyms.add(syn.trim());
      });
    }

    // 添加當前輸入的詞彙
    allSynonyms.add(originalSubject.trim());

    // 轉換回逗號分隔的字符串
    const updatedSynonyms = Array.from(allSynonyms).join(",");
    console.log(
      `【同義詞學習】更新後的同義詞列表: ${updatedSynonyms} [${lsId}]`,
    );

    // 4. 更新科目代碼表
    const updateResult = await DD_updateSynonymsForSubject(
      subjectCode,
      updatedSynonyms,
      ledgerId,
    );

    if (updateResult.success) {
      console.log(`【同義詞學習】同義詞更新成功 [${lsId}]`);
      await DD_logInfo(
        `同義詞學習成功: "${originalSubject}" -> ${matchedSubject} (${subjectCode})`,
        "同義詞學習",
        userId,
        "DD_synonymLearning",
        ledgerId,
      );

      // 使用57號函數處理成功訊息
      const successResult = await DD_formatUserSuccessFeedback(
        {
          originalTerm: normalizedInput,
          standardTerm: normalizedSubject,
          action: "updated",
          synonyms: updatedSynonyms,
        },
        "DD",
        {
          operationType: "synonymLearning",
          userId: userId,
          context: {
            originalTerm: normalizedInput,
            standardTerm: normalizedSubject,
            subjectCode: subjectCode,
          },
        },
      );

      return {
        success: true,
        action: "updated",
        synonyms: updatedSynonyms,
        responseMessage: successResult.userFriendlyMessage,
      };
    } else {
      console.log(
        `【同義詞學習】同義詞更新失敗: ${updateResult.error} [${lsId}]`,
      );

      // 使用56號函數處理錯誤
      const updateErrorResult = await DD_formatUserErrorFeedback(
        updateResult.error,
        "DD",
        {
          errorType: "SYNONYM_UPDATE_ERROR",
          userId: userId,
          isRetryable: true,
        },
      );

      return {
        success: false,
        error: updateResult.error,
        responseMessage: updateErrorResult.userFriendlyMessage,
      };
    }
  } catch (error) {
    console.log(`【同義詞學習】處理錯誤: ${error} [${lsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_logError(
      `同義詞學習錯誤: ${error}`,
      "同義詞處理",
      userId,
      "SYN_LEARN_ERROR",
      error.toString(),
      "DD_synonymLearning",
      ledgerId,
    );

    // 使用56號函數處理錯誤
    const generalErrorResult = await DD_formatUserErrorFeedback(error, "DD", {
      errorType: "SYNONYM_LEARNING_ERROR",
      userId: userId,
      isRetryable: true,
    });

    return {
      success: false,
      error: error.toString(),
      responseMessage: generalErrorResult.userFriendlyMessage,
    };
  }
}

/**
 * 46. 從entries collection中抓取特定科目代碼的同義詞
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @param {string} ledgerId - 帳本ID
 * @returns {string} - 逗號分隔的同義詞字符串，如果沒有找到則返回空字符串
 */
async function DD_fetchSynonymsFromEntries(subjectCode, ledgerId) {
  const flId = Math.random().toString(36).substring(2, 10);
  console.log(
    `【抓取同義詞】開始從entries collection抓取科目${subjectCode}的同義詞 [${flId}]`,
  );

  try {
    // 檢查參數
    if (!subjectCode || !ledgerId) {
      console.log(`【抓取同義詞】參數不完整 [${flId}]`);
      return "";
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`【抓取同義詞】科目代碼格式錯誤: ${subjectCode} [${flId}]`);
      return "";
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 從Firestore查詢entries
    const entriesRef = db.collection('ledgers').doc(ledgerId).collection('entries');
    const snapshot = await entriesRef
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .get();

    if (snapshot.empty) {
      console.log(`【抓取同義詞】entries collection中找不到匹配記錄 [${flId}]`);
      return "";
    }

    // 收集所有匹配的同義詞
    const synonyms = new Set();

    snapshot.forEach(doc => {
      const data = doc.data();
      const synValue = data.同義詞;
      if (synValue && typeof synValue === "string" && synValue.trim()) {
        // 將同義詞添加到集合中（自動去重）
        synValue.split(",").forEach((syn) => {
          if (syn.trim()) synonyms.add(syn.trim());
        });
      }
    });

    // 轉換為逗號分隔的字符串
    const result = Array.from(synonyms).join(",");

    console.log(
      `【抓取同義詞】從entries collection找到${synonyms.size}個同義詞: ${result} [${flId}]`,
    );
    return result;
  } catch (error) {
    console.log(`【抓取同義詞】處理錯誤: ${error} [${flId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_logError(
      `從entries collection抓取同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "FETCH_SYN_ERROR",
      error.toString(),
      "DD_fetchSynonymsFromEntries",
      ledgerId,
    );
    return "";
  }
}

/**
 * 47. 獲取特定科目代碼的當前同義詞
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @param {string} ledgerId - 帳本ID
 * @returns {string} - 當前的同義詞字符串，如果沒有找到則返回空字符串
 */
async function DD_getSynonymsForSubject(subjectCode, ledgerId) {
  try {
    // 檢查參數
    if (!subjectCode || !ledgerId) return "";

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return "";

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 從Firestore查詢科目資料
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .get();

    if (snapshot.empty) return "";

    // 返回該科目的同義詞
    const subjectDoc = snapshot.docs[0];
    const subjectData = subjectDoc.data();
    return subjectData.同義詞 || "";

  } catch (error) {
    console.log(`獲取科目同義詞錯誤: ${error}`);
    await DD_logError(
      `獲取科目同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "GET_SYN_ERROR",
      error.toString(),
      "DD_getSynonymsForSubject",
      ledgerId,
    );
    return "";
  }
}

/**
 * 48. 更新特定科目代碼的同義詞
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @param {string} synonyms - 更新後的同義詞字符串
 * @param {string} ledgerId - 帳本ID
 * @returns {object} - 包含success字段的結果對象
 */
async function DD_updateSynonymsForSubject(subjectCode, synonyms, ledgerId) {
  const usId = Math.random().toString(36).substring(2, 10);
  console.log(
    `【更新同義詞】開始更新科目${subjectCode}的同義詞為: ${synonyms} [${usId}]`,
  );

  try {
    // 檢查參數
    if (!subjectCode || !ledgerId) {
      console.log(`【更新同義詞】參數不完整 [${usId}]`);
      return { success: false, error: "參數不完整" };
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`【更新同義詞】科目代碼格式錯誤: ${subjectCode} [${usId}]`);
      return { success: false, error: "科目代碼格式錯誤" };
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 從Firestore查詢科目文件
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .get();

    if (snapshot.empty) {
      console.log(`【更新同義詞】找不到匹配的科目: ${subjectCode} [${usId}]`);
      return { success: false, error: "找不到匹配的科目" };
    }

    // 更新同義詞
    const subjectDoc = snapshot.docs[0];
    await subjectDoc.ref.update({
      同義詞: synonyms,
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log(
      `【更新同義詞】成功更新科目${subjectCode}的同義詞 [${usId}]`,
    );
    await DD_logInfo(
      `更新科目${subjectCode}的同義詞: ${synonyms}`,
      "同義詞管理",
      "",
      "DD_updateSynonymsForSubject",
      ledgerId,
    );

    return { success: true };

  } catch (error) {
    console.log(`【更新同義詞】處理錯誤: ${error} [${usId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_logError(
      `更新科目同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "UPDATE_SYN_ERROR",
      error.toString(),
      "DD_updateSynonymsForSubject",
      ledgerId,
    );
    return { success: false, error: error.toString() };
  }
}

/**
 * 49. 生成記帳結果回覆訊息
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 更新版本號和時間戳
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
      new Date().toLocaleDateString('zh-TW', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: 'Asia/Taipei'
      });
    const timeStr =
      bkResult.time || 
      new Date().toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Taipei'
      });

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
科目：${minorName}`;
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
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 更新版本號和時間戳
 * @param {Object} data - 記帳數據
 * @returns {string} 格式化的回覆訊息
 */
async function DD_generateBookkeepingMessage(data) {
  try {
    // 1. 記錄開始處理
    console.log(`開始生成記帳回覆訊息: ${JSON.stringify(data)}`);

    // 2. 檢查必要參數
    if (!data) {
      const errorResult = await DD_formatUserErrorFeedback(
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
      // 成功訊息 - 使用57號函數
      const successResult = await DD_formatUserSuccessFeedback(data, "BK", {
        operationType: "記帳",
        userId: data.userId || data.user_id || "",
      });

      return successResult.userFriendlyMessage;
    } else {
      // 失敗訊息 - 使用56號函數
      const errorResult = await DD_formatUserErrorFeedback(
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
    const errorResult = await DD_formatUserErrorFeedback(
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
 * 52. 記帳備註生成與格式化
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 12:30:00
 * @update: 更新版本號和時間戳
 * @param {Object} parseResult - DD_parseInputFormat 的解析結果
 * @param {string} originalText - 原始輸入文本
 * @return {string} 格式化後的備註
 */
function DD_formatBookkeepingRemark(parseResult, originalText) {
  if (!parseResult || !originalText) return "";

  let remark = originalText;

  // 1. 移除數字和貨幣單位 (支持更大範圍的數字和各種分隔符)
  remark = remark.replace(/\d{1,3}(,\d{3})*(\.\d+)?|\d+/g, "");

  // 2. 移除所有支付方式
  const paymentMethods = ["現金", "刷卡", "轉帳", "行動支付", "其他"];
  paymentMethods.forEach((method) => {
    remark = remark.replace(new RegExp(method, "gi"), "");
  });

  // 3. 移除貨幣單位
  remark = remark.replace(/[元塊NT$¥€£]/gi, "");

  // 4. 移除多餘空格和標點符號
  remark = remark.replace(/\s+/g, " ").trim();
  remark = remark.replace(/^[,，:：\-\s]+|[,，:：\-\s]+$/g, "");

  // 5. 檢查科目是否就是備註全部內容
  if (
    parseResult.subject &&
    (remark === parseResult.subject || remark === "" || remark.length <= 1)
  ) {
    // 如果只剩下科目名稱或備註為空，返回科目名稱
    return parseResult.subject;
  }

  // 6. 最終清理
  if (!remark || remark.length <= 1) {
    // 備註太短或為空，返回科目名稱
    return parseResult.subject || originalText;
  }

  return remark;
}

// 輔助函數 - 日誌記錄
async function DD_logError(message, operationType, userId, errorCode, errorDetails, functionName, ledgerId) {
  try {
    if (!ledgerId) {
      console.warn('DD_logError: 缺少ledgerId參數');
      return;
    }

    await db.collection('ledgers').doc(ledgerId).collection('log').add({
      時間: admin.firestore.Timestamp.now(),
      訊息: message,
      操作類型: operationType,
      UID: userId || '',
      錯誤代碼: errorCode,
      來源: 'DD4模組',
      錯誤詳情: errorDetails,
      重試次數: 0,
      程式碼位置: functionName,
      嚴重等級: 'ERROR'
    });
  } catch (error) {
    console.error('DD_logError failed:', error);
  }
}

async function DD_logInfo(message, operationType, userId, functionName, ledgerId) {
  try {
    if (!ledgerId) {
      console.warn('DD_logInfo: 缺少ledgerId參數');
      return;
    }

    await db.collection('ledgers').doc(ledgerId).collection('log').add({
      時間: admin.firestore.Timestamp.now(),
      訊息: message,
      操作類型: operationType,
      UID: userId || '',
      錯誤代碼: null,
      來源: 'DD4模組',
      錯誤詳情: '',
      重試次數: 0,
      程式碼位置: functionName,
      嚴重等級: 'INFO'
    });
  } catch (error) {
    console.error('DD_logInfo failed:', error);
  }
}

// 假設的56/57號函數（需要從其他模組引入或定義）
async function DD_formatUserErrorFeedback(error, module, options) {
  return {
    userFriendlyMessage: `處理失敗: ${error}`
  };
}

async function DD_formatUserSuccessFeedback(data, module, options) {
  return {
    userFriendlyMessage: '處理成功!'
  };
}

module.exports = {
  DD_checkSynonym,
  DD_initConfig,
  normalizeChineseInput,
  calculateLevenshteinDistance,
  DD_synonymLearning,
  DD_fetchSynonymsFromEntries,
  DD_getSynonymsForSubject,
  DD_updateSynonymsForSubject,
  DD_generateBookkeepingResponse,
  DD_generateBookkeepingMessage,
  DD_parseInputFormat,
  DD_formatBookkeepingRemark
};


/**
 * DD5_智能記帳處理模組_3.0.0
 * @module DD5模組
 * @description 智能記帳處理模組 - 跨帳本查詢與Firestore整合
 * @update 2025-07-09: 完全重寫為Firestore架構，支援跨帳本智能查詢
 */

const admin = require('firebase-admin');
const axios = require('axios');

// 引入其他模組
const DL = require('./2010. DL.js');

// 取得 Firestore 實例（使用2011模組的連接）
const db = admin.firestore();

// 設定時區為 UTC+8
const TIMEZONE = 'Asia/Taipei';

/**
 * 53. 智能備註生成 - 跨帳本版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 重寫為Firestore版本，支援跨帳本資料整合
 * @param {Object} bookkeepingData - 記帳數據對象
 * @param {string} ledgerId - 目標帳本ID
 * @return {string} 生成的備註
 */
async function DD_generateIntelligentRemark(bookkeepingData, ledgerId) {
  try {
    DL.DL_logDebug('DD5', `開始生成智能備註 - 帳本: ${ledgerId}`);

    // 1. 使用科目名稱作為備註基礎
    let remark = bookkeepingData.subjectName || "";

    // 2. 查詢跨帳本的歷史記錄，提供智能建議
    if (bookkeepingData.userId && bookkeepingData.subjectCode) {
      const historicalRemarks = await DD_getHistoricalRemarks(
        bookkeepingData.userId, 
        bookkeepingData.subjectCode
      );

      if (historicalRemarks.length > 0) {
        // 使用最常用的備註作為建議
        const mostUsedRemark = historicalRemarks[0];
        if (mostUsedRemark !== bookkeepingData.subjectName) {
          remark = mostUsedRemark;
          DL.DL_logInfo('DD5', `使用歷史智能備註: ${remark}`);
        }
      }
    }

    // 3. 如果有原始文本且包含更多資訊，進行格式化
    if (bookkeepingData.text && 
        bookkeepingData.text !== bookkeepingData.subjectName) {

      const formattedRemark = await DD_formatBookkeepingRemark(
        {
          subject: bookkeepingData.subjectName,
          amount: bookkeepingData.amount,
          paymentMethod: bookkeepingData.paymentMethod
        },
        bookkeepingData.text
      );

      if (formattedRemark && 
          formattedRemark !== bookkeepingData.subjectName &&
          formattedRemark.length > 1) {
        remark = formattedRemark;
      }
    }

    // 4. 使用原始科目名稱（如果與系統科目不同）
    if (bookkeepingData.originalSubject &&
        bookkeepingData.subjectName &&
        bookkeepingData.originalSubject !== bookkeepingData.subjectName) {
      remark = bookkeepingData.originalSubject;
    }

    DL.DL_logDebug('DD5', `智能備註生成完成: ${remark}`);
    return remark;

  } catch (error) {
    DL.DL_logError('DD5', `生成智能備註錯誤: ${error.message}`);
    return bookkeepingData.subjectName || "";
  }
}

/**
 * 54. 處理解析結果的函數 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 重寫為Firestore版本，支援跨帳本智能處理
 * @param {Object} parseResult - 解析結果
 * @param {Object} options - 選項
 * @returns {Object} 處理後的結果
 */
async function DD_processParseResult(parseResult, options = {}) {
  const processId = options.processId || generateProcessId();
  DL.DL_logDebug('DD5', `開始處理解析結果 [${processId}]`);

  try {
    if (!parseResult) {
      DL.DL_logWarning('DD5', `解析結果為空 [${processId}]`);
      return null;
    }

    // 提取基本資訊
    const subject = parseResult.subject;
    const amount = parseResult.amount;
    const rawAmount = parseResult.rawAmount || amount.toLocaleString("zh-TW");
    const paymentMethod = parseResult.paymentMethod || "刷卡";

    DL.DL_logDebug('DD5', `處理基本資訊 - 科目: ${subject}, 金額: ${amount}, 支付方式: ${paymentMethod} [${processId}]`);

    // 智能推薦最適合的帳本
    let recommendedLedgerId = null;
    if (options.userId && subject) {
      recommendedLedgerId = await DD_recommendBestLedger(options.userId, subject, amount);
      DL.DL_logInfo('DD5', `推薦帳本: ${recommendedLedgerId} [${processId}]`);
    }

    // 取得支出/收入類型
    let action = parseResult.action;
    if (!action) {
      if (options.defaultAction) {
        action = options.defaultAction;
      } else {
        // 智能判斷交易類型
        action = await DD_smartDetermineTransactionType(parseResult.text, subject);
      }
    }

    DL.DL_logDebug('DD5', `確定交易類型: ${action} [${processId}]`);

    // 特殊格式處理
    if (parseResult.formatId === "FORMAT8" && options.contextSubject) {
      DL.DL_logDebug('DD5', `處理純數字格式，使用上下文科目: ${options.contextSubject} [${processId}]`);
      return {
        subject: options.contextSubject,
        amount: amount,
        rawAmount: rawAmount,
        action: action,
        paymentMethod: paymentMethod,
        text: parseResult.text || "",
        formatId: parseResult.formatId,
        recommendedLedgerId: recommendedLedgerId
      };
    }

    // 返回處理結果
    const result = {
      subject: subject,
      amount: amount,
      rawAmount: rawAmount,
      action: action,
      paymentMethod: paymentMethod,
      text: parseResult.text || "",
      formatId: parseResult.formatId,
      recommendedLedgerId: recommendedLedgerId
    };

    DL.DL_logDebug('DD5', `解析結果處理完成 [${processId}]`);
    return result;

  } catch (error) {
    DL.DL_logError('DD5', `處理解析結果錯誤: ${error.message} [${processId}]`);
    return null;
  }
}

/**
 * 55. 跨帳本獲取所有科目列表
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 完全重寫為跨帳本Firestore查詢版本
 * @param {string} userId - 用戶ID
 * @return {Array} 跨帳本科目列表
 */
async function DD_getAllSubjectsCrossLedger(userId) {
  try {
    DL.DL_logDebug('DD5', `開始跨帳本科目查詢 - 用戶: ${userId}`);

    if (!userId) {
      DL.DL_logWarning('DD5', '缺少用戶ID，無法進行跨帳本查詢');
      return [];
    }

    // 1. 獲取用戶可存取的所有帳本
    const accessibleLedgers = await DD_getUserAccessibleLedgers(userId);
    if (accessibleLedgers.length === 0) {
      DL.DL_logWarning('DD5', `用戶 ${userId} 沒有可存取的帳本`);
      return [];
    }

    DL.DL_logInfo('DD5', `找到 ${accessibleLedgers.length} 個可存取帳本`);

    // 2. 跨帳本查詢所有科目
    const allSubjects = [];
    const subjectUsageStats = await DD_getUserSubjectUsageStats(userId);

    for (const ledgerId of accessibleLedgers) {
      try {
        const ledgerSubjects = await DD_getSubjectsFromLedger(ledgerId);

        // 為每個科目添加帳本資訊和使用統計
        ledgerSubjects.forEach(subject => {
          const subjectKey = `${subject.大項代碼}-${subject.子項代碼}`;
          const usageInfo = subjectUsageStats[subjectKey] || { count: 0, lastUsed: null };

          allSubjects.push({
            ...subject,
            ledgerId: ledgerId,
            usageCount: usageInfo.count,
            lastUsed: usageInfo.lastUsed,
            subjectKey: subjectKey
          });
        });

        DL.DL_logDebug('DD5', `帳本 ${ledgerId} 提供 ${ledgerSubjects.length} 個科目`);
      } catch (ledgerError) {
        DL.DL_logError('DD5', `查詢帳本 ${ledgerId} 科目失敗: ${ledgerError.message}`);
        continue;
      }
    }

    // 3. 智能排序：使用頻率 > 最近使用 > 科目代碼
    allSubjects.sort((a, b) => {
      // 優先比較使用次數
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }

      // 再比較最近使用時間
      if (a.lastUsed && b.lastUsed) {
        return new Date(b.lastUsed) - new Date(a.lastUsed);
      } else if (a.lastUsed && !b.lastUsed) {
        return -1;
      } else if (!a.lastUsed && b.lastUsed) {
        return 1;
      }

      // 最後按科目代碼排序
      return a.子項代碼.localeCompare(b.子項代碼);
    });

    DL.DL_logInfo('DD5', `跨帳本科目查詢完成，共 ${allSubjects.length} 個科目`);
    return allSubjects;

  } catch (error) {
    DL.DL_logError('DD5', `跨帳本科目查詢失敗: ${error.message}`);
    return [];
  }
}

/**
 * 56. 智能推薦最佳帳本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 根據科目、金額、使用習慣推薦最適合的帳本
 */
async function DD_recommendBestLedger(userId, subject, amount) {
  try {
    DL.DL_logDebug('DD5', `開始智能帳本推薦 - 用戶: ${userId}, 科目: ${subject}`);

    // 1. 獲取用戶的帳本使用偏好
    const ledgerPreferences = await DD_getUserLedgerPreferences(userId);

    // 2. 查詢該科目在各帳本的使用歷史
    const subjectLedgerUsage = await DD_getSubjectLedgerUsage(userId, subject);

    // 3. 考慮當前時間和專案帳本的時效性
    const currentTime = new Date();
    const accessibleLedgers = await DD_getUserAccessibleLedgers(userId);

    let bestLedger = null;
    let highestScore = 0;

    for (const ledgerId of accessibleLedgers) {
      let score = 0;

      // 基礎分數：帳本類型權重
      const ledgerInfo = await DD_getLedgerInfo(ledgerId);
      if (ledgerInfo) {
        switch (ledgerInfo.type) {
          case 'project':
            // 專案帳本：檢查是否在時效內
            if (DD_isProjectActive(ledgerInfo, currentTime)) {
              score += 30;
            } else {
              score -= 10; // 過期專案降分
            }
            break;
          case 'category':
            // 分類帳本：根據科目匹配度
            if (DD_isCategoryMatched(ledgerInfo, subject)) {
              score += 25;
            }
            break;
          case 'shared':
            // 共享帳本：中等優先權
            score += 15;
            break;
          default:
            // 一般帳本
            score += 10;
        }
      }

      // 使用歷史加分
      const usage = subjectLedgerUsage[ledgerId] || { count: 0, recentUse: 0 };
      score += usage.count * 5; // 每次使用+5分
      score += usage.recentUse * 10; // 最近使用加權

      // 用戶偏好加分
      const preference = ledgerPreferences[ledgerId] || 0;
      score += preference * 3;

      DL.DL_logDebug('DD5', `帳本 ${ledgerId} 推薦分數: ${score}`);

      if (score > highestScore) {
        highestScore = score;
        bestLedger = ledgerId;
      }
    }

    DL.DL_logInfo('DD5', `推薦帳本: ${bestLedger} (分數: ${highestScore})`);
    return bestLedger;

  } catch (error) {
    DL.DL_logError('DD5', `智能帳本推薦失敗: ${error.message}`);
    return null;
  }
}

/**
 * 57. 獲取用戶可存取的帳本列表
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 查詢用戶有權限存取的所有帳本
 */
async function DD_getUserAccessibleLedgers(userId) {
  try {
    DL.DL_logDebug('DD5', `查詢用戶可存取帳本 - 用戶: ${userId}`);

    // 查詢用戶為成員的所有帳本
    const ledgersQuery = await db.collection('ledgers')
      .where('MemberUID', 'array-contains', userId)
      .where('archived', '==', false)
      .get();

    const accessibleLedgers = [];
    ledgersQuery.forEach(doc => {
      accessibleLedgers.push(doc.id);
    });

    // 也查詢用戶為擁有者的帳本
    const ownerQuery = await db.collection('ledgers')
      .where('ownerUID', '==', userId)
      .where('archived', '==', false)
      .get();

    ownerQuery.forEach(doc => {
      if (!accessibleLedgers.includes(doc.id)) {
        accessibleLedgers.push(doc.id);
      }
    });

    DL.DL_logInfo('DD5', `用戶 ${userId} 可存取 ${accessibleLedgers.length} 個帳本`);
    return accessibleLedgers;

  } catch (error) {
    DL.DL_logError('DD5', `查詢可存取帳本失敗: ${error.message}`);
    return [];
  }
}

/**
 * 58. 格式化系統回覆訊息 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 重寫為Firestore版本，支援跨帳本資訊顯示
 * @param {Object} resultData - 處理結果數據
 * @param {string} moduleCode - 模組代碼
 * @param {Object} options - 附加選項
 * @returns {Object} 格式化後的回覆訊息
 */
async function DD_formatSystemReplyMessage(resultData, moduleCode, options = {}) {
  const userId = options.userId || "";
  const processId = options.processId || generateProcessId();
  let errorMsg = "未知錯誤";

  const currentDateTime = new Date().toLocaleString('zh-TW', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  DL.DL_logDebug('DD5', `開始格式化訊息 [${processId}], 模組: ${moduleCode}`);

  try {
    // 檢查是否已有完整回覆訊息
    if (resultData && resultData.responseMessage) {
      DL.DL_logDebug('DD5', `使用現有回覆訊息 [${processId}]`);
      return {
        success: resultData.success === true,
        responseMessage: resultData.responseMessage,
        originalResult: resultData.originalResult || resultData,
        processId: processId,
        errorType: resultData.errorType || null,
        moduleCode: moduleCode,
        partialData: resultData.partialData || {},
        error: resultData.success === true ? undefined : errorMsg
      };
    }

    // 確保resultData存在
    if (!resultData) {
      resultData = {
        success: false,
        error: "無處理結果資料",
        errorType: "MISSING_RESULT_DATA",
        message: "無處理結果資料",
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "支付方式未指定",
          timestamp: new Date().getTime()
        }
      };
    }

    let responseMessage = "";
    const isSuccess = resultData.success === true;

    // 提取部分數據
    let partialData = resultData.parsedData || 
                     resultData.partialData || 
                     resultData.data || 
                     {};

    if (isSuccess) {
      // 成功訊息
      if (resultData.responseMessage) {
        responseMessage = resultData.responseMessage;
      } else if (resultData.data) {
        const data = resultData.data;
        const subjectName = data.subjectName || partialData.subject || "";
        const amount = data.rawAmount || partialData.rawAmount || data.amount || 0;
        const action = data.action || resultData.action || "支出";
        const paymentMethod = data.paymentMethod || partialData.paymentMethod || "";
        const date = data.date || currentDateTime;
        const remark = data.remark || partialData.remark || "無";
        const userType = data.userType || "J";

        // 添加帳本資訊（如果有推薦帳本）
        let ledgerInfo = "";
        if (data.recommendedLedgerId) {
          try {
            const ledgerData = await DD_getLedgerInfo(data.recommendedLedgerId);
            if (ledgerData) {
              ledgerInfo = `\n帳本：${ledgerData.name} (${ledgerData.type})`;
            }
          } catch (e) {
            DL.DL_logDebug('DD5', `獲取帳本資訊失敗: ${e.message}`);
          }
        }

        responseMessage = 
          `記帳成功！\n` +
          `金額：${amount}元 (${action})\n` +
          `付款方式：${paymentMethod}\n` +
          `時間：${date}\n` +
          `科目：${subjectName}\n` +
          `備註：${remark}\n` +
          `使用者類型：${userType}${ledgerInfo}`;
      } else {
        responseMessage = `操作成功！\n處理ID: ${processId}`;
      }
    } else {
      // 失敗訊息
      errorMsg = resultData.error || 
                resultData.message || 
                resultData.errorData?.error || 
                "未知錯誤";

      const subject = partialData.subject || "未知科目";
      const displayAmount = partialData.rawAmount || 
                           (partialData.amount !== undefined ? String(partialData.amount) : "0");
      const paymentMethod = partialData.paymentMethod || "未指定支付方式";
      const remark = partialData.remark || "無";

      responseMessage =
        `記帳失敗！\n` +
        `金額：${displayAmount}元\n` +
        `支付方式：${paymentMethod}\n` +
        `時間：${currentDateTime}\n` +
        `科目：${subject}\n` +
        `備註：${remark}\n` +
        `使用者類型：J\n` +
        `錯誤原因：${errorMsg}`;
    }

    DL.DL_logDebug('DD5', `訊息格式化完成 [${processId}]`);

    return {
      success: isSuccess,
      responseMessage: responseMessage,
      originalResult: resultData,
      processId: processId,
      errorType: resultData.errorType || null,
      moduleCode: moduleCode,
      partialData: partialData,
      error: isSuccess ? undefined : errorMsg
    };

  } catch (error) {
    DL.DL_logError('DD5', `格式化過程出錯: ${error.message} [${processId}]`);

    const fallbackMessage = `記帳失敗！\n時間：${currentDateTime}\n科目：未知科目\n金額：0元\n支付方式：未指定支付方式\n備註：無\n使用者類型：J\n錯誤原因：訊息格式化錯誤`;

    return {
      success: false,
      responseMessage: fallbackMessage,
      processId: processId,
      errorType: "FORMAT_ERROR",
      moduleCode: moduleCode,
      error: error.toString()
    };
  }
}

/**
 * 59. 根據科目代碼獲取科目信息 - 跨帳本版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 重寫為跨帳本Firestore查詢版本
 * @param {string} subjectCode - 科目代碼
 * @param {string} userId - 用戶ID（用於跨帳本查詢）
 * @returns {object|null} 科目信息對象或null
 */
async function DD_getSubjectByCode(subjectCode, userId) {
  try {
    DL.DL_logDebug('DD5', `跨帳本科目代碼查詢: ${subjectCode}, 用戶: ${userId}`);

    if (!subjectCode) {
      DL.DL_logWarning('DD5', '科目代碼為空');
      return null;
    }

    let majorCode, subCode;

    // 處理代碼格式
    if (subjectCode.includes("-")) {
      const parts = subjectCode.split("-");
      majorCode = parts[0];
      subCode = parts[1];
    } else {
      subCode = subjectCode;
    }

    // 跨帳本查詢
    const allSubjects = await DD_getAllSubjects(userId);

    for (const subject of allSubjects) {
      const currentMajorCode = subject['大項代碼'];
      const currentSubCode = subject['子項代碼'];

      // 如果只有subCode，找到第一個匹配的子科目
      if (!majorCode && currentSubCode === subCode) {
        DL.DL_logInfo('DD5', `找到科目: ${currentMajorCode}-${currentSubCode} (帳本: ${subject.ledgerId})`);
        return {
          majorCode: currentMajorCode,
          majorName: subject['大項名稱'],
          subCode: currentSubCode,
          subName: subject['子項名稱'],
          ledgerId: subject.ledgerId,
          usageCount: subject.usageCount || 0
        };
      }

      // 如果有完整代碼，精確匹配
      if (majorCode && currentMajorCode === majorCode && currentSubCode === subCode) {
        DL.DL_logInfo('DD5', `精確匹配科目: ${majorCode}-${subCode} (帳本: ${subject.ledgerId})`);
        return {
          majorCode: currentMajorCode,
          majorName: subject['大項名稱'],
          subCode: currentSubCode,
          subName: subject['子項名稱'],
          ledgerId: subject.ledgerId,
          usageCount: subject.usageCount || 0
        };
      }
    }

    DL.DL_logWarning('DD5', `找不到科目代碼: ${subjectCode}`);
    return null;

  } catch (error) {
    DL.DL_logError('DD5', `科目代碼查詢出錯: ${error.message}`);
    return null;
  }
}

/**
 * 60. LINE 訊息推送 - Firestore日誌整合版
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 整合Firestore日誌記錄，支援跨帳本通知
 * @param {string} userId - LINE 用戶 ID
 * @param {string|Object} message - 要發送的訊息內容
 * @param {string} ledgerId - 相關帳本ID（可選）
 * @returns {Promise<Object>} 發送結果
 */
async function DD_pushMessage(userId, message, ledgerId = null) {
  try {
    // 檢查用戶ID
    if (!userId || userId.trim() === "") {
      DL.DL_logWarning('DD5', 'LINE推送：無效的用戶ID');
      return { success: false, error: "無效的用戶ID" };
    }

    // 處理訊息內容
    let textMessage = "";
    if (typeof message === "object" && message !== null) {
      if (message.responseMessage && typeof message.responseMessage === "string") {
        textMessage = message.responseMessage;
      } else if (message.message && typeof message.message === "string") {
        textMessage = message.message;
      } else {
        try {
          textMessage = JSON.stringify(message);
        } catch (jsonError) {
          textMessage = "系統訊息";
          DL.DL_logWarning('DD5', `轉換訊息失敗: ${jsonError.message}`);
        }
      }
    } else if (typeof message === "string") {
      textMessage = message;
    } else {
      textMessage = "系統訊息";
    }

    // 限制訊息長度
    const maxLength = 5000;
    if (textMessage.length > maxLength) {
      textMessage = textMessage.substring(0, maxLength - 3) + "...";
    }

    // LINE API 設定
    const url = "https://api.line.me/v2/bot/message/push";
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      DL.DL_logError('DD5', 'LINE推送：缺少 Channel Access Token');
      return { success: false, error: "缺少 Channel Access Token" };
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`
    };

    const payload = {
      to: userId,
      messages: [{
        type: "text",
        text: textMessage
      }]
    };

    DL.DL_logInfo('DD5', `開始向用戶 ${userId} 推送訊息`);

    // 記錄到Firestore日誌
    await DD_writeToFirestoreLog(
      ledgerId || 'system',
      userId,
      'INFO',
      '開始向用戶推送訊息',
      '訊息推送',
      {
        location: 'DD_pushMessage',
        messageLength: textMessage.length
      }
    );

    // 發送請求
    const response = await axios.post(url, payload, { headers: headers });

    if (response.status === 200) {
      DL.DL_logInfo('DD5', `成功推送訊息給用戶 ${userId}`);

      // 記錄成功日誌
      await DD_writeToFirestoreLog(
        ledgerId || 'system',
        userId,
        'INFO',
        '成功推送訊息給用戶',
        '訊息推送',
        {
          location: 'DD_pushMessage'
        }
      );

      return { success: true };
    } else {
      DL.DL_logError('DD5', `LINE API回應異常 ${response.status}`);

      // 記錄錯誤日誌
      await DD_writeToFirestoreLog(
        ledgerId || 'system',
        userId,
        'ERROR',
        `LINE API回應異常 ${response.status}`,
        '訊息推送',
        {
          location: 'DD_pushMessage',
          errorCode: 'API_ERROR',
          errorDetails: JSON.stringify(response.data)
        }
      );

      return {
        success: false,
        error: `API回應異常 (${response.status})`,
        details: response.data
      };
    }

  } catch (error) {
    DL.DL_logError('DD5', `推送訊息錯誤: ${error.message}`);

    // 記錄錯誤日誌
    try {
      await DD_writeToFirestoreLog(
        ledgerId || 'system',
        userId,
        'ERROR',
        '推送訊息錯誤',
        '訊息推送',
        {
          location: 'DD_pushMessage',
          errorCode: 'PUSH_ERROR',
          errorDetails: error.toString()
        }
      );
    } catch (logError) {
      DL.DL_logError('DD5', `日誌記錄失敗: ${logError.message}`);
    }

    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 61. 批次訊息推送 - Firestore日誌整合版
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 整合Firestore日誌記錄，支援跨帳本批次通知
 * @param {Array<string>} userIds - LINE 用戶 ID 陣列
 * @param {string|Object} message - 要發送的訊息內容
 * @param {string} ledgerId - 相關帳本ID（可選）
 * @returns {Promise<Object>} 發送結果
 */
async function DD_multicastMessage(userIds, message, ledgerId = null) {
  try {
    // 檢查用戶ID陣列
    if (!Array.isArray(userIds) || userIds.length === 0) {
      DL.DL_logWarning('DD5', 'LINE批次推送：無效的用戶ID陣列');
      return { success: false, error: "無效的用戶ID陣列" };
    }

    // 處理訊息內容
    let textMessage = "";
    if (typeof message === "object" && message !== null) {
      if (message.responseMessage && typeof message.responseMessage === "string") {
        textMessage = message.responseMessage;
      } else if (message.message && typeof message.message === "string") {
        textMessage = message.message;
      } else {
        try {
          textMessage = JSON.stringify(message);
        } catch (jsonError) {
          textMessage = "系統訊息";
          DL.DL_logWarning('DD5', `轉換訊息失敗: ${jsonError.message}`);
        }
      }
    } else if (typeof message === "string") {
      textMessage = message;
    } else {
      textMessage = "系統訊息";
    }

    // 限制訊息長度
    const maxLength = 5000;
    if (textMessage.length > maxLength) {
      textMessage = textMessage.substring(0, maxLength - 3) + "...";
    }

    // LINE API 設定
    const url = "https://api.line.me/v2/bot/message/multicast";
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) {
      DL.DL_logError('DD5', 'LINE批次推送：缺少 Channel Access Token');
      return { success: false, error: "缺少 Channel Access Token" };
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`
    };

    const payload = {
      to: userIds,
      messages: [{
        type: "text",
        text: textMessage
      }]
    };

    DL.DL_logInfo('DD5', `開始向 ${userIds.length} 個用戶批次推送訊息`);

    // 記錄到Firestore日誌
    await DD_writeToFirestoreLog(
      ledgerId || 'system',
      userIds.join(',').substring(0, 50) + "...",
      'INFO',
      `開始向 ${userIds.length} 個用戶批次推送訊息`,
      '批次訊息推送',
      {
        location: 'DD_multicastMessage',
        userCount: userIds.length,
        messageLength: textMessage.length
      }
    );

    // 發送請求
    const response = await axios.post(url, payload, { headers: headers });

    if (response.status === 200) {
      DL.DL_logInfo('DD5', `成功推送訊息給 ${userIds.length} 個用戶`);

      // 記錄成功日誌
      await DD_writeToFirestoreLog(
        ledgerId || 'system',
        userIds.join(',').substring(0, 50) + "...",
        'INFO',
        `成功推送訊息給 ${userIds.length} 個用戶`,
        '批次訊息推送',
        {
          location: 'DD_multicastMessage',
          userCount: userIds.length
        }
      );

      return { success: true };
    } else {
      DL.DL_logError('DD5', `LINE API回應異常 ${response.status}`);

      // 記錄錯誤日誌
      await DD_writeToFirestoreLog(
        ledgerId || 'system',
        userIds.join(',').substring(0, 50) + "...",
        'ERROR',
        `LINE API回應異常 ${response.status}`,
        '批次訊息推送',
        {
          location: 'DD_multicastMessage',
          errorCode: 'API_ERROR',
          errorDetails: JSON.stringify(response.data),
          userCount: userIds.length
        }
      );

      return {
        success: false,
        error: `API回應異常 (${response.status})`,
        details: response.data
      };
    }

  } catch (error) {
    DL.DL_logError('DD5', `批次推送訊息錯誤: ${error.message}`);

    // 記錄錯誤日誌
    try {
      await DD_writeToFirestoreLog(
        ledgerId || 'system',
        userIds ? userIds.join(',').substring(0, 50) + "..." : "",
        'ERROR',
        '批次推送訊息錯誤',
        '批次訊息推送',
        {
          location: 'DD_multicastMessage',
          errorCode: 'MULTICAST_ERROR',
          errorDetails: error.toString(),
          userCount: userIds ? userIds.length : 0
        }
      );
    } catch (logError) {
      DL.DL_logError('DD5', `日誌記錄失敗: ${logError.message}`);
    }

    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 62. 寫入Firestore日誌
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 統一的Firestore日誌寫入函數，支援系統級和帳本級日誌
 */
async function DD_writeToFirestoreLog(ledgerId, userId, severity, message, operationType, options = {}) {
  try {
    const {
      errorCode = '',
      errorDetails = '',
      location = '',
      functionName = '',
      retryCount = 0
    } = options;

    const logData = {
      時間: admin.firestore.Timestamp.now(),
      訊息: message,
      操作類型: operationType,
      UID: userId || '',
      錯誤代碼: errorCode || null,
      來源: 'DD5',
      錯誤詳情: errorDetails || '',
      重試次數: retryCount,
      程式碼位置: location || functionName || '',
      嚴重等級: severity
    };

    // 同時寫入系統級和帳本級日誌
    const promises = [];

    // 1. 系統級日誌
    promises.push(
      db.collection('_system').collection('logs').add({
        ...logData,
        ledgerId: ledgerId || null
      })
    );

    // 2. 帳本級日誌（如果有指定帳本且不是系統級）
    if (ledgerId && ledgerId !== 'system') {
      promises.push(
        db.collection('ledgers').doc(ledgerId).collection('log').add(logData)
      );
    }

    await Promise.all(promises);

  } catch (error) {
    // 如果日誌寫入失敗，輸出到控制台
    console.error(`Firestore日誌寫入失敗: ${error.message}. 原始訊息: ${message}`);
  }
}

/**
 * 63. 輔助函數：獲取帳本中的科目
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 從指定帳本獲取科目清單
 */
async function DD_getSubjectsFromLedger(ledgerId) {
  try {
    const subjectsSnapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('subjects')
      .where('isActive', '==', true)
      .orderBy('sortOrder')
      .get();

    const subjects = [];
    subjectsSnapshot.forEach(doc => {
      if (doc.id !== 'template') {
        const data = doc.data();
        subjects.push({
          '大項代碼': data['大項代碼'] || '',
          '大項名稱': data['大項名稱'] || '',
          '子項代碼': data['子項代碼'] || '',
          '子項名稱': data['子項名稱'] || '',
          '同義詞': data['同義詞'] || ''
        });
      }
    });

    return subjects;
  } catch (error) {
    DL.DL_logError('DD5', `獲取帳本科目失敗: ${error.message}`);
    return [];
  }
}

/**
 * 64. 輔助函數：獲取用戶科目使用統計
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 統計用戶的科目使用頻率
 */
async function DD_getUserSubjectUsageStats(userId) {
  try {
    // 查詢用戶的記帳歷史來統計科目使用
    const accessibleLedgers = await DD_getUserAccessibleLedgers(userId);
    const usageStats = {};

    for (const ledgerId of accessibleLedgers) {
      const entriesSnapshot = await db.collection('ledgers')
        .doc(ledgerId)
        .collection('entries')
        .where('UID', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(1000) // 限制查詢數量
        .get();

      entriesSnapshot.forEach(doc => {
        const data = doc.data();
        const subjectKey = `${data['大項代碼']}-${data['子項代碼']}`;

        if (!usageStats[subjectKey]) {
          usageStats[subjectKey] = { count: 0, lastUsed: null };
        }

        usageStats[subjectKey].count++;
        const timestamp = data.timestamp?.toDate() || new Date();
        if (!usageStats[subjectKey].lastUsed || timestamp > usageStats[subjectKey].lastUsed) {
          usageStats[subjectKey].lastUsed = timestamp;
        }
      });
    }

    return usageStats;
  } catch (error) {
    DL.DL_logError('DD5', `獲取科目使用統計失敗: ${error.message}`);
    return {};
  }
}

/**
 * 65. 輔助函數：獲取帳本資訊
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 獲取帳本的基本資訊
 */
async function DD_getLedgerInfo(ledgerId) {
  try {
    const ledgerDoc = await db.collection('ledgers').doc(ledgerId).get();
    if (ledgerDoc.exists) {
      return ledgerDoc.data();
    }
    return null;
  } catch (error) {
    DL.DL_logError('DD5', `獲取帳本資訊失敗: ${error.message}`);
    return null;
  }
}

/**
 * 66. 輔助函數：生成處理ID
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 生成唯一的處理ID
 */
function generateProcessId() {
  return Math.random().toString(36).substr(2, 8);
}

/**
 * 67. 輔助函數：智能判斷交易類型
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @description 根據文本和科目智能判斷是收入還是支出
 */
async function DD_smartDetermineTransactionType(text, subject) {
  try {
    // 基於關鍵字判斷
    if (/^(支出|買|購買|花費|消費)/.test(text)) {
      return "支出";
    } else if (/^(收入|賺|獲得|薪水|獎金)/.test(text)) {
      return "收入";
    }

    // 基於科目判斷（可以根據科目代碼或名稱）
    if (subject && (subject.includes('薪資') || subject.includes('獎金') || subject.includes('收入'))) {
      return "收入";
    }

    // 預設為支出
    return "支出";
  } catch (error) {
    DL.DL_logError('DD5', `智能判斷交易類型失敗: ${error.message}`);
    return "支出";
  }
}

// 其他輔助函數...
async function DD_getUserLedgerPreferences(userId) {
  try {
    // 實作用戶帳本偏好查詢
    return {};
  } catch (error) {
    return {};
  }
}

async function DD_getSubjectLedgerUsage(userId, subject) {
  try {
    // 實作科目在各帳本的使用統計
    return {};
  } catch (error) {
    return {};
  }
}

async function DD_getHistoricalRemarks(userId, subjectCode) {
  try {
    // 實作歷史備註查詢
    return [];
  } catch (error) {
    return [];
  }
}

function DD_isProjectActive(ledgerInfo, currentTime) {
  // 檢查專案帳本是否仍在有效期內
  return true; // 簡化實作
}

function DD_isCategoryMatched(ledgerInfo, subject) {
  // 檢查科目是否與分類帳本匹配
  return false; // 簡化實作
}

async function DD_formatBookkeepingRemark(parseResult, originalText) {
  // 實作備註格式化
  return originalText;
}

// 導出模組函數
module.exports = {
  DD_generateIntelligentRemark,
  DD_processParseResult,
  DD_getAllSubjects,
  DD_recommendBestLedger,
  DD_getUserAccessibleLedgers,
  DD_formatSystemReplyMessage,
  DD_getSubjectByCode,
  DD_pushMessage,
  DD_multicastMessage,
  DD_writeToFirestoreLog,
  DD_getSubjectsFromLedger,
  DD_getUserSubjectUsageStats,
  DD_getLedgerInfo
};

console.log('✅ DD5 智能記帳處理模組 3.0.0 載入完成 - 支援跨帳本查詢');
