
# DCN-0011 建立API service layer

**版本**: v1.0.0  
**建立日期**: 2025-09-18  
**最後更新**: 2025-09-18  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [新增 ASL.js 服務層](#31-新增-asljs-服務層)
   - 3.2 [index.js 架構重構](#32-indexjs-架構重構)
   - 3.3 [APL Gateway 配置更新](#33-apl-gateway-配置更新)
   - 3.4 [跨檔案整合修改](#34-跨檔案整合修改)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [服務分層架構](#41-服務分層架構)
   - 4.2 [端口配置策略](#42-端口配置策略)
   - 4.3 [API路由設計](#43-api路由設計)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [API 端點遷移清單](#6-api-端點遷移清單)
### 7. [測試策略](#7-測試策略)
### 8. [風險評估與緩解](#8-風險評估與緩解)
### 9. [驗收標準](#9-驗收標準)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：建立獨立的 API Service Layer (ASL)，將目前 index.js 中混合的 LINE Webhook 處理與 RESTful API 端點進行職責分離，實現更清晰的系統架構和更好的可維護性。

此變更將解決目前 index.js 過於臃腫的問題，通過創建專門的 ASL.js 服務來處理 132 個 RESTful API 端點，而 index.js 專注於 LINE OA Webhook 處理。

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **架構清晰度**：分離不同職責的服務，提升代碼可讀性和維護性
- **擴展性需求**：支援未來 Flutter APP 與 LINE OA 的獨立擴展
- **部署靈活性**：允許兩個服務獨立部署和擴展
- **開發效率**：減少開發人員在單一檔案中的衝突和複雜度

### 2.2 預期效益
- **職責分離**：LINE Webhook 與 API 服務各司其職
- **獨立擴展**：兩個服務可以根據負載需求獨立擴展
- **維護便利**：降低單一檔案的複雜度，提升維護效率
- **測試改善**：分離的服務更容易進行單元測試和整合測試
- **端口管理**：明確的端口分配避免衝突

---

## 3. 須新增/修改內容

### 3.1 新增 ASL.js 服務層

#### 3.1.1 核心服務架構
- **檔案名稱**：`ASL.js`
- **服務端口**：5000
- **主要職責**：處理 132 個 RESTful API 端點
- **架構模式**：Express.js RESTful API 服務

#### 3.1.2 API 端點群組（132個端點）
```javascript
// 認證服務 (11 個端點)
app.post('/api/v1/auth/register');
app.post('/api/v1/auth/login');
app.post('/api/v1/auth/google-login');
// ... 其他認證端點

// 用戶管理 (11 個端點)
app.get('/api/v1/users/profile');
app.put('/api/v1/users/profile');
// ... 其他用戶管理端點

// 記帳交易 (20 個端點)
app.get('/api/v1/transactions');
app.post('/api/v1/transactions');
// ... 其他交易端點

// 其他服務模組 (90 個端點)
// 帳本管理、帳戶管理、科目管理等
```

#### 3.1.3 中介軟體整合
- CORS 配置
- 驗證中介軟體
- 錯誤處理中介軟體
- 日誌記錄中介軟體
- 速率限制中介軟體

#### 3.1.4 BL 層整合
- 整合所有 BL 模組 (BK, AM, FS, DD1, DD2, DD3, 等)
- 統一錯誤處理機制
- 統一回應格式標準

### 3.2 index.js 架構重構

#### 3.2.1 保留功能（5個端點）
```javascript
// LINE Webhook 專用端點
app.post('/webhook');           // LINE Webhook 處理
app.get('/health');            // 健康檢查
app.get('/test-wh');           // WH 模組測試
app.get('/check-https');       // HTTPS 檢查
app.get('/');                  // 系統狀態
```

#### 3.2.2 移除內容
- 移除所有 `/api/v1/*` 路徑的端點
- 移除 `POST /testAPI` 測試端點
- 保留 WH 模組相關功能
- 保留 LINE OA 特定的中介軟體

#### 3.2.3 服務端口
- **維持端口**：3000
- **專注職責**：LINE OA Webhook 處理

### 3.3 APL Gateway 配置更新

#### 3.3.1 目標 URL 重新配置
```dart
// 更新 APL Gateway 設定
const String apiBaseUrl = 'http://localhost:5000';  // 指向 ASL.js
const String webhookUrl = 'http://localhost:3000';  // 指向 index.js (如需要)
```

#### 3.3.2 路由分流策略
- **Flutter APP API 請求** → Port 5000 (ASL.js)
- **LINE OA Webhook** → Port 3000 (index.js)

### 3.4 跨檔案整合修改

#### 3.4.1 共用模組管理
- BL 層模組需要在兩個服務中正確導入
- 共用設定檔案的統一管理
- Firebase 配置的共用

#### 3.4.2 日誌系統統一
- 統一日誌格式
- 分離日誌檔案（ASL.log, Webhook.log）
- 統一錯誤追蹤機制

---

## 4. 技術架構設計

### 4.1 服務分層架構
```
Flutter APP → APL Gateway (Dart) → ASL.js (Port 5000) → BL層函數
LINE OA → index.js (Port 3000) → BL層函數
```

### 4.2 端口配置策略
| 服務 | 端口 | 職責 | 主要客戶端 |
|------|------|------|-----------|
| ASL.js | 5000 | RESTful API 服務 | Flutter APP |
| index.js | 3000 | LINE Webhook 處理 | LINE Platform |

### 4.3 API路由設計
```javascript
// ASL.js 路由結構
/api/v1/auth/*          - 認證服務
/api/v1/users/*         - 用戶管理
/api/v1/transactions/*  - 記帳交易
/api/v1/ledgers/*       - 帳本管理
/api/v1/accounts/*      - 帳戶管理
/api/v1/categories/*    - 科目管理
/api/v1/budgets/*       - 預算管理
/api/v1/reports/*       - 報表分析
/api/v1/ai/*           - AI 助理
/api/v1/gamification/* - 激勵系統
/api/v1/system/*       - 系統服務
/api/v1/backup/*       - 備份服務
/api/v1/notifications/* - 通知管理
```

---

## 5. 實作階段規劃

### Phase 1：架構設計與文件更新（Week 1）
- ✅ 撰寫 DCN-0011 文件
- 📝 更新 0015. Product_SPEC_LCAS_2.0.md 技術架構
- 📝 更新相關設計文件

### Phase 2：ASL.js 服務建立（Week 2）
- 🔧 創建 ASL.js 基礎架構
- 🔧 實作 Express.js 服務框架
- 🔧 設定 Port 5000 監聽
- 🔧 整合基礎中介軟體

### Phase 3：API 端點遷移（Week 3-4）
- 🔧 從 index.js 遷移 132 個 API 端點
- 🔧 重新整合 BL 層模組
- 🔧 實作統一錯誤處理
- 🔧 實作統一回應格式

### Phase 4：index.js 重構（Week 5）
- 🔧 移除已遷移的 API 端點
- 🔧 保留 LINE Webhook 核心功能
- 🔧 優化 Webhook 處理流程
- 🔧 更新相關測試

### Phase 5：整合測試與配置（Week 6）
- 🧪 ASL.js 功能測試
- 🧪 index.js 功能測試
- 🔧 更新 APL Gateway 配置
- 🧪 端到端整合測試

### Phase 6：文件更新與部署（Week 7）
- 📝 更新所有相關文件
- 🧪 SIT 測試更新
- 🚀 生產環境部署準備
- 📋 上線檢查清單

---

## 6. API 端點遷移清單

### 6.1 認證服務端點（11個）
```javascript
// 從 index.js 遷移至 ASL.js
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/google-login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
GET /api/v1/auth/verify-reset-token
POST /api/v1/auth/reset-password
POST /api/v1/auth/verify-email
POST /api/v1/auth/bind-line
GET /api/v1/auth/bind-status
```

### 6.2 核心業務端點（121個）
- 用戶管理：11個端點
- 記帳交易：20個端點
- 帳本管理：14個端點
- 帳戶管理：8個端點
- 科目管理：6個端點
- 預算管理：8個端點
- 報表分析：15個端點
- AI 助理：6個端點
- 激勵系統：6個端點
- 系統服務：13個端點
- 備份服務：6個端點
- 通知管理：8個端點

### 6.3 保留在 index.js 的端點（5個）
```javascript
// 維持在 index.js
POST /webhook              // LINE Webhook 核心
GET /health               // 系統健康檢查
GET /test-wh              // Webhook 測試
GET /check-https          // HTTPS 檢查
GET /                     // 根路徑狀態
```

---

## 7. 測試策略

### 7.1 單元測試
#### ASL.js 測試案例
- **TC-ASL-001**: API 端點路由測試
  - 驗證所有 132 個端點正確註冊
  - 測試路由參數解析
  - 驗證中介軟體執行順序

- **TC-ASL-002**: 認證中介軟體測試
  - JWT token 驗證
  - 權限檢查機制
  - 無效 token 處理

- **TC-ASL-003**: BL 層整合測試
  - 模組正確導入
  - 函數調用正確性
  - 錯誤處理傳遞

#### index.js 重構測試案例
- **TC-WH-001**: Webhook 處理測試
  - LINE 訊息接收處理
  - 簽名驗證機制
  - 錯誤回應處理

- **TC-WH-002**: 剩餘端點測試
  - 健康檢查端點
  - 測試端點功能
  - HTTPS 檢查機制

### 7.2 整合測試
#### 服務間通訊測試
- **TC-INT-001**: 雙服務同時運行
  - Port 5000 和 3000 同時監聽
  - 無端口衝突
  - 資源共享正常

- **TC-INT-002**: APL Gateway 整合
  - Flutter APP → ASL.js 通訊
  - API 請求路由正確
  - 回應格式符合預期

#### 負載測試
- **TC-LOAD-001**: ASL.js 負載測試
  - 並發 API 請求處理
  - 記憶體使用監控
  - 回應時間基準測試

### 7.3 端到端測試
#### 完整流程測試
- **TC-E2E-001**: Flutter APP 完整流程
  - 註冊 → 登入 → 記帳 → 查詢
  - 多個 API 端點串接
  - 資料一致性驗證

- **TC-E2E-002**: LINE OA 完整流程
  - Webhook 接收 → 處理 → 回應
  - 記帳指令處理
  - 查詢指令處理

---

## 8. 風險評估與緩解

### 8.1 技術風險
#### 風險：服務分離可能導致設定複雜化
- **影響程度**：中
- **發生機率**：中
- **緩解策略**：
  - 建立詳細的設定文件
  - 創建自動化部署腳本
  - 實作健康檢查機制

#### 風險：BL 層模組重複導入可能影響效能
- **影響程度**：低
- **發生機率**：低
- **緩解策略**：
  - 實作模組快取機制
  - 監控記憶體使用狀況
  - 優化模組載入順序

### 8.2 整合風險
#### 風險：API 端點遷移過程中可能遺漏功能
- **影響程度**：高
- **發生機率**：中
- **緩解策略**：
  - 建立完整的端點檢查清單
  - 實作自動化測試覆蓋
  - 分階段遷移與驗證

#### 風險：APL Gateway 配置更新可能影響現有功能
- **影響程度**：高
- **發生機率**：低
- **緩解策略**：
  - 先在測試環境驗證
  - 保留配置回滾機制
  - 實作漸進式部署

### 8.3 營運風險
#### 風險：雙服務部署增加維運複雜度
- **影響程度**：中
- **發生機率**：高
- **緩解策略**：
  - 建立統一監控機制
  - 實作自動重啟機制
  - 創建運維操作手冊

---

## 9. 驗收標準

### 9.1 功能驗收
- [ ] ASL.js 成功監聽 Port 5000
- [ ] 132 個 API 端點正確遷移並可正常調用
- [ ] index.js 保留 5 個端點正常運作
- [ ] LINE Webhook 功能完全正常
- [ ] 所有 BL 層模組正確整合

### 9.2 效能驗收
- [ ] ASL.js API 回應時間 < 500ms (95th percentile)
- [ ] index.js Webhook 回應時間 < 200ms
- [ ] 雙服務同時運行記憶體使用 < 512MB
- [ ] 並發 100 個請求處理正常

### 9.3 整合驗收
- [ ] APL Gateway 成功路由到 ASL.js
- [ ] Flutter APP 所有功能測試通過
- [ ] LINE OA 所有功能測試通過
- [ ] SIT 測試全部通過

### 9.4 文件驗收
- [ ] 技術架構文件更新完成
- [ ] API 文件路徑全部更新
- [ ] 測試文件更新完成
- [ ] 部署文件更新完成

---

## 10. 文件更新清單

### 10.1 核心架構文件
- `00. Master_Project document/0015. Product_SPEC_LCAS_2.0.md`
  - 更新技術架構圖
  - 新增 ASL (API Service Layer) 定義
  - 更新服務端口配置說明

### 10.2 API 規格文件（5個）
- `80. Flutter_PRD_APL/8020. API list.md` - 更新端點實作位置
- `80. Flutter_PRD_APL/8025. API-BL mapping list.md` - 更新映射關係
- `81. Flutter_SRS(API spec)_APL/` - 所有 13 個 API 規格文件更新 base URL

### 10.3 測試計劃文件（5個）
- `05. SIT_Test plan/0501. SIT_P1.md` - 更新測試目標服務器
- `06. SIT_Test code/0603. SIT_TC_P1.js` - 更新 API 端點 URL
- `14. Replit_Test plan_BL/1497. RESTful_API.md` - 更新 API 測試計劃
- `14. Replit_Test plan_BL/1498. AP_Layer.md` - 更新 AP 層測試
- `14. Replit_Test plan_BL/1499. SIT_AP_RESTful.md` - 更新 SIT 測試

### 10.4 BL 層規格文件（3個）
- `10. Replit_PRD_BL/1001. PRD_BL.md` - 新增 ASL 模組規格
- `11. Replit_SRS_BL/` - 需要新增 ASL 相關 SRS 文件
- `12. Replit_LLD_BL/` - 需要新增 ASL 相關 LLD 文件

### 10.5 配置文件（2個）
- `.replit` - 配置雙服務器啟動命令
- `package.json` - 新增 ASL 啟動腳本

**總計：15 個文件需要更新**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-09-18 | 初版建立，定義 ASL 服務分離架構 | LCAS PM Team |

---

> **重要提醒**：此變更將對 LCAS 2.0 系統架構產生重大影響，涉及服務分離、端口配置、API 路由等多個層面。所有開發人員請嚴格遵循實作階段規劃，確保每個階段的驗收標準都能達成，並在生產環境部署前進行充分的整合測試。
