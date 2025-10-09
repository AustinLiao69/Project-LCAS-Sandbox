/**
 * 7580. 注入測試資料.dart
 * @version v1.0.0
 * @date 2025-10-09
 * @update: 階段一建立 - 基礎測試資料注入功能
 */

import 'dart:async';
import 'dart:convert';

/// 測試資料注入工廠
class TestDataInjectionFactory {
  static final TestDataInjectionFactory _instance = TestDataInjectionFactory._internal();
  static TestDataInjectionFactory get instance => _instance;
  TestDataInjectionFactory._internal();

  /// 注入系統進入功能群測試資料
  Future<bool> injectSystemEntryData(Map<String, dynamic> testData) async {
    try {
      // 模擬資料注入處理
      await Future.delayed(Duration(milliseconds: 100));

      // 驗證資料格式
      if (testData.isEmpty) {
        return false;
      }

      // 模擬成功注入
      print('[TestDataInjection] 系統進入資料注入成功: ${testData['userId'] ?? 'unknown'}');
      return true;

    } catch (e) {
      print('[TestDataInjection] 資料注入失敗: $e');
      return false;
    }
  }

  /// 注入記帳核心功能群測試資料
  Future<bool> injectAccountingCoreData(Map<String, dynamic> testData) async {
    try {
      // 模擬資料注入處理
      await Future.delayed(Duration(milliseconds: 150));

      // 驗證資料格式
      if (testData.isEmpty) {
        return false;
      }

      // 模擬成功注入
      print('[TestDataInjection] 記帳核心資料注入成功: ${testData['transactionId'] ?? testData['收支ID'] ?? 'unknown'}');
      return true;

    } catch (e) {
      print('[TestDataInjection] 資料注入失敗: $e');
      return false;
    }
  }
}

/// 系統進入測試資料模板
class SystemEntryTestDataTemplate {
  /// 取得用戶註冊模板
  static Map<String, dynamic> getUserRegistrationTemplate({
    required String userId,
    required String email,
    String userMode = 'Expert',
  }) {
    return {
      'userId': userId,
      'email': email,
      'password': 'TestPass123!',
      'displayName': '測試用戶_$userId',
      'userMode': userMode,
      'acceptTerms': true,
      'acceptPrivacy': true,
      'registration_data': {
        'first_name': 'Test',
        'last_name': 'User',
        'phone': '+886912345678',
        'date_of_birth': '1990-01-01',
        'preferred_language': 'zh-TW'
      }
    };
  }

  /// 取得用戶登入模板
  static Map<String, dynamic> getUserLoginTemplate({
    required String userId,
    required String email,
  }) {
    return {
      'userId': userId,
      'email': email,
      'password': 'TestPass123!',
      'rememberMe': true,
      'deviceInfo': {
        'deviceId': 'test-device-$userId',
        'platform': 'Web',
        'appVersion': '1.0.0'
      }
    };
  }
}

/// 記帳核心測試資料模板
class AccountingCoreTestDataTemplate {
  /// 取得交易記錄模板
  static Map<String, dynamic> getTransactionTemplate({
    required String transactionId,
    required double amount,
    required String type,
    required String description,
    String? categoryId,
    String? accountId,
  }) {
    return {
      '收支ID': transactionId,
      '金額': amount,
      '收支類型': type,
      '描述': description,
      '科目ID': categoryId ?? 'default_category',
      '帳戶ID': accountId ?? 'default_account',
      '建立時間': DateTime.now().toIso8601String(),
      '更新時間': DateTime.now().toIso8601String(),
    };
  }

  /// 取得快速記帳模板
  static Map<String, dynamic> getQuickTransactionTemplate({
    required String description,
    required String transactionType,
  }) {
    return {
      '描述': description,
      '收支類型': transactionType,
      '快速記帳': true,
      '建立時間': DateTime.now().toIso8601String(),
    };
  }
}

/// 格式驗證函數
Map<String, dynamic> validateSystemEntryFormat(dynamic data) {
  try {
    if (data is! Map<String, dynamic>) {
      return {
        'isValid': false,
        'error': '資料格式必須為Map<String, dynamic>'
      };
    }

    // 基本欄位驗證
    final requiredFields = ['userId', 'email'];
    for (final field in requiredFields) {
      if (!data.containsKey(field) || data[field] == null) {
        return {
          'isValid': false,
          'error': '缺少必要欄位: $field'
        };
      }
    }

    return {
      'isValid': true,
      'message': '格式驗證通過'
    };
  } catch (e) {
    return {
      'isValid': false,
      'error': '驗證過程發生錯誤: ${e.toString()}'
    };
  }
}