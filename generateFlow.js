
const fs = require("fs");
const https = require("https");

console.log("📊 Mermaid 流程圖轉換工具");
console.log("=".repeat(50));

// 讀取 mermaid 檔案
fs.readFile("flowchart.mmd", "utf8", (err, data) => {
  if (err) {
    console.error("❌ 讀取檔案錯誤:", err.message);
    return;
  }

  console.log("✅ 成功讀取 Mermaid 圖表內容:");
  console.log("-".repeat(30));
  console.log(data);
  console.log("-".repeat(30));
  
  console.log("\n🔗 線上轉換建議:");
  console.log("1. 複製上方的 Mermaid 代碼");
  console.log("2. 前往 https://mermaid.live/");
  console.log("3. 貼上代碼並下載 PNG 圖檔");
  console.log("4. 將圖檔重新命名為 flowchart.png");
  
  console.log("\n💡 或者使用以下替代方案:");
  console.log("• https://mermaid.js.org/live-editor");
  console.log("• https://kroki.io (支援多種圖表格式)");
  
  // 提供 URL 編碼版本以便直接開啟
  const encoded = encodeURIComponent(data);
  const mermaidLiveUrl = `https://mermaid.live/edit#pako:${Buffer.from(data).toString('base64')}`;
  console.log("\n🚀 直接開啟連結 (已包含您的圖表):");
  console.log(mermaidLiveUrl);
});
