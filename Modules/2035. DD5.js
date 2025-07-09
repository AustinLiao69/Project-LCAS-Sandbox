/**
 * 53. 智能備註生成 - 根據記帳數據生成有意義的備註
 * @version 2025-05-21-V1.1.0
 * @author AustinLiao69
 * @date 2025-05-21 16:12:30
 * @update: 改進智能備註生成，確保備註只包含相關信息
 * @param {Object} bookkeepingData - 記帳數據對象
 * @return {string} 生成的備註
 */
function DD_generateIntelligentRemark(bookkeepingData) {
  try {
    // 1. 使用科目名稱作為備註基礎
    let remark = bookkeepingData.subjectName || "";

    // 2. 如果有原始文本並且不等於科目名稱，嘗試格式化
    if (
      bookkeepingData.text &&
      bookkeepingData.text !== bookkeepingData.subjectName
    ) {
      // 構建格式化所需信息
      const parseResult = {
        subject: bookkeepingData.subjectName,
        amount: bookkeepingData.amount,
        paymentMethod: bookkeepingData.paymentMethod,
      };

      // 嘗試格式化
      const formattedRemark = DD_formatBookkeepingRemark(
        parseResult,
        bookkeepingData.text,
      );

      // 檢查格式化結果是否比科目名稱更有信息量
      if (
        formattedRemark &&
        formattedRemark !== bookkeepingData.subjectName &&
        formattedRemark.length > 1
      ) {
        return formattedRemark;
      }
    }

    // 3. 如果有原始科目且與系統科目不同，使用原始科目
    if (
      bookkeepingData.originalSubject &&
      bookkeepingData.subjectName &&
      bookkeepingData.originalSubject !== bookkeepingData.subjectName
    ) {
      return bookkeepingData.originalSubject;
    }

    // 4. 返回科目名稱作為備註
    return remark;
  } catch (error) {
    console.error("生成智能備註錯誤: " + error);
    // 失敗時返回科目名稱
    return bookkeepingData.subjectName || "";
  }
}

/**
 * 54. 處理解析結果的函數
 * 處理DD_parseInputFormat的返回結果，整合金額格式化功能
 * @version 2025-05-23-V1.0.3
 * @author AustinLiao69
 * @lastUpdate: 2025-05-23 03:05:21
 * @update: 增強大數字處理，確保原始金額格式傳遞
 * @param {Object} parseResult - 解析結果
 * @param {Object} options - 選項
 * @returns {Object} 處理後的結果
 */
function DD_processParseResult(parseResult, options = {}) {
  // 1. 處理ID
  const processId = options.processId || Utilities.getUuid().substring(0, 8);
  console.log(`[${processId}] DD_processParseResult: 開始處理解析結果`);

  // 2. 參數檢查
  if (!parseResult) {
    console.log(`[${processId}] DD_processParseResult: 解析結果為空`);
    return null;
  }

  // 3. 提取基本信息
  const subject = parseResult.subject;
  const amount = parseResult.amount;
  const rawAmount = parseResult.rawAmount || amount.toLocaleString("zh-TW"); // 確保有原始金額格式
  const paymentMethod = parseResult.paymentMethod || "刷卡";

  console.log(
    `[${processId}] DD_processParseResult: 處理基本信息 - 科目: ${subject}, 金額: ${amount}, 原始金額: ${rawAmount}, 支付方式: ${paymentMethod}`,
  );

  // 4. 獲取支出/收入類型
  let action = parseResult.action;
  if (!action) {
    // 如果沒有明確指定，根據上下文或配置判斷
    if (options.defaultAction) {
      action = options.defaultAction;
    } else {
      // 如果是以支出/買/購買開頭，是支出
      if (/^(支出|買|購買)/.test(parseResult.text)) {
        action = "支出";
      }
      // 如果是以收入開頭，是收入
      else if (/^收入/.test(parseResult.text)) {
        action = "收入";
      }
      // 默認支出
      else {
        action = "支出";
      }
    }
  }

  console.log(`[${processId}] DD_processParseResult: 確定交易類型: ${action}`);

  // 5. 特殊格式處理: 如果是FORMAT8（純數字），需要上下文信息
  if (parseResult.formatId === "FORMAT8" && options.contextSubject) {
    console.log(
      `[${processId}] DD_processParseResult: 處理純數字格式，使用上下文科目: ${options.contextSubject}`,
    );
    return {
      subject: options.contextSubject,
      amount: amount,
      rawAmount: rawAmount, // 保存原始金額格式
      action: action,
      paymentMethod: paymentMethod,
      text: parseResult.text || "",
      formatId: parseResult.formatId,
    };
  }

  // 6. 返回處理結果
  console.log(
    `[${processId}] DD_processParseResult: 返回處理結果 - 科目: ${subject}, 金額: ${amount}, 原始金額: ${rawAmount}, 動作: ${action}`,
  );

  return {
    subject: subject,
    amount: amount,
    rawAmount: rawAmount, // 保存原始金額格式
    action: action,
    paymentMethod: paymentMethod,
    text: parseResult.text || "",
    formatId: parseResult.formatId,
  };
}

