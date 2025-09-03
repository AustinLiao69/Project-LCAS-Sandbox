
/**
 * 8302. 用戶管理服務.dart
 * @module 用戶管理服務
 * @version v1.0.0
 * @description LCAS 2.0 用戶管理服務 - 提供完整用戶生命週期管理功能，支援四模式差異化體驗
 * @date 2025-09-03
 * @update 2025-09-03: 初版建立，階段一核心架構完成
 */

import 'dart:async';
import 'dart:convert';

// ================================
// 核心枚舉定義 (Core Enums)
// ================================

/**
 * 01. 用戶模式枚舉
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義四種用戶模式
 */
enum UserMode {
  expert,
  inertial,
  cultivation,
  guiding
}

/**
 * 02. 帳戶狀態枚舉
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義帳戶狀態
 */
enum AccountStatus {
  active,
  inactive,
  locked,
  suspended
}

/**
 * 03. 安全等級枚舉
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義安全等級
 */
enum SecurityLevel {
  low,
  medium,
  high,
  veryHigh
}

/**
 * 04. PIN碼強度枚舉
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義PIN碼強度等級
 */
enum PinStrengthLevel {
  weak,
  fair,
  good,
  strong
}

/**
 * 05. 用戶管理錯誤碼枚舉
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
enum UserManagementErrorCode {
  // 驗證錯誤 (400)
  validationError,
  invalidDisplayName,
  invalidTimezone,
  invalidLanguage,
  invalidPinFormat,
  invalidAssessmentAnswer,

  // 認證錯誤 (401)
  unauthorized,
  tokenExpired,
  invalidToken,

  // 權限錯誤 (403)
  insufficientPermissions,
  accountDisabled,
  pinLocked,

  // 資源錯誤 (404, 409)
  userNotFound,
  assessmentNotFound,
  conflictingSettings,

  // 業務邏輯錯誤 (422)
  pinTooWeak,
  biometricNotSupported,
  assessmentAlreadyCompleted,
  securitySettingsConflict,

  // 系統錯誤 (500)
  internalServerError,
  databaseError,
  encryptionError
}

// ================================
// API回應格式類別 (API Response Classes)
// ================================

/**
 * 06. API元資料類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
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
    this.apiVersion = "v1.0.0",
    this.processingTimeMs = 0,
    this.additionalInfo,
  });

  Map<String, dynamic> toJson() {
    return {
      'timestamp': timestamp.toIso8601String(),
      'requestId': requestId,
      'userMode': userMode.name,
      'apiVersion': apiVersion,
      'processingTimeMs': processingTimeMs,
      if (additionalInfo != null) 'additionalInfo': additionalInfo,
    };
  }

  static ApiMetadata fromJson(Map<String, dynamic> json) {
    return ApiMetadata(
      timestamp: DateTime.parse(json['timestamp']),
      requestId: json['requestId'],
      userMode: UserMode.values.firstWhere((e) => e.name == json['userMode']),
      apiVersion: json['apiVersion'] ?? "v1.0.0",
      processingTimeMs: json['processingTimeMs'] ?? 0,
      additionalInfo: json['additionalInfo'],
    );
  }

  static ApiMetadata create(UserMode userMode, {Map<String, dynamic>? additionalInfo}) {
    return ApiMetadata(
      timestamp: DateTime.now(),
      requestId: _generateRequestId(),
      userMode: userMode,
      additionalInfo: additionalInfo,
    );
  }

  static String _generateRequestId() {
    return 'req-${DateTime.now().millisecondsSinceEpoch}';
  }
}

/**
 * 07. API錯誤類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
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
      'code': code.name.toUpperCase(),
      'message': message,
      if (field != null) 'field': field,
      'timestamp': timestamp.toIso8601String(),
      'requestId': requestId,
      if (details != null) 'details': details,
    };
  }

  static ApiError fromJson(Map<String, dynamic> json) {
    return ApiError(
      code: UserManagementErrorCode.values.firstWhere(
        (e) => e.name.toUpperCase() == json['code'],
        orElse: () => UserManagementErrorCode.internalServerError,
      ),
      message: json['message'],
      field: json['field'],
      timestamp: DateTime.parse(json['timestamp']),
      requestId: json['requestId'],
      details: json['details'],
    );
  }

  static ApiError create(UserManagementErrorCode code, UserMode userMode, {
    String? field,
    Map<String, dynamic>? details,
  }) {
    return ApiError(
      code: code,
      message: _getLocalizedErrorMessage(code, userMode),
      field: field,
      timestamp: DateTime.now(),
      requestId: ApiMetadata._generateRequestId(),
      details: details,
    );
  }

  static String _getLocalizedErrorMessage(UserManagementErrorCode code, UserMode userMode) {
    // 根據錯誤碼和用戶模式返回本地化錯誤訊息
    switch (code) {
      case UserManagementErrorCode.validationError:
        return userMode == UserMode.guiding ? "輸入格式不正確" : "請求參數驗證失敗";
      case UserManagementErrorCode.invalidDisplayName:
        return "顯示名稱格式不正確";
      case UserManagementErrorCode.unauthorized:
        return "未授權存取";
      case UserManagementErrorCode.userNotFound:
        return "用戶不存在";
      case UserManagementErrorCode.pinTooWeak:
        return "PIN碼強度不足";
      default:
        return "系統錯誤，請稍後再試";
    }
  }
}

/**
 * 08. API回應類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
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

  static ApiResponse<T> createSuccess<T>(T data, ApiMetadata metadata) {
    return ApiResponse.success(data: data, metadata: metadata);
  }

  static ApiResponse<T> createError<T>(ApiError error, ApiMetadata metadata) {
    return ApiResponse.error(error: error, metadata: metadata);
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      if (data != null) 'data': _dataToJson(data),
      'metadata': metadata.toJson(),
      if (error != null) 'error': error!.toJson(),
    };
  }

  dynamic _dataToJson(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data;
    } else if (data is List) {
      return data;
    } else if (data != null && data.toString().contains('toJson')) {
      return (data as dynamic).toJson();
    }
    return data;
  }
}

// ================================
// 核心資料模型 (Core Data Models)
// ================================

/**
 * 09. 用戶偏好設定類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義用戶偏好設定結構
 */
