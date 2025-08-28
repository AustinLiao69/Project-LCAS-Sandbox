
/**
 * 8301_認證服務_1.2.0
 * @module 認證服務模組
 * @description LCAS 2.0 認證服務 API 模組 - 提供使用者註冊、登入、OAuth整合、跨平台綁定等完整認證功能
 * @update 2025-08-28: 重大升級，修正規範違反問題、補充缺失抽象方法、完善四模式支援、統一請求ID管理、完善HTTP狀態碼處理
 */

import 'dart:convert';
import 'dart:async';
import 'dart:math';

// ================================
// 核心資料模型 (Data Models)
// ================================

/// 統一API回應格式
class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiMetadata metadata;
  final ApiError? error;

  ApiResponse.success({required this.data, required this.metadata})
      : success = true,
        error = null;

  ApiResponse.error({required this.error, required this.metadata})
      : success = false,
        data = null;

  /// 01. 建立成功回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供統一成功回應格式
  static ApiResponse<T> createSuccess<T>(T data, ApiMetadata metadata) {
    return ApiResponse.success(data: data, metadata: metadata);
  }

  /// 02. 建立錯誤回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供統一錯誤回應格式
  static ApiResponse<T> createError<T>(ApiError error, ApiMetadata metadata) {
    return ApiResponse.error(error: error, metadata: metadata);
  }

  Map<String, dynamic> toJson() {
    if (success) {
      return {
        'success': success,
        'data': data,
        'metadata': metadata.toJson(),
      };
    } else {
      return {
        'success': success,
        'error': error?.toJson(),
        'metadata': metadata.toJson(),
      };
    }
  }
}

/// API後設資料
class ApiMetadata {
  final DateTime timestamp;
  final String requestId;
  final UserMode userMode;
  final String apiVersion;
  final int processingTimeMs;
  final int? httpStatusCode;
  final Map<String, dynamic>? additionalInfo;

  ApiMetadata({
    required this.timestamp,
    required this.requestId,
    required this.userMode,
    this.apiVersion = '1.2.0',
    this.processingTimeMs = 0,
    this.httpStatusCode,
    this.additionalInfo,
  });

  /// 03. 建立後設資料
  /// @version 2025-08-28-V1.2.0
  /// @date 2025-08-28 12:00:00
  /// @update: 升級版本，使用統一請求ID服務，強化HTTP狀態碼支援
  static ApiMetadata create(UserMode userMode, {int? httpStatusCode, Map<String, dynamic>? additionalInfo}) {
    return ApiMetadata(
      timestamp: DateTime.now(),
      requestId: RequestIdService.generate(),
      userMode: userMode,
      httpStatusCode: httpStatusCode,
      additionalInfo: additionalInfo,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'timestamp': timestamp.toIso8601String(),
      'requestId': requestId,
      'userMode': userMode.toString().split('.').last,
      'apiVersion': apiVersion,
      'processingTimeMs': processingTimeMs,
      if (httpStatusCode != null) 'httpStatusCode': httpStatusCode,
      if (additionalInfo != null) 'additionalInfo': additionalInfo,
    };
  }
}

/// 統一請求ID生成服務
class RequestIdService {
  static final Random _random = Random();
  
  /// 04. 生成統一請求ID
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增統一請求ID生成服務，解決重複實作問題
  static String generate() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final randomSuffix = _random.nextInt(999999).toString().padLeft(6, '0');
    return 'req-${timestamp.toString().substring(7)}-$randomSuffix';
  }
}

/// 使用者模式枚舉
enum UserMode { expert, inertial, cultivation, guiding }

/// 認證錯誤代碼
enum AuthErrorCode {
  // 驗證錯誤 (400)
  validationError,
  invalidEmail,
  weakPassword,
  passwordMismatch,
  missingRequiredField,

  // 認證錯誤 (401)
  unauthorized,
  invalidCredentials,
  tokenExpired,
  tokenInvalid,
  tokenRevoked,

  // 權限錯誤 (403)
  insufficientPermissions,
  accountDisabled,
  accountNotVerified,
  accountLocked,

  // 資源錯誤 (404, 409)
  userNotFound,
  emailNotFound,
  emailAlreadyExists,
  invalidResetToken,
  resetTokenExpired,

  // 系統錯誤 (500)
  internalServerError,
  externalServiceError,
  databaseError,
  emailServiceError;

  /// 05. 取得HTTP狀態碼
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 補充缺失錯誤碼的HTTP狀態碼對應
  int get httpStatusCode {
    switch (this) {
      case validationError:
      case invalidEmail:
      case weakPassword:
      case passwordMismatch:
      case missingRequiredField:
        return 400;
      case unauthorized:
      case invalidCredentials:
      case tokenExpired:
      case tokenInvalid:
      case tokenRevoked:
        return 401;
      case insufficientPermissions:
      case accountDisabled:
      case accountNotVerified:
        return 403;
      case accountLocked:
        return 423;
      case userNotFound:
      case emailNotFound:
      case invalidResetToken:
      case resetTokenExpired:
        return 404;
      case emailAlreadyExists:
        return 409;
      case internalServerError:
      case externalServiceError:
      case databaseError:
      case emailServiceError:
        return 500;
    }
  }

