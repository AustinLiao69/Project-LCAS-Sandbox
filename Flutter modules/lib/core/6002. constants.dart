
/**
 * Constants_常數定義_1.0.0
 * @module 常數模組
 * @description LCAS 2.0 應用邏輯層常數定義 - API端點、配置參數和錯誤代碼
 * @update 2025-01-23: 建立v1.0.0版本，定義32個API端點常數
 */

class ApiConstants {
  // 應用基本資訊
  static const String appVersion = '2.0.0';
  static const String apiVersion = 'v1';
  
  // API基礎設定
  static const String baseUrl = 'https://your-replit-app.replit.dev/api/v1';
  static const Duration defaultTimeout = Duration(seconds: 30);
  
  // 認證相關端點
  static const String authRegister = '/auth/register';
  static const String authLogin = '/auth/login';
  static const String authLogout = '/auth/logout';
  static const String authDeleteAccount = '/auth/account';
  static const String authResetPassword = '/auth/reset-password';
  
  // 基礎記帳功能端點
  static const String appLedgerEntry = '/app/ledger/entry';
  static const String appLedgerQuery = '/app/ledger/query';
  static const String appSubjectsList = '/app/subjects/list';
  static const String appUserSettings = '/app/user/settings';
  
  // 專案帳本管理端點
  static const String appProjectsCreate = '/app/projects/create';
  static const String appProjectsManage = '/app/projects/manage';
  static const String appProjectsDelete = '/app/projects/delete';
  static const String appCategoriesCreate = '/app/categories/create';
  static const String appCategoriesManage = '/app/categories/manage';
  static const String appLedgersSwitch = '/app/ledgers/switch';
  
  // 預算管理端點
  static const String appBudgetsCreate = '/app/budgets/create';
  static const String appBudgetsMonitor = '/app/budgets/monitor';
  static const String appBudgetsAlerts = '/app/budgets/alerts';
  
  // 協作功能端點
  static const String appSharedCreate = '/app/shared/create';
  static const String appSharedPermissions = '/app/shared/permissions';
  static const String appSyncRealtime = '/app/sync/realtime'; // WebSocket
  
  // 報表功能端點
  static const String appReportsGenerate = '/app/reports/generate';
  static const String appReportsCustom = '/app/reports/custom';
  static const String appReportsExport = '/app/reports/export';
  
  // 系統管理端點
  static const String systemBackupSchedule = '/system/backup/schedule';
  static const String appBackupManual = '/app/backup/manual';
  static const String appBackupList = '/app/backup/list';
  static const String systemSyncStatus = '/system/sync/status';
  static const String systemHealthCheck = '/system/health/check';
  static const String systemLogsErrors = '/system/logs/errors';
  
  // 排程提醒端點
  static const String scheduleReminder = '/schedule/reminder';
  static const String scheduleExecute = '/schedule/execute';
}

class ErrorCodes {
  // 網路錯誤
  static const String connectionTimeout = 'CONNECTION_TIMEOUT';
  static const String networkError = 'NETWORK_ERROR';
  static const String serverError = 'SERVER_ERROR';
  
  // 認證錯誤
  static const String unauthorized = 'UNAUTHORIZED';
  static const String tokenExpired = 'TOKEN_EXPIRED';
  static const String invalidCredentials = 'INVALID_CREDENTIALS';
  
  // 資料錯誤
  static const String validationError = 'VALIDATION_ERROR';
  static const String dataNotFound = 'DATA_NOT_FOUND';
  static const String dataConflict = 'DATA_CONFLICT';
  
  // 權限錯誤
  static const String permissionDenied = 'PERMISSION_DENIED';
  static const String insufficientPermissions = 'INSUFFICIENT_PERMISSIONS';
  
  // 業務邏輯錯誤
  static const String budgetExceeded = 'BUDGET_EXCEEDED';
  static const String ledgerNotFound = 'LEDGER_NOT_FOUND';
  static const String duplicateEntry = 'DUPLICATE_ENTRY';
}

class CacheKeys {
  static const String userProfile = 'user_profile';
  static const String ledgerList = 'ledger_list';
  static const String subjectCodes = 'subject_codes';
  static const String budgetSettings = 'budget_settings';
  static const String recentEntries = 'recent_entries';
}

class AppConfig {
  // 快取設定
  static const Duration cacheExpiration = Duration(hours: 1);
  static const int maxCacheSize = 100;
  
  // 重試設定
  static const int maxRetryAttempts = 3;
  static const Duration retryDelay = Duration(seconds: 2);
  
