
# P029_刪除帳本頁面_SRS

**文件編號**: P029  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 17:00:00 UTC+8

---

## 1. 功能目的（Purpose）

P029刪除帳本頁面提供安全的帳本刪除功能，包含嚴格的確認機制、資料備份選項、權限轉移處理等，確保帳本刪除操作的可控性和安全性，防止誤刪重要資料。

**核心功能**：
- 帳本刪除前置檢查
- 多層級確認機制
- 資料備份與匯出選項
- 成員通知與權限處理
- 刪除後清理與復原機制

## 2. 使用者故事（User Story）

### 主要使用者故事
```
作為帳本擁有者
我想要安全地刪除不需要的帳本
以便清理帳本清單並保護重要資料不被誤刪
```

### 詳細使用者故事
1. **安全刪除**: 使用者可以透過多重確認安全刪除帳本
2. **資料備份**: 使用者可以在刪除前備份重要資料
3. **成員通知**: 使用者可以在刪除前通知相關成員
4. **權限轉移**: 使用者可以將擁有者權限轉移後再刪除
5. **恢復選項**: 使用者可以在限定時間內恢復已刪除帳本

## 3. 前置條件（Preconditions）

### 系統前置條件
- 使用者已完成登入驗證
- 使用者為帳本擁有者或具有刪除權限
- 帳本存在且狀態正常
- 網路連線狀態正常

### 資料前置條件
- 帳本ID必須有效且存在
- 使用者擁有帳本的刪除權限
- 帳本資料完整且可存取
- 相關依賴資料狀態檢查完成

### 權限前置條件
- **擁有者權限**: 完整的刪除權限
- **管理員權限**: 需要擁有者授權的刪除權限
- **備份權限**: 刪除前備份資料的權限

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 刪除前檢查流程
```
1. 系統驗證使用者刪除權限
2. 檢查帳本當前狀態和依賴：
   - 是否有進行中的協作
   - 是否有未完成的預算週期
   - 是否有待處理的邀請
   - 是否有其他成員活躍使用
3. 檢查帳本重要程度：
   - 記帳筆數和時間跨度
   - 成員數量和活躍度
   - 關聯的預算和報表
4. 提供風險評估和建議
5. 顯示刪除前提醒頁面
```

### 4.2 資料備份流程
```
1. 使用者選擇備份選項
2. 系統檢查備份權限和容量
3. 執行帳本資料匯出：
   - 記帳明細匯出
   - 成員資訊匯出
   - 設定和規則匯出
   - 統計報表匯出
4. 生成備份檔案並提供下載
5. 確認備份完成後繼續刪除流程
```

### 4.3 成員通知與處理流程
```
1. 系統載入帳本所有成員清單
2. 為每位成員生成通知訊息
3. 發送帳本即將刪除的通知
4. 處理成員的相關資料：
   - 移除成員的帳本存取權
   - 清理成員的相關設定
   - 更新成員的帳本清單
5. 記錄成員處理結果
```

### 4.4 最終刪除確認流程
```
1. 顯示刪除確認對話框
2. 要求使用者輸入帳本名稱確認
3. 要求使用者輸入刪除確認密碼
4. 顯示刪除影響範圍和後果
5. 使用者最終確認刪除
6. 執行帳本刪除操作：
   - 標記帳本為已刪除狀態
   - 移除所有成員存取權
   - 清理相關快取和索引
   - 設定資料保留期限
7. 記錄刪除操作日誌
8. 顯示刪除完成確認
```

## 5. 輸入項目（Inputs）

### 5.1 路由參數
| 參數名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| ledgerId | String | 是 | 要刪除的帳本ID |

### 5.2 刪除確認輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| ledgerNameConfirm | String | 是 | 必須與帳本名稱完全相符 | 帳本名稱確認 |
| deletePassword | String | 是 | 使用者當前密碼 | 刪除確認密碼 |
| confirmPhrase | String | 是 | 必須輸入指定確認詞 | 刪除確認詞組 |
| understandConsequences | Boolean | 是 | 必須為true | 理解後果確認 |

