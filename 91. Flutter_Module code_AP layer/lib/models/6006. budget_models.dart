
/**
 * budget_models.dart_預算資料模型_1.0.0
 * @module 預算資料模型
 * @description LCAS 2.0 Flutter 預算管理相關資料模型 - 預算設定、追蹤監控、警示等資料結構
 * @update 2025-01-24: 建立預算相關資料模型，支援多維度預算管理和智慧警示
 */

import 'package:json_annotation/json_annotation.dart';

part 'budget_models.g.dart';

/// 預算模型
@JsonSerializable()
class Budget {
  final String id;
  final String name;
  final String description;
  final String userId;
  final String? projectId;
  final String type; // monthly, category, project, custom
  final double targetAmount;
  final double spentAmount;
  final String period; // monthly, quarterly, yearly, custom
  final DateTime startDate;
  final DateTime endDate;
  final String status; // active, paused, completed
  final BudgetSettings settings;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const Budget({
    required this.id,
    required this.name,
    required this.description,
    required this.userId,
    this.projectId,
    required this.type,
    required this.targetAmount,
    required this.spentAmount,
    required this.period,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.settings,
    required this.createdAt,
    this.updatedAt,
  });

  factory Budget.fromJson(Map<String, dynamic> json) =>
      _$BudgetFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetToJson(this);

