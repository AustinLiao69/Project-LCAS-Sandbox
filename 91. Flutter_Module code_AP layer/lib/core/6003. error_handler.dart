
/**
 * ErrorHandler_錯誤處理器_1.0.0
 * @module 錯誤處理模組
 * @description LCAS 2.0 統一錯誤處理器 - 提供標準化錯誤分類和本地化訊息
 * @update 2025-01-23: 建立v1.0.0版本，支援多層級錯誤處理和自動重試
 */

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:logging/logging.dart';

class ErrorHandler {
  static final Logger _logger = Logger('ErrorHandler');
  
  // 單例模式
  static ErrorHandler? _instance;
  static ErrorHandler get instance {
    _instance ??= ErrorHandler._internal();
    return _instance!;
  }
  
  ErrorHandler._internal();

  /**
   * 01. 處理API錯誤
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 處理Dio API錯誤並轉換為統一格式
   */
  Future<DioException> handleApiError(DioException error) async {
    _logger.severe('處理API錯誤: ${error.type} ${error.message}');
    
    String errorMessage;
    String errorCode;
    
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        errorMessage = '連線超時，請檢查網路連線';
        errorCode = 'CONNECTION_TIMEOUT';
        break;
        
      case DioExceptionType.sendTimeout:
        errorMessage = '請求超時，請稍後重試';
        errorCode = 'SEND_TIMEOUT';
        break;
        
      case DioExceptionType.receiveTimeout:
        errorMessage = '伺服器回應超時，請稍後重試';
        errorCode = 'RECEIVE_TIMEOUT';
        break;
        
      case DioExceptionType.badResponse:
        final response = error.response;
        if (response != null) {
          errorMessage = _parseErrorResponse(response);
          errorCode = _getErrorCodeFromResponse(response);
        } else {
          errorMessage = '伺服器回應錯誤';
          errorCode = 'BAD_RESPONSE';
        }
        break;
        
      case DioExceptionType.cancel:
        errorMessage = '請求已取消';
        errorCode = 'REQUEST_CANCELLED';
        break;
        
      case DioExceptionType.connectionError:
        errorMessage = '網路連線錯誤，請檢查網路設定';
        errorCode = 'CONNECTION_ERROR';
        break;
        
      case DioExceptionType.badCertificate:
        errorMessage = 'SSL憑證錯誤';
        errorCode = 'BAD_CERTIFICATE';
        break;
        
      case DioExceptionType.unknown:
      default:
        if (error.error is SocketException) {
          errorMessage = '無法連接到伺服器，請檢查網路連線';
          errorCode = 'NETWORK_ERROR';
        } else {
          errorMessage = '發生未知錯誤: ${error.message}';
          errorCode = 'UNKNOWN_ERROR';
        }
        break;
    }
    
    // 記錄詳細錯誤資訊
    _logError(errorCode, errorMessage, error);
    
