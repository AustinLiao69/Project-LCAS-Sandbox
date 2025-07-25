
/**
 * Token_Manager_1.0.0
 * @module Token管理模組
 * @description LCAS 2.0 身份驗證Token管理
 * @update 2025-01-23: 建立版本，實作安全Token儲存與管理機制
 */

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../utils/logger.dart';

/// 01. Token管理器類別
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 安全管理使用者認證token，包含儲存、驗證、刷新等功能
class TokenManager {
  static const String _accessTokenKey = 'lcas_access_token';
  static const String _refreshTokenKey = 'lcas_refresh_token';
  static const String _userInfoKey = 'lcas_user_info';
  
  final FlutterSecureStorage _secureStorage;
  final AppLogger _logger;
  
  String? _cachedAccessToken;
  String? _cachedRefreshToken;
  Map<String, dynamic>? _cachedUserInfo;

  TokenManager()
      : _secureStorage = const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
          ),
          iOptions: IOSOptions(
            accessibility: KeychainItemAccessibility.first_unlock_this_device,
          ),
        ),
        _logger = AppLogger();

  /// 02. 儲存認證Tokens
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 安全儲存access token和refresh token
  Future<void> saveTokens(String accessToken, String refreshToken) async {
    try {
      await Future.wait([
        _secureStorage.write(key: _accessTokenKey, value: accessToken),
        _secureStorage.write(key: _refreshTokenKey, value: refreshToken),
      ]);
      
      // 更新快取
      _cachedAccessToken = accessToken;
      _cachedRefreshToken = refreshToken;
      
      // 解析並儲存使用者資訊
      await _extractAndSaveUserInfo(accessToken);
      
      _logger.info('Tokens已安全儲存');
    } catch (e) {
      _logger.error('儲存Tokens失敗: $e');
      rethrow;
    }
  }

  /// 03. 取得Access Token
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 取得當前有效的access token
  Future<String?> getAccessToken() async {
    try {
      // 優先使用快取
      if (_cachedAccessToken != null) {
        if (!isTokenExpired(_cachedAccessToken!)) {
          return _cachedAccessToken;
        }
      }
      
      // 從安全儲存讀取
      final token = await _secureStorage.read(key: _accessTokenKey);
      if (token != null && !isTokenExpired(token)) {
        _cachedAccessToken = token;
        return token;
      }
      
      // Token已過期或不存在
      _cachedAccessToken = null;
      return null;
    } catch (e) {
      _logger.error('取得Access Token失敗: $e');
      return null;
    }
  }

  /// 04. 取得Refresh Token
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 取得refresh token用於更新access token
  Future<String?> getRefreshToken() async {
    try {
      // 優先使用快取
      if (_cachedRefreshToken != null) {
        return _cachedRefreshToken;
      }
      
      // 從安全儲存讀取
      final token = await _secureStorage.read(key: _refreshTokenKey);
      _cachedRefreshToken = token;
      return token;
    } catch (e) {
      _logger.error('取得Refresh Token失敗: $e');
      return null;
    }
  }

  /// 05. 檢查Token是否過期
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 驗證JWT token是否已過期
  bool isTokenExpired(String token) {
    try {
      return JwtDecoder.isExpired(token);
    } catch (e) {
      _logger.error('檢查Token過期狀態失敗: $e');
      return true; // 如果無法解析，視為已過期
    }
  }

  /// 06. 取得Token到期時間
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 取得token的到期時間
  DateTime? getTokenExpirationDate(String token) {
    try {
      return JwtDecoder.getExpirationDate(token);
    } catch (e) {
      _logger.error('取得Token到期時間失敗: $e');
      return null;
    }
  }

  /// 07. 檢查是否已登入
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 檢查使用者是否處於已登入狀態
  Future<bool> isLoggedIn() async {
    final accessToken = await getAccessToken();
    return accessToken != null;
  }

  /// 08. 取得使用者資訊
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 從token或儲存中取得使用者基本資訊
  Future<Map<String, dynamic>?> getUserInfo() async {
    try {
      // 優先使用快取
      if (_cachedUserInfo != null) {
        return _cachedUserInfo;
      }
      
      // 從安全儲存讀取
      final userInfoString = await _secureStorage.read(key: _userInfoKey);
      if (userInfoString != null) {
        _cachedUserInfo = jsonDecode(userInfoString);
        return _cachedUserInfo;
      }
      
      // 嘗試從access token解析
      final accessToken = await getAccessToken();
      if (accessToken != null) {
        final userInfo = _extractUserInfoFromToken(accessToken);
        if (userInfo != null) {
          await _saveUserInfo(userInfo);
          return userInfo;
        }
      }
      
      return null;
    } catch (e) {
      _logger.error('取得使用者資訊失敗: $e');
      return null;
    }
  }

  /// 09. 取得使用者ID
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 快速取得當前使用者的唯一識別碼
  Future<String?> getUserId() async {
    final userInfo = await getUserInfo();
    return userInfo?['user_id'] ?? userInfo?['uid'];
  }

  /// 10. 清除所有Tokens
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 清除所有儲存的認證資訊，通常用於登出
  Future<void> clearTokens() async {
    try {
      await Future.wait([
        _secureStorage.delete(key: _accessTokenKey),
        _secureStorage.delete(key: _refreshTokenKey),
        _secureStorage.delete(key: _userInfoKey),
      ]);
      
      // 清除快取
      _cachedAccessToken = null;
      _cachedRefreshToken = null;
      _cachedUserInfo = null;
      
      _logger.info('所有Tokens已清除');
    } catch (e) {
      _logger.error('清除Tokens失敗: $e');
      rethrow;
    }
  }

  /// 11. 從Token解析使用者資訊
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 從JWT token的payload中解析使用者基本資訊
  Map<String, dynamic>? _extractUserInfoFromToken(String token) {
    try {
      final payload = JwtDecoder.decode(token);
      return {
        'user_id': payload['sub'] ?? payload['user_id'],
        'email': payload['email'],
        'display_name': payload['name'] ?? payload['display_name'],
        'user_type': payload['user_type'],
        'platform': payload['platform'],
        'iat': payload['iat'],
        'exp': payload['exp'],
      };
    } catch (e) {
      _logger.error('從Token解析使用者資訊失敗: $e');
      return null;
    }
  }

  /// 12. 解析並儲存使用者資訊
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 從access token解析使用者資訊並儲存
  Future<void> _extractAndSaveUserInfo(String accessToken) async {
    final userInfo = _extractUserInfoFromToken(accessToken);
    if (userInfo != null) {
      await _saveUserInfo(userInfo);
    }
  }

  /// 13. 儲存使用者資訊
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 安全儲存使用者基本資訊
  Future<void> _saveUserInfo(Map<String, dynamic> userInfo) async {
    try {
      final userInfoString = jsonEncode(userInfo);
      await _secureStorage.write(key: _userInfoKey, value: userInfoString);
      _cachedUserInfo = userInfo;
    } catch (e) {
      _logger.error('儲存使用者資訊失敗: $e');
    }
  }

  /// 14. 檢查Token即將過期
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 檢查token是否在指定時間內即將過期（預設5分鐘）
  bool isTokenExpiringSoon(String token, {Duration? threshold}) {
    try {
      final expirationDate = getTokenExpirationDate(token);
      if (expirationDate == null) return true;
      
      final now = DateTime.now();
      final timeUntilExpiry = expirationDate.difference(now);
      final thresholdDuration = threshold ?? const Duration(minutes: 5);
      
      return timeUntilExpiry <= thresholdDuration;
    } catch (e) {
      _logger.error('檢查Token即將過期失敗: $e');
      return true;
    }
  }

  /// 15. 驗證Token格式
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 驗證token是否為有效的JWT格式
  bool isValidTokenFormat(String token) {
    try {
      JwtDecoder.decode(token);
      return true;
    } catch (e) {
      return false;
    }
  }
}
