
/**
 * auth_models.dart_認證資料模型_1.0.0
 * @module 認證資料模型
 * @description LCAS 2.0 Flutter 認證相關資料模型 - 使用者註冊登入、Token管理等資料結構
 * @update 2025-01-24: 建立認證相關資料模型，支援JWT Token管理和使用者資料結構
 */

import 'package:json_annotation/json_annotation.dart';

part 'auth_models.g.dart';

/// 使用者註冊請求模型
@JsonSerializable()
class RegisterRequest {
  final String email;
  final String password;
  final String displayName;
  final String? phoneNumber;
  final Map<String, dynamic>? metadata;

  const RegisterRequest({
    required this.email,
    required this.password,
    required this.displayName,
    this.phoneNumber,
    this.metadata,
  });

  factory RegisterRequest.fromJson(Map<String, dynamic> json) =>
      _$RegisterRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$RegisterRequestToJson(this);
}

/// 使用者登入請求模型
@JsonSerializable()
class LoginRequest {
  final String email;
  final String password;
  final String? deviceId;
  final bool rememberMe;

  const LoginRequest({
    required this.email,
    required this.password,
    this.deviceId,
    this.rememberMe = false,
  });

  factory LoginRequest.fromJson(Map<String, dynamic> json) =>
      _$LoginRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$LoginRequestToJson(this);
}

/// 認證回應模型
@JsonSerializable()
class AuthResponse {
  final bool success;
  final String? accessToken;
  final String? refreshToken;
  final UserProfile? user;
  final String message;
  final int? expiresIn;
  final DateTime timestamp;

  const AuthResponse({
    required this.success,
    this.accessToken,
    this.refreshToken,
    this.user,
    required this.message,
    this.expiresIn,
    required this.timestamp,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$AuthResponseToJson(this);
}

/// 使用者基本資料模型
@JsonSerializable()
class UserProfile {
  final String uid;
  final String email;
  final String displayName;
  final String? phoneNumber;
  final String? photoUrl;
  final bool emailVerified;
  final DateTime createdAt;
  final DateTime? lastLoginAt;
  final UserSettings? settings;

  const UserProfile({
    required this.uid,
    required this.email,
    required this.displayName,
    this.phoneNumber,
    this.photoUrl,
    required this.emailVerified,
    required this.createdAt,
    this.lastLoginAt,
    this.settings,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) =>
      _$UserProfileFromJson(json);
  
  Map<String, dynamic> toJson() => _$UserProfileToJson(this);

  /// 複製模型並更新部分欄位
  UserProfile copyWith({
    String? uid,
    String? email,
    String? displayName,
    String? phoneNumber,
    String? photoUrl,
    bool? emailVerified,
    DateTime? createdAt,
    DateTime? lastLoginAt,
    UserSettings? settings,
  }) {
    return UserProfile(
      uid: uid ?? this.uid,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      photoUrl: photoUrl ?? this.photoUrl,
      emailVerified: emailVerified ?? this.emailVerified,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      settings: settings ?? this.settings,
    );
  }
}

/// 使用者設定模型
@JsonSerializable()
class UserSettings {
  final String timezone;
  final String language;
  final String currency;
  final bool notifications;
  final Map<String, dynamic>? preferences;

  const UserSettings({
    required this.timezone,
    required this.language,
    required this.currency,
    required this.notifications,
    this.preferences,
  });

  factory UserSettings.fromJson(Map<String, dynamic> json) =>
      _$UserSettingsFromJson(json);
  
  Map<String, dynamic> toJson() => _$UserSettingsToJson(this);
}

/// 密碼重設請求模型
@JsonSerializable()
class ResetPasswordRequest {
  final String email;
  final String? newPassword;
  final String? resetCode;

  const ResetPasswordRequest({
    required this.email,
    this.newPassword,
    this.resetCode,
  });

  factory ResetPasswordRequest.fromJson(Map<String, dynamic> json) =>
      _$ResetPasswordRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$ResetPasswordRequestToJson(this);
}

/// JWT Token 資訊模型
@JsonSerializable()
class TokenInfo {
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;
  final String tokenType;
  final List<String> scopes;

  const TokenInfo({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    this.tokenType = 'Bearer',
    this.scopes = const [],
  });

  factory TokenInfo.fromJson(Map<String, dynamic> json) =>
      _$TokenInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$TokenInfoToJson(this);

  /// 檢查Token是否即將過期（15分鐘內）
  bool get isExpiringSoon {
    return DateTime.now().add(const Duration(minutes: 15)).isAfter(expiresAt);
  }

  /// 檢查Token是否已過期
  bool get isExpired {
    return DateTime.now().isAfter(expiresAt);
  }
}
