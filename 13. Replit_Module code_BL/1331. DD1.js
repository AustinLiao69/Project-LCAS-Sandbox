/**
 * DD1_核心協調模組_4.0.0
 * @module 核心協調模組
 * @description Phase 1 API端點支援 - 專門處理6個核心API端點的商業邏輯協調
 * @author AustinLiao69
 * @update 2025-09-16: 階段一重構，升級版本至4.0.0，實作Phase 1核心API端點支援
 */

/**
 * 98. 各種定義
 */
const DD_TARGET_MODULE_BK = "BK"; // 記帳處理模組
const DD_TARGET_MODULE_WH = "WH"; // Webhook 模組
const DD_MODULE_PREFIX = "DD_";
const DD_CONFIG = {
  DEBUG: false, // 關閉DEBUG模式減少日誌輸出
  TIMEZONE: "Asia/Taipei", // GMT+8 台灣時區
  DEFAULT_SUBJECT: "其他支出",
  PHASE: "1", // Phase 1 標識
  API_VERSION: "4.0.0"
};

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

// 引入 Firebase Admin SDK
const admin = require("firebase-admin");

// 初始化 Firebase（如果尚未初始化）
if (!admin.apps.length) {
  const serviceAccount = require("./Serviceaccountkey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

/**
 * 01. 模組初始化與配置管理
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增Phase 1模組初始化支援所有API端點
 * @description 支援POST/GET/PUT/DELETE /transactions相關端點
 * @param {Object} config - 配置參數
 * @returns {Object} 初始化結果
 */
async function DD_initializeModule(config = {}) {
  const initId = uuidv4().substring(0, 8);

  try {
    console.log(`[${initId}] DD模組初始化檢查 - Phase ${DD_CONFIG.PHASE}`);
    console.log(`[${initId}] DD模組版本: ${DD_CONFIG.API_VERSION} (2025-09-16)`);
    console.log(`[${initId}] 執行時間 (UTC+8): ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);

    // 合併配置
    const moduleConfig = {
      ...DD_CONFIG,
      ...config,
      initId,
      initTime: new Date().toISOString()
    };

    // 檢查核心依賴
    const dependencies = {
      firebase: typeof db !== 'undefined' && db,
      uuid: typeof uuidv4 === 'function',
      moment: typeof moment !== 'undefined'
    };

    console.log(`[${initId}] 依賴檢查完成:`, dependencies);

    return {
      success: true,
      config: moduleConfig,
      dependencies,
      phase: DD_CONFIG.PHASE,
      apiVersion: DD_CONFIG.API_VERSION,
      supportedEndpoints: [
        'POST /transactions',
        'POST /transactions/quick',
        'GET /transactions',
        'GET /transactions/dashboard',
        'PUT /transactions/{id}',
        'DELETE /transactions/{id}'
      ]
    };
  } catch (error) {
    console.log(`[${initId}] 模組初始化失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      initId
    };
  }
}

/**
 * 02. Firebase連接初始化
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增Firebase連接驗證支援所有API端點
 * @description 支援所有Phase 1 API端點的Firebase連接
 * @param {string} userId - 使用者ID
 * @returns {Object} 連接狀態
 */
async function DD_initializeFirebaseConnection(userId) {
  const connId = uuidv4().substring(0, 8);

  try {
    console.log(`[${connId}] Firebase連接初始化 - 使用者: ${userId}`);

    // 檢查Firebase連接
    if (!db) {
      throw new Error("Firestore實例未初始化");
    }

    // 驗證使用者帳本存在
    const ledgerId = `user_${userId}`;
    const ledgerRef = db.collection("ledgers").doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    let ledgerStatus = "existing";
    if (!ledgerDoc.exists) {
      // 創建使用者帳本
      await ledgerRef.set({
        name: `${userId}的帳本`,
        type: "個人帳本",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        isActive: true,
        userId: userId,
        phase: DD_CONFIG.PHASE
      });
      ledgerStatus = "created";
      console.log(`[${connId}] 已創建使用者帳本: ${ledgerId}`);
    }

    console.log(`[${connId}] Firebase連接驗證成功`);

    return {
      success: true,
      connectionId: connId,
      ledgerId,
      ledgerStatus,
      firestore: {
        connected: true,
        collections: ['ledgers', 'transactions', 'subjects', 'log']
      },
      supportedOperations: ['read', 'write', 'update', 'delete']
    };
  } catch (error) {
    console.log(`[${connId}] Firebase連接初始化失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      connectionId: connId
    };
  }
}

/**
 * 03. 新增交易記錄處理
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增支援POST /transactions端點
 * @description 處理完整記帳表單的交易記錄新增
 * @param {Object} transactionData - 交易資料
 * @returns {Object} 處理結果
 */
async function DD_processCreateTransaction(transactionData) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始處理新增交易記錄`);

    // 驗證必要欄位
    const required = ['userId', 'amount', 'type', 'categoryId'];
    for (const field of required) {
      if (!transactionData[field]) {
        throw new Error(`缺少必要欄位: ${field}`);
      }
    }

    const { userId, amount, type, categoryId, accountId, description, date } = transactionData;

    // 初始化Firebase連接
    const firebaseResult = await DD_initializeFirebaseConnection(userId);
    if (!firebaseResult.success) {
      throw new Error(`Firebase連接失敗: ${firebaseResult.error}`);
    }

    // 準備交易資料
    const transaction = {
      id: uuidv4(),
      userId,
      amount: parseFloat(amount),
      type, // 'income' or 'expense'
      categoryId,
      accountId: accountId || 'default',
      description: description || '',
      date: date || new Date().toISOString(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      processId,
      source: 'APP_FORM'
    };

    // 寫入Firestore
    const ledgerId = firebaseResult.ledgerId;
    await db.collection("ledgers")
      .doc(ledgerId)
      .collection("transactions")
      .doc(transaction.id)
      .set(transaction);

    console.log(`[${processId}] 交易記錄已創建: ${transaction.id}`);

    return {
      success: true,
      data: {
        transactionId: transaction.id,
        amount: transaction.amount,
        type: transaction.type,
        category: categoryId,
        account: accountId || 'default',
        date: transaction.date,
        processId
      },
      endpoint: 'POST /transactions'
    };
  } catch (error) {
    console.log(`[${processId}] 新增交易記錄失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId,
      endpoint: 'POST /transactions'
    };
  }
}

/**
 * 04. 快速記帳處理
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增支援POST /transactions/quick端點
 * @description 處理LINE OA快速記帳功能
 * @param {Object} quickData - 快速記帳資料
 * @returns {Object} 處理結果
 */
async function DD_processQuickBookkeeping(quickData) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始處理快速記帳`);

    const { input, userId, ledgerId } = quickData;

    if (!input || !userId) {
      throw new Error("缺少必要資料: input 或 userId");
    }

    // 初始化Firebase連接
    const firebaseResult = await DD_initializeFirebaseConnection(userId);
    if (!firebaseResult.success) {
      throw new Error(`Firebase連接失敗: ${firebaseResult.error}`);
    }

    // 解析輸入文字 (簡化版本，實際應整合DD2智慧處理)
    const parseResult = DD_parseQuickInput(input);
    if (!parseResult.success) {
      throw new Error(`解析失敗: ${parseResult.error}`);
    }

    // 創建交易記錄
    const transaction = {
      id: uuidv4(),
      userId,
      amount: parseResult.amount,
      type: parseResult.type,
      category: parseResult.category,
      description: parseResult.description,
      date: new Date().toISOString(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      processId,
      source: 'LINE_QUICK'
    };

    // 寫入Firestore
    const targetLedgerId = firebaseResult.ledgerId;
    await db.collection("ledgers")
      .doc(targetLedgerId)
      .collection("transactions")
      .doc(transaction.id)
      .set(transaction);

    console.log(`[${processId}] 快速記帳完成: ${transaction.id}`);

    return {
      success: true,
      data: {
        transactionId: transaction.id,
        parsed: {
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          description: transaction.description
        },
        confirmation: `✅ 已記錄${transaction.type === 'expense' ? '支出' : '收入'} NT$${transaction.amount} - ${transaction.description}`,
        processId
      },
      endpoint: 'POST /transactions/quick'
    };
  } catch (error) {
    console.log(`[${processId}] 快速記帳失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId,
      endpoint: 'POST /transactions/quick'
    };
  }
}

/**
 * 05. 查詢交易列表處理
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增支援GET /transactions端點
 * @description 查詢使用者的交易記錄列表
 * @param {Object} queryParams - 查詢參數
 * @returns {Object} 查詢結果
 */
async function DD_processGetTransactions(queryParams) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始查詢交易列表`);

    const { userId, page = 1, limit = 20, type, startDate, endDate } = queryParams;

    if (!userId) {
      throw new Error("缺少使用者ID");
    }

    // 初始化Firebase連接
    const firebaseResult = await DD_initializeFirebaseConnection(userId);
    if (!firebaseResult.success) {
      throw new Error(`Firebase連接失敗: ${firebaseResult.error}`);
    }

    // 建立查詢
    let query = db.collection("ledgers")
      .doc(firebaseResult.ledgerId)
      .collection("transactions")
      .orderBy("createdAt", "desc");

    // 添加篩選條件
    if (type) {
      query = query.where("type", "==", type);
    }

    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
      query = query.where("createdAt", ">=", startTimestamp);
    }

    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
      query = query.where("createdAt", "<=", endTimestamp);
    }

    // 分頁處理
    const offset = (page - 1) * limit;
    if (offset > 0) {
      query = query.offset(offset);
    }
    query = query.limit(parseInt(limit));

    // 執行查詢
    const snapshot = await query.get();
    const transactions = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate().toISOString(),
        updatedAt: data.updatedAt.toDate().toISOString()
      });
    });

    console.log(`[${processId}] 查詢完成，返回 ${transactions.length} 筆記錄`);

    return {
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: transactions.length,
          hasMore: transactions.length === parseInt(limit)
        },
        processId
      },
      endpoint: 'GET /transactions'
    };
  } catch (error) {
    console.log(`[${processId}] 查詢交易列表失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId,
      endpoint: 'GET /transactions'
    };
  }
}

/**
 * 06. 查詢儀表板數據處理
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增支援GET /transactions/dashboard端點
 * @description 提供記帳主頁的統計數據
 * @param {Object} params - 查詢參數
 * @returns {Object} 儀表板數據
 */
async function DD_processGetDashboard(params) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始查詢儀表板數據`);

    const { userId, userMode = 'Expert' } = params;

    if (!userId) {
      throw new Error("缺少使用者ID");
    }

    // 初始化Firebase連接
    const firebaseResult = await DD_initializeFirebaseConnection(userId);
    if (!firebaseResult.success) {
      throw new Error(`Firebase連接失敗: ${firebaseResult.error}`);
    }

    // 查詢本月交易記錄
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const monthStartTimestamp = admin.firestore.Timestamp.fromDate(monthStart);
    const dayStartTimestamp = admin.firestore.Timestamp.fromDate(dayStart);

    // 查詢月度數據
    const monthQuery = db.collection("ledgers")
      .doc(firebaseResult.ledgerId)
      .collection("transactions")
      .where("createdAt", ">=", monthStartTimestamp);

    const monthSnapshot = await monthQuery.get();

    // 查詢今日數據
    const dayQuery = db.collection("ledgers")
      .doc(firebaseResult.ledgerId)
      .collection("transactions")
      .where("createdAt", ">=", dayStartTimestamp);

    const daySnapshot = await dayQuery.get();

    // 統計數據
    let monthIncome = 0, monthExpense = 0;
    let todayIncome = 0, todayExpense = 0;
    const recentTransactions = [];

    monthSnapshot.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount) || 0;

      if (data.type === 'income') {
        monthIncome += amount;
      } else if (data.type === 'expense') {
        monthExpense += amount;
      }

      recentTransactions.push({
        id: doc.id,
        amount: data.amount,
        type: data.type,
        description: data.description,
        date: data.createdAt.toDate().toISOString()
      });
    });

    daySnapshot.forEach(doc => {
      const data = doc.data();
      const amount = parseFloat(data.amount) || 0;

      if (data.type === 'income') {
        todayIncome += amount;
      } else if (data.type === 'expense') {
        todayExpense += amount;
      }
    });

    // 根據用戶模式調整回應
    const dashboardData = DD_formatDashboardByMode({
      summary: {
        todayIncome,
        todayExpense,
        monthIncome,
        monthExpense,
        balance: monthIncome - monthExpense
      },
      recentTransactions: recentTransactions.slice(0, 10),
      processId
    }, userMode);

    console.log(`[${processId}] 儀表板數據查詢完成`);

    return {
      success: true,
      data: dashboardData,
      endpoint: 'GET /transactions/dashboard'
    };
  } catch (error) {
    console.log(`[${processId}] 查詢儀表板數據失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId,
      endpoint: 'GET /transactions/dashboard'
    };
  }
}

/**
 * 07. 更新交易記錄處理
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增支援PUT /transactions/{id}端點
 * @description 更新指定的交易記錄
 * @param {Object} updateData - 更新資料
 * @returns {Object} 更新結果
 */
async function DD_processUpdateTransaction(updateData) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始更新交易記錄`);

    const { transactionId, userId, ...updateFields } = updateData;

    if (!transactionId || !userId) {
      throw new Error("缺少交易ID或使用者ID");
    }

    // 初始化Firebase連接
    const firebaseResult = await DD_initializeFirebaseConnection(userId);
    if (!firebaseResult.success) {
      throw new Error(`Firebase連接失敗: ${firebaseResult.error}`);
    }

    // 檢查交易記錄是否存在
    const transactionRef = db.collection("ledgers")
      .doc(firebaseResult.ledgerId)
      .collection("transactions")
      .doc(transactionId);

    const transactionDoc = await transactionRef.get();
    if (!transactionDoc.exists) {
      throw new Error("交易記錄不存在");
    }

    // 準備更新資料
    const updatedData = {
      ...updateFields,
      updatedAt: admin.firestore.Timestamp.now(),
      processId
    };

    // 移除undefined值
    Object.keys(updatedData).forEach(key => {
      if (updatedData[key] === undefined) {
        delete updatedData[key];
      }
    });

    // 執行更新
    await transactionRef.update(updatedData);

    console.log(`[${processId}] 交易記錄更新完成: ${transactionId}`);

    return {
      success: true,
      data: {
        transactionId,
        updatedFields: Object.keys(updateFields),
        updatedAt: updatedData.updatedAt.toDate().toISOString(),
        processId
      },
      endpoint: 'PUT /transactions/{id}'
    };
  } catch (error) {
    console.log(`[${processId}] 更新交易記錄失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId,
      endpoint: 'PUT /transactions/{id}'
    };
  }
}

/**
 * 08. 刪除交易記錄處理
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增支援DELETE /transactions/{id}端點
 * @description 刪除指定的交易記錄
 * @param {Object} deleteData - 刪除資料
 * @returns {Object} 刪除結果
 */
async function DD_processDeleteTransaction(deleteData) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始刪除交易記錄`);

    const { transactionId, userId } = deleteData;

    if (!transactionId || !userId) {
      throw new Error("缺少交易ID或使用者ID");
    }

    // 初始化Firebase連接
    const firebaseResult = await DD_initializeFirebaseConnection(userId);
    if (!firebaseResult.success) {
      throw new Error(`Firebase連接失敗: ${firebaseResult.error}`);
    }

    // 檢查交易記錄是否存在
    const transactionRef = db.collection("ledgers")
      .doc(firebaseResult.ledgerId)
      .collection("transactions")
      .doc(transactionId);

    const transactionDoc = await transactionRef.get();
    if (!transactionDoc.exists) {
      throw new Error("交易記錄不存在");
    }

    // 備份交易記錄（軟刪除）
    const transactionData = transactionDoc.data();
    await db.collection("ledgers")
      .doc(firebaseResult.ledgerId)
      .collection("deleted_transactions")
      .doc(transactionId)
      .set({
        ...transactionData,
        deletedAt: admin.firestore.Timestamp.now(),
        deletedBy: userId,
        processId
      });

    // 執行刪除
    await transactionRef.delete();

    console.log(`[${processId}] 交易記錄刪除完成: ${transactionId}`);

    return {
      success: true,
      data: {
        transactionId,
        deletedAt: new Date().toISOString(),
        backedUp: true,
        processId
      },
      endpoint: 'DELETE /transactions/{id}'
    };
  } catch (error) {
    console.log(`[${processId}] 刪除交易記錄失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId,
      endpoint: 'DELETE /transactions/{id}'
    };
  }
}

// === 階段二：API端點輔助與驗證函數 ===

/**
 * 09. 記帳數據驗證 - 支援所有交易相關端點
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增完整交易數據驗證機制，支援所有API端點
 * @description 驗證交易數據的完整性和有效性
 * @param {Object} transactionData - 交易數據
 * @returns {Object} 驗證結果
 */
function DD_validateTransactionData(transactionData) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始驗證交易數據`);

    const errors = [];
    const warnings = [];

    // 必要欄位檢查
    if (!transactionData.amount || typeof transactionData.amount !== 'number') {
      errors.push('金額必須是有效數字');
    } else if (transactionData.amount <= 0) {
      errors.push('金額必須大於0');
    } else if (transactionData.amount > 999999999) {
      errors.push('金額不能超過999,999,999');
    }

    if (!transactionData.type || !['income', 'expense'].includes(transactionData.type)) {
      errors.push('交易類型必須是income或expense');
    }

    if (!transactionData.userId || typeof transactionData.userId !== 'string') {
      errors.push('使用者ID不能為空');
    }

    // 選填欄位檢查
    if (transactionData.description && transactionData.description.length > 200) {
      warnings.push('備註超過200字元，將被截斷');
    }

    if (transactionData.categoryId && typeof transactionData.categoryId !== 'string') {
      warnings.push('類別ID格式不正確');
    }

    if (transactionData.accountId && typeof transactionData.accountId !== 'string') {
      warnings.push('帳戶ID格式不正確');
    }

    // 日期格式檢查
    if (transactionData.date) {
      const dateObj = new Date(transactionData.date);
      if (isNaN(dateObj.getTime())) {
        errors.push('日期格式不正確');
      }
    }

    console.log(`[${processId}] 驗證完成 - 錯誤:${errors.length}個, 警告:${warnings.length}個`);

    return {
      success: errors.length === 0,
      errors: errors,
      warnings: warnings,
      processId: processId,
      validatedData: errors.length === 0 ? {
        amount: parseFloat(transactionData.amount.toFixed(2)),
        type: transactionData.type,
        userId: transactionData.userId,
        categoryId: transactionData.categoryId || 'default',
        accountId: transactionData.accountId || 'default',
        description: transactionData.description ? 
          transactionData.description.substring(0, 200) : '',
        date: transactionData.date || new Date().toISOString()
      } : null
    };

  } catch (error) {
    console.log(`[${processId}] 驗證過程錯誤: ${error.toString()}`);
    return {
      success: false,
      errors: [`驗證過程錯誤: ${error.toString()}`],
      warnings: [],
      processId: processId
    };
  }
}

