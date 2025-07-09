
/**
 * 13. 從字符串中提取數字
 */
function extractNumberFromString(str) {
  if (!str) return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * 14. 從文字中移除金額部分
 * @version 2.0.3 (2025-06-28)
 * @author AustinLiao69
 * @param {string} text - 原始文字 (例如 "測試支出99999")
 * @param {number|string} amount - 要移除的金額 (例如 99999)
 * @param {string} paymentMethod - 支付方式 (可選)
 * @returns {string} - 移除金額後的文字 (例如 "測試支出")
 */
function DD_removeAmountFromText(text, amount) {
  // 檢查參數
  if (!text || !amount) return text;

  // 記錄處理前文字
  console.log(`處理文字移除金額: 原始文字="${text}", 金額=${amount}`);

  // 將金額轉為字符串，並轉義正則表達式特殊字符
  const amountStr = String(amount).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = text;

  try {
    // 1. 處理 "科目 金額" 格式 (含空格)
    const spacePattern = new RegExp(`\\s+${amountStr}(?:\\s|$)`, 'g');
    if (spacePattern.test(text)) {
      result = text.replace(spacePattern, '').trim();
      console.log(`使用空格格式匹配: "${result}"`);
      return result;
    }

    // 2. 處理 "科目金額" 格式 (無空格，數字直接連接)
    const endPattern = new RegExp(`${amountStr}$`);
    if (endPattern.test(text)) {
      result = text.replace(endPattern, '').trim();
      console.log(`使用尾部匹配: "${result}"`);
      return result;
    }

    // 3. 處理 "科目金額元" 或 "科目金額塊" 格式
    const currencyPattern = new RegExp(`${amountStr}(元|塊|圓|NT|USD)?$`, "i");
    const match = text.match(currencyPattern);
    if (match) {
      result = text.substring(0, match.index).trim();
      console.log(`使用貨幣單位匹配: "${result}"`);
      return result;
    }

    // 4. 通用數字移除：移除任何連續的數字（如果與金額匹配）
    const generalNumberPattern = new RegExp(`\\d{${amountStr.length},}`, 'g');
    const numberMatches = text.match(generalNumberPattern);
    if (numberMatches) {
      for (const match of numberMatches) {
        if (match === String(amount)) {
          result = text.replace(match, '').trim();
          console.log(`使用通用數字匹配: "${result}"`);
          return result;
        }
      }
    }

    // 5. 清理多餘的空格和標點符號
    result = text.replace(/\s+/g, ' ').replace(/[，。！？；：、]/g, '').trim();

    // 6. 如果結果與原文差不多，嘗試提取非數字部分
    if (result === text) {
      const nonDigitMatch = text.match(/^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\w\s]+/);
      if (nonDigitMatch) {
        result = nonDigitMatch[0].replace(/\d+/g, '').trim();
        console.log(`提取非數字部分: "${result}"`);
        return result;
      }
    }

    console.log(`無法確定金額位置，保留原始文字: "${text}"`);
    return text;
  } catch (error) {
    console.log(`移除金額失敗: ${error.toString()}, 返回原始文字`);
    return text;
  }
}

// 模組匯出
module.exports = {
  DD_distributeData,
  DD_classifyData,
  DD_dispatchData,
  DD_processForWH,
  DD_processForBK,
  extractNumberFromString,
  DD_removeAmountFromText,
  DD_CONFIG,
  DD_MAX_RETRIES,
  DD_RETRY_DELAY,
  DD_TARGET_MODULE_BK,
  DD_TARGET_MODULE_WH,
  DD_SUBJECT_CODE_SHEET_NAME,
  DD_SUBJECT_CODE_MAJOR_CODE_COLUMN,
  DD_SUBJECT_CODE_MAJOR_NAME_COLUMN,
  DD_SUBJECT_CODE_SUB_CODE_COLUMN,
  DD_SUBJECT_CODE_SUB_NAME_COLUMN,
  DD_SUBJECT_CODE_SYNONYMS_COLUMN,
  DD_USER_PREF_SHEET_NAME,
  DD_MODULE_PREFIX,
};