class UserPreferences {
  final String language;
  final String currency;
  final String timezone;
  final String dateFormat;
  final String theme;
  final String? defaultLedgerId;
  final Map<String, dynamic> notifications;
  final Map<String, dynamic>? gamification;

  UserPreferences({
    required this.language,
    required this.currency,
    required this.timezone,
    required this.dateFormat,
    required this.theme,
    this.defaultLedgerId,
    required this.notifications,
    this.gamification,
  });

  Map<String, dynamic> toJson() {
    return {
      'language': language,
      'currency': currency,
      'timezone': timezone,
      'dateFormat': dateFormat,
      'theme': theme,
      if (defaultLedgerId != null) 'defaultLedgerId': defaultLedgerId,
      'notifications': notifications,
      if (gamification != null) 'gamification': gamification,
    };
  }

  static UserPreferences fromJson(Map<String, dynamic> json) {
    return UserPreferences(
      language: json['language'],
      currency: json['currency'],
      timezone: json['timezone'],
      dateFormat: json['dateFormat'],
      theme: json['theme'],
      defaultLedgerId: json['defaultLedgerId'],
      notifications: json['notifications'],
      gamification: json['gamification'],
    );
  }
}

/**
 * 10. 安全設定類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義安全設定結構
 */
class SecuritySettings {
  final bool hasAppLock;
  final bool biometricEnabled;
  final bool privacyModeEnabled;
  final bool twoFactorEnabled;
  final SecurityLevel securityLevel;
  final Map<String, dynamic>? appLockSettings;
  final Map<String, dynamic>? privacyModeSettings;

  SecuritySettings({
    required this.hasAppLock,
    required this.biometricEnabled,
    required this.privacyModeEnabled,
    required this.twoFactorEnabled,
    required this.securityLevel,
    this.appLockSettings,
    this.privacyModeSettings,
  });

  Map<String, dynamic> toJson() {
    return {
      'hasAppLock': hasAppLock,
      'biometricEnabled': biometricEnabled,
      'privacyModeEnabled': privacyModeEnabled,
      'twoFactorEnabled': twoFactorEnabled,
      'securityLevel': securityLevel.name,
      if (appLockSettings != null) 'appLockSettings': appLockSettings,
      if (privacyModeSettings != null) 'privacyModeSettings': privacyModeSettings,
    };
  }

