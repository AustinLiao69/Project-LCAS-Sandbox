
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
      'total_planned_functions': 15,
      'implemented_functions': 5,
      'implementation_progress': '33.3%',
    };
  }
}
