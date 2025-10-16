/**
 * unified_response_parser.dart
 * @version 1.0.0
 * @date 2025-10-16
 * @description DCN-0015統一回應格式解析器
 */

import 'dart:convert';
import 'package:http/http.dart' as http;

/// 使用者模式列舉
enum UserMode {
  expert,
  inertial,
  cultivation,
  guiding
}

/// 統一API回應格式
class UnifiedApiResponse<T> {
  final bool success;
  final T? data;
  final UnifiedError? error;
  final String message;
  final UnifiedMetadata metadata;
  final UserMode userMode;

  UnifiedApiResponse({
    required this.success,
    this.data,
    this.error,
    required this.message,
    required this.metadata,
    required this.userMode,
  });

  /// 安全取得資料
  T? get safeData => data;

  /// 安全取得錯誤
  UnifiedError? get safeError => error;

  /// 檢查是否成功
  bool get isSuccess => success;
}

/// 統一錯誤格式
class UnifiedError {
  final String code;
  final String message;
  final Map<String, dynamic> details;

  UnifiedError({
    required this.code,
    required this.message,
    required this.details,
  });

  factory UnifiedError.fromJson(Map<String, dynamic> json) {
    return UnifiedError(
      code: json['code'] ?? 'UNKNOWN_ERROR',
      message: json['message'] ?? 'Unknown error occurred',
      details: Map<String, dynamic>.from(json['details'] ?? {}),
    );
  }
}

/// 統一元資料格式
class UnifiedMetadata {
  final String timestamp;
  final String requestId;
  final String userMode;
  final String apiVersion;
  final int processingTimeMs;
  final Map<String, dynamic> modeFeatures;

  UnifiedMetadata({
    required this.timestamp,
    required this.requestId,
    required this.userMode,
    required this.apiVersion,
    required this.processingTimeMs,
    required this.modeFeatures,
  });

  factory UnifiedMetadata.fromJson(Map<String, dynamic> json) {
    return UnifiedMetadata(
      timestamp: json['timestamp'] ?? DateTime.now().toIso8601String(),
      requestId: json['requestId'] ?? 'unknown',
      userMode: json['userMode'] ?? 'Inertial',
      apiVersion: json['apiVersion'] ?? 'v1.0.0',
      processingTimeMs: json['processingTimeMs'] ?? 0,
      modeFeatures: Map<String, dynamic>.from(json['modeFeatures'] ?? {}),
    );
  }
}

/// HTTP回應擴展方法
extension HttpResponseExtension on http.Response {
  /// 轉換為統一回應格式
  UnifiedApiResponse<T> toUnifiedResponse<T>(T Function(Map<String, dynamic>) dataParser) {
    try {
      final jsonData = json.decode(body) as Map<String, dynamic>;

      return UnifiedApiResponse<T>(
        success: jsonData['success'] ?? false,
        data: jsonData['data'] != null ? dataParser(jsonData['data']) : null,
        error: jsonData['error'] != null ? UnifiedError.fromJson(jsonData['error']) : null,
        message: jsonData['message'] ?? '',
        metadata: UnifiedMetadata.fromJson(jsonData['metadata'] ?? {}),
        userMode: _parseUserMode(jsonData['metadata']?['userMode']),
      );
    } catch (e) {
      return UnifiedApiResponse<T>(
        success: false,
        data: null,
        error: UnifiedError(
          code: 'PARSE_ERROR',
          message: '回應解析失敗: $e',
          details: {'originalBody': body},
        ),
        message: '回應解析失敗',
        metadata: UnifiedMetadata(
          timestamp: DateTime.now().toIso8601String(),
          requestId: 'parse_error_${DateTime.now().millisecondsSinceEpoch}',
          userMode: 'Inertial',
          apiVersion: 'v1.0.0',
          processingTimeMs: 0,
          modeFeatures: {},
        ),
        userMode: UserMode.inertial,
      );
    }
  }
}

/// 統一回應解析器
class UnifiedResponseParser {
  /// 處理API錯誤
  static void handleApiError(
    UnifiedError error,
    Function(String) onShowError,
    Function(String) onLogError,
    Function() onRetry,
  ) {
    // 記錄錯誤
    onLogError('API Error [${error.code}]: ${error.message}');

    // 顯示使用者友善錯誤訊息
    onShowError(error.message);

    // 根據錯誤類型決定是否提供重試選項
    if (['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR'].contains(error.code)) {
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
    // 根據使用者模式提供不同的提示和UI更新
    switch (userMode) {
      case UserMode.expert:
        onShowHint('專家模式：顯示詳細資訊');
        onUpdateUI({'showAdvancedOptions': true});
        break;
      case UserMode.cultivation:
        onShowHint('培養模式：提供學習建議');
        onUpdateUI({'showLearningTips': true});
        break;
      case UserMode.guiding:
        onShowHint('引導模式：提供步驟指引');
        onUpdateUI({'showStepGuide': true});
        break;
      case UserMode.inertial:
      default:
        onShowHint('穩定模式：保持簡潔介面');
        onUpdateUI({'showMinimalUI': true});
        break;
    }
  }
}

/// 解析使用者模式
UserMode _parseUserMode(String? modeString) {
  switch (modeString?.toLowerCase()) {
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