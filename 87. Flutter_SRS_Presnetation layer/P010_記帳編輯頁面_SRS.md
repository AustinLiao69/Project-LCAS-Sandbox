# P010_記帳編輯頁面_SRS

**文件編號**: P010-SRS
**文件版本**: v1.0.0  
**建立日期**: 2025-01-26  
**負責團隊**: LCAS PM Team  
**對應頁面**: P014 記帳編輯頁面

---

## 1. 功能目的（Purpose）

記帳編輯頁面提供完整的記帳記錄修改功能，使用者可以修改現有記錄的所有欄位資訊，包括金額、科目、日期、備註等，確保記帳資料的準確性和完整性。

## 2. 使用者故事（User Story）

**身為** LCAS記帳應用程式的使用者  
**我希望** 能夠編輯和修正我的記帳記錄  
**以便於** 更正輸入錯誤、補充遺漏資訊，或調整記錄以反映實際情況

### 2.1 驗收標準（Acceptance Criteria）
- 能夠載入並顯示現有記錄的所有欄位資料
- 支援修改金額、科目、日期、備註等所有可編輯欄位
- 提供輸入驗證，確保資料格式正確
- 支援儲存修改並返回原頁面
- 提供取消編輯功能，不儲存變更
- 修改後自動更新相關統計和報表數據
- 記錄編輯歷程，提供審計追蹤

## 3. 前置條件（Preconditions）

### 3.1 使用者狀態
- 使用者必須完成登入驗證
- 使用者具備當前記錄的編輯權限
- 使用者具備當前帳本的寫入權限

### 3.2 資料狀態
- 記錄ID有效且存在於系統中
- 記錄未被其他使用者同時編輯
- 科目分類資料已正確載入
- 記錄狀態允許編輯（非已確認或鎖定狀態）

### 3.3 系統狀態
- 網路連線正常
- 後端記帳服務正常運作
- 資料同步狀態正常

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 頁面載入流程
1. 從P013記帳歷史頁面導航至P014（攜帶記錄ID）
2. 系統顯示載入指示器
3. 呼叫API取得記錄詳細資料
4. 載入科目分類和付款方式選項
5. 預填表單欄位
6. 顯示編輯介面

### 4.2 資料編輯流程
1. 使用者修改任一欄位內容
2. 系統即時進行格式驗證
3. 顯示驗證結果和錯誤提示
4. 啟用/停用儲存按鈕
5. 追蹤修改狀態，提示未儲存變更

### 4.3 儲存更新流程
1. 使用者點擊儲存按鈕
2. 執行完整資料驗證
3. 呼叫更新API提交變更
4. 顯示儲存進度指示器
5. 成功後顯示確認訊息
6. 返回來源頁面並重新整理

### 4.4 取消編輯流程
1. 使用者點擊取消或返回按鈕
2. 檢查是否有未儲存的變更
3. 如有變更，顯示確認對話框
4. 確認後返回來源頁面
5. 不儲存任何修改內容

## 5. 輸入項目（Inputs）

| 輸入項目 | 資料類型 | 必填 | 說明 |
|----------|----------|------|------|
| 記錄ID | String | 是 | 要編輯的記錄唯一識別碼 |
| 金額 | Number | 是 | 交易金額（正數） |
| 交易類型 | String | 是 | income/expense |
| 科目ID | String | 是 | 選擇的科目分類ID |
| 交易日期 | Date | 是 | 交易發生日期 |
| 商家/描述 | String | 否 | 商家名稱或交易描述 |
| 備註 | String | 否 | 額外說明資訊 |
| 付款方式 | String | 否 | 現金/信用卡/轉帳等 |
| 標籤 | Array | 否 | 自定義標籤陣列 |
| 位置資訊 | Object | 否 | GPS座標和地址 |

## 6. 輸出項目（Outputs / Responses）

| 輸出項目 | 資料類型 | 說明 |
|----------|----------|------|
| 更新結果 | Boolean | 記錄更新成功/失敗狀態 |
| 更新後記錄 | Object | 更新後的完整記錄資料 |
| 變更摘要 | Object | 修改欄位的變更前後對比 |
| 驗證錯誤 | Array | 輸入驗證失敗的錯誤清單 |
| 衝突資訊 | Object | 併發編輯衝突資訊 |
| 成功訊息 | String | 操作成功的確認訊息 |

## 7. 驗證規則（Validation Rules）

### 7.1 金額驗證
```javascript
// 金額格式驗證
const validateAmount = (amount) => {
  if (!amount || amount <= 0) {
    return '金額必須大於0';
  }
  if (amount > 999999999) {
    return '金額不能超過999,999,999';
  }
  if (!/^\d+(\.\d{1,2})?$/.test(amount.toString())) {
    return '金額格式錯誤，最多保留2位小數';
  }
  return null;
};
```

### 7.2 日期驗證
```javascript
// 交易日期驗證
const validateDate = (date) => {
  const today = new Date();
  const transactionDate = new Date(date);

  if (transactionDate > today) {
    return '交易日期不能晚於今天';
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  if (transactionDate < oneYearAgo) {
    return '交易日期不能早於一年前';
  }

  return null;
};
```

