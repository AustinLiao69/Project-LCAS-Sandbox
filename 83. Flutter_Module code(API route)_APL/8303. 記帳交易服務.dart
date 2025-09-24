
/**
 * 8303. 記帳交易服務.dart
 * @module 記帳交易服務 - API Gateway (DCN-0015適配版)
 * @version 3.0.0
 * @description LCAS 2.0 記帳交易服務 API Gateway - 完整支援DCN-0015統一回應格式
 * @date 2025-09-24
 * @update 2025-09-24: DCN-0015第三階段 - 統一回應格式解析適配
 */

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'unified_response_parser.dart';

// ================================
// 資料模型類別定義
// ================================

/// 交易記錄模型
class TransactionData {
  final String transactionId;
  final String ledgerId;
  final String accountId;
  final String categoryId;
  final double amount;
  final String type;
  final String description;
  final DateTime transactionDate;
  final List<String> attachments;
  final Map<String, dynamic> metadata;

  TransactionData({
    required this.transactionId,
    required this.ledgerId,
    required this.accountId,
    required this.categoryId,
    required this.amount,
    required this.type,
    required this.description,
    required this.transactionDate,
    required this.attachments,
    required this.metadata,
  });

  factory TransactionData.fromJson(Map<String, dynamic> json) {
    return TransactionData(
      transactionId: json['transactionId'] ?? '',
      ledgerId: json['ledgerId'] ?? '',
      accountId: json['accountId'] ?? '',
      categoryId: json['categoryId'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      type: json['type'] ?? '',
      description: json['description'] ?? '',
      transactionDate: DateTime.parse(json['transactionDate'] ?? DateTime.now().toIso8601String()),
      attachments: List<String>.from(json['attachments'] ?? []),
      metadata: Map<String, dynamic>.from(json['metadata'] ?? {}),
    );
  }
}

/// 交易清單回應模型
class TransactionListData {
  final List<TransactionData> transactions;
  final int totalCount;
  final bool hasMore;
  final String? nextPageToken;

  TransactionListData({
    required this.transactions,
    required this.totalCount,
    required this.hasMore,
    this.nextPageToken,
  });

  factory TransactionListData.fromJson(Map<String, dynamic> json) {
    final transactionsList = json['transactions'] as List? ?? [];
    return TransactionListData(
      transactions: transactionsList.map((t) => TransactionData.fromJson(t)).toList(),
      totalCount: json['totalCount'] ?? 0,
      hasMore: json['hasMore'] ?? false,
      nextPageToken: json['nextPageToken'],
    );
  }
}

/// 儀表板數據模型
class DashboardData {
  final double totalIncome;
  final double totalExpense;
  final double balance;
  final List<CategorySummary> categoryBreakdown;
  final List<TransactionData> recentTransactions;
  final Map<String, dynamic> charts;

  DashboardData({
    required this.totalIncome,
    required this.totalExpense,
    required this.balance,
    required this.categoryBreakdown,
    required this.recentTransactions,
    required this.charts,
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    final categoryList = json['categoryBreakdown'] as List? ?? [];
    final recentList = json['recentTransactions'] as List? ?? [];
    
    return DashboardData(
      totalIncome: (json['totalIncome'] ?? 0).toDouble(),
      totalExpense: (json['totalExpense'] ?? 0).toDouble(),
      balance: (json['balance'] ?? 0).toDouble(),
      categoryBreakdown: categoryList.map((c) => CategorySummary.fromJson(c)).toList(),
      recentTransactions: recentList.map((t) => TransactionData.fromJson(t)).toList(),
      charts: Map<String, dynamic>.from(json['charts'] ?? {}),
    );
  }
}

/// 科目摘要模型
class CategorySummary {
  final String categoryId;
  final String categoryName;
  final double amount;
  final int transactionCount;
  final double percentage;

  CategorySummary({
    required this.categoryId,
    required this.categoryName,
    required this.amount,
    required this.transactionCount,
    required this.percentage,
  });

  factory CategorySummary.fromJson(Map<String, dynamic> json) {
    return CategorySummary(
      categoryId: json['categoryId'] ?? '',
      categoryName: json['categoryName'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      transactionCount: json['transactionCount'] ?? 0,
      percentage: (json['percentage'] ?? 0).toDouble(),
    );
  }
}

/// 統計數據模型
class StatisticsData {
  final Map<String, double> monthlyTrends;
  final Map<String, double> categoryDistribution;
  final Map<String, int> transactionCounts;
  final List<Map<String, dynamic>> comparisons;

  StatisticsData({
    required this.monthlyTrends,
    required this.categoryDistribution,
    required this.transactionCounts,
    required this.comparisons,
  });

  factory StatisticsData.fromJson(Map<String, dynamic> json) {
    return StatisticsData(
      monthlyTrends: Map<String, double>.from(json['monthlyTrends'] ?? {}),
      categoryDistribution: Map<String, double>.from(json['categoryDistribution'] ?? {}),
      transactionCounts: Map<String, int>.from(json['transactionCounts'] ?? {}),
      comparisons: List<Map<String, dynamic>>.from(json['comparisons'] ?? []),
    );
  }
}

/// 批量操作結果模型
class BatchOperationResult {
  final int totalRequested;
  final int successCount;
  final int failedCount;
  final List<String> successIds;
  final List<BatchError> errors;

