/**
 * ASL.js_API服務層模組_2.0.0
 * @module API服務層模組（純轉發窗口）
 * @description LCAS 2.0 API Service Layer - 專責轉發P1-2範圍的26個API端點到BL層
 * @update 2025-09-22: DCN-0012階段一重構，轉換為純轉發窗口
 * @date 2025-09-22
 */

console.log('🚀 LCAS ASL (API Service Layer) P1-2重構版啟動中...');
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
 * 02. BL層模組載入（P1-2範圍）
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 載入P1-2階段所需的BL層模組
 */
console.log('📦 ASL載入P1-2範圍BL層模組...');

let AM, BK, DL, FS;

try {
  AM = require('./13. Replit_Module code_BL/1309. AM.js');
  console.log('✅ AM (認證管理) 模組載入成功');
} catch (error) {
  console.error('❌ AM 模組載入失敗:', error.message);
}

try {
  BK = require('./13. Replit_Module code_BL/1301. BK.js');
  console.log('✅ BK (記帳核心) 模組載入成功');
} catch (error) {
  console.error('❌ BK 模組載入失敗:', error.message);
}

try {
  DL = require('./13. Replit_Module code_BL/1310. DL.js');
  console.log('✅ DL (診斷日誌) 模組載入成功');
} catch (error) {
  console.error('❌ DL 模組載入失敗:', error.message);
}

try {
  FS = require('./13. Replit_Module code_BL/1311. FS.js');
  console.log('✅ FS (Firestore) 模組載入成功');
} catch (error) {
  console.error('❌ FS 模組載入失敗:', error.message);
}

/**
 * 03. Express應用程式設置
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 建立Express服務器，設定基礎中介軟體
 */
const express = require('express');
const app = express();
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
 * 05. 統一轉發回應格式中介軟體
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 提供統一的轉發回應格式
 */
app.use((req, res, next) => {
  res.apiSuccess = (data, message = '操作成功', statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      data: data,
      message: message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  };

  res.apiError = (message = '操作失敗', errorCode = 'UNKNOWN_ERROR', statusCode = 400, details = null) => {
    res.status(statusCode).json({
      success: false,
      message: message,
      errorCode: errorCode,
      details: details,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
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
    service: 'LCAS 2.0 API Service Layer (純轉發窗口)',
    version: '2.0.0',
    status: 'running',
    port: PORT,
    architecture: 'ASL -> BL層轉發',
    p1_2_endpoints: {
      am_auth: 11,
      bk_transaction: 15,
      total: 26
    },
    modules: {
      AM: !!AM ? 'loaded' : 'not loaded',
      BK: !!BK ? 'loaded' : 'not loaded',
      DL: !!DL ? 'loaded' : 'not loaded',
      FS: !!FS ? 'loaded' : 'not loaded'
    }
  }, 'ASL純轉發窗口運行正常');
});

app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    service: 'ASL純轉發窗口',
    version: '2.0.0',
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    bl_modules: {
      AM: !!AM ? 'ready' : 'unavailable',
      BK: !!BK ? 'ready' : 'unavailable'
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
    res.apiSuccess(result.data, result.message || '註冊處理完成');

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
    res.apiSuccess(result.data, result.message || '登入處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (login):', error);
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
    res.apiSuccess(result.data, result.message || 'Google登入處理完成');

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
    res.apiSuccess(result.data, result.message || '登出處理完成');

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
    res.apiSuccess(result.data, result.message || 'Token刷新處理完成');

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
    res.apiSuccess(result.data, result.message || '忘記密碼處理完成');

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
    res.apiSuccess(result.data, result.message || '重設Token驗證處理完成');

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
    res.apiSuccess(result.data, result.message || '重設密碼處理完成');

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
    res.apiSuccess(result.data, result.message || 'Email驗證處理完成');

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
    res.apiSuccess(result.data, result.message || 'LINE綁定處理完成');

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
    res.apiSuccess(result.data, result.message || '綁定狀態查詢處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (bind-status):', error);
    res.apiError('綁定狀態查詢轉發失敗', 'BIND_STATUS_FORWARD_ERROR', 500);
  }
});

// =============== BK.js 記帳交易API轉發（15個端點） ===============

