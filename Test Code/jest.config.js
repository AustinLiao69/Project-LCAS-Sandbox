
/**
 * Jest 測試配置
 * @description MLS 多帳本管理模組測試配置
 */

module.exports = {
  // 測試環境
  testEnvironment: 'node',
  
  // 測試檔案匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/tests/**/*_test.js'
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
  
  // 設定檔案
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
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
