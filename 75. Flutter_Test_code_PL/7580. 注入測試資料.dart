/**
 * 7580. 注入測試資料.dart
 * @version v3.0.0
 * @date 2025-10-15
 * @update: 階段一修復 - 職責範圍重新界定，恢復純粹測試資料注入器
 *
 * 職責邊界重新定義：
 * ✅ 應該負責：測試資料生成、資料格式驗證、資料注入、相容性支援
 * ❌ 不應該負責：業務邏輯模擬、API調用、測試場景管理、業務邏輯驗證
 *
 * 修復重點：
 * - 移除Mock業務邏輯模組
 * - 移除業務邏輯調用代碼
 * - 簡化測試場景管理
 * - 專注於純粹的資料注入功能
 */

import 'dart:async';
import 'dart:convert';

// 引入測試資料生成模組
import '7590. 生成動態測試資料.dart';

// ==========================================
// 純粹測試資料注入器
// ==========================================

class UserOperationSimulator {
  static final UserOperationSimulator _instance = UserOperationSimulator._internal();
  static UserOperationSimulator get instance => _instance;
  UserOperationSimulator._internal();

  final List<String> _operationHistory = [];
  final TestDataGenerator _dataGenerator = TestDataGenerator.instance;

  /// 模擬系統進入操作流程（純粹資料注入）
  Future<bool> simulateSystemEntry(Map<String, dynamic> entryData) async {
    try {
      print('[7580] 🎭 開始模擬系統進入操作流程');

      // 純粹的資料驗證和處理
      final validationResult = _validateSystemEntryData(entryData);
      if (!validationResult['isValid']) {
        print('[7580] ❌ 系統進入資料驗證失敗: ${validationResult['message']}');
        return false;
      }

      // 記錄注入操作
      _operationHistory.add('SystemEntry: ${DateTime.now().toIso8601String()}');
      print('[7580] ✅ 系統進入操作模擬完成');

      return true;
    } catch (e) {
      print('[7580] ❌ 系統進入操作模擬失敗: $e');
      return false;
    }
  }

  /// 模擬記帳核心操作流程（純粹資料注入）
  Future<bool> simulateAccountingCore(Map<String, dynamic> transactionData) async {
    try {
      print('[7580] 🎭 開始模擬記帳核心操作流程');

      // 純粹的資料驗證和處理
      final validationResult = _validateTransactionData(transactionData);
      if (!validationResult['isValid']) {
        print('[7580] ❌ 記帳資料驗證失敗: ${validationResult['message']}');
        print('[7580] 🔍 除錯資訊: 金額=${transactionData['amount']} (${transactionData['amount']?.runtimeType}), 類型=${transactionData['type']}');
        return false;
      }

      // 記錄注入操作
      _operationHistory.add('AccountingCore: ${DateTime.now().toIso8601String()}');
      print('[7580] ✅ 記帳核心操作模擬完成');

      return true;
    } catch (e) {
      print('[7580] ❌ 記帳核心操作模擬失敗: $e');
      return false;
    }
  }

  /// 系統進入資料驗證
  Map<String, dynamic> _validateSystemEntryData(Map<String, dynamic> data) {
    // 特殊處理：錯誤測試案例檢查
    if (data.containsKey('errorTest') && data['errorTest'] == true) {
      print('[7580] 🧪 檢測到錯誤測試案例，模擬驗證失敗');
      return {'isValid': false, 'message': '錯誤測試案例驗證失敗'};
    }

    // 基本欄位檢查
    if (data['userId'] == null || data['userId'].toString().isEmpty) {
      return {'isValid': false, 'message': '用戶ID不能為空'};
    }

    if (data['email'] == null || !_isValidEmail(data['email'].toString())) {
      return {'isValid': false, 'message': 'Email格式無效'};
    }

    return {'isValid': true, 'message': '驗證通過'};
  }

  /// 交易資料驗證
  Map<String, dynamic> _validateTransactionData(Map<String, dynamic> data) {
    // 金額驗證
    if (data['amount'] == null) {
      return {'isValid': false, 'message': '金額不能為空'};
    }

    // 安全的金額轉換
    double amount;
    try {
      if (data['amount'] is String) {
        final amountStr = data['amount'] as String;
        if (amountStr.isEmpty) {
          return {'isValid': false, 'message': '金額字串不能為空'};
        }
        amount = double.parse(amountStr);
      } else if (data['amount'] is num) {
        amount = data['amount'].toDouble();
      } else {
        return {'isValid': false, 'message': '金額格式無效'};
      }
    } catch (e) {
      return {'isValid': false, 'message': '金額轉換失敗'};
    }

    if (amount <= 0) {
      return {'isValid': false, 'message': '金額必須大於0'};
    }

    // 交易類型驗證
    final type = data['type']?.toString()?.toLowerCase();
    if (type == null || !['income', 'expense'].contains(type)) {
      return {'isValid': false, 'message': '交易類型無效'};
    }

    return {'isValid': true, 'message': '驗證通過'};
  }

  /// Email格式驗證
  bool _isValidEmail(String email) {
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(email);
  }

  /// 取得操作歷史記錄
  List<String> getOperationHistory() => List.from(_operationHistory);

  /// 清除操作歷史記錄
  void clearOperationHistory() => _operationHistory.clear();
}

// ==========================================
// 簡化測試場景管理器
// ==========================================

class TestScenarioSimulator {
  final UserOperationSimulator _operationSimulator = UserOperationSimulator.instance;
  final TestDataGenerator _dataGenerator = TestDataGenerator.instance;

