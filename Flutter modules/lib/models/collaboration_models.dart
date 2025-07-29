
/**
 * CollaborationModels_協作服務資料模型_1.0.0
 * @module CollaborationModels
 * @description 協作功能相關的資料模型定義
 * @update 2025-01-23: 初版建立，定義協作管理相關資料結構
 */

import 'package:json_annotation/json_annotation.dart';

part 'collaboration_models.g.dart';

// ============= 共享帳本相關模型 =============

@JsonSerializable()
class SharedLedgerRequest {
  @JsonKey(name: 'ledger_config')
  final LedgerConfig ledgerConfig;
  
  @JsonKey(name: 'sharing_settings')
  final SharingSettings sharingSettings;
  
  @JsonKey(name: 'initial_members')
  final List<MemberInvitation> initialMembers;
  
  @JsonKey(name: 'collaboration_rules')
  final CollaborationRules collaborationRules;

  SharedLedgerRequest({
    required this.ledgerConfig,
    required this.sharingSettings,
    required this.initialMembers,
    required this.collaborationRules,
  });

  factory SharedLedgerRequest.fromJson(Map<String, dynamic> json) =>
      _$SharedLedgerRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$SharedLedgerRequestToJson(this);
}

@JsonSerializable()
class LedgerConfig {
  @JsonKey(name: 'ledger_name')
  final String ledgerName;
  
  final String description;
  final String category;
  final String currency;
  
  @JsonKey(name: 'default_permissions')
  final Map<String, bool> defaultPermissions;

  LedgerConfig({
    required this.ledgerName,
    required this.description,
    required this.category,
    required this.currency,
    required this.defaultPermissions,
  });

  factory LedgerConfig.fromJson(Map<String, dynamic> json) =>
      _$LedgerConfigFromJson(json);
  
  Map<String, dynamic> toJson() => _$LedgerConfigToJson(this);
}

@JsonSerializable()
class SharingSettings {
  @JsonKey(name: 'visibility_level')
  final String visibilityLevel;
  
  @JsonKey(name: 'invite_policy')
  final String invitePolicy;
  
  @JsonKey(name: 'approval_required')
  final bool approvalRequired;
  
  @JsonKey(name: 'max_members')
  final int? maxMembers;

  SharingSettings({
    required this.visibilityLevel,
    required this.invitePolicy,
    required this.approvalRequired,
    this.maxMembers,
  });

  factory SharingSettings.fromJson(Map<String, dynamic> json) =>
      _$SharingSettingsFromJson(json);
  
  Map<String, dynamic> toJson() => _$SharingSettingsToJson(this);
}

@JsonSerializable()
class MemberInvitation {
  @JsonKey(name: 'email_or_id')
  final String emailOrId;
  
  final String role;
  final Map<String, bool> permissions;
  final String? message;

  MemberInvitation({
    required this.emailOrId,
    required this.role,
    required this.permissions,
    this.message,
  });

  factory MemberInvitation.fromJson(Map<String, dynamic> json) =>
      _$MemberInvitationFromJson(json);
  
  Map<String, dynamic> toJson() => _$MemberInvitationToJson(this);
}

@JsonSerializable()
class CollaborationRules {
  @JsonKey(name: 'entry_approval')
  final bool entryApproval;
  
  @JsonKey(name: 'budget_restrictions')
  final bool budgetRestrictions;
  
  @JsonKey(name: 'notification_settings')
  final NotificationSettings notificationSettings;
  
  @JsonKey(name: 'conflict_resolution')
  final String conflictResolution;

  CollaborationRules({
    required this.entryApproval,
    required this.budgetRestrictions,
    required this.notificationSettings,
    required this.conflictResolution,
  });

  factory CollaborationRules.fromJson(Map<String, dynamic> json) =>
      _$CollaborationRulesFromJson(json);
  
  Map<String, dynamic> toJson() => _$CollaborationRulesToJson(this);
}

@JsonSerializable()
class NotificationSettings {
  @JsonKey(name: 'new_entries')
  final bool newEntries;
  
  @JsonKey(name: 'member_changes')
  final bool memberChanges;
  
  @JsonKey(name: 'budget_alerts')
  final bool budgetAlerts;
  
  @JsonKey(name: 'weekly_summary')
  final bool weeklySummary;

  NotificationSettings({
    required this.newEntries,
    required this.memberChanges,
    required this.budgetAlerts,
    required this.weeklySummary,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic> json) =>
      _$NotificationSettingsFromJson(json);
  
  Map<String, dynamic> toJson() => _$NotificationSettingsToJson(this);
}

@JsonSerializable()
class SharedLedgerResponse {
  final bool success;
  
