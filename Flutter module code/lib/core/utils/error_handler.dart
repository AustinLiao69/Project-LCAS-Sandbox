
/**
 * Error_Handler_1.0.0
 * @module 錯誤處理工具模組
 * @description LCAS 2.0 統一錯誤處理與使用者友善錯誤訊息
 * @update 2025-01-23: 建立版本，實作統一錯誤處理機制
 */

import 'package:flutter/foundation.dart';
import '../api/api_response.dart';
import 'logger.dart';

/// 01. 統一錯誤處理器
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 提供統一的錯誤處理機制，轉換技術錯誤為使用者友善訊息
class ErrorHandler {
  static final AppLogger _logger = AppLogger();
  
  /// 02. 處理API錯誤
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 處理API呼叫產生的錯誤，轉換為使用者友善訊息
  static UserFriendlyError handleApiError(dynamic error, {
    String? context,
    Map<String, dynamic>? additionalInfo,
  }) {
    _logger.error(
      'API錯誤處理',
      tag: 'ERROR_HANDLER',
      error: {
        'error': error.toString(),
        'context': context,
        'additional_info': additionalInfo,
      },
    );

    if (error is ApiException) {
      return _handleApiException(error, context);
    }
    
    // 處理其他類型的錯誤
    return UserFriendlyError(
      code: 'UNKNOWN_ERROR',
      title: '發生未知錯誤',
      message: '系統發生未預期的錯誤，請稍後重試',
      actionable: true,
      retryable: true,
    );
  }

  /// 03. 處理網路錯誤
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 處理網路連線相關的錯誤
  static UserFriendlyError handleNetworkError(dynamic error, {String? context}) {
    _logger.error('網路錯誤', tag: 'ERROR_HANDLER', error: error);
    
    return UserFriendlyError(
      code: 'NETWORK_ERROR',
      title: '網路連線問題',
      message: '無法連接到伺服器，請檢查網路連線後重試',
      actionable: true,
      retryable: true,
      suggestedActions: [
        '檢查網路連線是否正常',
        '確認是否連接到穩定的網路',
        '稍後重新嘗試操作'
      ],
    );
  }

  /// 04. 處理驗證錯誤
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 處理身份驗證和授權相關錯誤
  static UserFriendlyError handleAuthError(dynamic error, {String? context}) {
    _logger.error('驗證錯誤', tag: 'ERROR_HANDLER', error: error);
    
    if (error is ApiException && error.statusCode == 401) {
      return UserFriendlyError(
        code: 'AUTHENTICATION_REQUIRED',
        title: '需要重新登入',
        message: '您的登入狀態已過期，請重新登入以繼續使用',
        actionable: true,
        retryable: false,
        suggestedActions: [
          '點擊重新登入',
          '確認帳號密碼正確',
        ],
      );
    }
    
    return UserFriendlyError(
      code: 'AUTHORIZATION_ERROR',
      title: '權限不足',
      message: '您沒有權限執行此操作',
      actionable: false,
      retryable: false,
    );
  }

  /// 05. 處理資料驗證錯誤
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 處理使用者輸入資料驗證錯誤
  static UserFriendlyError handleValidationError(
    Map<String, dynamic> validationErrors,
    {String? context}
  ) {
    _logger.warning('資料驗證錯誤', tag: 'ERROR_HANDLER', error: validationErrors);
    
    final errorMessages = <String>[];
    validationErrors.forEach((field, errors) {
      if (errors is List) {
        errorMessages.addAll(errors.cast<String>());
      } else {
        errorMessages.add(errors.toString());
      }
    });
    
    return UserFriendlyError(
      code: 'VALIDATION_ERROR',
      title: '資料格式錯誤',
      message: errorMessages.isNotEmpty 
          ? errorMessages.first 
          : '請檢查輸入的資料格式',
      actionable: true,
      retryable: true,
      details: errorMessages,
      suggestedActions: [
        '檢查必填欄位是否完整',
        '確認資料格式符合要求',
        '修正錯誤後重新提交'
      ],
    );
  }

