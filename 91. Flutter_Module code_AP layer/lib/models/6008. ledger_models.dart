
/**
 * ledger_models.dart_記帳資料模型_1.0.0
 * @module 記帳資料模型
 * @description LCAS 2.0 Flutter 記帳相關資料模型 - 記帳項目、科目代碼、查詢條件等資料結構
 * @update 2025-01-24: 建立記帳相關資料模型，支援多帳本記帳和科目管理
 */

import 'package:json_annotation/json_annotation.dart';

part 'ledger_models.g.dart';

/// 記帳項目模型
@JsonSerializable()
class LedgerEntry {
  final String id;
  final String userId;
  final String ledgerId;
  final DateTime date;
  final double amount;
  final String type; // income, expense
  final String subjectCode;
  final String subjectName;
  final String? description;
  final String? category;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const LedgerEntry({
    required this.id,
    required this.userId,
    required this.ledgerId,
    required this.date,
    required this.amount,
    required this.type,
    required this.subjectCode,
    required this.subjectName,
    this.description,
    this.category,
    this.metadata,
    required this.createdAt,
    this.updatedAt,
  });

  factory LedgerEntry.fromJson(Map<String, dynamic> json) =>
      _$LedgerEntryFromJson(json);
  
  Map<String, dynamic> toJson() => _$LedgerEntryToJson(this);

  /// 複製項目並更新部分欄位
  LedgerEntry copyWith({
    String? id,
    String? userId,
    String? ledgerId,
    DateTime? date,
    double? amount,
    String? type,
    String? subjectCode,
    String? subjectName,
    String? description,
    String? category,
    Map<String, dynamic>? metadata,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return LedgerEntry(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      ledgerId: ledgerId ?? this.ledgerId,
      date: date ?? this.date,
      amount: amount ?? this.amount,
      type: type ?? this.type,
      subjectCode: subjectCode ?? this.subjectCode,
      subjectName: subjectName ?? this.subjectName,
      description: description ?? this.description,
      category: category ?? this.category,
      metadata: metadata ?? this.metadata,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// 是否為收入項目
  bool get isIncome => type == 'income';

  /// 是否為支出項目
  bool get isExpense => type == 'expense';
}

/// 建立記帳項目請求模型
@JsonSerializable()
class CreateEntryRequest {
  final DateTime date;
  final double amount;
  final String type;
  final String subjectCode;
  final String? description;
  final String? category;
  final String? ledgerId;
  final Map<String, dynamic>? metadata;

  const CreateEntryRequest({
    required this.date,
    required this.amount,
    required this.type,
    required this.subjectCode,
    this.description,
    this.category,
    this.ledgerId,
    this.metadata,
  });

  factory CreateEntryRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateEntryRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$CreateEntryRequestToJson(this);
}

/// 記帳查詢條件模型
@JsonSerializable()
class LedgerQueryRequest {
  final String? ledgerId;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? type; // income, expense
  final String? category;
  final String? subjectCode;
  final double? minAmount;
  final double? maxAmount;
  final String? keyword;
  final int? limit;
  final int? offset;
  final String? sortBy; // date, amount, subject
  final String? sortOrder; // asc, desc

  const LedgerQueryRequest({
    this.ledgerId,
    this.startDate,
    this.endDate,
    this.type,
    this.category,
    this.subjectCode,
    this.minAmount,
    this.maxAmount,
    this.keyword,
    this.limit,
    this.offset,
    this.sortBy,
    this.sortOrder,
  });

  factory LedgerQueryRequest.fromJson(Map<String, dynamic> json) =>
      _$LedgerQueryRequestFromJson(json);
  
  Map<String, dynamic> toJson() => _$LedgerQueryRequestToJson(this);
}

/// 記帳查詢回應模型
@JsonSerializable()
class LedgerQueryResponse {
  final bool success;
  final List<LedgerEntry> entries;
  final LedgerSummary summary;
  final int totalCount;
  final int pageCount;
  final String message;
  final DateTime timestamp;

  const LedgerQueryResponse({
    required this.success,
    required this.entries,
    required this.summary,
    required this.totalCount,
    required this.pageCount,
    required this.message,
    required this.timestamp,
  });

  factory LedgerQueryResponse.fromJson(Map<String, dynamic> json) =>
      _$LedgerQueryResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$LedgerQueryResponseToJson(this);
}

/// 記帳摘要統計模型
@JsonSerializable()
class LedgerSummary {
  final double totalIncome;
  final double totalExpense;
  final double balance;
  final int entryCount;
  final DateTime? periodStart;
  final DateTime? periodEnd;
  final Map<String, double>? categoryBreakdown;

  const LedgerSummary({
    required this.totalIncome,
    required this.totalExpense,
    required this.balance,
    required this.entryCount,
    this.periodStart,
    this.periodEnd,
    this.categoryBreakdown,
  });

  factory LedgerSummary.fromJson(Map<String, dynamic> json) =>
      _$LedgerSummaryFromJson(json);
  
  Map<String, dynamic> toJson() => _$LedgerSummaryToJson(this);
}

/// 科目代碼模型
@JsonSerializable()
class SubjectCode {
  final String code;
  final String name;
  final String type; // income, expense
  final String? parentCode;
  final String? description;
  final List<String>? synonyms;
  final bool isActive;
  final int sortOrder;

  const SubjectCode({
    required this.code,
    required this.name,
    required this.type,
    this.parentCode,
    this.description,
    this.synonyms,
    this.isActive = true,
    this.sortOrder = 0,
  });

  factory SubjectCode.fromJson(Map<String, dynamic> json) =>
      _$SubjectCodeFromJson(json);
  
  Map<String, dynamic> toJson() => _$SubjectCodeToJson(this);
}

/// 科目代碼清單回應模型
@JsonSerializable()
class SubjectListResponse {
  final bool success;
  final List<SubjectCode> subjects;
  final String message;
  final DateTime timestamp;

  const SubjectListResponse({
    required this.success,
    required this.subjects,
    required this.message,
    required this.timestamp,
  });

  factory SubjectListResponse.fromJson(Map<String, dynamic> json) =>
      _$SubjectListResponseFromJson(json);
  
  Map<String, dynamic> toJson() => _$SubjectListResponseToJson(this);
}
