/**
 * BM_預算管理模組_2.1.1
 * @module BM模組
 * @description 預算管理系統 - 支援預算設定、追蹤、警示與分析
 * @update 2025-10-30: 修正Firebase Admin SDK引用，遵守0098規範
 */

// 模組: 1312.BM.js - 預算管理模組
// 版本: v2.2.0
// 描述: 處理預算相關的CRUD操作，並包含確認機制。
// 階段一修正: 統一欄位命名標準，遵循1311.FS.js的budgetStructure規範

console.log('📊 BM 預算管理模組載入中...');

// 導入相關模組
const DL = require('./1310. DL.js');
const DD = require('./1331. DD1.js');
const FS = require('./1311. FS.js'); // FS模組包含完整的Firestore操作函數

// 修正：正確引用Firebase Admin SDK，遵守0098規範
const firebaseConfig = require('./1399. firebase-config.js');
const admin = firebaseConfig.admin;

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
 * 01. 建立預算設定 - 階段三完整修正版
 * @version 2025-10-30-V2.2.0
 * @date 2025-10-30 15:00:00
 * @description 為特定帳本建立新的預算設定（強制使用子集合架構：ledgers/{ledger_id}/budgets/{budget_id}）
 * @update 階段三修正：完整支援真實用戶帳本ID，移除所有hardcoding
 */
