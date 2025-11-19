/**
 * 7582. 註冊使用者.dart
 * @version v1.1.0
 * @date 2025-10-28
 * @description 註冊使用者測試模組 - 調用7598的email進行真實註冊，觸發1309模組在Firebase建立帳本
 * @compliance 嚴格遵守0098憲法 - 禁止hard coding、模擬業務邏輯，遵守dataflow
 * @update v1.1.0: 修正為真實API調用，確保1309模組建立Firebase帳本
 */

import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:http/http.dart' as http;

/// 註冊使用者測試類別
class RegisterUserTest {
  // 測試結果統計
  int totalTests = 0;
  int passedTests = 0;
  int failedTests = 0;
  List<String> testResults = [];

  // ASL服務端點
  final String aslBaseUrl = 'http://localhost:5000';

  /// 載入7598測試資料
  Map<String, dynamic> loadTestData() {
    try {
      final file = File('7598. Data warehouse.json');
      final jsonString = file.readAsStringSync();
      final data = jsonDecode(jsonString);

      print('[7582] ✅ 成功載入7598測試資料');
      return data;
    } catch (e) {
      print('[7582] ❌ 無法載入7598測試資料: $e');
      throw Exception('測試資料載入失敗');
    }
  }

  /// 執行使用者註冊測試
  Future<void> runUserRegistrationTests() async {
    print('\n🚀 [7582] 開始執行使用者註冊測試...\n');

    try {
      // 載入測試資料
      final testData = loadTestData();
      final authTestData = testData['authentication_test_data'] as Map<String, dynamic>;
      final successScenarios = authTestData['success_scenarios'] as Map<String, dynamic>;

      // 檢查ASL服務狀態
      await _checkASLServiceStatus();

      // 執行成功情境測試（選擇部分進行真實註冊）
      await _runRealRegistrationTests(successScenarios);

      // 輸出測試結果統計
      _printTestSummary();

    } catch (e) {
      print('[7582] ❌ 註冊測試執行失敗: $e');
      rethrow;
    }
  }

  /// 檢查ASL服務狀態
  Future<void> _checkASLServiceStatus() async {
    print('\n🔍 檢查ASL服務狀態...');
    try {
      final response = await http.get(Uri.parse('$aslBaseUrl/health'));
      if (response.statusCode == 200) {
        print('✅ ASL服務正常運行');
      } else {
        print('⚠️ ASL服務回應異常: ${response.statusCode}');
        print('💡 請確認ASL服務已在Port 5000啟動');
      }
    } catch (e) {
      print('❌ ASL服務不可用: $e');
      print('💡 請確認ASL服務已在Port 5000啟動');
      // 雖然服務不可用，但仍繼續測試，以便診斷問題
    }
  }

  /// 執行真實註冊測試（遵守0098：調用真實API，不模擬業務邏輯）
  Future<void> _runRealRegistrationTests(Map<String, dynamic> successScenarios) async {
    print('📋 執行真實註冊測試（調用ASL → AM → Firebase）...\n');

    // 階段二修正：使用sit_p3@sit.com測試用戶進行P3帳戶與科目管理測試
    final testScenario = 'sit_p3_user';
    final scenarioData = successScenarios[testScenario] as Map<String, dynamic>;

    print('[7582] 🧪 SIT P3真實註冊測試: $testScenario');

    try {
      // 從7598取得sit_p3@sit.com用戶資料（遵守0098：不hard coding）
      final email = scenarioData['email'] as String;
      final displayName = email.split('@')[0]; // 從email生成displayName
      final userMode = 'Expert'; // P3測試使用Expert模式

      print('[7582] 📧 使用SIT P3測試Email: $email');
      print('[7582] 👤 用戶模式: $userMode');
      print('[7582] 🎯 測試目標: P3帳戶與科目管理功能驗證');

      // 調用真實的註冊API（遵守dataflow: PL → APL → ASL → BL → Firebase）
      final registrationResult = await _callRealRegistrationAPI(
        email: email,
        displayName: displayName,
        userMode: userMode,
      );

      if (registrationResult['success'] == true) {
        print('[7582] ✅ sit_p3@sit.com註冊API調用成功');
        print('[7582] ✅ SIT P3用戶註冊成功！');

        // 驗證1309 AM模組是否成功建立Firebase帳本（P3測試準備）
        final ledgerVerification = await _verifyFirebaseLedgerCreation(registrationResult);

        if (ledgerVerification) {
          _recordTestResult(testScenario, true, 'SIT P3用戶註冊成功，AM模組已建立完整帳本，P3測試準備就緒');
        } else {
          _recordTestResult(testScenario, false, 'SIT P3用戶註冊成功但AM模組帳本初始化未完成');
        }
      } else {
        _recordTestResult(testScenario, false, 
          'SIT P3用戶註冊失敗: ${registrationResult['message']}');
      }

    } catch (e) {
      _recordTestResult(testScenario, false, '真實註冊測試執行錯誤: $e');
      print('[7582] ❌ 註冊測試錯誤: $e');
    }
  }

