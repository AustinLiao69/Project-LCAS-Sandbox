
/**
 * 8303. 記帳交易服務模組
 * @version 2025-09-04-V2.1.0
 * @date 2025-09-04 12:00:00
 * @update: 建立記帳交易服務模組，實作階段一基礎架構與資料模型
 */

import 'dart:convert';
import 'dart:async';

// ==================== 階段一：基礎架構與資料模型 ====================

/**
 * 21. 建構API回應格式
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 建立統一API回應格式
 */
Map<String, dynamic> buildApiResponse({
  required bool success,
  required String message,
  dynamic data,
  String? errorCode,
  Map<String, dynamic>? metadata,
}) {
  return {
    'success': success,
    'message': message,
    'data': data,
    'errorCode': errorCode,
    'timestamp': DateTime.now().toIso8601String(),
    'metadata': metadata ?? {},
  };
}

/**
 * 22. 記錄交易事件
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 記錄交易相關事件
 */
void logTransactionEvent({
  required String eventType,
  required String transactionId,
  required Map<String, dynamic> details,
  String? userId,
}) {
  final logEntry = {
    'eventType': eventType,
    'transactionId': transactionId,
    'userId': userId,
    'details': details,
    'timestamp': DateTime.now().toIso8601String(),
  };
  print('Transaction Event: ${json.encode(logEntry)}');
}

/**
 * 23. 驗證請求格式
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 驗證API請求格式
 */
bool validateRequestFormat(Map<String, dynamic> request, List<String> requiredFields) {
  for (String field in requiredFields) {
    if (!request.containsKey(field) || request[field] == null) {
      return false;
    }
  }
  return true;
}

/**
 * 24. 提取用戶模式
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 從請求中提取用戶模式
 */
String extractUserMode(Map<String, dynamic> request) {
  final mode = request['userMode'] ?? request['mode'] ?? 'standard';
  final validModes = ['beginner', 'standard', 'advanced', 'expert'];
  return validModes.contains(mode) ? mode : 'standard';
}

/**
 * 55. 適配回應內容
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據用戶模式適配回應內容
 */
Map<String, dynamic> adaptResponseContent(Map<String, dynamic> response, String userMode) {
  final adaptedResponse = Map<String, dynamic>.from(response);
  
  switch (userMode) {
    case 'beginner':
      adaptedResponse['simplified'] = true;
      adaptedResponse['helpText'] = '建議操作步驟已簡化';
      break;
    case 'advanced':
      adaptedResponse['detailed'] = true;
      adaptedResponse['statistics'] = true;
      break;
    case 'expert':
      adaptedResponse['detailed'] = true;
      adaptedResponse['statistics'] = true;
      adaptedResponse['rawData'] = true;
      break;
    default:
      // standard mode - no changes
      break;
  }
  
  return adaptedResponse;
}

/**
 * 56. 適配錯誤回應
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據用戶模式適配錯誤回應
 */
Map<String, dynamic> adaptErrorResponse(String errorCode, String message, String userMode) {
  final errorResponse = {
    'success': false,
    'errorCode': errorCode,
    'message': message,
    'timestamp': DateTime.now().toIso8601String(),
  };
  
  switch (userMode) {
    case 'beginner':
      errorResponse['helpText'] = '請檢查輸入內容並重試';
      errorResponse['suggestedAction'] = '建議聯繫客服';
      break;
    case 'expert':
      errorResponse['technicalDetails'] = '詳細錯誤資訊';
      errorResponse['debugInfo'] = true;
      break;
  }
  
  return errorResponse;
}

/**
 * 57. 適配交易列表回應
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 適配交易列表回應格式
 */
Map<String, dynamic> adaptTransactionListResponse(List<Map<String, dynamic>> transactions, String userMode) {
  final adaptedTransactions = transactions.map((transaction) {
    final adapted = Map<String, dynamic>.from(transaction);
    
    switch (userMode) {
      case 'beginner':
        adapted.removeWhere((key, value) => ['metadata', 'rawData'].contains(key));
        break;
      case 'expert':
        adapted['debugInfo'] = {'processed': true};
        break;
    }
    
    return adapted;
  }).toList();
  
  return {
    'transactions': adaptedTransactions,
    'total': adaptedTransactions.length,
    'userMode': userMode,
  };
}

/**
 * 58. 適配儀表板回應
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 適配儀表板數據回應
 */
