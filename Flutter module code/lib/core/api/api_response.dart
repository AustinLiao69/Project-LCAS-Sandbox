
/**
 * API_Response_1.0.0
 * @module API回應模組
 * @description LCAS 2.0 統一API回應格式定義
 * @update 2025-01-23: 建立版本，定義統一回應格式與錯誤處理
 */

import 'package:json_annotation/json_annotation.dart';

part 'api_response.g.dart';

/// 01. 統一API回應基礎類別
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 定義所有API回應的統一格式，包含成功與錯誤狀態
@JsonSerializable(genericArgumentFactories: true)
class ApiResponse<T> {
  /// 回應狀態：success 或 error
  @JsonKey(name: 'status')
  final String status;
  
  /// 回應代碼
  @JsonKey(name: 'code')
  final String code;
  
  /// 回應訊息
  @JsonKey(name: 'message')
  final String message;
  
  /// 回應資料
  @JsonKey(name: 'data')
  final T? data;
  
  /// 時間戳記
  @JsonKey(name: 'timestamp')
  final String timestamp;
  
  /// 分頁資訊（可選）
  @JsonKey(name: 'pagination')
  final PaginationInfo? pagination;
  
  /// 額外資訊（可選）
  @JsonKey(name: 'metadata')
  final Map<String, dynamic>? metadata;

  const ApiResponse({
    required this.status,
    required this.code,
    required this.message,
    this.data,
    required this.timestamp,
    this.pagination,
    this.metadata,
  });

  /// 02. 建立成功回應
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 建立表示成功的API回應物件
  factory ApiResponse.success({
    required T data,
    String? message,
    String? code,
    PaginationInfo? pagination,
    Map<String, dynamic>? metadata,
  }) {
    return ApiResponse<T>(
      status: 'success',
      code: code ?? 'SUCCESS',
      message: message ?? '操作成功',
      data: data,
      timestamp: DateTime.now().toIso8601String(),
      pagination: pagination,
      metadata: metadata,
    );
  }

  /// 03. 建立錯誤回應
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 建立表示錯誤的API回應物件
  factory ApiResponse.error({
    required String code,
    required String message,
    T? data,
    Map<String, dynamic>? metadata,
  }) {
    return ApiResponse<T>(
      status: 'error',
      code: code,
      message: message,
      data: data,
      timestamp: DateTime.now().toIso8601String(),
      metadata: metadata,
    );
  }

  /// 04. 檢查是否為成功回應
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 判斷API回應是否表示操作成功
  bool get isSuccess => status == 'success';

  /// 05. 檢查是否為錯誤回應
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 判斷API回應是否表示操作失敗
  bool get isError => status == 'error';

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Object? json) fromJsonT,
  ) =>
      _$ApiResponseFromJson(json, fromJsonT);

  Map<String, dynamic> toJson(Object Function(T value) toJsonT) =>
      _$ApiResponseToJson(this, toJsonT);
}

/// 06. 分頁資訊類別
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 定義分頁查詢的相關資訊
@JsonSerializable()
class PaginationInfo {
  /// 當前頁碼
  @JsonKey(name: 'current_page')
  final int currentPage;
  
  /// 每頁項目數
  @JsonKey(name: 'page_size')
  final int pageSize;
  
  /// 總頁數
  @JsonKey(name: 'total_pages')
  final int totalPages;
  
  /// 總項目數
  @JsonKey(name: 'total_items')
  final int totalItems;
  
  /// 是否有下一頁
  @JsonKey(name: 'has_next')
  final bool hasNext;
  
  /// 是否有上一頁
  @JsonKey(name: 'has_previous')
  final bool hasPrevious;

  const PaginationInfo({
    required this.currentPage,
    required this.pageSize,
    required this.totalPages,
    required this.totalItems,
    required this.hasNext,
    required this.hasPrevious,
  });

  factory PaginationInfo.fromJson(Map<String, dynamic> json) =>
      _$PaginationInfoFromJson(json);

  Map<String, dynamic> toJson() => _$PaginationInfoToJson(this);
}

/// 07. API錯誤例外類別
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 定義API呼叫過程中可能發生的各種錯誤
class ApiException implements Exception {
  /// 錯誤代碼
  final String code;
  
  /// 錯誤訊息
  final String message;
  
  /// HTTP狀態碼
  final int? statusCode;
  
  /// 額外錯誤資訊
  final Map<String, dynamic>? details;

  const ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.details,
  });

  /// 08. 建立網路錯誤例外
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 建立表示網路連線問題的錯誤例外
  factory ApiException.networkError({String? message}) {
    return ApiException(
      code: 'NETWORK_ERROR',
      message: message ?? '網路連線異常，請檢查網路設定',
    );
  }

  /// 09. 建立逾時錯誤例外
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 建立表示請求逾時的錯誤例外
  factory ApiException.timeout({String? message}) {
    return ApiException(
      code: 'TIMEOUT_ERROR',
      message: message ?? '請求逾時，請稍後重試',
    );
  }

  /// 10. 建立伺服器錯誤例外
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 建立表示伺服器內部錯誤的例外
  factory ApiException.serverError({
    String? message,
    int? statusCode,
  }) {
    return ApiException(
      code: 'SERVER_ERROR',
      message: message ?? '伺服器發生錯誤，請稍後重試',
      statusCode: statusCode,
    );
  }

  /// 11. 建立驗證錯誤例外
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 建立表示身份驗證失敗的錯誤例外
  factory ApiException.unauthorized({String? message}) {
    return ApiException(
      code: 'UNAUTHORIZED',
      message: message ?? '身份驗證失敗，請重新登入',
      statusCode: 401,
    );
  }

  @override
  String toString() {
    return 'ApiException(code: $code, message: $message, statusCode: $statusCode)';
  }
}
