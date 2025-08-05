# P019_專案帳本詳情_SRS

**文件編號**: P019-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 15:30:00 UTC+8

---

## 1. 功能目的（Purpose）

P023專案帳本詳情頁面提供專案帳本的詳細資訊檢視與管理功能，包含專案基本資訊、成員列表、記帳記錄統計、專案進度追蹤等核心功能，作為專案帳本的主要資訊中心。

**核心功能**：
- 專案帳本詳細資訊顯示
- 專案成員管理入口
- 專案記帳統計展示
- 專案進度追蹤
- 快速記帳功能
- 專案設定管理

## 2. 使用者故事（User Story）

### 主要使用者故事
```
作為一個專案經理
我想要檢視專案帳本的詳細資訊
以便我能夠掌握專案的財務狀況和進度
```

### 詳細使用者故事
1. **專案資訊檢視**: 使用者可以查看專案名稱、描述、預算、進度等基本資訊
2. **成員管理**: 使用者可以查看專案成員列表並進行管理操作
3. **統計資料**: 使用者可以查看專案的收支統計、預算使用情況
4. **快速記帳**: 使用者可以直接在專案中新增記帳記錄
5. **設定管理**: 使用者可以存取專案設定進行調整

## 3. 前置條件（Preconditions）

### 系統前置條件
- 使用者已完成登入驗證
- 使用者擁有指定專案帳本的存取權限
- 專案帳本資料已成功載入
- 網路連線狀態正常

### 資料前置條件
- 專案帳本ID必須有效且存在
- 使用者對該專案具備至少讀取權限
- 專案成員資料完整
- 專案統計資料可正常計算

### 權限前置條件
- **讀取權限**: 檢視專案基本資訊和統計
- **成員權限**: 查看成員列表和活動
- **記帳權限**: 新增記帳記錄
- **管理權限**: 修改專案設定

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
```
1. 系統驗證使用者身份和專案存取權限
2. 載入專案帳本基本資訊
3. 載入專案成員資料
4. 計算並載入專案統計資料
5. 檢查使用者操作權限
6. 渲染頁面UI元件
```

### 4.2 資訊檢視流程
```
1. 使用者進入專案帳本詳情頁面
2. 系統顯示專案基本資訊卡片
3. 顯示成員列表和角色資訊
4. 展示專案統計圖表和數據
5. 提供相關操作按鈕
```

### 4.3 快速記帳流程
```
1. 使用者點擊「新增記帳」按鈕
2. 開啟快速記帳彈窗
3. 使用者輸入記帳資訊
4. 系統驗證輸入資料
5. 提交記帳記錄
6. 更新專案統計資料
7. 顯示成功訊息
```

### 4.4 成員管理流程
```
1. 使用者點擊「管理成員」按鈕
2. 系統檢查管理權限
3. 導航至成員管理頁面
4. 或顯示成員操作選單
```

## 5. 輸入項目（Inputs）

### 5.1 路由參數
| 參數名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| projectId | String | 是 | 專案帳本ID |

### 5.2 查詢參數
| 參數名稱 | 資料型別 | 必填 | 預設值 | 說明 |
|---------|---------|------|-------|------|
| tab | String | 否 | overview | 預設顯示標籤 |
| period | String | 否 | month | 統計期間 |

### 5.3 使用者互動輸入
| 輸入項目 | 資料型別 | 驗證規則 | 說明 |
|---------|---------|---------|------|
| 快速記帳資料 | Object | 參考P011規格 | 記帳表單資料 |
| 篩選條件 | Object | 可選 | 統計資料篩選 |

## 6. 輸出項目（Outputs / Responses）

### 6.1 專案資訊顯示
```typescript
interface ProjectDetails {
  id: string;
  name: string;
  description: string;
  type: 'project';
  budget: number;
  spent: number;
  progress: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'paused';
  owner: MemberInfo;
  memberCount: number;
  lastActivity: string;
}
```

### 6.2 成員資訊顯示
```typescript
interface ProjectMember {
  userId: string;
  displayName: string;
  avatar: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinDate: string;
  lastActive: string;
  permissions: string[];
}
```