    // 返回修改後的錯誤
    return DioException(
      requestOptions: error.requestOptions,
      response: error.response,
      type: error.type,
      error: LcasApiError(
        code: errorCode,
        message: errorMessage,
        originalError: error,
      ),
    );
  }

  /**
   * 02. 解析伺服器錯誤回應
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 從伺服器回應中提取錯誤訊息
   */
  String _parseErrorResponse(Response response) {
    try {
      final data = response.data;
      
      if (data is Map<String, dynamic>) {
        // LCAS標準錯誤格式
        if (data.containsKey('error') && data['error'] is Map) {
          final errorData = data['error'] as Map<String, dynamic>;
          return errorData['message'] ?? '伺服器錯誤';
        }
        
        // 直接包含message的格式
        if (data.containsKey('message')) {
          return data['message'] as String;
        }
        
        // HTTP狀態碼對應的預設訊息
        return _getDefaultErrorMessage(response.statusCode ?? 0);
      }
      
      return '伺服器回應格式錯誤';
    } catch (e) {
      _logger.warning('解析錯誤回應失敗: $e');
      return _getDefaultErrorMessage(response.statusCode ?? 0);
    }
  }

  /**
   * 03. 從回應中提取錯誤代碼
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 從伺服器回應中提取標準化錯誤代碼
   */
  String _getErrorCodeFromResponse(Response response) {
    try {
      final data = response.data;
      
      if (data is Map<String, dynamic>) {
        if (data.containsKey('error') && data['error'] is Map) {
          final errorData = data['error'] as Map<String, dynamic>;
          if (errorData.containsKey('code')) {
            return errorData['code'] as String;
          }
        }
      }
      
      // 根據HTTP狀態碼生成錯誤代碼
      return 'HTTP_${response.statusCode}';
    } catch (e) {
      return 'PARSE_ERROR';
    }
  }

  /**
   * 04. 獲取預設錯誤訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 根據HTTP狀態碼返回對應的中文錯誤訊息
   */
  String _getDefaultErrorMessage(int statusCode) {
    switch (statusCode) {
      case 400:
        return '請求參數錯誤';
      case 401:
        return '未授權訪問，請重新登入';
      case 403:
        return '權限不足';
      case 404:
        return '請求的資源不存在';
      case 409:
        return '資料衝突';
      case 422:
        return '請求資料驗證失敗';
      case 429:
        return '請求過於頻繁，請稍後再試';
      case 500:
        return '伺服器內部錯誤';
      case 502:
        return '伺服器閘道錯誤';
      case 503:
        return '服務暫時不可用';
      case 504:
        return '伺服器閘道超時';
      default:
        return '發生錯誤 (狀態碼: $statusCode)';
    }
  }

  /**
   * 05. 獲取錯誤訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 從錯誤物件中提取使用者友好的錯誤訊息
   */
  String getErrorMessage(dynamic error) {
    if (error is DioException) {
      if (error.error is LcasApiError) {
        return (error.error as LcasApiError).message;
      }
      return error.message ?? '未知網路錯誤';
    }
    
    if (error is LcasApiError) {
      return error.message;
    }
    
    return error.toString();
  }

  /**
   * 06. 獲取錯誤代碼
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 從錯誤物件中提取標準化錯誤代碼
   */
  String getErrorCode(dynamic error) {
    if (error is DioException) {
      if (error.error is LcasApiError) {
        return (error.error as LcasApiError).code;
      }
      return error.type.toString();
    }
    
    if (error is LcasApiError) {
      return error.code;
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * 07. 判斷錯誤是否可重試
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 判斷特定錯誤是否適合自動重試
   */
  bool isRetryableError(dynamic error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.connectionError:
          return true;
          
        case DioExceptionType.badResponse:
          final statusCode = error.response?.statusCode ?? 0;
          return statusCode >= 500 && statusCode < 600; // 5xx錯誤可重試
          
        default:
          return false;
      }
    }
    
    return false;
  }

  /**
   * 08. 記錄錯誤日誌
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 記錄詳細的錯誤資訊用於調試和監控
   */
  void _logError(String errorCode, String errorMessage, DioException error) {
    final logData = {
      'error_code': errorCode,
      'error_message': errorMessage,
      'error_type': error.type.toString(),
      'request_method': error.requestOptions.method,
      'request_path': error.requestOptions.path,
      'status_code': error.response?.statusCode,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    _logger.severe('API錯誤詳情: ${logData}');
  }

  /**
   * 09. 處理業務邏輯錯誤
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 處理應用程式特定的業務邏輯錯誤
   */
  LcasApiError handleBusinessError(String code, String message, {dynamic details}) {
    _logger.warning('業務錯誤: $code - $message');
    
    return LcasApiError(
      code: code,
      message: message,
      details: details,
    );
  }
}

/**
 * LCAS API錯誤類別
 */
class LcasApiError {
  final String code;
  final String message;
  final dynamic details;
  final DioException? originalError;

  LcasApiError({
    required this.code,
    required this.message,
    this.details,
    this.originalError,
  });

  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'message': message,
      'details': details,
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'LcasApiError{code: $code, message: $message}';
  }
}
/**
 * ErrorHandler_錯誤處理器_1.0.0
 * @module 錯誤處理模組
 * @description LCAS 2.0 統一錯誤處理器 - 提供標準化錯誤分類和本地化訊息
 * @update 2025-01-24: 建立v1.0.0版本，支援多層級錯誤處理和自動重試
 */

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:logging/logging.dart';

class ErrorHandler {
  static final Logger _logger = Logger('ErrorHandler');
  
  // 單例模式
  static ErrorHandler? _instance;
  static ErrorHandler get instance {
    _instance ??= ErrorHandler._internal();
    return _instance!;
  }
  
  ErrorHandler._internal();

