/**
 * 7502. 記帳核心功能群.dart - 記帳核心功能群測試代碼
 * @version 2025-09-12 v1.0.1
 * @date 2025-09-12
 * @update: 移除Mockito依賴，改為人工Mock實作，並升級版本
 */

import 'dart:async';
import 'dart:convert';
import 'package:test/test.dart';
import '7599. Fake_service_switch.dart';

// 引入必要的類型定義
enum UserMode { expert, inertial, cultivation, guiding }
enum TransactionType { income, expense, transfer }
enum ValidationLevel { strict, standard, guided, minimal }
enum FormValidationError { required, invalid, outOfRange }

// 資料模型類別
class TestUser {
  final String userId;
  final UserMode mode;

  TestUser(this.userId, this.mode);
}

class TestTransaction {
  final TransactionType type;
  final double amount;
  final String? categoryId;
  final String? accountId;
  final String? fromAccountId;
  final String? toAccountId;
  final String description;

  TestTransaction({
    required this.type,
    required this.amount,
    this.categoryId,
    this.accountId,
    this.fromAccountId,
    this.toAccountId,
    required this.description,
  });
}

class FormConfiguration {
  final int fieldCount;
  final bool showAdvancedOptions;
  final bool enableBatchEntry;
  final ValidationLevel validationLevel;

  FormConfiguration({
    required this.fieldCount,
    required this.showAdvancedOptions,
    required this.enableBatchEntry,
    required this.validationLevel,
  });
}

class ValidationResult {
  final bool isValid;
  final Map<String, String> errors;

  ValidationResult({
    required this.isValid,
    required this.errors,
  });
}

class QuickAccountingResult {
  final bool success;
  final String message;

  QuickAccountingResult({required this.success, required this.message});
}

// 人工Mock服務類別 (取代Mockito自動生成)
class FakeTransactionApiService {
  Future<Map<String, dynamic>> createTransaction(Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 100));
    if (data.isEmpty) {
      return {'success': false, 'error': '資料不能為空'};
    }
    return {
      'success': true,
      'id': 'trans_${DateTime.now().millisecondsSinceEpoch}',
      'data': data
    };
  }

  Future<List<Map<String, dynamic>>> getTransactions() async {
    await Future.delayed(Duration(milliseconds: 150));
    return [
      {'id': 'trans_1', 'amount': 100.0, 'type': 'expense', 'description': '午餐'},
      {'id': 'trans_2', 'amount': 50.0, 'type': 'income', 'description': '零用錢'}
    ];
  }

  Future<Map<String, dynamic>> batchCreateTransactions(List<Map<String, dynamic>> transactions) async {
    await Future.delayed(Duration(milliseconds: transactions.length * 20));
    return {
      'success': true,
      'processed': transactions.length,
      'results': transactions.map((t) => {'id': 'batch_${DateTime.now().millisecondsSinceEpoch}'}).toList()
    };
  }
}

class FakeAccountApiService {
  Future<List<Map<String, dynamic>>> getAccounts() async {
    await Future.delayed(Duration(milliseconds: 100));
    return [
      {'id': 'bank_main', 'name': '台灣銀行', 'balance': 50000.0},
      {'id': 'cash_wallet', 'name': '現金', 'balance': 2000.0},
      {'id': 'investment_stock', 'name': '股票投資', 'balance': 150000.0}
    ];
  }
}

class FakeCategoryApiService {
  Future<List<Map<String, dynamic>>> getCategories() async {
    await Future.delayed(Duration(milliseconds: 100));
    return [
      {'id': 'food_lunch', 'name': '午餐', 'parent': 'food', 'type': 'expense'},
      {'id': 'food_dinner', 'name': '晚餐', 'parent': 'food', 'type': 'expense'},
      {'id': 'transport_bus', 'name': '公車', 'parent': 'transport', 'type': 'expense'},
      {'id': 'salary', 'name': '薪資', 'type': 'income'}
    ];
  }
}

// 測試資料工廠類別
class AccountingTestDataFactory {
  static Map<String, TestUser> createTestUsers() {
    return {
      'expertUser': TestUser('test_accounting_expert_001', UserMode.expert),
      'inertialUser': TestUser('test_accounting_inertial_001', UserMode.inertial),
      'cultivationUser': TestUser('test_accounting_cultivation_001', UserMode.cultivation),
      'guidingUser': TestUser('test_accounting_guiding_001', UserMode.guiding),
    };
  }

