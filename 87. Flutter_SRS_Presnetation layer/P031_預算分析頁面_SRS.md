
# P031_預算分析頁面_SRS

**文件編號**: P031-SRS  
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

提供使用者全方位的預算執行分析與洞察，包含多維度數據視覺化、趨勢分析、效能評估、對比分析等功能，協助使用者深度理解預算執行情況，發現支出模式，制定更精準的財務策略，並根據四種使用者模式提供差異化的分析體驗。

## 2. 使用者故事（User Story）

**作為** LCAS 使用者  
**我希望** 能夠透過多種圖表和分析工具深入了解我的預算執行情況  
**以便** 發現支出模式、優化預算配置、提升財務管理效率

### 2.1 驗收標準（Acceptance Criteria）
- [ ] 提供多種圖表類型（圓餅圖、折線圖、柱狀圖、熱力圖）
- [ ] 支援時間維度分析（日、週、月、季、年）
- [ ] 提供分類維度分析（收入、支出、專案、標籤）
- [ ] 支援多預算比較分析
- [ ] 提供趨勢預測和建議
- [ ] 支援自訂分析週期和條件
- [ ] 提供互動式圖表操作
- [ ] 支援分析報告匯出
- [ ] 四模式差異化分析介面
- [ ] 提供洞察提示和建議行動

### 2.2 四模式差異化需求
| 模式 | 分析深度 | 圖表複雜度 | 預測功能 | 互動性 |
|------|-----------|------------|----------|--------|
| **精準控制者** | 專業深度 | 複雜多維 | 進階預測 | 高度互動 |
| **紀錄習慣者** | 美觀洞察 | 優雅視覺 | 趨勢展示 | 直觀互動 |
| **轉型挑戰者** | 目標導向 | 進度追蹤 | 目標預測 | 激勵互動 |
| **潛在覺醒者** | 簡易理解 | 基本圖表 | 簡單提示 | 基礎操作 |

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者已成功登入系統
- 使用者對目標預算具有檢視權限
- 使用者已建立至少一個預算項目
- 系統已累積足夠的歷史資料

### 3.2 系統狀態
- 網路連線正常
- 預算分析引擎正常運作
- 圖表渲染引擎已載入
- 資料聚合服務可用

### 3.3 資料狀態
- 預算資料完整且同步
- 交易記錄資料準確
- 分析統計資料已更新
- 歷史趨勢資料完整

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 分析頁面載入流程
```
1. 使用者進入預算分析頁面
2. 系統檢查分析權限
3. 系統載入預算清單
4. 系統執行資料聚合分析
5. 系統生成預設分析圖表
6. 顯示分析儀表板
7. 系統提供初始洞察建議
```

### 4.2 互動分析流程
```
1. 使用者選擇分析維度
   ├── 時間維度（日/週/月/季/年）
   ├── 分類維度（收支/專案/標籤）
   ├── 預算維度（單一/多預算對比）
   └── 自訂維度（自訂條件組合）
2. 系統重新計算分析資料
3. 系統更新圖表顯示
4. 系統生成相應洞察
5. 使用者可進行圖表互動
   ├── 縮放和平移
   ├── 資料點詳情查看
   ├── 圖表類型切換
   └── 數據篩選
6. 系統提供進階分析功能
7. 使用者可匯出分析報告
```

### 4.3 四模式特殊流程

#### 精準控制者模式
```
- 多維度複合分析
- 自訂指標計算
- 進階統計分析
- 預測模型配置
```

#### 紀錄習慣者模式
```
- 美觀圖表展示
- 視覺化洞察呈現
- 優雅的動畫效果
- 藝術化數據呈現
```

#### 轉型挑戰者模式
```
- 目標達成分析
- 習慣改善追蹤
- 挑戰進度顯示
- 激勵式數據展示
```

#### 潛在覺醒者模式
```
- 簡化分析報告
- 基礎圖表展示
- 重點洞察提示
- 易懂的數據說明
```

## 5. 輸入項目（Inputs）

