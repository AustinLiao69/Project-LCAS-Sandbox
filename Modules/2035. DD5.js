
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
    const allSubjects = await DD_getAllSubjectsCrossLedger(userId);

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
  DD_getAllSubjectsCrossLedger,
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