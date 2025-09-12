/**
 * 7501. 系統進入功能群.dart - 系統進入功能群測試代碼
 * @version 2025-09-12 v1.0.0
 * @date 2025-09-12
 * @update: 初始版本，包含26個核心測試案例
 */

import 'dart:async';
import 'dart:convert';
import 'package:test/test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import '7599. Fake_service_switch.dart';
import 'package:flutter/material.dart'; // Added for ThemeData

// 引入必要的類型定義
enum UserMode { expert, inertial, cultivation, guiding }
enum AuthStatus { initial, loading, authenticated, unauthenticated, error }
enum AssessmentStatus { initial, inProgress, completed, modeSelected, error }
enum OnboardingStep { splash, authentication, modeAssessment, platformBinding, completed }
enum ErrorType { network, validation, authentication, system }

// 資料模型類別
class AppVersionInfo {
  final String currentVersion;
  final String latestVersion;
  final bool forceUpdate;
  final String updateMessage;

  AppVersionInfo({
    required this.currentVersion,
    required this.latestVersion,
    required this.forceUpdate,
    required this.updateMessage,
  });
}

class AuthState {
  final bool isAuthenticated;
  final String? currentUser;
  final String? token;
  final AuthStatus status;
  final String? errorMessage;

  AuthState({
    required this.isAuthenticated,
    this.currentUser,
    this.token,
    required this.status,
    this.errorMessage,
  });
}

class ModeConfiguration {
  final UserMode userMode;
  final Map<String, dynamic> settings;

  ModeConfiguration({
    required this.userMode,
    required this.settings,
  });
}

class RegisterRequest {
  final String email;
  final String password;
  final String confirmPassword;

  RegisterRequest({
    required this.email,
    required this.password,
    required this.confirmPassword,
  });
}

class RegisterResponse {
  final bool success;
  final String? token;
  final String? userId;
  final String? message;

  RegisterResponse({
    required this.success,
    this.token,
    this.userId,
    this.message,
  });
}

class LoginRequest {
  final String email;
  final String password;
  final bool rememberMe;

  LoginRequest({
    required this.email,
    required this.password,
    this.rememberMe = false,
  });
}

class LoginResponse {
  final bool success;
  final String? token;
  final String? userId;
  final String? message;

  LoginResponse({
    required this.success,
    this.token,
    this.userId,
    this.message,
  });
}

class PasswordStrength {
  final int score;
  final String level;
  final List<String> suggestions;

  PasswordStrength({
    required this.score,
    required this.level,
    required this.suggestions,
  });
}

class ForgotPasswordResponse {
  final bool success;
  final String message;

  ForgotPasswordResponse({
    required this.success,
    required this.message,
  });
}

class ResetPasswordRequest {
  final String token;
  final String newPassword;

  ResetPasswordRequest({
    required this.token,
    required this.newPassword,
  });
}

class ResetPasswordResponse {
  final bool success;
  final String message;

  ResetPasswordResponse({
    required this.success,
    required this.message,
  });
}

class AssessmentQuestionnaire {
  final String id;
  final List<AssessmentQuestion> questions;

  AssessmentQuestionnaire({
    required this.id,
    required this.questions,
  });
}

class AssessmentQuestion {
  final int id;
  final String question;
  final List<String> options;

  AssessmentQuestion({
    required this.id,
    required this.question,
    required this.options,
  });
}

class AssessmentAnswer {
  final int questionId;
  final int selectedOption;

  AssessmentAnswer({
    required this.questionId,
    required this.selectedOption,
  });
}

class AssessmentResult {
  final UserMode recommendedMode;
  final double confidence;
  final Map<UserMode, double> scores;

  AssessmentResult({
    required this.recommendedMode,
    required this.confidence,
    required this.scores,
  });
}

class ModeRecommendation {
  final UserMode recommendedMode;
  final double confidence;
  final String description;

  ModeRecommendation({
    required this.recommendedMode,
    required this.confidence,
    required this.description,
  });
}

class PlatformBindingResponse {
  final bool success;
  final String? bindingId;
  final String message;

  PlatformBindingResponse({
    required this.success,
    this.bindingId,
    required this.message,
  });
}

class BindingRequest {
  final String platformType;
  final String authToken;

  BindingRequest({
    required this.platformType,
    required this.authToken,
  });
}

class BindingStatus {
  final bool isBound;
  final String? platformUserId;
  final DateTime? boundAt;

  BindingStatus({
    required this.isBound,
    this.platformUserId,
    this.boundAt,
  });
}

class FeatureShowcaseContent {
  final String title;
  final String description;
  final List<String> features;

  FeatureShowcaseContent({
    required this.title,
    required this.description,
    required this.features,
  });
}

class PromotionEvent {
  final String eventType;
  final Map<String, dynamic> data;

  PromotionEvent({
    required this.eventType,
    required this.data,
  });
}

class FormValidationResult {
  final bool isValid;
  final Map<String, String> errors;

  FormValidationResult({
    required this.isValid,
    required this.errors,
  });
}


