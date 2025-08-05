
# P024_分類帳本詳情頁面_SRS

**文件編號**: P024  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 15:45:00 UTC+8

---

## 1. 功能目的（Purpose）

P024分類帳本詳情頁面提供分類帳本的詳細資訊檢視與管理功能，包含分類規則設定、自動分類統計、記帳記錄檢視、分類效果分析等核心功能，作為智慧分類帳本的主要管理中心。

**核心功能**：
- 分類帳本詳細資訊顯示
- 分類規則管理與設定
- 自動分類統計展示
- 分類效果分析
- 快速記帳功能
- 分類帳本設定管理

## 2. 使用者故事（User Story）

### 主要使用者故事
```
作為一個個人用戶或小企業主
我想要檢視分類帳本的詳細資訊和分類效果
以便我能夠了解收支分類狀況並優化分類規則
```

### 詳細使用者故事
1. **分類資訊檢視**: 使用者可以查看分類帳本的基本資訊和分類統計
2. **規則管理**: 使用者可以檢視和管理自動分類規則
3. **效果分析**: 使用者可以查看分類準確度和效果分析
4. **記錄檢視**: 使用者可以查看已分類的記帳記錄
5. **快速記帳**: 使用者可以直接在分類帳本中新增記帳記錄

## 3. 前置條件（Preconditions）

### 系統前置條件
- 使用者已完成登入驗證
- 使用者擁有指定分類帳本的存取權限
- 分類帳本資料已成功載入
- 網路連線狀態正常

### 資料前置條件
- 分類帳本ID必須有效且存在
- 使用者對該帳本具備至少讀取權限
- 分類規則資料完整
- 分類統計資料可正常計算

### 權限前置條件
- **讀取權限**: 檢視帳本基本資訊和統計
- **記帳權限**: 新增記帳記錄
- **管理權限**: 修改分類規則和帳本設定

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
```
1. 系統驗證使用者身份和帳本存取權限
2. 載入分類帳本基本資訊
3. 載入分類規則和設定
4. 計算並載入分類統計資料
5. 載入最近分類記錄
6. 檢查使用者操作權限
7. 渲染頁面UI元件
```

### 4.2 分類資訊檢視流程
```
1. 使用者進入分類帳本詳情頁面
2. 系統顯示帳本基本資訊卡片
3. 展示分類規則摘要
4. 顯示分類統計圖表
5. 展示分類效果分析
6. 提供相關操作入口
```

### 4.3 分類規則管理流程
```
1. 使用者點擊「管理規則」按鈕
2. 系統檢查管理權限
3. 顯示分類規則列表
4. 提供新增、編輯、刪除規則功能
5. 實時預估規則影響
6. 儲存規則變更
7. 更新分類統計
```

### 4.4 快速記帳流程
```
1. 使用者點擊「新增記帳」按鈕
2. 開啟快速記帳彈窗
3. 使用者輸入記帳資訊
4. 系統自動套用分類規則
5. 顯示建議分類結果
6. 使用者確認或調整分類
7. 提交記帳記錄
8. 更新分類統計
```

## 5. 輸入項目（Inputs）

### 5.1 路由參數
| 參數名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| ledgerId | String | 是 | 分類帳本ID |

### 5.2 查詢參數
| 參數名稱 | 資料型別 | 必填 | 預設值 | 說明 |
|---------|---------|------|-------|------|
| tab | String | 否 | overview | 預設顯示標籤 |
| period | String | 否 | month | 統計期間 |
| category | String | 否 | all | 篩選分類 |

### 5.3 使用者互動輸入
| 輸入項目 | 資料型別 | 驗證規則 | 說明 |
|---------|---------|---------|------|
| 快速記帳資料 | Object | 參考P011規格 | 記帳表單資料 |
| 分類規則 | Object | 規則格式驗證 | 分類規則設定 |
| 篩選條件 | Object | 可選 | 統計資料篩選 |

## 6. 輸出項目（Outputs / Responses）

### 6.1 分類帳本資訊顯示
```typescript
interface ClassificationLedger {
  id: string;
  name: string;
  description: string;
  type: 'classification';
  autoClassification: boolean;
  rulesCount: number;
  accuracy: number;
  lastTraining: string;
  owner: UserInfo;
  createdAt: string;
  lastActivity: string;
}
```

### 6.2 分類規則資訊
```typescript
interface ClassificationRule {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  accuracy: number;
  matchCount: number;
  isActive: boolean;
  createdAt: string;
  lastModified: string;
}

interface RuleCondition {
  field: 'description' | 'amount' | 'merchant' | 'category';
  operator: 'contains' | 'equals' | 'greater' | 'less' | 'regex';
  value: string | number;
  caseSensitive?: boolean;
}

interface RuleAction {
  type: 'setCategory' | 'setDescription' | 'addTag';
  value: string;
}
```

