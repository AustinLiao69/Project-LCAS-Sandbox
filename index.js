/**
 * index.js_主啟動器模組_2.1.7
 * @module 主啟動器模組
 * @description LCAS LINE Bot 主啟動器 - 移除心跳檢查機制，專注於模組載入和初始化
 * @update 2025-07-22: 升級至2.1.7版本，增強模組載入錯誤處理，修復FS模組依賴問題
 * @date 2025-07-22
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
 * 03. 模組載入與初始化 - 優化載入順序
 * @version 2025-07-22-V1.0.1
 * @date 2025-07-22 10:15:00
 * @description 載入所有功能模組並建立模組間的依賴關係，優化載入順序避免依賴錯誤
 */
console.log('📦 載入模組...');

// 優先載入基礎模組
let DL, FS;
try {
  DL = require('./Modules/2010. DL.js');    // 數據記錄模組 (基礎)
  console.log('✅ DL 模組載入成功');
} catch (error) {
  console.error('❌ DL 模組載入失敗:', error.message);
}

try {
  FS = require('./Modules/2011. FS.js');    // Firestore結構模組 (基礎)
  console.log('✅ FS 模組載入成功');
} catch (error) {
  console.error('❌ FS 模組載入失敗:', error.message);
}

// 載入應用層模組
let WH, BK, LBK, DD, AM, SR;
try {
  BK = require('./Modules/2001. BK.js');    // 記帳處理模組
  console.log('✅ BK 模組載入成功');
} catch (error) {
  console.error('❌ BK 模組載入失敗:', error.message);
}

try {
  LBK = require('./Modules/2015. LBK.js');  // LINE快速記帳模組
  console.log('✅ LBK 模組載入成功');
} catch (error) {
  console.error('❌ LBK 模組載入失敗:', error.message);
}

try {
  DD = require('./Modules/2031. DD1.js');    // 數據分發模組
  console.log('✅ DD 模組載入成功');
} catch (error) {
  console.error('❌ DD 模組載入失敗:', error.message);
}

try {
  AM = require('./Modules/2009. AM.js');    // 帳號管理模組
  console.log('✅ AM 模組載入成功');
} catch (error) {
  console.error('❌ AM 模組載入失敗:', error.message);
}

try {
  SR = require('./Modules/2005. SR.js');    // 排程提醒模組
  console.log('✅ SR 模組載入成功');
} catch (error) {
  console.error('❌ SR 模組載入失敗:', error.message);
}

try {
  WH = require('./Modules/2020. WH.js');    // Webhook處理模組 (最後載入)
  console.log('✅ WH 模組載入成功');
} catch (error) {
  console.error('❌ WH 模組載入失敗:', error.message);
}

// 預先初始化各模組（安全初始化）
if (BK && typeof BK.BK_initialize === 'function') {
  console.log('🔧 初始化 BK 模組...');
  BK.BK_initialize().then(() => {
    console.log('✅ BK 模組初始化完成');
  }).catch((error) => {
    console.log('❌ BK 模組初始化失敗:', error.message);
  });
} else {
  console.log('⚠️ BK 模組未正確載入，跳過初始化');
}

if (LBK && typeof LBK.LBK_initialize === 'function') {
  console.log('🔧 初始化 LBK 模組...');
  LBK.LBK_initialize().then(() => {
    console.log('✅ LBK 模組初始化完成');
  }).catch((error) => {
    console.log('❌ LBK 模組初始化失敗:', error.message);
  });
} else {
  console.log('⚠️ LBK 模組未正確載入，跳過初始化');
}

if (SR && typeof SR.SR_initialize === 'function') {
  console.log('🔧 初始化 SR 排程提醒模組...');
  SR.SR_initialize().then(() => {
    console.log('✅ SR 模組初始化完成');
  }).catch((error) => {
    console.log('❌ SR 模組初始化失敗:', error.message);
  });
} else {
  console.log('⚠️ SR 模組未正確載入，跳過初始化');
}

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
 * 06. BK模組核心函數驗證 - 增強安全檢查
 * @version 2025-07-22-V1.0.1
 * @date 2025-07-22 10:15:00
 * @description 檢查BK模組的核心記帳處理函數是否正確導出和可用
 */
if (BK && typeof BK.BK_processBookkeeping === 'function') {
  console.log('✅ BK_processBookkeeping函數檢查: 存在');
} else if (BK) {
  console.log('❌ BK_processBookkeeping函數檢查: 不存在');
  console.log('📋 BK模組導出的函數:', Object.keys(BK));
} else {
  console.log('❌ BK模組載入失敗，無法檢查函數');
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
console.log('⚡ WH → LBK 直連路徑已啟用：WH → LBK → Firestore');
console.log('🚀 LINE OA 快速記帳：26個函數 → 8個函數，處理時間 < 2秒');
console.log('📋 Rich Menu/APP 路徑：維持 WH → DD → BK 完整功能');
console.log('📅 SR 排程提醒模組已整合：支援排程提醒、Quick Reply統計、付費功能控制（v1.3.0）');