  @JsonKey(name: 'shared_ledger')
  final SharedLedgerInfo sharedLedger;
  
  @JsonKey(name: 'member_list')
  final List<MemberInfo> memberList;
  
  @JsonKey(name: 'invitation_links')
  final Map<String, String> invitationLinks;

  SharedLedgerResponse({
    required this.success,
    required this.sharedLedger,
    required this.memberList,
    required this.invitationLinks,
  });

  factory SharedLedgerResponse.fromJson(Map<String, dynamic> json) =>
      _$SharedLedgerResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$SharedLedgerResponseToJson(this);
}

@JsonSerializable()
class SharedLedgerInfo {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'ledger_name')
  final String ledgerName;
  
  @JsonKey(name: 'owner_id')
  final String ownerId;
  
  @JsonKey(name: 'created_at')
  final String createdAt;
  
  @JsonKey(name: 'member_count')
  final int memberCount;
  
  final String status;

  SharedLedgerInfo({
    required this.ledgerId,
    required this.ledgerName,
    required this.ownerId,
    required this.createdAt,
    required this.memberCount,
    required this.status,
  });

  factory SharedLedgerInfo.fromJson(Map<String, dynamic> json) =>
      _$SharedLedgerInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$SharedLedgerInfoToJson(this);
}

@JsonSerializable()
class MemberInfo {
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'display_name')
  final String displayName;
  
  final String role;
  final String status;
  
  @JsonKey(name: 'joined_at')
  final String joinedAt;
  
  @JsonKey(name: 'last_activity')
  final String lastActivity;
  
  final Map<String, bool> permissions;

  MemberInfo({
    required this.userId,
    required this.displayName,
    required this.role,
    required this.status,
    required this.joinedAt,
    required this.lastActivity,
    required this.permissions,
  });

  factory MemberInfo.fromJson(Map<String, dynamic> json) =>
      _$MemberInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$MemberInfoToJson(this);
}

// ============= 權限管理相關模型 =============

@JsonSerializable()
class PermissionRequest {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'operation_type')
  final String operationType;
  
  @JsonKey(name: 'permission_changes')
  final List<PermissionChange> permissionChanges;

  PermissionRequest({
    required this.ledgerId,
    required this.operationType,
    required this.permissionChanges,
  });

  factory PermissionRequest.fromJson(Map<String, dynamic> json) =>
      _$PermissionRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$PermissionRequestToJson(this);
}

@JsonSerializable()
class PermissionChange {
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'new_role')
  final String? newRole;
  
  @JsonKey(name: 'permission_updates')
  final Map<String, bool>? permissionUpdates;
  
  final String action;

  PermissionChange({
    required this.userId,
    this.newRole,
    this.permissionUpdates,
    required this.action,
  });

  factory PermissionChange.fromJson(Map<String, dynamic> json) =>
      _$PermissionChangeFromJson(json);
  
  Map<String, dynamic> toJson() => _$PermissionChangeToJson(this);
}

@JsonSerializable()
class PermissionResponse {
  final bool success;
  
  @JsonKey(name: 'updated_members')
  final List<MemberInfo> updatedMembers;
  
  @JsonKey(name: 'operation_log')
  final List<OperationLog> operationLog;

  PermissionResponse({
    required this.success,
    required this.updatedMembers,
    required this.operationLog,
  });

  factory PermissionResponse.fromJson(Map<String, dynamic> json) =>
      _$PermissionResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$PermissionResponseToJson(this);
}

@JsonSerializable()
class OperationLog {
  @JsonKey(name: 'operation_id')
  final String operationId;
  
  final String action;
  
  @JsonKey(name: 'target_user')
  final String targetUser;
  
  @JsonKey(name: 'performed_by')
  final String performedBy;
  
  final String timestamp;
  final String status;

  OperationLog({
    required this.operationId,
    required this.action,
    required this.targetUser,
    required this.performedBy,
    required this.timestamp,
    required this.status,
  });

  factory OperationLog.fromJson(Map<String, dynamic> json) =>
      _$OperationLogFromJson(json);
  
  Map<String, dynamic> toJson() => _$OperationLogToJson(this);
}

// ============= 即時同步相關模型 =============

@JsonSerializable()
class RealtimeSyncRequest {
  @JsonKey(name: 'connection_config')
  final ConnectionConfig connectionConfig;
  
  @JsonKey(name: 'sync_options')
  final SyncOptions syncOptions;
  
  @JsonKey(name: 'operation_data')
  final OperationData? operationData;

  RealtimeSyncRequest({
    required this.connectionConfig,
    required this.syncOptions,
    this.operationData,
  });

