const { exec } = require("child_process");
const fs = require("fs");

function runTest(name, path) {
  if (!fs.existsSync(path)) {
    console.log(`⚠️  ${name} 測試資料夾不存在，略過。`);
    return;
  }

  exec(`cd ${path} && dart test`, (err, stdout, stderr) => {
    console.log(`===== ${name} 測試 =====`);
    if (err) {
      console.error(`錯誤: ${err.message}`);
      return;
    }
    if (stderr) console.error(`stderr:\n${stderr}`);
    console.log(stdout);
  });
}

// 跑 APL 測試
runTest("APL", "apl_tests");

// 跑 PL 測試
runTest("PL", "pl_tests");
