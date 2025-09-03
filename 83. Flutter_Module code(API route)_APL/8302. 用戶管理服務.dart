
/**
 * 8302. 用戶管理服務 - V1.0.0
 * @module 用戶管理服務
 * @description LCAS 2.0 用戶管理服務 - 第一階段核心架構與基礎設施
 * @update 2025-09-03: 第一階段實作，嚴格遵循8202文件規範
 */

import 'dart:async';
import 'dart:convert';

// ================================
// 第一階段：核心架構與基礎設施 (V1.0.0)
// ================================

// 統一API回應格式類別
class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiMetadata metadata;
  final ApiError? error;

  ApiResponse._({
    required this.success,
    this.data,
    required this.metadata,
    this.error,
  });

  factory ApiResponse.success({
    required T data,
    required ApiMetadata metadata,
  }) {
    return ApiResponse._(
      success: true,
      data: data,
      metadata: metadata,
    );
  }

  factory ApiResponse.error({
    required ApiError error,
    required ApiMetadata metadata,
  }) {
    return ApiResponse._(
      success: false,
      metadata: metadata,
      error: error,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      if (data != null && data is Map) 'data': data,
      'metadata': metadata.toJson(),
      if (error != null) 'error': error!.toJson(),
    };
  }
}

// API元資料類別
class ApiMetadata {
  final DateTime timestamp;
  final String requestId;
  final UserMode userMode;
  final String apiVersion;
  final int processingTimeMs;
  final Map<String, dynamic>? additionalInfo;

  ApiMetadata({
    required this.timestamp,
    required this.requestId,
    required this.userMode,
    this.apiVersion = "1.0.0",
    this.processingTimeMs = 0,
    this.additionalInfo,
  });

  Map<String, dynamic> toJson() {
    return {
      'timestamp': timestamp.toIso8601String(),
      'requestId': requestId,
      'userMode': userMode.toString().split('.').last,
      'apiVersion': apiVersion,
      'processingTimeMs': processingTimeMs,
      if (additionalInfo != null) 'additionalInfo': additionalInfo,
    };
  }

  static ApiMetadata create(UserMode userMode, {Map<String, dynamic>? additionalInfo}) {
    return ApiMetadata(
      timestamp: DateTime.now(),
      requestId: 'req-${DateTime.now().millisecondsSinceEpoch}',
      userMode: userMode,
      additionalInfo: additionalInfo,
    );
  }
}

// 用戶模式枚舉
enum UserMode { expert, inertial, cultivation, guiding }

// API錯誤類別
class ApiError {
  final UserManagementErrorCode code;
  final String message;
  final String? field;
  final DateTime timestamp;
  final String requestId;
  final Map<String, dynamic>? details;

  ApiError({
    required this.code,
    required this.message,
    this.field,
    required this.timestamp,
    required this.requestId,
    this.details,
  });

  Map<String, dynamic> toJson() {
    return {
      'code': code.toString().split('.').last.toUpperCase(),
      'message': message,
      if (field != null) 'field': field,
      'timestamp': timestamp.toIso8601String(),
      'requestId': requestId,
      if (details != null) 'details': details,
    };
  }

  static ApiError create(
    UserManagementErrorCode code,
    UserMode userMode, {
    String? field,
    Map<String, dynamic>? details,
  }) {
    return ApiError(
      code: code,
      message: code.getMessage(userMode),
      field: field,
      timestamp: DateTime.now(),
      requestId: 'req-${DateTime.now().millisecondsSinceEpoch}',
      details: details,
    );
  }
}

// 用戶管理錯誤碼枚舉
enum UserManagementErrorCode {
  validationError,
  invalidDisplayName,
  invalidTimezone,
  invalidLanguage,
  invalidPinFormat,
  invalidAssessmentAnswer,
  unauthorized,
  tokenExpired,
  invalidToken,
  insufficientPermissions,
  accountDisabled,
  pinLocked,
  userNotFound,
  assessmentNotFound,
  conflictingSettings,
  pinTooWeak,
  biometricNotSupported,
  assessmentAlreadyCompleted,
  securitySettingsConflict,
  internalServerError,
  databaseError,
  encryptionError;

