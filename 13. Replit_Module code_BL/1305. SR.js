/**
 * SR_排程提醒模組_1.7.0
 * @module SR排程提醒模組
 * @description LCAS 2.0 排程提醒系統 - 智慧記帳自動化核心功能
 * @update 2025-12-26: 升級至v1.7.0，配合LBK模組階段四更新，強化統計postback事件處理能力
 */

const admin = require('firebase-admin');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

// 引入依賴模組
let DL, WH, AM, DD1, BK, LBK;
try {
  DL = require('./1310. DL.js');
  WH = require('./1320. WH.js');
  AM = require('./1309. AM.js');
  DD1 = require('./1331. DD1.js');
  BK = require('./1301. BK.js');
  LBK = require('./1315. LBK.js');
} catch (error) {
  console.warn('SR模組依賴載入警告:', error.message);
}

// 取得 Firestore 實例
const db = admin.firestore();

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = 'Asia/Taipei';

// 模組初始化狀態
const SR_INIT_STATUS = {
  initialized: false,
  firestoreConnected: false,
  schedulerRunning: false,
  activeSchedules: new Map(),
  lastInitTime: null
};

// 排程提醒配置
const SR_CONFIG = {
  MAX_FREE_REMINDERS: 2,
  DEFAULT_REMINDER_TIME: '09:00',
  HOLIDAY_API_ENABLED: true,
  TIMEZONE: TIMEZONE,
  REMINDER_TYPES: {
    DAILY: 'daily',
    WEEKLY: 'weekly', 
    MONTHLY: 'monthly',
    CUSTOM: 'custom'
  }
};

// Quick Reply 按鈕配置
const SR_QUICK_REPLY_CONFIG = {
  STATISTICS: {
    TODAY: { label: '本日統計', postbackData: '本日統計' },
    WEEKLY: { label: '本週統計', postbackData: '本週統計' },
    MONTHLY: { label: '本月統計', postbackData: '本月統計' }
  },
  PREMIUM: {
    UPGRADE: { label: '立即升級', postbackData: 'upgrade_premium' },
    TRIAL: { label: '免費試用', postbackData: '試用' },
    INFO: { label: '了解更多', postbackData: '功能介紹' }
  }
};

/**
 * 22. 日誌函數封裝 - 資訊日誌
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 封裝DL模組的資訊日誌記錄功能
 */
function SR_logInfo(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_info === 'function') {
    DL.DL_info(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.log(`[SR-INFO] ${message}`);
  }
}

/**
 * 23. 日誌函數封裝 - 錯誤日誌
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 封裝DL模組的錯誤日誌記錄功能
 */
function SR_logError(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_error === 'function') {
    DL.DL_error(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.error(`[SR-ERROR] ${message}`, errorDetails);
  }
}

/**
 * 24. 日誌函數封裝 - 警告日誌
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 封裝DL模組的警告日誌記錄功能
 */
function SR_logWarning(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_warning === 'function') {
    DL.DL_warning(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.warn(`[SR-WARNING] ${message}`);
  }
}

// =============== 排程管理層函數 (6個) ===============

/**
 * 01. 建立排程提醒設定 - 修復建立流程和數據驗證
 * @version 2025-07-22-V1.5.0
 * @date 2025-07-22 14:30:00
 * @description 為用戶建立新的排程提醒設定，修復權限檢查和數據處理邏輯
 */
async function SR_createScheduledReminder(userId, reminderData) {
  const functionName = "SR_createScheduledReminder";
  try {
    SR_logInfo(`開始建立排程提醒: ${userId}`, "建立提醒", userId, "", "", functionName);

    // 輸入驗證
    if (!userId || typeof userId !== 'string') {
      return {
        success: false,
        error: '無效的用戶ID',
        errorCode: 'INVALID_USER_ID'
      };
    }

    if (!reminderData || typeof reminderData !== 'object') {
      return {
        success: false,
        error: '無效的提醒資料',
        errorCode: 'INVALID_REMINDER_DATA'
      };
    }

    // 檢查付費功能權限
    const permissionCheck = await SR_validatePremiumFeature(userId, 'CREATE_REMINDER');
    if (!permissionCheck || !permissionCheck.allowed) {
      return {
        success: false,
        error: '已達到免費用戶提醒數量限制',
        errorCode: 'PREMIUM_REQUIRED',
        upgradeRequired: true,
        reason: permissionCheck?.reason || '權限不足'
      };
    }

    // 生成提醒ID
    const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 建立提醒記錄
    const reminderRecord = {
      reminderId,
      userId,
      reminderType: reminderData.type || SR_CONFIG.REMINDER_TYPES.DAILY,
      cronExpression: SR_generateCronExpression(reminderData),
      subjectCode: reminderData.subjectCode,
      subjectName: reminderData.subjectName,
      amount: reminderData.amount,
      paymentMethod: reminderData.paymentMethod,
      message: reminderData.message || '',
      skipWeekends: reminderData.skipWeekends || false,
      skipHolidays: reminderData.skipHolidays || false,
      timezone: TIMEZONE,
      active: true,
      createdAt: admin.firestore.Timestamp.now(),
      nextExecution: admin.firestore.Timestamp.fromDate(SR_calculateNextExecution(reminderData))
    };

    // 儲存到 Firestore
    await db.collection('scheduled_reminders').doc(reminderId).set(reminderRecord);

    // 註冊到 node-cron
    const cronJob = cron.schedule(reminderRecord.cronExpression, async () => {
      await SR_executeScheduledTask(reminderId);
    }, {
      scheduled: true,
      timezone: TIMEZONE
    });

    SR_INIT_STATUS.activeSchedules.set(reminderId, cronJob);

    SR_logInfo(`排程提醒建立成功: ${reminderId}`, "建立提醒", userId, "", "", functionName);

    return {
      success: true,
      reminderId,
      nextExecution: reminderRecord.nextExecution.toDate().toISOString(),
      message: '排程提醒設定成功'
    };

  } catch (error) {
    SR_logError(`建立排程提醒失敗: ${error.message}`, "建立提醒", userId, "SR_CREATE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'CREATE_FAILED'
    };
  }
}

/**
 * 02. 修改現有排程設定
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 更新現有的排程提醒設定
 */
async function SR_updateScheduledReminder(reminderId, userId, updateData) {
  const functionName = "SR_updateScheduledReminder";
  try {
    SR_logInfo(`更新排程提醒: ${reminderId}`, "更新提醒", userId, "", "", functionName);

    // 取得現有提醒
    const reminderDoc = await db.collection('scheduled_reminders').doc(reminderId).get();
    if (!reminderDoc.exists) {
      throw new Error('提醒不存在');
    }

    const reminderData = reminderDoc.data();

    // 驗證擁有者
    if (reminderData.userId !== userId) {
      throw new Error('權限不足：只能修改自己的提醒');
    }

    // 準備更新資料
    const updatedData = {
      ...updateData,
      updatedAt: admin.firestore.Timestamp.now()
    };

    // 如果更新了時間相關設定，重新計算cron表達式
    if (updateData.type || updateData.time || updateData.frequency) {
      updatedData.cronExpression = SR_generateCronExpression(updateData);
      updatedData.nextExecution = admin.firestore.Timestamp.fromDate(SR_calculateNextExecution(updateData));
    }

    // 更新 Firestore
    await reminderDoc.ref.update(updatedData);

    // 重新註冊 cron job
    if (updatedData.cronExpression) {
      const oldJob = SR_INIT_STATUS.activeSchedules.get(reminderId);
      if (oldJob) {
        oldJob.stop();
      }

      const newJob = cron.schedule(updatedData.cronExpression, async () => {
        await SR_executeScheduledTask(reminderId);
      }, {
        scheduled: true,
        timezone: TIMEZONE
      });

      SR_INIT_STATUS.activeSchedules.set(reminderId, newJob);
    }

    SR_logInfo(`排程提醒更新成功: ${reminderId}`, "更新提醒", userId, "", "", functionName);

    return {
      success: true,
      updatedFields: Object.keys(updateData),
      message: '排程提醒更新成功'
    };

  } catch (error) {
    SR_logError(`更新排程提醒失敗: ${error.message}`, "更新提醒", userId, "SR_UPDATE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'UPDATE_FAILED'
    };
  }
}

/**
 * 03. 安全刪除排程提醒
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 刪除排程提醒設定
 */
async function SR_deleteScheduledReminder(reminderId, userId, confirmationToken) {
  const functionName = "SR_deleteScheduledReminder";
  try {
    SR_logInfo(`刪除排程提醒: ${reminderId}`, "刪除提醒", userId, "", "", functionName);

    // 驗證確認令牌
    const expectedToken = `confirm_delete_${reminderId}`;
    if (confirmationToken !== expectedToken) {
      throw new Error('確認令牌無效');
    }

    // 取得提醒資料
    const reminderDoc = await db.collection('scheduled_reminders').doc(reminderId).get();
    if (!reminderDoc.exists) {
      throw new Error('提醒不存在');
    }

    const reminderData = reminderDoc.data();

    // 驗證擁有者
    if (reminderData.userId !== userId) {
      throw new Error('權限不足：只能刪除自己的提醒');
    }

    // 停止 cron job
    const cronJob = SR_INIT_STATUS.activeSchedules.get(reminderId);
    if (cronJob) {
      cronJob.stop();
      SR_INIT_STATUS.activeSchedules.delete(reminderId);
    }

    // 軟刪除：標記為已刪除而非實際刪除
    await reminderDoc.ref.update({
      active: false,
      deletedAt: admin.firestore.Timestamp.now(),
      deletedBy: userId
    });

    SR_logWarning(`排程提醒已刪除: ${reminderId}`, "刪除提醒", userId, "", "", functionName);

    return {
      success: true,
      message: '排程提醒刪除成功'
    };

  } catch (error) {
    SR_logError(`刪除排程提醒失敗: ${error.message}`, "刪除提醒", userId, "SR_DELETE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'DELETE_FAILED'
    };
  }
}

/**
 * 04. 執行到期的排程任務 - 修復執行邏輯和異常處理
 * @version 2025-07-22-V1.5.0
 * @date 2025-07-22 14:30:00
 * @update: 修復執行狀態返回值，強化錯誤處理和重試機制
 */
