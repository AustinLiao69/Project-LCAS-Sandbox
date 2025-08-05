
# P042 協作成員管理（Collaboration Member Management Page）

**文件編號**: P042  
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

協作成員管理頁面提供帳本管理者管理共享帳本成員的完整功能，包括檢視成員清單、調整成員權限、移除成員、管理邀請狀態等，確保協作帳本的成員管理安全有序。

---

## 2. 使用者故事（User Story）

- 作為帳本管理者，我希望能檢視所有成員的詳細資訊和權限，以便了解協作帳本的成員狀態
- 作為帳本擁有者，我希望能調整成員的權限級別，以便控制不同成員的操作範圍
- 作為協作管理員，我希望能移除不活躍的成員，以便維護協作帳本的活躍度

---

## 3. 前置條件（Preconditions）

- 用戶已登入LCAS系統
- 用戶具備該共享帳本的管理權限
- 共享帳本存在且狀態正常
- 用戶具備有效的網路連線

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 成員清單檢視流程
1. 進入協作成員管理頁面
2. 載入當前帳本的所有成員資訊
3. 顯示成員清單和權限狀態
4. 提供成員篩選和搜尋功能

### 4.2 權限管理流程
1. 選擇要調整權限的成員
2. 檢視當前權限設定
3. 修改權限級別或特定權限
4. 確認變更並發送通知

### 4.3 成員移除流程
1. 選擇要移除的成員
2. 確認移除操作和影響
3. 執行移除並處理相關資料
4. 發送移除通知

### 4.4 邀請管理流程
1. 檢視待處理的邀請
2. 管理邀請狀態（取消、重發）
3. 設定邀請過期時間
4. 追蹤邀請接受狀態

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 成員搜尋 | String | 可選 | 搜尋框 | 依名稱或Email搜尋 |
| 權限篩選 | Enum | 可選 | 下拉選單 | 篩選特定權限級別 |
| 狀態篩選 | Enum | 可選 | 多選框 | 活躍、邀請中、暫停 |
| 新權限級別 | Enum | 必填 | 單選按鈕 | 調整權限時使用 |
| 移除原因 | String | 可選 | 文字框 | 移除成員時的原因 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 成員清單資訊
- 成員基本資訊（姓名、頭像、Email）
- 加入時間和最後活動時間
- 當前權限級別和特定權限
- 成員狀態（活躍、邀請中、暫停）

### 6.2 權限操作結果
- 權限變更成功確認
- 受影響的功能清單
- 通知發送狀態

### 6.3 統計資訊
- 總成員數和各權限級別分布
- 活躍成員數和邀請待確認數
- 最近的成員活動摘要

---

## 7. 驗證規則（Validation Rules）

### 7.1 權限驗證
- 僅管理者可調整成員權限
- 不能降低自己的權限級別
- 至少保留一個擁有者權限的成員

### 7.2 操作驗證
- 確認成員存在且狀態有效
- 驗證權限變更的合理性
- 檢查移除操作的影響

### 7.3 資料完整性
- 確保成員資料的一致性
- 驗證邀請狀態的有效性
- 檢查權限設定的邏輯正確性

---

## 8. 錯誤處理（Error Handling）

### 8.1 權限錯誤
- **操作權限不足**: 顯示權限要求，提示聯絡管理者
- **權限衝突**: 說明衝突原因，提供解決建議

### 8.2 操作錯誤
- **成員不存在**: 更新成員清單，移除無效項目
- **移除失敗**: 顯示失敗原因，提供重試選項

### 8.3 網路錯誤
- **載入失敗**: 提供重試機制，顯示快取資料
- **同步問題**: 標示同步狀態，提供手動同步

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局
```
協作成員管理頁面佈局:
┌─────────────────────────────┐
│ [← 返回]  成員管理   [+ 邀請] │
├─────────────────────────────┤
│ 🔍 [搜尋成員...] [篩選 ▼]    │
├─────────────────────────────┤
│ 📊 成員概覽 (5/10)           │
│ 👑 1個擁有者 • 👥 3個成員    │
│ 📩 1個邀請待確認             │
├─────────────────────────────┤
│ 👤 成員清單                 │
│ ┌─────────────────────────┐ │
│ │ 👨 小明 (擁有者)    [更多⋯] │ │
│ │    joined@example.com   │ │
│ │    加入於: 2週前        │ │
│ │    最後活動: 1小時前    │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 👩 小華 (管理員)    [更多⋯] │ │
│ │    admin@example.com    │ │
│ │    加入於: 1週前        │ │
│ │    最後活動: 3小時前    │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 📩 待處理邀請               │
│ • 小李 (member@example.com) │
│   邀請於: 2天前 [重發][取消] │
└─────────────────────────────┘
```