  static SecuritySettings fromJson(Map<String, dynamic> json) {
    return SecuritySettings(
      hasAppLock: json['hasAppLock'],
      biometricEnabled: json['biometricEnabled'],
      privacyModeEnabled: json['privacyModeEnabled'],
      twoFactorEnabled: json['twoFactorEnabled'],
      securityLevel: SecurityLevel.values.firstWhere((e) => e.name == json['securityLevel']),
      appLockSettings: json['appLockSettings'],
      privacyModeSettings: json['privacyModeSettings'],
    );
  }
}

// ================================
// 請求資料模型 (Request Data Models)
// ================================

/**
 * 11. 更新用戶資料請求類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
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
      displayName: json['displayName'],
      avatar: json['avatar'],
      language: json['language'],
      timezone: json['timezone'],
      theme: json['theme'],
    );
  }

  List<ValidationError> validate() {
    final errors = <ValidationError>[];

    if (displayName != null && displayName!.length > 50) {
      errors.add(ValidationError(
        field: 'displayName',
        message: '顯示名稱不能超過50個字元',
        code: 'MAX_LENGTH_EXCEEDED',
      ));
    }

    if (language != null && !['zh-TW', 'en-US', 'ja-JP'].contains(language)) {
      errors.add(ValidationError(
        field: 'language',
        message: '不支援的語言設定',
        code: 'INVALID_LANGUAGE',
      ));
    }

    return errors;
  }
}

/**
 * 12. 提交評估結果請求類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
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
      questionnaireId: json['questionnaireId'],
      answers: (json['answers'] as List).map((a) => AnswerData.fromJson(a)).toList(),
      completedAt: json['completedAt'] != null ? DateTime.parse(json['completedAt']) : null,
    );
  }

  List<ValidationError> validate() {
    final errors = <ValidationError>[];

    if (questionnaireId.isEmpty) {
      errors.add(ValidationError(
        field: 'questionnaireId',
        message: '問卷ID不能為空',
        code: 'REQUIRED_FIELD',
      ));
    }

    if (answers.isEmpty) {
      errors.add(ValidationError(
        field: 'answers',
        message: '問卷答案不能為空',
        code: 'REQUIRED_FIELD',
      ));
    }

    return errors;
  }
}

/**
 * 13. 問卷答案資料類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義問卷答案結構
 */
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
      questionId: json['questionId'],
      selectedOptions: List<String>.from(json['selectedOptions']),
    );
  }
}

/**
 * 14. 驗證錯誤類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義驗證錯誤結構
 */
class ValidationError {
  final String field;
  final String message;
  final String code;
  final dynamic value;

  ValidationError({
    required this.field,
    required this.message,
    required this.code,
    this.value,
  });

  Map<String, dynamic> toJson() {
    return {
      'field': field,
      'message': message,
      'code': code,
      if (value != null) 'value': value,
    };
  }
}

// ================================
// 回應資料模型 (Response Data Models)
// ================================

