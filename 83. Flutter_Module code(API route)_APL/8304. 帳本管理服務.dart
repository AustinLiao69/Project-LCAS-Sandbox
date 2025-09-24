
/**
 * 8304. 帳本管理服務.dart
 * @module 帳本管理服務模組 - API Gateway (DCN-0015適配版)
 * @version 3.0.0
 * @description LCAS 2.0 帳本管理服務 API Gateway - 完整支援DCN-0015統一回應格式
 * @date 2025-09-24
 * @update 2025-09-24: DCN-0015第三階段 - 統一回應格式解析適配（無統一工具類）
 */

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;

// ================================
// DCN-0015 統一回應格式定義
// ================================

/// DCN-0015統一回應格式基礎結構
class UnifiedApiResponse<T> {
  final bool success;
  final T? data;
  final ApiError? error;
  final String message;
  final ResponseMetadata metadata;

  UnifiedApiResponse({
    required this.success,
    this.data,
    this.error,
    required this.message,
    required this.metadata,
  });

  factory UnifiedApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic) dataParser,
  ) {
    return UnifiedApiResponse<T>(
      success: json['success'] ?? false,
      data: json['data'] != null ? dataParser(json['data']) : null,
      error: json['error'] != null ? ApiError.fromJson(json['error']) : null,
      message: json['message'] ?? '',
      metadata: ResponseMetadata.fromJson(json['metadata'] ?? {}),
    );
  }

  /// 安全取得資料，避免null異常
  T? get safeData => data;
  
  /// 安全取得錯誤，避免null異常
  ApiError? get safeError => error;
  
  /// 判斷是否成功
  bool get isSuccess => success;
  
  /// 取得使用者模式
  UserMode get userMode => metadata.userMode;
}

/// API錯誤資訊結構
class ApiError {
  final String code;
  final String message;
  final Map<String, dynamic>? details;

  ApiError({
    required this.code,
    required this.message,
    this.details,
  });

  factory ApiError.fromJson(Map<String, dynamic> json) {
    return ApiError(
      code: json['code'] ?? '',
      message: json['message'] ?? '',
      details: json['details'] != null ? Map<String, dynamic>.from(json['details']) : null,
    );
  }
}

/// 回應元數據結構
class ResponseMetadata {
  final String timestamp;
  final String requestId;
  final UserMode userMode;
  final String apiVersion;
  final int processingTimeMs;
  final ModeFeatures modeFeatures;

  ResponseMetadata({
    required this.timestamp,
    required this.requestId,
    required this.userMode,
    required this.apiVersion,
    required this.processingTimeMs,
    required this.modeFeatures,
  });

  factory ResponseMetadata.fromJson(Map<String, dynamic> json) {
    return ResponseMetadata(
      timestamp: json['timestamp'] ?? '',
      requestId: json['requestId'] ?? '',
      userMode: _parseUserMode(json['userMode'] ?? 'Inertial'),
      apiVersion: json['apiVersion'] ?? 'v1.0.0',
      processingTimeMs: json['processingTimeMs'] ?? 0,
      modeFeatures: ModeFeatures.fromJson(json['modeFeatures'] ?? {}),
    );
  }

  static UserMode _parseUserMode(String mode) {
    switch (mode) {
      case 'Expert':
        return UserMode.expert;
      case 'Cultivation':
        return UserMode.cultivation;
      case 'Guiding':
        return UserMode.guiding;
      case 'Inertial':
      default:
        return UserMode.inertial;
    }
  }
}

/// 使用者模式枚舉
enum UserMode {
  expert,
  inertial,
  cultivation,
  guiding,
}

/// 模式特定功能欄位
class ModeFeatures {
  final Map<String, dynamic> features;

  ModeFeatures({required this.features});

  factory ModeFeatures.fromJson(Map<String, dynamic> json) {
    return ModeFeatures(features: Map<String, dynamic>.from(json));
  }

  bool get stabilityMode => features['stabilityMode'] ?? false;
  bool get detailedAnalytics => features['detailedAnalytics'] ?? false;
  bool get achievementProgress => features['achievementProgress'] ?? false;
  bool get simplifiedInterface => features['simplifiedInterface'] ?? false;
}

