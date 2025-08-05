
# P024_帳本統計頁面_SRS

**文件編號**: P024-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 16:45:00 UTC+8

---

## 1. 功能目的（Purpose）

P028帳本統計頁面提供帳本的全面統計分析功能，包含財務統計、成員貢獻度分析、記帳行為模式、預算執行狀況等，為帳本管理者提供數據化的決策支援和帳本健康度評估。

**核心功能**：
- 財務統計與趨勢分析
- 成員活動與貢獻度統計
- 記帳行為模式分析
- 預算執行狀況評估
- 分類科目統計分析
- 時間週期比較分析

## 2. 使用者故事（User Story）

### 主要使用者故事
```
作為帳本管理員
我想要查看帳本的詳細統計資訊
以便了解帳本使用狀況和成員參與情形
```

### 詳細使用者故事
1. **財務概覽**: 使用者可以查看帳本的財務統計摘要
2. **趨勢分析**: 使用者可以分析收支趨勢和變化模式
3. **成員統計**: 使用者可以了解各成員的參與度和貢獻
4. **分類分析**: 使用者可以查看各科目的統計分布
5. **時期比較**: 使用者可以比較不同時期的統計數據

## 3. 前置條件（Preconditions）

### 系統前置條件
- 使用者已完成登入驗證
- 使用者擁有帳本的檢視權限
- 帳本存在且包含統計資料
- 網路連線狀態正常

### 資料前置條件
- 帳本ID必須有效且存在
- 帳本包含足夠的記帳資料用於統計
- 統計資料已完成計算和更新
- 成員資料完整可存取

### 權限前置條件
- **統計檢視權限**: 能夠查看帳本統計資訊
- **詳細分析權限**: 能夠查看詳細的分析報告
- **成員統計權限**: 能夠查看成員相關統計

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
```
1. 系統驗證使用者統計檢視權限
2. 載入帳本基本資訊和設定
3. 載入統計時間範圍設定
4. 計算或載入快取的統計資料
5. 載入成員活動統計
6. 載入分類科目統計
7. 載入預算執行統計
8. 渲染統計儀表板
```

### 4.2 統計資料計算流程
```
1. 系統檢查統計資料快取狀態
2. 如快取過期則重新計算：
   - 財務統計計算
   - 成員貢獻度計算
   - 分類科目統計計算
   - 趨勢分析計算
3. 更新統計資料快取
4. 記錄統計計算日誌
5. 返回統計結果
```

### 4.3 時間範圍篩選流程
```
1. 使用者選擇統計時間範圍
2. 系統驗證時間範圍有效性
3. 重新載入對應時期的統計資料
4. 更新所有統計圖表和數據
5. 更新比較分析結果
6. 儲存使用者偏好設定
```

### 4.4 統計報表匯出流程
```
1. 使用者選擇匯出格式和範圍
2. 系統檢查匯出權限
3. 生成統計報表文件
4. 提供下載連結或發送Email
5. 記錄匯出操作日誌
```

## 5. 輸入項目（Inputs）

### 5.1 路由參數
| 參數名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| ledgerId | String | 是 | 帳本ID |
| period | String | 否 | 預設統計時期 |

### 5.2 統計篩選輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| startDate | String | 否 | 有效日期格式 | 統計開始日期 |
| endDate | String | 否 | 有效日期格式 | 統計結束日期 |
| period | String | 否 | 預定義時期值 | 快速時期選擇 |
| categories | Array<String> | 否 | 有效分類ID | 分類篩選 |
| members | Array<String> | 否 | 有效成員ID | 成員篩選 |

### 5.3 比較分析輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| compareMode | String | 否 | 有效比較模式 | 比較分析模式 |
| comparePeriod | String | 否 | 有效時期值 | 比較時期 |
| metrics | Array<String> | 否 | 有效指標名稱 | 比較指標選擇 |

### 5.4 匯出設定輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| exportFormat | String | 否 | pdf/excel/csv | 匯出格式 |
| includeCharts | Boolean | 否 | true/false | 是否包含圖表 |
| detailLevel | String | 否 | summary/detailed | 詳細程度 |

## 6. 輸出項目（Outputs / Responses）

### 6.1 財務統計摘要
```typescript
interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  averageDaily: number;
  entryCount: number;
  periodComparison: {
    incomeChange: number;
    expenseChange: number;
    netChange: number;
    changePercentage: number;
  };
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>;
}
```

