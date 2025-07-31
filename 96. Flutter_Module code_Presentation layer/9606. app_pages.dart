
/**
 * 應用程式頁面路由定義_1.0.0
 * @module 展示層路由管理
 * @description LCAS 2.0 頁面路由定義與導航管理 - 統一管理所有頁面路由
 * @update 2025-01-31: 建立v1.0.0版本，定義完整的頁面路由結構
 */

import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

// 頁面導入
import '9610. splash_page.dart';
import '9611. onboarding_page.dart';
import '9612. questionnaire_page.dart';
import '9613. login_page.dart';
import '9614. main_tab_page.dart';
import '9615. dashboard_page.dart';
import '9616. entry_add_page.dart';
import '9617. settings_page.dart';
import '9618. profile_page.dart';
import '9619. theme_selection_page.dart';

/**
 * 01. 路由路徑常數定義
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:00:00
 * @update: 定義所有頁面的路由路徑常數
 */
class AppRoutes {
  // 認證流程路由
  static const String splash = '/splash';
  static const String onboarding = '/onboarding';
  static const String questionnaire = '/questionnaire';
  static const String login = '/login';
  
  // 主要功能路由
  static const String mainTab = '/main';
  static const String dashboard = '/dashboard';
  static const String entryAdd = '/entry/add';
  
  // 設定相關路由
  static const String settings = '/settings';
  static const String profile = '/profile';
  static const String themeSelection = '/theme-selection';
  
  // 記帳功能路由
  static const String entryList = '/entries';
  static const String entryEdit = '/entry/edit';
  static const String entryDetail = '/entry/detail';
  
  // 報表分析路由
  static const String reports = '/reports';
  static const String analytics = '/analytics';
  
  // 預算管理路由
  static const String budgets = '/budgets';
  static const String budgetDetail = '/budget/detail';
  
  // 排程提醒路由
  static const String schedules = '/schedules';
  static const String scheduleEdit = '/schedule/edit';
  
  // 協作功能路由
  static const String collaboration = '/collaboration';
  static const String projectList = '/projects';
  static const String projectDetail = '/project/detail';
}

/**
 * 02. 頁面資訊類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:00:00
 * @update: 封裝頁面的基本資訊與配置
 */
class PageInfo {
  final String path;
  final String name;
  final Widget Function(BuildContext, GoRouterState) builder;
  final List<String>? roles;
  final bool requiresAuth;
  final bool allowAnonymous;
  
  const PageInfo({
    required this.path,
    required this.name,
    required this.builder,
    this.roles,
    this.requiresAuth = false,
    this.allowAnonymous = true,
  });
}

/**
 * 03. 應用程式頁面定義類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:00:00
 * @update: 統一管理所有頁面的定義與配置
 */
class AppPages {
  /**
   * 04. 認證流程頁面定義
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 定義使用者認證相關的頁面
   */
  static List<PageInfo> get authPages => [
    PageInfo(
      path: AppRoutes.splash,
      name: 'SplashPage',
      builder: (context, state) => const SplashPage(),
      allowAnonymous: true,
    ),
    PageInfo(
      path: AppRoutes.onboarding,
      name: 'OnboardingPage', 
      builder: (context, state) => const OnboardingPage(),
      allowAnonymous: true,
    ),
    PageInfo(
      path: AppRoutes.questionnaire,
      name: 'QuestionnairePage',
      builder: (context, state) => const QuestionnairePage(),
      allowAnonymous: true,
    ),
    PageInfo(
      path: AppRoutes.login,
      name: 'LoginPage',
      builder: (context, state) => const LoginPage(),
      allowAnonymous: true,
    ),
  ];
  
  /**
   * 05. 主要功能頁面定義
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 定義應用程式核心功能頁面
   */
  static List<PageInfo> get mainPages => [
    PageInfo(
      path: AppRoutes.mainTab,
      name: 'MainTabPage',
      builder: (context, state) => const MainTabPage(),
      requiresAuth: true,
    ),
    PageInfo(
      path: AppRoutes.dashboard,
      name: 'DashboardPage',
      builder: (context, state) => const DashboardPage(),
      requiresAuth: true,
    ),
    PageInfo(
      path: AppRoutes.entryAdd,
      name: 'EntryAddPage',
      builder: (context, state) => const EntryAddPage(),
      requiresAuth: true,
    ),
  ];
  
