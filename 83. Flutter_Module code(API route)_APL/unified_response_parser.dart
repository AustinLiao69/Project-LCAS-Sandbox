
/**
 * unified_response_parser.dart
 * @version v1.0.0
 * @date 2025-10-16
 * @description 統一API回應解析器 - 支援DCN-0015統一回應格式
 */

import 'dart:convert';
import 'package:http/http.dart' as http;

// ================================
// 統一回應格式類別定義
// ================================

/// 統一API錯誤資訊
class UnifiedApiError {
  final String code;
  final String message;
  final Map<String, dynamic>? details;

  UnifiedApiError({
    required this.code,
    required this.message,
    this.details,
  });

  factory UnifiedApiError.fromJson(Map<String, dynamic> json) {
    return UnifiedApiError(
      code: json['code'] ?? 'UNKNOWN_ERROR',
      message: json['message'] ?? 'Unknown error occurred',
      details: json['details'],
    );
  }
}

/// 統一API回應元數據
class UnifiedApiMetadata {
  final String timestamp;
  final String requestId;
  final UserMode userMode;
  final String apiVersion;
  final int processingTimeMs;
  final Map<String, dynamic> modeFeatures;

  UnifiedApiMetadata({
    required this.timestamp,
    required this.requestId,
    required this.userMode,
    required this.apiVersion,
    required this.processingTimeMs,
    required this.modeFeatures,
  });

  factory UnifiedApiMetadata.fromJson(Map<String, dynamic> json) {
    return UnifiedApiMetadata(
      timestamp: json['timestamp'] ?? DateTime.now().toIso8601String(),
      requestId: json['requestId'] ?? 'unknown',
      userMode: _parseUserMode(json['userMode']),
      apiVersion: json['apiVersion'] ?? 'v1.0.0',
      processingTimeMs: json['processingTimeMs'] ?? 0,
      modeFeatures: Map<String, dynamic>.from(json['modeFeatures'] ?? {}),
    );
  }

  static UserMode _parseUserMode(dynamic mode) {
    if (mode is String) {
      switch (mode.toLowerCase()) {
        case 'expert':
          return UserMode.expert;
        case 'cultivation':
          return UserMode.cultivation;
        case 'guiding':
          return UserMode.guiding;
        case 'inertial':
        default:
          return UserMode.inertial;
      }
    }
    return UserMode.inertial;
  }
}

/// 使用者模式枚舉
enum UserMode { expert, inertial, cultivation, guiding }

/// 統一API回應格式
class UnifiedApiResponse<T> {
  final bool success;
  final T? data;
  final UnifiedApiError? error;
  final String message;
  final UnifiedApiMetadata metadata;

  UnifiedApiResponse({
    required this.success,
    this.data,
    this.error,
    required this.message,
    required this.metadata,
  });

  /// 安全取得資料
  T? get safeData => success ? data : null;

  /// 安全取得錯誤
  UnifiedApiError? get safeError => success ? null : error;

  /// 檢查是否成功
  bool get isSuccess => success;

  /// 取得用戶模式
  UserMode get userMode => metadata.userMode;

  factory UnifiedApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? dataParser,
  ) {
    final success = json['success'] ?? false;
    final metadata = UnifiedApiMetadata.fromJson(json['metadata'] ?? {});

    T? parsedData;
    UnifiedApiError? parsedError;

    if (success && json['data'] != null && dataParser != null) {
      try {
        parsedData = dataParser(json['data']);
      } catch (e) {
        // 資料解析失敗時，轉換為錯誤回應
        parsedError = UnifiedApiError(
          code: 'DATA_PARSE_ERROR',
          message: '資料解析失敗: $e',
        );
      }
    } else if (!success && json['error'] != null) {
      parsedError = UnifiedApiError.fromJson(json['error']);
    }

    return UnifiedApiResponse<T>(
      success: success && parsedError == null,
      data: parsedData,
      error: parsedError,
      message: json['message'] ?? (success ? '操作成功' : '操作失敗'),
      metadata: metadata,
    );
  }
}

// ================================
// HTTP回應擴展方法
// ================================

