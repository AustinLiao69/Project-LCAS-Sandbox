
# DCN-0019 重構APL層_P2

**版本**: v1.0.0  
**建立日期**: 2025-10-22  
**最後更新**: 2025-10-22  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [建立統一APL Gateway模組](#31-建立統一apl-gateway模組)
   - 3.2 [P2 API端點路由整合](#32-p2-api端點路由整合)
   - 3.3 [統一回應格式整合](#33-統一回應格式整合)
   - 3.4 [版本升級機制](#34-版本升級機制)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [統一Gateway架構](#41-統一gateway架構)
   - 4.2 [P2 API路由映射設計](#42-p2-api路由映射設計)
   - 4.3 [DCN-0015格式整合機制](#43-dcn-0015格式整合機制)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [API端點整合清單](#6-api端點整合清單)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：重構P2階段APL層架構，建立統一的APL Gateway模組，解決分散式模組設計問題。根據0090 Sprint計畫，P2階段涵蓋預算管理、多帳本管理與協作功能，需要建立統一的API轉發窗口以提升架構一致性和維護效率。

此變更將實現：
1. 建立專注P2功能的統一APL Gateway（APL.dart）
2. 整合8104、8105、8107三個服務的30個API端點
3. 統一DCN-0015回應格式解析機制
4. 建立可擴展的P3-P7基礎架構

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **架構一致性需求**：P2階段採用與ASL.js相同的統一Gateway設計模式
- **維護效率提升**：避免重複P1分散式設計錯誤，降低維護複雜度
- **MVP聚焦原則**：專注P2核心功能實現，建立可持續發展基礎
- **擴展性準備**：為P3-P7階段建立統一的API轉發基礎

### 2.2 預期效益
- **開發效率提升**：統一Gateway減少重複開發工作
- **維護成本降低**：單一模組降低跨模組維護複雜度
- **架構統一性**：與ASL.js設計保持完全一致
- **可持續發展**：為後續Phase建立可擴展基礎架構

---

## 3. 須新增/修改內容

### 3.1 建立統一APL Gateway模組

#### 3.1.1 新建模組規格
- **檔案名稱**：`83. Flutter_Module code(API route)_APL/APL.dart`
- **模組版本**：v1.0.0 → v1.2.0
- **主要職責**：統一處理P2階段Flutter APP與ASL層的API轉發
- **架構模式**：單一Gateway轉發P2所有API請求

#### 3.1.2 核心功能設計
```dart
class APLGateway {
  // 統一HTTP客戶端
  final http.Client _httpClient;
  
  // P2 API路由映射表
  final Map<String, String> _p2RouteMapping;
  
  // 統一請求處理方法
  Future<UnifiedApiResponse<T>> forwardRequest<T>(
    String method,
    String endpoint, 
    Map<String, dynamic>? body,
    T Function(dynamic) dataParser
  );
  
  // P2專門服務方法
  LedgerService get ledger => LedgerService(this);      // 8104
  AccountService get account => AccountService(this);   // 8105  
  BudgetService get budget => BudgetService(this);      // 8107
}
```

### 3.2 P2 API端點路由整合

#### 3.2.1 服務模組整合範圍

**8104 帳本管理服務** → 整合至APL Gateway
- 14個帳本管理API端點轉發邏輯
- 多帳本CRUD操作
- 帳本權限管理
- 協作帳本處理

**8105 帳戶管理服務** → 整合至APL Gateway  
- 8個帳戶管理API端點
- 帳戶分類管理
- 帳戶餘額追蹤
- 多帳本帳戶關聯

**8107 預算管理服務** → 整合至APL Gateway
- 8個預算管理API端點
- 預算設定與追蹤
- 預算警示機制
- 預算報表生成

#### 3.2.2 統一資料模型管理
```dart
// 統一回應模型（符合DCN-0015）
class UnifiedApiResponse<T> {
  final bool success;
  final T? data;
  final String message;
  final Map<String, dynamic>? metadata;
  final ApiError? error;
}

// P2專用錯誤模型
class ApiError {
  final String code;
  final String message;
  final Map<String, dynamic>? details;
}
```

### 3.3 統一回應格式整合

#### 3.3.1 DCN-0015格式解析
- **基礎錯誤處理機制**：統一解析ASL.js回傳的標準格式
- **成功回應處理**：解析success/data/metadata欄位
- **錯誤回應處理**：解析error/code/message欄位
- **四模式差異化處理**：根據metadata中的userMode進行差異化處理

### 3.4 版本升級機制

#### 3.4.1 版本規劃
- **APL.dart**: v1.0.0 (新建) → v1.1.0 (功能完整) → v1.2.0 (正式版)
- **83號資料夾結構**：保持現有結構，新增APL.dart作為主要Gateway

#### 3.4.2 函數版次升級
- 所有P2轉發函數版次為1.0.x版本系列
- 統一處理函數採用標準化版本控制

---

## 4. 技術架構設計

### 4.1 統一Gateway架構

#### 4.1.1 服務分層設計
```
Flutter APP → APL Gateway (APL.dart) → ASL.js (Port 5000) → BL層函數
```

#### 4.1.2 技術優勢分析
- **單一職責原則**：APL.dart專責P2 API轉發
- **架構一致性**：與ASL.js採用相同的Gateway模式
- **維護便利性**：統一錯誤處理和回應格式解析
- **MVP聚焦性**：專注P2核心功能，避免過度設計

### 4.2 P2 API路由映射設計

#### 4.2.1 路由映射表結構
```dart
final Map<String, String> p2ApiRouteMapping = {
  // 帳本管理路由 (8104 - 14個端點)
  'ledgers.list': '/api/v1/ledgers',
  'ledgers.create': '/api/v1/ledgers',
  'ledgers.update': '/api/v1/ledgers/:id',
  'ledgers.delete': '/api/v1/ledgers/:id',
  'ledgers.share': '/api/v1/ledgers/:id/share',
  // ... 其他帳本管理端點
  
  // 帳戶管理路由 (8105 - 8個端點)
  'accounts.list': '/api/v1/accounts',
  'accounts.create': '/api/v1/accounts',
  'accounts.update': '/api/v1/accounts/:id',
  'accounts.balance': '/api/v1/accounts/:id/balance',
  // ... 其他帳戶管理端點
  
  // 預算管理路由 (8107 - 8個端點)
  'budgets.list': '/api/v1/budgets',
  'budgets.create': '/api/v1/budgets',
  'budgets.update': '/api/v1/budgets/:id',
  'budgets.tracking': '/api/v1/budgets/:id/tracking',
  // ... 其他預算管理端點
};
```

### 4.3 DCN-0015格式整合機制

#### 4.3.1 統一回應處理
```dart
class ResponseHandler {
  static UnifiedApiResponse<T> parseResponse<T>(
    http.Response response,
    T Function(dynamic) dataParser
  ) {
    final responseBody = jsonDecode(response.body);
    
    return UnifiedApiResponse<T>(
      success: responseBody['success'] ?? false,
      data: responseBody['success'] ? dataParser(responseBody['data']) : null,
      message: responseBody['message'] ?? '',
      metadata: responseBody['metadata'],
      error: responseBody['success'] ? null : ApiError.fromJson(responseBody['error'])
    );
  }
}
```

---

## 5. 實作階段規劃

### Phase 1：統一APL Gateway框架建立（Week 1）

**目標**：建立APL.dart統一框架，專注P2功能

**具體任務**：
1. 建立 `83. Flutter_Module code(API route)_APL/APL.dart`
2. 實作統一HTTP請求處理機制，對接ASL.js (Port 5000)
3. 整合DCN-0015統一回應格式解析
4. 建立基礎錯誤處理機制

**版本規劃**：APL.dart v1.0.0 (新建)

**驗收標準**：
- APL Gateway基礎架構建立完成
- DCN-0015格式解析機制實作完成
- 基本HTTP轉發功能正常運作

### Phase 2：P2 API端點路由實作（Week 2）

**目標**：實作P2階段30個API端點路由

**具體任務**：
1. 實作8104帳本管理服務14個API端點路由邏輯
2. 實作8105帳戶管理服務8個API端點路由邏輯  
3. 實作8107預算管理服務8個API端點路由邏輯
4. 統一資料模型解析：根據DCN-0015格式解析success/data/error欄位

**版本升級**：APL.dart → v1.1.0

**驗收標準**：
- 所有30個P2 API端點轉發功能正常
- 統一資料模型處理完成
- DCN-0015格式完全整合

### Phase 3：整合驗證與完成（Week 3）

**目標**：驗證P2功能完整性

**具體任務**：
1. P2預算管理、多帳本、帳戶管理功能端對端驗證
2. 為P3-P7建立擴展基礎

**最終版本**：APL.dart → v1.2.0 (正式版)

**驗收標準**：
- P2統一Gateway完整功能驗證通過
- 為後續Phase建立擴展基礎
- 架構一致性驗證完成

---

## 6. API端點整合清單

### 6.1 帳本管理服務端點整合（8104 - 14個端點）
```dart
// P2帳本管理API端點清單
'GET /api/v1/ledgers'                     // 取得帳本列表
'POST /api/v1/ledgers'                    // 建立新帳本
'GET /api/v1/ledgers/:id'                 // 取得帳本詳情
'PUT /api/v1/ledgers/:id'                 // 更新帳本
'DELETE /api/v1/ledgers/:id'              // 刪除帳本
'POST /api/v1/ledgers/:id/share'          // 分享帳本
'GET /api/v1/ledgers/:id/members'         // 取得帳本成員
'PUT /api/v1/ledgers/:id/permissions'     // 更新成員權限
'GET /api/v1/ledgers/:id/transactions'    // 取得帳本交易
'GET /api/v1/ledgers/:id/summary'         // 取得帳本摘要
'POST /api/v1/ledgers/:id/invite'         // 邀請成員
'DELETE /api/v1/ledgers/:id/members/:uid' // 移除成員
'GET /api/v1/ledgers/:id/activities'      // 取得帳本活動
'PUT /api/v1/ledgers/:id/settings'        // 更新帳本設定
```

### 6.2 帳戶管理服務端點整合（8105 - 8個端點）
```dart
// P2帳戶管理API端點清單
'GET /api/v1/accounts'                    // 取得帳戶列表
'POST /api/v1/accounts'                   // 建立新帳戶
'GET /api/v1/accounts/:id'                // 取得帳戶詳情
'PUT /api/v1/accounts/:id'                // 更新帳戶
'DELETE /api/v1/accounts/:id'             // 刪除帳戶
'GET /api/v1/accounts/:id/balance'        // 取得帳戶餘額
'GET /api/v1/accounts/:id/transactions'   // 取得帳戶交易
'PUT /api/v1/accounts/:id/settings'       // 更新帳戶設定
```

### 6.3 預算管理服務端點整合（8107 - 8個端點）
```dart
// P2預算管理API端點清單
'GET /api/v1/budgets'                     // 取得預算列表
'POST /api/v1/budgets'                    // 建立新預算
'GET /api/v1/budgets/:id'                 // 取得預算詳情
'PUT /api/v1/budgets/:id'                 // 更新預算
'DELETE /api/v1/budgets/:id'              // 刪除預算
'GET /api/v1/budgets/:id/tracking'        // 取得預算追蹤
'GET /api/v1/budgets/:id/alerts'          // 取得預算警示
'POST /api/v1/budgets/:id/adjust'         // 調整預算額度
```

---

## 10. 文件更新清單

### 10.1 核心架構文件更新
- `80. Flutter_PRD_APL/8001. PRD_APL.md`
  - 更新P2階段統一Gateway架構設計
  - 新增APL.dart規格說明
  - 更新P2 API轉發機制描述

### 10.2 LLD技術文件更新（1個新增）
- `82. Flutter_LLD_APL/8200. APL_Gateway.md`
  - 新增P2統一Gateway詳細設計文件
  - 包含DCN-0015格式整合設計
  - P2 API路由映射規範

### 10.3 測試計劃文件更新（1個新增）
- `84. Flutter_Test plan_APL/8400. APL_Gateway.md` - 新增P2統一測試計劃

### 10.4 API規格文件標註
- `80. Flutter_PRD_APL/8020. API list.md` - 標註P2 API實作位置變更
- `80. Flutter_PRD_APL/8025. API-BL mapping list.md` - 更新P2映射關係

**總計：5個文件需要更新或新增**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-10-22 | 初版建立，定義P2階段APL層統一Gateway重構計畫 | LCAS PM Team |

---

> **重要提醒**：此變更將對LCAS 2.0 P2階段APL層架構產生重大影響，實現統一Gateway設計模式。所有開發人員請嚴格遵循三階段實作規劃，確保每個階段的驗收標準都能達成。

> **MVP原則堅持**：本次重構專注於P2階段核心功能實現，避免過度工程化設計，確保在提升架構一致性的同時建立可持續發展的基礎。

> **關鍵Insight**：架構統一性是MVP成功的基石。P2階段採用統一APL Gateway不僅解決當前維護問題，更為後續P3-P7階段建立可擴展基礎，符合敏捷開發的可持續性原則。