/**
 * 10. 生成唯一交易ID - 支援POST相關端點
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增強化交易ID生成演算法
 * @description 生成唯一的交易ID，包含時間戳和隨機元素
 * @param {string} processId - 處理ID（可選）
 * @returns {Promise<string>} 唯一交易ID
 */
async function DD_generateTransactionId(processId) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');

    // 生成隨機後綴
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 組合交易ID: YYYYMMDD-HHMMSS-SSS-RANDOM
    const transactionId = `${year}${month}${day}-${hours}${minutes}${seconds}-${milliseconds}-${randomSuffix}`;

    console.log(`交易ID生成成功: ${transactionId}`);
    return transactionId;

  } catch (error) {
    console.log(`交易ID生成失敗: ${error.toString()}`);
    // 降級方案
    const fallbackId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    return fallbackId;
  }
}

/**
 * 11. 支付方式驗證 - 支援所有交易端點
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增完整支付方式驗證邏輯
 * @description 驗證支付方式的有效性
 * @param {string} paymentMethod - 支付方式
 * @returns {Object} 驗證結果
 */
function DD_validatePaymentMethod(paymentMethod) {
  const validMethods = [
    '現金', '刷卡', '轉帳', '行動支付',
    'LINE Pay', '街口支付', '悠遊卡', '一卡通',
    '信用卡', '金融卡', '支票', '其他'
  ];

  try {
    if (!paymentMethod || typeof paymentMethod !== 'string') {
      return {
        success: false,
        error: '支付方式不能為空',
        validMethods: validMethods,
        normalized: '現金'
      };
    }

    const trimmed = paymentMethod.trim();

    // 完全匹配
    if (validMethods.includes(trimmed)) {
      return {
        success: true,
        normalized: trimmed,
        validMethods: validMethods
      };
    }

    // 模糊匹配
    const fuzzyMatch = validMethods.find(method => 
      method.includes(trimmed) || trimmed.includes(method)
    );

    if (fuzzyMatch) {
      return {
        success: true,
        normalized: fuzzyMatch,
        validMethods: validMethods,
        warning: `已自動修正為: ${fuzzyMatch}`
      };
    }

    return {
      success: false,
      error: `不支援的支付方式: ${trimmed}`,
      validMethods: validMethods,
      normalized: '其他'
    };

  } catch (error) {
    return {
      success: false,
      error: `支付方式驗證錯誤: ${error.toString()}`,
      validMethods: validMethods,
      normalized: '現金'
    };
  }
}

