
/**
 * 8599. Fake Service Switch 統一開關管理系統
 * @version 2025-09-02-V1.0.0
 * @date 2025-09-02 12:00:00
 * @update: 初版建立 - 統一管理所有測試代碼的Fake Service開關
 * @module 模組版次: v1.0.0
 * @description LCAS 2.0 APL層測試代碼統一開關管理中心 - 支援動態擴展和標準化整合
 */

import 'dart:collection';

/// Fake Service 統一開關管理系統
/// 提供中央化的開關管理，支援現有測試代碼和未來測試代碼的動態整合
class FakeServiceSwitch {
  
  // ================================
  // 靜態開關註冊表 (Static Switch Registry)
  // ================================
  
  /// 開關註冊表 - 存放所有已註冊的測試代碼開關
  static final Map<String, FakeServiceSwitchConfig> _switchRegistry = {};
  
  /// 開關狀態快取 - 提升查詢效能
  static final Map<String, bool> _switchCache = {};
  
  /// 開關變更監聽器 - 支援狀態變更通知
  static final Map<String, List<Function(bool)>> _switchListeners = {};

  // ================================
  // 預設測試代碼開關 (Default Test Code Switches)
  // ================================
  
  /**
   * 01. 8501認證服務 Fake Service 開關
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 控制認證服務測試代碼的 Fake/Real Service 切換
   * true: 使用 Fake Service
   * false: 使用 Real Service
   */
  static bool get enable8501FakeService => getSwitch('8501', defaultValue: true);
  static set enable8501FakeService(bool value) => setSwitch('8501', value);
  
  /**
   * 02. 8502用戶管理服務 Fake Service 開關
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 控制用戶管理服務測試代碼的 Fake/Real Service 切換
   * true: 使用 Fake Service
   * false: 使用 Real Service
   */
  static bool get enable8502FakeService => getSwitch('8502', defaultValue: true);
  static set enable8502FakeService(bool value) => setSwitch('8502', value);

  // ================================
  // 動態開關管理系統 (Dynamic Switch Management)
  // ================================
  
  /**
   * 03. 註冊測試代碼開關
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 為新的測試代碼註冊Fake Service開關
   * @param testCodeId 測試代碼ID (例如: '8503', '8504')
   * @param config 開關配置
   */
  static void registerTestCodeSwitch(String testCodeId, FakeServiceSwitchConfig config) {
    if (testCodeId.isEmpty) {
      throw ArgumentError('測試代碼ID不能為空');
    }
    
    if (_switchRegistry.containsKey(testCodeId)) {
      throw StateError('測試代碼 $testCodeId 的開關已經註冊');
    }
    
    _switchRegistry[testCodeId] = config;
    _switchCache[testCodeId] = config.defaultValue;
    _switchListeners[testCodeId] = [];
    
    print('[FakeServiceSwitch] 已註冊測試代碼 $testCodeId 開關: ${config.description}');
  }
  
  /**
   * 04. 取得測試代碼開關狀態
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 查詢指定測試代碼的Fake Service開關狀態
   * @param testCodeId 測試代碼ID
   * @param defaultValue 預設值（當開關未註冊時使用）
   * @return bool 開關狀態
   */
  static bool getSwitch(String testCodeId, {bool defaultValue = true}) {
    if (_switchCache.containsKey(testCodeId)) {
      return _switchCache[testCodeId]!;
    }
    
    if (_switchRegistry.containsKey(testCodeId)) {
      final config = _switchRegistry[testCodeId]!;
      _switchCache[testCodeId] = config.defaultValue;
      return config.defaultValue;
    }
    
    // 自動註冊未知的測試代碼開關
    _autoRegisterTestCodeSwitch(testCodeId, defaultValue);
    return defaultValue;
  }
  
  /**
   * 05. 設定測試代碼開關狀態
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 設定指定測試代碼的Fake Service開關狀態
   * @param testCodeId 測試代碼ID
   * @param value 開關狀態
   */
  static void setSwitch(String testCodeId, bool value) {
    final oldValue = _switchCache[testCodeId];
    _switchCache[testCodeId] = value;
    
    // 觸發狀態變更監聽器
    if (oldValue != value && _switchListeners.containsKey(testCodeId)) {
      for (final listener in _switchListeners[testCodeId]!) {
        try {
          listener(value);
        } catch (e) {
          print('[FakeServiceSwitch] 監聽器執行錯誤: $e');
        }
      }
    }
    
    print('[FakeServiceSwitch] 測試代碼 $testCodeId 開關已設定為: $value');
  }

  // ================================
  // 批次開關管理 (Batch Switch Management)
  // ================================
  
  /**
   * 06. 批次設定開關狀態
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 批次設定多個測試代碼的開關狀態
   * @param switches 開關設定Map，key為測試代碼ID，value為開關狀態
   */
  static void setBatchSwitches(Map<String, bool> switches) {
    for (final entry in switches.entries) {
      setSwitch(entry.key, entry.value);
    }
  }
  
