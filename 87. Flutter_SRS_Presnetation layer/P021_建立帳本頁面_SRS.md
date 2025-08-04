
# P021_建立帳本頁面_SRS

**文件編號**: P021_SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 18:15:00 UTC+8

---

## 1. 功能目的（Purpose）

建立帳本頁面提供使用者建立新帳本的完整功能，支援個人帳本、協作帳本、專案帳本的建立，包含基本設定、成員邀請、權限配置，以及範本選擇等進階功能。

### 核心功能
- **帳本類型選擇**: 個人、協作、專案帳本建立
- **基本資訊設定**: 名稱、描述、貨幣、隱私設定
- **成員管理**: 邀請成員、設定角色、權限配置
- **範本應用**: 選擇預設範本或自訂設定
- **進階設定**: 預算設定、科目配置、提醒設定

---

## 2. 使用者故事（User Story）

**主要使用者故事**:
```
作為一個需要分類管理財務的使用者
我想要建立不同用途的帳本
以便更好地組織我的收支記錄

作為一個團隊協作的使用者
我想要建立共享帳本並邀請成員
以便與他人協同管理財務
```

**具體場景**:
- 建立個人旅遊預算帳本
- 創建家庭共同支出帳本
- 設立專案經費管理帳本
- 邀請家人加入家庭帳本
- 設定不同成員的權限等級

---

## 3. 前置條件（Preconditions）

### 使用者狀態
- [x] 使用者已完成登入驗證
- [x] 使用者具備建立帳本的權限
- [x] 使用者尚未達到帳本數量上限

### 系統狀態  
- [x] 網路連線正常
- [x] 帳本服務可用
- [x] 邀請服務正常運作

### 資料前置條件
- [x] 帳本範本資料已載入
- [x] 預設科目資料可用
- [x] 貨幣清單已更新

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要建立流程
```
帳本建立流程:
選擇類型 → 基本設定 → 成員設定 → 進階配置 → 確認建立 → 建立完成

詳細步驟:
1. 使用者選擇帳本類型：
   - 個人帳本：個人使用，完全私密
   - 協作帳本：多人共享，權限管理
   - 專案帳本：有期限的專案記帳
2. 填寫基本資訊：
   - 帳本名稱（必填）
   - 帳本描述（可選）
   - 預設貨幣（必填）
   - 隱私設定（可選）
3. 成員設定（協作/專案帳本）：
   - 邀請成員（Email）
   - 設定成員角色
   - 配置權限範圍
4. 進階配置（可選）：
   - 選擇帳本範本
   - 設定初始科目
   - 配置預算規則
   - 設定提醒功能
5. 預覽並確認設定
6. 系統建立帳本並發送邀請
7. 導向新建立的帳本
```

### 4.2 範本選擇流程
```
範本選擇流程:
1. 進入進階設定步驟
2. 選擇「使用範本」選項
3. 瀏覽可用範本：
   - 個人理財範本
   - 家庭預算範本
   - 旅遊支出範本
   - 專案經費範本
4. 預覽範本內容：
   - 預設科目配置
   - 預算類別設定
   - 提醒規則設定
5. 選擇範本並自訂調整
6. 應用範本設定
```

---

## 5. 輸入項目（Inputs）

### 5.1 基本資訊
| 欄位名稱 | 資料型別 | 必填 | 長度限制 | 說明 |
|----------|----------|------|----------|------|
| ledgerName | String | 是 | 1-50字元 | 帳本名稱 |
| ledgerType | Enum | 是 | personal/shared/project | 帳本類型 |
| description | String | 否 | 0-200字元 | 帳本描述 |
| currency | String | 是 | 3字元 | ISO 4217貨幣代碼 |
| isPrivate | Boolean | 否 | - | 是否為私人帳本 |
| iconId | String | 否 | - | 帳本圖示ID |
| colorTheme | String | 否 | - | 主題色彩代碼 |

### 5.2 成員設定
| 欄位名稱 | 資料型別 | 必填 | 說明 |
|----------|----------|------|------|
| members | Array<Object> | 否 | 成員清單 |
| members[].email | String | 是 | 成員Email地址 |
| members[].role | Enum | 是 | owner/admin/member/viewer |
| members[].permissions | Array<String> | 否 | 詳細權限清單 |
| allowPublicJoin | Boolean | 否 | 是否允許公開加入 |
| requireApproval | Boolean | 否 | 是否需要核准加入 |

