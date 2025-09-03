
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

  // ================================
  // 輔助方法 (Helper Methods)
  // ================================

  /**
   * 取得所有開關狀態摘要
   * @version 2025-09-02-V1.2.0
   * @return Map<String, bool> 開關狀態摘要
   */
  static Map<String, bool> getAllSwitchStatus() {
    return {
      '8501_認證服務': enable8501FakeService,
      '8502_用戶管理服務': enable8502FakeService,
    };
  }

  /**
   * 批次設定所有開關
   * @version 2025-09-02-V1.2.0
   * @param bool enableAll 統一開關狀態
   */
  static void setAllSwitches(bool enableAll) {
    enable8501FakeService = enableAll;
    enable8502FakeService = enableAll;
  }

  /**
   * 重設所有開關為預設值
   * @version 2025-09-02-V1.2.0
   */
  static void resetToDefault() {
    enable8501FakeService = true;
    enable8502FakeService = true;
  }

  /**
   * 取得開關設定摘要字串
   * @version 2025-09-02-V1.2.0
   * @return String 開關狀態摘要字串
   */
  static String getSwitchSummary() {
    final status = getAllSwitchStatus();
    final summary = status.entries
        .map((entry) => '${entry.key}: ${entry.value ? "Fake" : "Real"}')
        .join(', ');
    return '8599開關狀態摘要: $summary';
  }
}

/**
 * 開關控制使用說明：
 * 
 * 1. 啟用8501 Fake Service：
 *    FakeServiceSwitch.enable8501FakeService = true;
 * 
 * 2. 啟用8502 Fake Service：
 *    FakeServiceSwitch.enable8502FakeService = true;
 * 
 * 3. 關閉所有Fake Service：
 *    FakeServiceSwitch.setAllSwitches(false);
 * 
 * 4. 重設為預設值：
 *    FakeServiceSwitch.resetToDefault();
 * 
 * 5. 查看開關狀態：
 *    print(FakeServiceSwitch.getSwitchSummary());
 */
