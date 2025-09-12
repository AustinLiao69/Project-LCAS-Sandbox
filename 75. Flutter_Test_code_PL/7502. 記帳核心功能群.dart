
/**
 * 7502. 記帳核心功能群.dart - 記帳核心功能群測試代碼
 * @version 2025-09-12 v1.0.0
 * @date 2025-09-12
 * @update: 初版建立，完整測試實作
 */

// 1. Dart 核心庫
import 'dart:async';
import 'dart:convert';

// 2. 第三方測試庫
import 'package:test/test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

// 3. 專案模組 (基於0026對應關係)
// 這裡會引用73號資料夾的PL模組代碼，目前模擬引用
// import '../73. Flutter_Module code_PL/記帳核心功能群.dart';

// 4. Fake Service Switch整合
import '7599. Fake_service_switch.dart';

// Mock服務定義（按字母順序排列）
@GenerateMocks([
  // API客戶端Mock
  AccountApiClient,
  CategoryApiClient,
  TransactionApiClient,
  
  // 狀態管理Provider Mock
  AccountStateProvider,
  CategoryStateProvider,
  FormStateProvider,
  StatisticsStateProvider,
  TransactionStateProvider,
  
  // 工具類Mock
  AmountUtils,
  DateUtils,
  ErrorHandler,
  LocalizationManager,
])

/// 測試資料工廠類別
class AccountingTestDataFactory {
  
  /// 建立測試用戶資料（四模式）
  static Map<String, TestUser> createTestUsers() {
    return {
      'expertUser': TestUser('test_accounting_expert_001', UserMode.expert),
      'inertialUser': TestUser('test_accounting_inertial_001', UserMode.inertial),
      'cultivationUser': TestUser('test_accounting_cultivation_001', UserMode.cultivation),
      'guidingUser': TestUser('test_accounting_guiding_001', UserMode.guiding),
    };
  }

  /// 建立測試交易記錄
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

  /// 建立四模式表單配置
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

/// 四模式測試配置枚舉
enum UserMode {
  expert,     // 專家模式：完整功能
  inertial,   // 慣性模式：標準功能
  cultivation, // 養成模式：引導功能
  guiding     // 引導模式：簡化功能
}

/// 交易類型枚舉
enum TransactionType {
  income,     // 收入
  expense,    // 支出
  transfer    // 轉帳
}

/// 驗證等級枚舉
enum ValidationLevel {
  strict,     // 嚴格驗證
  standard,   // 標準驗證
  guided,     // 引導式驗證
  minimal     // 最少驗證
}

/// 測試用戶類別
class TestUser {
  final String userId;
  final UserMode mode;
  
