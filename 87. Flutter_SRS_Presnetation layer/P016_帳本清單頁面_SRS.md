
# P020_帳本清單頁面_SRS

**文件編號**: P020_SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 18:00:00 UTC+8

---

## 1. 功能目的（Purpose）

帳本清單頁面提供使用者完整的帳本管理功能，包含所有可存取帳本的統一檢視、帳本狀態監控、快速操作入口，以及帳本的組織與分類管理。

### 核心功能
- **帳本總覽**: 顯示所有可存取的帳本清單
- **分類檢視**: 按類型、狀態、權限分類顯示
- **快速操作**: 建立、編輯、刪除、歸檔帳本
- **狀態監控**: 顯示同步狀態、成員活動、資料統計
- **搜尋篩選**: 快速查找特定帳本功能

---

## 2. 使用者故事（User Story）

**主要使用者故事**:
```
作為一個多帳本使用者
我想要查看和管理我所有的帳本
以便有效組織我的財務記錄

作為一個協作帳本管理者
我想要監控帳本狀態和成員活動
以便確保帳本正常運作
```

**具體場景**:
- 查看所有個人帳本和協作帳本
- 建立新的專案帳本或家庭帳本
- 檢視各帳本的基本統計資訊
- 管理帳本的歸檔和刪除
- 監控協作帳本的成員狀態

---

## 3. 前置條件（Preconditions）

### 使用者狀態
- [x] 使用者已完成登入驗證
- [x] 使用者至少擁有一個帳本的存取權限
- [x] 系統已載入使用者帳本資料

### 系統狀態  
- [x] 網路連線正常
- [x] 帳本服務可用
- [x] 權限資料已同步

### 資料前置條件
- [x] 帳本基本資料完整
- [x] 成員權限資料已載入
- [x] 帳本統計資料可用

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要瀏覽流程
```
帳本清單瀏覽流程:
使用者進入 → 載入帳本清單 → 選擇檢視方式 → 執行操作 → 更新狀態

詳細步驟:
1. 使用者進入帳本清單頁面：
   - 從主選單點擊「帳本管理」
   - 從首頁點擊「查看所有帳本」
2. 系統載入帳本清單資料
3. 顯示帳本清單與基本資訊
4. 使用者可選擇不同檢視方式：
   - 列表檢視：詳細資訊顯示
   - 卡片檢視：視覺化顯示
   - 分類檢視：按類型分組
5. 使用者執行帳本操作：
   - 點擊進入特定帳本
   - 建立新帳本
   - 編輯帳本設定
   - 邀請成員或管理權限
6. 系統更新帳本狀態並同步資料
```

### 4.2 帳本建立流程
```
新建帳本流程:
1. 點擊「建立新帳本」按鈕
2. 選擇帳本類型（個人/協作/專案）
3. 填寫帳本基本資訊：
   - 帳本名稱
   - 描述說明
   - 預設貨幣
   - 隱私設定
4. 設定初始成員（協作帳本）
5. 確認並建立帳本
6. 系統建立帳本並返回清單
```

---

## 5. 輸入項目（Inputs）

### 5.1 帳本查詢參數
| 欄位名稱 | 資料型別 | 必填 | 說明 |
|----------|----------|------|------|
| userId | String | 是 | 當前使用者ID |
| viewType | Enum | 否 | list/card/category |
| filterType | Enum | 否 | all/personal/shared/project |
| sortBy | Enum | 否 | name/created/lastUsed/memberCount |
| sortOrder | Enum | 否 | asc/desc |
| searchKeyword | String | 否 | 搜尋關鍵字 |

### 5.2 帳本建立參數
| 欄位名稱 | 資料型別 | 必填 | 長度限制 | 說明 |
|----------|----------|------|----------|------|
| ledgerName | String | 是 | 1-50字元 | 帳本名稱 |
| ledgerType | Enum | 是 | personal/shared/project | 帳本類型 |
| description | String | 否 | 0-200字元 | 帳本描述 |
| currency | String | 是 | 3字元 | 預設貨幣代碼 |
| isPrivate | Boolean | 否 | - | 是否為私人帳本 |
| initialMembers | Array<String> | 否 | - | 初始成員Email列表 |

