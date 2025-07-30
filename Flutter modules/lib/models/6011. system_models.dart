
/**
 * SystemModels_系統服務資料模型_1.0.0
 * @module SystemModels
 * @description 系統服務相關的資料模型定義
 * @update 2025-01-23: 初版建立，定義系統管理相關資料結構
 */

import 'package:json_annotation/json_annotation.dart';

part 'system_models.g.dart';

// ============= 備份相關模型 =============

@JsonSerializable()
class BackupScheduleRequest {
  @JsonKey(name: 'backup_config')
  final BackupConfig backupConfig;
  
  @JsonKey(name: 'backup_scope')
  final BackupScope backupScope;
  
  @JsonKey(name: 'backup_options')
  final BackupOptions backupOptions;
  
  @JsonKey(name: 'notification_settings')
  final NotificationSettings notificationSettings;

  BackupScheduleRequest({
    required this.backupConfig,
    required this.backupScope,
    required this.backupOptions,
    required this.notificationSettings,
  });

  factory BackupScheduleRequest.fromJson(Map<String, dynamic> json) =>
      _$BackupScheduleRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupScheduleRequestToJson(this);
}

@JsonSerializable()
class BackupConfig {
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'backup_name')
  final String backupName;
  
  final bool enabled;
  
  @JsonKey(name: 'schedule_type')
  final String scheduleType;
  
  final String frequency;
  
  @JsonKey(name: 'time_of_day')
  final String timeOfDay;
  
  final String timezone;

  BackupConfig({
    required this.userId,
    required this.backupName,
    required this.enabled,
    required this.scheduleType,
    required this.frequency,
    required this.timeOfDay,
    required this.timezone,
  });

  factory BackupConfig.fromJson(Map<String, dynamic> json) =>
      _$BackupConfigFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupConfigToJson(this);
}

@JsonSerializable()
class BackupScope {
  @JsonKey(name: 'include_ledgers')
  final String includeLedgers;
  
  @JsonKey(name: 'ledger_ids')
  final List<String>? ledgerIds;
  
  @JsonKey(name: 'include_settings')
  final bool includeSettings;
  
  @JsonKey(name: 'include_reports')
  final bool includeReports;
  
  @JsonKey(name: 'include_attachments')
  final bool includeAttachments;

  BackupScope({
    required this.includeLedgers,
    this.ledgerIds,
    required this.includeSettings,
    required this.includeReports,
    required this.includeAttachments,
  });

  factory BackupScope.fromJson(Map<String, dynamic> json) =>
      _$BackupScopeFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupScopeToJson(this);
}

@JsonSerializable()
class BackupOptions {
  @JsonKey(name: 'backup_type')
  final String backupType;
  
  final bool compression;
  final bool encryption;
  
  @JsonKey(name: 'storage_location')
  final String storageLocation;
  
  @JsonKey(name: 'retention_policy')
  final RetentionPolicy retentionPolicy;

  BackupOptions({
    required this.backupType,
    required this.compression,
    required this.encryption,
    required this.storageLocation,
    required this.retentionPolicy,
  });

  factory BackupOptions.fromJson(Map<String, dynamic> json) =>
      _$BackupOptionsFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupOptionsToJson(this);
}

@JsonSerializable()
class RetentionPolicy {
  @JsonKey(name: 'daily_keep')
  final int dailyKeep;
  
  @JsonKey(name: 'weekly_keep')
  final int weeklyKeep;
  
  @JsonKey(name: 'monthly_keep')
  final int monthlyKeep;
  
  @JsonKey(name: 'yearly_keep')
  final int yearlyKeep;

  RetentionPolicy({
    required this.dailyKeep,
    required this.weeklyKeep,
    required this.monthlyKeep,
    required this.yearlyKeep,
  });

  factory RetentionPolicy.fromJson(Map<String, dynamic> json) =>
      _$RetentionPolicyFromJson(json);
  
  Map<String, dynamic> toJson() => _$RetentionPolicyToJson(this);
}

@JsonSerializable()
class NotificationSettings {
  @JsonKey(name: 'notify_on_success')
  final bool notifyOnSuccess;
  
  @JsonKey(name: 'notify_on_failure')
  final bool notifyOnFailure;
  
  @JsonKey(name: 'notification_channels')
  final List<String> notificationChannels;
  
  @JsonKey(name: 'weekly_summary')
  final bool weeklySummary;

  NotificationSettings({
    required this.notifyOnSuccess,
    required this.notifyOnFailure,
    required this.notificationChannels,
    required this.weeklySummary,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic> json) =>
      _$NotificationSettingsFromJson(json);
  
  Map<String, dynamic> toJson() => _$NotificationSettingsToJson(this);
}

@JsonSerializable()
class BackupScheduleResponse {
  final bool success;
  
