
# P038 預算範本頁面 SRS

## 文件資訊
- **文件版次**: v1.0.0
- **建立日期**: 2025-01-19
- **最後更新**: 2025-01-19
- **負責模組**: BudgetService v1.1.0
- **對應API**: F016 預算範本管理API v2.0.0

## 版次記錄
| 版次 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-01-19 | 初始版本建立，完整預算範本管理功能規格 | SA團隊 |

## 目次
1. [功能目的](#1-功能目的purpose)
2. [使用者故事](#2-使用者故事user-story)
3. [前置條件](#3-前置條件preconditions)
4. [功能流程](#4-功能流程user-flow--functional-flow)
5. [輸入項目](#5-輸入項目inputs)
6. [輸出項目](#6-輸出項目outputs--responses)
7. [驗證規則](#7-驗證規則validation-rules)
8. [錯誤處理](#8-錯誤處理error-handling)
9. [UI元件與排版需求](#9-ui元件與排版需求ui-requirements)
10. [API規格](#10-api規格如有api-specification)
11. [狀態與畫面切換](#11-狀態與畫面切換state-handling)
12. [安全性與權限檢查](#12-安全性與權限檢查security--access-control)
13. [其他補充需求](#13-其他補充需求others)

---

## 1. 功能目的（Purpose）
提供預算範本管理功能，讓使用者可以建立、編輯、使用和分享常用的預算設定範本，大幅提升預算建立效率並確保預算結構的一致性。

---

## 2. 使用者故事（User Story）
- 作為忙碌的使用者，我希望能使用預設的預算範本快速建立預算，節省重複設定的時間
- 作為經驗豐富的理財者，我希望能建立自己的預算範本，供未來重複使用
- 作為團隊管理者，我希望能分享我的預算範本給團隊成員，確保預算規劃的一致性
- 作為預算新手，我希望能使用系統推薦的預算範本，學習最佳實務做法
- 作為多帳本用戶，我希望能將範本套用到不同帳本，維持預算管理的標準化

---

## 3. 前置條件（Preconditions）
- 使用者已登入系統且擁有有效授權
- 使用者具有預算建立或管理權限
- 系統中存在可存取的帳本
- 預算範本資料庫正常運作
- 使用者介面元件已正確載入

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 瀏覽範本流程
1. **進入範本頁面** → 載入可用範本清單
2. **瀏覽範本分類** → 個人範本/系統範本/共享範本
3. **篩選搜尋範本** → 依類型、標籤、建立者篩選
4. **預覽範本詳情** → 查看範本結構和說明
5. **使用範本建立** → 選擇範本並套用到帳本

### 4.2 建立範本流程
1. **選擇建立方式** → 從零開始/基於現有預算/修改既有範本
2. **設定範本基本資訊** → 名稱、說明、分類、標籤
3. **配置預算結構** → 分類、金額、期間、警示規則
4. **設定分享權限** → 私人/團隊/公開
5. **儲存並測試** → 驗證範本完整性

### 4.3 管理範本流程
1. **檢視我的範本** → 顯示已建立的範本清單
2. **編輯範本內容** → 修改範本設定和結構
3. **管理分享設定** → 調整範本可見性和權限
4. **複製匯出範本** → 備份或移轉範本
5. **刪除無用範本** → 清理不再需要的範本

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 範本名稱 | String | 2-50字元，必填 | 文字輸入框 | 範本標識名稱 |
| 範本說明 | String | 最多200字元 | 多行文字框 | 範本用途描述 |
| 範本分類 | Enum | 必選 | 下拉選單 | 生活/事業/投資/旅遊等 |
| 標籤 | Array | 最多10個 | 標籤輸入器 | 快速搜尋用 |
| 分享設定 | Enum | 必選 | 單選按鈕 | 私人/團隊/公開 |
| 預算週期 | Enum | 必選 | 選擇器 | 月度/季度/年度 |
| 分類結構 | Object | 至少1個分類 | 樹狀編輯器 | 預算分類配置 |
| 金額配置 | Object | 總額>0 | 金額分配器 | 各分類金額比例 |
| 警示規則 | Object | 可選 | 規則編輯器 | 警示閾值設定 |
| 範本圖示 | String | 可選 | 圖示選擇器 | 視覺識別用 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 範本清單回應
```typescript
interface TemplateListResponse {
  templates: BudgetTemplate[];
  totalCount: number;
  categories: string[];
  popularTags: string[];
  recommendations: BudgetTemplate[];
}
```

### 6.2 範本詳情回應
```typescript
interface BudgetTemplate {
  templateId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  shareLevel: 'private' | 'team' | 'public';
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  usageCount: number;
  rating: number;
  structure: BudgetStructure;
  preview: TemplatePreview;
}

interface BudgetStructure {
  period: 'monthly' | 'quarterly' | 'yearly';
  totalAmount: number;
  categories: CategoryConfig[];
  alertRules: AlertRule[];
  customFields: CustomField[];
}

interface TemplatePreview {
  sampleData: any;
  visualChart: ChartConfig;
  estimatedBudget: number;
  applicableScenarios: string[];
}
```

### 6.3 範本操作回應
```typescript
interface TemplateOperationResponse {
  success: boolean;
  templateId?: string;
  message: string;
  validationErrors?: ValidationError[];
  appliedBudgetId?: string;
}
```

---

## 7. 驗證規則（Validation Rules）

### 7.1 範本建立驗證
- **名稱唯一性**: 個人範本名稱不可重複
- **結構完整性**: 至少包含一個預算分類
- **金額合理性**: 總金額分配不得超過100%
- **權限一致性**: 分享設定需符合使用者權限

### 7.2 範本套用驗證
- **帳本相容性**: 檢查範本與目標帳本的相容性
- **分類對應**: 驗證範本分類是否存在於目標帳本
- **金額範圍**: 確認套用金額在合理範圍內
- **權限檢查**: 確認使用者對目標帳本有建立預算權限

### 7.3 分享權限驗證
- **團隊權限**: 分享到團隊需要團隊成員身份
- **公開審核**: 公開範本需要通過內容審核
- **修改限制**: 已分享範本的結構修改需要權限確認

---

## 8. 錯誤處理（Error Handling）

### 8.1 範本載入錯誤
- **顯示訊息**: "範本載入失敗，請檢查網路連線"
- **處理方式**: 提供重試按鈕，顯示快取範本
- **UI反應**: 顯示載入失敗占位符

### 8.2 範本套用錯誤
- **顯示訊息**: "範本套用失敗：{具體原因}"
- **處理方式**: 提供修正建議，允許手動調整
- **UI反應**: 高亮顯示問題區域

### 8.3 權限不足錯誤
- **顯示訊息**: "您沒有權限執行此操作"
- **處理方式**: 引導申請權限或聯絡管理員
- **UI反應**: 隱藏或禁用相關功能按鈕

---

## 9. UI元件與排版需求（UI Requirements）

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 範本卡片 | Card | 顯示範本資訊 | 點擊預覽，長按多選 |
| 分類篩選器 | FilterChips | 篩選範本類型 | 多選篩選，動態更新 |
| 搜尋列 | SearchBar | 搜尋範本 | 即時搜尋，歷史記錄 |
| 範本建立器 | Wizard | 引導建立範本 | 步驟式引導，可跳步 |
| 結構編輯器 | TreeEditor | 編輯預算結構 | 拖拽排序，即時預覽 |
| 預覽面板 | PreviewPanel | 範本效果預覽 | 圖表展示，數據模擬 |
| 分享設定 | PermissionPanel | 設定分享權限 | 權限選擇，可見性控制 |

### 9.1 響應式佈局設計
```css
.template-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.template-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 16px;
  flex: 1;
}

@media (min-width: 768px) {
  .template-content {
    display: grid;
    grid-template-columns: 250px 1fr 300px;
    gap: 16px;
  }
}
```

### 9.2 範本卡片設計
```css
.template-card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.template-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #4CAF50, #2196F3, #FF9800);
}

.template-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.template-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #4CAF50, #81C784);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 20px;
}

.template-title {
  font-size: 18px;
  font-weight: 600;
  color: #212121;
  margin: 8px 0;
}

.template-description {
  font-size: 14px;
  color: #757575;
  line-height: 1.4;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.template-tag {
  background: #E3F2FD;
  color: #1976D2;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.template-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #9E9E9E;
}

.template-usage {
  display: flex;
  align-items: center;
  gap: 4px;
}

.template-rating {
  display: flex;
  align-items: center;
  gap: 4px;
}
```

---

## 10. API 規格（如有）（API Specification）

### 10.1 取得範本清單

#### Request
- **URL**: `/api/budget-templates`
- **Method**: `GET`
- **Query Parameters**:
```json
{
  "category": "生活|事業|投資|旅遊",
  "shareLevel": "private|team|public",
  "tags": "標籤1,標籤2",
  "search": "搜尋關鍵字",
  "sortBy": "created|usage|rating",
  "page": 1,
  "limit": 20
}
```

#### Response - 成功
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "templateId": "tmpl_123456",
        "name": "月度生活預算",
        "description": "適合一般家庭的月度預算規劃",
        "category": "生活",
        "tags": ["家庭", "月度", "基本"],
        "shareLevel": "public",
        "createdBy": "user_789",
        "createdAt": "2025-01-01T00:00:00Z",
        "usageCount": 150,
        "rating": 4.5,
        "structure": {
          "period": "monthly",
          "totalAmount": 50000,
          "categories": [
            {
              "name": "食物",
              "amount": 15000,
              "percentage": 30
            }
          ]
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100
    }
  }
}
```

### 10.2 建立範本

#### Request
- **URL**: `/api/budget-templates`
- **Method**: `POST`
- **Body**:
```json
{
  "name": "我的預算範本",
  "description": "個人化預算範本",
  "category": "生活",
  "tags": ["個人", "自訂"],
  "shareLevel": "private",
  "structure": {
    "period": "monthly",
    "totalAmount": 40000,
    "categories": [
      {
        "name": "食物",
        "amount": 12000,
        "percentage": 30,
        "alertThreshold": 80
      }
    ],
    "alertRules": [
      {
        "type": "percentage",
        "threshold": 80,
        "action": "notify"
      }
    ]
  }
}
```

#### Response - 成功
```json
{
  "success": true,
  "data": {
    "templateId": "tmpl_789012",
    "message": "範本建立成功"
  }
}
```

### 10.3 套用範本到預算

#### Request
- **URL**: `/api/budget-templates/{templateId}/apply`
- **Method**: `POST`
- **Body**:
```json
{
  "budgetName": "2025年1月預算",
  "ledgerId": "ledger_456",
  "totalAmount": 45000,
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "customizations": {
    "adjustedCategories": [
      {
        "categoryName": "食物",
        "newAmount": 13500
      }
    ]
  }
}
```

#### Response - 成功
```json
{
  "success": true,
  "data": {
    "budgetId": "budget_345678",
    "appliedTemplate": "tmpl_789012",
    "message": "範本套用成功，預算已建立"
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 頁面狀態管理
```typescript
enum TemplatePageState {
  LOADING = 'loading',           // 載入中
  BROWSING = 'browsing',         // 瀏覽範本
  CREATING = 'creating',         // 建立範本
  EDITING = 'editing',           // 編輯範本
  PREVIEWING = 'previewing',     // 預覽範本
  APPLYING = 'applying',         // 套用範本
  ERROR = 'error'               // 錯誤狀態
}
```

### 11.2 範本建立狀態
```typescript
enum TemplateCreationState {
  BASIC_INFO = 'basic_info',     // 基本資訊設定
  STRUCTURE = 'structure',       // 結構設定
  ALERTS = 'alerts',            // 警示規則
  SHARING = 'sharing',          // 分享設定
  PREVIEW = 'preview',          // 預覽確認
  SAVING = 'saving'             // 儲存中
}
```

### 11.3 狀態轉換處理
```css
.state-transition {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.loading-state {
  opacity: 0.6;
  pointer-events: none;
}

.loading-state::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border: 4px solid #E0E0E0;
  border-top: 4px solid #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-state {
  background: #FFEBEE;
  border: 1px solid #E57373;
  color: #D32F2F;
}

.success-state {
  background: #E8F5E8;
  border: 1px solid #81C784;
  color: #388E3C;
}
```

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 範本存取權限
- **私人範本**: 僅建立者可存取和修改
- **團隊範本**: 團隊成員可檢視，管理員可修改
- **公開範本**: 所有用戶可檢視，僅建立者可修改

### 12.2 範本套用權限
- **帳本權限**: 使用者必須對目標帳本有建立預算權限
- **金額限制**: 套用金額不可超過帳本設定的上限
- **分類限制**: 僅能使用帳本中已存在的分類

### 12.3 內容安全控制
- **範本審核**: 公開範本需要通過內容審核
- **惡意內容**: 自動檢測和阻擋惡意或不當內容
- **資料驗證**: 嚴格驗證範本結構的合理性

---

## 13. 其他補充需求（Others）

### 13.1 國際化多語言需求
- **支援語言**: 繁體中文、簡體中文、英文、日文
- **範本名稱**: 支援多語言範本名稱和描述
- **分類翻譯**: 預算分類自動翻譯對應

### 13.2 無障礙設計考量
- **鍵盤導航**: 支援完整的鍵盤操作流程
- **螢幕閱讀器**: 範本卡片提供完整的語音描述
- **高對比**: 支援高對比顯示模式
- **字體縮放**: 適應系統字體大小設定

### 13.3 效能最佳化
- **範本快取**: 常用範本本地快取30分鐘
- **懶載入**: 範本清單分頁載入，圖片延遲載入
- **搜尋最佳化**: 搜尋結果快取，減少API呼叫

### 13.4 四模式差異化設計

#### 精準控制者模式
- 提供完整的範本編輯和自訂功能
- 支援複雜的結構設定和進階篩選
- 完整的分享和協作功能

#### 紀錄習慣者模式
- 強調視覺化的範本預覽
- 提供美觀的範本卡片設計
- 簡化的套用流程

#### 轉型挑戰者模式
- 聚焦於目標導向的範本推薦
- 提供預算挑戰相關的範本
- 整合習慣養成功能

#### 潛在覺醒者模式
- 僅提供基本的預設範本
- 超大按鈕和簡化的操作介面
- 重點推薦熱門和簡單的範本
