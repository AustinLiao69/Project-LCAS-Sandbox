
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
      // 驗證必要欄位
      if (data['userId'] == null || data['userId'] == '') {
        throw ArgumentError('userId不能為空');
      }
      
      // 驗證Email格式
      if (data['email'] != null && data['email'] != '') {
        final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
        if (!emailRegex.hasMatch(data['email'])) {
          throw ArgumentError('無效的Email格式: ${data['email']}');
        }
      }
      
      // 驗證用戶模式
      if (data['userMode'] != null) {
        final validModes = ['Expert', 'Inertial', 'Cultivation', 'Guiding'];
        if (!validModes.contains(data['userMode'])) {
          throw ArgumentError('無效的用戶模式: ${data['userMode']}');
        }
      }
      
      // 驗證金額（如果存在）
      if (data['amount'] != null && data['amount'] is num && data['amount'] < 0) {
        throw ArgumentError('金額不能為負數: ${data['amount']}');
      }

      await Future.delayed(Duration(milliseconds: 100));
      _injectionHistory.add('SystemEntry: ${DateTime.now().toIso8601String()}');
      return true;
    } catch (e) {
      // 重新拋出異常，讓測試可以捕獲
      rethrow;
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