  /**
   * 06. 設定頁面定義
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 定義設定與個人化相關頁面
   */
  static List<PageInfo> get settingPages => [
    PageInfo(
      path: AppRoutes.settings,
      name: 'SettingsPage',
      builder: (context, state) => const SettingsPage(),
      requiresAuth: true,
    ),
    PageInfo(
      path: AppRoutes.profile,
      name: 'ProfilePage',
      builder: (context, state) => const ProfilePage(),
      requiresAuth: true,
    ),
    PageInfo(
      path: AppRoutes.themeSelection,
      name: 'ThemeSelectionPage',
      builder: (context, state) => const ThemeSelectionPage(),
      requiresAuth: true,
    ),
  ];
  
  /**
   * 07. 所有頁面合併
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 合併所有頁面定義供路由使用
   */
  static List<PageInfo> get allPages => [
    ...authPages,
    ...mainPages,
    ...settingPages,
  ];
  
  /**
   * 08. 根據路徑取得頁面資訊
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 提供路徑查詢頁面資訊的方法
   */
  static PageInfo? getPageByPath(String path) {
    try {
      return allPages.firstWhere((page) => page.path == path);
    } catch (e) {
      return null;
    }
  }
  
  /**
   * 09. 檢查路徑是否需要認證
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 驗證指定路徑是否需要使用者認證
   */
  static bool requiresAuthentication(String path) {
    final page = getPageByPath(path);
    return page?.requiresAuth ?? false;
  }
  
  /**
   * 10. 檢查路徑是否允許匿名訪問
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 驗證指定路徑是否允許未登入使用者訪問
   */
  static bool allowsAnonymous(String path) {
    final page = getPageByPath(path);
    return page?.allowAnonymous ?? false;
  }
  
  /**
   * 11. 取得初始路由
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 根據使用者狀態決定初始路由
   */
  static String getInitialRoute({
    required bool isAuthenticated,
    required bool isFirstTime,
    required bool isSetupComplete,
  }) {
    if (isFirstTime) {
      return AppRoutes.onboarding;
    }
    
    if (!isSetupComplete) {
      return AppRoutes.questionnaire;
    }
    
    if (!isAuthenticated) {
      return AppRoutes.login;
    }
    
    return AppRoutes.mainTab;
  }
  
  /**
   * 12. 建立GoRouter路由配置
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 為GoRouter生成完整路由配置
   */
  static List<GoRoute> buildRoutes() {
    return allPages.map((page) {
      return GoRoute(
        path: page.path,
        name: page.name,
        builder: page.builder,
      );
    }).toList();
  }
  
  /**
   * 13. 頁面導航輔助方法
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 提供便捷的頁面導航方法
   */
  static void navigateToPage(BuildContext context, String path, {Object? extra}) {
    context.go(path, extra: extra);
  }
  
  static void pushPage(BuildContext context, String path, {Object? extra}) {
    context.push(path, extra: extra);
  }
  
  static void replacePage(BuildContext context, String path, {Object? extra}) {
    context.pushReplacement(path, extra: extra);
  }
  
  static void popPage(BuildContext context) {
    context.pop();
  }
  
  /**
   * 14. 特殊導航方法
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 提供特殊場景的導航邏輯
   */
  static void navigateToLogin(BuildContext context) {
    context.go(AppRoutes.login);
  }
  
  static void navigateToMain(BuildContext context) {
    context.go(AppRoutes.mainTab);
  }
  
  static void navigateToOnboarding(BuildContext context) {
    context.go(AppRoutes.onboarding);
  }
  
  static void navigateToQuestionnaire(BuildContext context) {
    context.go(AppRoutes.questionnaire);
  }
}

/**
 * 15. 路由中間件類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 15:00:00
 * @update: 處理路由導航的中間件邏輯
 */
class RouteMiddleware {
  /**
   * 16. 認證檢查中間件
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 檢查路由是否需要認證並重定向
   */
  static String? authGuard(BuildContext context, GoRouterState state) {
    final path = state.uri.path;
    final page = AppPages.getPageByPath(path);
    
    if (page == null) {
      return AppRoutes.mainTab; // 預設路由
    }
    
    // 檢查是否需要認證
    if (page.requiresAuth) {
      // 這裡需要檢查實際的認證狀態
      // final isAuthenticated = Provider.of<AppStateProvider>(context, listen: false).isAuthenticated;
      // if (!isAuthenticated) {
      //   return AppRoutes.login;
      // }
    }
    
    return null; // 允許訪問
  }
  
  /**
   * 17. 頁面日誌記錄
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 15:00:00
   * @update: 記錄頁面訪問與導航日誌
   */
  static void logPageNavigation(String from, String to) {
    debugPrint('[RouteMiddleware] 頁面導航: $from -> $to');
  }
}
