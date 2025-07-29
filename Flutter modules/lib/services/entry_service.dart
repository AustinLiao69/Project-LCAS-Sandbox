
/**
 * entry_service.dart_記帳服務_1.1.0
 * @module 記帳服務
 * @description LCAS 2.0 Flutter 記帳服務 - 記帳項目建立、查詢、科目管理、使用者設定
 * @update 2025-01-24: 升級至v1.1.0，增強核心記帳功能，完善業務邏輯實作
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/ledger_models.dart';
import '../models/auth_models.dart';

class EntryService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  EntryService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  })  : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. 建立記帳項目 - 新增收入或支出記錄
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 11:00:00
   * @description 建立新的記帳項目，支援多帳本記帳，增強資料驗證和業務邏輯處理
   */
  Future<ApiResponse<LedgerEntry>> createEntry(CreateEntryRequest request) async {
    try {
      // 增強資料驗證
      if (request.amount <= 0) {
        return ApiResponse<LedgerEntry>(
          success: false,
          data: null,
          message: '金額必須大於0',
          timestamp: DateTime.now(),
        );
      }

      if (request.description.trim().isEmpty) {
        return ApiResponse<LedgerEntry>(
          success: false,
          data: null,
          message: '記帳項目描述不能為空',
          timestamp: DateTime.now(),
        );
      }

      // 自動設定時間戳記
      final enhancedRequest = request.copyWith(
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final response = await _apiClient.post('/app/ledger/entry', data: enhancedRequest.toJson());
      
      if (response.data['success'] == true) {
        final entry = LedgerEntry.fromJson(response.data['data']);
        
        // 記錄成功操作
        debugPrint('記帳成功: ${entry.id}, 金額: ${entry.amount}, 類型: ${entry.type}');
        
        return ApiResponse<LedgerEntry>(
          success: true,
          data: entry,
          message: response.data['message'] ?? '記帳成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<LedgerEntry>(
          success: false,
          data: null,
          message: response.data['message'] ?? '記帳失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<LedgerEntry>(e, '建立記帳項目失敗');
    }
  }

  /**
   * 02. 查詢記帳記錄 - 根據條件查詢記帳歷史
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:00:00
   * @description 支援多條件查詢、分頁、排序和統計
   */
  Future<LedgerQueryResponse> queryEntries(LedgerQueryRequest request) async {
    try {
      final queryParams = request.toJson()
        ..removeWhere((key, value) => value == null);
      
      final response = await _apiClient.get('/app/ledger/query', queryParameters: queryParams);
      
      return LedgerQueryResponse.fromJson(response.data);
    } catch (e) {
      return LedgerQueryResponse(
        success: false,
        entries: [],
        summary: const LedgerSummary(
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          entryCount: 0,
        ),
        totalCount: 0,
        pageCount: 0,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 03. 取得科目代碼清單 - 取得所有可用的科目代碼
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:00:00
   * @description 取得分類的科目代碼，支援收入/支出分類
   */
  Future<SubjectListResponse> getSubjects({String? type}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (type != null) {
        queryParams['type'] = type;
      }
      
      final response = await _apiClient.get('/app/subjects/list', queryParameters: queryParams);
      
      return SubjectListResponse.fromJson(response.data);
    } catch (e) {
      return SubjectListResponse(
        success: false,
        subjects: [],
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 04. 更新使用者設定 - 修改記帳相關設定
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:00:00
   * @description 更新使用者的記帳偏好設定
   */
  Future<ApiResponse<UserSettings>> updateUserSettings(UserSettings settings) async {
    try {
      final response = await _apiClient.put('/app/user/settings', data: settings.toJson());
      
      if (response.data['success'] == true) {
        final updatedSettings = UserSettings.fromJson(response.data['data']);
        return ApiResponse<UserSettings>(
          success: true,
          data: updatedSettings,
          message: response.data['message'] ?? '設定更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<UserSettings>(
          success: false,
          data: null,
          message: response.data['message'] ?? '設定更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<UserSettings>(e, '更新使用者設定失敗');
    }
  }

  /**
   * 05. 取得記帳統計 - 取得指定期間的記帳統計
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:00:00
   * @description 快速取得統計資料，不含詳細記錄
   */
  Future<LedgerSummary> getEntrySummary({
    String? ledgerId,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (ledgerId != null) queryParams['ledgerId'] = ledgerId;
      if (startDate != null) queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();
      
      final response = await _apiClient.get('/app/ledger/summary', queryParameters: queryParams);
      
      if (response.data['success'] == true) {
        return LedgerSummary.fromJson(response.data['data']);
      } else {
        return const LedgerSummary(
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          entryCount: 0,
        );
      }
    } catch (e) {
      debugPrint('取得記帳統計失敗: $e');
      return const LedgerSummary(
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        entryCount: 0,
      );
    }
  }

  /**
   * 06. 更新記帳項目 - 修改既有的記帳記錄
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:00:00
   * @description 更新記帳項目資訊
   */
  Future<ApiResponse<LedgerEntry>> updateEntry(String entryId, CreateEntryRequest request) async {
    try {
      final response = await _apiClient.put('/app/ledger/entry/$entryId', data: request.toJson());
      
      if (response.data['success'] == true) {
        final entry = LedgerEntry.fromJson(response.data['data']);
        return ApiResponse<LedgerEntry>(
          success: true,
          data: entry,
          message: response.data['message'] ?? '記帳項目更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<LedgerEntry>(
          success: false,
          data: null,
          message: response.data['message'] ?? '記帳項目更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<LedgerEntry>(e, '更新記帳項目失敗');
    }
  }

  /**
   * 07. 刪除記帳項目 - 刪除指定的記帳記錄
   * @version 2025-01-24-V1.0.0
   * @date 2025-01-24 11:00:00
   * @description 軟刪除記帳項目，保留歷史記錄
   */
  Future<ApiResponse<bool>> deleteEntry(String entryId) async {
    try {
      final response = await _apiClient.delete('/app/ledger/entry/$entryId');
      
      return ApiResponse<bool>(
        success: response.data['success'] ?? false,
        data: response.data['success'] ?? false,
        message: response.data['message'] ?? '記帳項目刪除${response.data['success'] ? '成功' : '失敗'}',
        timestamp: DateTime.now(),
      );
    } catch (e) {
      return _errorHandler.handleApiError<bool>(e, '刪除記帳項目失敗');
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
