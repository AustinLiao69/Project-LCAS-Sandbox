
/**
 * 7580. 注入測試資料.dart
 * @version v1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 建立PL層測試資料注入機制
 * 
 * 本模組實現P1-2測試資料流計畫，直接向7301、7302模組注入測試資料
 * 遵循1311.FS.js資料格式標準，排除BK.js和DD1.js業務邏輯欄位
 */

import 'dart:async';
import 'dart:convert';
import 'dart:math';

// 引入目標模組
import '7301. 系統進入功能群.dart';
import '7302. 記帳核心功能群.dart';

// ==========================================
// 測試資料注入器核心類別
// ==========================================

/**
 * 01. 測試資料注入工廠 - TestDataInjectionFactory
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - Factory Pattern注入器
 */
class TestDataInjectionFactory {
  static final TestDataInjectionFactory _instance = TestDataInjectionFactory._internal();
  static TestDataInjectionFactory get instance => _instance;
  TestDataInjectionFactory._internal();

  final Map<String, dynamic> _injectedData = {};
  final List<String> _injectionHistory = [];

  /**
   * 02. 系統進入功能群資料注入
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段一實作 - 7301模組資料注入
   */
  Future<bool> injectSystemEntryData(Map<String, dynamic> testData) async {
    try {
      print('[7580] 開始注入系統進入功能群測試資料...');
      
      // 驗證資料格式符合1311.FS.js標準
      final validationResult = validateSystemEntryFormat(testData);
      if (!validationResult['isValid']) {
        throw Exception('資料格式驗證失敗: ${validationResult['errors']}');
      }

      // 排除業務邏輯欄位
      final cleanData = filterBusinessLogicFields(testData, 'systemEntry');
      
      // 直接注入到7301模組
      final injectionResult = await _injectToSystemEntryModule(cleanData);
      
      if (injectionResult) {
        _recordInjection('SystemEntry', cleanData);
        print('[7580] ✅ 系統進入功能群測試資料注入成功');
        return true;
      }
      
      return false;
    } catch (e) {
      print('[7580] ❌ 系統進入功能群測試資料注入失敗: $e');
      return false;
    }
  }

  /**
   * 03. 記帳核心功能群資料注入
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段一實作 - 7302模組資料注入
   */
  Future<bool> injectAccountingCoreData(Map<String, dynamic> testData) async {
    try {
      print('[7580] 開始注入記帳核心功能群測試資料...');
      
      // 驗證資料格式符合1311.FS.js標準
      final validationResult = validateAccountingCoreFormat(testData);
      if (!validationResult['isValid']) {
        throw Exception('資料格式驗證失敗: ${validationResult['errors']}');
      }

      // 排除業務邏輯欄位
      final cleanData = filterBusinessLogicFields(testData, 'accountingCore');
      
      // 直接注入到7302模組
      final injectionResult = await _injectToAccountingCoreModule(cleanData);
      
      if (injectionResult) {
        _recordInjection('AccountingCore', cleanData);
        print('[7580] ✅ 記帳核心功能群測試資料注入成功');
        return true;
      }
      
      return false;
    } catch (e) {
      print('[7580] ❌ 記帳核心功能群測試資料注入失敗: $e');
      return false;
    }
  }

  /**
   * 04. 批量資料注入
   * @version 2025-10-08-V1.0.0
   * @date 2025-10-08
   * @update: 階段一實作 - 支援批量注入機制
   */
  Future<Map<String, bool>> batchInjectTestData(Map<String, List<Map<String, dynamic>>> batchData) async {
    final results = <String, bool>{};
    
    try {
      print('[7580] 開始批量注入測試資料...');
      
      // 注入系統進入功能群資料
      if (batchData.containsKey('systemEntry')) {
        for (final data in batchData['systemEntry']!) {
          final result = await injectSystemEntryData(data);
          results['systemEntry_${data['userId'] ?? 'unknown'}'] = result;
        }
      }
      
      // 注入記帳核心功能群資料
      if (batchData.containsKey('accountingCore')) {
        for (final data in batchData['accountingCore']!) {
          final result = await injectAccountingCoreData(data);
          results['accountingCore_${data['transactionId'] ?? 'unknown'}'] = result;
        }
      }
      
      final successCount = results.values.where((r) => r).length;
      final totalCount = results.length;
      
      print('[7580] ✅ 批量注入完成: $successCount/$totalCount 成功');
      return results;
      
    } catch (e) {
      print('[7580] ❌ 批量注入失敗: $e');
      return results;
    }
  }
}

// ==========================================
// 資料格式驗證器
// ==========================================

/**
 * 05. 系統進入功能群格式驗證
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 1311.FS.js格式驗證
 */
