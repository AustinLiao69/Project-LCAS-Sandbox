
/**
 * 7590. 生成動態測試資料.dart
 * @version v1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - 建立動態測試資料生成機制
 * 
 * 本模組參考0693模組實作，提供動態測試資料生成功能
 * 支援四模式差異化測試資料生成，遵循1311.FS.js資料格式標準
 */

import 'dart:async';
import 'dart:convert';
import 'dart:math';

// 引入7580注入模組
import '7580. 注入測試資料.dart';

// ==========================================
// 動態測試資料生成配置
// ==========================================

/**
 * 01. 動態生成配置類
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - 參考0693.DYNAMIC_CONFIG
 */
class DynamicTestDataConfig {
  static const String timezone = 'Asia/Taipei';
  static const String defaultCurrency = 'TWD';
  
  // ID格式規範 (參考0693模組)
  static const Map<String, String> idFormat = {
    'transaction': 'txn_{timestamp}_{random}',
    'user': 'user_{timestamp}_{random}',
    'ledger': 'ledger_{timestamp}_{random}',
    'account': 'acc_{timestamp}_{random}',
    'category': 'cat_{timestamp}_{random}',
  };
  
  // 金額範圍設定
  static const Map<String, int> amountRange = {
    'min': 1,
    'max': 50000,
  };
  
  // 四模式配置
  static const List<String> userModes = [
    'Expert', 'Inertial', 'Cultivation', 'Guiding'
  ];
  
  // 描述詞庫 (參考0693模組)
  static const Map<String, List<String>> descriptions = {
    'expense': [
      '早餐', '午餐', '晚餐', '咖啡', '零食', '交通費', '停車費', '油費',
      '書籍', '文具', '衣服', '鞋子', '電影', '遊戲', '健身', '醫療',
      '水電費', '網路費', '手機費', '房租', '保險', '維修費'
    ],
    'income': [
      '薪資', '獎金', '紅利', '津貼', '加班費', '兼職收入', '投資收益',
      '利息收入', '租金收入', '退稅', '退款', '禮金', '獎學金'
    ]
  };
  
  // 支付方式
  static const List<String> paymentMethods = [
    '現金', '信用卡', '轉帳', '行動支付', '悠遊卡'
  ];
  
  // 分類配置 (符合1311.FS.js規範)
  static const Map<String, List<Map<String, String>>> categories = {
    'expense': [
      {'code': '103', 'subCode': '01', 'name': '餐飲'},
      {'code': '105', 'subCode': '01', 'name': '交通'},
      {'code': '107', 'subCode': '01', 'name': '娛樂'},
      {'code': '109', 'subCode': '01', 'name': '購物'},
      {'code': '111', 'subCode': '01', 'name': '醫療'},
      {'code': '113', 'subCode': '01', 'name': '居住'},
      {'code': '115', 'subCode': '01', 'name': '教育'},
      {'code': '199', 'subCode': '99', 'name': '其他支出'},
    ],
    'income': [
      {'code': '801', 'subCode': '01', 'name': '薪資收入'},
      {'code': '803', 'subCode': '01', 'name': '獎金'},
      {'code': '805', 'subCode': '01', 'name': '投資收益'},
      {'code': '807', 'subCode': '01', 'name': '其他收入'},
    ]
  };
}

// ==========================================
// 動態測試資料生成工廠
// ==========================================

/**
 * 02. 動態測試資料生成工廠
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - Factory Pattern動態生成器
 */
class DynamicTestDataFactory {
  static final DynamicTestDataFactory _instance = DynamicTestDataFactory._internal();
  static DynamicTestDataFactory get instance => _instance;
  DynamicTestDataFactory._internal();

  final Random _random = Random();
  final Map<String, dynamic> _generatedData = {};
  final List<String> _generationHistory = [];