  /// 複製預算並更新部分欄位
  Budget copyWith({
    String? id,
    String? name,
    String? description,
    String? userId,
    String? projectId,
    String? type,
    double? targetAmount,
    double? spentAmount,
    String? period,
    DateTime? startDate,
    DateTime? endDate,
    String? status,
    BudgetSettings? settings,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Budget(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      userId: userId ?? this.userId,
      projectId: projectId ?? this.projectId,
      type: type ?? this.type,
      targetAmount: targetAmount ?? this.targetAmount,
      spentAmount: spentAmount ?? this.spentAmount,
      period: period ?? this.period,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      settings: settings ?? this.settings,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// 剩餘預算金額
  double get remainingAmount => targetAmount - spentAmount;

  /// 預算使用百分比
  double get usagePercentage => 
      targetAmount > 0 ? (spentAmount / targetAmount) * 100 : 0;

  /// 是否超支
  bool get isOverBudget => spentAmount > targetAmount;

  /// 是否即將超支（根據警示閾值）
  bool get isNearLimit => 
      usagePercentage >= (settings.alertThreshold * 100);

  /// 是否為活躍預算
  bool get isActive => status == 'active';

  /// 預算期間是否有效
  bool get isValidPeriod {
    final now = DateTime.now();
    return now.isAfter(startDate) && now.isBefore(endDate);
  }
}

/// 建立預算請求模型
@JsonSerializable()
class CreateBudgetRequest {
  final String name;
  final String description;
  final String? projectId;
  final String type;
  final double targetAmount;
  final String period;
  final DateTime startDate;
  final DateTime endDate;
  final BudgetSettings? settings;
  final List<String>? categories;
  final Map<String, dynamic>? metadata;

  const CreateBudgetRequest({
    required this.name,
    required this.description,
    this.projectId,
    required this.type,
    required this.targetAmount,
    required this.period,
    required this.startDate,
    required this.endDate,
    this.settings,
    this.categories,
    this.metadata,
  });

  factory CreateBudgetRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateBudgetRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$CreateBudgetRequestToJson(this);
}

/// 預算設定模型
@JsonSerializable()
class BudgetSettings {
  final double alertThreshold; // 0.0-1.0, 警示閾值
  final bool enableNotifications;
  final List<String> notificationTypes; // email, push, sms
  final bool autoRollover; // 是否自動結轉
  final String? rolloverRule; // surplus, deficit, none
  final List<String>? includedCategories;
  final List<String>? excludedCategories;
  final Map<String, dynamic>? customRules;

  const BudgetSettings({
    required this.alertThreshold,
    required this.enableNotifications,
    required this.notificationTypes,
    required this.autoRollover,
    this.rolloverRule,
    this.includedCategories,
    this.excludedCategories,
    this.customRules,
  });

  factory BudgetSettings.fromJson(Map<String, dynamic> json) =>
      _$BudgetSettingsFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetSettingsToJson(this);
}

/// 預算監控請求模型
@JsonSerializable()
class BudgetMonitorRequest {
  final String budgetId;
  final DateTime? startDate;
  final DateTime? endDate;
  final bool includeProjections;
  final bool includeTrends;
  final bool includeCategories;
  final String analysisDepth; // basic, detailed, comprehensive

  const BudgetMonitorRequest({
    required this.budgetId,
    this.startDate,
    this.endDate,
    this.includeProjections = false,
    this.includeTrends = false,
    this.includeCategories = false,
    this.analysisDepth = 'basic',
  });

  factory BudgetMonitorRequest.fromJson(Map<String, dynamic> json) =>
      _$BudgetMonitorRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetMonitorRequestToJson(this);
}

/// 預算監控回應模型
@JsonSerializable()
class BudgetMonitorResponse {
  final bool success;
  final Budget budget;
  final BudgetStatus status;
  final BudgetAnalysis? analysis;
  final List<BudgetAlert>? alerts;
  final String message;
  final DateTime timestamp;

  const BudgetMonitorResponse({
    required this.success,
    required this.budget,
    required this.status,
    this.analysis,
    this.alerts,
    required this.message,
    required this.timestamp,
  });

  factory BudgetMonitorResponse.fromJson(Map<String, dynamic> json) =>
      _$BudgetMonitorResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetMonitorResponseToJson(this);
}

/// 預算狀態模型
@JsonSerializable()
class BudgetStatus {
  final double currentProgress; // 0.0-1.0
  final double dailyAverage;
  final double projectedTotal;
  final int daysRemaining;
  final String healthStatus; // healthy, warning, critical
  final Map<String, double>? categoryBreakdown;
  final List<BudgetTrend>? trends;

  const BudgetStatus({
    required this.currentProgress,
    required this.dailyAverage,
    required this.projectedTotal,
    required this.daysRemaining,
    required this.healthStatus,
    this.categoryBreakdown,
    this.trends,
  });

  factory BudgetStatus.fromJson(Map<String, dynamic> json) =>
      _$BudgetStatusFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetStatusToJson(this);
}

/// 預算分析模型
@JsonSerializable()
class BudgetAnalysis {
  final Map<String, double> categorySpending;
  final List<String> topCategories;
  final double averageDailySpending;
  final double projectedOverrun;
  final List<String> recommendations;
  final Map<String, dynamic>? historicalComparison;

  const BudgetAnalysis({
    required this.categorySpending,
    required this.topCategories,
    required this.averageDailySpending,
    required this.projectedOverrun,
    required this.recommendations,
    this.historicalComparison,
  });

  factory BudgetAnalysis.fromJson(Map<String, dynamic> json) =>
      _$BudgetAnalysisFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetAnalysisToJson(this);
}

/// 預算警示模型
@JsonSerializable()
class BudgetAlert {
  final String id;
  final String budgetId;
  final String type; // threshold, overbudget, trend
  final String severity; // info, warning, critical
  final String message;
  final Map<String, dynamic>? data;
  final DateTime triggeredAt;
  final bool isRead;

  const BudgetAlert({
    required this.id,
    required this.budgetId,
    required this.type,
    required this.severity,
    required this.message,
    this.data,
    required this.triggeredAt,
    required this.isRead,
  });

  factory BudgetAlert.fromJson(Map<String, dynamic> json) =>
      _$BudgetAlertFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetAlertToJson(this);
}

/// 預算趨勢模型
@JsonSerializable()
class BudgetTrend {
  final DateTime date;
  final double cumulativeAmount;
  final double dailyAmount;
  final double projectedAmount;
  final String trend; // increasing, decreasing, stable

  const BudgetTrend({
    required this.date,
    required this.cumulativeAmount,
    required this.dailyAmount,
    required this.projectedAmount,
    required this.trend,
  });

  factory BudgetTrend.fromJson(Map<String, dynamic> json) =>
      _$BudgetTrendFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetTrendToJson(this);
}

/// 預算警示設定請求模型
@JsonSerializable()
class BudgetAlertSettingsRequest {
  final String budgetId;
  final double alertThreshold;
  final bool enableNotifications;
  final List<String> notificationTypes;
  final List<String> alertTriggers; // threshold, daily_limit, projected_overrun
  final Map<String, dynamic>? customSettings;

  const BudgetAlertSettingsRequest({
    required this.budgetId,
    required this.alertThreshold,
    required this.enableNotifications,
    required this.notificationTypes,
    required this.alertTriggers,
    this.customSettings,
  });

  factory BudgetAlertSettingsRequest.fromJson(Map<String, dynamic> json) =>
      _$BudgetAlertSettingsRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$BudgetAlertSettingsRequestToJson(this);
}
