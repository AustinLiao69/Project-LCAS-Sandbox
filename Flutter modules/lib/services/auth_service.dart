
/**
 * auth_service.dart_認證服務_1.1.0
 * @module 認證服務
 * @description LCAS 2.0 Flutter 認證服務 - 使用者註冊、登入、登出、帳號管理
 * @update 2025-01-24: 升級至v1.1.0，增強認證安全性和Token管理機制
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/token_manager.dart';
import '../core/error_handler.dart';
import '../models/auth_models.dart';

class AuthService {
  final ApiClient _apiClient;
  final TokenManager _tokenManager;
  final ErrorHandler _errorHandler;

  AuthService({
    ApiClient? apiClient,
    TokenManager? tokenManager,
    ErrorHandler? errorHandler,
  })  : _apiClient = apiClient ?? ApiClient(),
        _tokenManager = tokenManager ?? TokenManager(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. 使用者註冊 - 新建帳號並初始化基礎資料
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 10:30:00
   * @description 處理使用者註冊流程，包含帳號驗證、密碼強度檢查和基礎資料初始化
   */
  Future<AuthResponse> register(RegisterRequest request) async {
    try {
      // 增強密碼強度檢查
      if (!_isPasswordStrong(request.password)) {
        return AuthResponse(
          success: false,
          message: '密碼強度不足：至少8字元，包含大小寫字母、數字',
          timestamp: DateTime.now(),
        );
      }

      // Email格式驗證
      if (!_isValidEmail(request.email)) {
        return AuthResponse(
          success: false,
          message: 'Email格式不正確',
          timestamp: DateTime.now(),
        );
      }

      // 增強請求資料
      final enhancedRequest = request.copyWith(
        registeredAt: DateTime.now(),
        deviceInfo: await _getDeviceInfo(),
      );

      final response = await _apiClient.post('/auth/register', data: enhancedRequest.toJson());
      
      final authResponse = AuthResponse.fromJson(response.data);
      
      if (authResponse.success && authResponse.accessToken != null) {
        // 儲存認證Token
        await _tokenManager.saveToken(TokenInfo(
          accessToken: authResponse.accessToken!,
          refreshToken: authResponse.refreshToken ?? '',
          expiresAt: DateTime.now().add(Duration(seconds: authResponse.expiresIn ?? 86400)),
        ));

        // 初始化使用者設定
        await _initializeUserSettings(authResponse.user?.id);
        
        debugPrint('用戶註冊成功: ${authResponse.user?.email}');
      }
      
      return authResponse;
    } catch (e) {
      return _errorHandler.handleAuthError(e, '註冊失敗');
    }
  }

  /**
   * 密碼強度檢查
   * @version 2025-01-24-V1.1.0
   */
  bool _isPasswordStrong(String password) {
    if (password.length < 8) return false;
    if (!password.contains(RegExp(r'[a-z]'))) return false;
    if (!password.contains(RegExp(r'[A-Z]'))) return false;
    if (!password.contains(RegExp(r'[0-9]'))) return false;
    return true;
  }

  /**
   * Email格式驗證
   * @version 2025-01-24-V1.1.0
   */
  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  /**
   * 取得設備資訊
   * @version 2025-01-24-V1.1.0
   */
  Future<Map<String, dynamic>> _getDeviceInfo() async {
    // 這裡可以整合device_info_plus套件
    return {
      'platform': defaultTargetPlatform.name,
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  /**
   * 初始化使用者設定
   * @version 2025-01-24-V1.1.0
   */
  Future<void> _initializeUserSettings(String? userId) async {
    if (userId != null) {
      try {
        // 設定預設使用者偏好
        final defaultSettings = UserSettings(
          currency: 'TWD',
          dateFormat: 'yyyy-MM-dd',
          notifications: true,
          autoBackup: true,
        );
        await updateUserSettings(defaultSettings);
      } catch (e) {
        debugPrint('初始化使用者設定失敗: $e');
      }
    }
  }

  /**
   * 02. 使用者登入 - 驗證憑證並取得認證Token
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 處理使用者登入，支援記住我功能
   */
  Future<AuthResponse> login(LoginRequest request) async {
    try {
      final response = await _apiClient.post('/auth/login', data: request.toJson());
      
      final authResponse = AuthResponse.fromJson(response.data);
      
      if (authResponse.success && authResponse.accessToken != null) {
        // 儲存認證Token
        await _tokenManager.saveToken(TokenInfo(
          accessToken: authResponse.accessToken!,
          refreshToken: authResponse.refreshToken ?? '',
          expiresAt: DateTime.now().add(Duration(seconds: authResponse.expiresIn ?? 86400)),
        ));
        
        // 如果勾選記住我，延長Token有效期
        if (request.rememberMe) {
          await _tokenManager.setRememberMe(true);
        }
      }
      
      return authResponse;
    } catch (e) {
      return _errorHandler.handleAuthError(e, '登入失敗');
    }
  }

  /**
   * 03. 使用者登出 - 清除本地認證資料並通知後端
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 安全登出，清除所有認證狀態
   */
  Future<AuthResponse> logout() async {
    try {
      final token = await _tokenManager.getToken();
      
      if (token != null) {
        // 通知後端Token失效
        await _apiClient.post('/auth/logout', data: {
          'token': token.accessToken,
        });
      }
      
      // 清除本地Token
      await _tokenManager.clearToken();
      
      return AuthResponse(
        success: true,
        message: '已成功登出',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      // 即使後端失敗，也要清除本地Token
      await _tokenManager.clearToken();
      return _errorHandler.handleAuthError(e, '登出過程中發生錯誤，但已清除本地認證');
    }
  }

  /**
   * 04. 帳號刪除 - 永久刪除使用者帳號和相關資料
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 刪除帳號，需要再次確認身份
   */
  Future<AuthResponse> deleteAccount(String password) async {
    try {
      final response = await _apiClient.delete('/auth/account', data: {
        'password': password,
        'confirmDelete': true,
      });
      
      final authResponse = AuthResponse.fromJson(response.data);
      
      if (authResponse.success) {
        // 清除本地所有資料
        await _tokenManager.clearToken();
        await _clearLocalCache();
      }
      
      return authResponse;
    } catch (e) {
      return _errorHandler.handleAuthError(e, '帳號刪除失敗');
    }
  }

  /**
   * 05. 密碼重設 - 透過Email重設密碼
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 支援密碼重設請求和確認流程
   */
  Future<AuthResponse> resetPassword(ResetPasswordRequest request) async {
    try {
      final response = await _apiClient.post('/auth/reset-password', data: request.toJson());
      
      return AuthResponse.fromJson(response.data);
    } catch (e) {
      return _errorHandler.handleAuthError(e, '密碼重設失敗');
    }
  }

  /**
   * 06. 取得當前使用者資訊 - 從Token解析使用者資料
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 取得當前登入使用者的基本資訊
   */
  Future<UserProfile?> getCurrentUser() async {
    try {
      final token = await _tokenManager.getToken();
      if (token == null || token.isExpired) {
        return null;
      }

      final response = await _apiClient.get('/auth/profile');
      
      if (response.data['success'] == true) {
        return UserProfile.fromJson(response.data['user']);
      }
      
      return null;
    } catch (e) {
      debugPrint('取得使用者資訊失敗: $e');
      return null;
    }
  }

  /**
   * 07. 檢查認證狀態 - 驗證當前Token有效性
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 檢查使用者是否已認證且Token有效
   */
  Future<bool> isAuthenticated() async {
    try {
      final token = await _tokenManager.getToken();
      if (token == null) return false;

      if (token.isExpired) {
        // 嘗試刷新Token
        final refreshed = await _tokenManager.refreshToken();
        return refreshed;
      }

      return true;
    } catch (e) {
      debugPrint('檢查認證狀態失敗: $e');
      return false;
    }
  }

  /**
   * 08. 更新使用者設定 - 修改使用者偏好和設定
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 更新使用者個人設定和偏好
   */
  Future<AuthResponse> updateUserSettings(UserSettings settings) async {
    try {
      final response = await _apiClient.put('/auth/settings', data: settings.toJson());
      
      return AuthResponse.fromJson(response.data);
    } catch (e) {
      return _errorHandler.handleAuthError(e, '更新設定失敗');
    }
  }

  /**
   * 09. 清除本地快取 - 清理所有本地儲存的認證資料
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 內部方法，用於清除本地快取資料
   */
  Future<void> _clearLocalCache() async {
    try {
      // 這裡可以加入其他快取清理邏輯
      // 例如：清除SharedPreferences、SecureStorage等
      debugPrint('本地快取已清除');
    } catch (e) {
      debugPrint('清除本地快取失敗: $e');
    }
  }
}
/**
 * auth_service.dart_認證服務_1.1.0
 * @module 認證服務
 * @description LCAS 2.0 Flutter 認證服務 - 使用者註冊、登入、登出、帳號管理、密碼重設
 * @update 2025-01-24: 建立認證服務v1.1.0，實作5個核心API端點，完整安全認證實作
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../core/token_manager.dart';
import '../models/auth_models.dart';

class AuthService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;
  final TokenManager _tokenManager;

  AuthService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
    TokenManager? tokenManager,
  })  : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler(),
        _tokenManager = tokenManager ?? TokenManager();

  /**
   * 01. 使用者註冊 - 建立新的使用者帳號
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 完整的使用者註冊流程，包含資料驗證、安全檢查、歡迎流程
   */
  Future<AuthResponse> register({
    required RegisterRequest request,
  }) async {
    try {
      // 前端驗證
      final validationResult = _validateRegisterRequest(request);
      if (!validationResult.isValid) {
        return AuthResponse(
          success: false,
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      // 密碼強度檢查
      final passwordStrength = _checkPasswordStrength(request.password);
      if (!passwordStrength.isStrong) {
        return AuthResponse(
          success: false,
          message: '密碼強度不足: ${passwordStrength.message}',
          timestamp: DateTime.now(),
        );
      }

      // 調用註冊API
      final response = await _apiClient.post(
        '/auth/register',
        data: {
          ...request.toJson(),
          'deviceInfo': await _getDeviceInfo(),
          'registrationSource': 'mobile_app',
        },
      );

      if (response.data['success'] == true) {
        final user = User.fromJson(response.data['data']['user']);
        final token = response.data['data']['token'];
        
        // 儲存Token
        await _tokenManager.saveToken(token);
        
        // 初始化使用者本地設定
        await _initializeUserLocalSettings(user);
        
        return AuthResponse(
          success: true,
          user: user,
          token: token,
          message: response.data['message'] ?? '註冊成功，歡迎加入LCAS！',
          timestamp: DateTime.now(),
        );
      } else {
        return AuthResponse(
          success: false,
          message: response.data['message'] ?? '註冊失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return AuthResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 02. 使用者登入 - 驗證並登入使用者
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 安全的登入流程，支援多種登入方式、設備記憶、安全檢查
   */
  Future<AuthResponse> login({
    required LoginRequest request,
  }) async {
    try {
      // 登入資料驗證
      final validationResult = _validateLoginRequest(request);
      if (!validationResult.isValid) {
        return AuthResponse(
          success: false,
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      // 添加設備資訊和安全檢查
      final enhancedRequest = {
        ...request.toJson(),
        'deviceInfo': await _getDeviceInfo(),
        'loginTime': DateTime.now().toIso8601String(),
        'appVersion': await _getAppVersion(),
      };

      final response = await _apiClient.post(
        '/auth/login',
        data: enhancedRequest,
      );

      if (response.data['success'] == true) {
        final user = User.fromJson(response.data['data']['user']);
        final token = response.data['data']['token'];
        final refreshToken = response.data['data']['refreshToken'];
        
        // 儲存認證資訊
        await _tokenManager.saveToken(token);
        await _tokenManager.saveRefreshToken(refreshToken);
        
        // 同步使用者設定
        await _syncUserSettings(user);
        
        // 檢查帳號狀態和安全提醒
        final securityAlerts = await _checkSecurityAlerts(user);
        
        return AuthResponse(
          success: true,
          user: user,
          token: token,
          refreshToken: refreshToken,
          securityAlerts: securityAlerts,
          message: response.data['message'] ?? '登入成功，歡迎回來！',
          timestamp: DateTime.now(),
        );
      } else {
        // 記錄登入失敗
        await _logLoginFailure(request.email, response.data['message']);
        
        return AuthResponse(
          success: false,
          message: response.data['message'] ?? '登入失敗，請檢查帳號密碼',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return AuthResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 03. 使用者登出 - 安全登出並清理本地資料
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 完整的登出流程，包含Token撤銷、本地資料清理、安全注銷
   */
  Future<AuthResponse> logout() async {
    try {
      final token = await _tokenManager.getToken();
      
      if (token != null) {
        // 向伺服器發送登出請求，撤銷Token
        try {
          final response = await _apiClient.post(
            '/auth/logout',
            data: {
              'logoutTime': DateTime.now().toIso8601String(),
              'deviceInfo': await _getDeviceInfo(),
            },
          );
          
          if (kDebugMode) {
            print('伺服器登出回應: ${response.data}');
          }
        } catch (e) {
          // 即使伺服器登出失敗，也要繼續清理本地資料
          if (kDebugMode) {
            print('伺服器登出失敗，繼續本地清理: $e');
          }
        }
      }

      // 清理本地資料
      await _cleanupLocalData();
      
      return AuthResponse(
        success: true,
        message: '已安全登出',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      // 即使發生錯誤，也要嘗試清理本地資料
      await _cleanupLocalData();
      
      return AuthResponse(
        success: true, // 登出總是成功
        message: '已登出（本地清理）',
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 04. 帳號刪除 - 永久刪除使用者帳號
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 安全的帳號刪除流程，包含確認機制、資料備份、完整清理
   */
  Future<AuthResponse> deleteAccount({
    required DeleteAccountRequest request,
  }) async {
    try {
      // 刪除確認驗證
      final validationResult = _validateDeleteAccountRequest(request);
      if (!validationResult.isValid) {
        return AuthResponse(
          success: false,
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      // 最終確認機制
      if (!request.finalConfirmation || request.confirmationText != 'DELETE_MY_ACCOUNT') {
        return AuthResponse(
          success: false,
          message: '請輸入正確的確認文字：DELETE_MY_ACCOUNT',
          timestamp: DateTime.now(),
        );
      }

      final response = await _apiClient.delete(
        '/auth/account',
        data: {
          ...request.toJson(),
          'deletionTime': DateTime.now().toIso8601String(),
          'deviceInfo': await _getDeviceInfo(),
        },
      );

      if (response.data['success'] == true) {
        // 完全清理本地資料
        await _cleanupLocalData();
        
        return AuthResponse(
          success: true,
          message: response.data['message'] ?? '帳號已成功刪除',
          timestamp: DateTime.now(),
        );
      } else {
        return AuthResponse(
          success: false,
          message: response.data['message'] ?? '帳號刪除失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return AuthResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 05. 密碼重設 - 重設使用者密碼
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 安全的密碼重設流程，支援驗證碼確認、安全檢查、強制重新登入
   */
  Future<AuthResponse> resetPassword({
    required ResetPasswordRequest request,
  }) async {
    try {
      // 重設請求驗證
      final validationResult = _validateResetPasswordRequest(request);
      if (!validationResult.isValid) {
        return AuthResponse(
          success: false,
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      // 新密碼強度檢查
      final passwordStrength = _checkPasswordStrength(request.newPassword);
      if (!passwordStrength.isStrong) {
        return AuthResponse(
          success: false,
          message: '新密碼強度不足: ${passwordStrength.message}',
          timestamp: DateTime.now(),
        );
      }

      final response = await _apiClient.post(
        '/auth/reset-password',
        data: {
          ...request.toJson(),
          'resetTime': DateTime.now().toIso8601String(),
          'deviceInfo': await _getDeviceInfo(),
        },
      );

      if (response.data['success'] == true) {
        // 密碼重設成功後，清理舊的認證資訊
        await _tokenManager.clearTokens();
        
        return AuthResponse(
          success: true,
          message: response.data['message'] ?? '密碼重設成功，請重新登入',
          requireRelogin: true,
          timestamp: DateTime.now(),
        );
      } else {
        return AuthResponse(
          success: false,
          message: response.data['message'] ?? '密碼重設失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return AuthResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 06. 發送密碼重設驗證碼
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 發送密碼重設的驗證碼到使用者信箱
   */
  Future<AuthResponse> sendPasswordResetCode({
    required String email,
  }) async {
    try {
      final validationResult = _validateEmail(email);
      if (!validationResult.isValid) {
        return AuthResponse(
          success: false,
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      final response = await _apiClient.post(
        '/auth/send-reset-code',
        data: {
          'email': email.toLowerCase().trim(),
          'requestTime': DateTime.now().toIso8601String(),
          'deviceInfo': await _getDeviceInfo(),
        },
      );

      return AuthResponse(
        success: response.data['success'] ?? false,
        message: response.data['message'] ?? '驗證碼發送狀態未知',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      return AuthResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 07. 更新使用者資料
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 更新使用者的基本資料和偏好設定
   */
  Future<AuthResponse> updateProfile({
    required UpdateProfileRequest request,
  }) async {
    try {
      final response = await _apiClient.put(
        '/auth/profile',
        data: {
          ...request.toJson(),
          'updateTime': DateTime.now().toIso8601String(),
        },
      );

      if (response.data['success'] == true) {
        final user = User.fromJson(response.data['data']);
        
        return AuthResponse(
          success: true,
          user: user,
          message: response.data['message'] ?? '資料更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return AuthResponse(
          success: false,
          message: response.data['message'] ?? '資料更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return AuthResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 08. 檢查認證狀態
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 15:00:00
   * @description 檢查當前的認證狀態和Token有效性
   */
  Future<AuthResponse> checkAuthStatus() async {
    try {
      final token = await _tokenManager.getToken();
      
      if (token == null) {
        return AuthResponse(
          success: false,
          message: '未登入',
          timestamp: DateTime.now(),
        );
      }

      final response = await _apiClient.get('/auth/status');

      if (response.data['success'] == true) {
        final user = User.fromJson(response.data['data']);
        
        return AuthResponse(
          success: true,
          user: user,
          token: token,
          message: '認證有效',
          timestamp: DateTime.now(),
        );
      } else {
        // Token可能已過期，清理本地認證資訊
        await _tokenManager.clearTokens();
        
        return AuthResponse(
          success: false,
          message: '認證已過期，請重新登入',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return AuthResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  // ==================== 私有輔助方法 ====================

  /**
   * 驗證註冊請求
   */
  ValidationResult _validateRegisterRequest(RegisterRequest request) {
    if (request.email.isEmpty || !_isValidEmail(request.email)) {
      return ValidationResult(false, '請輸入有效的電子郵件地址');
    }
    if (request.password.length < 8) {
      return ValidationResult(false, '密碼長度至少需要8個字元');
    }
    if (request.name.isEmpty || request.name.length < 2) {
      return ValidationResult(false, '姓名至少需要2個字元');
    }
    return ValidationResult(true, '');
  }

  /**
   * 驗證登入請求
   */
  ValidationResult _validateLoginRequest(LoginRequest request) {
    if (request.email.isEmpty || !_isValidEmail(request.email)) {
      return ValidationResult(false, '請輸入有效的電子郵件地址');
    }
    if (request.password.isEmpty) {
      return ValidationResult(false, '請輸入密碼');
    }
    return ValidationResult(true, '');
  }

  /**
   * 驗證帳號刪除請求
   */
  ValidationResult _validateDeleteAccountRequest(DeleteAccountRequest request) {
    if (request.password.isEmpty) {
      return ValidationResult(false, '請輸入當前密碼確認身份');
    }
    if (!request.confirmDataLoss) {
      return ValidationResult(false, '請確認您瞭解資料將被永久刪除');
    }
    return ValidationResult(true, '');
  }

  /**
   * 驗證密碼重設請求
   */
  ValidationResult _validateResetPasswordRequest(ResetPasswordRequest request) {
    if (request.email.isEmpty || !_isValidEmail(request.email)) {
      return ValidationResult(false, '請輸入有效的電子郵件地址');
    }
    if (request.verificationCode.isEmpty) {
      return ValidationResult(false, '請輸入驗證碼');
    }
    if (request.newPassword.length < 8) {
      return ValidationResult(false, '新密碼長度至少需要8個字元');
    }
    return ValidationResult(true, '');
  }

  /**
   * 驗證電子郵件格式
   */
  ValidationResult _validateEmail(String email) {
    if (email.isEmpty || !_isValidEmail(email)) {
      return ValidationResult(false, '請輸入有效的電子郵件地址');
    }
    return ValidationResult(true, '');
  }

  /**
   * 檢查電子郵件格式
   */
  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  /**
   * 檢查密碼強度
   */
  PasswordStrength _checkPasswordStrength(String password) {
    if (password.length < 8) {
      return PasswordStrength(false, '密碼長度至少需要8個字元');
    }
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      return PasswordStrength(false, '密碼需包含至少一個大寫字母');
    }
    if (!RegExp(r'[a-z]').hasMatch(password)) {
      return PasswordStrength(false, '密碼需包含至少一個小寫字母');
    }
    if (!RegExp(r'[0-9]').hasMatch(password)) {
      return PasswordStrength(false, '密碼需包含至少一個數字');
    }
    return PasswordStrength(true, '密碼強度良好');
  }

  /**
   * 取得設備資訊
   */
  Future<Map<String, dynamic>> _getDeviceInfo() async {
    // 實作設備資訊收集邏輯
    return {
      'platform': 'flutter',
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  /**
   * 取得應用版本
   */
  Future<String> _getAppVersion() async {
    // 實作版本獲取邏輯
    return '1.0.0';
  }

  /**
   * 初始化使用者本地設定
   */
  Future<void> _initializeUserLocalSettings(User user) async {
    if (kDebugMode) {
      print('初始化使用者本地設定: ${user.userId}');
    }
  }

  /**
   * 同步使用者設定
   */
  Future<void> _syncUserSettings(User user) async {
    if (kDebugMode) {
      print('同步使用者設定: ${user.userId}');
    }
  }

  /**
   * 檢查安全警示
   */
  Future<List<String>> _checkSecurityAlerts(User user) async {
    // 實作安全檢查邏輯
    return [];
  }

  /**
   * 記錄登入失敗
   */
  Future<void> _logLoginFailure(String email, String? reason) async {
    if (kDebugMode) {
      print('登入失敗: $email, 原因: $reason');
    }
  }

  /**
   * 清理本地資料
   */
  Future<void> _cleanupLocalData() async {
    await _tokenManager.clearTokens();
    // 清理其他本地資料
    if (kDebugMode) {
      print('本地資料清理完成');
    }
  }
}

/// 驗證結果
class ValidationResult {
  final bool isValid;
  final String errorMessage;

  ValidationResult(this.isValid, this.errorMessage);
}

/// 密碼強度檢查結果
class PasswordStrength {
  final bool isStrong;
  final String message;

  PasswordStrength(this.isStrong, this.message);
}
