
# P037 預算比較頁面 SRS

## 文件資訊
- **文件版次**: v1.0.0
- **建立日期**: 2025-01-19
- **最後更新**: 2025-01-19
- **負責模組**: BudgetService v1.1.0
- **對應API**: F017 預算比較API v2.0.0

## 版次記錄
| 版次 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-01-19 | 初始版本建立，完整預算比較功能規格 | SA團隊 |

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
提供多維度預算比較分析功能，讓使用者能夠比較不同預算項目、時間段、帳本之間的執行狀況，協助制定更有效的預算策略和財務決策。

---

## 2. 使用者故事（User Story）
- 作為理財規劃者，我希望比較不同月份的預算執行情況，了解支出模式的變化趨勢
- 作為家庭管理者，我希望比較家庭成員各自的預算使用狀況，優化資源分配
- 作為預算控制者，我希望比較預設預算與實際支出的差異，調整未來預算設定
- 作為分析決策者，我希望比較不同分類的預算效率，找出改善空間
- 作為多帳本使用者，我希望比較個人與專案帳本的預算表現，平衡資源投入

---

## 3. 前置條件（Preconditions）
- 使用者已登入系統且擁有有效授權
- 系統中至少存在2個或以上可比較的預算項目
- 使用者具有預算檢視權限
- 比較對象的預算資料完整且可存取
- 系統預算計算引擎正常運作

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要比較流程
1. **進入比較頁面** → 載入可比較的預算清單
2. **選擇比較維度** → 時間比較/項目比較/帳本比較/成員比較
3. **設定比較參數** → 選擇比較對象、時間範圍、比較指標
4. **執行比較分析** → 系統計算比較數據並產生圖表
5. **檢視比較結果** → 查看圖表、表格、差異分析
6. **匯出比較報告** → 生成PDF或Excel格式報告

### 4.2 進階分析流程
1. **深度鑽取分析** → 點擊圖表元素查看詳細資料
2. **調整比較範圍** → 修改時間軸、新增/移除比較對象
3. **套用篩選條件** → 依分類、金額範圍、狀態篩選
4. **儲存比較設定** → 將常用比較組合存為範本

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 比較維度 | Enum | 必選：時間/項目/帳本/成員 | 分頁選擇器 | 決定比較類型 |
| 比較對象A | Object | 至少選擇1個 | 下拉式選單 | 主要比較基準 |
| 比較對象B | Object | 至少選擇1個 | 多選列表 | 可選擇多個對象 |
| 時間範圍 | DateRange | 不超過2年 | 日期選擇器 | 起始與結束日期 |
| 比較指標 | Array | 至少選擇1個 | 複選框群組 | 支出金額/進度/達成率等 |
| 圖表類型 | Enum | 預設長條圖 | 圖表選擇器 | 長條圖/折線圖/圓餅圖 |
| 分組方式 | Enum | 可選 | 下拉選單 | 月份/分類/帳本分組 |
| 篩選條件 | Object | 可選 | 進階篩選面板 | 金額範圍/狀態/標籤 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 比較分析結果
```typescript
interface ComparisonResult {
  summary: {
    totalComparisons: number;
    significantDifferences: number;
    bestPerformer: string;
    worstPerformer: string;
  };
  chartData: ChartDataSet[];
  tableData: ComparisonTableRow[];
  insights: AnalysisInsight[];
  recommendations: Recommendation[];
}
```

### 6.2 圖表資料集
```typescript
interface ChartDataSet {
  chartType: 'bar' | 'line' | 'pie' | 'radar';
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
  }[];
  options: ChartOptions;
}
```

### 6.3 差異分析報告
```typescript
interface DifferenceAnalysis {
  absoluteDifference: number;
  percentageDifference: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  significance: 'high' | 'medium' | 'low';
  factors: string[];
}
```

---

## 7. 驗證規則（Validation Rules）

### 7.1 比較對象驗證
- **數量限制**: 至少2個，最多8個比較對象
- **時間一致性**: 比較對象的時間範圍必須有重疊
- **權限檢查**: 使用者必須對所有比較對象有檢視權限
- **資料完整性**: 比較對象必須有足夠的歷史資料

### 7.2 時間範圍驗證
- **合理範圍**: 開始日期不可晚於結束日期
- **資料可用性**: 選定範圍內必須有可比較的資料
- **系統限制**: 單次比較範圍不超過24個月
- **精度要求**: 日期精確到天級別

### 7.3 比較指標驗證
- **指標相容性**: 所選指標必須適用於所有比較對象
- **計算可行性**: 確保所選指標有足夠資料進行計算
- **組合邏輯**: 檢查指標組合的合理性

---

## 8. 錯誤處理（Error Handling）

### 8.1 資料不足錯誤
- **顯示訊息**: "所選比較對象的資料不足，請選擇其他時間範圍或對象"
- **處理方式**: 提供建議的替代方案
- **UI反應**: 禁用比較按鈕，顯示警告圖示

### 8.2 權限不足錯誤
- **顯示訊息**: "您沒有權限檢視部分比較對象的資料"
- **處理方式**: 移除無權限的對象，繼續比較
- **UI反應**: 灰色顯示無權限項目

### 8.3 系統計算錯誤
- **顯示訊息**: "比較分析計算失敗，請稍後再試"
- **處理方式**: 提供重試選項，記錄錯誤日誌
- **UI反應**: 顯示錯誤狀態頁面

---