/**
 * 15. 用戶資料回應類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
class UserProfileResponse {
  final String id;
  final String email;
  final String? displayName;
  final String? avatar;
  final UserMode userMode;
  final DateTime createdAt;
  final DateTime? lastLoginAt;
  final UserStatistics? statistics;
  final UserAchievements? achievements;
  final UserPreferences? preferences;
  final SecuritySettings security;

  UserProfileResponse({
    required this.id,
    required this.email,
    this.displayName,
    this.avatar,
    required this.userMode,
    required this.createdAt,
    this.lastLoginAt,
    this.statistics,
    this.achievements,
    this.preferences,
    required this.security,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      if (displayName != null) 'displayName': displayName,
      if (avatar != null) 'avatar': avatar,
      'userMode': userMode.name,
      'createdAt': createdAt.toIso8601String(),
      if (lastLoginAt != null) 'lastLoginAt': lastLoginAt!.toIso8601String(),
      if (statistics != null) 'statistics': statistics!.toJson(),
      if (achievements != null) 'achievements': achievements!.toJson(),
      if (preferences != null) 'preferences': preferences!.toJson(),
      'security': security.toJson(),
    };
  }

  static UserProfileResponse fromJson(Map<String, dynamic> json) {
    return UserProfileResponse(
      id: json['id'],
      email: json['email'],
      displayName: json['displayName'],
      avatar: json['avatar'],
      userMode: UserMode.values.firstWhere((e) => e.name == json['userMode']),
      createdAt: DateTime.parse(json['createdAt']),
      lastLoginAt: json['lastLoginAt'] != null ? DateTime.parse(json['lastLoginAt']) : null,
      statistics: json['statistics'] != null ? UserStatistics.fromJson(json['statistics']) : null,
      achievements: json['achievements'] != null ? UserAchievements.fromJson(json['achievements']) : null,
      preferences: json['preferences'] != null ? UserPreferences.fromJson(json['preferences']) : null,
      security: SecuritySettings.fromJson(json['security']),
    );
  }
}

/**
 * 16. 用戶統計資料類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義用戶統計資料結構
 */
class UserStatistics {
  final int totalTransactions;
  final int totalLedgers;
  final double averageDailyRecords;
  final int longestStreak;

  UserStatistics({
    required this.totalTransactions,
    required this.totalLedgers,
    required this.averageDailyRecords,
    required this.longestStreak,
  });

  Map<String, dynamic> toJson() {
    return {
      'totalTransactions': totalTransactions,
      'totalLedgers': totalLedgers,
      'averageDailyRecords': averageDailyRecords,
      'longestStreak': longestStreak,
    };
  }

  static UserStatistics fromJson(Map<String, dynamic> json) {
    return UserStatistics(
      totalTransactions: json['totalTransactions'],
      totalLedgers: json['totalLedgers'],
      averageDailyRecords: json['averageDailyRecords'].toDouble(),
      longestStreak: json['longestStreak'],
    );
  }
}

/**
 * 17. 用戶成就資料類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義用戶成就資料結構
 */
class UserAchievements {
  final int currentLevel;
  final int totalPoints;
  final int nextLevelPoints;
  final int currentStreak;

  UserAchievements({
    required this.currentLevel,
    required this.totalPoints,
    required this.nextLevelPoints,
    required this.currentStreak,
  });

  Map<String, dynamic> toJson() {
    return {
      'currentLevel': currentLevel,
      'totalPoints': totalPoints,
      'nextLevelPoints': nextLevelPoints,
      'currentStreak': currentStreak,
    };
  }

  static UserAchievements fromJson(Map<String, dynamic> json) {
    return UserAchievements(
      currentLevel: json['currentLevel'],
      totalPoints: json['totalPoints'],
      nextLevelPoints: json['nextLevelPoints'],
      currentStreak: json['currentStreak'],
    );
  }
}

// ================================
// 四模式支援基礎架構 (Four Mode Support Infrastructure)
// ================================

