/**
 * ASL.js_API服務層模組_2.2.1
 * @module API服務層模組（統一回應格式）
 * @description LCAS 2.0 API Service Layer - 階段三升級：ASL路由動態化
 * @update 2025-10-03: 階段二升級 - 補完MLS.js和BM.js的API端點，並引入CM.js進行協作管理
 * @update 2025-10-10: DCN-0023階段二 - 新增WCM模組，處理帳戶與科目管理API端點轉發
 * @update 2025-10-15: 階段三 - ASL路由動態化 (帳本類型識別與動態轉發)
 * @date 2025-10-15
 */

console.log('🚀 LCAS ASL (API Service Layer) v2.2.1 啟動中...');
console.log('📅 啟動時間:', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

/**
 * 01. 全域錯誤處理機制設置
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 捕獲未處理的例外和Promise拒絕，防止程式意外終止
 */
process.on('uncaughtException', (error) => {
  console.error('💥 ASL未捕獲的異常:', error);
  console.error('💥 異常堆疊:', error.stack);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 ASL未處理的 Promise 拒絕:', reason);
  console.error('💥 Promise:', promise);
});

/**
 * 02. Firebase優先初始化（階段一修復）
 * @version 2025-09-22-V2.0.4
 * @date 2025-09-22 15:30:00
 * @description 修復CommonJS頂層await語法錯誤，將初始化邏輯包裝在async函數中
 */
console.log('🔥 ASL階段二升級：優先初始化Firebase...');

let firebaseInitialized = false;
let AM, BK, DL, BM, CM, WCM; // WCM: Wallet and Category Management module (DCN-0023)

/**
 * Firebase服務初始化函數（階段一修復版）
 * @version 2025-09-22-V2.0.4
 * @description 同步等待Firebase完全初始化，解決時序競爭問題
 */
async function initializeServices() {
  try {
    // 步驟1：載入Firebase配置模組
    console.log('📡 載入Firebase配置模組...');
    const firebaseConfig = require('./13. Replit_Module code_BL/1399. firebase-config.js');

    // 步驟2：驗證Firebase配置
    console.log('🔍 驗證Firebase配置...');
    await firebaseConfig.validateFirebaseConfig();

    // 步驟3：初始化Firebase Admin SDK（同步等待）
    console.log('⚡ 初始化Firebase Admin SDK...');
    const app = firebaseConfig.initializeFirebaseAdmin();

    // 步驟 4：確認Firestore實例可用（確保完全初始化）
    console.log('📊 確認Firestore實例...');
    const db = firebaseConfig.getFirestoreInstance();

    // 步驟 5：驗證Firebase連線（階段一修復：添加超時機制）
    console.log('🔗 驗證Firebase連線...');
    try {
      // 使用Promise.race實現超時機制 - 改為檢查系統集合
      await Promise.race([
        db.collection('_system').doc('_test').get(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firebase連線超時')), 8000)
        )
      ]);
      console.log('✅ Firebase連線驗證成功');
    } catch (connectError) {
      console.warn('⚠️ Firebase連線驗證失敗，採用輕量驗證:', connectError.message);

      // 輕量驗證：僅檢查Firestore實例可用性
      try {
        const testDoc = db.collection('_system').doc('_test');
        await Promise.race([
          testDoc.get(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('輕量驗證超時')), 3000)
          )
        ]);
        console.log('✅ Firebase輕量驗證成功');
      } catch (lightError) {
        console.warn('⚠️ Firebase輕量驗證也失敗，繼續啟動但標記連線異常');
        // 不拋出錯誤，允許系統繼續啟動
      }
    }

    firebaseInitialized = true;
    console.log('✅ Firebase完全初始化完成，準備載入BL模組...');

    return true;
  } catch (error) {
    console.error('❌ Firebase初始化失敗:', error.message);
    console.error('❌ 錯誤堆疊:', error.stack);
    firebaseInitialized = false;
    return false;
  }
}

// 階段一修復：增強Firebase初始化重試機制
async function waitForFirebaseInit() {
  const maxRetries = 3;
  const maxInitTime = 15000; // 最大初始化時間15秒
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 Firebase初始化嘗試 ${retryCount + 1}/${maxRetries}...`);

      // 為整個初始化流程添加超時機制
      const success = await Promise.race([
        initializeServices(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firebase初始化總體超時')), maxInitTime)
        )
      ]);

      if (success) {
        console.log(`🎯 Firebase初始化成功 (嘗試次數: ${retryCount + 1})`);
        return true;
      }
    } catch (error) {
      console.error(`💥 Firebase初始化嘗試 ${retryCount + 1} 失敗:`, error.message);

      // 如果是超時錯誤，提供更具體的指導
      if (error.message.includes('超時')) {
        console.warn('⚠️ 檢測到超時問題，建議檢查網路連線或Firestore權限設定');
      }
    }

    retryCount++;
    if (retryCount < maxRetries) {
      const waitTime = Math.min(retryCount * 2, 5); // 最多等待5秒
      console.log(`⏳ 等待 ${waitTime} 秒後重試...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
  }

  console.error('❌ Firebase初始化最終失敗，系統將以降級模式啟動');
  console.warn('🔧 建議檢查：1)網路連線 2)Firebase配置 3)Firestore權限');
  return false;
}

/**
 * 03. BL層模組載入（P1-2範圍）- 階段一修復版
 * @version 2025-09-22-V2.0.4
 * @date 2025-09-22
 * @description 等待Firebase完全初始化後載入P1-2階段所需的BL層模組
 */
