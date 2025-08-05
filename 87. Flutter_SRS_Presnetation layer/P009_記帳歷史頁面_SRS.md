# P009_記帳歷史頁面_SRS

**文件版本**: v1.0.0  
**建立日期**: 2025-01-26  
**負責團隊**: LCAS PM Team  
**對應頁面**: P013 記帳歷史頁面

---

## 1. 功能目的（Purpose）

記帳歷史頁面提供完整的記帳記錄查詢、瀏覽與管理功能，使用者可以透過多種條件篩選、排序查看歷史記錄，並進行編輯、刪除等操作，是使用者管理記帳資料的核心頁面。

## 2. 使用者故事（User Story）

**身為** LCAS記帳應用程式的使用者  
**我希望** 能夠查看和管理我的所有記帳歷史記錄  
**以便於** 追蹤我的消費模式、檢視過往交易紀錄，並在需要時進行修正或刪除

### 2.1 驗收標準（Acceptance Criteria）
- 能夠以清單形式瀏覽所有記帳記錄
- 支援按日期、金額、科目、備註等條件進行篩選
- 支援按日期升降序、金額大小等方式排序
- 可以快速編輯或刪除任何記錄
- 支援批量操作（批量刪除、標記等）
- 提供搜尋功能快速定位特定記錄
- 支援分頁載入，提升大量資料瀏覽效能

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者必須完成登入驗證
- 使用者具備當前帳本的檢視權限
- 系統已完成與後端API連線

### 3.2 資料狀態
- 當前帳本至少存在一筆記帳記錄
- 記帳記錄資料完整且格式正確
- 科目分類資料已正確載入

### 3.3 系統狀態
- 網路連線正常
- 後端記帳服務正常運作
- 資料同步狀態正常

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
1. 從P010首頁儀表板或P011快速記帳頁面導航至P013
2. 系統顯示載入指示器
3. 呼叫API取得記帳歷史資料
4. 渲染記帳記錄清單（預設顯示最近30筆）
5. 載入篩選條件和排序選項

### 4.2 記錄查詢流程
1. 使用者設定篩選條件（日期範圍、科目、金額區間等）
2. 系統即時更新清單顯示
3. 支援多重條件組合篩選
4. 提供搜尋結果數量提示

### 4.3 記錄編輯流程
1. 使用者點擊記錄卡片的編輯按鈕
2. 導航至P014記帳編輯頁面
3. 傳遞記錄ID作為編輯參數
4. 編輯完成後返回P013並重新整理清單

### 4.4 記錄刪除流程
1. 使用者點擊刪除按鈕
2. 顯示確認對話框
3. 確認後呼叫刪除API
4. 成功後從清單移除該記錄
5. 顯示刪除成功提示

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| 篩選條件 | Object | 否 | 日期範圍、科目、金額區間 |
| 排序方式 | String | 否 | date_desc/date_asc/amount_desc/amount_asc |
| 搜尋關鍵字 | String | 否 | 在備註、商家名稱中搜尋 |
| 頁面大小 | Number | 否 | 每頁顯示筆數（預設20） |
| 頁面索引 | Number | 否 | 當前頁面編號 |
| 選中記錄ID | Array | 否 | 批量操作時的記錄ID清單 |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 記帳記錄清單 | Array | 符合條件的記帳記錄 |
| 總筆數 | Number | 符合篩選條件的總記錄數 |
| 篩選結果統計 | Object | 收入/支出總額、筆數統計 |
| 分頁資訊 | Object | 當前頁、總頁數、是否有下一頁 |
| 載入狀態 | Boolean | 資料載入中狀態 |
| 錯誤訊息 | String | 操作失敗時的錯誤說明 |

## 7. 驗證規則（Validation Rules）

### 7.1 篩選條件驗證
```javascript
// 日期範圍驗證
if (startDate && endDate) {
  return startDate <= endDate;
}

// 金額區間驗證
if (minAmount !== null && maxAmount !== null) {
  return minAmount <= maxAmount && minAmount >= 0;
}

// 搜尋關鍵字長度限制
if (searchKeyword) {
  return searchKeyword.length <= 50;
}
```