### 5.3 備份選項輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| enableBackup | Boolean | 否 | true/false | 是否建立備份 |
| backupFormat | String | 否 | csv/json/excel | 備份格式選擇 |
| includeMembers | Boolean | 否 | true/false | 是否包含成員資料 |
| includeStats | Boolean | 否 | true/false | 是否包含統計資料 |
| encryptBackup | Boolean | 否 | true/false | 是否加密備份 |

### 5.4 成員通知輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| notifyMembers | Boolean | 否 | true/false | 是否通知成員 |
| notificationMessage | String | 否 | 最大500字元 | 客製化通知訊息 |
| gracePeriodDays | Number | 否 | 1-30天 | 寬限期天數 |

## 6. 輸出項目（Outputs / Responses）

### 6.1 刪除前檢查結果
```typescript
interface DeletionPreCheck {
  canDelete: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
  dependencies: Array<{
    type: string;
    count: number;
    description: string;
  }>;
  impact: {
    affectedMembers: number;
    dataSize: string;
    timePeriod: string;
    entryCount: number;
  };
  recommendations: string[];
}
```

### 6.2 備份處理結果
```typescript
interface BackupResult {
  backupId: string;
  downloadUrl: string;
  expiryTime: string;
  fileSize: string;
  format: string;
  encrypted: boolean;
  includedComponents: Array<{
    component: string;
    recordCount: number;
    status: 'success' | 'failed';
  }>;
  checksumHash: string;
}
```

### 6.3 刪除執行結果
```typescript
interface DeletionResult {
  deletionId: string;
  status: 'completed' | 'failed' | 'partial';
  deletedAt: string;
  recoveryDeadline: string;
  affectedData: {
    entriesDeleted: number;
    membersRemoved: number;
    attachmentsDeleted: number;
    relatedDataCleared: number;
  };
  cleanupJobs: Array<{
    jobType: string;
    status: 'completed' | 'pending' | 'failed';
    scheduledTime: string;
  }>;
  recoveryToken?: string;
}
```

### 6.4 成員通知結果
```typescript
interface MemberNotificationResult {
  notificationsSent: number;
  memberProcessing: Array<{
    memberId: string;
    memberName: string;
    notificationStatus: 'sent' | 'failed';
    accessRevoked: boolean;
    dataTransferred: boolean;
  }>;
  failedNotifications: Array<{
    memberId: string;
    reason: string;
  }>;
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 權限驗證規則
- 使用者必須為帳本擁有者或獲得明確授權
- 多人帳本的刪除需要額外確認
- 企業帳本的刪除需要管理員審核
- 檢查是否為唯一擁有者

### 7.2 確認輸入驗證
- 帳本名稱必須完全一致（區分大小寫）
- 密碼必須與當前使用者密碼相符
- 確認詞組必須正確輸入
- 所有必要確認項目必須完成

### 7.3 狀態依賴驗證
- 帳本不可有進行中的協作操作
- 預算週期需要完成或轉移
- 待處理邀請需要先取消
- 關聯報表需要先處理

## 8. 錯誤處理（Error Handling）

### 8.1 權限錯誤處理
| 錯誤類型 | 錯誤代碼 | 處理方式 | 使用者訊息 |
|---------|---------|---------|-----------|
| 無刪除權限 | DELETE_PERMISSION_DENIED | 阻止操作並說明 | "您沒有權限刪除此帳本" |
| 非擁有者操作 | DELETE_OWNER_REQUIRED | 提供權限轉移選項 | "只有擁有者可以刪除帳本" |
| 權限衝突 | DELETE_PERMISSION_CONFLICT | 顯示衝突詳情 | "存在權限衝突，請先解決" |

### 8.2 依賴檢查錯誤
| 錯誤情境 | 處理策略 | 使用者體驗 |
|---------|---------|-----------|
| 存在活躍成員 | 提供成員移除選項 | 顯示成員清單和移除操作 |
| 未完成預算 | 提供預算處理選項 | 引導完成或轉移預算 |
| 進行中協作 | 要求先停止協作 | 顯示協作狀態和停止選項 |

### 8.3 刪除執行錯誤
- **部分刪除失敗**: 記錄失敗項目並提供重試
- **備份失敗**: 阻止刪除直到備份成功
- **通知失敗**: 記錄失敗但不阻止刪除

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
刪除帳本頁面
├── 頂部警告橫幅
│   ├── 危險操作提醒
│   └── 重要說明文字
├── 帳本資訊確認區
│   ├── 帳本基本資訊
│   ├── 刪除影響評估
│   └── 風險等級提示
├── 刪除前準備區域
│   ├── 資料備份選項
│   ├── 成員通知設定
│   └── 權限轉移處理
├── 刪除確認區域
│   ├── 帳本名稱確認輸入
│   ├── 密碼確認輸入
│   ├── 確認詞組輸入
│   └── 後果理解確認
├── 操作按鈕區域
│   ├── 取消操作按鈕
│   ├── 備份並刪除按鈕
│   └── 立即刪除按鈕
└── 進度顯示區域
    ├── 刪除進度條
    ├── 執行步驟顯示
    └── 結果狀態顯示
```

