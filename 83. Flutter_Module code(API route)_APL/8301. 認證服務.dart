
/**
 * 8301. 認證服務.dart
 * @module 認證服務模組 - API Gateway (DCN-0015適配版)
 * @version 3.0.0
 * @description LCAS 2.0 認證服務 API Gateway - 完整支援DCN-0015統一回應格式
 * @date 2025-09-24
 * @update 2025-09-24: DCN-0015第三階段 - 統一回應格式解析適配
 */

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'unified_response_parser.dart';

// ================================
// 資料模型類別定義
// ================================

/// 用戶註冊資料模型
class UserRegistrationData {
  final String userId;
  final String email;
  final String displayName;
  final String userMode;
  final DateTime createdAt;

  UserRegistrationData({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.userMode,
    required this.createdAt,
  });

  factory UserRegistrationData.fromJson(Map<String, dynamic> json) {
    return UserRegistrationData(
      userId: json['userId'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'] ?? '',
      userMode: json['userMode'] ?? 'Inertial',
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

/// 用戶登入資料模型
class UserLoginData {
  final String userId;
  final String email;
  final String displayName;
  final String accessToken;
  final String refreshToken;
  final String userMode;
  final DateTime expiresAt;

  UserLoginData({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.accessToken,
    required this.refreshToken,
    required this.userMode,
    required this.expiresAt,
  });

  factory UserLoginData.fromJson(Map<String, dynamic> json) {
    return UserLoginData(
      userId: json['userId'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'] ?? '',
      accessToken: json['accessToken'] ?? '',
      refreshToken: json['refreshToken'] ?? '',
      userMode: json['userMode'] ?? 'Inertial',
      expiresAt: DateTime.parse(json['expiresAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

/// 綁定狀態資料模型
class BindStatusData {
  final bool isLineBound;
  final bool isGoogleBound;
  final DateTime? lastBindTime;
  final Map<String, dynamic> bindDetails;

  BindStatusData({
    required this.isLineBound,
    required this.isGoogleBound,
    this.lastBindTime,
    required this.bindDetails,
  });

  factory BindStatusData.fromJson(Map<String, dynamic> json) {
    return BindStatusData(
      isLineBound: json['isLineBound'] ?? false,
      isGoogleBound: json['isGoogleBound'] ?? false,
      lastBindTime: json['lastBindTime'] != null 
          ? DateTime.parse(json['lastBindTime']) 
          : null,
      bindDetails: Map<String, dynamic>.from(json['bindDetails'] ?? {}),
    );
  }
}

// ================================
// API Gateway 路由定義
// ================================

/// 認證服務API Gateway (DCN-0015適配版)
class AuthAPIGateway {
  final String _backendBaseUrl = 'http://0.0.0.0:5000';
  final http.Client _httpClient = http.Client();

  // 回調函數定義
  Function(String)? onShowError;
  Function(String)? onShowHint;
  Function(Map<String, dynamic>)? onUpdateUI;
  Function(String)? onLogError;
  Function()? onRetry;

  AuthAPIGateway({
    this.onShowError,
    this.onShowHint,
    this.onUpdateUI,
    this.onLogError,
    this.onRetry,
  });

  /**
   * 01. 使用者註冊API路由 (POST /api/v1/auth/register)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<UserRegistrationData>> register(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/register', requestBody);
    final unifiedResponse = response.toUnifiedResponse<UserRegistrationData>(
      (data) => UserRegistrationData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 02. 使用者登入API路由 (POST /api/v1/auth/login)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<UserLoginData>> login(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/login', requestBody);
    final unifiedResponse = response.toUnifiedResponse<UserLoginData>(
      (data) => UserLoginData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 03. Google登入API路由 (POST /api/v1/auth/google-login)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<UserLoginData>> googleLogin(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/google-login', requestBody);
    final unifiedResponse = response.toUnifiedResponse<UserLoginData>(
      (data) => UserLoginData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 04. 使用者登出API路由 (POST /api/v1/auth/logout)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> logout(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/logout', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 05. 刷新Token API路由 (POST /api/v1/auth/refresh)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<UserLoginData>> refreshToken(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/refresh', requestBody);
    final unifiedResponse = response.toUnifiedResponse<UserLoginData>(
      (data) => UserLoginData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 06. 忘記密碼API路由 (POST /api/v1/auth/forgot-password)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> forgotPassword(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/forgot-password', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 07. 驗證重設Token API路由 (GET /api/v1/auth/verify-reset-token)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> verifyResetToken(String token) async {
    final response = await _forwardRequest('GET', '/api/v1/auth/verify-reset-token?token=$token', null);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 08. 重設密碼API路由 (POST /api/v1/auth/reset-password)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> resetPassword(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/reset-password', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 09. 驗證Email API路由 (POST /api/v1/auth/verify-email)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> verifyEmail(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/verify-email', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 10. 綁定LINE帳號API路由 (POST /api/v1/auth/bind-line)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> bindLine(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/auth/bind-line', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 11. 取得綁定狀態API路由 (GET /api/v1/auth/bind-status)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<BindStatusData>> getBindStatus(String userId) async {
    final response = await _forwardRequest('GET', '/api/v1/auth/bind-status?userId=$userId', null);
    final unifiedResponse = response.toUnifiedResponse<BindStatusData>(
      (data) => BindStatusData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  // ================================
  // 私有方法：統一請求轉發機制
  // ================================

  /**
   * 統一請求轉發方法
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一錯誤處理適配
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
      // 返回DCN-0015格式的錯誤回應
      return http.Response(
        json.encode(_createUnifiedErrorResponse(
          'GATEWAY_ERROR',
          '網關轉發失敗: ${e.toString()}',
        )),
        500,
        headers: {'content-type': 'application/json'},
      );
    }
  }

  /**
   * 建立DCN-0015格式錯誤回應
   * @version 3.0.0
   * @date 2025-09-24
   * @description 確保錯誤回應符合DCN-0015規範
   */
  Map<String, dynamic> _createUnifiedErrorResponse(String errorCode, String errorMessage) {
    return {
      'success': false,
      'data': null,
      'error': {
        'code': errorCode,
        'message': errorMessage,
        'details': {'timestamp': DateTime.now().toIso8601String()},
      },
      'message': errorMessage,
      'metadata': {
        'timestamp': DateTime.now().toIso8601String(),
        'requestId': 'error_${DateTime.now().millisecondsSinceEpoch}',
        'userMode': 'Inertial',
        'apiVersion': 'v1.0.0',
        'processingTimeMs': 0,
        'modeFeatures': {
          'stabilityMode': true,
          'consistentInterface': true,
          'minimalChanges': true,
          'quickActions': true,
          'familiarLayout': true,
        },
      },
    };
  }

  /**
   * 處理回應後的統一邏輯
   * @version 3.0.0
   * @date 2025-09-24
   * @description DCN-0015模式特定處理和錯誤處理
   */
  void _handleResponseProcessing<T>(UnifiedApiResponse<T> response) {
    // 處理錯誤情況
    if (!response.isSuccess && response.safeError != null) {
      UnifiedResponseParser.handleApiError(
        response.safeError!,
        onShowError ?? (message) => print('Error: $message'),
        onLogError ?? (message) => print('Log: $message'),
        onRetry ?? () => print('Retry requested'),
      );
      return;
    }

    // 處理模式特定邏輯
    UnifiedResponseParser.handleModeSpecificLogic(
      response.userMode,
      response.metadata.modeFeatures,
      onShowHint ?? (message) => print('Hint: $message'),
      onUpdateUI ?? (updates) => print('UI Update: $updates'),
    );
  }

  /**
   * 清理資源
   * @version 3.0.0
   * @date 2025-09-24
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
    'POST /api/v1/auth/register': '/api/v1/auth/register',
    'POST /api/v1/auth/login': '/api/v1/auth/login',
    'POST /api/v1/auth/google-login': '/api/v1/auth/google-login',
    'POST /api/v1/auth/logout': '/api/v1/auth/logout',
    'POST /api/v1/auth/refresh': '/api/v1/auth/refresh',
    'POST /api/v1/auth/forgot-password': '/api/v1/auth/forgot-password',
    'GET /api/v1/auth/verify-reset-token': '/api/v1/auth/verify-reset-token',
    'POST /api/v1/auth/reset-password': '/api/v1/auth/reset-password',
    'POST /api/v1/auth/verify-email': '/api/v1/auth/verify-email',
    'POST /api/v1/auth/bind-line': '/api/v1/auth/bind-line',
    'GET /api/v1/auth/bind-status': '/api/v1/auth/bind-status',
  };
}

// ================================
// AuthAPLService 靜態介面（提供給PL層使用）
// ================================

class AuthAPLService {
  static Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    String? displayName,
  }) async {
    try {
      final gateway = AuthAPIGateway();
      final response = await gateway.register({
        'email': email,
        'password': password,
        'displayName': displayName,
      });

      return {
        'success': response.isSuccess,
        'token': response.safeData?.accessToken,
        'userId': response.safeData?.userId,
        'message': response.message,
        'userData': response.safeData != null ? {
          'id': response.safeData!.userId,
          'email': response.safeData!.email,
          'displayName': response.safeData!.displayName,
          'userMode': response.safeData!.userMode,
          'createdAt': response.safeData!.createdAt.toIso8601String(),
        } : null,
      };
    } catch (e) {
      return {
        'success': false,
        'message': '註冊服務暫時無法使用',
      };
    }
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final gateway = AuthAPIGateway();
      final response = await gateway.login({
        'email': email,
        'password': password,
      });

      return {
        'success': response.isSuccess,
        'token': response.safeData?.accessToken,
        'userId': response.safeData?.userId,
        'message': response.message,
        'userData': response.safeData != null ? {
          'id': response.safeData!.userId,
          'email': response.safeData!.email,
          'displayName': response.safeData!.displayName,
          'userMode': response.safeData!.userMode,
        } : null,
      };
    } catch (e) {
      return {
        'success': false,
        'message': '登入服務暫時無法使用',
      };
    }
  }

  static Future<Map<String, dynamic>> googleRegister({
    required String googleToken,
    required String email,
    required String displayName,
    String? avatarUrl,
  }) async {
    try {
      final gateway = AuthAPIGateway();
      final response = await gateway.googleLogin({
        'googleToken': googleToken,
        'email': email,
        'displayName': displayName,
        'avatarUrl': avatarUrl,
      });

      return {
        'success': response.isSuccess,
        'token': response.safeData?.accessToken,
        'userId': response.safeData?.userId,
        'message': response.message,
        'userData': response.safeData != null ? {
          'id': response.safeData!.userId,
          'email': response.safeData!.email,
          'displayName': response.safeData!.displayName,
          'userMode': response.safeData!.userMode,
        } : null,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Google註冊服務暫時無法使用',
      };
    }
  }

  static Future<Map<String, dynamic>> googleLogin({
    required String googleToken,
  }) async {
    try {
      final gateway = AuthAPIGateway();
      final response = await gateway.googleLogin({
        'googleToken': googleToken,
      });

      return {
        'success': response.isSuccess,
        'token': response.safeData?.accessToken,
        'userId': response.safeData?.userId,
        'message': response.message,
        'userData': response.safeData != null ? {
          'id': response.safeData!.userId,
          'email': response.safeData!.email,
          'displayName': response.safeData!.displayName,
          'userMode': response.safeData!.userMode,
        } : null,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Google登入服務暫時無法使用',
      };
    }
  }

  static Future<Map<String, dynamic>> forgotPassword({
    required String email,
  }) async {
    try {
      final gateway = AuthAPIGateway();
      final response = await gateway.forgotPassword({
        'email': email,
      });

      return {
        'success': response.isSuccess,
        'message': response.message,
      };
    } catch (e) {
      return {
        'success': false,
        'message': '忘記密碼服務暫時無法使用',
      };
    }
  }

  static Future<Map<String, dynamic>> validateResetToken({
    required String token,
  }) async {
    try {
      final gateway = AuthAPIGateway();
      final response = await gateway.verifyResetToken(token);

      return {
        'success': response.isSuccess,
        'message': response.message,
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Token驗證服務暫時無法使用',
      };
    }
  }

  static Future<Map<String, dynamic>> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    try {
      final gateway = AuthAPIGateway();
      final response = await gateway.resetPassword({
        'token': token,
        'newPassword': newPassword,
      });

      return {
        'success': response.isSuccess,
        'message': response.message,
      };
    } catch (e) {
      return {
        'success': false,
        'message': '密碼重設服務暫時無法使用',
      };
    }
  }
}

// ================================
// 使用範例
// ================================

/// DCN-0015統一回應格式使用範例
class AuthGatewayUsageExample {
  late AuthAPIGateway authGateway;

  void initializeGateway() {
    authGateway = AuthAPIGateway(
      onShowError: (message) {
        // 顯示錯誤訊息給使用者
        print('顯示錯誤: $message');
      },
      onShowHint: (message) {
        // 顯示提示訊息
        print('顯示提示: $message');
      },
      onUpdateUI: (updates) {
        // 更新UI狀態
        print('更新UI: $updates');
      },
      onLogError: (message) {
        // 記錄錯誤日誌
        print('錯誤日誌: $message');
      },
      onRetry: () {
        // 重試邏輯
        print('執行重試');
      },
    );
  }

  Future<void> performLogin(String email, String password) async {
    final loginRequest = {
      'email': email,
      'password': password,
    };

    final response = await authGateway.login(loginRequest);

    if (response.isSuccess) {
      final loginData = response.safeData;
      print('登入成功: ${loginData?.displayName}');
      
      // 根據用戶模式調整UI
      switch (response.userMode) {
        case UserMode.expert:
          print('啟用專家模式界面');
          break;
        case UserMode.guiding:
          print('啟用引導模式界面');
          break;
        case UserMode.cultivation:
          print('啟用培養模式界面');
          break;
        case UserMode.inertial:
        default:
          print('啟用穩定模式界面');
          break;
      }
    } else {
      // 錯誤已由_handleResponseProcessing自動處理
      print('登入失敗，錯誤已自動處理');
    }
  }
}
