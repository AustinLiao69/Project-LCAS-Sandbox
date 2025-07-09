/**
 * 41. 檢查詞彙是否已為特定科目的同義詞
 * @param {string} term - 要檢查的詞彙
 * @param {string} subjectCode - 科目代碼
 * @returns {boolean} 是否已為同義詞
 */
function DD_checkSynonym(term, subjectCode) {
  const csId = Utilities.getUuid().substring(0, 8);
  console.log(`檢查同義詞: "${term}" 是否屬於 ${subjectCode} [${csId}]`);

  try {
    if (!term || !subjectCode) return false;

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return false;

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    const normalizedTerm = term.toLowerCase().trim();

    // 尋找對應的科目
    for (let i = 1; i < data.length; i++) {
      const rowMajorCode = String(
        data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1],
      );
      const rowSubCode = String(data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1]);

      if (rowMajorCode === majorCode && rowSubCode === subCode) {
        // 檢查該科目的同義詞
        const synonymsStr = data[i][DD_SUBJECT_CODE_SYNONYMS_COLUMN - 1] || "";
        const synonyms = synonymsStr
          .split(",")
          .map((s) => s.trim().toLowerCase());

        const isInSynonyms = synonyms.includes(normalizedTerm);
        console.log(
          `"${term}" ${isInSynonyms ? "已是" : "不是"} ${subjectCode} 的同義詞 [${csId}]`,
        );
        return isInSynonyms;
      }
    }

    console.log(`找不到對應科目代碼: ${subjectCode} [${csId}]`);
    return false;
  } catch (error) {
    console.log(`檢查同義詞錯誤: ${error} [${csId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `檢查同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "CHECK_SYN_ERROR",
      error.toString(),
      "DD_checkSynonym",
    );
    return false;
  }
}

/**
 * 42. 初始化配置 - 確保所有必要的配置項都存在
 * @version 2025-06-11-V1.0.0
 */
