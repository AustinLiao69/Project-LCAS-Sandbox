# P001_歡迎頁面_SRS

**文件編號**: P001-SRS  
**版本**: v1.1.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 14:30:00 UTC+8

---

## 1. 功能目的（Purpose）

歡迎頁面是LCAS 2.0 Flutter應用程式的入口頁面，負責：
- 展示品牌形象與應用程式核心價值
- 引導新使用者進行模式選擇
- 提供登入/註冊入口
- 建立良好的第一印象與使用者期待

## 2. 使用者故事（User Story）

**作為新使用者**，我希望在開啟應用程式時看到清晰的歡迎介面，以便了解應用程式功能並選擇適合我的使用模式。

**作為回訪使用者**，我希望能快速進入應用程式，以便繼續我的記帳活動。

## 3. 前置條件（Preconditions）

- 使用者已成功安裝LCAS 2.0 Flutter應用程式
- 裝置具備網路連線能力
- 應用程式具備基本系統權限（網路存取等）

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 首次啟動流程
1. 應用程式啟動動畫播放
2. 顯示歡迎頁面主要內容
3. 檢測使用者登入狀態
4. 若未登入，顯示模式選擇與登入選項
5. 使用者選擇模式或直接登入
6. 導向對應的下一步頁面

### 4.2 再次啟動流程
1. 應用程式啟動動畫播放
2. 檢測已登入狀態
3. 自動導向使用者的個人化首頁（P010）

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| 模式選擇 | String | 選填 | 四種模式：精準控制者(Controller)/紀錄習慣者(Logger)/轉型挑戰者(Struggler)/潛在覺醒者(Sleeper) |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 導航目標 | String | 下一個頁面路徑（P002登入/P003註冊/P010首頁） |
| 模式設定 | Object | 使用者選擇的模式配置資訊 |
| 歡迎訊息 | String | 個人化的歡迎文字內容 |

## 7. 驗證規則（Validation Rules）

- 模式選擇：必須從四個預定義模式中選擇
- 登入方式：必須從支援的OAuth提供者中選擇
- 網路連線：檢查網路狀態，離線時顯示對應提示

## 8. 錯誤處理（Error Handling）

| 錯誤情境 | 錯誤訊息 | 處理方式 |
|----------|----------|----------|
| 網路連線失敗 | "網路連線不穩定，請檢查網路設定" | 顯示離線模式選項 |
| 模式選擇失敗 | "模式設定失敗，請重試" | 提供重試按鈕 |
| 應用程式初始化失敗 | "應用程式啟動異常，請重啟應用程式" | 提供重啟選項 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 基本佈局規格
```css
.welcome-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.brand-logo {
  width: 120px;
  height: 120px;
  margin-bottom: 32px;
}

.welcome-title {
  font-size: 28px;
  font-weight: 600;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 16px;
}

.welcome-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  margin-bottom: 48px;
  line-height: 1.5;
}
```

### 9.2 四模式差異化設計

#### 精準控制者模式
- 專業深藍配色
- 強調「精準控制」、「深度分析」等關鍵詞
- 顯示進階功能預覽

#### 紀錄習慣者模式
- 優雅紫色配色
- 強調「美感記帳」、「優雅體驗」等關鍵詞
- 展示視覺設計亮點

#### 轉型挑戰者模式
- 活力橘色配色
- 強調「習慣養成」、「目標達成」等關鍵詞
- 突出激勵與支持功能

#### 潛在覺醒者模式
- 溫和綠色配色
- 強調「簡單開始」、「輕鬆記帳」等關鍵詞
- 降低使用門檻的訊息

### 9.3 模式選擇卡片
```css
.mode-selection-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  width: 100%;
  max-width: 400px;
  margin-bottom: 32px;
}

.mode-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.mode-card.selected {
  background: rgba(255, 255, 255, 0.2);
  border-color: #FFFFFF;
  transform: scale(1.05);
}

.mode-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.mode-name {
  font-size: 14px;
  font-weight: 600;
  color: #FFFFFF;
  margin-bottom: 8px;
}

.mode-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.3;
}
```

## 10. API 規格（API Specification）

### 10.1 模式設定API
**端點**: POST /app/user/mode-selection  
**對應**: F009 使用者設定功能

**請求格式**:
```json
{
  "userId": "string",
  "selectedMode": "controller|logger|struggler|sleeper",
  "deviceInfo": {
    "platform": "android|ios",
    "version": "string",
    "deviceId": "string"
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "modeConfig": {
      "modeName": "string",
      "uiTheme": "object",
      "featureFlags": "object"
    },
    "nextRoute": "string"
  }
}
```

### 10.2 應用程式初始化API
**端點**: GET /app/initialization  
**對應**: F004 帳號刪除功能

**請求格式**:
```json
{
  "deviceInfo": {
    "platform": "android|ios",
    "version": "string",
    "deviceId": "string"
  },
  "accountDeletionCheck": "boolean"
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "isFirstLaunch": "boolean",
    "userAuthenticated": "boolean",
    "availableModes": "array",
    "systemConfig": "object",
    "accountDeletionRequired": "boolean",
    "deletionPendingInfo": "object"
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```dart
enum WelcomePageState {
  loading,        // 載入中
  modeSelection,  // 模式選擇
  loginRedirect,  // 登入重導向
  error           // 錯誤狀態
}
```

### 11.2 狀態轉換規則
- loading → modeSelection: 初始化完成且為首次啟動
- loading → loginRedirect: 初始化完成且使用者已註冊但未登入
- modeSelection → loginRedirect: 使用者完成模式選擇
- 任何狀態 → error: 發生系統錯誤

### 11.3 頁面導航
- 模式選擇完成 → P002登入頁面
- 已登入使用者 → P010首頁儀表板
- 錯誤處理 → 維持當前頁面並顯示錯誤資訊

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 資料安全
- 裝置資訊收集需遵循隱私權政策
- 不在本地儲存敏感使用者資訊
- 模式選擇資料加密傳輸

### 12.2 權限要求
- 網路存取權限（必要）
- 儲存權限（快取用途）
- 通知權限（後續功能準備）

## 13. 其他補充需求（Others）

### 13.1 效能要求
- 頁面載入時間 < 2秒
- 動畫流暢度 ≥ 60fps
- 記憶體使用量 < 50MB

### 13.2 無障礙支援
- 支援螢幕閱讀器
- 提供大字體模式
- 高對比度顏色選項

### 13.3 多語系支援
- 預設繁體中文
- 支援英文切換
- 後續可擴展其他語言

### 13.4 離線支援
- 離線狀態下顯示基本介面
- 提供離線模式說明
- 網路恢復後自動同步

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS PM Team | 初版建立 - P001歡迎頁面完整SRS規格 |