### 7.2 分頁參數驗證
```javascript
// 頁面大小限制
pageSize >= 10 && pageSize <= 100

// 頁面索引驗證
pageIndex >= 1 && pageIndex <= totalPages
```

### 7.3 操作權限驗證
```javascript
// 編輯權限檢查
canEdit = userRole === 'owner' || userRole === 'editor'

// 刪除權限檢查
canDelete = userRole === 'owner' || (userRole === 'editor' && record.createdBy === userId)
```

## 8. 錯誤處理（Error Handling）

### 8.1 資料載入錯誤
```javascript
try {
  const response = await fetchTransactionHistory(filters);
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    showErrorMessage('網路連線異常，請檢查網路設定');
  } else if (error.code === 'UNAUTHORIZED') {
    redirectToLogin();
  } else {
    showErrorMessage('載入記帳記錄失敗，請稍後再試');
  }
}
```

### 8.2 刪除操作錯誤
```javascript
try {
  await deleteTransaction(recordId);
  showSuccessMessage('記錄已成功刪除');
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    showErrorMessage('您沒有權限刪除此記錄');
  } else if (error.code === 'RECORD_NOT_FOUND') {
    showErrorMessage('記錄不存在或已被刪除');
  } else {
    showErrorMessage('刪除失敗，請稍後再試');
  }
}
```

### 8.3 搜尋超時處理
```javascript
const searchTimeout = setTimeout(() => {
  showErrorMessage('搜尋請求超時，請稍後再試');
  setLoading(false);
}, 10000);
```

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 響應式設計規範
- **手機版** (< 768px)：單欄清單布局，卡片式設計
- **平板版** (768px - 1024px)：雙欄清單，側邊篩選面板
- **桌面版** (> 1024px)：三欄布局，完整功能面板

### 9.2 記錄卡片設計
```css
.transaction-card {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid var(--category-color);
}

.transaction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.transaction-amount {
  font-size: 18px;
  font-weight: 600;
}

.amount-income {
  color: #4CAF50;
}

.amount-expense {
  color: #F44336;
}

.transaction-details {
  font-size: 14px;
  color: #666666;
  line-height: 1.4;
}

.transaction-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
```

### 9.3 篩選面板設計
```css
.filter-panel {
  background: #F8F9FA;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.filter-input {
  flex: 1;
  height: 40px;
  border: 1px solid #E0E0E0;
  border-radius: 8px;
  padding: 0 12px;
}

.filter-button {
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  border: none;
  background: #2196F3;
  color: #FFFFFF;
  cursor: pointer;
}
```

### 9.4 分頁控制設計
```css
.pagination-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
}

.pagination-button {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid #E0E0E0;
  background: #FFFFFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination-button.active {
  background: #2196F3;
  color: #FFFFFF;
  border-color: #2196F3;
}
```

## 10. API 規格（API Specification）

### 10.1 取得記帳歷史API
**端點**: GET /api/transactions/history  
**對應**: F002 記帳功能

**請求參數**:
```
?ledgerId=string&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&categoryId=string&minAmount=number&maxAmount=number&search=string&sortBy=string&sortOrder=asc|desc&page=number&limit=number
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "string",
        "date": "YYYY-MM-DD",
        "amount": "number",
        "type": "income|expense",
        "categoryId": "string",
        "categoryName": "string",
        "categoryColor": "string",
        "description": "string",
        "merchant": "string",
        "paymentMethod": "string",
        "tags": ["string"],
        "createdBy": "string",
        "createdAt": "ISO_8601_datetime",
        "updatedAt": "ISO_8601_datetime"
      }
    ],
    "pagination": {
      "currentPage": "number",
      "totalPages": "number",
      "totalRecords": "number",
      "hasNextPage": "boolean",
      "hasPreviousPage": "boolean"
    },
    "summary": {
      "totalIncome": "number",
      "totalExpense": "number",
      "netAmount": "number",
      "transactionCount": "number"
    }
  }
}
```

