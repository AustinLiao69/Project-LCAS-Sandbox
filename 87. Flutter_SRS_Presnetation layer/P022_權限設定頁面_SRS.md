
# P022_權限設定頁面_SRS

**文件編號**: P022-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team  
**最後更新**: 2025-01-26 16:15:00 UTC+8

---

## 1. 功能目的（Purpose）

P026權限設定頁面提供帳本權限的細粒度管理功能，包含角色定義、權限矩陣設定、自訂權限組合、權限繼承規則等進階功能，為多人協作帳本提供靈活而安全的權限控制機制。

**核心功能**：
- 角色權限矩陣設定
- 自訂權限組合建立
- 權限繼承規則管理
- 功能模組權限控制
- 時間限制權限設定
- 權限範本管理

## 2. 使用者故事（User Story）

### 主要使用者故事
```
作為帳本擁有者
我想要精細控制每個成員的具體權限
以便確保帳本資料的安全性和協作的有序性
```

### 詳細使用者故事
1. **權限矩陣**: 使用者可以查看和編輯完整的權限矩陣
2. **角色定義**: 使用者可以自訂角色並設定對應權限
3. **功能控制**: 使用者可以控制特定功能模組的存取權限
4. **時間限制**: 使用者可以設定時間限制的權限規則
5. **權限範本**: 使用者可以建立和套用權限設定範本

## 3. 前置條件（Preconditions）

### 系統前置條件
- 使用者已完成登入驗證
- 使用者為帳本擁有者或具備權限管理權限
- 帳本支援進階權限控制功能
- 網路連線狀態正常

### 資料前置條件
- 帳本ID必須有效且存在
- 現有權限設定資料完整
- 角色和權限對應關係明確
- 功能模組清單完整

### 權限前置條件
- **擁有者權限**: 完整的權限設定管理
- **權限管理員**: 受限的權限調整能力
- **檢視權限**: 查看目前權限設定

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
```
1. 系統驗證使用者身份和權限管理授權
2. 載入帳本權限設定架構
3. 載入現有角色和權限定義
4. 載入功能模組清單和權限點
5. 載入權限範本和預設設定
6. 檢查權限設定規則和限制
7. 渲染權限設定介面
```

### 4.2 權限矩陣編輯流程
```
1. 使用者進入權限矩陣檢視
2. 系統顯示角色與權限的矩陣表格
3. 使用者點擊特定權限項目
4. 系統檢查權限調整規則：
   - 檢查相依性權限
   - 驗證角色階層限制
   - 確認業務邏輯約束
5. 使用者確認權限變更
6. 系統更新權限設定
7. 即時生效並通知相關成員
```

### 4.3 自訂角色建立流程
```
1. 使用者點擊「建立自訂角色」
2. 輸入角色基本資訊：
   - 角色名稱和描述
   - 角色層級和繼承關係
   - 適用範圍和限制
3. 設定角色權限：
   - 選擇基礎權限集合
   - 調整特殊權限
   - 設定限制條件
4. 預覽權限影響範圍
5. 儲存自訂角色設定
6. 更新權限系統
```

### 4.4 權限範本管理流程
```
1. 使用者進入權限範本管理
2. 檢視現有範本清單：
   - 系統預設範本
   - 自訂範本
   - 共享範本
3. 選擇操作：
   - 建立新範本
   - 編輯現有範本
   - 套用範本到角色
   - 分享範本給其他帳本
4. 執行範本操作並確認變更
```

## 5. 輸入項目（Inputs）

### 5.1 路由參數
| 參數名稱 | 資料型別 | 必填 | 說明 |
|---------|---------|------|------|
| ledgerId | String | 是 | 帳本ID |

### 5.2 權限設定輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| roleId | String | 是 | 有效角色ID | 目標角色 |
| permissionId | String | 是 | 有效權限ID | 權限項目 |
| granted | Boolean | 是 | true/false | 是否授予權限 |
| restrictions | Object | 否 | 限制規則格式 | 權限限制條件 |

### 5.3 自訂角色輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| roleName | String | 是 | 1-30字元 | 角色名稱 |
| roleDescription | String | 否 | 最大200字元 | 角色描述 |
| roleLevel | Number | 是 | 1-10 | 角色層級 |
| parentRole | String | 否 | 有效角色ID | 繼承父角色 |
| permissions | Array<String> | 是 | 有效權限清單 | 權限集合 |