  /// 調用真實的註冊API（遵守dataflow: PL → APL → ASL → BL）
  Future<Map<String, dynamic>> _callRealRegistrationAPI({
    required String email,
    String? displayName,
    String? userMode,
  }) async {
    try {
      print('[7582] 📡 調用真實註冊API: POST $aslBaseUrl/api/v1/auth/register');

      // 準備真實註冊請求資料
      final registrationData = {
        'email': email,
        'password': 'TestPassword123!', // 測試用密碼
        'displayName': displayName ?? email.split('@')[0],
        'userMode': userMode ?? 'Expert',
        'language': 'zh-TW',
        'currency': 'TWD',
        'timezone': 'Asia/Taipei',
      };

      print('[7582] 📋 註冊資料: ${registrationData.keys.join(', ')}');

      // 發送HTTP POST請求到ASL層
      final response = await http.post(
        Uri.parse('$aslBaseUrl/api/v1/auth/register'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(registrationData),
      );

      print('[7582] 🔄 HTTP回應狀態: ${response.statusCode}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final responseData = jsonDecode(response.body) as Map<String, dynamic>;
        // print('[7582] ✅ 註冊API調用成功'); // 這裡的日誌會被覆蓋，保留下面的
        print('[7582] 📊 回應格式: success=${responseData['success']}');

        return responseData;
      } else {
        print('[7582] ❌ 註冊API調用失敗: ${response.statusCode}');
        print('[7582] 📄 錯誤內容: ${response.body}');

        return {
          'success': false,
          'message': 'HTTP錯誤: ${response.statusCode}',
          'errorCode': 'HTTP_ERROR',
        };
      }

    } catch (e) {
      print('[7582] ❌ 註冊API調用異常: $e');
      return {
        'success': false,
        'message': '網路異常: $e',
        'errorCode': 'NETWORK_ERROR',
      };
    }
  }

  /// 驗證Firebase中的帳本建立（檢查1309 AM模組是否為P3測試成功建立帳本）
  Future<bool> _verifyFirebaseLedgerCreation(Map<String, dynamic> registrationResult) async {
    try {
      print('[7582] 🔍 驗證SIT P3用戶Firebase帳本建立狀態...');

      // 從註冊結果取得用戶資料
      final userData = registrationResult['data'];
      if (userData == null) {
        print('[7582] ❌ 註冊結果中無用戶資料');
        print('[7582] 📋 完整註冊結果: ${registrationResult.toString()}');
        return false;
      }

      print('[7582] 📋 用戶資料內容: ${userData.toString()}');

      // 檢查初始化完成標誌
      final initializationComplete = userData['initializationComplete'] ?? false;
      print('[7582] 🔍 初始化完成標誌: $initializationComplete');

      if (initializationComplete) {
        print('[7582] ✅ 1309模組帳本初始化完成標誌確認');

        // 檢查帳本資訊
        final ledgerInfo = userData['ledgerInfo'];
        if (ledgerInfo != null) {
          print('[7582] 📋 帳本資訊: $ledgerInfo');
          final ledgerId = ledgerInfo['ledgerId'];
          final subjectCount = ledgerInfo['subjectCount'];
          final accountCount = ledgerInfo['accountCount'];
          
          print('[7582] 📋 帳本ID: $ledgerId');
          print('[7582] 📋 科目數量: $subjectCount');
          print('[7582] 📋 帳戶數量: $accountCount');

          if (ledgerId != null && subjectCount != null && accountCount != null) {
            print('[7582] ✅ SIT P3帳本結構資訊完整');
            print('[7582] ✅ sit_p3@sit.com註冊完成，AM模組已成功建立Firebase帳本');
            print('[7582] 🎯 P3測試帳本準備就緒，可進行帳戶與科目管理測試');
            return true;
          } else {
            print('[7582] ❌ 帳本資訊不完整');
            return false;
          }
        } else {
          print('[7582] ❌ 缺少帳本資訊');
          return false;
        }
      } else {
        print('[7582] ❌ 1309模組帳本初始化未完成');
        
        // 檢查是否有初始化錯誤資訊
        final initError = userData['initializationError'];
        if (initError != null) {
          print('[7582] 📋 初始化錯誤: $initError');
        }
        
        return false;
      }

    } catch (e) {
      print('[7582] ❌ 帳本驗證錯誤: $e');
      return false;
    }
  }

  

  /// 記錄測試結果
  void _recordTestResult(String testName, bool passed, String message) {
    totalTests++;
    if (passed) {
      passedTests++;
      testResults.add('✅ $testName: $message');
    } else {
      failedTests++;
      testResults.add('❌ $testName: $message');
    }
  }

  /// 輸出測試結果統計
  void _printTestSummary() {
    print('\n' + '='*60);
    print('📊 [7582] 真實註冊測試結果統計');
    print('='*60);
    print('總測試數: $totalTests');
    print('通過: $passedTests');
    print('失敗: $failedTests');
    print('成功率: ${totalTests > 0 ? (passedTests / totalTests * 100).toStringAsFixed(1) : 0}%');
    print('\n📋 詳細結果:');

    for (final result in testResults) {
      print(result);
    }

    print('='*60);

    if (failedTests == 0) {
      print('🎉 真實註冊測試通過！1309模組成功在Firebase建立帳本。');
      print('✨ 驗證項目：');
      print('   ✅ 7598測試資料載入');
      print('   ✅ ASL層API調用');
      print('   ✅ AM模組用戶註冊');
      print('   ✅ 1309模組帳本初始化');
      print('   ✅ Firebase帳本結構建立');
    } else {
      print('⚠️  發現 $failedTests 個問題，請檢查：');
      print('   - ASL層服務是否正常運行 (Port 5000)');
      print('   - 1309 AM模組帳本初始化功能');
      print('   - Firebase連線和權限設定');
    }
  }

  /// 清理測試環境
  void cleanup() {
    totalTests = 0;
    passedTests = 0;
    failedTests = 0;
    testResults.clear();
    print('[7582] 🧹 測試環境清理完成');
  }
}

/// 主執行函數
Future<void> main() async {
  final registerTest = RegisterUserTest();

  try {
    print('🔧 [7582] 註冊使用者測試模組 v1.1.0 - SIT P3階段二');
    print('📋 目的: 使用sit_p3@sit.com進行真實註冊，為P3帳戶與科目管理測試準備帳本');
    print('⚖️  遵守0098憲法: 禁止hard coding、模擬業務邏輯，遵守dataflow');
    print('🌐 ASL服務端點: http://localhost:5000');
    print('🔄 資料流向: PL(7582) → APL → ASL → BL(1309 AM) → Firebase');
    print('🎯 P3測試準備: 為7572 SIT_P3建立測試用戶帳本');

    await registerTest.runUserRegistrationTests();

  } catch (e) {
    print('\n💥 [7582] 測試執行失敗: $e');
    exit(1);
  } finally {
    registerTest.cleanup();
  }

  print('\n✨ [7582] SIT P3用戶真實註冊測試完成');
  print('🎯 如果測試成功，sit_p3@sit.com帳本已就緒，7572 SIT_P3可開始執行！');
}