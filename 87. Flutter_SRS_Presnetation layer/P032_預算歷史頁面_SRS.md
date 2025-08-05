
# P032_預算歷史頁面_SRS

**文件編號**: P032-SRS  
**版本**: v1.0.0  
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

提供使用者完整的預算歷史記錄查看功能，包含時間軸檢視、歷史版本比較、變更追蹤、執行軌跡分析等，協助使用者了解預算演進過程，分析歷史表現模式，學習財務管理經驗，並根據四種使用者模式提供差異化的歷史檢視體驗。

## 2. 使用者故事（User Story）

**作為** LCAS 使用者  
**我希望** 能夠查看我的預算歷史記錄和變更軌跡  
**以便** 了解預算演進過程、分析歷史表現、學習財務管理經驗

### 2.1 驗收標準（Acceptance Criteria）
- [ ] 提供完整的預算歷史時間軸檢視
- [ ] 支援預算版本比較功能
- [ ] 顯示預算變更記錄和原因
- [ ] 提供歷史執行表現分析
- [ ] 支援歷史資料篩選和搜尋
- [ ] 顯示重要里程碑和事件
- [ ] 支援歷史資料匯出
- [ ] 提供歷史趨勢圖表
- [ ] 四模式差異化歷史檢視
- [ ] 支援歷史資料恢復功能

### 2.2 四模式差異化需求
| 模式 | 歷史深度 | 顯示詳細度 | 分析功能 | 恢復能力 |
|------|----------|------------|----------|---------|
| **精準控制者** | 完整詳細 | 技術細節 | 深度分析 | 完整恢復 |
| **紀錄習慣者** | 美觀呈現 | 視覺重點 | 趨勢展示 | 優雅恢復 |
| **轉型挑戰者** | 成長軌跡 | 進步重點 | 成長分析 | 目標恢復 |
| **潛在覺醒者** | 簡化摘要 | 關鍵事件 | 基本趨勢 | 簡單恢復 |

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者已成功登入系統
- 使用者對目標預算具有檢視權限
- 使用者已有預算歷史記錄
- 系統已啟用歷史記錄功能

### 3.2 系統狀態
- 網路連線正常
- 歷史資料服務正常運作
- 版本控制系統可用
- 時間軸渲染引擎已載入

### 3.3 資料狀態
- 預算歷史資料完整
- 版本變更記錄準確
- 執行軌跡資料可用
- 事件日誌記錄完整

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 歷史檢視載入流程
```
1. 使用者進入預算歷史頁面
2. 系統檢查歷史檢視權限
3. 系統載入預算基本資訊
4. 系統查詢歷史記錄資料
5. 系統建構時間軸視圖
6. 顯示歷史記錄列表
7. 系統提供篩選和搜尋功能
```

### 4.2 歷史比較分析流程
```
1. 使用者選擇比較的歷史版本
2. 系統載入版本詳細資料
3. 系統執行版本差異比較
4. 系統生成比較分析報告
5. 顯示差異視覺化圖表
6. 提供變更原因和影響分析
7. 使用者可深入檢視細節
```

### 4.3 歷史恢復流程
```
1. 使用者選擇要恢復的歷史版本
2. 系統顯示恢復預覽
3. 系統分析恢復影響範圍
4. 使用者確認恢復操作
5. 系統執行安全恢復流程
6. 系統建立恢復點備份
7. 系統記錄恢復操作日誌
8. 顯示恢復結果確認
```

### 4.4 四模式特殊流程

#### 精準控制者模式
```
- 詳細變更追蹤分析
- 技術層面差異比較
- 進階歷史資料查詢
- 精確版本恢復控制
```

#### 紀錄習慣者模式
```
- 美觀的時間軸展示
- 視覺化歷史趨勢
- 優雅的版本比較
- 直觀的恢復介面
```

#### 轉型挑戰者模式
```
- 成長軌跡時間軸
- 目標達成歷程
- 習慣改善記錄
- 成就里程碑展示
```

#### 潛在覺醒者模式
```
- 簡化歷史摘要
- 重點事件標記
- 基本趨勢展示
- 一鍵簡單恢復
```