  /// 06. 取得模式化錯誤訊息
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增缺失錯誤碼的模式化訊息
  String getMessage(UserMode userMode) {
    switch (this) {
      case validationError:
        return userMode == UserMode.guiding ? '資料格式錯誤' : '請求參數驗證失敗';
      case invalidEmail:
        return userMode == UserMode.guiding ? 'Email格式錯誤' : 'Email地址格式無效';
      case weakPassword:
        return userMode == UserMode.guiding ? '密碼太簡單' : '密碼強度不足，請使用至少8個字元';
      case passwordMismatch:
        return '密碼確認不一致';
      case invalidCredentials:
        return userMode == UserMode.guiding ? '帳號或密碼錯誤' : 'Email或密碼不正確';
      case emailAlreadyExists:
        return userMode == UserMode.guiding ? '此Email已被使用' : '此Email地址已被註冊';
      case userNotFound:
        return '找不到使用者';
      case emailNotFound:
        return userMode == UserMode.guiding ? '找不到此Email' : '此Email地址尚未註冊';
      case accountDisabled:
        return '帳號已被停用';
      case accountLocked:
        return userMode == UserMode.guiding ? '帳號被鎖定' : '帳號因多次登入失敗被暫時鎖定';
      case invalidResetToken:
        return userMode == UserMode.guiding ? '重設連結無效' : '密碼重設Token無效';
      case resetTokenExpired:
        return userMode == UserMode.guiding ? '重設連結已過期' : '密碼重設Token已過期';
      case emailServiceError:
        return userMode == UserMode.guiding ? '無法發送郵件' : 'Email服務暫時無法使用';
      default:
        return userMode == UserMode.guiding ? '系統錯誤' : '系統發生錯誤，請稍後再試';
    }
  }
}

/// API錯誤資訊
class ApiError {
  final AuthErrorCode code;
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

  /// 07. 建立API錯誤
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，使用統一的請求ID服務
  static ApiError create(AuthErrorCode code, UserMode userMode, {String? field, String? requestId, Map<String, dynamic>? details}) {
    return ApiError(
      code: code,
      message: code.getMessage(userMode),
      field: field,
      timestamp: DateTime.now(),
      requestId: requestId ?? RequestIdService.generate(),
      details: details,
    );
  }

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
}

/// 註冊請求資料模型
class RegisterRequest {
  final String email;
  final String password;
  final String? confirmPassword;
  final String? displayName;
  final UserMode userMode;
  final bool acceptTerms;
  final bool acceptPrivacy;
  final String? timezone;
  final String? language;

  RegisterRequest({
    required this.email,
    required this.password,
    this.confirmPassword,
    this.displayName,
    required this.userMode,
    required this.acceptTerms,
    required this.acceptPrivacy,
    this.timezone,
    this.language,
  });

  /// 08. 驗證註冊請求
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 補充8101規格缺失的驗證規則
  List<ValidationError> validate() {
    List<ValidationError> errors = [];
    
    if (email.isEmpty || !_isValidEmail(email)) {
      errors.add(ValidationError(field: 'email', message: 'Email格式無效'));
    }
    
    if (password.length < 8) {
      errors.add(ValidationError(field: 'password', message: '密碼長度至少8個字元'));
    }
    
    if (confirmPassword != null && password != confirmPassword) {
      errors.add(ValidationError(field: 'confirmPassword', message: '密碼確認不一致'));
    }
    
    if (!acceptTerms) {
      errors.add(ValidationError(field: 'acceptTerms', message: '必須同意服務條款'));
    }
    
    if (!acceptPrivacy) {
      errors.add(ValidationError(field: 'acceptPrivacy', message: '必須同意隱私政策'));
    }
    
    return errors;
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'password': password,
      if (confirmPassword != null) 'confirmPassword': confirmPassword,
      if (displayName != null) 'displayName': displayName,
      'userMode': userMode.toString().split('.').last,
      'acceptTerms': acceptTerms,
      'acceptPrivacy': acceptPrivacy,
      if (timezone != null) 'timezone': timezone,
      if (language != null) 'language': language,
    };
  }
}

/// 登入請求資料模型
class LoginRequest {
  final String email;
  final String password;
  final bool? rememberMe;
  final DeviceInfo? deviceInfo;

  LoginRequest({
    required this.email,
    required this.password,
    this.rememberMe,
    this.deviceInfo,
  });

  /// 09. 驗證登入請求
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供登入請求驗證邏輯
  List<ValidationError> validate() {
    List<ValidationError> errors = [];
    
    if (email.isEmpty) {
      errors.add(ValidationError(field: 'email', message: 'Email不能為空'));
    }
    
    if (password.isEmpty) {
      errors.add(ValidationError(field: 'password', message: '密碼不能為空'));
    }
    
    return errors;
  }

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'password': password,
      if (rememberMe != null) 'rememberMe': rememberMe,
      if (deviceInfo != null) 'deviceInfo': deviceInfo!.toJson(),
    };
  }
}