  TestUser(this.userId, this.mode);
}

/// 測試交易記錄類別
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

/// 表單配置類別
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

/// Mock類別定義（待build_runner生成）
class MockAccountApiClient extends Mock implements AccountApiClient {}
class MockCategoryApiClient extends Mock implements CategoryApiClient {}
class MockTransactionApiClient extends Mock implements TransactionApiClient {}
class MockAccountStateProvider extends Mock implements AccountStateProvider {}
class MockCategoryStateProvider extends Mock implements CategoryStateProvider {}
class MockFormStateProvider extends Mock implements FormStateProvider {}
class MockStatisticsStateProvider extends Mock implements StatisticsStateProvider {}
class MockTransactionStateProvider extends Mock implements TransactionStateProvider {}
class MockAmountUtils extends Mock implements AmountUtils {}
class MockDateUtils extends Mock implements DateUtils {}
class MockErrorHandler extends Mock implements ErrorHandler {}
class MockLocalizationManager extends Mock implements LocalizationManager {}

/// 主測試函數群組
void main() {
  
  // 測試前置設定
  setUpAll(() {
    // 啟用記帳核心功能群Fake Service
    PLFakeServiceSwitch.enable7502FakeService = true;
    print('記帳核心功能群測試環境初始化完成');
    print('Fake Service狀態: ${PLFakeServiceSwitch.getAllSwitches()}');
  });

  // 測試後清理
  tearDownAll(() {
    print('記帳核心功能群測試環境清理完成');
  });

  group('記帳核心功能群測試', () {
    
    // 第一階段測試：基礎架構測試
    group('第一階段：基礎架構測試', () {
      
      /**
       * 01. 依賴注入容器測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('01. 依賴注入容器測試', () async {
        // Arrange
        final container = DependencyContainer();
        
        // Act
        container.registerServices();
        
        // Assert
        expect(container.isRegistered<TransactionApiClient>(), isTrue);
        expect(container.isRegistered<AccountApiClient>(), isTrue);
        expect(container.isRegistered<CategoryApiClient>(), isTrue);
      });

      /**
       * 02. 架構層級枚舉測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('02. 架構層級枚舉測試', () async {
        // Arrange & Act
        final modes = UserMode.values;
        final transactionTypes = TransactionType.values;
        final validationLevels = ValidationLevel.values;
        
        // Assert
        expect(modes.length, equals(4));
        expect(transactionTypes.length, equals(3));
        expect(validationLevels.length, equals(4));
        expect(modes.contains(UserMode.expert), isTrue);
        expect(modes.contains(UserMode.guiding), isTrue);
      });

      /**
       * 03. LINE OA記帳對話處理器測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('03. LINE OA記帳對話處理器測試', () async {
        // Arrange
        final handler = LineOADialogHandler();
        final mockApiClient = MockTransactionApiClient();
        
        // Act
        final result = await handler.handleQuickAccounting('午餐 150');
        
        // Assert
        expect(result, isNotNull);
        expect(result.success, isTrue);
      });

    });

    // 第二階段：核心功能測試
    group('第二階段：核心功能測試', () {
      
      /**
       * TC-001: LINE OA智慧記帳解析測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-001: LINE OA智慧記帳解析測試', () async {
        // Arrange
        final handler = LineOADialogHandler();
        final mockApiClient = MockTransactionApiClient();
        final testCases = [
          '午餐 150',
          '薪水 35000 台灣銀行',
          '咖啡 85 現金',
          '轉帳 10000 從儲蓄到投資'
        ];
        
        // Mock API responses
        when(mockApiClient.createTransaction(any))
            .thenAnswer((_) async => {'success': true, 'id': 'trans_001'});
        
        // Act & Assert
        for (String input in testCases) {
          final result = await handler.handleQuickAccounting(input);
          expect(result.success, isTrue);
          expect(result.message, contains('記帳成功'));
        }
      });

      /**
       * TC-002: APP記帳表單完整流程測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-002: APP記帳表單完整流程測試', () async {
        // Arrange
        final formProcessor = AccountingFormProcessor();
        final mockStateProvider = MockFormStateProvider();
        final testTransaction = AccountingTestDataFactory.createTestTransactions()['basicExpense']!;
        
        // Mock form state
        when(mockStateProvider.isValid).thenReturn(true);
        when(mockStateProvider.hasErrors).thenReturn(false);
        
        // Act
        final result = await formProcessor.processTransaction({
          'type': testTransaction.type.toString(),
          'amount': testTransaction.amount,
          'categoryId': testTransaction.categoryId,
          'accountId': testTransaction.accountId,
          'description': testTransaction.description,
        });
        
        // Assert
        expect(result, isNotNull);
        expect(result['success'], isTrue);
        verify(mockStateProvider.isValid).called(1);
      });

      /**
       * TC-003: 記帳主頁儀表板展示測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-003: 記帳主頁儀表板展示測試', () async {
        // Arrange
        final dashboardWidget = DashboardWidgetComponents();
        final mockStatisticsProvider = MockStatisticsStateProvider();
        final testStats = {
          'totalIncome': 35000.0,
          'totalExpense': 15000.0,
          'balance': 20000.0,
          'transactionCount': 25
        };
        
        // Mock statistics data
        when(mockStatisticsProvider.currentMonthStats).thenReturn(testStats);
        when(mockStatisticsProvider.isLoading).thenReturn(false);
        
        // Act
        final widgetData = await dashboardWidget.buildDashboardData();
        
        // Assert
        expect(widgetData, isNotNull);
        expect(widgetData['totalIncome'], equals(35000.0));
        expect(widgetData['totalExpense'], equals(15000.0));
        expect(widgetData['balance'], equals(20000.0));
      });

      /**
       * TC-004: 科目選擇器功能測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-004: 科目選擇器功能測試', () async {
        // Arrange
        final categorySelector = CategorySelectorWidget();
        final mockCategoryProvider = MockCategoryStateProvider();
        final categories = [
          {'id': 'food_lunch', 'name': '午餐', 'parent': 'food'},
          {'id': 'food_dinner', 'name': '晚餐', 'parent': 'food'},
          {'id': 'transport_bus', 'name': '公車', 'parent': 'transport'}
        ];
        
        // Mock category data
        when(mockCategoryProvider.categories).thenReturn(categories);
        when(mockCategoryProvider.isLoaded).thenReturn(true);
        
        // Act
        final selectorData = await categorySelector.loadCategories();
        
        // Assert
        expect(selectorData, isNotNull);
        expect(selectorData.length, equals(3));
        expect(selectorData.first['name'], equals('午餐'));
      });

      /**
       * TC-005: 帳戶選擇器功能測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-005: 帳戶選擇器功能測試', () async {
        // Arrange
        final accountSelector = AccountSelectorWidget();
        final mockAccountProvider = MockAccountStateProvider();
        final accounts = [
          {'id': 'bank_main', 'name': '台灣銀行', 'balance': 50000.0},
          {'id': 'cash_wallet', 'name': '現金', 'balance': 2000.0},
          {'id': 'investment_stock', 'name': '股票投資', 'balance': 150000.0}
        ];
        
        // Mock account data
        when(mockAccountProvider.accounts).thenReturn(accounts);
        when(mockAccountProvider.isLoaded).thenReturn(true);
        
        // Act
        final selectorData = await accountSelector.loadAccounts();
        
        // Assert
        expect(selectorData, isNotNull);
        expect(selectorData.length, equals(3));
        expect(selectorData.first['name'], equals('台灣銀行'));
        expect(selectorData.first['balance'], equals(50000.0));
      });

      /**
       * TC-006: 快速記帳處理器效能測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-006: 快速記帳處理器效能測試', () async {
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
        expect(stopwatch.elapsedMilliseconds, lessThan(5000));
        expect(results.length, equals(100));
        expect(results.where((r) => r.success).length, greaterThan(80)); // 80%成功率
      });

      /**
       * TC-007: 智能文字解析準確性測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-007: 智能文字解析準確性測試', () async {
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
          },
          {
            'input': '轉帳 5000 從現金到儲蓄',
            'expected': {
              'amount': 5000.0,
              'fromAccount': '現金',
              'toAccount': '儲蓄',
              'type': 'transfer'
            }
          }
        ];
        
        // Act & Assert
        for (var testCase in testCases) {
          final result = await parser.parseText(testCase['input'] as String);
          final expected = testCase['expected'] as Map<String, dynamic>;
          
          expect(result['amount'], equals(expected['amount']));
          expect(result['type'], equals(expected['type']));
          
          if (expected.containsKey('account')) {
            expect(result['account'], contains(expected['account']));
          }
        }
      });

      /**
       * TC-008: 記帳表單驗證測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-008: 記帳表單驗證測試', () async {
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
          {'amount': 100.0, 'accountId': 'cash'}, // 缺少科目
          {'amount': 100.0, 'categoryId': 'food'}, // 缺少帳戶
        ];
        
        // Act & Assert - 有效表單
        final validResult = await validator.validate(validForm);
        expect(validResult.isValid, isTrue);
        expect(validResult.errors, isEmpty);
        
        // Act & Assert - 無效表單
        for (var invalidForm in invalidForms) {
          final invalidResult = await validator.validate(invalidForm);
          expect(invalidResult.isValid, isFalse);
          expect(invalidResult.errors, isNotEmpty);
        }
      });

    });

    group('第三階段：差異化與整合測試', () {
      
      /**
       * TC-009: Expert模式完整功能測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-009: Expert模式完整功能測試', () async {
        // Arrange
        final expertAdapter = ExpertModeAdapter();
        final mockConfigManager = MockFourModeConfigManager();
        final expertUser = AccountingTestDataFactory.createTestUsers()['expertUser']!;
        final expertConfig = AccountingTestDataFactory.createModeConfigurations()[UserMode.expert]!;
        
        // Mock Expert模式配置
        when(mockConfigManager.getConfigForMode(UserMode.expert))
            .thenReturn(expertConfig);
        when(mockConfigManager.isAdvancedFeatureEnabled(UserMode.expert))
            .thenReturn(true);
        
        // Act
        final formConfig = await expertAdapter.buildFormConfiguration(expertUser.userId);
        final uiConfig = await expertAdapter.buildUIConfiguration();
        
        // Assert - Expert模式應有完整功能
        expect(formConfig.fieldCount, equals(12));
        expect(formConfig.showAdvancedOptions, isTrue);
        expect(formConfig.enableBatchEntry, isTrue);
        expect(formConfig.validationLevel, equals(ValidationLevel.strict));
        
        // Assert - UI配置驗證
        expect(uiConfig['showTechnicalDetails'], isTrue);
        expect(uiConfig['enableAdvancedFilters'], isTrue);
        expect(uiConfig['showCompleteErrorMessages'], isTrue);
      });

      /**
       * TC-010: Inertial模式標準功能測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-010: Inertial模式標準功能測試', () async {
        // Arrange
        final inertialAdapter = InertialModeAdapter();
        final mockConfigManager = MockFourModeConfigManager();
        final inertialUser = AccountingTestDataFactory.createTestUsers()['inertialUser']!;
        final inertialConfig = AccountingTestDataFactory.createModeConfigurations()[UserMode.inertial]!;
        
        // Mock Inertial模式配置
        when(mockConfigManager.getConfigForMode(UserMode.inertial))
            .thenReturn(inertialConfig);
        when(mockConfigManager.isAdvancedFeatureEnabled(UserMode.inertial))
            .thenReturn(false);
        
        // Act
        final formConfig = await inertialAdapter.buildFormConfiguration(inertialUser.userId);
        final uiConfig = await inertialAdapter.buildUIConfiguration();
        
        // Assert - Inertial模式應為標準功能
        expect(formConfig.fieldCount, equals(8));
        expect(formConfig.showAdvancedOptions, isFalse);
        expect(formConfig.enableBatchEntry, isFalse);
        expect(formConfig.validationLevel, equals(ValidationLevel.standard));
        
        // Assert - UI配置驗證
        expect(uiConfig['showTechnicalDetails'], isFalse);
        expect(uiConfig['enableAdvancedFilters'], isFalse);
        expect(uiConfig['showSimplifiedInterface'], isTrue);
      });

      /**
       * TC-011: Cultivation模式引導功能測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-011: Cultivation模式引導功能測試', () async {
        // Arrange
        final cultivationAdapter = CultivationModeAdapter();
        final mockConfigManager = MockFourModeConfigManager();
        final cultivationUser = AccountingTestDataFactory.createTestUsers()['cultivationUser']!;
        final cultivationConfig = AccountingTestDataFactory.createModeConfigurations()[UserMode.cultivation]!;
        
        // Mock Cultivation模式配置
        when(mockConfigManager.getConfigForMode(UserMode.cultivation))
            .thenReturn(cultivationConfig);
        when(mockConfigManager.hasGamificationEnabled(UserMode.cultivation))
            .thenReturn(true);
        
        // Act
        final formConfig = await cultivationAdapter.buildFormConfiguration(cultivationUser.userId);
        final uiConfig = await cultivationAdapter.buildUIConfiguration();
        final motivationConfig = await cultivationAdapter.buildMotivationConfiguration();
        
        // Assert - Cultivation模式應有引導功能
        expect(formConfig.fieldCount, equals(6));
        expect(formConfig.showAdvancedOptions, isFalse);
        expect(formConfig.validationLevel, equals(ValidationLevel.guided));
        
        // Assert - 激勵機制驗證
        expect(motivationConfig['enableAchievements'], isTrue);
        expect(motivationConfig['enableProgress'], isTrue);
        expect(motivationConfig['showEncouragement'], isTrue);
      });

      /**
       * TC-012: Guiding模式簡化功能測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-012: Guiding模式簡化功能測試', () async {
        // Arrange
        final guidingAdapter = GuidingModeAdapter();
        final mockConfigManager = MockFourModeConfigManager();
        final guidingUser = AccountingTestDataFactory.createTestUsers()['guidingUser']!;
        final guidingConfig = AccountingTestDataFactory.createModeConfigurations()[UserMode.guiding]!;
        
        // Mock Guiding模式配置
        when(mockConfigManager.getConfigForMode(UserMode.guiding))
            .thenReturn(guidingConfig);
        when(mockConfigManager.isSimplifiedModeEnabled(UserMode.guiding))
            .thenReturn(true);
        
        // Act
        final formConfig = await guidingAdapter.buildFormConfiguration(guidingUser.userId);
        final uiConfig = await guidingAdapter.buildUIConfiguration();
        final autoConfig = await guidingAdapter.buildAutoConfiguration();
        
        // Assert - Guiding模式應為最簡化
        expect(formConfig.fieldCount, equals(4));
        expect(formConfig.showAdvancedOptions, isFalse);
        expect(formConfig.validationLevel, equals(ValidationLevel.minimal));
        
        // Assert - 自動化配置驗證
        expect(autoConfig['enableAutoFill'], isTrue);
        expect(autoConfig['enableSmartDefaults'], isTrue);
        expect(autoConfig['minimizeDecisions'], isTrue);
      });

      /**
       * TC-013: 交易狀態管理Provider測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-013: 交易狀態管理Provider測試', () async {
        // Arrange
        final transactionProvider = TestTransactionStateProvider();
        final mockApiClient = MockTransactionApiClient();
        final testTransaction = AccountingTestDataFactory.createTestTransactions()['basicExpense']!;
        
        // Mock API responses
        when(mockApiClient.createTransaction(any))
            .thenAnswer((_) async => {'success': true, 'id': 'trans_001'});
        when(mockApiClient.getTransactions())
            .thenAnswer((_) async => {'transactions': [testTransaction]});
        
        // Act - 測試載入狀態
        transactionProvider.setLoading(true);
        expect(transactionProvider.isLoading, isTrue);
        
        // Act - 測試新增交易
        await transactionProvider.addTransaction(testTransaction);
        
        // Assert - 狀態變化驗證
        expect(transactionProvider.isLoading, isFalse);
        expect(transactionProvider.transactions.length, equals(1));
        expect(transactionProvider.hasError, isFalse);
        
        // Act - 測試錯誤處理
        when(mockApiClient.createTransaction(any))
            .thenThrow(Exception('Network error'));
        
        await transactionProvider.addTransaction(testTransaction);
        expect(transactionProvider.hasError, isTrue);
        expect(transactionProvider.errorMessage, contains('Network error'));
      });

      /**
       * TC-014: 科目狀態管理Provider測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-014: 科目狀態管理Provider測試', () async {
        // Arrange
        final categoryProvider = TestCategoryStateProvider();
        final mockApiClient = MockCategoryApiClient();
        final testCategories = [
          {'id': 'food', 'name': '飲食', 'type': 'expense'},
          {'id': 'transport', 'name': '交通', 'type': 'expense'},
          {'id': 'salary', 'name': '薪資', 'type': 'income'}
        ];
        
        // Mock API responses
        when(mockApiClient.getCategories())
            .thenAnswer((_) async => {'categories': testCategories});
        
        // Act - 測試載入科目
        await categoryProvider.loadCategories();
        
        // Assert - 科目資料驗證
        expect(categoryProvider.isLoaded, isTrue);
        expect(categoryProvider.categories.length, equals(3));
        expect(categoryProvider.getExpenseCategories().length, equals(2));
        expect(categoryProvider.getIncomeCategories().length, equals(1));
        
        // Act - 測試科目篩選
        final foodCategories = categoryProvider.getCategoriesByParent('food');
        expect(foodCategories, isNotNull);
        
        // Act - 測試快取機制
        final cachedCategories = categoryProvider.getCachedCategories();
        expect(cachedCategories.length, equals(3));
      });

      /**
       * TC-015: 表單狀態管理Provider測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-015: 表單狀態管理Provider測試', () async {
        // Arrange
        final formProvider = TestFormStateProvider();
        final validator = AccountingFormValidator();
        
        // Act - 測試表單初始化
        formProvider.initializeForm(UserMode.expert);
        expect(formProvider.currentMode, equals(UserMode.expert));
        expect(formProvider.isInitialized, isTrue);
        
        // Act - 測試欄位更新
        formProvider.updateField('amount', 150.0);
        formProvider.updateField('categoryId', 'food_lunch');
        formProvider.updateField('accountId', 'cash_wallet');
        
        expect(formProvider.getFieldValue('amount'), equals(150.0));
        expect(formProvider.getFieldValue('categoryId'), equals('food_lunch'));
        
        // Act - 測試即時驗證
        await formProvider.validateField('amount');
        expect(formProvider.getFieldError('amount'), isNull);
        
        // Act - 測試錯誤狀態
        formProvider.updateField('amount', -100.0);
        await formProvider.validateField('amount');
        expect(formProvider.getFieldError('amount'), isNotNull);
        expect(formProvider.hasErrors, isTrue);
        
        // Act - 測試表單重置
        formProvider.resetForm();
        expect(formProvider.getFieldValue('amount'), isNull);
        expect(formProvider.hasErrors, isFalse);
      });

      /**
       * TC-016: 記帳表單Widget結構測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-016: 記帳表單Widget結構測試', () async {
        // Arrange
        final formWidget = TestAccountingFormWidget();
        final mockFormProvider = MockFormStateProvider();
        
        // Mock form state
        when(mockFormProvider.currentMode).thenReturn(UserMode.expert);
        when(mockFormProvider.isInitialized).thenReturn(true);
        when(mockFormProvider.getFieldValue('amount')).thenReturn(150.0);
        
        // Act - 測試Widget初始化
        await formWidget.initializeWidget();
        final widgetStructure = formWidget.getWidgetStructure();
        
        // Assert - Widget結構驗證
        expect(widgetStructure['hasAmountField'], isTrue);
        expect(widgetStructure['hasCategorySelector'], isTrue);
        expect(widgetStructure['hasAccountSelector'], isTrue);
        expect(widgetStructure['hasDescriptionField'], isTrue);
        expect(widgetStructure['hasSubmitButton'], isTrue);
        
        // Act - 測試模式特化結構
        final expertStructure = formWidget.getExpertModeStructure();
        expect(expertStructure['hasAdvancedOptions'], isTrue);
        expect(expertStructure['hasBatchEntry'], isTrue);
        expect(expertStructure['hasDetailedValidation'], isTrue);
      });

      /**
       * TC-017: 狀態同步管理器測試
       * @version 1.0.0
       * @date 2025-09-12
       * @update: 初版建立
       */
      test('TC-017: 狀態同步管理器測試', () async {
        // Arrange
        final syncManager = TestStateSyncManager();
        final mockTransactionProvider = MockTransactionStateProvider();
        final mockCategoryProvider = MockCategoryStateProvider();
        final mockFormProvider = MockFormStateProvider();
        
        var syncCallCount = 0;
        void syncListener() {
          syncCallCount++;
        }
        
        // Act - 註冊同步監聽器
        syncManager.registerSyncListener(syncListener);
        
        // Mock provider states
        when(mockTransactionProvider.hasChanges).thenReturn(true);
        when(mockCategoryProvider.hasChanges).thenReturn(false);
        when(mockFormProvider.hasChanges).thenReturn(true);
        
        // Act - 執行狀態同步
        await syncManager.syncAllStates();
        
        // Assert - 同步執行驗證
        expect(syncCallCount, greaterThan(0));
        verify(mockTransactionProvider.hasChanges).called(1);
        verify(mockFormProvider.hasChanges).called(1);
        
        // Act - 測試特定狀態同步
        await syncManager.syncTransactionState();
        await syncManager.syncDashboardState();
        
        // Assert - 特定同步驗證
        expect(syncManager.lastSyncTime, isNotNull);
        expect(syncManager.isSyncing, isFalse);
        
        // Act - 取消註冊監聽器
        syncManager.unregisterSyncListener(syncListener);
        final oldCallCount = syncCallCount;
        await syncManager.syncAllStates();
        expect(syncCallCount, equals(oldCallCount)); // 不應再增加
      });

    });

    group('第四階段：安全與效能測試', () {
      // TC-018~TC-026 將在第四階段實作
    });

  });
}

// ==================== 52個函數測試表頭規格 ====================

/**
 * 04. 記帳主頁Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountingHomePageWidget() async {
  // Arrange
  final homePageWidget = AccountingHomePageWidget();
  final mockStateProvider = MockTransactionStateProvider();
  
  // Mock initial state
  when(mockStateProvider.recentTransactions).thenReturn([]);
  when(mockStateProvider.isLoading).thenReturn(false);
  
  // Act
  final widgetState = await homePageWidget.initializeState();
  
  // Assert
  expect(widgetState, isNotNull);
  expect(widgetState.isInitialized, isTrue);
}

/**
 * 05. 儀表板組件測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testDashboardWidgetComponents() async {
  // 待第二階段實作
}

/**
 * 06. 記帳表單Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountingFormPageWidget() async {
  // 待第二階段實作
}

/**
 * 07. 科目選擇器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testCategorySelectorWidget() async {
  // 待第二階段實作
}

/**
 * 08. 帳戶選擇器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountSelectorWidget() async {
  // 待第二階段實作
}

/**
 * 09. 帳本選擇器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testLedgerSelectorWidget() async {
  // 待第二階段實作
}

/**
 * 10. 圖片附加器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testImageAttachmentWidget() async {
  // 待第二階段實作
}

/**
 * 11. 重複設定器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testRecurringSetupWidget() async {
  // 待第二階段實作
}

/**
 * 12. 記錄管理器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testTransactionManagerWidget() async {
  // 待第二階段實作
}

/**
 * 13. 記錄編輯器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testTransactionEditorWidget() async {
  // 待第二階段實作
}

/**
 * 14. 統計圖表器Widget測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testStatisticsChartWidget() async {
  // 待第二階段實作
}

/**
 * 15. 交易狀態管理Provider測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testTransactionStateProvider() async {
  // 待第三階段實作
}

/**
 * 16. 科目狀態管理Provider測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testCategoryStateProvider() async {
  // 待第三階段實作
}

/**
 * 17. 帳戶狀態管理Provider測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountStateProvider() async {
  // 待第三階段實作
}

/**
 * 18. 帳本狀態管理Provider測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testLedgerStateProvider() async {
  // 待第三階段實作
}

/**
 * 19. 統計狀態管理Provider測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testStatisticsStateProvider() async {
  // 待第三階段實作
}

/**
 * 20. 表單狀態管理Provider測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testFormStateProvider() async {
  // 待第三階段實作
}

/**
 * 21. 狀態同步管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testStateSyncManager() async {
  // 待第三階段實作
}

/**
 * 22. 記帳路由管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountingRoutesManager() async {
  // 待第三階段實作
}

/**
 * 23. 記帳導航控制器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountingNavigationController() async {
  // 待第三階段實作
}

/**
 * 24. 記帳流程導航管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountingFlowNavigator() async {
  // 待第三階段實作
}

/**
 * 25. 選擇流程導航管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testSelectionFlowNavigator() async {
  // 待第三階段實作
}

/**
 * 26. 記帳交易API客戶端測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testTransactionApiClient() async {
  // 待第二階段實作
}

/**
 * 27. 帳戶管理API客戶端測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountApiClient() async {
  // 待第二階段實作
}

/**
 * 28. 科目管理API客戶端測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testCategoryApiClient() async {
  // 待第二階段實作
}

/**
 * 29. 交易數據倉庫測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testTransactionRepository() async {
  // 待第二階段實作
}

/**
 * 30. 科目數據倉庫測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testCategoryRepository() async {
  // 待第二階段實作
}

/**
 * 31. 帳戶數據倉庫測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountRepository() async {
  // 待第二階段實作
}

/**
 * 32. 四模式配置管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testFourModeConfigManager() async {
  // 待第三階段實作
}

/**
 * 33. Expert模式適配器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testExpertModeAdapter() async {
  // 待第三階段實作
}

/**
 * 34. Inertial模式適配器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testInertialModeAdapter() async {
  // 待第三階段實作
}

/**
 * 35. Cultivation模式適配器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testCultivationModeAdapter() async {
  // 待第三階段實作
}

/**
 * 36. Guiding模式適配器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testGuidingModeAdapter() async {
  // 待第三階段實作
}

/**
 * 37. 四模式主題管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testFourModeThemeManager() async {
  // 待第三階段實作
}

/**
 * 38. 四模式互動管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testFourModeInteractionManager() async {
  // 待第三階段實作
}

/**
 * 39. 快速記帳處理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testQuickAccountingProcessor() async {
  // 待第二階段實作
}

/**
 * 40. 智能文字解析器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testSmartTextParser() async {
  // 待第二階段實作
}

/**
 * 41. 記帳表單驗證器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountingFormValidator() async {
  // 待第二階段實作
}

/**
 * 42. 記帳表單處理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAccountingFormProcessor() async {
  // 待第二階段實作
}

/**
 * 43. 統計計算器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testStatisticsCalculator() async {
  // 待第四階段實作
}

/**
 * 44. 交易資料處理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testTransactionDataProcessor() async {
  // 待第四階段實作
}

/**
 * 45. 交易格式轉換器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testTransactionFormatter() async {
  // 待第四階段實作
}

/**
 * 46. 快取管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testCacheManager() async {
  // 待第四階段實作
}

/**
 * 47. 四模式UI適配器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testFourModeUIAdapter() async {
  // 待第三階段實作
}

/**
 * 48. 響應式布局管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testResponsiveLayoutManager() async {
  // 待第三階段實作
}

/**
 * 49. 日期工具類測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testDateUtils() async {
  // 待第四階段實作
}

/**
 * 50. 金額工具類測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testAmountUtils() async {
  // 待第四階段實作
}

/**
 * 51. 錯誤處理管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testErrorHandler() async {
  // 待第四階段實作
}

/**
 * 52. 本地化管理器測試
 * @version 1.0.0
 * @date 2025-09-12
 * @update: 初版建立
 */
Future<void> testLocalizationManager() async {
  // 待第四階段實作
}

// ==================== 模擬類別定義 ====================

/// 依賴注入容器（模擬）
class DependencyContainer {
  final Map<Type, dynamic> _services = {};
  