async function SR_executeScheduledTask(reminderId, retryCount = 0) {
  const functionName = "SR_executeScheduledTask";
  const maxRetries = 3;

  try {
    SR_logInfo(`執行排程任務: ${reminderId} (重試次數: ${retryCount})`, "執行任務", "", "", "", functionName);

    // 輸入驗證
    if (!reminderId || typeof reminderId !== 'string') {
      return {
        executed: false,
        error: '無效的提醒ID',
        reason: 'INVALID_REMINDER_ID'
      };
    }

    // 取得提醒資料
    const reminderDoc = await db.collection('scheduled_reminders').doc(reminderId).get();
    if (!reminderDoc.exists) {
      return {
        executed: false,
        error: '提醒不存在',
        reason: 'REMINDER_NOT_FOUND'
      };
    }

    const reminderData = reminderDoc.data();

    // 檢查提醒是否仍處於活躍狀態
    if (!reminderData.active) {
      SR_logWarning(`提醒已被停用: ${reminderId}`, "執行任務", reminderData.userId, "", "", functionName);
      return {
        executed: false,
        reason: '提醒已停用'
      };
    }

    // 檢查是否需要跳過（週末、假日）
    const skipExecution = await SR_shouldSkipExecution(reminderData);
    if (skipExecution.skip) {
      SR_logInfo(`跳過執行: ${skipExecution.reason}`, "執行任務", reminderData.userId, "", "", functionName);

      // 計算下次執行時間（考慮跳過邏輯）
      const nextExecution = await SR_calculateNextExecutionWithSkip(reminderData);
      await reminderDoc.ref.update({
        nextExecution: admin.firestore.Timestamp.fromDate(nextExecution),
        lastSkipped: admin.firestore.Timestamp.now(),
        skipReason: skipExecution.reason
      });

      return {
        executed: false,
        reason: skipExecution.reason,
        nextExecution: nextExecution.toISOString()
      };
    }

    // 檢查付費功能權限（針對進階提醒功能）
    if (reminderData.premiumFeatures && reminderData.premiumFeatures.length > 0) {
      const permissionCheck = await SR_validatePremiumFeature(reminderData.userId, 'PREMIUM_REMINDER');
      if (!permissionCheck.allowed) {
        SR_logWarning(`付費功能權限不足: ${reminderId}`, "執行任務", reminderData.userId, "", "", functionName);
        // 降級為基礎提醒
        reminderData.premiumFeatures = [];
      }
    }

    // 建立提醒訊息
    const reminderMessage = SR_buildReminderMessage(reminderData);

    // 發送提醒 - 透過 WH 模組發送 LINE 訊息
    let pushResult = null;
    if (WH && typeof WH.WH_sendPushMessage === 'function') {
      try {
        pushResult = await WH.WH_sendPushMessage(reminderData.userId, reminderMessage);
      } catch (pushError) {
        // 根據錯誤類型決定重試策略
        if (pushError.message.includes('用戶已刪除好友') || pushError.message.includes('blocked')) {
          // 用戶刪除好友或封鎖，停用提醒
          await reminderDoc.ref.update({
            active: false,
            deactivationReason: '用戶已刪除好友或封鎖',
            deactivatedAt: admin.firestore.Timestamp.now()
          });
          return {
            executed: false,
            reason: '用戶已刪除好友，提醒已自動停用'
          };
        }
        throw new Error(`推播發送失敗: ${pushError.message}`);
      }
    } else {
      throw new Error('WH 模組不可用');
    }

    // 更新執行記錄
    const updateData = {
      lastExecution: admin.firestore.Timestamp.now(),
      nextExecution: admin.firestore.Timestamp.fromDate(SR_calculateNextExecution(reminderData)),
      executionCount: admin.firestore.FieldValue.increment(1),
      lastExecutionStatus: 'success',
      failureCount: 0 // 重置失敗計數
    };

    if (pushResult && pushResult.messageId) {
      updateData.lastMessageId = pushResult.messageId;
    }

    await reminderDoc.ref.update(updateData);

    // 記錄成功執行
    await SR_logScheduledActivity('REMINDER_EXECUTED', {
      reminderId,
      messageLength: reminderMessage.length,
      pushResult
    }, reminderData.userId);

    SR_logInfo(`排程任務執行成功: ${reminderId}`, "執行任務", reminderData.userId, "", "", functionName);

    return {
      executed: true,
      message: '提醒發送成功',
      messageId: pushResult?.messageId,
      nextExecution: updateData.nextExecution.toDate().toISOString()
    };

  } catch (error) {
    SR_logError(`執行排程任務失敗: ${error.message}`, "執行任務", "", "SR_EXECUTE_ERROR", error.toString(), functionName);

    // 更新失敗記錄
    try {
      const reminderDoc = await db.collection('scheduled_reminders').doc(reminderId).get();
      if (reminderDoc.exists) {
        await reminderDoc.ref.update({
          lastExecutionStatus: 'failed',
          lastError: error.message,
          failureCount: admin.firestore.FieldValue.increment(1),
          lastFailure: admin.firestore.Timestamp.now()
        });
      }
    } catch (updateError) {
      SR_logError(`更新失敗記錄失敗: ${updateError.message}`, "執行任務", "", "SR_UPDATE_ERROR", updateError.toString(), functionName);
    }

    // 指數退避重試機制
    if (retryCount < maxRetries) {
      const retryDelay = Math.pow(2, retryCount) * 1000; // 指數退避
      SR_logWarning(`${retryDelay/1000}秒後進行第${retryCount + 1}次重試`, "執行任務", "", "", "", functionName);

      setTimeout(async () => {
        await SR_executeScheduledTask(reminderId, retryCount + 1);
      }, retryDelay);

      return {
        executed: false,
        error: error.message,
        retryScheduled: true,
        retryCount: retryCount + 1
      };
    } else {
      // 達到最大重試次數，記錄錯誤並停用提醒
      await SR_handleSchedulerError('EXECUTION_FAILED', {
        reminderId,
        error: error.message,
        retryCount
      }, { reminderId });

      return {
        executed: false,
        error: error.message,
        maxRetriesReached: true
      };
    }
  }
}

/**
 * 05. 處理國定假日邏輯 - 強化台灣假日處理和智慧調整
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @update: 新增完整台灣假日日曆整合、智慧工作日計算、彈性假日策略
 */
async function SR_processHolidayLogic(date, holidayHandling = 'skip', userTimezone = TIMEZONE) {
  const functionName = "SR_processHolidayLogic";
  try {
    SR_logInfo(`處理假日邏輯: ${moment(date).format('YYYY-MM-DD')}`, "假日處理", "", "", "", functionName);

    // 使用使用者時區處理日期
    const userDate = moment(date).tz(userTimezone);
    const dayOfWeek = userDate.day();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = userDate.format('YYYY-MM-DD');
    const year = userDate.format('YYYY');

    // 整合多種假日資料來源
    let isHoliday = false;
    let holidayName = '';

    try {
      // 1. 優先查詢政府開放資料（透過API或快取）
      const governmentHolidays = await SR_getGovernmentHolidays(year);
      const govHoliday = governmentHolidays.find(h => h.date === dateStr);

      if (govHoliday) {
        isHoliday = true;
        holidayName = govHoliday.name;
      } else {
        // 2. 備案：從 Firestore 取得假日資料
        const holidayDoc = await db.collection('holiday_calendar').doc(year).get();
        if (holidayDoc.exists) {
          const holidayData = holidayDoc.data();
          const holiday = holidayData.holidays?.find(h => h.date === dateStr);
          if (holiday) {
            isHoliday = true;
            holidayName = holiday.name;
          }
        } else {
          // 3. 最後備案：使用內建假日清單
          const builtInHolidays = await SR_getBuiltInHolidays(year);
          const holiday = builtInHolidays.find(h => h.date === dateStr);
          if (holiday) {
            isHoliday = true;
            holidayName = holiday.name;
          }
        }
      }
    } catch (holidayError) {
      SR_logWarning(`假日資料查詢失敗，使用內建清單: ${holidayError.message}`, "假日處理", "", "", "", functionName);
      const builtInHolidays = await SR_getBuiltInHolidays(year);
      const holiday = builtInHolidays.find(h => h.date === dateStr);
      if (holiday) {
        isHoliday = true;
        holidayName = holiday.name;
      }
    }

    let adjustedDate = date;
    let shouldSkip = false;
    let adjustmentReason = '';

    if (isWeekend || isHoliday) {
      const reasonType = isHoliday ? `國定假日(${holidayName})` : '週末';

      switch (holidayHandling) {
        case 'skip':
          shouldSkip = true;
          adjustmentReason = `跳過${reasonType}`;
          break;

        case 'next_workday':
          // 智慧尋找下一個工作日（考慮連續假期）
          adjustedDate = await SR_findNextWorkday(userDate, userTimezone);
          adjustmentReason = `${reasonType}調整至下一工作日`;
          break;

        case 'previous_workday':
          // 智慧尋找前一個工作日
          adjustedDate = await SR_findPreviousWorkday(userDate, userTimezone);
          adjustmentReason = `${reasonType}調整至前一工作日`;
          break;

        case 'smart_adjust':
          // 智慧調整：根據距離選擇最近的工作日
          const nextWorkday = await SR_findNextWorkday(userDate, userTimezone);
          const prevWorkday = await SR_findPreviousWorkday(userDate, userTimezone);

          const nextDiff = moment(nextWorkday).diff(userDate, 'days');
          const prevDiff = userDate.diff(moment(prevWorkday), 'days');

          if (nextDiff <= prevDiff) {
            adjustedDate = nextWorkday;
            adjustmentReason = `${reasonType}智慧調整至下一工作日`;
          } else {
            adjustedDate = prevWorkday;
            adjustmentReason = `${reasonType}智慧調整至前一工作日`;
          }
          break;

        default:
          shouldSkip = true;
          adjustmentReason = `跳過${reasonType}`;
      }
    }

    const result = {
      isWeekend,
      isHoliday,
      holidayName,
      shouldSkip,
      adjustedDate,
      originalDate: date,
      adjustmentReason,
      holidayHandling,
      timezone: userTimezone
    };

    // 記錄假日處理結果
    if (isWeekend || isHoliday) {
      SR_logInfo(`假日處理結果: ${adjustmentReason}`, "假日處理", "", "", JSON.stringify(result), functionName);
    }

    return result;

  } catch (error) {
    SR_logError(`處理假日邏輯失敗: ${error.message}`, "假日處理", "", "SR_HOLIDAY_ERROR", error.toString(), functionName);
    return {
      isWeekend: false,
      isHoliday: false,
      holidayName: '',
      shouldSkip: false,
      adjustedDate: date,
      originalDate: date,
      adjustmentReason: '處理失敗，使用原始日期',
      error: error.message
    };
  }
}

/**
 * 06. 獲取政府開放資料假日清單
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 從台灣政府開放資料平台獲取假日資訊
 */
async function SR_getGovernmentHolidays(year) {
  const functionName = "SR_getGovernmentHolidays";
  try {
    // 先檢查快取
    const cacheKey = `gov_holidays_${year}`;
    const cachedData = await db.collection('holiday_cache').doc(cacheKey).get();

    if (cachedData.exists) {
      const cache = cachedData.data();
      const now = new Date();
      const cacheAge = now - cache.timestamp.toDate();

      // 快取有效期24小時
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return cache.holidays;
      }
    }

    // 政府開放資料API端點
    const apiUrl = `https://data.gov.tw/api/v1/rest/datastore_search?resource_id=W2C00702-E2BC-4D95-9667-65ACB6A8C8D4&filters={"date":"${year}"}`;

    try {
      const fetch = require('node-fetch'); // 需要安裝 node-fetch
      const response = await fetch(apiUrl, { timeout: 5000 });

      if (response.ok) {
        const data = await response.json();
        const holidays = data.result?.records?.map(record => ({
          date: record.date,
          name: record.name,
          type: record.isHoliday === 'true' ? 'holiday' : 'workday'
        })) || [];

        // 更新快取
        await db.collection('holiday_cache').doc(cacheKey).set({
          holidays,
          timestamp: admin.firestore.Timestamp.now(),
          source: 'government_api'
        });

        SR_logInfo(`政府假日資料取得成功: ${holidays.length}筆`, "假日處理", "", "", "", functionName);
        return holidays;
      }
    } catch (apiError) {
      SR_logWarning(`政府API呼叫失敗: ${apiError.message}`, "假日處理", "", "", "", functionName);
    }

    // API失敗時返回空陣列，使用其他備案
    return [];

  } catch (error) {
    SR_logError(`取得政府假日資料失敗: ${error.message}`, "假日處理", "", "SR_GOV_API_ERROR", error.toString(), functionName);
    return [];
  }
}

// =============== 付費功能控制層函數 (4個) ===============

/**
 * 07. 驗證付費功能權限 - 修復Object.is equality錯誤
 * @version 2025-07-22-V1.6.0
 * @date 2025-07-22 15:00:00
 * @update: 完全修復Object.is equality問題，強化返回值類型一致性和布爾值處理邏輯
 */
