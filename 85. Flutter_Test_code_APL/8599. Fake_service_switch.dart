
/**
 * 8599. Fake Service Switch 統一開關管理
 * @version 2025-09-02-V1.7.0
 * @date 2025-09-02 12:00:00
 * @update: 簡化為雙開關設計 - 只保留 8501 和 8502 開關
 * @module 模組版次: v2.6.0
 * @description LCAS 2.0 APL層測試代碼統一開關管理 - 雙開關設計
 */

/// Fake Service 統一開關管理類別
/// 提供 8501 認證服務和 8502 用戶管理服務的獨立開關控制
class FakeServiceSwitch {
  
  /**
   * 01. 8501認證服務 Fake Service 開關
   * @version 2025-09-02-V1.7.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 控制認證服務測試代碼的 Fake/Real Service 切換
   * true: 使用 Fake Service
   * false: 使用 Real Service
   */
  static bool enable8501FakeService = true;
  
  /**
   * 02. 8502用戶管理服務 Fake Service 開關
   * @version 2025-09-02-V1.7.0
   * @date 2025-09-02 12:00:00
   * @update: 初版建立
   * @description 控制用戶管理服務測試代碼的 Fake/Real Service 切換
   * true: 使用 Fake Service
   * false: 使用 Real Service
   */
  static bool enable8502FakeService = false;
}
