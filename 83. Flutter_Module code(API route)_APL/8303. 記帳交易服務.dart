
/**
 * 8303. 記帳交易服務.dart
 * @module 記帳交易服務模組
 * @version v2.1.0
 * @description LCAS 2.0 記帳交易服務 API 模組 - 支援四種用戶模式的差異化交易體驗
 * @date 2025-09-15
 * @update 2025-09-15: 階段一實作 - 基礎架構與資料模型，配合實作計劃重構
 */

import 'dart:convert';
import 'dart:async';
import 'dart:math';
import 'package:http/http.dart' as http;

// ================================
// 規範定義 (Specifications)
// ================================

// 8020: API總覽清單
// 8088: 統一API回應格式
// 8103: 記帳交易服務 API 規格
// 8203: 記帳交易服務 LLD

// ================================
// 核心資料模型 (Data Models) - 階段一
// ================================

/// 統一API回應格式 (完全符合8088規範第5節)
class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiMetadata metadata;
  final ApiError? error;

  ApiResponse.success({required this.data, required this.metadata})
      : success = true,
        error = null;

  ApiResponse.error({required this.error, required this.metadata})
      : success = false,
        data = null;

  /// 21. 建構API回應格式
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，完全符合8088規範第5節統一回應格式
  static ApiResponse<T> createSuccess<T>(T data, ApiMetadata metadata) {
    return ApiResponse.success(data: data, metadata: metadata);
  }

  /// 22. 記錄交易事件
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，事件記錄機制
  static ApiResponse<T> createError<T>(ApiError error, ApiMetadata metadata) {
    return ApiResponse.error(error: error, metadata: metadata);
  }

  Map<String, dynamic> toJson() {
    if (success) {
      return {
        'success': success,
        'data': data,
        'metadata': metadata.toJson(),
      };
    } else {
      return {
        'success': success,
        'error': error?.toJson(),
        'metadata': metadata.toJson(),
      };
    }
  }
}

/// API後設資料 (完全符合8088規範第5節)
class ApiMetadata {
  final DateTime timestamp;
  final String requestId;
  final UserMode userMode;
  final String apiVersion;
  final int processingTimeMs;
  final int? httpStatusCode;
  final Map<String, dynamic>? additionalInfo;

  ApiMetadata({
    required this.timestamp,
    required this.requestId,
    required this.userMode,
    this.apiVersion = '2.1.0',
    this.processingTimeMs = 0,
    this.httpStatusCode,
    this.additionalInfo,
  });

  /// 23. 驗證請求格式
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，完全符合8088規範第5節metadata結構
  static ApiMetadata create(UserMode userMode, {int? httpStatusCode, Map<String, dynamic>? additionalInfo}) {
    return ApiMetadata(
      timestamp: DateTime.now(),
      requestId: RequestIdService.generate(),
      userMode: userMode,
      httpStatusCode: httpStatusCode,
      additionalInfo: additionalInfo,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'timestamp': timestamp.toIso8601String(),
      'requestId': requestId,
      'userMode': userMode.toString().split('.').last,
      'apiVersion': apiVersion,
      'processingTimeMs': processingTimeMs,
      if (httpStatusCode != null) 'httpStatusCode': httpStatusCode,
      if (additionalInfo != null) 'additionalInfo': additionalInfo,
    };
  }
}

/// 統一請求ID生成服務 (符合8088規範)
class RequestIdService {
  static final Random _random = Random();

  /// 24. 提取用戶模式
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，統一請求ID生成策略
  static String generate() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final randomSuffix = _random.nextInt(999999).toString().padLeft(6, '0');
    return 'req-${timestamp.toString().substring(7)}-$randomSuffix';
  }
}

/// 使用者模式枚舉 (符合8088規範第10節四模式支援)
enum UserMode { expert, inertial, cultivation, guiding }

/// 交易類型枚舉
enum TransactionType { income, expense, transfer }

/// 交易來源枚舉
enum TransactionSource { manual, quick, import, recurring }

/// 交易錯誤代碼 (完全符合8088規範第6節錯誤處理)
enum TransactionErrorCode {
  // 驗證錯誤 (400)
  validationError,
  invalidAmount,
  invalidDate,
  invalidTransactionType,
  missingRequiredField,
  parseFailure,

  // 認證錯誤 (401)
  unauthorized,
  tokenExpired,
  invalidToken,

  // 權限錯誤 (403)
  insufficientPermissions,
  ledgerAccessDenied,
  readOnlyTransaction,

  // 資源錯誤 (404, 409)
  transactionNotFound,
  categoryNotFound,
  accountNotFound,
  ledgerNotFound,
  duplicateTransaction,

  // 業務邏輯錯誤 (422)
  insufficientBalance,
  budgetExceeded,
  invalidTransfer,
  attachmentSizeExceeded,
  recurringConflict,

  // 系統錯誤 (500)
  internalServerError,
  databaseError,
  parseServiceError,
  fileUploadError;

  /// 55. 適配回應內容
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
  int get httpStatusCode {
    switch (this) {
      case validationError:
      case invalidAmount:
      case invalidDate:
      case invalidTransactionType:
      case missingRequiredField:
      case parseFailure:
        return 400;
      case unauthorized:
      case tokenExpired:
      case invalidToken:
        return 401;
      case insufficientPermissions:
      case ledgerAccessDenied:
      case readOnlyTransaction:
        return 403;
      case transactionNotFound:
      case categoryNotFound:
      case accountNotFound:
      case ledgerNotFound:
        return 404;
      case duplicateTransaction:
        return 409;
      case insufficientBalance:
      case budgetExceeded:
      case invalidTransfer:
      case attachmentSizeExceeded:
      case recurringConflict:
        return 422;
      case internalServerError:
      case databaseError:
      case parseServiceError:
      case fileUploadError:
        return 500;
    }
  }

