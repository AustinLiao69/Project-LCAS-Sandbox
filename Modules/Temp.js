



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
