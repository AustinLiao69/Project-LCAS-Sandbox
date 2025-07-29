
/**
 * ReportService_報表服務模組_1.0.0
 * @module ReportService
 * @description 報表功能服務 - 標準報表產出、自定義報表設計、報表匯出功能
 * @update 2025-01-23: 初版建立，實現完整報表管理功能
 */

import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/report_models.dart';

class ReportService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  ReportService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  }) : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. 標準報表產出
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 產生標準格式的財務報表
   */
  Future<ReportGenerationResponse> generateReport({
    required ReportGenerationRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/reports/generate',
        data: request.toJson(),
      );

      if (response.success) {
        return ReportGenerationResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '報表產生失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error, 
        context: '標準報表產出',
        fallbackMessage: '無法產生報表，請稍後重試'
      );
    }
  }

  /**
   * 02. 自定義報表設計
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 建立和設計自定義報表模板
   */
  Future<CustomReportResponse> createCustomReport({
    required CustomReportRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/reports/custom',
        data: request.toJson(),
      );

      if (response.success) {
        return CustomReportResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '自定義報表建立失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '自定義報表設計',
        fallbackMessage: '無法建立自定義報表，請檢查報表設定'
      );
    }
  }

  /**
   * 03. 報表匯出功能
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 匯出報表為各種格式（PDF、Excel、CSV）
   */
  Future<ReportExportResponse> exportReport({
    required ReportExportRequest request,
  }) async {
    try {
      final queryParams = request.toQueryParams();
      
      final response = await _apiClient.get(
        '/app/reports/export',
        queryParams: queryParams,
      );

      if (response.success) {
        return ReportExportResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '報表匯出失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '報表匯出功能',
        fallbackMessage: '無法匯出報表檔案'
      );
    }
  }

  /**
   * 04. 查詢報表清單
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 查詢已建立的報表清單
   */
  Future<ReportListResponse> getReports({
    ReportListRequest? request,
  }) async {
    try {
      final queryParams = request?.toQueryParams() ?? {};
      
      final response = await _apiClient.get(
        '/app/reports/list',
        queryParams: queryParams,
      );

      if (response.success) {
        return ReportListResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '報表清單查詢失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '查詢報表清單',
        fallbackMessage: '無法載入報表清單'
      );
    }
  }

  /**
   * 05. 報表模板管理
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 管理報表模板的建立、修改和刪除
   */
  Future<ReportTemplateResponse> manageTemplate({
    required ReportTemplateRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/reports/template',
        data: request.toJson(),
      );

      if (response.success) {
        return ReportTemplateResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '報表模板操作失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '報表模板管理',
        fallbackMessage: '無法處理報表模板操作'
      );
    }
  }

  /**
   * 06. 報表預覽功能
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 預覽報表內容而不實際產生檔案
   */
  Future<ReportPreviewResponse> previewReport({
    required ReportPreviewRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/reports/preview',
        data: request.toJson(),
      );

      if (response.success) {
        return ReportPreviewResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '報表預覽失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '報表預覽功能',
        fallbackMessage: '無法預覽報表內容'
      );
    }
  }

  /**
   * 07. 排程報表設定
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 設定定期自動產生報表的排程
   */
  Future<ScheduledReportResponse> scheduleReport({
    required ScheduledReportRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/reports/schedule',
        data: request.toJson(),
      );

      if (response.success) {
        return ScheduledReportResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '排程報表設定失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '排程報表設定',
        fallbackMessage: '無法設定自動報表排程'
      );
    }
  }

  /**
   * 08. 報表分享功能
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 16:00:00
   * @description 分享報表給其他使用者或產生分享連結
   */
  Future<ReportShareResponse> shareReport({
    required ReportShareRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/reports/share',
        data: request.toJson(),
      );

      if (response.success) {
        return ReportShareResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '報表分享失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '報表分享功能',
        fallbackMessage: '無法分享報表，請檢查分享設定'
      );
    }
  }
}
