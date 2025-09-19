
/**
 * 8304. 帳本管理服務.dart
 * @module 帳本管理服務模組 - API Gateway
 * @version 2.4.0
 * @description LCAS 2.0 帳本管理服務 API Gateway - 純路由轉發，業務邏輯已移至PL層
 * @date 2025-09-19
 * @update 2025-09-19: 帳本管理服務API Gateway實作，純路由轉發
 */

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;

// ================================
// API Gateway 路由定義
// ================================

/// 帳本管理服務API Gateway
class LedgerAPIGateway {
  final String _backendBaseUrl = 'http://0.0.0.0:5000';
  final http.Client _httpClient = http.Client();

  /**
   * 01. 取得帳本列表API路由 (GET /api/v1/ledgers)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getLedgers(Map<String, dynamic> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value.toString())}')
        .join('&');
    
    return await _forwardRequest(
      'GET',
      '/ledgers${queryString.isNotEmpty ? '?$queryString' : ''}',
      null,
    );
  }

  /**
   * 02. 建立帳本API路由 (POST /api/v1/ledgers)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> createLedger(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/ledgers',
      requestBody,
    );
  }

  /**
   * 03. 取得帳本詳情API路由 (GET /api/v1/ledgers/{id})
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getLedgerDetail(String ledgerId) async {
    return await _forwardRequest(
      'GET',
      '/ledgers/$ledgerId',
      null,
    );
  }

  /**
   * 04. 更新帳本API路由 (PUT /api/v1/ledgers/{id})
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> updateLedger(String ledgerId, Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'PUT',
      '/ledgers/$ledgerId',
      requestBody,
    );
  }

  /**
   * 05. 刪除帳本API路由 (DELETE /api/v1/ledgers/{id})
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> deleteLedger(String ledgerId) async {
    return await _forwardRequest(
      'DELETE',
      '/ledgers/$ledgerId',
      null,
    );
  }

  /**
   * 06. 取得協作者API路由 (GET /api/v1/ledgers/{id}/collaborators)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getCollaborators(String ledgerId) async {
    return await _forwardRequest(
      'GET',
      '/ledgers/$ledgerId/collaborators',
      null,
    );
  }

  /**
   * 07. 邀請協作者API路由 (POST /api/v1/ledgers/{id}/invitations)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> inviteCollaborators(String ledgerId, Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/ledgers/$ledgerId/invitations',
      requestBody,
    );
  }

  /**
   * 08. 更新協作者權限API路由 (PUT /api/v1/ledgers/{id}/collaborators/{userId})
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> updateCollaborator(String ledgerId, String userId, Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'PUT',
      '/ledgers/$ledgerId/collaborators/$userId',
      requestBody,
    );
  }

  /**
   * 09. 移除協作者API路由 (DELETE /api/v1/ledgers/{id}/collaborators/{userId})
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> removeCollaborator(String ledgerId, String userId) async {
    return await _forwardRequest(
      'DELETE',
      '/ledgers/$ledgerId/collaborators/$userId',
      null,
    );
  }

  /**
   * 10. 取得權限狀態API路由 (GET /api/v1/ledgers/{id}/permissions)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getPermissionStatus(String ledgerId) async {
    return await _forwardRequest(
      'GET',
      '/ledgers/$ledgerId/permissions',
      null,
    );
  }

  /**
   * 11. 檢測協作衝突API路由 (GET /api/v1/ledgers/{id}/conflicts)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> detectConflicts(String ledgerId) async {
    return await _forwardRequest(
      'GET',
      '/ledgers/$ledgerId/conflicts',
      null,
    );
  }

  /**
   * 12. 解決協作衝突API路由 (POST /api/v1/ledgers/{id}/resolve-conflict)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> resolveConflict(String ledgerId, Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/ledgers/$ledgerId/resolve-conflict',
      requestBody,
    );
  }

  /**
   * 13. 取得操作審計日誌API路由 (GET /api/v1/ledgers/{id}/audit-log)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getAuditLog(String ledgerId, Map<String, dynamic> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value.toString())}')
        .join('&');
    
    return await _forwardRequest(
      'GET',
      '/ledgers/$ledgerId/audit-log${queryString.isNotEmpty ? '?$queryString' : ''}',
      null,
    );
  }

  /**
   * 14. 取得帳本類型列表API路由 (GET /api/v1/ledgers/types)
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getLedgerTypes() async {
    return await _forwardRequest(
      'GET',
      '/ledgers/types',
      null,
    );
  }

  // ================================
  // 私有方法：統一請求轉發機制
  // ================================

  /**
   * 統一請求轉發方法
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 純API Gateway核心轉發邏輯
   */
  Future<http.Response> _forwardRequest(
    String method,
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    try {
      final uri = Uri.parse('$_backendBaseUrl$endpoint');
      final headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      http.Response response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await _httpClient.get(uri, headers: headers);
          break;
        case 'POST':
          response = await _httpClient.post(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'PUT':
          response = await _httpClient.put(
            uri,
            headers: headers,
            body: body != null ? json.encode(body) : null,
          );
          break;
        case 'DELETE':
          response = await _httpClient.delete(uri, headers: headers);
          break;
        default:
          throw Exception('不支援的HTTP方法: $method');
      }

      return response;
    } catch (e) {
      // 返回錯誤回應
      return http.Response(
        json.encode({
          'success': false,
          'error': {
            'code': 'GATEWAY_ERROR',
            'message': '網關轉發失敗: ${e.toString()}',
            'timestamp': DateTime.now().toIso8601String(),
          }
        }),
        500,
        headers: {'content-type': 'application/json'},
      );
    }
  }