  @JsonKey(name: 'backup_schedule')
  final BackupScheduleInfo backupSchedule;
  
  @JsonKey(name: 'backup_estimation')
  final BackupEstimation backupEstimation;
  
  @JsonKey(name: 'storage_info')
  final StorageInfo storageInfo;

  BackupScheduleResponse({
    required this.success,
    required this.backupSchedule,
    required this.backupEstimation,
    required this.storageInfo,
  });

  factory BackupScheduleResponse.fromJson(Map<String, dynamic> json) =>
      _$BackupScheduleResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupScheduleResponseToJson(this);
}

@JsonSerializable()
class BackupScheduleInfo {
  @JsonKey(name: 'schedule_id')
  final String scheduleId;
  
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'next_backup')
  final String nextBackup;
  
  @JsonKey(name: 'backup_frequency')
  final String backupFrequency;
  
  final String status;

  BackupScheduleInfo({
    required this.scheduleId,
    required this.userId,
    required this.nextBackup,
    required this.backupFrequency,
    required this.status,
  });

  factory BackupScheduleInfo.fromJson(Map<String, dynamic> json) =>
      _$BackupScheduleInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupScheduleInfoToJson(this);
}

@JsonSerializable()
class BackupEstimation {
  @JsonKey(name: 'estimated_backup_size')
  final String estimatedBackupSize;
  
  @JsonKey(name: 'estimated_duration')
  final String estimatedDuration;
  
  @JsonKey(name: 'included_entries')
  final int includedEntries;
  
  @JsonKey(name: 'included_ledgers')
  final int includedLedgers;
  
  @JsonKey(name: 'compression_ratio')
  final double compressionRatio;

  BackupEstimation({
    required this.estimatedBackupSize,
    required this.estimatedDuration,
    required this.includedEntries,
    required this.includedLedgers,
    required this.compressionRatio,
  });

  factory BackupEstimation.fromJson(Map<String, dynamic> json) =>
      _$BackupEstimationFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupEstimationToJson(this);
}

@JsonSerializable()
class StorageInfo {
  @JsonKey(name: 'allocated_space')
  final String allocatedSpace;
  
  @JsonKey(name: 'used_space')
  final String usedSpace;
  
  @JsonKey(name: 'available_space')
  final String availableSpace;
  
  @JsonKey(name: 'backup_quota')
  final String backupQuota;

  StorageInfo({
    required this.allocatedSpace,
    required this.usedSpace,
    required this.availableSpace,
    required this.backupQuota,
  });

  factory StorageInfo.fromJson(Map<String, dynamic> json) =>
      _$StorageInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$StorageInfoToJson(this);
}

// ============= 手動備份相關模型 =============

@JsonSerializable()
class ManualBackupRequest {
  @JsonKey(name: 'backup_type')
  final String backupType;
  
  @JsonKey(name: 'backup_scope')
  final BackupScope backupScope;
  
  @JsonKey(name: 'backup_options')
  final Map<String, dynamic>? backupOptions;

  ManualBackupRequest({
    required this.backupType,
    required this.backupScope,
    this.backupOptions,
  });

  factory ManualBackupRequest.fromJson(Map<String, dynamic> json) =>
      _$ManualBackupRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$ManualBackupRequestToJson(this);
}

@JsonSerializable()
class ManualBackupResponse {
  final bool success;
  
  @JsonKey(name: 'backup_info')
  final BackupInfo backupInfo;
  
  @JsonKey(name: 'backup_status')
  final BackupStatus backupStatus;

  ManualBackupResponse({
    required this.success,
    required this.backupInfo,
    required this.backupStatus,
  });

  factory ManualBackupResponse.fromJson(Map<String, dynamic> json) =>
      _$ManualBackupResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$ManualBackupResponseToJson(this);
}

@JsonSerializable()
class BackupInfo {
  @JsonKey(name: 'backup_id')
  final String backupId;
  
  @JsonKey(name: 'backup_name')
  final String backupName;
  
  @JsonKey(name: 'created_at')
  final String createdAt;
  
  @JsonKey(name: 'file_size')
  final String fileSize;
  
  @JsonKey(name: 'backup_type')
  final String backupType;

  BackupInfo({
    required this.backupId,
    required this.backupName,
    required this.createdAt,
    required this.fileSize,
    required this.backupType,
  });

  factory BackupInfo.fromJson(Map<String, dynamic> json) =>
      _$BackupInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupInfoToJson(this);
}

@JsonSerializable()
class BackupStatus {
  final String status;
  final int progress;
  
  @JsonKey(name: 'estimated_completion')
  final String? estimatedCompletion;
  
  @JsonKey(name: 'error_message')
  final String? errorMessage;