Map<String, dynamic> adaptDashboardResponse(Map<String, dynamic> dashboardData, String userMode) {
  final adapted = Map<String, dynamic>.from(dashboardData);
  
  switch (userMode) {
    case 'beginner':
      adapted['simplified'] = true;
      adapted.removeWhere((key, value) => ['advancedMetrics', 'detailedStats'].contains(key));
      break;
    case 'advanced':
    case 'expert':
      adapted['detailedStats'] = true;
      adapted['advancedMetrics'] = true;
      break;
  }
  
  return adapted;
}

/**
 * 59. 適配快速記帳回應
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 適配快速記帳回應
 */
Map<String, dynamic> adaptQuickBookingResponse(Map<String, dynamic> bookingResult, String userMode) {
  final adapted = Map<String, dynamic>.from(bookingResult);
  
  switch (userMode) {
    case 'beginner':
      adapted['helpText'] = '記帳成功！';
      adapted['nextSteps'] = ['查看交易記錄', '設定預算'];
      break;
    case 'expert':
      adapted['processingDetails'] = true;
      adapted['validationInfo'] = true;
      break;
  }
  
  return adapted;
}

/**
 * 60. 取得可用操作選項
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據用戶模式取得可用操作選項
 */
List<String> getAvailableOperations(String userMode) {
  final baseOperations = ['create', 'read', 'update', 'delete'];
  
  switch (userMode) {
    case 'beginner':
      return ['create', 'read'];
    case 'advanced':
      return [...baseOperations, 'batch', 'import'];
    case 'expert':
      return [...baseOperations, 'batch', 'import', 'export', 'analyze'];
    default:
      return baseOperations;
  }
}

/**
 * 61. 過濾交易詳細資訊
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據用戶模式過濾交易詳細資訊
 */
Map<String, dynamic> filterTransactionDetails(Map<String, dynamic> transaction, String userMode) {
  final filtered = Map<String, dynamic>.from(transaction);
  
  switch (userMode) {
    case 'beginner':
      final keepFields = ['id', 'amount', 'description', 'date', 'category'];
      filtered.removeWhere((key, value) => !keepFields.contains(key));
      break;
    case 'expert':
      // 保留所有欄位
      break;
    default:
      final removeFields = ['internalId', 'debugInfo'];
      filtered.removeWhere((key, value) => removeFields.contains(key));
      break;
  }
  
  return filtered;
}

/**
 * 62. 判斷是否顯示進階統計
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 判斷是否顯示進階統計資訊
 */
bool shouldShowAdvancedStats(String userMode) {
  return ['advanced', 'expert'].contains(userMode);
}

/**
 * 63. 取得模式特定訊息
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 取得特定用戶模式的訊息
 */
String getModeSpecificMessage(String operation, String userMode) {
  final messages = {
    'beginner': {
      'create': '成功新增交易記錄！',
      'update': '交易記錄已更新！',
      'delete': '交易記錄已刪除！',
    },
    'standard': {
      'create': '交易記錄建立成功',
      'update': '交易記錄更新完成',
      'delete': '交易記錄刪除完成',
    },
    'advanced': {
      'create': '交易記錄已建立並同步至所有帳本',
      'update': '交易記錄更新完成，相關統計已重新計算',
      'delete': '交易記錄已刪除，帳戶餘額已調整',
    },
    'expert': {
      'create': '交易記錄建立成功，已觸發後續處理流程',
      'update': '交易記錄更新完成，影響範圍：相關統計、預算檢查',
      'delete': '交易記錄刪除完成，已執行資料一致性檢查',
    },
  };
  
  return messages[userMode]?[operation] ?? '操作完成';
}

// ==================== 資料模型類別 ====================

/**
 * 64. API回應類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: API回應資料模型
 */
class ApiResponse {
  final bool success;
  final String message;
  final dynamic data;
  final String? errorCode;
  final DateTime timestamp;
  final Map<String, dynamic> metadata;

  ApiResponse({
    required this.success,
    required this.message,
    this.data,
    this.errorCode,
    required this.timestamp,
    this.metadata = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'message': message,
      'data': data,
      'errorCode': errorCode,
      'timestamp': timestamp.toIso8601String(),
      'metadata': metadata,
    };
  }

  factory ApiResponse.fromJson(Map<String, dynamic> json) {
    return ApiResponse(
      success: json['success'],
      message: json['message'],
      data: json['data'],
      errorCode: json['errorCode'],
      timestamp: DateTime.parse(json['timestamp']),
      metadata: json['metadata'] ?? {},
    );
  }
}

/**
 * 65. 快速記帳請求類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 快速記帳請求資料模型
 */
class QuickBookingRequest {
  final String userId;
  final String text;
  final String? mode;
  final Map<String, dynamic> context;