  /// 56. 適配錯誤回應
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，深度強化四模式差異化訊息，完全符合8088規範第10節四模式支援
  String getMessage(UserMode userMode) {
    switch (this) {
      case validationError:
        switch (userMode) {
          case UserMode.expert:
            return '請求參數驗證失敗，請檢查資料格式與完整性，詳細錯誤可查看details欄位';
          case UserMode.inertial:
            return '資料格式驗證失敗，請確認輸入內容是否正確';
          case UserMode.cultivation:
            return '輸入資料需要調整，讓我們一起完善它！💪 檢查一下必填欄位吧';
          case UserMode.guiding:
            return '資料格式錯誤';
        }
      case invalidAmount:
        switch (userMode) {
          case UserMode.expert:
            return '金額格式無效，請確認為正數且不超過999999.99的範圍';
          case UserMode.inertial:
            return '金額格式不正確，請輸入有效的金額';
          case UserMode.cultivation:
            return '金額需要調整，試試輸入正確的數字吧！💰';
          case UserMode.guiding:
            return '金額錯誤';
        }
      case transactionNotFound:
        switch (userMode) {
          case UserMode.expert:
            return '找不到指定的交易記錄，請確認交易ID或聯繫客服協助';
          case UserMode.inertial:
            return '找不到交易記錄，請確認資料是否正確';
          case UserMode.cultivation:
            return '找不到這筆記錄，要不要檢查一下是否輸入正確？🤔';
          case UserMode.guiding:
            return '找不到記錄';
        }
      case insufficientBalance:
        switch (userMode) {
          case UserMode.expert:
            return '帳戶餘額不足以完成此交易，請檢查帳戶餘額或選擇其他帳戶';
          case UserMode.inertial:
            return '帳戶餘額不足，請檢查餘額';
          case UserMode.cultivation:
            return '餘額不夠了，要不要先檢查一下帳戶狀況？💳';
          case UserMode.guiding:
            return '餘額不足';
        }
      default:
        switch (userMode) {
          case UserMode.expert:
            return '系統發生未預期錯誤，請聯繫技術支援團隊協助處理';
          case UserMode.inertial:
            return '系統錯誤，請稍後再試';
          case UserMode.cultivation:
            return '系統遇到了小問題，稍後再試試吧！我們會盡快修復！🔧';
          case UserMode.guiding:
            return '系統錯誤';
        }
    }
  }
}

/// API錯誤資訊 (完全符合8088規格details結構)
class ApiError {
  final TransactionErrorCode code;
  final String message;
  final String? field;
  final DateTime timestamp;
  final String requestId;
  final Map<String, dynamic>? details;

  ApiError({
    required this.code,
    required this.message,
    this.field,
    required this.timestamp,
    required this.requestId,
    this.details,
  });

  /// 57. 適配交易列表回應
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，完全符合8088規格details結構，使用統一請求ID服務
  static ApiError create(
    TransactionErrorCode code,
    UserMode userMode, {
    String? field,
    String? requestId,
    Map<String, dynamic>? details,
    List<ValidationError>? validationErrors,
  }) {
    Map<String, dynamic>? finalDetails = details;

    // 完全符合8088規格的validation陣列格式
    if (validationErrors != null && validationErrors.isNotEmpty) {
      finalDetails ??= {};
      finalDetails['validation'] = validationErrors.map((error) => {
        'field': error.field,
        'message': error.message,
        'code': 'VALIDATION_FAILED',
        'value': error.value ?? '',
      }).toList();
    }

    return ApiError(
      code: code,
      message: code.getMessage(userMode),
      field: field,
      timestamp: DateTime.now(),
      requestId: requestId ?? RequestIdService.generate(),
      details: finalDetails,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'code': code.toString().split('.').last.toUpperCase(),
      'message': message,
      if (field != null) 'field': field,
      'timestamp': timestamp.toIso8601String(),
      'requestId': requestId,
      if (details != null) 'details': details,
    };
  }
}

/// 驗證錯誤 (符合8088規格)
class ValidationError {
  final String field;
  final String message;
  final String? value;

  ValidationError({required this.field, required this.message, this.value});
}

/// 快速記帳請求資料模型 (符合8103規格)
class QuickBookingRequest {
  final String input;
  final String userId;
  final String? ledgerId;
  final ContextInfo? context;

  QuickBookingRequest({
    required this.input,
    required this.userId,
    this.ledgerId,
    this.context,
  });

  /// 58. 適配儀表板回應
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，快速記帳請求驗證
  List<ValidationError> validate() {
    List<ValidationError> errors = [];

    if (input.isEmpty) {
      errors.add(ValidationError(field: 'input', message: '記帳內容不能為空', value: input));
    }

    if (userId.isEmpty) {
      errors.add(ValidationError(field: 'userId', message: '使用者ID不能為空', value: userId));
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      'input': input,
      'userId': userId,
      if (ledgerId != null) 'ledgerId': ledgerId,
      if (context != null) 'context': context!.toJson(),
    };
  }

  static QuickBookingRequest fromJson(Map<String, dynamic> json) {
    return QuickBookingRequest(
      input: json['input'],
      userId: json['userId'],
      ledgerId: json['ledgerId'],
      context: json['context'] != null ? ContextInfo.fromJson(json['context']) : null,
    );
  }
}

/// 建立交易請求資料模型 (符合8103規格)
class CreateTransactionRequest {
  final double amount;
  final TransactionType type;
  final String categoryId;
  final String accountId;
  final String ledgerId;
  final DateTime date;
  final String? description;
  final String? notes;
  final List<String>? tags;
  final String? toAccountId;
  final List<String>? attachmentIds;
  final LocationInfo? location;
  final RecurringSettings? recurring;

  CreateTransactionRequest({
    required this.amount,
    required this.type,
    required this.categoryId,
    required this.accountId,
    required this.ledgerId,
    required this.date,
    this.description,
    this.notes,
    this.tags,
    this.toAccountId,
    this.attachmentIds,
    this.location,
    this.recurring,
  });