  /**
   * 03. 生成符合1311.FS.js規範的交易ID
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateTransactionId
   */
  String generateTransactionId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = _random.nextInt(999999).toString().padLeft(6, '0');
    return 'txn_${timestamp}_$random';
  }

  /**
   * 04. 生成符合1311.FS.js規範的用戶ID
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateUserId
   */
  String generateUserId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = _random.nextInt(9999).toString().padLeft(4, '0');
    return 'test_user_${timestamp}_$random';
  }

  /**
   * 05. 生成隨機金額
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateRandomAmount
   */
  double generateRandomAmount({int? min, int? max}) {
    final minAmount = min ?? DynamicTestDataConfig.amountRange['min']!;
    final maxAmount = max ?? DynamicTestDataConfig.amountRange['max']!;
    return (minAmount + _random.nextInt(maxAmount - minAmount + 1)).toDouble();
  }

  /**
   * 06. 生成台北時區的日期時間
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateTaipeiDateTime
   */
  Map<String, String> generateTaipeiDateTime({DateTime? baseDate}) {
    final dateTime = baseDate ?? DateTime.now();
    return {
      'date': '${dateTime.year.toString().padLeft(4, '0')}/${dateTime.month.toString().padLeft(2, '0')}/${dateTime.day.toString().padLeft(2, '0')}',
      'time': '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}:${dateTime.second.toString().padLeft(2, '0')}',
      'timestamp': dateTime.toIso8601String(),
    };
  }

  /**
   * 07. 生成動態交易記錄
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateTransaction
   */
  Future<Map<String, dynamic>> generateTransaction({
    String? transactionType,
    String? userId,
    String? description,
    DateTime? date,
  }) async {
    try {
      print('[7590] 開始生成動態交易記錄...');
      
      final transactionId = generateTransactionId();
      final dateTime = generateTaipeiDateTime(baseDate: date);
      
      // 隨機決定收入或支出 (參考0693邏輯)
      final isIncome = transactionType == 'income' || 
                      (transactionType != 'expense' && _random.nextDouble() > 0.7);
      final type = isIncome ? 'income' : 'expense';
      
      // 選擇對應的分類和描述
      final categories = DynamicTestDataConfig.categories[type]!;
      final descriptions = DynamicTestDataConfig.descriptions[type]!;
      final selectedCategory = categories[_random.nextInt(categories.length)];
      final selectedDescription = descriptions[_random.nextInt(descriptions.length)];
      
      // 生成金額 (收入通常較高)
      final amount = isIncome 
          ? generateRandomAmount(min: 1000, max: 50000)
          : generateRandomAmount(min: 50, max: 2000);
      
      // 隨機選擇支付方式
      final paymentMethod = DynamicTestDataConfig.paymentMethods[
          _random.nextInt(DynamicTestDataConfig.paymentMethods.length)];
      
      // 構建符合1311.FS.js規範的交易記錄
      final transaction = {
        // 1311.FS.js標準欄位
        '收支ID': transactionId,
        '日期': dateTime['date']!,
        '時間': dateTime['time']!,
        '收入': isIncome ? amount.toString() : '',
        '支出': isIncome ? '' : amount.toString(),
        '備註': description ?? selectedDescription,
        '子項名稱': selectedCategory['name']!,
        '大項代碼': selectedCategory['code']!,
        '子項代碼': selectedCategory['subCode']!,
        '支付方式': paymentMethod,
        'UID': userId ?? generateUserId(),
        
        // 額外的系統欄位（符合FS規範）
        'createdAt': dateTime['timestamp']!,
        'updatedAt': dateTime['timestamp']!,
        'source': 'dynamic_test_data_7590',
        'version': '1.0.0',
      };
      
      // 記錄生成歷史
      _recordGeneration('Transaction', transaction);
      
      print('[7590] ✅ 動態交易記錄生成成功: ${transactionId}');
      return transaction;
      
    } catch (e) {
      print('[7590] ❌ 動態交易記錄生成失敗: $e');
      rethrow;
    }
  }

  /**
   * 08. 批量生成交易記錄
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateTransactionsBatch
   */
  Future<Map<String, Map<String, dynamic>>> generateTransactionsBatch({
    int count = 10,
    String? transactionType,
    String? userId,
    DateTime? startDate,
  }) async {
    final transactions = <String, Map<String, dynamic>>{};
    final baseDate = startDate ?? DateTime.now();
    
    try {
      print('[7590] 開始批量生成 $count 筆交易記錄...');
      
      for (int i = 0; i < count; i++) {
        // 隨機分散日期（最近30天內）
        final randomDays = _random.nextInt(30);
        final transactionDate = DateTime(
          baseDate.year,
          baseDate.month,
          baseDate.day - randomDays,
        );
        
        final transaction = await generateTransaction(
          transactionType: transactionType,
          userId: userId,
          date: transactionDate,
        );
        
        transactions[transaction['收支ID']] = transaction;
      }
      
      print('[7590] ✅ 批量生成完成: ${transactions.length} 筆交易記錄');
      return transactions;
      
    } catch (e) {
      print('[7590] ❌ 批量生成失敗: $e');
      return transactions;
    }
  }

  /**
   * 09. 四模式用戶資料生成
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateUsersBatch
   */
  Future<Map<String, Map<String, dynamic>>> generateUsersBatch({
    int userCount = 5,
  }) async {
    final users = <String, Map<String, dynamic>>{};
    
    try {
      print('[7590] 開始生成 $userCount 個四模式用戶資料...');
      
      for (int i = 0; i < userCount; i++) {
        final userId = generateUserId();
        final userMode = DynamicTestDataConfig.userModes[i % 4];
        final timestamp = DateTime.now().millisecondsSinceEpoch + i;
        
        final user = {
          'email': '${userId}@test.lcas.app',
          'password': 'TestPass${i + 1}23!',
          'display_name': '動態測試用戶${i + 1}',
          'mode': userMode.toLowerCase(),
          'userMode': userMode, // 1311.FS.js規範欄位
          'expected_features': ['dynamic_test', 'generated_data'],
          'registration_data': {
            'first_name': 'Test',
            'last_name': 'User${i + 1}',
            'phone': '+8869${timestamp.toString().substring(timestamp.toString().length - 8)}',
            'date_of_birth': '199${i % 10}-0${(i % 9) + 1}-${(i + 10).toString().padLeft(2, '0')}',
            'preferred_language': 'zh-TW',
          },
          'createdAt': DateTime.now().toIso8601String(),
          'source': 'dynamic_test_data_7590',
          'version': '1.0.0',
        };
        
        users[userId] = user;
        _recordGeneration('User', user);
      }
      
      print('[7590] ✅ 四模式用戶資料生成完成: ${users.length} 個用戶');
      return users;
      
    } catch (e) {
      print('[7590] ❌ 四模式用戶資料生成失敗: $e');
      return users;
    }
  }

  /**
   * 10. 生成帳本測試資料
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateLedgerData
   */
  Future<Map<String, dynamic>> generateLedgerData({
    required String userId,
    String? ledgerName,
  }) async {
    try {
      final ledgerId = 'ledger_${DateTime.now().millisecondsSinceEpoch}_${_random.nextInt(9999).toString().padLeft(4, '0')}';
      
      final ledger = {
        'id': ledgerId,
        'name': ledgerName ?? '${userId}的動態測試帳本',
        'description': '由7590動態生成的測試帳本',
        'owner': userId,
        'members': [userId],
        'type': 'personal',
        'currency': DynamicTestDataConfig.defaultCurrency,
        'timezone': DynamicTestDataConfig.timezone,
        'settings': {
          'allowNegativeBalance': false,
          'autoCategories': true,
          'reminderSettings': true,
        },
        'createdAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
        'status': 'active',
        'source': 'dynamic_test_data_7590',
        'version': '1.0.0',
      };
      
      _recordGeneration('Ledger', ledger);
      print('[7590] ✅ 帳本資料生成成功: $ledgerId');
      return ledger;
      
    } catch (e) {
      print('[7590] ❌ 帳本資料生成失敗: $e');
      rethrow;
    }
  }

  /**
   * 11. 生成完整測試資料集
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateCompleteTestDataSet
   */
  Future<Map<String, dynamic>> generateCompleteTestDataSet({
    int userCount = 3,
    int transactionsPerUser = 15,
    bool includeLedgers = true,
  }) async {
    try {
      print('[7590] 🔄 開始生成完整測試資料集...');
      
      // 基礎結構
      final testDataSet = {
        'metadata': {
          'version': '1.0.0 - Dynamic Generated by 7590',
          'generated_at': DateTime.now().toIso8601String(),
          'generator': '7590_dynamic_test_data',
          'source': 'dynamic_generation_7590',
          'note': 'Flutter PL層動態測試資料',
        },
        'authentication_test_data': {
          'valid_users': <String, Map<String, dynamic>>{},
        },
        'bookkeeping_test_data': {
          'test_transactions': <String, Map<String, dynamic>>{},
          'test_ledgers': <String, Map<String, dynamic>>{},
        },
      };
      
      // 生成動態用戶
      final dynamicUsers = await generateUsersBatch(userCount: userCount);
      testDataSet['authentication_test_data']['valid_users'] = dynamicUsers;
      
      // 為每個用戶生成交易記錄和帳本
      for (final userId in dynamicUsers.keys) {
        // 生成交易記錄
        final userTransactions = await generateTransactionsBatch(
          count: transactionsPerUser,
          userId: userId,
        );
        (testDataSet['bookkeeping_test_data']['test_transactions'] as Map<String, Map<String, dynamic>>)
            .addAll(userTransactions);
        
        // 生成帳本（如果需要）
        if (includeLedgers) {
          final ledger = await generateLedgerData(userId: userId);
          (testDataSet['bookkeeping_test_data']['test_ledgers'] as Map<String, Map<String, dynamic>>)[ledger['id']] = ledger;
        }
      }
      
      // 生成統計資訊
      final totalUsers = (testDataSet['authentication_test_data']['valid_users'] as Map).length;
      final totalTransactions = (testDataSet['bookkeeping_test_data']['test_transactions'] as Map).length;
      final totalLedgers = (testDataSet['bookkeeping_test_data']['test_ledgers'] as Map).length;
      
      testDataSet['metadata']['generation_stats'] = {
        'total_users': totalUsers,
        'dynamic_users': userCount,
        'total_transactions': totalTransactions,
        'dynamic_transactions': userCount * transactionsPerUser,
        'total_ledgers': totalLedgers,
        'generated_at': DateTime.now().toIso8601String(),
      };
      
      print('[7590] ✅ 完整測試資料集生成完成');
      print('[7590]    - 總用戶數: $totalUsers (動態: $userCount)');
      print('[7590]    - 總交易數: $totalTransactions (動態: ${userCount * transactionsPerUser})');
      print('[7590]    - 總帳本數: $totalLedgers');
      
      return testDataSet;
      
    } catch (e) {
      print('[7590] ❌ 完整測試資料集生成失敗: $e');
      rethrow;
    }
  }

  /**
   * 12. 生成特定場景的測試資料
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 參考0693.generateScenarioTestData
   */
  Future<Map<String, Map<String, dynamic>>> generateScenarioTestData(String scenario) async {
    try {
      print('[7590] 開始生成場景測試資料: $scenario');
      
      switch (scenario) {
        case 'high_volume':
          return await generateTransactionsBatch(count: 100);
        
        case 'income_only':
          return await generateTransactionsBatch(count: 20, transactionType: 'income');
        
        case 'expense_only':
          return await generateTransactionsBatch(count: 20, transactionType: 'expense');
        
        case 'recent_activity':
          return await generateTransactionsBatch(count: 10, startDate: DateTime.now());
        
        case 'historical_data':
          final historicalStart = DateTime.now().subtract(Duration(days: 180));
          return await generateTransactionsBatch(count: 50, startDate: historicalStart);
        
        default:
          return await generateTransactionsBatch(count: 10);
      }
      
    } catch (e) {
      print('[7590] ❌ 場景測試資料生成失敗: $e');
      return {};
    }
  }

  /**
   * 13. 四模式差異化資料生成
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段二實作 - 支援四模式特定資料生成
   */
  Future<Map<String, dynamic>> generateModeSpecificData(String userMode) async {
    try {
      final baseUserId = 'test_user_${DateTime.now().millisecondsSinceEpoch}';
      final baseEmail = '${userMode.toLowerCase()}@test.lcas.app';
      
      final userData = <String, dynamic>{
        'userId': '${baseUserId}_${userMode.toLowerCase()}',
        'email': baseEmail,
        'userMode': userMode, // Expert/Inertial/Cultivation/Guiding
        'displayName': '$userMode Mode Tester',
        'registrationDate': DateTime.now().toIso8601String(),
        'preferences': {
          'language': 'zh-TW',
          'timezone': 'Asia/Taipei',
          'theme': 'auto',
        },
        'source': 'dynamic_test_data_7590',
        'version': '1.0.0',
      };
      
      // 根據模式添加特定配置
      switch (userMode) {
        case 'Expert':
          userData['expertFeatures'] = {
            'advancedAnalytics': true,
            'customCategories': true,
            'budgetManagement': true,
          };
          break;
        case 'Inertial':
          userData['inertialFeatures'] = {
            'autoCategories': true,
            'simpleInterface': true,
            'basicReports': true,
          };
          break;
        case 'Cultivation':
          userData['cultivationFeatures'] = {
            'learningMode': true,
            'guidance': true,
            'achievements': true,
          };
          break;
        case 'Guiding':
          userData['guidingFeatures'] = {
            'stepByStep': true,
            'tutorials': true,
            'recommendations': true,
          };
          break;
      }
      
      _recordGeneration('ModeSpecificUser', userData);
      print('[7590] ✅ $userMode 模式特定資料生成完成');
      return userData;
      
    } catch (e) {
      print('[7590] ❌ $userMode 模式特定資料生成失敗: $e');
      rethrow;
    }
  }
}

