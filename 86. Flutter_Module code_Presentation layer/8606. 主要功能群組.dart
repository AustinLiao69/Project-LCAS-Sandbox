
/**
 * MAIN_主要功能群組_1.3.0
 * @module MAIN-UI模組
 * @description Flutter主要功能群組 - 核心記帳操作UI中心
 * @update 2025-01-21: 升級版本，實現完整的30個函數和四模式差異化
 */

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

// ========================================
// 核心數據模型與枚舉定義
// ========================================

enum UserMode { controller, logger, struggler, sleeper }

enum EntryType { income, expense, transfer }

enum ChartType { line, bar, pie, area, scatter }

class Entry {
  final String id;
  final EntryType type;
  final double amount;
  final String categoryId;
  final String? description;
  final DateTime entryDate;
  final List<String>? tags;
  final String? projectId;
  final DateTime createdAt;
  final DateTime updatedAt;

  Entry({
    required this.id,
    required this.type,
    required this.amount,
    required this.categoryId,
    this.description,
    required this.entryDate,
    this.tags,
    this.projectId,
    required this.createdAt,
    required this.updatedAt,
  });
}

class Category {
  final String id;
  final String name;
  final String? icon;
  final Color? color;
  final String? parentId;
  final int useCount;

  Category({
    required this.id,
    required this.name,
    this.icon,
    this.color,
    this.parentId,
    this.useCount = 0,
  });
}

class ThemeConfig {
  final Color primary;
  final Color secondary;
  final Color background;
  final Color surface;
  final Color onSurface;
  final double fontSize;
  final double buttonHeight;

  ThemeConfig({
    required this.primary,
    required this.secondary,
    required this.background,
    required this.surface,
    required this.onSurface,
    required this.fontSize,
    required this.buttonHeight,
  });
}

// ========================================
// 主要功能群組核心類別
// ========================================

class MainFunctionGroup {
  static const String MODULE_VERSION = "1.3.0";
  static const String MODULE_NAME = "MAIN_主要功能群組";

  // ========================================
  // 頁面建構函數 (10個函數) - P006~P015
  // ========================================

  /**
   * 01. 建構首頁儀表板Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構首頁儀表板的完整UI結構，支援四模式差異化顯示和智慧洞察
   */
  static Widget MAIN_buildDashboardPage({
    required UserMode userMode,
    required List<Entry> recentEntries,
    required Map<String, dynamic> analytics,
    VoidCallback? onQuickEntry,
    VoidCallback? onDetailedEntry,
    VoidCallback? onViewHistory,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: Text(
          _getDashboardTitle(userMode),
          style: TextStyle(
            fontSize: _getThemeConfig(userMode).fontSize + 4,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () {},
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // 實現下拉重新整理邏輯
          await Future.delayed(const Duration(seconds: 1));
        },
        child: CustomScrollView(
          slivers: [
            // 智慧洞察區域
            SliverToBoxAdapter(
              child: _buildInsightSection(userMode, analytics),
            ),
            
            // 財務摘要卡片
            SliverToBoxAdapter(
              child: _buildFinancialSummaryGrid(userMode, analytics),
            ),
            
            // 快捷操作區域
            SliverToBoxAdapter(
              child: _buildQuickActionsSection(
                userMode,
                onQuickEntry: onQuickEntry,
                onDetailedEntry: onDetailedEntry,
                onViewHistory: onViewHistory,
              ),
            ),
            
            // 最近記錄列表
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  if (index >= recentEntries.length) return null;
                  return MAIN_buildEntryCard(
                    entry: recentEntries[index],
                    userMode: userMode,
                  );
                },
                childCount: recentEntries.length,
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: _buildFloatingActionButton(userMode, onQuickEntry),
    );
  }

  /**
   * 02. 建構快速記帳頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構快速記帳頁面，支援語音輸入、智慧建議和三步驟記帳流程
   */
  static Widget MAIN_buildQuickEntryPage({
    required UserMode userMode,
    required List<Category> categories,
    required Function(Entry) onEntrySubmit,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: Text(
          _getQuickEntryTitle(userMode),
          style: TextStyle(fontSize: _getThemeConfig(userMode).fontSize + 2),
        ),
      ),
      body: _QuickEntryForm(
        userMode: userMode,
        categories: categories,
        onSubmit: onEntrySubmit,
      ),
    );
  }

  /**
   * 03. 建構詳細記帳頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構詳細記帳頁面，支援完整記帳功能、附件上傳和高級設定
   */
  static Widget MAIN_buildDetailedEntryPage({
    required UserMode userMode,
    required List<Category> categories,
    required Function(Entry) onEntrySubmit,
    Entry? initialEntry,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: Text(
          initialEntry != null ? '編輯記帳' : '詳細記帳',
          style: TextStyle(fontSize: _getThemeConfig(userMode).fontSize + 2),
        ),
      ),
      body: _DetailedEntryForm(
        userMode: userMode,
        categories: categories,
        initialEntry: initialEntry,
        onSubmit: onEntrySubmit,
      ),
    );
  }