  BackupStatus({
    required this.status,
    required this.progress,
    this.estimatedCompletion,
    this.errorMessage,
  });

  factory BackupStatus.fromJson(Map<String, dynamic> json) =>
      _$BackupStatusFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupStatusToJson(this);
}

// ============= 備份清單相關模型 =============

@JsonSerializable()
class BackupListRequest {
  @JsonKey(name: 'date_range')
  final DateRange? dateRange;
  
  @JsonKey(name: 'backup_type')
  final String? backupType;
  
  final int? limit;
  final int? offset;

  BackupListRequest({
    this.dateRange,
    this.backupType,
    this.limit,
    this.offset,
  });

  factory BackupListRequest.fromJson(Map<String, dynamic> json) =>
      _$BackupListRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupListRequestToJson(this);
  
  Map<String, String> toQueryParams() {
    final params = <String, String>{};
    
    if (dateRange != null) {
      params['start_date'] = dateRange!.startDate;
      params['end_date'] = dateRange!.endDate;
    }
    
    if (backupType != null) {
      params['backup_type'] = backupType!;
    }
    
    if (limit != null) {
      params['limit'] = limit.toString();
    }
    
    if (offset != null) {
      params['offset'] = offset.toString();
    }
    
    return params;
  }
}

@JsonSerializable()
class DateRange {
  @JsonKey(name: 'start_date')
  final String startDate;
  
  @JsonKey(name: 'end_date')
  final String endDate;

  DateRange({
    required this.startDate,
    required this.endDate,
  });

  factory DateRange.fromJson(Map<String, dynamic> json) =>
      _$DateRangeFromJson(json);
  
  Map<String, dynamic> toJson() => _$DateRangeToJson(this);
}

@JsonSerializable()
class BackupListResponse {
  final bool success;
  
  @JsonKey(name: 'backup_files')
  final List<BackupFile> backupFiles;
  
  @JsonKey(name: 'total_count')
  final int totalCount;
  
  @JsonKey(name: 'storage_summary')
  final StorageSummary storageSummary;

  BackupListResponse({
    required this.success,
    required this.backupFiles,
    required this.totalCount,
    required this.storageSummary,
  });

  factory BackupListResponse.fromJson(Map<String, dynamic> json) =>
      _$BackupListResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupListResponseToJson(this);
}

@JsonSerializable()
class BackupFile {
  @JsonKey(name: 'backup_id')
  final String backupId;
  
  @JsonKey(name: 'file_name')
  final String fileName;
  
  @JsonKey(name: 'file_size')
  final String fileSize;
  
  @JsonKey(name: 'created_at')
  final String createdAt;
  
  @JsonKey(name: 'backup_type')
  final String backupType;
  
  final String status;
  
  @JsonKey(name: 'download_url')
  final String? downloadUrl;

  BackupFile({
    required this.backupId,
    required this.fileName,
    required this.fileSize,
    required this.createdAt,
    required this.backupType,
    required this.status,
    this.downloadUrl,
  });

  factory BackupFile.fromJson(Map<String, dynamic> json) =>
      _$BackupFileFromJson(json);
  
  Map<String, dynamic> toJson() => _$BackupFileToJson(this);
}

@JsonSerializable()
class StorageSummary {
  @JsonKey(name: 'total_backups')
  final int totalBackups;
  
  @JsonKey(name: 'total_size')
  final String totalSize;
  
  @JsonKey(name: 'oldest_backup')
  final String? oldestBackup;
  
  @JsonKey(name: 'newest_backup')
  final String? newestBackup;

  StorageSummary({
    required this.totalBackups,
    required this.totalSize,
    this.oldestBackup,
    this.newestBackup,
  });

  factory StorageSummary.fromJson(Map<String, dynamic> json) =>
      _$StorageSummaryFromJson(json);
  
  Map<String, dynamic> toJson() => _$StorageSummaryToJson(this);
}

// ============= 同步狀態相關模型 =============

@JsonSerializable()
class SyncStatusRequest {
  @JsonKey(name: 'check_options')
  final CheckOptions? checkOptions;
  
  @JsonKey(name: 'comparison_criteria')
  final ComparisonCriteria? comparisonCriteria;

  SyncStatusRequest({
    this.checkOptions,
    this.comparisonCriteria,
  });

  factory SyncStatusRequest.fromJson(Map<String, dynamic> json) =>
      _$SyncStatusRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$SyncStatusRequestToJson(this);
  
  Map<String, String> toQueryParams() {
    final params = <String, String>{};
    
    if (checkOptions?.checkType != null) {
      params['check_type'] = checkOptions!.checkType!;
    }
    
    if (checkOptions?.platforms != null) {
      params['platforms'] = checkOptions!.platforms!.join(',');
    }
    
    if (comparisonCriteria?.toleranceSeconds != null) {
      params['tolerance_seconds'] = comparisonCriteria!.toleranceSeconds.toString();
    }
    
    return params;
  }
}