### 5.4 權限範本輸入
| 欄位名稱 | 資料型別 | 必填 | 驗證規則 | 說明 |
|---------|---------|------|---------|------|
| templateName | String | 是 | 1-50字元 | 範本名稱 |
| templateDescription | String | 否 | 最大300字元 | 範本描述 |
| rolePermissions | Object | 是 | 權限映射格式 | 角色權限對應 |
| isPublic | Boolean | 否 | true/false | 是否公開範本 |

## 6. 輸出項目（Outputs / Responses）

### 6.1 權限矩陣顯示
```typescript
interface PermissionMatrix {
  roles: Role[];
  permissions: Permission[];
  matrix: PermissionGrant[][];
  dependencies: PermissionDependency[];
  restrictions: PermissionRestriction[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  level: number;
  isCustom: boolean;
  parentRole?: string;
  memberCount: number;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[];
}

interface PermissionGrant {
  roleId: string;
  permissionId: string;
  granted: boolean;
  restrictions?: PermissionRestriction;
  inheritedFrom?: string;
}
```

### 6.2 權限限制設定
```typescript
interface PermissionRestriction {
  timeRestriction?: {
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
    timezone: string;
  };
  amountRestriction?: {
    maxAmount: number;
    timeWindow: 'daily' | 'weekly' | 'monthly';
    currency: string;
  };
  scopeRestriction?: {
    allowedCategories: string[];
    forbiddenCategories: string[];
    allowedProjects: string[];
  };
  approvalRequired?: {
    threshold: number;
    approvers: string[];
    autoApprove: boolean;
  };
}
```

### 6.3 權限範本資料
```typescript
interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  creator: string;
  createdDate: string;
  lastModified: string;
  isPublic: boolean;
  usageCount: number;
  rolePermissions: Record<string, string[]>;
  restrictions: Record<string, PermissionRestriction>;
}
```

### 6.4 權限變更歷史
```typescript
interface PermissionChangeLog {
  id: string;
  timestamp: string;
  operator: string;
  action: 'grant' | 'revoke' | 'modify' | 'create_role' | 'delete_role';
  target: {
    type: 'role' | 'permission' | 'restriction';
    id: string;
    name: string;
  };
  oldValue: any;
  newValue: any;
  reason: string;
  affectedMembers: string[];
}
```

## 7. 驗證規則（Validation Rules）

### 7.1 權限邏輯驗證
- 權限相依性檢查：確保依賴權限已授予
- 角色階層驗證：下級角色權限不可超過上級
- 業務邏輯約束：特定權限組合的業務規則檢查
- 安全性驗證：高風險權限的額外檢查

### 7.2 角色設定驗證
- 角色名稱唯一性檢查
- 角色層級合理性驗證
- 繼承關係循環檢測
- 最小權限原則驗證

### 7.3 限制條件驗證
- 時間限制的邏輯正確性
- 金額限制的合理性
- 範圍限制的有效性
- 審核流程的完整性

## 8. 錯誤處理（Error Handling）

### 8.1 權限衝突處理
| 錯誤類型 | 錯誤代碼 | 處理方式 | 使用者訊息 |
|---------|---------|---------|-----------|
| 權限相依性衝突 | PERM_DEPENDENCY_CONFLICT | 顯示相依關係圖 | "此權限需要先授予依賴權限" |
| 角色階層衝突 | PERM_HIERARCHY_VIOLATION | 說明階層規則 | "下級角色不可擁有上級專屬權限" |
| 業務邏輯衝突 | PERM_BUSINESS_CONFLICT | 提供解決建議 | "此權限組合不符合業務規則" |

### 8.2 設定錯誤處理
| 錯誤情境 | 處理策略 | 使用者體驗 |
|---------|---------|-----------|
| 設定保存失敗 | 保留變更內容並重試 | 顯示錯誤詳情和重試按鈕 |
| 權限套用失敗 | 部分套用並標示失敗項目 | 顯示成功和失敗的詳細清單 |
| 範本載入失敗 | 提供預設範本 | 顯示警告並提供備用選項 |

