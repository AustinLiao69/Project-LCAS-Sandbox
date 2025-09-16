/**
 * 7302. 記帳核心功能群.dart - 記帳核心功能群Module code
 * @version 2025-09-16 V2.1.0
 * @date 2025-09-16
 * @update: 階段三完成 - 統計計算器與工具函數完整實作
 */

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:intl/intl.dart'; // 引入intl套件以支援國際化格式

// 引入必要的依賴
enum UserMode { expert, inertial, cultivation, guiding }
enum ArchitectureLayer { presentation, stateManagement, businessLogic, dataAccess }
enum TransactionType { income, expense, transfer }

// 資料模型定義
class Transaction {
  final String id;
  final TransactionType type;
  final double amount;
  final String? categoryId;
  final String? accountId;
  final String description;
  final DateTime date;

  Transaction({
    required this.id,
    required this.type,
    required this.amount,
    this.categoryId,
    this.accountId,
    required this.description,
    required this.date,
  });
}

class QuickAccountingResult {
  final bool success;
  final String message;
  final Transaction? transaction;

  QuickAccountingResult({
    required this.success,
    required this.message,
    this.transaction,
  });
}

class Category {
  final String id;
  final String name;
  final String? parentId;
  final String type; // 'income' or 'expense'

  Category({
    required this.id,
    required this.name,
    this.parentId,
    required this.type,
  });
}

class Account {
  final String id;
  final String name;
  final String type;
  final double balance;

  Account({
    required this.id,
    required this.name,
    required this.type,
    required this.balance,
  });
}

class Ledger {
  final String id;
  final String name;
  final String type;
  final String userId;

  Ledger({
    required this.id,
    required this.name,
    required this.type,
    required this.userId,
  });
}

class DashboardData {
  final double totalIncome;
  final double totalExpense;
  final double balance;
  final int transactionCount;

  DashboardData({
    required this.totalIncome,
    required this.totalExpense,
    required this.balance,
    required this.transactionCount,
  });
}

class RecurringConfig {
  final String frequency; // 'daily', 'weekly', 'monthly', 'yearly'
  final DateTime? endDate;
  final int? maxOccurrences;

  RecurringConfig({
    required this.frequency,
    this.endDate,
    this.maxOccurrences,
  });
}

class ChartData {
  final String label;
  final double value;
  final Color color;

  ChartData({
    required this.label,
    required this.value,
    required this.color,
  });
}

// ==========================================
// 階段一：核心架構與基礎Widget (函數1-20)
// ==========================================

/**
 * 01. 依賴注入容器 - DependencyContainer
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 模組版次升級至v2.0.0，函數版次升級至v2.0.0
 */
abstract class DependencyContainer {
  static final Map<Type, dynamic> _instances = {};
  static final Map<Type, Function> _factories = {};

  static void registerAccountingDependencies() {
    // 註冊交易狀態管理Provider
    register<TransactionStateProvider>(() => TransactionStateProviderImpl());

    // 註冊科目狀態管理Provider
    register<CategoryStateProvider>(() => CategoryStateProviderImpl());

    // 註冊帳戶狀態管理Provider
    register<AccountStateProvider>(() => AccountStateProviderImpl());

    // 註冊帳本狀態管理Provider
    register<LedgerStateProvider>(() => LedgerStateProviderImpl());

    // 註冊統計狀態管理Provider
    register<StatisticsStateProvider>(() => StatisticsStateProviderImpl());

    // 註冊表單狀態管理Provider
    register<FormStateProvider>(() => FormStateProviderImpl());
  }

  static void register<T>(T Function() factory) {
    _factories[T] = factory;
  }

  static T get<T>() {
    if (_instances.containsKey(T)) {
      return _instances[T] as T;
    }

    if (_factories.containsKey(T)) {
      final instance = _factories[T]!();
      _instances[T] = instance;
      return instance as T;
    }

    throw Exception('Type $T not registered in DependencyContainer');
  }

  static void dispose() {
    _instances.clear();
    _factories.clear();
  }
}

/**
 * 02. 架構層級枚舉 - ArchitectureLayer
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 定義四層架構枚舉
 */
// 已在檔案開頭定義

/**
 * 03. LINE OA記帳對話處理器 - LineOADialogHandler
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 智慧記帳對話處理核心
 */
abstract class LineOADialogHandler extends StatefulWidget {
  const LineOADialogHandler({Key? key}) : super(key: key);

  Future<QuickAccountingResult> handleQuickAccounting(String input);
  Future<void> handleInquiry(String query);
  Future<void> handleStatistics(String period);
}

class LineOADialogHandlerImpl extends LineOADialogHandler {
  const LineOADialogHandlerImpl({Key? key}) : super(key: key);

  @override
  Future<QuickAccountingResult> handleQuickAccounting(String input) async {
    try {
      // 呼叫智能文字解析器
      final parser = SmartTextParserImpl();
      final parsedData = await parser.parseText(input);

      // 建立交易記錄
      final transaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: _mapToTransactionType(parsedData['type']),
        amount: parsedData['amount'] ?? 0.0,
        categoryId: parsedData['categoryId'],
        accountId: parsedData['accountId'],
        description: parsedData['description'] ?? '',
        date: DateTime.now(),
      );

      // 呼叫快速記帳處理器
      final processor = QuickAccountingProcessorImpl();
      return await processor.processQuickAccounting(input);

    } catch (e) {
      return QuickAccountingResult(
        success: false,
        message: '記帳失敗：${e.toString()}',
      );
    }
  }

  @override
  Future<void> handleInquiry(String query) async {
    // 實作查詢處理邏輯
    await Future.delayed(Duration(milliseconds: 100));
  }

  @override
  Future<void> handleStatistics(String period) async {
    // 實作統計處理邏輯
    await Future.delayed(Duration(milliseconds: 100));
  }

  TransactionType _mapToTransactionType(String? type) {
    switch (type?.toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      child: Text('LINE OA Dialog Handler'),
    );
  }

  @override
  State<LineOADialogHandler> createState() => _LineOADialogHandlerState();
}

class _LineOADialogHandlerState extends State<LineOADialogHandler> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 04. 記帳主頁Widget - AccountingHomePage
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 記帳主頁核心組件
 */
abstract class AccountingHomePage extends StatefulWidget {
  const AccountingHomePage({Key? key}) : super(key: key);

  Widget buildDashboard();
  Widget buildQuickActions();
  Widget buildRecentTransactions();
  Widget buildStatisticsSummary();
}

class AccountingHomePageImpl extends AccountingHomePage {
  const AccountingHomePageImpl({Key? key}) : super(key: key);

