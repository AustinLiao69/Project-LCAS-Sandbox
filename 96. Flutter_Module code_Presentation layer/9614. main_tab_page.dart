
/**
 * 主頁面Tab容器_1.0.0
 * @module 展示層主頁面
 * @description LCAS 2.0 主頁面Tab容器 - 四模式統一的Tab導航架構
 * @update 2025-01-31: 建立v1.0.0版本，實作模式差異化的Tab導航
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// 狀態管理導入
import '9605. user_mode_provider.dart';
import '9604. app_state_provider.dart';
import '9602. theme_manager.dart';

// 共用元件導入
import '9607. common_widgets.dart';

// 主要頁面導入
import '9615. dashboard_page.dart';
import '9616. quick_entry_page.dart';
import '9617. ledger_list_page.dart';
import '9618. budget_page.dart';
import '9619. settings_page.dart';

/**
 * 01. 主頁面Tab容器
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 17:00:00
 * @update: 四模式差異化的主頁面容器
 */
class MainTabPage extends StatefulWidget {
  const MainTabPage({super.key});
  
  @override
  State<MainTabPage> createState() => _MainTabPageState();
}

class _MainTabPageState extends State<MainTabPage>
    with TickerProviderStateMixin {
  late TabController _tabController;
  int _currentIndex = 0;
  
  @override
  void initState() {
    super.initState();
    _initializeTabController();
  }
  
  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
  
  /**
   * 02. 初始化Tab控制器
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:00:00
   * @update: 根據使用者模式設定Tab數量
   */
  void _initializeTabController() {
    final userMode = context.read<UserModeProvider>().currentMode;
    final tabCount = _getTabCountForMode(userMode);
    
    _tabController = TabController(
      length: tabCount,
      vsync: this,
      initialIndex: 0,
    );
    
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        setState(() {
          _currentIndex = _tabController.index;
        });
      }
    });
  }
  
  /**
   * 03. 取得模式對應的Tab數量
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:00:00
   * @update: 不同模式顯示不同數量的Tab
   */
  int _getTabCountForMode(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return 5; // 儀表板、快速記帳、帳本、預算、設定
      case UserMode.recordKeeper:
        return 4; // 儀表板、快速記帳、帳本、設定
      case UserMode.transformationChallenger:
        return 4; // 儀表板、快速記帳、預算、設定
      case UserMode.potentialAwakener:
        return 3; // 儀表板、快速記帳、設定
    }
  }
  
  /**
   * 04. 取得模式對應的Tab配置
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:00:00
   * @update: 根據模式返回不同的Tab配置
   */
  List<TabConfig> _getTabsForMode(UserMode mode) {
    final baseTheme = Theme.of(context);
    
    switch (mode) {
      case UserMode.precisionController:
        return [
          TabConfig(
            icon: Icons.dashboard,
            label: '儀表板',
            page: const DashboardPage(),
          ),
          TabConfig(
            icon: Icons.add_circle,
            label: '記帳',
            page: const QuickEntryPage(),
          ),
          TabConfig(
            icon: Icons.book,
            label: '帳本',
            page: const LedgerListPage(),
          ),
          TabConfig(
            icon: Icons.account_balance_wallet,
            label: '預算',
            page: const BudgetPage(),
          ),
          TabConfig(
            icon: Icons.settings,
            label: '設定',
            page: const SettingsPage(),
          ),
        ];
        
      case UserMode.recordKeeper:
        return [
          TabConfig(
            icon: Icons.auto_awesome,
            label: '今日',
            page: const DashboardPage(),
          ),
          TabConfig(
            icon: Icons.edit,
            label: '記錄',
            page: const QuickEntryPage(),
          ),
          TabConfig(
            icon: Icons.collections_bookmark,
            label: '回憶',
            page: const LedgerListPage(),
          ),
          TabConfig(
            icon: Icons.palette,
            label: '設定',
            page: const SettingsPage(),
          ),
        ];
        
      case UserMode.transformationChallenger:
        return [
          TabConfig(
            icon: Icons.trending_up,
            label: '進度',
            page: const DashboardPage(),
          ),
          TabConfig(
            icon: Icons.add_task,
            label: '記帳',
            page: const QuickEntryPage(),
          ),
          TabConfig(
            icon: Icons.flag,
            label: '目標',
            page: const BudgetPage(),
          ),
          TabConfig(
            icon: Icons.settings,
            label: '設定',
            page: const SettingsPage(),
          ),
        ];
        
      case UserMode.potentialAwakener:
        return [
          TabConfig(
            icon: Icons.home,
            label: '首頁',
            page: const DashboardPage(),
          ),
          TabConfig(
            icon: Icons.add,
            label: '記帳',
            page: const QuickEntryPage(),
          ),
          TabConfig(
            icon: Icons.menu,
            label: '更多',
            page: const SettingsPage(),
          ),
        ];
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Consumer<UserModeProvider>(
      builder: (context, userModeProvider, child) {
        final currentMode = userModeProvider.currentMode;
        final tabs = _getTabsForMode(currentMode);
        final modeTheme = userModeProvider.getModeTheme(currentMode);
        
        return Theme(
          data: Theme.of(context).copyWith(
            primaryColor: modeTheme.primaryColor,
            colorScheme: Theme.of(context).colorScheme.copyWith(
              primary: modeTheme.primaryColor,
            ),
          ),
          child: Scaffold(
            body: TabBarView(
              controller: _tabController,
              children: tabs.map((tab) => tab.page).toList(),
            ),
            bottomNavigationBar: _buildBottomNavigation(tabs, modeTheme),
            floatingActionButton: _buildFloatingActionButton(currentMode, modeTheme),
            floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
          ),
        );
      },
    );
  }
  
  /**
   * 05. 建構底部導航
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:00:00
   * @update: 模式差異化的底部導航設計
   */
  Widget _buildBottomNavigation(List<TabConfig> tabs, ModeTheme modeTheme) {
    return BottomAppBar(
      shape: const CircularNotchedRectangle(),
      notchMargin: 6.0,
      child: Container(
        height: 60,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: tabs.asMap().entries.map((entry) {
            final index = entry.key;
            final tab = entry.value;
            final isSelected = index == _currentIndex;
            
            return Expanded(
              child: InkWell(
                onTap: () {
                  _tabController.animateTo(index);
                },
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      tab.icon,
                      color: isSelected
                          ? modeTheme.primaryColor
                          : Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                      size: 24,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      tab.label,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: isSelected
                            ? modeTheme.primaryColor
                            : Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
  
  /**
   * 06. 建構浮動操作按鈕
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:00:00
   * @update: 模式差異化的FAB設計
   */
  Widget? _buildFloatingActionButton(UserMode mode, ModeTheme modeTheme) {
    // 潛在覺醒者模式不顯示FAB，保持極簡
    if (mode == UserMode.potentialAwakener) {
      return null;
    }
    
    return FloatingActionButton(
      onPressed: () {
        // 直接跳轉到記帳頁面的特定Tab
        final quickEntryIndex = _getQuickEntryTabIndex(mode);
        _tabController.animateTo(quickEntryIndex);
      },
      backgroundColor: modeTheme.primaryColor,
      foregroundColor: Colors.white,
      elevation: 6,
      child: Icon(
        _getFABIcon(mode),
        size: 28,
      ),
    );
  }
  
  /**
   * 07. 取得快速記帳Tab索引
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:00:00
   * @update: 根據模式返回記帳Tab的索引
   */
  int _getQuickEntryTabIndex(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
      case UserMode.transformationChallenger:
        return 1; // 第二個Tab
      case UserMode.recordKeeper:
        return 1; // 第二個Tab
      case UserMode.potentialAwakener:
        return 1; // 第二個Tab
    }
  }
  
  /**
   * 08. 取得FAB圖標
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:00:00
   * @update: 根據模式返回不同的FAB圖標
   */
  IconData _getFABIcon(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return Icons.add_chart;
      case UserMode.recordKeeper:
        return Icons.create;
      case UserMode.transformationChallenger:
        return Icons.add_task;
      case UserMode.potentialAwakener:
        return Icons.add;
    }
  }
}

/**
 * 09. Tab配置數據類
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 17:00:00
 * @update: Tab配置的數據結構
 */
class TabConfig {
  final IconData icon;
  final String label;
  final Widget page;
  
  const TabConfig({
    required this.icon,
    required this.label,
    required this.page,
  });
}
