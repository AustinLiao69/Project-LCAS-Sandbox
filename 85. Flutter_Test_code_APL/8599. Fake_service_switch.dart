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
