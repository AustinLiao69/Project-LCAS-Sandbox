
/**
 * project_models.dart_專案資料模型_1.0.0
 * @module 專案資料模型
 * @description LCAS 2.0 Flutter 專案帳本相關資料模型 - 專案管理、多帳本切換等資料結構
 * @update 2025-01-24: 建立專案相關資料模型，支援多帳本管理和專案協作
 */

import 'package:json_annotation/json_annotation.dart';

part 'project_models.g.dart';

/// 專案帳本模型
@JsonSerializable()
class Project {
  final String id;
  final String name;
  final String description;
  final String ownerId;
  final String type; // personal, work, investment, etc.
  final String status; // active, archived, completed
  final List<String> memberIds;
  final ProjectSettings settings;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final Map<String, dynamic>? metadata;

  const Project({
    required this.id,
    required this.name,
    required this.description,
    required this.ownerId,
    required this.type,
    required this.status,
    required this.memberIds,
    required this.settings,
    required this.createdAt,
    this.updatedAt,
    this.metadata,
  });

  factory Project.fromJson(Map<String, dynamic> json) =>
      _$ProjectFromJson(json);
  
  Map<String, dynamic> toJson() => _$ProjectToJson(this);

  /// 複製專案並更新部分欄位
  Project copyWith({
    String? id,
    String? name,
    String? description,
    String? ownerId,
    String? type,
    String? status,
    List<String>? memberIds,
    ProjectSettings? settings,
    DateTime? createdAt,
    DateTime? updatedAt,
    Map<String, dynamic>? metadata,
  }) {
    return Project(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      ownerId: ownerId ?? this.ownerId,
      type: type ?? this.type,
      status: status ?? this.status,
      memberIds: memberIds ?? this.memberIds,
      settings: settings ?? this.settings,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      metadata: metadata ?? this.metadata,
    );
  }

  /// 是否為專案擁有者
  bool isOwner(String userId) => ownerId == userId;

  /// 是否為專案成員
  bool isMember(String userId) => memberIds.contains(userId) || isOwner(userId);

  /// 是否為活躍專案
  bool get isActive => status == 'active';
}

/// 建立專案請求模型
@JsonSerializable()
class CreateProjectRequest {
  final String name;
  final String description;
  final String type;
  final ProjectSettings? settings;
  final List<String>? initialMembers;
  final Map<String, dynamic>? metadata;

  const CreateProjectRequest({
    required this.name,
    required this.description,
    required this.type,
    this.settings,
    this.initialMembers,
    this.metadata,
  });

  factory CreateProjectRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateProjectRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$CreateProjectRequestToJson(this);
}

/// 專案設定模型
@JsonSerializable()
class ProjectSettings {
  final String currency;
  final String timezone;
  final bool allowCollaboration;
  final Map<String, String> permissions; // userId -> role
  final List<String>? categories;
  final Map<String, dynamic>? budgetSettings;
  final Map<String, dynamic>? reportSettings;

  const ProjectSettings({
    required this.currency,
    required this.timezone,
    required this.allowCollaboration,
    required this.permissions,
    this.categories,
    this.budgetSettings,
    this.reportSettings,
  });

  factory ProjectSettings.fromJson(Map<String, dynamic> json) =>
      _$ProjectSettingsFromJson(json);
  
  Map<String, dynamic> toJson() => _$ProjectSettingsToJson(this);
}

/// 專案清單回應模型
@JsonSerializable()
class ProjectListResponse {
  final bool success;
  final List<Project> projects;
  final int totalCount;
  final String message;
  final DateTime timestamp;

  const ProjectListResponse({
    required this.success,
    required this.projects,
    required this.totalCount,
    required this.message,
    required this.timestamp,
  });

  factory ProjectListResponse.fromJson(Map<String, dynamic> json) =>
      _$ProjectListResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$ProjectListResponseToJson(this);
}

/// 分類帳本模型
@JsonSerializable()
class CategoryLedger {
  final String id;
  final String name;
  final String description;
  final String parentId;
  final String type; // category, tag, custom
  final String color;
  final String? icon;
  final List<String> tags;
  final CategorySettings settings;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const CategoryLedger({
    required this.id,
    required this.name,
    required this.description,
    required this.parentId,
    required this.type,
    required this.color,
    this.icon,
    required this.tags,
    required this.settings,
    required this.createdAt,
    this.updatedAt,
  });

  factory CategoryLedger.fromJson(Map<String, dynamic> json) =>
      _$CategoryLedgerFromJson(json);
  
  Map<String, dynamic> toJson() => _$CategoryLedgerToJson(this);
}

/// 分類設定模型
@JsonSerializable()
class CategorySettings {
  final bool autoClassify;
  final List<String> keywords;
  final List<String> excludeKeywords;
  final double? budgetLimit;
  final String? budgetPeriod;
  final Map<String, dynamic>? rules;

  const CategorySettings({
    required this.autoClassify,
    required this.keywords,
    required this.excludeKeywords,
    this.budgetLimit,
    this.budgetPeriod,
    this.rules,
  });

  factory CategorySettings.fromJson(Map<String, dynamic> json) =>
      _$CategorySettingsFromJson(json);
  
  Map<String, dynamic> toJson() => _$CategorySettingsToJson(this);
}

/// 建立分類請求模型
@JsonSerializable()
class CreateCategoryRequest {
  final String name;
  final String description;
  final String parentId;
  final String type;
  final String color;
  final String? icon;
  final List<String>? tags;
  final CategorySettings? settings;

  const CreateCategoryRequest({
    required this.name,
    required this.description,
    required this.parentId,
    required this.type,
    required this.color,
    this.icon,
    this.tags,
    this.settings,
  });

  factory CreateCategoryRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateCategoryRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$CreateCategoryRequestToJson(this);
}

/// 帳本切換請求模型
@JsonSerializable()
class SwitchLedgerRequest {
  final String targetLedgerId;
  final String ledgerType; // project, category, shared
  final Map<String, dynamic>? context;

  const SwitchLedgerRequest({
    required this.targetLedgerId,
    required this.ledgerType,
    this.context,
  });

  factory SwitchLedgerRequest.fromJson(Map<String, dynamic> json) =>
      _$SwitchLedgerRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$SwitchLedgerRequestToJson(this);
}

/// 帳本切換回應模型
@JsonSerializable()
class SwitchLedgerResponse {
  final bool success;
  final String currentLedgerId;
  final String ledgerName;
  final String ledgerType;
  final Map<String, dynamic>? ledgerInfo;
  final String message;
  final DateTime timestamp;

  const SwitchLedgerResponse({
    required this.success,
    required this.currentLedgerId,
    required this.ledgerName,
    required this.ledgerType,
    this.ledgerInfo,
    required this.message,
    required this.timestamp,
  });

  factory SwitchLedgerResponse.fromJson(Map<String, dynamic> json) =>
      _$SwitchLedgerResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$SwitchLedgerResponseToJson(this);
}