  QuickBookingRequest({
    required this.userId,
    required this.text,
    this.mode,
    this.context = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'text': text,
      'mode': mode,
      'context': context,
    };
  }

  factory QuickBookingRequest.fromJson(Map<String, dynamic> json) {
    return QuickBookingRequest(
      userId: json['userId'],
      text: json['text'],
      mode: json['mode'],
      context: json['context'] ?? {},
    );
  }
}

/**
 * 66. 建立交易請求類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 建立交易請求資料模型
 */
class CreateTransactionRequest {
  final String userId;
  final double amount;
  final String description;
  final String category;
  final String accountId;
  final DateTime date;
  final String type;
  final Map<String, dynamic> metadata;

  CreateTransactionRequest({
    required this.userId,
    required this.amount,
    required this.description,
    required this.category,
    required this.accountId,
    required this.date,
    required this.type,
    this.metadata = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'amount': amount,
      'description': description,
      'category': category,
      'accountId': accountId,
      'date': date.toIso8601String(),
      'type': type,
      'metadata': metadata,
    };
  }

  factory CreateTransactionRequest.fromJson(Map<String, dynamic> json) {
    return CreateTransactionRequest(
      userId: json['userId'],
      amount: json['amount'].toDouble(),
      description: json['description'],
      category: json['category'],
      accountId: json['accountId'],
      date: DateTime.parse(json['date']),
      type: json['type'],
      metadata: json['metadata'] ?? {},
    );
  }
}

/**
 * 67. 交易查詢請求類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易查詢請求資料模型
 */
class TransactionQueryRequest {
  final String userId;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? category;
  final String? accountId;
  final double? minAmount;
  final double? maxAmount;
  final int? limit;
  final int? offset;

  TransactionQueryRequest({
    required this.userId,
    this.startDate,
    this.endDate,
    this.category,
    this.accountId,
    this.minAmount,
    this.maxAmount,
    this.limit,
    this.offset,
  });

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'category': category,
      'accountId': accountId,
      'minAmount': minAmount,
      'maxAmount': maxAmount,
      'limit': limit,
      'offset': offset,
    };
  }

  factory TransactionQueryRequest.fromJson(Map<String, dynamic> json) {
    return TransactionQueryRequest(
      userId: json['userId'],
      startDate: json['startDate'] != null ? DateTime.parse(json['startDate']) : null,
      endDate: json['endDate'] != null ? DateTime.parse(json['endDate']) : null,
      category: json['category'],
      accountId: json['accountId'],
      minAmount: json['minAmount']?.toDouble(),
      maxAmount: json['maxAmount']?.toDouble(),
      limit: json['limit'],
      offset: json['offset'],
    );
  }
}

/**
 * 68. 快速記帳回應類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 快速記帳回應資料模型
 */
class QuickBookingResponse {
  final bool success;
  final String message;
  final String? transactionId;
  final Map<String, dynamic> parsedData;
  final double confidence;
  final List<String> suggestions;

  QuickBookingResponse({
    required this.success,
    required this.message,
    this.transactionId,
    this.parsedData = const {},
    this.confidence = 0.0,
    this.suggestions = const [],
  });

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'message': message,
      'transactionId': transactionId,
      'parsedData': parsedData,
      'confidence': confidence,
      'suggestions': suggestions,
    };
  }

  factory QuickBookingResponse.fromJson(Map<String, dynamic> json) {
    return QuickBookingResponse(
      success: json['success'],
      message: json['message'],
      transactionId: json['transactionId'],
      parsedData: json['parsedData'] ?? {},
      confidence: json['confidence']?.toDouble() ?? 0.0,
      suggestions: List<String>.from(json['suggestions'] ?? []),
    );
  }
}

/**
 * 69. 交易列表回應類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易列表回應資料模型
 */
class TransactionListResponse {
  final List<Transaction> transactions;
  final int total;
  final int offset;
  final int limit;
  final bool hasMore;

  TransactionListResponse({
    required this.transactions,
    required this.total,
    required this.offset,
    required this.limit,
    required this.hasMore,
  });

  Map<String, dynamic> toJson() {
    return {
      'transactions': transactions.map((t) => t.toJson()).toList(),
      'total': total,
      'offset': offset,
      'limit': limit,
      'hasMore': hasMore,
    };
  }

  factory TransactionListResponse.fromJson(Map<String, dynamic> json) {
    return TransactionListResponse(
      transactions: (json['transactions'] as List)
          .map((t) => Transaction.fromJson(t))
          .toList(),
      total: json['total'],
      offset: json['offset'],
      limit: json['limit'],
      hasMore: json['hasMore'],
    );
  }
}

