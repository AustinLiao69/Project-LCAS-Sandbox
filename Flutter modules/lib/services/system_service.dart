
/**
 * SystemService_系統服務模組_1.0.0
 * @module SystemService
 * @description 系統管理服務 - 定期自動備份、系統監控與日誌管理、資料同步檢查
 * @update 2025-01-23: 初版建立，實現完整系統управления功能
 */

import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/system_models.dart';

class SystemService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  SystemService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  }) : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. 定期自動備份
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 設定系統定期自動備份機制
   */
  Future<BackupScheduleResponse> scheduleBackup({
    required BackupScheduleRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/system/backup/schedule',
        data: request.toJson(),
      );

      if (response.success) {
        return BackupScheduleResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '定期備份設定失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error, 
        context: '定期自動備份',
        fallbackMessage: '備份排程設定失敗，請稍後重試'
      );
    }
  }

  /**
   * 02. 手動備份還原
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 執行手動備份操作
   */
  Future<ManualBackupResponse> manualBackup({
    required ManualBackupRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/backup/manual',
        data: request.toJson(),
      );

      if (response.success) {
        return ManualBackupResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '手動備份失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '手動備份還原',
        fallbackMessage: '手動備份執行失敗，請檢查網路連線'
      );
    }
  }

  /**
   * 03. 備份檔案管理
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 查詢和管理備份檔案列表
   */
  Future<BackupListResponse> listBackups({
    BackupListRequest? request,
  }) async {
    try {
      final queryParams = request?.toQueryParams() ?? {};
      
      final response = await _apiClient.get(
        '/app/backup/list',
        queryParams: queryParams,
      );

      if (response.success) {
        return BackupListResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '備份清單查詢失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '備份檔案管理',
        fallbackMessage: '無法載入備份檔案清單'
      );
    }
  }

  /**
   * 04. 資料同步檢查
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 檢查系統資料同步狀態
   */
  Future<SyncStatusResponse> checkSyncStatus({
    SyncStatusRequest? request,
  }) async {
    try {
      final queryParams = request?.toQueryParams() ?? {};
      
      final response = await _apiClient.get(
        '/system/sync/status',
        queryParams: queryParams,
      );

      if (response.success) {
        return SyncStatusResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '同步狀態檢查失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '資料同步檢查',
        fallbackMessage: '無法檢查資料同步狀態'
      );
    }
  }

  /**
   * 05. 系統健康監控
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 檢查系統運行健康狀態
   */
  Future<HealthCheckResponse> healthCheck({
    HealthCheckRequest? request,
  }) async {
    try {
      final queryParams = request?.toQueryParams() ?? {};
      
      final response = await _apiClient.get(
        '/system/health/check',
        queryParams: queryParams,
      );

      if (response.success) {
        return HealthCheckResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '系統健康檢查失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '系統健康監控',
        fallbackMessage: '系統健康狀態檢查失敗'
      );
    }
  }

  /**
   * 06. 錯誤日誌管理
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 查詢和管理系統錯誤日誌
   */
  Future<ErrorLogsResponse> getErrorLogs({
    required ErrorLogsRequest request,
  }) async {
    try {
      final queryParams = request.toQueryParams();
      
      final response = await _apiClient.get(
        '/system/logs/errors',
        queryParams: queryParams,
      );

      if (response.success) {
        return ErrorLogsResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '錯誤日誌查詢失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '錯誤日誌管理',
        fallbackMessage: '無法載入系統錯誤日誌'
      );
    }
  }

  /**
   * 07. 系統性能統計
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 取得系統性能統計資訊
   */
  Future<SystemMetricsResponse> getSystemMetrics({
    SystemMetricsRequest? request,
  }) async {
    try {
      final queryParams = request?.toQueryParams() ?? {};
      
      final response = await _apiClient.get(
        '/system/metrics',
        queryParams: queryParams,
      );

      if (response.success) {
        return SystemMetricsResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '系統指標查詢失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '系統性能統計',
        fallbackMessage: '無法載入系統性能指標'
      );
    }
  }

  /**
   * 08. 清理系統資料
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 12:00:00
   * @description 執行系統資料清理作業
   */
  Future<CleanupResponse> cleanupSystemData({
    required CleanupRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/system/cleanup',
        data: request.toJson(),
      );

      if (response.success) {
        return CleanupResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '系統清理失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '清理系統資料',
        fallbackMessage: '系統資料清理作業失敗'
      );
    }
  }
}