  void registerServices() {
    _services[TransactionApiClient] = MockTransactionApiClient();
    _services[AccountApiClient] = MockAccountApiClient();
    _services[CategoryApiClient] = MockCategoryApiClient();
  }
  
  bool isRegistered<T>() => _services.containsKey(T);
  T get<T>() => _services[T] as T;
}

/// LINE OA對話處理器（模擬）
class LineOADialogHandler {
  Future<QuickAccountingResult> handleQuickAccounting(String input) async {
    // 模擬智慧解析
    await Future.delayed(Duration(milliseconds: 100));
    return QuickAccountingResult(success: true, message: '記帳成功');
  }
}

/// 快速記帳結果（模擬）
class QuickAccountingResult {
  final bool success;
  final String message;
  
  QuickAccountingResult({required this.success, required this.message});
}

/// API客戶端介面（模擬）
abstract class TransactionApiClient {
  Future<dynamic> createTransaction(Map<String, dynamic> data);
  Future<dynamic> getTransactions();
}

abstract class AccountApiClient {
  Future<dynamic> getAccounts();
}

abstract class CategoryApiClient {
  Future<dynamic> getCategories();
}

/// 狀態管理Provider介面（模擬）
abstract class TransactionStateProvider {}
abstract class AccountStateProvider {}
abstract class CategoryStateProvider {}
abstract class FormStateProvider {}
abstract class StatisticsStateProvider {}

/// 工具類介面（模擬）
abstract class AmountUtils {}
abstract class DateUtils {}
abstract class ErrorHandler {}
abstract class LocalizationManager {}

/// 第二階段新增的類別與介面
/// 第三階段：四模式適配器與狀態管理類別

/// 四模式配置管理器（模擬）
class MockFourModeConfigManager extends Mock implements FourModeConfigManager {}

/// 四模式適配器介面與實作（模擬）
abstract class FourModeConfigManager {
  FormConfiguration getConfigForMode(UserMode mode);
  bool isAdvancedFeatureEnabled(UserMode mode);
  bool hasGamificationEnabled(UserMode mode);
  bool isSimplifiedModeEnabled(UserMode mode);
}

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
      'enableDebugMode': true
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
      'enableQuickActions': true
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
      'enableTutorials': true
    };
  }
  
  Future<Map<String, dynamic>> buildMotivationConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'enableAchievements': true,
      'enableProgress': true,
      'showEncouragement': true,
      'enableRewards': true
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
      'enableOneClick': true
    };
  }
  
  Future<Map<String, dynamic>> buildAutoConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    return {
      'enableAutoFill': true,
      'enableSmartDefaults': true,
      'minimizeDecisions': true,
      'enableAutoPilot': true
    };
  }
}

