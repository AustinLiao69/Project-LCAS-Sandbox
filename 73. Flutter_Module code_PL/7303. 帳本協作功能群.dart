/**
 * 7571_帳本協作功能群_測試腳本
 * @module 帳本協作功能群測試
 * @description LCAS 2.0 帳本協作功能群 - Phase 2 帳本管理與協作記帳業務邏輯測試腳本
 * @version 2.9.0 - 階段一修正：移除Mock業務邏輯，符合0098憲法
 * @update 2025-11-12: 階段一修正 - 清理所有Mock類別，純粹調用PL層函數
 */

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../APL.dart';
import '../7303_LedgerCollaborationManager.dart'; // 引入PL層的帳本協作管理器
import '../ASL.dart'; // 引入ASL層

/// 測試腳本主類別
class LedgerCollaborationTests {
  static const String testVersion = '2.9.0';
  static const String testDate = '2025-11-12';

  // 動態協作帳本ID，用於測試階段一的ID回流機制
  static String? _dynamicCollaborationId;
  // 全局測試日誌
  static final List<String> _testLogs = [];
  // 執行步驟記錄
  static Map<String, dynamic> executionSteps = {};
  // PL層函數的結果
  static dynamic plResult;

  //============================================================================
  // 階段一：修復協作帳本ID回流機制 (TC-009)
  //============================================================================

  /**
   * TC-009: 創建協作帳本並驗證ID回流
   * @version 2025-11-12-V2.0.0 - 階段一修正版
   * @date 2025-11-12
   * @description 階段一核心測試：純粹調用PL層函數創建協作帳本
   */
  static Future<void> testCreateCollaborativeLedger() async {
    print('\n[7571] 🚀 TC-009: 開始測試創建協作帳本與ID回流');
    executionSteps.clear();
    plResult = null;
    _dynamicCollaborationId = null;

    try {
      // 1. 從7598讀取測試資料
      final testData = await _loadTestDataFromWarehouse();
      if (testData == null || testData['collaborativeLedger'] == null) {
        throw Exception('無法從7598 Data warehouse載入協作帳本測試資料');
      }

      final ledgerData = testData['collaborativeLedger'];
      print('[7571] 📝 TC-009: 從7598載入協作帳本資料: ${ledgerData['name']}');
      executionSteps['load_test_data'] = '成功從7598載入測試資料';

      // 2. 純粹調用 PL 層的帳本創建函數
      print('[7571] 📞 TC-009: 調用 LedgerCollaborationManager.createLedger');
      executionSteps['call_pl_function'] = '調用PL層createLedger函數';

      final createdLedger = await LedgerCollaborationManager.createLedger(ledgerData);

      // 3. 驗證創建結果
      if (createdLedger != null && createdLedger.id.isNotEmpty) {
        print('[7571] ✅ TC-009: 協作帳本創建成功，ID: ${createdLedger.id}');
        _dynamicCollaborationId = createdLedger.id;

        executionSteps['ledger_created'] = '帳本創建成功';
        executionSteps['id_captured'] = '協作帳本ID已回流';
        plResult = {'success': true, 'ledgerId': createdLedger.id};
      } else {
        print('[7571] ❌ TC-009: 協作帳本創建失敗');
        executionSteps['creation_failed'] = '帳本創建返回null或空ID';
        plResult = {'success': false, 'error': '帳本創建失敗'};
      }
    } catch (e, stackTrace) {
      print('[7571] ❌ TC-009 執行異常: $e');
      executionSteps['exception'] = 'TC-009執行異常: $e';
      plResult = {'success': false, 'error': 'TC-009異常: $e'};
    } finally {
      print('[7571] 🏁 TC-009 測試結束');
      print('[7571] 🔍 當前協作帳本ID: $_dynamicCollaborationId');
    }
  }

  //============================================================================
  // 階段二：協作API端點測試 (TC-010 ~ TC-020)
  //============================================================================

