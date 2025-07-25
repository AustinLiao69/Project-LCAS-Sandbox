
/**
 * Logger_Utility_1.0.0
 * @module 日誌工具模組
 * @description LCAS 2.0 統一日誌管理工具
 * @update 2025-01-23: 建立版本，實作分級日誌記錄機制
 */

import 'package:logger/logger.dart';
import 'package:flutter/foundation.dart';

/// 01. 應用程式日誌管理器
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 提供統一的日誌記錄介面，支援多種日誌等級和輸出格式
class AppLogger {
  static final AppLogger _instance = AppLogger._internal();
  factory AppLogger() => _instance;
  
  late final Logger _logger;
  
  AppLogger._internal() {
    _logger = Logger(
      filter: _CustomLogFilter(),
      printer: _CustomLogPrinter(),
      output: _CustomLogOutput(),
    );
  }

  /// 02. 除錯訊息記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄除錯資訊，僅在除錯模式下輸出
  void debug(String message, {String? tag, dynamic error, StackTrace? stackTrace}) {
    _logger.d(_formatMessage(message, tag), error: error, stackTrace: stackTrace);
  }

  /// 03. 一般資訊記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄一般操作資訊
  void info(String message, {String? tag, dynamic error, StackTrace? stackTrace}) {
    _logger.i(_formatMessage(message, tag), error: error, stackTrace: stackTrace);
  }

  /// 04. 警告訊息記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄警告訊息，提醒潛在問題
  void warning(String message, {String? tag, dynamic error, StackTrace? stackTrace}) {
    _logger.w(_formatMessage(message, tag), error: error, stackTrace: stackTrace);
  }

  /// 05. 錯誤訊息記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄錯誤訊息，包含錯誤詳情和堆疊追蹤
  void error(String message, {String? tag, dynamic error, StackTrace? stackTrace}) {
    _logger.e(_formatMessage(message, tag), error: error, stackTrace: stackTrace);
  }

  /// 06. 嚴重錯誤記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄嚴重錯誤，可能導致應用程式崩潰
  void fatal(String message, {String? tag, dynamic error, StackTrace? stackTrace}) {
    _logger.f(_formatMessage(message, tag), error: error, stackTrace: stackTrace);
  }

  /// 07. API請求日誌記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 專門記錄API請求相關的日誌
  void apiLog(String method, String url, {
    Map<String, dynamic>? headers,
    dynamic requestBody,
    dynamic responseBody,
    int? statusCode,
    String? error,
  }) {
    final logData = {
      'method': method,
      'url': url,
      'status_code': statusCode,
      if (headers != null) 'headers': headers,
      if (requestBody != null) 'request_body': requestBody,
      if (responseBody != null) 'response_body': responseBody,
      if (error != null) 'error': error,
    };
    
    if (error != null || (statusCode != null && statusCode >= 400)) {
      _logger.e(_formatMessage('API請求失敗', 'API'), error: logData);
    } else {
      _logger.i(_formatMessage('API請求成功', 'API'), error: logData);
    }
  }

  /// 08. 使用者操作日誌記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄使用者的重要操作行為
  void userAction(String action, {
    String? userId,
    Map<String, dynamic>? parameters,
    String? result,
  }) {
    final logData = {
      'action': action,
      'user_id': userId,
      'timestamp': DateTime.now().toIso8601String(),
      if (parameters != null) 'parameters': parameters,
      if (result != null) 'result': result,
    };
    
    _logger.i(_formatMessage('使用者操作: $action', 'USER'), error: logData);
  }

  /// 09. 效能監控日誌記錄
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 記錄效能相關的監控資訊
  void performance(String operation, Duration duration, {
    Map<String, dynamic>? metrics,
    String? details,
  }) {
    final logData = {
      'operation': operation,
      'duration_ms': duration.inMilliseconds,
      'timestamp': DateTime.now().toIso8601String(),
      if (metrics != null) 'metrics': metrics,
      if (details != null) 'details': details,
    };
    
    final message = '效能監控: $operation (${duration.inMilliseconds}ms)';
    
    // 如果執行時間過長，記錄為警告
    if (duration.inMilliseconds > 3000) {
      _logger.w(_formatMessage(message, 'PERF'), error: logData);
    } else {
      _logger.i(_formatMessage(message, 'PERF'), error: logData);
    }
  }

  /// 10. 格式化日誌訊息
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 統一格式化日誌訊息，包含標籤和時間戳記
  String _formatMessage(String message, String? tag) {
    final timestamp = DateTime.now().toIso8601String();
    final tagPart = tag != null ? '[$tag] ' : '';
    return '$tagPart$message';
  }
}

/// 11. 自訂日誌過濾器
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 控制不同環境下的日誌輸出等級
class _CustomLogFilter extends LogFilter {
  @override
  bool shouldLog(LogEvent event) {
    // 在發行版本中，只記錄警告和錯誤
    if (kReleaseMode) {
      return event.level.index >= Level.warning.index;
    }
    
    // 在除錯模式中，記錄所有等級
    if (kDebugMode) {
      return true;
    }
    
    // 在測試模式中，記錄資訊等級以上
    return event.level.index >= Level.info.index;
  }
}

/// 12. 自訂日誌印表機
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 自訂日誌輸出格式
class _CustomLogPrinter extends LogPrinter {
  @override
  List<String> log(LogEvent event) {
    final color = PrettyPrinter.defaultLevelColors[event.level];
    final emoji = PrettyPrinter.defaultLevelEmojis[event.level];
    final timestamp = DateTime.now().toIso8601String();
    
    return [color!('$emoji [$timestamp] ${event.level.name.toUpperCase()}: ${event.message}')];
  }
}

/// 13. 自訂日誌輸出
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 控制日誌的輸出目標
class _CustomLogOutput extends LogOutput {
  @override
  void output(OutputEvent event) {
    // 在除錯模式下，輸出到控制台
    if (kDebugMode) {
      for (final line in event.lines) {
        print(line);
      }
    }
    
    // 在發行版本中，可以將日誌發送到遠端服務
    if (kReleaseMode) {
      _sendToRemoteLogging(event);
    }
  }
  
  /// 14. 發送日誌到遠端服務
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 在發行版本中將重要日誌發送到遠端監控服務
  void _sendToRemoteLogging(OutputEvent event) {
    // 這裡可以實作發送日誌到 Firebase Crashlytics 或其他服務
    // 目前僅為預留實作
  }
}
