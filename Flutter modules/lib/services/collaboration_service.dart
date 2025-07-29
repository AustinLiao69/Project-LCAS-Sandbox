
/**
 * CollaborationService_協作服務模組_1.0.0
 * @module CollaborationService
 * @description 協作功能服務 - 共享帳本建立、多人協作權限管理、即時協作同步
 * @update 2025-01-23: 初版建立，實現完整協作管理功能
 */

import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/collaboration_models.dart';

class CollaborationService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  CollaborationService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  }) : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. 共享帳本建立
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 建立新的共享帳本並設定協作權限
   */
  Future<SharedLedgerResponse> createSharedLedger({
    required SharedLedgerRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/shared/create',
        data: request.toJson(),
      );

      if (response.success) {
        return SharedLedgerResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '共享帳本建立失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error, 
        context: '共享帳本建立',
        fallbackMessage: '無法建立共享帳本，請稍後重試'
      );
    }
  }

  /**
   * 02. 多人協作權限管理
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 管理共享帳本的成員權限設定
   */
  Future<PermissionResponse> managePermissions({
    required PermissionRequest request,
  }) async {
    try {
      final response = await _apiClient.put(
        '/app/shared/permissions',
        data: request.toJson(),
      );

      if (response.success) {
        return PermissionResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '權限管理操作失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '多人協作權限管理',
        fallbackMessage: '權限設定失敗，請檢查您的操作權限'
      );
    }
  }

  /**
   * 03. 即時協作同步
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 建立WebSocket連線進行即時協作同步
   */
  Future<RealtimeSyncResponse> realtimeSync({
    required RealtimeSyncRequest request,
  }) async {
    try {
      // 注意：實際的WebSocket實作需要額外的websocket套件
      // 這裡先實作HTTP polling的方式
      final response = await _apiClient.post(
        '/app/sync/realtime',
        data: request.toJson(),
      );

      if (response.success) {
        return RealtimeSyncResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '即時同步連線失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '即時協作同步',
        fallbackMessage: '無法建立即時同步連線'
      );
    }
  }

  /**
   * 04. 查詢協作清單
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 查詢使用者參與的協作帳本清單
   */
  Future<CollaborationListResponse> getCollaborations({
    CollaborationListRequest? request,
  }) async {
    try {
      final queryParams = request?.toQueryParams() ?? {};
      
      final response = await _apiClient.get(
        '/app/collaborations/list',
        queryParams: queryParams,
      );

      if (response.success) {
        return CollaborationListResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '協作清單查詢失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '查詢協作清單',
        fallbackMessage: '無法載入協作帳本清單'
      );
    }
  }

  /**
   * 05. 更新成員權限
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 更新特定成員在共享帳本中的權限
   */
  Future<UpdatePermissionResponse> updatePermission({
    required UpdatePermissionRequest request,
  }) async {
    try {
      final response = await _apiClient.put(
        '/app/shared/member/permission',
        data: request.toJson(),
      );

      if (response.success) {
        return UpdatePermissionResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '權限更新失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '更新成員權限',
        fallbackMessage: '無法更新成員權限設定'
      );
    }
  }

  /**
   * 06. 離開協作專案
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 使用者主動離開協作專案
   */
  Future<LeaveProjectResponse> leaveProject({
    required LeaveProjectRequest request,
  }) async {
    try {
      final response = await _apiClient.delete(
        '/app/shared/leave',
        data: request.toJson(),
      );

      if (response.success) {
        return LeaveProjectResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '離開專案失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '離開協作專案',
        fallbackMessage: '無法離開協作專案，請稍後重試'
      );
    }
  }

  /**
   * 07. 邀請成員加入
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 邀請新成員加入共享帳本
   */
  Future<InviteMemberResponse> inviteMember({
    required InviteMemberRequest request,
  }) async {
    try {
      final response = await _apiClient.post(
        '/app/shared/invite',
        data: request.toJson(),
      );

      if (response.success) {
        return InviteMemberResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '成員邀請失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '邀請成員加入',
        fallbackMessage: '無法邀請新成員，請檢查邀請資訊'
      );
    }
  }

  /**
   * 08. 查詢協作活動記錄
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 15:00:00
   * @description 查詢共享帳本的協作活動歷史記錄
   */
  Future<ActivityLogResponse> getActivityLog({
    required ActivityLogRequest request,
  }) async {
    try {
      final queryParams = request.toQueryParams();
      
      final response = await _apiClient.get(
        '/app/shared/activity',
        queryParams: queryParams,
      );

      if (response.success) {
        return ActivityLogResponse.fromJson(response.data);
      } else {
        throw Exception(response.message ?? '活動記錄查詢失敗');
      }
    } catch (error) {
      throw _errorHandler.handleError(
        error,
        context: '查詢協作活動記錄',
        fallbackMessage: '無法載入協作活動記錄'
      );
    }
  }
}