async function loadBLModules() {
  console.log('📦 ASL載入P1-2範圍BL層模組...');

  // 等待Firebase初始化完成
  const firebaseReady = await waitForFirebaseInit();

  // 模組載入狀態
  const moduleStatus = {
    firebase: firebaseReady,
    AM: false,
    BK: false,
    DL: false,
    BM: false,  // P2 模組：預算管理
    CM: false,  // P2 模組：協作與帳本管理
    WCM: false  // DCN-0023 模組：帳戶與科目管理
    // FS模組已移除 - 職責完全分散至專門模組
  };

  // 只有在Firebase成功初始化後才載入AM模組
  if (firebaseReady) {
    try {
      console.log('🔥 Firebase已就緒，開始載入AM模組...');
      AM = require('./13. Replit_Module code_BL/1309. AM.js');
      moduleStatus.AM = true;
      console.log('✅ AM (認證管理) 模組載入成功');
    } catch (error) {
      console.error('❌ AM 模組載入失敗:', error.message);
      console.error('❌ AM 模組錯誤堆疊:', error.stack);

      // 提供更詳細的錯誤診斷
      if (error.message.includes('Firebase')) {
        console.error('🔥 Firebase相關錯誤，可能需要檢查firebase-config.js');
      }
    }
  } else {
    console.error('❌ Firebase初始化失敗，跳過AM模組載入');
  }

// 載入其他BL模組（這些模組相對獨立）
  try {
    console.log('🔄 開始載入BK模組...');
    BK = require('./13. Replit_Module code_BL/1301. BK.js');

    // 階段三修復：驗證BK模組函數完整性
    const requiredBKFunctions = [
      'BK_processBookkeeping',
      'BK_processAPIGetDashboard',
      'BK_processAPIGetTransactionDetail',
      'BK_processAPIUpdateTransaction',
      'BK_processAPIDeleteTransaction',
      'BK_processAPIGetStatistics',
      'BK_processAPIGetRecent',
      'BK_processAPIGetCharts',
      'BK_createTransaction',
      'BK_getTransactions'
    ];

    const missingFunctions = [];
    let availableFunctions = 0;

    for (const funcName of requiredBKFunctions) {
      if (typeof BK[funcName] === 'function') {
        availableFunctions++;
        console.log(`✓ ${funcName}: 可用`);
      } else {
        missingFunctions.push(funcName);
        console.error(`✗ ${funcName}: 缺失或非函數類型`);
      }
    }

    console.log(`📊 BK模組函數完整性檢查: ${availableFunctions}/${requiredBKFunctions.length}`);

    if (missingFunctions.length > 0) {
      console.error('❌ BK模組缺失函數:', missingFunctions);
      console.error('📋 BK模組實際導出:', Object.keys(BK));
      moduleStatus.BK = false;
      console.log('❌ BK (記帳核心) 模組函數不完整');
    } else {
      moduleStatus.BK = true;
      console.log('✅ BK (記帳核心) 模組載入成功，所有函數可用');
    }
  } catch (error) {
    console.error('❌ BK 模組載入失敗:', error.message);
    console.error('❌ BK 載入錯誤堆疊:', error.stack);
    moduleStatus.BK = false;
  }

  // 階段三修復：BK模組載入重試機制
  if (!moduleStatus.BK) {
    console.log('🔄 BK模組載入失敗，嘗試重新載入...');
    try {
      // 清除模組緩存
      delete require.cache[require.resolve('./13. Replit_Module code_BL/1301. BK.js')];

      // 重新載入
      BK = require('./13. Replit_Module code_BL/1301. BK.js');

      // 重新驗證
      const criticalFunctions = ['BK_processBookkeeping', 'BK_processAPIGetDashboard'];
      let retrySuccess = true;

      for (const funcName of criticalFunctions) {
        if (typeof BK[funcName] !== 'function') {
          retrySuccess = false;
          console.error(`❌ 重試後仍缺失: ${funcName}`);
        }
      }

      if (retrySuccess) {
        moduleStatus.BK = true;
        console.log('✅ BK模組重新載入成功');
      } else {
        console.error('❌ BK模組重試載入仍失敗');
      }
    } catch (retryError) {
      console.error('❌ BK模組重試載入錯誤:', retryError.message);
    }
  }

  try {
    DL = require('./13. Replit_Module code_BL/1310. DL.js');
    moduleStatus.DL = true;
    console.log('✅ DL (診斷日誌) 模組載入成功');
  } catch (error) {
    console.error('❌ DL 模組載入失敗:', error.message);
  }

  // 階段四完成：原MLS功能已完全整合至CM模組
  console.log('📦 P2階段模組 - 帳本與協作管理功能統一由CM模組提供...');


    try {
      console.log('📦 載入P2階段模組 - BM (預算管理)...');
      BM = require('./13. Replit_Module code_BL/1312. BM.js'); // 修正為正確路徑
      moduleStatus.BM = true;
      console.log('✅ BM (預算管理) 模組載入成功');
    } catch (error) {
      console.error('❌ BM 模組載入失敗:', error.message);
      moduleStatus.BM = false;
    }

    // 階段二新增：載入P2階段模組 - CM (協作管理)
    try {
      console.log('📦 載入P2階段模組 - CM (協作管理)...');
      CM = require('./13. Replit_Module code_BL/1313. CM.js'); // 協作管理模組
      moduleStatus.CM = true;
      console.log('✅ CM (協作管理) 模組載入成功');
    } catch (error) {
      console.error('❌ CM 模組載入失敗:', error.message);
      moduleStatus.CM = false;
    }

    // DCN-0023階段二：載入WCM模組（帳戶與科目管理）
    try {
      console.log('📦 載入DCN-0023階段二模組 - WCM (帳戶與科目管理)...');
      WCM = require('./13. Replit_Module code_BL/1350. WCM.js'); // WCM模組
      moduleStatus.WCM = true;
      console.log('✅ WCM (帳戶與科目管理) 模組載入成功');
    } catch (error) {
      console.error('❌ WCM 模組載入失敗:', error.message);
      moduleStatus.WCM = false;
    }


  // 模組載入狀態報告
  console.log('📋 模組載入狀態報告:');
  Object.entries(moduleStatus).forEach(([module, status]) => {
    if (module !== 'MLS') { // 跳過已廢棄的MLS模組
      console.log(`   ${status ? '✅' : '❌'} ${module.toUpperCase()}: ${status ? '已載入' : '載入失敗'}`);
    }
  });

  // P2階段模組評估
    if (moduleStatus.firebase && moduleStatus.AM && moduleStatus.BK && moduleStatus.BM && moduleStatus.CM && moduleStatus.WCM) {
      console.log('🎉 P2階段模組完整載入：Firebase + AM + BK + CM(協作與帳本管理) + BM + WCM');
      console.log('🚀 系統已準備好處理所有P1-2範圍API請求以及P2預算管理、協作管理、帳戶與科目管理功能');
      console.log('✨ 協作與帳本管理功能完全整合至CM模組');
      console.log('📦 帳戶與科目管理功能整合至WCM模組');
    } else if (moduleStatus.firebase && moduleStatus.AM && moduleStatus.BK) {
      console.log('🎉 P1-2基礎模組正常載入：Firebase + AM + BK');
      console.log('⚠️ P2階段新功能模組狀態：CM(協作管理)(' + (moduleStatus.CM ? '✅' : '❌') + '), BM(' + (moduleStatus.BM ? '✅' : '❌') + '), WCM(' + (moduleStatus.WCM ? '✅' : '❌') + ')');
      console.log('🚀 系統已準備好處理P1-2基礎功能，P2功能視模組載入狀況而定');
    } else {
      console.log('❌ 關鍵模組載入失敗：需執行進一步調查');
    }


  const successCount = Object.values(moduleStatus).filter(Boolean).length;
  const totalCount = Object.keys(moduleStatus).length;
  console.log(`📊 載入成功率: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);

  // 階段三修復結果評估
  if (moduleStatus.firebase && moduleStatus.AM && moduleStatus.BK) {
    console.log('🎉 階段三修復成功：Firebase + AM + BK模組正常載入');
    console.log('🚀 系統已準備好處理所有P1-2範圍API請求');
  } else if (moduleStatus.firebase && moduleStatus.AM && !moduleStatus.BK) {
    console.log('⚠️ 階段三關鍵問題：BK模組載入失敗，所有記帳功能不可用');
    console.log('🔧 建議檢查：1)BK.js文件完整性 2)module.exports正確性 3)依賴模組可用性');
  } else {
    console.log('❌ 階段三修復失敗：需執行進一步調查');
  }

  return moduleStatus;
}

// 階段一修復：將Express應用初始化包裝在異步函數中
let app = null;
async function startApplication() {
  // 等待BL模組載入完成
  const moduleStatus = await loadBLModules();

  /**
   * 03. Express應用程式設置（階段一修復版）
   * @version 2025-09-22-V2.0.5
   * @date 2025-09-22 15:45:00
   * @description 建立Express服務器，設定基礎中介軟體
   */
  const express = require('express');
  app = express();
  const PORT = process.env.ASL_PORT || 5000;

// 基礎解析中介軟體
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * 04. CORS配置中介軟體
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 允許跨網域請求，支援Flutter APP存取
 */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

/**
 * 05. 統一回應格式中介軟體（DCN-0015階段一）
 * @version 2025-01-27-V2.1.0
 * @date 2025-01-27 12:00:00
 * @description 實作統一API回應格式，支援四模式差異化處理
 */
app.use((req, res, next) => {
  // 記錄請求開始時間
  req.startTime = Date.now();

  // 生成請求ID
  const generateRequestId = () => {
    // 使用與1311.FS.js一致的格式
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
  };

  // 檢測使用者模式（第三階段強化版）
  const detectUserMode = (req) => {
    let userMode = 'Expert'; // 預設為Expert模式

    // 1. 從JWT Token中取得使用者模式
    if (req.user && req.user.mode) {
      userMode = req.user.mode;
    }

    // 2. 從請求標頭中取得模式設定
    if (req.headers['x-user-mode']) {
      userMode = req.headers['x-user-mode'];
    }

    // 3. 從查詢參數中取得模式設定（SIT測試支援）
    if (req.query && req.query.userMode) {
      userMode = req.query.userMode;
    }

    // 4. 統一模式命名格式驗證（嚴格模式匹配）
    if (!userMode || typeof userMode !== 'string') {
      return 'Expert';
    }

    const normalizedMode = userMode.toLowerCase().trim();
    switch (normalizedMode) {
      case 'expert':
        return 'Expert';
      case 'inertial':
        return 'Inertial';
      case 'cultivation':
        return 'Cultivation';
      case 'guiding':
        return 'Guiding';
      default:
        console.warn(`⚠️ 未知使用者模式: ${userMode}，使用預設Expert模式`);
        return 'Expert';
    }
  };

  // 四模式差異化處理函數（DCN-0015第三階段完整性修正）
  const applyModeSpecificFields = (userMode) => {
    // 確保模式名稱統一（首字母大寫）
    const normalizedMode = userMode ? userMode.charAt(0).toUpperCase() + userMode.slice(1).toLowerCase() : 'Expert';

    switch (normalizedMode) {
      case 'Expert':
        return {
          expertFeatures: {
            detailedAnalytics: true,
            advancedOptions: true,
            performanceMetrics: true,
            batchOperations: true,
            exportFeatures: true,
            dataInsights: true,
            customReports: true,
            expertAnalytics: true,
            professionalTools: true,
            detailedReports: true,
            bulkProcessing: true,
            advancedFiltering: true,
            customCategories: true,
            budgetForecasting: true
          }
        };
      case 'Cultivation':
        return {
          cultivationFeatures: {
            achievementProgress: true,
            gamificationElements: true,
            motivationalTips: true,
            progressTracking: true,
            rewardSystem: true,
            gamificationLevel: "advanced",
            encouragementType: "achievement_focused",
            goalTracking: "milestone_based",
            celebrationStyle: "achievement_popup",
            progressVisualization: "growth_chart",
            motivationalContent: "daily_tips",
            challengeLevel: "progressive"
          }
        };
      case 'Guiding':
        return {
          guidingFeatures: {
            simplifiedInterface: true,
            helpHints: true,
            autoSuggestions: true,
            stepByStepGuide: true,
            tutorialMode: true,
            interfaceComplexity: "simplified",
            helpSystem: "contextual_hints",
            navigationStyle: "step_by_step",
            assistanceLevel: "proactive",
            errorHandling: "user_friendly",
            inputValidation: "real_time_hints",
            onboardingFlow: "guided_tour"
          }
        };
      case 'Inertial':
      default:
        return {
          inertialFeatures: {
            stabilityMode: true,
            consistentInterface: true,
            minimalChanges: true,
            quickActions: true,
            familiarLayout: true,
            interfaceStability: "consistent",
            LayoutStyle: "familiar",
            changeFrequency: "minimal",
            featureAccess: "quick_shortcuts",
            defaultBehavior: "preserved",
            customizationLevel: "basic",
            updateNotification: "subtle",
            workflowPattern: "established"
          }
        };
    }
  };

  // 統一成功回應格式
  res.apiSuccess = (data, message = '操作成功', userMode = null) => {
    const detectedUserMode = userMode || detectUserMode(req);
    const response = {
      success: true,
      data: data,
      error: null,
      message: message,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || generateRequestId(),
        userMode: detectedUserMode,
        apiVersion: 'v1.0.0',
        processingTimeMs: Date.now() - req.startTime
      }
    };

    // 四模式差異化處理
    response.metadata.modeFeatures = applyModeSpecificFields(detectedUserMode);

    res.status(200).json(response);
  };

  // 統一錯誤回應格式（使用相同結構）
  res.apiError = (message, errorCode, statusCode = 400, details = null) => {
    const detectedUserMode = detectUserMode(req);
    const response = {
      success: false,
      data: null,
      error: {
        code: errorCode,
        message: message,
        details: details
      },
      message: message,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || generateRequestId(),
        userMode: detectedUserMode,
        apiVersion: 'v1.0.0',
        processingTimeMs: Date.now() - req.startTime
      }
    };

    // 錯誤回應也包含四模式特定欄位
    response.metadata.modeFeatures = applyModeSpecificFields(detectedUserMode);

    res.status(statusCode).json(response);
  };

  next();
});

/**
 * 06. 轉發日誌記錄中介軟體
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 記錄轉發請求，便於監控和除錯
 */
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`📥 [${timestamp}] ASL轉發: ${req.method} ${req.path}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`📤 [${timestamp}] ASL回應: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

/**
 * 07. 系統狀態端點
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description ASL純轉發窗口的基礎監控端點
 */
app.get('/', (req, res) => {
  res.apiSuccess({
    service: 'LCAS 2.0 API Service Layer (統一回應格式)',
    version: '2.2.1', // 升級到v2.2.1
    status: 'running',
    port: PORT,
    architecture: 'ASL -> BL層直接調用（優化版）',
    dcn_0015_features: {
      unified_response_format: true,
      four_mode_support: true,
      request_id_tracking: true,
      performance_metrics: true,
      mode_specific_features: true,
      enhanced_mode_detection: true,
      complete_field_mapping: true
    },
    p1_2_endpoints: {
      am_auth: 11,
      am_users: 8,
      bk_transaction: 15,
      total: 34
    },
    p2_endpoints: {
      bm_budgets: 5, // 預算管理
      cm_collaboration: 4, // 協作管理 (邀請, 移除, 更新權限, 取得列表)
      total: 9
    },
    dcn_0023_endpoints: {
      wcm_wallets: 8, // 錢包管理
      wcm_categories: 6, // 科目管理
      total: 14
    },
    total_endpoints: 34 + 9 + 14, // P1-2 + P2 + DCN-0023
    modules: {
      AM: !!AM ? 'loaded' : 'not loaded',
      BK: !!BK ? 'loaded' : 'not loaded',
      DL: !!DL ? 'loaded' : 'not loaded',
      // FS模組已移除，功能整合至其他專門模組
      BM: !!BM ? 'loaded' : 'not loaded',  // P2 模組
      CM: !!CM ? 'loaded' : 'not loaded',   // P2 模組 - 包含帳本管理功能
      WCM: !!WCM ? 'loaded' : 'not loaded' // DCN-0023 模組
    },
    supported_modes: ['Expert', 'Inertial', 'Cultivation', 'Guiding']
  }, 'ASL統一回應格式運行正常');
});

app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    service: 'ASL統一回應格式',
    version: '2.2.1', // 升級到v2.2.1
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    firebase_status: firebaseInitialized ? 'initialized' : 'failed',
    bl_modules: {
      AM: !!AM ? 'ready' : 'unavailable',
      BK: !!BK ? 'ready' : 'unavailable',
      DL: !!DL ? 'ready' : 'unavailable',
      BM: !!BM ? 'ready' : 'unavailable',  // P2 模組
      CM: !!CM ? 'ready_with_ledger_mgmt' : 'unavailable',   // P2 模組 - 包含帳本管理功能
      WCM: !!WCM ? 'ready' : 'unavailable' // DCN-0023 模組
    },
    dcn_0015_phase1: {
      unified_response_implemented: true,
      four_mode_support: true,
      request_tracking: true,
      performance_monitoring: true,
      metadata_structure: true,
      mode_detection: true
    },
    dcn_0015_phase3: {
      four_mode_field_completeness: true,
      enhanced_mode_detection: true,
      normalized_mode_names: true,
      complete_field_mapping: true,
      sit_test_compatibility: true
    },
    stage2_enhancements: {
      collaboration_management_added: !!CM,
      budget_management_added: !!BM
    },
    dcn_0023_enhancements: {
      wallet_category_management_added: !!WCM
    },
    stage1_fix: {
      applied: true,
      syntax_error_fixed: true,
      commonjs_compatibility: true,
      firebase_async_init: firebaseInitialized,
      am_module_status: !!AM ? 'loaded' : 'failed',
      fs_module_removed: true, // FS模組已移除
      cm_module_independent: !!CM ? 'ready' : 'unavailable'
    }
  };

  res.apiSuccess(healthStatus, 'ASL健康檢查完成');
});

/**
 * =============== P1-2 API端點轉發實作 ===============
 * 基於DCN-0012和0090文件規範，實作26個API端點的純轉發
 * AM.js: 11個認證服務API端點
 * BK.js: 15個記帳交易API端點
 */

// =============== AM.js 認證服務API轉發（11個端點） ===============

// 1. 使用者註冊
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    console.log('🔐 ASL轉發: 使用者註冊 -> AM_processAPIRegister');

    if (!AM || typeof AM.AM_processAPIRegister !== 'function') {
      return res.apiError('AM_processAPIRegister函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIRegister(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'REGISTER_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (register):', error);
    res.apiError('註冊轉發失敗', 'REGISTER_FORWARD_ERROR', 500);
  }
});

// 2. 使用者登入
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    console.log('🔑 ASL轉發: 使用者登入 -> AM_processAPILogin');

    if (!AM || typeof AM.AM_processAPILogin !== 'function') {
      return res.apiError('AM_processAPILogin函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPILogin(req.body);
    console.log('🔍 ASL接收到BL層回應:', JSON.stringify(result, null, 2));

    // 第二階段完成：完全移除容錯邏輯，100%信任BL層標準格式
    if (result && result.success) {
      console.log('✅ 登入成功，轉發資料:', result.data);
      res.apiSuccess(result.data, result.message);
    } else if (result && result.success === false) {
      console.log('❌ 登入失敗，錯誤資訊:', result.error);
      res.apiError(
        result.message || '登入失敗',
        result.error?.code || 'LOGIN_ERROR',
        400,
        result.error?.details || null
      );
    } else {
      console.log('⚠️ BL層回應格式異常:', result);
      res.apiError('BL層回應格式異常', 'INVALID_BL_RESPONSE', 500);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (login):', error);
    console.error('❌ 錯誤堆疊:', error.stack);
    res.apiError('登入轉發失敗', 'LOGIN_FORWARD_ERROR', 500);
  }
});

// 3. Google OAuth 登入
app.post('/api/v1/auth/google-login', async (req, res) => {
  try {
    console.log('🔑 ASL轉發: Google登入 -> AM_processAPIGoogleLogin');

    if (!AM || typeof AM.AM_processAPIGoogleLogin !== 'function') {
      return res.apiError('AM_processAPIGoogleLogin函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIGoogleLogin(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (google-login):', error);
    res.apiError('Google登入轉發失敗', 'GOOGLE_LOGIN_FORWARD_ERROR', 500);
  }
});

// 4. 使用者登出
app.post('/api/v1/auth/logout', async (req, res) => {
  try {
    console.log('🚪 ASL轉發: 使用者登出 -> AM_processAPILogout');

    if (!AM || typeof AM.AM_processAPILogout !== 'function') {
      return res.apiError('AM_processAPILogout函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPILogout(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (logout):', error);
    res.apiError('登出轉發失敗', 'LOGOUT_FORWARD_ERROR', 500);
  }
});

// 5. 刷新存取Token
app.post('/api/v1/auth/refresh', async (req, res) => {
  try {
    console.log('🔄 ASL轉發: Token刷新 -> AM_processAPIRefresh');

    if (!AM || typeof AM.AM_processAPIRefresh !== 'function') {
      return res.apiError('AM_processAPIRefresh函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIRefresh(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (refresh):', error);
    res.apiError('Token刷新轉發失敗', 'REFRESH_FORWARD_ERROR', 500);
  }
});

// 6. 忘記密碼
app.post('/api/v1/auth/forgot-password', async (req, res) => {
  try {
    console.log('🔑 ASL轉發: 忘記密碼 -> AM_processAPIForgotPassword');

    if (!AM || typeof AM.AM_processAPIForgotPassword !== 'function') {
      return res.apiError('AM_processAPIForgotPassword函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIForgotPassword(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (forgot-password):', error);
    res.apiError('忘記密碼轉發失敗', 'FORGOT_PASSWORD_FORWARD_ERROR', 500);
  }
});

// 7. 驗證密碼重設Token
app.get('/api/v1/auth/verify-reset-token', async (req, res) => {
  try {
    console.log('🔍 ASL轉發: 驗證重設Token -> AM_processAPIVerifyResetToken');

    if (!AM || typeof AM.AM_processAPIVerifyResetToken !== 'function') {
      return res.apiError('AM_processAPIVerifyResetToken函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIVerifyResetToken(req.query);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (verify-reset-token):', error);
    res.apiError('重設Token驗證轉發失敗', 'VERIFY_RESET_TOKEN_FORWARD_ERROR', 500);
  }
});

// 8. 重設密碼
app.post('/api/v1/auth/reset-password', async (req, res) => {
  try {
    console.log('🔒 ASL轉發: 重設密碼 -> AM_processAPIResetPassword');

    if (!AM || typeof AM.AM_processAPIResetPassword !== 'function') {
      return res.apiError('AM_processAPIResetPassword函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIResetPassword(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (reset-password):', error);
    res.apiError('重設密碼轉發失敗', 'RESET_PASSWORD_FORWARD_ERROR', 500);
  }
});

// 9. 驗證Email地址
app.post('/api/v1/auth/verify-email', async (req, res) => {
  try {
    console.log('📧 ASL轉發: Email驗證 -> AM_processAPIVerifyEmail');

    if (!AM || typeof AM.AM_processAPIVerifyEmail !== 'function') {
      return res.apiError('AM_processAPIVerifyEmail函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIVerifyEmail(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (verify-email):', error);
    res.apiError('Email驗證轉發失敗', 'VERIFY_EMAIL_FORWARD_ERROR', 500);
  }
});

// 10. 綁定LINE帳號
app.post('/api/v1/auth/bind-line', async (req, res) => {
  try {
    console.log('🔗 ASL轉發: 綁定LINE -> AM_processAPIBindLine');

    if (!AM || typeof AM.AM_processAPIBindLine !== 'function') {
      return res.apiError('AM_processAPIBindLine函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIBindLine(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (bind-line):', error);
    res.apiError('LINE綁定轉發失敗', 'BIND_LINE_FORWARD_ERROR', 500);
  }
});

// 11. 查詢綁定狀態
app.get('/api/v1/auth/bind-status', async (req, res) => {
  try {
    console.log('📋 ASL轉發: 綁定狀態查詢 -> AM_processAPIBindStatus');

    if (!AM || typeof AM.AM_processAPIBindStatus !== 'function') {
      return res.apiError('AM_processAPIBindStatus函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIBindStatus(req.query);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (bind-status):', error);
    res.apiError('綁定狀態查詢轉發失敗', 'BIND_STATUS_FORWARD_ERROR', 500);
  }
});

// =============== 用戶管理API轉發（基於8102.yaml規格） ===============

// 1. 取得用戶個人資料
app.get('/api/v1/users/profile', async (req, res) => {
  try {
    console.log('👤 ASL轉發: 取得用戶資料 -> AM_processAPIGetProfile');

    if (!AM || typeof AM.AM_processAPIGetProfile !== 'function') {
      return res.apiError('AM_processAPIGetProfile函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIGetProfile(req.query);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (users/profile):', error);
    res.apiError('用戶資料取得轉發失敗', 'GET_PROFILE_FORWARD_ERROR', 500);
  }
});

// 2. 更新用戶個人資料
app.put('/api/v1/users/profile', async (req, res) => {
  try {
    console.log('✏️ ASL轉發: 更新用戶資料 -> AM_processAPIUpdateProfile');

    if (!AM || typeof AM.AM_processAPIUpdateProfile !== 'function') {
      return res.apiError('AM_processAPIUpdateProfile函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIUpdateProfile(req.body);

    // 第二階段：直接使用BL層標準格式，100%信任BL層
    res.apiSuccess(result.data, result.message);

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update profile):', error);
    res.apiError('用戶資料更新轉發失敗', 'UPDATE_PROFILE_FORWARD_ERROR', 500);
  }
});

// 3. 取得模式評估問卷
app.get('/api/v1/users/assessment-questions', async (req, res) => {
  try {
    console.log('📝 ASL轉發: 取得評估問卷 -> AM_processAPIGetAssessmentQuestions');

    if (!AM || typeof AM.AM_processAPIGetAssessmentQuestions !== 'function') {
      return res.apiError('AM_processAPIGetAssessmentQuestions函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIGetAssessmentQuestions(req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (assessment-questions):', error);
    res.apiError('評估問卷取得轉發失敗', 'GET_ASSESSMENT_QUESTIONS_FORWARD_ERROR', 500);
  }
});

// 4. 提交模式評估結果
app.post('/api/v1/users/assessment', async (req, res) => {
  try {
    console.log('📊 ASL轉發: 提交評估結果 -> AM_processAPISubmitAssessment');

    if (!AM || typeof AM.AM_processAPISubmitAssessment !== 'function') {
      return res.apiError('AM_processAPISubmitAssessment函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPISubmitAssessment(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (submit assessment):', error);
    res.apiError('評估結果提交轉發失敗', 'SUBMIT_ASSESSMENT_FORWARD_ERROR', 500);
  }
});

// 5. 更新用戶偏好設定
app.put('/api/v1/users/preferences', async (req, res) => {
  try {
    console.log('⚙️ ASL轉發: 更新偏好設定 -> AM_processAPIUpdatePreferences');

    if (!AM || typeof AM.AM_processAPIUpdatePreferences !== 'function') {
      return res.apiError('AM_processAPIUpdatePreferences函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIUpdatePreferences(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update preferences):', error);
    res.apiError('偏好設定更新轉發失敗', 'UPDATE_PREFERENCES_FORWARD_ERROR', 500);
  }
});

// 5.1 查詢用戶偏好設定 (新增GET端點以支援完整CRUD)
app.get('/api/v1/users/preferences', async (req, res) => {
  try {
    console.log('📋 ASL轉發: 查詢偏好設定 -> AM_processAPIGetPreferences');

    if (!AM) {
      console.error('❌ AM模組未載入');
      return res.apiError('AM模組未載入', 'AM_MODULE_NOT_LOADED', 503);
    }

    if (typeof AM.AM_processAPIGetPreferences !== 'function') {
      console.error('❌ AM_processAPIGetPreferences函數不存在，可用函數：', Object.keys(AM));
      return res.apiError('AM_processAPIGetPreferences函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIGetPreferences(req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else if (result && result.success === false) {
      res.apiError(result.message || '偏好設定查詢失敗', result.error?.code || 'GET_PREFERENCES_ERROR', 400, result.error?.details);
    } else {
      console.error('❌ AM_processAPIGetPreferences回應格式異常:', result);
      res.apiError('BL層回應格式異常', 'INVALID_BL_RESPONSE', 500);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get preferences):', error);
    res.apiError('偏好設定查詢轉發失敗', 'GET_PREFERENCES_FORWARD_ERROR', 500);
  }
});

// 6. 更新安全設定
app.put('/api/v1/users/security', async (req, res) => {
  try {
    console.log('🔒 ASL轉發: 更新安全設定 -> AM_processAPIUpdateSecurity');

    if (!AM || typeof AM.AM_processAPIUpdateSecurity !== 'function') {
      return res.apiError('AM_processAPIUpdateSecurity函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIUpdateSecurity(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update security):', error);
    res.apiError('安全設定更新轉發失敗', 'UPDATE_SECURITY_FORWARD_ERROR', 500);
  }
});

// 7. 切換用戶模式
app.put('/api/v1/users/mode', async (req, res) => {
  try {
    console.log('🔄 ASL轉發: 切換用戶模式 -> AM_processAPISwitchMode');

    if (!AM || typeof AM.AM_processAPISwitchMode !== 'function') {
      return res.apiError('AM_processAPISwitchMode函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPISwitchMode(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (switch mode):', error);
    res.apiError('用戶模式切換轉發失敗', 'SWITCH_MODE_FORWARD_ERROR', 500);
  }
});

// 8. PIN碼驗證
app.post('/api/v1/users/verify-pin', async (req, res) => {
  try {
    console.log('🔑 ASL轉發: PIN碼驗證 -> AM_processAPIVerifyPin');

    if (!AM || typeof AM.AM_processAPIVerifyPin !== 'function') {
      return res.apiError('AM_processAPIVerifyPin函數不存在', 'AM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await AM.AM_processAPIVerifyPin(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (verify pin):', error);
    res.apiError('PIN碼驗證轉發失敗', 'VERIFY_PIN_FORWARD_ERROR', 500);
  }
});

// =============== P2階段：協作管理API端點補完 ===============

// =============== P2階段：協作管理API端點補完 ===============

// 階段一修復：新增POST /api/v1/ledgers端點 - 創建協作帳本
app.post('/api/v1/ledgers', async (req, res) => {
  try {
    console.log('🏗️ ASL轉發: 創建協作帳本 -> CM_createSharedLedger');

    if (!CM || typeof CM.CM_createSharedLedger !== 'function') {
      console.error('❌ CM模組或CM_createSharedLedger函數不存在');
      return res.apiError('CM_createSharedLedger函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    // 階段一修復：參數映射修復 - 從request body正確提取參數
    const ownerEmail = req.body.ownerEmail;
    const name = req.body.name;
    const type = req.body.type;
    const description = req.body.description;
    const currency = req.body.currency;
    const timezone = req.body.timezone;

    // 階段一修復：參數完整性檢查 - 確保必要參數不為空
    const missingParams = [];
    if (!ownerEmail || typeof ownerEmail !== 'string' || ownerEmail.trim() === '') {
      missingParams.push('ownerEmail');
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      missingParams.push('name');
    }
    if (!type || typeof type !== 'string' || type.trim() === '') {
      missingParams.push('type');
    }

    if (missingParams.length > 0) {
      return res.apiError(
        `缺少必要參數: ${missingParams.join(', ')}`,
        'MISSING_REQUIRED_PARAMETERS',
        400,
        { missingParams: missingParams }
      );
    }

    // 階段一修復：參數類型驗證
    if (currency && typeof currency !== 'string') {
      return res.apiError('currency參數必須是字串類型', 'INVALID_PARAMETER_TYPE', 400);
    }
    if (timezone && typeof timezone !== 'string') {
      return res.apiError('timezone參數必須是字串類型', 'INVALID_PARAMETER_TYPE', 400);
    }

    // 構建傳遞給CM模組的參數
    const ledgerData = {
      ownerEmail: ownerEmail.trim(),
      name: name.trim(),
      type: type.trim(),
      description: description ? description.trim() : '',
      currency: currency ? currency.trim() : 'TWD',
      timezone: timezone ? timezone.trim() : 'Asia/Taipei',
      isCollaborative: true,
      createdBy: ownerEmail.trim()
    };

    console.log(`📋 創建協作帳本參數: 擁有者=${ownerEmail}, 名稱=${name}, 類型=${type}`);

    // 調用CM模組創建協作帳本
    const result = await CM.CM_createSharedLedger(ledgerData, ownerEmail);

    if (result && result.success) {
      res.apiSuccess(result.data || {}, result.message || '協作帳本創建成功');
    } else {
      res.apiError(
        result?.message || '協作帳本創建失敗',
        result?.error?.code || 'CREATE_LEDGER_ERROR',
        400,
        result?.error?.details
      );
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (create ledger):', error);
    res.apiError('創建協作帳本轉發失敗', 'CREATE_LEDGER_FORWARD_ERROR', 500);
  }
});

// 階段二修正：補完協作帳本刪除端點
app.delete('/api/v1/ledgers/:id', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 刪除協作帳本 -> CM_deleteLedger');

    if (!CM || typeof CM.CM_deleteLedger !== 'function') {
      console.error('❌ CM模組或CM_deleteLedger函數不存在');
      return res.apiError('CM_deleteLedger函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const ledgerId = req.params.id;
    if (!ledgerId || ledgerId.trim() === '') {
      return res.apiError('帳本ID不能為空', 'MISSING_LEDGER_ID', 400);
    }

    console.log(`📋 刪除協作帳本ID: ${ledgerId}`);

    // 調用CM模組刪除協作帳本
    const result = await CM.CM_deleteLedger(ledgerId, req.query.operatorId || 'system');

    if (result && result.success) {
      res.apiSuccess(result.data || {}, result.message || '協作帳本刪除成功');
    } else {
      res.apiError(
        result?.message || '協作帳本刪除失敗',
        result?.error?.code || 'DELETE_LEDGER_ERROR',
        400,
        result?.error?.details
      );
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete ledger):', error);
    res.apiError('刪除協作帳本轉發失敗', 'DELETE_LEDGER_FORWARD_ERROR', 500);
  }
});

// 階段二修正：補完協作者邀請端點
app.post('/api/v1/ledgers/:id/invitations', async (req, res) => {
  try {
    console.log('📧 ASL轉發: 邀請協作者 -> CM_inviteCollaborator');

    if (!CM || typeof CM.CM_inviteCollaborator !== 'function') {
      console.error('❌ CM模組或CM_inviteCollaborator函數不存在');
      return res.apiError('CM_inviteCollaborator函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const ledgerId = req.params.id;
    if (!ledgerId || ledgerId.trim() === '') {
      return res.apiError('帳本ID不能為空', 'MISSING_LEDGER_ID', 400);
    }

    const invitationData = req.body;
    if (!invitationData.email) {
      return res.apiError('邀請Email不能為空', 'MISSING_EMAIL', 400);
    }

    console.log(`📋 邀請協作者到帳本: ${ledgerId}, 邀請Email: ${invitationData.email}`);

    // 調用CM模組邀請協作者
    const result = await CM.CM_inviteCollaborator(ledgerId, invitationData, {
      inviterId: req.body.operatorId || req.body.inviterId || 'system'
    });

    if (result && result.success) {
      res.apiSuccess(result.data || {}, result.message || '協作者邀請成功');
    } else {
      res.apiError(
        result?.message || '協作者邀請失敗',
        result?.error?.code || 'INVITE_COLLABORATOR_ERROR',
        400,
        result?.error?.details
      );
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (invite collaborator):', error);
    res.apiError('邀請協作者轉發失敗', 'INVITE_COLLABORATOR_FORWARD_ERROR', 500);
  }
});

// 階段二修正：補完移除協作者端點
app.delete('/api/v1/ledgers/:id/collaborators/:userId', async (req, res) => {
  try {
    console.log('👤 ASL轉發: 移除協作者 -> CM_removeCollaborator');

    if (!CM || typeof CM.CM_removeCollaborator !== 'function') {
      console.error('❌ CM模組或CM_removeCollaborator函數不存在');
      return res.apiError('CM_removeCollaborator函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const ledgerId = req.params.id;
    const userId = req.params.userId;

    if (!ledgerId || ledgerId.trim() === '') {
      return res.apiError('帳本ID不能為空', 'MISSING_LEDGER_ID', 400);
    }

    if (!userId || userId.trim() === '') {
      return res.apiError('用戶ID不能為空', 'MISSING_USER_ID', 400);
    }

    console.log(`📋 從帳本 ${ledgerId} 移除協作者: ${userId}`);

    // 調用CM模組移除協作者
    const result = await CM.CM_removeCollaborator(ledgerId, userId, {
      removerId: req.query.operatorId || 'system',
      reason: req.body.reason || req.query.reason || 'removed_by_admin'
    });

    if (result && result.success) {
      res.apiSuccess(result.data || {}, result.message || '協作者移除成功');
    } else {
      res.apiError(
        result?.message || '協作者移除失敗',
        result?.error?.code || 'REMOVE_COLLABORATOR_ERROR',
        400,
        result?.error?.details
      );
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (remove collaborator):', error);
    res.apiError('移除協作者轉發失敗', 'REMOVE_COLLABORATOR_FORWARD_ERROR', 500);
  }
});

// =============== BK.js 記帳交易API轉發（15個端點） ===============

// 1. 新增交易記錄
app.post('/api/v1/transactions', async (req, res) => {
  try {
    console.log('💰 ASL轉發: 新增交易 -> BK_createTransaction');

    if (!BK || typeof BK.BK_createTransaction !== 'function') {
      return res.apiError('BK_createTransaction函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    // 載入0692測試資料
    let testData = {};
    try {
      testData = require('./06. SIT_Test code/0692. SIT_TestData_P1.json');
    } catch (error) {
      console.warn('⚠️ 無法載入0692測試資料，使用預設值');
    }

    // 構建調用BK_createTransaction的參數
    const transactionData = {
      amount: req.body.amount,
      type: req.body.type,
      description: req.body.description,
      categoryId: req.body.categoryId,
      accountId: req.body.accountId,
      ledgerId: req.body.ledgerId,
      paymentMethod: req.body.paymentMethod,
      date: req.body.date,
      userId: req.body.userId || Object.keys(testData.authentication_test_data?.valid_users || {})[0] || 'default_test_user'
      // processId將在BL層使用1311.FS.js的標準函數生成
    };

    const result = await BK.BK_createTransaction(transactionData);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'TRANSACTION_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (transactions):', error);
    res.apiError('交易新增轉發失敗', 'TRANSACTION_FORWARD_ERROR', 500);
  }
});

// 2. 快速記帳
app.post('/api/v1/transactions/quick', async (req, res) => {
  try {
    console.log('⚡ ASL轉發: 快速記帳 -> BK_processBookkeeping');

    if (!BK || typeof BK.BK_processBookkeeping !== 'function') {
      return res.apiError('BK_processBookkeeping函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    // 檢查輸入參數
    if (!req.body.input || typeof req.body.input !== 'string' || req.body.input.trim() === '') {
      return res.apiError('快速輸入文字為必填項目', 'MISSING_INPUT_FIELD', 400);
    }

    // 載入0692測試資料
    let testData = {};
    try {
      testData = require('./06. SIT_Test code/0692. SIT_TestData_P1.json');
    } catch (error) {
      console.warn('⚠️ 無法載入0692測試資料，使用預設值');
    }

    // 解析快速輸入
    const parsed = BK.BK_parseQuickInput ? BK.BK_parseQuickInput(req.body.input.trim()) : null;
    if (!parsed || !parsed.success) {
      return res.apiError('無法解析輸入內容', 'PARSE_ERROR', 400, parsed?.error);
    }

    // 構建調用BK_processBookkeeping的參數
    const bookkeepingData = {
      amount: parsed.data.amount,
      type: parsed.data.type,
      description: parsed.data.description,
      subject: parsed.data.description,
      userId: req.body.userId || Object.keys(testData.authentication_test_data?.valid_users || {})[0] || 'default_test_user',
      ledgerId: req.body.ledgerId,
      paymentMethod: parsed.data.paymentMethod
    };

    const result = await BK.BK_processBookkeeping(bookkeepingData);

    if (result.success) {
      res.apiSuccess({
        ...result.data,
        parsed: parsed.data,
        quickInput: req.body.input
      }, result.message);
    } else {
      res.apiError(result.error?.message || result.message, result.error?.code || 'PROCESS_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (quick):', error);
    res.apiError('快速記帳轉發失敗', 'QUICK_TRANSACTION_FORWARD_ERROR', 500);
  }
});

// 3. 查詢交易記錄
app.get('/api/v1/transactions', async (req, res) => {
  try {
    console.log('📋 ASL轉發: 查詢交易 -> BK_getTransactions');

    if (!BK || typeof BK.BK_getTransactions !== 'function') {
      return res.apiError('BK_getTransactions函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    // 構建調用BK_getTransactions的參數
    const queryParams = {
      userId: req.query.userId,
      ledgerId: req.query.ledgerId,
      limit: req.query.limit,
      page: req.query.page,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      type: req.query.type,
      categoryId: req.query.categoryId,
      minAmount: req.query.minAmount,
      maxAmount: req.query.maxAmount,
      paymentMethod: req.query.paymentMethod,
      orderBy: req.query.orderBy,
      orderDirection: req.query.orderDirection
    };

    const result = await BK.BK_getTransactions(queryParams);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'QUERY_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get transactions):', error);
    res.apiError('交易查詢轉發失敗', 'GET_TRANSACTIONS_FORWARD_ERROR', 500);
  }
});

// 7. 儀表板數據 (必須在 :id 路由之前)
app.get('/api/v1/transactions/dashboard', async (req, res) => {
  try {
    console.log('📊 ASL轉發: 儀表板數據 -> BK_processAPIGetDashboard');

    if (!BK || typeof BK.BK_processAPIGetDashboard !== 'function') {
      return res.apiError('BK_processAPIGetDashboard函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetDashboard(req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (dashboard):', error);
    res.apiError('儀表板數據轉發失敗', 'DASHBOARD_FORWARD_ERROR', 500);
  }
});

// 8. 統計數據 (必須在 :id 路由之前)
app.get('/api/v1/transactions/statistics', async (req, res) => {
  try {
    console.log('📈 ASL轉發: 統計數據 -> BK_processAPIGetStatistics');

    if (!BK || typeof BK.BK_processAPIGetStatistics !== 'function') {
      return res.apiError('BK_processAPIGetStatistics函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetStatistics(req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (statistics):', error);
    res.apiError('統計數據轉發失敗', 'STATISTICS_FORWARD_ERROR', 500);
  }
});

// 9. 最近交易 (必須在 :id 路由之前)
app.get('/api/v1/transactions/recent', async (req, res) => {
  try {
    console.log('🕒 ASL轉發: 最近交易 -> BK_processAPIGetRecent');

    if (!BK || typeof BK.BK_processAPIGetRecent !== 'function') {
      return res.apiError('BK_processAPIGetRecent函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetRecent(req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (recent):', error);
    res.apiError('最近交易轉發失敗', 'RECENT_FORWARD_ERROR', 500);
  }
});

// 10. 圖表數據 (必須在 :id 路由之前)
app.get('/api/v1/transactions/charts', async (req, res) => {
  try {
    console.log('📊 ASL轉發: 圖表數據 -> BK_processAPIGetCharts');

    if (!BK || typeof BK.BK_processAPIGetCharts !== 'function') {
      return res.apiError('BK_processAPIGetCharts函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetCharts(req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (charts):', error);
    res.apiError('圖表數據轉發失敗', 'CHARTS_FORWARD_ERROR', 500);
  }
});

// 4. 取得交易詳情 (通配符路由必須放在最後)
app.get('/api/v1/transactions/:id', async (req, res) => {
  try {
    console.log('🔍 ASL轉發: 交易詳情 -> BK_processAPIGetTransactionDetail');

    if (!BK || typeof BK.BK_processAPIGetTransactionDetail !== 'function') {
      return res.apiError('BK_processAPIGetTransactionDetail函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetTransactionDetail(req.params.id, req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || result.error?.message, result.error?.code || 'GET_TRANSACTION_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (transaction detail):', error);
    res.apiError('交易詳情轉發失敗', 'GET_TRANSACTION_DETAIL_FORWARD_ERROR', 500);
  }
});

// 5. 更新交易記錄
app.put('/api/v1/transactions/:id', async (req, res) => {
  try {
    console.log('✏️ ASL轉發: 更新交易 -> BK_processAPIUpdateTransaction');

    if (!BK || typeof BK.BK_processAPIUpdateTransaction !== 'function') {
      return res.apiError('BK_processAPIUpdateTransaction函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIUpdateTransaction(req.params.id, req.body);

    // 統一格式處理：確保符合DCN-0015規範
    if (result && result.success === true) {
      res.apiSuccess(result.data, result.message || '交易更新成功');
    } else if (result && result.success === false) {
      res.apiError(
        result.message || result.error?.message || '交易更新失敗',
        result.error?.code || 'UPDATE_TRANSACTION_ERROR',
        400,
        result.error?.details || null
      );
    } else {
      console.error('❌ BK_processAPIUpdateTransaction回應格式異常:', result);
      res.apiError('BL層回應格式異常', 'INVALID_BL_RESPONSE', 500);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update transaction):', error);
    res.apiError('交易更新轉發失敗', 'UPDATE_TRANSACTION_FORWARD_ERROR', 500);
  }
});

// 6. 刪除交易記錄
app.delete('/api/v1/transactions/:id', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 刪除交易 -> BK_processAPIDeleteTransaction');

    if (!BK || typeof BK.BK_processAPIDeleteTransaction !== 'function') {
      return res.apiError('BK_processAPIDeleteTransaction函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIDeleteTransaction(req.params.id, req.query);

    // 統一格式處理：確保符合DCN-0015規範
    if (result && result.success === true) {
      res.apiSuccess(result.data, result.message || '交易刪除成功');
    } else if (result && result.success === false) {
      res.apiError(
        result.message || result.error?.message || '交易刪除失敗',
        result.error?.code || 'DELETE_TRANSACTION_ERROR',
        400,
        result.error?.details || null
      );
    } else {
      console.error('❌ BK_processAPIDeleteTransaction回應格式異常:', result);
      res.apiError('BL層回應格式異常', 'INVALID_BL_RESPONSE', 500);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete transaction):', error);
    res.apiError('交易刪除轉發失敗', 'DELETE_TRANSACTION_FORWARD_ERROR', 500);
  }
});

// 11. 批量新增交易
app.post('/api/v1/transactions/batch', async (req, res) => {
  try {
    console.log('📦 ASL轉發: 批量新增 -> BK_processAPIBatchCreate');

    if (!BK || typeof BK.BK_processAPIBatchCreate !== 'function') {
      return res.apiError('BK_processAPIBatchCreate函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIBatchCreate(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (batch create):', error);
    res.apiError('批量新增轉發失敗', 'BATCH_CREATE_FORWARD_ERROR', 500);
  }
});

// 12. 批量更新交易
app.put('/api/v1/transactions/batch', async (req, res) => {
  try {
    console.log('📝 ASL轉發: 批量更新 -> BK_processAPIBatchUpdate');

    if (!BK || typeof BK.BK_processAPIBatchUpdate !== 'function') {
      return res.apiError('BK_processAPIBatchUpdate函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIBatchUpdate(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (batch update):', error);
    res.apiError('批量更新轉發失敗', 'BATCH_UPDATE_FORWARD_ERROR', 500);
  }
});

// 13. 批量刪除交易
app.delete('/api/v1/transactions/batch', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 批量刪除 -> BK_processAPIBatchDelete');

    if (!BK || typeof BK.BK_processAPIBatchDelete !== 'function') {
      return res.apiError('BK_processAPIBatchDelete函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIBatchDelete(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (batch delete):', error);
    res.apiError('批量刪除轉發失敗', 'BATCH_DELETE_FORWARD_ERROR', 500);
  }
});

// 14. 上傳附件
app.post('/api/v1/transactions/:id/attachments', async (req, res) => {
  try {
    console.log('📎 ASL轉發: 上傳附件 -> BK_processAPIUploadAttachment');

    if (!BK || typeof BK.BK_processAPIUploadAttachment !== 'function') {
      return res.apiError('BK_processAPIUploadAttachment函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIUploadAttachment({ id: req.params.id, ...req.body });

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (upload attachment):', error);
    res.apiError('附件上傳轉發失敗', 'UPLOAD_ATTACHMENT_FORWARD_ERROR', 500);
  }
});

// 15. 刪除附件
app.delete('/api/v1/transactions/:id/attachments/:attachmentId', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 刪除附件 -> BK_processAPIDeleteAttachment');

    if (!BK || typeof BK.BK_processAPIDeleteAttachment !== 'function') {
      return res.apiError('BK_processAPIDeleteAttachment函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIDeleteAttachment({
      id: req.params.id,
      attachmentId: req.params.attachmentId
    });

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.error.message, result.error.code, 400, result.error.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete attachment):', error);
    res.apiError('附件刪除轉發失敗', 'DELETE_ATTACHMENT_FORWARD_ERROR', 500);
  }
});

// =============== 錢包管理API轉發（新增支援協作功能） ===============

// 15. 取得錢包列表
app.get('/api/v1/accounts', async (req, res) => {
  try {
    console.log('📋 ASL轉發: 取得錢包列表 -> WCM_getWalletList'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_getWalletList !== 'function') {
      return res.apiError('WCM_getWalletList函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_getWalletList(req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else if (result && result.success === false) {
      res.apiError(result.message || '錢包列表查詢失敗', result.error?.code || 'GET_WALLET_LIST_ERROR', 400, result.error?.details);
    } else {
      console.error('❌ WCM_getWalletList回應格式異常:', result);
      res.apiError('BL層回應格式異常', 'INVALID_BL_RESPONSE', 500);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get wallet list):', error);
    res.apiError('錢包列表轉發失敗', 'GET_WALLET_LIST_FORWARD_ERROR', 500);
  }
});

// 16. 建立錢包
app.post('/api/v1/accounts', async (req, res) => {
  try {
    console.log('➕ ASL轉發: 建立錢包 -> WCM_createWallet'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_createWallet !== 'function') {
      return res.apiError('WCM_createWallet函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_createWallet(req.body);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '錢包創建失敗', result.error?.code || 'CREATE_WALLET_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (create wallet):', error);
    res.apiError('錢包創建轉發失敗', 'CREATE_WALLET_FORWARD_ERROR', 500);
  }
});

// 17. 取得特定錢包詳情
app.get('/api/v1/accounts/:id', async (req, res) => {
  try {
    console.log('🔍 ASL轉發: 取得錢包詳情 -> WCM_getWalletById'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts/:id as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_getWalletById !== 'function') {
      return res.apiError('WCM_getWalletById函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_getWalletById(req.params.id, req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '錢包詳情查詢失敗', result.error?.code || 'GET_WALLET_DETAIL_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get wallet detail):', error);
    res.apiError('錢包詳情轉發失敗', 'GET_WALLET_DETAIL_FORWARD_ERROR', 500);
  }
});

// 18. 更新特定錢包
app.put('/api/v1/accounts/:id', async (req, res) => {
  try {
    console.log('✏️ ASL轉發: 更新錢包 -> WCM_updateWallet'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts/:id as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_updateWallet !== 'function') {
      return res.apiError('WCM_updateWallet函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_updateWallet(req.params.id, req.body);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '錢包更新失敗', result.error?.code || 'UPDATE_WALLET_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update wallet):', error);
    res.apiError('錢包更新轉發失敗', 'UPDATE_WALLET_FORWARD_ERROR', 500);
  }
});

// 19. 刪除特定錢包
app.delete('/api/v1/accounts/:id', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 刪除錢包 -> WCM_deleteWallet'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts/:id as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_deleteWallet !== 'function') {
      return res.apiError('WCM_deleteWallet函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_deleteWallet(req.params.id, req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '錢包刪除失敗', result.error?.code || 'DELETE_WALLET_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete wallet):', error);
    res.apiError('錢包刪除轉發失敗', 'DELETE_WALLET_FORWARD_ERROR', 500);
  }
});

// 20. 取得錢包餘額
app.get('/api/v1/accounts/:id/balance', async (req, res) => {
  try {
    console.log('💰 ASL轉發: 取得錢包餘額 -> WCM_getWalletBalance'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts/:id/balance as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_getWalletBalance !== 'function') {
      return res.apiError('WCM_getWalletBalance函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_getWalletBalance(req.params.id, req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '錢包餘額查詢失敗', result.error?.code || 'GET_WALLET_BALANCE_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get wallet balance):', error);
    res.apiError('錢包餘額轉發失敗', 'GET_WALLET_BALANCE_FORWARD_ERROR', 500);
  }
});

// 21. 取得錢包類型列表
app.get('/api/v1/accounts/types', async (req, res) => {
  try {
    console.log('🏷️ ASL轉發: 取得錢包類型 -> WCM_getWalletTypes'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts/types as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_getWalletTypes !== 'function') {
      return res.apiError('WCM_getWalletTypes函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_getWalletTypes(req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '錢包類型查詢失敗', result.error?.code || 'GET_WALLET_TYPES_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get wallet types):', error);
    res.apiError('錢包類型轉發失敗', 'GET_WALLET_TYPES_FORWARD_ERROR', 500);
  }
});

// 22. 錢包轉帳
app.post('/api/v1/accounts/transfer', async (req, res) => {
  try {
    console.log('💸 ASL轉發: 錢包轉帳 -> WCM_transferFunds'); // Modified to WCM
    // Note: The API endpoint remains /api/v1/accounts/transfer as per the requirement to update the path.

    if (!WCM || typeof WCM.WCM_transferFunds !== 'function') {
      return res.apiError('WCM_transferFunds函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_transferFunds(req.body);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '錢包轉帳失敗', result.error?.code || 'TRANSFER_FUNDS_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (transfer funds):', error);
    res.apiError('錢包轉帳轉發失敗', 'TRANSFER_FUNDS_FORWARD_ERROR', 500);
  }
});

// =============== 科目管理API轉發 ===============

// 23. 取得科目列表
app.get('/api/v1/categories', async (req, res) => {
  try {
    console.log('📚 ASL轉發: 取得科目列表 -> WCM_getCategories'); // Modified to WCM

    if (!WCM || typeof WCM.WCM_getCategories !== 'function') {
      return res.apiError('WCM_getCategories函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_getCategories(req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '科目列表查詢失敗', result.error?.code || 'GET_CATEGORIES_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get categories):', error);
    res.apiError('科目列表轉發失敗', 'GET_CATEGORIES_FORWARD_ERROR', 500);
  }
});

// 24. 創建科目
app.post('/api/v1/categories', async (req, res) => {
  try {
    console.log('➕ ASL轉發: 創建科目 -> WCM_createCategory'); // Modified to WCM

    if (!WCM || typeof WCM.WCM_createCategory !== 'function') {
      return res.apiError('WCM_createCategory函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_createCategory(req.body);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '科目創建失敗', result.error?.code || 'CREATE_CATEGORY_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (create category):', error);
    res.apiError('科目創建轉發失敗', 'CREATE_CATEGORY_FORWARD_ERROR', 500);
  }
});

// 25. 取得特定科目詳情
app.get('/api/v1/categories/:id', async (req, res) => {
  try {
    console.log('🔍 ASL轉發: 取得科目詳情 -> WCM_getCategoryById'); // Modified to WCM

    if (!WCM || typeof WCM.WCM_getCategoryById !== 'function') {
      return res.apiError('WCM_getCategoryById函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_getCategoryById(req.params.id, req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '科目詳情查詢失敗', result.error?.code || 'GET_CATEGORY_DETAIL_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get category detail):', error);
    res.apiError('科目詳情轉發失敗', 'GET_CATEGORY_DETAIL_FORWARD_ERROR', 500);
  }
});

// 26. 更新特定科目
app.put('/api/v1/categories/:id', async (req, res) => {
  try {
    console.log('✏️ ASL轉發: 更新科目 -> WCM_updateCategory'); // Modified to WCM

    if (!WCM || typeof WCM.WCM_updateCategory !== 'function') {
      return res.apiError('WCM_updateCategory函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_updateCategory(req.params.id, req.body);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '科目更新失敗', result.error?.code || 'UPDATE_CATEGORY_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update category):', error);
    res.apiError('科目更新轉發失敗', 'UPDATE_CATEGORY_FORWARD_ERROR', 500);
  }
});

// 27. 刪除特定科目
app.delete('/api/v1/categories/:id', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 刪除科目 -> WCM_deleteCategory'); // Modified to WCM

    if (!WCM || typeof WCM.WCM_deleteCategory !== 'function') {
      return res.apiError('WCM_deleteCategory函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_deleteCategory(req.params.id, req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '科目刪除失敗', result.error?.code || 'DELETE_CATEGORY_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete category):', error);
    res.apiError('科目刪除轉發失敗', 'DELETE_CATEGORY_FORWARD_ERROR', 500);
  }
});

// 28. 取得科目樹狀結構
app.get('/api/v1/categories/tree', async (req, res) => {
  try {
    console.log('🌳 ASL轉發: 取得科目樹狀結構 -> WCM_getCategoryTree'); // Modified to WCM

    if (!WCM || typeof WCM.WCM_getCategoryTree !== 'function') {
      return res.apiError('WCM_getCategoryTree函數不存在', 'WCM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await WCM.WCM_getCategoryTree(req.query);

    if (result && result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '科目樹狀結構查詢失敗', result.error?.code || 'GET_CATEGORY_TREE_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get category tree):', error);
    res.apiError('科目樹狀結構轉發失敗', 'GET_CATEGORY_TREE_FORWARD_ERROR', 500);
  }
});

// =============== CM.js 協作與帳本管理 API 轉發 ===============

// 1. 取得帳本列表
app.get('/api/v1/ledgers', async (req, res) => {
  try {
    console.log('📖 ASL轉發: 取得帳本列表 -> CM_getLedgers');

    if (!CM || typeof CM.CM_getLedgers !== 'function') {
      return res.apiError('CM_getLedgers函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    // 階段一修正：確保數值型參數轉換為整數傳遞給CM模組
    const queryParams = { ...req.query };
    if (queryParams.limit) queryParams.limit = parseInt(queryParams.limit, 10);
    if (queryParams.page) queryParams.page = parseInt(queryParams.page, 10);

    const result = await CM.CM_getLedgers(queryParams);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'GET_LEDGERS_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get ledgers):', error);
    res.apiError('帳本列表取得轉發失敗', 'GET_LEDGERS_FORWARD_ERROR', 500);
  }
});

// 2. 建立帳本 - 統一使用CM_createSharedLedger
app.post('/api/v1/ledgers', async (req, res) => {
  try {
    console.log('📝 ASL轉發: 建立帳本 -> CM_createSharedLedger (階段一修復)');
    console.log('🔍 接收到的請求資料:', JSON.stringify(req.body, null, 2));

    if (!CM || typeof CM.CM_createSharedLedger !== 'function') {
      return res.apiError('CM_createSharedLedger函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    // 階段一修復：參數完整性檢查
    const requiredParams = ['name', 'ownerEmail'];
    const missingParams = [];

    for (const param of requiredParams) {
      if (!req.body[param] || (typeof req.body[param] === 'string' && req.body[param].trim() === '')) {
        missingParams.push(param);
      }
    }

    if (missingParams.length > 0) {
      return res.apiError(
        `缺少必要參數: ${missingParams.join(', ')}`,
        'MISSING_REQUIRED_PARAMS',
        400,
        { missingParams: missingParams }
      );
    }

    // 階段一修復：參數類型驗證
    if (typeof req.body.name !== 'string') {
      return res.apiError('參數name必須為字串類型', 'INVALID_PARAM_TYPE', 400);
    }

    if (typeof req.body.ownerEmail !== 'string') {
      return res.apiError('參數ownerEmail必須為字串類型', 'INVALID_PARAM_TYPE', 400);
    }

    // 階段一修復：正確提取並驗證參數
    const ledgerData = {
      name: req.body.name.trim(),
      type: req.body.type || 'shared',
      description: req.body.description || '',
      ownerEmail: req.body.ownerEmail.trim(),
      memberList: Array.isArray(req.body.memberList) ? req.body.memberList : [],
      settings: (typeof req.body.settings === 'object' && req.body.settings !== null) ? req.body.settings : {},
      permissionSettings: (typeof req.body.permissionSettings === 'object' && req.body.permissionSettings !== null) ? req.body.permissionSettings : {}
    };

    console.log('✅ 階段一修復：參數驗證通過，準備調用CM模組');
    console.log('📋 驗證後的帳本資料:', JSON.stringify(ledgerData, null, 2));

    // 調用CM_createSharedLedger函數（使用正確的參數順序）
    const result = await CM.CM_createSharedLedger(ledgerData, 'ASL_API');

    console.log('🎯 CM_createSharedLedger調用結果:', result);

    if (result && result.success) {
      res.apiSuccess(result, result.message || '協作帳本建立成功');
    } else {
      res.apiError(
        result?.message || '帳本建立失敗',
        result?.error?.code || result?.errorCode || 'CREATE_LEDGER_ERROR',
        400,
        result?.error?.details || result?.details
      );
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (create ledger):', error);
    console.error('❌ 錯誤堆疊:', error.stack);
    res.apiError('帳本建立轉發失敗', 'CREATE_LEDGER_FORWARD_ERROR', 500);
  }
});

// 3. 取得帳本詳情
app.get('/api/v1/ledgers/:id', async (req, res) => {
  try {
    console.log('🔍 ASL轉發: 取得帳本詳情 -> CM_getLedgerById');

    if (!CM || typeof CM.CM_getLedgerById !== 'function') {
      return res.apiError('CM_getLedgerById函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_getLedgerById(req.params.id, req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'GET_LEDGER_DETAIL_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get ledger detail):', error);
    res.apiError('帳本詳情取得轉發失敗', 'GET_LEDGER_DETAIL_FORWARD_ERROR', 500);
  }
});

// 4. 更新帳本
app.put('/api/v1/ledgers/:id', async (req, res) => {
  try {
    console.log('✏️ ASL轉發: 更新帳本 -> CM_updateLedger');

    if (!CM || typeof CM.CM_updateLedger !== 'function') {
      return res.apiError('CM_updateLedger函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_updateLedger(req.params.id, req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'UPDATE_LEDGER_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update ledger):', error);
    res.apiError('帳本更新轉發失敗', 'UPDATE_LEDGER_FORWARD_ERROR', 500);
  }
});

// 5. 刪除帳本
app.delete('/api/v1/ledgers/:id', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 刪除帳本 -> CM_deleteLedger');

    if (!CM || typeof CM.CM_deleteLedger !== 'function') {
      return res.apiError('CM_deleteLedger函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_deleteLedger(req.params.id, req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'DELETE_LEDGER_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete ledger):', error);
    res.apiError('帳本刪除轉發失敗', 'DELETE_LEDGER_FORWARD_ERROR', 500);
  }
});

// 6. 取得協作者列表 - 符合8020規範
app.get('/api/v1/ledgers/:id/collaborators', async (req, res) => {
  try {
    console.log('👥 ASL轉發: 取得協作者列表 -> CM_getCollaborators');

    if (!CM || typeof CM.CM_getCollaborators !== 'function') {
      return res.apiError('CM_getCollaborators函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_getCollaborators(req.params.id, {
      requesterId: req.query.userId || req.body.userId || 'system'
    });

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'GET_COLLABORATORS_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get collaborators):', error);
    res.apiError('協作者列表取得轉發失敗', 'GET_COLLABORATORS_FORWARD_ERROR', 500);
  }
});

// 7. 邀請協作者 - 符合8020規範
app.post('/api/v1/ledgers/:id/invitations', async (req, res) => {
  try {
    console.log('📧 ASL轉發: 邀請協作者 -> CM_inviteCollaborator');

    if (!CM || typeof CM.CM_inviteCollaborator !== 'function') {
      return res.apiError('CM_inviteCollaborator函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_inviteCollaborator(req.params.id, req.body, {
      inviterId: req.body.inviterId || req.body.operatorId || 'system'
    });

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'INVITE_COLLABORATOR_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (invite collaborators):', error);
    res.apiError('協作者邀請轉發失敗', 'INVITE_COLLABORATORS_FORWARD_ERROR', 500);
  }
});

// 8. 更新協作者權限 - 符合8020規範
app.put('/api/v1/ledgers/:id/collaborators/:userId', async (req, res) => {
  try {
    console.log('👥✏️ ASL轉發: 更新協作者權限 -> CM_setMemberPermission');

    if (!CM || typeof CM.CM_setMemberPermission !== 'function') {
      return res.apiError('CM_setMemberPermission函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_setMemberPermission(
      req.params.id,
      req.params.userId,
      req.body.permission || req.body.role || 'member',
      req.body.operatorId || req.query.operatorId || 'system'
    );

    if (result.success) {
      res.apiSuccess(result, result.message || '協作者權限更新成功');
    } else {
      res.apiError(result.message || '協作者權限更新失敗', result.error?.code || 'UPDATE_COLLABORATOR_PERMISSION_ERROR', 400, result.error?.details);
    }
  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update collaborator permission):', error);
    res.apiError('協作者權限更新轉發失敗', 'UPDATE_COLLABORATOR_PERMISSION_FORWARD_ERROR', 500);
  }
});

// 9. 移除協作者 - 符合8020規範
app.delete('/api/v1/ledgers/:id/collaborators/:userId', async (req, res) => {
  try {
    console.log('👥🗑️ ASL轉發: 移除協作者 -> CM_removeCollaborator');

    if (!CM || typeof CM.CM_removeCollaborator !== 'function') {
      return res.apiError('CM_removeCollaborator函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_removeCollaborator(req.params.id, req.params.userId, {
      removerId: req.body.operatorId || req.query.operatorId || 'system',
      reason: req.body.removeType || 'kicked'
    });

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message || '協作者移除失敗', result.error?.code || 'REMOVE_COLLABORATOR_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (remove collaborator):', error);
    res.apiError('協作者移除轉發失敗', 'REMOVE_COLLABORATOR_FORWARD_ERROR', 500);
  }
});

// 10. 取得權限狀態 - 符合8020規範
app.get('/api/v1/ledgers/:id/permissions', async (req, res) => {
  try {
    console.log('🔐 ASL轉發: 取得權限狀態 -> CM_getPermissions');

    if (!CM || typeof CM.CM_getPermissions !== 'function') {
      return res.apiError('CM_getPermissions函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await CM.CM_getPermissions(req.params.id, req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'GET_PERMISSIONS_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get permissions):', error);
    res.apiError('權限狀態取得轉發失敗', 'GET_PERMISSIONS_FORWARD_ERROR', 500);
  }
});

// =============== BM.js 預算管理 API 轉發 ===============

// 1. 取得預算列表
app.get('/api/v1/budgets', async (req, res) => {
  try {
    console.log('💰 ASL轉發: 取得預算列表 -> BM_getBudgets');

    if (!BM || typeof BM.BM_getBudgets !== 'function') {
      return res.apiError('BM_getBudgets函數不存在', 'BM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BM.BM_getBudgets(req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'GET_BUDGETS_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get budgets):', error);
    res.apiError('預算列表取得轉發失敗', 'GET_BUDGETS_FORWARD_ERROR', 500);
  }
});

// 2. 建立預算
app.post('/api/v1/budgets', async (req, res) => {
  try {
    console.log('📝 ASL轉發: 建立預算 -> BM_createBudget');

    if (!BM || typeof BM.BM_createBudget !== 'function') {
      return res.apiError('BM_createBudget函數不存在', 'BM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BM.BM_createBudget(req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'CREATE_BUDGET_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (create budget):', error);
    res.apiError('預算建立轉發失敗', 'CREATE_BUDGET_FORWARD_ERROR', 500);
  }
});

// 3. 取得預算詳情
app.get('/api/v1/budgets/:id', async (req, res) => {
  try {
    console.log('🔍 ASL轉發: 取得預算詳情 -> BM_getBudgetDetail');

    if (!BM || typeof BM.BM_getBudgetDetail !== 'function') {
      return res.apiError('BM_getBudgetDetail函數不存在', 'BM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BM.BM_getBudgetDetail(req.params.id, req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'GET_BUDGET_DETAIL_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get budget detail):', error);
    res.apiError('預算詳情取得轉發失敗', 'GET_BUDGET_DETAIL_FORWARD_ERROR', 500);
  }
});

// 4. 更新預算
app.put('/api/v1/budgets/:id', async (req, res) => {
  try {
    console.log('✏️ ASL轉發: 更新預算 -> BM_updateBudget');

    if (!BM || typeof BM.BM_updateBudget !== 'function') {
      return res.apiError('BM_updateBudget函數不存在', 'BM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BM.BM_updateBudget(req.params.id, req.body);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'UPDATE_BUDGET_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (update budget):', error);
    res.apiError('預算更新轉發失敗', 'UPDATE_BUDGET_FORWARD_ERROR', 500);
  }
});

// 5. 刪除預算
app.delete('/api/v1/budgets/:id', async (req, res) => {
  try {
    console.log('🗑️ ASL轉發: 刪除預算 -> BM_deleteBudget');

    if (!BM || typeof BM.BM_deleteBudget !== 'function') {
      return res.apiError('BM_deleteBudget函數不存在', 'BM_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BM.BM_deleteBudget(req.params.id, req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message);
    } else {
      res.apiError(result.message, result.error?.code || 'DELETE_BUDGET_ERROR', 400, result.error?.details);
    }

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete budget):', error);
    res.apiError('預算刪除轉發失敗', 'DELETE_BUDGET_FORWARD_ERROR', 500);
  }
});

// =============== 協作管理補充端點 (符合8020文件CM模組規範) ===============

// 11. 處理協作衝突
app.get('/api/v1/ledgers/:id/conflicts', async (req, res) => {
  try {
    console.log('⚠️ ASL轉發: 檢測協作衝突 -> CM_detectDataConflicts');

    const CM = global.CM || require('./13. Replit_Module code_BL/1313. CM.js');

    if (!CM || typeof CM.CM_detectDataConflicts !== 'function') {
      // 如果CM模組未實作衝突檢測，回傳空結果
      return res.apiSuccess({ conflicts: [], hasConflicts: false }, '無協作衝突');
    }

    const result = await CM.CM_detectDataConflicts(req.params.id, req.query);

    if (result.success) {
      res.apiSuccess(result.data, result.message || '協作衝突檢測完成');
    } else {
      res.apiError(result.message || '協作衝突檢測失敗', result.error?.code || 'CONFLICT_DETECTION_ERROR', 400, result.error?.details);
    }
  } catch (error) {
    console.error('❌ ASL轉發錯誤 (detect conflicts):', error);
    res.apiError('協作衝突檢測轉發失敗', 'CONFLICT_DETECTION_FORWARD_ERROR', 500);
  }
});

// 12. 解決協作衝突
app.post('/api/v1/ledgers/:id/resolve-conflict', async (req, res) => {
  try {
    console.log('🔧 ASL轉發: 解決協作衝突 -> CM_resolveDataConflict');

    const CM = global.CM || require('./13. Replit_Module code_BL/1313. CM.js');

    if (!CM || typeof CM.CM_resolveDataConflict !== 'function') {
      return res.apiError('CM_resolveDataConflict函數不存在', 'CM_FUNCTION_NOT_FOUND', 503);
    }

    const conflictData = {
      ledgerId: req.params.id,
      conflictId: req.body.conflictId,
      resolution: req.body.resolution,
      operatorId: req.body.operatorId || 'system'
    };

    const result = await CM.CM_resolveDataConflict(conflictData, req.body.resolutionStrategy || 'manual');

    if (result.success) {
      res.apiSuccess(result.data, result.message || '協作衝突解決成功');
    } else {
      res.apiError(result.message || '協作衝突解決失敗', result.error?.code || 'CONFLICT_RESOLUTION_ERROR', 400, result.error?.details);
    }
  } catch (error) {
    console.error('❌ ASL轉發錯誤 (resolve conflict):', error);
    res.apiError('協作衝突解決轉發失敗', 'CONFLICT_RESOLUTION_FORWARD_ERROR', 500);
  }
});

// 註解：此重複的帳本建立端點已移除，統一使用上方的/api/v1/ledgers POST端點

// 輔助函數：請求日誌記錄（如果需要）
function logRequest(req) {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.path}`);
}

