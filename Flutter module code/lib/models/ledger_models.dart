
/**
 * Ledger_Models_1.0.0
 * @module 記帳資料模型
 * @description LCAS 2.0 記帳功能相關的資料模型定義
 * @update 2025-01-23: 建立版本，定義記帳記錄的資料結構
 */

import 'package:json_annotation/json_annotation.dart';

part 'ledger_models.g.dart';

/// 01. 記帳記錄
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義記帳記錄的完整資料格式
@JsonSerializable()
class LedgerEntry {
  @JsonKey(name: 'entry_id')
  final String entryId;
  
  @JsonKey(name: 'user_id')
  final String userId;
  
  @JsonKey(name: 'ledger_id')
  final String? ledgerId;
  
  @JsonKey(name: 'entry_type')
  final String entryType; // 'income', 'expense'
  
  @JsonKey(name: 'amount')
  final double amount;
  
  @JsonKey(name: 'currency')
  final String currency;
  
  @JsonKey(name: 'category_code')
  final String categoryCode;
  
  @JsonKey(name: 'subcategory_code')
  final String? subcategoryCode;
  
  @JsonKey(name: 'description')
  final String description;
  
  @JsonKey(name: 'transaction_date')
  final String transactionDate;
  
  @JsonKey(name: 'created_at')
  final String createdAt;
  
  @JsonKey(name: 'updated_at')
  final String? updatedAt;
  
  @JsonKey(name: 'payment_method')
  final String? paymentMethod;
  
  @JsonKey(name: 'location')
  final String? location;
  
  @JsonKey(name: 'tags')
  final List<String>? tags;
  
  @JsonKey(name: 'attachments')
  final List<String>? attachments;
  
  @JsonKey(name: 'status')
  final String status; // 'active', 'deleted'

  const LedgerEntry({
    required this.entryId,
    required this.userId,
    this.ledgerId,
    required this.entryType,
    required this.amount,
    this.currency = 'TWD',
    required this.categoryCode,
    this.subcategoryCode,
    required this.description,
    required this.transactionDate,
    required this.createdAt,
    this.updatedAt,
    this.paymentMethod,
    this.location,
    this.tags,
    this.attachments,
    this.status = 'active',
  });

  factory LedgerEntry.fromJson(Map<String, dynamic> json) =>
      _$LedgerEntryFromJson(json);

  Map<String, dynamic> toJson() => _$LedgerEntryToJson(this);
}

/// 02. 建立記帳記錄請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義建立記帳記錄的請求格式
@JsonSerializable()
class CreateLedgerEntryRequest {
  @JsonKey(name: 'ledger_id')
  final String? ledgerId;
  
  @JsonKey(name: 'entry_type')
  final String entryType;
  
  @JsonKey(name: 'amount')
  final double amount;
  
  @JsonKey(name: 'currency')
  final String currency;
  
  @JsonKey(name: 'category_code')
  final String categoryCode;
  
  @JsonKey(name: 'subcategory_code')
  final String? subcategoryCode;
  
  @JsonKey(name: 'description')
  final String description;
  
  @JsonKey(name: 'transaction_date')
  final String transactionDate;
  
  @JsonKey(name: 'payment_method')
  final String? paymentMethod;
  
  @JsonKey(name: 'location')
  final String? location;
  
  @JsonKey(name: 'tags')
  final List<String>? tags;

  const CreateLedgerEntryRequest({
    this.ledgerId,
    required this.entryType,
    required this.amount,
    this.currency = 'TWD',
    required this.categoryCode,
    this.subcategoryCode,
    required this.description,
    required this.transactionDate,
    this.paymentMethod,
    this.location,
    this.tags,
  });

  factory CreateLedgerEntryRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateLedgerEntryRequestFromJson(json);

  Map<String, dynamic> toJson() => _$CreateLedgerEntryRequestToJson(this);
}

/// 03. 科目代碼
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義收支科目代碼的資料格式
@JsonSerializable()
class SubjectCode {
  @JsonKey(name: 'major_code')
  final int majorCode;
  
  @JsonKey(name: 'major_name')
  final String majorName;
  
  @JsonKey(name: 'minor_code')
  final int? minorCode;
  
  @JsonKey(name: 'minor_name')
  final String? minorName;
  
  @JsonKey(name: 'synonyms')
  final String? synonyms;
  
  @JsonKey(name: 'is_active')
  final bool isActive;

  const SubjectCode({
    required this.majorCode,
    required this.majorName,
    this.minorCode,
    this.minorName,
    this.synonyms,
    this.isActive = true,
  });

