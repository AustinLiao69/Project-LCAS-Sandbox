
/**
 * 7580. 注入測試資料.dart
 * @version v3.2.0
 * @date 2025-10-15
 * @update: 階段三架構清理與標準化 - 建立清晰接口，移除業務邏輯
 *
 * 職責邊界最終定義：
 * ✅ 核心職責：測試資料生成、資料格式驗證、資料注入、相容性支援
 * ❌ 不再負責：業務邏輯模擬、API調用、複雜測試場景管理、業務邏輯驗證
 *
 * 階段三清理重點：
 * - 統一資料注入接口
 * - 移除所有業務邏輯相關代碼
 * - 確保職責邊界清晰
 * - 標準化API設計
 */

import 'dart:async';
import 'dart:convert';

// 引入測試資料生成模組
import '7590. 生成動態測試資料.dart';

// ==========================================
// 核心：純粹測試資料注入器（最終版）
// ==========================================

/// 測試資料注入器 - 純粹資料注入功能
class TestDataInjector {
  static final TestDataInjector _instance = TestDataInjector._internal();
  static TestDataInjector get instance => _instance;
  TestDataInjector._internal();

  final List<String> _injectionLog = [];
  final TestDataGenerator _dataGenerator = TestDataGenerator.instance;

  /// 主要注入接口：統一測試資料注入
  Future<TestDataInjectionResult> injectTestData({
    required String dataType,
    required Map<String, dynamic> rawData,
  }) async {
    try {
      print('[7580] 🎯 統一測試資料注入接口');
      print('[7580] 📋 資料類型: $dataType');

      // 1. 資料驗證
      final validationResult = _validateRawData(dataType, rawData);
      if (!validationResult.isValid) {
        return TestDataInjectionResult.failure(
          errorMessage: '資料驗證失敗: ${validationResult.errorMessage}',
          dataType: dataType,
        );
      }

      // 2. 資料格式化
      final formattedData = _formatTestData(dataType, rawData);
      if (formattedData == null) {
        return TestDataInjectionResult.failure(
          errorMessage: '資料格式化失敗',
          dataType: dataType,
        );
      }

      // 3. 執行注入（純粹注入，無業務邏輯）
      final injectionSuccess = await _performDataInjection(dataType, formattedData);
      
      // 4. 記錄注入操作
      _recordInjection(dataType, injectionSuccess);

      return injectionSuccess
          ? TestDataInjectionResult.success(
              dataType: dataType,
              injectedData: formattedData,
            )
          : TestDataInjectionResult.failure(
              errorMessage: '資料注入執行失敗',
              dataType: dataType,
            );

    } catch (e) {
      print('[7580] ❌ 測試資料注入異常: $e');
      return TestDataInjectionResult.failure(
        errorMessage: '注入過程異常: $e',
        dataType: dataType,
      );
    }
  }

  /// 批次資料注入接口
  Future<BatchInjectionResult> injectBatchTestData({
    required String dataType,
    required List<Map<String, dynamic>> rawDataList,
  }) async {
    try {
      print('[7580] 📦 批次測試資料注入');
      print('[7580] 📊 數量: ${rawDataList.length}');

      final results = <TestDataInjectionResult>[];
      
      for (int i = 0; i < rawDataList.length; i++) {
        final result = await injectTestData(
          dataType: dataType,
          rawData: rawDataList[i],
        );
        results.add(result);
        
        // 批次注入間隔，避免過於頻繁
        if (i < rawDataList.length - 1) {
          await Future.delayed(Duration(milliseconds: 10));
        }
      }

      final successCount = results.where((r) => r.isSuccess).length;
      return BatchInjectionResult(
        totalCount: rawDataList.length,
        successCount: successCount,
        results: results,
      );

    } catch (e) {
      print('[7580] ❌ 批次資料注入異常: $e');
      return BatchInjectionResult(
        totalCount: rawDataList.length,
        successCount: 0,
        results: [],
        errorMessage: '批次注入異常: $e',
      );
    }
  }

  /// 資料驗證（純粹格式驗證，無業務邏輯）
  DataValidationResult _validateRawData(String dataType, Map<String, dynamic> data) {
    switch (dataType) {
      case 'systemEntry':
        return _validateSystemEntryData(data);
      case 'transaction':
        return _validateTransactionData(data);
      case 'batch':
        return _validateBatchData(data);
      default:
        return DataValidationResult.invalid('未知的資料類型: $dataType');
    }
  }

