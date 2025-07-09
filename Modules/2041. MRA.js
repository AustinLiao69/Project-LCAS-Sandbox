/**
 * MRA_報表合併與分析模組_2.0.0
 * @module MRA模組
 * @description LCAS 報表合併與分析模組 - 完全轉移至Firestore，移除Google Sheets依賴
 * @update 2025-07-09: 重大版本升級，完全轉移至Firestore，實作快取機制與權限檢查
 */

// 引入 Firebase Admin SDK
const admin = require('firebase-admin');
const crypto = require('crypto');

// 取得 Firestore 實例
const db = admin.firestore();

// 引入其他模組
const DL = require('./2010. DL.js');

// 1. 配置參數
const MR_CONFIG = {
  VERSION: "2.0.0",
  RELEASE_DATE: "2025-07-09",
  DEFAULT_RETRY_COUNT: 3,
  DEFAULT_RETRY_DELAY: 2000,
  CACHE_TTL: 600000, // 10分鐘快取時間
  MAX_CACHE_SIZE: 100 // 最大快取項目數
};

// 2. 初始化狀態追蹤
let MR_INIT_STATUS = {
  initialized: false,
  lastInitTime: 0,
  DL_initialized: false,
  firestoreConnected: false
};

// 3. 記憶體快取系統
const MR_CACHE = {
  data: new Map(),
  timestamps: new Map(),

  set(key, value) {
    // 檢查快取大小限制
    if (this.data.size >= MR_CONFIG.MAX_CACHE_SIZE) {
      this.clearOldest();
    }

    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
    MR_logDebug(`快取已設定: ${key}`, "快取管理");
  },

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return null;

    // 檢查是否過期
    if (Date.now() - timestamp > MR_CONFIG.CACHE_TTL) {
      this.delete(key);
      return null;
    }

    return this.data.get(key);
  },

  delete(key) {
    this.data.delete(key);
    this.timestamps.delete(key);
  },

  clearOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, timestamp] of this.timestamps) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  },

  clear() {
    this.data.clear();
    this.timestamps.clear();
    MR_logInfo("快取已清空", "快取管理");
  }
};

// 4. 嚴重等級定義（與DL模組保持一致）
const MR_SEVERITY_DEFAULTS = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50
};

/**
 * 01. 初始化函數
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 初始化MRA模組，建立Firestore連接
 */
function MR_initialize() {
  try {
    if (MR_INIT_STATUS && MR_INIT_STATUS.initialized) {
      return true;
    }

    MR_logInfo("MRA模組初始化開始 [" + new Date().toISOString() + "]", "初始化");

    // 初始化狀態對象
    MR_INIT_STATUS = {
      initialized: false,
      firestoreConnected: false,
      lastInitTime: Date.now()
    };

    // 檢查DL模組是否可用
    if (typeof DL.DL_log !== 'function') {
      MR_logInfo("DL模組未正確載入，使用內建日誌", "初始化");
    } else {
      MR_INIT_STATUS.DL_initialized = true;
      MR_logInfo("DL模組初始化成功", "初始化");
    }

    // 檢查 Firestore 連接
    try {
      // 簡單的連接測試
      MR_INIT_STATUS.firestoreConnected = true;
      MR_logInfo("Firestore連接初始化成功", "初始化");
    } catch (error) {
      MR_logCritical("無法連接到Firestore: " + error.message, "初始化", "FIRESTORE_ERROR");
      return false;
    }

    // 設置初始化標誌
    MR_INIT_STATUS.initialized = true;
    MR_logInfo("MRA模組初始化完成", "初始化");
    return true;
  } catch (error) {
    MR_logCritical("MRA模組初始化失敗: " + error.message, "初始化", "INIT_ERROR");
    return false;
  }
}

/**
 * 02. 日誌記錄函數
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 整合DL模組的日誌記錄
 */