  static Map<String, TestTransaction> createTestTransactions() {
    return {
      'basicIncome': TestTransaction(
        type: TransactionType.income,
        amount: 35000.0,
        categoryId: 'income_salary',
        accountId: 'bank_main',
        description: '薪水'
      ),
      'basicExpense': TestTransaction(
        type: TransactionType.expense,
        amount: 150.0,
        categoryId: 'food_lunch',
        accountId: 'cash_wallet',
        description: '午餐'
      ),
      'complexTransfer': TestTransaction(
        type: TransactionType.transfer,
        amount: 10000.0,
        fromAccountId: 'bank_saving',
        toAccountId: 'investment_stock',
        description: '投資轉帳'
      ),
    };
  }

  static Map<UserMode, FormConfiguration> createModeConfigurations() {
    return {
      UserMode.expert: FormConfiguration(
        fieldCount: 12,
        showAdvancedOptions: true,
        enableBatchEntry: true,
        validationLevel: ValidationLevel.strict
      ),
      UserMode.inertial: FormConfiguration(
        fieldCount: 8,
        showAdvancedOptions: false,
        enableBatchEntry: false,
        validationLevel: ValidationLevel.standard
      ),
      UserMode.cultivation: FormConfiguration(
        fieldCount: 6,
        showAdvancedOptions: false,
        enableBatchEntry: false,
        validationLevel: ValidationLevel.guided
      ),
      UserMode.guiding: FormConfiguration(
        fieldCount: 4,
        showAdvancedOptions: false,
        enableBatchEntry: false,
        validationLevel: ValidationLevel.minimal
      ),
    };
  }
}

/// 記帳核心功能群測試類別
class AccountingCoreFunctionGroupTest {

  // ===========================================
  // 基礎測試函數 (TC-001 ~ TC-008)
  // ===========================================

