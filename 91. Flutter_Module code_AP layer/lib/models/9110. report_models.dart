
/**
 * report_models.dart_報表資料模型_1.0.0
 * @module 報表資料模型
 * @description LCAS 2.0 Flutter 報表功能相關資料模型 - 報表產出、自定義報表、匯出等資料結構
 * @update 2025-01-24: 建立報表相關資料模型，支援多格式報表產出和自定義設計
 */

import 'package:json_annotation/json_annotation.dart';

part 'report_models.g.dart';

/// 報表模型
@JsonSerializable()
class Report {
  final String id;
  final String name;
  final String description;
  final String userId;
  final String? projectId;
  final String type; // standard, custom
  final String template; // income_statement, balance_sheet, cash_flow, custom
  final ReportConfig config;
  final String status; // generating, completed, failed
  final String? fileUrl;
  final String? format; // pdf, excel, csv
  final DateTime createdAt;
  final DateTime? completedAt;
  final Map<String, dynamic>? metadata;

  const Report({
    required this.id,
    required this.name,
    required this.description,
    required this.userId,
    this.projectId,
    required this.type,
    required this.template,
    required this.config,
    required this.status,
    this.fileUrl,
    this.format,
    required this.createdAt,
    this.completedAt,
    this.metadata,
  });

  factory Report.fromJson(Map<String, dynamic> json) =>
      _$ReportFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportToJson(this);

  /// 複製報表並更新部分欄位
  Report copyWith({
    String? id,
    String? name,
    String? description,
    String? userId,
    String? projectId,
    String? type,
    String? template,
    ReportConfig? config,
    String? status,
    String? fileUrl,
    String? format,
    DateTime? createdAt,
    DateTime? completedAt,
    Map<String, dynamic>? metadata,
  }) {
    return Report(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      userId: userId ?? this.userId,
      projectId: projectId ?? this.projectId,
      type: type ?? this.type,
      template: template ?? this.template,
      config: config ?? this.config,
      status: status ?? this.status,
      fileUrl: fileUrl ?? this.fileUrl,
      format: format ?? this.format,
      createdAt: createdAt ?? this.createdAt,
      completedAt: completedAt ?? this.completedAt,
      metadata: metadata ?? this.metadata,
    );
  }

  /// 是否為標準報表
  bool get isStandardReport => type == 'standard';

  /// 是否為自定義報表
  bool get isCustomReport => type == 'custom';

  /// 報表是否已完成
  bool get isCompleted => status == 'completed';

  /// 報表是否失敗
  bool get isFailed => status == 'failed';

  /// 報表是否正在產生
  bool get isGenerating => status == 'generating';
}

/// 產生報表請求模型
@JsonSerializable()
class GenerateReportRequest {
  final String name;
  final String? description;
  final String template;
  final String? projectId;
  final ReportConfig config;
  final String format; // pdf, excel, csv
  final bool autoEmail;
  final List<String>? emailRecipients;

  const GenerateReportRequest({
    required this.name,
    this.description,
    required this.template,
    this.projectId,
    required this.config,
    required this.format,
    this.autoEmail = false,
    this.emailRecipients,
  });

  factory GenerateReportRequest.fromJson(Map<String, dynamic> json) =>
      _$GenerateReportRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$GenerateReportRequestToJson(this);
}

/// 報表設定模型
@JsonSerializable()
class ReportConfig {
  final DateTime startDate;
  final DateTime endDate;
  final List<String>? includedLedgers;
  final List<String>? includedCategories;
  final List<String>? excludedCategories;
  final String groupBy; // daily, weekly, monthly, category, subject
  final bool includeCharts;
  final bool includeComparisons;
  final String? comparisonPeriod; // previous_period, same_period_last_year
  final Map<String, dynamic>? customFields;
  final ReportStyling? styling;

  const ReportConfig({
    required this.startDate,
    required this.endDate,
    this.includedLedgers,
    this.includedCategories,
    this.excludedCategories,
    required this.groupBy,
    this.includeCharts = false,
    this.includeComparisons = false,
    this.comparisonPeriod,
    this.customFields,
    this.styling,
  });

  factory ReportConfig.fromJson(Map<String, dynamic> json) =>
      _$ReportConfigFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportConfigToJson(this);
}

/// 報表樣式設定模型
@JsonSerializable()
class ReportStyling {
  final String theme; // default, corporate, modern
  final String primaryColor;
  final String? logoUrl;
  final String? headerText;
  final String? footerText;
  final Map<String, dynamic>? fontSettings;
  final Map<String, dynamic>? layoutSettings;

  const ReportStyling({
    required this.theme,
    required this.primaryColor,
    this.logoUrl,
    this.headerText,
    this.footerText,
    this.fontSettings,
    this.layoutSettings,
  });

  factory ReportStyling.fromJson(Map<String, dynamic> json) =>
      _$ReportStylingFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportStylingToJson(this);
}