/**
 * 70. 儀表板回應類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 儀表板回應資料模型
 */
class DashboardResponse {
  final double totalIncome;
  final double totalExpense;
  final double balance;
  final List<Map<String, dynamic>> recentTransactions;
  final Map<String, double> categoryStats;
  final Map<String, dynamic> chartData;

  DashboardResponse({
    required this.totalIncome,
    required this.totalExpense,
    required this.balance,
    required this.recentTransactions,
    required this.categoryStats,
    required this.chartData,
  });

  Map<String, dynamic> toJson() {
    return {
      'totalIncome': totalIncome,
      'totalExpense': totalExpense,
      'balance': balance,
      'recentTransactions': recentTransactions,
      'categoryStats': categoryStats,
      'chartData': chartData,
    };
  }

  factory DashboardResponse.fromJson(Map<String, dynamic> json) {
    return DashboardResponse(
      totalIncome: json['totalIncome'].toDouble(),
      totalExpense: json['totalExpense'].toDouble(),
      balance: json['balance'].toDouble(),
      recentTransactions: List<Map<String, dynamic>>.from(json['recentTransactions']),
      categoryStats: Map<String, double>.from(json['categoryStats']),
      chartData: json['chartData'],
    );
  }
}

// ==================== 介面與服務類別 ====================

/**
 * 71. 交易資料存取介面
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易資料存取介面
 */
abstract class TransactionDataAccess {
  Future<String> createTransaction(CreateTransactionRequest request);
  Future<Transaction?> getTransaction(String transactionId);
  Future<List<Transaction>> getTransactions(TransactionQueryRequest query);
  Future<bool> updateTransaction(String transactionId, Map<String, dynamic> updates);
  Future<bool> deleteTransaction(String transactionId);
  Future<List<Transaction>> getBatchTransactions(List<String> transactionIds);
}

/**
 * 72. 交易實體類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易實體資料模型
 */
class Transaction {
  final String id;
  final String userId;
  final double amount;
  final String description;
  final String category;
  final String accountId;
  final DateTime date;
  final String type;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, dynamic> metadata;

  Transaction({
    required this.id,
    required this.userId,
    required this.amount,
    required this.description,
    required this.category,
    required this.accountId,
    required this.date,
    required this.type,
    required this.createdAt,
    required this.updatedAt,
    this.metadata = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'amount': amount,
      'description': description,
      'category': category,
      'accountId': accountId,
      'date': date.toIso8601String(),
      'type': type,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'metadata': metadata,
    };
  }

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'],
      userId: json['userId'],
      amount: json['amount'].toDouble(),
      description: json['description'],
      category: json['category'],
      accountId: json['accountId'],
      date: DateTime.parse(json['date']),
      type: json['type'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
      metadata: json['metadata'] ?? {},
    );
  }
}

/**
 * 73. 交易驗證服務
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易驗證服務
 */
class TransactionValidationService {
  bool validateAmount(double amount) {
    return amount > 0 && amount <= 999999999;
  }

  bool validateDescription(String description) {
    return description.isNotEmpty && description.length <= 500;
  }

  bool validateCategory(String category) {
    final validCategories = ['食物', '交通', '娛樂', '購物', '醫療', '教育', '其他'];
    return validCategories.contains(category);
  }

  bool validateTransactionType(String type) {
    return ['income', 'expense', 'transfer'].contains(type);
  }

  List<String> validateTransaction(CreateTransactionRequest request) {
    List<String> errors = [];

    if (!validateAmount(request.amount)) {
      errors.add('金額格式錯誤');
    }
    if (!validateDescription(request.description)) {
      errors.add('描述格式錯誤');
    }
    if (!validateCategory(request.category)) {
      errors.add('科目格式錯誤');
    }
    if (!validateTransactionType(request.type)) {
      errors.add('交易類型錯誤');
    }

    return errors;
  }
}

/**
 * 74. 交易權限檢查服務
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易權限檢查服務
 */
class TransactionPermissionService {
  bool canCreateTransaction(String userId, String accountId) {
    // 實作權限檢查邏輯
    return userId.isNotEmpty && accountId.isNotEmpty;
  }

  bool canReadTransaction(String userId, String transactionId) {
    // 實作讀取權限檢查
    return userId.isNotEmpty && transactionId.isNotEmpty;
  }

  bool canUpdateTransaction(String userId, String transactionId) {
    // 實作更新權限檢查
    return userId.isNotEmpty && transactionId.isNotEmpty;
  }

