
# P022_帳本設定頁面_SRS

**文件編號**: P022_SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 18:30:00 UTC+8

---

## 1. 功能目的（Purpose）

帳本設定頁面提供使用者完整的帳本配置管理功能，包含基本資訊修改、成員權限管理、進階功能設定、安全性配置，以及帳本生命週期管理。

### 核心功能
- **基本資訊管理**: 帳本名稱、描述、圖示、貨幣設定
- **成員權限管理**: 新增/移除成員、角色調整、權限配置
- **進階設定**: 預算規則、科目配置、提醒設定
- **安全性設定**: 隱私等級、存取控制、資料加密
- **帳本生命週期**: 歸檔、轉移擁有權、刪除帳本

---

## 2. 使用者故事（User Story）

**主要使用者故事**:
```
作為帳本擁有者
我想要管理帳本的各項設定
以便根據需求調整帳本功能

作為帳本管理員
我想要管理成員權限與帳本設定
以便確保帳本正常運作並維護安全
```

**具體場景**:
- 修改家庭帳本的名稱和描述
- 調整成員的角色權限
- 設定預算提醒和限制
- 配置帳本的隱私設定
- 歸檔不再使用的專案帳本

---

## 3. 前置條件（Preconditions）

### 使用者狀態
- [x] 使用者已完成登入驗證
- [x] 使用者對目標帳本具備設定權限（擁有者或管理員）
- [x] 帳本處於可編輯狀態

### 系統狀態  
- [x] 網路連線正常
- [x] 帳本服務可用
- [x] 權限驗證服務正常

### 資料前置條件
- [x] 帳本基本資料完整
- [x] 成員清單與權限資料已載入
- [x] 帳本歷史記錄可用

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要設定流程
```
帳本設定流程:
進入設定 → 選擇設定類別 → 修改設定 → 驗證變更 → 儲存更新 → 通知相關成員

詳細步驟:
1. 使用者進入帳本設定頁面：
   - 從帳本清單點擊設定按鈕
   - 從帳本內頁點擊設定選項
2. 系統載入帳本設定資料
3. 使用者選擇設定類別：
   - 基本資訊設定
   - 成員管理
   - 進階功能設定
   - 安全性與隱私
   - 帳本管理
4. 修改相關設定：
   - 即時驗證輸入資料
   - 顯示變更預覽
   - 確認影響範圍
5. 儲存設定變更：
   - 執行資料驗證
   - 更新帳本配置
   - 記錄變更歷史
6. 通知相關成員（如有需要）
```

### 4.2 成員管理流程
```
成員管理流程:
1. 進入成員管理分頁
2. 檢視現有成員清單：
   - 成員資訊與角色
   - 加入日期與活動狀態
   - 權限範圍詳情
3. 執行成員操作：
   - 邀請新成員
   - 調整成員角色
   - 修改權限設定
   - 移除成員
4. 確認變更並通知相關成員
```

---

## 5. 輸入項目（Inputs）

### 5.1 基本資訊設定
| 欄位名稱 | 資料型別 | 必填 | 長度限制 | 說明 |
|----------|----------|------|----------|------|
| ledgerName | String | 是 | 1-50字元 | 帳本名稱 |
| description | String | 否 | 0-200字元 | 帳本描述 |
| iconId | String | 否 | - | 帳本圖示ID |
| colorTheme | String | 否 | - | 主題色彩代碼 |
| currency | String | 是 | 3字元 | 預設貨幣代碼 |
| timeZone | String | 否 | - | 時區設定 |
| locale | String | 否 | - | 地區設定 |

### 5.2 成員管理設定
| 欄位名稱 | 資料型別 | 必填 | 說明 |
|----------|----------|------|------|
| memberUpdates | Array<Object> | 否 | 成員更新清單 |
| memberUpdates[].userId | String | 是 | 成員使用者ID |
| memberUpdates[].action | Enum | 是 | add/update/remove |
| memberUpdates[].newRole | Enum | 否 | owner/admin/member/viewer |
| memberUpdates[].permissions | Array<String> | 否 | 詳細權限清單 |
| inviteEmails | Array<String> | 否 | 新邀請成員Email |

