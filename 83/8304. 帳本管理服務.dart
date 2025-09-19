
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
