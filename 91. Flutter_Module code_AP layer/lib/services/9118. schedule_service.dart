
/**
 * Schedule服務模組_1.0.0
 * @module ScheduleService
 * @description LCAS 2.0 排程提醒服務 - 智慧記帳自動化核心功能
 * @update 2025-01-23: 建立v1.0.0版本，實現排程提醒、付費功能控制、Quick Reply互動
 */

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/auth_models.dart';

/// 排程提醒配置
class ScheduleConfig {
  static const int maxFreeReminders = 2;
  static const String defaultReminderTime = '09:00';
  static const String timezone = 'Asia/Taipei';
  
  static const Map<String, String> reminderTypes = {
    'DAILY': 'daily',
    'WEEKLY': 'weekly',
    'MONTHLY': 'monthly',
    'CUSTOM': 'custom'
  };
}

/// Quick Reply 按鈕配置
class QuickReplyConfig {
  static const Map<String, Map<String, String>> statistics = {
    'TODAY': {'label': '今日統計', 'postbackData': '今日統計'},
    'WEEKLY': {'label': '本週統計', 'postbackData': '本週統計'},
    'MONTHLY': {'label': '本月統計', 'postbackData': '本月統計'}
  };
  
  static const Map<String, Map<String, String>> premium = {
    'UPGRADE': {'label': '立即升級', 'postbackData': 'upgrade_premium'},
    'TRIAL': {'label': '免費試用', 'postbackData': '試用'},
    'INFO': {'label': '了解更多', 'postbackData': '功能介紹'}
  };
}

/// 排程提醒資料模型
class ReminderData {
  final String? reminderId;
  final String userId;
  final String type;
  final String time;
  final String subjectCode;
  final String subjectName;
  final double amount;
  final String paymentMethod;
  final String message;
  final bool skipWeekends;
  final bool skipHolidays;
  final bool active;
  final DateTime? createdAt;
  final DateTime? nextExecution;

  ReminderData({
    this.reminderId,
    required this.userId,
    required this.type,
    required this.time,
    required this.subjectCode,
    required this.subjectName,
    required this.amount,
    required this.paymentMethod,
    this.message = '',
    this.skipWeekends = false,
    this.skipHolidays = false,
    this.active = true,
    this.createdAt,
    this.nextExecution,
  });

  Map<String, dynamic> toJson() {
    return {
      'reminderId': reminderId,
      'userId': userId,
      'type': type,
      'time': time,
      'subjectCode': subjectCode,
      'subjectName': subjectName,
      'amount': amount,
      'paymentMethod': paymentMethod,
      'message': message,
      'skipWeekends': skipWeekends,
      'skipHolidays': skipHolidays,
      'active': active,
      'createdAt': createdAt?.toIso8601String(),
      'nextExecution': nextExecution?.toIso8601String(),
    };
  }

  factory ReminderData.fromJson(Map<String, dynamic> json) {
    return ReminderData(
      reminderId: json['reminderId'],
      userId: json['userId'],
      type: json['type'],
      time: json['time'],
      subjectCode: json['subjectCode'],
      subjectName: json['subjectName'],
      amount: json['amount']?.toDouble() ?? 0.0,
      paymentMethod: json['paymentMethod'],
      message: json['message'] ?? '',
      skipWeekends: json['skipWeekends'] ?? false,
      skipHolidays: json['skipHolidays'] ?? false,
      active: json['active'] ?? true,
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      nextExecution: json['nextExecution'] != null ? DateTime.parse(json['nextExecution']) : null,
    );
  }
}

/// 統計資料模型
class StatisticsData {
  final double totalIncome;
  final double totalExpense;
  final int recordCount;
  final String period;

  StatisticsData({
    required this.totalIncome,
    required this.totalExpense,
    required this.recordCount,
    required this.period,
  });

  double get balance => totalIncome - totalExpense;