@JsonSerializable()
class CheckOptions {
  @JsonKey(name: 'check_type')
  final String? checkType;
  
  final List<String>? platforms;
  
  @JsonKey(name: 'verification_depth')
  final String? verificationDepth;

  CheckOptions({
    this.checkType,
    this.platforms,
    this.verificationDepth,
  });

  factory CheckOptions.fromJson(Map<String, dynamic> json) =>
      _$CheckOptionsFromJson(json);
  
  Map<String, dynamic> toJson() => _$CheckOptionsToJson(this);
}

@JsonSerializable()
class ComparisonCriteria {
  @JsonKey(name: 'tolerance_seconds')
  final int toleranceSeconds;
  
  @JsonKey(name: 'ignore_minor_fields')
  final bool ignoreMinorFields;

  ComparisonCriteria({
    required this.toleranceSeconds,
    required this.ignoreMinorFields,
  });

  factory ComparisonCriteria.fromJson(Map<String, dynamic> json) =>
      _$ComparisonCriteriaFromJson(json);
  
  Map<String, dynamic> toJson() => _$ComparisonCriteriaToJson(this);
}

@JsonSerializable()
class SyncStatusResponse {
  final bool success;
  
  @JsonKey(name: 'sync_status')
  final SyncStatus syncStatus;
  
  @JsonKey(name: 'consistency_report')
  final ConsistencyReport consistencyReport;
  
  @JsonKey(name: 'platform_status')
  final List<PlatformStatus> platformStatus;

  SyncStatusResponse({
    required this.success,
    required this.syncStatus,
    required this.consistencyReport,
    required this.platformStatus,
  });

  factory SyncStatusResponse.fromJson(Map<String, dynamic> json) =>
      _$SyncStatusResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$SyncStatusResponseToJson(this);
}

@JsonSerializable()
class SyncStatus {
  @JsonKey(name: 'overall_status')
  final String overallStatus;
  
  @JsonKey(name: 'last_check')
  final String lastCheck;
  
  @JsonKey(name: 'check_duration')
  final String checkDuration;
  
  @JsonKey(name: 'platforms_checked')
  final int platformsChecked;

  SyncStatus({
    required this.overallStatus,
    required this.lastCheck,
    required this.checkDuration,
    required this.platformsChecked,
  });

  factory SyncStatus.fromJson(Map<String, dynamic> json) =>
      _$SyncStatusFromJson(json);
  
  Map<String, dynamic> toJson() => _$SyncStatusToJson(this);
}

@JsonSerializable()
class ConsistencyReport {
  @JsonKey(name: 'total_records_checked')
  final int totalRecordsChecked;
  
  @JsonKey(name: 'consistent_records')
  final int consistentRecords;
  
  @JsonKey(name: 'inconsistent_records')
  final int inconsistentRecords;
  
  @JsonKey(name: 'consistency_rate')
  final double consistencyRate;

  ConsistencyReport({
    required this.totalRecordsChecked,
    required this.consistentRecords,
    required this.inconsistentRecords,
    required this.consistencyRate,
  });

  factory ConsistencyReport.fromJson(Map<String, dynamic> json) =>
      _$ConsistencyReportFromJson(json);
  
  Map<String, dynamic> toJson() => _$ConsistencyReportToJson(this);
}

@JsonSerializable()
class PlatformStatus {
  final String platform;
  final String status;
  
  @JsonKey(name: 'last_sync')
  final String lastSync;
  
  @JsonKey(name: 'sync_delay')
  final String syncDelay;
  
  @JsonKey(name: 'data_completeness')
  final double dataCompleteness;

  PlatformStatus({
    required this.platform,
    required this.status,
    required this.lastSync,
    required this.syncDelay,
    required this.dataCompleteness,
  });

  factory PlatformStatus.fromJson(Map<String, dynamic> json) =>
      _$PlatformStatusFromJson(json);
  
  Map<String, dynamic> toJson() => _$PlatformStatusToJson(this);
}

// ============= 健康檢查相關模型 =============

@JsonSerializable()
class HealthCheckRequest {
  @JsonKey(name: 'monitoring_scope')
  final MonitoringScope? monitoringScope;
  
  @JsonKey(name: 'alert_thresholds')
  final AlertThresholds? alertThresholds;
  
  @JsonKey(name: 'diagnostic_level')
  final String? diagnosticLevel;

  HealthCheckRequest({
    this.monitoringScope,
    this.alertThresholds,
    this.diagnosticLevel,
  });

  factory HealthCheckRequest.fromJson(Map<String, dynamic> json) =>
      _$HealthCheckRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$HealthCheckRequestToJson(this);
  