  factory RealtimeSyncRequest.fromJson(Map<String, dynamic> json) =>
      _$RealtimeSyncRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$RealtimeSyncRequestToJson(this);
}

@JsonSerializable()
class ConnectionConfig {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'client_version')
  final String clientVersion;

  ConnectionConfig({
    required this.ledgerId,
    required this.userId,
    required this.clientVersion,
  });

  factory ConnectionConfig.fromJson(Map<String, dynamic> json) =>
      _$ConnectionConfigFromJson(json);
  
  Map<String, dynamic> toJson() => _$ConnectionConfigToJson(this);
}

@JsonSerializable()
class SyncOptions {
  @JsonKey(name: 'enable_real_time')
  final bool enableRealTime;
  
  @JsonKey(name: 'conflict_resolution')
  final String conflictResolution;
  
  @JsonKey(name: 'offline_mode')
  final bool offlineMode;
  
  final bool compression;

  SyncOptions({
    required this.enableRealTime,
    required this.conflictResolution,
    required this.offlineMode,
    required this.compression,
  });

  factory SyncOptions.fromJson(Map<String, dynamic> json) =>
      _$SyncOptionsFromJson(json);
  
  Map<String, dynamic> toJson() => _$SyncOptionsToJson(this);
}

@JsonSerializable()
class OperationData {
  @JsonKey(name: 'operation_type')
  final String operationType;
  
  @JsonKey(name: 'target_document')
  final String targetDocument;
  
  final Map<String, dynamic> changes;
  
  @JsonKey(name: 'operation_id')
  final String operationId;

  OperationData({
    required this.operationType,
    required this.targetDocument,
    required this.changes,
    required this.operationId,
  });

  factory OperationData.fromJson(Map<String, dynamic> json) =>
      _$OperationDataFromJson(json);
  
  Map<String, dynamic> toJson() => _$OperationDataToJson(this);
}

@JsonSerializable()
class RealtimeSyncResponse {
  final bool success;
  
  @JsonKey(name: 'connection_status')
  final String connectionStatus;
  
  @JsonKey(name: 'sync_info')
  final SyncInfo syncInfo;
  
  @JsonKey(name: 'real_time_updates')
  final List<RealTimeUpdate> realTimeUpdates;

  RealtimeSyncResponse({
    required this.success,
    required this.connectionStatus,
    required this.syncInfo,
    required this.realTimeUpdates,
  });

  factory RealtimeSyncResponse.fromJson(Map<String, dynamic> json) =>
      _$RealtimeSyncResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$RealtimeSyncResponseToJson(this);
}

@JsonSerializable()
class SyncInfo {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'active_users')
  final List<ActiveUser> activeUsers;
  
  @JsonKey(name: 'last_sync')
  final String lastSync;

  SyncInfo({
    required this.ledgerId,
    required this.activeUsers,
    required this.lastSync,
  });

  factory SyncInfo.fromJson(Map<String, dynamic> json) =>
      _$SyncInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$SyncInfoToJson(this);
}

@JsonSerializable()
class ActiveUser {
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'display_name')
  final String displayName;
  
  @JsonKey(name: 'last_activity')
  final String lastActivity;
  
  @JsonKey(name: 'current_action')
  final String currentAction;

  ActiveUser({
    required this.userId,
    required this.displayName,
    required this.lastActivity,
    required this.currentAction,
  });

  factory ActiveUser.fromJson(Map<String, dynamic> json) =>
      _$ActiveUserFromJson(json);
  
  Map<String, dynamic> toJson() => _$ActiveUserToJson(this);
}

@JsonSerializable()
class RealTimeUpdate {
  @JsonKey(name: 'update_type')
  final String updateType;
  
  final Map<String, dynamic> data;
  
  @JsonKey(name: 'user_info')
  final UserInfo userInfo;
  
  final String timestamp;

  RealTimeUpdate({
    required this.updateType,
    required this.data,
    required this.userInfo,
    required this.timestamp,
  });

  factory RealTimeUpdate.fromJson(Map<String, dynamic> json) =>
      _$RealTimeUpdateFromJson(json);
  
  Map<String, dynamic> toJson() => _$RealTimeUpdateToJson(this);
}

@JsonSerializable()
class UserInfo {
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'display_name')
  final String displayName;

  UserInfo({
    required this.userId,
    required this.displayName,
  });

  factory UserInfo.fromJson(Map<String, dynamic> json) =>
      _$UserInfoFromJson(json);
  
  Map<String, dynamic> toJson() => _$UserInfoToJson(this);
}

// ============= 其他協作相關模型 =============

@JsonSerializable()
class CollaborationListRequest {
  final String? status;
  final String? role;
  final int? limit;
  final int? offset;

