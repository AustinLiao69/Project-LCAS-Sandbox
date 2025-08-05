
# P021_成員管理頁面_SRS

**文件編號**: P021-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 16:00:00 UTC+8

---

## 1. 功能目的（Purpose）

P025成員管理頁面提供帳本成員的完整管理功能，包含成員邀請、角色權限設定、成員活動監控、權限調整等核心功能，作為多人協作帳本的成員管理中心。

**核心功能**：
- 成員列表檢視與管理
- 新成員邀請與審核
- 角色權限設定與調整
- 成員活動狀態監控
- 成員移除與權限回收
- 邀請連結生成與管理

## 2. 使用者故事（User Story）

### 主要使用者故事
```
作為帳本擁有者或管理員
我想要管理帳本的所有成員
以便控制帳本的存取權限和協作範圍
```

### 詳細使用者故事
1. **成員檢視**: 使用者可以查看所有帳本成員的詳細資訊和狀態
2. **邀請管理**: 使用者可以邀請新成員並管理待處理的邀請
3. **權限控制**: 使用者可以調整成員的角色和具體權限
4. **活動監控**: 使用者可以監控成員的活動狀態和最後活動時間
5. **成員移除**: 使用者可以移除不需要的成員並回收權限

## 3. 前置條件（Preconditions）

### 系統前置條件
- 使用者已完成登入驗證
- 使用者擁有帳本的管理權限（擁有者或管理員）
- 帳本為多人協作類型
- 網路連線狀態正常

### 資料前置條件
- 帳本ID必須有效且存在
- 使用者對該帳本具備成員管理權限
- 成員資料完整且可存取
- 權限設定資料正確

### 權限前置條件
- **管理權限**: 邀請、移除成員，調整權限
- **檢視權限**: 查看成員列表和基本資訊
- **審核權限**: 審核待加入的邀請申請

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
```
1. 系統驗證使用者身份和管理權限
2. 載入帳本基本資訊
3. 載入現有成員列表和角色
4. 載入待處理邀請清單
5. 載入成員活動狀態
6. 檢查操作權限並設定UI狀態
7. 渲染成員管理介面
```

### 4.2 成員邀請流程
```
1. 使用者點擊「邀請成員」按鈕
2. 系統檢查邀請權限和成員數量限制
3. 使用者選擇邀請方式：
   - Email邀請
   - 邀請連結分享
   - 掃描QR碼
4. 使用者設定新成員的預設角色
5. 系統產生邀請並發送通知
6. 更新待處理邀請清單
7. 記錄邀請操作日誌
```

### 4.3 權限調整流程
```
1. 使用者選擇目標成員
2. 系統檢查權限調整規則：
   - 不可調整自己的權限
   - 不可將擁有者權限給予他人
   - 檢查最小管理員數量
3. 使用者選擇新的角色或權限
4. 系統確認變更影響範圍
5. 執行權限變更
6. 通知相關成員
7. 記錄權限變更歷史
```

### 4.4 成員移除流程
```
1. 使用者選擇要移除的成員
2. 系統檢查移除限制：
   - 不可移除自己
   - 檢查成員是否有未完成的工作
   - 確認移除後的權限影響
3. 顯示移除確認對話框
4. 執行成員移除操作
5. 回收成員的所有權限
6. 通知相關成員
7. 更新成員列表
```

## 5. 輸入項目（Inputs）

### 5.1 路由參數
| 參數名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| ledgerId | String | 是 | 帳本ID |

### 5.2 成員邀請輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| inviteEmails | Array<String> | 否 | Email格式 | 邀請Email清單 |
| defaultRole | String | 是 | 有效角色值 | 預設角色 |
| personalMessage | String | 否 | 最大200字元 | 個人邀請訊息 |
| expiryDays | Number | 否 | 1-30天 | 邀請有效期限 |

### 5.3 權限調整輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| memberId | String | 是 | 有效用戶ID | 目標成員ID |
| newRole | String | 是 | 有效角色值 | 新角色 |
| permissions | Array<String> | 否 | 有效權限清單 | 詳細權限設定 |
| reason | String | 否 | 最大100字元 | 變更原因 |

### 5.4 篩選與搜尋輸入
| 欄位名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| searchKeyword | String | 否 | 成員姓名或Email搜尋 |
| roleFilter | String | 否 | 角色篩選條件 |
| statusFilter | String | 否 | 活動狀態篩選 |
| sortBy | String | 否 | 排序方式 |

## 6. 輸出項目（Outputs / Responses）

### 6.1 成員列表顯示
```typescript
interface LedgerMember {
  userId: string;
  displayName: string;
  email: string;
  avatar: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  joinDate: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
  invitedBy: string;
  contributionStats: {
    totalEntries: number;
    lastEntry: string;
    activityScore: number;
  };
}
```

### 6.2 邀請管理顯示
```typescript
interface LedgerInvitation {
  inviteId: string;
  email: string;
  role: string;
  status: 'sent' | 'pending' | 'accepted' | 'declined' | 'expired';
  sentDate: string;
  expiryDate: string;
  invitedBy: string;
  responseDate?: string;
  inviteLink?: string;
}
```