### 5.3 進階功能設定
| 欄位名稱 | 資料型別 | 必填 | 說明 |
|----------|----------|------|------|
| budgetSettings | Object | 否 | 預算設定配置 |
| notificationSettings | Object | 否 | 提醒設定配置 |
| categorySettings | Object | 否 | 科目設定配置 |
| backupSettings | Object | 否 | 備份設定配置 |
| syncSettings | Object | 否 | 同步設定配置 |

### 5.4 安全性設定
| 欄位名稱 | 資料型別 | 必填 | 說明 |
|----------|----------|------|------|
| privacyLevel | Enum | 否 | public/protected/private |
| requireApproval | Boolean | 否 | 是否需要核准加入 |
| allowPublicView | Boolean | 否 | 是否允許公開檢視 |
| dataEncryption | Boolean | 否 | 是否啟用資料加密 |
| accessRestriction | Object | 否 | 存取限制設定 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 設定更新回應
```json
{
  "success": true,
  "data": {
    "ledger": {
      "ledgerId": "LED001",
      "name": "更新後的帳本名稱",
      "description": "更新後的描述",
      "iconId": "new_family",
      "colorTheme": "#2196F3",
      "currency": "TWD",
      "lastModified": "2025-01-26T18:30:00Z",
      "modifiedBy": "USER001"
    },
    "changes": [
      {
        "field": "name",
        "oldValue": "原帳本名稱",
        "newValue": "更新後的帳本名稱",
        "timestamp": "2025-01-26T18:30:00Z"
      },
      {
        "field": "description",
        "oldValue": "原描述",
        "newValue": "更新後的描述",
        "timestamp": "2025-01-26T18:30:00Z"
      }
    ],
    "notifications": [
      {
        "recipientId": "USER002",
        "type": "ledger_settings_updated",
        "message": "帳本設定已更新",
        "sent": true
      }
    ]
  },
  "message": "帳本設定更新成功"
}
```

### 6.2 成員管理回應
```json
{
  "success": true,
  "data": {
    "memberUpdates": [
      {
        "userId": "USER003",
        "action": "role_updated",
        "oldRole": "member",
        "newRole": "admin",
        "updatedBy": "USER001",
        "timestamp": "2025-01-26T18:30:00Z"
      }
    ],
    "newInvitations": [
      {
        "inviteId": "INV_003",
        "email": "newmember@example.com",
        "role": "member",
        "status": "sent",
        "expiryDate": "2025-02-02T18:30:00Z"
      }
    ],
    "currentMembers": [
      {
        "userId": "USER001",
        "name": "張小明",
        "email": "user001@example.com",
        "role": "owner",
        "joinDate": "2025-01-01T00:00:00Z",
        "lastActive": "2025-01-26T18:30:00Z",
        "permissions": ["all"]
      }
    ]
  },
  "message": "成員管理更新成功"
}
```

---

## 7. 驗證規則（Validation Rules）

### 7.1 基本資訊驗證
- **帳本名稱**: 1-50字元，不可包含特殊符號，同使用者下不可重複
- **帳本描述**: 最大200字元，可包含基本標點符號和換行
- **貨幣代碼**: 必須為有效的ISO 4217代碼
- **主題色彩**: 必須為有效的十六進制色彩代碼

### 7.2 權限驗證  
- **操作權限**: 僅擁有者和管理員可修改設定
- **成員管理權限**: 不可降低自己的權限等級
- **角色調整限制**: 擁有者角色僅能轉移，不可刪除
- **最少擁有者**: 帳本必須至少有一名擁有者

### 7.3 業務規則驗證
- **成員數量限制**: 根據帳本類型限制最大成員數
- **設定相依性**: 某些設定間的相依性檢查
- **歷史記錄**: 重要變更需記錄變更歷史
- **通知設定**: 驗證通知設定的有效性

