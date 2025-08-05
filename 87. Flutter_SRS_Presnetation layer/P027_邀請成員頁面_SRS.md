
# P027_邀請成員頁面_SRS

**文件編號**: P027  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 16:30:00 UTC+8

---

## 1. 功能目的（Purpose）

P027邀請成員頁面提供便捷的成員邀請功能，支援多種邀請方式（Email邀請、連結分享、QR碼分享），讓帳本擁有者或管理員能夠快速邀請新成員加入協作帳本，並設定適當的權限等級。

**核心功能**：
- 多種邀請方式選擇
- 批量Email邀請
- 邀請連結生成與分享
- QR碼邀請功能
- 權限等級預設定
- 邀請訊息客製化

## 2. 使用者故事（User Story）

### 主要使用者故事
```
作為帳本管理員
我想要邀請新成員加入帳本
以便擴大協作範圍並分享記帳工作
```

### 詳細使用者故事
1. **Email邀請**: 使用者可以透過Email批量邀請多位成員
2. **連結分享**: 使用者可以生成邀請連結分享給目標成員
3. **QR碼邀請**: 使用者可以生成QR碼供現場邀請使用
4. **權限設定**: 使用者可以為被邀請者預設權限等級
5. **訊息客製**: 使用者可以添加個人化的邀請訊息

## 3. 前置條件（Preconditions）

### 系統前置條件
- 使用者已完成登入驗證
- 使用者擁有帳本的邀請權限（管理員或以上）
- 帳本為多人協作類型
- 網路連線狀態正常

### 資料前置條件
- 帳本ID必須有效且存在
- 使用者對該帳本具備邀請權限
- 帳本未達成員數量上限
- Email服務正常運作

### 權限前置條件
- **邀請權限**: 能夠邀請新成員加入帳本
- **設定權限**: 能夠設定被邀請者的預設權限
- **管理權限**: 能夠管理邀請連結和有效期

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
```
1. 系統驗證使用者邀請權限
2. 載入帳本基本資訊和成員限制
3. 載入可用權限等級清單
4. 載入邀請設定和預設值
5. 檢查Email服務狀態
6. 渲染邀請介面
```

### 4.2 Email邀請流程
```
1. 使用者選擇「Email邀請」方式
2. 使用者輸入被邀請者Email清單
3. 使用者選擇預設權限等級
4. 使用者輸入個人化邀請訊息
5. 使用者設定邀請有效期限
6. 系統驗證Email格式和重複性
7. 系統檢查帳本成員數量限制
8. 系統發送邀請Email
9. 更新邀請記錄並顯示結果
```

### 4.3 邀請連結生成流程
```
1. 使用者選擇「連結邀請」方式
2. 使用者設定連結有效期限
3. 使用者選擇預設權限等級
4. 使用者設定使用次數限制
5. 系統生成唯一邀請連結
6. 系統產生連結QR碼
7. 提供多種分享選項
8. 記錄連結創建日誌
```

### 4.4 QR碼邀請流程
```
1. 使用者選擇「QR碼邀請」方式
2. 系統自動生成邀請連結
3. 系統產生對應QR碼圖片
4. 使用者可預覽和調整QR碼大小
5. 提供保存和分享QR碼功能
6. 記錄QR碼生成和使用統計
```

## 5. 輸入項目（Inputs）

### 5.1 路由參數
| 參數名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| ledgerId | String | 是 | 帳本ID |
| inviteMode | String | 否 | 預設邀請方式 |

### 5.2 Email邀請輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| emails | Array<String> | 是 | Email格式，最多20個 | 被邀請者Email清單 |
| defaultRole | String | 是 | 有效角色值 | 預設權限等級 |
| personalMessage | String | 否 | 最大300字元 | 個人化邀請訊息 |
| expiryDays | Number | 否 | 1-30天，預設7天 | 邀請有效期限 |
| sendImmediately | Boolean | 否 | true/false | 是否立即發送 |

### 5.3 連結邀請輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| linkExpiryDays | Number | 否 | 1-90天，預設30天 | 連結有效期限 |
| usageLimit | Number | 否 | 1-100次，預設10次 | 使用次數限制 |
| linkRole | String | 是 | 有效角色值 | 連結預設權限 |
| requireApproval | Boolean | 否 | true/false | 是否需要審核 |

### 5.4 QR碼設定輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| qrSize | Number | 否 | 200-500px | QR碼尺寸 |
| qrColor | String | 否 | 有效顏色代碼 | QR碼顏色 |
| includeMessage | Boolean | 否 | true/false | 是否包含邀請訊息 |

