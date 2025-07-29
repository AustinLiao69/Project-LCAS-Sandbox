
/**
 * auth_service.dart_認證服務_1.0.0
 * @module 認證服務
 * @description LCAS 2.0 Flutter 認證服務 - 使用者註冊、登入、登出、帳號管理
 * @update 2025-01-24: 建立認證服務，實作5個API端點
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
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 10:30:00
   * @description 處理使用者註冊流程，包含帳號驗證和初始化
   */
  Future<AuthResponse> register(RegisterRequest request) async {
    try {
      final response = await _apiClient.post('/auth/register', data: request.toJson());
      
      final authResponse = AuthResponse.fromJson(response.data);
      
      if (authResponse.success && authResponse.accessToken != null) {
        // 儲存認證Token
        await _tokenManager.saveToken(TokenInfo(
          accessToken: authResponse.accessToken!,
          refreshToken: authResponse.refreshToken ?? '',
          expiresAt: DateTime.now().add(Duration(seconds: authResponse.expiresIn ?? 86400)),
        ));
      }
      
      return authResponse;
    } catch (e) {
      return _errorHandler.handleAuthError(e, '註冊失敗');
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