### 5.1 分析參數設定
```typescript
interface AnalysisParameters {
  budgetIds: string[];           // 分析目標預算ID列表
  timeRange: TimeRangeConfig;    // 時間範圍配置
  dimensions: AnalysisDimension[]; // 分析維度
  chartTypes: ChartType[];       // 圖表類型偏好
  comparisonMode: ComparisonMode; // 比較模式
}

interface TimeRangeConfig {
  startDate: Date;        // 開始日期
  endDate: Date;          // 結束日期
  granularity: TimeGranularity; // 時間粒度
  includeProjections: boolean;  // 是否包含預測
}

enum TimeGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly', 
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

enum AnalysisDimension {
  TIME = 'time',           // 時間維度
  CATEGORY = 'category',   // 分類維度  
  PROJECT = 'project',     // 專案維度
  BUDGET = 'budget',       // 預算維度
  CUSTOM = 'custom'        // 自訂維度
}

enum ChartType {
  LINE = 'line',           // 折線圖
  BAR = 'bar',            // 柱狀圖  
  PIE = 'pie',            // 圓餅圖
  AREA = 'area',          // 面積圖
  SCATTER = 'scatter',    // 散點圖
  HEATMAP = 'heatmap'     // 熱力圖
}
```

### 5.2 篩選與配置
```typescript
interface AnalysisFilters {
  // 金額篩選
  amountRange: AmountRange;
  
  // 分類篩選  
  includeCategories: string[];
  excludeCategories: string[];
  
  // 標籤篩選
  includeTags: string[];
  excludeTags: string[];
  
  // 狀態篩選
  budgetStatuses: BudgetStatus[];
  
  // 自訂條件
  customConditions: CustomCondition[];
}

interface CustomCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
  logicalOperator?: LogicalOperator;
}

enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals', 
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  IN = 'in'
}
```

### 5.3 互動操作輸入
```typescript
interface ChartInteractionInput {
  // 圖表操作
  zoomLevel: number;        // 縮放等級
  panPosition: Position;    // 平移位置
  selectedDataPoints: DataPoint[]; // 選中的資料點
  
  // 篩選操作
  dateRangeSelection: DateRange;  // 日期範圍選擇
  categorySelection: string[];    // 分類選擇
  
  // 顯示配置
  showTrendLine: boolean;    // 顯示趨勢線
  showAverage: boolean;      // 顯示平均線
  showPrediction: boolean;   // 顯示預測
  
  // 比較設定
  compareWith: ComparisonTarget[]; // 比較對象
}
```

## 6. 輸出項目（Outputs / Responses）

### 6.1 分析結果資料
```typescript
interface BudgetAnalysisResponse {
  success: boolean;
  data: {
    overview: AnalysisOverview;
    chartData: ChartDataSet[];
    insights: AnalysisInsight[];
    predictions: PredictionResult[];
    recommendations: Recommendation[];
  };
  metadata: AnalysisMetadata;
}

interface AnalysisOverview {
  totalBudgets: number;
  totalAllocated: number;
  totalSpent: number;
  averageUtilization: number;
  trenDirection: TrendDirection;
  performanceScore: number;
}

interface ChartDataSet {
  chartId: string;
  chartType: ChartType;
  title: string;
  data: ChartDataPoint[];
  config: ChartConfiguration;
  insights: string[];
}

interface AnalysisInsight {
  type: InsightType;
  title: string;
  description: string;
  importance: ImportanceLevel;
  actionable: boolean;
  suggestedActions: string[];
  confidence: number;
}

enum InsightType {
  TREND = 'trend',
  ANOMALY = 'anomaly', 
  PATTERN = 'pattern',
  OPPORTUNITY = 'opportunity',
  WARNING = 'warning'
}
```

