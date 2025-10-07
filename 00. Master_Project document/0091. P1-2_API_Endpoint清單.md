
# P1-2 API端點清單對照表

**版本**: v1.0.0  
**建立日期**: 2025-10-07  
**負責人**: LCAS PG Team  
**目的**: 明確界定P1-2階段測試範圍，避免Phase劃分混亂

---

## P1-2範圍內API端點 (34個端點)

### 認證服務API (11個端點) - 8101規格
✅ **包含在P1-2範圍內**
- POST /api/v1/auth/register - 用戶註冊
- POST /api/v1/auth/login - 用戶登入  
- POST /api/v1/auth/google-login - Google OAuth登入
- POST /api/v1/auth/logout - 用戶登出
- POST /api/v1/auth/refresh - 刷新存取Token
- POST /api/v1/auth/forgot-password - 忘記密碼
- GET /api/v1/auth/verify-reset-token - 驗證密碼重設Token
- POST /api/v1/auth/reset-password - 重設密碼
- POST /api/v1/auth/verify-email - 驗證Email地址
- POST /api/v1/auth/bind-line - 綁定LINE帳號
- GET /api/v1/auth/bind-status - 查詢綁定狀態

### 用戶管理服務API (8個端點) - 8102規格
✅ **包含在P1-2範圍內**
- GET /api/v1/users/profile - 取得用戶個人資料
- PUT /api/v1/users/profile - 更新用戶個人資料
- GET /api/v1/users/assessment-questions - 取得模式評估問卷
- POST /api/v1/users/assessment - 提交模式評估結果
- GET /api/v1/users/preferences - 查詢用戶偏好設定
- PUT /api/v1/users/preferences - 更新用戶偏好設定
- PUT /api/v1/users/security - 更新安全設定
- PUT /api/v1/users/mode - 切換用戶模式
- POST /api/v1/users/verify-pin - PIN碼驗證

### 記帳交易服務API (15個端點) - 8103規格
✅ **包含在P1-2範圍內**
- POST /api/v1/transactions - 新增交易記錄
- POST /api/v1/transactions/quick - 快速記帳
- GET /api/v1/transactions - 查詢交易記錄
- GET /api/v1/transactions/{id} - 取得交易詳情
- PUT /api/v1/transactions/{id} - 更新交易記錄
- DELETE /api/v1/transactions/{id} - 刪除交易記錄
- GET /api/v1/transactions/dashboard - 儀表板數據
- GET /api/v1/transactions/statistics - 統計數據
- GET /api/v1/transactions/recent - 最近交易
- GET /api/v1/transactions/charts - 圖表數據
- POST /api/v1/transactions/batch - 批量新增交易
- PUT /api/v1/transactions/batch - 批量更新交易
- DELETE /api/v1/transactions/batch - 批量刪除交易
- POST /api/v1/transactions/{id}/attachments - 上傳附件
- DELETE /api/v1/transactions/{id}/attachments/{attachmentId} - 刪除附件

---

## Phase 3-7範圍API端點 (排除項目)

### 帳本管理服務API - 8104規格
❌ **Phase 2功能，不包含在P1-2範圍內**
- POST /api/v1/ledgers
- GET /api/v1/ledgers
- PUT /api/v1/ledgers/{id}
- DELETE /api/v1/ledgers/{id}

### 系統服務API - 8111規格  
❌ **Phase 7功能，不包含在P1-2範圍內**
- GET /api/v1/system/health
- GET /api/v1/system/app-info
- GET /api/v1/system/welcome

### 預算管理服務API - 8107規格
❌ **Phase 4功能，不包含在P1-2範圍內**
- POST /api/v1/budgets
- GET /api/v1/budgets
- PUT /api/v1/budgets/{id}

---

## SIT測試案例對照

### 階段一測試 (TC-SIT-001~007) 
✅ **P1-2範圍內** - 基礎整合測試

### 階段二測試 (TC-SIT-008~025)
✅ **P1-2範圍內** - 四層架構資料流測試

### 階段三測試 (TC-SIT-026~047) 
**P1-2範圍內** - API端點完整性測試
✅ TC-SIT-026~036: 認證服務API測試 (11個)
✅ TC-SIT-037~044: 用戶管理API測試 (8個)  
✅ TC-SIT-045~047: 記帳交易API測試 (3個基礎端點)

❌ **應排除的測試項目**:
- 系統服務API測試 (Phase 7)
- 帳本管理API測試 (Phase 2)
- 預算管理API測試 (Phase 4)

---

## 測試執行指引

### ✅ 應該測試的項目
1. 所有認證服務API端點功能
2. 所有用戶管理服務API端點功能
3. 基礎記帳交易API端點功能
4. 四模式差異化回應驗證
5. DCN-0015統一回應格式驗證

### ❌ 不應該測試的項目  
1. Phase 2以後的功能 (多帳本、協作等)
2. Phase 4以後的功能 (預算管理、報表分析等)
3. Phase 7的系統管理功能
4. 未完成實作的API端點

---

## 版本記錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-10-07 | 建立P1-2 API端點對照表，明確測試範圍 | LCAS PG Team |

