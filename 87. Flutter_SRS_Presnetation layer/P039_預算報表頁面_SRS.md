
# P039 預算報表頁面 SRS

## 文件資訊
- **文件版次**: v1.0.0
- **建立日期**: 2025-01-19
- **最後更新**: 2025-01-19
- **負責模組**: BudgetService v1.1.0
- **對應API**: F022 報表整合API v2.0.0

## 版次記錄
| 版次 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-01-19 | 初始版本建立，完整預算報表功能規格 | SA團隊 |

## 目次
1. [功能目的](#1-功能目的purpose)
2. [使用者故事](#2-使用者故事user-story)
3. [前置條件](#3-前置條件preconditions)
4. [功能流程](#4-功能流程user-flow--functional-flow)
5. [輸入項目](#5-輸入項目inputs)
6. [輸出項目](#6-輸出項目outputs--responses)
7. [驗證規則](#7-驗證規則validation-rules)
8. [錯誤處理](#8-錯誤處理error-handling)
9. [UI元件與排版需求](#9-ui元件與排版需求ui-requirements)
10. [API規格](#10-api規格如有api-specification)
11. [狀態與畫面切換](#11-狀態與畫面切換state-handling)
12. [安全性與權限檢查](#12-安全性與權限檢查security--access-control)
13. [其他補充需求](#13-其他補充需求others)

---

## 1. 功能目的（Purpose）
提供綜合性的預算報表生成和展示功能，整合預算執行分析、財務健康度評估、趨勢預測等多維度報表，協助使用者全面了解預算績效並制定更有效的理財策略。

---

## 2. 使用者故事（User Story）
- 作為財務分析師，我希望能生成詳細的預算執行報表，全面分析預算績效和財務狀況
- 作為企業主管，我希望能看到預算達成率和趨勢分析，評估部門或專案的預算表現
- 作為個人理財者，我希望能獲得易懂的預算總結報告，了解自己的消費模式和改善建議
- 作為會計人員，我希望能匯出標準格式的預算報表，滿足財務審計和合規要求
- 作為決策者，我希望能看到預算預測和風險分析，制定未來的預算策略

---

## 3. 前置條件（Preconditions）
- 使用者已登入系統且擁有有效授權
- 使用者具有預算檢視和報表生成權限
- 系統中存在足夠的預算執行歷史資料
- 報表模板和計算引擎正常運作
- 相關的預算和記帳資料完整且可存取

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 報表生成流程
1. **選擇報表類型** → 執行報表/比較報表/趨勢報表/預測報表
2. **設定報表參數** → 時間範圍、帳本範圍、分類篩選、比較基準
3. **配置報表格式** → 圖表類型、詳細程度、輸出格式
4. **執行報表生成** → 資料計算、圖表繪製、報表組裝
5. **檢視報表結果** → 線上檢視、互動分析、關鍵指標解讀

### 4.2 報表分析流程
1. **檢視概覽儀表板** → 關鍵指標概覽、異常警示、趨勢摘要
2. **深入專項分析** → 點擊圖表元素進行鑽取分析
3. **比較分析檢視** → 不同時期、帳本、分類的比較
4. **洞察建議檢視** → AI分析建議、改善方案、風險提醒
5. **自訂分析維度** → 調整分析角度、新增比較指標

### 4.3 報表輸出流程
1. **選擇輸出格式** → PDF/Excel/PowerPoint/圖片格式
2. **自訂輸出內容** → 選擇包含的章節和圖表
3. **設定分享權限** → 內部分享/外部分享/密碼保護
4. **生成並下載** → 報表打包、格式轉換、下載連結
5. **分享和協作** → 郵件分享、協作註解、版本管理

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 報表類型 | Enum | 必選 | 報表類型選擇器 | 執行/比較/趨勢/預測報表 |
| 時間範圍 | DateRange | 不超過3年 | 日期範圍選擇器 | 分析時間區間 |
| 帳本範圍 | Array | 至少選擇1個 | 多選列表 | 分析的帳本範圍 |
| 預算範圍 | Array | 可選 | 預算篩選器 | 特定預算項目 |
| 分類篩選 | Array | 可選 | 分類選擇器 | 支出收入分類 |
| 比較基準 | Object | 依報表類型 | 比較設定面板 | 同期比較/目標比較 |
| 詳細程度 | Enum | 必選 | 詳細度選擇器 | 概要/標準/詳細 |
| 圖表偏好 | Array | 可選 | 圖表類型選擇 | 偏好的圖表類型 |
| 輸出格式 | Enum | 必選 | 格式選擇器 | PDF/Excel/PPT等 |
| 自訂標題 | String | 最多100字元 | 文字輸入框 | 報表自訂標題 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 報表資料結構
```typescript
interface BudgetReportData {
  reportId: string;
  reportType: ReportType;
  generatedAt: Date;
  timeRange: DateRange;
  summary: ReportSummary;
  sections: ReportSection[];
  appendices: ReportAppendix[];
  metadata: ReportMetadata;
}

interface ReportSummary {
  totalBudgets: number;
  totalPlanned: number;
  totalActual: number;
  overallVariance: number;
  variancePercentage: number;
  keyFindings: string[];
  riskAlerts: RiskAlert[];
  recommendations: Recommendation[];
}

interface ReportSection {
  sectionType: 'overview' | 'execution' | 'variance' | 'trends' | 'forecast';
  title: string;
  data: any;
  charts: ChartData[];
  tables: TableData[];
  insights: SectionInsight[];
}
```

### 6.2 圖表資料結構
```typescript
interface ChartData {
  chartId: string;
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'gauge';
  title: string;
  data: ChartDataSet;
  options: ChartOptions;
  insights: ChartInsight[];
}

interface ChartDataSet {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    metadata: any;
  }[];
}
```

### 6.3 分析洞察結構
```typescript
interface AnalysisInsight {
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  actionItems: ActionItem[];
  relatedData: any;
}

interface ActionItem {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
  timeline: string;
  resources: string[];
}
```

---

## 7. 驗證規則（Validation Rules）

### 7.1 報表參數驗證
- **時間範圍**: 結束日期不可早於開始日期，範圍不超過3年
- **帳本權限**: 使用者必須對所選帳本有檢視權限
- **資料完整性**: 選定範圍內必須有足夠的資料進行分析
- **比較基準**: 比較對象必須有可比較的時間範圍

### 7.2 資料品質驗證
- **資料一致性**: 檢查預算和實際支出資料的一致性
- **異常值檢測**: 識別和標記異常的財務資料
- **完整度檢查**: 確保關鍵時期的資料完整
- **精確度驗證**: 計算結果的精確度檢查

### 7.3 輸出格式驗證
- **格式相容性**: 確保輸出格式支援所選的圖表類型
- **檔案大小**: 控制輸出檔案大小在合理範圍內
- **內容完整性**: 確保所有必要內容都包含在輸出中

---

## 8. 錯誤處理（Error Handling）

### 8.1 資料不足錯誤
- **顯示訊息**: "所選時間範圍的資料不足以生成報表，建議擴大時間範圍"
- **處理方式**: 提供建議的時間範圍選項
- **UI反應**: 顯示資料覆蓋率指示器

### 8.2 計算超時錯誤
- **顯示訊息**: "報表計算時間過長，請縮小分析範圍或稍後再試"
- **處理方式**: 提供分段生成選項
- **UI反應**: 顯示計算進度條

### 8.3 格式轉換錯誤
- **顯示訊息**: "報表輸出格式轉換失敗，請嘗試其他格式"
- **處理方式**: 提供替代輸出格式
- **UI反應**: 建議最佳支援格式

---

## 9. UI元件與排版需求（UI Requirements）

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 報表配置面板 | ConfigPanel | 設定報表參數 | 步驟式設定，即時預覽 |
| 儀表板概覽 | Dashboard | 關鍵指標展示 | 可拖拽排版，自訂佈局 |
| 互動式圖表 | InteractiveChart | 資料視覺化 | 縮放、鑽取、篩選功能 |
| 資料表格 | DataTable | 詳細資料展示 | 排序、篩選、匯出功能 |
| 洞察卡片 | InsightCard | 分析建議展示 | 可展開詳情，標記重要度 |
| 輸出控制器 | ExportController | 報表輸出管理 | 格式選擇，自訂內容 |
| 分享面板 | SharePanel | 報表分享功能 | 權限設定，連結生成 |

### 9.1 響應式佈局設計
```css
.report-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}

.report-header {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(15px);
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border-radius: 0 0 20px 20px;
}

.report-content {
  flex: 1;
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 1024px) {
  .report-content {
    grid-template-columns: 300px 1fr;
  }
  
  .report-main {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
  }
}
```

### 9.2 報表卡片設計
```css
.report-card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.report-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, #4CAF50, #2196F3, #FF9800, #E91E63);
}

.report-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #F5F5F5;
}

.report-title {
  font-size: 20px;
  font-weight: 700;
  color: #212121;
  display: flex;
  align-items: center;
  gap: 12px;
}

.report-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
}

.report-actions {
  display: flex;
  gap: 8px;
}

.report-action-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: #F5F5F5;
  color: #666666;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.report-action-btn:hover {
  background: #E0E0E0;
  transform: translateY(-1px);
}

.report-action-btn.primary {
  background: #1976D2;
  color: #FFFFFF;
}

.report-action-btn.primary:hover {
  background: #1565C0;
}
```

### 9.3 圖表容器設計
```css
.chart-container {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  position: relative;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #E0E0E0;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
}

.chart-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chart-body {
  min-height: 300px;
  position: relative;
}

.chart-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.chart-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #E0E0E0;
  border-top: 4px solid #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.chart-insights {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #E0E0E0;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #F8F9FA;
}

.insight-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #FFFFFF;
  flex-shrink: 0;
}

.insight-icon.positive {
  background: #4CAF50;
}

.insight-icon.negative {
  background: #F44336;
}

.insight-icon.warning {
  background: #FF9800;
}

.insight-content {
  flex: 1;
}

.insight-title {
  font-weight: 600;
  color: #333333;
  margin-bottom: 4px;
}

.insight-description {
  font-size: 14px;
  color: #666666;
  line-height: 1.4;
}
```

---

## 10. API 規格（如有）（API Specification）

### 10.1 生成報表

#### Request
- **URL**: `/api/budget-reports/generate`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {token}`
- **Body**:
```json
{
  "reportType": "execution|comparison|trend|forecast",
  "parameters": {
    "timeRange": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-31"
    },
    "ledgerIds": ["ledger_123", "ledger_456"],
    "budgetIds": ["budget_789"],
    "categoryFilters": ["食物", "交通"],
    "comparisonBaseline": {
      "type": "previous_period|target|custom",
      "customPeriod": {
        "startDate": "2024-01-01",
        "endDate": "2024-01-31"
      }
    },
    "detailLevel": "summary|standard|detailed",
    "chartPreferences": ["line", "bar", "pie"],
    "customTitle": "2025年1月預算執行報表"
  },
  "outputFormat": "pdf|excel|powerpoint|json",
  "includeInsights": true,
  "includeRecommendations": true
}
```

#### Response - 成功
```json
{
  "success": true,
  "data": {
    "reportId": "report_123456",
    "status": "completed",
    "reportData": {
      "summary": {
        "totalBudgets": 5,
        "totalPlanned": 50000,
        "totalActual": 48500,
        "overallVariance": -1500,
        "variancePercentage": -3.0,
        "performanceRating": "excellent"
      },
      "sections": [
        {
          "sectionType": "overview",
          "title": "執行概覽",
          "data": {
            "budgetUtilization": 97.0,
            "categoriesOnTrack": 4,
            "categoriesOverBudget": 1,
            "savingsAchieved": 1500
          },
          "charts": [
            {
              "chartType": "gauge",
              "title": "整體預算達成率",
              "data": {
                "value": 97.0,
                "target": 100.0,
                "color": "#4CAF50"
              }
            }
          ]
        }
      ],
      "insights": [
        {
          "type": "positive",
          "title": "預算控制表現優異",
          "description": "整體支出控制在預算範圍內，節省了3%的預算",
          "impact": "medium",
          "recommendation": "可考慮將節省的預算分配到投資或緊急備用金"
        }
      ]
    },
    "downloadUrl": "https://api.example.com/files/report_123456.pdf",
    "expiresAt": "2025-01-20T10:00:00Z"
  }
}
```

### 10.2 取得報表清單

#### Request
- **URL**: `/api/budget-reports`
- **Method**: `GET`
- **Query Parameters**: `page=1&limit=20&reportType=execution&startDate=2025-01-01`

#### Response - 成功
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "reportId": "report_123456",
        "title": "2025年1月預算執行報表",
        "reportType": "execution",
        "status": "completed",
        "createdAt": "2025-01-02T10:00:00Z",
        "timeRange": {
          "startDate": "2025-01-01",
          "endDate": "2025-01-31"
        },
        "summary": {
          "totalPlanned": 50000,
          "totalActual": 48500,
          "variancePercentage": -3.0
        },
        "downloadUrl": "https://api.example.com/files/report_123456.pdf"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 25
    }
  }
}
```

### 10.3 取得報表詳情

#### Request
- **URL**: `/api/budget-reports/{reportId}`
- **Method**: `GET`

#### Response - 成功
```json
{
  "success": true,
  "data": {
    "reportId": "report_123456",
    "title": "2025年1月預算執行報表",
    "reportType": "execution",
    "status": "completed",
    "createdAt": "2025-01-02T10:00:00Z",
    "parameters": {
      "timeRange": {
        "startDate": "2025-01-01",
        "endDate": "2025-01-31"
      },
      "ledgerIds": ["ledger_123"],
      "detailLevel": "standard"
    },
    "reportData": {
      "sections": [...],
      "insights": [...],
      "recommendations": [...]
    },
    "downloadUrl": "https://api.example.com/files/report_123456.pdf",
    "shareUrl": "https://reports.example.com/share/abc123"
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 報表生成狀態
```typescript
enum ReportGenerationState {
  CONFIGURING = 'configuring',     // 設定參數
  VALIDATING = 'validating',       // 驗證參數
  PROCESSING = 'processing',       // 處理資料
  ANALYZING = 'analyzing',         // 分析資料
  RENDERING = 'rendering',         // 渲染報表
  COMPLETED = 'completed',         // 完成
  FAILED = 'failed'               // 失敗
}
```

### 11.2 頁面狀態管理
```typescript
enum ReportPageState {
  DASHBOARD = 'dashboard',         // 儀表板檢視
  CONFIGURATION = 'configuration', // 配置報表
  GENERATION = 'generation',       // 生成中
  VIEWING = 'viewing',            // 檢視報表
  COMPARISON = 'comparison',       // 比較分析
  SHARING = 'sharing'             // 分享設定
}
```

### 11.3 載入狀態處理
```css
.report-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 20px;
}

.loading-progress {
  width: 300px;
  height: 6px;
  background: #E0E0E0;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.loading-progress::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #1976D2, #42A5F5);
  border-radius: 3px;
  animation: loading-slide 2s ease-in-out infinite;
}

@keyframes loading-slide {
  0% { left: -100%; }
  50% { left: 0%; }
  100% { left: 100%; }
}

.loading-text {
  font-size: 16px;
  color: #666666;
  text-align: center;
}

.loading-steps {
  display: flex;
  justify-content: space-between;
  width: 300px;
  margin-top: 10px;
}

.loading-step {
  font-size: 12px;
  color: #BDBDBD;
  position: relative;
}

.loading-step.active {
  color: #1976D2;
}

.loading-step.completed {
  color: #4CAF50;
}
```

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 報表資料存取權限
- **帳本權限**: 僅能生成有檢視權限的帳本報表
- **預算權限**: 預算資料需要對應的預算檢視權限
- **敏感資料**: 根據權限等級決定資料詳細程度

### 12.2 報表分享安全
- **分享連結**: 生成具有時效性的安全分享連結
- **權限控制**: 分享對象權限驗證和存取記錄
- **資料脫敏**: 對外分享時自動進行敏感資料脫敏

### 12.3 檔案安全
- **下載權限**: 驗證下載者身份和權限
- **檔案加密**: 敏感報表檔案進行加密處理
- **存取紀錄**: 完整記錄報表存取和下載日誌

---

## 13. 其他補充需求（Others）

### 13.1 國際化多語言需求
- **報表語言**: 支援繁體中文、簡體中文、英文、日文
- **數字格式**: 依據語言設定調整貨幣和數字格式
- **圖表本地化**: 圖表標籤和說明文字本地化

### 13.2 無障礙設計考量
- **螢幕閱讀器**: 圖表提供完整的替代文字描述
- **鍵盤導航**: 支援完整的鍵盤操作流程
- **高對比**: 確保圖表在高對比模式下可讀
- **字體縮放**: 適應系統字體大小設定

### 13.3 效能最佳化
- **分段載入**: 大型報表採用分段載入策略
- **快取機制**: 報表結果暫存12小時
- **並行處理**: 多個圖表並行生成提升效率
- **壓縮優化**: 輸出檔案自動壓縮減少大小

### 13.4 四模式差異化設計

#### 精準控制者模式
- 提供最完整的報表功能和自訂選項
- 支援複雜的多維度分析和比較
- 完整的API存取和資料匯出功能

#### 紀錄習慣者模式
- 強調視覺化的美觀報表設計
- 提供預設的報表模板選擇
- 簡化的分享和展示功能

#### 轉型挑戰者模式
- 聚焦於目標達成和進步追蹤報表
- 提供激勵性的視覺化元素
- 整合習慣養成和挑戰進度

#### 潛在覺醒者模式
- 僅提供基本的預算總結報表
- 超大字體和簡化的圖表設計
- 重點突出關鍵數字和建議
