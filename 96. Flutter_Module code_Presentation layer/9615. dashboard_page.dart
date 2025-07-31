
/**
 * 儀表板頁面_1.0.0
 * @module 展示層儀表板
 * @description LCAS 2.0 儀表板頁面 - 四模式差異化的數據展示
 * @update 2025-01-31: 建立v1.0.0版本，實作模式差異化的儀表板
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// 狀態管理導入
import '9605. user_mode_provider.dart';
import '9604. app_state_provider.dart';

// 共用元件導入
import '9607. common_widgets.dart';

/**
 * 01. 儀表板頁面
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 17:30:00
 * @update: 根據使用者模式顯示不同的儀表板內容
 */
class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage>
    with AutomaticKeepAliveClientMixin {
  
  @override
  bool get wantKeepAlive => true;
  
  @override
  Widget build(BuildContext context) {
    super.build(context);
    
    return Consumer<UserModeProvider>(
      builder: (context, userModeProvider, child) {
        final currentMode = userModeProvider.currentMode;
        
        return Scaffold(
          appBar: _buildAppBar(currentMode),
          body: RefreshIndicator(
            onRefresh: _refreshData,
            child: _buildModeSpecificDashboard(currentMode),
          ),
        );
      },
    );
  }
  
  /**
   * 02. 建構應用欄
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 模式差異化的應用欄設計
   */
  PreferredSizeWidget _buildAppBar(UserMode mode) {
    final modeInfo = context.read<UserModeProvider>().getModeDisplayInfo(mode);
    
    return AppBar(
      title: Text(_getAppBarTitle(mode)),
      backgroundColor: Colors.transparent,
      elevation: 0,
      actions: [
        IconButton(
          icon: const Icon(Icons.notifications_outlined),
          onPressed: _showNotifications,
        ),
        IconButton(
          icon: const Icon(Icons.search),
          onPressed: _showSearch,
        ),
      ],
    );
  }
  
  /**
   * 03. 取得應用欄標題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 根據模式返回不同的標題
   */
  String _getAppBarTitle(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return '財務控制台';
      case UserMode.recordKeeper:
        return '今日記錄';
      case UserMode.transformationChallenger:
        return '目標進度';
      case UserMode.potentialAwakener:
        return 'LCAS';
    }
  }
  
  /**
   * 04. 建構模式專屬儀表板
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 根據模式顯示不同的儀表板佈局
   */
  Widget _buildModeSpecificDashboard(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return _buildPrecisionControllerDashboard();
      case UserMode.recordKeeper:
        return _buildRecordKeeperDashboard();
      case UserMode.transformationChallenger:
        return _buildTransformationChallengerDashboard();
      case UserMode.potentialAwakener:
        return _buildPotentialAwakenerDashboard();
    }
  }
  
  /**
   * 05. 精準控制者儀表板
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 專業級儀表板佈局
   */
  Widget _buildPrecisionControllerDashboard() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 財務概況卡片
          _buildFinancialOverviewCard(),
          const SizedBox(height: 16),
          
          // 快速統計網格
          _buildQuickStatsGrid(),
          const SizedBox(height: 16),
          
          // 月度趨勢圖表
          _buildMonthlyTrendChart(),
          const SizedBox(height: 16),
          
          // 預算執行情況
          _buildBudgetExecutionCard(),
          const SizedBox(height: 16),
          
          // 最近交易
          _buildRecentTransactionsCard(),
          const SizedBox(height: 16),
          
          // 投資組合概況（如果有）
          _buildInvestmentPortfolioCard(),
        ],
      ),
    );
  }
  
  /**
   * 06. 紀錄習慣者儀表板
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 美感導向的儀表板佈局
   */
  Widget _buildRecordKeeperDashboard() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 今日問候卡片
          _buildGreetingCard(),
          const SizedBox(height: 20),
          
          // 今日花費總覽
          _buildTodaySpendingCard(),
          const SizedBox(height: 20),
          
          // 美感化月度圖表
          _buildAestheticMonthlyChart(),
          const SizedBox(height: 20),
          
          // 記帳習慣追蹤
          _buildHabitTrackingCard(),
          const SizedBox(height: 20),
          
          // 美好回憶（特殊記錄）
          _buildMemoryHighlightsCard(),
          const SizedBox(height: 20),
          
          // 溫馨提醒
          _buildGentleRemindersCard(),
        ],
      ),
    );
  }
  
  /**
   * 07. 轉型挑戰者儀表板
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 目標導向的儀表板佈局
   */
  Widget _buildTransformationChallengerDashboard() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 目標進度總覽
          _buildGoalProgressOverview(),
          const SizedBox(height: 16),
          
          // 本月挑戰狀態
          _buildMonthlyChallengeCard(),
          const SizedBox(height: 16),
          
          // 儲蓄目標追蹤
          _buildSavingsGoalCard(),
          const SizedBox(height: 16),
          
          // 支出分析與建議
          _buildSpendingAnalysisCard(),
          const SizedBox(height: 16),
          
          // 成就展示
          _buildAchievementsCard(),
          const SizedBox(height: 16),
          
          // 下個里程碑
          _buildNextMilestoneCard(),
        ],
      ),
    );
  }
  
  /**
   * 08. 潛在覺醒者儀表板
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 極簡引導式儀表板佈局
   */
  Widget _buildPotentialAwakenerDashboard() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 簡單問候
          _buildSimpleGreeting(),
          const SizedBox(height: 24),
          
          // 本月總覽（極簡版）
          _buildSimpleMonthlyOverview(),
          const SizedBox(height: 24),
          
          // 快速記帳引導
          _buildQuickEntryGuidance(),
          const SizedBox(height: 24),
          
          // 簡單統計
          _buildSimpleStats(),
          const SizedBox(height: 24),
          
          // 溫和建議
          _buildGentleSuggestions(),
        ],
      ),
    );
  }
  
  /**
   * 09. 建構財務概況卡片
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 專業用戶的財務概況顯示
   */
  Widget _buildFinancialOverviewCard() {
    return LCASCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '財務概況',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          
          Row(
            children: [
              Expanded(
                child: _buildFinancialMetric(
                  '總資產',
                  'NT\$ 1,234,567',
                  Icons.account_balance_wallet,
                  Colors.green,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildFinancialMetric(
                  '本月支出',
                  'NT\$ 45,678',
                  Icons.trending_down,
                  Colors.red,
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 12),
          
          Row(
            children: [
              Expanded(
                child: _buildFinancialMetric(
                  '本月收入',
                  'NT\$ 78,900',
                  Icons.trending_up,
                  Colors.blue,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildFinancialMetric(
                  '淨儲蓄',
                  'NT\$ 33,222',
                  Icons.savings,
                  Colors.orange,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  /**
   * 10. 建構財務指標項目
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 單一財務指標的顯示組件
   */
  Widget _buildFinancialMetric(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
  
  /**
   * 11. 建構快速統計網格
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 專業用戶的快速統計信息
   */
  Widget _buildQuickStatsGrid() {
    return LCASCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '快速統計',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            childAspectRatio: 2.5,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            children: [
              _buildStatItem('今日交易', '12 筆', Icons.receipt),
              _buildStatItem('本週預算', '85%', Icons.pie_chart),
              _buildStatItem('平均單筆', 'NT\$ 456', Icons.analytics),
              _buildStatItem('目標達成', '67%', Icons.flag),
            ],
          ),
        ],
      ),
    );
  }
  
  /**
   * 12. 建構統計項目
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 單一統計項目組件
   */
  Widget _buildStatItem(String title, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.2),
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            color: Theme.of(context).colorScheme.primary,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodySmall,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  // 這裡為了節省空間，其他建構方法使用placeholder實作
  // 實際開發中需要完整實作每個模式的特定組件
  
  Widget _buildMonthlyTrendChart() => _buildPlaceholderCard('月度趨勢圖表');
  Widget _buildBudgetExecutionCard() => _buildPlaceholderCard('預算執行情況');
  Widget _buildRecentTransactionsCard() => _buildPlaceholderCard('最近交易');
  Widget _buildInvestmentPortfolioCard() => _buildPlaceholderCard('投資組合概況');
  
  Widget _buildGreetingCard() => _buildPlaceholderCard('今日問候');
  Widget _buildTodaySpendingCard() => _buildPlaceholderCard('今日花費總覽');
  Widget _buildAestheticMonthlyChart() => _buildPlaceholderCard('美感化月度圖表');
  Widget _buildHabitTrackingCard() => _buildPlaceholderCard('記帳習慣追蹤');
  Widget _buildMemoryHighlightsCard() => _buildPlaceholderCard('美好回憶');
  Widget _buildGentleRemindersCard() => _buildPlaceholderCard('溫馨提醒');
  
  Widget _buildGoalProgressOverview() => _buildPlaceholderCard('目標進度總覽');
  Widget _buildMonthlyChallengeCard() => _buildPlaceholderCard('本月挑戰狀態');
  Widget _buildSavingsGoalCard() => _buildPlaceholderCard('儲蓄目標追蹤');
  Widget _buildSpendingAnalysisCard() => _buildPlaceholderCard('支出分析與建議');
  Widget _buildAchievementsCard() => _buildPlaceholderCard('成就展示');
  Widget _buildNextMilestoneCard() => _buildPlaceholderCard('下個里程碑');
  
  Widget _buildSimpleGreeting() => _buildPlaceholderCard('簡單問候');
  Widget _buildSimpleMonthlyOverview() => _buildPlaceholderCard('本月總覽');
  Widget _buildQuickEntryGuidance() => _buildPlaceholderCard('快速記帳引導');
  Widget _buildSimpleStats() => _buildPlaceholderCard('簡單統計');
  Widget _buildGentleSuggestions() => _buildPlaceholderCard('溫和建議');
  
  /**
   * 13. 建構占位符卡片
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 開發階段的占位符組件
   */
  Widget _buildPlaceholderCard(String title) {
    return LCASCard(
      child: Container(
        height: 120,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.construction,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                size: 32,
              ),
              const SizedBox(height: 8),
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '開發中...',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  /**
   * 14. 刷新數據
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 下拉刷新數據處理
   */
  Future<void> _refreshData() async {
    // 模擬數據刷新
    await Future.delayed(const Duration(seconds: 2));
    
    if (mounted) {
      setState(() {
        // 觸發重建
      });
    }
  }
  
  /**
   * 15. 顯示通知
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 通知功能處理
   */
  void _showNotifications() {
    // TODO: 實作通知功能
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('通知功能開發中...')),
    );
  }
  
  /**
   * 16. 顯示搜尋
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 17:30:00
   * @update: 搜尋功能處理
   */
  void _showSearch() {
    // TODO: 實作搜尋功能
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('搜尋功能開發中...')),
    );
  }
}
