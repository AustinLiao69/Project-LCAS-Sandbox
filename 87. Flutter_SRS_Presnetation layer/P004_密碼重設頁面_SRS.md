
# P004_密碼重設頁面_SRS

**文件編號**: P004-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 14:15:00 UTC+8

---

## 1. 功能目的（Purpose）

密碼重設頁面提供使用者安全重設忘記密碼的完整流程，包含：
- Email驗證碼發送與驗證
- 安全的密碼重設機制
- 多重驗證防護
- 使用者身份確認
- 重設成功後的安全提醒

## 2. 使用者故事（User Story）

**作為忘記密碼的使用者**，我希望能安全地重設我的密碼，以便重新獲得帳號存取權限。

**作為安全意識高的使用者**，我希望密碼重設過程有足夠的安全驗證，以便確保帳號不被他人惡意重設。

**作為不同模式的使用者**，我希望看到符合我使用習慣的重設介面，以便順利完成操作。

## 3. 前置條件（Preconditions）

- 使用者從P002登入頁面的「忘記密碼」連結導向至此
- 使用者已擁有有效的LCAS 2.0帳號
- 使用者記得註冊時使用的Email地址
- 裝置具備網路連線
- Email服務正常運作

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 標準密碼重設流程
1. 使用者進入密碼重設頁面
2. 輸入註冊時使用的Email地址
3. 系統驗證Email格式與存在性
4. 發送包含驗證碼的重設Email
5. 使用者檢查Email並輸入6位數驗證碼
6. 系統驗證驗證碼的有效性
7. 使用者設定新密碼並確認
8. 系統更新密碼並失效所有現有會話
9. 顯示重設成功訊息
10. 導向P002登入頁面，要求重新登入

### 4.2 安全防護流程
1. 檢查重設請求頻率限制
2. 記錄重設嘗試日誌
3. 驗證碼有效期限控制（10分鐘）
4. 檢查可疑活動模式
5. 重設成功後發送安全通知Email

### 4.3 錯誤處理流程
1. Email不存在時的模糊回應
2. 驗證碼錯誤的重試機制
3. 超過重試次數的帳號暫時鎖定
4. 網路異常的錯誤恢復

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| Email地址 | String | 是 | 註冊時使用的Email，格式驗證 |
| 驗證碼 | String | 是 | 6位數字驗證碼 |
| 新密碼 | String | 是 | 符合密碼強度要求 |
| 確認新密碼 | String | 是 | 必須與新密碼一致 |
| 裝置資訊 | Object | 是 | 用於安全日誌記錄 |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 發送狀態 | Boolean | Email發送成功/失敗 |
| 驗證結果 | Boolean | 驗證碼驗證成功/失敗 |
| 重設結果 | Boolean | 密碼重設成功/失敗 |
| 錯誤訊息 | String | 詳細的錯誤說明 |
| 剩餘嘗試次數 | Integer | 防止暴力破解的嘗試計數 |

## 7. 驗證規則（Validation Rules）

### 7.1 Email驗證
- 必須符合標準Email格式（RFC 5322）
- 長度限制：5-254字元
- 不顯示Email是否存在於系統中（安全考量）

### 7.2 驗證碼驗證
- 必須為6位數字
- 有效期限：10分鐘
- 最多嘗試5次
- 使用後即失效

### 7.3 新密碼驗證
- 最少8個字元，最多128字元
- 必須包含至少一個英文字母
- 必須包含至少一個數字
- 不能與舊密碼相同
- 不能包含使用者Email或姓名

### 7.4 安全限制
- 同一IP每小時最多5次重設請求
- 同一Email每天最多3次重設請求
- 連續失敗5次後暫時鎖定30分鐘

## 8. 錯誤處理（Error Handling）

| 錯誤情境 | 錯誤訊息 | 處理方式 |
|----------|----------|----------|
| Email格式錯誤 | "請輸入正確的Email格式" | 輸入框標紅，顯示格式提示 |
| 發送過於頻繁 | "請求過於頻繁，請稍後再試" | 顯示倒數計時器 |
| 驗證碼格式錯誤 | "請輸入6位數字驗證碼" | 自動聚焦驗證碼輸入框 |
| 驗證碼錯誤 | "驗證碼錯誤，還有X次機會" | 顯示剩餘嘗試次數 |
| 驗證碼過期 | "驗證碼已過期，請重新發送" | 提供重新發送按鈕 |
| 新密碼強度不足 | "密碼至少需8位，包含英文和數字" | 顯示密碼強度指示器 |
| 密碼不一致 | "兩次輸入的密碼不相符" | 確認密碼欄位標紅 |
| 網路連線失敗 | "網路連線異常，請檢查後重試" | 提供重試按鈕 |
| 伺服器錯誤 | "系統暫時無法處理，請稍後重試" | 記錄錯誤日誌 |
| 帳號被鎖定 | "由於安全考量，此功能暫時無法使用" | 提供客服聯絡方式 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 基本佈局規格
```css
.reset-password-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.reset-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.reset-title {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
  color: #212121;
}

.reset-subtitle {
  font-size: 14px;
  color: #757575;
  text-align: center;
  margin-bottom: 32px;
  line-height: 1.4;
}
```

