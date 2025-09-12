
/**
 * 7599. Fake_service_switch.dart - PL層專用Fake Service開關
 * @version 2025-09-12 v1.0.0
 * @date 2025-09-12
 * @update: 初始版本，專門給PL層測試使用的Fake switch
 */

/// PL層專用的Fake Service開關管理類
class PLFakeServiceSwitch {
  // 系統進入功能群Fake Service開關
  static bool enable7501FakeService = true;
  
  // 記帳核心功能群Fake Service開關
  static bool enable7502FakeService = true;
  
  // 系統功能群Fake Service開關  
  static bool enable7503FakeService = true;
  
  // 報表分析功能群Fake Service開關
  static bool enable7504FakeService = true;
  
  // AI助理功能群Fake Service開關
  static bool enable7505FakeService = true;
  
  /// 取得所有開關狀態
  static Map<String, bool> getAllSwitches() {
    return {
      '7501_系統進入功能群': enable7501FakeService,
      '7502_記帳核心功能群': enable7502FakeService,
      '7503_系統功能群': enable7503FakeService,
      '7504_報表分析功能群': enable7504FakeService,
      '7505_AI助理功能群': enable7505FakeService,
    };
  }
  
  /// 啟用所有Fake Service
  static void enableAll() {
    enable7501FakeService = true;
    enable7502FakeService = true;
    enable7503FakeService = true;
    enable7504FakeService = true;
    enable7505FakeService = true;
  }
  
  /// 停用所有Fake Service
  static void disableAll() {
    enable7501FakeService = false;
    enable7502FakeService = false;
    enable7503FakeService = false;
    enable7504FakeService = false;
    enable7505FakeService = false;
  }
  
  /// 重設為預設狀態
  static void resetToDefault() {
    enable7501FakeService = true;
    enable7502FakeService = true;
    enable7503FakeService = true;
    enable7504FakeService = true;
    enable7505FakeService = true;
  }
}
