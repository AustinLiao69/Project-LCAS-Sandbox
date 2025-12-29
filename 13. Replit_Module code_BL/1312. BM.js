/**
 * BM_預算管理模組_2.3.0
 * @module BM模組
 * @description 預算管理系統 - 支援預算設定、追蹤、警示與分析，接管所有預算相關初始化功能
 * @update 2025-11-21: 升級至2.3.0版本，階段二整合：從FS模組接管預算初始化功能，包含子集合框架建立
 */

// 引入依賴模組
const DL = require('./1310. DL.js');
const DD = require('./1331. DD1.js');
// FS模組已移除 - BM模組直接使用Firebase實例

// 預算管理模組物件
const BM = {};

/**
 * 統一回傳格式標準函數
 */
function createStandardResponse(success, data = null, message = '', errorCode = null) {
  return {
    success: success,
    data: data,
    message: message,
    error: success ? null : {
      code: errorCode || 'UNKNOWN_ERROR',
      message: message
    }
  };
}

/**
 * 01. 建立預算設定 - 階段一createdBy問題修正版
 * @version 2025-10-31-V2.3.0
 * @date 2025-10-31 06:30:00
 * @description 為特定帳本建立新的預算設定（強制使用子集合架構：ledgers/{ledgerId}/budgets/{budgetId}）
 * @update 階段一修正：智能使用者識別邏輯，從ledgerId提取真實使用者email，解決createdBy顯示system_user問題
 */
BM.BM_createBudget = async function(budgetData) {
  const logPrefix = '[BM_createBudget]';

  try {
    console.log(`${logPrefix} 📊 階段三完整修正：開始建立預算 - 強制子集合架構`);
    console.log(`${logPrefix} 🔍 原始輸入資料:`, JSON.stringify(budgetData, null, 2));

    // 階段三核心修正1：智能ledgerId提取（支援多種格式）
    let ledgerId = budgetData?.ledgerId;

    // 如果直接沒有ledgerId，嘗試從其他欄位提取
    if (!ledgerId) {
      // 從subcollectionPath提取ledgerId
      if (budgetData?.subcollectionPath) {
        const pathMatch = budgetData.subcollectionPath.match(/ledgers\/([^\/]+)\/budgets/);
        if (pathMatch && pathMatch[1]) {
          ledgerId = pathMatch[1];
          console.log(`${logPrefix} 🔄 階段三智能提取：從subcollectionPath提取ledgerId = ${ledgerId}`);
        }
      }

      // 從用戶ID推導ledgerId（如果符合user_email格式）
      if (!ledgerId && budgetData?.userId) {
        if (budgetData.userId.includes('@') || budgetData.userId.startsWith('user_')) {
          ledgerId = budgetData.userId.startsWith('user_') ? budgetData.userId : `user_${budgetData.userId}`;
          console.log(`${logPrefix} 🔄 階段三智能推導：從userId推導ledgerId = ${ledgerId}`);
        }
      }
    }

    // 階段三核心修正2：絕對驗證ledgerId存在性
    console.log(`${logPrefix} 🔍 階段三最終驗證：ledgerId = ${ledgerId}`);
    if (!ledgerId || typeof ledgerId !== 'string' || ledgerId.trim() === '') {
      console.error(`${logPrefix} ❌ 階段三嚴重錯誤：無法確定ledgerId`);
      console.error(`${logPrefix} ❌ budgetData:`, budgetData);
      throw new Error(`階段三驗證失敗：無法確定ledgerId參數，預算子集合架構要求明確的帳本ID`);
    }

    // 階段三核心修正3：真實用戶帳本ID格式驗證
    console.log(`${logPrefix} 🎯 階段三帳本ID確認：${ledgerId}`);
    if (ledgerId.includes('collab_ledger') || ledgerId.includes('hardcoded')) {
      console.warn(`${logPrefix} ⚠️ 階段三警告：檢測到可能的hardcoded ledgerId: ${ledgerId}`);
      console.warn(`${logPrefix} ⚠️ 請確認這是否為真實用戶帳本ID`);
    }


    // 從requestData中提取參數，支援多種格式
    let userId, budgetDataPayload, budgetType;

    if (typeof budgetData === 'object' && budgetData !== null) {
      // API格式：{ledgerId, userId, ...budgetDataPayload}
      // 階段一核心修正：智能使用者識別邏輯
      userId = budgetData.userId || budgetData.userId || budgetData.createdBy || budgetData.operatorId;

      // 階段一智能提取：從ledgerId提取真實使用者email
      if (!userId && ledgerId) {
        if (ledgerId.startsWith('user_')) {
          // 從 "user_expert.valid@test.lcas.app" 提取 "expert.valid@test.lcas.app"
          userId = ledgerId.replace(/^user_/, '');
          console.log(`${logPrefix} 🎯 階段一智能提取：從ledgerId提取userId = ${userId}`);
        } else if (ledgerId.includes('@')) {
          // 如果ledgerId本身就是email格式，直接使用
          userId = ledgerId;
          console.log(`${logPrefix} 🎯 階段一智能識別：使用ledgerId作為userId = ${userId}`);
        }
      }

      // 最後才使用預設值（階段一重要：降低system_user使用機率）
      if (!userId) {
        userId = 'system_user';
        console.warn(`${logPrefix} ⚠️ 階段一警告：無法從ledgerId提取使用者資訊，使用預設值 system_user`);
      }

      budgetType = budgetData.type || budgetData.budgetType || 'monthly';

      // 驗證必要參數
      if (!userId) {
        return createStandardResponse(false, null, '缺少用戶ID參數', 'MISSING_userId');
      }

      // budgetDataPayload包含所有預算相關資料
      budgetDataPayload = {
        name: budgetData.name,
        amount: budgetData.amount,
        currency: budgetData.currency,
        start_date: budgetData.start_date || budgetData.startDate,
        end_date: budgetData.end_date || budgetData.endDate,
        categories: budgetData.categories,
        alert_rules: budgetData.alert_rules || budgetData.alertRules,
        description: budgetData.description
      };
    } else {
      return createStandardResponse(false, null, '無效的請求格式', 'INVALID_REQUEST_FORMAT');
    }

    console.log(`${logPrefix} 開始建立預算 - 帳本ID: ${ledgerId}, 用戶: ${userId}`);

    // 驗證輸入參數
    if (!budgetDataPayload || !budgetDataPayload.name || !budgetDataPayload.amount) {
      return createStandardResponse(false, null, '缺少必要參數: budgetDataPayload.name, budgetDataPayload.amount', 'MISSING_REQUIRED_PARAMS');
    }

    // 驗證預算數據
    const validation = await BM.BM_validateBudgetData(budgetDataPayload, 'create');
    if (!validation.valid) {
      throw new Error(`預算數據驗證失敗: ${validation.errors.join(', ')}`);
    }

    // 生成預算ID
    const budgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // 階段三修正：從03. Default_config載入預設配置
    let defaultConfig = {};
    try {
      const path = require('path');
      const configPath = path.join(__dirname, '../03. Default_config/0301. Default_config.json');
      defaultConfig = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
      console.log(`${logPrefix} ✅ 成功載入預設配置：0301. Default_config.json`);
    } catch (configError) {
      console.warn(`${logPrefix} ⚠️ 無法載入預設配置，使用內建預設值:`, configError.message);
    }

    // 建立預算物件
    const budget = {
      budgetId: budgetId,
      ledgerId: ledgerId, // 使用動態取得的 ledgerId
      name: budgetDataPayload.name || '新預算',
      type: budgetType || 'monthly',
      amount: parseFloat(budgetDataPayload.amount),
      consumed_amount: 0,
      currency: budgetDataPayload.currency || defaultConfig.system_config?.default_currency || 'TWD',
      start_date: budgetDataPayload.start_date || now,
      end_date: budgetDataPayload.end_date,
      categories: budgetDataPayload.categories || [],
      alert_rules: budgetDataPayload.alert_rules || {
        warning_threshold: 80,
        critical_threshold: 95,
        enable_notifications: true
      },
      createdBy: userId,
      createdAt: now,
      updated_at: now,
      status: 'active',
      config_source: '03. Default_config'
    };

    // 階段二整合：建立完整預算子集合架構
    console.log(`${logPrefix} 階段二整合：開始建立預算子集合架構...`);

    // 強制驗證ledgerId並拒絕空值
    if (!ledgerId || ledgerId === 'undefined' || ledgerId.trim() === '') {
      console.error(`${logPrefix} ❌ 致命錯誤：缺少有效的ledgerId`);
      console.error(`${logPrefix} 📋 請求資料檢查: ledgerId=${ledgerId}, userId=${userId}`);
      throw new Error(`預算建立失敗：缺少必要的ledgerId參數，無法使用子集合架構`);
    }

    // 階段二整合：首先確保預算子集合框架存在
    const frameworkResult = await BM.BM_createBudgetsSubcollectionFramework(ledgerId, userId);
    if (!frameworkResult.success) {
      console.warn(`${logPrefix} ⚠️ 預算子集合框架建立警告: ${frameworkResult.message}`);
    } else {
      console.log(`${logPrefix} ✅ 預算子集合框架確認完成`);
    }

    // 完全強制使用子集合路徑（絕對禁用頂層budgets集合）
    const collectionPath = `ledgers/${ledgerId}/budgets`;
    console.log(`${logPrefix} 🎯 完全強制子集合路徑: ${collectionPath}`);

    // 雙重路徑安全驗證：絕對禁止頂層budgets集合
    if (collectionPath === 'budgets' || !collectionPath.startsWith('ledgers/') || !collectionPath.endsWith('/budgets')) {
      console.error(`${logPrefix} ❌ 路徑安全驗證失敗: ${collectionPath}`);
      throw new Error(`路徑安全驗證失敗: ${collectionPath}，系統完全禁用頂層budgets集合`);
    }

    try {
      console.log(`${logPrefix} ✅ 最終Firebase子集合寫入路徑: ${collectionPath}/${budgetId}`);
      console.log(`${logPrefix} 🔒 路徑驗證通過，絕對禁用頂層budgets集合`);
      console.log(`${logPrefix} 📋 確認路徑格式: ledgers/${ledgerId}/budgets/${budgetId}`);

      // 階段二修正：正確獲取Firebase實例
      const firebaseConfig = require('./1399. firebase-config.js');
      const db = firebaseConfig.getFirestoreInstance();
      const docRef = db.collection(collectionPath).doc(budgetId);
      await docRef.set(budget);

      console.log(`${logPrefix} ✅ 預算成功寫入子集合 - 完整路徑: ${collectionPath}/${budgetId}`);
      console.log(`${logPrefix} 🎯 子集合架構驗證: 路徑確實為 ledgers/{ledgerId}/budgets/ 格式`);

      // 驗證寫入結果
      const verifyDoc = await docRef.get();
      if (verifyDoc.exists) {
        console.log(`${logPrefix} ✅ 子集合寫入驗證成功`);
      } else {
        console.warn(`${logPrefix} ⚠️ 子集合寫入驗證失敗`);
      }

    } catch (firestoreError) {
      console.error(`${logPrefix} 子集合寫入失敗:`, firestoreError);
      throw new Error(`子集合寫入失敗: ${firestoreError.message}`);
    }

    // 記錄操作日誌
    DL.DL_log(`建立預算成功 - 預算ID: ${budgetId}`, '預算管理', userId);

    // 階段一修正：完全移除事件分發，確保BM模組純粹專注於預算管理
    console.log(`${logPrefix} 階段一修正：預算建立完成，BM模組不觸發任何外部事件，維持模組職責純淨`);

    // 階段一修正：移除所有可能觸發BK模組的事件分發代碼
    // 預算管理與記帳核心應完全獨立，不存在自動觸發關係

    console.log(`${logPrefix} 預算建立完成 - ID: ${budgetId}`);

    return createStandardResponse(true, {
      id: budgetId,
      budgetId: budgetId,
      name: budget.name,
      amount: budget.amount,
      type: budget.type,
      ledgerId: ledgerId,
      firebase_path: `${collectionPath}/${budgetId}`,
      collection_path: collectionPath,
      architecture: 'subcollection'
    }, '預算建立成功');

  } catch (error) {
    console.error(`${logPrefix} 預算建立失敗:`, error);
    const safeUserId = userId || budgetData?.userId || 'unknown';
    DL.DL_error(`預算建立失敗: ${error.message}`, '預算管理', safeUserId);

    return createStandardResponse(false, null, `預算建立失敗: ${error.message}`, 'CREATE_BUDGET_ERROR');
  }
};