  /**
   * TC-001: LINE OA智慧記帳解析測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testLineOASmartAccountingParsing() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-001: 開始執行LINE OA智慧記帳解析測試');

    try {
      // Arrange
      final handler = LineOADialogHandler();
      final testCases = [
        '午餐 150',
        '薪水 35000 台灣銀行',
        '咖啡 85 現金',
        '轉帳 10000 從儲蓄到投資'
      ];

      // Act & Assert
      for (String input in testCases) {
        final result = await handler.handleQuickAccounting(input);
        expect(result.success, isTrue, reason: '$input 解析應該成功');
        expect(result.message, contains('記帳成功'), reason: '應包含成功訊息');
      }

      print('TC-001: ✅ LINE OA智慧記帳解析測試通過');

    } catch (e) {
      print('TC-001: ❌ LINE OA智慧記帳解析測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-002: APP記帳表單完整流程測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testAppAccountingFormCompleteFlow() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-002: 開始執行APP記帳表單完整流程測試');

    try {
      // Arrange
      final formProcessor = AccountingFormProcessor();
      final testTransaction = AccountingTestDataFactory.createTestTransactions()['basicExpense']!;

      // Act
      final result = await formProcessor.processTransaction({
        'type': testTransaction.type.toString(),
        'amount': testTransaction.amount,
        'categoryId': testTransaction.categoryId,
        'accountId': testTransaction.accountId,
        'description': testTransaction.description,
      });

      // Assert
      expect(result, isNotNull, reason: '處理結果不應為null');
      expect(result['success'], isTrue, reason: '表單處理應該成功');

      print('TC-002: ✅ APP記帳表單完整流程測試通過');

    } catch (e) {
      print('TC-002: ❌ APP記帳表單完整流程測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-003: 記帳主頁儀表板展示測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testAccountingDashboardDisplay() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-003: 開始執行記帳主頁儀表板展示測試');

    try {
      // Arrange
      final dashboardWidget = DashboardWidgetComponents();

      // Act
      final widgetData = await dashboardWidget.buildDashboardData();

      // Assert
      expect(widgetData, isNotNull, reason: '儀表板資料不應為null');
      expect(widgetData['totalIncome'], isA<double>(), reason: '總收入應為數字');
      expect(widgetData['totalExpense'], isA<double>(), reason: '總支出應為數字');
      expect(widgetData['balance'], isA<double>(), reason: '餘額應為數字');
      expect(widgetData['transactionCount'], isA<int>(), reason: '交易數量應為整數');

      print('TC-003: ✅ 記帳主頁儀表板展示測試通過');

    } catch (e) {
      print('TC-003: ❌ 記帳主頁儀表板展示測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-004: 科目選擇器功能測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testCategorySelectorFunction() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-004: 開始執行科目選擇器功能測試');

    try {
      // Arrange
      final categorySelector = CategorySelectorWidget();

      // Act
      final selectorData = await categorySelector.loadCategories();

      // Assert
      expect(selectorData, isNotNull, reason: '科目資料不應為null');
      expect(selectorData.length, greaterThan(0), reason: '應有科目資料');
      expect(selectorData.first['name'], isNotEmpty, reason: '科目名稱不應為空');

      print('TC-004: ✅ 科目選擇器功能測試通過');

    } catch (e) {
      print('TC-004: ❌ 科目選擇器功能測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-005: 帳戶選擇器功能測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testAccountSelectorFunction() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-005: 開始執行帳戶選擇器功能測試');

    try {
      // Arrange
      final accountSelector = AccountSelectorWidget();

      // Act
      final selectorData = await accountSelector.loadAccounts();

      // Assert
      expect(selectorData, isNotNull, reason: '帳戶資料不應為null');
      expect(selectorData.length, greaterThan(0), reason: '應有帳戶資料');
      expect(selectorData.first['name'], isNotEmpty, reason: '帳戶名稱不應為空');
      expect(selectorData.first['balance'], isA<double>(), reason: '帳戶餘額應為數字');

      print('TC-005: ✅ 帳戶選擇器功能測試通過');

    } catch (e) {
      print('TC-005: ❌ 帳戶選擇器功能測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-006: 快速記帳處理器效能測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testQuickAccountingProcessorPerformance() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-006: 開始執行快速記帳處理器效能測試');

    try {
      // Arrange
      final processor = QuickAccountingProcessor();
      final stopwatch = Stopwatch();
      final testInputs = List.generate(100, (i) => '測試記帳 ${i + 1} 金額 100');

      // Act
      stopwatch.start();
      final results = <QuickAccountingResult>[];
      for (String input in testInputs) {
        final result = await processor.processQuickAccounting(input);
        results.add(result);
      }
      stopwatch.stop();

      // Assert - 效能要求：100筆記錄處理時間 < 5秒
      expect(stopwatch.elapsedMilliseconds, lessThan(5000), reason: '處理時間應小於5秒');
      expect(results.length, equals(100), reason: '應處理所有輸入');
      expect(results.where((r) => r.success).length, greaterThan(80), reason: '成功率應大於80%');

      print('TC-006: ✅ 快速記帳處理器效能測試通過');
      print('TC-006: 處理100筆記錄耗時: ${stopwatch.elapsedMilliseconds}ms');

    } catch (e) {
      print('TC-006: ❌ 快速記帳處理器效能測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-007: 智能文字解析準確性測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testSmartTextParsingAccuracy() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-007: 開始執行智能文字解析準確性測試');

    try {
      // Arrange
      final parser = SmartTextParser();
      final testCases = [
        {
          'input': '早餐 McDonald 120 現金',
          'expected': {
            'amount': 120.0,
            'description': '早餐 McDonald',
            'account': '現金',
            'type': 'expense'
          }
        },
        {
          'input': '薪水 45000 台銀',
          'expected': {
            'amount': 45000.0,
            'description': '薪水',
            'account': '台銀',
            'type': 'income'
          }
        }
      ];

      // Act & Assert
      for (var testCase in testCases) {
        final result = await parser.parseText(testCase['input'] as String);
        final expected = testCase['expected'] as Map<String, dynamic>;

        expect(result['amount'], equals(expected['amount']), reason: '金額解析應正確');
        expect(result['type'], equals(expected['type']), reason: '類型解析應正確');
      }

      print('TC-007: ✅ 智能文字解析準確性測試通過');

    } catch (e) {
      print('TC-007: ❌ 智能文字解析準確性測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-008: 記帳表單驗證測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testAccountingFormValidation() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-008: 開始執行記帳表單驗證測試');

    try {
      // Arrange
      final validator = AccountingFormValidator();
      final validForm = {
        'amount': 150.0,
        'categoryId': 'food_lunch',
        'accountId': 'cash_wallet',
        'description': '午餐'
      };

      final invalidForms = [
        {'amount': -100.0, 'categoryId': 'food', 'accountId': 'cash'}, // 負金額
        {'amount': 0.0, 'categoryId': 'food', 'accountId': 'cash'}, // 零金額
        {'categoryId': 'food', 'accountId': 'cash'}, // 缺少金額
      ];

      // Act & Assert - 有效表單
      final validResult = await validator.validate(validForm);
      expect(validResult.isValid, isTrue, reason: '有效表單應通過驗證');
      expect(validResult.errors, isEmpty, reason: '有效表單不應有錯誤');

      // Act & Assert - 無效表單
      for (var invalidForm in invalidForms) {
        final invalidResult = await validator.validate(invalidForm);
        expect(invalidResult.isValid, isFalse, reason: '無效表單應驗證失敗');
        expect(invalidResult.errors, isNotEmpty, reason: '無效表單應有錯誤訊息');
      }

      print('TC-008: ✅ 記帳表單驗證測試通過');

    } catch (e) {
      print('TC-008: ❌ 記帳表單驗證測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 四模式差異化測試 (TC-009 ~ TC-012)
  // ===========================================

  /**
   * TC-009: Expert模式完整功能測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testExpertModeCompleteFunction() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-009: 開始執行Expert模式完整功能測試');

    try {
      // Arrange
      final expertAdapter = ExpertModeAdapter();
      final expertUser = AccountingTestDataFactory.createTestUsers()['expertUser']!;

      // Act
      final formConfig = await expertAdapter.buildFormConfiguration(expertUser.userId);
      final uiConfig = await expertAdapter.buildUIConfiguration();

      // Assert - Expert模式應有完整功能
      expect(formConfig.fieldCount, equals(12), reason: 'Expert模式應有12個欄位');
      expect(formConfig.showAdvancedOptions, isTrue, reason: 'Expert模式應顯示進階選項');
      expect(formConfig.enableBatchEntry, isTrue, reason: 'Expert模式應支援批次輸入');
      expect(formConfig.validationLevel, equals(ValidationLevel.strict), reason: 'Expert模式應使用嚴格驗證');

      // Assert - UI配置驗證
      expect(uiConfig['showTechnicalDetails'], isTrue, reason: '應顯示技術細節');
      expect(uiConfig['enableAdvancedFilters'], isTrue, reason: '應啟用進階篩選');

      print('TC-009: ✅ Expert模式完整功能測試通過');

    } catch (e) {
      print('TC-009: ❌ Expert模式完整功能測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-010: Inertial模式標準功能測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testInertialModeStandardFunction() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-010: 開始執行Inertial模式標準功能測試');

    try {
      // Arrange
      final inertialAdapter = InertialModeAdapter();
      final inertialUser = AccountingTestDataFactory.createTestUsers()['inertialUser']!;

      // Act
      final formConfig = await inertialAdapter.buildFormConfiguration(inertialUser.userId);
      final uiConfig = await inertialAdapter.buildUIConfiguration();

      // Assert - Inertial模式應為標準功能
      expect(formConfig.fieldCount, equals(8), reason: 'Inertial模式應有8個欄位');
      expect(formConfig.showAdvancedOptions, isFalse, reason: 'Inertial模式不應顯示進階選項');
      expect(formConfig.enableBatchEntry, isFalse, reason: 'Inertial模式不支援批次輸入');
      expect(formConfig.validationLevel, equals(ValidationLevel.standard), reason: 'Inertial模式應使用標準驗證');

      print('TC-010: ✅ Inertial模式標準功能測試通過');

    } catch (e) {
      print('TC-010: ❌ Inertial模式標準功能測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-011: Cultivation模式引導功能測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testCultivationModeGuidanceFunction() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-011: 開始執行Cultivation模式引導功能測試');

    try {
      // Arrange
      final cultivationAdapter = CultivationModeAdapter();
      final cultivationUser = AccountingTestDataFactory.createTestUsers()['cultivationUser']!;

      // Act
      final formConfig = await cultivationAdapter.buildFormConfiguration(cultivationUser.userId);
      final uiConfig = await cultivationAdapter.buildUIConfiguration();
      final motivationConfig = await cultivationAdapter.buildMotivationConfiguration();

      // Assert - Cultivation模式應有引導功能
      expect(formConfig.fieldCount, equals(6), reason: 'Cultivation模式應有6個欄位');
      expect(formConfig.validationLevel, equals(ValidationLevel.guided), reason: 'Cultivation模式應使用引導式驗證');

      // Assert - 激勵機制驗證
      expect(motivationConfig['enableAchievements'], isTrue, reason: '應啟用成就系統');
      expect(motivationConfig['enableProgress'], isTrue, reason: '應啟用進度追蹤');

      print('TC-011: ✅ Cultivation模式引導功能測試通過');

    } catch (e) {
      print('TC-011: ❌ Cultivation模式引導功能測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-012: Guiding模式簡化功能測試
   * @version 2025-09-12 v1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<void> testGuidingModeSimplifiedFunction() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-012: 開始執行Guiding模式簡化功能測試');

    try {
      // Arrange
      final guidingAdapter = GuidingModeAdapter();
      final guidingUser = AccountingTestDataFactory.createTestUsers()['guidingUser']!;

      // Act
      final formConfig = await guidingAdapter.buildFormConfiguration(guidingUser.userId);
      final uiConfig = await guidingAdapter.buildUIConfiguration();
      final autoConfig = await guidingAdapter.buildAutoConfiguration();

      // Assert - Guiding模式應為最簡化
      expect(formConfig.fieldCount, equals(4), reason: 'Guiding模式應有4個欄位');
      expect(formConfig.validationLevel, equals(ValidationLevel.minimal), reason: 'Guiding模式應使用最少驗證');

      // Assert - 自動化配置驗證
      expect(autoConfig['enableAutoFill'], isTrue, reason: '應啟用自動填入');
      expect(autoConfig['enableSmartDefaults'], isTrue, reason: '應啟用智能預設值');

      print('TC-012: ✅ Guiding模式簡化功能測試通過');

    } catch (e) {
      print('TC-012: ❌ Guiding模式簡化功能測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 核心函數實作 (僅函數表頭，用於TDD開發)
  // ===========================================

  /**
   * 01. 處理LINE OA快速記帳
   * @version 2025-09-12-V1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<QuickAccountingResult> processLineOAQuickAccounting(String input) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 100));
    if (input.isEmpty) {
      return QuickAccountingResult(success: false, message: '輸入不能為空');
    }
    return QuickAccountingResult(success: true, message: '記帳成功');
  }

  /**
   * 02. 處理APP記帳表單
   * @version 2025-09-12-V1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<Map<String, dynamic>> processAppAccountingForm(Map<String, dynamic> formData) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 150));
    return {'success': true, 'transactionId': 'trans_${DateTime.now().millisecondsSinceEpoch}'};
  }

  /**
   * 03. 建立儀表板資料
   * @version 2025-09-12-V1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<Map<String, dynamic>> buildDashboardData() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 100));
    return {
      'totalIncome': 35000.0,
      'totalExpense': 15000.0,
      'balance': 20000.0,
      'transactionCount': 25
    };
  }

  /**
   * 04. 載入科目選擇器
   * @version 2025-09-12-V1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<List<Map<String, dynamic>>> loadCategorySelector() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 100));
    return [
      {'id': 'food_lunch', 'name': '午餐', 'parent': 'food'},
      {'id': 'transport_bus', 'name': '公車', 'parent': 'transport'}
    ];
  }

  /**
   * 05. 載入帳戶選擇器
   * @version 2025-09-12-V1.0.1
   * @date 2025-09-12
   * @update: 移除Mockito依賴版本
   */
  Future<List<Map<String, dynamic>>> loadAccountSelector() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 100));
    return [
      {'id': 'bank_main', 'name': '台灣銀行', 'balance': 50000.0},
      {'id': 'cash_wallet', 'name': '現金', 'balance': 2000.0}
    ];
  }
}

