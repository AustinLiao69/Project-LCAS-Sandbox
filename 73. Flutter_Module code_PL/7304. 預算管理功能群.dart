
/**
 * 7304. 預算管理功能群.dart
 * @module 預算管理功能群
 * @description LCAS 2.0 專案Presentation Layer的預算管理核心模組
 * @version v2.0.0
 * @date 2025-10-22
 * @update: MVP階段精簡重構，升級版本，階段一實作完成
 */

import 'dart:convert';
import 'dart:async';
import '../APL.dart';

// 導入模組等級資訊
const String moduleVersion = 'v2.0.0';
const String modulePhase = 'Phase2-MVP';
const String lastUpdate = '2025-10-22';

/// 預算CRUD操作類型
enum BudgetCRUDType {
  create,
  read,
  update,
  delete,
}

/// 用戶模式枚舉
enum UserMode {
  Expert,
  Inertial,
  Cultivation,
  Guiding,
}

/// 預算驗證類型
enum BudgetValidationType {
  create,
  update,
  delete,
  allocation,
}

/// 預算資料轉換類型
enum BudgetTransformType {
  apiToUi,
  uiToApi,
  summary,
  detail,
}

/// 預算操作結果類別
class BudgetOperationResult {
  final bool success;
  final String? budgetId;
  final Map<String, dynamic>? data;
  final String message;
  final String? errorCode;

  BudgetOperationResult({
    required this.success,
    this.budgetId,
    this.data,
    required this.message,
    this.errorCode,
  });

  factory BudgetOperationResult.success({
    String? budgetId,
    Map<String, dynamic>? data,
    required String message,
  }) {
    return BudgetOperationResult(
      success: true,
      budgetId: budgetId,
      data: data,
      message: message,
    );
  }

  factory BudgetOperationResult.failure({
    required String message,
    String? errorCode,
  }) {
    return BudgetOperationResult(
      success: false,
      message: message,
      errorCode: errorCode,
    );
  }
}

/// 預算執行狀況類別
class BudgetExecution {
  final double progress;
  final double remaining;
  final String status;
  final double usedAmount;
  final double totalAmount;
  final DateTime? lastUpdated;

  BudgetExecution({
    required this.progress,
    required this.remaining,
    required this.status,
    required this.usedAmount,
    required this.totalAmount,
    this.lastUpdated,
  });

  factory BudgetExecution.fromJson(Map<String, dynamic> json) {
    return BudgetExecution(
      progress: (json['progress'] ?? 0.0).toDouble(),
      remaining: (json['remaining'] ?? 0.0).toDouble(),
      status: json['status'] ?? 'unknown',
      usedAmount: (json['used_amount'] ?? 0.0).toDouble(),
      totalAmount: (json['total_amount'] ?? 0.0).toDouble(),
      lastUpdated: json['last_updated'] != null 
          ? DateTime.tryParse(json['last_updated']) 
          : null,
    );
  }
}

/// 預算警示類別
class BudgetAlert {
  final String id;
  final String budgetId;
  final String level;
  final String message;
  final DateTime triggeredAt;
  final bool isRead;

  BudgetAlert({
    required this.id,
    required this.budgetId,
    required this.level,
    required this.message,
    required this.triggeredAt,
    this.isRead = false,
  });

  factory BudgetAlert.fromJson(Map<String, dynamic> json) {
    return BudgetAlert(
      id: json['id'] ?? '',
      budgetId: json['budget_id'] ?? '',
      level: json['level'] ?? 'info',
      message: json['message'] ?? '',
      triggeredAt: DateTime.tryParse(json['triggered_at'] ?? '') ?? DateTime.now(),
      isRead: json['is_read'] ?? false,
    );
  }
}

/// 資料驗證結果類別
class ValidationResult {
  final bool valid;
  final List<String> errors;
  final List<String> warnings;

  ValidationResult({
    required this.valid,
    this.errors = const [],
    this.warnings = const [],
  });

  factory ValidationResult.success() {
    return ValidationResult(valid: true);
  }

  factory ValidationResult.failure(List<String> errors) {
    return ValidationResult(valid: false, errors: errors);
  }
}

/// 預算錯誤類別
class BudgetError {
  final String code;
  final String message;
  final UserMode userMode;
  final String? context;
  final Map<String, dynamic>? details;

  BudgetError({
    required this.code,
    required this.message,
    required this.userMode,
    this.context,
    this.details,
  });
}

/// 預算實體類別
class Budget {
  final String id;
  final String name;
  final double amount;
  final double usedAmount;
  final String type;
  final String status;
  final DateTime startDate;
  final DateTime endDate;
  final String currency;
  final List<String> categories;
  final Map<String, dynamic> alertRules;
  final DateTime createdAt;
  final DateTime updatedAt;

  Budget({
    required this.id,
    required this.name,
    required this.amount,
    required this.usedAmount,
    required this.type,
    required this.status,
    required this.startDate,
    required this.endDate,
    this.currency = 'TWD',
    this.categories = const [],
    this.alertRules = const {},
    required this.createdAt,
    required this.updatedAt,
  });

