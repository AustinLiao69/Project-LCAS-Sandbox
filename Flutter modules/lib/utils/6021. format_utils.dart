
/**
 * FormatUtils_格式化工具類別_1.0.0
 * @module FormatUtils
 * @description 統一的資料格式化工具函數
 * @update 2025-01-23: 初版建立，提供常用的資料格式化功能
 */

import 'package:intl/intl.dart';

class FormatUtils {
  // 貨幣格式化器
  static final NumberFormat _currencyFormatter = NumberFormat.currency(
    locale: 'zh_TW',
    symbol: 'NT\$',
    decimalDigits: 0,
  );
  
  static final NumberFormat _decimalCurrencyFormatter = NumberFormat.currency(
    locale: 'zh_TW',
    symbol: 'NT\$',
    decimalDigits: 2,
  );
  
  // 數字格式化器
  static final NumberFormat _numberFormatter = NumberFormat('#,###');
  static final NumberFormat _decimalFormatter = NumberFormat('#,###.##');
  static final NumberFormat _percentFormatter = NumberFormat.percentPattern();

  /**
   * 01. 格式化金額（整數）
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 將數字格式化為台幣格式（整數）
   */
  static String formatCurrency(num amount) {
    return _currencyFormatter.format(amount);
  }

  /**
   * 02. 格式化金額（小數）
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 將數字格式化為台幣格式（包含小數點）
   */
  static String formatCurrencyWithDecimal(num amount) {
    return _decimalCurrencyFormatter.format(amount);
  }

  /**
   * 03. 格式化數字（千分位）
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 將數字格式化為千分位格式
   */
  static String formatNumber(num number) {
    return _numberFormatter.format(number);
  }

  /**
   * 04. 格式化小數
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 將數字格式化為小數格式（千分位+小數點）
   */
  static String formatDecimal(num number) {
    return _decimalFormatter.format(number);
  }

  /**
   * 05. 格式化百分比
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 將數字格式化為百分比格式
   */
  static String formatPercentage(num ratio, {int decimalPlaces = 1}) {
    final formatter = NumberFormat.percentPattern();
    formatter.minimumFractionDigits = decimalPlaces;
    formatter.maximumFractionDigits = decimalPlaces;
    return formatter.format(ratio);
  }

  /**
   * 06. 格式化收支狀態
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 根據金額正負格式化收支狀態顯示
   */
  static String formatIncomeExpense(num amount, {bool showSign = true}) {
    final formattedAmount = formatCurrency(amount.abs());
    
    if (amount > 0) {
      return showSign ? '+$formattedAmount' : formattedAmount;
    } else if (amount < 0) {
      return showSign ? '-$formattedAmount' : formattedAmount;
    } else {
      return formatCurrency(0);
    }
  }

  /**
   * 07. 格式化檔案大小
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 將位元組數格式化為可讀的檔案大小
   */
  static String formatFileSize(int bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    double size = bytes.toDouble();
    int unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    if (unitIndex == 0) {
      return '${size.toInt()} ${units[unitIndex]}';
    } else {
      return '${size.toStringAsFixed(2)} ${units[unitIndex]}';
    }
  }

  /**
   * 08. 格式化手機號碼
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化台灣手機號碼顯示
   */
  static String formatPhoneNumber(String phone) {
    if (phone.length == 10 && phone.startsWith('09')) {
      return '${phone.substring(0, 4)}-${phone.substring(4, 7)}-${phone.substring(7)}';
    }
    return phone;
  }

  /**
   * 09. 格式化身分證號碼
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化台灣身分證號碼顯示（部分遮蔽）
   */
  static String formatTaiwanId(String id, {bool mask = true}) {
    if (id.length != 10) return id;
    
    if (mask) {
      return '${id.substring(0, 2)}****${id.substring(6)}';
    } else {
      return id.toUpperCase();
    }
  }

  /**
   * 10. 格式化Email（部分遮蔽）
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化Email顯示（部分遮蔽保護隱私）
   */
  static String formatEmail(String email, {bool mask = true}) {
    if (!mask) return email;
    
    final parts = email.split('@');
    if (parts.length != 2) return email;
    
    final username = parts[0];
    final domain = parts[1];
    
    if (username.length <= 2) {
      return '${username[0]}*@$domain';
    } else {
      final maskedUsername = '${username[0]}${'*' * (username.length - 2)}${username[username.length - 1]}';
      return '$maskedUsername@$domain';
    }
  }

