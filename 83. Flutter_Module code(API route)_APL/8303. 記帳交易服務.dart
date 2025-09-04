
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

// ==================== 第二階段：核心服務實作 ====================

/**
 * 25. 處理交易建立
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理交易建立的核心業務邏輯
 */
Future<Map<String, dynamic>> processCreateTransaction(String userId, CreateTransactionRequest request) async {
  try {
    // 驗證交易資料
    final validationResult = await validateTransactionData(request);
    if (!validationResult['isValid']) {
      throw ApiError(
        errorCode: TransactionErrorCode.VALIDATION_ERROR,
        message: validationResult['message'],
        details: validationResult['errors'],
      );
    }

    // 計算帳戶餘額變化
    final balanceChange = await calculateAccountBalanceChange(request);
    
    // 更新帳戶餘額
    await updateAccountBalance(request.accountId, balanceChange);
    
    // 檢查預算狀態
    final budgetStatus = await checkBudgetStatus(request.category, request.amount);
    
    // 創建交易記錄
    final transactionId = DateTime.now().millisecondsSinceEpoch.toString();
    final transaction = Transaction(
      id: transactionId,
      userId: userId,
      amount: request.amount,
      description: request.description,
      category: request.category,
      accountId: request.accountId,
      date: request.date,
      type: request.type,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
      metadata: request.metadata,
    );

    return {
      'success': true,
      'transactionId': transactionId,
      'transaction': transaction.toJson(),
      'balanceChange': balanceChange,
      'budgetStatus': budgetStatus,
    };
  } catch (error) {
    return {
      'success': false,
      'error': error.toString(),
    };
  }
}

/**
 * 26. 處理交易更新
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理交易更新的核心業務邏輯
 */
Future<Map<String, dynamic>> processUpdateTransaction(String userId, String transactionId, Map<String, dynamic> updates) async {
  try {
    // 檢查交易是否存在
    final existingTransaction = await getTransactionById(transactionId);
    if (existingTransaction == null) {
      throw ApiError(
        errorCode: TransactionErrorCode.TRANSACTION_NOT_FOUND,
        message: '交易記錄不存在',
      );
    }

    // 權限檢查
    if (existingTransaction['userId'] != userId) {
      throw ApiError(
        errorCode: TransactionErrorCode.PERMISSION_DENIED,
        message: '無權限修改此交易記錄',
      );
    }

    // 計算餘額變化差異
    final oldAmount = existingTransaction['amount'];
    final newAmount = updates['amount'] ?? oldAmount;
    final balanceDifference = newAmount - oldAmount;

    // 更新帳戶餘額
    if (balanceDifference != 0) {
      await updateAccountBalance(existingTransaction['accountId'], balanceDifference);
    }

    // 更新交易記錄
    final updatedTransaction = Map<String, dynamic>.from(existingTransaction);
    updatedTransaction.addAll(updates);
    updatedTransaction['updatedAt'] = DateTime.now().toIso8601String();

    return {
      'success': true,
      'transactionId': transactionId,
      'updatedFields': updates.keys.toList(),
      'balanceChange': balanceDifference,
    };
  } catch (error) {
    return {
      'success': false,
      'error': error.toString(),
    };
  }
}

/**
 * 27. 處理交易刪除
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理交易刪除的核心業務邏輯
 */
Future<Map<String, dynamic>> processDeleteTransaction(String userId, String transactionId, bool deleteRecurring) async {
  try {
    // 檢查交易是否存在
    final existingTransaction = await getTransactionById(transactionId);
    if (existingTransaction == null) {
      throw ApiError(
        errorCode: TransactionErrorCode.TRANSACTION_NOT_FOUND,
        message: '交易記錄不存在',
      );
    }

    // 權限檢查
    if (existingTransaction['userId'] != userId) {
      throw ApiError(
        errorCode: TransactionErrorCode.PERMISSION_DENIED,
        message: '無權限刪除此交易記錄',
      );
    }

    // 回滾帳戶餘額
    final amount = existingTransaction['amount'];
    final accountId = existingTransaction['accountId'];
    await updateAccountBalance(accountId, -amount);

    // 如果是重複交易且需要刪除重複設定
    if (deleteRecurring && existingTransaction['recurringId'] != null) {
      await deleteRecurringSettings(existingTransaction['recurringId']);
    }

    return {
      'success': true,
      'transactionId': transactionId,
      'balanceChange': -amount,
      'recurringDeleted': deleteRecurring,
    };
  } catch (error) {
    return {
      'success': false,
      'error': error.toString(),
    };
  }
}

/**
 * 28. 處理交易查詢
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理交易查詢的核心業務邏輯
 */