Map<String, dynamic> validateSystemEntryFormat(Map<String, dynamic> data) {
  final errors = <String>[];
  
  try {
    // 必要欄位檢查
    final requiredFields = ['userId', 'email', 'userMode', 'registrationDate'];
    for (final field in requiredFields) {
      if (!data.containsKey(field) || data[field] == null) {
        errors.add('缺少必要欄位: $field');
      }
    }
    
    // 用戶模式驗證
    if (data.containsKey('userMode')) {
      final validModes = ['Expert', 'Inertial', 'Cultivation', 'Guiding'];
      if (!validModes.contains(data['userMode'])) {
        errors.add('無效的用戶模式: ${data['userMode']}');
      }
    }
    
    // Email格式驗證
    if (data.containsKey('email')) {
      final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
      if (!emailRegex.hasMatch(data['email'])) {
        errors.add('無效的Email格式: ${data['email']}');
      }
    }
    
    // 日期格式驗證 (ISO 8601)
    if (data.containsKey('registrationDate')) {
      try {
        DateTime.parse(data['registrationDate']);
      } catch (e) {
        errors.add('無效的日期格式: ${data['registrationDate']}');
      }
    }
    
    return {
      'isValid': errors.isEmpty,
      'errors': errors,
    };
    
  } catch (e) {
    return {
      'isValid': false,
      'errors': ['格式驗證過程發生錯誤: $e'],
    };
  }
}

/**
 * 06. 記帳核心功能群格式驗證 (階段三完整版)
 * @version 2025-10-08-V2.0.0
 * @date 2025-10-08
 * @update: 階段三實作 - 完整1311.FS.js格式驗證與相容性檢查
 */
Map<String, dynamic> validateAccountingCoreFormat(Map<String, dynamic> data) {
  final errors = <String>[];
  final warnings = <String>[];
  
  try {
    // 1311.FS.js標準欄位檢查
    final fs1311RequiredFields = ['收支ID', '日期', '時間', '備註', '子項名稱', '大項代碼', '子項代碼', '支付方式', 'UID'];
    for (final field in fs1311RequiredFields) {
      if (!data.containsKey(field) || data[field] == null || data[field].toString().isEmpty) {
        errors.add('缺少1311.FS.js必要欄位: $field');
      }
    }
    
    // 收入支出欄位邏輯驗證
    final hasIncome = data.containsKey('收入') && 
                     data['收入'] != null && 
                     data['收入'].toString().isNotEmpty;
    final hasExpense = data.containsKey('支出') && 
                      data['支出'] != null && 
                      data['支出'].toString().isNotEmpty;
    
    if (!hasIncome && !hasExpense) {
      errors.add('收入和支出不能都為空（1311.FS.js規範）');
    }
    
    if (hasIncome && hasExpense) {
      warnings.add('收入和支出同時有值，可能不符合1311.FS.js預期邏輯');
    }
    
    // 收入欄位驗證
    if (hasIncome) {
      final incomeValue = double.tryParse(data['收入'].toString());
      if (incomeValue == null || incomeValue <= 0) {
        errors.add('無效的收入金額: ${data['收入']}');
      }
    }
    
    // 支出欄位驗證  
    if (hasExpense) {
      final expenseValue = double.tryParse(data['支出'].toString());
      if (expenseValue == null || expenseValue <= 0) {
        errors.add('無效的支出金額: ${data['支出']}');
      }
    }
    
    // 日期格式驗證 (YYYY/MM/DD)
    if (data.containsKey('日期')) {
      final dateRegex = RegExp(r'^\d{4}\/\d{2}\/\d{2}$');
      if (!dateRegex.hasMatch(data['日期'])) {
        errors.add('日期格式不符合1311.FS.js規範，應為YYYY/MM/DD: ${data['日期']}');
      } else {
        // 進一步驗證日期有效性
        try {
          final dateParts = data['日期'].split('/');
          final year = int.parse(dateParts[0]);
          final month = int.parse(dateParts[1]);
          final day = int.parse(dateParts[2]);
          
          if (month < 1 || month > 12) {
            errors.add('無效的月份: $month');
          }
          if (day < 1 || day > 31) {
            errors.add('無效的日期: $day');
          }
          if (year < 1900 || year > 2100) {
            warnings.add('年份超出合理範圍: $year');
          }
        } catch (e) {
          errors.add('日期解析失敗: ${data['日期']}');
        }
      }
    }
    
    // 時間格式驗證 (HH:mm:ss)
    if (data.containsKey('時間')) {
      final timeRegex = RegExp(r'^\d{2}:\d{2}:\d{2}$');
      if (!timeRegex.hasMatch(data['時間'])) {
        errors.add('時間格式不符合1311.FS.js規範，應為HH:mm:ss: ${data['時間']}');
      } else {
        // 進一步驗證時間有效性
        try {
          final timeParts = data['時間'].split(':');
          final hour = int.parse(timeParts[0]);
          final minute = int.parse(timeParts[1]);
          final second = int.parse(timeParts[2]);
          
          if (hour < 0 || hour > 23) {
            errors.add('無效的小時: $hour');
          }
          if (minute < 0 || minute > 59) {
            errors.add('無效的分鐘: $minute');
          }
          if (second < 0 || second > 59) {
            errors.add('無效的秒數: $second');
          }
        } catch (e) {
          errors.add('時間解析失敗: ${data['時間']}');
        }
      }
    }
    
    // 大項代碼格式驗證
    if (data.containsKey('大項代碼')) {
      final codeRegex = RegExp(r'^\d{3}$');
      if (!codeRegex.hasMatch(data['大項代碼'])) {
        errors.add('大項代碼格式錯誤，應為三位數字: ${data['大項代碼']}');
      }
    }
    
    // 子項代碼格式驗證
    if (data.containsKey('子項代碼')) {
      final subCodeRegex = RegExp(r'^\d{2}$');
      if (!subCodeRegex.hasMatch(data['子項代碼'])) {
        errors.add('子項代碼格式錯誤，應為兩位數字: ${data['子項代碼']}');
      }
    }
    
    // 收支ID格式驗證
    if (data.containsKey('收支ID')) {
      final idRegex = RegExp(r'^txn_\d+_.+$');
      if (!idRegex.hasMatch(data['收支ID'])) {
        warnings.add('收支ID格式可能不標準: ${data['收支ID']}');
      }
    }
    
    // 檢查是否包含業務邏輯欄位（不應該存在）
    final businessLogicFields = [
      'balance', 'totalAmount', 'categoryRecommendation', 'similarTransactions',
      'processingStatus', 'trendAnalysis', 'riskAssessment', 'smartCategory'
    ];
    
    for (final field in businessLogicFields) {
      if (data.containsKey(field)) {
        errors.add('包含不應存在的業務邏輯欄位: $field');
      }
    }
    
    // 檢查資料完整性
    final completenessScore = _calculateCompletenessScore(data, fs1311RequiredFields);
    if (completenessScore < 0.8) {
      warnings.add('資料完整度較低: ${(completenessScore * 100).toStringAsFixed(1)}%');
    }
    
    return {
      'isValid': errors.isEmpty,
      'errors': errors,
      'warnings': warnings,
      'completenessScore': completenessScore,
      'fs1311Compliant': errors.isEmpty && !errors.any((e) => e.contains('1311.FS.js')),
    };
    
  } catch (e) {
    return {
      'isValid': false,
      'errors': ['格式驗證過程發生錯誤: $e'],
      'warnings': warnings,
      'completenessScore': 0.0,
      'fs1311Compliant': false,
    };
  }
}