### 5.3 進階設定
| 欄位名稱 | 資料型別 | 必填 | 說明 |
|----------|----------|------|------|
| templateId | String | 否 | 使用的範本ID |
| initialCategories | Array<String> | 否 | 初始科目清單 |
| budgetSettings | Object | 否 | 預算設定 |
| notificationSettings | Object | 否 | 提醒設定 |
| projectEndDate | Date | 否 | 專案結束日期（專案帳本） |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 帳本建立回應
```json
{
  "success": true,
  "data": {
    "ledger": {
      "ledgerId": "LED_2025_001",
      "name": "家庭預算帳本",
      "type": "shared",
      "description": "家庭月度收支管理",
      "currency": "TWD",
      "isPrivate": false,
      "iconId": "family",
      "colorTheme": "#4CAF50",
      "createdDate": "2025-01-26T18:15:00Z",
      "createdBy": "USER001",
      "memberCount": 3,
      "role": "owner"
    },
    "invitations": [
      {
        "inviteId": "INV_001",
        "email": "spouse@example.com",
        "role": "admin",
        "status": "sent",
        "sentDate": "2025-01-26T18:15:00Z",
        "expiryDate": "2025-02-02T18:15:00Z"
      },
      {
        "inviteId": "INV_002", 
        "email": "child@example.com",
        "role": "member",
        "status": "sent",
        "sentDate": "2025-01-26T18:15:00Z",
        "expiryDate": "2025-02-02T18:15:00Z"
      }
    ],
    "appliedTemplate": {
      "templateId": "TMPL_FAMILY_001",
      "name": "家庭預算範本",
      "appliedCategories": 12,
      "appliedBudgets": 5
    }
  },
  "message": "帳本建立成功，邀請已發送"
}
```

### 6.2 範本清單回應
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "templateId": "TMPL_PERSONAL_001",
        "name": "個人理財範本",
        "description": "適合個人日常理財管理",
        "type": "personal",
        "categoryCount": 15,
        "budgetCount": 8,
        "isPopular": true,
        "preview": {
          "categories": ["餐飲費", "交通費", "娛樂費"],
          "budgets": ["月度生活費", "娛樂預算"]
        }
      }
    ]
  }
}
```

---

## 7. 驗證規則（Validation Rules）

### 7.1 基本資訊驗證
- **帳本名稱**: 1-50字元，不可包含特殊符號，同使用者下不可重複
- **帳本描述**: 最大200字元，可包含基本標點符號
- **貨幣代碼**: 必須為有效的ISO 4217代碼
- **圖示和主題**: 必須為系統提供的有效選項

### 7.2 成員設定驗證  
- **Email格式**: 有效的Email地址格式
- **成員數量**: 協作帳本最多50名成員，專案帳本最多20名
- **角色設定**: 必須至少有一名擁有者
- **重複邀請**: 同一Email不可重複邀請

### 7.3 業務規則驗證
- **帳本數量**: 個人使用者最多建立10個帳本
- **專案日期**: 專案結束日期不可早於當前日期
- **權限一致性**: 角色與權限設定必須一致
- **範本相容性**: 所選範本必須與帳本類型相容

---

## 8. 錯誤處理（Error Handling）

### 8.1 輸入驗證錯誤
| 錯誤碼 | 錯誤訊息 | 處理方式 |
|--------|----------|----------|
| CL001 | 帳本名稱不可為空 | 高亮必填欄位並顯示提示 |
| CL002 | 帳本名稱已存在 | 建議替代名稱 |
| CL003 | 無效的貨幣代碼 | 提供貨幣選擇清單 |
| CL004 | Email格式錯誤 | 標示錯誤Email並要求修正 |

### 8.2 業務邏輯錯誤
| 錯誤碼 | 錯誤訊息 | 處理方式 |
|--------|----------|----------|
| CL101 | 帳本數量已達上限 | 提示升級方案或管理現有帳本 |
| CL102 | 成員數量超過限制 | 顯示限制說明並要求調整 |
| CL103 | 專案日期設定錯誤 | 自動調整為合理日期 |

### 8.3 系統錯誤
- **建立失敗**: 保存草稿並提供重試選項
- **邀請發送失敗**: 標記失敗邀請並提供重新發送
- **範本載入失敗**: 提供基本設定選項

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局
```
建立帳本頁面佈局:
┌─────────────────────────────┐
│ [✕ 取消]  建立帳本    [1/4] │
├─────────────────────────────┤
│ 📝 選擇帳本類型              │
├─────────────────────────────┤
│ ┌─────────┐ ┌─────────┐     │
│ │ 🏠 個人 │ │👨‍👩‍👧‍👦 協作│     │
│ │ 帳本    │ │ 帳本    │     │
│ └─────────┘ └─────────┘     │
│                             │
│ ┌─────────┐                 │
│ │ 💼 專案 │                 │
│ │ 帳本    │                 │
│ └─────────┘                 │
├─────────────────────────────┤
│ 💡 個人帳本適合日常理財管理  │
├─────────────────────────────┤
│ [上一步]           [下一步] │
└─────────────────────────────┘
```

### 9.2 基本設定步驟
```
基本設定頁面:
┌─────────────────────────────┐
│ [← 返回]  基本設定    [2/4] │
├─────────────────────────────┤
│ 帳本名稱 *                  │
│ [家庭預算帳本              ] │
├─────────────────────────────┤
│ 帳本描述                    │
│ [家庭月度收支管理...       ] │
├─────────────────────────────┤
│ 預設貨幣 *        [TWD ▼]   │
├─────────────────────────────┤
│ 帳本圖示                    │
│ 🏠 👨‍👩‍👧‍👦 💼 🎯 📊 ⭐     │
├─────────────────────────────┤
│ 隱私設定                    │
│ ○ 公開帳本  ● 私人帳本      │
├─────────────────────────────┤
│ [上一步]           [下一步] │
└─────────────────────────────┘
```

### 9.3 關鍵UI元件
- **步驟指示器**: 顯示建立進度
- **類型選擇卡片**: 視覺化的帳本類型選擇
- **表單驗證**: 即時輸入驗證與錯誤提示
- **成員管理**: 動態新增/移除成員介面
- **範本預覽**: 範本內容的視覺化預覽

---

## 10. API 規格（API Specification）

### 10.1 獲取範本清單
```http
GET /api/v1/ledger-templates
Headers: Authorization: Bearer {token}
Query Parameters:
  - type: string (personal/shared/project)
  - category: string (finance/travel/project)
