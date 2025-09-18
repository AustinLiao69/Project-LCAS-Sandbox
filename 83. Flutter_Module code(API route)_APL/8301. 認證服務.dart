
/**
 * 8301. 認證服務.dart
 * @module 認證服務模組 - API Gateway
 * @version 2.3.0
 * @description LCAS 2.0 認證服務 API Gateway - 純路由轉發，業務邏輯已移至PL層
 * @date 2025-01-29
 * @update 2025-01-29: 重構為純API Gateway，移除業務邏輯
 */

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;

// ================================
// API Gateway 路由定義
// ================================

/// 認證服務API Gateway
class AuthAPIGateway {
  final String _backendBaseUrl = 'http://localhost:3000/api/v1';
  final http.Client _httpClient = http.Client();

  /**
   * 01. 使用者註冊API路由 (POST /api/v1/auth/register)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> register(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/register',
      requestBody,
    );
  }

  /**
   * 02. 使用者登入API路由 (POST /api/v1/auth/login)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> login(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/login',
      requestBody,
    );
  }

  /**
   * 03. Google登入API路由 (POST /api/v1/auth/google-login)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> googleLogin(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/google-login',
      requestBody,
    );
  }

  /**
   * 04. 使用者登出API路由 (POST /api/v1/auth/logout)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> logout(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/logout',
      requestBody,
    );
  }

  /**
   * 05. 刷新Token API路由 (POST /api/v1/auth/refresh)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> refreshToken(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/refresh',
      requestBody,
    );
  }

  /**
   * 06. 忘記密碼API路由 (POST /api/v1/auth/forgot-password)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> forgotPassword(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/forgot-password',
      requestBody,
    );
  }

  /**
   * 07. 驗證重設Token API路由 (GET /api/v1/auth/verify-reset-token)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> verifyResetToken(String token) async {
    return await _forwardRequest(
      'GET',
      '/auth/verify-reset-token?token=$token',
      null,
    );
  }

  /**
   * 08. 重設密碼API路由 (POST /api/v1/auth/reset-password)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> resetPassword(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/reset-password',
      requestBody,
    );
  }

  /**
   * 09. 驗證Email API路由 (POST /api/v1/auth/verify-email)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> verifyEmail(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/verify-email',
      requestBody,
    );
  }

  /**
   * 10. 綁定LINE帳號API路由 (POST /api/v1/auth/bind-line)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> bindLine(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/auth/bind-line',
      requestBody,
    );
  }

  /**
   * 11. 取得綁定狀態API路由 (GET /api/v1/auth/bind-status)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getBindStatus(String userId) async {
    return await _forwardRequest(
      'GET',
      '/auth/bind-status?userId=$userId',
      null,
    );
  }

  // ================================
  // 私有方法：統一請求轉發機制
  // ================================

  /**
   * 統一請求轉發方法
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway核心轉發邏輯
   */
  Future<http.Response> _forwardRequest(
    String method,
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    try {
      final uri = Uri.parse('$_backendBaseUrl$endpoint');
      final headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      http.Response response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await _httpClient.get(uri, headers: headers);
          break;
        case 'POST':
          response = await _httpClient.post(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'PUT':
          response = await _httpClient.put(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'DELETE':
          response = await _httpClient.delete(uri, headers: headers);
          break;
        default:
          throw Exception('不支援的HTTP方法: $method');
      }

      return response;
    } catch (e) {
      // 返回錯誤回應
      return http.Response(
        json.encode({
          'success': false,
          'error': {
            'code': 'GATEWAY_ERROR',
            'message': '網關轉發失敗: ${e.toString()}',
            'timestamp': DateTime.now().toIso8601String(),
          }
        }),
        500,
        headers: {'content-type': 'application/json'},
      );
    }
  }

  /**
   * 清理資源
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: Gateway資源清理
   */
  void dispose() {
    _httpClient.close();
  }
}

// ================================
// 路由映射表
// ================================

/// API路由映射配置
class AuthRoutes {
  static const Map<String, String> routes = {
    'POST /api/v1/auth/register': '/auth/register',
    'POST /api/v1/auth/login': '/auth/login',
    'POST /api/v1/auth/google-login': '/auth/google-login',
    'POST /api/v1/auth/logout': '/auth/logout',
    'POST /api/v1/auth/refresh': '/auth/refresh',
    'POST /api/v1/auth/forgot-password': '/auth/forgot-password',
    'GET /api/v1/auth/verify-reset-token': '/auth/verify-reset-token',
    'POST /api/v1/auth/reset-password': '/auth/reset-password',
    'POST /api/v1/auth/verify-email': '/auth/verify-email',
    'POST /api/v1/auth/bind-line': '/auth/bind-line',
    'GET /api/v1/auth/bind-status': '/auth/bind-status',
  };
}