async function SR_validatePremiumFeature(userId, featureName, operationContext = {}) {
  const functionName = "SR_validatePremiumFeature";
  try {
    SR_logInfo(`驗證付費功能: ${featureName}`, "權限驗證", userId, "", "", functionName);

    // 嚴格輸入驗證
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return {
        allowed: false,  // 確保返回布爾false
        reason: '無效的用戶ID',
        errorCode: 'INVALID_USER_ID'
      };
    }

    if (!featureName || typeof featureName !== 'string') {
      return {
        allowed: false,  // 確保返回布爾false
        reason: '無效的功能名稱',
        errorCode: 'INVALID_FEATURE_NAME'
      };
    }

    // 功能權限矩陣 - 完全重構
    const featureMatrix = {
      // 免費功能
      'CREATE_REMINDER': { 
        level: 'free', 
        quotaLimited: true, 
        maxQuota: SR_CONFIG.MAX_FREE_REMINDERS,
        description: '建立排程提醒' 
      },
      'BASIC_STATISTICS': { 
        level: 'free', 
        quotaLimited: false, 
        description: '基礎統計查詢' 
      },

      // 付費功能
      'AUTO_PUSH': { 
        level: 'premium', 
        quotaLimited: false, 
        description: '自動推播服務' 
      },
      'UNLIMITED_REMINDERS': { 
        level: 'premium', 
        quotaLimited: false, 
        description: '無限制提醒設定' 
      }
    };

    const feature = featureMatrix[featureName];
    if (!feature) {
      return {
        allowed: false,  // 確保返回布爾false
        reason: '未知功能',
        errorCode: 'UNKNOWN_FEATURE'
      };
    }

    // 獲取訂閱狀態 - 強化錯誤處理
    let subscriptionStatus;
    try {
      subscriptionStatus = await SR_checkSubscriptionStatus(userId);
      // 確保返回值結構正確
      if (!subscriptionStatus || typeof subscriptionStatus.isPremium !== 'boolean') {
        subscriptionStatus = { 
          isPremium: false, 
          subscriptionType: 'free',
          expiresAt: null,
          features: []
        };
      }
    } catch (statusError) {
      SR_logWarning(`訂閱狀態查詢失敗，預設為免費用戶: ${statusError.message}`, "權限驗證", userId, "", "", functionName);
      subscriptionStatus = { 
        isPremium: false, 
        subscriptionType: 'free',
        expiresAt: null,
        features: []
      };
    }

    // 獲取試用狀態 - 強化錯誤處理  
    let trialStatus;
    try {
      trialStatus = await SR_checkTrialStatus(userId);
      // 確保返回值結構正確
      if (!trialStatus || typeof trialStatus.isInTrial !== 'boolean') {
        trialStatus = {
          hasUsedTrial: false,
          isInTrial: false,
          daysRemaining: 0,
          hasTrialExpired: false
        };
      }
    } catch (trialError) {
      SR_logWarning(`試用狀態查詢失敗: ${trialError.message}`, "權限驗證", userId, "", "", functionName);
      trialStatus = {
        hasUsedTrial: false,
        isInTrial: false,
        daysRemaining: 0,
        hasTrialExpired: false
      };
    }

    // 計算用戶權限等級 - 嚴格布爾邏輯
    const hasPremiumAccess = Boolean(subscriptionStatus.isPremium === true || trialStatus.isInTrial === true);

    // 付費功能權限檢查
    if (feature.level === 'premium' && !hasPremiumAccess) {
      return {
        allowed: false,  // 明確返回布爾false
        reason: trialStatus.hasTrialExpired ? 
          '免費試用已結束，請升級至 Premium 訂閱' : 
          '此功能需要 Premium 訂閱',
        upgradeRequired: true,
        featureType: 'premium',
        featureDescription: feature.description,
        trialAvailable: Boolean(!trialStatus.hasUsedTrial)
      };
    }

    // 免費功能配額檢查 - 完全重寫配額邏輯
    if (feature.level === 'free' && feature.quotaLimited === true && !hasPremiumAccess) {
      let quotaResult;
      try {
        quotaResult = await SR_checkFeatureQuota(userId, featureName, feature.maxQuota);
        // 確保配額結果結構正確
        if (!quotaResult || typeof quotaResult.available !== 'boolean') {
          quotaResult = { 
            available: false, 
            used: 0, 
            limit: feature.maxQuota || 0 
          };
        }
      } catch (quotaError) {
        SR_logError(`配額檢查失敗: ${quotaError.message}`, "權限驗證", userId, "QUOTA_CHECK_ERROR", quotaError.toString(), functionName);
        quotaResult = { 
          available: false, 
          used: 0, 
          limit: feature.maxQuota || 0 
        };
      }

      // 嚴格配額檢查
      if (quotaResult.available !== true) {
        return {
          allowed: false,  // 明確返回布爾false
          reason: `免費用戶${feature.description}已達上限 (${quotaResult.used}/${feature.maxQuota})`,
          upgradeRequired: true,
          featureType: 'free_limited',
          quotaUsed: Number(quotaResult.used) || 0,
          quotaLimit: Number(feature.maxQuota) || 0
        };
      }
    }

    // 權限驗證通過 - 記錄功能使用
    try {
      await SR_recordFeatureUsage(userId, featureName, operationContext);
    } catch (recordError) {
      SR_logWarning(`功能使用記錄失敗: ${recordError.message}`, "權限驗證", userId, "", "", functionName);
    }

    // 構建成功響應
    const successResponse = {
      allowed: true,  // 明確返回布爾true
      reason: hasPremiumAccess ? 
        (subscriptionStatus.isPremium === true ? 'Premium user' : `Trial user (${trialStatus.daysRemaining} days left)`) : 
        'Free feature access',
      featureType: feature.level,
      featureDescription: feature.description,
      subscriptionType: subscriptionStatus.subscriptionType || 'free',
      hasPremiumAccess: Boolean(hasPremiumAccess)
    };

    SR_logInfo(`功能權限驗證通過: ${featureName} (${feature.level})`, "權限驗證", userId, "", JSON.stringify(successResponse), functionName);

    return successResponse;

  } catch (error) {
    SR_logError(`驗證付費功能失敗: ${error.message}`, "權限驗證", userId, "SR_VALIDATE_ERROR", error.toString(), functionName);
    return {
      allowed: false,  // 確保錯誤時返回布爾false
      reason: '權限驗證系統錯誤',
      error: error.message,
      errorCode: 'VALIDATION_ERROR'
    };
  }
}

/**
 * 08. 檢查訂閱狀態 - 修復布爾值返回和類型一致性問題
 * @version 2025-07-22-V1.6.0
 * @date 2025-07-22 15:00:00
 * @description 查詢用戶的訂閱狀態和權限，確保返回嚴格的布爾值和一致的數據類型
 */
async function SR_checkSubscriptionStatus(userId) {
  const functionName = "SR_checkSubscriptionStatus";
  try {
    // 嚴格輸入驗證
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      SR_logError('用戶ID無效或空白', "訂閱檢查", userId, "INVALID_USER_ID", "", functionName);
      return {
        isPremium: false,  // 明確布爾值
        subscriptionType: 'free',
        expiresAt: null,
        features: [],
        error: '無效的用戶ID'
      };
    }

    // 嘗試透過 AM 模組查詢用戶訂閱狀態
    if (AM && typeof AM.AM_getUserInfo === 'function') {
      try {
        const userInfo = await AM.AM_getUserInfo(userId, userId, true);

        // 嚴格驗證 AM 模組返回值
        if (userInfo && typeof userInfo === 'object' && userInfo.success === true) {
          const userData = userInfo.userData || {};
          const subscription = userData.subscription || {};

          // 嚴格類型轉換和驗證
          const subscriptionType = String(subscription.type || 'free');
          const isPremiumUser = Boolean(subscriptionType === 'premium');
          const features = Array.isArray(subscription.features) ? 
            subscription.features : ['basic_reminders', 'manual_statistics'];

          const result = {
            isPremium: isPremiumUser,  // 嚴格布爾值
            subscriptionType: subscriptionType,
            expiresAt: subscription.expiresAt || null,
            features: features,
            source: 'AM_module'
          };

          SR_logInfo(`訂閱狀態查詢成功: ${isPremiumUser ? 'Premium' : 'Free'} (${subscriptionType})`, 
                    "訂閱檢查", userId, "", JSON.stringify(result), functionName);

          return result;
        } else {
          SR_logWarning(`AM模組返回無效數據: ${JSON.stringify(userInfo)}`, "訂閱檢查", userId, "", "", functionName);
        }

      } catch (amError) {
        SR_logWarning(`AM模組查詢異常: ${amError.message}`, "訂閱檢查", userId, "AM_QUERY_ERROR", amError.toString(), functionName);
      }
    } else {
      SR_logWarning('AM模組不可用或函數不存在', "訂閱檢查", userId, "AM_MODULE_UNAVAILABLE", "", functionName);
    }

    // 預設為免費用戶 - 保證數據類型一致性
    const defaultResult = {
      isPremium: false,  // 明確布爾false
      subscriptionType: 'free',
      expiresAt: null,
      features: ['basic_reminders', 'manual_statistics'],
      source: 'default_fallback'
    };

    SR_logInfo('使用預設免費用戶設定', "訂閱檢查", userId, "", JSON.stringify(defaultResult), functionName);
    return defaultResult;

  } catch (error) {
    SR_logError(`檢查訂閱狀態失敗: ${error.message}`, "訂閱檢查", userId, "SR_SUBSCRIPTION_ERROR", error.toString(), functionName);

    // 錯誤時的安全預設值
    return {
      isPremium: false,  // 明確布爾false
      subscriptionType: 'free',
      expiresAt: null,
      features: [],
      error: error.message
    };
  }
}

/**
 * 09. 強制免費用戶限制
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 對免費用戶實施功能限制
 */
async function SR_enforceFreeUserLimits(userId, actionType) {
  const functionName = "SR_enforceFreeUserLimits";
  try {
    const subscriptionStatus = await SR_checkSubscriptionStatus(userId);

    if (subscriptionStatus.isPremium) {
      return {
        enforced: false,
        reason: 'Premium user - no limits'
      };
    }

    const limits = {
      reminderCount: SR_CONFIG.MAX_FREE_REMINDERS,
      pushNotifications: false,
      advancedAnalytics: false
    };

    let violated = false;
    let violationType = '';

    switch (actionType) {
      case 'CREATE_REMINDER':
        const currentCount = await SR_getUserReminderCount(userId);
        if (currentCount >= limits.reminderCount) {
          violated = true;
          violationType = 'MAX_REMINDERS';
        }
        break;

      case 'PUSH_NOTIFICATION':
        if (!limits.pushNotifications) {
          violated = true;
          violationType = 'PUSH_DISABLED';
        }
        break;
    }

    if (violated) {
      return {
        enforced: true,
        violationType,
        currentLimits: limits,
        upgradeMessage: SR_generateUpgradeMessage(violationType)
      };
    }

    return {
      enforced: false,
      currentLimits: limits
    };

  } catch (error) {
    SR_logError(`強制用戶限制失敗: ${error.message}`, "用戶限制", userId, "SR_ENFORCE_ERROR", error.toString(), functionName);
    return {
      enforced: true,
      error: error.message
    };
  }
}

/**
 * 10. 升級功能存取權限
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 處理用戶升級後的功能權限變更
 */
async function SR_upgradeFeatureAccess(userId, newSubscriptionType) {
  const functionName = "SR_upgradeFeatureAccess";
  try {
    SR_logInfo(`升級功能權限: ${userId} -> ${newSubscriptionType}`, "權限升級", userId, "", "", functionName);

    // 定義訂閱類型的功能清單
    const featureMap = {
      free: ['basic_reminders', 'manual_statistics'],
      premium: [
        'unlimited_reminders', 
        'auto_push_notifications', 
        'advanced_analytics',
        'priority_support'
      ]
    };

    const newFeatures = featureMap[newSubscriptionType] || featureMap.free;

    // 更新用戶功能權限（透過 AM 模組）
    if (AM && typeof AM.AM_updateAccountInfo === 'function') {
      const updateResult = await AM.AM_updateAccountInfo(userId, {
        subscription: {
          type: newSubscriptionType,
          features: newFeatures,
          upgradeDate: admin.firestore.Timestamp.now()
        }
      }, userId);

      if (!updateResult.success) {
        throw new Error('更新用戶訂閱資訊失敗');
      }
    }

    // 啟用進階功能
    if (newSubscriptionType === 'premium') {
      await SR_enablePremiumFeatures(userId);
    }

    return {
      upgraded: true,
      newFeatures,
      previousType: 'free',
      newType: newSubscriptionType
    };

  } catch (error) {
    SR_logError(`升級功能權限失敗: ${error.message}`, "權限升級", userId, "SR_UPGRADE_ERROR", error.toString(), functionName);
    return {
      upgraded: false,
      error: error.message
    };
  }
}