  BatchOperationResult({
    required this.totalRequested,
    required this.successCount,
    required this.failedCount,
    required this.successIds,
    required this.errors,
  });

  factory BatchOperationResult.fromJson(Map<String, dynamic> json) {
    final errorsList = json['errors'] as List? ?? [];
    return BatchOperationResult(
      totalRequested: json['totalRequested'] ?? 0,
      successCount: json['successCount'] ?? 0,
      failedCount: json['failedCount'] ?? 0,
      successIds: List<String>.from(json['successIds'] ?? []),
      errors: errorsList.map((e) => BatchError.fromJson(e)).toList(),
    );
  }
}

/// 批量錯誤模型
class BatchError {
  final String itemId;
  final String errorCode;
  final String errorMessage;

  BatchError({
    required this.itemId,
    required this.errorCode,
    required this.errorMessage,
  });

  factory BatchError.fromJson(Map<String, dynamic> json) {
    return BatchError(
      itemId: json['itemId'] ?? '',
      errorCode: json['errorCode'] ?? '',
      errorMessage: json['errorMessage'] ?? '',
    );
  }
}

// ================================
// API Gateway 路由定義
// ================================

/// 記帳交易服務API Gateway (DCN-0015適配版)
class TransactionAPIGateway {
  final String _backendBaseUrl = 'http://0.0.0.0:5000';
  final http.Client _httpClient = http.Client();

  // 回調函數定義
  Function(String)? onShowError;
  Function(String)? onShowHint;
  Function(Map<String, dynamic>)? onUpdateUI;
  Function(String)? onLogError;
  Function()? onRetry;

  TransactionAPIGateway({
    this.onShowError,
    this.onShowHint,
    this.onUpdateUI,
    this.onLogError,
    this.onRetry,
  });

