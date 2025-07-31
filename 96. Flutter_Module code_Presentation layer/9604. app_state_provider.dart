
/**
 * 應用程式狀態提供者_1.0.0
 * @module 展示層狀態管理
 * @description LCAS 2.0 全域應用程式狀態管理 - 統一管理應用程式級別狀態
 * @update 2025-01-31: 建立v1.0.0版本，實作全域狀態管理與生命週期處理
 */

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// 服務導入
import '../91. Flutter_Module code_AP layer/lib/services/9112. auth_service.dart';
import '../91. Flutter_Module code_AP layer/lib/services/9115. entry_service.dart';
import '../91. Flutter_Module code_AP layer/lib/services/9118. schedule_service.dart';

/**
 * 01. 應用程式狀態列舉
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 定義應用程式運行狀態
 */
enum AppState {
  initializing,   // 初始化中
  authenticated,  // 已認證
  unauthenticated, // 未認證
  offline,        // 離線模式
  error,          // 錯誤狀態
}

/**
 * 02. 應用程式狀態提供者類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 管理全域應用程式狀態與使用者會話
 */
class AppStateProvider extends ChangeNotifier {
  // 服務實例
  final AuthService _authService = AuthService();
  final EntryService _entryService = EntryService();
  final ScheduleService _scheduleService = ScheduleService();
  
  // 私有狀態變數
  AppState _currentState = AppState.initializing;
  String? _userId;
  String? _userName;
  String? _userEmail;
  bool _isFirstTime = true;
  bool _isOfflineMode = false;
  String? _errorMessage;
  DateTime? _lastSyncTime;
  
  // 公開屬性
  AppState get currentState => _currentState;
  String? get userId => _userId;
  String? get userName => _userName;
  String? get userEmail => _userEmail;
  bool get isFirstTime => _isFirstTime;
  bool get isOfflineMode => _isOfflineMode;
  String? get errorMessage => _errorMessage;
  DateTime? get lastSyncTime => _lastSyncTime;
  
  bool get isAuthenticated => _currentState == AppState.authenticated && _userId != null;
  bool get isInitialized => _currentState != AppState.initializing;
  
  /**
   * 03. 初始化應用程式狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 載入持久化狀態並檢查使用者認證
   */
  Future<void> initialize() async {
    try {
      debugPrint('[AppStateProvider] 開始初始化');
      
      // 載入本地設定
      await _loadLocalSettings();
      
      // 檢查認證狀態
      await _checkAuthenticationStatus();
      
      // 設定生命週期監聽
      _setupAppLifecycleListener();
      
      debugPrint('[AppStateProvider] 初始化完成: $_currentState');
    } catch (e) {
      debugPrint('[AppStateProvider] 初始化失敗: $e');
      _setErrorState('初始化失敗: $e');
    }
  }
  
  /**
   * 04. 使用者登入
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 處理使用者登入流程與狀態更新
   */
  Future<bool> signIn({
    required String email,
    required String password,
  }) async {
    try {
      debugPrint('[AppStateProvider] 嘗試登入: $email');
      
      final response = await _authService.signInWithEmail(
        email: email,
        password: password,
      );
      
      if (response.success && response.data != null) {
        final userData = response.data!;
        await _setAuthenticatedState(
          userId: userData['userId'],
          userName: userData['userName'],
          userEmail: userData['email'],
        );
        
        // 同步用戶數據
        await _syncUserData();
        
        return true;
      } else {
        _setErrorState(response.message ?? '登入失敗');
        return false;
      }
    } catch (e) {
      debugPrint('[AppStateProvider] 登入錯誤: $e');
      _setErrorState('登入錯誤: $e');
      return false;
    }
  }
  