### 6.2 成員活動統計
```typescript
interface MemberActivityStats {
  memberContributions: Array<{
    memberId: string;
    memberName: string;
    entryCount: number;
    totalAmount: number;
    lastActivity: string;
    activityScore: number;
    categoryDistribution: Record<string, number>;
  }>;
  collaborationMetrics: {
    totalMembers: number;
    activeMembers: number;
    averageEntriesPerMember: number;
    mostActiveDay: string;
    participationRate: number;
  };
}
```

### 6.3 趨勢分析資料
```typescript
interface TrendAnalysis {
  dailyTrend: Array<{
    date: string;
    income: number;
    expense: number;
    net: number;
    entryCount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expense: number;
    net: number;
    entryCount: number;
  }>;
  categoryTrend: Array<{
    categoryId: string;
    categoryName: string;
    trend: Array<{
      period: string;
      amount: number;
    }>;
  }>;
}
```

### 6.4 預算執行統計
```typescript
interface BudgetExecutionStats {
  budgetOverview: Array<{
    budgetId: string;
    budgetName: string;
    planned: number;
    actual: number;
    remaining: number;
    utilizationRate: number;
    status: 'on_track' | 'over_budget' | 'under_utilized';
  }>;
  executionTrend: Array<{
    period: string;
    plannedTotal: number;
    actualTotal: number;
    variancePercentage: number;
  }>;
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 時間範圍驗證
- 開始日期不可晚於結束日期
- 統計時間範圍不可超過2年
- 快速時期選擇必須為有效值
- 比較時期不可與主要時期重疊

### 7.2 篩選條件驗證
- 分類篩選必須為帳本內有效分類
- 成員篩選必須為帳本內有效成員
- 篩選條件組合必須合理有效
- 至少需要一筆記帳資料用於統計

### 7.3 權限驗證規則
- 檢查統計檢視權限等級
- 敏感統計需要額外權限
- 成員個人統計需要特殊權限
- 匯出功能需要匯出權限

## 8. 錯誤處理（Error Handling）

### 8.1 資料載入錯誤
| 錯誤類型 | 錯誤代碼 | 處理方式 | 使用者訊息 |
|---------|---------|---------|-----------|
| 統計資料為空 | STATS_NO_DATA | 顯示空狀態指引 | "暫無統計資料，請先新增記帳" |
| 計算超時 | STATS_CALCULATION_TIMEOUT | 使用快取資料 | "統計計算中，顯示最近資料" |
| 權限不足 | STATS_ACCESS_DENIED | 隱藏受限內容 | "部分統計需要更高權限" |

### 8.2 統計計算錯誤
| 錯誤情境 | 處理策略 | 使用者體驗 |
|---------|---------|-----------|
| 資料量過大 | 分批計算並顯示進度 | 顯示載入進度條 |
| 計算失敗 | 提供重試機制 | 顯示重試按鈕和錯誤說明 |
| 快取失效 | 背景重新計算 | 顯示快取資料並提示更新中 |

### 8.3 圖表渲染錯誤
- **圖表載入失敗**: 顯示替代的數字摘要
- **資料格式錯誤**: 使用預設格式重新渲染
- **瀏覽器相容性**: 提供簡化版圖表

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
帳本統計頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題
│   └── 匯出按鈕
├── 時間範圍選擇器
│   ├── 快速時期按鈕
│   ├── 自訂日期範圍
│   └── 比較模式開關
├── 財務統計摘要卡片
│   ├── 總收入
│   ├── 總支出
│   ├── 淨額
│   └── 變化趨勢
├── 統計圖表區域
│   ├── 收支趨勢圖
│   ├── 分類分布圓餅圖
│   ├── 成員貢獻橫條圖
│   └── 預算執行進度條
├── 詳細統計表格
│   ├── 分類明細表
│   ├── 成員活動表
│   └── 時期比較表
└── 統計洞察區域
    ├── 重要發現
    ├── 趨勢預測
    └── 建議改善
```

### 9.2 統計摘要卡片設計
```
財務摘要卡片：
┌─────────────────────────────────┐
│ 💰 總收入                      │
│ NT$ 50,000  ↑ 15%              │
│                                 │
│ 💸 總支出                      │
│ NT$ 35,000  ↓ 5%               │
│                                 │
│ 📊 淨收益                      │
│ NT$ 15,000  ↑ 45%              │
└─────────────────────────────────┘
```

### 9.3 圖表設計規範
- **趨勢圖**: 使用折線圖顯示時間序列變化
- **分布圖**: 使用圓餅圖或環形圖顯示比例
- **比較圖**: 使用橫條圖顯示成員或分類比較
- **進度條**: 顯示預算執行進度和完成度