### 5.3 篩選選項
- **帳本類型**: 個人、協作、專案、全部
- **權限等級**: 擁有者、管理員、成員、唯讀
- **活動狀態**: 活躍、不活躍、已歸檔
- **建立時間**: 本週、本月、本年、更早

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 帳本清單回應
```json
{
  "success": true,
  "data": {
    "ledgers": [
      {
        "ledgerId": "LED001",
        "name": "個人帳本",
        "type": "personal",
        "description": "個人日常記帳",
        "currency": "TWD",
        "isPrivate": true,
        "role": "owner",
        "createdDate": "2025-01-01T00:00:00Z",
        "lastUsed": "2025-01-26T10:30:00Z",
        "memberCount": 1,
        "entryCount": 156,
        "totalBalance": 25600,
        "syncStatus": "synced",
        "isArchived": false,
        "members": [
          {
            "userId": "USER001",
            "name": "張小明",
            "role": "owner",
            "joinDate": "2025-01-01T00:00:00Z",
            "lastActive": "2025-01-26T10:30:00Z"
          }
        ]
      },
      {
        "ledgerId": "LED002",
        "name": "家庭共同帳本",
        "type": "shared", 
        "description": "家庭收支管理",
        "currency": "TWD",
        "isPrivate": false,
        "role": "admin",
        "createdDate": "2025-01-15T00:00:00Z",
        "lastUsed": "2025-01-25T20:15:00Z",
        "memberCount": 3,
        "entryCount": 89,
        "totalBalance": 45200,
        "syncStatus": "syncing",
        "isArchived": false
      }
    ],
    "statistics": {
      "totalLedgers": 5,
      "personalLedgers": 2,
      "sharedLedgers": 2,
      "projectLedgers": 1,
      "totalBalance": 125800,
      "totalEntries": 567
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 5
    }
  },
  "message": "帳本清單載入成功"
}
```

### 6.2 帳本建立回應
```json
{
  "success": true,
  "data": {
    "ledger": {
      "ledgerId": "LED_NEW_001",
      "name": "新專案帳本",
      "type": "project",
      "createdDate": "2025-01-26T18:00:00Z",
      "role": "owner"
    },
    "invitations": [
      {
        "email": "member@example.com",
        "status": "sent",
        "inviteId": "INV001"
      }
    ]
  },
  "message": "帳本建立成功"
}
```

---

## 7. 驗證規則（Validation Rules）

### 7.1 輸入驗證
- **帳本名稱**: 1-50字元，不可包含特殊符號，同使用者下不可重複
- **帳本描述**: 最大200字元，可包含換行
- **貨幣代碼**: 必須為有效的ISO 4217代碼
- **成員邀請**: Email格式驗證，不可重複邀請

### 7.2 權限驗證  
- **建立權限**: 驗證使用者帳本建立額度
- **操作權限**: 確認使用者對特定帳本的操作權限
- **邀請權限**: 僅擁有者和管理員可邀請成員

### 7.3 業務規則驗證
- **帳本數量限制**: 個人使用者最多建立10個帳本
- **成員數量限制**: 協作帳本最多50名成員
- **名稱唯一性**: 同一使用者的帳本名稱不可重複

---

## 8. 錯誤處理（Error Handling）

### 8.1 輸入錯誤
| 錯誤碼 | 錯誤訊息 | 處理方式 |
|--------|----------|----------|
| LL001 | 帳本名稱不可為空 | 顯示欄位錯誤提示 |
| LL002 | 帳本名稱已存在 | 建議修改名稱 |
| LL003 | 貨幣代碼無效 | 提供有效貨幣選項 |
| LL004 | 成員Email格式錯誤 | 標示錯誤Email並要求修正 |

### 8.2 業務邏輯錯誤
| 錯誤碼 | 錯誤訊息 | 處理方式 |
|--------|----------|----------|
| LL101 | 帳本數量已達上限 | 提示升級方案或刪除未使用帳本 |
| LL102 | 無權限執行此操作 | 提示聯繫帳本擁有者 |
| LL103 | 帳本正在使用中無法刪除 | 建議先歸檔帳本 |

### 8.3 系統錯誤
- **載入失敗**: 提供重試選項與離線快取
- **建立失敗**: 保存草稿並提示重試
- **同步錯誤**: 標記未同步狀態並提供手動同步

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局
```
帳本清單頁面佈局:
┌─────────────────────────────┐
│ [← 返回]  我的帳本   [搜尋🔍] │
├─────────────────────────────┤
│ [列表] [卡片] [分類]  [+ 新增]│
├─────────────────────────────┤
│ 📊 5個帳本 • 總餘額 $125,800 │
├─────────────────────────────┤
│ 🏠 個人帳本          ✓ 同步  │
│    156筆記錄 • $25,600      │
│    最後使用: 1小時前         │
├─────────────────────────────┤
│ 👨‍👩‍👧‍👦 家庭共同帳本    🔄 同步中│
│    89筆記錄 • $45,200       │
│    3位成員 • 昨天            │
├─────────────────────────────┤
│ 💼 專案帳本A         ✓ 同步  │
│    45筆記錄 • $55,000       │
│    5位成員 • 3天前           │
└─────────────────────────────┘
```