  factory StatisticsData.fromJson(Map<String, dynamic> json) {
    return StatisticsData(
      totalIncome: json['totalIncome']?.toDouble() ?? 0.0,
      totalExpense: json['totalExpense']?.toDouble() ?? 0.0,
      recordCount: json['recordCount'] ?? 0,
      period: json['period'] ?? '',
    );
  }
}

/// 權限檢查結果
class PermissionResult {
  final bool allowed;
  final String reason;
  final bool upgradeRequired;
  final String? featureType;
  final String? featureDescription;
  final bool? trialAvailable;
  final int? quotaUsed;
  final int? quotaLimit;

  PermissionResult({
    required this.allowed,
    required this.reason,
    this.upgradeRequired = false,
    this.featureType,
    this.featureDescription,
    this.trialAvailable,
    this.quotaUsed,
    this.quotaLimit,
  });

  factory PermissionResult.fromJson(Map<String, dynamic> json) {
    return PermissionResult(
      allowed: json['allowed'] ?? false,
      reason: json['reason'] ?? '',
      upgradeRequired: json['upgradeRequired'] ?? false,
      featureType: json['featureType'],
      featureDescription: json['featureDescription'],
      trialAvailable: json['trialAvailable'],
      quotaUsed: json['quotaUsed'],
      quotaLimit: json['quotaLimit'],
    );
  }
}

/// Quick Reply 選項
class QuickReplyOption {
  final String label;
  final String postbackData;

  QuickReplyOption({
    required this.label,
    required this.postbackData,
  });

  Map<String, dynamic> toJson() {
    return {
      'label': label,
      'postbackData': postbackData,
    };
  }
}

/// Quick Reply 回應
class QuickReplyResponse {
  final bool success;
  final String message;
  final List<QuickReplyOption> quickReplyOptions;
  final String? interactionType;
  final String? errorCode;

  QuickReplyResponse({
    required this.success,
    required this.message,
    this.quickReplyOptions = const [],
    this.interactionType,
    this.errorCode,
  });

  factory QuickReplyResponse.fromJson(Map<String, dynamic> json) {
    final optionsJson = json['quickReply']?['items'] ?? [];
    final options = (optionsJson as List)
        .map((item) => QuickReplyOption(
              label: item['label'] ?? '',
              postbackData: item['postbackData'] ?? '',
            ))
        .toList();

    return QuickReplyResponse(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      quickReplyOptions: options,
      interactionType: json['interactionType'],
      errorCode: json['errorCode'],
    );
  }
}

/// 排程服務類別
class ScheduleService {
  final ApiClient _apiClient = ApiClient();
  final ErrorHandler _errorHandler = ErrorHandler();

  // ==================== 排程管理功能 ====================

  /**
   * 01. 建立排程提醒設定
   * @version 2025-01-23-V1.0.0
   * @description 為用戶建立新的排程提醒設定，包含權限驗證和配額限制
   */
  Future<ApiResponse<Map<String, dynamic>>> createScheduledReminder({
    required ReminderData reminderData,
  }) async {
    try {
      final response = await _apiClient.post(
        '/api/v1/schedule/reminder/create',
        data: {
          'reminderData': reminderData.toJson(),
        },
      );

      if (response.success) {
        return ApiResponse.success(response.data);
      } else {
        return ApiResponse.error(
          response.message ?? '建立排程提醒失敗',
          response.code ?? 'CREATE_REMINDER_FAILED',
        );
      }
    } catch (e) {
      return _errorHandler.handleError(e, 'createScheduledReminder');
    }
  }

  /**
   * 02. 更新排程提醒設定
   * @version 2025-01-23-V1.0.0
   * @description 修改現有排程提醒的設定參數
   */
  Future<ApiResponse<Map<String, dynamic>>> updateScheduledReminder({
    required String reminderId,
    required Map<String, dynamic> updateData,
  }) async {
    try {
      final response = await _apiClient.put(
        '/api/v1/schedule/reminder/$reminderId/update',
        data: {
          'updateData': updateData,
        },
      );

      return response.success
          ? ApiResponse.success(response.data)
          : ApiResponse.error(
              response.message ?? '更新排程提醒失敗',
              response.code ?? 'UPDATE_REMINDER_FAILED',
            );
    } catch (e) {
      return _errorHandler.handleError(e, 'updateScheduledReminder');
    }
  }

