const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// 檢查資料夾裡面是否有 Dart 測試檔
function hasDartTests(dir) {
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir);
  return files.some(file => file.endsWith('.dart'));
}

// 跑測試函式
function runTest(name, dir) {
  if (!fs.existsSync(dir) || !hasDartTests(dir)) {
    console.log(`⚠️  ${name} 測試資料夾不存在或沒有測試檔，略過。`);
    return;
  }

  exec(`cd "${dir}" && dart test`, (err, stdout, stderr) => {
    console.log(`===== ${name} 測試 =====`);
    if (err) {
      console.error(`錯誤: ${err.message}`);
      return;
    }
    if (stderr) console.error(`stderr:\n${stderr}`);
    console.log(stdout);
  });
}

// 根目錄名稱
const aplDir = '85.Flutter_Test_code_APL';
const plDir = '75.Flutter_Test_code_PL';

// 跑測試
runTest("APL", aplDir);
runTest("PL", plDir);