### 9.2 警告橫幅設計
```
危險操作警告：
┌─────────────────────────────────┐
│ ⚠️  危險操作 - 刪除帳本          │
│ 此操作將永久刪除帳本及所有資料   │
│ 請仔細確認後再進行操作           │
└─────────────────────────────────┘
```

### 9.3 確認輸入區設計
```
刪除確認輸入：
┌─────────────────────────────────┐
│ 🔐 請輸入帳本名稱確認：          │
│ ┌─────────────────────────────┐ │
│ │ 我的記帳本                   │ │
│ └─────────────────────────────┘ │
│                                 │
│ 🔑 請輸入您的密碼：              │
│ ┌─────────────────────────────┐ │
│ │ ••••••••••••                │ │
│ └─────────────────────────────┘ │
│                                 │
│ ✅ 請輸入「確認刪除」：          │
│ ┌─────────────────────────────┐ │
│ │ 確認刪除                     │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 9.4 視覺設計規範
- **警告色彩**: 使用紅色系統警告配色
- **操作層級**: 危險操作使用醒目的視覺提示
- **確認流程**: 逐步的確認流程視覺引導
- **進度反饋**: 清晰的刪除進度和狀態顯示

## 10. API 規格（API Specification）

### 10.1 刪除前檢查
```javascript
// API: ProjectLedgerService.checkDeletionEligibility()
GET /api/ledgers/{ledgerId}/deletion/check

Response 200:
{
  "success": true,
  "data": {
    "preCheck": DeletionPreCheck,
    "requiredSteps": string[],
    "estimatedTime": string
  }
}
```

### 10.2 建立資料備份
```javascript
// API: ProjectLedgerService.createDeletionBackup()
POST /api/ledgers/{ledgerId}/deletion/backup

Request Body:
{
  "format": "json",
  "includeMembers": true,
  "includeStats": true,
  "encryptBackup": true
}

Response 201:
{
  "success": true,
  "data": {
    "backup": BackupResult,
    "downloadToken": string
  }
}
```

### 10.3 執行帳本刪除
```javascript
// API: ProjectLedgerService.deleteLedger()
DELETE /api/ledgers/{ledgerId}

Request Body:
{
  "confirmation": {
    "ledgerName": "我的記帳本",
    "password": "user_password",
    "confirmPhrase": "確認刪除",
    "understandConsequences": true
  },
  "options": {
    "notifyMembers": true,
    "gracePeriodDays": 7,
    "customMessage": "帳本即將刪除"
  }
}

Response 200:
{
  "success": true,
  "data": {
    "deletion": DeletionResult,
    "notifications": MemberNotificationResult
  }
}
```

### 10.4 恢復已刪除帳本
```javascript
// API: ProjectLedgerService.recoverDeletedLedger()
POST /api/ledgers/{ledgerId}/recovery

Request Body:
{
  "recoveryToken": "recovery_token_string",
  "reason": "誤刪恢復"
}