// ==========================================
// 資料驗證與整合
// ==========================================

/**
 * 14. 動態資料驗證器
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - 參考0693.validateTransactionFormat
 */
class DynamicTestDataValidator {
  static Map<String, dynamic> validateTransaction(Map<String, dynamic> transaction) {
    final errors = <String>[];
    final warnings = <String>[];
    
    try {
      // 檢查必要欄位 (1311.FS.js規範)
      final requiredFields = [
        '收支ID', '日期', '時間', '備註', '子項名稱', 
        '大項代碼', '子項代碼', '支付方式', 'UID'
      ];
      
      for (final field in requiredFields) {
        if (!transaction.containsKey(field) || transaction[field] == null) {
          errors.add('缺少必要欄位: $field');
        }
      }
      
      // 檢查收入支出欄位
      final hasIncome = transaction['收入'] != null && 
                       transaction['收入'].toString().isNotEmpty &&
                       double.tryParse(transaction['收入']) != null &&
                       double.parse(transaction['收入']) > 0;
      
      final hasExpense = transaction['支出'] != null && 
                        transaction['支出'].toString().isNotEmpty &&
                        double.tryParse(transaction['支出']) != null &&
                        double.parse(transaction['支出']) > 0;
      
      if (!hasIncome && !hasExpense) {
        errors.add('收入和支出不能都為空');
      }
      
      if (hasIncome && hasExpense) {
        warnings.add('收入和支出同時有值，可能不符合預期');
      }
      
      // 檢查日期格式 (YYYY/MM/DD)
      if (transaction.containsKey('日期')) {
        final dateRegex = RegExp(r'^\d{4}\/\d{2}\/\d{2}$');
        if (!dateRegex.hasMatch(transaction['日期'])) {
          errors.add('日期格式不正確，應為YYYY/MM/DD');
        }
      }
      
      // 檢查時間格式 (HH:mm:ss)
      if (transaction.containsKey('時間')) {
        final timeRegex = RegExp(r'^\d{2}:\d{2}:\d{2}$');
        if (!timeRegex.hasMatch(transaction['時間'])) {
          errors.add('時間格式不正確，應為HH:mm:ss');
        }
      }
      
      return {
        'isValid': errors.isEmpty,
        'errors': errors,
        'warnings': warnings,
      };
      
    } catch (e) {
      return {
        'isValid': false,
        'errors': ['驗證過程發生錯誤: $e'],
        'warnings': warnings,
      };
    }
  }
  
