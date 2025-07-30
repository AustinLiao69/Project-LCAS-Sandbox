/**
 * ApiClient_核心API客戶端_2.2.0
 * @module API客戶端模組
 * @description LCAS 2.0 統一API調用客戶端 - 提供標準化HTTP請求處理
 * @update 2025-01-24: 升級至v2.2.0版本，修正建構子設計和回應處理機制
 */

import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:logging/logging.dart';
import 'token_manager.dart';
import 'error_handler.dart';
import 'constants.dart';

class ApiClient {
  static final Logger _logger = Logger('ApiClient');
  late final Dio _dio;
  final TokenManager _tokenManager;
  final ErrorHandler _errorHandler;

  // 單例模式
  static ApiClient? _instance;
  static ApiClient get instance {
    _instance ??= ApiClient._internal();
    return _instance!;
  }

  // 工廠建構子 - 支援依賴注入
  factory ApiClient({
    TokenManager? tokenManager,
    ErrorHandler? errorHandler,
  }) {
    if (_instance != null) {
      return _instance!;
    }
    return ApiClient._internal(
      tokenManager: tokenManager,
      errorHandler: errorHandler,
    );
  }

  ApiClient._internal({
    TokenManager? tokenManager,
    ErrorHandler? errorHandler,
  }) : _tokenManager = tokenManager ?? TokenManager.instance,
       _errorHandler = errorHandler ?? ErrorHandler.instance {
    _initializeDio();
  }

  /**
   * 01. 初始化Dio HTTP客戶端設定
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 配置HTTP客戶端基礎設定、攔截器和錯誤處理
   */
  void _initializeDio() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'LCAS-Flutter/${ApiConstants.appVersion}',
      },
    ));

    // 請求攔截器 - 自動添加認證Token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onResponse: _onResponse,
      onError: _onError,
    ));

    // 日誌攔截器 (僅在開發模式)
    if (kDebugMode) {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => _logger.info(obj.toString()),
      ));
    }
  }

  /**
   * 02. 請求攔截器 - 自動Token管理
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 在每個請求前自動添加認證Token和必要標頭
   */
  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      // 自動添加認證Token
      final token = await _tokenManager.getValidToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }

      // 添加請求追蹤ID
      options.headers['X-Request-ID'] = _generateRequestId();

      // 添加時間戳
      options.headers['X-Timestamp'] = DateTime.now().toIso8601String();

      _logger.info('API Request: ${options.method} ${options.path}');
      handler.next(options);
    } catch (e) {
      _logger.severe('請求攔截器錯誤: $e');
      handler.reject(DioException(
        requestOptions: options,
        error: e,
        type: DioExceptionType.unknown,
      ));
    }
  }

  /**
   * 03. 回應攔截器 - 統一回應處理
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 處理API回應並進行標準化格式驗證
   */
  void _onResponse(Response response, ResponseInterceptorHandler handler) {
    try {
      _logger.info('API Response: ${response.statusCode} ${response.requestOptions.path}');

      // 驗證回應格式
      if (response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;

        // 檢查是否為標準LCAS API回應格式
        if (data.containsKey('success') && data.containsKey('timestamp')) {
          _logger.fine('標準API回應格式驗證通過');
        } else {
          _logger.warning('非標準API回應格式: ${response.requestOptions.path}');
        }
      }

      handler.next(response);
    } catch (e) {
      _logger.severe('回應攔截器錯誤: $e');
      handler.next(response);
    }
  }

  /**
   * 04. 錯誤攔截器 - 統一錯誤處理
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 處理API錯誤並提供統一錯誤回應格式
   */
  Future<void> _onError(DioException error, ErrorInterceptorHandler handler) async {
    try {
      _logger.severe('API Error: ${error.type} ${error.requestOptions.path}');

      // Token過期處理
      if (error.response?.statusCode == 401) {
        final refreshed = await _tokenManager.refreshToken();
        if (refreshed) {
          // 重新發送原始請求
          final clonedRequest = await _dio.fetch(error.requestOptions);
          handler.resolve(clonedRequest);
          return;
        }
      }

      // 使用統一錯誤處理器
      final handledError = await _errorHandler.handleDioError(error);
      handler.reject(handledError);
    } catch (e) {
      _logger.severe('錯誤攔截器處理失敗: $e');
      handler.reject(error);
    }
  }

  /**
   * 05. GET請求方法 - 支援標準化回應
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 執行標準化GET請求並返回統一格式
   */
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.get(
        path,
        queryParameters: queryParameters,
        options: Options(headers: headers),
      );

      return response;
    } catch (e) {
      _logger.severe('GET請求失敗: $path, 錯誤: $e');
      rethrow;
    }
  }

  /**
   * 06. POST請求方法 - 支援標準化回應
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 執行標準化POST請求並返回統一格式
   */
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        options: Options(headers: headers),
      );

      return response;
    } catch (e) {
      _logger.severe('POST請求失敗: $path, 錯誤: $e');
      rethrow;
    }
  }

  /**
   * 07. PUT請求方法 - 支援標準化回應
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 執行標準化PUT請求並返回統一格式
   */
  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.put(
        path,
        data: data,
        options: Options(headers: headers),
      );

      return response;
    } catch (e) {
      _logger.severe('PUT請求失敗: $path, 錯誤: $e');
      rethrow;
    }
  }

  /**
   * 08. DELETE請求方法 - 支援標準化回應
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 執行標準化DELETE請求並返回統一格式
   */
  Future<Response> delete(
    String path, {
    Map<String, String>? headers,
  }) async {
    try {
      final response = await _dio.delete(
        path,
        options: Options(headers: headers),
      );

      return response;
    } catch (e) {
      _logger.severe('DELETE請求失敗: $path, 錯誤: $e');
      rethrow;
    }
  }

  /**
   * 09. 生成請求追蹤ID
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 為每個請求生成唯一追蹤ID
   */
  String _generateRequestId() {
    return 'req_${DateTime.now().millisecondsSinceEpoch}_${DateTime.now().microsecond}';
  }

  /**
   * 10. 清理資源方法
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 12:30:00
   * @description 清理HTTP客戶端資源
   */
  void dispose() {
    _dio.close();
    _logger.info('ApiClient 資源已清理');
  }
}