// =============== 推播服務層函數 (4個) ===============

/**
 * 11. 發送每日財務摘要（付費功能）
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 自動推播每日財務摘要給付費用戶
 */
async function SR_sendDailyFinancialSummary(userId) {
  const functionName = "SR_sendDailyFinancialSummary";
  try {
    // 檢查付費功能權限
    const permissionCheck = await SR_validatePremiumFeature(userId, 'AUTO_PUSH');
    if (!permissionCheck.allowed) {
      return {
        sent: false,
        error: '此功能需要 Premium 訂閱',
        upgradeRequired: true
      };
    }

    SR_logInfo(`發送每日財務摘要: ${userId}`, "每日摘要", userId, "", "", functionName);

    // 透過 DD 模組取得本日統計
    let todayStats = null;
    if (DD1 && typeof DD1.DD_getStatistics === 'function') {
      const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
      const statsResult = await DD1.DD_getStatistics(userId, 'daily', { date: today });
      todayStats = statsResult.success ? statsResult.data : null;
    }

    // 建立摘要訊息
    const summaryMessage = SR_buildDailySummaryMessage(todayStats);

    // 發送推播訊息
    if (WH && typeof WH.WH_sendPushMessage === 'function') {
      await WH.WH_sendPushMessage(userId, summaryMessage);
    }

    // 記錄推播
    await db.collection('push_notifications').add({
      userId,
      type: 'daily_summary',
      message: summaryMessage,
      sentAt: admin.firestore.Timestamp.now(),
      status: 'sent'
    });

    return {
      sent: true,
      messageLength: summaryMessage.length,
      statsIncluded: !!todayStats
    };

  } catch (error) {
    SR_logError(`發送每日摘要失敗: ${error.message}`, "每日摘要", userId, "SR_SUMMARY_ERROR", error.toString(), functionName);
    return {
      sent: false,
      error: error.message
    };
  }
}

/**
 * 12. 發送預算警告（付費功能）
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 當支出接近預算上限時發送警告
 */
async function SR_sendBudgetWarning(userId, budgetData) {
  const functionName = "SR_sendBudgetWarning";
  try {
    // 檢查付費功能權限
    const permissionCheck = await SR_validatePremiumFeature(userId, 'AUTO_PUSH');
    if (!permissionCheck.allowed) {
      return {
        sent: false,
        error: '此功能需要 Premium 訂閱'
      };
    }

    SR_logInfo(`發送預算警告: ${userId}`, "預算警告", userId, "", "", functionName);

    // 建立警告訊息
    const warningMessage = `⚠️ 預算警示

預算項目：${budgetData.categoryName}
本月支出：${budgetData.currentAmount}元
預算額度：${budgetData.budgetLimit}元
使用率：${budgetData.usagePercentage}%

${budgetData.usagePercentage >= 100 ? '⚠️ 已超出預算額度' : '💡 建議控制支出'}

輸入「統計」查看詳細分析`;

    // 發送警告訊息
    if (WH && typeof WH.WH_sendPushMessage === 'function') {
      await WH.WH_sendPushMessage(userId, warningMessage);
    }

    return {
      sent: true,
      warningLevel: budgetData.usagePercentage >= 100 ? 'critical' : 'warning'
    };

  } catch (error) {
    SR_logError(`發送預算警告失敗: ${error.message}`, "預算警告", userId, "SR_WARNING_ERROR", error.toString(), functionName);
    return {
      sent: false,
      error: error.message
    };
  }
}

/**
 * 13. 發送月度報告（付費功能）
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 生成並發送月度財務報告
 */
async function SR_sendMonthlyReport(userId) {
  const functionName = "SR_sendMonthlyReport";
  try {
    // 檢查付費功能權限
    const permissionCheck = await SR_validatePremiumFeature(userId, 'AUTO_PUSH');
    if (!permissionCheck.allowed) {
      return {
        sent: false,
        error: '此功能需要 Premium 訂閱'
      };
    }

    SR_logInfo(`發送月度報告: ${userId}`, "月度報告", userId, "", "", functionName);

    // 取得月度統計
    let monthlyStats = null;
    if (DD1 && typeof DD1.DD_getStatistics === 'function') {
      const thisMonth = moment().tz(TIMEZONE).format('YYYY-MM');
      const statsResult = await DD1.DD_getStatistics(userId, 'monthly', { month: thisMonth });
      monthlyStats = statsResult.success ? statsResult.data : null;
    }

    // 建立月度報告訊息
    const reportMessage = SR_buildMonthlyReportMessage(monthlyStats);

    // 發送報告
    if (WH && typeof WH.WH_sendPushMessage === 'function') {
      await WH.WH_sendPushMessage(userId, reportMessage);
    }

    return {
      sent: true,
      reportGenerated: !!monthlyStats
    };

  } catch (error) {
    SR_logError(`發送月度報告失敗: ${error.message}`, "月度報告", userId, "SR_REPORT_ERROR", error.toString(), functionName);
    return {
      sent: false,
      error: error.message
    };
  }
}

/**
 * 14. 處理 Quick Reply 統計 - 直接Firestore查詢版本
 * @version 2025-07-22-V1.4.1
 * @date 2025-07-22 12:00:00
 * @update: 移除DD1模組依賴，新增直接Firestore統計查詢邏輯，確保統計資料正確讀取
 */
async function SR_processQuickReplyStatistics(userId, postbackData) {
  const functionName = "SR_processQuickReplyStatistics";
  try {
    SR_logInfo(`處理Quick Reply統計: ${postbackData}`, "Quick Reply", userId, "", "", functionName);

    let statsResult = null;
    let period = '';

    // 根據 postback 資料取得對應統計
    switch (postbackData) {
      case '本日統計':
        period = 'today';
        statsResult = await SR_getDirectStatistics(userId, 'daily');
        break;

      case '本週統計':
        period = 'week';
        statsResult = await SR_getDirectStatistics(userId, 'weekly');
        break;

      case '本月統計':
        period = 'month';
        statsResult = await SR_getDirectStatistics(userId, 'monthly');
        break;
    }

    // 建立統計回覆訊息
    const replyMessage = SR_buildStatisticsReplyMessage(period, statsResult?.success ? statsResult.data : null);

    // 建立基礎 Quick Reply 按鈕
    const quickReplyButtons = await SR_generateQuickReplyOptions(userId, 'statistics');

    return {
      success: true,
      message: replyMessage,
      quickReply: quickReplyButtons,
      period: period
    };

  } catch (error) {
    SR_logError(`處理Quick Reply統計失敗: ${error.message}`, "Quick Reply", userId, "SR_QUICKREPLY_ERROR", error.toString(), functionName);

    return {
      success: false,
      message: '統計查詢失敗，請稍後再試',
      error: error.message
    };
  }
}

// =============== 數據整合層函數 (4個) ===============

/**
 * 15. 與 AM 模組同步
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 與帳號管理模組同步用戶資料
 */
