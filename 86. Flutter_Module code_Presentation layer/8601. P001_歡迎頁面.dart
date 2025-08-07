
/**
 * 8601. P001_歡迎頁面_2.4.0
 * @module P001歡迎頁面
 * @description Flutter Presentation Layer入口頁面 - 四模式選擇、品牌展示、導航分發
 * @update 2025-01-30: 升級至v2.4.0，修正函數編號格式、API端點路徑、版本統一
 */

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:device_info_plus/device_info_plus.dart';

// ===== 資料模型定義 =====

/**
 * 34. 歡迎頁面狀態枚舉
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 定義歡迎頁面的各種狀態（8701規範）
 */
enum WelcomePageState {
  loading,        // 載入中
  modeSelection,  // 模式選擇
  loginRedirect,  // 登入重導向
  error,          // 錯誤狀態
}

/**
 * 35. 使用者模式枚舉
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 使用者模式枚舉（0015規範命名）
 */
enum UserMode {
  controller,  // 精準控制者
  logger,      // 紀錄習慣者
  struggler,   // 轉型挑戰者
  sleeper,     // 潛在覺醒者
}

/**
 * 36. 錯誤類型枚舉
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 錯誤類型枚舉（8701規範詳細錯誤分類）
 */
enum WelcomeErrorType {
  initialization,    // 初始化錯誤
  networkConnection, // 網路連線錯誤
  modeSelection,     // 模式選擇錯誤
  accountDeletion,   // 帳號刪除相關錯誤
  validation,        // 輸入驗證錯誤
  unknown,          // 未知錯誤
}

enum DeviceType { 
  mobile, 
  tablet, 
  smallDesktop, 
  largeDesktop 
}

/**
 * 37. 使用者設定請求模型
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 使用者設定請求模型（修正為F009子功能）
 */
class UserSettingsRequest {
  final String settingType;
  final ModeSelectionData? modeSettings;

  UserSettingsRequest({
    required this.settingType,
    this.modeSettings,
  });

  Map<String, dynamic> toJson() {
    return {
      'settingType': settingType,
      'modeSettings': modeSettings?.toJson(),
    };
  }
}

/**
 * 38. 模式選擇資料模型
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 模式選擇的資料結構
 */
class ModeSelectionData {
  final String selectedMode;
  final Map<String, dynamic> deviceInfo;

  ModeSelectionData({
    required this.selectedMode,
    required this.deviceInfo,
  });

  Map<String, dynamic> toJson() {
    return {
      'selectedMode': selectedMode,
      'deviceInfo': deviceInfo,
    };
  }
}

/**
 * 39. API回應統一格式
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description API回應的統一格式定義
 */
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? error;

  ApiResponse.success(this.data) : success = true, error = null;
  ApiResponse.error(this.error) : success = false, data = null;
}

class ModeConfig {
  final String name;
  final String description;
  final IconData icon;
  final Color primaryColor;
  final Color accentColor;
  final LinearGradient background;

  ModeConfig({
    required this.name,
    required this.description,
    required this.icon,
    required this.primaryColor,
    required this.accentColor,
    required this.background,
  });
}

// ===== API服務層 =====

/**
 * 40. 歡迎頁面API服務
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 處理歡迎頁面相關的API調用，支援F004、F009端點（8701規範）
 */
class WelcomeApiService {
  final Dio _dio = Dio();

  /**
   * 41. 檢查應用程式初始化狀態
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 檢查應用程式初始化狀態（對應F004 - 8701規範）
   */
  Future<ApiResponse<Map<String, dynamic>>> checkInitialization() async {
    try {
      final deviceInfo = await _getDeviceInfo();
      
      // 修正為F004端點路徑
      final response = await _dio.delete(
        '/auth/account',
        data: {
          'action': 'check_deletion_status',
          'deviceInfo': deviceInfo,
          'accountDeletionCheck': true,
        },
      );

      if (response.statusCode == 200) {
        return ApiResponse.success(response.data);
      } else {
        return ApiResponse.error('初始化檢查失敗');
      }
    } on DioException catch (e) {
      return ApiResponse.error(_handleDioError(e));
    } catch (e) {
      return ApiResponse.error('未知錯誤: $e');
    }
  }

  /**
   * 42. 更新使用者設定
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 更新使用者設定（對應F009 - 修正為設定管理的子功能）
   */
  Future<ApiResponse<Map<String, dynamic>>> updateUserSettings(UserSettingsRequest request) async {
    try {
      // 修正為F009端點路徑
      final response = await _dio.put(
        '/app/user/settings',
        data: request.toJson(),
      );

      if (response.statusCode == 200) {
        return ApiResponse.success(response.data);
      } else {
        return ApiResponse.error('使用者設定更新失敗');
      }
    } on DioException catch (e) {
      return ApiResponse.error(_handleDioError(e));
    } catch (e) {
      return ApiResponse.error('未知錯誤: $e');
    }
  }

  /**
   * 43. 處理Dio錯誤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理Dio錯誤（8701規範詳細錯誤處理）
   */
  String _handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        return '連線逾時，請檢查網路連線';
      case DioExceptionType.sendTimeout:
        return '傳送逾時，請重試';
      case DioExceptionType.receiveTimeout:
        return '接收逾時，請重試';
      case DioExceptionType.badResponse:
        return '伺服器回應錯誤：${error.response?.statusCode}';
      case DioExceptionType.cancel:
        return '請求已取消';
      case DioExceptionType.connectionError:
        return '網路連線錯誤，請檢查網路設定';
      default:
        return '網路錯誤，請重試';
    }
  }

  /**
   * 44. 取得裝置資訊
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 收集裝置資訊用於API調用
   */
  Future<Map<String, dynamic>> _getDeviceInfo() async {
    final deviceInfo = DeviceInfoPlugin();
    Map<String, dynamic> info = {};

    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      info = {
        'platform': 'android',
        'version': androidInfo.version.release,
        'deviceId': androidInfo.id,
        'model': androidInfo.model,
        'manufacturer': androidInfo.manufacturer,
      };
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      info = {
        'platform': 'ios',
        'version': iosInfo.systemVersion,
        'deviceId': iosInfo.identifierForVendor ?? 'unknown',
        'model': iosInfo.model,
        'name': iosInfo.name,
      };
    }

    return info;
  }
}

