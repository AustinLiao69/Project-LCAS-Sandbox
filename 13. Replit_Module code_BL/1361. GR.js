/**
 * GR_報表生成模組_2.0.1
 * @module 報表生成模組
 * @description LINE 記帳機器人報表生成模組 - 完全遷移至Firestore資料庫，遵循2011模組資料庫結構
 * @update 2025-01-09: 版本升級至2.0.1，修正資料庫欄位對應，移除預設ledgerID，整合2031模組功能
 */

const admin = require('firebase-admin');

// 初始化 Firebase Admin (如果尚未初始化)
if (!admin.apps.length) {
  const serviceAccount = require('./Serviceaccountkey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// 引入DD1模組以獲取ledgerID
const DD1 = require('./1331. DD1.js');
const { DD_getLedgerInfo } = DD1;

/**
 * 配置參數
 */
const GR_CONFIG = {
  // Firestore 配置
  COLLECTION_LEDGERS: 'ledgers',
  COLLECTION_ENTRIES: 'entries',

  // 報表配置
  REPORT_CACHE_DURATION: 5 * 60 * 1000, // 5分鐘快取
  MAX_CONCURRENT_REQUESTS: 10,

  // 日誌配置
  LOG_LEVEL: 'INFO',

  // 分頁配置
  PAGE_SIZE: 1000,
  MAX_RESULTS: 10000
};

/**
 * 深度追蹤對象
 */
const GR_requestDepth = {
  depth: 0,
  maxDepth: 5,
  stack: []
};

/**
 * 01. 記錄系統資訊日誌
 * @version 2025-01-09-V2.0.1
 * @date 2025-01-09 15:30:00
 * @description 記錄系統資訊級別的日誌訊息
 */
function GR_logInfo(message, category = "", userId = "", functionName = "") {
  const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  console.log(`[INFO] ${timestamp} | ${category} | ${functionName} | ${userId} | ${message}`);
}

/**
 * 02. 記錄系統除錯日誌
 * @version 2025-01-09-V2.0.2
 * @date 2025-01-09 15:30:00
 * @description 記錄系統除錯級別的日誌訊息
 */
function GR_logDebug(message, category = "", userId = "", functionName = "") {
  if (GR_CONFIG.LOG_LEVEL === 'DEBUG') {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    console.log(`[DEBUG] ${timestamp} | ${category} | ${functionName} | ${userId} | ${message}`);
  }
}

/**
 * 03. 記錄系統錯誤日誌
 * @version 2025-01-09-V2.0.3
 * @date 2025-01-09 15:30:00
 * @description 記錄系統錯誤級別的日誌訊息
 */
function GR_logError(message, category = "", userId = "", errorCode = "", errorDetails = "", functionName = "") {
  const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  console.error(`[ERROR] ${timestamp} | ${category} | ${functionName} | ${userId} | ${errorCode} | ${message} | ${errorDetails}`);
}

/**
 * 04. 從Firestore獲取帳本資料 - 修正版本
 * @version 2025-01-09-V2.0.4
 * @date 2025-01-09 15:30:00
 * @description 從Firestore讀取指定帳本的記帳資料，使用2011模組定義的欄位結構
 */
async function GR_fetchLedgerData(userId, filters = {}) {
  const functionName = "GR_fetchLedgerData";

  try {
    if (!userId) {
      throw new Error("userId 參數為必填，每個使用者都需要獨立的帳本");
    }

    // 透過2031模組獲取ledgerID
    const ledgerInfo = await DD_getLedgerInfo(userId);
    if (!ledgerInfo) {
      const errorMsg = `找不到使用者 ${userId} 的帳本`;
      GR_logError(errorMsg, "資料獲取", userId, "LEDGER_NOT_FOUND", "", functionName);
      return {
        success: false,
        error: errorMsg,
        errorType: "LEDGER_NOT_FOUND"
      };
    }

    const ledgerId = ledgerInfo.id;
    GR_logDebug(`開始獲取帳本資料，帳本ID: ${ledgerId}`, "資料獲取", userId, functionName);

    // 建立查詢 - 使用2011模組定義的欄位名稱
    let query = db.collection(GR_CONFIG.COLLECTION_LEDGERS)
                   .doc(ledgerId)
                   .collection(GR_CONFIG.COLLECTION_ENTRIES);

    // 套用篩選條件 - 使用2011模組的欄位名稱
    if (filters.startDate) {
      // 將日期字串轉換為可比較的格式
      const startDateStr = filters.startDate.toISOString().split('T')[0].replace(/-/g, '/');
      query = query.where('日期', '>=', startDateStr);
    }
    if (filters.endDate) {
      const endDateStr = filters.endDate.toISOString().split('T')[0].replace(/-/g, '/');
      query = query.where('日期', '<=', endDateStr);
    }
    if (filters.majorCode) {
      query = query.where('大項代碼', '==', filters.majorCode);
    }
    if (filters.subCode) {
      query = query.where('子項代碼', '==', filters.subCode);
    }
    if (filters.paymentMethod) {
      query = query.where('支付方式', '==', filters.paymentMethod);
    }

    // 執行查詢，按時間戳排序
    const snapshot = await query.orderBy('timestamp', 'desc').limit(GR_CONFIG.MAX_RESULTS).get();

    const entries = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // 跳過template文件
      if (doc.id === 'template') return;

      // 轉換為統一格式，遵循2011模組結構
      const entry = {
        id: doc.id,
        收支ID: data.收支ID || doc.id,
        日期: data.日期,
        時間: data.時間,
        大項代碼: data.大項代碼,
        子項代碼: data.子項代碼,
        子項名稱: data.子項名稱,
        支付方式: data.支付方式,
        收入: data.收入,
        支出: data.支出,
        備註: data.備註,
        UID: data.UID,
        使用者類型: data.使用者類型,
        timestamp: data.timestamp ? data.timestamp.toDate() : null,
        
        // 計算衍生欄位以向後相容
        amount: data.收入 || data.支出 || 0,
        type: data.收入 > 0 ? '收入' : '支出',
        category: data.子項名稱,
        description: data.備註,
        paymentMethod: data.支付方式,
        date: data.timestamp ? data.timestamp.toDate() : new Date()
      };

      entries.push(entry);
    });

    GR_logInfo(`成功獲取 ${entries.length} 筆記帳資料`, "資料獲取", userId, functionName);
    
    return {
      success: true,
      data: entries,
      count: entries.length
    };

  } catch (error) {
    const errorMsg = `獲取帳本資料失敗: ${error.message}`;
    GR_logError(errorMsg, "資料獲取", userId, "FETCH_ERROR", error.toString(), functionName);
    
    return {
      success: false,
      error: errorMsg,
      errorType: "FETCH_ERROR",
      details: error.toString()
    };
  }
}