async function SR_syncWithAccountModule(userId, syncType = 'full') {
  const functionName = "SR_syncWithAccountModule";
  try {
    SR_logInfo(`與AM模組同步: ${syncType}`, "模組同步", userId, "", "", functionName);

    if (!AM || typeof AM.AM_getUserInfo !== 'function') {
      throw new Error('AM模組不可用');
    }

    // 取得用戶完整資訊
    const userInfo = await AM.AM_getUserInfo(userId, userId, true);
    if (!userInfo.success) {
      throw new Error('無法取得用戶資訊');
    }

    // 同步訂閱狀態到 SR 模組
    const subscriptionData = {
      userId,
      subscriptionType: userInfo.userData.subscription?.type || 'free',
      features: userInfo.userData.subscription?.features || [],
      syncedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('user_quotas').doc(userId).set(subscriptionData, { merge: true });

    return {
      synced: true,
      syncType,
      subscriptionType: subscriptionData.subscriptionType,
      featuresCount: subscriptionData.features.length
    };

  } catch (error) {
    SR_logError(`AM模組同步失敗: ${error.message}`, "模組同步", userId, "SR_AM_SYNC_ERROR", error.toString(), functionName);
    return {
      synced: false,
      error: error.message
    };
  }
}

/**
 * 16. 與 DD 模組同步
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 與數據分發模組同步統計資料
 */
async function SR_syncWithDataDistribution(userId, dataType) {
  const functionName = "SR_syncWithDataDistribution";
  try {
    SR_logInfo(`與DD模組同步: ${dataType}`, "模組同步", userId, "", "", functionName);

    if (!DD1 || typeof DD1.DD_distributeData !== 'function') {
      throw new Error('DD模組不可用');
    }

    // 分發 SR 相關事件
    const syncData = {
      type: 'sr_data_sync',
      userId,
      dataType,
      timestamp: new Date().toISOString(),
      source: 'SR_module'
    };

    await DD1.DD_distributeData(syncData);

    return {
      synced: true,
      dataType,
      distributedAt: syncData.timestamp
    };

  } catch (error) {
    SR_logError(`DD模組同步失敗: ${error.message}`, "模組同步", userId, "SR_DD_SYNC_ERROR", error.toString(), functionName);
    return {
      synced: false,
      error: error.message
    };
  }
}

/**
 * 17. 記錄排程活動
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 記錄所有排程相關活動到日誌系統
 */
async function SR_logScheduledActivity(activityType, activityData, userId) {
  const functionName = "SR_logScheduledActivity";
  try {
    const logEntry = {
      activityType,
      userId,
      activityData,
      timestamp: admin.firestore.Timestamp.now(),
      source: 'SR_module',
      processed: false
    };

    // 記錄到 scheduler_logs 集合
    await db.collection('scheduler_logs').add(logEntry);

    // 同時記錄到系統日誌
    SR_logInfo(`排程活動: ${activityType}`, activityType, userId, "", JSON.stringify(activityData), functionName);

    return {
      logged: true,
      logId: logEntry.timestamp.toDate().getTime(),
      activityType
    };

  } catch (error) {
    SR_logError(`記錄排程活動失敗: ${error.message}`, "活動記錄", userId, "SR_LOG_ERROR", error.toString(), functionName);
    return {
      logged: false,
      error: error.message
    };
  }
}

/**
 * 18. 處理排程器錯誤
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 統一處理排程器相關錯誤
 */
async function SR_handleSchedulerError(errorType, errorData, context) {
  const functionName = "SR_handleSchedulerError";
  try {
    const errorCode = `SR_${errorType.toUpperCase()}_ERROR`;
    const timestamp = new Date().toISOString();

    // 記錄詳細錯誤資訊
    SR_logError(`排程器錯誤: ${errorType}`, "錯誤處理", context.userId || "", errorCode, JSON.stringify(errorData), functionName);

    let recoveryAction = "none";

    // 根據錯誤類型執行恢復操作
    switch (errorType) {
      case "EXECUTION_FAILED":
        recoveryAction = "disable_reminder";
        // 停用失敗的提醒
        if (context.reminderId) {
          await db.collection('scheduled_reminders').doc(context.reminderId).update({
            active: false,
            disabledReason: `多次執行失敗: ${errorData.error}`,
            disabledAt: admin.firestore.Timestamp.now()
          });
        }
        break;

      case "DATABASE_ERROR":
        recoveryAction = "check_connection";
        break;

      default:
        recoveryAction = "manual_intervention_required";
    }

    return {
      handled: true,
      errorCode,
      recoveryAction,
      timestamp
    };

  } catch (handleError) {
    console.error(`處理排程器錯誤時發生異常:`, handleError);
    return {
      handled: false,
      errorCode: "SR_ERROR_HANDLER_FAILED",
      recoveryAction: "system_restart_required",
      timestamp: new Date().toISOString()
    };
  }
}

// =============== Quick Reply 專用層函數 (3個) ===============

/**
 * 19. 統一處理 Quick Reply 互動 - 簡化版本
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @update: 移除複雜的會話管理邏輯，簡化為直接處理模式
 */
async function SR_handleQuickReplyInteraction(userId, postbackData, messageContext = {}) {
  const functionName = "SR_handleQuickReplyInteraction";

  try {
    SR_logInfo(`處理Quick Reply互動: ${postbackData}`, "Quick Reply", userId, "", "", functionName);

    let response = null;
    let interactionType = 'unknown';

    // 直接路由分發，不使用複雜會話管理
    if (['本日統計', '本週統計', '本月統計'].includes(postbackData)) {
      interactionType = 'statistics';

      // 檢查統計查詢權限
      const permissionCheck = await SR_validatePremiumFeature(userId, 'BASIC_STATISTICS');
      if (!permissionCheck.allowed) {
        response = await SR_handlePaywallQuickReply(userId, 'blocked', { 
          blockedFeature: 'statistics',
          reason: permissionCheck.reason 
        });
      } else {
        response = await SR_processQuickReplyStatistics(userId, postbackData);
      }

    } else if (['upgrade_premium', '立即升級'].includes(postbackData)) {
      interactionType = 'upgrade';
      response = await SR_handlePaywallQuickReply(userId, 'upgrade', messageContext);

    } else if (['試用', '免費試用', 'start_trial'].includes(postbackData)) {
      interactionType = 'trial';
      response = await SR_handlePaywallQuickReply(userId, 'trial', messageContext);

    } else if (['功能介紹', '了解更多', 'learn_more'].includes(postbackData)) {
      interactionType = 'info';
      response = await SR_handlePaywallQuickReply(userId, 'info', messageContext);

    } else {
      // 未知的 postback
      interactionType = 'unknown';
      response = {
        success: false,
        message: '抱歉，無法識別您的選擇。請從下方選項重新操作：',
        quickReply: await SR_generateQuickReplyOptions(userId, 'default'),
        errorCode: 'UNKNOWN_POSTBACK'
      };
    }

    // 記錄互動
    await SR_logQuickReplyInteraction(userId, postbackData, response, { interactionType });

    if (response) {
      response.interactionType = interactionType;
      response.timestamp = new Date().toISOString();
    }

    SR_logInfo(`Quick Reply處理完成: ${interactionType}`, "Quick Reply", userId, "", "", functionName);

    return response;

  } catch (error) {
    SR_logError(`處理Quick Reply互動失敗: ${error.message}`, "Quick Reply", userId, "SR_INTERACTION_ERROR", error.toString(), functionName);

    return {
      success: false,
      message: '系統暫時無法處理您的請求，請稍後再試',
      quickReply: {
        type: 'quick_reply',
        items: [
          { label: '本日統計', postbackData: '本日統計' }
        ]
      },
      error: error.message,
      errorCode: 'INTERACTION_ERROR'
    };
  }
}

/**
 * 20. 動態生成 Quick Reply 選項 - 簡化版本
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @update: 移除複雜的個人化推薦，簡化為基於訂閱狀態的基本選項生成
 */
async function SR_generateQuickReplyOptions(userId, context, additionalParams = {}) {
  const functionName = "SR_generateQuickReplyOptions";
  try {
    SR_logInfo(`生成Quick Reply選項: ${context}`, "Quick Reply", userId, "", "", functionName);

    // 取得使用者訂閱狀態
    const subscriptionStatus = await SR_checkSubscriptionStatus(userId);
    const trialStatus = await SR_checkTrialStatus(userId);
    const hasPremiumAccess = subscriptionStatus.isPremium || trialStatus.isInTrial;

    let options = [];
    const maxOptions = 4; // LINE Quick Reply 限制

    switch (context) {
      case 'statistics':
        // 基礎統計選項
        options = [
          SR_QUICK_REPLY_CONFIG.STATISTICS.TODAY,
          SR_QUICK_REPLY_CONFIG.STATISTICS.WEEKLY,
          SR_QUICK_REPLY_CONFIG.STATISTICS.MONTHLY
        ];

        // 付費用戶可額外看到提醒管理
        if (hasPremiumAccess) {
          options.push({ label: '提醒管理', postbackData: 'manage_reminders' });
        }
        break;

      case 'paywall':
        // 付費功能牆選項
        options = [];

        if (!trialStatus.hasUsedTrial) {
          options.push(SR_QUICK_REPLY_CONFIG.PREMIUM.TRIAL);
        }

        options.push(SR_QUICK_REPLY_CONFIG.PREMIUM.UPGRADE);
        options.push(SR_QUICK_REPLY_CONFIG.PREMIUM.INFO);
        options.push({ label: '查看統計', postbackData: '本日統計' });
        break;

      case 'upgrade_prompt':
        // 升級提示選項
        options = [
          SR_QUICK_REPLY_CONFIG.PREMIUM.UPGRADE,
          { label: '功能比較', postbackData: '功能介紹' },
          { label: '繼續免費', postbackData: '本日統計' }
        ];

        if (!trialStatus.hasUsedTrial) {
          options.unshift(SR_QUICK_REPLY_CONFIG.PREMIUM.TRIAL);
        }
        break;

      default:
        // 預設選項
        options = [
          SR_QUICK_REPLY_CONFIG.STATISTICS.TODAY,
          { label: '設定提醒', postbackData: 'setup_reminder' }
        ];

        if (!hasPremiumAccess) {
          options.push({ label: '升級會員', postbackData: 'upgrade_premium' });
        }
    }

    // 確保選項數量不超過限制
    options = options.slice(0, maxOptions);

    const result = {
      type: 'quick_reply',
      items: options.map(option => ({
        label: option.label,
        postbackData: option.postbackData
      })),
      context,
      userId,
      timestamp: new Date().toISOString(),
      subscriptionStatus: subscriptionStatus.subscriptionType,
      hasPremiumAccess
    };

    SR_logInfo(`生成${options.length}個Quick Reply選項`, "Quick Reply", userId, "", "", functionName);

    return result;

  } catch (error) {
    SR_logError(`生成Quick Reply選項失敗: ${error.message}`, "Quick Reply", userId, "SR_GENERATE_ERROR", error.toString(), functionName);

    // 錯誤時回傳最基本的安全選項
    return {
      type: 'quick_reply',
      items: [
        { label: '本日統計', postbackData: '本日統計' }
      ],
      context: 'error_fallback',
      error: error.message
    };
  }
}

/**
 * 21. 處理付費功能牆 Quick Reply - 移除試用啟動邏輯
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @update: 移除試用啟動邏輯，改為導向 AM 模組處理，簡化功能牆流程
 */
async function SR_handlePaywallQuickReply(userId, actionType, context = {}) {
  const functionName = "SR_handlePaywallQuickReply";
  try {
    SR_logInfo(`處理付費功能牆: ${actionType}`, "付費功能", userId, "", "", functionName);

    // 取得用戶狀態
    const [subscriptionStatus, trialStatus] = await Promise.all([
      SR_checkSubscriptionStatus(userId),
      SR_checkTrialStatus(userId)
    ]);

    let response = {};

    switch (actionType) {
      case 'upgrade':
        response = {
          success: true,
          message: `🌟 Premium 升級方案

✅ 無限排程提醒設定
✅ 每日財務摘要推播
✅ 預算警告自動通知
✅ 月度報告自動生成
✅ 趨勢分析功能

💳 優惠方案：
• 月費：NT$ 99/月
• 年費：NT$ 990/年 (省 2 個月！)

立即升級享受智慧記帳新體驗！`,
          quickReply: {
            type: 'quick_reply',
            items: [
              { label: '立即升級', postbackData: 'confirm_upgrade' },
              { label: '功能比較', postbackData: '功能介紹' },
              { label: '繼續免費', postbackData: '本日統計' }
            ]
          }
        };
        break;

      case 'trial':
        if (trialStatus.hasUsedTrial) {
          response = {
            success: false,
            message: `🚫 試用期限制

您已經使用過 7 天免費試用。

💡 但您可以：
• 查看功能對比了解更多價值
• 立即升級享受完整功能
• 繼續使用免費功能

感謝您對 LCAS Premium 的興趣！`,
            quickReply: {
              type: 'quick_reply',
              items: [
                { label: '升級會員', postbackData: 'upgrade_premium' },
                { label: '功能對比', postbackData: '功能介紹' },
                { label: '繼續免費', postbackData: '本日統計' }
              ]
            }
          };
        } else if (trialStatus.isInTrial) {
          response = {
            success: true,
            message: `🎉 您正在試用 Premium 功能

⏱️ 試用剩餘時間：${trialStatus.daysRemaining} 天

試用期間可享受：
• 無限排程提醒設定
• 每日財務摘要推播
• 預算警告自動通知
• 月度報告自動生成

試用即將結束，記得及時升級！`,
            quickReply: {
              type: 'quick_reply',
              items: [
                { label: '立即升級', postbackData: 'upgrade_premium' },
                { label: '設定提醒', postbackData: 'setup_reminder' },
                { label: '使用統計', postbackData: '本日統計' }
              ]
            }
          };
        } else {
          // 導向 AM 模組處理試用啟動
          response = {
            success: true,
            message: `🎁 啟動 7 天 Premium 免費試用

請聯繫客服或透過設定頁面啟動試用。

試用期間您可以體驗：
• 無限排程提醒設定
• 每日財務摘要推播
• 預算警告自動通知
• 月度報告自動生成

試用期後將自動恢復免費方案，無需取消`,
            quickReply: {
              type: 'quick_reply',
              items: [
                { label: '聯繫客服', postbackData: 'contact_support' },
                { label: '升級會員', postbackData: 'upgrade_premium' },
                { label: '了解功能', postbackData: '功能介紹' },
                { label: '繼續免費', postbackData: '本日統計' }
              ]
            }
          };
        }
        break;

      case 'info':
        response = {
          success: true,
          message: `📊 Premium 功能完整介紹

🔔 智慧提醒系統
• 無限制排程提醒設定（免費版限 ${SR_CONFIG.MAX_FREE_REMINDERS} 個）
• 假日與週末智慧處理
• 多種提醒模式（每日/週/月/自訂）

📈 自動推播服務
• 每日財務摘要（21:00 自動發送）
• 預算超支即時警告
• 月度報告自動生成

📊 進階分析功能
• 支出趨勢分析
• 類別占比統計
• 月度比較報告`,
          quickReply: {
            type: 'quick_reply',
            items: [
              { label: '立即升級', postbackData: 'upgrade_premium' },
              { label: '價格方案', postbackData: 'upgrade_premium' },
              { label: '繼續免費', postbackData: '本日統計' }
            ]
          }
        };
        break;

      case 'blocked':
        const blockedFeature = context.blockedFeature || '此功能';
        const reason = context.reason || '需要 Premium 訂閱';

        response = {
          success: false,
          message: `🔒 ${blockedFeature}需要升級

${reason}

Premium 會員專享：
• 無限制使用所有功能
• 優先客服支援

${trialStatus.hasUsedTrial ? '立即升級享受完整體驗' : '也可以先免費試用 7 天'}`,
          quickReply: {
            type: 'quick_reply',
            items: [
              { label: '立即升級', postbackData: 'upgrade_premium' },
              ...(trialStatus.hasUsedTrial ? [] : [{ label: '免費試用', postbackData: '試用' }]),
              { label: '了解更多', postbackData: '功能介紹' },
              { label: '繼續免費', postbackData: '本日統計' }
            ]
          }
        };
        break;

      default:
        response = {
          success: false,
          message: '無法處理此操作，請重新選擇',
          quickReply: await SR_generateQuickReplyOptions(userId, 'default')
        };
    }

    return response;

  } catch (error) {
    SR_logError(`處理付費功能牆失敗: ${error.message}`, "付費功能", userId, "SR_PAYWALL_ERROR", error.toString(), functionName);

    return {
      success: false,
      message: '系統暫時無法處理，請稍後再試',
      quickReply: {
        type: 'quick_reply',
        items: [
          { label: '本日統計', postbackData: '本日統計' }
        ]
      },
      error: error.message
    };
  }
}

// =============== 輔助函數 ===============

/**
 * 25. 生成 cron 表達式
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 根據提醒設定生成對應的cron表達式
 */
function SR_generateCronExpression(reminderData) {
  const time = reminderData.time || SR_CONFIG.DEFAULT_REMINDER_TIME;
  const [hour, minute] = time.split(':');

  switch (reminderData.type) {
    case SR_CONFIG.REMINDER_TYPES.DAILY:
      return `${minute} ${hour} * * *`;
    case SR_CONFIG.REMINDER_TYPES.WEEKLY:
      const dayOfWeek = reminderData.dayOfWeek || 1; // 預設週一
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case SR_CONFIG.REMINDER_TYPES.MONTHLY:
      const dayOfMonth = reminderData.dayOfMonth || 1; // 預設每月1號
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return `${minute} ${hour} * * *`; // 預設每日
  }
}

/**
 * 26. 計算下次執行時間
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 計算排程的下次執行時間
 */
function SR_calculateNextExecution(reminderData) {
  const now = moment().tz(TIMEZONE);
  const time = reminderData.time || SR_CONFIG.DEFAULT_REMINDER_TIME;
  const [hour, minute] = time.split(':');

  let nextExecution = now.clone().hour(hour).minute(minute).second(0);

  if (nextExecution.isBefore(now)) {
    nextExecution.add(1, 'day');
  }

  return nextExecution.toDate();
}

/**
 * 27. 建立提醒訊息
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 根據提醒資料建立格式化的提醒訊息
 */
function SR_buildReminderMessage(reminderData) {
  return `⏰ 記帳提醒

科目：${reminderData.subjectName}
建議金額：${reminderData.amount}元
支付方式：${reminderData.paymentMethod}

${reminderData.message || '記得記帳哦！'}

快速記帳格式：
${reminderData.subjectName}${reminderData.amount}`;
}

/**
 * 28. 檢查是否應該跳過執行
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 檢查是否因為週末或假日而跳過執行
 */
async function SR_shouldSkipExecution(reminderData) {
  const now = new Date();

  if (reminderData.skipWeekends) {
    const dayOfWeek = moment(now).day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { skip: true, reason: '跳過週末' };
    }
  }

  if (reminderData.skipHolidays) {
    const holidayResult = await SR_processHolidayLogic(now, 'skip');
    if (holidayResult.isHoliday) {
      return { skip: true, reason: '跳過國定假日' };
    }
  }

  return { skip: false, reason: null };
}