### 8.3 即時驗證錯誤
- **輸入驗證**: 即時檢查輸入資料格式
- **衝突檢測**: 即時檢測權限設定衝突
- **影響評估**: 即時評估變更的影響範圍

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
權限設定頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題
│   └── 儲存變更按鈕
├── 功能分頁標籤
│   ├── 權限矩陣
│   ├── 角色管理
│   ├── 權限範本
│   └── 變更歷史
├── 權限矩陣區域
│   ├── 角色列表（左側）
│   ├── 權限項目（頂部）
│   ├── 權限矩陣表格
│   └── 權限說明面板
├── 角色管理區域
│   ├── 現有角色清單
│   ├── 角色詳情編輯器
│   └── 新增角色按鈕
├── 權限限制設定
│   ├── 時間限制設定
│   ├── 金額限制設定
│   ├── 範圍限制設定
│   └── 審核流程設定
└── 範本管理區域
    ├── 範本清單
    ├── 範本預覽
    └── 範本操作按鈕
```

### 9.2 權限矩陣表格設計
```
權限矩陣表格：
┌─────────────┬──────┬──────┬──────┬──────┐
│   角色/權限  │ 檢視  │ 新增  │ 編輯  │ 刪除  │
├─────────────┼──────┼──────┼──────┼──────┤
│ 擁有者       │  ✅   │  ✅   │  ✅   │  ✅   │
├─────────────┼──────┼──────┼──────┼──────┤
│ 管理員       │  ✅   │  ✅   │  ✅   │  ❌   │
├─────────────┼──────┼──────┼──────┼──────┤
│ 成員        │  ✅   │  ✅   │  ❌   │  ❌   │
├─────────────┼──────┼──────┼──────┼──────┤
│ 檢視者       │  ✅   │  ❌   │  ❌   │  ❌   │
└─────────────┴──────┴──────┴──────┴──────┘
```

### 9.3 視覺設計規範
- **權限狀態**: 綠色勾選、紅色叉號、黃色限制
- **角色階層**: 縮排顯示角色階層關係
- **風險等級**: 不同顏色標示權限風險等級
- **變更標示**: 標示未儲存的權限變更

### 9.4 互動設計
- **點擊切換**: 點擊權限格切換授予/撤銷
- **批量操作**: 支援多選批量權限設定
- **拖拽排序**: 角色優先級拖拽調整
- **即時預覽**: 權限變更的即時影響預覽

## 10. API 規格（API Specification）

### 10.1 載入權限設定
```javascript
// API: ProjectLedgerService.getPermissionMatrix()
GET /api/ledgers/{ledgerId}/permissions

Response 200:
{
  "success": true,
  "data": {
    "matrix": PermissionMatrix,
    "templates": PermissionTemplate[],
    "changeLogs": PermissionChangeLog[]
  }
}
```

### 10.2 更新權限矩陣
```javascript
// API: ProjectLedgerService.updatePermissionMatrix()
PUT /api/ledgers/{ledgerId}/permissions/matrix

Request Body:
{
  "changes": [
    {
      "roleId": "role_001",
      "permissionId": "perm_001",
      "granted": true,
      "restrictions": PermissionRestriction
    }
  ],
  "reason": "調整協作權限"
}

Response 200:
{
  "success": true,
  "data": {
    "updatedMatrix": PermissionMatrix,
    "affectedMembers": string[],
    "changeLog": PermissionChangeLog
  }
}
```

### 10.3 建立自訂角色
```javascript
// API: ProjectLedgerService.createCustomRole()
POST /api/ledgers/{ledgerId}/roles

Request Body:
{
  "name": "專案助理",
  "description": "協助專案記帳和統計",
  "level": 3,
  "parentRole": "member",
  "permissions": ["perm_001", "perm_002"],
  "restrictions": PermissionRestriction
}

Response 201:
{
  "success": true,
  "data": {
    "role": Role,
    "updatedMatrix": PermissionMatrix
  }
}
```

### 10.4 權限範本操作
```javascript
// API: ProjectLedgerService.applyPermissionTemplate()
POST /api/ledgers/{ledgerId}/permissions/apply-template

Request Body:
{
  "templateId": "template_001",
  "targetRoles": ["role_001", "role_002"],
  "overwriteExisting": true
}

