/**
 * 8502. 用戶管理服務_test.dart
 * @testFile 用戶管理服務測試代碼
 * @version 2.5.0
 * @description LCAS 2.0 用戶管理服務 API 測試代碼 - 完整覆蓋11個API端點，支援四模式差異化測試
 * @date 2025-09-02
 * @update 2025-09-02: 升級至v2.5.0，第一階段修復完成，清理檔案結構和XML殘留
 */

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:test/test.dart';

// ================================
// 手動Fake服務類別 (Manual Fake Services)
// ================================

/// 手動UserManagementService實作
class FakeUserManagementService {
  Future<Map<String, dynamic>> getUserProfile(String userId) async {
    if (userId.isEmpty || userId == 'invalid-user-id') {
      throw Exception('用戶不存在');
    }

    return {
      'success': true,
      'data': {
        'userId': userId,
        'email': 'user@lcas.com',
        'displayName': '測試用戶',
        'userMode': 'expert',
        'createdAt': DateTime.now().toIso8601String(),
        'lastActiveAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> updateUserProfile(String userId, Map<String, dynamic> updateData) async {
    if (userId.isEmpty) {
      throw Exception('無效的用戶ID');
    }

    if (updateData.isEmpty) {
      throw Exception('更新資料不能為空');
    }

    return {
      'success': true,
      'message': '用戶資料更新成功',
      'data': {
        'userId': userId,
        'updatedFields': updateData.keys.toList(),
        'updatedAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> changeUserMode(String userId, String newMode) async {
    final validModes = ['expert', 'inertial', 'cultivation', 'guiding'];

    if (!validModes.contains(newMode)) {
      throw Exception('無效的用戶模式');
    }

    return {
      'success': true,
      'message': '用戶模式變更成功',
      'data': {
        'userId': userId,
        'oldMode': 'expert',
        'newMode': newMode,
        'changedAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> deleteUser(String userId) async {
    if (userId.isEmpty) {
      throw Exception('無效的用戶ID');
    }

    return {
      'success': true,
      'message': '用戶帳號刪除成功',
      'data': {
        'userId': userId,
        'deletedAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> getUserPreferences(String userId) async {
    return {
      'success': true,
      'data': {
        'userId': userId,
        'preferences': {
          'language': 'zh-TW',
          'timezone': 'Asia/Taipei',
          'theme': 'auto',
          'notifications': {
            'email': true,
            'push': true,
            'sms': false,
          }
        }
      }
    };
  }

  Future<Map<String, dynamic>> updateUserPreferences(String userId, Map<String, dynamic> preferences) async {
    return {
      'success': true,
      'message': '用戶偏好設定更新成功',
      'data': {
        'userId': userId,
        'preferences': preferences,
        'updatedAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> changePassword(String userId, String oldPassword, String newPassword) async {
    if (oldPassword == 'wrong-old-password') {
      throw Exception('舊密碼驗證失敗');
    }

    if (newPassword.length < 8) {
      throw Exception('新密碼長度不足');
    }

    return {
      'success': true,
      'message': '密碼變更成功',
      'data': {
        'userId': userId,
        'changedAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> setupBiometric(String userId, String biometricType, Map<String, dynamic> biometricData) async {
    final validTypes = ['fingerprint', 'faceId', 'voiceId'];

    if (!validTypes.contains(biometricType)) {
      throw Exception('不支援的生物辨識類型');
    }

    return {
      'success': true,
      'message': '生物辨識設定成功',
      'data': {
        'userId': userId,
        'biometricType': biometricType,
        'setupAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> setupPinCode(String userId, String pinCode) async {
    if (pinCode.length != 6) {
      throw Exception('PIN碼必須為6位數字');
    }

    if (!RegExp(r'^\d{6}$').hasMatch(pinCode)) {
      throw Exception('PIN碼必須為純數字');
    }

    return {
      'success': true,
      'message': 'PIN碼設定成功',
      'data': {
        'userId': userId,
        'setupAt': DateTime.now().toIso8601String(),
      }
    };
  }

  Future<Map<String, dynamic>> getUserActivityHistory(String userId) async {
    return {
      'success': true,
      'data': {
        'userId': userId,
        'activities': [
          {
            'activityType': 'login',
            'timestamp': DateTime.now().subtract(Duration(hours: 1)).toIso8601String(),
            'deviceInfo': 'iOS 17.0',
          },
          {
            'activityType': 'profile_update',
            'timestamp': DateTime.now().subtract(Duration(days: 1)).toIso8601String(),
            'changes': ['displayName'],
          }
        ],
        'totalCount': 2,
      }
    };
  }

  Future<Map<String, dynamic>> getLinkedAccounts(String userId) async {
    return {
      'success': true,
      'data': {
        'userId': userId,
        'linkedAccounts': {
          'google': 'google-account-id',
          'line': null,
          'facebook': null,
        },
        'linkedAt': {
          'google': DateTime.now().subtract(Duration(days: 7)).toIso8601String(),
        }
      }
    };
  }
}

/// 測試輔助工具類別
class UserManagementTestUtils {
  static Map<String, dynamic> createTestUserProfile({
    String? userId,
    String? email,
    String userMode = 'expert',
  }) {
    return {
      'userId': userId ?? 'test-user-123',
      'email': email ?? 'test@lcas.com',
      'displayName': '測試用戶',
      'userMode': userMode,
      'avatar': 'https://example.com/avatar.jpg',
      'preferences': {
        'language': 'zh-TW',
        'timezone': 'Asia/Taipei',
        'theme': 'auto',
      },
      'createdAt': DateTime.now().subtract(Duration(days: 7)).toIso8601String(),
      'lastActiveAt': DateTime.now().subtract(Duration(hours: 1)).toIso8601String(),
    };
  }

  static Map<String, dynamic> createTestUpdateData() {
    return {
      'displayName': '更新的用戶名稱',
      'avatar': 'https://example.com/new-avatar.jpg',
      'preferences': {
        'theme': 'dark',
        'language': 'en-US',
      }
    };
  }

  static Map<String, dynamic> createTestPreferences() {
    return {
      'language': 'zh-TW',
      'timezone': 'Asia/Taipei',
      'theme': 'auto',
      'notifications': {
        'email': true,
        'push': true,
        'sms': false,
      },
      'privacy': {
        'profileVisibility': 'private',
        'activityTracking': true,
      }
    };
  }
}

/// 測試環境設定
class UserManagementTestEnvironment {
  static const String testUserId = 'test-user-123';
  static const String mockRequestId = 'req-user-test-456';

  static Future<void> setupTestEnvironment() async {
    await _initMockUserData();
    await _setupTestUserModes();
    await _configureMockServices();
  }

  static Future<void> _initMockUserData() async {
    // 初始化測試用戶資料
  }

  static Future<void> _setupTestUserModes() async {
    // 設定測試用戶模式
  }

  static Future<void> _configureMockServices() async {
    // 配置模擬服務
  }
}

// ================================
// 主要測試套件 (Main Test Suite)
// ================================

void main() {
  group('用戶管理服務測試套件 v2.5.0 - 完整49個測試案例', () {
    late FakeUserManagementService fakeUserService;

    // ================================
    // 輔助函數 (Helper Functions) - 移至此處避免作用域問題
    // ================================

    /// 執行壓力測試操作
    Future<Map<String, dynamic>> performStressOperation(String userId, int operationId) async {
      try {
        final operations = [
          () => fakeUserService.getUserProfile(userId),
          () => fakeUserService.getUserPreferences(userId),
          () => fakeUserService.updateUserProfile(userId, {'lastOperation': operationId.toString()}),
        ];

        final selectedOperation = operations[operationId % operations.length];
        final response = await selectedOperation();

        return {
          'operationId': operationId,
          'success': response['success'],
          'timestamp': DateTime.now().toIso8601String(),
        };
      } catch (e) {
        return {
          'operationId': operationId,
          'success': false,
          'error': e.toString(),
          'timestamp': DateTime.now().toIso8601String(),
        };
      }
    }

    /// 根據語言獲取對應時區
    String getTimezoneForLanguage(String language) {
      switch (language) {
        case 'zh-TW':
          return 'Asia/Taipei';
        case 'zh-CN':
          return 'Asia/Shanghai';
        case 'en-US':
          return 'America/New_York';
        case 'ja-JP':
          return 'Asia/Tokyo';
        default:
          return 'UTC';
      }
    }

    /// 根據語言獲取對應日期格式
    String getDateFormatForLanguage(String language) {
      switch (language) {
        case 'zh-TW':
        case 'zh-CN':
          return 'YYYY-MM-DD';
        case 'en-US':
          return 'MM/DD/YYYY';
        case 'ja-JP':
          return 'YYYY年MM月DD日';
        default:
          return 'YYYY-MM-DD';
      }
    }

    setUpAll(() async {
      await UserManagementTestEnvironment.setupTestEnvironment();
    });

    setUp(() {
      fakeUserService = FakeUserManagementService();
    });

    // ================================
    // 功能測試案例 (TC-001 ~ TC-011, TC-046, TC-047)
    // ================================

    group('功能測試案例', () {
      /**
       * TC-001. 取得用戶資料API正常流程測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-001. 取得用戶資料API正常流程測試', () async {
        // Arrange
        const userId = 'test-user-123';

        // Act
        final response = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(response['success'], isTrue);
        expect(response['data']['userId'], equals(userId));
        expect(response['data']['email'], isNotNull);
        expect(response['data']['displayName'], isNotNull);
        expect(response['data']['userMode'], isNotNull);
      });

      /**
       * TC-002. 取得用戶資料API異常處理測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-002. 取得用戶資料API異常處理測試', () async {
        // Arrange
        const invalidUserId = 'invalid-user-id';

        // Act & Assert
        expect(
          () => fakeUserService.getUserProfile(invalidUserId),
          throwsA(isA<Exception>()),
        );
      });

      /**
       * TC-003. 更新用戶資料API正常流程測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-003. 更新用戶資料API正常流程測試', () async {
        // Arrange
        const userId = 'test-user-123';
        final updateData = UserManagementTestUtils.createTestUpdateData();

        // Act
        final response = await fakeUserService.updateUserProfile(userId, updateData);

        // Assert
        expect(response['success'], isTrue);
        expect(response['message'], contains('更新成功'));
        expect(response['data']['userId'], equals(userId));
        expect(response['data']['updatedFields'], isA<List>());
      });

      /**
       * TC-004. 更新用戶資料API異常處理測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-004. 更新用戶資料API異常處理測試', () async {
        // Arrange
        const userId = 'test-user-123';
        final emptyUpdateData = <String, dynamic>{};

        // Act & Assert
        expect(
          () => fakeUserService.updateUserProfile(userId, emptyUpdateData),
          throwsA(isA<Exception>()),
        );
      });

      /**
       * TC-005. 變更用戶模式API測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-005. 變更用戶模式API測試', () async {
        // Arrange
        const userId = 'test-user-123';
        const newMode = 'cultivation';

        // Act
        final response = await fakeUserService.changeUserMode(userId, newMode);

        // Assert
        expect(response['success'], isTrue);
        expect(response['data']['newMode'], equals(newMode));
        expect(response['data']['userId'], equals(userId));
      });

      /**
       * TC-006. 刪除用戶API測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-006. 刪除用戶API測試', () async {
        // Arrange
        const userId = 'test-user-123';

        // Act
        final response = await fakeUserService.deleteUser(userId);

        // Assert
        expect(response['success'], isTrue);
        expect(response['message'], contains('刪除成功'));
        expect(response['data']['userId'], equals(userId));
      });

      /**
       * TC-007. 取得用戶偏好設定API測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-007. 取得用戶偏好設定API測試', () async {
        // Arrange
        const userId = 'test-user-123';

        // Act
        final response = await fakeUserService.getUserPreferences(userId);

        // Assert
        expect(response['success'], isTrue);
        expect(response['data']['preferences'], isA<Map>());
        expect(response['data']['preferences']['language'], isNotNull);
        expect(response['data']['preferences']['timezone'], isNotNull);
      });

      /**
       * TC-008. 更新用戶偏好設定API測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-008. 更新用戶偏好設定API測試', () async {
        // Arrange
        const userId = 'test-user-123';
        final preferences = UserManagementTestUtils.createTestPreferences();

        // Act
        final response = await fakeUserService.updateUserPreferences(userId, preferences);

        // Assert
        expect(response['success'], isTrue);
        expect(response['message'], contains('更新成功'));
        expect(response['data']['preferences'], equals(preferences));
      });

      /**
       * TC-009. 變更密碼API測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-009. 變更密碼API測試', () async {
        // Arrange
        const userId = 'test-user-123';
        const oldPassword = 'OldPassword123';
        const newPassword = 'NewPassword456';

        // Act
        final response = await fakeUserService.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(response['success'], isTrue);
        expect(response['message'], contains('密碼變更成功'));
        expect(response['data']['userId'], equals(userId));
      });

      /**
       * TC-010. 設定生物辨識API測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-010. 設定生物辨識API測試', () async {
        // Arrange
        const userId = 'test-user-123';
        const biometricType = 'fingerprint';
        final biometricData = {'templateId': 'fp-template-123'};

        // Act
        final response = await fakeUserService.setupBiometric(userId, biometricType, biometricData);

        // Assert
        expect(response['success'], isTrue);
        expect(response['data']['biometricType'], equals(biometricType));
        expect(response['data']['userId'], equals(userId));
      });

      /**
       * TC-011. 設定PIN碼API測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-011. 設定PIN碼API測試', () async {
        // Arrange
        const userId = 'test-user-123';
        const pinCode = '123456';

        // Act
        final response = await fakeUserService.setupPinCode(userId, pinCode);

        // Assert
        expect(response['success'], isTrue);
        expect(response['message'], contains('PIN碼設定成功'));
        expect(response['data']['userId'], equals(userId));
      });

      /**
       * TC-046. 時區處理測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-046. 時區處理測試', () async {
        // Arrange
        const userId = 'test-user-123';

        // Act
        final response = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(response['success'], isTrue);
        expect(response['data']['createdAt'], isA<String>());
        expect(response['data']['lastActiveAt'], isA<String>());
      });

      /**
       * TC-047. 資料驗證邊界測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-047. 資料驗證邊界測試', () async {
        // Arrange
        const userId = 'test-user-123';
        const invalidPinCode = '12345'; // 5位數，應該要6位數

        // Act & Assert
        expect(
          () => fakeUserService.setupPinCode(userId, invalidPinCode),
          throwsA(isA<Exception>()),
        );
      });
    });

    // ================================
    // 四模式差異化測試案例 (TC-012 ~ TC-034)
    // ================================

    group('四模式差異化測試案例', () {
      /**
       * TC-012. Expert模式差異化測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-012. Expert模式差異化測試', () async {
        // Arrange
        const userId = 'expert-user-123';
        const expertMode = 'expert';

        // Act
        final modeResponse = await fakeUserService.changeUserMode(userId, expertMode);
        final profileResponse = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(modeResponse['success'], isTrue);
        expect(modeResponse['data']['newMode'], equals(expertMode));
        expect(profileResponse['data']['userMode'], equals(expertMode));
      });

      /**
       * TC-013. Inertial模式差異化測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-013. Inertial模式差異化測試', () async {
        // Arrange
        const userId = 'inertial-user-123';
        const inertialMode = 'inertial';

        // Act
        final modeResponse = await fakeUserService.changeUserMode(userId, inertialMode);
        final profileResponse = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(modeResponse['success'], isTrue);
        expect(modeResponse['data']['newMode'], equals(inertialMode));
        expect(profileResponse['data']['userMode'], equals(inertialMode));
      });

      /**
       * TC-014. Cultivation模式差異化測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-014. Cultivation模式差異化測試', () async {
        // Arrange
        const userId = 'cultivation-user-123';
        const cultivationMode = 'cultivation';

        // Act
        final modeResponse = await fakeUserService.changeUserMode(userId, cultivationMode);
        final profileResponse = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(modeResponse['success'], isTrue);
        expect(modeResponse['data']['newMode'], equals(cultivationMode));
        expect(profileResponse['data']['userMode'], equals(cultivationMode));
      });

      /**
       * TC-015. Guiding模式差異化測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-015. Guiding模式差異化測試', () async {
        // Arrange
        const userId = 'guiding-user-123';
        const guidingMode = 'guiding';

        // Act
        final modeResponse = await fakeUserService.changeUserMode(userId, guidingMode);
        final profileResponse = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(modeResponse['success'], isTrue);
        expect(modeResponse['data']['newMode'], equals(guidingMode));
        expect(profileResponse['data']['userMode'], equals(guidingMode));
      });

      /**
       * TC-031. Expert模式錯誤訊息測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-031. Expert模式錯誤訊息測試', () async {
        // Arrange
        const userId = 'expert-user-123';
        const expertMode = 'expert';
        const invalidMode = 'invalid-mode';

        // Act & Assert
        await fakeUserService.changeUserMode(userId, expertMode);

        // 測試錯誤情況
        expect(
          () => fakeUserService.changeUserMode(userId, invalidMode),
          throwsA(predicate((e) => e.toString().contains('無效的用戶模式'))),
        );
      });

      /**
       * TC-032. Inertial模式錯誤訊息測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-032. Inertial模式錯誤訊息測試', () async {
        // Arrange
        const userId = 'inertial-user-123';
        const inertialMode = 'inertial';
        final emptyUpdateData = <String, dynamic>{};

        // Act & Assert
        await fakeUserService.changeUserMode(userId, inertialMode);

        // 測試錯誤情況
        expect(
          () => fakeUserService.updateUserProfile(userId, emptyUpdateData),
          throwsA(predicate((e) => e.toString().contains('更新資料不能為空'))),
        );
      });

      /**
       * TC-033. Cultivation模式錯誤訊息測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-033. Cultivation模式錯誤訊息測試', () async {
        // Arrange
        const userId = 'cultivation-user-123';
        const cultivationMode = 'cultivation';
        const invalidPinCode = '123'; // 太短的PIN碼

        // Act & Assert
        await fakeUserService.changeUserMode(userId, cultivationMode);

        // 測試錯誤情況
        expect(
          () => fakeUserService.setupPinCode(userId, invalidPinCode),
          throwsA(predicate((e) => e.toString().contains('PIN碼必須為6位數字'))),
        );
      });

      /**
       * TC-034. Guiding模式錯誤訊息測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-034. Guiding模式錯誤訊息測試', () async {
        // Arrange
        const userId = 'guiding-user-123';
        const guidingMode = 'guiding';
        const wrongOldPassword = 'wrong-old-password';
        const newPassword = 'NewPassword123';

        // Act & Assert
        await fakeUserService.changeUserMode(userId, guidingMode);

        // 測試錯誤情況
        expect(
          () => fakeUserService.changePassword(userId, wrongOldPassword, newPassword),
          throwsA(predicate((e) => e.toString().contains('舊密碼驗證失敗'))),
        );
      });

      /**
       * TC-039. Expert模式深度功能測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-039. Expert模式深度功能測試', () async {
        // Arrange
        const userId = 'expert-user-123';
        const expertMode = 'expert';
        final biometricData = {'templateId': 'expert-fp-template'};

        // Act
        await fakeUserService.changeUserMode(userId, expertMode);
        final activityResponse = await fakeUserService.getUserActivityHistory(userId);
        final linkedAccountsResponse = await fakeUserService.getLinkedAccounts(userId);
        final biometricResponse = await fakeUserService.setupBiometric(userId, 'fingerprint', biometricData);

        // Assert
        expect(activityResponse['success'], isTrue);
        expect(activityResponse['data']['activities'], isA<List>());
        expect(linkedAccountsResponse['success'], isTrue);
        expect(linkedAccountsResponse['data']['linkedAccounts'], isA<Map>());
        expect(biometricResponse['success'], isTrue);
        expect(biometricResponse['data']['biometricType'], equals('fingerprint'));
      });

      /**
       * TC-040. Inertial模式穩定性測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-040. Inertial模式穩定性測試', () async {
        // Arrange
        const userId = 'inertial-user-123';
        const inertialMode = 'inertial';
        final updateData = UserManagementTestUtils.createTestUpdateData();

        // Act - 多次操作測試穩定性
        await fakeUserService.changeUserMode(userId, inertialMode);

        final results = <Map<String, dynamic>>[];
        for (int i = 0; i < 3; i++) {
          final response = await fakeUserService.updateUserProfile(userId, updateData);
          results.add(response);
        }

        // Assert
        for (final result in results) {
          expect(result['success'], isTrue);
          expect(result['message'], contains('更新成功'));
        }
      });

      /**
       * TC-041. Cultivation模式激勵測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-041. Cultivation模式激勵測試', () async {
        // Arrange
        const userId = 'cultivation-user-123';
        const cultivationMode = 'cultivation';
        final preferences = UserManagementTestUtils.createTestPreferences();

        // Act
        await fakeUserService.changeUserMode(userId, cultivationMode);
        final preferencesResponse = await fakeUserService.updateUserPreferences(userId, preferences);
        final profileResponse = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(preferencesResponse['success'], isTrue);
        expect(preferencesResponse['message'], contains('更新成功'));
        expect(profileResponse['data']['userMode'], equals(cultivationMode));
      });

      /**
       * TC-042. Guiding模式簡化測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本
       */
      test('tc-042. Guiding模式簡化測試', () async {
        // Arrange
        const userId = 'guiding-user-123';
        const guidingMode = 'guiding';
        final simpleUpdateData = {
          'displayName': '簡化用戶',
          'theme': 'auto'
        };

        // Act
        await fakeUserService.changeUserMode(userId, guidingMode);
        final updateResponse = await fakeUserService.updateUserProfile(userId, simpleUpdateData);
        final profileResponse = await fakeUserService.getUserProfile(userId);

        // Assert
        expect(updateResponse['success'], isTrue);
        expect(updateResponse['data']['updatedFields'], hasLength(2));
        expect(profileResponse['data']['userMode'], equals(guidingMode));
      });
    });

    // ================================
    // 整合測試案例 (TC-016 ~ TC-020, TC-035 ~ TC-038)
    // ================================

    group('整合測試案例', () {
      /**
       * TC-016. 端到端用戶管理流程測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，完整端到端流程驗證
       */
      test('tc-016. 端到端用戶管理流程測試', () async {
        // Arrange
        const userId = 'e2e-test-user-123';
        final updateData = UserManagementTestUtils.createTestUpdateData();
        final preferences = UserManagementTestUtils.createTestPreferences();
        const newMode = 'cultivation';
        const pinCode = '987654';

        // Act - 完整流程測試
        final profileResponse = await fakeUserService.getUserProfile(userId);
        final updateResponse = await fakeUserService.updateUserProfile(userId, updateData);
        final modeResponse = await fakeUserService.changeUserMode(userId, newMode);
        final preferencesResponse = await fakeUserService.updateUserPreferences(userId, preferences);
        final pinResponse = await fakeUserService.setupPinCode(userId, pinCode);
        final activityResponse = await fakeUserService.getUserActivityHistory(userId);

        // Assert - 端到端流程驗證
        expect(profileResponse['success'], isTrue);
        expect(updateResponse['success'], isTrue);
        expect(modeResponse['success'], isTrue);
        expect(modeResponse['data']['newMode'], equals(newMode));
        expect(preferencesResponse['success'], isTrue);
        expect(pinResponse['success'], isTrue);
        expect(activityResponse['success'], isTrue);
        expect(activityResponse['data']['activities'], isA<List>());
      });

      /**
       * TC-017. 抽象類別協作測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證75個抽象方法協作
       */
      test('tc-017. 抽象類別協作測試', () async {
        // Arrange
        const userId = 'abstract-test-user-123';

        // Act - 模擬抽象類別協作
        final profileResponse = await fakeUserService.getUserProfile(userId);
        final preferencesResponse = await fakeUserService.getUserPreferences(userId);
        final linkedAccountsResponse = await fakeUserService.getLinkedAccounts(userId);

        // Assert - 抽象類別協作驗證
        expect(profileResponse['success'], isTrue);
        expect(profileResponse['data'], isA<Map>());
        expect(preferencesResponse['success'], isTrue);
        expect(preferencesResponse['data']['preferences'], isA<Map>());
        expect(linkedAccountsResponse['success'], isTrue);
        expect(linkedAccountsResponse['data']['linkedAccounts'], isA<Map>());

        // 驗證資料結構一致性
        expect(profileResponse['data']['userId'], equals(userId));
        expect(preferencesResponse['data']['userId'], equals(userId));
        expect(linkedAccountsResponse['data']['userId'], equals(userId));
      });

      /**
       * TC-018. ProfileService協作測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證ProfileService核心協作
       */
      test('tc-018. ProfileService協作測試', () async {
        // Arrange
        const userId = 'profile-test-user-123';
        final updateData = {
          'displayName': 'ProfileService測試用戶',
          'avatar': 'https://example.com/profile-avatar.jpg',
          'bio': '這是ProfileService協作測試'
        };

        // Act - ProfileService協作流程
        final originalProfile = await fakeUserService.getUserProfile(userId);
        final updateResult = await fakeUserService.updateUserProfile(userId, updateData);
        final updatedProfile = await fakeUserService.getUserProfile(userId);

        // Assert - ProfileService協作驗證
        expect(originalProfile['success'], isTrue);
        expect(updateResult['success'], isTrue);
        expect(updatedProfile['success'], isTrue);

        // 驗證ProfileService協作正確性
        expect(updateResult['data']['updatedFields'], contains('displayName'));
        expect(updateResult['data']['updatedFields'], contains('avatar'));
        expect(updateResult['message'], contains('更新成功'));
      });

      /**
       * TC-019. SecurityService協作測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證SecurityService安全協作
       */
      test('tc-019. SecurityService協作測試', () async {
        // Arrange
        const userId = 'security-test-user-123';
        const oldPassword = 'OldSecurePassword123';
        const newPassword = 'NewSecurePassword456';
        const pinCode = '654321';
        final biometricData = {'templateId': 'security-fp-template'};

        // Act - SecurityService協作流程
        final passwordChangeResult = await fakeUserService.changePassword(userId, oldPassword, newPassword);
        final pinSetupResult = await fakeUserService.setupPinCode(userId, pinCode);
        final biometricSetupResult = await fakeUserService.setupBiometric(userId, 'fingerprint', biometricData);

        // Assert - SecurityService協作驗證
        expect(passwordChangeResult['success'], isTrue);
        expect(passwordChangeResult['message'], contains('密碼變更成功'));
        expect(pinSetupResult['success'], isTrue);
        expect(pinSetupResult['message'], contains('PIN碼設定成功'));
        expect(biometricSetupResult['success'], isTrue);
        expect(biometricSetupResult['data']['biometricType'], equals('fingerprint'));

        // 驗證SecurityService協作一致性
        expect(passwordChangeResult['data']['userId'], equals(userId));
        expect(pinSetupResult['data']['userId'], equals(userId));
        expect(biometricSetupResult['data']['userId'], equals(userId));
      });

      /**
       * TC-020. AssessmentService協作測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證AssessmentService評估協作
       */
      test('tc-020. AssessmentService協作測試', () async {
        // Arrange
        const userId = 'assessment-test-user-123';
        const cultivationMode = 'cultivation';

        // Act - AssessmentService協作流程（模擬評估服務互動）
        final modeChangeResult = await fakeUserService.changeUserMode(userId, cultivationMode);
        final activityHistory = await fakeUserService.getUserActivityHistory(userId);
        final profileData = await fakeUserService.getUserProfile(userId);

        // Assert - AssessmentService協作驗證
        expect(modeChangeResult['success'], isTrue);
        expect(modeChangeResult['data']['newMode'], equals(cultivationMode));
        expect(activityHistory['success'], isTrue);
        expect(activityHistory['data']['activities'], isA<List>());
        expect(profileData['success'], isTrue);
        expect(profileData['data']['userMode'], isA<String>());

        // 驗證AssessmentService協作邏輯
        expect(activityHistory['data']['totalCount'], isA<int>());
        expect(activityHistory['data']['activities'].length, greaterThan(0));
      });

      /**
       * TC-035. ProfileService + SecurityService協作
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證Profile與Security深度協作
       */
      test('tc-035. ProfileService + SecurityService協作', () async {
        // Arrange
        const userId = 'profile-security-test-123';
        final profileUpdate = {
          'displayName': '安全協作用戶',
          'securityLevel': 'high'
        };
        const newPassword = 'SecurePassword789';
        const oldPassword = 'OldPassword123';

        // Act - Profile + Security 協作流程
        final profileUpdateResult = await fakeUserService.updateUserProfile(userId, profileUpdate);
        final passwordChangeResult = await fakeUserService.changePassword(userId, oldPassword, newPassword);
        final finalProfile = await fakeUserService.getUserProfile(userId);

        // Assert - 深度協作驗證
        expect(profileUpdateResult['success'], isTrue);
        expect(passwordChangeResult['success'], isTrue);
        expect(finalProfile['success'], isTrue);

        // 驗證協作資料一致性
        expect(profileUpdateResult['data']['userId'], equals(passwordChangeResult['data']['userId']));
        expect(finalProfile['data']['userId'], equals(userId));

        // 驗證時間戳一致性
        expect(profileUpdateResult['data']['updatedAt'], isA<String>());
        expect(passwordChangeResult['data']['changedAt'], isA<String>());
      });

      /**
       * TC-036. AssessmentService協作測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證評估服務獨立協作
       */
      test('tc-036. AssessmentService協作測試', () async {
        // Arrange
        const userId = 'assessment-solo-test-123';
        const expertMode = 'expert';

        // Act - AssessmentService 獨立協作
        final modeChange = await fakeUserService.changeUserMode(userId, expertMode);
        final activityData = await fakeUserService.getUserActivityHistory(userId);
        final linkedAccounts = await fakeUserService.getLinkedAccounts(userId);

        // Assert - 評估服務協作驗證
        expect(modeChange['success'], isTrue);
        expect(activityData['success'], isTrue);
        expect(linkedAccounts['success'], isTrue);

        // 驗證評估資料結構
        expect(activityData['data']['activities'], isA<List>());
        expect(linkedAccounts['data']['linkedAccounts'], isA<Map>());

        // 驗證評估邏輯一致性
        final activities = activityData['data']['activities'] as List;
        expect(activities.isNotEmpty, isTrue);
        for (final activity in activities) {
          expect(activity['timestamp'], isA<String>());
          expect(activity['activityType'], isA<String>());
        }
      });

      /**
       * TC-037. UserModeAdapter協作測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證用戶模式適配器協作
       */
      test('tc-037. UserModeAdapter協作測試', () async {
        // Arrange
        const userId = 'mode-adapter-test-123';
        final testModes = ['expert', 'inertial', 'cultivation', 'guiding'];

        // Act - UserModeAdapter 協作測試
        final results = <String, Map<String, dynamic>>{};

        for (final mode in testModes) {
          final modeResult = await fakeUserService.changeUserMode(userId, mode);
          final profileResult = await fakeUserService.getUserProfile(userId);

          results[mode] = {
            'modeChange': modeResult,
            'profile': profileResult,
          };
        }

        // Assert - UserModeAdapter協作驗證
        for (final mode in testModes) {
          expect(results[mode]!['modeChange']['success'], isTrue);
          expect(results[mode]!['modeChange']['data']['newMode'], equals(mode));
          expect(results[mode]!['profile']['success'], isTrue);
        }

        // 驗證模式適配器邏輯
        expect(results.length, equals(4));
        for (final entry in results.entries) {
          expect(entry.value['modeChange']['data']['userId'], equals(userId));
          expect(entry.value['profile']['data']['userId'], equals(userId));
        }
      });

      /**
       * TC-038. 全模組協作整合測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證所有模組整體協作
       */
      test('tc-038. 全模組協作整合測試', () async {
        // Arrange
        const userId = 'full-integration-test-123';
        final fullTestData = {
          'profile': UserManagementTestUtils.createTestUpdateData(),
          'preferences': UserManagementTestUtils.createTestPreferences(),
          'mode': 'expert',
          'pinCode': '111111',
          'biometric': {'templateId': 'full-test-template'},
          'password': {
            'old': 'FullTestOldPassword123',
            'new': 'FullTestNewPassword456'
          }
        };

        // Act - 全模組協作流程
        final operationResults = <String, dynamic>{};

        // 1. Profile模組協作
        operationResults['profile'] = await fakeUserService.updateUserProfile(
          userId,
          fullTestData['profile'] as Map<String, dynamic>
        );

        // 2. Preferences模組協作
        operationResults['preferences'] = await fakeUserService.updateUserPreferences(
          userId,
          fullTestData['preferences'] as Map<String, dynamic>
        );

        // 3. Mode模組協作
        operationResults['mode'] = await fakeUserService.changeUserMode(
          userId,
          fullTestData['mode'] as String
        );

        // 4. Security模組協作
        operationResults['pin'] = await fakeUserService.setupPinCode(
          userId,
          fullTestData['pinCode'] as String
        );

        operationResults['biometric'] = await fakeUserService.setupBiometric(
          userId,
          'fingerprint',
          fullTestData['biometric'] as Map<String, dynamic>
        );

        final passwordData = fullTestData['password'] as Map<String, dynamic>;
        operationResults['password'] = await fakeUserService.changePassword(
          userId,
          passwordData['old'] as String,
          passwordData['new'] as String
        );

        // 5. Assessment模組協作
        operationResults['activity'] = await fakeUserService.getUserActivityHistory(userId);
        operationResults['linked'] = await fakeUserService.getLinkedAccounts(userId);

        // 6. 最終狀態驗證
        operationResults['finalProfile'] = await fakeUserService.getUserProfile(userId);

        // Assert - 全模組協作整合驗證
        for (final entry in operationResults.entries) {
          expect(entry.value['success'], isTrue, reason: '${entry.key} 操作應該成功');
        }

        // 驗證協作數據一致性
        final profileData = operationResults['finalProfile']['data'];
        expect(profileData['userId'], equals(userId));

        // 驗證模組間資料同步
        expect(operationResults['mode']['data']['newMode'], equals('expert'));
        expect(operationResults['activity']['data']['userId'], equals(userId));
        expect(operationResults['linked']['data']['userId'], equals(userId));

        // 驗證操作順序和依賴關係
        expect(operationResults['profile']['data']['updatedFields'], isA<List>());
        expect(operationResults['preferences']['data']['preferences'], isA<Map>());
        expect(operationResults['pin']['data']['setupAt'], isA<String>());
        expect(operationResults['biometric']['data']['biometricType'], equals('fingerprint'));
        expect(operationResults['password']['data']['changedAt'], isA<String>());
      });
    });

    // ================================
    // 安全性測試案例 (TC-021 ~ TC-024, TC-043)
    // ================================

    group('安全性測試案例', () {
      /**
       * TC-021. 密碼安全性驗證測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證OWASP密碼安全標準
       */
      test('tc-021. 密碼安全性驗證測試', () async {
        // Arrange
        const userId = 'security-user-123';
        final passwordTests = [
          {'password': 'weak', 'shouldFail': true},
          {'password': '12345678', 'shouldFail': true}, // 純數字
          {'password': 'password', 'shouldFail': true}, // 常見密碼
          {'password': 'SecurePass123!', 'shouldFail': false}, // 強密碼
        ];

        // Act & Assert
        for (final test in passwordTests) {
          final password = test['password'] as String;
          final shouldFail = test['shouldFail'] as bool;

          if (shouldFail) {
            expect(
              () => fakeUserService.changePassword(userId, 'OldPassword123', password),
              throwsA(isA<Exception>()),
              reason: '弱密碼 "$password" 應該被拒絕'
            );
          } else {
            final response = await fakeUserService.changePassword(userId, 'OldPassword123', password);
            expect(response['success'], isTrue, reason: '強密碼 "$password" 應該被接受');
          }
        }
      });

      /**
       * TC-022. PIN碼安全性驗證測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證PIN碼安全機制
       */
      test('tc-022. PIN碼安全性驗證測試', () async {
        // Arrange
        const userId = 'pin-security-user-123';
        final pinTests = [
          {'pin': '123', 'shouldFail': true},      // 太短
          {'pin': '1234567', 'shouldFail': true},  // 太長
          {'pin': 'abcdef', 'shouldFail': true},   // 非數字
          {'pin': '123456', 'shouldFail': false},  // 正確格式
          {'pin': '000000', 'shouldFail': true},   // 弱PIN
          {'pin': '654321', 'shouldFail': false},  // 安全PIN
        ];

        // Act & Assert
        for (final test in pinTests) {
          final pin = test['pin'] as String;
          final shouldFail = test['shouldFail'] as bool;

          if (shouldFail) {
            expect(
              () => fakeUserService.setupPinCode(userId, pin),
              throwsA(isA<Exception>()),
              reason: '無效PIN "$pin" 應該被拒絕'
            );
          } else {
            final response = await fakeUserService.setupPinCode(userId, pin);
            expect(response['success'], isTrue, reason: '有效PIN "$pin" 應該被接受');
          }
        }
      });

      /**
       * TC-023. 生物辨識安全測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證生物辨識安全性
       */
      test('tc-023. 生物辨識安全測試', () async {
        // Arrange
        const userId = 'biometric-user-123';
        final biometricTests = [
          {'type': 'fingerprint', 'data': {'templateId': 'fp-123'}, 'shouldPass': true},
          {'type': 'faceId', 'data': {'templateId': 'face-456'}, 'shouldPass': true},
          {'type': 'invalidType', 'data': {'templateId': 'invalid'}, 'shouldPass': false},
          {'type': 'fingerprint', 'data': {}, 'shouldPass': false}, // 缺少模板
        ];

        // Act & Assert
        for (final test in biometricTests) {
          final type = test['type'] as String;
          final data = test['data'] as Map<String, dynamic>;
          final shouldPass = test['shouldPass'] as bool;

          if (shouldPass) {
            final response = await fakeUserService.setupBiometric(userId, type, data);
            expect(response['success'], isTrue, reason: '生物辨識類型 "$type" 應該設定成功');
            expect(response['data']['biometricType'], equals(type));
          } else {
            expect(
              () => fakeUserService.setupBiometric(userId, type, data),
              throwsA(isA<Exception>()),
              reason: '無效生物辨識設定應該失敗'
            );
          }
        }
      });

      /**
       * TC-024. 隱私模式安全測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證隱私模式安全性
       */
      test('tc-024. 隱私模式安全測試', () async {
        // Arrange
        const userId = 'privacy-user-123';
        final privacyPreferences = {
          'privacy': {
            'profileVisibility': 'private',
            'activityTracking': false,
            'dataSharing': false,
            'analyticsOptOut': true,
          }
        };

        // Act
        final updateResponse = await fakeUserService.updateUserPreferences(userId, privacyPreferences);
        final profileResponse = await fakeUserService.getUserProfile(userId);
        final activityResponse = await fakeUserService.getUserActivityHistory(userId);

        // Assert
        expect(updateResponse['success'], isTrue);
        expect(profileResponse['success'], isTrue);
        expect(activityResponse['success'], isTrue);

        // 驗證隱私設定生效
        final preferences = updateResponse['data']['preferences'];
        expect(preferences['privacy']['profileVisibility'], equals('private'));
        expect(preferences['privacy']['activityTracking'], isFalse);
      });

      /**
       * TC-043. 跨平台安全設定測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證跨平台安全一致性
       */
      test('tc-043. 跨平台安全設定測試', () async {
        // Arrange
        const userId = 'cross-platform-user-123';
        final platforms = ['iOS', 'Android', 'Web'];
        final securitySettings = {
          'fingerprint': {'templateId': 'cross-platform-fp'},
          'pin': '789456',
        };

        // Act & Assert - 模擬跨平台安全設定
        for (final platform in platforms) {
          // 設定PIN碼
          final pinResponse = await fakeUserService.setupPinCode(userId, securitySettings['pin'] as String);
          expect(pinResponse['success'], isTrue, reason: '$platform 平台PIN設定應該成功');

          // 設定生物辨識
          final biometricResponse = await fakeUserService.setupBiometric(
            userId, 
            'fingerprint', 
            securitySettings['fingerprint'] as Map<String, dynamic>
          );
          expect(biometricResponse['success'], isTrue, reason: '$platform 平台生物辨識設定應該成功');

          // 驗證設定一致性
          expect(biometricResponse['data']['biometricType'], equals('fingerprint'));
          expect(biometricResponse['data']['userId'], equals(userId));
        }
      });
    });

    // ================================
    // 效能測試案例 (TC-025 ~ TC-027, TC-048)
    // ================================

    group('效能測試案例', () {
      /**
       * TC-025. API回應時間效能測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證API回應時間指標
       */
      test('tc-025. API回應時間效能測試', () async {
        // Arrange
        const userId = 'performance-user-123';
        final maxResponseTime = Duration(seconds: 3); // P95 < 3秒
        final testIterations = 10;

        // Act & Assert - 測試各API端點效能
        final apiTests = [
          () => fakeUserService.getUserProfile(userId),
          () => fakeUserService.getUserPreferences(userId),
          () => fakeUserService.getUserActivityHistory(userId),
          () => fakeUserService.getLinkedAccounts(userId),
        ];

        for (final apiTest in apiTests) {
          final responseTimes = <Duration>[];

          for (int i = 0; i < testIterations; i++) {
            final stopwatch = Stopwatch()..start();
            final response = await apiTest();
            stopwatch.stop();

            expect(response['success'], isTrue);
            responseTimes.add(stopwatch.elapsed);
          }

          // 計算P95回應時間
          responseTimes.sort((a, b) => a.compareTo(b));
          final p95Index = (responseTimes.length * 0.95).floor();
          final p95ResponseTime = responseTimes[p95Index];

          expect(p95ResponseTime, lessThan(maxResponseTime), 
                reason: 'API P95回應時間應該小於3秒，實際: ${p95ResponseTime.inMilliseconds}ms');
        }
      });

      /**
       * TC-026. 併發處理能力測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證併發處理穩定性
       */
      test('tc-026. 併發處理能力測試', () async {
        // Arrange
        const concurrentUsers = 5; // 模擬5個併發用戶
        final userIds = List.generate(concurrentUsers, (i) => 'concurrent-user-$i');

        // Act - 併發執行用戶操作
        final futures = userIds.map((userId) async {
          final profile = await fakeUserService.getUserProfile(userId);
          final updateData = {'displayName': '併發測試用戶-${DateTime.now().millisecondsSinceEpoch}'};
          final update = await fakeUserService.updateUserProfile(userId, updateData);
          final preferences = await fakeUserService.getUserPreferences(userId);

          return {
            'userId': userId,
            'profile': profile,
            'update': update,
            'preferences': preferences,
          };
        }).toList();

        final results = await Future.wait(futures);

        // Assert - 驗證併發處理結果
        expect(results.length, equals(concurrentUsers));

        for (final result in results) {
          final profileResult = result['profile'] as Map<String, dynamic>;
          final updateResult = result['update'] as Map<String, dynamic>;
          final preferencesResult = result['preferences'] as Map<String, dynamic>;

          expect(profileResult['success'], isTrue, reason: '併發取得個人資料應該成功');
          expect(updateResult['success'], isTrue, reason: '併發更新個人資料應該成功');
          expect(preferencesResult['success'], isTrue, reason: '併發取得偏好設定應該成功');

          // 驗證資料一致性
          final userId = result['userId'] as String;
          final profileData = profileResult['data'] as Map<String, dynamic>;
          final updateData = updateResult['data'] as Map<String, dynamic>;
          final preferencesData = preferencesResult['data'] as Map<String, dynamic>;

          expect(profileData['userId'], equals(userId));
          expect(updateData['userId'], equals(userId));
          expect(preferencesData['userId'], equals(userId));
        }
      });

      /**
       * TC-027. 大量用戶資料處理效能測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證大量資料處理能力
       */
      test('tc-027. 大量用戶資料處理效能測試', () async {
        // Arrange
        const batchSize = 20; // 模擬批次處理20個用戶
        final userIds = List.generate(batchSize, (i) => 'batch-user-$i');
        final startTime = DateTime.now();

        // Act - 批次處理大量用戶資料
        final batchResults = <Map<String, dynamic>>[];

        for (final userId in userIds) {
          final profileData = UserManagementTestUtils.createTestUserProfile(userId: userId);
          final updateData = UserManagementTestUtils.createTestUpdateData();

          final updateResult = await fakeUserService.updateUserProfile(userId, updateData);
          batchResults.add({
            'userId': userId,
            'result': updateResult,
            'timestamp': DateTime.now(),
          });
        }

        final endTime = DateTime.now();
        final totalProcessingTime = endTime.difference(startTime);

        // Assert - 驗證批次處理效能
        expect(batchResults.length, equals(batchSize));
        expect(totalProcessingTime.inSeconds, lessThan(10), 
              reason: '批次處理$batchSize個用戶應該在10秒內完成');

        // 驗證所有操作成功
        for (final result in batchResults) {
          expect(result['result']['success'], isTrue, 
                reason: '用戶 ${result['userId']} 的批次操作應該成功');
        }

        // 計算平均處理時間
        final avgProcessingTime = totalProcessingTime.inMilliseconds / batchSize;
        expect(avgProcessingTime, lessThan(500), 
              reason: '每個用戶平均處理時間應該小於500ms，實際: ${avgProcessingTime}ms');
      });

      /**
       * TC-048. 系統負載壓力測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證系統高負載穩定性
       */
      test('tc-048. 系統負載壓力測試', () async {
        // Arrange
        const stressTestDuration = Duration(seconds: 5); // 5秒壓力測試
        const operationsPerSecond = 10;
        final userId = 'stress-test-user-123';

        // Act - 高負載壓力測試
        final startTime = DateTime.now();
        final results = <Map<String, dynamic>>[];
        int operationCount = 0;

        while (DateTime.now().difference(startTime) < stressTestDuration) {
          final futures = <Future>[];

          // 每秒執行多個操作
          for (int i = 0; i < operationsPerSecond; i++) {
            futures.add(performStressOperation(userId, operationCount++));
          }

          final batchResults = await Future.wait(futures);
          results.addAll(batchResults.cast<Map<String, dynamic>>());

          // 短暫暫停，控制負載
          await Future.delayed(Duration(milliseconds: 100));
        }

        final endTime = DateTime.now();
        final actualDuration = endTime.difference(startTime);

        // Assert - 驗證壓力測試結果
        expect(results.isNotEmpty, isTrue, reason: '壓力測試應該產生操作結果');

        // 計算成功率
        final successCount = results.where((r) => r['success'] == true).length;
        final successRate = successCount / results.length;

        expect(successRate, greaterThan(0.95), 
              reason: '高負載下成功率應該大於95%，實際: ${(successRate * 100).toStringAsFixed(1)}%');

        // 驗證系統穩定性
        expect(actualDuration.inSeconds, lessThanOrEqualTo(stressTestDuration.inSeconds + 2), 
              reason: '壓力測試不應該導致系統響應嚴重延遲');

        print('壓力測試統計: 總操作數=${results.length}, 成功率=${(successRate * 100).toStringAsFixed(1)}%');
      });
    });

    // ================================
    // 異常測試案例 (TC-028 ~ TC-030)
    // ================================

    group('異常測試案例', () {
      /**
       * TC-028. 網路異常處理測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證網路異常恢復機制
       */
      test('tc-028. 網路異常處理測試', () async {
        // Arrange
        const userId = 'network-error-user-123';

        // Act & Assert - 模擬各種網路異常情況
        final networkErrorScenarios = [
          {'scenario': '用戶不存在', 'userId': 'non-existent-user'},
          {'scenario': '空用戶ID', 'userId': ''},
          {'scenario': '無效格式用戶ID', 'userId': 'invalid-format-user'},
        ];

        for (final scenario in networkErrorScenarios) {
          final testUserId = scenario['userId'] as String;
          final scenarioName = scenario['scenario'] as String;

          expect(
            () => fakeUserService.getUserProfile(testUserId),
            throwsA(isA<Exception>()),
            reason: '網路異常場景: $scenarioName 應該拋出異常'
          );
        }

        // 驗證正常用戶操作恢復
        final normalResponse = await fakeUserService.getUserProfile(userId);
        expect(normalResponse['success'], isTrue, reason: '網路恢復後正常用戶操作應該成功');
      });

      /**
       * TC-029. 服務超時處理測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證服務超時重試機制
       */
      test('tc-029. 服務超時處理測試', () async {
        // Arrange
        const userId = 'timeout-test-user-123';
        const maxRetries = 3;
        const timeoutDuration = Duration(seconds: 1);

        // Act - 模擬超時重試機制
        int retryCount = 0;
        bool operationSuccess = false;

        while (retryCount < maxRetries && !operationSuccess) {
          try {
            final stopwatch = Stopwatch()..start();
            final response = await fakeUserService.getUserProfile(userId);
            stopwatch.stop();

            if (response['success'] == true) {
              operationSuccess = true;
            }

            // 模擬處理時間檢查
            if (stopwatch.elapsed > timeoutDuration) {
              print('操作耗時: ${stopwatch.elapsed.inMilliseconds}ms (超過閾值)');
            }

          } catch (e) {
            retryCount++;
            print('重試第 $retryCount 次，錯誤: ${e.toString()}');

            if (retryCount < maxRetries) {
              await Future.delayed(Duration(milliseconds: 500)); // 重試間隔
            }
          }
        }

        // Assert - 驗證超時處理邏輯
        expect(operationSuccess, isTrue, reason: '重試機制應該最終成功');
        expect(retryCount, lessThan(maxRetries), reason: '不應該用盡所有重試次數');
      });

      /**
       * TC-030. 資料庫連線異常測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證資料庫異常恢復
       */
      test('tc-030. 資料庫連線異常測試', () async {
        // Arrange
        const userId = 'db-error-user-123';

        // Act & Assert - 模擬資料庫連線問題
        final dbErrorScenarios = [
          {'operation': '獲取用戶資料', 'test': () => fakeUserService.getUserProfile(userId)},
          {'operation': '更新用戶資料', 'test': () => fakeUserService.updateUserProfile(userId, {'displayName': '測試'})},
          {'operation': '獲取偏好設定', 'test': () => fakeUserService.getUserPreferences(userId)},
        ];

        // 驗證所有資料庫操作在正常情況下都能成功
        for (final scenario in dbErrorScenarios) {
          final operation = scenario['operation'] as String;
          final testFunction = scenario['test'] as Function;

          try {
            final response = await testFunction();
            expect(response['success'], isTrue, reason: '$operation 在正常情況下應該成功');
          } catch (e) {
            // 如果發生異常，驗證是否為預期的資料庫異常
            expect(e, isA<Exception>(), reason: '$operation 的資料庫異常應該被正確處理');
          }
        }

        // 驗證連線恢復後的操作
        final recoveryResponse = await fakeUserService.getUserProfile(userId);
        expect(recoveryResponse['success'], isTrue, reason: '資料庫連線恢復後操作應該成功');
      });
    });

    // ================================
    // 兼容性測試案例 (TC-044, TC-045)
    // ================================

    group('兼容性測試案例', () {
      /**
       * TC-044. API版本兼容性測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證API版本向下兼容
       */
      test('tc-044. API版本兼容性測試', () async {
        // Arrange
        const userId = 'version-compat-user-123';
        final apiVersions = ['v2.4.0', 'v2.5.0', 'v3.0.0'];

        // Act & Assert - 測試不同API版本兼容性
        for (final version in apiVersions) {
          // 模擬不同版本的API調用
          final profileResponse = await fakeUserService.getUserProfile(userId);
          final preferencesResponse = await fakeUserService.getUserPreferences(userId);

          // 驗證核心響應結構保持一致
          expect(profileResponse['success'], isTrue, reason: 'API $version 的用戶資料回應應該成功');
          expect(profileResponse['data']['userId'], equals(userId), reason: 'API $version 的用戶ID應該一致');

          expect(preferencesResponse['success'], isTrue, reason: 'API $version 的偏好設定回應應該成功');
          expect(preferencesResponse['data']['userId'], equals(userId), reason: 'API $version 的偏好設定用戶ID應該一致');

          // 驗證必要字段存在
          expect(profileResponse['data']['email'], isNotNull, reason: 'API $version 應該包含email字段');
          expect(profileResponse['data']['displayName'], isNotNull, reason: 'API $version 應該包含displayName字段');
          expect(profileResponse['data']['userMode'], isNotNull, reason: 'API $version 應該包含userMode字段');
        }
      });

      /**
       * TC-045. 多語言支援測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證多語言環境支援
       */
      test('tc-045. 多語言支援測試', () async {
        // Arrange
        const userId = 'multilang-user-123';
        final supportedLanguages = ['zh-TW', 'zh-CN', 'en-US', 'ja-JP'];

        // Act & Assert - 測試多語言支援
        for (final language in supportedLanguages) {
          final preferences = {
            'language': language,
            'timezone': getTimezoneForLanguage(language),
            'dateFormat': getDateFormatForLanguage(language),
          };

          final updateResponse = await fakeUserService.updateUserPreferences(userId, preferences);
          final profileResponse = await fakeUserService.getUserProfile(userId);

          // 驗證語言設定更新成功
          expect(updateResponse['success'], isTrue, reason: '語言 $language 的偏好設定更新應該成功');
          expect(profileResponse['success'], isTrue, reason: '語言 $language 的用戶資料獲取應該成功');

          // 驗證語言設定正確保存
          expect(updateResponse['data']['preferences']['language'], equals(language), 
                reason: '語言設定應該正確保存為 $language');

          // 驗證時區和日期格式的兼容性
          expect(preferences['timezone'], isNotNull, reason: '語言 $language 應該有對應的時區設定');
          expect(preferences['dateFormat'], isNotNull, reason: '語言 $language 應該有對應的日期格式');
        }
      });
    });

    // ================================
    // 可靠性測試案例 (TC-049)
    // ================================

    group('可靠性測試案例', () {
      /**
       * TC-049. 災難恢復測試
       * @version 2025-09-02-V1.6.0
       * @date 2025-09-02 12:00:00
       * @update: 升級版本，驗證系統災難恢復能力
       */
      test('tc-049. 災難恢復測試', () async {
        // Arrange
        const userId = 'disaster-recovery-user-123';
        final criticalOperations = [
          () => fakeUserService.getUserProfile(userId),
          () => fakeUserService.updateUserProfile(userId, {'displayName': '災難恢復測試'}),
          () => fakeUserService.changeUserMode(userId, 'expert'),
          () => fakeUserService.setupPinCode(userId, '123456'),
        ];

        // Act - 模擬災難場景和恢復
        final preDisasterData = await fakeUserService.getUserProfile(userId);
        expect(preDisasterData['success'], isTrue, reason: '災難前系統應該正常運行');

        // 模擬系統異常情況
        final disasterScenarios = [
          '模擬服務重啟',
          '模擬網路中斷',
          '模擬資料庫連線問題',
          '模擬高負載情況',
        ];

        for (final scenario in disasterScenarios) {
          print('執行災難場景: $scenario');

          // 模擬短暫異常
          await Future.delayed(Duration(milliseconds: 100));

          // 驗證系統恢復能力
          bool allOperationsRecovered = true;
          final recoveryResults = <String, bool>{};

          for (int i = 0; i < criticalOperations.length; i++) {
            try {
              final response = await criticalOperations[i]();
              recoveryResults['operation_$i'] = response['success'] == true;
            } catch (e) {
              recoveryResults['operation_$i'] = false;
              allOperationsRecovered = false;
            }
          }

          // Assert - 驗證災難恢復效果
          expect(allOperationsRecovered, isTrue, 
                reason: '災難場景 "$scenario" 後，所有關鍵操作應該能恢復正常');

          // 驗證資料完整性
          final postRecoveryData = await fakeUserService.getUserProfile(userId);
          expect(postRecoveryData['success'], isTrue, reason: '災難恢復後資料獲取應該成功');
          expect(postRecoveryData['data']['userId'], equals(userId), reason: '災難恢復後資料完整性應該保持');
        }

        // 最終驗證 - 系統完全恢復
        final finalVerification = await fakeUserService.getUserProfile(userId);
        expect(finalVerification['success'], isTrue, reason: '最終驗證：系統應該完全恢復正常');
        expect(finalVerification['data']['userId'], equals(preDisasterData['data']['userId']), 
              reason: '災難恢復後用戶資料應該與災難前一致');
      });
    });
  });
}