### 10.2 刪除記帳記錄API
**端點**: DELETE /api/transactions/{transactionId}  
**對應**: F002 記帳功能

**回應格式**:
```json
{
  "success": true,
  "data": {
    "deletedTransactionId": "string",
    "deletedAt": "ISO_8601_datetime"
  }
}
```

### 10.3 批量刪除API
**端點**: DELETE /api/transactions/batch  
**對應**: F002 記帳功能

**請求格式**:
```json
{
  "transactionIds": ["string"],
  "ledgerId": "string"
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 主要狀態管理
```javascript
const [transactions, setTransactions] = useState([]);
const [loading, setLoading] = useState(true);
const [filters, setFilters] = useState({
  startDate: null,
  endDate: null,
  categoryId: null,
  searchKeyword: '',
  sortBy: 'date',
  sortOrder: 'desc'
});
const [pagination, setPagination] = useState({
  currentPage: 1,
  pageSize: 20,
  totalPages: 0,
  totalRecords: 0
});
const [selectedIds, setSelectedIds] = useState([]);
const [showBatchActions, setShowBatchActions] = useState(false);
```

### 11.2 畫面切換邏輯
```javascript
// 編輯記錄
const handleEditTransaction = (transactionId) => {
  navigation.navigate('P014', { 
    transactionId,
    returnTo: 'P013'
  });
};

// 新增記錄
const handleAddTransaction = () => {
  navigation.navigate('P011', {
    returnTo: 'P013'
  });
};

// 查看統計
const handleViewStatistics = () => {
  navigation.navigate('P018', {
    filters: currentFilters
  });
};
```

### 11.3 資料重新整理機制
```javascript
// 頁面焦點返回時重新整理
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    if (route.params?.shouldRefresh) {
      refreshTransactionList();
    }
  });
  return unsubscribe;
}, [navigation]);
```

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 資料存取權限
```javascript
// 檢查帳本存取權限
const checkLedgerAccess = async (ledgerId) => {
  const permissions = await getUserLedgerPermissions(ledgerId);
  return permissions.includes('read');
};

// 檢查記錄編輯權限
const checkEditPermission = (transaction, userRole, userId) => {
  return userRole === 'owner' || 
         (userRole === 'editor' && transaction.createdBy === userId);
};
```

### 12.2 敏感資料保護
```javascript
// 資料脫敏處理
const sanitizeTransactionData = (transaction) => {
  return {
    ...transaction,
    // 移除敏感資訊
    createdBy: transaction.createdBy === currentUserId ? 'you' : 'other'
  };
};
```

### 12.3 輸入資料驗證
```javascript
// 防止XSS攻擊
const sanitizeSearchInput = (input) => {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

// SQL注入防護（後端API負責）
```

## 13. 其他補充需求（Others）

### 13.1 效能最佳化
- 實作虛擬滾動，支援大量資料載入
- 使用分頁載入，避免一次載入過多資料
- 實作資料快取機制，減少重複API呼叫
- 圖片延遲載入，提升頁面載入速度

### 13.2 無障礙設計
- 支援螢幕閱讀器，提供語意化標籤
- 鍵盤導航支援，所有功能可通過鍵盤操作
- 顏色對比度符合WCAG 2.1 AA標準
- 提供語音輸入搜尋功能

### 13.3 離線支援
- 快取最近查看的記錄清單
- 離線狀態下顯示快取資料
- 網路恢復後自動同步最新資料
- 離線編輯支援，網路恢復後上傳

### 13.4 資料匯出功能
- 支援CSV格式匯出篩選結果
- 支援Excel格式匯出（含圖表）
- 支援PDF格式匯出（含統計圖表）
- 支援自定義匯出欄位選擇

---

**版本歷史**:
- v1.0.0 (2025-01-26): 初始版本建立，完整SRS規格制定