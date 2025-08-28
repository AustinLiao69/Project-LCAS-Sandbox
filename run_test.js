const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// 執行測試檔
function runTest(name, dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  ${name} 測試資料夾不存在，略過。`);
    return;
  }

  // 找所有 _test.dart 檔案
  const testFiles = fs.readdirSync(dir).filter(f => f.endsWith('_test.dart'));
  if (testFiles.length === 0) {
    console.log(`⚠️  ${name} 資料夾沒有 _test.dart 測試檔，略過。`);
    return;
  }

  // 逐個檔案執行
  testFiles.forEach(file => {
    const filePath = path.join(dir, file);
    console.log(`===== ${name} 測試: ${file} =====`);
    // 使用 dart run 直接執行檔案，並用引號處理中文或空格
    exec(`dart run "${filePath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error(`錯誤: ${err.message}`);
        return;
      }
      if (stderr) console.error(`stderr:\n${stderr}`);
      console.log(stdout);
    });
  });
}

// 設定資料夾
const aplDir = '85. Flutter_Test_code_APL';
const plDir = '75. Flutter_Test_code_PL';

// 執行測試
runTest("APL", aplDir);
runTest("PL", plDir);
