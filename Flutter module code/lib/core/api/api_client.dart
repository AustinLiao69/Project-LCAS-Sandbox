
/**
 * API_Client_1.0.0
 * @module API客戶端模組
 * @description LCAS 2.0 核心API客戶端，處理所有HTTP請求
 * @update 2025-01-23: 建立版本，實作統一API請求處理機制
 */

import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';

import 'api_constants.dart';
import 'api_response.dart';
import '../auth/token_manager.dart';
import '../utils/logger.dart';

/// 01. 核心API客戶端類別
/// @version 2025-01-23-V1.0.0
/// @date 2025-01-23 11:30:00
/// @description 提供統一的API請求處理，包含認證、重試、錯誤處理等機制
class ApiClient {
  late final Dio _dio;
  final TokenManager _tokenManager;
  final AppLogger _logger;
  
  /// 請求攔截器
  late final InterceptorsWrapper _requestInterceptor;
  
  /// 回應攔截器
  late final InterceptorsWrapper _responseInterceptor;

  ApiClient({
    required TokenManager tokenManager,
    String? baseUrl,
  })  : _tokenManager = tokenManager,
        _logger = AppLogger() {
    _initializeDio(baseUrl);
    _setupInterceptors();
  }

  /// 02. 初始化Dio客戶端
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 設定Dio的基本配置，包含超時、基礎URL等
  void _initializeDio(String? baseUrl) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl ?? ApiConstants.baseUrl,
      connectTimeout: Duration(milliseconds: ApiConstants.connectionTimeout),
      receiveTimeout: Duration(milliseconds: ApiConstants.receiveTimeout),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'LCAS-Flutter-App/1.0.0',
      },
    ));

    // 在除錯模式下加入日誌攔截器
    if (kDebugMode) {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        requestHeader: true,
        responseHeader: false,
        error: true,
        logPrint: (obj) => _logger.debug(obj.toString()),
      ));
    }
  }

  /// 03. 設定請求攔截器
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 設定請求前的攔截處理，主要用於加入認證token
  void _setupInterceptors() {
    _requestInterceptor = InterceptorsWrapper(
      onRequest: (options, handler) async {
        // 加入認證token
        final token = await _tokenManager.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }

        // 加入請求ID用於追蹤
        options.headers['X-Request-ID'] = _generateRequestId();
        
        // 加入時間戳記
        options.headers['X-Timestamp'] = DateTime.now().toIso8601String();

        _logger.info('API請求: ${options.method} ${options.path}');
        handler.next(options);
      },
      onError: (error, handler) async {
        _logger.error('API請求錯誤: ${error.message}');
        
        // 處理401未授權錯誤，嘗試刷新token
        if (error.response?.statusCode == 401) {
          final refreshed = await _handleTokenRefresh(error, handler);
          if (refreshed) return;
        }
        
        handler.next(error);
      },
    );

    _responseInterceptor = InterceptorsWrapper(
      onResponse: (response, handler) {
        _logger.info('API回應: ${response.statusCode} ${response.requestOptions.path}');
        handler.next(response);
      },
      onError: (error, handler) {
        _logger.error('API錯誤: ${error.response?.statusCode} ${error.message}');
        handler.next(error);
      },
    );

    _dio.interceptors.addAll([_requestInterceptor, _responseInterceptor]);
  }

  /// 04. 處理Token刷新
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 當收到401錯誤時，嘗試使用refresh token取得新的access token
  Future<bool> _handleTokenRefresh(DioException error, ErrorInterceptorHandler handler) async {
    try {
      final refreshToken = await _tokenManager.getRefreshToken();
      if (refreshToken == null) return false;

      // 嘗試刷新token
      final response = await _dio.post(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
        options: Options(headers: {'Authorization': null}),
      );

      if (response.statusCode == 200) {
        final newToken = response.data['access_token'];
        final newRefreshToken = response.data['refresh_token'];
        
        // 儲存新的tokens
        await _tokenManager.saveTokens(newToken, newRefreshToken);
        
        // 重新執行原始請求
        final options = error.requestOptions;
        options.headers['Authorization'] = 'Bearer $newToken';
        
        final retryResponse = await _dio.fetch(options);
        handler.resolve(retryResponse);
        return true;
      }
    } catch (e) {
      _logger.error('Token刷新失敗: $e');
      // 清除無效tokens並導向登入頁面
      await _tokenManager.clearTokens();
    }
    
    return false;
  }

  /// 05. GET請求
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 發送GET請求並處理回應
  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.get(
        path,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );
      
      return _handleResponse<T>(response, fromJson);
    } catch (e) {
      throw _handleError(e);
    }
  }

  /// 06. POST請求
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 發送POST請求並處理回應
  Future<ApiResponse<T>> post<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        options: Options(headers: headers),
      );
      
      return _handleResponse<T>(response, fromJson);
    } catch (e) {
      throw _handleError(e);
    }
  }

  /// 07. PUT請求
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 發送PUT請求並處理回應
  Future<ApiResponse<T>> put<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.put(
        path,
        data: data,
        options: Options(headers: headers),
      );
      
      return _handleResponse<T>(response, fromJson);
    } catch (e) {
      throw _handleError(e);
    }
  }

  /// 08. DELETE請求
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 發送DELETE請求並處理回應
  Future<ApiResponse<T>> delete<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.delete(
        path,
        data: data,
        options: Options(headers: headers),
      );
      
      return _handleResponse<T>(response, fromJson);
    } catch (e) {
      throw _handleError(e);
    }
  }

  /// 09. 處理HTTP回應
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 統一處理HTTP回應，轉換為ApiResponse格式
  ApiResponse<T> _handleResponse<T>(
    Response response,
    T Function(dynamic)? fromJson,
  ) {
    final responseData = response.data;
    
    // 如果回應已經是ApiResponse格式
    if (responseData is Map<String, dynamic> && 
        responseData.containsKey('status')) {
      
      T? data;
      if (responseData['data'] != null && fromJson != null) {
        data = fromJson(responseData['data']);
      } else {
        data = responseData['data'] as T?;
      }
      
      return ApiResponse<T>(
        status: responseData['status'] ?? 'success',
        code: responseData['code'] ?? 'SUCCESS',
        message: responseData['message'] ?? '操作成功',
        data: data,
        timestamp: responseData['timestamp'] ?? DateTime.now().toIso8601String(),
        pagination: responseData['pagination'] != null 
            ? PaginationInfo.fromJson(responseData['pagination'])
            : null,
        metadata: responseData['metadata'],
      );
    }
    
    // 如果回應不是標準格式，包裝成成功回應
    T? data;
    if (fromJson != null && responseData != null) {
      data = fromJson(responseData);
    } else {
      data = responseData as T?;
    }
    
    return ApiResponse.success(
      data: data,
      message: '操作成功',
    );
  }

  /// 10. 處理錯誤
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 統一處理API請求錯誤，轉換為ApiException
  ApiException _handleError(dynamic error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return ApiException.timeout();
          
        case DioExceptionType.connectionError:
          return ApiException.networkError();
          
        case DioExceptionType.badResponse:
          final statusCode = error.response?.statusCode;
          final responseData = error.response?.data;
          
          String message = '請求失敗';
          String code = 'REQUEST_FAILED';
          
          if (responseData is Map<String, dynamic>) {
            message = responseData['message'] ?? message;
            code = responseData['code'] ?? code;
          }
          
          if (statusCode == 401) {
            return ApiException.unauthorized(message: message);
          }
          
          return ApiException(
            code: code,
            message: message,
            statusCode: statusCode,
          );
          
        default:
          return ApiException(
            code: 'UNKNOWN_ERROR',
            message: error.message ?? '未知錯誤',
          );
      }
    }
    
    return ApiException(
      code: 'UNKNOWN_ERROR',
      message: error.toString(),
    );
  }

  /// 11. 產生請求ID
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 產生唯一的請求識別碼用於追蹤
  String _generateRequestId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = (timestamp % 10000).toString().padLeft(4, '0');
    return 'req_${timestamp}_$random';
  }

  /// 12. 清理資源
  /// @version 2025-01-23-V1.0.0
  /// @date 2025-01-23 11:30:00
  /// @description 清理Dio客戶端資源
  void dispose() {
    _dio.close();
  }
}