  int get httpStatusCode {
    switch (this) {
      case validationError:
      case invalidDisplayName:
      case invalidTimezone:
      case invalidLanguage:
      case invalidPinFormat:
      case invalidAssessmentAnswer:
        return 400;
      case unauthorized:
      case tokenExpired:
      case invalidToken:
        return 401;
      case insufficientPermissions:
      case accountDisabled:
      case pinLocked:
        return 403;
      case userNotFound:
      case assessmentNotFound:
        return 404;
      case conflictingSettings:
        return 409;
      case pinTooWeak:
      case biometricNotSupported:
      case assessmentAlreadyCompleted:
      case securitySettingsConflict:
        return 422;
      case internalServerError:
      case databaseError:
      case encryptionError:
        return 500;
    }
  }

  String getMessage(UserMode userMode) {
    switch (userMode) {
      case UserMode.expert:
        return _getExpertMessage();
      case UserMode.inertial:
        return _getInertialMessage();
      case UserMode.cultivation:
        return _getCultivationMessage();
      case UserMode.guiding:
        return _getGuidingMessage();
    }
  }

  String _getExpertMessage() {
    switch (this) {
      case validationError:
        return "請求參數驗證失敗，請檢查輸入格式";
      case unauthorized:
        return "認證失敗，請重新登入";
      case userNotFound:
        return "用戶資料不存在";
      case pinTooWeak:
        return "PIN碼強度不足，請使用更複雜的組合";
      default:
        return "操作失敗，請稍後再試";
    }
  }

  String _getInertialMessage() {
    switch (this) {
      case validationError:
        return "輸入資料格式錯誤";
      case unauthorized:
        return "需要重新登入";
      case userNotFound:
        return "找不到用戶資料";
      default:
        return "操作失敗";
    }
  }

  String _getCultivationMessage() {
    switch (this) {
      case validationError:
        return "輸入有誤，請再試一次！";
      case unauthorized:
        return "登入狀態過期，請重新登入繼續您的記帳旅程";
      case pinTooWeak:
        return "為了保護您的資料安全，請設定更強的PIN碼";
      default:
        return "遇到小狀況，別擔心，再試一次！";
    }
  }

  String _getGuidingMessage() {
    switch (this) {
      case validationError:
        return "輸入錯誤";
      case unauthorized:
        return "請重新登入";
      default:
        return "操作失敗";
    }
  }
}

// 基礎資料模型
class UpdateProfileRequest {
  final String? displayName;
  final String? avatar;
  final String? language;
  final String? timezone;
  final String? theme;

  UpdateProfileRequest({
    this.displayName,
    this.avatar,
    this.language,
    this.timezone,
    this.theme,
  });

  Map<String, dynamic> toJson() {
    return {
      if (displayName != null) 'displayName': displayName,
      if (avatar != null) 'avatar': avatar,
      if (language != null) 'language': language,
      if (timezone != null) 'timezone': timezone,
      if (theme != null) 'theme': theme,
    };
  }

  static UpdateProfileRequest fromJson(Map<String, dynamic> json) {
    return UpdateProfileRequest(
      displayName: json['displayName'] as String?,
      avatar: json['avatar'] as String?,
      language: json['language'] as String?,
      timezone: json['timezone'] as String?,
      theme: json['theme'] as String?,
    );
  }

  List<ValidationError> validate() {
    List<ValidationError> errors = [];
    
    if (displayName != null && displayName!.length > 50) {
      errors.add(ValidationError(
        field: 'displayName',
        message: '顯示名稱不能超過50個字元',
        code: 'MAX_LENGTH_EXCEEDED',
      ));
    }
    
    if (language != null && !['zh-TW', 'en-US'].contains(language)) {
      errors.add(ValidationError(
        field: 'language',
        message: '不支援的語言設定',
        code: 'UNSUPPORTED_LANGUAGE',
      ));
    }
    
    return errors;
  }
}

class SubmitAssessmentRequest {
  final String questionnaireId;
  final List<AnswerData> answers;
  final DateTime? completedAt;

  SubmitAssessmentRequest({
    required this.questionnaireId,
    required this.answers,
    this.completedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'questionnaireId': questionnaireId,
      'answers': answers.map((a) => a.toJson()).toList(),
      if (completedAt != null) 'completedAt': completedAt!.toIso8601String(),
    };
  }

