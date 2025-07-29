
/**
 * DateUtils_日期工具類別_1.0.0
 * @module DateUtils
 * @description 統一的日期處理工具函數
 * @update 2025-01-23: 初版建立，提供常用的日期格式化和計算功能
 */

import 'package:intl/intl.dart';

class DateUtils {
  // 常用日期格式
  static const String _defaultDateFormat = 'yyyy-MM-dd';
  static const String _defaultDateTimeFormat = 'yyyy-MM-dd HH:mm:ss';
  static const String _displayDateFormat = 'yyyy年MM月dd日';
  static const String _displayDateTimeFormat = 'yyyy年MM月dd日 HH:mm';
  static const String _apiDateTimeFormat = "yyyy-MM-ddTHH:mm:ss+08:00";

  /**
   * 01. 格式化日期為字串
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 將DateTime物件格式化為指定格式的字串
   */
  static String formatDate(DateTime date, {String? format}) {
    final formatter = DateFormat(format ?? _defaultDateFormat);
    return formatter.format(date);
  }

  /**
   * 02. 格式化日期時間為字串
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 將DateTime物件格式化為日期時間字串
   */
  static String formatDateTime(DateTime dateTime, {String? format}) {
    final formatter = DateFormat(format ?? _defaultDateTimeFormat);
    return formatter.format(dateTime);
  }

  /**
   * 03. 格式化為顯示用日期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 格式化為使用者友善的日期顯示格式
   */
  static String formatDisplayDate(DateTime date) {
    final formatter = DateFormat(_displayDateFormat);
    return formatter.format(date);
  }

  /**
   * 04. 格式化為顯示用日期時間
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 格式化為使用者友善的日期時間顯示格式
   */
  static String formatDisplayDateTime(DateTime dateTime) {
    final formatter = DateFormat(_displayDateTimeFormat);
    return formatter.format(dateTime);
  }

  /**
   * 05. 格式化為API用日期時間
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 格式化為API標準的ISO 8601格式
   */
  static String formatApiDateTime(DateTime dateTime) {
    final formatter = DateFormat(_apiDateTimeFormat);
    return formatter.format(dateTime);
  }

  /**
   * 06. 解析日期字串
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 將日期字串解析為DateTime物件
   */
  static DateTime? parseDate(String dateString, {String? format}) {
    try {
      final formatter = DateFormat(format ?? _defaultDateFormat);
      return formatter.parse(dateString);
    } catch (e) {
      return null;
    }
  }

  /**
   * 07. 解析日期時間字串
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 將日期時間字串解析為DateTime物件
   */
  static DateTime? parseDateTime(String dateTimeString, {String? format}) {
    try {
      final formatter = DateFormat(format ?? _defaultDateTimeFormat);
      return formatter.parse(dateTimeString);
    } catch (e) {
      return null;
    }
  }

  /**
   * 08. 解析API日期時間字串
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 解析API標準格式的日期時間字串
   */
  static DateTime? parseApiDateTime(String apiDateTimeString) {
    try {
      return DateTime.parse(apiDateTimeString);
    } catch (e) {
      return null;
    }
  }