/**
 * 12. 統計數據生成 - 支援GET /transactions/dashboard
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增儀表板統計數據生成功能
 * @description 根據交易數據生成統計信息
 * @param {Array} transactions - 交易記錄陣列
 * @param {Object} options - 統計選項
 * @returns {Object} 統計數據
 */
function DD_generateStatistics(transactions, options = {}) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始生成統計數據，交易筆數: ${transactions.length}`);

    if (!Array.isArray(transactions)) {
      transactions = [];
    }

    const stats = {
      summary: {
        totalTransactions: transactions.length,
        totalIncome: 0,
        totalExpense: 0,
        netIncome: 0,
        averageIncome: 0,
        averageExpense: 0
      },
      categories: {},
      paymentMethods: {},
      dailyTrends: {},
      monthlyTrends: {},
      processId: processId
    };

    let incomeCount = 0;
    let expenseCount = 0;

    // 處理每筆交易
    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount) || 0;
      const type = transaction.type;
      const category = transaction.category || '其他';
      const paymentMethod = transaction.paymentMethod || '現金';
      const date = transaction.date ? transaction.date.split('T')[0] : '';

      // 收入支出統計
      if (type === 'income') {
        stats.summary.totalIncome += amount;
        incomeCount++;
      } else if (type === 'expense') {
        stats.summary.totalExpense += amount;
        expenseCount++;
      }

      // 分類統計
      if (!stats.categories[category]) {
        stats.categories[category] = {
          income: 0,
          expense: 0,
          count: 0
        };
      }
      stats.categories[category][type] += amount;
      stats.categories[category].count++;

      // 支付方式統計
      if (!stats.paymentMethods[paymentMethod]) {
        stats.paymentMethods[paymentMethod] = {
          amount: 0,
          count: 0
        };
      }
      stats.paymentMethods[paymentMethod].amount += amount;
      stats.paymentMethods[paymentMethod].count++;

      // 每日趨勢
      if (date) {
        if (!stats.dailyTrends[date]) {
          stats.dailyTrends[date] = {
            income: 0,
            expense: 0,
            count: 0
          };
        }
        stats.dailyTrends[date][type] += amount;
        stats.dailyTrends[date].count++;
      }
    });

    // 計算衍生統計
    stats.summary.netIncome = stats.summary.totalIncome - stats.summary.totalExpense;
    stats.summary.averageIncome = incomeCount > 0 ? 
      stats.summary.totalIncome / incomeCount : 0;
    stats.summary.averageExpense = expenseCount > 0 ? 
      stats.summary.totalExpense / expenseCount : 0;

    // 計算儲蓄率
    stats.summary.savingsRate = stats.summary.totalIncome > 0 ? 
      (stats.summary.netIncome / stats.summary.totalIncome * 100) : 0;

    console.log(`[${processId}] 統計數據生成完成`);

    return {
      success: true,
      data: stats
    };

  } catch (error) {
    console.log(`[${processId}] 統計數據生成失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId: processId
    };
  }
}

