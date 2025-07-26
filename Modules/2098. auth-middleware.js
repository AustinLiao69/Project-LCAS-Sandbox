/**
 * Auth_Middleware_1.0.0
 * @module 認證中介軟體模組
 * @description LCAS 2.0 統一認證驗證機制 - 處理JWT token驗證和權限控制
 * @update 2025-07-26: 建立版本，實作統一認證中介軟體和權限管理
 */

const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const AM = require('./2009. AM.js');
const DL = require('./2010. DL.js');

// 取得環境變數
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * 01. JWT Token驗證中介軟體
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 驗證並解析JWT token，設定用戶資訊到request物件
 */
async function validateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        code: 'MISSING_TOKEN',
        message: '缺少認證token',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.substring(7); // 移除 'Bearer ' 前綴

    // 嘗試驗證JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      // 檢查token是否過期
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        return res.status(401).json({
          status: 'error',
          code: 'TOKEN_EXPIRED',
          message: 'Token已過期',
          timestamp: new Date().toISOString()
        });
      }

      // 驗證用戶是否存在且有效
      const userExists = await AM.AM_validateAccountExists(decoded.UID, decoded.platform || 'APP');

      if (!userExists.exists || userExists.accountStatus !== 'active') {
        return res.status(401).json({
          status: 'error',
          code: 'INVALID_USER',
          message: '用戶不存在或已停用',
          timestamp: new Date().toISOString()
        });
      }

      // 設定用戶資訊到request物件
      req.user = {
        UID: decoded.UID,
        userType: decoded.userType,
        platform: decoded.platform,
        tokenIssuedAt: decoded.iat,
        tokenExpiresAt: decoded.exp
      };

      // 記錄認證成功日誌
      await DL.DL_info('AUTH', 'validateToken', `Token驗證成功: ${decoded.UID}`, decoded.UID);

      next();

    } catch (jwtError) {
      // JWT驗證失敗，嘗試Firebase Token驗證
      if (jwtError.name === 'JsonWebTokenError' || jwtError.name === 'TokenExpiredError') {
        return await validateFirebaseToken(req, res, next, token);
      }

      throw jwtError;
    }

  } catch (error) {
    await DL.DL_error('AUTH', 'validateToken', error.message, '');

    return res.status(401).json({
      status: 'error',
      code: 'TOKEN_VALIDATION_FAILED',
      message: 'Token驗證失敗',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 02. Firebase Token驗證
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 驗證Firebase Authentication token
 */
async function validateFirebaseToken(req, res, next, token) {
  try {
    // 驗證Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);

    const userExists = await AM.AM_validateAccountExists(decodedToken.uid, 'FIREBASE');

    if (!userExists.exists || userExists.accountStatus !== 'active') {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_FIREBASE_USER',
        message: 'Firebase用戶不存在或已停用',
        timestamp: new Date().toISOString()
      });
    }

    // 設定Firebase用戶資訊
    req.user = {
      UID: decodedToken.uid,
      email: decodedToken.email,
      platform: 'FIREBASE',
      firebaseToken: true,
      tokenIssuedAt: decodedToken.iat,
      tokenExpiresAt: decodedToken.exp
    };

    await DL.DL_info('AUTH', 'validateFirebaseToken', `Firebase Token驗證成功: ${decodedToken.uid}`, decodedToken.uid);

    next();

  } catch (firebaseError) {
    await DL.DL_error('AUTH', 'validateFirebaseToken', firebaseError.message, '');

    return res.status(401).json({
      status: 'error',
      code: 'FIREBASE_TOKEN_INVALID',
      message: 'Firebase token無效',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 03. 權限檢查中介軟體
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 檢查用戶是否有特定操作權限
 */
function requirePermission(requiredPermission, resource = '') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          code: 'NOT_AUTHENTICATED',
          message: '用戶未認證',
          timestamp: new Date().toISOString()
        });
      }

      const hasPermission = await checkUserPermission(req.user, requiredPermission, resource);

      if (!hasPermission) {
        await DL.DL_warning('AUTH', 'requirePermission', `權限不足: ${req.user.UID} 嘗試 ${requiredPermission} ${resource}`, req.user.UID);

        return res.status(403).json({
          status: 'error',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '權限不足',
          data: {
            required: requiredPermission,
            resource: resource
          },
          timestamp: new Date().toISOString()
        });
      }

      next();

    } catch (error) {
      await DL.DL_error('AUTH', 'requirePermission', error.message, req.user?.UID || '');

      return res.status(500).json({
        status: 'error',
        code: 'PERMISSION_CHECK_FAILED',
        message: '權限檢查失敗',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * 04. 檢查用戶權限
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 根據用戶類型檢查特定權限
 */
async function checkUserPermission(user, permission, resource) {
  try {
    // 基本權限矩陣
    const permissionMatrix = {
      'M': [ // Manager - 管理員權限
        'read_all', 'write_all', 'delete_all', 'admin_all',
        'user_management', 'system_admin', 'ledger_admin'
      ],
      'S': [ // Standard - 標準用戶權限
        'read_own', 'write_own', 'delete_own',
        'ledger_basic', 'report_basic'
      ],
      'J': [ // Junior - 基礎用戶權限
        'read_own', 'write_limited',
        'ledger_basic'
      ]
    };

    const userPermissions = permissionMatrix[user.userType] || permissionMatrix['J'];

    // 檢查基本權限
    if (userPermissions.includes(permission)) {
      return true;
    }

    // 檢查資源特定權限
    if (resource && permission.endsWith('_own')) {
      // 檢查是否為用戶自己的資源
      return await checkResourceOwnership(user.UID, resource);
    }

    // SR模組專用權限檢查
    if (permission.startsWith('sr_')) {
      const srPermissionResult = await AM.AM_validateSRPremiumFeature(
        user.UID, 
        permission.replace('sr_', '').toUpperCase(),
        'SYSTEM'
      );
      return srPermissionResult.success && srPermissionResult.allowed;
    }

    return false;

  } catch (error) {
    await DL.DL_error('AUTH', 'checkUserPermission', error.message, user.UID);
    return false;
  }
}

/**
 * 05. 檢查資源擁有權
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 檢查用戶是否擁有特定資源
 */
async function checkResourceOwnership(userUID, resourceId) {
  try {
    // 這裡可以擴展為更複雜的資源擁有權檢查邏輯
    // 目前簡化為檢查resourceId是否包含userUID
    return resourceId.includes(userUID);
  } catch (error) {
    await DL.DL_error('AUTH', 'checkResourceOwnership', error.message, userUID);
    return false;
  }
}

/**
 * 06. 產生JWT Token
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 為認證成功的用戶產生JWT token
 */
function generateJWTToken(userInfo) {
  try {
    const payload = {
      UID: userInfo.UID,
      userType: userInfo.userType,
      platform: userInfo.platform || 'APP',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小時後過期
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      success: true,
      token: token,
      expiresIn: JWT_EXPIRES_IN,
      tokenType: 'Bearer'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 07. 刷新Token中介軟體
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 處理token刷新請求
 */
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: providedRefreshToken } = req.body;

    if (!providedRefreshToken) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_REFRESH_TOKEN',
        message: '缺少刷新token',
        timestamp: new Date().toISOString()
      });
    }

    // 驗證refresh token（簡化實作）
    const decoded = jwt.verify(providedRefreshToken, JWT_SECRET);

    // 產生新的access token
    const newTokenResult = generateJWTToken({
      UID: decoded.UID,
      userType: decoded.userType,
      platform: decoded.platform
    });

    if (newTokenResult.success) {
      res.json({
        status: 'success',
        code: 'TOKEN_REFRESHED',
        message: 'Token刷新成功',
        data: {
          accessToken: newTokenResult.token,
          tokenType: newTokenResult.tokenType,
          expiresIn: newTokenResult.expiresIn
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        status: 'error',
        code: 'TOKEN_REFRESH_FAILED',
        message: 'Token刷新失敗',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    await DL.DL_error('AUTH', 'refreshToken', error.message, '');

    res.status(401).json({
      status: 'error',
      code: 'INVALID_REFRESH_TOKEN',
      message: '無效的刷新token',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 08. 可選認證中介軟體
 * @version 2025-07-26-V1.0.0
 * @date 2025-07-26 11:30:00
 * @description 可選的認證檢查，用於部分開放的端點
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // 有token時嘗試驗證，但失敗不會阻止請求
      await validateToken(req, res, () => {
        // 無論驗證成功或失敗都繼續
        next();
      });
    } else {
      // 沒有token時設定匿名用戶
      req.user = {
        UID: 'anonymous',
        userType: 'ANONYMOUS',
        platform: 'UNKNOWN'
      };
      next();
    }

  } catch (error) {
    // 忽略錯誤，設定匿名用戶
    req.user = {
      UID: 'anonymous',
      userType: 'ANONYMOUS',
      platform: 'UNKNOWN'
    };
    next();
  }
}

// 導出模組
module.exports = {
  validateToken,
  validateFirebaseToken,
  requirePermission,
  checkUserPermission,
  checkResourceOwnership,
  generateJWTToken,
  refreshToken,
  optionalAuth
};

console.log('Auth Middleware 模組載入完成 v1.0.0');