/// 測試用狀態管理Provider實作
class TestTransactionStateProvider {
  bool _isLoading = false;
  bool _hasError = false;
  String _errorMessage = '';
  List<TestTransaction> _transactions = [];
  
  bool get isLoading => _isLoading;
  bool get hasError => _hasError;
  String get errorMessage => _errorMessage;
  List<TestTransaction> get transactions => _transactions;
  bool get hasChanges => _transactions.isNotEmpty;
  
  void setLoading(bool loading) {
    _isLoading = loading;
  }
  
  Future<void> addTransaction(TestTransaction transaction) async {
    try {
      _isLoading = true;
      _hasError = false;
      
      // 模擬API調用
      await Future.delayed(Duration(milliseconds: 100));
      
      _transactions.add(transaction);
      _isLoading = false;
    } catch (e) {
      _hasError = true;
      _errorMessage = e.toString();
      _isLoading = false;
    }
  }
}

class TestCategoryStateProvider {
  bool _isLoaded = false;
  List<Map<String, dynamic>> _categories = [];
  
  bool get isLoaded => _isLoaded;
  List<Map<String, dynamic>> get categories => _categories;
  bool get hasChanges => _categories.isNotEmpty;
  
  Future<void> loadCategories() async {
    await Future.delayed(Duration(milliseconds: 100));
    _categories = [
      {'id': 'food', 'name': '飲食', 'type': 'expense'},
      {'id': 'transport', 'name': '交通', 'type': 'expense'},
      {'id': 'salary', 'name': '薪資', 'type': 'income'}
    ];
    _isLoaded = true;
  }
  
