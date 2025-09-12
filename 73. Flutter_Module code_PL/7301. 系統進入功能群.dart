
/**
 * 7301. 系統進入功能群.dart
 * @version v1.1.0
 * @date 2025-09-12
 * @update: 階段二實作完成 - 模式評估與跨平台整合（函數16-26）
 * 
 * 本模組實現LCAS 2.0系統進入功能群的完整功能，
 * 包括APP啟動、使用者認證、模式設定、模式評估問卷、
 * LINE OA綁定與跨平台資料同步等關鍵功能。
 * 嚴格遵循0026、0090、8088文件規範。
 */

import 'dart:async';
import 'dart:convert';
import 'package:crypto/crypto.dart';

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

/// 使用者資訊
class User {
  final String id;
  final String email;
  final String? displayName;
  final String? avatarUrl;
  final UserMode mode;
  final DateTime createdAt;

  User({
    required this.id,
    required this.email,
    this.displayName,
    this.avatarUrl,
    required this.mode,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'],
      avatarUrl: json['avatarUrl'],
      mode: UserMode.values.firstWhere(
        (mode) => mode.name == json['mode'],
        orElse: () => UserMode.inertial,
      ),
      createdAt: DateTime.parse(json['createdAt']),
    );
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
      
      // 建立預設模式設定
      _currentModeConfig = ModeConfiguration(
        userMode: UserMode.inertial, // 預設為慣性模式
        settings: {
          'theme': 'default',
          'language': 'zh-TW',
          'notifications': true,
        },
        themeConfig: _getDefaultThemeConfig(UserMode.inertial),
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
      
      // 4. 調用8101認證服務API
      final apiResponse = await _callAuthAPI('/register', {
        'email': request.email,
        'password': _hashPassword(request.password),
        'displayName': request.displayName,
      });
      
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
      
      // 3. 調用8101認證服務API
      final apiResponse = await _callAuthAPI('/google-register', {
        'googleToken': googleToken,
        'email': googleUser['email'],
        'displayName': googleUser['name'],
        'avatarUrl': googleUser['picture'],
      });
      
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
      final commonPasswords = [
        'password', 'password123', '123456789', 'qwerty', 'abc123',
        'password1', 'admin', 'welcome', 'letmein', 'monkey'
      ];
      
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
      
      // 2. 調用8101認證服務API
      final apiResponse = await _callAuthAPI('/login', {
        'email': email,
        'password': _hashPassword(password),
      });
      
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
      
      // 2. 調用8101認證服務API
      final apiResponse = await _callAuthAPI('/google-login', {
        'googleToken': googleAuthResult['token'],
      });
      
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
      
      // 2. 調用8101認證服務API
      final apiResponse = await _callAuthAPI('/forgot-password', {
        'email': email,
      });
      
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
      
      // 調用8101認證服務API
      final apiResponse = await _callAuthAPI('/validate-reset-token', {
        'token': token,
      });
      
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
      
      // 3. 調用8101認證服務API
      final apiResponse = await _callAuthAPI('/reset-password', {
        'token': token,
        'newPassword': _hashPassword(newPassword),
      });
      
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
      
      // 調用8111系統服務API提交答案
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
  // Getter方法
  // ===========================================

  /// 取得當前認證狀態
  AuthState? get currentAuthState => _currentAuthState;
  
  /// 取得當前模式設定
  ModeConfiguration? get currentModeConfig => _currentModeConfig;
  
  /// 檢查是否已初始化
  bool get isInitialized => _isInitialized;
}