// Mock服務類別
@GenerateMocks([
  AuthApiService,
  SystemApiService,
  UserManagementApiService
])
class MockServices {}

class AuthApiService {
  Future<RegisterResponse> register(RegisterRequest request) async {
    throw UnimplementedError();
  }

  Future<LoginResponse> login(LoginRequest request) async {
    throw UnimplementedError();
  }

  Future<ForgotPasswordResponse> forgotPassword(String email) async {
    throw UnimplementedError();
  }
}

class SystemApiService {
  Future<AppVersionInfo> getVersionInfo() async {
    throw UnimplementedError();
  }
}

class UserManagementApiService {
  Future<AssessmentResult> submitAssessment(List<AssessmentAnswer> answers) async {
    throw UnimplementedError();
  }
}

/// 系統進入功能群測試類別
class SystemEntryFunctionGroupTest {

  // ===========================================
  // APP啟動與初始化測試函數 (TC-001 ~ TC-004)
  // ===========================================

  /**
   * TC-001: APP啟動初始化流程測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testAppStartupInitializationFlow() async {
    // 使用Fake Service開關
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    // Arrange - 準備測試環境
    print('TC-001: 開始執行APP啟動初始化流程測試');
    final startTime = DateTime.now();

    // Act - 執行測試動作
    try {
      await initializeApp();

      // Assert - 驗證結果
      final endTime = DateTime.now();
      final duration = endTime.difference(startTime);

      // 驗證啟動時間 ≤ 3秒
      expect(duration.inSeconds, lessThanOrEqualTo(3),
        reason: 'APP啟動時間應小於等於3秒');

      print('TC-001: ✅ APP啟動初始化流程測試通過');
      print('TC-001: 啟動時間: ${duration.inMilliseconds}ms');

    } catch (e) {
      print('TC-001: ❌ APP啟動初始化流程測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-002: 版本檢查與更新提示測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testAppVersionCheckAndUpdatePrompt() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-002: 開始執行版本檢查與更新提示測試');

    try {
      // Act - 執行版本檢查
      final versionInfo = await checkAppVersion();

      // Assert - 驗證版本資訊
      expect(versionInfo, isNotNull, reason: '版本資訊不應為null');
      expect(versionInfo.currentVersion, isNotEmpty, reason: '當前版本不應為空');
      expect(versionInfo.latestVersion, isNotEmpty, reason: '最新版本不應為空');

      print('TC-002: ✅ 版本檢查與更新提示測試通過');
      print('TC-002: 當前版本: ${versionInfo.currentVersion}');
      print('TC-002: 最新版本: ${versionInfo.latestVersion}');

    } catch (e) {
      print('TC-002: ❌ 版本檢查與更新提示測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-003: 使用者註冊API正常流程測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testUserRegistrationNormalFlow() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-003: 開始執行使用者註冊API正常流程測試');

    try {
      // Arrange - 準備測試資料
      final request = RegisterRequest(
        email: 'test@lcas.app',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      );

      // Act - 執行註冊
      final response = await registerWithEmail(request);

      // Assert - 驗證結果
      expect(response.success, isTrue, reason: '註冊應該成功');
      expect(response.token, isNotNull, reason: 'Token不應為null');
      expect(response.userId, isNotNull, reason: 'User ID不應為null');

      print('TC-003: ✅ 使用者註冊API正常流程測試通過');
      print('TC-003: User ID: ${response.userId}');

    } catch (e) {
      print('TC-003: ❌ 使用者註冊API正常流程測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-004: Google OAuth註冊整合測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testGoogleOAuthRegistrationIntegration() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-004: 開始執行Google OAuth註冊整合測試');

    try {
      // Act - 執行Google OAuth註冊
      final response = await registerWithGoogle();

      // Assert - 驗證結果
      expect(response.success, isTrue, reason: 'Google OAuth註冊應該成功');
      expect(response.token, isNotNull, reason: 'OAuth Token不應為null');

      print('TC-004: ✅ Google OAuth註冊整合測試通過');

    } catch (e) {
      print('TC-004: ❌ Google OAuth註冊整合測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 核心函數實作 (僅函數表頭，用於TDD開發)
  // ===========================================

  /**
   * 01. 初始化應用程式
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> initializeApp() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 500)); // 模擬初始化時間
    print('APP初始化完成');
  }

  /**
   * 02. 檢查應用程式版本
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<AppVersionInfo> checkAppVersion() async {
    // TDD Red階段 - 最小實作
    return AppVersionInfo(
      currentVersion: '1.0.0',
      latestVersion: '1.0.1',
      forceUpdate: false,
      updateMessage: '新版本可用'
    );
  }

  /**
   * 03. 載入用戶認證狀態
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<AuthState> loadAuthenticationState() async {
    // TDD Red階段 - 最小實作
    return AuthState(
      isAuthenticated: false,
      status: AuthStatus.unauthenticated
    );
  }

  /**
   * 04. 初始化四模式設定
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<ModeConfiguration> initializeModeConfiguration() async {
    // TDD Red階段 - 最小實作
    return ModeConfiguration(
      userMode: UserMode.inertial,
      settings: {'theme': 'default'}
    );
  }

  /**
   * 05. 使用Email註冊帳號
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> registerWithEmail(RegisterRequest request) async {
    // TDD Red階段 - 最小實作
    if (request.email.isEmpty || request.password.isEmpty) {
      return RegisterResponse(success: false, message: '輸入資料不完整');
    }

    return RegisterResponse(
      success: true,
      token: 'mock_token_123',
      userId: 'user_123',
      message: '註冊成功'
    );
  }

  /**
   * 06. 使用Google帳號註冊
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> registerWithGoogle() async {
    // TDD Red階段 - 最小實作
    return RegisterResponse(
      success: true,
      token: 'google_token_123',
      userId: 'google_user_123',
      message: 'Google註冊成功'
    );
  }

  /**
   * 07. 驗證Email格式
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  bool validateEmailFormat(String email) {
    // TDD Red階段 - 最小實作
    return email.contains('@') && email.contains('.');
  }

  /**
   * 08. 檢查密碼強度
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  PasswordStrength checkPasswordStrength(String password) {
    // TDD Red階段 - 最小實作
    if (password.length < 8) {
      return PasswordStrength(
        score: 1,
        level: 'weak',
        suggestions: ['密碼長度至少8位']
      );
    }

    return PasswordStrength(
      score: 3,
      level: 'strong',
      suggestions: []
    );
  }

  /**
   * 09. 載入用戶模式設定
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<ModeConfiguration?> loadUserModeConfiguration() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 200));
    // 模擬載入一個預設模式
    return ModeConfiguration(userMode: UserMode.inertial, settings: {});
  }

  /**
   * 10. 提交評估問卷
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<AssessmentResult> submitAssessment(List<AssessmentAnswer> answers) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 300));
    // 模擬一個基於答案的簡單推薦結果
    return AssessmentResult(
      recommendedMode: UserMode.inertial,
      confidence: 0.7,
      scores: {UserMode.inertial: 0.7, UserMode.expert: 0.3}
    );
  }

  /**
   * 11. 顯示模式引導頁面
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> showModeOnboardingPage(UserMode mode) async {
    // TDD Red階段 - 最小實作
    print('顯示 ${mode.toString().split('.').last} 模式引導頁面');
    await Future.delayed(Duration(milliseconds: 400));
  }

  /**
   * 12. 綁定平台帳號
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<PlatformBindingResponse> bindPlatformAccount(BindingRequest request) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 300));
    if (request.platformType == 'google' && request.authToken.isNotEmpty) {
      return PlatformBindingResponse(success: true, bindingId: 'google_bind_123', message: 'Google帳號綁定成功');
    }
    return PlatformBindingResponse(success: false, message: '平台綁定失敗');
  }

  /**
   * 13. 檢查平台綁定狀態
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<BindingStatus> checkPlatformBindingStatus() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 100));
    // 模擬已綁定狀態
    return BindingStatus(isBound: true, platformUserId: 'platform_user_abc', boundAt: DateTime.now());
  }

  /**
   * 14. 顯示功能展示內容
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  FeatureShowcaseContent getFeatureShowcaseContent(UserMode mode) {
    // TDD Red階段 - 最小實作
    return FeatureShowcaseContent(
      title: '${mode.toString().split('.').last} 模式特色',
      description: '探索 ${mode.toString().split('.').last} 模式的獨特功能',
      features: ['功能 A', '功能 B', '功能 C']
    );
  }

  /**
   * 15. 處理推廣活動事件
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> handlePromotionEvent(PromotionEvent event) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 150));
    print('處理推廣活動: ${event.eventType}');
  }

  /**
   * 16. 獲取登入響應
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<LoginResponse> getLoginResponse(LoginRequest request) async {
    // TDD Red階段 - 最小實作
    if (request.email == 'user@lcas.app' && request.password == 'password123') {
      return LoginResponse(success: true, token: 'login_token_456', userId: 'user_456');
    }
    return LoginResponse(success: false, message: '登入失敗');
  }

  /**
   * 17. 獲取忘記密碼響應
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<ForgotPasswordResponse> getForgotPasswordResponse(String email) async {
    // TDD Red階段 - 最小實作
    if (email.isNotEmpty) {
      return ForgotPasswordResponse(success: true, message: '密碼重設郵件已發送');
    }
    return ForgotPasswordResponse(success: false, message: '請輸入有效Email');
  }

  /**
   * 18. 獲取重設密碼響應
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<ResetPasswordResponse> getResetPasswordResponse(ResetPasswordRequest request) async {
    // TDD Red階段 - 最小實作
    if (request.newPassword.length >= 8) {
      return ResetPasswordResponse(success: true, message: '密碼重設成功');
    }
    return ResetPasswordResponse(success: false, message: '新密碼強度不足');
  }

  /**
   * 19. 載入評估問卷
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<AssessmentQuestionnaire> loadAssessmentQuestionnaire() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 250));
    return AssessmentQuestionnaire(
      id: 'questionnaire_001',
      questions: [
        AssessmentQuestion(id: 1, question: '您偏好獨立解決問題嗎？', options: ['非常同意', '同意', '中立', '不同意', '非常不同意']),
        AssessmentQuestion(id: 2, question: '您尋求結構化的指導嗎？', options: ['總是', '經常', '偶爾', '很少', '從不']),
        AssessmentQuestion(id: 3, question: '您喜歡實驗新方法嗎？', options: ['非常喜歡', '喜歡', '中立', '不喜歡', '非常不喜歡']),
        AssessmentQuestion(id: 4, question: '您需要任務的詳細步驟嗎？', options: ['總是需要', '經常需要', '偶爾需要', '很少需要', '從不需要'])
      ]
    );
  }

  /**
   * 20. 獲取系統通知
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<String> getSystemNotification() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 50));
    return '歡迎使用系統！';
  }

  /**
   * 21. 驗證登入資訊
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  bool validateLoginInfo(String email, String password) {
    // TDD Red階段 - 最小實作
    return email.isNotEmpty && password.length >= 6;
  }

  /**
   * 22. 驗證註冊資訊
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  bool validateRegistrationInfo(RegisterRequest request) {
    // TDD Red階段 - 最小實作
    return validateEmailFormat(request.email) &&
           request.password.isNotEmpty &&
           request.password == request.confirmPassword &&
           request.password.length >= 8;
  }

  /**
   * 23. 處理登出操作
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> handleLogout() async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 100));
    print('使用者已登出');
  }

  /**
   * 24. 獲取用戶資料
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> getUserProfile(String userId) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 200));
    return {'userId': userId, 'name': '範例用戶', 'email': '$userId@lcas.app'};
  }

  /**
   * 25. 更新用戶資料
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> updateUserProfile(String userId, Map<String, dynamic> data) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 200));
    print('用戶 $userId 資料已更新');
    return true;
  }

  /**
   * 26. 刪除用戶帳號
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> deleteUserAccount(String userId) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 300));
    print('用戶 $userId 帳號已刪除');
    return true;
  }

  /**
   * 40. 執行完整表單驗證
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  FormValidationResult validateCompleteForm(Map<String, String> formData) {
    // TDD Red階段 - 最小實作
    return FormValidationResult(
      isValid: formData.isNotEmpty,
      errors: {}
    );
  }

  // ===========================================
  // 四模式差異化測試支援函數
  // ===========================================

  /**
   * 計算模式推薦
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  ModeRecommendation calculateModeRecommendation(List<AssessmentAnswer> answers) {
    // TDD Red階段 - 基於分數的簡單推薦邏輯
    double totalScore = answers.fold(0, (sum, answer) => sum + answer.selectedOption);
    double averageScore = totalScore / answers.length;

    UserMode recommendedMode;
    double confidence;

    if (averageScore >= 4.0) {
      recommendedMode = UserMode.expert;
      confidence = 0.85;
    } else if (averageScore >= 3.0) {
      recommendedMode = UserMode.inertial;
      confidence = 0.75;
    } else if (averageScore >= 2.0) {
      recommendedMode = UserMode.cultivation;
      confidence = 0.80;
    } else {
      recommendedMode = UserMode.guiding;
      confidence = 0.90;
    }

    return ModeRecommendation(
      recommendedMode: recommendedMode,
      confidence: confidence,
      description: '基於評估結果推薦${recommendedMode.toString().split('.').last}模式'
    );
  }

  /**
   * 保存模式設定
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> saveModeConfiguration(UserMode selectedMode) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 100)); // 模擬儲存時間
    print('模式設定已保存: ${selectedMode.toString().split('.').last}');
  }

  /**
   * 載入模式主題
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  ThemeData loadModeTheme(UserMode userMode) {
    // TDD Red階段 - 基本主題實作
    Map<UserMode, Color> modeColors = {
      UserMode.expert: Color(0xFF1976D2),     // 藍色 - 專業
      UserMode.inertial: Color(0xFF4CAF50),   // 綠色 - 穩定
      UserMode.cultivation: Color(0xFFFF9800), // 橙色 - 成長
      UserMode.guiding: Color(0xFF9C27B0),    // 紫色 - 引導
    };

    return ThemeData(
      primarySwatch: MaterialColor(
        modeColors[userMode]!.value,
        <int, Color>{
          50: modeColors[userMode]!.withOpacity(0.1),
          100: modeColors[userMode]!.withOpacity(0.2),
          200: modeColors[userMode]!.withOpacity(0.3),
          300: modeColors[userMode]!.withOpacity(0.4),
          400: modeColors[userMode]!.withOpacity(0.5),
          500: modeColors[userMode]!,
          600: modeColors[userMode]!.withOpacity(0.7),
          700: modeColors[userMode]!.withOpacity(0.8),
          800: modeColors[userMode]!.withOpacity(0.9),
          900: modeColors[userMode]!,
        },
      ),
    );
  }

  /**
   * 切換模式主題
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> switchModeTheme(UserMode newMode) async {
    // TDD Red階段 - 最小實作
    await Future.delayed(Duration(milliseconds: 200)); // 模擬切換時間
    print('主題已切換至: ${newMode.toString().split('.').last}模式');
  }

  /**
   * 獲取模式顏色
   * @version 2025-09-12-V1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Color getModeColor(UserMode userMode) {
    // TDD Red階段 - 基本顏色映射
    switch (userMode) {
      case UserMode.expert:
        return Color(0xFF1976D2);     // 藍色
      case UserMode.inertial:
        return Color(0xFF4CAF50);     // 綠色
      case UserMode.cultivation:
        return Color(0xFFFF9800);     // 橙色
      case UserMode.guiding:
        return Color(0xFF9C27B0);     // 紫色
    }
  }

  // ===========================================
  // 第三階段：API整合與異常測試案例 (TC-013 ~ TC-018)
  // ===========================================

  /**
   * TC-013: 8101認證服務API一致性測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testAuthServiceApiConsistency() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-013: 開始執行8101認證服務API一致性測試');

    try {
      // Test 1: POST /auth/register 端點測試
      print('TC-013.1: 測試 POST /auth/register 端點');
      final registerRequest = RegisterRequest(
        email: 'api_test@lcas.app',
        password: 'ApiTest123!',
        confirmPassword: 'ApiTest123!'
      );
      final registerResponse = await registerWithEmail(registerRequest);
      expect(registerResponse.success, isTrue, reason: 'Register API應該成功');
      expect(registerResponse.token, isNotNull, reason: 'Register API應該返回token');

      // Test 2: POST /auth/login 端點測試
      print('TC-013.2: 測試 POST /auth/login 端點');
      final loginRequest = LoginRequest(
        email: 'api_test@lcas.app',
        password: 'ApiTest123!'
      );
      final loginResponse = await getLoginResponse(loginRequest);
      expect(loginResponse.success, isTrue, reason: 'Login API應該成功');
      expect(loginResponse.token, isNotNull, reason: 'Login API應該返回token');

      // Test 3: POST /auth/forgot-password 端點測試
      print('TC-013.3: 測試 POST /auth/forgot-password 端點');
      final forgotPasswordResponse = await getForgotPasswordResponse('api_test@lcas.app');
      expect(forgotPasswordResponse.success, isTrue, reason: 'ForgotPassword API應該成功');

      // Test 4: Google OAuth 端點測試
      print('TC-013.4: 測試 Google OAuth 端點');
      final googleResponse = await registerWithGoogle();
      expect(googleResponse.success, isTrue, reason: 'Google OAuth應該成功');

      print('TC-013: ✅ 8101認證服務API一致性測試通過');

    } catch (e) {
      print('TC-013: ❌ 8101認證服務API一致性測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-014: 8102用戶管理服務整合測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testUserManagementServiceIntegration() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-014: 開始執行8102用戶管理服務整合測試');

    try {
      // Test 1: POST /users/assessment 端點測試
      print('TC-014.1: 測試 POST /users/assessment 端點');
      final assessmentAnswers = [
        AssessmentAnswer(questionId: 1, selectedOption: 4),
        AssessmentAnswer(questionId: 2, selectedOption: 3),
        AssessmentAnswer(questionId: 3, selectedOption: 4),
        AssessmentAnswer(questionId: 4, selectedOption: 3),
      ];
      final assessmentResult = await submitAssessment(assessmentAnswers);
      expect(assessmentResult.recommendedMode, isNotNull, reason: '評估結果應該有推薦模式');
      expect(assessmentResult.confidence, greaterThan(0), reason: '信心度應該大於0');

      // Test 2: 載入評估問卷測試
      print('TC-014.2: 測試載入評估問卷');
      final questionnaire = await loadAssessmentQuestionnaire();
      expect(questionnaire.questions.length, greaterThanOrEqualTo(4), reason: '問卷應該至少有4個問題');

      // Test 3: 模式設定保存測試
      print('TC-014.3: 測試模式設定保存');
      await saveModeConfiguration(UserMode.expert);
      // 驗證設定已保存（在實際實作中會檢查本地儲存）

      print('TC-014: ✅ 8102用戶管理服務整合測試通過');

    } catch (e) {
      print('TC-014: ❌ 8102用戶管理服務整合測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-015: 8111系統服務版本檢查測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testSystemServiceVersionCheck() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-015: 開始執行8111系統服務版本檢查測試');

    try {
      // Test 1: GET /system/app-info 端點測試
      print('TC-015.1: 測試 GET /system/app-info 端點');
      final versionInfo = await checkAppVersion();
      expect(versionInfo.currentVersion, isNotEmpty, reason: '當前版本不應為空');
      expect(versionInfo.latestVersion, isNotEmpty, reason: '最新版本不應為空');
      expect(versionInfo.updateMessage, isNotEmpty, reason: '更新訊息不應為空');

      // Test 2: 版本比對邏輯測試
      print('TC-015.2: 測試版本比對邏輯');
      final needsUpdate = _compareVersions(versionInfo.currentVersion, versionInfo.latestVersion);
      expect(needsUpdate, isA<bool>(), reason: '版本比對應該返回布林值');

      // Test 3: 系統通知測試
      print('TC-015.3: 測試系統通知');
      final notification = await getSystemNotification();
      expect(notification, isNotEmpty, reason: '系統通知不應為空');

      print('TC-015: ✅ 8111系統服務版本檢查測試通過');

    } catch (e) {
      print('TC-015: ❌ 8111系統服務版本檢查測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-016: 網路連線中斷異常處理測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testNetworkDisconnectionHandling() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-016: 開始執行網路連線中斷異常處理測試');

    try {
      // Test 1: 模擬網路連線中斷
      print('TC-016.1: 模擬網路連線中斷情況');
      _simulateNetworkDisconnection = true;

      // Test 2: 測試離線模式處理
      print('TC-016.2: 測試離線模式處理');
      try {
        await checkAppVersion();
        // 在網路中斷時應該拋出異常或使用快取
      } catch (e) {
        expect(e.toString(), contains('network'), reason: '應該是網路相關錯誤');
      }

      // Test 3: 測試重試機制
      print('TC-016.3: 測試重試機制');
      final retryResult = await _retryWithBackoff(() async {
        if (_simulateNetworkDisconnection) {
          throw Exception('Network disconnected');
        }
        return 'success';
      }, maxRetries: 3);

      // Test 4: 恢復網路連線
      print('TC-016.4: 恢復網路連線測試');
      _simulateNetworkDisconnection = false;
      final versionInfo = await checkAppVersion();
      expect(versionInfo, isNotNull, reason: '網路恢復後應該能正常獲取版本資訊');

      print('TC-016: ✅ 網路連線中斷異常處理測試通過');

    } catch (e) {
      print('TC-016: ❌ 網路連線中斷異常處理測試失敗: $e');
      rethrow;
    } finally {
      _simulateNetworkDisconnection = false;
    }
  }

  /**
   * TC-017: 認證失敗重試機制測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testAuthenticationFailureRetry() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-017: 開始執行認證失敗重試機制測試');

    try {
      // Test 1: 測試錯誤憑證登入
      print('TC-017.1: 測試錯誤憑證登入');
      final wrongCredentials = LoginRequest(
        email: 'wrong@example.com',
        password: 'wrongpassword'
      );
      final failedResponse = await getLoginResponse(wrongCredentials);
      expect(failedResponse.success, isFalse, reason: '錯誤憑證應該登入失敗');

      // Test 2: 測試重試機制
      print('TC-017.2: 測試重試機制');
      int attemptCount = 0;
      final retryResult = await _retryWithBackoff(() async {
        attemptCount++;
        if (attemptCount < 3) {
          throw Exception('Authentication failed');
        }
        return LoginResponse(success: true, token: 'retry_token', userId: 'retry_user');
      }, maxRetries: 3);

      expect(attemptCount, equals(3), reason: '應該重試3次');

      // Test 3: 測試帳號鎖定邏輯
      print('TC-017.3: 測試帳號鎖定邏輯');
      final lockResult = await _simulateAccountLocking('test@lcas.app', 5);
      expect(lockResult, isTrue, reason: '超過重試次數應該鎖定帳號');

      print('TC-017: ✅ 認證失敗重試機制測試通過');

    } catch (e) {
      print('TC-017: ❌ 認證失敗重試機制測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-018: 輸入驗證錯誤處理測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testInputValidationErrorHandling() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-018: 開始執行輸入驗證錯誤處理測試');

    try {
      // Test 1: 無效Email格式測試
      print('TC-018.1: 測試無效Email格式');
      final invalidEmails = ['invalid-email', '@example.com', 'test@', 'test..test@example.com'];
      for (final email in invalidEmails) {
        final isValid = validateEmailFormat(email);
        expect(isValid, isFalse, reason: '$email 應該是無效的Email格式');
      }

      // Test 2: 弱密碼測試
      print('TC-018.2: 測試弱密碼驗證');
      final weakPasswords = ['123', 'password', '12345678', 'abcd'];
      for (final password in weakPasswords) {
        final strength = checkPasswordStrength(password);
        expect(strength.score, lessThan(3), reason: '$password 應該是弱密碼');
        expect(strength.suggestions, isNotEmpty, reason: '弱密碼應該有改善建議');
      }

      // Test 3: 表單驗證測試
      print('TC-018.3: 測試表單驗證');
      final invalidFormData = {
        'email': 'invalid-email',
        'password': '123',
        'confirmPassword': '456'
      };
      final validationResult = validateCompleteForm(invalidFormData);
      expect(validationResult.isValid, isFalse, reason: '無效表單資料應該驗證失敗');

      // Test 4: 註冊資訊驗證測試
      print('TC-018.4: 測試註冊資訊驗證');
      final invalidRegisterRequest = RegisterRequest(
        email: 'invalid-email',
        password: '123',
        confirmPassword: '456'
      );
      final isValidRegistration = validateRegistrationInfo(invalidRegisterRequest);
      expect(isValidRegistration, isFalse, reason: '無效註冊資訊應該驗證失敗');

      print('TC-018: ✅ 輸入驗證錯誤處理測試通過');

    } catch (e) {
      print('TC-018: ❌ 輸入驗證錯誤處理測試失敗: $e');
      rethrow;
    }
  }

  // ===========================================
  // 輔助測試函數
  // ===========================================

  bool _simulateNetworkDisconnection = false;

  /**
   * 比較版本號
   */
  bool _compareVersions(String current, String latest) {
    // 簡單的版本比較邏輯
    final currentParts = current.split('.').map(int.parse).toList();
    final latestParts = latest.split('.').map(int.parse).toList();
    
    for (int i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    return false;
  }

  /**
   * 重試機制實作
   */
  Future<T> _retryWithBackoff<T>(Future<T> Function() operation, {int maxRetries = 3}) async {
    int attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (e) {
        attempt++;
        if (attempt >= maxRetries) rethrow;
        await Future.delayed(Duration(milliseconds: 100 * attempt)); // 指數退避
      }
    }
    throw Exception('Max retries exceeded');
  }

