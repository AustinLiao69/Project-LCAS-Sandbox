
# P003_註冊頁面_SRS

**文件編號**: P003-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 14:00:00 UTC+8

---

## 1. 功能目的（Purpose）

註冊頁面提供新使用者建立LCAS 2.0帳號的完整流程，支援：
- LINE OAuth快速註冊（主要推薦）
- Google、Apple第三方註冊
- Email/密碼傳統註冊
- 使用者模式初始選擇與設定
- 帳號資訊收集與驗證

## 2. 使用者故事（User Story）

**作為新使用者**，我希望能快速且安全地註冊帳號，以便開始使用LCAS 2.0的記帳功能。

**作為重視隱私的使用者**，我希望了解資料收集與使用政策，以便安心註冊使用。

**作為不同模式傾向的使用者**，我希望在註冊過程中選擇適合的使用模式，以便獲得個人化體驗。

## 3. 前置條件（Preconditions）

- 使用者從P001歡迎頁面或P002登入頁面導向至此
- 使用者尚未擁有LCAS 2.0帳號
- 裝置具備網路連線
- 相關OAuth應用程式已安裝（LINE、Google等）

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 LINE OAuth註冊流程
1. 使用者點擊「LINE註冊」按鈕
2. 系統檢查LINE應用程式安裝狀態
3. 調用LINE Login SDK
4. 跳轉至LINE應用程式進行授權
5. 使用者在LINE中確認授權
6. 返回應用程式並取得使用者基本資料
7. 系統檢查帳號是否已存在
8. 顯示模式選擇介面
9. 收集必要的補充資訊
10. 建立新帳號並完成註冊
11. 導向P010首頁儀表板

### 4.2 Email註冊流程
1. 使用者填寫註冊表單（Email、密碼、確認密碼、姓名）
2. 前端進行即時驗證
3. 使用者選擇使用模式
4. 同意服務條款與隱私政策
5. 提交註冊申請
6. 系統發送Email驗證信
7. 使用者點擊驗證連結
8. 帳號激活完成
9. 導向P002登入頁面

### 4.3 第三方OAuth註冊流程
1. 使用者選擇Google/Apple註冊
2. 調用對應OAuth SDK
3. 完成第三方授權
4. 取得使用者基本資訊
5. 系統檢查帳號是否已存在
6. 顯示模式選擇與補充資訊收集
7. 建立新帳號
8. 導向P010首頁儀表板

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| 註冊方式 | String | 是 | line/google/apple/email |
| Email | String | 條件必填 | Email註冊時必填，格式驗證 |
| 密碼 | String | 條件必填 | Email註冊時必填，最少8位 |
| 確認密碼 | String | 條件必填 | 必須與密碼一致 |
| 使用者姓名 | String | 是 | 顯示名稱，2-20字元 |
| 使用模式 | String | 是 | 四種模式選擇 |
| 服務條款同意 | Boolean | 是 | 必須同意才能註冊 |
| 隱私政策同意 | Boolean | 是 | 必須同意才能註冊 |
| 行銷訊息同意 | Boolean | 否 | 選擇性同意 |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 使用者ID | String | 新建立的使用者唯一識別碼 |
| 存取令牌 | String | JWT格式的存取令牌（OAuth註冊） |
| 驗證狀態 | String | 帳號驗證狀態（pending/verified） |
| 註冊結果 | Object | 註冊成功/失敗資訊 |
| 導航目標 | String | 下一個頁面路徑 |

## 7. 驗證規則（Validation Rules）

### 7.1 Email格式驗證
- 必須符合標準Email格式（RFC 5322）
- 不允許空白字元
- 長度限制：5-254字元
- 檢查Email是否已被註冊

### 7.2 密碼強度驗證
- 最少8個字元，最多128字元
- 必須包含至少一個英文字母（大小寫不拘）
- 必須包含至少一個數字
- 不允許使用常見弱密碼
- 不允許包含使用者姓名或Email

### 7.3 使用者姓名驗證
- 長度限制：2-20字元
- 允許中文、英文、數字
- 不允許特殊符號（除空格外）
- 不允許重複空格

### 7.4 模式選擇驗證
- 必須從四個預定義模式中選擇
- 精準控制者/紀錄習慣者/轉型挑戰者/潛在覺醒者

## 8. 錯誤處理（Error Handling）

