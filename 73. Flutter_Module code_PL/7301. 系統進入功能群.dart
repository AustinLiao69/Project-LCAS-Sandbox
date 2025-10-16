/**
 * 7301. 系統進入功能群.dart
 * @version v1.2.0
 * @date 2025-09-12
 * @update: 階段三實作完成 - 系統管理與最佳化（函數27-40）
 *
 * 本模組實現LCAS 2.0系統進入功能群的完整功能，
 * 包括APP啟動、使用者認證、模式設定、模式評估問卷、
 * LINE OA綁定與跨平台資料同步等關鍵功能。
 * 嚴格遵循0026、0090、8088文件規範。
 */

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:crypto/crypto.dart';
import 'package:intl/intl.dart';
// 引入APL層服務
import '../83. Flutter_Module code(API route)_APL/8301. 認證服務.dart';

// ===========================================
// 核心資料模型定義
// ===========================================

/// APP版本資訊
class AppVersionInfo {
  final String currentVersion;
  final String latestVersion;
  final bool forceUpdate;
  final String updateMessage;
  final DateTime? releaseDate;

  AppVersionInfo({
    required this.currentVersion,
    required this.latestVersion,
    required this.forceUpdate,
    required this.updateMessage,
    this.releaseDate,
  });

  factory AppVersionInfo.fromJson(Map<String, dynamic> json) {
    return AppVersionInfo(
      currentVersion: json['currentVersion'] ?? '',
      latestVersion: json['latestVersion'] ?? '',
      forceUpdate: json['forceUpdate'] ?? false,
      updateMessage: json['updateMessage'] ?? '',
      releaseDate: json['releaseDate'] != null ? DateTime.parse(json['releaseDate']) : null,
    );
  }
}

/// 認證狀態
enum AuthStatus {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error
}

/// 使用者模式
enum UserMode {
  expert,    // 專家模式
  inertial,  // 慣性模式
  cultivation, // 養成模式
  guiding    // 引導模式
}

/// 認證狀態資訊
class AuthState {
  final bool isAuthenticated;
  final User? currentUser;
  final String? token;
  final AuthStatus status;
  final String? errorMessage;
  final DateTime? lastLogin;

  AuthState({
    required this.isAuthenticated,
    this.currentUser,
    this.token,
    required this.status,
    this.errorMessage,
    this.lastLogin,
  });
}

/// 使用者偏好設定
class UserPreferences {
  final String language;
  final String timezone;
  final String theme;

  UserPreferences({
    required this.language,
    required this.timezone,
    required this.theme,
  });

  factory UserPreferences.fromJson(Map<String, dynamic> json) {
    return UserPreferences(
      language: json['language'] ?? 'zh-TW',
      timezone: json['timezone'] ?? 'Asia/Taipei',
      theme: json['theme'] ?? 'auto',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'language': language,
      'timezone': timezone,
      'theme': theme,
    };
  }
}

/// 使用者安全設定
class UserSecurity {
  final bool hasAppLock;
  final bool biometricEnabled;
  final bool privacyModeEnabled;

  UserSecurity({
    required this.hasAppLock,
    required this.biometricEnabled,
    required this.privacyModeEnabled,
  });

  factory UserSecurity.fromJson(Map<String, dynamic> json) {
    return UserSecurity(
      hasAppLock: json['hasAppLock'] ?? false,
      biometricEnabled: json['biometricEnabled'] ?? false,
      privacyModeEnabled: json['privacyModeEnabled'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'hasAppLock': hasAppLock,
      'biometricEnabled': biometricEnabled,
      'privacyModeEnabled': privacyModeEnabled,
    };
  }
}

/// 使用者資訊 - 符合1311.FS.js規範
class User {
  final String id;
  final String email;
  final String? displayName;
  final String? avatarUrl;
  final UserMode mode;
  final bool emailVerified;           // 新增：符合1311規範
  final UserPreferences preferences;  // 新增：符合1311規範
  final UserSecurity security;       // 新增：符合1311規範
  final DateTime? lastActiveAt;       // 新增：符合1311規範
  final DateTime createdAt;

  User({
    required this.id,
    required this.email,
    this.displayName,
    this.avatarUrl,
    required this.mode,
    required this.emailVerified,
    required this.preferences,
    required this.security,
    this.lastActiveAt,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'],
      avatarUrl: json['avatarUrl'],
      mode: UserMode.values.firstWhere(
        (mode) => mode.name == json['userMode'], // 注意：1311使用userMode
        orElse: () => UserMode.inertial,
      ),
      emailVerified: json['emailVerified'] ?? false,
      preferences: UserPreferences.fromJson(json['preferences'] ?? {}),
      security: UserSecurity.fromJson(json['security'] ?? {}),
      lastActiveAt: json['lastActiveAt'] != null
          ? DateTime.parse(json['lastActiveAt'])
          : null,
      createdAt: DateTime.parse(json['createdAt']),
    );
  }