Future<Map<String, dynamic>> processTransactionQuery(String userId, TransactionQueryRequest query) async {
  try {
    final List<Transaction> transactions = [];
    
    // 模擬查詢邏輯
    for (int i = 0; i < (query.limit ?? 20); i++) {
      final transaction = Transaction(
        id: 'tx_${DateTime.now().millisecondsSinceEpoch}_$i',
        userId: userId,
        amount: 100.0 + (i * 50),
        description: '交易記錄 ${i + 1}',
        category: '食物',
        accountId: query.accountId ?? 'default_account',
        date: DateTime.now().subtract(Duration(days: i)),
        type: 'expense',
        createdAt: DateTime.now().subtract(Duration(days: i)),
        updatedAt: DateTime.now().subtract(Duration(days: i)),
      );
      transactions.add(transaction);
    }

    return {
      'success': true,
      'transactions': transactions.map((t) => t.toJson()).toList(),
      'total': transactions.length,
      'hasMore': false,
    };
  } catch (error) {
    return {
      'success': false,
      'error': error.toString(),
    };
  }
}

/**
 * 29. 驗證交易資料
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 驗證交易資料的完整性和正確性
 */
Future<Map<String, dynamic>> validateTransactionData(CreateTransactionRequest request) async {
  List<String> errors = [];
  
  // 驗證金額
  if (request.amount <= 0) {
    errors.add('金額必須大於0');
  }
  if (request.amount > 999999999) {
    errors.add('金額不能超過999,999,999');
  }
  
  // 驗證描述
  if (request.description.isEmpty) {
    errors.add('描述不能為空');
  }
  if (request.description.length > 500) {
    errors.add('描述長度不能超過500字元');
  }
  
  // 驗證科目
  final validCategories = ['食物', '交通', '娛樂', '購物', '醫療', '教育', '其他'];
  if (!validCategories.contains(request.category)) {
    errors.add('無效的科目');
  }
  
  // 驗證交易類型
  final validTypes = ['income', 'expense', 'transfer'];
  if (!validTypes.contains(request.type)) {
    errors.add('無效的交易類型');
  }
  
  // 驗證日期
  if (request.date.isAfter(DateTime.now().add(Duration(days: 1)))) {
    errors.add('日期不能是未來時間');
  }

  return {
    'isValid': errors.isEmpty,
    'errors': errors,
    'message': errors.isEmpty ? '驗證通過' : errors.join('; '),
  };
}

/**
 * 30. 計算帳戶餘額變化
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據交易類型計算帳戶餘額變化
 */
Future<double> calculateAccountBalanceChange(CreateTransactionRequest request) async {
  switch (request.type) {
    case 'income':
      return request.amount;
    case 'expense':
      return -request.amount;
    case 'transfer':
      // 對於轉帳，需要同時處理兩個帳戶
      return -request.amount; // 轉出帳戶減少
    default:
      return 0;
  }
}

/**
 * 31. 更新帳戶餘額
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 更新指定帳戶的餘額
 */
Future<void> updateAccountBalance(String accountId, double amount) async {
  // 模擬更新帳戶餘額
  print('更新帳戶 $accountId 餘額：${amount > 0 ? '+' : ''}$amount');
}

/**
 * 32. 檢查預算狀態
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 檢查科目預算使用狀況
 */
Future<Map<String, dynamic>> checkBudgetStatus(String category, double amount) async {
  // 模擬預算檢查
  final categoryBudgets = {
    '食物': 5000.0,
    '交通': 2000.0,
    '娛樂': 3000.0,
    '購物': 4000.0,
  };
  
  final budget = categoryBudgets[category] ?? 1000.0;
  final currentUsed = budget * 0.6; // 模擬已使用60%
  final newUsed = currentUsed + amount;
  final percentage = (newUsed / budget * 100).round();
  
  String status = 'safe';
  if (percentage > 100) {
    status = 'exceeded';
  } else if (percentage > 80) {
    status = 'warning';
  }
  
  return {
    'category': category,
    'budget': budget,
    'used': newUsed,
    'percentage': percentage,
    'status': status,
    'remaining': budget - newUsed,
  };
}

/**
 * 33. 處理快速記帳請求
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理LINE OA快速記帳請求
 */