### 6.2 預測與建議
```typescript
interface PredictionResult {
  predictionId: string;
  targetDate: Date;
  predictedValue: number;
  confidenceInterval: ConfidenceInterval;
  methodology: string;
  factors: PredictionFactor[];
}

interface Recommendation {
  recommendationId: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  impact: ImpactEstimation;
  urgency: UrgencyLevel;
  actionSteps: ActionStep[];
}

enum RecommendationCategory {
  BUDGET_OPTIMIZATION = 'budget_optimization',
  SPENDING_REDUCTION = 'spending_reduction',
  ALLOCATION_ADJUSTMENT = 'allocation_adjustment',
  GOAL_SETTING = 'goal_setting'
}
```

### 6.3 四模式差異化輸出
```typescript
interface ModeSpecificOutput {
  // 精準控制者模式
  controller: {
    advancedMetrics: AdvancedMetric[];
    statisticalAnalysis: StatisticalResult[];
    customCalculations: CalculationResult[];
    dataExportOptions: ExportOption[];
  };
  
  // 紀錄習慣者模式  
  logger: {
    visualInsights: VisualInsight[];
    aestheticCharts: AestheticChart[];
    colorThemes: ColorTheme[];
    animations: AnimationConfig[];
  };
  
  // 轉型挑戰者模式
  struggler: {
    goalProgress: GoalProgressData[];
    achievementMetrics: AchievementMetric[];
    challengeStatus: ChallengeStatus[];
    motivationalInsights: MotivationalInsight[];
  };
  
  // 潛在覺醒者模式
  sleeper: {
    simplifiedSummary: SimplifiedSummary;
    basicCharts: BasicChart[];
    keyInsights: KeyInsight[];
    easyActions: EasyAction[];
  };
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 分析參數驗證
- **時間範圍**: 開始日期不能晚於結束日期
- **預算選擇**: 至少選擇一個有效預算
- **維度設定**: 分析維度不能為空
- **圖表類型**: 至少選擇一種圖表類型

### 7.2 資料完整性驗證
- **資料量檢查**: 確保有足夠資料進行分析
- **資料品質**: 驗證資料完整性和準確性
- **時間連續性**: 檢查時間序列資料連續性
- **異常值檢測**: 識別並標記異常數據點

### 7.3 四模式特殊驗證

#### 精準控制者模式
- **複雜度限制**: 同時分析的維度數量 ≤ 10
- **計算負載**: 自訂計算複雜度檢查
- **資料存取**: 驗證進階資料存取權限

#### 潛在覺醒者模式
- **簡化驗證**: 自動選擇最佳預設配置
- **錯誤容忍**: 對無效選擇自動修正
- **最小化選項**: 限制選擇項目數量

## 8. 錯誤處理（Error Handling）

### 8.1 資料載入錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 無分析資料 | "目前沒有足夠的資料進行分析" | 顯示資料收集建議 |
| 資料載入失敗 | "分析資料載入失敗" | 提供重新載入選項 |
| 權限不足 | "您沒有檢視此分析的權限" | 顯示權限申請流程 |
| 網路異常 | "網路連線異常，無法載入分析" | 提供離線模式或重試 |

### 8.2 分析計算錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 計算超時 | "分析計算時間過長" | 提供簡化分析選項 |
| 記憶體不足 | "資料量過大，無法完成分析" | 建議縮小分析範圍 |
| 參數無效 | "分析參數設定無效" | 自動修正或提示修改 |
| 演算法錯誤 | "分析演算法執行錯誤" | 使用備用分析方法 |

### 8.3 四模式特殊錯誤處理

#### 精準控制者模式
- **詳細錯誤**: 提供完整的錯誤資訊和除錯建議
- **進階選項**: 提供手動錯誤修復工具
- **日誌存取**: 允許檢視詳細的錯誤日誌

#### 潛在覺醒者模式
- **簡化錯誤**: 使用簡單易懂的錯誤說明
- **自動修復**: 盡可能自動修復錯誤
- **一鍵重設**: 提供快速重設功能

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 分析儀表板佈局
```
預算分析頁面
├── 頂部控制列
│   ├── 返回按鈕
│   ├── 頁面標題：「預算分析」
│   ├── 時間範圍選擇器
│   ├── 預算選擇器
│   └── 更多選項按鈕
├── 分析概覽卡片區
│   ├── 總體表現指標
│   ├── 關鍵洞察摘要
│   ├── 趨勢方向指示
│   └── 效能評分顯示
├── 主要圖表區域
│   ├── 圖表類型切換
│   ├── 互動式主圖表
│   ├── 圖表工具列
│   └── 圖表設定面板
├── 次要圖表網格
│   ├── 分類分析圖
│   ├── 趨勢對比圖
│   ├── 時間序列圖
│   └── 相關性分析圖
├── 洞察與建議區塊
│   ├── 智慧洞察清單
│   ├── 行動建議卡片
│   ├── 預測資訊顯示
│   └── 風險警示提醒
├── 進階分析工具
│   ├── 自訂分析設定
│   ├── 比較分析工具
│   ├── 預測模型選擇
│   └── 匯出功能選項
└── 底部操作列
    ├── 分享分析按鈕
    ├── 儲存配置按鈕
    ├── 匯出報告按鈕
    └── 設定預設值按鈕