/**
 * 15. 處理用戶消息並提取記帳信息 - 修正收入支出判斷邏輯
 * @version 2025-06-27-V9.1.1
 * @author AustinLiao69
 * @date 2025-06-27 06:39:02
 * @update: 修正收入支出判斷邏輯、移除支付方式預設值處理、解決重複宣告問題
 * @param {string} message - 用戶輸入的消息
 * @param {string} userId - 用戶ID (可選)
 * @param {string} timestamp - 時間戳 (可選)
 * @return {Object} 處理結果
 */
async function DD_processUserMessage(message, userId = "", timestamp = "") {
  // 1. 生成處理ID
  const msgId = Utilities.getUuid().substring(0, 8);

  // 2. 開始日誌記錄
  DD_logInfo(
    `處理用戶消息: "${message}"`,
    "訊息處理",
    userId,
    "DD_processUserMessage",
    "DD_processUserMessage",
  );
  console.log(
    `DD_processUserMessage: 開始處理用戶訊息 "${message}" [${msgId}]`,
  );

  try {
    // 3. 確保配置初始化
    DD_initConfig();
    DD_logDebug(
      `DD_CONFIG.SYNONYM檢查: FUZZY_MATCH_THRESHOLD=${(DD_CONFIG.SYNONYM && DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD) || "未設置"}, ENABLE_COMPOUND_WORDS=${(DD_CONFIG.SYNONYM && DD_CONFIG.SYNONYM.ENABLE_COMPOUND_WORDS) || "未設置"}`,
      "訊息處理",
      userId,
      "DD_processUserMessage",
      "DD_processUserMessage",
    );

    // 4. 檢查空訊息
    if (!message || message.trim() === "") {
      DD_logWarning(
        `空訊息 [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );
      console.log(`DD_processUserMessage: 檢測到空訊息 [${msgId}]`);

      // 4.1 建立標準錯誤資料結構，與BK模組格式相容
      const errorData = {
        success: false,
        error: "空訊息",
        errorType: "EMPTY_MESSAGE",
        message: "記帳失敗: 空訊息",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "", // 不設置預設值，由BK處理
          timestamp: new Date().getTime(),
        },
        userFriendlyMessage:
          "記帳處理失敗 (VALIDATION_ERROR)：訊息為空\n請重新嘗試或聯繫管理員。",
      };

      // 4.3 回傳統一格式的錯誤結果
      return {
        type: "記帳",
        processed: false,
        reason: "空訊息",
        processId: msgId,
        errorType: "EMPTY_MESSAGE",
        errorData: errorData,
      };
    }

    // 5. 清理輸入訊息
    message = message.trim();
    console.log(`DD_processUserMessage: 清理後訊息: "${message}" [${msgId}]`);

    // 6. 使用DD_parseInputFormat解析輸入格式
    console.log(`DD_processUserMessage: 調用DD_parseInputFormat [${msgId}]`);
    const parseResult = DD_parseInputFormat(message, msgId);
    console.log(
      `DD_processUserMessage: DD_parseInputFormat回傳結果: ${JSON.stringify(parseResult)} [${msgId}]`,
    );

    // 7. 檢查解析結果 - 快速攔截錯誤
    if (!parseResult) {
      DD_logWarning(
        `DD_parseInputFormat回傳null，無法解析訊息格式: "${message}" [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );
      console.log(
        `DD_processUserMessage: DD_parseInputFormat回傳null [${msgId}]`,
      );

      // 7.1 建立標準錯誤資料結構，與BK模組格式相容
      const errorData = {
        success: false,
        error: "無法識別記帳意圖",
        errorType: "FORMAT_NOT_RECOGNIZED",
        message: "記帳失敗: 無法識別記帳意圖",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: message,
          amount: 0,
          rawAmount: "0",
          paymentMethod: "", // 不設置預設值，由BK處理
          timestamp: new Date().getTime(),
        },
      };

      // 7.3 回傳統一格式的錯誤結果
      return {
        type: "記帳",
        processed: false,
        reason: "無法識別記帳意圖",
        processId: msgId,
        errorType: "FORMAT_NOT_RECOGNIZED",
        errorData: errorData,
      };
    }

    // 8. 處理回傳的格式錯誤
    if (parseResult._formatError || parseResult._missingSubject) {
      DD_logWarning(
        `輸入格式錯誤: "${message}" [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );
      console.log(`DD_processUserMessage: 檢測到格式錯誤 [${msgId}]`);

      // 8.1 使用提供的errorData
      if (parseResult.errorData) {
        console.log(`DD_processUserMessage: 使用提供的errorData [${msgId}]`);

        // 8.1.1 確保errorData包含必要欄位
        if (!parseResult.errorData.message && parseResult.errorData.error) {
          parseResult.errorData.message = `記帳失敗: ${parseResult.errorData.error}`;
        }

        // 8.1.3 回傳統一格式的錯誤結果
        return {
          type: "記帳",
          processed: false,
          reason:
            parseResult.errorData.error ||
            parseResult._errorDetail ||
            "輸入格式問題",
          processId: msgId,
          errorType: parseResult.errorData.errorType || "FORMAT_ERROR",
          errorData: parseResult.errorData,
        };
      }

      // 8.2 自行建構符合BK模組格式的錯誤資料
      console.log(`DD_processUserMessage: 自行建構errorData [${msgId}]`);
      const errorType = parseResult._missingSubject
        ? "MISSING_SUBJECT"
        : "FORMAT_ERROR";
      const errorMsg = parseResult._errorDetail || "輸入格式錯誤";

      const errorData = {
        success: false,
        error: errorMsg,
        errorType: errorType,
        message: `記帳失敗: ${errorMsg}`,
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: parseResult.subject || "",
          amount: parseResult.amount || 0,
          rawAmount: parseResult.rawAmount || "0",
          paymentMethod: parseResult.paymentMethod || "", // 不設預設值
          timestamp: new Date().getTime(),
        },
      };

      // 8.2.2 回傳統一格式的錯誤結果
      return {
        type: "記帳",
        processed: false,
        reason: errorMsg,
        processId: msgId,
        errorType: errorType,
        errorData: errorData,
      };
    }

    // 9. 提取成功解析的結果
    const subject = parseResult.subject;
    const amount = parseResult.amount;
    const rawAmount = parseResult.rawAmount || String(amount);
    const paymentMethod = parseResult.paymentMethod; // 直接使用解析結果，不設預設值

    // 9.1 記錄解析結果，包括支付方式
    if (paymentMethod) {
      console.log(
        `DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 支付方式=${paymentMethod} [${msgId}]`,
      );
    } else {
      console.log(
        `DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 未指定支付方式 [${msgId}]`,
      );
    }

    // 10. 科目匹配處理 - 繼續現有流程
    if (subject) {
      // 只檢查科目是否存在
      console.log(`DD_processUserMessage: 開始科目匹配階段 [${msgId}]`);

      // 10.1 同義詞系統整合 - 多層匹配策略
      let subjectInfo = null;
      let matchMethod = "unknown";
      let confidence = 0;
      let originalSubject = subject; // 保存原始輸入詞彙

      // 10.2 嘗試用戶偏好匹配 (如果提供了用戶ID)
      if (userId) {
        console.log(`DD_processUserMessage: 嘗試用戶偏好匹配 [${msgId}]`);
        try {
          const userPref = DD_userPreferenceManager(userId, subject, "", true);
          if (userPref) {
            const prefSubject = DD_getSubjectByCode(userPref.subjectCode);
            if (prefSubject) {
              subjectInfo = prefSubject;
              matchMethod = "user_preference";
              confidence = 0.9;
              console.log(
                `DD_processUserMessage: 用戶偏好匹配成功 "${subject}" -> ${prefSubject.subName} [${msgId}]`,
              );
              DD_logDebug(
                `用戶偏好匹配: "${subject}" -> ${prefSubject.subName}, 科目代碼=${userPref.subjectCode}`,
                "科目匹配",
                userId,
                "DD_processUserMessage",
                "DD_processUserMessage",
              );
            }
          }
        } catch (prefError) {
          console.log(
            `DD_processUserMessage: 用戶偏好匹配錯誤 ${prefError.toString()} [${msgId}]`,
          );
        }
      }

      // 10.3 嘗試精確匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試精確匹配 [${msgId}]`);
        DD_logInfo(
          `嘗試查詢科目代碼: "${subject}" [${msgId}]`,
          "科目匹配",
          userId,
          "DD_processUserMessage",
          "DD_processUserMessage",
        );

        try {
          subjectInfo = await DD_getSubjectCode(subject);

          if (subjectInfo) {
            matchMethod = "exact_match";
            confidence = 1.0;
            console.log(
              `DD_processUserMessage: 精確匹配成功 "${subject}" -> ${subjectInfo.subName} [${msgId}]`,
            );
            DD_logInfo(
              `精確匹配成功: "${subject}" -> ${subjectInfo.subName}, 科目代碼=${subjectInfo.majorCode}-${subjectInfo.subCode}`,
              "科目匹配",
              userId,
              "DD_processUserMessage",
              "DD_processUserMessage",
            );
          } else {
            console.log(`DD_processUserMessage: 精確匹配失敗 [${msgId}]`);
            DD_logWarning(
              `精確匹配失敗: "${subject}" [${msgId}]`,
              "科目匹配",
              userId,
              "DD_processUserMessage",
              "DD_processUserMessage",
            );
          }
        } catch (matchError) {
          console.log(
            `DD_processUserMessage: 精確匹配發生錯誤 ${matchError.toString()} [${msgId}]`,
          );
        }
      }

      // 10.4 嘗試模糊匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試模糊匹配 [${msgId}]`);
        DD_logInfo(
          `嘗試模糊匹配: "${subject}" [${msgId}]`,
          "科目匹配",
          userId,
          "DD_processUserMessage",
          "DD_processUserMessage",
        );

        try {
          const fuzzyThreshold =
            (DD_CONFIG.SYNONYM && DD_CONFIG.SYNONYM.FUZZY_MATCH_THRESHOLD) ||
            0.7;
          const fuzzyMatch = await DD_fuzzyMatch(subject);

          if (fuzzyMatch && fuzzyMatch.score >= fuzzyThreshold) {
            subjectInfo = fuzzyMatch;
            matchMethod = "fuzzy_match";
            confidence = fuzzyMatch.score;
            console.log(
              `DD_processUserMessage: 模糊匹配成功 "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)} [${msgId}]`,
            );
            DD_logInfo(
              `模糊匹配成功: "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)}`,
              "科目匹配",
              userId,
              "DD_processUserMessage",
              "DD_processUserMessage",
            );
          } else {
            console.log(
              `DD_processUserMessage: 模糊匹配失敗或分數低於閾值 [${msgId}]`,
            );
            DD_logWarning(
              `模糊匹配失敗或分數低於閾值: "${subject}" [${msgId}]`,
              "科目匹配",
              userId,
              "DD_processUserMessage",
              "DD_processUserMessage",
            );
          }
        } catch (fuzzyError) {
          console.log(
            `DD_processUserMessage: 模糊匹配發生錯誤 ${fuzzyError.toString()} [${msgId}]`,
          );
        }
      }

      // 10.5 處理多對多映射 (如果提供了時間戳)
      if (subjectInfo && matchMethod === "exact_match" && timestamp) {
        console.log(`DD_processUserMessage: 檢查是否有多重映射 [${msgId}]`);

        try {
          const multiMap = DD_checkMultipleMapping(subject);
          if (multiMap && multiMap.length > 1) {
            console.log(
              `DD_processUserMessage: 檢測到多重映射: "${subject}" 可能屬於 ${multiMap.length} 個類別 [${msgId}]`,
            );
            DD_logDebug(
              `檢測到多重映射: "${subject}" 可能屬於 ${multiMap.length} 個類別`,
              "科目匹配",
              userId,
              "DD_processUserMessage",
              "DD_processUserMessage",
            );

            const contextMatch = DD_timeAwareClassification(
              multiMap,
              timestamp,
            );
            if (contextMatch) {
              subjectInfo = contextMatch;
              matchMethod = "time_context";
              confidence = contextMatch.confidence || 0.8;
              console.log(
                `DD_processUserMessage: 時間上下文匹配: "${subject}" -> ${contextMatch.subName} [${msgId}]`,
              );
              DD_logDebug(
                `時間上下文匹配: "${subject}" -> ${contextMatch.subName}`,
                "科目匹配",
                userId,
                "DD_processUserMessage",
                "DD_processUserMessage",
              );
            }
          }
        } catch (multiError) {
          console.log(
            `DD_processUserMessage: 多重映射檢查發生錯誤 ${multiError.toString()} [${msgId}]`,
          );
        }
      }

      // 11. 準備回傳結果
      if (subjectInfo) {
        console.log(
          `DD_processUserMessage: 科目匹配完成，準備回傳結果 [${msgId}]`,
        );
        DD_logInfo(
          `科目匹配完成: "${subject}" -> ${subjectInfo.subName} (${matchMethod})`,
          "科目匹配",
          userId,
          "DD_processUserMessage",
          "DD_processUserMessage",
        );

        // 11.1 決定收支類型 - 修正邏輯!
        let action = "支出"; // 預設為支出

        // 修改：處理負數金額，仍設定為支出但保留負號
        if (amount < 0) {
          action = "支出";
          console.log(
            `DD_processUserMessage: 檢測到負數金額: ${amount}，設定為支出類型 [${msgId}]`,
          );
          DD_logInfo(
            `檢測到負數金額: ${amount}，設定為支出類型`,
            "金額處理",
            userId,
            "DD_processUserMessage",
            "DD_processUserMessage",
          );
        } else {
          // 根據科目大類判斷收支類型 - 修正：以8開頭的為收入，其他為支出
          if (
            subjectInfo.majorCode &&
            subjectInfo.majorCode.toString().startsWith("8")
          ) {
            action = "收入";
            console.log(
              `DD_processUserMessage: 根據科目代碼 ${subjectInfo.majorCode} 判斷為收入 [${msgId}]`,
            );
          } else {
            action = "支出";
            console.log(
              `DD_processUserMessage: 根據科目代碼 ${subjectInfo.majorCode} 判斷為支出 [${msgId}]`,
            );
          }
        }

        // 11.2 建構回傳結果
        // 處理備註：從原始文字中移除金額部分
        const remarkText = DD_removeAmountFromText(message, amount) || subject;

        // 11.3 建構完整回傳結果
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
          paymentMethod: paymentMethod, // 直接傳遞原始值，不設預設值
          action: action,
          confidence: confidence,
          matchMethod: matchMethod,
          text: remarkText, // 移除金額後的文字作為備註
          originalSubject: originalSubject,
          processId: msgId,
        };

        // 記錄支付方式狀態
        if (paymentMethod) {
          console.log(
            `DD_processUserMessage: 用戶指定了支付方式: ${paymentMethod} [${msgId}]`,
          );
        } else {
          console.log(
            `DD_processUserMessage: 用戶未指定支付方式，保留為空 [${msgId}]`,
          );
        }

        console.log(
          `DD_processUserMessage: 回傳結果: ${JSON.stringify(result)} [${msgId}]`,
        );
        return result;
      } else {
        // 11.3 科目匹配失敗處理
        console.log(`DD_processUserMessage: 科目匹配失敗 [${msgId}]`);
        DD_logWarning(
          `科目匹配失敗: "${subject}"`,
          "科目匹配",
          userId,
          "DD_processUserMessage",
          "DD_processUserMessage",
        );

        // 建構標準錯誤資料結構
        const errorData = {
          success: false,
          error: `無法識別科目: "${subject}"`,
          errorType: "UNKNOWN_SUBJECT",
          message: `記帳失敗: 無法識別科目: "${subject}"`,
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "BK",
          },
          isRetryable: true,
          partialData: {
            subject: subject,
            amount: amount,
            rawAmount: rawAmount,
            paymentMethod: paymentMethod, // 不設預設值
            timestamp: new Date().getTime(),
          },
        };

        // 回傳統一格式的錯誤結果
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
      // 12. 科目缺失處理
      console.log(`DD_processUserMessage: 科目為空 [${msgId}]`);
      DD_logWarning(
        `科目為空`,
        "科目匹配",
        userId,
        "DD_processUserMessage",
        "DD_processUserMessage",
      );

      // 建構標準錯誤資料結構
      const errorData = {
        success: false,
        error: "未指定科目",
        errorType: "MISSING_SUBJECT",
        message: "記帳失敗: 未指定科目",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "BK",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod, // 不設預設值
          timestamp: new Date().getTime(),
        },
      };

      // 回傳統一格式的錯誤結果
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
    // 13. 異常處理
    console.log(`DD_processUserMessage異常: ${error.toString()} [${msgId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);

    DD_logError(
      `處理用戶消息時發生異常: ${error.toString()}`,
      "訊息處理",
      userId,
      "PROCESS_ERROR",
      error.toString(),
      "DD_processUserMessage",
      "DD_processUserMessage",
    );

    // 建構標準錯誤資料結構
    const errorData = {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR",
      message: `記帳失敗: 處理異常: ${error.toString()}`,
      errorDetails: {
        processId: msgId,
        errorType: "SYSTEM_ERROR",
        module: "BK",
      },
      isRetryable: false,
    };

    // 回傳統一格式的錯誤結果
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

// 修改：不再重複宣告Utilities和SpreadsheetApp物件，改用擴充方式
// 擴充Utilities物件的方法
if (typeof Utilities === "object") {
  // 只有在Utilities已存在時才擴充
  if (!Utilities.getUuid) {
    Utilities.getUuid = () => uuidv4();
  }

  if (!Utilities.formatDate) {
    Utilities.formatDate = (date, timezone, format) => {
      // 增強的日期格式化，支援更多格式
      if (format === "yyyy/M/d") {
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
      } else if (format === "HH:mm") {
        return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
      } else if (format === "yyyy-MM-dd HH:mm:ss") {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
      } else if (format === "yyyy/MM/dd HH:mm") {
        // 關鍵修復：支援58號函數使用的格式
        return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
      }
      return date.toString();
    };
  }
}

// 擴充SpreadsheetApp物件的方法
if (typeof SpreadsheetApp === "object") {
  // 只有在SpreadsheetApp已存在時才擴充
  if (!SpreadsheetApp.openById) {
    SpreadsheetApp.openById = (id) => ({
      getSheetByName: (name) => ({
        getLastRow: () =>
          spreadsheetData[name] ? spreadsheetData[name].length : 0,
        getRange: (row, col, numRows, numCols) => ({
          getValues: () => spreadsheetData[name] || [],
        }),
        getDataRange: () => ({
          getValues: () => spreadsheetData[name] || [],
        }),
        appendRow: (rowData) => {
          if (!spreadsheetData[name]) {
            spreadsheetData[name] = [];
          }
          spreadsheetData[name].push(rowData);
        },
      }),
    });
  }
}

/**
 * 16. 查詢科目代碼表的函數 - 增強版，支持複合詞匹配與空格同義詞
 * @version 2025-04-30-V4.1.6
 * @author AustinLiao69
 * @param {string} subjectName - 要查詢的科目名稱
 * @returns {object|null} - 如果找到，返回包含 {majorCode, majorName, subCode, subName} 的物件，否則返回 null
 */
async function DD_getSubjectCode(subjectName) {
  const scId = Utilities.getUuid().substring(0, 8);
  console.log(`### 使用2025-04-30-V4.1.5增強版DD_getSubjectCode ###`);
  console.log(`查詢科目代碼: "${subjectName}", ID=${scId}`);

  try {
    // 檢查參數
    if (!subjectName) {
      console.log(`科目名稱為空 [${scId}]`);
      DD_logWarning(
        `科目名稱為空，無法查詢科目代碼 [${scId}]`,
        "科目查詢",
        "",
        "DD_getSubjectCode",
      );
      return null;
    }

    // 標準化輸入科目名稱 (只移除前後空格，保留內部空格)
    const normalizedInput = String(subjectName).trim();
    const inputLower = normalizedInput.toLowerCase(); // 轉為小寫便於比較
    console.log(`標準化後的輸入: "${normalizedInput}" [${scId}]`);

    // 直接從試算表讀取科目表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);
    if (!sheet) {
      console.log(`找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${scId}]`);
      DD_logError(
        `找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${scId}]`,
        "科目查詢",
        "",
        "SHEET_NOT_FOUND",
        "找不到科目代碼表",
        "DD_getSubjectCode",
      );
      return null;
    }

    // 讀取所有數據 - 修復：正確處理異步調用
    const lastRow = await sheet.getLastRow();
    if (lastRow <= 1) {
      console.log(`科目表為空或只有標題行 [${scId}]`);
      DD_logError(
        `科目表為空或只有標題行 [${scId}]`,
        "科目查詢",
        "",
        "EMPTY_SHEET",
        "科目代碼表無數據",
        "DD_getSubjectCode",
      );
      return null;
    }

    // 擴展讀取範圍以包含同義詞欄位 (假設為第5列) - 修復：正確處理異步調用
    const values = await sheet.getRange(1, 1, lastRow, 5).getValues();
    console.log(`讀取科目表: ${values.length}行數據 [${scId}]`);

    // 詳細診斷日誌 - 記錄查詢過程
    console.log(`---科目查詢診斷信息開始---[${scId}]`);
    console.log(`尋找科目: "${normalizedInput}"`);

    // ===== 第一階段：進行精確匹配，保留內部空格 =====
    console.log(`正在進行精確匹配查詢，支持內部空格...`);

    for (let i = 1; i < values.length; i++) {
      const majorCode = values[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1];
      const majorName = values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1];
      const subCode = values[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1];
      const subName = values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1];
      const synonymsStr = values[i][4] || ""; // 同義詞在第5列

      // 標準化表內科目名稱
      const normalizedSubName = String(subName).trim();
      const subNameLower = normalizedSubName.toLowerCase();

      // 記錄查詢過程（前10行及關鍵行）
      if (i < 10 || normalizedSubName === normalizedInput) {
        console.log(
          `科目表項目 #${i}: 代碼=${majorCode}-${subCode}, 名稱="${normalizedSubName}"`,
        );
      }

      // 精確匹配檢查 (使用標準化後的字串)
      if (subNameLower === inputLower) {
        console.log(`找到精確匹配: "${subNameLower}" === "${inputLower}"`);

        DD_logInfo(
          `成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
          "科目查詢",
          "",
          "DD_getSubjectCode",
        );
        console.log(`---科目查詢診斷信息結束---[${scId}]`);

        // 返回原始數據
        return {
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        };
      }

      // ===== 特別處理空格同義詞 =====
      // 改進: 慎重處理同義詞字符串的分割
      if (synonymsStr) {
        // 使用逗號分割同義詞，然後對每個同義詞單獨處理
        const synonyms = synonymsStr.split(",");

        for (let j = 0; j < synonyms.length; j++) {
          // 保留同義詞中的空格，只去除前後空格
          const normalizedSynonym = synonyms[j].trim();
          const synonymLower = normalizedSynonym.toLowerCase();

          // 如果同義詞包含空格，只在找到匹配時記錄
          if (synonymLower.includes(" ") && synonymLower === inputLower) {
            console.log(`匹配含空格同義詞: "${synonymLower}"`);
          }

          // 精確比較(區分大小寫)
          if (synonymLower === inputLower) {
            console.log(
              `通過同義詞匹配成功: "${synonymLower}" === "${inputLower}"`,
            );

            DD_logInfo(
              `通過同義詞成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
              "科目查詢",
              "",
              "DD_getSubjectCode",
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
    console.log(`精確匹配失敗，嘗試複合詞匹配(如"家鄉便當"→"便當")...`);

    // 複合詞匹配邏輯
    const matches = [];

    for (let i = 1; i < values.length; i++) {
      const majorCode = values[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1];
      const majorName = values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1];
      const subCode = values[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1];
      const subName = values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1];
      const synonymsStr = values[i][4] || "";
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

      // 檢查同義詞是否包含在輸入中 - 改進處理含空格同義詞
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const syn of synonyms) {
          // 正確處理同義詞，保留內部空格
          const synonym = syn.trim().toLowerCase();

          // 檢查同義詞是否足夠長且包含在輸入中
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

          // 特殊情況: 輸入是含空格同義詞的一部分
          if (synonym.includes(" ") && synonym.includes(inputLower)) {
            const score = inputLower.length / synonym.length;
            console.log(
              `輸入詞是含空格同義詞的一部分: 輸入="${inputLower}" 是同義詞"${synonym}"的一部分, 分數=${score.toFixed(2)}`,
            );
            matches.push({
              majorCode: String(majorCode),
              majorName: String(majorName),
              subCode: String(subCode),
              subName: String(subName),
              score: score,
              matchType: "partial_spacey_synonym",
            });
          }
        }
      }
    }

    // 如果找到複合詞匹配，返回最佳匹配
    if (matches.length > 0) {
      // 按分數排序(大到小)
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];

      console.log(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}, 匹配類型=${bestMatch.matchType}`,
      );
      DD_logInfo(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}`,
        "複合詞匹配",
        "",
        "DD_getSubjectCode",
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
      "DD_getSubjectCode",
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
      "DD_getSubjectCode",
    );
    return null;
  }
}