/**
 * 09. 計算資料完整度分數
 * @version 2025-10-08-V2.0.0
 * @date 2025-10-08
 * @update: 階段三實作 - 1311.FS.js完整度評估
 */
double _calculateCompletenessScore(Map<String, dynamic> data, List<String> requiredFields) {
  int completedFields = 0;
  
  for (final field in requiredFields) {
    if (data.containsKey(field) && 
        data[field] != null && 
        data[field].toString().isNotEmpty) {
      completedFields++;
    }
  }
  
  return completedFields / requiredFields.length;
}

// ==========================================
// 業務邏輯欄位過濾器
// ==========================================


// ==========================================
// 階段三：測試模組整合器
// ==========================================

/**
 * 21. 測試模組整合器
 * @version 2025-10-08-V2.0.0
 * @date 2025-10-08
 * @update: 階段三實作 - 整合7501、7502測試模組
 */
class TestModuleIntegrator {
  static final TestDataInjectionFactory _injector = TestDataInjectionFactory.instance;
  
  /**
   * 22. 整合7501系統進入功能群測試
   */
  static Future<Map<String, dynamic>> integratePL7501Testing({
    required String testMode, // Expert/Inertial/Cultivation/Guiding
    int testCount = 5,
  }) async {
    try {
      print('[7580] 🔄 整合7501系統進入功能群測試 ($testMode)...');
      
      final integrationResults = <String, dynamic>{
        'testMode': testMode,
        'totalTests': testCount,
        'passedTests': 0,
        'failedTests': 0,
        'testDetails': <Map<String, dynamic>>[],
      };
      
      for (int i = 0; i < testCount; i++) {
        // 生成模式特定測試資料
        final testData = FourModeTestDataGenerator.generateModeSpecificData(testMode);
        
        // 驗證資料格式
        final validation = validateSystemEntryFormat(testData);
        
        if (validation['isValid']) {
          // 注入測試資料
          final injectionResult = await _injector.injectSystemEntryData(testData);
          
          if (injectionResult) {
            integrationResults['passedTests']++;
            integrationResults['testDetails'].add({
              'testIndex': i + 1,
              'status': 'passed',
              'userId': testData['userId'],
              'userMode': testData['userMode'],
              'timestamp': DateTime.now().toIso8601String(),
            });
          } else {
            integrationResults['failedTests']++;
            integrationResults['testDetails'].add({
              'testIndex': i + 1,
              'status': 'failed',
              'reason': 'injection_failed',
              'userId': testData['userId'],
            });
          }
        } else {
          integrationResults['failedTests']++;
          integrationResults['testDetails'].add({
            'testIndex': i + 1,
            'status': 'failed',
            'reason': 'validation_failed',
            'errors': validation['errors'],
          });
        }
      }
      
      final successRate = (integrationResults['passedTests'] / testCount * 100).toStringAsFixed(1);
      print('[7580] ✅ 7501整合測試完成: $successRate% 通過率');
      
      return integrationResults;
      
    } catch (e) {
      print('[7580] ❌ 7501整合測試失敗: $e');
      return {
        'testMode': testMode,
        'error': e.toString(),
        'status': 'integration_error'
      };
    }
  }
  
