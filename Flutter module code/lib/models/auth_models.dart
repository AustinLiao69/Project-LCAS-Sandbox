
/**
 * Auth_Models_1.0.0
 * @module 認證資料模型
 * @description LCAS 2.0 使用者認證相關的資料模型定義
 * @update 2025-01-23: 建立版本，定義認證流程的資料結構
 */

import 'package:json_annotation/json_annotation.dart';

part 'auth_models.g.dart';

/// 01. 使用者註冊請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義使用者註冊所需的資料格式
@JsonSerializable()
class RegisterRequest {
  @JsonKey(name: 'email')
  final String email;
  
  @JsonKey(name: 'password')
  final String password;
  
  @JsonKey(name: 'display_name')
  final String displayName;
  
  @JsonKey(name: 'platform')
  final String platform; // 'app', 'line'
  
  @JsonKey(name: 'timezone')
  final String? timezone;
  
  @JsonKey(name: 'language')
  final String? language;

  const RegisterRequest({
    required this.email,
    required this.password,
    required this.displayName,
    required this.platform,
    this.timezone,
    this.language,
  });

  factory RegisterRequest.fromJson(Map<String, dynamic> json) =>
      _$RegisterRequestFromJson(json);

  Map<String, dynamic> toJson() => _$RegisterRequestToJson(this);
}

/// 02. 使用者登入請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義使用者登入所需的資料格式
@JsonSerializable()
class LoginRequest {
  @JsonKey(name: 'email')
  final String email;
  
  @JsonKey(name: 'password')
  final String password;
  
  @JsonKey(name: 'platform')
  final String platform;
  
  @JsonKey(name: 'device_id')
  final String? deviceId;
  
  @JsonKey(name: 'remember_me')
  final bool rememberMe;

  const LoginRequest({
    required this.email,
    required this.password,
    required this.platform,
    this.deviceId,
    this.rememberMe = false,
  });

  factory LoginRequest.fromJson(Map<String, dynamic> json) =>
      _$LoginRequestFromJson(json);

  Map<String, dynamic> toJson() => _$LoginRequestToJson(this);
}

/// 03. 認證回應
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義認證成功後的回應資料格式
@JsonSerializable()
class AuthResponse {
  @JsonKey(name: 'access_token')
  final String accessToken;
  
  @JsonKey(name: 'refresh_token')
  final String refreshToken;
  
  @JsonKey(name: 'token_type')
  final String tokenType;
  
  @JsonKey(name: 'expires_in')
  final int expiresIn; // 秒數
  
  @JsonKey(name: 'user')
  final UserInfo user;

  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    this.tokenType = 'Bearer',
    required this.expiresIn,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);

  Map<String, dynamic> toJson() => _$AuthResponseToJson(this);
}

/// 04. 使用者資訊
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義使用者基本資訊的資料格式
@JsonSerializable()
class UserInfo {
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'email')
  final String email;
  
  @JsonKey(name: 'display_name')
  final String displayName;
  
  @JsonKey(name: 'avatar_url')
  final String? avatarUrl;
  
  @JsonKey(name: 'platform')
  final String platform;
  
  @JsonKey(name: 'user_type')
  final String userType; // 'basic', 'premium'
  
  @JsonKey(name: 'status')
  final String status; // 'active', 'inactive', 'suspended'
  
  @JsonKey(name: 'created_at')
  final String createdAt;
  
  @JsonKey(name: 'last_login')
  final String? lastLogin;
  
  @JsonKey(name: 'timezone')
  final String? timezone;
  
  @JsonKey(name: 'language')
  final String? language;

  const UserInfo({
    required this.userId,
    required this.email,
    required this.displayName,
    this.avatarUrl,
    required this.platform,
    this.userType = 'basic',
    this.status = 'active',
    required this.createdAt,
    this.lastLogin,
    this.timezone,
    this.language,
  });

  factory UserInfo.fromJson(Map<String, dynamic> json) =>
      _$UserInfoFromJson(json);

  Map<String, dynamic> toJson() => _$UserInfoToJson(this);
}

/// 05. 密碼重設請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義密碼重設請求的資料格式
@JsonSerializable()
class ResetPasswordRequest {
  @JsonKey(name: 'email')
  final String email;
  
  @JsonKey(name: 'platform')
  final String platform;

  const ResetPasswordRequest({
    required this.email,
    required this.platform,
  });

  factory ResetPasswordRequest.fromJson(Map<String, dynamic> json) =>
      _$ResetPasswordRequestFromJson(json);

  Map<String, dynamic> toJson() => _$ResetPasswordRequestToJson(this);
}

/// 06. 使用者設定更新請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義使用者設定更新的資料格式
@JsonSerializable()
class UpdateUserSettingsRequest {
  @JsonKey(name: 'display_name')
  final String? displayName;
  
  @JsonKey(name: 'avatar_url')
  final String? avatarUrl;
  
  @JsonKey(name: 'timezone')
  final String? timezone;
  
  @JsonKey(name: 'language')
  final String? language;
  
  @JsonKey(name: 'currency')
  final String? currency;
  
  @JsonKey(name: 'date_format')
  final String? dateFormat;
  
  @JsonKey(name: 'notification_settings')
  final Map<String, bool>? notificationSettings;

  const UpdateUserSettingsRequest({
    this.displayName,
    this.avatarUrl,
    this.timezone,
    this.language,
    this.currency,
    this.dateFormat,
    this.notificationSettings,
  });

  factory UpdateUserSettingsRequest.fromJson(Map<String, dynamic> json) =>
      _$UpdateUserSettingsRequestFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateUserSettingsRequestToJson(this);
}

/// 07. Token刷新請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義Token刷新請求的資料格式
@JsonSerializable()
class RefreshTokenRequest {
  @JsonKey(name: 'refresh_token')
  final String refreshToken;

  const RefreshTokenRequest({
    required this.refreshToken,
  });

  factory RefreshTokenRequest.fromJson(Map<String, dynamic> json) =>
      _$RefreshTokenRequestFromJson(json);

  Map<String, dynamic> toJson() => _$RefreshTokenRequestToJson(this);
}