/**
 * 18. 用戶模式適配器
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
abstract class UserModeAdapter {
  /**
   * 19. 適配回應內容
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  T adaptResponse<T>(T response, UserMode userMode);

  /**
   * 20. 適配錯誤回應
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  ApiError adaptErrorResponse(ApiError error, UserMode userMode);

  /**
   * 21. 適配用戶資料回應
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  UserProfileResponse adaptProfileResponse(UserProfileResponse response, UserMode userMode);

  /**
   * 22. 取得可用操作選項
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  List<String> getAvailableActions(UserMode userMode);

  /**
   * 23. 過濾回應資料
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Map<String, dynamic> filterResponseData(Map<String, dynamic> data, UserMode userMode);

  /**
   * 24. 判斷是否顯示進階選項
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  bool shouldShowAdvancedOptions(UserMode userMode);

  /**
   * 25. 判斷是否包含進度追蹤
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  bool shouldIncludeProgressTracking(UserMode userMode);
}

// ================================
// UserController 基礎框架 (UserController Base Framework)
// ================================

/**
 * 26. 用戶控制器類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
abstract class UserController {
  // 依賴注入屬性
  late final ProfileService profileService;
  late final AssessmentService assessmentService;
  late final SecurityService securityService;
  late final UserModeAdapter modeAdapter;

  /**
   * 27. 取得用戶個人資料
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<UserProfileResponse>> getProfile();

  /**
   * 28. 更新用戶個人資料
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<UpdateProfileResponse>> updateProfile(UpdateProfileRequest request);

  /**
   * 29. 取得模式評估問卷
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<AssessmentQuestionsResponse>> getAssessmentQuestions();

  /**
   * 30. 提交模式評估結果
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  Future<ApiResponse<AssessmentResultResponse>> submitAssessment(SubmitAssessmentRequest request);

  /**
   * 31. 建構API回應格式
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  ApiResponse<T> buildResponse<T>(T data, UserMode userMode, String requestId) {
    final metadata = ApiMetadata.create(userMode, additionalInfo: {'requestId': requestId});
    return ApiResponse.createSuccess(data, metadata);
  }

  /**
   * 32. 建構錯誤回應
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  ApiResponse<T> buildErrorResponse<T>(UserManagementErrorCode errorCode, UserMode userMode, {
    String? field,
    Map<String, dynamic>? details,
  }) {
    final metadata = ApiMetadata.create(userMode);
    final error = ApiError.create(errorCode, userMode, field: field, details: details);
    return ApiResponse.createError(error, metadata);
  }

  /**
   * 33. 提取用戶模式
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  UserMode extractUserMode(Map<String, String>? headers) {
    if (headers == null) return UserMode.expert;

    final modeHeader = headers['X-User-Mode'] ?? headers['x-user-mode'];
    if (modeHeader == null) return UserMode.expert;

    return UserMode.values.firstWhere(
      (mode) => mode.name.toLowerCase() == modeHeader.toLowerCase(),
      orElse: () => UserMode.expert,
    );
  }

  /**
   * 34. 驗證請求格式
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  ValidationResult validateRequest(dynamic request) {
    if (request == null) {
      return ValidationResult(
        isValid: false,
        errors: [
          ValidationError(
            field: 'request',
            message: '請求內容不能為空',
            code: 'REQUIRED_FIELD',
          )
        ],
      );
    }

    List<ValidationError> errors = [];

    if (request is UpdateProfileRequest) {
      errors.addAll(request.validate());
    } else if (request is SubmitAssessmentRequest) {
      errors.addAll(request.validate());
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  /**
   * 35. 記錄用戶事件
   * @version 2025-09-03-V1.0.0
   * @date 2025-09-03
   * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
   */
  void logUserEvent(String event, Map<String, dynamic> details) {
    final logEntry = {
      'event': event,
      'details': details,
      'timestamp': DateTime.now().toIso8601String(),
    };

    // 這裡將來會整合實際的日誌服務
    print('User Event: ${jsonEncode(logEntry)}');
  }
}

// ================================
// 輔助資料類別 (Supporting Data Classes)
// ================================

/**
 * 36. 驗證結果類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義驗證結果結構
 */
class ValidationResult {
  final bool isValid;
  final List<ValidationError> errors;

  ValidationResult({
    required this.isValid,
    required this.errors,
  });

  Map<String, dynamic> toJson() {
    return {
      'isValid': isValid,
      'errors': errors.map((e) => e.toJson()).toList(),
    };
  }
}

/**
 * 37. 更新資料回應類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義更新操作回應結構
 */
class UpdateProfileResponse {
  final String message;
  final DateTime updatedAt;
  final List<String> appliedChanges;

