
# P002_登入頁面_SRS

**文件編號**: P002-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 12:30:00 UTC+8

---

## 1. 功能目的（Purpose）

登入頁面提供使用者安全的身份驗證入口，支援多種登入方式：
- LINE OAuth自動登入（主要推薦）
- Google、Apple第三方登入
- Email/密碼傳統登入
- 根據使用者選擇的模式提供差異化登入體驗

## 2. 使用者故事（User Story）

**作為回訪使用者**，我希望能快速且安全地登入我的帳號，以便繼續使用記帳功能。

**作為新使用者**，我希望選擇最方便的登入方式，以便快速開始使用應用程式。

**作為不同模式的使用者**，我希望看到符合我選擇模式風格的登入介面。

## 3. 前置條件（Preconditions）

- 使用者已從P001歡迎頁面導向至此
- 使用者已選擇使用模式（或有預設模式）
- 裝置具備網路連線
- 相關OAuth應用程式已安裝（LINE、Google等）

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 LINE OAuth登入流程
1. 使用者點擊「LINE登入」按鈕
2. 系統檢查LINE應用程式安裝狀態
3. 調用LINE Login SDK
4. 跳轉至LINE應用程式進行授權
5. 使用者在LINE中確認授權
6. 返回應用程式並取得授權碼
7. 後端驗證授權碼並建立使用者會話
8. 登入成功，導向P010首頁儀表板

### 4.2 Email登入流程
1. 使用者輸入Email和密碼
2. 前端驗證輸入格式
3. 系統進行身份驗證
4. 驗證成功後建立使用者會話
5. 導向P010首頁儀表板

### 4.3 第三方登入流程
1. 使用者選擇Google/Apple登入
2. 調用對應OAuth SDK
3. 完成第三方授權
4. 取得使用者基本資訊
5. 後端處理帳號綁定/建立
6. 登入成功，導向P010首頁儀表板

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| 登入方式 | String | 是 | line/google/apple/email |
| Email | String | 條件必填 | Email登入時必填，格式驗證 |
| 密碼 | String | 條件必填 | Email登入時必填，最少8位 |
| 記住我 | Boolean | 否 | 是否保持登入狀態 |
| OAuth授權碼 | String | 條件必填 | 第三方登入回傳的授權碼 |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 存取令牌 | String | JWT格式的使用者存取令牌 |
| 使用者資訊 | Object | 基本使用者資料（ID、姓名、模式等） |
| 導航目標 | String | 登入成功後的頁面路徑 |
| 錯誤訊息 | String | 登入失敗時的錯誤說明 |

## 7. 驗證規則（Validation Rules）

### 7.1 Email格式驗證
- 必須符合標準Email格式
- 不允許空白字元
- 長度限制：3-254字元

### 7.2 密碼強度驗證
- 最少8個字元
- 必須包含至少一個英文字母
- 必須包含至少一個數字
- 不允許常見弱密碼

### 7.3 OAuth驗證
- 授權碼必須在5分鐘內有效
- 驗證回調URL的正確性
- 檢查OAuth提供者的回應狀態

## 8. 錯誤處理（Error Handling）

| 錯誤情境 | 錯誤訊息 | 處理方式 |
|----------|----------|----------|
| Email格式錯誤 | "請輸入正確的Email格式" | 輸入框下方顯示錯誤提示 |
| 密碼強度不足 | "密碼至少需8位，包含英文和數字" | 顯示密碼要求說明 |
| 帳號不存在 | "此帳號尚未註冊，請先註冊" | 提供註冊頁面連結 |
| 密碼錯誤 | "密碼錯誤，請重試" | 提供忘記密碼連結 |
| 網路連線失敗 | "網路連線不穩定，請稍後重試" | 提供重試按鈕 |
| OAuth授權失敗 | "授權失敗，請重試或選擇其他登入方式" | 提供替代登入選項 |
| 太多登入嘗試 | "登入嘗試次數過多，請15分鐘後再試" | 顯示等待時間倒數 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 基本佈局規格
```css
.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 32px;
  color: #212121;
}
```

### 9.2 LINE登入按鈕（主要推薦）
```css
.line-login-button {
  width: 100%;
  height: 56px;
  background-color: #00C300;
  border: none;
  border-radius: 8px;
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.line-login-button:hover {
  background-color: #00B300;
}

.line-icon {
  width: 24px;
  height: 24px;
  margin-right: 12px;
}
```

### 9.3 第三方登入按鈕群
```css
.social-login-container {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.social-login-button {
  flex: 1;
  height: 48px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.social-login-button:hover {
  border-color: #1976D2;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.1);
}

.google-button {
  color: #4285F4;
}

.apple-button {
  color: #000000;
}
```

