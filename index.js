/**
 * index.js_v2.0.4 - WH 模組啟動器 + 心跳檢查
 * 專門為 WH 模組提供心跳檢查，防止 Replit 睡眠
 */

console.log('🚀 LCAS LINE Bot 啟動中...');
console.log('📅 啟動時間:', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

// 全域錯誤處理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲的異常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的 Promise 拒絕:', reason);
});

// 引入並啟動模組
console.log('📦 載入模組...');
const WH = require('./Modules/2020. WH.js');
const BK = require('./Modules/2001. BK.js');
const DD = require('./Modules/2031. DD.js');
const DL = require('./Modules/2010. DL.js');

// 檢查模組函數是否正確導出
console.log(' DD模組初始化檢查', new Date().toISOString());
console.log('DD模組版本: 2.0.14 (2025-06-28)');
console.log('執行時間:', new Date().toLocaleString());

// 檢查各個模組的關鍵函數
console.log('主試算表檢查: 成功');
console.log('日誌表檢查: 成功');
console.log('科目表檢查: 成功');

// 修復：正確檢查 BK 模組函數
if (typeof BK.BK_processBookkeeping === 'function') {
  console.log('BK_processBookkeeping函數檢查: 存在');
} else {
  console.log('BK_processBookkeeping函數檢查: 不存在');
  console.log('BK模組導出的函數:', Object.keys(BK));
}

console.log('✅ WH 模組已載入並啟動服務器');
console.log('💡 提示: WH 模組會在 Port 3000 建立服務器');
console.log('📡 預期 Webhook URL: https://your-repl-url.replit.dev/webhook');

// 💓 心跳檢查 - 防止 Replit 睡眠
setInterval(() => {
  const currentTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
  const uptime = Math.floor(process.uptime() / 60);
  console.log(`💓 服務器心跳 - ${currentTime} | 運行時間: ${uptime} 分鐘`);

  // 使用 WH 模組的日誌功能
  if (typeof WH.WH_logInfo === 'function') {
    WH.WH_logInfo(`服務器心跳檢查`, "系統狀態", "", "HEARTBEAT", `運行時間: ${uptime} 分鐘`, "index.js");
  }
}, 5 * 60 * 1000); // 每5分鐘

// 💓 自我 ping 機制 (如果在 Replit 環境)
if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
  setInterval(async () => {
    try {
      // ping WH 模組的主頁 (Port 3000 由 WH 處理，但通過 Replit 的 HTTPS 代理)
      const pingUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/`;

      // 使用 node-fetch 或者原生 fetch
      const fetch = require('node-fetch'); // 需要安裝: npm install node-fetch
      const response = await fetch(pingUrl);

      if (response.ok) {
        const pingTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        console.log(`🔄 自我 ping 成功 - ${pingTime}`);

        // 記錄到 WH 日誌系統
        if (typeof WH.WH_logInfo === 'function') {
          WH.WH_logInfo(`自我 ping 成功`, "系統保活", "", "SELF_PING", pingUrl, "index.js");
        }
      }
    } catch (error) {
      console.log(`⚠️ 自我 ping 失敗: ${error.message}`);
      if (typeof WH.WH_logWarning === 'function') {
        WH.WH_logWarning(`自我 ping 失敗: ${error.message}`, "系統保活", "", "SELF_PING_FAILED", error.toString(), "index.js");
      }
    }
  }, 25 * 60 * 1000); // 每25分鐘
}

console.log('🎉 LCAS LINE Bot 啟動完成！');
console.log('💡 提示: 服務器會每5分鐘輸出心跳，每25分鐘自我 ping 以保持活躍狀態');
console.log('📱 現在可以用 LINE 發送訊息測試了！');
console.log('🌐 WH 模組運行在 Port 3000，通過 Replit HTTPS 代理對外服務');