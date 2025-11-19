
/**
 * 1350. WCM.js_帳戶與科目管理模組_v1.1.0
 * @module 帳戶與科目管理模組
 * @description LCAS 2.0 Wallet and Category Management - 統一處理帳戶與科目的基礎主數據管理 (子集合架構)
 * @update 2025-11-19: 階段二修正 - 調整為子集合架構 ledgers/{ledgerId}/wallets 和 ledgers/{ledgerId}/categories
 * @date 2025-11-19
 */

/**
 * WCM模組配置與初始化
 */
const moment = require('moment-timezone');
const admin = require('firebase-admin');

// 引入依賴模組
const DL = require('./1310. DL.js');
const FS = require('./1311. FS.js');
const AM = require('./1309. AM.js');

// WCM模組配置
const WCM_CONFIG = {
  VERSION: '1.1.0',
  DEBUG: process.env.WCM_DEBUG === 'true',
  TIMEZONE: process.env.TIMEZONE || 'Asia/Taipei',
  DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY || 'TWD',
  MAX_WALLET_NAME_LENGTH: 50,
  MAX_CATEGORY_NAME_LENGTH: 30
};

// 模組初始化狀態
let WCM_INIT_STATUS = {
  initialized: false,
  lastInitTime: 0,
  moduleVersion: WCM_CONFIG.VERSION
};

/**
 * WCM統一成功回應格式
 * @version 2025-11-19-V1.1.0
 * @description 確保所有WCM函數回傳格式符合DCN-0015規範
 */
function WCM_formatSuccessResponse(data, message = "操作成功", error = null) {
  return {
    success: true,
    data: data,
    message: message,
    error: error
  };
}

/**
 * WCM統一錯誤回應格式
 * @version 2025-11-19-V1.1.0
 * @description 統一錯誤處理格式，符合DCN-0015規範
 */
function WCM_formatErrorResponse(errorCode, message, details = null) {
  return {
    success: false,
    data: null,
    message: message || "操作失敗",
    error: {
      code: errorCode || "UNKNOWN_ERROR",
      message: message || "操作失敗",
      details: details,
      timestamp: new Date().toISOString(),
      module: 'WCM',
      version: WCM_CONFIG.VERSION
    }
  };
}

/**
 * WCM模組初始化
 * @version 2025-11-19-V1.1.0
 * @description 初始化WCM模組，建立與Firebase的連接
 */
async function WCM_initialize() {
  const currentTime = new Date().getTime();
  
  if (WCM_INIT_STATUS.initialized && 
      (currentTime - WCM_INIT_STATUS.lastInitTime) < 300000) {
    return true;
  }

  try {
    WCM_logInfo(`WCM模組v${WCM_CONFIG.VERSION}初始化開始 - 子集合架構`, "系統初始化", "", "WCM_initialize");

    // 檢查Firebase連接
    if (!admin.apps.length) {
      throw new Error("Firebase Admin SDK 未初始化");
    }

    // 檢查依賴模組
    if (!DL || typeof DL.DL_initialize !== 'function') {
      WCM_logWarning("DL模組未找到，將使用原生日誌", "系統初始化", "", "WCM_initialize");
    }

    WCM_INIT_STATUS.initialized = true;
    WCM_INIT_STATUS.lastInitTime = currentTime;

    WCM_logInfo(`WCM模組初始化完成v${WCM_CONFIG.VERSION} - 子集合架構`, "系統初始化", "", "WCM_initialize");
    return true;

  } catch (error) {
    WCM_logError(`WCM模組初始化失敗: ${error.message}`, "系統初始化", "", "WCM_INIT_ERROR", error.toString(), "WCM_initialize");
    return false;
  }
}

// =================== 帳戶管理函數 (子集合架構) ===================

