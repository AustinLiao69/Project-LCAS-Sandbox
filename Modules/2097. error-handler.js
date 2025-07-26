
/**
 * Error_Handler_1.0.0
 * @module 錯誤處理模組
 * @description LCAS 2.0 統一錯誤處理機制 - 標準化錯誤回應和日誌記錄
 * @update 2025-01-23: 建立版本，實作統一錯誤處理和標準化回應格式
 */

const DL = require('./2010. DL.js');

/**
 * 01. 錯誤類型定義
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 定義系統中所有可能的錯誤類型和對應的HTTP狀態碼
 */
const ERROR_TYPES = {
  // 認證相關錯誤 (400-403)
  AUTHENTICATION_ERROR: {
    statusCode: 401,
    code: 'AUTH_ERROR',
    message: '認證失敗'
  },
  AUTHORIZATION_ERROR: {
    statusCode: 403,
    code: 'AUTH_DENIED',
    message: '權限不足'
  },
  TOKEN_EXPIRED: {
    statusCode: 401,
    code: 'TOKEN_EXPIRED',
    message: 'Token已過期'
  },
  INVALID_TOKEN: {
    statusCode: 401,
    code: 'TOKEN_INVALID',
    message: '無效的Token'
  },

  // 請求相關錯誤 (400-499)
  VALIDATION_ERROR: {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: '資料驗證失敗'
  },
  MISSING_REQUIRED_FIELD: {
    statusCode: 400,
    code: 'MISSING_FIELD',
    message: '缺少必要欄位'
  },
  INVALID_REQUEST_FORMAT: {
    statusCode: 400,
    code: 'INVALID_FORMAT',
    message: '請求格式無效'
  },
  RESOURCE_NOT_FOUND: {
    statusCode: 404,
    code: 'NOT_FOUND',
    message: '資源不存在'
  },
  DUPLICATE_RESOURCE: {
    statusCode: 409,
    code: 'DUPLICATE',
    message: '資源已存在'
  },

  // 業務邏輯錯誤 (400-499)
  BUSINESS_LOGIC_ERROR: {
    statusCode: 422,
    code: 'BUSINESS_ERROR',
    message: '業務邏輯錯誤'
  },
  LEDGER_OPERATION_FAILED: {
    statusCode: 422,
    code: 'LEDGER_ERROR',
    message: '帳本操作失敗'
  },
  BUDGET_EXCEEDED: {
    statusCode: 422,
    code: 'BUDGET_EXCEEDED',
    message: '超出預算限制'
  },
  QUOTA_EXCEEDED: {
    statusCode: 429,
    code: 'QUOTA_EXCEEDED',
    message: '超出使用配額'
  },

  // 系統錯誤 (500-599)
  INTERNAL_SERVER_ERROR: {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: '內部系統錯誤'
  },
  DATABASE_ERROR: {
    statusCode: 500,
    code: 'DATABASE_ERROR',
    message: '資料庫操作失敗'
  },
  EXTERNAL_SERVICE_ERROR: {
    statusCode: 502,
    code: 'EXTERNAL_ERROR',
    message: '外部服務錯誤'
  },
  SERVICE_UNAVAILABLE: {
    statusCode: 503,
    code: 'SERVICE_UNAVAILABLE',
    message: '服務暫時不可用'
  },
  TIMEOUT_ERROR: {
    statusCode: 504,
    code: 'TIMEOUT',
    message: '請求超時'
  }
};

/**
 * 02. 自定義錯誤類別
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 建立可攜帶詳細資訊的自定義錯誤類別
 */
class ApiError extends Error {
  constructor(errorType, customMessage = null, details = null, userContext = null) {
    const errorInfo = ERROR_TYPES[errorType] || ERROR_TYPES.INTERNAL_SERVER_ERROR;
    
    super(customMessage || errorInfo.message);
    
    this.name = 'ApiError';
    this.type = errorType;
    this.statusCode = errorInfo.statusCode;
    this.code = errorInfo.code;
    this.details = details;
    this.userContext = userContext;
    this.timestamp = new Date().toISOString();
    this.requestId = null; // 將在中介軟體中設定
    
    // 保持堆疊追蹤
    Error.captureStackTrace(this, ApiError);
  }

  toJSON() {
    return {
      status: 'error',
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId
    };
  }
}

/**
 * 03. 主要錯誤處理中介軟體
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 捕獲所有API錯誤並格式化回應
 */
async function handleApiError(error, req, res, next) {
  try {
    // 設定請求ID到錯誤物件
    if (error instanceof ApiError) {
      error.requestId = req.requestId;
    }

    // 記錄錯誤日誌
    await logError(error, req);

    // 處理不同類型的錯誤
    let statusCode, errorResponse;

    if (error instanceof ApiError) {
      // 自定義API錯誤
      statusCode = error.statusCode;
      errorResponse = error.toJSON();
    } else if (error.name === 'ValidationError') {
      // Mongoose驗證錯誤
      statusCode = 400;
      errorResponse = {
        status: 'error',
        code: 'VALIDATION_FAILED',
        message: '資料驗證失敗',
        details: formatValidationErrors(error),
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      };
    } else if (error.name === 'CastError') {
      // MongoDB CastError
      statusCode = 400;
      errorResponse = {
        status: 'error',
        code: 'INVALID_ID',
        message: '無效的ID格式',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      };
    } else if (error.code === 11000) {
      // MongoDB重複鍵錯誤
      statusCode = 409;
      errorResponse = {
        status: 'error',
        code: 'DUPLICATE_KEY',
        message: '資料重複',
        details: extractDuplicateFields(error),
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      };
    } else {
      // 未知錯誤
      statusCode = 500;
      errorResponse = {
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? '內部系統錯誤' : error.message,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      };

      // 在開發環境中包含堆疊追蹤
      if (process.env.NODE_ENV !== 'production') {
        errorResponse.stack = error.stack;
      }
    }

    // 發送錯誤回應
    res.status(statusCode).json(errorResponse);

  } catch (handlingError) {
    // 錯誤處理器本身發生錯誤
    console.error('錯誤處理器發生錯誤:', handlingError);
    
    res.status(500).json({
      status: 'error',
      code: 'ERROR_HANDLER_FAILED',
      message: '錯誤處理失敗',
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    });
  }
}

