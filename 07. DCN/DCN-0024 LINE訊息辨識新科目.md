
# DCN-0024 LINE訊息辨識新科目

**版本**: v1.0.0  
**建立日期**: 2025-12-15  
**建立者**: LCAS Team  
**文件描述**: LINE記帳模式的簡化科目辨識流程變更控制

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [LINE記帳辨識流程優化](#31-line記帳辨識流程優化)
   - 3.2 [0099文件簡化策略](#32-0099文件簡化策略)
   - 3.3 [資料流架構修正](#33-資料流架構修正)
   - 3.4 [使用者歸類介面設計](#34-使用者歸類介面設計)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [修正後資料流架構](#41-修正後資料流架構)
   - 4.2 [三步驟辨識流程](#42-三步驟辨識流程)
   - 4.3 [0099簡化策略技術實作](#43-0099簡化策略技術實作)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [資料欄位調整詳細說明](#6-資料欄位調整詳細說明)
### 7. [Before/After行為差異分析](#7-beforeafter行為差異分析)
### 8. [版本紀錄](#8-版本紀錄)

---

## 1. 需求說明

本次變更目標為：實作LINE記帳模式的新科目辨識與歸類機制，根據0071文件設計理念，建立簡化但完整的科目辨識流程。

此變更將實現：
1. 整合0071文件的三步驟辨識流程：輸入→識別→歸類
2. 實施0099文件簡化策略，優化LINE記帳體驗
3. 修正資料流架構：LINE輸入 → WH → AM → LBK模組
4. 建立標準化的使用者歸類介面

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **快速記帳體驗**：LINE記帳追求「秒級記帳」，需要簡化科目選擇流程
- **使用者主導歸類**：當系統無法識別時，提供清晰的歸類選項

### 2.2 預期效益
- **提升使用者體驗**：減少科目選擇的認知負擔
- **降低系統複雜度**：簡化0099文件結構，專注LINE記帳需求
- **增強記帳成功率**：清晰的歸類流程降低使用者困惑
- **建立擴展基礎**：為後續APP端Expert模式奠定基礎

---

## 3. 須新增/修改內容

### 3.1 LINE記帳辨識流程優化

#### 3.1.1 現有問題分析
- 0099文件包含完整的子科目結構，對LINE記帳造成選擇困難
- 缺乏標準化的新科目歸類流程
- 同義詞管理複雜，影響辨識精準度

#### 3.1.2 優化策略
```
簡化策略核心原則：
1. categoryName保留 - 提供基本科目分類
2. subCategoryName設為null - 移除複雜子分類
3. parentId保留，categoryId設為null - 維持基礎階層
4. synonyms清空 - 避免過多同義詞造成混淆
```

### 3.2 0099文件簡化策略

#### 3.2.1 資料欄位調整
**調整前（完整版）**：
```json
{
  "parentId": 101,
  "categoryName": "生活家用",
  "categoryId": 10103,
  "subCategoryName": "生活用品",
  "synonyms": "氣泡水鋼瓶,手帕,防曬乳..."
}
```

**調整後（LINE簡化版）**：
```json
{
  "parentId": 101,
  "categoryName": "生活家用",
  "categoryId": null,
  "subCategoryName": null,
  "synonyms": ""
}
```

#### 3.2.2 簡化理由分析
- **categoryName保留**：維持基本的科目識別能力
- **subCategoryName移除**：避免細分類造成的選擇困難
- **synonyms清空**：專注精準匹配，避免模糊匹配造成錯誤歸類
- **階層簡化**：保留parentId作為主分類，移除細分的categoryId

### 3.3 資料流架構修正

#### 3.3.1 修正前架構問題
原始文件中的資料流描述不完整：
```
LINE輸入 → LBK模組 → 科目識別 → 使用者確認 → Firebase儲存
```

#### 3.3.2 修正後完整架構
```
LINE輸入 → WH → AM → LBK模組 → 科目識別 → 使用者歸類確認 → Firebase儲存
```

**各層職責說明**：
- **WH層**：接收LINE Webhook，處理訊息完整性
- **AM層**：驗證用戶身份，確保帳本存在，自動註冊新用戶
- **LBK層**：執行LINE快速記帳邏輯，包含新科目辨識

### 3.4 使用者歸類介面設計

#### 3.4.1 歸類選項設計
0099文件之categoryName及categoryId重構如下：

```
主科目選擇清單：
101 生鮮雜貨
102 生活家用
103 交通費用  
104 餐飲費用
105 娛樂消遣
106 運動嗜好
107 寵物生活
201 財務收入
301 財務支出
000 不歸類
```

#### 3.4.2 使用者互動流程
```
步驟1：使用者輸入「飯糰28」
步驟2：系統回覆科目選擇介面
步驟3：使用者輸入「104」
步驟4：系統確認歸類並完成記帳
```

---

## 4. 技術架構設計

### 4.1 修正後資料流架構

#### 4.1.1 完整資料流程
```
LINE使用者輸入
    ↓
WH模組（Webhook處理）
    ↓
AM模組（帳號驗證 & 帳本確認）
    ↓
LBK模組（快速記帳處理）
    ↓
科目識別邏輯
    ↓ (若科目不存在)
使用者歸類確認介面
    ↓
Firebase儲存（完整記帳資料）
```

#### 4.1.2 各模組協作機制
- **WH → AM**：用戶身份驗證，自動註冊機制
- **AM → LBK**：帳本ID傳遞，科目資料準備
- **LBK內部**：科目識別 → 新科目處理 → 使用者歸類

### 4.2 三步驟辨識流程

#### 4.2.1 步驟1：輸入解析
```javascript
// 解析使用者輸入：「飯糰28」
const parseResult = {
  subject: "飯糰",
  amount: 28,
  paymentMethod: "刷卡" // 預設值
}
```

#### 4.2.2 步驟2：科目識別
```javascript
// 在簡化的0099資料中查找
const subjectResult = await LBK_identifySubject("飯糰", userId);
if (!subjectResult.success) {
  // 觸發新科目歸類流程
  return LBK_handleNewSubjectClassification(parseResult);
}
```

#### 4.2.3 步驟3：歸類處理
```javascript
// 呈現歸類選項給使用者
const classificationOptions = {
  "101": "生活家用",
  "102": "餐飲費用", 
  "103": "交通費用",
  "000": "不歸類"
};
```

### 4.3 0099簡化策略技術實作

#### 4.3.1 資料庫儲存優化
```javascript
// LINE記帳專用的科目資料格式
const lineSubjectData = {
  id: `category_${parentId}`,
  parentId: parentId,
  categoryName: categoryName,
  categoryId: null,      // 簡化：設為null
  subCategoryName: null, // 簡化：設為null
  synonyms: "",          // 簡化：清空同義詞
  type: parentId === 801 || parentId === 899 ? 'income' : 'expense',
  isActive: true,
  userId: userId,
  ledgerId: ledgerId,
  dataSource: '0099. Subject_code.json (LINE_SIMPLIFIED)',
  createdAt: timestamp,
  module: 'LBK',
  version: '1.0.0'
};
```

#### 4.3.2 新科目歸類邏輯
```javascript
// 新科目歸類處理
async function LBK_handleNewSubjectClassification(inputData) {
  // 1. 回覆科目選擇介面
  const replyMessage = buildClassificationInterface();
  
  // 2. 等待使用者選擇
  // 3. 根據選擇建立新科目記錄
  // 4. 完成記帳流程
}
```

---

## 5. 實作階段規劃

### Phase 1：LBK模組新科目辨識邏輯（Week 1）

**目標**：在LBK模組中實作新科目辨識與歸類機制

**具體任務**：
1. 修改`LBK_identifySubject`函數，加入新科目檢測邏輯
2. 新增`LBK_handleNewSubjectClassification`函數
3. 實作使用者歸類介面訊息格式化
4. 整合歸類結果與記帳流程

**版本規劃**：LBK.js v1.4.0

**修改檔案**：
- `13. Replit_Module code_BL/1315. LBK.js`

**驗收標準**：
- 新科目能正確觸發歸類流程
- 歸類介面格式符合0071文件規範
- 歸類結果能正確儲存至Firebase

### Phase 2：資料流整合驗證（Week 2）

**目標**：驗證WH → AM → LBK完整資料流

**具體任務**：
1. 確認WH模組正確轉發新科目請求
2. 驗證AM模組的用戶驗證與帳本初始化
3. 測試完整的新科目歸類流程
4. 優化錯誤處理機制

**驗收標準**：
- 完整資料流運作正常
- 新用戶能自動註冊並歸類科目
- 錯誤情況有適當處理

### Phase 3：0099簡化策略實施（Week 3）

**目標**：實施0099文件簡化策略

**具體任務**：
1. 建立LINE記帳專用的簡化科目資料
2. 調整科目初始化邏輯
3. 驗證簡化後的科目識別效果
4. 文件更新與測試驗證

**最終版本**：完整的LINE記帳新科目辨識機制

---

## 6. 資料欄位調整詳細說明

### 6.1 Firebase Categories集合調整

#### 6.1.1 調整項目
```javascript
// LINE記帳模式下的科目文檔結構
{
  // 保留欄位
  id: string,
  parentId: number,        // 保留：維持主分類
  categoryName: string,    // 保留：基本科目名稱
  
  // 簡化調整
  categoryId: null,        // 設為null：移除細分代碼
  subCategoryName: null,   // 設為null：移除子分類名稱
  synonyms: "",            // 清空：避免模糊匹配
  
  // 系統欄位
  type: string,           // income/expense
  isActive: boolean,
  userId: string,
  ledgerId: string,
  dataSource: string,     // 標記為LINE簡化版
  createdAt: timestamp,
  module: 'LBK',
  version: '1.0.0'
}
```

#### 6.1.2 調整影響分析
- **減少選擇困難**：移除subCategoryName降低使用者認知負擔
- **提升匹配精準度**：清空synonyms避免錯誤匹配
- **保持擴展性**：保留parentId為未來APP端功能預留空間
- **維持一致性**：符合0070 DB schema規範

### 6.2 新科目歸類資料儲存

#### 6.2.1 歸類後的科目記錄
```javascript
// 使用者選擇「102 餐飲費用」歸類「飯糰」後
{
  id: "category_user_defined_001",
  parentId: 102,
  categoryName: "餐飲費用", 
  categoryId: null,
  subCategoryName: null,
  synonyms: "飯糰",  // 將原始輸入加入同義詞
  type: "expense",
  isActive: true,
  userId: userId,
  ledgerId: ledgerId,
  dataSource: "USER_CLASSIFICATION",
  createdAt: timestamp,
  module: "LBK",
  version: "1.0.0"
}
```

---

## 7. Before/After行為差異分析

### 7.1 Before（調整前）

#### 7.1.1 問題現狀
- **複雜科目結構**：0099文件包含完整的子科目與大量同義詞
- **選擇困難**：使用者面對過多科目選項感到困惑
- **辨識不準確**：同義詞過多導致錯誤匹配
- **缺乏標準流程**：新科目處理沒有統一機制

#### 7.1.2 使用者體驗問題
```
使用者輸入：「飯糰28」
系統回應：「無法識別科目，請重新輸入」
結果：使用者困惑，記帳失敗
```

### 7.2 After（調整後）

#### 7.2.1 改善效果
- **簡化科目選擇**：只呈現主要科目分類，降低認知負擔
- **標準化流程**：建立完整的新科目歸類機制
- **提升成功率**：清晰的選項降低使用者錯誤
- **保持靈活性**：「000 不歸類」選項滿足特殊需求

#### 7.2.2 優化後使用者體驗
```
使用者輸入：「飯糰28」
系統回應：科目選擇介面（101-105, 201, 000）
使用者輸入：「102」
系統回應：記帳成功確認 + 科目歸類完成
結果：順利完成記帳，科目成功歸類
```

### 7.3 技術架構改善

#### 7.3.1 資料流優化
- **Before**：直接LBK處理，缺乏用戶驗證
- **After**：WH → AM → LBK完整驗證流程

#### 7.3.2 錯誤處理改善
- **Before**：新科目直接失敗
- **After**：引導使用者完成歸類

---

## 8. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-12-15 | 初版建立，定義LINE記帳新科目辨識變更控制流程，整合0071設計理念，修正資料流架構，實施0099簡化策略 | LCAS Team |

---

> **重要提醒**：此變更將對LINE記帳使用者體驗產生重大改善。所有實作必須嚴格遵守0098憲法規範，確保不違反hard coding原則，並完全符合0070資料欄位規範。

> **MVP原則堅持**：本次變更專注於LINE記帳核心體驗優化，避免過度複雜化設計，確保「秒級記帳」的核心價值實現。

> **關鍵Insight**：0099文件簡化策略的核心在於「使用者自主選擇」，系統提供清晰選項而非複雜判斷。這符合LINE記帳「快速、直覺」的設計理念，同時為未來APP端Expert模式保留了完整的擴展空間。通過「80/20法則」的實踐，用20%的功能滿足80%用戶的核心需求。