Future<Map<String, dynamic>> processQuickBookingRequest(String userId, QuickBookingRequest request) async {
  try {
    // 解析記帳文字
    final parseResult = await parseBookingText(request.text);
    
    // 智慧科目匹配
    final categoryMatch = await smartCategoryMatching(parseResult['description']);
    
    // 生成確認訊息
    final confirmationMessage = generateConfirmationMessage(parseResult, request.mode ?? 'standard');
    
    // 創建交易記錄
    if (parseResult['confidence'] > 0.7) {
      final createRequest = CreateTransactionRequest(
        userId: userId,
        amount: parseResult['amount'],
        description: parseResult['description'],
        category: categoryMatch['category'],
        accountId: 'default_account',
        date: DateTime.now(),
        type: parseResult['type'],
        metadata: {
          'source': 'quick_booking',
          'confidence': parseResult['confidence'],
          'originalText': request.text,
        },
      );
      
      final createResult = await processCreateTransaction(userId, createRequest);
      
      return {
        'success': true,
        'transactionId': createResult['transactionId'],
        'parsedData': parseResult,
        'categoryMatch': categoryMatch,
        'confirmation': confirmationMessage,
        'confidence': parseResult['confidence'],
      };
    } else {
      return {
        'success': false,
        'parsedData': parseResult,
        'confidence': parseResult['confidence'],
        'message': '無法準確解析記帳內容，請提供更詳細的資訊',
        'suggestions': ['金額 項目', '支出 150 午餐', '收入 3000 薪水'],
      };
    }
  } catch (error) {
    return {
      'success': false,
      'error': error.toString(),
    };
  }
}

/**
 * 34. 解析記帳文字
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 使用智慧解析提取記帳資訊
 */
Future<Map<String, dynamic>> parseBookingText(String text) async {
  // 提取金額
  final amountResult = extractAmountInfo(text);
  
  // 判斷交易類型
  final transactionType = determineTransactionType(text);
  
  // 提取描述
  String description = text
      .replaceAll(RegExp(r'\d+'), '')
      .replaceAll(RegExp(r'[收入|支出|轉帳|income|expense|transfer]'), '')
      .trim();
  
  if (description.isEmpty) {
    description = transactionType == 'income' ? '收入' : '支出';
  }
  
  // 計算解析信心度
  final confidence = calculateParseConfidence(amountResult, transactionType, description);
  
  return {
    'amount': amountResult['amount'],
    'type': transactionType,
    'description': description,
    'confidence': confidence,
    'extractedInfo': {
      'originalText': text,
      'amountMatches': amountResult['matches'],
      'typeKeywords': amountResult['typeKeywords'],
    },
  };
}

/**
 * 35. 智慧科目匹配
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據描述智慧匹配交易科目
 */
Future<Map<String, dynamic>> smartCategoryMatching(String description) async {
  final categoryKeywords = {
    '食物': ['午餐', '晚餐', '早餐', '飲料', '咖啡', '茶', '餐廳', '便當', '麵包'],
    '交通': ['公車', '捷運', '計程車', 'Uber', '油錢', '停車', '過路費', '機車'],
    '娛樂': ['電影', '遊戲', 'KTV', '旅遊', '運動', '健身', '音樂', '書籍'],
    '購物': ['衣服', '鞋子', '包包', '化妝品', '生活用品', '家電', '手機'],
    '醫療': ['看醫生', '藥品', '健康檢查', '牙醫', '眼科', '復健'],
    '教育': ['學費', '補習', '書籍', '課程', '研習', '證照'],
  };
  
  String matchedCategory = '其他';
  double confidence = 0.0;
  List<String> matchedKeywords = [];
  
  for (String category in categoryKeywords.keys) {
    final keywords = categoryKeywords[category]!;
    final matches = keywords.where((keyword) => description.contains(keyword)).toList();
    
    if (matches.isNotEmpty) {
      final categoryConfidence = matches.length / keywords.length;
      if (categoryConfidence > confidence) {
        confidence = categoryConfidence;
        matchedCategory = category;
        matchedKeywords = matches;
      }
    }
  }
  
  return {
    'category': matchedCategory,
    'confidence': confidence,
    'matchedKeywords': matchedKeywords,
    'alternatives': categoryKeywords.keys.where((c) => c != matchedCategory).take(3).toList(),
  };
}

/**
 * 36. 生成確認訊息
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據用戶模式生成確認訊息
 */
String generateConfirmationMessage(Map<String, dynamic> parseResult, String userMode) {
  final amount = parseResult['amount'];
  final type = parseResult['type'];
  final description = parseResult['description'];
  
  final typeText = type == 'income' ? '收入' : '支出';
  
  switch (userMode) {
    case 'beginner':
      return '✅ 記帳成功！\n${typeText} NT\$${amount.toStringAsFixed(0)} - $description';
    case 'advanced':
    case 'expert':
      return '✅ 已記錄${typeText} NT\$${amount.toStringAsFixed(0)} - $description\n解析信心度：${(parseResult['confidence'] * 100).toStringAsFixed(1)}%';
    default:
      return '✅ 已記錄${typeText} NT\$${amount.toStringAsFixed(0)} - $description';
  }
}