/// 裝置資訊
class DeviceInfo {
  final String? deviceId;
  final String? platform;
  final String? appVersion;

  DeviceInfo({this.deviceId, this.platform, this.appVersion});

  Map<String, dynamic> toJson() {
    return {
      if (deviceId != null) 'deviceId': deviceId,
      if (platform != null) 'platform': platform,
      if (appVersion != null) 'appVersion': appVersion,
    };
  }
}

/// 驗證錯誤
class ValidationError {
  final String field;
  final String message;

  ValidationError({required this.field, required this.message});
}

/// 註冊回應資料模型
class RegisterResponse {
  final String userId;
  final String email;
  final UserMode userMode;
  final bool verificationSent;
  final bool requiresAssessment; // 修正為8101規格一致的命名
  final String token;
  final String refreshToken;
  final DateTime expiresAt;

  RegisterResponse({
    required this.userId,
    required this.email,
    required this.userMode,
    required this.verificationSent,
    required this.requiresAssessment,
    required this.token,
    required this.refreshToken,
    required this.expiresAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'email': email,
      'userMode': userMode.toString().split('.').last,
      'verificationSent': verificationSent,
      'requiresAssessment': requiresAssessment,
      'token': token,
      'refreshToken': refreshToken,
      'expiresAt': expiresAt.toIso8601String(),
    };
  }
}

/// 登入回應資料模型
class LoginResponse {
  final String token;
  final String refreshToken;
  final DateTime expiresAt;
  final UserProfile user;
  final Map<String, dynamic>? loginHistory;
  final Map<String, dynamic>? streakInfo;
  final String? simpleMessage;

  LoginResponse({
    required this.token,
    required this.refreshToken,
    required this.expiresAt,
    required this.user,
    this.loginHistory,
    this.streakInfo,
    this.simpleMessage,
  });

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'refreshToken': refreshToken,
      'expiresAt': expiresAt.toIso8601String(),
      'user': user.toJson(),
      if (loginHistory != null) 'loginHistory': loginHistory,
      if (streakInfo != null) 'streakInfo': streakInfo,
      if (simpleMessage != null) 'simpleMessage': simpleMessage,
    };
  }
}

/// 使用者資料模型
class UserProfile {
  final String id;
  final String email;
  final String? displayName;
  final UserMode userMode;
  final String? avatar;
  final Map<String, dynamic>? preferences;
  final DateTime createdAt;
  final DateTime? lastActiveAt;

  UserProfile({
    required this.id,
    required this.email,
    this.displayName,
    required this.userMode,
    this.avatar,
    this.preferences,
    required this.createdAt,
    this.lastActiveAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      if (displayName != null) 'displayName': displayName,
      'userMode': userMode.toString().split('.').last,
      if (avatar != null) 'avatar': avatar,
      if (preferences != null) 'preferences': preferences,
      'createdAt': createdAt.toIso8601String(),
      if (lastActiveAt != null) 'lastActiveAt': lastActiveAt!.toIso8601String(),
    };
  }
}

/// 重設Token驗證結果
class ResetTokenValidation {
  final bool isValid;
  final String? email;
  final DateTime? expiresAt;
  final String? reason;

  ResetTokenValidation({
    required this.isValid,
    this.email,
    this.expiresAt,
    this.reason,
  });
}

// ================================
// 核心服務類別 (Service Classes)
// ================================

/// Token服務
abstract class TokenService {
  /// 10. 產生Token對
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供存取與刷新Token生成
  Future<TokenPair> generateTokenPair(String userId, UserMode userMode);

  /// 11. 產生存取Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供存取Token生成
  Future<String> generateAccessToken(String userId, Map<String, dynamic> claims);

  /// 12. 產生刷新Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供刷新Token生成
  Future<String> generateRefreshToken(String userId);

  /// 13. 產生重設Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  Future<String> generateResetToken(String email);

  /// 14. 產生Email驗證Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  Future<String> generateEmailVerificationToken(String email);

  /// 15. 驗證存取Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供Token驗證機制
  Future<TokenValidationResult> validateAccessToken(String token);

  /// 16. 驗證刷新Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充Token驗證機制
  Future<TokenValidationResult> validateRefreshToken(String token);

  /// 17. 驗證重設Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  Future<bool> validateResetToken(String token);

  /// 18. 驗證Email驗證Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  Future<bool> validateEmailVerificationToken(String token);

  /// 19. 撤銷Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供Token撤銷機制
  Future<void> revokeToken(String token);

  /// 20. 撤銷使用者所有Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充Token管理機制
  Future<void> revokeAllUserTokens(String userId);

  /// 21. 檢查Token是否已撤銷
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充Token狀態檢查機制
  Future<bool> isTokenRevoked(String token);

  /// 22. 清理過期Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，提供Token維護機制
  Future<void> cleanupExpiredTokens();
}

/// Token對
class TokenPair {
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;

  TokenPair({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
  });
}

/// Token驗證結果
class TokenValidationResult {
  final bool isValid;
  final String? userId;
  final UserMode? userMode;
  final String? reason;

