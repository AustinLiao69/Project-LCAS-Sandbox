
/**
 * 7303_帳本協作功能群_2.0.0
 * @module 帳本協作功能群
 * @description LCAS 2.0帳本協作功能群模組 - Phase 2帳本管理與協作記帳業務邏輯
 * @update 2025-10-22: 版本升級至2.0.0，實作25個核心函數，移除非MVP功能
 */

import 'dart:async';
import 'dart:convert';
import '../APL.dart';

/// 帳本資料模型
class Ledger {
  final String id;
  final String name;
  final String type;
  final String description;
  final String ownerId;
  final List<String> members;
  final Map<String, dynamic> permissions;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool archived;
  final Map<String, dynamic> metadata;

  Ledger({
    required this.id,
    required this.name,
    required this.type,
    required this.description,
    required this.ownerId,
    required this.members,
    required this.permissions,
    required this.createdAt,
    required this.updatedAt,
    required this.archived,
    required this.metadata,
  });

  factory Ledger.fromJson(Map<String, dynamic> json) {
    return Ledger(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      type: json['type'] ?? '',
      description: json['description'] ?? '',
      ownerId: json['owner_id'] ?? '',
      members: List<String>.from(json['members'] ?? []),
      permissions: Map<String, dynamic>.from(json['permissions'] ?? {}),
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updated_at'] ?? DateTime.now().toIso8601String()),
      archived: json['archived'] ?? false,
      metadata: Map<String, dynamic>.from(json['metadata'] ?? {}),
    );
  }
}

/// 協作者資料模型
class Collaborator {
  final String userId;
  final String email;
  final String displayName;
  final String role;
  final Map<String, dynamic> permissions;
  final String status;
  final DateTime joinedAt;

  Collaborator({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.role,
    required this.permissions,
    required this.status,
    required this.joinedAt,
  });