/**
 * 37. 提取金額資訊
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 從文字中提取金額資訊
 */
Map<String, dynamic> extractAmountInfo(String text) {
  final amountRegex = RegExp(r'(\d+\.?\d*)');
  final matches = amountRegex.allMatches(text);
  
  if (matches.isNotEmpty) {
    final amountStr = matches.first.group(1)!;
    final amount = double.tryParse(amountStr) ?? 0.0;
    
    return {
      'amount': amount,
      'matches': matches.map((m) => m.group(0)).toList(),
      'confidence': amount > 0 ? 1.0 : 0.0,
    };
  }
  
  return {
    'amount': 0.0,
    'matches': [],
    'confidence': 0.0,
  };
}

/**
 * 38. 判斷交易類型
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 從文字中判斷交易類型
 */
String determineTransactionType(String text) {
  final incomeKeywords = ['收入', '賺', '薪水', '獎金', '紅包', 'income'];
  final expenseKeywords = ['支出', '花', '買', '付', '費用', 'expense'];
  final transferKeywords = ['轉帳', '轉', 'transfer'];
  
  final lowerText = text.toLowerCase();
  
  if (transferKeywords.any((keyword) => lowerText.contains(keyword))) {
    return 'transfer';
  }
  if (incomeKeywords.any((keyword) => lowerText.contains(keyword))) {
    return 'income';
  }
  if (expenseKeywords.any((keyword) => lowerText.contains(keyword))) {
    return 'expense';
  }
  
  // 預設為支出
  return 'expense';
}

/**
 * 39. 計算解析信心度
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 計算文字解析的信心度
 */
double calculateParseConfidence(Map<String, dynamic> amountResult, String transactionType, String description) {
  double confidence = 0.0;
  
  // 金額解析信心度 (40%)
  confidence += amountResult['confidence'] * 0.4;
  
  // 交易類型信心度 (30%)
  if (transactionType != 'expense') { // 非預設值
    confidence += 0.3;
  } else {
    confidence += 0.15; // 預設值給一半分數
  }
  
  // 描述信心度 (30%)
  if (description.isNotEmpty && description != '支出' && description != '收入') {
    confidence += 0.3;
  } else {
    confidence += 0.1;
  }
  
  return confidence.clamp(0.0, 1.0);
}

/**
 * 40. 生成儀表板數據
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 生成用戶儀表板統計數據
 */
Future<Map<String, dynamic>> generateDashboardData(String userId, Map<String, dynamic> request) async {
  // 模擬統計數據
  final totalIncome = 50000.0;
  final totalExpense = 35000.0;
  final balance = totalIncome - totalExpense;
  
  // 最近交易記錄
  final recentTransactions = List.generate(5, (index) => {
    'id': 'tx_recent_$index',
    'amount': 100.0 + (index * 50),
    'description': '最近交易 ${index + 1}',
    'category': '食物',
    'date': DateTime.now().subtract(Duration(days: index)).toIso8601String(),
    'type': 'expense',
  });
  
  // 科目統計
  final categoryStats = {
    '食物': 8000.0,
    '交通': 3000.0,
    '娛樂': 5000.0,
    '購物': 7000.0,
    '其他': 2000.0,
  };
  
  // 圖表數據
  final chartData = {
    'categoryPie': categoryStats.entries.map((entry) => {
      'category': entry.key,
      'amount': entry.value,
      'percentage': (entry.value / totalExpense * 100).round(),
    }).toList(),
    'weeklyTrend': List.generate(7, (index) => {
      'date': DateTime.now().subtract(Duration(days: 6 - index)).toIso8601String(),
      'income': index == 0 ? 50000.0 : 0.0, // 第一天有收入
      'expense': 1000.0 + (index * 200),
    }),
  };
  
  return {
    'totalIncome': totalIncome,
    'totalExpense': totalExpense,
    'balance': balance,
    'recentTransactions': recentTransactions,
    'categoryStats': categoryStats,
    'chartData': chartData,
  };
}

/**
 * 41. 生成統計摘要
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 生成交易統計摘要
 */
