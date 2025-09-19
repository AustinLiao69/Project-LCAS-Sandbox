/**
 * 8303. 記帳交易服務.dart
 * @module 記帳交易服務 - API Gateway
 * @version 2.3.0
 * @description LCAS 2.0 記帳交易服務 API Gateway - 純路由轉發，業務邏輯已移至PL層
 * @date 2025-01-29
 * @update 2025-01-29: 重構為純API Gateway，移除業務邏輯
 */

import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;

// ================================
// API Gateway 路由定義
// ================================

/// 記帳交易服務API Gateway
class TransactionAPIGateway {
  final String _backendBaseUrl = 'http://0.0.0.0:5000';
  final http.Client _httpClient = http.Client();

  /**
   * 01. LINE OA 快速記帳API路由 (POST /api/v1/transactions/quick)
   * @version 2025-01-28-V2.3.1
   * @date 2025-01-28 12:00:00
   * @update: 修正API端點路徑為與後端一致的/transactions/quick
   */
  Future<http.Response> quickBooking(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/transactions/quick',
      requestBody,
    );
  }

  /**
   * 02. 查詢交易記錄列表API路由 (GET /api/v1/transactions)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getTransactions(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    return await _forwardRequest(
      'GET',
      '/transactions?$queryString',
      null,
    );
  }

  /**
   * 03. 新增交易記錄API路由 (POST /api/v1/transactions)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> createTransaction(Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'POST',
      '/transactions',
      requestBody,
    );
  }

  /**
   * 04. 取得交易記錄詳情API路由 (GET /api/v1/transactions/{id})
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getTransactionDetail(String transactionId) async {
    return await _forwardRequest(
      'GET',
      '/transactions/$transactionId',
      null,
    );
  }

  /**
   * 05. 更新交易記錄API路由 (PUT /api/v1/transactions/{id})
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> updateTransaction(String transactionId, Map<String, dynamic> requestBody) async {
    return await _forwardRequest(
      'PUT',
      '/transactions/$transactionId',
      requestBody,
    );
  }

  /**
   * 06. 刪除交易記錄API路由 (DELETE /api/v1/transactions/{id})
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> deleteTransaction(String transactionId, Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    return await _forwardRequest(
      'DELETE',
      '/transactions/$transactionId?$queryString',
      null,
    );
  }

  /**
   * 07. 取得記帳主頁儀表板數據API路由 (GET /api/v1/transactions/dashboard)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getDashboard(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    return await _forwardRequest(
      'GET',
      '/transactions/dashboard?$queryString',
      null,
    );
  }

  /**
   * 08. 取得交易統計數據API路由 (GET /api/v1/transactions/statistics)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getStatistics(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    return await _forwardRequest(
      'GET',
      '/transactions/statistics?$queryString',
      null,
    );
  }

  /**
   * 09. 取得最近交易記錄API路由 (GET /api/v1/transactions/recent)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getRecentTransactions(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    return await _forwardRequest(
      'GET',
      '/transactions/recent?$queryString',
      null,
    );
  }

  /**
   * 10. 取得圖表數據API路由 (GET /api/v1/transactions/charts)
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: 純API Gateway實作，轉發至後端BL層
   */
  Future<http.Response> getChartData(Map<String, String> queryParams) async {
    final queryString = queryParams.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    return await _forwardRequest(
      'GET',
      '/transactions/charts?$queryString',
      null,
    );
  }

  // ================================
  // 私有方法：統一請求轉發機制
  // ================================

  /**
   * 統一請求轉發方法
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
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
   * @version 2025-01-29-V2.3.0
   * @date 2025-01-29 12:00:00
   * @update: Gateway資源清理
   */
  void dispose() {
    _httpClient.close();
  }
}

// ================================
// 路由映射表
// ================================

/// 記帳交易API路由映射配置
class TransactionRoutes {
  static const Map<String, String> routes = {
    'POST /api/v1/transactions/quick': '/transactions/quick',
    'GET /api/v1/transactions': '/transactions',
    'POST /api/v1/transactions': '/transactions',
    'GET /api/v1/transactions/{id}': '/transactions/{id}',
    'PUT /api/v1/transactions/{id}': '/transactions/{id}',
    'DELETE /api/v1/transactions/{id}': '/transactions/{id}',
    'GET /api/v1/transactions/dashboard': '/transactions/dashboard',
    'GET /api/v1/transactions/statistics': '/transactions/statistics',
    'GET /api/v1/transactions/recent': '/transactions/recent',
    'GET /api/v1/transactions/charts': '/transactions/charts',
  };
}