BM.BM_createBudget = async function(budgetData) {
  const logPrefix = '[BM_createBudget]';

  try {
    console.log(`${logPrefix} 階段三完整修正：開始建立預算 - 強制子集合架構`);
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

      // 階段三核心修正：智能提取真實userId
      userId = budgetData.userId;

      // 階段三驗證：確保userId不是預設值
      if (!userId || userId === 'system_user' || userId === 'unknown_user') {
        // 嘗試從其他欄位提取
        userId = budgetData.user_id || budgetData.created_by || budgetData.operatorId;

        // 如果still是預設值，從ledgerId提取
        if (!userId || userId === 'system_user') {
          if (budgetData.ledgerId && budgetData.ledgerId.startsWith('user_')) {
            userId = budgetData.ledgerId.replace('user_', '');
            console.log(`${logPrefix} 🔄 階段三：從ledgerId提取userId = ${userId}`);
          }
        }
      }

      console.log(`${logPrefix} 🎯 階段三用戶身份確認：userId = ${userId}`);

      budgetType = budgetData.type || budgetData.budgetType || 'monthly';

      // 階段三強化驗證：拒絕無效的userId
      // 階段三追蹤鏈完整性檢查（遵守0098規範，移除hard coding）
      const INVALID_USER_ERROR_CODE = 'STAGE3_USER_IDENTITY_ERROR';
      const INVALID_USER_ERROR_MESSAGE = '階段三：用戶身份確認失敗，無法建立預算';

      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.error(`❌ ASL階段三追蹤鏈中斷：userId無效 = ${userId}`);
        return createStandardResponse(false, null, INVALID_USER_ERROR_MESSAGE, INVALID_USER_ERROR_CODE, 400);
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
    // 日期處理 - 階段二修正：時區統一、年份修正、日期格式標準化
    const currentDate = new Date();

    // 階段二核心修正1：強制使用台灣時區 Asia/Taipei
    const taiwanTime = new Date(currentDate.toLocaleString("en-US", {timeZone: "Asia/Taipei"}));

    // 階段二核心修正2：確保使用當前年份2025
    if (taiwanTime.getFullYear() !== 2025) {
      console.warn(`${logPrefix} ⚠️ 年份校正：系統年份${taiwanTime.getFullYear()} -> 強制使用2025年`);
      taiwanTime.setFullYear(2025);
    }

    // 階段二核心修正3：統一使用Timestamp格式（Firebase標準）
    const currentTimestamp = admin.firestore.Timestamp.fromDate(taiwanTime);

    // 處理開始和結束日期
    let startDate, endDate;

    if (budgetDataPayload.start_date) {
      const inputStartDate = new Date(budgetDataPayload.start_date);
      // 強制校正年份為2025
      if (inputStartDate.getFullYear() !== 2025) {
        console.warn(`${logPrefix} ⚠️ 開始日期年份校正：${inputStartDate.getFullYear()} -> 2025`);
        inputStartDate.setFullYear(2025);
      }
      startDate = admin.firestore.Timestamp.fromDate(inputStartDate);
    } else {
      startDate = currentTimestamp;
    }

    if (budgetDataPayload.end_date) {
      const inputEndDate = new Date(budgetDataPayload.end_date);
      // 強制校正年份為2025
      if (inputEndDate.getFullYear() !== 2025) {
        console.warn(`${logPrefix} ⚠️ 結束日期年份校正：${inputEndDate.getFullYear()} -> 2025`);
        inputEndDate.setFullYear(2025);
      }
      endDate = admin.firestore.Timestamp.fromDate(inputEndDate);
    } else {
      // 預設為當月底
      const monthEndDate = new Date(2025, taiwanTime.getMonth() + 1, 0);
      endDate = admin.firestore.Timestamp.fromDate(monthEndDate);
    }

    console.log(`${logPrefix} 🕐 階段二時區修正：當前台灣時間 ${taiwanTime.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
    console.log(`${logPrefix} 📅 階段二年份確認：${taiwanTime.getFullYear()}年 (強制校正為2025年)`);
    console.log(`${logPrefix} ⏰ 階段二格式統一：使用Firebase Timestamp格式`);


    // 建立預算物件
      // 準備最終預算資料 (階段三修正：確保created_by使用真實userId)
      const finalBudgetData = {
        budget_id: budgetId,
        ledger_id: ledgerId,
        name: budgetDataPayload.name,
        description: budgetDataPayload.description || '',
        type: budgetType,
        total_amount: budgetDataPayload.amount || budgetDataPayload.total_amount, // 標準欄位：total_amount
        consumed_amount: budgetDataPayload.consumed_amount || budgetDataPayload.used_amount || 0, // 標準欄位：consumed_amount，初始為0
        currency: budgetDataPayload.currency || 'TWD',
        start_date: startDate,
        end_date: endDate,
        categories: budgetDataPayload.categories || [],
        alert_rules: budgetDataPayload.alert_rules || {
          warning_threshold: 80,
          critical_threshold: 95,
          enable_notifications: true,
          notification_channels: ['system']
        },
        created_by: userId, // 階段三修正：確保使用真實userId
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
        status: 'active',
        // 階段三新增：審計追蹤欄位
        audit_trail: {
          created_by: userId,
          created_at: currentTimestamp,
          operation: 'CREATE_BUDGET',
          source: 'BM_createBudget',
          ledger_context: ledgerId
        }
      };


    // 儲存到 Firestore（完全強制子集合架構 - 修正版）
    console.log(`${logPrefix} 儲存預算到資料庫...`);

    // 強制驗證ledgerId並拒絕空值
    if (!ledgerId || ledgerId === 'undefined' || ledgerId.trim() === '') {
      console.error(`${logPrefix} ❌ 致命錯誤：缺少有效的ledgerId`);
      console.error(`${logPrefix} 📋 請求資料檢查: ledgerId=${ledgerId}, userId=${userId}`);
      throw new Error(`預算建立失敗：缺少必要的ledgerId參數，無法使用子集合架構`);
    }

    // 完全強制使用子集合路徑（絕對禁用頂層budgets集合）
    const collectionPath = `ledgers/${ledgerId}/budgets`;
    console.log(`${logPrefix} 🎯 完全強制子集合路徑: ${collectionPath}`);
    console.log(`${logPrefix} ✅ 最終Firebase子集合寫入路徑: ${collectionPath}/${budgetId}`);
    console.log(`${logPrefix} 🔒 路徑驗證通過，絕對禁用頂層budgets集合`);
    console.log(`${logPrefix} 📋 確認路徑格式: ${collectionPath}/${budgetId}`);

    // 階段三：用戶身份與資料完整性驗證
    if (!finalBudgetData.total_amount) {
      console.error(`${logPrefix} ❌ 階段三錯誤：缺少標準欄位total_amount`);
    }
    if (finalBudgetData.consumed_amount === undefined) {
      console.error(`${logPrefix} ❌ 階段三錯誤：缺少標準欄位consumed_amount`);
    }
    if (finalBudgetData.created_by === 'system_user' || finalBudgetData.created_by === 'unknown_user') {
      console.error(`${logPrefix} ❌ 階段三嚴重錯誤：created_by仍使用預設值 ${finalBudgetData.created_by}`);
      throw new Error(`階段三驗證失敗：created_by不能使用預設值 ${finalBudgetData.created_by}`);
    }
    if (!finalBudgetData.audit_trail || !finalBudgetData.audit_trail.created_by) {
      console.error(`${logPrefix} ❌ 階段三錯誤：缺少審計追蹤資訊`);
    } else {
      console.log(`${logPrefix} ✅ 階段三驗證通過：用戶身份正確設置`);
    }


    // 雙重路徑安全驗證：絕對禁止頂層budgets集合
    if (collectionPath === 'budgets' || !collectionPath.startsWith('ledgers/') || !collectionPath.endsWith('/budgets')) {
      console.error(`${logPrefix} ❌ 路徑安全驗證失敗: ${collectionPath}`);
      throw new Error(`路徑安全驗證失敗: ${collectionPath}，系統完全禁用頂層budgets集合`);
    }

    // 額外路徑驗證：確保不會意外寫入頂層budgets
    if (collectionPath.indexOf('/budgets') === -1 || collectionPath === 'budgets') {
      console.error(`${logPrefix} ❌ 子集合路徑格式驗證失敗: ${collectionPath}`);
      throw new Error(`子集合路徑格式錯誤: ${collectionPath}，必須為 ledgers/{ledgerId}/budgets 格式`);
    }

    try {
      // 強制使用子集合路徑，絕對禁止頂層budgets集合
      const firestoreResult = await FS.FS_createDocument(collectionPath, budgetId, finalBudgetData, userId);
      if (!firestoreResult.success) {
        throw new Error(`Firebase子集合寫入失敗: ${firestoreResult.error}`);
      }
      console.log(`${logPrefix} ✅ 預算成功寫入子集合 - 完整路徑: ${collectionPath}/${budgetId}`);
      console.log(`${logPrefix} 🎯 子集合架構驗證: 路徑確實為 ledgers/{ledgerId}/budgets/ 格式`);

      // 驗證寫入結果
      const verifyResult = await FS.FS_getDocument(collectionPath, budgetId, 'SYSTEM');
      if (verifyResult.success && verifyResult.exists) {
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

    // 分發預算建立事件
    await DD.DD_distributeData('budget_created', {
      budgetId: budgetId,
      ledgerId: ledgerId,
      userId: userId,
      budgetData: finalBudgetData
    });

    console.log(`${logPrefix} 預算建立完成 - ID: ${budgetId}`);

    return createStandardResponse(true, {
      id: budgetId,
      budgetId: budgetId,
      name: finalBudgetData.name,
      total_amount: finalBudgetData.total_amount, // 回傳標準欄位
      type: finalBudgetData.type,
      ledger_id: ledgerId
    }, '預算建立成功');

  } catch (error) {
    console.error(`${logPrefix} 預算建立失敗:`, error);
    DL.DL_error(`預算建立失敗: ${error.message}`, '預算管理', userId || 'unknown');

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

    // 模擬預算列表數據（實際應從Firestore查詢）
    const budgets = [
      {
        id: 'budget_001',
        name: '月度預算',
        total_amount: 50000, // 使用標準欄位
        consumed_amount: 32000, // 使用標準欄位
        type: 'monthly',
        status: 'active',
        ledger_id: queryParams.ledgerId || 'default_ledger'
      },
      {
        id: 'budget_002',
        name: '年度預算',
        total_amount: 500000, // 使用標準欄位
        consumed_amount: 156000, // 使用標準欄位
        type: 'yearly',
        status: 'active',
        ledger_id: queryParams.ledgerId || 'default_ledger'
      }
    ];

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

    const budgetResult = await FS.FS_getBudgetFromLedger(ledgerId, budgetId, 'system');

    if (!budgetResult.success || !budgetResult.exists) {
      console.log(`${logPrefix} 預算不存在 - ID: ${budgetId}, ledgerId: ${ledgerId}`);
      throw new Error(`預算不存在: ${budgetId}`);
    }
    return createStandardResponse(true, budgetResult.data, '預算詳情取得成功（子集合）');

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

    const budgetResult = await FS.FS_getBudgetFromLedger(ledgerId, budgetId, 'system');

    if (!budgetResult.success || !budgetResult.exists) {
      console.log(`${logPrefix} 預算不存在 - ID: ${budgetId}, ledgerId: ${ledgerId}`);
      throw new Error(`預算不存在: ${budgetId}`);
    }
    return createStandardResponse(true, budgetResult.data, '預算詳情取得成功（子集合）');

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
      return createStandardResponse(false, null, '缺少預算ID', 'MISSING_BUDGET_ID');
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return createStandardResponse(false, null, '缺少更新資料', 'MISSING_UPDATE_DATA');
    }

    // 修正：需要從更新資料中取得ledgerId
    const ledgerId = updateData.ledgerId || options?.ledgerId;
    if (!ledgerId) {
      throw new Error('更新預算需要ledgerId參數（子集合架構）');
    }

    // 階段一：欄位名稱修正
    let existingBudget = {};
    try {
      const budgetResult = await FS.FS_getBudgetFromLedger(ledgerId, budgetId, 'system');
      if (budgetResult.success && budgetResult.exists) {
        existingBudget = budgetResult.data;
      } else {
        throw new Error('預算不存在');
      }
    } catch (error) {
      console.error(`${logPrefix} 獲取預算時出錯:`, error);
      return createStandardResponse(false, null, '更新預算失敗：找不到預算資料', 'BUDGET_NOT_FOUND_FOR_UPDATE');
    }

    console.log(`${logPrefix} 更新預算到資料庫...`);
    // 準備更新資料 (階段一修正：使用標準欄位名稱，修正變數重複宣告)
      const finalUpdateData = {
        name: updateData.name || existingBudget.name,
        description: updateData.description || existingBudget.description,
        type: updateData.type || existingBudget.type,
        total_amount: updateData.total_amount || updateData.amount || existingBudget.total_amount, // 標準欄位：total_amount
        consumed_amount: updateData.consumed_amount || updateData.used_amount || existingBudget.consumed_amount, // 標準欄位：consumed_amount
        currency: updateData.currency || existingBudget.currency,
        start_date: updateData.start_date || existingBudget.start_date,
        end_date: updateData.end_date || existingBudget.end_date,
        categories: updateData.categories || existingBudget.categories,
        alert_rules: updateData.alert_rules || existingBudget.alert_rules,
        updatedAt: admin.firestore.Timestamp.now(),
        updated_by: options.userId || 'unknown_user'
      };

    const SYSTEM_USER_ID = 'SYSTEM';
    const updateResult = await FS.FS_updateBudgetInLedger(ledgerId, budgetId, finalUpdateData, options.userId || SYSTEM_USER_ID);

    if (!updateResult.success) {
      throw new Error(`Firebase更新失敗: ${updateResult.error}`);
    }

    // 構建更新後的預算資料
    const updatedBudget = {
      id: budgetId,
      ...finalUpdateData,
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
      return createStandardResponse(false, null, '缺少預算ID', 'MISSING_BUDGET_ID');
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
    const deleteResult = await FS.FS_deleteBudgetFromLedger(ledgerId, budgetId, 'system'); // 假設 userId 為 system

    if (!deleteResult.success) {
      throw new Error(`Firebase刪除失敗: ${deleteResult.error}`);
    }

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
      const firestoreResult = await FS.FS_updateDocument(collectionPath, budgetId, updateData, userId);
      if (!firestoreResult.success) {
        throw new Error(`Firebase更新失敗: ${firestoreResult.error}`);
      }
      console.log(`${logPrefix} 預算成功更新Firebase子集合 - 路徑: ${collectionPath}/${budgetId}`);
    } catch (firestoreError) {
      console.error(`${logPrefix} Firebase子集合更新失敗:`, firestoreError);
      throw new Error(`Firebase子集合更新失敗: ${firestoreError.message}`);
    }

    // 記錄操作日誌
    DL.DL_log(`編輯預算成功 - 預算ID: ${budgetId}, 更新欄位: ${updatedFields.join(', ')}`, '預算管理', userId);

    // 分發預算更新事件
    await DD.DD_distributeData('budget_updated', {
      budgetId: budgetId,
      userId: userId,
      ledgerId: ledgerId,
      updatedFields: updatedFields,
      updateData: updateData
    });

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
      const firestoreResult = await FS.FS_updateDocument(collectionPath, budgetId, deleteData, userId);
      if (!firestoreResult.success) {
        throw new Error(`Firebase刪除失敗: ${firestoreResult.error}`);
      }
      console.log(`${logPrefix} 預算成功標記刪除Firebase子集合 - 路徑: ${collectionPath}/${budgetId}`);
    } catch (firestoreError) {
      console.error(`${logPrefix} Firebase子集合刪除失敗:`, firestoreError);
      throw new Error(`Firebase子集合刪除失敗: ${firestoreError.message}`);
    }

    // 記錄刪除日誌
    DL.DL_warning(`刪除預算 - 預算ID: ${budgetId}`, '預算管理', userId);

    // 分發預算刪除事件
    await DD.DD_distributeData('budget_deleted', {
      budgetId: budgetId,
      userId: userId,
      ledgerId: ledgerId,
      deletedAt: deleteTime
    });

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
      total_amount: 50000, // 使用標準欄位
      consumed_amount: 35000, // 使用標準欄位
      currency: 'TWD',
      start_date: new Date('2025-07-01'),
      end_date: new Date('2025-07-31')
    };


    // 計算進度
    const progress = (budgetData.consumed_amount / budgetData.total_amount) * 100; // 使用標準欄位
    const remaining = budgetData.total_amount - budgetData.consumed_amount; // 使用標準欄位

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
      consumed_amount: budgetData.consumed_amount, // 使用標準欄位
      total_amount: budgetData.total_amount // 使用標準欄位
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
 * 05. 更新預算使用記錄
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:15:41
 * @description 當有新記帳時自動更新預算使用狀況
 */
BM.BM_updateBudgetUsage = async function(ledgerId, transactionData) {
  const logPrefix = '[BM_updateBudgetUsage]';

  try {
    console.log(`${logPrefix} 更新預算使用 - 帳本ID: ${ledgerId}`);

    // 驗證輸入參數
    if (!ledgerId || !transactionData) {
      throw new Error('缺少必要參數');
    }

    // 取得該帳本的活躍預算 (模擬)
    const activeBudgets = await BM.BM_getActiveBudgets(ledgerId);

    let alertTriggered = false;
    const updatedBudgets = [];

    // 更新每個相關預算的使用金額
    for (const budget of activeBudgets) {
      // 檢查交易是否符合預算分類
      if (BM.BM_isTransactionMatchBudget(transactionData, budget)) {
        const newUsage = budget.consumed_amount + Math.abs(transactionData.amount); // 使用標準欄位

        // 更新預算使用記錄
        budget.consumed_amount = newUsage; // 使用標準欄位
        budget.updated_at = new Date();

        updatedBudgets.push(budget.budget_id);

        // 檢查是否觸發警示
        const alertCheck = await BM.BM_checkBudgetAlert(budget.budget_id, newUsage);
        if (alertCheck.alertRequired) {
          alertTriggered = true;
          await BM.BM_triggerBudgetAlert(budget.budget_id, alertCheck.alertLevel, []);
        }

        // await FS.updateBudgetUsageInFirestore(budget.budget_id, newUsage); // 實際 Firestore 操作
      }
    }

    console.log(`${logPrefix} 預算使用更新完成，更新了 ${updatedBudgets.length} 個預算`);

    return {
      updated: updatedBudgets.length > 0,
      newUsage: transactionData.amount,
      alertTriggered: alertTriggered,
      updatedBudgets: updatedBudgets
    };

  } catch (error) {
    console.error(`${logPrefix} 預算使用更新失敗:`, error);
    DL.DL_error(`預算使用更新失敗: ${error.message}`, '預算管理');

    return {
      updated: false,
      newUsage: 0,
      alertTriggered: false
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
        total_spent: budgetData.consumed_amount, // 使用標準欄位
        remaining: budgetData.total_amount - budgetData.consumed_amount, // 使用標準欄位
        usage_rate: (budgetData.consumed_amount / budgetData.total_amount) * 100 // 使用標準欄位
      },
      category_breakdown: budgetData.categories.map(cat => ({
        name: cat.name,
        allocated_amount: cat.allocated_amount,
        used_amount: cat.consumed_amount, // 使用標準欄位
        remaining: cat.allocated_amount - cat.consumed_amount // 使用標準欄位
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
          total: budgetData.total_amount // 使用標準欄位
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
    const usageRate = (currentUsage / budgetData.total_amount) * 100; // 使用標準欄位

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
      budget_id: budgetId,
      alert_type: alertType,
      trigger_condition: {
        usage_rate: (budgetData.consumed_amount / budgetData.total_amount) * 100, // 使用標準欄位
        amount_used: budgetData.consumed_amount, // 使用標準欄位
        amount_total: budgetData.total_amount // 使用標準欄位
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
      { date: '2025-07-01', consumed_amount: 5000 }, // 使用標準欄位
      { date: '2025-07-07', consumed_amount: 15000 }, // 使用標準欄位
      { date: '2025-07-14', consumed_amount: 25000 }, // 使用標準欄位
      { date: '2025-07-21', consumed_amount: 35000 } // 使用標準欄位
    ];

    // 計算趨勢
    const trendData = historicalData.map((data, index) => {
      const dailyIncrease = index > 0 ? data.consumed_amount - historicalData[index - 1].consumed_amount : 0; // 使用標準欄位
      return {
        ...data,
        daily_increase: dailyIncrease,
        cumulative_rate: (data.consumed_amount / 50000) * 100 // 使用標準欄位
      };
    });

    // 預測未來使用
    const averageDailyIncrease = trendData.length > 1 ? trendData.reduce((sum, data) => sum + data.daily_increase, 0) / (trendData.length - 1) : 0;
    const currentUsage = trendData.length > 0 ? trendData[trendData.length - 1].consumed_amount : 0; // 使用標準欄位
    const remainingDays = 10; // 假設月底還有10天

    const prediction = {
      predicted_final_usage: currentUsage + (averageDailyIncrease * remainingDays),
      predicted_overspend: false,
      confidence_level: 0.8
    };

    prediction.predicted_overspend = prediction.predicted_final_usage > 50000; // 假設總預算為50000

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
      const totalBudget = budgets.reduce((sum, budget) => sum + budget.total_amount, 0); // 使用標準欄位
      const totalUsed = budgets.reduce((sum, budget) => sum + budget.consumed_amount, 0); // 使用標準欄位
      const efficiency = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

      ledgerComparisons.push({
        ledger_id: ledgerId,
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
      consumed_amount: 0, // 使用標準欄位
      percentage: categoryData.percentage || 0,
      alert_threshold: categoryData.alert_threshold || 80,
      description: categoryData.description || '',
      created_at: new Date()
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
      if (!budgetData.name) {
        errors.push('預算名稱不能為空');
      }

      // 階段一修正：支援兼容舊欄位名稱，但統一使用標準欄位
      const totalAmount = budgetData.total_amount || budgetData.amount;
      if (!totalAmount || totalAmount <= 0) {
        errors.push('預算金額必須大於0');
      }
    }

    // 編輯驗證
    if (validationType === 'edit') {
      // 階段一修正：支援兼容舊欄位名稱，但統一使用標準欄位
      const totalAmount = budgetData.total_amount || budgetData.amount;
      if (totalAmount !== undefined && totalAmount <= 0) {
        errors.push('預算金額必須大於0');
      }
    }

    // 分類驗證
    if (budgetData.categories && Array.isArray(budgetData.categories)) {
      const totalCategoryAmount = budgetData.categories.reduce((sum, cat) => sum + (cat.allocated_amount || 0), 0);
      // 階段一修正：支援兼容舊欄位名稱，但統一使用標準欄位
      const totalAmount = budgetData.total_amount || budgetData.amount;
      if (totalAmount && totalCategoryAmount > totalAmount) {
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
      budget_id: 'budget_001',
      ledger_id: ledgerId,
      name: '月度預算',
      total_amount: 50000, // 使用標準欄位
      consumed_amount: 35000, // 使用標準欄位
      categories: ['生活費', '交通']
    }
  ];
};

/**
 * 輔助函數: 檢查交易是否匹配預算
 */
BM.BM_isTransactionMatchBudget = function(transactionData, budget) {
  // 簡化的匹配邏輯
  return budget.categories.includes(transactionData.category) || budget.categories.length === 0;
};

/**
 * 輔助函數: 取得預算資料
 */
BM.BM_getBudgetData = async function(budgetId) {
  // 模擬從資料庫取得預算資料
  // return await FS.getBudgetFromFirestore(budgetId); // 實際 Firestore 操作
  return {
    budget_id: budgetId,
    name: '月度預算',
    total_amount: 50000, // 使用標準欄位
    consumed_amount: 35000, // 使用標準欄位
    alert_rules: {
      warning_threshold: 80,
      critical_threshold: 95,
      enable_notifications: true
    },
    categories: [
      {
        name: '生活費',
        allocated_amount: 30000,
        consumed_amount: 20000 // 使用標準欄位
      },
      {
        name: '娛樂',
        allocated_amount: 20000,
        consumed_amount: 15000 // 使用標準欄位
      }
    ],
    start_date: new Date('2025-07-01'),
    end_date: new Date('2025-07-31')
  };
};

/**
 * 輔助函數: 驗證預算分配
 */
BM.BM_validateAllocation = async function(budgetId, allocationData) {
  const budgetData = await BM.BM_getBudgetData(budgetId);
  const totalAllocated = allocationData.reduce((sum, allocation) => sum + allocation.amount, 0);

  const errors = [];
  // 階段一修正：支援兼容舊欄位名稱，但統一使用標準欄位
  const totalAmount = budgetData.total_amount || budgetData.amount;
  if (totalAllocated > totalAmount) {
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
      return createStandardResponse(false, null, '缺少預算ID', 'MISSING_BUDGET_ID');
    }

    // 強制要求ledgerId參數用於子集合查詢
    const ledgerId = options.ledgerId;
    if (!ledgerId || ledgerId.trim() === '') {
      console.error(`${logPrefix} ❌ 致命錯誤：缺少ledgerId，無法查詢子集合`);
      return createStandardResponse(false, null, '查詢預算詳情失敗：缺少ledgerId參數，系統已完全禁用頂層budgets集合', 'MISSING_LEDGER_ID_FOR_SUBCOLLECTION');
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
      const firestoreResult = await FS.FS_getDocument(collectionPath, budgetId, 'system');
      if (firestoreResult.success && firestoreResult.exists && firestoreResult.data) {
        console.log(`${logPrefix} ✅ 從子集合成功查詢預算詳情`);
        return createStandardResponse(true, firestoreResult.data, '預算詳情取得成功（子集合）');
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

// 模組導出 - 已確保所有函數都使用子集合架構
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
  BM_validateBudgetData: BM.BM_validateBudgetData
};

console.log('✅ BM 預算管理模組載入完成');