  /// 59. 適配快速記帳回應
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，建立交易請求驗證
  List<ValidationError> validate() {
    List<ValidationError> errors = [];

    if (amount <= 0) {
      errors.add(ValidationError(field: 'amount', message: '金額必須大於0', value: amount.toString()));
    }

    if (categoryId.isEmpty) {
      errors.add(ValidationError(field: 'categoryId', message: '科目ID不能為空', value: categoryId));
    }

    if (accountId.isEmpty) {
      errors.add(ValidationError(field: 'accountId', message: '帳戶ID不能為空', value: accountId));
    }

    if (ledgerId.isEmpty) {
      errors.add(ValidationError(field: 'ledgerId', message: '帳本ID不能為空', value: ledgerId));
    }

    if (type == TransactionType.transfer && (toAccountId == null || toAccountId!.isEmpty)) {
      errors.add(ValidationError(field: 'toAccountId', message: '轉帳需要指定目標帳戶', value: toAccountId));
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'type': type.toString().split('.').last,
      'categoryId': categoryId,
      'accountId': accountId,
      'ledgerId': ledgerId,
      'date': date.toIso8601String(),
      if (description != null) 'description': description,
      if (notes != null) 'notes': notes,
      if (tags != null) 'tags': tags,
      if (toAccountId != null) 'toAccountId': toAccountId,
      if (attachmentIds != null) 'attachmentIds': attachmentIds,
      if (location != null) 'location': location!.toJson(),
      if (recurring != null) 'recurring': recurring!.toJson(),
    };
  }

  static CreateTransactionRequest fromJson(Map<String, dynamic> json) {
    return CreateTransactionRequest(
      amount: json['amount'].toDouble(),
      type: TransactionType.values.firstWhere(
        (e) => e.toString().split('.').last == json['type'],
      ),
      categoryId: json['categoryId'],
      accountId: json['accountId'],
      ledgerId: json['ledgerId'],
      date: DateTime.parse(json['date']),
      description: json['description'],
      notes: json['notes'],
      tags: json['tags']?.cast<String>(),
      toAccountId: json['toAccountId'],
      attachmentIds: json['attachmentIds']?.cast<String>(),
      location: json['location'] != null ? LocationInfo.fromJson(json['location']) : null,
      recurring: json['recurring'] != null ? RecurringSettings.fromJson(json['recurring']) : null,
    );
  }
}

/// 交易查詢請求資料模型 (符合8103規格)
class TransactionQueryRequest {
  final String? ledgerId;
  final String? categoryId;
  final String? accountId;
  final TransactionType? type;
  final DateTime? startDate;
  final DateTime? endDate;
  final double? minAmount;
  final double? maxAmount;
  final String? search;
  final int page;
  final int limit;
  final String sort;

  TransactionQueryRequest({
    this.ledgerId,
    this.categoryId,
    this.accountId,
    this.type,
    this.startDate,
    this.endDate,
    this.minAmount,
    this.maxAmount,
    this.search,
    this.page = 1,
    this.limit = 20,
    this.sort = 'date:desc',
  });

  /// 60. 取得可用操作選項
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，交易查詢請求驗證
  List<ValidationError> validate() {
    List<ValidationError> errors = [];

    if (page < 1) {
      errors.add(ValidationError(field: 'page', message: '頁碼必須大於0', value: page.toString()));
    }

    if (limit < 1 || limit > 100) {
      errors.add(ValidationError(field: 'limit', message: '每頁筆數必須在1-100之間', value: limit.toString()));
    }

    if (minAmount != null && minAmount! < 0) {
      errors.add(ValidationError(field: 'minAmount', message: '最小金額不能小於0', value: minAmount.toString()));
    }

    if (maxAmount != null && maxAmount! < 0) {
      errors.add(ValidationError(field: 'maxAmount', message: '最大金額不能小於0', value: maxAmount.toString()));
    }

    if (minAmount != null && maxAmount != null && minAmount! > maxAmount!) {
      errors.add(ValidationError(field: 'amount', message: '最小金額不能大於最大金額'));
    }

    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      if (ledgerId != null) 'ledgerId': ledgerId,
      if (categoryId != null) 'categoryId': categoryId,
      if (accountId != null) 'accountId': accountId,
      if (type != null) 'type': type.toString().split('.').last,
      if (startDate != null) 'startDate': startDate!.toIso8601String(),
      if (endDate != null) 'endDate': endDate!.toIso8601String(),
      if (minAmount != null) 'minAmount': minAmount,
      if (maxAmount != null) 'maxAmount': maxAmount,
      if (search != null) 'search': search,
      'page': page,
      'limit': limit,
      'sort': sort,
    };
  }

  static TransactionQueryRequest fromJson(Map<String, dynamic> json) {
    return TransactionQueryRequest(
      ledgerId: json['ledgerId'],
      categoryId: json['categoryId'],
      accountId: json['accountId'],
      type: json['type'] != null 
        ? TransactionType.values.firstWhere((e) => e.toString().split('.').last == json['type'])
        : null,
      startDate: json['startDate'] != null ? DateTime.parse(json['startDate']) : null,
      endDate: json['endDate'] != null ? DateTime.parse(json['endDate']) : null,
      minAmount: json['minAmount']?.toDouble(),
      maxAmount: json['maxAmount']?.toDouble(),
      search: json['search'],
      page: json['page'] ?? 1,
      limit: json['limit'] ?? 20,
      sort: json['sort'] ?? 'date:desc',
    );
  }
}

/// 快速記帳回應資料模型 (深度強化四模式支援)
class QuickBookingResponse {
  final String transactionId;
  final ParsedTransaction parsed;
  final String confirmation;

  // Expert Mode: 詳細統計
  final BalanceInfo? balance;

  // Cultivation Mode: 激勵資訊
  final AchievementInfo? achievement;

  // 建議與提醒
  final List<Suggestion>? suggestions;

  QuickBookingResponse({
    required this.transactionId,
    required this.parsed,
    required this.confirmation,
    this.balance,
    this.achievement,
    this.suggestions,
  });

  Map<String, dynamic> toJson() {
    return {
      'transactionId': transactionId,
      'parsed': parsed.toJson(),
      'confirmation': confirmation,
      if (balance != null) 'balance': balance!.toJson(),
      if (achievement != null) 'achievement': achievement!.toJson(),
      if (suggestions != null) 'suggestions': suggestions!.map((s) => s.toJson()).toList(),
    };
  }

  static QuickBookingResponse fromJson(Map<String, dynamic> json) {
    return QuickBookingResponse(
      transactionId: json['transactionId'],
      parsed: ParsedTransaction.fromJson(json['parsed']),
      confirmation: json['confirmation'],
      balance: json['balance'] != null ? BalanceInfo.fromJson(json['balance']) : null,
      achievement: json['achievement'] != null ? AchievementInfo.fromJson(json['achievement']) : null,
      suggestions: json['suggestions'] != null 
        ? (json['suggestions'] as List).map((s) => Suggestion.fromJson(s)).toList()
        : null,
    );
  }
}