Response 200:
{
  "success": true,
  "data": {
    "appliedChanges": PermissionChange[],
    "updatedMatrix": PermissionMatrix
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
interface PermissionSettingsState {
  // 載入狀態
  isLoading: boolean;
  isMatrixLoading: boolean;
  isTemplatesLoading: boolean;
  
  // 資料狀態
  matrix: PermissionMatrix | null;
  templates: PermissionTemplate[];
  changeLogs: PermissionChangeLog[];
  
  // 編輯狀態
  pendingChanges: PermissionChange[];
  isDirty: boolean;
  isEditing: boolean;
  editingRole: Role | null;
  
  // UI狀態
  activeTab: 'matrix' | 'roles' | 'templates' | 'history';
  selectedRole: string | null;
  selectedPermission: string | null;
  showRoleDialog: boolean;
  showTemplateDialog: boolean;
  
  // 驗證狀態
  validationErrors: Record<string, string>;
  conflicts: PermissionConflict[];
  
  // 操作狀態
  isSaving: boolean;
  isApplyingTemplate: boolean;
  
  // 錯誤狀態
  error: string | null;
}
```

### 11.2 權限變更追蹤
```typescript
interface PermissionChange {
  type: 'grant' | 'revoke' | 'modify' | 'restrict';
  roleId: string;
  permissionId: string;
  oldValue: boolean | PermissionRestriction;
  newValue: boolean | PermissionRestriction;
  timestamp: string;
  validated: boolean;
  conflicts: string[];
}
```

### 11.3 即時驗證與預覽
- **依賴檢查**: 即時檢查權限依賴關係
- **衝突檢測**: 即時檢測權限設定衝突
- **影響評估**: 預覽權限變更對現有成員的影響
- **安全警告**: 高風險權限變更的安全提醒

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 權限設定安全
- **操作權限**: 僅擁有者和權限管理員可修改設定
- **權限升級防護**: 防止使用者提升自己的權限
- **最小權限原則**: 預設採用最小權限設定
- **敏感權限保護**: 高風險權限需要特別審核

### 12.2 設定完整性
- **權限一致性**: 確保權限設定的邏輯一致性
- **角色完整性**: 維護角色階層的完整性
- **資料完整性**: 防止權限設定資料損壞
- **回滾機制**: 支援權限設定的安全回滾

### 12.3 審計與追蹤
- **變更記錄**: 完整記錄所有權限變更
- **操作者追蹤**: 記錄每次變更的操作者
- **影響分析**: 分析權限變更的影響範圍
- **安全報告**: 定期生成權限安全報告

## 13. 其他補充需求（Others）

### 13.1 效能最佳化需求
- **矩陣渲染**: 大型權限矩陣的高效渲染
- **即時驗證**: 優化即時驗證的效能
- **快取策略**: 權限資料的智慧快取
- **批量更新**: 支援批量權限變更操作

### 13.2 使用體驗優化
- **視覺化權限**: 直觀的權限關係視覺化
- **智慧建議**: 基於角色的權限建議
- **快速設定**: 常用權限組合的快速設定
- **變更預覽**: 清晰的權限變更預覽

### 13.3 進階功能需求
- **權限繼承**: 支援複雜的權限繼承規則
- **條件權限**: 基於條件的動態權限控制
- **時間權限**: 時間限制的臨時權限
- **外部整合**: 與外部身份驗證系統整合

### 13.4 無障礙設計需求
- **螢幕閱讀器**: 權限矩陣的完整語音描述
- **鍵盤導航**: 支援鍵盤完整操作權限設定
- **顏色替代**: 非顏色依賴的權限狀態指示
- **字體縮放**: 支援系統字體大小調整

---

**相關文件連結:**
- [P025_成員管理頁面_SRS.md](./P025_成員管理頁面_SRS.md) - 成員管理功能
- [P022_帳本設定頁面_SRS.md](./P022_帳本設定頁面_SRS.md) - 帳本基本設定
- [P027_邀請成員頁面_SRS.md](./P027_邀請成員頁面_SRS.md) - 成員邀請功能
- [9005. Flutter_Presentation layer.md](../90.%20Flutter_PRD/9005.%20Flutter_Presentation%20layer.md) - 視覺規格
- [9006. Flutter_AP layer.md](../90.%20Flutter_PRD/9006.%20Flutter_AP%20layer.md) - API規格