  static Map<String, dynamic> validateUserData(Map<String, dynamic> userData) {
    final errors = <String>[];
    final warnings = <String>[];
    
    try {
      // 檢查必要欄位
      final requiredFields = ['userId', 'email', 'userMode'];
      for (final field in requiredFields) {
        if (!userData.containsKey(field) || userData[field] == null) {
          errors.add('缺少必要欄位: $field');
        }
      }
      
      // 檢查用戶模式
      if (userData.containsKey('userMode')) {
        if (!DynamicTestDataConfig.userModes.contains(userData['userMode'])) {
          errors.add('無效的用戶模式: ${userData['userMode']}');
        }
      }
      
      // 檢查Email格式
      if (userData.containsKey('email')) {
        final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
        if (!emailRegex.hasMatch(userData['email'])) {
          errors.add('無效的Email格式: ${userData['email']}');
        }
      }
      
      return {
        'isValid': errors.isEmpty,
        'errors': errors,
        'warnings': warnings,
      };
      
    } catch (e) {
      return {
        'isValid': false,
        'errors': ['用戶資料驗證過程發生錯誤: $e'],
        'warnings': warnings,
      };
    }
  }
}

// ==========================================
// 與7580注入模組整合
// ==========================================

/**
 * 15. 動態生成與注入整合器
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - 整合7580注入機制
 */