| 錯誤情境 | 錯誤訊息 | 處理方式 |
|----------|----------|----------|
| Email格式錯誤 | "請輸入正確的Email格式" | 輸入框下方顯示錯誤提示 |
| Email已被註冊 | "此Email已被註冊，請使用其他Email或直接登入" | 提供登入頁面連結 |
| 密碼強度不足 | "密碼至少需8位，包含英文和數字" | 顯示密碼強度指示器 |
| 密碼不一致 | "兩次輸入的密碼不相符" | 確認密碼欄位標紅 |
| 姓名格式錯誤 | "姓名長度需在2-20字元之間" | 即時顯示字元計數 |
| 未同意條款 | "請先閱讀並同意服務條款" | 彈出條款內容 |
| 網路連線失敗 | "網路連線不穩定，請稍後重試" | 提供重試按鈕 |
| OAuth授權失敗 | "授權失敗，請重試或選擇其他註冊方式" | 提供替代註冊選項 |
| 伺服器錯誤 | "註冊失敗，請稍後再試" | 記錄錯誤並提供客服聯絡 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 基本佈局規格
```css
.register-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 20px 16px;
  overflow-y: auto;
}

.register-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

.register-title {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
  color: #212121;
}

.register-subtitle {
  font-size: 14px;
  color: #757575;
  text-align: center;
  margin-bottom: 32px;
  line-height: 1.4;
}
```

### 9.2 LINE註冊按鈕（主要推薦）
```css
.line-register-button {
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

.line-register-button:hover {
  background-color: #00B300;
}

.line-icon {
  width: 24px;
  height: 24px;
  margin-right: 12px;
}
```

### 9.3 註冊表單設計
```css
.register-form {
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

.form-input.success {
  border-color: #4CAF50;
}

.error-message {
  color: #F44336;
  font-size: 12px;
  margin-top: 4px;
}

.success-message {
  color: #4CAF50;
  font-size: 12px;
  margin-top: 4px;
}
```

### 9.4 密碼強度指示器
```css
.password-strength-container {
  margin-top: 8px;
}

.password-strength-bar {
  height: 4px;
  background: #E0E0E0;
  border-radius: 2px;
  overflow: hidden;
}

.password-strength-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.password-strength-fill.weak {
  background: #F44336;
  width: 33%;
}

.password-strength-fill.medium {
  background: #FF9800;
  width: 66%;
}

.password-strength-fill.strong {
  background: #4CAF50;
  width: 100%;
}

.password-requirements {
  margin-top: 8px;
  font-size: 12px;
  color: #757575;
}

.requirement-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.requirement-item.met {
  color: #4CAF50;
}

.requirement-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}
```

### 9.5 模式選擇介面
```css
.mode-selection-section {
  margin-bottom: 24px;
  padding: 20px;
  background: #F8F9FA;
  border-radius: 12px;
}

.mode-selection-title {
  font-size: 16px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 16px;
  text-align: center;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.mode-card {
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid #E0E0E0;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-card.selected {
  border-color: #1976D2;
  background: #E3F2FD;
}

.mode-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.mode-name {
  font-size: 14px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 4px;
}

.mode-description {
  font-size: 11px;
  color: #757575;
  line-height: 1.3;
}
```

### 9.6 服務條款同意區
```css
.terms-section {
  margin-bottom: 24px;
}

.checkbox-group {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
}

.checkbox-input {
  margin-right: 12px;
  margin-top: 2px;
  cursor: pointer;
}

.checkbox-label {
  font-size: 14px;
  color: #424242;
  line-height: 1.4;
  cursor: pointer;
}

.terms-link {
  color: #1976D2;
  text-decoration: underline;
  cursor: pointer;
}

.terms-link:hover {
  color: #1565C0;
}
```

### 9.7 四模式差異化設計

#### 精準控制者模式
```css
.controller-mode .register-card {
  border-left: 4px solid #1976D2;
}

.controller-mode .mode-card.controller.selected {
  border-color: #1976D2;
  background: #E3F2FD;
}
```

#### 紀錄習慣者模式
```css
.logger-mode .register-card {
  border-left: 4px solid #6A1B9A;
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(243,229,245,0.95));
}

.logger-mode .mode-card.logger.selected {
  border-color: #6A1B9A;
  background: #F3E5F5;
}
```

#### 轉型挑戰者模式
```css
.struggler-mode .register-card {
  border-left: 4px solid #FF6B35;
}

.struggler-mode .mode-card.struggler.selected {
  border-color: #FF6B35;
  background: #FFF3E0;
}
```

#### 潛在覺醒者模式
```css
.sleeper-mode .register-card {
  border-left: 4px solid #4CAF50;
}

.sleeper-mode .mode-card.sleeper.selected {
  border-color: #4CAF50;
  background: #E8F5E8;
}

.sleeper-mode .register-form {
  display: none; /* 隱藏複雜註冊表單，僅保留OAuth */
}
```