  /**
   * 11. 格式化銀行帳號（部分遮蔽）
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化銀行帳號顯示（部分遮蔽）
   */
  static String formatBankAccount(String account, {bool mask = true}) {
    if (!mask || account.length <= 4) return account;
    
    final visibleStart = account.substring(0, 2);
    final visibleEnd = account.substring(account.length - 2);
    final maskedMiddle = '*' * (account.length - 4);
    
    return '$visibleStart$maskedMiddle$visibleEnd';
  }

  /**
   * 12. 格式化科目代碼顯示
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化記帳科目代碼顯示
   */
  static String formatSubjectCode(String code, String name) {
    return '$code - $name';
  }

  /**
   * 13. 格式化帳本類型顯示
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化帳本類型的顯示名稱
   */
  static String formatLedgerType(String type) {
    const typeMap = {
      'default': '個人帳本',
      'project': '專案帳本',
      'category': '分類帳本',
      'shared': '共享帳本',
    };
    
    return typeMap[type] ?? type;
  }

  /**
   * 14. 格式化記帳類型顯示
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化記帳類型的顯示名稱
   */
  static String formatEntryType(String type) {
    const typeMap = {
      'income': '收入',
      'expense': '支出',
      'transfer': '轉帳',
    };
    
    return typeMap[type] ?? type;
  }

  /**
   * 15. 格式化預算狀態顯示
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化預算執行狀態顯示
   */
  static String formatBudgetStatus(double usedAmount, double totalAmount) {
    final usageRate = totalAmount > 0 ? usedAmount / totalAmount : 0;
    final percentage = formatPercentage(usageRate);
    
    if (usageRate <= 0.5) {
      return '預算充足 ($percentage)';
    } else if (usageRate <= 0.8) {
      return '預算正常 ($percentage)';
    } else if (usageRate <= 1.0) {
      return '預算警告 ($percentage)';
    } else {
      return '預算超支 ($percentage)';
    }
  }

  /**
   * 16. 格式化時間區間
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化時間區間的顯示
   */
  static String formatDateRange(DateTime startDate, DateTime endDate) {
    final dateFormat = DateFormat('MM/dd');
    final yearFormat = DateFormat('yyyy');
    
    final startFormatted = dateFormat.format(startDate);
    final endFormatted = dateFormat.format(endDate);
    final year = yearFormat.format(startDate);
    
    if (startDate.year == endDate.year) {
      if (startDate.month == endDate.month) {
        // 同年同月
        return '${startDate.day}-${endDate.day}日 ($year年${startDate.month}月)';
      } else {
        // 同年不同月
        return '$startFormatted - $endFormatted ($year年)';
      }
    } else {
      // 不同年
      final startYear = yearFormat.format(startDate);
      final endYear = yearFormat.format(endDate);
      return '$startFormatted($startYear) - $endFormatted($endYear)';
    }
  }

  /**
   * 17. 格式化統計摘要
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化統計摘要的顯示
   */
  static String formatStatisticsSummary({
    required num totalIncome,
    required num totalExpense,
    required int entryCount,
  }) {
    final income = formatCurrency(totalIncome);
    final expense = formatCurrency(totalExpense);
    final net = formatIncomeExpense(totalIncome + totalExpense);
    
    return '收入：$income\n支出：$expense\n淨額：$net\n記錄：${entryCount}筆';
  }

  /**
   * 18. 格式化API錯誤訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化API錯誤訊息為使用者友善的格式
   */
  static String formatApiErrorMessage(String errorCode, String? errorMessage) {
    const errorCodeMap = {
      'NETWORK_ERROR': '網路連線異常，請檢查網路設定',
      'TIMEOUT_ERROR': '請求逾時，請稍後重試',
      'AUTH_ERROR': '認證失敗，請重新登入',
      'PERMISSION_ERROR': '權限不足，無法執行此操作',
      'VALIDATION_ERROR': '資料格式錯誤，請檢查輸入內容',
      'SERVER_ERROR': '伺服器錯誤，請稍後重試',
    };
    
    final friendlyMessage = errorCodeMap[errorCode];
    if (friendlyMessage != null) {
      return friendlyMessage;
    }
    
    return errorMessage ?? '發生未知錯誤，請聯繫客服';
  }