  // 分頁設定
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  
  // 檔案上傳設定
  static const int maxFileSize = 10 * 1024 * 1024; // 10MB
  static const List<String> allowedFileTypes = ['pdf', 'jpg', 'png', 'csv', 'xlsx'];
}

class ValidationRules {
  // 帳號驗證
  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 32;
  static const int minUsernameLength = 2;
  static const int maxUsernameLength = 20;
  
  // 記帳資料驗證
  static const double maxAmount = 999999999.99;
  static const double minAmount = 0.01;
  static const int maxDescriptionLength = 200;
  
  // 預算驗證
  static const double maxBudgetAmount = 99999999.99;
  static const int maxBudgetCategories = 50;
}

class UIConstants {
  // 顏色主題
  static const String primaryColor = '#2E7D32';
  static const String secondaryColor = '#1B5E20';
  static const String errorColor = '#D32F2F';
  static const String warningColor = '#F57C00';
  static const String successColor = '#388E3C';
  
  // 間距設定
  static const double defaultPadding = 16.0;
  static const double smallPadding = 8.0;
  static const double largePadding = 24.0;
  
  // 字體大小
  static const double titleFontSize = 20.0;
  static const double bodyFontSize = 16.0;
  static const double captionFontSize = 12.0;
}

class DateTimeFormats {
  static const String apiDateTime = 'yyyy-MM-ddTHH:mm:ssZ';
  static const String displayDate = 'yyyy-MM-dd';
  static const String displayDateTime = 'yyyy-MM-dd HH:mm';
  static const String displayTime = 'HH:mm';
  static const String monthYear = 'yyyy-MM';
}

class LocalizationKeys {
  // 通用訊息
  static const String loading = 'loading';
  static const String success = 'success';
  static const String error = 'error';
  static const String retry = 'retry';
  static const String cancel = 'cancel';
  static const String confirm = 'confirm';
  
  // 認證相關
  static const String login = 'login';
  static const String logout = 'logout';
  static const String register = 'register';
  static const String forgotPassword = 'forgot_password';
  
  // 記帳相關
  static const String addEntry = 'add_entry';
  static const String editEntry = 'edit_entry';
  static const String deleteEntry = 'delete_entry';
  static const String amount = 'amount';
  static const String description = 'description';
  static const String category = 'category';
  
  // 錯誤訊息
  static const String networkErrorMsg = 'network_error_message';
  static const String serverErrorMsg = 'server_error_message';
  static const String validationErrorMsg = 'validation_error_message';
}
/**
 * Constants_常數定義_1.0.0
 * @module 常數模組
 * @description LCAS 2.0 應用邏輯層常數定義 - API端點、配置參數和錯誤代碼
 * @update 2025-01-24: 建立v1.0.0版本，定義32個API端點常數
 */

class ApiConstants {
  // 應用基本資訊
  static const String appVersion = '2.0.0';
  static const String apiVersion = 'v1';
  
  // API基礎設定
  static const String baseUrl = 'https://your-replit-app.replit.dev/api/v1';
  static const Duration defaultTimeout = Duration(seconds: 30);
  
  // 認證相關端點
  static const String authRegister = '/auth/register';
  static const String authLogin = '/auth/login';
  static const String authLogout = '/auth/logout';
  static const String authDeleteAccount = '/auth/account';
  static const String authResetPassword = '/auth/reset-password';
  
  // 基礎記帳功能端點
  static const String appLedgerEntry = '/app/ledger/entry';
  static const String appLedgerQuery = '/app/ledger/query';
  static const String appSubjectsList = '/app/subjects/list';
  static const String appUserSettings = '/app/user/settings';
  
  // 專案帳本管理端點
  static const String appProjectsCreate = '/app/projects/create';
  static const String appProjectsManage = '/app/projects/manage';
  static const String appProjectsDelete = '/app/projects/delete';
  static const String appCategoriesCreate = '/app/categories/create';
  static const String appCategoriesManage = '/app/categories/manage';
  static const String appLedgersSwitch = '/app/ledgers/switch';
  
  // 預算管理端點
  static const String appBudgetsCreate = '/app/budgets/create';
  static const String appBudgetsMonitor = '/app/budgets/monitor';
  static const String appBudgetsAlerts = '/app/budgets/alerts';
  
  // 協作功能端點
  static const String appSharedCreate = '/app/shared/create';
  static const String appSharedPermissions = '/app/shared/permissions';
  static const String appSyncRealtime = '/app/sync/realtime'; // WebSocket
  
  // 報表功能端點
  static const String appReportsGenerate = '/app/reports/generate';
  static const String appReportsCustom = '/app/reports/custom';
  static const String appReportsExport = '/app/reports/export';
  