## 6. 輸出項目（Outputs / Responses）

### 6.1 邀請結果顯示
```typescript
interface InvitationResult {
  successful: Array<{
    email: string;
    inviteId: string;
    status: 'sent' | 'queued';
  }>;
  failed: Array<{
    email: string;
    reason: string;
    errorCode: string;
  }>;
  duplicates: Array<{
    email: string;
    existingRole: string;
  }>;
  statistics: {
    totalAttempted: number;
    successCount: number;
    failureCount: number;
    duplicateCount: number;
  };
}
```

### 6.2 邀請連結資訊
```typescript
interface InvitationLink {
  linkId: string;
  inviteUrl: string;
  qrCodeUrl: string;
  expiryDate: string;
  usageLimit: number;
  currentUsage: number;
  defaultRole: string;
  requireApproval: boolean;
  createdDate: string;
  createdBy: string;
}
```

### 6.3 權限等級選項
```typescript
interface RoleOption {
  roleId: string;
  roleName: string;
  description: string;
  permissions: string[];
  isRecommended: boolean;
  restrictions: string[];
}
```

### 6.4 邀請統計資訊
```typescript
interface InvitationStats {
  totalInvitesSent: number;
  pendingInvitations: number;
  acceptedInvitations: number;
  expiredInvitations: number;
  dailyLimit: number;
  remainingToday: number;
  memberCapacity: {
    current: number;
    maximum: number;
    available: number;
  };
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 Email驗證規則
- Email格式必須符合RFC 5322標準
- 不可邀請已存在的成員
- 單次邀請數量不超過20個Email
- 檢查Email是否在黑名單中

### 7.2 權限設定驗證
- 預設權限不可高於邀請者權限
- 某些敏感權限需要特殊審核
- 檢查帳本類型是否支援該權限等級
- 驗證權限組合的合理性

### 7.3 邀請限制驗證
- 檢查帳本成員數量限制
- 檢查邀請者的每日邀請配額
- 驗證邀請有效期限合理性
- 檢查連結使用次數限制

## 8. 錯誤處理（Error Handling）

### 8.1 Email邀請錯誤
| 錯誤類型 | 錯誤代碼 | 處理方式 | 使用者訊息 |
|---------|---------|---------|-----------|
| Email格式錯誤 | INVALID_EMAIL_FORMAT | 標示錯誤Email | "Email格式不正確" |
| Email已存在 | EMAIL_ALREADY_MEMBER | 跳過並提醒 | "該Email已是成員" |
| 發送失敗 | EMAIL_SEND_FAILED | 重試機制 | "邀請發送失敗，請重試" |
| 配額超限 | DAILY_LIMIT_EXCEEDED | 阻止操作 | "今日邀請配額已用完" |

### 8.2 連結生成錯誤
| 錯誤情境 | 處理策略 | 使用者體驗 |
|---------|---------|-----------|
| 連結生成失敗 | 重試並記錄錯誤 | 顯示錯誤訊息和重試按鈕 |
| QR碼生成失敗 | 提供備用連結 | 隱藏QR碼選項，顯示文字連結 |
| 有效期設定錯誤 | 使用預設值 | 提示使用預設設定 |

### 8.3 權限錯誤處理
- **無邀請權限**: 隱藏邀請功能並顯示說明
- **權限設定錯誤**: 限制可選權限選項
- **成員數量上限**: 阻止邀請並提供升級選項

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
邀請成員頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題
│   └── 說明按鈕
├── 邀請方式選擇區
│   ├── Email邀請標籤
│   ├── 連結邀請標籤
│   └── QR碼邀請標籤
├── 邀請表單區域
│   ├── Email輸入區（Email模式）
│   ├── 連結設定區（連結模式）
│   ├── QR碼顯示區（QR碼模式）
│   ├── 權限設定區
│   ├── 邀請訊息輸入區
│   └── 有效期設定區
├── 邀請統計卡片
│   ├── 目前成員數
│   ├── 可邀請數量
│   └── 今日剩餘配額
├── 操作按鈕區域
│   ├── 發送邀請按鈕
│   ├── 預覽邀請按鈕
│   └── 重設表單按鈕
└── 邀請結果區域
    ├── 成功邀請清單
    ├── 失敗邀請清單
    └── 重試操作按鈕
```

### 9.2 邀請方式切換設計
```
邀請方式選擇：
┌─────────────────────────────────┐
│ [📧 Email] [🔗 連結] [📱 QR碼] │
└─────────────────────────────────┘
```

