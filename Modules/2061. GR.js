/**
 * GR_報表生成模組_2.0.0
 * @module 報表生成模組
 * @description LINE 記帳機器人報表生成模組 - 遷移至Firestore資料庫
 * @update 2025-01-09: 版本升級，從Google Sheets遷移至Firestore，移除預設ledgerID
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
 * 04. 從Firestore獲取帳本資料
 * @version 2025-01-09-V2.0.4
 * @date 2025-01-09 15:30:00
 * @description 從Firestore讀取指定帳本的記帳資料
 */
async function GR_fetchLedgerData(ledgerId, filters = {}) {
  const functionName = "GR_fetchLedgerData";

  try {
    GR_logDebug(`開始獲取帳本資料，帳本ID: ${ledgerId}`, "資料獲取", "", functionName);

    if (!ledgerId) {
      throw new Error("ledgerId 參數為必填");
    }

    // 檢查帳本是否存在
    const ledgerDoc = await db.collection(GR_CONFIG.COLLECTION_LEDGERS).doc(ledgerId).get();
    if (!ledgerDoc.exists) {
      throw new Error(`找不到指定的帳本: ${ledgerId}`);
    }

    // 建立查詢
    let query = db.collection(GR_CONFIG.COLLECTION_LEDGERS)
                   .doc(ledgerId)
                   .collection(GR_CONFIG.COLLECTION_ENTRIES);

    // 套用篩選條件
    if (filters.startDate) {
      query = query.where('date', '>=', new Date(filters.startDate));
    }
    if (filters.endDate) {
      query = query.where('date', '<=', new Date(filters.endDate));
    }
    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }

    // 執行查詢
    const snapshot = await query.orderBy('date', 'desc').limit(GR_CONFIG.MAX_RESULTS).get();

    const entries = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      entries.push({
        id: doc.id,
        date: data.date.toDate(),
        amount: data.amount,
        category: data.category,
        description: data.description,
        type: data.type,
        paymentMethod: data.paymentMethod,
        createdAt: data.createdAt ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
      });
    });

    GR_logInfo(`成功獲取 ${entries.length} 筆記帳資料`, "資料獲取", "", functionName);
    return entries;

  } catch (error) {
    GR_logError(`獲取帳本資料失敗: ${error.message}`, "資料獲取", "", "FETCH_ERROR", error.toString(), functionName);
    throw error;
  }
}

/**
 * 05. 生成月報表
 * @version 2025-01-09-V2.0.5
 * @date 2025-01-09 15:30:00
 * @description 生成指定年月的詳細記帳報表
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
    GR_logError(`檢測到可能的遞迴調用，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateMonthlyReport");

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "月報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.ledgerId || !options.year || !options.month) {
      throw new Error("缺少必要的參數: ledgerId, year, month");
    }

    const year = parseInt(options.year);
    const month = parseInt(options.month);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    GR_logInfo(`開始生成月報表 ${year}年${month}月 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 獲取該月份的記帳資料
    const entries = await GR_fetchLedgerData(options.ledgerId, {
      startDate: startDate,
      endDate: endDate
    });

    // 計算統計資料
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
      const amount = parseFloat(entry.amount) || 0;

      if (entry.type === '收入') {
        stats.totalIncome += amount;
      } else if (entry.type === '支出') {
        stats.totalExpense += amount;
      }

      // 分類統計
      if (!stats.categories[entry.category]) {
        stats.categories[entry.category] = { income: 0, expense: 0, count: 0 };
      }

      if (entry.type === '收入') {
        stats.categories[entry.category].income += amount;
      } else if (entry.type === '支出') {
        stats.categories[entry.category].expense += amount;
      }
      stats.categories[entry.category].count++;

      // 支付方式統計
      if (entry.paymentMethod) {
        if (!stats.paymentMethods[entry.paymentMethod]) {
          stats.paymentMethods[entry.paymentMethod] = { income: 0, expense: 0, count: 0 };
        }

        if (entry.type === '收入') {
          stats.paymentMethods[entry.paymentMethod].income += amount;
        } else if (entry.type === '支出') {
          stats.paymentMethods[entry.paymentMethod].expense += amount;
        }
        stats.paymentMethods[entry.paymentMethod].count++;
      }

      // 每日統計
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!stats.dailyData[dateKey]) {
        stats.dailyData[dateKey] = { income: 0, expense: 0, count: 0 };
      }

      if (entry.type === '收入') {
        stats.dailyData[dateKey].income += amount;
      } else if (entry.type === '支出') {
        stats.dailyData[dateKey].expense += amount;
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
      ledgerId: options.ledgerId,
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
      details: error.toString()
    };
  }
}

/**
 * 06. 生成年報表
 * @version 2025-01-09-V2.0.6
 * @date 2025-01-09 15:30:00
 * @description 生成指定年份的年度記帳報表
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
    GR_logError(`檢測到可能的遞迴調用，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateYearlyReport");

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "年報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.ledgerId || !options.year) {
      throw new Error("缺少必要的參數: ledgerId, year");
    }

    const year = parseInt(options.year);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    GR_logInfo(`開始生成年報表 ${year}年 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 獲取整年的記帳資料
    const entries = await GR_fetchLedgerData(options.ledgerId, {
      startDate: startDate,
      endDate: endDate
    });

    // 計算統計資料
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
      const amount = parseFloat(entry.amount) || 0;

      if (entry.type === '收入') {
        stats.totalIncome += amount;
      } else if (entry.type === '支出') {
        stats.totalExpense += amount;
      }

      // 分類統計
      if (!stats.categories[entry.category]) {
        stats.categories[entry.category] = { income: 0, expense: 0, count: 0 };
      }

      if (entry.type === '收入') {
        stats.categories[entry.category].income += amount;
      } else if (entry.type === '支出') {
        stats.categories[entry.category].expense += amount;
      }
      stats.categories[entry.category].count++;

      // 支付方式統計
      if (entry.paymentMethod) {
        if (!stats.paymentMethods[entry.paymentMethod]) {
          stats.paymentMethods[entry.paymentMethod] = { income: 0, expense: 0, count: 0 };
        }

        if (entry.type === '收入') {
          stats.paymentMethods[entry.paymentMethod].income += amount;
        } else if (entry.type === '支出') {
          stats.paymentMethods[entry.paymentMethod].expense += amount;
        }
        stats.paymentMethods[entry.paymentMethod].count++;
      }

      // 每月統計
      const monthKey = `${year}-${String(entry.date.getMonth() + 1).padStart(2, '0')}`;
      if (!stats.monthlyData[monthKey]) {
        stats.monthlyData[monthKey] = { income: 0, expense: 0, count: 0 };
      }

      if (entry.type === '收入') {
        stats.monthlyData[monthKey].income += amount;
      } else if (entry.type === '支出') {
        stats.monthlyData[monthKey].expense += amount;
      }
      stats.monthlyData[monthKey].count++;
    });

    stats.netAmount = stats.totalIncome - stats.totalExpense;

    const result = {
      success: true,
      type: "年報表",
      period: `${year}年`,
      year: year,
      ledgerId: options.ledgerId,
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
      details: error.toString()
    };
  }
}

/**
 * 07. 生成分類報表
 * @version 2025-01-09-V2.0.7
 * @date 2025-01-09 15:30:00
 * @description 生成指定期間的分類統計報表
 */