  Map<String, String> toQueryParams() {
    final params = <String, String>{};
    
    if (diagnosticLevel != null) {
      params['diagnostic_level'] = diagnosticLevel!;
    }
    
    if (alertThresholds?.cpuUsage != null) {
      params['cpu_threshold'] = alertThresholds!.cpuUsage.toString();
    }
    
    return params;
  }
}

@JsonSerializable()
class MonitoringScope {
  @JsonKey(name: 'include_performance')
  final bool includePerformance;
  
  @JsonKey(name: 'include_resources')
  final bool includeResources;
  
  @JsonKey(name: 'include_services')
  final bool includeServices;
  
  @JsonKey(name: 'time_window')
  final String timeWindow;

  MonitoringScope({
    required this.includePerformance,
    required this.includeResources,
    required this.includeServices,
    required this.timeWindow,
  });

  factory MonitoringScope.fromJson(Map<String, dynamic> json) =>
      _$MonitoringScopeFromJson(json);
  
  Map<String, dynamic> toJson() => _$MonitoringScopeToJson(this);
}

@JsonSerializable()
class AlertThresholds {
  @JsonKey(name: 'cpu_usage')
  final int cpuUsage;
  
  @JsonKey(name: 'memory_usage')
  final int memoryUsage;
  
  @JsonKey(name: 'response_time')
  final int responseTime;
  
  @JsonKey(name: 'error_rate')
  final int errorRate;

  AlertThresholds({
    required this.cpuUsage,
    required this.memoryUsage,
    required this.responseTime,
    required this.errorRate,
  });

  factory AlertThresholds.fromJson(Map<String, dynamic> json) =>
      _$AlertThresholdsFromJson(json);
  
  Map<String, dynamic> toJson() => _$AlertThresholdsToJson(this);
}

@JsonSerializable()
class HealthCheckResponse {
  final bool success;
  
  @JsonKey(name: 'system_health')
  final SystemHealth systemHealth;
  
  @JsonKey(name: 'performance_metrics')
  final PerformanceMetrics performanceMetrics;
  
  @JsonKey(name: 'service_status')
  final List<ServiceStatus> serviceStatus;
  
  final List<SystemAlert> alerts;

  HealthCheckResponse({
    required this.success,
    required this.systemHealth,
    required this.performanceMetrics,
    required this.serviceStatus,
    required this.alerts,
  });

  factory HealthCheckResponse.fromJson(Map<String, dynamic> json) =>
      _$HealthCheckResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$HealthCheckResponseToJson(this);
}

@JsonSerializable()
class SystemHealth {
  @JsonKey(name: 'overall_status')
  final String overallStatus;
  
  @JsonKey(name: 'health_score')
  final double healthScore;
  
  @JsonKey(name: 'last_check')
  final String lastCheck;
  
  final String uptime;

  SystemHealth({
    required this.overallStatus,
    required this.healthScore,
    required this.lastCheck,
    required this.uptime,
  });

  factory SystemHealth.fromJson(Map<String, dynamic> json) =>
      _$SystemHealthFromJson(json);
  
  Map<String, dynamic> toJson() => _$SystemHealthToJson(this);
}

@JsonSerializable()
class PerformanceMetrics {
  @JsonKey(name: 'cpu_usage')
  final double cpuUsage;
  
  @JsonKey(name: 'memory_usage')
  final double memoryUsage;
  
  @JsonKey(name: 'disk_usage')
  final double diskUsage;
  
  @JsonKey(name: 'average_response_time')
  final int averageResponseTime;
  
  @JsonKey(name: 'requests_per_minute')
  final int requestsPerMinute;

  PerformanceMetrics({
    required this.cpuUsage,
    required this.memoryUsage,
    required this.diskUsage,
    required this.averageResponseTime,
    required this.requestsPerMinute,
  });

  factory PerformanceMetrics.fromJson(Map<String, dynamic> json) =>
      _$PerformanceMetricsFromJson(json);
  
  Map<String, dynamic> toJson() => _$PerformanceMetricsToJson(this);
}

@JsonSerializable()
class ServiceStatus {
  @JsonKey(name: 'service_name')
  final String serviceName;
  
  final String status;
  final String health;
  
  @JsonKey(name: 'response_time')
  final int responseTime;
  
  @JsonKey(name: 'last_restart')
  final String lastRestart;

  ServiceStatus({
    required this.serviceName,
    required this.status,
    required this.health,
    required this.responseTime,
    required this.lastRestart,
  });

  factory ServiceStatus.fromJson(Map<String, dynamic> json) =>
      _$ServiceStatusFromJson(json);
  
  Map<String, dynamic> toJson() => _$ServiceStatusToJson(this);
}

