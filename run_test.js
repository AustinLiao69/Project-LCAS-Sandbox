// run_tests.js
const { exec } = require("child_process");

exec("85. Flutter_Test code_APL/8501. 認證服務.dart", (err, stdout, stderr) => {
    if (err) {
        console.error("測試錯誤:", err);
        return;
    }
    console.log("測試結果:\n", stdout);
});