### 7.3 科目驗證
```javascript
// 科目選擇驗證
const validateCategory = (categoryId, type) => {
  if (!categoryId) {
    return '請選擇交易科目';
  }

  const category = categories.find(c => c.id === categoryId);
  if (!category) {
    return '所選科目不存在';
  }

  if (category.type !== type) {
    return '科目類型與交易類型不符';
  }

  return null;
};
```

### 7.4 描述長度驗證
```javascript
// 描述和備註長度限制
const validateDescription = (text, fieldName, maxLength = 100) => {
  if (text && text.length > maxLength) {
    return `${fieldName}不能超過${maxLength}個字元`;
  }
  return null;
};
```

## 8. 錯誤處理（Error Handling）

### 8.1 載入記錄錯誤
```javascript
try {
  const record = await fetchTransactionById(transactionId);
  setFormData(record);
} catch (error) {
  if (error.code === 'RECORD_NOT_FOUND') {
    showErrorMessage('記錄不存在或已被刪除');
    navigation.goBack();
  } else if (error.code === 'PERMISSION_DENIED') {
    showErrorMessage('您沒有權限編輯此記錄');
    navigation.goBack();
  } else {
    showErrorMessage('載入記錄失敗，請稍後再試');
  }
}
```

### 8.2 儲存更新錯誤
```javascript
try {
  await updateTransaction(transactionId, formData);
  showSuccessMessage('記錄已成功更新');
  navigation.goBack();
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    setValidationErrors(error.details);
    showErrorMessage('請檢查輸入資料格式');
  } else if (error.code === 'CONCURRENT_EDIT') {
    showConflictDialog(error.conflictData);
  } else if (error.code === 'PERMISSION_DENIED') {
    showErrorMessage('您沒有權限修改此記錄');
  } else {
    showErrorMessage('儲存失敗，請稍後再試');
  }
}
```

### 8.3 併發編輯衝突處理
```javascript
const handleConcurrentEdit = (conflictData) => {
  showDialog({
    title: '編輯衝突',
    content: '此記錄已被其他使用者修改',
    options: [
      { text: '重新載入最新版本', action: () => reloadRecord() },
      { text: '強制覆蓋', action: () => forceUpdate() },
      { text: '取消編輯', action: () => navigation.goBack() }
    ]
  });
};
```

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 響應式設計規範
- **手機版** (< 768px)：單欄表單布局，全螢幕編輯
- **平板版** (768px - 1024px)：雙欄表單，側邊預覽
- **桌面版** (> 1024px)：分割視窗，左編輯右預覽

### 9.2 編輯表單設計
```css
.edit-form-container {
  padding: 20px;
  background: #FFFFFF;
  border-radius: 12px;
  margin: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #E0E0E0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 16px;
}

.form-field {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #555555;
  margin-bottom: 8px;
}

.field-input {
  width: 100%;
  height: 48px;
  border: 2px solid #E0E0E0;
  border-radius: 8px;
  padding: 0 16px;
  font-size: 16px;
  transition: border-color 0.2s ease;
}

.field-input:focus {
  border-color: #2196F3;
  outline: none;
}

.field-input.error {
  border-color: #F44336;
}

.field-error {
  color: #F44336;
  font-size: 12px;
  margin-top: 4px;
}
```

### 9.3 金額輸入特殊設計
```css
.amount-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.amount-type-toggle {
  display: flex;
  border: 2px solid #E0E0E0;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}

.type-option {
  flex: 1;
  height: 40px;
  border: none;
  background: #F5F5F5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-option.active {
  background: #2196F3;
  color: #FFFFFF;
}

.type-option.income.active {
  background: #4CAF50;
}

.type-option.expense.active {
  background: #F44336;
}

.amount-input {
  font-size: 24px;
  font-weight: 600;
  text-align: right;
  padding-right: 48px;
}

.currency-symbol {
  position: absolute;
  right: 16px;
  font-size: 20px;
  color: #666666;
}
```

### 9.4 動作按鈕設計
```css
.action-buttons {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  padding: 16px;
  border-top: 1px solid #E0E0E0;
  display: flex;
  gap: 12px;
}

.cancel-button {
  flex: 1;
  height: 48px;
  border: 2px solid #E0E0E0;
  border-radius: 24px;
  background: #FFFFFF;
  color: #666666;
  font-size: 16px;
  font-weight: 500;
}

.save-button {
  flex: 2;
  height: 48px;
  border: none;
  border-radius: 24px;
  background: #2196F3;
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
}

.save-button:disabled {
  background: #BDBDBD;
  cursor: not-allowed;
}
```

## 10. API 規格（API Specification）

### 10.1 取得記錄詳細資料API
**端點**: GET /api/transactions/{transactionId}  
**對應**: F002 記帳功能