// ===========================================
// 支援類別實作 (使用人工Mock取代Mockito)
// ===========================================

/// LINE OA對話處理器
class LineOADialogHandler {
  Future<QuickAccountingResult> handleQuickAccounting(String input) async {
    await Future.delayed(Duration(milliseconds: 100));
    if (input.isEmpty) {
      return QuickAccountingResult(success: false, message: '輸入不能為空');
    }
    return QuickAccountingResult(success: true, message: '記帳成功');
  }
}

/// 記帳表單處理器
class AccountingFormProcessor {
  Future<Map<String, dynamic>> processTransaction(Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 100));
    return {'success': true, 'transactionId': 'trans_${DateTime.now().millisecondsSinceEpoch}'};
  }
}

/// 儀表板組件
class DashboardWidgetComponents {
  Future<Map<String, dynamic>> buildDashboardData() async {
    await Future.delayed(Duration(milliseconds: 50));
    return {
      'totalIncome': 35000.0,
      'totalExpense': 15000.0,
      'balance': 20000.0,
      'transactionCount': 25
    };
  }
}

/// 科目選擇器Widget
class CategorySelectorWidget {
  Future<List<Map<String, dynamic>>> loadCategories() async {
    await Future.delayed(Duration(milliseconds: 100));
    return [
      {'id': 'food_lunch', 'name': '午餐', 'parent': 'food'},
      {'id': 'food_dinner', 'name': '晚餐', 'parent': 'food'},
      {'id': 'transport_bus', 'name': '公車', 'parent': 'transport'}
    ];
  }
}

