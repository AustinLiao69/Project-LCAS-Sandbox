
/**
 * Jest測試配置檔案_1.5.0
 * @module Jest測試配置
 * @description Jest測試環境配置 - 超強動態測試模組偵測，完美解決SR模組檔名問題
 * @version 1.5.0
 * @update 2025-01-09: 全面修復SR模組偵測問題，強化空格轉義處理，專用SR匹配邏輯
 * @date 2025-01-09 22:30:00
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
 * 動態偵測測試模組並生成對應檔名 - 超強版本
 * @version 1.5.0
 * @description 根據執行的測試檔案動態生成報告檔名，完美支援SR模組，多重解析策略
 */
const detectTestModule = () => {
  const args = process.argv;
  console.log('🔍 Jest參數解析 v1.5.0:', args);
  
  // 多重策略尋找測試檔案參數 - 升級版
  let testFile = '';
  let detectionMethod = '';
  let moduleInfo = {
    code: '3115',
    name: 'LBK', 
    type: 'TC-LBK'
  };
  
  // 策略1: 精確匹配SR模組 - 優先處理
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // 專門處理 3005 和 SR 相關檔案
    if (arg.includes('3005') || arg.includes('TC_SR') || arg.includes('SR.js')) {
      testFile = arg;
      detectionMethod = 'SR專用匹配';
      moduleInfo = {
        code: '3005',
        name: 'SR',
        type: 'TC-SR'
      };
      break;
    }
  }
  
  // 策略2: 處理空格轉義問題 - 針對SR模組優化
  if (!testFile || moduleInfo.name === 'LBK') {
    const joinedArgs = args.join(' ');
    console.log('🔧 檢查轉義參數:', joinedArgs);
    
    // 強化正規表達式 - 專門處理SR模組
    const srPattern = /(?:Test\\?\s*Code[\/\\])?(?:[\d\.\\]*\s*)?(?:3005|TC_SR|SR)/i;
    const srMatch = joinedArgs.match(srPattern);
    
    if (srMatch) {
      testFile = srMatch[0];
      detectionMethod = 'SR轉義處理';
      moduleInfo = {
        code: '3005',
        name: 'SR',
        type: 'TC-SR'
      };
      console.log('✅ SR模組轉義匹配成功:', srMatch[0]);
    } else {
      // 一般轉義處理
      const generalPattern = /Test\\?\s*Code[\/\\][\d\.\\]+\s*TC_[A-Z]+\.js/;
      const generalMatch = joinedArgs.match(generalPattern);
      if (generalMatch) {
        testFile = generalMatch[0].replace(/\\/g, '');
        detectionMethod = '一般轉義處理';
        // 根據結果判斷模組
        if (testFile.includes('3005') || testFile.includes('SR')) {
          moduleInfo = { code: '3005', name: 'SR', type: 'TC-SR' };
        }
      }
    }
  }
  
  // 策略3: 直接匹配檔案路徑
  if (!testFile || moduleInfo.name === 'LBK') {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.includes('TC_') || arg.includes('Test Code/')) {
        testFile = arg;
        detectionMethod = '直接匹配';
        
        // 精確判斷模組類型
        if (arg.includes('3005') || arg.includes('TC_SR') || arg.includes('SR.js')) {
          moduleInfo = { code: '3005', name: 'SR', type: 'TC-SR' };
        } else if (arg.includes('3115') || arg.includes('TC_LBK') || arg.includes('LBK.js')) {
          moduleInfo = { code: '3115', name: 'LBK', type: 'TC-LBK' };
        } else if (arg.includes('3151') || arg.includes('TC_MLS') || arg.includes('MLS.js')) {
          moduleInfo = { code: '3151', name: 'MLS', type: 'TC-MLS' };
        }
        break;
      }
    }
  }
  
  // 策略4: 正規表達式全域搜尋
  if (!testFile || moduleInfo.name === 'LBK') {
    const allArgs = args.join(' ');
    const patterns = [
      { regex: /3005|TC_SR|SR\.js/i, info: { code: '3005', name: 'SR', type: 'TC-SR' } },
      { regex: /3115|TC_LBK|LBK\.js/i, info: { code: '3115', name: 'LBK', type: 'TC-LBK' } },
      { regex: /3151|TC_MLS|MLS\.js/i, info: { code: '3151', name: 'MLS', type: 'TC-MLS' } }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(allArgs)) {
        testFile = allArgs.match(pattern.regex)[0];
        moduleInfo = pattern.info;
        detectionMethod = '全域正規匹配';
        break;
      }
    }
  }
  
  console.log(`📁 偵測到測試檔案: "${testFile}" (方法: ${detectionMethod})`);
  console.log(`🎯 動態偵測到測試模組: ${moduleInfo.name} (${moduleInfo.code})`);
  
  // 額外驗證 - 確保SR模組正確識別
  if (moduleInfo.name === 'LBK') {
    const hasShellSRIndicators = args.some(arg => 
      arg.includes('3005') || arg.includes('TC_SR') || arg.includes('SR')
    );
    if (hasShellSRIndicators) {
      console.log('⚠️ 強制修正為SR模組 - Shell參數包含SR指標');
      moduleInfo = { code: '3005', name: 'SR', type: 'TC-SR' };
      detectionMethod += ' + 強制修正';
    }
  }
  
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