  UpdateProfileResponse({
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

  static UpdateProfileResponse fromJson(Map<String, dynamic> json) {
    return UpdateProfileResponse(
      message: json['message'],
      updatedAt: DateTime.parse(json['updatedAt']),
      appliedChanges: List<String>.from(json['appliedChanges']),
    );
  }
}

/**
 * 38. 評估問卷回應類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義評估問卷回應結構
 */
class AssessmentQuestionsResponse {
  final String questionnaireId;
  final String version;
  final String title;
  final String description;
  final int estimatedTime;
  final List<QuestionData> questions;

  AssessmentQuestionsResponse({
    required this.questionnaireId,
    required this.version,
    required this.title,
    required this.description,
    required this.estimatedTime,
    required this.questions,
  });

  Map<String, dynamic> toJson() {
    return {
      'questionnaireId': questionnaireId,
      'version': version,
      'title': title,
      'description': description,
      'estimatedTime': estimatedTime,
      'questions': questions.map((q) => q.toJson()).toList(),
    };
  }

  static AssessmentQuestionsResponse fromJson(Map<String, dynamic> json) {
    return AssessmentQuestionsResponse(
      questionnaireId: json['questionnaireId'],
      version: json['version'],
      title: json['title'],
      description: json['description'],
      estimatedTime: json['estimatedTime'],
      questions: (json['questions'] as List).map((q) => QuestionData.fromJson(q)).toList(),
    );
  }
}

/**
 * 39. 問卷題目資料類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義問卷題目結構
 */
class QuestionData {
  final int id;
  final String question;
  final String type;
  final bool required;
  final List<OptionData> options;

  QuestionData({
    required this.id,
    required this.question,
    required this.type,
    required this.required,
    required this.options,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'question': question,
      'type': type,
      'required': required,
      'options': options.map((o) => o.toJson()).toList(),
    };
  }

  static QuestionData fromJson(Map<String, dynamic> json) {
    return QuestionData(
      id: json['id'],
      question: json['question'],
      type: json['type'],
      required: json['required'],
      options: (json['options'] as List).map((o) => OptionData.fromJson(o)).toList(),
    );
  }
}

/**
 * 40. 選項資料類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義選項資料結構
 */
class OptionData {
  final String id;
  final String text;
  final Map<String, int> weight;

  OptionData({
    required this.id,
    required this.text,
    required this.weight,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'text': text,
      'weight': weight,
    };
  }

  static OptionData fromJson(Map<String, dynamic> json) {
    return OptionData(
      id: json['id'],
      text: json['text'],
      weight: Map<String, int>.from(json['weight']),
    );
  }
}

/**
 * 41. 評估結果回應類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義評估結果回應結構
 */
class AssessmentResultResponse {
  final AssessmentResult result;
  final bool applied;
  final String? previousMode;

  AssessmentResultResponse({
    required this.result,
    required this.applied,
    this.previousMode,
  });

  Map<String, dynamic> toJson() {
    return {
      'result': result.toJson(),
      'applied': applied,
      if (previousMode != null) 'previousMode': previousMode,
    };
  }

  static AssessmentResultResponse fromJson(Map<String, dynamic> json) {
    return AssessmentResultResponse(
      result: AssessmentResult.fromJson(json['result']),
      applied: json['applied'],
      previousMode: json['previousMode'],
    );
  }
}

/**
 * 42. 評估結果類別
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，定義評估結果結構
 */
class AssessmentResult {
  final UserMode recommendedMode;
  final double confidence;
  final Map<String, double> scores;
  final String explanation;
  final Map<String, String> modeCharacteristics;

  AssessmentResult({
    required this.recommendedMode,
    required this.confidence,
    required this.scores,
    required this.explanation,
    required this.modeCharacteristics,
  });

  Map<String, dynamic> toJson() {
    return {
      'recommendedMode': recommendedMode.name,
      'confidence': confidence,
      'scores': scores,
      'explanation': explanation,
      'modeCharacteristics': modeCharacteristics,
    };
  }

  static AssessmentResult fromJson(Map<String, dynamic> json) {
    return AssessmentResult(
      recommendedMode: UserMode.values.firstWhere((e) => e.name == json['recommendedMode']),
      confidence: json['confidence'].toDouble(),
      scores: Map<String, double>.from(json['scores']),
      explanation: json['explanation'],
      modeCharacteristics: Map<String, String>.from(json['modeCharacteristics']),
    );
  }
}

// ================================
// 抽象服務介面 (Abstract Service Interfaces)
// ================================

/**
 * 43. 用戶資料服務介面
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
abstract class ProfileService {
  Future<UserProfileResult> processGetProfile(String userId);
  Future<UpdateResult> processUpdateProfile(String userId, UpdateProfileRequest request);
  Future<PreferenceUpdateResult> processUpdatePreferences(String userId, UpdatePreferencesRequest request);
  Future<AvatarUploadResult> processAvatarUpload(String userId, String avatarData);
}

/**
 * 44. 模式評估服務介面
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
abstract class AssessmentService {
  Future<QuestionnaireResult> getAssessmentQuestionnaire();
  Future<AssessmentResult> processAssessmentSubmission(String userId, SubmitAssessmentRequest request);
  Future<ModeScoreResult> calculateModeScores(List<AnswerData> answers);
  Future<RecommendationResult> generateModeRecommendation(ModeScoreResult scores);
}

/**
 * 45. 安全服務介面
 * @version 2025-09-03-V1.0.0
 * @date 2025-09-03
 * @update: 初版建立，完全符合8088規範第5.3節HTTP狀態碼標準
 */
abstract class SecurityService {
  Future<SecurityUpdateResult> processSecurityUpdate(String userId, UpdateSecurityRequest request);
  Future<PinVerificationResult> processPinVerification(String userId, VerifyPinRequest request);
  Future<BiometricSetupResult> processBiometricSetup(String userId, BiometricSetupRequest request);
  Future<PrivacyModeResult> processPrivacyModeSetup(String userId, PrivacyModeRequest request);
}

// ================================
// 結果類別定義 (Result Class Definitions)
// ================================

// 這些類別將在階段二實作具體內容，現在先定義基礎結構

class UserProfileResult {
  final bool success;
  final UserProfileResponse? data;
  final String? error;

  UserProfileResult({required this.success, this.data, this.error});
}

class UpdateResult {
  final bool success;
  final UpdateProfileResponse? data;
  final String? error;

  UpdateResult({required this.success, this.data, this.error});
}

class QuestionnaireResult {
  final bool success;
  final AssessmentQuestionsResponse? data;
  final String? error;

  QuestionnaireResult({required this.success, this.data, this.error});
}

class ModeScoreResult {
  final Map<String, double> scores;
  final double confidence;

  ModeScoreResult({required this.scores, required this.confidence});
}

class RecommendationResult {
  final UserMode recommendedMode;
  final String explanation;
  final Map<String, String> characteristics;

  RecommendationResult({
    required this.recommendedMode,
    required this.explanation,
    required this.characteristics,
  });
}

// 以下類別將在後續階段完善
class PreferenceUpdateResult {
  final bool success;
  PreferenceUpdateResult({required this.success});
}

class AvatarUploadResult {
  final bool success;
  AvatarUploadResult({required this.success});
}

class SecurityUpdateResult {
  final bool success;
  SecurityUpdateResult({required this.success});
}

class PinVerificationResult {
  final bool success;
  PinVerificationResult({required this.success});
}

class BiometricSetupResult {
  final bool success;
  BiometricSetupResult({required this.success});
}

class PrivacyModeResult {
  final bool success;
  PrivacyModeResult({required this.success});
}

class UpdatePreferencesRequest {
  final Map<String, dynamic> preferences;
  UpdatePreferencesRequest({required this.preferences});
}

class UpdateSecurityRequest {
  final Map<String, dynamic> security;
  UpdateSecurityRequest({required this.security});
}

class VerifyPinRequest {
  final String pinCode;
  VerifyPinRequest({required this.pinCode});
}

class BiometricSetupRequest {
  final String type;
  BiometricSetupRequest({required this.type});
}

class PrivacyModeRequest {
  final bool enabled;
  PrivacyModeRequest({required this.enabled});
}

// ================================
// 階段一完成標記
// ================================

/**
 * 階段一開發完成標記
 * 
 * 已完成項目：
 * ✅ 核心枚舉定義 (5個枚舉)
 * ✅ 統一API回應格式 (ApiResponse, ApiMetadata, ApiError)
 * ✅ 核心資料模型 (UserProfile相關類別)
 * ✅ UserController基礎框架
 * ✅ 四模式支援基礎架構 (UserModeAdapter)
 * ✅ 抽象服務介面定義
 * ✅ 驗證機制基礎架構
 * 
 * 待階段二實作：
 * 🔄 11個Controller方法的具體業務邏輯
 * 🔄 Service層的核心業務邏輯實作
 * 🔄 四模式適配器具體實作
 * 🔄 錯誤處理機制完善
 * 🔄 安全驗證邏輯實作
 */
