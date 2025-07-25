
/**
 * API_Constants_1.0.0
 * @module API常數模組
 * @description LCAS 2.0 API 端點與常數定義
 * @update 2025-01-23: 建立版本，定義所有API端點常數
 */

class ApiConstants {
  // 基礎配置
  static const String baseUrl = 'https://your-replit-app.replit.app';
  static const int connectionTimeout = 30000; // 30秒
  static const int receiveTimeout = 30000; // 30秒
  
  // API版本
  static const String apiVersion = 'v1';
  
  // ========== 認證與帳戶管理 API ==========
  /// F001 使用者註冊
  static const String register = '/auth/register';
  
  /// F002 使用者登入
  static const String login = '/auth/login';
  
  /// F003 使用者登出
  static const String logout = '/auth/logout';
  
  /// F004 帳號刪除
  static const String deleteAccount = '/auth/account';
  
  /// F005 密碼重設
  static const String resetPassword = '/auth/reset-password';
  
  // ========== 基礎記帳功能 API ==========
  /// F007 APP 記帳功能
  static const String createLedgerEntry = '/app/ledger/entry';
  
  /// F009 APP 記錄查詢
  static const String queryLedgerEntries = '/app/ledger/query';
  
  /// F010 科目代碼管理
  static const String getSubjectsList = '/app/subjects/list';
  
  /// F011 使用者設定管理
  static const String updateUserSettings = '/app/user/settings';
  
  // ========== APP 進階功能 API ==========
  /// F031 專案帳本建立
  static const String createProject = '/app/projects/create';
  
  /// F032 專案帳本管理
  static const String manageProject = '/app/projects/manage';
  
  /// F033 專案帳本刪除
  static const String deleteProject = '/app/projects/delete';
  
  /// F034 分類帳本建立
  static const String createCategory = '/app/categories/create';
  
  /// F035 分類帳本管理
  static const String manageCategory = '/app/categories/manage';
  
  /// F036 多帳本切換
  static const String switchLedger = '/app/ledgers/switch';
  
  /// F037 預算設定建立
  static const String createBudget = '/app/budgets/create';
  
  /// F038 預算追蹤監控
  static const String monitorBudget = '/app/budgets/monitor';
  
  /// F039 預算警示設定
  static const String setBudgetAlerts = '/app/budgets/alerts';
  
  /// F040 共享帳本建立
  static const String createSharedLedger = '/app/shared/create';
  
  /// F041 多人協作權限
  static const String managePermissions = '/app/shared/permissions';
  
  /// F042 即時協作同步
  static const String realtimeSync = '/app/sync/realtime';
  
  /// F043 標準報表產出
  static const String generateReport = '/app/reports/generate';
  
  /// F044 自定義報表設計
  static const String createCustomReport = '/app/reports/custom';
  
  /// F045 報表匯出功能
  static const String exportReport = '/app/reports/export';
  
  // ========== 系統管理功能 API ==========
  /// F051 定期自動備份
  static const String scheduleBackup = '/system/backup/schedule';
  
  /// F052 手動備份還原
  static const String manualBackup = '/app/backup/manual';
  
  /// F053 備份檔案管理
  static const String listBackups = '/app/backup/list';
  
  /// F054 資料同步檢查
  static const String checkSyncStatus = '/system/sync/status';
  
  /// F055 系統健康監控
  static const String healthCheck = '/system/health/check';
  
  /// F056 錯誤日誌管理
  static const String getErrorLogs = '/system/logs/errors';
  
  /// F057 排程提醒設定
  static const String setReminder = '/schedule/reminder';
  
  /// F058 排程提醒執行
  static const String executeReminder = '/schedule/execute';
  
  // ========== HTTP 狀態碼 ==========
  static const int statusOk = 200;
  static const int statusCreated = 201;
  static const int statusBadRequest = 400;
  static const int statusUnauthorized = 401;
  static const int statusForbidden = 403;
  static const int statusNotFound = 404;
  static const int statusInternalServerError = 500;
  
  // ========== 錯誤碼定義 ==========
  static const String errorNetworkTimeout = 'NETWORK_TIMEOUT';
  static const String errorNetworkError = 'NETWORK_ERROR';
  static const String errorInvalidResponse = 'INVALID_RESPONSE';
  static const String errorUnauthorized = 'UNAUTHORIZED';
  static const String errorServerError = 'SERVER_ERROR';
  static const String errorValidationFailed = 'VALIDATION_FAILED';
  static const String errorResourceNotFound = 'RESOURCE_NOT_FOUND';
  
  // ========== 預設值 ==========
  static const int defaultPageSize = 50;
  static const int maxRetryAttempts = 3;
  static const String defaultCurrency = 'TWD';
  static const String defaultTimezone = 'Asia/Taipei';
  static const String defaultLanguage = 'zh-TW';
}