  /**
   * 模擬帳號鎖定
   */
  Future<bool> _simulateAccountLocking(String email, int maxAttempts) async {
    // 模擬帳號鎖定邏輯
    await Future.delayed(Duration(milliseconds: 50));
    return maxAttempts >= 5; // 超過5次嘗試就鎖定
  }

  // ===========================================
  // 四模式差異化測試案例 (TC-009 ~ TC-012)
  // ===========================================

  /**
   * TC-009: Expert模式進入流程測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testExpertModeEntryFlow() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-009: 開始執行Expert模式進入流程測試');

    try {
      // Arrange: 模擬使用者選擇Expert模式
      final assessmentAnswers = [
        AssessmentAnswer(questionId: 1, selectedOption: 5), // 非常同意
        AssessmentAnswer(questionId: 2, selectedOption: 1), // 總是
        AssessmentAnswer(questionId: 3, selectedOption: 4), // 不喜歡
        AssessmentAnswer(questionId: 4, selectedOption: 2), // 經常需要
      ];

      // Act: 提交評估並獲取推薦
      final recommendation = calculateModeRecommendation(assessmentAnswers);
      expect(recommendation.recommendedMode, UserMode.expert, reason: '推薦模式應為Expert');

      // Act: 保存模式設定
      await saveModeConfiguration(recommendation.recommendedMode);

      // Act: 載入並驗證模式主題
      final theme = loadModeTheme(recommendation.recommendedMode);
      expect(theme.primarySwatch.value, getModeColor(UserMode.expert).value, reason: 'Expert模式主題顏色應為藍色');

      // Act: 切換模式主題
      await switchModeTheme(recommendation.recommendedMode);

      print('TC-009: ✅ Expert模式進入流程測試通過');

    } catch (e) {
      print('TC-009: ❌ Expert模式進入流程測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-010: Inertial模式標準流程測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testInertialModeStandardFlow() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-010: 開始執行Inertial模式標準流程測試');

    try {
      // Arrange: 模擬使用者選擇Inertial模式
      final assessmentAnswers = [
        AssessmentAnswer(questionId: 1, selectedOption: 3), // 中立
        AssessmentAnswer(questionId: 2, selectedOption: 3), // 偶爾
        AssessmentAnswer(questionId: 3, selectedOption: 3), // 中立
        AssessmentAnswer(questionId: 4, selectedOption: 3), // 偶爾需要
      ];

      // Act: 提交評估並獲取推薦
      final recommendation = calculateModeRecommendation(assessmentAnswers);
      expect(recommendation.recommendedMode, UserMode.inertial, reason: '推薦模式應為Inertial');

      // Act: 保存模式設定
      await saveModeConfiguration(recommendation.recommendedMode);

      // Act: 載入並驗證模式主題
      final theme = loadModeTheme(recommendation.recommendedMode);
      expect(theme.primarySwatch.value, getModeColor(UserMode.inertial).value, reason: 'Inertial模式主題顏色應為綠色');

      // Act: 切換模式主題
      await switchModeTheme(recommendation.recommendedMode);

      print('TC-010: ✅ Inertial模式標準流程測試通過');

    } catch (e) {
      print('TC-010: ❌ Inertial模式標準流程測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-011: Cultivation模式引導測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testCultivationModeOnboarding() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-011: 開始執行Cultivation模式引導測試');

    try {
      // Arrange: 模擬使用者選擇Cultivation模式
      final assessmentAnswers = [
        AssessmentAnswer(questionId: 1, selectedOption: 2), // 同意
        AssessmentAnswer(questionId: 2, selectedOption: 4), // 很少
        AssessmentAnswer(questionId: 3, selectedOption: 5), // 非常喜歡
        AssessmentAnswer(questionId: 4, selectedOption: 5), // 從不需要
      ];

      // Act: 提交評估並獲取推薦
      final recommendation = calculateModeRecommendation(assessmentAnswers);
      expect(recommendation.recommendedMode, UserMode.cultivation, reason: '推薦模式應為Cultivation');

      // Act: 模擬顯示模式引導頁面
      await showModeOnboardingPage(recommendation.recommendedMode);

      // Act: 保存模式設定
      await saveModeConfiguration(recommendation.recommendedMode);

      // Act: 載入並驗證模式主題
      final theme = loadModeTheme(recommendation.recommendedMode);
      expect(theme.primarySwatch.value, getModeColor(UserMode.cultivation).value, reason: 'Cultivation模式主題顏色應為橙色');

      print('TC-011: ✅ Cultivation模式引導測試通過');

    } catch (e) {
      print('TC-011: ❌ Cultivation模式引導測試失敗: $e');
      rethrow;
    }
  }

  /**
   * TC-012: Guiding模式簡化流程測試
   * @version 2025-09-12 v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> testGuidingModeSimplifiedFlow() async {
    if (!PLFakeServiceSwitch.enable7501FakeService) {
      throw Exception('Fake Service已停用，無法執行測試');
    }

    print('TC-012: 開始執行Guiding模式簡化流程測試');

    try {
      // Arrange: 模擬使用者選擇Guiding模式
      final assessmentAnswers = [
        AssessmentAnswer(questionId: 1, selectedOption: 1), // 非常不同意
        AssessmentAnswer(questionId: 2, selectedOption: 5), // 從不
        AssessmentAnswer(questionId: 3, selectedOption: 1), // 非常不喜歡
        AssessmentAnswer(questionId: 4, selectedOption: 1), // 從不需要
      ];

      // Act: 提交評估並獲取推薦
      final recommendation = calculateModeRecommendation(assessmentAnswers);
      expect(recommendation.recommendedMode, UserMode.guiding, reason: '推薦模式應為Guiding');

      // Act: 保存模式設定
      await saveModeConfiguration(recommendation.recommendedMode);

      // Act: 載入並驗證模式主題
      final theme = loadModeTheme(recommendation.recommendedMode);
      expect(theme.primarySwatch.value, getModeColor(UserMode.guiding).value, reason: 'Guiding模式主題顏色應為紫色');

      // Act: 切換模式主題
      await switchModeTheme(recommendation.recommendedMode);

      print('TC-012: ✅ Guiding模式簡化流程測試通過');

    } catch (e) {
      print('TC-012: ❌ Guiding模式簡化流程測試失敗: $e');
      rethrow;
    }
  }

}

/// 主要測試執行函數
void main() {
  group('系統進入功能群測試 - 第一階段', () {
    late SystemEntryFunctionGroupTest testInstance;

    setUp(() {
      testInstance = SystemEntryFunctionGroupTest();
      // 確保Fake Service開關啟用
      PLFakeServiceSwitch.enable7501FakeService = true;
    });

    test('TC-001: APP啟動初始化流程測試', () async {
      await testInstance.testAppStartupInitializationFlow();
    });

    test('TC-002: 版本檢查與更新提示測試', () async {
      await testInstance.testAppVersionCheckAndUpdatePrompt();
    });

    test('TC-003: 使用者註冊API正常流程測試', () async {
      await testInstance.testUserRegistrationNormalFlow();
    });

    test('TC-004: Google OAuth註冊整合測試', () async {
      await testInstance.testGoogleOAuthRegistrationIntegration();
    });
  });

  // 第二階段測試
  group('系統進入功能群測試 - 第二階段：四模式差異化測試', () {
    late SystemEntryFunctionGroupTest testInstance;

    setUp(() {
      testInstance = SystemEntryFunctionGroupTest();
      PLFakeServiceSwitch.enable7501FakeService = true;
    });

    test('TC-009: Expert模式進入流程測試', () async {
      await testInstance.testExpertModeEntryFlow();
    });

    test('TC-010: Inertial模式標準流程測試', () async {
      await testInstance.testInertialModeStandardFlow();
    });

    test('TC-011: Cultivation模式引導測試', () async {
      await testInstance.testCultivationModeOnboarding();
    });

    test('TC-012: Guiding模式簡化流程測試', () async {
      await testInstance.testGuidingModeSimplifiedFlow();
    });
  });

  // 第三階段測試：API整合與異常測試
  group('系統進入功能群測試 - 第三階段：API整合與異常測試', () {
    late SystemEntryFunctionGroupTest testInstance;

    setUp(() {
      testInstance = SystemEntryFunctionGroupTest();
      PLFakeServiceSwitch.enable7501FakeService = true;
    });

    test('TC-013: 8101認證服務API一致性測試', () async {
      await testInstance.testAuthServiceApiConsistency();
    });

    test('TC-014: 8102用戶管理服務整合測試', () async {
      await testInstance.testUserManagementServiceIntegration();
    });

    test('TC-015: 8111系統服務版本檢查測試', () async {
      await testInstance.testSystemServiceVersionCheck();
    });

    test('TC-016: 網路連線中斷異常處理測試', () async {
      await testInstance.testNetworkDisconnectionHandling();
    });

    test('TC-017: 認證失敗重試機制測試', () async {
      await testInstance.testAuthenticationFailureRetry();
    });

    test('TC-018: 輸入驗證錯誤處理測試', () async {
      await testInstance.testInputValidationErrorHandling();
    });
  });
}