### 6.3 分類統計資料
```typescript
interface ClassificationStats {
  totalTransactions: number;
  autoClassified: number;
  manualClassified: number;
  unclassified: number;
  accuracy: number;
  categoryBreakdown: CategoryStats[];
  rulePerformance: RulePerformance[];
  monthlyAccuracy: MonthlyAccuracy[];
  topRules: RuleStats[];
}

interface CategoryStats {
  category: string;
  count: number;
  amount: number;
  percentage: number;
  autoClassifiedCount: number;
  accuracy: number;
}
```

### 6.4 UI狀態輸出
- 載入中狀態指示器
- 分類進度顯示
- 錯誤訊息顯示
- 成功操作確認

## 7. 驗證規則（Validation Rules）

### 7.1 存取權限驗證
- 驗證使用者對分類帳本的存取權限
- 檢查帳本狀態（啟用/停用）
- 確認使用者操作權限

### 7.2 分類規則驗證
- 規則條件格式正確性檢查
- 規則優先級衝突檢測
- 規則邏輯有效性驗證
- 正規表達式語法檢查

### 7.3 輸入資料驗證
- 快速記帳資料格式驗證
- 篩選參數有效性檢查
- 統計期間合理性驗證

## 8. 錯誤處理（Error Handling）

### 8.1 載入錯誤處理
| 錯誤類型 | 錯誤代碼 | 處理方式 | 使用者訊息 |
|---------|---------|---------|-----------|
| 帳本不存在 | LEDGER_NOT_FOUND | 顯示404頁面 | "找不到指定的分類帳本" |
| 權限不足 | ACCESS_DENIED | 顯示權限錯誤 | "您沒有權限存取此帳本" |
| 載入失敗 | LOAD_FAILED | 提供重試選項 | "載入失敗，請重試" |
| 分類引擎錯誤 | CLASSIFICATION_ERROR | 顯示降級功能 | "自動分類暫時無法使用" |

### 8.2 規則管理錯誤處理
| 錯誤情境 | 處理策略 | 使用者體驗 |
|---------|---------|-----------|
| 規則衝突 | 顯示警告並提供解決建議 | 高亮衝突規則和建議調整 |
| 規則無效 | 阻止儲存並顯示錯誤 | 標示錯誤欄位和修正提示 |
| 儲存失敗 | 保存草稿，提供重試 | 顯示離線編輯模式 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
分類帳本詳情頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 帳本名稱
│   └── 更多選單
├── 帳本資訊卡片
│   ├── 基本資訊
│   ├── 分類準確度
│   └── 狀態指示器
├── 統計摘要區域
│   ├── 分類統計卡片
│   ├── 準確度趨勢
│   └── 規則效果圖表
├── 功能操作區域
│   ├── 快速記帳按鈕
│   ├── 管理規則按鈕
│   └── 查看記錄按鈕
├── 分類規則預覽
│   ├── 主要規則列表
│   ├── 規則效果統計
│   └── 管理規則入口
├── 最近分類結果
│   ├── 自動分類記錄
│   ├── 分類準確度
│   └── 手動調整記錄
└── 分類效果分析
    ├── 準確度變化
    ├── 分類覆蓋率
    └── 優化建議
```

### 9.2 視覺設計規範
- **主要色彩**: 智慧分類主題色彩（藍綠色系）
- **字體層級**: 標題18sp、內容14sp、說明12sp
- **間距規範**: 16dp基準間距，12dp卡片間距
- **分類標籤**: 圓角標籤，色彩區分不同分類
- **準確度指示**: 進度條和百分比視覺化

### 9.3 響應式設計
- **手機直向**: 單欄佈局，統計圖表適配
- **手機橫向**: 圖表橫向擴展顯示
- **平板裝置**: 左右分欄，規則和統計並排

### 9.4 互動狀態設計
- **分類中狀態**: 動畫進度指示器
- **規則測試**: 即時預覽分類結果
- **準確度變化**: 動態數值更新動畫

## 10. API 規格（API Specification）

### 10.1 載入分類帳本詳情
```javascript
// API: ProjectLedgerService.getClassificationLedger()
GET /api/ledgers/{ledgerId}/classification

Request Headers:
- Authorization: Bearer {token}
- Content-Type: application/json

Response 200:
{
  "success": true,
  "data": {
    "ledger": ClassificationLedger,
    "rules": ClassificationRule[],
    "stats": ClassificationStats,
    "recentResults": ClassificationResult[]
  }
}
```

### 10.2 載入分類統計
```javascript
// API: ProjectLedgerService.getClassificationStats()
GET /api/ledgers/{ledgerId}/classification/stats?period={period}

