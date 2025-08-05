
# P031_建立預算頁面_SRS

**文件版本**: v1.0.0  
**建立日期**: 2025-01-26  
**最後更新**: 2025-01-26  
**負責團隊**: LCAS PM Team

---

## 1. 功能目的（Purpose）

提供使用者建立新預算項目的完整介面，支援多種預算類型設定、週期性預算配置，以及與現有記帳系統的整合，協助使用者建立有效的預算控制機制。

## 2. 使用者故事（User Story）

**作為** LCAS 使用者  
**我希望** 能夠建立新的預算項目並設定預算規則  
**以便** 有效控制我的支出並追蹤預算執行狀況

### 2.1 驗收標準（Acceptance Criteria）
- [ ] 能夠設定預算名稱和描述
- [ ] 支援多種預算類型（總預算、分類預算、專案預算）
- [ ] 可設定預算金額和有效期間
- [ ] 支援週期性預算設定（月、季、年）
- [ ] 能夠選擇適用的記帳分類
- [ ] 提供預算範本選擇功能
- [ ] 支援預算警示閾值設定
- [ ] 即時驗證輸入資料
- [ ] 成功建立後自動跳轉至預算詳情頁面

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者已成功登入系統
- 使用者具備建立預算的權限
- 使用者已選擇或建立至少一個帳本

### 3.2 系統狀態
- 網路連線正常
- 帳本資料已載入完成
- 記帳分類資料可用
- 預算範本資料已同步

### 3.3 資料狀態
- 使用者帳本資料完整
- 分類設定資料可用
- 歷史預算資料已載入（如有）

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要流程
```
1. 使用者點擊「建立新預算」按鈕
2. 系統顯示預算建立表單
3. 使用者填寫預算基本資訊
   ├── 輸入預算名稱
   ├── 選擇預算類型
   ├── 設定預算金額
   └── 選擇有效期間
4. 使用者設定進階選項
   ├── 選擇適用分類
   ├── 設定週期性規則
   ├── 配置警示設定
   └── 選擇預算範本（可選）
5. 系統即時驗證輸入資料
6. 使用者確認並提交預算設定
7. 系統建立預算項目
8. 顯示成功訊息並跳轉至預算詳情頁面
```

### 4.2 替代流程
- **取消建立**: 使用者可隨時取消建立流程
- **儲存草稿**: 未完成的預算可儲存為草稿
- **範本套用**: 可選擇預設範本快速建立

### 4.3 例外流程
- **資料驗證失敗**: 顯示錯誤訊息並標示問題欄位
- **網路中斷**: 自動儲存已輸入資料
- **系統錯誤**: 顯示錯誤訊息並提供重試選項

## 5. 輸入項目（Inputs）

### 5.1 必填欄位
```typescript
interface BudgetBasicInfo {
  name: string;           // 預算名稱 (2-50字元)
  type: BudgetType;       // 預算類型
  amount: number;         // 預算金額 (>0)
  startDate: Date;        // 開始日期
  endDate: Date;          // 結束日期
  ledgerId: string;       // 所屬帳本ID
}

enum BudgetType {
  TOTAL = 'total',        // 總預算
  CATEGORY = 'category',  // 分類預算
  PROJECT = 'project'     // 專案預算
}
```

### 5.2 選填欄位
```typescript
interface BudgetAdvancedSettings {
  description?: string;           // 預算描述
  categories?: string[];          // 適用分類ID清單
  projectId?: string;            // 專案ID（專案預算）
  isRecurring?: boolean;         // 是否為週期性預算
  recurringType?: RecurringType; // 週期類型
  alertThresholds?: AlertConfig; // 警示設定
  templateId?: string;           // 使用的範本ID
}
```

### 5.3 警示設定
```typescript
interface AlertConfig {
  enableAlerts: boolean;     // 是否啟用警示
  warningThreshold: number;  // 警告閾值 (50-90%)
  dangerThreshold: number;   // 危險閾值 (80-100%)
  notificationMethods: NotificationMethod[];
}
```

## 6. 輸出項目（Outputs / Responses）