---

## 8. 錯誤處理（Error Handling）

### 8.1 權限錯誤
| 錯誤碼 | 錯誤訊息 | 處理方式 |
|--------|----------|----------|
| LS001 | 無權限修改此設定 | 顯示權限不足提示 |
| LS002 | 無法降低自己的權限 | 說明權限調整規則 |
| LS003 | 無法移除最後一位擁有者 | 建議先轉移擁有權 |

### 8.2 輸入驗證錯誤
| 錯誤碼 | 錯誤訊息 | 處理方式 |
|--------|----------|----------|
| LS101 | 帳本名稱不可為空 | 高亮必填欄位 |
| LS102 | 帳本名稱已存在 | 建議替代名稱 |
| LS103 | 無效的色彩代碼 | 提供色彩選擇器 |
| LS104 | 成員數量超過限制 | 顯示限制說明 |

### 8.3 系統錯誤
- **更新失敗**: 保留變更內容並提供重試選項
- **通知發送失敗**: 標記失敗通知並提供重新發送
- **資料衝突**: 顯示衝突內容並提供解決選項

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局
```
帳本設定頁面佈局:
┌─────────────────────────────┐
│ [← 返回]  帳本設定          │
├─────────────────────────────┤
│ [基本資訊] [成員] [進階] [安全]│
├─────────────────────────────┤
│ 📝 基本資訊                 │
├─────────────────────────────┤
│ 帳本名稱 *                  │
│ [家庭預算帳本              ] │
├─────────────────────────────┤
│ 帳本描述                    │
│ [家庭月度收支管理...       ] │
├─────────────────────────────┤
│ 帳本圖示                    │
│ 🏠 👨‍👩‍👧‍👦 💼 🎯 📊 ⭐     │
├─────────────────────────────┤
│ 預設貨幣      [TWD ▼]       │
├─────────────────────────────┤
│ 主題色彩                    │
│ 🟢 🔵 🟡 🔴 🟣 🟠           │
├─────────────────────────────┤
│           [儲存變更]        │
└─────────────────────────────┘
```

### 9.2 成員管理分頁
```
成員管理分頁:
┌─────────────────────────────┐
│ 👥 成員管理 (3人)    [+ 邀請]│
├─────────────────────────────┤
│ 👤 張小明 (您)              │
│    user001@example.com      │
│    擁有者 • 2025/01/01 加入  │
├─────────────────────────────┤
│ 👤 李美麗          [設定 ⚙️]│
│    user002@example.com      │
│    管理員 • 2025/01/15 加入  │
├─────────────────────────────┤
│ 👤 王大明          [設定 ⚙️]│
│    user003@example.com      │
│    成員 • 2025/01/20 加入    │
├─────────────────────────────┤
│ 📧 待加入邀請 (1)            │
│    newuser@example.com      │
│    已發送 • 7天後到期        │
└─────────────────────────────┘
```

### 9.3 關鍵UI元件
- **分頁導航**: 基本資訊、成員管理、進階設定、安全性
- **表單控制項**: 文字輸入、下拉選單、色彩選擇器
- **成員清單**: 成員資訊卡片與操作選單
- **變更預覽**: 顯示修改前後的對比
- **權限指示器**: 視覺化的權限等級顯示

---

## 10. API 規格（API Specification）

### 10.1 獲取帳本設定
```http
GET /api/v1/ledgers/{ledgerId}/settings
Headers: Authorization: Bearer {token}
```

### 10.2 更新基本資訊
```http
PUT /api/v1/ledgers/{ledgerId}/basic-info
Headers: Authorization: Bearer {token}
Body: {
  "name": "string",
  "description": "string",
  "iconId": "string",
  "colorTheme": "string",
  "currency": "string",
  "timeZone": "string",
  "locale": "string"
}
```

