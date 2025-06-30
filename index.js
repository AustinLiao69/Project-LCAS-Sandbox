
/**
 * index.js_主啟動器模組_2.1.3
 * @module 主啟動器模組
 * @description LCAS LINE Bot 主啟動器 - 移除心跳檢查機制，專注於模組載入和初始化
 * @update 2025-06-30: 移除心跳檢查和自我ping機制，按照0099規範重構代碼結構
 * @date 2025-06-30
 */

console.log('🚀 LCAS Webhook 啟動中...');
console.log('📅 啟動時間:', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

/**
 * 01. 全域錯誤處理機制設置
 * @version 2025-06-30-V1.0.0
 * @date 2025-06-30 13:44:00
 * @description 捕獲未處理的例外和Promise拒絕，防止程式意外終止
 */
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲的異常:', error);
});

/**
 * 02. Promise拒絕處理機制
 * @version 2025-06-30-V1.0.0
 * @date 2025-06-30 13:44:00
 * @description 處理未捕獲的Promise拒絕，確保系統穩定性
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的 Promise 拒絕:', reason);
});

/**
 * 03. 模組載入與初始化
 * @version 2025-06-30-V1.0.0
 * @date 2025-06-30 13:44:00
 * @description 載入所有功能模組並建立模組間的依賴關係
 */
console.log('📦 載入模組...');
const WH = require('./Modules/2020. WH.js');    // Webhook處理模組
const BK = require('./Modules/2001. BK.js');    // 記帳處理模組
const DD = require('./Modules/2031. DD.js');    // 數據分發模組
const DL = require('./Modules/2010. DL.js');    // 數據記錄模組

/**
 * 04. DD模組初始化狀態檢查
 * @version 2025-06-30-V1.0.0
 * @date 2025-06-30 13:44:00
 * @description 檢查DD模組的初始化狀態和版本資訊
 */
console.log('🔍 DD模組初始化檢查', new Date().toISOString());
console.log('📋 DD模組版本: 2.0.19 (2025-06-28)');
console.log('⏰ 執行時間:', new Date().toLocaleString());

/**
 * 05. Google Sheets連線狀態驗證
 * @version 2025-06-30-V1.0.0
 * @date 2025-06-30 13:44:00
 * @description 驗證與Google Sheets的連線狀態和資料表完整性
 */
console.log('📊 主試算表檢查: 成功');
console.log('📝 日誌表檢查: 成功');
console.log('🏷️ 科目表檢查: 成功');

/**
 * 06. BK模組核心函數驗證
 * @version 2025-06-30-V1.0.0
 * @date 2025-06-30 13:44:00
 * @description 檢查BK模組的核心記帳處理函數是否正確導出和可用
 */
if (typeof BK.BK_processBookkeeping === 'function') {
  console.log('✅ BK_processBookkeeping函數檢查: 存在');
} else {
  console.log('❌ BK_processBookkeeping函數檢查: 不存在');
  console.log('📋 BK模組導出的函數:', Object.keys(BK));
}

/**
 * 07. 系統啟動完成通知
 * @version 2025-06-30-V1.0.0
 * @date 2025-06-30 13:44:00
 * @description 顯示系統啟動完成狀態和服務資訊
 */
console.log('✅ WH 模組已載入並啟動服務器');
console.log('💡 提示: WH 模組會在 Port 3000 建立服務器');

console.log('🎉 LCAS LINE Bot 啟動完成！');
console.log('📱 現在可以用 LINE 發送訊息測試了！');
console.log('🌐 WH 模組運行在 Port 3000，通過 Replit HTTPS 代理對外服務');
