
# P005_登出確認頁面_SRS

**文件編號**: P005-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 15:00:00 UTC+8

---

## 1. 功能目的（Purpose）

登出確認頁面提供使用者安全登出的確認機制，包含：
- 登出操作的二次確認
- 本地資料清理選項
- 快速重新登入選項
- 安全退出流程
- 使用者會話管理

## 2. 使用者故事（User Story）

**作為使用中的使用者**，我希望能安全地登出我的帳號，以便保護我的資料隱私。

**作為共用裝置的使用者**，我希望登出時能清理本地資料，以便確保資料安全。

**作為頻繁使用者**，我希望能快速重新登入，以便提升使用效率。

## 3. 前置條件（Preconditions）

- 使用者已成功登入系統
- 使用者從應用程式內觸發登出操作（設定頁面、選單等）
- 使用者會話狀態為有效
- 裝置具備網路連線

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 標準登出流程
1. 使用者觸發登出操作
2. 系統顯示登出確認頁面
3. 使用者確認是否真的要登出
4. 系統檢查是否有未同步的資料
5. 提示使用者選擇本地資料處理方式
6. 執行登出操作
7. 清理使用者會話
8. 清理本地資料（依使用者選擇）
9. 導向P001歡迎頁面

### 4.2 快速登出流程
1. 使用者選擇「快速登出」
2. 系統保留登入資訊（加密存儲）
3. 清理當前會話
4. 導向P002登入頁面（自動填入使用者資訊）

### 4.3 完全登出流程
1. 使用者選擇「完全登出」
2. 系統清理所有會話令牌
3. 清理所有本地資料
4. 清理快取和暫存檔案
5. 重置應用程式狀態
6. 導向P001歡迎頁面

### 4.4 未同步資料處理
1. 檢查是否有未上傳的記帳記錄
2. 提示使用者選擇處理方式
3. 可選擇同步後登出或直接登出
4. 記錄使用者選擇偏好

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| 登出類型 | String | 是 | quick/complete/cancel |
| 清理本地資料 | Boolean | 否 | 是否清理本地存儲資料 |
| 同步未上傳資料 | Boolean | 條件必填 | 有未同步資料時必選 |
| 記住選擇 | Boolean | 否 | 記住使用者偏好設定 |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 登出結果 | Boolean | 登出成功/取消 |
| 清理狀態 | Object | 各項清理操作的結果 |
| 同步結果 | Object | 資料同步完成狀態 |
| 導航目標 | String | 下一個頁面路徑 |
| 錯誤訊息 | String | 登出過程中的錯誤說明 |

## 7. 驗證規則（Validation Rules）

### 7.1 登出操作驗證
- 確認使用者當前處於登入狀態
- 驗證會話令牌的有效性
- 檢查是否有正在進行的關鍵操作

### 7.2 資料同步驗證
- 檢查網路連線狀態
- 驗證未同步資料的完整性
- 確認同步操作的成功完成

### 7.3 清理操作驗證
- 確認清理範圍的正確性
- 驗證重要資料的備份狀態
- 檢查清理操作的權限

## 8. 錯誤處理（Error Handling）

| 錯誤情境 | 錯誤訊息 | 處理方式 |
|----------|----------|----------|
| 網路連線失敗 | "網路連線不穩定，登出操作可能失敗" | 提供離線登出選項 |
| 資料同步失敗 | "部分資料同步失敗，是否仍要登出？" | 提供重試或強制登出選項 |
| 會話已過期 | "會話已過期，將直接登出" | 自動執行本地清理 |
| 清理操作失敗 | "部分本地資料清理失敗" | 記錄失敗項目，提供手動清理 |
| 伺服器錯誤 | "伺服器暫時無法回應，執行本地登出" | 執行本地登出程序 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 基本佈局規格
```css
.logout-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #FF5722 0%, #FF8A65 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.logout-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.logout-icon {
  width: 64px;
  height: 64px;
  background: #FF5722;
  border-radius: 50%;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 32px;
}

.logout-title {
  font-size: 24px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 8px;
}

.logout-message {
  font-size: 16px;
  color: #757575;
  line-height: 1.4;
  margin-bottom: 32px;
}
```