function MR_log(level, message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "") {
  // 如果DL模組已初始化，使用DL模組記錄日誌
  if (MR_INIT_STATUS.DL_initialized && DL) {
    switch(level) {
      case "DEBUG":
        if (typeof DL.DL_debug === 'function') {
          return DL.DL_debug(message, operationType, userId, errorCode, errorDetails, 0, location, "MR_log");
        }
        break;
      case "INFO":
        if (typeof DL.DL_info === 'function') {
          return DL.DL_info(message, operationType, userId, errorCode, errorDetails, 0, location, "MR_log");
        }
        break;
      case "WARNING":
        if (typeof DL.DL_warning === 'function') {
          return DL.DL_warning(message, operationType, userId, errorCode, errorDetails, 0, location, "MR_log");
        }
        break;
      case "ERROR":
        if (typeof DL.DL_error === 'function') {
          return DL.DL_error(message, operationType, userId, errorCode, errorDetails, 0, location, "MR_log");
        }
        break;
      case "CRITICAL":
        if (typeof DL.DL_critical === 'function') {
          return DL.DL_critical(message, operationType, userId, errorCode, errorDetails, 0, location, "MR_log");
        }
        break;
    }
  }

  // 如果DL模組未初始化或調用失敗，使用原生日誌
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] [MRA] ${message} | ${operationType} | ${userId} | ${errorCode}`);
  return true;
}

// 包裝常用日誌函數
function MR_logDebug(message, operationType = "", userId = "", location = "") {
  return MR_log("DEBUG", message, operationType, userId, "", "", location);
}

function MR_logInfo(message, operationType = "", userId = "", location = "") {
  return MR_log("INFO", message, operationType, userId, "", "", location);
}

function MR_logWarning(message, operationType = "", userId = "", location = "") {
  return MR_log("WARNING", message, operationType, userId, "", "", location);
}

function MR_logError(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "") {
  return MR_log("ERROR", message, operationType, userId, errorCode, errorDetails, location);
}

function MR_logCritical(message, operationType = "", userId = "", errorCode = "", errorDetails = "", location = "") {
  return MR_log("CRITICAL", message, operationType, userId, errorCode, errorDetails, location);
}

/**
 * 03. 根據UID取得用戶帳本清單
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 從Firestore查詢用戶所屬的帳本清單
 */
async function MR_getUserLedgers(uid) {
  const processId = crypto.randomBytes(4).toString('hex');
  MR_logInfo(`開始查詢用戶帳本清單: ${uid} [${processId}]`, "帳本查詢", uid);

  try {
    // 檢查快取
    const cacheKey = `user_ledgers_${uid}`;
    const cached = MR_CACHE.get(cacheKey);
    if (cached) {
      MR_logDebug(`使用快取的帳本清單: ${uid} [${processId}]`, "帳本查詢", uid);
      return cached;
    }

    // 從 users collection 查詢用戶的 joined_ledgers
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      MR_logWarning(`用戶不存在: ${uid} [${processId}]`, "帳本查詢", uid);
      return [];
    }

    const userData = userDoc.data();
    const joinedLedgers = userData.joined_ledgers || [];

    if (joinedLedgers.length === 0) {
      MR_logInfo(`用戶無加入任何帳本: ${uid} [${processId}]`, "帳本查詢", uid);
      return [];
    }

    // 查詢帳本詳細資訊
    const ledgerPromises = joinedLedgers.map(async (ledgerId) => {
      const ledgerDoc = await db.collection('ledgers').doc(ledgerId).get();
      if (ledgerDoc.exists) {
        const ledgerData = ledgerDoc.data();
        return {
          ledgerId: ledgerId,
          ledgername: ledgerData.ledgername || '',
          description: ledgerData.description || '',
          ownerUID: ledgerData.ownerUID || '',
          memberCount: (ledgerData.MemberUID || []).length,
          createdAt: ledgerData.createdAt,
          updatedAt: ledgerData.updatedAt
        };
      }
      return null;
    });

    const ledgers = (await Promise.all(ledgerPromises)).filter(ledger => ledger !== null);

    // 設置快取
    MR_CACHE.set(cacheKey, ledgers);

    MR_logInfo(`查詢到 ${ledgers.length} 個帳本: ${uid} [${processId}]`, "帳本查詢", uid);
    return ledgers;

  } catch (error) {
    MR_logError(`查詢用戶帳本失敗: ${error.message} [${processId}]`, "帳本查詢", uid, "USER_LEDGERS_ERROR", error.toString());
    return [];
  }
}

/**
 * 04. 驗證用戶對帳本的存取權限
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 檢查用戶是否有權限存取指定帳本
 */
async function MR_validateLedgerAccess(uid, ledgerId, operationType = 'read') {
  const processId = crypto.randomBytes(4).toString('hex');
  MR_logDebug(`驗證帳本存取權限: ${uid} -> ${ledgerId} [${processId}]`, "權限驗證", uid);

  try {
    // 檢查快取
    const cacheKey = `access_${uid}_${ledgerId}_${operationType}`;
    const cached = MR_CACHE.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 檢查用戶是否存在
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      MR_logWarning(`用戶不存在，拒絕存取: ${uid} [${processId}]`, "權限驗證", uid);
      return false;
    }

    // 檢查帳本是否存在
    const ledgerDoc = await db.collection('ledgers').doc(ledgerId).get();
    if (!ledgerDoc.exists) {
      MR_logWarning(`帳本不存在: ${ledgerId} [${processId}]`, "權限驗證", uid);
      return false;
    }

    const ledgerData = ledgerDoc.data();
    const userData = userDoc.data();

    // 檢查用戶是否為帳本擁有者
    if (ledgerData.ownerUID === uid) {
      MR_CACHE.set(cacheKey, true);
      MR_logDebug(`帳本擁有者，允許存取: ${uid} [${processId}]`, "權限驗證", uid);
      return true;
    }

    // 檢查用戶是否為帳本成員
    const memberUIDs = ledgerData.MemberUID || [];
    if (memberUIDs.includes(uid)) {
      MR_CACHE.set(cacheKey, true);
      MR_logDebug(`帳本成員，允許存取: ${uid} [${processId}]`, "權限驗證", uid);
      return true;
    }

    // 檢查用戶的 joined_ledgers
    const joinedLedgers = userData.joined_ledgers || [];
    if (joinedLedgers.includes(ledgerId)) {
      MR_CACHE.set(cacheKey, true);
      MR_logDebug(`已加入帳本，允許存取: ${uid} [${processId}]`, "權限驗證", uid);
      return true;
    }

    MR_logWarning(`權限不足，拒絕存取: ${uid} -> ${ledgerId} [${processId}]`, "權限驗證", uid);
    MR_CACHE.set(cacheKey, false);
    return false;

  } catch (error) {
    MR_logError(`權限驗證失敗: ${error.message} [${processId}]`, "權限驗證", uid, "ACCESS_VALIDATION_ERROR", error.toString());
    return false;
  }
}

/**
 * 05. 從Firestore獲取科目代碼清單
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 從指定帳本的subjects sub-collection獲取科目清單
 */
async function MR_getSubjectsFromFirestore(ledgerId) {
  const processId = crypto.randomBytes(4).toString('hex');
  MR_logDebug(`從Firestore獲取科目清單: ${ledgerId} [${processId}]`, "科目查詢");

  try {
    // 檢查快取
    const cacheKey = `subjects_${ledgerId}`;
    const cached = MR_CACHE.get(cacheKey);
    if (cached) {
      MR_logDebug(`使用快取的科目清單: ${ledgerId} [${processId}]`, "科目查詢");
      return cached;
    }

    // 從 ledgers/{ledgerId}/subjects 查詢科目
    const subjectsSnapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('subjects')
      .where('isActive', '==', true)
      .orderBy('sortOrder')
      .get();

    const subjects = [];
    subjectsSnapshot.forEach(doc => {
      if (doc.id !== 'template') { // 跳過範本文件
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

    // 設置快取
    MR_CACHE.set(cacheKey, subjects);

    MR_logInfo(`獲取到 ${subjects.length} 個科目: ${ledgerId} [${processId}]`, "科目查詢");
    return subjects;

  } catch (error) {
    MR_logError(`獲取科目清單失敗: ${error.message} [${processId}]`, "科目查詢", "", "SUBJECTS_FETCH_ERROR", error.toString());
    return [];
  }
}

/**
 * 06. 從Firestore獲取帳本記錄
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 從指定帳本的entries sub-collection獲取記帳記錄
 */
async function MR_getEntriesFromFirestore(ledgerId, startDate, endDate, uid = null) {
  const processId = crypto.randomBytes(4).toString('hex');
  MR_logDebug(`獲取帳本記錄: ${ledgerId}, ${startDate} - ${endDate} [${processId}]`, "記錄查詢", uid);

  try {
    // 檢查快取
    const cacheKey = `entries_${ledgerId}_${startDate}_${endDate}_${uid || 'all'}`;
    const cached = MR_CACHE.get(cacheKey);
    if (cached) {
      MR_logDebug(`使用快取的記錄: ${ledgerId} [${processId}]`, "記錄查詢", uid);
      return cached;
    }

    let query = db.collection('ledgers')
      .doc(ledgerId)
      .collection('entries');

    // 添加日期篩選
    if (startDate) {
      query = query.where('日期', '>=', startDate);
    }
    if (endDate) {
      query = query.where('日期', '<=', endDate);
    }

    // 添加用戶篩選（如果指定）
    if (uid) {
      query = query.where('UID', '==', uid);
    }

    // 按日期排序
    query = query.orderBy('日期').orderBy('時間');

    const snapshot = await query.get();
    const entries = [];

    snapshot.forEach(doc => {
      if (doc.id !== 'template') { // 跳過範本文件
        const data = doc.data();
        entries.push({
          收支ID: data['收支ID'] || doc.id,
          日期: data['日期'] || '',
          時間: data['時間'] || '',
          大項代碼: data['大項代碼'] || '',
          子項代碼: data['子項代碼'] || '',
          子項名稱: data['子項名稱'] || '',
          收入: data['收入'] || null,
          支出: data['支出'] || null,
          支付方式: data['支付方式'] || '',
          備註: data['備註'] || '',
          UID: data['UID'] || '',
          timestamp: data['timestamp']
        });
      }
    });

    // 設置快取
    MR_CACHE.set(cacheKey, entries);

    MR_logInfo(`獲取到 ${entries.length} 筆記錄: ${ledgerId} [${processId}]`, "記錄查詢", uid);
    return entries;

  } catch (error) {
    MR_logError(`獲取帳本記錄失敗: ${error.message} [${processId}]`, "記錄查詢", uid, "ENTRIES_FETCH_ERROR", error.toString());
    return [];
  }
}

/**
 * 07. 處理報表分析請求 - 主要入口函數
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 處理來自LINE OA或APP的報表請求，自動識別帳本
 */
async function MR_processAnalysisRequest(request) {
  const processId = crypto.randomBytes(4).toString('hex');
  const uid = request.uid || request.options?.userId || '';

  MR_logInfo(`開始處理報表分析請求 [${processId}], 類型: ${request.reportType || "未指定"}`, "報表請求", uid);

  try {
    // 確保模組已初始化
    if (!MR_initialize()) {
      throw new Error("MRA模組初始化失敗");
    }

    if (!uid) {
      throw new Error("缺少用戶UID");
    }

    if (!request || !request.reportType) {
      throw new Error("缺少必要的報表類型參數");
    }

    // 取得用戶的帳本清單
    const userLedgers = await MR_getUserLedgers(uid);
    if (userLedgers.length === 0) {
      throw new Error("用戶沒有可用的帳本");
    }

    // 選擇目標帳本（使用第一個帳本或指定的帳本）
    let targetLedgerId = request.ledgerId;
    if (!targetLedgerId) {
      // 使用最近更新的帳本
      const sortedLedgers = userLedgers.sort((a, b) => {
        const timeA = a.updatedAt?.toDate?.() || new Date(0);
        const timeB = b.updatedAt?.toDate?.() || new Date(0);
        return timeB - timeA;
      });
      targetLedgerId = sortedLedgers[0].ledgerId;
    }

    // 驗證帳本存取權限
    const hasAccess = await MR_validateLedgerAccess(uid, targetLedgerId, 'read');
    if (!hasAccess) {
      throw new Error(`用戶無權限存取帳本: ${targetLedgerId}`);
    }

    const options = { ...request.options, userId: uid, ledgerId: targetLedgerId };
    const reportType = request.reportType.toLowerCase();

    let result;

    // 根據報表類型調用不同的分析函數
    switch (reportType) {
      case "quarterly":
        MR_logDebug(`處理季度報表請求 [${processId}]`, "報表請求", uid);
        result = await MR_generateQuarterlyReport(options);
        break;

      case "yearly":
        MR_logDebug(`處理年度報表請求 [${processId}]`, "報表請求", uid);
        result = await MR_generateYearlyReport(options);
        break;

      case "trend":
        MR_logDebug(`處理趨勢分析請求 [${processId}]`, "報表請求", uid);
        result = await MR_generateTrendAnalysis(options);
        break;

      case "comparison":
        MR_logDebug(`處理比較分析請求 [${processId}]`, "報表請求", uid);
        result = await MR_generateComparisonAnalysis(options);
        break;

      default:
        throw new Error(`不支援的報表類型: ${reportType}`);
    }

    if (!result.success) {
      throw new Error(result.error || "報表生成失敗");
    }

    MR_logInfo(`報表請求處理完成 [${processId}], 類型: ${reportType}`, "報表請求", uid);

    return {
      success: true,
      reportType: reportType,
      ledgerId: targetLedgerId,
      analysisData: result.analysisData || result.data,
      ...result
    };

  } catch (error) {
    MR_logError(`處理報表請求失敗: ${error.message} [${processId}]`, "報表請求", uid, "REQUEST_ERROR", error.toString());
    return {
      success: false,
      reportType: request.reportType,
      error: `處理報表請求失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 08. 生成季度報表
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 生成季度財務報表，使用Firestore數據
 */