  /**
   * 01. 處理API錯誤
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 處理Dio API錯誤並轉換為統一格式
   */
  Future<DioException> handleApiError(DioException error) async {
    _logger.severe('處理API錯誤: ${error.type} ${error.message}');
    
    String errorMessage;
    String errorCode;
    
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        errorMessage = '連線超時，請檢查網路連線';
        errorCode = 'CONNECTION_TIMEOUT';
        break;
        
      case DioExceptionType.sendTimeout:
        errorMessage = '請求超時，請稍後重試';
        errorCode = 'SEND_TIMEOUT';
        break;
        
      case DioExceptionType.receiveTimeout:
        errorMessage = '伺服器回應超時，請稍後重試';
        errorCode = 'RECEIVE_TIMEOUT';
        break;
        
      case DioExceptionType.badResponse:
        final response = error.response;
        if (response != null) {
          errorMessage = _parseErrorResponse(response);
          errorCode = _getErrorCodeFromResponse(response);
        } else {
          errorMessage = '伺服器回應錯誤';
          errorCode = 'BAD_RESPONSE';
        }
        break;
        
      case DioExceptionType.cancel:
        errorMessage = '請求已取消';
        errorCode = 'REQUEST_CANCELLED';
        break;
        
      case DioExceptionType.connectionError:
        errorMessage = '網路連線錯誤，請檢查網路設定';
        errorCode = 'CONNECTION_ERROR';
        break;
        
      case DioExceptionType.badCertificate:
        errorMessage = 'SSL憑證錯誤';
        errorCode = 'BAD_CERTIFICATE';
        break;
        
      case DioExceptionType.unknown:
      default:
        if (error.error is SocketException) {
          errorMessage = '無法連接到伺服器，請檢查網路連線';
          errorCode = 'NETWORK_ERROR';
        } else {
          errorMessage = '發生未知錯誤: ${error.message}';
          errorCode = 'UNKNOWN_ERROR';
        }
        break;
    }
    
    // 記錄詳細錯誤資訊
    _logError(errorCode, errorMessage, error);
    