// ===== 狀態管理層 =====

/**
 * 45. 歡迎頁面狀態管理器
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 管理歡迎頁面的狀態，支援8701規範的完整功能流程
 */
class WelcomeProvider extends ChangeNotifier {
  // 狀態屬性
  WelcomePageState _pageState = WelcomePageState.loading;
  UserMode? _selectedMode;
  bool _isLoading = false;
  String? _errorMessage;
  WelcomeErrorType? _errorType;
  bool _isFirstLaunch = true;
  bool _isUserAuthenticated = false;
  
  final WelcomeApiService _apiService = WelcomeApiService();

  // Getters
  WelcomePageState get pageState => _pageState;
  UserMode? get selectedMode => _selectedMode;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  WelcomeErrorType? get errorType => _errorType;
  bool get isFirstLaunch => _isFirstLaunch;
  bool get isUserAuthenticated => _isUserAuthenticated;

  /**
   * 46. 初始化頁面
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 支援首次啟動與再次啟動流程（8701規範）
   */
  Future<void> initializePage() async {
    _setLoading(true);
    _setPageState(WelcomePageState.loading);

    try {
      // 檢查帳號刪除狀態
      await _checkAccountDeletionStatus();
      
      // 檢查是否為首次啟動
      final prefs = await SharedPreferences.getInstance();
      _isFirstLaunch = !prefs.containsKey('user_initialized');
      _isUserAuthenticated = prefs.getBool('user_authenticated') ?? false;

      if (_isFirstLaunch) {
        await _handleFirstLaunchFlow();
      } else {
        await _handleReturnUserFlow();
      }
    } catch (e) {
      _setError('初始化失敗', WelcomeErrorType.initialization, e);
    } finally {
      _setLoading(false);
    }
  }

  /**
   * 47. 處理首次啟動流程
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理首次啟動流程（8701規範）
   */
  Future<void> _handleFirstLaunchFlow() async {
    _setPageState(WelcomePageState.modeSelection);
  }

  /**
   * 48. 處理再次啟動流程
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理再次啟動流程（8701規範）
   */
  Future<void> _handleReturnUserFlow() async {
    if (_isUserAuthenticated) {
      // 已登入用戶直接導向首頁
      _setPageState(WelcomePageState.loginRedirect);
      await Future.delayed(const Duration(seconds: 1));
      NavigationService.router.go('/home');
    } else {
      // 未登入用戶顯示模式選擇
      _setPageState(WelcomePageState.modeSelection);
    }
  }

  /**
   * 49. 檢查帳號刪除狀態
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 檢查帳號刪除狀態（8701規範 - F004端點）
   */
  Future<void> _checkAccountDeletionStatus() async {
    final response = await _apiService.checkInitialization();
    
    if (response.success && response.data != null) {
      final data = response.data!;
      
      if (data['accountDeletionRequired'] == true) {
        _setError(
          '您的帳號正在刪除處理中，請稍後再試',
          WelcomeErrorType.accountDeletion,
          data['deletionPendingInfo']
        );
        return;
      }
      
      _isFirstLaunch = data['isFirstLaunch'] ?? true;
      _isUserAuthenticated = data['userAuthenticated'] ?? false;
    }
  }

  /**
   * 50. 選擇模式
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理使用者模式選擇
   */
  void selectMode(UserMode mode) {
    _selectedMode = mode;
    notifyListeners();
  }

  /**
   * 51. 開始使用應用程式
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 模式設定與導航（8701規範）
   */
  Future<void> startApp() async {
    if (_selectedMode == null) {
      _setError('請選擇一個使用模式', WelcomeErrorType.validation, null);
      return;
    }

    _setLoading(true);

    try {
      await _setUserMode(_selectedMode!);
      
      // 標記為已初始化
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('user_initialized', true);
      
      // 導向登入頁面
      NavigationService.router.go('/login');
    } catch (e) {
      _setError('啟動應用程式失敗', WelcomeErrorType.modeSelection, e);
    } finally {
      _setLoading(false);
    }
  }

  /**
   * 52. 設定使用者模式
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 設定使用者模式（修正為F009子功能）
   */
  Future<void> _setUserMode(UserMode mode) async {
    final deviceInfo = await _getDeviceInfo();
    
    final request = UserSettingsRequest(
      settingType: 'mode_selection',
      modeSettings: ModeSelectionData(
        selectedMode: mode.toString().split('.').last,
        deviceInfo: deviceInfo,
      ),
    );

    final response = await _apiService.updateUserSettings(request);
    
    if (!response.success) {
      throw Exception(response.error ?? '模式設定失敗');
    }

    // 本地保存模式選擇
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_mode', mode.toString().split('.').last);
  }

  /**
   * 53. 取得裝置資訊
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 收集裝置相關資訊用於API調用
   */
  Future<Map<String, dynamic>> _getDeviceInfo() async {
    return await _apiService._getDeviceInfo();
  }

  /**
   * 54. 設定載入狀態
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 更新載入狀態並通知監聽者
   */
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /**
   * 55. 設定頁面狀態
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 更新頁面狀態並通知監聽者
   */
  void _setPageState(WelcomePageState state) {
    _pageState = state;
    notifyListeners();
  }

  /**
   * 56. 設定錯誤訊息
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 設定錯誤訊息（8701規範 - 詳細錯誤處理）
   */
  void _setError(String message, WelcomeErrorType type, dynamic error) {
    _errorMessage = message;
    _errorType = type;
    _pageState = WelcomePageState.error;
    notifyListeners();
  }

  /**
   * 57. 清除錯誤狀態
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 清除錯誤狀態並決定後續動作
   */
  void clearError() {
    _errorMessage = null;
    _errorType = null;
    _setPageState(WelcomePageState.modeSelection);
  }