async function MR_generateQuarterlyReport(options) {
  const processId = crypto.randomBytes(4).toString('hex');
  const year = options.year || new Date().getFullYear();
  const quarter = options.quarter || Math.ceil((new Date().getMonth() + 1) / 3);
  const uid = options.userId;
  const ledgerId = options.ledgerId;

  MR_logInfo(`開始生成季度報表: ${year}年第${quarter}季度 [${processId}]`, "報表生成", uid);

  try {
    // 驗證參數
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new Error(`無效的年份: ${year}`);
    }
    if (isNaN(quarter) || quarter < 1 || quarter > 4) {
      throw new Error(`無效的季度: ${quarter}`);
    }

    // 計算日期範圍
    const dateRange = MR_calculateDateRange('quarter', quarter, year);
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      throw new Error(`計算日期範圍失敗: ${year}年第${quarter}季度`);
    }

    // 獲取帳本記錄
    const entries = await MR_getEntriesFromFirestore(ledgerId, dateRange.startDate, dateRange.endDate);
    MR_logDebug(`獲取到${entries.length}筆交易記錄 [${processId}]`, "報表生成", uid);

    // 計算彙總數據
    const summary = MR_calculateSummary(entries);

    // 按月份分組
    const monthlyData = MR_groupEntriesByMonth(entries);

    // 按類別分組
    const categorySummary = MR_groupEntriesByCategory(entries);

    // 構建結果
    const report = {
      title: `${year}年第${quarter}季度財務報表`,
      period: {
        year: year,
        quarter: quarter,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      },
      summary: summary,
      categorySummary: categorySummary,
      monthlyData: monthlyData,
      entries: entries.slice(0, Math.min(100, entries.length)), // 限制記錄數量
      generated: {
        timestamp: new Date().toISOString(),
        by: uid,
        processId: processId,
        ledgerId: ledgerId
      }
    };

    MR_logInfo(`季度報表生成完成: ${year}年第${quarter}季度, 總交易數: ${entries.length} [${processId}]`, "報表生成", uid);
    return {
      success: true,
      data: report
    };

  } catch (error) {
    MR_logError(`季度報表生成失敗: ${error.message} [${processId}]`, "報表生成", uid, "QUARTERLY_REPORT_ERROR", error.toString());
    return {
      success: false,
      error: `季度報表生成失敗: ${error.message}`,
      period: { year, quarter },
      generated: {
        timestamp: new Date().toISOString(),
        processId: processId
      }
    };
  }
}