Response 200:
{
  "success": true,
  "data": {
    "ledger": LedgerInfo,
    "recoveryStatus": string,
    "restoredData": DataRestoreInfo
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface DeleteLedgerState {
  // 載入狀態
  isLoading: boolean;
  isChecking: boolean;
  isDeleting: boolean;
  isBackingUp: boolean;
  
  // 檢查結果狀態
  preCheck: DeletionPreCheck | null;
  eligibilityConfirmed: boolean;
  
  // 確認輸入狀態
  confirmation: {
    ledgerName: string;
    password: string;
    confirmPhrase: string;
    understandConsequences: boolean;
  };
  
  // 備份選項狀態
  backupOptions: {
    enabled: boolean;
    format: string;
    includeMembers: boolean;
    includeStats: boolean;
    encrypted: boolean;
  };
  
  // 通知設定狀態
  notificationSettings: {
    notifyMembers: boolean;
    customMessage: string;
    gracePeriodDays: number;
  };
  
  // 執行進度狀態
  deletionProgress: {
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
    estimatedTimeRemaining: string;
  };
  
  // 結果狀態
  deletionResult: DeletionResult | null;
  backupResult: BackupResult | null;
  notificationResult: MemberNotificationResult | null;
  
  // 錯誤狀態
  error: string | null;
  validationErrors: Record<string, string>;
}
```

### 11.2 刪除流程狀態
- **檢查階段**: 執行刪除前檢查和風險評估
- **準備階段**: 資料備份和成員通知準備
- **確認階段**: 多重確認輸入和最終確認
- **執行階段**: 執行刪除操作並顯示進度
- **完成階段**: 顯示刪除結果和後續指引

### 11.3 錯誤恢復機制
- **檢查失敗**: 提供重新檢查選項
- **備份失敗**: 必須成功備份才能繼續
- **刪除失敗**: 提供重試和回滾選項
- **部分失敗**: 顯示詳細失敗原因和修復建議

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 多重安全驗證
- **身份確認**: 要求輸入當前密碼確認身份
- **操作確認**: 多層級的操作確認機制
- **權限檢查**: 嚴格的權限等級檢查
- **時間限制**: 刪除操作的時間窗口限制

### 12.2 資料保護機制
- **軟刪除**: 採用軟刪除機制保留恢復可能性
- **資料備份**: 強制備份重要資料
- **加密存儲**: 敏感資料的加密存儲
- **存取控制**: 嚴格的刪除功能存取控制

### 12.3 審計與監控
- **操作記錄**: 完整記錄刪除操作過程
- **異常監控**: 監控異常的刪除操作行為
- **恢復機制**: 提供緊急恢復機制
- **合規要求**: 滿足資料保護法規要求

## 13. 其他補充需求（Others）

### 13.1 恢復機制需求
- **恢復期限**: 提供30天的恢復寬限期
- **恢復條件**: 明確的恢復條件和流程
- **資料完整性**: 確保恢復資料的完整性
- **通知機制**: 恢復操作的通知機制

### 13.2 合規與法規需求
- **資料保護**: 遵循GDPR等資料保護法規
- **保留政策**: 執行資料保留和刪除政策
- **審計要求**: 滿足審計和合規要求
- **隱私權**: 保護使用者隱私權

### 13.3 無障礙設計需求
- **警告提示**: 清晰的危險操作警告提示
- **操作引導**: 完整的操作步驟語音引導
- **確認機制**: 無障礙的確認輸入機制
- **狀態反饋**: 清晰的操作狀態反饋

### 13.4 效能與可靠性
- **操作效能**: 優化刪除操作的執行效能
- **可靠性**: 確保刪除操作的可靠性
- **容錯機制**: 完善的容錯和恢復機制
- **監控告警**: 刪除操作的監控和告警

---

**相關文件連結:**
- [P025_成員管理頁面_SRS.md](./P025_成員管理頁面_SRS.md) - 成員管理功能
- [P028_帳本統計頁面_SRS.md](./P028_帳本統計頁面_SRS.md) - 統計功能
- [P022_帳本設定頁面_SRS.md](./P022_帳本設定頁面_SRS.md) - 帳本設定功能
- [9005. Flutter_Presentation layer.md](../90.%20Flutter_PRD/9005.%20Flutter_Presentation%20layer.md) - 視覺規格
- [9006. Flutter_AP layer.md](../90.%20Flutter_PRD/9006.%20Flutter_AP%20layer.md) - API規格
