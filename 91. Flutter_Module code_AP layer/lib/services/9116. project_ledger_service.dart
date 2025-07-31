
/**
 * project_ledger_service.dart_專案帳本服務_1.0.0
 * @module 專案帳本服務
 * @description LCAS 2.0 Flutter 專案帳本服務 - 專案管理、分類管理、多帳本切換
 * @update 2025-01-24: 建立專案帳本服務，實作6個API端點
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/project_models.dart';

class ProjectLedgerService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  ProjectLedgerService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  })  : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. 專案帳本建立 - F031 API端點實作
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 對應F031功能，建立新的專案帳本
   */
  Future<ApiResponse<Project>> createProject(CreateProjectRequest request) async {
    try {
      final response = await _apiClient.post('/app/projects/create', data: request.toJson());
      
      if (response.data['success'] == true) {
        final project = Project.fromJson(response.data['data']);
        return ApiResponse<Project>(
          success: true,
          data: project,
          message: response.data['message'] ?? '專案建立成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<Project>(
          success: false,
          data: null,
          message: response.data['message'] ?? '專案建立失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<Project>(e, '建立專案帳本失敗');
    }
  }

  /**
   * 02. 專案帳本管理 - F032 API端點實作
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 對應F032功能，更新專案的基本資訊、設定和權限
   */
  Future<ApiResponse<Project>> manageProject(String projectId, CreateProjectRequest request) async {
    try {
      final response = await _apiClient.put('/app/projects/manage', data: {
        'projectId': projectId,
        ...request.toJson(),
      });
      
      if (response.data['success'] == true) {
        final project = Project.fromJson(response.data['data']);
        return ApiResponse<Project>(
          success: true,
          data: project,
          message: response.data['message'] ?? '專案更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<Project>(
          success: false,
          data: null,
          message: response.data['message'] ?? '專案更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<Project>(e, '管理專案帳本失敗');
    }
  }

  /**
   * 03. 刪除專案帳本 - 刪除指定的專案帳本
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 刪除專案帳本，包含相關記帳資料
   */
  Future<ApiResponse<bool>> deleteProject(String projectId) async {
    try {
      final response = await _apiClient.delete('/app/projects/delete', data: {
        'projectId': projectId,
        'confirmDelete': true,
      });
      
      return ApiResponse<bool>(
        success: response.data['success'] ?? false,
        data: response.data['success'] ?? false,
        message: response.data['message'] ?? '專案刪除${response.data['success'] ? '成功' : '失敗'}',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      return _errorHandler.handleApiError<bool>(e, '刪除專案帳本失敗');
    }
  }

  /**
   * 04. 建立分類帳本 - 新建分類別帳本
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 建立分類帳本，支援自動分類規則
   */
  Future<ApiResponse<CategoryLedger>> createCategory(CreateCategoryRequest request) async {
    try {
      final response = await _apiClient.post('/app/categories/create', data: request.toJson());
      
      if (response.data['success'] == true) {
        final category = CategoryLedger.fromJson(response.data['data']);
        return ApiResponse<CategoryLedger>(
          success: true,
          data: category,
          message: response.data['message'] ?? '分類建立成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<CategoryLedger>(
          success: false,
          data: null,
          message: response.data['message'] ?? '分類建立失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<CategoryLedger>(e, '建立分類帳本失敗');
    }
  }

  /**
   * 05. 管理分類帳本 - 更新分類設定和規則
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 更新分類的設定、規則和自動分類邏輯
   */
  Future<ApiResponse<CategoryLedger>> manageCategory(String categoryId, CreateCategoryRequest request) async {
    try {
      final response = await _apiClient.put('/app/categories/manage', data: {
        'categoryId': categoryId,
        ...request.toJson(),
      });
      
      if (response.data['success'] == true) {
        final category = CategoryLedger.fromJson(response.data['data']);
        return ApiResponse<CategoryLedger>(
          success: true,
          data: category,
          message: response.data['message'] ?? '分類更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<CategoryLedger>(
          success: false,
          data: null,
          message: response.data['message'] ?? '分類更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<CategoryLedger>(e, '管理分類帳本失敗');
    }
  }

  /**
   * 06. 切換帳本 - 在不同帳本間切換
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 切換到指定的帳本，更新當前作業環境
   */
  Future<SwitchLedgerResponse> switchLedger(SwitchLedgerRequest request) async {
    try {
      final response = await _apiClient.get('/app/ledgers/switch', queryParameters: request.toJson());
      
      return SwitchLedgerResponse.fromJson(response.data);
    } catch (e) {
      return SwitchLedgerResponse(
        success: false,
        currentLedgerId: '',
        ledgerName: '',
        ledgerType: '',
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 07. 取得專案清單 - 取得使用者的所有專案
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 取得使用者擁有或參與的專案清單
   */
  Future<ProjectListResponse> getProjects({
    String? status,
    String? type,
    int? limit,
    int? offset,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;
      if (type != null) queryParams['type'] = type;
      if (limit != null) queryParams['limit'] = limit;
      if (offset != null) queryParams['offset'] = offset;
      
      final response = await _apiClient.get('/app/projects/list', queryParameters: queryParams);
      
      return ProjectListResponse.fromJson(response.data);
    } catch (e) {
      return ProjectListResponse(
        success: false,
        projects: [],
        totalCount: 0,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 08. 取得專案詳情 - 取得指定專案的詳細資訊
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 取得專案的完整資訊，包含成員和設定
   */
  Future<ApiResponse<Project>> getProjectDetails(String projectId) async {
    try {
      final response = await _apiClient.get('/app/projects/$projectId');
      
      if (response.data['success'] == true) {
        final project = Project.fromJson(response.data['data']);
        return ApiResponse<Project>(
          success: true,
          data: project,
          message: response.data['message'] ?? '取得專案詳情成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<Project>(
          success: false,
          data: null,
          message: response.data['message'] ?? '取得專案詳情失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<Project>(e, '取得專案詳情失敗');
    }
  }

  /**
   * 09. 邀請專案成員 - 邀請使用者加入專案
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 邀請使用者加入專案，設定初始權限
   */
  Future<ApiResponse<bool>> inviteProjectMember(
    String projectId,
    String email,
    String role,
  ) async {
    try {
      final response = await _apiClient.post('/app/projects/$projectId/invite', data: {
        'email': email,
        'role': role,
      });
      
      return ApiResponse<bool>(
        success: response.data['success'] ?? false,
        data: response.data['success'] ?? false,
        message: response.data['message'] ?? '邀請${response.data['success'] ? '成功' : '失敗'}',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      return _errorHandler.handleApiError<bool>(e, '邀請專案成員失敗');
    }
  }

  /**
   * 10. 移除專案成員 - 從專案中移除成員
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:30:00
   * @description 移除專案成員，需要適當權限
   */
  Future<ApiResponse<bool>> removeProjectMember(
    String projectId,
    String userId,
  ) async {
    try {
      final response = await _apiClient.delete('/app/projects/$projectId/members/$userId');
      
      return ApiResponse<bool>(
        success: response.data['success'] ?? false,
        data: response.data['success'] ?? false,
        message: response.data['message'] ?? '移除成員${response.data['success'] ? '成功' : '失敗'}',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      return _errorHandler.handleApiError<bool>(e, '移除專案成員失敗');
    }
  }
}

/// 通用API回應模型
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String message;
  final DateTime timestamp;

  const ApiResponse({
    required this.success,
    this.data,
    required this.message,
    required this.timestamp,
  });
}