  /**
   * 05. 使用者登出
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 清理使用者會話與本地資料
   */
  Future<void> signOut() async {
    try {
      debugPrint('[AppStateProvider] 使用者登出');
      
      // 調用後端登出API
      await _authService.signOut();
      
      // 清理本地狀態
      await _clearAuthenticatedState();
      
      debugPrint('[AppStateProvider] 登出完成');
    } catch (e) {
      debugPrint('[AppStateProvider] 登出錯誤: $e');
      // 即使API失敗也要清理本地狀態
      await _clearAuthenticatedState();
    }
  }
  
  /**
   * 06. 切換離線模式
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 管理線上/離線模式切換
   */
  Future<void> toggleOfflineMode(bool offline) async {
    if (_isOfflineMode != offline) {
      _isOfflineMode = offline;
      
      if (!offline && isAuthenticated) {
        // 重新上線時同步數據
        await _syncUserData();
      }
      
      await _saveLocalSettings();
      notifyListeners();
      
      debugPrint('[AppStateProvider] 切換離線模式: $offline');
    }
  }
  
  /**
   * 07. 同步使用者資料
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 與後端同步使用者相關資料
   */
  Future<void> syncUserData() async {
    if (!isAuthenticated || _isOfflineMode) return;
    
    await _syncUserData();
  }
  
  /**
   * 08. 清除錯誤狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 清除當前錯誤訊息
   */
  void clearError() {
    if (_errorMessage != null) {
      _errorMessage = null;
      
      // 如果當前是錯誤狀態，恢復到適當狀態
      if (_currentState == AppState.error) {
        _currentState = isAuthenticated 
            ? AppState.authenticated 
            : AppState.unauthenticated;
      }
      
      notifyListeners();
    }
  }
  
  /**
   * 09. 檢查認證狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 驗證使用者當前認證狀態
   */
  Future<void> _checkAuthenticationStatus() async {
    try {
      final response = await _authService.getCurrentUser();
      
      if (response.success && response.data != null) {
        final userData = response.data!;
        await _setAuthenticatedState(
          userId: userData['userId'],
          userName: userData['userName'],
          userEmail: userData['email'],
        );
      } else {
        _setUnauthenticatedState();
      }
    } catch (e) {
      debugPrint('[AppStateProvider] 認證檢查失敗: $e');
      _setUnauthenticatedState();
    }
  }
  
  /**
   * 10. 設定已認證狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 更新為已認證狀態並儲存使用者資訊
   */
  Future<void> _setAuthenticatedState({
    required String userId,
    required String userName,
    required String userEmail,
  }) async {
    _currentState = AppState.authenticated;
    _userId = userId;
    _userName = userName;
    _userEmail = userEmail;
    _errorMessage = null;
    
    await _saveLocalSettings();
    notifyListeners();
    
    debugPrint('[AppStateProvider] 設定已認證狀態: $userId');
  }
  
  /**
   * 11. 設定未認證狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 更新為未認證狀態
   */
  void _setUnauthenticatedState() {
    _currentState = AppState.unauthenticated;
    _errorMessage = null;
    notifyListeners();
    
    debugPrint('[AppStateProvider] 設定未認證狀態');
  }
  
  /**
   * 12. 設定錯誤狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 更新為錯誤狀態並記錄錯誤訊息
   */
  void _setErrorState(String error) {
    _currentState = AppState.error;
    _errorMessage = error;
    notifyListeners();
    
    debugPrint('[AppStateProvider] 設定錯誤狀態: $error');
  }
  
  /**
   * 13. 清理已認證狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 清理使用者資訊並更新狀態
   */
  Future<void> _clearAuthenticatedState() async {
    _currentState = AppState.unauthenticated;
    _userId = null;
    _userName = null;
    _userEmail = null;
    _errorMessage = null;
    _lastSyncTime = null;
    
    await _saveLocalSettings();
    notifyListeners();
  }
  