## 10. API 規格（API Specification）

### 10.1 LINE OAuth註冊API
**端點**: POST /auth/register/line  
**對應**: F001 使用者註冊功能

**請求格式**:
```json
{
  "authorizationCode": "string",
  "redirectUri": "string",
  "clientId": "string",
  "selectedMode": "controller|logger|struggler|sleeper",
  "deviceInfo": {
    "platform": "android|ios",
    "deviceId": "string",
    "appVersion": "string"
  },
  "marketingConsent": "boolean"
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "accessToken": "string",
    "refreshToken": "string",
    "user": {
      "userId": "string",
      "email": "string",
      "displayName": "string",
      "profilePicture": "string",
      "selectedMode": "string",
      "verificationStatus": "verified"
    },
    "tokenExpiration": "ISO_8601_datetime"
  }
}
```

### 10.2 Email註冊API
**端點**: POST /auth/register/email  
**對應**: F001 使用者註冊功能

**請求格式**:
```json
{
  "email": "string",
  "password": "string",
  "displayName": "string",
  "selectedMode": "controller|logger|struggler|sleeper",
  "termsAccepted": "boolean",
  "privacyAccepted": "boolean",
  "marketingConsent": "boolean",
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
    "userId": "string",
    "verificationEmailSent": true,
    "message": "請檢查您的Email並點擊驗證連結完成註冊",
    "nextAction": "email_verification"
  }
}
```

### 10.3 Email驗證API
**端點**: GET /auth/verify-email  
**對應**: F001 使用者註冊功能

**請求參數**:
```
?token=verification_token&userId=user_id
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "message": "Email驗證成功，您現在可以登入",
    "verified": true
  }
}
```

### 10.4 Email重複檢查API
**端點**: POST /auth/check-email  
**對應**: F001 使用者註冊功能

**請求格式**:
```json
{
  "email": "string"
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "available": "boolean",
    "message": "string"
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```dart
enum RegisterPageState {
  initial,          // 初始狀態
  modeSelection,    // 模式選擇
  formFilling,      // 填寫表單
  validating,       // 驗證中
  submitting,       // 提交中
  emailVerification, // Email驗證等待
  success,          // 註冊成功
  error             // 註冊失敗
}
```

### 11.2 表單狀態管理
```dart
class RegisterFormState {
  String email = '';
  String password = '';
  String confirmPassword = '';
  String displayName = '';
  String selectedMode = '';
  bool termsAccepted = false;
  bool privacyAccepted = false;
  bool marketingConsent = false;
  Map<String, String> errors = {};
  bool isSubmitting = false;
  PasswordStrength passwordStrength = PasswordStrength.weak;
}

enum PasswordStrength {
  weak,
  medium,
  strong
}
```

### 11.3 頁面導航邏輯
- Email註冊成功 → 顯示Email驗證提示
- OAuth註冊成功 → P010首頁儀表板
- 註冊失敗 → 維持當前頁面，顯示錯誤
- 返回登入 → P002登入頁面
- 返回歡迎 → P001歡迎頁面

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 輸入資料安全
- 密碼字段不記錄到日誌
- 敏感資料加密傳輸（HTTPS）
- 實施輸入清理防止XSS攻擊
- SQL注入防護

### 12.2 註冊安全防護
- 實施註冊頻率限制（同IP/同裝置）
- Email驗證防止虛假註冊
- 密碼雜湊加鹽存儲
- OAuth狀態參數驗證防止CSRF

### 12.3 資料隱私保護
- 遵循GDPR/個資法規範
- 最小化資料收集原則
- 使用者同意記錄與管理
- 可撤回同意的機制

## 13. 其他補充需求（Others）

### 13.1 效能要求
- 註冊回應時間 < 5秒
- Email驗證信發送時間 < 10秒
- OAuth重定向時間 < 5秒
- 本地快取註冊進度

### 13.2 無障礙支援
- 表單欄位提供適當的標籤和說明
- 支援鍵盤導航與Tab順序
- 螢幕閱讀器友善的錯誤訊息
- 高對比度模式支援

### 13.3 使用者體驗
- 即時表單驗證回饋
- 密碼強度視覺指示器
- 註冊進度指示
- 自動聚焦到錯誤欄位
- 表單資料本地暫存

### 13.4 國際化支援
- 多語系錯誤訊息
- 地區化的服務條款
- 時區感知的日期時間
- 本地化的數字與格式

### 13.5 分析與監控
- 註冊轉換率追蹤
- 註冊流程漏斗分析
- 錯誤率監控與警報
- 效能指標收集

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS PM Team | 初版建立 - P003註冊頁面完整SRS規格 |
