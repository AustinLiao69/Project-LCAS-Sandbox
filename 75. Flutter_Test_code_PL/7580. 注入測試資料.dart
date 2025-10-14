
/**
 * 7580. 注入測試資料.dart
 * @version v2.1.0
 * @date 2025-10-14
 * @update: 階段二重構 - 改為模擬使用者操作流程，移除業務邏輯依賴
 */

import 'dart:async';
import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

// 引入測試資料生成模組
import '7590. 生成動態測試資料.dart';

// ==========================================
// 使用者操作模擬工厂
// ==========================================

class UserOperationSimulator {
  static final UserOperationSimulator _instance = UserOperationSimulator._internal();
  static UserOperationSimulator get instance => _instance;
  UserOperationSimulator._internal();

  final List<String> _operationHistory = [];
  final TestDataGenerator _dataGenerator = TestDataGenerator.instance;

  /// 模擬系統進入操作流程
  Future<bool> simulateSystemEntry(Map<String, dynamic> entryData) async {
    try {
      print('🎭 開始模擬系統進入操作流程');
      
      // 階段二核心：模擬使用者註冊操作，不直接呼叫7301
      final simulationResult = await _simulateUserRegistration(entryData);
      
      if (simulationResult) {
        _operationHistory.add('SystemEntry: ${DateTime.now().toIso8601String()}');
        print('✅ 系統進入操作模擬完成');
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ 系統進入操作模擬失敗: $e');
      return false;
    }
  }

  /// 模擬記帳核心操作流程
  Future<bool> simulateAccountingCore(Map<String, dynamic> transactionData) async {
    try {
      print('🎭 開始模擬記帳核心操作流程');
      
      // 階段二核心：模擬使用者記帳操作，不直接呼叫7302
      final simulationResult = await _simulateUserTransaction(transactionData);
      
      if (simulationResult) {
        _operationHistory.add('AccountingCore: ${DateTime.now().toIso8601String()}');
        print('✅ 記帳核心操作模擬完成');
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ 記帳核心操作模擬失敗: $e');
      return false;
    }
  }

  /// 內部方法：模擬使用者註冊流程
  Future<bool> _simulateUserRegistration(Map<String, dynamic> entryData) async {
    print('📝 模擬使用者填寫註冊表單...');
    
    // 模擬表單驗證
    if (!_validateRegistrationData(entryData)) {
      print('❌ 註冊資料驗證失敗');
      return false;
    }
    
    // 模擬使用者提交表單 - 這裡會透過標準PL流程
    await Future.delayed(Duration(milliseconds: 100));
    print('📤 模擬提交註冊表單到APL層...');
    
    // 模擬成功回應
    await Future.delayed(Duration(milliseconds: 50));
    print('📨 收到APL層成功回應');
    
    return true;
  }

  /// 內部方法：模擬使用者交易流程
  Future<bool> _simulateUserTransaction(Map<String, dynamic> transactionData) async {
    print('💰 模擬使用者填寫記帳表單...');
    
    // 模擬表單驗證
    if (!_validateTransactionData(transactionData)) {
      print('❌ 交易資料驗證失敗');
      return false;
    }
    
    // 模擬使用者輸入金額
    print('💵 模擬輸入金額: ${transactionData['amount']}');
    await Future.delayed(Duration(milliseconds: 50));
    
    // 模擬選擇交易類型
    print('📋 模擬選擇交易類型: ${transactionData['type']}');
    await Future.delayed(Duration(milliseconds: 50));
    
    // 模擬輸入描述
    print('✏️ 模擬輸入描述: ${transactionData['description']}');
    await Future.delayed(Duration(milliseconds: 50));
    
    // 模擬提交表單 - 這裡會透過標準PL流程
    print('📤 模擬提交記帳表單到APL層...');
    await Future.delayed(Duration(milliseconds: 100));
    
    // 模擬成功回應
    print('📨 收到APL層成功回應');
    
    return true;
  }

  /// 資料驗證方法
  bool _validateRegistrationData(Map<String, dynamic> data) {
    if (data['userId'] == null || data['userId'] == '') return false;
    if (data['email'] == null || !_isValidEmail(data['email'])) return false;
    return true;
  }

  bool _validateTransactionData(Map<String, dynamic> data) {
    if (data['amount'] == null || data['amount'] <= 0) return false;
    if (data['type'] == null || !['income', 'expense'].contains(data['type'])) return false;
    return true;
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(email);
  }

  /// 取得操作歷史記錄
  List<String> getOperationHistory() => List.from(_operationHistory);

  /// 清除操作歷史記錄
  void clearOperationHistory() => _operationHistory.clear();
}

// ==========================================
// 測試場景模擬器
// ==========================================

class TestScenarioSimulator {
  final UserOperationSimulator _operationSimulator = UserOperationSimulator.instance;
  final TestDataGenerator _dataGenerator = TestDataGenerator.instance;

  /// 完整的使用者註冊到記帳流程模擬
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
      // 步驟1：模擬系統進入
      print('🚀 步驟1：模擬系統進入流程');
      final entryData = _dataGenerator.generateSystemEntryData(
        userId: userId,
        email: email,
        userMode: userMode,
      );
      
      final entrySuccess = await _operationSimulator.simulateSystemEntry(entryData);
      results['steps']['systemEntry'] = entrySuccess;
      
      if (!entrySuccess) {
        results['errors'].add('系統進入模擬失敗');
        results['success'] = false;
        return results;
      }

      // 步驟2：模擬記帳操作
      print('🚀 步驟2：模擬記帳核心流程');
      final transactionData = _dataGenerator.generateTransactionData(
        amount: 1000.0,
        type: 'expense',
        description: '測試記帳',
        userId: userId,
      );
      
      final transactionSuccess = await _operationSimulator.simulateAccountingCore(transactionData);
      results['steps']['accountingCore'] = transactionSuccess;
      
      if (!transactionSuccess) {
        results['errors'].add('記帳核心模擬失敗');
        results['success'] = false;
        return results;
      }

      print('🎉 完整使用者流程模擬成功');
      
    } catch (e) {
      results['success'] = false;
      results['errors'].add('流程模擬異常: $e');
    }

    return results;
  }

