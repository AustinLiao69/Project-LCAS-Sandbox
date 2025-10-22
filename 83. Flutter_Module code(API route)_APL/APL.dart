
/**
 * APL.dart - 統一API Gateway模組
 * @module 統一APL Gateway
 * @description LCAS 2.0 APL層統一Gateway - 專注P2功能的API轉發
 * @version v1.0.0
 * @date 2025-01-22
 * @update DCN-0019 Phase 1: 建立統一APL Gateway框架
 */

import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

/// 統一API回應格式 (符合DCN-0015規範)
class UnifiedApiResponse<T> {
  final bool success;
  final T? data;
  final String message;
  final Map<String, dynamic>? metadata;
  final ApiError? error;

  UnifiedApiResponse({
    required this.success,
    this.data,
    required this.message,
    this.metadata,
    this.error,
  });

  factory UnifiedApiResponse.fromJson(Map<String, dynamic> json, T Function(dynamic) dataParser) {
    return UnifiedApiResponse<T>(
      success: json['success'] ?? false,
      data: json['data'] != null ? dataParser(json['data']) : null,
      message: json['message'] ?? '',
      metadata: json['metadata'],
      error: json['error'] != null ? ApiError.fromJson(json['error']) : null,
    );
  }
}

/// API錯誤模型
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
      details: json['details'],
    );
  }
}

/// 統一APL Gateway類別
class APLGateway {
  // ASL.js服務器配置
  static const String _baseUrl = 'http://0.0.0.0:5000';
  static const Duration _timeout = Duration(seconds: 30);
  
  final http.Client _httpClient;
  final Map<String, String> _defaultHeaders;

  APLGateway() : 
    _httpClient = http.Client(),
    _defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Version': 'v1.0.0',
    };

  /// 統一HTTP請求處理方法
  Future<UnifiedApiResponse<T>> _forwardRequest<T>(
    String method,
    String endpoint,
    Map<String, dynamic>? body,
    Map<String, String>? queryParams,
    T Function(dynamic) dataParser,
  ) async {
    try {
      // 構建完整URL
      String url = '$_baseUrl$endpoint';
      if (queryParams != null && queryParams.isNotEmpty) {
        final queryString = queryParams.entries
            .map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
            .join('&');
        url += '?$queryString';
      }

      final uri = Uri.parse(url);
      http.Response response;

      // 執行HTTP請求
      switch (method.toUpperCase()) {
        case 'GET':
          response = await _httpClient.get(uri, headers: _defaultHeaders).timeout(_timeout);
          break;
        case 'POST':
          response = await _httpClient.post(
            uri,
            headers: _defaultHeaders,
            body: body != null ? jsonEncode(body) : null,
          ).timeout(_timeout);
          break;
        case 'PUT':
          response = await _httpClient.put(
            uri,
            headers: _defaultHeaders,
            body: body != null ? jsonEncode(body) : null,
          ).timeout(_timeout);
          break;
        case 'DELETE':
          response = await _httpClient.delete(uri, headers: _defaultHeaders).timeout(_timeout);
          break;
        default:
          throw Exception('不支援的HTTP方法: $method');
      }

      // 解析回應
      final responseData = jsonDecode(response.body);
      return UnifiedApiResponse.fromJson(responseData, dataParser);

    } on SocketException catch (e) {
      return UnifiedApiResponse<T>(
        success: false,
        message: '網路連線錯誤',
        error: ApiError(
          code: 'NETWORK_ERROR',
          message: '無法連接到服務器: ${e.message}',
          details: {'originalError': e.toString()},
        ),
      );
    } on HttpException catch (e) {
      return UnifiedApiResponse<T>(
        success: false,
        message: 'HTTP請求錯誤',
        error: ApiError(
          code: 'HTTP_ERROR',
          message: e.message,
          details: {'originalError': e.toString()},
        ),
      );
    } on FormatException catch (e) {
      return UnifiedApiResponse<T>(
        success: false,
        message: '回應格式錯誤',
        error: ApiError(
          code: 'PARSE_ERROR',
          message: '無法解析服務器回應: ${e.message}',
          details: {'originalError': e.toString()},
        ),
      );
    } catch (e) {
      return UnifiedApiResponse<T>(
        success: false,
        message: '未知錯誤',
        error: ApiError(
          code: 'UNKNOWN_ERROR',
          message: e.toString(),
          details: {'originalError': e.toString()},
        ),
      );
    }
  }

  /// 帳本管理服務 (8104 API規格)
  AccountLedgerService get ledger => AccountLedgerService(this);
  
  /// 帳戶管理服務 (8105 API規格)
  AccountManagementService get account => AccountManagementService(this);
  
  /// 預算管理服務 (8107 API規格)
  BudgetManagementService get budget => BudgetManagementService(this);

  /// 釋放資源
  void dispose() {
    _httpClient.close();
  }
}

/// 帳本管理服務類別 (對應8104 API規格)
class AccountLedgerService {
  final APLGateway _gateway;
  
  AccountLedgerService(this._gateway);

