
# P006_首頁儀表板_SRS

**文件編號**: P006-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 15:30:00 UTC+8

---

## 1. 功能目的（Purpose）

首頁儀表板作為LCAS 2.0的主要入口，提供使用者：
- 個人化的記帳資料總覽
- 快速記帳功能入口
- 重要財務指標展示
- 四種使用模式的差異化體驗
- 智慧提醒與建議功能
- 快速導航到各功能模組

## 2. 使用者故事（User Story）

**作為日常使用者**，我希望在首頁快速了解我的財務狀況，以便做出適當的消費決策。

**作為忙碌使用者**，我希望能在首頁快速記帳，以便節省時間。

**作為不同模式的使用者**，我希望看到符合我使用習慣的個人化首頁佈局。

**作為目標導向使用者**，我希望在首頁看到預算執行狀況和財務目標進度。

## 3. 前置條件（Preconditions）

- 使用者已成功登入系統
- 使用者已選擇或確認使用模式
- 使用者已有基本的帳本設定
- 系統已載入使用者的財務資料
- 裝置具備網路連線

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 首頁載入流程
1. 使用者成功登入後導向首頁
2. 系統載入使用者偏好設定
3. 根據使用模式載入對應的佈局配置
4. 獲取最新的財務資料
5. 計算關鍵財務指標
6. 載入個人化的智慧建議
7. 渲染完整的儀表板介面

### 4.2 快速記帳流程
1. 使用者點擊快速記帳按鈕
2. 彈出快速記帳表單
3. 使用者輸入基本記帳資訊
4. 系統自動補全常用項目
5. 確認並提交記帳記錄
6. 即時更新首頁財務數據

### 4.3 資料刷新流程
1. 使用者執行下拉刷新操作
2. 系統重新獲取最新資料
3. 更新所有儀表板元件
4. 顯示刷新完成提示

### 4.4 導航流程
1. 使用者點擊功能卡片或選單項目
2. 系統記錄使用者行為
3. 導向對應的功能頁面
4. 保持導航歷史記錄

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| 使用者模式 | String | 是 | controller/logger/struggler/sleeper |
| 時間範圍 | String | 否 | daily/weekly/monthly |
| 快速記帳資料 | Object | 條件必填 | 快速記帳時必填 |
| 帳本選擇 | String | 否 | 當前檢視的帳本ID |
| 刷新請求 | Boolean | 否 | 是否請求資料刷新 |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 財務總覽 | Object | 收入、支出、餘額等關鍵指標 |
| 預算狀況 | Object | 預算執行進度和警示 |
| 近期交易 | Array | 最近的交易記錄列表 |
| 智慧建議 | Array | 個人化的財務建議 |
| 統計圖表 | Object | 視覺化的財務數據 |
| 快捷功能 | Array | 個人化的功能快捷方式 |

## 7. 驗證規則（Validation Rules）

### 7.1 資料載入驗證
- 確認使用者身份和權限
- 驗證帳本存取權限
- 檢查資料時間範圍的合理性
- 確認網路連線狀態

### 7.2 快速記帳驗證
- 金額必須為正數且合理範圍內
- 科目必須為有效的科目代碼
- 日期不能超過當前日期
- 備註長度限制檢查

### 7.3 使用者互動驗證
- 驗證操作權限
- 檢查功能可用性
- 確認導航目標的有效性

## 8. 錯誤處理（Error Handling）