Future<Map<String, dynamic>> generateStatisticsSummary(String userId, Map<String, dynamic> request) async {
  final period = request['period'] ?? 'month';
  final groupBy = request['groupBy'] ?? 'category';
  
  // 根據期間生成不同的統計數據
  Map<String, dynamic> periodData;
  switch (period) {
    case 'today':
      periodData = {
        'totalIncome': 0.0,
        'totalExpense': 450.0,
        'netAmount': -450.0,
        'transactionCount': 3,
      };
      break;
    case 'week':
      periodData = {
        'totalIncome': 5000.0,
        'totalExpense': 8500.0,
        'netAmount': -3500.0,
        'transactionCount': 25,
      };
      break;
    case 'year':
      periodData = {
        'totalIncome': 600000.0,
        'totalExpense': 420000.0,
        'netAmount': 180000.0,
        'transactionCount': 1250,
      };
      break;
    default: // month
      periodData = {
        'totalIncome': 50000.0,
        'totalExpense': 35000.0,
        'netAmount': 15000.0,
        'transactionCount': 156,
      };
      break;
  }
  
  // 根據分組方式生成明細
  List<Map<String, dynamic>> breakdown;
  if (groupBy == 'category') {
    breakdown = [
      {'category': '食物', 'amount': 8000.0, 'count': 45, 'percentage': 22.86},
      {'category': '交通', 'amount': 3000.0, 'count': 20, 'percentage': 8.57},
      {'category': '娛樂', 'amount': 5000.0, 'count': 15, 'percentage': 14.29},
      {'category': '購物', 'amount': 7000.0, 'count': 25, 'percentage': 20.0},
      {'category': '其他', 'amount': 2000.0, 'count': 10, 'percentage': 5.71},
    ];
  } else {
    breakdown = [
      {'account': '現金', 'amount': 15000.0, 'count': 80, 'percentage': 42.86},
      {'account': '信用卡', 'amount': 12000.0, 'count': 50, 'percentage': 34.29},
      {'account': '儲蓄帳戶', 'amount': 8000.0, 'count': 26, 'percentage': 22.86},
    ];
  }
  
  return {
    'period': {
      'type': period,
      'start': DateTime.now().subtract(Duration(days: 30)).toIso8601String(),
      'end': DateTime.now().toIso8601String(),
    },
    'summary': periodData,
    'breakdown': breakdown,
  };
}

/**
 * 42. 生成圖表數據
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 生成各種圖表的數據
 */
Future<Map<String, dynamic>> generateChartData(String userId, Map<String, dynamic> request) async {
  final chartType = request['chartType'] ?? 'pie';
  final period = request['period'] ?? 'month';
  final groupBy = request['groupBy'] ?? 'category';
  
  List<Map<String, dynamic>> chartData;
  
  switch (chartType) {
    case 'pie':
      chartData = [
        {'label': '食物', 'value': 8000.0, 'percentage': 22.86, 'color': '#FF6384'},
        {'label': '交通', 'value': 3000.0, 'percentage': 8.57, 'color': '#36A2EB'},
        {'label': '娛樂', 'value': 5000.0, 'percentage': 14.29, 'color': '#FFCE56'},
        {'label': '購物', 'value': 7000.0, 'percentage': 20.0, 'color': '#4BC0C0'},
        {'label': '其他', 'value': 2000.0, 'percentage': 5.71, 'color': '#9966FF'},
      ];
      break;
    case 'bar':
      chartData = List.generate(12, (index) => {
        'month': index + 1,
        'income': 40000.0 + (index * 1000),
        'expense': 30000.0 + (index * 800),
        'net': 10000.0 + (index * 200),
      });
      break;
    case 'line':
    case 'trend':
      chartData = List.generate(30, (index) => {
        'date': DateTime.now().subtract(Duration(days: 29 - index)).toIso8601String(),
        'income': index % 7 == 0 ? 5000.0 : 0.0,
        'expense': 800.0 + (index % 7 * 200),
        'balance': 15000.0 + (index * 100),
      });
      break;
    default:
      chartData = [];
  }
  
  return {
    'chartType': chartType,
    'period': {
      'type': period,
      'start': DateTime.now().subtract(Duration(days: 30)).toIso8601String(),
      'end': DateTime.now().toIso8601String(),
    },
    'chartData': chartData,
    'summary': {
      'totalAmount': 35000.0,
      'totalTransactions': 156,
      'averageAmount': 224.36,
    },
  };
}

/**
 * 43. 計算趨勢分析
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 計算交易趨勢分析
 */