/**
 * 05. 生成月報表 - 修正版本
 * @version 2025-01-09-V2.0.5
 * @date 2025-01-09 15:30:00
 * @description 生成指定年月的詳細記帳報表，遵循2011模組欄位結構
 */
async function GR_generateMonthlyReport(options = {}) {
  const functionName = "GR_generateMonthlyReport";
  const processId = `MONTHLY_${Date.now()}`;

  // 深度檢查
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(functionName);
  }

  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logError(`檢測到可能的遞迴調用，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "RECURSIVE_CALL", "", functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "月報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      errorType: "RECURSIVE_CALL",
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.userId || !options.year || !options.month) {
      throw new Error("缺少必要的參數: userId, year, month");
    }

    const year = parseInt(options.year);
    const month = parseInt(options.month);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    GR_logInfo(`開始生成月報表 ${year}年${month}月 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 獲取該月份的記帳資料
    const fetchResult = await GR_fetchLedgerData(options.userId, {
      startDate: startDate,
      endDate: endDate
    });

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || "無法獲取帳本資料");
    }

    const entries = fetchResult.data || [];

    // 計算統計資料 - 使用2011模組欄位
    const stats = {
      totalIncome: 0,
      totalExpense: 0,
      netAmount: 0,
      entryCount: entries.length,
      categories: {},
      paymentMethods: {},
      dailyData: {}
    };

    entries.forEach(entry => {
      const income = parseFloat(entry.收入) || 0;
      const expense = parseFloat(entry.支出) || 0;

      if (income > 0) {
        stats.totalIncome += income;
      }
      if (expense > 0) {
        stats.totalExpense += expense;
      }

      // 分類統計 - 使用子項名稱
      const categoryName = entry.子項名稱 || '未知科目';
      if (!stats.categories[categoryName]) {
        stats.categories[categoryName] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.categories[categoryName].income += income;
      }
      if (expense > 0) {
        stats.categories[categoryName].expense += expense;
      }
      stats.categories[categoryName].count++;

      // 支付方式統計
      const paymentMethod = entry.支付方式 || '未知支付方式';
      if (!stats.paymentMethods[paymentMethod]) {
        stats.paymentMethods[paymentMethod] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.paymentMethods[paymentMethod].income += income;
      }
      if (expense > 0) {
        stats.paymentMethods[paymentMethod].expense += expense;
      }
      stats.paymentMethods[paymentMethod].count++;

      // 每日統計 - 使用日期欄位
      const dateKey = entry.日期 || 'unknown';
      if (!stats.dailyData[dateKey]) {
        stats.dailyData[dateKey] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.dailyData[dateKey].income += income;
      }
      if (expense > 0) {
        stats.dailyData[dateKey].expense += expense;
      }
      stats.dailyData[dateKey].count++;
    });

    stats.netAmount = stats.totalIncome - stats.totalExpense;

    const result = {
      success: true,
      type: "月報表",
      period: `${year}年${month}月`,
      year: year,
      month: month,
      userId: options.userId,
      generatedAt: new Date(),
      statistics: stats,
      entries: entries
    };

    GR_logInfo(`月報表生成完成 [${processId}]`, "報表生成", options.userId || "", functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成月報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "月報表",
      error: `生成月報表失敗: ${error.message}`,
      errorType: "REPORT_ERROR",
      details: error.toString()
    };
  }
}