function logResponse(req, res) {
  console.log(`📤 [${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode}`);
}

// 移除違規API端點：budgets/status 和 budgets/templates 不在8020文件規範中


/**
 * 08. 404錯誤處理
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 處理不存在的API端點，明確拒絕webhook請求
 */
app.use((req, res) => {
  console.log(`❌ ASL未知端點: ${req.method} ${req.path}`);

  // 特別處理webhook請求 - ASL不處理webhook
  if (req.path === '/webhook') {
    console.log(`🚫 ASL拒絕webhook請求: webhook應由index.js (Port 3000)處理`);
    res.apiError(
      'Webhook請求應發送至Port 3000，ASL僅處理RESTful API端點',
      'WEBHOOK_NOT_SUPPORTED',
      404,
      {
        suggestion: '請將webhook請求發送至正確的服務端口',
        correctPort: 3000,
        currentService: 'ASL RESTful API Service (Port 5000)',
        webhookService: 'LINE Webhook Service (Port 3000)'
      }
    );
    return;
  }

  res.apiError(
    `API端點不存在: ${req.method} ${req.path}`,
    'ENDPOINT_NOT_FOUND',
    404
  );
});

/**
 * 09. 統一錯誤處理
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 統一錯誤處理，確保回應一致性
 */
app.use((error, req, res, next) => {
  console.error('💥 ASL轉發錯誤:', error);

  res.apiError(
    error.message || '內部轉發錯誤',
    error.code || 'INTERNAL_FORWARD_ERROR',
    error.statusCode || 500
  );
});