function DD_initConfig() {
  // 確保基本配置存在
  DD_CONFIG.DEBUG = DD_CONFIG.DEBUG !== undefined ? DD_CONFIG.DEBUG : true;
  DD_CONFIG.LOG_SHEET_NAME = DD_CONFIG.LOG_SHEET_NAME || "03. log";
  DD_CONFIG.SPREADSHEET_ID =
    DD_CONFIG.SPREADSHEET_ID || "1fYFPjswEF0jOEj4TSDehJPNTwBEVwv666jqnN2KMOKU";
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
 * 45. 同義詞學習功能 - 支持從test ledger抓取同義詞
 * @version 2025-05-29-V1.0.1
 * @author AustinLiao691
 * @update: 統一使用DD_formatUserSuccessFeedback和DD_formatUserErrorFeedback處理訊息
 * @param {string} userId - 用戶ID
 * @param {string} originalSubject - 用戶輸入的原始詞彙
 * @param {string} matchedSubject - 系統匹配的科目名稱
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @returns {object} - 處理結果，包含success字段
 */
function DD_synonymLearning(
  userId,
  originalSubject,
  matchedSubject,
  subjectCode,
) {
  const lsId = Utilities.getUuid().substring(0, 8);
  console.log(
    `【同義詞學習】開始處理: 用戶="${userId}", 原詞="${originalSubject}", 科目="${matchedSubject}", 代碼=${subjectCode} [${lsId}]`,
  );

  try {
    // 檢查參數
    if (!originalSubject || !matchedSubject || !subjectCode) {
      console.log(`【同義詞學習】參數不完整，放棄學習 [${lsId}]`);

      // 使用56號函數處理錯誤
      const paramErrorResult = DD_formatUserErrorFeedback("參數不完整", "DD", {
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
      const skipResult = DD_formatUserSuccessFeedback(
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
    if (DD_checkSynonym(normalizedInput, subjectCode)) {
      console.log(
        `【同義詞學習】"${originalSubject}"已經是科目${subjectCode}的同義詞，無需重複學習 [${lsId}]`,
      );

      // 使用57號函數處理成功訊息
      const alreadySynResult = DD_formatUserSuccessFeedback(
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
    const currentSynonyms = DD_getSynonymsForSubject(subjectCode);
    console.log(
      `【同義詞學習】當前科目同義詞: ${currentSynonyms || "無"} [${lsId}]`,
    );

    // 2. 從Test ledger中抓取可能的新同義詞
    const ledgerSynonyms = DD_fetchSynonymsFromLedger(subjectCode);
    console.log(
      `【同義詞學習】從Ledger獲取的同義詞: ${ledgerSynonyms || "無"} [${lsId}]`,
    );

    // 3. 合併同義詞，包括當前輸入的詞彙
    let allSynonyms = new Set();

    // 添加當前科目表的同義詞
    if (currentSynonyms) {
      currentSynonyms.split(",").forEach((syn) => {
        if (syn.trim()) allSynonyms.add(syn.trim());
      });
    }

    // 添加從ledger獲取的同義詞
    if (ledgerSynonyms) {
      ledgerSynonyms.split(",").forEach((syn) => {
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
    const updateResult = DD_updateSynonymsForSubject(
      subjectCode,
      updatedSynonyms,
    );

    if (updateResult.success) {
      console.log(`【同義詞學習】同義詞更新成功 [${lsId}]`);
      DD_logInfo(
        `同義詞學習成功: "${originalSubject}" -> ${matchedSubject} (${subjectCode})`,
        "同義詞學習",
        userId,
        "DD_synonymLearning",
      );

      // 5. 更新用戶偏好
      if (userId) {
        DD_userPreferenceManager(userId, originalSubject, subjectCode, false);
      }

      // 使用57號函數處理成功訊息
      const successResult = DD_formatUserSuccessFeedback(
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
      const updateErrorResult = DD_formatUserErrorFeedback(
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
    DD_logError(
      `同義詞學習錯誤: ${error}`,
      "同義詞處理",
      userId,
      "SYN_LEARN_ERROR",
      error.toString(),
      "DD_synonymLearning",
    );

    // 使用56號函數處理錯誤
    const generalErrorResult = DD_formatUserErrorFeedback(error, "DD", {
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
 * 46. 從Test ledger中抓取特定科目代碼的同義詞
 * @version 2025-05-02-V1.0.0
 * @author AustinLiao69
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @returns {string} - 逗號分隔的同義詞字符串，如果沒有找到則返回空字符串
 */
function DD_fetchSynonymsFromLedger(subjectCode) {
  const flId = Utilities.getUuid().substring(0, 8);
  console.log(
    `【抓取同義詞】開始從Test ledger抓取科目${subjectCode}的同義詞 [${flId}]`,
  );

  try {
    // 檢查bk�數
    if (!subjectCode) {
      console.log(`【抓取同義詞】科目代碼為空 [${flId}]`);
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

    // 打開Test ledger表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const ledgerSheet = ss.getSheetByName("999. Test ledger");

    if (!ledgerSheet) {
      console.log(`【抓取同義詞】找不到Test ledger表 [${flId}]`);
      return "";
    }

    // 獲取所有數據
    const data = ledgerSheet.getDataRange().getValues();

    // 定義列索引
    const MAJOR_CODE_COL = 4; // 大項代碼在第5列
    const MINOR_CODE_COL = 5; // 子項代碼在第6列
    const SYNONYM_COL = 12; // 同義詞在第13列

    // 收集所有匹配的同義詞
    const synonyms = new Set();

    for (let i = 1; i < data.length; i++) {
      // 檢查是否匹配科目代碼
      if (
        String(data[i][MAJOR_CODE_COL]) === majorCode &&
        String(data[i][MINOR_CODE_COL]) === subCode
      ) {
        // 檢查同義詞列是否有值
        const synValue = data[i][SYNONYM_COL];
        if (synValue && typeof synValue === "string" && synValue.trim()) {
          // 將同義詞添加到集合中（自動去重）
          synValue.split(",").forEach((syn) => {
            if (syn.trim()) synonyms.add(syn.trim());
          });
        }
      }
    }

    // 轉換為逗號分隔的字符串
    const result = Array.from(synonyms).join(",");

    console.log(
      `【抓取同義詞】從Test ledger找到${synonyms.size}個同義詞: ${result} [${flId}]`,
    );
    return result;
  } catch (error) {
    console.log(`【抓取同義詞】處理錯誤: ${error} [${flId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `從Ledger抓取同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "FETCH_SYN_ERROR",
      error.toString(),
      "DD_fetchSynonymsFromLedger",
    );
    return "";
  }
}

/**
 * 47. 獲取特定科目代碼的當前同義詞
 * @version 2025-05-02-V1.0.0
 * @author AustinLiao69
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @returns {string} - 當前的同義詞字符串，如果沒有找到則返回空字符串
 */
function DD_getSynonymsForSubject(subjectCode) {
  try {
    // 檢查參數
    if (!subjectCode) return "";

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return "";

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 打開科目代碼表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);

    if (!sheet) return "";

    // 獲取所有數據
    const data = sheet.getDataRange().getValues();

    // 尋找匹配的科目
    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1]) === majorCode &&
        String(data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1]) === subCode
      ) {
        // 返回該科目的同義詞列 (假設為第5列)
        return data[i][4] || "";
      }
    }

    return "";
  } catch (error) {
    console.log(`獲取科目同義詞錯誤: ${error}`);
    DD_logError(
      `獲取科目同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "GET_SYN_ERROR",
      error.toString(),
      "DD_getSynonymsForSubject",
    );
    return "";
  }
}

/**
 * 48. 更新特定科目代碼的同義詞
 * @version 2025-05-02-V1.0.0
 * @author AustinLiao69
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"
 * @param {string} synonyms - 更新後的同義詞字符串
 * @returns {object} - 包含success字段的結果對象
 */
function DD_updateSynonymsForSubject(subjectCode, synonyms) {
  const usId = Utilities.getUuid().substring(0, 8);
  console.log(
    `【更新同義詞】開始更新科目${subjectCode}的同義詞為: ${synonyms} [${usId}]`,
  );

  try {
    // 檢查參數
    if (!subjectCode) {
      console.log(`【更新同義詞】科目代碼為空 [${usId}]`);
      return { success: false, error: "科目代碼為空" };
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`【更新同義詞】科目代碼格式錯誤: ${subjectCode} [${usId}]`);
      return { success: false, error: "科目代碼格式錯誤" };
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 打開科目代碼表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);

    if (!sheet) {
      console.log(
        `【更新同義詞】找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${usId}]`,
      );
      return { success: false, error: "找不到科目表" };
    }

    // 獲取所有數據
    const data = sheet.getDataRange().getValues();

    // 尋找匹配的科目
    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1]) === majorCode &&
        String(data[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1]) === subCode
      ) {
        // 更新同義詞列 (假設為第5列)
        sheet.getRange(i + 1, 5).setValue(synonyms);

        console.log(
          `【更新同義詞】成功更新科目${subjectCode}的同義詞 [${usId}]`,
        );
        DD_logInfo(
          `更新科目${subjectCode}的同義詞: ${synonyms}`,
          "同義詞管理",
          "",
          "DD_updateSynonymsForSubject",
        );

        return { success: true };
      }
    }

    console.log(`【更新同義詞】找不到匹配的科目: ${subjectCode} [${usId}]`);
    return { success: false, error: "找不到匹配的科目" };
  } catch (error) {
    console.log(`【更新同義詞】處理錯誤: ${error} [${usId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `更新科目同義詞錯誤: ${error}`,
      "同義詞處理",
      "",
      "UPDATE_SYN_ERROR",
      error.toString(),
      "DD_updateSynonymsForSubject",
    );
    return { success: false, error: error.toString() };
  }
}

/**
 * 49. 生成記帳結果回覆訊息
 * @version 1.1.0 (2025-05-14)
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
      Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd");
    const timeStr =
      bkResult.time || Utilities.formatDate(new Date(), "Asia/Taipei", "HH:mm");

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
            科目：${minorName}
            備註：${remarkText}`;
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
 * @version 2025-05-29-V3.0.2
 * @author AustinLiao691
 * @update: 移除訊息生成代碼，委託給56/57號函數處理
 * @param {Object} data - 記帳數據
 * @returns {string} 格式化的回覆訊息
 */
function DD_generateBookkeepingMessage(data) {
  try {
    // 1. 記錄開始處理
    console.log(`開始生成記帳回覆訊息: ${JSON.stringify(data)}`);

    // 2. 檢查必要參數
    if (!data) {
      const errorResult = DD_formatUserErrorFeedback(
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
      const successResult = DD_formatUserSuccessFeedback(data, "BK", {
        operationType: "記帳",
        userId: data.userId || data.user_id || "",
      });

      return successResult.userFriendlyMessage;
    } else {
      // 失敗訊息 - 使用56號函數
      const errorResult = DD_formatUserErrorFeedback(
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
    const errorResult = DD_formatUserErrorFeedback(
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
 * 51. 解析使用者輸入格式
 * @version 2025-06-16-V3.5.0
 * @author AustinLiao69
 * @date 2025-06-16 02:13:23
 * @update: 修正負數金額解析及錯誤資料保存
 * @param {string} text - 用戶輸入的原始文本
 * @param {string} processId - 處理ID
 * @returns {Object} - 解析結果
 */
function DD_parseInputFormat(text, processId) {
  console.log(`DD_parseInputFormat: 開始解析文本「${text}」[${processId}]`);

  if (!text || text.trim() === "") {
    console.log(`DD_parseInputFormat: 空文本 [${processId}]`);
    return {
      _formatError: true,
      _errorDetail: "文本為空",
      _missingSubject: true,
      errorData: {
        success: false,
        error: "文本為空",
        errorType: "EMPTY_TEXT",
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "預設",
        },
      },
    };
  }

  // 移除空白
  text = text.trim();

  try {
    // 檢測負數模式 (改進版)
    const negativePattern = /^(.+?)(-\d+)(.*)$/;
    const negativeMatch = text.match(negativePattern);

    if (negativeMatch) {
      const subject = negativeMatch[1].trim();
      const rawAmount = negativeMatch[2]; // 保留負號
      const amount = parseFloat(rawAmount);

      // 支付方式提取
      let paymentMethod = "預設";
      const remainingText = negativeMatch[3].trim();

      // 更詳細地檢查支付方式
      const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
      for (const method of paymentMethods) {
        if (remainingText.includes(method)) {
          paymentMethod = method;
          break;
        }
      }

      // 如果沒有匹配到列出的支付方式，但有剩餘文本，使用整個剩餘文本作為支付方式
      if (paymentMethod === "預設" && remainingText) {
        paymentMethod = remainingText;
      }

      console.log(
        `DD_parseInputFormat: 識別負數格式 - 科目:「${subject}」, 金額:${rawAmount}, 支付方式:「${paymentMethod}」 [${processId}]`,
      );

      // 負數金額檢查 (關鍵部分：改為在這裡處理錯誤，同時保留原始數據)
      if (amount < 0) {
        console.log(
          `DD_parseInputFormat: 檢測到負數金額 ${amount} [${processId}]`,
        );

        // 構造包含完整信息的錯誤數據
        return {
          _formatError: true,
          _errorDetail: "金額不可為負數",
          subject: subject,
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          // 包含完整的錯誤數據
          errorData: {
            success: false,
            error: "金額不可為負數",
            errorType: "NEGATIVE_AMOUNT",
            partialData: {
              subject: subject,
              amount: amount,
              rawAmount: rawAmount,
              paymentMethod: paymentMethod,
              remark: subject, // 將科目保存為備註
            },
          },
        };
      }

      // 這裡正常情況不會執行到，因為上面已經返回了
      return {
        subject: subject,
        amount: Math.abs(amount),
        rawAmount: String(Math.abs(amount)),
        paymentMethod: paymentMethod,
      };
    }

    // 標準格式處理 (未修改部分)
    const regex = /^(.+?)(\d+)(.*)$/;
    const match = text.match(regex);

    if (match) {
      const subject = match[1].trim();
      const amount = parseInt(match[2], 10);
      const rawAmount = match[2];

      // 支付方式提取 (與負數格式相同邏輯)
      let paymentMethod = "預設";
      const remainingText = match[3].trim();

      const paymentMethods = ["現金", "刷卡", "行動支付", "轉帳", "信用卡"];
      for (const method of paymentMethods) {
        if (remainingText.includes(method)) {
          paymentMethod = method;
          break;
        }
      }

      if (paymentMethod === "預設" && remainingText) {
        paymentMethod = remainingText;
      }

      console.log(
        `DD_parseInputFormat: 識別標準格式 - 科目:「${subject}」, 金額:${amount}, 支付方式:「${paymentMethod}」 [${processId}]`,
      );

      if (subject === "") {
        return {
          _formatError: true,
          _errorDetail: "未明確指定科目名稱",
          _missingSubject: true,
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          errorData: {
            success: false,
            error: "未明確指定科目名稱",
            errorType: "MISSING_SUBJECT",
            partialData: {
              subject: "未知科目",
              amount: amount,
              rawAmount: rawAmount,
              paymentMethod: paymentMethod,
            },
          },
        };
      }

      return {
        subject: subject,
        amount: amount,
        rawAmount: rawAmount,
        paymentMethod: paymentMethod,
      };
    } else {
      console.log(`DD_parseInputFormat: 無法解析格式 [${processId}]`);
      return {
        _formatError: true,
        _errorDetail: "無法識別輸入格式",
        errorData: {
          success: false,
          error: "無法識別輸入格式",
          errorType: "UNRECOGNIZED_FORMAT",
          partialData: {
            subject: text,
            amount: 0,
            rawAmount: "0",
            paymentMethod: "預設",
          },
        },
      };
    }
  } catch (error) {
    console.log(`DD_parseInputFormat: 解析錯誤 ${error} [${processId}]`);
    return {
      _formatError: true,
      _errorDetail: `解析錯誤: ${error.toString()}`,
      errorData: {
        success: false,
        error: `解析錯誤: ${error.toString()}`,
        errorType: "PARSE_ERROR",
        partialData: {
          subject: text,
          amount: 0,
          rawAmount: "0",
          paymentMethod: "預設",
        },
      },
    };
  }
}

// 更新現有的 Utilities 物件，添加缺少的方法
if (typeof Utilities !== "undefined" && !Utilities.formatDate) {
  Utilities.formatDate = (date, timezone, format) => {
    // 使用 moment-timezone 確保時區正確處理
    const momentDate = moment(date).tz(timezone || "Asia/Taipei");

    if (format === "yyyy/MM/dd HH:mm") {
      return momentDate.format("YYYY/MM/DD HH:mm");
    } else if (format === "yyyy/M/d") {
      return momentDate.format("YYYY/M/D");
    } else if (format === "HH:mm") {
      return momentDate.format("HH:mm");
    } else if (format === "yyyy-MM-dd HH:mm:ss") {
      return momentDate.format("YYYY-MM-DD HH:mm:ss");
    }
    return momentDate.format();
  };
}

// 更新現有的 SpreadsheetApp 物件，添加 getActive 方法
if (typeof SpreadsheetApp !== "undefined" && !SpreadsheetApp.getActive) {
  SpreadsheetApp.getActive = () => ({
    getSheetByName: (name) => ({
      getDataRange: () => ({
        getValues: () => spreadsheetData[name] || [],
      }),
    }),
  });
}

/**
 * 52. 記帳備註生成與格式化
 * @version 2025-05-21-V1.0.2
 * @author AustinLiao69
 * @date 2025-05-21 16:12:14
 * @update: 增強格式化能力，確保移除金額和支付方式
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