  // 系統管理端點
  static const String systemBackupSchedule = '/system/backup/schedule';
  static const String appBackupManual = '/app/backup/manual';
  static const String appBackupList = '/app/backup/list';
  static const String systemSyncStatus = '/system/sync/status';
  static const String systemHealthCheck = '/system/health/check';
  static const String systemLogsErrors = '/system/logs/errors';
  
  // 排程提醒端點
  static const String scheduleReminder = '/schedule/reminder';
  static const String scheduleExecute = '/schedule/execute';
}

class ErrorCodes {
  // 網路錯誤
  static const String connectionTimeout = 'CONNECTION_TIMEOUT';
  static const String networkError = 'NETWORK_ERROR';
  static const String serverError = 'SERVER_ERROR';
  
  // 認證錯誤
  static const String unauthorized = 'UNAUTHORIZED';
  static const String tokenExpired = 'TOKEN_EXPIRED';
  static const String invalidCredentials = 'INVALID_CREDENTIALS';
  
  // 資料錯誤
  static const String validationError = 'VALIDATION_ERROR';
  static const String dataNotFound = 'DATA_NOT_FOUND';
  static const String dataConflict = 'DATA_CONFLICT';
  
  // 權限錯誤
  static const String permissionDenied = 'PERMISSION_DENIED';
  static const String insufficientPermissions = 'INSUFFICIENT_PERMISSIONS';
  
  // 業務邏輯錯誤
  static const String budgetExceeded = 'BUDGET_EXCEEDED';
  static const String ledgerNotFound = 'LEDGER_NOT_FOUND';
  static const String duplicateEntry = 'DUPLICATE_ENTRY';
}

class CacheKeys {
  static const String userProfile = 'user_profile';
  static const String ledgerList = 'ledger_list';
  static const String subjectCodes = 'subject_codes';
  static const String budgetSettings = 'budget_settings';
  static const String recentEntries = 'recent_entries';
}

class AppConfig {
  // 快取設定
  static const Duration cacheExpiration = Duration(hours: 1);
  static const int maxCacheSize = 100;
  
  // 重試設定
  static const int maxRetryAttempts = 3;
  static const Duration retryDelay = Duration(seconds: 2);
  
  // 分頁設定
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  
  // 檔案上傳設定
  static const int maxFileSize = 10 * 1024 * 1024; // 10MB
  static const List<String> allowedFileTypes = ['pdf', 'jpg', 'png', 'csv', 'xlsx'];
}

class ValidationRules {
  // 帳號驗證
  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 32;
  static const int minUsernameLength = 2;
  static const int maxUsernameLength = 20;
  
  // 記帳資料驗證
  static const double maxAmount = 999999999.99;
  static const double minAmount = 0.01;
  static const int maxDescriptionLength = 200;
  
  // 預算驗證
  static const double maxBudgetAmount = 99999999.99;
  static const int maxBudgetCategories = 50;
}

class UIConstants {
  // 顏色主題
  static const String primaryColor = '#2E7D32';
  static const String secondaryColor = '#1B5E20';
  static const String errorColor = '#D32F2F';
  static const String warningColor = '#F57C00';
  static const String successColor = '#388E3C';
  
  // 間距設定
  static const double defaultPadding = 16.0;
  static const double smallPadding = 8.0;
  static const double largePadding = 24.0;
  
  // 字體大小
  static const double titleFontSize = 20.0;
  static const double bodyFontSize = 16.0;
  static const double captionFontSize = 12.0;
}

class DateTimeFormats {
  static const String apiDateTime = 'yyyy-MM-ddTHH:mm:ssZ';
  static const String displayDate = 'yyyy-MM-dd';
  static const String displayDateTime = 'yyyy-MM-dd HH:mm';
  static const String displayTime = 'HH:mm';
  static const String monthYear = 'yyyy-MM';
}

class LocalizationKeys {
  // 通用訊息
  static const String loading = 'loading';
  static const String success = 'success';
  static const String error = 'error';
  static const String retry = 'retry';
  static const String cancel = 'cancel';
  static const String confirm = 'confirm';
  
  // 認證相關
  static const String login = 'login';
  static const String logout = 'logout';
  static const String register = 'register';
  static const String forgotPassword = 'forgot_password';
  
  // 記帳相關
  static const String addEntry = 'add_entry';
  static const String editEntry = 'edit_entry';
  static const String deleteEntry = 'delete_entry';
  static const String amount = 'amount';
  static const String description = 'description';
  static const String category = 'category';
  
  // 錯誤訊息
  static const String networkErrorMsg = 'network_error_message';
  static const String serverErrorMsg = 'server_error_message';
  static const String validationErrorMsg = 'validation_error_message';
}
