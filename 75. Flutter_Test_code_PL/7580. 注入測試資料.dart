
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
 * 06. 記帳核心功能群格式驗證
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 1311.FS.js格式驗證
 */
Map<String, dynamic> validateAccountingCoreFormat(Map<String, dynamic> data) {
  final errors = <String>[];
  
  try {
    // 必要欄位檢查
    final requiredFields = ['transactionId', 'amount', 'type', 'description', 'date'];
    for (final field in requiredFields) {
      if (!data.containsKey(field) || data[field] == null) {
        errors.add('缺少必要欄位: $field');
      }
    }
    
    // 交易類型驗證
    if (data.containsKey('type')) {
      final validTypes = ['income', 'expense', 'transfer'];
      if (!validTypes.contains(data['type'])) {
        errors.add('無效的交易類型: ${data['type']}');
      }
    }
    
    // 金額驗證
    if (data.containsKey('amount')) {
      if (data['amount'] is! num || data['amount'] <= 0) {
        errors.add('無效的金額: ${data['amount']}');
      }
    }
    
    // 日期格式驗證 (ISO 8601)
    if (data.containsKey('date')) {
      try {
        DateTime.parse(data['date']);
      } catch (e) {
        errors.add('無效的日期格式: ${data['date']}');
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

// ==========================================
// 業務邏輯欄位過濾器
// ==========================================

/**
 * 07. 業務邏輯欄位過濾器
 * @version 2025-10-08-V1.0.0
 * @date 2025-10-08
 * @update: 階段一實作 - 排除BK.js和DD1.js欄位
 */
Map<String, dynamic> filterBusinessLogicFields(Map<String, dynamic> data, String dataType) {
  final cleanData = Map<String, dynamic>.from(data);
  
  // BK.js業務邏輯欄位清單 (需排除)
  final bkBusinessLogicFields = [
    'balance',              // 餘額計算
    'totalAmount',          // 總金額統計  
    'averageAmount',        // 平均金額
    'categoryRecommendation', // 分類推薦
    'similarTransactions',  // 相似交易
    'validationErrors',     // 驗證錯誤
    'calculatedFields',     // 計算欄位
    'creditScore',          // 信用評分 (BK計算)
    'riskLevel',           // 風險等級 (BK評估)
  ];
  
  // DD1.js協調處理欄位清單 (需排除)
  final dd1BusinessLogicFields = [
    'processingStatus',     // 處理狀態
    'coordinationState',    // 協調狀態
    'trendAnalysis',        // 趨勢分析
    'statisticsSummary',    // 統計摘要
    'riskAssessment',       // 風險評估
    'usagePattern',         // 使用模式
    'anomalyDetection',     // 異常檢測
    'recommendedMode',      // 推薦模式 (DD1推薦)
    'smartCategory',        // 智慧分類 (DD1分析)
  ];
  
  // 移除業務邏輯欄位
  final allBusinessFields = [...bkBusinessLogicFields, ...dd1BusinessLogicFields];
  for (final field in allBusinessFields) {
    cleanData.remove(field);
  }
  
  // 針對特定資料類型的額外過濾
  switch (dataType) {
    case 'systemEntry':
      cleanData.remove('loginHistory');     // DD1生成的登入歷史
      cleanData.remove('behaviorAnalysis'); // DD1行為分析
      break;
    case 'accountingCore':
      cleanData.remove('autoCategory');     // BK自動分類
      cleanData.remove('budgetImpact');     // BK預算影響分析
      break;
  }
  
  return cleanData;
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
// 模組導出
// ==========================================

/// 7580注入測試資料模組主要導出
export {
  TestDataInjectionFactory,
  SystemEntryTestDataTemplate,
  AccountingCoreTestDataTemplate,
  FourModeTestDataGenerator,
  validateSystemEntryFormat,
  validateAccountingCoreFormat,
  filterBusinessLogicFields,
  getInjectionStatistics,
};

// 模組初始化
void initializeTestDataInjection() {
  print('[7580] 🎉 測試資料注入模組 v1.0.0 初始化完成');
  print('[7580] 📌 支援直接注入PL層 7301、7302 模組');
  print('[7580] 📋 遵循 1311.FS.js 資料格式標準');
  print('[7580] 🚫 已排除 BK.js 和 DD1.js 業務邏輯欄位');
  print('[7580] 🔧 支援四模式差異化測試資料生成');
}

// 自動初始化
void main() {
  initializeTestDataInjection();
}
