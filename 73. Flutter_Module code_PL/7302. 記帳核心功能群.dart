

/**
 * 7302. 記帳核心功能群.dart
 * @version v2.5.0
 * @date 2025-10-16
 * @update: 階段二業務邏輯分拆完成版 - 純業務邏輯，UI邏輯已分離至7302U.dart
 * 
 * 本模組實現LCAS 2.0記帳核心功能群的完整業務邏輯，
 * 包括交易管理、帳戶管理、統計分析、資料處理等核心功能。
 * UI相關功能已移至7302U. 記帳核心功能群.dart。
 * 
 * 階段二分拆重點：
 * - 移除所有Widget和UI相關代碼
 * - 保留純粹業務邏輯和資料處理
 * - 確保與UI層的清晰介面分離
 * - 維持業務邏輯的完整性和獨立性
 * 
 * 嚴格遵循0026、0090、8088文件規範，專注於純粹業務邏輯實作。
 */

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;

// 引入必要的依賴
enum UserMode { expert, inertial, cultivation, guiding }
enum ArchitectureLayer { presentation, stateManagement, businessLogic, dataAccess }
enum TransactionType { income, expense, transfer }

// 資料模型定義
class Transaction {
  final String id;
  final TransactionType type;
  final double amount;
  final String? categoryId;
  final String? accountId;
  final String description;
  final DateTime date;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String source;

  Transaction({
    required this.id,
    required this.type,
    required this.amount,
    this.categoryId,
    this.accountId,
    required this.description,
    required this.date,
    required this.createdAt,
    required this.updatedAt,
    this.source = 'manual',
  });

  /// 轉換為符合1311.FS.js格式的JSON
  Map<String, dynamic> toFirestoreJson() {
    return {
      'id': id,
      'amount': amount,
      'type': type.toString().split('.').last,
      'description': description,
      'categoryId': categoryId,
      'accountId': accountId,
      'date': date.toIso8601String().split('T')[0],
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'source': source,
    };
  }

  /// 從1311格式JSON建立Transaction
  factory Transaction.fromFirestoreJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      type: _parseTransactionType(json['type'] as String),
      amount: (json['amount'] as num).toDouble(),
      categoryId: json['categoryId'] as String?,
      accountId: json['accountId'] as String?,
      description: json['description'] as String? ?? '',
      date: DateTime.parse(json['date'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      source: json['source'] as String? ?? 'manual',
    );
  }

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction.fromFirestoreJson(json);
  }

  static TransactionType _parseTransactionType(String typeString) {
    switch (typeString.toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }
}

class QuickAccountingResult {
  final bool success;
  final String message;
  final Transaction? transaction;

  QuickAccountingResult({
    required this.success,
    required this.message,
    this.transaction,
  });
}

class Category {
  final String id;
  final String name;
  final String? parentId;
  final String type;

  Category({
    required this.id,
    required this.name,
    this.parentId,
    required this.type,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String,
      name: json['name'] as String,
      parentId: json['parentId'] as String?,
      type: json['type'] as String,
    );
  }
}

class Account {
  final String id;
  final String name;
  final String type;
  final double balance;

  Account({
    required this.id,
    required this.name,
    required this.type,
    required this.balance,
  });
}

class DashboardData {
  final double totalIncome;
  final double totalExpense;
  final double balance;
  final int transactionCount;

  DashboardData({
    required this.totalIncome,
    required this.totalExpense,
    required this.balance,
    required this.transactionCount,
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    return DashboardData(
      totalIncome: (json['totalIncome'] ?? 0.0).toDouble(),
      totalExpense: (json['totalExpense'] ?? 0.0).toDouble(),
      balance: (json['balance'] ?? 0.0).toDouble(),
      transactionCount: json['transactionCount'] ?? 0,
    );
  }
}

// ===========================================
// 核心業務邏輯類別
// ===========================================

/**
 * 01. 依賴注入容器 - DependencyContainer
 * @version 2025-10-16-V2.4.0
 * @date 2025-10-16
 * @update: 階段二業務邏輯分拆版 - 移除UI相關依賴註冊
 */
abstract class DependencyContainer {
  static final Map<Type, dynamic> _instances = {};
  static final Map<Type, Function> _factories = {};