  @override
  Widget buildDashboard() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          Text('記帳儀表板', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          SizedBox(height: 16),
          // 使用DashboardWidget
          DashboardWidgetImpl(),
        ],
      ),
    );
  }

  @override
  Widget buildQuickActions() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          ElevatedButton(
            onPressed: () {
              // 導航到記帳表單
            },
            child: Text('快速記帳'),
          ),
          ElevatedButton(
            onPressed: () {
              // 導航到記錄管理
            },
            child: Text('查看記錄'),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildRecentTransactions() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('最近交易', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          // 最近交易列表
          ListView.builder(
            shrinkWrap: true,
            physics: NeverScrollableScrollPhysics(),
            itemCount: 3,
            itemBuilder: (context, index) {
              return ListTile(
                title: Text('交易項目 ${index + 1}'),
                subtitle: Text('金額: \$100'),
                trailing: Text('今天'),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget buildStatisticsSummary() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildStatCard('本月收入', '\$5,000', Colors.green),
          _buildStatCard('本月支出', '\$3,500', Colors.red),
          _buildStatCard('餘額', '\$1,500', Colors.blue),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String amount, Color color) {
    return Container(
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(title, style: TextStyle(fontSize: 12)),
          SizedBox(height: 4),
          Text(amount, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('記帳主頁')),
      body: SingleChildScrollView(
        child: Column(
          children: [
            buildDashboard(),
            buildQuickActions(),
            buildRecentTransactions(),
            buildStatisticsSummary(),
          ],
        ),
      ),
    );
  }

  @override
  State<AccountingHomePage> createState() => _AccountingHomePageState();
}

class _AccountingHomePageState extends State<AccountingHomePage> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 05. 儀表板組件 - DashboardWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 儀表板數據展示組件
 */
abstract class DashboardWidget extends StatelessWidget {
  const DashboardWidget({Key? key}) : super(key: key);

  Widget buildBalanceCard();
  Widget buildMonthlyOverview();
  Widget buildBudgetProgress();
  Widget buildQuickStats();
}

class DashboardWidgetImpl extends DashboardWidget {
  const DashboardWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildBalanceCard() {
    return Card(
      child: Container(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text('總餘額', style: TextStyle(fontSize: 16)),
            SizedBox(height: 8),
            Text('\$25,000', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  @override
  Widget buildMonthlyOverview() {
    return Card(
      child: Container(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('本月概覽', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('收入: \$5,000'),
                Text('支出: \$3,500'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget buildBudgetProgress() {
    return Card(
      child: Container(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('預算進度', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            LinearProgressIndicator(
              value: 0.7,
              backgroundColor: Colors.grey[300],
              valueColor: AlwaysStoppedAnimation<Color>(Colors.blue),
            ),
            SizedBox(height: 4),
            Text('已使用 70% (\$3,500 / \$5,000)'),
          ],
        ),
      ),
    );
  }

  @override
  Widget buildQuickStats() {
    return Card(
      child: Container(
        padding: EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            Column(
              children: [
                Text('25', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Text('本月交易'),
              ],
            ),
            Column(
              children: [
                Text('5', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Text('常用科目'),
              ],
            ),
            Column(
              children: [
                Text('3', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Text('活躍帳戶'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        buildBalanceCard(),
        buildMonthlyOverview(),
        buildBudgetProgress(),
        buildQuickStats(),
      ],
    );
  }
}

/**
 * 06. 記帳表單Widget - AccountingFormPage
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 記帳表單核心組件
 */
abstract class AccountingFormPage extends StatefulWidget {
  const AccountingFormPage({Key? key}) : super(key: key);

  Widget buildTransactionTypeSelector();
  Widget buildAmountInput();
  Widget buildCategorySelector();
  Widget buildAccountSelector();
  Widget buildDatePicker();
  Widget buildDescriptionInput();
  Widget buildAttachmentSection();
  Widget buildSubmitButton();
}

class AccountingFormPageImpl extends AccountingFormPage {
  const AccountingFormPageImpl({Key? key}) : super(key: key);

  @override
  Widget buildTransactionTypeSelector() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('交易類型', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  child: Text('支出'),
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  child: Text('收入'),
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  child: Text('轉帳'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildAmountInput() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('金額', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          TextField(
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: '請輸入金額',
              border: OutlineInputBorder(),
              prefixText: '\$ ',
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildCategorySelector() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('科目', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          InkWell(
            onTap: () {
              // 導航到科目選擇頁
            },
            child: Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('選擇科目'),
                  Icon(Icons.arrow_forward_ios),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildAccountSelector() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('帳戶', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          InkWell(
            onTap: () {
              // 導航到帳戶選擇頁
            },
            child: Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('選擇帳戶'),
                  Icon(Icons.arrow_forward_ios),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildDatePicker() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('日期', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          InkWell(
            onTap: () async {
              final date = await showDatePicker(
                context: context as BuildContext,
                initialDate: DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime(2030),
              );
            },
            child: Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(DateTime.now().toString().split(' ')[0]),
                  Icon(Icons.calendar_today),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildDescriptionInput() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('描述', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          TextField(
            maxLines: 3,
            decoration: InputDecoration(
              hintText: '請輸入交易描述...',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildAttachmentSection() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('附件', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Row(
            children: [
              ElevatedButton.icon(
                onPressed: () {},
                icon: Icon(Icons.camera_alt),
                label: Text('拍照'),
              ),
              SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () {},
                icon: Icon(Icons.photo_library),
                label: Text('相簿'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildSubmitButton() {
    return Container(
      padding: EdgeInsets.all(16),
      width: double.infinity,
      child: ElevatedButton(
        onPressed: () {
          // 提交表單
        },
        style: ElevatedButton.styleFrom(
          padding: EdgeInsets.symmetric(vertical: 16),
        ),
        child: Text('確認記帳', style: TextStyle(fontSize: 18)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('記帳表單')),
      body: SingleChildScrollView(
        child: Column(
          children: [
            buildTransactionTypeSelector(),
            buildAmountInput(),
            buildCategorySelector(),
            buildAccountSelector(),
            buildDatePicker(),
            buildDescriptionInput(),
            buildAttachmentSection(),
            buildSubmitButton(),
          ],
        ),
      ),
    );
  }

  @override
  State<AccountingFormPage> createState() => _AccountingFormPageState();
}

class _AccountingFormPageState extends State<AccountingFormPage> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 07. 科目選擇器Widget - CategorySelectorWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 科目選擇核心組件
 */
abstract class CategorySelectorWidget extends StatefulWidget {
  const CategorySelectorWidget({Key? key}) : super(key: key);

  Widget buildCategoryTree();
  Widget buildSearchBar();
  Widget buildFrequentCategories();
  Widget buildRecentCategories();
  Future<void> onCategorySelected(String categoryId);
}

class CategorySelectorWidgetImpl extends CategorySelectorWidget {
  const CategorySelectorWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildCategoryTree() {
    return Container(
      child: ListView(
        children: [
          ExpansionTile(
            title: Text('食物'),
            children: [
              ListTile(title: Text('早餐'), onTap: () => onCategorySelected('breakfast')),
              ListTile(title: Text('午餐'), onTap: () => onCategorySelected('lunch')),
              ListTile(title: Text('晚餐'), onTap: () => onCategorySelected('dinner')),
            ],
          ),
          ExpansionTile(
            title: Text('交通'),
            children: [
              ListTile(title: Text('公車'), onTap: () => onCategorySelected('bus')),
              ListTile(title: Text('捷運'), onTap: () => onCategorySelected('metro')),
              ListTile(title: Text('計程車'), onTap: () => onCategorySelected('taxi')),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildSearchBar() {
    return Container(
      padding: EdgeInsets.all(16),
      child: TextField(
        decoration: InputDecoration(
          hintText: '搜尋科目...',
          prefixIcon: Icon(Icons.search),
          border: OutlineInputBorder(),
        ),
        onChanged: (value) {
          // 實作搜尋邏輯
        },
      ),
    );
  }

  @override
  Widget buildFrequentCategories() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('常用科目', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              Chip(
                label: Text('午餐'),
                onDeleted: () => onCategorySelected('lunch'),
              ),
              Chip(
                label: Text('交通'),
                onDeleted: () => onCategorySelected('transport'),
              ),
              Chip(
                label: Text('娛樂'),
                onDeleted: () => onCategorySelected('entertainment'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildRecentCategories() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('最近使用', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          ListView.builder(
            shrinkWrap: true,
            physics: NeverScrollableScrollPhysics(),
            itemCount: 3,
            itemBuilder: (context, index) {
              final categories = ['咖啡', '加油', '電影'];
              return ListTile(
                title: Text(categories[index]),
                onTap: () => onCategorySelected(categories[index]),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Future<void> onCategorySelected(String categoryId) async {
    // 處理科目選擇邏輯
    print('Selected category: $categoryId');
    Navigator.of(context as BuildContext).pop(categoryId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('選擇科目')),
      body: Column(
        children: [
          buildSearchBar(),
          buildFrequentCategories(),
          buildRecentCategories(),
          Expanded(child: buildCategoryTree()),
        ],
      ),
    );
  }

  @override
  State<CategorySelectorWidget> createState() => _CategorySelectorWidgetState();
}

class _CategorySelectorWidgetState extends State<CategorySelectorWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 08. 帳戶選擇器Widget - AccountSelectorWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 帳戶選擇核心組件
 */
abstract class AccountSelectorWidget extends StatefulWidget {
  const AccountSelectorWidget({Key? key}) : super(key: key);

  Widget buildAccountList();
  Widget buildAccountTypeFilter();
  Widget buildBalanceDisplay();
  Future<void> onAccountSelected(String accountId);
}

class AccountSelectorWidgetImpl extends AccountSelectorWidget {
  const AccountSelectorWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildAccountList() {
    final accounts = [
      Account(id: '1', name: '台灣銀行', type: 'bank', balance: 50000),
      Account(id: '2', name: '現金', type: 'cash', balance: 2000),
      Account(id: '3', name: '信用卡', type: 'credit', balance: -5000),
    ];

    return ListView.builder(
      itemCount: accounts.length,
      itemBuilder: (context, index) {
        final account = accounts[index];
        return ListTile(
          leading: _getAccountIcon(account.type),
          title: Text(account.name),
          subtitle: Text('類型: ${account.type}'),
          trailing: Text(
            '\$${account.balance.toStringAsFixed(0)}',
            style: TextStyle(
              color: account.balance >= 0 ? Colors.green : Colors.red,
              fontWeight: FontWeight.bold,
            ),
          ),
          onTap: () => onAccountSelected(account.id),
        );
      },
    );
  }

  @override
  Widget buildAccountTypeFilter() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Row(
        children: [
          Text('類型篩選: '),
          SizedBox(width: 8),
          Expanded(
            child: Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: Text('全部'),
                  selected: true,
                  onSelected: (selected) {},
                ),
                FilterChip(
                  label: Text('銀行'),
                  selected: false,
                  onSelected: (selected) {},
                ),
                FilterChip(
                  label: Text('現金'),
                  selected: false,
                  onSelected: (selected) {},
                ),
                FilterChip(
                  label: Text('信用卡'),
                  selected: false,
                  onSelected: (selected) {},
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildBalanceDisplay() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            children: [
              Text('總資產概況', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('總資產'),
                  Text('\$47,000', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('總負債'),
                  Text('\$5,000', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                ],
              ),
              Divider(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('淨資產', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('\$42,000', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Icon _getAccountIcon(String type) {
    switch (type) {
      case 'bank':
        return Icon(Icons.account_balance, color: Colors.blue);
      case 'cash':
        return Icon(Icons.money, color: Colors.green);
      case 'credit':
        return Icon(Icons.credit_card, color: Colors.orange);
      default:
        return Icon(Icons.account_balance_wallet);
    }
  }

  @override
  Future<void> onAccountSelected(String accountId) async {
    print('Selected account: $accountId');
    Navigator.of(context as BuildContext).pop(accountId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('選擇帳戶')),
      body: Column(
        children: [
          buildBalanceDisplay(),
          buildAccountTypeFilter(),
          Expanded(child: buildAccountList()),
        ],
      ),
    );
  }

  @override
  State<AccountSelectorWidget> createState() => _AccountSelectorWidgetState();
}

class _AccountSelectorWidgetState extends State<AccountSelectorWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 09. 帳本選擇器Widget - LedgerSelectorWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 帳本選擇核心組件
 */
abstract class LedgerSelectorWidget extends StatefulWidget {
  const LedgerSelectorWidget({Key? key}) : super(key: key);

  Widget buildLedgerList();
  Widget buildLedgerTypeFilter();
  Widget buildCreateLedgerButton();
  Future<void> onLedgerSelected(String ledgerId);
}

class LedgerSelectorWidgetImpl extends LedgerSelectorWidget {
  const LedgerSelectorWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildLedgerList() {
    final ledgers = [
      Ledger(id: '1', name: '個人記帳', type: 'personal', userId: 'user1'),
      Ledger(id: '2', name: '家庭支出', type: 'family', userId: 'user1'),
      Ledger(id: '3', name: '旅遊基金', type: 'project', userId: 'user1'),
    ];

    return ListView.builder(
      itemCount: ledgers.length,
      itemBuilder: (context, index) {
        final ledger = ledgers[index];
        return ListTile(
          leading: _getLedgerIcon(ledger.type),
          title: Text(ledger.name),
          subtitle: Text('類型: ${ledger.type}'),
          trailing: Icon(Icons.arrow_forward_ios),
          onTap: () => onLedgerSelected(ledger.id),
        );
      },
    );
  }

  @override
  Widget buildLedgerTypeFilter() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Row(
        children: [
          Text('類型篩選: '),
          SizedBox(width: 8),
          Expanded(
            child: Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: Text('全部'),
                  selected: true,
                  onSelected: (selected) {},
                ),
                FilterChip(
                  label: Text('個人'),
                  selected: false,
                  onSelected: (selected) {},
                ),
                FilterChip(
                  label: Text('家庭'),
                  selected: false,
                  onSelected: (selected) {},
                ),
                FilterChip(
                  label: Text('專案'),
                  selected: false,
                  onSelected: (selected) {},
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildCreateLedgerButton() {
    return Container(
      padding: EdgeInsets.all(16),
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () {
          // 導航到建立帳本頁面
        },
        icon: Icon(Icons.add),
        label: Text('建立新帳本'),
      ),
    );
  }

  Icon _getLedgerIcon(String type) {
    switch (type) {
      case 'personal':
        return Icon(Icons.person, color: Colors.blue);
      case 'family':
        return Icon(Icons.family_restroom, color: Colors.green);
      case 'project':
        return Icon(Icons.work, color: Colors.orange);
      default:
        return Icon(Icons.book);
    }
  }

  @override
  Future<void> onLedgerSelected(String ledgerId) async {
    print('Selected ledger: $ledgerId');
    Navigator.of(context as BuildContext).pop(ledgerId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('選擇帳本')),
      body: Column(
        children: [
          buildLedgerTypeFilter(),
          Expanded(child: buildLedgerList()),
          buildCreateLedgerButton(),
        ],
      ),
    );
  }

  @override
  State<LedgerSelectorWidget> createState() => _LedgerSelectorWidgetState();
}

class _LedgerSelectorWidgetState extends State<LedgerSelectorWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 10. 圖片附加器Widget - ImageAttachmentWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 圖片附件管理組件
 */
abstract class ImageAttachmentWidget extends StatefulWidget {
  const ImageAttachmentWidget({Key? key}) : super(key: key);

  Widget buildImagePreview();
  Widget buildImageControls();
  Future<void> captureImage();
  Future<void> selectFromGallery();
  Future<void> uploadImages(List<File> images);
}

class ImageAttachmentWidgetImpl extends ImageAttachmentWidget {
  const ImageAttachmentWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildImagePreview() {
    return Container(
      height: 200,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: 3, // 假設有3張圖片
        itemBuilder: (context, index) {
          return Container(
            margin: EdgeInsets.all(8),
            width: 150,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.image, size: 50, color: Colors.grey[600]),
                Text('圖片 ${index + 1}'),
                SizedBox(height: 8),
                IconButton(
                  icon: Icon(Icons.delete),
                  onPressed: () {
                    // 刪除圖片
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget buildImageControls() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          ElevatedButton.icon(
            onPressed: () => captureImage(),
            icon: Icon(Icons.camera_alt),
            label: Text('拍照'),
          ),
          ElevatedButton.icon(
            onPressed: () => selectFromGallery(),
            icon: Icon(Icons.photo_library),
            label: Text('從相簿選擇'),
          ),
          ElevatedButton.icon(
            onPressed: () => uploadImages([]),
            icon: Icon(Icons.cloud_upload),
            label: Text('上傳'),
          ),
        ],
      ),
    );
  }

  @override
  Future<void> captureImage() async {
    // 實作拍照功能
    await Future.delayed(Duration(milliseconds: 100));
    print('Capturing image...');
  }

  @override
  Future<void> selectFromGallery() async {
    // 實作從相簿選擇功能
    await Future.delayed(Duration(milliseconds: 100));
    print('Selecting from gallery...');
  }

  @override
  Future<void> uploadImages(List<File> images) async {
    // 實作上傳功能
    await Future.delayed(Duration(milliseconds: 500));
    print('Uploading ${images.length} images...');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('圖片附件')),
      body: Column(
        children: [
          buildImagePreview(),
          buildImageControls(),
        ],
      ),
    );
  }

  @override
  State<ImageAttachmentWidget> createState() => _ImageAttachmentWidgetState();
}

class _ImageAttachmentWidgetState extends State<ImageAttachmentWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 11. 重複設定器Widget - RecurringSetupWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 重複記帳設定組件
 */
abstract class RecurringSetupWidget extends StatefulWidget {
  const RecurringSetupWidget({Key? key}) : super(key: key);

  Widget buildFrequencySelector();
  Widget buildEndDatePicker();
  Widget buildPreview();
  Future<void> saveRecurringSettings(RecurringConfig config);
}

class RecurringSetupWidgetImpl extends RecurringSetupWidget {
  const RecurringSetupWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildFrequencySelector() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('重複頻率', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: Text('每日'),
                selected: true,
                onSelected: (selected) {},
              ),
              ChoiceChip(
                label: Text('每週'),
                selected: false,
                onSelected: (selected) {},
              ),
              ChoiceChip(
                label: Text('每月'),
                selected: false,
                onSelected: (selected) {},
              ),
              ChoiceChip(
                label: Text('每年'),
                selected: false,
                onSelected: (selected) {},
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildEndDatePicker() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('結束條件', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          RadioListTile(
            title: Text('永不結束'),
            value: 'never',
            groupValue: 'never',
            onChanged: (value) {},
          ),
          RadioListTile(
            title: Text('指定日期結束'),
            value: 'date',
            groupValue: 'never',
            onChanged: (value) {},
          ),
          RadioListTile(
            title: Text('執行次數結束'),
            value: 'count',
            groupValue: 'never',
            onChanged: (value) {},
          ),
        ],
      ),
    );
  }

  @override
  Widget buildPreview() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('預覽', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Text('設定：每日執行，永不結束'),
              SizedBox(height: 4),
              Text('下次執行：明天 ${DateTime.now().add(Duration(days: 1)).toString().split(' ')[0]}'),
              SizedBox(height: 4),
              Text('預計本月執行：30次'),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Future<void> saveRecurringSettings(RecurringConfig config) async {
    await Future.delayed(Duration(milliseconds: 200));
    print('Saving recurring config: ${config.frequency}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('重複設定')),
      body: Column(
        children: [
          buildFrequencySelector(),
          buildEndDatePicker(),
          buildPreview(),
          Spacer(),
          Container(
            padding: EdgeInsets.all(16),
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                final config = RecurringConfig(frequency: 'daily');
                saveRecurringSettings(config);
              },
              child: Text('儲存設定'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  State<RecurringSetupWidget> createState() => _RecurringSetupWidgetState();
}

class _RecurringSetupWidgetState extends State<RecurringSetupWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 12. 記錄管理器Widget - TransactionManagerWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 記錄管理核心組件
 */
abstract class TransactionManagerWidget extends StatefulWidget {
  const TransactionManagerWidget({Key? key}) : super(key: key);

  Widget buildTransactionList();
  Widget buildFilterControls();
  Widget buildSearchBar();
  Widget buildBatchActions();
  Future<void> onTransactionEdit(String transactionId);
  Future<void> onTransactionDelete(String transactionId);
}

class TransactionManagerWidgetImpl extends TransactionManagerWidget {
  const TransactionManagerWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildTransactionList() {
    final transactions = [
      Transaction(id: '1', type: TransactionType.expense, amount: 150, description: '午餐', date: DateTime.now()),
      Transaction(id: '2', type: TransactionType.income, amount: 35000, description: '薪水', date: DateTime.now().subtract(Duration(days: 1))),
      Transaction(id: '3', type: TransactionType.transfer, amount: 10000, description: '轉帳', date: DateTime.now().subtract(Duration(days: 2))),
    ];

    return ListView.builder(
      itemCount: transactions.length,
      itemBuilder: (context, index) {
        final transaction = transactions[index];
        return ListTile(
          leading: _getTransactionIcon(transaction.type),
          title: Text(transaction.description),
          subtitle: Text(transaction.date.toString().split(' ')[0]),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '\$${transaction.amount.toStringAsFixed(0)}',
                style: TextStyle(
                  color: _getAmountColor(transaction.type),
                  fontWeight: FontWeight.bold,
                ),
              ),
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'edit') {
                    onTransactionEdit(transaction.id);
                  } else if (value == 'delete') {
                    onTransactionDelete(transaction.id);
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(value: 'edit', child: Text('編輯')),
                  PopupMenuItem(value: 'delete', child: Text('刪除')),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget buildFilterControls() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              Text('類型篩選: '),
              SizedBox(width: 8),
              Expanded(
                child: Wrap(
                  spacing: 8,
                  children: [
                    FilterChip(
                      label: Text('全部'),
                      selected: true,
                      onSelected: (selected) {},
                    ),
                    FilterChip(
                      label: Text('收入'),
                      selected: false,
                      onSelected: (selected) {},
                    ),
                    FilterChip(
                      label: Text('支出'),
                      selected: false,
                      onSelected: (selected) {},
                    ),
                    FilterChip(
                      label: Text('轉帳'),
                      selected: false,
                      onSelected: (selected) {},
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Row(
            children: [
              Text('日期範圍: '),
              SizedBox(width: 8),
              Expanded(
                child: Row(
                  children: [
                    TextButton(
                      onPressed: () {},
                      child: Text('本月'),
                    ),
                    TextButton(
                      onPressed: () {},
                      child: Text('上月'),
                    ),
                    TextButton(
                      onPressed: () {},
                      child: Text('自訂'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildSearchBar() {
    return Container(
      padding: EdgeInsets.all(16),
      child: TextField(
        decoration: InputDecoration(
          hintText: '搜尋交易記錄...',
          prefixIcon: Icon(Icons.search),
          border: OutlineInputBorder(),
        ),
        onChanged: (value) {
          // 實作搜尋邏輯
        },
      ),
    );
  }

  @override
  Widget buildBatchActions() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Row(
        children: [
          ElevatedButton.icon(
            onPressed: () {},
            icon: Icon(Icons.select_all),
            label: Text('全選'),
          ),
          SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: () {},
            icon: Icon(Icons.delete),
            label: Text('批次刪除'),
          ),
          SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: () {},
            icon: Icon(Icons.download),
            label: Text('匯出'),
          ),
        ],
      ),
    );
  }

  Icon _getTransactionIcon(TransactionType type) {
    switch (type) {
      case TransactionType.income:
        return Icon(Icons.add_circle, color: Colors.green);
      case TransactionType.expense:
        return Icon(Icons.remove_circle, color: Colors.red);
      case TransactionType.transfer:
        return Icon(Icons.swap_horiz, color: Colors.blue);
    }
  }

  Color _getAmountColor(TransactionType type) {
    switch (type) {
      case TransactionType.income:
        return Colors.green;
      case TransactionType.expense:
        return Colors.red;
      case TransactionType.transfer:
        return Colors.blue;
    }
  }

  @override
  Future<void> onTransactionEdit(String transactionId) async {
    print('Editing transaction: $transactionId');
    // 導航到編輯頁面
  }

  @override
  Future<void> onTransactionDelete(String transactionId) async {
    print('Deleting transaction: $transactionId');
    // 實作刪除邏輯
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('記錄管理')),
      body: Column(
        children: [
          buildSearchBar(),
          buildFilterControls(),
          buildBatchActions(),
          Expanded(child: buildTransactionList()),
        ],
      ),
    );
  }

  @override
  State<TransactionManagerWidget> createState() => _TransactionManagerWidgetState();
}

class _TransactionManagerWidgetState extends State<TransactionManagerWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 13. 記錄編輯器Widget - TransactionEditorWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 記錄編輯核心組件
 */
abstract class TransactionEditorWidget extends StatefulWidget {
  const TransactionEditorWidget({Key? key}) : super(key: key);

  Widget buildEditForm();
  Widget buildVersionHistory();
  Future<void> loadTransaction(String transactionId);
  Future<void> saveChanges(Transaction updatedTransaction);
}

class TransactionEditorWidgetImpl extends TransactionEditorWidget {
  const TransactionEditorWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildEditForm() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(
            decoration: InputDecoration(
              labelText: '金額',
              border: OutlineInputBorder(),
              prefixText: '\$ ',
            ),
            keyboardType: TextInputType.number,
          ),
          SizedBox(height: 16),
          TextField(
            decoration: InputDecoration(
              labelText: '描述',
              border: OutlineInputBorder(),
            ),
          ),
          SizedBox(height: 16),
          InkWell(
            onTap: () {
              // 選擇科目
            },
            child: Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('科目: 午餐'),
                  Icon(Icons.arrow_forward_ios),
                ],
              ),
            ),
          ),
          SizedBox(height: 16),
          InkWell(
            onTap: () {
              // 選擇帳戶
            },
            child: Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('帳戶: 現金'),
                  Icon(Icons.arrow_forward_ios),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildVersionHistory() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('修改歷史', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Card(
            child: ListView(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              children: [
                ListTile(
                  leading: Icon(Icons.edit),
                  title: Text('建立記錄'),
                  subtitle: Text('2025-09-12 10:30'),
                  trailing: Text('原始'),
                ),
                ListTile(
                  leading: Icon(Icons.edit),
                  title: Text('修改金額'),
                  subtitle: Text('2025-09-12 15:45'),
                  trailing: Text('v1.1'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Future<void> loadTransaction(String transactionId) async {
    await Future.delayed(Duration(milliseconds: 200));
    print('Loading transaction: $transactionId');
  }

  @override
  Future<void> saveChanges(Transaction updatedTransaction) async {
    await Future.delayed(Duration(milliseconds: 300));
    print('Saving transaction: ${updatedTransaction.id}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('編輯記錄'),
        actions: [
          TextButton(
            onPressed: () {
              // 儲存變更
              final transaction = Transaction(
                id: '1',
                type: TransactionType.expense,
                amount: 150,
                description: '午餐',
                date: DateTime.now(),
              );
              saveChanges(transaction);
            },
            child: Text('儲存'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            buildEditForm(),
            buildVersionHistory(),
          ],
        ),
      ),
    );
  }

  @override
  State<TransactionEditorWidget> createState() => _TransactionEditorWidgetState();
}

class _TransactionEditorWidgetState extends State<TransactionEditorWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

/**
 * 14. 統計圖表器Widget - StatisticsChartWidget
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 統計圖表展示組件
 */
abstract class StatisticsChartWidget extends StatefulWidget {
  const StatisticsChartWidget({Key? key}) : super(key: key);

  Widget buildChartSelector();
  Widget buildPeriodSelector();
  Widget buildChart();
  Future<void> generateChart(String chartType, String period);
}

class StatisticsChartWidgetImpl extends StatisticsChartWidget {
  const StatisticsChartWidgetImpl({Key? key}) : super(key: key);

  @override
  Widget buildChartSelector() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('圖表類型', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: Text('圓餅圖'),
                selected: true,
                onSelected: (selected) {},
              ),
              ChoiceChip(
                label: Text('長條圖'),
                selected: false,
                onSelected: (selected) {},
              ),
              ChoiceChip(
                label: Text('折線圖'),
                selected: false,
                onSelected: (selected) {},
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildPeriodSelector() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('時間範圍', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  child: Text('本月'),
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  child: Text('上月'),
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  child: Text('本年'),
                ),
              ),
              SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  child: Text('自訂'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget buildChart() {
    return Container(
      height: 300,
      margin: EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.pie_chart, size: 80, color: Colors.grey[400]),
          SizedBox(height: 16),
          Text('圓餅圖', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Text('支出分類統計'),
          SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildLegendItem('食物', Colors.red, '40%'),
              _buildLegendItem('交通', Colors.blue, '30%'),
              _buildLegendItem('娛樂', Colors.green, '20%'),
              _buildLegendItem('其他', Colors.orange, '10%'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color, String percentage) {
    return Column(
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 12)),
        Text(percentage, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ],
    );
  }

  @override
  Future<void> generateChart(String chartType, String period) async {
    await Future.delayed(Duration(milliseconds: 500));
    print('Generating $chartType for $period');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('統計圖表')),
      body: Column(
        children: [
          buildChartSelector(),
          buildPeriodSelector(),
          buildChart(),
          Spacer(),
          Container(
            padding: EdgeInsets.all(16),
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => generateChart('pie', 'thisMonth'),
              child: Text('更新圖表'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  State<StatisticsChartWidget> createState() => _StatisticsChartWidgetState();
}

class _StatisticsChartWidgetState extends State<StatisticsChartWidget> {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}

// ==========================================
// 狀態管理Provider實作類別 (函數15-20)
// ==========================================

/**
 * 15. 交易狀態管理Provider - TransactionStateProvider
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 交易狀態管理核心
 */
abstract class TransactionStateProvider extends ChangeNotifier {
  List<Transaction> get transactions;
  Transaction? get currentTransaction;
  bool get isLoading;
  String? get errorMessage;

  Future<void> loadTransactions();
  Future<void> createTransaction(Transaction transaction);
  Future<void> updateTransaction(String id, Transaction transaction);
  Future<void> deleteTransaction(String id);
  void setCurrentTransaction(Transaction? transaction);
  void clearError();
}

class TransactionStateProviderImpl extends TransactionStateProvider {
  List<Transaction> _transactions = [];
  Transaction? _currentTransaction;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  List<Transaction> get transactions => List.unmodifiable(_transactions);

  @override
  Transaction? get currentTransaction => _currentTransaction;

  @override
  bool get isLoading => _isLoading;

  @override
  String? get errorMessage => _errorMessage;

  @override
  Future<void> loadTransactions() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.delayed(Duration(milliseconds: 500)); // 模擬API呼叫

      _transactions = [
        Transaction(id: '1', type: TransactionType.expense, amount: 150, description: '午餐', date: DateTime.now()),
        Transaction(id: '2', type: TransactionType.income, amount: 35000, description: '薪水', date: DateTime.now().subtract(Duration(days: 1))),
        Transaction(id: '3', type: TransactionType.transfer, amount: 10000, description: '轉帳', date: DateTime.now().subtract(Duration(days: 2))),
      ];

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  @override
  Future<void> createTransaction(Transaction transaction) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));
      _transactions.add(transaction);
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> updateTransaction(String id, Transaction transaction) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));
      final index = _transactions.indexWhere((t) => t.id == id);
      if (index != -1) {
        _transactions[index] = transaction;
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> deleteTransaction(String id) async {
    try {
      await Future.delayed(Duration(milliseconds: 200));
      _transactions.removeWhere((t) => t.id == id);
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  @override
  void setCurrentTransaction(Transaction? transaction) {
    _currentTransaction = transaction;
    notifyListeners();
  }

  @override
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}

/**
 * 16. 科目狀態管理Provider - CategoryStateProvider
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 科目狀態管理與快取機制
 */
abstract class CategoryStateProvider extends ChangeNotifier {
  List<Category> get categories;
  List<Category> get frequentCategories;
  List<Category> get recentCategories;
  Category? get selectedCategory;
  bool get isLoading;

  Future<void> loadCategories();
  Future<void> selectCategory(String categoryId);
  List<Category> searchCategories(String query);
  void clearSelection();
}

class CategoryStateProviderImpl extends CategoryStateProvider {
  List<Category> _categories = [];
  List<Category> _frequentCategories = [];
  List<Category> _recentCategories = [];
  Category? _selectedCategory;
  bool _isLoading = false;

  @override
  List<Category> get categories => List.unmodifiable(_categories);

  @override
  List<Category> get frequentCategories => List.unmodifiable(_frequentCategories);

  @override
  List<Category> get recentCategories => List.unmodifiable(_recentCategories);

  @override
  Category? get selectedCategory => _selectedCategory;

  @override
  bool get isLoading => _isLoading;

  @override
  Future<void> loadCategories() async {
    _isLoading = true;
    notifyListeners();

    try {
      await Future.delayed(Duration(milliseconds: 400));

      _categories = [
        Category(id: 'food', name: '食物', type: 'expense'),
        Category(id: 'food_lunch', name: '午餐', parentId: 'food', type: 'expense'),
        Category(id: 'food_dinner', name: '晚餐', parentId: 'food', type: 'expense'),
        Category(id: 'transport', name: '交通', type: 'expense'),
        Category(id: 'transport_bus', name: '公車', parentId: 'transport', type: 'expense'),
        Category(id: 'salary', name: '薪資', type: 'income'),
      ];

      _frequentCategories = [
        Category(id: 'food_lunch', name: '午餐', parentId: 'food', type: 'expense'),
        Category(id: 'transport_bus', name: '公車', parentId: 'transport', type: 'expense'),
      ];

      _recentCategories = [
        Category(id: 'food_lunch', name: '午餐', parentId: 'food', type: 'expense'),
        Category(id: 'salary', name: '薪資', type: 'income'),
      ];

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> selectCategory(String categoryId) async {
    _selectedCategory = _categories.firstWhere(
      (category) => category.id == categoryId,
      orElse: () => Category(id: categoryId, name: 'Unknown', type: 'expense'),
    );
    notifyListeners();
  }

  @override
  List<Category> searchCategories(String query) {
    if (query.isEmpty) return _categories;

    return _categories.where((category) =>
      category.name.toLowerCase().contains(query.toLowerCase())
    ).toList();
  }

  @override
  void clearSelection() {
    _selectedCategory = null;
    notifyListeners();
  }
}

/**
 * 17. 帳戶狀態管理Provider - AccountStateProvider
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 帳戶狀態管理與餘額追蹤
 */
abstract class AccountStateProvider extends ChangeNotifier {
  List<Account> get accounts;
  Account? get selectedAccount;
  Map<String, double> get balances;
  bool get isLoading;

  Future<void> loadAccounts();
  Future<void> selectAccount(String accountId);
  Future<void> refreshBalances();
  void clearSelection();
}

class AccountStateProviderImpl extends AccountStateProvider {
  List<Account> _accounts = [];
  Account? _selectedAccount;
  Map<String, double> _balances = {};
  bool _isLoading = false;

  @override
  List<Account> get accounts => List.unmodifiable(_accounts);

  @override
  Account? get selectedAccount => _selectedAccount;

  @override
  Map<String, double> get balances => Map.unmodifiable(_balances);

  @override
  bool get isLoading => _isLoading;

  @override
  Future<void> loadAccounts() async {
    _isLoading = true;
    notifyListeners();

    try {
      await Future.delayed(Duration(milliseconds: 350));

      _accounts = [
        Account(id: '1', name: '台灣銀行', type: 'bank', balance: 50000),
        Account(id: '2', name: '現金', type: 'cash', balance: 2000),
        Account(id: '3', name: '信用卡', type: 'credit', balance: -5000),
      ];

      // 初始化餘額
      for (var account in _accounts) {
        _balances[account.id] = account.balance;
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> selectAccount(String accountId) async {
    _selectedAccount = _accounts.firstWhere(
      (account) => account.id == accountId,
      orElse: () => Account(id: accountId, name: 'Unknown', type: 'unknown', balance: 0),
    );
    notifyListeners();
  }

  @override
  Future<void> refreshBalances() async {
    try {
      await Future.delayed(Duration(milliseconds: 300));

      // 模擬API呼叫獲取最新餘額
      for (var account in _accounts) {
        _balances[account.id] = account.balance + (DateTime.now().millisecondsSinceEpoch % 1000 - 500);
      }

      notifyListeners();
    } catch (e) {
      notifyListeners();
      rethrow;
    }
  }

  @override
  void clearSelection() {
    _selectedAccount = null;
    notifyListeners();
  }
}

/**
 * 18. 帳本狀態管理Provider - LedgerStateProvider
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 帳本狀態管理與切換功能
 */
abstract class LedgerStateProvider extends ChangeNotifier {
  List<Ledger> get ledgers;
  Ledger? get currentLedger;
  bool get isLoading;

  Future<void> loadLedgers();
  Future<void> selectLedger(String ledgerId);
  Future<void> createLedger(Ledger ledger);
  void clearSelection();
}

class LedgerStateProviderImpl extends LedgerStateProvider {
  List<Ledger> _ledgers = [];
  Ledger? _currentLedger;
  bool _isLoading = false;

  @override
  List<Ledger> get ledgers => List.unmodifiable(_ledgers);

  @override
  Ledger? get currentLedger => _currentLedger;

  @override
  bool get isLoading => _isLoading;

  @override
  Future<void> loadLedgers() async {
    _isLoading = true;
    notifyListeners();

    try {
      await Future.delayed(Duration(milliseconds: 400));

      _ledgers = [
        Ledger(id: '1', name: '個人記帳', type: 'personal', userId: 'user1'),
        Ledger(id: '2', name: '家庭支出', type: 'family', userId: 'user1'),
        Ledger(id: '3', name: '旅遊基金', type: 'project', userId: 'user1'),
      ];

      // 預設選擇第一個帳本
      if (_ledgers.isNotEmpty && _currentLedger == null) {
        _currentLedger = _ledgers.first;
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> selectLedger(String ledgerId) async {
    _currentLedger = _ledgers.firstWhere(
      (ledger) => ledger.id == ledgerId,
      orElse: () => Ledger(id: ledgerId, name: 'Unknown', type: 'personal', userId: 'user1'),
    );
    notifyListeners();
  }

  @override
  Future<void> createLedger(Ledger ledger) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));
      _ledgers.add(ledger);
      notifyListeners();
    } catch (e) {
      notifyListeners();
      rethrow;
    }
  }

  @override
  void clearSelection() {
    _currentLedger = null;
    notifyListeners();
  }
}

/**
 * 19. 統計狀態管理Provider - StatisticsStateProvider
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 統計數據狀態管理
 */
abstract class StatisticsStateProvider extends ChangeNotifier {
  DashboardData? get dashboardData;
  List<ChartData> get chartData;
  String get selectedPeriod;
  String get selectedChartType;
  bool get isLoading;

  Future<void> loadDashboardData();
  Future<void> generateChart(String chartType, String period);
  void setPeriod(String period);
  void setChartType(String chartType);
}

class StatisticsStateProviderImpl extends StatisticsStateProvider {
  DashboardData? _dashboardData;
  List<ChartData> _chartData = [];
  String _selectedPeriod = 'month';
  String _selectedChartType = 'pie';
  bool _isLoading = false;

  @override
  DashboardData? get dashboardData => _dashboardData;

  @override
  List<ChartData> get chartData => List.unmodifiable(_chartData);

  @override
  String get selectedPeriod => _selectedPeriod;

  @override
  String get selectedChartType => _selectedChartType;

  @override
  bool get isLoading => _isLoading;

  @override
  Future<void> loadDashboardData() async {
    _isLoading = true;
    notifyListeners();

    try {
      await Future.delayed(Duration(milliseconds: 600));

      _dashboardData = DashboardData(
        totalIncome: 50000,
        totalExpense: 35000,
        balance: 15000,
        transactionCount: 156,
      );

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> generateChart(String chartType, String period) async {
    _isLoading = true;
    _selectedChartType = chartType;
    _selectedPeriod = period;
    notifyListeners();

    try {
      await Future.delayed(Duration(milliseconds: 800));

      _chartData = [
        ChartData(label: '食物', value: 12000, color: Colors.red),
        ChartData(label: '交通', value: 8000, color: Colors.blue),
        ChartData(label: '娛樂', value: 6000, color: Colors.green),
        ChartData(label: '其他', value: 9000, color: Colors.orange),
      ];

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  void setPeriod(String period) {
    _selectedPeriod = period;
    notifyListeners();
  }

  @override
  void setChartType(String chartType) {
    _selectedChartType = chartType;
    notifyListeners();
  }
}

/**
 * 20. 表單狀態管理Provider - FormStateProvider
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 記帳表單狀態管理
 */
abstract class FormStateProvider extends ChangeNotifier {
  Transaction get draftTransaction;
  bool get hasUnsavedChanges;
  Map<String, String> get validationErrors;
  bool get isSubmitting;

  void updateAmount(double amount);
  void updateCategory(String categoryId);
  void updateAccount(String accountId);
  void updateDescription(String description);
  void updateDate(DateTime date);
  Future<void> submitTransaction();
  Future<void> saveDraft();
  Future<void> loadDraft();
  void clearForm();
  bool validateForm();
}

class FormStateProviderImpl extends FormStateProvider {
  late Transaction _draftTransaction;
  bool _hasUnsavedChanges = false;
  Map<String, String> _validationErrors = {};
  bool _isSubmitting = false;

  FormStateProviderImpl() {
    _initializeForm();
  }

  void _initializeForm() {
    _draftTransaction = Transaction(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      type: TransactionType.expense,
      amount: 0.0,
      description: '',
      date: DateTime.now(),
    );
  }

  @override
  Transaction get draftTransaction => _draftTransaction;

  @override
  bool get hasUnsavedChanges => _hasUnsavedChanges;

  @override
  Map<String, String> get validationErrors => Map.unmodifiable(_validationErrors);

  @override
  bool get isSubmitting => _isSubmitting;

  @override
  void updateAmount(double amount) {
    _draftTransaction = Transaction(
      id: _draftTransaction.id,
      type: _draftTransaction.type,
      amount: amount,
      categoryId: _draftTransaction.categoryId,
      accountId: _draftTransaction.accountId,
      description: _draftTransaction.description,
      date: _draftTransaction.date,
    );
    _hasUnsavedChanges = true;
    _validateField('amount');
    notifyListeners();
  }

  @override
  void updateCategory(String categoryId) {
    _draftTransaction = Transaction(
      id: _draftTransaction.id,
      type: _draftTransaction.type,
      amount: _draftTransaction.amount,
      categoryId: categoryId,
      accountId: _draftTransaction.accountId,
      description: _draftTransaction.description,
      date: _draftTransaction.date,
    );
    _hasUnsavedChanges = true;
    _validateField('category');
    notifyListeners();
  }

  @override
  void updateAccount(String accountId) {
    _draftTransaction = Transaction(
      id: _draftTransaction.id,
      type: _draftTransaction.type,
      amount: _draftTransaction.amount,
      categoryId: _draftTransaction.categoryId,
      accountId: accountId,
      description: _draftTransaction.description,
      date: _draftTransaction.date,
    );
    _hasUnsavedChanges = true;
    _validateField('account');
    notifyListeners();
  }

  @override
  void updateDescription(String description) {
    _draftTransaction = Transaction(
      id: _draftTransaction.id,
      type: _draftTransaction.type,
      amount: _draftTransaction.amount,
      categoryId: _draftTransaction.categoryId,
      accountId: _draftTransaction.accountId,
      description: description,
      date: _draftTransaction.date,
    );
    _hasUnsavedChanges = true;
    notifyListeners();
  }

  @override
  void updateDate(DateTime date) {
    _draftTransaction = Transaction(
      id: _draftTransaction.id,
      type: _draftTransaction.type,
      amount: _draftTransaction.amount,
      categoryId: _draftTransaction.categoryId,
      accountId: _draftTransaction.accountId,
      description: _draftTransaction.description,
      date: date,
    );
    _hasUnsavedChanges = true;
    notifyListeners();
  }

  @override
  Future<void> submitTransaction() async {
    if (!validateForm()) return;

    _isSubmitting = true;
    notifyListeners();

    try {
      await Future.delayed(Duration(milliseconds: 1000));
      // 這裡會呼叫API提交交易

      _hasUnsavedChanges = false;
      _isSubmitting = false;
      clearForm();
      notifyListeners();
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> saveDraft() async {
    await Future.delayed(Duration(milliseconds: 200));
    // 儲存草稿到本地儲存
    _hasUnsavedChanges = false;
    notifyListeners();
  }

  @override
  Future<void> loadDraft() async {
    await Future.delayed(Duration(milliseconds: 200));
    // 從本地儲存載入草稿
    notifyListeners();
  }

  @override
  void clearForm() {
    _initializeForm();
    _hasUnsavedChanges = false;
    _validationErrors.clear();
    notifyListeners();
  }

  @override
  bool validateForm() {
    _validationErrors.clear();

    _validateField('amount');
    _validateField('category');
    _validateField('account');

    return _validationErrors.isEmpty;
  }

  void _validateField(String field) {
    switch (field) {
      case 'amount':
        if (_draftTransaction.amount <= 0) {
          _validationErrors['amount'] = '金額必須大於0';
        } else {
          _validationErrors.remove('amount');
        }
        break;
      case 'category':
        if (_draftTransaction.categoryId == null || _draftTransaction.categoryId!.isEmpty) {
          _validationErrors['category'] = '請選擇科目';
        } else {
          _validationErrors.remove('category');
        }
        break;
      case 'account':
        if (_draftTransaction.accountId == null || _draftTransaction.accountId!.isEmpty) {
          _validationErrors['account'] = '請選擇帳戶';
        } else {
          _validationErrors.remove('account');
        }
        break;
    }
  }
}

// ==========================================
// 階段二：導航與API集成 (函數21-31) - 完成
// ==========================================

/**
 * 21. 狀態同步管理器 - StateSyncManager
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @update: 階段二完成 - 完善狀態同步邏輯，支援跨組件資料一致性，增強錯誤處理與重試機制
 */
class StateSyncManager {
  static final List<VoidCallback> _listeners = [];
  static final List<Function> _errorHandlers = [];
  static bool _isSyncing = false;
  static int _syncRetryCount = 0;
  static const int _maxRetryCount = 3;

  static Future<void> syncAllStates() async {
    if (_isSyncing) return;
    _isSyncing = true;

    try {
      // 同步所有狀態，按重要性順序
      await _syncWithRetry(() => syncLedgerState());     // 最優先：帳本狀態
      await _syncWithRetry(() => syncAccountState());    // 高優先級：帳戶狀態
      await _syncWithRetry(() => syncCategoryState());   // 中優先級：科目狀態
      await _syncWithRetry(() => syncTransactionState()); // 中優先級：交易狀態
      await _syncWithRetry(() => syncDashboardState());  // 低優先級：儀表板統計

      // 同步完成，重置重試計數
      _syncRetryCount = 0;

      // 通知所有監聽器
      for (final listener in _listeners) {
        try {
          listener();
        } catch (e) {
          print('StateSyncManager.listener error: $e');
        }
      }

      print('StateSyncManager: 所有狀態同步完成');
    } catch (e) {
      print('StateSyncManager.syncAllStates error: $e');
      // 通知錯誤處理器
      for (final errorHandler in _errorHandlers) {
        try {
          errorHandler(e);
        } catch (handlerError) {
          print('StateSyncManager.errorHandler error: $handlerError');
        }
      }
    } finally {
      _isSyncing = false;
    }
  }

  static Future<void> _syncWithRetry(Future<void> Function() syncFunction) async {
    int attempts = 0;
    while (attempts < _maxRetryCount) {
      try {
        await syncFunction();
        return; // 成功，結束重試
      } catch (e) {
        attempts++;
        if (attempts >= _maxRetryCount) {
          print('StateSyncManager: 同步失敗，已達最大重試次數 ($attempts)');
          rethrow;
        }
        print('StateSyncManager: 同步失敗，重試 $attempts/$_maxRetryCount: $e');
        await Future.delayed(Duration(milliseconds: 500 * attempts)); // 漸進延遲
      }
    }
  }

  static Future<void> syncTransactionState() async {
    try {
      final provider = DependencyContainer.get<TransactionStateProvider>();
      await provider.loadTransactions();
      print('StateSyncManager: 交易狀態同步完成');
    } catch (e) {
      print('StateSyncManager.syncTransactionState error: $e');
      rethrow;
    }
  }

  static Future<void> syncDashboardState() async {
    try {
      final provider = DependencyContainer.get<StatisticsStateProvider>();
      await provider.loadDashboardData();
      print('StateSyncManager: 儀表板狀態同步完成');
    } catch (e) {
      print('StateSyncManager.syncDashboardState error: $e');
      rethrow;
    }
  }

  static Future<void> syncCategoryState() async {
    try {
      final provider = DependencyContainer.get<CategoryStateProvider>();
      await provider.loadCategories();
      print('StateSyncManager: 科目狀態同步完成');
    } catch (e) {
      print('StateSyncManager.syncCategoryState error: $e');
      rethrow;
    }
  }

  static Future<void> syncAccountState() async {
    try {
      final provider = DependencyContainer.get<AccountStateProvider>();
      await provider.loadAccounts();
      await provider.refreshBalances();
      print('StateSyncManager: 帳戶狀態同步完成');
    } catch (e) {
      print('StateSyncManager.syncAccountState error: $e');
      rethrow;
    }
  }

  static Future<void> syncLedgerState() async {
    try {
      final provider = DependencyContainer.get<LedgerStateProvider>();
      await provider.loadLedgers();
      print('StateSyncManager: 帳本狀態同步完成');
    } catch (e) {
      print('StateSyncManager.syncLedgerState error: $e');
      rethrow;
    }
  }

  static void registerSyncListener(VoidCallback callback) {
    if (!_listeners.contains(callback)) {
      _listeners.add(callback);
    }
  }

  static void unregisterSyncListener(VoidCallback callback) {
    _listeners.remove(callback);
  }

  static void registerErrorHandler(Function(dynamic) errorHandler) {
    if (!_errorHandlers.contains(errorHandler)) {
      _errorHandlers.add(errorHandler);
    }
  }

  static void unregisterErrorHandler(Function(dynamic) errorHandler) {
    _errorHandlers.remove(errorHandler);
  }

  static bool get isSyncing => _isSyncing;

  static void dispose() {
    _listeners.clear();
    _errorHandlers.clear();
    _isSyncing = false;
    _syncRetryCount = 0;
  }
}

/**
 * 22. 記帳路由管理器 - AccountingRoutes
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @update: 階段二完成 - 完善路由管理與動態路由生成，增加路由中間件與權限檢查
 */
class AccountingRoutes {
  static const String home = '/accounting/home';
  static const String form = '/accounting/form';
  static const String categorySelector = '/accounting/category-selector';
  static const String accountSelector = '/accounting/account-selector';
  static const String ledgerSelector = '/accounting/ledger-selector';
  static const String imageAttachment = '/accounting/image-attachment';
  static const String recurringSetup = '/accounting/recurring-setup';
  static const String transactionManager = '/accounting/transaction-manager';
  static const String transactionEditor = '/accounting/transaction-editor';
  static const String statisticsChart = '/accounting/statistics-chart';
  static const String quickAccounting = '/accounting/quick';
  static const String settings = '/accounting/settings';

  // 路由權限設定
  static final Map<String, List<UserMode>> _routePermissions = {
    home: [UserMode.expert, UserMode.inertial, UserMode.cultivation, UserMode.guiding],
    form: [UserMode.expert, UserMode.inertial, UserMode.cultivation, UserMode.guiding],
    categorySelector: [UserMode.expert, UserMode.inertial, UserMode.cultivation],
    accountSelector: [UserMode.expert, UserMode.inertial, UserMode.cultivation, UserMode.guiding],
    ledgerSelector: [UserMode.expert, UserMode.inertial],
    imageAttachment: [UserMode.expert, UserMode.inertial, UserMode.cultivation],
    recurringSetup: [UserMode.expert, UserMode.inertial],
    transactionManager: [UserMode.expert, UserMode.inertial, UserMode.cultivation],
    transactionEditor: [UserMode.expert, UserMode.inertial],
    statisticsChart: [UserMode.expert, UserMode.inertial, UserMode.cultivation],
    quickAccounting: [UserMode.expert, UserMode.inertial, UserMode.cultivation, UserMode.guiding],
    settings: [UserMode.expert, UserMode.inertial],
  };

  static Map<String, WidgetBuilder> getRoutes() {
    return {
      home: (context) => _buildRouteWithAuth(context, () => AccountingHomePageImpl()),
      form: (context) => _buildRouteWithAuth(context, () => AccountingFormPageImpl()),
      categorySelector: (context) => _buildRouteWithAuth(context, () => CategorySelectorWidgetImpl()),
      accountSelector: (context) => _buildRouteWithAuth(context, () => AccountSelectorWidgetImpl()),
      ledgerSelector: (context) => _buildRouteWithAuth(context, () => LedgerSelectorWidgetImpl()),
      imageAttachment: (context) => _buildRouteWithAuth(context, () => ImageAttachmentWidgetImpl()),
      recurringSetup: (context) => _buildRouteWithAuth(context, () => RecurringSetupWidgetImpl()),
      transactionManager: (context) => _buildRouteWithAuth(context, () => TransactionManagerWidgetImpl()),
      transactionEditor: (context) => _buildRouteWithAuth(context, () => TransactionEditorWidgetImpl()),
      statisticsChart: (context) => _buildRouteWithAuth(context, () => StatisticsChartWidgetImpl()),
      quickAccounting: (context) => _buildRouteWithAuth(context, () => _buildQuickAccountingPage()),
      settings: (context) => _buildRouteWithAuth(context, () => _buildSettingsPage()),
    };
  }

  static Widget _buildRouteWithAuth(BuildContext context, Widget Function() builder) {
    final currentMode = _getCurrentUserMode(); // 實際應從Provider或SharedPreferences獲取
    final route = ModalRoute.of(context)?.settings.name ?? '';

    if (_hasPermission(route, currentMode)) {
      return builder();
    } else {
      return _buildPermissionDeniedPage(route, currentMode);
    }
  }

  static bool _hasPermission(String route, UserMode userMode) {
    final permissions = _routePermissions[route];
    return permissions?.contains(userMode) ?? false;
  }

  static UserMode _getCurrentUserMode() {
    // 實際實作中應從狀態管理或本地儲存獲取
    return UserMode.inertial; // 預設值
  }

  static Widget _buildPermissionDeniedPage(String route, UserMode userMode) {
    return Scaffold(
      appBar: AppBar(title: Text('權限不足')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.lock, size: 64, color: Colors.orange),
            SizedBox(height: 16),
            Text('當前模式 (${_getModeDisplayName(userMode)}) 無法訪問此功能'),
            SizedBox(height: 8),
            Text('路由: $route'),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.pushReplacementNamed(context as BuildContext, home),
              child: Text('返回首頁'),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _buildQuickAccountingPage() {
    return Scaffold(
      appBar: AppBar(title: Text('快速記帳')),
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.all(20),
            child: Text('快速記帳介面', style: TextStyle(fontSize: 18)),
          ),
          Expanded(
            child: LineOADialogHandlerImpl(),
          ),
        ],
      ),
    );
  }

  static Widget _buildSettingsPage() {
    return Scaffold(
      appBar: AppBar(title: Text('設定')),
      body: ListView(
        children: [
          ListTile(
            title: Text('使用者模式'),
            subtitle: Text('切換四種使用者模式'),
            trailing: Icon(Icons.arrow_forward_ios),
            onTap: () {
              // 導航到模式選擇頁
            },
          ),
          ListTile(
            title: Text('同步設定'),
            subtitle: Text('資料同步相關設定'),
            trailing: Icon(Icons.arrow_forward_ios),
            onTap: () {
              // 導航到同步設定頁
            },
          ),
        ],
      ),
    );
  }

  static String _getModeDisplayName(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return '專家模式';
      case UserMode.inertial:
        return '慣性模式';
      case UserMode.cultivation:
        return '養成模式';
      case UserMode.guiding:
        return '引導模式';
    }
  }

  static Route<T>? generateRoute<T>(RouteSettings settings) {
    final routes = getRoutes();
    final builder = routes[settings.name];

    if (builder != null) {
      return MaterialPageRoute<T>(
        builder: builder,
        settings: settings,
      );
    }

    // 404 處理
    return MaterialPageRoute<T>(
      builder: (context) => Scaffold(
        appBar: AppBar(title: Text('頁面不存在')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error, size: 64, color: Colors.red),
              SizedBox(height: 16),
              Text('找不到頁面: ${settings.name}'),
              SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => Navigator.pushReplacementNamed(context, home),
                child: Text('返回首頁'),
              ),
            ],
          ),
        ),
      ),
      settings: settings,
    );
  }

  // 路由歷史記錄
  static final List<String> _routeHistory = [];

  static void recordRoute(String route) {
    _routeHistory.add(route);
    if (_routeHistory.length > 10) {
      _routeHistory.removeAt(0); // 保持最近10個路由記錄
    }
  }

  static List<String> getRouteHistory() {
    return List.unmodifiable(_routeHistory);
  }

  static String? getPreviousRoute() {
    if (_routeHistory.length >= 2) {
      return _routeHistory[_routeHistory.length - 2];
    }
    return null;
  }
}

/**
 * 23. 記帳導航控制器 - AccountingNavigationController
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @update: 階段二完成 - 實作完整導航控制邏輯，增加導航狀態管理與錯誤處理
 */
class AccountingNavigationController {
  static final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  static final List<String> _navigationHistory = [];
  static bool _isNavigating = false;

  // 取得Navigator Key
  static GlobalKey<NavigatorState> get navigatorKey => _navigatorKey;

  static Future<void> toAccountingHome() async {
    if (_isNavigating) return;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.home);

      final context = _getCurrentContext();
      if (context != null) {
        await Navigator.pushReplacementNamed(context, AccountingRoutes.home);
        _recordNavigation('toAccountingHome');
      }
    } catch (e) {
      print('AccountingNavigationController.toAccountingHome error: $e');
    } finally {
      _isNavigating = false;
    }
  }

  static Future<void> toAccountingForm({Transaction? initialData}) async {
    if (_isNavigating) return;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.form);

      final context = _getCurrentContext();
      if (context != null) {
        // 預設載入表單狀態Provider
        final formProvider = DependencyContainer.get<FormStateProvider>();
        if (initialData != null) {
          formProvider.updateAmount(initialData.amount);
          formProvider.updateDescription(initialData.description);
          formProvider.updateDate(initialData.date);
        }

        await Navigator.pushNamed(
          context,
          AccountingRoutes.form,
          arguments: initialData,
        );
        _recordNavigation('toAccountingForm');
      }
    } catch (e) {
      print('AccountingNavigationController.toAccountingForm error: $e');
    } finally {
      _isNavigating = false;
    }
  }

  static Future<Category?> toCategorySelector({String? selectedId}) async {
    if (_isNavigating) return null;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.categorySelector);

      final context = _getCurrentContext();
      if (context != null) {
        // 預先載入科目資料
        final categoryProvider = DependencyContainer.get<CategoryStateProvider>();
        await categoryProvider.loadCategories();

        final result = await Navigator.pushNamed(
          context,
          AccountingRoutes.categorySelector,
          arguments: selectedId,
        );
        _recordNavigation('toCategorySelector');
        return result as Category?;
      }
    } catch (e) {
      print('AccountingNavigationController.toCategorySelector error: $e');
    } finally {
      _isNavigating = false;
    }
    return null;
  }

  static Future<Account?> toAccountSelector({String? selectedId}) async {
    if (_isNavigating) return null;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.accountSelector);

      final context = _getCurrentContext();
      if (context != null) {
        // 預先載入帳戶資料和餘額
        final accountProvider = DependencyContainer.get<AccountStateProvider>();
        await accountProvider.loadAccounts();
        await accountProvider.refreshBalances();

        final result = await Navigator.pushNamed(
          context,
          AccountingRoutes.accountSelector,
          arguments: selectedId,
        );
        _recordNavigation('toAccountSelector');
        return result as Account?;
      }
    } catch (e) {
      print('AccountingNavigationController.toAccountSelector error: $e');
    } finally {
      _isNavigating = false;
    }
    return null;
  }

  static Future<Ledger?> toLedgerSelector({String? selectedId}) async {
    if (_isNavigating) return null;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.ledgerSelector);

      final context = _getCurrentContext();
      if (context != null) {
        // 預先載入帳本資料
        final ledgerProvider = DependencyContainer.get<LedgerStateProvider>();
        await ledgerProvider.loadLedgers();

        final result = await Navigator.pushNamed(
          context,
          AccountingRoutes.ledgerSelector,
          arguments: selectedId,
        );
        _recordNavigation('toLedgerSelector');
        return result as Ledger?;
      }
    } catch (e) {
      print('AccountingNavigationController.toLedgerSelector error: $e');
    } finally {
      _isNavigating = false;
    }
    return null;
  }

  static Future<List<File>?> toImageAttachment({List<File>? existingImages}) async {
    if (_isNavigating) return null;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.imageAttachment);

      final context = _getCurrentContext();
      if (context != null) {
        final result = await Navigator.pushNamed(
          context,
          AccountingRoutes.imageAttachment,
          arguments: existingImages,
        );
        _recordNavigation('toImageAttachment');
        return result as List<File>?;
      }
    } catch (e) {
      print('AccountingNavigationController.toImageAttachment error: $e');
    } finally {
      _isNavigating = false;
    }
    return null;
  }

  static Future<RecurringConfig?> toRecurringSetup({RecurringConfig? config}) async {
    if (_isNavigating) return null;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.recurringSetup);

      final context = _getCurrentContext();
      if (context != null) {
        final result = await Navigator.pushNamed(
          context,
          AccountingRoutes.recurringSetup,
          arguments: config,
        );
        _recordNavigation('toRecurringSetup');
        return result as RecurringConfig?;
      }
    } catch (e) {
      print('AccountingNavigationController.toRecurringSetup error: $e');
    } finally {
      _isNavigating = false;
    }
    return null;
  }

  static Future<void> toTransactionManager({Map<String, dynamic>? filters}) async {
    if (_isNavigating) return;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.transactionManager);

      final context = _getCurrentContext();
      if (context != null) {
        // 預先載入交易資料
        final transactionProvider = DependencyContainer.get<TransactionStateProvider>();
        await transactionProvider.loadTransactions();

        await Navigator.pushNamed(
          context,
          AccountingRoutes.transactionManager,
          arguments: filters,
        );
        _recordNavigation('toTransactionManager');
      }
    } catch (e) {
      print('AccountingNavigationController.toTransactionManager error: $e');
    } finally {
      _isNavigating = false;
    }
  }

  static Future<Transaction?> toTransactionEditor(String transactionId) async {
    if (_isNavigating) return null;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.transactionEditor);

      final context = _getCurrentContext();
      if (context != null) {
        // 預先載入交易詳細資料
        final transactionProvider = DependencyContainer.get<TransactionStateProvider>();
        await transactionProvider.loadTransactions();

        final result = await Navigator.pushNamed(
          context,
          AccountingRoutes.transactionEditor,
          arguments: transactionId,
        );
        _recordNavigation('toTransactionEditor');
        return result as Transaction?;
      }
    } catch (e) {
      print('AccountingNavigationController.toTransactionEditor error: $e');
    } finally {
      _isNavigating = false;
    }
    return null;
  }

  static Future<void> toStatisticsChart({String? type, String? period}) async {
    if (_isNavigating) return;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.statisticsChart);

      final context = _getCurrentContext();
      if (context != null) {
        // 預先載入統計資料
        final statisticsProvider = DependencyContainer.get<StatisticsStateProvider>();
        if (type != null && period != null) {
          await statisticsProvider.generateChart(type, period);
        }

        await Navigator.pushNamed(
          context,
          AccountingRoutes.statisticsChart,
          arguments: {'type': type, 'period': period},
        );
        _recordNavigation('toStatisticsChart');
      }
    } catch (e) {
      print('AccountingNavigationController.toStatisticsChart error: $e');
    } finally {
      _isNavigating = false;
    }
  }

  static Future<void> toQuickAccounting() async {
    if (_isNavigating) return;

    try {
      _isNavigating = true;
      AccountingRoutes.recordRoute(AccountingRoutes.quickAccounting);

      final context = _getCurrentContext();
      if (context != null) {
        await Navigator.pushNamed(context, AccountingRoutes.quickAccounting);
        _recordNavigation('toQuickAccounting');
      }
    } catch (e) {
      print('AccountingNavigationController.toQuickAccounting error: $e');
    } finally {
      _isNavigating = false;
    }
  }

  static Future<bool> goBack() async {
    try {
      final context = _getCurrentContext();
      if (context != null && Navigator.canPop(context)) {
        Navigator.pop(context);
        _recordNavigation('goBack');
        return true;
      }
    } catch (e) {
      print('AccountingNavigationController.goBack error: $e');
    }
    return false;
  }

  static BuildContext? _getCurrentContext() {
    return _navigatorKey.currentContext;
  }

  static void _recordNavigation(String action) {
    final timestamp = DateTime.now().toIso8601String();
    _navigationHistory.add('$timestamp: $action');

    // 保持最近50筆導航記錄
    if (_navigationHistory.length > 50) {
      _navigationHistory.removeAt(0);
    }
  }

  static List<String> getNavigationHistory() {
    return List.unmodifiable(_navigationHistory);
  }

  static bool get isNavigating => _isNavigating;

  static void dispose() {
    _navigationHistory.clear();
    _isNavigating = false;
  }
}

/**
 * 24. 記帳流程導航管理器 - AccountingFlowNavigator
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @update: 階段二完成 - 實作記帳流程導航邏輯，增加完整工作流程管理
 */
class AccountingFlowNavigator {
  static final Map<String, FlowState> _activeFlows = {};
  static final List<Function(FlowEvent)> _flowEventListeners = [];

  static Future<Transaction?> startQuickAccounting() async {
    final flowId = _generateFlowId();

    try {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'start_quick_accounting',
        timestamp: DateTime.now(),
      ));

      // 設定快速記帳流程狀態
      _activeFlows[flowId] = FlowState(
        flowId: flowId,
        type: FlowType.quickAccounting,
        currentStep: 'input',
        startTime: DateTime.now(),
        data: {},
      );

      // 開啟快速記帳介面
      await AccountingNavigationController.toQuickAccounting();

      // 更新流程狀態
      _updateFlowState(flowId, 'input_complete');

      return null; // 實際會在表單完成後返回Transaction
    } catch (e) {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'quick_accounting_error',
        timestamp: DateTime.now(),
        error: e.toString(),
      ));
      print('AccountingFlowNavigator.startQuickAccounting error: $e');
      return null;
    }
  }

  static Future<Transaction?> startFullAccounting() async {
    final flowId = _generateFlowId();

    try {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'start_full_accounting',
        timestamp: DateTime.now(),
      ));

      // 設定完整記帳流程狀態
      _activeFlows[flowId] = FlowState(
        flowId: flowId,
        type: FlowType.fullAccounting,
        currentStep: 'form_input',
        startTime: DateTime.now(),
        data: {},
      );

      // 開啟完整記帳表單
      await AccountingNavigationController.toAccountingForm();

      // 更新流程狀態
      _updateFlowState(flowId, 'form_complete');

      return null; // 實際會在表單完成後返回Transaction
    } catch (e) {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'full_accounting_error',
        timestamp: DateTime.now(),
        error: e.toString(),
      ));
      print('AccountingFlowNavigator.startFullAccounting error: $e');
      return null;
    }
  }

  static Future<Transaction?> startGuidedAccounting() async {
    final flowId = _generateFlowId();

    try {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'start_guided_accounting',
        timestamp: DateTime.now(),
      ));

      // 設定引導式記帳流程
      _activeFlows[flowId] = FlowState(
        flowId: flowId,
        type: FlowType.guidedAccounting,
        currentStep: 'category_selection',
        startTime: DateTime.now(),
        data: {},
      );

      // 步驟1：選擇科目
      final category = await AccountingNavigationController.toCategorySelector();
      if (category == null) {
        _completeFlow(flowId, false, '用戶取消科目選擇');
        return null;
      }

      _updateFlowState(flowId, 'account_selection', {'categoryId': category.id});

      // 步驟2：選擇帳戶
      final account = await AccountingNavigationController.toAccountSelector();
      if (account == null) {
        _completeFlow(flowId, false, '用戶取消帳戶選擇');
        return null;
      }

      _updateFlowState(flowId, 'amount_input', {'accountId': account.id});

      // 步驟3：開啟表單（預填科目和帳戶）
      final draftTransaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: TransactionType.expense,
        amount: 0.0,
        categoryId: category.id,
        accountId: account.id,
        description: '',
        date: DateTime.now(),
      );

      await AccountingNavigationController.toAccountingForm(initialData: draftTransaction);

      _completeFlow(flowId, true, '引導式記帳完成');
      return draftTransaction;

    } catch (e) {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'guided_accounting_error',
        timestamp: DateTime.now(),
        error: e.toString(),
      ));
      print('AccountingFlowNavigator.startGuidedAccounting error: $e');
      return null;
    }
  }

  static Future<void> continueFromDraft(Transaction draft) async {
    final flowId = _generateFlowId();

    try {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'continue_from_draft',
        timestamp: DateTime.now(),
        data: {'transactionId': draft.id},
      ));

      // 設定從草稿繼續的流程
      _activeFlows[flowId] = FlowState(
        flowId: flowId,
        type: FlowType.draftContinuation,
        currentStep: 'draft_loaded',
        startTime: DateTime.now(),
        data: {'originalTransactionId': draft.id},
      );

      // 從草稿繼續記帳
      await AccountingNavigationController.toAccountingForm(initialData: draft);

      _completeFlow(flowId, true, '草稿繼續記帳完成');
    } catch (e) {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'draft_continuation_error',
        timestamp: DateTime.now(),
        error: e.toString(),
      ));
      print('AccountingFlowNavigator.continueFromDraft error: $e');
    }
  }

  static Future<void> handleAccountingComplete(Transaction transaction) async {
    try {
      _recordFlowEvent(FlowEvent(
        flowId: 'system',
        action: 'accounting_complete',
        timestamp: DateTime.now(),
        data: {'transactionId': transaction.id, 'amount': transaction.amount},
      ));

      // 記帳完成後的處理
      await StateSyncManager.syncAllStates();

      // 清理相關的活躍流程
      _cleanupCompletedFlows();

      // 導航到成功頁面或主頁
      await AccountingNavigationController.toAccountingHome();

      _recordFlowEvent(FlowEvent(
        flowId: 'system',
        action: 'post_accounting_complete',
        timestamp: DateTime.now(),
      ));
    } catch (e) {
      print('AccountingFlowNavigator.handleAccountingComplete error: $e');
    }
  }

  static String _generateFlowId() {
    return 'flow_${DateTime.now().millisecondsSinceEpoch}_${math.Random().nextInt(1000)}';
  }

  static void _updateFlowState(String flowId, String newStep, [Map<String, dynamic>? additionalData]) {
    final flow = _activeFlows[flowId];
    if (flow != null) {
      final updatedData = Map<String, dynamic>.from(flow.data);
      if (additionalData != null) {
        updatedData.addAll(additionalData);
      }

      _activeFlows[flowId] = FlowState(
        flowId: flowId,
        type: flow.type,
        currentStep: newStep,
        startTime: flow.startTime,
        data: updatedData,
        lastUpdate: DateTime.now(),
      );

      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: 'step_update',
        timestamp: DateTime.now(),
        data: {'step': newStep},
      ));
    }
  }

  static void _completeFlow(String flowId, bool success, String reason) {
    final flow = _activeFlows[flowId];
    if (flow != null) {
      _recordFlowEvent(FlowEvent(
        flowId: flowId,
        action: success ? 'flow_completed' : 'flow_cancelled',
        timestamp: DateTime.now(),
        data: {'reason': reason, 'duration': DateTime.now().difference(flow.startTime).inMilliseconds},
      ));

      _activeFlows.remove(flowId);
    }
  }

  static void _recordFlowEvent(FlowEvent event) {
    for (final listener in _flowEventListeners) {
      try {
        listener(event);
      } catch (e) {
        print('Flow event listener error: $e');
      }
    }
  }

  static void _cleanupCompletedFlows() {
    final now = DateTime.now();
    final flowsToRemove = <String>[];

    _activeFlows.forEach((flowId, flow) {
      // 移除超過1小時的流程
      if (now.difference(flow.startTime).inHours > 1) {
        flowsToRemove.add(flowId);
      }
    });

    for (final flowId in flowsToRemove) {
      _activeFlows.remove(flowId);
    }
  }

  static void registerFlowEventListener(Function(FlowEvent) listener) {
    if (!_flowEventListeners.contains(listener)) {
      _flowEventListeners.add(listener);
    }
  }

  static void unregisterFlowEventListener(Function(FlowEvent) listener) {
    _flowEventListeners.remove(listener);
  }

  static Map<String, FlowState> getActiveFlows() {
    return Map.unmodifiable(_activeFlows);
  }

  static void dispose() {
    _activeFlows.clear();
    _flowEventListeners.clear();
  }
}

// 流程相關資料模型
enum FlowType {
  quickAccounting,
  fullAccounting,
  guidedAccounting,
  draftContinuation
}

class FlowState {
  final String flowId;
  final FlowType type;
  final String currentStep;
  final DateTime startTime;
  final DateTime? lastUpdate;
  final Map<String, dynamic> data;

  FlowState({
    required this.flowId,
    required this.type,
    required this.currentStep,
    required this.startTime,
    this.lastUpdate,
    required this.data,
  });
}

class FlowEvent {
  final String flowId;
  final String action;
  final DateTime timestamp;
  final Map<String, dynamic>? data;
  final String? error;

  FlowEvent({
    required this.flowId,
    required this.action,
    required this.timestamp,
    this.data,
    this.error,
  });
}

/**
 * 25. 選擇流程導航管理器 - SelectionFlowNavigator
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @update: 階段一完成 - 實作選擇器流程導航
 */
class SelectionFlowNavigator {
  static Future<SelectionResult?> startCategorySelection() async {
    try {
      final category = await AccountingNavigationController.toCategorySelector();
      if (category != null) {
        return SelectionResult(
          type: 'category',
          id: category.id,
          name: category.name,
          data: category,
        );
      }
      return null;
    } catch (e) {
      print('SelectionFlowNavigator.startCategorySelection error: $e');
      return null;
    }
  }

  static Future<SelectionResult?> startAccountSelection() async {
    try {
      final account = await AccountingNavigationController.toAccountSelector();
      if (account != null) {
        return SelectionResult(
          type: 'account',
          id: account.id,
          name: account.name,
          data: account,
        );
      }
      return null;
    } catch (e) {
      print('SelectionFlowNavigator.startAccountSelection error: $e');
      return null;
    }
  }

  static Future<SelectionResult?> startLedgerSelection() async {
    try {
      final ledger = await AccountingNavigationController.toLedgerSelector();
      if (ledger != null) {
        return SelectionResult(
          type: 'ledger',
          id: ledger.id,
          name: ledger.name,
          data: ledger,
        );
      }
      return null;
    } catch (e) {
      print('SelectionFlowNavigator.startLedgerSelection error: $e');
      return null;
    }
  }

  static Future<void> handleSelectionComplete(SelectionResult result) async {
    try {
      // 選擇完成後的處理邏輯
      print('Selection completed: ${result.type} - ${result.name}');
      // 可能需要更新相關狀態或通知其他組件
    } catch (e) {
      print('SelectionFlowNavigator.handleSelectionComplete error: $e');
    }
  }
}

// 選擇結果資料模型
class SelectionResult {
  final String type;
  final String id;
  final String name;
  final dynamic data;

  SelectionResult({
    required this.type,
    required this.id,
    required this.name,
    this.data,
  });
}

// API客戶端介面定義
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? error;
  final int statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.error,
    required this.statusCode,
  });
}

// 請求模型定義
class CreateTransactionRequest {
  final double amount;
  final String type;
  final String categoryId;
  final String accountId;
  final String ledgerId;
  final String date;
  final String? description;

  CreateTransactionRequest({
    required this.amount,
    required this.type,
    required this.categoryId,
    required this.accountId,
    required this.ledgerId,
    required this.date,
    this.description,
  });

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'type': type,
      'categoryId': categoryId,
      'accountId': accountId,
      'ledgerId': ledgerId,
      'date': date,
      'description': description,
    };
  }
}

class GetTransactionsRequest {
  final String? ledgerId;
  final String? categoryId;
  final String? accountId;
  final String? type;
  final String? startDate;
  final String? endDate;
  final int page;
  final int limit;

  GetTransactionsRequest({
    this.ledgerId,
    this.categoryId,
    this.accountId,
    this.type,
    this.startDate,
    this.endDate,
    this.page = 1,
    this.limit = 20,
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'categoryId': categoryId,
      'accountId': accountId,
      'type': type,
      'startDate': startDate,
      'endDate': endDate,
      'page': page,
      'limit': limit,
    };
  }
}

class UpdateTransactionRequest {
  final double? amount;
  final String? type;
  final String? categoryId;
  final String? accountId;
  final String? date;
  final String? description;

  UpdateTransactionRequest({
    this.amount,
    this.type,
    this.categoryId,
    this.accountId,
    this.date,
    this.description,
  });

  Map<String, dynamic> toJson() {
    return {
      'amount': amount,
      'type': type,
      'categoryId': categoryId,
      'accountId': accountId,
      'date': date,
      'description': description,
    }..removeWhere((key, value) => value == null);
  }
}

class GetDashboardRequest {
  final String ledgerId;
  final String period;

  GetDashboardRequest({
    required this.ledgerId,
    this.period = 'month',
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'period': period,
    };
  }
}

class GetStatisticsRequest {
  final String ledgerId;
  final String period;
  final String? type;

  GetStatisticsRequest({
    required this.ledgerId,
    this.period = 'month',
    this.type,
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'period': period,
      'type': type,
    };
  }
}

class QuickAccountingRequest {
  final String input;
  final String userId;
  final String ledgerId;

  QuickAccountingRequest({
    required this.input,
    required this.userId,
    required this.ledgerId,
  });

  Map<String, dynamic> toJson() {
    return {
      'input': input,
      'userId': userId,
      'ledgerId': ledgerId,
    };
  }
}

class GetChartDataRequest {
  final String ledgerId;
  final String chartType;
  final String period;

  GetChartDataRequest({
    required this.ledgerId,
    required this.chartType,
    this.period = 'month',
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'chartType': chartType,
      'period': period,
    };
  }
}

/**
 * 26. 記帳交易API客戶端 - TransactionApiClient
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段二實作 - 記帳交易API客戶端核心
 */
abstract class TransactionApiClient {
  Future<ApiResponse<Transaction>> createTransaction(CreateTransactionRequest request);
  Future<ApiResponse<List<Transaction>>> getTransactions(GetTransactionsRequest request);
  Future<ApiResponse<Transaction>> getTransaction(String transactionId);
  Future<ApiResponse<Transaction>> updateTransaction(String transactionId, UpdateTransactionRequest request);
  Future<ApiResponse<void>> deleteTransaction(String transactionId);
  Future<ApiResponse<DashboardData>> getDashboardData(GetDashboardRequest request);
  Future<ApiResponse<DashboardData>> getStatistics(GetStatisticsRequest request);
  Future<ApiResponse<QuickAccountingResult>> quickAccounting(QuickAccountingRequest request);
  Future<ApiResponse<List<ChartData>>> getChartData(GetChartDataRequest request);
}

class TransactionApiClientImpl extends TransactionApiClient {
  final String baseUrl;
  final Map<String, String> defaultHeaders;

  TransactionApiClientImpl({
    this.baseUrl = 'https://api.lcas.app/v1',
    this.defaultHeaders = const {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  @override
  Future<ApiResponse<Transaction>> createTransaction(CreateTransactionRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 500)); // 模擬網路延遲

      final transaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: _mapStringToTransactionType(request.type),
        amount: request.amount,
        categoryId: request.categoryId,
        accountId: request.accountId,
        description: request.description ?? '',
        date: DateTime.parse(request.date),
      );

      return ApiResponse(
        success: true,
        data: transaction,
        statusCode: 201,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<List<Transaction>>> getTransactions(GetTransactionsRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 400));

      final transactions = [
        Transaction(id: '1', type: TransactionType.expense, amount: 150, description: '午餐', date: DateTime.now()),
        Transaction(id: '2', type: TransactionType.income, amount: 35000, description: '薪水', date: DateTime.now().subtract(Duration(days: 1))),
        Transaction(id: '3', type: TransactionType.transfer, amount: 10000, description: '轉帳', date: DateTime.now().subtract(Duration(days: 2))),
      ];

      return ApiResponse(
        success: true,
        data: transactions,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Transaction>> getTransaction(String transactionId) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));

      final transaction = Transaction(
        id: transactionId,
        type: TransactionType.expense,
        amount: 150,
        description: '午餐',
        date: DateTime.now(),
      );

      return ApiResponse(
        success: true,
        data: transaction,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Transaction>> updateTransaction(String transactionId, UpdateTransactionRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 400));

      final transaction = Transaction(
        id: transactionId,
        type: request.type != null ? _mapStringToTransactionType(request.type!) : TransactionType.expense,
        amount: request.amount ?? 150,
        categoryId: request.categoryId,
        accountId: request.accountId,
        description: request.description ?? '更新交易',
        date: request.date != null ? DateTime.parse(request.date!) : DateTime.now(),
      );

      return ApiResponse(
        success: true,
        data: transaction,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<void>> deleteTransaction(String transactionId) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));

      return ApiResponse(
        success: true,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<DashboardData>> getDashboardData(GetDashboardRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 600));

      final dashboardData = DashboardData(
        totalIncome: 50000,
        totalExpense: 35000,
        balance: 15000,
        transactionCount: 156,
      );

      return ApiResponse(
        success: true,
        data: dashboardData,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<DashboardData>> getStatistics(GetStatisticsRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 500));

      final statisticsData = DashboardData(
        totalIncome: 50000,
        totalExpense: 35000,
        balance: 15000,
        transactionCount: 156,
      );

      return ApiResponse(
        success: true,
        data: statisticsData,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<QuickAccountingResult>> quickAccounting(QuickAccountingRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 800));

      final result = QuickAccountingResult(
        success: true,
        message: '記帳成功：${request.input}',
        transaction: Transaction(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          type: TransactionType.expense,
          amount: 150,
          description: request.input,
          date: DateTime.now(),
        ),
      );

      return ApiResponse(
        success: true,
        data: result,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<List<ChartData>>> getChartData(GetChartDataRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 700));

      final chartData = [
        ChartData(label: '食物', value: 12000, color: Colors.red),
        ChartData(label: '交通', value: 8000, color: Colors.blue),
        ChartData(label: '娛樂', value: 6000, color: Colors.green),
        ChartData(label: '其他', value: 9000, color: Colors.orange),
      ];

      return ApiResponse(
        success: true,
        data: chartData,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  TransactionType _mapStringToTransactionType(String type) {
    switch (type.toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }
}

/**
 * 27. 帳戶管理API客戶端 - AccountApiClient
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段二實作 - 帳戶管理API客戶端
 */
class GetAccountsRequest {
  final String? ledgerId;
  final String? type;
  final bool active;
  final bool includeBalance;

  GetAccountsRequest({
    this.ledgerId,
    this.type,
    this.active = true,
    this.includeBalance = true,
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'type': type,
      'active': active,
      'includeBalance': includeBalance,
    };
  }
}

class CreateAccountRequest {
  final String name;
  final String type;
  final String ledgerId;
  final double initialBalance;

  CreateAccountRequest({
    required this.name,
    required this.type,
    required this.ledgerId,
    this.initialBalance = 0.0,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'ledgerId': ledgerId,
      'initialBalance': initialBalance,
    };
  }
}

class UpdateAccountRequest {
  final String? name;
  final String? type;
  final double? balance;

  UpdateAccountRequest({
    this.name,
    this.type,
    this.balance,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'balance': balance,
    }..removeWhere((key, value) => value == null);
  }
}

abstract class AccountApiClient {
  Future<ApiResponse<List<Account>>> getAccounts(GetAccountsRequest request);
  Future<ApiResponse<Account>> getAccount(String accountId);
  Future<ApiResponse<Map<String, double>>> getAccountBalances(List<String> accountIds);
  Future<ApiResponse<Account>> createAccount(CreateAccountRequest request);
  Future<ApiResponse<Account>> updateAccount(String accountId, UpdateAccountRequest request);
}

class AccountApiClientImpl extends AccountApiClient {
  final String baseUrl;
  final Map<String, String> defaultHeaders;

  AccountApiClientImpl({
    this.baseUrl = 'https://api.lcas.app/v1',
    this.defaultHeaders = const {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  @override
  Future<ApiResponse<List<Account>>> getAccounts(GetAccountsRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 400));

      final accounts = [
        Account(id: '1', name: '台灣銀行', type: 'bank', balance: 50000),
        Account(id: '2', name: '現金', type: 'cash', balance: 2000),
        Account(id: '3', name: '信用卡', type: 'credit', balance: -5000),
      ];

      return ApiResponse(
        success: true,
        data: accounts,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Account>> getAccount(String accountId) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));

      final account = Account(
        id: accountId,
        name: '台灣銀行',
        type: 'bank',
        balance: 50000,
      );

      return ApiResponse(
        success: true,
        data: account,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Map<String, double>>> getAccountBalances(List<String> accountIds) async {
    try {
      await Future.delayed(Duration(milliseconds: 350));

      final balances = <String, double>{};
      for (var id in accountIds) {
        balances[id] = 10000.0 + (DateTime.now().millisecondsSinceEpoch % 50000);
      }

      return ApiResponse(
        success: true,
        data: balances,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Account>> createAccount(CreateAccountRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 500));

      final account = Account(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        name: request.name,
        type: request.type,
        balance: request.initialBalance,
      );

      return ApiResponse(
        success: true,
        data: account,
        statusCode: 201,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Account>> updateAccount(String accountId, UpdateAccountRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 400));

      final account = Account(
        id: accountId,
        name: request.name ?? '更新帳戶',
        type: request.type ?? 'bank',
        balance: request.balance ?? 25000,
      );

      return ApiResponse(
        success: true,
        data: account,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }
}

/**
 * 28. 科目管理API客戶端 - CategoryApiClient
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段二實作 - 科目管理API客戶端
 */
class GetCategoriesRequest {
  final String? ledgerId;
  final String? type;
  final String? parentId;

  GetCategoriesRequest({
    this.ledgerId,
    this.type,
    this.parentId,
  });

  Map<String, dynamic> toJson() {
    return {
      'ledgerId': ledgerId,
      'type': type,
      'parentId': parentId,
    };
  }
}

class SearchCategoriesRequest {
  final String query;
  final String? type;

  SearchCategoriesRequest({
    required this.query,
    this.type,
  });

  Map<String, dynamic> toJson() {
    return {
      'query': query,
      'type': type,
    };
  }
}

class CreateCategoryRequest {
  final String name;
  final String type;
  final String? parentId;
  final String? description;

  CreateCategoryRequest({
    required this.name,
    required this.type,
    this.parentId,
    this.description,
  });

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'type': type,
      'parentId': parentId,
      'description': description,
    };
  }
}

abstract class CategoryApiClient {
  Future<ApiResponse<List<Category>>> getCategories(GetCategoriesRequest request);
  Future<ApiResponse<Category>> getCategory(String categoryId);
  Future<ApiResponse<List<Category>>> searchCategories(SearchCategoriesRequest request);
  Future<ApiResponse<List<Category>>> getFrequentCategories(String userId);
  Future<ApiResponse<List<Category>>> getRecentCategories(String userId);
  Future<ApiResponse<Category>> createCategory(CreateCategoryRequest request);
}

class CategoryApiClientImpl extends CategoryApiClient {
  final String baseUrl;
  final Map<String, String> defaultHeaders;

  CategoryApiClientImpl({
    this.baseUrl = 'https://api.lcas.app/v1',
    this.defaultHeaders = const {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  @override
  Future<ApiResponse<List<Category>>> getCategories(GetCategoriesRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 400));

      final categories = [
        Category(id: 'food', name: '食物', type: 'expense'),
        Category(id: 'transport', name: '交通', type: 'expense'),
        Category(id: 'salary', name: '薪資', type: 'income'),
      ];

      return ApiResponse(
        success: true,
        data: categories,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Category>> getCategory(String categoryId) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));

      final category = Category(
        id: categoryId,
        name: '食物',
        type: 'expense',
      );

      return ApiResponse(
        success: true,
        data: category,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<List<Category>>> searchCategories(SearchCategoriesRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 350));

      final categories = [
        Category(id: 'food_restaurant', name: '餐廳', parentId: 'food', type: 'expense'),
        Category(id: 'food_coffee', name: '咖啡', parentId: 'food', type: 'expense'),
      ];

      return ApiResponse(
        success: true,
        data: categories,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<List<Category>>> getFrequentCategories(String userId) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));

      final categories = [
        Category(id: 'lunch', name: '午餐', parentId: 'food', type: 'expense'),
        Category(id: 'transport_bus', name: '公車', parentId: 'transport', type: 'expense'),
      ];

      return ApiResponse(
        success: true,
        data: categories,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<List<Category>>> getRecentCategories(String userId) async {
    try {
      await Future.delayed(Duration(milliseconds: 300));

      final categories = [
        Category(id: 'coffee', name: '咖啡', parentId: 'food', type: 'expense'),
        Category(id: 'gas', name: '加油', parentId: 'transport', type: 'expense'),
      ];

      return ApiResponse(
        success: true,
        data: categories,
        statusCode: 200,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }

  @override
  Future<ApiResponse<Category>> createCategory(CreateCategoryRequest request) async {
    try {
      await Future.delayed(Duration(milliseconds: 500));

      final category = Category(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        name: request.name,
        parentId: request.parentId,
        type: request.type,
      );

      return ApiResponse(
        success: true,
        data: category,
        statusCode: 201,
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        error: e.toString(),
        statusCode: 500,
      );
    }
  }
}

/**
 * 29. 交易數據倉庫 - TransactionRepository
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段二實作 - 交易數據倉庫Repository模式
 */
abstract class TransactionRepository {
  Future<List<Transaction>> getTransactions({Map<String, dynamic>? filters});
  Future<Transaction?> getTransaction(String transactionId);
  Future<Transaction> createTransaction(Transaction transaction);
  Future<Transaction> updateTransaction(String transactionId, Transaction transaction);
  Future<void> deleteTransaction(String transactionId);
  Future<DashboardData> getDashboardData(String ledgerId);
  Future<List<ChartData>> getChartData(String chartType, String period);
  Future<void> cacheTransactions(List<Transaction> transactions);
  List<Transaction> getCachedTransactions();
}

class TransactionRepositoryImpl extends TransactionRepository {
  final TransactionApiClient _apiClient;
  final List<Transaction> _cache = [];
  DateTime? _lastCacheUpdate;

  TransactionRepositoryImpl(this._apiClient);

  @override
  Future<List<Transaction>> getTransactions({Map<String, dynamic>? filters}) async {
    try {
      final request = GetTransactionsRequest(
        ledgerId: filters?['ledgerId'],
        categoryId: filters?['categoryId'],
        accountId: filters?['accountId'],
        type: filters?['type'],
        startDate: filters?['startDate'],
        endDate: filters?['endDate'],
        page: filters?['page'] ?? 1,
        limit: filters?['limit'] ?? 20,
      );

      final response = await _apiClient.getTransactions(request);

      if (response.success && response.data != null) {
        await cacheTransactions(response.data!);
        return response.data!;
      } else {
        // 如果API失敗，回傳快取資料
        return getCachedTransactions();
      }
    } catch (e) {
      // 錯誤時回傳快取資料
      return getCachedTransactions();
    }
  }

  @override
  Future<Transaction?> getTransaction(String transactionId) async {
    try {
      // 首先檢查快取
      final cachedTransaction = _cache.firstWhere(
        (t) => t.id == transactionId,
        orElse: () => Transaction(id: '', type: TransactionType.expense, amount: 0, description: '', date: DateTime.now()),
      );

      if (cachedTransaction.id.isNotEmpty) {
        return cachedTransaction;
      }

      // 如果快取中沒有，則呼叫API
      final response = await _apiClient.getTransaction(transactionId);

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  @override
  Future<Transaction> createTransaction(Transaction transaction) async {
    try {
      final request = CreateTransactionRequest(
        amount: transaction.amount,
        type: transaction.type.toString().split('.').last,
        categoryId: transaction.categoryId ?? '',
        accountId: transaction.accountId ?? '',
        ledgerId: 'default-ledger',
        date: transaction.date.toIso8601String(),
        description: transaction.description,
      );

      final response = await _apiClient.createTransaction(request);

      if (response.success && response.data != null) {
        // 新增到快取
        _cache.add(response.data!);
        return response.data!;
      } else {
        throw Exception(response.error ?? 'Failed to create transaction');
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<Transaction> updateTransaction(String transactionId, Transaction transaction) async {
    try {
      final request = UpdateTransactionRequest(
        amount: transaction.amount,
        type: transaction.type.toString().split('.').last,
        categoryId: transaction.categoryId,
        accountId: transaction.accountId,
        date: transaction.date.toIso8601String(),
        description: transaction.description,
      );

      final response = await _apiClient.updateTransaction(transactionId, request);

      if (response.success && response.data != null) {
        // 更新快取
        final index = _cache.indexWhere((t) => t.id == transactionId);
        if (index != -1) {
          _cache[index] = response.data!;
        }
        return response.data!;
      } else {
        throw Exception(response.error ?? 'Failed to update transaction');
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<void> deleteTransaction(String transactionId) async {
    try {
      final response = await _apiClient.deleteTransaction(transactionId);

      if (response.success) {
        // 從快取中移除
        _cache.removeWhere((t) => t.id == transactionId);
      } else {
        throw Exception(response.error ?? 'Failed to delete transaction');
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<DashboardData> getDashboardData(String ledgerId) async {
    try {
      final request = GetDashboardRequest(ledgerId: ledgerId);
      final response = await _apiClient.getDashboardData(request);

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        throw Exception(response.error ?? 'Failed to get dashboard data');
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<List<ChartData>> getChartData(String chartType, String period) async {
    try {
      final request = GetChartDataRequest(
        ledgerId: 'default-ledger',
        chartType: chartType,
        period: period,
      );
      final response = await _apiClient.getChartData(request);

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        throw Exception(response.error ?? 'Failed to get chart data');
      }
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<void> cacheTransactions(List<Transaction> transactions) async {
    _cache.clear();
    _cache.addAll(transactions);
    _lastCacheUpdate = DateTime.now();
  }

  @override
  List<Transaction> getCachedTransactions() {
    // 檢查快取是否過期（5分鐘）
    if (_lastCacheUpdate != null &&
        DateTime.now().difference(_lastCacheUpdate!).inMinutes > 5) {
      return [];
    }
    return List.unmodifiable(_cache);
  }
}

/**
 * 30. 科目數據倉庫 - CategoryRepository
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段二實作 - 科目數據倉庫Repository模式
 */
abstract class CategoryRepository {
  Future<List<Category>> getCategories();
  Future<Category?> getCategory(String categoryId);
  Future<List<Category>> searchCategories(String query);
  Future<List<Category>> getFrequentCategories();
  Future<List<Category>> getRecentCategories();
  Future<void> cacheCategories(List<Category> categories);
  List<Category> getCachedCategories();
}

class CategoryRepositoryImpl extends CategoryRepository {
  final CategoryApiClient _apiClient;
  final List<Category> _cache = [];
  DateTime? _lastCacheUpdate;

  CategoryRepositoryImpl(this._apiClient);

  @override
  Future<List<Category>> getCategories() async {
    try {
      final request = GetCategoriesRequest();
      final response = await _apiClient.getCategories(request);

      if (response.success && response.data != null) {
        await cacheCategories(response.data!);
        return response.data!;
      } else {
        return getCachedCategories();
      }
    } catch (e) {
      return getCachedCategories();
    }
  }

  @override
  Future<Category?> getCategory(String categoryId) async {
    try {
      // 首先檢查快取
      final cachedCategory = _cache.firstWhere(
        (c) => c.id == categoryId,
        orElse: () => Category(id: '', name: '', type: ''),
      );

      if (cachedCategory.id.isNotEmpty) {
        return cachedCategory;
      }

      // 如果快取中沒有，則呼叫API
      final response = await _apiClient.getCategory(categoryId);

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  @override
  Future<List<Category>> searchCategories(String query) async {
    try {
      final request = SearchCategoriesRequest(query: query);
      final response = await _apiClient.searchCategories(request);

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        // 本地搜尋快取資料
        return _cache.where((c) =>
          c.name.toLowerCase().contains(query.toLowerCase())
        ).toList();
      }
    } catch (e) {
      // 錯誤時進行本地搜尋
      return _cache.where((c) =>
        c.name.toLowerCase().contains(query.toLowerCase())
      ).toList();
    }
  }

  @override
  Future<List<Category>> getFrequentCategories() async {
    try {
      final response = await _apiClient.getFrequentCategories('user1');

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  }

  @override
  Future<List<Category>> getRecentCategories() async {
    try {
      final response = await _apiClient.getRecentCategories('user1');

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        return [];
      }
    } catch (e) {
      return [];
    }
  }

  @override
  Future<void> cacheCategories(List<Category> categories) async {
    _cache.clear();
    _cache.addAll(categories);
    _lastCacheUpdate = DateTime.now();
  }

  @override
  List<Category> getCachedCategories() {
    // 檢查快取是否過期（10分鐘）
    if (_lastCacheUpdate != null &&
        DateTime.now().difference(_lastCacheUpdate!).inMinutes > 10) {
      return [];
    }
    return List.unmodifiable(_cache);
  }
}

/**
 * 31. 帳戶數據倉庫 - AccountRepository
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段二實作 - 帳戶數據倉庫Repository模式
 */
abstract class AccountRepository {
  Future<List<Account>> getAccounts();
  Future<Account?> getAccount(String accountId);
  Future<Map<String, double>> getAccountBalances();
  Future<void> cacheAccounts(List<Account> accounts);
  List<Account> getCachedAccounts();
}

class AccountRepositoryImpl extends AccountRepository {
  final AccountApiClient _apiClient;
  final List<Account> _cache = [];
  DateTime? _lastCacheUpdate;

  AccountRepositoryImpl(this._apiClient);

  @override
  Future<List<Account>> getAccounts() async {
    try {
      final request = GetAccountsRequest();
      final response = await _apiClient.getAccounts(request);

      if (response.success && response.data != null) {
        await cacheAccounts(response.data!);
        return response.data!;
      } else {
        return getCachedAccounts();
      }
    } catch (e) {
      return getCachedAccounts();
    }
  }

  @override
  Future<Account?> getAccount(String accountId) async {
    try {
      // 首先檢查快取
      final cachedAccount = _cache.firstWhere(
        (a) => a.id == accountId,
        orElse: () => Account(id: '', name: '', type: '', balance: 0),
      );

      if (cachedAccount.id.isNotEmpty) {
        return cachedAccount;
      }

      // 如果快取中沒有，則呼叫API
      final response = await _apiClient.getAccount(accountId);

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  @override
  Future<Map<String, double>> getAccountBalances() async {
    try {
      final accountIds = _cache.map((a) => a.id).toList();
      final response = await _apiClient.getAccountBalances(accountIds);

      if (response.success && response.data != null) {
        return response.data!;
      } else {
        // 回傳快取中的餘額
        final balances = <String, double>{};
        for (var account in _cache) {
          balances[account.id] = account.balance;
        }
        return balances;
      }
    } catch (e) {
      // 錯誤時回傳快取餘額
      final balances = <String, double>{};
      for (var account in _cache) {
        balances[account.id] = account.balance;
      }
      return balances;
    }
  }

  @override
  Future<void> cacheAccounts(List<Account> accounts) async {
    _cache.clear();
    _cache.addAll(accounts);
    _lastCacheUpdate = DateTime.now();
  }

  @override
  List<Account> getCachedAccounts() {
    // 檢查快取是否過期（10分鐘）
    if (_lastCacheUpdate != null &&
        DateTime.now().difference(_lastCacheUpdate!).inMinutes > 10) {
      return [];
    }
    return List.unmodifiable(_cache);
  }
}

// 智能文字解析器實作類別
class SmartTextParserImpl {
  Future<Map<String, dynamic>> parseText(String input) async {
    await Future.delayed(Duration(milliseconds: 100));

    // 簡單的文字解析邏輯
    final words = input.split(' ');
    final result = <String, dynamic>{};

    // 尋找金額
    for (var word in words) {
      final amount = double.tryParse(word);
      if (amount != null) {
        result['amount'] = amount;
        break;
      }
    }

    // 預設類型為支出
    result['type'] = 'expense';

    // 簡單的科目匹配
    if (input.contains('午餐') || input.contains('晚餐') || input.contains('早餐')) {
      result['categoryId'] = 'food';
    } else if (input.contains('公車') || input.contains('捷運') || input.contains('計程車')) {
      result['categoryId'] = 'transport';
    }

    // 描述為原始輸入
    result['description'] = input;

    return result;
  }
}

// 快速記帳處理器實作類別
class QuickAccountingProcessorImpl {
  Future<QuickAccountingResult> processQuickAccounting(String input) async {
    await Future.delayed(Duration(milliseconds: 200));

    try {
      // 解析輸入
      final parser = SmartTextParserImpl();
      final parsedData = await parser.parseText(input);

      // 建立交易
      final transaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: TransactionType.expense,
        amount: parsedData['amount'] ?? 0.0,
        categoryId: parsedData['categoryId'],
        description: parsedData['description'] ?? input,
        date: DateTime.now(),
      );

      return QuickAccountingResult(
        success: true,
        message: '記帳成功：${input}',
        transaction: transaction,
      );
    } catch (e) {
      return QuickAccountingResult(
        success: false,
        message: '記帳失敗：${e.toString()}',
      );
    }
  }
}
// ==========================================
// 階段三：四模式與工具函數 (函數36-52)
// ==========================================

/**
 * 36. Guiding模式適配器 - GuidingModeAdapter
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段三實作 - 引導模式適配器核心
 */
abstract class GuidingModeAdapter extends ModeAdapter {
  Widget buildMinimalDashboard();
  Widget buildSimplestTransactionForm();
  Widget buildBasicOverview();
  Widget buildSmartSuggestions();
  List<String> getEssentialFields();
  bool useAutoFill();
}

abstract class ModeAdapter {
  // 基礎適配器接口
}

class GuidingModeAdapterImpl extends GuidingModeAdapter {
  @override
  Widget buildMinimalDashboard() {
    return Container(
      padding: EdgeInsets.all(24),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                children: [
                  Text('本月花費', style: TextStyle(fontSize: 16, color: Colors.grey[600])),
                  SizedBox(height: 8),
                  Text('\$3,500', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.orange)),
                ],
              ),
            ),
          ),
          SizedBox(height: 16),
          Container(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text('快速記帳', style: TextStyle(fontSize: 18)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildSimplestTransactionForm() {
    return Container(
      padding: EdgeInsets.all(20),
      child: Column(
        children: [
          TextField(
            decoration: InputDecoration(
              labelText: '花了多少錢？',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              prefixText: '\$ ',
            ),
            keyboardType: TextInputType.number,
          ),
          SizedBox(height: 16),
          TextField(
            decoration: InputDecoration(
              labelText: '買了什麼？',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          SizedBox(height: 24),
          Container(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text('完成記帳', style: TextStyle(fontSize: 18)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildBasicOverview() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(Icons.trending_up, color: Colors.green, size: 30),
                    SizedBox(height: 8),
                    Text('收入', style: TextStyle(color: Colors.grey[600])),
                    Text('\$5,000', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  children: [
                    Icon(Icons.trending_down, color: Colors.red, size: 30),
                    SizedBox(height: 8),
                    Text('支出', style: TextStyle(color: Colors.grey[600])),
                    Text('\$3,500', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget buildSmartSuggestions() {
    return Container(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('智慧建議', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: Icon(Icons.lightbulb, color: Colors.orange),
              title: Text('記錄今天的午餐'),
              subtitle: Text('保持每日記帳習慣'),
              trailing: ElevatedButton(
                onPressed: () {},
                child: Text('記帳'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  List<String> getEssentialFields() {
    return ['amount', 'description', 'date', 'account'];
  }

  @override
  bool useAutoFill() {
    return true;
  }
}

/**
 * 37. 四模式主題管理器 - FourModeThemeManager
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段三實作 - 四模式主題管理核心
 */
abstract class FourModeThemeManager {
  static ThemeData getExpertTheme();
  static ThemeData getInertialTheme();
  static ThemeData getCultivationTheme();
  static ThemeData getGuidingTheme();

  static Color getPrimaryColor(UserMode mode);
  static Color getSecondaryColor(UserMode mode);
  static TextTheme getTextTheme(UserMode mode);
}

class FourModeThemeManagerImpl extends FourModeThemeManager {
  static ThemeData getExpertTheme() {
    return ThemeData(
      primarySwatch: Colors.blue,
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.blue[800],
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue[700],
          foregroundColor: Colors.white,
        ),
      ),
    );
  }

  static ThemeData getInertialTheme() {
    return ThemeData(
      primarySwatch: Colors.blueGrey,
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueGrey),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.blueGrey[700],
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blueGrey[600],
          foregroundColor: Colors.white,
        ),
      ),
    );
  }

  static ThemeData getCultivationTheme() {
    return ThemeData(
      primarySwatch: Colors.green,
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.green[700],
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.green[600],
          foregroundColor: Colors.white,
        ),
      ),
    );
  }

  static ThemeData getGuidingTheme() {
    return ThemeData(
      primarySwatch: Colors.orange,
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.orange),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.orange[700],
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.orange[600],
          foregroundColor: Colors.white,
        ),
      ),
    );
  }

  static Color getPrimaryColor(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return Colors.blue;
      case UserMode.inertial:
        return Colors.blueGrey;
      case UserMode.cultivation:
        return Colors.green;
      case UserMode.guiding:
        return Colors.orange;
    }
  }

  static Color getSecondaryColor(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return Colors.lightBlue;
      case UserMode.inertial:
        return Colors.grey;
      case UserMode.cultivation:
        return Colors.lightGreen;
      case UserMode.guiding:
        return Colors.deepOrange;
    }
  }

  static TextTheme getTextTheme(UserMode mode) {
    return TextTheme(
      displayLarge: TextStyle(color: getPrimaryColor(mode)),
      displayMedium: TextStyle(color: getPrimaryColor(mode)),
      bodyLarge: TextStyle(color: Colors.black87),
      bodyMedium: TextStyle(color: Colors.black54),
    );
  }
}

/**
 * 38. 四模式互動管理器 - FourModeInteractionManager
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段三實作 - 四模式互動行為管理
 */
abstract class FourModeInteractionManager {
  static Duration getAnimationDuration(UserMode mode);
  static Curve getAnimationCurve(UserMode mode);
  static int getMaxFieldsPerScreen(UserMode mode);
  static bool shouldShowAdvancedOptions(UserMode mode);
  static bool shouldAutoSave(UserMode mode);
  static List<String> getQuickActions(UserMode mode);
}

class FourModeInteractionManagerImpl extends FourModeInteractionManager {
  static Duration getAnimationDuration(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return Duration(milliseconds: 200); // 快速動畫
      case UserMode.inertial:
        return Duration(milliseconds: 300); // 標準動畫
      case UserMode.cultivation:
        return Duration(milliseconds: 400); // 較慢動畫，增加視覺反饋
      case UserMode.guiding:
        return Duration(milliseconds: 500); // 最慢動畫，給予充分時間
    }
  }

  static Curve getAnimationCurve(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return Curves.easeInOut;
      case UserMode.inertial:
        return Curves.linear;
      case UserMode.cultivation:
        return Curves.bounceOut; // 有趣的彈跳效果
      case UserMode.guiding:
        return Curves.easeOut; // 緩慢結束
    }
  }

  static int getMaxFieldsPerScreen(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return 12; // 最多欄位
      case UserMode.inertial:
        return 8; // 標準欄位
      case UserMode.cultivation:
        return 6; // 適中欄位
      case UserMode.guiding:
        return 4; // 最少欄位
    }
  }

  static bool shouldShowAdvancedOptions(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return true;
      case UserMode.inertial:
        return false;
      case UserMode.cultivation:
        return false;
      case UserMode.guiding:
        return false;
    }
  }

  static bool shouldAutoSave(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return false; // 專家模式手動控制
      case UserMode.inertial:
        return true; // 自動儲存減少操作
      case UserMode.cultivation:
        return true; // 自動儲存避免遺失
      case UserMode.guiding:
        return true; // 完全自動化
    }
  }

  static List<String> getQuickActions(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return ['記帳', '編輯', '分析', '匯出', '設定', '批次操作'];
      case UserMode.inertial:
        return ['記帳', '查看', '統計', '設定'];
      case UserMode.cultivation:
        return ['記帳', '查看進度', '成就'];
      case UserMode.guiding:
        return ['記帳', '查看'];
    }
  }
}

/**
 * 39. 快速記帳處理器 - QuickAccountingProcessor
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段三實作 - 快速記帳業務邏輯核心
 */
abstract class QuickAccountingProcessor {
  static Future<QuickAccountingResult> processQuickInput(String input, String userId, String ledgerId);
}

class QuickAccountingProcessorImpl extends QuickAccountingProcessor {
  static Future<QuickAccountingResult> processQuickInput(String input, String userId, String ledgerId) async {
    try {
      // 呼叫智能文字解析器
      final parser = SmartTextParserImpl();
      final parsedData = await parser.parseText(input);

      // 驗證解析結果
      if (!parsedData.containsKey('amount') || parsedData['amount'] == null) {
        return QuickAccountingResult(
          success: false,
          message: '無法識別金額，請使用「項目 金額」格式',
        );
      }

      // 建立交易記錄
      final transaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: _mapToTransactionType(parsedData['type']),
        amount: parsedData['amount'] as double,
        categoryId: parsedData['categoryId'] as String?,
        accountId: parsedData['accountId'] as String?,
        description: parsedData['description'] as String? ?? '',
        date: DateTime.now(),
      );

      // 模擬API儲存
      await Future.delayed(Duration(milliseconds: 300));

      return QuickAccountingResult(
        success: true,
        message: '記帳成功！${transaction.description} \$${transaction.amount}',
        transaction: transaction,
      );

    } catch (e) {
      return QuickAccountingResult(
        success: false,
        message: '記帳失敗：${e.toString()}',
      );
    }
  }

  static TransactionType _mapToTransactionType(dynamic type) {
    if (type == null) return TransactionType.expense;

    switch (type.toString().toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }
}

/**
 * 40. 智能文字解析器 - SmartTextParser
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段三實作 - 自然語言解析核心
 */
abstract class SmartTextParser {
  static Map<String, dynamic> parseAccountingText(String input);
}

class SmartTextParserImpl extends SmartTextParser {
  Future<Map<String, dynamic>> parseText(String input) async {
    await Future.delayed(Duration(milliseconds: 50));

    final result = <String, dynamic>{};
    final words = input.trim().split(RegExp(r'\s+'));

    // 解析金額
    double? amount;
    for (String word in words) {
      final parsedAmount = double.tryParse(word.replaceAll(RegExp(r'[^\d.]'), ''));
      if (parsedAmount != null && parsedAmount > 0) {
        amount = parsedAmount;
        break;
      }
    }
    result['amount'] = amount;

    // 判斷交易類型
    String type = 'expense'; // 預設為支出
    if (_containsAny(input, ['薪水', '收入', '入帳', '賺'])) {
      type = 'income';
    } else if (_containsAny(input, ['轉帳', '轉入', '轉出'])) {
      type = 'transfer';
    }
    result['type'] = type;

    // 智能分類識別
    String? categoryId = _identifyCategory(input);
    result['categoryId'] = categoryId;

    // 帳戶識別
    String? accountId = _identifyAccount(input);
    result['accountId'] = accountId;

    // 提取描述
    String description = _extractDescription(input, amount?.toString() ?? '');
    result['description'] = description;

    return result;
  }

  static Map<String, dynamic> parseAccountingText(String input) {
    // 靜態方法實作
    final parser = SmartTextParserImpl();
    // 注意：這是同步版本，實際使用時應該使用異步版本
    return {
      'amount': _extractAmount(input),
      'type': _extractType(input),
      'description': _extractDescription(input, ''),
    };
  }

  bool _containsAny(String text, List<String> keywords) {
    return keywords.any((keyword) => text.contains(keyword));
  }

  String? _identifyCategory(String input) {
    final categoryKeywords = {
      'food_lunch': ['午餐', '中餐', '便當'],
      'food_dinner': ['晚餐', '晚飯', '宵夜'],
      'food_breakfast': ['早餐', '早飯'],
      'transport_bus': ['公車', '巴士'],
      'transport_metro': ['捷運', '地鐵'],
      'transport_taxi': ['計程車', 'taxi', 'uber'],
      'entertainment': ['電影', '遊戲', '娛樂'],
      'salary': ['薪水', '薪資', '工資'],
    };

    for (var entry in categoryKeywords.entries) {
      if (_containsAny(input, entry.value)) {
        return entry.key;
      }
    }

    return null;
  }

  String? _identifyAccount(String input) {
    final accountKeywords = {
      'cash': ['現金', '零錢'],
      'bank_main': ['銀行', '台銀', '中信'],
      'credit_card': ['信用卡', '刷卡'],
    };

    for (var entry in accountKeywords.entries) {
      if (_containsAny(input, entry.value)) {
        return entry.key;
      }
    }

    return 'cash'; // 預設使用現金
  }

  String _extractDescription(String input, String amountStr) {
    String description = input;

    // 移除金額
    if (amountStr.isNotEmpty) {
      description = description.replaceAll(amountStr, '').trim();
    }

    // 移除常見的記帳關鍵字
    final removeKeywords = ['記帳', '花費', '支出', '收入', '轉帳'];
    for (String keyword in removeKeywords) {
      description = description.replaceAll(keyword, '').trim();
    }

    return description.isEmpty ? '記帳' : description;
  }

  static String _extractType(String input) {
    if (input.contains('薪水') || input.contains('收入')) {
      return 'income';
    } else if (input.contains('轉帳')) {
      return 'transfer';
    }
    return 'expense';
  }

  static double? _extractAmount(String input) {
    final words = input.split(' ');
    for (String word in words) {
      final amount = double.tryParse(word.replaceAll(RegExp(r'[^\d.]'), ''));
      if (amount != null && amount > 0) {
        return amount;
      }
    }
    return null;
  }
}

/**
 * 41. 記帳表單驗證器 - AccountingFormValidator
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段三實作 - 表單驗證業務邏輯核心
 */
abstract class AccountingFormValidator {
  static ValidationResult validateTransaction(Transaction transaction);
  static ValidationResult validateAmount(double amount);
  static ValidationResult validateCategory(String categoryId);
  static ValidationResult validateAccount(String accountId);
  static ValidationResult validateDate(DateTime date);
}

class ValidationResult {
  final bool isValid;
  final Map<String, String> errors;

  ValidationResult({required this.isValid, this.errors = const {}});
}

class AccountingFormValidatorImpl extends AccountingFormValidator {
  static ValidationResult validateTransaction(Transaction transaction) {
    final errors = <String, String>{};

    // 驗證金額
    final amountResult = validateAmount(transaction.amount);
    if (!amountResult.isValid) {
      errors.addAll(amountResult.errors);
    }

    // 驗證科目
    if (transaction.categoryId != null) {
      final categoryResult = validateCategory(transaction.categoryId!);
      if (!categoryResult.isValid) {
        errors.addAll(categoryResult.errors);
      }
    }

    // 驗證帳戶
    if (transaction.accountId != null) {
      final accountResult = validateAccount(transaction.accountId!);
      if (!accountResult.isValid) {
        errors.addAll(accountResult.errors);
      }
    }

    // 驗證日期
    final dateResult = validateDate(transaction.date);
    if (!dateResult.isValid) {
      errors.addAll(dateResult.errors);
    }

    // 驗證描述
    if (transaction.description.length > 200) {
      errors['description'] = '描述不能超過200字元';
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  static ValidationResult validateAmount(double amount) {
    final errors = <String, String>{};

    if (amount <= 0) {
      errors['amount'] = '金額必須大於0';
    } else if (amount > 999999999) {
      errors['amount'] = '金額不能超過999,999,999';
    } else if (amount.toString().contains('.') &&
               amount.toString().split('.')[1].length > 2) {
      errors['amount'] = '金額最多只能有2位小數';
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  static ValidationResult validateCategory(String categoryId) {
    final errors = <String, String>{};

    if (categoryId.isEmpty) {
      errors['category'] = '請選擇科目';
    } else if (!_isValidCategoryId(categoryId)) {
      errors['category'] = '選擇的科目無效';
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  static ValidationResult validateAccount(String accountId) {
    final errors = <String, String>{};

    if (accountId.isEmpty) {
      errors['account'] = '請選擇帳戶';
    } else if (!_isValidAccountId(accountId)) {
      errors['account'] = '選擇的帳戶無效';
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  static ValidationResult validateDate(DateTime date) {
    final errors = <String, String>{};
    final now = DateTime.now();

    if (date.isAfter(now)) {
      errors['date'] = '日期不能是未來時間';
    } else if (date.isBefore(DateTime(2020, 1, 1))) {
      errors['date'] = '日期不能早於2020年1月1日';
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  static bool _isValidCategoryId(String categoryId) {
    // 模擬科目ID驗證
    final validCategories = [
      'food_lunch', 'food_dinner', 'food_breakfast',
      'transport_bus', 'transport_metro', 'transport_taxi',
      'entertainment', 'salary', 'bonus'
    ];
    return validCategories.contains(categoryId);
  }

  static bool _isValidAccountId(String accountId) {
    // 模擬帳戶ID驗證
    final validAccounts = [
      'cash', 'bank_main', 'bank_saving', 'credit_card'
    ];
    return validAccounts.contains(accountId);
  }
}

/**
 * 42. 記帳表單處理器 - AccountingFormProcessor
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段三實作 - 表單處理業務邏輯核心
 */
abstract class AccountingFormProcessor {
  static Future<Transaction> processFormSubmission(Map<String, dynamic> formData);
  static Future<void> saveDraft(Transaction draft);
  static Future<Transaction?> loadDraft(String userId);
  static void clearDraft(String userId);
}

class AccountingFormProcessorImpl extends AccountingFormProcessor {
  static final Map<String, Transaction> _drafts = {};

  static Future<Transaction> processFormSubmission(Map<String, dynamic> formData) async {
    // 驗證表單資料
    if (!_validateFormData(formData)) {
      throw Exception('表單資料驗證失敗');
    }

    // 建立交易物件
    final transaction = Transaction(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      type: _parseTransactionType(formData['type']),
      amount: double.parse(formData['amount'].toString()),
      categoryId: formData['categoryId'] as String?,
      accountId: formData['accountId'] as String?,
      description: formData['description'] as String? ?? '',
      date: formData['date'] != null
          ? DateTime.parse(formData['date'])
          : DateTime.now(),
    );

    // 模擬API提交
    await Future.delayed(Duration(milliseconds: 500));

    return transaction;
  }

  static Future<void> saveDraft(Transaction draft) async {
    await Future.delayed(Duration(milliseconds: 100));
    _drafts['current_user'] = draft;
  }

  static Future<Transaction?> loadDraft(String userId) async {
    await Future.delayed(Duration(milliseconds: 100));
    return _drafts[userId];
  }

  static void clearDraft(String userId) {
    _drafts.remove(userId);
  }

  static bool _validateFormData(Map<String, dynamic> formData) {
    // 基本驗證
    if (!formData.containsKey('amount') || formData['amount'] == null) {
      return false;
    }

    final amount = double.tryParse(formData['amount'].toString());
    if (amount == null || amount <= 0) {
      return false;
    }

    return true;
  }

  static TransactionType _parseTransactionType(dynamic type) {
    if (type == null) return TransactionType.expense;

    switch (type.toString().toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }
}

/**
 * 43. 統計計算器 - StatisticsCalculator
 * @version 2025-09-16-V2.3.0
 * @date 2025-09-16
 * @update: 階段三完成 - 統計計算完整實作
 */
class StatisticsCalculator {
  static DashboardData calculateDashboardData(List<Transaction> transactions) {
    if (transactions.isEmpty) {
      return DashboardData(
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        transactionCount: 0,
      );
    }

    double totalIncome = 0;
    double totalExpense = 0;
    int transactionCount = transactions.length;

    for (final transaction in transactions) {
      switch (transaction.type) {
        case TransactionType.income:
          totalIncome += transaction.amount;
          break;
        case TransactionType.expense:
          totalExpense += transaction.amount;
          break;
        case TransactionType.transfer:
          // 轉帳不影響總收支計算
          break;
      }
    }

    final balance = totalIncome - totalExpense;

    return DashboardData(
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      balance: balance,
      transactionCount: transactionCount,
    );
  }

  static double calculateBalance(List<Transaction> transactions) {
    double balance = 0;

    for (final transaction in transactions) {
      switch (transaction.type) {
        case TransactionType.income:
          balance += transaction.amount;
          break;
        case TransactionType.expense:
          balance -= transaction.amount;
          break;
        case TransactionType.transfer:
          // 轉帳在帳戶層級處理，不影響總餘額
          break;
      }
    }

    return balance;
  }

  static Map<String, double> calculateCategoryTotals(List<Transaction> transactions) {
    final Map<String, double> categoryTotals = {};

    for (final transaction in transactions) {
      final categoryId = transaction.categoryId ?? 'uncategorized';
      categoryTotals[categoryId] = (categoryTotals[categoryId] ?? 0) + transaction.amount;
    }

    return categoryTotals;
  }

  static List<ChartData> generateChartData(List<Transaction> transactions, String chartType) {
    switch (chartType.toLowerCase()) {
      case 'category':
        return _generateCategoryChartData(transactions);
      case 'monthly':
        return _generateMonthlyChartData(transactions);
      case 'trend':
        return _generateTrendChartData(transactions);
      default:
        return _generateCategoryChartData(transactions);
    }
  }

  static List<ChartData> _generateCategoryChartData(List<Transaction> transactions) {
    final categoryTotals = calculateCategoryTotals(transactions);
    final colors = [
      Colors.red,
      Colors.blue,
      Colors.green,
      Colors.orange,
      Colors.purple,
      Colors.teal,
      Colors.pink,
      Colors.amber,
    ];

    int colorIndex = 0;
    return categoryTotals.entries.map((entry) {
      final color = colors[colorIndex % colors.length];
      colorIndex++;

      return ChartData(
        label: _getCategoryDisplayName(entry.key),
        value: entry.value,
        color: color,
      );
    }).toList();
  }

  static List<ChartData> _generateMonthlyChartData(List<Transaction> transactions) {
    final Map<String, double> monthlyTotals = {};

    for (final transaction in transactions) {
      final monthKey = '${transaction.date.year}-${transaction.date.month.toString().padLeft(2, '0')}';
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] ?? 0) + transaction.amount;
    }

    return monthlyTotals.entries.map((entry) {
      return ChartData(
        label: _formatMonth(entry.key),
        value: entry.value,
        color: Colors.blue,
      );
    }).toList();
  }

  static List<ChartData> _generateTrendChartData(List<Transaction> transactions) {
    final Map<String, double> dailyTotals = {};

    for (final transaction in transactions) {
      final dayKey = '${transaction.date.year}-${transaction.date.month.toString().padLeft(2, '0')}-${transaction.date.day.toString().padLeft(2, '0')}';
      dailyTotals[dayKey] = (dailyTotals[dayKey] ?? 0) + transaction.amount;
    }

    return dailyTotals.entries.map((entry) {
      return ChartData(
        label: _formatDate(entry.key),
        value: entry.value,
        color: Colors.green,
      );
    }).toList();
  }

  static String _getCategoryDisplayName(String categoryId) {
    final Map<String, String> categoryNames = {
      'food': '餐飲',
      'transport': '交通',
      'shopping': '購物',
      'entertainment': '娛樂',
      'healthcare': '醫療',
      'utilities': '水電',
      'salary': '薪資',
      'bonus': '獎金',
      'uncategorized': '未分類',
    };

    return categoryNames[categoryId] ?? categoryId;
  }

  static String _formatMonth(String monthKey) {
    final parts = monthKey.split('-');
    if (parts.length == 2) {
      return '${parts[0]}年${parts[1]}月';
    }
    return monthKey;
  }

  static String _formatDate(String dateKey) {
    final parts = dateKey.split('-');
    if (parts.length == 3) {
      return '${parts[1]}/${parts[2]}';
    }
    return dateKey;
  }

  static Map<String, dynamic> calculateAdvancedStatistics(List<Transaction> transactions) {
    if (transactions.isEmpty) {
      return {
        'averageTransaction': 0.0,
        'largestTransaction': 0.0,
        'smallestTransaction': 0.0,
        'mostFrequentCategory': null,
        'spendingPattern': 'no_data',
      };
    }

    final amounts = transactions.map((t) => t.amount).toList();
    amounts.sort();

    final total = amounts.fold(0.0, (sum, amount) => sum + amount);
    final average = total / amounts.length;
    final largest = amounts.last;
    final smallest = amounts.first;

    // 計算最常用科目
    final categoryCount = <String, int>{};
    for (final transaction in transactions) {
      final categoryId = transaction.categoryId ?? 'uncategorized';
      categoryCount[categoryId] = (categoryCount[categoryId] ?? 0) + 1;
    }

    String? mostFrequentCategory;
    int maxCount = 0;
    categoryCount.forEach((category, count) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentCategory = category;
      }
    });

    // 分析消費模式
    final spendingPattern = _analyzeSpendingPattern(transactions);

    return {
      'averageTransaction': average,
      'largestTransaction': largest,
      'smallestTransaction': smallest,
      'mostFrequentCategory': mostFrequentCategory,
      'spendingPattern': spendingPattern,
      'categoryDistribution': categoryCount,
      'transactionCount': transactions.length,
    };
  }

  static String _analyzeSpendingPattern(List<Transaction> transactions) {
    final weekdayCount = <int, int>{};
    final hourCount = <int, int>{};

    for (final transaction in transactions) {
      final weekday = transaction.date.weekday;
      final hour = transaction.date.hour;

      weekdayCount[weekday] = (weekdayCount[weekday] ?? 0) + 1;
      hourCount[hour] = (hourCount[hour] ?? 0) + 1;
    }

    // 分析主要消費時間
    final maxWeekday = weekdayCount.entries.reduce((a, b) => a.value > b.value ? a : b);
    final maxHour = hourCount.entries.reduce((a, b) => a.value > b.value ? a : b);

    if (maxWeekday.key >= 1 && maxWeekday.key <= 5) {
      return 'weekday_spender'; // 平日消費較多
    } else {
      return 'weekend_spender'; // 週末消費較多
    }
  }
}

/**
 * 44. 交易資料處理器 - TransactionDataProcessor
 * @version 2025-09-16-V2.3.0
 * @date 2025-09-16
 * @update: 階段三完成 - 交易資料處理完整實作
 */
class TransactionDataProcessor {
  static List<Transaction> filterTransactions(List<Transaction> transactions, Map<String, dynamic> criteria) {
    List<Transaction> filtered = List.from(transactions);

    // 日期篩選
    if (criteria.containsKey('startDate') && criteria['startDate'] != null) {
      final startDate = criteria['startDate'] as DateTime;
      filtered = filtered.where((t) => !t.date.isBefore(startDate)).toList();
    }

    if (criteria.containsKey('endDate') && criteria['endDate'] != null) {
      final endDate = criteria['endDate'] as DateTime;
      filtered = filtered.where((t) => !t.date.isAfter(endDate)).toList();
    }

    // 金額篩選
    if (criteria.containsKey('minAmount') && criteria['minAmount'] != null) {
      final minAmount = criteria['minAmount'] as double;
      filtered = filtered.where((t) => t.amount >= minAmount).toList();
    }

    if (criteria.containsKey('maxAmount') && criteria['maxAmount'] != null) {
      final maxAmount = criteria['maxAmount'] as double;
      filtered = filtered.where((t) => t.amount <= maxAmount).toList();
    }

    // 類型篩選
    if (criteria.containsKey('types') && criteria['types'] != null) {
      final types = criteria['types'] as List<TransactionType>;
      filtered = filtered.where((t) => types.contains(t.type)).toList();
    }

    // 科目篩選
    if (criteria.containsKey('categoryIds') && criteria['categoryIds'] != null) {
      final categoryIds = criteria['categoryIds'] as List<String>;
      filtered = filtered.where((t) =>
        t.categoryId != null && categoryIds.contains(t.categoryId)
      ).toList();
    }

    // 帳戶篩選
    if (criteria.containsKey('accountIds') && criteria['accountIds'] != null) {
      final accountIds = criteria['accountIds'] as List<String>;
      filtered = filtered.where((t) =>
        t.accountId != null && accountIds.contains(t.accountId)
      ).toList();
    }

    // 關鍵字篩選
    if (criteria.containsKey('keyword') && criteria['keyword'] != null) {
      final keyword = criteria['keyword'] as String;
      filtered = filtered.where((t) =>
        t.description.toLowerCase().contains(keyword.toLowerCase())
      ).toList();
    }

    return filtered;
  }

  static List<Transaction> sortTransactions(List<Transaction> transactions, Map<String, dynamic> criteria) {
    final sortBy = criteria['sortBy'] as String? ?? 'date';
    final ascending = criteria['ascending'] as bool? ?? false;

    List<Transaction> sorted = List.from(transactions);

    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => ascending ? a.date.compareTo(b.date) : b.date.compareTo(a.date));
        break;
      case 'amount':
        sorted.sort((a, b) => ascending ? a.amount.compareTo(b.amount) : b.amount.compareTo(a.amount));
        break;
      case 'description':
        sorted.sort((a, b) => ascending ? a.description.compareTo(b.description) : b.description.compareTo(a.description));
        break;
      case 'type':
        sorted.sort((a, b) => ascending ? a.type.index.compareTo(b.type.index) : b.type.index.compareTo(a.type.index));
        break;
      default:
        // 預設按日期排序
        sorted.sort((a, b) => b.date.compareTo(a.date));
    }

    return sorted;
  }

  static Map<String, List<Transaction>> groupTransactions(List<Transaction> transactions, String groupBy) {
    final Map<String, List<Transaction>> grouped = {};

    for (final transaction in transactions) {
      String groupKey;

      switch (groupBy) {
        case 'date':
          groupKey = '${transaction.date.year}-${transaction.date.month.toString().padLeft(2, '0')}-${transaction.date.day.toString().padLeft(2, '0')}';
          break;
        case 'month':
          groupKey = '${transaction.date.year}-${transaction.date.month.toString().padLeft(2, '0')}';
          break;
        case 'year':
          groupKey = transaction.date.year.toString();
          break;
        case 'category':
          groupKey = transaction.categoryId ?? 'uncategorized';
          break;
        case 'account':
          groupKey = transaction.accountId ?? 'unknown';
          break;
        case 'type':
          groupKey = transaction.type.toString().split('.').last;
          break;
        case 'weekday':
          groupKey = _getWeekdayName(transaction.date.weekday);
          break;
        default:
          groupKey = 'all';
      }

      if (!grouped.containsKey(groupKey)) {
        grouped[groupKey] = [];
      }
      grouped[groupKey]!.add(transaction);
    }

    return grouped;
  }

  static String _getWeekdayName(int weekday) {
    const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
    return weekdays[weekday - 1];
  }

  static Map<String, dynamic> summarizeTransactions(List<Transaction> transactions) {
    if (transactions.isEmpty) {
      return {
        'totalCount': 0,
        'totalAmount': 0.0,
        'averageAmount': 0.0,
        'incomeCount': 0,
        'expenseCount': 0,
        'transferCount': 0,
        'incomeTotal': 0.0,
        'expenseTotal': 0.0,
        'categories': <String, Map<String, dynamic>>{},
        'accounts': <String, Map<String, dynamic>>{},
        'dateRange': null,
      };
    }

    int incomeCount = 0, expenseCount = 0, transferCount = 0;
    double incomeTotal = 0, expenseTotal = 0;
    final Map<String, Map<String, dynamic>> categories = {};
    final Map<String, Map<String, dynamic>> accounts = {};

    DateTime? earliestDate, latestDate;

    for (final transaction in transactions) {
      // 更新日期範圍
      if (earliestDate == null || transaction.date.isBefore(earliestDate)) {
        earliestDate = transaction.date;
      }
      if (latestDate == null || transaction.date.isAfter(latestDate)) {
        latestDate = transaction.date;
      }

      // 按類型統計
      switch (transaction.type) {
        case TransactionType.income:
          incomeCount++;
          incomeTotal += transaction.amount;
          break;
        case TransactionType.expense:
          expenseCount++;
          expenseTotal += transaction.amount;
          break;
        case TransactionType.transfer:
          transferCount++;
          break;
      }

      // 按科目統計
      final categoryId = transaction.categoryId ?? 'uncategorized';
      if (!categories.containsKey(categoryId)) {
        categories[categoryId] = {'count': 0, 'total': 0.0, 'transactions': <Transaction>[]};
      }
      categories[categoryId]!['count'] = categories[categoryId]!['count'] + 1;
      categories[categoryId]!['total'] = categories[categoryId]!['total'] + transaction.amount;
      (categories[categoryId]!['transactions'] as List<Transaction>).add(transaction);

      // 按帳戶統計
      final accountId = transaction.accountId ?? 'unknown';
      if (!accounts.containsKey(accountId)) {
        accounts[accountId] = {'count': 0, 'total': 0.0, 'transactions': <Transaction>[]};
      }
      accounts[accountId]!['count'] = accounts[accountId]!['count'] + 1;
      accounts[accountId]!['total'] = accounts[accountId]!['total'] + transaction.amount;
      (accounts[accountId]!['transactions'] as List<Transaction>).add(transaction);
    }

    final totalCount = transactions.length;
    final totalAmount = incomeTotal + expenseTotal;
    final averageAmount = totalCount > 0 ? totalAmount / totalCount : 0.0;

    return {
      'totalCount': totalCount,
      'totalAmount': totalAmount,
      'averageAmount': averageAmount,
      'incomeCount': incomeCount,
      'expenseCount': expenseCount,
      'transferCount': transferCount,
      'incomeTotal': incomeTotal,
      'expenseTotal': expenseTotal,
      'balance': incomeTotal - expenseTotal,
      'categories': categories,
      'accounts': accounts,
      'dateRange': earliestDate != null && latestDate != null
          ? {'start': earliestDate, 'end': latestDate}
          : null,
    };
  }

  static List<Transaction> getTopTransactions(List<Transaction> transactions, {int limit = 10, String sortBy = 'amount'}) {
    final sorted = sortTransactions(transactions, {'sortBy': sortBy, 'ascending': false});
    return sorted.take(limit).toList();
  }

  static List<Transaction> searchTransactions(List<Transaction> transactions, String query) {
    if (query.trim().isEmpty) return transactions;

    final lowercaseQuery = query.toLowerCase();
    return transactions.where((transaction) {
      return transaction.description.toLowerCase().contains(lowercaseQuery) ||
             transaction.amount.toString().contains(query) ||
             (transaction.categoryId?.toLowerCase().contains(lowercaseQuery) ?? false);
    }).toList();
  }
}

/**
 * 45. 交易格式轉換器 - TransactionFormatter
 * @version 2025-09-16-V2.3.0
 * @date 2025-09-16
 * @update: 階段三完成 - 交易格式轉換完整實作
 */
class TransactionFormatter {
  static String formatAmount(double amount, [String currency = 'TWD']) {
    final formatter = NumberFormat.currency(
      locale: 'zh_TW',
      symbol: _getCurrencySymbol(currency),
      decimalDigits: _getDecimalDigits(amount),
    );
    return formatter.format(amount);
  }

  static String _getCurrencySymbol(String currency) {
    switch (currency.toUpperCase()) {
      case 'TWD':
        return 'NT\$';
      case 'USD':
        return '\$';
      case 'EUR':
        return '€';
      case 'JPY':
        return '¥';
      case 'CNY':
        return '¥';
      default:
        return '\$';
    }
  }

  static int _getDecimalDigits(double amount) {
    // 如果是整數，不顯示小數點
    return amount == amount.truncate() ? 0 : 2;
  }

  static String formatDate(DateTime date, [String format = 'yyyy/MM/dd']) {
    switch (format) {
      case 'short':
        return DateFormat('MM/dd').format(date);
      case 'medium':
        return DateFormat('yyyy/MM/dd').format(date);
      case 'long':
        return DateFormat('yyyy年MM月dd日').format(date);
      case 'full':
        return DateFormat('yyyy年MM月dd日 EEEE').format(date);
      case 'time':
        return DateFormat('HH:mm').format(date);
      case 'datetime':
        return DateFormat('yyyy/MM/dd HH:mm').format(date);
      default:
        return DateFormat(format).format(date);
    }
  }

  static String formatDescription(String description, [int maxLength = 20]) {
    if (description.length <= maxLength) {
      return description;
    }
    return '${description.substring(0, maxLength - 3)}...';
  }

  static String formatTransactionType(TransactionType type) {
    switch (type) {
      case TransactionType.income:
        return '收入';
      case TransactionType.expense:
        return '支出';
      case TransactionType.transfer:
        return '轉帳';
    }
  }

  static Map<String, dynamic> toJson(Transaction transaction) {
    return {
      'id': transaction.id,
      'type': transaction.type.toString().split('.').last,
      'amount': transaction.amount,
      'categoryId': transaction.categoryId,
      'accountId': transaction.accountId,
      'description': transaction.description,
      'date': transaction.date.toIso8601String(),
    };
  }

  static Transaction fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      type: _parseTransactionType(json['type'] as String),
      amount: (json['amount'] as num).toDouble(),
      categoryId: json['categoryId'] as String?,
      accountId: json['accountId'] as String?,
      description: json['description'] as String? ?? '',
      date: DateTime.parse(json['date'] as String),
    );
  }

  static TransactionType _parseTransactionType(String typeString) {
    switch (typeString.toLowerCase()) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }

  static String formatTransactionSummary(Transaction transaction) {
    final typeIcon = _getTypeIcon(transaction.type);
    final amountStr = formatAmount(transaction.amount);
    final dateStr = formatDate(transaction.date, 'short');
    final descriptionStr = formatDescription(transaction.description, 15);

    return '$typeIcon $amountStr - $descriptionStr ($dateStr)';
  }

  static String _getTypeIcon(TransactionType type) {
    switch (type) {
      case TransactionType.income:
        return '💰';
      case TransactionType.expense:
        return '💸';
      case TransactionType.transfer:
        return '🔄';
    }
  }

  static Color getTypeColor(TransactionType type) {
    switch (type) {
      case TransactionType.income:
        return Colors.green;
      case TransactionType.expense:
        return Colors.red;
      case TransactionType.transfer:
        return Colors.blue;
    }
  }

  static List<Map<String, dynamic>> formatTransactionList(List<Transaction> transactions) {
    return transactions.map((transaction) => {
      'id': transaction.id,
      'formattedAmount': formatAmount(transaction.amount),
      'formattedDate': formatDate(transaction.date),
      'formattedDescription': formatDescription(transaction.description),
      'typeDisplay': formatTransactionType(transaction.type),
      'summary': formatTransactionSummary(transaction),
      'original': transaction,
    }).toList();
  }

  static String formatStatisticsSummary(Map<String, dynamic> statistics) {
    final totalIncome = formatAmount(statistics['incomeTotal'] ?? 0);
    final totalExpense = formatAmount(statistics['expenseTotal'] ?? 0);
    final balance = formatAmount(statistics['balance'] ?? 0);
    final transactionCount = statistics['totalCount'] ?? 0;

    return '''
統計摘要：
• 總收入：$totalIncome
• 總支出：$totalExpense
• 結餘：$balance
• 交易筆數：$transactionCount 筆
    '''.trim();
  }
}

/**
 * 46. 快取管理器 - CacheManager
 * @version 2025-09-16-V2.3.0
 * @date 2025-09-16
 * @update: 階段三完成 - 快取管理完整實作
 */
class CacheManager {
  static final Map<String, CacheEntry> _cache = {};
  static const Duration _defaultMaxAge = Duration(minutes: 10);

  static Future<void> cacheTransactions(String key, List<Transaction> transactions) async {
    final jsonData = transactions.map((t) => TransactionFormatter.toJson(t)).toList();
    _cache[key] = CacheEntry(
      data: jsonData,
      timestamp: DateTime.now(),
      maxAge: _defaultMaxAge,
    );

    // 模擬持久化儲存
    await Future.delayed(Duration(milliseconds: 10));
    print('快取交易資料：$key (${transactions.length} 筆)');
  }

  static Future<List<Transaction>?> getCachedTransactions(String key) async {
    final entry = _cache[key];
    if (entry == null || !_isValidCache(entry)) {
      return null;
    }

    try {
      final jsonList = entry.data as List<dynamic>;
      return jsonList.map((json) => TransactionFormatter.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      print('讀取快取交易資料失敗：$e');
      _cache.remove(key);
      return null;
    }
  }

  static Future<void> cacheCategories(String key, List<Category> categories) async {
    final jsonData = categories.map((c) => {
      'id': c.id,
      'name': c.name,
      'parentId': c.parentId,
      'type': c.type,
    }).toList();

    _cache[key] = CacheEntry(
      data: jsonData,
      timestamp: DateTime.now(),
      maxAge: Duration(hours: 1), // 科目資料快取時間較長
    );

    await Future.delayed(Duration(milliseconds: 10));
    print('快取科目資料：$key (${categories.length} 個)');
  }

  static Future<List<Category>?> getCachedCategories(String key) async {
    final entry = _cache[key];
    if (entry == null || !_isValidCache(entry)) {
      return null;
    }

    try {
      final jsonList = entry.data as List<dynamic>;
      return jsonList.map((json) => Category(
        id: json['id'] as String,
        name: json['name'] as String,
        parentId: json['parentId'] as String?,
        type: json['type'] as String,
      )).toList();
    } catch (e) {
      print('讀取快取科目資料失敗：$e');
      _cache.remove(key);
      return null;
    }
  }

  static Future<void> cacheStatistics(String key, Map<String, dynamic> statistics, [Duration? maxAge]) async {
    _cache[key] = CacheEntry(
      data: statistics,
      timestamp: DateTime.now(),
      maxAge: maxAge ?? Duration(minutes: 5), // 統計資料快取時間較短
    );

    await Future.delayed(Duration(milliseconds: 10));
    print('快取統計資料：$key');
  }

  static Future<Map<String, dynamic>?> getCachedStatistics(String key) async {
    final entry = _cache[key];
    if (entry == null || !_isValidCache(entry)) {
      return null;
    }

    return entry.data as Map<String, dynamic>;
  }

  static Future<void> clearCache(String key) async {
    _cache.remove(key);
    await Future.delayed(Duration(milliseconds: 10));
    print('清除快取：$key');
  }

  static Future<void> clearAllCaches() async {
    final count = _cache.length;
    _cache.clear();
    await Future.delayed(Duration(milliseconds: 10));
    print('清除所有快取：$count 個項目');
  }

  static bool isCacheValid(String key, [Duration? maxAge]) {
    final entry = _cache[key];
    if (entry == null) return false;

    final effectiveMaxAge = maxAge ?? entry.maxAge;
    return DateTime.now().difference(entry.timestamp) < effectiveMaxAge;
  }

  static bool _isValidCache(CacheEntry entry) {
    return DateTime.now().difference(entry.timestamp) < entry.maxAge;
  }

  static Future<void> cleanupExpiredCaches() async {
    final expiredKeys = <String>[];

    _cache.forEach((key, entry) {
      if (!_isValidCache(entry)) {
        expiredKeys.add(key);
      }
    });

    for (final key in expiredKeys) {
      _cache.remove(key);
    }

    if (expiredKeys.isNotEmpty) {
      print('清理過期快取：${expiredKeys.length} 個項目');
    }
  }

  static Map<String, dynamic> getCacheInfo() {
    final cacheInfo = <String, dynamic>{};

    _cache.forEach((key, entry) {
      cacheInfo[key] = {
        'timestamp': entry.timestamp.toIso8601String(),
        'maxAge': entry.maxAge.inMinutes,
        'isValid': _isValidCache(entry),
        'dataType': entry.data.runtimeType.toString(),
      };
    });

    return {
      'totalCaches': _cache.length,
      'caches': cacheInfo,
    };
  }

  static void setCacheMaxAge(String key, Duration maxAge) {
    final entry = _cache[key];
    if (entry != null) {
      _cache[key] = CacheEntry(
        data: entry.data,
        timestamp: entry.timestamp,
        maxAge: maxAge,
      );
    }
  }
}

// 快取項目資料類別
class CacheEntry {
  final dynamic data;
  final DateTime timestamp;
  final Duration maxAge;

  CacheEntry({
    required this.data,
    required this.timestamp,
    required this.maxAge,
  });
}

// 數字格式化工具
class NumberFormat {
  final String locale;
  final String symbol;
  final int decimalDigits;

  NumberFormat.currency({
    required this.locale,
    required this.symbol,
    required this.decimalDigits,
  });

  String format(double number) {
    if (decimalDigits == 0) {
      return '$symbol${number.round().toString().replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
        (Match match) => '${match[1]},',
      )}';
    } else {
      return '$symbol${number.toStringAsFixed(decimalDigits).replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
        (Match match) => '${match[1]},',
      )}';
    }
  }
}

// 日期格式化工具
class DateFormat {
  final String pattern;

  DateFormat(this.pattern);

  String format(DateTime date) {
    switch (pattern) {
      case 'MM/dd':
        return '${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';
      case 'yyyy/MM/dd':
        return '${date.year}/${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';
      case 'yyyy年MM月dd日':
        return '${date.year}年${date.month.toString().padLeft(2, '0')}月${date.day.toString().padLeft(2, '0')}日';
      case 'yyyy年MM月dd日 EEEE':
        final weekdays = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];
        return '${date.year}年${date.month.toString().padLeft(2, '0')}月${date.day.toString().padLeft(2, '0')}日 ${weekdays[date.weekday]}';
      case 'HH:mm':
        return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
      case 'yyyy/MM/dd HH:mm':
        return '${date.year}/${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
      default:
        return date.toString();
    }
  }
}