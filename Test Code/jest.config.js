
/**
 * Jest測試配置檔案_1.1.0
 * @module Jest測試配置
 * @description Jest測試環境配置 - Markdown專用報告器，移除HTML格式
 * @version 1.1.0
 * @update 2025-07-15: 移除HTML報告器，新增Markdown專用報告器，整合動態檔名生成
 * @date 2025-07-15 16:45:00
 */

// 生成動態檔名的時間戳記
const generateTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}-${hour}-${minute}-${second}`;
};

// 動態檔名生成
const timestamp = generateTimestamp();
const testReportFilename = `test-report-3115-TC-LBK-${timestamp}.md`;
const coverageReportFilename = `coverage-report-3115-TC-LBK-${timestamp}.md`;
const performanceReportFilename = `performance-report-3115-TC-LBK-${timestamp}.md`;

module.exports = {
  // 測試檔案匹配模式 - 強化版本（移除testRegex避免衝突）
  testMatch: [
    "**/Test Code/**/*.js",           // 原有規則：Test Code 目錄下所有 .js 檔案
    "**/Test Code/**/TC_*.js",        // TC_ 開頭的測試檔案
    "**/Test Code/**/*. TC_*.js",     // 包含空格的 TC_ 檔案
    "**/Test Code/**/[0-9]*. *.js",   // 數字開頭加空格的檔案格式
    "**/Test Code/**/[0-9]*.*.js"     // 數字開頭加點的檔案格式
  ],

  // 測試環境設定
  testEnvironment: "node",

  // 全域設定檔案
  setupFilesAfterEnv: ["<rootDir>/Test Code/setup.js"],

  // 覆蓋率收集設定 - Markdown 格式
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],  // 移除 html，保留 text 和 lcov
  
  // 覆蓋率收集範圍
  collectCoverageFrom: [
    "Modules/**/*.js",
    "!Modules/2051. MLS.js",          // 排除 MLS 模組
    "!Modules/2014. BS.js",           // 排除 BS 模組
    "!Modules/Serviceaccountkey.json"  // 排除服務金鑰檔案
  ],

  // 模組路徑映射
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^~/(.*)$": "<rootDir>/$1"
  },

  // 根目錄設定
  rootDir: process.cwd(),

  // 測試超時設定 - 針對 LBK 效能測試優化
  testTimeout: 60000,

  // 詳細輸出設定
  verbose: true,

  // 錯誤處理強化
  errorOnDeprecated: false,
  detectOpenHandles: true,
  forceExit: true,

  // 忽略有問題的模組路徑
  modulePathIgnorePatterns: [
    "<rootDir>/Modules/2051. MLS.js",
    "<rootDir>/Modules/2014. BS.js",
    "<rootDir>/node_modules/"
  ],

  // 測試檔案忽略模式
  testPathIgnorePatterns: [
    "/node_modules/",
    "/coverage/",
    "\\.backup\\.",
    "\\.old\\."
  ],

  // 支援 ES6 模組和異步測試
  transform: {},
  extensionsToTreatAsEsm: [],

  // 全域變數設定
  globals: {
    "process.env.NODE_ENV": "test"
  },

  // 清理設定
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,

  // Markdown 專用報告器設定
  reporters: [
    "default",
    // 自訂 Markdown 報告器配置
    ["<rootDir>/Test Code/markdown-reporter.js", {
      outputFile: `./coverage/${testReportFilename}`,
      coverageFile: `./coverage/${coverageReportFilename}`,
      performanceFile: `./coverage/${performanceReportFilename}`,
      includeConsoleOutput: true,
      includeStackTrace: true,
      generateTimestamp: timestamp
    }]
  ],

  // 最大工作程序數 - 避免併發問題，確保 Firebase Mock 穩定性
  maxWorkers: 1,

  // 測試結果處理器
  testResultsProcessor: "<rootDir>/Test Code/results-processor.js"
};