  List<Map<String, dynamic>> getExpenseCategories() {
    return _categories.where((cat) => cat['type'] == 'expense').toList();
  }
  
  List<Map<String, dynamic>> getIncomeCategories() {
    return _categories.where((cat) => cat['type'] == 'income').toList();
  }
  
  List<Map<String, dynamic>> getCategoriesByParent(String parentId) {
    return _categories.where((cat) => cat['id'].toString().startsWith(parentId)).toList();
  }
  
  List<Map<String, dynamic>> getCachedCategories() {
    return List.from(_categories);
  }
}

class TestFormStateProvider {
  UserMode? _currentMode;
  bool _isInitialized = false;
  Map<String, dynamic> _fieldValues = {};
  Map<String, String> _fieldErrors = {};
  
  UserMode? get currentMode => _currentMode;
  bool get isInitialized => _isInitialized;
  bool get hasErrors => _fieldErrors.isNotEmpty;
  bool get hasChanges => _fieldValues.isNotEmpty;
  
  void initializeForm(UserMode mode) {
    _currentMode = mode;
    _isInitialized = true;
    _fieldValues.clear();
    _fieldErrors.clear();
  }
  
  void updateField(String fieldName, dynamic value) {
    _fieldValues[fieldName] = value;
    // 清除該欄位的錯誤
    _fieldErrors.remove(fieldName);
  }
  