/**
 * 06. 生成年報表 - 修正版本
 * @version 2025-01-09-V2.0.6
 * @date 2025-01-09 15:30:00
 * @description 生成指定年份的年度記帳報表，遵循2011模組欄位結構
 */
async function GR_generateYearlyReport(options = {}) {
  const functionName = "GR_generateYearlyReport";
  const processId = `YEARLY_${Date.now()}`;

  // 深度檢查
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(functionName);
  }

  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logError(`檢測到可能的遞迴調用，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "RECURSIVE_CALL", "", functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "年報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      errorType: "RECURSIVE_CALL",
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.userId || !options.year) {
      throw new Error("缺少必要的參數: userId, year");
    }

    const year = parseInt(options.year);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    GR_logInfo(`開始生成年報表 ${year}年 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 獲取整年的記帳資料
    const fetchResult = await GR_fetchLedgerData(options.userId, {
      startDate: startDate,
      endDate: endDate
    });

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || "無法獲取帳本資料");
    }

    const entries = fetchResult.data || [];

    // 計算統計資料 - 使用2011模組欄位
    const stats = {
      totalIncome: 0,
      totalExpense: 0,
      netAmount: 0,
      entryCount: entries.length,
      categories: {},
      paymentMethods: {},
      monthlyData: {}
    };

    entries.forEach(entry => {
      const income = parseFloat(entry.收入) || 0;
      const expense = parseFloat(entry.支出) || 0;

      if (income > 0) {
        stats.totalIncome += income;
      }
      if (expense > 0) {
        stats.totalExpense += expense;
      }

      // 分類統計
      const categoryName = entry.子項名稱 || '未知科目';
      if (!stats.categories[categoryName]) {
        stats.categories[categoryName] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.categories[categoryName].income += income;
      }
      if (expense > 0) {
        stats.categories[categoryName].expense += expense;
      }
      stats.categories[categoryName].count++;

      // 支付方式統計
      const paymentMethod = entry.支付方式 || '未知支付方式';
      if (!stats.paymentMethods[paymentMethod]) {
        stats.paymentMethods[paymentMethod] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.paymentMethods[paymentMethod].income += income;
      }
      if (expense > 0) {
        stats.paymentMethods[paymentMethod].expense += expense;
      }
      stats.paymentMethods[paymentMethod].count++;

      // 每月統計 - 從日期欄位解析月份
      let monthKey = 'unknown';
      if (entry.日期 && typeof entry.日期 === 'string') {
        const dateParts = entry.日期.split('/');
        if (dateParts.length >= 2) {
          monthKey = `${year}-${String(dateParts[1]).padStart(2, '0')}`;
        }
      }

      if (!stats.monthlyData[monthKey]) {
        stats.monthlyData[monthKey] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.monthlyData[monthKey].income += income;
      }
      if (expense > 0) {
        stats.monthlyData[monthKey].expense += expense;
      }
      stats.monthlyData[monthKey].count++;
    });

    stats.netAmount = stats.totalIncome - stats.totalExpense;

    const result = {
      success: true,
      type: "年報表",
      period: `${year}年`,
      year: year,
      userId: options.userId,
      generatedAt: new Date(),
      statistics: stats,
      entries: entries
    };

    GR_logInfo(`年報表生成完成 [${processId}]`, "報表生成", options.userId || "", functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成年報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "年報表",
      error: `生成年報表失敗: ${error.message}`,
      errorType: "REPORT_ERROR",
      details: error.toString()
    };
  }
}