```

### 9.2 四模式視覺差異設計

#### 精準控制者模式佈局
```css
/* 專業分析儀表板設計 */
.controller-analysis-dashboard {
  background: #F8F9FA;
  padding: 16px;
  display: grid;
  grid-template-areas: 
    "controls controls"
    "main-chart secondary-charts"
    "insights tools";
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.advanced-controls-panel {
  background: #FFFFFF;
  border: 1px solid #DEE2E6;
  border-radius: 8px;
  padding: 16px;
}

.multi-chart-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.professional-chart {
  background: #FFFFFF;
  border: 1px solid #E9ECEF;
  border-radius: 6px;
  padding: 12px;
  min-height: 300px;
}

.advanced-metrics-table {
  font-family: 'Roboto Mono', monospace;
  font-size: 13px;
  background: #F8F9FA;
  border: 1px solid #DEE2E6;
}
```

#### 紀錄習慣者模式佈局
```css
/* 美觀優雅分析設計 */
.logger-analysis-dashboard {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  min-height: 100vh;
}

.elegant-overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.aesthetic-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.aesthetic-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.beautiful-chart-container {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.insight-bubble {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #FFFFFF;
  border-radius: 25px;
  padding: 16px 20px;
  margin: 8px;
  display: inline-block;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}
```

#### 轉型挑戰者模式佈局  
```css
/* 激勵目標導向設計 */
.struggler-analysis-dashboard {
  background: linear-gradient(135deg, #ff6b6b, #feca57);
  padding: 20px;
}

.challenge-progress-header {
  background: #FFFFFF;
  border-radius: 15px;
  padding: 24px;
  margin-bottom: 20px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(255, 107, 107, 0.2);
}

.goal-achievement-chart {
  background: #FFFFFF;
  border: 3px solid #ff6b6b;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  position: relative;
}

.achievement-badge-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 16px 0;
}

.achievement-badge {
  background: linear-gradient(135deg, #ff6b6b, #feca57);
  color: #FFFFFF;
  border-radius: 25px;
  padding: 10px 16px;
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
}

.motivational-insight-card {
  background: #FFFFFF;
  border-left: 5px solid #ff6b6b;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
```

#### 潛在覺醒者模式佈局
```css
/* 極簡易懂設計 */
.sleeper-analysis-dashboard {
  background: #F0F8F0;
  padding: 24px;
}

.simple-summary-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 32px;
  text-align: center;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(76, 175, 80, 0.1);
}

.big-number-display {
  font-size: 48px;
  font-weight: 700;
  color: #4CAF50;
  margin: 16px 0;
}

.simple-chart-container {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  text-align: center;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
}

.easy-insight-list {
  list-style: none;
  padding: 0;
}

.easy-insight-item {
  background: #E8F5E8;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 12px;
  font-size: 16px;
  line-height: 1.5;
  border-left: 4px solid #4CAF50;
}

.big-action-button {
  width: 100%;
  height: 64px;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.primary-action {
  background: linear-gradient(135deg, #4CAF50, #81C784);
  color: #FFFFFF;
}

.secondary-action {
  background: #FFFFFF;
  color: #4CAF50;
  border: 2px solid #4CAF50;
}
```

### 9.3 圖表元件規格

#### 互動式折線圖
```css
.interactive-line-chart {
  width: 100%;
  height: 400px;
  background: #FFFFFF;
  border-radius: 8px;
  position: relative;
}

.chart-tooltip {
  background: rgba(0, 0, 0, 0.8);
  color: #FFFFFF;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  position: absolute;
  pointer-events: none;
  z-index: 1000;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666666;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
```

#### 圓餅圖容器
```css
.pie-chart-container {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
}

.pie-chart-svg {
  width: 300px;
  height: 300px;
}

.pie-slice {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.pie-slice:hover {
  transform: scale(1.05);
}

.pie-chart-labels {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pie-label-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 14px;
}

.pie-label-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.pie-label-percentage {
  margin-left: auto;
  font-weight: 600;
  color: #333333;
}
```

## 10. API 規格（API Specification）

### 10.1 取得預算分析資料 API
```typescript
// GET /api/v1/budgets/analysis
interface GetBudgetAnalysisRequest {
  budgetIds: string[];
  timeRange: TimeRangeConfig;
  dimensions: AnalysisDimension[];
  granularity: TimeGranularity;
  includeInsights?: boolean;
  includePredictions?: boolean;
  userMode: UserMode;
}

interface GetBudgetAnalysisResponse {
  analysisId: string;
  data: BudgetAnalysisData;
  insights: AnalysisInsight[];
  predictions: PredictionResult[];
  metadata: AnalysisMetadata;
}
```

### 10.2 產生分析洞察 API (F017 v2.0.0)
```typescript
// POST /api/v1/budgets/analysis/insights
interface GenerateInsightsRequest {
  analysisId: string;
  focusAreas: InsightFocusArea[];
  userMode: UserMode;
  customParameters?: CustomInsightParameter[];
}

interface GenerateInsightsResponse {
  insights: GeneratedInsight[];
  recommendations: SmartRecommendation[];
  confidence: ConfidenceScore;
  generatedAt: Date;
}
```

### 10.3 匯出分析報告 API
```typescript
// POST /api/v1/budgets/analysis/export
interface ExportAnalysisRequest {
  analysisId: string;
  exportFormat: ExportFormat;
  includeCharts: boolean;
  includeRawData: boolean;
  customTemplate?: string;
}

interface ExportAnalysisResponse {
  exportId: string;
  downloadUrl: string;
  fileSize: number;
  expiresAt: Date;
}

enum ExportFormat {
  PDF = 'pdf',
  HTML = 'html',
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json'
}
```

### 10.4 儲存分析配置 API
```typescript
// POST /api/v1/budgets/analysis/save-configuration
interface SaveAnalysisConfigRequest {
  configName: string;
  description?: string;
  parameters: AnalysisParameters;
  isDefault: boolean;
  shareWithTeam?: boolean;
}

interface SaveAnalysisConfigResponse {
  configId: string;
  configName: string;
  savedAt: Date;
  isActive: boolean;
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 分析頁面狀態
```typescript
interface AnalysisPageState {
  // 載入狀態
  isLoadingData: boolean;
  isCalculatingAnalysis: boolean;
  isGeneratingInsights: boolean;
  isExporting: boolean;
  
  // 資料狀態
  analysisData: BudgetAnalysisData;
  chartConfigurations: ChartConfiguration[];
  activeInsights: AnalysisInsight[];
  
  // UI狀態
  selectedTimeRange: TimeRangeConfig;
  selectedBudgets: string[];
  activeDimensions: AnalysisDimension[];
  currentChartType: ChartType;
  
  // 互動狀態
  selectedDataPoints: DataPoint[];
  zoomLevel: number;
  filterState: AnalysisFilters;
  comparisonMode: ComparisonMode;
  
  // 四模式狀態
  userMode: UserMode;
  modeSpecificConfig: ModeSpecificConfig;
}
```

### 11.2 圖表互動狀態
```typescript
interface ChartInteractionState {
  // 選擇狀態
  selectedSeries: string[];
  selectedDataRange: DateRange;
  highlightedCategories: string[];
  
  // 視圖狀態
  zoomExtent: ZoomExtent;
  panOffset: PanOffset;
  viewportBounds: ViewportBounds;
  
  // 工具狀態
  activeTools: ChartTool[];
  measurementMode: boolean;
  annotationMode: boolean;
  
  // 比較狀態
  baselineSeries: string;
  comparisonSeries: string[];
  overlayMode: OverlayMode;
}
```

### 11.3 狀態轉換規則
- **資料載入**: 自動載入預設分析配置
- **參數變更**: 即時重新計算分析結果
- **圖表切換**: 保持選擇狀態和篩選條件
- **模式切換**: 保留相容配置並調整UI

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 資料存取權限
- **預算檢視**: 需要預算檢視權限
- **詳細分析**: 需要預算分析權限  
- **敏感指標**: 需要財務管理權限
- **匯出功能**: 需要資料匯出權限

### 12.2 資料安全機制
- **資料脫敏**: 敏感財務資料適當脫敏
- **存取日誌**: 記錄所有分析存取行為
- **資料隔離**: 確保跨使用者資料隔離
- **快取安全**: 分析結果安全快取處理

### 12.3 分析結果保護
- **結果加密**: 敏感分析結果加密儲存
- **時效控制**: 分析結果設定有效期限
- **分享權限**: 嚴格控制分析結果分享
- **匯出追蹤**: 追蹤所有資料匯出行為

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **分析計算**: 基本分析計算時間 < 3秒
- **圖表渲染**: 圖表初始載入時間 < 2秒
- **互動響應**: 圖表互動響應時間 < 200ms
- **大資料處理**: 支援最多100萬筆交易記錄分析

### 13.2 可用性需求
- **直觀操作**: 分析操作3步驟內完成
- **智慧建議**: 提供個人化分析建議
- **響應式設計**: 支援各種螢幕尺寸
- **離線能力**: 支援基本的離線分析功能

### 13.3 擴展性需求
- **自訂指標**: 支援使用者自訂分析指標
- **插件架構**: 支援第三方分析插件
- **API開放**: 提供分析結果API介面
- **多語言**: 支援分析結果多語言顯示

### 13.4 四模式特殊需求

#### 精準控制者模式
- **進階統計**: 提供完整的統計分析功能
- **自訂公式**: 支援自訂計算公式
- **資料匯出**: 支援多種格式資料匯出
- **API整合**: 支援外部工具整合

#### 紀錄習慣者模式
- **美觀體驗**: 優雅的視覺設計和動畫
- **個性化**: 支援個人化主題和配色
- **社交功能**: 支援分析結果社交分享
- **範本庫**: 提供美觀的分析範本

#### 轉型挑戰者模式
- **目標追蹤**: 整合財務目標追蹤功能
- **成就系統**: 分析達成觸發成就解鎖
- **激勵機制**: 提供正向激勵和挑戰
- **習慣分析**: 專注財務習慣改善分析

#### 潛在覺醒者模式
- **簡化介面**: 隱藏複雜的分析選項
- **智慧預設**: 自動選擇最佳分析配置
- **易懂洞察**: 使用簡單語言的分析結果
- **引導教學**: 提供分析功能引導教學

### 13.5 國際化與本地化
- **多語言支援**: 介面和分析結果多語言
- **地區格式**: 支援不同地區的數字和日期格式
- **貨幣顯示**: 支援多種貨幣顯示格式
- **文化適應**: 根據文化背景調整分析展示

---

**版本記錄**
- v1.0.0 (2025-01-26): 初始版本建立，包含完整的預算分析頁面SRS規格，支援四模式差異化設計和BudgetService v1.1.0、F017 API v2.0.0整合，提供全方位的預算分析功能