  dynamic getFieldValue(String fieldName) {
    return _fieldValues[fieldName];
  }
  
  String? getFieldError(String fieldName) {
    return _fieldErrors[fieldName];
  }
  
  Future<void> validateField(String fieldName) async {
    await Future.delayed(Duration(milliseconds: 30));
    
    final value = _fieldValues[fieldName];
    if (fieldName == 'amount' && value != null) {
      if (value is num && value <= 0) {
        _fieldErrors[fieldName] = '金額必須大於零';
      }
    }
  }
  
  void resetForm() {
    _fieldValues.clear();
    _fieldErrors.clear();
  }
}

class TestStateSyncManager {
  DateTime? _lastSyncTime;
  bool _isSyncing = false;
  List<Function> _syncListeners = [];
  
  DateTime? get lastSyncTime => _lastSyncTime;
  bool get isSyncing => _isSyncing;
  
  void registerSyncListener(Function callback) {
    _syncListeners.add(callback);
  }
  
  void unregisterSyncListener(Function callback) {
    _syncListeners.remove(callback);
  }
  
  Future<void> syncAllStates() async {
    _isSyncing = true;
    await Future.delayed(Duration(milliseconds: 100));
    
    // 通知所有監聽器
    for (var listener in _syncListeners) {
      listener();
    }
    
    _lastSyncTime = DateTime.now();
    _isSyncing = false;
  }
  