### 6.3 權限設定顯示
```typescript
interface RolePermissions {
  role: string;
  roleName: string;
  description: string;
  permissions: {
    read: boolean;
    write: boolean;
    invite: boolean;
    manage: boolean;
    admin: boolean;
  };
  restrictions: string[];
}
```

### 6.4 成員活動統計
```typescript
interface MemberActivityStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  roleDistribution: Record<string, number>;
  activityTrend: ActivityData[];
  topContributors: ContributorData[];
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 邀請驗證規則
- Email格式必須有效且未重複
- 邀請數量不可超過帳本類型限制
- 邀請角色必須低於或等於邀請者角色
- 邀請有效期限必須在合理範圍內

### 7.2 權限調整驗證
- 不可調整自己的權限等級
- 擁有者角色僅能轉移，不可降級
- 帳本必須至少保留一位管理員
- 權限變更必須符合角色階層規則

### 7.3 成員移除驗證
- 不可移除自己
- 擁有者必須先轉移擁有權才能被移除
- 檢查成員是否有進行中的重要操作
- 確認移除不會影響帳本正常運作

## 8. 錯誤處理（Error Handling）

### 8.1 權限錯誤處理
| 錯誤類型 | 錯誤代碼 | 處理方式 | 使用者訊息 |
|---------|---------|---------|-----------|
| 無管理權限 | MEMBER_NO_PERMISSION | 隱藏管理功能 | "您沒有權限管理成員" |
| 權限不足 | MEMBER_INSUFFICIENT_ROLE | 顯示權限說明 | "此操作需要管理員權限" |
| 自我操作限制 | MEMBER_SELF_OPERATION | 阻止操作並說明 | "無法對自己執行此操作" |

### 8.2 邀請錯誤處理
| 錯誤情境 | 處理策略 | 使用者體驗 |
|---------|---------|-----------|
| Email已存在 | 顯示警告並跳過 | 標示重複的Email |
| 邀請數量超限 | 阻止操作並說明限制 | 顯示目前限制和升級選項 |
| 發送失敗 | 保存邀請並提供重試 | 標示失敗項目和重試按鈕 |

### 8.3 資料同步錯誤
- **載入失敗**: 提供重試機制和離線模式
- **更新衝突**: 檢測衝突並提供解決選項
- **網路中斷**: 顯示離線狀態並支援離線操作

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
成員管理頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題
│   └── 邀請成員按鈕
├── 搜尋與篩選區域
│   ├── 搜尋輸入框
│   ├── 角色篩選器
│   └── 狀態篩選器
├── 統計摘要卡片
│   ├── 總成員數
│   ├── 活躍成員數
│   └── 待處理邀請
├── 成員列表區域
│   ├── 成員資訊卡片
│   │   ├── 頭像和基本資訊
│   │   ├── 角色標籤
│   │   ├── 活動狀態
│   │   └── 操作選單
│   └── 分頁控制項
├── 待處理邀請區域
│   ├── 邀請清單
│   ├── 邀請狀態
│   └── 重新發送操作
└── 操作彈窗
    ├── 邀請成員彈窗
    ├── 權限調整彈窗
    └── 移除確認彈窗
```

### 9.2 成員卡片設計
```
成員卡片佈局：
┌─────────────────────────────┐
│ 👤 張小明    [管理員] [⚙️] │
│    user@example.com         │
│    📅 2025/01/15 加入       │
│    🕐 3小時前活動           │
│    📊 本月記帳 15筆         │
└─────────────────────────────┘
```

### 9.3 視覺設計規範
- **角色標籤**: 不同顏色區分角色等級
- **活動狀態**: 綠點表示線上，灰點表示離線
- **權限圖示**: 直觀的權限等級視覺化
- **操作按鈕**: 基於權限動態顯示/隱藏

### 9.4 響應式設計
- **手機直向**: 成員卡片單欄排列
- **手機橫向**: 成員卡片雙欄排列
- **平板裝置**: 成員列表和邀請管理分欄顯示

## 10. API 規格（API Specification）

### 10.1 載入成員列表
```javascript
// API: ProjectLedgerService.getLedgerMembers()
GET /api/ledgers/{ledgerId}/members

Query Parameters:
- search: string (成員搜尋關鍵字)
- role: string (角色篩選)
- status: string (狀態篩選)
- page: number (分頁頁碼)
- limit: number (每頁數量)

Response 200:
{
  "success": true,
  "data": {
    "members": LedgerMember[],
    "invitations": LedgerInvitation[],
    "stats": MemberActivityStats,
    "pagination": PaginationInfo
  }
}
```

