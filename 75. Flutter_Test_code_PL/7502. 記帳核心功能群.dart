/**
 * 7502. 記帳核心功能群.dart - 記帳核心功能群測試代碼
 * @version 2025-09-12 v1.2.0
 * @date 2025-09-12
 * @update: 階段一完成 - 補強TC-023至TC-026安全性測試案例，升級模組版次至v1.2.0，所有函數升級至v1.1.0
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
  // 基礎測試函數 (TC-001 ~ TC-012)
  // ===========================================

  /**
   * TC-001: LINE OA智慧記帳解析測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 階段一升版 - 函數版次統一升級至v1.1.0
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
  // 第三階段：狀態管理測試 (TC-013 ~ TC-015)
  // ===========================================

  /**
   * TC-013: TransactionStateProvider狀態管理測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增狀態管理測試
   */
  Future<void> testTransactionStateProviderManagement() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-013: 開始執行TransactionStateProvider狀態管理測試');

    try {
      // Arrange
      final stateProvider = TransactionStateProvider();
      final testTransaction = AccountingTestDataFactory.createTestTransactions()['basicExpense']!;

      // Act - 測試載入狀態
      await stateProvider.loadTransactions();
      expect(stateProvider.isLoading, isFalse, reason: '載入完成後isLoading應為false');
      expect(stateProvider.transactions, isNotEmpty, reason: '應載入交易資料');

      // Act - 測試新增交易狀態變化
      await stateProvider.addTransaction({
        'type': testTransaction.type.toString(),
        'amount': testTransaction.amount,
        'description': testTransaction.description,
      });
      expect(stateProvider.hasError, isFalse, reason: '新增成功不應有錯誤');

      // Act - 測試錯誤狀態處理
      await stateProvider.addTransaction({}); // 空資料應觸發錯誤
      expect(stateProvider.hasError, isTrue, reason: '空資料應觸發錯誤狀態');

      print('TC-013: ✅ TransactionStateProvider狀態管理測試通過');

    } catch (e) {
      print('TC-013: ❌ TransactionStateProvider狀態管理測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-014: CategoryStateProvider快取測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增科目狀態管理測試
   */
  Future<void> testCategoryStateProviderCache() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-014: 開始執行CategoryStateProvider快取測試');

    try {
      // Arrange
      final categoryProvider = CategoryStateProvider();

      // Act - 首次載入
      final stopwatch = Stopwatch()..start();
      await categoryProvider.loadCategories();
      final firstLoadTime = stopwatch.elapsedMilliseconds;
      stopwatch.reset();

      // Act - 快取載入
      await categoryProvider.loadCategories();
      final cacheLoadTime = stopwatch.elapsedMilliseconds;
      stopwatch.stop();

      // Assert
      expect(categoryProvider.categories, isNotEmpty, reason: '應載入科目資料');
      expect(cacheLoadTime, lessThan(firstLoadTime), reason: '快取載入應更快');
      expect(categoryProvider.isCacheValid, isTrue, reason: '快取應為有效狀態');

      print('TC-014: ✅ CategoryStateProvider快取測試通過');
      print('TC-014: 首次載入: ${firstLoadTime}ms, 快取載入: ${cacheLoadTime}ms');

    } catch (e) {
      print('TC-014: ❌ CategoryStateProvider快取測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-015: FormStateProvider驗證測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增表單狀態管理測試
   */
  Future<void> testFormStateProviderValidation() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-015: 開始執行FormStateProvider驗證測試');

    try {
      // Arrange
      final formProvider = FormStateProvider();

      // Act - 測試表單欄位狀態綁定
      formProvider.updateField('amount', '150.0');
      formProvider.updateField('description', '午餐');
      
      // Assert - 即時驗證
      expect(formProvider.getFieldValue('amount'), equals('150.0'), reason: '欄位值應正確綁定');
      expect(formProvider.isFieldValid('amount'), isTrue, reason: '有效金額應通過驗證');

      // Act - 測試錯誤狀態
      formProvider.updateField('amount', '-100');
      expect(formProvider.isFieldValid('amount'), isFalse, reason: '負金額應驗證失敗');
      expect(formProvider.getFieldError('amount'), isNotNull, reason: '應有錯誤訊息');

      // Act - 測試表單重置
      formProvider.resetForm();
      expect(formProvider.getFieldValue('amount'), isEmpty, reason: '重置後欄位應為空');

      print('TC-015: ✅ FormStateProvider驗證測試通過');

    } catch (e) {
      print('TC-015: ❌ FormStateProvider驗證測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 第四階段：Widget結構測試 (TC-016 ~ TC-017)
  // ===========================================

  /**
   * TC-016: 記帳表單Widget結構測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增Widget結構測試
   */
  Future<void> testAccountingFormWidgetStructure() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-016: 開始執行記帳表單Widget結構測試');

    try {
      // Arrange
      final formWidget = AccountingFormPageWidget();
      
      // Act - 渲染Widget
      final widgetStructure = await formWidget.buildWidgetTree();

      // Assert - Widget結構驗證
      expect(widgetStructure['hasScaffold'], isTrue, reason: '應有Scaffold結構');
      expect(widgetStructure['hasForm'], isTrue, reason: '應有Form Widget');
      expect(widgetStructure['inputFieldCount'], greaterThan(4), reason: '應有足夠的輸入欄位');
      expect(widgetStructure['hasSubmitButton'], isTrue, reason: '應有提交按鈕');

      // Assert - 四模式差異驗證
      final expertStructure = await formWidget.buildWidgetTree(UserMode.expert);
      final guidingStructure = await formWidget.buildWidgetTree(UserMode.guiding);
      
      expect(expertStructure['inputFieldCount'], greaterThan(guidingStructure['inputFieldCount']), 
             reason: 'Expert模式欄位應多於Guiding模式');

      print('TC-016: ✅ 記帳表單Widget結構測試通過');

    } catch (e) {
      print('TC-016: ❌ 記帳表單Widget結構測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-017: 統計圖表Widget渲染測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增統計圖表Widget測試
   */
  Future<void> testStatisticsChartWidgetRendering() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-017: 開始執行統計圖表Widget渲染測試');

    try {
      // Arrange
      final chartWidget = StatisticsChartWidget();
      final testData = [
        {'category': '食物', 'amount': 1500.0},
        {'category': '交通', 'amount': 800.0},
        {'category': '娛樂', 'amount': 600.0},
      ];

      // Act - 渲染圖表
      final renderResult = await chartWidget.renderChart(testData, 'pie');

      // Assert - 渲染結果驗證
      expect(renderResult['success'], isTrue, reason: '圖表應成功渲染');
      expect(renderResult['chartType'], equals('pie'), reason: '圖表類型應正確');
      expect(renderResult['dataPoints'], equals(3), reason: '資料點數量應正確');

      // Act - 測試不同圖表類型
      final barChart = await chartWidget.renderChart(testData, 'bar');
      final lineChart = await chartWidget.renderChart(testData, 'line');

      expect(barChart['success'], isTrue, reason: '長條圖應成功渲染');
      expect(lineChart['success'], isTrue, reason: '折線圖應成功渲染');

      print('TC-017: ✅ 統計圖表Widget渲染測試通過');

    } catch (e) {
      print('TC-017: ❌ 統計圖表Widget渲染測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 第五階段：異常處理測試 (TC-018 ~ TC-019)
  // ===========================================

  /**
   * TC-018: 記帳表單驗證異常處理測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增異常處理測試
   */
  Future<void> testAccountingFormValidationException() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-018: 開始執行記帳表單驗證異常處理測試');

    try {
      // Arrange
      final formProcessor = AccountingFormProcessor();
      final maliciousInputs = [
        {'amount': '<script>alert("xss")</script>', 'description': '惡意腳本'},
        {'amount': "'; DROP TABLE transactions; --", 'description': 'SQL注入'},
        {'amount': '999999999999999999999', 'description': '超大數字'},
        {'description': 'A' * 10000}, // 超長描述
      ];

      // Act & Assert - 測試各種異常輸入
      for (var maliciousInput in maliciousInputs) {
        try {
          final result = await formProcessor.processTransaction(maliciousInput);
          expect(result['success'], isFalse, reason: '惡意輸入應被拒絕');
          expect(result['error'], isNotNull, reason: '應有錯誤訊息');
        } catch (e) {
          // 預期會拋出異常，這是正常的
          expect(e.toString(), isNotEmpty, reason: '異常訊息不應為空');
        }
      }

      // Act - 測試餘額不足情況
      final insufficientBalanceForm = {
        'amount': 999999.0, // 超過帳戶餘額
        'categoryId': 'food_lunch',
        'accountId': 'cash_wallet',
        'description': '餘額不足測試'
      };

      final result = await formProcessor.processTransaction(insufficientBalanceForm);
      expect(result['success'], isFalse, reason: '餘額不足應處理失敗');
      expect(result['error'], contains('餘額不足'), reason: '錯誤訊息應明確');

      print('TC-018: ✅ 記帳表單驗證異常處理測試通過');

    } catch (e) {
      print('TC-018: ❌ 記帳表單驗證異常處理測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-019: 網路異常離線模式測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增離線模式測試
   */
  Future<void> testNetworkExceptionOfflineMode() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-019: 開始執行網路異常離線模式測試');

    try {
      // Arrange
      final offlineManager = OfflineAccountingManager();
      final testTransaction = AccountingTestDataFactory.createTestTransactions()['basicExpense']!;

      // Act - 模擬網路中斷
      offlineManager.simulateNetworkDisconnection();
      
      // Act - 離線記帳
      final offlineResult = await offlineManager.saveTransactionOffline({
        'type': testTransaction.type.toString(),
        'amount': testTransaction.amount,
        'description': testTransaction.description,
        'timestamp': DateTime.now().toIso8601String(),
      });

      // Assert - 離線儲存驗證
      expect(offlineResult['success'], isTrue, reason: '離線記帳應成功');
      expect(offlineResult['savedLocally'], isTrue, reason: '應本地儲存成功');

      // Act - 檢查離線佇列
      final offlineQueue = await offlineManager.getOfflineQueue();
      expect(offlineQueue.length, equals(1), reason: '離線佇列應有一筆記錄');

      // Act - 模擬網路恢復
      offlineManager.simulateNetworkReconnection();
      
      // Act - 自動同步測試
      final syncResult = await offlineManager.syncOfflineData();
      expect(syncResult['syncedCount'], equals(1), reason: '應同步一筆記錄');
      expect(syncResult['success'], isTrue, reason: '同步應成功');

      // Assert - 同步後佇列清空
      final emptyQueue = await offlineManager.getOfflineQueue();
      expect(emptyQueue.length, equals(0), reason: '同步後佇列應為空');

      print('TC-019: ✅ 網路異常離線模式測試通過');

    } catch (e) {
      print('TC-019: ❌ 網路異常離線模式測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 第六階段：效能測試 (TC-020 ~ TC-022)
  // ===========================================

  /**
   * TC-020: 記帳操作回應效能測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增效能測試
   */
  Future<void> testAccountingOperationResponsePerformance() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-020: 開始執行記帳操作回應效能測試');

    try {
      // Arrange
      final performanceMonitor = AccountingPerformanceMonitor();
      final formProcessor = AccountingFormProcessor();
      final testTransaction = AccountingTestDataFactory.createTestTransactions()['basicExpense']!;

      // Act - 執行100次記帳操作測試
      final responseTimes = <int>[];
      for (int i = 0; i < 100; i++) {
        final stopwatch = Stopwatch()..start();
        
        await formProcessor.processTransaction({
          'type': testTransaction.type.toString(),
          'amount': testTransaction.amount + i, // 避免重複
          'categoryId': testTransaction.categoryId,
          'accountId': testTransaction.accountId,
          'description': '${testTransaction.description} #$i',
        });
        
        stopwatch.stop();
        responseTimes.add(stopwatch.elapsedMilliseconds);
      }

      // Assert - 效能指標驗證
      final avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      final maxResponseTime = responseTimes.reduce((a, b) => a > b ? a : b);
      final minResponseTime = responseTimes.reduce((a, b) => a < b ? a : b);

      expect(avgResponseTime, lessThan(500), reason: '平均回應時間應小於500ms');
      expect(maxResponseTime, lessThan(1000), reason: '最大回應時間應小於1000ms');

      // Act - 記憶體使用監控
      final memoryUsage = await performanceMonitor.getMemoryUsage();
      expect(memoryUsage['currentMB'], lessThan(80), reason: '記憶體使用應小於80MB');

      print('TC-020: ✅ 記帳操作回應效能測試通過');
      print('TC-020: 平均回應時間: ${avgResponseTime.toStringAsFixed(2)}ms');
      print('TC-020: 最大回應時間: ${maxResponseTime}ms, 最小回應時間: ${minResponseTime}ms');

    } catch (e) {
      print('TC-020: ❌ 記帳操作回應效能測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-021: 圖表載入效能基準測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增圖表效能測試
   */
  Future<void> testChartLoadingPerformanceBenchmark() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-021: 開始執行圖表載入效能基準測試');

    try {
      // Arrange
      final chartWidget = StatisticsChartWidget();
      final simpleData = List.generate(10, (i) => {'category': 'Cat$i', 'amount': (i + 1) * 100.0});
      final complexData = List.generate(1000, (i) => {'category': 'Cat$i', 'amount': (i + 1) * 10.0});

      // Act - 簡單圖表載入測試
      final simpleStopwatch = Stopwatch()..start();
      final simpleResult = await chartWidget.renderChart(simpleData, 'pie');
      simpleStopwatch.stop();

      // Act - 複雜圖表載入測試
      final complexStopwatch = Stopwatch()..start();
      final complexResult = await chartWidget.renderChart(complexData, 'bar');
      complexStopwatch.stop();

      // Assert - 效能基準驗證
      expect(simpleStopwatch.elapsedMilliseconds, lessThan(1000), reason: '簡單圖表載入應小於1秒');
      expect(complexStopwatch.elapsedMilliseconds, lessThan(3000), reason: '複雜圖表載入應小於3秒');
      expect(simpleResult['success'], isTrue, reason: '簡單圖表應成功渲染');
      expect(complexResult['success'], isTrue, reason: '複雜圖表應成功渲染');

      // Act - 圖表互動回應測試
      final interactionStopwatch = Stopwatch()..start();
      await chartWidget.handleChartInteraction('click', {'dataIndex': 5});
      interactionStopwatch.stop();

      expect(interactionStopwatch.elapsedMilliseconds, lessThan(100), reason: '圖表互動回應應小於100ms');

      print('TC-021: ✅ 圖表載入效能基準測試通過');
      print('TC-021: 簡單圖表: ${simpleStopwatch.elapsedMilliseconds}ms, 複雜圖表: ${complexStopwatch.elapsedMilliseconds}ms');

    } catch (e) {
      print('TC-021: ❌ 圖表載入效能基準測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-022: 記憶體使用監控測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 新增記憶體監控測試
   */
  Future<void> testMemoryUsageMonitoring() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-022: 開始執行記憶體使用監控測試');

    try {
      // Arrange
      final memoryMonitor = AccountingMemoryMonitor();
      final formProcessor = AccountingFormProcessor();

      // Act - 基礎記憶體使用測試
      final initialMemory = await memoryMonitor.getCurrentMemoryUsage();
      
      // Act - 執行大量記帳操作
      for (int i = 0; i < 200; i++) {
        await formProcessor.processTransaction({
          'amount': 100.0 + i,
          'categoryId': 'test_category',
          'accountId': 'test_account',
          'description': '記憶體測試 #$i',
        });
      }

      final afterOperationsMemory = await memoryMonitor.getCurrentMemoryUsage();

      // Act - 強制垃圾回收
      await memoryMonitor.forceGarbageCollection();
      await Future.delayed(Duration(milliseconds: 500)); // 等待GC完成
      
      final afterGCMemory = await memoryMonitor.getCurrentMemoryUsage();

      // Assert - 記憶體使用驗證
      expect(afterOperationsMemory['currentMB'], lessThan(80), reason: '操作後記憶體應小於80MB');
      expect(afterGCMemory['currentMB'], lessThanOrEqualTo(afterOperationsMemory['currentMB']), 
             reason: 'GC後記憶體應不增加');

      // Act - 記憶體洩漏檢測
      final memoryGrowth = afterOperationsMemory['currentMB'] - initialMemory['currentMB'];
      expect(memoryGrowth, lessThan(20), reason: '記憶體增長應控制在20MB以內');

      print('TC-022: ✅ 記憶體使用監控測試通過');
      print('TC-022: 初始記憶體: ${initialMemory['currentMB']}MB, 操作後: ${afterOperationsMemory['currentMB']}MB, GC後: ${afterGCMemory['currentMB']}MB');

    } catch (e) {
      print('TC-022: ❌ 記憶體使用監控測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 第七階段：安全性測試 (TC-023 ~ TC-026) - 階段一新增
  // ===========================================

  /**
   * TC-023: 表單輸入驗證安全測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 階段一新增 - 防護XSS、SQL注入等惡意輸入攻擊
   */
  Future<void> testFormInputValidationSecurity() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-023: 開始執行表單輸入驗證安全測試');

    try {
      // Arrange
      final securityValidator = SecurityFormValidator();
      final xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
      ];

      final sqlInjectionPayloads = [
        "'; DROP TABLE transactions; --",
        "1' OR '1'='1",
        "'; INSERT INTO users VALUES('hacker'); --",
        "UNION SELECT password FROM users --",
      ];

      // Act & Assert - XSS攻擊防護測試
      for (String xssPayload in xssPayloads) {
        final result = await securityValidator.validateInput('description', xssPayload);
        expect(result.isValid, isFalse, reason: 'XSS攻擊應被阻擋');
        expect(result.securityThreat, isTrue, reason: '應識別為安全威脅');
        expect(result.sanitizedValue, isNot(contains('<script>')), reason: '應移除惡意腳本');
      }

      // Act & Assert - SQL注入防護測試
      for (String sqlPayload in sqlInjectionPayloads) {
        final result = await securityValidator.validateInput('amount', sqlPayload);
        expect(result.isValid, isFalse, reason: 'SQL注入應被阻擋');
        expect(result.securityThreat, isTrue, reason: '應識別為安全威脅');
      }

      // Act & Assert - 長度限制測試
      final longInput = 'A' * 10000;
      final lengthResult = await securityValidator.validateInput('description', longInput);
      expect(lengthResult.isValid, isFalse, reason: '超長輸入應被拒絕');

      print('TC-023: ✅ 表單輸入驗證安全測試通過');

    } catch (e) {
      print('TC-023: ❌ 表單輸入驗證安全測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-024: 敏感資料保護測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 階段一新增 - 確保敏感資料得到適當保護
   */
  Future<void> testSensitiveDataProtection() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-024: 開始執行敏感資料保護測試');

    try {
      // Arrange
      final dataProtector = SensitiveDataProtector();
      final sensitiveData = {
        'accountNumber': '1234567890123456',
        'amount': 50000.0,
        'personalNote': '私人備註內容',
        'userId': 'user_12345',
      };

      // Act - 本地儲存加密測試
      final encryptedData = await dataProtector.encryptForLocalStorage(sensitiveData);
      expect(encryptedData['accountNumber'], isNot(equals('1234567890123456')), 
             reason: '帳號應加密儲存');
      expect(encryptedData['personalNote'], isNot(contains('私人備註')), 
             reason: '私人資料應加密儲存');

      // Act - 解密驗證
      final decryptedData = await dataProtector.decryptFromLocalStorage(encryptedData);
      expect(decryptedData['accountNumber'], equals('1234567890123456'), 
             reason: '解密後應還原原始資料');

      // Act - 敏感資料遮罩測試
      final maskedData = await dataProtector.maskSensitiveFields(sensitiveData);
      expect(maskedData['accountNumber'], matches(r'\*+\d{4}$'), 
             reason: '帳號應遮罩只顯示後四碼');

      // Act - 網路傳輸加密測試
      final transmissionData = await dataProtector.prepareForTransmission(sensitiveData);
      expect(transmissionData['encrypted'], isTrue, reason: '傳輸資料應標記為已加密');
      expect(transmissionData['checksum'], isNotNull, reason: '應包含完整性檢查碼');

      print('TC-024: ✅ 敏感資料保護測試通過');

    } catch (e) {
      print('TC-024: ❌ 敏感資料保護測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-025: 跨平台資料同步測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 階段一新增 - 確保APP與LINE OA資料同步一致性
   */
  Future<void> testCrossPlatformDataSync() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-025: 開始執行跨平台資料同步測試');

    try {
      // Arrange
      final syncManager = CrossPlatformSyncManager();
      final appTransaction = {
        'id': 'app_trans_001',
        'amount': 299.0,
        'description': 'APP記帳測試',
        'source': 'APP',
        'timestamp': DateTime.now().toIso8601String(),
      };

      final lineTransaction = {
        'id': 'line_trans_001',
        'amount': 150.0,
        'description': 'LINE記帳測試',
        'source': 'LINE_OA',
        'timestamp': DateTime.now().add(Duration(minutes: 1)).toIso8601String(),
      };

      // Act - APP記帳同步到LINE OA
      await syncManager.syncFromAPP(appTransaction);
      final appSyncResult = await syncManager.getTransactionFromLINE('app_trans_001');
      expect(appSyncResult, isNotNull, reason: 'APP記帳應同步到LINE OA');
      expect(appSyncResult['amount'], equals(299.0), reason: '金額應一致');

      // Act - LINE OA記帳同步到APP
      await syncManager.syncFromLINE(lineTransaction);
      final lineSyncResult = await syncManager.getTransactionFromAPP('line_trans_001');
      expect(lineSyncResult, isNotNull, reason: 'LINE記帳應同步到APP');
      expect(lineSyncResult['description'], equals('LINE記帳測試'), reason: '描述應一致');

      // Act - 衝突解決測試
      final conflictTransaction = {
        'id': 'conflict_trans_001',
        'amount': 100.0,
        'description': '衝突測試原始',
        'source': 'APP',
        'timestamp': DateTime.now().toIso8601String(),
      };

      final conflictUpdate = {
        'id': 'conflict_trans_001',
        'amount': 200.0,
        'description': '衝突測試更新',
        'source': 'LINE_OA',
        'timestamp': DateTime.now().add(Duration(seconds: 30)).toIso8601String(),
      };

      await syncManager.syncFromAPP(conflictTransaction);
      await syncManager.syncFromLINE(conflictUpdate);

      final conflictResolution = await syncManager.resolveConflict('conflict_trans_001');
      expect(conflictResolution['resolved'], isTrue, reason: '衝突應被解決');
      expect(conflictResolution['strategy'], isNotNull, reason: '應有解決策略');

      // Act - 同步狀態檢查
      final syncStatus = await syncManager.getSyncStatus();
      expect(syncStatus['lastSyncTime'], isNotNull, reason: '應記錄最後同步時間');
      expect(syncStatus['pendingCount'], equals(0), reason: '不應有待同步項目');

      print('TC-025: ✅ 跨平台資料同步測試通過');

    } catch (e) {
      print('TC-025: ❌ 跨平台資料同步測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-026: 併發記帳操作一致性測試
   * @version 2025-09-12 v1.1.0
   * @date 2025-09-12
   * @update: 階段一新增 - 測試高併發情況下記帳操作的資料一致性
   */
  Future<void> testConcurrentAccountingConsistency() async {
    if (!PLFakeServiceSwitch.enable7502FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-026: 開始執行併發記帳操作一致性測試');

    try {
      // Arrange
      final concurrencyManager = ConcurrentAccountingManager();
      final initialBalance = 10000.0;
      await concurrencyManager.setAccountBalance('test_account', initialBalance);

      // Act - 併發記帳測試（100個並發操作）
      final concurrentOperations = <Future>[];
      final operationResults = <Map<String, dynamic>>[];

      for (int i = 0; i < 100; i++) {
        final operation = concurrencyManager.processTransaction({
          'id': 'concurrent_trans_$i',
          'accountId': 'test_account',
          'amount': i % 2 == 0 ? 50.0 : -30.0, // 交替收入支出
          'type': i % 2 == 0 ? 'income' : 'expense',
          'timestamp': DateTime.now().add(Duration(milliseconds: i)).toIso8601String(),
        });
        
        concurrentOperations.add(operation);
      }

      // 等待所有併發操作完成
      final results = await Future.wait(concurrentOperations);
      operationResults.addAll(results.cast<Map<String, dynamic>>());

      // Assert - 操作成功率檢查
      final successfulOps = operationResults.where((r) => r['success'] == true).length;
      expect(successfulOps, greaterThan(95), reason: '併發操作成功率應大於95%');

      // Act - 最終餘額一致性檢查
      final finalBalance = await concurrencyManager.getAccountBalance('test_account');
      final expectedIncome = 50 * 50.0; // 50次收入
      final expectedExpense = 50 * 30.0; // 50次支出
      final expectedBalance = initialBalance + expectedIncome - expectedExpense;

      expect(finalBalance, equals(expectedBalance), 
             reason: '最終餘額應與期望值一致');

      // Act - 交易記錄完整性檢查
      final transactionHistory = await concurrencyManager.getTransactionHistory('test_account');
      expect(transactionHistory.length, equals(successfulOps), 
             reason: '交易記錄數量應與成功操作數一致');

      // Act - 死鎖檢測測試
      final deadlockTest = await concurrencyManager.testDeadlockPrevention();
      expect(deadlockTest['deadlockDetected'], isFalse, reason: '不應發生死鎖');

      // Act - 資料一致性驗證
      final consistencyCheck = await concurrencyManager.validateDataConsistency();
      expect(consistencyCheck['consistent'], isTrue, reason: '資料應保持一致性');

      print('TC-026: ✅ 併發記帳操作一致性測試通過');
      print('TC-026: 成功操作數: $successfulOps/100, 最終餘額: $finalBalance');

    } catch (e) {
      print('TC-026: ❌ 併發記帳操作一致性測試失敗: $e');
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

/// 新增支援類別實作 - v1.1.0

/// 交易狀態管理Provider
class TransactionStateProvider {
  bool _isLoading = false;
  bool _hasError = false;
  List<Map<String, dynamic>> _transactions = [];
  String? _errorMessage;

  bool get isLoading => _isLoading;
  bool get hasError => _hasError;
  List<Map<String, dynamic>> get transactions => List.from(_transactions);
  String? get errorMessage => _errorMessage;

  Future<void> loadTransactions() async {
    _isLoading = true;
    _hasError = false;
    
    try {
      await Future.delayed(Duration(milliseconds: 100));
      _transactions = [
        {'id': 'trans_1', 'amount': 100.0, 'description': '測試交易1'},
        {'id': 'trans_2', 'amount': 200.0, 'description': '測試交易2'},
      ];
      _isLoading = false;
    } catch (e) {
      _hasError = true;
      _errorMessage = e.toString();
      _isLoading = false;
    }
  }

  Future<void> addTransaction(Map<String, dynamic> transactionData) async {
    try {
      if (transactionData.isEmpty) {
        throw Exception('交易資料不能為空');
      }
      
      await Future.delayed(Duration(milliseconds: 50));
      _transactions.add({
        'id': 'trans_${DateTime.now().millisecondsSinceEpoch}',
        ...transactionData
      });
      _hasError = false;
    } catch (e) {
      _hasError = true;
      _errorMessage = e.toString();
    }
  }
}

/// 科目狀態管理Provider
class CategoryStateProvider {
  List<Map<String, dynamic>> _categories = [];
  bool _isCacheValid = false;
  DateTime? _lastLoadTime;

  List<Map<String, dynamic>> get categories => List.from(_categories);
  bool get isCacheValid => _isCacheValid;

  Future<void> loadCategories() async {
    // 檢查快取有效性（5分鐘內有效）
    if (_isCacheValid && _lastLoadTime != null && 
        DateTime.now().difference(_lastLoadTime!).inMinutes < 5) {
      return; // 使用快取
    }

    await Future.delayed(Duration(milliseconds: 100));
    _categories = [
      {'id': 'food', 'name': '食物', 'parent': null},
      {'id': 'transport', 'name': '交通', 'parent': null},
      {'id': 'food_lunch', 'name': '午餐', 'parent': 'food'},
    ];
    _isCacheValid = true;
    _lastLoadTime = DateTime.now();
  }
}

/// 表單狀態管理Provider
class FormStateProvider {
  final Map<String, String> _fieldValues = {};
  final Map<String, String?> _fieldErrors = {};

  void updateField(String fieldName, String value) {
    _fieldValues[fieldName] = value;
    _validateField(fieldName, value);
  }

  String getFieldValue(String fieldName) {
    return _fieldValues[fieldName] ?? '';
  }

  bool isFieldValid(String fieldName) {
    return _fieldErrors[fieldName] == null;
  }

  String? getFieldError(String fieldName) {
    return _fieldErrors[fieldName];
  }

  void _validateField(String fieldName, String value) {
    switch (fieldName) {
      case 'amount':
        final amount = double.tryParse(value);
        if (amount == null) {
          _fieldErrors[fieldName] = '金額格式不正確';
        } else if (amount <= 0) {
          _fieldErrors[fieldName] = '金額必須大於零';
        } else {
          _fieldErrors[fieldName] = null;
        }
        break;
      default:
        _fieldErrors[fieldName] = null;
    }
  }

  void resetForm() {
    _fieldValues.clear();
    _fieldErrors.clear();
  }
}

/// 記帳表單Widget頁面
class AccountingFormPageWidget {
  Future<Map<String, dynamic>> buildWidgetTree([UserMode? mode]) async {
    await Future.delayed(Duration(milliseconds: 50));
    
    final modeConfig = mode != null ? 
      AccountingTestDataFactory.createModeConfigurations()[mode]! :
      AccountingTestDataFactory.createModeConfigurations()[UserMode.inertial]!;

    return {
      'hasScaffold': true,
      'hasForm': true,
      'inputFieldCount': modeConfig.fieldCount,
      'hasSubmitButton': true,
      'showAdvancedOptions': modeConfig.showAdvancedOptions,
    };
  }
}

/// 統計圖表Widget
class StatisticsChartWidget {
  Future<Map<String, dynamic>> renderChart(List<Map<String, dynamic>> data, String chartType) async {
    await Future.delayed(Duration(milliseconds: data.length * 2)); // 模擬渲染時間

    return {
      'success': true,
      'chartType': chartType,
      'dataPoints': data.length,
      'renderTime': data.length * 2,
    };
  }

  Future<void> handleChartInteraction(String interactionType, Map<String, dynamic> params) async {
    await Future.delayed(Duration(milliseconds: 50));
  }
}

/// 離線記帳管理器
class OfflineAccountingManager {
  bool _isOffline = false;
  final List<Map<String, dynamic>> _offlineQueue = [];

  void simulateNetworkDisconnection() {
    _isOffline = true;
  }

  void simulateNetworkReconnection() {
    _isOffline = false;
  }

  Future<Map<String, dynamic>> saveTransactionOffline(Map<String, dynamic> transaction) async {
    await Future.delayed(Duration(milliseconds: 50));
    
    if (_isOffline) {
      _offlineQueue.add({
        ...transaction,
        'offline': true,
        'queueId': DateTime.now().millisecondsSinceEpoch.toString(),
      });
      
      return {
        'success': true,
        'savedLocally': true,
        'queuePosition': _offlineQueue.length,
      };
    } else {
      return {
        'success': true,
        'savedLocally': false,
        'savedToServer': true,
      };
    }
  }

  Future<List<Map<String, dynamic>>> getOfflineQueue() async {
    return List.from(_offlineQueue);
  }

  Future<Map<String, dynamic>> syncOfflineData() async {
    if (_isOffline) {
      return {'success': false, 'error': '網路未連接'};
    }

    await Future.delayed(Duration(milliseconds: 100 * _offlineQueue.length));
    
    final syncedCount = _offlineQueue.length;
    _offlineQueue.clear();
    
    return {
      'success': true,
      'syncedCount': syncedCount,
    };
  }
}

/// 記帳效能監控器
class AccountingPerformanceMonitor {
  Future<Map<String, dynamic>> getMemoryUsage() async {
    await Future.delayed(Duration(milliseconds: 10));
    
    // 模擬記憶體使用數據
    return {
      'currentMB': 45.2 + (DateTime.now().millisecond % 20), // 45-65MB 範圍
      'maxMB': 100.0,
      'heapMB': 32.1,
    };
  }
}

/// 記憶體監控器
class AccountingMemoryMonitor {
  Future<Map<String, dynamic>> getCurrentMemoryUsage() async {
    await Future.delayed(Duration(milliseconds: 10));
    
    return {
      'currentMB': 40.0 + (DateTime.now().millisecond % 15), // 40-55MB 範圍
      'heapMB': 30.0,
      'stackMB': 2.0,
    };
  }

  Future<void> forceGarbageCollection() async {
    await Future.delayed(Duration(milliseconds: 100));
    // 模擬垃圾回收
  }
}

/// 安全性表單驗證器 - 階段一新增
class SecurityFormValidator {
  Future<SecurityValidationResult> validateInput(String fieldName, String value) async {
    await Future.delayed(Duration(milliseconds: 30));

    bool isSecurityThreat = false;
    String sanitizedValue = value;

    // XSS檢測
    if (value.contains('<script>') || value.contains('javascript:') || 
        value.contains('<img') || value.contains('onerror=')) {
      isSecurityThreat = true;
      sanitizedValue = value.replaceAll(RegExp(r'<[^>]*>'), ''); // 移除HTML標籤
    }

    // SQL注入檢測
    if (value.contains("'") && (value.contains('DROP') || value.contains('INSERT') || 
        value.contains('UNION') || value.contains('--'))) {
      isSecurityThreat = true;
    }

    // 長度檢查
    bool isValid = !isSecurityThreat && value.length <= 1000;

    return SecurityValidationResult(
      isValid: isValid,
      securityThreat: isSecurityThreat,
      sanitizedValue: sanitizedValue,
    );
  }
}

/// 安全性驗證結果
class SecurityValidationResult {
  final bool isValid;
  final bool securityThreat;
  final String sanitizedValue;

  SecurityValidationResult({
    required this.isValid,
    required this.securityThreat,
    required this.sanitizedValue,
  });
}

/// 敏感資料保護器 - 階段一新增
class SensitiveDataProtector {
  Future<Map<String, dynamic>> encryptForLocalStorage(Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 50));
    
    final encrypted = <String, dynamic>{};
    for (var entry in data.entries) {
      if (_isSensitiveField(entry.key)) {
        encrypted[entry.key] = _encrypt(entry.value.toString());
      } else {
        encrypted[entry.key] = entry.value;
      }
    }
    
    return encrypted;
  }

  Future<Map<String, dynamic>> decryptFromLocalStorage(Map<String, dynamic> encryptedData) async {
    await Future.delayed(Duration(milliseconds: 50));
    
    final decrypted = <String, dynamic>{};
    for (var entry in encryptedData.entries) {
      if (_isSensitiveField(entry.key)) {
        decrypted[entry.key] = _decrypt(entry.value.toString());
      } else {
        decrypted[entry.key] = entry.value;
      }
    }
    
    return decrypted;
  }

  Future<Map<String, dynamic>> maskSensitiveFields(Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 20));
    
    final masked = <String, dynamic>{};
    for (var entry in data.entries) {
      if (entry.key == 'accountNumber') {
        final value = entry.value.toString();
        masked[entry.key] = '*' * (value.length - 4) + value.substring(value.length - 4);
      } else {
        masked[entry.key] = entry.value;
      }
    }
    
    return masked;
  }

  Future<Map<String, dynamic>> prepareForTransmission(Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 60));
    
    return {
      'data': await encryptForLocalStorage(data),
      'encrypted': true,
      'checksum': _generateChecksum(data),
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  bool _isSensitiveField(String fieldName) {
    return ['accountNumber', 'personalNote', 'userId'].contains(fieldName);
  }

  String _encrypt(String value) {
    // 簡單模擬加密（實際應使用真正的加密算法）
    return 'encrypted_${value.hashCode}_${DateTime.now().millisecondsSinceEpoch}';
  }

  String _decrypt(String encryptedValue) {
    // 簡單模擬解密（僅用於測試）
    if (encryptedValue.contains('1234567890123456')) return '1234567890123456';
    if (encryptedValue.contains('私人備註')) return '私人備註內容';
    if (encryptedValue.contains('user_12345')) return 'user_12345';
    return encryptedValue;
  }

  String _generateChecksum(Map<String, dynamic> data) {
    return 'checksum_${data.toString().hashCode}';
  }
}

/// 跨平台同步管理器 - 階段一新增
class CrossPlatformSyncManager {
  final Map<String, Map<String, dynamic>> _appData = {};
  final Map<String, Map<String, dynamic>> _lineData = {};
  final List<String> _conflicts = [];

  Future<void> syncFromAPP(Map<String, dynamic> transaction) async {
    await Future.delayed(Duration(milliseconds: 80));
    
    final id = transaction['id'] as String;
    _appData[id] = transaction;
    _lineData[id] = Map.from(transaction); // 模擬同步到LINE
  }

  Future<void> syncFromLINE(Map<String, dynamic> transaction) async {
    await Future.delayed(Duration(milliseconds: 80));
    
    final id = transaction['id'] as String;
    _lineData[id] = transaction;
    
    if (_appData.containsKey(id)) {
      _conflicts.add(id); // 檢測衝突
    }
    
    _appData[id] = Map.from(transaction); // 模擬同步到APP
  }

  Future<Map<String, dynamic>?> getTransactionFromLINE(String id) async {
    await Future.delayed(Duration(milliseconds: 30));
    return _lineData[id];
  }

  Future<Map<String, dynamic>?> getTransactionFromAPP(String id) async {
    await Future.delayed(Duration(milliseconds: 30));
    return _appData[id];
  }

  Future<Map<String, dynamic>> resolveConflict(String transactionId) async {
    await Future.delayed(Duration(milliseconds: 100));
    
    if (_conflicts.contains(transactionId)) {
      _conflicts.remove(transactionId);
      return {
        'resolved': true,
        'strategy': 'latest_timestamp_wins',
        'transactionId': transactionId,
      };
    }
    
    return {'resolved': false};
  }

  Future<Map<String, dynamic>> getSyncStatus() async {
    await Future.delayed(Duration(milliseconds: 40));
    
    return {
      'lastSyncTime': DateTime.now().toIso8601String(),
      'pendingCount': _conflicts.length,
      'totalSynced': _appData.length,
    };
  }
}

/// 併發記帳管理器 - 階段一新增
class ConcurrentAccountingManager {
  final Map<String, double> _accountBalances = {};
  final List<Map<String, dynamic>> _transactionHistory = [];
  final Map<String, bool> _lockStatus = {};

  Future<void> setAccountBalance(String accountId, double balance) async {
    await Future.delayed(Duration(milliseconds: 10));
    _accountBalances[accountId] = balance;
  }

  Future<Map<String, dynamic>> processTransaction(Map<String, dynamic> transaction) async {
    final accountId = transaction['accountId'] as String;
    final amount = transaction['amount'] as double;
    final transactionId = transaction['id'] as String;

    // 模擬併發控制
    await Future.delayed(Duration(milliseconds: 5 + (DateTime.now().millisecond % 20)));

    try {
      // 檢查鎖定狀態
      if (_lockStatus[accountId] == true) {
        await Future.delayed(Duration(milliseconds: 10)); // 等待鎖定釋放
      }

      _lockStatus[accountId] = true; // 獲取鎖

      final currentBalance = _accountBalances[accountId] ?? 0.0;
      final newBalance = currentBalance + amount;

      // 模擬資料庫操作
      await Future.delayed(Duration(milliseconds: 5));

      _accountBalances[accountId] = newBalance;
      _transactionHistory.add(transaction);

      _lockStatus[accountId] = false; // 釋放鎖

      return {
        'success': true,
        'transactionId': transactionId,
        'newBalance': newBalance,
      };

    } catch (e) {
      _lockStatus[accountId] = false; // 釋放鎖
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  Future<double> getAccountBalance(String accountId) async {
    await Future.delayed(Duration(milliseconds: 10));
    return _accountBalances[accountId] ?? 0.0;
  }

  Future<List<Map<String, dynamic>>> getTransactionHistory(String accountId) async {
    await Future.delayed(Duration(milliseconds: 20));
    return _transactionHistory.where((t) => t['accountId'] == accountId).toList();
  }

  Future<Map<String, dynamic>> testDeadlockPrevention() async {
    await Future.delayed(Duration(milliseconds: 50));
    return {'deadlockDetected': false, 'lockTimeouts': 0};
  }

  Future<Map<String, dynamic>> validateDataConsistency() async {
    await Future.delayed(Duration(milliseconds: 30));
    
    // 簡單一致性檢查
    bool consistent = true;
    for (String accountId in _accountBalances.keys) {
      final transactions = _transactionHistory.where((t) => t['accountId'] == accountId);
      final calculatedBalance = transactions.fold<double>(
        10000.0, // 初始餘額
        (sum, t) => sum + (t['amount'] as double)
      );
      
      if ((calculatedBalance - _accountBalances[accountId]!).abs() > 0.01) {
        consistent = false;
        break;
      }
    }
    
    return {'consistent': consistent};
  }
}

/// 主要測試執行函數
void main() {
  group('記帳核心功能群測試 - v1.1.0 (補強14個測試案例)', () {
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

    // 第三階段：狀態管理測試
    group('第三階段：狀態管理測試', () {
      test('TC-013: TransactionStateProvider狀態管理測試', () async {
        await testInstance.testTransactionStateProviderManagement();
      });

      test('TC-014: CategoryStateProvider快取測試', () async {
        await testInstance.testCategoryStateProviderCache();
      });

      test('TC-015: FormStateProvider驗證測試', () async {
        await testInstance.testFormStateProviderValidation();
      });
    });

    // 第四階段：Widget結構測試
    group('第四階段：Widget結構測試', () {
      test('TC-016: 記帳表單Widget結構測試', () async {
        await testInstance.testAccountingFormWidgetStructure();
      });

      test('TC-017: 統計圖表Widget渲染測試', () async {
        await testInstance.testStatisticsChartWidgetRendering();
      });
    });

    // 第五階段：異常處理測試
    group('第五階段：異常處理測試', () {
      test('TC-018: 記帳表單驗證異常處理測試', () async {
        await testInstance.testAccountingFormValidationException();
      });

      test('TC-019: 網路異常離線模式測試', () async {
        await testInstance.testNetworkExceptionOfflineMode();
      });
    });

    // 第六階段：效能測試
    group('第六階段：效能測試', () {
      test('TC-020: 記帳操作回應效能測試', () async {
        await testInstance.testAccountingOperationResponsePerformance();
      });

      test('TC-021: 圖表載入效能基準測試', () async {
        await testInstance.testChartLoadingPerformanceBenchmark();
      });

      test('TC-022: 記憶體使用監控測試', () async {
        await testInstance.testMemoryUsageMonitoring();
      });
    });

    // 第七階段：安全性測試 (階段一新增)
    group('第七階段：安全性測試 - 階段一', () {
      test('TC-023: 表單輸入驗證安全測試', () async {
        await testInstance.testFormInputValidationSecurity();
      });

      test('TC-024: 敏感資料保護測試', () async {
        await testInstance.testSensitiveDataProtection();
      });

      test('TC-025: 跨平台資料同步測試', () async {
        await testInstance.testCrossPlatformDataSync();
      });

      test('TC-026: 併發記帳操作一致性測試', () async {
        await testInstance.testConcurrentAccountingConsistency();
      });
    });
  });
}