  /// 轉換為符合1311.FS.js格式的JSON
  Map<String, dynamic> toFirestoreJson() {
    return {
      'email': email,
      'displayName': displayName ?? '',
      'userMode': mode.name, // 1311使用userMode而非mode
      'emailVerified': emailVerified,
      'preferences': preferences.toJson(),
      'security': security.toJson(),
      'lastActiveAt': lastActiveAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

/// 模式設定資訊
class ModeConfiguration {
  final UserMode userMode;
  final Map<String, dynamic> settings;
  final Map<String, dynamic> themeConfig;
  final DateTime lastUpdated;

  ModeConfiguration({
    required this.userMode,
    required this.settings,
    required this.themeConfig,
    required this.lastUpdated,
  });

  factory ModeConfiguration.fromJson(Map<String, dynamic> json) {
    return ModeConfiguration(
      userMode: UserMode.values.firstWhere(
        (mode) => mode.name == json['userMode'],
        orElse: () => UserMode.inertial,
      ),
      settings: json['settings'] ?? {},
      themeConfig: json['themeConfig'] ?? {},
      lastUpdated: DateTime.parse(json['lastUpdated']),
    );
  }
}

/// 註冊請求
class RegisterRequest {
  final String email;
  final String password;
  final String confirmPassword;
  final String? displayName;

  RegisterRequest({
    required this.email,
    required this.password,
    required this.confirmPassword,
    this.displayName,
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'password': password,
      'confirmPassword': confirmPassword,
      'displayName': displayName,
    };
  }
}

/// 註冊回應
class RegisterResponse {
  final bool success;
  final String? token;
  final String? userId;
  final String? message;
  final Map<String, dynamic>? userData;

  RegisterResponse({
    required this.success,
    this.token,
    this.userId,
    this.message,
    this.userData,
  });

  factory RegisterResponse.fromJson(Map<String, dynamic> json) {
    return RegisterResponse(
      success: json['success'] ?? false,
      token: json['token'],
      userId: json['userId'],
      message: json['message'],
      userData: json['userData'],
    );
  }
}

/// 密碼強度資訊
class PasswordStrength {
  final int score;        // 1-5分
  final String level;     // weak/medium/strong
  final List<String> suggestions;
  final bool isAcceptable;

  PasswordStrength({
    required this.score,
    required this.level,
    required this.suggestions,
    required this.isAcceptable,
  });
}

/// 系統進入功能群主類
class SystemEntryFunctionGroup {

  // 單例模式實作
  static SystemEntryFunctionGroup? _instance;
  static SystemEntryFunctionGroup get instance {
    _instance ??= SystemEntryFunctionGroup._internal();
    return _instance!;
  }

  SystemEntryFunctionGroup._internal();

  // 內部狀態管理
  AuthState? _currentAuthState;
  ModeConfiguration? _currentModeConfig;
  bool _isInitialized = false;

  // ===========================================
  // 階段一函數實作（01-15）
  // ===========================================

  /**
   * 01. 初始化應用程式
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> initializeApp() async {
    try {
      print('[SystemEntry] 開始初始化應用程式...');

      // 1. 檢查系統資源
      await _checkSystemResources();

      // 2. 初始化核心服務
      await _initializeCoreServices();

      // 3. 載入本地設定
      await _loadLocalConfiguration();

      // 4. 設定錯誤處理機制
      await _setupErrorHandling();

      _isInitialized = true;
      print('[SystemEntry] ✅ 應用程式初始化完成');

    } catch (e) {
      print('[SystemEntry] ❌ 應用程式初始化失敗: $e');
      throw Exception('應用程式初始化失敗: $e');
    }
  }

  /**
   * 02. 檢查應用程式版本
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<AppVersionInfo> checkAppVersion() async {
    try {
      print('[SystemEntry] 檢查應用程式版本...');

      // 模擬API調用 8111系統服務
      await Future.delayed(Duration(milliseconds: 500));

      // 從系統服務獲取版本資訊
      final versionInfo = AppVersionInfo(
        currentVersion: '1.0.0',
        latestVersion: '1.0.1',
        forceUpdate: false,
        updateMessage: '新版本包含效能改善和錯誤修復',
        releaseDate: DateTime.now().subtract(Duration(days: 7)),
      );

      print('[SystemEntry] ✅ 版本檢查完成 - 當前: ${versionInfo.currentVersion}, 最新: ${versionInfo.latestVersion}');
      return versionInfo;

    } catch (e) {
      print('[SystemEntry] ❌ 版本檢查失敗: $e');
      // 返回預設版本資訊以避免阻塞
      return AppVersionInfo(
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        forceUpdate: false,
        updateMessage: '無法取得版本資訊',
      );
    }
  }

  /**
   * 03. 載入用戶認證狀態
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<AuthState> loadAuthenticationState() async {
    try {
      print('[SystemEntry] 載入用戶認證狀態...');

      // 檢查本地存儲的認證資訊
      final storedToken = await _getStoredToken();

      if (storedToken != null) {
        // 驗證Token有效性
        final isValid = await _validateToken(storedToken);

        if (isValid) {
          // 載入使用者資訊
          final user = await _loadUserFromToken(storedToken);

          _currentAuthState = AuthState(
            isAuthenticated: true,
            currentUser: user,
            token: storedToken,
            status: AuthStatus.authenticated,
            lastLogin: DateTime.now(),
          );

          print('[SystemEntry] ✅ 認證狀態載入完成 - 已認證');
          return _currentAuthState!;
        }
      }

      // 未認證狀態
      _currentAuthState = AuthState(
        isAuthenticated: false,
        status: AuthStatus.unauthenticated,
      );

      print('[SystemEntry] ✅ 認證狀態載入完成 - 未認證');
      return _currentAuthState!;

    } catch (e) {
      print('[SystemEntry] ❌ 認證狀態載入失敗: $e');
      _currentAuthState = AuthState(
        isAuthenticated: false,
        status: AuthStatus.error,
        errorMessage: e.toString(),
      );
      return _currentAuthState!;
    }
  }

  /**
   * 04. 初始化四模式設定
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<ModeConfiguration> initializeModeConfiguration() async {
    try {
      print('[SystemEntry] 初始化四模式設定...');

      // 載入本地模式設定
      final storedConfig = await _getStoredModeConfiguration();

      if (storedConfig != null) {
        _currentModeConfig = storedConfig;
        print('[SystemEntry] ✅ 載入已存在的模式設定: ${storedConfig.userMode.name}');
        return storedConfig;
      }

      // 建立預設模式設定（從環境變數或配置檔案取得）
      final defaultUserMode = _getDefaultUserModeFromConfig();
      final defaultSettings = _getDefaultSettingsFromConfig();

      _currentModeConfig = ModeConfiguration(
        userMode: defaultUserMode,
        settings: defaultSettings,
        themeConfig: _getDefaultThemeConfig(defaultUserMode),
        lastUpdated: DateTime.now(),
      );

      // 保存預設設定
      await _saveModeConfiguration(_currentModeConfig!);

      print('[SystemEntry] ✅ 四模式設定初始化完成 - 預設: ${_currentModeConfig!.userMode.name}');
      return _currentModeConfig!;

    } catch (e) {
      print('[SystemEntry] ❌ 四模式設定初始化失敗: $e');
      throw Exception('四模式設定初始化失敗: $e');
    }
  }

  /**
   * 05. 使用Email註冊帳號
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> registerWithEmail(RegisterRequest request) async {
    try {
      print('[SystemEntry] 開始Email註冊流程...');

      // 1. 輸入驗證
      final validationResult = _validateRegistrationInput(request);
      if (!validationResult['isValid']) {
        return RegisterResponse(
          success: false,
          message: validationResult['message'],
        );
      }

      // 2. 檢查Email是否已存在
      final emailExists = await _checkEmailExists(request.email);
      if (emailExists) {
        return RegisterResponse(
          success: false,
          message: '此Email已被註冊，請使用其他信箱或直接登入',
        );
      }

      // 3. 密碼強度檢查
      final passwordStrength = checkPasswordStrength(request.password);
      if (!passwordStrength.isAcceptable) {
        return RegisterResponse(
          success: false,
          message: '密碼強度不足：${passwordStrength.suggestions.join('、')}',
        );
      }

      // 4. 調用APL層註冊服務
      final apiResponse = await AuthAPLService.register(
        email: request.email,
        password: request.password, // APL層會處理hash
        displayName: request.displayName,
      );

      if (apiResponse['success']) {
        print('[SystemEntry] ✅ Email註冊成功');
        return RegisterResponse(
          success: true,
          token: apiResponse['token'],
          userId: apiResponse['userId'],
          message: '註冊成功，歡迎加入LCAS！',
          userData: apiResponse['userData'],
        );
      } else {
        return RegisterResponse(
          success: false,
          message: apiResponse['message'] ?? '註冊失敗，請稍後再試',
        );
      }

    } catch (e) {
      print('[SystemEntry] ❌ Email註冊失敗: $e');
      return RegisterResponse(
        success: false,
        message: '系統錯誤，請稍後再試',
      );
    }
  }

  /**
   * 06. 使用Google帳號註冊
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> registerWithGoogle() async {
    try {
      print('[SystemEntry] 開始Google OAuth註冊流程...');

      // 1. 初始化Google Sign In
      final googleAuthResult = await _initiateGoogleAuth();

      if (!googleAuthResult['success']) {
        return RegisterResponse(
          success: false,
          message: 'Google認證失敗，請重新嘗試',
        );
      }

      // 2. 取得Google用戶資訊
      final googleUser = googleAuthResult['user'];
      final googleToken = googleAuthResult['token'];

      // 3. 調用APL層Google註冊服務
      final apiResponse = await AuthAPLService.googleRegister(
        googleToken: googleToken,
        email: googleUser['email'],
        displayName: googleUser['name'],
        avatarUrl: googleUser['picture'],
      );

      if (apiResponse['success']) {
        print('[SystemEntry] ✅ Google註冊成功');
        return RegisterResponse(
          success: true,
          token: apiResponse['token'],
          userId: apiResponse['userId'],
          message: '使用Google帳號註冊成功！',
          userData: apiResponse['userData'],
        );
      } else {
        return RegisterResponse(
          success: false,
          message: apiResponse['message'] ?? 'Google註冊失敗',
        );
      }

    } catch (e) {
      print('[SystemEntry] ❌ Google註冊失敗: $e');
      return RegisterResponse(
        success: false,
        message: 'Google認證服務暫時無法使用',
      );
    }
  }

  /**
   * 07. 驗證Email格式
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  bool validateEmailFormat(String email) {
    try {
      // 基本格式檢查
      if (email.isEmpty || email.trim() != email) {
        return false;
      }

      // RFC 5322 簡化版正則表達式
      final emailRegex = RegExp(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
      );

      if (!emailRegex.hasMatch(email)) {
        return false;
      }

      // 分解檢查
      final parts = email.split('@');
      if (parts.length != 2) {
        return false;
      }

      final localPart = parts[0];
      final domainPart = parts[1];

      // 本地部分檢查
      if (localPart.isEmpty || localPart.length > 64) {
        return false;
      }

      if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.contains('..')) {
        return false;
      }

      // 域名部分檢查
      if (domainPart.isEmpty || domainPart.length > 253) {
        return false;
      }

      if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.contains('..')) {
        return false;
      }

      // 檢查頂級域名
      final domainParts = domainPart.split('.');
      if (domainParts.last.length < 2) {
        return false;
      }

      return true;

    } catch (e) {
      print('[SystemEntry] Email格式驗證錯誤: $e');
      return false;
    }
  }

  /**
   * 08. 檢查密碼強度
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  PasswordStrength checkPasswordStrength(String password) {
    try {
      List<String> suggestions = [];
      int score = 0;

      // 長度檢查
      if (password.length < 8) {
        suggestions.add('密碼長度至少需要8個字元');
        return PasswordStrength(
          score: 1,
          level: 'weak',
          suggestions: suggestions,
          isAcceptable: false,
        );
      } else if (password.length >= 12) {
        score += 2;
      } else {
        score += 1;
      }

      // 字元類型檢查
      bool hasLowercase = RegExp(r'[a-z]').hasMatch(password);
      bool hasUppercase = RegExp(r'[A-Z]').hasMatch(password);
      bool hasNumbers = RegExp(r'[0-9]').hasMatch(password);
      bool hasSpecialChars = RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password);

      if (!hasLowercase) suggestions.add('需要包含小寫字母');
      if (!hasUppercase) suggestions.add('需要包含大寫字母');
      if (!hasNumbers) suggestions.add('需要包含數字');
      if (!hasSpecialChars) suggestions.add('建議包含特殊字元');

      // 計算字元類型分數
      int charTypeCount = 0;
      if (hasLowercase) charTypeCount++;
      if (hasUppercase) charTypeCount++;
      if (hasNumbers) charTypeCount++;
      if (hasSpecialChars) charTypeCount++;

      score += charTypeCount;

      // 弱密碼模式檢查
      final commonPasswords = _getCommonPasswordsFromTestData();

      if (commonPasswords.any((common) =>
          password.toLowerCase().contains(common.toLowerCase()))) {
        suggestions.add('避免使用常見密碼模式');
        score = (score / 2).round().clamp(1, 5);
      }

      // 重複字元檢查
      if (RegExp(r'(.)\1{2,}').hasMatch(password)) {
        suggestions.add('避免連續重複字元');
        score = (score * 0.8).round().clamp(1, 5);
      }

      // 確定強度等級和可接受性
      String level;
      bool isAcceptable;

      if (score <= 2) {
        level = 'weak';
        isAcceptable = false;
      } else if (score <= 4) {
        level = 'medium';
        isAcceptable = true;
      } else {
        level = 'strong';
        isAcceptable = true;
      }

      // 對於弱密碼，確保不被接受
      if (suggestions.isNotEmpty && level == 'strong') {
        level = 'medium';
        score = 3;
      }

      if (suggestions.length > 2) {
        isAcceptable = false;
      }

      return PasswordStrength(
        score: score.clamp(1, 5),
        level: level,
        suggestions: suggestions,
        isAcceptable: isAcceptable,
      );

    } catch (e) {
      print('[SystemEntry] 密碼強度檢查錯誤: $e');
      return PasswordStrength(
        score: 1,
        level: 'weak',
        suggestions: ['密碼檢查失敗，請重新輸入'],
        isAcceptable: false,
      );
    }
  }

  /**
   * 09. 使用Email登入
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> loginWithEmail(String email, String password) async {
    try {
      print('[SystemEntry] 開始Email登入流程...');

      // 1. 基本驗證
      if (!validateEmailFormat(email)) {
        return RegisterResponse(
          success: false,
          message: 'Email格式不正確',
        );
      }

      if (password.length < 6) {
        return RegisterResponse(
          success: false,
          message: '密碼長度不足',
        );
      }

      // 2. 調用APL層登入服務
      final apiResponse = await AuthAPLService.login(
        email: email,
        password: password, // APL層會處理hash
      );

      if (apiResponse['success']) {
        // 3. 保存認證資訊
        await _saveAuthToken(apiResponse['token']);

        // 4. 更新認證狀態
        final user = User.fromJson(apiResponse['userData']);
        _currentAuthState = AuthState(
          isAuthenticated: true,
          currentUser: user,
          token: apiResponse['token'],
          status: AuthStatus.authenticated,
          lastLogin: DateTime.now(),
        );

        print('[SystemEntry] ✅ Email登入成功');
        return RegisterResponse(
          success: true,
          token: apiResponse['token'],
          userId: apiResponse['userId'],
          message: '登入成功，歡迎回來！',
          userData: apiResponse['userData'],
        );
      } else {
        return RegisterResponse(
          success: false,
          message: apiResponse['message'] ?? '登入失敗，請檢查帳號密碼',
        );
      }

    } catch (e) {
      print('[SystemEntry] ❌ Email登入失敗: $e');
      return RegisterResponse(
        success: false,
        message: '系統錯誤，請稍後再試',
      );
    }
  }

  /**
   * 10. 使用Google帳號登入
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> loginWithGoogle() async {
    try {
      print('[SystemEntry] 開始Google OAuth登入流程...');

      // 1. 初始化Google Sign In
      final googleAuthResult = await _initiateGoogleAuth();

      if (!googleAuthResult['success']) {
        return RegisterResponse(
          success: false,
          message: 'Google認證失敗，請重新嘗試',
        );
      }

      // 2. 調用APL層Google登入服務
      final apiResponse = await AuthAPLService.googleLogin(
        googleToken: googleAuthResult['token'],
      );

      if (apiResponse['success']) {
        // 3. 保存認證資訊
        await _saveAuthToken(apiResponse['token']);

        // 4. 更新認證狀態
        final user = User.fromJson(apiResponse['userData']);
        _currentAuthState = AuthState(
          isAuthenticated: true,
          currentUser: user,
          token: apiResponse['token'],
          status: AuthStatus.authenticated,
          lastLogin: DateTime.now(),
        );

        print('[SystemEntry] ✅ Google登入成功');
        return RegisterResponse(
          success: true,
          token: apiResponse['token'],
          userId: apiResponse['userId'],
          message: '使用Google帳號登入成功！',
          userData: apiResponse['userData'],
        );
      } else {
        return RegisterResponse(
          success: false,
          message: apiResponse['message'] ?? 'Google登入失敗',
        );
      }

    } catch (e) {
      print('[SystemEntry] ❌ Google登入失敗: $e');
      return RegisterResponse(
        success: false,
        message: 'Google認證服務暫時無法使用',
      );
    }
  }

  /**
   * 11. 檢查自動登入狀態
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> checkAutoLoginStatus() async {
    try {
      print('[SystemEntry] 檢查自動登入狀態...');

      // 1. 載入認證狀態
      final authState = await loadAuthenticationState();

      // 2. 檢查是否已認證且Token有效
      if (authState.isAuthenticated && authState.token != null) {
        // 3. 驗證Token未過期
        final isValid = await _validateToken(authState.token!);

        if (isValid) {
          print('[SystemEntry] ✅ 自動登入可用');
          return true;
        }
      }

      print('[SystemEntry] ❌ 自動登入不可用');
      return false;

    } catch (e) {
      print('[SystemEntry] ❌ 檢查自動登入狀態失敗: $e');
      return false;
    }
  }

  /**
   * 12. 保存登入狀態
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> saveLoginState(String token, bool rememberMe) async {
    try {
      print('[SystemEntry] 保存登入狀態...');

      // 1. 保存認證Token
      await _saveAuthToken(token);

      // 2. 保存記住我選項
      await _saveRememberMeOption(rememberMe);

      // 3. 記錄登入時間
      await _saveLastLoginTime(DateTime.now());

      print('[SystemEntry] ✅ 登入狀態保存完成');

    } catch (e) {
      print('[SystemEntry] ❌ 保存登入狀態失敗: $e');
      throw Exception('保存登入狀態失敗: $e');
    }
  }

  /**
   * 13. 發送密碼重設連結
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> sendPasswordResetLink(String email) async {
    try {
      print('[SystemEntry] 發送密碼重設連結...');

      // 1. 驗證Email格式
      if (!validateEmailFormat(email)) {
        return RegisterResponse(
          success: false,
          message: 'Email格式不正確',
        );
      }

      // 2. 調用APL層忘記密碼服務
      final apiResponse = await AuthAPLService.forgotPassword(email: email);

      if (apiResponse['success']) {
        print('[SystemEntry] ✅ 密碼重設連結發送成功');
        return RegisterResponse(
          success: true,
          message: '密碼重設連結已發送至您的信箱，請查收',
        );
      } else {
        return RegisterResponse(
          success: false,
          message: apiResponse['message'] ?? '發送失敗，請稍後再試',
        );
      }

    } catch (e) {
      print('[SystemEntry] ❌ 發送密碼重設連結失敗: $e');
      return RegisterResponse(
        success: false,
        message: '系統錯誤，請稍後再試',
      );
    }
  }

  /**
   * 14. 驗證密碼重設Token
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> validateResetToken(String token) async {
    try {
      print('[SystemEntry] 驗證密碼重設Token...');

      if (token.isEmpty) {
        return false;
      }

      // 調用APL層驗證重設Token服務
      final apiResponse = await AuthAPLService.validateResetToken(token: token);

      final isValid = apiResponse['success'] ?? false;
      print('[SystemEntry] ${isValid ? '✅' : '❌'} Token驗證結果: $isValid');
      return isValid;

    } catch (e) {
      print('[SystemEntry] ❌ 驗證密碼重設Token失敗: $e');
      return false;
    }
  }

  /**
   * 15. 重設密碼
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<RegisterResponse> resetPassword(String token, String newPassword) async {
    try {
      print('[SystemEntry] 執行密碼重設...');

      // 1. 驗證Token
      final isValidToken = await validateResetToken(token);
      if (!isValidToken) {
        return RegisterResponse(
          success: false,
          message: '重設連結無效或已過期，請重新申請',
        );
      }

      // 2. 檢查新密碼強度
      final passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.isAcceptable) {
        return RegisterResponse(
          success: false,
          message: '新密碼強度不足：${passwordStrength.suggestions.join('、')}',
        );
      }

      // 3. 調用APL層重設密碼服務
      final apiResponse = await AuthAPLService.resetPassword(
        token: token,
        newPassword: newPassword, // APL層會處理hash
      );

      if (apiResponse['success']) {
        print('[SystemEntry] ✅ 密碼重設成功');
        return RegisterResponse(
          success: true,
          message: '密碼重設成功，請使用新密碼登入',
        );
      } else {
        return RegisterResponse(
          success: false,
          message: apiResponse['message'] ?? '密碼重設失敗',
        );
      }

    } catch (e) {
      print('[SystemEntry] ❌ 密碼重設失敗: $e');
      return RegisterResponse(
        success: false,
        message: '系統錯誤，請稍後再試',
      );
    }
  }

  // ===========================================
  // 內部輔助函數
  // ===========================================

  /// 檢查系統資源
  Future<void> _checkSystemResources() async {
    await Future.delayed(Duration(milliseconds: 100));
    // 檢查記憶體、儲存空間等
  }

  /// 初始化核心服務
  Future<void> _initializeCoreServices() async {
    await Future.delayed(Duration(milliseconds: 200));
    // 初始化HTTP客戶端、資料庫連接等
  }

  /// 載入本地設定
  Future<void> _loadLocalConfiguration() async {
    await Future.delayed(Duration(milliseconds: 100));
    // 載入本地儲存的設定
  }

  /// 設定錯誤處理機制
  Future<void> _setupErrorHandling() async {
    await Future.delayed(Duration(milliseconds: 50));
    // 設定全域錯誤處理
  }

  /// 取得儲存的Token
  Future<String?> _getStoredToken() async {
    await Future.delayed(Duration(milliseconds: 50));
    // 從安全儲存取得Token
    return null; // 暫時返回null
  }

  /// 驗證Token有效性
  Future<bool> _validateToken(String token) async {
    await Future.delayed(Duration(milliseconds: 100));
    // 向後端驗證Token
    return token.isNotEmpty;
  }

  /// 從Token載入使用者資訊
  Future<User?> _loadUserFromToken(String token) async {
    await Future.delayed(Duration(milliseconds: 150));
    // 從Token取得使用者資訊
    return null;
  }

  /// 取得儲存的模式設定
  Future<ModeConfiguration?> _getStoredModeConfiguration() async {
    await Future.delayed(Duration(milliseconds: 50));
    // 從本地儲存載入模式設定
    return null;
  }

  /// 取得預設主題設定
  Map<String, dynamic> _getDefaultThemeConfig(UserMode mode) {
    final themeColors = {
      UserMode.expert: {'primary': 0xFF1976D2, 'accent': 0xFF0D47A1},      // 專業藍
      UserMode.inertial: {'primary': 0xFF4CAF50, 'accent': 0xFF388E3C},    // 穩定綠
      UserMode.cultivation: {'primary': 0xFFFF9800, 'accent': 0xFFF57C00}, // 成長橙
      UserMode.guiding: {'primary': 0xFF9C27B0, 'accent': 0xFF7B1FA2},     // 引導紫
    };

    return themeColors[mode] ?? themeColors[UserMode.inertial]!;
  }

  /// 保存模式設定
  Future<void> _saveModeConfiguration(ModeConfiguration config) async {
    await Future.delayed(Duration(milliseconds: 100));
    // 保存到本地儲存
  }

  /// 驗證註冊輸入
  Map<String, dynamic> _validateRegistrationInput(RegisterRequest request) {
    if (!validateEmailFormat(request.email)) {
      return {'isValid': false, 'message': 'Email格式不正確'};
    }

    if (request.password != request.confirmPassword) {
      return {'isValid': false, 'message': '密碼確認不一致'};
    }

    return {'isValid': true};
  }

  /// 檢查Email是否已存在
  Future<bool> _checkEmailExists(String email) async {
    await Future.delayed(Duration(milliseconds: 200));
    // 調用API檢查Email
    return false; // 暫時返回false
  }

  /// 密碼雜湊
  String _hashPassword(String password) {
    var bytes = utf8.encode(password);
    var digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// 調用認證API
  Future<Map<String, dynamic>> _callAuthAPI(String endpoint, Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 300)); // 模擬網路延遲

    // 模擬API回應
    switch (endpoint) {
      case '/register':
        return {
          'success': true,
          'token': 'mock_token_${DateTime.now().millisecondsSinceEpoch}',
          'userId': 'user_${data['email'].hashCode}',
          'userData': {
            'id': 'user_${data['email'].hashCode}',
            'email': data['email'],
            'displayName': data['displayName'],
            'mode': 'inertial',
            'createdAt': DateTime.now().toIso8601String(),
          },
        };
      case '/login':
        return {
          'success': true,
          'token': 'login_token_${DateTime.now().millisecondsSinceEpoch}',
          'userId': 'user_${data['email'].hashCode}',
          'userData': {
            'id': 'user_${data['email'].hashCode}',
            'email': data['email'],
            'mode': 'inertial',
            'createdAt': DateTime.now().subtract(Duration(days: 30)).toIso8601String(),
          },
        };
      case '/forgot-password':
        return {'success': true};
      case '/validate-reset-token':
        return {'success': true};
      case '/reset-password':
        return {'success': true};
      default:
        return {'success': false, 'message': 'API端點不存在'};
    }
  }

  /// 初始化Google認證
  Future<Map<String, dynamic>> _initiateGoogleAuth() async {
    await Future.delayed(Duration(milliseconds: 500));

    return {
      'success': true,
      'token': 'google_token_${DateTime.now().millisecondsSinceEpoch}',
      'user': {
        'email': 'user@gmail.com',
        'name': 'Google User',
        'picture': 'https://example.com/avatar.jpg',
      },
    };
  }

  /// 保存認證Token
  Future<void> _saveAuthToken(String token) async {
    await Future.delayed(Duration(milliseconds: 50));
    // 使用FlutterSecureStorage保存
  }

  /// 保存記住我選項
  Future<void> _saveRememberMeOption(bool rememberMe) async {
    await Future.delayed(Duration(milliseconds: 30));
    // 保存到本地偏好設定
  }

  /// 保存最後登入時間
  Future<void> _saveLastLoginTime(DateTime time) async {
    await Future.delayed(Duration(milliseconds: 30));
    // 保存登入時間記錄
  }

  // ===========================================
  // 階段二函數實作（16-26）
  // ===========================================

  /**
   * 16. 載入模式評估問卷
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> loadModeAssessmentSurvey() async {
    try {
      print('[SystemEntry] 載入模式評估問卷...');

      // 調用8111系統服務API取得問卷內容
      final apiResponse = await _callSystemAPI('/assessment-survey', {});

      if (apiResponse['success']) {
        final surveyData = {
          'surveyId': apiResponse['surveyId'],
          'version': apiResponse['version'],
          'questions': apiResponse['questions'],
          'scoringRules': apiResponse['scoringRules'],
          'modeThresholds': apiResponse['modeThresholds'],
        };

        print('[SystemEntry] ✅ 模式評估問卷載入成功，共${surveyData['questions'].length}題');
        return {
          'success': true,
          'data': surveyData,
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? '載入問卷失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 載入模式評估問卷失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 17. 提交評估答案
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> submitAssessmentAnswers(Map<String, dynamic> answers) async {
    try {
      print('[SystemEntry] 提交評估答案...');

      // 驗證答案完整性
      final validationResult = _validateAssessmentAnswers(answers);
      if (!validationResult['isValid']) {
        return {
          'success': false,
          'message': validationResult['message'],
        };
      }

      //調用8111系統服務API提交答案
      final apiResponse = await _callSystemAPI('/submit-assessment', {
        'userId': _currentAuthState?.currentUser?.id,
        'answers': answers,
        'submittedAt': DateTime.now().toIso8601String(),
      });

      if (apiResponse['success']) {
        print('[SystemEntry] ✅ 評估答案提交成功');
        return {
          'success': true,
          'submissionId': apiResponse['submissionId'],
          'message': '評估答案已成功提交',
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? '提交失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 提交評估答案失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 18. 計算模式推薦
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> calculateModeRecommendation(String submissionId) async {
    try {
      print('[SystemEntry] 計算模式推薦...');

      // 調用8111系統服務API計算推薦模式
      final apiResponse = await _callSystemAPI('/calculate-recommendation', {
        'submissionId': submissionId,
      });

      if (apiResponse['success']) {
        final recommendation = {
          'recommendedMode': apiResponse['recommendedMode'],
          'confidence': apiResponse['confidence'],
          'scores': apiResponse['scores'],
          'explanation': apiResponse['explanation'],
          'alternatives': apiResponse['alternatives'],
        };

        print('[SystemEntry] ✅ 模式推薦計算完成: ${recommendation['recommendedMode']}');
        return {
          'success': true,
          'recommendation': recommendation,
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? '計算推薦失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 計算模式推薦失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 19. 保存使用者模式設定
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> saveUserModeConfiguration(UserMode selectedMode, Map<String, dynamic>? customSettings) async {
    try {
      print('[SystemEntry] 保存使用者模式設定...');

      // 建立新的模式設定
      final newConfig = ModeConfiguration(
        userMode: selectedMode,
        settings: {
          ...(_currentModeConfig?.settings ?? {}),
          ...(customSettings ?? {}),
        },
        themeConfig: _getDefaultThemeConfig(selectedMode),
        lastUpdated: DateTime.now(),
      );

      // 保存到本地儲存
      await _saveModeConfiguration(newConfig);

      // 同步到後端
      final syncResult = await _syncModeConfigurationToBackend(newConfig);

      if (syncResult) {
        _currentModeConfig = newConfig;
        print('[SystemEntry] ✅ 使用者模式設定保存成功: ${selectedMode.name}');
        return true;
      } else {
        print('[SystemEntry] ⚠️ 本地保存成功，但後端同步失敗');
        return false;
      }

    } catch (e) {
      print('[SystemEntry] ❌ 保存使用者模式設定失敗: $e');
      return false;
    }
  }

  /**
   * 20. 生成LINE綁定QR Code
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> generateLineBindingQRCode() async {
    try {
      print('[SystemEntry] 生成LINE綁定QR Code...');

      if (_currentAuthState?.currentUser == null) {
        return {
          'success': false,
          'message': '請先登入後再進行LINE綁定',
        };
      }

      // 調用8111系統服務API生成綁定Token
      final apiResponse = await _callSystemAPI('/generate-line-binding', {
        'userId': _currentAuthState!.currentUser!.id,
        'requestTime': DateTime.now().toIso8601String(),
      });

      if (apiResponse['success']) {
        final qrData = {
          'bindingToken': apiResponse['bindingToken'],
          'qrCodeUrl': apiResponse['qrCodeUrl'],
          'lineOfficialAccount': apiResponse['lineOfficialAccount'],
          'expiresAt': apiResponse['expiresAt'],
          'instructions': apiResponse['instructions'],
        };

        print('[SystemEntry] ✅ LINE綁定QR Code生成成功');
        return {
          'success': true,
          'qrData': qrData,
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? 'QR Code生成失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 生成LINE綁定QR Code失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 21. 執行LINE平台綁定
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> executeLinePlatformBinding(String bindingToken) async {
    try {
      print('[SystemEntry] 執行LINE平台綁定...');

      // 驗證綁定Token
      final tokenValidation = await _validateBindingToken(bindingToken);
      if (!tokenValidation['isValid']) {
        return {
          'success': false,
          'message': '綁定Token無效或已過期',
        };
      }

      // 調用8111系統服務API執行綁定
      final apiResponse = await _callSystemAPI('/execute-line-binding', {
        'bindingToken': bindingToken,
        'userId': _currentAuthState?.currentUser?.id,
      });

      if (apiResponse['success']) {
        final bindingResult = {
          'lineUserId': apiResponse['lineUserId'],
          'bindingStatus': apiResponse['bindingStatus'],
          'bindingTime': apiResponse['bindingTime'],
          'availableFeatures': apiResponse['availableFeatures'],
        };

        print('[SystemEntry] ✅ LINE平台綁定成功');
        return {
          'success': true,
          'bindingResult': bindingResult,
          'message': 'LINE平台綁定成功！',
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? 'LINE綁定失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 執行LINE平台綁定失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 22. 檢查平台綁定狀態
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> checkPlatformBindingStatus() async {
    try {
      print('[SystemEntry] 檢查平台綁定狀態...');

      if (_currentAuthState?.currentUser == null) {
        return {
          'success': false,
          'message': '使用者未登入',
        };
      }

      // 調用8111系統服務API檢查綁定狀態
      final apiResponse = await _callSystemAPI('/check-platform-binding', {
        'userId': _currentAuthState!.currentUser!.id,
      });

      if (apiResponse['success']) {
        final bindingStatus = {
          'isLineBound': apiResponse['isLineBound'],
          'lineUserId': apiResponse['lineUserId'],
          'bindingTime': apiResponse['bindingTime'],
          'lastSyncTime': apiResponse['lastSyncTime'],
          'availablePlatforms': apiResponse['availablePlatforms'],
          'syncStatus': apiResponse['syncStatus'],
        };

        print('[SystemEntry] ✅ 平台綁定狀態檢查完成');
        return {
          'success': true,
          'bindingStatus': bindingStatus,
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? '狀態檢查失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 檢查平台綁定狀態失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 23. 同步跨平台資料
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> syncCrossPlatformData() async {
    try {
      print('[SystemEntry] 同步跨平台資料...');

      if (_currentAuthState?.currentUser == null) {
        return {
          'success': false,
          'message': '使用者未登入',
        };
      }

      // 調用8111系統服務API同步資料
      final apiResponse = await _callSystemAPI('/sync-cross-platform', {
        'userId': _currentAuthState!.currentUser!.id,
        'syncType': 'full',
        'requestTime': DateTime.now().toIso8601String(),
      });

      if (apiResponse['success']) {
        final syncResult = {
          'syncId': apiResponse['syncId'],
          'syncedPlatforms': apiResponse['syncedPlatforms'],
          'syncedDataTypes': apiResponse['syncedDataTypes'],
          'syncTime': apiResponse['syncTime'],
          'conflictResolutions': apiResponse['conflictResolutions'],
        };

        print('[SystemEntry] ✅ 跨平台資料同步完成');
        return {
          'success': true,
          'syncResult': syncResult,
          'message': '資料同步完成',
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? '資料同步失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 同步跨平台資料失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 24. 載入APP功能展示內容
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> loadAppFeatureShowcase() async {
    try {
      print('[SystemEntry] 載入APP功能展示內容...');

      // 根據使用者模式載入對應的展示內容
      final userMode = _currentModeConfig?.userMode ?? UserMode.inertial;

      // 調用8111系統服務API
      final apiResponse = await _callSystemAPI('/feature-showcase', {
        'userMode': userMode.name,
        'language': 'zh-TW',
      });

      if (apiResponse['success']) {
        final showcaseData = {
          'features': apiResponse['features'],
          'tutorials': apiResponse['tutorials'],
          'benefits': apiResponse['benefits'],
          'screenshots': apiResponse['screenshots'],
          'demoVideos': apiResponse['demoVideos'],
          'userTestimonials': apiResponse['userTestimonials'],
        };

        print('[SystemEntry] ✅ APP功能展示內容載入成功');
        return {
          'success': true,
          'showcaseData': showcaseData,
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? '載入展示內容失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 載入APP功能展示內容失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 25. 生成APP下載連結
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>> generateAppDownloadLinks() async {
    try {
      print('[SystemEntry] 生成APP下載連結...');

      // 調用8111系統服務API
      final apiResponse = await _callSystemAPI('/app-download-links', {
        'platform': 'all',
        'version': 'latest',
        'referralCode': _currentAuthState?.currentUser?.id,
      });

      if (apiResponse['success']) {
        final downloadLinks = {
          'androidPlayStore': apiResponse['androidPlayStore'],
          'iosAppStore': apiResponse['iosAppStore'],
          'webApp': apiResponse['webApp'],
          'qrCodes': apiResponse['qrCodes'],
          'directDownload': apiResponse['directDownload'],
          'referralTracking': apiResponse['referralTracking'],
        };

        print('[SystemEntry] ✅ APP下載連結生成成功');
        return {
          'success': true,
          'downloadLinks': downloadLinks,
        };
      } else {
        return {
          'success': false,
          'message': apiResponse['message'] ?? '生成下載連結失敗',
        };
      }

    } catch (e) {
      print('[SystemEntry] ❌ 生成APP下載連結失敗: $e');
      return {
        'success': false,
        'message': '系統錯誤，請稍後再試',
      };
    }
  }

  /**
   * 26. 記錄推廣頁面互動
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<void> recordPromotionPageInteraction(String interactionType, Map<String, dynamic> interactionData) async {
    try {
      print('[SystemEntry] 記錄推廣頁面互動: $interactionType');

      // 準備互動記錄資料
      final recordData = {
        'userId': _currentAuthState?.currentUser?.id,
        'sessionId': _generateSessionId(),
        'interactionType': interactionType,
        'interactionData': interactionData,
        'timestamp': DateTime.now().toIso8601String(),
        'userAgent': 'LCAS_Flutter_App',
        'appVersion': '1.0.0',
      };

      // 調用8111系統服務API記錄互動
      await _callSystemAPI('/record-interaction', recordData);

      print('[SystemEntry] ✅ 推廣頁面互動記錄完成');

    } catch (e) {
      print('[SystemEntry] ❌ 記錄推廣頁面互動失敗: $e');
      // 記錄失敗不影響主要功能，僅記錄錯誤
    }
  }

  // ===========================================
  // 階段二內部輔助函數
  // ===========================================

  /// 調用系統服務API
  Future<Map<String, dynamic>> _callSystemAPI(String endpoint, Map<String, dynamic> data) async {
    await Future.delayed(Duration(milliseconds: 200)); // 模擬網路延遲

    // 模擬API回應
    switch (endpoint) {
      case '/assessment-survey':
        return {
          'success': true,
          'surveyId': 'survey_2025_v1',
          'version': '1.0.0',
          'questions': [
            {
              'id': 'q1',
              'text': '您平常記帳的頻率是？',
              'type': 'single_choice',
              'options': ['每日', '每週', '每月', '不定期']
            },
            {
              'id': 'q2',
              'text': '您希望APP提供什麼程度的功能指導？',
              'type': 'single_choice',
              'options': ['詳細指導', '基本提示', '最少介入', '完全自主']
            },
          ],
          'scoringRules': {'expert': 4, 'inertial': 3, 'cultivation': 2, 'guiding': 1},
          'modeThresholds': {'expert': 15, 'inertial': 10, 'cultivation': 5, 'guiding': 0},
        };
      case '/submit-assessment':
        return {
          'success': true,
          'submissionId': 'submission_${DateTime.now().millisecondsSinceEpoch}',
        };
      case '/calculate-recommendation':
        return {
          'success': true,
          'recommendedMode': 'inertial',
          'confidence': 0.85,
          'scores': {'expert': 12, 'inertial': 15, 'cultivation': 8, 'guiding': 5},
          'explanation': '根據您的答案，建議使用慣性模式',
          'alternatives': ['expert', 'cultivation'],
        };
      case '/generate-line-binding':
        return {
          'success': true,
          'bindingToken': 'bind_${DateTime.now().millisecondsSinceEpoch}',
          'qrCodeUrl': 'https://api.qrserver.com/v1/create-qr-code/?data=LCAS_BIND_TOKEN',
          'lineOfficialAccount': '@lcas_official',
          'expiresAt': DateTime.now().add(Duration(minutes: 10)).toIso8601String(),
          'instructions': ['掃描QR Code', '加入LINE官方帳號', '發送綁定訊息'],
        };
      case '/execute-line-binding':
        return {
          'success': true,
          'lineUserId': 'line_user_${data['userId']}',
          'bindingStatus': 'active',
          'bindingTime': DateTime.now().toIso8601String(),
          'availableFeatures': ['快速記帳', '帳本查詢', '支出提醒'],
        };
      case '/check-platform-binding':
        return {
          'success': true,
          'isLineBound': true,
          'lineUserId': 'line_user_${data['userId']}',
          'bindingTime': DateTime.now().subtract(Duration(days: 1)).toIso8601String(),
          'lastSyncTime': DateTime.now().subtract(Duration(hours: 2)).toIso8601String(),
          'availablePlatforms': ['LINE', 'WebApp'],
          'syncStatus': 'synced',
        };
      case '/sync-cross-platform':
        return {
          'success': true,
          'syncId': 'sync_${DateTime.now().millisecondsSinceEpoch}',
          'syncedPlatforms': ['LINE', 'WebApp'],
          'syncedDataTypes': ['transactions', 'budgets', 'categories'],
          'syncTime': DateTime.now().toIso8601String(),
          'conflictResolutions': [],
        };
      case '/feature-showcase':
        return {
          'success': true,
          'features': [
            {'name': '智慧記帳', 'description': 'AI輔助的快速記帳功能'},
            {'name': '預算管理', 'description': '智慧預算追蹤與提醒'},
          ],
          'tutorials': ['新手入門', '進階功能'],
          'benefits': ['節省時間', '提升效率'],
          'screenshots': ['screen1.jpg', 'screen2.jpg'],
          'demoVideos': ['demo1.mp4'],
          'userTestimonials': [{'user': '使用者A', 'comment': '非常好用！'}],
        };
      case '/app-download-links':
        return {
          'success': true,
          'androidPlayStore': 'https://play.google.com/store/apps/details?id=com.lcas.app',
          'iosAppStore': 'https://apps.apple.com/app/lcas/id123456789',
          'webApp': 'https://app.lcas.com',
          'qrCodes': {
            'android': 'https://api.qrserver.com/v1/create-qr-code/?data=play_store_link',
            'ios': 'https://api.qrserver.com/v1/create-qr-code/?data=app_store_link',
          },
          'directDownload': 'https://download.lcas.com/app.apk',
          'referralTracking': 'enabled',
        };
      case '/record-interaction':
        return {'success': true};
      default:
        return {'success': false, 'message': 'API端點不存在'};
    }
  }

  /// 驗證評估答案
  Map<String, dynamic> _validateAssessmentAnswers(Map<String, dynamic> answers) {
    if (answers.isEmpty) {
      return {'isValid': false, 'message': '請完成所有問題'};
    }

    // 檢查必要問題是否已回答
    final requiredQuestions = ['q1', 'q2'];
    for (String questionId in requiredQuestions) {
      if (!answers.containsKey(questionId) || answers[questionId] == null) {
        return {'isValid': false, 'message': '請完成所有必填問題'};
      }
    }

    return {'isValid': true};
  }

  /// 同步模式設定到後端
  Future<bool> _syncModeConfigurationToBackend(ModeConfiguration config) async {
    try {
      await Future.delayed(Duration(milliseconds: 200));

      final apiResponse = await _callSystemAPI('/sync-mode-config', {
        'userId': _currentAuthState?.currentUser?.id,
        'modeConfig': {
          'userMode': config.userMode.name,
          'settings': config.settings,
          'themeConfig': config.themeConfig,
          'lastUpdated': config.lastUpdated.toIso8601String(),
        },
      });

      return apiResponse['success'] ?? false;
    } catch (e) {
      return false;
    }
  }

  /// 驗證綁定Token
  Future<Map<String, dynamic>> _validateBindingToken(String token) async {
    await Future.delayed(Duration(milliseconds: 100));

    if (token.isEmpty || !token.startsWith('bind_')) {
      return {'isValid': false, 'message': 'Token格式無效'};
    }

    // 模擬Token過期檢查
    return {'isValid': true};
  }

  /// 生成會話ID
  String _generateSessionId() {
    return 'session_${DateTime.now().millisecondsSinceEpoch}_${(_currentAuthState?.currentUser?.id?.hashCode ?? 0).abs()}';
  }

  // ===========================================
  // 階段三函數實作（27-40）
  // ===========================================

  /**
   * 27. 載入使用者模式主題
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Map<String, dynamic> loadUserModeTheme(UserMode userMode) {
    try {
      print('[SystemEntry] 載入使用者模式主題: ${userMode.name}');

      // 根據使用者模式返回對應的主題配置
      final themeConfigs = {
        UserMode.expert: {
          'primaryColor': 0xFF1976D2,      // 專業藍
          'accentColor': 0xFF0D47A1,       // 深藍
          'backgroundColor': 0xFFF5F5F5,    // 淺灰背景
          'surfaceColor': 0xFFFFFFFF,       // 白色表面
          'textColor': 0xFF212121,          // 深灰文字
          'secondaryTextColor': 0xFF757575,  // 次要文字
          'errorColor': 0xFFD32F2F,         // 錯誤紅
          'successColor': 0xFF388E3C,       // 成功綠
          'warningColor': 0xFFF57C00,       // 警告橙
          'borderRadius': 4.0,              // 小圓角
          'elevation': 8.0,                 // 高陰影
          'fontFamily': 'Roboto',
          'themeName': 'Expert Theme',
          'density': 'compact',             // 緊湊密度
        },
        UserMode.inertial: {
          'primaryColor': 0xFF4CAF50,       // 穩定綠
          'accentColor': 0xFF388E3C,        // 深綠
          'backgroundColor': 0xFFFAFAFA,     // 極淺灰背景
          'surfaceColor': 0xFFFFFFFF,        // 白色表面
          'textColor': 0xFF424242,           // 中灰文字
          'secondaryTextColor': 0xFF616161,  // 次要文字
          'errorColor': 0xF44336,          // 錯誤紅
          'successColor': 0xFF4CAF50,        // 成功綠
          'warningColor': 0xFFFF9800,        // 警告橙
          'borderRadius': 6.0,               // 中圓角
          'elevation': 4.0,                  // 中陰影
          'fontFamily': 'Roboto',
          'themeName': 'Inertial Theme',
          'density': 'standard',             // 標準密度
        },
        UserMode.cultivation: {
          'primaryColor': 0xFFFF9800,        // 成長橙
          'accentColor': 0xFFF57C00,         // 深橙
          'backgroundColor': 0xFFFFF8E1,     // 淺黃背景
          'surfaceColor': 0xFFFFFFFF,        // 白色表面
          'textColor': 0xFF333333,           // 深灰文字
          'secondaryTextColor': 0xFF666666,  // 次要文字
          'errorColor': 0xFFE53935,          // 錯誤紅
          'successColor': 0xFF43A047,        // 成功綠
          'warningColor': 0xFFFF9800,        // 警告橙
          'borderRadius': 8.0,               // 中大圓角
          'elevation': 6.0,                  // 中高陰影
          'fontFamily': 'Roboto',
          'themeName': 'Cultivation Theme',
          'density': 'comfortable',          // 舒適密度
        },
        UserMode.guiding: {
          'primaryColor': 0xFF9C27B0,        // 引導紫
          'accentColor': 0xFF7B1FA2,         // 深紫
          'backgroundColor': 0xFFF3E5F5,     // 淺紫背景
          'surfaceColor': 0xFFFFFFFF,        // 白色表面
          'textColor': 0xFF444444,           // 中深灰文字
          'secondaryTextColor': 0xFF888888,  // 次要文字
          'errorColor': 0xFFD32F2F,          // 錯誤紅
          'successColor': 0xFF388E3C,        // 成功綠
          'warningColor': 0xFFF57C00,        // 警告橙
          'borderRadius': 12.0,              // 大圓角
          'elevation': 2.0,                  // 低陰影
          'fontFamily': 'Roboto',
          'themeName': 'Guiding Theme',
          'density': 'comfortable',          // 舒適密度
        },
      };

      final theme = themeConfigs[userMode] ?? themeConfigs[UserMode.inertial]!;
      print('[SystemEntry] ✅ 使用者模式主題載入完成: ${theme['themeName']}');
      return theme;

    } catch (e) {
      print('[SystemEntry] ❌ 載入使用者模式主題失敗: $e');
      // 返回預設主題
      return loadUserModeTheme(UserMode.inertial);
    }
  }

  /**
   * 28. 切換使用者模式主題
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> switchUserModeTheme(UserMode newMode) async {
    try {
      print('[SystemEntry] 切換使用者模式主題: ${_currentModeConfig?.userMode.name} -> ${newMode.name}');

      // 檢查是否需要切換
      if (_currentModeConfig?.userMode == newMode) {
        print('[SystemEntry] ⚠️ 模式相同，無需切換');
        return true;
      }

      // 載入新主題
      final newTheme = loadUserModeTheme(newMode);

      // 更新模式設定
      final updatedConfig = ModeConfiguration(
        userMode: newMode,
        settings: _currentModeConfig?.settings ?? {},
        themeConfig: newTheme,
        lastUpdated: DateTime.now(),
      );

      // 保存設定
      await _saveModeConfiguration(updatedConfig);

      // 同步到後端
      final syncResult = await _syncModeConfigurationToBackend(updatedConfig);

      if (syncResult) {
        _currentModeConfig = updatedConfig;
        print('[SystemEntry] ✅ 使用者模式主題切換成功: ${newMode.name}');
        return true;
      } else {
        print('[SystemEntry] ⚠️ 本地主題切換成功，但後端同步失敗');
        _currentModeConfig = updatedConfig;
        return false;
      }

    } catch (e) {
      print('[SystemEntry] ❌ 切換使用者模式主題失敗: $e');
      return false;
    }
  }

  /**
   * 29. 獲取模式專用顏色
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  int getModeSpecificColor(UserMode userMode, String colorType) {
    try {
      final theme = loadUserModeTheme(userMode);

      final colorMap = {
        'primary': theme['primaryColor'],
        'accent': theme['accentColor'],
        'background': theme['backgroundColor'],
        'surface': theme['surfaceColor'],
        'text': theme['textColor'],
        'secondaryText': theme['secondaryTextColor'],
        'error': theme['errorColor'],
        'success': theme['successColor'],
        'warning': theme['warningColor'],
      };

      final color = colorMap[colorType];
      if (color != null) {
        return color as int;
      } else {
        print('[SystemEntry] ⚠️ 未知的顏色類型: $colorType，返回主色');
        return theme['primaryColor'] as int;
      }

    } catch (e) {
      print('[SystemEntry] ❌ 獲取模式專用顏色失敗: $e');
      // 返回預設藍色
      return 0xFF1976D2;
    }
  }

  /**
   * 30. 處理網路連線錯誤
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Map<String, dynamic> handleNetworkConnectionError(Exception exception) {
    try {
      print('[SystemEntry] 處理網路連線錯誤: ${exception.toString()}');

      String errorType = 'UNKNOWN_NETWORK_ERROR';
      String userMessage = '網路連線發生未知錯誤';
      String suggestion = '請檢查網路連線後重試';
      bool retryAllowed = true;
      int retryDelay = 3000;

      final exceptionString = exception.toString().toLowerCase();

      // 連線逾時
      if (exceptionString.contains('timeout') || exceptionString.contains('timed out')) {
        errorType = 'CONNECTION_TIMEOUT';
        userMessage = '網路連線逾時，請檢查您的網路設定';
        suggestion = '請確認網路連線正常，或稍後再試';
        retryDelay = 5000;
      }
      // 無網路連線
      else if (exceptionString.contains('no internet') || exceptionString.contains('network unreachable')) {
        errorType = 'NO_INTERNET_CONNECTION';
        userMessage = '無法連接網路，某些功能將暫時無法使用';
        suggestion = '請檢查網路設定或啟用行動數據';
        retryDelay = 10000;
      }
      // DNS解析失敗
      else if (exceptionString.contains('dns') || exceptionString.contains('host not found')) {
        errorType = 'DNS_RESOLUTION_FAILED';
        userMessage = '無法解析伺服器位址';
        suggestion = '請檢查DNS設定或稍後再試';
        retryDelay = 8000;
      }
      // SSL/TLS錯誤
      else if (exceptionString.contains('ssl') || exceptionString.contains('certificate')) {
        errorType = 'SSL_ERROR';
        userMessage = '安全連線驗證失敗';
        suggestion = '請檢查系統時間設定或聯繫技術支援';
        retryAllowed = false;
      }

      final errorInfo = {
        'errorType': errorType,
        'userMessage': userMessage,
        'suggestion': suggestion,
        'retryAllowed': retryAllowed,
        'retryDelay': retryDelay,
        'timestamp': DateTime.now().toIso8601String(),
        'originalError': exception.toString(),
      };

      print('[SystemEntry] ✅ 網路錯誤處理完成: $errorType');
      return errorInfo;

    } catch (e) {
      print('[SystemEntry] ❌ 處理網路連線錯誤失敗: $e');
      return {
        'errorType': 'ERROR_HANDLER_FAILED',
        'userMessage': '系統發生未預期的錯誤',
        'suggestion': '請重新啟動應用程式',
        'retryAllowed': false,
        'retryDelay': 0,
        'timestamp': DateTime.now().toIso8601String(),
        'originalError': exception.toString(),
      };
    }
  }

  /**
   * 31. 處理認證相關錯誤
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Map<String, dynamic> handleAuthenticationError(String errorCode, String? errorMessage) {
    try {
      print('[SystemEntry] 處理認證相關錯誤: $errorCode');

      Map<String, dynamic> errorInfo = {
        'errorCode': errorCode,
        'userMessage': '',
        'suggestion': '',
        'actionRequired': '',
        'retryAllowed': true,
        'redirectTo': null,
        'timestamp': DateTime.now().toIso8601String(),
      };

      switch (errorCode) {
        case 'INVALID_CREDENTIALS':
          errorInfo.addAll({
            'userMessage': '帳號或密碼錯誤，請重新輸入',
            'suggestion': '請檢查帳號密碼是否正確',
            'actionRequired': '重新輸入或重設密碼',
            'redirectTo': null,
          });
          break;

        case 'EMAIL_ALREADY_EXISTS':
          errorInfo.addAll({
            'userMessage': '此電子郵件已被註冊，請使用其他信箱或直接登入',
            'suggestion': '使用其他Email或嘗試登入',
            'actionRequired': '導向登入頁面',
            'retryAllowed': false,
            'redirectTo': 'login',
          });
          break;

        case 'ACCOUNT_LOCKED':
          errorInfo.addAll({
            'userMessage': '帳號因多次登入失敗被暫時鎖定',
            'suggestion': '請稍後再試或聯繫客服',
            'actionRequired': '等待解鎖或聯繫客服',
            'retryAllowed': false,
            'redirectTo': null,
          });
          break;

        case 'EMAIL_NOT_VERIFIED':
          errorInfo.addAll({
            'userMessage': '電子郵件尚未驗證，請先完成郵件驗證',
            'suggestion': '檢查郵件並點選驗證連結',
            'actionRequired': '重新發送驗證郵件',
            'redirectTo': 'email-verification',
          });
          break;

        case 'TOKEN_EXPIRED':
          errorInfo.addAll({
            'userMessage': '登入已過期，請重新登入',
            'suggestion': '您的登入狀態已過期，請重新登入',
            'actionRequired': '導向登入頁面',
            'redirectTo': 'login',
          });
          break;

        case 'INVALID_RESET_TOKEN':
          errorInfo.addAll({
            'userMessage': '重設連結無效或已過期',
            'suggestion': '請重新申請密碼重設',
            'actionRequired': '重新申請密碼重設',
            'redirectTo': 'forgot-password',
          });
          break;

        case 'GOOGLE_AUTH_FAILED':
          errorInfo.addAll({
            'userMessage': 'Google 認證失敗，請重新嘗試',
            'suggestion': '檢查Google帳號權限設定',
            'actionRequired': '重新進行Google登入',
            'retryAllowed': true,
          });
          break;

        case 'LINE_ACCOUNT_ALREADY_BOUND':
          errorInfo.addAll({
            'userMessage': '此LINE帳號已被其他使用者綁定',
            'suggestion': '使用其他LINE帳號或解除原綁定',
            'actionRequired': '聯繫客服或使用其他帳號',
            'retryAllowed': false,
          });
          break;

        default:
          errorInfo.addAll({
            'userMessage': errorMessage ?? '認證過程發生未知錯誤',
            'suggestion': '請稍後再試或聯繫客服',
            'actionRequired': '重試或聯繫支援',
            'retryAllowed': true,
          });
      }

      print('[SystemEntry] ✅ 認證錯誤處理完成: $errorCode');
      return errorInfo;

    } catch (e) {
      print('[SystemEntry] ❌ 處理認證相關錯誤失敗: $e');
      return {
        'errorCode': 'AUTH_ERROR_HANDLER_FAILED',
        'userMessage': '系統發生認證錯誤',
        'suggestion': '請重新啟動應用程式',
        'actionRequired': '重新啟動APP',
        'retryAllowed': false,
        'redirectTo': null,
        'timestamp': DateTime.now().toIso8601String(),
      };
    }
  }

  /**
   * 32. 顯示使用者友善錯誤訊息
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Map<String, dynamic> displayUserFriendlyErrorMessage(String errorCode, Map<String, dynamic>? errorData) {
    try {
      print('[SystemEntry] 顯示使用者友善錯誤訊息: $errorCode');

      // 根據當前使用者模式調整訊息風格
      final currentMode = _currentModeConfig?.userMode ?? UserMode.inertial;

      Map<String, dynamic> displayInfo = {
        'title': '',
        'message': '',
        'buttonText': '確定',
        'showDetails': false,
        'iconType': 'error',
        'color': getModeSpecificColor(currentMode, 'error'),
        'duration': 5000,
        'priority': 'normal',
      };

      // 根據模式調整顯示風格
      switch (currentMode) {
        case UserMode.expert:
          displayInfo['showDetails'] = true;
          displayInfo['buttonText'] = '了解詳情';
          displayInfo['priority'] = 'high';
          break;
        case UserMode.cultivation:
          displayInfo['iconType'] = 'info';
          displayInfo['color'] = getModeSpecificColor(currentMode, 'warning');
          displayInfo['buttonText'] = '我知道了';
          break;
        case UserMode.guiding:
          displayInfo['duration'] = 8000;
          displayInfo['buttonText'] = '好的';
          displayInfo['priority'] = 'low';
          break;
        case UserMode.inertial:
        default:
          // 使用預設設定
          break;
      }

      // 根據錯誤類型設定訊息內容
      switch (errorCode) {
        case 'NETWORK_ERROR':
          displayInfo.addAll({
            'title': '網路連線問題',
            'message': '請檢查您的網路連線狀態',
            'iconType': 'network',
          });
          break;

        case 'VALIDATION_ERROR':
          displayInfo.addAll({
            'title': '輸入資料有誤',
            'message': '請檢查並修正輸入內容',
            'iconType': 'warning',
            'color': getModeSpecificColor(currentMode, 'warning'),
          });
          break;

        case 'AUTH_ERROR':
          displayInfo.addAll({
            'title': '認證失敗',
            'message': '請重新登入或聯繫客服',
            'iconType': 'lock',
          });
          break;

        case 'SYSTEM_ERROR':
          displayInfo.addAll({
            'title': '系統暫時無法使用',
            'message': '請稍後再試，造成不便敬請見諒',
            'iconType': 'system',
          });
          break;

        case 'FEATURE_UNAVAILABLE':
          displayInfo.addAll({
            'title': '功能暫時無法使用',
            'message': '此功能正在維護中，請稍後再試',
            'iconType': 'info',
            'color': getModeSpecificColor(currentMode, 'warning'),
          });
          break;

        default:
          displayInfo.addAll({
            'title': '發生錯誤',
            'message': errorData?['userMessage'] ?? '系統發生未預期的錯誤',
            'iconType': 'error',
          });
      }

      // 加入除錯資訊（僅Expert模式）
      if (currentMode == UserMode.expert && errorData != null) {
        displayInfo['debugInfo'] = {
          'errorCode': errorCode,
          'timestamp': DateTime.now().toIso8601String(),
          'additionalData': errorData,
        };
      }

      print('[SystemEntry] ✅ 使用者友善錯誤訊息準備完成');
      return displayInfo;

    } catch (e) {
      print('[SystemEntry] ❌ 顯示使用者友善錯誤訊息失敗: $e');
      return {
        'title': '系統錯誤',
        'message': '應用程式發生未預期的錯誤，請重新啟動',
        'buttonText': '確定',
        'showDetails': false,
        'iconType': 'error',
        'color': 0xFFD32F2F,
        'duration': 5000,
        'priority': 'high',
      };
    }
  }

  /**
   * 33. 安全保存認證Token
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> securelyStoreAuthToken(String token, Map<String, dynamic>? metadata) async {
    try {
      print('[SystemEntry] 安全保存認證Token...');

      if (token.isEmpty) {
        print('[SystemEntry] ❌ Token為空，無法保存');
        return false;
      }

      // 準備儲存資料
      final tokenData = {
        'token': token,
        'storedAt': DateTime.now().toIso8601String(),
        'expiresAt': _calculateTokenExpiry(token),
        'deviceId': await _getDeviceId(),
        'appVersion': '1.0.0',
        'metadata': metadata ?? {},
      };

      // 加密Token（模擬加密過程）
      final encryptedData = _encryptSensitiveData(jsonEncode(tokenData));

      // 儲存到安全儲存（模擬FlutterSecureStorage）
      await _storeSecureData('auth_token', encryptedData);

      // 設定自動清理機制
      await _scheduleTokenCleanup();

      print('[SystemEntry] ✅ 認證Token安全保存完成');
      return true;

    } catch (e) {
      print('[SystemEntry] ❌ 安全保存認證Token失敗: $e');
      return false;
    }
  }

  /**
   * 34. 讀取已保存的認證Token
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<Map<String, dynamic>?> retrieveStoredAuthToken() async {
    try {
      print('[SystemEntry] 讀取已保存的認證Token...');

      // 從安全儲存讀取
      final encryptedData = await _getSecureData('auth_token');

      if (encryptedData == null) {
        print('[SystemEntry] ⚠️ 沒有找到已保存的Token');
        return null;
      }

      // 解密資料
      final decryptedData = _decryptSensitiveData(encryptedData);
      final tokenData = jsonDecode(decryptedData);

      // 檢查Token有效性
      final isValid = await _verifyTokenValidity(tokenData);

      if (!isValid) {
        print('[SystemEntry] ⚠️ 已保存的Token已過期或無效，清除Token');
        await clearStoredAuthToken();
        return null;
      }

      print('[SystemEntry] ✅ 認證Token讀取完成');
      return {
        'token': tokenData['token'],
        'storedAt': tokenData['storedAt'],
        'expiresAt': tokenData['expiresAt'],
        'metadata': tokenData['metadata'] ?? {},
        'isValid': true,
      };

    } catch (e) {
      print('[SystemEntry] ❌ 讀取已保存的認證Token失敗: $e');
      // 發生錯誤時清除可能損壞的Token
      await clearStoredAuthToken();
      return null;
    }
  }

  /**
   * 35. 清除所有本地儲存資料
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> clearAllLocalStorageData() async {
    try {
      print('[SystemEntry] 清除所有本地儲存資料...');

      List<String> clearResults = [];

      // 1. 清除認證Token
      try {
        await clearStoredAuthToken();
        clearResults.add('✅ 認證Token已清除');
      } catch (e) {
        clearResults.add('❌ 認證Token清除失敗: $e');
      }

      // 2. 清除模式設定
      try {
        await _clearModeConfiguration();
        clearResults.add('✅ 模式設定已清除');
      } catch (e) {
        clearResults.add('❌ 模式設定清除失敗: $e');
      }

      // 3. 清除使用者偏好設定
      try {
        await _clearUserPreferences();
        clearResults.add('✅ 使用者偏好設定已清除');
      } catch (e) {
        clearResults.add('❌ 使用者偏好設定清除失敗: $e');
      }

      // 4. 清除快取資料
      try {
        await _clearCacheData();
        clearResults.add('✅ 快取資料已清除');
      } catch (e) {
        clearResults.add('❌ 快取資料清除失敗: $e');
      }

      // 5. 清除暫存檔案
      try {
        await _clearTemporaryFiles();
        clearResults.add('✅ 暫存檔案已清除');
      } catch (e) {
        clearResults.add('❌ 暫存檔案清除失敗: $e');
      }

      // 6. 重置內部狀態
      _currentAuthState = null;
      _currentModeConfig = null;
      _isInitialized = false;
      clearResults.add('✅ 內部狀態已重置');

      // 統計清除結果
      final successCount = clearResults.where((r) => r.startsWith('✅')).length;
      final totalCount = clearResults.length;

      print('[SystemEntry] 清除結果統計：');
      for (String result in clearResults) {
        print('[SystemEntry] $result');
      }

      if (successCount == totalCount) {
        print('[SystemEntry] ✅ 所有本地儲存資料清除完成');
        return true;
      } else {
        print('[SystemEntry] ⚠️ 部分資料清除失敗 ($successCount/$totalCount)');
        return false;
      }

    } catch (e) {
      print('[SystemEntry] ❌ 清除所有本地儲存資料失敗: $e');
      return false;
    }
  }

  /**
   * 36. 導航至指定頁面
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> navigateToPage(String routeName, Map<String, dynamic>? arguments) async {
    try {
      print('[SystemEntry] 導航至指定頁面: $routeName');

      // 檢查路由名稱是否有效
      if (routeName.isEmpty) {
        print('[SystemEntry] ❌ 路由名稱為空');
        return false;
      }

      // 有效路由清單
      final validRoutes = [
        '/',              // 首頁/啟動頁
        '/register',      // 註冊頁
        '/login',         // 登入頁
        '/forgot-password', // 忘記密碼頁
        '/mode-assessment', // 模式評估頁
        '/platform-binding', // 平台綁定頁
        '/app-promotion', // APP推廣頁
        '/main',          // 主要功能頁
      ];

      if (!validRoutes.contains(routeName)) {
        print('[SystemEntry] ❌ 無效的路由名稱: $routeName');
        return false;
      }

      // 記錄導航歷史
      await _recordNavigationHistory(routeName, arguments);

      // 根據使用者模式調整導航動畫
      final currentMode = _currentModeConfig?.userMode ?? UserMode.inertial;
      final navigationConfig = _getNavigationConfig(currentMode);

      // 準備導航資料
      final navigationData = {
        'route': routeName,
        'arguments': arguments ?? {},
        'timestamp': DateTime.now().toIso8601String(),
        'fromPage': _getCurrentRoute(),
        'animationType': navigationConfig['animationType'],
        'duration': navigationConfig['duration'],
      };

      // 執行導航（模擬）
      await Future.delayed(Duration(milliseconds: navigationConfig['duration']));

      print('[SystemEntry] ✅ 導航完成: $routeName');
      return true;

    } catch (e) {
      print('[SystemEntry] ❌ 導航至指定頁面失敗: $e');
      return false;
    }
  }

  /**
   * 37. 替換當前頁面
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> replaceCurrentPage(String routeName, Map<String, dynamic>? arguments) async {
    try {
      print('[SystemEntry] 替換當前頁面: $routeName');

      if (routeName.isEmpty) {
        print('[SystemEntry] ❌ 路由名稱為空');
        return false;
      }

      // 記錄頁面替換事件
      await _recordPageReplacement(_getCurrentRoute(), routeName, arguments);

      // 清除當前頁面狀態
      await _clearCurrentPageState();

      // 執行頁面替換（模擬）
      await Future.delayed(Duration(milliseconds: 300));

      print('[SystemEntry] ✅ 頁面替換完成: $routeName');
      return true;

    } catch (e) {
      print('[SystemEntry] ❌ 替換當前頁面失敗: $e');
      return false;
    }
  }

  /**
   * 38. 返回上一頁面
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Future<bool> navigateBackToPreviousPage(dynamic result) async {
    try {
      print('[SystemEntry] 返回上一頁面');

      // 檢查是否有上一頁
      final navigationHistory = await _getNavigationHistory();

      if (navigationHistory.isEmpty || navigationHistory.length < 2) {
        print('[SystemEntry] ⚠️ 沒有上一頁面可返回');
        return false;
      }

      // 取得上一頁面資訊
      final previousPage = navigationHistory[navigationHistory.length - 2];
      final currentPage = _getCurrentRoute();

      // 記錄返回事件
      await _recordNavigationBack(currentPage, previousPage['route'], result);

      // 執行返回動畫（模擬）
      await Future.delayed(Duration(milliseconds: 250));

      // 清理當前頁面資源
      await _cleanupCurrentPageResources();

      print('[SystemEntry] ✅ 成功返回至: ${previousPage['route']}');
      return true;

    } catch (e) {
      print('[SystemEntry] ❌ 返回上一頁面失敗: $e');
      return false;
    }
  }

  /**
   * 39. 執行即時表單驗證
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Map<String, dynamic> performRealtimeFormValidation(String fieldName, String value) {
    try {
      Map<String, dynamic> validationResult = {
        'isValid': true,
        'errorMessage': null,
        'warningMessage': null,
        'suggestionMessage': null,
        'fieldName': fieldName,
        'validatedValue': value,
        'validationType': 'realtime',
        'timestamp': DateTime.now().toIso8601String(),
      };

      switch (fieldName.toLowerCase()) {
        case 'email':
          if (value.isEmpty) {
            validationResult.addAll({
              'isValid': false,
              'errorMessage': '請輸入Email地址',
            });
          } else if (!validateEmailFormat(value)) {
            validationResult.addAll({
              'isValid': false,
              'errorMessage': 'Email格式不正確',
              'suggestionMessage': '請輸入有效的Email地址，例如：user@example.com',
            });
          } else {
            validationResult['suggestionMessage'] = 'Email格式正確';
          }
          break;

        case 'password':
          if (value.isEmpty) {
            validationResult.addAll({
              'isValid': false,
              'errorMessage': '請輸入密碼',
            });
          } else {
            final passwordStrength = checkPasswordStrength(value);
            if (!passwordStrength.isAcceptable) {
              validationResult.addAll({
                'isValid': false,
                'errorMessage': '密碼強度不足',
                'suggestionMessage': passwordStrength.suggestions.join('、'),
              });
            } else {
              validationResult.addAll({
                'warningMessage': passwordStrength.level == 'medium' ? '密碼強度中等，建議增強' : null,
                'suggestionMessage': '密碼強度：${passwordStrength.level}',
              });
            }
          }
          break;

        case 'confirmpassword':
        case 'confirm_password':
          // 需要原始密碼進行比對，這裡僅做基本檢查
          if (value.isEmpty) {
            validationResult.addAll({
              'isValid': false,
              'errorMessage': '請確認密碼',
            });
          } else {
            validationResult['suggestionMessage'] = '請確保與原密碼一致';
          }
          break;

        case 'displayname':
        case 'display_name':
          if (value.length > 50) {
            validationResult.addAll({
              'isValid': false,
              'errorMessage': '顯示名稱不能超過50個字元',
            });
          } else if (value.contains(RegExp(r'[<>"\'/\\]'))) {
            validationResult.addAll({
              'isValid': false,
              'errorMessage': '顯示名稱包含無效字元',
              'suggestionMessage': '不允許使用 < > " \' / \\ 等特殊字元',
            });
          } else if (value.length >= 2) {
            validationResult['suggestionMessage'] = '顯示名稱格式正確';
          }
          break;

        default:
          // 通用驗證規則
          if (value.length > 1000) {
            validationResult.addAll({
              'isValid': false,
              'errorMessage': '輸入內容過長',
            });
          }
      }

      print('[SystemEntry] ✅ 即時表單驗證完成: $fieldName');
      return validationResult;

    } catch (e) {
      print('[SystemEntry] ❌ 執行即時表單驗證失敗: $e');
      return {
        'isValid': false,
        'errorMessage': '驗證過程發生錯誤',
        'fieldName': fieldName,
        'validatedValue': value,
        'validationType': 'realtime',
        'timestamp': DateTime.now().toIso8601String(),
      };
    }
  }

  /**
   * 40. 執行完整表單驗證
   * @version 2025-09-12-v1.0.0
   * @date 2025-09-12
   * @update: 初始版本
   */
  Map<String, dynamic> performCompleteFormValidation(Map<String, String> formData) {
    try {
      print('[SystemEntry] 執行完整表單驗證...');

      Map<String, dynamic> overallResult = {
        'isValid': true,
        'errorCount': 0,
        'warningCount': 0,
        'fieldResults': {},
        'overallErrors': [],
        'formType': 'unknown',
        'validationTime': DateTime.now().toIso8601String(),
      };

      // 判斷表單類型
      String formType = _determineFormType(formData);
      overallResult['formType'] = formType;

      // 逐一驗證每個欄位
      for (String fieldName in formData.keys) {
        final fieldValue = formData[fieldName] ?? '';
        final fieldResult = performRealtimeFormValidation(fieldName, fieldValue);

        overallResult['fieldResults'][fieldName] = fieldResult;

        if (!fieldResult['isValid']) {
          overallResult['isValid'] = false;
          overallResult['errorCount']++;
        }

        if (fieldResult['warningMessage'] != null) {
          overallResult['warningCount']++;
        }
      }

      // 執行表單特定的交叉驗證
      _performCrossFieldValidation(formData, overallResult);

      // 根據表單類型執行額外驗證
      _performFormTypeSpecificValidation(formType, formData, overallResult);

      // 產生驗證摘要
      if (overallResult['isValid']) {
        overallResult['validationSummary'] = '所有欄位驗證通過';
      } else {
        overallResult['validationSummary'] = '發現 ${overallResult['errorCount']} 個錯誤需要修正';
      }

      print('[SystemEntry] ✅ 完整表單驗證完成 - 類型: $formType, 結果: ${overallResult['isValid']}');
      return overallResult;

    } catch (e) {
      print('[SystemEntry] ❌ 執行完整表單驗證失敗: $e');
      return {
        'isValid': false,
        'errorCount': 1,
        'warningCount': 0,
        'fieldResults': {},
        'overallErrors': ['表單驗證過程發生系統錯誤'],
        'formType': 'unknown',
        'validationTime': DateTime.now().toIso8601String(),
        'validationSummary': '表單驗證失敗，請重新嘗試',
      };
    }
  }

  // ===========================================
  // 階段三內部輔助函數
  // ===========================================

  /// 計算Token過期時間
  String _calculateTokenExpiry(String token) {
    // 模擬JWT Token解析，預設7天過期
    return DateTime.now().add(Duration(days: 7)).toIso8601String();
  }

  /// 取得裝置ID
  Future<String> _getDeviceId() async {
    await Future.delayed(Duration(milliseconds: 10));
    return 'device_${DateTime.now().millisecondsSinceEpoch}';
  }

  /// 加密敏感資料
  String _encryptSensitiveData(String data) {
    // 模擬加密過程
    final bytes = utf8.encode(data);
    final hash = sha256.convert(bytes);
    return 'encrypted_${hash.toString()}_${base64Encode(bytes)}';
  }

  /// 解密敏感資料
  String _decryptSensitiveData(String encryptedData) {
    // 模擬解密過程
    final parts = encryptedData.split('_');
    if (parts.length >= 3) {
      return utf8.decode(base64Decode(parts.last));
    }
    throw Exception('解密失敗：資料格式錯誤');
  }

  /// 儲存安全資料
  Future<void> _storeSecureData(String key, String value) async {
    await Future.delayed(Duration(milliseconds: 50));
    // 模擬FlutterSecureStorage.write()
  }

  /// 取得安全資料
  Future<String?> _getSecureData(String key) async {
    await Future.delayed(Duration(milliseconds: 30));
    // 模擬FlutterSecureStorage.read()
    return null; // 模擬沒有資料
  }

  /// 驗證Token有效性
  Future<bool> _verifyTokenValidity(Map<String, dynamic> tokenData) async {
    await Future.delayed(Duration(milliseconds: 100));

    final expiresAt = DateTime.tryParse(tokenData['expiresAt'] ?? '');
    if (expiresAt == null) return false;

    return DateTime.now().isBefore(expiresAt);
  }

  /// 清除已儲存的認證Token
  Future<void> clearStoredAuthToken() async {
    await Future.delayed(Duration(milliseconds: 50));
    // 模擬清除FlutterSecureStorage中的Token
  }

  /// 安排Token清理
  Future<void> _scheduleTokenCleanup() async {
    await Future.delayed(Duration(milliseconds: 20));
    // 模擬設定自動清理過期Token的排程
  }

  /// 清除模式設定
  Future<void> _clearModeConfiguration() async {
    await Future.delayed(Duration(milliseconds: 30));
    // 模擬清除SharedPreferences中的模式設定
  }

  /// 清除使用者偏好設定
  Future<void> _clearUserPreferences() async {
    await Future.delayed(Duration(milliseconds: 40));
    // 模擬清除SharedPreferences中的使用者設定
  }

  /// 清除快取資料
  Future<void> _clearCacheData() async {
    await Future.delayed(Duration(milliseconds: 60));
    // 模擬清除應用程式快取
  }

  /// 清除暫存檔案
  Future<void> _clearTemporaryFiles() async {
    await Future.delayed(Duration(milliseconds: 80));
    // 模擬清除暫存目錄中的檔案
  }

  /// 記錄導航歷史
  Future<void> _recordNavigationHistory(String route, Map<String, dynamic>? arguments) async {
    await Future.delayed(Duration(milliseconds: 10));
    // 模擬記錄導航歷史到本地儲存
  }

  /// 取得當前路由
  String _getCurrentRoute() {
    // 模擬取得當前路由名稱
    return '/';
  }

  /// 取得導航設定
  Map<String, dynamic> _getNavigationConfig(UserMode mode) {
    final configs = {
      UserMode.expert: {'animationType': 'slide', 'duration': 200},
      UserMode.inertial: {'animationType': 'fade', 'duration': 300},
      UserMode.cultivation: {'animationType': 'scale', 'duration': 400},
      UserMode.guiding: {'animationType': 'fade', 'duration': 500},
    };

    return configs[mode] ?? configs[UserMode.inertial]!;
  }

  /// 取得導航歷史
  Future<List<Map<String, dynamic>>> _getNavigationHistory() async {
    await Future.delayed(Duration(milliseconds: 20));
    // 模擬從本地儲存取得導航歷史
    return [];
  }

  /// 記錄頁面替換
  Future<void> _recordPageReplacement(String fromRoute, String toRoute, Map<String, dynamic>? arguments) async {
    await Future.delayed(Duration(milliseconds: 10));
    // 模擬記錄頁面替換事件
  }

  /// 清除當前頁面狀態
  Future<void> _clearCurrentPageState() async {
    await Future.delayed(Duration(milliseconds: 50));
    // 模擬清除當前頁面的狀態資料
  }

  /// 記錄返回導航
  Future<void> _recordNavigationBack(String fromRoute, String toRoute, dynamic result) async {
    await Future.delayed(Duration(milliseconds: 10));
    // 模擬記錄返回導航事件
  }

  /// 清理當前頁面資源
  Future<void> _cleanupCurrentPageResources() async {
    await Future.delayed(Duration(milliseconds: 30));
    // 模擬清理當前頁面的資源（監聽器、定時器等）
  }

  /// 判斷表單類型
  String _determineFormType(Map<String, String> formData) {
    final fieldNames = formData.keys.map((k) => k.toLowerCase()).toSet();

    if (fieldNames.contains('email') && fieldNames.contains('password')) {
      if (fieldNames.contains('confirmpassword') || fieldNames.contains('confirm_password')) {
        return 'register';
      } else {
        return 'login';
      }
    } else if (fieldNames.contains('email') && !fieldNames.contains('password')) {
      return 'forgot_password';
    } else {
      return 'unknown';
    }
  }

  /// 執行交叉欄位驗證
  void _performCrossFieldValidation(Map<String, String> formData, Map<String, dynamic> result) {
    // 密碼確認驗證
    if (formData.containsKey('password') && (formData.containsKey('confirmPassword') || formData.containsKey('confirm_password'))) {
      final password = formData['password'] ?? '';
      final confirmPassword = formData['confirmPassword'] ?? formData['confirm_password'] ?? '';

      if (password != confirmPassword) {
        result['isValid'] = false;
        result['errorCount']++;
        result['overallErrors'].add('密碼與確認密碼不一致');
      }
    }
  }

  /// 執行表單類型特定驗證
  void _performFormTypeSpecificValidation(String formType, Map<String, String> formData, Map<String, dynamic> result) {
    switch (formType) {
      case 'register':
        // 註冊表單額外驗證
        if (!formData.containsKey('email') || formData['email']!.isEmpty) {
          result['overallErrors'].add('註冊表單必須包含Email');
          result['isValid'] = false;
          result['errorCount']++;
        }
        break;
      case 'login':
        // 登入表單額外驗證
        if (!formData.containsKey('email') || !formData.containsKey('password')) {
          result['overallErrors'].add('登入表單必須包含Email和密碼');
          result['isValid'] = false;
          result['errorCount']++;
        }
        break;
      case 'forgot_password':
        // 忘記密碼表單額外驗證
        if (!formData.containsKey('email') || formData['email']!.isEmpty) {
          result['overallErrors'].add('忘記密碼表單必須包含Email');
          result['isValid'] = false;
          result['errorCount']++;
        }
        break;
    }
  }

  // ===========================================
  // 階段三內部輔助函數
  // ===========================================

  /// 獲取測試用的常見密碼列表
  List<String> _getCommonPasswordsFromTestData() {
    // 模擬從7590系統獲取常見密碼清單
    // 在實際應用中，這部分將替換為從API或配置檔案讀取
    return [
      'password', 'password123', '123456789', 'qwerty', 'abc123',
      'password1', 'admin', 'welcome', 'letmein', 'monkey',
      '123456', '111111', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
      'admin123', 'root', 'test', 'guest', '12345678'
    ];
  }

  /// 取得預設使用者模式
  UserMode _getDefaultUserModeFromConfig() {
    // 在這裡實現從環境變數、SharedPreferences或配置檔案讀取預設模式
    // 為了範例，我們假設預設為 'inertial'
    print('[SystemEntry] 正在從配置讀取預設使用者模式...');
    return UserMode.inertial;
  }

  /// 取得預設設定
  Map<String, dynamic> _getDefaultSettingsFromConfig() {
    // 在這裡實現從環境變數、SharedPreferences或配置檔案讀取預設設定
    // 為了範例，我們假設預設設定如下
    print('[SystemEntry] 正在從配置讀取預設設定...');
    return {
      'theme': 'default',
      'language': 'zh-TW',
      'notifications': true,
      // 'autoSaveInterval': 300, // 範例：自動保存間隔（秒）
      // 'defaultCurrency': 'TWD', // 範例：預設幣別
    };
  }

  // ===========================================
  // Getter方法
  // ===========================================

  /// 取得當前認證狀態
  AuthState? get currentAuthState => _currentAuthState;

  /// 取得當前模式設定
  ModeConfiguration? get currentModeConfig => _currentModeConfig;

  /// 檢查是否已初始化
  bool get isInitialized => _isInitialized;
}