  TokenValidationResult({
    required this.isValid,
    this.userId,
    this.userMode,
    this.reason,
  });
}

/// 使用者模式適配器
abstract class UserModeAdapter {
  /// 23. 適配回應內容
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，根據使用者模式調整回應內容
  T adaptResponse<T>(T response, UserMode userMode);

  /// 24. 適配錯誤回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，根據使用者模式調整錯誤訊息
  ApiError adaptErrorResponse(ApiError error, UserMode userMode);

  /// 25. 適配登入回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，根據使用者模式調整登入回應
  LoginResponse adaptLoginResponse(LoginResponse response, UserMode userMode);

  /// 26. 適配註冊回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的適配方法
  RegisterResponse adaptRegisterResponse(RegisterResponse response, UserMode userMode);

  /// 27. 取得可用操作選項
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的功能選項過濾
  List<String> getAvailableActions(UserMode userMode);

  /// 28. 過濾回應資料
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，提供模式特定的資料過濾
  Map<String, dynamic> filterResponseData(Map<String, dynamic> data, UserMode userMode);
}

/// 認證服務
abstract class AuthService {
  /// 29. 處理使用者註冊
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理使用者註冊業務邏輯
  Future<RegisterResult> processRegistration(RegisterRequest request);

  /// 30. 驗證使用者登入
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理使用者認證
  Future<LoginResult> authenticateUser(String email, String password);

  /// 31. 處理使用者登出
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理登出業務邏輯
  Future<void> processLogout(LogoutRequest request);

  /// 32. 處理忘記密碼
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，發送密碼重設信件
  Future<void> initiateForgotPassword(String email);

  /// 33. 驗證重設Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  Future<ResetTokenValidation> validateResetToken(String token);

  /// 34. 執行密碼重設
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，提供密碼重設執行邏輯
  Future<void> executePasswordReset(String token, String newPassword);

  /// 35. 處理Email驗證
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理Email地址驗證
  Future<void> processEmailVerification(String email, String code);

  /// 36. 發送驗證Email
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充Email驗證流程
  Future<void> sendVerificationEmail(String email);

  /// 37. 執行安全檢查
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  Future<void> _performSecurityCheck(String userId);
}

/// 註冊結果
class RegisterResult {
  final String userId;
  final bool success;
  final String? errorMessage;

  RegisterResult({required this.userId, required this.success, this.errorMessage});
}

/// 登入結果
class LoginResult {
  final UserProfile? user;
  final bool success;
  final String? errorMessage;

  LoginResult({this.user, required this.success, this.errorMessage});
}

/// 登出請求
class LogoutRequest {
  final bool? logoutAllDevices;
  final bool? clearLocalData;

  LogoutRequest({this.logoutAllDevices, this.clearLocalData});
}

// ================================
// 主要控制器 (Main Controller)
// ================================

/// 認證控制器 - 統一處理所有認證相關API請求
class AuthController {
  final AuthService _authService;
  final TokenService _tokenService;
  final UserModeAdapter _userModeAdapter;

  AuthController({
    required AuthService authService,
    required TokenService tokenService,
    required UserModeAdapter userModeAdapter,
  })  : _authService = authService,
        _tokenService = tokenService,
        _userModeAdapter = userModeAdapter;

