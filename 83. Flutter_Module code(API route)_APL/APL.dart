
/**
 * APL.dart - 統一API Gateway模組
 * @module 統一APL Gateway
 * @description LCAS 2.0 APL層統一Gateway - P2階段30個API端點完整實作
 * @version v1.1.0
 * @date 2025-01-22
 * @update DCN-0019 Phase 2: 實作P2階段30個API端點路由邏輯
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

  /// 帳本管理服務 (8104 API規格) - 14個API端點
  AccountLedgerService get ledger => AccountLedgerService(this);
  
  /// 帳戶管理服務 (8105 API規格) - 8個API端點
  AccountManagementService get account => AccountManagementService(this);
  
  /// 預算管理服務 (8107 API規格) - 8個API端點
  BudgetManagementService get budget => BudgetManagementService(this);

  /// 釋放資源
  void dispose() {
    _httpClient.close();
  }
}

/// 帳本管理服務類別 (對應8104 API規格 - 14個API端點)
class AccountLedgerService {
  final APLGateway _gateway;
  
  AccountLedgerService(this._gateway);

  /// 1. 取得帳本列表 (GET /ledgers)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getLedgers({
    String? type,
    String? role,
    String? status,
    String? search,
    String? sortBy,
    String? sortOrder,
    int? page,
    int? limit,
    String? userMode,
  }) async {
    final queryParams = <String, String>{};
    if (type != null) queryParams['type'] = type;
    if (role != null) queryParams['role'] = role;
    if (status != null) queryParams['status'] = status;
    if (search != null) queryParams['search'] = search;
    if (sortBy != null) queryParams['sortBy'] = sortBy;
    if (sortOrder != null) queryParams['sortOrder'] = sortOrder;
    if (page != null) queryParams['page'] = page.toString();
    if (limit != null) queryParams['limit'] = limit.toString();

    final headers = <String, String>{..._gateway._defaultHeaders};
    if (userMode != null) headers['X-User-Mode'] = userMode;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/ledgers',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data?['ledgers'] ?? []),
    );
  }

  /// 2. 建立新帳本 (POST /ledgers)
  Future<UnifiedApiResponse<Map<String, dynamic>>> createLedger(Map<String, dynamic> ledgerData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/ledgers',
      ledgerData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 3. 取得帳本詳情 (GET /ledgers/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> getLedgerDetail(String ledgerId, {
    bool? includeTransactions,
    int? transactionLimit,
    String? userMode,
  }) async {
    final queryParams = <String, String>{};
    if (includeTransactions != null) queryParams['includeTransactions'] = includeTransactions.toString();
    if (transactionLimit != null) queryParams['transactionLimit'] = transactionLimit.toString();

    final headers = <String, String>{..._gateway._defaultHeaders};
    if (userMode != null) headers['X-User-Mode'] = userMode;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/ledgers/$ledgerId',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 4. 更新帳本 (PUT /ledgers/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateLedger(String ledgerId, Map<String, dynamic> updateData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'PUT',
      '/api/v1/ledgers/$ledgerId',
      updateData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 5. 刪除帳本 (DELETE /ledgers/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteLedger(String ledgerId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'DELETE',
      '/api/v1/ledgers/$ledgerId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 6. 取得協作者 (GET /ledgers/{id}/collaborators)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getCollaborators(String ledgerId, {
    String? role,
  }) async {
    final queryParams = <String, String>{};
    if (role != null) queryParams['role'] = role;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/ledgers/$ledgerId/collaborators',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data?['collaborators'] ?? []),
    );
  }

  /// 7. 邀請協作者 (POST /ledgers/{id}/invitations)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> inviteCollaborators(String ledgerId, List<Map<String, dynamic>> invitations) async {
    final requestBody = {'invitations': invitations};
    
    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'POST',
      '/api/v1/ledgers/$ledgerId/invitations',
      requestBody,
      null,
      (data) => List<Map<String, dynamic>>.from(data?['results'] ?? []),
    );
  }

  /// 8. 更新協作者權限 (PUT /ledgers/{id}/collaborators/{userId})
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateCollaboratorRole(String ledgerId, String userId, {
    required String role,
    String? reason,
  }) async {
    final requestBody = <String, dynamic>{'role': role};
    if (reason != null) requestBody['reason'] = reason;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'PUT',
      '/api/v1/ledgers/$ledgerId/collaborators/$userId',
      requestBody,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 9. 移除協作者 (DELETE /ledgers/{id}/collaborators/{userId})
  Future<UnifiedApiResponse<Map<String, dynamic>>> removeCollaborator(String ledgerId, String userId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'DELETE',
      '/api/v1/ledgers/$ledgerId/collaborators/$userId',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 10. 取得權限狀態 (GET /ledgers/{id}/permissions)
  Future<UnifiedApiResponse<Map<String, dynamic>>> getPermissions(String ledgerId) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/ledgers/$ledgerId/permissions',
      null,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 11. 檢測協作衝突 (GET /ledgers/{id}/conflicts)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> detectConflicts(String ledgerId, {
    String? checkType,
  }) async {
    final queryParams = <String, String>{};
    if (checkType != null) queryParams['checkType'] = checkType;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/ledgers/$ledgerId/conflicts',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data?['conflicts'] ?? []),
    );
  }

  /// 12. 解決協作衝突 (POST /ledgers/{id}/resolve-conflict)
  Future<UnifiedApiResponse<Map<String, dynamic>>> resolveConflict(String ledgerId, {
    required String conflictId,
    required String resolution,
    String? mergeStrategy,
    Map<String, dynamic>? manualData,
  }) async {
    final requestBody = <String, dynamic>{
      'conflictId': conflictId,
      'resolution': resolution,
    };
    if (mergeStrategy != null) requestBody['mergeStrategy'] = mergeStrategy;
    if (manualData != null) requestBody['manualData'] = manualData;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/ledgers/$ledgerId/resolve-conflict',
      requestBody,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 13. 取得操作審計日誌 (GET /ledgers/{id}/audit-log)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getAuditLog(String ledgerId, {
    String? startDate,
    String? endDate,
    String? userId,
    String? action,
    int? page,
    int? limit,
  }) async {
    final queryParams = <String, String>{};
    if (startDate != null) queryParams['startDate'] = startDate;
    if (endDate != null) queryParams['endDate'] = endDate;
    if (userId != null) queryParams['userId'] = userId;
    if (action != null) queryParams['action'] = action;
    if (page != null) queryParams['page'] = page.toString();
    if (limit != null) queryParams['limit'] = limit.toString();

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/ledgers/$ledgerId/audit-log',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data?['logs'] ?? []),
    );
  }

  /// 14. 取得帳本類型 (GET /ledgers/types)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getLedgerTypes({
    String? userMode,
  }) async {
    final headers = <String, String>{..._gateway._defaultHeaders};
    if (userMode != null) headers['X-User-Mode'] = userMode;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/ledgers/types',
      null,
      null,
      (data) => List<Map<String, dynamic>>.from(data?['types'] ?? []),
    );
  }
}

/// 帳戶管理服務類別 (對應8105 API規格 - 8個API端點)
class AccountManagementService {
  final APLGateway _gateway;
  
  AccountManagementService(this._gateway);

  /// 1. 取得帳戶列表 (GET /accounts)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getAccounts({
    String? ledgerId,
    String? type,
    bool? active,
    bool? includeBalance,
    int? page,
    int? limit,
    String? sortBy,
    String? sortOrder,
  }) async {
    final queryParams = <String, String>{};
    if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
    if (type != null) queryParams['type'] = type;
    if (active != null) queryParams['active'] = active.toString();
    if (includeBalance != null) queryParams['includeBalance'] = includeBalance.toString();
    if (page != null) queryParams['page'] = page.toString();
    if (limit != null) queryParams['limit'] = limit.toString();
    if (sortBy != null) queryParams['sortBy'] = sortBy;
    if (sortOrder != null) queryParams['sortOrder'] = sortOrder;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/accounts',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data?['accounts'] ?? []),
    );
  }

  /// 2. 建立新帳戶 (POST /accounts)
  Future<UnifiedApiResponse<Map<String, dynamic>>> createAccount(Map<String, dynamic> accountData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/accounts',
      accountData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 3. 取得帳戶詳情 (GET /accounts/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> getAccountDetail(String accountId, {
    bool? includeTransactions,
    int? transactionLimit,
  }) async {
    final queryParams = <String, String>{};
    if (includeTransactions != null) queryParams['includeTransactions'] = includeTransactions.toString();
    if (transactionLimit != null) queryParams['transactionLimit'] = transactionLimit.toString();

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/accounts/$accountId',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 4. 更新帳戶 (PUT /accounts/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateAccount(String accountId, Map<String, dynamic> updateData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'PUT',
      '/api/v1/accounts/$accountId',
      updateData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 5. 刪除帳戶 (DELETE /accounts/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteAccount(String accountId, {
    bool? force,
    String? transferTo,
  }) async {
    final queryParams = <String, String>{};
    if (force != null) queryParams['force'] = force.toString();
    if (transferTo != null) queryParams['transferTo'] = transferTo;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'DELETE',
      '/api/v1/accounts/$accountId',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 6. 取得帳戶餘額 (GET /accounts/{id}/balance)
  Future<UnifiedApiResponse<Map<String, dynamic>>> getAccountBalance(String accountId, {
    bool? includeHistory,
    int? historyDays,
  }) async {
    final queryParams = <String, String>{};
    if (includeHistory != null) queryParams['includeHistory'] = includeHistory.toString();
    if (historyDays != null) queryParams['historyDays'] = historyDays.toString();

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/accounts/$accountId/balance',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 7. 取得帳戶類型列表 (GET /accounts/types)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getAccountTypes() async {
    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/accounts/types',
      null,
      null,
      (data) => List<Map<String, dynamic>>.from(data?['types'] ?? []),
    );
  }

  /// 8. 帳戶轉帳 (POST /accounts/transfer)
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

/// 預算管理服務類別 (對應8107 API規格 - 8個API端點)
class BudgetManagementService {
  final APLGateway _gateway;
  
  BudgetManagementService(this._gateway);

  /// 1. 取得預算列表 (GET /budgets)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getBudgets({
    String? ledgerId,
    String? type,
    String? period,
    String? status,
    bool? includeCompleted,
    String? search,
    String? sortBy,
    String? sortOrder,
    int? page,
    int? limit,
    String? userMode,
  }) async {
    final queryParams = <String, String>{};
    if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
    if (type != null) queryParams['type'] = type;
    if (period != null) queryParams['period'] = period;
    if (status != null) queryParams['status'] = status;
    if (includeCompleted != null) queryParams['includeCompleted'] = includeCompleted.toString();
    if (search != null) queryParams['search'] = search;
    if (sortBy != null) queryParams['sortBy'] = sortBy;
    if (sortOrder != null) queryParams['sortOrder'] = sortOrder;
    if (page != null) queryParams['page'] = page.toString();
    if (limit != null) queryParams['limit'] = limit.toString();

    final headers = <String, String>{..._gateway._defaultHeaders};
    if (userMode != null) headers['X-User-Mode'] = userMode;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/budgets',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data?['budgets'] ?? []),
    );
  }

  /// 2. 建立新預算 (POST /budgets)
  Future<UnifiedApiResponse<Map<String, dynamic>>> createBudget(Map<String, dynamic> budgetData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/budgets',
      budgetData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 3. 取得預算詳情 (GET /budgets/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> getBudgetDetail(String budgetId, {
    bool? includeTransactions,
    int? transactionLimit,
    bool? includeHistory,
    int? historyPeriods,
    String? userMode,
  }) async {
    final queryParams = <String, String>{};
    if (includeTransactions != null) queryParams['includeTransactions'] = includeTransactions.toString();
    if (transactionLimit != null) queryParams['transactionLimit'] = transactionLimit.toString();
    if (includeHistory != null) queryParams['includeHistory'] = includeHistory.toString();
    if (historyPeriods != null) queryParams['historyPeriods'] = historyPeriods.toString();

    final headers = <String, String>{..._gateway._defaultHeaders};
    if (userMode != null) headers['X-User-Mode'] = userMode;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/budgets/$budgetId',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 4. 更新預算 (PUT /budgets/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateBudget(String budgetId, Map<String, dynamic> updateData) async {
    return _gateway._forwardRequest<Map<String, dynamic>>(
      'PUT',
      '/api/v1/budgets/$budgetId',
      updateData,
      null,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 5. 刪除預算 (DELETE /budgets/{id})
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteBudget(String budgetId, {
    bool? deleteHistory,
    String? reason,
  }) async {
    final queryParams = <String, String>{};
    if (deleteHistory != null) queryParams['deleteHistory'] = deleteHistory.toString();
    if (reason != null) queryParams['reason'] = reason;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'DELETE',
      '/api/v1/budgets/$budgetId',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 6. 取得預算執行狀況 (GET /budgets/status)
  Future<UnifiedApiResponse<Map<String, dynamic>>> getBudgetStatus({
    String? ledgerId,
    bool? includeInactive,
    String? userMode,
  }) async {
    final queryParams = <String, String>{};
    if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
    if (includeInactive != null) queryParams['includeInactive'] = includeInactive.toString();

    final headers = <String, String>{..._gateway._defaultHeaders};
    if (userMode != null) headers['X-User-Mode'] = userMode;

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'GET',
      '/api/v1/budgets/status',
      null,
      queryParams,
      (data) => Map<String, dynamic>.from(data ?? {}),
    );
  }

  /// 7. 取得預算模板列表 (GET /budgets/templates)
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getBudgetTemplates({
    String? category,
    String? type,
    String? userMode,
  }) async {
    final queryParams = <String, String>{};
    if (category != null) queryParams['category'] = category;
    if (type != null) queryParams['type'] = type;

    final headers = <String, String>{..._gateway._defaultHeaders};
    if (userMode != null) headers['X-User-Mode'] = userMode;

    return _gateway._forwardRequest<List<Map<String, dynamic>>>(
      'GET',
      '/api/v1/budgets/templates',
      null,
      queryParams,
      (data) => List<Map<String, dynamic>>.from(data?['recommended'] ?? []),
    );
  }

  /// 8. 設定預算警示 (POST /budgets/alerts) - 使用templates端點的POST方法
  Future<UnifiedApiResponse<Map<String, dynamic>>> setBudgetAlerts({
    required String budgetId,
    required List<Map<String, dynamic>> alerts,
  }) async {
    final requestBody = {
      'budgetId': budgetId,
      'alerts': alerts,
    };

    return _gateway._forwardRequest<Map<String, dynamic>>(
      'POST',
      '/api/v1/budgets/templates',
      requestBody,
      null,
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
/// // === 帳本管理服務範例 ===
/// // 1. 取得帳本列表
/// final ledgersResponse = await APL.instance.ledger.getLedgers(
///   type: 'all', 
///   sortBy: 'updated_at',
///   userMode: 'Expert'
/// );
/// if (ledgersResponse.success) {
///   print('帳本列表: ${ledgersResponse.data}');
/// }
/// 
/// // 2. 邀請協作者
/// final inviteResponse = await APL.instance.ledger.inviteCollaborators(
///   'ledger123', 
///   [{'email': 'user@example.com', 'role': 'editor'}]
/// );
/// 
/// // === 帳戶管理服務範例 ===
/// // 3. 取得帳戶列表
/// final accountsResponse = await APL.instance.account.getAccounts(
///   ledgerId: 'ledger123',
///   includeBalance: true
/// );
/// 
/// // 4. 帳戶轉帳
/// final transferResponse = await APL.instance.account.transfer({
///   'fromAccountId': 'account1',
///   'toAccountId': 'account2', 
///   'amount': 1000,
///   'description': '轉帳測試'
/// });
/// 
/// // === 預算管理服務範例 ===
/// // 5. 建立預算
/// final budgetResponse = await APL.instance.budget.createBudget({
///   'name': '食物月度預算',
///   'type': 'category',
///   'amount': 12000,
///   'ledgerId': 'ledger123',
///   'target': {'categoryId': 'food-category'}
/// });
/// 
/// // 6. 取得預算狀況
/// final statusResponse = await APL.instance.budget.getBudgetStatus(
///   ledgerId: 'ledger123',
///   userMode: 'Cultivation'
/// );
/// 
/// // 統一錯誤處理
/// if (!response.success) {
///   print('錯誤代碼: ${response.error?.code}');
///   print('錯誤訊息: ${response.error?.message}');
///   print('錯誤詳情: ${response.error?.details}');
/// }
/// ```
