
/**
 * Jest測試配置檔案_1.0.2
 * @module Jest測試配置
 * @description Jest測試環境配置 - 強化測試檔案匹配規則與路徑解析
 * @version 1.0.2
 * @update 2025-07-15: 強化testMatch規則，支援多種測試檔案命名格式，解決檔案識別問題
 * @date 2025-07-15 14:30:00
 */

module.exports = {
  // 測試檔案匹配模式 - 強化版本
  testMatch: [
    "**/Test Code/**/*.js",           // 原有規則：Test Code 目錄下所有 .js 檔案
    "**/Test Code/**/TC_*.js",        // TC_ 開頭的測試檔案
    "**/Test Code/**/*. TC_*.js",     // 包含空格的 TC_ 檔案
    "**/Test Code/**/[0-9]*. *.js",   // 數字開頭加空格的檔案格式
    "**/Test Code/**/[0-9]*.*.js"     // 數字開頭加點的檔案格式
  ],

  // 備用測試檔案正則表達式（雙重保障）
  testRegex: [
    "Test Code/.*\\.js$",             // Test Code 目錄下所有 .js 檔案
    "Test Code/.*TC_.*\\.js$",        // TC_ 相關檔案
    "Test Code/[0-9]+\\..+\\.js$"     // 數字開頭的特殊格式
  ],

  // 測試環境設定
  testEnvironment: "node",

  // 全域設定檔案
  setupFilesAfterEnv: ["<rootDir>/Test Code/setup.js"],

  // 覆蓋率收集設定
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  
  // 覆蓋率收集範圍
  collectCoverageFrom: [
    "Modules/**/*.js",
    "!Modules/2051. MLS.js",          // 排除 MLS 模組
    "!Modules/2014. BS.js",           // 排除 BS 模組
    "!Modules/Serviceaccountkey.json"  // 排除服務金鑰檔案
  ],

  // 模組路徑映射
  moduleNameMapping: {
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

  // 報告器設定
  reporters: [
    "default",
    ["jest-html-reporters", {
      "publicPath": "./coverage/html-report",
      "filename": "test-report.html",
      "expand": true
    }]
  ],

  // 最大工作程序數 - 避免併發問題
  maxWorkers: 1,

  // 測試序列執行 - 確保 Firebase Mock 穩定性
  runInBand: true
};