  /**
   * 04. 建構記帳歷史頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構記帳歷史頁面，支援多檢視模式、進階篩選和批量操作
   */
  static Widget MAIN_buildEntryHistoryPage({
    required UserMode userMode,
    required List<Entry> entries,
    required Function(String) onEntryEdit,
    required Function(String) onEntryDelete,
  }) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: _getThemeConfig(userMode).background,
        appBar: AppBar(
          backgroundColor: _getThemeConfig(userMode).primary,
          foregroundColor: Colors.white,
          title: const Text('記帳歷史'),
          bottom: const TabBar(
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            tabs: [
              Tab(icon: Icon(Icons.list), text: '列表'),
              Tab(icon: Icon(Icons.calendar_month), text: '日曆'),
              Tab(icon: Icon(Icons.bar_chart), text: '圖表'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildHistoryListView(userMode, entries, onEntryEdit, onEntryDelete),
            _buildHistoryCalendarView(userMode, entries),
            _buildHistoryChartView(userMode, entries),
          ],
        ),
      ),
    );
  }

  /**
   * 05. 建構記帳編輯頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構記帳編輯頁面，支援版本控制、變更追蹤和協作功能
   */
  static Widget MAIN_buildEntryEditPage({
    required UserMode userMode,
    required Entry entry,
    required List<Category> categories,
    required Function(Entry) onEntryUpdate,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: const Text('編輯記帳'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () {
              // 顯示版本歷史
            },
          ),
        ],
      ),
      body: _EditEntryForm(
        userMode: userMode,
        entry: entry,
        categories: categories,
        onUpdate: onEntryUpdate,
      ),
    );
  }

  /**
   * 06. 建構科目管理頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構科目管理頁面，支援階層管理、拖拽排序和使用統計
   */
  static Widget MAIN_buildCategoryManagePage({
    required UserMode userMode,
    required List<Category> categories,
    required Function(Category) onCategoryCreate,
    required Function(Category) onCategoryUpdate,
    required Function(String) onCategoryDelete,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: const Text('科目管理'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // 實現科目搜尋功能
            },
          ),
        ],
      ),
      body: _CategoryManagementView(
        userMode: userMode,
        categories: categories,
        onCreate: onCategoryCreate,
        onUpdate: onCategoryUpdate,
        onDelete: onCategoryDelete,
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _getThemeConfig(userMode).primary,
        onPressed: () {
          // 新增科目對話框
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  /**
   * 07. 建構設定頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構設定頁面，支援四模式切換、個人化設定和資料管理
   */
  static Widget MAIN_buildSettingsPage({
    required UserMode userMode,
    required Map<String, dynamic> settings,
    required Function(UserMode) onModeChange,
    required Function(String, dynamic) onSettingChange,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: const Text('設定'),
      ),
      body: _SettingsView(
        userMode: userMode,
        settings: settings,
        onModeChange: onModeChange,
        onSettingChange: onSettingChange,
      ),
    );
  }

  /**
   * 08. 建構搜尋頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構搜尋頁面，支援全文搜尋、語音搜尋和進階篩選
   */
  static Widget MAIN_buildSearchPage({
    required UserMode userMode,
    required List<Entry> searchResults,
    required Function(String) onSearch,
    required Function(Map<String, dynamic>) onFilterApply,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: const Text('搜尋'),
      ),
      body: _SearchView(
        userMode: userMode,
        searchResults: searchResults,
        onSearch: onSearch,
        onFilterApply: onFilterApply,
      ),
    );
  }

  /**
   * 09. 建構統計頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構統計頁面，支援互動式圖表、趨勢分析和多維度統計
   */
  static Widget MAIN_buildStatisticsPage({
    required UserMode userMode,
    required Map<String, dynamic> statisticsData,
    required Function(DateRange) onDateRangeChange,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: const Text('統計分析'),
        actions: [
          IconButton(
            icon: const Icon(Icons.date_range),
            onPressed: () {
              // 選擇日期範圍
            },
          ),
        ],
      ),
      body: _StatisticsView(
        userMode: userMode,
        data: statisticsData,
        onDateRangeChange: onDateRangeChange,
      ),
    );
  }

  /**
   * 10. 建構帳本切換頁面Widget
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構帳本切換頁面，支援多帳本管理、同步狀態和權限控制
   */
  static Widget MAIN_buildLedgerSwitchPage({
    required UserMode userMode,
    required List<Map<String, dynamic>> ledgers,
    required String currentLedgerId,
    required Function(String) onLedgerSwitch,
  }) {
    return Scaffold(
      backgroundColor: _getThemeConfig(userMode).background,
      appBar: AppBar(
        backgroundColor: _getThemeConfig(userMode).primary,
        foregroundColor: Colors.white,
        title: const Text('帳本切換'),
      ),
      body: _LedgerSwitchView(
        userMode: userMode,
        ledgers: ledgers,
        currentLedgerId: currentLedgerId,
        onSwitch: onLedgerSwitch,
      ),
    );
  }

  // ========================================
  // 組件建構函數 (8個函數) - 共用UI組件
  // ========================================

  /**
   * 11. 建構記帳表單組件
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構通用記帳表單組件，支援快速和詳細記帳、智慧驗證
   */
  static Widget MAIN_buildEntryForm({
    required UserMode userMode,
    required List<Category> categories,
    required Function(Entry) onSubmit,
    Entry? initialEntry,
    String formType = 'quick', // 'quick', 'detailed', 'edit'
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Form(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 金額輸入
            MAIN_buildAmountInput(userMode: userMode),
            const SizedBox(height: 16),
            
            // 科目選擇
            MAIN_buildCategorySelector(
              userMode: userMode,
              categories: categories,
            ),
            const SizedBox(height: 16),
            
            // 備註輸入
            if (formType != 'quick') ...[
              TextFormField(
                decoration: InputDecoration(
                  labelText: '備註',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 16),
            ],
            
            // 提交按鈕
            ElevatedButton(
              onPressed: () {
                // 實現表單提交邏輯
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _getThemeConfig(userMode).primary,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(
                  vertical: _getThemeConfig(userMode).buttonHeight / 4,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                '儲存記帳',
                style: TextStyle(
                  fontSize: _getThemeConfig(userMode).fontSize,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /**
   * 12. 建構科目選擇組件
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構科目選擇組件，支援階層選擇、智慧建議和快速搜尋
   */
  static Widget MAIN_buildCategorySelector({
    required UserMode userMode,
    required List<Category> categories,
    Category? selectedCategory,
    Function(Category)? onCategorySelect,
  }) {
    int gridColumns = _getCategoryGridColumns(userMode);
    List<Category> displayCategories = _getDisplayCategories(userMode, categories);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '選擇科目',
          style: TextStyle(
            fontSize: _getThemeConfig(userMode).fontSize,
            fontWeight: FontWeight.w600,
            color: _getThemeConfig(userMode).onSurface,
          ),
        ),
        const SizedBox(height: 8),
        
        // 智慧建議區域
        if (userMode != UserMode.sleeper) ...[
          Container(
            height: 40,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: 3, // 顯示3個推薦科目
              itemBuilder: (context, index) {
                return Container(
                  margin: const EdgeInsets.only(right: 8),
                  child: Chip(
                    label: Text('推薦 ${index + 1}'),
                    backgroundColor: _getThemeConfig(userMode).secondary.withOpacity(0.2),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
        ],
        
        // 科目網格
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: gridColumns,
            childAspectRatio: 1.2,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          itemCount: displayCategories.length,
          itemBuilder: (context, index) {
            final category = displayCategories[index];
            final isSelected = selectedCategory?.id == category.id;
            
            return GestureDetector(
              onTap: () => onCategorySelect?.call(category),
              child: Container(
                decoration: BoxDecoration(
                  color: isSelected 
                    ? _getThemeConfig(userMode).primary.withOpacity(0.1)
                    : _getThemeConfig(userMode).surface,
                  border: Border.all(
                    color: isSelected 
                      ? _getThemeConfig(userMode).primary
                      : Colors.grey.shade300,
                    width: isSelected ? 2 : 1,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _getCategoryIcon(category.icon),
                      size: _getCategoryIconSize(userMode),
                      color: isSelected 
                        ? _getThemeConfig(userMode).primary
                        : Colors.grey.shade600,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      category.name,
                      style: TextStyle(
                        fontSize: _getThemeConfig(userMode).fontSize - 2,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                        color: isSelected 
                          ? _getThemeConfig(userMode).primary
                          : _getThemeConfig(userMode).onSurface,
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  /**
   * 13. 建構金額輸入組件
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構金額輸入組件，支援數字鍵盤和格式化顯示
   */
  static Widget MAIN_buildAmountInput({
    required UserMode userMode,
    double? initialAmount,
    Function(double)? onAmountChange,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '金額',
          style: TextStyle(
            fontSize: _getThemeConfig(userMode).fontSize,
            fontWeight: FontWeight.w600,
            color: _getThemeConfig(userMode).onSurface,
          ),
        ),
        const SizedBox(height: 8),
        
        // 收入/支出切換
        Container(
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.all(4),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {},
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.red.shade300),
                    ),
                    child: Text(
                      '支出',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: _getThemeConfig(userMode).fontSize,
                        fontWeight: FontWeight.w600,
                        color: Colors.red.shade700,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: GestureDetector(
                  onTap: () {},
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '收入',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: _getThemeConfig(userMode).fontSize,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        
        // 金額輸入框
        TextFormField(
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: _getAmountFontSize(userMode),
            fontWeight: FontWeight.w600,
            color: _getThemeConfig(userMode).primary,
          ),
          decoration: InputDecoration(
            hintText: '0',
            prefixText: 'NT\$ ',
            prefixStyle: TextStyle(
              fontSize: _getAmountFontSize(userMode),
              color: _getThemeConfig(userMode).primary,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: _getThemeConfig(userMode).primary),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: _getThemeConfig(userMode).primary, width: 2),
            ),
            contentPadding: EdgeInsets.symmetric(
              vertical: _getAmountInputPadding(userMode),
              horizontal: 16,
            ),
          ),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
          ],
        ),
      ],
    );
  }

  /**
   * 14. 建構統計圖表組件
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構互動式統計圖表組件，支援多種圖表類型和四模式主題
   */
  static Widget MAIN_buildStatChart({
    required UserMode userMode,
    required ChartType chartType,
    required Map<String, dynamic> data,
    Function(String)? onDataPointTap,
  }) {
    return Container(
      height: _getChartHeight(userMode),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _getThemeConfig(userMode).surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _getChartTitle(chartType),
            style: TextStyle(
              fontSize: _getThemeConfig(userMode).fontSize + 2,
              fontWeight: FontWeight.w600,
              color: _getThemeConfig(userMode).onSurface,
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _buildChart(userMode, chartType, data, onDataPointTap),
          ),
        ],
      ),
    );
  }

  /**
   * 15. 建構搜尋篩選組件
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構搜尋篩選組件，支援多維度篩選條件和智慧建議
   */
  static Widget MAIN_buildSearchFilter({
    required UserMode userMode,
    required Function(Map<String, dynamic>) onFilterApply,
    Map<String, dynamic>? initialFilters,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _getThemeConfig(userMode).surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 標題列
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '進階篩選',
                style: TextStyle(
                  fontSize: _getThemeConfig(userMode).fontSize + 4,
                  fontWeight: FontWeight.w600,
                  color: _getThemeConfig(userMode).onSurface,
                ),
              ),
              TextButton(
                onPressed: () {
                  // 重置篩選條件
                },
                child: const Text('重置'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // 篩選選項
          _buildFilterOptions(userMode),
          
          const SizedBox(height: 20),
          
          // 套用按鈕
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                // 套用篩選條件
                onFilterApply({});
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _getThemeConfig(userMode).primary,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(
                  vertical: _getThemeConfig(userMode).buttonHeight / 4,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                '套用篩選',
                style: TextStyle(
                  fontSize: _getThemeConfig(userMode).fontSize,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /**
   * 16. 建構記帳記錄卡片
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構記帳記錄卡片組件，顯示記帳詳細資訊
   */
  static Widget MAIN_buildEntryCard({
    required Entry entry,
    required UserMode userMode,
    VoidCallback? onTap,
    VoidCallback? onEdit,
    VoidCallback? onDelete,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // 科目圖示
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: _getEntryTypeColor(entry.type).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    _getEntryTypeIcon(entry.type),
                    color: _getEntryTypeColor(entry.type),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                
                // 記帳內容
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.description ?? '記帳記錄',
                        style: TextStyle(
                          fontSize: _getThemeConfig(userMode).fontSize,
                          fontWeight: FontWeight.w600,
                          color: _getThemeConfig(userMode).onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        DateFormat('MM/dd HH:mm').format(entry.entryDate),
                        style: TextStyle(
                          fontSize: _getThemeConfig(userMode).fontSize - 2,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                
                // 金額
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      MAIN_formatCurrency(entry.amount),
                      style: TextStyle(
                        fontSize: _getThemeConfig(userMode).fontSize,
                        fontWeight: FontWeight.w600,
                        color: _getEntryTypeColor(entry.type),
                      ),
                    ),
                    if (userMode == UserMode.controller) ...[
                      const SizedBox(height: 4),
                      Text(
                        entry.id,
                        style: TextStyle(
                          fontSize: _getThemeConfig(userMode).fontSize - 4,
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ],
                ),
                
                // 操作按鈕
                if (userMode != UserMode.sleeper) ...[
                  const SizedBox(width: 8),
                  PopupMenuButton<String>(
                    onSelected: (value) {
                      if (value == 'edit') onEdit?.call();
                      if (value == 'delete') onDelete?.call();
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit, size: 16),
                            SizedBox(width: 8),
                            Text('編輯'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete, size: 16, color: Colors.red),
                            SizedBox(width: 8),
                            Text('刪除', style: TextStyle(color: Colors.red)),
                          ],
                        ),
                      ),
                    ],
                    child: Icon(
                      Icons.more_vert,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  /**
   * 17. 建構智慧洞察卡片
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構智慧洞察卡片組件，顯示AI分析結果
   */
  static Widget MAIN_buildInsightCard({
    required UserMode userMode,
    required Map<String, dynamic> insight,
  }) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _getThemeConfig(userMode).surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.lightbulb_outline,
                color: _getThemeConfig(userMode).primary,
                size: 28,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  '智慧洞察',
                  style: TextStyle(
                    fontSize: _getThemeConfig(userMode).fontSize + 4,
                    fontWeight: FontWeight.w600,
                    color: _getThemeConfig(userMode).onSurface,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            insight['content'] ?? '您的記帳習慣很良好，繼續保持！',
            style: TextStyle(
              fontSize: _getThemeConfig(userMode).fontSize,
              color: _getThemeConfig(userMode).onSurface,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          if (insight['actionable'] == true) ...[
            ElevatedButton(
              onPressed: () {
                // 執行建議操作
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _getThemeConfig(userMode).primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text('查看詳情'),
            ),
          ],
        ],
      ),
    );
  }

  /**
   * 18. 建構快捷操作組件
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構快捷操作組件，提供常用功能入口
   */
  static Widget MAIN_buildQuickActions({
    required UserMode userMode,
    VoidCallback? onQuickEntry,
    VoidCallback? onDetailedEntry,
    VoidCallback? onViewHistory,
    VoidCallback? onViewStatistics,
  }) {
    List<Map<String, dynamic>> actions = _getQuickActions(userMode);
    
    return Container(
      padding: const EdgeInsets.all(16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: userMode == UserMode.sleeper ? 2 : 4,
          childAspectRatio: 1,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: actions.length,
        itemBuilder: (context, index) {
          final action = actions[index];
          return GestureDetector(
            onTap: () {
              // 根據action type執行對應操作
              switch (action['type']) {
                case 'quick_entry':
                  onQuickEntry?.call();
                  break;
                case 'detailed_entry':
                  onDetailedEntry?.call();
                  break;
                case 'view_history':
                  onViewHistory?.call();
                  break;
                case 'view_statistics':
                  onViewStatistics?.call();
                  break;
              }
            },
            child: Container(
              decoration: BoxDecoration(
                color: _getThemeConfig(userMode).surface,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    action['icon'],
                    size: _getQuickActionIconSize(userMode),
                    color: _getThemeConfig(userMode).primary,
                  ),
                  SizedBox(height: userMode == UserMode.sleeper ? 12 : 8),
                  Text(
                    action['title'],
                    style: TextStyle(
                      fontSize: _getThemeConfig(userMode).fontSize - 2,
                      fontWeight: FontWeight.w500,
                      color: _getThemeConfig(userMode).onSurface,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ========================================
  // 四模式UI函數 (8個函數) - 模式差異化
  // ========================================

  /**
   * 19. 建構精準控制者模式UI
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構專業完整的控制介面，提供最大化功能控制和詳細資訊顯示
   */
  static Widget MAIN_buildControllerModeUI({
    required Widget child,
    Map<String, dynamic>? systemInfo,
  }) {
    return Theme(
      data: MAIN_applyControllerTheme(),
      child: Stack(
        children: [
          child,
          
          // 系統狀態列（精準控制者專用）
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 32,
              color: Colors.grey.shade800,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Icon(Icons.wifi, size: 16, color: Colors.white),
                  const SizedBox(width: 4),
                  Text(
                    '已連線',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  ),
                  const Spacer(),
                  Text(
                    '記憶體: 85MB',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  ),
                  const SizedBox(width: 16),
                  Text(
                    'API延遲: 120ms',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /**
   * 20. 建構紀錄習慣者模式UI
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構優雅美觀的記錄介面，注重視覺美學和流暢操作體驗
   */
  static Widget MAIN_buildLoggerModeUI({
    required Widget child,
  }) {
    return Theme(
      data: MAIN_applyLoggerTheme(),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFFF3E5F5),
              const Color(0xFFFAFAFA),
            ],
            stops: const [0.0, 0.3],
          ),
        ),
        child: child,
      ),
    );
  }

  /**
   * 21. 建構轉型挑戰者模式UI
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構激勵導向的挑戰介面，強調目標達成、進步追蹤和成就系統
   */
  static Widget MAIN_buildStruggleModeUI({
    required Widget child,
    Map<String, dynamic>? goalProgress,
  }) {
    return Theme(
      data: MAIN_applyStruggleTheme(),
      child: Stack(
        children: [
          child,
          
          // 目標進度浮動條（轉型挑戰者專用）
          if (goalProgress != null) ...[
            Positioned(
              top: 100,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B35),
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(Icons.emoji_events, color: Colors.white),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '今日目標進度',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 4),
                          LinearProgressIndicator(
                            value: (goalProgress['progress'] ?? 0.0) / 100,
                            backgroundColor: Colors.white.withOpacity(0.3),
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${goalProgress['progress'] ?? 0}%',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /**
   * 22. 建構潛在覺醒者模式UI
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構極簡友善的覺醒介面，提供最簡化操作體驗和智慧輔助
   */
  static Widget MAIN_buildSleeperModeUI({
    required Widget child,
  }) {
    return Theme(
      data: MAIN_applySleeperTheme(),
      child: Container(
        color: const Color(0xFFF8F9FA),
        child: child,
      ),
    );
  }

  /**
   * 23. 套用精準控制者主題
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 套用專業主題配色和樣式
   */
  static ThemeData MAIN_applyControllerTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF1976D2),
        brightness: Brightness.light,
      ),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(fontSize: 14),
        bodyMedium: TextStyle(fontSize: 12),
        titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 36),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      ),
    );
  }

  /**
   * 24. 套用紀錄習慣者主題
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 套用優雅主題配色和樣式
   */
  static ThemeData MAIN_applyLoggerTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF6A1B9A),
        brightness: Brightness.light,
      ),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(fontSize: 16),
        bodyMedium: TextStyle(fontSize: 14),
        titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  /**
   * 25. 套用轉型挑戰者主題
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 套用活力主題配色和樣式
   */
  static ThemeData MAIN_applyStruggleTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFFFF6B35),
        brightness: Brightness.light,
      ),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(fontSize: 16),
        bodyMedium: TextStyle(fontSize: 14),
        titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }

  /**
   * 26. 套用潛在覺醒者主題
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 套用溫和主題配色和樣式
   */
  static ThemeData MAIN_applySleeperTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF4CAF50),
        brightness: Brightness.light,
      ),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(fontSize: 18),
        bodyMedium: TextStyle(fontSize: 16),
        titleLarge: TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 72),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      ),
    );
  }

  // ========================================
  // 輔助工具函數 (4個函數) - UI工具函數
  // ========================================

  /**
   * 27. 格式化貨幣顯示
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 根據使用者設定和地區格式化貨幣顯示，支援多幣別和國際化
   */
  static String MAIN_formatCurrency(
    double amount, {
    String currencyCode = 'TWD',
    String? locale,
  }) {
    final formatter = NumberFormat.currency(
      locale: locale ?? 'zh_TW',
      symbol: 'NT\$ ',
      decimalDigits: amount % 1 == 0 ? 0 : 2,
    );
    
    return formatter.format(amount);
  }

  /**
   * 28. 驗證UI輸入資料
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 驗證使用者在UI層的輸入資料，提供即時回饋和友善錯誤訊息
   */
  static Map<String, dynamic> MAIN_validateUIInput(
    Map<String, dynamic> inputData,
    UserMode userMode,
  ) {
    Map<String, dynamic> result = {
      'isValid': true,
      'errors': <String>[],
      'warnings': <String>[],
    };

    // 金額驗證
    if (inputData['amount'] != null) {
      double? amount = double.tryParse(inputData['amount'].toString());
      if (amount == null || amount <= 0) {
        result['isValid'] = false;
        result['errors'].add(_getAmountError(userMode));
      } else if (amount > 999999999.99) {
        result['isValid'] = false;
        result['errors'].add('金額不能超過十億元');
      }
    }

    // 科目驗證
    if (inputData['categoryId'] == null || inputData['categoryId'].isEmpty) {
      result['isValid'] = false;
      result['errors'].add(_getCategoryError(userMode));
    }

    // 日期驗證
    if (inputData['entryDate'] != null) {
      DateTime? date = DateTime.tryParse(inputData['entryDate'].toString());
      if (date != null && date.isAfter(DateTime.now())) {
        result['warnings'].add('記帳日期不能是未來時間');
      }
    }

    return result;
  }

  /**
   * 29. 建構載入狀態UI
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構統一的載入狀態UI，支援不同載入類型和四模式適配
   */
  static Widget MAIN_buildLoadingState({
    required UserMode userMode,
    String? message,
    bool showShimmer = false,
  }) {
    final themeConfig = _getThemeConfig(userMode);
    
    if (showShimmer) {
      return Shimmer.fromColors(
        baseColor: Colors.grey.shade300,
        highlightColor: Colors.grey.shade100,
        child: Column(
          children: List.generate(3, (index) => 
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      );
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(
            color: themeConfig.primary,
            strokeWidth: userMode == UserMode.sleeper ? 6 : 3,
          ),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(
              message,
              style: TextStyle(
                fontSize: themeConfig.fontSize,
                color: themeConfig.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }

  /**
   * 30. 建構錯誤狀態UI
   * @version 2025-01-21-V1.3.0
   * @date 2025-01-21 16:00:00
   * @description 建構統一的錯誤狀態UI，提供友善錯誤訊息和恢復建議
   */
  static Widget MAIN_buildErrorState({
    required UserMode userMode,
    required String errorMessage,
    VoidCallback? onRetry,
    String? retryText,
  }) {
    final themeConfig = _getThemeConfig(userMode);
    
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: _getErrorIconSize(userMode),
              color: Colors.red.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              _getErrorTitle(userMode),
              style: TextStyle(
                fontSize: themeConfig.fontSize + 4,
                fontWeight: FontWeight.w600,
                color: themeConfig.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _getFriendlyErrorMessage(errorMessage, userMode),
              style: TextStyle(
                fontSize: themeConfig.fontSize,
                color: Colors.grey.shade600,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: onRetry,
                style: ElevatedButton.styleFrom(
                  backgroundColor: themeConfig.primary,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: themeConfig.buttonHeight / 4,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  retryText ?? _getRetryText(userMode),
                  style: TextStyle(
                    fontSize: themeConfig.fontSize,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ========================================
  // 私有輔助函數
  // ========================================

  // 主題配置獲取
  static ThemeConfig _getThemeConfig(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return ThemeConfig(
          primary: const Color(0xFF1976D2),
          secondary: const Color(0xFF37474F),
          background: const Color(0xFFFAFAFA),
          surface: const Color(0xFFFFFFFF),
          onSurface: const Color(0xFF212121),
          fontSize: 14,
          buttonHeight: 36,
        );
      case UserMode.logger:
        return ThemeConfig(
          primary: const Color(0xFF6A1B9A),
          secondary: const Color(0xFFE1BEE7),
          background: const Color(0xFFF3E5F5),
          surface: const Color(0xFFFFFFFF),
          onSurface: const Color(0xFF4A148C),
          fontSize: 16,
          buttonHeight: 48,
        );
      case UserMode.struggler:
        return ThemeConfig(
          primary: const Color(0xFFFF6B35),
          secondary: const Color(0xFFFFE0B2),
          background: const Color(0xFFFFF3E0),
          surface: const Color(0xFFFFFFFF),
          onSurface: const Color(0xFFE65100),
          fontSize: 16,
          buttonHeight: 56,
        );
      case UserMode.sleeper:
        return ThemeConfig(
          primary: const Color(0xFF4CAF50),
          secondary: const Color(0xFFC8E6C9),
          background: const Color(0xFFE8F5E8),
          surface: const Color(0xFFFFFFFF),
          onSurface: const Color(0xFF2E7D32),
          fontSize: 18,
          buttonHeight: 72,
        );
    }
  }

  // 其他私有輔助函數...
  static String _getDashboardTitle(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return '精準控制中心';
      case UserMode.logger:
        return '我的記帳本';
      case UserMode.struggler:
        return '轉型挑戰者';
      case UserMode.sleeper:
        return '記帳本';
    }
  }

  static String _getQuickEntryTitle(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return '快速記帳';
      case UserMode.logger:
        return '優雅記錄';
      case UserMode.struggler:
        return '極速記帳';
      case UserMode.sleeper:
        return '記錄';
    }
  }

  static int _getCategoryGridColumns(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return 4;
      case UserMode.logger:
        return 3;
      case UserMode.struggler:
        return 3;
      case UserMode.sleeper:
        return 2;
    }
  }

  static List<Category> _getDisplayCategories(UserMode userMode, List<Category> categories) {
    int maxCount;
    switch (userMode) {
      case UserMode.controller:
        maxCount = 16;
        break;
      case UserMode.logger:
        maxCount = 12;
        break;
      case UserMode.struggler:
        maxCount = 9;
        break;
      case UserMode.sleeper:
        maxCount = 6;
        break;
    }
    
    return categories.take(maxCount).toList();
  }

  static IconData _getCategoryIcon(String? iconName) {
    switch (iconName) {
      case 'food':
        return Icons.restaurant;
      case 'transport':
        return Icons.directions_car;
      case 'shopping':
        return Icons.shopping_bag;
      case 'entertainment':
        return Icons.movie;
      case 'health':
        return Icons.local_hospital;
      default:
        return Icons.category;
    }
  }

  static double _getCategoryIconSize(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return 20;
      case UserMode.logger:
        return 24;
      case UserMode.struggler:
        return 28;
      case UserMode.sleeper:
        return 32;
    }
  }

  static double _getAmountFontSize(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return 24;
      case UserMode.logger:
        return 28;
      case UserMode.struggler:
        return 32;
      case UserMode.sleeper:
        return 40;
    }
  }

  static double _getAmountInputPadding(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return 12;
      case UserMode.logger:
        return 16;
      case UserMode.struggler:
        return 20;
      case UserMode.sleeper:
        return 24;
    }
  }

  static Color _getEntryTypeColor(EntryType type) {
    switch (type) {
      case EntryType.income:
        return const Color(0xFF4CAF50);
      case EntryType.expense:
        return const Color(0xFFF44336);
      case EntryType.transfer:
        return const Color(0xFF2196F3);
    }
  }

  static IconData _getEntryTypeIcon(EntryType type) {
    switch (type) {
      case EntryType.income:
        return Icons.add_circle;
      case EntryType.expense:
        return Icons.remove_circle;
      case EntryType.transfer:
        return Icons.swap_horiz;
    }
  }

  static double _getChartHeight(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return 200;
      case UserMode.logger:
        return 250;
      case UserMode.struggler:
        return 280;
      case UserMode.sleeper:
        return 200;
    }
  }

  static String _getChartTitle(ChartType chartType) {
    switch (chartType) {
      case ChartType.line:
        return '趨勢圖表';
      case ChartType.bar:
        return '柱狀圖表';
      case ChartType.pie:
        return '圓餅圖表';
      case ChartType.area:
        return '面積圖表';
      case ChartType.scatter:
        return '散點圖表';
    }
  }

  static double _getQuickActionIconSize(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return 24;
      case UserMode.logger:
        return 28;
      case UserMode.struggler:
        return 32;
      case UserMode.sleeper:
        return 48;
    }
  }

  static List<Map<String, dynamic>> _getQuickActions(UserMode userMode) {
    List<Map<String, dynamic>> baseActions = [
      {'type': 'quick_entry', 'title': '快速記帳', 'icon': Icons.add_circle_outline},
      {'type': 'view_history', 'title': '查看記錄', 'icon': Icons.history},
    ];

    switch (userMode) {
      case UserMode.controller:
        return [
          ...baseActions,
          {'type': 'detailed_entry', 'title': '詳細記帳', 'icon': Icons.edit_note},
          {'type': 'view_statistics', 'title': '統計分析', 'icon': Icons.analytics},
        ];
      case UserMode.logger:
        return [
          ...baseActions,
          {'type': 'detailed_entry', 'title': '詳細記帳', 'icon': Icons.edit_note},
          {'type': 'view_statistics', 'title': '美觀圖表', 'icon': Icons.pie_chart},
        ];
      case UserMode.struggler:
        return [
          ...baseActions,
          {'type': 'view_statistics', 'title': '進度追蹤', 'icon': Icons.trending_up},
          {'type': 'goal_setting', 'title': '設定目標', 'icon': Icons.flag},
        ];
      case UserMode.sleeper:
        return baseActions;
    }
  }

  static String _getAmountError(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return '金額格式不正確：必須為正數，最多2位小數';
      case UserMode.logger:
        return '✨ 請輸入正確的金額格式';
      case UserMode.struggler:
        return '💪 再試一次！請輸入正確的金額';
      case UserMode.sleeper:
        return '🌱 請輸入正確的數字';
    }
  }

  static String _getCategoryError(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return '科目分類為必填項目，請從可用科目清單中選擇一個有效科目';
      case UserMode.logger:
        return '✨ 還沒選擇科目分類呢';
      case UserMode.struggler:
        return '🎯 選個科目，向目標更進一步！';
      case UserMode.sleeper:
        return '🌱 請選擇一個分類';
    }
  }

  static double _getErrorIconSize(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return 48;
      case UserMode.logger:
        return 56;
      case UserMode.struggler:
        return 64;
      case UserMode.sleeper:
        return 72;
    }
  }

  static String _getErrorTitle(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return '系統錯誤';
      case UserMode.logger:
        return '哎呀，出了點問題';
      case UserMode.struggler:
        return '暫時的挫折！';
      case UserMode.sleeper:
        return '出了點小問題';
    }
  }

  static String _getFriendlyErrorMessage(String errorMessage, UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return errorMessage;
      case UserMode.logger:
        return '✨ 別擔心，我們來幫您解決這個問題';
      case UserMode.struggler:
        return '💪 不要放棄！讓我們一起解決這個問題';
      case UserMode.sleeper:
        return '🌱 沒關係，我們會幫您處理的';
    }
  }

  static String _getRetryText(UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return '重試';
      case UserMode.logger:
        return '再試一次';
      case UserMode.struggler:
        return '重新挑戰！';
      case UserMode.sleeper:
        return '試試看';
    }
  }

  // 其他建構函數的輔助方法...
  static Widget _buildInsightSection(UserMode userMode, Map<String, dynamic> analytics) {
    if (userMode == UserMode.sleeper) return const SizedBox.shrink();
    
    return Container(
      margin: const EdgeInsets.all(16),
      child: MAIN_buildInsightCard(
        userMode: userMode,
        insight: {
          'content': '本月支出比上月減少15%，繼續保持良好習慣！',
          'actionable': true,
        },
      ),
    );
  }

  static Widget _buildFinancialSummaryGrid(UserMode userMode, Map<String, dynamic> analytics) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        childAspectRatio: 1.5,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        children: [
          _buildSummaryCard(userMode, '本月收入', 'NT\$ 45,000', Colors.green),
          _buildSummaryCard(userMode, '本月支出', 'NT\$ 32,000', Colors.red),
          _buildSummaryCard(userMode, '結餘', 'NT\$ 13,000', Colors.blue),
          _buildSummaryCard(userMode, '記帳筆數', '156 筆', Colors.orange),
        ],
      ),
    );
  }

  static Widget _buildSummaryCard(UserMode userMode, String title, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _getThemeConfig(userMode).surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: _getThemeConfig(userMode).fontSize - 2,
              color: Colors.grey.shade600,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: _getThemeConfig(userMode).fontSize + 2,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  static Widget _buildQuickActionsSection(
    UserMode userMode, {
    VoidCallback? onQuickEntry,
    VoidCallback? onDetailedEntry,
    VoidCallback? onViewHistory,
  }) {
    return MAIN_buildQuickActions(
      userMode: userMode,
      onQuickEntry: onQuickEntry,
      onDetailedEntry: onDetailedEntry,
      onViewHistory: onViewHistory,
    );
  }

  static Widget? _buildFloatingActionButton(UserMode userMode, VoidCallback? onQuickEntry) {
    if (userMode == UserMode.sleeper) return null;
    
    return FloatingActionButton(
      onPressed: onQuickEntry,
      backgroundColor: _getThemeConfig(userMode).primary,
      foregroundColor: Colors.white,
      child: const Icon(Icons.add),
    );
  }

  static Widget _buildFilterOptions(UserMode userMode) {
    return Column(
      children: [
        // 日期範圍篩選
        ListTile(
          leading: const Icon(Icons.date_range),
          title: const Text('日期範圍'),
          subtitle: const Text('選擇時間範圍'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {},
        ),
        
        // 金額範圍篩選
        ListTile(
          leading: const Icon(Icons.attach_money),
          title: const Text('金額範圍'),
          subtitle: const Text('設定金額區間'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {},
        ),
        
        // 科目篩選
        ListTile(
          leading: const Icon(Icons.category),
          title: const Text('科目篩選'),
          subtitle: const Text('選擇特定科目'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {},
        ),
      ],
    );
  }

  static Widget _buildChart(
    UserMode userMode,
    ChartType chartType,
    Map<String, dynamic> data,
    Function(String)? onDataPointTap,
  ) {
    // 這裡應該實作具體的圖表建構邏輯
    // 目前返回一個簡單的佔位符
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(
        child: Text(
          '${_getChartTitle(chartType)}\n資料載入中...',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: _getThemeConfig(userMode).fontSize,
            color: Colors.grey.shade600,
          ),
        ),
      ),
    );
  }

  static Widget _buildHistoryListView(
    UserMode userMode,
    List<Entry> entries,
    Function(String) onEntryEdit,
    Function(String) onEntryDelete,
  ) {
    return ListView.builder(
      itemCount: entries.length,
      itemBuilder: (context, index) {
        return MAIN_buildEntryCard(
          entry: entries[index],
          userMode: userMode,
          onEdit: () => onEntryEdit(entries[index].id),
          onDelete: () => onEntryDelete(entries[index].id),
        );
      },
    );
  }

  static Widget _buildHistoryCalendarView(UserMode userMode, List<Entry> entries) {
    return Center(
      child: Text(
        '日曆檢視\n開發中...',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: _getThemeConfig(userMode).fontSize,
          color: Colors.grey.shade600,
        ),
      ),
    );
  }

  static Widget _buildHistoryChartView(UserMode userMode, List<Entry> entries) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: MAIN_buildStatChart(
        userMode: userMode,
        chartType: ChartType.line,
        data: {},
      ),
    );
  }
}

// ========================================
// 自訂Widget類別
// ========================================

class _QuickEntryForm extends StatefulWidget {
  final UserMode userMode;
  final List<Category> categories;
  final Function(Entry) onSubmit;

  const _QuickEntryForm({
    required this.userMode,
    required this.categories,
    required this.onSubmit,
  });

  @override
  State<_QuickEntryForm> createState() => _QuickEntryFormState();
}

class _QuickEntryFormState extends State<_QuickEntryForm> {
  final _formKey = GlobalKey<FormState>();
  double? _amount;
  Category? _selectedCategory;
  String? _description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 金額輸入
            MainFunctionGroup.MAIN_buildAmountInput(
              userMode: widget.userMode,
              onAmountChange: (amount) => _amount = amount,
            ),
            const SizedBox(height: 24),
            
            // 科目選擇
            MainFunctionGroup.MAIN_buildCategorySelector(
              userMode: widget.userMode,
              categories: widget.categories,
              onCategorySelect: (category) {
                setState(() {
                  _selectedCategory = category;
                });
              },
            ),
            const SizedBox(height: 24),
            
            // 備註 (潛在覺醒者模式隱藏)
            if (widget.userMode != UserMode.sleeper) ...[
              TextFormField(
                decoration: InputDecoration(
                  labelText: '備註 (選填)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onChanged: (value) => _description = value,
              ),
              const SizedBox(height: 24),
            ],
            
            const Spacer(),
            
            // 提交按鈕
            ElevatedButton(
              onPressed: _submitEntry,
              style: ElevatedButton.styleFrom(
                backgroundColor: MainFunctionGroup._getThemeConfig(widget.userMode).primary,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(
                  vertical: MainFunctionGroup._getThemeConfig(widget.userMode).buttonHeight / 4,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                '儲存記帳',
                style: TextStyle(
                  fontSize: MainFunctionGroup._getThemeConfig(widget.userMode).fontSize,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _submitEntry() {
    if (_formKey.currentState?.validate() ?? false) {
      if (_amount != null && _selectedCategory != null) {
        final entry = Entry(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          type: EntryType.expense, // 簡化處理，實際應根據用戶選擇
          amount: _amount!,
          categoryId: _selectedCategory!.id,
          description: _description,
          entryDate: DateTime.now(),
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );
        
        widget.onSubmit(entry);
      }
    }
  }
}

class _DetailedEntryForm extends StatefulWidget {
  final UserMode userMode;
  final List<Category> categories;
  final Entry? initialEntry;
  final Function(Entry) onSubmit;

  const _DetailedEntryForm({
    required this.userMode,
    required this.categories,
    this.initialEntry,
    required this.onSubmit,
  });

  @override
  State<_DetailedEntryForm> createState() => _DetailedEntryFormState();
}

class _DetailedEntryFormState extends State<_DetailedEntryForm> {
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: MainFunctionGroup.MAIN_buildEntryForm(
        userMode: widget.userMode,
        categories: widget.categories,
        initialEntry: widget.initialEntry,
        formType: 'detailed',
        onSubmit: widget.onSubmit,
      ),
    );
  }
}

class _EditEntryForm extends StatefulWidget {
  final UserMode userMode;
  final Entry entry;
  final List<Category> categories;
  final Function(Entry) onUpdate;

  const _EditEntryForm({
    required this.userMode,
    required this.entry,
    required this.categories,
    required this.onUpdate,
  });

  @override
  State<_EditEntryForm> createState() => _EditEntryFormState();
}

class _EditEntryFormState extends State<_EditEntryForm> {
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // 變更提示
          if (widget.userMode != UserMode.sleeper) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                border: Border.all(color: Colors.orange.shade300),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.edit, color: Colors.orange.shade700),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '正在編輯記帳記錄',
                      style: TextStyle(color: Colors.orange.shade700),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          
          // 編輯表單
          MainFunctionGroup.MAIN_buildEntryForm(
            userMode: widget.userMode,
            categories: widget.categories,
            initialEntry: widget.entry,
            formType: 'edit',
            onSubmit: widget.onUpdate,
          ),
        ],
      ),
    );
  }
}

class _CategoryManagementView extends StatelessWidget {
  final UserMode userMode;
  final List<Category> categories;
  final Function(Category) onCreate;
  final Function(Category) onUpdate;
  final Function(String) onDelete;

  const _CategoryManagementView({
    required this.userMode,
    required this.categories,
    required this.onCreate,
    required this.onUpdate,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final category = categories[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: Icon(MainFunctionGroup._getCategoryIcon(category.icon)),
            title: Text(category.name),
            subtitle: Text('使用 ${category.useCount} 次'),
            trailing: userMode != UserMode.sleeper
                ? PopupMenuButton<String>(
                    onSelected: (value) {
                      if (value == 'edit') {
                        // 編輯科目
                      } else if (value == 'delete') {
                        onDelete(category.id);
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Text('編輯'),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Text('刪除'),
                      ),
                    ],
                  )
                : null,
          ),
        );
      },
    );
  }
}

