
# P032_預算詳情頁面_SRS

**文件版本**: v1.0.0  
**建立日期**: 2025-01-26  
**最後更新**: 2025-01-26  
**負責團隊**: LCAS PM Team

---

## 1. 功能目的（Purpose）

提供使用者檢視特定預算項目的詳細資訊介面，包括預算執行狀況、相關交易記錄、進度追蹤及警示狀態，並支援快速操作如編輯預算和新增相關交易。

## 2. 使用者故事（User Story）

**作為** LCAS 使用者  
**我希望** 能夠查看預算的詳細執行狀況和相關資訊  
**以便** 了解預算使用情形並及時調整財務計畫

### 2.1 驗收標準（Acceptance Criteria）
- [ ] 顯示預算基本資訊（名稱、金額、期間等）
- [ ] 展示預算執行進度和剩餘金額
- [ ] 顯示相關交易記錄清單
- [ ] 提供預算使用趨勢圖表
- [ ] 展示預算警示狀態
- [ ] 支援快速新增相關交易
- [ ] 提供編輯預算功能入口
- [ ] 支援預算分享功能
- [ ] 即時更新預算執行狀況

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者已成功登入系統
- 使用者對該預算有檢視權限
- 從預算清單或其他頁面正確導航至此頁面

### 3.2 系統狀態
- 網路連線正常
- 預算資料已成功載入
- 相關交易資料可用
- 圖表組件已初始化

### 3.3 資料狀態
- 預算基本資料完整
- 關聯交易記錄已同步
- 預算執行統計已計算
- 警示規則已評估

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要流程
```
1. 使用者進入預算詳情頁面
2. 系統載入預算基本資訊
3. 系統計算並顯示執行進度
4. 系統載入相關交易記錄
5. 系統產生趨勢圖表
6. 系統檢查並顯示警示狀態
7. 使用者可執行各種操作
   ├── 檢視詳細交易
   ├── 新增相關交易
   ├── 編輯預算設定
   ├── 分享預算資訊
   └── 查看歷史趨勢
8. 系統即時更新顯示內容
```

### 4.2 互動流程
- **下拉重新整理**: 更新所有預算相關資料
- **點擊交易記錄**: 跳轉至交易詳情頁面
- **圖表互動**: 支援縮放和區間選擇
- **快速操作**: 浮動按鈕提供常用功能

### 4.3 例外流程
- **資料載入失敗**: 顯示錯誤訊息並提供重試
- **權限不足**: 隱藏相關操作按鈕
- **預算已過期**: 顯示過期狀態標籤

## 5. 輸入項目（Inputs）

### 5.1 路由參數
```typescript
interface BudgetDetailParams {
  budgetId: string;        // 預算項目ID
  ledgerId?: string;       // 帳本ID（可選）
  highlightPeriod?: string; // 高亮顯示期間（可選）
}
```

### 5.2 查詢參數
```typescript
interface BudgetDetailQuery {
  startDate?: string;      // 查詢開始日期
  endDate?: string;        // 查詢結束日期
  includeDetails?: boolean; // 是否包含詳細資料
  refreshInterval?: number; // 自動重新整理間隔
}
```

### 5.3 使用者操作輸入
```typescript
interface UserInteraction {
  chartPeriod?: ChartPeriod;    // 圖表顯示期間
  transactionFilter?: FilterConfig; // 交易篩選條件
  sortOrder?: SortConfig;       // 排序設定
  viewMode?: ViewMode;          // 檢視模式
}
```

## 6. 輸出項目（Outputs / Responses）

### 6.1 預算詳情資料
```typescript
interface BudgetDetailResponse {
  budget: {
    id: string;
    name: string;
    description: string;
    type: BudgetType;
    amount: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: BudgetStatus;
    startDate: Date;
    endDate: Date;
    isRecurring: boolean;
    alertConfig: AlertConfig;
    createdAt: Date;
    updatedAt: Date;
  };
  transactions: Transaction[];
  statistics: BudgetStatistics;
  alerts: BudgetAlert[];
  trends: TrendData[];
}
```