/// 自定義報表請求模型
@JsonSerializable()
class CreateCustomReportRequest {
  final String name;
  final String description;
  final String? projectId;
  final CustomReportStructure structure;
  final ReportConfig config;
  final bool saveAsTemplate;
  final String? templateName;

  const CreateCustomReportRequest({
    required this.name,
    required this.description,
    this.projectId,
    required this.structure,
    required this.config,
    this.saveAsTemplate = false,
    this.templateName,
  });

  factory CreateCustomReportRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateCustomReportRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$CreateCustomReportRequestToJson(this);
}

/// 自定義報表結構模型
@JsonSerializable()
class CustomReportStructure {
  final List<ReportSection> sections;
  final List<ReportChart>? charts;
  final List<ReportTable>? tables;
  final Map<String, dynamic>? calculations;
  final ReportLayout layout;

  const CustomReportStructure({
    required this.sections,
    this.charts,
    this.tables,
    this.calculations,
    required this.layout,
  });

  factory CustomReportStructure.fromJson(Map<String, dynamic> json) =>
      _$CustomReportStructureFromJson(json);
  
  Map<String, dynamic> toJson() => _$CustomReportStructureToJson(this);
}

/// 報表區段模型
@JsonSerializable()
class ReportSection {
  final String id;
  final String title;
  final String type; // summary, detail, chart, table
  final int order;
  final Map<String, dynamic> config;
  final bool visible;

  const ReportSection({
    required this.id,
    required this.title,
    required this.type,
    required this.order,
    required this.config,
    this.visible = true,
  });

  factory ReportSection.fromJson(Map<String, dynamic> json) =>
      _$ReportSectionFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportSectionToJson(this);
}

/// 報表圖表模型
@JsonSerializable()
class ReportChart {
  final String id;
  final String title;
  final String type; // pie, bar, line, area
  final String dataSource;
  final Map<String, dynamic> config;
  final int order;

  const ReportChart({
    required this.id,
    required this.title,
    required this.type,
    required this.dataSource,
    required this.config,
    required this.order,
  });

  factory ReportChart.fromJson(Map<String, dynamic> json) =>
      _$ReportChartFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportChartToJson(this);
}

/// 報表表格模型
@JsonSerializable()
class ReportTable {
  final String id;
  final String title;
  final List<String> columns;
  final String dataSource;
  final Map<String, dynamic> config;
  final int order;

  const ReportTable({
    required this.id,
    required this.title,
    required this.columns,
    required this.dataSource,
    required this.config,
    required this.order,
  });

  factory ReportTable.fromJson(Map<String, dynamic> json) =>
      _$ReportTableFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportTableToJson(this);
}

/// 報表版面配置模型
@JsonSerializable()
class ReportLayout {
  final String orientation; // portrait, landscape
  final String pageSize; // A4, A3, letter
  final Map<String, double> margins;
  final bool showPageNumbers;
  final bool showDate;
  final String? watermark;

  const ReportLayout({
    required this.orientation,
    required this.pageSize,
    required this.margins,
    this.showPageNumbers = true,
    this.showDate = true,
    this.watermark,
  });

  factory ReportLayout.fromJson(Map<String, dynamic> json) =>
      _$ReportLayoutFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportLayoutToJson(this);
}

/// 報表清單回應模型
@JsonSerializable()
class ReportListResponse {
  final bool success;
  final List<Report> reports;
  final int totalCount;
  final String message;
  final DateTime timestamp;

  const ReportListResponse({
    required this.success,
    required this.reports,
    required this.totalCount,
    required this.message,
    required this.timestamp,
  });

  factory ReportListResponse.fromJson(Map<String, dynamic> json) =>
      _$ReportListResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$ReportListResponseToJson(this);
}

/// 報表匯出請求模型
@JsonSerializable()
class ExportReportRequest {
  final String reportId;
  final String format; // pdf, excel, csv
  final bool includeCharts;
  final bool includeRawData;
  final String? emailTo;
  final Map<String, dynamic>? exportOptions;

  const ExportReportRequest({
    required this.reportId,
    required this.format,
    this.includeCharts = true,
    this.includeRawData = false,
    this.emailTo,
    this.exportOptions,
  });

  factory ExportReportRequest.fromJson(Map<String, dynamic> json) =>
      _$ExportReportRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$ExportReportRequestToJson(this);
}

/// 報表匯出回應模型
@JsonSerializable()
class ExportReportResponse {
  final bool success;
  final String? downloadUrl;
  final String? fileName;
  final int? fileSize;
  final String? format;
  final DateTime? expiresAt;
  final String message;
  final DateTime timestamp;

  const ExportReportResponse({
    required this.success,
    this.downloadUrl,
    this.fileName,
    this.fileSize,
    this.format,
    this.expiresAt,
    required this.message,
    required this.timestamp,
  });

  factory ExportReportResponse.fromJson(Map<String, dynamic> json) =>
      _$ExportReportResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$ExportReportResponseToJson(this);
}