/**
 * 29. 建立每日摘要訊息
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 建立每日財務摘要的格式化訊息
 */
function SR_buildDailySummaryMessage(statsData) {
  if (!statsData) {
    return `📊 本日財務摘要

暫無記帳數據

💡 開始記帳以獲得個人化分析
輸入「統計」查看更多功能`;
  }

  const totalIncome = statsData.totalIncome || 0;
  const totalExpense = statsData.totalExpense || 0;
  const balance = totalIncome - totalExpense;

  return `📊 本日財務摘要 (${moment().tz(TIMEZONE).format('MM/DD')})

💰 收入：${totalIncome}元
💸 支出：${totalExpense}元
📈 淨額：${balance >= 0 ? '+' : ''}${balance}元

${balance >= 0 ? '✅ 本日收支平衡良好' : '⚠️ 本日支出大於收入'}

輸入「統計」查看詳細分析`;
}

/**
 * 30. 建立月度報告訊息
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 建立月度財務報告的格式化訊息
 */
function SR_buildMonthlyReportMessage(statsData) {
  if (!statsData) {
    return `📊 月度財務報告

暫無本月記帳數據

💡 開始記帳以獲得完整月度分析`;
  }

  const totalIncome = statsData.totalIncome || 0;
  const totalExpense = statsData.totalExpense || 0;
  const balance = totalIncome - totalExpense;

  return `📊 ${moment().tz(TIMEZONE).format('YYYY年MM月')} 財務報告

💰 總收入：${totalIncome}元
💸 總支出：${totalExpense}元
📈 月度結餘：${balance >= 0 ? '+' : ''}${balance}元

${balance >= 0 ? '✅ 本月收支狀況良好' : '⚠️ 本月支出大於收入'}`;
}

/**
 * 31. 建立統計回覆訊息
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 建立Quick Reply統計查詢的回覆訊息
 */
function SR_buildStatisticsReplyMessage(period, statsData) {
  const periodNames = {
    'today': '本日',
    'week': '本週', 
    'month': '本月'
  };

  const periodName = periodNames[period] || period;

  if (!statsData) {
    return `📊 ${periodName}統計

暫無記帳數據

💡 開始記帳以獲得統計分析`;
  }

  const totalIncome = statsData.totalIncome || 0;
  const totalExpense = statsData.totalExpense || 0;
  const balance = totalIncome - totalExpense;
  const recordCount = statsData.recordCount || 0;

  return `📊 ${periodName}統計

💰 收入：${totalIncome}元
💸 支出：${totalExpense}元  
📈 淨額：${balance >= 0 ? '+' : ''}${balance}元
📝 筆數：${recordCount}筆

${balance >= 0 ? '✅ 收支狀況良好' : '⚠️ 支出大於收入'}`;
}

/**
 * 32. 取得用戶提醒數量
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 查詢用戶當前的有效提醒數量
 */
async function SR_getUserReminderCount(userId) {
  try {
    const snapshot = await db.collection('scheduled_reminders')
      .where('userId', '==', userId)
      .where('active', '==', true)
      .get();

    return snapshot.size;
  } catch (error) {
    return 0;
  }
}

/**
 * 33. 生成升級訊息
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 根據違規類型生成升級提示訊息
 */
function SR_generateUpgradeMessage(violationType) {
  switch (violationType) {
    case 'MAX_REMINDERS':
      return `您已達到免費用戶的提醒數量上限 (${SR_CONFIG.MAX_FREE_REMINDERS}個)。升級至 Premium 可享無限提醒設定。`;
    case 'PUSH_DISABLED':
      return '自動推播功能需要 Premium 訂閱。升級後可享每日摘要、預算警示等自動通知。';
    default:
      return '此功能需要 Premium 訂閱。';
  }
}

/**
 * 34. 取得內建假日清單
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 提供內建的台灣假日清單作為備案
 */
async function SR_getBuiltInHolidays(year) {
  const holidays2025 = [
    { date: '2025-01-01', name: '元旦', type: 'national' },
    { date: '2025-02-10', name: '春節', type: 'national' },
    { date: '2025-02-11', name: '春節', type: 'national' },
    { date: '2025-02-12', name: '春節', type: 'national' },
    { date: '2025-04-04', name: '清明節', type: 'national' },
    { date: '2025-05-01', name: '勞動節', type: 'national' },
    { date: '2025-10-10', name: '國慶日', type: 'national' }
  ];

  return year === '2025' ? holidays2025 : [];
}

/**
 * 35. 智慧尋找下一個工作日
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 智慧尋找下一個非假日的工作日
 */
async function SR_findNextWorkday(date, timezone) {
  let nextDay = moment(date).tz(timezone).add(1, 'day');
  let maxAttempts = 10; // 防止無限循環

  while (maxAttempts > 0) {
    const holidayCheck = await SR_processHolidayLogic(nextDay.toDate(), 'skip', timezone);
    if (!holidayCheck.isWeekend && !holidayCheck.isHoliday) {
      return nextDay.toDate();
    }
    nextDay.add(1, 'day');
    maxAttempts--;
  }

  return nextDay.toDate(); // 返回最後嘗試的日期
}

/**
 * 36. 智慧尋找前一個工作日
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 智慧尋找前一個非假日的工作日
 */
async function SR_findPreviousWorkday(date, timezone) {
  let prevDay = moment(date).tz(timezone).subtract(1, 'day');
  let maxAttempts = 10; // 防止無限循環

  while (maxAttempts > 0) {
    const holidayCheck = await SR_processHolidayLogic(prevDay.toDate(), 'skip', timezone);
    if (!holidayCheck.isWeekend && !holidayCheck.isHoliday) {
      return prevDay.toDate();
    }
    prevDay.subtract(1, 'day');
    maxAttempts--;
  }

  return prevDay.toDate(); // 返回最後嘗試的日期
}

/**
 * 37. 檢查試用狀態 - 修復布爾值返回和數值計算邏輯
 * @version 2025-07-22-V1.6.0
 * @date 2025-07-22 15:00:00
 * @description 檢查用戶的試用期狀態和剩餘天數，確保返回嚴格的布爾值和正確的數值
 */
async function SR_checkTrialStatus(userId) {
  const functionName = "SR_checkTrialStatus";
  try {
    // 嚴格輸入驗證
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      SR_logError('用戶ID無效', "試用狀態", userId, "INVALID_USER_ID", "", functionName);
      return { 
        hasUsedTrial: false,  // 明確布爾false
        isInTrial: false,     // 明確布爾false
        daysRemaining: 0,
        hasTrialExpired: false  // 明確布爾false
      };
    }

    let userDoc;
    try {
      userDoc = await db.collection('users').doc(userId).get();
    } catch (dbError) {
      SR_logError(`資料庫查詢失敗: ${dbError.message}`, "試用狀態", userId, "DB_QUERY_ERROR", dbError.toString(), functionName);
      return { 
        hasUsedTrial: false,
        isInTrial: false,
        daysRemaining: 0,
        hasTrialExpired: false,
        error: '資料庫查詢失敗'
      };
    }

    if (!userDoc.exists) {
      SR_logInfo('用戶不存在，返回預設試用狀態', "試用狀態", userId, "", "", functionName);
      return { 
        hasUsedTrial: false,
        isInTrial: false,
        daysRemaining: 0,
        hasTrialExpired: false,
        source: 'user_not_exists'
      };
    }

    const userData = userDoc.data();
    const trial = userData.trial || {};

    // 檢查是否有試用記錄
    if (!trial.startDate) {
      SR_logInfo('用戶無試用記錄', "試用狀態", userId, "", "", functionName);
      return { 
        hasUsedTrial: false,
        isInTrial: false,
        daysRemaining: 0,
        hasTrialExpired: false,
        source: 'no_trial_record'
      };
    }

    // 計算試用期狀態
    let trialStart, trialEnd, now;
    try {
      trialStart = moment(trial.startDate.toDate());
      trialEnd = trialStart.clone().add(7, 'days');
      now = moment();
    } catch (dateError) {
      SR_logError(`日期計算錯誤: ${dateError.message}`, "試用狀態", userId, "DATE_ERROR", dateError.toString(), functionName);
      return { 
        hasUsedTrial: true,
        isInTrial: false,
        daysRemaining: 0,
        hasTrialExpired: true,
        error: '日期計算錯誤'
      };
    }

    // 嚴格布爾值計算
    const isCurrentlyInTrial = Boolean(now.isBefore(trialEnd) && now.isAfter(trialStart));
    const hasExpired = Boolean(now.isAfter(trialEnd));
    const daysLeft = Math.max(0, Math.floor(trialEnd.diff(now, 'days', true)));

    const result = {
      hasUsedTrial: true,          // 明確布爾true
      isInTrial: isCurrentlyInTrial,    // 明確布爾值
      daysRemaining: Number(daysLeft),
      hasTrialExpired: hasExpired,      // 明確布爾值
      startDate: trialStart.toDate(),
      endDate: trialEnd.toDate(),
      featuresUsed: Array.isArray(trial.featuresUsed) ? trial.featuresUsed : [],
      source: 'database_record'
    };

    SR_logInfo(`試用狀態: ${isCurrentlyInTrial ? '進行中' : (hasExpired ? '已過期' : '未開始')} (${daysLeft}天)`, 
              "試用狀態", userId, "", JSON.stringify(result), functionName);

    return result;

  } catch (error) {
    SR_logError(`檢查試用狀態失敗: ${error.message}`, "試用狀態", userId, "SR_TRIAL_ERROR", error.toString(), functionName);

    // 錯誤時的安全預設值
    return { 
      hasUsedTrial: false,  // 明確布爾false
      isInTrial: false,     // 明確布爾false
      daysRemaining: 0,
      hasTrialExpired: false,  // 明確布爾false
      error: error.message
    };
  }
}

