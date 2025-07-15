
/**
 * Jest Markdown報告器_1.0.0
 * @module Jest Markdown報告器
 * @description Jest自動調用的Markdown報告生成器 - 整合測試、覆蓋率、效能報告
 * @version 1.0.0
 * @update 2025-07-15: 簡化架構，移除results-processor依賴，純Markdown輸出
 * @date 2025-07-15 17:00:00
 */

const fs = require('fs');
const path = require('path');

/**
 * Jest Markdown Reporter 類別
 * 實作 Jest Reporter 介面，自動生成三種 Markdown 報告
 */
class MarkdownReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options || {};
    
    // 確保 coverage 目錄存在
    const coverageDir = path.dirname(this._options.outputFile || './coverage/report.md');
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }
    
    // 初始化報告資料
    this._testResults = [];
    this._startTime = Date.now();
    this._performanceData = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      slowestTests: [],
      averageTestTime: 0
    };
    
    console.log('📋 Markdown Reporter 初始化完成');
  }

  /**
   * 測試開始時調用
   */
  onRunStart() {
    this._startTime = Date.now();
    console.log('🚀 開始生成 Markdown 測試報告...');
  }

  /**
   * 單一測試完成時調用
   */
  onTestResult(test, testResult) {
    const testPath = path.relative(process.cwd(), testResult.testFilePath);
    
    // 收集測試結果
    testResult.testResults.forEach(result => {
      const testData = {
        testPath,
        testName: result.fullName,
        status: result.status,
        duration: result.duration || 0,
        error: result.failureMessages.length > 0 ? result.failureMessages[0] : null,
        timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      };
      
      this._testResults.push(testData);
      
      // 更新效能統計
      this._performanceData.totalTests++;
      if (result.status === 'passed') this._performanceData.passedTests++;
      if (result.status === 'failed') this._performanceData.failedTests++;
      if (result.status === 'skipped') this._performanceData.skippedTests++;
      
      // 記錄最慢的測試
      if (testData.duration > 1000) { // 超過1秒的測試
        this._performanceData.slowestTests.push(testData);
      }
    });
  }

  /**
   * 所有測試完成時調用 - 生成所有報告
   */
  onRunComplete(contexts, results) {
    const endTime = Date.now();
    const totalDuration = endTime - this._startTime;
    
    // 計算平均測試時間
    const totalTestTime = this._testResults.reduce((sum, test) => sum + test.duration, 0);
    this._performanceData.averageTestTime = totalTestTime / this._testResults.length || 0;
    
    // 排序最慢的測試
    this._performanceData.slowestTests.sort((a, b) => b.duration - a.duration);
    this._performanceData.slowestTests = this._performanceData.slowestTests.slice(0, 5);
    
    // 生成三種報告
    this._generateTestReport(results, totalDuration);
    this._generateCoverageReport(results);
    this._generatePerformanceReport(totalDuration);
    
    console.log('✅ Markdown 報告生成完成');
    console.log(`📄 測試報告: ${this._options.outputFile}`);
    console.log(`📊 覆蓋率報告: ${this._options.coverageFile}`);
    console.log(`⚡ 效能報告: ${this._options.performanceFile}`);
  }

  /**
   * 生成測試報告 Markdown
   */
  _generateTestReport(results, totalDuration) {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    
    let markdown = `# 📋 LBK模組測試報告 (TC-3115)

## 📊 測試執行摘要
- **執行時間**: ${timestamp}
- **總執行時間**: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)
- **總測試案例**: ${results.numTotalTests}
- **通過測試**: ${results.numPassedTests} ✅
- **失敗測試**: ${results.numFailedTests} ❌
- **跳過測試**: ${results.numPendingTests} ⏭️
- **測試成功率**: ${((results.numPassedTests / results.numTotalTests) * 100).toFixed(1)}%

## 🎯 測試案例詳細結果

`;

    // 按狀態分組顯示測試結果
    const passedTests = this._testResults.filter(t => t.status === 'passed');
    const failedTests = this._testResults.filter(t => t.status === 'failed');
    const skippedTests = this._testResults.filter(t => t.status === 'skipped');

    if (passedTests.length > 0) {
      markdown += `### ✅ 通過的測試 (${passedTests.length}個)\n\n`;
      passedTests.forEach(test => {
        markdown += `- **${test.testName}**\n`;
        markdown += `  - 檔案: \`${test.testPath}\`\n`;
        markdown += `  - 執行時間: ${test.duration}ms\n`;
        markdown += `  - 完成時間: ${test.timestamp}\n\n`;
      });
    }

    if (failedTests.length > 0) {
      markdown += `### ❌ 失敗的測試 (${failedTests.length}個)\n\n`;
      failedTests.forEach(test => {
        markdown += `- **${test.testName}**\n`;
        markdown += `  - 檔案: \`${test.testPath}\`\n`;
        markdown += `  - 執行時間: ${test.duration}ms\n`;
        markdown += `  - 失敗時間: ${test.timestamp}\n`;
        if (test.error) {
          markdown += `  - 錯誤訊息: \`${test.error.split('\n')[0]}\`\n`;
        }
        markdown += '\n';
      });
    }

    if (skippedTests.length > 0) {
      markdown += `### ⏭️ 跳過的測試 (${skippedTests.length}個)\n\n`;
      skippedTests.forEach(test => {
        markdown += `- **${test.testName}**\n`;
        markdown += `  - 檔案: \`${test.testPath}\`\n\n`;
      });
    }

    markdown += `## 📈 統計摘要
- **模組**: LBK (快速記帳模組)
- **測試編號**: TC-3115
- **Jest版本**: ${require('jest/package.json').version}
- **Node.js版本**: ${process.version}
- **平台**: ${process.platform}
- **生成時間**: ${timestamp}
- **報告版本**: 1.0.0

---
*本報告由 Jest Markdown Reporter 自動生成*
`;

    fs.writeFileSync(this._options.outputFile, markdown, 'utf8');
  }

  /**
   * 生成覆蓋率報告 Markdown
   */
  _generateCoverageReport(results) {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    
    let markdown = `# 📊 LBK模組覆蓋率報告 (TC-3115)

## 📈 覆蓋率摘要
- **生成時間**: ${timestamp}
- **模組**: LBK (快速記帳模組)
- **測試編號**: TC-3115

## 🎯 覆蓋率統計

`;

    // 檢查是否有覆蓋率資料
    if (results.coverageMap) {
      const coverageData = results.coverageMap.getCoverageSummary();
      
      markdown += `### 整體覆蓋率
- **語句覆蓋率**: ${coverageData.statements.pct}% (${coverageData.statements.covered}/${coverageData.statements.total})
- **分支覆蓋率**: ${coverageData.branches.pct}% (${coverageData.branches.covered}/${coverageData.branches.total})
- **函數覆蓋率**: ${coverageData.functions.pct}% (${coverageData.functions.covered}/${coverageData.functions.total})
- **行覆蓋率**: ${coverageData.lines.pct}% (${coverageData.lines.covered}/${coverageData.lines.total})

`;
    } else {
      markdown += `### 📋 覆蓋率資料
> **注意**: 本次執行未收集到詳細覆蓋率資料
> 
> 可能原因：
> - Jest 配置中的 \`collectCoverage\` 設定為 false
> - 測試檔案未正確匹配到目標模組
> - 覆蓋率資料收集過程中發生錯誤

### 建議
1. 檢查 \`jest.config.js\` 中的 \`collectCoverage\` 設定
2. 確認 \`collectCoverageFrom\` 路徑正確指向 LBK 模組
3. 確保測試能正確引入並執行目標函數

`;
    }

    markdown += `## 📝 覆蓋率分析建議

### 🎯 目標覆蓋率標準
- **語句覆蓋率**: ≥ 90%
- **分支覆蓋率**: ≥ 85%
- **函數覆蓋率**: ≥ 95%
- **行覆蓋率**: ≥ 90%

### 📋 改善建議
1. **增加邊界條件測試**: 針對極端輸入值進行測試
2. **完善錯誤處理測試**: 確保所有異常分支都有對應測試
3. **提升函數覆蓋率**: 確保每個導出函數都有對應測試案例
4. **加強整合測試**: 測試函數間的互動和資料流

## 📊 報告資訊
- **生成時間**: ${timestamp}
- **報告版本**: 1.0.0
- **覆蓋率工具**: Jest built-in coverage

---
*本報告由 Jest Markdown Reporter 自動生成*
`;

    fs.writeFileSync(this._options.coverageFile, markdown, 'utf8');
  }

  /**
   * 生成效能報告 Markdown
   */
  _generatePerformanceReport(totalDuration) {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    
    let markdown = `# ⚡ LBK模組效能報告 (TC-3115)

## 📊 效能摘要
- **生成時間**: ${timestamp}
- **總執行時間**: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)
- **總測試案例**: ${this._performanceData.totalTests}
- **平均測試時間**: ${this._performanceData.averageTestTime.toFixed(2)}ms
- **通過率**: ${((this._performanceData.passedTests / this._performanceData.totalTests) * 100).toFixed(1)}%

## 🐌 最慢的測試案例

`;

    if (this._performanceData.slowestTests.length > 0) {
      markdown += '| 測試案例 | 執行時間 | 狀態 | 檔案 |\n';
      markdown += '|---------|---------|------|------|\n';
      
      this._performanceData.slowestTests.forEach(test => {
        const statusIcon = test.status === 'passed' ? '✅' : '❌';
        markdown += `| ${test.testName} | ${test.duration}ms | ${statusIcon} | \`${test.testPath}\` |\n`;
      });
      markdown += '\n';
    } else {
      markdown += '> 🎉 所有測試執行時間都在1秒以內，效能表現優秀！\n\n';
    }

    markdown += `## 📈 效能分析

### ⚡ 效能等級評估
`;

    // 效能等級評估
    const avgTime = this._performanceData.averageTestTime;
    let performanceLevel = '';
    let recommendation = '';

    if (avgTime < 100) {
      performanceLevel = '🟢 優秀 (< 100ms)';
      recommendation = '測試效能優秀，保持現有實作方式。';
    } else if (avgTime < 500) {
      performanceLevel = '🟡 良好 (100-500ms)';
      recommendation = '測試效能良好，可考慮優化較慢的測試案例。';
    } else if (avgTime < 1000) {
      performanceLevel = '🟠 普通 (500ms-1s)';
      recommendation = '建議檢查測試邏輯，優化資料準備和清理流程。';
    } else {
      performanceLevel = '🔴 需要改善 (> 1s)';
      recommendation = '測試效能需要改善，建議重構測試架構和Mock機制。';
    }

    markdown += `- **平均測試時間等級**: ${performanceLevel}
- **建議**: ${recommendation}

### 📊 詳細統計
- **最快測試**: ${Math.min(...this._testResults.map(t => t.duration))}ms
- **最慢測試**: ${Math.max(...this._testResults.map(t => t.duration))}ms
- **測試時間中位數**: ${this._calculateMedian(this._testResults.map(t => t.duration))}ms
- **超過1秒的測試**: ${this._performanceData.slowestTests.length}個

### 🎯 效能優化建議

#### 1. 測試架構優化
- 使用靜態測試資料（如當前的9999.json）
- 避免真實網路請求，使用Mock
- 優化測試資料準備和清理流程

#### 2. 並行執行優化  
- 當前設定: \`maxWorkers: 1\`（避免Firebase Mock衝突）
- 如果移除外部依賴，可考慮提升並行度

#### 3. 測試範圍優化
- 專注於核心邏輯測試
- 分離單元測試和整合測試
- 使用測試標籤進行分類執行

## 📝 效能監控建議
1. **設定效能基準**: 建立測試效能基準線
2. **持續監控**: 在CI/CD中加入效能監控
3. **定期回顧**: 每週檢視測試效能報告
4. **優化策略**: 針對慢測試制定優化計畫

## 📊 報告資訊
- **生成時間**: ${timestamp}
- **報告版本**: 1.0.0
- **效能分析工具**: Jest Markdown Reporter

---
*本報告由 Jest Markdown Reporter 自動生成*
`;

    fs.writeFileSync(this._options.performanceFile, markdown, 'utf8');
  }

  /**
   * 計算中位數
   */
  _calculateMedian(numbers) {
    const sorted = numbers.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return ((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2);
    } else {
      return sorted[middle].toFixed(2);
    }
  }
}

module.exports = MarkdownReporter;
