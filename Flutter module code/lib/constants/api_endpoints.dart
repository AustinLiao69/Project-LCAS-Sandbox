
/**
 * API_Endpoints_1.0.0
 * @module API端點常數
 * @description LCAS 2.0 所有API端點的集中定義
 * @update 2025-01-23: 建立版本，定義完整的API端點結構
 */

/// 01. API端點管理類別
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 統一管理所有API端點，支援動態端點生成
class ApiEndpoints {
  
  // ========== 認證相關端點 ==========
  
  /// F001 使用者註冊端點
  static const String register = '/auth/register';
  
  /// F002 使用者登入端點
  static const String login = '/auth/login';
  
  /// F003 使用者登出端點
  static const String logout = '/auth/logout';
  
  /// F004 帳號刪除端點
  static const String deleteAccount = '/auth/account';
  
  /// F005 密碼重設端點
  static const String resetPassword = '/auth/reset-password';
  
  /// Token刷新端點
  static const String refreshToken = '/auth/refresh';
  
  // ========== 基礎記帳功能端點 ==========
  
  /// F007 APP記帳功能端點
  static const String createLedgerEntry = '/app/ledger/entry';
  
  /// F009 APP記錄查詢端點
  static const String queryLedgerEntries = '/app/ledger/query';
  
  /// F010 科目代碼管理端點
  static const String getSubjectsList = '/app/subjects/list';
  
  /// F011 使用者設定管理端點
  static const String updateUserSettings = '/app/user/settings';
  
  /// 取得使用者設定端點
  static const String getUserSettings = '/app/user/settings';
  
  /// 更新記帳記錄端點
  static String updateLedgerEntry(String entryId) => '/app/ledger/entry/$entryId';
  
  /// 刪除記帳記錄端點
  static String deleteLedgerEntry(String entryId) => '/app/ledger/entry/$entryId';
  
  // ========== 帳本管理端點 ==========
  
  /// F031 專案帳本建立端點
  static const String createProject = '/app/projects/create';
  
  /// F032 專案帳本管理端點
  static String manageProject(String projectId) => '/app/projects/$projectId';
  
  /// F033 專案帳本刪除端點
  static String deleteProject(String projectId) => '/app/projects/$projectId';
  
  /// F034 分類帳本建立端點
  static const String createCategory = '/app/categories/create';
  
  /// F035 分類帳本管理端點
  static String manageCategory(String categoryId) => '/app/categories/$categoryId';
  
  /// F036 多帳本切換端點
  static const String switchLedger = '/app/ledgers/switch';
  
  /// 取得帳本列表端點
  static const String getLedgersList = '/app/ledgers/list';
  
  /// 取得特定帳本資訊端點
  static String getLedgerInfo(String ledgerId) => '/app/ledgers/$ledgerId';
  
  // ========== 預算管理端點 ==========
  
  /// F037 預算設定建立端點
  static const String createBudget = '/app/budgets/create';
  
  /// F038 預算追蹤監控端點
  static const String monitorBudget = '/app/budgets/monitor';
  
  /// F039 預算警示設定端點
  static const String setBudgetAlerts = '/app/budgets/alerts';
  
  /// 取得預算列表端點
  static const String getBudgetsList = '/app/budgets/list';
  
  /// 更新預算設定端點
  static String updateBudget(String budgetId) => '/app/budgets/$budgetId';
  
  /// 刪除預算設定端點
  static String deleteBudget(String budgetId) => '/app/budgets/$budgetId';
  
  // ========== 協作功能端點 ==========
  
  /// F040 共享帳本建立端點
  static const String createSharedLedger = '/app/shared/create';
  
  /// F041 多人協作權限端點
  static const String managePermissions = '/app/shared/permissions';
  
  /// F042 即時協作同步端點
  static const String realtimeSync = '/app/sync/realtime';
  
  /// 邀請協作者端點
  static String inviteCollaborator(String ledgerId) => '/app/shared/$ledgerId/invite';
  
  /// 移除協作者端點
  static String removeCollaborator(String ledgerId, String userId) => '/app/shared/$ledgerId/collaborators/$userId';
  
  /// 取得協作者列表端點
  static String getCollaborators(String ledgerId) => '/app/shared/$ledgerId/collaborators';
  
  // ========== 報表功能端點 ==========
  
  /// F043 標準報表產出端點
  static const String generateReport = '/app/reports/generate';
  
  /// F044 自定義報表設計端點
  static const String createCustomReport = '/app/reports/custom';
  
  /// F045 報表匯出功能端點
  static const String exportReport = '/app/reports/export';
  
  /// 取得報表列表端點
  static const String getReportsList = '/app/reports/list';
  
  /// 取得特定報表端點
  static String getReport(String reportId) => '/app/reports/$reportId';
  
  /// 刪除報表端點
  static String deleteReport(String reportId) => '/app/reports/$reportId';
  
  // ========== 備份相關端點 ==========
  