/// HTTP回應擴展方法
extension HttpResponseExtension on http.Response {
  UnifiedApiResponse<T> toUnifiedResponse<T>(T Function(dynamic) dataParser) {
    try {
      final jsonData = json.decode(body);
      return UnifiedApiResponse<T>.fromJson(jsonData, dataParser);
    } catch (e) {
      // 當回應格式不符合DCN-0015時，建立相容的錯誤回應
      return UnifiedApiResponse<T>(
        success: false,
        data: null,
        error: ApiError(
          code: 'PARSE_ERROR',
          message: '回應格式解析失敗: ${e.toString()}',
          details: {'originalResponse': body, 'statusCode': statusCode},
        ),
        message: '回應格式解析失敗',
        metadata: ResponseMetadata(
          timestamp: DateTime.now().toIso8601String(),
          requestId: 'parse_error_${DateTime.now().millisecondsSinceEpoch}',
          userMode: UserMode.inertial,
          apiVersion: 'v1.0.0',
          processingTimeMs: 0,
          modeFeatures: ModeFeatures(features: {
            'stabilityMode': true,
            'consistentInterface': true,
            'minimalChanges': true,
          }),
        ),
      );
    }
  }
}

// ================================
// 資料模型類別定義
// ================================

/// 帳本資料模型
class LedgerData {
  final String ledgerId;
  final String userId;
  final String ledgerName;
  final String description;
  final String currency;
  final String status;
  final DateTime createdAt;
  final DateTime lastModified;
  final Map<String, dynamic> settings;
  final List<String> sharedUsers;

  LedgerData({
    required this.ledgerId,
    required this.userId,
    required this.ledgerName,
    required this.description,
    required this.currency,
    required this.status,
    required this.createdAt,
    required this.lastModified,
    required this.settings,
    required this.sharedUsers,
  });

  factory LedgerData.fromJson(Map<String, dynamic> json) {
    return LedgerData(
      ledgerId: json['ledgerId'] ?? '',
      userId: json['userId'] ?? '',
      ledgerName: json['ledgerName'] ?? '',
      description: json['description'] ?? '',
      currency: json['currency'] ?? 'TWD',
      status: json['status'] ?? 'active',
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      lastModified: DateTime.parse(json['lastModified'] ?? DateTime.now().toIso8601String()),
      settings: Map<String, dynamic>.from(json['settings'] ?? {}),
      sharedUsers: List<String>.from(json['sharedUsers'] ?? []),
    );
  }
}

/// 帳本清單回應模型
class LedgerListData {
  final List<LedgerData> ledgers;
  final int totalCount;
  final bool hasMore;
  final String? nextPageToken;

  LedgerListData({
    required this.ledgers,
    required this.totalCount,
    required this.hasMore,
    this.nextPageToken,
  });

  factory LedgerListData.fromJson(Map<String, dynamic> json) {
    final ledgersList = json['ledgers'] as List? ?? [];
    return LedgerListData(
      ledgers: ledgersList.map((l) => LedgerData.fromJson(l)).toList(),
      totalCount: json['totalCount'] ?? 0,
      hasMore: json['hasMore'] ?? false,
      nextPageToken: json['nextPageToken'],
    );
  }
}

/// 帳本摘要模型
class LedgerSummaryData {
  final String ledgerId;
  final double totalIncome;
  final double totalExpense;
  final double balance;
  final int transactionCount;
  final DateTime lastTransactionDate;
  final Map<String, dynamic> statistics;

  LedgerSummaryData({
    required this.ledgerId,
    required this.totalIncome,
    required this.totalExpense,
    required this.balance,
    required this.transactionCount,
    required this.lastTransactionDate,
    required this.statistics,
  });

  factory LedgerSummaryData.fromJson(Map<String, dynamic> json) {
    return LedgerSummaryData(
      ledgerId: json['ledgerId'] ?? '',
      totalIncome: (json['totalIncome'] ?? 0).toDouble(),
      totalExpense: (json['totalExpense'] ?? 0).toDouble(),
      balance: (json['balance'] ?? 0).toDouble(),
      transactionCount: json['transactionCount'] ?? 0,
      lastTransactionDate: DateTime.parse(json['lastTransactionDate'] ?? DateTime.now().toIso8601String()),
      statistics: Map<String, dynamic>.from(json['statistics'] ?? {}),
    );
  }
}