### 10.3 管理成員
```http
POST /api/v1/ledgers/{ledgerId}/members/batch-update
Headers: Authorization: Bearer {token}
Body: {
  "memberUpdates": [
    {
      "userId": "string",
      "action": "add|update|remove",
      "newRole": "owner|admin|member|viewer",
      "permissions": ["string"]
    }
  ],
  "inviteEmails": ["string"],
  "notifyMembers": boolean
}
```

### 10.4 更新進階設定
```http
PUT /api/v1/ledgers/{ledgerId}/advanced-settings
Headers: Authorization: Bearer {token}
Body: {
  "budgetSettings": {},
  "notificationSettings": {},
  "categorySettings": {},
  "backupSettings": {},
  "syncSettings": {}
}
```

### 10.5 更新安全性設定
```http
PUT /api/v1/ledgers/{ledgerId}/security-settings
Headers: Authorization: Bearer {token}
Body: {
  "privacyLevel": "public|protected|private",
  "requireApproval": boolean,
  "allowPublicView": boolean,
  "dataEncryption": boolean,
  "accessRestriction": {}
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 設定頁面狀態
```typescript
interface LedgerSettingsState {
  ledgerId: string;
  currentTab: 'basic' | 'members' | 'advanced' | 'security';
  originalSettings: LedgerSettings;
  modifiedSettings: LedgerSettings;
  hasChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  validationErrors: ValidationError[];
  memberList: Member[];
  pendingInvitations: Invitation[];
}
```

### 11.2 變更追蹤
- **即時驗證**: 輸入變更時的即時驗證
- **變更標記**: 標示已修改但未儲存的欄位
- **衝突檢測**: 檢測與其他使用者的設定衝突
- **自動儲存**: 關鍵設定的自動儲存機制

### 11.3 成員狀態管理
- **成員清單**: 動態更新的成員清單狀態
- **邀請狀態**: 追蹤邀請的發送與回應狀態
- **權限變更**: 即時反映權限變更的影響
- **活動追蹤**: 成員活動狀態的即時更新

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 操作權限驗證
- **設定修改權限**: 僅擁有者和管理員可修改設定
- **成員管理權限**: 根據角色限制成員管理操作
- **敏感設定保護**: 關鍵設定需要額外驗證
- **權限降級保護**: 防止使用者意外降低自己的權限

### 12.2 資料安全
- **設定加密**: 敏感設定資料的加密存儲
- **變更日誌**: 完整記錄設定變更的安全日誌
- **存取控制**: 基於角色的細粒度存取控制
- **審計追蹤**: 設定變更的完整審計軌跡

### 12.3 操作安全
- **二次確認**: 重要操作需要二次確認
- **變更通知**: 重要設定變更的成員通知
- **回滾機制**: 支援設定變更的回滾功能
- **併發控制**: 防止多使用者同時修改設定

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **設定載入時間**: < 2秒
- **設定儲存時間**: < 3秒
- **成員清單載入**: < 1秒
- **即時驗證回應**: < 300ms

### 13.2 使用體驗
- **智能建議**: 基於使用模式的設定建議
- **批量操作**: 支援批量修改成員權限
- **設定範本**: 提供常用設定組合範本
- **變更預覽**: 設定變更的視覺化預覽

### 13.3 資料管理
- **設定備份**: 自動備份重要設定變更
- **版本控制**: 設定變更的版本管理
- **匯入匯出**: 支援設定的匯入與匯出
- **範本分享**: 允許分享設定範本給其他使用者

### 13.4 擴展功能
- **進階權限**: 支援更細粒度的權限控制
- **條件設定**: 基於條件的動態設定規則
- **整合設定**: 與第三方服務的整合設定
- **自動化規則**: 設定變更的自動化觸發規則

---

**文件狀態**: ✅ 已完成  
**下一階段**: P023_專案帳本詳情_SRS.md  
**相關文件**: P021_建立帳本頁面_SRS.md、P020_帳本清單頁面_SRS.md
