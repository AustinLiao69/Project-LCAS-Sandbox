
# DCN-0018 重構SIT測試模組

**版本**: v1.0.0  
**建立日期**: 2025-10-15  
**最後更新**: 2025-10-15  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [完善7598靜態測試資料倉庫](#31-完善7598靜態測試資料倉庫)
   - 3.2 [解除7570模組依賴關係](#32-解除7570模組依賴關係)
   - 3.3 [移除7580和7590模組](#33-移除7580和7590模組)
   - 3.4 [1311規範合規性調整](#34-1311規範合規性調整)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [測試資料流簡化架構](#41-測試資料流簡化架構)
   - 4.2 [靜態資料管理策略](#42-靜態資料管理策略)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [測試資料重構清單](#6-測試資料重構清單)
### 7. [文件更新清單](#7-文件更新清單)
### 8. [版本紀錄](#8-版本紀錄)

---

## 1. 需求說明

本次變更目標為：重構SIT測試模組架構，將目前過度複雜的動態測試資料生成機制簡化為靜態測試資料管理，符合MVP階段快速驗證的核心需求。

此變更將解決目前7570依賴7590動態生成和7580注入機制的複雜性問題，通過建立完整的7598靜態測試資料倉庫，實現測試資料的統一管理和維護。

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **MVP階段適配**：在MVP階段使用靜態測試資料，避免過度工程化的動態生成機制
- **測試資料完整性**：建立涵蓋所有正確、錯誤、邊界值情境的完整測試資料集
- **架構簡化需求**：移除不必要的中間層，降低系統複雜度和維護成本
- **規範合規性**：確保所有測試資料符合1311 FS規範，移除業務邏輯生成欄位

### 2.2 預期效益
- **開發效率提升**：簡化的測試架構減少除錯時間和開發複雜度
- **維護成本降低**：集中式靜態資料管理比分散式動態生成更容易維護
- **測試穩定性提升**：靜態測試資料避免動態生成的不確定性
- **規範合規保證**：嚴格遵循1311規範，確保資料結構一致性
- **MVP聚焦**：專注核心功能驗證，避免過度工程化

---

## 3. 須新增/修改內容

### 3.1 完善7598靜態測試資料倉庫

#### 3.1.1 擴充測試情境覆蓋
- **成功情境測試資料**
  - 四種用戶模式完整註冊資料 (Expert/Inertial/Cultivation/Guiding)
  - 各種交易類型測試資料 (收入/支出/大額/小額)
  - 正常業務流程測試資料

- **失敗情境測試資料**
  - 無效Email格式測試
  - 缺失必要欄位測試
  - 無效用戶模式測試
  - 負數金額測試
  - 零金額測試
  - 無效交易類型測試

- **邊界值測試資料**
  - 最小必要欄位用戶資料
  - 最大長度欄位測試資料
  - 最小/最大金額交易測試
  - 極值處理測試資料

#### 3.1.2 1311規範合規調整
```json
{
  "compliance": "1311_FS_STANDARD_FULL",
  "removed_business_logic_fields": [
    "default_ledger_id",
    "ledger_id_source", 
    "evaluationResult",
    "modeSpecificSettings"
  ],
  "standard_user_fields": [
    "userId", "email", "userMode", "displayName", 
    "preferences", "assessmentAnswers", "registrationDate", "createdAt"
  ],
  "standard_transaction_fields": [
    "id", "amount", "type", "description", "categoryId", 
    "accountId", "date", "userId", "paymentMethod", 
    "createdAt", "updatedAt", "status", "verified", "source"
  ]
}
```

#### 3.1.3 測試情境組織結構
```json
{
  "authentication_test_data": {
    "success_scenarios": { /* 4個成功情境 */ },
    "failure_scenarios": { /* 6個失敗情境 */ },
    "boundary_scenarios": { /* 2個邊界情境 */ }
  },
  "bookkeeping_test_data": {
    "success_scenarios": { /* 4個成功情境 */ },
    "failure_scenarios": { /* 6個失敗情境 */ },
    "boundary_scenarios": { /* 2個邊界情境 */ }
  },
  "test_scenarios": {
    /* 6個整合測試情境定義 */
  }
}
```

### 3.2 解除7570模組依賴關係

#### 3.2.1 移除7590動態生成依賴
- 刪除 `import '7590. 生成動態測試資料.dart';`
- 移除所有 `generateTestData()` 相關調用
- 刪除動態生成相關的測試邏輯

#### 3.2.2 移除7580注入機制依賴
- 刪除 `import '7580. 注入測試資料.dart';`
- 移除所有 `injectTestData()` 相關調用
- 刪除資料注入相關的初始化代碼

#### 3.2.3 實作直接讀取機制
```dart
// 新增靜態資料讀取功能
Map<String, dynamic> loadStaticTestData() {
  String jsonString = File('7598. Data warehouse.json').readAsStringSync();
  return jsonDecode(jsonString);
}

// 實作資料驗證機制
bool validateTestDataCompliance(Map<String, dynamic> data) {
  // 檢查1311規範合規性
  // 驗證必要欄位存在
  // 確認資料格式正確
  return true;
}
```

### 3.3 移除7580和7590模組

#### 3.3.1 7580模組清理
- 刪除 `7580. 注入測試資料.dart` 檔案
- 清理相關import引用
- 移除pubspec.yaml中的相關依賴

#### 3.3.2 7590模組清理  
- 刪除 `7590. 生成動態測試資料.dart` 檔案
- 清理相關import引用
- 移除動態生成相關配置

#### 3.3.3 清理驗證
- 檢查專案中是否還有對7580/7590的引用
- 確認所有依賴關係已完全移除
- 驗證7570可獨立運行

### 3.4 1311規範合規性調整

#### 3.4.1 業務邏輯欄位移除
- 移除 `evaluationResult` 計算欄位
- 移除 `modeSpecificSettings` 業務邏輯欄位
- 移除 `default_ledger_id` 動態生成欄位
- 移除所有統計和處理狀態欄位

#### 3.4.2 標準欄位保留
- 保留所有1311規範要求的標準資料結構欄位
- 確保用戶資料欄位完整性
- 維持交易資料欄位標準格式

---

## 4. 技術架構設計

### 4.1 測試資料流簡化架構

#### 重構前架構 (複雜)
```
7570 SIT測試主程式
├── 7590 動態生成測試資料
├── 7580 注入測試資料  
└── 7598 靜態資料倉庫
```

#### 重構後架構 (簡化)
```
7570 SIT測試主程式
└── 7598 靜態資料倉庫 (直接讀取)
```

### 4.2 靜態資料管理策略

#### 4.2.1 資料組織原則
- **按功能分組**：認證測試資料、記帳測試資料分離
- **按情境分類**：成功、失敗、邊界值情境清楚分類
- **按模式區分**：四種用戶模式專用測試資料

#### 4.2.2 資料讀取機制
```dart
class TestDataManager {
  static Map<String, dynamic> _testData = {};
  
  static Future<void> initialize() async {
    _testData = await loadStaticTestData();
    validateCompliance(_testData);
  }
  
  static Map<String, dynamic> getAuthTestData(String scenario) {
    return _testData['authentication_test_data'][scenario];
  }
  
  static Map<String, dynamic> getBookkeepingTestData(String scenario) {
    return _testData['bookkeeping_test_data'][scenario];
  }
}
```

---

## 5. 實作階段規劃

### 階段一：完善7598靜態測試資料倉庫 (Week 1)
- ✅ 分析當前測試需求和缺口
- 🔧 擴充失敗情境測試資料 (6個認證 + 6個記帳)
- 🔧 新增邊界值測試資料 (2個認證 + 2個記帳)
- 🔧 移除所有業務邏輯生成欄位
- 🔧 確保所有資料符合1311 FS規範
- 🧪 驗證測試資料完整性和格式正確性

### 階段二：解除模組依賴關係 (Week 2)
- 🔧 修改7570 SIT測試主程式
- 🔧 移除對7590的import和調用
- 🔧 移除對7580的import和調用
- 🔧 實作直接從7598讀取靜態資料的功能
- 🔧 實作資料驗證機制確保符合1311規範
- 🧪 測試7570獨立運行功能

### 階段三：優化測試資料讀取機制 (Week 3)
- 🔧 實作TestDataManager類別
- 🔧 建立統一的資料讀取介面
- 🔧 實作基本的資料格式轉換功能
- 🔧 完善錯誤處理機制
- 🧪 執行完整SIT測試驗證
- 📝 更新相關文件和測試報告

---

## 6. 測試資料重構清單

### 6.1 新增測試資料項目

#### 認證服務失敗情境 (6項)
- `invalid_email_format`: 無效Email格式測試
- `missing_user_mode`: 缺少userMode欄位測試  
- `invalid_user_mode`: 無效userMode值測試
- `empty_user_id`: 空userId測試
- `missing_display_name`: 缺少displayName測試
- `invalid_assessment_answers`: 無效評估答案測試

#### 記帳交易失敗情境 (6項)
- `negative_amount`: 負數金額測試
- `zero_amount`: 零金額測試
- `invalid_transaction_type`: 無效交易類型測試
- `missing_amount`: 缺少金額欄位測試
- `missing_transaction_type`: 缺少交易類型測試
- `empty_description`: 空描述測試

#### 邊界值測試資料 (4項)
- `minimal_valid_user`: 最小必要欄位用戶
- `maximum_length_fields`: 最大長度欄位測試
- `minimal_transaction`: 最小必要欄位交易
- `maximum_amount`: 最大金額交易

### 6.2 移除業務邏輯欄位清單
- `default_ledger_id` - BL層動態生成
- `ledger_id_source` - 業務邏輯標記
- `evaluationResult` - DD1模組計算結果
- `modeSpecificSettings` - 業務邏輯配置
- 所有統計欄位和處理狀態欄位

### 6.3 版本升級計劃
- **7570模組**: v2.0.0 → v3.0.0 (Major: 移除動態依賴)
- **7598資料倉庫**: v2.0.0 → v3.0.0 (Major: 完整重構)

---

## 7. 文件更新清單

### 7.1 測試計劃文件 (2個)
- `65. Flutter_SIT_Test plan/6501. SIT_P1.md` - 更新測試資料來源說明
- `05. SIT_Test plan/0501. SIT_P1.md` - 更新測試架構描述

### 7.2 測試代碼文件 (2個)  
- `75. Flutter_Test_code_PL/7570. SIT_P1.dart` - 主要重構目標
- `06. SIT_Test code/0603. SIT_TC_P1.js` - JavaScript版本同步更新

### 7.3 專案文件 (2個)
- `00. Master_Project document/0015. Product_SPEC_LCAS_2.0.md` - 更新測試架構說明
- `60. Flutter_Project document/6005. 測試代碼開發規範.md` - 更新靜態資料管理規範

**總計：6個文件需要更新**

---

## 8. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-10-15 | 初版建立，定義SIT測試模組重構計劃 | LCAS PM Team |

---

> **重要提醒**：此變更將對LCAS 2.0 SIT測試架構產生重大影響，涉及測試資料管理、模組依賴、規範合規等多個層面。所有開發人員請嚴格遵循實作階段規劃，確保每個階段的驗收標準都能達成，並在重構完成後進行充分的SIT測試驗證，確保測試覆蓋率和資料品質符合MVP階段要求。