class DynamicGenerationInjectionIntegrator {
  static final DynamicTestDataFactory _generator = DynamicTestDataFactory.instance;
  static final TestDataInjectionFactory _injector = TestDataInjectionFactory.instance;

  /**
   * 16. 生成並注入系統進入功能群資料
   */
  static Future<bool> generateAndInjectSystemEntryData({
    required String userMode,
    int count = 1,
  }) async {
    try {
      print('[7590] 🔄 生成並注入系統進入功能群資料 ($userMode)...');
      
      for (int i = 0; i < count; i++) {
        final userData = await _generator.generateModeSpecificData(userMode);
        final result = await _injector.injectSystemEntryData(userData);
        
        if (!result) {
          print('[7590] ❌ 第${i+1}筆系統進入資料注入失敗');
          return false;
        }
      }
      
      print('[7590] ✅ 系統進入功能群資料生成並注入完成: $count 筆');
      return true;
      
    } catch (e) {
      print('[7590] ❌ 生成並注入系統進入功能群資料失敗: $e');
      return false;
    }
  }

  /**
   * 17. 生成並注入記帳核心功能群資料
   */
  static Future<bool> generateAndInjectAccountingCoreData({
    String? userId,
    String? transactionType,
    int count = 10,
  }) async {
    try {
      print('[7590] 🔄 生成並注入記帳核心功能群資料...');
      
      final transactions = await _generator.generateTransactionsBatch(
        count: count,
        transactionType: transactionType,
        userId: userId,
      );
      
      for (final transaction in transactions.values) {
        final result = await _injector.injectAccountingCoreData(transaction);
        
        if (!result) {
          print('[7590] ❌ 交易資料注入失敗: ${transaction['收支ID']}');
          return false;
        }
      }
      
      print('[7590] ✅ 記帳核心功能群資料生成並注入完成: ${transactions.length} 筆');
      return true;
      
    } catch (e) {
      print('[7590] ❌ 生成並注入記帳核心功能群資料失敗: $e');
      return false;
    }
  }