    // 返回修改後的錯誤
    return DioException(
      requestOptions: error.requestOptions,
      response: error.response,
      type: error.type,
      error: LcasApiError(
        code: errorCode,
        message: errorMessage,
        originalError: error,
      ),
    );
  }

  /**
   * 02. 解析伺服器錯誤回應
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 從伺服器回應中提取錯誤訊息
   */
  String _parseErrorResponse(Response response) {
    try {
      final data = response.data;
      
      if (data is Map<String, dynamic>) {
        // LCAS標準錯誤格式
        if (data.containsKey('error') && data['error'] is Map) {
          final errorData = data['error'] as Map<String, dynamic>;
          return errorData['message'] ?? '伺服器錯誤';
        }
        
        // 直接包含message的格式
        if (data.containsKey('message')) {
          return data['message'] as String;
        }
        
        // HTTP狀態碼對應的預設訊息
        return _getDefaultErrorMessage(response.statusCode ?? 0);
      }
      
      return '伺服器回應格式錯誤';
    } catch (e) {
      _logger.warning('解析錯誤回應失敗: $e');
      return _getDefaultErrorMessage(response.statusCode ?? 0);
    }
  }

  /**
   * 03. 從回應中提取錯誤代碼
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 從伺服器回應中提取標準化錯誤代碼
   */
  String _getErrorCodeFromResponse(Response response) {
    try {
      final data = response.data;
      
      if (data is Map<String, dynamic>) {
        if (data.containsKey('error') && data['error'] is Map) {
          final errorData = data['error'] as Map<String, dynamic>;
          if (errorData.containsKey('code')) {
            return errorData['code'] as String;
          }
        }
      }
      
      // 根據HTTP狀態碼生成錯誤代碼
      return 'HTTP_${response.statusCode}';
    } catch (e) {
      return 'PARSE_ERROR';
    }
  }

  /**
   * 04. 獲取預設錯誤訊息
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 根據HTTP狀態碼返回對應的中文錯誤訊息
   */
  String _getDefaultErrorMessage(int statusCode) {
    switch (statusCode) {
      case 400:
        return '請求參數錯誤';
      case 401:
        return '未授權訪問，請重新登入';
      case 403:
        return '權限不足';
      case 404:
        return '請求的資源不存在';
      case 409:
        return '資料衝突';
      case 422:
        return '請求資料驗證失敗';
      case 429:
        return '請求過於頻繁，請稍後再試';
      case 500:
        return '伺服器內部錯誤';
      case 502:
        return '伺服器閘道錯誤';
      case 503:
        return '服務暫時不可用';
      case 504:
        return '伺服器閘道超時';
      default:
        return '發生錯誤 (狀態碼: $statusCode)';
    }
  }

  /**
   * 05. 獲取錯誤訊息
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 從錯誤物件中提取使用者友好的錯誤訊息
   */
  String getErrorMessage(dynamic error) {
    if (error is DioException) {
      if (error.error is LcasApiError) {
        return (error.error as LcasApiError).message;
      }
      return error.message ?? '未知網路錯誤';
    }
    
    if (error is LcasApiError) {
      return error.message;
    }
    
    return error.toString();
  }

  /**
   * 06. 獲取錯誤代碼
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 從錯誤物件中提取標準化錯誤代碼
   */
  String getErrorCode(dynamic error) {
    if (error is DioException) {
      if (error.error is LcasApiError) {
        return (error.error as LcasApiError).code;
      }
      return error.type.toString();
    }
    
    if (error is LcasApiError) {
      return error.code;
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * 07. 判斷錯誤是否可重試
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 判斷特定錯誤是否適合自動重試
   */
  bool isRetryableError(dynamic error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.connectionError:
          return true;
          
        case DioExceptionType.badResponse:
          final statusCode = error.response?.statusCode ?? 0;
          return statusCode >= 500 && statusCode < 600; // 5xx錯誤可重試
          
        default:
          return false;
      }
    }
    
    return false;
  }

  /**
   * 08. 記錄錯誤日誌
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 記錄詳細的錯誤資訊用於調試和監控
   */
  void _logError(String errorCode, String errorMessage, DioException error) {
    final logData = {
      'error_code': errorCode,
      'error_message': errorMessage,
      'error_type': error.type.toString(),
      'request_method': error.requestOptions.method,
      'request_path': error.requestOptions.path,
      'status_code': error.response?.statusCode,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    _logger.severe('API錯誤詳情: ${logData}');
  }

  /**
   * 09. 處理業務邏輯錯誤
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 處理應用程式特定的業務邏輯錯誤
   */
  LcasApiError handleBusinessError(String code, String message, {dynamic details}) {
    _logger.warning('業務錯誤: $code - $message');
    
    return LcasApiError(
      code: code,
      message: message,
      details: details,
    );
  }

  /**
   * 10. 統一錯誤處理包裝器
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 為API回應提供統一錯誤處理
   */
  ApiResponse<T> handleApiError<T>(dynamic error, String defaultMessage) {
    String errorMessage = defaultMessage;
    String? errorCode;
    
    if (error is DioException && error.error is LcasApiError) {
      final lcasError = error.error as LcasApiError;
      errorMessage = lcasError.message;
      errorCode = lcasError.code;
    } else {
      errorMessage = getErrorMessage(error);
      errorCode = getErrorCode(error);
    }
    
    return ApiResponse<T>(
      success: false,
      data: null,
      message: errorMessage,
      errorCode: errorCode,
      timestamp: DateTime.now(),
      statusCode: 0,
    );
  }
}

/**
 * LCAS API錯誤類別
 */
class LcasApiError {
  final String code;
  final String message;
  final dynamic details;
  final DioException? originalError;

  LcasApiError({
    required this.code,
    required this.message,
    this.details,
    this.originalError,
  });

  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'message': message,
      'details': details,
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'LcasApiError{code: $code, message: $message}';
  }
}

/**
 * 標準化API回應類別
 */
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String message;
  final String? errorCode;
  final DateTime timestamp;
  final int statusCode;

  ApiResponse({
    required this.success,
    this.data,
    required this.message,
    this.errorCode,
    required this.timestamp,
    required this.statusCode,
  });

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'data': data,
      'message': message,
      'errorCode': errorCode,
      'timestamp': timestamp.toIso8601String(),
      'statusCode': statusCode,
    };
  }

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>)? fromJsonT,
  ) {
    return ApiResponse<T>(
      success: json['success'] ?? false,
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'] as Map<String, dynamic>)
          : json['data'] as T?,
      message: json['message'] ?? '',
      errorCode: json['errorCode'],
      timestamp: DateTime.parse(json['timestamp']),
      statusCode: json['statusCode'] ?? 200,
    );
  }
}