### 6.1 成功回應
```typescript
interface CreateBudgetResponse {
  success: true;
  data: {
    budgetId: string;
    name: string;
    amount: number;
    type: BudgetType;
    status: 'active';
    createdAt: Date;
    effectiveDate: Date;
    expiryDate: Date;
  };
  message: string;
}
```

### 6.2 驗證錯誤回應
```typescript
interface ValidationErrorResponse {
  success: false;
  errors: {
    field: string;
    message: string;
    code: string;
  }[];
}
```

### 6.3 系統錯誤回應
```typescript
interface SystemErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 預算名稱驗證
- **長度限制**: 2-50字元
- **字元規範**: 支援中文、英文、數字及常用符號
- **唯一性檢查**: 同一帳本內預算名稱不可重複
- **禁用字元**: 不可包含特殊控制字元

### 7.2 預算金額驗證
- **數值範圍**: 0.01 - 999,999,999
- **小數位數**: 最多2位小數
- **貨幣格式**: 依使用者設定的貨幣格式
- **負數檢查**: 不可為負數或零

### 7.3 日期範圍驗證
- **開始日期**: 不可早於今天
- **結束日期**: 必須晚於開始日期
- **期間限制**: 最短1天，最長10年
- **週期性驗證**: 週期設定必須與日期範圍相符

### 7.4 分類選擇驗證
- **權限檢查**: 僅能選擇有權限的分類
- **邏輯檢查**: 收入分類不可用於支出預算
- **數量限制**: 分類預算最多選擇10個分類

## 8. 錯誤處理（Error Handling）

### 8.1 輸入驗證錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 預算名稱為空 | "請輸入預算名稱" | 標示欄位錯誤並聚焦 |
| 預算名稱重複 | "此預算名稱已存在" | 顯示建議替代名稱 |
| 金額格式錯誤 | "請輸入有效的金額" | 顯示格式範例 |
| 日期範圍無效 | "結束日期必須晚於開始日期" | 自動調整日期範圍 |
| 分類選擇錯誤 | "請選擇有效的分類" | 重新載入分類清單 |

### 8.2 系統操作錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 網路連線中斷 | "網路連線中斷，已自動儲存" | 自動儲存並提示重試 |
| 權限不足 | "您沒有建立預算的權限" | 顯示權限說明 |
| 系統維護 | "系統維護中，請稍後再試" | 顯示維護時間 |
| 伺服器錯誤 | "系統暫時無法回應" | 提供重試按鈕 |

### 8.3 業務邏輯錯誤
| 錯誤情況 | 錯誤訊息 | 處理方式 |
|---------|----------|----------|
| 帳本已刪除 | "所選帳本不存在" | 返回帳本選擇頁面 |
| 預算衝突 | "存在衝突的預算設定" | 顯示衝突詳情 |
| 資源限制 | "已達到預算數量上限" | 提示升級方案 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
建立預算頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題：「建立預算」
│   └── 儲存草稿按鈕
├── 基本資訊區塊
│   ├── 預算名稱輸入框
│   ├── 預算類型選擇器
│   ├── 預算金額輸入框
│   └── 日期範圍選擇器
├── 進階設定區塊（可展開）
│   ├── 預算描述輸入框
│   ├── 分類選擇器
│   ├── 週期性設定
│   └── 警示設定
├── 預算範本區塊（可選）
│   ├── 範本清單
│   └── 套用按鈕
└── 底部操作列
    ├── 取消按鈕
    └── 建立預算按鈕
```

### 9.2 視覺設計規範
- **主要色彩**: 預算主題色彩（綠色系）
- **字體層級**: 標題18sp、內容14sp、說明12sp
- **間距規範**: 16dp基準間距，8dp小間距
- **表單樣式**: Material Design輸入框
- **按鈕樣式**: 主要操作使用Filled按鈕

### 9.3 響應式設計
- **手機直向**: 單欄表單佈局
- **手機橫向**: 調整輸入框寬度
- **平板裝置**: 雙欄表單佈局

### 9.4 互動設計
- **即時驗證**: 失焦時驗證輸入內容
- **動態提示**: 根據輸入提供建議
- **進度指示**: 表單完成度進度條
- **自動儲存**: 定時儲存草稿