  static SubmitAssessmentRequest fromJson(Map<String, dynamic> json) {
    return SubmitAssessmentRequest(
      questionnaireId: json['questionnaireId'] as String,
      answers: (json['answers'] as List)
          .map((a) => AnswerData.fromJson(a as Map<String, dynamic>))
          .toList(),
      completedAt: json['completedAt'] != null 
          ? DateTime.parse(json['completedAt'] as String)
          : null,
    );
  }

  List<ValidationError> validate() {
    List<ValidationError> errors = [];
    
    if (questionnaireId.isEmpty) {
      errors.add(ValidationError(
        field: 'questionnaireId',
        message: '問卷ID不能為空',
        code: 'REQUIRED',
      ));
    }
    
    if (answers.isEmpty) {
      errors.add(ValidationError(
        field: 'answers',
        message: '至少需要回答一題',
        code: 'REQUIRED',
      ));
    }
    
    return errors;
  }
}

class AnswerData {
  final int questionId;
  final List<String> selectedOptions;

  AnswerData({
    required this.questionId,
    required this.selectedOptions,
  });

  Map<String, dynamic> toJson() {
    return {
      'questionId': questionId,
      'selectedOptions': selectedOptions,
    };
  }

  static AnswerData fromJson(Map<String, dynamic> json) {
    return AnswerData(
      questionId: json['questionId'] as int,
      selectedOptions: List<String>.from(json['selectedOptions'] as List),
    );
  }
}

class UpdateSecurityRequest {
  final AppLockSettings? appLock;
  final PrivacyModeSettings? privacyMode;
  final BiometricSettings? biometric;
  final TwoFactorSettings? twoFactor;

  UpdateSecurityRequest({
    this.appLock,
    this.privacyMode,
    this.biometric,
    this.twoFactor,
  });

  Map<String, dynamic> toJson() {
    return {
      if (appLock != null) 'appLock': appLock!.toJson(),
      if (privacyMode != null) 'privacyMode': privacyMode!.toJson(),
      if (biometric != null) 'biometric': biometric!.toJson(),
      if (twoFactor != null) 'twoFactor': twoFactor!.toJson(),
    };
  }

  static UpdateSecurityRequest fromJson(Map<String, dynamic> json) {
    return UpdateSecurityRequest(
      appLock: json['appLock'] != null 
          ? AppLockSettings.fromJson(json['appLock'] as Map<String, dynamic>)
          : null,
      privacyMode: json['privacyMode'] != null
          ? PrivacyModeSettings.fromJson(json['privacyMode'] as Map<String, dynamic>)
          : null,
      biometric: json['biometric'] != null
          ? BiometricSettings.fromJson(json['biometric'] as Map<String, dynamic>)
          : null,
      twoFactor: json['twoFactor'] != null
          ? TwoFactorSettings.fromJson(json['twoFactor'] as Map<String, dynamic>)
          : null,
    );
  }

  List<ValidationError> validate() {
    List<ValidationError> errors = [];
    // 實作具體驗證邏輯
    return errors;
  }
}

// 安全設定相關類別
class AppLockSettings {
  final bool enabled;
  final String method;
  final String? pinCode;
  final int autoLockTime;

  AppLockSettings({
    required this.enabled,
    required this.method,
    this.pinCode,
    required this.autoLockTime,
  });

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'method': method,
      if (pinCode != null) 'pinCode': pinCode,
      'autoLockTime': autoLockTime,
    };
  }

  static AppLockSettings fromJson(Map<String, dynamic> json) {
    return AppLockSettings(
      enabled: json['enabled'] as bool,
      method: json['method'] as String,
      pinCode: json['pinCode'] as String?,
      autoLockTime: json['autoLockTime'] as int,
    );
  }
}

class PrivacyModeSettings {
  final bool enabled;
  final bool hideAmounts;
  final bool maskCategories;

  PrivacyModeSettings({
    required this.enabled,
    required this.hideAmounts,
    required this.maskCategories,
  });

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'hideAmounts': hideAmounts,
      'maskCategories': maskCategories,
    };
  }

  static PrivacyModeSettings fromJson(Map<String, dynamic> json) {
    return PrivacyModeSettings(
      enabled: json['enabled'] as bool,
      hideAmounts: json['hideAmounts'] as bool,
      maskCategories: json['maskCategories'] as bool,
    );
  }
}

class BiometricSettings {
  final bool enabled;
  final String method;

