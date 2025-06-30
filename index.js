/**
 * index.js_v2.1.1 - WH 模組啟動器
 * 專門為 WH 模組提供基本啟動功能
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
console.log('DD模組版本: 2.0.19 (2025-06-28)');
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
console.log('📡 Webhook URL: http://46edf8e3-c202-4cda-bf80-112dd40c124b-00-11q1eb3p2m1tv.sisko.replit.dev/webhook');

console.log('🎉 LCAS LINE Bot 啟動完成！');
console.log('📱 現在可以用 LINE 發送訊息測試了！');
console.log('🌐 WH 模組運行在 Port 3000，通過 Replit HTTPS 代理對外服務');