  /**
   * 58. 重試操作
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 根據錯誤類型執行相對應的重試操作
   */
  Future<void> retryOperation() async {
    switch (_errorType) {
      case WelcomeErrorType.initialization:
        await initializePage();
        break;
      case WelcomeErrorType.modeSelection:
        if (_selectedMode != null) {
          await startApp();
        }
        break;
      case WelcomeErrorType.networkConnection:
        await initializePage();
        break;
      default:
        clearError();
        break;
    }
  }
}

// ===== 響應式設計輔助類 =====

/**
 * 59. 響應式設計輔助工具
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 遵循9005文件的響應式設計規範，提供完整的斷點管理
 */
class ResponsiveHelper {
  final BuildContext context;
  late final MediaQueryData _mediaQuery;
  late final Size _screenSize;

  ResponsiveHelper.of(this.context) {
    _mediaQuery = MediaQuery.of(context);
    _screenSize = _mediaQuery.size;
  }

  // 斷點判斷屬性（9005規範）
  bool get isMobile => _screenSize.width <= Breakpoints.mobileMax;
  bool get isTablet => _screenSize.width > Breakpoints.tabletMin && 
                      _screenSize.width <= Breakpoints.tabletMax;
  bool get isSmallDesktop => _screenSize.width > Breakpoints.smallDesktopMin && 
                            _screenSize.width <= Breakpoints.smallDesktopMax;
  bool get isLargeDesktop => _screenSize.width >= Breakpoints.largeDesktopMin;
  
  DeviceType get deviceType => Breakpoints.getDeviceType(_screenSize.width);

  // 尺寸相關屬性（9005規範）
  double get horizontalPadding {
    if (isMobile) return 16.0;
    if (isTablet) return 24.0;
    if (isSmallDesktop) return 32.0;
    return 48.0;
  }

  double get verticalPadding {
    if (isMobile) return 16.0;
    if (isTablet) return 24.0;
    return 32.0;
  }

  int get modeGridCrossAxisCount {
    if (isMobile) return 2;
    if (isTablet) return 2;
    if (isSmallDesktop) return 4;
    return 4;
  }

  double get modeCardHeight {
    if (isMobile) return 120.0;
    if (isTablet) return 140.0;
    return 160.0;
  }

  double get buttonHeight {
    if (isMobile) return 48.0;
    if (isTablet) return 52.0;
    return 56.0;
  }

  double get fontSizeScale {
    if (isMobile) return 1.0;
    if (isTablet) return 1.1;
    return 1.2;
  }
}

/**
 * 60. 響應式斷點常數
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 響應式斷點常數（9005規範）
 */
class Breakpoints {
  static const double mobileMax = 480;
  static const double tabletMin = 481;
  static const double tabletMax = 768;
  static const double smallDesktopMin = 769;
  static const double smallDesktopMax = 1024;
  static const double largeDesktopMin = 1025;

  /**
   * 61. 取得目前裝置類型
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 根據螢幕寬度判斷裝置類型
   */
  static DeviceType getDeviceType(double width) {
    if (width <= mobileMax) return DeviceType.mobile;
    if (width <= tabletMax) return DeviceType.tablet;
    if (width <= smallDesktopMax) return DeviceType.smallDesktop;
    return DeviceType.largeDesktop;
  }
}

// ===== 導航服務 =====

/**
 * 62. 導航服務
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 處理應用程式內的導航邏輯
 */
class NavigationService {
  static late final GoRouter router;

  static void initialize() {
    router = GoRouter(
      initialLocation: '/welcome',
      routes: [
        GoRoute(
          path: '/welcome',
          builder: (context, state) => const WelcomePage(),
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => Container(), // 實際登入頁面
        ),
        GoRoute(
          path: '/register',
          builder: (context, state) => Container(), // 實際註冊頁面
        ),
        GoRoute(
          path: '/home',
          builder: (context, state) => Container(), // 實際首頁
        ),
      ],
    );
  }

  /**
   * 63. 導航到登入頁面
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 導航到登入頁面並替換當前頁面
   */
  static Future<void> navigateToLogin() async {
    router.go('/login');
  }

  /**
   * 64. 導航到註冊頁面
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 導航到註冊頁面並替換當前頁面
   */
  static Future<void> navigateToRegister() async {
    router.go('/register');
  }

  /**
   * 65. 導航到首頁
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 導航到首頁並替換當前頁面
   */
  static Future<void> navigateToHome() async {
    router.go('/home');
  }

  /**
   * 66. 返回上一頁
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 返回到上一個頁面
   */
  static void goBack() {
    router.pop();
  }
}

// ===== 無障礙功能支援 =====

/**
 * 67. 無障礙語意化Widget包裝器
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 提供WCAG 2.1 AA標準的完整無障礙支援（9005規範）
 */
class AccessibilityWrapper {
  
  /**
   * 68. 為模式卡片提供語意化標籤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 為模式選擇卡片添加適當的語意化標籤
   */
  static Widget wrapModeCard(Widget child, UserMode mode, bool isSelected) {
    final modeNames = {
      UserMode.controller: '精準控制者',
      UserMode.logger: '紀錄習慣者',
      UserMode.struggler: '轉型挑戰者',
      UserMode.sleeper: '潛在覺醒者',
    };

    return Semantics(
      button: true,
      selected: isSelected,
      label: '模式選擇：${modeNames[mode]}',
      hint: isSelected ? '已選擇此模式' : '點擊選擇此模式',
      child: child,
    );
  }

  /**
   * 69. 為品牌Logo提供語意化標籤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 為品牌Logo添加適當的語意化標籤
   */
  static Widget wrapBrandLogo(Widget child) {
    return Semantics(
      image: true,
      label: 'LCAS 2.0 應用程式標誌',
      child: child,
    );
  }

  /**
   * 70. 為開始按鈕提供語意化標籤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 為開始使用按鈕添加適當的語意化標籤
   */
  static Widget wrapStartButton(Widget child, {required bool enabled, UserMode? selectedMode}) {
    String hint = enabled ? '點擊開始使用應用程式' : '請先選擇使用模式';
    if (selectedMode != null) {
      final modeNames = {
        UserMode.controller: '精準控制者',
        UserMode.logger: '紀錄習慣者',
        UserMode.struggler: '轉型挑戰者',
        UserMode.sleeper: '潛在覺醒者',
      };
      hint += '，目前選擇：${modeNames[selectedMode]}';
    }

    return Semantics(
      button: true,
      enabled: enabled,
      label: '開始使用',
      hint: hint,
      child: child,
    );
  }