### 6.3 統計資料顯示
```typescript
interface ProjectStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  budgetUsage: number;
  transactionCount: number;
  categoryBreakdown: CategoryStat[];
  monthlyTrend: MonthlyData[];
  recentTransactions: Transaction[];
}
```

### 6.4 UI狀態輸出
- 載入中狀態指示器
- 錯誤訊息顯示
- 成功操作確認
- 權限限制提示

## 7. 驗證規則（Validation Rules）

### 7.1 存取權限驗證
- 驗證使用者對專案的存取權限
- 檢查專案帳本狀態（啟用/停用）
- 確認使用者角色和操作權限

### 7.2 資料完整性驗證
- 專案ID格式和有效性檢查
- 成員資料完整性驗證
- 統計資料計算正確性檢查

### 7.3 輸入資料驗證
- 快速記帳資料格式驗證
- 篩選參數有效性檢查
- 日期範圍合理性驗證

## 8. 錯誤處理（Error Handling）

### 8.1 載入錯誤處理
| 錯誤類型 | 錯誤代碼 | 處理方式 | 使用者訊息 |
|---------|---------|---------|-----------|
| 專案不存在 | PROJECT_NOT_FOUND | 顯示404頁面 | "找不到指定的專案帳本" |
| 權限不足 | ACCESS_DENIED | 顯示權限錯誤 | "您沒有權限存取此專案" |
| 載入失敗 | LOAD_FAILED | 提供重試選項 | "載入失敗，請重試" |
| 網路錯誤 | NETWORK_ERROR | 離線模式提示 | "網路連線異常" |

### 8.2 操作錯誤處理
| 錯誤情境 | 處理策略 | 使用者體驗 |
|---------|---------|-----------|
| 記帳失敗 | 保存草稿，提供重試 | 顯示錯誤訊息和重試按鈕 |
| 資料同步失敗 | 顯示離線狀態 | 提示資料可能不是最新 |
| 權限變更 | 即時更新UI狀態 | 隱藏無權限操作按鈕 |

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
專案帳本詳情頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 專案名稱
│   └── 更多選單
├── 專案資訊卡片
│   ├── 專案基本資訊
│   ├── 進度條
│   └── 狀態標籤
├── 統計概覽區域
│   ├── 收支統計卡片
│   ├── 預算使用情況
│   └── 圖表展示
├── 功能操作區域
│   ├── 快速記帳按鈕
│   ├── 查看記錄按鈕
│   └── 管理成員按鈕
├── 成員資訊區域
│   ├── 成員列表
│   └── 成員活動
└── 最近記錄區域
    ├── 記錄列表
    └── 查看更多連結
```

### 9.2 視覺設計規範
- **主要色彩**: 專案主題色彩配置
- **字體層級**: 標題18sp、內容14sp、說明12sp
- **間距規範**: 16dp基準間距，8dp小間距
- **卡片樣式**: 8dp圓角，適度陰影
- **按鈕樣式**: Material Design規範

### 9.3 響應式設計
- **手機直向**: 單欄佈局，卡片式排列
- **手機橫向**: 調整統計圖表比例
- **平板裝置**: 雙欄佈局，左右分割顯示

### 9.4 互動狀態設計
- **載入狀態**: Shimmer載入效果
- **空資料狀態**: 友善的空狀態插圖和提示
- **錯誤狀態**: 明確的錯誤圖示和重試按鈕

## 10. API 規格（API Specification）

### 10.1 載入專案詳情
```javascript
// API: ProjectLedgerService.getProjectDetails()
GET /api/projects/{projectId}/details

Request Headers:
- Authorization: Bearer {token}
- Content-Type: application/json

Response 200:
{
  "success": true,
  "data": {
    "project": ProjectDetails,
    "members": ProjectMember[],
    "stats": ProjectStats,
    "permissions": string[]
  }
}
```

### 10.2 載入統計資料
```javascript
// API: ProjectLedgerService.getProjectStats()
GET /api/projects/{projectId}/stats?period={period}