### 9.2 UI 元件清單

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 成員卡片 | CardView | 顯示成員資訊 | 點選檢視詳情 |
| 權限標籤 | Chip | 顯示權限級別 | 點選修改權限 |
| 操作選單 | PopupMenu | 成員操作選項 | 長按或點選更多 |
| 篩選工具 | FilterChip | 篩選成員 | 多選篩選條件 |
| 邀請清單 | RecyclerView | 顯示待處理邀請 | 滑動操作 |

---

## 10. API 規格（API Specification）

### 10.1 取得成員清單
**端點**: GET /app/shared/members  
**對應**: F020 多人協作權限功能

**請求格式**:
```json
{
  "ledgerId": "shared_001",
  "includeInvitations": true,
  "includeActivity": true,
  "filter": {
    "permissionLevel": "all",
    "status": "all",
    "searchKeyword": ""
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "memberSummary": {
      "totalMembers": 5,
      "maxMembers": 10,
      "ownerCount": 1,
      "adminCount": 1,
      "memberCount": 3,
      "pendingInvitations": 1
    },
    "members": [
      {
        "userId": "user_001",
        "displayName": "小明",
        "email": "ming@example.com",
        "profilePicture": "url",
        "permissionLevel": "owner",
        "joinedAt": "2025-01-10T10:00:00Z",
        "lastActivity": "2025-01-26T09:00:00Z",
        "status": "active",
        "specificPermissions": {
          "canAddEntry": true,
          "canEditEntry": true,
          "canDeleteEntry": true,
          "canViewAll": true,
          "canExportData": true,
          "canInviteMember": true,
          "canManageBudget": true,
          "canViewReports": true,
          "canModifyCategories": true,
          "canAccessHistory": true
        }
      }
    ],
    "pendingInvitations": [
      {
        "invitationId": "inv_001",
        "email": "newmember@example.com",
        "permissionLevel": "member",
        "invitedAt": "2025-01-24T10:00:00Z",
        "expiresAt": "2025-02-07T10:00:00Z",
        "status": "pending"
      }
    ]
  }
}
```

### 10.2 更新成員權限
**端點**: PUT /app/shared/permissions  
**對應**: F020 多人協作權限功能

**請求格式**:
```json
{
  "ledgerId": "shared_001",
  "permissionUpdates": {
    "individualUpdates": [
      {
        "userId": "user_002",
        "action": "update_permission",
        "newPermissionLevel": "admin",
        "specificPermissions": {
          "canAddEntry": true,
          "canEditEntry": true,
          "canDeleteEntry": false,
          "canViewAll": true,
          "canExportData": true,
          "canInviteMember": true,
          "canManageBudget": false,
          "canViewReports": true,
          "canModifyCategories": false,
          "canAccessHistory": true
        },
        "reason": "升級為管理員"
      }
    ]
  },
  "notificationSettings": {
    "notifyUser": true,
    "notifyOtherAdmins": true
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態
- **載入中**: 顯示骨架屏載入成員資料
- **正常顯示**: 展示完整成員清單
- **無成員**: 顯示邀請成員的引導
- **錯誤狀態**: 顯示錯誤訊息和重試選項

### 11.2 操作狀態
- **權限變更中**: 顯示進度指示器
- **移除確認**: 顯示確認對話框
- **邀請處理中**: 更新邀請狀態

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 管理權限驗證
- 驗證用戶對該帳本的管理權限
- 檢查特定操作的權限需求
- 防止權限提升攻擊

### 12.2 資料保護
- 僅顯示有權限檢視的成員資訊
- 保護敏感的成員個人資料
- 記錄權限變更的稽核日誌

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- 成員清單載入時間 < 2秒
- 權限變更響應時間 < 1秒
- 支援大量成員的分頁載入

### 13.2 無障礙設計
- 支援螢幕閱讀器導航
- 提供權限級別的語音描述
- 支援鍵盤快捷鍵操作

### 13.3 多語言支援
- 支援權限級別的多語言顯示
- 本地化日期時間格式
- 動態語言切換

### 13.4 後續擴充
- 批量權限管理功能
- 成員活動分析報表
- 整合外部身份驗證系統

---

## 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| v1.0.0 | 2025-01-26 | LCAS SA Team | 初始版本，建立協作成員管理頁面SRS |