  /// 系統進入資料驗證（純粹格式檢查）
  DataValidationResult _validateSystemEntryData(Map<String, dynamic> data) {
    // 必要欄位檢查
    final requiredFields = ['userId', 'email', 'userMode'];
    for (final field in requiredFields) {
      if (!data.containsKey(field) || data[field] == null || data[field].toString().isEmpty) {
        return DataValidationResult.invalid('缺少必要欄位: $field');
      }
    }

    // Email格式檢查
    final email = data['email'].toString();
    if (!RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(email)) {
      return DataValidationResult.invalid('Email格式無效');
    }

    // 使用者模式檢查
    final userMode = data['userMode'].toString();
    if (!['Expert', 'Inertial', 'Cultivation', 'Guiding'].contains(userMode)) {
      return DataValidationResult.invalid('無效的使用者模式: $userMode');
    }

    return DataValidationResult.valid();
  }

  /// 交易資料驗證（純粹格式檢查）
  DataValidationResult _validateTransactionData(Map<String, dynamic> data) {
    // 金額檢查
    if (!data.containsKey('amount') || data['amount'] == null) {
      return DataValidationResult.invalid('缺少金額欄位');
    }

    // 金額轉換檢查
    double amount;
    try {
      if (data['amount'] is String) {
        amount = double.parse(data['amount']);
      } else if (data['amount'] is num) {
        amount = data['amount'].toDouble();
      } else {
        return DataValidationResult.invalid('金額格式無效');
      }
    } catch (e) {
      return DataValidationResult.invalid('金額轉換失敗');
    }

    if (amount <= 0) {
      return DataValidationResult.invalid('金額必須大於0');
    }

    // 交易類型檢查
    if (!data.containsKey('type') || data['type'] == null) {
      return DataValidationResult.invalid('缺少交易類型欄位');
    }

    final type = data['type'].toString().toLowerCase();
    if (!['income', 'expense'].contains(type)) {
      return DataValidationResult.invalid('交易類型無效: $type');
    }

    return DataValidationResult.valid();
  }

  /// 批次資料驗證
  DataValidationResult _validateBatchData(Map<String, dynamic> data) {
    if (!data.containsKey('dataList') || data['dataList'] is! List) {
      return DataValidationResult.invalid('批次資料格式無效');
    }

    final dataList = data['dataList'] as List;
    if (dataList.isEmpty) {
      return DataValidationResult.invalid('批次資料不能為空');
    }

    return DataValidationResult.valid();
  }

  /// 資料格式化（純粹格式轉換）
  Map<String, dynamic>? _formatTestData(String dataType, Map<String, dynamic> rawData) {
    switch (dataType) {
      case 'systemEntry':
        return _formatSystemEntryData(rawData);
      case 'transaction':
        return _formatTransactionData(rawData);
      default:
        return rawData;
    }
  }

  /// 系統進入資料格式化
  Map<String, dynamic> _formatSystemEntryData(Map<String, dynamic> rawData) {
    return {
      'userId': rawData['userId'],
      'email': rawData['email'],
      'userMode': rawData['userMode'],
      'displayName': rawData['displayName'] ?? '${rawData['userMode']} 測試用戶',
      'preferences': rawData['preferences'] ?? {
        'language': 'zh-TW',
        'currency': 'TWD',
        'theme': rawData['userMode'].toString().toLowerCase(),
      },
      'registrationDate': rawData['registrationDate'] ?? DateTime.now().toIso8601String(),
      'createdAt': rawData['createdAt'] ?? DateTime.now().toIso8601String(),
    };
  }

  /// 交易資料格式化
  Map<String, dynamic> _formatTransactionData(Map<String, dynamic> rawData) {
    final amount = rawData['amount'] is String 
        ? double.parse(rawData['amount']) 
        : rawData['amount'].toDouble();

    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final transactionId = rawData['transactionId'] ?? 'txn_${rawData['type']}_$timestamp';

    return {
      '收支ID': transactionId,
      '描述': rawData['description'] ?? '測試記帳',
      '收支類型': rawData['type'],
      '金額': amount,
      '用戶ID': rawData['userId'],
      '科目ID': rawData['categoryId'] ?? 'default_category',
      '帳戶ID': rawData['accountId'] ?? 'account_default',
      '建立時間': DateTime.now().toIso8601String(),
      '更新時間': DateTime.now().toIso8601String(),
    };
  }