async function GR_generateCategoryReport(options = {}) {
  const functionName = "GR_generateCategoryReport";
  const processId = `CATEGORY_${Date.now()}`;

  // 深度檢查
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(functionName);
  }

  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logError(`檢測到可能的遞迴調用，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateCategoryReport");

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "分類報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.ledgerId || !options.startDate || !options.endDate) {
      throw new Error("缺少必要的參數: ledgerId, startDate, endDate");
    }

    GR_logInfo(`開始生成分類報表 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 獲取指定期間的記帳資料
    const entries = await GR_fetchLedgerData(options.ledgerId, {
      startDate: new Date(options.startDate),
      endDate: new Date(options.endDate)
    });

    // 計算分類統計
    const categoryStats = {};
    let totalIncome = 0;
    let totalExpense = 0;

    entries.forEach(entry => {
      const amount = parseFloat(entry.amount) || 0;

      if (!categoryStats[entry.category]) {
        categoryStats[entry.category] = {
          income: 0,
          expense: 0,
          count: 0,
          entries: []
        };
      }

      if (entry.type === '收入') {
        categoryStats[entry.category].income += amount;
        totalIncome += amount;
      } else if (entry.type === '支出') {
        categoryStats[entry.category].expense += amount;
        totalExpense += amount;
      }

      categoryStats[entry.category].count++;
      categoryStats[entry.category].entries.push(entry);
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
      ledgerId: options.ledgerId,
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

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成分類報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "分類報表",
      error: `生成分類報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 08. 生成同比報表
 * @version 2025-01-09-V2.0.8
 * @date 2025-01-09 15:30:00
 * @description 生成去年同期比較報表
 */
async function GR_generateYoYReport(options = {}) {
  const functionName = "GR_generateYoYReport";
  const processId = `YOY_${Date.now()}`;

  // 深度檢查
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(functionName);
  }

  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logError(`檢測到可能的遞迴調用，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateYoYReport");

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "同比報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.ledgerId || !options.year || !options.month) {
      throw new Error("缺少必要的參數: ledgerId, year, month");
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
      ledgerId: options.ledgerId,
      currentPeriod: currentReport,
      lastYearPeriod: lastYearReport,
      comparison: comparison,
      generatedAt: new Date()
    };

    GR_logInfo(`同比報表生成完成 [${processId}]`, "報表生成", options.userId || "", functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成同比報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "同比報表",
      error: `生成同比報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 09. 生成自訂報表
 * @version 2025-01-09-V2.0.9
 * @date 2025-01-09 15:30:00
 * @description 根據自訂條件生成報表
 */
async function GR_generateCustomReport(options = {}) {
  const functionName = "GR_generateCustomReport";
  const processId = `CUSTOM_${Date.now()}`;

  // 深度檢查
  if (!options.isRecursiveCall) {
    GR_requestDepth.depth++;
    GR_requestDepth.stack.push(functionName);
  }

  if (GR_requestDepth.depth > GR_requestDepth.maxDepth) {
    GR_logError(`檢測到可能的遞迴調用，當前深度: ${GR_requestDepth.depth}，調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`, "報表生成", options.userId || "", "GR_generateCustomReport");

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "自訂報表",
      error: `請求深度超過最大限制(${GR_requestDepth.maxDepth})，可能存在遞迴調用`,
      details: `調用堆疊: ${GR_requestDepth.stack.join(' -> ')}`
    };
  }

  try {
    if (!options.ledgerId || !options.startDate || !options.endDate) {
      throw new Error("缺少必要的參數: ledgerId, startDate, endDate");
    }

    GR_logInfo(`開始生成自訂報表 [${processId}]`, "報表生成", options.userId || "", functionName);

    // 建立篩選條件
    const filters = {
      startDate: new Date(options.startDate),
      endDate: new Date(options.endDate)
    };

    if (options.filters) {
      if (options.filters.category) {
        filters.category = options.filters.category;
      }
      if (options.filters.type) {
        filters.type = options.filters.type;
      }
      if (options.filters.paymentMethod) {
        filters.paymentMethod = options.filters.paymentMethod;
      }
    }

    // 獲取篩選後的記帳資料
    const entries = await GR_fetchLedgerData(options.ledgerId, filters);

    // 計算統計資料
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
      const amount = parseFloat(entry.amount) || 0;

      if (entry.type === '收入') {
        stats.totalIncome += amount;
      } else if (entry.type === '支出') {
        stats.totalExpense += amount;
      }

      // 分類統計
      if (!stats.categories[entry.category]) {
        stats.categories[entry.category] = { income: 0, expense: 0, count: 0 };
      }

      if (entry.type === '收入') {
        stats.categories[entry.category].income += amount;
      } else if (entry.type === '支出') {
        stats.categories[entry.category].expense += amount;
      }
      stats.categories[entry.category].count++;

      // 支付方式統計
      if (entry.paymentMethod) {
        if (!stats.paymentMethods[entry.paymentMethod]) {
          stats.paymentMethods[entry.paymentMethod] = { income: 0, expense: 0, count: 0 };
        }

        if (entry.type === '收入') {
          stats.paymentMethods[entry.paymentMethod].income += amount;
        } else if (entry.type === '支出') {
          stats.paymentMethods[entry.paymentMethod].expense += amount;
        }
        stats.paymentMethods[entry.paymentMethod].count++;
      }
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
      ledgerId: options.ledgerId,
      startDate: options.startDate,
      endDate: options.endDate,
      generatedAt: new Date(),
      statistics: stats,
      entries: entries,
      appliedFilters: options.filters || {}
    };

    GR_logInfo(`自訂報表生成完成 [${processId}]`, "報表生成", options.userId || "", functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return result;

  } catch (error) {
    GR_logError(`生成自訂報表失敗: ${error.message} [${processId}]`, "報表生成", options.userId || "", "REPORT_ERROR", error.toString(), functionName);

    if (!options.isRecursiveCall) {
      GR_requestDepth.depth--;
      GR_requestDepth.stack.pop();
    }

    return {
      success: false,
      type: "自訂報表",
      error: `生成自訂報表失敗: ${error.message}`,
      details: error.toString()
    };
  }
}

/**
 * 19. 處理報表請求 - 主要入口函數
 * @version 2025-01-09-V2.0.19
 * @date 2025-01-09 15:30:00
 * @description 根據請求類型分發到對應的報表生成函數
 */
async function GR_handleReportRequest(request) {
  const functionName = "GR_handleReportRequest";

  try {
    GR_logInfo(`收到報表請求: ${request.type}`, "報表處理", request.userId || "", functionName);

    if (!request.ledgerId) {
      throw new Error("請求中缺少 ledgerId 參數");
    }

    let result;

    switch (request.type) {
      case 'monthly':
        result = await GR_generateMonthlyReport({
          ledgerId: request.ledgerId,
          year: request.year,
          month: request.month,
          userId: request.userId
        });
        break;

      case 'yearly':
        result = await GR_generateYearlyReport({
          ledgerId: request.ledgerId,
          year: request.year,
          userId: request.userId
        });
        break;

      case 'category':
        result = await GR_generateCategoryReport({
          ledgerId: request.ledgerId,
          startDate: request.startDate,
          endDate: request.endDate,
          userId: request.userId
        });
        break;

      case 'yoy':
        result = await GR_generateYoYReport({
          ledgerId: request.ledgerId,
          year: request.year,
          month: request.month,
          userId: request.userId
        });
        break;

      case 'custom':
        result = await GR_generateCustomReport({
          ledgerId: request.ledgerId,
          startDate: request.startDate,
          endDate: request.endDate,
          filters: request.filters,
          userId: request.userId
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