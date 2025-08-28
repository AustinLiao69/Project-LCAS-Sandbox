// run_tests.js
const { exec } = require("child_process");

exec("dart test/my_test.dart", (err, stdout, stderr) => {
    if (err) {
        console.error("測試錯誤:", err);
        return;
    }
    console.log("測試結果:\n", stdout);
});