@JsonSerializable()
class SystemAlert {
  @JsonKey(name: 'alert_id')
  final String alertId;
  
  final String severity;
  final String type;
  final String message;
  
  @JsonKey(name: 'triggered_at')
  final String triggeredAt;
  
  @JsonKey(name: 'auto_resolved')
  final bool autoResolved;

  SystemAlert({
    required this.alertId,
    required this.severity,
    required this.type,
    required this.message,
    required this.triggeredAt,
    required this.autoResolved,
  });

  factory SystemAlert.fromJson(Map<String, dynamic> json) =>
      _$SystemAlertFromJson(json);
  
  Map<String, dynamic> toJson() => _$SystemAlertToJson(this);
}

// ============= 錯誤日誌相關模型 =============

@JsonSerializable()
class ErrorLogsRequest {
  @JsonKey(name: 'query_filters')
  final QueryFilters queryFilters;
  
  final Pagination pagination;
  
  @JsonKey(name: 'sort_options')
  final SortOptions sortOptions;

  ErrorLogsRequest({
    required this.queryFilters,
    required this.pagination,
    required this.sortOptions,
  });

  factory ErrorLogsRequest.fromJson(Map<String, dynamic> json) =>
      _$ErrorLogsRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$ErrorLogsRequestToJson(this);
  
  Map<String, String> toQueryParams() {
    final params = <String, String>{};
    
    // 時間範圍
    if (queryFilters.timeRange != null) {
      params['start_time'] = queryFilters.timeRange!.startTime;
      params['end_time'] = queryFilters.timeRange!.endTime;
    }
    
    // 嚴重度
    if (queryFilters.severityLevels != null) {
      params['severity_levels'] = queryFilters.severityLevels!.join(',');
    }
    
    // 模組
    if (queryFilters.modules != null) {
      params['modules'] = queryFilters.modules!.join(',');
    }
    
    // 分頁
    params['page'] = pagination.page.toString();
    params['limit'] = pagination.limit.toString();
    
    // 排序
    params['sort_by'] = sortOptions.sortBy;
    params['order'] = sortOptions.order;
    
    return params;
  }
}

@JsonSerializable()
class QueryFilters {
  @JsonKey(name: 'time_range')
  final TimeRange? timeRange;
  
  @JsonKey(name: 'severity_levels')
  final List<String>? severityLevels;
  
  final List<String>? modules;
  
  @JsonKey(name: 'search_text')
  final String? searchText;

  QueryFilters({
    this.timeRange,
    this.severityLevels,
    this.modules,
    this.searchText,
  });

  factory QueryFilters.fromJson(Map<String, dynamic> json) =>
      _$QueryFiltersFromJson(json);
  
  Map<String, dynamic> toJson() => _$QueryFiltersToJson(this);
}

@JsonSerializable()
class TimeRange {
  @JsonKey(name: 'start_time')
  final String startTime;
  
  @JsonKey(name: 'end_time')
  final String endTime;

  TimeRange({
    required this.startTime,
    required this.endTime,
  });

  factory TimeRange.fromJson(Map<String, dynamic> json) =>
      _$TimeRangeFromJson(json);
  
  Map<String, dynamic> toJson() => _$TimeRangeToJson(this);
}

@JsonSerializable()
class Pagination {
  final int page;
  final int limit;

  Pagination({
    required this.page,
    required this.limit,
  });

  factory Pagination.fromJson(Map<String, dynamic> json) =>
      _$PaginationFromJson(json);
  
  Map<String, dynamic> toJson() => _$PaginationToJson(this);
}

@JsonSerializable()
class SortOptions {
  @JsonKey(name: 'sort_by')
  final String sortBy;
  
  final String order;

  SortOptions({
    required this.sortBy,
    required this.order,
  });

  factory SortOptions.fromJson(Map<String, dynamic> json) =>
      _$SortOptionsFromJson(json);
  
  Map<String, dynamic> toJson() => _$SortOptionsToJson(this);
}

@JsonSerializable()
class ErrorLogsResponse {
  final bool success;
  
  @JsonKey(name: 'log_summary')
  final LogSummary logSummary;
  
  @JsonKey(name: 'error_logs')
  final List<ErrorLog> errorLogs;
  
  @JsonKey(name: 'error_statistics')
  final ErrorStatistics errorStatistics;

  ErrorLogsResponse({
    required this.success,
    required this.logSummary,
    required this.errorLogs,
    required this.errorStatistics,
  });

  factory ErrorLogsResponse.fromJson(Map<String, dynamic> json) =>
      _$ErrorLogsResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$ErrorLogsResponseToJson(this);
}

@JsonSerializable()
class LogSummary {
  @JsonKey(name: 'total_errors')
  final int totalErrors;
  
  @JsonKey(name: 'unique_error_types')
  final int uniqueErrorTypes;
  
