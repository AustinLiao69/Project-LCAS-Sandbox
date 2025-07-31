
/**
 * 路由管理系統_1.0.0
 * @module 展示層路由管理
 * @description LCAS 2.0 GoRouter路由管理系統 - 支援深度連結與模式切換
 * @update 2025-01-31: 建立v1.0.0版本，實作四模式專屬路由與導航管理
 */

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

// 頁面導入 (將在後續實作)
import 'pages/9610. welcome_page.dart';
import 'pages/9611. authentication_page.dart';
import 'pages/9612. questionnaire_page.dart';
import 'pages/9613. mode_recommendation_page.dart';
import 'pages/9614. mode_confirmation_page.dart';
import 'pages/9615. onboarding_completion_page.dart';

// 四模式主頁
import 'pages/precision_controller/9620. precision_main_page.dart';
import 'pages/record_keeper/9630. record_main_page.dart';
import 'pages/transform_challenger/9640. transform_main_page.dart';
import 'pages/potential_awakener/9650. potential_main_page.dart';

// 共用功能頁面
import 'pages/shared/9660. entry_page.dart';
import 'pages/shared/9661. analysis_page.dart';
import 'pages/shared/9662. settings_page.dart';
import 'pages/shared/9663. error_page.dart';

import '9605. user_mode_provider.dart';

/**
 * 01. 路由配置常數
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 定義所有路由路徑常數
 */
class AppRoutes {
  // 入口流程路由
  static const String welcome = '/welcome';
  static const String authentication = '/auth';
  static const String questionnaire = '/questionnaire';
  static const String modeRecommendation = '/mode-recommendation';
  static const String modeConfirmation = '/mode-confirmation';
  static const String onboardingCompletion = '/onboarding-completion';
  
  // 四模式主頁路由
  static const String precisionMain = '/precision-main';
  static const String recordMain = '/record-main';
  static const String transformMain = '/transform-main';
  static const String potentialMain = '/potential-main';
  
  // 共用功能路由
  static const String entry = '/entry';
  static const String analysis = '/analysis';
  static const String settings = '/settings';
  static const String error = '/error';
  
  // 動態路由
  static const String modeHome = '/mode-home';
}

/**
 * 02. 路由管理器類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 實作GoRouter配置與導航邏輯
 */
class AppRouter {
  static final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();
  static final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>();
  
  /**
   * 03. 取得根導航鍵
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 提供根導航鍵給外部使用
   */
  static GlobalKey<NavigatorState> get rootNavigatorKey => _rootNavigatorKey;
  
  /**
   * 04. 主路由配置
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 配置GoRouter路由樹與導航邏輯
   */
  static final GoRouter router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.welcome,
    debugLogDiagnostics: true,
    
    // 路由重定向邏輯
    redirect: (context, state) {
      return _handleRouteRedirect(context, state);
    },
    
    // 錯誤頁面建構器
    errorBuilder: (context, state) => ErrorPage(
      error: state.error.toString(),
      path: state.fullPath,
    ),
    
