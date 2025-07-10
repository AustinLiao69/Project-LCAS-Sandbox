
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