// 1. 新增交易記錄
app.post('/api/v1/transactions', async (req, res) => {
  try {
    console.log('💰 ASL轉發: 新增交易 -> BK_processAPITransaction');

    if (!BK || typeof BK.BK_processAPITransaction !== 'function') {
      return res.apiError('BK_processAPITransaction函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPITransaction(req.body);
    res.apiSuccess(result.data, result.message || '交易新增處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (transactions):', error);
    res.apiError('交易新增轉發失敗', 'TRANSACTION_FORWARD_ERROR', 500);
  }
});

// 2. 快速記帳
app.post('/api/v1/transactions/quick', async (req, res) => {
  try {
    console.log('⚡ ASL轉發: 快速記帳 -> BK_processAPIQuickTransaction');

    if (!BK || typeof BK.BK_processAPIQuickTransaction !== 'function') {
      return res.apiError('BK_processAPIQuickTransaction函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIQuickTransaction(req.body);
    res.apiSuccess(result.data, result.message || '快速記帳處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (quick):', error);
    res.apiError('快速記帳轉發失敗', 'QUICK_TRANSACTION_FORWARD_ERROR', 500);
  }
});

// 3. 查詢交易記錄
app.get('/api/v1/transactions', async (req, res) => {
  try {
    console.log('📋 ASL轉發: 查詢交易 -> BK_processAPIGetTransactions');

    if (!BK || typeof BK.BK_processAPIGetTransactions !== 'function') {
      return res.apiError('BK_processAPIGetTransactions函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetTransactions(req.query);
    res.apiSuccess(result.data, result.message || '交易查詢處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (get transactions):', error);
    res.apiError('交易查詢轉發失敗', 'GET_TRANSACTIONS_FORWARD_ERROR', 500);
  }
});

// 4. 取得交易詳情
app.get('/api/v1/transactions/:id', async (req, res) => {
  try {
    console.log('🔍 ASL轉發: 交易詳情 -> BK_processAPIGetTransactionDetail');

    if (!BK || typeof BK.BK_processAPIGetTransactionDetail !== 'function') {
      return res.apiError('BK_processAPIGetTransactionDetail函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetTransactionDetail({ id: req.params.id, ...req.query });
    res.apiSuccess(result.data, result.message || '交易詳情處理完成');

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

    const result = await BK.BK_processAPIUpdateTransaction({ id: req.params.id, ...req.body });
    res.apiSuccess(result.data, result.message || '交易更新處理完成');

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

    const result = await BK.BK_processAPIDeleteTransaction({ id: req.params.id });
    res.apiSuccess(result.data, result.message || '交易刪除處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete transaction):', error);
    res.apiError('交易刪除轉發失敗', 'DELETE_TRANSACTION_FORWARD_ERROR', 500);
  }
});

// 7. 儀表板數據
app.get('/api/v1/transactions/dashboard', async (req, res) => {
  try {
    console.log('📊 ASL轉發: 儀表板數據 -> BK_processAPIGetDashboard');

    if (!BK || typeof BK.BK_processAPIGetDashboard !== 'function') {
      return res.apiError('BK_processAPIGetDashboard函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetDashboard(req.query);
    res.apiSuccess(result.data, result.message || '儀表板數據處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (dashboard):', error);
    res.apiError('儀表板數據轉發失敗', 'DASHBOARD_FORWARD_ERROR', 500);
  }
});

// 8. 統計數據
app.get('/api/v1/transactions/statistics', async (req, res) => {
  try {
    console.log('📈 ASL轉發: 統計數據 -> BK_processAPIGetStatistics');

    if (!BK || typeof BK.BK_processAPIGetStatistics !== 'function') {
      return res.apiError('BK_processAPIGetStatistics函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetStatistics(req.query);
    res.apiSuccess(result.data, result.message || '統計數據處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (statistics):', error);
    res.apiError('統計數據轉發失敗', 'STATISTICS_FORWARD_ERROR', 500);
  }
});

// 9. 最近交易
app.get('/api/v1/transactions/recent', async (req, res) => {
  try {
    console.log('🕒 ASL轉發: 最近交易 -> BK_processAPIGetRecent');

    if (!BK || typeof BK.BK_processAPIGetRecent !== 'function') {
      return res.apiError('BK_processAPIGetRecent函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetRecent(req.query);
    res.apiSuccess(result.data, result.message || '最近交易處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (recent):', error);
    res.apiError('最近交易轉發失敗', 'RECENT_FORWARD_ERROR', 500);
  }
});

// 10. 圖表數據
app.get('/api/v1/transactions/charts', async (req, res) => {
  try {
    console.log('📊 ASL轉發: 圖表數據 -> BK_processAPIGetCharts');

    if (!BK || typeof BK.BK_processAPIGetCharts !== 'function') {
      return res.apiError('BK_processAPIGetCharts函數不存在', 'BK_FUNCTION_NOT_FOUND', 503);
    }

    const result = await BK.BK_processAPIGetCharts(req.query);
    res.apiSuccess(result.data, result.message || '圖表數據處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (charts):', error);
    res.apiError('圖表數據轉發失敗', 'CHARTS_FORWARD_ERROR', 500);
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
    res.apiSuccess(result.data, result.message || '批量新增處理完成');

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
    res.apiSuccess(result.data, result.message || '批量更新處理完成');

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
    res.apiSuccess(result.data, result.message || '批量刪除處理完成');

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
    res.apiSuccess(result.data, result.message || '附件上傳處理完成');

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
    res.apiSuccess(result.data, result.message || '附件刪除處理完成');

  } catch (error) {
    console.error('❌ ASL轉發錯誤 (delete attachment):', error);
    res.apiError('附件刪除轉發失敗', 'DELETE_ATTACHMENT_FORWARD_ERROR', 500);
  }
});

/**
 * 08. 404錯誤處理
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 處理不存在的API端點
 */
app.use((req, res) => {
  console.log(`❌ ASL未知端點: ${req.method} ${req.path}`);
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
 * 10. 服務器啟動
 * @version 2025-09-22-V2.0.0
 * @date 2025-09-22 10:00:00
 * @description 啟動ASL純轉發服務器
 */
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 LCAS ASL純轉發窗口已啟動於 Port ${PORT}`);
  console.log(`📍 服務地址: http://0.0.0.0:${PORT}`);
  console.log(`🔗 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`🎯 DCN-0012階段一完成: ASL純轉發窗口`);
  console.log(`📋 P1-2 API端點: AM(11) + BK(15) = 26個端點`);
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

console.log('🎉 LCAS ASL純轉發窗口階段一重構完成！');
console.log('📦 P1-2範圍BL模組: AM, BK, DL, FS已載入');
console.log('🔧 純轉發機制: 26個API端點 -> BL層函數調用');
console.log('🚀 準備就緒，等待階段二BL層函數實作');

module.exports = app;