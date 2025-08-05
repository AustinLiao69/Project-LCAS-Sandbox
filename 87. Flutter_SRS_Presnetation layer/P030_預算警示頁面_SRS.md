
# P030_預算警示頁面_SRS

**文件編號**: P030-SRS

**文件版本**: v1.0.0  
**建立日期**: 2025-01-26  
**最後更新**: 2025-01-26  
**負責團隊**: LCAS PM Team

---

## 目次

1. [功能目的（Purpose）](#1-功能目的purpose)
2. [使用者故事（User Story）](#2-使用者故事user-story)
3. [前置條件（Preconditions）](#3-前置條件preconditions)
4. [功能流程（User Flow / Functional Flow）](#4-功能流程user-flow--functional-flow)
5. [輸入項目（Inputs）](#5-輸入項目inputs)
6. [輸出項目（Outputs / Responses）](#6-輸出項目outputs--responses)
7. [驗證規則（Validation Rules）](#7-驗證規則validation-rules)
8. [錯誤處理（Error Handling）](#8-錯誤處理error-handling)
9. [UI 元件與排版需求（UI Requirements）](#9-ui-元件與排版需求ui-requirements)
10. [API 規格（API Specification）](#10-api-規格api-specification)
11. [狀態與畫面切換（State Handling）](#11-狀態與畫面切換state-handling)
12. [安全性與權限檢查（Security / Access Control）](#12-安全性與權限檢查security--access-control)
13. [其他補充需求（Others）](#13-其他補充需求others)

---

## 1. 功能目的（Purpose）

提供使用者設定和管理預算警示規則的完整介面，支援多層級警示機制、智慧閾值設定、個人化通知偏好，以及四種使用者模式的差異化警示體驗，協助使用者及時掌握預算執行狀況並採取適當的財務控制措施。

## 2. 使用者故事（User Story）

**作為** LCAS 使用者  
**我希望** 能夠設定預算警示規則並接收及時通知  
**以便** 在預算即將超支時提前調整支出計畫並維持財務目標

### 2.1 驗收標準（Acceptance Criteria）
- [ ] 可設定多層級警示閾值（提醒、警告、嚴重）
- [ ] 支援百分比和絕對金額兩種閾值模式
- [ ] 提供時間觸發警示設定（每日、每週檢查）
- [ ] 支援多種通知方式（APP通知、LINE訊息、Email）
- [ ] 可設定不同分類的個別警示規則
- [ ] 提供智慧建議閾值功能
- [ ] 支援暫停和啟用警示功能
- [ ] 即時預覽警示設定效果
- [ ] 四模式差異化警示介面設計
- [ ] 可檢視歷史警示觸發記錄

### 2.2 四模式差異化需求
| 模式 | 警示複雜度 | 設定選項 | 通知頻率 | 特殊功能 |
|------|-----------|----------|----------|----------|
| **精準控制者** | 高度細緻 | 完整專業設定 | 高頻即時 | 進階規則引擎 |
| **紀錄習慣者** | 中等優雅 | 美觀簡化設定 | 適中優雅 | 視覺化預覽 |
| **轉型挑戰者** | 目標導向 | 習慣養成設定 | 激勵提醒 | 成就系統整合 |
| **潛在覺醒者** | 極簡易懂 | 大按鈕設定 | 溫和提醒 | 一鍵智慧設定 |

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者已成功登入系統
- 使用者已建立至少一個預算項目
- 使用者對目標預算具有編輯權限
- 使用者已完成基本個人化設定

### 3.2 系統狀態
- 網路連線正常
- 預算資料已載入完成
- 通知服務正常運作
- 警示引擎已初始化

### 3.3 資料狀態
- 預算執行資料完整
- 使用者通知偏好已設定
- 分類設定資料可用
- 歷史警示記錄已同步

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要流程
```
1. 使用者進入預算警示頁面
2. 系統載入現有警示設定
3. 系統分析預算執行狀況
4. 顯示警示設定介面
5. 使用者設定警示規則
   ├── 選擇警示類型
   ├── 設定觸發閾值
   ├── 配置通知方式
   ├── 設定檢查頻率
   └── 選擇適用範圍
6. 系統即時驗證設定
7. 系統提供智慧建議
8. 使用者預覽警示效果
9. 確認並保存警示設定
10. 系統啟用警示監控
```

### 4.2 智慧建議流程
```
1. 系統分析使用者支出模式
2. 計算歷史預算執行情況
3. 生成個人化建議閾值
4. 提供同類使用者參考數據
5. 顯示建議設定理由
```

### 4.3 四模式特殊流程

#### 精準控制者模式
```
- 進階規則編輯器
- 複雜條件組合設定
- 自訂警示腳本功能
- 多維度監控儀表板
```

#### 紀錄習慣者模式
```
- 優雅的視覺化設定
- 預設美觀範本選擇
- 柔和的通知提醒
- 簡潔的統計呈現
```

#### 轉型挑戰者模式
```
- 目標導向設定引導
- 習慣養成里程碑
- 激勵式通知訊息
- 進度追蹤整合
```

#### 潛在覺醒者模式
```
- 一鍵智慧自動設定
- 超大按鈕操作介面
- 簡單開關控制
- 溫和提醒機制
```

## 5. 輸入項目（Inputs）

### 5.1 基本警示設定
```typescript
interface BasicAlertSettings {
  isEnabled: boolean;           // 是否啟用警示
  alertType: AlertType;         // 警示類型
  thresholdMode: ThresholdMode; // 閾值模式
  budgetId: string;            // 目標預算ID
}

enum AlertType {
  REMINDER = 'reminder',    // 提醒 (50-70%)
  WARNING = 'warning',      // 警告 (70-90%)
  CRITICAL = 'critical'     // 嚴重 (90-100%)
}

enum ThresholdMode {
  PERCENTAGE = 'percentage', // 百分比模式
  ABSOLUTE = 'absolute'      // 絕對金額模式
}
```

### 5.2 閾值設定
```typescript
interface ThresholdSettings {
  reminderThreshold: number;    // 提醒閾值
  warningThreshold: number;     // 警告閾值
  criticalThreshold: number;    // 嚴重閾值
  customThresholds?: CustomThreshold[]; // 自訂閾值
}

interface CustomThreshold {
  name: string;
  value: number;
  description: string;
  notificationMethod: NotificationMethod[];
}
```

### 5.3 通知設定
```typescript
interface NotificationSettings {
  methods: NotificationMethod[];    // 通知方式
  frequency: NotificationFrequency; // 通知頻率
  quietHours: QuietHours;          // 勿擾時段
  messageTemplate: MessageTemplate; // 訊息範本
}

enum NotificationMethod {
  PUSH = 'push',           // APP推播
  LINE = 'line',           // LINE訊息
  EMAIL = 'email',         // Email通知
  SMS = 'sms'              // 簡訊通知
}

enum NotificationFrequency {
  IMMEDIATE = 'immediate',  // 立即通知
  DAILY = 'daily',         // 每日彙整
  WEEKLY = 'weekly',       // 每週彙整
  CUSTOM = 'custom'        // 自訂頻率
}
```

### 5.4 進階設定
```typescript
interface AdvancedAlertSettings {
  // 時間設定
  timeBasedRules: TimeBasedRule[];
  
  // 分類設定
  categorySpecificRules: CategoryRule[];
  
  // 條件設定
  conditionalRules: ConditionalRule[];
  
  // 智慧設定
  aiOptimization: boolean;
  learningMode: boolean;
}
```

## 6. 輸出項目（Outputs / Responses）

### 6.1 警示設定儲存回應
```typescript
interface SaveAlertSettingsResponse {
  success: true;
  data: {
    alertId: string;
    budgetId: string;
    settings: AlertConfiguration;
    isActive: boolean;
    nextCheckTime: Date;
    estimatedTriggerDate?: Date;
  };
  message: string;
}
```

### 6.2 智慧建議回應
```typescript
interface SmartSuggestionResponse {
  suggestions: {
    recommended: RecommendedSettings;
    alternative: AlternativeSettings[];
    reasoning: string;
    confidence: number; // 0-1
    basedOnData: AnalysisData;
  };
  userPattern: SpendingPattern;
  similarUsers: BenchmarkData;
}
```

### 6.3 預覽效果回應
```typescript
interface AlertPreviewResponse {
  previewData: {
    triggerScenarios: TriggerScenario[];
    notificationSamples: NotificationSample[];
    estimatedFrequency: number;
    potentialSavings: number;
  };
  simulation: SimulationResult;
}
```

### 6.4 歷史警示記錄
```typescript
interface AlertHistoryResponse {
  alerts: AlertRecord[];
  statistics: {
    totalAlerts: number;
    preventedOverspending: number;
    averageResponseTime: number;
    effectivenessScore: number;
  };
  trends: AlertTrend[];
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 閾值驗證規則
- **閾值範圍**: 
  - 提醒閾值: 30-70%
  - 警告閾值: 60-90%
  - 嚴重閾值: 80-100%
- **閾值邏輯**: 提醒 < 警告 < 嚴重
- **絕對金額**: 不可超過預算總金額
- **最小間距**: 各閾值間至少相差5%

### 7.2 通知設定驗證
- **通知方式**: 至少選擇一種通知方式
- **勿擾時段**: 開始時間必須早於結束時間
- **頻率設定**: 自訂頻率不可低於1小時
- **範本長度**: 自訂訊息不超過200字元

### 7.3 四模式特殊驗證

#### 精準控制者模式
- **複雜規則**: 條件組合不超過10個
- **自訂閾值**: 最多建立20個自訂閾值
- **腳本規則**: 腳本邏輯必須通過安全檢查

#### 潛在覺醒者模式
- **簡化驗證**: 只驗證基本必要設定
- **自動修正**: 無效設定自動使用預設值
- **防錯設計**: 不顯示可能造成困惑的選項

## 8. 錯誤處理（Error Handling）

### 8.1 設定驗證錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 閾值順序錯誤 | "警示閾值設定順序不正確" | 自動調整並標示修正 |
| 通知方式未選 | "請至少選擇一種通知方式" | 高亮通知設定區域 |
| 勿擾時段無效 | "勿擾時段設定不正確" | 提供時段設定助手 |
| 自訂規則衝突 | "自訂規則與系統規則衝突" | 顯示衝突詳情並建議修正 |

### 8.2 系統操作錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 警示引擎離線 | "警示服務暫時無法使用" | 顯示離線模式設定 |
| 通知服務失效 | "通知功能異常" | 提供替代通知方式 |
| 設定保存失敗 | "設定保存失敗" | 自動重試並本地備份 |
| 權限不足 | "您沒有設定警示的權限" | 顯示權限申請流程 |

### 8.3 四模式特殊錯誤處理

#### 精準控制者模式
- **複雜錯誤**: 提供詳細技術錯誤資訊
- **進階診斷**: 提供系統狀態診斷工具
- **手動修復**: 允許手動編輯設定檔

#### 潛在覺醒者模式
- **簡化錯誤**: 使用簡單易懂的錯誤說明
- **自動修復**: 盡可能自動修復錯誤
- **一鍵重設**: 提供一鍵恢復預設功能

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
預算警示頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題：「預算警示設定」
│   └── 說明按鈕
├── 警示總開關區域
│   ├── 主要開關按鈕
│   ├── 當前狀態顯示
│   └── 智慧建議提示
├── 基本設定區塊
│   ├── 警示類型選擇
│   ├── 閾值設定滑桿
│   ├── 閾值模式切換
│   └── 即時預覽圖表
├── 通知設定區塊
│   ├── 通知方式選擇
│   ├── 頻率設定輪盤
│   ├── 勿擾時段設定
│   └── 訊息範本編輯
├── 進階設定區塊（可展開）
│   ├── 分類特殊規則
│   ├── 時間條件設定
│   ├── 自訂閾值管理
│   └── AI優化開關
├── 預覽與測試區域
│   ├── 設定效果預覽
│   ├── 通知測試按鈕
│   └── 歷史記錄查看
└── 底部操作列
    ├── 重設按鈕
    ├── 儲存草稿按鈕
    └── 啟用警示按鈕
```

### 9.2 四模式視覺差異設計

#### 精準控制者模式佈局
```css
/* 專業密集型設計 */
.controller-alert-page {
  background: #FAFAFA;
  padding: 12px;
}

.controller-settings-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.advanced-rules-panel {
  background: #FFFFFF;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 16px;
}

.threshold-slider-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.threshold-input {
  width: 80px;
  height: 32px;
  font-size: 14px;
  text-align: center;
}
```

#### 紀錄習慣者模式佈局
```css
/* 優雅美觀型設計 */
.logger-alert-page {
  background: linear-gradient(135deg, #F3E5F5, #E1BEE7);
  padding: 20px;
}

.elegant-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(106, 27, 154, 0.1);
}

.threshold-slider {
  height: 8px;
  background: linear-gradient(90deg, #4CAF50, #FF9800, #F44336);
  border-radius: 4px;
}

.notification-preview {
  background: #6A1B9A;
  color: #FFFFFF;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
}
```

#### 轉型挑戰者模式佈局
```css
/* 激勵目標型設計 */
.struggler-alert-page {
  background: #FFF3E0;
  padding: 16px;
}

.challenge-card {
  background: #FFFFFF;
  border: 2px solid #FF6B35;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.goal-progress-indicator {
  background: linear-gradient(90deg, #FF6B35, #FF8A65);
  height: 12px;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.achievement-badge {
  background: #FF6B35;
  color: #FFFFFF;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
}
```

#### 潛在覺醒者模式佈局
```css
/* 極簡大按鈕型設計 */
.sleeper-alert-page {
  background: #E8F5E8;
  padding: 24px;
}

.simple-toggle-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 32px;
  text-align: center;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(46, 125, 50, 0.1);
}

.super-toggle-switch {
  width: 120px;
  height: 60px;
  border-radius: 30px;
  background: #C8E6C9;
  margin: 0 auto;
  position: relative;
}

.large-action-button {
  width: 100%;
  height: 72px;
  border-radius: 16px;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}

.smart-setup-button {
  background: linear-gradient(135deg, #4CAF50, #81C784);
  color: #FFFFFF;
}
```

### 9.3 互動元件規格

#### 閾值設定滑桿
```css
.threshold-slider-container {
  position: relative;
  height: 48px;
  margin: 20px 0;
}

.threshold-track {
  height: 8px;
  background: linear-gradient(90deg, 
    #4CAF50 0%, 
    #4CAF50 50%, 
    #FF9800 50%, 
    #FF9800 80%, 
    #F44336 80%, 
    #F44336 100%
  );
  border-radius: 4px;
}

.threshold-handle {
  width: 24px;
  height: 24px;
  background: #FFFFFF;
  border: 3px solid #1976D2;
  border-radius: 50%;
  position: absolute;
  top: -8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.threshold-label {
  position: absolute;
  top: 32px;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 500;
  background: #FFFFFF;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #E0E0E0;
}
```

#### 通知方式選擇器
```css
.notification-methods {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.method-card {
  background: #FFFFFF;
  border: 2px solid #E0E0E0;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.method-card.selected {
  border-color: #1976D2;
  background: #E3F2FD;
}

.method-icon {
  font-size: 32px;
  margin-bottom: 8px;
  color: #757575;
}

.method-card.selected .method-icon {
  color: #1976D2;
}

.method-name {
  font-size: 14px;
  font-weight: 500;
  color: #424242;
}
```

## 10. API 規格（API Specification）

### 10.1 取得警示設定 API
```typescript
// GET /api/v1/budgets/{budgetId}/alert-settings
interface GetAlertSettingsRequest {
  budgetId: string;
  includeHistory?: boolean;
  includeSuggestions?: boolean;
}

interface GetAlertSettingsResponse {
  currentSettings: AlertConfiguration;
  isActive: boolean;
  lastTriggered?: Date;
  nextCheck: Date;
  suggestions?: SmartSuggestion[];
  history?: AlertRecord[];
}
```

### 10.2 更新警示設定 API (F018 v2.0.0)
```typescript
// PUT /api/v1/budgets/{budgetId}/alert-settings
interface UpdateAlertSettingsRequest {
  budgetId: string;
  settings: AlertConfiguration;
  testMode?: boolean;
  userMode: UserMode; // 四模式支援
}

interface UpdateAlertSettingsResponse {
  success: boolean;
  alertId: string;
  settings: AlertConfiguration;
  validationResults: ValidationResult[];
  estimatedImpact: ImpactEstimation;
}
```

### 10.3 測試警示 API
```typescript
// POST /api/v1/budgets/{budgetId}/test-alert
interface TestAlertRequest {
  budgetId: string;
  alertType: AlertType;
  notificationMethods: NotificationMethod[];
  testMessage?: string;
}

interface TestAlertResponse {
  testId: string;
  sentAt: Date;
  deliveryStatus: DeliveryStatus[];
  estimatedDeliveryTime: number;
}
```

### 10.4 智慧建議 API (新增)
```typescript
// GET /api/v1/budgets/{budgetId}/smart-suggestions
interface SmartSuggestionsRequest {
  budgetId: string;
  userMode: UserMode;
  includeReasons?: boolean;
  includeBenchmark?: boolean;
}

interface SmartSuggestionsResponse {
  recommended: RecommendedAlertSettings;
  alternatives: AlternativeSettings[];
  reasoning: SuggestionReasoning;
  confidence: number;
  benchmark: BenchmarkData;
}
```

### 10.5 警示歷史 API
```typescript
// GET /api/v1/budgets/{budgetId}/alert-history
interface AlertHistoryRequest {
  budgetId: string;
  startDate?: string;
  endDate?: string;
  alertType?: AlertType;
  page?: number;
  limit?: number;
}

interface AlertHistoryResponse {
  alerts: AlertRecord[];
  pagination: PaginationInfo;
  statistics: AlertStatistics;
  trends: AlertTrend[];
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```typescript
interface AlertSettingsPageState {
  // 載入狀態
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isGeneratingSuggestions: boolean;
  
  // 資料狀態
  currentSettings: AlertConfiguration;
  originalSettings: AlertConfiguration;
  suggestions: SmartSuggestion[];
  history: AlertRecord[];
  
  // UI狀態
  userMode: UserMode;
  showAdvancedSettings: boolean;
  showPreview: boolean;
  isDirty: boolean;
  
  // 驗證狀態
  validationErrors: ValidationError[];
  validationWarnings: ValidationWarning[];
  
  // 測試狀態
  testResults: TestResult[];
  lastTestTime?: Date;
}
```

### 11.2 四模式狀態差異
```typescript
interface ModeSpecificState {
  // 精準控制者模式
  controller: {
    advancedRulesExpanded: boolean;
    customThresholds: CustomThreshold[];
    scriptEditor: ScriptEditorState;
    diagnosticsVisible: boolean;
  };
  
  // 紀錄習慣者模式
  logger: {
    templatePreviewVisible: boolean;
    animationPreferences: AnimationPreferences;
    visualTheme: VisualTheme;
  };
  
  // 轉型挑戰者模式
  struggler: {
    goalProgress: GoalProgress;
    achievementUnlocked: Achievement[];
    challengeMode: ChallengeMode;
    motivationLevel: number;
  };
  
  // 潛在覺醒者模式
  sleeper: {
    smartSetupCompleted: boolean;
    simplifiedView: boolean;
    autoOptimizationEnabled: boolean;
    guidanceStep: number;
  };
}
```

### 11.3 狀態轉換邏輯
- **設定變更**: 即時更新isDirty狀態並觸發驗證
- **模式切換**: 保留相容設定並調整UI複雜度
- **智慧建議**: 背景生成並在適當時機顯示
- **測試執行**: 暫時鎖定設定並顯示測試結果

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 頁面存取權限
- **基本設定**: 需要預算檢視權限
- **警示管理**: 需要預算編輯權限
- **進階設定**: 需要預算管理權限
- **系統整合**: 需要系統管理權限

### 12.2 資料安全機制
- **設定加密**: 敏感警示規則加密儲存
- **權限驗證**: 每次設定變更都驗證權限
- **操作日誌**: 記錄所有警示設定變更
- **資料隔離**: 確保使用者間警示設定隔離

### 12.3 通知安全保護
- **訊息過濾**: 防止惡意腳本注入通知訊息
- **頻率限制**: 防止通知轟炸攻擊
- **隱私保護**: 通知內容適當脫敏處理
- **傳輸加密**: 通知傳輸過程加密保護

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **頁面載入**: 初始載入時間 < 1.5秒
- **設定響應**: 設定變更回應時間 < 200ms
- **智慧建議**: 建議生成時間 < 2秒
- **測試執行**: 警示測試響應時間 < 3秒

### 13.2 可用性需求
- **直觀設定**: 基本設定3步驟內完成
- **智慧提示**: 提供設定建議和說明
- **錯誤恢復**: 設定錯誤時提供修正建議
- **無障礙支援**: 支援螢幕閱讀器和語音操作

### 13.3 智慧化需求
- **學習優化**: 根據使用者行為優化警示規則
- **預測分析**: 預測可能的預算超支情況
- **個人化建議**: 基於個人財務模式提供建議
- **持續改進**: 根據警示效果自動調整參數

### 13.4 四模式特殊需求

#### 精準控制者模式
- **高級分析**: 提供詳細的警示效果分析
- **自訂腳本**: 支援JavaScript規則腳本
- **API整合**: 支援第三方系統整合
- **批量管理**: 支援批量設定多個預算警示

#### 紀錄習慣者模式
- **美觀體驗**: 優雅的動畫和視覺效果
- **範本選擇**: 提供多種美觀的通知範本
- **個性化**: 支援個人化色彩和主題
- **社交分享**: 支援警示設定的社交分享

#### 轉型挑戰者模式
- **成就系統**: 整合警示觸發與成就解鎖
- **激勵機制**: 提供積極的激勵訊息
- **習慣追蹤**: 整合財務習慣養成追蹤
- **目標關聯**: 與財務目標緊密整合

#### 潛在覺醒者模式
- **一鍵設定**: 提供一鍵智慧自動設定
- **極簡介面**: 隱藏複雜設定選項
- **溫和提醒**: 使用溫和不壓迫的提醒方式
- **智慧學習**: 背景自動學習並優化設定

### 13.5 監控與分析
- **使用統計**: 記錄各種警示設定的使用率
- **效果追蹤**: 監控警示對財務行為的影響
- **錯誤監控**: 追蹤設定錯誤和系統問題
- **使用者滿意度**: 收集警示功能滿意度回饋

---

**版本記錄**
- v1.0.0 (2025-01-26): 初始版本建立，包含完整的預算警示頁面SRS規格，支援四模式差異化設計和BudgetService v1.1.0、F018 API v2.0.0整合