  @JsonKey(name: 'critical_errors')
  final int criticalErrors;
  
  @JsonKey(name: 'error_rate')
  final double errorRate;

  LogSummary({
    required this.totalErrors,
    required this.uniqueErrorTypes,
    required this.criticalErrors,
    required this.errorRate,
  });

  factory LogSummary.fromJson(Map<String, dynamic> json) =>
      _$LogSummaryFromJson(json);
  
  Map<String, dynamic> toJson() => _$LogSummaryToJson(this);
}

@JsonSerializable()
class ErrorLog {
  @JsonKey(name: 'log_id')
  final String logId;
  
  final String timestamp;
  final String severity;
  final String module;
  
  @JsonKey(name: 'error_code')
  final String errorCode;
  
  @JsonKey(name: 'error_message')
  final String errorMessage;
  
  @JsonKey(name: 'user_id')
  final String? userId;
  
  @JsonKey(name: 'stack_trace')
  final String? stackTrace;

  ErrorLog({
    required this.logId,
    required this.timestamp,
    required this.severity,
    required this.module,
    required this.errorCode,
    required this.errorMessage,
    this.userId,
    this.stackTrace,
  });

  factory ErrorLog.fromJson(Map<String, dynamic> json) =>
      _$ErrorLogFromJson(json);
  
  Map<String, dynamic> toJson() => _$ErrorLogToJson(this);
}

@JsonSerializable()
class ErrorStatistics {
  @JsonKey(name: 'by_module')
  final List<ModuleErrorStat> byModule;
  
  @JsonKey(name: 'by_error_code')
  final List<ErrorCodeStat> byErrorCode;

  ErrorStatistics({
    required this.byModule,
    required this.byErrorCode,
  });

  factory ErrorStatistics.fromJson(Map<String, dynamic> json) =>
      _$ErrorStatisticsFromJson(json);
  
  Map<String, dynamic> toJson() => _$ErrorStatisticsToJson(this);
}

@JsonSerializable()
class ModuleErrorStat {
  final String module;
  
  @JsonKey(name: 'error_count')
  final int errorCount;
  
  final double percentage;

  ModuleErrorStat({
    required this.module,
    required this.errorCount,
    required this.percentage,
  });

  factory ModuleErrorStat.fromJson(Map<String, dynamic> json) =>
      _$ModuleErrorStatFromJson(json);
  
  Map<String, dynamic> toJson() => _$ModuleErrorStatToJson(this);
}

@JsonSerializable()
class ErrorCodeStat {
  @JsonKey(name: 'error_code')
  final String errorCode;
  
  final int count;
  final String trend;

  ErrorCodeStat({
    required this.errorCode,
    required this.count,
    required this.trend,
  });

  factory ErrorCodeStat.fromJson(Map<String, dynamic> json) =>
      _$ErrorCodeStatFromJson(json);
  
  Map<String, dynamic> toJson() => _$ErrorCodeStatToJson(this);
}

// ============= 系統指標相關模型 =============

@JsonSerializable()
class SystemMetricsRequest {
  @JsonKey(name: 'time_range')
  final String? timeRange;
  
  @JsonKey(name: 'metric_types')
  final List<String>? metricTypes;
  
  final String? granularity;

  SystemMetricsRequest({
    this.timeRange,
    this.metricTypes,
    this.granularity,
  });

  factory SystemMetricsRequest.fromJson(Map<String, dynamic> json) =>
      _$SystemMetricsRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$SystemMetricsRequestToJson(this);
  
  Map<String, String> toQueryParams() {
    final params = <String, String>{};
    
    if (timeRange != null) {
      params['time_range'] = timeRange!;
    }
    
    if (metricTypes != null) {
      params['metric_types'] = metricTypes!.join(',');
    }
    
    if (granularity != null) {
      params['granularity'] = granularity!;
    }
    
    return params;
  }
}

@JsonSerializable()
class SystemMetricsResponse {
  final bool success;
  
  @JsonKey(name: 'metrics_summary')
  final MetricsSummary metricsSummary;
  
  @JsonKey(name: 'performance_data')
  final List<PerformanceData> performanceData;
  
  @JsonKey(name: 'trend_analysis')
  final TrendAnalysis trendAnalysis;

  SystemMetricsResponse({
    required this.success,
    required this.metricsSummary,
    required this.performanceData,
    required this.trendAnalysis,
  });

  factory SystemMetricsResponse.fromJson(Map<String, dynamic> json) =>
      _$SystemMetricsResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$SystemMetricsResponseToJson(this);
}

@JsonSerializable()
class MetricsSummary {
  @JsonKey(name: 'collection_period')
  final String collectionPeriod;
  
  @JsonKey(name: 'data_points')
  final int dataPoints;
  
