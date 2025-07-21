
/**
 * SR_排程提醒模組_1.0.0
 * @module SR排程提醒模組
 * @description LCAS 2.0 排程提醒系統 - 智慧記帳自動化核心功能
 * @update 2025-07-21: 初版建立，實現定期記帳提醒、自動推播、Quick Reply統計查詢及付費功能控制機制
 */

const admin = require('firebase-admin');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 引入依賴模組
let DL, WH, AM, FS, DD1, BK, LBK;
try {
  DL = require('./2010. DL.js');
  WH = require('./2020. WH.js');
  AM = require('./2009. AM.js');
  FS = require('./2011. FS.js');
  DD1 = require('./2031. DD1.js');
  BK = require('./2001. BK.js');
  LBK = require('./2015. LBK.js');
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
    TODAY: { label: '今日統計', postbackData: '今日統計' },
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
 * 日誌函數封裝
 */
function SR_logInfo(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_info === 'function') {
    DL.DL_info(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.log(`[SR-INFO] ${message}`);
  }
}

function SR_logError(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_error === 'function') {
    DL.DL_error(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.error(`[SR-ERROR] ${message}`, errorDetails);
  }
}

function SR_logWarning(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_warning === 'function') {
    DL.DL_warning(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.warn(`[SR-WARNING] ${message}`);
  }
}

// =============== 排程管理層函數 (6個) ===============

/**
 * 01. 建立排程提醒設定
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 為用戶建立新的排程提醒設定，支援付費功能限制檢查
 */
async function SR_createScheduledReminder(userId, reminderData) {
  const functionName = "SR_createScheduledReminder";
  try {
    SR_logInfo(`開始建立排程提醒: ${userId}`, "建立提醒", userId, "", "", functionName);

    // 檢查付費功能權限
    const permissionCheck = await SR_validatePremiumFeature(userId, 'CREATE_REMINDER');
    if (!permissionCheck.allowed) {
      return {
        success: false,
        error: '已達到免費用戶提醒數量限制',
        errorCode: 'PREMIUM_REQUIRED',
        upgradeRequired: true
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
 * 04. 執行到期的排程任務
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 執行排程提醒任務
 */
async function SR_executeScheduledTask(reminderId) {
  const functionName = "SR_executeScheduledTask";
  try {
    SR_logInfo(`執行排程任務: ${reminderId}`, "執行任務", "", "", "", functionName);

    // 取得提醒資料
    const reminderDoc = await db.collection('scheduled_reminders').doc(reminderId).get();
    if (!reminderDoc.exists) {
      throw new Error('提醒不存在');
    }

    const reminderData = reminderDoc.data();
    
    // 檢查是否需要跳過（週末、假日）
    const skipExecution = await SR_shouldSkipExecution(reminderData);
    if (skipExecution.skip) {
      SR_logInfo(`跳過執行: ${skipExecution.reason}`, "執行任務", reminderData.userId, "", "", functionName);
      return {
        executed: false,
        reason: skipExecution.reason
      };
    }

    // 建立提醒訊息
    const reminderMessage = SR_buildReminderMessage(reminderData);

    // 發送提醒 - 透過 WH 模組發送 LINE 訊息
    if (WH && typeof WH.WH_sendPushMessage === 'function') {
      await WH.WH_sendPushMessage(reminderData.userId, reminderMessage);
    }

    // 更新執行記錄
    await reminderDoc.ref.update({
      lastExecution: admin.firestore.Timestamp.now(),
      nextExecution: admin.firestore.Timestamp.fromDate(SR_calculateNextExecution(reminderData)),
      executionCount: admin.firestore.FieldValue.increment(1)
    });

    SR_logInfo(`排程任務執行成功: ${reminderId}`, "執行任務", reminderData.userId, "", "", functionName);

    return {
      executed: true,
      message: '提醒發送成功'
    };

  } catch (error) {
    SR_logError(`執行排程任務失敗: ${error.message}`, "執行任務", "", "SR_EXECUTE_ERROR", error.toString(), functionName);
    return {
      executed: false,
      error: error.message
    };
  }
}

/**
 * 05. 處理國定假日邏輯
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 檢查是否為國定假日並處理排程邏輯
 */
async function SR_processHolidayLogic(date, holidayHandling = 'skip') {
  const functionName = "SR_processHolidayLogic";
  try {
    // 檢查是否為週末
    const dayOfWeek = moment(date).day();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 簡化版假日檢查（實際應用可整合政府假日API）
    const holidays2025 = [
      '2025-01-01', // 元旦
      '2025-02-10', '2025-02-11', '2025-02-12', // 春節
      '2025-04-04', // 清明節
      '2025-05-01', // 勞動節
      '2025-10-10'  // 國慶日
    ];

    const dateStr = moment(date).format('YYYY-MM-DD');
    const isHoliday = holidays2025.includes(dateStr);

    let adjustedDate = date;
    let shouldSkip = false;

    if (isWeekend || isHoliday) {
      switch (holidayHandling) {
        case 'skip':
          shouldSkip = true;
          break;
        case 'next_workday':
          // 找到下一個工作日
          let nextDay = moment(date).add(1, 'day');
          while (nextDay.day() === 0 || nextDay.day() === 6 || holidays2025.includes(nextDay.format('YYYY-MM-DD'))) {
            nextDay.add(1, 'day');
          }
          adjustedDate = nextDay.toDate();
          break;
        case 'previous_workday':
          // 找到前一個工作日
          let prevDay = moment(date).subtract(1, 'day');
          while (prevDay.day() === 0 || prevDay.day() === 6 || holidays2025.includes(prevDay.format('YYYY-MM-DD'))) {
            prevDay.subtract(1, 'day');
          }
          adjustedDate = prevDay.toDate();
          break;
      }
    }

    return {
      isWeekend,
      isHoliday,
      shouldSkip,
      adjustedDate,
      originalDate: date
    };

  } catch (error) {
    SR_logError(`處理假日邏輯失敗: ${error.message}`, "假日處理", "", "SR_HOLIDAY_ERROR", error.toString(), functionName);
    return {
      isWeekend: false,
      isHoliday: false,
      shouldSkip: false,
      adjustedDate: date,
      originalDate: date
    };
  }
}

/**
 * 06. 智慧時間最佳化（付費功能）
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 基於用戶使用習慣最佳化提醒時間
 */
async function SR_optimizeReminderTime(userId, reminderId) {
  const functionName = "SR_optimizeReminderTime";
  try {
    // 檢查付費功能權限
    const permissionCheck = await SR_validatePremiumFeature(userId, 'OPTIMIZE_TIME');
    if (!permissionCheck.allowed) {
      return {
        optimized: false,
        error: '此功能需要 Premium 訂閱',
        upgradeRequired: true
      };
    }

    SR_logInfo(`最佳化提醒時間: ${reminderId}`, "時間最佳化", userId, "", "", functionName);

    // 分析用戶活躍時間模式（簡化版）
    const userPattern = await SR_analyzeUserActivePattern(userId);
    
    // 建議最佳提醒時間
    const optimalTime = SR_calculateOptimalTime(userPattern);

    return {
      optimized: true,
      currentTime: userPattern.currentReminderTime,
      suggestedTime: optimalTime,
      confidence: userPattern.confidence,
      reasoning: optimalTime.reasoning
    };

  } catch (error) {
    SR_logError(`時間最佳化失敗: ${error.message}`, "時間最佳化", userId, "SR_OPTIMIZE_ERROR", error.toString(), functionName);
    return {
      optimized: false,
      error: error.message
    };
  }
}

// =============== 付費功能控制層函數 (4個) ===============

/**
 * 07. 驗證付費功能權限
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 檢查用戶是否有權限使用特定付費功能
 */
async function SR_validatePremiumFeature(userId, featureName) {
  const functionName = "SR_validatePremiumFeature";
  try {
    // 取得用戶訂閱狀態
    const subscriptionStatus = await SR_checkSubscriptionStatus(userId);
    
    // 免費用戶功能限制
    const freeFeatures = ['CREATE_REMINDER', 'BASIC_STATISTICS'];
    const premiumFeatures = ['AUTO_PUSH', 'OPTIMIZE_TIME', 'UNLIMITED_REMINDERS'];

    if (subscriptionStatus.isPremium) {
      return {
        allowed: true,
        reason: 'Premium user',
        featureType: 'premium'
      };
    }

    // 檢查免費功能
    if (freeFeatures.includes(featureName)) {
      // 檢查免費用戶限制
      if (featureName === 'CREATE_REMINDER') {
        const currentReminders = await SR_getUserReminderCount(userId);
        if (currentReminders >= SR_CONFIG.MAX_FREE_REMINDERS) {
          return {
            allowed: false,
            reason: `免費用戶最多只能設定 ${SR_CONFIG.MAX_FREE_REMINDERS} 個提醒`,
            upgradeRequired: true
          };
        }
      }
      
      return {
        allowed: true,
        reason: 'Free feature',
        featureType: 'free'
      };
    }

    // 付費功能需要升級
    return {
      allowed: false,
      reason: '此功能需要 Premium 訂閱',
      upgradeRequired: true,
      featureType: 'premium'
    };

  } catch (error) {
    SR_logError(`驗證付費功能失敗: ${error.message}`, "權限驗證", userId, "SR_VALIDATE_ERROR", error.toString(), functionName);
    return {
      allowed: false,
      reason: '驗證失敗',
      error: error.message
    };
  }
}

/**
 * 08. 檢查訂閱狀態
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 查詢用戶的訂閱狀態和權限
 */
async function SR_checkSubscriptionStatus(userId) {
  const functionName = "SR_checkSubscriptionStatus";
  try {
    // 透過 AM 模組查詢用戶訂閱狀態
    if (AM && typeof AM.AM_getUserInfo === 'function') {
      const userInfo = await AM.AM_getUserInfo(userId, userId, true);
      
      if (userInfo.success) {
        // 檢查訂閱資訊（簡化版）
        const subscription = userInfo.userData.subscription || {};
        
        return {
          isPremium: subscription.type === 'premium',
          subscriptionType: subscription.type || 'free',
          expiresAt: subscription.expiresAt,
          features: subscription.features || []
        };
      }
    }

    // 預設為免費用戶
    return {
      isPremium: false,
      subscriptionType: 'free',
      expiresAt: null,
      features: ['basic_reminders', 'manual_statistics']
    };

  } catch (error) {
    SR_logError(`檢查訂閱狀態失敗: ${error.message}`, "訂閱檢查", userId, "SR_SUBSCRIPTION_ERROR", error.toString(), functionName);
    return {
      isPremium: false,
      subscriptionType: 'free',
      expiresAt: null,
      features: []
    };
  }
}

/**
 * 09. 強制免費用戶限制
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
      advancedAnalytics: false,
      optimizations: false
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
        'smart_optimization',
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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

    // 透過 DD 模組取得今日統計
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
 * 14. 處理 Quick Reply 統計
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 處理統計相關的 Quick Reply 互動
 */
async function SR_processQuickReplyStatistics(userId, postbackData) {
  const functionName = "SR_processQuickReplyStatistics";
  try {
    SR_logInfo(`處理Quick Reply統計: ${postbackData}`, "Quick Reply", userId, "", "", functionName);

    let statsResult = null;
    let period = '';

    // 根據 postback 資料取得對應統計
    switch (postbackData) {
      case '今日統計':
        period = 'today';
        if (DD1 && typeof DD1.DD_getStatistics === 'function') {
          const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
          statsResult = await DD1.DD_getStatistics(userId, 'daily', { date: today });
        }
        break;
      
      case '本週統計':
        period = 'week';
        if (DD1 && typeof DD1.DD_getStatistics === 'function') {
          const weekStart = moment().tz(TIMEZONE).startOf('week').format('YYYY-MM-DD');
          const weekEnd = moment().tz(TIMEZONE).endOf('week').format('YYYY-MM-DD');
          statsResult = await DD1.DD_getStatistics(userId, 'weekly', { startDate: weekStart, endDate: weekEnd });
        }
        break;
      
      case '本月統計':
        period = 'month';
        if (DD1 && typeof DD1.DD_getStatistics === 'function') {
          const thisMonth = moment().tz(TIMEZONE).format('YYYY-MM');
          statsResult = await DD1.DD_getStatistics(userId, 'monthly', { month: thisMonth });
        }
        break;
    }

    // 建立統計回覆訊息
    const replyMessage = SR_buildStatisticsReplyMessage(period, statsResult?.data);

    // 建立 Quick Reply 按鈕
    const quickReplyButtons = SR_generateQuickReplyOptions(userId, 'statistics');

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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
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
      case "cron_job_failed":
        recoveryAction = "restart_scheduler";
        // 重新啟動失敗的 cron job
        if (context.reminderId) {
          setTimeout(() => {
            SR_restartFailedSchedule(context.reminderId);
          }, 5000);
        }
        break;

      case "notification_failed":
        recoveryAction = "retry_notification";
        // 3分鐘後重試通知
        if (context.userId && context.message) {
          setTimeout(() => {
            if (WH && typeof WH.WH_sendPushMessage === 'function') {
              WH.WH_sendPushMessage(context.userId, context.message);
            }
          }, 180000);
        }
        break;

      case "database_error":
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
 * 19. 統一處理 Quick Reply 互動
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 統一處理所有 Quick Reply 相關互動
 */
async function SR_handleQuickReplyInteraction(userId, postbackData, messageContext) {
  const functionName = "SR_handleQuickReplyInteraction";
  try {
    SR_logInfo(`處理Quick Reply互動: ${postbackData}`, "Quick Reply", userId, "", "", functionName);

    let response = null;

    // 根據 postback 資料判斷處理類型
    if (['今日統計', '本週統計', '本月統計'].includes(postbackData)) {
      // 統計查詢
      response = await SR_processQuickReplyStatistics(userId, postbackData);
      
    } else if (postbackData === 'upgrade_premium') {
      // 付費升級
      response = await SR_handlePaywallQuickReply(userId, 'upgrade', messageContext);
      
    } else if (postbackData === '試用') {
      // 免費試用
      response = await SR_handlePaywallQuickReply(userId, 'trial', messageContext);
      
    } else if (postbackData === '功能介紹') {
      // 功能介紹
      response = await SR_handlePaywallQuickReply(userId, 'info', messageContext);
      
    } else {
      // 未知的 postback
      response = {
        success: false,
        message: '抱歉，無法識別您的選擇，請重新操作',
        quickReply: SR_generateQuickReplyOptions(userId, 'default')
      };
    }

    // 記錄互動
    await SR_logQuickReplyInteraction(userId, postbackData, response);

    return response;

  } catch (error) {
    SR_logError(`處理Quick Reply互動失敗: ${error.message}`, "Quick Reply", userId, "SR_INTERACTION_ERROR", error.toString(), functionName);
    
    return {
      success: false,
      message: '系統暫時無法處理您的請求，請稍後再試',
      error: error.message
    };
  }
}

/**
 * 20. 動態生成 Quick Reply 選項
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 根據用戶狀態和上下文動態生成 Quick Reply 按鈕
 */
async function SR_generateQuickReplyOptions(userId, context) {
  const functionName = "SR_generateQuickReplyOptions";
  try {
    const subscriptionStatus = await SR_checkSubscriptionStatus(userId);
    let options = [];

    switch (context) {
      case 'statistics':
        // 統計查詢選項（免費功能）
        options = [
          SR_QUICK_REPLY_CONFIG.STATISTICS.TODAY,
          SR_QUICK_REPLY_CONFIG.STATISTICS.WEEKLY,
          SR_QUICK_REPLY_CONFIG.STATISTICS.MONTHLY
        ];
        break;

      case 'paywall':
        // 付費功能牆選項
        if (!subscriptionStatus.isPremium) {
          options = [
            SR_QUICK_REPLY_CONFIG.PREMIUM.UPGRADE,
            SR_QUICK_REPLY_CONFIG.PREMIUM.TRIAL,
            SR_QUICK_REPLY_CONFIG.PREMIUM.INFO
          ];
        }
        break;

      case 'reminder_setup':
        // 提醒設定選項
        options = [
          { label: '每日提醒', postbackData: 'setup_daily_reminder' },
          { label: '每週提醒', postbackData: 'setup_weekly_reminder' },
          { label: '每月提醒', postbackData: 'setup_monthly_reminder' }
        ];
        
        if (subscriptionStatus.isPremium) {
          options.push({ label: '自訂提醒', postbackData: 'setup_custom_reminder' });
        }
        break;

      default:
        // 預設選項
        options = [
          SR_QUICK_REPLY_CONFIG.STATISTICS.TODAY,
          { label: '設定提醒', postbackData: 'setup_reminder' }
        ];
    }

    return {
      type: 'quick_reply',
      items: options.slice(0, 4) // LINE Quick Reply 最多4個按鈕
    };

  } catch (error) {
    SR_logError(`生成Quick Reply選項失敗: ${error.message}`, "Quick Reply", userId, "SR_GENERATE_ERROR", error.toString(), functionName);
    
    // 回傳基本選項
    return {
      type: 'quick_reply',
      items: [SR_QUICK_REPLY_CONFIG.STATISTICS.TODAY]
    };
  }
}

/**
 * 21. 處理付費功能牆 Quick Reply
 * @version 2025-07-21-V1.0.0
 * @date 2025-07-21 10:00:00
 * @description 處理付費功能相關的 Quick Reply 互動
 */
async function SR_handlePaywallQuickReply(userId, actionType, context) {
  const functionName = "SR_handlePaywallQuickReply";
  try {
    SR_logInfo(`處理付費功能牆: ${actionType}`, "付費功能", userId, "", "", functionName);

    let response = {};

    switch (actionType) {
      case 'upgrade':
        response = {
          success: true,
          message: `🌟 升級至 Premium 會員

✅ 無限排程提醒設定
✅ 自動推播每日摘要
✅ 智慧時間最佳化
✅ 進階統計分析
✅ 預算警示通知

💳 月費方案：NT$ 99/月
💳 年費方案：NT$ 990/年 (省下2個月)

請聯繫客服或前往官網完成升級`,
          quickReply: {
            type: 'quick_reply',
            items: [
              { label: '聯繫客服', postbackData: 'contact_support' },
              { label: '了解更多', postbackData: '功能介紹' }
            ]
          }
        };
        break;

      case 'trial':
        response = {
          success: true,
          message: `🎁 免費試用 Premium 功能

您可以免費體驗以下功能 7 天：
• 自動推播每日摘要
• 智慧時間最佳化
• 進階統計分析

試用期後將自動恢復免費方案，無需取消。

是否要開始免費試用？`,
          quickReply: {
            type: 'quick_reply',
            items: [
              { label: '開始試用', postbackData: 'start_trial' },
              { label: '暫不使用', postbackData: '今日統計' }
            ]
          }
        };
        break;

      case 'info':
        response = {
          success: true,
          message: `📊 Premium 功能詳細介紹

🔔 智慧提醒系統
• 無限制排程提醒設定
• 基於使用習慣的最佳時間推薦
• 假日與週末智慧處理

📈 自動推播服務
• 每日財務摘要 (21:00)
• 預算超支即時警告
• 月度報告自動生成

📊 進階分析功能
• 支出趨勢分析
• 類別占比統計
• 同期比較報告

輸入「統計」體驗基礎功能`,
          quickReply: {
            type: 'quick_reply',
            items: [
              { label: '立即升級', postbackData: 'upgrade_premium' },
              { label: '免費試用', postbackData: '試用' }
            ]
          }
        };
        break;

      default:
        response = {
          success: false,
          message: '無法處理此操作',
          quickReply: SR_generateQuickReplyOptions(userId, 'default')
        };
    }

    return response;

  } catch (error) {
    SR_logError(`處理付費功能牆失敗: ${error.message}`, "付費功能", userId, "SR_PAYWALL_ERROR", error.toString(), functionName);
    
    return {
      success: false,
      message: '系統錯誤，請稍後再試',
      error: error.message
    };
  }
}

// =============== 輔助函數 ===============

/**
 * 生成 cron 表達式
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
 * 計算下次執行時間
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
 * 建立提醒訊息
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
 * 檢查是否應該跳過執行
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
 * 建立每日摘要訊息
 */
function SR_buildDailySummaryMessage(statsData) {
  if (!statsData) {
    return `📊 今日財務摘要

暂无记账数据

💡 开始记账以获得个人化分析
输入「統計」查看更多功能`;
  }

  const totalIncome = statsData.totalIncome || 0;
  const totalExpense = statsData.totalExpense || 0;
  const balance = totalIncome - totalExpense;

  return `📊 今日財務摘要 (${moment().tz(TIMEZONE).format('MM/DD')})

💰 收入：${totalIncome}元
💸 支出：${totalExpense}元
📈 淨額：${balance >= 0 ? '+' : ''}${balance}元

${balance >= 0 ? '✅ 今日收支平衡良好' : '⚠️ 今日支出大於收入'}

輸入「統計」查看詳細分析`;
}

/**
 * 建立統計回覆訊息
 */
function SR_buildStatisticsReplyMessage(period, statsData) {
  const periodNames = {
    'today': '今日',
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
 * 取得用戶提醒數量
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
 * 生成升級訊息
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
 * 記錄 Quick Reply 互動
 */
async function SR_logQuickReplyInteraction(userId, postbackData, response) {
  try {
    await db.collection('quick_reply_sessions').add({
      userId,
      postbackData,
      success: response.success,
      timestamp: admin.firestore.Timestamp.now(),
      responseType: response.quickReply ? 'with_quick_reply' : 'text_only'
    });
  } catch (error) {
    // 靜默記錄失敗，不影響主流程
  }
}

/**
 * 模組初始化函數
 */
async function SR_initialize() {
  const functionName = "SR_initialize";
  try {
    console.log('📅 SR 排程提醒模組初始化中...');
    
    // 檢查 Firestore 連線
    if (!admin.apps.length) {
      throw new Error("Firebase Admin 未初始化");
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
 * 載入現有排程設定
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
  // 排程管理層函數
  SR_createScheduledReminder,
  SR_updateScheduledReminder,
  SR_deleteScheduledReminder,
  SR_executeScheduledTask,
  SR_processHolidayLogic,
  SR_optimizeReminderTime,
  
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
  
  // 常數與配置
  SR_CONFIG,
  SR_QUICK_REPLY_CONFIG,
  SR_INIT_STATUS
};

// 自動初始化模組
SR_initialize().catch(error => {
  console.error('SR 模組自動初始化失敗:', error);
});