  // ================================
  // 第二階段：協作管理服務層函數
  // ================================

  /**
   * 19. 處理協作者邀請
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 協作者邀請業務邏輯處理
   */
  Future<InvitationResult> processInvitation(String ledgerId, InvitationRequest request) async {
    try {
      // 轉發至後端BL層處理邀請邏輯
      final response = await inviteCollaborators(ledgerId, request.toMap());
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return InvitationResult.fromMap(data['data']);
      } else {
        throw Exception('邀請處理失敗: ${response.body}');
      }
    } catch (e) {
      throw Exception('處理協作者邀請時發生錯誤: ${e.toString()}');
    }
  }

  /**
   * 20. 處理權限更新
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 權限更新業務邏輯處理
   */
  Future<PermissionUpdateResult> processPermissionUpdate(String ledgerId, String userId, String newRole) async {
    try {
      // 轉發至後端BL層處理權限更新
      final request = {'role': newRole, 'reason': '權限調整'};
      final response = await updateCollaborator(ledgerId, userId, request);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return PermissionUpdateResult.fromMap(data['data']);
      } else {
        throw Exception('權限更新失敗: ${response.body}');
      }
    } catch (e) {
      throw Exception('處理權限更新時發生錯誤: ${e.toString()}');
    }
  }

  /**
   * 21. 處理成員移除
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 成員移除業務邏輯處理
   */
  Future<void> processMemberRemoval(String ledgerId, String userId) async {
    try {
      // 轉發至後端BL層處理成員移除
      final response = await removeCollaborator(ledgerId, userId);
      
      if (response.statusCode != 200) {
        throw Exception('成員移除失敗: ${response.body}');
      }
    } catch (e) {
      throw Exception('處理成員移除時發生錯誤: ${e.toString()}');
    }
  }

  /**
   * 22. 檢查用戶權限
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 用戶權限檢查
   */
  Future<bool> checkUserPermission(String userId, String ledgerId, String action) async {
    try {
      final response = await getPermissionStatus(ledgerId);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final permissions = data['data']['permissions'] as Map<String, dynamic>;
        
        switch (action) {
          case 'view':
            return permissions['canView'] ?? false;
          case 'edit':
            return permissions['canEdit'] ?? false;
          case 'manage':
            return permissions['canManage'] ?? false;
          case 'delete':
            return permissions['canDelete'] ?? false;
          case 'invite':
            return permissions['canInvite'] ?? false;
          default:
            return false;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * 23. 取得用戶權限詳情
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 獲取用戶權限詳細資訊
   */
  Future<UserPermissionDetails> getUserPermissions(String userId, String ledgerId) async {
    try {
      final response = await getPermissionStatus(ledgerId);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return UserPermissionDetails.fromMap(data['data']);
      } else {
        throw Exception('獲取權限詳情失敗: ${response.body}');
      }
    } catch (e) {
      throw Exception('取得用戶權限詳情時發生錯誤: ${e.toString()}');
    }
  }

  /**
   * 24. 更新用戶權限
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 更新用戶權限設定
   */
  Future<void> updateUserPermission(String userId, String ledgerId, String role) async {
    try {
      await processPermissionUpdate(ledgerId, userId, role);
    } catch (e) {
      throw Exception('更新用戶權限時發生錯誤: ${e.toString()}');
    }
  }

  /**
   * 25. 適配回應內容
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 根據用戶模式適配回應內容
   */
  T adaptResponse<T>(T response, UserMode userMode) {
    // 根據用戶模式過濾回應內容
    // 此為純API Gateway，實際邏輯由後端BL層處理
    return response;
  }

  /**
   * 26. 適配帳本列表回應
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 適配帳本列表回應格式
   */
  Future<http.Response> adaptLedgerListResponse(http.Response response, UserMode userMode) async {
    try {
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // 根據用戶模式調整顯示內容
        switch (userMode) {
          case UserMode.guiding:
            // 簡化模式：隱藏複雜資訊
            if (data['data'] != null && data['data']['ledgers'] != null) {
              for (var ledger in data['data']['ledgers']) {
                ledger.remove('statistics');
                ledger.remove('audit');
              }
            }
            break;
          case UserMode.expert:
            // 專家模式：保留所有資訊
            break;
          default:
            break;
        }
        
        return http.Response(
          json.encode(data),
          response.statusCode,
          headers: response.headers,
        );
      }
      return response;
    } catch (e) {
      return response;
    }
  }

  /**
   * 27. 適配帳本詳情回應
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 適配帳本詳情回應格式
   */
  Future<http.Response> adaptLedgerDetailResponse(http.Response response, UserMode userMode) async {
    try {
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // 根據用戶模式調整顯示內容
        switch (userMode) {
          case UserMode.guiding:
            // 簡化模式：僅保留基本資訊
            if (data['data'] != null) {
              data['data'].remove('statistics');
              data['data'].remove('audit');
            }
            break;
          case UserMode.expert:
            // 專家模式：保留所有詳細資訊
            break;
          default:
            break;
        }
        
        return http.Response(
          json.encode(data),
          response.statusCode,
          headers: response.headers,
        );
      }
      return response;
    } catch (e) {
      return response;
    }
  }

  // ================================
  // 權限控制相關類別
  // ================================

  /**
   * 37. 權限矩陣類別
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 權限控制矩陣定義
   */
  static const Map<String, List<String>> _permissionMatrix = {
    'owner': ['view', 'edit', 'manage', 'delete', 'invite'],
    'admin': ['view', 'edit', 'manage', 'invite'],
    'editor': ['view', 'edit'],
    'viewer': ['view'],
  };

  /**
   * 38. 權限檢查器類別
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 權限檢查工具
   */
  bool hasPermission(String role, String action) {
    final permissions = _permissionMatrix[role] ?? [];
    return permissions.contains(action);
  }

  /**
   * 39. 帳本驗證器類別
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 帳本相關驗證邏輯
   */
  List<String> validateInvitationRequest(InvitationRequest request) {
    List<String> errors = [];
    
    if (request.invitations.isEmpty) {
      errors.add('邀請列表不能為空');
    }
    
    for (var invitation in request.invitations) {
      if (invitation.email.isEmpty) {
        errors.add('邀請email不能為空');
      }
      
      if (!['admin', 'editor', 'viewer'].contains(invitation.role)) {
        errors.add('無效的權限角色: ${invitation.role}');
      }
    }
    
    return errors;
  }

  /**
   * 40. 帳本錯誤碼枚舉
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 錯誤代碼定義
   */
  static const Map<String, String> errorCodes = {
    'INVALID_LEDGER_NAME': '帳本名稱無效',
    'INSUFFICIENT_PERMISSIONS': '權限不足',
    'LEDGER_NOT_FOUND': '帳本不存在',
    'USER_NOT_FOUND': '用戶不存在',
    'COLLABORATOR_ALREADY_EXISTS': '協作者已存在',
    'CANNOT_REMOVE_OWNER': '無法移除擁有者',
    'MAX_COLLABORATORS_REACHED': '已達協作者人數上限',
  };

  /**
   * 41. 帳本例外類別
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 自定義例外處理
   */
  String getErrorMessage(String errorCode) {
    return errorCodes[errorCode] ?? '未知錯誤';
  }

  /**
   * 42. 帳本模式設定類別
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 用戶模式配置
   */
  Map<String, dynamic> getModeConfig(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return {
          'showStatistics': true,
          'showAdvancedOptions': true,
          'enableCollaboration': true,
          'showAuditLog': true,
          'availableActions': ['create', 'edit', 'delete', 'invite', 'export', 'analyze']
        };
      case UserMode.guiding:
        return {
          'showStatistics': false,
          'showAdvancedOptions': false,
          'enableCollaboration': false,
          'showAuditLog': false,
          'availableActions': ['create', 'edit']
        };
      default:
        return {
          'showStatistics': true,
          'showAdvancedOptions': false,
          'enableCollaboration': true,
          'showAuditLog': false,
          'availableActions': ['create', 'edit', 'invite']
        };
    }
  }

  /**
   * 43. 模式配置工廠類別
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: 模式配置產生工廠
   */
  http.Response filterResponseForMode(http.Response response, UserMode mode) {
    try {
      final config = getModeConfig(mode);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // 根據模式配置過濾回應內容
        if (config['showStatistics'] == false && data['data'] != null) {
          if (data['data']['ledgers'] != null) {
            for (var ledger in data['data']['ledgers']) {
              ledger.remove('statistics');
            }
          }
          if (data['data']['statistics'] != null) {
            data['data'].remove('statistics');
          }
        }
        
        if (config['showAuditLog'] == false && data['data'] != null) {
          data['data'].remove('audit');
        }
        
        return http.Response(
          json.encode(data),
          response.statusCode,
          headers: response.headers,
        );
      }
      
      return response;
    } catch (e) {
      return response;
    }
  }

  /**
   * 清理資源
   * @version 2025-09-19-V2.4.0
   * @date 2025-09-19 12:00:00
   * @update: Gateway資源清理
   */
  void dispose() {
    _httpClient.close();
  }
}

