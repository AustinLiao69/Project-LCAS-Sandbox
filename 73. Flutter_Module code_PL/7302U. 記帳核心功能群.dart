/**
 * 7302U. 記帳核心功能群.dart
 * @version v2.4.0
 * @date 2025-10-16
 * @update: 階段二業務邏輯分拆完成版 - UI邏輯與業務邏輯完全分離
 *
 * 本模組實現LCAS 2.0記帳核心功能群的UI展示層，
 * 專注於Widget實作、Flutter相關功能、使用者介面互動。
 * 業務邏輯完全由7302. 記帳核心功能群.dart提供。
 */

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

// 引入業務邏輯模組
import '7302. 記帳核心功能群.dart';

// ===========================================
// 記帳核心UI Widget類別定義
// ===========================================

/// 記帳主頁Widget
class BookkeepingHomePageWidget extends StatefulWidget {
  final BookkeepingCoreFunctionGroup businessLogic;

  const BookkeepingHomePageWidget({Key? key, required this.businessLogic}) : super(key: key);

  @override
  State<BookkeepingHomePageWidget> createState() => _BookkeepingHomePageWidgetState();
}

class _BookkeepingHomePageWidgetState extends State<BookkeepingHomePageWidget> {
  int _currentIndex = 0;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LCAS 記帳'),
        backgroundColor: Theme.of(context).primaryColor,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).pushNamed('/settings'),
          ),
        ],
      ),
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) => setState(() => _currentIndex = index),
        children: [
          _buildDashboardPage(),
          _buildTransactionListPage(),
          _buildStatisticsPage(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() => _currentIndex = index);
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: '總覽',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.list),
            label: '交易記錄',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.analytics),
            label: '統計',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showQuickTransactionDialog(),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildDashboardPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 帳戶餘額卡片
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '帳戶總覽',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  FutureBuilder<List<Map<String, dynamic>>>(
                    future: widget.businessLogic.getAccountSummary(),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return const Text('尚無帳戶資料');
                      }

                      return Column(
                        children: snapshot.data!.map((account) => ListTile(
                          leading: Icon(Icons.account_balance_wallet),
                          title: Text(account['name'] ?? '未知帳戶'),
                          trailing: Text(
                            '\$${account['balance']?.toStringAsFixed(2) ?? '0.00'}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: (account['balance'] ?? 0) >= 0 
                                  ? Colors.green 
                                  : Colors.red,
                            ),
                          ),
                        )).toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 最近交易
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '最近交易',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      TextButton(
                        onPressed: () => setState(() => _currentIndex = 1),
                        child: const Text('查看全部'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  FutureBuilder<List<Map<String, dynamic>>>(
                    future: widget.businessLogic.getRecentTransactions(5),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return const Text('尚無交易記錄');
                      }

                      return Column(
                        children: snapshot.data!.map((transaction) => ListTile(
                          leading: Icon(
                            transaction['type'] == 'income' 
                                ? Icons.arrow_downward 
                                : Icons.arrow_upward,
                            color: transaction['type'] == 'income' 
                                ? Colors.green 
                                : Colors.red,
                          ),
                          title: Text(transaction['description'] ?? ''),
                          subtitle: Text(transaction['categoryId'] ?? ''),
                          trailing: Text(
                            '${transaction['type'] == 'income' ? '+' : '-'}\$${transaction['amount']?.toStringAsFixed(2) ?? '0.00'}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: transaction['type'] == 'income' 
                                  ? Colors.green 
                                  : Colors.red,
                            ),
                          ),
                        )).toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionListPage() {
    return Column(
      children: [
        // 篩選器
        Container(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: '帳本'),
                  items: ['所有帳本', '個人帳本', '家庭帳本'].map((ledger) => 
                    DropdownMenuItem(value: ledger, child: Text(ledger))
                  ).toList(),
                  onChanged: (value) {
                    // 處理帳本篩選
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: DropdownButtonFormField<String>(
                  decoration: const InputDecoration(labelText: '類別'),
                  items: ['所有類別', '收入', '支出'].map((category) => 
                    DropdownMenuItem(value: category, child: Text(category))
                  ).toList(),
                  onChanged: (value) {
                    // 處理類別篩選
                  },
                ),
              ),
            ],
          ),
        ),

        // 交易清單
        Expanded(
          child: FutureBuilder<List<Map<String, dynamic>>>(
            future: widget.businessLogic.getTransactionHistory(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }

              if (!snapshot.hasData || snapshot.data!.isEmpty) {
                return const Center(child: Text('尚無交易記錄'));
              }

              return ListView.builder(
                itemCount: snapshot.data!.length,
                itemBuilder: (context, index) {
                  final transaction = snapshot.data![index];
                  return ListTile(
                    leading: Icon(
                      transaction['type'] == 'income' 
                          ? Icons.arrow_downward 
                          : Icons.arrow_upward,
                      color: transaction['type'] == 'income' 
                          ? Colors.green 
                          : Colors.red,
                    ),
                    title: Text(transaction['description'] ?? ''),
                    subtitle: Text('${transaction['categoryId']} • ${transaction['date']}'),
                    trailing: Text(
                      '${transaction['type'] == 'income' ? '+' : '-'}\$${transaction['amount']?.toStringAsFixed(2) ?? '0.00'}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: transaction['type'] == 'income' 
                            ? Colors.green 
                            : Colors.red,
                      ),
                    ),
                    onTap: () => _showTransactionDetailDialog(transaction),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatisticsPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '本月統計',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 16),

          // 收支統計卡片
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: FutureBuilder<Map<String, dynamic>>(
                future: widget.businessLogic.getMonthlyStatistics(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  final stats = snapshot.data ?? {};
                  return Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Column(
                            children: [
                              Text(
                                '收入',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              Text(
                                '\$${stats['income']?.toStringAsFixed(2) ?? '0.00'}',
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green,
                                ),
                              ),
                            ],
                          ),
                          Column(
                            children: [
                              Text(
                                '支出',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              Text(
                                '\$${stats['expense']?.toStringAsFixed(2) ?? '0.00'}',
                                style: const TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red,
                                ),
                              ),
                            ],
                          ),
                          Column(
                            children: [
                              Text(
                                '結餘',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              Text(
                                '\$${((stats['income'] ?? 0) - (stats['expense'] ?? 0)).toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: ((stats['income'] ?? 0) - (stats['expense'] ?? 0)) >= 0 
                                      ? Colors.green 
                                      : Colors.red,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 類別分析
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '支出類別分析',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  FutureBuilder<List<Map<String, dynamic>>>(
                    future: widget.businessLogic.getCategoryAnalysis(),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }

                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return const Text('尚無類別數據');
                      }

                      return Column(
                        children: snapshot.data!.map((category) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: Text(category['name'] ?? ''),
                              ),
                              Expanded(
                                flex: 3,
                                child: LinearProgressIndicator(
                                  value: (category['percentage'] ?? 0) / 100,
                                  backgroundColor: Colors.grey[300],
                                ),
                              ),
                              Expanded(
                                flex: 2,
                                child: Text(
                                  '\$${category['amount']?.toStringAsFixed(2) ?? '0.00'}',
                                  textAlign: TextAlign.end,
                                ),
                              ),
                            ],
                          ),
                        )).toList(),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showQuickTransactionDialog() {
    showDialog(
      context: context,
      builder: (context) => QuickTransactionDialogWidget(
        businessLogic: widget.businessLogic,
        onTransactionAdded: () {
          setState(() {}); // 重新載入資料
        },
      ),
    );
  }

  void _showTransactionDetailDialog(Map<String, dynamic> transaction) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('交易詳情'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('描述：${transaction['description'] ?? ''}'),
            Text('金額：\$${transaction['amount']?.toStringAsFixed(2) ?? '0.00'}'),
            Text('類別：${transaction['categoryId'] ?? ''}'),
            Text('日期：${transaction['date'] ?? ''}'),
            Text('帳戶：${transaction['accountId'] ?? ''}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('關閉'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              // 導航至編輯頁面
            },
            child: const Text('編輯'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}

/// 快速交易對話框Widget
class QuickTransactionDialogWidget extends StatefulWidget {
  final BookkeepingCoreFunctionGroup businessLogic;
  final VoidCallback onTransactionAdded;

  const QuickTransactionDialogWidget({
    Key? key,
    required this.businessLogic,
    required this.onTransactionAdded,
  }) : super(key: key);

  @override
  State<QuickTransactionDialogWidget> createState() => _QuickTransactionDialogWidgetState();
}

class _QuickTransactionDialogWidgetState extends State<QuickTransactionDialogWidget> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _amountController = TextEditingController();
  String _selectedType = 'expense';
  String? _selectedCategory;
  String? _selectedAccount;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('快速記帳'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 交易類型選擇
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'expense', label: Text('支出')),
                  ButtonSegment(value: 'income', label: Text('收入')),
                ],
                selected: {_selectedType},
                onSelectionChanged: (Set<String> selection) {
                  setState(() => _selectedType = selection.first);
                },
              ),
              const SizedBox(height: 16),

              // 描述
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(
                  labelText: '描述',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '請輸入交易描述';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 金額
              TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: '金額',
                  prefixText: '\$ ',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '請輸入金額';
                  }
                  if (double.tryParse(value) == null) {
                    return '請輸入有效金額';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 類別選擇
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: '類別',
                  border: OutlineInputBorder(),
                ),
                value: _selectedCategory,
                items: _getCategories().map((category) => 
                  DropdownMenuItem(value: category, child: Text(category))
                ).toList(),
                onChanged: (value) => setState(() => _selectedCategory = value),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '請選擇類別';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 帳戶選擇
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: '帳戶',
                  border: OutlineInputBorder(),
                ),
                value: _selectedAccount,
                items: _getAccounts().map((account) => 
                  DropdownMenuItem(value: account, child: Text(account))
                ).toList(),
                onChanged: (value) => setState(() => _selectedAccount = value),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '請選擇帳戶';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('取消'),
        ),
        ElevatedButton(
          onPressed: _isLoading ? null : _handleSubmit,
          child: _isLoading 
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('儲存'),
        ),
      ],
    );
  }

  List<String> _getCategories() {
    if (_selectedType == 'income') {
      return ['薪資', '獎金', '投資收益', '其他收入'];
    } else {
      return ['餐飲', '交通', '購物', '娛樂', '醫療', '其他支出'];
    }
  }

  List<String> _getAccounts() {
    return ['現金', '銀行帳戶', '信用卡', '電子錢包'];
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final transactionData = {
        'description': _descriptionController.text,
        'amount': double.parse(_amountController.text),
        'type': _selectedType,
        'categoryId': _selectedCategory!,
        'accountId': _selectedAccount!,
        'date': DateTime.now().toIso8601String(),
      };

      final result = await widget.businessLogic.createQuickTransaction(transactionData);

      if (result['success'] == true) {
        widget.onTransactionAdded();
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('交易記錄已新增')),
        );
      } else {
        throw Exception(result['error'] ?? '新增失敗');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('新增失敗：$e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _amountController.dispose();
    super.dispose();
  }
}