| 錯誤情境 | 錯誤訊息 | 處理方式 |
|----------|----------|----------|
| 網路連線失敗 | "網路連線不穩定，顯示離線資料" | 顯示快取資料，提供重試選項 |
| 資料載入失敗 | "資料載入失敗，請重試" | 顯示重新載入按鈕 |
| 權限不足 | "沒有權限存取此帳本" | 導向帳本選擇頁面 |
| 快速記帳失敗 | "記帳失敗，已暫存至本地" | 本地暫存，等待網路恢復後同步 |
| 資料過期 | "資料可能已過期，建議刷新" | 顯示刷新提示 |
| 伺服器錯誤 | "伺服器暫時無法回應" | 顯示離線模式，記錄錯誤 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 基本佈局架構
```css
.dashboard-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 0;
  overflow-y: auto;
}

.dashboard-header {
  background: #FFFFFF;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.welcome-message {
  flex: 1;
}

.user-greeting {
  font-size: 18px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 4px;
}

.current-date {
  font-size: 14px;
  color: #757575;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #F5F5F5;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #757575;
  cursor: pointer;
}

.notification-button.has-notification {
  background: #FF5722;
  color: #FFFFFF;
}
```

### 9.2 財務總覽卡片
```css
.financial-overview {
  margin: 16px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.overview-title {
  font-size: 18px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 20px;
  text-align: center;
}

.balance-display {
  text-align: center;
  margin-bottom: 24px;
}

.current-balance {
  font-size: 32px;
  font-weight: 700;
  color: #1976D2;
  margin-bottom: 8px;
}

.balance-change {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.balance-change.positive {
  color: #4CAF50;
}

.balance-change.negative {
  color: #F44336;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.overview-item {
  text-align: center;
  padding: 16px;
  background: #F8F9FA;
  border-radius: 12px;
}

.overview-label {
  font-size: 12px;
  color: #757575;
  margin-bottom: 8px;
}

.overview-value {
  font-size: 20px;
  font-weight: 600;
}

.overview-value.income {
  color: #4CAF50;
}

.overview-value.expense {
  color: #F44336;
}
```

### 9.3 快速記帳按鈕
```css
.quick-expense-container {
  position: fixed;
  bottom: 80px;
  right: 16px;
  z-index: 1000;
}

.quick-expense-button {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-expense-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
}

.quick-expense-icon {
  color: #FFFFFF;
  font-size: 24px;
}

.quick-expense-popup {
  position: fixed;
  bottom: 160px;
  right: 16px;
  width: 280px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1001;
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 16px;
}

.quick-form-group {
  margin-bottom: 12px;
}

.quick-input {
  width: 100%;
  height: 40px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.category-chip {
  height: 32px;
  border: 1px solid #E0E0E0;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #424242;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-chip.selected {
  background: #1976D2;
  color: #FFFFFF;
  border-color: #1976D2;
}
```

### 9.4 智慧建議卡片
```css
.smart-suggestions {
  margin: 16px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.suggestions-title {
  font-size: 16px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestions-icon {
  color: #FF9800;
  font-size: 20px;
}

.suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #F0F0F0;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1976D2;
  font-size: 16px;
}

.suggestion-content {
  flex: 1;
}

.suggestion-title {
  font-size: 14px;
  font-weight: 600;
  color: #212121;
  margin-bottom: 4px;
}

.suggestion-description {
  font-size: 13px;
  color: #757575;
  line-height: 1.4;
}

.suggestion-action {
  color: #1976D2;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}
```

### 9.5 預算進度指示器
```css
.budget-progress-section {
  margin: 16px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.budget-title {
  font-size: 16px;
  font-weight: 600;
  color: #212121;
}

.view-all-budgets {
  font-size: 12px;
  color: #1976D2;
  text-decoration: underline;
  cursor: pointer;
}

.budget-item {
  margin-bottom: 20px;
}

.budget-item:last-child {
  margin-bottom: 0;
}

.budget-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.budget-name {
  font-size: 14px;
  font-weight: 500;
  color: #212121;
}

.budget-amount {
  font-size: 12px;
  color: #757575;
}

.budget-progress-bar {
  height: 8px;
  background: #F0F0F0;
  border-radius: 4px;
  overflow: hidden;
}

.budget-progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.budget-progress-fill.normal {
  background: #4CAF50;
}

.budget-progress-fill.warning {
  background: #FF9800;
}

.budget-progress-fill.danger {
  background: #F44336;
}

.budget-progress-fill.exceeded {
  background: #D32F2F;
  width: 100%;
}
```