/**
 * 07. 生成分類報表 - 修正版本
 * @version 2025-01-09-V2.0.7
 * @date 2025-01-09 15:30:00
 * @description 生成指定期間的分類統計報表，遵循2011模組欄位結構
 */
async function GR_generateCategoryReport(options = {}) {
  const functionName = "GR_generateCategoryReport";
  const processId = `CATEGORY_${Date.now()}`;

  try {
    if (!options.userId || !options.startDate || !options.endDate) {
      throw new Error("缺少必要的參數: userId, startDate, endDate");
    }

    GR_logInfo(`開始生成分類報表 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 獲取指定期間的記帳資料
    const fetchResult = await GR_fetchLedgerData(options.userId, {
      startDate: new Date(options.startDate),
      endDate: new Date(options.endDate)
    });

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || "無法獲取帳本資料");
    }

    const entries = fetchResult.data || [];

    // 計算分類統計 - 使用2011模組欄位
    const categoryStats = {};
    let totalIncome = 0;
    let totalExpense = 0;

    entries.forEach(entry => {
      const income = parseFloat(entry.收入) || 0;
      const expense = parseFloat(entry.支出) || 0;
      const categoryName = entry.子項名稱 || '未知科目';

      if (!categoryStats[categoryName]) {
        categoryStats[categoryName] = {
          income: 0,
          expense: 0,
          count: 0,
          entries: []
        };
      }

      if (income > 0) {
        categoryStats[categoryName].income += income;
        totalIncome += income;
      }
      if (expense > 0) {
        categoryStats[categoryName].expense += expense;
        totalExpense += expense;
      }

      categoryStats[categoryName].count++;
      categoryStats[categoryName].entries.push(entry);
    });

    // 計算百分比
    Object.keys(categoryStats).forEach(category => {
      const categoryData = categoryStats[category];
      categoryData.incomePercentage = totalIncome > 0 ? (categoryData.income / totalIncome * 100) : 0;
      categoryData.expensePercentage = totalExpense > 0 ? (categoryData.expense / totalExpense * 100) : 0;
      categoryData.netAmount = categoryData.income - categoryData.expense;
    });

    const result = {
      success: true,
      type: "分類報表",
      period: `${options.startDate} 至 ${options.endDate}`,
      userId: options.userId,
      startDate: options.startDate,
      endDate: options.endDate,
      generatedAt: new Date(),
      summary: {
        totalIncome: totalIncome,
        totalExpense: totalExpense,
        netAmount: totalIncome - totalExpense,
        categoryCount: Object.keys(categoryStats).length,
        entryCount: entries.length
      },
      categories: categoryStats
    };

    GR_logInfo(`分類報表生成完成 [${processId}]`, "報表生成", options.userId || "", functionName);
    return result;

  } catch (error) {
    GR_logError(`生成分類報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    return {
      success: false,
      type: "分類報表",
      error: `生成分類報表失敗: ${error.message}`,
      errorType: "REPORT_ERROR",
      details: error.toString()
    };
  }
}

/**
 * 08. 生成同比報表 - 修正版本
 * @version 2025-01-09-V2.0.8
 * @date 2025-01-09 15:30:00
 * @description 生成去年同期比較報表，遵循2011模組欄位結構
 */
async function GR_generateYoYReport(options = {}) {
  const functionName = "GR_generateYoYReport";
  const processId = `YOY_${Date.now()}`;

  try {
    if (!options.userId || !options.year || !options.month) {
      throw new Error("缺少必要的參數: userId, year, month");
    }

    const year = parseInt(options.year);
    const month = parseInt(options.month);
    const lastYear = year - 1;

    GR_logInfo(`開始生成同比報表 ${year}年${month}月 vs ${lastYear}年${month}月 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 獲取當期報表
    const currentReport = await GR_generateMonthlyReport({
      ...options,
      year: year,
      month: month,
      isRecursiveCall: true
    });

    // 獲取去年同期報表
    const lastYearReport = await GR_generateMonthlyReport({
      ...options,
      year: lastYear,
      month: month,
      isRecursiveCall: true
    });

    if (!currentReport.success || !lastYearReport.success) {
      throw new Error("無法獲取比較期間的報表資料");
    }

    // 計算同比變化
    const currentStats = currentReport.statistics;
    const lastYearStats = lastYearReport.statistics;

    const comparison = {
      income: {
        current: currentStats.totalIncome,
        lastYear: lastYearStats.totalIncome,
        change: currentStats.totalIncome - lastYearStats.totalIncome,
        changePercentage: lastYearStats.totalIncome > 0 ? 
          ((currentStats.totalIncome - lastYearStats.totalIncome) / lastYearStats.totalIncome * 100) : 0
      },
      expense: {
        current: currentStats.totalExpense,
        lastYear: lastYearStats.totalExpense,
        change: currentStats.totalExpense - lastYearStats.totalExpense,
        changePercentage: lastYearStats.totalExpense > 0 ? 
          ((currentStats.totalExpense - lastYearStats.totalExpense) / lastYearStats.totalExpense * 100) : 0
      },
      netAmount: {
        current: currentStats.netAmount,
        lastYear: lastYearStats.netAmount,
        change: currentStats.netAmount - lastYearStats.netAmount,
        changePercentage: lastYearStats.netAmount !== 0 ? 
          ((currentStats.netAmount - lastYearStats.netAmount) / Math.abs(lastYearStats.netAmount) * 100) : 0
      },
      entryCount: {
        current: currentStats.entryCount,
        lastYear: lastYearStats.entryCount,
        change: currentStats.entryCount - lastYearStats.entryCount,
        changePercentage: lastYearStats.entryCount > 0 ? 
          ((currentStats.entryCount - lastYearStats.entryCount) / lastYearStats.entryCount * 100) : 0
      }
    };

    const result = {
      success: true,
      type: "同比報表",
      period: `${year}年${month}月 vs ${lastYear}年${month}月`,
      userId: options.userId,
      currentPeriod: currentReport,
      lastYearPeriod: lastYearReport,
      comparison: comparison,
      generatedAt: new Date()
    };

    GR_logInfo(`同比報表生成完成 [${processId}]`, "報表生成", options.userId || "", functionName);
    return result;

  } catch (error) {
    GR_logError(`生成同比報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    return {
      success: false,
      type: "同比報表",
      error: `生成同比報表失敗: ${error.message}`,
      errorType: "REPORT_ERROR",
      details: error.toString()
    };
  }
}

/**
 * 09. 生成自訂報表 - 修正版本
 * @version 2025-01-09-V2.0.9
 * @date 2025-01-09 15:30:00
 * @description 根據自訂條件生成報表，遵循2011模組欄位結構
 */
async function GR_generateCustomReport(options = {}) {
  const functionName = "GR_generateCustomReport";
  const processId = `CUSTOM_${Date.now()}`;

  try {
    if (!options.userId || !options.startDate || !options.endDate) {
      throw new Error("缺少必要的參數: userId, startDate, endDate");
    }

    GR_logInfo(`開始生成自訂報表 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 建立篩選條件
    const filters = {
      startDate: new Date(options.startDate),
      endDate: new Date(options.endDate)
    };

    if (options.filters) {
      if (options.filters.majorCode) {
        filters.majorCode = options.filters.majorCode;
      }
      if (options.filters.subCode) {
        filters.subCode = options.filters.subCode;
      }
      if (options.filters.paymentMethod) {
        filters.paymentMethod = options.filters.paymentMethod;
      }
    }

    // 獲取篩選後的記帳資料
    const fetchResult = await GR_fetchLedgerData(options.userId, filters);

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || "無法獲取帳本資料");
    }

    const entries = fetchResult.data || [];

    // 計算統計資料 - 使用2011模組欄位
    const stats = {
      totalIncome: 0,
      totalExpense: 0,
      netAmount: 0,
      entryCount: entries.length,
      categories: {},
      paymentMethods: {},
      avgDailyIncome: 0,
      avgDailyExpense: 0
    };

    entries.forEach(entry => {
      const income = parseFloat(entry.收入) || 0;
      const expense = parseFloat(entry.支出) || 0;

      if (income > 0) {
        stats.totalIncome += income;
      }
      if (expense > 0) {
        stats.totalExpense += expense;
      }

      // 分類統計
      const categoryName = entry.子項名稱 || '未知科目';
      if (!stats.categories[categoryName]) {
        stats.categories[categoryName] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.categories[categoryName].income += income;
      }
      if (expense > 0) {
        stats.categories[categoryName].expense += expense;
      }
      stats.categories[categoryName].count++;

      // 支付方式統計
      const paymentMethod = entry.支付方式 || '未知支付方式';
      if (!stats.paymentMethods[paymentMethod]) {
        stats.paymentMethods[paymentMethod] = { income: 0, expense: 0, count: 0 };
      }

      if (income > 0) {
        stats.paymentMethods[paymentMethod].income += income;
      }
      if (expense > 0) {
        stats.paymentMethods[paymentMethod].expense += expense;
      }
      stats.paymentMethods[paymentMethod].count++;
    });

    stats.netAmount = stats.totalIncome - stats.totalExpense;

    // 計算日均值
    const daysDiff = Math.ceil((filters.endDate - filters.startDate) / (1000 * 60 * 60 * 24)) + 1;
    stats.avgDailyIncome = daysDiff > 0 ? stats.totalIncome / daysDiff : 0;
    stats.avgDailyExpense = daysDiff > 0 ? stats.totalExpense / daysDiff : 0;

    const result = {
      success: true,
      type: "自訂報表",
      period: `${options.startDate} 至 ${options.endDate}`,
      userId: options.userId,
      startDate: options.startDate,
      endDate: options.endDate,
      generatedAt: new Date(),
      statistics: stats,
      entries: entries,
      appliedFilters: options.filters || {}
    };

    GR_logInfo(`自訂報表生成完成 [${processId}]`, "報表生成", options.userId || "", functionName);
    return result;

  } catch (error) {
    GR_logError(`生成自訂報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    return {
      success: false,
      type: "自訂報表",
      error: `生成自訂報表失敗: ${error.message}`,
      errorType: "REPORT_ERROR",
      details: error.toString()
    };
  }
}

/**
 * 19. 處理報表請求 - 主要入口函數 - 修正版本
 * @version 2025-01-09-V2.0.19
 * @date 2025-01-09 15:30:00
 * @description 根據請求類型分發到對應的報表生成函數，移除ledgerId依賴，使用userId
 */
async function GR_handleReportRequest(request) {
  const functionName = "GR_handleReportRequest";

  try {
    GR_logInfo(`收到報表請求: ${request.type}`, "報表處理", request.userId || "", functionName);

    if (!request.userId) {
      const errorMsg = "請求中缺少 userId 參數，每個使用者都需要獨立的帳本";
      return {
        success: false,
        error: errorMsg,
        errorType: "MISSING_USER_ID"
      };
    }

    let result;

    switch (request.type) {
      case 'monthly':
        result = await GR_generateMonthlyReport({
          userId: request.userId,
          year: request.year,
          month: request.month
        });
        break;

      case 'yearly':
        result = await GR_generateYearlyReport({
          userId: request.userId,
          year: request.year
        });
        break;

      case 'category':
        result = await GR_generateCategoryReport({
          userId: request.userId,
          startDate: request.startDate,
          endDate: request.endDate
        });
        break;

      case 'yoy':
        result = await GR_generateYoYReport({
          userId: request.userId,
          year: request.year,
          month: request.month
        });
        break;

      case 'custom':
        result = await GR_generateCustomReport({
          userId: request.userId,
          startDate: request.startDate,
          endDate: request.endDate,
          filters: request.filters
        });
        break;

      default:
        throw new Error(`不支援的報表類型: ${request.type}`);
    }

    GR_logInfo(`報表請求處理完成: ${request.type}`, "報表處理", request.userId || "", functionName);
    return result;

  } catch (error) {
    GR_logError(`處理報表請求失敗: ${error.message}`, "報表處理", request.userId || "", "REQUEST_ERROR", error.toString(), functionName);

    return {
      success: false,
      type: request.type || "未知",
      error: `處理報表請求失敗: ${error.message}`,
      errorType: "REQUEST_ERROR",
      details: error.toString()
    };
  }
}

// 匯出模組函數
module.exports = {
  GR_logInfo,
  GR_logDebug,
  GR_logError,
  GR_fetchLedgerData,
  GR_generateMonthlyReport,
  GR_generateYearlyReport,
  GR_generateCategoryReport,
  GR_generateYoYReport,
  GR_generateCustomReport,
  GR_handleReportRequest
};