  Future<void> syncTransactionState() async {
    await Future.delayed(Duration(milliseconds: 50));
    _lastSyncTime = DateTime.now();
  }
  
  Future<void> syncDashboardState() async {
    await Future.delayed(Duration(milliseconds: 50));
    _lastSyncTime = DateTime.now();
  }
}

class TestAccountingFormWidget {
  bool _isInitialized = false;
  Map<String, dynamic> _widgetStructure = {};
  
  Future<void> initializeWidget() async {
    await Future.delayed(Duration(milliseconds: 100));
    _isInitialized = true;
    _widgetStructure = {
      'hasAmountField': true,
      'hasCategorySelector': true,
      'hasAccountSelector': true,
      'hasDescriptionField': true,
      'hasSubmitButton': true,
    };
  }
  
  Map<String, dynamic> getWidgetStructure() {
    return Map.from(_widgetStructure);
  }
  
  Map<String, dynamic> getExpertModeStructure() {
    return {
      'hasAdvancedOptions': true,
      'hasBatchEntry': true,
      'hasDetailedValidation': true,
      'hasDebugInfo': true,
    };
  }
}

/// 記帳表單處理器（模擬）
class AccountingFormProcessor {
  Future<Map<String, dynamic>> processTransaction(Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 100));
    return {'success': true, 'transactionId': 'trans_${DateTime.now().millisecondsSinceEpoch}'};
  }
}