  /**
   * 71. 為載入指示器提供語意化標籤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 為載入指示器添加適當的語意化標籤
   */
  static Widget wrapLoadingIndicator(Widget child, String? loadingMessage) {
    return Semantics(
      label: '載入中',
      hint: loadingMessage ?? '請稍候，正在處理您的請求',
      child: child,
    );
  }

  /**
   * 72. 為錯誤對話框提供語意化標籤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 為錯誤對話框添加適當的語意化標籤
   */
  static Widget wrapErrorDialog(Widget child, String errorMessage, WelcomeErrorType errorType) {
    return Semantics(
      dialog: true,
      label: '錯誤訊息',
      hint: errorMessage,
      child: child,
    );
  }
}

/**
 * 73. 高對比度主題支援
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 高對比度主題支援（WCAG 2.1 AA標準）
 */
class HighContrastTheme {
  
  /**
   * 74. 檢查是否啟用高對比度模式
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 檢查系統是否啟用高對比度模式
   */
  static bool isHighContrastEnabled(BuildContext context) {
    return MediaQuery.of(context).highContrast;
  }

  /**
   * 75. 檢查是否啟用大字型模式
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 檢查系統是否啟用大字型模式
   */
  static bool isLargeTextEnabled(BuildContext context) {
    return MediaQuery.of(context).textScaleFactor > 1.3;
  }

  /**
   * 76. 檢查是否啟用動畫減少模式
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 檢查系統是否啟用動畫減少模式
   */
  static bool isReduceMotionEnabled(BuildContext context) {
    return MediaQuery.of(context).disableAnimations;
  }

  /**
   * 77. 取得高對比度文字色彩
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 取得高對比度文字色彩（對比度至少4.5:1）
   */
  static Color getContrastTextColor(BuildContext context, Color backgroundColor) {
    if (isHighContrastEnabled(context)) {
      // 計算背景亮度
      final luminance = backgroundColor.computeLuminance();
      return luminance > 0.5 ? Colors.black : Colors.white;
    }
    return Colors.white;
  }

  /**
   * 78. 取得高對比度按鈕色彩
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 取得適合高對比度模式的按鈕色彩
   */
  static Color getContrastButtonColor(BuildContext context, Color normalColor) {
    if (isHighContrastEnabled(context)) {
      return Theme.of(context).brightness == Brightness.dark 
          ? Colors.white 
          : Colors.black;
    }
    return normalColor;
  }

  /**
   * 79. 取得高對比度邊框色彩
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 取得適合高對比度模式的邊框色彩
   */
  static Color getContrastBorderColor(BuildContext context) {
    if (isHighContrastEnabled(context)) {
      return Theme.of(context).brightness == Brightness.dark 
          ? Colors.white 
          : Colors.black;
    }
    return Colors.white.withOpacity(0.3);
  }

  /**
   * 80. 取得適配的字型大小
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 根據系統字型縮放比例調整字型大小
   */
  static double getScaledFontSize(BuildContext context, double baseFontSize) {
    final textScaleFactor = MediaQuery.of(context).textScaleFactor;
    return baseFontSize * textScaleFactor;
  }

  /**
   * 81. 取得適配的動畫時長
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 根據系統動畫偏好調整動畫時長
   */
  static Duration getScaledAnimationDuration(BuildContext context, Duration baseDuration) {
    if (isReduceMotionEnabled(context)) {
      return Duration.zero;
    }
    return baseDuration;
  }
}

/**
 * 82. 觸控目標大小輔助工具
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 觸控目標大小輔助工具（WCAG 2.1 AA標準）
 */
class TouchTargetHelper {
  static const double minTouchTargetSize = 44.0;
  
  /**
   * 83. 確保Widget符合最小觸控目標大小
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 確保Widget符合WCAG最小觸控目標大小
   */
  static Widget ensureMinTouchTarget(Widget child, {double? width, double? height}) {
    return Container(
      constraints: BoxConstraints(
        minWidth: width ?? minTouchTargetSize,
        minHeight: height ?? minTouchTargetSize,
      ),
      child: child,
    );
  }

  /**
   * 84. 為小於標準的按鈕增加透明觸控區域
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 為小於標準的按鈕增加透明觸控區域
   */
  static Widget expandTouchTarget(Widget child, {required double currentWidth, required double currentHeight}) {
    final needsExpansion = currentWidth < minTouchTargetSize || currentHeight < minTouchTargetSize;
    
    if (!needsExpansion) return child;
    
    return Container(
      width: math.max(currentWidth, minTouchTargetSize),
      height: math.max(currentHeight, minTouchTargetSize),
      alignment: Alignment.center,
      child: child,
    );
  }
}

// ===== 效能最佳化 =====

/**
 * 85. Widget快取管理器
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 優化Widget重建效能，減少不必要的重建
 */
class WidgetCache {
  static final Map<String, Widget> _cache = {};
  static final Map<String, DateTime> _cacheTimestamps = {};
  static const Duration _cacheValidDuration = Duration(minutes: 5);

  /**
   * 86. 取得快取的Widget或建立新的
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 從快取中獲取Widget或創建新的
   */
  static Widget getOrCreate(String key, Widget Function() creator) {
    // 檢查快取是否存在且有效
    if (_cache.containsKey(key) && _cacheTimestamps.containsKey(key)) {
      final timestamp = _cacheTimestamps[key]!;
      if (DateTime.now().difference(timestamp) < _cacheValidDuration) {
        return _cache[key]!;
      }
    }

    // 創建新的Widget並快取
    final widget = creator();
    _cache[key] = widget;
    _cacheTimestamps[key] = DateTime.now();

    return widget;
  }