## 5. 輸入項目（Inputs）

### 5.1 歷史查詢參數
```typescript
interface HistoryQueryParams {
  budgetId: string;              // 預算ID
  timeRange: TimeRangeConfig;    // 時間範圍
  versionLimit: number;          // 版本數量限制
  includeDeleted: boolean;       // 是否包含已刪除記錄
  eventTypes: HistoryEventType[]; // 事件類型篩選
}

interface TimeRangeConfig {
  startDate: Date;          // 開始日期
  endDate: Date;            // 結束日期
  granularity: TimeGranularity; // 時間粒度
}

enum HistoryEventType {
  CREATED = 'created',           // 建立事件
  UPDATED = 'updated',           // 更新事件
  DELETED = 'deleted',           // 刪除事件
  RESTORED = 'restored',         // 恢復事件
  MILESTONE = 'milestone',       // 里程碑事件
  ALERT = 'alert'               // 警示事件
}

enum TimeGranularity {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year'
}
```

### 5.2 版本比較參數
```typescript
interface VersionComparisonParams {
  budgetId: string;         // 預算ID
  baseVersion: string;      // 基準版本ID
  compareVersion: string;   // 比較版本ID
  comparisonType: ComparisonType; // 比較類型
  focusFields: string[];    // 重點比較欄位
}

enum ComparisonType {
  FULL = 'full',           // 完整比較
  SUMMARY = 'summary',     // 摘要比較
  CHANGES_ONLY = 'changes_only', // 僅變更部分
  IMPACT = 'impact'        // 影響分析
}
```

### 5.3 恢復操作參數
```typescript
interface RestoreOperationParams {
  budgetId: string;           // 預算ID
  targetVersion: string;      // 目標版本ID
  restoreMode: RestoreMode;   // 恢復模式
  backupBeforeRestore: boolean; // 恢復前備份
  notifyUsers: boolean;       // 通知相關使用者
  reason: string;             // 恢復原因說明
}

enum RestoreMode {
  FULL_RESTORE = 'full_restore',     // 完整恢復
  PARTIAL_RESTORE = 'partial_restore', // 部分恢復
  MERGE_RESTORE = 'merge_restore',   // 合併恢復
  PREVIEW_ONLY = 'preview_only'      // 僅預覽
}
```

### 5.4 歷史篩選參數
```typescript
interface HistoryFilterParams {
  // 用戶篩選
  modifiedBy: string[];       // 修改者
  
  // 事件篩選
  eventTypes: HistoryEventType[];
  eventSeverity: EventSeverity[];
  
  // 內容篩選
  changedFields: string[];    // 變更欄位
  changeThreshold: number;    // 變更閾值
  
  // 搜尋條件
  searchKeyword: string;      // 搜尋關鍵字
  searchFields: SearchField[]; // 搜尋欄位
}

enum EventSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

enum SearchField {
  DESCRIPTION = 'description',
  REASON = 'reason',
  COMMENT = 'comment',
  TAG = 'tag'
}
```

## 6. 輸出項目（Outputs / Responses）

### 6.1 歷史記錄回應
```typescript
interface BudgetHistoryResponse {
  success: boolean;
  data: {
    timeline: HistoryTimeline;
    versions: BudgetVersion[];
    events: HistoryEvent[];
    statistics: HistoryStatistics;
  };
  pagination: PaginationInfo;
  metadata: HistoryMetadata;
}

interface HistoryTimeline {
  timelineId: string;
  budgetId: string;
  startDate: Date;
  endDate: Date;
  totalVersions: number;
  majorMilestones: Milestone[];
  timelineData: TimelinePoint[];
}

interface BudgetVersion {
  versionId: string;
  versionNumber: string;
  createdAt: Date;
  createdBy: UserInfo;
  budgetData: BudgetSnapshot;
  changesSummary: ChangesSummary;
  tags: string[];
  isActive: boolean;
  isMajorVersion: boolean;
}

interface HistoryEvent {
  eventId: string;
  eventType: HistoryEventType;
  timestamp: Date;
  userId: string;
  userName: string;
  description: string;
  affectedFields: string[];
  beforeValue: any;
  afterValue: any;
  reason?: string;
  impact: ImpactLevel;
}

enum ImpactLevel {
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  MAJOR = 'major'
}
```

