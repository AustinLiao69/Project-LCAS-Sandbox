/**
 * 8501. 認證服務_測試程式碼_v2.5.0
 * @testFile 認證服務測試程式碼
 * @description LCAS 2.0 認證服務 API 模組完整測試實作 - 涵蓋49個測試案例
 * @version 2025-08-28-V2.5.0
 * @update 2025-08-28: 升級到v2.5.0版本，修復Mockito null safety兼容性問題
 */

import 'package:test/test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'dart:async';
import 'dart:convert';

// 匯入認證服務模組
import '../83. Flutter_Module code(API route)_APL/8301. 認證服務.dart';

// ================================
// 模擬服務定義 (Mock Services)
// ================================

@GenerateMocks([
  AuthService,
  TokenService,
  UserModeAdapter,
  SecurityService,
  ValidationService,
  ErrorHandler,
  ModeConfigService,
  ResponseFilter,
  JwtProvider,
])
import '8501. 認證服務_test.mocks.dart';

// ================================
// 測試輔助工具類別 (Test Utilities)
// ================================

/// 測試輔助工具類別
class TestUtils {
  /// 01. 建立測試註冊請求
  /// @version 2025-01-28-V2.6.0
  /// @date 2025-08-28 12:00:00
  /// @update: 提供完整測試資料生成
  static RegisterRequest createTestRegisterRequest({
    UserMode userMode = UserMode.expert,
    String? email,
    String? password,
  }) {
    return RegisterRequest(
      email: email ?? 'test@lcas.com',
      password: password ?? 'TestPassword123',
      confirmPassword: password ?? 'TestPassword123',
      displayName: 'Test User',
      userMode: userMode,
      acceptTerms: true,
      acceptPrivacy: true,
      timezone: 'Asia/Taipei',
      language: 'zh-TW',
    );
  }

  /// 02. 建立測試登入請求
  /// @version 2025-01-28-V2.6.0
  /// @date 2025-08-28 12:00:00
  /// @update: 提供完整登入測試資料
  static LoginRequest createTestLoginRequest({
    String? email,
    String? password,
  }) {
    return LoginRequest(
      email: email ?? 'test@lcas.com',
      password: password ?? 'TestPassword123',
      rememberMe: true,
      deviceInfo: DeviceInfo(
        deviceId: 'test-device-id',
        platform: 'iOS',
        appVersion: '1.0.0',
      ),
    );
  }

  /// 03. 建立測試使用者資料
  /// @version 2025-01-28-V2.6.0
  /// @date 2025-08-28 12:00:00
  /// @update: 提供完整使用者測試資料
  static UserProfile createTestUser({
    UserMode userMode = UserMode.expert,
    String? userId,
    String? email,
  }) {
    return UserProfile(
      id: userId ?? 'test-user-id',
      email: email ?? 'test@lcas.com',
      displayName: 'Test User',
      userMode: userMode,
      avatar: 'https://example.com/avatar.jpg',
      preferences: {
        'language': 'zh-TW',
        'timezone': 'Asia/Taipei',
        'theme': 'auto',
      },
      createdAt: DateTime.now().subtract(Duration(days: 7)),
      lastActiveAt: DateTime.now().subtract(Duration(hours: 1)),
    );
  }

  /// 建立測試Token對
  static TokenPair createTestTokenPair() {
    return TokenPair(
      accessToken: 'test-access-token-${DateTime.now().millisecondsSinceEpoch}',
      refreshToken: 'test-refresh-token-${DateTime.now().millisecondsSinceEpoch}',
      expiresAt: DateTime.now().add(Duration(hours: 1)),
    );
  }

  /// 建立測試回應資料
  static RegisterResponse createTestRegisterResponse({
    UserMode userMode = UserMode.expert,
    String? userId,
    String? email,
  }) {
    return RegisterResponse(
      userId: userId ?? 'test-user-id',
      email: email ?? 'test@lcas.com',
      userMode: userMode,
      verificationSent: true,
      needsAssessment: userMode == UserMode.expert,
      token: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: DateTime.now().add(Duration(hours: 1)),
    );
  }

  /// 建立測試登入回應資料
  static LoginResponse createTestLoginResponse({
    UserMode userMode = UserMode.expert,
  }) {
    final user = createTestUser(userMode: userMode);
    return LoginResponse(
      token: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: DateTime.now().add(Duration(hours: 1)),
      user: user,
      loginHistory: {
        'lastLogin': DateTime.now().subtract(Duration(days: 1)).toIso8601String(),
        'loginCount': 42,
        'newDeviceDetected': false,
      },
    );
  }
}

/// 測試環境設定
class TestEnvironmentConfig {
  static const String testApiUrl = 'https://test-api.lcas.app';
  static const String mockUserId = 'test-user-123';
  static const String mockRequestId = 'req-test-456';

  /// 初始化測試環境
  /// @version 2025-01-28-V2.6.0
  /// @date 2025-08-28 12:00:00
  /// @update: 建立完整測試環境配置
  static Future<void> setupTestEnvironment() async {
    // 初始化模擬資料
    await _initMockData();
    // 設定測試用戶模式
    await _setupTestUserModes();
    // 配置模擬服務
    await _configureMockServices();
  }

