
# P033_預算編輯頁面_SRS

**文件版本**: v1.0.0  
**建立日期**: 2025-01-26  
**最後更新**: 2025-01-26  
**負責團隊**: LCAS PM Team

---

## 1. 功能目的（Purpose）

提供使用者修改現有預算項目的完整介面，支援調整預算金額、期間、分類設定及警示規則，同時確保資料一致性並保護已有的預算執行歷史。

## 2. 使用者故事（User Story）

**作為** LCAS 使用者  
**我希望** 能夠修改現有預算的設定和規則  
**以便** 因應情況變化調整預算計畫並維持有效的財務控制

### 2.1 驗收標準（Acceptance Criteria）
- [ ] 載入並顯示現有預算的所有設定
- [ ] 支援修改預算金額和期間
- [ ] 可調整適用分類和專案範圍
- [ ] 支援更新警示設定和週期規則
- [ ] 提供預算調整對歷史資料的影響說明
- [ ] 即時驗證修改內容的合理性
- [ ] 支援批次修改多個設定項目
- [ ] 提供變更預覽和確認機制
- [ ] 保存修改歷史以供追蹤

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者已成功登入系統
- 使用者對該預算具有編輯權限
- 從預算詳情或清單頁面正確導航至編輯頁面

### 3.2 系統狀態
- 網路連線正常
- 預算資料已載入完成
- 相關分類和專案資料可用
- 編輯權限已驗證

### 3.3 資料狀態
- 預算項目存在且有效
- 預算執行歷史資料完整
- 關聯分類和專案資料同步
- 無其他使用者正在編輯

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要流程
```
1. 使用者點擊編輯預算按鈕
2. 系統載入現有預算設定
3. 系統檢查編輯權限和狀態
4. 顯示預填充的編輯表單
5. 使用者修改預算設定
   ├── 調整基本資訊
   ├── 修改金額和期間
   ├── 更新分類設定
   └── 調整警示規則
6. 系統即時驗證修改內容
7. 系統顯示變更影響分析
8. 使用者確認變更內容
9. 系統保存修改並更新相關資料
10. 顯示成功訊息並返回詳情頁面
```

### 4.2 特殊處理流程
- **預算調整影響**: 分析對現有交易和統計的影響
- **期間變更**: 處理期間縮短或延長的邏輯
- **分類修改**: 重新計算相關交易的預算歸屬
- **版本衝突**: 處理多人同時編輯的情況

### 4.3 例外流程
- **權限變更**: 編輯過程中權限被撤回
- **預算鎖定**: 其他使用者正在編輯
- **資料衝突**: 預算已被其他操作修改

## 5. 輸入項目（Inputs）

### 5.1 路由參數
```typescript
interface BudgetEditParams {
  budgetId: string;        // 預算項目ID
  mode?: EditMode;         // 編輯模式
}

enum EditMode {
  BASIC = 'basic',         // 基本編輯
  ADVANCED = 'advanced',   // 進階編輯
  QUICK = 'quick'          // 快速調整
}
```

### 5.2 可編輯欄位
```typescript
interface EditableBudgetFields {
  // 基本資訊
  name?: string;
  description?: string;
  amount?: number;
  
  // 期間設定
  startDate?: Date;
  endDate?: Date;
  isRecurring?: boolean;
  recurringType?: RecurringType;
  
  // 分類設定
  categories?: string[];
  projectId?: string;
  
  // 警示設定
  alertConfig?: AlertConfig;
  
  // 進階設定
  budgetNotes?: string;
  isActive?: boolean;
}
```

### 5.3 變更追蹤
```typescript
interface BudgetChangeTracking {
  originalValues: Record<string, any>;
  modifiedValues: Record<string, any>;
  changeReason?: string;
  impactAnalysis?: ImpactAnalysis;
}
```

## 6. 輸出項目（Outputs / Responses）

### 6.1 更新成功回應
```typescript
interface UpdateBudgetResponse {
  success: true;
  data: {
    budgetId: string;
    updatedFields: string[];
    newVersion: number;
    updatedAt: Date;
    impactSummary: ImpactSummary;
  };
  message: string;
}
```

### 6.2 變更影響分析
```typescript
interface ImpactAnalysis {
  affectedTransactions: number;
  statisticsImpact: StatisticsChange;
  alertsImpact: AlertChange[];
  projectionChange: ProjectionChange;
  recommendedActions: string[];
}
```