### 6.2 版本比較回應
```typescript
interface VersionComparisonResponse {
  success: boolean;
  comparison: {
    baseVersion: BudgetVersion;
    compareVersion: BudgetVersion;
    differences: FieldDifference[];
    summary: ComparisonSummary;
    visualDiff: VisualDiffData;
  };
  analysis: ComparisonAnalysis;
}

interface FieldDifference {
  fieldName: string;
  fieldPath: string;
  changeType: ChangeType;
  oldValue: any;
  newValue: any;
  percentageChange?: number;
  impact: ImpactAssessment;
}

enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed', 
  MODIFIED = 'modified',
  UNCHANGED = 'unchanged'
}

interface ComparisonSummary {
  totalChanges: number;
  addedFields: number;
  removedFields: number;
  modifiedFields: number;
  significantChanges: number;
  overallImpact: ImpactLevel;
}
```

### 6.3 歷史恢復回應
```typescript
interface RestoreOperationResponse {
  success: boolean;
  result: {
    operationId: string;
    restoredVersion: BudgetVersion;
    backupVersion?: BudgetVersion;
    restoredAt: Date;
    restoredBy: UserInfo;
    affectedAreas: string[];
    validationResults: ValidationResult[];
  };
  warnings: RestoreWarning[];
  nextSteps: string[];
}

interface RestoreWarning {
  warningType: WarningType;
  severity: WarningSeverity;
  message: string;
  affectedArea: string;
  recommendation: string;
}

enum WarningType {
  DATA_LOSS = 'data_loss',
  DEPENDENCY = 'dependency',
  PERMISSION = 'permission',
  COMPATIBILITY = 'compatibility'
}

enum WarningSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}
```