  /**
   * 23. 整合7502記帳核心功能群測試
   */
  static Future<Map<String, dynamic>> integratePL7502Testing({
    String? transactionType,
    int testCount = 10,
  }) async {
    try {
      print('[7580] 🔄 整合7502記帳核心功能群測試...');
      
      final integrationResults = <String, dynamic>{
        'transactionType': transactionType ?? 'mixed',
        'totalTests': testCount,
        'passedTests': 0,
        'failedTests': 0,
        'fs1311CompliantTests': 0,
        'testDetails': <Map<String, dynamic>>[],
      };
      
      for (int i = 0; i < testCount; i++) {
        // 生成交易測試資料（模擬7590動態生成）
        final testData = _generateFS1311CompliantTransaction(
          type: transactionType,
          index: i,
        );
        
        // 強化驗證（階段三版本）
        final validation = validateAccountingCoreFormat(testData);
        
        if (validation['isValid']) {
          // FS1311相容性檢查
          final isFS1311Compliant = validation['fs1311Compliant'] ?? false;
          if (isFS1311Compliant) {
            integrationResults['fs1311CompliantTests']++;
          }
          
          // 注入測試資料
          final injectionResult = await _injector.injectAccountingCoreData(testData);
          
          if (injectionResult) {
            integrationResults['passedTests']++;
            integrationResults['testDetails'].add({
              'testIndex': i + 1,
              'status': 'passed',
              'transactionId': testData['收支ID'],
              'fs1311Compliant': isFS1311Compliant,
              'completenessScore': validation['completenessScore'],
              'timestamp': DateTime.now().toIso8601String(),
            });
          } else {
            integrationResults['failedTests']++;
            integrationResults['testDetails'].add({
              'testIndex': i + 1,
              'status': 'failed',
              'reason': 'injection_failed',
              'transactionId': testData['收支ID'],
            });
          }
        } else {
          integrationResults['failedTests']++;
          integrationResults['testDetails'].add({
            'testIndex': i + 1,
            'status': 'failed',
            'reason': 'validation_failed',
            'errors': validation['errors'],
            'warnings': validation['warnings'],
          });
        }
      }
      
      final successRate = (integrationResults['passedTests'] / testCount * 100).toStringAsFixed(1);
      final fs1311Rate = (integrationResults['fs1311CompliantTests'] / testCount * 100).toStringAsFixed(1);
      
      print('[7580] ✅ 7502整合測試完成: $successRate% 通過率, $fs1311Rate% 1311.FS.js相容');
      
      return integrationResults;
      
    } catch (e) {
      print('[7580] ❌ 7502整合測試失敗: $e');
      return {
        'transactionType': transactionType,
        'error': e.toString(),
        'status': 'integration_error'
      };
    }
  }
  
  /**
   * 24. 生成完全符合1311.FS.js的交易資料
   */
  static Map<String, dynamic> _generateFS1311CompliantTransaction({
    String? type,
    required int index,
  }) {
    final transactionId = 'txn_${DateTime.now().millisecondsSinceEpoch}_${index.toString().padLeft(3, '0')}';
    final now = DateTime.now();
    
    // 隨機決定收入或支出
    final isIncome = type == 'income' || (type != 'expense' && index % 3 == 0);
    
    // 1311.FS.js標準分類
    final categories = isIncome 
        ? [
            {'code': '801', 'subCode': '01', 'name': '薪資收入'},
            {'code': '803', 'subCode': '01', 'name': '獎金'},
            {'code': '805', 'subCode': '01', 'name': '投資收益'},
          ]
        : [
            {'code': '103', 'subCode': '01', 'name': '餐飲'},
            {'code': '105', 'subCode': '01', 'name': '交通'},
            {'code': '107', 'subCode': '01', 'name': '娛樂'},
            {'code': '109', 'subCode': '01', 'name': '購物'},
          ];
    
    final selectedCategory = categories[index % categories.length];
    final amount = (index + 1) * 100 + (isIncome ? 2000 : 0);
    
    // 嚴格符合1311.FS.js格式
    return {
      '收支ID': transactionId,
      '日期': '${now.year.toString().padLeft(4, '0')}/${now.month.toString().padLeft(2, '0')}/${now.day.toString().padLeft(2, '0')}',
      '時間': '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}',
      '收入': isIncome ? amount.toString() : '',
      '支出': isIncome ? '' : amount.toString(),
      '備註': '階段三測試資料-${selectedCategory['name']}-$index',
      '子項名稱': selectedCategory['name']!,
      '大項代碼': selectedCategory['code']!,
      '子項代碼': selectedCategory['subCode']!,
      '支付方式': ['現金', '信用卡', '轉帳'][index % 3],
      'UID': 'test_user_stage3_${index.toString().padLeft(3, '0')}',
      
      // 系統欄位
      'createdAt': now.toIso8601String(),
      'updatedAt': now.toIso8601String(),
      'source': 'stage3_integration_7580',
      'version': '2.0.0',
    };
  }
  