### 9.3 Email輸入區設計
```
Email邀請區域：
┌─────────────────────────────────┐
│ 📧 輸入Email地址（每行一個）     │
│ ┌─────────────────────────────┐ │
│ │ user1@example.com           │ │
│ │ user2@example.com           │ │
│ │ ...                         │ │
│ └─────────────────────────────┘ │
│ 💡 最多可輸入20個Email地址       │
└─────────────────────────────────┘
```

### 9.4 響應式設計
- **手機直向**: 邀請方式堆疊排列，表單單欄佈局
- **手機橫向**: 邀請方式水平排列，表單雙欄佈局
- **平板裝置**: 表單和統計資訊分欄顯示

## 10. API 規格（API Specification）

### 10.1 發送Email邀請
```javascript
// API: ProjectLedgerService.sendEmailInvitations()
POST /api/ledgers/{ledgerId}/invitations/email

Request Body:
{
  "emails": ["user1@example.com", "user2@example.com"],
  "defaultRole": "member",
  "personalMessage": "歡迎加入我們的記帳團隊！",
  "expiryDays": 7,
  "sendImmediately": true
}

Response 201:
{
  "success": true,
  "data": {
    "result": InvitationResult,
    "estimatedDeliveryTime": string
  }
}
```

### 10.2 生成邀請連結
```javascript
// API: ProjectLedgerService.generateInvitationLink()
POST /api/ledgers/{ledgerId}/invitations/link

Request Body:
{
  "expiryDays": 30,
  "usageLimit": 10,
  "defaultRole": "member",
  "requireApproval": false
}

Response 201:
{
  "success": true,
  "data": {
    "link": InvitationLink,
    "qrCodeImage": string
  }
}
```

### 10.3 獲取權限選項
```javascript
// API: ProjectLedgerService.getAvailableRoles()
GET /api/ledgers/{ledgerId}/roles/available

Response 200:
{
  "success": true,
  "data": {
    "roles": RoleOption[],
    "recommendations": string[]
  }
}
```

### 10.4 獲取邀請統計
```javascript
// API: ProjectLedgerService.getInvitationStats()
GET /api/ledgers/{ledgerId}/invitations/stats

Response 200:
{
  "success": true,
  "data": InvitationStats
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface InviteMemberState {
  // 載入狀態
  isLoading: boolean;
  isRolesLoading: boolean;
  isStatsLoading: boolean;
  
  // 邀請方式狀態
  inviteMode: 'email' | 'link' | 'qr';
  
  // 表單資料狀態
  emailList: string[];
  defaultRole: string;
  personalMessage: string;
  expiryDays: number;
  
  // 連結設定狀態
  linkSettings: {
    expiryDays: number;
    usageLimit: number;
    requireApproval: boolean;
  };
  
  // QR碼設定狀態
  qrSettings: {
    size: number;
    color: string;
    includeMessage: boolean;
  };
  
  // 資料狀態
  availableRoles: RoleOption[];
  invitationStats: InvitationStats | null;
  generatedLink: InvitationLink | null;
  
  // 操作狀態
  isSending: boolean;
  isGeneratingLink: boolean;
  isGeneratingQR: boolean;
  
  // 結果狀態
  invitationResult: InvitationResult | null;
  showResult: boolean;
  
  // 錯誤狀態
  error: string | null;
  fieldErrors: Record<string, string>;
}
```

### 11.2 表單驗證狀態
- **即時驗證**: Email格式、權限選擇、有效期限
- **提交前驗證**: 完整性檢查和業務規則驗證
- **錯誤顯示**: 即時顯示驗證錯誤和建議
- **成功反饋**: 操作成功後的確認和下一步指引

### 11.3 動態更新機制
- **統計更新**: 即時更新成員數量和邀請配額
- **狀態同步**: 與成員管理頁面的狀態同步
- **結果追蹤**: 追蹤邀請發送和接受狀態

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 邀請安全控制
- **權限驗證**: 嚴格檢查邀請者權限等級
- **配額限制**: 防止邀請濫用和垃圾邀請
- **Email驗證**: 驗證Email真實性和有效性
- **連結安全**: 邀請連結的加密和防偽造

### 12.2 資料保護機制
- **敏感資料**: 加密存儲邀請相關敏感資訊
- **審計日誌**: 完整記錄邀請操作和結果
- **隱私保護**: 保護被邀請者的個人資訊
- **存取控制**: 基於角色的邀請功能存取控制

### 12.3 防護措施
- **防止濫用**: 限制邀請頻率和數量
- **惡意防護**: 檢測和阻止惡意邀請行為
- **連結保護**: 限時和限次的安全邀請連結
- **垃圾防護**: 防止垃圾邀請和無效邀請