/**
 * 55. 獲取所有科目列表（包括同義詞）- 修復異步調用問題
 * @return {Array} 科目列表
 */
async function DD_getAllSubjects() {
  try {
    console.log("【模糊匹配】開始獲取科目列表");

    // 獲取科目資料表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName("997. 科目代碼_測試");
    if (!sheet) {
      console.log("【模糊匹配】無法找到科目表");
      return [];
    }

    // 修復：正確等待異步操作完成
    const lastRow = await sheet.getLastRow();
    console.log(`【模糊匹配】科目表行數: ${lastRow}`);

    if (lastRow <= 1) {
      console.log("【模糊匹配】科目表為空或只有標題行");
      return [];
    }

    const values = await sheet.getRange(1, 1, lastRow, 5).getValues();
    console.log(`【模糊匹配】成功讀取 ${values.length} 行數據`);

    // 跳過標題行
    const subjects = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i][0]) {
        // 確保行不為空
        subjects.push({
          majorCode: values[i][0].toString(),
          majorName: values[i][1] || "",
          subCode: values[i][2].toString(),
          subName: values[i][3] || "",
          synonyms: values[i][4] || "",
        });
      }
    }

    console.log(`【模糊匹配】處理完成，共 ${subjects.length} 個科目`);
    return subjects;
  } catch (error) {
    console.log(`【模糊匹配】獲取科目列表失敗: ${error}`);
    return [];
  }
}

/**
 * 58. 格式化系統回覆訊息
 * @version 2025-06-16-V3.7.0
 * @author AustinLiao69
 * @date 2025-06-16 02:13:23
 * @update: 修復負數金額和支付方式處理問題，確保多層調用數據一致性
 * @param {Object} resultData - 處理結果數據
 * @param {string} moduleCode - 模組代碼
 * @param {Object} options - 附加選項
 * @returns {Object} 格式化後的回覆訊息
 */
