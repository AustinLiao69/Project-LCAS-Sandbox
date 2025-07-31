
/**
 * 應用程式啟動頁面_1.0.0
 * @module 展示層啟動頁面
 * @description LCAS 2.0 應用程式啟動畫面 - 初始化與品牌展示
 * @update 2025-01-31: 建立v1.0.0版本，實作啟動動畫與初始化檢查
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

// 狀態管理導入
import '9604. app_state_provider.dart';
import '9605. user_mode_provider.dart';
import '9606. app_pages.dart';
import '9607. common_widgets.dart';

/**
 * 01. 啟動頁面類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:00:00
 * @update: 實作品牌展示與應用程式初始化邏輯
 */
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

/**
 * 02. 啟動頁面狀態類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:00:00
 * @update: 管理啟動頁面的生命週期與動畫
 */
class _SplashPageState extends State<SplashPage>
    with SingleTickerProviderStateMixin {
  
  // 動畫控制器
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  
  // 初始化狀態
  bool _isInitialized = false;
  String _initializationMessage = '正在啟動應用程式...';

  /**
   * 03. 初始化狀態
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 設定動畫控制器與開始初始化流程
   */
  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _startInitialization();
  }

  /**
   * 04. 設定動畫
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 建立淡入與縮放動畫效果
   */
  void _setupAnimations() {
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.0, 0.6, curve: Curves.easeIn),
    ));

    _scaleAnimation = Tween<double>(
      begin: 0.8,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.2, 0.8, curve: Curves.elasticOut),
    ));

    _animationController.forward();
  }

  /**
   * 05. 開始初始化流程
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 執行應用程式初始化並導航到適當頁面
   */
  Future<void> _startInitialization() async {
    try {
      // 最小顯示時間確保使用者看到啟動畫面
      await Future.delayed(const Duration(milliseconds: 1500));

      // 1. 初始化應用程式狀態
      setState(() {
        _initializationMessage = '正在載入設定...';
      });
      
      final appStateProvider = context.read<AppStateProvider>();
      await appStateProvider.initialize();

      // 2. 載入使用者模式設定
      setState(() {
        _initializationMessage = '正在檢查使用者設定...';
      });
      
      final userModeProvider = context.read<UserModeProvider>();
      // UserModeProvider已在main中初始化

      // 3. 決定導航目標
      setState(() {
        _initializationMessage = '準備就緒...';
      });

      await Future.delayed(const Duration(milliseconds: 500));

      // 根據應用程式狀態決定導航路徑
      final targetRoute = _determineTargetRoute(
        appStateProvider,
        userModeProvider,
      );

      setState(() {
        _isInitialized = true;
      });

      // 等待動畫完成後導航
      await _animationController.forward();
      await Future.delayed(const Duration(milliseconds: 300));

      if (mounted) {
        context.go(targetRoute);
      }

    } catch (error) {
      debugPrint('[SplashPage] 初始化錯誤: $error');
      
      setState(() {
        _initializationMessage = '初始化失敗，請重試';
      });

      // 顯示錯誤後導航到登入頁面
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) {
        context.go(AppRoutes.login);
      }
    }
  }

  /**
   * 06. 決定目標路由
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 根據使用者狀態決定初始導航目標
   */
  String _determineTargetRoute(
    AppStateProvider appStateProvider,
    UserModeProvider userModeProvider,
  ) {
    // 首次使用者 -> 導覽頁面
    if (appStateProvider.isFirstTime) {
      return AppRoutes.onboarding;
    }

    // 尚未完成模式設定 -> 問卷頁面
    if (!userModeProvider.isSetupComplete) {
      return AppRoutes.questionnaire;
    }

    // 已認證使用者 -> 主頁面
    if (appStateProvider.isAuthenticated) {
      return AppRoutes.mainTab;
    }

    // 預設 -> 登入頁面
    return AppRoutes.login;
  }

  /**
   * 07. 釋放資源
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 清理動畫控制器資源
   */
  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  /**
   * 08. 建構UI
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 渲染啟動頁面界面
   */
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: theme.colorScheme.primary,
      body: AnimatedBuilder(
        animation: _animationController,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  theme.colorScheme.primary,
                  theme.colorScheme.primary.withOpacity(0.8),
                  theme.colorScheme.secondary,
                ],
              ),
            ),
            child: Center(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // LCAS Logo
                      _buildLogo(),
                      
                      const SizedBox(height: 40),
                      
                      // 應用程式標題
                      _buildTitle(),
                      
                      const SizedBox(height: 20),
                      
                      // 版本與標語
                      _buildSubtitle(),
                      
                      const SizedBox(height: 60),
                      
                      // 載入指示器與狀態訊息
                      _buildLoadingIndicator(),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /**
   * 09. 建構Logo
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 渲染應用程式Logo
   */
  Widget _buildLogo() {
    return Container(
      width: 120,
      height: 120,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: const Icon(
        Icons.account_balance_wallet,
        size: 60,
        color: Color(0xFF1976D2),
      ),
    );
  }

  /**
   * 10. 建構標題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 渲染應用程式主標題
   */
  Widget _buildTitle() {
    return const Text(
      'LCAS 2.0',
      style: TextStyle(
        fontSize: 36,
        fontWeight: FontWeight.bold,
        color: Colors.white,
        letterSpacing: 2.0,
      ),
    );
  }

  /**
   * 11. 建構副標題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 渲染應用程式副標題與版本資訊
   */
  Widget _buildSubtitle() {
    return Column(
      children: [
        Text(
          '智慧記帳助手',
          style: TextStyle(
            fontSize: 18,
            color: Colors.white.withOpacity(0.9),
            fontWeight: FontWeight.w300,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Life Cycle Accounting System',
          style: TextStyle(
            fontSize: 14,
            color: Colors.white.withOpacity(0.7),
            fontStyle: FontStyle.italic,
          ),
        ),
      ],
    );
  }

  /**
   * 12. 建構載入指示器
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 渲染載入動畫與狀態訊息
   */
  Widget _buildLoadingIndicator() {
    return Column(
      children: [
        SizedBox(
          width: 30,
          height: 30,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            valueColor: AlwaysStoppedAnimation<Color>(
              Colors.white.withOpacity(0.8),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          _initializationMessage,
          style: TextStyle(
            fontSize: 16,
            color: Colors.white.withOpacity(0.8),
            fontWeight: FontWeight.w400,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