/// 帳本權限模型
class LedgerPermissionData {
  final String userId;
  final String email;
  final String displayName;
  final String role;
  final List<String> permissions;
  final DateTime grantedAt;
  final String grantedBy;

  LedgerPermissionData({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.role,
    required this.permissions,
    required this.grantedAt,
    required this.grantedBy,
  });

  factory LedgerPermissionData.fromJson(Map<String, dynamic> json) {
    return LedgerPermissionData(
      userId: json['userId'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'] ?? '',
      role: json['role'] ?? 'viewer',
      permissions: List<String>.from(json['permissions'] ?? []),
      grantedAt: DateTime.parse(json['grantedAt'] ?? DateTime.now().toIso8601String()),
      grantedBy: json['grantedBy'] ?? '',
    );
  }
}

/// 帳本範本模型
class LedgerTemplateData {
  final String templateId;
  final String templateName;
  final String description;
  final String category;
  final Map<String, dynamic> defaultSettings;
  final List<Map<String, dynamic>> defaultCategories;

  LedgerTemplateData({
    required this.templateId,
    required this.templateName,
    required this.description,
    required this.category,
    required this.defaultSettings,
    required this.defaultCategories,
  });

  factory LedgerTemplateData.fromJson(Map<String, dynamic> json) {
    return LedgerTemplateData(
      templateId: json['templateId'] ?? '',
      templateName: json['templateName'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? '',
      defaultSettings: Map<String, dynamic>.from(json['defaultSettings'] ?? {}),
      defaultCategories: List<Map<String, dynamic>>.from(json['defaultCategories'] ?? []),
    );
  }
}

// ================================
// API Gateway 路由定義
// ================================

/// 帳本管理服務API Gateway (DCN-0015適配版)
class LedgerAPIGateway {
  final String _backendBaseUrl = 'http://0.0.0.0:5000';
  final http.Client _httpClient = http.Client();

  // 回調函數定義
  Function(String)? onShowError;
  Function(String)? onShowHint;
  Function(Map<String, dynamic>)? onUpdateUI;
  Function(String)? onLogError;
  Function()? onRetry;

  LedgerAPIGateway({
    this.onShowError,
    this.onShowHint,
    this.onUpdateUI,
    this.onLogError,
    this.onRetry,
  });