### 9.2 步驟指示器
```css
.steps-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 32px;
}

.step {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #E0E0E0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #757575;
  position: relative;
}

.step.active {
  border-color: #1976D2;
  background: #1976D2;
  color: #FFFFFF;
}

.step.completed {
  border-color: #4CAF50;
  background: #4CAF50;
  color: #FFFFFF;
}

.step-connector {
  width: 40px;
  height: 2px;
  background: #E0E0E0;
  margin: 0 8px;
}

.step-connector.completed {
  background: #4CAF50;
}
```

### 9.3 Email輸入階段
```css
.email-input-section {
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
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #1976D2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.form-input.error {
  border-color: #F44336;
}

.send-code-button {
  width: 100%;
  height: 48px;
  background: #1976D2;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.send-code-button:hover {
  background: #1565C0;
}

.send-code-button:disabled {
  background: #BDBDBD;
  cursor: not-allowed;
}
```

### 9.4 驗證碼輸入階段
```css
.verification-section {
  text-align: center;
  margin-bottom: 24px;
}

.verification-info {
  font-size: 14px;
  color: #757575;
  margin-bottom: 24px;
  line-height: 1.4;
}

.verification-code-input {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}

.code-digit {
  width: 48px;
  height: 56px;
  border: 2px solid #E0E0E0;
  border-radius: 8px;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  transition: border-color 0.2s ease;
}

.code-digit:focus {
  outline: none;
  border-color: #1976D2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.code-digit.filled {
  border-color: #4CAF50;
  background: #E8F5E9;
}

.resend-section {
  text-align: center;
  margin-bottom: 24px;
}

.resend-timer {
  font-size: 14px;
  color: #757575;
  margin-bottom: 8px;
}

.resend-button {
  background: none;
  border: none;
  color: #1976D2;
  font-size: 14px;
  text-decoration: underline;
  cursor: pointer;
}

.resend-button:disabled {
  color: #BDBDBD;
  cursor: not-allowed;
  text-decoration: none;
}
```

### 9.5 新密碼設定階段
```css
.new-password-section {
  margin-bottom: 24px;
}

.password-input-group {
  position: relative;
  margin-bottom: 16px;
}

.password-toggle {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #757575;
  cursor: pointer;
  font-size: 20px;
}

.password-strength-indicator {
  margin-top: 8px;
}

.strength-bar {
  height: 4px;
  background: #E0E0E0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-fill.weak {
  background: #F44336;
  width: 33%;
}

.strength-fill.medium {
  background: #FF9800;
  width: 66%;
}

.strength-fill.strong {
  background: #4CAF50;
  width: 100%;
}

.strength-text {
  font-size: 12px;
  color: #757575;
}

.password-requirements {
  font-size: 12px;
  color: #757575;
  margin-top: 8px;
}

.requirement-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.requirement-item.met {
  color: #4CAF50;
}

.requirement-check {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}
```

### 9.6 成功頁面
```css
.success-section {
  text-align: center;
  padding: 24px 0;
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #4CAF50;
  border-radius: 50%;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 32px;
}

.success-title {
  font-size: 20px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 8px;
}

.success-message {
  font-size: 16px;
  color: #757575;
  margin-bottom: 24px;
  line-height: 1.4;
}

.security-notice {
  background: #E3F2FD;
  border: 1px solid #BBDEFB;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
}

.security-notice-title {
  font-size: 14px;
  font-weight: 600;
  color: #1976D2;
  margin-bottom: 8px;
}

.security-notice-text {
  font-size: 14px;
  color: #424242;
  line-height: 1.4;
}

.login-button {
  width: 100%;
  height: 48px;
  background: #1976D2;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.login-button:hover {
  background: #1565C0;
}
```

### 9.7 四模式差異化設計

#### 精準控制者模式
```css
.controller-mode .reset-card {
  border-left: 4px solid #1976D2;
}

.controller-mode .reset-title::before {
  content: "🔐 ";
}

.controller-mode .security-notice {
  display: block; /* 顯示詳細安全說明 */
}
```

#### 紀錄習慣者模式
```css
.logger-mode .reset-card {
  border-left: 4px solid #6A1B9A;
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(243,229,245,0.95));
}

.logger-mode .reset-title::before {
  content: "✨ ";
}

.logger-mode .steps-indicator {
  display: none; /* 簡化進度指示 */
}
```

#### 轉型挑戰者模式
```css
.struggler-mode .reset-card {
  border-left: 4px solid #FF6B35;
}

.struggler-mode .reset-title::before {
  content: "🚀 ";
}

.struggler-mode .encouragement-message {
  background: #FFF3E0;
  border: 1px solid #FFCC02;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #E65100;
  text-align: center;
}
```