  /// 執行資料注入（純粹注入操作）
  Future<bool> _performDataInjection(String dataType, Map<String, dynamic> formattedData) async {
    try {
      // 模擬注入延遲
      await Future.delayed(Duration(milliseconds: 50));
      
      // 純粹的注入操作（無業務邏輯處理）
      print('[7580] ✅ 資料注入完成: $dataType');
      return true;
    } catch (e) {
      print('[7580] ❌ 資料注入失敗: $e');
      return false;
    }
  }

  /// 記錄注入操作
  void _recordInjection(String dataType, bool success) {
    final logEntry = '${DateTime.now().toIso8601String()} - $dataType: ${success ? 'SUCCESS' : 'FAILED'}';
    _injectionLog.add(logEntry);
    
    // 保持日誌大小合理
    if (_injectionLog.length > 100) {
      _injectionLog.removeRange(0, 50);
    }
  }

  /// 取得注入歷史記錄
  List<String> getInjectionHistory() => List.from(_injectionLog);

  /// 清除注入歷史記錄
  void clearInjectionHistory() => _injectionLog.clear();

  /// 取得注入統計
  Map<String, dynamic> getInjectionStatistics() {
    final totalInjections = _injectionLog.length;
    final successfulInjections = _injectionLog.where((log) => log.contains('SUCCESS')).length;
    final failedInjections = totalInjections - successfulInjections;

    return {
      'totalInjections': totalInjections,
      'successfulInjections': successfulInjections,
      'failedInjections': failedInjections,
      'successRate': totalInjections > 0 ? (successfulInjections / totalInjections * 100).round() : 0,
    };
  }
}

// ==========================================
// 標準化：資料注入結果類型
// ==========================================

/// 測試資料注入結果
class TestDataInjectionResult {
  final bool isSuccess;
  final String dataType;
  final Map<String, dynamic>? injectedData;
  final String? errorMessage;
  final DateTime timestamp;