### 9.2 未同步資料提醒
```css
.unsync-warning {
  background: #FFF3E0;
  border: 1px solid #FFB74D;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
}

.warning-icon {
  color: #FF9800;
  font-size: 20px;
  margin-right: 8px;
}

.warning-title {
  font-size: 14px;
  font-weight: 600;
  color: #E65100;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.warning-content {
  font-size: 14px;
  color: #BF360C;
  line-height: 1.4;
}

.unsync-list {
  margin-top: 12px;
  padding-left: 16px;
}

.unsync-item {
  font-size: 13px;
  color: #BF360C;
  margin-bottom: 4px;
}
```

### 9.3 登出選項按鈕
```css
.logout-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.logout-option-button {
  width: 100%;
  height: 56px;
  border: 2px solid #E0E0E0;
  border-radius: 8px;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-option-button:hover {
  border-color: #FF5722;
  background: #FFF3E0;
}

.logout-option-button.selected {
  border-color: #FF5722;
  background: #FFEBEE;
}

.option-content {
  display: flex;
  align-items: center;
  flex: 1;
}

.option-icon {
  width: 24px;
  height: 24px;
  margin-right: 12px;
  color: #FF5722;
}

.option-text {
  flex: 1;
}

.option-name {
  font-size: 16px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 2px;
}

.option-description {
  font-size: 12px;
  color: #757575;
  line-height: 1.3;
}

.option-radio {
  width: 20px;
  height: 20px;
  border: 2px solid #E0E0E0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-radio.selected {
  border-color: #FF5722;
  background: #FF5722;
}

.option-radio.selected::after {
  content: '';
  width: 8px;
  height: 8px;
  background: #FFFFFF;
  border-radius: 50%;
}
```

### 9.4 本地資料清理選項
```css
.data-cleanup-section {
  background: #F8F9FA;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.cleanup-title {
  font-size: 14px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 12px;
}

.cleanup-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cleanup-checkbox-group {
  display: flex;
  align-items: center;
}

.cleanup-checkbox {
  margin-right: 12px;
  cursor: pointer;
}

.cleanup-label {
  font-size: 14px;
  color: #424242;
  cursor: pointer;
  flex: 1;
}

.cleanup-description {
  font-size: 12px;
  color: #757575;
  margin-top: 4px;
  margin-left: 32px;
}
```

### 9.5 操作按鈕群組
```css
.logout-actions {
  display: flex;
  gap: 12px;
}

.confirm-logout-button {
  flex: 1;
  height: 48px;
  background: #FF5722;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.confirm-logout-button:hover {
  background: #E64A19;
}

.confirm-logout-button:disabled {
  background: #BDBDBD;
  cursor: not-allowed;
}

.cancel-button {
  flex: 1;
  height: 48px;
  background: #FFFFFF;
  color: #FF5722;
  border: 2px solid #FF5722;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-button:hover {
  background: #FF5722;
  color: #FFFFFF;
}
```

### 9.6 載入狀態
```css
.logout-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #FFCCBC;
  border-top: 4px solid #FF5722;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: #757575;
  text-align: center;
}

.loading-progress {
  width: 100%;
  height: 4px;
  background: #E0E0E0;
  border-radius: 2px;
  margin-top: 16px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #FF5722;
  border-radius: 2px;
  transition: width 0.3s ease;
}
```

### 9.7 四模式差異化設計

#### 精準控制者模式
```css
.controller-mode .logout-card {
  border-left: 4px solid #1976D2;
}

.controller-mode .data-cleanup-section {
  display: block; /* 顯示詳細的清理選項 */
}

.controller-mode .logout-title::before {
  content: "🔐 ";
}
```

#### 紀錄習慣者模式
```css
.logger-mode .logout-card {
  border-left: 4px solid #6A1B9A;
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(243,229,245,0.95));
}

.logger-mode .logout-title::before {
  content: "✨ ";
}

.logger-mode .unsync-warning {
  border: 2px solid #6A1B9A;
  background: #F3E5F5;
}
```

#### 轉型挑戰者模式
```css
.struggler-mode .logout-card {
  border-left: 4px solid #FF6B35;
}

.struggler-mode .logout-title::before {
  content: "💪 ";
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
.sleeper-mode .logout-card {
  border-left: 4px solid #4CAF50;
}

.sleeper-mode .logout-title::before {
  content: "🌱 ";
}

.sleeper-mode .data-cleanup-section {
  display: none; /* 隱藏複雜的清理選項 */
}

.sleeper-mode .logout-options {
  display: none; /* 簡化登出選項 */
}
```

