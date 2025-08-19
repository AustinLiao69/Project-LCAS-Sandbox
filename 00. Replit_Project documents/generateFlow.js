import { exec } from "child_process";

// 使用 mermaid-cli 將 .mmd 檔轉 PNG
exec("npx mmdc -i flowchart.mmd -o flowchart.png", (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  console.log("流程圖已生成: flowchart.png");
});