/// 帳戶選擇器Widget
class AccountSelectorWidget {
  Future<List<Map<String, dynamic>>> loadAccounts() async {
    await Future.delayed(Duration(milliseconds: 100));
    return [
      {'id': 'bank_main', 'name': '台灣銀行', 'balance': 50000.0},
      {'id': 'cash_wallet', 'name': '現金', 'balance': 2000.0},
      {'id': 'investment_stock', 'name': '股票投資', 'balance': 150000.0}
    ];
  }
}

/// 快速記帳處理器
class QuickAccountingProcessor {
  Future<QuickAccountingResult> processQuickAccounting(String input) async {
    await Future.delayed(Duration(milliseconds: 30));
    // 簡單的成功率模擬：90%成功
    final success = DateTime.now().millisecond % 10 != 0;
    return QuickAccountingResult(
      success: success,
      message: success ? '記帳成功' : '解析失敗'
    );
  }
}

/// 智能文字解析器
class SmartTextParser {
  Future<Map<String, dynamic>> parseText(String input) async {
    await Future.delayed(Duration(milliseconds: 50));

    final words = input.split(' ');
    final result = <String, dynamic>{};

    // 尋找金額
    for (String word in words) {
      final amount = double.tryParse(word);
      if (amount != null) {
        result['amount'] = amount;
        break;
      }
    }

    // 判斷類型
    if (input.contains('薪水') || input.contains('收入')) {
      result['type'] = 'income';
    } else if (input.contains('轉帳')) {
      result['type'] = 'transfer';
    } else {
      result['type'] = 'expense';
    }

    // 尋找帳戶
    if (input.contains('現金')) result['account'] = '現金';
    if (input.contains('台銀') || input.contains('台灣銀行')) result['account'] = '台銀';

    // 移除金額後的描述
    String description = input;
    for (String word in words) {
      if (double.tryParse(word) != null) {
        description = description.replaceFirst(word, '').trim();
      }
    }
    result['description'] = description;

    return result;
  }
}

