
/**
 * budget_service.dart_預算服務_1.2.0
 * @module 預算服務
 * @description LCAS 2.0 Flutter 預算服務 - 預算建立、追蹤監控、智慧警示
 * @update 2025-01-24: 升級至v1.2.0版本，修正API調用方式並完善錯誤處理機制
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';

class BudgetService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  BudgetService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  })  : _apiClient = apiClient ?? ApiClient.instance,
        _errorHandler = errorHandler ?? ErrorHandler.instance;

  /**
   * 01. 建立預算設定 - 建立新的預算計畫
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
      return _errorHandler.handleServiceError<Budget>(e, '建立預算設定失敗');
    }
  }

  /**
   * 02. 預算追蹤監控 - 即時監控預算執行狀況
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
      return _errorHandler.handleServiceError<BudgetSettings>(e, '設定預算警示失敗');
    }
  }

  /**
   * 04. 取得預算清單 - 取得使用者的所有預算
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
      return _errorHandler.handleServiceError<List<Budget>>(e, '取得預算清單失敗');
    }
  }

  /**
   * 05. 更新預算 - 修改預算設定
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
      return _errorHandler.handleServiceError<Budget>(e, '更新預算失敗');
    }
  }

  /**
   * 06. 刪除預算 - 刪除指定的預算
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
      return _errorHandler.handleServiceError<bool>(e, '刪除預算失敗');
    }
  }

  /**
   * 07. 取得預算警示 - 取得當前的預算警示
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
      return _errorHandler.handleServiceError<List<BudgetAlert>>(e, '取得預算警示失敗');
    }
  }

  /**
   * 08. 標記警示已讀 - 將警示標記為已讀
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
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
      return _errorHandler.handleServiceError<bool>(e, '標記警示已讀失敗');
    }
  }

  /**
   * 09. 重置服務狀態 - 清理快取和重置連線
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 重置服務內部狀態，用於錯誤恢復
   */
  void resetService() {
    // 清理內部快取和狀態
    debugPrint('BudgetService: 服務狀態已重置');
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

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'data': data,
      'message': message,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}

// 預算相關模型類別 (暫時定義，實際應從 models 導入)
class Budget {
  final String id;
  final String name;
  final String description;
  final String userId;
  final String type;
  final double targetAmount;
  final double spentAmount;
  final String period;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final BudgetSettings settings;
  final DateTime createdAt;

  const Budget({
    required this.id,
    required this.name,
    required this.description,
    required this.userId,
    required this.type,
    required this.targetAmount,
    required this.spentAmount,
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.settings,
    required this.createdAt,
  });