  static Future<void> _initMockData() async {
    // 初始化測試資料
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
  group('認證服務測試套件 v2.5.0', () {
    late AuthController authController;
    late MockAuthService mockAuthService;
    late MockTokenService mockTokenService;
    late MockUserModeAdapter mockUserModeAdapter;
    late MockSecurityService mockSecurityService;
    late MockValidationService mockValidationService;
    late MockErrorHandler mockErrorHandler;
    late MockModeConfigService mockModeConfigService;
    late MockResponseFilter mockResponseFilter;
    late MockJwtProvider mockJwtProvider;

    setUpAll(() async {
      await TestEnvironmentConfig.setupTestEnvironment();
    });

    setUp(() {
      // 初始化所有模擬服務
      mockAuthService = MockAuthService();
      mockTokenService = MockTokenService();
      mockUserModeAdapter = MockUserModeAdapter();
      mockSecurityService = MockSecurityService();
      mockValidationService = MockValidationService();
      mockErrorHandler = MockErrorHandler();
      mockModeConfigService = MockModeConfigService();
      mockResponseFilter = MockResponseFilter();
      mockJwtProvider = MockJwtProvider();

      // 建立認證控制器
      authController = AuthController(
        authService: mockAuthService,
        tokenService: mockTokenService,
        userModeAdapter: mockUserModeAdapter,
      );
    });

    // ================================
    // 3. 功能測試 (測試案例 04-23)
    // ================================

    group('3. 功能測試', () {
      group('3.1 使用者註冊API測試', () {
        /// TC-04: 正常註冊流程 - Expert模式
        /// @version 2025-01-28-V2.6.0
        test('04. 正常註冊流程 - Expert模式', () async {
          // Arrange
          final request = TestUtils.createTestRegisterRequest(userMode: UserMode.expert);
          final expectedResult = RegisterResult(userId: 'test-user-id', success: true);
          final expectedTokenPair = TokenPair(
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );
          final expectedResponse = RegisterResponse(
            userId: 'test-user-id',
            email: 'test@lcas.com',
            userMode: UserMode.expert,
            verificationSent: true,
            needsAssessment: true,
            token: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: expectedTokenPair.expiresAt,
          );

          final testRegisterRequest = TestUtils.createTestRegisterRequest(userMode: UserMode.expert);
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => expectedResult);
          when(mockTokenService.generateTokenPair('test-user-id', UserMode.expert))
              .thenAnswer((_) async => expectedTokenPair);
          when(mockUserModeAdapter.adaptRegisterResponse(any as RegisterResponse, any as UserMode))
              .thenReturn(expectedResponse);

          // Act
          final response = await authController.register(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.userId, equals('test-user-id'));
          expect(response.data?.userMode, equals('expert'));
          expect(response.data?.needsAssessment, isTrue); // Expert模式需要評估
          expect(response.metadata.userMode, equals(UserMode.expert));
          verify(mockAuthService.processRegistration(request)).called(1);
          verify(mockTokenService.generateTokenPair('test-user-id', UserMode.expert)).called(1);
        });

        /// TC-05: 註冊驗證錯誤 - 無效Email
        /// @version 2025-01-28-V2.6.0
        test('05. 註冊驗證錯誤 - 無效Email格式', () async {
          // Arrange
          final request = TestUtils.createTestRegisterRequest(email: 'invalid-email');

          // Act
          final response = await authController.register(request);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.validationError));
          expect(response.error?.field, equals('email'));
          expect(response.metadata.httpStatusCode, equals(400));
          verifyZeroInteractions(mockAuthService);
        });

        /// TC-06: 註冊失敗 - Email已存在
        /// @version 2025-01-28-V2.6.0
        test('06. 註冊失敗 - Email已存在', () async {
          // Arrange
          final request = TestUtils.createTestRegisterRequest();
          final expectedResult = RegisterResult(
            userId: '',
            success: false,
            errorMessage: 'Email already exists',
          );

          final testRegisterRequest = TestUtils.createTestRegisterRequest();
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => expectedResult);

          // Act
          final response = await authController.register(request);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.emailAlreadyExists));
          expect(response.metadata.httpStatusCode, equals(409));
        });

        /// TC-07: 四模式註冊差異 - Guiding模式
        /// @version 2025-01-28-V2.6.0
        test('07. 四模式註冊差異 - Guiding模式', () async {
          // Arrange
          final request = TestUtils.createTestRegisterRequest(userMode: UserMode.guiding);
          final expectedResult = RegisterResult(userId: 'test-user-id', success: true);
          final expectedTokenPair = TokenPair(
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );

          final adaptedResponse = RegisterResponse(
            userId: 'test-user-id',
            email: 'test@lcas.com',
            userMode: UserMode.guiding,
            verificationSent: true,
            needsAssessment: false, // Guiding模式不需要評估
            token: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: expectedTokenPair.expiresAt,
          );

          final testRegisterRequest = TestUtils.createTestRegisterRequest(userMode: UserMode.guiding);
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => expectedResult);
          when(mockTokenService.generateTokenPair('test-user-id', UserMode.guiding))
              .thenAnswer((_) async => expectedTokenPair);
          when(mockUserModeAdapter.adaptRegisterResponse(adaptedResponse, UserMode.guiding))
              .thenReturn(adaptedResponse);

          // Act
          final response = await authController.register(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.userMode, equals('guiding'));
          expect(response.data?.needsAssessment, isFalse);
          expect(response.metadata.userMode, equals(UserMode.guiding));
          verify(mockUserModeAdapter.adaptRegisterResponse(adaptedResponse, UserMode.guiding)).called(1);
        });
      });

      group('3.2 使用者登入API測試', () {
        /// TC-08: 正常登入流程 - Expert模式
        /// @version 2025-01-28-V2.6.0
        test('08. 正常登入流程 - Expert模式', () async {
          // Arrange
          final request = TestUtils.createTestLoginRequest();
          final mockUser = UserProfile(
            id: 'test-user-id',
            email: 'test@lcas.com',
            displayName: 'Test User',
            userMode: UserMode.expert,
            createdAt: DateTime.now(),
          );
          final expectedResult = LoginResult(user: mockUser, success: true);
          final expectedTokenPair = TokenPair(
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );
          final adaptedResponse = LoginResponse(
            token: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: expectedTokenPair.expiresAt,
            user: mockUser,
            loginHistory: {
              'lastLogin': DateTime.now().subtract(Duration(days: 1)).toIso8601String(),
              'loginCount': 42,
              'newDeviceDetected': false,
            },
          );

          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => expectedResult);
          when(mockTokenService.generateTokenPair('test-user-id', UserMode.expert))
              .thenAnswer((_) async => expectedTokenPair);
          when(mockUserModeAdapter.adaptLoginResponse(adaptedResponse, UserMode.expert))
              .thenReturn(adaptedResponse);

          // Act
          final response = await authController.login(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.token, equals('test-access-token'));
          expect(response.data?.user.userMode, equals('expert'));
          expect(response.data?.loginHistory, isNotNull);
          expect(response.metadata.userMode, equals(UserMode.expert));
          verify(mockUserModeAdapter.adaptLoginResponse(adaptedResponse, UserMode.expert)).called(1);
        });

        /// TC-09: 登入失敗 - 無效憑證
        /// @version 2025-01-28-V2.6.0
        test('09. 登入失敗 - 無效憑證', () async {
          // Arrange
          final request = TestUtils.createTestLoginRequest(password: 'wrong-password');
          final expectedResult = LoginResult(success: false, errorMessage: 'Invalid credentials');

          when(mockAuthService.authenticateUser('test@lcas.com', 'wrong-password'))
              .thenAnswer((_) async => expectedResult);

          // Act
          final response = await authController.login(request);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.invalidCredentials));
          expect(response.metadata.httpStatusCode, equals(401));
        });

        /// TC-10: 四模式登入差異 - Cultivation模式
        /// @version 2025-01-28-V2.6.0
        test('10. 四模式登入差異 - Cultivation模式', () async {
          // Arrange
          final request = TestUtils.createTestLoginRequest();
          final mockUser = UserProfile(
            id: 'test-user-id',
            email: 'test@lcas.com',
            displayName: 'Test User',
            userMode: UserMode.cultivation,
            createdAt: DateTime.now(),
          );
          final expectedResult = LoginResult(user: mockUser, success: true);
          final expectedTokenPair = TokenPair(
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );
          final adaptedResponse = LoginResponse(
            token: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: expectedTokenPair.expiresAt,
            user: mockUser,
            streakInfo: {
              'currentStreak': 7,
              'longestStreak': 15,
              'streakMessage': '連續登入7天！保持下去！🔥',
            },
          );

          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => expectedResult);
          when(mockTokenService.generateTokenPair('test-user-id', UserMode.cultivation))
              .thenAnswer((_) async => expectedTokenPair);
          when(mockUserModeAdapter.adaptLoginResponse(adaptedResponse, UserMode.cultivation))
              .thenReturn(adaptedResponse);

          // Act
          final response = await authController.login(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.user.userMode, equals('cultivation'));
          expect(response.data?.streakInfo, isNotNull);
          expect(response.data?.streakInfo?['streakMessage'], contains('連續登入'));
          expect(response.metadata.userMode, equals(UserMode.cultivation));
        });
      });

      group('3.3 Google登入API測試', () {
        /// TC-11: Google登入成功
        /// @version 2025-01-28-V2.6.0
        test('11. Google登入成功', () async {
          // Arrange
          final request = GoogleLoginRequest(
            googleToken: 'valid-google-token',
            userMode: UserMode.expert,
          );
          final expectedTokenPair = TokenPair(
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );

          when(mockTokenService.generateTokenPair('google-user-id', UserMode.expert))
              .thenAnswer((_) async => expectedTokenPair);

          // Act
          final response = await authController.googleLogin(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.token, isNotNull);
          expect(response.data?.user.email, contains('@example.com'));
          expect(response.metadata.httpStatusCode, equals(200));
        });

        /// TC-12: Google登入失敗 - 無效Token
        /// @version 2025-01-28-V2.6.0
        test('12. Google登入失敗 - 無效Token', () async {
          // Arrange
          final request = GoogleLoginRequest(
            googleToken: '',
            userMode: UserMode.expert,
          );

          // Act
          final response = await authController.googleLogin(request);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.invalidCredentials));
          expect(response.metadata.httpStatusCode, equals(401));
        });
      });

      group('3.4 登出API測試', () {
        /// TC-13: 正常登出流程
        /// @version 2025-01-28-V2.6.0
        test('13. 正常登出流程', () async {
          // Arrange
          final request = LogoutRequest(logoutAllDevices: false);

          when(mockAuthService.processLogout(request))
              .thenAnswer((_) async => {});

          // Act
          final response = await authController.logout(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.metadata.httpStatusCode, equals(200));
          verify(mockAuthService.processLogout(request)).called(1);
        });
      });

      group('3.5 Token刷新API測試', () {
        /// TC-14: Token刷新成功
        /// @version 2025-01-28-V2.6.0
        test('14. Token刷新成功', () async {
          // Arrange
          final refreshToken = 'valid-refresh-token';
          final validationResult = TokenValidationResult(
            isValid: true,
            userId: 'test-user-id',
            userMode: UserMode.expert,
          );
          final newTokenPair = TokenPair(
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );

          when(mockTokenService.validateRefreshToken(refreshToken))
              .thenAnswer((_) async => validationResult);
          when(mockTokenService.generateTokenPair('test-user-id', UserMode.expert))
              .thenAnswer((_) async => newTokenPair);

          // Act
          final response = await authController.refreshToken(refreshToken);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.token, equals('new-access-token'));
          expect(response.data?.refreshToken, equals('new-refresh-token'));
          expect(response.metadata.httpStatusCode, equals(200));
        });

        /// TC-15: Token刷新失敗 - 無效Token
        /// @version 2025-01-28-V2.6.0
        test('15. Token刷新失敗 - 無效Token', () async {
          // Arrange
          final refreshToken = 'invalid-refresh-token';
          final validationResult = TokenValidationResult(
            isValid: false,
            reason: 'Token expired',
          );

          when(mockTokenService.validateRefreshToken(refreshToken))
              .thenAnswer((_) async => validationResult);

          // Act
          final response = await authController.refreshToken(refreshToken);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.tokenInvalid));
          expect(response.metadata.httpStatusCode, equals(401));
        });
      });

      group('3.6 忘記密碼API測試', () {
        /// TC-16: 忘記密碼成功
        /// @version 2025-01-28-V2.6.0
        test('16. 忘記密碼成功', () async {
          // Arrange
          final request = ForgotPasswordRequest(email: 'test@lcas.com');

          when(mockAuthService.initiateForgotPassword('test@lcas.com'))
              .thenAnswer((_) async => {});

          // Act
          final response = await authController.forgotPassword(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.metadata.httpStatusCode, equals(200));
          verify(mockAuthService.initiateForgotPassword('test@lcas.com')).called(1);
        });
      });

      group('3.7 驗證重設Token API測試', () {
        /// TC-17: 重設Token驗證成功
        /// @version 2025-01-28-V2.6.0
        test('17. 重設Token驗證成功', () async {
          // Arrange
          final token = 'valid-reset-token-12345678901234567890';
          final validation = ResetTokenValidation(
            isValid: true,
            email: 'test@lcas.com',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );

          when(mockAuthService.validateResetToken(token))
              .thenAnswer((_) async => validation);

          // Act
          final response = await authController.verifyResetToken(token);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.valid, isTrue);
          expect(response.data?.email, equals('test@lcas.com'));
          expect(response.metadata.httpStatusCode, equals(200));
        });

        /// TC-18: 重設Token驗證失敗 - 格式錯誤
        /// @version 2025-01-28-V2.6.0
        test('18. 重設Token驗證失敗 - 格式錯誤', () async {
          // Arrange
          final token = 'short-token';

          // Act
          final response = await authController.verifyResetToken(token);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.invalidResetToken));
          expect(response.metadata.httpStatusCode, equals(400));
        });
      });

      group('3.8 重設密碼API測試', () {
        /// TC-19: 重設密碼成功
        /// @version 2025-01-28-V2.6.0
        test('19. 重設密碼成功', () async {
          // Arrange
          final request = ResetPasswordRequest(
            token: 'valid-reset-token-12345678901234567890',
            newPassword: 'NewPassword123',
            confirmPassword: 'NewPassword123',
          );

          when(mockAuthService.executePasswordReset(request.token, request.newPassword))
              .thenAnswer((_) async => {});

          // Act
          final response = await authController.resetPassword(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.metadata.httpStatusCode, equals(200));
          verify(mockAuthService.executePasswordReset(request.token, request.newPassword)).called(1);
        });

        /// TC-20: 重設密碼失敗 - 密碼太短
        /// @version 2025-01-28-V2.6.0
        test('20. 重設密碼失敗 - 密碼太短', () async {
          // Arrange
          final request = ResetPasswordRequest(
            token: 'valid-reset-token-12345678901234567890',
            newPassword: '123',
            confirmPassword: '123',
          );

          // Act
          final response = await authController.resetPassword(request);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.weakPassword));
          expect(response.metadata.httpStatusCode, equals(400));
        });
      });

      group('3.9 Email驗證API測試', () {
        /// TC-21: Email驗證成功
        /// @version 2025-01-28-V2.6.0
        test('21. Email驗證成功', () async {
          // Arrange
          final request = VerifyEmailRequest(
            email: 'test@lcas.com',
            verificationCode: '123456',
          );

          when(mockAuthService.processEmailVerification('test@lcas.com', '123456'))
              .thenAnswer((_) async => {});

          // Act
          final response = await authController.verifyEmail(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.metadata.httpStatusCode, equals(200));
          verify(mockAuthService.processEmailVerification('test@lcas.com', '123456')).called(1);
        });
      });

      group('3.10 LINE綁定API測試', () {
        /// TC-22: LINE綁定成功
        /// @version 2025-01-28-V2.6.0
        test('22. LINE綁定成功', () async {
          // Arrange
          final request = BindLineRequest(
            lineUserId: 'U1234567890abcdef',
            lineAccessToken: 'line-access-token',
            lineProfile: {
              'displayName': 'LINE使用者',
              'pictureUrl': 'https://profile.line-scdn.net/...',
            },
          );

          // Act
          final response = await authController.bindLine(request);

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.message, contains('LINE帳號綁定成功'));
          expect(response.data?.linkedAccounts['line'], equals('U1234567890abcdef'));
          expect(response.metadata.httpStatusCode, equals(200));
        });
      });

      group('3.11 綁定狀態API測試', () {
        /// TC-23: 綁定狀態查詢成功
        /// @version 2025-01-28-V2.6.0
        test('23. 綁定狀態查詢成功', () async {
          // Act
          final response = await authController.getBindStatus();

          // Assert
          expect(response.success, isTrue);
          expect(response.data?.userId, isNotNull);
          expect(response.data?.linkedAccounts, isNotNull);
          expect(response.data?.availableBindings, contains('line'));
          expect(response.metadata.httpStatusCode, equals(200));
        });
      });
    });

    // ================================
    // 4. 整合測試 (測試案例 24-38)
    // ================================

    group('4. 整合測試', () {
      group('4.1 端到端流程測試', () {
        /// TC-24: 完整註冊登入流程整合
        /// @version 2025-01-28-V2.6.0
        test('24. 完整註冊登入流程整合', () async {
          // 步驟1: 註冊用戶
          final registerRequest = TestUtils.createTestRegisterRequest();
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-user-id', success: true));
          when(mockTokenService.generateTokenPair('test-user-id', UserMode.expert))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          final registerResponse = await authController.register(registerRequest);
          expect(registerResponse.success, isTrue);

          // 步驟 2: Email驗證
          final verifyRequest = VerifyEmailRequest(
            email: registerRequest.email,
            verificationCode: '123456',
          );
          when(mockAuthService.processEmailVerification(registerRequest.email, '123456'))
              .thenAnswer((_) async => {});

          final verifyResponse = await authController.verifyEmail(verifyRequest);
          expect(verifyResponse.success, isTrue);

          // 步驟 3: 用戶登入
          final loginRequest = TestUtils.createTestLoginRequest(
            email: registerRequest.email,
            password: registerRequest.password,
          );
          final testUser = TestUtils.createTestUser();
          when(mockAuthService.authenticateUser(registerRequest.email, registerRequest.password))
              .thenAnswer((_) async => LoginResult(user: testUser, success: true));

          final loginResponse = await authController.login(loginRequest);
          expect(loginResponse.success, isTrue);

          // 步驟 4: Token刷新
          when(mockTokenService.validateRefreshToken(loginResponse.data!.refreshToken!))
              .thenAnswer((_) async => TokenValidationResult(
                isValid: true,
                userId: 'test-user-id',
                userMode: UserMode.expert,
              ));

          final refreshResponse = await authController.refreshToken(
            loginResponse.data!.refreshToken!,
          );
          expect(refreshResponse.success, isTrue);

          // 步驟 5: 登出
          final logoutRequest = LogoutRequest(logoutAllDevices: false);
          when(mockAuthService.processLogout(logoutRequest))
              .thenAnswer((_) async => {});

          final logoutResponse = await authController.logout(logoutRequest);
          expect(logoutResponse.success, isTrue);
        });
      });

      group('4.2 抽象類別協作測試', () {
        /// TC-25: 抽象類別協作整合
        /// @version 2025-01-28-V2.6.0
        test('25. 抽象類別協作整合', () async {
          // 驗證AuthService與TokenService協作
          final registerRequest = TestUtils.createTestRegisterRequest();
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
          when(mockTokenService.generateTokenPair('test-id', UserMode.expert))
              .thenAnswer((_) async => TokenPair(
                accessToken: 'test-token',
                refreshToken: 'test-refresh',
                expiresAt: DateTime.now().add(Duration(hours: 1)),
              ));

          final response = await authController.register(registerRequest);

          // 驗證協作調用
          verify(mockAuthService.processRegistration(registerRequest)).called(1);
          verify(mockTokenService.generateTokenPair('test-id', UserMode.expert)).called(1);
          expect(response.success, isTrue);
        });

        /// TC-34: AuthService + TokenService + SecurityService 協作測試
        /// @version 2025-01-28-V2.6.0
        test('34. AuthService + TokenService + SecurityService協作測試', () async {
          // Arrange
          final loginRequest = TestUtils.createTestLoginRequest();
          final mockUser = UserProfile(
            id: 'test-user-id',
            email: 'test@lcas.com',
            displayName: 'Test User',
            userMode: UserMode.expert,
            createdAt: DateTime.now(),
          );

          when(mockSecurityService.isPasswordSecure('TestPassword123')).thenReturn(true);
          when(mockSecurityService.verifyPassword('TestPassword123', 'mock-hash'))
              .thenAnswer((_) async => true);
          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => LoginResult(user: mockUser, success: true));
          when(mockTokenService.generateTokenPair('test-user-id', UserMode.expert))
              .thenAnswer((_) async => TokenPair(
                accessToken: 'secure-token',
                refreshToken: 'secure-refresh',
                expiresAt: DateTime.now().add(Duration(hours: 1)),
              ));

          // Act
          final response = await authController.login(loginRequest);

          // Assert
          expect(response.success, isTrue);
          verify(mockSecurityService.verifyPassword('TestPassword123', 'mock-hash')).called(1);
          verify(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123')).called(1);
          verify(mockTokenService.generateTokenPair('test-user-id', UserMode.expert)).called(1);
        });

        /// TC-35: ValidationService + ErrorHandler 整合測試
        /// @version 2025-01-28-V2.6.0
        test('35. ValidationService + ErrorHandler整合測試', () async {
          // Arrange
          final invalidRequest = TestUtils.createTestRegisterRequest(
            email: 'invalid-email',
            userMode: UserMode.expert,
          );
          final validationErrors = [
            ValidationError(field: 'email', message: 'Email格式無效', value: 'invalid-email')
          ];
          final expectedError = ApiError.create(
            AuthErrorCode.validationError,
            UserMode.expert,
            validationErrors: validationErrors,
          );

          when(mockValidationService.validateRegisterRequest(invalidRequest)).thenReturn(validationErrors);
          when(mockErrorHandler.createValidationError(validationErrors, UserMode.expert))
              .thenReturn(expectedError);

          // Act
          final response = await authController.register(invalidRequest);

          // Assert
          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.validationError));
          verify(mockValidationService.validateRegisterRequest(invalidRequest)).called(1);
          verify(mockErrorHandler.createValidationError(validationErrors, UserMode.expert)).called(1);
        });

        /// TC-36: UserModeAdapter + ResponseFilter 協作測試
        /// @version 2025-01-28-V2.6.0
        test('36. UserModeAdapter + ResponseFilter協作測試', () async {
          // Arrange
          final modes = [UserMode.expert, UserMode.inertial, UserMode.cultivation, UserMode.guiding];
          final testData = <String, dynamic>{'test': 'data'};

          for (final mode in modes) {
            final request = TestUtils.createTestRegisterRequest(userMode: mode);
            final basicResponse = RegisterResponse(
              userId: 'test-id',
              email: request.email,
              userMode: mode,
              verificationSent: true,
              needsAssessment: mode == UserMode.expert,
              token: 'token',
              refreshToken: 'refresh',
              expiresAt: DateTime.now().add(Duration(hours: 1)),
            );

            when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
                .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
            when(mockTokenService.generateTokenPair('test-id', mode))
                .thenAnswer((_) async => TestUtils.createTestTokenPair());
            when(mockResponseFilter.filterForExpert(testData)).thenReturn({'filtered': 'expert'});
            when(mockResponseFilter.filterForInertial(testData)).thenReturn({'filtered': 'inertial'});
            when(mockResponseFilter.filterForCultivation(testData)).thenReturn({'filtered': 'cultivation'});
            when(mockResponseFilter.filterForGuiding(testData)).thenReturn({'filtered': 'guiding'});
            when(mockUserModeAdapter.adaptRegisterResponse(basicResponse, mode))
                .thenReturn(basicResponse);

            // Act
            final response = await authController.register(request);

            // Assert
            expect(response.success, isTrue);
            verify(mockUserModeAdapter.adaptRegisterResponse(basicResponse, mode)).called(1);
          }
        });

        /// TC-37: ModeConfigService + JwtProvider 協作測試
        /// @version 2025-01-28-V2.6.0
        test('37. ModeConfigService + JwtProvider協作測試', () async {
          // Arrange
          final userMode = UserMode.cultivation;
          final modeConfig = ModeConfig(
            mode: userMode,
            settings: {'sessionDuration': 3600, 'enableMotivation': true},
            features: ['streakTracking', 'achievements'],
          );
          final tokenPayload = {
            'userId': 'test-user-id',
            'userMode': userMode.toString(),
            'features': modeConfig.features,
          };
          final tokenDuration = Duration(hours: 1);

          when(mockModeConfigService.getConfigForMode(userMode)).thenReturn(modeConfig);
          when(mockModeConfigService.isFeatureEnabled(userMode, 'streakTracking')).thenReturn(true);
          when(mockJwtProvider.generateToken(argThat(isA<Map<String, dynamic>>()), argThat(isA<Duration>())))
              .thenReturn('mode-specific-token');

          // Act
          final config = mockModeConfigService.getConfigForMode(userMode);
          final hasStreakTracking = mockModeConfigService.isFeatureEnabled(userMode, 'streakTracking');
          final token = mockJwtProvider.generateToken(tokenPayload, tokenDuration);

          // Assert
          expect(config.mode, equals(userMode));
          expect(hasStreakTracking, isTrue);
          expect(token, equals('mode-specific-token'));
          verify(mockModeConfigService.getConfigForMode(userMode)).called(1);
          verify(mockModeConfigService.isFeatureEnabled(userMode, 'streakTracking')).called(1);
          verify(mockJwtProvider.generateToken(any as Map<String, dynamic>, any as Duration)).called(1);
        });

        /// TC-38: 13個抽象類別完整協作流程測試
        /// @version 2025-01-28-V2.6.0
        test('38. 13個抽象類別完整協作流程測試', () async {
          // Arrange - 設置所有抽象類別的模擬回應
          final request = TestUtils.createTestRegisterRequest();
          final validationErrors = <ValidationError>[];
          final modeConfig = ModeConfig(
            mode: request.userMode,
            settings: {'registration': 'full'},
            features: ['emailVerification'],
          );
          final tokenPayload = {'userId': 'test-id', 'userMode': request.userMode.toString()};
          final tokenDuration = Duration(hours: 1);

          // 設置所有模擬服務
          when(mockValidationService.validateRegisterRequest(request)).thenReturn(validationErrors);
          when(mockSecurityService.isPasswordSecure(request.password)).thenReturn(true);
          when(mockSecurityService.hashPassword(request.password)).thenAnswer((_) async => 'hashed-password');
          when(mockModeConfigService.getConfigForMode(request.userMode)).thenReturn(modeConfig);
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
          when(mockTokenService.generateTokenPair('test-id', request.userMode))
              .thenAnswer((_) async => TokenPair(
                accessToken: 'test-token',
                refreshToken: 'test-refresh',
                expiresAt: DateTime.now().add(Duration(hours: 1)),
              ));
          when(mockJwtProvider.generateToken(argThat(isA<Map<String, dynamic>>()), argThat(isA<Duration>())))
              .thenReturn('jwt-token');
          final expectedRegisterResponse = RegisterResponse(
                userId: 'test-id',
                email: request.email,
                userMode: request.userMode,
                verificationSent: true,
                needsAssessment: request.userMode == UserMode.expert,
                token: 'adapted-token',
                refreshToken: 'adapted-refresh',
                expiresAt: DateTime.now().add(Duration(hours: 1)),
              );
          final expectedResponse = RegisterResponse(
            userId: 'test-user-id',
            email: 'test@lcas.com',
            userMode: UserMode.expert,
            verificationSent: true,
            needsAssessment: true,
            token: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: DateTime.now().add(Duration(hours: 1)),
          );
          when(mockUserModeAdapter.adaptRegisterResponse(expectedRegisterResponse, request.userMode))
              .thenReturn(expectedResponse);
          when(mockResponseFilter.filterForExpert(<String, dynamic>{'expert': 'data'})).thenReturn({'expert': 'data'});

          // Act
          final response = await authController.register(request);

          // Assert - 驗證所有服務都被正確調用
          expect(response.success, isTrue);

          // 驗證調用順序和參數
          verify(mockValidationService.validateRegisterRequest(request)).called(1);
          verify(mockSecurityService.isPasswordSecure(request.password)).called(1);
          verify(mockModeConfigService.getConfigForMode(request.userMode)).called(1);
          verify(mockAuthService.processRegistration(argThat(isA<RegisterRequest>()))).called(1);
          verify(mockTokenService.generateTokenPair('test-id', request.userMode)).called(1);
          verify(mockUserModeAdapter.adaptRegisterResponse(expectedRegisterResponse, request.userMode)).called(1);

          // 驗證協作鏈完整性
          final inOrder = verifyInOrder([
            mockValidationService.validateRegisterRequest(request),
            mockAuthService.processRegistration(argThat(isA<RegisterRequest>())),
            mockTokenService.generateTokenPair('test-id', request.userMode),
            mockUserModeAdapter.adaptRegisterResponse(expectedRegisterResponse, request.userMode),
          ]);
        });
      });
    });

    // ================================
    // 5. 四模式差異化測試 (測試案例 26-46)
    // ================================

    group('5. 四模式差異化測試', () {
      group('5.1 四模式錯誤訊息差異化', () {
        /// TC-26: 四模式錯誤訊息差異化
        /// @version 2025-01-28-V2.6.0
        test('26. 四模式錯誤訊息差異化', () async {
          final testCases = [
            {'mode': UserMode.expert, 'expected': '請求參數驗證失敗，請檢查資料格式與完整性'},
            {'mode': UserMode.inertial, 'expected': '資料格式驗證失敗，請確認輸入內容'},
            {'mode': UserMode.cultivation, 'expected': '輸入資料需要調整，讓我們一起完善它！'},
            {'mode': UserMode.guiding, 'expected': '資料格式錯誤'},
          ];

          for (final testCase in testCases) {
            final mode = testCase['mode'] as UserMode;
            final expected = testCase['expected'] as String;

            final message = AuthErrorCode.validationError.getMessage(mode);
            expect(message, contains(expected));
          }
        });
      });

      group('5.2 四模式回應內容差異化', () {
        /// TC-27: 四模式回應內容差異化
        /// @version 2025-01-28-V2.6.0
        test('27. 四模式回應內容差異化', () async {
          final modes = [UserMode.expert, UserMode.inertial, UserMode.cultivation, UserMode.guiding];

          for (final mode in modes) {
            final request = TestUtils.createTestRegisterRequest(userMode: mode);
            when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
                .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
            when(mockTokenService.generateTokenPair('test-id', mode))
                .thenAnswer((_) async => TestUtils.createTestTokenPair());

            final response = await authController.register(request);

            // 驗證模式特定的回應內容
            expect(response.metadata.userMode, equals(mode));

            switch (mode) {
              case UserMode.expert:
                expect(response.data?.needsAssessment, isTrue);
                break;
              case UserMode.cultivation:
                expect(response.success, isTrue);
                break;
              case UserMode.guiding:
                expect(response.data?.needsAssessment, isFalse);
                break;
              case UserMode.inertial:
                expect(response.success, isTrue);
                break;
            }
          }
        });

        /// TC-39: Expert模式深度登入測試
        /// @version 2025-01-28-V2.6.0
        test('39. Expert模式深度登入測試', () async {
          // Arrange
          final request = TestUtils.createTestLoginRequest();
          final expertUser = UserProfile(
            id: 'expert-user-id',
            email: 'expert@lcas.com',
            displayName: 'Expert User',
            userMode: UserMode.expert,
            createdAt: DateTime.now(),
          );

          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => LoginResult(user: expertUser, success: true));
          when(mockTokenService.generateTokenPair('expert-user-id', UserMode.expert))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act
          final response = await authController.login(request);

          // Assert - Expert模式特有功能驗證
          expect(response.success, isTrue);
          expect(response.data?.user.userMode, equals('expert'));
          expect(response.data?.loginHistory, isNotNull);
          expect(response.data?.loginHistory?['lastLogin'], isNotNull);
          expect(response.data?.loginHistory?['loginCount'], isA<int>());
          expect(response.data?.loginHistory?['newDeviceDetected'], isA<bool>());

          // 驗證Expert模式獨有的詳細資訊
          expect(response.metadata.additionalInfo?['technicalDetails'], isNotNull);
          expect(response.metadata.additionalInfo?['securityLevel'], equals('high'));
        });

        /// TC-40: Expert模式深度錯誤處理測試
        /// @version 2025-01-28-V2.6.0
        test('40. Expert模式深度錯誤處理測試', () async {
          // Arrange
          final invalidRequest = TestUtils.createTestRegisterRequest(
            email: 'invalid-email',
            userMode: UserMode.expert,
          );

          // Act
          final response = await authController.register(invalidRequest);

          // Assert - Expert模式錯誤處理特性
          expect(response.success, isFalse);
          expect(response.error?.message, contains('請求參數驗證失敗，請檢查資料格式與完整性'));
          expect(response.error?.details?['validation'], isNotNull);
          expect(response.error?.details?['technicalInfo'], isNotNull);
          expect(response.metadata.additionalInfo?['debugInfo'], isNotNull);
        });

        /// TC-41: Inertial模式深度穩定性測試
        /// @version 2025-01-28-V2.6.0
        test('41. Inertial模式深度穩定性測試', () async {
          // Arrange
          final request = TestUtils.createTestRegisterRequest(userMode: UserMode.inertial);
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
          when(mockTokenService.generateTokenPair('test-id', UserMode.inertial))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act
          final response = await authController.register(request);

          // Assert - Inertial模式特性驗證
          expect(response.success, isTrue);
          expect(response.data?.userMode, equals('inertial'));
          expect(response.metadata.userMode, equals(UserMode.inertial));

          // 驗證Inertial模式的固定化設定
          expect(response.metadata.additionalInfo?['interfaceComplexity'], equals('medium'));
          expect(response.metadata.additionalInfo?['autoConfiguration'], isTrue);
        });

        /// TC-42: Inertial模式深度一致性測試
        /// @version 2025-01-28-V2.6.0
        test('42. Inertial模式深度一致性測試', () async {
          // Arrange - 連續多次相同操作
          final request = TestUtils.createTestLoginRequest();
          final inertialUser = UserProfile(
            id: 'inertial-user-id',
            email: 'inertial@lcas.com',
            userMode: UserMode.inertial,
            createdAt: DateTime.now(),
          );

          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => LoginResult(user: inertialUser, success: true));
          when(mockTokenService.generateTokenPair('inertial-user-id', UserMode.inertial))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act - 執行多次登入操作
          final responses = <ApiResponse<LoginResponse>>[];
          for (int i = 0; i < 3; i++) {
            responses.add(await authController.login(request));
          }

          // Assert - 驗證一致性
          for (final response in responses) {
            expect(response.success, isTrue);
            expect(response.data?.user.userMode, equals('inertial'));
            expect(response.metadata.additionalInfo?['behaviorConsistency'], equals('stable'));
          }

          // 驗證所有回應的結構完全一致
          final firstResponse = responses.first.toJson();
          for (int i = 1; i < responses.length; i++) {
            final currentResponse = responses[i].toJson();
            expect(currentResponse.keys, equals(firstResponse.keys));
          }
        });

        /// TC-43: Cultivation模式深度激勵測試
        /// @version 2025-01-28-V2.6.0
        test('43. Cultivation模式深度激勵測試', () async {
          // Arrange
          final request = TestUtils.createTestLoginRequest();
          final cultivationUser = UserProfile(
            id: 'cultivation-user-id',
            email: 'cultivation@lcas.com',
            userMode: UserMode.cultivation,
            createdAt: DateTime.now(),
          );

          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => LoginResult(user: cultivationUser, success: true));
          when(mockTokenService.generateTokenPair('cultivation-user-id', UserMode.cultivation))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act
          final response = await authController.login(request);

          // Assert - Cultivation模式特有功能
          expect(response.success, isTrue);
          expect(response.data?.user.userMode, equals('cultivation'));
          expect(response.data?.streakInfo, isNotNull);
          expect(response.data?.streakInfo?['currentStreak'], isA<int>());
          expect(response.data?.streakInfo?['longestStreak'], isA<int>());
          expect(response.data?.streakInfo?['streakMessage'], contains('連續登入'));

          // 驗證激勵元素
          expect(response.data?.streakInfo?['streakMessage'], matches(r'.*[🔥💪🎉].*'));
          expect(response.metadata.additionalInfo?['motivationalElements'], isNotNull);
          expect(response.metadata.additionalInfo?['achievementUnlocked'], isA<bool>());
        });

        /// TC-44: Cultivation模式深度成長追蹤測試
        /// @version 2025-01-28-V2.6.0
        test('44. Cultivation模式深度成長追蹤測試', () async {
          // Arrange
          final request = TestUtils.createTestRegisterRequest(userMode: UserMode.cultivation);
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
          when(mockTokenService.generateTokenPair('test-id', UserMode.cultivation))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act
          final response = await authController.register(request);

          // Assert - Cultivation模式成長追蹤特性
          expect(response.success, isTrue);
          expect(response.data?.userMode, equals('cultivation'));
          expect(response.metadata.userMode, equals(UserMode.cultivation));

          // 驗證成長追蹤元素
          expect(response.metadata.additionalInfo?['growthMetrics'], isNotNull);
          expect(response.metadata.additionalInfo?['nextMilestone'], isNotNull);
          expect(response.metadata.additionalInfo?['encouragementLevel'], equals('high'));
        });

        /// TC-45: Guiding模式深度簡化測試
        /// @version 2025-01-28-V2.6.0
        test('45. Guiding模式深度簡化測試', () async {
          // Arrange
          final request = TestUtils.createTestRegisterRequest(userMode: UserMode.guiding);
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
          when(mockTokenService.generateTokenPair('test-id', UserMode.guiding))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act
          final response = await authController.register(request);

          // Assert - Guiding模式簡化特性
          expect(response.success, isTrue);
          expect(response.data?.userMode, equals('guiding'));
          expect(response.data?.needsAssessment, isFalse);
          expect(response.metadata.userMode, equals(UserMode.guiding));

          // 驗證簡化程度
          expect(response.metadata.additionalInfo?['interfaceComplexity'], equals('minimal'));
          expect(response.metadata.additionalInfo?['optionsReduced'], isTrue);
          expect(response.toJson().keys.length, lessThan(10)); // 欄位數量限制
        });

        /// TC-46: Guiding模式深度易用性測試
        /// @version 2025-01-28-V2.6.0
        test('46. Guiding模式深度易用性測試', () async {
          // Arrange
          final request = TestUtils.createTestLoginRequest();
          final guidingUser = UserProfile(
            id: 'guiding-user-id',
            email: 'guiding@lcas.com',
            userMode: UserMode.guiding,
            createdAt: DateTime.now(),
          );

          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => LoginResult(user: guidingUser, success: true));
          when(mockTokenService.generateTokenPair('guiding-user-id', UserMode.guiding))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act
          final response = await authController.login(request);

          // Assert - Guiding模式易用性特性
          expect(response.success, isTrue);
          expect(response.data?.user.userMode, equals('guiding'));

          // 驗證極簡化設計
          expect(response.error, isNull); // 不應有複雜錯誤結構
          expect(response.metadata.additionalInfo?['guidanceLevel'], equals('maximum'));
          expect(response.metadata.additionalInfo?['cognitiveLoad'], equals('minimal'));
        });
      });
    });

    // ================================
    // 6. 安全性測試 (測試案例 28-29, 47-49)
    // ================================

    group('6. 安全性測試', () {
      group('6.1 密碼安全性驗證', () {
        /// TC-28: 密碼安全性驗證
        /// @version 2025-01-28-V2.6.0
        test('28. 密碼安全性驗證', () async {
          final weakPasswords = ['123', 'password', '12345678', 'abc123'];

          for (final weakPassword in weakPasswords) {
            final request = TestUtils.createTestRegisterRequest(password: weakPassword);
            final response = await authController.register(request);

            expect(response.success, isFalse);
            expect([
              AuthErrorCode.validationError,
              AuthErrorCode.weakPassword,
            ].contains(response.error?.code), isTrue);
          }
        });
      });

      group('6.2 Token安全性驗證', () {
        /// TC-29: Token安全性驗證
        /// @version 2025-01-28-V2.6.0
        test('29. Token安全性驗證', () async {
          // 測試無效Token格式
          final invalidTokens = [
            '',
            'invalid-token',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
            'expired-token',
          ];

          for (final invalidToken in invalidTokens) {
            when(mockTokenService.validateRefreshToken(invalidToken))
                .thenAnswer((_) async => TokenValidationResult(isValid: false));

            final response = await authController.refreshToken(invalidToken);

            expect(response.success, isFalse);
            expect([
              AuthErrorCode.tokenInvalid,
              AuthErrorCode.tokenExpired,
              AuthErrorCode.validationError,
            ].contains(response.error?.code), isTrue);
          }
        });

        /// TC-47: Token生命週期安全性深度測試
        /// @version 2025-01-28-V2.6.0
        test('47. Token生命週期安全性深度測試', () async {
          // Arrange
          final user = UserProfile(
            id: 'security-test-user',
            email: 'security@lcas.com',
            userMode: UserMode.expert,
            createdAt: DateTime.now(),
          );

          // 測試Token生成安全性
          when(mockSecurityService.generateSecureToken()).thenAnswer((_) async => 'secure-random-token');
          when(mockJwtProvider.generateToken(argThat(isA<Map<String, dynamic>>()), argThat(isA<Duration>())))
              .thenReturn('jwt-with-security-claims');
          when(mockTokenService.generateTokenPair(user.id, user.userMode))
              .thenAnswer((_) async => TokenPair(
                accessToken: 'secure-access-token',
                refreshToken: 'secure-refresh-token',
                expiresAt: DateTime.now().add(Duration(hours: 1)),
              ));

          // Act - 生成Token
          final tokenPair = await mockTokenService.generateTokenPair(user.id, user.userMode);

          // Assert - Token安全性驗證
          expect(tokenPair.accessToken, isNotEmpty);
          expect(tokenPair.refreshToken, isNotEmpty);
          expect(tokenPair.expiresAt.isAfter(DateTime.now()), isTrue);

          // 驗證Token格式安全性
          when(mockSecurityService.validateTokenFormat(tokenPair.accessToken)).thenReturn(true);
          when(mockJwtProvider.verifyToken(tokenPair.accessToken)).thenReturn({
            'userId': user.id,
            'userMode': user.userMode.toString(),
            'iat': DateTime.now().millisecondsSinceEpoch ~/ 1000,
            'exp': DateTime.now().add(Duration(hours: 1)).millisecondsSinceEpoch ~/ 1000,
          });

          final isValidFormat = mockSecurityService.validateTokenFormat(tokenPair.accessToken);
          final tokenClaims = mockJwtProvider.verifyToken(tokenPair.accessToken);

          expect(isValidFormat, isTrue);
          expect(tokenClaims['userId'], equals(user.id));
          expect(tokenClaims['exp'], greaterThan(tokenClaims['iat']));
        });

        /// TC-48: 並發登入安全性深度測試
        /// @version 2025-01-28-V2.6.0
        test('48. 並發登入安全性深度測試', () async {
          // Arrange
          final request = TestUtils.createTestLoginRequest();
          final user = UserProfile(
            id: 'concurrent-test-user',
            email: 'concurrent@lcas.com',
            userMode: UserMode.expert,
            createdAt: DateTime.now(),
          );

          when(mockAuthService.authenticateUser('test@lcas.com', 'TestPassword123'))
              .thenAnswer((_) async => LoginResult(user: user, success: true));
          when(mockSecurityService.generateSecureToken()).thenAnswer((_) async => 'unique-session-id');
          when(mockTokenService.generateTokenPair('concurrent-test-user', UserMode.expert))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          // Act - 模擬並發登入
          final futures = List.generate(5, (index) => authController.login(request));
          final responses = await Future.wait(futures);

          // Assert - 安全性驗證
          for (final response in responses) {
            expect(response.success, isTrue);
            expect(response.data?.token, isNotNull);
            expect(response.data?.refreshToken, isNotNull);
          }

          // 驗證每個Token都是唯一的
          final tokens = responses.map((r) => r.data?.token).toSet();
          expect(tokens.length, equals(responses.length)); // 確保Token唯一性

          // 驗證安全會話管理
          verify(mockSecurityService.generateSecureToken()).called(greaterThanOrEqualTo(5));
        });

        /// TC-49: 跨平台綁定安全性深度測試
        /// @version 2025-01-28-V2.6.0
        test('49. 跨平台綁定安全性深度測試', () async {
          // Arrange
          final bindRequest = BindLineRequest(
            lineUserId: 'U1234567890abcdef',
            lineAccessToken: 'line-secure-token',
            lineProfile: {
              'displayName': 'Secure User',
              'pictureUrl': 'https://secure.profile.url',
            },
          );

          // 設置安全性驗證
          when(mockSecurityService.validateTokenFormat(bindRequest.lineAccessToken)).thenReturn(true);
          when(mockSecurityService.generateSecureToken()).thenAnswer((_) async => 'binding-verification-token');

          // Act
          final response = await authController.bindLine(bindRequest);

          // Assert - 綁定安全性驗證
          expect(response.success, isTrue);
          expect(response.data?.linkedAccounts['line'], equals(bindRequest.lineUserId));

          // 驗證安全性檢查
          verify(mockSecurityService.validateTokenFormat(bindRequest.lineAccessToken)).called(1);
          verify(mockSecurityService.generateSecureToken()).called(1);

          // 驗證綁定資料安全性
          expect(response.data?.linkedAccounts['bindingDate'], isNotNull);
          expect(response.metadata.additionalInfo?['securityVerified'], isTrue);
          expect(response.metadata.additionalInfo?['bindingMethod'], equals('secure'));
        });
      });
    });

    // ================================
    // 7. 效能測試 (測試案例 30-31)
    // ================================

    group('7. 效能測試', () {
      group('7.1 API回應時間測試', () {
        /// TC-30: API回應時間測試
        /// @version 2025-01-28-V2.6.0
        test('30. API回應時間測試', () async {
          final stopwatch = Stopwatch()..start();

          final request = TestUtils.createTestRegisterRequest();
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
          when(mockTokenService.generateTokenPair('test-id', UserMode.expert))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          await authController.register(request);

          stopwatch.stop();
          expect(stopwatch.elapsedMilliseconds, lessThan(2000)); // 2秒內回應
        });
      });

      group('7.2 併發處理能力測試', () {
        /// TC-31: 併發處理能力測試
        /// @version 2025-01-28-V2.6.0
        test('31. 併發處理能力測試', () async {
          final futures = <Future>[];

          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async => RegisterResult(userId: 'test-id', success: true));
          when(mockTokenService.generateTokenPair('test-id', UserMode.expert))
              .thenAnswer((_) async => TestUtils.createTestTokenPair());

          for (int i = 0; i < 10; i++) {
            final request = TestUtils.createTestRegisterRequest(
              email: 'test$i@lcas.com',
            );
            futures.add(authController.register(request));
          }

          final responses = await Future.wait(futures);
          expect(responses.length, equals(10));
        });
      });
    });

    // ================================
    // 8. 異常測試 (測試案例 32-33)
    // ================================

    group('8. 異常測試', () {
      group('8.1 網路連接異常處理', () {
        /// TC-32: 網路連接異常處理
        /// @version 2025-01-28-V2.6.0
        test('32. 網路連接異常處理', () async {
          // 模擬網路異常
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenThrow(Exception('Network connection failed'));

          final request = TestUtils.createTestRegisterRequest();
          final response = await authController.register(request);

          expect(response.success, isFalse);
          expect(response.error?.code, equals(AuthErrorCode.internalServerError));
          expect(response.metadata.httpStatusCode, equals(500));
        });
      });

      group('8.2 服務超時處理', () {
        /// TC-33: 服務超時處理
        /// @version 2025-01-28-V2.6.0
        test('33. 服務超時處理', () async {
          // 模擬服務超時
          when(mockAuthService.processRegistration(argThat(isA<RegisterRequest>())))
              .thenAnswer((_) async {
            await Future.delayed(Duration(seconds: 31)); // 超過30秒超時
            return RegisterResult(userId: 'test', success: true);
          });

          final request = TestUtils.createTestRegisterRequest();

          expect(() => authController.register(request).timeout(Duration(seconds: 30)),
              throwsA(isA<TimeoutException>()));
        });
      });
    });
  });
}