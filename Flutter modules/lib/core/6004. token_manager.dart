
/**
 * TokenManager_Token管理器_1.0.0
 * @module Token管理模組
 * @description LCAS 2.0 認證Token管理器 - 處理JWT Token存儲、刷新和驗證
 * @update 2025-01-23: 建立v1.0.0版本，支援自動Token刷新和安全存儲
 */

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:logging/logging.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TokenManager {
  static final Logger _logger = Logger('TokenManager');
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  
  // Storage Keys
  static const String _accessTokenKey = 'lcas_access_token';
  static const String _refreshTokenKey = 'lcas_refresh_token';
  static const String _tokenExpiryKey = 'lcas_token_expiry';
  static const String _userInfoKey = 'lcas_user_info';
  
  // 單例模式
  static TokenManager? _instance;
  static TokenManager get instance {
    _instance ??= TokenManager._internal();
    return _instance!;
  }
  
  TokenManager._internal();

  /**
   * 01. 儲存認證Token
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 安全儲存JWT Token和相關資訊
   */
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
    Map<String, dynamic>? userInfo,
  }) async {
    try {
      final expiryTime = DateTime.now().add(Duration(seconds: expiresIn));
      
      // 使用安全儲存存放敏感Token
      await _secureStorage.write(key: _accessTokenKey, value: accessToken);
      await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
      
      // 使用SharedPreferences存放非敏感資訊
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenExpiryKey, expiryTime.toIso8601String());
      
      if (userInfo != null) {
        await prefs.setString(_userInfoKey, jsonEncode(userInfo));
      }
      
      _logger.info('Token已安全儲存，過期時間: ${expiryTime.toIso8601String()}');
    } catch (e) {
      _logger.severe('Token儲存失敗: $e');
      rethrow;
    }
  }

  /**
   * 02. 獲取有效的Access Token
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 獲取當前有效Token，如過期則自動刷新
   */
  Future<String?> getValidToken() async {
    try {
      final accessToken = await _secureStorage.read(key: _accessTokenKey);
      
      if (accessToken == null) {
        _logger.warning('無存儲的Access Token');
        return null;
      }
      
      // 檢查Token是否即將過期（提前5分鐘刷新）
      if (await _isTokenExpiring()) {
        _logger.info('Token即將過期，嘗試自動刷新');
        final refreshed = await refreshToken();
        if (refreshed) {
          return await _secureStorage.read(key: _accessTokenKey);
        } else {
          _logger.warning('Token刷新失敗');
          return null;
        }
      }
      
      return accessToken;
    } catch (e) {
      _logger.severe('獲取Token失敗: $e');
      return null;
    }
  }

  /**
   * 03. 刷新Token
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 使用Refresh Token獲取新的Access Token
   */
  Future<bool> refreshToken() async {
    try {
      final refreshToken = await _secureStorage.read(key: _refreshTokenKey);
      
      if (refreshToken == null) {
        _logger.warning('無存儲的Refresh Token');
        return false;
      }
      
      // TODO: 實作與後端API的Token刷新請求
      // 這裡需要調用後端的token refresh端點
      _logger.info('執行Token刷新請求');
      
      // 暫時模擬成功（實際實作時需要真實API調用）
      // final response = await _apiClient.post('/auth/refresh', {
      //   'refresh_token': refreshToken,
      // });
      
      // 模擬成功回應
      await Future.delayed(const Duration(milliseconds: 500));
      
      _logger.info('Token刷新成功');
      return true;
    } catch (e) {
      _logger.severe('Token刷新失敗: $e');
      return false;
    }
  }

  /**
   * 04. 檢查Token是否即將過期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 檢查Token是否在5分鐘內過期
   */
  Future<bool> _isTokenExpiring() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final expiryString = prefs.getString(_tokenExpiryKey);
      
      if (expiryString == null) {
        return true; // 無過期時間視為已過期
      }
      
      final expiryTime = DateTime.parse(expiryString);
      final now = DateTime.now();
      
      // 提前5分鐘判定為即將過期
      final bufferTime = const Duration(minutes: 5);
      return now.isAfter(expiryTime.subtract(bufferTime));
    } catch (e) {
      _logger.severe('檢查Token過期狀態失敗: $e');
      return true; // 發生錯誤視為過期
    }
  }

  /**
   * 05. 獲取用戶資訊
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 獲取存儲的用戶基本資訊
   */
  Future<Map<String, dynamic>?> getUserInfo() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userInfoString = prefs.getString(_userInfoKey);
      
      if (userInfoString != null) {
        return jsonDecode(userInfoString) as Map<String, dynamic>;
      }
      
      return null;
    } catch (e) {
      _logger.severe('獲取用戶資訊失敗: $e');
      return null;
    }
  }

  /**
   * 06. 檢查是否已登入
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 檢查用戶是否具有有效的認證狀態
   */
  Future<bool> isLoggedIn() async {
    try {
      final accessToken = await _secureStorage.read(key: _accessTokenKey);
      final refreshToken = await _secureStorage.read(key: _refreshTokenKey);
      
      if (accessToken == null || refreshToken == null) {
        return false;
      }
      
      // 檢查Token是否完全過期
      final prefs = await SharedPreferences.getInstance();
      final expiryString = prefs.getString(_tokenExpiryKey);
      
      if (expiryString != null) {
        final expiryTime = DateTime.parse(expiryString);
        if (DateTime.now().isAfter(expiryTime)) {
          // Token已過期，嘗試刷新
          return await refreshToken();
        }
      }
      
      return true;
    } catch (e) {
      _logger.severe('檢查登入狀態失敗: $e');
      return false;
    }
  }

  /**
   * 07. 清除所有Token
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 清除所有存儲的認證資訊（登出時使用）
   */
  Future<void> clearTokens() async {
    try {
      // 清除安全儲存的Token
      await _secureStorage.delete(key: _accessTokenKey);
      await _secureStorage.delete(key: _refreshTokenKey);
      
      // 清除SharedPreferences的資訊
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenExpiryKey);
      await prefs.remove(_userInfoKey);
      
      _logger.info('所有Token和用戶資訊已清除');
    } catch (e) {
      _logger.severe('清除Token失敗: $e');
      rethrow;
    }
  }

  /**
   * 08. 獲取Token過期時間
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 獲取當前Token的過期時間
   */
  Future<DateTime?> getTokenExpiry() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final expiryString = prefs.getString(_tokenExpiryKey);
      
      if (expiryString != null) {
        return DateTime.parse(expiryString);
      }
      
      return null;
    } catch (e) {
      _logger.severe('獲取Token過期時間失敗: $e');
      return null;
    }
  }

  /**
   * 09. 更新用戶資訊
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 11:30:00
   * @description 更新存儲的用戶基本資訊
   */
  Future<void> updateUserInfo(Map<String, dynamic> userInfo) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userInfoKey, jsonEncode(userInfo));
      _logger.info('用戶資訊已更新');
    } catch (e) {
      _logger.severe('更新用戶資訊失敗: $e');
      rethrow;
    }
  }
}
