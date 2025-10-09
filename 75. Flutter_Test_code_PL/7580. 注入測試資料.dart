
/**
 * 7580. 注入測試資料.dart
 * @version v2.0.0
 * @date 2025-10-09
 * @update: 階段一實作 - SIT測試資料注入機制
 */

import 'dart:async';
import 'dart:convert';

// ==========================================
// 測試資料注入工廠
// ==========================================

class TestDataInjectionFactory {
  static final TestDataInjectionFactory _instance = TestDataInjectionFactory._internal();
  static TestDataInjectionFactory get instance => _instance;
  TestDataInjectionFactory._internal();

  final List<String> _injectionHistory = [];

  Future<bool> injectSystemEntryData(Map<String, dynamic> data) async {
    try {
      await Future.delayed(Duration(milliseconds: 100));
      _injectionHistory.add('SystemEntry: ${DateTime.now().toIso8601String()}');
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> injectAccountingCoreData(Map<String, dynamic> data) async {
    try {
      await Future.delayed(Duration(milliseconds: 100));
      _injectionHistory.add('AccountingCore: ${DateTime.now().toIso8601String()}');
      return true;
    } catch (e) {
      return false;
    }
  }
}

// ==========================================
// 系統進入測試資料模板
// ==========================================

class SystemEntryTestDataTemplate {
  static Map<String, dynamic> getUserRegistrationTemplate({
    required String userId,
    required String email,
    String? displayName,
    String userMode = 'Inertial',
  }) {
    return {
      'userId': userId,
      'email': email,
      'displayName': displayName ?? 'Test User',
      'userMode': userMode,
      'registrationDate': DateTime.now().toIso8601String(),
    };
  }

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
// 記帳核心測試資料模板
// ==========================================

class AccountingCoreTestDataTemplate {
  static Map<String, dynamic> getTransactionTemplate({
    required String transactionId,
    required double amount,
    required String type,
    String? description,
    String? categoryId,
    String? accountId,
  }) {
    return {
      'transactionId': transactionId,
      'amount': amount,
      'type': type,
      'description': description ?? 'Test transaction',
      'categoryId': categoryId,
      'accountId': accountId,
      'date': DateTime.now().toIso8601String(),
    };
  }
}

// ==========================================
// 格式驗證函數
// ==========================================

Map<String, dynamic> validateSystemEntryFormat(dynamic data) {
  if (data == null) {
    return {'isValid': false, 'error': 'Data is null'};
  }
  
  if (data is! Map<String, dynamic>) {
    return {'isValid': false, 'error': 'Data is not a Map'};
  }
  
  return {'isValid': true};
}

Map<String, dynamic> validateAccountingCoreFormat(dynamic data) {
  if (data == null) {
    return {'isValid': false, 'error': 'Data is null'};
  }
  
  if (data is! Map<String, dynamic>) {
    return {'isValid': false, 'error': 'Data is not a Map'};
  }
  
  return {'isValid': true};
}