## 10. API 規格（API Specification）

### 10.1 建立預算 API
```typescript
// POST /api/v1/budgets
interface CreateBudgetRequest {
  name: string;
  type: BudgetType;
  amount: number;
  startDate: string;
  endDate: string;
  ledgerId: string;
  description?: string;
  categories?: string[];
  projectId?: string;
  isRecurring?: boolean;
  recurringType?: RecurringType;
  alertConfig?: AlertConfig;
  templateId?: string;
}
```

### 10.2 驗證預算名稱 API
```typescript
// POST /api/v1/budgets/validate-name
interface ValidateNameRequest {
  name: string;
  ledgerId: string;
}

interface ValidateNameResponse {
  isValid: boolean;
  suggestions?: string[];
}
```

### 10.3 取得預算範本 API
```typescript
// GET /api/v1/budget-templates?ledgerId={ledgerId}
interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  type: BudgetType;
  defaultAmount?: number;
  categories?: string[];
  alertConfig?: AlertConfig;
}
```

### 10.4 儲存草稿 API
```typescript
// POST /api/v1/budgets/draft
interface SaveDraftRequest {
  draftId?: string;
  name?: string;
  type?: BudgetType;
  amount?: number;
  startDate?: string;
  endDate?: string;
  // ... 其他欄位
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態定義
```typescript
interface CreateBudgetPageState {
  // 載入狀態
  isLoading: boolean;
  isSubmitting: boolean;
  isDraftSaving: boolean;
  
  // 表單狀態
  formData: CreateBudgetFormData;
  errors: ValidationErrors;
  touched: TouchedFields;
  
  // UI狀態
  showAdvancedSettings: boolean;
  showTemplateSelector: boolean;
  selectedTemplate?: BudgetTemplate;
  
  // 資料狀態
  templates: BudgetTemplate[];
  categories: Category[];
  projects: Project[];
}
```

### 11.2 狀態切換邏輯
- **表單初始化**: 設定預設值並載入相關資料
- **即時驗證**: 監聽輸入變化並更新錯誤狀態
- **範本套用**: 更新表單資料並維持使用者已輸入的內容
- **草稿儲存**: 定時或手動觸發草稿儲存

### 11.3 頁面切換條件
- **成功建立**: 跳轉至預算詳情頁面
- **取消建立**: 返回預算總覽頁面
- **草稿儲存**: 保持當前頁面狀態

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 頁面存取權限
- **登入驗證**: 僅已登入使用者可存取
- **帳本權限**: 必須對目標帳本具有編輯權限
- **功能權限**: 檢查預算管理功能權限

### 12.2 資料安全機制
- **輸入過濾**: 過濾惡意腳本和特殊字元
- **資料驗證**: 後端二次驗證所有輸入資料
- **權限驗證**: 每個API請求都須驗證操作權限

### 12.3 隱私保護
- **資料傳輸**: 使用HTTPS加密傳輸
- **敏感資料**: 金額等敏感資料加密處理
- **日誌記錄**: 記錄操作但不記錄敏感內容

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **頁面載入**: 初始載入時間 < 2秒
- **表單回應**: 輸入回應時間 < 100ms
- **API回應**: 預算建立 < 3秒
- **草稿儲存**: 背景儲存不影響使用

### 13.2 可用性需求
- **操作簡易**: 核心功能3步驟內完成
- **錯誤恢復**: 提供明確的錯誤修正指引
- **說明文件**: 關鍵功能提供內嵌說明
- **快捷操作**: 支援鍵盤快捷鍵

### 13.3 相容性需求
- **作業系統**: iOS 12+、Android 8+
- **螢幕解析度**: 支援320px至平板尺寸
- **網路環境**: 支援3G以上網路環境
- **離線支援**: 基本表單填寫離線可用

### 13.4 監控與分析
- **使用統計**: 記錄預算建立成功率
- **錯誤追蹤**: 監控表單驗證錯誤
- **效能監控**: 追蹤頁面載入和API回應時間
- **使用者行為**: 分析表單放棄率和完成路徑

---

**變更歷史**
- v1.0.0 (2025-01-26): 初始版本建立，完整的預算建立頁面SRS規格