  /**
   * 18. 生成並注入完整測試場景
   */
  static Future<bool> generateAndInjectCompleteScenario({
    int userCount = 3,
    int transactionsPerUser = 10,
  }) async {
    try {
      print('[7590] 🔄 生成並注入完整測試場景...');
      
      final testDataSet = await _generator.generateCompleteTestDataSet(
        userCount: userCount,
        transactionsPerUser: transactionsPerUser,
      );
      
      // 注入用戶資料
      final users = testDataSet['authentication_test_data']['valid_users'] as Map<String, Map<String, dynamic>>;
      for (final userData in users.values) {
        final result = await _injector.injectSystemEntryData(userData);
        if (!result) {
          print('[7590] ❌ 用戶資料注入失敗: ${userData['email']}');
          return false;
        }
      }
      
      // 注入交易資料
      final transactions = testDataSet['bookkeeping_test_data']['test_transactions'] as Map<String, Map<String, dynamic>>;
      for (final transaction in transactions.values) {
        final result = await _injector.injectAccountingCoreData(transaction);
        if (!result) {
          print('[7590] ❌ 交易資料注入失敗: ${transaction['收支ID']}');
          return false;
        }
      }
      
      print('[7590] ✅ 完整測試場景生成並注入完成');
      print('[7590]    - 用戶數: ${users.length}');
      print('[7590]    - 交易數: ${transactions.length}');
      return true;
      
    } catch (e) {
      print('[7590] ❌ 生成並注入完整測試場景失敗: $e');
      return false;
    }
  }
}