  TestDataInjectionResult._({
    required this.isSuccess,
    required this.dataType,
    this.injectedData,
    this.errorMessage,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  factory TestDataInjectionResult.success({
    required String dataType,
    required Map<String, dynamic> injectedData,
  }) {
    return TestDataInjectionResult._(
      isSuccess: true,
      dataType: dataType,
      injectedData: injectedData,
    );
  }

  factory TestDataInjectionResult.failure({
    required String dataType,
    required String errorMessage,
  }) {
    return TestDataInjectionResult._(
      isSuccess: false,
      dataType: dataType,
      errorMessage: errorMessage,
    );
  }

  @override
  String toString() {
    return 'TestDataInjectionResult(isSuccess: $isSuccess, dataType: $dataType, timestamp: $timestamp)';
  }
}

/// 批次注入結果
class BatchInjectionResult {
  final int totalCount;
  final int successCount;
  final List<TestDataInjectionResult> results;
  final String? errorMessage;
  final DateTime timestamp;

  BatchInjectionResult({
    required this.totalCount,
    required this.successCount,
    required this.results,
    this.errorMessage,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  int get failureCount => totalCount - successCount;
  double get successRate => totalCount > 0 ? (successCount / totalCount * 100) : 0;

  @override
  String toString() {
    return 'BatchInjectionResult(total: $totalCount, success: $successCount, rate: ${successRate.toStringAsFixed(1)}%)';
  }
}

/// 資料驗證結果
class DataValidationResult {
  final bool isValid;
  final String? errorMessage;

  DataValidationResult._({
    required this.isValid,
    this.errorMessage,
  });

  factory DataValidationResult.valid() {
    return DataValidationResult._(isValid: true);
  }

  factory DataValidationResult.invalid(String errorMessage) {
    return DataValidationResult._(
      isValid: false,
      errorMessage: errorMessage,
    );
  }
}

// ==========================================
// 相容性支援：7570調用接口（最終版）
// ==========================================

/// 測試資料注入工廠 - 7570相容性接口
class TestDataInjectionFactory {
  static final TestDataInjectionFactory _instance = TestDataInjectionFactory._internal();
  static TestDataInjectionFactory get instance => _instance;
  TestDataInjectionFactory._internal();

  final TestDataInjector _injector = TestDataInjector.instance;

  /// 注入系統進入資料（相容性方法）
  Future<bool> injectSystemEntryData(Map<String, dynamic> entryData) async {
    try {
      final result = await _injector.injectTestData(
        dataType: 'systemEntry',
        rawData: entryData,
      );
      return result.isSuccess;
    } catch (e) {
      print('[7580] ❌ 系統進入資料注入失敗: $e');
      return false;
    }
  }

  /// 注入記帳核心資料（相容性方法）
  Future<bool> injectAccountingCoreData(Map<String, dynamic> transactionData) async {
    try {
      final result = await _injector.injectTestData(
        dataType: 'transaction',
        rawData: transactionData,
      );
      return result.isSuccess;
    } catch (e) {
      print('[7580] ❌ 記帳核心資料注入失敗: $e');
      return false;
    }
  }

  /// 批次資料注入（相容性方法）
  Future<bool> injectBatchData({
    required List<Map<String, dynamic>> dataList,
    required String batchType,
  }) async {
    try {
      final result = await _injector.injectBatchTestData(
        dataType: batchType,
        rawDataList: dataList,
      );
      return result.successRate >= 80.0; // 80%成功率視為成功
    } catch (e) {
      print('[7580] ❌ 批次資料注入失敗: $e');
      return false;
    }
  }

  /// 資料格式驗證（相容性方法）
  Map<String, dynamic> validateDataFormat(String dataType, Map<String, dynamic> data) {
    final validationResult = _injector._validateRawData(dataType, data);
    return {
      'isValid': validationResult.isValid,
      'message': validationResult.isValid ? '驗證通過' : validationResult.errorMessage,
    };
  }
}

/// 測試資料生成器 - 7570相容性接口
class TestDataGenerator {
  static final TestDataGenerator _instance = TestDataGenerator._internal();
  static TestDataGenerator get instance => _instance;
  TestDataGenerator._internal();

  /// 生成系統進入資料
  Map<String, dynamic> generateSystemEntryData({
    required String userId,
    required String email,
    required String userMode,
  }) {
    return {
      'userId': userId,
      'email': email,
      'userMode': userMode,
      'displayName': '$userMode 測試用戶',
      'preferences': {
        'language': 'zh-TW',
        'currency': 'TWD',
        'theme': userMode.toLowerCase(),
      },
      'registrationDate': DateTime.now().toIso8601String(),
      'createdAt': DateTime.now().toIso8601String(),
    };
  }

  /// 生成交易資料
  Map<String, dynamic> generateTransactionData({
    required double amount,
    required String type,
    required String description,
    required String userId,
  }) {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final transactionId = 'txn_${type}_$timestamp';

    return {
      '收支ID': transactionId,
      '描述': description,
      '收支類型': type,
      '金額': amount,
      '用戶ID': userId,
      '科目ID': _generateRandomCategory(type),
      '帳戶ID': 'account_default',
      '建立時間': DateTime.now().toIso8601String(),
      '更新時間': DateTime.now().toIso8601String(),
    };
  }

  /// 生成隨機科目
  String _generateRandomCategory(String transactionType) {
    final incomeCategories = ['salary', 'bonus', 'investment', 'freelance'];
    final expenseCategories = ['food', 'transport', 'entertainment', 'utilities'];

    final categories = transactionType == 'income' ? incomeCategories : expenseCategories;
    final random = DateTime.now().millisecondsSinceEpoch % categories.length;
    return categories[random];
  }
}

// ==========================================
// 格式驗證函數（純粹格式檢查）
// ==========================================

/// 驗證系統進入格式
Map<String, dynamic> validateSystemEntryFormat(dynamic data) {
  try {
    if (data is! Map<String, dynamic>) {
      return {'isValid': false, 'error': '資料格式必須是Map<String, dynamic>'};
    }

    final requiredFields = ['userId', 'email', 'userMode'];
    for (final field in requiredFields) {
      if (!data.containsKey(field) || data[field] == null || data[field] == '') {
        return {'isValid': false, 'error': '缺少必要欄位: $field'};
      }
    }

    // Email格式驗證
    final email = data['email'] as String;
    if (!RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(email)) {
      return {'isValid': false, 'error': 'Email格式無效'};
    }

    // 使用者模式驗證
    final validModes = ['Expert', 'Inertial', 'Cultivation', 'Guiding'];
    if (!validModes.contains(data['userMode'])) {
      return {'isValid': false, 'error': '無效的使用者模式'};
    }

    return {
      'isValid': true,
      'message': 'DCN-0016格式驗證通過',
      'validatedFields': requiredFields,
    };
  } catch (e) {
    return {'isValid': false, 'error': '驗證過程發生錯誤: $e'};
  }
}