### 6.3 驗證錯誤回應
```typescript
interface EditValidationErrorResponse {
  success: false;
  errors: {
    field: string;
    message: string;
    code: string;
    currentValue: any;
    suggestedValue?: any;
  }[];
  conflictInfo?: ConflictInfo;
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 基本欄位驗證
- **預算名稱**: 2-50字元，不可與其他預算重複
- **預算金額**: 必須為正數，與歷史資料合理性檢查
- **日期範圍**: 新期間必須包含已有交易的時間範圍
- **描述內容**: 最多500字元

### 7.2 業務邏輯驗證
- **金額調整**: 新金額不可小於已使用金額
- **期間縮短**: 不可排除已有交易的日期
- **分類變更**: 確保歷史交易仍有對應分類
- **週期性調整**: 驗證週期設定與期間的一致性

### 7.3 權限與狀態驗證
- **編輯權限**: 確認使用者對預算有編輯權限
- **預算狀態**: 已結束的預算限制編輯範圍
- **併發控制**: 檢查是否有其他使用者正在編輯
- **資料完整性**: 確保修改不會破壞資料一致性

### 7.4 影響分析驗證
- **交易歸屬**: 分析修改對現有交易分類的影響
- **統計準確性**: 確保修改後統計資料正確性
- **預算目標**: 驗證修改是否符合預算設定目標

## 8. 錯誤處理（Error Handling）

### 8.1 輸入驗證錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 金額小於已使用 | "預算金額不可小於已使用金額 NT$XX" | 顯示建議金額並高亮已使用金額 |
| 期間不含已有交易 | "新期間必須包含現有交易日期" | 顯示受影響交易清單 |
| 名稱重複 | "預算名稱已存在" | 提供替代名稱建議 |
| 分類設定衝突 | "分類變更將影響XX筆交易" | 顯示影響分析和處理選項 |

### 8.2 業務邏輯錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 併發編輯衝突 | "其他使用者正在編輯此預算" | 提供檢視最新版本選項 |
| 權限已變更 | "您的編輯權限已被撤銷" | 切換為檢視模式 |
| 資料版本衝突 | "預算已被其他操作修改" | 顯示差異比較 |
| 預算已鎖定 | "預算處於鎖定狀態" | 說明鎖定原因和解除方式 |

### 8.3 系統操作錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 保存失敗 | "保存修改時發生錯誤" | 自動備份修改內容並重試 |
| 網路中斷 | "網路連線中斷" | 本地儲存並提示稍後同步 |
| 影響分析失敗 | "無法分析變更影響" | 顯示警告並允許繼續 |
| 版本同步失敗 | "無法同步最新版本" | 提供手動重新載入選項 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
預算編輯頁面
├── 頂部導航列
│   ├── 取消按鈕
│   ├── 頁面標題：「編輯預算」
│   └── 保存按鈕
├── 變更指示區域
│   ├── 修改欄位提示
│   └── 版本資訊
├── 基本資訊編輯區塊
│   ├── 預算名稱輸入框
│   ├── 預算描述輸入框
│   └── 預算狀態開關
├── 金額與期間編輯區塊
│   ├── 預算金額輸入框
│   ├── 日期範圍選擇器
│   └── 週期性設定
├── 分類設定編輯區塊
│   ├── 適用分類選擇器
│   ├── 專案選擇器
│   └── 範圍設定
├── 警示設定編輯區塊
│   ├── 警示開關
│   ├── 警告閾值設定
│   └── 通知方式設定
├── 影響分析區域
│   ├── 變更摘要
│   ├── 影響預覽
│   └── 建議操作
└── 底部操作列
    ├── 重設按鈕
    ├── 預覽變更按鈕
    └── 確認保存按鈕
```

### 9.2 視覺設計規範
- **修改指示**: 已修改欄位使用強調色邊框
- **驗證狀態**: 即時顯示驗證結果
  - 正確：綠色勾號
  - 錯誤：紅色驚嘆號
  - 警告：黃色三角形
- **影響提示**: 使用卡片展示變更影響
- **進度指示**: 保存過程顯示進度條

### 9.3 互動設計
- **智慧提示**: 根據修改內容提供建議
- **自動保存**: 定時儲存修改至本地
- **變更預覽**: 提供修改前後對比
- **快捷操作**: 支援常用修改的快捷按鈕

### 9.4 響應式設計
- **手機直向**: 分段式表單佈局
- **手機橫向**: 優化輸入體驗
- **平板裝置**: 雙欄編輯佈局

## 10. API 規格（API Specification）