/**
 * 01. 創建帳戶 (子集合架構)
 * @version 2025-11-19-V1.1.0
 * @description 創建新的帳戶記錄到 ledgers/{ledgerId}/wallets
 * @param {string} ledgerId - 帳本ID
 * @param {Object} walletData - 帳戶資料
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_createWallet(ledgerId, walletData) {
  const functionName = "WCM_createWallet";
  
  try {
    WCM_logInfo(`開始創建帳戶: ${walletData.name} (帳本: ${ledgerId})`, "創建帳戶", walletData.userId || "", functionName);

    // 基本參數驗證
    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!walletData || typeof walletData !== 'object') {
      return WCM_formatErrorResponse("INVALID_WALLET_DATA", "無效的帳戶資料");
    }

    if (!walletData.name || walletData.name.trim() === '') {
      return WCM_formatErrorResponse("MISSING_WALLET_NAME", "帳戶名稱不能為空");
    }

    if (walletData.name.length > WCM_CONFIG.MAX_WALLET_NAME_LENGTH) {
      return WCM_formatErrorResponse("WALLET_NAME_TOO_LONG", `帳戶名稱不能超過${WCM_CONFIG.MAX_WALLET_NAME_LENGTH}字元`);
    }

    if (!walletData.userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    // 準備帳戶資料
    const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = admin.firestore.Timestamp.now();

    const wallet = {
      id: walletId,
      name: walletData.name.trim(),
      type: walletData.type || 'cash',
      currency: walletData.currency || WCM_CONFIG.DEFAULT_CURRENCY,
      balance: parseFloat(walletData.balance) || 0,
      userId: walletData.userId,
      ledgerId: ledgerId,
      description: walletData.description || '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      module: 'WCM',
      version: WCM_CONFIG.VERSION
    };

    // 儲存至Firebase子集合
    const db = admin.firestore();
    const collectionPath = `ledgers/${ledgerId}/wallets`;
    await db.collection(collectionPath).doc(walletId).set(wallet);

    WCM_logInfo(`帳戶創建成功: ${walletId} (路徑: ${collectionPath}/${walletId})`, "創建帳戶", walletData.userId, functionName);

    return WCM_formatSuccessResponse({
      walletId: walletId,
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      balance: wallet.balance,
      ledgerId: ledgerId,
      path: `${collectionPath}/${walletId}`
    }, "帳戶創建成功");

  } catch (error) {
    WCM_logError(`創建帳戶失敗: ${error.message}`, "創建帳戶", walletData?.userId || "", "CREATE_WALLET_ERROR", error.toString(), functionName);
    return WCM_formatErrorResponse("CREATE_WALLET_ERROR", error.message, error.toString());
  }
}

/**
 * 02. 取得帳戶列表 (子集合架構)
 * @version 2025-11-19-V1.1.0
 * @description 取得指定帳本的帳戶列表
 * @param {string} ledgerId - 帳本ID
 * @param {Object} queryParams - 查詢參數
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_getWalletList(ledgerId, queryParams = {}) {
  const functionName = "WCM_getWalletList";
  
  try {
    WCM_logInfo(`開始查詢帳戶列表 (帳本: ${ledgerId})`, "查詢帳戶", queryParams.userId || "", functionName);

    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!queryParams.userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    const db = admin.firestore();
    const collectionPath = `ledgers/${ledgerId}/wallets`;
    let query = db.collection(collectionPath)
      .where('userId', '==', queryParams.userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc');

    // 限制查詢筆數
    const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
    query = query.limit(limit);

    const snapshot = await query.get();
    const wallets = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      wallets.push({
        id: data.id || doc.id,
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: data.balance,
        description: data.description,
        ledgerId: data.ledgerId,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : null
      });
    });

    WCM_logInfo(`查詢帳戶列表完成，返回${wallets.length}筆記錄 (路徑: ${collectionPath})`, "查詢帳戶", queryParams.userId, functionName);

    return WCM_formatSuccessResponse({
      wallets: wallets,
      total: wallets.length,
      limit: limit,
      ledgerId: ledgerId,
      collectionPath: collectionPath
    }, "帳戶列表查詢成功");

  } catch (error) {
    WCM_logError(`查詢帳戶列表失敗: ${error.message}`, "查詢帳戶", queryParams?.userId || "", "GET_WALLET_LIST_ERROR", error.toString(), functionName);
    return WCM_formatErrorResponse("GET_WALLET_LIST_ERROR", error.message, error.toString());
  }
}

/**
 * 03. 驗證帳戶存在 (子集合架構)
 * @version 2025-11-19-V1.1.0
 * @description 驗證指定帳戶是否存在且屬於用戶
 * @param {string} ledgerId - 帳本ID
 * @param {string} walletId - 帳戶ID
 * @param {string} userId - 用戶ID
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_validateWalletExists(ledgerId, walletId, userId) {
  const functionName = "WCM_validateWalletExists";
  
  try {
    WCM_logInfo(`開始驗證帳戶存在: ${walletId} (帳本: ${ledgerId})`, "驗證帳戶", userId || "", functionName);

    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!walletId || typeof walletId !== 'string') {
      return WCM_formatErrorResponse("INVALID_WALLET_ID", "無效的帳戶ID");
    }

    if (!userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    const db = admin.firestore();
    const collectionPath = `ledgers/${ledgerId}/wallets`;
    const walletDoc = await db.collection(collectionPath).doc(walletId).get();

    if (!walletDoc.exists) {
      return WCM_formatErrorResponse("WALLET_NOT_FOUND", "帳戶不存在");
    }

    const walletData = walletDoc.data();

    // 檢查帳戶歸屬
    if (walletData.userId !== userId) {
      return WCM_formatErrorResponse("WALLET_ACCESS_DENIED", "無權限存取此帳戶");
    }

    // 檢查帳戶狀態
    if (walletData.status !== 'active') {
      return WCM_formatErrorResponse("WALLET_INACTIVE", "帳戶已停用");
    }

    WCM_logInfo(`帳戶驗證成功: ${walletId} (路徑: ${collectionPath}/${walletId})`, "驗證帳戶", userId, functionName);

    return WCM_formatSuccessResponse({
      walletId: walletId,
      name: walletData.name,
      type: walletData.type,
      currency: walletData.currency,
      balance: walletData.balance,
      ledgerId: walletData.ledgerId,
      exists: true,
      valid: true,
      collectionPath: collectionPath
    }, "帳戶驗證成功");

  } catch (error) {
    WCM_logError(`驗證帳戶存在失敗: ${error.message}`, "驗證帳戶", userId || "", "VALIDATE_WALLET_ERROR", error.toString(), functionName);
    return WCM_formatErrorResponse("VALIDATE_WALLET_ERROR", error.message, error.toString());
  }
}

// =================== 科目管理函數 (子集合架構) ===================

/**
 * 04. 創建科目 (子集合架構)
 * @version 2025-11-19-V1.1.0
 * @description 創建新的科目記錄到 ledgers/{ledgerId}/categories
 * @param {string} ledgerId - 帳本ID
 * @param {Object} categoryData - 科目資料
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_createCategory(ledgerId, categoryData) {
  const functionName = "WCM_createCategory";
  
  try {
    WCM_logInfo(`開始創建科目: ${categoryData.name} (帳本: ${ledgerId})`, "創建科目", categoryData.userId || "", functionName);

    // 基本參數驗證
    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!categoryData || typeof categoryData !== 'object') {
      return WCM_formatErrorResponse("INVALID_CATEGORY_DATA", "無效的科目資料");
    }

    if (!categoryData.name || categoryData.name.trim() === '') {
      return WCM_formatErrorResponse("MISSING_CATEGORY_NAME", "科目名稱不能為空");
    }

    if (categoryData.name.length > WCM_CONFIG.MAX_CATEGORY_NAME_LENGTH) {
      return WCM_formatErrorResponse("CATEGORY_NAME_TOO_LONG", `科目名稱不能超過${WCM_CONFIG.MAX_CATEGORY_NAME_LENGTH}字元`);
    }

    if (!categoryData.userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    // 準備科目資料
    const categoryId = `category_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = admin.firestore.Timestamp.now();

    const category = {
      id: categoryId,
      name: categoryData.name.trim(),
      type: categoryData.type || 'expense',
      parentId: categoryData.parentId || null,
      level: categoryData.parentId ? 2 : 1,
      userId: categoryData.userId,
      ledgerId: ledgerId,
      description: categoryData.description || '',
      color: categoryData.color || '#007bff',
      icon: categoryData.icon || 'default',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      module: 'WCM',
      version: WCM_CONFIG.VERSION
    };

    // 儲存至Firebase子集合
    const db = admin.firestore();
    const collectionPath = `ledgers/${ledgerId}/categories`;
    await db.collection(collectionPath).doc(categoryId).set(category);

    WCM_logInfo(`科目創建成功: ${categoryId} (路徑: ${collectionPath}/${categoryId})`, "創建科目", categoryData.userId, functionName);

    return WCM_formatSuccessResponse({
      categoryId: categoryId,
      name: category.name,
      type: category.type,
      level: category.level,
      color: category.color,
      icon: category.icon,
      ledgerId: ledgerId,
      path: `${collectionPath}/${categoryId}`
    }, "科目創建成功");

  } catch (error) {
    WCM_logError(`創建科目失敗: ${error.message}`, "創建科目", categoryData?.userId || "", "CREATE_CATEGORY_ERROR", error.toString(), functionName);
    return WCM_formatErrorResponse("CREATE_CATEGORY_ERROR", error.message, error.toString());
  }
}

/**
 * 05. 取得科目列表 (子集合架構)
 * @version 2025-11-19-V1.1.0
 * @description 取得指定帳本的科目列表
 * @param {string} ledgerId - 帳本ID
 * @param {Object} queryParams - 查詢參數
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_getCategoryList(ledgerId, queryParams = {}) {
  const functionName = "WCM_getCategoryList";
  
  try {
    WCM_logInfo(`開始查詢科目列表 (帳本: ${ledgerId})`, "查詢科目", queryParams.userId || "", functionName);

    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!queryParams.userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    const db = admin.firestore();
    const collectionPath = `ledgers/${ledgerId}/categories`;
    let query = db.collection(collectionPath)
      .where('userId', '==', queryParams.userId)
      .where('status', '==', 'active')
      .orderBy('level', 'asc')
      .orderBy('createdAt', 'desc');

    // 支援按類型篩選
    if (queryParams.type && ['income', 'expense'].includes(queryParams.type)) {
      query = query.where('type', '==', queryParams.type);
    }

    // 限制查詢筆數
    const limit = Math.min(parseInt(queryParams.limit) || 100, 200);
    query = query.limit(limit);

    const snapshot = await query.get();
    const categories = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      categories.push({
        id: data.id || doc.id,
        name: data.name,
        type: data.type,
        parentId: data.parentId,
        level: data.level,
        description: data.description,
        color: data.color,
        icon: data.icon,
        ledgerId: data.ledgerId,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : null
      });
    });

    WCM_logInfo(`查詢科目列表完成，返回${categories.length}筆記錄 (路徑: ${collectionPath})`, "查詢科目", queryParams.userId, functionName);

    return WCM_formatSuccessResponse({
      categories: categories,
      total: categories.length,
      limit: limit,
      ledgerId: ledgerId,
      collectionPath: collectionPath
    }, "科目列表查詢成功");

  } catch (error) {
    WCM_logError(`查詢科目列表失敗: ${error.message}`, "查詢科目", queryParams?.userId || "", "GET_CATEGORY_LIST_ERROR", error.toString(), functionName);
    return WCM_formatErrorResponse("GET_CATEGORY_LIST_ERROR", error.message, error.toString());
  }
}

/**
 * 06. 驗證科目存在 (子集合架構)
 * @version 2025-11-19-V1.1.0
 * @description 驗證指定科目是否存在且屬於用戶
 * @param {string} ledgerId - 帳本ID
 * @param {string} categoryId - 科目ID
 * @param {string} userId - 用戶ID
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_validateCategoryExists(ledgerId, categoryId, userId) {
  const functionName = "WCM_validateCategoryExists";
  
  try {
    WCM_logInfo(`開始驗證科目存在: ${categoryId} (帳本: ${ledgerId})`, "驗證科目", userId || "", functionName);

    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!categoryId || typeof categoryId !== 'string') {
      return WCM_formatErrorResponse("INVALID_CATEGORY_ID", "無效的科目ID");
    }

    if (!userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    const db = admin.firestore();
    const collectionPath = `ledgers/${ledgerId}/categories`;
    const categoryDoc = await db.collection(collectionPath).doc(categoryId).get();

    if (!categoryDoc.exists) {
      return WCM_formatErrorResponse("CATEGORY_NOT_FOUND", "科目不存在");
    }

    const categoryData = categoryDoc.data();

    // 檢查科目歸屬
    if (categoryData.userId !== userId) {
      return WCM_formatErrorResponse("CATEGORY_ACCESS_DENIED", "無權限存取此科目");
    }

    // 檢查科目狀態
    if (categoryData.status !== 'active') {
      return WCM_formatErrorResponse("CATEGORY_INACTIVE", "科目已停用");
    }

    WCM_logInfo(`科目驗證成功: ${categoryId} (路徑: ${collectionPath}/${categoryId})`, "驗證科目", userId, functionName);

    return WCM_formatSuccessResponse({
      categoryId: categoryId,
      name: categoryData.name,
      type: categoryData.type,
      level: categoryData.level,
      parentId: categoryData.parentId,
      ledgerId: categoryData.ledgerId,
      exists: true,
      valid: true,
      collectionPath: collectionPath
    }, "科目驗證成功");

  } catch (error) {
    WCM_logError(`驗證科目存在失敗: ${error.message}`, "驗證科目", userId || "", "VALIDATE_CATEGORY_ERROR", error.toString(), functionName);
    return WCM_formatErrorResponse("VALIDATE_CATEGORY_ERROR", error.message, error.toString());
  }
}

/**
 * 07. 取得帳戶餘額 (子集合架構)
 * @version 2025-11-19-V1.1.0
 * @description 從BK模組遷移，計算帳戶餘額
 * @param {string} ledgerId - 帳本ID
 * @param {string} walletId - 帳戶ID
 * @param {string} userId - 用戶ID
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_getWalletBalance(ledgerId, walletId, userId) {
  const functionName = "WCM_getWalletBalance";
  
  try {
    WCM_logInfo(`開始查詢帳戶餘額: ${walletId} (帳本: ${ledgerId})`, "查詢餘額", userId || "", functionName);

    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!walletId || typeof walletId !== 'string') {
      return WCM_formatErrorResponse("INVALID_WALLET_ID", "無效的帳戶ID");
    }

    if (!userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    // 先驗證帳戶存在
    const walletValidation = await WCM_validateWalletExists(ledgerId, walletId, userId);
    if (!walletValidation.success) {
      return walletValidation;
    }

    await WCM_initialize();

    const db = admin.firestore();
    const collectionPath = `ledgers/${ledgerId}/wallets`;
    const walletDoc = await db.collection(collectionPath).doc(walletId).get();

    if (!walletDoc.exists) {
      return WCM_formatErrorResponse("WALLET_NOT_FOUND", "帳戶不存在");
    }

    const walletData = walletDoc.data();

    WCM_logInfo(`帳戶餘額查詢成功: ${walletId}, 餘額: ${walletData.balance} (路徑: ${collectionPath}/${walletId})`, "查詢餘額", userId, functionName);

    return WCM_formatSuccessResponse({
      walletId: walletId,
      name: walletData.name,
      balance: walletData.balance || 0,
      currency: walletData.currency || WCM_CONFIG.DEFAULT_CURRENCY,
      ledgerId: walletData.ledgerId,
      collectionPath: collectionPath,
      lastUpdated: walletData.updatedAt?.toDate?.() ? walletData.updatedAt.toDate().toISOString() : null
    }, "帳戶餘額查詢成功");

  } catch (error) {
    WCM_logError(`查詢帳戶餘額失敗: ${error.message}`, "查詢餘額", userId || "", "GET_WALLET_BALANCE_ERROR", error.toString(), functionName);
    return WCM_formatErrorResponse("GET_WALLET_BALANCE_ERROR", error.message, error.toString());
  }
}

// =================== 日誌函數 ===================

function WCM_logInfo(message, category, userId, functionName) {
  if (DL && typeof DL.DL_info === 'function') {
    try {
      DL.DL_info(message, category || '帳戶科目管理', userId || '', '', '', functionName || 'WCM_logInfo');
    } catch (error) {
      console.log(`[WCM INFO] ${message} [DL_log錯誤: ${error.message}]`);
    }
  } else {
    console.log(`[WCM INFO] ${message}`);
  }
}

function WCM_logWarning(message, category, userId, functionName) {
  if (DL && typeof DL.DL_warning === 'function') {
    try {
      DL.DL_warning(message, category || '帳戶科目管理', userId || '', '', '', functionName || 'WCM_logWarning');
    } catch (error) {
      console.log(`[WCM WARNING] ${message} [DL_log錯誤: ${error.message}]`);
    }
  } else {
    console.log(`[WCM WARNING] ${message}`);
  }
}

function WCM_logError(message, category, userId, errorType, errorDetail, functionName) {
  if (DL && typeof DL.DL_error === 'function') {
    try {
      DL.DL_error(message, category || '帳戶科目管理', userId || '', errorType || 'UNKNOWN_ERROR', errorDetail || '', functionName || 'WCM_logError');
    } catch (error) {
      console.error(`[WCM ERROR] ${message} [DL_log錯誤: ${error.message}]`);
    }
  } else {
    console.error(`[WCM ERROR] ${message}`);
  }
}

// =================== 模組導出 ===================

module.exports = {
  // 帳戶管理函數 (子集合架構)
  WCM_createWallet,
  WCM_getWalletList,
  WCM_validateWalletExists,
  WCM_getWalletBalance,
  
  // 科目管理函數 (子集合架構)
  WCM_createCategory,
  WCM_getCategoryList,
  WCM_validateCategoryExists,
  
  // 系統函數
  WCM_initialize,
  WCM_formatSuccessResponse,
  WCM_formatErrorResponse,
  
  // 配置
  WCM_CONFIG,
  
  // 模組資訊
  moduleVersion: '1.1.0',
  architecture: 'subcollection_based',
  collections: {
    wallets: 'ledgers/{ledgerId}/wallets',
    categories: 'ledgers/{ledgerId}/categories'
  },
  lastUpdate: '2025-11-19',
  features: [
    'subcollection_architecture',
    'ledger_based_collections',
    'consistent_with_1311_FS',
    'wallet_management',
    'category_management'
  ]
};

// 自動初始化模組
try {
  console.log('🔧 WCM模組v1.1.0初始化：子集合架構');
  console.log('📋 架構調整：wallets/{walletId} → ledgers/{ledgerId}/wallets/{walletId}');
  console.log('📋 架構調整：categories/{categoryId} → ledgers/{ledgerId}/categories/{categoryId}');
  console.log('✅ 與1311.FS.js子集合架構保持一致');
  console.log('🎯 WCM模組已準備就緒');
} catch (error) {
  console.error('❌ WCM模組初始化失敗:', error.message);
}