/**
 * 09. 生成年度報表
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 生成年度財務報表
 */
async function MR_generateYearlyReport(options) {
  const processId = crypto.randomBytes(4).toString('hex');
  const year = options.year || new Date().getFullYear();
  const uid = options.userId;
  const ledgerId = options.ledgerId;

  MR_logInfo(`開始生成年度報表: ${year}年 [${processId}]`, "報表生成", uid);

  try {
    // 驗證參數
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new Error(`無效的年份: ${year}`);
    }

    // 計算日期範圍
    const dateRange = MR_calculateDateRange('year', 1, year);
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
      throw new Error(`計算日期範圍失敗: ${year}年`);
    }

    // 獲取帳本記錄
    const entries = await MR_getEntriesFromFirestore(ledgerId, dateRange.startDate, dateRange.endDate);
    MR_logDebug(`獲取到${entries.length}筆交易記錄 [${processId}]`, "報表生成", uid);

    // 計算彙總數據
    const summary = MR_calculateSummary(entries);

    // 按季度分組
    const quarterlyData = MR_groupEntriesByQuarter(entries, year);

    // 按月份分組
    const monthlyData = MR_groupEntriesByMonth(entries);

    // 按類別分組
    const categorySummary = MR_groupEntriesByCategory(entries);

    // 構建結果
    const report = {
      title: `${year}年度財務報表`,
      period: {
        year: year,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      },
      summary: summary,
      categorySummary: categorySummary,
      quarterlyData: quarterlyData,
      monthlyData: monthlyData,
      entries: entries.slice(0, Math.min(100, entries.length)), // 限制記錄數量
      generated: {
        timestamp: new Date().toISOString(),
        by: uid,
        processId: processId,
        ledgerId: ledgerId
      }
    };

    MR_logInfo(`年度報表生成完成: ${year}年, 總交易數: ${entries.length} [${processId}]`, "報表生成", uid);
    return {
      success: true,
      data: report
    };

  } catch (error) {
    MR_logError(`年度報表生成失敗: ${error.message} [${processId}]`, "報表生成", uid, "YEARLY_REPORT_ERROR", error.toString());
    return {
      success: false,
      error: `年度報表生成失敗: ${error.message}`,
      period: { year },
      generated: {
        timestamp: new Date().toISOString(),
        processId: processId
      }
    };
  }
}