Response 200:
{
  "success": true,
  "data": {
    "summary": StatsSummary,
    "charts": ChartData[],
    "trends": TrendData[]
  }
}
```

### 10.3 快速記帳
```javascript
// API: EntryService.createProjectEntry()
POST /api/projects/{projectId}/entries

Request Body:
{
  "amount": number,
  "category": string,
  "description": string,
  "date": string,
  "type": "income" | "expense"
}

Response 201:
{
  "success": true,
  "data": {
    "entry": TransactionEntry,
    "updatedStats": ProjectStats
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface ProjectDetailState {
  // 載入狀態
  isLoading: boolean;
  isStatsLoading: boolean;
  isMembersLoading: boolean;

  // 資料狀態
  project: ProjectDetails | null;
  members: ProjectMember[];
  stats: ProjectStats | null;

  // UI狀態
  activeTab: 'overview' | 'members' | 'stats';
  selectedPeriod: string;
  showQuickEntry: boolean;

  // 錯誤狀態
  error: string | null;
  networkStatus: 'online' | 'offline';
}
```

### 11.2 狀態更新邏輯
- **初始載入**: 依序載入專案、成員、統計資料
- **資料重新整理**: 下拉重新整理觸發全部資料更新
- **即時更新**: WebSocket連線接收專案變更通知
- **離線狀態**: 顯示快取資料並標示離線狀態

### 11.3 畫面切換
- **標籤切換**: 概覽、成員、統計三個主要標籤
- **彈窗管理**: 快速記帳、成員詳情等彈窗狀態
- **導航管理**: 返回上一頁、進入子頁面

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 存取權限控制
- **頁面存取**: 驗證使用者對專案的基本存取權限
- **資料檢視**: 根據角色限制可見資料範圍
- **功能權限**: 基於使用者角色顯示/隱藏操作功能

### 12.2 資料安全防護
- **敏感資料**: 財務統計資料加密傳輸
- **權限變更**: 即時檢測權限變更並更新UI
- **操作記錄**: 記錄重要操作行為供稽核

### 12.3 輸入安全驗證
- **XSS防護**: 所有使用者輸入進行適當跳脫
- **資料驗證**: 前端後端雙重驗證機制
- **權限檢查**: 每次API呼叫前檢查操作權限

## 13. 其他補充需求（Others）

### 13.1 效能最佳化需求
- **載入效能**: 分段載入資料，優先顯示關鍵資訊
- **圖表效能**: 大資料集時進行資料分頁或採樣
- **快取策略**: 統計資料適度快取減少計算負擔
- **記憶體管理**: 圖表組件適當銷毀避免記憶體洩漏

### 13.2 無障礙設計需求
- **螢幕閱讀器**: 統計資料提供文字替代說明
- **對比度**: 確保圖表和文字符合WCAG標準
- **鍵盤導航**: 支援Tab鍵切換和快捷鍵操作
- **字體縮放**: 支援系統字體大小設定

### 13.3 國際化需求
- **多語言**: 支援繁中、簡中、英文介面
- **貨幣格式**: 根據地區設定顯示適當貨幣符號
- **日期格式**: 支援不同地區的日期時間格式
- **數字格式**: 千分位符號和小數點格式本地化

### 13.4 分析追蹤需求
- **頁面瀏覽**: 記錄專案詳情頁面瀏覽數據
- **功能使用**: 追蹤快速記帳、成員管理等功能使用
- **錯誤監控**: 監控載入失敗和操作錯誤情況
- **效能監控**: 追蹤頁面載入時間和渲染效能

---

**相關文件連結:**
- [P020_帳本清單頁面_SRS.md](./P020_帳本清單頁面_SRS.md) - 上層帳本列表
- [P025_成員管理頁面_SRS.md](./P025_成員管理頁面_SRS.md) - 成員管理功能
- [P011_快速記帳頁面_SRS.md](./P011_快速記帳頁面_SRS.md) - 記帳功能規格
- [9005. Flutter_Presentation layer.md](../90.%20Flutter_PRD/9005.%20Flutter_Presentation%20layer.md) - 視覺規格
- [9006. Flutter_AP layer.md](../90.%20Flutter_PRD/9006.%20Flutter_AP%20layer.md) - API規格