  /**
   * 03. 刪除排程提醒
   * @version 2025-01-23-V1.0.0
   * @description 安全刪除排程提醒並清理相關資料
   */
  Future<ApiResponse<Map<String, dynamic>>> deleteScheduledReminder({
    required String reminderId,
    required String confirmationToken,
  }) async {
    try {
      final response = await _apiClient.delete(
        '/api/v1/schedule/reminder/$reminderId/delete',
        data: {
          'confirmationToken': confirmationToken,
        },
      );

      return response.success
          ? ApiResponse.success(response.data)
          : ApiResponse.error(
              response.message ?? '刪除排程提醒失敗',
              response.code ?? 'DELETE_REMINDER_FAILED',
            );
    } catch (e) {
      return _errorHandler.handleError(e, 'deleteScheduledReminder');
    }
  }

  /**
   * 04. 查詢使用者排程清單
   * @version 2025-01-23-V1.0.0
   * @description 取得使用者的所有排程提醒設定
   */
  Future<ApiResponse<List<ReminderData>>> getUserReminders() async {
    try {
      final response = await _apiClient.get('/api/v1/schedule/reminders/user');

      if (response.success) {
        final remindersJson = response.data['reminders'] as List? ?? [];
        final reminders = remindersJson
            .map((json) => ReminderData.fromJson(json))
            .toList();
        
        return ApiResponse.success(reminders);
      } else {
        return ApiResponse.error(
          response.message ?? '查詢排程清單失敗',
          response.code ?? 'GET_REMINDERS_FAILED',
        );
      }
    } catch (e) {
      return _errorHandler.handleError(e, 'getUserReminders');
    }
  }

  // ==================== 付費功能控制 ====================

  /**
   * 05. 驗證付費功能權限
   * @version 2025-01-23-V1.0.0
   * @description 檢查使用者是否有權限使用特定付費功能
   */
  Future<ApiResponse<PermissionResult>> validatePremiumFeature({
    required String featureName,
    Map<String, dynamic>? operationContext,
  }) async {
    try {
      final response = await _apiClient.post(
        '/api/v1/schedule/permission/validate',
        data: {
          'featureName': featureName,
          'operationContext': operationContext ?? {},
        },
      );

      if (response.success) {
        final permission = PermissionResult.fromJson(response.data);
        return ApiResponse.success(permission);
      } else {
        return ApiResponse.error(
          response.message ?? '權限驗證失敗',
          response.code ?? 'PERMISSION_VALIDATION_FAILED',
        );
      }
    } catch (e) {
      return _errorHandler.handleError(e, 'validatePremiumFeature');
    }
  }

  /**
   * 06. 檢查使用者配額
   * @version 2025-01-23-V1.0.0
   * @description 查詢使用者的功能使用配額和限制
   */
  Future<ApiResponse<Map<String, dynamic>>> getUserQuota() async {
    try {
      final response = await _apiClient.get('/api/v1/schedule/quota/user');

      return response.success
          ? ApiResponse.success(response.data)
          : ApiResponse.error(
              response.message ?? '查詢配額失敗',
              response.code ?? 'GET_QUOTA_FAILED',
            );
    } catch (e) {
      return _errorHandler.handleError(e, 'getUserQuota');
    }
  }

  // ==================== 統計查詢功能 ====================