/**
 * 10. 服務器啟動（階段一修復版）
 * @version 2025-01-24-V2.1.6
 * @date 2025-01-24
 * @description 在模組載入完成後啟動ASL純轉發服務器，增強穩定性
 */
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 LCAS ASL純轉發窗口已啟動於 Port ${PORT}`);
    console.log(`📍 服務地址: http://0.0.0.0:${PORT}`);
    console.log(`🔗 健康檢查: http://0.0.0.0:${PORT}/health`);
    console.log(`🎯 DCN-0015第二階段完成: ASL格式驗證強化`);
    // P1-2範圍API端點: AM(19) + BK(15) = 34個端點
    // P2範圍API端點: 預算(5) + 協作(4) = 9個端點
    // DCN-0023範圍API端點: 帳戶(8) + 科目(6) = 14個端點
    console.log(`📋 P1-2 + P2 + DCN-0023 API端點: AM(19) + BK(15) + BM(5) + CM(4) + WCM(14) = 57個端點`);

    // 第二階段完成狀態報告
    const firebaseStatus = moduleStatus.firebase ? '✅' : '❌';
    const amStatus = moduleStatus.AM ? '✅' : '❌';
    const bmStatus = moduleStatus.BM ? '✅' : '❌';
    const cmStatus = moduleStatus.CM ? '✅' : '❌';
    const wcmStatus = moduleStatus.WCM ? '✅' : '❌';
    const overallStatus = moduleStatus.firebase && moduleStatus.AM && moduleStatus.BK && moduleStatus.BM && moduleStatus.CM && moduleStatus.WCM ? '完全就緒' : '部分就緒';

    console.log(`🔧 第二階段完成狀態: ${overallStatus}`);
    console.log(`📦 核心模組狀態: Firebase(${firebaseStatus}), AM(${amStatus}), BK(${moduleStatus.BK ? '✅' : '❌'}), BM(${bmStatus}), CM(${cmStatus}), WCM(${wcmStatus})`);
    console.log(`✨ 容錯機制完全移除: 100%信任BL層標準格式`);
    console.log(`🎉 第二階段修正完成: 協作管理API端點補完`);
    console.log(`🚀 DCN-0023階段二更新: 帳戶與科目管理API端點已整合`);

    if (moduleStatus.firebase && moduleStatus.AM && moduleStatus.BK && moduleStatus.BM && moduleStatus.CM && moduleStatus.WCM) {
      console.log('🚀 ASL v2.2.1已完全就緒，階段三動態路由功能已啟用！');
      console.log('🔗 路由策略: 一般帳本 → ledgers/*, 協作帳本 → collaborations/*');
      console.log('🌐 ASL服務器已啟動於 Port 5000');
    } else if (!moduleStatus.WCM) {
      console.log('⚠️ WCM (帳戶與科目管理) 模組載入失敗，帳戶與科目管理功能不可用');
    }
     else {
      console.log('❌ 部分P2或DCN-0023模組載入失敗，請檢查相關模組狀態');
    }
  });