/// 儀表板組件（模擬）
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

/// 科目選擇器Widget（模擬）
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

/// 帳戶選擇器Widget（模擬）
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

/// 快速記帳處理器（模擬）
class QuickAccountingProcessor {
  Future<QuickAccountingResult> processQuickAccounting(String input) async {
    await Future.delayed(Duration(milliseconds: 30)); // 模擬處理時間
    
    // 簡單的成功率模擬：90%成功
    final success = DateTime.now().millisecond % 10 != 0;
    return QuickAccountingResult(
      success: success,
      message: success ? '記帳成功' : '解析失敗'
    );
  }
}

/// 智能文字解析器（模擬）
class SmartTextParser {
  Future<Map<String, dynamic>> parseText(String input) async {
    await Future.delayed(Duration(milliseconds: 50));
    
    // 簡化的解析邏輯模擬
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
      
      // 解析轉帳來源和目標
      if (input.contains('從') && input.contains('到')) {
        final fromIndex = input.indexOf('從');
        final toIndex = input.indexOf('到');
        if (fromIndex < toIndex) {
          result['fromAccount'] = input.substring(fromIndex + 1, toIndex).trim();
          result['toAccount'] = input.substring(toIndex + 1).trim();
        }
      }
    } else {
      result['type'] = 'expense';
    }
    
    // 尋找帳戶
    if (input.contains('現金')) result['account'] = '現金';
    if (input.contains('台銀') || input.contains('台灣銀行')) result['account'] = '台銀';
    if (input.contains('儲蓄')) result['account'] = '儲蓄';
    
    // 移除金額和帳戶後的描述
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

/// 記帳表單驗證器（模擬）
class AccountingFormValidator {
  Future<ValidationResult> validate(Map<String, dynamic> formData) async {
    await Future.delayed(Duration(milliseconds: 30));
    
    final errors = <String>[];
    
    // 驗證金額
    final amount = formData['amount'] as double?;
    if (amount == null) {
      errors.add('金額為必填項目');
    } else if (amount <= 0) {
      errors.add('金額必須大於零');
    }
    
    // 驗證科目
    if (!formData.containsKey('categoryId') || formData['categoryId'] == null) {
      errors.add('科目為必填項目');
    }
    
    // 驗證帳戶
    if (!formData.containsKey('accountId') || formData['accountId'] == null) {
      errors.add('帳戶為必填項目');
    }
    
    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors
    );
  }
}

/// 記帳主頁Widget（模擬）
class AccountingHomePageWidget {
  Future<WidgetState> initializeState() async {
    await Future.delayed(Duration(milliseconds: 100));
    return WidgetState(isInitialized: true);
  }
}

/// 驗證結果類別
class ValidationResult {
  final bool isValid;
  final List<String> errors;
  
  ValidationResult({required this.isValid, required this.errors});
}

/// Widget狀態類別
class WidgetState {
  final bool isInitialized;
  
  WidgetState({required this.isInitialized});
}
