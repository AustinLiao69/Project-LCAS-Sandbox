



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