### 10.2 邀請新成員
```javascript
// API: ProjectLedgerService.inviteMembers()
POST /api/ledgers/{ledgerId}/invitations

Request Body:
{
  "emails": ["user1@example.com", "user2@example.com"],
  "defaultRole": "member",
  "personalMessage": "歡迎加入我們的帳本",
  "expiryDays": 7
}

Response 201:
{
  "success": true,
  "data": {
    "invitations": LedgerInvitation[],
    "failed": FailedInvitation[],
    "inviteLink": string
  }
}
```

### 10.3 調整成員權限
```javascript
// API: ProjectLedgerService.updateMemberRole()
PUT /api/ledgers/{ledgerId}/members/{memberId}/role

Request Body:
{
  "newRole": "admin",
  "permissions": ["read", "write", "invite"],
  "reason": "提升為管理員"
}

Response 200:
{
  "success": true,
  "data": {
    "member": LedgerMember,
    "changes": PermissionChange[]
  }
}
```

### 10.4 移除成員
```javascript
// API: ProjectLedgerService.removeMember()
DELETE /api/ledgers/{ledgerId}/members/{memberId}

Request Body:
{
  "reason": "不再參與此專案",
  "transferData": boolean
}

Response 200:
{
  "success": true,
  "data": {
    "removedMember": LedgerMember,
    "affectedData": DataTransferInfo
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface MemberManagementState {
  // 載入狀態
  isLoading: boolean;
  isMembersLoading: boolean;
  isInvitationsLoading: boolean;
  
  // 資料狀態
  members: LedgerMember[];
  invitations: LedgerInvitation[];
  stats: MemberActivityStats | null;
  
  // 篩選與搜尋狀態
  searchKeyword: string;
  roleFilter: string;
  statusFilter: string;
  currentPage: number;
  
  // UI狀態
  showInviteDialog: boolean;
  showRoleDialog: boolean;
  showRemoveDialog: boolean;
  selectedMember: LedgerMember | null;
  
  // 操作狀態
  isInviting: boolean;
  isUpdatingRole: boolean;
  isRemoving: boolean;
  
  // 錯誤狀態
  error: string | null;
  inviteErrors: Record<string, string>;
}
```

### 11.2 即時更新機制
- **成員狀態**: WebSocket監聽成員上線/離線狀態
- **邀請回應**: 即時更新邀請接受/拒絕狀態
- **權限變更**: 即時反映權限調整結果
- **活動追蹤**: 定期更新成員最後活動時間

### 11.3 離線支援
- **快取成員列表**: 支援離線檢視成員資訊
- **操作佇列**: 離線時的操作暫存並在上線後同步
- **衝突解決**: 處理離線期間的資料衝突

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 操作權限控制
- **角色階層**: 嚴格執行角色階層限制
- **操作記錄**: 完整記錄所有成員管理操作
- **權限檢查**: 每次操作前檢查使用者權限
- **敏感操作**: 重要操作需要二次確認

### 12.2 資料安全防護
- **成員資料**: 加密存儲敏感成員資訊
- **邀請連結**: 限時且一次性的安全邀請連結
- **權限變更**: 記錄完整的權限變更審計軌跡
- **存取控制**: 基於最小權限原則的存取控制

### 12.3 防護機制
- **邀請濫用**: 防止大量邀請和垃圾邀請
- **權限提升**: 防止未授權的權限提升攻擊
- **社交工程**: 防範社交工程攻擊的安全提示

## 13. 其他補充需求（Others）

### 13.1 效能最佳化需求
- **成員列表**: 大量成員時採用虛擬滾動
- **即時狀態**: 優化即時狀態更新頻率
- **圖片載入**: 成員頭像的懶載入和快取
- **搜尋效能**: 客戶端搜尋結合伺服器端篩選

### 13.2 使用體驗優化
- **批量操作**: 支援批量邀請和權限調整
- **智能建議**: 基於活動模式的角色建議
- **快速操作**: 常用操作的快捷方式
- **狀態反饋**: 清晰的操作狀態和結果反饋

### 13.3 無障礙設計需求
- **螢幕閱讀器**: 成員資訊的完整語音描述
- **鍵盤導航**: 支援完整的鍵盤操作
- **顏色對比**: 角色標籤符合對比度要求
- **字體縮放**: 支援系統字體大小設定

### 13.4 國際化需求
- **多語言**: 支援角色名稱和狀態的多語言
- **時區處理**: 正確顯示各地區的活動時間
- **文化差異**: 考慮不同文化的協作習慣
- **本地化通知**: 符合當地規範的邀請通知

---

**相關文件連結:**
- [P022_帳本設定頁面_SRS.md](./P022_帳本設定頁面_SRS.md) - 帳本基本設定
- [P023_專案帳本詳情_SRS.md](./P023_專案帳本詳情_SRS.md) - 專案帳本詳情
- [P026_權限設定頁面_SRS.md](./P026_權限設定頁面_SRS.md) - 權限詳細設定
- [9005. Flutter_Presentation layer.md](../90.%20Flutter_PRD/9005.%20Flutter_Presentation%20layer.md) - 視覺規格
- [9006. Flutter_AP layer.md](../90.%20Flutter_PRD/9006.%20Flutter_AP%20layer.md) - API規格