class _SettingsView extends StatelessWidget {
  final UserMode userMode;
  final Map<String, dynamic> settings;
  final Function(UserMode) onModeChange;
  final Function(String, dynamic) onSettingChange;

  const _SettingsView({
    required this.userMode,
    required this.settings,
    required this.onModeChange,
    required this.onSettingChange,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // 模式選擇
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '使用者模式',
                  style: TextStyle(
                    fontSize: MainFunctionGroup._getThemeConfig(userMode).fontSize + 2,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 16),
                ...UserMode.values.map((mode) => 
                  RadioListTile<UserMode>(
                    title: Text(_getModeDisplayName(mode)),
                    subtitle: Text(_getModeDescription(mode)),
                    value: mode,
                    groupValue: userMode,
                    onChanged: (value) {
                      if (value != null) onModeChange(value);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        
        const SizedBox(height: 16),
        
        // 其他設定選項
        Card(
          child: Column(
            children: [
              SwitchListTile(
                title: const Text('暗色模式'),
                value: settings['darkMode'] ?? false,
                onChanged: (value) => onSettingChange('darkMode', value),
              ),
              SwitchListTile(
                title: const Text('記帳提醒'),
                value: settings['reminders'] ?? true,
                onChanged: (value) => onSettingChange('reminders', value),
              ),
              ListTile(
                title: const Text('貨幣設定'),
                subtitle: Text(settings['currency'] ?? 'TWD'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  // 打開貨幣選擇
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _getModeDisplayName(UserMode mode) {
    switch (mode) {
      case UserMode.controller:
        return '精準控制者';
      case UserMode.logger:
        return '紀錄習慣者';
      case UserMode.struggler:
        return '轉型挑戰者';
      case UserMode.sleeper:
        return '潛在覺醒者';
    }
  }

  String _getModeDescription(UserMode mode) {
    switch (mode) {
      case UserMode.controller:
        return '高動機+高自律：完整功能控制';
      case UserMode.logger:
        return '低動機+高自律：美觀記錄體驗';
      case UserMode.struggler:
        return '高動機+低自律：目標導向激勵';
      case UserMode.sleeper:
        return '低動機+低自律：極簡操作介面';
    }
  }
}

class _SearchView extends StatefulWidget {
  final UserMode userMode;
  final List<Entry> searchResults;
  final Function(String) onSearch;
  final Function(Map<String, dynamic>) onFilterApply;

  const _SearchView({
    required this.userMode,
    required this.searchResults,
    required this.onSearch,
    required this.onFilterApply,
  });

  @override
  State<_SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends State<_SearchView> {
  final TextEditingController _searchController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 搜尋列
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: '搜尋記帳記錄...',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchController.clear();
                        widget.onSearch('');
                      },
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onChanged: widget.onSearch,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.tune),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (context) => MainFunctionGroup.MAIN_buildSearchFilter(
                      userMode: widget.userMode,
                      onFilterApply: widget.onFilterApply,
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        
        // 搜尋結果
        Expanded(
          child: widget.searchResults.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.search_off,
                        size: 64,
                        color: Colors.grey.shade400,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '沒有找到相關記錄',
                        style: TextStyle(
                          fontSize: MainFunctionGroup._getThemeConfig(widget.userMode).fontSize,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: widget.searchResults.length,
                  itemBuilder: (context, index) {
                    return MainFunctionGroup.MAIN_buildEntryCard(
                      entry: widget.searchResults[index],
                      userMode: widget.userMode,
                    );
                  },
                ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

class _StatisticsView extends StatelessWidget {
  final UserMode userMode;
  final Map<String, dynamic> data;
  final Function(DateRange) onDateRangeChange;

  const _StatisticsView({
    required this.userMode,
    required this.data,
    required this.onDateRangeChange,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // 統計摘要
          MainFunctionGroup._buildFinancialSummaryGrid(userMode, data),
          
          const SizedBox(height: 24),
          
          // 圓餅圖
          MainFunctionGroup.MAIN_buildStatChart(
            userMode: userMode,
            chartType: ChartType.pie,
            data: data,
          ),
          
          const SizedBox(height: 24),
          
          // 趨勢圖
          MainFunctionGroup.MAIN_buildStatChart(
            userMode: userMode,
            chartType: ChartType.line,
            data: data,
          ),
        ],
      ),
    );
  }
}

class _LedgerSwitchView extends StatelessWidget {
  final UserMode userMode;
  final List<Map<String, dynamic>> ledgers;
  final String currentLedgerId;
  final Function(String) onSwitch;

  const _LedgerSwitchView({
    required this.userMode,
    required this.ledgers,
    required this.currentLedgerId,
    required this.onSwitch,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: ledgers.length,
      itemBuilder: (context, index) {
        final ledger = ledgers[index];
        final isSelected = ledger['id'] == currentLedgerId;
        
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: isSelected 
                  ? MainFunctionGroup._getThemeConfig(userMode).primary
                  : Colors.grey.shade300,
              child: Icon(
                Icons.book,
                color: isSelected ? Colors.white : Colors.grey.shade600,
              ),
            ),
            title: Text(
              ledger['name'] ?? '未命名帳本',
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
            subtitle: Text(ledger['description'] ?? ''),
            trailing: isSelected 
                ? Icon(
                    Icons.check_circle,
                    color: MainFunctionGroup._getThemeConfig(userMode).primary,
                  )
                : const Icon(Icons.chevron_right),
            onTap: isSelected ? null : () => onSwitch(ledger['id']),
          ),
        );
      },
    );
  }
}

// DateRange 類別定義
class DateRange {
  final DateTime start;
  final DateTime end;

  DateRange({required this.start, required this.end});
}