## 13. 其他補充需求（Others）

### 13.1 效能最佳化需求
- **批量處理**: 優化大量Email邀請的處理效能
- **非同步發送**: 使用佇列機制處理邀請發送
- **快取機制**: 快取權限選項和常用設定
- **圖片優化**: QR碼圖片的壓縮和快取

### 13.2 使用體驗優化
- **智能建議**: 基於歷史記錄的邀請建議
- **批量匯入**: 支援從通訊錄或CSV匯入Email
- **範本功能**: 提供邀請訊息範本
- **預覽功能**: 邀請內容的預覽和編輯

### 13.3 無障礙設計需求
- **螢幕閱讀器**: 完整的邀請流程語音導航
- **鍵盤操作**: 支援純鍵盤完成邀請操作
- **視覺輔助**: 高對比度和大字體支援
- **操作簡化**: 簡化複雜的邀請流程

### 13.4 國際化需求
- **多語言邀請**: 支援多語言邀請訊息
- **地區化格式**: 適應不同地區的Email格式
- **文化適應**: 考慮不同文化的邀請習慣
- **時區處理**: 正確處理不同時區的有效期

---

**相關文件連結:**
- [P025_成員管理頁面_SRS.md](./P025_成員管理頁面_SRS.md) - 成員管理功能
- [P026_權限設定頁面_SRS.md](./P026_權限設定頁面_SRS.md) - 權限設定功能
- [P028_帳本統計頁面_SRS.md](./P028_帳本統計頁面_SRS.md) - 統計功能
- [9005. Flutter_Presentation layer.md](../90.%20Flutter_PRD/9005.%20Flutter_Presentation%20layer.md) - 視覺規格
- [9006. Flutter_AP layer.md](../90.%20Flutter_PRD/9006.%20Flutter_AP%20layer.md) - API規格
# P027_邀請成員頁面_SRS

## 1. 功能目的 (Purpose)
提供帳本成員邀請功能，支援電子郵件邀請、角色分配、批量邀請和邀請管理。

## 2. 使用者故事 (User Story)
- 作為帳本管理者，我希望能邀請新成員加入帳本
- 作為帳本管理者，我希望能設定新成員的權限角色
- 作為帳本管理者，我希望能批量邀請多個成員
- 作為帳本管理者，我希望能管理和追蹤邀請狀態

## 3. 前置條件 (Preconditions)
- 使用者已登入系統
- 使用者具有帳本邀請權限（管理者或協作者）
- 目標帳本存在且可邀請新成員

## 4. 功能流程 (Functional Flow)

### 主要流程
1. 進入邀請成員頁面
2. 輸入被邀請者電子郵件
3. 選擇成員角色權限
4. 設定邀請訊息（可選）
5. 發送邀請
6. 追蹤邀請狀態

### 替代流程
- 批量邀請多個成員
- 重新發送邀請
- 取消待處理邀請

## 5. 輸入項目 (Inputs)
- 被邀請者電子郵件
- 成員角色選擇
- 邀請訊息內容
- 帳本邀請權限

## 6. 輸出項目 (Outputs)
- 邀請發送確認
- 邀請狀態顯示
- 邀請連結生成
- 邀請管理清單

## 7. 驗證規則 (Validation Rules)
- 電子郵件格式驗證
- 角色權限有效性檢查
- 重複邀請防護
- 邀請數量限制驗證

## 8. 錯誤處理 (Error Handling)
- 無效電子郵件格式提示
- 邀請發送失敗處理
- 網路連線錯誤處理
- 權限不足錯誤提示

## 9. UI 元件與排版需求 (UI Requirements)
- 邀請表單輸入區
- 角色選擇下拉選單
- 批量邀請功能
- 邀請狀態追蹤列表
- 邀請訊息編輯器

## 10. API 規格 (API Specification)
- POST /app/projects/{projectId}/invite - 發送邀請
- GET /app/projects/{projectId}/invitations - 取得邀請清單
- PUT /app/projects/{projectId}/invitations/{inviteId} - 更新邀請
- DELETE /app/projects/{projectId}/invitations/{inviteId} - 取消邀請

## 11. 狀態與畫面切換 (State Handling)
- 邀請編輯狀態
- 邀請發送中狀態
- 邀請結果顯示狀態
- 邀請清單管理狀態

## 12. 安全性與權限檢查 (Security)
- 邀請權限驗證
- 電子郵件隱私保護
- 邀請連結安全性
- 防止濫用機制

## 13. 其他補充需求 (Others)
- 邀請有效期限管理
- 邀請提醒功能
- 邀請統計資訊
- 多語言邀請訊息支援