  factory SubjectCode.fromJson(Map<String, dynamic> json) =>
      _$SubjectCodeFromJson(json);

  Map<String, dynamic> toJson() => _$SubjectCodeToJson(this);
}

/// 04. 帳本資訊
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義帳本的基本資訊格式
@JsonSerializable()
class LedgerInfo {
  @JsonKey(name: 'ledger_id')
  final String ledgerId;
  
  @JsonKey(name: 'ledger_name')
  final String ledgerName;
  
  @JsonKey(name: 'ledger_type')
  final String ledgerType; // 'basic', 'project', 'category', 'shared'
  
  @JsonKey(name: 'owner_id')
  final String ownerId;
  
  @JsonKey(name: 'description')
  final String? description;
  
  @JsonKey(name: 'currency')
  final String currency;
  
  @JsonKey(name: 'is_shared')
  final bool isShared;
  
  @JsonKey(name: 'status')
  final String status; // 'active', 'archived', 'deleted'
  
  @JsonKey(name: 'created_at')
  final String createdAt;
  
  @JsonKey(name: 'updated_at')
  final String? updatedAt;
  
  @JsonKey(name: 'collaborators')
  final List<String>? collaborators;
  
  @JsonKey(name: 'permissions')
  final Map<String, String>? permissions;

  const LedgerInfo({
    required this.ledgerId,
    required this.ledgerName,
    required this.ledgerType,
    required this.ownerId,
    this.description,
    this.currency = 'TWD',
    this.isShared = false,
    this.status = 'active',
    required this.createdAt,
    this.updatedAt,
    this.collaborators,
    this.permissions,
  });

  factory LedgerInfo.fromJson(Map<String, dynamic> json) =>
      _$LedgerInfoFromJson(json);

  Map<String, dynamic> toJson() => _$LedgerInfoToJson(this);
}

/// 05. 建立帳本請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義建立新帳本的請求格式
@JsonSerializable()
class CreateLedgerRequest {
  @JsonKey(name: 'ledger_name')
  final String ledgerName;
  
  @JsonKey(name: 'ledger_type')
  final String ledgerType;
  
  @JsonKey(name: 'description')
  final String? description;
  
  @JsonKey(name: 'currency')
  final String currency;
  
  @JsonKey(name: 'is_shared')
  final bool isShared;
  
  @JsonKey(name: 'collaborators')
  final List<String>? collaborators;

  const CreateLedgerRequest({
    required this.ledgerName,
    required this.ledgerType,
    this.description,
    this.currency = 'TWD',
    this.isShared = false,
    this.collaborators,
  });

  factory CreateLedgerRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateLedgerRequestFromJson(json);

  Map<String, dynamic> toJson() => _$CreateLedgerRequestToJson(this);
}

/// 06. 記帳查詢請求
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 12:00:00
/// @description 定義記帳記錄查詢的請求格式
@JsonSerializable()
class QueryLedgerEntriesRequest {
  @JsonKey(name: 'ledger_id')
  final String? ledgerId;
  
  @JsonKey(name: 'entry_type')
  final String? entryType;
  
  @JsonKey(name: 'start_date')
  final String? startDate;
  
  @JsonKey(name: 'end_date')
  final String? endDate;
  
  @JsonKey(name: 'category_codes')
  final List<String>? categoryCodes;
  
  @JsonKey(name: 'keywords')
  final String? keywords;
  
  @JsonKey(name: 'amount_min')
  final double? amountMin;
  
  @JsonKey(name: 'amount_max')
  final double? amountMax;
  
  @JsonKey(name: 'page')
  final int page;
  
  @JsonKey(name: 'page_size')
  final int pageSize;
  
  @JsonKey(name: 'sort_by')
  final String sortBy;
  
  @JsonKey(name: 'sort_order')
  final String sortOrder;

  const QueryLedgerEntriesRequest({
    this.ledgerId,
    this.entryType,
    this.startDate,
    this.endDate,
    this.categoryCodes,
    this.keywords,
    this.amountMin,
    this.amountMax,
    this.page = 1,
    this.pageSize = 50,
    this.sortBy = 'transaction_date',
    this.sortOrder = 'desc',
  });

  factory QueryLedgerEntriesRequest.fromJson(Map<String, dynamic> json) =>
      _$QueryLedgerEntriesRequestFromJson(json);

  Map<String, dynamic> toJson() => _$QueryLedgerEntriesRequestToJson(this);
}