Future<Map<String, dynamic>> calculateTrendAnalysis(String userId, String period) async {
  // 模擬趨勢計算
  final previousPeriod = {
    'totalIncome': 45000.0,
    'totalExpense': 32000.0,
    'transactionCount': 140,
  };
  
  final currentPeriod = {
    'totalIncome': 50000.0,
    'totalExpense': 35000.0,
    'transactionCount': 156,
  };
  
  final incomeGrowth = ((currentPeriod['totalIncome']! - previousPeriod['totalIncome']!) / previousPeriod['totalIncome']! * 100);
  final expenseGrowth = ((currentPeriod['totalExpense']! - previousPeriod['totalExpense']!) / previousPeriod['totalExpense']! * 100);
  final transactionGrowth = ((currentPeriod['transactionCount']! - previousPeriod['transactionCount']!) / previousPeriod['transactionCount']! * 100);
  
  return {
    'period': period,
    'trends': {
      'income': {
        'current': currentPeriod['totalIncome'],
        'previous': previousPeriod['totalIncome'],
        'growth': incomeGrowth,
        'trend': incomeGrowth > 0 ? 'up' : 'down',
      },
      'expense': {
        'current': currentPeriod['totalExpense'],
        'previous': previousPeriod['totalExpense'],
        'growth': expenseGrowth,
        'trend': expenseGrowth > 0 ? 'up' : 'down',
      },
      'transactions': {
        'current': currentPeriod['transactionCount'],
        'previous': previousPeriod['transactionCount'],
        'growth': transactionGrowth,
        'trend': transactionGrowth > 0 ? 'up' : 'down',
      },
    },
    'insights': [
      '本月收入比上月增加 ${incomeGrowth.toStringAsFixed(1)}%',
      '本月支出比上月增加 ${expenseGrowth.toStringAsFixed(1)}%',
      '交易頻率比上月增加 ${transactionGrowth.toStringAsFixed(1)}%',
    ],
  };
}

/**
 * 44. 聚合交易數據
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據條件聚合交易數據
 */
Future<Map<String, dynamic>> aggregateTransactionData(List<Map<String, dynamic>> transactions, String groupBy) async {
  Map<String, Map<String, dynamic>> aggregated = {};
  
  for (var transaction in transactions) {
    String key;
    switch (groupBy) {
      case 'category':
        key = transaction['category'];
        break;
      case 'account':
        key = transaction['accountId'];
        break;
      case 'day':
        key = DateTime.parse(transaction['date']).toIso8601String().substring(0, 10);
        break;
      case 'month':
        key = DateTime.parse(transaction['date']).toIso8601String().substring(0, 7);
        break;
      default:
        key = 'all';
    }
    
    if (!aggregated.containsKey(key)) {
      aggregated[key] = {
        'key': key,
        'totalAmount': 0.0,
        'count': 0,
        'transactions': <Map<String, dynamic>>[],
      };
    }
    
    aggregated[key]!['totalAmount'] = (aggregated[key]!['totalAmount'] as double) + (transaction['amount'] as double);
    aggregated[key]!['count'] = (aggregated[key]!['count'] as int) + 1;
    (aggregated[key]!['transactions'] as List).add(transaction);
  }
  
  return {
    'groupBy': groupBy,
    'aggregatedData': aggregated.values.toList(),
    'totalGroups': aggregated.length,
  };
}

/**
 * 45. 計算百分比分布
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 計算各類別的百分比分布
 */
List<Map<String, dynamic>> calculatePercentageDistribution(List<Map<String, dynamic>> categoryAmounts) {
  final total = categoryAmounts.fold<double>(0, (sum, item) => sum + (item['amount'] as double));
  
  return categoryAmounts.map((item) {
    final percentage = total > 0 ? (item['amount'] as double) / total * 100 : 0.0;
    return {
      ...item,
      'percentage': percentage,
      'percentageString': '${percentage.toStringAsFixed(1)}%',
    };
  }).toList();
}

/**
 * 46. 產生時間序列數據
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 根據期間產生時間序列數據
 */
List<Map<String, dynamic>> generateTimeSeriesData(List<Map<String, dynamic>> transactions, String period) {
  Map<String, Map<String, dynamic>> timeSeriesMap = {};
  
  for (var transaction in transactions) {
    String timeKey;
    final date = DateTime.parse(transaction['date']);
    
    switch (period) {
      case 'day':
        timeKey = date.toIso8601String().substring(0, 10);
        break;
      case 'week':
        final weekStart = date.subtract(Duration(days: date.weekday - 1));
        timeKey = weekStart.toIso8601String().substring(0, 10);
        break;
      case 'month':
        timeKey = date.toIso8601String().substring(0, 7);
        break;
      default:
        timeKey = date.toIso8601String().substring(0, 10);
    }
    
    if (!timeSeriesMap.containsKey(timeKey)) {
      timeSeriesMap[timeKey] = {
        'date': timeKey,
        'income': 0.0,
        'expense': 0.0,
        'net': 0.0,
        'count': 0,
      };
    }
    
    final amount = transaction['amount'] as double;
    final type = transaction['type'] as String;
    
    timeSeriesMap[timeKey]!['count'] = (timeSeriesMap[timeKey]!['count'] as int) + 1;
    
    if (type == 'income') {
      timeSeriesMap[timeKey]!['income'] = (timeSeriesMap[timeKey]!['income'] as double) + amount;
    } else if (type == 'expense') {
      timeSeriesMap[timeKey]!['expense'] = (timeSeriesMap[timeKey]!['expense'] as double) + amount;
    }
    
    timeSeriesMap[timeKey]!['net'] = (timeSeriesMap[timeKey]!['income'] as double) - (timeSeriesMap[timeKey]!['expense'] as double);
  }
  
  final sortedKeys = timeSeriesMap.keys.toList()..sort();
  return sortedKeys.map((key) => timeSeriesMap[key]!).toList();
}