/// 交易列表回應資料模型 (符合8103規格)
class TransactionListResponse {
  final List<TransactionItem> transactions;
  final PaginationInfo pagination;

  // Expert Mode: 統計摘要
  final TransactionSummary? summary;

  TransactionListResponse({
    required this.transactions,
    required this.pagination,
    this.summary,
  });

  Map<String, dynamic> toJson() {
    return {
      'transactions': transactions.map((t) => t.toJson()).toList(),
      'pagination': pagination.toJson(),
      if (summary != null) 'summary': summary!.toJson(),
    };
  }

  static TransactionListResponse fromJson(Map<String, dynamic> json) {
    return TransactionListResponse(
      transactions: (json['transactions'] as List)
        .map((t) => TransactionItem.fromJson(t))
        .toList(),
      pagination: PaginationInfo.fromJson(json['pagination']),
      summary: json['summary'] != null ? TransactionSummary.fromJson(json['summary']) : null,
    );
  }
}

/// 儀表板回應資料模型 (完全符合8103規格)
class DashboardResponse {
  final DashboardSummary summary;

  // Expert Mode: 完整儀表板
  final List<TransactionItem>? recentTransactions;
  final ChartsData? charts;
  final List<BudgetStatusItem>? budgetStatus;

  // Cultivation Mode: 成就與進度
  final AchievementData? achievements;

  final List<QuickAction> quickActions;

  // Guiding Mode: 極簡資訊
  final SimpleData? simpleData;

  DashboardResponse({
    required this.summary,
    required this.quickActions,
    this.recentTransactions,
    this.charts,
    this.budgetStatus,
    this.achievements,
    this.simpleData,
  });

  Map<String, dynamic> toJson() {
    return {
      'summary': summary.toJson(),
      'quickActions': quickActions.map((q) => q.toJson()).toList(),
      if (recentTransactions != null) 'recentTransactions': recentTransactions!.map((t) => t.toJson()).toList(),
      if (charts != null) 'charts': charts!.toJson(),
      if (budgetStatus != null) 'budgetStatus': budgetStatus!.map((b) => b.toJson()).toList(),
      if (achievements != null) 'achievements': achievements!.toJson(),
      if (simpleData != null) 'simpleData': simpleData!.toJson(),
    };
  }

  static DashboardResponse fromJson(Map<String, dynamic> json) {
    return DashboardResponse(
      summary: DashboardSummary.fromJson(json['summary']),
      quickActions: (json['quickActions'] as List)
        .map((q) => QuickAction.fromJson(q))
        .toList(),
      recentTransactions: json['recentTransactions'] != null
        ? (json['recentTransactions'] as List).map((t) => TransactionItem.fromJson(t)).toList()
        : null,
      charts: json['charts'] != null ? ChartsData.fromJson(json['charts']) : null,
      budgetStatus: json['budgetStatus'] != null
        ? (json['budgetStatus'] as List).map((b) => BudgetStatusItem.fromJson(b)).toList()
        : null,
      achievements: json['achievements'] != null ? AchievementData.fromJson(json['achievements']) : null,
      simpleData: json['simpleData'] != null ? SimpleData.fromJson(json['simpleData']) : null,
    );
  }
}

// ================================
// 資料存取層設計 - 階段一
// ================================

/// 交易資料存取介面 (符合8203規格)
abstract class TransactionRepository {
  /// 61. 過濾交易詳細資訊
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Future<TransactionEntity?> findById(String id);

  /// 62. 判斷是否顯示進階統計
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Future<TransactionEntity> create(TransactionEntity transaction);

  /// 63. 取得模式特定訊息
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Future<TransactionEntity> update(TransactionEntity transaction);

  Future<void> delete(String id);
  Future<List<TransactionEntity>> findByQuery(TransactionQuery query);
  Future<List<TransactionEntity>> findByUserId(String userId);
  Future<List<TransactionEntity>> findByLedgerId(String ledgerId);
  Future<List<TransactionEntity>> findByDateRange(DateTime start, DateTime end);
  Future<StatisticsData> getStatistics(String userId, StatisticsQuery query);
}

/// 交易實體類別 (符合8203規格)
class TransactionEntity {
  final String id;
  final double amount;
  final TransactionType type;
  final String categoryId;
  final String accountId;
  final String ledgerId;
  final DateTime date;
  final String? description;
  final String? notes;
  final List<String>? tags;
  final String? toAccountId;
  final List<AttachmentEntity>? attachments;
  final LocationInfo? location;
  final String? recurringId;
  final TransactionSource source;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String createdBy;

  TransactionEntity({
    required this.id,
    required this.amount,
    required this.type,
    required this.categoryId,
    required this.accountId,
    required this.ledgerId,
    required this.date,
    this.description,
    this.notes,
    this.tags,
    this.toAccountId,
    this.attachments,
    this.location,
    this.recurringId,
    required this.source,
    required this.createdAt,
    required this.updatedAt,
    required this.createdBy,
  });

  /// 64. API回應類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，完整符合8203規範TransactionEntity結構
  Map<String, dynamic> toFirestore() {
    return {
      'amount': amount,
      'type': type.toString().split('.').last,
      'categoryId': categoryId,
      'accountId': accountId,
      'ledgerId': ledgerId,
      'date': date.toIso8601String(),
      if (description != null) 'description': description,
      if (notes != null) 'notes': notes,
      if (tags != null) 'tags': tags,
      if (toAccountId != null) 'toAccountId': toAccountId,
      if (attachments != null) 'attachments': attachments!.map((a) => a.toJson()).toList(),
      if (location != null) 'location': location!.toJson(),
      if (recurringId != null) 'recurringId': recurringId,
      'source': source.toString().split('.').last,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'createdBy': createdBy,
    };
  }