  factory Budget.fromJson(Map<String, dynamic> json) {
    return Budget(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      amount: (json['amount'] ?? 0.0).toDouble(),
      usedAmount: (json['used_amount'] ?? 0.0).toDouble(),
      type: json['type'] ?? 'monthly',
      status: json['status'] ?? 'active',
      startDate: DateTime.tryParse(json['start_date'] ?? '') ?? DateTime.now(),
      endDate: DateTime.tryParse(json['end_date'] ?? '') ?? DateTime.now().add(Duration(days: 30)),
      currency: json['currency'] ?? 'TWD',
      categories: List<String>.from(json['categories'] ?? []),
      alertRules: Map<String, dynamic>.from(json['alert_rules'] ?? {}),
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at'] ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'amount': amount,
      'used_amount': usedAmount,
      'type': type,
      'status': status,
      'start_date': startDate.toIso8601String(),
      'end_date': endDate.toIso8601String(),
      'currency': currency,
      'categories': categories,
      'alert_rules': alertRules,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  Budget copyWith({
    String? id,
    String? name,
    double? amount,
    double? usedAmount,
    String? type,
    String? status,
    DateTime? startDate,
    DateTime? endDate,
    String? currency,
    List<String>? categories,
    Map<String, dynamic>? alertRules,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Budget(
      id: id ?? this.id,
      name: name ?? this.name,
      amount: amount ?? this.amount,
      usedAmount: usedAmount ?? this.usedAmount,
      type: type ?? this.type,
      status: status ?? this.status,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      currency: currency ?? this.currency,
      categories: categories ?? this.categories,
      alertRules: alertRules ?? this.alertRules,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

/// 預算狀態提供者狀態類別
class BudgetProviderState {
  final List<Budget> budgets;
  final Budget? currentBudget;
  final BudgetExecution? execution;
  final List<BudgetAlert> alerts;
  final bool isLoading;
  final String? errorMessage;
  final String userId;
  final UserMode userMode;
  final DateTime lastUpdated;

  BudgetProviderState({
    required this.budgets,
    this.currentBudget,
    this.execution,
    required this.alerts,
    required this.isLoading,
    this.errorMessage,
    required this.userId,
    required this.userMode,
    required this.lastUpdated,
  });

  BudgetProviderState copyWith({
    List<Budget>? budgets,
    Budget? currentBudget,
    BudgetExecution? execution,
    List<BudgetAlert>? alerts,
    bool? isLoading,
    String? errorMessage,
    String? userId,
    UserMode? userMode,
    DateTime? lastUpdated,
  }) {
    return BudgetProviderState(
      budgets: budgets ?? this.budgets,
      currentBudget: currentBudget ?? this.currentBudget,
      execution: execution ?? this.execution,
      alerts: alerts ?? this.alerts,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage ?? this.errorMessage,
      userId: userId ?? this.userId,
      userMode: userMode ?? this.userMode,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
}

/// 預算狀態更新類別
class BudgetStateUpdate {
  final BudgetStateUpdateType type;
  final List<Budget>? budgets;
  final Budget? budget;
  final Budget? currentBudget;
  final BudgetExecution? execution;
  final List<BudgetAlert>? alerts;
  final bool? isLoading;
  final String? errorMessage;
  final String? budgetId;

  BudgetStateUpdate({
    required this.type,
    this.budgets,
    this.budget,
    this.currentBudget,
    this.execution,
    this.alerts,
    this.isLoading,
    this.errorMessage,
    this.budgetId,
  });
}

/// 預算狀態更新類型枚舉
enum BudgetStateUpdateType {
  setBudgets,
  setCurrentBudget,
  setExecution,
  setAlerts,
  setLoading,
  setError,
  addBudget,
  updateBudget,
  removeBudget,
}

/// 預算管理功能群 - 階段一：核心業務邏輯函數
class BudgetManagementFeatureGroup {

  /// =============== 階段一：核心業務邏輯函數（5個函數）===============

  /**
   * 01. 統一預算CRUD操作
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一處理所有預算CRUD操作，支援四模式差異化
   */
  static Future<BudgetOperationResult> processBudgetCRUD(
    BudgetCRUDType operation,
    Map<String, dynamic> data,
    UserMode mode
  ) async {
    try {
      print('[processBudgetCRUD] 開始統一預算CRUD操作 - 操作類型: ${operation.name}, 模式: ${mode.name}');
      
      // 驗證輸入參數
      if (data.isEmpty) {
        return BudgetOperationResult.failure(
          message: '缺少必要的操作資料',
          errorCode: 'MISSING_DATA',
        );
      }

      // 根據操作類型執行對應邏輯
      switch (operation) {
        case BudgetCRUDType.create:
          return await _processCreateBudget(data, mode);
          
        case BudgetCRUDType.read:
          return await _processReadBudget(data, mode);
          
        case BudgetCRUDType.update:
          return await _processUpdateBudget(data, mode);
          
        case BudgetCRUDType.delete:
          return await _processDeleteBudget(data, mode);
      }
      
    } catch (error) {
      print('[processBudgetCRUD] 錯誤: $error');
      return BudgetOperationResult.failure(
        message: '預算CRUD操作失敗: $error',
        errorCode: 'CRUD_ERROR',
      );
    }
  }

  /**
   * 02. 計算預算執行狀況
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一計算預算執行進度、使用率、剩餘金額
   */
  static Future<BudgetExecution> calculateBudgetExecution(
    String budgetId,
    {DateTime? asOfDate}
  ) async {
    try {
      print('[calculateBudgetExecution] 計算預算執行狀況 - 預算ID: $budgetId');
      
      // 驗證預算ID
      if (budgetId.isEmpty) {
        return BudgetExecution(
          progress: 0.0,
          remaining: 0.0,
          status: 'error',
          usedAmount: 0.0,
          totalAmount: 0.0,
        );
      }

      // 透過APL.dart調用API獲取預算詳情
      final response = await APL.instance.budget.getBudgetDetail(
        budgetId,
        includeTransactions: true,
      );

      if (!response.success || response.data == null) {
        return BudgetExecution(
          progress: 0.0,
          remaining: 0.0,
          status: 'not_found',
          usedAmount: 0.0,
          totalAmount: 0.0,
        );
      }

      final budgetData = response.data!;
      final totalAmount = (budgetData['amount'] ?? 0.0).toDouble();
      final usedAmount = (budgetData['used_amount'] ?? 0.0).toDouble();
      
      // 計算執行進度
      final progress = totalAmount > 0 ? (usedAmount / totalAmount) * 100 : 0.0;
      final remaining = totalAmount - usedAmount;
      
      // 判斷執行狀態
      String status = 'normal';
      if (progress >= 100) {
        status = 'exceeded';
      } else if (progress >= 95) {
        status = 'critical';
      } else if (progress >= 80) {
        status = 'warning';
      }

      print('[calculateBudgetExecution] 計算完成 - 進度: ${progress.toStringAsFixed(2)}%, 狀態: $status');

      return BudgetExecution(
        progress: double.parse(progress.toStringAsFixed(2)),
        remaining: remaining,
        status: status,
        usedAmount: usedAmount,
        totalAmount: totalAmount,
        lastUpdated: DateTime.now(),
      );
      
    } catch (error) {
      print('[calculateBudgetExecution] 錯誤: $error');
      return BudgetExecution(
        progress: 0.0,
        remaining: 0.0,
        status: 'error',
        usedAmount: 0.0,
        totalAmount: 0.0,
      );
    }
  }

  /**
   * 03. 檢查預算警示
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一檢查警示條件並觸發通知
   */
  static Future<List<BudgetAlert>> checkBudgetAlerts(
    String budgetId,
    {bool triggerNotification = true}
  ) async {
    try {
      print('[checkBudgetAlerts] 檢查預算警示 - 預算ID: $budgetId');
      
      final List<BudgetAlert> alerts = [];
      
      // 驗證預算ID
      if (budgetId.isEmpty) {
        return alerts;
      }

      // 取得預算執行狀況
      final execution = await calculateBudgetExecution(budgetId);
      
      // 根據執行狀況生成警示
      if (execution.status == 'exceeded') {
        alerts.add(BudgetAlert(
          id: 'alert_${DateTime.now().millisecondsSinceEpoch}_exceeded',
          budgetId: budgetId,
          level: 'critical',
          message: '⚠️ 預算已超支！已使用 ${execution.progress}%',
          triggeredAt: DateTime.now(),
        ));
      } else if (execution.status == 'critical') {
        alerts.add(BudgetAlert(
          id: 'alert_${DateTime.now().millisecondsSinceEpoch}_critical',
          budgetId: budgetId,
          level: 'warning',
          message: '🚨 預算接近上限！已使用 ${execution.progress}%',
          triggeredAt: DateTime.now(),
        ));
      } else if (execution.status == 'warning') {
        alerts.add(BudgetAlert(
          id: 'alert_${DateTime.now().millisecondsSinceEpoch}_warning',
          budgetId: budgetId,
          level: 'info',
          message: '📊 預算使用提醒：已使用 ${execution.progress}%',
          triggeredAt: DateTime.now(),
        ));
      }

      // 觸發通知（如果啟用）
      if (triggerNotification && alerts.isNotEmpty) {
        await _triggerAlertNotifications(alerts);
      }

      print('[checkBudgetAlerts] 檢查完成 - 找到 ${alerts.length} 個警示');
      return alerts;
      
    } catch (error) {
      print('[checkBudgetAlerts] 錯誤: $error');
      return [];
    }
  }

  /**
   * 04. 統一資料驗證
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一驗證所有預算相關資料
   */
  static ValidationResult validateBudgetData(
    Map<String, dynamic> data,
    BudgetValidationType type
  ) {
    try {
      print('[validateBudgetData] 開始資料驗證 - 驗證類型: ${type.name}');
      
      final List<String> errors = [];
      final List<String> warnings = [];

      // 基本資料驗證
      if (data.isEmpty) {
        errors.add('資料不能為空');
        return ValidationResult.failure(errors);
      }

      // 根據驗證類型執行特定驗證
      switch (type) {
        case BudgetValidationType.create:
          _validateCreateBudget(data, errors, warnings);
          break;
          
        case BudgetValidationType.update:
          _validateUpdateBudget(data, errors, warnings);
          break;
          
        case BudgetValidationType.delete:
          _validateDeleteBudget(data, errors, warnings);
          break;
          
        case BudgetValidationType.allocation:
          _validateAllocation(data, errors, warnings);
          break;
      }

      final isValid = errors.isEmpty;
      print('[validateBudgetData] 驗證完成 - 有效: $isValid, 錯誤: ${errors.length}個, 警告: ${warnings.length}個');

      return ValidationResult(
        valid: isValid,
        errors: errors,
        warnings: warnings,
      );
      
    } catch (error) {
      print('[validateBudgetData] 驗證過程錯誤: $error');
      return ValidationResult.failure(['驗證過程發生錯誤: $error']);
    }
  }

  /**
   * 05. 統一資料轉換
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一處理API與UI間的資料轉換
   */
  static Map<String, dynamic> transformBudgetData(
    dynamic sourceData,
    BudgetTransformType transformType,
    UserMode mode
  ) {
    try {
      print('[transformBudgetData] 開始資料轉換 - 轉換類型: ${transformType.name}, 模式: ${mode.name}');
      
      if (sourceData == null) {
        return {};
      }

      Map<String, dynamic> result = {};

      // 根據轉換類型執行對應轉換
      switch (transformType) {
        case BudgetTransformType.apiToUi:
          result = _transformApiToUi(sourceData, mode);
          break;
          
        case BudgetTransformType.uiToApi:
          result = _transformUiToApi(sourceData, mode);
          break;
          
        case BudgetTransformType.summary:
          result = _transformToSummary(sourceData, mode);
          break;
          
        case BudgetTransformType.detail:
          result = _transformToDetail(sourceData, mode);
          break;
      }

      print('[transformBudgetData] 轉換完成 - 結果欄位數: ${result.keys.length}');
      return result;
      
    } catch (error) {
      print('[transformBudgetData] 轉換錯誤: $error');
      return {};
    }
  }

  /// =============== 私有輔助方法 ===============

  /// 處理建立預算
  static Future<BudgetOperationResult> _processCreateBudget(
    Map<String, dynamic> data, 
    UserMode mode
  ) async {
    try {
      // 先驗證資料
      final validation = validateBudgetData(data, BudgetValidationType.create);
      if (!validation.valid) {
        return BudgetOperationResult.failure(
          message: '預算資料驗證失敗: ${validation.errors.join(', ')}',
          errorCode: 'VALIDATION_ERROR',
        );
      }

      // 轉換資料格式
      final apiData = transformBudgetData(data, BudgetTransformType.uiToApi, mode);
      
      // 透過APL.dart調用API建立預算
      final response = await APL.instance.budget.createBudget(apiData);
      
      if (response.success && response.data != null) {
        return BudgetOperationResult.success(
          budgetId: response.data!['id']?.toString(),
          data: response.data,
          message: '預算建立成功',
        );
      } else {
        return BudgetOperationResult.failure(
          message: response.error?.message ?? '預算建立失敗',
          errorCode: response.error?.code ?? 'CREATE_ERROR',
        );
      }
    } catch (error) {
      return BudgetOperationResult.failure(
        message: '建立預算過程發生錯誤: $error',
        errorCode: 'PROCESS_ERROR',
      );
    }
  }

  /// 處理讀取預算
  static Future<BudgetOperationResult> _processReadBudget(
    Map<String, dynamic> data, 
    UserMode mode
  ) async {
    try {
      final budgetId = data['id']?.toString();
      if (budgetId == null || budgetId.isEmpty) {
        return BudgetOperationResult.failure(
          message: '缺少預算ID',
          errorCode: 'MISSING_ID',
        );
      }

      // 透過APL.dart調用API取得預算
      final response = await APL.instance.budget.getBudgetDetail(
        budgetId,
        userMode: mode.name,
      );
      
      if (response.success && response.data != null) {
        // 轉換資料格式適配UI
        final uiData = transformBudgetData(response.data, BudgetTransformType.apiToUi, mode);
        
        return BudgetOperationResult.success(
          budgetId: budgetId,
          data: uiData,
          message: '預算讀取成功',
        );
      } else {
        return BudgetOperationResult.failure(
          message: response.error?.message ?? '預算讀取失敗',
          errorCode: response.error?.code ?? 'READ_ERROR',
        );
      }
    } catch (error) {
      return BudgetOperationResult.failure(
        message: '讀取預算過程發生錯誤: $error',
        errorCode: 'PROCESS_ERROR',
      );
    }
  }

  /// 處理更新預算
  static Future<BudgetOperationResult> _processUpdateBudget(
    Map<String, dynamic> data, 
    UserMode mode
  ) async {
    try {
      final budgetId = data['id']?.toString();
      if (budgetId == null || budgetId.isEmpty) {
        return BudgetOperationResult.failure(
          message: '缺少預算ID',
          errorCode: 'MISSING_ID',
        );
      }

      // 先驗證更新資料
      final validation = validateBudgetData(data, BudgetValidationType.update);
      if (!validation.valid) {
        return BudgetOperationResult.failure(
          message: '更新資料驗證失敗: ${validation.errors.join(', ')}',
          errorCode: 'VALIDATION_ERROR',
        );
      }

      // 轉換資料格式
      final apiData = transformBudgetData(data, BudgetTransformType.uiToApi, mode);
      
      // 透過APL.dart調用API更新預算
      final response = await APL.instance.budget.updateBudget(budgetId, apiData);
      
      if (response.success && response.data != null) {
        return BudgetOperationResult.success(
          budgetId: budgetId,
          data: response.data,
          message: '預算更新成功',
        );
      } else {
        return BudgetOperationResult.failure(
          message: response.error?.message ?? '預算更新失敗',
          errorCode: response.error?.code ?? 'UPDATE_ERROR',
        );
      }
    } catch (error) {
      return BudgetOperationResult.failure(
        message: '更新預算過程發生錯誤: $error',
        errorCode: 'PROCESS_ERROR',
      );
    }
  }

  /// 處理刪除預算
  static Future<BudgetOperationResult> _processDeleteBudget(
    Map<String, dynamic> data, 
    UserMode mode
  ) async {
    try {
      final budgetId = data['id']?.toString();
      if (budgetId == null || budgetId.isEmpty) {
        return BudgetOperationResult.failure(
          message: '缺少預算ID',
          errorCode: 'MISSING_ID',
        );
      }

      // 驗證刪除權限和條件
      final validation = validateBudgetData(data, BudgetValidationType.delete);
      if (!validation.valid) {
        return BudgetOperationResult.failure(
          message: '刪除條件驗證失敗: ${validation.errors.join(', ')}',
          errorCode: 'VALIDATION_ERROR',
        );
      }

      // 透過APL.dart調用API刪除預算
      final response = await APL.instance.budget.deleteBudget(budgetId);
      
      if (response.success) {
        return BudgetOperationResult.success(
          budgetId: budgetId,
          message: '預算刪除成功',
        );
      } else {
        return BudgetOperationResult.failure(
          message: response.error?.message ?? '預算刪除失敗',
          errorCode: response.error?.code ?? 'DELETE_ERROR',
        );
      }
    } catch (error) {
      return BudgetOperationResult.failure(
        message: '刪除預算過程發生錯誤: $error',
        errorCode: 'PROCESS_ERROR',
      );
    }
  }

  /// 觸發警示通知
  static Future<void> _triggerAlertNotifications(List<BudgetAlert> alerts) async {
    try {
      for (final alert in alerts) {
        print('[Notification] ${alert.level.toUpperCase()}: ${alert.message}');
        // 這裡可以整合實際的通知服務（APP通知、LINE OA等）
      }
    } catch (error) {
      print('[_triggerAlertNotifications] 通知發送錯誤: $error');
    }
  }

  /// 驗證建立預算資料
  static void _validateCreateBudget(
    Map<String, dynamic> data, 
    List<String> errors, 
    List<String> warnings
  ) {
    // 預算名稱驗證
    final name = data['name']?.toString();
    if (name == null || name.trim().isEmpty) {
      errors.add('預算名稱不能為空');
    } else if (name.length > 50) {
      errors.add('預算名稱不能超過50字元');
    }

    // 預算金額驗證
    final amount = data['amount'];
    if (amount == null) {
      errors.add('預算金額不能為空');
    } else {
      final numAmount = double.tryParse(amount.toString());
      if (numAmount == null || numAmount <= 0) {
        errors.add('預算金額必須為正數');
      } else if (numAmount > 999999999) {
        errors.add('預算金額過大，請設定合理範圍');
      }
    }

    // 帳本ID驗證
    final ledgerId = data['ledgerId']?.toString();
    if (ledgerId == null || ledgerId.isEmpty) {
      errors.add('必須指定預算所屬帳本');
    }

    // 期間驗證
    _validatePeriod(data, errors, warnings);
  }

  /// 驗證更新預算資料
  static void _validateUpdateBudget(
    Map<String, dynamic> data, 
    List<String> errors, 
    List<String> warnings
  ) {
    // 更新資料至少要有一個欄位
    final updateFields = ['name', 'amount', 'description', 'alertRules'];
    if (!updateFields.any((field) => data.containsKey(field))) {
      errors.add('更新操作至少需要提供一個要更新的欄位');
    }

    // 如果有名稱則驗證
    if (data.containsKey('name')) {
      final name = data['name']?.toString();
      if (name != null && name.trim().isEmpty) {
        errors.add('預算名稱不能為空');
      } else if (name != null && name.length > 50) {
        errors.add('預算名稱不能超過50字元');
      }
    }

    // 如果有金額則驗證
    if (data.containsKey('amount')) {
      final amount = data['amount'];
      if (amount != null) {
        final numAmount = double.tryParse(amount.toString());
        if (numAmount == null || numAmount <= 0) {
          errors.add('預算金額必須為正數');
        }
      }
    }
  }

  /// 驗證刪除預算條件
  static void _validateDeleteBudget(
    Map<String, dynamic> data, 
    List<String> errors, 
    List<String> warnings
  ) {
    // 檢查是否有確認標記
    final confirmed = data['confirmed'] ?? false;
    if (!confirmed) {
      errors.add('刪除預算需要確認操作');
    }

    // 警告可能的影響
    warnings.add('刪除預算將無法復原，建議先下載相關報表');
  }

  /// 驗證預算分配
  static void _validateAllocation(
    Map<String, dynamic> data, 
    List<String> errors, 
    List<String> warnings
  ) {
    final allocations = data['allocations'] as List<dynamic>?;
    if (allocations == null || allocations.isEmpty) {
      errors.add('分配資料不能為空');
      return;
    }

    double totalAllocated = 0.0;
    for (final allocation in allocations) {
      if (allocation is Map<String, dynamic>) {
        final amount = double.tryParse(allocation['amount']?.toString() ?? '0');
        if (amount == null || amount < 0) {
          errors.add('分配金額必須為非負數');
        } else {
          totalAllocated += amount;
        }
      }
    }

    final totalBudget = double.tryParse(data['totalBudget']?.toString() ?? '0') ?? 0.0;
    if (totalAllocated > totalBudget) {
      errors.add('分配總額不能超過預算總額');
    } else if (totalAllocated < totalBudget * 0.8) {
      warnings.add('分配總額較低，建議完整分配預算');
    }
  }

  /// 驗證期間設定
  static void _validatePeriod(
    Map<String, dynamic> data, 
    List<String> errors, 
    List<String> warnings
  ) {
    final startDate = data['startDate']?.toString();
    final endDate = data['endDate']?.toString();

    if (startDate != null && endDate != null) {
      final start = DateTime.tryParse(startDate);
      final end = DateTime.tryParse(endDate);

      if (start != null && end != null) {
        if (start.isAfter(end)) {
          errors.add('開始日期不能晚於結束日期');
        }

        final duration = end.difference(start).inDays;
        if (duration > 365 * 5) {
          warnings.add('預算期間超過5年，建議設定較短期間');
        } else if (duration < 7) {
          warnings.add('預算期間少於一週，建議設定較長期間');
        }
      }
    }
  }

  /// API資料轉UI格式
  static Map<String, dynamic> _transformApiToUi(dynamic sourceData, UserMode mode) {
    final Map<String, dynamic> data = sourceData is Map<String, dynamic> 
        ? sourceData 
        : {'raw': sourceData};
    
    final Map<String, dynamic> result = {};

    // 基本欄位轉換
    result['id'] = data['id'] ?? data['budget_id'];
    result['name'] = data['name'] ?? '未命名預算';
    result['amount'] = data['amount'] ?? data['target_amount'] ?? 0.0;
    result['usedAmount'] = data['used_amount'] ?? data['spent_amount'] ?? 0.0;
    result['currency'] = data['currency'] ?? 'TWD';
    result['type'] = data['type'] ?? 'monthly';
    result['status'] = data['status'] ?? 'active';

    // 根據用戶模式調整顯示內容
    switch (mode) {
      case UserMode.Expert:
        result['details'] = data['details'] ?? {};
        result['analytics'] = data['analytics'] ?? {};
        result['metadata'] = data['metadata'] ?? {};
        break;
        
      case UserMode.Cultivation:
        result['progress'] = ((result['usedAmount'] / result['amount']) * 100).clamp(0.0, 100.0);
        result['achievement'] = _calculateAchievement(result);
        break;
        
      case UserMode.Guiding:
        result['simpleStatus'] = _getSimpleStatus(result);
        result['nextAction'] = _getNextAction(result);
        break;
        
      case UserMode.Inertial:
      default:
        // 保持基本資料
        break;
    }

    return result;
  }

  /// UI資料轉API格式
  static Map<String, dynamic> _transformUiToApi(dynamic sourceData, UserMode mode) {
    final Map<String, dynamic> data = sourceData is Map<String, dynamic> 
        ? sourceData 
        : {};
    
    final Map<String, dynamic> result = {};

    // 基本欄位轉換
    if (data.containsKey('name')) result['name'] = data['name'];
    if (data.containsKey('amount')) result['amount'] = data['amount'];
    if (data.containsKey('ledgerId')) result['ledgerId'] = data['ledgerId'];
    if (data.containsKey('type')) result['type'] = data['type'];
    if (data.containsKey('description')) result['description'] = data['description'];
    if (data.containsKey('startDate')) result['startDate'] = data['startDate'];
    if (data.containsKey('endDate')) result['endDate'] = data['endDate'];

    // 根據模式添加特定欄位
    result['userMode'] = mode.name;
    result['timestamp'] = DateTime.now().toIso8601String();

    return result;
  }

  /// 轉換為摘要格式
  static Map<String, dynamic> _transformToSummary(dynamic sourceData, UserMode mode) {
    final Map<String, dynamic> data = sourceData is Map<String, dynamic> 
        ? sourceData 
        : {};
    
    final double amount = (data['amount'] ?? 0.0).toDouble();
    final double usedAmount = (data['used_amount'] ?? data['usedAmount'] ?? 0.0).toDouble();
    final double progress = amount > 0 ? (usedAmount / amount) * 100 : 0.0;

    return {
      'id': data['id'] ?? data['budget_id'],
      'name': data['name'] ?? '未命名預算',
      'progress': progress.clamp(0.0, 100.0),
      'amount': amount,
      'usedAmount': usedAmount,
      'remaining': (amount - usedAmount).clamp(0.0, double.infinity),
      'status': _determineStatus(progress),
      'displayMode': mode.name,
    };
  }

  /// 轉換為詳細格式
  static Map<String, dynamic> _transformToDetail(dynamic sourceData, UserMode mode) {
    final Map<String, dynamic> data = sourceData is Map<String, dynamic> 
        ? sourceData 
        : {};
    
    // 先取得摘要資料
    final Map<String, dynamic> result = _transformToSummary(data, mode);
    
    // 添加詳細資訊
    result.addAll({
      'description': data['description'] ?? '',
      'createdAt': data['created_at'] ?? data['createdAt'],
      'updatedAt': data['updated_at'] ?? data['updatedAt'],
      'categories': data['categories'] ?? [],
      'alertRules': data['alert_rules'] ?? data['alertRules'] ?? {},
      'period': {
        'start': data['start_date'] ?? data['startDate'],
        'end': data['end_date'] ?? data['endDate'],
        'type': data['period_type'] ?? data['type'] ?? 'monthly',
      },
    });

    return result;
  }

  /// 計算成就資訊（Cultivation模式專用）
  static Map<String, dynamic> _calculateAchievement(Map<String, dynamic> data) {
    final double progress = (data['progress'] ?? 0.0).toDouble();
    
    if (progress >= 100) {
      return {
        'level': 'exceeded',
        'message': '預算已超支，需要調整支出',
        'icon': '⚠️',
        'color': '#FF6B6B'
      };
    } else if (progress >= 80) {
      return {
        'level': 'warning',
        'message': '預算使用接近上限，請注意支出',
        'icon': '🔶',
        'color': '#FFB84D'
      };
    } else if (progress >= 50) {
      return {
        'level': 'progress',
        'message': '預算執行進度良好',
        'icon': '📊',
        'color': '#4ECDC4'
      };
    } else {
      return {
        'level': 'safe',
        'message': '預算使用在安全範圍內',
        'icon': '✅',
        'color': '#45B7D1'
      };
    }
  }

  /// 取得簡化狀態（Guiding模式專用）
  static String _getSimpleStatus(Map<String, dynamic> data) {
    final double progress = ((data['usedAmount'] ?? 0.0) / (data['amount'] ?? 1.0)) * 100;
    
    if (progress >= 100) return '超支';
    if (progress >= 80) return '接近上限';
    if (progress >= 50) return '使用中';
    return '充足';
  }

  /// 取得下一步建議（Guiding模式專用）
  static String _getNextAction(Map<String, dynamic> data) {
    final double progress = ((data['usedAmount'] ?? 0.0) / (data['amount'] ?? 1.0)) * 100;
    
    if (progress >= 100) return '調整支出計畫';
    if (progress >= 80) return '控制支出速度';
    if (progress >= 50) return '繼續記錄支出';
    return '按計畫執行';
  }

  /// 判斷預算狀態
  static String _determineStatus(double progress) {
    if (progress >= 100) return 'exceeded';
    if (progress >= 95) return 'critical';  
    if (progress >= 80) return 'warning';
    return 'normal';
  }

  /// =============== 階段二：統一狀態管理函數（3個函數）===============

  /**
   * 06. 預算狀態初始化
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 初始化所有預算相關狀態
   */
  static Future<void> initBudgetProvider(String userId, UserMode mode) async {
    try {
      print('[initBudgetProvider] 初始化預算狀態 - 用戶ID: $userId, 模式: ${mode.name}');
      
      // 驗證必要參數
      if (userId.isEmpty) {
        throw ArgumentError('用戶ID不能為空');
      }

      // 初始化預算狀態結構
      _budgetProviderState = BudgetProviderState(
        budgets: [],
        currentBudget: null,
        execution: null,
        alerts: [],
        isLoading: false,
        errorMessage: null,
        userId: userId,
        userMode: mode,
        lastUpdated: DateTime.now(),
      );

      // 根據用戶模式初始化特定狀態
      await _initializeModeSpecificState(mode);
      
      // 載入用戶的預算數據
      await _loadUserBudgets(userId);
      
      print('[initBudgetProvider] 預算狀態初始化完成');
      
    } catch (error) {
      print('[initBudgetProvider] 狀態初始化錯誤: $error');
      // 設置錯誤狀態
      _budgetProviderState = _budgetProviderState?.copyWith(
        isLoading: false,
        errorMessage: '預算狀態初始化失敗: $error',
      );
      rethrow;
    }
  }

  /**
   * 07. 統一狀態更新
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一處理所有預算狀態更新
   */
  static void updateBudgetState(BudgetStateUpdate update) {
    try {
      print('[updateBudgetState] 更新預算狀態 - 類型: ${update.type}');
      
      if (_budgetProviderState == null) {
        throw StateError('預算狀態未初始化，請先調用 initBudgetProvider');
      }

      // 根據更新類型執行對應的狀態更新
      switch (update.type) {
        case BudgetStateUpdateType.setBudgets:
          _budgetProviderState = _budgetProviderState!.copyWith(
            budgets: update.budgets ?? [],
            lastUpdated: DateTime.now(),
          );
          break;
          
        case BudgetStateUpdateType.setCurrentBudget:
          _budgetProviderState = _budgetProviderState!.copyWith(
            currentBudget: update.currentBudget,
            lastUpdated: DateTime.now(),
          );
          break;
          
        case BudgetStateUpdateType.setExecution:
          _budgetProviderState = _budgetProviderState!.copyWith(
            execution: update.execution,
            lastUpdated: DateTime.now(),
          );
          break;
          
        case BudgetStateUpdateType.setAlerts:
          _budgetProviderState = _budgetProviderState!.copyWith(
            alerts: update.alerts ?? [],
            lastUpdated: DateTime.now(),
          );
          break;
          
        case BudgetStateUpdateType.setLoading:
          _budgetProviderState = _budgetProviderState!.copyWith(
            isLoading: update.isLoading ?? false,
            lastUpdated: DateTime.now(),
          );
          break;
          
        case BudgetStateUpdateType.setError:
          _budgetProviderState = _budgetProviderState!.copyWith(
            errorMessage: update.errorMessage,
            isLoading: false,
            lastUpdated: DateTime.now(),
          );
          break;
          
        case BudgetStateUpdateType.addBudget:
          if (update.budget != null) {
            final currentBudgets = List<Budget>.from(_budgetProviderState!.budgets);
            currentBudgets.add(update.budget!);
            _budgetProviderState = _budgetProviderState!.copyWith(
              budgets: currentBudgets,
              lastUpdated: DateTime.now(),
            );
          }
          break;
          
        case BudgetStateUpdateType.updateBudget:
          if (update.budget != null) {
            final currentBudgets = List<Budget>.from(_budgetProviderState!.budgets);
            final index = currentBudgets.indexWhere((b) => b.id == update.budget!.id);
            if (index != -1) {
              currentBudgets[index] = update.budget!;
              _budgetProviderState = _budgetProviderState!.copyWith(
                budgets: currentBudgets,
                lastUpdated: DateTime.now(),
              );
            }
          }
          break;
          
        case BudgetStateUpdateType.removeBudget:
          if (update.budgetId != null) {
            final currentBudgets = _budgetProviderState!.budgets
                .where((b) => b.id != update.budgetId)
                .toList();
            _budgetProviderState = _budgetProviderState!.copyWith(
              budgets: currentBudgets,
              lastUpdated: DateTime.now(),
            );
          }
          break;
      }

      // 通知狀態變更（模擬Provider通知）
      _notifyStateListeners();
      
      print('[updateBudgetState] 狀態更新完成 - ${update.type}');
      
    } catch (error) {
      print('[updateBudgetState] 狀態更新錯誤: $error');
      
      // 設置錯誤狀態
      if (_budgetProviderState != null) {
        _budgetProviderState = _budgetProviderState!.copyWith(
          errorMessage: '狀態更新失敗: $error',
          isLoading: false,
          lastUpdated: DateTime.now(),
        );
        _notifyStateListeners();
      }
    }
  }

  /**
   * 08. 狀態重置
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 重置所有預算相關狀態
   */
  static void resetBudgetState({bool keepCache = false}) {
    try {
      print('[resetBudgetState] 重置預算狀態 - 保留快取: $keepCache');
      
      if (_budgetProviderState == null) {
        print('[resetBudgetState] 狀態未初始化，無需重置');
        return;
      }

      // 決定是否保留部分狀態
      if (keepCache && _budgetProviderState != null) {
        // 保留快取，僅重置運行時狀態
        _budgetProviderState = _budgetProviderState!.copyWith(
          currentBudget: null,
          execution: null,
          alerts: [],
          isLoading: false,
          errorMessage: null,
          lastUpdated: DateTime.now(),
        );
        print('[resetBudgetState] 狀態部分重置完成（保留預算列表）');
      } else {
        // 完全重置所有狀態
        _budgetProviderState = null;
        _stateListeners.clear();
        
        // 清理快取
        _budgetCache.clear();
        
        print('[resetBudgetState] 狀態完全重置完成');
      }

      // 通知狀態變更
      _notifyStateListeners();
      
    } catch (error) {
      print('[resetBudgetState] 狀態重置錯誤: $error');
    }
  }

  /// =============== 階段二：狀態管理輔助類別與方法 ===============

  /// 預算狀態提供者狀態類別
  static BudgetProviderState? _budgetProviderState;
  
  /// 狀態變更監聽器列表
  static final List<Function(BudgetProviderState?)> _stateListeners = [];
  
  /// 預算快取
  static final Map<String, Budget> _budgetCache = {};

  /// 根據用戶模式初始化特定狀態
  static Future<void> _initializeModeSpecificState(UserMode mode) async {
    switch (mode) {
      case UserMode.Expert:
        // Expert模式：啟用進階功能狀態
        print('[initializeModeSpecificState] 初始化Expert模式狀態');
        break;
        
      case UserMode.Cultivation:
        // Cultivation模式：初始化成就追蹤狀態
        print('[initializeModeSpecificState] 初始化Cultivation模式狀態');
        break;
        
      case UserMode.Guiding:
        // Guiding模式：初始化引導狀態
        print('[initializeModeSpecificState] 初始化Guiding模式狀態');
        break;
        
      case UserMode.Inertial:
      default:
        // Inertial模式：標準狀態
        print('[initializeModeSpecificState] 初始化Inertial模式狀態');
        break;
    }
  }

  /// 載入用戶預算數據
  static Future<void> _loadUserBudgets(String userId) async {
    try {
      // 透過APL.dart取得用戶預算列表
      final response = await APL.instance.budget.getBudgets(
        userMode: _budgetProviderState?.userMode.name,
        limit: 50,
      );

      if (response.success && response.data != null) {
        final budgets = (response.data as List).map((data) => 
          Budget.fromJson(data as Map<String, dynamic>)
        ).toList();
        
        // 更新狀態
        updateBudgetState(BudgetStateUpdate(
          type: BudgetStateUpdateType.setBudgets,
          budgets: budgets,
        ));
        
        print('[_loadUserBudgets] 載入 ${budgets.length} 個預算');
      }
    } catch (error) {
      print('[_loadUserBudgets] 載入用戶預算失敗: $error');
      
      updateBudgetState(BudgetStateUpdate(
        type: BudgetStateUpdateType.setError,
        errorMessage: '載入預算失敗: $error',
      ));
    }
  }

  /// 通知狀態監聽器
  static void _notifyStateListeners() {
    for (final listener in _stateListeners) {
      try {
        listener(_budgetProviderState);
      } catch (error) {
        print('[_notifyStateListeners] 監聽器通知錯誤: $error');
      }
    }
  }

  /// 添加狀態監聽器
  static void addStateListener(Function(BudgetProviderState?) listener) {
    _stateListeners.add(listener);
  }

  /// 移除狀態監聽器
  static void removeStateListener(Function(BudgetProviderState?) listener) {
    _stateListeners.remove(listener);
  }

  /// 取得當前狀態
  static BudgetProviderState? get currentState => _budgetProviderState;

  /// =============== 階段三：API整合與工具函數（7個函數）===============

  /**
   * 09. 統一API客戶端
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 透過APL.dart的統一API調用入口
   */
  static Future<ApiResponse<T>> budgetApiClient<T>(
    String endpoint,
    ApiMethod method,
    Map<String, dynamic>? data,
    T Function(dynamic) parser
  ) async {
    try {
      print('[budgetApiClient] 統一API調用 - 端點: $endpoint, 方法: $method');
      
      // 驗證必要參數
      if (endpoint.isEmpty) {
        throw ArgumentError('API端點不能為空');
      }
      
      // 構建請求參數
      final requestData = data ?? {};
      
      // 根據HTTP方法調用對應的APL.dart方法
      switch (method) {
        case ApiMethod.GET:
          final response = await APL.instance.budget.getBudgets(
            userMode: requestData['userMode'],
            limit: requestData['limit'],
          );
          return _parseApiResponse<T>(response, parser);
          
        case ApiMethod.POST:
          final response = await APL.instance.budget.createBudget(requestData);
          return _parseApiResponse<T>(response, parser);
          
        case ApiMethod.PUT:
          final budgetId = requestData['id']?.toString() ?? '';
          final response = await APL.instance.budget.updateBudget(budgetId, requestData);
          return _parseApiResponse<T>(response, parser);
          
        case ApiMethod.DELETE:
          final budgetId = requestData['id']?.toString() ?? '';
          final response = await APL.instance.budget.deleteBudget(budgetId);
          return _parseApiResponse<T>(response, parser);
      }
      
    } catch (error) {
      print('[budgetApiClient] API調用錯誤: $error');
      return ApiResponse<T>.failure(
        error: ApiError(
          code: 'API_CLIENT_ERROR',
          message: 'API調用失敗: $error',
        ),
      );
    }
  }

  /**
   * 10. 統一回應處理
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一處理所有API回應
   */
  static T handleApiResponse<T>(
    ApiResponse<T> response,
    T Function(dynamic) successHandler,
    {T? fallbackValue}
  ) {
    try {
      print('[handleApiResponse] 處理API回應 - 成功: ${response.success}');
      
      if (response.success && response.data != null) {
        // 成功回應處理
        return successHandler(response.data);
      } else {
        // 失敗回應處理
        final errorMessage = response.error?.message ?? '未知錯誤';
        print('[handleApiResponse] API錯誤: $errorMessage');
        
        if (fallbackValue != null) {
          return fallbackValue;
        } else {
          throw ApiException(
            code: response.error?.code ?? 'UNKNOWN_ERROR',
            message: errorMessage,
          );
        }
      }
      
    } catch (error) {
      print('[handleApiResponse] 回應處理錯誤: $error');
      
      if (fallbackValue != null) {
        return fallbackValue;
      } else {
        throw ApiException(
          code: 'RESPONSE_HANDLER_ERROR',
          message: '回應處理失敗: $error',
        );
      }
    }
  }

  /**
   * 11. 統一錯誤處理
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一處理所有API錯誤
   */
  static BudgetError handleApiError(
    dynamic error,
    UserMode mode,
    {String? context}
  ) {
    try {
      print('[handleApiError] 處理API錯誤 - 模式: ${mode.name}, 上下文: $context');
      
      String errorCode = 'UNKNOWN_ERROR';
      String errorMessage = '發生未知錯誤';
      
      // 根據錯誤類型進行分類處理
      if (error is ApiException) {
        errorCode = error.code;
        errorMessage = error.message;
      } else if (error is ArgumentError) {
        errorCode = 'ARGUMENT_ERROR';
        errorMessage = '參數錯誤: ${error.message}';
      } else if (error is StateError) {
        errorCode = 'STATE_ERROR';
        errorMessage = '狀態錯誤: ${error.message}';
      } else if (error is TimeoutException) {
        errorCode = 'TIMEOUT_ERROR';
        errorMessage = '請求超時，請稍後重試';
      } else {
        errorMessage = error.toString();
      }
      
      // 根據用戶模式調整錯誤訊息
      final userFriendlyMessage = _getUserFriendlyErrorMessage(errorCode, errorMessage, mode);
      
      return BudgetError(
        code: errorCode,
        message: userFriendlyMessage,
        userMode: mode,
        context: context,
        details: {
          'original_error': error.toString(),
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
      
    } catch (handlerError) {
      print('[handleApiError] 錯誤處理器錯誤: $handlerError');
      
      return BudgetError(
        code: 'ERROR_HANDLER_FAILED',
        message: '錯誤處理失敗，請聯繫技術支援',
        userMode: mode,
        context: context,
      );
    }
  }

  /**
   * 12. 統一請求構建
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一構建API請求
   */
  static Map<String, dynamic> buildApiRequest(
    Map<String, dynamic> data,
    UserMode mode,
    {Map<String, String>? headers}
  ) {
    try {
      print('[buildApiRequest] 構建API請求 - 模式: ${mode.name}');
      
      final Map<String, dynamic> request = {};
      
      // 複製原始資料
      request.addAll(data);
      
      // 添加統一欄位
      request['userMode'] = mode.name;
      request['timestamp'] = DateTime.now().toIso8601String();
      request['requestId'] = _generateRequestId();
      
      // 根據用戶模式添加特定參數
      switch (mode) {
        case UserMode.Expert:
          request['includeAdvancedData'] = true;
          request['detailLevel'] = 'full';
          break;
          
        case UserMode.Cultivation:
          request['includeGamification'] = true;
          request['includeAchievements'] = true;
          break;
          
        case UserMode.Guiding:
          request['includeGuidance'] = true;
          request['simplifyResponse'] = true;
          break;
          
        case UserMode.Inertial:
        default:
          request['detailLevel'] = 'standard';
          break;
      }
      
      // 添加自訂標頭
      if (headers != null && headers.isNotEmpty) {
        request['customHeaders'] = headers;
      }
      
      // 清理空值
      request.removeWhere((key, value) => value == null);
      
      print('[buildApiRequest] API請求構建完成 - 欄位數: ${request.keys.length}');
      return request;
      
    } catch (error) {
      print('[buildApiRequest] 請求構建錯誤: $error');
      
      // 返回最基本的請求結構
      return {
        'userMode': mode.name,
        'timestamp': DateTime.now().toIso8601String(),
        'error': 'Request build failed: $error',
        ...data,
      };
    }
  }

  /**
   * 13. 統一資料解析
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一解析API回應資料
   */
  static T parseApiData<T>(
    dynamic apiData,
    T Function(Map<String, dynamic>) parser,
    UserMode mode
  ) {
    try {
      print('[parseApiData] 解析API資料 - 模式: ${mode.name}');
      
      if (apiData == null) {
        throw ArgumentError('API資料不能為null');
      }
      
      Map<String, dynamic> dataMap;
      
      // 資料格式標準化
      if (apiData is Map<String, dynamic>) {
        dataMap = apiData;
      } else if (apiData is String) {
        try {
          dataMap = jsonDecode(apiData) as Map<String, dynamic>;
        } catch (e) {
          throw FormatException('無法解析JSON字串: $e');
        }
      } else if (apiData is List) {
        // 處理陣列資料
        dataMap = {'items': apiData, 'count': apiData.length};
      } else {
        dataMap = {'data': apiData};
      }
      
      // 根據用戶模式進行資料後處理
      final processedData = _postProcessApiData(dataMap, mode);
      
      // 使用提供的解析器解析資料
      final result = parser(processedData);
      
      print('[parseApiData] 資料解析完成');
      return result;
      
    } catch (error) {
      print('[parseApiData] 資料解析錯誤: $error');
      throw ParseException('API資料解析失敗: $error');
    }
  }

  /**
   * 14. 快取鍵值生成
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一生成預算相關快取鍵值
   */
  static String generateCacheKey(String prefix, Map<String, dynamic> params) {
    try {
      print('[generateCacheKey] 生成快取鍵值 - 前綴: $prefix');
      
      if (prefix.isEmpty) {
        throw ArgumentError('快取前綴不能為空');
      }
      
      final List<String> keyParts = [prefix];
      
      // 排序參數以確保一致性
      final sortedKeys = params.keys.toList()..sort();
      
      for (final key in sortedKeys) {
        final value = params[key];
        if (value != null) {
          keyParts.add('${key}:${value.toString()}');
        }
      }
      
      // 生成最終快取鍵值
      final cacheKey = keyParts.join('|');
      
      // 生成鍵值雜湊（限制長度）
      final hash = cacheKey.hashCode.abs().toString();
      final shortKey = '${prefix}_${hash}';
      
      print('[generateCacheKey] 快取鍵值生成完成: $shortKey');
      return shortKey;
      
    } catch (error) {
      print('[generateCacheKey] 快取鍵值生成錯誤: $error');
      
      // 返回安全的預設鍵值
      final fallbackKey = '${prefix}_${DateTime.now().millisecondsSinceEpoch}';
      return fallbackKey;
    }
  }

  /**
   * 15. 顯示格式化
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @description 統一格式化預算顯示資料
   */
  static String formatBudgetDisplay(
    dynamic budgetData,
    BudgetDisplayType displayType,
    UserMode mode
  ) {
    try {
      print('[formatBudgetDisplay] 格式化預算顯示 - 類型: $displayType, 模式: ${mode.name}');
      
      if (budgetData == null) {
        return '無資料';
      }
      
      final Map<String, dynamic> data = budgetData is Map<String, dynamic> 
          ? budgetData 
          : {'value': budgetData};
      
      // 根據顯示類型進行格式化
      switch (displayType) {
        case BudgetDisplayType.currency:
          return _formatCurrency(data, mode);
          
        case BudgetDisplayType.percentage:
          return _formatPercentage(data, mode);
          
        case BudgetDisplayType.date:
          return _formatDate(data, mode);
          
        case BudgetDisplayType.status:
          return _formatStatus(data, mode);
          
        case BudgetDisplayType.summary:
          return _formatSummary(data, mode);
      }
      
    } catch (error) {
      print('[formatBudgetDisplay] 格式化錯誤: $error');
      return '格式化失敗';
    }
  }

  /// =============== 階段三：私有輔助方法 ===============

  /// API回應解析
  static ApiResponse<T> _parseApiResponse<T>(dynamic response, T Function(dynamic) parser) {
    try {
      if (response != null && response is Map<String, dynamic> && response['success'] == true) {
        final data = parser(response['data']);
        return ApiResponse<T>.success(data: data);
      } else {
        return ApiResponse<T>.failure(
          error: ApiError(
            code: 'PARSE_ERROR',
            message: '回應解析失敗',
          ),
        );
      }
    } catch (error) {
      return ApiResponse<T>.failure(
        error: ApiError(
          code: 'PARSER_ERROR',
          message: '解析器錯誤: $error',
        ),
      );
    }
  }

  /// 取得用戶友好的錯誤訊息
  static String _getUserFriendlyErrorMessage(String errorCode, String originalMessage, UserMode mode) {
    // 根據用戶模式調整錯誤訊息風格
    final Map<String, String> friendlyMessages = {
      'NETWORK_ERROR': mode == UserMode.Guiding ? '網路連線有問題，請檢查網路' : '網路錯誤',
      'TIMEOUT_ERROR': mode == UserMode.Guiding ? '請求時間太長，請稍後再試' : '請求超時',
      'AUTH_ERROR': mode == UserMode.Guiding ? '需要重新登入' : '認證失敗',
      'PERMISSION_ERROR': mode == UserMode.Guiding ? '沒有權限執行此操作' : '權限不足',
      'VALIDATION_ERROR': mode == UserMode.Guiding ? '輸入的資料有問題' : '資料驗證失敗',
    };
    
    return friendlyMessages[errorCode] ?? originalMessage;
  }

  /// 生成請求ID
  static String _generateRequestId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = timestamp.hashCode.abs();
    return 'req_${timestamp}_${random}';
  }

  /// API資料後處理
  static Map<String, dynamic> _postProcessApiData(Map<String, dynamic> data, UserMode mode) {
    final Map<String, dynamic> processedData = Map.from(data);
    
    // 根據用戶模式添加額外處理
    switch (mode) {
      case UserMode.Expert:
        // Expert模式：保留所有詳細資料
        processedData['_mode'] = 'expert';
        break;
        
      case UserMode.Cultivation:
        // Cultivation模式：添加遊戲化元素
        processedData['_gamification'] = true;
        if (data.containsKey('progress')) {
          processedData['achievement'] = _calculateAchievement({'progress': data['progress']});
        }
        break;
        
      case UserMode.Guiding:
        // Guiding模式：簡化資料
        processedData['_simplified'] = true;
        break;
        
      case UserMode.Inertial:
      default:
        // Inertial模式：標準處理
        processedData['_mode'] = 'standard';
        break;
    }
    
    return processedData;
  }

  /// 格式化貨幣
  static String _formatCurrency(Map<String, dynamic> data, UserMode mode) {
    final amount = (data['amount'] ?? data['value'] ?? 0.0).toDouble();
    final currency = data['currency'] ?? 'TWD';
    
    final formattedAmount = amount.toStringAsFixed(0);
    
    switch (mode) {
      case UserMode.Guiding:
        return '$currency $formattedAmount';
      default:
        return '$formattedAmount $currency';
    }
  }

  /// 格式化百分比
  static String _formatPercentage(Map<String, dynamic> data, UserMode mode) {
    final progress = (data['progress'] ?? data['value'] ?? 0.0).toDouble();
    
    switch (mode) {
      case UserMode.Guiding:
        if (progress >= 100) return '已超支';
        if (progress >= 80) return '接近上限';
        return '${progress.toStringAsFixed(1)}%';
      default:
        return '${progress.toStringAsFixed(2)}%';
    }
  }

  /// 格式化日期
  static String _formatDate(Map<String, dynamic> data, UserMode mode) {
    final dateStr = data['date']?.toString() ?? data['value']?.toString();
    if (dateStr == null) return '無日期';
    
    try {
      final date = DateTime.parse(dateStr);
      
      switch (mode) {
        case UserMode.Guiding:
          return '${date.month}/${date.day}';
        default:
          return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
      }
    } catch (e) {
      return dateStr;
    }
  }

  /// 格式化狀態
  static String _formatStatus(Map<String, dynamic> data, UserMode mode) {
    final status = data['status']?.toString() ?? data['value']?.toString() ?? 'unknown';
    
    final statusMap = {
      'active': mode == UserMode.Guiding ? '使用中' : '啟用',
      'exceeded': mode == UserMode.Guiding ? '超支了' : '已超支',
      'warning': mode == UserMode.Guiding ? '要注意' : '警示',
      'normal': mode == UserMode.Guiding ? '正常' : '正常',
    };
    
    return statusMap[status] ?? status;
  }

  /// 格式化摘要
  static String _formatSummary(Map<String, dynamic> data, UserMode mode) {
    final name = data['name'] ?? '預算';
    final progress = (data['progress'] ?? 0.0).toDouble();
    final amount = (data['amount'] ?? 0.0).toDouble();
    
    switch (mode) {
      case UserMode.Guiding:
        return '$name (已用${progress.toStringAsFixed(0)}%)';
      default:
        return '$name - ${progress.toStringAsFixed(1)}% / $amount';
    }
  }

  /// 取得模組資訊
  static Map<String, dynamic> getModuleInfo() {
    return {
      'name': '預算管理功能群',
      'version': moduleVersion,
      'phase': modulePhase,
      'lastUpdate': lastUpdate,
      'stage1_functions': [
        '01. processBudgetCRUD - 統一預算CRUD操作',
        '02. calculateBudgetExecution - 計算預算執行狀況', 
        '03. checkBudgetAlerts - 檢查預算警示',
        '04. validateBudgetData - 統一資料驗證',
        '05. transformBudgetData - 統一資料轉換',
      ],
      'stage2_functions': [
        '06. initBudgetProvider - 預算狀態初始化',
        '07. updateBudgetState - 統一狀態更新',
        '08. resetBudgetState - 狀態重置',
      ],
      'stage3_functions': [
        '09. budgetApiClient - 統一API客戶端',
        '10. handleApiResponse - 統一回應處理',
        '11. handleApiError - 統一錯誤處理',
        '12. buildApiRequest - 統一請求構建',
        '13. parseApiData - 統一資料解析',
        '14. generateCacheKey - 快取鍵值生成',
        '15. formatBudgetDisplay - 顯示格式化',
      ],
      'total_planned_functions': 15,
      'implemented_functions': 15,
      'implementation_progress': '100%',
    };
  }
}

/// =============== 階段三：支援類別與枚舉 ===============

/// API方法枚舉
enum ApiMethod {
  GET,
  POST,
  PUT,
  DELETE,
}

/// API回應類別
class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiError? error;

  ApiResponse({
    required this.success,
    this.data,
    this.error,
  });

  factory ApiResponse.success({T? data}) {
    return ApiResponse<T>(
      success: true,
      data: data,
    );
  }

  factory ApiResponse.failure({ApiError? error}) {
    return ApiResponse<T>(
      success: false,
      error: error,
    );
  }
}

/// API錯誤類別
class ApiError {
  final String code;
  final String message;

  ApiError({
    required this.code,
    required this.message,
  });
}

/// API異常類別
class ApiException implements Exception {
  final String code;
  final String message;

  ApiException({
    required this.code,
    required this.message,
  });

  @override
  String toString() {
    return 'ApiException($code): $message';
  }
}

/// 解析異常類別
class ParseException implements Exception {
  final String message;

  ParseException(this.message);

  @override
  String toString() {
    return 'ParseException: $message';
  }
}

/// 預算顯示類型枚舉
enum BudgetDisplayType {
  currency,
  percentage,
  date,
  status,
  summary,
}

/// 超時異常（模擬）
class TimeoutException implements Exception {
  final String message;

  TimeoutException(this.message);

  @override
  String toString() {
    return 'TimeoutException: $message';
  }
}
