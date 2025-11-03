
const fs = require('fs');
const pdf = require('pdf-parse');
const XLSX = require('xlsx');
const path = require('path');

/**
 * 阿美語PDF處理器
 * 將PDF中的阿美語詞彙和句型整理成Excel格式
 */
class AmisPDFProcessor {
  constructor() {
    this.vocabularyData = [];
    this.sentencePatterns = [];
  }

  /**
   * 處理PDF文件
   * @param {string} pdfPath - PDF檔案路徑
   * @param {string} outputPath - 輸出Excel檔案路徑
   */
  async processPDF(pdfPath, outputPath = './amis_dictionary.xlsx') {
    try {
      console.log('開始處理PDF檔案:', pdfPath);
      
      // 讀取PDF檔案
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);
      
      console.log('PDF頁數:', pdfData.numpages);
      console.log('開始解析內容...');
      
      // 解析文本內容
      this.parseContent(pdfData.text);
      
      // 生成Excel檔案
      this.generateExcel(outputPath);
      
      console.log('處理完成，輸出檔案:', outputPath);
      
    } catch (error) {
      console.error('處理PDF時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 解析PDF內容
   * @param {string} text - PDF文本內容
   */
  parseContent(text) {
    const lines = text.split('\n').filter(line => line.trim());
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 跳過空行和頁碼等無關內容
      if (!line || this.isPageInfo(line)) {
        continue;
      }
      
      // 識別詞彙條目（通常包含序號、中文、族語等）
      const vocabMatch = this.parseVocabularyEntry(line);
      if (vocabMatch) {
        this.vocabularyData.push(vocabMatch);
        continue;
      }
      
      // 識別句型結構
      const patternMatch = this.parseSentencePattern(line);
      if (patternMatch) {
        this.sentencePatterns.push(patternMatch);
      }
    }
    
    console.log('解析完成 - 詞彙數量:', this.vocabularyData.length);
    console.log('解析完成 - 句型數量:', this.sentencePatterns.length);
  }

  /**
   * 解析詞彙條目
   * @param {string} line - 文本行
   * @returns {Object|null} 解析結果
   */
  parseVocabularyEntry(line) {
    // 匹配格式: 序號 中文 族語 備註 級別
    const patterns = [
      // 基本格式: 1 01-01 一 cecay 初級
      /^(\d+)\s+(\d+-\d+)\s+(.+?)\s+([a-zA-Z']+.*?)\s+(初級|中級|中高級|高級)/,
      // 簡化格式: 序號 中文 族語
      /^(\d+)\s+(.+?)\s+([a-zA-Z']+.*?)$/,
      // 包含備註的格式
      /^(\d+)\s+(\d+-\d+)\s+(.+?)\s+([a-zA-Z']+.*?)\s+(.+?)\s+(初級|中級|中高級|高級)/
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          序號: match[1] || '',
          編號: match[2] || '',
          中文: match[3] || '',
          族語: match[4] || '',
          備註: match[5] && match[6] ? match[5] : '',
          級別: match[6] || match[5] || '',
          原文: line
        };
      }
    }
    
    return null;
  }

  /**
   * 解析句型結構
   * @param {string} line - 文本行
   * @returns {Object|null} 解析結果
   */
  parseSentencePattern(line) {
    // 識別句型標記
    const patternIndicators = [
      '句型', '語法', '用法', '例句', '句式'
    ];
    
    const hasPatternIndicator = patternIndicators.some(indicator => 
      line.includes(indicator)
    );
    
    if (hasPatternIndicator) {
      return {
        類型: '句型',
        內容: line,
        分析: this.analyzeSentenceStructure(line)
      };
    }
    
    return null;
  }

  /**
   * 分析句子結構
   * @param {string} sentence - 句子
   * @returns {string} 分析結果
   */
  analyzeSentenceStructure(sentence) {
    // 基本的句型分析
    const structures = [];
    
    if (sentence.includes('ko')) structures.push('主格標記');
    if (sentence.includes('to')) structures.push('受格標記');
    if (sentence.includes('no')) structures.push('屬格標記');
    if (sentence.match(/ma-\w+/)) structures.push('主事焦點');
    if (sentence.match(/-en\b/)) structures.push('受事焦點');
    
    return structures.join(', ') || '需進一步分析';
  }

  /**
   * 判斷是否為頁面資訊
   * @param {string} line - 文本行
   * @returns {boolean}
   */
  isPageInfo(line) {
    return /第\s*\d+\s*頁|頁碼|\d+\/\d+|財團法人/.test(line);
  }

  /**
   * 生成Excel檔案
   * @param {string} outputPath - 輸出路徑
   */
  generateExcel(outputPath) {
    const workbook = XLSX.utils.book_new();
    
    // 詞彙工作表
    if (this.vocabularyData.length > 0) {
      const vocabSheet = XLSX.utils.json_to_sheet(this.vocabularyData);
      XLSX.utils.book_append_sheet(workbook, vocabSheet, '詞彙表');
    }
    
    // 句型工作表
    if (this.sentencePatterns.length > 0) {
      const patternSheet = XLSX.utils.json_to_sheet(this.sentencePatterns);
      XLSX.utils.book_append_sheet(workbook, patternSheet, '句型表');
    }
    
    // 統計工作表
    const stats = [{
      項目: '詞彙總數',
      數量: this.vocabularyData.length
    }, {
      項目: '句型總數',
      數量: this.sentencePatterns.length
    }, {
      項目: '處理時間',
      數量: new Date().toLocaleString('zh-TW')
    }];
    
    const statsSheet = XLSX.utils.json_to_sheet(stats);
    XLSX.utils.book_append_sheet(workbook, statsSheet, '統計資訊');
    
    // 寫入檔案
    XLSX.writeFile(workbook, outputPath);
  }

  /**
   * 從現有的CSV資料創建範例Excel
   */
  createSampleFromExistingData() {
    try {
      // 讀取現有的CSV檔案
      const csvPath = './00. Master_Project document/海岸阿美語詞表.csv';
      if (fs.existsSync(csvPath)) {
        console.log('發現現有的阿美語詞表CSV檔案，正在轉換...');
        
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',');
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = this.parseCSVLine(lines[i]);
            const obj = {};
            headers.forEach((header, index) => {
              obj[header.trim()] = values[index] || '';
            });
            data.push(obj);
          }
        }
        
        // 生成Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, '海岸阿美語詞表');
        
        const outputPath = './amis_dictionary_sample.xlsx';
        XLSX.writeFile(workbook, outputPath);
        console.log('範例Excel檔案已生成:', outputPath);
        
        return outputPath;
      }
    } catch (error) {
      console.error('轉換現有資料時發生錯誤:', error);
    }
  }

  /**
   * 解析CSV行（處理引號和逗號）
   * @param {string} line - CSV行
   * @returns {Array} 欄位陣列
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
}

// 使用範例
async function main() {
  const processor = new AmisPDFProcessor();
  
  // 檢查命令行參數
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法:');
    console.log('node amis_pdf_processor.js <PDF檔案路徑> [輸出檔案路徑]');
    console.log('');
    console.log('或者先生成範例檔案:');
    console.log('node amis_pdf_processor.js --sample');
    
    // 生成範例檔案
    if (args[0] === '--sample') {
      processor.createSampleFromExistingData();
    }
    return;
  }
  
  const pdfPath = args[0];
  const outputPath = args[1] || './amis_dictionary.xlsx';
  
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF檔案不存在:', pdfPath);
    return;
  }
  
  try {
    await processor.processPDF(pdfPath, outputPath);
  } catch (error) {
    console.error('處理失敗:', error.message);
  }
}

// 導出類別供其他模組使用
module.exports = AmisPDFProcessor;

// 如果直接執行此檔案
if (require.main === module) {
  main();
}
