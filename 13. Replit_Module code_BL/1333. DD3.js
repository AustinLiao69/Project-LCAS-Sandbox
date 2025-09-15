/**
 * DD3_資料服務模組_2.0.0
 * @module 資料服務模組
 * @description LCAS 2.0 資料服務模組 - 完全遷移至Firestore資料庫，每個使用者獨立帳本
 * @update 2025-01-09: 升級版本至2.0.0，完全遷移至Firestore，移除Google Sheets依賴，遵循2011模組資料庫結構，移除預設ledgerID
 */

// 引入 Firebase Admin SDK
const admin = require("firebase-admin");

// 確保 Firebase 已初始化
if (!admin.apps.length) {
  const serviceAccount = require("./Serviceaccountkey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = "Asia/Taipei";

// 延遲載入模組以避免循環依賴
let DD1, DD2, DL;
function loadModules() {
  if (!DD1) DD1 = require("./1331. DD1.js");
  if (!DD2) DD2 = require("./1332. DD2.js");
  if (!DL) DL = require("./1310. DL.js");
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
 * 58. 格式化系統回覆訊息 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 14:30:00
 * @update: 重寫為Firestore版本，支援跨帳本資訊顯示
 * @param {Object} resultData - 處理結果數據
 * @param {string} moduleCode - 模組代碼
 * @param {Object} options - 附加選項
 * @returns {Object} 格式化後的回覆訊息
 */
async function DD_formatSystemReplyMessage(
  resultData,
  moduleCode,
  options = {},
) {
  const userId = options.userId || "";
  const processId = options.processId || generateProcessId();
  let errorMsg = "未知錯誤";

  const currentDateTime = new Date().toLocaleString("zh-TW", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  loadModules(); // 確保模組已載入
    if (DL && DL.DL_logDebug) {
      DL.DL_logDebug("DD5", `開始格式化訊息 [${processId}], 模組: ${moduleCode}`);
    }

  try {
    // 檢查是否已有完整回覆訊息
    if (resultData && resultData.responseMessage) {
      if (DL && DL.DL_logDebug) {
        DL.DL_logDebug("DD5", `使用現有回覆訊息 [${processId}]`);
      }
      return {
        success: resultData.success === true,
        responseMessage: resultData.responseMessage,
        originalResult: resultData.originalResult || resultData,
        processId: processId,
        errorType: resultData.errorType || null,
        moduleCode: moduleCode,
        partialData: resultData.partialData || {},
        error: resultData.success === true ? undefined : errorMsg,
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
          timestamp: new Date().getTime(),
        },
      };
    }

    let responseMessage = "";
    const isSuccess = resultData.success === true;

    // 提取部分數據
    let partialData =
      resultData.parsedData || resultData.partialData || resultData.data || {};

    if (isSuccess) {
      // 成功訊息
      if (resultData.responseMessage) {
        responseMessage = resultData.responseMessage;
      } else if (resultData.data) {
        const data = resultData.data;
        const subjectName = data.subjectName || partialData.subject || "";
        const amount =
          data.rawAmount || partialData.rawAmount || data.amount || 0;
        const action = data.action || resultData.action || "支出";
        const paymentMethod =
          data.paymentMethod || partialData.paymentMethod || "";
        const date = data.date || currentDateTime;
        const remark = data.remark || partialData.remark || "無";
        const userType = data.userType || "J";

        // 添加帳本資訊（如果有推薦帳本）
        let ledgerInfo = "";
        if (data.recommendedLedgerId) {
          try {
            loadModules();
            const ledgerData = DD1 && DD1.DD_getLedgerInfo ? await DD1.DD_getLedgerInfo(data.recommendedLedgerId) : null;
            if (ledgerData) {
              ledgerInfo = `\n帳本：${ledgerData.name} (${ledgerData.type})`;
            }
          } catch (e) {
            if (DL && DL.DL_logDebug) {
              DL.DL_logDebug("DD5", `獲取帳本資訊失敗: ${e.message}`);
            }
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
      errorMsg =
        resultData.error ||
        resultData.message ||
        resultData.errorData?.error ||
        "未知錯誤";

      const subject = partialData.subject || "未知科目";
      const displayAmount =
        partialData.rawAmount ||
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

    if (DL && DL.DL_logDebug) {
      DL.DL_logDebug("DD5", `訊息格式化完成 [${processId}]`);
    }

    return {
      success: isSuccess,
      responseMessage: responseMessage,
      originalResult: resultData,
      processId: processId,
      errorType: resultData.errorType || null,
      moduleCode: moduleCode,
      partialData: partialData,
      error: isSuccess ? undefined : errorMsg,
    };
  } catch (error) {
    if (DL && DL.DL_logError) {
      DL.DL_logError("DD5", `格式化過程出錯: ${error.message} [${processId}]`);
    }

    const fallbackMessage = `記帳失敗！\n時間：${currentDateTime}\n科目：未知科目\n金額：0元\n支付方式：未指定支付方式\n備註：無\n使用者類型：J\n錯誤原因：訊息格式化錯誤`;

    return {
      success: false,
      responseMessage: fallbackMessage,
      processId: processId,
      errorType: "FORMAT_ERROR",
      moduleCode: moduleCode,
      error: error.toString(),
    };
  }
}

/**
 * 62. 時間戳轉換函數 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore資料庫
 */
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
  formatDate,
  formatTime,
  DD_calculateSimilarity,
  DD_formatSystemReplyMessage,
  DD_convertTimestamp,
  DD_log: function(...args) {
    loadModules();
    return DD1 ? DD1.DD_log(...args) : console.log(...args);
  },
};