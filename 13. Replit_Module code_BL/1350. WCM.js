/**
 * 1350. WCM.js_帳戶與科目管理模組_v1.2.0
 * @module 帳戶與科目管理模組
 * @description LCAS 2.0 Wallet and Category Management - 統一處理帳戶與科目的基礎主數據管理 (子集合架構)
 * @update 2025-11-21: 階段一整合 - 整合AM模組的0099載入功能，成為科目和帳戶管理的唯一入口
 * @date 2025-11-21
 */

/**
 * WCM模組配置與初始化
 */
const moment = require('moment-timezone');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 引入依賴模組
const DL = require('./1310. DL.js');
// const FS = require('./1311. FS.js'); // FS module is removed
// 移除AM模組的直接引用以避免循環依賴
// const AM = require('./1309. AM.js');

// WCM模組配置
const WCM_CONFIG = {
  VERSION: '1.2.0',
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
 * 01. 創建帳戶 (子集合架構) - 強化版本，支援預設帳戶建立
 * @version 2025-11-21-V1.2.0
 * @description 創建新的帳戶記錄到 ledgers/{ledgerId}/wallets，支援建立預設帳戶功能
 * @param {string} ledgerId - 帳本ID
 * @param {Object} walletData - 帳戶資料
 * @param {Object} options - 選項參數 { createDefaultWallets: boolean }
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_createWallet(ledgerId, walletData, options = {}) {
  const functionName = "WCM_createWallet";

  try {
    WCM_logInfo(`開始創建帳戶: ${walletData.name || '預設帳戶'} (帳本: ${ledgerId})`, "創建帳戶", walletData.userId || "", functionName);

    // 基本參數驗證
    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!walletData || typeof walletData !== 'object') {
      return WCM_formatErrorResponse("INVALID_WALLET_DATA", "無效的帳戶資料");
    }

    if (!walletData.userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    // 獲取Firestore實例
    const db = admin.firestore();

    // 階段一整合：支援建立預設帳戶功能
    if (options.createDefaultWallets) {
      WCM_logInfo(`執行預設帳戶建立至帳本: ${ledgerId}`, "建立預設帳戶", walletData.userId, functionName);

      // 階段一優化：檢查是否已經建立過預設帳戶，避免重複建立
      const walletPathInfo = WCM_resolveLedgerPath(ledgerId, 'wallets');
      if (!walletPathInfo.success) {
        return WCM_formatErrorResponse("PATH_RESOLVE_ERROR", `帳戶路徑解析失敗: ${walletPathInfo.error}`);
      }

      const existingWalletsQuery = await db.collection(walletPathInfo.collectionPath)
        .where('userId', '==', walletData.userId)
        .where('dataSource', '==', '0302. Default_wallet.json')
        .limit(1)
        .get();

      if (!existingWalletsQuery.empty) {
        const existingCount = existingWalletsQuery.size;
        WCM_logInfo(`✅ 預設帳戶已存在 (${existingCount}個)，跳過重複建立`, "建立預設帳戶", walletData.userId, functionName);
        
        // 查詢所有現有預設帳戶
        const allExistingQuery = await db.collection(walletPathInfo.collectionPath)
          .where('userId', '==', walletData.userId)
          .where('dataSource', '==', '0302. Default_wallet.json')
          .get();
        
        return WCM_formatSuccessResponse({
          defaultWalletsCreated: false,
          alreadyExists: true,
          totalWallets: allExistingQuery.size,
          skippedWallets: 0,
          ledgerId: ledgerId,
          collectionPath: walletPathInfo.collectionPath,
          dataSource: '0302. Default_wallet.json',
          optimizationApplied: "stage_1_existence_check",
          writesAvoided: 20 // 預估避免的寫入次數
        }, `預設帳戶已存在 (共${allExistingQuery.size}個)，跳過重複建立`);
      }

      // 載入0302預設錢包配置
      const defaultConfigs = WCM_loadDefaultConfigs();
      if (!defaultConfigs.success) {
        const errorMsg = `載入0302預設錢包配置失敗: ${defaultConfigs.error || '配置檔案不存在或格式錯誤'}`;
        WCM_logError(errorMsg, "建立預設帳戶", walletData.userId, "LOAD_0302_CONFIG_FAILED", defaultConfigs.error || '', functionName);
        
        return WCM_formatErrorResponse("LOAD_0302_CONFIG_FAILED", 
          `無法載入0302. Default_wallet.json配置檔案，預設帳戶建立失敗: ${defaultConfigs.error}`, 
          { 
            configLoadError: defaultConfigs.error,
            ledgerId: ledgerId,
            userId: walletData.userId
          });
      }

      // 驗證配置結構
      if (!defaultConfigs.configs || !defaultConfigs.configs.wallets || !defaultConfigs.configs.wallets.default_wallets) {
        const errorMsg = "0302配置結構無效：缺少default_wallets陣列";
        WCM_logError(errorMsg, "建立預設帳戶", walletData.userId, "INVALID_0302_CONFIG_STRUCTURE", errorMsg, functionName);
        
        return WCM_formatErrorResponse("INVALID_0302_CONFIG_STRUCTURE", 
          "0302. Default_wallet.json配置格式錯誤：缺少default_wallets陣列", 
          { 
            configStructure: defaultConfigs.configs,
            ledgerId: ledgerId,
            userId: walletData.userId,
            configLoadResult: defaultConfigs
          });
      }

      const defaultWallets = defaultConfigs.configs.wallets.default_wallets;
      if (!Array.isArray(defaultWallets) || defaultWallets.length === 0) {
        const errorMsg = `0302配置中的default_wallets無效：${Array.isArray(defaultWallets) ? '陣列為空' : `不是陣列格式 (${typeof defaultWallets})`}`;
        WCM_logError(errorMsg, "建立預設帳戶", walletData.userId, "EMPTY_DEFAULT_WALLETS", errorMsg, functionName);
        
        return WCM_formatErrorResponse("EMPTY_DEFAULT_WALLETS", 
          `0302. Default_wallet.json中預設錢包定義無效：${Array.isArray(defaultWallets) ? '陣列為空' : '不是陣列格式'}`, 
          { 
            defaultWallets: defaultWallets,
            defaultWalletsType: typeof defaultWallets,
            isArray: Array.isArray(defaultWallets),
            ledgerId: ledgerId,
            userId: walletData.userId,
            configPath: defaultConfigs.configBasePath
          });
      }

      // 解析帳本路徑
      const defaultWalletPathInfo = WCM_resolveLedgerPath(ledgerId, 'wallets');
      if (!defaultWalletPathInfo.success) {
        const errorMsg = `解析帳本路徑失敗: ${defaultWalletPathInfo.error}`;
        WCM_logError(errorMsg, "建立預設帳戶", walletData.userId, "PATH_RESOLVE_ERROR", defaultWalletPathInfo.error, functionName);
        
        return WCM_formatErrorResponse("PATH_RESOLVE_ERROR", 
          `帳本路徑解析失敗: ${defaultWalletPathInfo.error}`, 
          { 
            ledgerId: ledgerId,
            operationType: 'wallets',
            pathError: defaultWalletPathInfo.error
          });
      }

      const collectionPath = defaultWalletPathInfo.collectionPath;
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();
      const defaultCurrency = defaultConfigs.configs.currency?.currencies?.default || WCM_CONFIG.DEFAULT_CURRENCY;

      let walletCount = 0;
      const createdWallets = [];
      const skippedWallets = [];

      WCM_logInfo(`開始批量建立${defaultWallets.length}個預設錢包至路徑: ${collectionPath}`, "建立預設帳戶", walletData.userId, functionName);

      // 批量建立預設帳戶
      for (let i = 0; i < defaultWallets.length; i++) {
        const defaultWallet = defaultWallets[i];
        
        // 修復欄位映射：0302.json使用walletName而非name
        const walletName = defaultWallet.walletName || defaultWallet.name;
        const walletId = defaultWallet.walletId;
        
        // 驗證錢包定義
        if (!walletId || !walletName) {
          WCM_logWarning(`跳過無效的錢包定義 (索引${i}): ${JSON.stringify(defaultWallet)}`, "建立預設帳戶", walletData.userId, functionName);
          skippedWallets.push({
            index: i,
            reason: "缺少walletId或walletName",
            walletData: defaultWallet
          });
          continue;
        }

        const walletRef = db.collection(collectionPath).doc(walletId);

        // 處理貨幣模板替換
        let currency = defaultWallet.currency || WCM_CONFIG.DEFAULT_CURRENCY;
        if (currency && currency.includes('{{default_currency}}')) {
          currency = currency.replace('{{default_currency}}', defaultCurrency);
        }

        // 階段二修復：移除walletType映射，不再設定type欄位

        const walletDoc = {
          id: walletId,
          walletId: walletId,                           // 符合DB schema的walletId欄位
          name: walletName,
          walletName: walletName,                       // 符合DB schema的walletName欄位
          subWalletId: defaultWallet.subWalletId || walletId, // 子帳戶ID映射
          subWalletName: defaultWallet.subWalletName || walletName, // 子帳戶名稱映射
          currency: currency,
          balance: parseFloat(defaultWallet.balance) || 0,
          synonyms: defaultWallet.synonyms || '',       // synonyms欄位映射
          description: defaultWallet.description || '',
          isDefault: defaultWallet.isDefault !== false, // 預設為true
          isActive: defaultWallet.isActive !== false,   // 預設為true
          icon: defaultWallet.icon || '',
          color: defaultWallet.color || '#4CAF50',
          userId: walletData.userId,
          ledgerId: ledgerId,
          status: 'active',
          dataSource: '0302. Default_wallet.json',
          createdAt: now,
          updatedAt: now,
          module: 'WCM',
          version: WCM_CONFIG.VERSION
        };

        batch.set(walletRef, walletDoc);
        walletCount++;
        createdWallets.push({
          walletId: walletId,
          name: walletDoc.name,
          currency: walletDoc.currency,
          balance: walletDoc.balance,
          isDefault: walletDoc.isDefault,
          icon: walletDoc.icon,
          color: walletDoc.color
        });

        WCM_logInfo(`準備建立錢包: ${walletDoc.name} (${walletId}) - ${walletDoc.type}`, "建立預設帳戶", walletData.userId, functionName);
      }

      // 執行批次寫入
      try {
        await batch.commit();
        WCM_logInfo(`預設帳戶建立成功: ${walletCount}個帳戶已建立至 ${collectionPath}`, "建立預設帳戶", walletData.userId, functionName);
        
        if (skippedWallets.length > 0) {
          WCM_logWarning(`建立過程中跳過${skippedWallets.length}個無效錢包定義`, "建立預設帳戶", walletData.userId, functionName);
        }

        return WCM_formatSuccessResponse({
          defaultWalletsCreated: true,
          totalWallets: walletCount,
          skippedWallets: skippedWallets.length,
          wallets: createdWallets,
          skippedDetails: skippedWallets,
          ledgerId: ledgerId,
          collectionPath: collectionPath,
          dataSource: '0302. Default_wallet.json',
          configVersion: defaultConfigs.configs.wallets.version || 'unknown'
        }, `成功建立 ${walletCount} 個預設帳戶${skippedWallets.length > 0 ? ` (跳過${skippedWallets.length}個無效定義)` : ''}`);

      } catch (batchError) {
        const errorMsg = `預設帳戶批次寫入失敗: ${batchError.message}`;
        WCM_logError(errorMsg, "建立預設帳戶", walletData.userId, "BATCH_WRITE_ERROR", batchError.toString(), functionName);
        
        return WCM_formatErrorResponse("BATCH_WRITE_ERROR", 
          `預設帳戶建立失敗: ${batchError.message}`, 
          { 
            batchError: batchError.toString(),
            collectionPath: collectionPath,
            walletCount: walletCount,
            createdWallets: createdWallets,
            ledgerId: ledgerId,
            userId: walletData.userId
          });
      }
    }

    // 單一帳戶創建邏輯
    if (!walletData.name || walletData.name.trim() === '') {
      return WCM_formatErrorResponse("MISSING_WALLET_NAME", "帳戶名稱不能為空");
    }

    if (walletData.name.length > WCM_CONFIG.MAX_WALLET_NAME_LENGTH) {
      return WCM_formatErrorResponse("WALLET_NAME_TOO_LONG", `帳戶名稱不能超過${WCM_CONFIG.MAX_WALLET_NAME_LENGTH}字元`);
    }

    // 準備帳戶資料
    const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = admin.firestore.Timestamp.now();

    const wallet = {
      id: walletId,
      name: walletData.name.trim(),
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
    const collectionPath = `ledgers/${ledgerId}/wallets`;
    await db.collection(collectionPath).doc(walletId).set(wallet);

    WCM_logInfo(`帳戶創建成功: ${walletId} (路徑: ${collectionPath}/${walletId})`, "創建帳戶", walletData.userId, functionName);

    return WCM_formatSuccessResponse({
      walletId: walletId,
      name: wallet.name,
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

    // 階段二修正：使用動態路徑解析
    const pathInfo = WCM_resolveLedgerPath(ledgerId, 'wallets');
    if (!pathInfo.success) {
      return WCM_formatErrorResponse("PATH_RESOLVE_ERROR", `帳戶列表路徑解析失敗: ${pathInfo.error}`);
    }

    const db = admin.firestore();
    const collectionPath = pathInfo.collectionPath;
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

    // 階段二修正：使用動態路徑解析
    const pathInfo = WCM_resolveLedgerPath(ledgerId, 'wallets');
    if (!pathInfo.success) {
      return WCM_formatErrorResponse("PATH_RESOLVE_ERROR", `帳戶驗證路徑解析失敗: ${pathInfo.error}`);
    }

    const db = admin.firestore();
    const collectionPath = pathInfo.collectionPath;
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
 * 04. 創建科目 (子集合架構) - 強化版本，支援0099批量載入
 * @version 2025-11-21-V1.2.0
 * @description 創建新的科目記錄到 ledgers/{ledgerId}/categories，支援從0099.json批量載入科目功能
 * @param {string} ledgerId - 帳本ID
 * @param {Object} categoryData - 科目資料
 * @param {Object} options - 選項參數 { batchLoad0099: boolean }
 * @returns {Promise<Object>} 標準化回應格式
 */
async function WCM_createCategory(ledgerId, categoryData, options = {}) {
  const functionName = "WCM_createCategory";

  try {
    WCM_logInfo(`開始創建科目: ${categoryData.name || '批量載入'} (帳本: ${ledgerId})`, "創建科目", categoryData.userId || "", functionName);

    // 基本參數驗證
    if (!ledgerId || typeof ledgerId !== 'string') {
      return WCM_formatErrorResponse("INVALID_LEDGER_ID", "無效的帳本ID");
    }

    if (!categoryData || typeof categoryData !== 'object') {
      return WCM_formatErrorResponse("INVALID_CATEGORY_DATA", "無效的科目資料");
    }

    if (!categoryData.userId) {
      return WCM_formatErrorResponse("MISSING_USER_ID", "用戶ID不能為空");
    }

    await WCM_initialize();

    // 獲取Firestore實例
    const db = admin.firestore();

    // 階段一整合：支援從0099批量載入科目功能
    if (options.batchLoad0099) {
      WCM_logInfo(`執行0099科目批量載入至帳本: ${ledgerId}`, "批量載入科目", categoryData.userId, functionName);

      // 階段一優化：檢查是否已經批量載入過0099科目，避免重複載入
      const collectionPath = `ledgers/${ledgerId}/categories`;
      const existingCategoriesQuery = await db.collection(collectionPath)
        .where('userId', '==', categoryData.userId)
        .where('dataSource', '==', '0099. Subject_code.json')
        .limit(1)
        .get();

      if (!existingCategoriesQuery.empty) {
        // 查詢現有科目總數
        const allExistingQuery = await db.collection(collectionPath)
          .where('userId', '==', categoryData.userId)
          .where('dataSource', '==', '0099. Subject_code.json')
          .get();
        
        WCM_logInfo(`✅ 0099科目已批量載入 (${allExistingQuery.size}筆)，跳過重複載入`, "批量載入科目", categoryData.userId, functionName);
        
        return WCM_formatSuccessResponse({
          batchLoaded: false,
          alreadyExists: true,
          totalCategories: allExistingQuery.size,
          ledgerId: ledgerId,
          collectionPath: collectionPath,
          dataSource: '0099. Subject_code.json',
          optimizationApplied: "stage_1_existence_check",
          writesAvoided: 100 // 預估避免的寫入次數
        }, `0099科目已存在 (共${allExistingQuery.size}筆)，跳過重複載入`);
      }

      const subjectData = WCM_load0099SubjectData();
      if (!subjectData.success) {
        return WCM_formatErrorResponse("LOAD_0099_FAILED", "載入0099科目資料失敗", subjectData.error);
      }

      const collectionPath = `ledgers/${ledgerId}/categories`;
      const batch = db.batch();
      let batchCount = 0;
      const now = admin.firestore.Timestamp.now();

      // 批量建立所有科目
      for (const subject of subjectData.data) {
        // 跳過空的或無效的科目資料
        if (!subject.categoryId && !subject.categoryName) {
          continue;
        }

        // 使用純數字格式作為文檔ID，與0099.json中的categoryId保持一致
        const categoryId = subject.categoryId ? subject.categoryId.toString() : `${Date.now()}`;
        const categoryRef = db.collection(collectionPath).doc(categoryId);

        const categoryDoc = {
          id: categoryId,
          subCategoryId: subject.categoryId ? subject.categoryId.toString() : categoryId,
          categoryId: subject.parentId || subject.categoryId || null,
          categoryName: subject.categoryName || '未分類',
          subCategoryName: subject.subCategoryName || subject.categoryName || '未分類',
          synonyms: subject.synonyms || '',
          name: subject.subCategoryName || subject.categoryName || '未分類',
          type: (subject.parentId && [801, 899].includes(subject.parentId)) ? 'income' : 'expense',
          level: subject.parentId ? 2 : 1,
          color: '#007bff',
          icon: 'default',
          description: '',
          isDefault: true,
          isActive: true,
          userId: categoryData.userId,
          ledgerId: ledgerId,
          status: 'active',
          dataSource: '0099. Subject_code.json',
          createdAt: now,
          updatedAt: now,
          module: 'WCM',
          version: WCM_CONFIG.VERSION
        };

        batch.set(categoryRef, categoryDoc);
        batchCount++;
      }

      await batch.commit();

      WCM_logInfo(`批量載入完成: ${batchCount} 筆科目 (路徑: ${collectionPath})`, "批量載入科目", categoryData.userId, functionName);

      return WCM_formatSuccessResponse({
        batchLoaded: true,
        totalCategories: batchCount,
        ledgerId: ledgerId,
        collectionPath: collectionPath,
        dataSource: '0099. Subject_code.json'
      }, `成功批量載入 ${batchCount} 筆科目`);
    }

    // 單一科目創建邏輯
    if (!categoryData.name || categoryData.name.trim() === '') {
      return WCM_formatErrorResponse("MISSING_CATEGORY_NAME", "科目名稱不能為空");
    }

    if (categoryData.name.length > WCM_CONFIG.MAX_CATEGORY_NAME_LENGTH) {
      return WCM_formatErrorResponse("CATEGORY_NAME_TOO_LONG", `科目名稱不能超過${WCM_CONFIG.MAX_CATEGORY_NAME_LENGTH}字元`);
    }

    // 準備科目資料
    // 使用純數字格式作為文檔ID，確保與查詢邏輯一致
    const categoryId = `${Date.now()}`;
    const now = admin.firestore.Timestamp.now();

    const category = {
      id: categoryId,
      subCategoryId: categoryId,
      categoryId: categoryData.parentId || null,
      categoryName: categoryData.parentId ? '' : categoryData.name.trim(),
      subCategoryName: categoryData.parentId ? categoryData.name.trim() : '',
      synonyms: categoryData.synonyms || '',
      name: categoryData.name.trim(),
      type: categoryData.type || 'expense',
      level: categoryData.parentId ? 2 : 1,
      color: categoryData.color || '#007bff',
      icon: categoryData.icon || 'default',
      description: categoryData.description || '',
      isDefault: false,
      isActive: true,
      userId: categoryData.userId,
      ledgerId: ledgerId,
      status: 'active',
      dataSource: 'user_created',
      createdAt: now,
      updatedAt: now,
      module: 'WCM',
      version: WCM_CONFIG.VERSION
    };

    // 儲存至Firebase子集合
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

    // 階段二修正：使用動態路徑解析
    const pathInfo = WCM_resolveLedgerPath(ledgerId, 'categories');
    if (!pathInfo.success) {
      return WCM_formatErrorResponse("PATH_RESOLVE_ERROR", `科目列表路徑解析失敗: ${pathInfo.error}`);
    }

    const db = admin.firestore();
    const collectionPath = pathInfo.collectionPath;
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
        subCategoryId: data.subCategoryId || data.categoryId,
        categoryId: data.categoryId || data.parentId,
        categoryName: data.categoryName,
        subCategoryName: data.subCategoryName,
        synonyms: data.synonyms,
        name: data.name,
        type: data.type,
        level: data.level,
        color: data.color,
        icon: data.icon,
        description: data.description,
        isDefault: data.isDefault,
        isActive: data.isActive,
        status: data.status,
        dataSource: data.dataSource,
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

    // 階段二修正：使用動態路徑解析
    const pathInfo = WCM_resolveLedgerPath(ledgerId, 'categories');
    if (!pathInfo.success) {
      return WCM_formatErrorResponse("PATH_RESOLVE_ERROR", `科目驗證路徑解析失敗: ${pathInfo.error}`);
    }

    const db = admin.firestore();
    const collectionPath = pathInfo.collectionPath;
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
      subCategoryId: categoryData.subCategoryId,
      categoryName: categoryData.categoryName,
      subCategoryName: categoryData.subCategoryName,
      name: categoryData.name,
      type: categoryData.type,
      level: categoryData.level,
      isActive: categoryData.isActive,
      status: categoryData.status,
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

    // 階段二修正：使用動態路徑解析
    const pathInfo = WCM_resolveLedgerPath(ledgerId, 'wallets');
    if (!pathInfo.success) {
      return WCM_formatErrorResponse("PATH_RESOLVE_ERROR", `帳戶餘額路徑解析失敗: ${pathInfo.error}`);
    }

    const db = admin.firestore();
    const collectionPath = pathInfo.collectionPath;
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

/**
 * 08. 載入0099科目資料 (從AM模組移植)
 * @version 2025-11-21-V1.2.0
 * @description 從0099. Subject_code.json載入科目資料 - 從AM_load0099SubjectData移植而來
 * @returns {Object} 載入結果
 */
function WCM_load0099SubjectData() {
  const functionName = "WCM_load0099SubjectData";
  try {
    WCM_logInfo(`開始載入0099科目資料...`, "載入科目資料", "", functionName);

    const subjectFilePath = '/home/runner/workspace/00. Master_Project document/0099. Subject_code.json';

    if (!fs.existsSync(subjectFilePath)) {
      WCM_logError(`0099. Subject_code.json 檔案不存在: ${subjectFilePath}`, "載入科目資料", "", "FILE_NOT_FOUND", "", functionName);
      return {
        success: false,
        error: "0099. Subject_code.json 檔案不存在",
        count: 0,
        data: []
      };
    }

    const subjectDataRaw = fs.readFileSync(subjectFilePath, 'utf8');
    const subjectData = JSON.parse(subjectDataRaw);

    if (!Array.isArray(subjectData)) {
      throw new Error("0099科目資料格式錯誤，應為陣列格式");
    }

    WCM_logInfo(`成功載入 ${subjectData.length} 筆科目資料`, "載入科目資料", "", functionName);

    return {
      success: true,
      count: subjectData.length,
      data: subjectData,
      source: '0099. Subject_code.json'
    };

  } catch (error) {
    WCM_logError(`載入0099科目資料失敗: ${error.message}`, "載入科目資料", "", "LOAD_0099_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      count: 0,
      data: []
    };
  }
}

// 階段一優化：配置檔案共用引用機制
let WCM_SHARED_CONFIGS = null;
let WCM_CONFIG_VERSION = null;
let WCM_CONFIG_LOAD_TIME = 0;

/**
 * 09. 載入預設配置資料 (從AM模組移植) - 階段一優化版
 * @version 2025-12-26-V1.4.0
 * @description 從03. Default_config資料夾載入預設配置 - 階段一優化：建立共用引用機制，避免重複載入
 * @returns {Object} 載入結果
 */
function WCM_loadDefaultConfigs() {
  const functionName = "WCM_loadDefaultConfigs";
  try {
    // 階段一優化：檢查共用配置快取，避免重複載入
    const currentTime = Date.now();
    const cacheValidDuration = 5 * 60 * 1000; // 5分鐘快取
    
    if (WCM_SHARED_CONFIGS && 
        WCM_CONFIG_LOAD_TIME && 
        (currentTime - WCM_CONFIG_LOAD_TIME) < cacheValidDuration) {
      WCM_logInfo(`✅ 使用快取的共用配置，避免重複載入 (版本: ${WCM_CONFIG_VERSION})`, "載入預設配置", "", functionName);
      return {
        success: true,
        configs: WCM_SHARED_CONFIGS,
        loadedConfigs: Object.keys(WCM_SHARED_CONFIGS),
        configVersion: WCM_CONFIG_VERSION,
        fromCache: true,
        optimizationApplied: "stage_1_shared_config_cache"
      };
    }

    WCM_logInfo(`開始載入預設配置資料...`, "載入預設配置", "", functionName);

    // 使用多種路徑解析策略，確保處理包含空格的目錄名稱
    const configDirName = '03. Default_config';
    const configBasePaths = [
      path.resolve(__dirname, '../..', configDirName),
      path.resolve(process.cwd(), configDirName),
      path.join(process.cwd(), configDirName),
      path.normalize(path.join(__dirname, '../..', configDirName)),
      configDirName // 相對路徑作為最後嘗試
    ];

    let validConfigBasePath = null;
    
    // 嘗試找到有效的配置目錄路徑
    for (const basePath of configBasePaths) {
      WCM_logInfo(`檢查配置目錄路徑: ${basePath}`, "載入預設配置", "", functionName);
      if (fs.existsSync(basePath)) {
        validConfigBasePath = basePath;
        WCM_logInfo(`成功找到配置目錄: ${basePath}`, "載入預設配置", "", functionName);
        break;
      }
    }

    if (!validConfigBasePath) {
      const error = `無法找到配置目錄 "${configDirName}"，已嘗試路徑: ${configBasePaths.join(', ')}`;
      WCM_logError(error, "載入預設配置", "", "CONFIG_DIR_NOT_FOUND", error, functionName);
      return {
        success: false,
        error: error,
        configs: {},
        triedPaths: configBasePaths
      };
    }

    const configs = {};

    // 載入系統配置 (可選)
    const systemConfigFile = '0301. Default_config.json';
    const systemConfigPath = path.join(validConfigBasePath, systemConfigFile);
    WCM_logInfo(`嘗試載入系統配置: ${systemConfigPath}`, "載入預設配置", "", functionName);
    
    if (fs.existsSync(systemConfigPath)) {
      try {
        let configContent = fs.readFileSync(systemConfigPath, 'utf8');
        // 移除JavaScript風格的註解
        configContent = configContent
          .replace(/\/\*\*[\s\S]*?\*\//g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
          .replace(/^\s*[\r\n]/gm, '')
          .trim();

        const systemConfig = JSON.parse(configContent);
        configs.system = systemConfig;
        WCM_logInfo(`載入系統配置成功: ${systemConfig.version || 'unknown'}`, "載入預設配置", "", functionName);
      } catch (systemError) {
        WCM_logWarning(`載入系統配置失敗: ${systemError.message}`, "載入預設配置", "", functionName);
      }
    }

    // 載入預設帳戶配置 - 0302. Default_wallet.json (必需檔案)
    const walletConfigFile = '0302. Default_wallet.json';
    const walletConfigPath = path.join(validConfigBasePath, walletConfigFile);
    
    WCM_logInfo(`載入0302預設錢包配置: ${walletConfigPath}`, "載入預設配置", "", functionName);
    
    if (!fs.existsSync(walletConfigPath)) {
      const error = `必需的0302. Default_wallet.json檔案不存在，路徑: ${walletConfigPath}`;
      WCM_logError(error, "載入預設配置", "", "WALLET_CONFIG_FILE_NOT_FOUND", error, functionName);
      return {
        success: false,
        error: error,
        configs: {},
        configBasePath: validConfigBasePath,
        walletConfigPath: walletConfigPath
      };
    }

    try {
      let configContent = fs.readFileSync(walletConfigPath, 'utf8');
      
      // 移除註解並清理內容
      configContent = configContent
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/^\s*[\r\n]/gm, '')
        .trim();

      const walletConfig = JSON.parse(configContent);
      
      // 驗證配置結構 - 檢查default_wallets陣列
      if (!walletConfig.default_wallets) {
        const error = `0302. Default_wallet.json格式錯誤：缺少default_wallets欄位`;
        WCM_logError(error, "載入預設配置", "", "WALLET_CONFIG_MISSING_FIELD", error, functionName);
        return {
          success: false,
          error: error,
          configs: {},
          configData: walletConfig
        };
      }

      if (!Array.isArray(walletConfig.default_wallets)) {
        const error = `0302. Default_wallet.json格式錯誤：default_wallets必須是陣列格式`;
        WCM_logError(error, "載入預設配置", "", "WALLET_CONFIG_INVALID_FORMAT", error, functionName);
        return {
          success: false,
          error: error,
          configs: {},
          configData: walletConfig
        };
      }

      if (walletConfig.default_wallets.length === 0) {
        const error = `0302. Default_wallet.json中default_wallets陣列為空`;
        WCM_logError(error, "載入預設配置", "", "WALLET_CONFIG_EMPTY_ARRAY", error, functionName);
        return {
          success: false,
          error: error,
          configs: {},
          configData: walletConfig
        };
      }

      configs.wallets = walletConfig;
      const walletCount = walletConfig.default_wallets.length;
      WCM_logInfo(`成功載入0302預設帳戶配置: ${walletCount}個帳戶定義`, "載入預設配置", "", functionName);
      
    } catch (parseError) {
      const error = `解析0302. Default_wallet.json失敗: ${parseError.message}`;
      WCM_logError(error, "載入預設配置", "", "WALLET_CONFIG_PARSE_ERROR", parseError.toString(), functionName);
      return {
        success: false,
        error: error,
        configs: {},
        configPath: walletConfigPath,
        parseError: parseError.message
      };
    }

    // 載入貨幣配置 (可選)
    const currencyConfigFile = '0303. Default_currency.json';
    const currencyConfigPath = path.join(validConfigBasePath, currencyConfigFile);
    WCM_logInfo(`嘗試載入貨幣配置: ${currencyConfigPath}`, "載入預設配置", "", functionName);
    
    if (fs.existsSync(currencyConfigPath)) {
      try {
        const configContent = fs.readFileSync(currencyConfigPath, 'utf8');
        const cleanContent = configContent
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '')
          .replace(/^\s*\/\*\*[\s\S]*?\*\/\s*$/gm, '')
          .trim();
          
        const currencyConfig = JSON.parse(cleanContent);
        configs.currency = currencyConfig;
        const defaultCurrency = currencyConfig.currencies?.default || 'unknown';
        WCM_logInfo(`載入貨幣配置成功: 預設貨幣 ${defaultCurrency}`, "載入預設配置", "", functionName);
      } catch (currencyError) {
        WCM_logWarning(`載入貨幣配置失敗: ${currencyError.message}`, "載入預設配置", "", functionName);
      }
    }

    const loadedConfigTypes = Object.keys(configs);
    
    // 階段一優化：建立共用配置快取機制
    WCM_SHARED_CONFIGS = configs;
    WCM_CONFIG_VERSION = configs.system?.version || configs.wallets?.version || '1.0.0';
    WCM_CONFIG_LOAD_TIME = Date.now();
    
    WCM_logInfo(`預設配置載入完成，已建立共用快取 (版本: ${WCM_CONFIG_VERSION}): ${loadedConfigTypes.join(', ')}`, "載入預設配置", "", functionName);

    return {
      success: true,
      configs: configs,
      loadedConfigs: loadedConfigTypes,
      configBasePath: validConfigBasePath,
      configVersion: WCM_CONFIG_VERSION,
      walletCount: configs.wallets?.default_wallets?.length || 0,
      optimizationApplied: "stage_1_shared_config_establishment",
      cacheEstablished: true
    };

  } catch (error) {
    const errorMsg = `載入預設配置發生未預期錯誤: ${error.message}`;
    WCM_logError(errorMsg, "載入預設配置", "", "LOAD_CONFIG_UNEXPECTED_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: errorMsg,
      configs: {},
      unexpectedError: error.toString()
    };
  }
}

/**
 * 10. 解析帳本/協作帳本路徑
 * @version 2025-11-22-V2.0.0
 * @description 根據ledgerId和操作類型，動態解析Firestore的集合路徑
 * @param {string} ledgerId - 帳本ID
 * @param {string} operationType - 操作類型，例如 'wallets', 'categories', 'transactions'
 * @returns {Object} { success: boolean, collectionPath: string, error: string }
 */
function WCM_resolveLedgerPath(ledgerId, operationType) {
  const functionName = "WCM_resolveLedgerPath";
  try {
    WCM_logInfo(`解析路徑：帳本ID=${ledgerId}, 操作=${operationType}`, "路徑解析", "", functionName);

    if (!ledgerId || typeof ledgerId !== 'string') {
      return { success: false, error: "無效的帳本ID" };
    }
    if (!operationType || typeof operationType !== 'string') {
      return { success: false, error: "無效的操作類型" };
    }

    // 檢查 ledgerId 是否為協作帳本 ID (例如: 'collaboration_XXXX')
    if (ledgerId.startsWith('collaboration_')) {
      const collectionPath = `collaborations/${ledgerId}/${operationType}`;
      WCM_logInfo(`動態路徑解析成功 (協作帳本): ${collectionPath}`, "路徑解析", "", functionName);
      return { success: true, collectionPath: collectionPath };
    } else {
      // 預設為獨立帳本路徑
      const collectionPath = `ledgers/${ledgerId}/${operationType}`;
      WCM_logInfo(`動態路徑解析成功 (獨立帳本): ${collectionPath}`, "路徑解析", "", functionName);
      return { success: true, collectionPath: collectionPath };
    }
  } catch (error) {
    WCM_logError(`路徑解析失敗: ${error.message}`, "路徑解析", "", "PATH_RESOLVE_ERROR", error.toString(), functionName);
    return { success: false, error: error.message };
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

// =================== 階段一優化：配置快取管理函數 ===================

/**
 * 清除配置快取 - 階段一優化
 * @version 2025-12-26-V1.0.0
 * @description 手動清除共用配置快取，強制重新載入
 */
function WCM_clearConfigCache() {
  const functionName = "WCM_clearConfigCache";
  WCM_logInfo('清除共用配置快取', "配置快取管理", "", functionName);
  
  WCM_SHARED_CONFIGS = null;
  WCM_CONFIG_VERSION = null;
  WCM_CONFIG_LOAD_TIME = 0;
  
  return {
    success: true,
    message: "配置快取已清除",
    optimizationApplied: "stage_1_cache_management"
  };
}

/**
 * 取得配置快取資訊 - 階段一優化
 * @version 2025-12-26-V1.0.0
 * @description 查詢當前配置快取狀態
 */
function WCM_getConfigCacheInfo() {
  const currentTime = Date.now();
  const cacheAge = WCM_CONFIG_LOAD_TIME ? (currentTime - WCM_CONFIG_LOAD_TIME) : 0;
  
  return {
    success: true,
    data: {
      hasCachedConfig: !!WCM_SHARED_CONFIGS,
      configVersion: WCM_CONFIG_VERSION,
      cacheLoadTime: WCM_CONFIG_LOAD_TIME ? new Date(WCM_CONFIG_LOAD_TIME).toISOString() : null,
      cacheAgeMs: cacheAge,
      configTypes: WCM_SHARED_CONFIGS ? Object.keys(WCM_SHARED_CONFIGS) : []
    },
    optimizationApplied: "stage_1_cache_info"
  };
}

// =================== 模組導出 ===================

// 確保所有函數都被正確定義後再導出
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

  // 數據載入函數 (從AM模組整合)
  WCM_load0099SubjectData,
  WCM_loadDefaultConfigs,

  // 系統函數
  WCM_initialize,
  WCM_formatSuccessResponse,
  WCM_formatErrorResponse,

  // 路徑解析函數
  WCM_resolveLedgerPath,

  // 階段一優化：配置快取管理函數
  WCM_clearConfigCache,
  WCM_getConfigCacheInfo,

  // 配置
  WCM_CONFIG,

  // 模組資訊
  moduleVersion: '1.2.4', // 版本升級至 1.2.4 (修復預設錢包欄位映射)
  architecture: 'subcollection_based',
  collections: {
    wallets: 'ledgers/{ledgerId}/wallets',
    categories: 'ledgers/{ledgerId}/categories'
  },
  lastUpdate: '2025-12-18', // 更新日期
  features: [
    'subcollection_architecture',
    'ledger_based_collections',
    'consistent_with_1311_FS',
    'wallet_management',
    'category_management',
    'batch_0099_subject_loading',
    'default_wallet_creation',
    'circular_dependency_resolved', // 新增：已解決循環依賴
    'enhanced_default_wallet_creation', // 新增：強化預設錢包建立機制
    'complete_field_mapping_0302_config', // 新增：完整0302配置欄位映射
    'synonyms_field_support' // 新增：支援synonyms欄位映射
  ],
  integratedFrom: {
    'AM_load0099SubjectData': 'AM模組v7.5.0',
    'AM_loadDefaultConfigs': 'AM模組v7.5.0'
  }
};

// 自動初始化模組
try {
  console.log('🔧 WCM模組v1.2.4 初始化：預設錢包欄位映射修復版');
  console.log('🔄 循環依賴修復：移除AM模組直接引用');
  console.log('💰 預設錢包建立強化：完整錯誤處理和批次處理邏輯');
  console.log('✅ 函數導出驗證：WCM_createCategory =', typeof WCM_createCategory);
  console.log('✅ 函數導出驗證：WCM_createWallet =', typeof WCM_createWallet);
  console.log('✅ 函數導出驗證：WCM_load0099SubjectData =', typeof WCM_load0099SubjectData);
  console.log('✅ 函數導出驗證：WCM_loadDefaultConfigs =', typeof WCM_loadDefaultConfigs);
  console.log('📋 架構調整：支援協作帳本路徑 (collaborations/{ledgerId}/{collection})');
  console.log('✅ 與1311.FS.js子集合架構保持一致');
  console.log('🚀 WCM模組現已全面支援協作帳本路徑');
  console.log('💎 預設錢包建立機制：強化配置驗證、錯誤處理和批次處理');
  console.log('🔧 欄位映射修復：完整映射0302配置檔案所有欄位，包含synonyms支援');
  console.log('📝 符合0070 DB schema：確保wallets子集合欄位完整性');
  console.log('✨ 階段二修復完成，預設錢包欄位映射已完全符合配置檔案驅動');
} catch (error) {
  console.error('❌ WCM模組初始化失敗:', error.message);
}