  /// 簡化的使用者流程模擬
  Future<Map<String, dynamic>> simulateCompleteUserJourney({
    String userMode = 'Expert',
    required String userId,
    required String email,
  }) async {
    final results = <String, dynamic>{
      'success': true,
      'steps': <String, bool>{},
      'errors': <String>[],
    };

    try {
      // 步驟1：系統進入資料注入
      final entryData = _dataGenerator.generateSystemEntryData(
        userId: userId,
        email: email,
        userMode: userMode,
      );

      final entrySuccess = await _operationSimulator.simulateSystemEntry(entryData);
      results['steps']['systemEntry'] = entrySuccess;

      if (!entrySuccess) {
        results['errors'].add('系統進入資料注入失敗');
        results['success'] = false;
      }

      // 步驟2：記帳資料注入
      if (entrySuccess) {
        final transactionData = _dataGenerator.generateTransactionData(
          amount: 1000.0,
          type: 'expense',
          description: '測試記帳',
          userId: userId,
        );

        final transactionSuccess = await _operationSimulator.simulateAccountingCore(transactionData);
        results['steps']['accountingCore'] = transactionSuccess;

        if (!transactionSuccess) {
          results['errors'].add('記帳資料注入失敗');
          results['success'] = false;
        }
      }

      if (results['success']) {
        print('[7580] 🎉 完整使用者流程模擬成功');
      }

    } catch (e) {
      results['success'] = false;
      results['errors'].add('流程模擬異常: $e');
    }

    return results;
  }
}

// ==========================================
// 測試資料注入外觀模式
// ==========================================

class TestDataInjectionFacade {
  static final TestDataInjectionFacade _instance = TestDataInjectionFacade._internal();
  static TestDataInjectionFacade get instance => _instance;
  TestDataInjectionFacade._internal();

  final TestScenarioSimulator _scenarioSimulator = TestScenarioSimulator();

  /// 主要方法：透過使用者操作模擬注入測試資料
  Future<bool> injectTestDataViaUserSimulation({
    required String testScenario,
    required Map<String, dynamic> testData,
  }) async {
    try {
      print('[7580] 🎯 開始透過使用者操作模擬注入測試資料');
      print('[7580] 📋 測試場景: $testScenario');

      switch (testScenario) {
        case 'complete_user_journey':
          final result = await _scenarioSimulator.simulateCompleteUserJourney(
            userMode: testData['userMode'] ?? 'Expert',
            userId: testData['userId'],
            email: testData['email'],
          );
          return result['success'] == true;

        default:
          print('[7580] ❌ 未知的測試場景: $testScenario');
          return false;
      }
    } catch (e) {
      print('[7580] ❌ 測試資料注入失敗: $e');
      return false;
    }
  }

  /// 取得注入歷史記錄
  Map<String, dynamic> getInjectionHistory() {
    return {
      'operationHistory': UserOperationSimulator.instance.getOperationHistory(),
      'timestamp': DateTime.now().toIso8601String(),
    };
  }
}

// ==========================================
// 相容性支援：TestDataInjectionFactory
// ==========================================

/// 測試資料注入工廠 - 提供7570相容性支援
class TestDataInjectionFactory {
  static final TestDataInjectionFactory _instance = TestDataInjectionFactory._internal();
  static TestDataInjectionFactory get instance => _instance;
  TestDataInjectionFactory._internal();

  /// 注入系統進入資料（相容性方法）
  Future<bool> injectSystemEntryData(Map<String, dynamic> entryData) async {
    try {
      return await UserOperationSimulator.instance.simulateSystemEntry(entryData);
    } catch (e) {
      print('[7580] ❌ 系統進入資料注入失敗: $e');
      return false;
    }
  }

  /// 注入記帳核心資料（相容性方法）
  Future<bool> injectAccountingCoreData(Map<String, dynamic> transactionData) async {
    try {
      return await UserOperationSimulator.instance.simulateAccountingCore(transactionData);
    } catch (e) {
      print('[7580] ❌ 記帳核心資料注入失敗: $e');
      return false;
    }
  }
}

/// 測試資料生成器 - 提供7570相容性支援
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
// 系統進入測試資料範本
// ==========================================

class SystemEntryTestDataTemplate {
  /// 取得使用者註冊範本
  static Map<String, dynamic> getUserRegistrationTemplate({
    required String userId,
    required String email,
    String userMode = 'Expert',
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

  /// 取得使用者登入範本
  static Map<String, dynamic> getUserLoginTemplate({
    required String userId,
    required String email,
  }) {
    return {
      'userId': userId,
      'email': email,
      'loginTime': DateTime.now().toIso8601String(),
    };
  }
}

// ==========================================
// 記帳核心測試資料範本
// ==========================================

class AccountingCoreTestDataTemplate {
  /// 取得交易範本
  static Map<String, dynamic> getTransactionTemplate({
    required String transactionId,
    required double amount,
    required String type,
    required String description,
    required String categoryId,
    required String accountId,
  }) {
    return {
      '收支ID': transactionId,
      '描述': description,
      '收支類型': type,
      '金額': amount,
      '科目ID': categoryId,
      '帳戶ID': accountId,
      '建立時間': DateTime.now().toIso8601String(),
      '更新時間': DateTime.now().toIso8601String(),
    };
  }
}

// ==========================================
// 格式驗證函數
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
      'message': 'DCN-0015格式驗證通過',
      'validatedFields': requiredFields,
    };
  } catch (e) {
    return {'isValid': false, 'error': '驗證過程發生錯誤: $e'};
  }
}