// ==========================================
// 生成歷史記錄
// ==========================================

/**
 * 19. 生成歷史記錄
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - 生成操作歷史記錄
 */
void _recordGeneration(String dataType, Map<String, dynamic> data) {
  final record = {
    'timestamp': DateTime.now().toIso8601String(),
    'dataType': dataType,
    'dataKeys': data.keys.toList(),
    'recordCount': 1,
    'generator': '7590',
  };
  
  DynamicTestDataFactory.instance._generationHistory.add(jsonEncode(record));
  
  // 保持最近100筆記錄
  if (DynamicTestDataFactory.instance._generationHistory.length > 100) {
    DynamicTestDataFactory.instance._generationHistory.removeAt(0);
  }
}

/**
 * 20. 取得生成統計
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - 生成統計資訊
 */
Map<String, dynamic> getGenerationStatistics() {
  final history = DynamicTestDataFactory.instance._generationHistory;
  final transactionCount = history.where((h) => h.contains('Transaction')).length;
  final userCount = history.where((h) => h.contains('User')).length;
  final ledgerCount = history.where((h) => h.contains('Ledger')).length;
  
  return {
    'totalGenerations': history.length,
    'transactionGenerations': transactionCount,
    'userGenerations': userCount,
    'ledgerGenerations': ledgerCount,
    'lastGeneration': history.isNotEmpty ? history.last : null,
    'generator': '7590_dynamic_test_data',
  };
}

/**
 * 21. 重設動態資料
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段二實作 - 參考0693.resetDynamicData
 */
Future<void> resetDynamicData() async {
  try {
    print('[7590] 🔄 重設動態測試資料...');
    
    DynamicTestDataFactory.instance._generatedData.clear();
    DynamicTestDataFactory.instance._generationHistory.clear();
    
    print('[7590] ✅ 動態測試資料已重設');
  } catch (e) {
    print('[7590] ❌ 重設動態測試資料失敗: $e');
  }
}

// ==========================================
// 模組導出
// ==========================================

/// 7590生成動態測試資料模組主要導出
export {
  DynamicTestDataFactory,
  DynamicTestDataConfig,
  DynamicTestDataValidator,
  DynamicGenerationInjectionIntegrator,
  getGenerationStatistics,
  resetDynamicData,
};

// 模組初始化
void initializeDynamicTestDataGeneration() {
  print('[7590] 🎉 動態測試資料生成模組 v1.0.0 初始化完成');
  print('[7590] 📌 參考 0693 模組實作動態生成機制');
  print('[7590] 📋 遵循 1311.FS.js 資料格式標準');
  print('[7590] 🔧 支援四模式差異化測試資料生成');
  print('[7590] 🔗 整合 7580 注入機制');
}

// 自動初始化
void main() {
  initializeDynamicTestDataGeneration();
}