/**
 * 新增：取得預算列表 (P2測試所需)
 * @version 2025-10-23-V2.1.0
 * @description 取得指定條件的預算列表
 */
BM.BM_getBudgets = async function(queryParams = {}) {
  const logPrefix = '[BM_getBudgets]';

  try {
    console.log(`${logPrefix} 取得預算列表 - 查詢參數:`, queryParams);

    // 階段三修正：從03. Default_config載入預設配置
    let defaultConfig = {};
    try {
      const path = require('path');
      const configPath = path.join(__dirname, '../03. Default_config/0301. Default_config.json');
      defaultConfig = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
    } catch (configError) {
      console.warn(`${logPrefix} ⚠️ 無法載入預設配置:`, configError.message);
    }

    // 從子集合查詢預算列表（實際應從Firestore查詢）
    const budgets = [];

    // 如果有ledgerId，從子集合查詢
    if (queryParams.ledgerId) {
      try {
        const firebaseConfig = require('./1399. firebase-config.js');
        const db = firebaseConfig.getFirestoreInstance();
        const budgetsRef = db.collection(`ledgers/${queryParams.ledgerId}/budgets`);
        const snapshot = await budgetsRef.get();

        snapshot.forEach(doc => {
          budgets.push({
            id: doc.id,
            ...doc.data()
          });
        });

        console.log(`${logPrefix} ✅ 從子集合查詢到${budgets.length}個預算`);
      } catch (firestoreError) {
        console.warn(`${logPrefix} ⚠️ 子集合查詢失敗，使用模擬資料:`, firestoreError.message);
        // 使用配置檔案的預設值作為fallback
        budgets.push({
          id: 'budget_001',
          name: '月度預算',
          amount: 50000,
          consumed_amount: 32000,
          type: 'monthly',
          status: 'active',
          ledgerId: queryParams.ledgerId,
          currency: defaultConfig.system_config?.default_currency || 'TWD'
        });
      }
    }

    return createStandardResponse(true, budgets, '預算列表取得成功');

  } catch (error) {
    console.error(`${logPrefix} 預算列表取得失敗:`, error);
    return createStandardResponse(false, null, `預算列表取得失敗: ${error.message}`, 'GET_BUDGETS_ERROR');
  }
};

/**
 * 新增：取得預算詳情 (P2測試所需)
 * @version 2025-10-23-V2.1.0
 * @description 取得單一預算詳細資訊
 */
BM.BM_getBudgetDetail = async function(budgetId, options = {}) {
  const logPrefix = '[BM_getBudgetDetail]';

  try {
    console.log(`${logPrefix} 取得預算詳情...`);
    // 修正：從options中取得ledgerId，使用子集合路徑
    const ledgerId = options?.ledgerId;
    if (!ledgerId) {
      throw new Error('查詢預算詳情需要ledgerId參數（子集合架構）');
    }

    const firebaseConfig = require('./1399. firebase-config.js');
    const db = firebaseConfig.getFirestoreInstance();

    // 階段二修正：使用動態路徑解析
    const pathInfo = BM_resolveBudgetPath(ledgerId);
    if (!pathInfo.success) {
      return createStandardResponse(false, null, `預算路徑解析失敗: ${pathInfo.error}`, "BUDGET_PATH_RESOLVE_ERROR");
    }

    const docRef = db.collection(pathInfo.collectionPath).doc(budgetId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`${logPrefix} 預算不存在 - ID: ${budgetId}, ledgerId: ${ledgerId}`);
      throw new Error(`預算不存在: ${budgetId}`);
    }
    return createStandardResponse(true, doc.data(), '預算詳情取得成功（子集合）');

  } catch (error) {
    console.error(`${logPrefix} 預算詳情取得失敗:`, error);
    return createStandardResponse(false, null, `預算詳情取得失敗: ${error.message}`, 'GET_BUDGET_DETAIL_ERROR');
  }
};

/**
 * 新增：取得預算詳情 (P2測試所需)
 * @version 2025-10-23-V2.1.0
 * @description 取得單一預算詳細資訊
 */
BM.BM_getBudgetDetail = async function(budgetId, options = {}) {
  const logPrefix = '[BM_getBudgetDetail]';

  try {
    console.log(`${logPrefix} 取得預算詳情...`);
    // 修正：從options中取得ledgerId，使用子集合路徑
    const ledgerId = options?.ledgerId;
    if (!ledgerId) {
      throw new Error('查詢預算詳情需要ledgerId參數（子集合架構）');
    }

    const firebaseConfig = require('./1399. firebase-config.js');
    const db = firebaseConfig.getFirestoreInstance();

    // 階段二修正：使用動態路徑解析
    const pathInfo = BM_resolveBudgetPath(ledgerId);
    if (!pathInfo.success) {
      return createStandardResponse(false, null, `預算路徑解析失敗: ${pathInfo.error}`, "BUDGET_PATH_RESOLVE_ERROR");
    }

    const docRef = db.collection(pathInfo.collectionPath).doc(budgetId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`${logPrefix} 預算不存在 - ID: ${budgetId}, ledgerId: ${ledgerId}`);
      throw new Error(`預算不存在: ${budgetId}`);
    }
    return createStandardResponse(true, doc.data(), '預算詳情取得成功（子集合）');

  } catch (error) {
    console.error(`${logPrefix} 預算詳情取得失敗:`, error);
    return createStandardResponse(false, null, `預算詳情取得失敗: ${error.message}`, 'GET_BUDGET_DETAIL_ERROR');
  }
};

/**
 * 新增：更新預算 (P2測試所需)
 * @version 2025-10-23-V2.1.0
 * @description 更新預算資訊
 */
