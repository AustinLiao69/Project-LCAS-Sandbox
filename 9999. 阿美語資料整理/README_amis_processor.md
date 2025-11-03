
# 阿美語PDF處理器

這個工具可以將阿美語PDF檔案中的詞彙和句型整理成Excel格式。

## 安裝依賴

```bash
npm install pdf-parse xlsx
```

## 使用方法

### 1. 處理PDF檔案

```bash
node amis_pdf_processor.js <PDF檔案路徑> [輸出Excel檔案路徑]
```

範例：
```bash
node amis_pdf_processor.js ./阿美語詞典.pdf ./output.xlsx
```

### 2. 生成範例檔案

```bash
node amis_pdf_processor.js --sample
```

這會從現有的CSV資料生成範例Excel檔案。

## 功能特色

### 📝 詞彙解析
- 自動識別序號、編號、中文、族語、備註、級別等欄位
- 支援多種格式的詞彙條目
- 保留原始文本以供參考

### 🔍 句型分析
- 識別句型結構和語法標記
- 分析主格、受格、屬格標記
- 檢測動詞焦點變化

### 📊 Excel輸出
- **詞彙表**：完整的詞彙資訊
- **句型表**：句型結構分析
- **統計資訊**：處理結果摘要

## 支援的格式

程序可以識別以下格式的內容：

1. **標準詞彙格式**：
   ```
   1 01-01 一 cecay 初級
   2 01-02 二 tosa 初級
   ```

2. **包含備註格式**：
   ```
   10 01-10 十 polo' 同moetep，數數用polo'，數量用moetep。 初級
   ```

3. **句型範例**：
   ```
   ko tamdaw 人（主格）
   to foting 魚（受格）
   ```

## 輸出檔案結構

### 詞彙表工作表
| 序號 | 編號 | 中文 | 族語 | 備註 | 級別 | 原文 |
|------|------|------|------|------|------|------|

### 句型表工作表
| 類型 | 內容 | 分析 |
|------|------|------|

### 統計資訊工作表
| 項目 | 數量 |
|------|------|

## 注意事項

1. **PDF品質**：確保PDF檔案文字可以被正確識別（非掃描圖片）
2. **格式一致性**：程序會盡力適應不同格式，但統一的格式會有更好的結果
3. **編碼支援**：支援中文和阿美語特殊字符
4. **檔案大小**：大型PDF檔案可能需要較長的處理時間

## 進階使用

### 在程式中使用

```javascript
const AmisPDFProcessor = require('./amis_pdf_processor');

const processor = new AmisPDFProcessor();

// 處理PDF
await processor.processPDF('./input.pdf', './output.xlsx');

// 從現有資料生成Excel
processor.createSampleFromExistingData();
```

### 自訂解析規則

您可以修改 `parseVocabularyEntry` 和 `parseSentencePattern` 方法來適應特定的PDF格式。

## 疑難排解

### 常見問題

1. **PDF無法讀取**
   - 確認檔案不是密碼保護
   - 確認檔案未損壞
   - 嘗試重新生成PDF

2. **解析結果不完整**
   - 檢查PDF文字是否可選取
   - 調整正則表達式模式
   - 手動檢查特殊格式

3. **Excel檔案無法開啟**
   - 確認輸出路徑有寫入權限
   - 檢查磁碟空間是否足夠

## 更新記錄

- v1.0.0: 基礎PDF解析功能
- 支援詞彙和句型識別
- Excel多工作表輸出
- CSV轉換功能