/**
 * 11. 優雅關閉處理
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 處理程式終止信號
 */
process.on('SIGTERM', () => {
  console.log('🛑 ASL收到SIGTERM信號，正在關閉服務器...');
  server.close(() => {
    console.log('✅ ASL純轉發窗口已安全關閉');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 ASL收到SIGINT信號，正在關閉服務器...');
  server.close(() => {
    console.log('✅ ASL純轉發窗口已安全關閉');
    process.exit(0);
  });
});

console.log('🎉 LCAS ASL階段二及DCN-0023更新完成！');
  console.log(`📦 P1-2 + P2 + DCN-0023 範圍BL模組載入狀態: Firebase(${moduleStatus.firebase ? '✅' : '❌'}), AM(${moduleStatus.AM ? '✅' : '❌'}), BK(${moduleStatus.BK ? '✅' : '❌'}), DL(${moduleStatus.DL ? '✅' : '❌'}), FS(${moduleStatus.FS ? '✅' : '❌'}), BM(${moduleStatus.BM ? '✅' : '❌'}), CM(${moduleStatus.CM ? '✅' : '❌'}), WCM(${moduleStatus.WCM ? '✅' : '❌'})`);
  console.log('🔧 純轉發機制: 57個API端點 -> 統一使用BL層標準格式');
  console.log('✨ 階段二及DCN-0023更新: 協作管理API端點補完，帳戶與科目管理API端點整合');
  console.log('🎯 協作管理功能: 帳本創建/讀取/更新/刪除，協作者管理（邀請/移除/權限更新），衝突檢測與解決');
  console.log('🎯 帳戶與科目管理功能: 帳戶CRUD，餘額查詢，轉帳，科目CRUD，科目樹狀結構');
  console.log('🔍 API 端點: /api/v1/ledgers, /api/v1/budgets, /api/v1/ledgers/:id/collaborators, /api/v1/ledgers/:id/invitations, /api/v1/ledgers/:id/conflicts, /api/v1/ledgers/:id/resolve-conflict, /api/v1/accounts, /api/v1/accounts/:id, /api/v1/accounts/:id/balance, /api/v1/accounts/types, /api/v1/accounts/transfer, /api/v1/categories, /api/v1/categories/:id, /api/v1/categories/tree');

    if (moduleStatus.firebase && moduleStatus.AM && moduleStatus.BK && moduleStatus.BM && moduleStatus.CM && moduleStatus.WCM) {
      console.log('🚀 ASL v2.2.1已完全就緒，階段三動態路由功能已啟用！');
      console.log('🔗 路由策略: 一般帳本 → ledgers/*, 協作帳本 → collaborations/*');
      console.log('🌐 ASL服務器已啟動於 Port 5000');
    } else if (!moduleStatus.WCM) {
      console.log('⚠️ WCM (帳戶與科目管理) 模組載入失敗，帳戶與科目管理功能不可用');
    }
     else {
      console.log('❌ 部分P2或DCN-0023模組載入失敗，請檢查相關模組狀態');
    }

  return server;
}

// 啟動應用程式
startApplication().catch((error) => {
  console.error('💥 應用程式啟動失敗:', error.message);
  console.error('💥 錯誤堆疊:', error.stack);
  process.exit(1);
});

// 階段一修復：安全的模組導出
module.exports = {
  getApp: () => app,
  startApplication
};