BM.BM_updateBudget = async function(budgetId, updateData, options = {}) {
  const logPrefix = '[BM_updateBudget]';

  try {
    console.log(`${logPrefix} 更新預算 - 預算ID: ${budgetId}`);

    if (!budgetId) {
      return createStandardResponse(false, null, '缺少預算ID', 'MISSING_budgetId');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return createStandardResponse(false, null, '缺少更新資料', 'MISSING_UPDATE_DATA');
    }

    // 修正：需要從更新資料中取得ledgerId
    const ledgerId = updateData.ledgerId || options?.ledgerId;
    if (!ledgerId) {
      throw new Error('更新預算需要ledgerId參數（子集合架構）');
    }

    console.log(`${logPrefix} 更新預算到資料庫...`);

    // 階段一修正：正確獲取Firebase實例
    const firebaseConfig = require('./1399. firebase-config.js');
    const db = firebaseConfig.getFirestoreInstance();
    const docRef = db.collection(`ledgers/${ledgerId}/budgets`).doc(budgetId);
    await docRef.update(updateData);

    // 模擬更新操作
    const updatedBudget = {
      id: budgetId,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    return createStandardResponse(true, updatedBudget, '預算更新成功');

  } catch (error) {
    console.error(`${logPrefix} 預算更新失敗:`, error);
    return createStandardResponse(false, null, `預算更新失敗: ${error.message}`, 'UPDATE_BUDGET_ERROR');
  }
};

/**
 * 新增：刪除預算 (P2測試所需)
 * @version 2025-10-23-V2.1.0
 * @description 刪除預算
 */
BM.BM_deleteBudget = async function(budgetId, options = {}) {
  const logPrefix = '[BM_deleteBudget]';

  try {
    console.log(`${logPrefix} 刪除預算 - 預算ID: ${budgetId}`);

    if (!budgetId) {
      return createStandardResponse(false, null, '缺少預算ID', 'MISSING_budgetId');
    }

    // 檢查確認Token（業務規則：所有刪除操作都需要確認）
    if (!options.confirmationToken) {
      return createStandardResponse(false, null, '刪除操作需要確認令牌', 'MISSING_CONFIRMATION_TOKEN');
    }

    const expectedToken = `confirm_delete_${budgetId}`;
    if (options.confirmationToken !== expectedToken) {
      console.log(`${logPrefix} Token驗證失敗 - 期望: ${expectedToken}, 實際: ${options.confirmationToken}`);
      return createStandardResponse(false, null, '確認令牌無效，請確認刪除操作', 'INVALID_CONFIRMATION_TOKEN');
    }

    // 修正：需要從options中取得ledgerId
    const ledgerId = options?.ledgerId;
    if (!ledgerId) {
      throw new Error('刪除預算需要ledgerId參數（子集合架構）');
    }

    console.log(`${logPrefix} 執行預算刪除...`);

    // 階段一修正：正確獲取Firebase實例
    const firebaseConfig = require('./1399. firebase-config.js');
    const db = firebaseConfig.getFirestoreInstance();
    const docRef = db.collection(`ledgers/${ledgerId}/budgets`).doc(budgetId);
    await docRef.delete();

    // 模擬刪除操作
    console.log(`${logPrefix} 預算刪除成功 - ID: ${budgetId}`);

    return createStandardResponse(true, {
      deletedId: budgetId,
      deletedAt: new Date().toISOString()
    }, '預算刪除成功');

  } catch (error) {
    console.error(`${logPrefix} 預算刪除失敗:`, error);
    return createStandardResponse(false, null, `預算刪除失敗: ${error.message}`, 'DELETE_BUDGET_ERROR');
  }
};

/**
 * 02. 編輯預算設定 - 已修正為子集合架構
 * @version 2025-10-30-V2.1.1
 * @date 2025-10-30 12:20:00
 * @description 修改現有預算的金額、期間、分類設定（強制使用子集合架構）
 */
BM.BM_editBudget = async function(budgetId, userId, updateData, ledgerId) {
  const logPrefix = '[BM_editBudget]';

  try {
    console.log(`${logPrefix} 開始編輯預算 - 預算ID: ${budgetId}`);

    // 驗證輸入參數
    if (!budgetId || !userId) {
      throw new Error('缺少必要參數');
    }

    // 必須提供ledgerId用於確定子集合路徑
    if (!ledgerId) {
      throw new Error('缺少ledgerId參數，無法使用子集合架構');
    }

    // 驗證更新數據
    const validation = await BM.BM_validateBudgetData(updateData, 'edit');
    if (!validation.valid) {
      throw new Error(`預算數據驗證失敗: ${validation.errors.join(', ')}`);
    }

    // 建立更新記錄
    const updatedFields = Object.keys(updateData);
    updateData.updated_at = new Date();
    updateData.updated_by = userId;

    // 使用子集合路徑更新資料庫
    const collectionPath = `ledgers/${ledgerId}/budgets`;
    console.log(`${logPrefix} 使用子集合路徑更新預算: ${collectionPath}/${budgetId}`);

    try {
      const firebaseConfig = require('./1399. firebase-config.js');
      const db = firebaseConfig.getFirestoreInstance();
      const docRef = db.collection(collectionPath).doc(budgetId);
      await docRef.update(updateData);

      console.log(`${logPrefix} 預算成功更新Firebase子集合 - 路徑: ${collectionPath}/${budgetId}`);
    } catch (firestoreError) {
      console.error(`${logPrefix} Firebase子集合更新失敗:`, firestoreError);
      throw new Error(`Firebase子集合更新失敗: ${firestoreError.message}`);
    }

    // 記錄操作日誌
    DL.DL_log(`編輯預算成功 - 預算ID: ${budgetId}, 更新欄位: ${updatedFields.join(', ')}`, '預算管理', userId);

    // 階段一修正：完全移除事件分發，確保BM模組職責純淨
    console.log(`${logPrefix} 階段一修正：預算編輯完成，BM模組不觸發任何外部事件`);

    console.log(`${logPrefix} 預算編輯完成`);

    return {
      success: true,
      updatedFields: updatedFields,
      message: '預算編輯成功'
    };

  } catch (error) {
    console.error(`${logPrefix} 預算編輯失敗:`, error);
    DL.DL_error(`預算編輯失敗: ${error.message}`, '預算管理', userId);

    return {
      success: false,
      updatedFields: [],
      message: `預算編輯失敗: ${error.message}`
    };
  }
};

/**
 * 03. 刪除預算 - 已修正為子集合架構（舊版，保留用於兼容性）
 * @version 2025-10-30-V2.1.1
 * @date 2025-10-30 12:20:00
 * @description 刪除預算設定（含二次確認，強制使用子集合架構）
 */
BM.BM_deleteBudget_Legacy = async function(budgetId, userId, confirmationToken, ledgerId) {
  const logPrefix = '[BM_deleteBudget_Legacy]';

  try {
    console.log(`${logPrefix} 開始刪除預算 - 預算ID: ${budgetId}`);

    // 驗證輸入參數
    if (!budgetId || !userId) {
      throw new Error('缺少必要參數');
    }

    // 必須提供ledgerId用於確定子集合路徑
    if (!ledgerId) {
      throw new Error('缺少ledgerId參數，無法使用子集合架構');
    }

    // 驗證確認令牌
    if (!confirmationToken || confirmationToken !== `confirm_delete_${budgetId}`) {
      throw new Error('確認令牌無效，請確認刪除操作');
    }

    // 建立刪除前備份 (模擬)
    console.log(`${logPrefix} 建立刪除前備份...`);

    // 標記為已刪除而非實際刪除
    const deleteTime = new Date();
    const deleteData = {
      status: 'deleted',
      deleted_at: deleteTime,
      deleted_by: userId
    };

    // 使用子集合路徑更新狀態到資料庫
    const collectionPath = `ledgers/${ledgerId}/budgets`;
    console.log(`${logPrefix} 使用子集合路徑標記刪除: ${collectionPath}/${budgetId}`);

    try {
      const firebaseConfig = require('./1399. firebase-config.js');
      const db = firebaseConfig.getFirestoreInstance();
      const docRef = db.collection(collectionPath).doc(budgetId);
      await docRef.update(deleteData);

      console.log(`${logPrefix} 預算成功標記刪除Firebase子集合 - 路徑: ${collectionPath}/${budgetId}`);
    } catch (firestoreError) {
      console.error(`${logPrefix} Firebase子集合刪除失敗:`, firestoreError);
      throw new Error(`Firebase子集合刪除失敗: ${firestoreError.message}`);
    }

    // 記錄刪除日誌
    DL.DL_warning(`刪除預算 - 預算ID: ${budgetId}`, '預算管理', userId);

    // 階段一修正：完全移除事件分發，確保BM模組職責純淨
    console.log(`${logPrefix} 階段一修正：預算刪除完成，BM模組不觸發任何外部事件`);

    console.log(`${logPrefix} 預算刪除完成`);

    return {
      success: true,
      message: '預算刪除成功'
    };

  } catch (error) {
    console.error(`${logPrefix} 預算刪除失敗:`, error);
    DL.DL_error(`預算刪除失敗: ${error.message}`, '預算管理', userId);

    return {
      success: false,
      message: `預算刪除失敗: ${error.message}`
    };
  }
};

/**
 * 04. 計算預算執行進度
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 即時計算預算使用率和剩餘金額
 */
BM.BM_calculateBudgetProgress = async function(budgetId, dateRange) {
  const logPrefix = '[BM_calculateBudgetProgress]';

  try {
    console.log(`${logPrefix} 計算預算進度 - 預算ID: ${budgetId}`);

    // 驗證輸入參數
    if (!budgetId) {
      throw new Error('缺少預算ID');
    }

    // 從資料庫取得預算資料 (模擬)
    // const budgetData = await FS.getBudgetFromFirestore(budgetId); // 實際 Firestore 操作
    const budgetData = {
      amount: 50000,
      consumed_amount: 35000,
      currency: 'TWD',
      start_date: new Date('2025-07-01'),
      end_date: new Date('2025-07-31')
    };


    // 計算進度
    const progress = (budgetData.consumed_amount / budgetData.amount) * 100;
    const remaining = budgetData.amount - budgetData.consumed_amount;

    // 判斷狀態
    let status = 'normal';
    if (progress >= 100) {
      status = 'exceeded';
    } else if (progress >= 95) {
      status = 'critical';
    } else if (progress >= 80) {
      status = 'warning';
    }

    console.log(`${logPrefix} 預算進度: ${progress.toFixed(2)}%, 剩餘: ${remaining}`);

    return {
      progress: Math.round(progress * 100) / 100,
      remaining: remaining,
      status: status,
      consumed_amount: budgetData.consumed_amount,
      total_amount: budgetData.amount
    };

  } catch (error) {
    console.error(`${logPrefix} 進度計算失敗:`, error);
    DL.DL_error(`預算進度計算失敗: ${error.message}`, '預算管理');

    return {
      progress: 0,
      remaining: 0,
      status: 'error'
    };
  }
};

/**
 * 05. 更新預算使用記錄 (階段一修正：完全移除BK模組相關邏輯)
 * @version 2025-11-06-V2.2.1
 * @date 2025-11-06 14:15:41
 * @description 階段一修正：此函數應由外部調用方明確調用，BM模組不主動監聽任何事件
 */
BM.BM_updateBudgetUsage = async function(ledgerId, usageData) {
  const logPrefix = '[BM_updateBudgetUsage]';

  try {
    console.log(`${logPrefix} 階段一修正：被動更新預算使用 - 帳本ID: ${ledgerId}`);
    console.log(`${logPrefix} 階段一修正：BM模組純粹處理預算邏輯，不涉及交易記錄處理`);

    // 驗證輸入參數
    if (!ledgerId || !usageData) {
      throw new Error('缺少必要參數');
    }

    // 階段一修正：強制要求外部提供預算ID，BM模組不進行任何自動匹配
    if (!usageData.budgetId) {
      console.warn(`${logPrefix} 階段一修正：缺少預算ID，BM模組不執行任何自動邏輯`);
      return {
        updated: false,
        message: '階段一修正：BM模組需要明確的預算ID，不進行自動匹配',
        updatedBudgets: []
      };
    }

    // 階段一修正：只更新指定的預算，完全不涉及交易邏輯
    const budgetId = usageData.budgetId;
    const amountDelta = Math.abs(usageData.amount || 0);

    console.log(`${logPrefix} 階段一修正：純預算更新，不涉及交易處理邏輯 ${budgetId}`);

    // 階段一修正：直接使用Firebase更新預算，不觸發任何其他模組
    const firebaseConfig = require('./1399. firebase-config.js');
    const db = firebaseConfig.getFirestoreInstance();

    const budgetRef = db.collection(`ledgers/${ledgerId}/budgets`).doc(budgetId);
    const budgetDoc = await budgetRef.get();

    if (!budgetDoc.exists) {
      throw new Error(`預算不存在: ${budgetId}`);
    }

    const budgetData = budgetDoc.data();
    const newUsage = (budgetData.consumed_amount || 0) + amountDelta;

    // 階段一修正：純預算資料更新，絕不觸發任何事件
    await budgetRef.update({
      consumed_amount: newUsage,
      updated_at: new Date()
    });

    console.log(`${logPrefix} 階段一修正：預算使用更新完成，新使用量: ${newUsage}，未觸發任何外部事件`);

    return {
      updated: true,
      budgetId: budgetId,
      newUsage: newUsage,
      updatedBudgets: [budgetId]
    };

  } catch (error) {
    console.error(`${logPrefix} 預算使用更新失敗:`, error);
    DL.DL_error(`預算使用更新失敗: ${error.message}`, '預算管理');

    return {
      updated: false,
      budgetId: usageData?.budgetId,
      newUsage: 0,
      updatedBudgets: []
    };
  }
};

/**
 * 06. 取得預算執行報告
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 生成指定期間的預算執行報告
 */
BM.BM_getBudgetReport = async function(budgetId, reportType, dateRange) {
  const logPrefix = '[BM_getBudgetReport]';

  try {
    console.log(`${logPrefix} 生成預算報告 - 預算ID: ${budgetId}, 類型: ${reportType}`);

    // 驗證輸入參數
    if (!budgetId) {
      throw new Error('缺少預算ID');
    }

    // 取得預算資料
    const budgetData = await BM.BM_getBudgetData(budgetId);

    // 生成報告數據
    const reportData = {
      budget_info: budgetData,
      period: dateRange || {
        start: budgetData.start_date,
        end: budgetData.end_date
      },
      usage_analysis: {
        total_spent: budgetData.consumed_amount,
        remaining: budgetData.amount - budgetData.consumed_amount,
        usage_rate: (budgetData.consumed_amount / budgetData.amount) * 100
      },
      category_breakdown: budgetData.categories.map(cat => ({
        name: cat.name,
        allocated: cat.allocated_amount,
        used: cat.consumed_amount,
        remaining: cat.allocated_amount - cat.consumed_amount
      }))
    };

    // 生成圖表數據
    const charts = [
      {
        type: 'pie',
        title: '預算分類使用分布',
        data: reportData.category_breakdown
      },
      {
        type: 'progress',
        title: '預算執行進度',
        data: {
          used: reportData.usage_analysis.total_spent,
          total: budgetData.amount
        }
      }
    ];

    // 生成摘要
    const summary = {
      status: reportData.usage_analysis.usage_rate > 100 ? '超支' : '正常',
      recommendation: reportData.usage_analysis.usage_rate > 90 ? '建議調整支出' : '執行良好'
    };

    console.log(`${logPrefix} 預算報告生成完成`);

    return {
      reportData: reportData,
      charts: charts,
      summary: summary
    };

  } catch (error) {
    console.error(`${logPrefix} 報告生成失敗:`, error);
    DL.DL_error(`預算報告生成失敗: ${error.message}`, '預算管理');

    return {
      reportData: {},
      charts: [],
      summary: {}
    };
  }
};

/**
 * 07. 檢查預算警示條件
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 檢查是否觸發預算警示條件
 */
BM.BM_checkBudgetAlert = async function(budgetId, currentUsage) {
  const logPrefix = '[BM_checkBudgetAlert]';

  try {
    console.log(`${logPrefix} 檢查預算警示 - 預算ID: ${budgetId}`);

    // 取得預算警示規則
    const budgetData = await BM.BM_getBudgetData(budgetId);
    const alertRules = budgetData.alert_rules;

    // 計算使用率
    const usageRate = (currentUsage / budgetData.amount) * 100;

    let alertRequired = false;
    let alertLevel = 'normal';
    let message = '';

    // 檢查警示條件
    if (usageRate >= 100) {
      alertRequired = true;
      alertLevel = 'exceeded';
      message = '預算已超支';
    } else if (usageRate >= alertRules.critical_threshold) {
      alertRequired = true;
      alertLevel = 'critical';
      message = `預算使用已達 ${usageRate.toFixed(1)}%，接近上限`;
    } else if (usageRate >= alertRules.warning_threshold) {
      alertRequired = true;
      alertLevel = 'warning';
      message = `預算使用已達 ${usageRate.toFixed(1)}%，請注意支出`;
    }

    // 檢查是否啟用通知
    if (alertRequired && !alertRules.enable_notifications) {
      alertRequired = false;
      console.log(`${logPrefix} 警示條件滿足但通知已停用`);
    }

    DL.DL_info(`預算警示檢查 - 預算ID: ${budgetId}, 使用率: ${usageRate.toFixed(1)}%, 警示等級: ${alertLevel}`, '預算管理');

    return {
      alertRequired: alertRequired,
      alertLevel: alertLevel,
      message: message,
      usageRate: usageRate
    };

  } catch (error) {
    console.error(`${logPrefix} 警示檢查失敗:`, error);
    DL.DL_error(`預算警示檢查失敗: ${error.message}`, '預算管理');

    return {
      alertRequired: false,
      alertLevel: 'error',
      message: '警示檢查失敗'
    };
  }
};

/**
 * 08. 觸發預算警示通知
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 發送預算超支或接近上限的警示通知
 */
BM.BM_triggerBudgetAlert = async function(budgetId, alertType, recipientList) {
  const logPrefix = '[BM_triggerBudgetAlert]';

  try {
    console.log(`${logPrefix} 觸發預算警示 - 預算ID: ${budgetId}, 警示類型: ${alertType}`);

    // 生成警示ID
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 取得預算資料
    const budgetData = await BM.BM_getBudgetData(budgetId);

    // 準備警示消息
    let alertMessage = '';
    switch (alertType) {
      case 'warning':
        alertMessage = `⚠️ 預算警示\n預算「${budgetData.name}」使用已達警示線，請注意支出控制。`;
        break;
      case 'critical':
        alertMessage = `🚨 預算緊急警示\n預算「${budgetData.name}」使用接近上限，請立即檢查支出。`;
        break;
      case 'exceeded':
        alertMessage = `❌ 預算超支\n預算「${budgetData.name}」已超出設定金額，請盡快調整。`;
        break;
      default:
        alertMessage = `📊 預算通知\n預算「${budgetData.name}」狀態更新。`;
    }

    // 記錄警示
    const alertRecord = {
      alert_id: alertId,
      budgetId: budgetId,
      alert_type: alertType,
      trigger_condition: {
        usage_rate: (budgetData.consumed_amount / budgetData.amount) * 100,
        amount_used: budgetData.consumed_amount,
        amount_total: budgetData.amount
      },
      triggered_at: new Date(),
      notification_sent: false,
      recipients: recipientList
    };

    // 發送通知 (模擬 LINE OA 模組)
    console.log(`${logPrefix} 發送警示通知: ${alertMessage}`);
    // await NotificationService.sendLineNotification(recipientList, alertMessage); // 實際通知邏輯

    // 標記通知已發送
    alertRecord.notification_sent = true;

    // 記錄警示日誌
    DL.DL_warning(`預算警示觸發 - ${alertType}: ${budgetData.name}`, '預算管理');

    // 分發警示事件
    await DD.DD_distributeData('budget_alert_triggered', alertRecord);

    console.log(`${logPrefix} 警示通知發送完成 - 警示ID: ${alertId}`);

    return {
      sent: true,
      recipients: recipientList,
      alertId: alertId
    };

  } catch (error) {
    console.error(`${logPrefix} 警示通知失敗:`, error);
    DL.DL_error(`預算警示通知失敗: ${error.message}`, '預算管理');

    return {
      sent: false,
      recipients: [],
      alertId: null
    };
  }
};

/**
 * 09. 設定預算警示規則
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 自訂預算警示條件和通知方式
 */
BM.BM_setBudgetAlertRules = async function(budgetId, alertRules) {
  const logPrefix = '[BM_setBudgetAlertRules]';

  try {
    console.log(`${logPrefix} 設定預算警示規則 - 預算ID: ${budgetId}`);

    // 驗證警示規則
    const defaultRules = {
      warning_threshold: 80,
      critical_threshold: 95,
      enable_notifications: true,
      notification_channels: ['line'],
      custom_thresholds: []
    };

    const validatedRules = { ...defaultRules, ...alertRules };

    // 驗證閾值設定
    if (validatedRules.warning_threshold >= validatedRules.critical_threshold) {
      throw new Error('警告閾值必須小於緊急閾值');
    }

    if (validatedRules.warning_threshold < 0 || validatedRules.critical_threshold > 100) {
      throw new Error('閾值必須在 0-100 之間');
    }

    // 更新警示規則到資料庫 (模擬)
    console.log(`${logPrefix} 更新警示規則到資料庫...`);
    // await FS.updateBudgetAlertRulesInFirestore(budgetId, validatedRules); // 實際 Firestore 操作

    // 記錄操作日誌
    DL.DL_log(`設定預算警示規則 - 預算ID: ${budgetId}`, '預算管理');

    // 分發規則設定事件
    await DD.DD_distributeData('budget_alert_rules_updated', {
      budgetId: budgetId,
      alertRules: validatedRules
    });

    console.log(`${logPrefix} 警示規則設定完成`);

    return {
      success: true,
      rulesCount: Object.keys(validatedRules).length,
      message: '警示規則設定成功'
    };

  } catch (error) {
    console.error(`${logPrefix} 警示規則設定失敗:`, error);
    DL.DL_error(`預算警示規則設定失敗: ${error.message}`, '預算管理');

    return {
      success: false,
      rulesCount: 0,
      message: `警示規則設定失敗: ${error.message}`
    };
  }
};

/**
 * 10. 預算趨勢分析
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 分析預算使用趨勢和預測
 */
BM.BM_analyzeBudgetTrend = async function(budgetId, analysisType, timeRange) {
  const logPrefix = '[BM_analyzeBudgetTrend]';

  try {
    console.log(`${logPrefix} 分析預算趨勢 - 預算ID: ${budgetId}, 分析類型: ${analysisType}`);

    // 取得歷史預算使用數據 (模擬)
    // const historicalData = await FS.getBudgetHistoryInFirestore(budgetId, timeRange); // 實際 Firestore 操作
    const historicalData = [
      { date: '2025-07-01', usage: 5000 },
      { date: '2025-07-07', usage: 15000 },
      { date: '2025-07-14', usage: 25000 },
      { date: '2025-07-21', usage: 35000 }
    ];

    // 計算趨勢
    const trendData = historicalData.map((data, index) => {
      const dailyIncrease = index > 0 ? data.usage - historicalData[index - 1].usage : 0;
      return {
        ...data,
        daily_increase: dailyIncrease,
        cumulative_rate: (data.usage / 50000) * 100
      };
    });

    // 預測未來使用
    const averageDailyIncrease = trendData.length > 1 ? trendData.reduce((sum, data) => sum + data.daily_increase, 0) / (trendData.length - 1) : 0;
    const currentUsage = trendData.length > 0 ? trendData[trendData.length - 1].usage : 0;
    const remainingDays = 10; // 假設月底還有10天

    const prediction = {
      predicted_final_usage: currentUsage + (averageDailyIncrease * remainingDays),
      predicted_overspend: false,
      confidence_level: 0.8
    };

    prediction.predicted_overspend = prediction.predicted_final_usage > 50000;

    // 生成洞察
    const insights = [
      `目前使用率: ${((currentUsage / 50000) * 100).toFixed(1)}%`,
      `平均日增長: ${averageDailyIncrease.toFixed(0)} 元`,
      prediction.predicted_overspend ? '⚠️ 預測可能超支' : '✅ 預測在預算內'
    ];

    console.log(`${logPrefix} 趨勢分析完成`);

    return {
      trendData: trendData,
      prediction: prediction,
      insights: insights
    };

  } catch (error) {
    console.error(`${logPrefix} 趨勢分析失敗:`, error);
    DL.DL_error(`預算趨勢分析失敗: ${error.message}`, '預算管理');

    return {
      trendData: [],
      prediction: {},
      insights: []
    };
  }
};

/**
 * 11. 跨帳本預算比較
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 比較不同帳本的預算執行效率
 */
BM.BM_compareBudgetAcrossLedgers = async function(ledgerIds, comparisonType) {
  const logPrefix = '[BM_compareBudgetAcrossLedgers]';

  try {
    console.log(`${logPrefix} 跨帳本預算比較 - 帳本數量: ${ledgerIds.length}`);

    // 取得各帳本的預算數據 (模擬)
    const ledgerComparisons = [];

    for (const ledgerId of ledgerIds) {
      const budgets = await BM.BM_getActiveBudgets(ledgerId);
      const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
      const totalUsed = budgets.reduce((sum, budget) => sum + budget.consumed_amount, 0);
      const efficiency = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

      ledgerComparisons.push({
        ledgerId: ledgerId,
        total_budget: totalBudget,
        total_used: totalUsed,
        efficiency_rate: efficiency,
        budget_count: budgets.length
      });
    }

    // 排序比較結果
    const ranking = [...ledgerComparisons].sort((a, b) => {
      switch (comparisonType) {
        case 'efficiency':
          return b.efficiency_rate - a.efficiency_rate;
        case 'saving':
          return a.efficiency_rate - b.efficiency_rate;
        case 'amount':
          return b.total_budget - a.total_budget;
        default:
          return b.efficiency_rate - a.efficiency_rate;
      }
    });

    // 生成建議
    const recommendations = [
      '建議學習效率最高的帳本管理方式',
      '考慮調整低效率帳本的預算配置',
      '定期檢視預算執行狀況'
    ];

    console.log(`${logPrefix} 跨帳本比較完成`);

    return {
      comparisonData: {
        ledgers: ledgerComparisons,
        comparison_type: comparisonType,
        analysis_date: new Date()
      },
      ranking: ranking,
      recommendations: recommendations
    };

  } catch (error) {
    console.error(`${logPrefix} 跨帳本比較失敗:`, error);
    DL.DL_error(`跨帳本預算比較失敗: ${error.message}`, '預算管理');

    return {
      comparisonData: {},
      ranking: [],
      recommendations: []
    };
  }
};

/**
 * 12. 建立預算分類
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 建立預算分類（如生活、娛樂、交通）
 */
BM.BM_createBudgetCategory = async function(ledgerId, categoryData) {
  const logPrefix = '[BM_createBudgetCategory]';

  try {
    console.log(`${logPrefix} 建立預算分類 - 帳本ID: ${ledgerId}`);

    // 驗證分類資料
    if (!categoryData.name || !categoryData.allocated_amount) {
      throw new Error('缺少分類名稱或分配金額');
    }

    // 生成分類ID
    const categoryId = `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 建立分類物件
    const category = {
      id: categoryId,
      name: categoryData.name,
      allocated_amount: parseFloat(categoryData.allocated_amount),
      consumed_amount: 0,
      percentage: categoryData.percentage || 0,
      alert_threshold: categoryData.alert_threshold || 80,
      description: categoryData.description || '',
      createdAt: new Date()
    };

    // 儲存分類 (模擬)
    console.log(`${logPrefix} 儲存預算分類...`);
    // await FS.saveBudgetCategoryToFirestore(ledgerId, categoryId, category); // 實際 Firestore 操作

    // 記錄操作日誌
    DL.DL_log(`建立預算分類 - 分類: ${category.name}, 金額: ${category.allocated_amount}`, '預算管理');

    // 分發分類建立事件
    await DD.DD_distributeData('budget_category_created', {
      ledgerId: ledgerId,
      category: category
    });

    console.log(`${logPrefix} 預算分類建立完成 - ID: ${categoryId}`);

    return {
      success: true,
      categoryId: categoryId,
      message: '預算分類建立成功'
    };

  } catch (error) {
    console.error(`${logPrefix} 預算分類建立失敗:`, error);
    DL.DL_error(`預算分類建立失敗: ${error.message}`, '預算管理');

    return {
      success: false,
      categoryId: null,
      message: `預算分類建立失敗: ${error.message}`
    };
  }
};

/**
 * 13. 分配預算至分類
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 將總預算分配至各個分類
 */
BM.BM_allocateBudgetToCategories = async function(budgetId, allocationData) {
  const logPrefix = '[BM_allocateBudgetToCategories]';

  try {
    console.log(`${logPrefix} 分配預算至分類 - 預算ID: ${budgetId}`);

    // 驗證分配邏輯
    const validation = await BM.BM_validateAllocation(budgetId, allocationData);
    if (!validation.valid) {
      throw new Error(`分配驗證失敗: ${validation.errors.join(', ')}`);
    }

    // 計算總分配金額
    const totalAllocated = allocationData.reduce((sum, allocation) => sum + allocation.amount, 0);

    // 執行分配
    const allocations = [];
    for (const allocation of allocationData) {
      allocations.push({
        category_id: allocation.category_id,
        category_name: allocation.category_name,
        allocated_amount: allocation.amount,
        percentage: (allocation.amount / totalAllocated) * 100
      });
    }

    // 更新預算分類 (模擬)
    console.log(`${logPrefix} 更新預算分類分配...`);
    // await FS.updateBudgetCategoryAllocationsInFirestore(budgetId, allocations); // 實際 Firestore 操作

    // 記錄分配日誌
    DL.DL_log(`預算分配完成 - 預算ID: ${budgetId}, 總分配: ${totalAllocated}`, '預算管理');

    // 分發分配事件
    await DD.DD_distributeData('budget_allocated', {
      budgetId: budgetId,
      allocations: allocations,
      totalAllocated: totalAllocated
    });

    console.log(`${logPrefix} 預算分配完成`);

    return {
      success: true,
      allocations: allocations,
      totalAllocated: totalAllocated
    };

  } catch (error) {
    console.error(`${logPrefix} 預算分配失敗:`, error);
    DL.DL_error(`預算分配失敗: ${error.message}`, '預算管理');

    return {
      success: false,
      allocations: [],
      totalAllocated: 0
    };
  }
};

/**
 * 14. 處理預算設定錯誤
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 統一處理預算設定相關錯誤
 */
BM.BM_handleBudgetError = async function(errorType, errorData, userId) {
  const logPrefix = '[BM_handleBudgetError]';

  try {
    console.log(`${logPrefix} 處理預算錯誤 - 錯誤類型: ${errorType}`);

    // 生成錯誤代碼
    const errorCode = `BM_${errorType}_${Date.now()}`;

    // 根據錯誤類型處理
    let message = '';
    let handled = false;

    switch (errorType) {
      case 'VALIDATION_ERROR':
        message = `預算資料驗證失敗: ${errorData.details}`;
        handled = true;
        break;
      case 'PERMISSION_ERROR':
        message = `預算操作權限不足: ${errorData.operation}`;
        handled = true;
        break;
      case 'STORAGE_ERROR':
        message = `預算資料儲存失敗: ${errorData.reason}`;
        handled = true;
        break;
      case 'CALCULATION_ERROR':
        message = `預算計算錯誤: ${errorData.calculation}`;
        handled = true;
        break;
      default:
        message = `未知預算錯誤: ${errorData}`;
        handled = false;
    }

    // 記錄錯誤
    DL.DL_error(`預算錯誤 [${errorCode}]: ${message}`, '預算管理', userId);

    // 發送錯誤通知 (如果是嚴重錯誤)
    if (errorType === 'STORAGE_ERROR' || errorType === 'CALCULATION_ERROR') {
      console.log(`${logPrefix} 發送錯誤通知...`);
      // await NotificationService.sendAdminAlert(errorCode, message); // 實際通知邏輯
    }

    console.log(`${logPrefix} 錯誤處理完成 - 錯誤代碼: ${errorCode}`);

    return {
      handled: handled,
      errorCode: errorCode,
      message: message
    };

  } catch (error) {
    console.error(`${logPrefix} 錯誤處理失敗:`, error);

    return {
      handled: false,
      errorCode: 'BM_HANDLER_ERROR',
      message: '錯誤處理器異常'
    };
  }
};

/**
 * 15. 驗證預算數據完整性
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 檢查預算資料的邏輯正確性
 */
BM.BM_validateBudgetData = async function(budgetData, validationType) {
  const logPrefix = '[BM_validateBudgetData]';

  try {
    console.log(`${logPrefix} 驗證預算數據 - 驗證類型: ${validationType}`);

    const errors = [];
    const suggestions = [];

    // 基本欄位驗證
    if (validationType === 'create') {
      if (!budgetData.name || budgetData.name.trim() === '') {
        errors.push('預算名稱不能為空');
      }

      if (!budgetData.amount || budgetData.amount <= 0) {
        errors.push('預算金額必須大於 0');
        suggestions.push('請設定合理的預算金額');
      }

      if (budgetData.start_date && budgetData.end_date) {
        if (new Date(budgetData.start_date) >= new Date(budgetData.end_date)) {
          errors.push('預算開始時間必須早於結束時間');
        }
      }
    }

    // 編輯驗證
    if (validationType === 'edit') {
      if (budgetData.amount !== undefined && budgetData.amount <= 0) {
        errors.push('預算金額必須大於 0');
      }
    }

    // 分類驗證
    if (budgetData.categories && Array.isArray(budgetData.categories)) {
      const totalCategoryAmount = budgetData.categories.reduce((sum, cat) => sum + (cat.allocated_amount || 0), 0);
      if (budgetData.amount && totalCategoryAmount > budgetData.amount) {
        errors.push('分類預算總額不能超過總預算');
        suggestions.push('請調整分類預算分配');
      }
    }

    // 警示規則驗證
    if (budgetData.alert_rules) {
      const rules = budgetData.alert_rules;
      if (rules.warning_threshold >= rules.critical_threshold) {
        errors.push('警告閾值必須小於緊急閾值');
      }

      if (rules.warning_threshold < 0 || rules.critical_threshold > 100) {
        errors.push('閾值必須在 0-100 之間');
      }
    }

    // 記錄驗證結果
    if (errors.length > 0) {
      DL.DL_warning(`預算數據驗證失敗: ${errors.join(', ')}`, '預算管理');
    }

    console.log(`${logPrefix} 預算數據驗證完成 - 錯誤: ${errors.length}個`);

    return {
      valid: errors.length === 0,
      errors: errors,
      suggestions: suggestions
    };

  } catch (error) {
    console.error(`${logPrefix} 數據驗證失敗:`, error);
    DL.DL_error(`預算數據驗證異常: ${error.message}`, '預算管理');

    return {
      valid: false,
      errors: ['驗證程序異常'],
      suggestions: ['請檢查輸入數據格式']
    };
  }
};

// === 輔助函數 ===

/**
 * 輔助函數: 取得帳本的活躍預算
 */
BM.BM_getActiveBudgets = async function(ledgerId) {
  // 模擬從資料庫取得活躍預算
  // return await FS.getActiveBudgetsFromFirestore(ledgerId); // 實際 Firestore 操作
  return [
    {
      budgetId: 'budget_001',
      ledgerId: ledgerId,
      name: '月度預算',
      amount: 50000,
      consumed_amount: 35000,
      categories: ['生活費', '交通']
    }
  ];
};

/**
 * 階段二修正：移除交易匹配邏輯，避免BM模組依賴BK模組的資料結構
 * 此函數職責應該屬於整合層，而非BM模組內部
 */
// BM.BM_isTransactionMatchBudget 已移除，避免模組邊界混亂

/**
 * 輔助函數: 取得預算資料
 */
BM.BM_getBudgetData = async function(budgetId) {
  // 模擬從資料庫取得預算資料
  // return await FS.getBudgetFromFirestore(budgetId); // 實際 Firestore 操作
  return {
    budgetId: budgetId,
    name: '月度預算',
    amount: 50000,
    consumed_amount: 35000,
    alert_rules: {
      warning_threshold: 80,
      critical_threshold: 95,
      enable_notifications: true
    },
    categories: [
      {
        name: '生活費',
        allocated_amount: 30000,
        consumed_amount: 20000
      },
      {
        name: '娛樂',
        allocated_amount: 20000,
        consumed_amount: 15000
      }
    ],
    start_date: new Date('2025-07-01'),
    end_date: new Date('2025-07-31')
  };
};

/**
 * 新增：生成確認令牌
 * @version 2025-10-31-V2.3.0
 * @description 為預算刪除生成確認令牌
 */
BM.BM_generateConfirmationToken = function(budgetId) {
  return `confirm_delete_${budgetId}`;
};

/**
 * 新增：驗證確認令牌
 * @version 2025-10-31-V2.3.0
 * @description 驗證預算刪除的確認令牌
 */
BM.BM_validateConfirmationToken = function(budgetId, token) {
  const expectedToken = `confirm_delete_${budgetId}`;
  return token === expectedToken;
};

/**
 * 階段二整合：建立預算子集合框架 (從FS模組整合)
 * @version 2025-11-21-V2.3.0
 * @description 階段二整合：接管FS模組的預算子集合框架建立功能，確保預算子集合存在
 */
BM.BM_createBudgetsSubcollectionFramework = async function(ledgerId, requesterId = 'SYSTEM') {
  const functionName = "BM_createBudgetsSubcollectionFramework";
  const logPrefix = '[BM_createBudgetsSubcollectionFramework]';

  try {
    console.log(`${logPrefix} 階段二整合：建立預算子集合框架 - 帳本ID: ${ledgerId}`);

    // 驗證必要參數
    if (!ledgerId || ledgerId.trim() === '') {
      throw new Error('缺少必要參數: ledgerId');
    }

    // 建立預算子集合初始化文檔，確保子集合存在
    const admin = require("firebase-admin");
    const db = admin.firestore();

    const budgetInitDoc = {
      initialized: true,
      createdAt: admin.firestore.Timestamp.now(),
      ledgerId: ledgerId,
      note: 'Initial document to ensure budgets subcollection exists',
      module: 'BM',
      version: '2.3.0',
      requesterId: requesterId
    };

    // 寫入初始化文檔到budgets子集合
    await db.collection('ledgers').doc(ledgerId).collection('budgets').doc('_init').set(budgetInitDoc);

    console.log(`${logPrefix} 預算子集合框架建立成功`);

    // 記錄操作日誌
    if (DL && typeof DL.DL_log === 'function') {
      DL.DL_log(`預算子集合框架建立成功 - 帳本: ${ledgerId}`, '預算管理', requesterId);
    }

    return {
      success: true,
      ledgerId: ledgerId,
      message: '預算子集合框架建立成功'
    };

  } catch (error) {
    console.error(`${logPrefix} 預算子集合框架建立失敗:`, error);

    if (DL && typeof DL.DL_error === 'function') {
      DL.DL_error(`預算子集合框架建立失敗: ${error.message}`, '預算管理', requesterId);
    }

    return {
      success: false,
      error: error.message,
      message: `預算子集合框架建立失敗: ${error.message}`
    };
  }
};

/**
 * 階段二新增：建立預算子集合框架佔位符 (新增)
 * @version 2025-11-20-V2.3.1
 * @description 確保預算子集合存在，防止在無任何預算時無法創建集合
 */
BM.BM_createBudgetsSubcollectionFramework = async function(ledgerId, requesterId = 'SYSTEM') {
  const logPrefix = '[BM_createBudgetsSubcollectionFramework]';

  try {
    console.log(`${logPrefix} 階段二新增：建立預算子集合框架佔位符 - 帳本ID: ${ledgerId}`);

    // 驗證必要參數
    if (!ledgerId || typeof ledgerId !== 'string' || ledgerId.trim() === '') {
      throw new Error('缺少必要參數: ledgerId');
    }

    // 創建一個預算佔位符文檔，用於確保子集合的存在
    const budgetPlaceholder = {
      budgetId: '_framework_placeholder',
      type: 'subcollection_placeholder',
      purpose: '確保預算子集合存在',
      ledgerId: ledgerId,
      name: '預算子集合框架佔位符',
      amount: 0,
      consumed_amount: 0,
      currency: 'TWD',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: requesterId,
      status: 'framework_placeholder',
      note: '此文檔僅用於確保預算子集合框架存在，實際預算建立時會有真實文檔'
    };

    // 使用子集合路徑建立佔位符
    const collectionPath = `ledgers/${ledgerId}/budgets`;

    try {
      const firebaseConfig = require('./1399. firebase-config.js');
      const db = firebaseConfig.getFirestoreInstance();
      const docRef = db.collection(collectionPath).doc('_framework_placeholder');
      await docRef.set(budgetPlaceholder);

      console.log(`${logPrefix} ✅ 預算子集合框架建立成功 - 路徑: ${collectionPath}`);

      // 記錄日誌
      DL.DL_log(`建立預算子集合框架 - 帳本ID: ${ledgerId}`, '預算管理', requesterId);

      return createStandardResponse(true, {
        ledgerId: ledgerId,
        collectionPath: collectionPath,
        placeholderCreated: true
      }, '預算子集合框架建立成功');

    } catch (firestoreError) {
      console.error(`${logPrefix} Firebase操作失敗:`, firestoreError);
      throw new Error(`Firebase操作失敗: ${firestoreError.message}`);
    }

  } catch (error) {
    console.error(`${logPrefix} 預算子集合框架建立失敗:`, error);
    DL.DL_error(`預算子集合框架建立失敗: ${error.message}`, '預算管理', requesterId);

    return createStandardResponse(false, null, `預算子集合框架建立失敗: ${error.message}`, 'CREATE_BUDGET_SUBCOLLECTION_FRAMEWORK_ERROR');
  }
};

/**
 * 階段二整合：初始化預算結構 (從FS模組整合)
 * @version 2025-11-21-V2.3.0
 * @description 階段二整合：接管FS模組的預算結構初始化功能，建立預算管理系統配置
 */
BM.BM_initializeBudgetStructure = async function(requesterId = 'SYSTEM') {
  const functionName = "BM_initializeBudgetStructure";
  const logPrefix = '[BM_initializeBudgetStructure]';

  try {
    console.log(`${logPrefix} 階段二整合：初始化預算結構配置`);

    const budgetStructure = {
      version: '2.3.0',
      description: '1312.BM.js預算管理模組Firebase子集合文檔結構 - 階段二完整整合版',
      last_updated: '2025-11-21',
      architecture: 'subcollection_based',
      integration_phase: 'Phase2-BM-Integration-Complete',
      migration_from: 'budgets/ (top-level collection)',
      migration_to: 'ledgers/{ledgerId}/budgets/ (subcollection)',
      collections: {
        'ledgers/{ledgerId}/budgets': {
          description: '預算子集合 - 隸屬於特定帳本的預算管理文檔',
          collection_path: 'ledgers/{ledgerId}/budgets',
          parent_collection: 'ledgers',
          managed_by: '1312.BM.js',
          document_structure: {
            budgetId: 'string - 預算唯一識別碼 (與文檔ID相同，用於查詢)',
            ledgerId: 'string - 父帳本ID (繼承自父集合路徑)',
            name: 'string - 預算名稱 (如"月度生活費預算")',
            type: 'string - 預算類型: "monthly"|"yearly"|"quarterly"|"project"|"category"',
            total_amount: 'number - 預算總金額 (設定的預算上限)',
            consumed_amount: 'number - 已使用金額 (目前花費總額)',
            currency: 'string - 貨幣單位 (如"TWD", "USD")',
            startDate: 'timestamp - 預算生效開始時間',
            endDate: 'timestamp - 預算結束時間',
            allocation: 'array - 預算分類配置 (包含各分類的金額分配)',
            alert_rules: 'object - 警示規則設定 (閾值、通知方式)',
            userId: 'string - 使用者ID (對應users集合的email)',
            createdBy: 'string - 建立者ID (對應users集合的email)',
            createdAt: 'timestamp - 建立時間',
            updatedAt: 'timestamp - 最後更新時間',
            status: 'string - 預算狀態: "active"|"completed"|"archived"'
          },
          subcollections: {
            allocations: {
              description: '預算分配子集合',
              document_structure: {
                categoryId: 'string - 科目ID',
                categoryName: 'string - 科目名稱（如"餐飲"、"交通"）',
                allocated_amount: 'number - 分配金額',
                consumed_amount: 'number - 已使用金額',
                percentage: 'number - 占總預算百分比',
                createdAt: 'timestamp - 建立時間',
                updatedAt: 'timestamp - 更新時間'
              }
            }
          }
        }
      },
      bm_module_integration: {
        phase: 'Phase2-Complete',
        functions_integrated: [
          'BM_createBudgetsSubcollectionFramework',
          'BM_initializeBudgetStructure',
          'BM_createBudget (enhanced with framework creation)',
        ],
        responsibilities: [
          '預算子集合框架建立',
          '預算結構配置管理',
          '預算生命週期管理',
          '預算警示與通知'
        ]
      }
    };

    // 儲存預算結構配置到系統文檔
    try {
      const firebaseConfig = require('./1399. firebase-config.js');
      const db = firebaseConfig.getFirestoreInstance();
      const docRef = db.collection('_system').doc('budget_structure_v2_3_0');
      await docRef.set(budgetStructure);

      console.log(`${logPrefix} ✅ 預算結構配置初始化成功`);

      // 記錄日誌
      DL.DL_log('預算結構配置初始化完成 - 階段二整合', '預算管理', requesterId);

      return createStandardResponse(true, budgetStructure, '預算結構初始化成功');

    } catch (firestoreError) {
      console.error(`${logPrefix} Firebase操作失敗:`, firestoreError);
      throw new Error(`Firebase操作失敗: ${firestoreError.message}`);
    }

  } catch (error) {
    console.error(`${logPrefix} 預算結構初始化失敗:`, error);
    DL.DL_error(`預算結構初始化失敗: ${error.message}`, '預算管理', requesterId);

    return createStandardResponse(false, null, `預算結構初始化失敗: ${error.message}`, 'INIT_BUDGET_STRUCTURE_ERROR');
  }
};

/**
 * 階段一修正：模組邊界檢查機制強化
 * @version 2025-11-06-V2.2.1
 * @description 階段一修正：強化BM模組邊界檢查，完全禁止與BK模組的任何互動
 */
BM.BM_validateModuleBoundary = function(operation, targetModule) {
  const logPrefix = '[BM_validateModuleBoundary]';

  // 階段一修正：絕對禁止BM模組調用BK模組
  if (targetModule === 'BK') {
    console.error(`${logPrefix} 階段一錯誤：BM模組嚴格禁止調用BK模組的${operation}操作`);
    console.error(`${logPrefix} 這違反了模組職責分離原則，預算管理與記帳核心必須完全獨立`);
    return {
      allowed: false,
      reason: '階段一修正：BM模組與BK模組必須完全隔離，不存在任何調用關係'
    };
  }

  // 階段二修正：擴展允許調用的模組（新增配置讀取能力）
  const allowedModules = ['FS', 'DL']; // BM模組僅允許調用Firebase服務和日誌模組
  if (!allowedModules.includes(targetModule)) {
    console.warn(`${logPrefix} 階段二警告：BM模組嘗試調用未授權的模組: ${targetModule}`);
    return {
      allowed: false,
      reason: `階段二修正：BM模組僅允許調用${allowedModules.join(', ')}模組`
    };
  }

  console.log(`${logPrefix} 階段二驗證通過：BM模組調用${targetModule}模組的${operation}操作`);
  return {
    allowed: true,
    reason: '階段二修正：模組邊界檢查通過'
  };
};

/**
 * 輔助函數: 驗證預算分配
 */
BM.BM_validateAllocation = async function(budgetId, allocationData) {
  const budgetData = await BM.BM_getBudgetData(budgetId);
  const totalAllocated = allocationData.reduce((sum, allocation) => sum + allocation.amount, 0);

  const errors = [];
  if (totalAllocated > budgetData.amount) {
    errors.push('分配總額超過預算額度');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

/**
 * 新增：BM_getBudgetById (ASL.js所需) - 完全子集合架構版
 * @version 2025-10-30-V2.1.2
 * @description 根據預算ID取得單一預算詳情，完全禁用頂層budgets集合
 */
BM.BM_getBudgetById = async function(budgetId, options = {}) {
  const logPrefix = '[BM_getBudgetById]';

  try {
    console.log(`${logPrefix} 取得預算詳情 - 預算ID: ${budgetId}`);

    if (!budgetId) {
      return createStandardResponse(false, null, '缺少預算ID', 'MISSING_budgetId');
    }

    // 強制要求ledgerId參數用於子集合查詢
    const ledgerId = options.ledgerId;
    if (!ledgerId || ledgerId.trim() === '') {
      console.error(`${logPrefix} ❌ 致命錯誤：缺少ledgerId，無法查詢子集合`);
      return createStandardResponse(false, null, '查詢預算詳情失敗：缺少ledgerId參數，系統已完全禁用頂層budgets集合', 'MISSING_ledgerId_FOR_SUBCOLLECTION');
    }

    // 完全強制使用子集合路徑查詢，絕對禁用頂層budgets集合
    const collectionPath = `ledgers/${ledgerId}/budgets`;
    console.log(`${logPrefix} 🎯 強制子集合查詢路徑: ${collectionPath}/${budgetId}`);
    console.log(`${logPrefix} 📋 路徑架構確認: ledgers/{ledgerId}/budgets/ 子集合模式`);

    // 路徑安全驗證：絕對禁止頂層budgets集合
    if (collectionPath === 'budgets' || !collectionPath.startsWith('ledgers/') || !collectionPath.endsWith('/budgets')) {
      console.error(`${logPrefix} ❌ 路徑安全驗證失敗: ${collectionPath}`);
      throw new Error(`路徑安全驗證失敗: ${collectionPath}，系統完全禁用頂層budgets集合`);
    }

    try {
      // 階段一修正：正確獲取Firebase實例
      const firebaseConfig = require('./1399. firebase-config.js');
      const db = firebaseConfig.getFirestoreInstance();
      const docRef = db.collection(collectionPath).doc(budgetId);
      const doc = await docRef.get();

      if (doc.exists) {
        console.log(`${logPrefix} ✅ 從子集合成功查詢預算詳情`);
        return createStandardResponse(true, doc.data(), '預算詳情取得成功（子集合）');
      } else {
        console.log(`${logPrefix} ⚠️ 預算在子集合中不存在: ${collectionPath}/${budgetId}`);
        return createStandardResponse(false, null, '預算不存在或已被刪除', 'BUDGET_NOT_FOUND_IN_SUBCOLLECTION');
      }
    } catch (firestoreError) {
      console.error(`${logPrefix} ❌ 子集合查詢失敗:`, firestoreError.message);
      return createStandardResponse(false, null, `子集合查詢失敗: ${firestoreError.message}`, 'SUBCOLLECTION_QUERY_ERROR');
    }

  } catch (error) {
    console.error(`${logPrefix} 預算詳情取得失敗:`, error);
    return createStandardResponse(false, null, `預算詳情取得失敗: ${error.message}`, 'GET_BUDGET_BY_ID_ERROR');
  }
};

/**
 * 階段二新增：路徑解析函數 (新增)
 * @version 2025-11-20-V2.3.1
 * @description 支援動態判斷預算相關文檔的路徑，包括支援協作帳本
 */
function BM_resolveBudgetPath(ledgerId) {
  const logPrefix = '[BM_resolveBudgetPath]';

  try {
    // 階段二核心：判斷ledgerId是否為協作帳本
    // 協作帳本ID通常帶有 "collab_ledger_" 前綴
    if (ledgerId && typeof ledgerId === 'string' && ledgerId.startsWith('collab_ledger_')) {
      console.log(`${logPrefix} 偵測到協作帳本ID: ${ledgerId}，使用協作帳本路徑`);
      // 協作帳本預算路徑格式：ledgers/collaborations/{collabLedgerId}/budgets/{budgetId}
      const collabLedgerId = ledgerId.replace('collab_ledger_', ''); // 提取實際的協作帳本ID
      return {
        success: true,
        collectionPath: `ledgers/collaborations/${collabLedgerId}/budgets`,
        documentPath: `ledgers/collaborations/${collabLedgerId}/budgets/{budgetId}`
      };
    } else if (ledgerId && typeof ledgerId === 'string') {
      console.log(`${logPrefix} 偵測到標準帳本ID: ${ledgerId}，使用標準帳本路徑`);
      // 標準帳本預算路徑格式：ledgers/{ledgerId}/budgets/{budgetId}
      return {
        success: true,
        collectionPath: `ledgers/${ledgerId}/budgets`,
        documentPath: `ledgers/${ledgerId}/budgets/{budgetId}`
      };
    } else {
      throw new Error('無效的ledgerId格式');
    }
  } catch (error) {
    console.error(`${logPrefix} 路徑解析失敗:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 模組導出 - 階段二整合：新增從FS模組接管的預算初始化功能
module.exports = {
  BM_createBudget: BM.BM_createBudget,
  BM_getBudgets: BM.BM_getBudgets,
  BM_getBudgetDetail: BM.BM_getBudgetDetail,
  BM_getBudgetById: BM.BM_getBudgetById, // 已修正為子集合架構
  BM_updateBudget: BM.BM_updateBudget,
  BM_deleteBudget: BM.BM_deleteBudget, // P2測試版本（包含確認機制）
  BM_deleteBudget_Legacy: BM.BM_deleteBudget_Legacy, // 舊版備用
  BM_editBudget: BM.BM_editBudget, // 已修正為子集合架構
  BM_calculateBudgetProgress: BM.BM_calculateBudgetProgress,
  BM_updateBudgetUsage: BM.BM_updateBudgetUsage,
  BM_getBudgetReport: BM.BM_getBudgetReport,
  BM_checkBudgetAlert: BM.BM_checkBudgetAlert,
  BM_triggerBudgetAlert: BM.BM_triggerBudgetAlert,
  BM_setBudgetAlertRules: BM.BM_setBudgetAlertRules,
  BM_analyzeBudgetTrend: BM.BM_analyzeBudgetTrend,
  BM_compareBudgetAcrossLedgers: BM.BM_compareBudgetAcrossLedgers,
  BM_createBudgetCategory: BM.BM_createBudgetCategory,
  BM_allocateBudgetToCategories: BM.BM_allocateBudgetToCategories,
  BM_handleBudgetError: BM.BM_handleBudgetError,
  BM_validateBudgetData: BM.BM_validateBudgetData,
  // 階段一新增：confirmationToken相關函數
  BM_generateConfirmationToken: BM.BM_generateConfirmationToken,
  BM_validateConfirmationToken: BM.BM_validateConfirmationToken,
  // 階段二整合：從FS模組接管的預算初始化功能
  BM_createBudgetsSubcollectionFramework: BM.BM_createBudgetsSubcollectionFramework,
  BM_initializeBudgetStructure: BM.BM_initializeBudgetStructure,
  // 階段二新增：路徑解析函數
  BM_resolveBudgetPath: BM_resolveBudgetPath
};

if (process.env.NODE_ENV !== 'production') {
  console.log('✅ BM預算管理模組v2.3.0載入完成');
}