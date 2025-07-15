
/**
 * LBK 專用測試執行器
 * @description 只執行 LBK 模組測試，跳過其他模組
 * @version 1.0.0
 * @date 2025-07-15
 */

const { execSync } = require('child_process');

console.log('🧪 開始執行 LBK 模組專用測試...');
console.log('📋 測試範圍: 僅 2015. LBK.js 模組');
console.log('⚠️  跳過: MLS, BS 等其他模組測試');
console.log('');

try {
  // 只執行 LBK 測試檔案
  const result = execSync(
    'npx jest --config="Test Code/jest.config.js" --testPathPattern="TC_LBK" --verbose --forceExit',
    { 
      stdio: 'inherit',
      cwd: process.cwd()
    }
  );
  
  console.log('');
  console.log('✅ LBK 模組測試執行完成');
  
} catch (error) {
  console.log('');
  console.log('❌ LBK 模組測試執行失敗');
  console.log('錯誤代碼:', error.status);
  
  process.exit(error.status || 1);
}