**回應格式**:
```json
{
  "success": true,
  "data": {
    "transactionId": "string",
    "ledgerId": "string",
    "amount": "number",
    "type": "income|expense",
    "categoryId": "string",
    "categoryName": "string",
    "date": "YYYY-MM-DD",
    "description": "string",
    "merchant": "string",
    "paymentMethod": "string",
    "tags": ["string"],
    "location": {
      "latitude": "number",
      "longitude": "number",
      "address": "string"
    },
    "attachments": ["string"],
    "createdBy": "string",
    "createdAt": "ISO_8601_datetime",
    "updatedAt": "ISO_8601_datetime",
    "version": "number"
  }
}
```

### 10.2 更新記錄API
**端點**: PUT /api/transactions/{transactionId}  
**對應**: F002 記帳功能

**請求格式**:
```json
{
  "amount": "number",
  "type": "income|expense",
  "categoryId": "string",
  "date": "YYYY-MM-DD",
  "description": "string",
  "merchant": "string",
  "paymentMethod": "string",
  "tags": ["string"],
  "location": {
    "latitude": "number",
    "longitude": "number",
    "address": "string"
  },
  "version": "number"
}
```

**回應格式**:
```json
{
  "success": true,
  "data": {
    "transactionId": "string",
    "updatedFields": ["string"],
    "oldValues": "object",
    "newValues": "object",
    "updatedAt": "ISO_8601_datetime",
    "version": "number"
  }
}
```

### 10.3 檢查編輯權限API
**端點**: GET /api/transactions/{transactionId}/permissions  
**對應**: F008 權限管理功能

**回應格式**:
```json
{
  "success": true,
  "data": {
    "canEdit": "boolean",
    "canDelete": "boolean",
    "editableFields": ["string"],
    "restrictions": {
      "reason": "string",
      "lockedBy": "string",
      "lockedUntil": "ISO_8601_datetime"
    }
  }
}
```

## 11. 狀態與畫面切換（State Handling）

### 11.1 表單狀態管理
```javascript
const [formData, setFormData] = useState({});
const [originalData, setOriginalData] = useState({});
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [validationErrors, setValidationErrors] = useState({});
const [hasChanges, setHasChanges] = useState(false);
const [categories, setCategories] = useState([]);
```

### 11.2 變更追蹤邏輯
```javascript
// 監控表單變更
useEffect(() => {
  const isChanged = JSON.stringify(formData) !== JSON.stringify(originalData);
  setHasChanges(isChanged);
}, [formData, originalData]);

// 欄位更新處理
const handleFieldChange = (field, value) => {
  setFormData(prev => ({
    ...prev,
    [field]: value
  }));

  // 清除該欄位的驗證錯誤
  if (validationErrors[field]) {
    setValidationErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }
};
```

### 11.3 頁面離開確認
```javascript
// 防止意外離開
useEffect(() => {
  const unsubscribe = navigation.addListener('beforeRemove', (e) => {
    if (!hasChanges) return;

    e.preventDefault();
    showDialog({
      title: '未儲存的變更',
      content: '您有未儲存的變更，確定要離開嗎？',
      actions: [
        { text: '取消', style: 'cancel' },
        { text: '離開', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) }
      ]
    });
  });

  return unsubscribe;
}, [navigation, hasChanges]);
```

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 編輯權限驗證
```javascript
// 頁面載入時檢查權限
const checkEditPermission = async (transactionId) => {
  try {
    const permissions = await getTransactionPermissions(transactionId);
    if (!permissions.canEdit) {
      showErrorMessage('您沒有權限編輯此記錄');
      navigation.goBack();
      return false;
    }
    return true;
  } catch (error) {
    showErrorMessage('權限檢查失敗');
    navigation.goBack();
    return false;
  }
};
```

### 12.2 資料完整性驗證
```javascript
// 樂觀鎖定機制
const handleSave = async () => {
  try {
    const updateData = {
      ...formData,
      version: originalData.version // 版本號檢查
    };

    await updateTransaction(transactionId, updateData);
  } catch (error) {
    if (error.code === 'VERSION_CONFLICT') {
      handleVersionConflict(error.latestVersion);
    }
  }
};
```

### 12.3 敏感資料處理
```javascript
// 輸入資料清理
const sanitizeInput = (data) => {
  return {
    ...data,
    description: data.description?.trim().slice(0, 100),
    merchant: data.merchant?.trim().slice(0, 50),
  };
};
```

## 13. 其他補充需求（Others）

### 13.1 自動儲存功能
- 每30秒自動儲存草稿至本地儲存
- 網路中斷時保留編輯內容
- 重新開啟時提示恢復未完成編輯
- 提供手動清除草稿選項

### 13.2 編輯歷程記錄
- 記錄每次修改的欄位和時間
- 提供變更歷史查看功能
- 支援復原到特定版本
- 追蹤編輯者資訊

### 13.3 智慧輔助功能
- 根據歷史記錄智慧建議商家名稱
- 自動完成常用描述內容
- 智慧科目分類建議
- 金額輸入智慧格式化

### 13.4 協作編輯支援
- 即時顯示其他使用者編輯狀態
- 欄位鎖定機制防止衝突
- 變更衝突自動合併
- 編輯權限即時更新

---

**版本歷史**:
- v1.0.0 (2025-01-26): 初始版本建立，完整SRS規格制定