  /**
   * 87. 清除過期快取
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 清除已過期的Widget快取
   */
  static void clearExpiredCache() {
    final now = DateTime.now();
    final keysToRemove = <String>[];

    for (final entry in _cacheTimestamps.entries) {
      if (now.difference(entry.value) >= _cacheValidDuration) {
        keysToRemove.add(entry.key);
      }
    }

    for (final key in keysToRemove) {
      _cache.remove(key);
      _cacheTimestamps.remove(key);
    }
  }

  /**
   * 88. 清除所有快取
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 清除所有Widget快取
   */
  static void clearAllCache() {
    _cache.clear();
    _cacheTimestamps.clear();
  }

  /**
   * 89. 取得快取統計資訊
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 獲取快取使用統計資訊
   */
  static Map<String, dynamic> getCacheStats() {
    return {
      'totalCached': _cache.length,
      'validEntries': _cacheTimestamps.values
          .where((timestamp) => DateTime.now().difference(timestamp) < _cacheValidDuration)
          .length,
      'expiredEntries': _cacheTimestamps.values
          .where((timestamp) => DateTime.now().difference(timestamp) >= _cacheValidDuration)
          .length,
    };
  }
}

/**
 * 90. 圖片預載入管理器
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 管理圖片資源的預載入
 */
class ImagePreloader {
  static final Set<String> _preloadedImages = {};
  static final Map<String, Completer<void>> _loadingImages = {};

  /**
   * 91. 預載入品牌相關圖片資源
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 預載入品牌相關的圖片資源
   */
  static Future<void> preloadBrandAssets(BuildContext context) async {
    final assets = [
      'assets/images/logo.png',
      'assets/images/controller_icon.png',
      'assets/images/logger_icon.png',
      'assets/images/struggler_icon.png',
      'assets/images/sleeper_icon.png',
    ];

    final futures = assets.map((asset) => _preloadSingleImage(context, asset));
    await Future.wait(futures);
  }

  /**
   * 92. 預載入單一圖片
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 預載入指定的單一圖片
   */
  static Future<void> _preloadSingleImage(BuildContext context, String asset) async {
    if (_preloadedImages.contains(asset)) return;

    if (_loadingImages.containsKey(asset)) {
      await _loadingImages[asset]!.future;
      return;
    }

    final completer = Completer<void>();
    _loadingImages[asset] = completer;

    try {
      await precacheImage(AssetImage(asset), context);
      _preloadedImages.add(asset);
      completer.complete();
    } catch (e) {
      completer.completeError(e);
    } finally {
      _loadingImages.remove(asset);
    }
  }

  /**
   * 93. 檢查圖片是否已預載入
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 檢查指定圖片是否已完成預載入
   */
  static bool isImagePreloaded(String asset) {
    return _preloadedImages.contains(asset);
  }

  /**
   * 94. 清除預載入記錄
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 清除圖片預載入的記錄
   */
  static void clearPreloadedImages() {
    _preloadedImages.clear();
    _loadingImages.clear();
  }
}

/**
 * 95. 記憶體使用監控
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 監控應用程式記憶體使用情況
 */
class MemoryMonitor {
  static Timer? _monitorTimer;
  static final List<int> _memoryUsageHistory = [];
  static const int _maxHistoryLength = 60;
  static const int _warningThresholdMB = 150;
  static const int _criticalThresholdMB = 200;

  /**
   * 96. 開始記憶體監控
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 開始定期監控記憶體使用量
   */
  static void startMonitoring() {
    _monitorTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _checkMemoryUsage();
    });
  }

  /**
   * 97. 停止記憶體監控
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 停止記憶體使用量監控
   */
  static void stopMonitoring() {
    _monitorTimer?.cancel();
    _monitorTimer = null;
  }

  /**
   * 98. 檢查記憶體使用狀況
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 檢查當前記憶體使用狀況並採取相應措施
   */
  static void _checkMemoryUsage() {
    final currentUsage = _getCurrentMemoryUsageMB();
    
    // 記錄歷史
    _memoryUsageHistory.add(currentUsage);
    if (_memoryUsageHistory.length > _maxHistoryLength) {
      _memoryUsageHistory.removeAt(0);
    }

    // 檢查閾值
    if (currentUsage > _criticalThresholdMB) {
      _performEmergencyCleanup();
    } else if (currentUsage > _warningThresholdMB) {
      _performRegularCleanup();
    }
  }

  /**
   * 99. 取得目前記憶體使用量
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 獲取當前記憶體使用量（MB）
   */
  static int _getCurrentMemoryUsageMB() {
    // 這是一個模擬實作，實際應用中需要使用平台特定的API
    return 50 + (DateTime.now().millisecondsSinceEpoch % 100);
  }

  /**
   * 100. 執行一般清理
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 執行一般性的記憶體清理
   */
  static void _performRegularCleanup() {
    WidgetCache.clearExpiredCache();
  }

  /**
   * 101. 執行緊急清理
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 執行緊急記憶體清理
   */
  static void _performEmergencyCleanup() {
    WidgetCache.clearAllCache();
    ImagePreloader.clearPreloadedImages();
  }

  /**
   * 102. 取得記憶體使用統計
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 獲取記憶體使用統計資訊
   */
  static Map<String, dynamic> getMemoryStats() {
    if (_memoryUsageHistory.isEmpty) return {};

    final currentUsage = _memoryUsageHistory.last;
    final averageUsage = _memoryUsageHistory.reduce((a, b) => a + b) / _memoryUsageHistory.length;
    final maxUsage = _memoryUsageHistory.reduce(math.max);

    return {
      'currentUsageMB': currentUsage,
      'averageUsageMB': averageUsage.round(),
      'maxUsageMB': maxUsage,
      'historyLength': _memoryUsageHistory.length,
    };
  }
}

// ===== 錯誤處理機制 =====

/**
 * 103. 歡迎頁面錯誤處理器
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 根據8701規範的具體錯誤情境進行詳細處理
 */
class WelcomeErrorHandler {
  
  /**
   * 104. 處理初始化錯誤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理初始化錯誤（8701規範）
   */
  static String handleInitializationError(dynamic error) {
    if (error is DioException) {
      return _handleNetworkError(error);
    }
    return '應用程式啟動異常，請重啟應用程式';
  }