Response 200:
{
  "success": true,
  "data": {
    "summary": ClassificationStats,
    "accuracy": AccuracyTrend[],
    "performance": RulePerformance[],
    "categories": CategoryBreakdown[]
  }
}
```

### 10.3 管理分類規則
```javascript
// API: ProjectLedgerService.updateClassificationRule()
PUT /api/ledgers/{ledgerId}/classification/rules/{ruleId}

Request Body:
{
  "name": string,
  "priority": number,
  "conditions": RuleCondition[],
  "actions": RuleAction[],
  "isActive": boolean
}

Response 200:
{
  "success": true,
  "data": {
    "rule": ClassificationRule,
    "estimatedImpact": RuleImpact
  }
}
```

### 10.4 測試分類規則
```javascript
// API: ProjectLedgerService.testClassificationRule()
POST /api/ledgers/{ledgerId}/classification/test

Request Body:
{
  "rule": ClassificationRule,
  "sampleData": Transaction[]
}

Response 200:
{
  "success": true,
  "data": {
    "matches": Transaction[],
    "accuracy": number,
    "conflicts": RuleConflict[]
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface ClassificationDetailState {
  // 載入狀態
  isLoading: boolean;
  isStatsLoading: boolean;
  isRulesLoading: boolean;
  isClassifying: boolean;
  
  // 資料狀態
  ledger: ClassificationLedger | null;
  rules: ClassificationRule[];
  stats: ClassificationStats | null;
  recentResults: ClassificationResult[];
  
  // UI狀態
  activeTab: 'overview' | 'rules' | 'analysis';
  selectedPeriod: string;
  showRuleEditor: boolean;
  showQuickEntry: boolean;
  
  // 編輯狀態
  editingRule: ClassificationRule | null;
  ruleTestResults: RuleTestResult | null;
  
  // 錯誤狀態
  error: string | null;
  ruleErrors: Record<string, string>;
}
```

### 11.2 分類規則管理狀態
```typescript
interface RuleManagementState {
  rules: ClassificationRule[];
  editingRule: ClassificationRule | null;
  testResults: RuleTestResult | null;
  conflicts: RuleConflict[];
  isDirty: boolean;
  isSaving: boolean;
}
```

### 11.3 即時分類狀態
- **分類進行中**: 顯示進度指示器和處理狀態
- **規則測試**: 即時顯示測試結果和影響評估
- **衝突檢測**: 自動檢測規則衝突並提供解決建議

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 存取權限控制
- **頁面存取**: 驗證使用者對分類帳本的基本存取權限
- **規則管理**: 檢查使用者是否有管理分類規則的權限
- **資料匯出**: 控制敏感分類資料的匯出權限

### 12.2 分類規則安全
- **規則驗證**: 防止惡意規則影響系統效能
- **正規表達式**: 限制複雜度避免ReDoS攻擊
- **權限檢查**: 每次規則變更前檢查操作權限

### 12.3 資料安全防護
- **敏感資料**: 分類統計和規則資料加密傳輸
- **操作記錄**: 記錄規則變更和重要操作
- **輸入驗證**: 嚴格驗證分類規則輸入資料

## 13. 其他補充需求（Others）

### 13.1 效能最佳化需求
- **規則引擎**: 優化分類規則執行效能
- **統計計算**: 大量資料時採用增量計算
- **快取策略**: 分類結果和統計資料適度快取
- **分頁載入**: 大量規則和記錄分頁載入

### 13.2 智慧分類功能
- **機器學習**: 基於歷史資料優化分類準確度
- **規則建議**: 自動分析並建議新的分類規則
- **異常檢測**: 識別分類異常並提醒使用者
- **A/B測試**: 測試不同分類策略的效果

### 13.3 無障礙設計需求
- **螢幕閱讀器**: 分類規則和統計資料語音描述
- **鍵盤導航**: 規則編輯器支援完整鍵盤操作
- **視覺提示**: 分類準確度使用多種視覺提示方式
- **字體縮放**: 支援系統字體大小調整

### 13.4 國際化與本地化
- **多語言**: 分類規則條件支援多語言
- **本地化分類**: 根據地區提供預設分類規則
- **貨幣處理**: 不同幣別的金額分類規則
- **日期格式**: 支援各地區日期格式的規則匹配

---

**相關文件連結:**
- [P020_帳本清單頁面_SRS.md](./P020_帳本清單頁面_SRS.md) - 上層帳本列表
- [P023_專案帳本詳情_SRS.md](./P023_專案帳本詳情_SRS.md) - 專案帳本對照
- [P011_快速記帳頁面_SRS.md](./P011_快速記帳頁面_SRS.md) - 記帳功能規格
- [9005. Flutter_Presentation layer.md](../90.%20Flutter_PRD/9005.%20Flutter_Presentation%20layer.md) - 視覺規格
- [9006. Flutter_AP layer.md](../90.%20Flutter_PRD/9006.%20Flutter_AP%20layer.md) - API規格