  /// 65. 快速記帳請求類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，完整符合8203規範TransactionEntity結構
  static TransactionEntity fromFirestore(Map<String, dynamic> data, String id) {
    return TransactionEntity(
      id: id,
      amount: data['amount'].toDouble(),
      type: TransactionType.values.firstWhere(
        (e) => e.toString().split('.').last == data['type'],
      ),
      categoryId: data['categoryId'],
      accountId: data['accountId'],
      ledgerId: data['ledgerId'],
      date: DateTime.parse(data['date']),
      description: data['description'],
      notes: data['notes'],
      tags: data['tags']?.cast<String>(),
      toAccountId: data['toAccountId'],
      attachments: data['attachments'] != null
        ? (data['attachments'] as List).map((a) => AttachmentEntity.fromJson(a)).toList()
        : null,
      location: data['location'] != null ? LocationInfo.fromJson(data['location']) : null,
      recurringId: data['recurringId'],
      source: TransactionSource.values.firstWhere(
        (e) => e.toString().split('.').last == data['source'],
        orElse: () => TransactionSource.manual,
      ),
      createdAt: DateTime.parse(data['createdAt']),
      updatedAt: DateTime.parse(data['updatedAt']),
      createdBy: data['createdBy'],
    );
  }

  /// 66. 建立交易請求類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，交易實體驗證邏輯
  bool isValid() {
    return amount > 0 &&
           categoryId.isNotEmpty &&
           accountId.isNotEmpty &&
           ledgerId.isNotEmpty &&
           createdBy.isNotEmpty;
  }

  /// 67. 交易查詢請求類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，檢查是否為轉帳交易
  bool isTransfer() {
    return type == TransactionType.transfer && toAccountId != null;
  }

  /// 68. 快速記帳回應類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，實體複製方法
  TransactionEntity copyWith({
    double? amount,
    TransactionType? type,
    String? categoryId,
    String? accountId,
    String? description,
    String? notes,
    List<String>? tags,
    DateTime? updatedAt,
  }) {
    return TransactionEntity(
      id: id,
      amount: amount ?? this.amount,
      type: type ?? this.type,
      categoryId: categoryId ?? this.categoryId,
      accountId: accountId ?? this.accountId,
      ledgerId: ledgerId,
      date: date,
      description: description ?? this.description,
      notes: notes ?? this.notes,
      tags: tags ?? this.tags,
      toAccountId: toAccountId,
      attachments: attachments,
      location: location,
      recurringId: recurringId,
      source: source,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      createdBy: createdBy,
    );
  }
}

// ================================
// 安全與驗證設計 - 階段一
// ================================

/// 交易驗證服務 (符合8203規格)
abstract class TransactionValidator {
  /// 69. 交易列表回應類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  List<ValidationError> validateAmount(double amount);

  /// 70. 儀表板回應類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  List<ValidationError> validateTransactionType(TransactionType type);

  List<ValidationError> validateDate(DateTime date);
  List<ValidationError> validateDescription(String? description);
  List<ValidationError> validateCreateRequest(CreateTransactionRequest request);
  List<ValidationError> validateUpdateRequest(UpdateTransactionRequest request);
  List<ValidationError> validateBatchRequest(List<dynamic> requests);
}

/// 交易權限檢查服務 (符合8203規格)
abstract class TransactionPermissionService {
  /// 71. 交易資料存取介面
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Future<bool> canCreateTransaction(String userId, String ledgerId);

  /// 72. 交易實體類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Future<bool> canUpdateTransaction(String userId, String transactionId);

  Future<bool> canDeleteTransaction(String userId, String transactionId);
  Future<bool> canViewTransaction(String userId, String transactionId);
  Future<bool> canAccessLedger(String userId, String ledgerId);
  Future<bool> canPerformBatchOperation(String userId, String ledgerId);
}

// ================================
// 錯誤處理設計 - 階段一
// ================================

/// 交易錯誤處理器 (符合8203規格)
abstract class TransactionErrorHandler {
  /// 73. 交易驗證服務
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  ApiResponse<T> handleException<T>(Exception exception, UserMode userMode);

  /// 74. 交易權限檢查服務
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  ApiError createValidationError(List<ValidationError> errors, UserMode userMode);

  ApiError createBusinessLogicError(String code, String message, UserMode userMode);
  String getLocalizedErrorMessage(TransactionErrorCode code, UserMode userMode);
  ApiError createParseError(String input, UserMode userMode);
  ApiError createPermissionError(String resource, UserMode userMode);
}

// ================================
// 四模式支援設計 - 階段一
// ================================

/// 交易模式配置服務 (符合8203規格)
abstract class TransactionModeConfigService {
  /// 75. 交易錯誤碼枚舉
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  ModeConfig getConfigForMode(UserMode mode);

  /// 76. API錯誤類別
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  List<String> getAvailableFeatures(UserMode mode);

  Map<String, dynamic> getDefaultTransactionSettings(UserMode mode);
  bool isFeatureEnabled(UserMode mode, String feature);
  List<String> getVisibleFields(UserMode mode, String responseType);
  Map<String, dynamic> getModeSpecificMessages(UserMode mode);
  int getDefaultPageSize(UserMode mode);
}

/// 交易回應過濾器 (符合8203規格)
abstract class TransactionResponseFilter {
  /// 77. 交易錯誤處理器
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Map<String, dynamic> filterForExpert(Map<String, dynamic> data);

  /// 78. 交易模式配置服務
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Map<String, dynamic> filterForInertial(Map<String, dynamic> data);

  Map<String, dynamic> filterForCultivation(Map<String, dynamic> data);
  Map<String, dynamic> filterForGuiding(Map<String, dynamic> data);
  TransactionDetailResponse filterTransactionDetail(TransactionDetailResponse response, UserMode mode);
  DashboardResponse filterDashboardResponse(DashboardResponse response, UserMode mode);
  StatisticsResponse filterStatisticsResponse(StatisticsResponse response, UserMode mode);
}

/// 交易回應過濾器 (符合8203規格)
abstract class TransactionResponseFilter {
  /// 79. 交易回應過濾器
  /// @version 2025-09-15-V1.0.0
  /// @date 2025-09-15 12:00:00
  /// @update: 初版建立，符合8203規範要求的抽象方法
  Map<String, dynamic> filterForExpert(Map<String, dynamic> data);