### 9.2 卡片檢視模式
```
帳本卡片檢視:
┌─────────────┬─────────────┐
│ 🏠 個人帳本  │ 👨‍👩‍👧‍👦 家庭帳本 │
│ $25,600     │ $45,200     │
│ 156筆記錄   │ 89筆記錄    │
│ ✓ 同步      │ 🔄 同步中   │
├─────────────┼─────────────┤
│ 💼 專案帳本A │ [+ 建立新帳本]│
│ $55,000     │             │
│ 45筆記錄    │             │
│ ✓ 同步      │             │
└─────────────┴─────────────┘
```

### 9.3 關鍵UI元件
- **帳本卡片**: 顯示帳本基本資訊與狀態
- **檢視切換**: 列表、卡片、分類檢視切換
- **搜尋框**: 帳本名稱和描述搜尋
- **篩選器**: 類型、狀態、權限篩選
- **操作選單**: 編輯、設定、歸檔、刪除

---

## 10. API 規格（API Specification）

### 10.1 獲取帳本清單
```http
GET /api/v1/ledgers
Headers: Authorization: Bearer {token}
Query Parameters:
  - viewType: string (list/card/category)
  - filterType: string (all/personal/shared/project)
  - sortBy: string (name/created/lastUsed)
  - sortOrder: string (asc/desc)
  - search: string
  - page: number
  - limit: number
```

### 10.2 建立新帳本
```http
POST /api/v1/ledgers
Headers: Authorization: Bearer {token}
Body: {
  "name": "string",
  "type": "personal|shared|project",
  "description": "string",
  "currency": "string",
  "isPrivate": boolean,
  "initialMembers": ["email1", "email2"]
}
```

### 10.3 更新帳本資訊
```http
PUT /api/v1/ledgers/{ledgerId}
Headers: Authorization: Bearer {token}
Body: {
  "name": "string",
  "description": "string",
  "isPrivate": boolean
}
```

### 10.4 歸檔帳本
```http
POST /api/v1/ledgers/{ledgerId}/archive
Headers: Authorization: Bearer {token}
Body: {
  "isArchived": boolean,
  "reason": "string"
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface LedgerListState {
  ledgers: Ledger[];
  isLoading: boolean;
  viewType: 'list' | 'card' | 'category';
  filterType: 'all' | 'personal' | 'shared' | 'project';
  searchKeyword: string;
  selectedLedgers: string[];
  sortConfig: SortConfig;
  statistics: LedgerStatistics;
}
```

### 11.2 載入狀態管理
- **初始載入**: 顯示骨架屏與載入指示器
- **重新整理**: 下拉重新整理機制
- **分頁載入**: 無限滾動或分頁載入
- **搜尋狀態**: 搜尋中與結果顯示

### 11.3 操作狀態追蹤
- **建立狀態**: 帳本建立進度追蹤
- **編輯狀態**: 即時編輯狀態同步
- **刪除確認**: 刪除操作的確認流程
- **同步狀態**: 各帳本的同步狀態監控

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 資料存取權限
- **帳本可見性**: 僅顯示有權限存取的帳本
- **操作權限**: 依據使用者角色限制操作選項
- **敏感資訊**: 隱藏無權限查看的詳細資訊

### 12.2 操作安全
- **建立限制**: 防範大量建立帳本攻擊
- **邀請控制**: 限制邀請頻率與數量
- **刪除保護**: 重要帳本刪除需要二次確認

### 12.3 資料安全
- **本地快取**: 安全存儲帳本清單快取
- **傳輸加密**: API請求數據加密傳輸
- **日誌記錄**: 重要操作的安全日誌記錄

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **清單載入時間**: < 2秒
- **搜尋回應時間**: < 500ms
- **檢視切換**: < 300ms
- **帳本建立**: < 3秒

### 13.2 使用體驗
- **智能排序**: 依據使用頻率智能排序
- **快速操作**: 常用操作的快捷入口
- **批量操作**: 支援多選批量操作
- **拖拽排序**: 支援手動調整帳本順序

### 13.3 離線支援
- **本地快取**: 完整的帳本清單本地快取
- **離線檢視**: 支援離線模式下的帳本瀏覽
- **同步恢復**: 上線後自動同步變更

### 13.4 擴展功能
- **帳本範本**: 提供常用帳本範本
- **批量匯入**: 支援從其他系統匯入帳本
- **資料匯出**: 支援帳本資料批量匯出
- **統計報表**: 跨帳本的統計分析功能

---

**文件狀態**: ✅ 已完成  
**下一階段**: P021_建立帳本頁面_SRS.md  
**相關文件**: P019_帳本切換頁面_SRS.md、P021_建立帳本頁面_SRS.md