extension HttpResponseExtension on http.Response {
  /// 轉換為統一回應格式
  UnifiedApiResponse<T> toUnifiedResponse<T>(T Function(dynamic)? dataParser) {
    try {
      if (statusCode >= 200 && statusCode < 300) {
        final jsonData = json.decode(body) as Map<String, dynamic>;
        return UnifiedApiResponse<T>.fromJson(jsonData, dataParser);
      } else {
        // HTTP錯誤狀態碼處理
        return UnifiedApiResponse<T>(
          success: false,
          error: UnifiedApiError(
            code: 'HTTP_ERROR_$statusCode',
            message: 'HTTP錯誤: $statusCode',
            details: {'statusCode': statusCode, 'body': body},
          ),
          message: 'HTTP請求失敗',
          metadata: UnifiedApiMetadata(
            timestamp: DateTime.now().toIso8601String(),
            requestId: 'http_error_${DateTime.now().millisecondsSinceEpoch}',
            userMode: UserMode.inertial,
            apiVersion: 'v1.0.0',
            processingTimeMs: 0,
            modeFeatures: {},
          ),
        );
      }
    } catch (e) {
      // JSON解析錯誤處理
      return UnifiedApiResponse<T>(
        success: false,
        error: UnifiedApiError(
          code: 'JSON_PARSE_ERROR',
          message: 'JSON解析錯誤: $e',
          details: {'rawBody': body},
        ),
        message: 'API回應解析失敗',
        metadata: UnifiedApiMetadata(
          timestamp: DateTime.now().toIso8601String(),
          requestId: 'parse_error_${DateTime.now().millisecondsSinceEpoch}',
          userMode: UserMode.inertial,
          apiVersion: 'v1.0.0',
          processingTimeMs: 0,
          modeFeatures: {},
        ),
      );
    }
  }
}

// ================================
// 統一回應解析器
// ================================

class UnifiedResponseParser {
  /// 處理API錯誤
  static void handleApiError(
    UnifiedApiError error,
    Function(String) onShowError,
    Function(String) onLogError,
    Function() onRetry,
  ) {
    // 記錄錯誤
    onLogError('API錯誤 [${error.code}]: ${error.message}');

    // 顯示用戶友善錯誤訊息
    String userMessage = _getUserFriendlyErrorMessage(error);
    onShowError(userMessage);

    // 判斷是否可重試
    if (_isRetryableError(error.code)) {
      // 可以觸發重試邏輯
      onRetry();
    }
  }

  /// 處理模式特定邏輯
  static void handleModeSpecificLogic(
    UserMode userMode,
    Map<String, dynamic> modeFeatures,
    Function(String) onShowHint,
    Function(Map<String, dynamic>) onUpdateUI,
  ) {
    switch (userMode) {
      case UserMode.expert:
        if (modeFeatures['detailedAnalytics'] == true) {
          onShowHint('專家模式：詳細分析數據已載入');
        }
        break;
      case UserMode.cultivation:
        if (modeFeatures['achievementProgress'] == true) {
          onShowHint('培養模式：成就進度已更新');
        }
        break;
      case UserMode.guiding:
        if (modeFeatures['helpHints'] == true) {
          onShowHint('引導模式：操作提示已準備');
        }
        break;
      case UserMode.inertial:
      default:
        if (modeFeatures['stabilityMode'] == true) {
          onShowHint('穩定模式：系統運行正常');
        }
        break;
    }

    // 更新UI狀態
    onUpdateUI({
      'userMode': userMode.toString().split('.').last,
      'modeFeatures': modeFeatures,
    });
  }

  /// 取得用戶友善錯誤訊息
  static String _getUserFriendlyErrorMessage(UnifiedApiError error) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return '網路連線有問題，請檢查網路狀態後重試';
      case 'VALIDATION_ERROR':
        return '輸入資料有誤，請檢查後重新輸入';
      case 'AUTH_ERROR':
        return '認證失敗，請重新登入';
      case 'PERMISSION_ERROR':
        return '權限不足，無法執行此操作';
      case 'RESOURCE_NOT_FOUND':
        return '找不到要求的資源';
      case 'RATE_LIMIT_ERROR':
        return '請求過於頻繁，請稍後再試';
      default:
        return error.message;
    }
  }

  /// 判斷是否為可重試的錯誤
  static bool _isRetryableError(String errorCode) {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_ERROR',
      'INTERNAL_SERVER_ERROR',
    ];
    return retryableCodes.contains(errorCode);
  }
}