/**
 * 04. 錯誤日誌記錄
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 統一記錄錯誤到系統日誌
 */
async function logError(error, req) {
  try {
    const errorLogData = {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      user: req.user ? {
        UID: req.user.UID,
        userType: req.user.userType,
        platform: req.user.platform
      } : null,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        type: error.type,
        statusCode: error.statusCode,
        stack: error.stack
      },
      requestBody: sanitizeRequestBody(req.body),
      requestParams: req.params,
      requestQuery: req.query
    };

    // 使用DL模組記錄錯誤
    await DL.DL_error(
      'API',
      'handleApiError',
      `API錯誤: ${error.message}`,
      req.user?.UID || 'anonymous',
      '',
      '',
      error.code || 'UNKNOWN_ERROR',
      JSON.stringify(errorLogData)
    );

    // 對於嚴重錯誤（500級別），額外記錄到console
    if (error.statusCode >= 500 || !error.statusCode) {
      console.error('嚴重錯誤:', errorLogData);
    }

  } catch (loggingError) {
    console.error('錯誤日誌記錄失敗:', loggingError);
  }
}

/**
 * 05. 清理請求資料
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 移除敏感資訊以便安全記錄
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * 06. 格式化驗證錯誤
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 將驗證錯誤轉換為結構化格式
 */
function formatValidationErrors(error) {
  const errors = [];

  if (error.errors) {
    Object.keys(error.errors).forEach(field => {
      const fieldError = error.errors[field];
      errors.push({
        field: field,
        message: fieldError.message,
        value: fieldError.value,
        kind: fieldError.kind
      });
    });
  }

  return errors;
}

/**
 * 07. 提取重複欄位資訊
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 從MongoDB重複鍵錯誤中提取欄位資訊
 */
function extractDuplicateFields(error) {
  const duplicateInfo = {};

  if (error.keyPattern) {
    Object.keys(error.keyPattern).forEach(field => {
      duplicateInfo[field] = error.keyValue[field];
    });
  }

  return duplicateInfo;
}

/**
 * 08. 404錯誤處理中介軟體
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 處理找不到路由的情況
 */
function handleNotFound(req, res, next) {
  const error = new ApiError('RESOURCE_NOT_FOUND', `路由 ${req.originalUrl} 不存在`);
  next(error);
}

/**
 * 09. 異步錯誤包裝器
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 包裝異步函數以自動捕獲錯誤
 */
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 10. 建立標準化錯誤
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 提供便利的錯誤建立函數
 */
const createError = {
  validation: (message, details) => new ApiError('VALIDATION_ERROR', message, details),
  notFound: (resource) => new ApiError('RESOURCE_NOT_FOUND', `${resource} 不存在`),
  unauthorized: (message) => new ApiError('AUTHENTICATION_ERROR', message),
  forbidden: (message) => new ApiError('AUTHORIZATION_ERROR', message),
  duplicate: (resource) => new ApiError('DUPLICATE_RESOURCE', `${resource} 已存在`),
  businessLogic: (message, details) => new ApiError('BUSINESS_LOGIC_ERROR', message, details),
  internal: (message) => new ApiError('INTERNAL_SERVER_ERROR', message),
  timeout: () => new ApiError('TIMEOUT_ERROR'),
  serviceUnavailable: (service) => new ApiError('SERVICE_UNAVAILABLE', `${service} 服務暫時不可用`)
};

/**
 * 11. 錯誤監控和統計
 * @version 2025-01-23-V1.0.0
 * @date 2025-01-23 11:30:00
 * @description 提供錯誤統計和監控功能
 */
class ErrorMonitor {
  constructor() {
    this.errorCounts = new Map();
    this.lastReset = Date.now();
  }

  recordError(errorType, errorCode) {
    const key = `${errorType}-${errorCode}`;
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);

    // 每小時重置統計
    if (Date.now() - this.lastReset > 3600000) {
      this.resetCounts();
    }
  }

  getErrorStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      errorBreakdown: Object.fromEntries(this.errorCounts),
      lastReset: new Date(this.lastReset).toISOString()
    };
  }

  resetCounts() {
    this.errorCounts.clear();
    this.lastReset = Date.now();
  }
}

const errorMonitor = new ErrorMonitor();

// 導出模組
module.exports = {
  ApiError,
  ERROR_TYPES,
  handleApiError,
  handleNotFound,
  asyncErrorHandler,
  createError,
  errorMonitor,
  logError
};

console.log('Error Handler 模組載入完成 v1.0.0');