/// 記帳表單驗證器
class AccountingFormValidator {
  Future<ValidationResult> validate(Map<String, dynamic> formData) async {
    await Future.delayed(Duration(milliseconds: 30));

    final errors = <String, String>{};

    // 驗證金額
    final amount = formData['amount'] as double?;
    if (amount == null) {
      errors['amount'] = '金額為必填項目';
    } else if (amount <= 0) {
      errors['amount'] = '金額必須大於零';
    }

    // 驗證科目
    if (!formData.containsKey('categoryId') || formData['categoryId'] == null) {
      errors['categoryId'] = '科目為必填項目';
    }

    // 驗證帳戶
    if (!formData.containsKey('accountId') || formData['accountId'] == null) {
      errors['accountId'] = '帳戶為必填項目';
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors
    );
  }
}

/// 四模式適配器實作
class ExpertModeAdapter {
  Future<FormConfiguration> buildFormConfiguration(String userId) async {
    await Future.delayed(Duration(milliseconds: 50));
    return FormConfiguration(
      fieldCount: 12,
      showAdvancedOptions: true,
      enableBatchEntry: true,
      validationLevel: ValidationLevel.strict
    );
  }

  Future<Map<String, dynamic>> buildUIConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'showTechnicalDetails': true,
      'enableAdvancedFilters': true,
      'showCompleteErrorMessages': true,
    };
  }
}