  bool canDeleteTransaction(String userId, String transactionId) {
    // 實作刪除權限檢查
    return userId.isNotEmpty && transactionId.isNotEmpty;
  }

  bool canBatchOperation(String userId, List<String> transactionIds) {
    // 實作批次操作權限檢查
    return userId.isNotEmpty && transactionIds.isNotEmpty;
  }
}

// ==================== 錯誤處理 ====================

/**
 * 75. 交易錯誤碼枚舉
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易錯誤碼定義
 */
enum TransactionErrorCode {
  VALIDATION_ERROR('VALIDATION_ERROR'),
  PERMISSION_DENIED('PERMISSION_DENIED'),
  TRANSACTION_NOT_FOUND('TRANSACTION_NOT_FOUND'),
  ACCOUNT_NOT_FOUND('ACCOUNT_NOT_FOUND'),
  INSUFFICIENT_BALANCE('INSUFFICIENT_BALANCE'),
  DUPLICATE_TRANSACTION('DUPLICATE_TRANSACTION'),
  PARSE_ERROR('PARSE_ERROR'),
  INTERNAL_ERROR('INTERNAL_ERROR');

  const TransactionErrorCode(this.code);
  final String code;
}

/**
 * 76. API錯誤類別
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: API錯誤類別定義
 */
class ApiError extends Error {
  final TransactionErrorCode errorCode;
  final String message;
  final Map<String, dynamic> details;

  ApiError({
    required this.errorCode,
    required this.message,
    this.details = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      'errorCode': errorCode.code,
      'message': message,
      'details': details,
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'ApiError(${errorCode.code}): $message';
  }
}

/**
 * 77. 交易錯誤處理器
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易錯誤處理器
 */
class TransactionErrorHandler {
  static Map<String, dynamic> handleError(dynamic error, String userMode) {
    if (error is ApiError) {
      return adaptErrorResponse(error.errorCode.code, error.message, userMode);
    }
    
    return adaptErrorResponse(
      TransactionErrorCode.INTERNAL_ERROR.code,
      '系統發生錯誤',
      userMode,
    );
  }

  static ApiError createValidationError(String message, {Map<String, dynamic>? details}) {
    return ApiError(
      errorCode: TransactionErrorCode.VALIDATION_ERROR,
      message: message,
      details: details ?? {},
    );
  }

  static ApiError createPermissionError(String message) {
    return ApiError(
      errorCode: TransactionErrorCode.PERMISSION_DENIED,
      message: message,
    );
  }

  static ApiError createNotFoundError(String message) {
    return ApiError(
      errorCode: TransactionErrorCode.TRANSACTION_NOT_FOUND,
      message: message,
    );
  }
}

/**
 * 78. 交易模式配置服務
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易模式配置服務
 */
class TransactionModeConfigService {
  static Map<String, Map<String, dynamic>> getModeConfig() {
    return {
      'beginner': {
        'features': ['create', 'read'],
        'validation': 'strict',
        'helpText': true,
        'suggestions': true,
      },
      'standard': {
        'features': ['create', 'read', 'update', 'delete'],
        'validation': 'normal',
        'helpText': false,
        'suggestions': false,
      },
      'advanced': {
        'features': ['create', 'read', 'update', 'delete', 'batch'],
        'validation': 'normal',
        'statistics': true,
        'reporting': true,
      },
      'expert': {
        'features': ['create', 'read', 'update', 'delete', 'batch', 'import', 'export'],
        'validation': 'loose',
        'debugMode': true,
        'rawData': true,
      },
    };
  }

  static Map<String, dynamic> getConfigForMode(String mode) {
    final config = getModeConfig();
    return config[mode] ?? config['standard']!;
  }
}

/**
 * 79. 交易回應過濾器
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 交易回應過濾器
 */
class TransactionResponseFilter {
  static Map<String, dynamic> filterResponse(Map<String, dynamic> response, String userMode) {
    final config = TransactionModeConfigService.getConfigForMode(userMode);
    final filtered = Map<String, dynamic>.from(response);

    // 根據模式配置過濾回應
    if (config['helpText'] != true) {
      filtered.remove('helpText');
    }
    if (config['suggestions'] != true) {
      filtered.remove('suggestions');
    }
    if (config['debugMode'] != true) {
      filtered.remove('debugInfo');
    }
    if (config['rawData'] != true) {
      filtered.remove('rawData');
    }

    return filtered;
  }

  static List<Map<String, dynamic>> filterTransactionList(List<Map<String, dynamic>> transactions, String userMode) {
    return transactions.map((transaction) => filterResponse(transaction, userMode)).toList();
  }
}
