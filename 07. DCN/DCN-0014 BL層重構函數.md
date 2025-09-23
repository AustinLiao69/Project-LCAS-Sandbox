
# DCN-0014 BL層重構函數

**版本**: v1.0.0  
**建立日期**: 2025-09-23  
**最後更新**: 2025-09-23  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [AM.js 認證管理模組函數](#31-amjs-認證管理模組函數)
   - 3.2 [BK.js 記帳核心模組函數](#32-bkjs-記帳核心模組函數)
   - 3.3 [函數命名標準化](#33-函數命名標準化)
   - 3.4 [版本管理機制](#34-版本管理機制)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [API處理函數架構](#41-api處理函數架構)
   - 4.2 [統一回應格式](#42-統一回應格式)
   - 4.3 [錯誤處理機制](#43-錯誤處理機制)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [API函數清單](#6-api函數清單)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：擴充BL層模組功能，在AM.js和BK.js中新增對應的API處理函數，實現完整的四層架構串接。配合ASL.js純轉發窗口機制，確保PL → APL → BL → DL的資料流暢通無阻。

此變更將新增：
- AM.js認證管理模組：22個API處理函數
- BK.js記帳核心模組：9個API處理函數（符合P1-2基本記帳範圍）
- 統一的函數命名規範和版本管理
- 標準化的錯誤處理和回應格式

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **架構完整性**：隨著ASL.js建立，BL層需要對應的API處理函數
- **職責分離**：ASL.js專責轉發，BL層專責業務邏輯處理
- **標準化接口**：統一的API函數命名和回應格式
- **擴展性支援**：為未來新增API端點建立標準範本

### 2.2 預期效益
- **架構清晰**：每層職責明確，維護性大幅提升
- **開發效率**：標準化的函數架構加速新功能開發
- **測試便利**：獨立的API函數更容易進行單元測試
- **錯誤追蹤**：統一的錯誤處理機制提升除錯效率

---

## 3. 須新增/修改內容

### 3.1 AM.js 認證管理模組函數

#### 3.1.1 認證服務API函數（11個）
```javascript
// 註冊相關
AM_processAPIRegister()           // POST /api/v1/auth/register
AM_processAPILogin()              // POST /api/v1/auth/login
AM_processAPIGoogleLogin()        // POST /api/v1/auth/google-login
AM_processAPILogout()             // POST /api/v1/auth/logout
AM_processAPIRefresh()            // POST /api/v1/auth/refresh

// 密碼管理
AM_processAPIForgotPassword()     // POST /api/v1/auth/forgot-password
AM_processAPIVerifyResetToken()   // GET /api/v1/auth/verify-reset-token
AM_processAPIResetPassword()      // POST /api/v1/auth/reset-password
AM_processAPIVerifyEmail()        // POST /api/v1/auth/verify-email

// 第三方整合
AM_processAPIBindLine()           // POST /api/v1/auth/bind-line
AM_processAPIBindStatus()         // GET /api/v1/auth/bind-status
```

#### 3.1.2 用戶管理API函數（11個）
```javascript
// 個人資料管理
AM_processAPIGetProfile()         // GET /api/v1/users/profile
AM_processAPIUpdateProfile()      // PUT /api/v1/users/profile

// 系統設定
AM_processAPIGetAssessmentQuestions() // GET /api/v1/users/assessment-questions
AM_processAPISubmitAssessment()   // POST /api/v1/users/assessment
AM_processAPIUpdatePreferences()  // PUT /api/v1/users/preferences
AM_processAPIUpdateSecurity()     // PUT /api/v1/users/security
AM_processAPISwitchMode()         // PUT /api/v1/users/mode
AM_processAPIVerifyPin()          // POST /api/v1/users/verify-pin

// 模式管理與優化
AM_processAPIGetModeDefaults()    // GET /api/v1/users/mode-defaults
AM_processAPIBehaviorTracking()   // POST /api/v1/users/behavior-tracking
AM_processAPIGetModeRecommendations() // GET /api/v1/users/mode-recommendations
```

### 3.2 BK.js 記帳核心模組函數

#### 3.2.1 基本記帳API函數（9個，符合P1-2範圍）
```javascript
// 基本交易操作
BK_processAPITransaction()        // POST /api/v1/transactions
BK_processAPIQuickTransaction()   // POST /api/v1/transactions/quick
BK_processAPIGetTransactions()    // GET /api/v1/transactions
BK_processAPIGetTransactionDetail() // GET /api/v1/transactions/{id}
BK_processAPIUpdateTransaction()  // PUT /api/v1/transactions/{id}
BK_processAPIDeleteTransaction()  // DELETE /api/v1/transactions/{id}

// 基本統計與儀表板
BK_processAPIGetDashboard()       // GET /api/v1/transactions/dashboard
BK_processAPIGetStatistics()      // GET /api/v1/transactions/statistics
BK_processAPIGetRecent()          // GET /api/v1/transactions/recent
```

**注意**：批量操作、附件管理、圖表生成等進階功能將在後續Phase實作。

### 3.3 函數命名標準化

#### 3.3.1 命名規範
- **格式**：`{模組名}_processAPI{功能名稱}()`
- **模組名**：AM（認證管理）、BK（記帳核心）
- **功能名稱**：採用帕斯卡命名法（PascalCase）
- **參數**：統一接收`requestData`物件

#### 3.3.2 範例實作架構
```javascript
/**
 * API處理函數：用戶註冊
 * @param {Object} requestData - 請求資料
 * @returns {Object} 處理結果
 */
async function AM_processAPIRegister(requestData) {
  try {
    // 1. 參數驗證
    const validatedData = validateRegistrationData(requestData);
    
    // 2. 業務邏輯處理
    const result = await processUserRegistration(validatedData);
    
    // 3. 回傳標準格式
    return {
      success: true,
      data: result,
      message: '註冊成功'
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      errorCode: error.code || 'REGISTRATION_ERROR'
    };
  }
}
```

### 3.4 版本管理機制

#### 3.4.1 模組版本升級
- **AM.js**：由 v2.0.5 升級至 v2.1.0
- **BK.js**：由 v2.0.8 升級至 v2.1.0
- **升級原因**：新增API處理函數屬於功能擴充

#### 3.4.2 版本紀錄格式
```javascript
/**
 * AM.js_帳號管理模組_2.1.0
 * @update 2025-09-23: DCN-0014 新增19個API處理函數
 */
```

---

## 4. 技術架構設計

### 4.1 API處理函數架構

#### 4.1.1 標準處理流程
1. **參數驗證**：檢查必要欄位和資料格式
2. **權限驗證**：確認用戶權限（如需要）
3. **業務邏輯**：執行核心功能處理
4. **資料持久化**：呼叫DL層進行資料操作
5. **結果回傳**：統一格式回應

#### 4.1.2 函數簽名標準
```javascript
async function {模組名}_processAPI{功能名}(requestData) {
  // 函數實作
}
```

### 4.2 統一回應格式

#### 4.2.1 成功回應
```javascript
{
  success: true,
  data: {},          // 實際資料
  message: "操作成功", // 成功訊息
  timestamp: "2025-09-23T10:30:00Z"
}
```

#### 4.2.2 錯誤回應
```javascript
{
  success: false,
  message: "錯誤描述",     // 用戶友善訊息
  errorCode: "ERROR_CODE", // 系統錯誤代碼
  details: {},            // 詳細錯誤資訊（可選）
  timestamp: "2025-09-23T10:30:00Z"
}
```

### 4.3 錯誤處理機制

#### 4.3.1 錯誤分類
- **驗證錯誤**：參數格式或必要欄位缺失
- **業務錯誤**：業務邏輯限制（如餘額不足）
- **系統錯誤**：資料庫連線、網路問題等
- **權限錯誤**：無權限執行操作

#### 4.3.2 錯誤代碼標準
```javascript
// AM模組錯誤代碼範例
AM_INVALID_CREDENTIALS    // 無效憑證
AM_USER_NOT_FOUND        // 用戶不存在
AM_EMAIL_ALREADY_EXISTS  // 電子郵件已存在

// BK模組錯誤代碼範例
BK_TRANSACTION_NOT_FOUND // 交易記錄不存在
BK_INVALID_AMOUNT       // 無效金額
BK_LEDGER_ACCESS_DENIED // 帳本存取被拒
```

---

## 5. 實作階段規劃

### Phase 1：AM.js函數架構建立（Week 1）
- 🔧 建立22個AM函數架構（認證11個+用戶管理11個）
- 🔧 實作統一錯誤處理機制
- 🔧 建立參數驗證工具函數
- 🧪 基礎單元測試

### Phase 2：BK.js函數架構建立（Week 2）
- 🔧 建立9個BK函數架構（P1-2基本記帳範圍）
- 🔧 整合基本交易處理邏輯
- 🔧 實作核心CRUD操作
- 🧪 基本記帳流程測試

### Phase 3：業務邏輯整合（Week 3）
- 🔧 整合Firebase Firestore操作
- 🔧 實作資料驗證邏輯
- 🔧 整合現有BL模組功能
- 🧪 整合測試

### Phase 4：ASL.js轉發整合（Week 4）
- 🔧 驗證ASL.js轉發機制
- 🔧 測試完整API流程
- 🔧 效能調優
- 🧪 端到端測試

### Phase 5：文件更新與部署（Week 5）
- 📝 更新相關技術文件
- 🧪 完整回歸測試
- 🚀 生產環境部署
- 📋 監控機制建立

---

## 6. API函數清單

### 6.1 AM.js 模組函數（22個）

| 函數名稱 | HTTP方法 | 端點路徑 | 功能描述 |
|---------|---------|----------|----------|
| `AM_processAPIRegister` | POST | `/api/v1/auth/register` | 用戶註冊 |
| `AM_processAPILogin` | POST | `/api/v1/auth/login` | 用戶登入 |
| `AM_processAPIGoogleLogin` | POST | `/api/v1/auth/google-login` | Google OAuth登入 |
| `AM_processAPILogout` | POST | `/api/v1/auth/logout` | 用戶登出 |
| `AM_processAPIRefresh` | POST | `/api/v1/auth/refresh` | 刷新Token |
| `AM_processAPIForgotPassword` | POST | `/api/v1/auth/forgot-password` | 忘記密碼 |
| `AM_processAPIVerifyResetToken` | GET | `/api/v1/auth/verify-reset-token` | 驗證重設Token |
| `AM_processAPIResetPassword` | POST | `/api/v1/auth/reset-password` | 重設密碼 |
| `AM_processAPIVerifyEmail` | POST | `/api/v1/auth/verify-email` | 驗證Email |
| `AM_processAPIBindLine` | POST | `/api/v1/auth/bind-line` | 綁定LINE帳號 |
| `AM_processAPIBindStatus` | GET | `/api/v1/auth/bind-status` | 查詢綁定狀態 |
| `AM_processAPIGetProfile` | GET | `/api/v1/users/profile` | 取得用戶資料 |
| `AM_processAPIUpdateProfile` | PUT | `/api/v1/users/profile` | 更新用戶資料 |
| `AM_processAPIGetAssessmentQuestions` | GET | `/api/v1/users/assessment-questions` | 取得評估問卷 |
| `AM_processAPISubmitAssessment` | POST | `/api/v1/users/assessment` | 提交評估結果 |
| `AM_processAPIUpdatePreferences` | PUT | `/api/v1/users/preferences` | 更新偏好設定 |
| `AM_processAPIUpdateSecurity` | PUT | `/api/v1/users/security` | 更新安全設定 |
| `AM_processAPISwitchMode` | PUT | `/api/v1/users/mode` | 切換用戶模式 |
| `AM_processAPIVerifyPin` | POST | `/api/v1/users/verify-pin` | PIN碼驗證 |
| `AM_processAPIGetModeDefaults` | GET | `/api/v1/users/mode-defaults` | 取得模式預設值 |
| `AM_processAPIBehaviorTracking` | POST | `/api/v1/users/behavior-tracking` | 使用行為追蹤 |
| `AM_processAPIGetModeRecommendations` | GET | `/api/v1/users/mode-recommendations` | 模式優化建議 |

### 6.2 BK.js 模組函數（9個，P1-2範圍）

| 函數名稱 | HTTP方法 | 端點路徑 | 功能描述 |
|---------|---------|----------|----------|
| `BK_processAPITransaction` | POST | `/api/v1/transactions` | 新增交易記錄 |
| `BK_processAPIQuickTransaction` | POST | `/api/v1/transactions/quick` | 快速記帳 |
| `BK_processAPIGetTransactions` | GET | `/api/v1/transactions` | 查詢交易記錄 |
| `BK_processAPIGetTransactionDetail` | GET | `/api/v1/transactions/{id}` | 取得交易詳情 |
| `BK_processAPIUpdateTransaction` | PUT | `/api/v1/transactions/{id}` | 更新交易記錄 |
| `BK_processAPIDeleteTransaction` | DELETE | `/api/v1/transactions/{id}` | 刪除交易記錄 |
| `BK_processAPIGetDashboard` | GET | `/api/v1/transactions/dashboard` | 儀表板數據 |
| `BK_processAPIGetStatistics` | GET | `/api/v1/transactions/statistics` | 統計數據 |
| `BK_processAPIGetRecent` | GET | `/api/v1/transactions/recent` | 最近交易 |

**Phase 2+ 功能**：批量操作、附件管理、圖表生成等進階功能將在後續階段實作。

---

## 10. 文件更新清單

### 10.1 BL層模組代碼（2個）
- `13. Replit_Module code_BL/1309. AM.js` - 新增19個API處理函數
- `13. Replit_Module code_BL/1301. BK.js` - 新增15個API處理函數

### 10.2 BL層設計文件（4個）
- `11. Replit_SRS_BL/1109. AM_帳號管理模組.md` - 更新SRS規格
- `12. Replit_LLD_BL/1209. AM_帳號管理模組.md` - 更新LLD設計
- `11. Replit_SRS_BL/1101. BK_記帳模組.md` - 更新SRS規格
- `12. Replit_LLD_BL/1201. BK_記帳模組.md` - 更新LLD設計

### 10.3 測試計劃文件（2個）
- `14. Replit_Test plan_BL/1409. AM_帳號管理模組.md` - 更新測試計劃
- `14. Replit_Test plan_BL/1401. BK_記帳模組.md` - 更新測試計劃

### 10.4 API映射文件（1個）
- `80. Flutter_PRD_APL/8025. API-BL mapping list.md` - 更新API-BL映射關係

**正確的P1-2 API端點總數：31個**
- **AM.js：22個函數**（認證11個 + 用戶管理11個）
- **BK.js：9個函數**（基本記帳功能）

**總計：9 個文件需要更新**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-09-23 | 初版建立，定義BL層API函數擴充計劃 | LCAS PM Team |

---

> **重要提醒**：此變更將為LCAS 2.0建立完整的四層架構基礎，所有API處理函數須嚴格遵循統一標準，確保系統的可維護性和擴展性。開發團隊請依照實作階段規劃進行，並在每個階段完成後進行充分測試驗證。