### 6.4 四模式差異化輸出
```typescript
interface ModeSpecificHistoryOutput {
  // 精準控制者模式
  controller: {
    detailedChangeLogs: DetailedChangeLog[];
    technicalMetrics: TechnicalMetric[];
    auditTrail: AuditTrailEntry[];
    systemEvents: SystemEvent[];
  };
  
  // 紀錄習慣者模式
  logger: {
    visualTimeline: VisualTimelineData;
    aestheticMilestones: AestheticMilestone[];
    colorCodedEvents: ColorCodedEvent[];
    beautifulCharts: BeautifulChart[];
  };
  
  // 轉型挑戰者模式
  struggler: {
    growthJourney: GrowthJourneyData;
    achievementHistory: AchievementHistory[];
    habitChanges: HabitChangeRecord[];
    progressMilestones: ProgressMilestone[];
  };
  
  // 潛在覺醒者模式
  sleeper: {
    simplifiedSummary: SimplifiedHistorySummary;
    keyEvents: KeyHistoryEvent[];
    basicTrends: BasicTrendData[];
    easyActions: EasyHistoryAction[];
  };
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 查詢參數驗證
- **時間範圍**: 開始日期不能晚於結束日期
- **版本限制**: 版本數量限制在1-1000之間
- **事件類型**: 事件類型必須在有效範圍內
- **搜尋條件**: 搜尋關鍵字長度限制在100字元內

### 7.2 版本比較驗證
- **版本存在性**: 確保比較的版本都存在且有效
- **版本關聯**: 驗證版本屬於同一預算項目
- **比較權限**: 確保使用者有比較權限
- **版本時序**: 基準版本不能晚於比較版本

### 7.3 恢復操作驗證
- **恢復權限**: 驗證使用者具有恢復權限
- **版本有效性**: 確保目標版本可恢復
- **依賴檢查**: 檢查恢復操作的依賴影響
- **衝突檢測**: 檢測恢復可能的數據衝突

### 7.4 四模式特殊驗證

#### 精準控制者模式
- **詳細權限**: 驗證進階功能存取權限
- **技術參數**: 驗證技術參數的正確性
- **複雜查詢**: 驗證複雜查詢的合理性

#### 潛在覺醒者模式
- **簡化驗證**: 自動修正無效參數
- **預設應用**: 使用安全的預設值
- **錯誤容忍**: 容忍輕微的參數錯誤

## 8. 錯誤處理（Error Handling）

### 8.1 資料載入錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 無歷史資料 | "此預算尚無歷史記錄" | 顯示空狀態指引 |
| 資料載入失敗 | "歷史資料載入失敗" | 提供重新載入選項 |
| 權限不足 | "您沒有檢視歷史的權限" | 顯示權限申請流程 |
| 資料損壞 | "歷史資料損壞或不完整" | 提供資料修復建議 |

### 8.2 比較操作錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 版本不存在 | "選擇的版本不存在" | 重新載入版本列表 |
| 比較失敗 | "版本比較計算失敗" | 提供簡化比較選項 |
| 資料不相容 | "版本資料結構不相容" | 顯示相容性說明 |
| 計算超時 | "比較計算時間過長" | 提供後台處理選項 |

### 8.3 恢復操作錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 恢復失敗 | "版本恢復操作失敗" | 顯示失敗原因和建議 |
| 權限不足 | "您沒有執行恢復的權限" | 申請恢復權限流程 |
| 數據衝突 | "恢復操作與現有數據衝突" | 提供衝突解決方案 |
| 依賴錯誤 | "恢復會影響其他相關數據" | 顯示影響範圍確認 |

### 8.4 四模式特殊錯誤處理

#### 精準控制者模式
- **詳細錯誤**: 提供完整的錯誤資訊和堆疊追蹤
- **技術診斷**: 提供系統診斷工具
- **手動修復**: 允許手動修復數據問題

#### 潛在覺醒者模式
- **簡化錯誤**: 使用易懂的錯誤說明
- **自動修復**: 盡可能自動修復問題
- **一鍵重試**: 提供簡單的重試機制

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 歷史頁面佈局
```
預算歷史頁面
├── 頂部控制列
│   ├── 返回按鈕
│   ├── 頁面標題：「預算歷史」
│   ├── 時間範圍選擇器
│   ├── 篩選按鈕
│   └── 搜尋框
├── 歷史概覽卡片
│   ├── 總版本數統計
│   ├── 重要里程碑
│   ├── 最近活動
│   └── 快速操作按鈕
├── 時間軸主要區域
│   ├── 時間軸控制工具
│   ├── 互動式時間軸
│   ├── 版本節點顯示
│   └── 事件詳情面板
├── 版本列表區域
│   ├── 版本卡片列表
│   ├── 版本比較選擇
│   ├── 快速預覽
│   └── 操作按鈕組
├── 詳情與分析區塊
│   ├── 選中版本詳情
│   ├── 變更分析圖表
│   ├── 影響評估
│   └── 相關建議
└── 底部操作列
    ├── 批量操作按鈕
    ├── 匯出歷史按鈕
    ├── 恢復版本按鈕
    └── 更多選項按鈕
```

### 9.2 四模式視覺差異設計

#### 精準控制者模式佈局
```css
/* 專業詳細歷史檢視設計 */
.controller-history-page {
  background: #F8F9FA;
  padding: 12px;
  display: grid;
  grid-template-areas:
    "controls controls"
    "timeline details"
    "versions analysis";
  grid-template-columns: 1fr 400px;
  grid-template-rows: auto 1fr 300px;
  gap: 16px;
}

.detailed-timeline-container {
  background: #FFFFFF;
  border: 1px solid #DEE2E6;
  border-radius: 8px;
  padding: 16px;
  overflow: auto;
}

.technical-version-card {
  background: #FFFFFF;
  border: 1px solid #E9ECEF;
  border-left: 4px solid #6C757D;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
  font-family: 'Roboto Mono', monospace;
}

.change-diff-viewer {
  background: #F8F9FA;
  border: 1px solid #DEE2E6;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Source Code Pro', monospace;
  font-size: 12px;
}

.version-metadata {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
  color: #6C757D;
}

.advanced-controls-panel {
  background: #FFFFFF;
  border: 1px solid #DEE2E6;
  border-radius: 8px;
  padding: 16px;
}

