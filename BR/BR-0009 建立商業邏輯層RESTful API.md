
# BR-0009 建立商業邏輯層RESTful API

## 目次
1. [需求說明](#1-需求說明)
2. [業務背景與價值主張](#2-業務背景與價值主張)
3. [技術架構設計](#3-技術架構設計)
4. [須新增/修改內容](#4-須新增修改內容)
5. [API 介面規格](#5-api-介面規格)
6. [實作階段規劃](#6-實作階段規劃)
7. [資料庫架構需求](#7-資料庫架構需求)
8. [版本升級計畫](#8-版本升級計畫)
9. [測試策略](#9-測試策略)
10. [風險評估與緩解](#10-風險評估與緩解)
11. [驗收標準](#11-驗收標準)
12. [其他注意事項](#12-其他注意事項)

---

## 1. 需求說明
本次變更目標為：為 LCAS 2.0 各商業邏輯模組建立統一的 RESTful API 介面，實現前後端分離架構，支援 Flutter 應用層對接。建立企業級 API 標準，確保系統可擴展性、維護性和一致性。

此架構將為 LCAS 2.0 提供完整的 API 基礎設施，支援多平台客戶端接入和微服務架構演進。

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **前後端分離**：支援多平台客戶端（Flutter、Web、第三方整合）
- **支援LINE OA**: LINE OA與Android App (Flutter)、iOS App (Flutter)
- **API 標準化**：建立企業級 RESTful API 設計規範
- **開發效率**：前後端並行開發，加速產品迭代
- **系統現代化**：支援微服務架構和雲端部署

### 2.2 預期效益
- **開發效率提升 40%**：前後端並行開發，減少協作等待時間
- **維護成本降低 30%**：統一 API 介面減少重複開發
- **系統擴展性增強**：支援多平台和第三方系統整合
- **用戶體驗優化**：更快的回應速度和更穩定的服務

### 2.3 競爭優勢
- **技術領先**：採用現代化 API 架構設計
- **多平台支援**：同時支援行動端、網頁端和 API 整合
- **開發者友善**：完整的 API 文件和開發工具

---

## 3. 技術架構設計

### 3.1 混合架構設計
**採用混合架構方案，平衡效能與安全性**

```
應用邏輯層 (Flutter/Dart + Web)          LINE OA 平台
       ↓                                     ↓
[混合路由] API分層策略              [直接 Webhook]
       ↓                                     ↓
高頻低延遲API (直接存取) | 安全敏感API (透過閘道) ← WH模組
       ↓                                     ↓
商業邏輯層 (Node.js模組群) ←─────────────────┘
       ↓
資料存取層 (Firestore)
```

### 3.2 API分層策略

#### 3.2.1 高頻低延遲API（直接模組存取）
- **記帳功能** (BK模組) - 追求最佳記帳體驗
- **即時同步** (CM模組) - WebSocket即時協作

#### 3.2.2 安全敏感API（透過API閘道）
- **使用者認證** (AM模組) - 統一身份驗證
- **權限管理** (CM模組) - 集中權限控制
- **系統管理** (System APIs) - 集中管理監控

#### 3.2.3 LINE OA特殊處理
- **LINE OA平台**: 不經過應用邏輯層和API閘道，直接與WH模組通訊
- **Webhook處理**: 維持現有直接處理流程，確保即時回應
- **架構獨立性**: LINE OA與Flutter應用邏輯層完全分離，各自最佳化

### 3.3 核心基礎設施模組
```
api-gateway.js v1.0.0     - API閘道（安全敏感API）
direct-router.js v1.0.0   - 直接路由（高頻API）  
auth-middleware.js v1.0.0 - 認證中介軟體  
error-handler.js v1.0.0   - 統一錯誤處理
```

### 3.4 模組 API 端點架構

#### 3.4.1 通過API閘道的端點（安全敏感）
```
/gateway/v1/auth/*           - AM 模組 (6 個端點)
/gateway/v1/app/collaborate/permissions/* - CM 模組權限管理 (2 個端點)
/gateway/v1/system/*         - 系統管理 APIs (8 個端點)
```

#### 3.4.2 直接存取端點（高頻低延遲）
```
/direct/v1/app/ledger/*      - BK 模組 (2 個端點)
/direct/v1/app/sync/*        - CM 模組即時同步 (1 個端點)
```

#### 3.4.3 混合端點（根據功能分流）
```
/api/v1/app/projects/*       - MLS 模組 (6 個端點)
/api/v1/app/budgets/*        - BM 模組 (3 個端點)
/api/v1/reports/*            - MRA 模組 (3 個端點)
/api/v1/backup/*             - BS 模組 (2 個端點)
```

#### 3.4.4 LINE OA專用（不經閘道）
```
/webhook/*                   - WH 模組 LINE Webhook
```

#### 3.4.5 WH模組系統管理API（透過閘道）
```
/gateway/v1/system/webhook/health     - Webhook健康檢查
/gateway/v1/system/webhook/logs       - Webhook日誌查詢
```

---

## 4. 須新增/修改內容

### 4.1 新建核心基礎設施模組

#### 4.1.1 API 閘道模組 (api-gateway.js v1.0.0)
**功能職責**：
- 安全敏感API的統一入口管理
- 認證授權集中處理
- 流量控制與監控
- API版本管理和向下相容性

**核心函數**（4個）：
- `initializeApiGateway()` - 初始化 API 閘道
- `routeSecureEndpoints()` - 路由安全端點
- `enforceSecurityPolicies()` - 執行安全政策
- `monitorApiUsage()` - 監控API使用狀況

#### 4.1.2 直接路由模組 (direct-router.js v1.0.0)
**功能職責**：
- 高頻API的直接路由處理
- 最小延遲的請求分發
- 效能最佳化路由

**核心函數**（3個）：
- `initializeDirectRouter()` - 初始化直接路由器
- `handleHighFrequencyApis()` - 處理高頻API
- `optimizeRoutePerformance()` - 最佳化路由效能

#### 4.1.3 認證中介軟體模組 (auth-middleware.js v1.0.0)
**功能職責**：
- JWT Token 驗證和解析
- 使用者權限檢查和角色控制
- API 存取控制和安全性檢查

**核心函數**（4個）：
- `authenticateToken()` - JWT Token 驗證
- `authorizeUser()` - 使用者權限檢查
- `validateApiAccess()` - API 存取權限驗證
- `handleAuthError()` - 認證錯誤處理

#### 4.1.4 統一錯誤處理模組 (error-handler.js v1.0.0)
**功能職責**：
- 統一錯誤回應格式和狀態碼
- 錯誤日誌記錄和監控整合
- 開發環境和生產環境錯誤處理差異

**核心函數**（4個）：
- `handleApiError()` - 統一 API 錯誤處理
- `formatErrorResponse()` - 標準化錯誤回應格式
- `logApiError()` - API 錯誤日誌記錄
- `sanitizeErrorMessage()` - 錯誤訊息安全處理

### 4.2 業務模組 API 端點升級

#### 4.2.1 AM 模組升級至 v2.0.0（新增 6 個 API 端點函數）
- `AM_apiRegister()` - 使用者註冊 API
- `AM_apiLogin()` - 使用者登入 API
- `AM_apiProfile()` - 使用者資料查詢 API
- `AM_apiUpdateProfile()` - 使用者資料更新 API
- `AM_apiChangePassword()` - 密碼變更 API
- `AM_apiDeleteAccount()` - 帳號刪除 API

#### 4.2.2 BK 模組升級至 v2.0.0（新增 2 個 API 端點函數）
- `BK_apiCreateEntry()` - 建立記帳記錄 API
- `BK_apiGetEntries()` - 查詢記帳記錄 API

#### 4.2.3 MLS 模組升級至 v2.0.0（新增 6 個 API 端點函數）
- `MLS_apiCreateProject()` - 建立專案 API
- `MLS_apiGetProjects()` - 查詢專案清單 API
- `MLS_apiUpdateProject()` - 更新專案資訊 API
- `MLS_apiDeleteProject()` - 刪除專案 API
- `MLS_apiInviteMember()` - 邀請成員 API
- `MLS_apiRemoveMember()` - 移除成員 API

#### 4.2.4 BM 模組升級至 v2.0.0（新增 3 個 API 端點函數）
- `BM_apiCreateBudget()` - 建立預算 API
- `BM_apiGetBudgets()` - 查詢預算清單 API
- `BM_apiUpdateBudget()` - 更新預算 API

#### 4.2.5 CM 模組升級至 v2.0.0（新增 3 個 API 端點函數）
- `CM_apiGetCollaborations()` - 查詢協作清單 API
- `CM_apiUpdatePermission()` - 更新權限 API
- `CM_apiLeaveProject()` - 離開專案 API

#### 4.2.6 MRA 模組升級至 v2.0.0（新增 3 個 API 端點函數）
- `MRA_apiGenerateReport()` - 生成報告 API
- `MRA_apiGetReports()` - 查詢報告清單 API
- `MRA_apiExportReport()` - 匯出報告 API

#### 4.2.7 BS 模組升級至 v2.0.0（新增 2 個 API 端點函數）
- `BS_apiCreateBackup()` - 建立備份 API
- `BS_apiRestoreBackup()` - 還原備份 API

#### 4.2.8 WH 模組升級至 v2.2.0（新增 2 個 API 端點函數）
- `WH_apiHealthCheck()` - Webhook健康檢查 API
- `WH_apiGetLogs()` - Webhook日誌查詢 API

### 4.3 主程式整合升級

#### 4.3.1 index.js 升級至 v2.2.0
- 整合 API 路由器模組
- 配置認證中介軟體
- 設定錯誤處理機制
- 實作 API 文件生成

---

## 5. API 介面規格

### 5.1 API 設計原則
- **RESTful 設計**：遵循 REST 架構原則
- **統一回應格式**：標準化成功和錯誤回應
- **版本控制**：支援 API 版本管理
- **安全性**：JWT 認證和權限控制

### 5.2 標準回應格式
```json
{
  "success": true|false,
  "data": {...},
  "message": "操作結果訊息",
  "timestamp": "2025-07-26T10:30:00Z",
  "version": "v1.0"
}
```

### 5.3 錯誤回應格式
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "錯誤描述",
    "details": {...}
  },
  "timestamp": "2025-07-26T10:30:00Z",
  "version": "v1.0"
}
```

### 5.4 認證機制
- **Authorization Header**：`Bearer <JWT_TOKEN>`
- **Token 有效期**：24 小時
- **Refresh Token**：7 天有效期

---

## 6. 實作階段規劃

### Phase 1：混合架構基礎建立
- 建立API閘道模組 (api-gateway.js)
- 建立直接路由模組 (direct-router.js)
- 實作認證中介軟體 (auth-middleware.js)
- 建立統一錯誤處理機制 (error-handler.js)

### Phase 2：AM 模組 API 實作（Week 2）
- 實作使用者認證相關 6 個 API 端點
- 整合 JWT Token 生成和驗證
- 完成使用者管理 API 測試

### Phase 3：記帳核心模組 API（Week 3）
- 實作 BK 模組 2 個 API 端點
- 實作 MLS 模組 6 個 API 端點
- 完成多帳本和記帳功能 API

### Phase 4：進階功能模組 API（Week 4）
- 實作 BM 模組 3 個 API 端點
- 實作 CM 模組 3 個 API 端點
- 完成預算和協作功能 API

### Phase 5：報告和備份模組 API（Week 5）
- 實作 MRA 模組 3 個 API 端點
- 實作 BS 模組 2 個 API 端點
- 完成報告生成和備份功能 API

### Phase 6：整合測試和文件（Week 6）
- 完整 API 整合測試
- 生成 API 文件
- 效能測試和優化

---

## 7. 資料庫架構需求

### 7.1 無需新增 Firestore 集合
現有 Firestore 架構已足夠支援 API 需求，主要使用：
- `users/` - 使用者基本資料
- `ledgers/` - 帳本和記帳資料
- `projects/` - 多帳本專案資料
- `budgets/` - 預算管理資料
- `collaborations/` - 協作權限資料
- `reports/` - 報告資料
- `backups/` - 備份資料

### 7.2 API 回應快取策略
- **記憶體快取**：常用查詢結果快取 5 分鐘
- **Redis 整合**：未來擴展高效能快取機制
- **CDN 整合**：靜態資源和報告檔案快取

---

## 8. 版本升級計畫

### 8.1 新建模組版本
- **api-gateway.js**：v1.0.0（安全敏感API閘道）
- **direct-router.js**：v1.0.0（高頻API直接路由）
- **auth-middleware.js**：v1.0.0
- **error-handler.js**：v1.0.0

### 8.2 業務模組版本升級
- **AM.js**：v1.x.x → v2.0.0（新增 6 個 API 函數）
- **BK.js**：v1.x.x → v2.0.0（新增 2 個 API 函數）
- **MLS.js**：v1.x.x → v2.0.0（新增 6 個 API 函數）
- **BM.js**：v1.x.x → v2.0.0（新增 3 個 API 函數）
- **CM.js**：v1.x.x → v2.0.0（新增 3 個 API 函數）
- **MRA.js**：v1.x.x → v2.0.0（新增 3 個 API 函數）
- **BS.js**：v1.x.x → v2.0.0（新增 2 個 API 函數）
- **WH.js**：v2.1.x → v2.2.0（新增 2 個 API 函數）

### 8.3 主程式版本升級
- **index.js**：v2.1.x → v2.2.0（整合 API 路由系統）

### 8.4 函數版本管理
- 所有新增 API 函數：v1.0.0
- 現有函數維持原版本號
- 修改函數：版本號遞增

---

## 9. 測試策略

### 9.1 單元測試
- **API 端點測試**：每個 API 函數獨立測試
- **中介軟體測試**：認證和錯誤處理測試
- **路由測試**：API 路由正確性測試

### 9.2 整合測試
- **端到端 API 測試**：完整 API 流程測試
- **認證流程測試**：JWT Token 生命週期測試
- **跨模組協作測試**：模組間 API 呼叫測試

### 9.3 效能測試
- **API 回應時間**：單一請求 < 200ms
- **並發處理能力**：支援 1000+ 並發請求
- **記憶體使用**：API 服務記憶體穩定性

### 9.4 安全性測試
- **認證安全性**：JWT Token 安全性驗證
- **權限控制**：API 存取權限測試
- **資料驗證**：輸入資料安全性檢查

---

## 10. 風險評估與緩解

### 10.1 技術風險
- **風險**：大規模 API 架構改造可能影響系統穩定性
- **緩解**：採用漸進式實作，保持向下相容性，建立完整回滾機制

### 10.2 整合風險
- **風險**：前後端 API 介面不一致可能影響開發效率
- **緩解**：建立詳細 API 規格文件，實作 API Mock 服務，進行充分協作測試

### 10.3 效能風險
- **風險**：API 中介軟體可能影響系統效能
- **緩解**：實作高效能中介軟體，建立效能監控，優化關鍵路徑

### 10.4 安全風險
- **風險**：API 開放可能增加安全攻擊面
- **緩解**：實作完整認證授權機制，API 存取限制，安全性測試

---

## 11. 驗收標準

### 11.1 功能驗收
- [ ] 4 個核心基礎設施模組正常運作（含混合架構）
- [ ] 30 個業務模組 API 端點完整實作
- [ ] 混合路由架構運作正常（閘道+直接存取）
- [ ] JWT 認證和授權機制正常運作
- [ ] 統一錯誤處理和回應格式一致
- [ ] LINE OA直接通訊路徑保持暢通

### 11.2 效能驗收
- [ ] 直接存取API 平均回應時間 < 100ms
- [ ] 閘道API 平均回應時間 < 200ms
- [ ] LINE OA Webhook 回應時間 < 50ms
- [ ] 並發處理能力 > 1000 請求/秒
- [ ] 系統可用性 > 99.9%
- [ ] 記憶體使用穩定，無記憶體洩漏

### 11.3 安全性驗收
- [ ] JWT Token 安全性驗證通過
- [ ] API 權限控制正確執行
- [ ] 資料輸入驗證和清理完善
- [ ] HTTPS 和資料加密保護

### 11.4 整合驗收
- [ ] Flutter 前端成功對接所有 API
- [ ] API 文件完整且準確
- [ ] 開發者工具和範例程式完備
- [ ] 生產環境部署成功

---

## 12. 其他注意事項

### 12.1 開發規範
- **程式碼風格**：遵循現有 ESLint 和 Prettier 設定
- **註解標準**：每個 API 函數需要完整的 JSDoc 註解
- **錯誤處理**：統一使用 error-handler 模組處理錯誤
- **日誌記錄**：重要 API 操作需記錄到 DL 模組

### 12.2 API 文件
- **OpenAPI 規格**：使用 Swagger/OpenAPI 3.0 標準
- **互動式文件**：提供 Swagger UI 介面
- **範例程式**：每個 API 提供完整使用範例
- **SDK 生成**：支援多語言 SDK 自動生成

### 12.3 監控和維護
- **API 監控**：實作 API 回應時間和錯誤率監控
- **效能指標**：建立 API 效能 Dashboard
- **版本管理**：建立 API 版本升級和棄用機制
- **文件同步**：API 變更時同步更新文件

### 12.4 部署策略
- **藍綠部署**：採用零停機部署策略
- **環境管理**：開發、測試、生產環境隔離
- **設定管理**：API 端點和認證設定外部化
- **健康檢查**：實作 API 健康檢查端點

---

> **重要提醒**：此需求將為 LCAS 2.0 建立完整的 RESTful API 架構，為系統現代化和多平台支援奠定基礎。所有開發人員請嚴格遵循 API 設計原則和安全規範，確保系統穩定性和使用者體驗。API 架構的建立將直接影響前端開發效率和用戶體驗，請謹慎實作並充分測試。