### 6.2 執行統計資料
```typescript
interface BudgetStatistics {
  totalTransactions: number;
  averageSpending: number;
  highestSpending: number;
  lastSpendingDate: Date;
  projectedCompletion: Date;
  efficiencyRating: number;
  categoryBreakdown: CategorySpending[];
  dailyAverage: number;
  monthlyTrend: number;
}
```

### 6.3 警示狀態資料
```typescript
interface BudgetAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggeredAt: Date;
  isActive: boolean;
  threshold: number;
  currentValue: number;
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 參數驗證
- **預算ID**: 必須為有效的UUID格式
- **日期範圍**: 結束日期不可早於開始日期
- **權限檢查**: 驗證使用者對預算的存取權限
- **資料完整性**: 確保必要資料欄位存在

### 7.2 顯示邏輯驗證
- **進度計算**: 確保百分比計算正確
- **狀態判斷**: 根據當前日期和預算期間判斷狀態
- **警示觸發**: 驗證警示觸發條件和顯示邏輯
- **圖表資料**: 確保圖表資料格式正確

### 7.3 業務規則驗證
- **預算有效性**: 檢查預算是否仍然有效
- **交易關聯**: 驗證交易與預算的關聯性
- **權限限制**: 根據使用者權限顯示對應功能
- **資料一致性**: 確保顯示資料與實際資料一致

## 8. 錯誤處理（Error Handling）

### 8.1 資料載入錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 預算不存在 | "預算項目不存在或已被刪除" | 返回預算清單頁面 |
| 載入失敗 | "無法載入預算資料" | 顯示重試按鈕 |
| 網路超時 | "網路連線逾時" | 自動重試3次 |
| 權限不足 | "您無權限檢視此預算" | 顯示權限說明 |

### 8.2 功能操作錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 編輯失敗 | "無法編輯預算設定" | 檢查權限並重試 |
| 分享失敗 | "預算分享功能暫時無法使用" | 顯示替代方案 |
| 新增交易失敗 | "新增交易時發生錯誤" | 返回詳情頁面 |
| 圖表載入失敗 | "圖表載入失敗" | 顯示數據表格替代 |

### 8.3 資料同步錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 資料不同步 | "資料可能不是最新狀態" | 提供手動重新整理 |
| 版本衝突 | "預算已被其他使用者修改" | 重新載入最新資料 |
| 快取失效 | "正在更新資料" | 顯示載入指示器 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
預算詳情頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 預算名稱
│   └── 更多選單（編輯、分享、刪除）
├── 預算概覽卡片
│   ├── 預算金額顯示
│   ├── 已使用金額
│   ├── 剩餘金額
│   └── 進度條
├── 狀態指示區域
│   ├── 預算狀態標籤
│   ├── 警示狀態
│   └── 有效期間
├── 統計圖表區域
│   ├── 支出趨勢圖
│   ├── 期間選擇器
│   └── 圖表控制項
├── 快速操作區域
│   ├── 新增相關交易
│   ├── 檢視所有交易
│   └── 預算設定
├── 相關交易清單
│   ├── 最近交易
│   ├── 交易項目
│   └── 查看更多連結
└── 浮動操作按鈕
    └── 快速記帳
```

### 9.2 視覺設計規範
- **主要色彩**: 根據預算狀態調整主題色
  - 正常：綠色系
  - 警告：黃色系
  - 超支：紅色系
- **字體層級**: 標題20sp、金額24sp、內容14sp
- **進度條**: 漸層色彩顯示使用狀況
- **圖表樣式**: Material Design圖表組件

### 9.3 響應式設計
- **手機直向**: 單欄垂直佈局
- **手機橫向**: 圖表橫向展開
- **平板裝置**: 左右分欄顯示

### 9.4 互動設計
- **下拉重新整理**: 更新所有資料
- **圖表縮放**: 支援手勢縮放和平移
- **快速操作**: 長按顯示更多選項
- **智慧提示**: 根據使用狀況提供建議