/**
 * 13. 交易查詢過濾 - 支援GET /transactions
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增強化查詢過濾功能
 * @description 根據查詢參數過濾交易記錄
 * @param {Array} transactions - 所有交易記錄
 * @param {Object} filters - 過濾條件
 * @returns {Object} 過濾結果
 */
function DD_filterTransactions(transactions, filters = {}) {
  const processId = uuidv4().substring(0, 8);

  try {
    console.log(`[${processId}] 開始過濾交易，原始筆數: ${transactions.length}`);

    if (!Array.isArray(transactions)) {
      return {
        success: false,
        error: '交易數據格式錯誤',
        processId: processId
      };
    }

    let filtered = [...transactions];
    const appliedFilters = [];

    // 交易類型過濾
    if (filters.type && ['income', 'expense'].includes(filters.type)) {
      filtered = filtered.filter(t => t.type === filters.type);
      appliedFilters.push(`type: ${filters.type}`);
    }

    // 日期範圍過濾
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filtered = filtered.filter(t => new Date(t.date) >= startDate);
      appliedFilters.push(`startDate: ${filters.startDate}`);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filtered = filtered.filter(t => new Date(t.date) <= endDate);
      appliedFilters.push(`endDate: ${filters.endDate}`);
    }

    // 金額範圍過濾
    if (filters.minAmount !== undefined) {
      filtered = filtered.filter(t => t.amount >= filters.minAmount);
      appliedFilters.push(`minAmount: ${filters.minAmount}`);
    }

    if (filters.maxAmount !== undefined) {
      filtered = filtered.filter(t => t.amount <= filters.maxAmount);
      appliedFilters.push(`maxAmount: ${filters.maxAmount}`);
    }

    // 分類過濾
    if (filters.category) {
      filtered = filtered.filter(t => 
        t.category && t.category.includes(filters.category)
      );
      appliedFilters.push(`category: ${filters.category}`);
    }

    // 支付方式過濾
    if (filters.paymentMethod) {
      filtered = filtered.filter(t => t.paymentMethod === filters.paymentMethod);
      appliedFilters.push(`paymentMethod: ${filters.paymentMethod}`);
    }

    // 關鍵字搜尋
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        (t.description && t.description.toLowerCase().includes(searchTerm)) ||
        (t.category && t.category.toLowerCase().includes(searchTerm))
      );
      appliedFilters.push(`search: ${filters.search}`);
    }

    // 排序
    if (filters.sortBy) {
      const sortField = filters.sortBy;
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      
      filtered.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        if (sortField === 'date') {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }
        
        if (aVal < bVal) return -1 * sortOrder;
        if (aVal > bVal) return 1 * sortOrder;
        return 0;
      });
      appliedFilters.push(`sort: ${sortField} ${filters.sortOrder || 'desc'}`);
    }

    // 分頁
    let paginatedResults = filtered;
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    
    if (filters.page || filters.limit) {
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      paginatedResults = filtered.slice(startIndex, endIndex);
      appliedFilters.push(`pagination: page ${page}, limit ${limit}`);
    }

    console.log(`[${processId}] 過濾完成，結果筆數: ${paginatedResults.length}`);

    return {
      success: true,
      data: {
        transactions: paginatedResults,
        pagination: {
          page: page,
          limit: limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
          hasNext: page * limit < filtered.length,
          hasPrev: page > 1
        },
        appliedFilters: appliedFilters,
        processId: processId
      }
    };

  } catch (error) {
    console.log(`[${processId}] 交易過濾失敗: ${error.toString()}`);
    return {
      success: false,
      error: error.toString(),
      processId: processId
    };
  }
}

