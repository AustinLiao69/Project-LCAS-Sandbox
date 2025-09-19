
# DCN-0012 BL模組重構_SIT_P1

**版本**: v1.0.0  
**建立日期**: 2025-09-19  
**最後更新**: 2025-09-19  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [ASL.js 架構職責重構](#31-asljs-架構職責重構)
   - 3.2 [BL模組API端點實作](#32-bl模組api端點實作)
   - 3.3 [測試語法錯誤修復](#33-測試語法錯誤修復)
   - 3.4 [跨模組整合優化](#34-跨模組整合優化)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [四層架構職責分離](#41-四層架構職責分離)
   - 4.2 [BL層API函數設計](#42-bl層api函數設計)
   - 4.3 [轉發機制標準化](#43-轉發機制標準化)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [BL模組API端點清單](#6-bl模組api端點清單)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：修復BL層架構職責分離問題，解決SIT測試中「API端點不存在」錯誤，實現正確的四層架構設計。將ASL.js從業務邏輯實作角色轉換為純轉發窗口，真正的API業務邏輯實作移至對應的BL層模組。

此變更將解決目前架構職責混亂的問題，通過重構ASL.js轉發機制和完善BL層API端點函數，達成90%+的SIT測試通過率。

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **架構職責正確性**：確保ASL.js僅作為BL層轉發窗口，不實作業務邏輯
- **SIT測試通過**：解決API端點不存在錯誤，達成90%+測試通過率
- **四層架構一致性**：符合0015文件中定義的PL→APL→ASL→BL架構設計
- **開發效率提升**：清晰的職責分離降低開發複雜度

### 2.2 預期效益
- **架構清晰度**：明確區分轉發層與業務邏輯層
- **測試穩定性**：SIT測試穩定通過，支援持續整合
- **維護便利性**：職責分離提升代碼可維護性
- **擴展性增強**：標準化的API實作模式支援快速擴展

---

## 3. 須新增/修改內容

### 3.1 ASL.js 架構職責重構

#### 3.1.1 移除業務邏輯實作
- **目標**：ASL.js 轉換為純轉發窗口
- **移除內容**：所有API端點的業務邏輯實作
- **保留功能**：路由定義和BL層函數調用

#### 3.1.2 標準化轉發機制
- **統一轉發格式**：標準化的BL層函數調用模式
- **錯誤處理統一**：統一的錯誤捕獲和回傳機制
- **日誌記錄規範**：統一的轉發日誌記錄格式

### 3.2 BL模組API端點實作

本DCN專注於Phase 1核心進入流程所需的API端點實作，依據0090 Sprint計畫Phase 1範圍。

#### 3.2.1 AM.js 認證服務API函數（11個端點）
```javascript
// 需要實作的API處理函數
AM_processAPIRegister()          // POST /api/v1/auth/register
AM_processAPILogin()             // POST /api/v1/auth/login  
AM_processAPIGoogleLogin()       // POST /api/v1/auth/google-login
AM_processAPILogout()            // POST /api/v1/auth/logout
AM_processAPIRefresh()           // POST /api/v1/auth/refresh
AM_processAPIForgotPassword()    // POST /api/v1/auth/forgot-password
AM_processAPIVerifyResetToken()  // GET /api/v1/auth/verify-reset-token
AM_processAPIResetPassword()     // POST /api/v1/auth/reset-password
AM_processAPIVerifyEmail()       // POST /api/v1/auth/verify-email
AM_processAPIBindLine()          // POST /api/v1/auth/bind-line
AM_processAPIBindStatus()        // GET /api/v1/auth/bind-status
```

#### 3.2.2 BK.js 記帳交易API函數（15個端點）
```javascript
// 需要實作的API處理函數
BK_processAPITransaction()          // POST /api/v1/transactions
BK_processAPIQuickTransaction()     // POST /api/v1/transactions/quick  
BK_processAPIGetTransactions()      // GET /api/v1/transactions
BK_processAPIGetTransactionDetail() // GET /api/v1/transactions/{id}
BK_processAPIUpdateTransaction()    // PUT /api/v1/transactions/{id}
BK_processAPIDeleteTransaction()    // DELETE /api/v1/transactions/{id}
BK_processAPIGetDashboard()         // GET /api/v1/transactions/dashboard
BK_processAPIGetStatistics()        // GET /api/v1/transactions/statistics
BK_processAPIGetRecent()            // GET /api/v1/transactions/recent
BK_processAPIGetCharts()            // GET /api/v1/transactions/charts
BK_processAPIBatchCreate()          // POST /api/v1/transactions/batch
BK_processAPIBatchUpdate()          // PUT /api/v1/transactions/batch
BK_processAPIBatchDelete()          // DELETE /api/v1/transactions/batch
BK_processAPIUploadAttachment()     // POST /api/v1/transactions/{id}/attachments
BK_processAPIDeleteAttachment()     // DELETE /api/v1/transactions/{id}/attachments/{attachmentId}
```

#### 3.2.3 用戶管理API函數（UM.js - 8個端點）
```javascript
// 需要實作的API處理函數  
UM_processAPIGetProfile()           // GET /api/v1/users/profile
UM_processAPIUpdateProfile()        // PUT /api/v1/users/profile
UM_processAPIGetPreferences()       // GET /api/v1/users/preferences
UM_processAPIUpdatePreferences()    // PUT /api/v1/users/preferences
UM_processAPIGetLinkedAccounts()    // GET /api/v1/users/linked-accounts
UM_processAPIUnlinkAccount()        // DELETE /api/v1/users/linked-accounts/{provider}
UM_processAPIAssessMode()           // POST /api/v1/users/assess-mode
UM_processAPISwitchMode()           // PUT /api/v1/users/mode
```

**Phase 1範圍說明**：
- 總計34個API端點，涵蓋Phase 1核心進入流程所需功能
- 其他Phase 2-7的API端點將在後續DCN中處理
- 專注於使用者註冊、登入、基本記帳功能的完整實作

### 3.3 測試語法錯誤修復

#### 3.3.1 SIT測試腳本修正
- **修正測試語法錯誤**：確保測試腳本正確執行
- **更新測試端點**：對應新的BL層API函數
- **優化測試覆蓋率**：確保所有關鍵API端點都有測試

### 3.4 跨模組整合優化

#### 3.4.1 BL模組間協作機制
- **統一函數簽名**：標準化的API函數介面
- **統一錯誤處理**：一致的錯誤回傳格式
- **統一日誌規範**：標準化的日誌記錄機制

---

## 4. 技術架構設計

### 4.1 四層架構職責分離
```
Flutter APP → 8301.dart (APL Gateway) → ASL.js (BL轉發窗口) → BL層模組(AM.js、BK.js等)
SIT測試 → 直接向 ASL.js (BL轉發窗口) → BL層模組
```

### 4.2 BL層API函數設計
| API分類 | BL模組 | 主要函數前綴 | 處理端點數量 |
|---------|--------|-------------|-------------|
| 認證服務 | AM.js | AM_processAPI | 11 |
| 記帳交易 | BK.js | BK_processAPI | 20 |
| 帳本管理 | FS.js | FS_processAPI | 14 |
| 其他服務 | 多個模組 | 對應前綴 | 87 |

### 4.3 轉發機制標準化
```javascript
// ASL.js 標準轉發模式
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const result = await AM_processAPIRegister(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 5. 實作階段規劃

### 階段一：修復架構職責分離（Week 1）
- ✅ 撰寫 DCN-0012 文件
- 🔧 ASL.js重構：移除業務邏輯，改為純轉發功能
- 🔧 建立標準化轉發機制
- 🧪 測試語法錯誤修復

### 階段二：Phase 1 API端點實作（Week 2-3）
- 🔧 **AM.js**: 實作11個認證相關API端點函數
- 🔧 **BK.js**: 實作15個記帳交易API端點函數  
- 🔧 **UM.js**: 實作8個用戶管理API端點函數
- 🔧 **ASL.js**: 實作34個轉發端點
- 🧪 單元測試驗證（專注Phase 1範圍）

### 階段三：系統整合驗證（Week 4）
- 🧪 **端到端測試**：驗證PL→APL→ASL→BL完整鏈路
- 🧪 **SIT測試通過**：確保90%+測試通過率
- 🧪 **架構一致性驗證**：確認符合0015文件架構設計
- 📝 **文件更新**：更新相關設計文件

---

## 6. BL模組API端點清單

### 6.1 認證服務端點（AM.js - 11個）
```javascript
// 需要在AM.js實作的API處理函數
AM_processAPIRegister()          // POST /api/v1/auth/register
AM_processAPILogin()             // POST /api/v1/auth/login
AM_processAPIGoogleLogin()       // POST /api/v1/auth/google-login
AM_processAPILogout()            // POST /api/v1/auth/logout
AM_processAPIRefresh()           // POST /api/v1/auth/refresh
AM_processAPIForgotPassword()    // POST /api/v1/auth/forgot-password
AM_processAPIVerifyResetToken()  // GET /api/v1/auth/verify-reset-token
AM_processAPIResetPassword()     // POST /api/v1/auth/reset-password
AM_processAPIVerifyEmail()       // POST /api/v1/auth/verify-email
AM_processAPIBindLine()          // POST /api/v1/auth/bind-line
AM_processAPIBindStatus()        // GET /api/v1/auth/bind-status
```

### 6.2 記帳交易端點（BK.js - 15個）
```javascript
// 需要在BK.js實作的API處理函數
BK_processAPITransaction()          // POST /api/v1/transactions
BK_processAPIQuickTransaction()     // POST /api/v1/transactions/quick  
BK_processAPIGetTransactions()      // GET /api/v1/transactions
BK_processAPIGetTransactionDetail() // GET /api/v1/transactions/{id}
BK_processAPIUpdateTransaction()    // PUT /api/v1/transactions/{id}
BK_processAPIDeleteTransaction()    // DELETE /api/v1/transactions/{id}
BK_processAPIGetDashboard()         // GET /api/v1/transactions/dashboard
BK_processAPIGetStatistics()        // GET /api/v1/transactions/statistics
BK_processAPIGetRecent()            // GET /api/v1/transactions/recent
BK_processAPIGetCharts()            // GET /api/v1/transactions/charts
BK_processAPIBatchCreate()          // POST /api/v1/transactions/batch
BK_processAPIBatchUpdate()          // PUT /api/v1/transactions/batch
BK_processAPIBatchDelete()          // DELETE /api/v1/transactions/batch
BK_processAPIUploadAttachment()     // POST /api/v1/transactions/{id}/attachments
BK_processAPIDeleteAttachment()     // DELETE /api/v1/transactions/{id}/attachments/{attachmentId}
```

### 6.3 用戶管理端點（UM.js - 8個）
```javascript
// 需要在UM.js實作的API處理函數  
UM_processAPIGetProfile()           // GET /api/v1/users/profile
UM_processAPIUpdateProfile()        // PUT /api/v1/users/profile
UM_processAPIGetPreferences()       // GET /api/v1/users/preferences
UM_processAPIUpdatePreferences()    // PUT /api/v1/users/preferences
UM_processAPIGetLinkedAccounts()    // GET /api/v1/users/linked-accounts
UM_processAPIUnlinkAccount()        // DELETE /api/v1/users/linked-accounts/{provider}
UM_processAPIAssessMode()           // POST /api/v1/users/assess-mode
UM_processAPISwitchMode()           // PUT /api/v1/users/mode
```

### 6.4 ASL.js轉發端點（34個）
```javascript
// ASL.js 僅負責轉發，不實作業務邏輯
// 認證服務轉發（11個）
app.post('/api/v1/auth/register', (req, res) => AM_processAPIRegister);
app.post('/api/v1/auth/login', (req, res) => AM_processAPILogin);
app.post('/api/v1/auth/google-login', (req, res) => AM_processAPIGoogleLogin);
app.post('/api/v1/auth/logout', (req, res) => AM_processAPILogout);
app.post('/api/v1/auth/refresh', (req, res) => AM_processAPIRefresh);
app.post('/api/v1/auth/forgot-password', (req, res) => AM_processAPIForgotPassword);
app.get('/api/v1/auth/verify-reset-token', (req, res) => AM_processAPIVerifyResetToken);
app.post('/api/v1/auth/reset-password', (req, res) => AM_processAPIResetPassword);
app.post('/api/v1/auth/verify-email', (req, res) => AM_processAPIVerifyEmail);
app.post('/api/v1/auth/bind-line', (req, res) => AM_processAPIBindLine);
app.get('/api/v1/auth/bind-status', (req, res) => AM_processAPIBindStatus);

// 記帳交易轉發（15個）
app.post('/api/v1/transactions', (req, res) => BK_processAPITransaction);
app.post('/api/v1/transactions/quick', (req, res) => BK_processAPIQuickTransaction);
app.get('/api/v1/transactions', (req, res) => BK_processAPIGetTransactions);
app.get('/api/v1/transactions/:id', (req, res) => BK_processAPIGetTransactionDetail);
app.put('/api/v1/transactions/:id', (req, res) => BK_processAPIUpdateTransaction);
app.delete('/api/v1/transactions/:id', (req, res) => BK_processAPIDeleteTransaction);
app.get('/api/v1/transactions/dashboard', (req, res) => BK_processAPIGetDashboard);
app.get('/api/v1/transactions/statistics', (req, res) => BK_processAPIGetStatistics);
app.get('/api/v1/transactions/recent', (req, res) => BK_processAPIGetRecent);
app.get('/api/v1/transactions/charts', (req, res) => BK_processAPIGetCharts);
app.post('/api/v1/transactions/batch', (req, res) => BK_processAPIBatchCreate);
app.put('/api/v1/transactions/batch', (req, res) => BK_processAPIBatchUpdate);
app.delete('/api/v1/transactions/batch', (req, res) => BK_processAPIBatchDelete);
app.post('/api/v1/transactions/:id/attachments', (req, res) => BK_processAPIUploadAttachment);
app.delete('/api/v1/transactions/:id/attachments/:attachmentId', (req, res) => BK_processAPIDeleteAttachment);

// 用戶管理轉發（8個）
app.get('/api/v1/users/profile', (req, res) => UM_processAPIGetProfile);
app.put('/api/v1/users/profile', (req, res) => UM_processAPIUpdateProfile);
app.get('/api/v1/users/preferences', (req, res) => UM_processAPIGetPreferences);
app.put('/api/v1/users/preferences', (req, res) => UM_processAPIUpdatePreferences);
app.get('/api/v1/users/linked-accounts', (req, res) => UM_processAPIGetLinkedAccounts);
app.delete('/api/v1/users/linked-accounts/:provider', (req, res) => UM_processAPIUnlinkAccount);
app.post('/api/v1/users/assess-mode', (req, res) => UM_processAPIAssessMode);
app.put('/api/v1/users/mode', (req, res) => UM_processAPISwitchMode);
```

**Phase 1範圍限制**：
- 總計34個API端點，專注於核心進入流程
- Phase 2-7的其他API端點將於後續DCN處理
- 確保SIT測試可以涵蓋關鍵用戶旅程

---

## 10. 文件更新清單

### 10.1 核心架構文件
- `00. Master_Project document/0015. Product_SPEC_LCAS_2.0.md`
  - 確認四層架構定義正確性
  - 更新ASL層職責說明

### 10.2 SIT測試文件（3個）
- `05. SIT_Test plan/0501. SIT_P1.md` - 更新測試策略
- `06. SIT_Test code/0603. SIT_TC_P1.js` - 修復測試語法錯誤
- `06. SIT_Test code/0691. SIT_Report_P1.md` - 更新測試報告

### 10.3 BL層規格文件（2個）
- `10. Replit_PRD_BL/1001. PRD_BL.md` - 更新BL層API函數需求
- `11. Replit_SRS_BL/` - 新增BL層API函數規格文件

### 10.4 API規格文件（2個）
- `80. Flutter_PRD_APL/8025. API-BL mapping list.md` - 更新API-BL映射關係
- `00. Master_Project document/0026. PL-APL-BL mapping matrix.md` - 確認架構矩陣正確性

**總計：7 個文件需要更新**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-09-19 | 初版建立，定義BL模組重構與SIT測試修復策略 | LCAS PM Team |

---

> **重要提醒**：此變更將修正LCAS 2.0系統的核心架構職責分離問題，直接影響SIT測試通過率。所有開發人員請嚴格遵循四層架構設計原則，確保ASL.js僅作轉發窗口，真正的API業務邏輯實作在對應的BL層模組中。此變更完成後，系統架構將符合0015文件設計規範，並達成90%+的SIT測試通過率目標。