## 10. API 規格（API Specification）

### 10.1 取得預算詳情 API
```typescript
// GET /api/v1/budgets/{budgetId}/details
interface GetBudgetDetailRequest {
  budgetId: string;
  includeTransactions?: boolean;
  includeStatistics?: boolean;
  startDate?: string;
  endDate?: string;
}
```

### 10.2 取得預算統計 API
```typescript
// GET /api/v1/budgets/{budgetId}/statistics
interface GetBudgetStatisticsRequest {
  budgetId: string;
  period: StatisticsPeriod;
  groupBy?: StatisticsGroupBy;
}
```

### 10.3 取得相關交易 API
```typescript
// GET /api/v1/budgets/{budgetId}/transactions
interface GetBudgetTransactionsRequest {
  budgetId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}
```

### 10.4 取得趨勢資料 API
```typescript
// GET /api/v1/budgets/{budgetId}/trends
interface GetBudgetTrendsRequest {
  budgetId: string;
  period: TrendPeriod;
  granularity: TrendGranularity;
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```typescript
interface BudgetDetailPageState {
  // 載入狀態
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingTransactions: boolean;
  isLoadingChart: boolean;
  
  // 資料狀態
  budget: BudgetDetail | null;
  transactions: Transaction[];
  statistics: BudgetStatistics | null;
  trends: TrendData[];
  alerts: BudgetAlert[];
  
  // UI狀態
  selectedChartPeriod: ChartPeriod;
  showAllTransactions: boolean;
  filterConfig: FilterConfig;
  
  // 錯誤狀態
  error: string | null;
  networkError: boolean;
}
```

### 11.2 資料同步機制
- **初始載入**: 並行載入基本資料和統計資料
- **即時更新**: 監聽預算變更事件
- **背景重新整理**: 定時更新執行狀況
- **快取策略**: 快取常用資料減少載入時間

### 11.3 頁面切換條件
- **編輯預算**: 跳轉至預算編輯頁面
- **新增交易**: 跳轉至記帳頁面並預設分類
- **檢視交易**: 跳轉至交易詳情頁面
- **預算清單**: 返回預算總覽頁面

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 頁面存取權限
- **基本檢視**: 需要預算檢視權限
- **編輯操作**: 需要預算編輯權限
- **刪除操作**: 需要預算管理權限
- **分享功能**: 需要分享權限

### 12.2 資料安全機制
- **資料過濾**: 僅顯示有權限存取的資料
- **API權限**: 每個API請求驗證操作權限
- **敏感資料**: 金額等敏感資料適當保護
- **操作日誌**: 記錄重要操作以供審計

### 12.3 隱私保護
- **資料脫敏**: 在分享時適當脫敏處理
- **存取追蹤**: 記錄存取行為但保護隱私
- **資料傳輸**: 使用HTTPS確保傳輸安全

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **頁面載入**: 初始載入時間 < 2秒
- **圖表渲染**: 圖表載入時間 < 1秒
- **資料重新整理**: 重新整理時間 < 1秒
- **交易載入**: 分頁載入時間 < 800ms

### 13.2 可用性需求
- **直觀操作**: 重要功能一鍵可達
- **視覺回饋**: 所有操作提供即時回饋
- **無障礙設計**: 支援螢幕閱讀器
- **說明提示**: 複雜功能提供操作說明

### 13.3 相容性需求
- **作業系統**: iOS 12+、Android 8+
- **螢幕解析度**: 支援各種螢幕尺寸
- **網路環境**: 適應低速網路環境
- **離線支援**: 基本資料離線可檢視

### 13.4 監控與分析
- **使用統計**: 記錄頁面檢視時間和互動
- **效能監控**: 追蹤載入時間和回應速度
- **錯誤追蹤**: 監控並記錄所有錯誤
- **使用者行為**: 分析使用者操作模式

---

**變更歷史**
- v1.0.0 (2025-01-26): 初始版本建立，完整的預算詳情頁面SRS規格
