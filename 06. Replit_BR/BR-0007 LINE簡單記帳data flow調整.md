
# BR-0007 LINE簡單記帳data flow調整

## 1. 需求說明
本次變更目標為：針對 LINE OA 簡單記帳功能，優化資訊流處理路徑，將現行 `WH → DD → BK → Firestore` 流程簡化為 `WH → BK 2.0 → Firestore`，以提升處理效能並符合 LINE Reply Token 60秒時效限制。

此調整專門針對 LINE 文字記帳場景，Rich Menu 和 APP 功能仍維持原有標準路徑 `WH → DD → BK → Firestore`。

---

## 2. 業務背景與痛點

### 2.1 現狀問題
- LINE Reply Token 有效期限僅 60 秒，當前多層調用可能導致逾時
- 簡單記帳場景不需要 DD 模組的完整資料分發邏輯
- 跨模組調用增加延遲風險，影響用戶體驗

### 2.2 預期效益
- 減少約 30-50% 的函數調用開銷
- 降低 100-200ms 的處理延遲
- 提高 40% 的穩定性（減少失敗點）
- 保持架構擴展性（Rich Menu/APP 走標準路徑）

---

## 3. 須修改/新增內容

### 3.1 BK 模組增強（BK 2.0）
需要從 DD 模組複製並重新命名以下核心函數：

#### 3.1.1 文字解析核心函數（來自 DD2）
- `DD_processUserMessage` → `BK_processUserMessage`
- `DD_parseInputFormat` → `BK_parseInputFormat`
- `DD_removeAmountFromText` → `BK_removeAmountFromText`

#### 3.1.2 科目匹配函數（來自 DD2）
- `DD_getSubjectCode` → `BK_getSubjectCode`
- `DD_fuzzyMatch` → `BK_fuzzyMatch`
- `DD_checkMultipleMapping` → `BK_checkMultipleMapping`

#### 3.1.3 資料庫查詢函數（來自 DD1）
- `DD_getAllSubjects` → `BK_getAllSubjects`
- `DD_getLedgerInfo` → `BK_getLedgerInfo`

#### 3.1.4 日誌處理函數（來自 DD1）
- `DD_writeToLogSheet` → `BK_writeToLogSheet`
- `DD_logDebug` → `BK_logDebug`
- `DD_logInfo` → `BK_logInfo`
- `DD_logWarning` → `BK_logWarning`
- `DD_logError` → `BK_logError`

#### 3.1.5 回覆格式化函數（來自 DD3）
- `DD_formatSystemReplyMessage` → `BK_formatSystemReplyMessage`

#### 3.1.6 工具函數（來自 DD1/DD2）
- `DD_convertTimestamp` → `BK_convertTimestamp`
- `calculateLevenshteinDistance` → `BK_calculateLevenshteinDistance`

### 3.2 WH 模組調整
- 新增判斷邏輯：識別 LINE 簡單記帳請求
- 實作 `WH → BK 2.0` 直連路徑
- 保持原有 `WH → DD → BK` 路徑供 Rich Menu 和 APP 使用

### 3.3 資料結構一致性
- 確保 BK 2.0 的回覆格式與原有 DD 路徑完全相容
- 維持與 Firestore 的資料存取格式一致
- 保持錯誤處理邏輯的統一性

---

## 4. 技術架構設計

### 4.1 簡化後架構
```
LINE 簡單記帳：
使用者訊息 → WH → BK 2.0 → Firestore
                ↓
           直接回覆使用者

Rich Menu/APP：
使用者請求 → WH → DD → BK → Firestore
                      ↓
                 格式化回覆
```

### 4.2 判斷邏輯
WH 模組根據以下條件選擇路徑：
- **簡化路徑**：純文字記帳訊息（如："早餐 50"、"收入 1000"）
- **標準路徑**：Rich Menu 按鈕、Postback 事件、APP API 請求

---

## 5. 不在本次範圍

- 不刪除任何現有 DD 模組函數
- 不影響 Rich Menu 和 APP 的現有功能
- 不修改 Firestore 資料結構
- 不進行向下相容性破壞

---

## 6. 實作階段規劃

### Phase 1：核心功能複製（Week 1）
- 複製 DD 核心解析函數到 BK 模組
- 重新命名函數（DD_ → BK_）
- 基本功能測試

### Phase 2：路徑判斷邏輯（Week 2）
- WH 模組增加路徑判斷機制
- 實作 `WH → BK 2.0` 直連
- 整合測試

### Phase 3：回覆格式化（Week 3）
- 整合 `BK_formatSystemReplyMessage`
- 確保回覆格式一致性
- 完整端到端測試

### Phase 4：效能驗證（Week 4）
- 效能基準測試
- Reply Token 時效性驗證
- 生產環境部署

---

## 7. 驗收標準

### 7.1 功能驗收
- [ ] LINE 簡單記帳功能正常運作
- [ ] Rich Menu 和 APP 功能不受影響
- [ ] 回覆格式與原有路徑完全一致
- [ ] 錯誤處理邏輯正確

### 7.2 效能驗收
- [ ] 處理延遲降低 100ms 以上
- [ ] Reply Token 60秒內回覆率達 99%
- [ ] 系統穩定性無退化

### 7.3 相容性驗收
- [ ] 現有 DD 模組功能不受影響
- [ ] Firestore 資料格式保持一致
- [ ] 日誌記錄完整性

---

## 8. 風險評估與緩解

### 8.1 技術風險
- **風險**：BK 模組複雜度增加
- **緩解**：採用模組化設計，清楚分離簡單記帳邏輯

### 8.2 維護風險
- **風險**：代碼重複導致維護困難
- **緩解**：建立共用函數庫，定期代碼檢視

### 8.3 相容性風險
- **風險**：回覆格式不一致
- **緩解**：完整的整合測試，嚴格格式驗證

---

## 9. 其他注意事項

- 開發過程中請維持現有代碼風格與註解規範
- 所有新增函數需要完整的錯誤處理和日誌記錄
- 測試覆蓋率需達到 90% 以上
- 效能測試需在類生產環境進行

---

> **重要提醒**：此需求調整僅針對 LINE 簡單記帳場景，不得影響現有 Rich Menu 和 APP 功能的穩定性。所有開發人員請嚴格遵循分階段實作計畫，並在每個階段完成後進行充分測試。
