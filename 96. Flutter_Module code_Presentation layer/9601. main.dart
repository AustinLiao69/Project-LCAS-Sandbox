
/**
 * Flutter主應用程式_2.0.0
 * @module 展示層主應用
 * @description LCAS 2.0 Flutter展示層主應用程式 - 四模式使用者體驗核心
 * @update 2025-01-31: 建立v2.0.0版本，實作四模式主題系統與路由管理
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

// 核心服務導入
import '9602. theme_manager.dart';
import '9603. app_router.dart';
import '9604. app_state_provider.dart';
import '9605. user_mode_provider.dart';

/**
 * 01. 主應用程式入口函數
 * @version 2025-01-31-V2.0.0
 * @date 2025-01-31 14:30:00
 * @update: 建立Flutter主應用程式，整合Provider狀態管理與GoRouter路由
 */
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 初始化應用設定
  await _initializeApp();
  
  runApp(const LCASApp());
}

/**
 * 02. 應用程式初始化函數
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 執行應用程式啟動前的必要初始化作業
 */
Future<void> _initializeApp() async {
  try {
    // 載入使用者偏好設定
    await UserModeProvider.loadUserPreferences();
    
    // 初始化主題管理器
    await ThemeManager.initialize();
    
    debugPrint('[LCAS] 應用程式初始化完成');
  } catch (e) {
    debugPrint('[LCAS] 應用程式初始化失敗: $e');
  }
}

/**
 * 03. LCAS主應用程式類別
 * @version 2025-01-31-V2.0.0
 * @date 2025-01-31 14:30:00
 * @update: 實作多Provider狀態管理與動態主題切換
 */
class LCASApp extends StatelessWidget {
  const LCASApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // 全域狀態提供者
        ChangeNotifierProvider(create: (_) => AppStateProvider()),
        ChangeNotifierProvider(create: (_) => UserModeProvider()),
        ChangeNotifierProvider(create: (_) => ThemeManager()),
      ],
      child: Consumer<ThemeManager>(
        builder: (context, themeManager, child) {
          return MaterialApp.router(
            title: 'LCAS 2.0 - 智慧記帳助手',
            debugShowCheckedModeBanner: false,
            
            // 主題配置
            theme: themeManager.currentTheme,
            darkTheme: themeManager.currentDarkTheme,
            themeMode: themeManager.themeMode,
            
            // 路由配置
            routerConfig: AppRouter.router,
            
            // 本地化配置
            locale: const Locale('zh', 'TW'),
            supportedLocales: const [
              Locale('zh', 'TW'),
              Locale('en', 'US'),
            ],
            
            // 應用程式標題生成器
            onGenerateTitle: (context) => 'LCAS 2.0',
            
            // 建構器回調
            builder: (context, child) {
              return MediaQuery(
                // 強制文字縮放因子為1.0，確保UI一致性
                data: MediaQuery.of(context).copyWith(textScaleFactor: 1.0),
                child: child ?? const SizedBox.shrink(),
              );
            },
          );
        },
      ),
    );
  }
}

/**
 * 04. 應用程式錯誤處理函數
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 統一處理應用程式層級的錯誤與異常
 */
void handleAppError(Object error, StackTrace stackTrace) {
  debugPrint('[LCAS] 應用程式錯誤: $error');
  debugPrint('[LCAS] 錯誤堆疊: $stackTrace');
  
  // 未來可整合錯誤回報服務
  // FirebaseCrashlytics.instance.recordError(error, stackTrace);
}

/**
 * 05. 應用程式生命週期監聽器
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 監聽應用程式前景背景切換，執行相應處理
 */
class AppLifecycleObserver extends WidgetsBindingObserver {
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        debugPrint('[LCAS] 應用程式恢復前景');
        _onAppResumed();
        break;
      case AppLifecycleState.paused:
        debugPrint('[LCAS] 應用程式進入背景');
        _onAppPaused();
        break;
      case AppLifecycleState.detached:
        debugPrint('[LCAS] 應用程式即將關閉');
        _onAppDetached();
        break;
      default:
        break;
    }
  }
  
  /**
   * 06. 應用程式恢復前景處理
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 應用程式從背景恢復時的處理邏輯
   */
  void _onAppResumed() {
    // 檢查用戶認證狀態
    // 同步最新資料
    // 刷新即時通知
  }
  
  /**
   * 07. 應用程式進入背景處理
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 應用程式進入背景時的處理邏輯
   */
  void _onAppPaused() {
    // 自動儲存用戶資料
    // 清理敏感資訊
    // 暫停非必要服務
  }
  
  /**
   * 08. 應用程式關閉處理
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 應用程式完全關閉前的清理作業
   */
  void _onAppDetached() {
    // 執行最終資料同步
    // 關閉所有連接
    // 清理暫存資料
  }
}