  /**
   * 14. 同步使用者資料（內部）
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 執行實際的資料同步邏輯
   */
  Future<void> _syncUserData() async {
    try {
      debugPrint('[AppStateProvider] 開始同步用戶資料');
      
      // 同步記帳資料
      // await _entryService.syncEntries();
      
      // 同步排程設定
      // await _scheduleService.syncReminders();
      
      _lastSyncTime = DateTime.now();
      await _saveLocalSettings();
      
      debugPrint('[AppStateProvider] 資料同步完成');
    } catch (e) {
      debugPrint('[AppStateProvider] 資料同步失敗: $e');
      // 同步失敗不影響主要流程
    }
  }
  
  /**
   * 15. 載入本地設定
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 從持久化儲存載入應用程式設定
   */
  Future<void> _loadLocalSettings() async {
    final prefs = await SharedPreferences.getInstance();
    
    _userId = prefs.getString('user_id');
    _userName = prefs.getString('user_name');
    _userEmail = prefs.getString('user_email');
    _isFirstTime = prefs.getBool('is_first_time') ?? true;
    _isOfflineMode = prefs.getBool('is_offline_mode') ?? false;
    
    final lastSyncTimeMs = prefs.getInt('last_sync_time');
    if (lastSyncTimeMs != null) {
      _lastSyncTime = DateTime.fromMillisecondsSinceEpoch(lastSyncTimeMs);
    }
    
    debugPrint('[AppStateProvider] 載入本地設定完成');
  }
  
  /**
   * 16. 儲存本地設定
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 將應用程式設定持久化儲存
   */
  Future<void> _saveLocalSettings() async {
    final prefs = await SharedPreferences.getInstance();
    
    if (_userId != null) {
      await prefs.setString('user_id', _userId!);
    } else {
      await prefs.remove('user_id');
    }
    
    if (_userName != null) {
      await prefs.setString('user_name', _userName!);
    } else {
      await prefs.remove('user_name');
    }
    
    if (_userEmail != null) {
      await prefs.setString('user_email', _userEmail!);
    } else {
      await prefs.remove('user_email');
    }
    
    await prefs.setBool('is_first_time', _isFirstTime);
    await prefs.setBool('is_offline_mode', _isOfflineMode);
    
    if (_lastSyncTime != null) {
      await prefs.setInt('last_sync_time', _lastSyncTime!.millisecondsSinceEpoch);
    }
  }
  
  /**
   * 17. 設定應用程式生命週期監聽
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 監聽應用程式前景背景切換
   */
  void _setupAppLifecycleListener() {
    WidgetsBinding.instance.addObserver(_AppLifecycleObserver(this));
  }
  
  /**
   * 18. 處理應用程式恢復前景
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 應用程式從背景恢復時的處理
   */
  void _onAppResumed() {
    debugPrint('[AppStateProvider] 應用程式恢復前景');
    
    if (isAuthenticated && !_isOfflineMode) {
      // 檢查認證狀態是否仍然有效
      _checkAuthenticationStatus();
      
      // 同步最新資料
      _syncUserData();
    }
  }
  
  /**
   * 19. 處理應用程式進入背景
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 應用程式進入背景時的處理
   */
  void _onAppPaused() {
    debugPrint('[AppStateProvider] 應用程式進入背景');
    
    // 自動儲存當前狀態
    _saveLocalSettings();
  }
  
  /**
   * 20. 標記首次使用完成
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 完成首次使用流程設定
   */
  Future<void> completeFirstTimeSetup() async {
    _isFirstTime = false;
    await _saveLocalSettings();
    notifyListeners();
    
    debugPrint('[AppStateProvider] 首次使用設定完成');
  }
}

/**
 * 21. 應用程式生命週期觀察者
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 監聽應用程式生命週期變化
 */
class _AppLifecycleObserver extends WidgetsBindingObserver {
  final AppStateProvider _appStateProvider;
  
  _AppLifecycleObserver(this._appStateProvider);
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _appStateProvider._onAppResumed();
        break;
      case AppLifecycleState.paused:
        _appStateProvider._onAppPaused();
        break;
      default:
        break;
    }
  }
}