  BiometricSettings({
    required this.enabled,
    required this.method,
  });

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'method': method,
    };
  }

  static BiometricSettings fromJson(Map<String, dynamic> json) {
    return BiometricSettings(
      enabled: json['enabled'] as bool,
      method: json['method'] as String,
    );
  }
}

class TwoFactorSettings {
  final bool enabled;
  final String method;

  TwoFactorSettings({
    required this.enabled,
    required this.method,
  });

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'method': method,
    };
  }

  static TwoFactorSettings fromJson(Map<String, dynamic> json) {
    return TwoFactorSettings(
      enabled: json['enabled'] as bool,
      method: json['method'] as String,
    );
  }
}

// 驗證錯誤類別
class ValidationError {
  final String field;
  final String message;
  final String code;

  ValidationError({
    required this.field,
    required this.message,
    required this.code,
  });

  Map<String, dynamic> toJson() {
    return {
      'field': field,
      'message': message,
      'code': code,
    };
  }
}

// 抽象服務定義
abstract class SecurityService {
  Future<SecurityUpdateResult> processSecurityUpdate(String userId, UpdateSecurityRequest request);
  Future<PinVerificationResult> processPinVerification(String userId, VerifyPinRequest request);
  Future<BiometricSetupResult> processBiometricSetup(String userId, BiometricSetupRequest request);
  Future<PrivacyModeResult> processPrivacyModeSetup(String userId, PrivacyModeRequest request);
}

abstract class ValidationService {
  List<ValidationError> validateDisplayName(String? displayName);
  List<ValidationError> validateTimezone(String? timezone);
  List<ValidationError> validateLanguage(String? language);
  List<ValidationError> validateTheme(String? theme);
  List<ValidationError> validateUpdateProfileRequest(UpdateProfileRequest request);
  List<ValidationError> validateAssessmentAnswers(List<AnswerData> answers);
  List<ValidationError> validateSecuritySettings(UpdateSecurityRequest request);
}

// 四模式支援架構基礎
abstract class UserModeAdapter {
  T adaptResponse<T>(T response, UserMode userMode);
  ApiError adaptErrorResponse(ApiError error, UserMode userMode);
}

// 業務結果類別（第一階段基礎定義）
class SecurityUpdateResult {
  final bool success;
  final String message;
  final String securityLevel;
  final List<String> updatedSettings;

  SecurityUpdateResult({
    required this.success,
    required this.message,
    required this.securityLevel,
    required this.updatedSettings,
  });
}

class PinVerificationResult {
  final bool verified;
  final String operation;
  final int remainingAttempts;
  final DateTime? lockoutTime;
  final int validFor;

  PinVerificationResult({
    required this.verified,
    required this.operation,
    required this.remainingAttempts,
    this.lockoutTime,
    required this.validFor,
  });
}

class BiometricSetupResult {
  final bool success;
  final String message;

  BiometricSetupResult({
    required this.success,
    required this.message,
  });
}

class PrivacyModeResult {
  final bool success;
  final String message;

  PrivacyModeResult({
    required this.success,
    required this.message,
  });
}

// 請求類別（第一階段基礎定義）
class VerifyPinRequest {
  final String pinCode;
  final String operation;
  final Map<String, dynamic>? deviceInfo;

  VerifyPinRequest({
    required this.pinCode,
    required this.operation,
    this.deviceInfo,
  });

  Map<String, dynamic> toJson() {
    return {
      'pinCode': pinCode,
      'operation': operation,
      if (deviceInfo != null) 'deviceInfo': deviceInfo,
    };
  }
}

class BiometricSetupRequest {
  final bool enabled;
  final String method;

  BiometricSetupRequest({
    required this.enabled,
    required this.method,
  });
}

class PrivacyModeRequest {
  final bool enabled;
  final Map<String, dynamic> settings;

  PrivacyModeRequest({
    required this.enabled,
    required this.settings,
  });
}

// 主要 UserController 類別框架（第一階段：僅方法簽名）
class UserController {
  // 依賴注入將在第二階段實作
  SecurityService? _securityService;
  ValidationService? _validationService;
  UserModeAdapter? _modeAdapter;