### 9.6 近期交易列表
```css
.recent-transactions {
  margin: 16px;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.transactions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.transactions-title {
  font-size: 16px;
  font-weight: 600;
  color: #212121;
}

.view-all-transactions {
  font-size: 12px;
  color: #1976D2;
  text-decoration: underline;
  cursor: pointer;
}

.transaction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #F0F0F0;
}

.transaction-item:last-child {
  border-bottom: none;
}

.transaction-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #FFFFFF;
}

.transaction-icon.expense {
  background: #F44336;
}

.transaction-icon.income {
  background: #4CAF50;
}

.transaction-details {
  flex: 1;
}

.transaction-description {
  font-size: 14px;
  font-weight: 500;
  color: #212121;
  margin-bottom: 2px;
}

.transaction-category {
  font-size: 12px;
  color: #757575;
}

.transaction-amount {
  font-size: 16px;
  font-weight: 600;
}

.transaction-amount.expense {
  color: #F44336;
}

.transaction-amount.income {
  color: #4CAF50;
}
```

### 9.7 四模式差異化設計

#### 精準控制者模式
```css
.controller-mode .dashboard-container {
  background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
}

.controller-mode .financial-overview {
  border-left: 4px solid #1976D2;
}

.controller-mode .overview-grid {
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.controller-mode .detailed-stats {
  display: block; /* 顯示詳細統計 */
}

.controller-mode .user-greeting::before {
  content: "🎯 ";
}
```

#### 紀錄習慣者模式
```css
.logger-mode .dashboard-container {
  background: linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%);
}

.logger-mode .financial-overview {
  border-left: 4px solid #6A1B9A;
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(243,229,245,0.95));
}

.logger-mode .balance-display {
  background: radial-gradient(circle, rgba(106,27,154,0.1), transparent);
  border-radius: 50%;
  padding: 32px;
}

.logger-mode .user-greeting::before {
  content: "✨ ";
}

.logger-mode .aesthetic-elements {
  display: block; /* 顯示美觀裝飾元素 */
}
```

#### 轉型挑戰者模式
```css
.struggler-mode .dashboard-container {
  background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%);
}

.struggler-mode .financial-overview {
  border-left: 4px solid #FF6B35;
}

.struggler-mode .motivational-section {
  display: block; /* 顯示激勵內容 */
  background: #FFF3E0;
  border: 1px solid #FFCC02;
  border-radius: 12px;
  padding: 16px;
  margin: 16px;
  text-align: center;
}

.struggler-mode .progress-indicators {
  display: block; /* 顯示進度指標 */
}

.struggler-mode .user-greeting::before {
  content: "💪 ";
}
```

#### 潛在覺醒者模式
```css
.sleeper-mode .dashboard-container {
  background: linear-gradient(135deg, #E8F5E8 0%, #C8E6C9 100%);
}

.sleeper-mode .financial-overview {
  border-left: 4px solid #4CAF50;
}

.sleeper-mode .simplified-view {
  display: block; /* 顯示簡化視圖 */
}

.sleeper-mode .complex-features {
  display: none; /* 隱藏複雜功能 */
}

.sleeper-mode .overview-grid {
  grid-template-columns: repeat(2, 1fr); /* 簡化為2欄 */
}

.sleeper-mode .user-greeting::before {
  content: "🌱 ";
}
```

## 10. API 規格（API Specification）

### 10.1 載入儀表板資料API
**端點**: GET /dashboard/data  
**對應**: F015 儀表板功能

