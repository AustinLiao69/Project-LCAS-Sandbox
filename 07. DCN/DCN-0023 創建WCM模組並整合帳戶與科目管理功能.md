
# DCN-0023 創建WCM模組並整合帳戶與科目管理功能

**版本**: v1.0.0  
**建立日期**: 2025-11-14  
**最後更新**: 2025-11-14  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [創建WCM模組](#31-創建wcm模組)
   - 3.2 [API端點重新分配](#32-api端點重新分配)
   - 3.3 [模組功能整合](#33-模組功能整合)
   - 3.4 [版本升級機制](#34-版本升級機制)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [WCM模組架構](#41-wcm模組架構)
   - 4.2 [依賴關係重構](#42-依賴關係重構)
   - 4.3 [資料流優化設計](#43-資料流優化設計)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [API端點重新分配清單](#6-api端點重新分配清單)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：創建WCM（Wallet and Category Management）模組，整合帳戶管理和科目管理功能，解決功能分散和維護複雜度問題。根據DCN-0022移除DD1模組的決策，科目管理功能需要重新歸屬，與帳戶管理功能整合具有業務邏輯合理性。

此變更將實現：
1. 創建統一的WCM模組處理帳戶與科目管理
2. 從BK.js中遷移帳戶管理功能至WCM
3. 從DD1.js中遷移科目管理功能至WCM（配合DCN-0022）
4. 重新分配相關API端點至WCM模組
5. 優化BL層模組間依賴關係

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **功能整合需求**：帳戶和科目都是記帳的基礎主數據，整合管理符合業務邏輯
- **維護效率提升**：統一管理減少跨模組調用，降低維護複雜度
- **架構簡化需求**：配合MVP階段架構簡化原則，避免功能過度分散
- **職責邊界清晰化**：明確WCM負責基礎主數據管理，BK專注記帳核心邏輯

### 2.2 預期效益
- **開發效率提升**：統一的主數據管理介面，減少重複開發工作
- **維護成本降低**：單一模組管理相關功能，降低跨模組維護複雜度
- **資料一致性提升**：統一的驗證邏輯和處理流程
- **記帳流程優化**：BK模組調用WCM進行帳戶科目驗證，流程更順暢

---

## 3. 須新增/修改內容

### 3.1 創建WCM模組

#### 3.1.1 新建模組規格
- **檔案名稱**：`13. Replit_Module code_BL/1350. WCM.js`
- **模組版本**：v1.0.0（新建）
- **主要職責**：統一處理帳戶（Wallet）與科目（Category）的CRUD操作
- **功能範圍**：基礎主數據管理，不涉及複雜業務邏輯計算

#### 3.1.2 核心功能設計
```javascript
// WCM模組核心功能架構
const WCM = {
  // 帳戶管理功能
  createAccount: async (accountData) => { /* 創建帳戶 */ },
  updateAccount: async (accountId, updateData) => { /* 更新帳戶 */ },
  deleteAccount: async (accountId) => { /* 刪除帳戶 */ },
  getAccountList: async (userId, filters) => { /* 取得帳戶列表 */ },
  getAccountById: async (accountId) => { /* 取得帳戶詳情 */ },
  getAccountBalance: async (accountId) => { /* 取得帳戶餘額 */ },
  
  // 科目管理功能
  createCategory: async (categoryData) => { /* 創建科目 */ },
  updateCategory: async (categoryId, updateData) => { /* 更新科目 */ },
  deleteCategory: async (categoryId) => { /* 刪除科目 */ },
  getCategoryList: async (userId, filters) => { /* 取得科目列表 */ },
  getCategoryById: async (categoryId) => { /* 取得科目詳情 */ },
  getCategoryTree: async (userId) => { /* 取得科目樹狀結構 */ }
};
```

### 3.2 API端點重新分配

#### 3.2.1 從BK模組轉移的API端點
根據8020.md API list文件，以下帳戶相關端點將轉移至WCM：
- `GET /api/v1/accounts` - 取得帳戶列表
- `POST /api/v1/accounts` - 創建帳戶  
- `GET /api/v1/accounts/{id}` - 取得帳戶詳情
- `PUT /api/v1/accounts/{id}` - 更新帳戶
- `DELETE /api/v1/accounts/{id}` - 刪除帳戶
- `GET /api/v1/accounts/{id}/balance` - 取得帳戶餘額
- `GET /api/v1/accounts/types` - 取得帳戶類型
- `POST /api/v1/accounts/transfer` - 帳戶轉帳

#### 3.2.2 從DD1模組轉移的API端點
根據8020.md API list文件，以下科目相關端點將轉移至WCM：
- `GET /api/v1/categories` - 取得科目列表
- `POST /api/v1/categories` - 創建科目
- `GET /api/v1/categories/{id}` - 取得科目詳情  
- `PUT /api/v1/categories/{id}` - 更新科目
- `DELETE /api/v1/categories/{id}` - 刪除科目
- `GET /api/v1/categories/tree` - 取得科目樹狀結構

### 3.3 模組功能整合

#### 3.3.1 從BK.js遷移功能
```javascript
// 從BK.js遷移至WCM.js的功能
- createAccount() // 帳戶創建邏輯
- validateAccountExists() // 帳戶存在驗證
- getAccountBalance() // 餘額查詢
- updateAccountBalance() // 餘額更新（保留給BK調用）
```

#### 3.3.2 從DD1.js遷移功能
```javascript
// 從DD1.js遷移至WCM.js的功能
- createCategory() // 科目創建邏輯
- validateCategoryExists() // 科目存在驗證  
- getCategoryTree() // 科目樹狀結構
- categorySuggestion() // 科目建議邏輯
```

### 3.4 版本升級機制

#### 3.4.1 版本規劃
- **WCM.js**: v1.0.0 (新建)
- **BK.js**: v3.2.4 → v3.3.0 (移除帳戶管理功能)
- **ASL.js**: v2.1.7 → v2.2.0 (更新API轉發目標)
- **DD1.js**: 配合DCN-0022移除

#### 3.4.2 函數版次升級
- 所有WCM函數採用1.0.x版本系列
- BK模組中調用WCM的新函數採用3.3.x版本系列

---

## 4. 技術架構設計

### 4.1 WCM模組架構

#### 4.1.1 模組分層設計
```
WCM模組架構:
├── 帳戶管理層
│   ├── 帳戶CRUD操作
│   ├── 帳戶驗證邏輯
│   └── 餘額查詢功能
├── 科目管理層
│   ├── 科目CRUD操作  
│   ├── 科目驗證邏輯
│   └── 科目樹狀結構
└── 統一資料存取層
    ├── Firebase集合操作
    ├── 錯誤處理機制
    └── 日誌記錄功能
```

#### 4.1.2 技術優勢分析
- **單一職責原則**：WCM專責基礎主數據管理
- **介面統一性**：提供一致的CRUD操作介面
- **維護便利性**：統一錯誤處理和資料驗證邏輯
- **MVP聚焦性**：專注核心功能，避免過度設計

### 4.2 依賴關係重構

#### 4.2.1 新的依賴結構
```
重構後的模組依賴關係:
BK → WCM (帳戶科目驗證) + FS + DL + AM
WCM → FS (資料存取) + DL (日誌記錄) + AM (權限驗證)
ASL → WCM (帳戶科目API) + BK (記帳核心) + 其他模組
```

#### 4.2.2 循環依賴防範
- WCM不依賴BK，避免循環依賴
- WCM僅負責資料管理，不涉及業務邏輯計算
- BK調用WCM進行驗證，單向依賴關係

### 4.3 資料流優化設計

#### 4.3.1 記帳流程優化
```
優化後記帳資料流:
ASL → BK → WCM (驗證帳戶+科目) → FS (寫入交易)
```

#### 4.3.2 主數據管理流程
```
主數據管理資料流:
ASL → WCM → FS (直接操作accounts/categories集合)
```

---

## 5. 實作階段規劃

### Phase 1：WCM模組框架建立

**目標**：建立WCM.js基礎框架和核心函數

**具體任務**：
1. 建立 `13. Replit_Module code_BL/1350. WCM.js`
2. 實作基礎帳戶管理函數：createAccount, getAccountList, validateAccountExists
3. 實作基礎科目管理函數：createCategory, getCategoryList, validateCategoryExists
4. 建立統一錯誤處理和日誌記錄機制

**版本規劃**：WCM.js v1.0.0 (新建)

**驗收標準**：
- WCM模組基礎架構建立完成
- 核心CRUD函數實作完成
- 單元測試驗證通過

### Phase 2：API端點轉發更新（Week 2）

**目標**：更新ASL.js轉發邏輯，重新分配API端點

**具體任務**：
1. 更新ASL.js中accounts相關端點，轉發目標從BK改為WCM
2. 更新ASL.js中categories相關端點，轉發目標從DD1改為WCM  
3. 測試所有16個重新分配的API端點
4. 更新8025.md API-BL mapping文件

**版本升級**：ASL.js v2.1.7 → v2.2.0

**驗收標準**：
- 所有API端點轉發正常
- API響應格式符合DCN-0015規範
- 端到端測試驗證通過

### Phase 3：BK模組依賴清理（Week 3）

**目標**：清理BK.js帳戶管理代碼，建立對WCM的依賴

**具體任務**：
1. 從BK.js中移除帳戶管理相關函數
2. 更新BK.js記帳流程，調用WCM進行帳戶科目驗證
3. 更新BK.js函數版次和依賴聲明
4. 完整的記帳流程端到端測試

**版本升級**：BK.js v3.2.4 → v3.3.0

**驗收標準**：
- BK專注記帳核心邏輯，不再包含主數據管理
- 記帳流程通過WCM驗證正常運作
- 所有existing測試案例通過

---

## 6. API端點重新分配清單

### 6.1 帳戶管理端點（8個）- BK → WCM
```javascript
// 從BK模組轉移至WCM模組的API端點
'GET /api/v1/accounts'                    // 取得帳戶列表 (BK → WCM)
'POST /api/v1/accounts'                   // 創建帳戶 (BK → WCM)
'GET /api/v1/accounts/{id}'               // 取得帳戶詳情 (BK → WCM)
'PUT /api/v1/accounts/{id}'               // 更新帳戶 (BK → WCM)  
'DELETE /api/v1/accounts/{id}'            // 刪除帳戶 (BK → WCM)
'GET /api/v1/accounts/{id}/balance'       // 取得帳戶餘額 (BK → WCM)
'GET /api/v1/accounts/types'              // 取得帳戶類型 (BK → WCM)
'POST /api/v1/accounts/transfer'          // 帳戶轉帳 (BK → WCM)
```

### 6.2 科目管理端點（6個）- DD1 → WCM  
```javascript
// 從DD1模組轉移至WCM模組的API端點
'GET /api/v1/categories'                  // 取得科目列表 (DD1 → WCM)
'POST /api/v1/categories'                 // 創建科目 (DD1 → WCM)
'GET /api/v1/categories/{id}'             // 取得科目詳情 (DD1 → WCM)
'PUT /api/v1/categories/{id}'             // 更新科目 (DD1 → WCM)
'DELETE /api/v1/categories/{id}'          // 刪除科目 (DD1 → WCM)
'GET /api/v1/categories/tree'             // 取得科目樹狀結構 (DD1 → WCM)
```

### 6.3 保留在BK模組的記帳相關端點
```javascript
// 記帳核心功能保留在BK模組
'GET /api/v1/transactions'                // 查詢交易列表 (保留在BK)
'POST /api/v1/transactions'               // 新增交易 (保留在BK)  
'POST /api/v1/transactions/quick'         // 快速記帳 (保留在BK)
'GET /api/v1/transactions/dashboard'      // 儀表板數據 (保留在BK)
// ... 其他transactions相關端點
```

---

## 10. 文件更新清單

### 10.1 核心架構文件更新
- `10. Replit_PRD_BL/1001. PRD_BL.md`
  - 更新BL層模組架構圖，新增WCM模組
  - 更新模組職責說明，明確WCM負責主數據管理
  - 更新模組間依賴關係圖

### 10.2 SRS與LLD技術文件新增（3個新增）
- `11. Replit_SRS_BL/1150. WCM_帳戶與科目管理模組.md` - 新增WCM模組SRS  
- `12. Replit_LLD_BL/1250. WCM_帳戶與科目管理模組.md` - 新增WCM模組LLD
- `14. Replit_Test plan_BL/1450. WCM_帳戶與科目管理模組.md` - 新增WCM測試計劃

### 10.3 API規格文件更新  
- `80. Flutter_PRD_APL/8025. API-BL mapping list.md` - 更新API-BL映射關係
- `80. Flutter_PRD_APL/8020. API list.md` - 標註API端點歸屬變更

### 10.4 現有模組文件更新
- `11. Replit_SRS_BL/` - 更新BK模組SRS，移除帳戶管理職責
- `12. Replit_LLD_BL/` - 更新BK模組LLD，新增對WCM的依賴說明  
- `14. Replit_Test plan_BL/` - 更新BK模組測試計劃

**總計：8個文件需要更新或新增**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-11-14 | 初版建立，定義WCM模組創建與帳戶科目管理整合方案 | LCAS PM Team |

---

> **重要提醒**：此變更將對LCAS 2.0 BL層架構產生重大影響，創建全新的WCM模組並重新分配API端點。所有開發人員請嚴格遵循三階段實作規劃，確保每個階段的驗收標準都能達成。

> **MVP原則堅持**：本次重構專注於解決功能分散問題，建立統一的主數據管理模組。避免過度工程化設計，確保在提升維護效率的同時保持架構簡潔性。

> **關鍵Insight**：帳戶與科目作為記帳的基礎主數據，統一管理不僅符合業務邏輯，更能有效降低模組間耦合度。WCM模組的創建為LCAS 2.0建立了穩固的主數據管理基礎，支持後續功能擴展需求。