  /// 06. 處理業務邏輯錯誤
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 處理應用程式業務邏輯相關錯誤
  static UserFriendlyError handleBusinessError(String errorCode, String message, {
    String? context,
    Map<String, dynamic>? details,
  }) {
    _logger.warning('業務邏輯錯誤', tag: 'ERROR_HANDLER', error: {
      'code': errorCode,
      'message': message,
      'context': context,
      'details': details,
    });
    
    // 根據錯誤代碼提供特定的處理
    switch (errorCode) {
      case 'INSUFFICIENT_FUNDS':
        return UserFriendlyError(
          code: errorCode,
          title: '餘額不足',
          message: '帳戶餘額不足以完成此操作',
          actionable: true,
          retryable: false,
          suggestedActions: ['檢查帳戶餘額', '充值後重試'],
        );
        
      case 'DUPLICATE_ENTRY':
        return UserFriendlyError(
          code: errorCode,
          title: '重複記錄',
          message: '此記錄已存在，無法重複新增',
          actionable: true,
          retryable: false,
          suggestedActions: ['檢查是否已有相同記錄', '修改記錄內容'],
        );
        
      case 'BUDGET_EXCEEDED':
        return UserFriendlyError(
          code: errorCode,
          title: '預算超支',
          message: message.isNotEmpty ? message : '此操作將超過您設定的預算限制',
          actionable: true,
          retryable: false,
          suggestedActions: ['調整預算設定', '減少支出金額'],
        );
        
      default:
        return UserFriendlyError(
          code: errorCode,
          title: '操作失敗',
          message: message.isNotEmpty ? message : '無法完成請求的操作',
          actionable: true,
          retryable: true,
        );
    }
  }

  /// 07. 處理ApiException
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 處理API例外的內部方法
  static UserFriendlyError _handleApiException(ApiException exception, String? context) {
    switch (exception.code) {
      case 'NETWORK_ERROR':
        return handleNetworkError(exception, context: context);
        
      case 'TIMEOUT_ERROR':
        return UserFriendlyError(
          code: 'TIMEOUT_ERROR',
          title: '請求逾時',
          message: '伺服器回應時間過長，請稍後重試',
          actionable: true,
          retryable: true,
        );
        
      case 'UNAUTHORIZED':
        return handleAuthError(exception, context: context);
        
      case 'SERVER_ERROR':
        return UserFriendlyError(
          code: 'SERVER_ERROR',
          title: '伺服器錯誤',
          message: '伺服器暫時無法處理請求，請稍後重試',
          actionable: true,
          retryable: true,
        );
        
      default:
        return UserFriendlyError(
          code: exception.code,
          title: '操作失敗',
          message: exception.message,
          actionable: true,
          retryable: true,
        );
    }
  }

  /// 08. 記錄致命錯誤
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄可能導致應用程式崩潰的嚴重錯誤
  static void logFatalError(dynamic error, StackTrace? stackTrace, {
    String? context,
    Map<String, dynamic>? additionalInfo,
  }) {
    _logger.fatal(
      '致命錯誤: ${error.toString()}',
      tag: 'FATAL_ERROR',
      error: {
        'error': error.toString(),
        'context': context,
        'additional_info': additionalInfo,
      },
      stackTrace: stackTrace,
    );
    
    // 在發行版本中，可以將錯誤發送到崩潰報告服務
    if (kReleaseMode) {
      _sendCrashReport(error, stackTrace, context, additionalInfo);
    }
  }

  /// 09. 發送崩潰報告
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 發送崩潰報告到遠端監控服務
  static void _sendCrashReport(
    dynamic error, 
    StackTrace? stackTrace,
    String? context,
    Map<String, dynamic>? additionalInfo,
  ) {
    // 這裡可以整合 Firebase Crashlytics 或其他崩潰報告服務
    // 目前僅為預留實作
  }
}

/// 10. 使用者友善錯誤類別
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 定義使用者友善的錯誤資訊結構
class UserFriendlyError {
  /// 錯誤代碼
  final String code;
  
  /// 錯誤標題
  final String title;
  
  /// 錯誤訊息
  final String message;
  
  /// 是否可以採取行動解決
  final bool actionable;
  
  /// 是否可以重試
  final bool retryable;
  
  /// 詳細錯誤資訊
  final List<String>? details;
  
  /// 建議的解決動作
  final List<String>? suggestedActions;
  
  /// 額外的錯誤資訊
  final Map<String, dynamic>? metadata;

  const UserFriendlyError({
    required this.code,
    required this.title,
    required this.message,
    this.actionable = false,
    this.retryable = false,
    this.details,
    this.suggestedActions,
    this.metadata,
  });

  /// 11. 轉換為Map格式
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 將錯誤物件轉換為Map格式，便於序列化
  Map<String, dynamic> toMap() {
    return {
      'code': code,
      'title': title,
      'message': message,
      'actionable': actionable,
      'retryable': retryable,
      'details': details,
      'suggested_actions': suggestedActions,
      'metadata': metadata,
    };
  }

  @override
  String toString() {
    return 'UserFriendlyError(code: $code, title: $title, message: $message)';
  }
}