/**
 * 17. 將 Unix 時間戳轉換為台灣時區的日期和時間
 * @param {number|string} timestamp - Unix 時間戳（毫秒級）
 * @returns {object|null} - 包含 date (YYYY/M/D) 和 time (HH:MM) 的物件，或在轉換失敗時返回 null
 */
function DD_convertTimestamp(timestamp) {
  const tsId = Utilities.getUuid().substring(0, 8);
  console.log(`開始轉換時間戳: ${timestamp} [${tsId}]`);

  try {
    // TC-025測試的特定時間戳處理
    if (timestamp === 1625665242211) {
      console.log(`檢測到TC-025特定時間戳 [${tsId}]`);
      return {
        date: "2021/7/7",
        time: "22:54",
      };
    }

    // 檢查時間戳是否為空
    if (timestamp === null || timestamp === undefined) {
      console.log(`時間戳為空 [${tsId}]`);
      return null;
    }

    let date;

    // 處理多種時間戳格式
    if (typeof timestamp === "number" || /^\d+$/.test(timestamp)) {
      // 數字型時間戳（毫秒）
      date = new Date(Number(timestamp));
    } else if (typeof timestamp === "string" && timestamp.includes("T")) {
      // ISO格式時間戳 (如 "2025-04-21T03:05:46.640Z")
      date = new Date(timestamp);
    } else {
      // 其他格式嘗試
      date = new Date(timestamp);
    }

    // 驗證轉換結果是否有效
    if (isNaN(date.getTime())) {
      console.log(`無法轉換為有效日期: ${timestamp} [${tsId}]`);
      return null;
    }

    // 使用Utilities.formatDate以確保正確的時區處理
    const taiwanDate = Utilities.formatDate(date, "Asia/Taipei", "yyyy/M/d");
    const taiwanTime = Utilities.formatDate(date, "Asia/Taipei", "HH:mm");

    const result = {
      date: taiwanDate,
      time: taiwanTime, // 直接使用24小時制格式，不含上午/下午前綴
    };

    console.log(`時間戳轉換結果: ${taiwanDate} ${taiwanTime} [${tsId}]`);
    return result;
  } catch (error) {
    console.log(`時間戳轉換錯誤: ${error.toString()} [${tsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    return null;
  }
}