/**
 * 38. 檢查功能配額 - 修復配額檢查和布爾值返回邏輯
 * @version 2025-07-22-V1.6.0
 * @date 2025-07-22 15:00:00
 * @description 檢查用戶的功能使用配額和可用性，確保返回嚴格的布爾值和正確的配額邏輯
 */
async function SR_checkFeatureQuota(userId, featureName, maxQuota) {
  const functionName = "SR_checkFeatureQuota";
  try {
    // 嚴格參數驗證
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      SR_logError('用戶ID無效', "配額檢查", userId, "INVALID_USER_ID", "", functionName);
      return { 
        available: false,  // 明確布爾false
        used: 0, 
        limit: Number(maxQuota) || 0,
        error: '無效的用戶ID'
      };
    }

    if (!featureName || typeof featureName !== 'string') {
      SR_logError('功能名稱無效', "配額檢查", userId, "INVALID_FEATURE_NAME", "", functionName);
      return { 
        available: false,  // 明確布爾false
        used: 0, 
        limit: Number(maxQuota) || 0,
        error: '無效的功能名稱'
      };
    }

    const quotaLimit = Number(maxQuota) || 0;
    if (quotaLimit <= 0) {
      SR_logError(`配額限制無效: ${maxQuota}`, "配額檢查", userId, "INVALID_QUOTA", "", functionName);
      return { 
        available: false,  // 明確布爾false
        used: 0, 
        limit: 0,
        error: '無效的配額限制'
      };
    }

    // CREATE_REMINDER 功能的配額檢查
    if (featureName === 'CREATE_REMINDER') {
      let usedCount = 0;

      try {
        const used = await SR_getUserReminderCount(userId);
        usedCount = Number(used) || 0;

        // 確保數值有效性
        if (usedCount < 0) {
          usedCount = 0;
        }

      } catch (countError) {
        SR_logError(`取得提醒數量失敗: ${countError.message}`, "配額檢查", userId, "COUNT_ERROR", countError.toString(), functionName);
        usedCount = quotaLimit; // 安全起見，假設已達上限
      }

      const isAvailable = Boolean(usedCount < quotaLimit);

      const result = {
        available: isAvailable,  // 明確布爾值
        used: usedCount,
        limit: quotaLimit,
        nextResetDate: null, // 提醒配額不重置
        featureName: featureName
      };

      SR_logInfo(`配額檢查結果: ${isAvailable ? '可用' : '已滿'} (${usedCount}/${quotaLimit})`, 
                "配額檢查", userId, "", JSON.stringify(result), functionName);

      return result;
    }

    // 其他功能的配額檢查 - 預設無限制
    const otherFeatureResult = { 
      available: true,  // 明確布爾true
      used: 0, 
      limit: quotaLimit,
      featureName: featureName
    };

    SR_logInfo(`其他功能配額檢查: 無限制`, "配額檢查", userId, "", JSON.stringify(otherFeatureResult), functionName);

    return otherFeatureResult;

  } catch (error) {
    SR_logError(`檢查功能配額失敗: ${error.message}`, "配額檢查", userId, "SR_QUOTA_ERROR", error.toString(), functionName);

    // 錯誤時的安全預設值
    return { 
      available: false,  // 明確布爾false
      used: 0, 
      limit: Number(maxQuota) || 0,
      error: error.message,
      featureName: featureName || 'unknown'
    };
  }
}

/**
 * 39. 記錄功能使用
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 記錄用戶的功能使用情況
 */
async function SR_recordFeatureUsage(userId, featureName, context) {
  try {
    await db.collection('feature_usage').add({
      userId,
      featureName,
      timestamp: admin.firestore.Timestamp.now(),
      context: context || {}
    });
  } catch (error) {
    // 靜默處理記錄失敗
  }
}

/**
 * 40. 啟用付費功能
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 為用戶啟用付費功能
 */
async function SR_enablePremiumFeatures(userId) {
  try {
    // 這裡可以添加啟用付費功能的邏輯
    SR_logInfo(`啟用付費功能: ${userId}`, "功能啟用", userId, "", "", "SR_enablePremiumFeatures");
  } catch (error) {
    SR_logError(`啟用付費功能失敗: ${error.message}`, "功能啟用", userId, "SR_ENABLE_ERROR", error.toString(), "SR_enablePremiumFeatures");
  }
}

/**
 * 41. 記錄 Quick Reply 互動
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 記錄Quick Reply的用戶互動日誌
 */
async function SR_logQuickReplyInteraction(userId, postbackData, response, metadata = {}) {
  try {
    await db.collection('quick_reply_logs').add({
      userId,
      postbackData,
      success: response.success,
      timestamp: admin.firestore.Timestamp.now(),
      responseType: response.quickReply ? 'with_quick_reply' : 'text_only',
      interactionType: metadata.interactionType,
      error: metadata.error
    });
  } catch (error) {
    // 靜默記錄失敗，不影響主流程
  }
}

/**
 * 42. 計算下次執行時間（考慮跳過邏輯）
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 計算考慮假日跳過邏輯的下次執行時間
 */
async function SR_calculateNextExecutionWithSkip(reminderData) {
  const baseNext = SR_calculateNextExecution(reminderData);

  if (reminderData.skipWeekends || reminderData.skipHolidays) {
    const holidayResult = await SR_processHolidayLogic(baseNext, 'next_workday');
    return holidayResult.adjustedDate;
  }

  return baseNext;
}

/**
 * 43. 直接統計查詢函數 - 不依賴DD1模組
 * @version 2025-07-22-V1.4.1  
 * @date 2025-07-22 12:00:00
 * @description 直接查詢Firestore取得統計資料，確保使用正確的用戶帳本路徑
 */
async function SR_getDirectStatistics(userId, period) {
  const functionName = "SR_getDirectStatistics";
  try {
    SR_logInfo(`直接查詢統計資料: ${period}`, "統計查詢", userId, "", "", functionName);

    const ledgerId = `user_${userId}`;
    const now = moment().tz(TIMEZONE);
    let startDate, endDate;

    // 設定查詢時間範圍
    switch (period) {
      case 'daily':
        startDate = now.clone().startOf('day').toDate();
        endDate = now.clone().endOf('day').toDate();
        break;
      case 'weekly':  
        startDate = now.clone().startOf('week').toDate();
        endDate = now.clone().endOf('week').toDate();
        break;
      case 'monthly':
        startDate = now.clone().startOf('month').toDate();
        endDate = now.clone().endOf('month').toDate();
        break;
      default:
        startDate = now.clone().startOf('day').toDate();
        endDate = now.clone().endOf('day').toDate();
    }

    // 查詢Firestore entries集合
    const entriesRef = db.collection('ledgers').doc(ledgerId).collection('entries');
    const snapshot = await entriesRef
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .get();

    if (snapshot.empty) {
      SR_logInfo(`無統計資料: ${period}`, "統計查詢", userId, "", "", functionName);
      return {
        success: true,
        data: {
          totalIncome: 0,
          totalExpense: 0,
          recordCount: 0
        }
      };
    }

    // 計算統計資料
    let totalIncome = 0;
    let totalExpense = 0;
    let recordCount = snapshot.size;

    snapshot.forEach(doc => {
      const data = doc.data();
      const income = parseFloat(data.收入 || 0);
      const expense = parseFloat(data.支出 || 0);

      totalIncome += income;
      totalExpense += expense;
    });

    const statsData = {
      totalIncome,
      totalExpense,
      recordCount
    };

    SR_logInfo(`統計查詢成功: 收入${totalIncome}，支出${totalExpense}，${recordCount}筆`, "統計查詢", userId, "", "", functionName);

    return {
      success: true,
      data: statsData
    };

  } catch (error) {
    SR_logError(`直接統計查詢失敗: ${error.message}`, "統計查詢", userId, "SR_STATS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      data: {
        totalIncome: 0,
        totalExpense: 0, 
        recordCount: 0
      }
    };
  }
}

/**
 * 44. 統一統計查詢入口 - 階段一擴展版
 * @version 2025-12-26-V1.7.0
 * @date 2025-12-26 15:00:00
 * @description 統一的統計查詢入口，支援LBK模組統計關鍵字識別和完整統計處理
 */
async function SR_processStatisticsQuery(inputData) {
  const functionName = "SR_processStatisticsQuery";
  const processId = inputData.processId || Date.now().toString(36);
  const userId = inputData.userId;

  try {
    SR_logInfo(`統一統計查詢入口: ${inputData.statisticsType || 'general'}`, "統計查詢", userId, "", "", functionName);

    // 檢查統計功能權限
    const permissionCheck = await SR_validatePremiumFeature(userId, 'BASIC_STATISTICS');
    if (!permissionCheck.allowed) {
      return await SR_handlePaywallQuickReply(userId, 'blocked', { 
        blockedFeature: '統計查詢',
        reason: permissionCheck.reason 
      });
    }

    // 獲取統計資料
    const statsResult = await SR_getStatisticsData(userId, inputData.statisticsType, processId);

    // 建立統計報表訊息
    const replyMessage = await SR_buildStatisticsMessage(statsResult, inputData.statisticsType, processId);

    // 生成動態Quick Reply按鈕
    const quickReplyButtons = await SR_generateStatisticsQuickReply(userId, inputData.statisticsType, processId);

    SR_logInfo(`統計查詢完成: ${inputData.statisticsType}`, "統計查詢", userId, "", "", functionName);

    return {
      success: true,
      message: replyMessage,
      responseMessage: replyMessage,
      quickReply: quickReplyButtons,
      moduleCode: "SR",
      module: "SR",
      processingTime: (Date.now() - parseInt(processId, 36)) / 1000,
      moduleVersion: "1.7.0",
      statisticsHandled: true,
      statisticsType: inputData.statisticsType
    };

  } catch (error) {
    SR_logError(`統計查詢入口處理失敗: ${error.message}`, "統計查詢", userId, "SR_STATS_QUERY_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: "統計查詢處理失敗，請稍後再試",
      responseMessage: "統計查詢處理失敗，請稍後再試",
      moduleCode: "SR",
      module: "SR",
      processingTime: 0,
      moduleVersion: "1.7.0",
      errorType: "SR_STATS_QUERY_ERROR"
    };
  }
}

/**
 * 45. 時間範圍計算與資料查詢
 * @version 2025-12-26-V1.7.0
 * @date 2025-12-26 15:00:00
 * @description 根據統計類型計算時間範圍並查詢統計資料
 */