/**
 * 47. 處理批次建立交易
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理批次建立多筆交易
 */
Future<Map<String, dynamic>> processBatchCreateTransactions(String userId, List<CreateTransactionRequest> requests) async {
  List<Map<String, dynamic>> results = [];
  int successful = 0;
  int failed = 0;
  
  for (int i = 0; i < requests.length; i++) {
    try {
      final request = requests[i];
      final result = await processCreateTransaction(userId, request);
      
      if (result['success']) {
        successful++;
        results.add({
          'index': i,
          'status': 'success',
          'transactionId': result['transactionId'],
        });
      } else {
        failed++;
        results.add({
          'index': i,
          'status': 'failed',
          'error': result['error'],
        });
      }
    } catch (error) {
      failed++;
      results.add({
        'index': i,
        'status': 'failed',
        'error': error.toString(),
      });
    }
  }
  
  return {
    'processed': requests.length,
    'successful': successful,
    'failed': failed,
    'results': results,
    'summary': {
      'successRate': successful / requests.length * 100,
      'totalAmount': requests.fold<double>(0, (sum, req) => sum + req.amount),
    },
  };
}

/**
 * 48. 處理批次更新交易
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理批次更新多筆交易
 */
Future<Map<String, dynamic>> processBatchUpdateTransactions(String userId, List<Map<String, dynamic>> updates) async {
  List<Map<String, dynamic>> results = [];
  int successful = 0;
  int failed = 0;
  
  for (var update in updates) {
    try {
      final transactionId = update['transactionId'];
      final updateFields = Map<String, dynamic>.from(update);
      updateFields.remove('transactionId');
      
      final result = await processUpdateTransaction(userId, transactionId, updateFields);
      
      if (result['success']) {
        successful++;
        results.add({
          'transactionId': transactionId,
          'status': 'success',
          'updatedFields': result['updatedFields'],
        });
      } else {
        failed++;
        results.add({
          'transactionId': transactionId,
          'status': 'failed',
          'error': result['error'],
        });
      }
    } catch (error) {
      failed++;
      results.add({
        'transactionId': update['transactionId'],
        'status': 'failed',
        'error': error.toString(),
      });
    }
  }
  
  return {
    'processed': updates.length,
    'successful': successful,
    'failed': failed,
    'results': results,
  };
}

/**
 * 49. 處理批次刪除交易
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理批次刪除多筆交易
 */
Future<Map<String, dynamic>> processBatchDeleteTransactions(String userId, List<String> transactionIds, bool deleteRecurring) async {
  List<String> deletedTransactions = [];
  List<Map<String, dynamic>> failures = [];
  
  for (String transactionId in transactionIds) {
    try {
      final result = await processDeleteTransaction(userId, transactionId, deleteRecurring);
      
      if (result['success']) {
        deletedTransactions.add(transactionId);
      } else {
        failures.add({
          'transactionId': transactionId,
          'error': result['error'],
        });
      }
    } catch (error) {
      failures.add({
        'transactionId': transactionId,
        'error': error.toString(),
      });
    }
  }
  
  return {
    'processed': transactionIds.length,
    'successful': deletedTransactions.length,
    'failed': failures.length,
    'deletedTransactions': deletedTransactions,
    'failures': failures,
  };
}

/**
 * 50. 處理交易匯入
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 處理從檔案匯入交易記錄
 */