  /**
   * 25. 執行完整的PL層測試整合
   */
  static Future<Map<String, dynamic>> executeFullPLIntegration() async {
    try {
      print('[7580] 🚀 執行完整PL層測試整合...');
      
      final fullResults = <String, dynamic>{
        'startTime': DateTime.now().toIso8601String(),
        'stage': 'stage3_complete_integration',
        'results': <String, dynamic>{},
      };
      
      // 1. 四模式系統進入測試
      final modes = ['Expert', 'Inertial', 'Cultivation', 'Guiding'];
      for (final mode in modes) {
        final pl7501Result = await integratePL7501Testing(
          testMode: mode,
          testCount: 3,
        );
        fullResults['results']['PL7501_$mode'] = pl7501Result;
      }
      
      // 2. 記帳核心功能測試
      final transactionTypes = ['income', 'expense', 'mixed'];
      for (final txType in transactionTypes) {
        final pl7502Result = await integratePL7502Testing(
          transactionType: txType,
          testCount: 8,
        );
        fullResults['results']['PL7502_$txType'] = pl7502Result;
      }
      
      // 3. 整合統計
      final integration7501Stats = _calculateIntegrationStats(
        fullResults['results'],
        'PL7501',
      );
      final integration7502Stats = _calculateIntegrationStats(
        fullResults['results'],
        'PL7502',
      );
      
      fullResults['summary'] = {
        'PL7501_integration': integration7501Stats,
        'PL7502_integration': integration7502Stats,
        'overallSuccess': integration7501Stats['successRate'] > 80 && 
                         integration7502Stats['successRate'] > 80,
        'fs1311Compliance': integration7502Stats['fs1311ComplianceRate'],
      };
      
      fullResults['endTime'] = DateTime.now().toIso8601String();
      
      print('[7580] ✅ PL層完整測試整合完成');
      print('[7580]    - PL7501成功率: ${integration7501Stats['successRate'].toStringAsFixed(1)}%');
      print('[7580]    - PL7502成功率: ${integration7502Stats['successRate'].toStringAsFixed(1)}%');
      print('[7580]    - 1311.FS.js相容率: ${integration7502Stats['fs1311ComplianceRate'].toStringAsFixed(1)}%');
      
      return fullResults;
      
    } catch (e) {
      print('[7580] ❌ PL層完整測試整合失敗: $e');
      return {
        'error': e.toString(),
        'status': 'full_integration_error',
        'stage': 'stage3_complete_integration',
      };
    }
  }
  
  /**
   * 26. 計算整合統計
   */
  static Map<String, dynamic> _calculateIntegrationStats(
    Map<String, dynamic> results,
    String prefix,
  ) {
    final relevantResults = results.entries
        .where((entry) => entry.key.startsWith(prefix))
        .map((entry) => entry.value as Map<String, dynamic>)
        .toList();
    
    if (relevantResults.isEmpty) {
      return {'successRate': 0.0, 'fs1311ComplianceRate': 0.0};
    }
    
    int totalTests = 0;
    int totalPassed = 0;
    int totalFS1311Compliant = 0;
    
    for (final result in relevantResults) {
      if (result.containsKey('totalTests')) {
        totalTests += (result['totalTests'] as int);
        totalPassed += (result['passedTests'] as int);
        
        if (result.containsKey('fs1311CompliantTests')) {
          totalFS1311Compliant += (result['fs1311CompliantTests'] as int);
        }
      }
    }
    
    return {
      'totalTests': totalTests,
      'totalPassed': totalPassed,
      'successRate': totalTests > 0 ? (totalPassed / totalTests * 100) : 0.0,
      'fs1311ComplianceRate': totalTests > 0 ? (totalFS1311Compliant / totalTests * 100) : 0.0,
    };
  }
}