// ================================
// 第二階段：資料模型類別定義
// ================================

/// 邀請請求類別
class InvitationRequest {
  final List<InvitationItem> invitations;
  
  InvitationRequest({required this.invitations});
  
  Map<String, dynamic> toMap() {
    return {
      'invitations': invitations.map((e) => e.toMap()).toList(),
    };
  }
}

/// 邀請項目類別
class InvitationItem {
  final String email;
  final String role;
  
  InvitationItem({required this.email, required this.role});
  
  Map<String, dynamic> toMap() {
    return {
      'email': email,
      'role': role,
    };
  }
}

/// 邀請結果類別
class InvitationResult {
  final String ledgerId;
  final List<InvitationResultItem> results;
  
  InvitationResult({required this.ledgerId, required this.results});
  
  static InvitationResult fromMap(Map<String, dynamic> map) {
    return InvitationResult(
      ledgerId: map['ledgerId'] ?? '',
      results: (map['results'] as List?)
          ?.map((e) => InvitationResultItem.fromMap(e))
          .toList() ?? [],
    );
  }
}

/// 邀請結果項目類別
class InvitationResultItem {
  final String email;
  final String status;
  final String? invitationId;
  
  InvitationResultItem({
    required this.email,
    required this.status,
    this.invitationId,
  });
  