  /**
   * 01. 建立新帳本API路由 (POST /api/v1/ledgers)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerData>> createLedger(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/ledgers', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerData>(
      (data) => LedgerData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 02. 取得帳本列表API路由 (GET /api/v1/ledgers)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerListData>> getLedgers(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/ledgers?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<LedgerListData>(
      (data) => LedgerListData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 03. 取得帳本詳情API路由 (GET /api/v1/ledgers/{id})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerData>> getLedgerDetail(String ledgerId) async {
    final response = await _forwardRequest('GET', '/api/v1/ledgers/$ledgerId', null);
    final unifiedResponse = response.toUnifiedResponse<LedgerData>(
      (data) => LedgerData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 04. 更新帳本資訊API路由 (PUT /api/v1/ledgers/{id})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerData>> updateLedger(String ledgerId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/ledgers/$ledgerId', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerData>(
      (data) => LedgerData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 05. 刪除帳本API路由 (DELETE /api/v1/ledgers/{id})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteLedger(String ledgerId, Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('DELETE', '/api/v1/ledgers/$ledgerId?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 06. 取得帳本摘要統計API路由 (GET /api/v1/ledgers/{id}/summary)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerSummaryData>> getLedgerSummary(String ledgerId, Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/ledgers/$ledgerId/summary?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<LedgerSummaryData>(
      (data) => LedgerSummaryData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 07. 設定預設帳本API路由 (PUT /api/v1/ledgers/{id}/set-default)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> setDefaultLedger(String ledgerId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/ledgers/$ledgerId/set-default', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 08. 複製帳本API路由 (POST /api/v1/ledgers/{id}/clone)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerData>> cloneLedger(String ledgerId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/ledgers/$ledgerId/clone', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerData>(
      (data) => LedgerData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 09. 歸檔帳本API路由 (PUT /api/v1/ledgers/{id}/archive)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerData>> archiveLedger(String ledgerId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/ledgers/$ledgerId/archive', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerData>(
      (data) => LedgerData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 10. 恢復已歸檔帳本API路由 (PUT /api/v1/ledgers/{id}/restore)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerData>> restoreLedger(String ledgerId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/ledgers/$ledgerId/restore', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerData>(
      (data) => LedgerData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 11. 取得帳本權限列表API路由 (GET /api/v1/ledgers/{id}/permissions)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<List<LedgerPermissionData>>> getLedgerPermissions(String ledgerId) async {
    final response = await _forwardRequest('GET', '/api/v1/ledgers/$ledgerId/permissions', null);
    final unifiedResponse = response.toUnifiedResponse<List<LedgerPermissionData>>(
      (data) => (data as List).map((p) => LedgerPermissionData.fromJson(p)).toList(),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 12. 新增帳本權限API路由 (POST /api/v1/ledgers/{id}/permissions)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerPermissionData>> addLedgerPermission(String ledgerId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/ledgers/$ledgerId/permissions', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerPermissionData>(
      (data) => LedgerPermissionData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 13. 更新帳本權限API路由 (PUT /api/v1/ledgers/{id}/permissions/{userId})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerPermissionData>> updateLedgerPermission(
    String ledgerId,
    String userId,
    Map<String, dynamic> requestBody,
  ) async {
    final response = await _forwardRequest('PUT', '/api/v1/ledgers/$ledgerId/permissions/$userId', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerPermissionData>(
      (data) => LedgerPermissionData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 14. 刪除帳本權限API路由 (DELETE /api/v1/ledgers/{id}/permissions/{userId})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> removeLedgerPermission(String ledgerId, String userId) async {
    final response = await _forwardRequest('DELETE', '/api/v1/ledgers/$ledgerId/permissions/$userId', null);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 15. 取得帳本範本列表API路由 (GET /api/v1/ledgers/templates)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<List<LedgerTemplateData>>> getLedgerTemplates(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/ledgers/templates?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<List<LedgerTemplateData>>(
      (data) => (data as List).map((t) => LedgerTemplateData.fromJson(t)).toList(),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 16. 使用範本建立帳本API路由 (POST /api/v1/ledgers/from-template)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<LedgerData>> createLedgerFromTemplate(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/ledgers/from-template', requestBody);
    final unifiedResponse = response.toUnifiedResponse<LedgerData>(
      (data) => LedgerData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  // ================================
  // 私有方法：統一請求轉發機制
  // ================================

  /**
   * 統一請求轉發方法
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一錯誤處理適配
   */
  Future<http.Response> _forwardRequest(
    String method,
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    try {
      final uri = Uri.parse('$_backendBaseUrl$endpoint');
      final headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      http.Response response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await _httpClient.get(uri, headers: headers);
          break;
        case 'POST':
          response = await _httpClient.post(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'PUT':
          response = await _httpClient.put(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'DELETE':
          response = await _httpClient.delete(uri, headers: headers);
          break;
        default:
          throw Exception('不支援的HTTP方法: $method');
      }

      return response;
    } catch (e) {
      // 返回DCN-0015格式的錯誤回應
      return http.Response(
        json.encode(_createUnifiedErrorResponse(
          'GATEWAY_ERROR',
          '網關轉發失敗: ${e.toString()}',
        )),
        500,
        headers: {'content-type': 'application/json'},
      );
    }
  }

  /**
   * 建立DCN-0015格式錯誤回應
   * @version 3.0.0
   * @date 2025-09-24
   * @description 確保錯誤回應符合DCN-0015規範
   */
  Map<String, dynamic> _createUnifiedErrorResponse(String errorCode, String errorMessage) {
    return {
      'success': false,
      'data': null,
      'error': {
        'code': errorCode,
        'message': errorMessage,
        'details': {'timestamp': DateTime.now().toIso8601String()},
      },
      'message': errorMessage,
      'metadata': {
        'timestamp': DateTime.now().toIso8601String(),
        'requestId': 'error_${DateTime.now().millisecondsSinceEpoch}',
        'userMode': 'Inertial',
        'apiVersion': 'v1.0.0',
        'processingTimeMs': 0,
        'modeFeatures': {
          'stabilityMode': true,
          'consistentInterface': true,
          'minimalChanges': true,
          'quickActions': true,
          'familiarLayout': true,
        },
      },
    };
  }

  /**
   * 處理回應後的統一邏輯
   * @version 3.0.0
   * @date 2025-09-24
   * @description DCN-0015模式特定處理和錯誤處理
   */
  void _handleResponseProcessing<T>(UnifiedApiResponse<T> response) {
    // 處理錯誤情況
    if (!response.isSuccess && response.safeError != null) {
      _handleApiError(
        response.safeError!,
        onShowError ?? (message) => print('Error: $message'),
        onLogError ?? (message) => print('Log: $message'),
        onRetry ?? () => print('Retry requested'),
      );
      return;
    }

    // 處理模式特定邏輯
    _handleModeSpecificLogic(
      response.userMode,
      response.metadata.modeFeatures,
      onShowHint ?? (message) => print('Hint: $message'),
      onUpdateUI ?? (updates) => print('UI Update: $updates'),
    );
  }

  /**
   * API錯誤處理機制
   * @version 3.0.0
   * @date 2025-09-24
   * @description 統一的API錯誤處理邏輯
   */
  void _handleApiError(
    ApiError error,
    Function(String) showError,
    Function(String) logError,
    Function() retry,
  ) {
    // 記錄錯誤日誌
    logError('API錯誤 [${error.code}]: ${error.message}');
    
    // 根據錯誤代碼決定處理方式
    switch (error.code) {
      case 'NETWORK_ERROR':
      case 'TIMEOUT_ERROR':
        showError('網路連線異常，請檢查網路設定');
        break;
      case 'AUTHENTICATION_ERROR':
        showError('身份驗證失敗，請重新登入');
        break;
      case 'AUTHORIZATION_ERROR':
        showError('權限不足，無法執行此操作');
        break;
      case 'VALIDATION_ERROR':
        showError('輸入資料格式錯誤，請檢查後重試');
        break;
      case 'RESOURCE_NOT_FOUND':
        showError('找不到指定的資源');
        break;
      case 'BUSINESS_LOGIC_ERROR':
        showError(error.message);
        break;
      case 'INTERNAL_SERVER_ERROR':
      default:
        showError('系統暫時無法處理請求，請稍後重試');
        break;
    }
  }

  /**
   * 模式特定邏輯處理
   * @version 3.0.0
   * @date 2025-09-24
   * @description 根據使用者模式執行對應的UI邏輯
   */
  void _handleModeSpecificLogic(
    UserMode userMode,
    ModeFeatures modeFeatures,
    Function(String) showHint,
    Function(Map<String, dynamic>) updateUI,
  ) {
    switch (userMode) {
      case UserMode.expert:
        if (modeFeatures.detailedAnalytics) {
          updateUI({'showDetailedAnalytics': true});
          showHint('已啟用專家分析模式');
        }
        break;
      case UserMode.cultivation:
        if (modeFeatures.achievementProgress) {
          updateUI({'showAchievements': true});
          showHint('繼續努力，累積更多成就！');
        }
        break;
      case UserMode.guiding:
        if (modeFeatures.simplifiedInterface) {
          updateUI({'useSimplifiedUI': true});
          showHint('已為您簡化介面，更易於操作');
        }
        break;
      case UserMode.inertial:
      default:
        if (modeFeatures.stabilityMode) {
          updateUI({'useStableInterface': true});
        }
        break;
    }
  }

  /**
   * 清理資源
   * @version 3.0.0
   * @date 2025-09-24
   * @update: Gateway資源清理
   */
  void dispose() {
    _httpClient.close();
  }
}

// ================================
// 路由映射表
// ================================

/// 帳本管理API路由映射配置
class LedgerRoutes {
  static const Map<String, String> routes = {
    'POST /api/v1/ledgers': '/api/v1/ledgers',
    'GET /api/v1/ledgers': '/api/v1/ledgers',
    'GET /api/v1/ledgers/{id}': '/api/v1/ledgers/{id}',
    'PUT /api/v1/ledgers/{id}': '/api/v1/ledgers/{id}',
    'DELETE /api/v1/ledgers/{id}': '/api/v1/ledgers/{id}',
    'GET /api/v1/ledgers/{id}/summary': '/api/v1/ledgers/{id}/summary',
    'PUT /api/v1/ledgers/{id}/set-default': '/api/v1/ledgers/{id}/set-default',
    'POST /api/v1/ledgers/{id}/clone': '/api/v1/ledgers/{id}/clone',
    'PUT /api/v1/ledgers/{id}/archive': '/api/v1/ledgers/{id}/archive',
    'PUT /api/v1/ledgers/{id}/restore': '/api/v1/ledgers/{id}/restore',
    'GET /api/v1/ledgers/{id}/permissions': '/api/v1/ledgers/{id}/permissions',
    'POST /api/v1/ledgers/{id}/permissions': '/api/v1/ledgers/{id}/permissions',
    'PUT /api/v1/ledgers/{id}/permissions/{userId}': '/api/v1/ledgers/{id}/permissions/{userId}',
    'DELETE /api/v1/ledgers/{id}/permissions/{userId}': '/api/v1/ledgers/{id}/permissions/{userId}',
    'GET /api/v1/ledgers/templates': '/api/v1/ledgers/templates',
    'POST /api/v1/ledgers/from-template': '/api/v1/ledgers/from-template',
  };
}

// ================================
// 使用範例
// ================================

/// DCN-0015統一回應格式使用範例
class LedgerGatewayUsageExample {
  late LedgerAPIGateway ledgerGateway;