async function SR_getStatisticsData(userId, statisticsType, processId) {
  const functionName = "SR_getStatisticsData";
  
  try {
    SR_logInfo(`取得統計資料: ${statisticsType}`, "統計資料", userId, "", "", functionName);

    const ledgerId = `user_${userId}`;
    const now = moment().tz(TIMEZONE);
    let startDate, endDate, period;

    // 根據統計類型設定時間範圍
    switch (statisticsType) {
      case 'daily_statistics':
      case 'general_statistics':
        period = 'daily';
        startDate = now.clone().startOf('day').toDate();
        endDate = now.clone().endOf('day').toDate();
        break;
        
      case 'weekly_statistics':
        period = 'weekly';
        startDate = now.clone().startOf('week').toDate();
        endDate = now.clone().endOf('week').toDate();
        break;
        
      case 'monthly_statistics':
        period = 'monthly';
        startDate = now.clone().startOf('month').toDate();
        endDate = now.clone().endOf('month').toDate();
        break;
        
      case 'yearly_statistics':
        period = 'yearly';
        startDate = now.clone().startOf('year').toDate();
        endDate = now.clone().endOf('year').toDate();
        break;
        
      default:
        period = 'daily';
        startDate = now.clone().startOf('day').toDate();
        endDate = now.clone().endOf('day').toDate();
    }

    // 查詢transactions集合資料
    const transactionsRef = db.collection('ledgers').doc(ledgerId).collection('transactions');
    const snapshot = await transactionsRef
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .get();

    let totalIncome = 0;
    let totalExpense = 0;
    let recordCount = snapshot.size;

    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount || 0);
      
      if (data.type === 'income') {
        totalIncome += amount;
      } else if (data.type === 'expense') {
        totalExpense += amount;
      }
    });

    const statsData = {
      period,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      recordCount,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };

    SR_logInfo(`統計資料取得完成: 收入${totalIncome}，支出${totalExpense}，${recordCount}筆`, "統計資料", userId, "", "", functionName);

    return {
      success: true,
      data: statsData
    };

  } catch (error) {
    SR_logError(`取得統計資料失敗: ${error.message}`, "統計資料", userId, "SR_GET_STATS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      data: {
        period: 'unknown',
        totalIncome: 0,
        totalExpense: 0,
        netAmount: 0,
        recordCount: 0
      }
    };
  }
}

/**
 * 46. 統計報表格式化
 * @version 2025-12-26-V1.7.0
 * @date 2025-12-26 15:00:00
 * @description 根據統計資料和類型格式化統計報表訊息
 */
async function SR_buildStatisticsMessage(statsResult, statisticsType, processId) {
  const functionName = "SR_buildStatisticsMessage";
  
  try {
    const currentDateTime = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    // 統計類型標題映射
    const typeLabels = {
      'daily_statistics': '本日',
      'general_statistics': '本日',
      'weekly_statistics': '本週',
      'monthly_statistics': '本月',
      'yearly_statistics': '本年'
    };

    const periodLabel = typeLabels[statisticsType] || '本日';

    if (!statsResult || !statsResult.success || !statsResult.data) {
      return `📊 ${periodLabel}統計報表

暫無統計資料

💡 開始記帳以獲得統計分析
⏰ 查詢時間：${currentDateTime}`;
    }

    const data = statsResult.data;
    const netAmount = data.netAmount || 0;

    let message = `📊 ${periodLabel}統計報表\n\n`;
    message += `💰 總收入：${data.totalIncome || 0} 元\n`;
    message += `💸 總支出：${data.totalExpense || 0} 元\n`;
    message += `📈 淨收支：${netAmount >= 0 ? '+' : ''}${netAmount} 元\n`;
    message += `📝 交易筆數：${data.recordCount || 0} 筆\n\n`;
    message += `${netAmount >= 0 ? '✅ 收支狀況良好' : '⚠️ 支出大於收入'}\n\n`;
    message += `⏰ 查詢時間：${currentDateTime}`;

    SR_logInfo(`統計報表格式化完成: ${periodLabel}統計`, "統計報表", "", "", "", functionName);
    
    return message;

  } catch (error) {
    SR_logError(`統計報表格式化失敗: ${error.message}`, "統計報表", "", "SR_BUILD_MSG_ERROR", error.toString(), functionName);
    return `📊 統計查詢失敗\n\n系統暫時無法處理統計請求，請稍後再試`;
  }
}

/**
 * 47. 動態按鈕生成
 * @version 2025-12-26-V1.7.0
 * @date 2025-12-26 15:00:00
 * @description 根據統計類型和用戶權限動態生成Quick Reply按鈕
 */
async function SR_generateStatisticsQuickReply(userId, currentStatisticsType, processId) {
  const functionName = "SR_generateStatisticsQuickReply";
  
  try {
    SR_logInfo(`生成統計Quick Reply: ${currentStatisticsType}`, "Quick Reply", userId, "", "", functionName);

    // 取得用戶訂閱狀態
    const subscriptionStatus = await SR_checkSubscriptionStatus(userId);
    const trialStatus = await SR_checkTrialStatus(userId);
    const hasPremiumAccess = subscriptionStatus.isPremium || trialStatus.isInTrial;

    let quickReplyItems = [];

    // 基礎統計選項（所有用戶可用）
    if (currentStatisticsType !== 'general_statistics') {
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'postback',
          label: '📊 本日統計',
          data: 'general_statistics',
          displayText: '本日統計'
        }
      });
    }

    if (currentStatisticsType !== 'weekly_statistics') {
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'postback',
          label: '📅 本週統計',
          data: 'weekly_statistics',
          displayText: '本週統計'
        }
      });
    }

    if (currentStatisticsType !== 'monthly_statistics') {
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'postback',
          label: '📈 本月統計',
          data: 'monthly_statistics',
          displayText: '本月統計'
        }
      });
    }

    // Premium用戶額外選項
    if (hasPremiumAccess) {
      if (currentStatisticsType !== 'yearly_statistics') {
        quickReplyItems.push({
          type: 'action',
          action: {
            type: 'postback',
            label: '📋 本年統計',
            data: 'yearly_statistics',
            displayText: '本年統計'
          }
        });
      }
    } else {
      // 免費用戶升級提示
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'postback',
          label: '⭐ 升級會員',
          data: 'upgrade_premium',
          displayText: '升級會員'
        }
      });
    }

    // 限制按鈕數量（LINE限制最多13個）
    quickReplyItems = quickReplyItems.slice(0, 4);

    const quickReply = {
      items: quickReplyItems
    };

    SR_logInfo(`生成${quickReplyItems.length}個統計Quick Reply選項`, "Quick Reply", userId, "", "", functionName);

    return quickReply;

  } catch (error) {
    SR_logError(`生成統計Quick Reply失敗: ${error.message}`, "Quick Reply", userId, "SR_QR_GEN_ERROR", error.toString(), functionName);
    
    // 錯誤時返回基本選項
    return {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📊 本日統計',
            data: 'general_statistics',
            displayText: '本日統計'
          }
        }
      ]
    };
  }
}

/**
 * 48. 處理快速統計查詢 - 保持向後相容
 * @version 2025-12-26-V1.7.0
 * @date 2025-12-26 15:00:00
 * @description 為LBK模組提供統一的統計查詢接口，內部調用新的統計處理函數
 */
async function SR_processQuickStatistics(inputData) {
  const functionName = "SR_processQuickStatistics";
  
  try {
    SR_logInfo(`快速統計查詢（相容模式）: ${inputData.statisticsType || 'general'}`, "統計查詢", inputData.userId, "", "", functionName);
    
    // 調用新的統一統計查詢入口
    return await SR_processStatisticsQuery(inputData);

  } catch (error) {
    SR_logError(`快速統計查詢失敗: ${error.message}`, "統計查詢", inputData.userId, "SR_QUICK_STATS_ERROR", error.toString(), functionName);
    
    return {
      success: false,
      message: "統計查詢處理失敗，請稍後再試",
      responseMessage: "統計查詢處理失敗，請稍後再試",
      moduleCode: "SR",
      module: "SR",
      processingTime: 0,
      moduleVersion: "1.7.0",
      errorType: "SR_QUICK_STATS_ERROR"
    };
  }
}

/**
 * 45. 模組初始化函數
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description SR模組的初始化設定和啟動流程
 */
async function SR_initialize() {
  const functionName = "SR_initialize";
  try {
    console.log('📅 SR 排程提醒模組初始化中...');

    // 檢查 Firestore 連線
    if (!admin.apps.length) {
      // 修正Firebase初始化邏輯
      firebaseConfig.initializeFirebaseAdmin();
    }

    // 檢查依賴模組
    if (!DL) {
      console.warn('⚠️ DL 模組不可用，將使用基本日誌');
    }

    if (!WH) {
      console.warn('⚠️ WH 模組不可用，推播功能將受限');
    }

    // 載入現有的排程設定
    await SR_loadExistingSchedules();

    // 設定模組初始化狀態
    SR_INIT_STATUS.initialized = true;
    SR_INIT_STATUS.firestoreConnected = true;
    SR_INIT_STATUS.schedulerRunning = true;
    SR_INIT_STATUS.lastInitTime = new Date();

    SR_logInfo("SR 排程提醒模組初始化完成", "模組初始化", "", "", "", functionName);
    console.log('✅ SR 排程提醒模組已成功啟動');

    return true;
  } catch (error) {
    SR_logError(`SR 模組初始化失敗: ${error.message}`, "模組初始化", "", "SR_INIT_ERROR", error.toString(), functionName);
    console.error('❌ SR 排程提醒模組初始化失敗:', error);
    return false;
  }
}

/**
 * 45. 載入現有排程設定
 * @version 2025-01-09-V1.4.0
 * @date 2025-01-09 22:00:00
 * @description 載入並恢復現有的排程設定到記憶體
 */
async function SR_loadExistingSchedules() {
  try {
    const snapshot = await db.collection('scheduled_reminders')
      .where('active', '==', true)
      .get();

    snapshot.forEach(doc => {
      const data = doc.data();

      try {
        const cronJob = cron.schedule(data.cronExpression, async () => {
          await SR_executeScheduledTask(data.reminderId);
        }, {
          scheduled: true,
          timezone: TIMEZONE
        });

        SR_INIT_STATUS.activeSchedules.set(data.reminderId, cronJob);
      } catch (cronError) {
        console.error(`載入排程失敗: ${data.reminderId}`, cronError);
      }
    });

    console.log(`📅 已載入 ${SR_INIT_STATUS.activeSchedules.size} 個排程設定`);
  } catch (error) {
    console.error('載入現有排程失敗:', error);
  }
}

// 導出模組函數
module.exports = {
  // 排程管理層函數 (6個函數)
  SR_createScheduledReminder,
  SR_updateScheduledReminder,
  SR_deleteScheduledReminder,
  SR_executeScheduledTask,
  SR_processHolidayLogic,
  SR_getGovernmentHolidays,

  // 付費功能控制層函數
  SR_validatePremiumFeature,
  SR_checkSubscriptionStatus,
  SR_enforceFreeUserLimits,
  SR_upgradeFeatureAccess,

  // 推播服務層函數
  SR_sendDailyFinancialSummary,
  SR_sendBudgetWarning,
  SR_sendMonthlyReport,
  SR_processQuickReplyStatistics,

  // 數據整合層函數
  SR_syncWithAccountModule,
  SR_syncWithDataDistribution,
  SR_logScheduledActivity,
  SR_handleSchedulerError,

  // Quick Reply 專用層函數
  SR_handleQuickReplyInteraction,
  SR_generateQuickReplyOptions,
  SR_handlePaywallQuickReply,

  // 模組初始化
  SR_initialize,

  // 階段一：新增完整統計查詢函數
  SR_processStatisticsQuery,
  SR_getStatisticsData,
  SR_buildStatisticsMessage,
  SR_generateStatisticsQuickReply,
  SR_getDirectStatistics,
  SR_processQuickStatistics,

  // 常數與配置
  SR_CONFIG,
  SR_QUICK_REPLY_CONFIG,
  SR_INIT_STATUS
};

// 自動初始化模組
SR_initialize().catch(error => {
  console.error('SR 模組自動初始化失敗:', error);
});