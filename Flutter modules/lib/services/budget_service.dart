
/**
 * budget_service.dart_預算服務_1.0.0
 * @module 預算服務
 * @description LCAS 2.0 Flutter 預算服務 - 預算建立、追蹤監控、智慧警示
 * @update 2025-01-24: 建立預算服務，實作3個API端點
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/budget_models.dart';

class BudgetService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  BudgetService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  })  : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. 建立預算設定 - 建立新的預算計畫
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 建立預算，支援多類型預算和智慧警示設定
   */
  Future<ApiResponse<Budget>> createBudget(CreateBudgetRequest request) async {
    try {
      final response = await _apiClient.post('/app/budgets/create', data: request.toJson());
      
      if (response.data['success'] == true) {
        final budget = Budget.fromJson(response.data['data']);
        return ApiResponse<Budget>(
          success: true,
          data: budget,
          message: response.data['message'] ?? '預算建立成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<Budget>(
          success: false,
          data: null,
          message: response.data['message'] ?? '預算建立失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<Budget>(e, '建立預算設定失敗');
    }
  }

  /**
   * 02. 預算追蹤監控 - 即時監控預算執行狀況
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 提供詳細的預算執行分析和趨勢預測
   */
  Future<BudgetMonitorResponse> monitorBudget(BudgetMonitorRequest request) async {
    try {
      final queryParams = request.toJson()
        ..removeWhere((key, value) => value == null);
      
      final response = await _apiClient.get('/app/budgets/monitor', queryParameters: queryParams);
      
      return BudgetMonitorResponse.fromJson(response.data);
    } catch (e) {
      // 建立預設的錯誤回應
      return BudgetMonitorResponse(
        success: false,
        budget: Budget(
          id: '',
          name: '',
          description: '',
          userId: '',
          type: 'monthly',
          targetAmount: 0,
          spentAmount: 0,
          period: 'monthly',
          startDate: DateTime.now(),
          endDate: DateTime.now(),
          status: 'active',
          settings: const BudgetSettings(
            alertThreshold: 0.8,
            enableNotifications: true,
            notificationTypes: [],
            autoRollover: false,
          ),
          createdAt: DateTime.now(),
        ),
        status: const BudgetStatus(
          currentProgress: 0,
          dailyAverage: 0,
          projectedTotal: 0,
          daysRemaining: 0,
          healthStatus: 'unknown',
        ),
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 03. 設定預算警示 - 配置預算警示規則
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 設定智慧警示閾值和通知方式
   */
  Future<ApiResponse<BudgetSettings>> setBudgetAlerts(BudgetAlertSettingsRequest request) async {
    try {
      final response = await _apiClient.put('/app/budgets/alerts', data: request.toJson());
      
      if (response.data['success'] == true) {
        final settings = BudgetSettings.fromJson(response.data['data']);
        return ApiResponse<BudgetSettings>(
          success: true,
          data: settings,
          message: response.data['message'] ?? '預算警示設定成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<BudgetSettings>(
          success: false,
          data: null,
          message: response.data['message'] ?? '預算警示設定失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<BudgetSettings>(e, '設定預算警示失敗');
    }
  }

  /**
   * 04. 取得預算清單 - 取得使用者的所有預算
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 取得預算清單，支援篩選和排序
   */
  Future<ApiResponse<List<Budget>>> getBudgets({
    String? type,
    String? status,
    String? projectId,
    int? limit,
    int? offset,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (type != null) queryParams['type'] = type;
      if (status != null) queryParams['status'] = status;
      if (projectId != null) queryParams['projectId'] = projectId;
      if (limit != null) queryParams['limit'] = limit;
      if (offset != null) queryParams['offset'] = offset;
      
      final response = await _apiClient.get('/app/budgets/list', queryParameters: queryParams);
      
      if (response.data['success'] == true) {
        final budgets = (response.data['data'] as List)
            .map((item) => Budget.fromJson(item))
            .toList();
        
        return ApiResponse<List<Budget>>(
          success: true,
          data: budgets,
          message: response.data['message'] ?? '取得預算清單成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<List<Budget>>(
          success: false,
          data: [],
          message: response.data['message'] ?? '取得預算清單失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<List<Budget>>(e, '取得預算清單失敗');
    }
  }

  /**
   * 05. 更新預算 - 修改預算設定
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 更新預算的目標金額、期間或設定
   */
  Future<ApiResponse<Budget>> updateBudget(String budgetId, CreateBudgetRequest request) async {
    try {
      final response = await _apiClient.put('/app/budgets/$budgetId', data: request.toJson());
      
      if (response.data['success'] == true) {
        final budget = Budget.fromJson(response.data['data']);
        return ApiResponse<Budget>(
          success: true,
          data: budget,
          message: response.data['message'] ?? '預算更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<Budget>(
          success: false,
          data: null,
          message: response.data['message'] ?? '預算更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<Budget>(e, '更新預算失敗');
    }
  }

  /**
   * 06. 刪除預算 - 刪除指定的預算
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 刪除預算設定，保留歷史記錄
   */
  Future<ApiResponse<bool>> deleteBudget(String budgetId) async {
    try {
      final response = await _apiClient.delete('/app/budgets/$budgetId');
      
      return ApiResponse<bool>(
        success: response.data['success'] ?? false,
        data: response.data['success'] ?? false,
        message: response.data['message'] ?? '預算刪除${response.data['success'] ? '成功' : '失敗'}',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      return _errorHandler.handleApiError<bool>(e, '刪除預算失敗');
    }
  }

  /**
   * 07. 取得預算警示 - 取得當前的預算警示
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 取得未讀的預算警示和通知
   */
  Future<ApiResponse<List<BudgetAlert>>> getBudgetAlerts({
    String? budgetId,
    bool? unreadOnly,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (budgetId != null) queryParams['budgetId'] = budgetId;
      if (unreadOnly != null) queryParams['unreadOnly'] = unreadOnly;
      
      final response = await _apiClient.get('/app/budgets/alerts', queryParameters: queryParams);
      
      if (response.data['success'] == true) {
        final alerts = (response.data['data'] as List)
            .map((item) => BudgetAlert.fromJson(item))
            .toList();
        
        return ApiResponse<List<BudgetAlert>>(
          success: true,
          data: alerts,
          message: response.data['message'] ?? '取得預算警示成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<List<BudgetAlert>>(
          success: false,
          data: [],
          message: response.data['message'] ?? '取得預算警示失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<List<BudgetAlert>>(e, '取得預算警示失敗');
    }
  }

  /**
   * 08. 標記警示已讀 - 將警示標記為已讀
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 12:00:00
   * @description 更新警示狀態為已讀
   */
  Future<ApiResponse<bool>> markAlertAsRead(String alertId) async {
    try {
      final response = await _apiClient.put('/app/budgets/alerts/$alertId/read');
      
      return ApiResponse<bool>(
        success: response.data['success'] ?? false,
        data: response.data['success'] ?? false,
        message: response.data['message'] ?? '標記已讀${response.data['success'] ? '成功' : '失敗'}',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      return _errorHandler.handleApiError<bool>(e, '標記警示已讀失敗');
    }
  }
}

/// 通用API回應模型
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String message;
  final DateTime timestamp;

  const ApiResponse({
    required this.success,
    this.data,
    required this.message,
    required this.timestamp,
  });
}
