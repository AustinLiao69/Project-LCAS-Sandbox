
/**
 * Jest測試配置_1.1.0
 * @module Jest測試配置
 * @description MLS 多帳本管理模組測試配置 - 修正檔案匹配模式
 * @version 1.1.0
 * @update 2025-07-15: 修正測試檔案匹配模式，調整為Test Code目錄結構
 * @date 2025-07-15 11:46:00
 */

module.exports = {
  // 測試環境
  testEnvironment: 'node',
  
  // 測試檔案匹配模式 - 修正為實際目錄結構
  testMatch: [
    '**/Test Code/**/*.test.js',
    '**/Test Code/**/*.spec.js',
    '**/Test Code/**/*_test.js',
    '**/Test Code/**/TC_*.js',
    '**/Test Code/**/*.TC_*.js',
    '**/Test Code/**/*. TC_*.js'
  ],
  
  // 測試覆蓋率設定
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  
  // 測試覆蓋率路徑
  collectCoverageFrom: [
    'Modules/**/*.js',
    '!Modules/**/*.test.js',
    '!**/node_modules/**'
  ],
  
  // 測試超時設定
  testTimeout: 30000,
  
  // 設定檔案 - 修正為當前目錄相對路徑
  setupFilesAfterEnv: ['./setup.js'],
  
  // 忽略模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],
  
  // 詳細輸出
  verbose: true,
  
  // 報告格式
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage',
      filename: 'test-report.html',
      expand: true
    }]
  ]
};