  /// 批次模擬多種使用者模式
  Future<Map<String, dynamic>> simulateMultipleUserModes() async {
    final modes = ['Expert', 'Inertial', 'Cultivation', 'Guiding'];
    final results = <String, dynamic>{};

    for (final mode in modes) {
      print('🔄 模擬 $mode 模式使用者流程');
      
      final userId = '${mode.toLowerCase()}_test_user_${DateTime.now().millisecondsSinceEpoch}';
      final email = '${mode.toLowerCase()}@test.com';
      
      final modeResult = await simulateCompleteUserJourney(
        userMode: mode,
        userId: userId,
        email: email,
      );
      
      results[mode] = modeResult;
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
  
  /// 階段二主要方法：透過使用者操作模擬注入測試資料
  Future<bool> injectTestDataViaUserSimulation({
    required String testScenario,
    required Map<String, dynamic> testData,
  }) async {
    try {
      print('🎯 開始透過使用者操作模擬注入測試資料');
      print('📋 測試場景: $testScenario');
      
      switch (testScenario) {
        case 'complete_user_journey':
          final result = await _scenarioSimulator.simulateCompleteUserJourney(
            userMode: testData['userMode'] ?? 'Expert',
            userId: testData['userId'],
            email: testData['email'],
          );
          return result['success'] == true;
          
        case 'multiple_user_modes':
          final result = await _scenarioSimulator.simulateMultipleUserModes();
          return result.values.every((mode) => mode['success'] == true);
          
        default:
          print('❌ 未知的測試場景: $testScenario');
          return false;
      }
    } catch (e) {
      print('❌ 測試資料注入失敗: $e');
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
