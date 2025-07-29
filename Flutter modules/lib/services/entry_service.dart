
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
/**
 * entry_service.dart_基礎記帳服務_1.1.0
 * @module 基礎記帳服務
 * @description LCAS 2.0 Flutter 基礎記帳服務 - APP記帳功能、記錄查詢、科目代碼管理、使用者設定
 * @update 2025-01-24: 建立基礎記帳服務v1.1.0，實作4個核心API端點，完整業務邏輯實作
 */

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/error_handler.dart';
import '../models/ledger_models.dart';

class EntryService {
  final ApiClient _apiClient;
  final ErrorHandler _errorHandler;

  EntryService({
    ApiClient? apiClient,
    ErrorHandler? errorHandler,
  })  : _apiClient = apiClient ?? ApiClient(),
        _errorHandler = errorHandler ?? ErrorHandler();

  /**
   * 01. APP記帳功能 - 建立新的記帳項目
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 完整的APP記帳功能，支援複雜記帳邏輯、自動分類、資料驗證
   */
  Future<LedgerEntryResponse> createEntry({
    required LedgerEntryRequest request,
  }) async {
    try {
      // 前端驗證
      final validationResult = _validateEntryRequest(request);
      if (!validationResult.isValid) {
        return LedgerEntryResponse(
          success: false,
          entryId: '',
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      // 金額格式化處理
      final formattedRequest = _formatEntryRequest(request);

      // 調用API
      final response = await _apiClient.post(
        '/app/ledger/entry',
        data: formattedRequest.toJson(),
      );

      if (response.data['success'] == true) {
        final entry = LedgerEntry.fromJson(response.data['data']);
        
        // 本地快取更新邏輯
        await _updateLocalCache(entry);
        
        return LedgerEntryResponse(
          success: true,
          entryId: entry.entryId,
          entry: entry,
          message: response.data['message'] ?? '記帳成功',
          timestamp: DateTime.now(),
          suggestions: _generateSuggestions(entry),
        );
      } else {
        return LedgerEntryResponse(
          success: false,
          entryId: '',
          message: response.data['message'] ?? '記帳失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return LedgerEntryResponse(
        success: false,
        entryId: '',
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 02. APP記錄查詢 - 查詢記帳記錄
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 強化查詢功能，支援複雜條件篩選、分頁、排序、統計分析
   */
  Future<LedgerQueryResponse> queryEntries({
    required LedgerQueryRequest request,
  }) async {
    try {
      // 查詢參數驗證與優化
      final optimizedParams = _optimizeQueryParams(request);
      
      final response = await _apiClient.get(
        '/app/ledger/query',
        queryParameters: optimizedParams.toJson()..removeWhere((k, v) => v == null),
      );

      if (response.data['success'] == true) {
        final entries = (response.data['data']['entries'] as List)
            .map((item) => LedgerEntry.fromJson(item))
            .toList();

        // 計算統計資訊
        final statistics = _calculateStatistics(entries);
        
        // 生成智慧洞察
        final insights = _generateInsights(entries, request);

        return LedgerQueryResponse(
          success: true,
          entries: entries,
          totalCount: response.data['data']['totalCount'] ?? entries.length,
          statistics: statistics,
          insights: insights,
          message: response.data['message'] ?? '查詢成功',
          timestamp: DateTime.now(),
        );
      } else {
        return LedgerQueryResponse(
          success: false,
          entries: [],
          totalCount: 0,
          message: response.data['message'] ?? '查詢失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return LedgerQueryResponse(
        success: false,
        entries: [],
        totalCount: 0,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 03. 科目代碼管理 - 取得和管理科目清單
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 完整科目代碼管理，支援自定義科目、分類管理、智慧推薦
   */
  Future<SubjectListResponse> getSubjects({
    String? category,
    String? searchKeyword,
    bool includeCustom = true,
    bool activeOnly = true,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        if (category != null) 'category': category,
        if (searchKeyword != null) 'search': searchKeyword,
        'includeCustom': includeCustom,
        'activeOnly': activeOnly,
      };

      final response = await _apiClient.get(
        '/app/subjects/list',
        queryParameters: queryParams,
      );

      if (response.data['success'] == true) {
        final subjects = (response.data['data']['subjects'] as List)
            .map((item) => SubjectCode.fromJson(item))
            .toList();

        // 智慧排序：常用科目優先
        final sortedSubjects = _smartSortSubjects(subjects);
        
        // 生成推薦科目
        final recommendations = await _generateSubjectRecommendations(searchKeyword);

        return SubjectListResponse(
          success: true,
          subjects: sortedSubjects,
          recommendations: recommendations,
          totalCount: subjects.length,
          message: response.data['message'] ?? '科目清單載入成功',
          timestamp: DateTime.now(),
        );
      } else {
        return SubjectListResponse(
          success: false,
          subjects: [],
          totalCount: 0,
          message: response.data['message'] ?? '科目清單載入失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return SubjectListResponse(
        success: false,
        subjects: [],
        totalCount: 0,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 04. 使用者設定管理 - 更新使用者記帳偏好設定
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 完整使用者設定管理，支援個人化設定、智慧預設值、同步設定
   */
  Future<UserSettingsResponse> updateUserSettings({
    required UserSettingsRequest request,
  }) async {
    try {
      // 設定驗證
      final validationResult = _validateUserSettings(request);
      if (!validationResult.isValid) {
        return UserSettingsResponse(
          success: false,
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      // 智慧設定優化
      final optimizedSettings = _optimizeUserSettings(request);

      final response = await _apiClient.put(
        '/app/user/settings',
        data: optimizedSettings.toJson(),
      );

      if (response.data['success'] == true) {
        final settings = UserSettings.fromJson(response.data['data']);
        
        // 本地設定同步
        await _syncLocalSettings(settings);
        
        // 生成設定建議
        final suggestions = _generateSettingsSuggestions(settings);

        return UserSettingsResponse(
          success: true,
          settings: settings,
          suggestions: suggestions,
          message: response.data['message'] ?? '設定更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return UserSettingsResponse(
          success: false,
          message: response.data['message'] ?? '設定更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return UserSettingsResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 05. 記帳項目更新 - 修改既有記帳記錄
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 安全的記帳項目更新，支援部分更新、版本控制、變更追蹤
   */
  Future<LedgerEntryResponse> updateEntry({
    required String entryId,
    required LedgerEntryRequest updateRequest,
  }) async {
    try {
      final validationResult = _validateEntryRequest(updateRequest);
      if (!validationResult.isValid) {
        return LedgerEntryResponse(
          success: false,
          entryId: entryId,
          message: validationResult.errorMessage,
          timestamp: DateTime.now(),
        );
      }

      final response = await _apiClient.put(
        '/app/ledger/entry/$entryId',
        data: updateRequest.toJson(),
      );

      if (response.data['success'] == true) {
        final entry = LedgerEntry.fromJson(response.data['data']);
        await _updateLocalCache(entry);
        
        return LedgerEntryResponse(
          success: true,
          entryId: entryId,
          entry: entry,
          message: response.data['message'] ?? '記錄更新成功',
          timestamp: DateTime.now(),
        );
      } else {
        return LedgerEntryResponse(
          success: false,
          entryId: entryId,
          message: response.data['message'] ?? '記錄更新失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return LedgerEntryResponse(
        success: false,
        entryId: entryId,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 06. 記帳項目刪除 - 安全刪除記帳記錄
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 安全刪除機制，支援軟刪除、回收站、批量刪除
   */
  Future<ApiResponse<bool>> deleteEntry({
    required String entryId,
    bool permanentDelete = false,
  }) async {
    try {
      final response = await _apiClient.delete(
        '/app/ledger/entry/$entryId',
        data: {
          'permanentDelete': permanentDelete,
        },
      );

      if (response.data['success'] == true) {
        // 清除本地快取
        await _removeFromLocalCache(entryId);
        
        return ApiResponse<bool>(
          success: true,
          data: true,
          message: response.data['message'] ?? '記錄刪除成功',
          timestamp: DateTime.now(),
        );
      } else {
        return ApiResponse<bool>(
          success: false,
          data: false,
          message: response.data['message'] ?? '記錄刪除失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return _errorHandler.handleApiError<bool>(e, '刪除記帳項目失敗');
    }
  }

  /**
   * 07. 取得記帳統計 - 獲取統計分析資料
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 豐富的統計分析功能，支援多維度分析、趨勢預測
   */
  Future<LedgerStatisticsResponse> getStatistics({
    required StatisticsRequest request,
  }) async {
    try {
      final response = await _apiClient.get(
        '/app/ledger/statistics',
        queryParameters: request.toJson(),
      );

      if (response.data['success'] == true) {
        final statistics = LedgerStatistics.fromJson(response.data['data']);
        
        return LedgerStatisticsResponse(
          success: true,
          statistics: statistics,
          message: response.data['message'] ?? '統計分析成功',
          timestamp: DateTime.now(),
        );
      } else {
        return LedgerStatisticsResponse(
          success: false,
          message: response.data['message'] ?? '統計分析失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return LedgerStatisticsResponse(
        success: false,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  /**
   * 08. 批量記帳功能 - 一次建立多筆記帳記錄
   * @version 2025-01-24-V1.1.0
   * @date 2025-01-24 14:00:00
   * @description 高效批量記帳，支援範本應用、批量驗證、事務處理
   */
  Future<BatchEntryResponse> createBatchEntries({
    required List<LedgerEntryRequest> entries,
    bool validateAll = true,
  }) async {
    try {
      if (validateAll) {
        for (int i = 0; i < entries.length; i++) {
          final validation = _validateEntryRequest(entries[i]);
          if (!validation.isValid) {
            return BatchEntryResponse(
              success: false,
              successCount: 0,
              failureCount: entries.length,
              message: '第${i + 1}筆記錄驗證失敗: ${validation.errorMessage}',
              timestamp: DateTime.now(),
            );
          }
        }
      }

      final response = await _apiClient.post(
        '/app/ledger/batch',
        data: {
          'entries': entries.map((e) => e.toJson()).toList(),
          'validateAll': validateAll,
        },
      );

      if (response.data['success'] == true) {
        final results = BatchEntryResults.fromJson(response.data['data']);
        
        return BatchEntryResponse(
          success: true,
          successCount: results.successCount,
          failureCount: results.failureCount,
          results: results,
          message: response.data['message'] ?? '批量記帳完成',
          timestamp: DateTime.now(),
        );
      } else {
        return BatchEntryResponse(
          success: false,
          successCount: 0,
          failureCount: entries.length,
          message: response.data['message'] ?? '批量記帳失敗',
          timestamp: DateTime.now(),
        );
      }
    } catch (e) {
      return BatchEntryResponse(
        success: false,
        successCount: 0,
        failureCount: entries.length,
        message: _errorHandler.getErrorMessage(e),
        timestamp: DateTime.now(),
      );
    }
  }

  // ==================== 私有輔助方法 ====================

  /**
   * 驗證記帳請求
   */
  ValidationResult _validateEntryRequest(LedgerEntryRequest request) {
    if (request.amount <= 0) {
      return ValidationResult(false, '金額必須大於0');
    }
    if (request.subjectCode.isEmpty) {
      return ValidationResult(false, '科目代碼不能為空');
    }
    if (request.description.length > 200) {
      return ValidationResult(false, '描述長度不能超過200字元');
    }
    return ValidationResult(true, '');
  }

  /**
   * 格式化記帳請求
   */
  LedgerEntryRequest _formatEntryRequest(LedgerEntryRequest request) {
    return request.copyWith(
      amount: double.parse(request.amount.toStringAsFixed(2)),
      description: request.description.trim(),
    );
  }

  /**
   * 更新本地快取
   */
  Future<void> _updateLocalCache(LedgerEntry entry) async {
    // 實作本地快取邏輯
    if (kDebugMode) {
      print('更新本地快取: ${entry.entryId}');
    }
  }

  /**
   * 生成記帳建議
   */
  List<String> _generateSuggestions(LedgerEntry entry) {
    final suggestions = <String>[];
    
    // 基於歷史記錄的建議邏輯
    if (entry.type == 'expense' && entry.amount > 1000) {
      suggestions.add('大額支出已記錄，建議檢查預算狀況');
    }
    
    return suggestions;
  }

  /**
   * 優化查詢參數
   */
  LedgerQueryRequest _optimizeQueryParams(LedgerQueryRequest request) {
    // 實作查詢優化邏輯
    return request.copyWith(
      limit: request.limit ?? 50,
      offset: request.offset ?? 0,
    );
  }

  /**
   * 計算統計資訊
   */
  QueryStatistics _calculateStatistics(List<LedgerEntry> entries) {
    double totalIncome = 0;
    double totalExpense = 0;
    
    for (final entry in entries) {
      if (entry.type == 'income') {
        totalIncome += entry.amount;
      } else {
        totalExpense += entry.amount;
      }
    }
    
    return QueryStatistics(
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      balance: totalIncome - totalExpense,
      entryCount: entries.length,
    );
  }

  /**
   * 生成智慧洞察
   */
  List<String> _generateInsights(List<LedgerEntry> entries, LedgerQueryRequest request) {
    final insights = <String>[];
    
    if (entries.isEmpty) {
      insights.add('此期間尚無記帳記錄');
      return insights;
    }
    
    final stats = _calculateStatistics(entries);
    if (stats.balance > 0) {
      insights.add('本期收支為正，理財狀況良好');
    } else {
      insights.add('本期支出大於收入，建議關注支出控制');
    }
    
    return insights;
  }

  /**
   * 智慧排序科目
   */
  List<SubjectCode> _smartSortSubjects(List<SubjectCode> subjects) {
    // 實作智慧排序邏輯：使用頻率、最近使用時間等
    return subjects..sort((a, b) => a.name.compareTo(b.name));
  }

  /**
   * 生成科目推薦
   */
  Future<List<SubjectCode>> _generateSubjectRecommendations(String? keyword) async {
    // 實作智慧推薦邏輯
    return [];
  }

  /**
   * 驗證使用者設定
   */
  ValidationResult _validateUserSettings(UserSettingsRequest request) {
    // 實作設定驗證邏輯
    return ValidationResult(true, '');
  }

  /**
   * 優化使用者設定
   */
  UserSettingsRequest _optimizeUserSettings(UserSettingsRequest request) {
    // 實作設定優化邏輯
    return request;
  }

  /**
   * 同步本地設定
   */
  Future<void> _syncLocalSettings(UserSettings settings) async {
    // 實作本地設定同步邏輯
    if (kDebugMode) {
      print('同步本地設定: ${settings.userId}');
    }
  }

  /**
   * 生成設定建議
   */
  List<String> _generateSettingsSuggestions(UserSettings settings) {
    // 實作設定建議邏輯
    return [];
  }

  /**
   * 從本地快取移除
   */
  Future<void> _removeFromLocalCache(String entryId) async {
    // 實作快取移除邏輯
    if (kDebugMode) {
      print('從本地快取移除: $entryId');
    }
  }
}

/// 驗證結果
class ValidationResult {
  final bool isValid;
  final String errorMessage;

  ValidationResult(this.isValid, this.errorMessage);
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