function DD_formatSystemReplyMessage(resultData, moduleCode, options = {}) {
  // 1. 初始化處理 - 核心變數移到頂層，確保在所有程式路徑中都可用
  const userId = options.userId || "";
  const processId = options.processId || Utilities.getUuid().substring(0, 8);
  let errorMsg = "未知錯誤"; // 關鍵：移到頂層定義
  const currentDateTime = Utilities.formatDate(
    new Date(),
    DD_CONFIG.TIMEZONE || "Asia/Taipei",
    "yyyy/MM/dd HH:mm",
  ); // 關鍵：移到頂層定義

  console.log(
    `DD_formatSystemReplyMessage: 開始格式化訊息 [${processId}], 模組: ${moduleCode}`,
  );
  console.log(
    `DD_formatSystemReplyMessage: 輸入數據: ${JSON.stringify(resultData).substring(0, 300)}...`,
  );

  try {
    // 2. 檢查resultData是否已經包含完整的responseMessage，如有則優先使用
    if (resultData && resultData.responseMessage) {
      console.log(
        `DD_formatSystemReplyMessage: 檢測到完整responseMessage，將直接使用 [${processId}]`,
      );

      // 深度複製，確保不影響原始對象
      const returnObject = {
        success: resultData.success === true ? true : false,
        responseMessage: resultData.responseMessage,
        originalResult: resultData.originalResult || resultData,
        processId: processId,
        errorType: resultData.errorType || null,
        moduleCode: moduleCode,
        partialData: resultData.partialData || {},
        error:
          resultData.error ||
          (resultData.success === true ? undefined : errorMsg),
      };

      console.log(
        `DD_formatSystemReplyMessage: 直接返回現有訊息，長度=${returnObject.responseMessage.length} [${processId}]`,
      );
      return returnObject;
    }

    // 3. 確保resultData存在
    if (!resultData) {
      console.log(
        `DD_formatSystemReplyMessage: resultData為空，使用默認值 [${processId}]`,
      );
      resultData = {
        success: false,
        error: "無處理結果資料",
        errorType: "MISSING_RESULT_DATA",
        message: "無處理結果資料",
        errorDetails: {
          processId: processId,
          errorType: "SYSTEM_ERROR",
          module: moduleCode || "BK",
        },
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "支付方式未指定",
          timestamp: new Date().getTime(),
        },
      };
    }

    // 4. 處理結果數據
    let responseMessage = "";
    const isSuccess = resultData.success === true;

    // 5. 從resultData中提取資料 - 支持更多嵌套結構 (最關鍵修改點)
    let partialData = null;

    // 5.1 查找partialData的各種可能位置（按優先順序）
    const dataSources = [
      resultData.parsedData, // DD_parseInputFormat 直接返回
      resultData.partialData, // 一般partialData
      resultData.errorData?.partialData, // 錯誤數據中的部分數據
      resultData.originalResult?.partialData, // 嵌套結果中的部分數據
      resultData._partialData, // 舊版格式
      resultData.data, // 成功結果中的完整數據
    ];

    // 查找第一個非空的數據源
    for (let source of dataSources) {
      if (
        source &&
        typeof source === "object" &&
        Object.keys(source).length > 0
      ) {
        partialData = source;
        console.log(
          `DD_formatSystemReplyMessage: 找到數據源: ${JSON.stringify(partialData).substring(0, 100)}... [${processId}]`,
        );
        break;
      }
    }

    // 如果都未找到，嘗試從responseMessage解析
    if (!partialData && resultData.responseMessage) {
      try {
        console.log(
          `DD_formatSystemReplyMessage: 嘗試從responseMessage解析數據 [${processId}]`,
        );
        const msgLines = resultData.responseMessage.split("\n");
        partialData = {};

        for (const line of msgLines) {
          if (line.startsWith("金額：")) {
            const amountMatch = line.match(/金額：([-\d,]+)元/);
            if (amountMatch && amountMatch[1]) {
              // 保留原始金額值，包括負數
              partialData.rawAmount = amountMatch[1].replace(/,/g, "");
              partialData.amount = parseFloat(partialData.rawAmount);
              console.log(`從訊息解析金額: ${partialData.rawAmount}`);
            }
          } else if (line.startsWith("科目：")) {
            partialData.subject = line.replace("科目：", "").trim();
            console.log(`從訊息解析科目: ${partialData.subject}`);
          } else if (line.startsWith("備註：")) {
            partialData.remark = line.replace("備註：", "").trim();
            console.log(`從訊息解析備註: ${partialData.remark}`);
          } else if (
            line.startsWith("支付方式：") ||
            line.startsWith("付款方式：")
          ) {
            partialData.paymentMethod = line
              .replace(/[支付|付款]方式：/, "")
              .trim();
            console.log(`從訊息解析支付方式: ${partialData.paymentMethod}`);
          }
        }
      } catch (e) {
        console.log(
          `DD_formatSystemReplyMessage: 嘗試解析responseMessage失敗: ${e.toString()} [${processId}]`,
        );
      }
    }

    // 如果仍未找到partialData，創建一個空對象
    if (!partialData) {
      partialData = {};
    }

    // 6. 依照成功或失敗格式化訊息
    if (isSuccess) {
      // 6.1 成功訊息模板
      if (resultData.responseMessage) {
        // 6.1.1 如果已經有格式化的回覆訊息，直接使用
        responseMessage = resultData.responseMessage;
        console.log(
          `DD_formatSystemReplyMessage: 使用現有回覆訊息 [${processId}]`,
        );
      } else if (resultData.data) {
        // 6.1.2 如果有詳細的回覆數據，根據數據構建訊息
        console.log(
          `DD_formatSystemReplyMessage: 基於回覆數據構建成功訊息 [${processId}]`,
        );

        // 從resultData.data提取數據
        const data = resultData.data;
        const subjectName = data.subjectName || partialData.subject || "";
        // 優先使用rawAmount保留格式
        const amount =
          data.rawAmount || partialData.rawAmount || data.amount || 0;
        const action = data.action || resultData.action || "支出";
        const paymentMethod =
          data.paymentMethod || partialData.paymentMethod || "";
        const date = data.date || currentDateTime;
        const remark = data.remark || partialData.remark || "無";
        const userType = data.userType || "J";

        // 構建���準成功模板
        responseMessage =
          `記帳成功！\n` +
          `金額：${amount}元 (${action})\n` +
          `付款方式：${paymentMethod}\n` +
          `時間：${date}\n` +
          `科目：${subjectName}\n` +
          `備註：${remark}\n` +
          `使用者類型：${userType}`;
      } else {
        // 6.1.3 如果沒有詳細數據，構建簡易成功訊息
        console.log(
          `DD_formatSystemReplyMessage: 構建簡易成功訊息 [${processId}]`,
        );
        responseMessage = `操作成功！\n處理ID: ${processId}`;
      }

      // 6.1.4 記錄成功訊息
      console.log(
        `DD_formatSystemReplyMessage: 格式化成功訊息完成 [${processId}]`,
      );
    } else {
      // 6.2 失敗訊息模板
      console.log(
        `DD_formatSystemReplyMessage: 構建錯誤訊息，錯誤類型: ${resultData.errorType || "未指定"} [${processId}]`,
      );

      // 6.2.1 收集錯誤訊息 - 增強版本，優先級更清晰
      errorMsg = "未知錯誤"; // 重新初始化，確保有預設值

      // 提取各種可能的錯誤訊息來源 (優先順序)
      const possibleErrorSources = [
        resultData.error,
        resultData.message,
        resultData.errorData?.error,
        resultData.originalResult?.error,
        resultData.originalResult?.message,
        resultData._errorDetail,
      ];

      // 尋找第一個非空的錯誤訊息
      for (const source of possibleErrorSources) {
        if (source) {
          errorMsg = source;
          console.log(
            `DD_formatSystemReplyMessage: 找到錯誤訊息: ${errorMsg} [${processId}]`,
          );
          break;
        }
      }

      // 如果仍未找到錯誤訊息，嘗試從responseMessage提取
      if (
        errorMsg === "未知錯誤" &&
        resultData.responseMessage &&
        resultData.responseMessage.includes("錯誤原因：")
      ) {
        try {
          errorMsg = resultData.responseMessage.split("錯誤原因：")[1].trim();
          console.log(
            `DD_formatSystemReplyMessage: 從responseMessage提取錯誤信息: ${errorMsg} [${processId}]`,
          );
        } catch (e) {
          errorMsg = "無法提取錯誤原因";
        }
      }

      // 6.2.2 準備顯示數據 - 關鍵修改：保留負數金額和原始科目
      // 取得科目名稱 - 維持優先順序
      const subject =
        partialData.subject ||
        resultData.errorData?.parsedData?.subject ||
        resultData.originalSubject ||
        resultData.text?.split("-")?.[0]?.trim() ||
        "未知科目";

      // 保留原始金額，包括負數 (關鍵修改：確保從partialData提取值)
      const displayAmount =
        partialData.rawAmount ||
        (partialData.amount !== undefined ? String(partialData.amount) : "0");

      // 確保支付方式被保留
      const paymentMethod =
        partialData.paymentMethod ||
        resultData.paymentMethod ||
        resultData.errorData?.parsedData?.paymentMethod ||
        "未指定支付方式";

      // 從原始輸入擷取備註
      const remark =
        partialData.remark || resultData.text?.split("-")?.[0]?.trim() || "無";

      // 6.2.3 構建標準錯誤訊息模板
      responseMessage =
        `記帳失敗！\n` +
        `金額：${displayAmount}元\n` +
        `支付方式：${paymentMethod}\n` +
        `時間：${currentDateTime}\n` +
        `科目：${subject}\n` +
        `備註：${remark}\n` +
        `使用者類型：J\n` +
        `錯誤原因：${errorMsg}`;

      console.log(
        `DD_formatSystemReplyMessage: 已構建錯誤訊息: ${responseMessage.substring(0, 50)}... [${processId}]`,
      );
    }

    // 7. 最終日誌記錄
    console.log(`DD_formatSystemReplyMessage: 完成訊息格式化 [${processId}]`);

    // 8. 返回完整結果，確保保留所有原始數據
    return {
      success: isSuccess,
      responseMessage: responseMessage,
      originalResult: resultData,
      processId: processId,
      errorType: resultData.errorType || null,
      moduleCode: moduleCode,
      // 關鍵：確保保留原始的partialData
      partialData: partialData,
      // 保留原始錯誤信息，確保多級調用不丟失
      error: isSuccess ? undefined : errorMsg,
    };
  } catch (error) {
    // 9. 處理格式化過程中的錯誤
    console.error(
      `DD_formatSystemReplyMessage: 格式化過程出錯: ${error.toString()} [${processId}]`,
    );
    if (error.stack) console.error(`錯誤堆疊: ${error.stack}`);

    // 9.1 預設的錯誤回覆訊息
    const fallbackMessage = `記帳失敗！\n時間：${currentDateTime}\n科目：未知科目\n金額：0元\n支付方式：未指定支付方式\n備註：無\n使用者類型：J\n錯誤原因：訊息格式化錯誤`;

    // 9.2 返回基本錯誤訊息
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
 * 59. 根據科目代碼獲取科目信息
 * @version 2025-06-06-V1.0.0
 * @author AustinLiao691
 * @date 2025-06-06 02:40:22
 * @param {string} subjectCode - 科目代碼，格式為"majorCode-subCode"或純subCode
 * @returns {object|null} 科目信息對象或null
 */
function DD_getSubjectByCode(subjectCode) {
  const sbcId = Utilities.getUuid().substring(0, 8);
  console.log(`根據代碼查詢科目: "${subjectCode}" [${sbcId}]`);

  try {
    // 校驗參數
    if (!subjectCode) {
      console.log(`科目代碼為空 [${sbcId}]`);
      return null;
    }

    let majorCode, subCode;

    // 處理代碼格式（支持兩種格式：majorCode-subCode 和純 subCode）
    if (subjectCode.includes("-")) {
      const parts = subjectCode.split("-");
      majorCode = parts[0];
      subCode = parts[1];
    } else {
      // 假設純子科目代碼，需要查找對應的主科目
      subCode = subjectCode;
    }

    // 獲取科目表
    const ss = SpreadsheetApp.openById(DD_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DD_SUBJECT_CODE_SHEET_NAME);

    if (!sheet) {
      console.log(`找不到科目表: ${DD_SUBJECT_CODE_SHEET_NAME} [${sbcId}]`);
      return null;
    }

    // 讀取科目數據
    const values = sheet.getDataRange().getValues();

    // 查詢匹配科目
    for (let i = 1; i < values.length; i++) {
      const currentMajorCode = String(
        values[i][DD_SUBJECT_CODE_MAJOR_CODE_COLUMN - 1],
      );
      const currentSubCode = String(
        values[i][DD_SUBJECT_CODE_SUB_CODE_COLUMN - 1],
      );

      // 如果只有subCode，找到第一個匹配的子科目
      if (!majorCode && currentSubCode === subCode) {
        console.log(
          `找到科目: ${currentMajorCode}-${currentSubCode} [${sbcId}]`,
        );
        return {
          majorCode: currentMajorCode,
          majorName: String(values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1]),
          subCode: currentSubCode,
          subName: String(values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1]),
        };
      }

      // 如果有完整代碼，精確匹配
      if (
        majorCode &&
        currentMajorCode === majorCode &&
        currentSubCode === subCode
      ) {
        console.log(`精確匹配科目: ${majorCode}-${subCode} [${sbcId}]`);
        return {
          majorCode: currentMajorCode,
          majorName: String(values[i][DD_SUBJECT_CODE_MAJOR_NAME_COLUMN - 1]),
          subCode: currentSubCode,
          subName: String(values[i][DD_SUBJECT_CODE_SUB_NAME_COLUMN - 1]),
        };
      }
    }

    console.log(`找不到科目代碼: "${subjectCode}" [${sbcId}]`);
    return null;
  } catch (error) {
    console.log(`科目代碼查詢出錯: ${error} [${sbcId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `科目代碼查詢出錯: ${error}`,
      "科目查詢",
      "",
      "CODE_QUERY_ERROR",
      error.toString(),
      "DD_getSubjectByCode",
    );
    return null;
  }
}

/**
 * 60. 主動向 LINE 用戶推送訊息
 * @version 2.0.7 (2025-06-25)
 * @author AustinLiao69
 * @update: 從WH模組移植至DD模組，並重新命名
 * @param {string} userId - LINE 用戶 ID
 * @param {string|Object} message - 要發送的訊息內容
 * @returns {Promise<Object>} 發送結果
 */
function DD_pushMessage(userId, message) {
  return new Promise((resolve, reject) => {
    try {
      // 檢查用戶ID是否有效
      if (!userId || userId.trim() === "") {
        console.log("DD_pushMessage: 無效的用戶ID");
        return resolve({ success: false, error: "無效的用戶ID" });
      }

      // 處理訊息內容
      let textMessage = "";

      if (typeof message === "object" && message !== null) {
        if (
          message.responseMessage &&
          typeof message.responseMessage === "string"
        ) {
          textMessage = message.responseMessage;
        } else if (message.message && typeof message.message === "string") {
          textMessage = message.message;
        } else {
          try {
            textMessage = JSON.stringify(message);
          } catch (jsonError) {
            textMessage = "系統訊息";
            console.log(`DD_pushMessage: 轉換訊息失敗: ${jsonError}`);
          }
        }
      } else if (typeof message === "string") {
        textMessage = message;
      } else {
        textMessage = "系統訊息";
      }

      // 確保訊息長度不超過限制
      const maxLength = 5000;
      if (textMessage.length > maxLength) {
        textMessage = textMessage.substring(0, maxLength - 3) + "...";
      }

      // LINE Messaging API URL
      const url = "https://api.line.me/v2/bot/message/push";

      // 獲取 Channel Access Token
      const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!channelAccessToken) {
        console.log("DD_pushMessage: 缺少 Channel Access Token");
        return resolve({ success: false, error: "缺少 Channel Access Token" });
      }

      // 設置請求
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      };

      const payload = {
        to: userId,
        messages: [
          {
            type: "text",
            text: textMessage,
          },
        ],
      };

      // 發送 HTTP 請求
      console.log(`DD_pushMessage: 開始向用戶 ${userId} 推送訊息`);

      // 記錄推送嘗試
      DD_logInfo(
        `開始向用戶推送訊息`,
        "訊息推送",
        userId,
        "DD_pushMessage",
        "DD_pushMessage",
      );

      // 使用 axios 發送請求
      axios
        .post(url, payload, { headers: headers })
        .then((response) => {
          if (response.status === 200) {
            console.log(`DD_pushMessage: 成功推送訊息給用戶 ${userId}`);

            // 記錄推送成功
            DD_logInfo(
              `成功推送訊息給用戶`,
              "訊息推送",
              userId,
              "DD_pushMessage",
              "DD_pushMessage",
            );

            resolve({ success: true });
          } else {
            console.log(`DD_pushMessage: API回應異常 ${response.status}`);

            // 記錄推送失敗
            DD_logError(
              `API回應異常 ${response.status}`,
              "訊息推送",
              userId,
              "API_ERROR",
              JSON.stringify(response.data),
              "DD_pushMessage",
              "DD_pushMessage",
            );

            resolve({
              success: false,
              error: `API回應異常 (${response.status})`,
              details: response.data,
            });
          }
        })
        .catch((error) => {
          console.log(`DD_pushMessage: 推送訊息錯誤 ${error}`);

          // 記錄推送錯誤
          DD_logError(
            `推送訊息錯誤`,
            "訊息推送",
            userId,
            "PUSH_ERROR",
            error.toString(),
            "DD_pushMessage",
            "DD_pushMessage",
          );

          resolve({
            success: false,
            error: error.toString(),
          });
        });
    } catch (error) {
      console.log(`DD_pushMessage: 主錯誤 ${error}`);

      // 記錄函數級錯誤
      DD_logError(
        `推送訊息主錯誤`,
        "訊息推送",
        userId,
        "FUNCTION_ERROR",
        error.toString(),
        "DD_pushMessage",
        "DD_pushMessage",
      );

      resolve({
        success: false,
        error: error.toString(),
      });
    }
  });
}

/**
 * 61. 批次向多個 LINE 用戶推送相同訊息
 * @version 2.0.7 (2025-06-25)
 * @author AustinLiao69
 * @update: 從WH模組移植至DD模組，並重新命名
 * @param {Array<string>} userIds - LINE 用戶 ID 陣列
 * @param {string|Object} message - 要發送的訊息內容
 * @returns {Promise<Object>} 發送結果
 */
function DD_multicastMessage(userIds, message) {
  return new Promise((resolve, reject) => {
    try {
      // 檢查用戶ID陣列是否有效
      if (!Array.isArray(userIds) || userIds.length === 0) {
        console.log("DD_multicastMessage: 無效的用戶ID陣列");
        return resolve({ success: false, error: "無效的用戶ID陣列" });
      }

      // 處理訊息內容
      let textMessage = "";

      if (typeof message === "object" && message !== null) {
        if (
          message.responseMessage &&
          typeof message.responseMessage === "string"
        ) {
          textMessage = message.responseMessage;
        } else if (message.message && typeof message.message === "string") {
          textMessage = message.message;
        } else {
          try {
            textMessage = JSON.stringify(message);
          } catch (jsonError) {
            textMessage = "系統訊息";
            console.log(`DD_multicastMessage: 轉換訊息失敗: ${jsonError}`);
          }
        }
      } else if (typeof message === "string") {
        textMessage = message;
      } else {
        textMessage = "系統訊息";
      }

      // 確保訊息長度不超過限制
      const maxLength = 5000;
      if (textMessage.length > maxLength) {
        textMessage = textMessage.substring(0, maxLength - 3) + "...";
      }

      // LINE Messaging API URL
      const url = "https://api.line.me/v2/bot/message/multicast";

      // 獲取 Channel Access Token
      const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!channelAccessToken) {
        console.log("DD_multicastMessage: 缺少 Channel Access Token");
        return resolve({ success: false, error: "缺少 Channel Access Token" });
      }

      // 設置請求
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      };

      const payload = {
        to: userIds,
        messages: [
          {
            type: "text",
            text: textMessage,
          },
        ],
      };

      // 發送 HTTP 請求
      console.log(
        `DD_multicastMessage: 開始向 ${userIds.length} 個用戶推送訊息`,
      );

      // 記錄推送嘗試
      DD_logInfo(
        `開始向 ${userIds.length} 個用戶推送訊息`,
        "批次訊息推送",
        userIds.join(",").substring(0, 50) + "...",
        "DD_multicastMessage",
        "DD_multicastMessage",
      );

      // 使用 axios 發送請求
      axios
        .post(url, payload, { headers: headers })
        .then((response) => {
          if (response.status === 200) {
            console.log(
              `DD_multicastMessage: 成功推送訊息給 ${userIds.length} 個用戶`,
            );

            // 記錄推送成功
            DD_logInfo(
              `成功推送訊息給 ${userIds.length} 個用戶`,
              "批次訊息推送",
              userIds.join(",").substring(0, 50) + "...",
              "DD_multicastMessage",
              "DD_multicastMessage",
            );

            resolve({ success: true });
          } else {
            console.log(`DD_multicastMessage: API回應異常 ${response.status}`);

            // 記錄推送失敗
            DD_logError(
              `API回應異常 ${response.status}`,
              "批次訊息推送",
              userIds.join(",").substring(0, 50) + "...",
              "API_ERROR",
              JSON.stringify(response.data),
              "DD_multicastMessage",
              "DD_multicastMessage",
            );

            resolve({
              success: false,
              error: `API回應異常 (${response.status})`,
              details: response.data,
            });
          }
        })
        .catch((error) => {
          console.log(`DD_multicastMessage: 推送訊息錯誤 ${error}`);

          // 記錄推送錯誤
          DD_logError(
            `推送訊息錯誤`,
            "批次訊息推送",
            userIds.join(",").substring(0, 50) + "...",
            "MULTICAST_ERROR",
            error.toString(),
            "DD_multicastMessage",
            "DD_multicastMessage",
          );

          resolve({
            success: false,
            error: error.toString(),
          });
        });
    } catch (error) {
      console.log(`DD_multicastMessage: 主錯誤 ${error}`);

      // 記錄函數級錯誤
      DD_logError(
        `批次推送訊息主錯誤`,
        "批次訊息推送",
        userIds ? userIds.join(",").substring(0, 50) + "..." : "",
        "FUNCTION_ERROR",
        error.toString(),
        "DD_multicastMessage",
        "DD_multicastMessage",
      );

      resolve({
        success: false,
        error: error.toString(),
      });
    }
  });
}

// 更新模組導出，包含新添加的函數
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
  // 新添加的函數
  DD_pushMessage,
  DD_multicastMessage,
};