  /**
   * 07. 全部啟用Fake Service
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 將所有已註冊的測試代碼開關設為啟用Fake Service
   */
  static void enableAllFakeServices() {
    final allTestCodes = getAllRegisteredTestCodes();
    for (final testCodeId in allTestCodes) {
      setSwitch(testCodeId, true);
    }
    print('[FakeServiceSwitch] 已啟用所有Fake Service開關');
  }
  
  /**
   * 08. 全部停用Fake Service
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 將所有已註冊的測試代碼開關設為停用Fake Service (使用Real Service)
   */
  static void disableAllFakeServices() {
    final allTestCodes = getAllRegisteredTestCodes();
    for (final testCodeId in allTestCodes) {
      setSwitch(testCodeId, false);
    }
    print('[FakeServiceSwitch] 已停用所有Fake Service開關，使用Real Service');
  }

  // ================================
  // 查詢和管理功能 (Query and Management Features)
  // ================================
  
  /**
   * 09. 取得所有已註冊的測試代碼
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 取得所有已註冊的測試代碼ID列表
   * @return List<String> 測試代碼ID列表
   */
  static List<String> getAllRegisteredTestCodes() {
    final allKeys = <String>{};
    allKeys.addAll(_switchRegistry.keys);
    allKeys.addAll(_switchCache.keys);
    
    // 確保8501和8502始終存在
    allKeys.addAll(['8501', '8502']);
    
    final sortedKeys = allKeys.toList()..sort();
    return sortedKeys;
  }
  
  /**
   * 10. 取得所有開關狀態摘要
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 取得所有測試代碼開關的狀態摘要
   * @return Map<String, FakeServiceSwitchStatus> 開關狀態摘要
   */
  static Map<String, FakeServiceSwitchStatus> getAllSwitchStatus() {
    final status = <String, FakeServiceSwitchStatus>{};
    final allTestCodes = getAllRegisteredTestCodes();
    
    for (final testCodeId in allTestCodes) {
      final config = _switchRegistry[testCodeId];
      final currentState = getSwitch(testCodeId);
      
      status[testCodeId] = FakeServiceSwitchStatus(
        testCodeId: testCodeId,
        isEnabled: currentState,
        description: config?.description ?? '自動註冊的測試代碼開關',
        serviceName: config?.serviceName ?? '未知服務',
        registeredAt: config?.registeredAt ?? DateTime.now(),
        lastModified: DateTime.now(),
      );
    }
    
    return status;
  }
  
  /**
   * 11. 重置所有開關到預設狀態
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 將所有開關重置到其預設狀態
   */
  static void resetAllSwitchesToDefault() {
    final allTestCodes = getAllRegisteredTestCodes();
    for (final testCodeId in allTestCodes) {
      final config = _switchRegistry[testCodeId];
      final defaultValue = config?.defaultValue ?? true;
      setSwitch(testCodeId, defaultValue);
    }
    print('[FakeServiceSwitch] 已重置所有開關到預設狀態');
  }

  // ================================
  // 監聽器管理 (Listener Management)
  // ================================
  
  /**
   * 12. 新增開關狀態監聽器
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 為指定測試代碼新增開關狀態變更監聽器
   * @param testCodeId 測試代碼ID
   * @param listener 監聽器函數
   */
  static void addSwitchListener(String testCodeId, Function(bool) listener) {
    if (!_switchListeners.containsKey(testCodeId)) {
      _switchListeners[testCodeId] = [];
    }
    _switchListeners[testCodeId]!.add(listener);
  }
  
  /**
   * 13. 移除開關狀態監聽器
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 移除指定測試代碼的監聽器
   * @param testCodeId 測試代碼ID
   * @param listener 要移除的監聽器函數
   */
  static void removeSwitchListener(String testCodeId, Function(bool) listener) {
    if (_switchListeners.containsKey(testCodeId)) {
      _switchListeners[testCodeId]!.remove(listener);
    }
  }

  // ================================
  // 私有輔助方法 (Private Helper Methods)
  // ================================
  
  /// 自動註冊未知的測試代碼開關
  static void _autoRegisterTestCodeSwitch(String testCodeId, bool defaultValue) {
    final config = FakeServiceSwitchConfig(
      testCodeId: testCodeId,
      serviceName: '自動識別服務',
      description: '自動註冊的測試代碼 $testCodeId Fake Service 開關',
      defaultValue: defaultValue,
      isAutoRegistered: true,
    );
    
    _switchRegistry[testCodeId] = config;
    _switchCache[testCodeId] = defaultValue;
    _switchListeners[testCodeId] = [];
    
    print('[FakeServiceSwitch] 自動註冊測試代碼 $testCodeId 開關');
  }

  // ================================
  // 系統初始化 (System Initialization)
  // ================================
  