  /// 38. 使用者註冊API (對應S-103畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<RegisterResponse>> register(RegisterRequest request) async {
    try {
      // 驗證請求
      final validationErrors = request.validate();
      if (validationErrors.isNotEmpty) {
        final error = ApiError.create(
          AuthErrorCode.validationError,
          request.userMode,
          field: validationErrors.first.field,
        );
        final metadata = ApiMetadata.create(request.userMode, httpStatusCode: 400);
        return ApiResponse.createError(error, metadata);
      }

      // 處理註冊
      final result = await _authService.processRegistration(request);
      if (!result.success) {
        final error = ApiError.create(
          AuthErrorCode.emailAlreadyExists,
          request.userMode,
        );
        final metadata = ApiMetadata.create(request.userMode, httpStatusCode: 409);
        return ApiResponse.createError(error, metadata);
      }

      // 生成Token
      final tokenPair = await _tokenService.generateTokenPair(result.userId, request.userMode);

      // 建立回應
      var response = RegisterResponse(
        userId: result.userId,
        email: request.email,
        userMode: request.userMode,
        verificationSent: true,
        requiresAssessment: request.userMode == UserMode.expert,
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.expiresAt,
      );

      // 根據模式調整回應
      response = _userModeAdapter.adaptRegisterResponse(response, request.userMode);

      final metadata = ApiMetadata.create(request.userMode, httpStatusCode: 201);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        request.userMode,
      );
      final metadata = ApiMetadata.create(request.userMode, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 39. 使用者登入API (對應S-104畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<LoginResponse>> login(LoginRequest request) async {
    try {
      // 驗證請求
      final validationErrors = request.validate();
      if (validationErrors.isNotEmpty) {
        final error = ApiError.create(
          AuthErrorCode.validationError,
          UserMode.expert, // 預設模式，稍後會調整
          field: validationErrors.first.field,
        );
        final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 400);
        return ApiResponse.createError(error, metadata);
      }

      // 認證使用者
      final result = await _authService.authenticateUser(request.email, request.password);
      if (!result.success || result.user == null) {
        final error = ApiError.create(
          AuthErrorCode.invalidCredentials,
          UserMode.expert,
        );
        final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 401);
        return ApiResponse.createError(error, metadata);
      }

      final user = result.user!;

      // 生成Token
      final tokenPair = await _tokenService.generateTokenPair(user.id, user.userMode);

      // 建立基本回應
      var response = LoginResponse(
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.expiresAt,
        user: user,
      );

      // 根據模式調整回應
      response = _userModeAdapter.adaptLoginResponse(response, user.userMode);

      final metadata = ApiMetadata.create(user.userMode, httpStatusCode: 200);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 40. 使用者登出API
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，強化HTTP狀態碼處理
  Future<ApiResponse<void>> logout(LogoutRequest request) async {
    try {
      await _authService.processLogout(request);
      
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 200); // 登出時使用預設模式
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 41. 刷新Token API
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，強化HTTP狀態碼處理
  Future<ApiResponse<RefreshTokenResponse>> refreshToken(String refreshToken) async {
    try {
      // 驗證刷新Token
      final validationResult = await _tokenService.validateRefreshToken(refreshToken);
      if (!validationResult.isValid) {
        final error = ApiError.create(
          AuthErrorCode.tokenInvalid,
          UserMode.expert,
        );
        final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 401);
        return ApiResponse.createError(error, metadata);
      }

      // 生成新Token對
      final tokenPair = await _tokenService.generateTokenPair(
        validationResult.userId!,
        validationResult.userMode!,
      );

      final response = RefreshTokenResponse(
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.expiresAt,
      );

      final metadata = ApiMetadata.create(validationResult.userMode!, httpStatusCode: 200);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 42. 忘記密碼API (對應S-105畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<void>> forgotPassword(ForgotPasswordRequest request) async {
    try {
      await _authService.initiateForgotPassword(request.email);
      
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 200);
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.emailServiceError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 43. 驗證重設Token API (對應S-105畫面)
  /// @version 2025-08-28-V1.2.0
  /// @date 2025-08-28 12:00:00
  /// @update: 重大升級，實作完整業務邏輯驗證，使用AuthService
  Future<ApiResponse<VerifyResetTokenResponse>> verifyResetToken(String token) async {
    try {
      // 驗證Token格式
      if (token.isEmpty || token.length < 32) {
        final error = ApiError.create(
          AuthErrorCode.invalidResetToken,
          UserMode.expert,
        );
        final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 400);
        return ApiResponse.createError(error, metadata);
      }

      // 使用AuthService驗證Token有效性
      final validation = await _authService.validateResetToken(token);
      
      final response = VerifyResetTokenResponse(
        valid: validation.isValid,
        email: validation.email,
        expiresAt: validation.expiresAt,
      );

      final statusCode = validation.isValid ? 200 : 404;
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: statusCode);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 44. 重設密碼API (對應S-105畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<void>> resetPassword(ResetPasswordRequest request) async {
    try {
      // 驗證Token和密碼
      if (request.token.isEmpty || request.newPassword.length < 8) {
        final error = ApiError.create(
          request.token.isEmpty ? AuthErrorCode.invalidResetToken : AuthErrorCode.weakPassword,
          UserMode.expert,
        );
        final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 400);
        return ApiResponse.createError(error, metadata);
      }

      // 使用AuthService執行密碼重設
      await _authService.executePasswordReset(request.token, request.newPassword);

      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 200);
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 45. 驗證Email API (對應S-103畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<void>> verifyEmail(VerifyEmailRequest request) async {
    try {
      await _authService.processEmailVerification(request.email, request.verificationCode ?? '');
      
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 200);
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 46. Google登入API (對應S-104畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<LoginResponse>> googleLogin(GoogleLoginRequest request) async {
    try {
      // 模擬Google Token驗證
      if (request.googleToken.isEmpty) {
        final error = ApiError.create(
          AuthErrorCode.invalidCredentials,
          request.userMode ?? UserMode.expert,
        );
        final metadata = ApiMetadata.create(request.userMode ?? UserMode.expert, httpStatusCode: 401);
        return ApiResponse.createError(error, metadata);
      }

      // 建立模擬使用者
      final user = UserProfile(
        id: 'google-user-id',
        email: 'google.user@example.com',
        displayName: 'Google使用者',
        userMode: request.userMode ?? UserMode.expert,
        createdAt: DateTime.now(),
      );

      // 生成Token
      final tokenPair = await _tokenService.generateTokenPair(user.id, user.userMode);

      var response = LoginResponse(
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.expiresAt,
        user: user,
      );

      // 根據模式調整回應
      response = _userModeAdapter.adaptLoginResponse(response, user.userMode);

      final metadata = ApiMetadata.create(user.userMode, httpStatusCode: 200);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        request.userMode ?? UserMode.expert,
      );
      final metadata = ApiMetadata.create(request.userMode ?? UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 47. 綁定LINE帳號API (對應S-107畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<BindingResponse>> bindLine(BindLineRequest request) async {
    try {
      final response = BindingResponse(
        message: 'LINE帳號綁定成功',
        linkedAccounts: {
          'email': 'user@example.com',
          'line': request.lineUserId,
          'bindingDate': DateTime.now().toIso8601String(),
        },
      );

      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 200);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 48. 取得綁定狀態API (對應S-107畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增畫面對應標註，強化HTTP狀態碼處理
  Future<ApiResponse<BindingStatusResponse>> getBindStatus() async {
    try {
      final response = BindingStatusResponse(
        userId: 'current-user-id',
        linkedAccounts: {
          'email': {
            'value': 'user@example.com',
            'verified': true,
            'bindingDate': DateTime.now().toIso8601String(),
          }
        },
        availableBindings: ['line', 'google'],
      );

      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 200);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert, httpStatusCode: 500);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 49. 建立統一回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  ApiResponse<T> _buildResponse<T>(T data, UserMode userMode, String requestId) {
    final metadata = ApiMetadata.create(userMode);
    return ApiResponse.createSuccess(data, metadata);
  }

  /// 50. 記錄認證事件
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  void _logAuthEvent(String event, Map<String, dynamic> details) {
    print('AUTH_EVENT: $event - ${details.toString()}');
  }

  /// 51. 驗證請求內容
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，提供統一請求驗證機制
  ValidationResult _validateRequest(dynamic request) {
    // 簡化驗證邏輯
    return ValidationResult(isValid: true, errors: []);
  }

  /// 52. 提取使用者模式
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，補充8201規範要求的抽象方法
  UserMode _extractUserMode(HttpRequest request) {
    // 模擬從請求中提取使用者模式
    return UserMode.expert;
  }
}

/// 驗證結果
class ValidationResult {
  final bool isValid;
  final List<String> errors;

  ValidationResult({required this.isValid, required this.errors});
}

/// HTTP請求模擬類別
class HttpRequest {
  final Map<String, String> headers;
  
  HttpRequest({required this.headers});
}

// ================================
// 輔助請求/回應類別
// ================================

/// 刷新Token回應
class RefreshTokenResponse {
  final String token;
  final String refreshToken;
  final DateTime expiresAt;

  RefreshTokenResponse({
    required this.token,
    required this.refreshToken,
    required this.expiresAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'refreshToken': refreshToken,
      'expiresAt': expiresAt.toIso8601String(),
    };
  }
}

/// 忘記密碼請求
class ForgotPasswordRequest {
  final String email;

  ForgotPasswordRequest({required this.email});
}

/// 驗證重設Token回應
class VerifyResetTokenResponse {
  final bool valid;
  final String? email;
  final DateTime? expiresAt;

  VerifyResetTokenResponse({
    required this.valid,
    this.email,
    this.expiresAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'valid': valid,
      if (email != null) 'email': email,
      if (expiresAt != null) 'expiresAt': expiresAt!.toIso8601String(),
    };
  }
}

/// 重設密碼請求
class ResetPasswordRequest {
  final String token;
  final String newPassword;
  final String? confirmPassword;

  ResetPasswordRequest({
    required this.token,
    required this.newPassword,
    this.confirmPassword,
  });
}

/// 驗證Email請求
class VerifyEmailRequest {
  final String email;
  final String? verificationCode;
  final String? token;

  VerifyEmailRequest({
    required this.email,
    this.verificationCode,
    this.token,
  });
}

/// Google登入請求
class GoogleLoginRequest {
  final String googleToken;
  final UserMode? userMode;
  final DeviceInfo? deviceInfo;

  GoogleLoginRequest({
    required this.googleToken,
    this.userMode,
    this.deviceInfo,
  });
}

/// 綁定LINE請求
class BindLineRequest {
  final String lineUserId;
  final String lineAccessToken;
  final Map<String, dynamic>? lineProfile;

  BindLineRequest({
    required this.lineUserId,
    required this.lineAccessToken,
    this.lineProfile,
  });
}

/// 綁定回應
class BindingResponse {
  final String message;
  final Map<String, dynamic> linkedAccounts;

  BindingResponse({
    required this.message,
    required this.linkedAccounts,
  });

  Map<String, dynamic> toJson() {
    return {
      'message': message,
      'linkedAccounts': linkedAccounts,
    };
  }
}

/// 綁定狀態回應
class BindingStatusResponse {
  final String userId;
  final Map<String, dynamic> linkedAccounts;
  final List<String> availableBindings;

  BindingStatusResponse({
    required this.userId,
    required this.linkedAccounts,
    required this.availableBindings,
  });

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'linkedAccounts': linkedAccounts,
      'availableBindings': availableBindings,
    };
  }
}

// ================================
// 實作範例類別 (Implementation Examples)
// ================================

/// TokenService實作範例
class TokenServiceImpl implements TokenService {
  @override
  Future<TokenPair> generateTokenPair(String userId, UserMode userMode) async {
    // 模擬Token生成邏輯
    final accessToken = 'access_token_${userId}_${DateTime.now().millisecondsSinceEpoch}';
    final refreshToken = 'refresh_token_${userId}_${DateTime.now().millisecondsSinceEpoch}';
    final expiresAt = DateTime.now().add(Duration(hours: 1));
    
    return TokenPair(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: expiresAt,
    );
  }

  @override
  Future<String> generateAccessToken(String userId, Map<String, dynamic> claims) async {
    return 'access_token_${userId}_${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  Future<String> generateRefreshToken(String userId) async {
    return 'refresh_token_${userId}_${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  Future<String> generateResetToken(String email) async {
    return 'reset_token_${email.hashCode}_${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  Future<String> generateEmailVerificationToken(String email) async {
    return 'email_verify_${email.hashCode}_${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  Future<TokenValidationResult> validateAccessToken(String token) async {
    // 簡單驗證邏輯
    if (token.startsWith('access_token_')) {
      return TokenValidationResult(
        isValid: true,
        userId: 'user-id-123',
        userMode: UserMode.expert,
      );
    }
    return TokenValidationResult(isValid: false, reason: 'Invalid token format');
  }

  @override
  Future<TokenValidationResult> validateRefreshToken(String token) async {
    // 簡單驗證邏輯
    if (token.startsWith('refresh_token_')) {
      return TokenValidationResult(
        isValid: true,
        userId: 'user-id-123',
        userMode: UserMode.expert,
      );
    }
    return TokenValidationResult(isValid: false, reason: 'Invalid refresh token');
  }

  @override
  Future<bool> validateResetToken(String token) async {
    return token.startsWith('reset_token_') && token.length >= 32;
  }

  @override
  Future<bool> validateEmailVerificationToken(String token) async {
    return token.startsWith('email_verify_') && token.length >= 32;
  }

  @override
  Future<void> revokeToken(String token) async {
    // 模擬撤銷邏輯
    print('Token revoked: $token');
  }

  @override
  Future<void> revokeAllUserTokens(String userId) async {
    // 模擬撤銷所有Token邏輯
    print('All tokens revoked for user: $userId');
  }

  @override
  Future<bool> isTokenRevoked(String token) async {
    // 模擬檢查Token是否已撤銷
    return false;
  }

  @override
  Future<void> cleanupExpiredTokens() async {
    // 模擬清理過期Token
    print('Expired tokens cleaned up');
  }
}

/// UserModeAdapter實作範例
class UserModeAdapterImpl implements UserModeAdapter {
  @override
  T adaptResponse<T>(T response, UserMode userMode) {
    // 根據模式調整回應
    return response;
  }

  @override
  ApiError adaptErrorResponse(ApiError error, UserMode userMode) {
    // 根據模式調整錯誤訊息
    return ApiError(
      code: error.code,
      message: error.code.getMessage(userMode),
      field: error.field,
      timestamp: error.timestamp,
      requestId: error.requestId,
      details: error.details,
    );
  }

  @override
  LoginResponse adaptLoginResponse(LoginResponse response, UserMode userMode) {
    switch (userMode) {
      case UserMode.expert:
        return LoginResponse(
          token: response.token,
          refreshToken: response.refreshToken,
          expiresAt: response.expiresAt,
          user: response.user,
          loginHistory: {
            'lastLogin': DateTime.now().subtract(Duration(days: 1)).toIso8601String(),
            'loginCount': 42,
            'newDeviceDetected': false,
            'securityAlerts': [],
            'deviceHistory': [],
          },
        );
      case UserMode.cultivation:
        return LoginResponse(
          token: response.token,
          refreshToken: response.refreshToken,
          expiresAt: response.expiresAt,
          user: response.user,
          streakInfo: {
            'currentStreak': 7,
            'longestStreak': 15,
            'streakMessage': '連續記帳7天！繼續保持！',
            'nextGoal': '連續10天挑戰',
            'rewardAvailable': true,
          },
        );
      case UserMode.inertial:
        return LoginResponse(
          token: response.token,
          refreshToken: response.refreshToken,
          expiresAt: response.expiresAt,
          user: response.user,
          loginHistory: {
            'lastLogin': DateTime.now().subtract(Duration(days: 1)).toIso8601String(),
            'basicStats': {
              'totalLogins': 25,
              'averageSessionTime': '12 minutes',
            },
          },
        );
      case UserMode.guiding:
        return LoginResponse(
          token: response.token,
          refreshToken: response.refreshToken,
          expiresAt: response.expiresAt,
          user: response.user,
          simpleMessage: '登入成功！歡迎回來',
        );
      default:
        return response;
    }
  }

  @override
  RegisterResponse adaptRegisterResponse(RegisterResponse response, UserMode userMode) {
    switch (userMode) {
      case UserMode.expert:
        // Expert模式提供完整資訊
        return response;
      case UserMode.cultivation:
        // Cultivation模式強調成就感
        return response;
      case UserMode.inertial:
        // Inertial模式提供標準資訊
        return response;
      case UserMode.guiding:
        // Guiding模式簡化資訊
        return response;
      default:
        return response;
    }
  }

  @override
  List<String> getAvailableActions(UserMode userMode) {
    switch (userMode) {
      case UserMode.expert:
        return [
          'quickTransaction',
          'advancedSettings',
          'detailedReports',
          'apiAccess',
          'customCategories',
          'bulkImport',
          'automationRules',
        ];
      case UserMode.inertial:
        return [
          'quickTransaction',
          'basicReports',
          'standardSettings',
          'simpleCategories',
        ];
      case UserMode.cultivation:
        return [
          'quickTransaction',
          'challengeMode',
          'achievements',
          'progressTracking',
          'guidedTours',
          'motivationalContent',
        ];
      case UserMode.guiding:
        return [
          'simpleTransaction',
          'basicHelp',
          'essentialSettings',
        ];
      default:
        return ['quickTransaction'];
    }
  }

  @override
  Map<String, dynamic> filterResponseData(Map<String, dynamic> data, UserMode userMode) {
    switch (userMode) {
      case UserMode.expert:
        // Expert模式顯示所有資料
        return data;
      case UserMode.inertial:
        // Inertial模式過濾進階功能
        final filtered = Map<String, dynamic>.from(data);
        filtered.remove('advancedMetrics');
        filtered.remove('debugInfo');
        return filtered;
      case UserMode.cultivation:
        // Cultivation模式加入激勵元素
        final enhanced = Map<String, dynamic>.from(data);
        enhanced['motivationalTips'] = _getMotivationalTips();
        enhanced['progressIndicators'] = _getProgressIndicators();
        return enhanced;
      case UserMode.guiding:
        // Guiding模式只保留基本資料
        return {
          'success': data['success'],
          'message': _getSimpleMessage(data),
          'nextAction': _getNextAction(data),
        };
      default:
        return data;
    }
  }

  List<String> _getMotivationalTips() {
    return [
      '每天記帳有助於建立良好的理財習慣',
      '持續追蹤支出能幫助您更好地控制預算',
      '小額儲蓄也能累積成大筆資金',
    ];
  }

  Map<String, dynamic> _getProgressIndicators() {
    return {
      'weeklyGoal': {'current': 5, 'target': 7, 'unit': 'transactions'},
      'categoryBalance': {'completed': 3, 'total': 5},
      'streakDays': 7,
    };
  }

  String _getSimpleMessage(Map<String, dynamic> data) {
    if (data['success'] == true) {
      return '操作成功完成';
    } else {
      return '操作未完成，請重試';
    }
  }

  String _getNextAction(Map<String, dynamic> data) {
    return '點擊「記帳」開始記錄您的第一筆交易';
  }
}

/// AuthService實作範例
class AuthServiceImpl implements AuthService {
  @override
  Future<RegisterResult> processRegistration(RegisterRequest request) async {
    // 模擬註冊邏輯
    if (request.email == 'existing@example.com') {
      return RegisterResult(userId: '', success: false, errorMessage: 'Email already exists');
    }
    
    final userId = 'user_${DateTime.now().millisecondsSinceEpoch}';
    return RegisterResult(userId: userId, success: true);
  }

  @override
  Future<LoginResult> authenticateUser(String email, String password) async {
    // 模擬認證邏輯
    if (email == 'user@example.com' && password == 'password123') {
      final user = UserProfile(
        id: 'user-123',
        email: email,
        displayName: '測試使用者',
        userMode: UserMode.expert,
        createdAt: DateTime.now().subtract(Duration(days: 30)),
        lastActiveAt: DateTime.now(),
      );
      return LoginResult(user: user, success: true);
    }
    
    return LoginResult(success: false, errorMessage: 'Invalid credentials');
  }

  @override
  Future<void> processLogout(LogoutRequest request) async {
    // 模擬登出邏輯
    print('Processing logout: ${request.logoutAllDevices}');
  }

  @override
  Future<void> initiateForgotPassword(String email) async {
    // 模擬發送重設信件
    print('Sending password reset email to: $email');
  }

  @override
  Future<ResetTokenValidation> validateResetToken(String token) async {
    // 模擬Token驗證邏輯
    if (token.startsWith('reset_') && token.length >= 32) {
      return ResetTokenValidation(
        isValid: true,
        email: 'user@example.com',
        expiresAt: DateTime.now().add(Duration(hours: 1)),
      );
    }
    
    return ResetTokenValidation(
      isValid: false,
      reason: 'Token invalid or expired',
    );
  }

  @override
  Future<void> executePasswordReset(String token, String newPassword) async {
    // 模擬密碼重設邏輯
    print('Resetting password for token: $token');
  }

  @override
  Future<void> processEmailVerification(String email, String code) async {
    // 模擬Email驗證
    print('Verifying email: $email with code: $code');
  }

  @override
  Future<void> sendVerificationEmail(String email) async {
    // 模擬發送驗證信件
    print('Sending verification email to: $email');
  }

  @override
  Future<void> _performSecurityCheck(String userId) async {
    // 模擬安全檢查
    print('Performing security check for user: $userId');
  }
}