  /**
   * 105. 處理模式選擇錯誤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理模式選擇錯誤（8701規範）
   */
  static String handleModeSelectionError(dynamic error) {
    if (error is DioException) {
      return _handleNetworkError(error);
    }
    return '模式設定失敗，請重試';
  }

  /**
   * 106. 處理網路錯誤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理網路錯誤（8701規範）
   */
  static String _handleNetworkError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return '網路連線不穩定，請檢查網路設定';
      case DioExceptionType.badResponse:
        return _handleHttpStatusError(error.response?.statusCode);
      case DioExceptionType.connectionError:
        return '網路連線失敗，請檢查網路設定';
      default:
        return '網路錯誤，請重試';
    }
  }

  /**
   * 107. 處理HTTP狀態碼錯誤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理HTTP狀態碼錯誤（8701規範）
   */
  static String _handleHttpStatusError(int? statusCode) {
    switch (statusCode) {
      case 400:
        return '請求格式錯誤，請重試';
      case 401:
        return '身份驗證失敗，請重新登入';
      case 403:
        return '權限不足，請聯絡系統管理員';
      case 404:
        return '服務暫時無法使用，請稍後重試';
      case 500:
        return '伺服器錯誤，請稍後重試';
      case 503:
        return '服務暫時無法使用，請稍後重試';
      default:
        return '伺服器回應錯誤，請重試';
    }
  }

  /**
   * 處理帳號刪除相關錯誤
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 處理帳號刪除相關錯誤（8701規範）
   */
  static String handleAccountDeletionError(Map<String, dynamic>? deletionInfo) {
    if (deletionInfo == null) {
      return '帳號刪除檢查失敗';
    }
    
    final status = deletionInfo['status'] as String?;
    switch (status) {
      case 'pending':
        return '您的帳號正在刪除處理中，預計需要 ${deletionInfo['estimatedDays']} 天完成';
      case 'processing':
        return '帳號刪除正在處理中，請稍後再試';
      default:
        return '帳號刪除狀態異常，請聯絡客服';
    }
  }
}

// ===== 主要Widget實作 =====

/**
 * 01. 主頁面容器Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 歡迎頁面的主容器，支援首次啟動與再次啟動流程
 */
class WelcomePage extends StatefulWidget {
  static const String routeName = '/welcome';
  
  const WelcomePage({Key? key}) : super(key: key);
  
  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

/**
 * 02. 歡迎頁面狀態類別
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 管理歡迎頁面的狀態和動畫控制器
 */
class _WelcomePageState extends State<WelcomePage> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  
  @override
  void initState() {
    super.initState();
    _initializeAnimations();
    _initializePage();
    MemoryMonitor.startMonitoring();
  }

  /**
   * 03. 初始化動畫控制器
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 設定頁面淡入動畫效果
   */
  void _initializeAnimations() {
    _animationController = AnimationController(
      duration: HighContrastTheme.getScaledAnimationDuration(
        context,
        const Duration(milliseconds: 1000),
      ),
      vsync: this,
    );
    
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
    
    _animationController.forward();
  }

  /**
   * 04. 初始化頁面狀態
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 調用Provider進行頁面初始化
   */
  Future<void> _initializePage() async {
    final provider = Provider.of<WelcomeProvider>(context, listen: false);
    await ImagePreloader.preloadBrandAssets(context);
    await provider.initializePage();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => WelcomeProvider(),
      child: Consumer<WelcomeProvider>(
        builder: (context, provider, child) {
          return WelcomeScaffold(
            fadeAnimation: _fadeAnimation,
            provider: provider,
          );
        },
      ),
    );
  }
  
  @override
  void dispose() {
    _animationController.dispose();
    MemoryMonitor.stopMonitoring();
    super.dispose();
  }
}

/**
 * 05. 頁面佈局結構Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 提供歡迎頁面的基礎佈局結構，遵循9005文件響應式設計規範
 */
class WelcomeScaffold extends StatelessWidget {
  final Animation<double> fadeAnimation;
  final WelcomeProvider provider;
  
  const WelcomeScaffold({
    Key? key,
    required this.fadeAnimation,
    required this.provider,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveHelper.of(context);
    
    return Scaffold(
      body: Stack(
        children: [
          GradientBackground(mode: provider.selectedMode),
          SafeArea(
            child: FadeTransition(
              opacity: fadeAnimation,
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: responsive.horizontalPadding,
                  vertical: responsive.verticalPadding,
                ),
                child: _buildContent(context, provider, responsive),
              ),
            ),
          ),
          if (provider.pageState == WelcomePageState.error)
            _buildErrorOverlay(context, provider),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context, WelcomeProvider provider, ResponsiveHelper responsive) {
    switch (provider.pageState) {
      case WelcomePageState.loading:
        return const Center(child: LoadingIndicator());
      
      case WelcomePageState.modeSelection:
        return Column(
          children: [
            const Expanded(child: BrandSection()),
            Expanded(
              flex: 2,
              child: ModeSelectionSection(provider: provider),
            ),
            NavigationSection(provider: provider),
          ],
        );
      
      case WelcomePageState.loginRedirect:
        return const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              LoadingIndicator(message: '正在跳轉到首頁...'),
              SizedBox(height: 24),
              Text(
                '歡迎回來！',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        );
      
      case WelcomePageState.error:
        return const SizedBox.shrink(); // 錯誤由覆蓋層顯示
    }
  }

  /**
   * 06. 建立錯誤覆蓋層
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 顯示錯誤對話框的覆蓋層
   */
  Widget _buildErrorOverlay(BuildContext context, WelcomeProvider provider) {
    return Container(
      color: Colors.black54,
      child: Center(
        child: ErrorDialog(
          message: provider.errorMessage ?? '發生未知錯誤',
          onRetry: provider.errorType != null && 
                  WelcomeErrorHandler._shouldShowRetryButton(provider.errorType!) 
                  ? provider.retryOperation 
                  : null,
          onDismiss: provider.clearError,
        ),
      ),
    );
  }
}

/**
 * 07. 品牌展示區塊Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 顯示品牌Logo和標題，支援動畫效果
 */
class BrandSection extends StatelessWidget {
  const BrandSection({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return WidgetCache.getOrCreate('brand_section', () {
      return const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          BrandLogo(),
          SizedBox(height: 24),
          BrandTitle(),
        ],
      );
    });
  }
}

/**
 * 08. 模式選擇區塊Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 四模式選擇介面，支援精準控制者/紀錄習慣者/轉型挑戰者/潛在覺醒者
 */
class ModeSelectionSection extends StatelessWidget {
  final WelcomeProvider provider;
  