### 9.4 響應式設計
- **手機直向**: 圖表垂直堆疊，簡化顯示
- **手機橫向**: 圖表水平排列，保持可讀性
- **平板裝置**: 網格佈局顯示多個統計圖表

## 10. API 規格（API Specification）

### 10.1 獲取統計摘要
```javascript
// API: ProjectLedgerService.getLedgerStatistics()
GET /api/ledgers/{ledgerId}/statistics

Query Parameters:
- startDate: string (統計開始日期)
- endDate: string (統計結束日期)
- period: string (快速時期選擇)
- categories: string (分類篩選，逗號分隔)
- members: string (成員篩選，逗號分隔)

Response 200:
{
  "success": true,
  "data": {
    "financialSummary": FinancialSummary,
    "memberStats": MemberActivityStats,
    "trendAnalysis": TrendAnalysis,
    "budgetStats": BudgetExecutionStats,
    "lastUpdated": string
  }
}
```

### 10.2 獲取趨勢分析
```javascript
// API: ProjectLedgerService.getTrendAnalysis()
GET /api/ledgers/{ledgerId}/statistics/trends

Query Parameters:
- period: string (分析時期)
- granularity: string (資料粒度：daily/weekly/monthly)
- compareMode: boolean (是否比較模式)

Response 200:
{
  "success": true,
  "data": {
    "trends": TrendAnalysis,
    "insights": Array<StatisticalInsight>,
    "predictions": Array<TrendPrediction>
  }
}
```

### 10.3 匯出統計報表
```javascript
// API: ProjectLedgerService.exportStatistics()
POST /api/ledgers/{ledgerId}/statistics/export

Request Body:
{
  "format": "pdf",
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  },
  "includeCharts": true,
  "detailLevel": "detailed"
}

Response 201:
{
  "success": true,
  "data": {
    "exportId": string,
    "downloadUrl": string,
    "expiryTime": string
  }
}
```

### 10.4 觸發統計重新計算
```javascript
// API: ProjectLedgerService.recalculateStatistics()
POST /api/ledgers/{ledgerId}/statistics/recalculate

Request Body:
{
  "forceRefresh": true,
  "scope": ["financial", "member", "trend", "budget"]
}

Response 202:
{
  "success": true,
  "data": {
    "jobId": string,
    "estimatedCompletion": string,
    "status": "queued"
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface LedgerStatisticsState {
  // 載入狀態
  isLoading: boolean;
  isCalculating: boolean;
  isExporting: boolean;
  
  // 時間範圍狀態
  dateRange: {
    startDate: string;
    endDate: string;
    period: string;
  };
  
  // 篩選狀態
  filters: {
    categories: string[];
    members: string[];
    compareMode: boolean;
  };
  
  // 統計資料狀態
  financialSummary: FinancialSummary | null;
  memberStats: MemberActivityStats | null;
  trendAnalysis: TrendAnalysis | null;
  budgetStats: BudgetExecutionStats | null;
  
  // UI顯示狀態
  selectedChart: string;
  showDetails: boolean;
  chartSettings: Record<string, any>;
  
  // 操作狀態
  lastUpdated: string | null;
  autoRefresh: boolean;
  refreshInterval: number;
  
  // 錯誤狀態
  error: string | null;
  chartErrors: Record<string, string>;
}
```

### 11.2 即時更新機制
- **資料同步**: 定期檢查統計資料更新
- **增量更新**: 僅更新變化的統計指標
- **快取策略**: 智能快取常用統計資料
- **背景計算**: 背景進行複雜統計計算

### 11.3 圖表互動狀態
- **圖表切換**: 支援多種圖表類型切換
- **資料鑽取**: 支援點擊圖表查看詳細資料
- **縮放平移**: 支援圖表的縮放和平移操作
- **工具提示**: 滑鼠懸停顯示詳細數值

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 統計資料安全
- **權限分級**: 根據權限等級顯示不同統計詳細度
- **資料脫敏**: 敏感統計資料的脫敏處理
- **存取記錄**: 記錄統計資料的存取日誌
- **快取安全**: 統計快取資料的安全存儲

### 12.2 隱私保護機制
- **個人統計**: 保護個人統計資料隱私
- **匿名化**: 必要時對統計資料進行匿名化
- **資料範圍**: 限制統計資料的存取範圍
- **敏感標記**: 標記和保護敏感統計指標

### 12.3 匯出安全控制
- **匯出權限**: 嚴格控制統計報表匯出權限
- **浮水印**: 匯出文件添加識別浮水印
- **下載限制**: 限制匯出文件的下載次數和時效
- **審計追蹤**: 完整記錄匯出操作審計軌跡

