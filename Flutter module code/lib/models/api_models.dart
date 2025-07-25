
/**
 * API_Models_1.0.0
 * @module API資料模型
 * @description LCAS 2.0 API請求與回應的資料模型定義
 * @update 2025-01-23: 建立版本，定義統一的資料模型結構
 */

import 'package:json_annotation/json_annotation.dart';

part 'api_models.g.dart';

/// 01. 分頁請求參數
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義分頁查詢的標準參數
@JsonSerializable()
class PaginationRequest {
  @JsonKey(name: 'page')
  final int page;
  
  @JsonKey(name: 'page_size')
  final int pageSize;
  
  @JsonKey(name: 'sort_by')
  final String? sortBy;
  
  @JsonKey(name: 'sort_order')
  final String? sortOrder; // 'asc' 或 'desc'

  const PaginationRequest({
    this.page = 1,
    this.pageSize = 50,
    this.sortBy,
    this.sortOrder = 'desc',
  });

  factory PaginationRequest.fromJson(Map<String, dynamic> json) =>
      _$PaginationRequestFromJson(json);

  Map<String, dynamic> toJson() => _$PaginationRequestToJson(this);
}

/// 02. 查詢篩選參數
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義查詢篩選的標準參數
@JsonSerializable()
class QueryFilter {
  @JsonKey(name: 'start_date')
  final String? startDate;
  
  @JsonKey(name: 'end_date')
  final String? endDate;
  
  @JsonKey(name: 'categories')
  final List<String>? categories;
  
  @JsonKey(name: 'amount_min')
  final double? amountMin;
  
  @JsonKey(name: 'amount_max')
  final double? amountMax;
  
  @JsonKey(name: 'keywords')
  final String? keywords;
  
  @JsonKey(name: 'entry_type')
  final String? entryType; // 'income' 或 'expense'

  const QueryFilter({
    this.startDate,
    this.endDate,
    this.categories,
    this.amountMin,
    this.amountMax,
    this.keywords,
    this.entryType,
  });

  factory QueryFilter.fromJson(Map<String, dynamic> json) =>
      _$QueryFilterFromJson(json);

  Map<String, dynamic> toJson() => _$QueryFilterToJson(this);
}

/// 03. 檔案上傳資訊
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義檔案上傳的相關資訊
@JsonSerializable()
class FileUploadInfo {
  @JsonKey(name: 'file_name')
  final String fileName;
  
  @JsonKey(name: 'file_size')
  final int fileSize;
  
  @JsonKey(name: 'file_type')
  final String fileType;
  
  @JsonKey(name: 'file_url')
  final String? fileUrl;
  
  @JsonKey(name: 'upload_date')
  final String uploadDate;

  const FileUploadInfo({
    required this.fileName,
    required this.fileSize,
    required this.fileType,
    this.fileUrl,
    required this.uploadDate,
  });

  factory FileUploadInfo.fromJson(Map<String, dynamic> json) =>
      _$FileUploadInfoFromJson(json);

  Map<String, dynamic> toJson() => _$FileUploadInfoToJson(this);
}

/// 04. 統計資訊
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義統計數據的標準格式
@JsonSerializable()
class StatisticsInfo {
  @JsonKey(name: 'total_income')
  final double totalIncome;
  
  @JsonKey(name: 'total_expense')
  final double totalExpense;
  
  @JsonKey(name: 'net_amount')
  final double netAmount;
  
  @JsonKey(name: 'entry_count')
  final int entryCount;
  
  @JsonKey(name: 'period_start')
  final String periodStart;
  
  @JsonKey(name: 'period_end')
  final String periodEnd;

  const StatisticsInfo({
    required this.totalIncome,
    required this.totalExpense,
    required this.netAmount,
    required this.entryCount,
    required this.periodStart,
    required this.periodEnd,
  });

  factory StatisticsInfo.fromJson(Map<String, dynamic> json) =>
      _$StatisticsInfoFromJson(json);

  Map<String, dynamic> toJson() => _$StatisticsInfoToJson(this);
}

/// 05. 系統狀態資訊
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義系統健康狀態的資訊格式
@JsonSerializable()
class SystemStatus {
  @JsonKey(name: 'status')
  final String status; // 'healthy', 'warning', 'error'
  
  @JsonKey(name: 'version')
  final String version;
  
  @JsonKey(name: 'uptime')
  final int uptime; // 秒數
  
  @JsonKey(name: 'database_status')
  final String databaseStatus;
  
  @JsonKey(name: 'last_backup')
  final String? lastBackup;
  
  @JsonKey(name: 'active_users')
  final int? activeUsers;

  const SystemStatus({
    required this.status,
    required this.version,
    required this.uptime,
    required this.databaseStatus,
    this.lastBackup,
    this.activeUsers,
  });

  factory SystemStatus.fromJson(Map<String, dynamic> json) =>
      _$SystemStatusFromJson(json);

  Map<String, dynamic> toJson() => _$SystemStatusToJson(this);
}
