
/**
 * 7302. 記帳核心功能群.dart - 記帳核心功能群Module code
 * @version 2025-09-12 v2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 核心架構與基礎Widget，函數版次升級至v2.0.0
 */

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';

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
      await Future.delayed(Duration(milliseconds: 200));
      
      // 模擬餘額更新
      for (var account in _accounts) {
        _balances[account.id] = account.balance + (DateTime.now().millisecond % 100 - 50);
      }
      
      notifyListeners();
    } catch (e) {
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
 * @update: 階段一實作 - 帳本狀態管理與多帳本支援
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
      await Future.delayed(Duration(milliseconds: 300));
      
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
      await Future.delayed(Duration(milliseconds: 400));
      _ledgers.add(ledger);
      notifyListeners();
    } catch (e) {
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
 * @update: 階段一實作 - 統計資料狀態管理
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
  String _selectedPeriod = 'thisMonth';
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
        totalIncome: 35000,
        totalExpense: 15000,
        balance: 20000,
        transactionCount: 25,
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
        ChartData(label: '食物', value: 6000, color: Colors.red),
        ChartData(label: '交通', value: 4500, color: Colors.blue),
        ChartData(label: '娛樂', value: 3000, color: Colors.green),
        ChartData(label: '其他', value: 1500, color: Colors.orange),
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
 * @update: 階段一實作 - 表單狀態管理與驗證
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
  Transaction _draftTransaction = Transaction(
    id: '',
    type: TransactionType.expense,
    amount: 0,
    description: '',
    date: DateTime.now(),
  );
  bool _hasUnsavedChanges = false;
  Map<String, String> _validationErrors = {};
  bool _isSubmitting = false;

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
    _validateAmount();
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
    _validationErrors.remove('categoryId');
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
    _validationErrors.remove('accountId');
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
      await Future.delayed(Duration(milliseconds: 1000)); // 模擬API提交
      
      _draftTransaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: _draftTransaction.type,
        amount: _draftTransaction.amount,
        categoryId: _draftTransaction.categoryId,
        accountId: _draftTransaction.accountId,
        description: _draftTransaction.description,
        date: _draftTransaction.date,
      );
      
      _hasUnsavedChanges = false;
      _isSubmitting = false;
      notifyListeners();
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  Future<void> saveDraft() async {
    await Future.delayed(Duration(milliseconds: 100));
    // 儲存草稿到本地存儲
    print('Draft saved');
  }

  @override
  Future<void> loadDraft() async {
    await Future.delayed(Duration(milliseconds: 100));
    // 從本地存儲載入草稿
    print('Draft loaded');
  }

  @override
  void clearForm() {
    _draftTransaction = Transaction(
      id: '',
      type: TransactionType.expense,
      amount: 0,
      description: '',
      date: DateTime.now(),
    );
    _hasUnsavedChanges = false;
    _validationErrors.clear();
    notifyListeners();
  }

  @override
  bool validateForm() {
    _validationErrors.clear();

    _validateAmount();
    
    if (_draftTransaction.categoryId == null || _draftTransaction.categoryId!.isEmpty) {
      _validationErrors['categoryId'] = '請選擇科目';
    }
    
    if (_draftTransaction.accountId == null || _draftTransaction.accountId!.isEmpty) {
      _validationErrors['accountId'] = '請選擇帳戶';
    }
    
    if (_draftTransaction.description.isEmpty) {
      _validationErrors['description'] = '請輸入描述';
    }

    notifyListeners();
    return _validationErrors.isEmpty;
  }

  void _validateAmount() {
    if (_draftTransaction.amount <= 0) {
      _validationErrors['amount'] = '金額必須大於0';
    } else {
      _validationErrors.remove('amount');
    }
  }
}

// ==========================================
// 業務邏輯處理器實作類別 (支援函數)
// ==========================================

/**
 * 快速記帳處理器實作
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 支援LINE OA快速記帳
 */
class QuickAccountingProcessorImpl {
  Future<QuickAccountingResult> processQuickAccounting(String input) async {
    try {
      await Future.delayed(Duration(milliseconds: 200));
      
      if (input.trim().isEmpty) {
        return QuickAccountingResult(success: false, message: '輸入不能為空');
      }
      
      // 簡單的解析邏輯
      final parser = SmartTextParserImpl();
      final parsedData = await parser.parseText(input);
      
      final transaction = Transaction(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        type: _parseTransactionType(parsedData['type']),
        amount: parsedData['amount'] ?? 0.0,
        categoryId: parsedData['categoryId'],
        accountId: parsedData['accountId'],
        description: parsedData['description'] ?? input,
        date: DateTime.now(),
      );
      
      return QuickAccountingResult(
        success: true,
        message: '記帳成功！金額：\$${transaction.amount.toStringAsFixed(0)}',
        transaction: transaction,
      );
      
    } catch (e) {
      return QuickAccountingResult(
        success: false,
        message: '記帳失敗：${e.toString()}',
      );
    }
  }

  TransactionType _parseTransactionType(String? type) {
    switch (type?.toLowerCase()) {
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
 * 智能文字解析器實作
 * @version 2025-09-12-V2.0.0
 * @date 2025-09-12
 * @update: 階段一實作 - 支援自然語言記帳解析
 */
class SmartTextParserImpl {
  Future<Map<String, dynamic>> parseText(String input) async {
    await Future.delayed(Duration(milliseconds: 100));
    
    final result = <String, dynamic>{};
    final words = input.trim().split(' ');
    
    // 解析金額
    for (String word in words) {
      final amount = double.tryParse(word);
      if (amount != null) {
        result['amount'] = amount;
        break;
      }
    }
    
    // 判斷交易類型
    if (input.contains('薪水') || input.contains('收入') || input.contains('獎金')) {
      result['type'] = 'income';
    } else if (input.contains('轉帳') || input.contains('轉賬')) {
      result['type'] = 'transfer';
    } else {
      result['type'] = 'expense';
    }
    
    // 識別帳戶
    if (input.contains('現金')) {
      result['accountId'] = 'cash';
    } else if (input.contains('銀行') || input.contains('台銀')) {
      result['accountId'] = 'bank';
    } else if (input.contains('信用卡')) {
      result['accountId'] = 'credit';
    }
    
    // 識別科目
    if (input.contains('午餐') || input.contains('早餐') || input.contains('晚餐')) {
      result['categoryId'] = 'food';
    } else if (input.contains('公車') || input.contains('捷運') || input.contains('計程車')) {
      result['categoryId'] = 'transport';
    } else if (input.contains('薪水')) {
      result['categoryId'] = 'salary';
    }
    
    // 提取描述（移除金額後的內容）
    String description = input;
    if (result.containsKey('amount')) {
      description = input.replaceFirst(result['amount'].toString(), '').trim();
    }
    result['description'] = description.isNotEmpty ? description : '記帳';
    
    return result;
  }
}