  /// F051 定期自動備份端點
  static const String scheduleBackup = '/system/backup/schedule';
  
  /// F052 手動備份還原端點
  static const String manualBackup = '/app/backup/manual';
  
  /// F053 備份檔案管理端點
  static const String listBackups = '/app/backup/list';
  
  /// 還原備份端點
  static String restoreBackup(String backupId) => '/app/backup/restore/$backupId';
  
  /// 下載備份端點
  static String downloadBackup(String backupId) => '/app/backup/download/$backupId';
  
  /// 刪除備份端點
  static String deleteBackup(String backupId) => '/app/backup/$backupId';
  
  // ========== 系統管理端點 ==========
  
  /// F054 資料同步檢查端點
  static const String checkSyncStatus = '/system/sync/status';
  
  /// F055 系統健康監控端點
  static const String healthCheck = '/system/health/check';
  
  /// F056 錯誤日誌管理端點
  static const String getErrorLogs = '/system/logs/errors';
  
  /// F057 排程提醒設定端點
  static const String setReminder = '/schedule/reminder';
  
  /// F058 排程提醒執行端點
  static const String executeReminder = '/schedule/execute';
  
  /// 取得系統資訊端點
  static const String getSystemInfo = '/system/info';
  
  /// 取得使用者統計端點
  static const String getUserStatistics = '/app/statistics/user';
  
  /// 取得帳本統計端點
  static String getLedgerStatistics(String ledgerId) => '/app/statistics/ledger/$ledgerId';
  
  // ========== 檔案處理端點 ==========
  
  /// 檔案上傳端點
  static const String uploadFile = '/app/files/upload';
  
  /// 檔案下載端點
  static String downloadFile(String fileId) => '/app/files/download/$fileId';
  
  /// 檔案刪除端點
  static String deleteFile(String fileId) => '/app/files/$fileId';
  
  /// 取得檔案列表端點
  static const String getFilesList = '/app/files/list';
  
  // ========== 通知相關端點 ==========
  
  /// 取得通知列表端點
  static const String getNotifications = '/app/notifications/list';
  
  /// 標記通知為已讀端點
  static String markNotificationRead(String notificationId) => '/app/notifications/$notificationId/read';
  
  /// 刪除通知端點
  static String deleteNotification(String notificationId) => '/app/notifications/$notificationId';
  
  /// 更新通知設定端點
  static const String updateNotificationSettings = '/app/notifications/settings';
  
  // ========== 輔助方法 ==========
  
  /// 02. 建構帶參數的端點URL
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 12:00:00
  /// @description 根據基礎端點和參數建構完整的URL
  static String buildEndpoint(String baseEndpoint, Map<String, String> pathParams) {
    String endpoint = baseEndpoint;
    pathParams.forEach((key, value) {
      endpoint = endpoint.replaceAll('{$key}', value);
    });
    return endpoint;
  }
  
  /// 03. 建構帶查詢參數的端點URL
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 12:00:00
  /// @description 為端點添加查詢參數
  static String buildEndpointWithQuery(String baseEndpoint, Map<String, String>? queryParams) {
    if (queryParams == null || queryParams.isEmpty) {
      return baseEndpoint;
    }
    
    final queryString = queryParams.entries
        .map((entry) => '${entry.key}=${Uri.encodeComponent(entry.value)}')
        .join('&');
    
    return '$baseEndpoint?$queryString';
  }
  
  /// 04. 驗證端點格式
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 12:00:00
  /// @description 驗證端點URL格式是否正確
  static bool isValidEndpoint(String endpoint) {
    if (endpoint.isEmpty) return false;
    if (!endpoint.startsWith('/')) return false;
    
    // 檢查是否包含無效字符
    final invalidChars = [' ', '\t', '\n', '\r'];
    return !invalidChars.any((char) => endpoint.contains(char));
  }
  
  /// 05. 取得端點分類
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 12:00:00
  /// @description 根據端點路徑判斷所屬的功能分類
  static String getEndpointCategory(String endpoint) {
    if (endpoint.startsWith('/auth/')) return 'Authentication';
    if (endpoint.startsWith('/app/ledger/')) return 'Ledger';
    if (endpoint.startsWith('/app/projects/')) return 'Projects';
    if (endpoint.startsWith('/app/categories/')) return 'Categories';
    if (endpoint.startsWith('/app/budgets/')) return 'Budgets';
    if (endpoint.startsWith('/app/shared/')) return 'Collaboration';
    if (endpoint.startsWith('/app/reports/')) return 'Reports';
    if (endpoint.startsWith('/app/backup/')) return 'Backup';
    if (endpoint.startsWith('/system/')) return 'System';
    if (endpoint.startsWith('/schedule/')) return 'Schedule';
    if (endpoint.startsWith('/app/files/')) return 'Files';
    if (endpoint.startsWith('/app/notifications/')) return 'Notifications';
    
    return 'General';
  }
}