  const ModeSelectionSection({
    Key? key,
    required this.provider,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '選擇您的使用模式',
          style: TextStyle(
            fontSize: HighContrastTheme.getScaledFontSize(context, 20),
            fontWeight: FontWeight.w600,
            color: HighContrastTheme.getContrastTextColor(context, Colors.transparent),
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        Expanded(
          child: ModeGrid(
            selectedMode: provider.selectedMode,
            onModeSelected: provider.selectMode,
          ),
        ),
      ],
    );
  }
}

/**
 * 09. 導航操作區塊Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 顯示開始使用按鈕和導航控制
 */
class NavigationSection extends StatelessWidget {
  final WelcomeProvider provider;
  
  const NavigationSection({Key? key, required this.provider}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveHelper.of(context);
    
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: AccessibilityWrapper.wrapStartButton(
        ActionButton(
          text: '開始使用',
          onPressed: provider.selectedMode != null ? provider.startApp : null,
          isLoading: provider.isLoading,
        ),
        enabled: provider.selectedMode != null,
        selectedMode: provider.selectedMode,
      ),
    );
  }
}

/**
 * 10. 品牌Logo Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 顯示應用程式品牌標誌，支援響應式尺寸
 */
class BrandLogo extends StatelessWidget {
  final double? size;
  
  const BrandLogo({Key? key, this.size}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveHelper.of(context);
    final logoSize = size ?? (responsive.isMobile ? 100.0 : 120.0);
    
    return AccessibilityWrapper.wrapBrandLogo(
      Container(
        width: logoSize,
        height: logoSize,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withOpacity(0.1),
          border: Border.all(
            color: HighContrastTheme.getContrastBorderColor(context),
            width: 2,
          ),
        ),
        child: Icon(
          Icons.account_balance_wallet,
          size: logoSize * 0.6,
          color: HighContrastTheme.getContrastTextColor(context, Colors.transparent),
        ),
      ),
    );
  }
}

/**
 * 11. 品牌標題Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 顯示品牌標題和副標題文字
 */
class BrandTitle extends StatelessWidget {
  const BrandTitle({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          'LCAS 2.0',
          style: TextStyle(
            fontSize: HighContrastTheme.getScaledFontSize(context, 32),
            fontWeight: FontWeight.bold,
            color: HighContrastTheme.getContrastTextColor(context, Colors.transparent),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '智慧記帳，輕鬆生活',
          style: TextStyle(
            fontSize: HighContrastTheme.getScaledFontSize(context, 16),
            color: HighContrastTheme.getContrastTextColor(context, Colors.transparent)
                .withOpacity(0.8),
          ),
        ),
      ],
    );
  }
}

/**
 * 12. 模式網格Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 管理四個模式卡片的網格佈局
 */
class ModeGrid extends StatelessWidget {
  final UserMode? selectedMode;
  final Function(UserMode) onModeSelected;
  
  const ModeGrid({
    Key? key,
    this.selectedMode,
    required this.onModeSelected,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveHelper.of(context);
    
    return GridView.count(
      crossAxisCount: responsive.modeGridCrossAxisCount,
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      childAspectRatio: responsive.isMobile ? 1.0 : 1.2,
      children: UserMode.values.map((mode) {
        return ModeCard(
          mode: mode,
          isSelected: selectedMode == mode,
          onTap: () => onModeSelected(mode),
        );
      }).toList(),
    );
  }
}

/**
 * 13. 模式選擇卡片Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 單一模式選擇卡片，遵循0015文件四模式命名與9005色彩規範
 */
class ModeCard extends StatefulWidget {
  final UserMode mode;
  final bool isSelected;
  final VoidCallback onTap;
  
  const ModeCard({
    Key? key,
    required this.mode,
    required this.isSelected,
    required this.onTap,
  }) : super(key: key);

