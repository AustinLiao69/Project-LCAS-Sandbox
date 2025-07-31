
/**
 * 主題管理系統_1.0.0
 * @module 展示層主題管理
 * @description LCAS 2.0 四模式主題管理系統 - 支援動態主題切換與個人化定制
 * @update 2025-01-31: 建立v1.0.0版本，實作四模式專屬主題與動態切換
 */

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/**
 * 01. 用戶模式列舉
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 定義LCAS 2.0四種使用者模式
 */
enum UserMode {
  precisionController, // 精準控制者 (高D高M)
  recordKeeper,        // 紀錄習慣者 (高D低M)
  transformChallenger, // 轉型挑戰者 (低D高M)
  potentialAwakener,   // 潛在覺醒者 (低D低M)
}

/**
 * 02. 主題管理器類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 實作四模式主題管理與動態切換功能
 */
class ThemeManager extends ChangeNotifier {
  static ThemeManager? _instance;
  static ThemeManager get instance => _instance ??= ThemeManager._();
  
  ThemeManager._();
  
  // 私有變數
  UserMode _currentMode = UserMode.potentialAwakener;
  ThemeMode _themeMode = ThemeMode.system;
  bool _isDarkMode = false;
  
  // 公開屬性
  UserMode get currentMode => _currentMode;
  ThemeMode get themeMode => _themeMode;
  bool get isDarkMode => _isDarkMode;
  
  /**
   * 03. 初始化主題管理器
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 從持久化儲存載入主題設定
   */
  static Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final instance = ThemeManager.instance;
    
    // 載入用戶模式
    final modeIndex = prefs.getInt('user_mode') ?? UserMode.potentialAwakener.index;
    instance._currentMode = UserMode.values[modeIndex];
    
    // 載入主題模式
    final themeModeIndex = prefs.getInt('theme_mode') ?? ThemeMode.system.index;
    instance._themeMode = ThemeMode.values[themeModeIndex];
    
    // 載入暗色模式設定
    instance._isDarkMode = prefs.getBool('is_dark_mode') ?? false;
    