Future<Map<String, dynamic>> processTransactionImport(String userId, Map<String, dynamic> importRequest) async {
  final fileData = importRequest['fileData'] as List<Map<String, dynamic>>;
  final mappingConfig = importRequest['mappingConfig'] as Map<String, String>;
  final skipFirstRow = importRequest['skipFirstRow'] as bool? ?? true;
  
  List<CreateTransactionRequest> transactions = [];
  List<Map<String, dynamic>> errors = [];
  
  final dataToProcess = skipFirstRow ? fileData.skip(1).toList() : fileData;
  
  for (int i = 0; i < dataToProcess.length; i++) {
    try {
      final row = dataToProcess[i];
      
      final transaction = CreateTransactionRequest(
        userId: userId,
        amount: double.parse(row[mappingConfig['amount']] ?? '0'),
        description: row[mappingConfig['description']] ?? '',
        category: row[mappingConfig['category']] ?? '其他',
        accountId: row[mappingConfig['accountId']] ?? 'default_account',
        date: DateTime.parse(row[mappingConfig['date']] ?? DateTime.now().toIso8601String()),
        type: row[mappingConfig['type']] ?? 'expense',
      );
      
      transactions.add(transaction);
    } catch (error) {
      errors.add({
        'row': i + (skipFirstRow ? 2 : 1), // 考慮標題行
        'error': '資料格式錯誤: ${error.toString()}',
        'data': dataToProcess[i],
      });
    }
  }
  
  // 批次建立交易
  final batchResult = await processBatchCreateTransactions(userId, transactions);
  
  return {
    'importId': 'import_${DateTime.now().millisecondsSinceEpoch}',
    'totalRows': fileData.length,
    'processed': transactions.length,
    'successful': batchResult['successful'],
    'failed': batchResult['failed'] + errors.length,
    'importSummary': {
      'totalAmount': transactions.fold<double>(0, (sum, t) => sum + t.amount),
      'incomeCount': transactions.where((t) => t.type == 'income').length,
      'expenseCount': transactions.where((t) => t.type == 'expense').length,
      'transferCount': transactions.where((t) => t.type == 'transfer').length,
    },
    'errors': errors,
    'batchResults': batchResult['results'],
  };
}

/**
 * 51. 驗證批次請求
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 驗證批次操作請求的有效性
 */
Future<Map<String, dynamic>> validateBatchRequest(List<dynamic> requests) async {
  List<Map<String, dynamic>> validationErrors = [];
  
  if (requests.isEmpty) {
    return {
      'isValid': false,
      'errors': [{'message': '批次請求不能為空'}],
    };
  }
  
  if (requests.length > 100) {
    return {
      'isValid': false,
      'errors': [{'message': '批次請求不能超過100筆'}],
    };
  }
  
  for (int i = 0; i < requests.length; i++) {
    final request = requests[i];
    
    // 基本結構驗證
    if (request is! Map<String, dynamic>) {
      validationErrors.add({
        'index': i,
        'message': '請求格式錯誤',
      });
      continue;
    }
    
    // 必要欄位驗證
    final requiredFields = ['amount', 'description', 'category', 'accountId', 'date', 'type'];
    for (String field in requiredFields) {
      if (!request.containsKey(field) || request[field] == null) {
        validationErrors.add({
          'index': i,
          'field': field,
          'message': '缺少必要欄位：$field',
        });
      }
    }
    
    // 資料類型驗證
    if (request['amount'] != null && request['amount'] is! num) {
      validationErrors.add({
        'index': i,
        'field': 'amount',
        'message': '金額必須是數字',
      });
    }
  }
  
  return {
    'isValid': validationErrors.isEmpty,
    'errors': validationErrors,
    'validCount': requests.length - validationErrors.length,
    'errorCount': validationErrors.length,
  };
}

/**
 * 52. 執行批次操作
 * @version 2025-09-04-V1.0.0
 * @date 2025-09-04 12:00:00
 * @update: 執行批次操作的核心邏輯
 */
Future<Map<String, dynamic>> executeBatchOperation(String operation, String userId, List<dynamic> data) async {
  try {
    switch (operation) {
      case 'create':
        final requests = data.cast<CreateTransactionRequest>();
        return await processBatchCreateTransactions(userId, requests);
      
      case 'update':
        final updates = data.cast<Map<String, dynamic>>();
        return await processBatchUpdateTransactions(userId, updates);
      
      case 'delete':
        final transactionIds = data.cast<String>();
        return await processBatchDeleteTransactions(userId, transactionIds, false);
      
      default:
        throw ApiError(
          errorCode: TransactionErrorCode.VALIDATION_ERROR,
          message: '不支援的批次操作：$operation',
        );
    }
  } catch (error) {
    return {
      'success': false,
      'error': error.toString(),
      'operation': operation,
      'processed': 0,
      'successful': 0,
      'failed': data.length,
    };
  }
}

// ==================== 輔助函數 ====================

/**
 * 獲取交易記錄 (輔助函數)
 */
Future<Map<String, dynamic>?> getTransactionById(String transactionId) async {
  // 模擬資料庫查詢
  return {
    'id': transactionId,
    'userId': 'user123',
    'amount': 150.0,
    'description': '測試交易',
    'category': '食物',
    'accountId': 'account123',
    'date': DateTime.now().toIso8601String(),
    'type': 'expense',
    'createdAt': DateTime.now().toIso8601String(),
    'updatedAt': DateTime.now().toIso8601String(),
  };
}

/**
 * 刪除重複設定 (輔助函數)
 */
Future<void> deleteRecurringSettings(String recurringId) async {
  print('刪除重複設定：$recurringId');
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