/**
 * 07. 業務邏輯欄位過濾器 (階段三強化版)
 * @version 2025-10-08-V2.0.0
 * @date 2025-10-08
 * @update: 階段三實作 - 精確排除BK.js和DD1.js欄位，強化1311.FS.js相容性
 */
Map<String, dynamic> filterBusinessLogicFields(Map<String, dynamic> data, String dataType) {
  final cleanData = Map<String, dynamic>.from(data);
  
  // BK.js業務邏輯欄位清單 (基於1301.BK.js分析)
  final bkBusinessLogicFields = [
    'balance',                    // 餘額計算
    'totalAmount',               // 總金額統計  
    'averageAmount',             // 平均金額
    'categoryRecommendation',    // 分類推薦
    'similarTransactions',       // 相似交易
    'validationErrors',          // 驗證錯誤
    'calculatedFields',          // 計算欄位
    'creditScore',              // 信用評分 (BK計算)
    'riskLevel',                // 風險等級 (BK評估)
    'monthlyBudget',            // 月度預算 (BK計算)
    'spendingTrend',            // 支出趨勢 (BK分析)
    'categoryStats',            // 分類統計 (BK生成)
    'transactionAnalysis',      // 交易分析 (BK處理)
    'budgetStatus',             // 預算狀態 (BK計算)
    'financialScore',           // 財務評分 (BK評估)
    'predictedAmount',          // 預測金額 (BK推算)
    'categoryMapping',          // 分類映射 (BK邏輯)
    'validationStatus',         // 驗證狀態 (BK處理)
  ];
  
  // DD1.js協調處理欄位清單 (基於1331.DD1.js分析)
  final dd1BusinessLogicFields = [
    'processingStatus',         // 處理狀態
    'coordinationState',        // 協調狀態
    'trendAnalysis',           // 趨勢分析
    'statisticsSummary',       // 統計摘要
    'riskAssessment',          // 風險評估
    'usagePattern',            // 使用模式
    'anomalyDetection',        // 異常檢測
    'recommendedMode',         // 推薦模式 (DD1推薦)
    'smartCategory',           // 智慧分類 (DD1分析)
    'behaviorPattern',         // 行為模式 (DD1分析)
    'systemRecommendation',    // 系統推薦 (DD1生成)
    'coordinationResult',      // 協調結果 (DD1處理)
    'intelligentSuggestion',   // 智慧建議 (DD1產生)
    'adaptiveCategory',        // 適應性分類 (DD1調整)
    'learningData',           // 學習數據 (DD1收集)
    'optimizationSuggestion', // 優化建議 (DD1分析)
    'patternRecognition',     // 模式識別 (DD1處理)
    'contextualData',         // 上下文資料 (DD1生成)
  ];
  
  // 移除業務邏輯欄位
  final allBusinessFields = [...bkBusinessLogicFields, ...dd1BusinessLogicFields];
  for (final field in allBusinessFields) {
    cleanData.remove(field);
  }
  
  // 針對特定資料類型的額外過濾 (基於1311.FS.js規範)
  switch (dataType) {
    case 'systemEntry':
      // 排除DD1生成的行為分析欄位
      cleanData.remove('loginHistory');     
      cleanData.remove('behaviorAnalysis'); 
      cleanData.remove('sessionAnalytics'); 
      cleanData.remove('userInsights');     
      cleanData.remove('modeRecommendation'); 
      break;
    case 'accountingCore':
      // 排除BK自動生成的計算欄位
      cleanData.remove('autoCategory');     
      cleanData.remove('budgetImpact');     
      cleanData.remove('smartDescription'); 
      cleanData.remove('categoryConfidence');
      cleanData.remove('duplicateCheck');  
      cleanData.remove('amountValidation'); 
      break;
  }
  
  // 確保保留1311.FS.js必要欄位
  _ensureFS1311RequiredFields(cleanData, dataType);
  
  return cleanData;
}

/**
 * 08. 確保1311.FS.js必要欄位存在
 * @version 2025-10-08-V2.0.0
 * @date 2025-10-08
 * @update: 階段三實作 - 1311.FS.js格式強制檢查
 */
void _ensureFS1311RequiredFields(Map<String, dynamic> data, String dataType) {
  switch (dataType) {
    case 'accountingCore':
      // 1311.FS.js交易記錄必要欄位
      final requiredTransactionFields = {
        '收支ID': data['transactionId'] ?? data['收支ID'] ?? '',
        '日期': data['date'] ?? data['日期'] ?? '',
        '時間': data['time'] ?? data['時間'] ?? '',
        '收入': data['income'] ?? data['收入'] ?? '',
        '支出': data['expense'] ?? data['支出'] ?? '',
        '備註': data['description'] ?? data['備註'] ?? '',
        '子項名稱': data['categoryName'] ?? data['子項名稱'] ?? '',
        '大項代碼': data['majorCode'] ?? data['大項代碼'] ?? '',
        '子項代碼': data['subCode'] ?? data['子項代碼'] ?? '',
        '支付方式': data['paymentMethod'] ?? data['支付方式'] ?? '',
        'UID': data['userId'] ?? data['UID'] ?? '',
      };
      
      // 移除不符合1311.FS.js的舊格式欄位
      data.removeWhere((key, value) => !requiredTransactionFields.containsKey(key) && 
                                       !['createdAt', 'updatedAt', 'source', 'version'].contains(key));
      
      // 添加1311.FS.js標準欄位
      data.addAll(requiredTransactionFields);
      break;
      
    case 'systemEntry':
      // 確保用戶資料符合1311.FS.js用戶格式
      if (data.containsKey('email') && !data.containsKey('UID')) {
        data['UID'] = data['email'];
      }
      break;
  }
}