```

### 10.2 建立帳本
```http
POST /api/v1/ledgers
Headers: Authorization: Bearer {token}
Body: {
  "name": "string",
  "type": "personal|shared|project",
  "description": "string",
  "currency": "string",
  "isPrivate": boolean,
  "iconId": "string",
  "colorTheme": "string",
  "members": [
    {
      "email": "string",
      "role": "owner|admin|member|viewer",
      "permissions": ["string"]
    }
  ],
  "templateId": "string",
  "initialCategories": ["string"],
  "budgetSettings": {},
  "notificationSettings": {},
  "projectEndDate": "date"
}
```

### 10.3 預覽範本
```http
GET /api/v1/ledger-templates/{templateId}/preview
Headers: Authorization: Bearer {token}
```

### 10.4 驗證帳本名稱
```http
POST /api/v1/ledgers/validate-name
Headers: Authorization: Bearer {token}
Body: {
  "name": "string"
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 建立流程狀態
```typescript
interface CreateLedgerState {
  currentStep: number;
  totalSteps: number;
  ledgerType: LedgerType;
  basicInfo: BasicLedgerInfo;
  memberSettings: MemberSettings;
  advancedSettings: AdvancedSettings;
  selectedTemplate: Template | null;
  isCreating: boolean;
  validationErrors: ValidationError[];
}
```

### 11.2 步驟切換邏輯
- **步驟驗證**: 每步完成前驗證必填欄位
- **資料保存**: 每步資料暫存到本地狀態
- **進度追蹤**: 視覺化顯示建立進度
- **錯誤處理**: 步驟間的錯誤狀態傳遞

### 11.3 動態表單管理
- **條件顯示**: 依據帳本類型顯示不同欄位
- **動態驗證**: 即時驗證與錯誤提示
- **草稿保存**: 自動保存未完成的表單
- **範本應用**: 範本選擇後的表單自動填充

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 建立權限驗證
- **帳本數量限制**: 檢查使用者帳本建立額度
- **角色權限**: 驗證使用者建立特定類型帳本的權限
- **邀請權限**: 檢查邀請成員的權限範圍

### 12.2 資料安全
- **輸入清理**: 所有文字輸入的XSS過濾
- **Email驗證**: 邀請Email的格式與存在性驗證
- **權限設定**: 確保權限設定的安全性

### 12.3 操作安全
- **建立頻率**: 限制帳本建立的頻率
- **邀請限制**: 限制邀請發送的頻率和數量
- **敏感操作**: 重要設定變更的確認機制

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- **頁面載入時間**: < 2秒
- **步驟切換**: < 300ms
- **建立完成時間**: < 5秒
- **範本預覽**: < 1秒

### 13.2 使用體驗
- **智能建議**: 基於使用習慣的範本推薦
- **快速建立**: 提供常用設定的快速建立選項
- **草稿恢復**: 未完成建立的草稿恢復功能
- **批量邀請**: 支援批量匯入成員Email

### 13.3 無障礙支援
- **鍵盤導航**: 完整的鍵盤操作支援
- **螢幕閱讀器**: 表單標籤與錯誤訊息朗讀
- **高對比**: 適配高對比顯示模式
- **字體縮放**: 支援系統字體大小設定

### 13.4 多語言支援
- **介面本地化**: 支援繁體中文、簡體中文、英文
- **範本本地化**: 範本名稱與描述的多語言版本
- **錯誤訊息**: 多語言錯誤提示訊息
- **幫助說明**: 建立流程的多語言說明

---

**文件狀態**: ✅ 已完成  
**下一階段**: P022_帳本設定頁面_SRS.md  
**相關文件**: P020_帳本清單頁面_SRS.md、P022_帳本設定頁面_SRS.md
