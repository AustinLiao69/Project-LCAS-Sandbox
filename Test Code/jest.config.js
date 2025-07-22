
/**
 * Jest測試配置檔案_1.3.0
 * @module Jest測試配置
 * @description Jest測試環境配置 - 動態測試模組偵測，智慧報告檔名生成
 * @version 1.3.0
 * @update 2025-01-09: 新增動態測試模組偵測邏輯，修復報告檔名硬編碼問題
 * @date 2025-01-09 20:00:00
 */

// 生成動態檔名的時間戳記 - UTC+8時區，格式：YYYYMMDD-HHMM
const generateTimestamp = () => {
  const now = new Date();
  // 轉換為UTC+8時區 (台灣時間)
  const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  
  const year = utc8Time.getUTCFullYear();
  const month = String(utc8Time.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8Time.getUTCDate()).padStart(2, '0');
  const hour = String(utc8Time.getUTCHours()).padStart(2, '0');
  const minute = String(utc8Time.getUTCMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}-${hour}${minute}`;
};

/**
 * 動態偵測測試模組並生成對應檔名
 * @version 1.3.0
 * @description 根據執行的測試檔案動態生成報告檔名
 */
const detectTestModule = () => {
  const args = process.argv;
  
  // 尋找測試檔案參數
  let testFile = '';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // 檢查是否為測試檔案路徑
    if (arg.includes('TC_') || arg.includes('Test Code/')) {
      testFile = arg;
      break;
    }
  }
  
  // 解析模組資訊
  let moduleInfo = {
    code: '3115',
    name: 'LBK',
    type: 'TC-LBK'
  };
  
  if (testFile.includes('3005') || testFile.includes('TC_SR')) {
    moduleInfo = {
      code: '3005',
      name: 'SR',
      type: 'TC-SR'
    };
  } else if (testFile.includes('3115') || testFile.includes('TC_LBK')) {
    moduleInfo = {
      code: '3115',
      name: 'LBK',
      type: 'TC-LBK'
    };
  } else if (testFile.includes('3151') || testFile.includes('TC_MLS')) {
    moduleInfo = {
      code: '3151',
      name: 'MLS',
      type: 'TC-MLS'
    };
  }
  
  console.log(`🎯 動態偵測到測試模組: ${moduleInfo.name} (${moduleInfo.code})`);
  return moduleInfo;
};

// 動態檔名生成
const timestamp = generateTimestamp();
const moduleInfo = detectTestModule();
const testReportFilename = `test-report-${moduleInfo.code}-${moduleInfo.type}-${timestamp}.md`;
const coverageReportFilename = `coverage-report-${moduleInfo.code}-${moduleInfo.type}-${timestamp}.md`;
const performanceReportFilename = `performance-report-${moduleInfo.code}-${moduleInfo.type}-${timestamp}.md`;

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

  // 動態 Markdown 報告器設定
  reporters: [
    "default",
    // 自訂 Markdown 報告器配置 - 支援動態模組偵測
    ["<rootDir>/Test Code/markdown-reporter.js", {
      outputFile: `./Test report/${testReportFilename}`,
      coverageFile: `./Test report/${coverageReportFilename}`,
      performanceFile: `./Test report/${performanceReportFilename}`,
      includeConsoleOutput: true,
      includeStackTrace: true,
      generateTimestamp: timestamp,
      moduleInfo: moduleInfo,  // 新增模組資訊
      dynamicDetection: true    // 啟用動態偵測
    }]
  ],

  // 最大工作程序數 - 避免併發問題，確保 Firebase Mock 穩定性
  maxWorkers: 1,

  
};