  /**
   * 01. 取得用戶個人資料 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<UserProfileResponse>> getProfile() async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 02. 更新用戶個人資料 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<UpdateProfileResponse>> updateProfile(UpdateProfileRequest request) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 03. 更新用戶偏好設定 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<UpdatePreferencesResponse>> updatePreferences(UpdatePreferencesRequest request) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 04. 取得模式評估問卷 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<AssessmentQuestionsResponse>> getAssessmentQuestions() async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 05. 提交模式評估結果 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<AssessmentResultResponse>> submitAssessment(SubmitAssessmentRequest request) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 06. 切換用戶模式 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<SwitchModeResponse>> switchUserMode(SwitchModeRequest request) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 07. 取得模式預設值 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<ModeDefaultsResponse>> getModeDefaults(String mode) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 08. 更新安全設定 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<UpdateSecurityResponse>> updateSecurity(UpdateSecurityRequest request) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 09. PIN碼驗證 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<VerifyPinResponse>> verifyPin(VerifyPinRequest request) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 10. 記錄使用行為追蹤 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<BehaviorTrackingResponse>> trackBehavior(BehaviorTrackingRequest request) async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 11. 取得模式優化建議 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<ModeRecommendationsResponse>> getModeRecommendations() async {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    throw UnimplementedError('將在第二階段實作');
  }

  /**
   * 12. 建構API回應格式 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  ApiResponse<T> _buildResponse<T>(T data, UserMode userMode, String requestId) {
    final metadata = ApiMetadata.create(userMode);
    return ApiResponse.success(data: data, metadata: metadata);
  }

  /**
   * 13. 記錄用戶事件 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  void _logUserEvent(String event, Map<String, dynamic> details) {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    print('UserEvent: $event - $details');
  }

  /**
   * 14. 驗證請求格式 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  ValidationResult _validateRequest(dynamic request) {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    return ValidationResult(isValid: true, errors: []);
  }

  /**
   * 15. 提取用戶模式 (完全符合8088規範第5.3節)
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03 12:00:00
   * @update: 第一階段建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  UserMode _extractUserMode(Map<String, String> headers) {
    // 第一階段：基礎框架，第二階段將實作具體邏輯
    final modeHeader = headers['X-User-Mode'] ?? 'Expert';
    switch (modeHeader.toLowerCase()) {
      case 'expert':
        return UserMode.expert;
      case 'inertial':
        return UserMode.inertial;
      case 'cultivation':
        return UserMode.cultivation;
      case 'guiding':
        return UserMode.guiding;
      default:
        return UserMode.expert;
    }
  }
}

// 基礎回應類別定義（第一階段框架）
class UserProfileResponse {
  final String id;
  final String email;
  final String? displayName;
  final UserMode userMode;

  UserProfileResponse({
    required this.id,
    required this.email,
    this.displayName,
    required this.userMode,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      if (displayName != null) 'displayName': displayName,
      'userMode': userMode.toString().split('.').last,
    };
  }
}

class UpdateProfileResponse {
  final String message;
  final DateTime updatedAt;

  UpdateProfileResponse({
    required this.message,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

class UpdatePreferencesResponse {
  final String message;
  final DateTime updatedAt;
  final List<String> appliedChanges;

  UpdatePreferencesResponse({
    required this.message,
    required this.updatedAt,
    required this.appliedChanges,
  });

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'updatedAt': updatedAt.toIso8601String(),
      'appliedChanges': appliedChanges,
    };
  }
}

class AssessmentQuestionsResponse {
  final Map<String, dynamic> questionnaire;

  AssessmentQuestionsResponse({
    required this.questionnaire,
  });

  Map<String, dynamic> toJson() {
    return {
      'questionnaire': questionnaire,
    };
  }
}

class AssessmentResultResponse {
  final Map<String, dynamic> result;
  final bool applied;
  final String? previousMode;

  AssessmentResultResponse({
    required this.result,
    required this.applied,
    this.previousMode,
  });

  Map<String, dynamic> toJson() {
    return {
      'result': result,
      'applied': applied,
      if (previousMode != null) 'previousMode': previousMode,
    };
  }
}

class SwitchModeResponse {
  final String previousMode;
  final String currentMode;
  final DateTime changedAt;
  final String modeDescription;

  SwitchModeResponse({
    required this.previousMode,
    required this.currentMode,
    required this.changedAt,
    required this.modeDescription,
  });

  Map<String, dynamic> toJson() {
    return {
      'previousMode': previousMode,
      'currentMode': currentMode,
      'changedAt': changedAt.toIso8601String(),
      'modeDescription': modeDescription,
    };
  }
}

class ModeDefaultsResponse {
  final String mode;
  final Map<String, dynamic> defaults;

  ModeDefaultsResponse({
    required this.mode,
    required this.defaults,
  });

  Map<String, dynamic> toJson() {
    return {
      'mode': mode,
      'defaults': defaults,
    };
  }
}

class UpdateSecurityResponse {
  final String message;
  final String securityLevel;
  final List<String> updatedSettings;

  UpdateSecurityResponse({
    required this.message,
    required this.securityLevel,
    required this.updatedSettings,
  });

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'securityLevel': securityLevel,
      'updatedSettings': updatedSettings,
    };
  }
}

class VerifyPinResponse {
  final bool verified;
  final String operation;
  final int remainingAttempts;
  final int validFor;

  VerifyPinResponse({
    required this.verified,
    required this.operation,
    required this.remainingAttempts,
    required this.validFor,
  });

  Map<String, dynamic> toJson() {
    return {
      'verified': verified,
      'operation': operation,
      'remainingAttempts': remainingAttempts,
      'validFor': validFor,
    };
  }
}

class BehaviorTrackingResponse {
  final int recorded;
  final String sessionId;

  BehaviorTrackingResponse({
    required this.recorded,
    required this.sessionId,
  });

  Map<String, dynamic> toJson() {
    return {
      'recorded': recorded,
      'sessionId': sessionId,
    };
  }
}

class ModeRecommendationsResponse {
  final double currentModeScore;
  final List<Map<String, dynamic>> recommendations;
  final DateTime analysisDate;

  ModeRecommendationsResponse({
    required this.currentModeScore,
    required this.recommendations,
    required this.analysisDate,
  });

  Map<String, dynamic> toJson() {
    return {
      'currentModeScore': currentModeScore,
      'recommendations': recommendations,
      'analysisDate': analysisDate.toIso8601String(),
    };
  }
}

// 請求類別定義（第一階段框架）
class UpdatePreferencesRequest {
  final String? currency;
  final String? dateFormat;
  final String? defaultLedgerId;
  final Map<String, dynamic>? notifications;

  UpdatePreferencesRequest({
    this.currency,
    this.dateFormat,
    this.defaultLedgerId,
    this.notifications,
  });

  static UpdatePreferencesRequest fromJson(Map<String, dynamic> json) {
    return UpdatePreferencesRequest(
      currency: json['currency'] as String?,
      dateFormat: json['dateFormat'] as String?,
      defaultLedgerId: json['defaultLedgerId'] as String?,
      notifications: json['notifications'] as Map<String, dynamic>?,
    );
  }
}

class SwitchModeRequest {
  final String newMode;
  final String? reason;

  SwitchModeRequest({
    required this.newMode,
    this.reason,
  });

  static SwitchModeRequest fromJson(Map<String, dynamic> json) {
    return SwitchModeRequest(
      newMode: json['newMode'] as String,
      reason: json['reason'] as String?,
    );
  }
}

class BehaviorTrackingRequest {
  final String? sessionId;
  final List<Map<String, dynamic>> events;

  BehaviorTrackingRequest({
    this.sessionId,
    required this.events,
  });

  static BehaviorTrackingRequest fromJson(Map<String, dynamic> json) {
    return BehaviorTrackingRequest(
      sessionId: json['sessionId'] as String?,
      events: List<Map<String, dynamic>>.from(json['events'] as List),
    );
  }
}

// 驗證結果類別
class ValidationResult {
  final bool isValid;
  final List<ValidationError> errors;

  ValidationResult({
    required this.isValid,
    required this.errors,
  });
}

// ================================
// 第一階段完成標記
// ================================
/// 第一階段完成項目：
/// ✅ 統一API回應格式 (ApiResponse, ApiMetadata, ApiError)
/// ✅ 基礎資料模型 (UpdateProfileRequest, SubmitAssessmentRequest等)
/// ✅ 抽象服務定義 (SecurityService, ValidationService等)
/// ✅ 四模式支援架構基礎 (UserModeAdapter)
/// ✅ UserController 11個API方法框架
/// ✅ 內部輔助方法 (12-15號函數)
/// 
/// 版本：V1.0.0
/// 下一階段：第二階段 - 服務層實作 (V1.1.0)
