
/**
 * 8599. Fake Service Switch 統一開關管理系統
 * @version 2025-09-02-V1.2.0
 * @date 2025-09-02 14:00:00
 * @update: 階段一修復完成 - 語法錯誤修復與架構簡化，回歸純靜態開關設計
 * @module 模組版次: v1.2.0
 * @function 函數版次: v1.2.0
 * @description LCAS 2.0 APL層測試代碼統一開關管理中心 - 簡潔穩定的靜態開關設計
 */

/// Fake Service 統一開關管理系統
/// 提供中央化的靜態開關管理，支援8501和8502測試代碼的簡潔控制
class FakeServiceSwitch {
  // ================================
  // 靜態開關設定 (Static Switch Configuration)
  // ================================

  /**
   * 01. 8501認證服務 Fake Service 開關
   * @version 2025-09-02-V1.2.0
   * @date 2025-09-02 14:00:00
   * @update: 階段一修復 - 恢復純靜態布爾開關
   * @description 控制認證服務測試代碼的 Fake/Real Service 切換
   * true: 使用 Fake Service (預設)
   * false: 使用 Real Service
   */
  static bool enable8501FakeService = false;

  /**
   * 02. 8502用戶管理服務 Fake Service 開關
   * @version 2025-09-02-V1.2.0
   * @date 2025-09-02 14:00:00
   * @update: 階段一修復 - 恢復純靜態布爾開關
   * @description 控制用戶管理服務測試代碼的 Fake/Real Service 切換
   * true: 使用 Fake Service (預設)
   * false: 使用 Real Service
   */
  static bool enable8502FakeService = false;

  /**
   * 03. 8503記帳交易服務 Fake Service 開關
   * @version 2025-09-04-V1.2.0
   * @date 2025-09-04 12:00:00
   * @update: 階段一新增 - 記帳交易服務開關
   * @description 控制記帳交易服務測試代碼的 Fake/Real Service 切換
   * true: 使用 Fake Service (預設)
   * false: 使用 Real Service
   */
  static bool enable8503FakeService = true;

/**
 * 開關控制使用說明：
 * 
 * 1. 啟用8501 Fake Service：
 *    FakeServiceSwitch.enable8501FakeService = true;
 * 
 * 2. 啟用8502 Fake Service：
 *    FakeServiceSwitch.enable8502FakeService = true;
 * 
 * 3. 啟用8503 Fake Service：
 *    FakeServiceSwitch.enable8503FakeService = true;
 * 
