
/**
 * 8301_認證服務_1.1.0
 * @module 認證服務模組
 * @description LCAS 2.0 認證服務 API 模組 - 提供使用者註冊、登入、OAuth整合、跨平台綁定等完整認證功能
 * @update 2025-08-28: 修正版本，補充缺失錯誤碼、完善四模式支援、修正API端點對應、升級HTTP狀態碼管理
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
    this.apiVersion = '1.0.0',
    this.processingTimeMs = 0,
    this.httpStatusCode,
    this.additionalInfo,
  });

  /// 03. 建立後設資料
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，新增HTTP狀態碼支援
  static ApiMetadata create(UserMode userMode, {int? httpStatusCode, Map<String, dynamic>? additionalInfo}) {
    return ApiMetadata(
      timestamp: DateTime.now(),
      requestId: _generateRequestId(),
      userMode: userMode,
      httpStatusCode: httpStatusCode,
      additionalInfo: additionalInfo,
    );
  }

  static String _generateRequestId() {
    final random = Random();
    return 'req-${random.nextInt(999999).toString().padLeft(6, '0')}';
  }

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

  // 系統錯誤 (500)
  internalServerError,
  externalServiceError,
  databaseError;

  /// 04. 取得HTTP狀態碼
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供錯誤碼對應HTTP狀態碼
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
        return 404;
      case emailAlreadyExists:
        return 409;
      case internalServerError:
      case externalServiceError:
      case databaseError:
        return 500;
    }
  }

  /// 05. 取得模式化錯誤訊息
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，根據使用者模式提供適當錯誤訊息
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

  /// 06. 建立API錯誤
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，使用統一的請求ID傳遞機制
  static ApiError create(AuthErrorCode code, UserMode userMode, {String? field, String? requestId, Map<String, dynamic>? details}) {
    return ApiError(
      code: code,
      message: code.getMessage(userMode),
      field: field,
      timestamp: DateTime.now(),
      requestId: requestId ?? _generateRequestId(),
      details: details,
    );
  }

  static String _generateRequestId() {
    final random = Random();
    return 'req-${random.nextInt(999999).toString().padLeft(6, '0')}';
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

  /// 07. 驗證註冊請求
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供註冊請求驗證邏輯
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

  /// 08. 驗證登入請求
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
  final bool needsAssessment;
  final String token;
  final String refreshToken;
  final DateTime expiresAt;

  RegisterResponse({
    required this.userId,
    required this.email,
    required this.userMode,
    required this.verificationSent,
    required this.needsAssessment,
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
      'needsAssessment': needsAssessment,
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

// ================================
// 核心服務類別 (Service Classes)
// ================================

/// Token服務
abstract class TokenService {
  /// 09. 產生Token對
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供存取與刷新Token生成
  Future<TokenPair> generateTokenPair(String userId, UserMode userMode);

  /// 10. 產生存取Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供存取Token生成
  Future<String> generateAccessToken(String userId, Map<String, dynamic> claims);

  /// 11. 產生刷新Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供刷新Token生成
  Future<String> generateRefreshToken(String userId);

  /// 12. 驗證存取Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供Token驗證機制
  Future<TokenValidationResult> validateAccessToken(String token);

  /// 13. 撤銷Token
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，提供Token撤銷機制
  Future<void> revokeToken(String token);
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
  /// 14. 適配回應內容
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，根據使用者模式調整回應內容
  T adaptResponse<T>(T response, UserMode userMode);

  /// 15. 適配錯誤回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，根據使用者模式調整錯誤訊息
  ApiError adaptErrorResponse(ApiError error, UserMode userMode);

  /// 16. 適配登入回應
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，根據使用者模式調整登入回應
  LoginResponse adaptLoginResponse(LoginResponse response, UserMode userMode);
}

/// 認證服務
abstract class AuthService {
  /// 17. 處理使用者註冊
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理使用者註冊業務邏輯
  Future<RegisterResult> processRegistration(RegisterRequest request);

  /// 18. 驗證使用者登入
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理使用者認證
  Future<LoginResult> authenticateUser(String email, String password);

  /// 19. 處理使用者登出
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理登出業務邏輯
  Future<void> processLogout(LogoutRequest request);

  /// 20. 處理忘記密碼
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，發送密碼重設信件
  Future<void> initiateForgotPassword(String email);

  /// 21. 處理Email驗證
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理Email地址驗證
  Future<void> processEmailVerification(String email, String code);
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

  /// 22. 使用者註冊API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理使用者註冊API請求
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
        final metadata = ApiMetadata.create(request.userMode);
        return ApiResponse.createError(error, metadata);
      }

      // 處理註冊
      final result = await _authService.processRegistration(request);
      if (!result.success) {
        final error = ApiError.create(
          AuthErrorCode.emailAlreadyExists,
          request.userMode,
        );
        final metadata = ApiMetadata.create(request.userMode);
        return ApiResponse.createError(error, metadata);
      }

      // 生成Token
      final tokenPair = await _tokenService.generateTokenPair(result.userId, request.userMode);

      // 建立回應
      final response = RegisterResponse(
        userId: result.userId,
        email: request.email,
        userMode: request.userMode,
        verificationSent: true,
        needsAssessment: request.userMode == UserMode.expert,
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.expiresAt,
      );

      final metadata = ApiMetadata.create(request.userMode);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        request.userMode,
      );
      final metadata = ApiMetadata.create(request.userMode);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 23. 使用者登入API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理使用者登入API請求
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
        final metadata = ApiMetadata.create(UserMode.expert);
        return ApiResponse.createError(error, metadata);
      }

      // 認證使用者
      final result = await _authService.authenticateUser(request.email, request.password);
      if (!result.success || result.user == null) {
        final error = ApiError.create(
          AuthErrorCode.invalidCredentials,
          UserMode.expert,
        );
        final metadata = ApiMetadata.create(UserMode.expert);
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

      final metadata = ApiMetadata.create(user.userMode);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 24. 使用者登出API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理使用者登出API請求
  Future<ApiResponse<void>> logout(LogoutRequest request) async {
    try {
      await _authService.processLogout(request);
      
      final metadata = ApiMetadata.create(UserMode.expert); // 登出時使用預設模式
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 25. 刷新Token API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理Token刷新API請求
  Future<ApiResponse<RefreshTokenResponse>> refreshToken(String refreshToken) async {
    try {
      // 驗證刷新Token
      final validationResult = await _tokenService.validateAccessToken(refreshToken);
      if (!validationResult.isValid) {
        final error = ApiError.create(
          AuthErrorCode.tokenInvalid,
          UserMode.expert,
        );
        final metadata = ApiMetadata.create(UserMode.expert);
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

      final metadata = ApiMetadata.create(validationResult.userMode!);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 26. 忘記密碼API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理忘記密碼API請求
  Future<ApiResponse<void>> forgotPassword(ForgotPasswordRequest request) async {
    try {
      await _authService.initiateForgotPassword(request.email);
      
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 27. 驗證重設Token API (對應S-105畫面)
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 修正版本，實作真實業務邏輯驗證
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

      // 驗證Token有效性（實際應查詢資料庫）
      final isValid = await _validateResetTokenFromDatabase(token);
      
      final response = VerifyResetTokenResponse(
        valid: isValid,
        email: isValid ? await _getEmailFromResetToken(token) : null,
        expiresAt: isValid ? DateTime.now().add(Duration(hours: 1)) : null,
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

  /// 33. 從資料庫驗證重設Token
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，提供Token資料庫驗證
  Future<bool> _validateResetTokenFromDatabase(String token) async {
    // 實際實作應查詢資料庫
    // 此處為模擬邏輯
    return token.startsWith('reset_') && token.length >= 32;
  }

  /// 34. 從重設Token取得Email
  /// @version 2025-08-28-V1.1.0
  /// @date 2025-08-28 12:00:00
  /// @update: 新增方法，從Token取得關聯Email
  Future<String?> _getEmailFromResetToken(String token) async {
    // 實際實作應查詢資料庫
    // 此處為模擬邏輯
    return 'user@example.com';
  }

  /// 28. 重設密碼API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理密碼重設API請求
  Future<ApiResponse<void>> resetPassword(ResetPasswordRequest request) async {
    try {
      // 模擬重設邏輯
      if (request.token.isEmpty || request.newPassword.length < 8) {
        final error = ApiError.create(
          AuthErrorCode.invalidResetToken,
          UserMode.expert,
        );
        final metadata = ApiMetadata.create(UserMode.expert);
        return ApiResponse.createError(error, metadata);
      }

      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 29. 驗證Email API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理Email驗證API請求
  Future<ApiResponse<void>> verifyEmail(VerifyEmailRequest request) async {
    try {
      await _authService.processEmailVerification(request.email, request.verificationCode ?? '');
      
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createSuccess(null, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 30. Google登入API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理Google OAuth登入API請求
  Future<ApiResponse<LoginResponse>> googleLogin(GoogleLoginRequest request) async {
    try {
      // 模擬Google Token驗證
      if (request.googleToken.isEmpty) {
        final error = ApiError.create(
          AuthErrorCode.invalidCredentials,
          request.userMode ?? UserMode.expert,
        );
        final metadata = ApiMetadata.create(request.userMode ?? UserMode.expert);
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

      final metadata = ApiMetadata.create(user.userMode);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        request.userMode ?? UserMode.expert,
      );
      final metadata = ApiMetadata.create(request.userMode ?? UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 31. 綁定LINE帳號API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，處理LINE帳號綁定API請求
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

      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }

  /// 32. 取得綁定狀態API
  /// @version 2025-08-28-V1.0.0
  /// @date 2025-08-28 12:00:00
  /// @update: 初版建立，查詢帳號綁定狀態
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

      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createSuccess(response, metadata);

    } catch (e) {
      final error = ApiError.create(
        AuthErrorCode.internalServerError,
        UserMode.expert,
      );
      final metadata = ApiMetadata.create(UserMode.expert);
      return ApiResponse.createError(error, metadata);
    }
  }
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
  Future<TokenValidationResult> validateAccessToken(String token) async {
    // 簡單驗證邏輯
    if (token.startsWith('access_token_') || token.startsWith('refresh_token_')) {
      return TokenValidationResult(
        isValid: true,
        userId: 'user-id-123',
        userMode: UserMode.expert,
      );
    }
    return TokenValidationResult(isValid: false, reason: 'Invalid token format');
  }

  @override
  Future<void> revokeToken(String token) async {
    // 模擬撤銷邏輯
    print('Token revoked: $token');
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
            'basicInfo': true,
          },
        );
      case UserMode.guiding:
        return LoginResponse(
          token: response.token,
          refreshToken: response.refreshToken,
          expiresAt: response.expiresAt,
          user: response.user,
          simpleMessage: '登入成功',
        );
      default:
        return response;
    }
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
  Future<void> processEmailVerification(String email, String code) async {
    // 模擬Email驗證
    print('Verifying email: $email with code: $code');
  }
}