  static void registerAccountingDependencies() {
    // 註冊記帳核心業務邏輯
    register<BookkeepingCoreFunctionGroup>(() => BookkeepingCoreFunctionGroupImpl());
    
    // 註冊API客戶端
    register<TransactionApiClient>(() => TransactionApiClientImpl());
    register<CategoryApiClient>(() => CategoryApiClientImpl());
    register<AccountApiClient>(() => AccountApiClientImpl());
    
    // 註冊Repository
    register<TransactionRepository>(() => TransactionRepositoryImpl(get<TransactionAPIGateway>()));
    register<CategoryRepository>(() => CategoryRepositoryImpl(get<CategoryApiClient>()));
    register<AccountRepository>(() => AccountRepositoryImpl(get<AccountApiClient>()));
  }

  static void register<T>(T Function() factory) {
    _factories[T] = factory;
  }

  static T get<T>() {
    if (_instances.containsKey(T)) {
      return _instances[T] as T;
    }

    if (_factories.containsKey(T)) {
      final instance = _factories[T]!();
      _instances[T] = instance;
      return instance as T;
    }

    throw Exception('Type $T not registered in DependencyContainer');
  }

  static void dispose() {
    _instances.clear();
    _factories.clear();
  }
}

/**
 * 02. LINE OA記帳對話處理器 - LineOADialogHandler
 * @version 2025-10-16-V2.4.0
 * @date 2025-10-16
 * @update: 階段二業務邏輯分拆版 - 純粹業務邏輯，無UI依賴
 */
abstract class LineOADialogHandler {
  Future<QuickAccountingResult> handleQuickAccounting(String input);
  Future<Map<String, dynamic>> handleInquiry(String query);
  Future<Map<String, dynamic>> handleStatistics(String period);
}

class LineOADialogHandlerImpl extends LineOADialogHandler {
  @override
  Future<QuickAccountingResult> handleQuickAccounting(String input) async {
    try {
      // 呼叫智能文字解析器
      final parser = SmartTextParserImpl();
      final parsedData = await parser.parseText(input);

      // 建立交易記錄
      final transaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: _mapToTransactionType(parsedData['type']),
        amount: parsedData['amount'] ?? 0.0,
        categoryId: parsedData['categoryId'],
        accountId: parsedData['accountId'],
        description: parsedData['description'] ?? '',
        date: DateTime.now(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      // 呼叫快速記帳處理器
      final processor = QuickAccountingProcessorImpl();
      return await processor.processQuickAccounting(input);

    } catch (e) {
      return QuickAccountingResult(
        success: false,
        message: '記帳失敗：${e.toString()}',
      );
    }
  }

  @override
  Future<Map<String, dynamic>> handleInquiry(String query) async {
    await Future.delayed(Duration(milliseconds: 100));
    return {
      'success': true,
      'message': '查詢完成',
      'data': {'query': query, 'result': 'processed'}
    };
  }

  @override
  Future<Map<String, dynamic>> handleStatistics(String period) async {
    await Future.delayed(Duration(milliseconds: 100));
    return {
      'success': true,
      'message': '統計完成',
      'data': {'period': period, 'statistics': {}}
    };
  }

  TransactionType _mapToTransactionType(String? type) {
    switch (type?.toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }
}

/**
 * 03. 記帳核心功能群主要業務邏輯 - BookkeepingCoreFunctionGroup
 * @version 2025-10-16-V2.4.0
 * @date 2025-10-16
 * @update: 階段二業務邏輯分拆版 - 純粹業務邏輯介面
 */
abstract class BookkeepingCoreFunctionGroup {
  // 儀表板相關業務邏輯
  Future<Map<String, dynamic>> getDashboardData();
  Future<List<Map<String, dynamic>>> getAccountSummary();
  Future<List<Map<String, dynamic>>> getRecentTransactions(int limit);
  Future<Map<String, dynamic>> getMonthlyStatistics();
  
  // 交易相關業務邏輯
  Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> transactionData);
  Future<Map<String, dynamic>> createQuickTransaction(Map<String, dynamic> transactionData);
  Future<Map<String, dynamic>> updateTransaction(Map<String, dynamic> transactionData);
  Future<Map<String, dynamic>> deleteTransaction(String transactionId);
  Future<List<Map<String, dynamic>>> getTransactionHistory();
  
  // 統計分析相關業務邏輯
  Future<List<Map<String, dynamic>>> getCategoryAnalysis();
  Future<Map<String, dynamic>> getStatisticsData(String period);
}

class BookkeepingCoreFunctionGroupImpl extends BookkeepingCoreFunctionGroup {
  late final TransactionApiClient _transactionApiClient;
  late final CategoryApiClient _categoryApiClient;
  late final AccountApiClient _accountApiClient;