## 13. 其他補充需求（Others）

### 13.1 效能最佳化需求
- **統計快取**: 智能快取統計結果減少計算時間
- **分頁載入**: 大量統計資料的分頁載入
- **漸進載入**: 優先載入重要統計，其他統計延遲載入
- **計算優化**: 優化統計算法提升計算效能

### 13.2 使用體驗優化
- **智能建議**: 基於統計結果提供智能建議
- **趨勢預測**: 提供基於歷史資料的趨勢預測
- **異常提醒**: 自動檢測和提醒統計異常
- **個性化**: 支援個性化的統計儀表板配置

### 13.3 無障礙設計需求
- **螢幕閱讀器**: 統計資料的完整語音描述
- **替代格式**: 為視障使用者提供表格形式統計
- **顏色無關**: 不依賴顏色傳達統計資訊
- **操作簡化**: 簡化複雜的統計操作流程

### 13.4 國際化需求
- **多語言**: 支援統計名稱和說明的多語言
- **數字格式**: 適應不同地區的數字和貨幣格式
- **圖表本地化**: 圖表標籤和說明的本地化
- **時區處理**: 正確處理不同時區的統計時間

---

**相關文件連結:**
- [P025_成員管理頁面_SRS.md](./P025_成員管理頁面_SRS.md) - 成員管理功能
- [P027_邀請成員頁面_SRS.md](./P027_邀請成員頁面_SRS.md) - 邀請功能
- [P029_刪除帳本頁面_SRS.md](./P029_刪除帳本頁面_SRS.md) - 帳本刪除功能
- [9005. Flutter_Presentation layer.md](../90.%20Flutter_PRD/9005.%20Flutter_Presentation%20layer.md) - 視覺規格
- [9006. Flutter_AP layer.md](../90.%20Flutter_PRD/9006.%20Flutter_AP%20layer.md) - API規格
# P028_帳本統計頁面_SRS

## 1. 功能目的 (Purpose)
提供特定帳本的詳細統計分析，包含收支分析、趨勢圖表、成員貢獻統計和帳本健康度評估。

## 2. 使用者故事 (User Story)
- 作為帳本成員，我希望查看帳本的收支統計
- 作為帳本管理者，我希望看到成員貢獻度分析
- 作為帳本使用者，我希望了解帳本的支出趨勢
- 作為帳本分析者，我希望獲得帳本健康度評估

## 3. 前置條件 (Preconditions)
- 使用者已登入系統
- 使用者具有帳本查看權限
- 帳本包含足夠的資料進行統計
- 統計時間範圍設定有效

## 4. 功能流程 (Functional Flow)

### 主要流程
1. 選擇統計時間範圍
2. 載入帳本統計資料
3. 顯示收支概覽
4. 展示圖表分析
5. 顯示成員貢獻統計

### 替代流程
- 切換不同統計維度
- 匯出統計報表
- 設定統計提醒

## 5. 輸入項目 (Inputs)
- 統計時間範圍
- 統計維度選擇
- 圖表類型設定
- 成員篩選條件

## 6. 輸出項目 (Outputs)
- 收支總額統計
- 趨勢變化圖表
- 成員貢獻排行
- 類別支出分析
- 帳本健康度指標

## 7. 驗證規則 (Validation Rules)
- 時間範圍有效性驗證
- 統計權限檢查
- 資料完整性驗證
- 圖表參數有效性檢查

## 8. 錯誤處理 (Error Handling)
- 統計資料載入失敗處理
- 權限不足錯誤提示
- 資料不足警告顯示
- 網路連線錯誤處理

## 9. UI 元件與排版需求 (UI Requirements)
- 統計概覽卡片
- 互動式圖表組件
- 時間範圍選擇器
- 成員貢獻列表
- 統計數據表格

## 10. API 規格 (API Specification)
- GET /app/projects/{projectId}/statistics - 取得帳本統計
- GET /app/projects/{projectId}/trends - 取得趨勢資料
- GET /app/projects/{projectId}/member-contributions - 成員貢獻統計
- POST /app/projects/{projectId}/statistics/export - 匯出統計報表

## 11. 狀態與畫面切換 (State Handling)
- 統計載入中狀態
- 統計資料顯示狀態
- 圖表互動狀態
- 統計篩選狀態

## 12. 安全性與權限檢查 (Security)
- 統計查看權限驗證
- 敏感資料存取控制
- 成員隱私保護
- 統計資料加密傳輸

## 13. 其他補充需求 (Others)
- 統計快取機制
- 即時資料更新
- 統計比較功能
- 自訂統計指標