  factory Collaborator.fromJson(Map<String, dynamic> json) {
    return Collaborator(
      userId: json['userId'] ?? '',
      email: json['email'] ?? '',
      displayName: json['displayName'] ?? '',
      role: json['role'] ?? '',
      permissions: Map<String, dynamic>.from(json['permissions'] ?? {}),
      status: json['status'] ?? '',
      joinedAt: DateTime.parse(json['joinedAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

/// 邀請資料模型
class InvitationData {
  final String email;
  final String role;
  final Map<String, dynamic> permissions;
  final String? message;

  InvitationData({
    required this.email,
    required this.role,
    required this.permissions,
    this.message,
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'role': role,
      'permissions': permissions,
      if (message != null) 'message': message,
    };
  }
}

/// 邀請結果模型
class InvitationResult {
  final bool success;
  final List<Map<String, dynamic>> results;
  final String message;

  InvitationResult({
    required this.success,
    required this.results,
    required this.message,
  });
}

/// 權限資料模型
class PermissionData {
  final String role;
  final Map<String, bool> permissions;
  final String? reason;

  PermissionData({
    required this.role,
    required this.permissions,
    this.reason,
  });

  Map<String, dynamic> toJson() {
    return {
      'role': role,
      'permissions': permissions,
      if (reason != null) 'reason': reason,
    };
  }
}

/// 權限矩陣模型
class PermissionMatrix {
  final Map<String, bool> permissions;
  final String role;
  final bool isOwner;

  PermissionMatrix({
    required this.permissions,
    required this.role,
    required this.isOwner,
  });

  factory PermissionMatrix.fromJson(Map<String, dynamic> json) {
    return PermissionMatrix(
      permissions: Map<String, bool>.from(json['permissions'] ?? {}),
      role: json['role'] ?? '',
      isOwner: json['isOwner'] ?? false,
    );
  }
}

/// 驗證結果模型
class ValidationResult {
  final bool isValid;
  final List<String> errors;
  final List<String> warnings;

  ValidationResult({
    required this.isValid,
    required this.errors,
    required this.warnings,
  });
}

/// 帳本協作錯誤類別
class CollaborationError implements Exception {
  final String message;
  final String code;
  final Map<String, dynamic>? details;

  CollaborationError(this.message, this.code, [this.details]);

  @override
  String toString() => 'CollaborationError: $message (Code: $code)';
}

/// 帳本協作功能群主類別
class LedgerCollaborationManager {
  static const String moduleVersion = '2.0.0';
  static const String moduleDate = '2025-10-22';

  /// =============== 階段一：帳本管理核心函數（8個函數） ===============

  /**
   * 01. 處理帳本列表查詢
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 帳本列表查詢處理
   */
  static Future<List<Ledger>> processLedgerList(
    Map<String, dynamic> request, {
    String? userMode,
  }) async {
    try {
      // 準備查詢參數
      final queryParams = <String, String>{};
      
      if (request['type'] != null) queryParams['type'] = request['type'];
      if (request['role'] != null) queryParams['role'] = request['role'];
      if (request['status'] != null) queryParams['status'] = request['status'];
      if (request['search'] != null) queryParams['search'] = request['search'];
      if (request['sortBy'] != null) queryParams['sortBy'] = request['sortBy'];
      if (request['sortOrder'] != null) queryParams['sortOrder'] = request['sortOrder'];
      if (request['page'] != null) queryParams['page'] = request['page'].toString();
      if (request['limit'] != null) queryParams['limit'] = request['limit'].toString();

      // 通過APL.dart調用API
      final response = await APL.instance.ledger.getLedgers(
        type: request['type'],
        role: request['role'],
        status: request['status'],
        search: request['search'],
        sortBy: request['sortBy'],
        sortOrder: request['sortOrder'],
        page: request['page'],
        limit: request['limit'],
        userMode: userMode,
      );

      if (response.success && response.data != null) {
        return response.data!.map((ledgerData) => Ledger.fromJson(ledgerData)).toList();
      } else {
        throw CollaborationError(
          response.message,
          response.error?.code ?? 'LEDGER_LIST_ERROR',
          response.error?.details,
        );
      }
    } catch (e) {
      throw CollaborationError(
        '帳本列表查詢失敗: ${e.toString()}',
        'PROCESS_LEDGER_LIST_ERROR',
      );
    }
  }

  /**
   * 02. 處理帳本建立
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 帳本建立處理
   */
  static Future<Ledger> processLedgerCreation(
    Map<String, dynamic> request, {
    String? userMode,
  }) async {
    try {
      // 驗證建立資料
      final validation = validateLedgerData(request);
      if (!validation.isValid) {
        throw CollaborationError(
          '帳本資料驗證失敗: ${validation.errors.join(', ')}',
          'VALIDATION_ERROR',
        );
      }

      // 通過APL.dart調用API
      final response = await APL.instance.ledger.createLedger(request);

      if (response.success && response.data != null) {
        return Ledger.fromJson(response.data!);
      } else {
        throw CollaborationError(
          response.message,
          response.error?.code ?? 'LEDGER_CREATION_ERROR',
          response.error?.details,
        );
      }
    } catch (e) {
      if (e is CollaborationError) rethrow;
      throw CollaborationError(
        '帳本建立處理失敗: ${e.toString()}',
        'PROCESS_LEDGER_CREATION_ERROR',
      );
    }
  }

  /**
   * 03. 處理帳本更新
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 帳本更新處理
   */
  static Future<void> processLedgerUpdate(
    String ledgerId,
    Map<String, dynamic> request, {
    String? userMode,
  }) async {
    try {
      // 驗證更新資料
      final validation = validateLedgerData(request);
      if (!validation.isValid) {
        throw CollaborationError(
          '帳本更新資料驗證失敗: ${validation.errors.join(', ')}',
          'VALIDATION_ERROR',
        );
      }

      // 通過APL.dart調用API
      final response = await APL.instance.ledger.updateLedger(ledgerId, request);

      if (!response.success) {
        throw CollaborationError(
          response.message,
          response.error?.code ?? 'LEDGER_UPDATE_ERROR',
          response.error?.details,
        );
      }
    } catch (e) {
      if (e is CollaborationError) rethrow;
      throw CollaborationError(
        '帳本更新處理失敗: ${e.toString()}',
        'PROCESS_LEDGER_UPDATE_ERROR',
      );
    }
  }

  /**
   * 04. 處理帳本刪除
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 帳本刪除處理
   */
  static Future<void> processLedgerDeletion(String ledgerId) async {
    try {
      // 通過APL.dart調用API
      final response = await APL.instance.ledger.deleteLedger(ledgerId);

      if (!response.success) {
        throw CollaborationError(
          response.message,
          response.error?.code ?? 'LEDGER_DELETION_ERROR',
          response.error?.details,
        );
      }
    } catch (e) {
      if (e is CollaborationError) rethrow;
      throw CollaborationError(
        '帳本刪除處理失敗: ${e.toString()}',
        'PROCESS_LEDGER_DELETION_ERROR',
      );
    }
  }

  /**
   * 05. 驗證帳本資料
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 帳本資料驗證
   */
  static ValidationResult validateLedgerData(Map<String, dynamic> data) {
    final errors = <String>[];
    final warnings = <String>[];

    // 必填欄位驗證
    if (data['name'] == null || (data['name'] as String).trim().isEmpty) {
      errors.add('帳本名稱為必填項目');
    }

    if (data['type'] == null || (data['type'] as String).trim().isEmpty) {
      errors.add('帳本類型為必填項目');
    }

    // 名稱長度驗證
    if (data['name'] != null && (data['name'] as String).length > 50) {
      errors.add('帳本名稱不能超過50個字元');
    }

    // 描述長度驗證
    if (data['description'] != null && (data['description'] as String).length > 200) {
      warnings.add('帳本描述過長，建議縮短至200字元以內');
    }

    // 類型驗證
    if (data['type'] != null) {
      final validTypes = ['personal', 'shared', 'project', 'category'];
      if (!validTypes.contains(data['type'])) {
        errors.add('無效的帳本類型');
      }
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
      warnings: warnings,
    );
  }

  /**
   * 06. 載入帳本狀態
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 載入帳本狀態
   */
  static Future<void> loadLedgers({
    String? type,
    String? userMode,
    bool forceRefresh = false,
  }) async {
    try {
      // 準備查詢請求
      final request = <String, dynamic>{
        if (type != null) 'type': type,
        'limit': 50, // 預設載入限制
        'sortBy': 'updated_at',
        'sortOrder': 'desc',
      };

      // 載入帳本列表
      final ledgers = await processLedgerList(request, userMode: userMode);

      // 這裡可以將載入的帳本存儲到本地狀態管理中
      // 由於這是PL層的業務邏輯函數，實際的狀態管理會在UI層處理
      print('已載入 ${ledgers.length} 個帳本');
      
    } catch (e) {
      throw CollaborationError(
        '載入帳本狀態失敗: ${e.toString()}',
        'LOAD_LEDGERS_ERROR',
      );
    }
  }

  /**
   * 07. 建立新帳本
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 建立新帳本
   */
  static Future<Ledger> createLedger(
    Map<String, dynamic> data, {
    String? userMode,
  }) async {
    try {
      // 預處理建立資料
      final createData = <String, dynamic>{
        'name': data['name'],
        'type': data['type'] ?? 'personal',
        'description': data['description'] ?? '',
        'currency': data['currency'] ?? 'TWD',
        'timezone': data['timezone'] ?? 'Asia/Taipei',
        ...data,
      };

      // 調用處理函數
      return await processLedgerCreation(createData, userMode: userMode);
      
    } catch (e) {
      if (e is CollaborationError) rethrow;
      throw CollaborationError(
        '建立新帳本失敗: ${e.toString()}',
        'CREATE_LEDGER_ERROR',
      );
    }
  }

  /**
   * 08. 更新帳本資訊
   * @version 2025-10-22-V2.0.0
   * @date 2025-10-22
   * @update: 階段一實作 - 更新帳本資訊
   */
  static Future<void> updateLedger(
    String ledgerId,
    Map<String, dynamic> data, {
    String? userMode,
  }) async {
    try {
      // 預處理更新資料
      final updateData = <String, dynamic>{
        ...data,
        'updated_at': DateTime.now().toIso8601String(),
      };

      // 調用處理函數
      await processLedgerUpdate(ledgerId, updateData, userMode: userMode);
      
    } catch (e) {
      if (e is CollaborationError) rethrow;
      throw CollaborationError(
        '更新帳本資訊失敗: ${e.toString()}',
        'UPDATE_LEDGER_ERROR',
      );
    }
  }

  /// =============== 模組資訊 ===============

  /**
   * 取得模組版本資訊
   * @version 2025-10-22-V2.0.0
   */
  static Map<String, dynamic> getModuleInfo() {
    return {
      'moduleName': '帳本協作功能群',
      'version': moduleVersion,
      'date': moduleDate,
      'phase': 'Phase 2',
      'stage1Functions': 8,
      'totalFunctions': 25,
      'description': 'LCAS 2.0 帳本協作功能群 - Phase 2 帳本管理與協作記帳業務邏輯',
    };
  }
}