  /// 取得帳本列表
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getLedgers({
    String? userId,
    int? limit,
    int? page,
  }) async {
    final queryParams = <String, String>{};
    if (userId != null) queryParams['userId'] = userId;
    if (limit != null) queryParams['limit'] = limit.toString();
    if (page != null) queryParams['page'] = page.toString();

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/ledgers',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data ?? []),
    );
  }

  /// 建立新帳本
  Future<UnifiedApiResponse<Map<String, dynamic>>> createLedger(Map<String, dynamic> ledgerData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/ledgers',
      ledgerData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得帳本詳情
  Future<UnifiedApiResponse<Map<String, dynamic>>> getLedgerDetail(String ledgerId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/ledgers/$ledgerId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 更新帳本
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateLedger(String ledgerId, Map<String, dynamic> updateData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'PUT',
      '/api/v1/ledgers/$ledgerId',
      updateData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 刪除帳本
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteLedger(String ledgerId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'DELETE',
      '/api/v1/ledgers/$ledgerId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 分享帳本
  Future<UnifiedApiResponse<Map<String, dynamic>>> shareLedger(String ledgerId, Map<String, dynamic> shareData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/ledgers/$ledgerId/share',
      shareData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得帳本成員
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getLedgerMembers(String ledgerId) async {
    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/ledgers/$ledgerId/members',
      null,
      null,
      (data) => List<Map<String, dynamic>>.from(data ?? []),
    );
  }
}

/// 帳戶管理服務類別 (對應8105 API規格)
class AccountManagementService {
  final APLGateway _gateway;
  
  AccountManagementService(this._gateway);

  /// 取得帳戶列表
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getAccounts({
    String? userId,
    String? ledgerId,
    String? type,
  }) async {
    final queryParams = <String, String>{};
    if (userId != null) queryParams['userId'] = userId;
    if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
    if (type != null) queryParams['type'] = type;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/accounts',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data ?? []),
    );
  }

  /// 建立新帳戶
  Future<UnifiedApiResponse<Map<String, dynamic>>> createAccount(Map<String, dynamic> accountData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/accounts',
      accountData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得帳戶詳情
  Future<UnifiedApiResponse<Map<String, dynamic>>> getAccountDetail(String accountId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/accounts/$accountId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 更新帳戶
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateAccount(String accountId, Map<String, dynamic> updateData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'PUT',
      '/api/v1/accounts/$accountId',
      updateData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 刪除帳戶
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteAccount(String accountId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'DELETE',
      '/api/v1/accounts/$accountId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得帳戶餘額
  Future<UnifiedApiResponse<Map<String, dynamic>>> getAccountBalance(String accountId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/accounts/$accountId/balance',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得帳戶交易記錄
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getAccountTransactions(String accountId, {
    int? limit,
    int? page,
    String? startDate,
    String? endDate,
  }) async {
    final queryParams = <String, String>{};
    if (limit != null) queryParams['limit'] = limit.toString();
    if (page != null) queryParams['page'] = page.toString();
    if (startDate != null) queryParams['startDate'] = startDate;
    if (endDate != null) queryParams['endDate'] = endDate;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/accounts/$accountId/transactions',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data ?? []),
    );
  }

  /// 轉帳操作
  Future<UnifiedApiResponse<Map<String, dynamic>>> transfer(Map<String, dynamic> transferData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/accounts/transfer',
      transferData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }
}

/// 預算管理服務類別 (對應8107 API規格)
class BudgetManagementService {
  final APLGateway _gateway;
  
  BudgetManagementService(this._gateway);

  /// 取得預算列表
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getBudgets({
    String? userId,
    String? ledgerId,
    String? period,
    String? status,
  }) async {
    final queryParams = <String, String>{};
    if (userId != null) queryParams['userId'] = userId;
    if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
    if (period != null) queryParams['period'] = period;
    if (status != null) queryParams['status'] = status;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/budgets',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data ?? []),
    );
  }

  /// 建立新預算
  Future<UnifiedApiResponse<Map<String, dynamic>>> createBudget(Map<String, dynamic> budgetData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/budgets',
      budgetData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得預算詳情
  Future<UnifiedApiResponse<Map<String, dynamic>>> getBudgetDetail(String budgetId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/budgets/$budgetId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 更新預算
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateBudget(String budgetId, Map<String, dynamic> updateData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'PUT',
      '/api/v1/budgets/$budgetId',
      updateData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 刪除預算
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteBudget(String budgetId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'DELETE',
      '/api/v1/budgets/$budgetId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得預算執行狀況
  Future<UnifiedApiResponse<Map<String, dynamic>>> getBudgetExecution(String budgetId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/budgets/$budgetId/execution',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 取得預算警示
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getBudgetAlerts({
    String? userId,
    String? ledgerId,
    String? severity,
  }) async {
    final queryParams = <String, String>{};
    if (userId != null) queryParams['userId'] = userId;
    if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
    if (severity != null) queryParams['severity'] = severity;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/budgets/alerts',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data ?? []),
    );
  }

  /// 取得預算分析
  Future<UnifiedApiResponse<Map<String, dynamic>>> getBudgetAnalytics({
    String? userId,
    String? ledgerId,
    String? period,
  }) async {
    final queryParams = <String, String>{};
    if (userId != null) queryParams['userId'] = userId;
    if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
    if (period != null) queryParams['period'] = period;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/budgets/analytics',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }
}

/// APL Gateway 單例模式
class APL {
  static APLGateway? _instance;
  
  static APLGateway get instance {
    _instance ??= APLGateway();
    return _instance!;
  }
  
  static void dispose() {
    _instance?.dispose();
    _instance = null;
  }
}

/// 使用範例：
/// ```dart
/// // 取得帳本列表
/// final response = await APL.instance.ledger.getLedgers(userId: 'user123');
/// if (response.success) {
///   print('帳本列表: ${response.data}');
/// } else {
///   print('錯誤: ${response.error?.message}');
/// }
/// 
/// // 建立預算
/// final budgetResponse = await APL.instance.budget.createBudget({
///   'name': '月度預算',
///   'amount': 50000,
///   'period': 'monthly',
///   'ledgerId': 'ledger123'
/// });
/// ```