  /**
   * 14. 初始化系統預設開關
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 初始化系統預設的測試代碼開關
   */
  static void initializeDefaultSwitches() {
    // 註冊8501認證服務開關
    if (!_switchRegistry.containsKey('8501')) {
      registerTestCodeSwitch('8501', FakeServiceSwitchConfig(
        testCodeId: '8501',
        serviceName: '認證服務',
        description: 'LCAS 2.0 認證服務測試代碼 Fake Service 開關',
        defaultValue: true,
      ));
    }
    
    // 註冊8502用戶管理服務開關
    if (!_switchRegistry.containsKey('8502')) {
      registerTestCodeSwitch('8502', FakeServiceSwitchConfig(
        testCodeId: '8502',
        serviceName: '用戶管理服務',
        description: 'LCAS 2.0 用戶管理服務測試代碼 Fake Service 開關',
        defaultValue: true,
      ));
    }
    
    print('[FakeServiceSwitch] 系統預設開關初始化完成');
  }
}

// ================================
// 支援類別和資料結構 (Support Classes and Data Structures)
// ================================

/// Fake Service開關配置類別
class FakeServiceSwitchConfig {
  /// 測試代碼ID
  final String testCodeId;
  
  /// 服務名稱
  final String serviceName;
  
  /// 開關描述
  final String description;
  
  /// 預設值
  final bool defaultValue;
  
  /// 是否為自動註冊
  final bool isAutoRegistered;
  
  /// 註冊時間
  final DateTime registeredAt;
  
  /// 開關版本
  final String version;
  
  FakeServiceSwitchConfig({
    required this.testCodeId,
    required this.serviceName,
    required this.description,
    this.defaultValue = true,
    this.isAutoRegistered = false,
    DateTime? registeredAt,
    this.version = '1.0.0',
  }) : registeredAt = registeredAt ?? DateTime.now();
  
  /// 轉換為Map格式
  Map<String, dynamic> toMap() {
    return {
      'testCodeId': testCodeId,
      'serviceName': serviceName,
      'description': description,
      'defaultValue': defaultValue,
      'isAutoRegistered': isAutoRegistered,
      'registeredAt': registeredAt.toIso8601String(),
      'version': version,
    };
  }
  
  @override
  String toString() {
    return 'FakeServiceSwitchConfig{testCodeId: $testCodeId, serviceName: $serviceName, defaultValue: $defaultValue}';
  }
}

/// Fake Service開關狀態類別
class FakeServiceSwitchStatus {
  /// 測試代碼ID
  final String testCodeId;
  
  /// 是否啟用
  final bool isEnabled;
  
  /// 開關描述
  final String description;
  
  /// 服務名稱
  final String serviceName;
  
  /// 註冊時間
  final DateTime registeredAt;
  
  /// 最後修改時間
  final DateTime lastModified;
  
  FakeServiceSwitchStatus({
    required this.testCodeId,
    required this.isEnabled,
    required this.description,
    required this.serviceName,
    required this.registeredAt,
    required this.lastModified,
  });
  
  /// 轉換為Map格式
  Map<String, dynamic> toMap() {
    return {
      'testCodeId': testCodeId,
      'isEnabled': isEnabled,
      'description': description,
      'serviceName': serviceName,
      'registeredAt': registeredAt.toIso8601String(),
      'lastModified': lastModified.toIso8601String(),
    };
  }
  
  @override
  String toString() {
    return 'FakeServiceSwitchStatus{testCodeId: $testCodeId, isEnabled: $isEnabled, serviceName: $serviceName}';
  }
}

/// Fake Service開關管理工具類別
class FakeServiceSwitchUtils {
  /**
   * 15. 匯出開關配置
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 匯出所有開關配置為JSON格式
   * @return String JSON格式的開關配置
   */
  static String exportSwitchConfiguration() {
    final allStatus = FakeServiceSwitch.getAllSwitchStatus();
    final exportData = {
      'exportedAt': DateTime.now().toIso8601String(),
      'version': '1.0.0',
      'totalSwitches': allStatus.length,
      'switches': allStatus.map((key, value) => MapEntry(key, value.toMap())),
    };
    
    // 簡化的JSON序列化（實際專案中應使用dart:convert）
    return exportData.toString();
  }
  
  /**
   * 16. 驗證測試代碼ID格式
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 驗證測試代碼ID是否符合命名規範
   * @param testCodeId 測試代碼ID
   * @return bool 是否有效
   */
  static bool isValidTestCodeId(String testCodeId) {
    if (testCodeId.isEmpty) return false;
    
    // 檢查是否符合85XX格式（85開頭，後跟2位數字）
    final pattern = RegExp(r'^85\d{2}$');
    return pattern.hasMatch(testCodeId);
  }
  
  /**
   * 17. 產生下一個可用的測試代碼ID
   * @version 2025-09-02-V1.0.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 根據已註冊的測試代碼，產生下一個可用的ID
   * @return String 下一個可用的測試代碼ID
   */
  static String generateNextTestCodeId() {
    final allTestCodes = FakeServiceSwitch.getAllRegisteredTestCodes();
    final validIds = allTestCodes
        .where((id) => isValidTestCodeId(id))
        .map((id) => int.parse(id))
        .toList()
      ..sort();
    
    if (validIds.isEmpty) {
      return '8501'; // 如果沒有有效ID，從8501開始
    }
    
    final lastId = validIds.last;
    final nextId = lastId + 1;
    
    if (nextId > 8599) {
      throw StateError('測試代碼ID已達上限 (8599)');
    }
    
    return nextId.toString();
  }
}