  static InvitationResultItem fromMap(Map<String, dynamic> map) {
    return InvitationResultItem(
      email: map['email'] ?? '',
      status: map['status'] ?? '',
      invitationId: map['invitationId'],
    );
  }
}

/// 權限更新結果類別
class PermissionUpdateResult {
  final String ledgerId;
  final String userId;
  final String message;
  final DateTime updatedAt;
  
  PermissionUpdateResult({
    required this.ledgerId,
    required this.userId,
    required this.message,
    required this.updatedAt,
  });
  
  static PermissionUpdateResult fromMap(Map<String, dynamic> map) {
    return PermissionUpdateResult(
      ledgerId: map['ledgerId'] ?? '',
      userId: map['userId'] ?? '',
      message: map['message'] ?? '',
      updatedAt: DateTime.parse(map['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

/// 用戶權限詳情類別
class UserPermissionDetails {
  final String ledgerId;
  final String userId;
  final String role;
  final Map<String, bool> permissions;
  
  UserPermissionDetails({
    required this.ledgerId,
    required this.userId,
    required this.role,
    required this.permissions,
  });
  
  static UserPermissionDetails fromMap(Map<String, dynamic> map) {
    return UserPermissionDetails(
      ledgerId: map['ledgerId'] ?? '',
      userId: map['userId'] ?? '',
      role: map['role'] ?? '',
      permissions: Map<String, bool>.from(map['permissions'] ?? {}),
    );
  }
}

/// 用戶模式枚舉
enum UserMode {
  expert,
  inertial,
  cultivation,
  guiding,
}

// ================================
// 路由映射表
// ================================

/// API路由映射配置
class LedgerRoutes {
  static const Map<String, String> routes = {
    'GET /api/v1/ledgers': '/ledgers',
    'POST /api/v1/ledgers': '/ledgers',
    'GET /api/v1/ledgers/{id}': '/ledgers/{id}',
    'PUT /api/v1/ledgers/{id}': '/ledgers/{id}',
    'DELETE /api/v1/ledgers/{id}': '/ledgers/{id}',
    'GET /api/v1/ledgers/types': '/ledgers/types',
    'GET /api/v1/ledgers/{id}/collaborators': '/ledgers/{id}/collaborators',
    'POST /api/v1/ledgers/{id}/invitations': '/ledgers/{id}/invitations',
    'PUT /api/v1/ledgers/{id}/collaborators/{userId}': '/ledgers/{id}/collaborators/{userId}',
    'DELETE /api/v1/ledgers/{id}/collaborators/{userId}': '/ledgers/{id}/collaborators/{userId}',
    'GET /api/v1/ledgers/{id}/permissions': '/ledgers/{id}/permissions',
    'GET /api/v1/ledgers/{id}/conflicts': '/ledgers/{id}/conflicts',
    'POST /api/v1/ledgers/{id}/resolve-conflict': '/ledgers/{id}/resolve-conflict',
    'GET /api/v1/ledgers/{id}/audit-log': '/ledgers/{id}/audit-log',
  };
}