## 9. UI元件與排版需求（UI Requirements）

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 比較維度選擇器 | TabBar | 切換比較類型 | 點擊切換，有視覺回饋 |
| 對象選擇面板 | MultiSelect | 選擇比較對象 | 支援搜尋、多選、拖拽排序 |
| 參數設定區域 | Form | 設定比較參數 | 即時驗證、自動儲存草稿 |
| 比較結果圖表 | InteractiveChart | 顯示比較結果 | 可縮放、點擊鑽取、切換圖表類型 |
| 數據表格 | DataTable | 詳細數據展示 | 排序、篩選、匯出功能 |
| 洞察建議區塊 | InfoCard | 顯示分析洞察 | 可展開/收合，支援分享 |
| 動作按鈕群組 | ActionBar | 執行操作 | 匯出、儲存、分享、重置 |

### 9.1 響應式佈局設計
```css
.comparison-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.comparison-header {
  background: #FFFFFF;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 0 0 16px 16px;
}

.comparison-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

@media (min-width: 768px) {
  .comparison-content {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 16px;
  }
}
```

### 9.2 圖表容器規格
```css
.chart-container {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-height: 400px;
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
  font-size: 18px;
  font-weight: 600;
  color: #212121;
}

.chart-controls {
  display: flex;
  gap: 8px;
}
```

---

## 10. API 規格（如有）（API Specification）

### 10.1 比較資料請求

#### Request
- **URL**: `/api/budgets/compare`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer {token}`
- **Body**:
```json
{
  "comparisonType": "time|item|ledger|member",
  "targets": [
    {
      "id": "budget_id_1",
      "type": "budget|ledger|user",
      "timeRange": {
        "start": "2025-01-01",
        "end": "2025-01-31"
      }
    }
  ],
  "metrics": ["amount", "progress", "efficiency"],
  "groupBy": "month|category|ledger",
  "chartType": "bar|line|pie"
}
```

#### Response - 成功
```json
{
  "success": true,
  "data": {
    "comparisonId": "comp_123456",
    "summary": {
      "totalComparisons": 4,
      "significantDifferences": 2,
      "bestPerformer": "預算A",
      "worstPerformer": "預算D"
    },
    "chartData": {
      "labels": ["1月", "2月", "3月"],
      "datasets": [
        {
          "label": "預算A",
          "data": [1000, 1200, 900],
          "backgroundColor": "#1976D2"
        }
      ]
    },
    "insights": [
      {
        "type": "trend",
        "message": "預算A在第3個月出現明顯下降",
        "severity": "medium"
      }
    ]
  }
}
```

### 10.2 匯出比較報告

#### Request
- **URL**: `/api/budgets/compare/{comparisonId}/export`
- **Method**: `GET`
- **Query Parameters**: `format=pdf|excel&language=zh-TW`

#### Response
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://api.example.com/files/comparison_report_123.pdf",
    "expiresAt": "2025-01-20T10:00:00Z",
    "fileSize": 2048576
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
enum ComparisonPageState {
  INITIAL = 'initial',           // 初始狀態
  SELECTING = 'selecting',       // 選擇比較對象
  CONFIGURING = 'configuring',   // 設定比較參數
  ANALYZING = 'analyzing',       // 執行分析中
  COMPLETED = 'completed',       // 分析完成
  ERROR = 'error'               // 錯誤狀態
}
```

### 11.2 狀態轉換邏輯
- **INITIAL → SELECTING**: 使用者開始選擇比較維度
- **SELECTING → CONFIGURING**: 完成比較對象選擇
- **CONFIGURING → ANALYZING**: 執行比較分析
- **ANALYZING → COMPLETED**: 分析成功完成
- **任何狀態 → ERROR**: 發生錯誤時

### 11.3 載入狀態處理
```css
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #E0E0E0;
  border-top: 4px solid #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 資料存取權限
- **預算資料權限**: 僅能比較使用者有權限檢視的預算
- **跨帳本比較**: 需要對應帳本的成員權限
- **敏感資料遮蔽**: 無完整權限時僅顯示相對數據

### 12.2 API安全機制
- **Token驗證**: 所有API請求需要有效的Bearer Token
- **權限範圍檢查**: 驗證使用者對比較對象的存取權限
- **資料過濾**: 後端自動過濾使用者無權限的資料

### 12.3 隱私保護
- **資料脫敏**: 在無完整權限時顯示百分比而非絕對金額
- **存取記錄**: 記錄所有比較操作的審計日誌
- **暫存清理**: 定期清理暫存的比較結果

---

## 13. 其他補充需求（Others）

### 13.1 國際化多語言需求
- **支援語言**: 繁體中文、簡體中文、英文、日文
- **動態切換**: 即時語言切換不影響比較結果
- **圖表本地化**: 圖表標籤、數字格式依語言設定調整

### 13.2 無障礙設計考量
- **鍵盤導航**: 支援Tab鍵順序導航所有互動元素
- **螢幕閱讀器**: 圖表提供文字描述替代
- **顏色對比**: 確保圖表顏色符合WCAG 2.1 AA標準
- **字體大小**: 支援系統字體縮放設定

### 13.3 效能最佳化
- **分頁載入**: 大量比較資料採用分頁載入
- **快取策略**: 常用比較結果暫存30分鐘
- **懶載入**: 圖表元件延遲載入減少初始載入時間

### 13.4 四模式差異化設計

#### 精準控制者模式
- 提供所有比較維度和進階篩選功能
- 支援複雜的多重比較和客製化指標
- 完整的匯出和分析功能

#### 紀錄習慣者模式
- 簡化為基本的時間和分類比較
- 強調視覺化圖表的美觀性
- 提供預設的比較範本

#### 轉型挑戰者模式
- 聚焦於目標達成率的比較
- 提供激勵性的進度比較視覺化
- 整合習慣養成的比較指標

#### 潛在覺醒者模式
- 僅提供最基本的月份比較功能
- 超大按鈕和簡化的操作流程
- 重點突出差異最大的項目