  /**
   * 07. 取得快速統計資料
   * @version 2025-01-23-V1.0.0
   * @description 查詢今日、本週、本月的收支統計
   */
  Future<ApiResponse<StatisticsData>> getQuickStatistics({
    required String period, // 'today', 'week', 'month'
  }) async {
    try {
      final response = await _apiClient.get(
        '/api/v1/schedule/statistics/quick',
        queryParameters: {
          'period': period,
        },
      );

      if (response.success) {
        final stats = StatisticsData.fromJson(response.data);
        return ApiResponse.success(stats);
      } else {
        return ApiResponse.error(
          response.message ?? '查詢統計失敗',
          response.code ?? 'GET_STATISTICS_FAILED',
        );
      }
    } catch (e) {
      return _errorHandler.handleError(e, 'getQuickStatistics');
    }
  }

  // ==================== Quick Reply 互動功能 ====================

  /**
   * 08. 處理 Quick Reply 互動
   * @version 2025-01-23-V1.0.0
   * @description 統一處理Quick Reply互動事件，包含路由分發和回應生成
   */
  Future<ApiResponse<QuickReplyResponse>> handleQuickReplyInteraction({
    required String postbackData,
    Map<String, dynamic>? messageContext,
  }) async {
    try {
      final response = await _apiClient.post(
        '/api/v1/schedule/quickreply/handle',
        data: {
          'postbackData': postbackData,
          'messageContext': messageContext ?? {},
        },
      );

      if (response.success) {
        final quickReply = QuickReplyResponse.fromJson(response.data);
        return ApiResponse.success(quickReply);
      } else {
        return ApiResponse.error(
          response.message ?? 'Quick Reply 處理失敗',
          response.code ?? 'QUICKREPLY_HANDLE_FAILED',
        );
      }
    } catch (e) {
      return _errorHandler.handleError(e, 'handleQuickReplyInteraction');
    }
  }

  /**
   * 09. 生成 Quick Reply 選項
   * @version 2025-01-23-V1.0.0
   * @description 根據用戶類型和功能權限動態生成Quick Reply選項
   */
  Future<ApiResponse<List<QuickReplyOption>>> generateQuickReplyOptions({
    required String context, // 'statistics', 'paywall', 'upgrade_prompt', 'default'
    Map<String, dynamic>? additionalParams,
  }) async {
    try {
      final response = await _apiClient.get(
        '/api/v1/schedule/quickreply/options',
        queryParameters: {
          'context': context,
          if (additionalParams != null)
            ...additionalParams.map((key, value) => MapEntry(key, value.toString())),
        },
      );

      if (response.success) {
        final optionsJson = response.data['items'] as List? ?? [];
        final options = optionsJson
            .map((item) => QuickReplyOption(
                  label: item['label'] ?? '',
                  postbackData: item['postbackData'] ?? '',
                ))
            .toList();
        
        return ApiResponse.success(options);
      } else {
        return ApiResponse.error(
          response.message ?? '生成選項失敗',
          response.code ?? 'GENERATE_OPTIONS_FAILED',
        );
      }
    } catch (e) {
      return _errorHandler.handleError(e, 'generateQuickReplyOptions');
    }
  }

  // ==================== 付費功能推播服務 ====================

  /**
   * 10. 設定每日財務摘要
   * @version 2025-01-23-V1.0.0
   * @description 設定每日財務摘要自動推播（付費功能）
   */
  Future<ApiResponse<Map<String, dynamic>>> setupDailyFinancialSummary({
    required bool enabled,
    String pushTime = '21:00',
  }) async {
    try {
      final response = await _apiClient.post(
        '/api/v1/schedule/push/daily',
        data: {
          'enabled': enabled,
          'pushTime': pushTime,
        },
      );

      return response.success
          ? ApiResponse.success(response.data)
          : ApiResponse.error(
              response.message ?? '設定每日摘要失敗',
              response.code ?? 'SETUP_DAILY_SUMMARY_FAILED',
            );
    } catch (e) {
      return _errorHandler.handleError(e, 'setupDailyFinancialSummary');
    }
  }