    debugPrint('[ThemeManager] 初始化完成: ${instance._currentMode}');
  }
  
  /**
   * 04. 取得當前主題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據當前模式返回對應的亮色主題
   */
  ThemeData get currentTheme {
    switch (_currentMode) {
      case UserMode.precisionController:
        return _buildPrecisionControllerTheme(false);
      case UserMode.recordKeeper:
        return _buildRecordKeeperTheme(false);
      case UserMode.transformChallenger:
        return _buildTransformChallengerTheme(false);
      case UserMode.potentialAwakener:
        return _buildPotentialAwakenerTheme(false);
    }
  }
  
  /**
   * 05. 取得當前暗色主題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據當前模式返回對應的暗色主題
   */
  ThemeData get currentDarkTheme {
    switch (_currentMode) {
      case UserMode.precisionController:
        return _buildPrecisionControllerTheme(true);
      case UserMode.recordKeeper:
        return _buildRecordKeeperTheme(true);
      case UserMode.transformChallenger:
        return _buildTransformChallengerTheme(true);
      case UserMode.potentialAwakener:
        return _buildPotentialAwakenerTheme(true);
    }
  }
  
  /**
   * 06. 切換用戶模式
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 更新用戶模式並持久化儲存
   */
  Future<void> setUserMode(UserMode mode) async {
    if (_currentMode != mode) {
      _currentMode = mode;
      await _saveUserMode();
      notifyListeners();
      debugPrint('[ThemeManager] 切換模式: $mode');
    }
  }
  
  /**
   * 07. 切換主題模式
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 在亮色、暗色、系統主題間切換
   */
  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode != mode) {
      _themeMode = mode;
      await _saveThemeMode();
      notifyListeners();
      debugPrint('[ThemeManager] 切換主題模式: $mode');
    }
  }
  
  /**
   * 08. 建立精準控制者主題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 專業商務風格，深色調，高對比
   */
  ThemeData _buildPrecisionControllerTheme(bool isDark) {
    final colorScheme = isDark
        ? const ColorScheme.dark(
            primary: Color(0xFF1565C0),
            secondary: Color(0xFF0D47A1),
            surface: Color(0xFF121212),
            background: Color(0xFF000000),
            error: Color(0xFFE57373),
          )
        : const ColorScheme.light(
            primary: Color(0xFF1976D2),
            secondary: Color(0xFF1565C0),
            surface: Color(0xFFFFFFFF),
            background: Color(0xFFF5F5F5),
            error: Color(0xFFD32F2F),
          );
    
    return _buildBaseTheme(colorScheme, isDark, UserMode.precisionController);
  }
  
  /**
   * 09. 建立紀錄習慣者主題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 溫馨美感風格，柔和色調，圓潤設計
   */
  ThemeData _buildRecordKeeperTheme(bool isDark) {
    final colorScheme = isDark
        ? const ColorScheme.dark(
            primary: Color(0xFFAD7A99),
            secondary: Color(0xFF8BC34A),
            surface: Color(0xFF1A1A1A),
            background: Color(0xFF0F0F0F),
            error: Color(0xFFFFAB91),
          )
        : const ColorScheme.light(
            primary: Color(0xFFE91E63),
            secondary: Color(0xFF4CAF50),
            surface: Color(0xFFFFFBFE),
            background: Color(0xFFF8F9FA),
            error: Color(0xFFFF5722),
          );
    
    return _buildBaseTheme(colorScheme, isDark, UserMode.recordKeeper);
  }
  
  /**
   * 10. 建立轉型挑戰者主題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 活力激勵風格，鮮明色調，動感設計
   */
  ThemeData _buildTransformChallengerTheme(bool isDark) {
    final colorScheme = isDark
        ? const ColorScheme.dark(
            primary: Color(0xFFFF6F00),
            secondary: Color(0xFFF57C00),
            surface: Color(0xFF1E1E1E),
            background: Color(0xFF121212),
            error: Color(0xFFFF8A65),
          )
        : const ColorScheme.light(
            primary: Color(0xFFFF9800),
            secondary: Color(0xFFFF5722),
            surface: Color(0xFFFFFFFF),
            background: Color(0xFFFAFAFA),
            error: Color(0xFFE64A19),
          );
    
    return _buildBaseTheme(colorScheme, isDark, UserMode.transformChallenger);
  }
  
  /**
   * 11. 建立潛在覺醒者主題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 友善親和風格，淡雅色調，簡潔設計
   */
  ThemeData _buildPotentialAwakenerTheme(bool isDark) {
    final colorScheme = isDark
        ? const ColorScheme.dark(
            primary: Color(0xFF81C784),
            secondary: Color(0xFF66BB6A),
            surface: Color(0xFF1C1C1C),
            background: Color(0xFF101010),
            error: Color(0xFFFFCDD2),
          )
        : const ColorScheme.light(
            primary: Color(0xFF4CAF50),
            secondary: Color(0xFF8BC34A),
            surface: Color(0xFFFFFFFF),
            background: Color(0xFFF1F8E9),
            error: Color(0xFFE8F5E8),
          );
    
    return _buildBaseTheme(colorScheme, isDark, UserMode.potentialAwakener);
  }
  
  /**
   * 12. 建立基礎主題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 統一建立主題的基礎架構
   */
  ThemeData _buildBaseTheme(ColorScheme colorScheme, bool isDark, UserMode mode) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: isDark ? Brightness.dark : Brightness.light,
      
      // 應用程式欄主題
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: _getElevationForMode(mode),
        centerTitle: mode == UserMode.recordKeeper,
        titleTextStyle: _getTitleStyleForMode(mode, colorScheme),
      ),
      
      // 卡片主題
      cardTheme: CardTheme(
        elevation: _getCardElevationForMode(mode),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(_getBorderRadiusForMode(mode)),
        ),
        color: colorScheme.surface,
      ),
      
      // 按鈕主題
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colorScheme.primary,
          foregroundColor: colorScheme.onPrimary,
          elevation: _getButtonElevationForMode(mode),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(_getButtonRadiusForMode(mode)),
          ),
          padding: _getButtonPaddingForMode(mode),
        ),
      ),
      
      // 輸入框主題
      inputDecorationTheme: InputDecorationTheme(
        border: _getInputBorderForMode(mode, colorScheme),
        enabledBorder: _getInputBorderForMode(mode, colorScheme),
        focusedBorder: _getFocusedInputBorderForMode(mode, colorScheme),
        filled: true,
        fillColor: colorScheme.surface,
        contentPadding: _getInputPaddingForMode(mode),
      ),
      
      // 底部導航主題
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: colorScheme.surface,
        selectedItemColor: colorScheme.primary,
        unselectedItemColor: colorScheme.onSurface.withOpacity(0.6),
        elevation: _getBottomNavElevationForMode(mode),
        type: BottomNavigationBarType.fixed,
      ),
      
      // 浮動按鈕主題
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
        elevation: _getFabElevationForMode(mode),
        shape: _getFabShapeForMode(mode),
      ),
    );
  }
  
  /**
   * 13-20. 取得各模式專屬樣式參數
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據用戶模式返回對應的UI樣式參數
   */
  
  double _getElevationForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: return 4.0;
      case UserMode.recordKeeper: return 2.0;
      case UserMode.transformChallenger: return 6.0;
      case UserMode.potentialAwakener: return 1.0;
    }
  }
  
  double _getCardElevationForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: return 8.0;
      case UserMode.recordKeeper: return 4.0;
      case UserMode.transformChallenger: return 12.0;
      case UserMode.potentialAwakener: return 2.0;
    }
  }
  
  double _getBorderRadiusForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: return 4.0;
      case UserMode.recordKeeper: return 16.0;
      case UserMode.transformChallenger: return 8.0;
      case UserMode.potentialAwakener: return 12.0;
    }
  }
  
  double _getButtonElevationForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: return 2.0;
      case UserMode.recordKeeper: return 4.0;
      case UserMode.transformChallenger: return 8.0;
      case UserMode.potentialAwakener: return 1.0;
    }
  }
  
  double _getButtonRadiusForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: return 4.0;
      case UserMode.recordKeeper: return 20.0;
      case UserMode.transformChallenger: return 8.0;
      case UserMode.potentialAwakener: return 16.0;
    }
  }
  
  EdgeInsets _getButtonPaddingForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: 
        return const EdgeInsets.symmetric(horizontal: 16, vertical: 8);
      case UserMode.recordKeeper: 
        return const EdgeInsets.symmetric(horizontal: 24, vertical: 12);
      case UserMode.transformChallenger: 
        return const EdgeInsets.symmetric(horizontal: 20, vertical: 16);
      case UserMode.potentialAwakener: 
        return const EdgeInsets.symmetric(horizontal: 32, vertical: 16);
    }
  }
  
  TextStyle _getTitleStyleForMode(UserMode mode, ColorScheme colorScheme) {
    switch (mode) {
      case UserMode.precisionController:
        return TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface,
        );
      case UserMode.recordKeeper:
        return TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w400,
          color: colorScheme.onSurface,
        );
      case UserMode.transformChallenger:
        return TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: colorScheme.onSurface,
        );
      case UserMode.potentialAwakener:
        return TextStyle(
          fontSize: 19,
          fontWeight: FontWeight.w500,
          color: colorScheme.onSurface,
        );
    }
  }
  
  InputBorder _getInputBorderForMode(UserMode mode, ColorScheme colorScheme) {
    switch (mode) {
      case UserMode.precisionController:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: BorderSide(color: colorScheme.outline),
        );
      case UserMode.recordKeeper:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        );
      case UserMode.transformChallenger:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        );
      case UserMode.potentialAwakener:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colorScheme.outline.withOpacity(0.5)),
        );
    }
  }
  
  InputBorder _getFocusedInputBorderForMode(UserMode mode, ColorScheme colorScheme) {
    switch (mode) {
      case UserMode.precisionController:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        );
      case UserMode.recordKeeper:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        );
      case UserMode.transformChallenger:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: colorScheme.primary, width: 3),
        );
      case UserMode.potentialAwakener:
        return OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        );
    }
  }
  
  EdgeInsets _getInputPaddingForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: 
        return const EdgeInsets.symmetric(horizontal: 12, vertical: 8);
      case UserMode.recordKeeper: 
        return const EdgeInsets.symmetric(horizontal: 16, vertical: 16);
      case UserMode.transformChallenger: 
        return const EdgeInsets.symmetric(horizontal: 16, vertical: 12);
      case UserMode.potentialAwakener: 
        return const EdgeInsets.symmetric(horizontal: 20, vertical: 16);
    }
  }
  
  double _getBottomNavElevationForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: return 8.0;
      case UserMode.recordKeeper: return 4.0;
      case UserMode.transformChallenger: return 16.0;
      case UserMode.potentialAwakener: return 2.0;
    }
  }
  
  double _getFabElevationForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController: return 6.0;
      case UserMode.recordKeeper: return 8.0;
      case UserMode.transformChallenger: return 12.0;
      case UserMode.potentialAwakener: return 4.0;
    }
  }
  
  ShapeBorder _getFabShapeForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return RoundedRectangleBorder(borderRadius: BorderRadius.circular(8));
      case UserMode.recordKeeper:
        return const CircleBorder();
      case UserMode.transformChallenger:
        return RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
      case UserMode.potentialAwakener:
        return RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
    }
  }
  
  /**
   * 21. 儲存用戶模式
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 持久化儲存用戶模式設定
   */
  Future<void> _saveUserMode() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('user_mode', _currentMode.index);
  }
  
  /**
   * 22. 儲存主題模式
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 持久化儲存主題模式設定
   */
  Future<void> _saveThemeMode() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('theme_mode', _themeMode.index);
  }
}