  void initializeGateway() {
    ledgerGateway = LedgerAPIGateway(
      onShowError: (message) {
        // 顯示錯誤訊息給使用者
        print('顯示錯誤: $message');
      },
      onShowHint: (message) {
        // 顯示提示訊息
        print('顯示提示: $message');
      },
      onUpdateUI: (updates) {
        // 更新UI狀態
        print('更新UI: $updates');
      },
      onLogError: (message) {
        // 記錄錯誤日誌
        print('錯誤日誌: $message');
      },
      onRetry: () {
        // 重試邏輯
        print('執行重試');
      },
    );
  }

  Future<void> createNewLedger(Map<String, dynamic> ledgerData) async {
    final response = await ledgerGateway.createLedger(ledgerData);

    if (response.isSuccess) {
      final newLedger = response.safeData;
      print('帳本建立成功: ${newLedger?.ledgerName}');
      
      // 根據用戶模式顯示不同反饋
      switch (response.userMode) {
        case UserMode.expert:
          print('帳本已建立，ID: ${newLedger?.ledgerId}');
          print('進階設定已可在帳本管理中調整');
          break;
        case UserMode.guiding:
          print('太棒了！您成功建立了新帳本');
          print('提示：可以邀請家人朋友一起記帳');
          break;
        case UserMode.cultivation:
          print('恭喜！建立帳本獲得經驗值+5');
          print('解鎖新成就：「帳本管理者」');
          break;
        case UserMode.inertial:
        default:
          print('帳本已建立');
          break;
      }
    } else {
      // 錯誤已由_handleResponseProcessing自動處理
      print('帳本建立失敗，錯誤已自動處理');
    }
  }

  Future<void> loadLedgerList(String userId) async {
    final queryParams = {'userId': userId, 'status': 'active'};
    final response = await ledgerGateway.getLedgers(queryParams);

    if (response.isSuccess) {
      final ledgerList = response.safeData;
      print('帳本列表載入成功，共 ${ledgerList?.totalCount} 個帳本');
      
      // 根據用戶模式調整列表顯示
      switch (response.userMode) {
        case UserMode.expert:
          // 顯示詳細統計和分析選項
          print('載入進階分析功能');
          break;
        case UserMode.guiding:
          // 顯示簡化版本和使用提示
          print('載入簡化帳本列表');
          break;
        case UserMode.cultivation:
          // 顯示成就和進度追蹤
          print('載入成就進度追蹤');
          break;
        case UserMode.inertial:
        default:
          // 顯示標準版本
          print('載入標準帳本列表');
          break;
      }
    }
  }
}