  /**
   * TC-010: 查詢帳本列表
   * @version 2025-11-12-V2.0.0 - 階段一修正版
   */
  static Future<void> testQueryLedgerListWithCollaborativeId() async {
    print('\n[7571] 🚀 TC-010: 開始測試查詢帳本列表');
    executionSteps.clear();
    plResult = null;

    try {
      if (_dynamicCollaborationId != null && _dynamicCollaborationId!.isNotEmpty) {
        final inputData = {'ledgerId': _dynamicCollaborationId, 'type': 'shared'};
        executionSteps['input_prepared'] = '使用有效的協作帳本ID';

        // 純粹調用PL層函數
        plResult = await LedgerCollaborationManager.processLedgerList(inputData);
        executionSteps['pl_function_called'] = '成功調用PL層processLedgerList';
        print('[7571] ✅ TC-010: PL層函數調用完成');
      } else {
        plResult = {'success': false, 'error': '協作帳本ID無效，請先執行TC-009'};
        executionSteps['validation_failed'] = '協作帳本ID驗證失敗';
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-010異常: $e'};
      executionSteps['exception'] = 'TC-010執行異常';
    } finally {
      print('[7571] 🏁 TC-010 測試結束');
    }
  }

  /**
   * TC-011: 更新帳本資訊
   * @version 2025-11-12-V2.0.0 - 階段一修正版
   */
  static Future<void> testUpdateLedgerWithCollaborativeId() async {
    print('\n[7571] 🚀 TC-011: 開始測試更新帳本資訊');
    executionSteps.clear();
    plResult = null;

    try {
      if (_dynamicCollaborationId != null && _dynamicCollaborationId!.isNotEmpty) {
        final inputData = {
          'name': '協作帳本_更新_${DateTime.now().millisecondsSinceEpoch}',
          'description': 'TC-011更新測試',
        };
        executionSteps['input_prepared'] = '準備更新資料';

        // 純粹調用PL層函數
        await LedgerCollaborationManager.updateLedger(_dynamicCollaborationId!, inputData);
        plResult = {'success': true, 'ledgerId': _dynamicCollaborationId};
        executionSteps['pl_function_called'] = '成功調用PL層updateLedger';
        print('[7571] ✅ TC-011: PL層函數調用完成');
      } else {
        plResult = {'success': false, 'error': '協作帳本ID無效'};
        executionSteps['validation_failed'] = '協作帳本ID驗證失敗';
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-011異常: $e'};
      executionSteps['exception'] = 'TC-011執行異常';
    } finally {
      print('[7571] 🏁 TC-011 測試結束');
    }
  }

  /**
   * TC-012: 刪除帳本
   * @version 2025-11-12-V2.0.0 - 階段一修正版
   */
  static Future<void> testDeleteLedgerWithCollaborativeId() async {
    print('\n[7571] 🚀 TC-012: 開始測試刪除帳本');
    executionSteps.clear();
    plResult = null;

    try {
      if (_dynamicCollaborationId != null && _dynamicCollaborationId!.isNotEmpty) {
        // 純粹調用PL層函數
        await LedgerCollaborationManager.processLedgerDeletion(_dynamicCollaborationId!);
        plResult = {'success': true, 'ledgerId': _dynamicCollaborationId};
        executionSteps['pl_function_called'] = '成功調用PL層processLedgerDeletion';
        print('[7571] ✅ TC-012: PL層函數調用完成');
      } else {
        plResult = {'success': false, 'error': '協作帳本ID無效'};
        executionSteps['validation_failed'] = '協作帳本ID驗證失敗';
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-012異常: $e'};
      executionSteps['exception'] = 'TC-012執行異常';
    } finally {
      print('[7571] 🏁 TC-012 測試結束');
    }
  }

  /**
   * TC-013至TC-020: 其他協作功能測試
   * @version 2025-11-12-V2.0.0 - 階段一修正版
   * @description 純粹調用PL層函數，不包含任何業務邏輯
   */

  static Future<void> testInviteCollaborators() async {
    print('\n[7571] 🚀 TC-013: 測試邀請協作者');
    try {
      if (_dynamicCollaborationId != null) {
        final testData = await _loadTestDataFromWarehouse();
        final invitations = testData?['invitations'] ?? [];

        plResult = await LedgerCollaborationManager.inviteCollaborators(
          _dynamicCollaborationId!,
          invitations,
          sendNotification: false,
        );
        print('[7571] ✅ TC-013: PL層函數調用完成');
      } else {
         plResult = {'success': false, 'error': '協作帳本ID無效'};
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-013異常: $e'};
    }
  }

  static Future<void> testUpdateCollaboratorPermissions() async {
    print('\n[7571] 🚀 TC-014: 測試更新協作者權限');
    try {
      if (_dynamicCollaborationId != null) {
        final testData = await _loadTestDataFromWarehouse();
        final permissionData = testData?['permissionUpdate'];

        await LedgerCollaborationManager.updateCollaboratorPermissions(
          _dynamicCollaborationId!,
          'test_user_id',
          permissionData,
          auditLog: false,
        );
        plResult = {'success': true};
        print('[7571] ✅ TC-014: PL層函數調用完成');
      } else {
        plResult = {'success': false, 'error': '協作帳本ID無效'};
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-014異常: $e'};
    }
  }

  static Future<void> testRemoveCollaborator() async {
    print('\n[7571] 🚀 TC-015: 測試移除協作者');
    try {
      if (_dynamicCollaborationId != null) {
        await LedgerCollaborationManager.removeCollaborator(
          _dynamicCollaborationId!,
          'test_user_id',
          cleanupData: false,
        );
        plResult = {'success': true};
        print('[7571] ✅ TC-015: PL層函數調用完成');
      } else {
        plResult = {'success': false, 'error': '協作帳本ID無效'};
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-015異常: $e'};
    }
  }

  static Future<void> testCalculateUserPermissions() async {
    print('\n[7571] 🚀 TC-016: 測試計算用戶權限');
    try {
      if (_dynamicCollaborationId != null) {
        final permissions = await LedgerCollaborationManager.calculateUserPermissions(
          'test_user_id',
          _dynamicCollaborationId!,
        );
        plResult = {'success': true, 'permissions': permissions.toJson()};
        print('[7571] ✅ TC-016: PL層函數調用完成');
      } else {
        plResult = {'success': false, 'error': '協作帳本ID無效'};
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-016異常: $e'};
    }
  }

  static Future<void> testHasPermission() async {
    print('\n[7571] 🚀 TC-017: 測試檢查權限');
    try {
      final canRead = LedgerCollaborationManager.hasPermission(
        'test_user_id',
        'test_ledger_id',
        'read',
      );
      plResult = {'canRead': canRead, 'success': true};
      print('[7571] ✅ TC-017: PL層函數調用完成');
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-017異常: $e'};
    }
  }

  static Future<void> testUpdateUserRole() async {
    print('\n[7571] 🚀 TC-018: 測試更新用戶角色');
    try {
      if (_dynamicCollaborationId != null) {
        await LedgerCollaborationManager.updateUserRole(
          'test_user_id',
          _dynamicCollaborationId!,
          'editor',
          'admin_user_id',
        );
        plResult = {'success': true};
        print('[7571] ✅ TC-018: PL層函數調用完成');
      } else {
        plResult = {'success': false, 'error': '協作帳本ID無效'};
      }
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-018異常: $e'};
    }
  }

  static Future<void> testValidatePermissionChange() async {
    print('\n[7571] 🚀 TC-019: 測試權限變更驗證');
    try {
      final validation = LedgerCollaborationManager.validatePermissionChange(
        'admin_user_id',
        'test_user_id',
        'admin',
        'test_ledger_id',
      );
      plResult = {'validation': validation.toJson(), 'success': true};
      print('[7571] ✅ TC-019: PL層函數調用完成');
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-019異常: $e'};
    }
  }

  static Future<void> testCallAPI() async {
    print('\n[7571] 🚀 TC-020: 測試API調用');
    try {
      final testData = await _loadTestDataFromWarehouse();
      final apiTestData = testData?['apiTest'] ?? {};

      final response = await LedgerCollaborationManager.callAPI(
        'POST',
        '/api/v1/ledgers',
        data: apiTestData,
      );
      plResult = {'response': response, 'success': true};
      print('[7571] ✅ TC-020: PL層函數調用完成');
    } catch (e) {
      plResult = {'success': false, 'error': 'TC-020異常: $e'};
    }
  }

  //============================================================================
  // 階段三：狀態管理重構與參數驗證 (TC-021 onwards)
  //============================================================================

  /**
   * TC-021: 驗證7571能否獲取最近的協作帳本ID
   * @version 2025-11-12-V3.0.0 - 階段三測試
   * @description 驗證7571在移除本地狀態管理後，是否能通過PL層獲取協作帳本ID
   */
  static Future<void> testGetRecentCollaborationId() async {
    print('\n[7571] 🚀 TC-021: 開始測試獲取最近協作帳本ID (階段三重構)');
    executionSteps.clear();
    plResult = null;

    try {
      // 調用PL層新增的函數
      final ledgerData = await LedgerCollaborationManager.getRecentCollaborationId();

      if (ledgerData != null && ledgerData.id.isNotEmpty) {
        print('[7571] ✅ TC-021: 成功獲取最近協作帳本ID: ${ledgerData.id}');
        _dynamicCollaborationId = ledgerData.id; // 為了後續測試，仍然儲存下來
        executionSteps['id_retrieved'] = '成功透過PL層獲取最近協作帳本ID';
        plResult = {'success': true, 'ledgerId': ledgerData.id};
      } else {
        print('[7571] ❌ TC-021: 未能獲取最近協作帳本ID');
        executionSteps['id_retrieval_failed'] = '透過PL層獲取最近協作帳本ID失敗';
        plResult = {'success': false, 'error': '未獲取到最近協作帳本ID'};
      }
    } catch (e) {
      print('[7571] ❌ TC-021 執行異常: $e');
      executionSteps['exception'] = 'TC-021執行異常: $e';
      plResult = {'success': false, 'error': 'TC-021異常: $e'};
    } finally {
      print('[7571] 🏁 TC-021 測試結束');
    }
  }


  //============================================================================
  // 輔助函數
  //============================================================================

  /**
   * 從7598 Data warehouse載入測試資料
   * @description 符合0098憲法第11條，測試資料統一從7598讀取
   */
  static Future<Map<String, dynamic>?> _loadTestDataFromWarehouse() async {
    try {
      final file = File('75. Flutter_Test_code_PL/7598. Data warehouse.json');
      if (!await file.exists()) {
        print('[7571] ⚠️ 7598 Data warehouse.json 不存在');
        return null;
      }

      final content = await file.readAsString();
      final data = jsonDecode(content);
      return data['ledgerCollaboration'];
    } catch (e) {
      print('[7571] ❌ 載入7598測試資料失敗: $e');
      return null;
    }
  }

  /**
   * 執行所有測試案例
   */
  static Future<void> runAllTests() async {
    print('===============================================');
    print('=== 7571 帳本協作功能群測試腳本 v$testVersion ===');
    print('===============================================');
    print('階段一修正版：純業務邏輯測試，符合0098憲法');

    _testLogs.clear();
    executionSteps.clear();
    plResult = null;
    _dynamicCollaborationId = null;

    try {
      // 執行所有測試
      await testCreateCollaborativeLedger(); // TC-009
      _testLogs.add('TC-009: ${plResult?['success'] == true ? "成功" : "失敗"}');

      // 根據階段三的重構，優先執行TC-021獲取最近ID
      await testGetRecentCollaborationId(); // TC-021

      // 僅當成功獲取到ID後，才執行後續依賴ID的測試
      if (_dynamicCollaborationId != null && _dynamicCollaborationId!.isNotEmpty) {
        await testQueryLedgerListWithCollaborativeId(); // TC-010
        await testUpdateLedgerWithCollaborativeId(); // TC-011
        await testDeleteLedgerWithCollaborativeId(); // TC-012
        await testInviteCollaborators(); // TC-013
        await testUpdateCollaboratorPermissions(); // TC-014
        await testRemoveCollaborator(); // TC-015
        await testCalculateUserPermissions(); // TC-016
        await testHasPermission(); // TC-017
        await testUpdateUserRole(); // TC-018
        await testValidatePermissionChange(); // TC-019
        await testCallAPI(); // TC-020

        _testLogs.add('TC-010至TC-020: 依序執行完成');
      } else {
        _testLogs.add('跳過TC-010至TC-020: 無效的協作帳本ID');
      }

    } catch (e) {
      _testLogs.add('測試執行過程發生異常: $e');
    } finally {
      print('\n===============================================');
      print('=== 測試執行完畢 ===');
      print('===============================================');
      _testLogs.forEach(print);
    }
  }
}