  CollaborationListRequest({
    this.status,
    this.role,
    this.limit,
    this.offset,
  });

  factory CollaborationListRequest.fromJson(Map<String, dynamic> json) =>
      _$CollaborationListRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$CollaborationListRequestToJson(this);
  
  Map<String, String> toQueryParams() {
    final params = <String, String>{};
    
    if (status != null) params['status'] = status!;
    if (role != null) params['role'] = role!;
    if (limit != null) params['limit'] = limit.toString();
    if (offset != null) params['offset'] = offset.toString();
    
    return params;
  }
}

@JsonSerializable()
class CollaborationListResponse {
  final bool success;
  
  @JsonKey(name: 'collaboration_list')
  final List<CollaborationItem> collaborationList;
  
  @JsonKey(name: 'total_count')
  final int totalCount;
  
  @JsonKey(name: 'user_statistics')
  final UserStatistics userStatistics;

  CollaborationListResponse({
    required this.success,
    required this.collaborationList,
    required this.totalCount,
    required this.userStatistics,
  });

  factory CollaborationListResponse.fromJson(Map<String, dynamic> json) =>
      _$CollaborationListResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$CollaborationListResponseToJson(this);
}

@JsonSerializable()
class CollaborationItem {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'ledger_name')
  final String ledgerName;
  
  @JsonKey(name: 'owner_name')
  final String ownerName;
  
  @JsonKey(name: 'my_role')
  final String myRole;
  
  @JsonKey(name: 'member_count')
  final int memberCount;
  
  @JsonKey(name: 'last_activity')
  final String lastActivity;
  
  final String status;

  CollaborationItem({
    required this.ledgerId,
    required this.ledgerName,
    required this.ownerName,
    required this.myRole,
    required this.memberCount,
    required this.lastActivity,
    required this.status,
  });

  factory CollaborationItem.fromJson(Map<String, dynamic> json) =>
      _$CollaborationItemFromJson(json);
  
  Map<String, dynamic> toJson() => _$CollaborationItemToJson(this);
}

@JsonSerializable()
class UserStatistics {
  @JsonKey(name: 'owned_ledgers')
  final int ownedLedgers;
  
  @JsonKey(name: 'member_ledgers')
  final int memberLedgers;
  
  @JsonKey(name: 'pending_invitations')
  final int pendingInvitations;

  UserStatistics({
    required this.ownedLedgers,
    required this.memberLedgers,
    required this.pendingInvitations,
  });

  factory UserStatistics.fromJson(Map<String, dynamic> json) =>
      _$UserStatisticsFromJson(json);
  
  Map<String, dynamic> toJson() => _$UserStatisticsToJson(this);
}

// 新增其他必要的模型類別...
@JsonSerializable()
class UpdatePermissionRequest {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'new_permissions')
  final Map<String, bool> newPermissions;

  UpdatePermissionRequest({
    required this.ledgerId,
    required this.userId,
    required this.newPermissions,
  });

  factory UpdatePermissionRequest.fromJson(Map<String, dynamic> json) =>
      _$UpdatePermissionRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$UpdatePermissionRequestToJson(this);
}

@JsonSerializable()
class UpdatePermissionResponse {
  final bool success;
  final String message;
  
  @JsonKey(name: 'updated_user')
  final MemberInfo updatedUser;

  UpdatePermissionResponse({
    required this.success,
    required this.message,
    required this.updatedUser,
  });

  factory UpdatePermissionResponse.fromJson(Map<String, dynamic> json) =>
      _$UpdatePermissionResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$UpdatePermissionResponseToJson(this);
}

@JsonSerializable()
class LeaveProjectRequest {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  final String? reason;

  LeaveProjectRequest({
    required this.ledgerId,
    this.reason,
  });

  factory LeaveProjectRequest.fromJson(Map<String, dynamic> json) =>
      _$LeaveProjectRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$LeaveProjectRequestToJson(this);
}

@JsonSerializable()
class LeaveProjectResponse {
  final bool success;
  final String message;
  
  @JsonKey(name: 'remaining_members')
  final int remainingMembers;

  LeaveProjectResponse({
    required this.success,
    required this.message,
    required this.remainingMembers,
  });

  factory LeaveProjectResponse.fromJson(Map<String, dynamic> json) =>
      _$LeaveProjectResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$LeaveProjectResponseToJson(this);
}

@JsonSerializable()
class InviteMemberRequest {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'invitation_list')
  final List<MemberInvitation> invitationList;

  InviteMemberRequest({
    required this.ledgerId,
    required this.invitationList,
  });

  factory InviteMemberRequest.fromJson(Map<String, dynamic> json) =>
      _$InviteMemberRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$InviteMemberRequestToJson(this);
}