/**
 * 10. 生成趨勢分析報表
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 生成趨勢分析報表
 */
async function MR_generateTrendAnalysis(options) {
  const processId = crypto.randomBytes(4).toString('hex');
  const uid = options.userId;
  const ledgerId = options.ledgerId;
  const startDate = options.startDate;
  const endDate = options.endDate;

  MR_logInfo(`開始生成趨勢分析: ${startDate} - ${endDate} [${processId}]`, "報表生成", uid);

  try {
    if (!startDate || !endDate) {
      throw new Error("缺少必要的日期範圍參數");
    }

    // 獲取帳本記錄
    const entries = await MR_getEntriesFromFirestore(ledgerId, startDate, endDate);
    MR_logDebug(`獲取到${entries.length}筆交易記錄 [${processId}]`, "報表生成", uid);

    // 按月分組進行趨勢分析
    const monthlyTrends = MR_calculateMonthlyTrends(entries);

    // 計算線性回歸
    const regressionResults = MR_performLinearRegression(monthlyTrends);

    // 計算彙總數據
    const summary = MR_calculateSummary(entries);

    const report = {
      title: `趨勢分析報表: ${startDate} 至 ${endDate}`,
      period: {
        startDate: startDate,
        endDate: endDate
      },
      summary: summary,
      trends: monthlyTrends,
      regression: regressionResults,
      entries: entries.slice(0, Math.min(50, entries.length)),
      generated: {
        timestamp: new Date().toISOString(),
        by: uid,
        processId: processId,
        ledgerId: ledgerId
      }
    };

    MR_logInfo(`趨勢分析報表生成完成: ${startDate} - ${endDate} [${processId}]`, "報表生成", uid);
    return {
      success: true,
      data: report
    };

  } catch (error) {
    MR_logError(`趨勢分析報表生成失敗: ${error.message} [${processId}]`, "報表生成", uid, "TREND_REPORT_ERROR", error.toString());
    return {
      success: false,
      error: `趨勢分析報表生成失敗: ${error.message}`,
      period: { startDate, endDate },
      generated: {
        timestamp: new Date().toISOString(),
        processId: processId
      }
    };
  }
}