  /**
   * 11. 設定預算警告
   * @version 2025-01-23-V1.0.0
   * @description 設定預算超支警告通知（付費功能）
   */
  Future<ApiResponse<Map<String, dynamic>>> setupBudgetWarning({
    required bool enabled,
    double warningThreshold = 80.0, // 預算使用率達80%時警告
  }) async {
    try {
      final response = await _apiClient.post(
        '/api/v1/schedule/push/budget',
        data: {
          'enabled': enabled,
          'warningThreshold': warningThreshold,
        },
      );

      return response.success
          ? ApiResponse.success(response.data)
          : ApiResponse.error(
              response.message ?? '設定預算警告失敗',
              response.code ?? 'SETUP_BUDGET_WARNING_FAILED',
            );
    } catch (e) {
      return _errorHandler.handleError(e, 'setupBudgetWarning');
    }
  }

  /**
   * 12. 設定月度報告
   * @version 2025-01-23-V1.0.0
   * @description 設定月度財務報告自動生成（付費功能）
   */
  Future<ApiResponse<Map<String, dynamic>>> setupMonthlyReport({
    required bool enabled,
    int dayOfMonth = 1, // 每月第幾天生成報告
    String reportTime = '21:00',
  }) async {
    try {
      final response = await _apiClient.post(
        '/api/v1/schedule/push/monthly',
        data: {
          'enabled': enabled,
          'dayOfMonth': dayOfMonth,
          'reportTime': reportTime,
        },
      );

      return response.success
          ? ApiResponse.success(response.data)
          : ApiResponse.error(
              response.message ?? '設定月度報告失敗',
              response.code ?? 'SETUP_MONTHLY_REPORT_FAILED',
            );
    } catch (e) {
      return _errorHandler.handleError(e, 'setupMonthlyReport');
    }
  }

  // ==================== 系統健康檢查 ====================

  /**
   * 13. 排程器健康檢查
   * @version 2025-01-23-V1.0.0
   * @description 檢查排程系統的運行狀態和健康度
   */
  Future<ApiResponse<Map<String, dynamic>>> checkSchedulerHealth() async {
    try {
      final response = await _apiClient.get('/api/v1/schedule/health');

      return response.success
          ? ApiResponse.success(response.data)
          : ApiResponse.error(
              response.message ?? '健康檢查失敗',
              response.code ?? 'HEALTH_CHECK_FAILED',
            );
    } catch (e) {
      return _errorHandler.handleError(e, 'checkSchedulerHealth');
    }
  }

  // ==================== 輔助方法 ====================

  /**
   * 14. 建立標準統計訊息
   * @version 2025-01-23-V1.0.0
   * @description 根據統計資料建立格式化的顯示訊息
   */
  String buildStatisticsMessage(StatisticsData stats) {
    final periodNames = {
      'today': '今日',
      'week': '本週',
      'month': '本月',
    };

    final periodName = periodNames[stats.period] ?? stats.period;

    if (stats.recordCount == 0) {
      return '''
📊 ${periodName}統計

暫無記帳數據

💡 開始記帳以獲得統計分析''';
    }

    final balance = stats.balance;
    final balancePrefix = balance >= 0 ? '+' : '';
    final balanceStatus = balance >= 0 ? '✅ 收支狀況良好' : '⚠️ 支出大於收入';

    return '''
📊 ${periodName}統計

💰 收入：${stats.totalIncome.toStringAsFixed(0)}元
💸 支出：${stats.totalExpense.toStringAsFixed(0)}元
📈 淨額：$balancePrefix${balance.toStringAsFixed(0)}元
📝 筆數：${stats.recordCount}筆

$balanceStatus''';
  }

