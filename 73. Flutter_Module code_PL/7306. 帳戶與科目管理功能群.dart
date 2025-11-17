
/**
 * 7306. 帳戶與科目管理功能群.dart
 * @module 帳戶與科目管理功能群
 * @description LCAS 2.0 Phase 3 帳戶與科目管理業務邏輯模組
 * @version V1.0.0
 * @date 2025-11-17
 * @author LCAS Development Team
 * @update 階段一：核心帳戶管理函數實作（4個函數）
 */

// =============== 基礎依賴導入 ===============
import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;

// =============== 資料模型定義 ===============

/// 帳戶資料模型
class WalletModel {
  final String walletId;
  final String walletName;
  final String walletType;
  final double balance;
  final String currency;
  final bool isActive;
  final String ledgerId;
  final DateTime createdAt;
  final DateTime updatedAt;

  WalletModel({
    required this.walletId,
    required this.walletName,
    required this.walletType,
    required this.balance,
    required this.currency,
    required this.isActive,
    required this.ledgerId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    return WalletModel(
      walletId: json['walletId'] ?? '',
      walletName: json['walletName'] ?? '',
      walletType: json['walletType'] ?? 'cash',
      balance: (json['balance'] ?? 0.0).toDouble(),
      currency: json['currency'] ?? 'TWD',
      isActive: json['isActive'] ?? true,
      ledgerId: json['ledgerId'] ?? '',
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'walletId': walletId,
      'walletName': walletName,
      'walletType': walletType,
      'balance': balance,
      'currency': currency,
      'isActive': isActive,
      'ledgerId': ledgerId,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}

/// 科目資料模型
class CategoryModel {
  final String categoryId;
  final String categoryName;
  final String categoryType;
  final String? parentId;
  final int level;
  final String ledgerId;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  CategoryModel({
    required this.categoryId,
    required this.categoryName,
    required this.categoryType,
    this.parentId,
    required this.level,
    required this.ledgerId,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      categoryId: json['categoryId'] ?? '',
      categoryName: json['categoryName'] ?? '',
      categoryType: json['categoryType'] ?? 'expense',
      parentId: json['parentId'],
      level: json['level'] ?? 1,
      ledgerId: json['ledgerId'] ?? '',
      isActive: json['isActive'] ?? true,
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }
}

/// API回應模型
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final int? errorCode;

  ApiResponse({
    required this.success,
    this.data,
    this.message,
    this.errorCode,
  });

  factory ApiResponse.fromJson(Map<String, dynamic> json, T Function(dynamic)? fromJsonT) {
    return ApiResponse<T>(
      success: json['success'] ?? false,
      data: json['data'] != null && fromJsonT != null ? fromJsonT(json['data']) : null,
      message: json['message'],
      errorCode: json['errorCode'],
    );
  }
}

// =============== 階段一：核心帳戶管理函數（4個函數） ===============

class WalletCategoryManager {
  // APL Gateway基礎URL配置
  static const String _baseUrl = 'http://0.0.0.0:3000/api/v1';
  
  // HTTP客戶端配置
  static final http.Client _httpClient = http.Client();
  
  // 請求標頭配置
  static const Map<String, String> _headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  /**
   * 01. 取得帳戶清單
   * @version 2025-11-17-V1.0.0
   * @date 2025-11-17
   * @update: 階段一核心實作 - 基本帳戶清單載入
   */
  static Future<ApiResponse<List<WalletModel>>> getWalletList(String ledgerId) async {
    try {
      // 參數驗證
      if (ledgerId.isEmpty) {
        return ApiResponse<List<WalletModel>>(
          success: false,
          message: '帳本ID不能為空',
          errorCode: 400,
        );
      }

      // 構建API請求URL
      final String apiUrl = '$_baseUrl/accounts?ledgerId=$ledgerId';
      
      // 發送HTTP GET請求
      final http.Response response = await _httpClient.get(
        Uri.parse(apiUrl),
        headers: _headers,
      ).timeout(const Duration(seconds: 10));

      // 解析HTTP回應
      final Map<String, dynamic> responseBody = json.decode(response.body);
      
      // 檢查API回應狀態
      if (response.statusCode == 200 && responseBody['success'] == true) {
        // 解析帳戶清單資料
        final List<dynamic> walletsData = responseBody['data'] ?? [];
        final List<WalletModel> wallets = walletsData
            .map((walletJson) => WalletModel.fromJson(walletJson))
            .toList();

        return ApiResponse<List<WalletModel>>(
          success: true,
          data: wallets,
          message: '帳戶清單載入成功',
        );
      } else {
        return ApiResponse<List<WalletModel>>(
          success: false,
          message: responseBody['message'] ?? 'API回應異常',
          errorCode: response.statusCode,
        );
      }

    } catch (e) {
      return ApiResponse<List<WalletModel>>(
        success: false,
        message: '取得帳戶清單失敗: $e',
        errorCode: 500,
      );
    }
  }

  /**
   * 02. 建立新帳戶
   * @version 2025-11-17-V1.0.0
   * @date 2025-11-17
   * @update: 階段一核心實作 - 基本帳戶建立功能
   */
  static Future<ApiResponse<WalletModel>> createWallet(
    String ledgerId,
    String walletName, 
    String walletType, 
    String currency
  ) async {
    try {
      // 參數驗證
      if (ledgerId.isEmpty) {
        return ApiResponse<WalletModel>(
          success: false,
          message: '帳本ID不能為空',
          errorCode: 400,
        );
      }
      
      if (walletName.isEmpty) {
        return ApiResponse<WalletModel>(
          success: false,
          message: '帳戶名稱不能為空',
          errorCode: 400,
        );
      }

      // 驗證帳戶類型
      final List<String> validWalletTypes = ['cash', 'bank', 'credit', 'ewallet'];
      if (!validWalletTypes.contains(walletType)) {
        return ApiResponse<WalletModel>(
          success: false,
          message: '無效的帳戶類型',
          errorCode: 400,
        );
      }

      // 構建請求資料
      final Map<String, dynamic> requestData = {
        'ledgerId': ledgerId,
        'walletName': walletName,
        'walletType': walletType,
        'currency': currency.isNotEmpty ? currency : 'TWD',
        'initialBalance': 0.0,
        'isActive': true,
      };

      // 構建API請求URL
      final String apiUrl = '$_baseUrl/accounts';
      
      // 發送HTTP POST請求
      final http.Response response = await _httpClient.post(
        Uri.parse(apiUrl),
        headers: _headers,
        body: json.encode(requestData),
      ).timeout(const Duration(seconds: 10));

      // 解析HTTP回應
      final Map<String, dynamic> responseBody = json.decode(response.body);
      
      // 檢查API回應狀態
      if (response.statusCode == 200 && responseBody['success'] == true) {
        // 解析建立的帳戶資料
        final WalletModel wallet = WalletModel.fromJson(responseBody['data']);

        return ApiResponse<WalletModel>(
          success: true,
          data: wallet,
          message: '帳戶建立成功',
        );
      } else {
        return ApiResponse<WalletModel>(
          success: false,
          message: responseBody['message'] ?? 'API回應異常',
          errorCode: response.statusCode,
        );
      }

    } catch (e) {
      return ApiResponse<WalletModel>(
        success: false,
        message: '建立帳戶失敗: $e',
        errorCode: 500,
      );
    }
  }

  /**
   * 03. 更新帳戶資訊
   * @version 2025-11-17-V1.0.0
   * @date 2025-11-17
   * @update: 階段一核心實作 - 基本帳戶資訊更新
   */
  static Future<ApiResponse<WalletModel>> updateWallet(String walletId, String walletName) async {
    try {
      // 參數驗證
      if (walletId.isEmpty) {
        return ApiResponse<WalletModel>(
          success: false,
          message: '帳戶ID不能為空',
          errorCode: 400,
        );
      }
      
      if (walletName.isEmpty) {
        return ApiResponse<WalletModel>(
          success: false,
          message: '帳戶名稱不能為空',
          errorCode: 400,
        );
      }

      // 構建請求資料
      final Map<String, dynamic> requestData = {
        'walletName': walletName,
        'updatedAt': DateTime.now().toIso8601String(),
      };

      // 構建API請求URL
      final String apiUrl = '$_baseUrl/accounts/$walletId';
      
      // 發送HTTP PUT請求
      final http.Response response = await _httpClient.put(
        Uri.parse(apiUrl),
        headers: _headers,
        body: json.encode(requestData),
      ).timeout(const Duration(seconds: 10));

      // 解析HTTP回應
      final Map<String, dynamic> responseBody = json.decode(response.body);
      
      // 檢查API回應狀態
      if (response.statusCode == 200 && responseBody['success'] == true) {
        // 解析更新的帳戶資料
        final WalletModel wallet = WalletModel.fromJson(responseBody['data']);

        return ApiResponse<WalletModel>(
          success: true,
          data: wallet,
          message: '帳戶更新成功',
        );
      } else {
        return ApiResponse<WalletModel>(
          success: false,
          message: responseBody['message'] ?? 'API回應異常',
          errorCode: response.statusCode,
        );
      }

    } catch (e) {
      return ApiResponse<WalletModel>(
        success: false,
        message: '更新帳戶失敗: $e',
        errorCode: 500,
      );
    }
  }

  /**
   * 04. 取得帳戶餘額
   * @version 2025-11-17-V1.0.0
   * @date 2025-11-17
   * @update: 階段一核心實作 - 基本餘額查詢
   */
  static Future<ApiResponse<double>> getWalletBalance(String walletId) async {
    try {
      // 參數驗證
      if (walletId.isEmpty) {
        return ApiResponse<double>(
          success: false,
          message: '帳戶ID不能為空',
          errorCode: 400,
        );
      }

      // 構建API請求URL
      final String apiUrl = '$_baseUrl/accounts/$walletId/balance';
      
      // 發送HTTP GET請求
      final http.Response response = await _httpClient.get(
        Uri.parse(apiUrl),
        headers: _headers,
      ).timeout(const Duration(seconds: 10));

      // 解析HTTP回應
      final Map<String, dynamic> responseBody = json.decode(response.body);
      
      // 檢查API回應狀態
      if (response.statusCode == 200 && responseBody['success'] == true) {
        // 解析餘額資料
        final double balance = (responseBody['data']['balance'] ?? 0.0).toDouble();

        return ApiResponse<double>(
          success: true,
          data: balance,
          message: '餘額查詢成功',
        );
      } else {
        return ApiResponse<double>(
          success: false,
          message: responseBody['message'] ?? 'API回應異常',
          errorCode: response.statusCode,
        );
      }

    } catch (e) {
      return ApiResponse<double>(
        success: false,
        message: '取得帳戶餘額失敗: $e',
        errorCode: 500,
      );
    }
  }

  // =============== 階段一輔助函數 ===============

  /**
   * 11. 基本資料驗證
   * @version 2025-11-17-V1.0.0
   * @date 2025-11-17
   * @update: 階段一輔助功能 - 必填欄位檢查
   */
  static bool validateBasicData(String data, String type) {
    if (data.isEmpty) return false;
    
    switch (type) {
      case 'walletName':
        return data.length >= 1 && data.length <= 50;
      case 'walletType':
        return ['cash', 'bank', 'credit', 'ewallet'].contains(data);
      case 'currency':
        return ['TWD', 'USD', 'CNY', 'EUR', 'JPY'].contains(data);
      case 'ledgerId':
        return data.isNotEmpty;
      default:
        return data.isNotEmpty;
    }
  }

  /**
   * 12. 轉換API回應格式
   * @version 2025-11-17-V1.0.0
   * @date 2025-11-17
   * @update: 階段一輔助功能 - 標準API回應處理
   */
  static ApiResponse<T> parseApiResponse<T>(
    Map<String, dynamic> response, 
    T Function(Map<String, dynamic>) fromJson
  ) {
    try {
      if (response['success'] == true) {
        return ApiResponse<T>(
          success: true,
          data: fromJson(response['data']),
          message: response['message'],
        );
      } else {
        return ApiResponse<T>(
          success: false,
          message: response['message'] ?? '未知錯誤',
          errorCode: response['errorCode'],
        );
      }
    } catch (e) {
      return ApiResponse<T>(
        success: false,
        message: 'API回應解析失敗: $e',
        errorCode: 500,
      );
    }
  }

  // =============== 資源清理 ===============
  
  /// 清理HTTP客戶端資源
  static void dispose() {
    _httpClient.close();
  }
}

// =============== 階段一實作完成標記 ===============

/// 7306模組階段一實作狀態
class WalletCategoryManagerStatus {
  static const String version = 'V1.0.0';
  static const String phase = 'Phase 1';
  static const String date = '2025-11-17';
  static const List<String> completedFunctions = [
    '01. 取得帳戶清單',
    '02. 建立新帳戶', 
    '03. 更新帳戶資訊',
    '04. 取得帳戶餘額',
  ];
  static const int totalFunctions = 4;
  static const String status = 'PHASE_1_COMPLETE';
  static const String nextPhase = 'Phase 2 - 科目管理功能實作';
}