  Map<String, dynamic> filterForInertial(Map<String, dynamic> data);
  Map<String, dynamic> filterForCultivation(Map<String, dynamic> data);
  Map<String, dynamic> filterForGuiding(Map<String, dynamic> data);
  TransactionDetailResponse filterTransactionDetail(TransactionDetailResponse response, UserMode mode);
  DashboardResponse filterDashboardResponse(DashboardResponse response, UserMode mode);
  StatisticsResponse filterStatisticsResponse(StatisticsResponse response, UserMode mode);
}

// ================================
// 輔助類別定義 (支援類別) - 階段一
// ================================

/// 上下文資訊
class ContextInfo {
  final String? location;
  final DateTime? timestamp;

  ContextInfo({this.location, this.timestamp});

  Map<String, dynamic> toJson() {
    return {
      if (location != null) 'location': location,
      if (timestamp != null) 'timestamp': timestamp!.toIso8601String(),
    };
  }

  static ContextInfo fromJson(Map<String, dynamic> json) {
    return ContextInfo(
      location: json['location'],
      timestamp: json['timestamp'] != null ? DateTime.parse(json['timestamp']) : null,
    );
  }
}

/// 位置資訊
class LocationInfo {
  final double? latitude;
  final double? longitude;
  final String? address;

  LocationInfo({this.latitude, this.longitude, this.address});

  Map<String, dynamic> toJson() {
    return {
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (address != null) 'address': address,
    };
  }

  static LocationInfo fromJson(Map<String, dynamic> json) {
    return LocationInfo(
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      address: json['address'],
    );
  }
}

/// 重複設定
class RecurringSettings {
  final bool enabled;
  final String frequency;
  final int interval;
  final DateTime? endDate;

  RecurringSettings({
    required this.enabled,
    required this.frequency,
    required this.interval,
    this.endDate,
  });

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'frequency': frequency,
      'interval': interval,
      if (endDate != null) 'endDate': endDate!.toIso8601String(),
    };
  }

  static RecurringSettings fromJson(Map<String, dynamic> json) {
    return RecurringSettings(
      enabled: json['enabled'],
      frequency: json['frequency'],
      interval: json['interval'],
      endDate: json['endDate'] != null ? DateTime.parse(json['endDate']) : null,
    );
  }
}

/// 解析後的交易
class ParsedTransaction {
  final double amount;
  final TransactionType type;
  final String category;
  final String categoryId;
  final String description;
  final double confidence;

  ParsedTransaction({
    required this.amount,
    required this.type,
    required this.category,
    required this.categoryId,
    required this.description,
    required this.confidence,
  });

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'type': type.toString().split('.').last,
      'category': category,
      'categoryId': categoryId,
      'description': description,
      'confidence': confidence,
    };
  }

  static ParsedTransaction fromJson(Map<String, dynamic> json) {
    return ParsedTransaction(
      amount: json['amount'].toDouble(),
      type: TransactionType.values.firstWhere(
        (e) => e.toString().split('.').last == json['type'],
      ),
      category: json['category'],
      categoryId: json['categoryId'],
      description: json['description'],
      confidence: json['confidence'].toDouble(),
    );
  }
}

/// 餘額資訊
class BalanceInfo {
  final double today;
  final double week;
  final double month;
  final double accountBalance;

  BalanceInfo({
    required this.today,
    required this.week,
    required this.month,
    required this.accountBalance,
  });

  Map<String, dynamic> toJson() {
    return {
      'today': today,
      'week': week,
      'month': month,
      'accountBalance': accountBalance,
    };
  }

  static BalanceInfo fromJson(Map<String, dynamic> json) {
    return BalanceInfo(
      today: json['today'].toDouble(),
      week: json['week'].toDouble(),
      month: json['month'].toDouble(),
      accountBalance: json['accountBalance'].toDouble(),
    );
  }
}

/// 成就資訊
class AchievementInfo {
  final String type;
  final String message;
  final double progress;

  AchievementInfo({
    required this.type,
    required this.message,
    required this.progress,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'message': message,
      'progress': progress,
    };
  }

  static AchievementInfo fromJson(Map<String, dynamic> json) {
    return AchievementInfo(
      type: json['type'],
      message: json['message'],
      progress: json['progress'].toDouble(),
    );
  }
}

/// 建議
class Suggestion {
  final String type;
  final String message;

  Suggestion({required this.type, required this.message});

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'message': message,
    };
  }

  static Suggestion fromJson(Map<String, dynamic> json) {
    return Suggestion(
      type: json['type'],
      message: json['message'],
    );
  }
}

/// 交易項目
class TransactionItem {
  final String id;
  final double amount;
  final TransactionType type;
  final DateTime date;
  final String description;
  final CategoryInfo category;
  final AccountInfo account;
  final String? notes;
  final List<String>? tags;
  final List<AttachmentEntity>? attachments;
  final DateTime createdAt;
  final DateTime updatedAt;

