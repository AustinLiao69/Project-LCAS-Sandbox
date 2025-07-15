module.exports = {
  // 測試檔案匹配模式
  testMatch: [
    "**/Test Code/**/*.js"
  ],

  // 測試環境設定
  testEnvironment: "node",

  // 全域設定檔案
  setupFilesAfterEnv: ["<rootDir>/Test Code/setup.js"],

  // 覆蓋率收集
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],

  // 模組路徑映射
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/$1"
  },

  // 測試超時設定 - 增加以支援 LBK 效能測試
  testTimeout: 60000,

  // 詳細輸出
  verbose: true,

  // 錯誤處理
  errorOnDeprecated: false,

  // 忽略有問題的模組 (避免 MLS 和 BS 模組影響測試)
  modulePathIgnorePatterns: [
    "<rootDir>/Modules/2051. MLS.js",
    "<rootDir>/Modules/2014. BS.js"
  ],

  // 支援 ES6 模組和異步測試
  transform: {},
  extensionsToTreatAsEsm: []
};