## 10. API 規格（API Specification）

### 10.1 檢查未同步資料API
**端點**: GET /auth/logout/check-unsync  
**對應**: F003 使用者登出功能

**請求參數**:
```
?userId=user_id&lastSyncTime=ISO_8601_datetime
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "hasUnsyncData": true,
    "unsyncItems": [
      {
        "type": "transaction",
        "count": 5,
        "description": "5筆未同步的記帳記錄"
      },
      {
        "type": "budget",
        "count": 1,
        "description": "1個未同步的預算設定"
      }
    ],
    "syncRequired": true,
    "estimatedSyncTime": 30
  }
}
```

### 10.2 執行登出API
**端點**: POST /auth/logout  
**對應**: F003 使用者登出功能

**請求格式**:
```json
{
  "userId": "string",
  "logoutType": "quick|complete",
  "syncUnsyncData": "boolean",
  "clearLocalData": "boolean",
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
    "loggedOut": true,
    "syncResult": {
      "success": true,
      "syncedItems": 6
    },
    "cleanupResult": {
      "tokensCleared": true,
      "localDataCleared": true,
      "cacheCleared": true
    },
    "message": "登出成功"
  }
}
```

### 10.3 同步未同步資料API
**端點**: POST /auth/logout/sync-data  
**對應**: F003 使用者登出功能

**請求格式**:
```json
{
  "userId": "string",
  "unsyncItems": [
    {
      "type": "string",
      "data": "object"
    }
  ],
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
    "syncedCount": 6,
    "failedCount": 0,
    "syncResults": [
      {
        "type": "transaction",
        "status": "success",
        "count": 5
      },
      {
        "type": "budget",
        "status": "success",
        "count": 1
      }
    ]
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```dart
enum LogoutPageState {
  initial,        // 初始確認狀態
  checkingData,   // 檢查未同步資料
  syncingData,    // 同步資料中
  loggingOut,     // 登出處理中
  success,        // 登出成功
  error,          // 登出失敗
  cancelled       // 取消登出
}
```

### 11.2 登出選項定義
```dart
enum LogoutType {
  quick,    // 快速登出（保留登入資訊）
  complete  // 完全登出（清理所有資料）
}

class LogoutState {
  LogoutType logoutType = LogoutType.quick;
  bool syncUnsyncData = true;
  bool clearLocalData = false;
  bool clearCache = true;
  bool rememberChoice = false;
  List<UnsyncItem> unsyncItems = [];
  bool isLoading = false;
  String? errorMessage;
}
```

### 11.3 頁面導航邏輯
- 登出成功（quick） → P002登入頁面（自動填入）
- 登出成功（complete） → P001歡迎頁面
- 取消登出 → 返回原來頁面
- 登出失敗 → 維持當前頁面，顯示錯誤

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 會話安全
- 驗證當前使用者的登入狀態
- 確認會話令牌的有效性
- 安全地清理所有會話資料
- 撤銷相關的存取令牌

### 12.2 資料清理安全
- 確保敏感資料的完全清理
- 防止資料殘留在記憶體中
- 安全地清理加密金鑰
- 清理生物辨識資料

### 12.3 同步安全
- 加密傳輸未同步的資料
- 驗證資料完整性
- 防止資料在傳輸中被竄改
- 記錄同步操作日誌

## 13. 其他補充需求（Others）

### 13.1 效能要求
- 未同步資料檢查時間 < 3秒
- 資料同步時間 < 30秒
- 登出處理時間 < 5秒
- 本地資料清理時間 < 10秒

### 13.2 使用者體驗
- 提供清楚的操作說明
- 顯示詳細的進度指示
- 友善的確認和警告訊息
- 支援操作取消功能

### 13.3 資料完整性
- 確保重要資料不會意外丟失
- 提供資料備份提醒
- 記錄使用者選擇偏好
- 支援操作回復機制

### 13.4 無障礙支援
- 螢幕閱讀器友善設計
- 鍵盤導航支援
- 高對比度模式
- 大字體支援

### 13.5 監控與分析
- 登出操作統計
- 資料同步成功率
- 使用者偏好分析
- 錯誤率監控

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS PM Team | 初版建立 - P005登出確認頁面完整SRS規格 |
