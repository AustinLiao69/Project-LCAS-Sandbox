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