/**
 * 14. 錯誤處理機制 - 支援所有端點
 * @version 2025-09-16-V4.0.0
 * @date 2025-09-16
 * @update: 新增統一錯誤處理機制
 * @description 統一處理各種錯誤情況
 * @param {Error|Object} error - 錯誤對象
 * @param {Object} context - 錯誤上下文
 * @returns {Object} 標準化錯誤響應
 */
function DD_handleError(error, context = {}) {
  const processId = context.processId || uuidv4().substring(0, 8);

  try {
    // 錯誤分類
    const errorTypes = {
      'VALIDATION_ERROR': { level: 'WARNING', code: 400 },
      'NOT_FOUND': { level: 'INFO', code: 404 },
      'FIREBASE_ERROR': { level: 'ERROR', code: 503 },
      'PERMISSION_ERROR': { level: 'WARNING', code: 403 },
      'RATE_LIMIT_ERROR': { level: 'WARNING', code: 429 },
      'SYSTEM_ERROR': { level: 'ERROR', code: 500 },
      'UNKNOWN_ERROR': { level: 'ERROR', code: 500 }
    };

    const errorType = error.type || error.errorType || 'UNKNOWN_ERROR';
    const errorInfo = errorTypes[errorType] || errorTypes['UNKNOWN_ERROR'];

    const standardError = {
      success: false,
      error: {
        type: errorType,
        message: error.message || error.toString(),
        code: errorInfo.code,
        timestamp: new Date().toISOString(),
        processId: processId
      }
    };

    // 添加上下文信息
    if (context.operation) standardError.error.operation = context.operation;
    if (context.userId) standardError.error.userId = context.userId;
    if (context.endpoint) standardError.error.endpoint = context.endpoint;

    // 添加詳細信息（開發模式）
    if (process.env.NODE_ENV === 'development') {
      standardError.error.details = error.stack || error.details;
    }

    // 用戶友善訊息
    standardError.userMessage = DD_getUserFriendlyMessage(errorType);

    console.log(`[${processId}] 錯誤處理完成: ${errorType}`);

    return standardError;

  } catch (handlingError) {
    // 錯誤處理失敗的備用方案
    console.log(`[${processId}] 錯誤處理失敗: ${handlingError.toString()}`);
    return {
      success: false,
      error: {
        type: 'ERROR_HANDLING_FAILED',
        message: '系統錯誤處理失敗',
        code: 500,
        timestamp: new Date().toISOString(),
        processId: processId
      },
      userMessage: '系統發生未知錯誤，請稍後再試'
    };
  }
}