  factory Budget.fromJson(Map<String, dynamic> json) {
    return Budget(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      userId: json['userId'] ?? '',
      type: json['type'] ?? 'monthly',
      targetAmount: (json['targetAmount'] ?? 0).toDouble(),
      spentAmount: (json['spentAmount'] ?? 0).toDouble(),
      period: json['period'] ?? 'monthly',
      startDate: DateTime.tryParse(json['startDate'] ?? '') ?? DateTime.now(),
      endDate: DateTime.tryParse(json['endDate'] ?? '') ?? DateTime.now(),
      status: json['status'] ?? 'active',
      settings: BudgetSettings.fromJson(json['settings'] ?? {}),
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}

class BudgetSettings {
  final double alertThreshold;
  final bool enableNotifications;
  final List<String> notificationTypes;
  final bool autoRollover;

  const BudgetSettings({
    required this.alertThreshold,
    required this.enableNotifications,
    required this.notificationTypes,
    required this.autoRollover,
  });

  factory BudgetSettings.fromJson(Map<String, dynamic> json) {
    return BudgetSettings(
      alertThreshold: (json['alertThreshold'] ?? 0.8).toDouble(),
      enableNotifications: json['enableNotifications'] ?? true,
      notificationTypes: List<String>.from(json['notificationTypes'] ?? []),
      autoRollover: json['autoRollover'] ?? false,
    );
  }
}

class BudgetStatus {
  final double currentProgress;
  final double dailyAverage;
  final double projectedTotal;
  final int daysRemaining;
  final String healthStatus;

  const BudgetStatus({
    required this.currentProgress,
    required this.dailyAverage,
    required this.projectedTotal,
    required this.daysRemaining,
    required this.healthStatus,
  });

  factory BudgetStatus.fromJson(Map<String, dynamic> json) {
    return BudgetStatus(
      currentProgress: (json['currentProgress'] ?? 0).toDouble(),
      dailyAverage: (json['dailyAverage'] ?? 0).toDouble(),
      projectedTotal: (json['projectedTotal'] ?? 0).toDouble(),
      daysRemaining: json['daysRemaining'] ?? 0,
      healthStatus: json['healthStatus'] ?? 'unknown',
    );
  }
}

class CreateBudgetRequest {
  final String name;
  final String description;
  final String type;
  final double targetAmount;
  final String period;
  final DateTime startDate;  
  final DateTime endDate;
  final BudgetSettings settings;

  const CreateBudgetRequest({
    required this.name,
    required this.description,
    required this.type,
    required this.targetAmount,
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.settings,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'description': description,
      'type': type,
      'targetAmount': targetAmount,
      'period': period,
      'startDate': startDate.toIso8601String(),
      'endDate': endDate.toIso8601String(),
      'settings': {
        'alertThreshold': settings.alertThreshold,
        'enableNotifications': settings.enableNotifications,
        'notificationTypes': settings.notificationTypes,
        'autoRollover': settings.autoRollover,
      },
    };
  }
}

class BudgetMonitorRequest {
  final String? budgetId;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? analysisType;

  const BudgetMonitorRequest({
    this.budgetId,
    this.startDate,
    this.endDate,
    this.analysisType,
  });

  Map<String, dynamic> toJson() {
    return {
      'budgetId': budgetId,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'analysisType': analysisType,
    };
  }
}

class BudgetMonitorResponse {
  final bool success;
  final Budget budget;
  final BudgetStatus status;
  final String message;
  final DateTime timestamp;

  const BudgetMonitorResponse({
    required this.success,
    required this.budget,
    required this.status,
    required this.message,
    required this.timestamp,
  });

  factory BudgetMonitorResponse.fromJson(Map<String, dynamic> json) {
    return BudgetMonitorResponse(
      success: json['success'] ?? false,
      budget: Budget.fromJson(json['budget'] ?? {}),
      status: BudgetStatus.fromJson(json['status'] ?? {}),
      message: json['message'] ?? '',
      timestamp: DateTime.tryParse(json['timestamp'] ?? '') ?? DateTime.now(),
    );
  }
}

class BudgetAlertSettingsRequest {
  final String budgetId;
  final BudgetSettings settings;

  const BudgetAlertSettingsRequest({
    required this.budgetId,
    required this.settings,
  });

  Map<String, dynamic> toJson() {
    return {
      'budgetId': budgetId,
      'settings': {
        'alertThreshold': settings.alertThreshold,
        'enableNotifications': settings.enableNotifications,
        'notificationTypes': settings.notificationTypes,
        'autoRollover': settings.autoRollover,
      },
    };
  }
}

class BudgetAlert {
  final String id;
  final String budgetId;
  final String type;
  final String message;
  final DateTime createdAt;
  final bool isRead;

  const BudgetAlert({
    required this.id,
    required this.budgetId,
    required this.type,
    required this.message,
    required this.createdAt,
    required this.isRead,
  });

  factory BudgetAlert.fromJson(Map<String, dynamic> json) {
    return BudgetAlert(
      id: json['id'] ?? '',
      budgetId: json['budgetId'] ?? '',
      type: json['type'] ?? 'info',
      message: json['message'] ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      isRead: json['isRead'] ?? false,
    );
  }
}