**請求參數**:
```
?userId=user_id&timeRange=monthly&ledgerId=ledger_id
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "financial_overview": {
      "current_balance": 25000,
      "monthly_income": 45000,
      "monthly_expense": 20000,
      "balance_change": 5000,
      "change_percentage": 25.0
    },
    "budget_status": [
      {
        "budget_id": "budget_001",
        "name": "餐飲預算",
        "allocated": 5000,
        "spent": 3200,
        "percentage": 64,
        "status": "normal"
      }
    ],
    "recent_transactions": [
      {
        "transaction_id": "txn_001",
        "description": "午餐",
        "amount": -150,
        "category": "餐飲",
        "date": "2025-01-26T12:30:00Z",
        "type": "expense"
      }
    ],
    "smart_suggestions": [
      {
        "id": "suggestion_001",
        "type": "budget_alert",
        "title": "餐飲支出偏高",
        "description": "本月餐飲支出已達預算64%，建議控制用餐頻率",
        "action": "view_budget_detail"
      }
    ]
  }
}
```

### 10.2 快速記帳API
**端點**: POST /transactions/quick-add  
**對應**: F006 記帳功能

**請求格式**:
```json
{
  "amount": 150,
  "category": "餐飲",
  "description": "午餐",
  "type": "expense",
  "date": "2025-01-26T12:30:00Z",
  "ledger_id": "ledger_001"
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_002",
    "message": "記帳成功",
    "updated_balance": 24850,
    "budget_impact": {
      "budget_id": "budget_001",
      "remaining": 1650,
      "percentage": 67
    }
  }
}
```

### 10.3 刷新儀表板API
**端點**: POST /dashboard/refresh  
**對應**: F015 儀表板功能

**請求格式**:
```json
{
  "user_id": "user_001",
  "force_refresh": true,
  "components": ["financial_overview", "budget_status", "recent_transactions"]
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "refresh_timestamp": "2025-01-26T15:30:00Z",
    "updated_components": ["financial_overview", "budget_status", "recent_transactions"],
    "cache_status": "updated"
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```dart
enum DashboardState {
  loading,        // 載入中
  loaded,         // 資料載入完成
  refreshing,     // 刷新中
  error,          // 載入錯誤
  offline,        // 離線模式
  quickAdding     // 快速記帳中
}
```

### 11.2 資料狀態管理
```dart
class DashboardData {
  FinancialOverview? financialOverview;
  List<BudgetStatus> budgetStatus = [];
  List<Transaction> recentTransactions = [];
  List<SmartSuggestion> smartSuggestions = [];
  String? selectedLedgerId;
  String timeRange = 'monthly';
  DateTime lastUpdated = DateTime.now();
  bool isRefreshing = false;
  String? errorMessage;
}
```

### 11.3 頁面導航邏輯
- 點擊預算卡片 → P030預算總覽頁面
- 點擊交易項目 → P013記帳歷史頁面
- 點擊快速記帳 → P011快速記帳頁面
- 點擊智慧建議 → 對應功能頁面
- 底部導航 → 對應功能模組

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 資料存取權限
- 驗證使用者對帳本的存取權限
- 檢查資料查詢範圍的合理性
- 確認敏感資料的顯示權限
- 記錄資料存取日誌

### 12.2 操作安全
- 快速記帳操作的合理性檢查
- 防止惡意的大量請求
- 驗證資料修改權限
- 實施操作頻率限制

### 12.3 隱私保護
- 敏感財務資料的保護
- 螢幕錄製防護
- 生物辨識解鎖支援
- 離開應用時的資料隱藏

## 13. 其他補充需求（Others）

### 13.1 效能要求
- 首頁載入時間 < 3秒
- 資料刷新時間 < 2秒
- 快速記帳回應時間 < 1秒
- 滑動操作流暢度 > 60fps

### 13.2 快取策略
- 財務資料本地快取24小時
- 智慧建議快取12小時
- 使用者偏好設定永久快取
- 離線資料支援基本功能

### 13.3 個人化體驗
- 記住使用者的操作偏好
- 智慧排序功能卡片
- 自適應的建議內容
- 季節性主題切換

### 13.4 無障礙支援
- 大字體模式支援
- 高對比度顯示
- 螢幕閱讀器最佳化
- 語音操作支援

### 13.5 分析與監控
- 使用者行為分析
- 功能使用率統計
- 效能指標監控
- 錯誤率追蹤

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS PM Team | 初版建立 - P010首頁儀表板完整SRS規格 |