/**
 * 取得用戶友善錯誤訊息
 */
function DD_getUserFriendlyMessage(errorType) {
  const messages = {
    'VALIDATION_ERROR': '輸入資料格式不正確，請檢查後重試',
    'NOT_FOUND': '找不到相關記錄',
    'FIREBASE_ERROR': '資料庫連線異常，請稍後再試',
    'PERMISSION_ERROR': '權限不足，無法執行此操作',
    'RATE_LIMIT_ERROR': '操作過於頻繁，請稍後再試',
    'SYSTEM_ERROR': '系統發生錯誤，請聯繫客服',
    'UNKNOWN_ERROR': '發生未知錯誤，請稍後再試'
  };

  return messages[errorType] || messages['UNKNOWN_ERROR'];
}

// === 原有輔助函數 ===

/**
 * 解析快速輸入文字（簡化版本）
 */
function DD_parseQuickInput(input) {
  try {
    // 簡單的正則表達式解析 "描述 金額" 格式
    const match = input.match(/^(.+?)\s+(\d+)$/);
    if (!match) {
      throw new Error("無法解析輸入格式");
    }

    const [, description, amount] = match;

    return {
      success: true,
      amount: parseFloat(amount),
      type: 'expense', // 預設為支出
      category: '其他支出',
      description: description.trim()
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 根據用戶模式格式化儀表板數據
 */
function DD_formatDashboardByMode(data, userMode) {
  switch (userMode) {
    case 'Expert':
      return {
        ...data,
        charts: {
          weeklyTrend: [],
          categoryDistribution: []
        },
        budgetStatus: [],
        quickActions: [
          { action: "addTransaction", label: "快速記帳" },
          { action: "viewReports", label: "查看報表" }
        ]
      };

    case 'Guiding':
      return {
        todayExpense: data.summary.todayExpense,
        quickAddButton: true,
        simpleMessage: `今天已花費 NT$${data.summary.todayExpense}`
      };

    default:
      return data;
  }
}

// 保留原有的兼容性函數
const DD_distributeData = DD_processCreateTransaction;
const DD_getAllSubjects = async (userId) => {
  const firebaseResult = await DD_initializeFirebaseConnection(userId);
  if (!firebaseResult.success) return [];

  // 簡化版科目查詢
  return [
    { majorCode: '01', majorName: '食物', subCode: '0101', subName: '餐費', synonyms: '吃飯,用餐' }
  ];
};

// 引入DD3模組的格式化函數
const DD3 = require("./1333. DD3.js");
const { DD_formatSystemReplyMessage } = DD3;

// 引入其他模組
const WH = require('./1320. WH.js');
const DD2 = require('./1332. DD2.js');

// 模組暴露
module.exports = {
  // Phase 1 核心函數
  DD_initializeModule,
  DD_initializeFirebaseConnection,
  DD_processCreateTransaction,
  DD_processQuickBookkeeping,
  DD_processGetTransactions,
  DD_processGetDashboard,
  DD_processUpdateTransaction,
  DD_processDeleteTransaction,

  // Phase 1 階段二：API端點輔助與驗證函數
  DD_validateTransactionData,
  DD_generateTransactionId,
  DD_validatePaymentMethod,
  DD_generateStatistics,
  DD_filterTransactions,
  DD_handleError,

  // 兼容性函數
  DD_distributeData,
  DD_getAllSubjects,

  // 配置
  DD_CONFIG,

  // 輔助函數 (供內部或需要時使用)
  DD_parseQuickInput,
  DD_formatDashboardByMode,
  DD_getUserFriendlyMessage,
  DD_formatSystemReplyMessage // 暴露此函數以供外部模組使用
};