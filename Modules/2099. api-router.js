/**
 * API_Router_1.0.0
 * @module API路由器模組
 * @description LCAS 2.0 統一API路由管理器 - 整合所有業務模組的RESTful端點
 * @update 2025-01-23: 建立版本，實作統一路由管理和模組整合機制
 */

const express = require('express');
const authMiddleware = require('./auth-middleware.js');
const errorHandler = require('./error-handler.js');

// 引入業務模組
const AM = require('./2009. AM.js');
const BK = require('./2001. BK.js');
// TODO: 其他模組將在後續版本中加入
// const MLS = require('./2051. MLS.js');
// const BM = require('./2012. BM.js');
// const CM = require('./2013. CM.js');
// const MRA = require('./2041. MRA.js');
// const BS = require('./2014. BS.js');

/**
 * 01. 建立API路由器實例
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 建立Express路由器並設定基本中介軟體
 */
function createApiRouter() {
  const router = express.Router();

  // 設定JSON解析中介軟體
  router.use(express.json({ limit: '10mb' }));
  router.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 設定CORS支援
  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID, X-Timestamp');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // 設定請求日誌中介軟體
  router.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request ID: ${requestId}`);
    next();
  });

  return router;
}

/**
 * 02. 設定認證與帳戶管理路由
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 定義所有認證相關的API端點
 */
function setupAuthRoutes(router) {
  const authRouter = express.Router();

  // 無需認證的端點
  authRouter.post('/register', async (req, res, next) => {
    try {
      const { platform, userProfile, deviceInfo } = req.body;

      let result;
      if (platform === 'LINE') {
        result = await AM.AM_createLineAccount(
          userProfile.lineUID,
          userProfile,
          userProfile.userType || 'S'
        );
      } else {
        result = await AM.AM_createAppAccount(platform, userProfile, deviceInfo);
      }

      if (result.success) {
        res.status(201).json({
          status: 'success',
          code: 'ACCOUNT_CREATED',
          message: '帳號創建成功',
          data: {
            UID: result.UID || result.primaryUID,
            userType: result.userType,
            accountId: result.accountId || result.platformUID
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          status: 'error',
          code: result.errorCode,
          message: result.error,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/login', async (req, res, next) => {
    try {
      const { platform, credentials } = req.body;

      if (platform === 'LINE') {
        const result = await AM.AM_handleLineOAuth(
          credentials.authCode,
          credentials.state,
          credentials.redirectUri
        );

        if (result.success) {
          res.json({
            status: 'success',
            code: 'LOGIN_SUCCESS',
            message: '登入成功',
            data: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              userProfile: result.userProfile
            },
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(401).json({
            status: 'error',
            code: result.errorCode,
            message: result.error,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        res.status(400).json({
          status: 'error',
          code: 'UNSUPPORTED_PLATFORM',
          message: '不支援的平台',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/logout', authMiddleware.validateToken, async (req, res, next) => {
    try {
      // 實作登出邏輯
      res.json({
        status: 'success',
        code: 'LOGOUT_SUCCESS',
        message: '登出成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  authRouter.delete('/account', authMiddleware.validateToken, async (req, res, next) => {
    try {
      const { deactivationReason, transferData } = req.body;
      const result = await AM.AM_deactivateAccount(req.user.UID, deactivationReason, transferData);

      if (result.success) {
        res.json({
          status: 'success',
          code: 'ACCOUNT_DEACTIVATED',
          message: '帳號已停用',
          data: {
            backupId: result.backupId,
            transferredLedgers: result.transferredLedgers
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          status: 'error',
          code: result.errorCode,
          message: result.error,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/reset-password', async (req, res, next) => {
    try {
      // 實作密碼重設邏輯
      res.json({
        status: 'success',
        code: 'PASSWORD_RESET_SENT',
        message: '密碼重設郵件已發送',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  router.use('/auth', authRouter);
}

/**
 * 03. 設定基礎記帳功能路由
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 定義基礎記帳相關的API端點
 */
function setupLedgerRoutes(router) {
  const ledgerRouter = express.Router();

  // 所有記帳端點都需要認證
  ledgerRouter.use(authMiddleware.validateToken);

  ledgerRouter.post('/entry', async (req, res, next) => {
    try {
      const { amount, description, category, date } = req.body;

      // 呼叫BK模組的記帳功能
      const result = await BK.BK_processBookkeeping({
        userId: req.user.UID,
        amount,
        description,
        category,
        date: date || new Date(),
        platform: 'APP'
      });

      if (result.success) {
        res.status(201).json({
          status: 'success',
          code: 'ENTRY_CREATED',
          message: '記帳成功',
          data: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          status: 'error',
          code: result.errorCode || 'ENTRY_FAILED',
          message: result.error,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      next(error);
    }
  });

  ledgerRouter.get('/query', async (req, res, next) => {
    try {
      const { startDate, endDate, category, limit = 50 } = req.query;

      // 實作查詢邏輯（需要BK模組支援）
      const result = {
        success: true,
        data: {
          entries: [],
          total: 0,
          filters: { startDate, endDate, category }
        }
      };

      res.json({
        status: 'success',
        code: 'QUERY_SUCCESS',
        message: '查詢成功',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  router.use('/app/ledger', ledgerRouter);
}

/**
 * 04. 設定科目管理路由
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 定義科目代碼管理的API端點
 */
function setupSubjectsRoutes(router) {
  const subjectsRouter = express.Router();
  subjectsRouter.use(authMiddleware.validateToken);

  subjectsRouter.get('/list', async (req, res, next) => {
    try {
      const { category, active = true } = req.query;

      // 實作科目清單查詢邏輯
      const result = {
        success: true,
        data: {
          subjects: [],
          categories: [],
          total: 0
        }
      };

      res.json({
        status: 'success',
        code: 'SUBJECTS_RETRIEVED',
        message: '科目清單取得成功',
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  router.use('/app/subjects', subjectsRouter);
}

/**
 * 05. 設定使用者設定路由
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 定義使用者設定管理的API端點
 */
function setupUserRoutes(router) {
  const userRouter = express.Router();
  userRouter.use(authMiddleware.validateToken);

  userRouter.put('/settings', async (req, res, next) => {
    try {
      const updateData = req.body;
      const result = await AM.AM_updateAccountInfo(req.user.UID, updateData, req.user.UID);

      if (result.success) {
        res.json({
          status: 'success',
          code: 'SETTINGS_UPDATED',
          message: '設定更新成功',
          data: {
            updatedFields: result.updatedFields,
            syncStatus: result.syncStatus
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          status: 'error',
          code: result.errorCode,
          message: result.error,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      next(error);
    }
  });

  router.use('/app/user', userRouter);
}

/**
 * 06. 設定系統監控路由
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 定義系統健康監控的API端點
 */
function setupSystemRoutes(router) {
  const systemRouter = express.Router();

  systemRouter.get('/health/check', async (req, res, next) => {
    try {
      const healthStatus = await AM.AM_monitorSystemHealth();

      res.json({
        status: 'success',
        code: 'HEALTH_CHECK',
        message: '系統健康檢查完成',
        data: healthStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  router.use('/system', systemRouter);
}

/**
 * 07. 初始化完整API路由器
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 建立並配置完整的API路由器
 */
function initializeApiRouter() {
  const router = createApiRouter();

  // 設定所有路由群組
  setupAuthRoutes(router);
  setupLedgerRoutes(router);
  setupSubjectsRoutes(router);
  setupUserRoutes(router);
  setupSystemRoutes(router);

  // API版本資訊端點
  router.get('/version', (req, res) => {
    res.json({
      status: 'success',
      code: 'VERSION_INFO',
      message: 'API版本資訊',
      data: {
        version: '1.0.0',
        name: 'LCAS 2.0 API',
        modules: {
          'api-router': '1.0.0',
          'auth-middleware': '1.0.0',
          'error-handler': '1.0.0'
        },
        endpoints: {
          auth: 5,
          ledger: 2,
          subjects: 1,
          user: 1,
          system: 1
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // 設定全域錯誤處理
  router.use(errorHandler.handleApiError);

  return router;
}

// 導出模組
module.exports = {
  createApiRouter,
  setupAuthRoutes,
  setupLedgerRoutes,
  setupSubjectsRoutes,
  setupUserRoutes,
  setupSystemRoutes,
  initializeApiRouter
};

console.log('API Router 模組載入完成 v1.0.0');