  /**
   * 15. 驗證排程時間格式
   * @version 2025-01-23-V1.0.0
   * @description 驗證時間格式是否正確 (HH:MM)
   */
  bool validateTimeFormat(String time) {
    final timeRegex = RegExp(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$');
    return timeRegex.hasMatch(time);
  }

  /**
   * 16. 生成確認令牌
   * @version 2025-01-23-V1.0.0
   * @description 為刪除操作生成確認令牌
   */
  String generateConfirmationToken(String reminderId) {
    return 'confirm_delete_$reminderId';
  }

  /**
   * 17. 計算配額使用率
   * @version 2025-01-23-V1.0.0
   * @description 計算功能配額的使用百分比
   */
  double calculateQuotaUsage(int used, int limit) {
    if (limit <= 0) return 0.0;
    return (used / limit * 100).clamp(0.0, 100.0);
  }

  /**
   * 18. 檢查是否為付費功能
   * @version 2025-01-23-V1.0.0
   * @description 判斷指定功能是否需要付費訂閱
   */
  bool isPremiumFeature(String featureName) {
    const premiumFeatures = {
      'AUTO_PUSH',
      'UNLIMITED_REMINDERS',
      'DAILY_SUMMARY',
      'BUDGET_WARNING',
      'MONTHLY_REPORT',
      'ADVANCED_ANALYTICS'
    };
    
    return premiumFeatures.contains(featureName);
  }
}
/**
 * schedule_service.dart_排程服務_1.0.0
 * @module 排程服務
 * @description LCAS 2.0 Flutter 排程服務 - 提醒設定、排程執行
 * @update 2025-01-24: 新建排程服務v1.0.0，實作F049-F050 API端點
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';

class ScheduleService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  ScheduleService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  })  : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * F049. 排程提醒設定 - 設定個人化提醒排程
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 16:00:00
   * @description 對應F049功能，設定提醒排程
   */
  Future<ReminderResponse> setReminder({
    required ReminderRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/schedule/reminder',
        data: request.toJson(),
      );

      if (response.data['success'] == true) {
        return ReminderResponse.fromJson(response.data);
      } else {
        return ReminderResponse(
          success: false,
          message: response.data['message'] ?? '排程提醒設定失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return ReminderResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * F050. 排程提醒執行 - 執行排程提醒任務
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 16:00:00
   * @description 對應F050功能，執行提醒排程
   */
  Future<ExecuteResponse> executeSchedule({
    required ExecuteRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/schedule/execute',
        data: request.toJson(),
      );

      if (response.data['success'] == true) {
        return ExecuteResponse.fromJson(response.data);
      } else {
        return ExecuteResponse(
          success: false,
          message: response.data['message'] ?? '排程執行失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return ExecuteResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }
}

// 基本回應模型類別
class ReminderResponse {
  final bool success;
  final String message;
  final DateTime timestamp;

  const ReminderResponse({
    required this.success,
    required this.message,
    required this.timestamp,
  });

  factory ReminderResponse.fromJson(Map<String, dynamic> json) {
    return ReminderResponse(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      timestamp: DateTime.tryParse(json['timestamp'] ?? '') ?? DateTime.now(),
    );
  }
}

class ExecuteResponse {
  final bool success;
  final String message;
  final DateTime timestamp;

  const ExecuteResponse({
    required this.success,
    required this.message,
    required this.timestamp,
  });

  factory ExecuteResponse.fromJson(Map<String, dynamic> json) {
    return ExecuteResponse(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      timestamp: DateTime.tryParse(json['timestamp'] ?? '') ?? DateTime.now(),
    );
  }
}

class ReminderRequest {
  final String type;
  final String schedule;
  final Map<String, dynamic> settings;

  const ReminderRequest({
    required this.type,
    required this.schedule,
    required this.settings,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'schedule': schedule,
      'settings': settings,
    };
  }
}

class ExecuteRequest {
  final String scheduleId;
  final Map<String, dynamic> parameters;

  const ExecuteRequest({
    required this.scheduleId,
    required this.parameters,
  });

  Map<String, dynamic> toJson() {
    return {
      'scheduleId': scheduleId,
      'parameters': parameters,
    };
  }
}
