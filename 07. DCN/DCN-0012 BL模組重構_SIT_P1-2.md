# DCN-0012 BL模組重構_SIT_P1-2

**版本**: v1.0.2  
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

---

## 1. 需求說明

本次變更目標為：執行0090 Sprint計畫P1-2範圍的BL層重構，修復架構職責分離問題，解決SIT測試中「API端點不存在」錯誤。根據0090文件，P1-2涵蓋「PL到DL的服務端整合」，包含完整的四層架構串接：PL函數邏輯 → APL API服務 → BL商業邏輯 → DL資料服務。

此變更將實現：
1. ASL.js轉換為純轉發窗口（符合APL層職責）
2. BL層模組完整實作對應的API端點函數
3. 四層架構正確串接，支援P1-2的服務端整合驗證
4. 達成90%+的SIT測試通過率

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

**P1-2範圍說明**（基於0090 Sprint計畫）：
- **目標**：PL到DL的服務端整合，四層架構完整串接
- **涵蓋層級**：PL函數邏輯 → APL API服務 → BL商業邏輯 → DL資料服務
- **API端點**：總計26個，專注於核心進入流程
- **核心功能**：使用者註冊、登入、基本記帳、模式評估
- **測試範圍**：SIT測試P1-2相關測試案例（TC-SIT-008~028）
- **整合重點**：RESTful API服務部署、四層架構驗證、服務穩定性確保

### 3.4 跨模組整合優化

#### 3.4.1 BL模組間協作機制
- **統一函數簽名**：標準化的API函數介面
- **統一錯誤處理**：一致的錯誤回傳格式
- **統一日誌規範**：標準化的日誌記錄機制

---

## 4. 技術架構設計

### 4.1 P1-2四層架構整合（基於0090 Sprint計畫）
```
P1-2服務端整合架構：
PL層（73號）: 函數邏輯實作 → 7301.系統進入功能群.dart, 7302.記帳核心功能群.dart
    ↓ PL→APL呼叫介面
APL層（83號）: API服務完整實作 → 8301/8302/8303 路由代碼
    ↓ API Gateway轉發
ASL.js: BL轉發窗口（純轉發，無業務邏輯）
    ↓ 標準化BL函數調用
BL層（13號）: 商業邏輯層完整實作 → AM.js, BK.js等模組
    ↓ 統一資料操作
DL層: Firestore完整資料結構 → users, ledgers, transactions集合

SIT測試 → ASL.js → BL層模組 → DL層（P1-2完整鏈路驗證）
```

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

## 5. 實作階段規劃（基於0090 Sprint計畫P1-2）

### 階段一：架構職責分離重構
**對應0090 P1-2 Week 2-4時程**
- ✅ 撰寫 DCN-0012 文件
- 🔧 **ASL.js重構**：純轉發窗口，移除業務邏輯
- 🔧 **BL層商業邏輯**：AM.js/BK.js完整實作

### 階段二：P1-2 API端點完整實作
**對應0090四層架構整合需求**
- 🔧 **AM.js**: 實作11個認證服務API端點函數
- 🔧 **BK.js**: 實作15個記帳交易API端點函數 

