
/**
 * 8302. 用戶管理服務.dart
 * @module 用戶管理服務 - API Gateway (DCN-0015適配版)
 * @version 3.0.0
 * @description LCAS 2.0 用戶管理服務 API Gateway - 完整支援DCN-0015統一回應格式
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

/// 用戶個人資料模型
class UserProfileData {
  final String userId;
  final String email;
  final String displayName;
  final String userMode;
  final Map<String, dynamic> preferences;
  final Map<String, dynamic> securitySettings;
  final DateTime lastUpdated;

  UserProfileData({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.userMode,
    required this.preferences,
    required this.securitySettings,
    required this.lastUpdated,
  });

  factory UserProfileData.fromJson(Map<String, dynamic> json) {
    return UserProfileData(
      userId: json['userId'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'] ?? '',
      userMode: json['userMode'] ?? 'Inertial',
      preferences: Map<String, dynamic>.from(json['preferences'] ?? {}),
      securitySettings: Map<String, dynamic>.from(json['securitySettings'] ?? {}),
      lastUpdated: DateTime.parse(json['lastUpdated'] ?? DateTime.now().toIso8601String()),
    );
  }
}

/// 模式評估問卷模型
class AssessmentQuestionsData {
  final List<AssessmentQuestion> questions;
  final String assessmentId;
  final String version;

  AssessmentQuestionsData({
    required this.questions,
    required this.assessmentId,
    required this.version,
  });

  factory AssessmentQuestionsData.fromJson(Map<String, dynamic> json) {
    final questionsList = json['questions'] as List? ?? [];
    return AssessmentQuestionsData(
      questions: questionsList.map((q) => AssessmentQuestion.fromJson(q)).toList(),
      assessmentId: json['assessmentId'] ?? '',
      version: json['version'] ?? 'v1.0.0',
    );
  }
}

/// 評估問題模型
class AssessmentQuestion {
  final String questionId;
  final String question;
  final List<String> options;
  final String category;

  AssessmentQuestion({
    required this.questionId,
    required this.question,
    required this.options,
    required this.category,
  });

  factory AssessmentQuestion.fromJson(Map<String, dynamic> json) {
    return AssessmentQuestion(
      questionId: json['questionId'] ?? '',
      question: json['question'] ?? '',
      options: List<String>.from(json['options'] ?? []),
      category: json['category'] ?? '',
    );
  }
}

/// 模式評估結果模型
class AssessmentResultData {
  final String recommendedMode;
  final Map<String, double> modeScores;
  final List<String> recommendations;
  final String confidence;

  AssessmentResultData({
    required this.recommendedMode,
    required this.modeScores,
    required this.recommendations,
    required this.confidence,
  });

  factory AssessmentResultData.fromJson(Map<String, dynamic> json) {
    return AssessmentResultData(
      recommendedMode: json['recommendedMode'] ?? 'Inertial',
      modeScores: Map<String, double>.from(json['modeScores'] ?? {}),
      recommendations: List<String>.from(json['recommendations'] ?? []),
      confidence: json['confidence'] ?? 'medium',
    );
  }
}

/// PIN碼驗證結果模型
class PinVerificationData {
  final bool isValid;
  final int remainingAttempts;
  final bool isLocked;
  final DateTime? lockExpiresAt;

  PinVerificationData({
    required this.isValid,
    required this.remainingAttempts,
    required this.isLocked,
    this.lockExpiresAt,
  });

  factory PinVerificationData.fromJson(Map<String, dynamic> json) {
    return PinVerificationData(
      isValid: json['isValid'] ?? false,
      remainingAttempts: json['remainingAttempts'] ?? 0,
      isLocked: json['isLocked'] ?? false,
      lockExpiresAt: json['lockExpiresAt'] != null 
          ? DateTime.parse(json['lockExpiresAt']) 
          : null,
    );
  }
}

// ================================
// API Gateway 路由定義
// ================================

/// 用戶管理服務API Gateway (DCN-0015適配版)
class UserAPIGateway {
  final String _backendBaseUrl = 'http://0.0.0.0:5000';
  final http.Client _httpClient = http.Client();

  // 回調函數定義
  Function(String)? onShowError;
  Function(String)? onShowHint;
  Function(Map<String, dynamic>)? onUpdateUI;
  Function(String)? onLogError;
  Function()? onRetry;

  UserAPIGateway({
    this.onShowError,
    this.onShowHint,
    this.onUpdateUI,
    this.onLogError,
    this.onRetry,
  });

  /**
   * 01. 取得用戶個人資料API路由 (GET /api/v1/users/profile)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<UserProfileData>> getProfile(String userId) async {
    final response = await _forwardRequest('GET', '/api/v1/users/profile?userId=$userId', null);
    final unifiedResponse = response.toUnifiedResponse<UserProfileData>(
      (data) => UserProfileData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 02. 更新用戶個人資料API路由 (PUT /api/v1/users/profile)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<UserProfileData>> updateProfile(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/users/profile', requestBody);
    final unifiedResponse = response.toUnifiedResponse<UserProfileData>(
      (data) => UserProfileData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 03. 更新用戶偏好設定API路由 (PUT /api/v1/users/preferences)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> updatePreferences(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/users/preferences', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 04. 取得模式評估問卷API路由 (GET /api/v1/users/assessment-questions)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<AssessmentQuestionsData>> getAssessmentQuestions() async {
    final response = await _forwardRequest('GET', '/api/v1/users/assessment-questions', null);
    final unifiedResponse = response.toUnifiedResponse<AssessmentQuestionsData>(
      (data) => AssessmentQuestionsData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 05. 提交模式評估結果API路由 (POST /api/v1/users/assessment)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<AssessmentResultData>> submitAssessment(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/users/assessment', requestBody);
    final unifiedResponse = response.toUnifiedResponse<AssessmentResultData>(
      (data) => AssessmentResultData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 06. 切換用戶模式API路由 (PUT /api/v1/users/mode)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<UserProfileData>> switchUserMode(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/users/mode', requestBody);
    final unifiedResponse = response.toUnifiedResponse<UserProfileData>(
      (data) => UserProfileData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 07. 取得模式預設值API路由 (GET /api/v1/users/mode-defaults)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> getModeDefaults(String mode) async {
    final response = await _forwardRequest('GET', '/api/v1/users/mode-defaults?mode=$mode', null);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 08. 更新安全設定API路由 (PUT /api/v1/users/security)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> updateSecurity(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('PUT', '/api/v1/users/security', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 09. PIN碼驗證API路由 (POST /api/v1/users/verify-pin)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<PinVerificationData>> verifyPin(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/users/verify-pin', requestBody);
    final unifiedResponse = response.toUnifiedResponse<PinVerificationData>(
      (data) => PinVerificationData.fromJson(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 10. 記錄使用行為追蹤API路由 (POST /api/v1/users/behavior-tracking)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<Map<String, dynamic>>> trackBehavior(Map<String, dynamic> requestBody) async {
    final response = await _forwardRequest('POST', '/api/v1/users/behavior-tracking', requestBody);
    final unifiedResponse = response.toUnifiedResponse<Map<String, dynamic>>(
      (data) => Map<String, dynamic>.from(data),
    );

    _handleResponseProcessing(unifiedResponse);
    return unifiedResponse;
  }

  /**
   * 11. 取得模式優化建議API路由 (GET /api/v1/users/mode-recommendations)
   * @version 3.0.0
   * @date 2025-09-24
   * @update: DCN-0015統一回應格式適配
   */
  Future<UnifiedApiResponse<List<Map<String, dynamic>>>> getModeRecommendations(String userId) async {
    final response = await _forwardRequest('GET', '/api/v1/users/mode-recommendations?userId=$userId', null);
    final unifiedResponse = response.toUnifiedResponse<List<Map<String, dynamic>>>(
      (data) => List<Map<String, dynamic>>.from(data),
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

/// 用戶管理API路由映射配置
class UserRoutes {
  static const Map<String, String> routes = {
    'GET /api/v1/users/profile': '/api/v1/users/profile',
    'PUT /api/v1/users/profile': '/api/v1/users/profile',
    'PUT /api/v1/users/preferences': '/api/v1/users/preferences',
    'GET /api/v1/users/assessment-questions': '/api/v1/users/assessment-questions',
    'POST /api/v1/users/assessment': '/api/v1/users/assessment',
    'PUT /api/v1/users/mode': '/api/v1/users/mode',
    'GET /api/v1/users/mode-defaults': '/api/v1/users/mode-defaults',
    'PUT /api/v1/users/security': '/api/v1/users/security',
    'POST /api/v1/users/verify-pin': '/api/v1/users/verify-pin',
    'POST /api/v1/users/behavior-tracking': '/api/v1/users/behavior-tracking',
    'GET /api/v1/users/mode-recommendations': '/api/v1/users/mode-recommendations',
  };
}

// ================================
// 使用範例
// ================================

/// DCN-0015統一回應格式使用範例
class UserGatewayUsageExample {
  late UserAPIGateway userGateway;

  void initializeGateway() {
    userGateway = UserAPIGateway(
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

  Future<void> updateUserProfile(String userId, Map<String, dynamic> updates) async {
    final updateRequest = {
      'userId': userId,
      ...updates,
    };

    final response = await userGateway.updateProfile(updateRequest);

    if (response.isSuccess) {
      final profileData = response.safeData;
      print('個人資料更新成功: ${profileData?.displayName}');
      
      // 根據用戶模式調整反饋
      switch (response.userMode) {
        case UserMode.expert:
          print('個人資料已更新，詳細變更記錄已保存');
          break;
        case UserMode.guiding:
          print('太好了！您的個人資料已成功更新');
          break;
        case UserMode.cultivation:
          print('恭喜！完成個人資料更新，獲得5經驗值');
          break;
        case UserMode.inertial:
        default:
          print('個人資料已更新');
          break;
      }
    } else {
      // 錯誤已由_handleResponseProcessing自動處理
      print('個人資料更新失敗，錯誤已自動處理');
    }
  }
}