### 9.4 Email登入表單
```css
.email-login-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #424242;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  height: 56px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 16px;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #1976D2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.form-input.error {
  border-color: #F44336;
}

.error-message {
  color: #F44336;
  font-size: 12px;
  margin-top: 4px;
}
```

### 9.5 四模式差異化設計

#### 精準控制者模式
```css
.controller-mode .login-card {
  border-left: 4px solid #1976D2;
}

.controller-mode .login-title::before {
  content: "🎯 ";
}
```

#### 紀錄習慣者模式
```css
.logger-mode .login-card {
  border-left: 4px solid #6A1B9A;
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(243,229,245,0.95));
}

.logger-mode .login-title::before {
  content: "🎨 ";
}
```

#### 轉型挑戰者模式
```css
.struggler-mode .login-card {
  border-left: 4px solid #FF6B35;
}

.struggler-mode .login-title::before {
  content: "💪 ";
}
```

#### 潛在覺醒者模式
```css
.sleeper-mode .login-card {
  border-left: 4px solid #4CAF50;
}

.sleeper-mode .login-title::before {
  content: "🌱 ";
}

.sleeper-mode .email-login-form {
  display: none; /* 隱藏複雜登入選項 */
}
```

## 10. API 規格（API Specification）

### 10.1 LINE OAuth登入API
**端點**: POST /auth/login/line  
**對應**: F002 使用者登入功能

**請求格式**:
```json
{
  "authorizationCode": "string",
  "redirectUri": "string",
  "clientId": "string",
  "deviceInfo": {
    "platform": "android|ios",
    "deviceId": "string",
    "appVersion": "string"
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "user": {
      "userId": "string",
      "email": "string",
      "displayName": "string",
      "profilePicture": "string",
      "selectedMode": "string"
    },
    "tokenExpiration": "ISO_8601_datetime"
  }
}
```

### 10.2 Email登入API
**端點**: POST /auth/login/email  
**對應**: F002 使用者登入功能

**請求格式**:
```json
{
  "email": "string",
  "password": "string",
  "rememberMe": "boolean",
  "deviceInfo": {
    "platform": "android|ios",
    "deviceId": "string",
    "appVersion": "string"
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "user": {
      "userId": "string",
      "email": "string",
      "displayName": "string",
      "selectedMode": "string"
    },
    "tokenExpiration": "ISO_8601_datetime"
  }
}
```

### 10.3 第三方OAuth登入API
**端點**: POST /auth/login/oauth  
**對應**: F002 使用者登入功能

**請求格式**:
```json
{
  "provider": "google|apple",
  "accessToken": "string",
  "idToken": "string",
  "deviceInfo": {
    "platform": "android|ios",
    "deviceId": "string",
    "appVersion": "string"
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```dart
enum LoginPageState {
  initial,        // 初始狀態
  authenticating, // 驗證中
  success,        // 登入成功
  error,          // 登入失敗
  loading         // 載入中
}
```

### 11.2 表單狀態管理
```dart
class LoginFormState {
  String email = '';
  String password = '';
  bool rememberMe = false;
  bool obscurePassword = true;
  Map<String, String> errors = {};
  bool isSubmitting = false;
}
```

### 11.3 頁面導航邏輯
- 登入成功 → P010首頁儀表板
- 帳號不存在 → P003註冊頁面
- 忘記密碼 → P004密碼重設頁面
- 返回 → P001歡迎頁面

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 輸入資料安全
- 密碼字段不記錄到日誌
- 敏感資料加密傳輸（HTTPS）
- 實施輸入清理防止XSS攻擊

### 12.2 身份驗證安全
- JWT令牌設定合理過期時間
- 實施登入嘗試次數限制
- OAuth狀態參數驗證防止CSRF

### 12.3 裝置安全
- 生物辨識登入支援（指紋/Face ID）
- 裝置信任狀態檢查
- 可疑活動監測與通知

## 13. 其他補充需求（Others）

### 13.1 效能要求
- 登入回應時間 < 3秒
- OAuth重定向時間 < 5秒
- 本地快取使用者偏好設定

### 13.2 無障礙支援
- 表單欄位提供適當的標籤
- 支援鍵盤導航
- 螢幕閱讀器友善設計

### 13.3 使用者體驗
- 密碼可見性切換按鈕
- 自動聚焦到第一個輸入欄位
- 表單驗證即時回饋
- 登入狀態持久化

### 13.4 錯誤監控
- 登入失敗率監控
- 效能指標追蹤
- 異常錯誤日誌記錄

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS PM Team | 初版建立 - P002登入頁面完整SRS規格 |