@JsonSerializable()
class InviteMemberResponse {
  final bool success;
  
  @JsonKey(name: 'invitation_results')
  final List<InvitationResult> invitationResults;
  
  @JsonKey(name: 'total_sent')
  final int totalSent;
  
  @JsonKey(name: 'successful_invites')
  final int successfulInvites;

  InviteMemberResponse({
    required this.success,
    required this.invitationResults,
    required this.totalSent,
    required this.successfulInvites,
  });

  factory InviteMemberResponse.fromJson(Map<String, dynamic> json) =>
      _$InviteMemberResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$InviteMemberResponseToJson(this);
}

@JsonSerializable()
class InvitationResult {
  @JsonKey(name: 'email_or_id')
  final String emailOrId;
  
  final bool success;
  final String? message;
  
  @JsonKey(name: 'invitation_id')
  final String? invitationId;

  InvitationResult({
    required this.emailOrId,
    required this.success,
    this.message,
    this.invitationId,
  });

  factory InvitationResult.fromJson(Map<String, dynamic> json) =>
      _$InvitationResultFromJson(json);
  
  Map<String, dynamic> toJson() => _$InvitationResultToJson(this);
}

@JsonSerializable()
class ActivityLogRequest {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'start_date')
  final String? startDate;
  
  @JsonKey(name: 'end_date')
  final String? endDate;
  
  @JsonKey(name: 'activity_types')
  final List<String>? activityTypes;
  
  final int? limit;
  final int? offset;

  ActivityLogRequest({
    required this.ledgerId,
    this.startDate,
    this.endDate,
    this.activityTypes,
    this.limit,
    this.offset,
  });

  factory ActivityLogRequest.fromJson(Map<String, dynamic> json) =>
      _$ActivityLogRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$ActivityLogRequestToJson(this);
  
  Map<String, String> toQueryParams() {
    final params = <String, String>{'ledger_id': ledgerId};
    
    if (startDate != null) params['start_date'] = startDate!;
    if (endDate != null) params['end_date'] = endDate!;
    if (activityTypes != null) params['activity_types'] = activityTypes!.join(',');
    if (limit != null) params['limit'] = limit.toString();
    if (offset != null) params['offset'] = offset.toString();
    
    return params;
  }
}

@JsonSerializable()
class ActivityLogResponse {
  final bool success;
  
  @JsonKey(name: 'activity_log')
  final List<ActivityLogEntry> activityLog;
  
  @JsonKey(name: 'total_count')
  final int totalCount;
  
  @JsonKey(name: 'activity_summary')
  final ActivitySummary activitySummary;

  ActivityLogResponse({
    required this.success,
    required this.activityLog,
    required this.totalCount,
    required this.activitySummary,
  });

  factory ActivityLogResponse.fromJson(Map<String, dynamic> json) =>
      _$ActivityLogResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$ActivityLogResponseToJson(this);
}

@JsonSerializable()
class ActivityLogEntry {
  @JsonKey(name: 'activity_id')
  final String activityId;
  
  @JsonKey(name: 'activity_type')
  final String activityType;
  
  final String description;
  
  @JsonKey(name: 'performed_by')
  final String performedBy;
  
  @JsonKey(name: 'user_name')
  final String userName;
  
  final String timestamp;
  
  @JsonKey(name: 'related_data')
  final Map<String, dynamic>? relatedData;

  ActivityLogEntry({
    required this.activityId,
    required this.activityType,
    required this.description,
    required this.performedBy,
    required this.userName,
    required this.timestamp,
    this.relatedData,
  });

  factory ActivityLogEntry.fromJson(Map<String, dynamic> json) =>
      _$ActivityLogEntryFromJson(json);
  
  Map<String, dynamic> toJson() => _$ActivityLogEntryToJson(this);
}

@JsonSerializable()
class ActivitySummary {
  @JsonKey(name: 'date_range')
  final String dateRange;
  
  @JsonKey(name: 'total_activities')
  final int totalActivities;
  
  @JsonKey(name: 'most_active_user')
  final String mostActiveUser;
  
  @JsonKey(name: 'activity_by_type')
  final Map<String, int> activityByType;

  ActivitySummary({
    required this.dateRange,
    required this.totalActivities,
    required this.mostActiveUser,
    required this.activityByType,
  });

  factory ActivitySummary.fromJson(Map<String, dynamic> json) =>
      _$ActivitySummaryFromJson(json);
  
  Map<String, dynamic> toJson() => _$ActivitySummaryToJson(this);
}