    // 路由配置
    routes: [
      // 入口流程路由群組
      GoRoute(
        path: AppRoutes.welcome,
        name: 'welcome',
        builder: (context, state) => const WelcomePage(),
      ),
      
      GoRoute(
        path: AppRoutes.authentication,
        name: 'authentication',
        builder: (context, state) => const AuthenticationPage(),
      ),
      
      GoRoute(
        path: AppRoutes.questionnaire,
        name: 'questionnaire',
        builder: (context, state) => const QuestionnairePage(),
      ),
      
      GoRoute(
        path: AppRoutes.modeRecommendation,
        name: 'mode-recommendation',
        builder: (context, state) => const ModeRecommendationPage(),
      ),
      
      GoRoute(
        path: AppRoutes.modeConfirmation,
        name: 'mode-confirmation',
        builder: (context, state) => ModeConfirmationPage(
          recommendedMode: state.extra as UserMode?,
        ),
      ),
      
      GoRoute(
        path: AppRoutes.onboardingCompletion,
        name: 'onboarding-completion',
        builder: (context, state) => const OnboardingCompletionPage(),
      ),
      
      // 四模式主頁路由群組
      GoRoute(
        path: AppRoutes.precisionMain,
        name: 'precision-main',
        builder: (context, state) => const PrecisionMainPage(),
        routes: _buildPrecisionControllerSubRoutes(),
      ),
      
      GoRoute(
        path: AppRoutes.recordMain,
        name: 'record-main',
        builder: (context, state) => const RecordMainPage(),
        routes: _buildRecordKeeperSubRoutes(),
      ),
      
      GoRoute(
        path: AppRoutes.transformMain,
        name: 'transform-main',
        builder: (context, state) => const TransformMainPage(),
        routes: _buildTransformChallengerSubRoutes(),
      ),
      
      GoRoute(
        path: AppRoutes.potentialMain,
        name: 'potential-main',
        builder: (context, state) => const PotentialMainPage(),
        routes: _buildPotentialAwakenerSubRoutes(),
      ),
      
      // 動態模式主頁路由
      GoRoute(
        path: AppRoutes.modeHome,
        name: 'mode-home',
        builder: (context, state) => _buildModeHomePage(context),
      ),
      
      // 共用功能路由群組
      GoRoute(
        path: AppRoutes.entry,
        name: 'entry',
        builder: (context, state) => EntryPage(
          initialData: state.extra as Map<String, dynamic>?,
        ),
      ),
      
      GoRoute(
        path: AppRoutes.analysis,
        name: 'analysis',
        builder: (context, state) => AnalysisPage(
          analysisType: state.queryParameters['type'],
          dateRange: state.queryParameters['range'],
        ),
      ),
      
      GoRoute(
        path: AppRoutes.settings,
        name: 'settings',
        builder: (context, state) => const SettingsPage(),
      ),
    ],
  );
  
  /**
   * 05. 路由重定向處理
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 處理使用者認證狀態與模式導向
   */
  static String? _handleRouteRedirect(BuildContext context, GoRouterState state) {
    final userModeProvider = Provider.of<UserModeProvider>(context, listen: false);
    final currentPath = state.fullPath;
    
    // 檢查使用者是否已完成初始設定
    if (!userModeProvider.isSetupComplete) {
      // 允許在設定流程中導航
      final setupPaths = [
        AppRoutes.welcome,
        AppRoutes.authentication,
        AppRoutes.questionnaire,
        AppRoutes.modeRecommendation,
        AppRoutes.modeConfirmation,
        AppRoutes.onboardingCompletion,
      ];
      
      if (!setupPaths.contains(currentPath)) {
        return AppRoutes.welcome;
      }
    } else {
      // 設定完成後，重定向到對應模式主頁
      if (currentPath == AppRoutes.welcome ||
          currentPath == AppRoutes.onboardingCompletion ||
          currentPath == AppRoutes.modeHome) {
        return _getModeMainRoute(userModeProvider.currentMode);
      }
    }
    
    return null; // 無需重定向
  }
  
  /**
   * 06. 取得模式對應主頁路由
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據用戶模式返回對應主頁路由
   */
  static String _getModeMainRoute(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return AppRoutes.precisionMain;
      case UserMode.recordKeeper:
        return AppRoutes.recordMain;
      case UserMode.transformChallenger:
        return AppRoutes.transformMain;
      case UserMode.potentialAwakener:
        return AppRoutes.potentialMain;
    }
  }
  
  /**
   * 07. 建立動態模式主頁
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據當前模式動態建立對應主頁
   */
  static Widget _buildModeHomePage(BuildContext context) {
    final userModeProvider = Provider.of<UserModeProvider>(context);
    
    switch (userModeProvider.currentMode) {
      case UserMode.precisionController:
        return const PrecisionMainPage();
      case UserMode.recordKeeper:
        return const RecordMainPage();
      case UserMode.transformChallenger:
        return const TransformMainPage();
      case UserMode.potentialAwakener:
        return const PotentialMainPage();
    }
  }
  
  /**
   * 08-11. 建立各模式子路由
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 為每個模式建立專屬的子路由配置
   */
  
  static List<RouteBase> _buildPrecisionControllerSubRoutes() {
    return [
      GoRoute(
        path: '/project-dashboard',
        name: 'precision-project-dashboard',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/advanced-analytics',
        name: 'precision-advanced-analytics',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/export-tools',
        name: 'precision-export-tools',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
    ];
  }
  
  static List<RouteBase> _buildRecordKeeperSubRoutes() {
    return [
      GoRoute(
        path: '/aesthetic-entry',
        name: 'record-aesthetic-entry',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/beautiful-charts',
        name: 'record-beautiful-charts',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/theme-selection',
        name: 'record-theme-selection',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
    ];
  }
  
  static List<RouteBase> _buildTransformChallengerSubRoutes() {
    return [
      GoRoute(
        path: '/challenge-dashboard',
        name: 'transform-challenge-dashboard',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/goal-setting',
        name: 'transform-goal-setting',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/progress-tracking',
        name: 'transform-progress-tracking',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
    ];
  }
  
  static List<RouteBase> _buildPotentialAwakenerSubRoutes() {
    return [
      GoRoute(
        path: '/simple-entry',
        name: 'potential-simple-entry',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/gentle-insights',
        name: 'potential-gentle-insights',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
      GoRoute(
        path: '/habit-building',
        name: 'potential-habit-building',
        builder: (context, state) => const Placeholder(), // 待實作
      ),
    ];
  }
  
  /**
   * 12. 導航輔助方法群組
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 提供便捷的導航方法
   */
  
  /// 導航到指定路由
  static Future<T?> pushNamed<T extends Object?>(
    String name, {
    Map<String, String> pathParameters = const {},
    Map<String, dynamic> queryParameters = const {},
    Object? extra,
  }) {
    return router.pushNamed<T>(
      name,
      pathParameters: pathParameters,
      queryParameters: queryParameters,
      extra: extra,
    );
  }
  
  /// 替換當前路由
  static Future<T?> pushReplacementNamed<T extends Object?>(
    String name, {
    Map<String, String> pathParameters = const {},
    Map<String, dynamic> queryParameters = const {},
    Object? extra,
  }) {
    return router.pushReplacementNamed<T>(
      name,
      pathParameters: pathParameters,
      queryParameters: queryParameters,
      extra: extra,
    );
  }
  
  /// 返回上一頁
  static void pop<T extends Object?>([T? result]) {
    router.pop<T>(result);
  }
  
  /// 導航到模式主頁
  static void goToModeHome(UserMode mode) {
    final route = _getModeMainRoute(mode);
    router.go(route);
  }
  
  /// 導航到記帳頁面（帶參數）
  static void goToEntry({
    Map<String, dynamic>? initialData,
  }) {
    router.pushNamed(
      'entry',
      extra: initialData,
    );
  }
  
  /// 導航到分析頁面（帶查詢參數）
  static void goToAnalysis({
    String? analysisType,
    String? dateRange,
  }) {
    router.pushNamed(
      'analysis',
      queryParameters: {
        if (analysisType != null) 'type': analysisType,
        if (dateRange != null) 'range': dateRange,
      },
    );
  }
  
  /**
   * 13. 深度連結處理
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 處理來自LINE的深度連結
   */
  static void handleDeepLink(String deepLink) {
    try {
      final uri = Uri.parse(deepLink);
      final path = uri.path;
      final queryParams = uri.queryParameters;
      
      debugPrint('[AppRouter] 處理深度連結: $deepLink');
      
      // 根據深度連結類型進行導航
      switch (path) {
        case '/quick-entry':
          goToEntry(initialData: queryParams);
          break;
        case '/analysis':
          goToAnalysis(
            analysisType: queryParams['type'],
            dateRange: queryParams['range'],
          );
          break;
        case '/mode-switch':
          final modeString = queryParams['mode'];
          if (modeString != null) {
            final mode = _parseUserMode(modeString);
            if (mode != null) {
              goToModeHome(mode);
            }
          }
          break;
        default:
          router.go(path);
      }
    } catch (e) {
      debugPrint('[AppRouter] 深度連結處理失敗: $e');
      router.go(AppRoutes.error);
    }
  }
  
  /**
   * 14. 解析用戶模式字串
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 將字串轉換為UserMode列舉
   */
  static UserMode? _parseUserMode(String modeString) {
    switch (modeString.toLowerCase()) {
      case 'precision':
        return UserMode.precisionController;
      case 'record':
        return UserMode.recordKeeper;
      case 'transform':
        return UserMode.transformChallenger;
      case 'potential':
        return UserMode.potentialAwakener;
      default:
        return null;
    }
  }
  
  /**
   * 15. 取得當前路由資訊
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 提供當前路由狀態查詢
   */
  static GoRouterState? getCurrentRoute() {
    final delegate = router.routerDelegate;
    return delegate.currentConfiguration;
  }
  
  /**
   * 16. 檢查是否可以返回
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 檢查導航堆疊是否可以彈出
   */
  static bool canPop() {
    return router.canPop();
  }
}