#### 潛在覺醒者模式
```css
.sleeper-mode .reset-card {
  border-left: 4px solid #4CAF50;
}

.sleeper-mode .reset-title::before {
  content: "🌱 ";
}

.sleeper-mode .password-requirements {
  display: none; /* 隱藏複雜的密碼要求說明 */
}

.sleeper-mode .steps-indicator {
  display: none; /* 簡化界面 */
}
```

## 10. API 規格（API Specification）

### 10.1 發送重設驗證碼API
**端點**: POST /auth/reset-password/send-code  
**對應**: F005 密碼重設功能

**請求格式**:
```json
{
  "email": "string",
  "deviceInfo": {
    "platform": "android|ios",
    "deviceId": "string",
    "appVersion": "string",
    "ipAddress": "string"
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "message": "驗證碼已發送至您的Email",
    "expiresIn": 600,
    "canResendIn": 60,
    "requestId": "string"
  }
}
```

### 10.2 驗證驗證碼API
**端點**: POST /auth/reset-password/verify-code  
**對應**: F005 密碼重設功能

**請求格式**:
```json
{
  "email": "string",
  "verificationCode": "string",
  "requestId": "string",
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
    "verified": true,
    "resetToken": "string",
    "expiresIn": 900,
    "message": "驗證成功，請設定新密碼"
  }
}
```

### 10.3 重設密碼API
**端點**: POST /auth/reset-password/confirm  
**對應**: F005 密碼重設功能

**請求格式**:
```json
{
  "resetToken": "string",
  "newPassword": "string",
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
    "message": "密碼重設成功",
    "passwordChanged": true,
    "securityNotificationSent": true
  }
}
```

### 10.4 重新發送驗證碼API
**端點**: POST /auth/reset-password/resend-code  
**對應**: F005 密碼重設功能

**請求格式**:
```json
{
  "email": "string",
  "requestId": "string",
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
    "message": "新驗證碼已發送",
    "expiresIn": 600,
    "canResendIn": 60
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```dart
enum ResetPasswordState {
  emailInput,       // Email輸入階段
  codeSending,      // 驗證碼發送中
  codeInput,        // 驗證碼輸入階段
  codeVerifying,    // 驗證碼驗證中
  passwordInput,    // 新密碼設定階段
  passwordUpdating, // 密碼更新中
  success,          // 重設成功
  error,            // 錯誤狀態
  rateLimited      // 頻率限制
}
```

### 11.2 表單狀態管理
```dart
class ResetPasswordFormState {
  String email = '';
  String verificationCode = '';
  String newPassword = '';
  String confirmPassword = '';
  String resetToken = '';
  String requestId = '';
  int remainingAttempts = 5;
  int resendCountdown = 0;
  bool isLoading = false;
  Map<String, String> errors = {};
  PasswordStrength passwordStrength = PasswordStrength.weak;
}
```

### 11.3 狀態轉換規則
- emailInput → codeSending: 使用者提交有效Email
- codeSending → codeInput: 驗證碼發送成功
- codeInput → codeVerifying: 使用者輸入完整驗證碼
- codeVerifying → passwordInput: 驗證碼驗證成功
- passwordInput → passwordUpdating: 使用者提交新密碼
- passwordUpdating → success: 密碼更新成功
- 任何狀態 → error: 發生錯誤
- 任何狀態 → rateLimited: 超過頻率限制

### 11.4 頁面導航邏輯
- 重設成功 → P002登入頁面
- 取消操作 → P002登入頁面  
- 錯誤恢復 → 維持當前狀態，顯示錯誤訊息

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 頻率限制
- 同一IP每小時最多5次重設請求
- 同一Email每天最多3次重設請求
- 驗證碼最多嘗試5次
- 失敗後暫時鎖定30分鐘

### 12.2 驗證碼安全
- 6位隨機數字，避免容易猜測的序列
- 有效期限10分鐘
- 使用後即失效
- 不可重複使用

### 12.3 Token安全
- 重設Token 15分鐘有效期
- 使用後即失效
- 加密存儲，防止竄改
- 綁定特定IP和裝置

### 12.4 日誌記錄
- 記錄所有重設嘗試
- 監控可疑活動模式
- 異常行為警報
- 合規性日誌保存

## 13. 其他補充需求（Others）

### 13.1 效能要求
- Email發送時間 < 10秒
- 驗證碼驗證回應 < 2秒
- 密碼更新回應 < 3秒
- 頁面載入時間 < 2秒

### 13.2 無障礙支援
- 螢幕閱讀器支援
- 鍵盤導航友善
- 高對比度模式
- 大字體支援
- 語音輸入相容

### 13.3 使用者體驗
- 自動聚焦下一個輸入欄位
- 即時表單驗證
- 進度指示器
- 友善的錯誤訊息
- 操作確認提示

### 13.4 國際化支援
- 多語系介面
- 地區化的Email範本
- 時區感知的時間顯示
- 本地化的錯誤訊息

### 13.5 監控與分析
- 重設成功率追蹤
- 各階段放棄率分析
- 錯誤類型統計
- 使用者體驗指標

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS PM Team | 初版建立 - P004密碼重設頁面完整SRS規格 |