  @JsonKey(name: 'average_cpu')
  final double averageCpu;
  
  @JsonKey(name: 'average_memory')
  final double averageMemory;
  
  @JsonKey(name: 'peak_response_time')
  final int peakResponseTime;

  MetricsSummary({
    required this.collectionPeriod,
    required this.dataPoints,
    required this.averageCpu,
    required this.averageMemory,
    required this.peakResponseTime,
  });

  factory MetricsSummary.fromJson(Map<String, dynamic> json) =>
      _$MetricsSummaryFromJson(json);
  
  Map<String, dynamic> toJson() => _$MetricsSummaryToJson(this);
}

@JsonSerializable()
class PerformanceData {
  final String timestamp;
  
  @JsonKey(name: 'cpu_usage')
  final double cpuUsage;
  
  @JsonKey(name: 'memory_usage')
  final double memoryUsage;
  
  @JsonKey(name: 'response_time')
  final int responseTime;
  
  @JsonKey(name: 'request_count')
  final int requestCount;

  PerformanceData({
    required this.timestamp,
    required this.cpuUsage,
    required this.memoryUsage,
    required this.responseTime,
    required this.requestCount,
  });

  factory PerformanceData.fromJson(Map<String, dynamic> json) =>
      _$PerformanceDataFromJson(json);
  
  Map<String, dynamic> toJson() => _$PerformanceDataToJson(this);
}

@JsonSerializable()
class TrendAnalysis {
  @JsonKey(name: 'cpu_trend')
  final String cpuTrend;
  
  @JsonKey(name: 'memory_trend')
  final String memoryTrend;
  
  @JsonKey(name: 'response_time_trend')
  final String responseTimeTrend;
  
  @JsonKey(name: 'performance_score')
  final double performanceScore;

  TrendAnalysis({
    required this.cpuTrend,
    required this.memoryTrend,
    required this.responseTimeTrend,
    required this.performanceScore,
  });

  factory TrendAnalysis.fromJson(Map<String, dynamic> json) =>
      _$TrendAnalysisFromJson(json);
  
  Map<String, dynamic> toJson() => _$TrendAnalysisToJson(this);
}

// ============= 系統清理相關模型 =============

@JsonSerializable()
class CleanupRequest {
  @JsonKey(name: 'cleanup_type')
  final String cleanupType;
  
  @JsonKey(name: 'target_data')
  final List<String> targetData;
  
  @JsonKey(name: 'retention_days')
  final int retentionDays;
  
  @JsonKey(name: 'force_cleanup')
  final bool forceCleanup;

  CleanupRequest({
    required this.cleanupType,
    required this.targetData,
    required this.retentionDays,
    required this.forceCleanup,
  });

  factory CleanupRequest.fromJson(Map<String, dynamic> json) =>
      _$CleanupRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$CleanupRequestToJson(this);
}

@JsonSerializable()
class CleanupResponse {
  final bool success;
  
  @JsonKey(name: 'cleanup_summary')
  final CleanupSummary cleanupSummary;
  
  @JsonKey(name: 'cleaned_items')
  final List<CleanupItem> cleanedItems;

  CleanupResponse({
    required this.success,
    required this.cleanupSummary,
    required this.cleanedItems,
  });

  factory CleanupResponse.fromJson(Map<String, dynamic> json) =>
      _$CleanupResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$CleanupResponseToJson(this);
}

@JsonSerializable()
class CleanupSummary {
  @JsonKey(name: 'total_items')
  final int totalItems;
  
  @JsonKey(name: 'cleaned_items')
  final int cleanedItems;
  
  @JsonKey(name: 'space_freed')
  final String spaceFreed;
  
  @JsonKey(name: 'cleanup_duration')
  final String cleanupDuration;

  CleanupSummary({
    required this.totalItems,
    required this.cleanedItems,
    required this.spaceFreed,
    required this.cleanupDuration,
  });

  factory CleanupSummary.fromJson(Map<String, dynamic> json) =>
      _$CleanupSummaryFromJson(json);
  
  Map<String, dynamic> toJson() => _$CleanupSummaryToJson(this);
}

@JsonSerializable()
class CleanupItem {
  @JsonKey(name: 'item_type')
  final String itemType;
  
  @JsonKey(name: 'item_id')
  final String itemId;
  
  @JsonKey(name: 'item_size')
  final String itemSize;
  
  @JsonKey(name: 'cleaned_at')
  final String cleanedAt;

  CleanupItem({
    required this.itemType,
    required this.itemId,
    required this.itemSize,
    required this.cleanedAt,
  });

  factory CleanupItem.fromJson(Map<String, dynamic> json) =>
      _$CleanupItemFromJson(json);
  
  Map<String, dynamic> toJson() => _$CleanupItemToJson(this);
}