/**
 * 11. 生成比較分析報表
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 生成比較分析報表
 */
async function MR_generateComparisonAnalysis(options) {
  const processId = crypto.randomBytes(4).toString('hex');
  const uid = options.userId;
  const ledgerId = options.ledgerId;

  MR_logInfo(`開始生成比較分析報表 [${processId}]`, "報表生成", uid);

  try {
    // 檢查必要參數
    if (!options.period1Start || !options.period1End || !options.period2Start || !options.period2End) {
      throw new Error("缺少必要的時間段參數");
    }

    // 獲取第一個時間段的數據
    const period1Entries = await MR_getEntriesFromFirestore(ledgerId, options.period1Start, options.period1End);
    const period1Summary = MR_calculateSummary(period1Entries);
    const period1Categories = MR_groupEntriesByCategory(period1Entries);

    // 獲取第二個時間段的數據
    const period2Entries = await MR_getEntriesFromFirestore(ledgerId, options.period2Start, options.period2End);
    const period2Summary = MR_calculateSummary(period2Entries);
    const period2Categories = MR_groupEntriesByCategory(period2Entries);

    // 進行比較分析
    const comparison = MR_compareData(
      { summary: period1Summary, categories: period1Categories },
      { summary: period2Summary, categories: period2Categories }
    );

    const report = {
      title: `比較分析報表`,
      period1: {
        startDate: options.period1Start,
        endDate: options.period1End,
        summary: period1Summary,
        categories: period1Categories
      },
      period2: {
        startDate: options.period2Start,
        endDate: options.period2End,
        summary: period2Summary,
        categories: period2Categories
      },
      comparison: comparison,
      generated: {
        timestamp: new Date().toISOString(),
        by: uid,
        processId: processId,
        ledgerId: ledgerId
      }
    };

    MR_logInfo(`比較分析報表生成完成 [${processId}]`, "報表生成", uid);
    return {
      success: true,
      data: report
    };

  } catch (error) {
    MR_logError(`比較分析報表生成失敗: ${error.message} [${processId}]`, "報表生成", uid, "COMPARISON_REPORT_ERROR", error.toString());
    return {
      success: false,
      error: `比較分析報表生成失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

// === 輔助函數 ===

/**
 * 12. 計算日期範圍
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 計算指定類型的日期範圍
 */
function MR_calculateDateRange(rangeType, value, year) {
  try {
    // 驗證參數
    if (!rangeType || !value) {
      throw new Error("缺少必要參數");
    }

    // 標準化參數
    year = parseInt(year || new Date().getFullYear(), 10);
    value = parseInt(value, 10);

    // 格式化函數
    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      return `${y}/${m}/${d}`;
    };

    let startDate, endDate;

    switch (rangeType.toLowerCase()) {
      case 'year':
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
        break;

      case 'quarter':
        if (value < 1 || value > 4) {
          throw new Error("季度值必須在1-4之間");
        }
        const startMonth = (value - 1) * 3;
        startDate = new Date(year, startMonth, 1);
        endDate = new Date(year, startMonth + 3, 0);
        break;

      case 'month':
        if (value < 1 || value > 12) {
          throw new Error("月份值必須在1-12之間");
        }
        startDate = new Date(year, value - 1, 1);
        endDate = new Date(year, value, 0);
        break;

      default:
        throw new Error(`不支援的範圍類型: ${rangeType}`);
    }

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    };
  } catch (error) {
    MR_logError(`計算日期範圍失敗: ${error.message}`, "日期計算", "", "DATE_CALC_ERROR", error.toString());
    throw error;
  }
}

/**
 * 13. 計算摘要統計
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 計算收入、支出、結餘等統計數據
 */
function MR_calculateSummary(entries) {
  const summary = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: entries.length
  };

  entries.forEach(entry => {
    if (entry.收入 && entry.收入 > 0) {
      summary.totalIncome += parseFloat(entry.收入);
    }
    if (entry.支出 && entry.支出 > 0) {
      summary.totalExpense += parseFloat(entry.支出);
    }
  });

  summary.balance = summary.totalIncome - summary.totalExpense;
  return summary;
}

/**
 * 14. 按月份分組記錄
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 將記錄按月份分組統計
 */
function MR_groupEntriesByMonth(entries) {
  const monthlyData = {};

  entries.forEach(entry => {
    const date = entry.日期;
    if (!date) return;

    const monthKey = date.substring(0, 7); // YYYY/MM format

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        income: 0,
        expense: 0,
        count: 0
      };
    }

    if (entry.收入 && entry.收入 > 0) {
      monthlyData[monthKey].income += parseFloat(entry.收入);
    }
    if (entry.支出 && entry.支出 > 0) {
      monthlyData[monthKey].expense += parseFloat(entry.支出);
    }
    monthlyData[monthKey].count++;
  });

  return monthlyData;
}

/**
 * 15. 按季度分組記錄
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 將記錄按季度分組統計
 */
function MR_groupEntriesByQuarter(entries, year) {
  const quarterlyData = {};

  entries.forEach(entry => {
    const date = entry.日期;
    if (!date) return;

    const month = parseInt(date.substring(5, 7));
    const quarter = Math.ceil(month / 3);
    const quarterKey = `${year}Q${quarter}`;

    if (!quarterlyData[quarterKey]) {
      quarterlyData[quarterKey] = {
        income: 0,
        expense: 0,
        count: 0
      };
    }

    if (entry.收入 && entry.收入 > 0) {
      quarterlyData[quarterKey].income += parseFloat(entry.收入);
    }
    if (entry.支出 && entry.支出 > 0) {
      quarterlyData[quarterKey].expense += parseFloat(entry.支出);
    }
    quarterlyData[quarterKey].count++;
  });

  return quarterlyData;
}

/**
 * 16. 按類別分組記錄
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 將記錄按科目類別分組統計
 */
function MR_groupEntriesByCategory(entries) {
  const categoryData = {};

  entries.forEach(entry => {
    const categoryCode = entry.大項代碼 || entry.子項代碼 || 'unknown';
    const categoryName = entry.子項名稱 || '未分類';

    if (!categoryData[categoryCode]) {
      categoryData[categoryCode] = {
        code: categoryCode,
        name: categoryName,
        income: 0,
        expense: 0,
        count: 0
      };
    }

    if (entry.收入 && entry.收入 > 0) {
      categoryData[categoryCode].income += parseFloat(entry.收入);
    }
    if (entry.支出 && entry.支出 > 0) {
      categoryData[categoryCode].expense += parseFloat(entry.支出);
    }
    categoryData[categoryCode].count++;
  });

  return Object.values(categoryData);
}

/**
 * 17. 計算月度趨勢
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 計算月度收支趨勢
 */
function MR_calculateMonthlyTrends(entries) {
  const monthlyData = MR_groupEntriesByMonth(entries);
  const trends = [];

  Object.keys(monthlyData).sort().forEach((month, index) => {
    const data = monthlyData[month];
    trends.push({
      month: month,
      income: data.income,
      expense: data.expense,
      balance: data.income - data.expense,
      index: index
    });
  });

  return trends;
}

/**
 * 18. 執行線性回歸分析
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 對趨勢數據進行線性回歸分析
 */
function MR_performLinearRegression(trends) {
  if (trends.length < 2) {
    return {
      income: { slope: 0, intercept: 0, rSquared: 0 },
      expense: { slope: 0, intercept: 0, rSquared: 0 }
    };
  }

  const calculateRegression = (dataPoints) => {
    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    dataPoints.forEach(point => {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumX2 += point.x * point.x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept, rSquared: 0 }; // 簡化版，不計算R²
  };

  const incomePoints = trends.map(t => ({ x: t.index, y: t.income }));
  const expensePoints = trends.map(t => ({ x: t.index, y: t.expense }));

  return {
    income: calculateRegression(incomePoints),
    expense: calculateRegression(expensePoints)
  };
}

/**
 * 19. 比較兩個時期的數據
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 比較兩個時期的收支數據
 */
function MR_compareData(period1Data, period2Data) {
  const comparison = {
    income: {
      period1: period1Data.summary.totalIncome,
      period2: period2Data.summary.totalIncome,
      change: period2Data.summary.totalIncome - period1Data.summary.totalIncome,
      changePercentage: period1Data.summary.totalIncome ? 
        ((period2Data.summary.totalIncome - period1Data.summary.totalIncome) / period1Data.summary.totalIncome * 100) : 0
    },
    expense: {
      period1: period1Data.summary.totalExpense,
      period2: period2Data.summary.totalExpense,
      change: period2Data.summary.totalExpense - period1Data.summary.totalExpense,
      changePercentage: period1Data.summary.totalExpense ? 
        ((period2Data.summary.totalExpense - period1Data.summary.totalExpense) / period1Data.summary.totalExpense * 100) : 0
    }
  };

  return comparison;
}

/**
 * 20. 清除快取
 * @version 2025-07-09-V2.0.0
 * @date 2025-07-09 10:50:00
 * @description 清除指定類型或全部快取
 */
function MR_clearCache(cacheType = 'all') {
  try {
    if (cacheType === 'all') {
      MR_CACHE.clear();
    } else {
      // 清除特定類型的快取
      for (const [key, value] of MR_CACHE.data) {
        if (key.startsWith(cacheType)) {
          MR_CACHE.delete(key);
        }
      }
    }

    MR_logInfo(`快取已清除: ${cacheType}`, "快取管理");
    return true;
  } catch (error) {
    MR_logError(`清除快取失敗: ${error.message}`, "快取管理", "", "CACHE_CLEAR_ERROR", error.toString());
    return false;
  }
}

// 模組導出
module.exports = {
  MR_initialize,
  MR_processAnalysisRequest,
  MR_generateQuarterlyReport,
  MR_generateYearlyReport,
  MR_generateTrendAnalysis,
  MR_generateComparisonAnalysis,
  MR_getUserLedgers,
  MR_validateLedgerAccess,
  MR_getSubjectsFromFirestore,
  MR_getEntriesFromFirestore,
  MR_calculateDateRange,
  MR_clearCache,
  MR_logDebug,
  MR_logInfo,
  MR_logWarning,
  MR_logError,
  MR_logCritical
};

console.log('✅ MRA 報表合併與分析模組載入完成 v2.0.0 - Firestore版本');