.control-group {
  margin-bottom: 16px;
}

.control-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #495057;
}
```

#### 紀錄習慣者模式佈局
```css
/* 美觀優雅歷史展示設計 */
.logger-history-page {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  min-height: 100vh;
}

.elegant-timeline-container {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border-radius: 24px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.beautiful-timeline {
  position: relative;
  padding-left: 30px;
}

.timeline-line {
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, #667eea, #764ba2);
}

.timeline-node {
  position: absolute;
  left: 8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 3px solid #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.timeline-node.major {
  width: 24px;
  height: 24px;
  left: 4px;
  border-color: #764ba2;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.aesthetic-version-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  margin-left: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border-left: 4px solid transparent;
  border-image: linear-gradient(135deg, #667eea, #764ba2) 1;
  position: relative;
}

.version-timestamp {
  position: absolute;
  top: -8px;
  right: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #FFFFFF;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.change-summary-visual {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.change-indicator {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.change-indicator.added {
  background: linear-gradient(90deg, #4CAF50, #81C784);
}

.change-indicator.modified {
  background: linear-gradient(90deg, #FF9800, #FFB74D);
}

.change-indicator.removed {
  background: linear-gradient(90deg, #F44336, #E57373);
}
```

#### 轉型挑戰者模式佈局
```css
/* 成長軌跡激勵設計 */
.struggler-history-page {
  background: linear-gradient(135deg, #ff6b6b, #feca57);
  padding: 20px;
}

.growth-journey-header {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 24px;
  text-align: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.2);
}

.journey-progress-bar {
  width: 100%;
  height: 12px;
  background: #E0E0E0;
  border-radius: 6px;
  overflow: hidden;
  margin: 16px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #feca57);
  border-radius: 6px;
  transition: width 0.8s ease;
}

.milestone-timeline {
  position: relative;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.1);
}

.milestone-marker {
  position: absolute;
  left: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff6b6b, #feca57);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-weight: 600;
  font-size: 16px;
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
}

.achievement-badge-collection {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-left: 70px; 
}

.achievement-badge {
  background: linear-gradient(135deg, #ff6b6b, #feca57);
  color: #FFFFFF;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.growth-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.growth-metric-card {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  border-top: 4px solid #ff6b6b;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: #ff6b6b;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 14px;
  color: #666666;
  font-weight: 500;
}
```

#### 潛在覺醒者模式佈局
```css
/* 極簡歷史檢視設計 */
.sleeper-history-page {
  background: #E8F5E8;
  padding: 24px;
}

.simple-history-summary {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 32px;
  text-align: center;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(76, 175, 80, 0.1);
}

.history-count-display {
  font-size: 48px;
  font-weight: 700;
  color: #4CAF50;
  margin-bottom: 8px;
}

.history-count-label {
  font-size: 18px;
  color: #666666;
  margin-bottom: 20px;
}

.key-events-list {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
}

.key-event-item {
  background: #F1F8E9;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid #4CAF50;
  display: flex;
  align-items: center;
  gap: 16px;
}

.event-icon {
  width: 40px;
  height: 40px;
  background: #4CAF50;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 18px;
  flex-shrink: 0;
}

.event-content {
  flex: 1;
}

.event-title {
  font-size: 16px;
  font-weight: 600;
  color: #2E7D32;
  margin-bottom: 4px;
}

.event-description {
  font-size: 14px;
  color: #666666;
  line-height: 1.4;
}

.event-date {
  font-size: 12px;
  color: #999999;
  margin-top: 4px;
}

.simple-action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 24px;
}

.simple-history-button {
  height: 56px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.primary-history-button {
  background: linear-gradient(135deg, #4CAF50, #81C784);
  color: #FFFFFF;
}

.secondary-history-button {
  background: #FFFFFF;
  color: #4CAF50;
  border: 2px solid #4CAF50;
}
```

### 9.3 時間軸元件規格

#### 互動式時間軸
```css
.interactive-timeline {
  position: relative;
  width: 100%;
  height: 400px;
  overflow-x: auto;
  overflow-y: hidden;
}

.timeline-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #E0E0E0, #BDBDBD);
  border-radius: 2px;
  transform: translateY(-50%);
}

.timeline-marker {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #1976D2;
  border: 2px solid #FFFFFF;
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.timeline-marker:hover {
  width: 16px;
  height: 16px;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.4);
}

.timeline-marker.major {
  width: 16px;
  height: 16px;
  background: #D32F2F;
  border-color: #FFFFFF;
  box-shadow: 0 2px 8px rgba(211, 47, 47, 0.3);
}

.timeline-marker.selected {
  width: 20px;
  height: 20px;
  background: #FF5722;
  box-shadow: 0 4px 12px rgba(255, 87, 34, 0.5);
}

.timeline-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #FFFFFF;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 20;
}

.timeline-marker:hover .timeline-tooltip {
  opacity: 1;
}

.timeline-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  z-index: 30;
}

.timeline-zoom-button {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #FFFFFF;
  border: 1px solid #E0E0E0;
  color: #666666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
}

.timeline-zoom-button:hover {
  background: #F5F5F5;
  border-color: #BDBDBD;
}
```

## 10. API 規格（API Specification）

### 10.1 取得預算歷史 API
```typescript
// GET /api/v1/budgets/{budgetId}/history
interface GetBudgetHistoryRequest {
  budgetId: string;
  timeRange?: TimeRangeConfig;
  versionLimit?: number;
  includeDeleted?: boolean;
  eventTypes?: HistoryEventType[];
  userMode: UserMode;
}

interface GetBudgetHistoryResponse {
  success: boolean;
  data: BudgetHistoryData;
  pagination: PaginationInfo;
  metadata: HistoryMetadata;
}
```

### 10.2 版本比較 API (F017 v2.0.0)
```typescript
// POST /api/v1/budgets/{budgetId}/compare-versions
interface CompareVersionsRequest {
  budgetId: string;
  baseVersion: string;
  compareVersion: string;
  comparisonType: ComparisonType;
  focusFields?: string[];
  userMode: UserMode;
}

interface CompareVersionsResponse {
  success: boolean;
  comparison: VersionComparisonData;
  analysis: ComparisonAnalysis;
  recommendations: ComparisonRecommendation[];
}
```

### 10.3 恢復預算版本 API (F016 v2.0.0)
```typescript
// POST /api/v1/budgets/{budgetId}/restore-version
interface RestoreVersionRequest {
  budgetId: string;
  targetVersion: string;
  restoreMode: RestoreMode;
  backupBeforeRestore: boolean;
  reason: string;
  confirmationToken: string;
}

interface RestoreVersionResponse {
  success: boolean;
  result: RestoreOperationResult;
  warnings: RestoreWarning[];
  nextSteps: string[];
}
```

### 10.4 搜尋歷史記錄 API
```typescript
// GET /api/v1/budgets/{budgetId}/history/search
interface SearchHistoryRequest {
  budgetId: string;
  keyword: string;
  searchFields: SearchField[];
  filters: HistoryFilterParams;
  sortBy: HistorySortField;
  sortOrder: SortOrder;
  page: number;
  limit: number;
}

interface SearchHistoryResponse {
  success: boolean;
  results: HistorySearchResult[];
  totalCount: number;
  pagination: PaginationInfo;
  suggestions: SearchSuggestion[];
}

enum HistorySortField {
  TIMESTAMP = 'timestamp',
  VERSION = 'version',
  IMPACT = 'impact',
  RELEVANCE = 'relevance'
}

enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 歷史頁面狀態
```typescript
interface HistoryPageState {
  // 載入狀態
  isLoadingHistory: boolean;
  isComparingVersions: boolean;
  isRestoringVersion: boolean;
  isSearching: boolean;
  
  // 資料狀態
  historyData: BudgetHistoryData;
  selectedVersions: string[];
  comparisonResult: VersionComparisonData;
  searchResults: HistorySearchResult[];
  
  // UI狀態
  timelineViewMode: TimelineViewMode;
  selectedTimeRange: TimeRangeConfig;
  activeFilters: HistoryFilterParams;
  sortConfig: SortConfiguration;
  
  // 互動狀態
  selectedNode: TimelineNode;
  previewVersion: BudgetVersion;
  restorePreview: RestorePreviewData;
  
  // 四模式狀態
  userMode: UserMode;
  modeSpecificState: ModeSpecificHistoryState;
}

enum TimelineViewMode {
  TIMELINE = 'timeline',
  LIST = 'list',
  GRID = 'grid',
  CALENDAR = 'calendar'
}
```

### 11.2 版本比較狀態
```typescript
interface VersionComparisonState {
  // 比較配置
  baseVersion: BudgetVersion;
  compareVersion: BudgetVersion;
  comparisonType: ComparisonType;
  
  // 比較結果
  differences: FieldDifference[];
  visualDiff: VisualDiffData;
  analysisResults: ComparisonAnalysis;
  
  // UI狀態
  diffViewMode: DiffViewMode;
  highlightedChanges: string[];
  collapsedSections: string[];
  
  // 互動狀態
  selectedDifference: FieldDifference;
  filterConfig: DiffFilterConfig;
}

enum DiffViewMode {
  UNIFIED = 'unified',
  SPLIT = 'split',
  VISUAL = 'visual',
  SUMMARY = 'summary'
}
```

### 11.3 狀態轉換邏輯
- **歷史載入**: 自動載入最近100個版本
- **版本選擇**: 支援多選比較模式
- **搜尋執行**: 即時搜尋結果更新
- **恢復操作**: 需要確認流程保護

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 歷史檢視權限
- **基本檢視**: 需要預算檢視權限
- **詳細歷史**: 需要預算管理權限
- **敏感操作**: 需要系統管理權限
- **跨帳本歷史**: 需要特殊授權

### 12.2 版本操作權限
- **版本比較**: 需要預算分析權限
- **版本恢復**: 需要預算恢復權限
- **歷史匯出**: 需要資料匯出權限
- **敏感資料**: 需要財務資料權限

### 12.3 資料安全保護
- **歷史加密**: 敏感歷史資料加密儲存
- **存取追蹤**: 記錄所有歷史檢視行為
- **資料脫敏**: 適當脫敏顯示敏感資訊
- **審計日誌**: 完整的操作審計記錄

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **歷史載入**: 初始載入時間 < 2秒
- **版本比較**: 比較計算時間 < 3秒
- **搜尋響應**: 搜尋結果回應時間 < 1秒
- **時間軸渲染**: 時間軸初始渲染 < 1秒

### 13.2 儲存與快取
- **歷史快取**: 常用歷史資料本地快取
- **比較快取**: 比較結果暫時快取
- **搜尋快取**: 搜尋結果智慧快取
- **離線支援**: 基本歷史檢視離線可用

### 13.3 國際化需求
- **多語言**: 歷史介面多語言支援
- **時間格式**: 支援不同地區時間格式
- **排序規則**: 支援多語言排序規則
- **文化適應**: 根據文化調整歷史展示

### 13.4 四模式特殊需求

#### 精準控制者模式
- **進階分析**: 提供統計分析工具
- **資料匯出**: 支援多種格式匯出
- **API整合**: 支援外部工具整合
- **自訂檢視**: 支援自訂歷史檢視

#### 紀錄習慣者模式
- **美觀展示**: 優雅的視覺設計
- **動畫效果**: 流暢的過渡動畫
- **個性化**: 支援個人化主題
- **分享功能**: 支援歷史分享

#### 轉型挑戰者模式
- **成長追蹤**: 追蹤成長軌跡
- **里程碑**: 標記重要里程碑  
- **激勵展示**: 激勵式歷史展示
- **成就整合**: 整合成就系統

#### 潛在覺醒者模式
- **簡化檢視**: 簡化的歷史檢視
- **重點突出**: 突出重要事件
- **易懂說明**: 簡單易懂的說明
- **一鍵操作**: 簡化的操作流程

---

**版本記錄**
- v1.0.0 (2025-01-26): 初始版本建立，包含完整的預算歷史頁面SRS規格，支援四模式差異化設計和BudgetService v1.1.0、F016/F017 API v2.0.0整合，提供全面的歷史檢視和管理功能