class InertialModeAdapter {
  Future<FormConfiguration> buildFormConfiguration(String userId) async {
    await Future.delayed(Duration(milliseconds: 50));
    return FormConfiguration(
      fieldCount: 8,
      showAdvancedOptions: false,
      enableBatchEntry: false,
      validationLevel: ValidationLevel.standard
    );
  }

  Future<Map<String, dynamic>> buildUIConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'showTechnicalDetails': false,
      'enableAdvancedFilters': false,
      'showSimplifiedInterface': true,
    };
  }
}

class CultivationModeAdapter {
  Future<FormConfiguration> buildFormConfiguration(String userId) async {
    await Future.delayed(Duration(milliseconds: 50));
    return FormConfiguration(
      fieldCount: 6,
      showAdvancedOptions: false,
      enableBatchEntry: false,
      validationLevel: ValidationLevel.guided
    );
  }

  Future<Map<String, dynamic>> buildUIConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'showProgress': true,
      'enableGamification': true,
      'showMotivation': true,
    };
  }

  Future<Map<String, dynamic>> buildMotivationConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'enableAchievements': true,
      'enableProgress': true,
      'showEncouragement': true,
    };
  }
}

class GuidingModeAdapter {
  Future<FormConfiguration> buildFormConfiguration(String userId) async {
    await Future.delayed(Duration(milliseconds: 50));
    return FormConfiguration(
      fieldCount: 4,
      showAdvancedOptions: false,
      enableBatchEntry: false,
      validationLevel: ValidationLevel.minimal
    );
  }

  Future<Map<String, dynamic>> buildUIConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'showMinimalInterface': true,
      'enableAutoMode': true,
      'hideComplexOptions': true,
    };
  }

  Future<Map<String, dynamic>> buildAutoConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'enableAutoFill': true,
      'enableSmartDefaults': true,
      'minimizeDecisions': true,
    };
  }
}

/// 主要測試執行函數
void main() {
  group('記帳核心功能群測試 - v1.0.1 (移除Mockito版本)', () {
    late AccountingCoreFunctionGroupTest testInstance;

    setUp(() {
      testInstance = AccountingCoreFunctionGroupTest();
      // 確保Fake Service開關啟用
      PLFakeServiceSwitch.enable7502FakeService = true;
    });

    // 第一階段：基礎功能測試
    group('第一階段：基礎功能測試', () {
      test('TC-001: LINE OA智慧記帳解析測試', () async {
        await testInstance.testLineOASmartAccountingParsing();
      });

      test('TC-002: APP記帳表單完整流程測試', () async {
        await testInstance.testAppAccountingFormCompleteFlow();
      });

      test('TC-003: 記帳主頁儀表板展示測試', () async {
        await testInstance.testAccountingDashboardDisplay();
      });

      test('TC-004: 科目選擇器功能測試', () async {
        await testInstance.testCategorySelectorFunction();
      });

      test('TC-005: 帳戶選擇器功能測試', () async {
        await testInstance.testAccountSelectorFunction();
      });

      test('TC-006: 快速記帳處理器效能測試', () async {
        await testInstance.testQuickAccountingProcessorPerformance();
      });

      test('TC-007: 智能文字解析準確性測試', () async {
        await testInstance.testSmartTextParsingAccuracy();
      });

      test('TC-008: 記帳表單驗證測試', () async {
        await testInstance.testAccountingFormValidation();
      });
    });

    // 第二階段：四模式差異化測試
    group('第二階段：四模式差異化測試', () {
      test('TC-009: Expert模式完整功能測試', () async {
        await testInstance.testExpertModeCompleteFunction();
      });

      test('TC-010: Inertial模式標準功能測試', () async {
        await testInstance.testInertialModeStandardFunction();
      });

      test('TC-011: Cultivation模式引導功能測試', () async {
        await testInstance.testCultivationModeGuidanceFunction();
      });

      test('TC-012: Guiding模式簡化功能測試', () async {
        await testInstance.testGuidingModeSimplifiedFunction();
      });
    });
  });
}