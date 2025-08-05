
# P041 建立共享帳本（Create Shared Ledger Page）

**文件編號**: P041  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS SA Team  
**最後更新**: 2025-01-26

---

## 目次

1. [功能目的](#1-功能目的purpose)
2. [使用者故事](#2-使用者故事user-story)
3. [前置條件](#3-前置條件preconditions)
4. [功能流程](#4-功能流程user-flow--functional-flow)
5. [輸入項目](#5-輸入項目inputs)
6. [輸出項目](#6-輸出項目outputs--responses)
7. [驗證規則](#7-驗證規則validation-rules)
8. [錯誤處理](#8-錯誤處理error-handling)
9. [UI 元件與排版需求](#9-ui-元件與排版需求ui-requirements)
10. [API 規格](#10-api-規格api-specification)
11. [狀態與畫面切換](#11-狀態與畫面切換state-handling)
12. [安全性與權限檢查](#12-安全性與權限檢查security--access-control)
13. [其他補充需求](#13-其他補充需求others)

---

## 1. 功能目的（Purpose）

建立共享帳本頁面提供用戶建立多人協作記帳空間的功能，支援設定協作類型、成員權限、分享規則等，讓用戶能夠輕鬆建立適合不同場景的共享記帳帳本。

---

## 2. 使用者故事（User Story）

- 作為一位家庭主婦，我希望能建立家庭共享帳本，以便與家人一起管理家庭開支
- 作為項目負責人，我希望能建立項目共享帳本，以便團隊成員共同記錄項目費用
- 作為小組成員，我希望能建立朋友群共享帳本，以便大家一起記錄聚會開支

---

## 3. 前置條件（Preconditions）

- 用戶已登入LCAS系統
- 用戶具備建立共享帳本的權限
- 用戶具備有效的網路連線
- 系統已載入用戶的基本資訊和偏好設定

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 主要建立流程
1. 用戶進入建立共享帳本頁面
2. 選擇協作類型（家庭、團隊、項目、朋友群）
3. 填寫帳本基本資訊
4. 設定協作規則和權限
5. 選擇邀請方式
6. 預覽設定並確認建立

### 4.2 範本使用流程
1. 瀏覽可用的共享帳本範本
2. 選擇適合的範本
3. 自訂範本內容
4. 確認並建立帳本

### 4.3 進階設定流程
1. 設定成員權限級別
2. 配置自動化規則
3. 設定通知偏好
4. 配置資料備份選項

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 帳本名稱 | String | 必填，1-50字元 | 文字輸入框 | 共享帳本的名稱 |
| 協作類型 | Enum | 必填 | 單選按鈕 | 家庭、團隊、項目、朋友群 |
| 帳本描述 | String | 可選，最多200字元 | 多行文字框 | 帳本用途說明 |
| 隱私等級 | Enum | 必填 | 單選按鈕 | 私密、受保護、公開 |
| 最大成員數 | Integer | 必填，2-50 | 數字輸入框 | 允許的最大成員數 |
| 預設權限 | Enum | 必填 | 下拉選單 | 新成員的預設權限級別 |
| 範本選擇 | String | 可選 | 清單選擇 | 預設範本或自訂 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 建立成功
- 新建立的共享帳本基本資訊
- 分享連結和邀請碼
- 下一步操作建議
- 帳本管理連結

### 6.2 建立失敗
- 詳細的錯誤訊息
- 建議的修正方案
- 重試操作選項

### 6.3 即時預覽
- 帳本設定摘要
- 權限分配預覽
- 預估的使用場景

---

## 7. 驗證規則（Validation Rules）

### 7.1 必填欄位驗證
- 帳本名稱不能為空且長度符合限制
- 協作類型必須選擇
- 最大成員數必須在有效範圍內

### 7.2 格式驗證
- 帳本名稱不包含特殊符號
- 描述內容不包含敏感詞彙
- 邀請Email格式正確

### 7.3 邏輯驗證
- 權限設定的邏輯一致性
- 成員數與協作類型的合理性
- 隱私等級與分享方式的相容性

---

## 8. 錯誤處理（Error Handling）

### 8.1 表單驗證錯誤
- **必填欄位為空**: 高亮標示缺失欄位，顯示提示訊息
- **格式不正確**: 即時顯示格式要求，提供修正建議

### 8.2 系統錯誤
- **網路連線問題**: 暫存表單資料，顯示重試選項
- **伺服器錯誤**: 顯示錯誤代碼，提供客服聯絡方式

### 8.3 權限錯誤
- **建立權限不足**: 顯示權限說明，引導用戶升級帳戶
- **帳本數量限制**: 顯示目前限制，提供升級選項

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局
```
建立共享帳本頁面佈局:
┌─────────────────────────────┐
│ [← 返回]  建立共享帳本 [儲存草稿]│
├─────────────────────────────┤
│ 📋 基本資訊                 │
│ 帳本名稱: [____________]     │
│ 協作類型: ○家庭 ○團隊 ●項目  │
│ 描述說明: [____________]     │
├─────────────────────────────┤
│ 👥 協作設定                 │
│ 隱私等級: [受保護 ▼]         │
│ 最大成員: [10人 ▼]          │
│ 預設權限: [成員 ▼]           │
├─────────────────────────────┤
│ 🎯 使用範本 (可選)           │
│ ○ 無範本  ●家庭記帳範本      │
│ ○ 項目管理範本              │
├─────────────────────────────┤
│ ⚙️ 進階設定 (展開/收起)      │
│ ✓ 自動審核新成員            │
│ ✓ 啟用記帳通知              │
│ ✗ 允許匿名檢視              │
├─────────────────────────────┤
│ 📊 設定預覽                 │
│ 帳本類型: 項目協作           │
│ 成員上限: 10人              │
│ 建立後可邀請成員加入         │
├─────────────────────────────┤
│ [取消]          [建立帳本]   │
└─────────────────────────────┘
```

### 9.2 UI 元件清單

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 協作類型選擇器 | RadioGroup | 選擇協作類型 | 單選，影響後續設定 |
| 範本選擇卡片 | CardView | 選擇預設範本 | 可展開檢視範本詳情 |
| 進階設定面板 | ExpandableLayout | 顯示進階選項 | 可展開/收起 |
| 設定預覽卡片 | PreviewCard | 即時預覽設定 | 自動更新 |
| 建立按鈕 | Button | 執行建立操作 | 驗證通過後啟用 |

---

## 10. API 規格（API Specification）

### 10.1 建立共享帳本
**端點**: POST /app/shared/create  
**對應**: F019 建立共享帳本功能

**請求格式**:
```json
{
  "sharedLedgerInfo": {
    "ledgerName": "家庭月度預算",
    "description": "管理家庭每月收支",
    "collaborationType": "family",
    "privacyLevel": "protected",
    "templateId": "family_budget_template"
  },
  "collaborationSettings": {
    "maxMembers": 10,
    "autoApproval": true,
    "requireVerification": false,
    "allowGuestView": false,
    "dataRetentionDays": 365
  },
  "defaultPermissions": {
    "memberDefault": "member",
    "guestDefault": "viewer",
    "permissionInheritance": true,
    "customPermissions": {
      "canAddEntry": true,
      "canEditEntry": false,
      "canDeleteEntry": false,
      "canViewAll": true,
      "canExportData": false,
      "canInviteMember": false,
      "canManageBudget": false,
      "canViewReports": true,
      "canModifyCategories": false,
      "canAccessHistory": true
    }
  },
  "collaborationRules": {
    "entryApprovalRequired": false,
    "modificationWindowHours": 24,
    "largeAmountThreshold": 5000.0,
    "largeAmountApproval": true,
    "commentRequiredAmount": 1000.0
  },
  "notificationSettings": {
    "enableNotifications": true,
    "notifyOnNewMember": true,
    "notifyOnNewEntry": false,
    "notifyOnBudgetAlert": true,
    "channels": ["app", "email"]
  },
  "initialSetup": {
    "createDefaultCategories": true,
    "setupBudget": false,
    "inviteMembers": []
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "sharedLedger": {
      "ledgerId": "shared_001",
      "ledgerName": "家庭月度預算",
      "collaborationType": "family",
      "ownerUid": "user_123",
      "createdAt": "2025-01-26T10:00:00Z",
      "shareCode": "FAM2025",
      "inviteLink": "https://app.lcas.com/invite/shared_001"
    },
    "collaborationSetup": {
      "maxMembers": 10,
      "currentMembers": 1,
      "permissionLevels": 3,
      "activeRules": 4,
      "autoSyncEnabled": true
    },
    "nextSteps": [
      {
        "action": "invite_members",
        "description": "邀請家庭成員加入",
        "url": "/shared/shared_001/invite"
      },
      {
        "action": "setup_budget",
        "description": "設定家庭預算",
        "url": "/shared/shared_001/budget"
      }
    ],
    "quickActions": [
      "invite_member",
      "add_first_entry",
      "setup_categories"
    ]
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態
- **初始狀態**: 顯示空白表單，載入可用範本
- **填寫中**: 即時驗證輸入，更新預覽
- **建立中**: 顯示進度指示器，禁用表單
- **建立完成**: 顯示成功頁面，提供下一步操作

### 11.2 表單狀態
- **草稿儲存**: 自動儲存表單內容
- **驗證狀態**: 即時驗證並顯示錯誤
- **送出狀態**: 防止重複送出

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 建立權限檢查
- 驗證用戶是否有建立共享帳本的權限
- 檢查用戶帳戶的帳本數量限制
- 驗證協作類型的權限需求

### 12.2 資料安全保護
- 驗證輸入資料的安全性
- 防止惡意程式碼注入
- 加密敏感設定資訊

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- 表單即時驗證響應時間 < 500ms
- 範本載入時間 < 1秒
- 帳本建立完成時間 < 3秒

### 13.2 無障礙設計
- 支援鍵盤導航
- 提供表單欄位語音描述
- 支援高對比度顯示模式

### 13.3 多語言支援
- 支援繁體中文、簡體中文、英文
- 本地化協作類型和權限描述
- 動態切換介面語言

### 13.4 後續擴充
- 支援匯入現有帳本資料
- 整合第三方認證服務
- 新增協作帳本範本市集

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS SA Team | 初始版本，建立建立共享帳本頁面SRS |