  @override
  State<ModeCard> createState() => _ModeCardState();
}

class _ModeCardState extends State<ModeCard> with SingleTickerProviderStateMixin {
  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;
  
  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: HighContrastTheme.getScaledAnimationDuration(
        context,
        const Duration(milliseconds: 200),
      ),
      vsync: this,
    );
    
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 1.05,
    ).animate(CurvedAnimation(
      parent: _scaleController,
      curve: Curves.easeInOut,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final config = _getModeConfig(widget.mode);
    final isHighContrast = HighContrastTheme.isHighContrastEnabled(context);
    
    if (widget.isSelected) {
      _scaleController.forward();
    } else {
      _scaleController.reverse();
    }

    return AccessibilityWrapper.wrapModeCard(
      TouchTargetHelper.ensureMinTouchTarget(
        ScaleTransition(
          scale: _scaleAnimation,
          child: InkWell(
            onTap: widget.onTap,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: widget.isSelected 
                    ? (isHighContrast ? Colors.white.withOpacity(0.3) : Colors.white.withOpacity(0.2))
                    : (isHighContrast ? Colors.white.withOpacity(0.1) : Colors.white.withOpacity(0.1)),
                border: Border.all(
                  color: widget.isSelected 
                      ? HighContrastTheme.getContrastBorderColor(context)
                      : Colors.transparent,
                  width: widget.isSelected ? 2 : 1,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      config.icon,
                      size: 32,
                      color: widget.isSelected 
                          ? HighContrastTheme.getContrastTextColor(context, config.primaryColor)
                          : HighContrastTheme.getContrastTextColor(context, Colors.transparent).withOpacity(0.8),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      config.name,
                      style: TextStyle(
                        fontSize: HighContrastTheme.getScaledFontSize(context, 14),
                        fontWeight: widget.isSelected ? FontWeight.w600 : FontWeight.w500,
                        color: widget.isSelected 
                            ? HighContrastTheme.getContrastTextColor(context, config.primaryColor)
                            : HighContrastTheme.getContrastTextColor(context, Colors.transparent),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      config.description,
                      style: TextStyle(
                        fontSize: HighContrastTheme.getScaledFontSize(context, 12),
                        color: HighContrastTheme.getContrastTextColor(context, Colors.transparent).withOpacity(0.8),
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
      widget.mode,
      widget.isSelected,
    );
  }

  /**
   * 14. 取得模式配置資料
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 根據模式類型返回對應的顯示配置
   */
  ModeConfig _getModeConfig(UserMode mode) {
    switch (mode) {
      case UserMode.controller:
        return ModeConfig(
          name: '精準控制者',
          description: '專業深度分析',
          icon: Icons.analytics,
          primaryColor: const Color(0xFF1565C0),
          accentColor: const Color(0xFF42A5F5),
          background: const LinearGradient(
            colors: [Color(0xFF1565C0), Color(0xFF1976D2)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        );
      case UserMode.logger:
        return ModeConfig(
          name: '紀錄習慣者',
          description: '美感優雅體驗',
          icon: Icons.edit_note,
          primaryColor: const Color(0xFF7B1FA2),
          accentColor: const Color(0xFFBA68C8),
          background: const LinearGradient(
            colors: [Color(0xFF7B1FA2), Color(0xFF8E24AA)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        );
      case UserMode.struggler:
        return ModeConfig(
          name: '轉型挑戰者',
          description: '習慣養成目標',
          icon: Icons.trending_up,
          primaryColor: const Color(0xFFE65100),
          accentColor: const Color(0xFFFF9800),
          background: const LinearGradient(
            colors: [Color(0xFFE65100), Color(0xFFEF6C00)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        );
      case UserMode.sleeper:
        return ModeConfig(
          name: '潛在覺醒者',
          description: '簡單輕鬆開始',
          icon: Icons.eco,
          primaryColor: const Color(0xFF2E7D32),
          accentColor: const Color(0xFF66BB6A),
          background: const LinearGradient(
            colors: [Color(0xFF2E7D32), Color(0xFF388E3C)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        );
    }
  }

  @override
  void dispose() {
    _scaleController.dispose();
    super.dispose();
  }
}

/**
 * 15. 主要操作按鈕Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 開始使用的主要操作按鈕
 */
class ActionButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  
  const ActionButton({
    Key? key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final responsive = ResponsiveHelper.of(context);
    
    return SizedBox(
      width: double.infinity,
      height: responsive.buttonHeight,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: HighContrastTheme.getContrastButtonColor(
            context, 
            Colors.white,
          ),
          foregroundColor: HighContrastTheme.getContrastTextColor(context, Colors.white),
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: isLoading
            ? SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: HighContrastTheme.getContrastTextColor(context, Colors.white),
                ),
              )
            : Text(
                text,
                style: TextStyle(
                  fontSize: HighContrastTheme.getScaledFontSize(context, 16),
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
    );
  }
}

/**
 * 16. 漸層背景Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 根據9005規範的四模式差異化背景
 */
class GradientBackground extends StatelessWidget {
  final UserMode? mode;
  
  const GradientBackground({Key? key, this.mode}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: _getGradientForMode(mode),
      ),
    );
  }

  /**
   * 17. 取得模式對應漸層色彩
   * @version 2025-01-30-V2.4.0
   * @date 2025-01-30 10:00:00
   * @description 根據模式返回對應的背景漸層色彩
   */
  LinearGradient _getGradientForMode(UserMode? mode) {
    switch (mode) {
      case UserMode.controller:
        return const LinearGradient(
          colors: [Color(0xFF1565C0), Color(0xFF1976D2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case UserMode.logger:
        return const LinearGradient(
          colors: [Color(0xFF7B1FA2), Color(0xFF8E24AA)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case UserMode.struggler:
        return const LinearGradient(
          colors: [Color(0xFFE65100), Color(0xFFEF6C00)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case UserMode.sleeper:
        return const LinearGradient(
          colors: [Color(0xFF2E7D32), Color(0xFF388E3C)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      default:
        // 預設漸層
        return const LinearGradient(
          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
    }
  }
}

/**
 * 18. 載入指示器Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 顯示載入中狀態的指示器
 */
class LoadingIndicator extends StatelessWidget {
  final String? message;
  
  const LoadingIndicator({Key? key, this.message}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return AccessibilityWrapper.wrapLoadingIndicator(
      Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(
            color: HighContrastTheme.getContrastTextColor(context, Colors.transparent),
            strokeWidth: 3,
          ),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(
              message!,
              style: TextStyle(
                fontSize: HighContrastTheme.getScaledFontSize(context, 16),
                color: HighContrastTheme.getContrastTextColor(context, Colors.transparent),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
      message,
    );
  }
}

/**
 * 19. 錯誤對話框Widget
 * @version 2025-01-30-V2.4.0
 * @date 2025-01-30 10:00:00
 * @description 顯示錯誤訊息的對話框
 */
class ErrorDialog extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final VoidCallback onDismiss;
  
  const ErrorDialog({
    Key? key,
    required this.message,
    this.onRetry,
    required this.onDismiss,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return AccessibilityWrapper.wrapErrorDialog(
      Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline,
                size: 48,
                color: Colors.red[400],
              ),
              const SizedBox(height: 16),
              Text(
                '發生錯誤',
                style: TextStyle(
                  fontSize: HighContrastTheme.getScaledFontSize(context, 20),
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                message,
                style: TextStyle(
                  fontSize: HighContrastTheme.getScaledFontSize(context, 16),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  if (onRetry != null)
                    Expanded(
                      child: TextButton(
                        onPressed: onRetry,
                        child: const Text('重試'),
                      ),
                    ),
                  if (onRetry != null) const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: onDismiss,
                      child: const Text('確定'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      message,
      WelcomeErrorType.unknown,
    );
  }
}