  /**
   * 09. 取得今日開始時間
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得今日00:00:00的DateTime
   */
  static DateTime getTodayStart() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  /**
   * 10. 取得今日結束時間
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得今日23:59:59的DateTime
   */
  static DateTime getTodayEnd() {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day, 23, 59, 59);
  }

  /**
   * 11. 取得本週開始日期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得本週週一的日期
   */
  static DateTime getWeekStart([DateTime? date]) {
    final targetDate = date ?? DateTime.now();
    final daysFromMonday = targetDate.weekday - 1;
    final monday = targetDate.subtract(Duration(days: daysFromMonday));
    return DateTime(monday.year, monday.month, monday.day);
  }

  /**
   * 12. 取得本週結束日期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得本週週日的日期
   */
  static DateTime getWeekEnd([DateTime? date]) {
    final weekStart = getWeekStart(date);
    final sunday = weekStart.add(const Duration(days: 6));
    return DateTime(sunday.year, sunday.month, sunday.day, 23, 59, 59);
  }

  /**
   * 13. 取得本月開始日期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得本月第一天的日期
   */
  static DateTime getMonthStart([DateTime? date]) {
    final targetDate = date ?? DateTime.now();
    return DateTime(targetDate.year, targetDate.month, 1);
  }

  /**
   * 14. 取得本月結束日期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得本月最後一天的日期
   */
  static DateTime getMonthEnd([DateTime? date]) {
    final targetDate = date ?? DateTime.now();
    final nextMonth = DateTime(targetDate.year, targetDate.month + 1, 1);
    final lastDay = nextMonth.subtract(const Duration(days: 1));
    return DateTime(lastDay.year, lastDay.month, lastDay.day, 23, 59, 59);
  }

  /**
   * 15. 取得本年開始日期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得本年第一天的日期
   */
  static DateTime getYearStart([DateTime? date]) {
    final targetDate = date ?? DateTime.now();
    return DateTime(targetDate.year, 1, 1);
  }

  /**
   * 16. 取得本年結束日期
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得本年最後一天的日期
   */
  static DateTime getYearEnd([DateTime? date]) {
    final targetDate = date ?? DateTime.now();
    return DateTime(targetDate.year, 12, 31, 23, 59, 59);
  }

  /**
   * 17. 計算日期差異
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 計算兩個日期間的天數差異
   */
  static int daysBetween(DateTime from, DateTime to) {
    final difference = to.difference(from);
    return difference.inDays;
  }

  /**
   * 18. 判斷是否為今天
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 判斷指定日期是否為今天
   */
  static bool isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year &&
           date.month == now.month &&
           date.day == now.day;
  }

  /**
   * 19. 判斷是否為本週
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 判斷指定日期是否在本週內
   */
  static bool isThisWeek(DateTime date) {
    final weekStart = getWeekStart();
    final weekEnd = getWeekEnd();
    return date.isAfter(weekStart.subtract(const Duration(days: 1))) &&
           date.isBefore(weekEnd.add(const Duration(days: 1)));
  }

  /**
   * 20. 判斷是否為本月
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 判斷指定日期是否在本月內
   */
  static bool isThisMonth(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month;
  }

  /**
   * 21. 取得相對時間描述
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得如「剛剛」、「5分鐘前」等相對時間描述
   */
  static String getRelativeTimeString(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return '剛剛';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}分鐘前';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}小時前';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}天前';
    } else if (difference.inDays < 30) {
      final weeks = (difference.inDays / 7).floor();
      return '${weeks}週前';
    } else if (difference.inDays < 365) {
      final months = (difference.inDays / 30).floor();
      return '${months}個月前';
    } else {
      final years = (difference.inDays / 365).floor();
      return '${years}年前';
    }
  }

  /**
   * 22. 取得月份名稱
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得月份的中文名稱
   */
  static String getMonthName(int month) {
    const monthNames = [
      '', '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月'
    ];
    
    if (month >= 1 && month <= 12) {
      return monthNames[month];
    }
    return '';
  }

  /**
   * 23. 取得星期名稱
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得星期的中文名稱
   */
  static String getWeekdayName(int weekday) {
    const weekdayNames = [
      '', '週一', '週二', '週三', '週四', '週五', '週六', '週日'
    ];
    
    if (weekday >= 1 && weekday <= 7) {
      return weekdayNames[weekday];
    }
    return '';
  }

  /**
   * 24. 判斷是否為工作日
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 判斷指定日期是否為工作日（週一到週五）
   */
  static bool isWorkday(DateTime date) {
    return date.weekday >= 1 && date.weekday <= 5;
  }

  /**
   * 25. 判斷是否為週末
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 判斷指定日期是否為週末（週六或週日）
   */
  static bool isWeekend(DateTime date) {
    return date.weekday == 6 || date.weekday == 7;
  }

  /**
   * 26. 新增天數
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 在指定日期基礎上新增指定天數
   */
  static DateTime addDays(DateTime date, int days) {
    return date.add(Duration(days: days));
  }

  /**
   * 27. 新增月份
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 在指定日期基礎上新增指定月份
   */
  static DateTime addMonths(DateTime date, int months) {
    int newYear = date.year;
    int newMonth = date.month + months;
    
    while (newMonth > 12) {
      newYear++;
      newMonth -= 12;
    }
    
    while (newMonth < 1) {
      newYear--;
      newMonth += 12;
    }
    
    // 處理月底日期問題
    int maxDay = DateTime(newYear, newMonth + 1, 0).day;
    int newDay = date.day > maxDay ? maxDay : date.day;
    
    return DateTime(newYear, newMonth, newDay, date.hour, date.minute, date.second);
  }

  /**
   * 28. 新增年份
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 在指定日期基礎上新增指定年份
   */
  static DateTime addYears(DateTime date, int years) {
    return DateTime(
      date.year + years,
      date.month,
      date.day,
      date.hour,
      date.minute,
      date.second,
    );
  }
}