  /**
   * 19. 格式化通知訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化各種通知訊息
   */
  static String formatNotificationMessage({
    required String type,
    required Map<String, dynamic> data,
  }) {
    switch (type) {
      case 'budget_warning':
        final category = data['category'] ?? '';
        final usageRate = formatPercentage(data['usage_rate'] ?? 0);
        return '⚠️ $category 預算使用率已達 $usageRate，請注意支出控制';
        
      case 'monthly_summary':
        final month = data['month'] ?? '';
        final income = formatCurrency(data['income'] ?? 0);
        final expense = formatCurrency(data['expense'] ?? 0);
        return '📊 $month 財務摘要：收入 $income，支出 $expense';
        
      case 'backup_completed':
        final date = data['date'] ?? '';
        final size = formatFileSize(data['size'] ?? 0);
        return '💾 資料備份完成 ($date)，備份檔案大小：$size';
        
      default:
        return data['message']?.toString() ?? '系統通知';
    }
  }

  /**
   * 20. 格式化搜尋結果摘要
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化搜尋結果的摘要資訊
   */
  static String formatSearchSummary({
    required int totalResults,
    required String keyword,
    required String? dateRange,
  }) {
    final dateInfo = dateRange != null ? ' (時間：$dateRange)' : '';
    return '搜尋「$keyword」找到 ${formatNumber(totalResults)} 筆結果$dateInfo';
  }

  /**
   * 21. 格式化載入狀態訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化各種載入狀態的訊息
   */
  static String formatLoadingMessage(String action) {
    const actionMap = {
      'login': '登入中...',
      'loading_data': '載入資料中...',
      'saving': '儲存中...',
      'uploading': '上傳中...',
      'downloading': '下載中...',
      'processing': '處理中...',
      'generating_report': '產生報表中...',
      'backup': '備份中...',
      'sync': '同步中...',
    };
    
    return actionMap[action] ?? '處理中...';
  }

  /**
   * 22. 格式化成功訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化操作成功的訊息
   */
  static String formatSuccessMessage(String action, {Map<String, dynamic>? data}) {
    switch (action) {
      case 'save_entry':
        final amount = data?['amount'] != null ? formatCurrency(data!['amount']) : '';
        return '✅ 記帳成功！金額：$amount';
        
      case 'create_budget':
        final budgetName = data?['name'] ?? '';
        return '✅ 預算「$budgetName」建立成功！';
        
      case 'backup_complete':
        final fileSize = data?['size'] != null ? formatFileSize(data!['size']) : '';
        return '✅ 備份完成！檔案大小：$fileSize';
        
      case 'report_generated':
        return '✅ 報表產生完成！';
        
      default:
        return '✅ 操作完成！';
    }
  }

  /**
   * 23. 格式化清單項目顯示
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化清單項目的統一顯示格式
   */
  static String formatListItem({
    required String title,
    String? subtitle,
    String? amount,
    String? date,
  }) {
    final parts = <String>[title];
    
    if (subtitle != null && subtitle.isNotEmpty) {
      parts.add(subtitle);
    }
    
    if (amount != null && amount.isNotEmpty) {
      parts.add(amount);
    }
    
    if (date != null && date.isNotEmpty) {
      parts.add('($date)');
    }
    
    return parts.join(' - ');
  }

  /**
   * 24. 格式化版本號顯示
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化應用程式版本號顯示
   */
  static String formatVersionNumber(String version, {String? buildNumber}) {
    if (buildNumber != null && buildNumber.isNotEmpty) {
      return 'v$version ($buildNumber)';
    }
    return 'v$version';
  }

  /**
   * 25. 格式化系統狀態顯示
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 14:00:00
   * @description 格式化系統運行狀態的顯示
   */
  static String formatSystemStatus(String status, {double? healthScore}) {
    const statusMap = {
      'healthy': '✅ 系統正常',
      'warning': '⚠️ 系統警告',
      'critical': '🚨 系統異常',
      'maintenance': '🔧 系統維護中',
    };
    
    final statusText = statusMap[status] ?? status;
    
    if (healthScore != null) {
      final score = formatPercentage(healthScore / 100);
      return '$statusText (健康度：$score)';
    }
    
    return statusText;
  }
}
