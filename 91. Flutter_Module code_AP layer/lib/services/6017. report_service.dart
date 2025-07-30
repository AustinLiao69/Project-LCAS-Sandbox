/**
 * ReportService_報表服務模組_1.1.0
 * @module ReportService
 * @description 報表功能服務 - 標準報表產出、自定義報表設計、報表匯出功能
 * @update 2025-01-24: 升級至v1.1.0，增強檔案處理和模板系統
 */

import 'package:http/http.dart' as http;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:excel/excel.dart';
import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/report_models.dart';

class ReportService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  // 報表模板快取
  final Map<String, ReportTemplate> _templateCache = {};

  // 本地儲存路徑
  Directory? _localDirectory;

  ReportService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  }) : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler() {
    _initializeLocalDirectory();
  }

  /**
   * 初始化本地儲存目錄
   * @version 2025-01-24-V1.1.0
   */
  Future<void> _initializeLocalDirectory() async {
    try {
      _localDirectory = await getApplicationDocumentsDirectory();
      final reportsDir = Directory('${_localDirectory!.path}/reports');
      if (!reportsDir.existsSync()) {
        reportsDir.createSync(recursive: true);
      }
    } catch (e) {
      debugPrint('初始化本地目錄失敗: $e');
    }
  }

  /**
   * 01. 標準報表產出 - 增強版本
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 16:00:00
   * @description 產生標準格式的財務報表，支援本地PDF生成和快取機制
   */
  Future<ReportGenerationResponse> generateReport({
    required ReportGenerationRequest request,
  }) async {
    try {
      // 檢查本地快取
      final cacheKey = _generateCacheKey(request);
      if (_hasValidCache(cacheKey)) {
        return _getCachedReport(cacheKey);
      }

      final response = await _apiClient.post(
        '/app/reports/generate',
        data: request.toJson(),
      );

      if (response.success) {
        final reportResponse = ReportGenerationResponse.fromJson(response.data);

        // 根據格式生成本地檔案
        if (request.format == 'pdf') {
          final pdfFile = await _generatePdfReport(reportResponse);
          reportResponse.localFilePath = pdfFile.path;
        } else if (request.format == 'excel') {
          final excelFile = await _generateExcelReport(reportResponse);
          reportResponse.localFilePath = excelFile.path;
        }

        // 快取結果
        _cacheReport(cacheKey, reportResponse);

        return reportResponse;
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
   * 生成PDF報表
   * @version 2025-01-24-V1.1.0
   */
  Future<File> _generatePdfReport(ReportGenerationResponse reportData) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Header(
                level: 0,
                child: pw.Text('財務報表', style: pw.TextStyle(fontSize: 24)),
              ),
              pw.SizedBox(height: 20),
              pw.Text('報表期間: ${reportData.period}'),
              pw.Text('產生時間: ${DateTime.now().toString()}'),
              pw.SizedBox(height: 20),
              // 這裡可以加入更多報表內容
              ...reportData.sections.map((section) => pw.Text(section.title)),
            ],
          );
        },
      ),
    );

    final fileName = 'report_${DateTime.now().millisecondsSinceEpoch}.pdf';
    final file = File('${_localDirectory!.path}/reports/$fileName');
    await file.writeAsBytes(await pdf.save());

    debugPrint('PDF報表已生成: ${file.path}');
    return file;
  }

  /**
   * 生成Excel報表
   * @version 2025-01-24-V1.1.0
   */
  Future<File> _generateExcelReport(ReportGenerationResponse reportData) async {
    final excel = Excel.createExcel();
    final sheet = excel['Sheet1'];

    // 設定標題
    sheet.cell(CellIndex.indexByString('A1')).value = TextCellValue('財務報表');
    sheet.cell(CellIndex.indexByString('A2')).value = TextCellValue('報表期間: ${reportData.period}');
    sheet.cell(CellIndex.indexByString('A3')).value = TextCellValue('產生時間: ${DateTime.now()}');

    // 加入報表資料
    int row = 5;
    for (final section in reportData.sections) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: row++))
          .value = TextCellValue(section.title);
    }

    final fileName = 'report_${DateTime.now().millisecondsSinceEpoch}.xlsx';
    final file = File('${_localDirectory!.path}/reports/$fileName');
    final fileBytes = excel.save();

    if (fileBytes != null) {
      await file.writeAsBytes(fileBytes);
    }

    debugPrint('Excel報表已生成: ${file.path}');
    return file;
  }

  /**
   * 生成快取鍵值
   * @version 2025-01-24-V1.1.0
   */
  String _generateCacheKey(ReportGenerationRequest request) {
    return 'report_${request.type}_${request.period}_${request.format}';
  }

  /**
   * 檢查快取有效性
   * @version 2025-01-24-V1.1.0
   */
  bool _hasValidCache(String cacheKey) {
    // 簡化版本，實際應該檢查快取時間
    return false;
  }

  /**
   * 取得快取報表
   * @version 2025-01-24-V1.1.0
   */
  ReportGenerationResponse _getCachedReport(String cacheKey) {
    // 實作快取邏輯
    throw UnimplementedError('快取功能待實作');
  }

  /**
   * 快取報表
   * @version 2025-01-24-V1.1.0
   */
  void _cacheReport(String cacheKey, ReportGenerationResponse report) {
    // 實作快取邏輯
    debugPrint('報表已快取: $cacheKey');
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