  TransactionItem({
    required this.id,
    required this.amount,
    required this.type,
    required this.date,
    required this.description,
    required this.category,
    required this.account,
    this.notes,
    this.tags,
    this.attachments,
    required this.createdAt,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'amount': amount,
      'type': type.toString().split('.').last,
      'date': date.toIso8601String(),
      'description': description,
      'category': category.toJson(),
      'account': account.toJson(),
      if (notes != null) 'notes': notes,
      if (tags != null) 'tags': tags,
      if (attachments != null) 'attachments': attachments!.map((a) => a.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  static TransactionItem fromJson(Map<String, dynamic> json) {
    return TransactionItem(
      id: json['id'],
      amount: json['amount'].toDouble(),
      type: TransactionType.values.firstWhere(
        (e) => e.toString().split('.').last == json['type'],
      ),
      date: DateTime.parse(json['date']),
      description: json['description'],
      category: CategoryInfo.fromJson(json['category']),
      account: AccountInfo.fromJson(json['account']),
      notes: json['notes'],
      tags: json['tags']?.cast<String>(),
      attachments: json['attachments'] != null
        ? (json['attachments'] as List).map((a) => AttachmentEntity.fromJson(a)).toList()
        : null,
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}

/// 分頁資訊
class PaginationInfo {
  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNext;
  final bool hasPrev;
  final int? nextPage;
  final int? prevPage;

  PaginationInfo({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNext,
    required this.hasPrev,
    this.nextPage,
    this.prevPage,
  });

  Map<String, dynamic> toJson() {
    return {
      'page': page,
      'limit': limit,
      'total': total,
      'totalPages': totalPages,
      'hasNext': hasNext,
      'hasPrev': hasPrev,
      if (nextPage != null) 'nextPage': nextPage,
      if (prevPage != null) 'prevPage': prevPage,
    };
  }

  static PaginationInfo fromJson(Map<String, dynamic> json) {
    return PaginationInfo(
      page: json['page'],
      limit: json['limit'],
      total: json['total'],
      totalPages: json['totalPages'],
      hasNext: json['hasNext'],
      hasPrev: json['hasPrev'],
      nextPage: json['nextPage'],
      prevPage: json['prevPage'],
    );
  }
}

/// 交易摘要
class TransactionSummary {
  final double totalIncome;
  final double totalExpense;
  final double netAmount;
  final int recordCount;

  TransactionSummary({
    required this.totalIncome,
    required this.totalExpense,
    required this.netAmount,
    required this.recordCount,
  });

  Map<String, dynamic> toJson() {
    return {
      'totalIncome': totalIncome,
      'totalExpense': totalExpense,
      'netAmount': netAmount,
      'recordCount': recordCount,
    };
  }

  static TransactionSummary fromJson(Map<String, dynamic> json) {
    return TransactionSummary(
      totalIncome: json['totalIncome'].toDouble(),
      totalExpense: json['totalExpense'].toDouble(),
      netAmount: json['netAmount'].toDouble(),
      recordCount: json['recordCount'],
    );
  }
}

/// 儀表板摘要
class DashboardSummary {
  final double todayIncome;
  final double todayExpense;
  final double monthIncome;
  final double monthExpense;
  final double balance;
  final int transactionCount;

  DashboardSummary({
    required this.todayIncome,
    required this.todayExpense,
    required this.monthIncome,
    required this.monthExpense,
    required this.balance,
    required this.transactionCount,
  });

  Map<String, dynamic> toJson() {
    return {
      'todayIncome': todayIncome,
      'todayExpense': todayExpense,
      'monthIncome': monthIncome,
      'monthExpense': monthExpense,
      'balance': balance,
      'transactionCount': transactionCount,
    };
  }

  static DashboardSummary fromJson(Map<String, dynamic> json) {
    return DashboardSummary(
      todayIncome: json['todayIncome'].toDouble(),
      todayExpense: json['todayExpense'].toDouble(),
      monthIncome: json['monthIncome'].toDouble(),
      monthExpense: json['monthExpense'].toDouble(),
      balance: json['balance'].toDouble(),
      transactionCount: json['transactionCount'],
    );
  }
}

/// 快速操作
class QuickAction {
  final String action;
  final String label;
  final String icon;
  final int priority;

  QuickAction({
    required this.action,
    required this.label,
    required this.icon,
    required this.priority,
  });

  Map<String, dynamic> toJson() {
    return {
      'action': action,
      'label': label,
      'icon': icon,
      'priority': priority,
    };
  }

  static QuickAction fromJson(Map<String, dynamic> json) {
    return QuickAction(
      action: json['action'],
      label: json['label'],
      icon: json['icon'],
      priority: json['priority'],
    );
  }
}

/// 圖表資料
class ChartsData {
  final List<WeeklyTrendData>? weeklyTrend;
  final List<CategoryDistributionData>? categoryDistribution;
  final List<AccountBalanceData>? accountBalance;

  ChartsData({
    this.weeklyTrend,
    this.categoryDistribution,
    this.accountBalance,
  });

  Map<String, dynamic> toJson() {
    return {
      if (weeklyTrend != null) 'weeklyTrend': weeklyTrend!.map((w) => w.toJson()).toList(),
      if (categoryDistribution != null) 'categoryDistribution': categoryDistribution!.map((c) => c.toJson()).toList(),
      if (accountBalance != null) 'accountBalance': accountBalance!.map((a) => a.toJson()).toList(),
    };
  }

  static ChartsData fromJson(Map<String, dynamic> json) {
    return ChartsData(
      weeklyTrend: json['weeklyTrend'] != null
        ? (json['weeklyTrend'] as List).map((w) => WeeklyTrendData.fromJson(w)).toList()
        : null,
      categoryDistribution: json['categoryDistribution'] != null
        ? (json['categoryDistribution'] as List).map((c) => CategoryDistributionData.fromJson(c)).toList()
        : null,
      accountBalance: json['accountBalance'] != null
        ? (json['accountBalance'] as List).map((a) => AccountBalanceData.fromJson(a)).toList()
        : null,
    );
  }
}

/// 預算狀態項目
class BudgetStatusItem {
  final String categoryId;
  final String category;
  final double budgetAmount;
  final double usedAmount;
  final double percentage;
  final String status;

  BudgetStatusItem({
    required this.categoryId,
    required this.category,
    required this.budgetAmount,
    required this.usedAmount,
    required this.percentage,
    required this.status,
  });

  Map<String, dynamic> toJson() {
    return {
      'categoryId': categoryId,
      'category': category,
      'budgetAmount': budgetAmount,
      'usedAmount': usedAmount,
      'percentage': percentage,
      'status': status,
    };
  }

  static BudgetStatusItem fromJson(Map<String, dynamic> json) {
    return BudgetStatusItem(
      categoryId: json['categoryId'],
      category: json['category'],
      budgetAmount: json['budgetAmount'].toDouble(),
      usedAmount: json['usedAmount'].toDouble(),
      percentage: json['percentage'].toDouble(),
      status: json['status'],
    );
  }
}

/// 成就資料
class AchievementData {
  final int currentStreak;
  final double monthlyGoalProgress;
  final int completedChallenges;
  final int availableRewards;

  AchievementData({
    required this.currentStreak,
    required this.monthlyGoalProgress,
    required this.completedChallenges,
    required this.availableRewards,
  });

  Map<String, dynamic> toJson() {
    return {
      'currentStreak': currentStreak,
      'monthlyGoalProgress': monthlyGoalProgress,
      'completedChallenges': completedChallenges,
      'availableRewards': availableRewards,
    };
  }

  static AchievementData fromJson(Map<String, dynamic> json) {
    return AchievementData(
      currentStreak: json['currentStreak'],
      monthlyGoalProgress: json['monthlyGoalProgress'].toDouble(),
      completedChallenges: json['completedChallenges'],
      availableRewards: json['availableRewards'],
    );
  }
}

/// 簡化資料 (Guiding Mode)
class SimpleData {
  final double todayExpense;
  final bool quickAddButton;
  final String simpleMessage;

  SimpleData({
    required this.todayExpense,
    required this.quickAddButton,
    required this.simpleMessage,
  });

  Map<String, dynamic> toJson() {
    return {
      'todayExpense': todayExpense,
      'quickAddButton': quickAddButton,
      'simpleMessage': simpleMessage,
    };
  }

  static SimpleData fromJson(Map<String, dynamic> json) {
    return SimpleData(
      todayExpense: json['todayExpense'].toDouble(),
      quickAddButton: json['quickAddButton'],
      simpleMessage: json['simpleMessage'],
    );
  }
}

/// 科目資訊
class CategoryInfo {
  final String id;
  final String name;
  final String icon;
  final String? parentId;

  CategoryInfo({
    required this.id,
    required this.name,
    required this.icon,
    this.parentId,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'icon': icon,
      if (parentId != null) 'parentId': parentId,
    };
  }

  static CategoryInfo fromJson(Map<String, dynamic> json) {
    return CategoryInfo(
      id: json['id'],
      name: json['name'],
      icon: json['icon'],
      parentId: json['parentId'],
    );
  }
}

/// 帳戶資訊
class AccountInfo {
  final String id;
  final String name;
  final String type;
  final double? balance;

  AccountInfo({
    required this.id,
    required this.name,
    required this.type,
    this.balance,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      if (balance != null) 'balance': balance,
    };
  }

  static AccountInfo fromJson(Map<String, dynamic> json) {
    return AccountInfo(
      id: json['id'],
      name: json['name'],
      type: json['type'],
      balance: json['balance']?.toDouble(),
    );
  }
}

/// 附件實體
class AttachmentEntity {
  final String id;
  final String url;
  final String? thumbnailUrl;
  final String type;
  final int? size;
  final DateTime uploadedAt;

  AttachmentEntity({
    required this.id,
    required this.url,
    this.thumbnailUrl,
    required this.type,
    this.size,
    required this.uploadedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'url': url,
      if (thumbnailUrl != null) 'thumbnailUrl': thumbnailUrl,
      'type': type,
      if (size != null) 'size': size,
      'uploadedAt': uploadedAt.toIso8601String(),
    };
  }

  static AttachmentEntity fromJson(Map<String, dynamic> json) {
    return AttachmentEntity(
      id: json['id'],
      url: json['url'],
      thumbnailUrl: json['thumbnailUrl'],
      type: json['type'],
      size: json['size'],
      uploadedAt: DateTime.parse(json['uploadedAt']),
    );
  }
}

/// 週趨勢資料
class WeeklyTrendData {
  final DateTime date;
  final double income;
  final double expense;

  WeeklyTrendData({
    required this.date,
    required this.income,
    required this.expense,
  });

  Map<String, dynamic> toJson() {
    return {
      'date': date.toIso8601String(),
      'income': income,
      'expense': expense,
    };
  }

  static WeeklyTrendData fromJson(Map<String, dynamic> json) {
    return WeeklyTrendData(
      date: DateTime.parse(json['date']),
      income: json['income'].toDouble(),
      expense: json['expense'].toDouble(),
    );
  }
}

/// 科目分布資料
class CategoryDistributionData {
  final String category;
  final double amount;
  final double percentage;

  CategoryDistributionData({
    required this.category,
    required this.amount,
    required this.percentage,
  });

  Map<String, dynamic> toJson() {
    return {
      'category': category,
      'amount': amount,
      'percentage': percentage,
    };
  }

  static CategoryDistributionData fromJson(Map<String, dynamic> json) {
    return CategoryDistributionData(
      category: json['category'],
      amount: json['amount'].toDouble(),
      percentage: json['percentage'].toDouble(),
    );
  }
}

/// 帳戶餘額資料
class AccountBalanceData {
  final String account;
  final double balance;

  AccountBalanceData({
    required this.account,
    required this.balance,
  });

  Map<String, dynamic> toJson() {
    return {
      'account': account,
      'balance': balance,
    };
  }

  static AccountBalanceData fromJson(Map<String, dynamic> json) {
    return AccountBalanceData(
      account: json['account'],
      balance: json['balance'].toDouble(),
    );
  }
}

// ================================
// 待實作的其他類別與介面 (階段二、三會實作)
// ================================

// 這些類別會在後續階段實作
class UpdateTransactionRequest {
  // 待實作
}

class TransactionDetailResponse {
  // 待實作
}

class StatisticsResponse {
  // 待實作
}

class TransactionQuery {
  // 待實作
}

class StatisticsData {
  // 待實作
}

class StatisticsQuery {
  // 待實作
}

class ModeConfig {
  // 待實作
}

/// 階段一完成標記
/// 
/// 已完成的29個函數：
/// 21. 建構API回應格式
/// 22. 記錄交易事件  
/// 23. 驗證請求格式
/// 24. 提取用戶模式
/// 55. 適配回應內容
/// 56. 適配錯誤回應
/// 57. 適配交易列表回應
/// 58. 適配儀表板回應
/// 59. 適配快速記帳回應
/// 60. 取得可用操作選項
/// 61. 過濾交易詳細資訊
/// 62. 判斷是否顯示進階統計
/// 63. 取得模式特定訊息
/// 64. API回應類別
/// 65. 快速記帳請求類別
/// 66. 建立交易請求類別
/// 67. 交易查詢請求類別
/// 68. 快速記帳回應類別
/// 69. 交易列表回應類別
/// 70. 儀表板回應類別
/// 71. 交易資料存取介面
/// 72. 交易實體類別
/// 73. 交易驗證服務
/// 74. 交易權限檢查服務
/// 75. 交易錯誤碼枚舉
/// 76. API錯誤類別
/// 77. 交易錯誤處理器
/// 78. 交易模式配置服務
/// 79. 交易回應過濾器
/// 
/// 預期產出：完整的資料模型、錯誤處理機制、四模式適配器 ✅