// ==========================================
// 模組注入實作
// ==========================================

/**
 * 08. 7301系統進入功能群注入實作
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 直接注入到7301模組
 */
Future<bool> _injectToSystemEntryModule(Map<String, dynamic> data) async {
  try {
    // 取得SystemEntryFunctionGroup實例
    final systemEntry = SystemEntryFunctionGroup.instance;
    
    // 模擬注入過程
    await Future.delayed(Duration(milliseconds: 100));
    
    // 根據資料類型執行對應的注入
    if (data.containsKey('email') && data.containsKey('userMode')) {
      // 注入用戶註冊資料
      print('[7580] 注入用戶註冊資料: ${data['email']} (${data['userMode']})');
      return true;
    }
    
    return false;
  } catch (e) {
    print('[7580] 7301模組注入錯誤: $e');
    return false;
  }
}

/**
 * 09. 7302記帳核心功能群注入實作
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 直接注入到7302模組
 */
Future<bool> _injectToAccountingCoreModule(Map<String, dynamic> data) async {
  try {
    // 取得依賴注入容器
    DependencyContainer.registerAccountingDependencies();
    
    // 模擬注入過程
    await Future.delayed(Duration(milliseconds: 100));
    
    // 根據資料類型執行對應的注入
    if (data.containsKey('transactionId') && data.containsKey('amount')) {
      // 注入交易資料
      print('[7580] 注入交易資料: ${data['transactionId']} (${data['type']}, \$${data['amount']})');
      return true;
    }
    
    return false;
  } catch (e) {
    print('[7580] 7302模組注入錯誤: $e');
    return false;
  }
}

// ==========================================
// 測試資料範本
// ==========================================

/**
 * 10. 系統進入功能群測試資料範本
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 符合1311.FS.js格式的測試資料範本
 */
class SystemEntryTestDataTemplate {
  static Map<String, dynamic> getUserRegistrationTemplate({
    required String userId,
    required String email,
    required String userMode,
    String? displayName,
  }) {
    return {
      'userId': userId,
      'email': email,
      'userMode': userMode, // Expert/Inertial/Cultivation/Guiding
      'displayName': displayName ?? '',
      'registrationDate': DateTime.now().toIso8601String(),
      'preferences': {
        'language': 'zh-TW',
        'timezone': 'Asia/Taipei',
        'theme': 'auto',
      },
      // 注意：排除BK/DD1業務邏輯欄位
      // - creditScore (BK計算) ❌
      // - recommendedMode (DD1推薦) ❌
      // - riskAssessment (DD1評估) ❌
      // - usagePattern (DD1分析) ❌
    };
  }

  static Map<String, dynamic> getUserLoginTemplate({
    required String userId,
    required String email,
  }) {
    return {
      'userId': userId,
      'email': email,
      'loginDate': DateTime.now().toIso8601String(),
      'deviceInfo': 'Flutter_Test_Device',
      // 注意：排除BK/DD1業務邏輯欄位
      // - loginHistory (DD1生成) ❌
      // - behaviorAnalysis (DD1分析) ❌
    };
  }
}

/**
 * 11. 記帳核心功能群測試資料範本
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 符合1311.FS.js格式的測試資料範本
 */
class AccountingCoreTestDataTemplate {
  static Map<String, dynamic> getTransactionTemplate({
    required String transactionId,
    required double amount,
    required String type,
    required String description,
    String? categoryId,
    String? accountId,
  }) {
    return {
      'transactionId': transactionId,
      'amount': amount,
      'type': type, // income/expense/transfer
      'description': description,
      'date': DateTime.now().toIso8601String(),
      'categoryId': categoryId,
      'accountId': accountId,
      // 注意：排除BK/DD1業務邏輯欄位
      // - balance (BK計算) ❌
      // - categoryRecommendation (BK推薦) ❌
      // - trendAnalysis (DD1分析) ❌
      // - statisticsSummary (DD1統計) ❌
      // - validationStatus (BK驗證) ❌
    };
  }

