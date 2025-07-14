
# BR-0008 解決Invalid reply token status 400問題之A/B testing

## 1. 需求說明
本次變更目標為：解決LINE OA簡單記帳功能中頻繁出現的`Invalid reply token status 400`錯誤，透過大幅減少資訊流經過的函數數量，並將同模組內的不同函數整合成單一函數，以將處理時間控制在LINE Reply Token 60秒時效限制內。

此調整專門針對LINE文字記帳場景的超簡化處理路徑，透過A/B testing驗證效能提升，Rich Menu和APP功能仍維持原有標準路徑。

---

## 2. 業務背景與痛點

### 2.1 現狀問題分析
- **Reply Token超時**：當前資訊流經過26個函數，處理時間經常超過60秒導致`Invalid reply token`
- **函數冗餘過多**：簡單記帳場景不需要複雜的驗證、模糊匹配等功能
- **同步處理瓶頸**：多層模組調用增加延遲風險，影響用戶體驗
- **架構過度設計**：標準路徑對簡單記帳場景來說過於複雜

### 2.2 當前資訊流函數數量分析
#### 現行路徑：26個函數
**WH模組（8個函數）**：
- `doPost()` - Webhook入口
- `processWebhookSync()` - 同步處理
- `WH_processEventSync()` - 事件處理
- `WH_checkDuplicateMessage()` - 訊息去重
- `WH_verifySignature()` - 簽章驗證
- `WH_directLogWrite()` - 日誌寫入
- `WH_replyMessage()` - 訊息回覆
- `WH_formatDateTime()` - 時間格式化

**BK模組（15個函數）**：
- `BK_processDirectBookkeeping()` - 核心入口
- `BK_processUserMessage()` - 訊息處理
- `BK_parseInputFormat()` - 格式解析
- `BK_getSubjectCode()` - 科目查詢
- `BK_fuzzyMatch()` - 模糊匹配
- `BK_getAllSubjects()` - 科目資料獲取
- `BK_removeAmountFromText()` - 文字處理
- `BK_processBookkeeping()` - 記帳主函數
- `BK_generateBookkeepingId()` - ID生成
- `BK_prepareBookkeepingData()` - 數據準備
- `BK_validatePaymentMethod()` - 支付方式驗證
- `BK_saveToFirestore()` - 數據儲存
- `BK_initialize()` - 模組初始化
- `BK_formatDateTime()` - 時間格式化
- `BK_validateData()` - 數據驗證

**其他模組（3個函數）**：
- `AM_ensureUserSubjects()` - 科目初始化
- `initializeFirestore()` - Firestore初始化
- `admin.firestore().collection().add()` - Firebase寫入

### 2.3 預期效益
- 函數數量：26個 → 8個（減少69%）
- 處理時間：>60秒 → <15秒（降低75%）
- Reply Token超時率：降低至5%以下
- 維護複雜度：大幅降低

---

## 3. 須修改/新增內容

### 3.1 超簡化路徑設計（目標：8個函數）

#### 3.1.1 WH模組函數整合（4個函數）
**保留函數**：
- `doPost()` - Webhook入口（保持不變）
- `WH_fastTrack()` - **新增**：超簡化同步處理
- `WH_quickReply()` - **新增**：快速回覆機制
- `WH_simpleLog()` - **新增**：輕量日誌記錄

**整合邏輯**：
- 將`processWebhookSync()` + `WH_processEventSync()` + `WH_checkDuplicateMessage()`整合為`WH_fastTrack()`
- 將`WH_replyMessage()` + `WH_formatDateTime()`整合為`WH_quickReply()`
- 將`WH_directLogWrite()` + `WH_verifySignature()`整合為`WH_simpleLog()`

#### 3.1.2 BK模組函數整合（4個函數）
**超簡化函數**：
- `BK_quickBookkeeping()` - **新增**：一站式記帳處理
- `BK_fastParse()` - **新增**：快速解析與匹配
- `BK_directSave()` - **新增**：直接儲存到Firestore
- `BK_simpleFormat()` - **新增**：簡化回覆格式

**整合邏輯**：
- 將解析類函數（`BK_parseInputFormat()` + `BK_removeAmountFromText()`）整合為`BK_fastParse()`
- 將匹配類函數（`BK_getSubjectCode()` + 精確匹配邏輯）整合為`BK_fastParse()`
- 將處理類函數（`BK_processBookkeeping()` + `BK_prepareBookkeepingData()` + `BK_generateBookkeepingId()`）整合為`BK_quickBookkeeping()`
- 將儲存類函數（`BK_saveToFirestore()` + Firestore初始化）整合為`BK_directSave()`

### 3.2 超簡化架構流程
```
用戶LINE訊息 → WH_fastTrack() → BK_quickBookkeeping() → WH_quickReply()
                     ↓              ↓                    ↓
               WH_simpleLog()   BK_directSave()    (回覆用戶)
```

### 3.3 函數簡化策略

#### 3.3.1 移除的功能（簡單記帳不需要）
- 訊息去重檢查（`WH_checkDuplicateMessage()`）
- 模糊匹配（`BK_fuzzyMatch()`）
- 完整科目資料載入（`BK_getAllSubjects()`）
- 複雜數據驗證（`BK_validateData()`）
- 科目自動初始化（`AM_ensureUserSubjects()`）