/// 記帳核心UI控制器
class BookkeepingCoreUIController {
  final BookkeepingCoreFunctionGroup businessLogic;

  BookkeepingCoreUIController({required this.businessLogic});

  /// 格式化金額顯示
  String formatAmount(double amount, {bool showSymbol = true, bool showCurrency = true}) {
    final formatted = amount.toStringAsFixed(2);

    String result = '';
    if (showSymbol && amount != 0) {
      result += amount > 0 ? '+' : '-';
    }
    if (showCurrency) {
      result += '\$';
    }
    result += amount.abs().toStringAsFixed(2);

    return result;
  }

  /// 格式化日期顯示
  String formatDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final targetDate = DateTime(date.year, date.month, date.day);

    if (targetDate == today) {
      return '今天';
    } else if (targetDate == yesterday) {
      return '昨天';
    } else if (date.year == now.year) {
      return '${date.month}/${date.day}';
    } else {
      return '${date.year}/${date.month}/${date.day}';
    }
  }

  /// 獲取交易類型圖示
  IconData getTransactionTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'income':
        return Icons.arrow_downward;
      case 'expense':
        return Icons.arrow_upward;
      default:
        return Icons.sync_alt;
    }
  }

  /// 獲取交易類型顏色
  Color getTransactionTypeColor(String type) {
    switch (type.toLowerCase()) {
      case 'income':
        return Colors.green;
      case 'expense':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}