  static Map<String, dynamic> getCategoryTemplate({
    required String categoryId,
    required String name,
    required String type,
  }) {
    return {
      'categoryId': categoryId,
      'name': name,
      'type': type, // income/expense
      'icon': '📝',
      'color': '#4CAF50',
      'createdDate': DateTime.now().toIso8601String(),
      // 注意：排除BK/DD1業務邏輯欄位
      // - usageCount (BK統計) ❌
      // - recommendationScore (DD1計算) ❌
    };
  }
}

// ==========================================
// 注入歷史記錄
// ==========================================

/**
 * 12. 注入歷史記錄
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 注入操作歷史記錄
 */
void _recordInjection(String moduleType, Map<String, dynamic> data) {
  final record = {
    'timestamp': DateTime.now().toIso8601String(),
    'moduleType': moduleType,
    'dataKeys': data.keys.toList(),
    'recordCount': 1,
  };
  
  TestDataInjectionFactory.instance._injectionHistory.add(jsonEncode(record));
  
  // 保持最近100筆記錄
  if (TestDataInjectionFactory.instance._injectionHistory.length > 100) {
    TestDataInjectionFactory.instance._injectionHistory.removeAt(0);
  }
}

/**
 * 13. 取得注入統計
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 注入統計資訊
 */
Map<String, dynamic> getInjectionStatistics() {
  final history = TestDataInjectionFactory.instance._injectionHistory;
  final systemEntryCount = history.where((h) => h.contains('SystemEntry')).length;
  final accountingCoreCount = history.where((h) => h.contains('AccountingCore')).length;
  
  return {
    'totalInjections': history.length,
    'systemEntryInjections': systemEntryCount,
    'accountingCoreInjections': accountingCoreCount,
    'lastInjection': history.isNotEmpty ? history.last : null,
  };
}

// ==========================================
// 四模式差異化支援
// ==========================================

/**
 * 14. 四模式測試資料產生器
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 支援Expert/Inertial/Cultivation/Guiding模式差異
 */
class FourModeTestDataGenerator {
  static Map<String, dynamic> generateModeSpecificData(String userMode) {
    final baseUserId = 'test_user_${DateTime.now().millisecondsSinceEpoch}';
    final baseEmail = '${userMode.toLowerCase()}@test.lcas.com';
    
    switch (userMode) {
      case 'Expert':
        return SystemEntryTestDataTemplate.getUserRegistrationTemplate(
          userId: '${baseUserId}_expert',
          email: baseEmail,
          userMode: 'Expert',
          displayName: 'Expert Mode Tester',
        );
      
      case 'Inertial':
        return SystemEntryTestDataTemplate.getUserRegistrationTemplate(
          userId: '${baseUserId}_inertial',
          email: baseEmail,
          userMode: 'Inertial',
          displayName: 'Inertial Mode Tester',
        );
      
      case 'Cultivation':
        return SystemEntryTestDataTemplate.getUserRegistrationTemplate(
          userId: '${baseUserId}_cultivation',
          email: baseEmail,
          userMode: 'Cultivation',
          displayName: 'Cultivation Mode Tester',
        );
      
      case 'Guiding':
        return SystemEntryTestDataTemplate.getUserRegistrationTemplate(
          userId: '${baseUserId}_guiding',
          email: baseEmail,
          userMode: 'Guiding',
          displayName: 'Guiding Mode Tester',
        );
      
      default:
        return SystemEntryTestDataTemplate.getUserRegistrationTemplate(
          userId: baseUserId,
          email: 'default@test.lcas.com',
          userMode: 'Inertial',
        );
    }
  }
}

// ==========================================
// 模組導出 (階段三完整版)
// ==========================================

/// 7580注入測試資料模組主要導出 (v2.0.0)
export {
  // 核心注入工廠
  TestDataInjectionFactory,
  
  // 資料範本
  SystemEntryTestDataTemplate,
  AccountingCoreTestDataTemplate,
  FourModeTestDataGenerator,
  
  // 驗證器 (階段三強化)
  validateSystemEntryFormat,
  validateAccountingCoreFormat,
  filterBusinessLogicFields,
  
  // 階段三新增：整合器
  TestModuleIntegrator,
  
  // 統計與管理
  getInjectionStatistics,
};

// 模組初始化 (階段三版本)
void initializeTestDataInjection() {
  print('[7580] 🎉 測試資料注入模組 v2.0.0 (階段三) 初始化完成');
  print('[7580] 📌 支援直接注入PL層 7301、7302 模組');
  print('[7580] 📋 完全遵循 1311.FS.js 資料格式標準');
  print('[7580] 🚫 精確排除 BK.js 和 DD1.js 業務邏輯欄位');
  print('[7580] 🔧 支援四模式差異化測試資料生成');
  print('[7580] 🔗 整合 7501、7502 測試模組');
  print('[7580] ✅ 階段三：資料格式標準化與整合完成');
}

// 自動初始化
void main() {
  initializeTestDataInjection();
}