#### 3.3.2 簡化的功能
- 簽章驗證：整合到`WH_simpleLog()`，測試模式直接跳過
- 時間格式化：使用原生JavaScript，移除moment.js依賴
- 支付方式驗證：預設處理，移除複雜驗證邏輯
- 日誌記錄：僅記錄關鍵信息，減少寫入次數

---

## 4. A/B Testing 策略

### 4.1 測試設計
- **A組（控制組）**：使用現有26函數標準路徑
- **B組（實驗組）**：使用新8函數超簡化路徑
- **流量分配**：50% A組，50% B組
- **測試對象**：LINE OA文字記帳用戶

### 4.2 成功指標 (KPI)
- **主要指標**：Reply Token成功率 > 95%
- **次要指標**：
  - 平均處理時間 < 15秒
  - 記帳功能準確率 > 99%
  - 用戶滿意度（回應時間）提升30%

### 4.3 監控機制
- 即時監控Reply Token錯誤率
- 處理時間分布統計
- 記帳數據完整性檢查
- 用戶反饋收集

---

## 5. 技術架構設計

### 5.1 路徑判斷邏輯
```javascript
// WH模組中的路徑選擇
if (isSimpleBookkeeping(message) && enableABTest) {
  if (userGroup === 'B') {
    return WH_fastTrack(message); // 超簡化路徑
  }
}
return processWebhookSync(message); // 標準路徑
```

### 5.2 超簡化路徑函數設計

#### 5.2.1 WH_fastTrack()
```javascript
/**
 * 超簡化Webhook處理 - 整合多個函數
 * 整合：processWebhookSync + WH_processEventSync + 基本驗證
 */
async function WH_fastTrack(event, replyToken) {
  // 極簡事件處理 + 訊息提取 + 調用BK
  const result = await BK_quickBookkeeping(message);
  await WH_quickReply(replyToken, result);
}
```

#### 5.2.2 BK_quickBookkeeping()
```javascript
/**
 * 一站式記帳處理 - 整合解析、匹配、處理
 * 整合：BK_fastParse + 精確匹配 + 數據準備 + ID生成
 */
async function BK_quickBookkeeping(messageData) {
  // 快速解析 → 精確匹配 → 數據準備 → 調用儲存
  const parseResult = BK_fastParse(messageData.text);
  const bookkeepingData = prepareQuickData(parseResult);
  const saveResult = await BK_directSave(bookkeepingData);
  return formatQuickResponse(saveResult);
}
```

### 5.3 降級機制
- 超簡化路徑失敗時，自動切換到標準路徑
- 保持數據一致性和用戶體驗
- 記錄降級原因供後續優化

---

## 6. 實作階段規劃

### Phase 1：超簡化函數開發（Week 1-2）
- 開發4個WH超簡化函數
- 開發4個BK超簡化函數
- 單元測試與功能驗證

### Phase 2：A/B Testing基礎設施（Week 3）
- 實作用戶分群邏輯
- 建立監控指標收集
- 實作降級機制

### Phase 3：灰度發布與測試（Week 4）
- 5%流量灰度測試
- 監控指標分析
- 問題修復與優化

### Phase 4：全量A/B Testing（Week 5-6）
- 50/50流量分配測試
- 完整數據收集
- 效能分析與決策

### Phase 5：結果分析與決策（Week 7）
- A/B測試結果分析
- 決定是否全量切換
- 文檔更新與知識轉移

---

## 7. 風險評估與緩解

### 7.1 技術風險
- **風險**：超簡化路徑功能缺失
- **緩解**：完整的功能對比測試，保留降級機制

### 7.2 數據風險
- **風險**：記帳數據不一致
- **緩解**：嚴格的數據驗證，雙路徑結果比對

### 7.3 用戶體驗風險
- **風險**：新路徑處理異常
- **緩解**：快速回退機制，24小時監控

---

## 8. 驗收標準

### 8.1 功能驗收
- [ ] A/B Testing基礎設施運作正常
- [ ] 超簡化路徑記帳功能準確率 > 99%
- [ ] 降級機制正常運作
- [ ] 監控指標收集完整

### 8.2 效能驗收
- [ ] B組Reply Token成功率 > 95%
- [ ] B組平均處理時間 < 15秒
- [ ] 函數調用數量減少 > 65%
- [ ] 記帳成功率與A組相當

### 8.3 業務驗收
- [ ] 用戶滿意度無下降
- [ ] 記帳數據完整性100%
- [ ] 系統穩定性無退化

---

## 9. 成功定義與後續行動

### 9.1 成功定義
- B組Reply Token錯誤率 < A組50%
- B組處理時間 < A組60%
- 記帳準確率差異 < 1%

### 9.2 成功後行動
- 全量切換至超簡化路徑
- 移除冗餘函數和代碼
- 更新文檔和維護指南

### 9.3 失敗後行動
- 分析失敗原因
- 優化超簡化路徑
- 重新設計測試方案

---

## 10. 其他注意事項

- A/B Testing期間請勿修改相關函數
- 所有變更需要完整的單元測試覆蓋
- 監控數據需要每日檢視和分析
- 保持與BR-0007的相容性和一致性

---

> **重要提醒**：本次變更是針對Reply Token超時問題的緊急優化，必須確保在提升效能的同時不影響記帳功能的準確性和用戶體驗。所有開發人員請嚴格遵循A/B Testing流程，並在每個階段完成後進行充分的數據分析。