  /**
   * 01. LINE OA 快速記帳API路由 (POST /api/v1/transactions/quick)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<TransactionData>> quickBooking(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/transactions/quick', requestBody);
    final unifiedResponse = response.toUnifiedResponse<TransactionData>(
      (data) => TransactionData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 02. 查詢交易記錄列表API路由 (GET /api/v1/transactions)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<TransactionListData>> getTransactions(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/transactions?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<TransactionListData>(
      (data) => TransactionListData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 03. 新增交易記錄API路由 (POST /api/v1/transactions)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<TransactionData>> createTransaction(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/transactions', requestBody);
    final unifiedResponse = response.toUnifiedResponse<TransactionData>(
      (data) => TransactionData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 04. 取得交易記錄詳情API路由 (GET /api/v1/transactions/{id})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<TransactionData>> getTransactionDetail(String transactionId) async {
    final response = await _forwardRequest('GET', '/api/v1/transactions/$transactionId', null);
    final unifiedResponse = response.toUnifiedResponse<TransactionData>(
      (data) => TransactionData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 05. 更新交易記錄API路由 (PUT /api/v1/transactions/{id})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<TransactionData>> updateTransaction(String transactionId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/transactions/$transactionId', requestBody);
    final unifiedResponse = response.toUnifiedResponse<TransactionData>(
      (data) => TransactionData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 06. 刪除交易記錄API路由 (DELETE /api/v1/transactions/{id})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteTransaction(String transactionId, Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('DELETE', '/api/v1/transactions/$transactionId?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 07. 取得記帳主頁儀表板數據API路由 (GET /api/v1/transactions/dashboard)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<DashboardData>> getDashboard(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/transactions/dashboard?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<DashboardData>(
      (data) => DashboardData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 08. 取得交易統計數據API路由 (GET /api/v1/transactions/statistics)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<StatisticsData>> getStatistics(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/transactions/statistics?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<StatisticsData>(
      (data) => StatisticsData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 09. 取得最近交易記錄API路由 (GET /api/v1/transactions/recent)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<List<TransactionData>>> getRecentTransactions(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/transactions/recent?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<List<TransactionData>>(
      (data) => (data as List).map((t) => TransactionData.fromJson(t)).toList(),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 10. 取得圖表數據API路由 (GET /api/v1/transactions/charts)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> getChartData(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final response = await _forwardRequest('GET', '/api/v1/transactions/charts?$queryString', null);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 11. 批量新增交易API路由 (POST /api/v1/transactions/batch)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<BatchOperationResult>> batchCreateTransactions(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/transactions/batch', requestBody);
    final unifiedResponse = response.toUnifiedResponse<BatchOperationResult>(
      (data) => BatchOperationResult.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 12. 批量更新交易API路由 (PUT /api/v1/transactions/batch)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<BatchOperationResult>> batchUpdateTransactions(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/transactions/batch', requestBody);
    final unifiedResponse = response.toUnifiedResponse<BatchOperationResult>(
      (data) => BatchOperationResult.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 13. 批量刪除交易API路由 (DELETE /api/v1/transactions/batch)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<BatchOperationResult>> batchDeleteTransactions(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('DELETE', '/api/v1/transactions/batch', requestBody);
    final unifiedResponse = response.toUnifiedResponse<BatchOperationResult>(
      (data) => BatchOperationResult.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 14. 上傳附件API路由 (POST /api/v1/transactions/{id}/attachments)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> uploadAttachment(String transactionId, Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/transactions/$transactionId/attachments', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 15. 刪除附件API路由 (DELETE /api/v1/transactions/{id}/attachments/{attachmentId})
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> deleteAttachment(String transactionId, String attachmentId) async {
    final response = await _forwardRequest('DELETE', '/api/v1/transactions/$transactionId/attachments/$attachmentId', null);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
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
      UnifiedResponseParser.handleApiError(
        response.safeError!,
        onShowError ?? (message) => print('Error: $message'),
        onLogError ?? (message) => print('Log: $message'),
        onRetry ?? () => print('Retry requested'),
      );
      return;
    }

    // 處理模式特定邏輯
    UnifiedResponseParser.handleModeSpecificLogic(
      response.userMode,
      response.metadata.modeFeatures,
      onShowHint ?? (message) => print('Hint: $message'),
      onUpdateUI ?? (updates) => print('UI Update: $updates'),
    );
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

/// 記帳交易API路由映射配置
class TransactionRoutes {
  static const Map<String, String> routes = {
    'POST /api/v1/transactions/quick': '/api/v1/transactions/quick',
    'GET /api/v1/transactions': '/api/v1/transactions',
    'POST /api/v1/transactions': '/api/v1/transactions',
    'GET /api/v1/transactions/{id}': '/api/v1/transactions/{id}',
    'PUT /api/v1/transactions/{id}': '/api/v1/transactions/{id}',
    'DELETE /api/v1/transactions/{id}': '/api/v1/transactions/{id}',
    'GET /api/v1/transactions/dashboard': '/api/v1/transactions/dashboard',
    'GET /api/v1/transactions/statistics': '/api/v1/transactions/statistics',
    'GET /api/v1/transactions/recent': '/api/v1/transactions/recent',
    'GET /api/v1/transactions/charts': '/api/v1/transactions/charts',
    'POST /api/v1/transactions/batch': '/api/v1/transactions/batch',
    'PUT /api/v1/transactions/batch': '/api/v1/transactions/batch',
    'DELETE /api/v1/transactions/batch': '/api/v1/transactions/batch',
    'POST /api/v1/transactions/{id}/attachments': '/api/v1/transactions/{id}/attachments',
    'DELETE /api/v1/transactions/{id}/attachments/{attachmentId}': '/api/v1/transactions/{id}/attachments/{attachmentId}',
  };
}

// ================================
// 使用範例
// ================================

/// DCN-0015統一回應格式使用範例
class TransactionGatewayUsageExample {
  late TransactionAPIGateway transactionGateway;

  void initializeGateway() {
    transactionGateway = TransactionAPIGateway(
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

  Future<void> createNewTransaction(Map<String, dynamic> transactionData) async {
    final response = await transactionGateway.createTransaction(transactionData);

    if (response.isSuccess) {
      final newTransaction = response.safeData;
      print('交易建立成功: ${newTransaction?.description}');
      
      // 根據用戶模式顯示不同反饋
      switch (response.userMode) {
        case UserMode.expert:
          print('交易已建立，ID: ${newTransaction?.transactionId}');
          print('詳細數據已記錄，可在分析報表中查看');
          break;
        case UserMode.guiding:
          print('太棒了！您成功新增了一筆交易');
          print('提示：記得為交易添加詳細描述幫助日後回憶');
          break;
        case UserMode.cultivation:
          print('恭喜！新增交易獲得經驗值+3');
          print('持續記帳，達成每日記帳目標！');
          break;
        case UserMode.inertial:
        default:
          print('交易已新增');
          break;
      }
    } else {
      // 錯誤已由_handleResponseProcessing自動處理
      print('交易建立失敗，錯誤已自動處理');
    }
  }

  Future<void> loadDashboard(String userId) async {
    final queryParams = {'userId': userId, 'period': 'currentMonth'};
    final response = await transactionGateway.getDashboard(queryParams);

    if (response.isSuccess) {
      final dashboard = response.safeData;
      print('儀表板載入成功');
      print('本月收入: ${dashboard?.totalIncome}');
      print('本月支出: ${dashboard?.totalExpense}');
      print('當前餘額: ${dashboard?.balance}');
      
      // 根據用戶模式調整儀表板顯示
      switch (response.userMode) {
        case UserMode.expert:
          // 顯示詳細圖表和分析數據
          print('載入詳細分析圖表');
          break;
        case UserMode.guiding:
          // 顯示簡化版本和提示
          print('載入簡化儀表板');
          break;
        case UserMode.cultivation:
          // 顯示成就和進度
          print('載入成就進度');
          break;
        case UserMode.inertial:
        default:
          // 顯示標準版本
          print('載入標準儀表板');
          break;
      }
    }
  }
}