### 10.1 取得編輯資料 API
```typescript
// GET /api/v1/budgets/{budgetId}/edit-data
interface GetBudgetEditDataRequest {
  budgetId: string;
  includeHistory?: boolean;
  includeImpactAnalysis?: boolean;
}

interface GetBudgetEditDataResponse {
  budget: EditableBudget;
  editableFields: string[];
  constraints: EditConstraints;
  history: BudgetChangeHistory[];
}
```

### 10.2 驗證變更 API
```typescript
// POST /api/v1/budgets/{budgetId}/validate-changes
interface ValidateChangesRequest {
  budgetId: string;
  changes: Partial<EditableBudgetFields>;
  forceValidation?: boolean;
}

interface ValidateChangesResponse {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  impactAnalysis: ImpactAnalysis;
}
```

### 10.3 更新預算 API
```typescript
// PUT /api/v1/budgets/{budgetId}
interface UpdateBudgetRequest {
  budgetId: string;
  changes: Partial<EditableBudgetFields>;
  changeReason?: string;
  version: number;
  applyToFuture?: boolean;
}
```

### 10.4 取得編輯鎖定 API
```typescript
// POST /api/v1/budgets/{budgetId}/acquire-lock
interface AcquireLockRequest {
  budgetId: string;
  timeoutMinutes?: number;
}

interface AcquireLockResponse {
  lockId: string;
  expiresAt: Date;
  currentEditor?: UserInfo;
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```typescript
interface BudgetEditPageState {
  // 載入狀態
  isLoading: boolean;
  isSaving: boolean;
  isValidating: boolean;
  isAnalyzing: boolean;
  
  // 編輯狀態
  originalData: BudgetDetail;
  currentData: EditableBudgetFields;
  changes: ChangeTracker;
  isDirty: boolean;
  
  // 驗證狀態
  errors: ValidationErrors;
  warnings: ValidationWarnings;
  impactAnalysis: ImpactAnalysis | null;
  
  // UI狀態
  showAdvancedOptions: boolean;
  showImpactAnalysis: boolean;
  editMode: EditMode;
  
  // 系統狀態
  lockInfo: LockInfo | null;
  version: number;
  lastSaved: Date | null;
}
```

### 11.2 變更追蹤機制
- **欄位監控**: 追蹤每個欄位的變更狀態
- **自動保存**: 定時保存修改到本地快取
- **衝突偵測**: 監控其他使用者的同時編輯
- **版本控制**: 追蹤資料版本避免覆蓋

### 11.3 頁面切換處理
- **離開確認**: 有未保存變更時提示確認
- **自動保存**: 離開前自動保存修改
- **狀態恢復**: 返回時恢復編輯狀態

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 編輯權限控制
- **基本編輯**: 需要預算編輯權限
- **敏感修改**: 金額調整需要額外確認
- **系統設定**: 進階設定需要管理權限
- **歷史修改**: 修改歷史記錄需要審計權限

### 12.2 資料安全機制
- **輸入驗證**: 嚴格驗證所有輸入資料
- **變更追蹤**: 記錄所有修改操作
- **版本控制**: 防止併發修改衝突
- **回滾機制**: 支援變更回滾功能

### 12.3 操作安全保護
- **編輯鎖定**: 防止多人同時編輯
- **操作確認**: 重要修改需要二次確認
- **審計日誌**: 記錄所有編輯操作
- **權限變更**: 即時反映權限變更

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **頁面載入**: 編輯頁面載入時間 < 2秒
- **即時驗證**: 輸入驗證回應時間 < 200ms
- **影響分析**: 變更影響分析 < 1秒
- **保存操作**: 資料保存時間 < 2秒

### 13.2 可用性需求
- **直觀編輯**: 提供所見即所得的編輯體驗
- **錯誤提示**: 清楚的錯誤訊息和修正建議
- **操作回饋**: 所有操作提供即時回饋
- **快捷操作**: 支援鍵盤快捷鍵

### 13.3 資料一致性需求
- **即時同步**: 編輯過程中保持資料同步
- **衝突解決**: 提供完善的衝突解決機制
- **資料備份**: 自動備份編輯過程中的資料
- **恢復機制**: 支援意外中斷後的資料恢復

### 13.4 監控與分析
- **編輯行為**: 分析使用者編輯行為模式
- **錯誤統計**: 監控編輯過程中的錯誤率
- **效能監控**: 追蹤編輯操作的效能指標
- **使用統計**: 記錄功能使用頻率

---

**變更歷史**
- v1.0.0 (2025-01-26): 初始版本建立，完整的預算編輯頁面SRS規格
