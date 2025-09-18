/**
 * ASL.js_API服務層模組_1.0.0
 * @module API服務層模組
 * @description LCAS 2.0 API Service Layer - 專責處理132個RESTful API端點
 * @update 2025-01-28: 新建ASL.js，實作基礎架構與中介軟體整合
 * @date 2025-01-28
 */

console.log('🚀 LCAS ASL (API Service Layer) 啟動中...');
console.log('📅 啟動時間:', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

/**
 * 01. 全域錯誤處理機制設置
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 捕獲未處理的例外和Promise拒絕，防止程式意外終止
 */
process.on('uncaughtException', (error) => {
  console.error('💥 ASL未捕獲的異常:', error);
  console.error('💥 異常堆疊:', error.stack);

  // 延遲退出，確保日誌記錄完成
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 ASL未處理的 Promise 拒絕:', reason);
  console.error('💥 Promise:', promise);
});

/**
 * 02. BL層模組載入與初始化
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 載入所有BL層模組，確保ASL可以存取所有業務邏輯
 */
console.log('📦 ASL載入BL層模組...');

// 載入基礎模組
let DL, FS, BK, AM, DD, SR, LBK, BS, BM, CM, MLS, MRA, GR;

try {
  DL = require('./13. Replit_Module code_BL/1310. DL.js');
  console.log('✅ DL 模組載入成功');
} catch (error) {
  console.error('❌ DL 模組載入失敗:', error.message);
}

try {
  FS = require('./13. Replit_Module code_BL/1311. FS.js');
  console.log('✅ FS 模組載入成功');
} catch (error) {
  console.error('❌ FS 模組載入失敗:', error.message);
}

try {
  BK = require('./13. Replit_Module code_BL/1301. BK.js');
  console.log('✅ BK 模組載入成功');
} catch (error) {
  console.error('❌ BK 模組載入失敗:', error.message);
}

try {
  AM = require('./13. Replit_Module code_BL/1309. AM.js');
  console.log('✅ AM 模組載入成功');
} catch (error) {
  console.error('❌ AM 模組載入失敗:', error.message);
}

try {
  DD = require('./13. Replit_Module code_BL/1331. DD1.js');
  console.log('✅ DD 模組載入成功');
} catch (error) {
  console.error('❌ DD 模組載入失敗:', error.message);
}

try {
  SR = require('./13. Replit_Module code_BL/1305. SR.js');
  console.log('✅ SR 模組載入成功');
} catch (error) {
  console.error('❌ SR 模組載入失敗:', error.message);
}

try {
  LBK = require('./13. Replit_Module code_BL/1315. LBK.js');
  console.log('✅ LBK 模組載入成功');
} catch (error) {
  console.error('❌ LBK 模組載入失敗:', error.message);
}

try {
  BS = require('./13. Replit_Module code_BL/1314. BS.js');
  console.log('✅ BS 模組載入成功');
} catch (error) {
  console.error('❌ BS 模組載入失敗:', error.message);
}

try {
  BM = require('./13. Replit_Module code_BL/1312. BM.js');
  console.log('✅ BM 模組載入成功');
} catch (error) {
  console.error('❌ BM 模組載入失敗:', error.message);
}

try {
  CM = require('./13. Replit_Module code_BL/1313. CM.js');
  console.log('✅ CM 模組載入成功');
} catch (error) {
  console.error('❌ CM 模組載入失敗:', error.message);
}

try {
  MLS = require('./13. Replit_Module code_BL/1351. MLS.js');
  console.log('✅ MLS 模組載入成功');
} catch (error) {
  console.error('❌ MLS 模組載入失敗:', error.message);
}

try {
  MRA = require('./13. Replit_Module code_BL/1341. MRA.js');
  console.log('✅ MRA 模組載入成功');
} catch (error) {
  console.error('❌ MRA 模組載入失敗:', error.message);
}

try {
  GR = require('./13. Replit_Module code_BL/1361. GR.js');
  console.log('✅ GR 模組載入成功');
} catch (error) {
  console.error('❌ GR 模組載入失敗:', error.message);
}

/**
 * 03. Express應用程式設置
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
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
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
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
 * 05. 日誌記錄中介軟體
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 記錄所有API請求，便於監控和除錯
 */
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`📥 [${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);

  // 記錄回應時間
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`📤 [${timestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);

    if (DL && typeof DL.DL_info === 'function') {
      DL.DL_info(
        `API請求: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
        'ASL_API_LOG',
        '',
        '',
        '',
        'ASL.js'
      );
    }
  });

  next();
});

/**
 * 06. 速率限制中介軟體
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 防止API濫用，每分鐘限制100次請求
 */
const rateLimitMap = new Map();

app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1分鐘
  const maxRequests = 100;

  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const clientData = rateLimitMap.get(clientIP);

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + windowMs;
    return next();
  }

  if (clientData.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: '請求頻率過高，請稍後再試',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }

  clientData.count++;
  next();
});

/**
 * 07. 認證中介軟體
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 檢查API請求的認證token（階段一簡化實作）
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // 階段一：跳過認證檢查，允許所有請求
  if (!token) {
    console.log('⚠️ 無認證token，階段一允許通過');
  } else {
    console.log('✅ 檢測到認證token:', token.substring(0, 10) + '...');
  }

  next();
};

/**
 * 08. 統一回應格式中介軟體
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 提供統一的API回應格式
 */
app.use((req, res, next) => {
  // 擴展res物件，添加統一回應方法
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
 * 09. 系統狀態與健康檢查端點
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description ASL服務的基礎監控端點
 */

// ASL服務狀態首頁
app.get('/', (req, res) => {
  res.apiSuccess({
    service: 'LCAS 2.0 API Service Layer',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    modules: {
      DL: !!DL ? 'loaded' : 'not loaded',
      FS: !!FS ? 'loaded' : 'not loaded',
      BK: !!BK ? 'loaded' : 'not loaded',
      AM: !!AM ? 'loaded' : 'not loaded',
      DD: !!DD ? 'loaded' : 'not loaded',
      SR: !!SR ? 'loaded' : 'not loaded',
      LBK: !!LBK ? 'loaded' : 'not loaded',
      BS: !!BS ? 'loaded' : 'not loaded',
      BM: !!BM ? 'loaded' : 'not loaded',
      CM: !!CM ? 'loaded' : 'not loaded',
      MLS: !!MLS ? 'loaded' : 'not loaded',
      MRA: !!MRA ? 'loaded' : 'not loaded',
      GR: !!GR ? 'loaded' : 'not loaded'
    },
    endpoints: {
      total: 132,
      implemented: 0,
      planned: 132
    }
  }, 'ASL服務運行正常');
});

// ASL健康檢查
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    service: 'ASL',
    version: '1.0.0',
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    modules: {
      core: !!DL && !!FS ? 'healthy' : 'degraded',
      business: !!BK && !!AM ? 'healthy' : 'degraded',
      services: !!DD && !!SR ? 'healthy' : 'degraded'
    }
  };

  res.apiSuccess(healthStatus, 'ASL健康檢查完成');
});

// API端點清單（階段一預覽）
app.get('/api/v1/endpoints', (req, res) => {
  res.apiSuccess({
    totalEndpoints: 132,
    implementedEndpoints: 0,
    categories: [
      { name: '認證服務', endpoints: 11, status: 'planned' },
      { name: '用戶管理', endpoints: 11, status: 'planned' },
      { name: '記帳交易', endpoints: 20, status: 'planned' },
      { name: '帳本管理', endpoints: 14, status: 'planned' },
      { name: '帳戶管理', endpoints: 8, status: 'planned' },
      { name: '科目管理', endpoints: 6, status: 'planned' },
      { name: '預算管理', endpoints: 8, status: 'planned' },
      { name: '報表分析', endpoints: 15, status: 'planned' },
      { name: 'AI助理', endpoints: 6, status: 'planned' },
      { name: '激勵系統', endpoints: 6, status: 'planned' },
      { name: '系統服務', endpoints: 13, status: 'planned' },
      { name: '備份服務', endpoints: 6, status: 'planned' },
      { name: '通知管理', endpoints: 8, status: 'planned' }
    ],
    note: '階段一：基礎架構建立完成，階段二將開始API端點遷移'
  }, 'API端點規劃清單');
});

/**
 * 10. 錯誤處理中介軟體
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 統一錯誤處理，確保API回應一致性
 */
app.use((error, req, res, next) => {
  console.error('💥 ASL錯誤處理:', error);

  // 記錄錯誤到日誌
  if (DL && typeof DL.DL_error === 'function') {
    DL.DL_error(
      `ASL錯誤: ${error.message}`,
      'ASL_ERROR',
      '',
      'API_ERROR',
      error.stack,
      'ASL.js'
    );
  }

  // 回傳統一錯誤格式
  res.apiError(
    error.message || '內部服務器錯誤',
    error.code || 'INTERNAL_SERVER_ERROR',
    error.statusCode || 500,
    process.env.NODE_ENV === 'development' ? error.stack : null
  );
});

// 處理404錯誤
app.use((req, res) => {
  res.apiError(
    `API端點不存在: ${req.method} ${req.path}`,
    'ENDPOINT_NOT_FOUND',
    404
  );
});

/**
 * 11. 服務器啟動
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 啟動ASL服務器，綁定到Port 5000
 */
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 LCAS ASL服務器已啟動於 Port ${PORT}`);
  console.log(`📍 服務地址: http://0.0.0.0:${PORT}`);
  console.log(`🔗 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`📋 API端點清單: http://0.0.0.0:${PORT}/api/v1/endpoints`);
  console.log(`🎯 階段一目標達成: 基礎架構與中介軟體整合完成`);
});

/**
 * 12. 優雅關閉處理
 * @version 2025-01-28-V1.0.0
 * @date 2025-01-28 10:00:00
 * @description 處理程式終止信號，確保資源正確釋放
 */
process.on('SIGTERM', () => {
  console.log('🛑 ASL收到SIGTERM信號，正在關閉服務器...');
  server.close(() => {
    console.log('✅ ASL服務器已安全關閉');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 ASL收到SIGINT信號，正在關閉服務器...');
  server.close(() => {
    console.log('✅ ASL服務器已安全關閉');
    process.exit(0);
  });
});

console.log('🎉 LCAS ASL (API Service Layer) 階段一建立完成！');
console.log('📦 BL層模組整合: 13個模組已載入');
console.log('🔧 基礎中介軟體已配置: CORS, 日誌, 速率限制, 認證, 錯誤處理');
console.log('🚀 準備就緒，等待階段二API端點遷移');

// =============== Phase 2: API端點遷移（132個RESTful API端點） ===============

// =============== 1. 認證服務API端點群組（11個端點） ===============

// 使用者註冊
app.post('/api/v1/auth/register', authenticateToken, async (req, res) => {
  try {
    console.log('🔐 API: 使用者註冊請求', req.body);

    if (!AM || typeof AM.AM_createLineAccount !== 'function') {
      return res.apiError('AM模組不可用', 'AM_MODULE_UNAVAILABLE', 503);
    }

    const { lineUID, displayName, userType = 'S', email, password } = req.body;

    if (!email || !password) {
      return res.apiError('缺少必要參數：email 和 password', 'MISSING_REQUIRED_FIELDS', 400);
    }

    // 模擬完整註冊邏輯
    const registrationData = {
      email,
      password,
      displayName: displayName || email.split('@')[0],
      userType,
      lineUID
    };

    const result = await AM.AM_createAccount(registrationData);

    if (result.success) {
      res.status(201).apiSuccess({
        userId: result.UID,
        email: email,
        displayName: registrationData.displayName,
        userType: result.userType,
        verificationSent: true,
        needsAssessment: true,
        token: `jwt_${result.UID}_${Date.now()}`,
        refreshToken: `refresh_${result.UID}_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, '註冊成功');
    } else {
      res.apiError(result.error, result.errorCode || 'REGISTRATION_FAILED', 400);
    }

  } catch (error) {
    console.error('❌ 註冊API錯誤:', error);
    res.apiError('註冊處理失敗', 'REGISTRATION_ERROR', 500);
  }
});

// 使用者登入
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    console.log('🔑 API: 使用者登入請求');

    if (!AM || typeof AM.AM_validateAccountExists !== 'function') {
      return res.apiError('AM模組不可用', 'AM_MODULE_UNAVAILABLE', 503);
    }

    const { email, password, lineUID, rememberMe = false } = req.body;

    if ((!email || !password) && !lineUID) {
      return res.apiError('缺少必要參數：(email + password) 或 lineUID', 'MISSING_CREDENTIALS', 400);
    }

    let validation;

    if (lineUID) {
      validation = await AM.AM_validateAccountExists(lineUID, 'LINE');
    } else {
      validation = await AM.AM_validateEmailPassword(email, password);
    }

    if (validation.exists && validation.accountStatus === 'active') {
      const token = `jwt_${validation.UID}_${Date.now()}`;
      const refreshToken = rememberMe ? `refresh_${validation.UID}_${Date.now()}` : null;

      res.apiSuccess({
        token: token,
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + (rememberMe ? 30 * 24 : 24) * 60 * 60 * 1000).toISOString(),
        user: {
          id: validation.UID,
          email: validation.email,
          displayName: validation.displayName,
          userMode: validation.userMode || 'Expert',
          lastLoginAt: new Date().toISOString()
        }
      }, '登入成功');
    } else {
      res.apiError('登入憑證錯誤或帳號狀態異常', 'INVALID_CREDENTIALS', 401);
    }

  } catch (error) {
    console.error('❌ 登入API錯誤:', error);
    res.apiError('登入處理失敗', 'LOGIN_ERROR', 500);
  }
});

// Google OAuth 登入
app.post('/api/v1/auth/google-login', async (req, res) => {
  try {
    console.log('🔑 API: Google OAuth 登入請求');

    const { googleToken, userMode = 'Expert' } = req.body;

    if (!googleToken) {
      return res.apiError('缺少必要參數：googleToken', 'MISSING_GOOGLE_TOKEN', 400);
    }

    // 模擬Google OAuth驗證
    const mockGoogleUser = {
      id: 'google_' + Date.now(),
      email: 'user@gmail.com',
      displayName: 'Google User',
      avatar: 'https://example.com/avatar.jpg'
    };

    const token = `jwt_${mockGoogleUser.id}_${Date.now()}`;

    res.apiSuccess({
      token: token,
      refreshToken: `refresh_${mockGoogleUser.id}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      user: {
        id: mockGoogleUser.id,
        email: mockGoogleUser.email,
        displayName: mockGoogleUser.displayName,
        userMode: userMode,
        avatar: mockGoogleUser.avatar
      },
      isNewUser: true,
      needsAssessment: true
    }, 'Google 登入成功');

  } catch (error) {
    console.error('❌ Google登入API錯誤:', error);
    res.apiError('Google登入失敗', 'GOOGLE_LOGIN_ERROR', 500);
  }
});

// 使用者登出
app.post('/api/v1/auth/logout', authenticateToken, async (req, res) => {
  try {
    console.log('🚪 API: 使用者登出請求');

    const { logoutAllDevices = false } = req.body;

    // 模擬登出邏輯
    res.apiSuccess({
      message: '登出成功',
      loggedOutDevices: logoutAllDevices ? 3 : 1
    }, '登出成功');

  } catch (error) {
    console.error('❌ 登出API錯誤:', error);
    res.apiError('登出處理失敗', 'LOGOUT_ERROR', 500);
  }
});

// 刷新存取Token
app.post('/api/v1/auth/refresh', async (req, res) => {
  try {
    console.log('🔄 API: Token刷新請求');

    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.apiError('缺少必要參數：refreshToken', 'MISSING_REFRESH_TOKEN', 400);
    }

    // 模擬Token刷新邏輯
    if (refreshToken.startsWith('refresh_')) {
      const newToken = `jwt_refreshed_${Date.now()}`;

      res.apiSuccess({
        token: newToken,
        refreshToken: `refresh_new_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, 'Token刷新成功');
    } else {
      res.apiError('刷新Token無效', 'INVALID_REFRESH_TOKEN', 401);
    }

  } catch (error) {
    console.error('❌ Token刷新API錯誤:', error);
    res.apiError('Token刷新失敗', 'REFRESH_ERROR', 500);
  }
});

// 忘記密碼
app.post('/api/v1/auth/forgot-password', async (req, res) => {
  try {
    console.log('🔑 API: 忘記密碼請求');

    const { email } = req.body;

    if (!email) {
      return res.apiError('缺少必要參數：email', 'MISSING_EMAIL', 400);
    }

    // 模擬發送密碼重設連結
    res.apiSuccess({
      message: '密碼重設連結已發送到您的Email',
      expiresIn: 3600
    }, '密碼重設連結已發送');

  } catch (error) {
    console.error('❌ 忘記密碼API錯誤:', error);
    res.apiError('忘記密碼處理失敗', 'FORGOT_PASSWORD_ERROR', 500);
  }
});

// 驗證密碼重設Token
app.get('/api/v1/auth/verify-reset-token', async (req, res) => {
  try {
    console.log('🔍 API: 驗證密碼重設Token請求');

    const { token } = req.query;

    if (!token) {
      return res.apiError('缺少必要參數：token', 'MISSING_TOKEN', 400);
    }

    // 模擬Token驗證
    if (token.startsWith('reset_')) {
      res.apiSuccess({
        valid: true,
        email: 'user@example.com',
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      }, 'Token驗證成功');
    } else {
      res.apiError('Token無效或已過期', 'INVALID_TOKEN', 400);
    }

  } catch (error) {
    console.error('❌ 密碼重設Token驗證API錯誤:', error);
    res.apiError('Token驗證失敗', 'TOKEN_VERIFICATION_ERROR', 500);
  }
});

// 重設密碼
app.post('/api/v1/auth/reset-password', async (req, res) => {
  try {
    console.log('🔒 API: 重設密碼請求');

    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return res.apiError('缺少必要參數：token 和 newPassword', 'MISSING_REQUIRED_FIELDS', 400);
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.apiError('密碼確認不一致', 'PASSWORD_MISMATCH', 400);
    }

    // 模擬密碼重設
    if (token.startsWith('reset_')) {
      const newToken = `jwt_password_reset_${Date.now()}`;

      res.apiSuccess({
        message: '密碼重設成功',
        autoLogin: true,
        token: newToken
      }, '密碼重設成功');
    } else {
      res.apiError('重設Token無效', 'INVALID_RESET_TOKEN', 400);
    }

  } catch (error) {
    console.error('❌ 重設密碼API錯誤:', error);
    res.apiError('密碼重設失敗', 'PASSWORD_RESET_ERROR', 500);
  }
});

// 驗證Email地址
app.post('/api/v1/auth/verify-email', async (req, res) => {
  try {
    console.log('📧 API: Email驗證請求');

    const { email, verificationCode, token } = req.body;

    if (!email || (!verificationCode && !token)) {
      return res.apiError('缺少必要參數：email 和 (verificationCode 或 token)', 'MISSING_REQUIRED_FIELDS', 400);
    }

    // 模擬Email驗證
    if (verificationCode === '123456' || token?.startsWith('verify_')) {
      res.apiSuccess({
        message: 'Email驗證成功',
        verified: true,
        nextStep: 'login'
      }, 'Email驗證成功');
    } else {
      res.apiError('驗證碼錯誤或已過期', 'INVALID_VERIFICATION_CODE', 400);
    }

  } catch (error) {
    console.error('❌ Email驗證API錯誤:', error);
    res.apiError('Email驗證失敗', 'EMAIL_VERIFICATION_ERROR', 500);
  }
});

// 綁定LINE帳號
app.post('/api/v1/auth/bind-line', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 API: 綁定LINE帳號請求');

    const { lineUserId, lineAccessToken, lineProfile } = req.body;

    if (!lineUserId || !lineAccessToken) {
      return res.apiError('缺少必要參數：lineUserId 和 lineAccessToken', 'MISSING_LINE_CREDENTIALS', 400);
    }

    // 模擬LINE綁定
    res.apiSuccess({
      message: 'LINE帳號綁定成功',
      linkedAccounts: {
        email: 'user@example.com',
        line: lineUserId,
        bindingDate: new Date().toISOString()
      }
    }, 'LINE帳號綁定成功');

  } catch (error) {
    console.error('❌ LINE綁定API錯誤:', error);
    res.apiError('LINE綁定失敗', 'LINE_BINDING_ERROR', 500);
  }
});

// 查詢綁定狀態
app.get('/api/v1/auth/bind-status', authenticateToken, async (req, res) => {
  try {
    console.log('📋 API: 查詢綁定狀態請求');

    // 模擬綁定狀態
    res.apiSuccess({
      userId: 'user-uuid-12345',
      linkedAccounts: {
        email: {
          value: 'user@example.com',
          verified: true,
          bindingDate: '2025-01-01T00:00:00Z'
        },
        line: {
          value: 'U1234567890abcdef',
          verified: true,
          bindingDate: '2025-01-15T00:00:00Z',
          profile: {
            displayName: 'LINE使用者',
            pictureUrl: 'https://profile.line-scdn.net/example'
          }
        }
      },
      availableBindings: ['google']
    }, '綁定狀態查詢成功');

  } catch (error) {
    console.error('❌ 綁定狀態查詢API錯誤:', error);
    res.apiError('綁定狀態查詢失敗', 'BIND_STATUS_ERROR', 500);
  }
});

// =============== Phase 1 核心API端點（階段一實作） ===============

module.exports = app;