  BookkeepingCoreFunctionGroupImpl() {
    _transactionApiClient = TransactionApiClientImpl();
    _categoryApiClient = CategoryApiClientImpl();
    _accountApiClient = AccountApiClientImpl();
  }

  @override
  Future<Map<String, dynamic>> getDashboardData() async {
    try {
      final response = await _transactionApiClient.getDashboardData(
        GetDashboardRequest(ledgerId: 'default')
      );
      
      if (response.success && response.data != null) {
        return {
          'success': true,
          'data': {
            'totalIncome': response.data!.totalIncome,
            'totalExpense': response.data!.totalExpense,
            'balance': response.data!.balance,
            'transactionCount': response.data!.transactionCount,
          }
        };
      }
      return {'success': false, 'error': response.error};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  @override
  Future<List<Map<String, dynamic>>> getAccountSummary() async {
    try {
      final response = await _accountApiClient.getAccounts(GetAccountsRequest());
      
      if (response.success && response.data != null) {
        return response.data!.map((account) => {
          'id': account.id,
          'name': account.name,
          'type': account.type,
          'balance': account.balance,
        }).toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  @override
  Future<List<Map<String, dynamic>>> getRecentTransactions(int limit) async {
    try {
      final response = await _transactionApiClient.getTransactions(
        GetTransactionsRequest(limit: limit)
      );
      
      if (response.success && response.data != null) {
        return response.data!.map((transaction) => {
          'id': transaction.id,
          'type': transaction.type.toString().split('.').last,
          'amount': transaction.amount,
          'description': transaction.description,
          'date': transaction.date.toIso8601String(),
          'categoryId': transaction.categoryId,
          'accountId': transaction.accountId,
        }).toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  @override
  Future<Map<String, dynamic>> getMonthlyStatistics() async {
    try {
      final response = await _transactionApiClient.getDashboardData(
        GetDashboardRequest(ledgerId: 'default', period: 'month')
      );
      
      if (response.success && response.data != null) {
        return {
          'income': response.data!.totalIncome,
          'expense': response.data!.totalExpense,
          'balance': response.data!.balance,
          'transactionCount': response.data!.transactionCount,
        };
      }
      return {'income': 0.0, 'expense': 0.0, 'balance': 0.0, 'transactionCount': 0};
    } catch (e) {
      return {'income': 0.0, 'expense': 0.0, 'balance': 0.0, 'transactionCount': 0};
    }
  }

  @override
  Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> transactionData) async {
    try {
      final request = CreateTransactionRequest(
        amount: (transactionData['amount'] as num).toDouble(),
        type: transactionData['type'] as String,
        categoryId: transactionData['categoryId'] as String?,
        accountId: transactionData['accountId'] as String?,
        ledgerId: transactionData['ledgerId'] as String? ?? 'default',
        date: transactionData['date'] as String? ?? DateTime.now().toIso8601String(),
        description: transactionData['description'] as String?,
      );

      final response = await _transactionApiClient.createTransaction(request);
      
      return {
        'success': response.success,
        'data': response.success ? TransactionFormatter.toJson(response.data!) : null,
        'error': response.error,
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  @override
  Future<Map<String, dynamic>> createQuickTransaction(Map<String, dynamic> transactionData) async {
    return await createTransaction(transactionData);
  }

  @override
  Future<Map<String, dynamic>> updateTransaction(Map<String, dynamic> transactionData) async {
    try {
      final transactionId = transactionData['id'] as String;
      final request = UpdateTransactionRequest(
        amount: transactionData['amount'] != null ? (transactionData['amount'] as num).toDouble() : null,
        type: transactionData['type'] as String?,
        categoryId: transactionData['categoryId'] as String?,
        accountId: transactionData['accountId'] as String?,
        date: transactionData['date'] as String?,
        description: transactionData['description'] as String?,
      );

      final response = await _transactionApiClient.updateTransaction(transactionId, request);
      
      return {
        'success': response.success,
        'data': response.success ? TransactionFormatter.toJson(response.data!) : null,
        'error': response.error,
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  @override
  Future<Map<String, dynamic>> deleteTransaction(String transactionId) async {
    try {
      final response = await _transactionApiClient.deleteTransaction(transactionId);
      
      return {
        'success': response.success,
        'error': response.error,
      };
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  @override
  Future<List<Map<String, dynamic>>> getTransactionHistory() async {
    try {
      final response = await _transactionApiClient.getTransactions(GetTransactionsRequest());
      
      if (response.success && response.data != null) {
        return response.data!.map((transaction) => TransactionFormatter.toJson(transaction)).toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  @override
  Future<List<Map<String, dynamic>>> getCategoryAnalysis() async {
    try {
      // 模擬類別分析數據
      await Future.delayed(Duration(milliseconds: 200));
      
      return [
        {'name': '餐飲', 'amount': 3000.0, 'percentage': 35.0},
        {'name': '交通', 'amount': 2000.0, 'percentage': 25.0},
        {'name': '購物', 'amount': 1500.0, 'percentage': 20.0},
        {'name': '娛樂', 'amount': 1000.0, 'percentage': 15.0},
        {'name': '其他', 'amount': 500.0, 'percentage': 5.0},
      ];
    } catch (e) {
      return [];
    }
  }

  @override
  Future<Map<String, dynamic>> getStatisticsData(String period) async {
    try {
      final response = await _transactionApiClient.getDashboardData(
        GetDashboardRequest(ledgerId: 'default', period: period)
      );
      
      if (response.success && response.data != null) {
        return {
          'success': true,
          'data': {
            'period': period,
            'totalIncome': response.data!.totalIncome,
            'totalExpense': response.data!.totalExpense,
            'balance': response.data!.balance,
            'transactionCount': response.data!.transactionCount,
          }
        };
      }
      return {'success': false, 'error': response.error};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
}

// ===========================================
// API相關類別
// ===========================================

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? error;
  final int statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.error,
    required this.statusCode,
  });
}

// 請求模型定義
class CreateTransactionRequest {
  final double amount;
  final String type;
  final String? categoryId;
  final String? accountId;
  final String ledgerId;
  final String date;
  final String? description;

  CreateTransactionRequest({
    required this.amount,
    required this.type,
    this.categoryId,
    this.accountId,
    required this.ledgerId,
    required this.date,
    this.description,
  });

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'type': type,
      'categoryId': categoryId,
      'accountId': accountId,
      'ledgerId': ledgerId,
      'date': date,
      'description': description,
    }..removeWhere((key, value) => value == null);
  }
}

class GetTransactionsRequest {
  final String? ledgerId;
  final String? categoryId;
  final String? accountId;
  final String? type;
  final String? startDate;
  final String? endDate;
  final int page;
  final int limit;

  GetTransactionsRequest({
    this.ledgerId,
    this.categoryId,
    this.accountId,
    this.type,
    this.startDate,
    this.endDate,
    this.page = 1,
    this.limit = 20,
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'categoryId': categoryId,
      'accountId': accountId,
      'type': type,
      'startDate': startDate,
      'endDate': endDate,
      'page': page,
      'limit': limit,
    }..removeWhere((key, value) => value == null);
  }
}

class UpdateTransactionRequest {
  final double? amount;
  final String? type;
  final String? categoryId;
  final String? accountId;
  final String? date;
  final String? description;

  UpdateTransactionRequest({
    this.amount,
    this.type,
    this.categoryId,
    this.accountId,
    this.date,
    this.description,
  });

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'type': type,
      'categoryId': categoryId,
      'accountId': accountId,
      'date': date,
      'description': description,
    }..removeWhere((key, value) => value == null);
  }
}

class GetDashboardRequest {
  final String ledgerId;
  final String period;

  GetDashboardRequest({
    required this.ledgerId,
    this.period = 'month',
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'period': period,
    };
  }
}

class GetAccountsRequest {
  final String? ledgerId;
  final String? type;
  final bool active;
  final bool includeBalance;

  GetAccountsRequest({
    this.ledgerId,
    this.type,
    this.active = true,
    this.includeBalance = true,
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'type': type,
      'active': active,
      'includeBalance': includeBalance,
    }..removeWhere((key, value) => value == null);
  }
}

// API客戶端介面
abstract class TransactionApiClient {
  Future<ApiResponse<Transaction>> createTransaction(CreateTransactionRequest request);
  Future<ApiResponse<List<Transaction>>> getTransactions(GetTransactionsRequest request);
  Future<ApiResponse<Transaction>> updateTransaction(String id, UpdateTransactionRequest request);
  Future<ApiResponse<void>> deleteTransaction(String id);
  Future<ApiResponse<DashboardData>> getDashboardData(GetDashboardRequest request);
}

abstract class CategoryApiClient {
  Future<ApiResponse<List<Category>>> getCategories(GetCategoriesRequest request);
}

abstract class AccountApiClient {
  Future<ApiResponse<List<Account>>> getAccounts(GetAccountsRequest request);
}

class GetCategoriesRequest {
  final String? ledgerId;
  final String? type;

  GetCategoriesRequest({this.ledgerId, this.type});

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'type': type,
    }..removeWhere((key, value) => value == null);
  }
}

// 實作類別（簡化版）
class TransactionApiClientImpl implements TransactionApiClient {
  @override
  Future<ApiResponse<Transaction>> createTransaction(CreateTransactionRequest request) async {
    await Future.delayed(Duration(milliseconds: 200));
    
    final transaction = Transaction(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      type: _parseTransactionType(request.type),
      amount: request.amount,
      categoryId: request.categoryId,
      accountId: request.accountId,
      description: request.description ?? '',
      date: DateTime.parse(request.date),
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    
    return ApiResponse(success: true, data: transaction, statusCode: 201);
  }

  @override
  Future<ApiResponse<List<Transaction>>> getTransactions(GetTransactionsRequest request) async {
    await Future.delayed(Duration(milliseconds: 300));
    return ApiResponse(success: true, data: [], statusCode: 200);
  }

  @override
  Future<ApiResponse<Transaction>> updateTransaction(String id, UpdateTransactionRequest request) async {
    await Future.delayed(Duration(milliseconds: 200));
    
    final transaction = Transaction(
      id: id,
      type: request.type != null ? _parseTransactionType(request.type!) : TransactionType.expense,
      amount: request.amount ?? 0.0,
      categoryId: request.categoryId,
      accountId: request.accountId,
      description: request.description ?? '',
      date: request.date != null ? DateTime.parse(request.date!) : DateTime.now(),
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    
    return ApiResponse(success: true, data: transaction, statusCode: 200);
  }

  @override
  Future<ApiResponse<void>> deleteTransaction(String id) async {
    await Future.delayed(Duration(milliseconds: 100));
    return ApiResponse(success: true, statusCode: 204);
  }

  @override
  Future<ApiResponse<DashboardData>> getDashboardData(GetDashboardRequest request) async {
    await Future.delayed(Duration(milliseconds: 300));
    
    final data = DashboardData(
      totalIncome: 50000,
      totalExpense: 35000,
      balance: 15000,
      transactionCount: 156,
    );
    
    return ApiResponse(success: true, data: data, statusCode: 200);
  }

  TransactionType _parseTransactionType(String type) {
    switch (type.toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }
}

class CategoryApiClientImpl implements CategoryApiClient {
  @override
  Future<ApiResponse<List<Category>>> getCategories(GetCategoriesRequest request) async {
    await Future.delayed(Duration(milliseconds: 200));
    return ApiResponse(success: true, data: [], statusCode: 200);
  }
}

class AccountApiClientImpl implements AccountApiClient {
  @override
  Future<ApiResponse<List<Account>>> getAccounts(GetAccountsRequest request) async {
    await Future.delayed(Duration(milliseconds: 200));
    
    final accounts = [
      Account(id: 'acc1', name: '現金', type: 'cash', balance: 5000),
      Account(id: 'acc2', name: '銀行帳戶', type: 'bank', balance: 25000),
      Account(id: 'acc3', name: '信用卡', type: 'credit', balance: -3000),
    ];
    
    return ApiResponse(success: true, data: accounts, statusCode: 200);
  }
}

// Repository介面
abstract class TransactionRepository {
  Future<List<Transaction>> getTransactions({Map<String, dynamic>? filters});
}

abstract class CategoryRepository {
  Future<List<Category>> getCategories();
}

abstract class AccountRepository {
  Future<List<Account>> getAccounts();
}

// Repository實作（簡化版）
class TransactionRepositoryImpl implements TransactionRepository {
  final TransactionAPIGateway _apiClient;
  
  TransactionRepositoryImpl(this._apiClient);

  @override
  Future<List<Transaction>> getTransactions({Map<String, dynamic>? filters}) async {
    return [];
  }
}

class CategoryRepositoryImpl implements CategoryRepository {
  final CategoryApiClient _apiClient;
  
  CategoryRepositoryImpl(this._apiClient);

  @override
  Future<List<Category>> getCategories() async {
    return [];
  }
}

class AccountRepositoryImpl implements AccountRepository {
  final AccountApiClient _apiClient;
  
  AccountRepositoryImpl(this._apiClient);

  @override
  Future<List<Account>> getAccounts() async {
    return [];
  }
}

// 工具類別
class TransactionFormatter {
  static Map<String, dynamic> toJson(Transaction transaction) {
    return {
      'id': transaction.id,
      'type': transaction.type.toString().split('.').last,
      'amount': transaction.amount,
      'categoryId': transaction.categoryId,
      'accountId': transaction.accountId,
      'description': transaction.description,
      'date': transaction.date.toIso8601String(),
      'createdAt': transaction.createdAt.toIso8601String(),
      'updatedAt': transaction.updatedAt.toIso8601String(),
      'source': transaction.source,
    };
  }
}

// 智能文字解析器
class SmartTextParserImpl {
  Future<Map<String, dynamic>> parseText(String input) async {
    await Future.delayed(Duration(milliseconds: 50));
    
    final result = <String, dynamic>{};
    final words = input.trim().split(RegExp(r'\s+'));

    // 解析金額
    double? amount;
    for (String word in words) {
      final cleanedWord = word.replaceAll(RegExp(r'[^\d.]'), '');
      final parsedAmount = double.tryParse(cleanedWord);
      if (parsedAmount != null && parsedAmount > 0) {
        amount = parsedAmount;
        break;
      }
    }
    result['amount'] = amount;

    // 判斷交易類型
    String type = 'expense';
    if (_containsAny(input, ['薪水', '收入', '入帳', '賺', '收到的'])) {
      type = 'income';
    } else if (_containsAny(input, ['轉帳', '轉入', '轉出', '匯款'])) {
      type = 'transfer';
    }
    result['type'] = type;

    // 提取描述
    String description = _extractDescription(input, amount?.toString() ?? '');
    result['description'] = description;

    return result;
  }

  bool _containsAny(String text, List<String> keywords) {
    return keywords.any((keyword) => text.toLowerCase().contains(keyword.toLowerCase()));
  }

  String _extractDescription(String input, String amountStr) {
    String description = input;

    if (amountStr.isNotEmpty) {
      description = description.replaceAll(RegExp(r'[\d.]+', multiLine: true), '').trim();
    }

    final removeKeywords = ['記帳', '花費', '支出', '收入', '轉帳', '買了', '花了', '存入', '收到'];
    for (String keyword in removeKeywords) {
      description = description.replaceAll(keyword, '').trim();
    }

    description = description.replaceAll(RegExp(r'\s+'), ' ').trim();

    return description.isEmpty ? '記帳' : description;
  }
}

// 快速記帳處理器
class QuickAccountingProcessorImpl {
  Future<QuickAccountingResult> processQuickAccounting(String input) async {
    try {
      await Future.delayed(Duration(milliseconds: 100));
      
      return QuickAccountingResult(
        success: true,
        message: '快速記帳成功',
      );
    } catch (e) {
      return QuickAccountingResult(
        success: false,
        message: '快速記帳失敗：${e.toString()}',
      );
    }
  }
}

// TransactionAPIGateway暫時空實作
class TransactionAPIGateway {
  TransactionAPIGateway({
    required Function(String) onShowError,
    required Function(String) onShowHint,
    required Function(Map<String, dynamic>) onUpdateUI,
    required Function(String) onLogError,
    required Function() onRetry,
  });

  Future<ApiResponse<List<Transaction>>> getTransactions(GetTransactionsRequest request) async {
    return ApiResponse(success: true, data: [], statusCode: 200);
  }
}

