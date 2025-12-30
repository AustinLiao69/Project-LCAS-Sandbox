/**
 * index.js_主啟動器模組_2.3.0
 * @module 主啟動器模組
 * @description LCAS LINE Bot 主啟動器 - SIT測試修復：補充缺失API端點，提升測試通過率
 * @update 2025-01-28: 升級至2.3.0版本，修復語法錯誤，新增SIT測試必要API端點
 * @date 2025-01-28
 */

console.log('🚀 LCAS Webhook 啟動中...', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

/**
 * 01. 增強全域錯誤處理機制設置
 * @version 2025-01-22-V1.1.0
 * @date 2025-01-22 10:00:00
 * @description 捕獲未處理的例外和Promise拒絕，防止程式意外終止，增強錯誤記錄
 */
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲的異常:', error);
  console.error('💥 異常堆疊:', error.stack);

  // 記錄到日誌文件
  if (DL && typeof DL.DL_error === 'function') {
    DL.DL_error('未捕獲的異常', 'SYSTEM', '', 'UNCAUGHT_EXCEPTION', error.toString(), 'index.js');
  }

  // 延遲退出，確保日誌記錄完成
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

/**
 * 02. 增強Promise拒絕處理機制
 * @version 2025-01-22-V1.1.0
 * @date 2025-01-22 10:00:00
 * @description 處理未捕獲的Promise拒絕，確保系統穩定性，增強錯誤記錄
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的 Promise 拒絕:', reason);
  console.error('💥 Promise:', promise);

  // 記錄到日誌文件
  if (DL && typeof DL.DL_error === 'function') {
    DL.DL_error('未處理的Promise拒絕', 'SYSTEM', '', 'UNHANDLED_REJECTION', reason?.toString() || 'Unknown reason', 'index.js');
  }
});

/**
 * 03. 模組載入與初始化 - 部署優化版
 * @version 2025-12-15-V2.4.1
 * @date 2025-12-15
 * @description 部署環境優化：延遲載入非關鍵模組，優先啟動HTTP服務器
 */


// 部署環境優化：只載入關鍵模組
let DL, WH;

// 快速載入關鍵模組
function loadCriticalModules() {
  try {
    DL = require('./13. Replit_Module code_BL/1310. DL.js');
    console.log('✅ 核心模組載入完成');
  } catch (error) {
    console.error('❌ 核心模組載入失敗:', error.message);
  }
}



// 部署優化：延遲載入非關鍵模組
let BK, LBK, DD, AM, SR;

// 延遲載入函數
async function loadApplicationModules() {
  const modules = [
    { name: 'BK', path: './13. Replit_Module code_BL/1301. BK.js' },
    { name: 'LBK', path: './13. Replit_Module code_BL/1315. LBK.js' },
    { name: 'DD', path: './13. Replit_Module code_BL/1331. DD1.js' },
    { name: 'AM', path: './13. Replit_Module code_BL/1309. AM.js' },
    { name: 'SR', path: './13. Replit_Module code_BL/1305. SR.js' }
  ];

  const loaded = [];
  const failed = [];

  for (const module of modules) {
    try {
      global[module.name] = require(module.path);
      loaded.push(module.name);
    } catch (error) {
      failed.push(module.name);
      console.error(`❌ ${module.name} 模組載入失敗:`, error.message);
    }
  }

  if (loaded.length > 0) {
    // console.log(`✅ 應用模組載入完成: ${loaded.join(', ')}`);
  }
  if (failed.length > 0) {
    console.error(`❌ 模組載入失敗: ${failed.join(', ')}`);
  }
}

// 部署優化：立即載入關鍵模組並啟動服務器
loadCriticalModules();

// 設置全域變數
global.FS_MODULE_READY = false;
global.FS_REMOVED = true;
global.FIREBASE_CONFIG_DIRECT = true;

// 延遲載入WH模組的函數
async function loadWebhookModule() {
  try {
    WH = require('./13. Replit_Module code_BL/1320. WH.js');
    console.log('✅ Webhook 模組載入完成');
  } catch (error) {
    console.error('❌ WH 模組載入失敗:', error.message);
    try {
      global.WH_BASIC_MODE = true;
      WH = require('./13. Replit_Module code_BL/1320. WH.js');
      console.log('✅ Webhook 模組基礎模式載入完成');
    } catch (basicError) {
      console.error('❌ WH 模組完全載入失敗:', basicError.message);
    }
  }
}

// 預先初始化各模組（安全初始化）
const initPromises = [];
if (BK && typeof BK.BK_initialize === 'function') {
  initPromises.push('BK');
  BK.BK_initialize().catch(() => {});
}
if (LBK && typeof LBK.LBK_initialize === 'function') {
  initPromises.push('LBK');
  LBK.LBK_initialize().catch(() => {});
}
if (SR && typeof SR.SR_initialize === 'function') {
  initPromises.push('SR');
  SR.SR_initialize().catch(() => {});
}
if (initPromises.length > 0) {
  console.log(`🔧 模組初始化中: ${initPromises.join(', ')}`);
}



/**
 * 09. 健康檢查與部署狀態監控設置
 * @version 2025-01-22-V1.0.0
 * @date 2025-01-22 10:00:00
 * @description 設置系統健康檢查機制，確保部署狀態可監控
 */
// 設置健康檢查定時器 - 統一環境
setInterval(() => {
  // 統一環境：執行健康檢查
  if (WH && typeof WH.WH_logDebug === 'function') {
    WH.WH_logDebug('系統健康檢查執行', '健康檢查', '', 'index.js');
  }
}, 604800000); // 168小時檢查一次

// =============== LINE Webhook專用服務器設置 ===============
const express = require('express');
const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 設置（針對LINE Webhook需求優化）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Line-Signature');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// =============== 系統監控端點（保留） ===============

// LINE Webhook 服務狀態首頁
app.get('/', async (req, res) => {
  try {
    const systemInfo = {
      service: 'Sophr LINE Webhook Service',
      version: '2.5.3',
      status: 'running',
      responsibility: 'LINE OA Webhook Processing',
      modules: {
        core: 'loaded'
      },
      endpoints: {
        webhook: '/webhook',
        https_check: '/check-https',
        home: '/'
      },
      companion_service: {
        name: 'ASL.js (API Service Layer)',
        port: 5000,
        responsibility: '132個RESTful API端點',
        status: 'running_separately'
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: systemInfo,
      message: 'Sophr LINE Webhook 服務運行正常'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'LINE Webhook 服務狀態檢查失敗',
      error: error.message
    });
  }
});

// LINE Webhook 服務健康檢查
app.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      service: 'LINE_WEBHOOK_SERVICE',
      timestamp: new Date().toISOString(),
      services: {
        webhook: {
          status: WH ? 'up' : 'down',
          port: 3000,
          purpose: 'LINE OA Message Processing'
        },
        line_integration: {
          status: LBK ? 'up' : 'down',
          purpose: 'Quick Booking Integration'
        },
        database: {
          status: FS ? 'up' : 'down', // FS模組已移除，此處檢查結果預計為 'down'
          type: 'Firestore',
          purpose: 'User Data Storage'
        }
      },
      core_modules: {
        status: 'operational'
      },
      architecture_info: {
        service_type: 'LINE_WEBHOOK_DEDICATED',
        companion_service: 'ASL.js (Port 5000)',
        endpoints_count: 5,
        primary_function: 'LINE OA訊息處理與回應'
      },
      metrics: {
        uptime: `${Math.floor(process.uptime())} seconds`,
        memory: process.memoryUsage(),
        version: '2.4.0'
      }
    };

    res.json({
      success: true,
      data: healthStatus,
      message: 'LINE Webhook 服務健康檢查完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'LINE Webhook 健康檢查失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// LINE Webhook 模組測試
app.get('/test-wh', async (req, res) => {
  try {
    if (!WH) {
      return res.status(503).json({
        success: false,
        message: 'LINE Webhook 模組未載入',
        service: 'LINE_WEBHOOK_SERVICE',
        timestamp: new Date().toISOString()
      });
    }

    const testResult = {
      service: 'LINE_WEBHOOK_SERVICE',
      module: 'WH',
      version: '2.1.9',
      status: 'loaded',
      core_functions: {
        doPost: typeof WH.doPost === 'function'
      },
      integration_modules: {
        LBK: !!LBK && typeof LBK.LBK_processMessage === 'function',
        DD: !!DD && typeof DD.DD_processRequest === 'function',
        BK: !!BK && typeof BK.BK_processBookkeeping === 'function'
      },
      line_capabilities: {
        message_processing: true,
        quick_booking: !!LBK,
        rich_menu_support: !!DD,
        webhook_verification: true
      },
      webhook_port: 3000,
      companion_service: {
        name: 'ASL.js',
        port: 5000,
        status: 'separate_service'
      },
      test_time: new Date().toISOString()
    };

    res.json({
      success: true,
      data: testResult,
      message: 'LINE Webhook 模組測試完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'LINE Webhook 模組測試失敗',
      error: error.message
    });
  }
});

// HTTPS支援檢查
app.get('/check-https', async (req, res) => {
  try {
    const protocol = req.get('X-Forwarded-Proto') || req.protocol;
    const httpsSupported = protocol === 'https';
    const host = req.get('host');

    const httpsInfo = {
      protocol: protocol,
      https_supported: httpsSupported,
      replit_proxy: true,
      service_urls: {
        webhook_service: httpsSupported ?
          `https://${host}/webhook` :
          `http://${host}/webhook`,
        asl_service: httpsSupported ?
          `https://${host.replace(':3000', ':5000')}/api/v1` :
          `http://${host.replace(':3000', ':5000')}/api/v1`
      },
      line_integration: {
        webhook_url: httpsSupported ?
          `https://${host}/webhook` :
          `http://${host}/webhook`,
        status: 'configured_for_line_platform'
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: httpsInfo,
      message: 'HTTPS 支援檢查完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'HTTPS 檢查失敗',
      error: error.message
    });
  }
});

// =============== LINE Webhook 端點（保留） ===============

// LINE Webhook 處理
app.post('/webhook', async (req, res) => {
  try {
    if (!WH) {
      console.error('WH 模組未載入，無法處理 Webhook');
      return res.status(503).json({
        success: false,
        message: 'Webhook 處理模組未載入'
      });
    }

    // 委派給 WH 模組處理
    await WH.doPost(req, res);
  } catch (error) {
    console.error('Webhook 處理失敗:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook 處理失敗',
      error: error.message
    });
  }
});

// =============== DCN-0011 Phase 4 重構完成 ===============
// ✅ 132個RESTful API端點已完全遷移至ASL.js (Port 5000)
// ✅ index.js專注於LINE Webhook處理，保留5個核心端點：
//    - POST /webhook - LINE訊息處理
//    - GET /health - 服務健康檢查
//    - GET /test-wh - Webhook模組測試
//    - GET /check-https - HTTPS支援檢查
//    - GET / - 服務狀態首頁
//
// 🏗️ 雙服務架構實現：
//    - index.js (Port 3000): LINE OA Webhook專用服務
//    - ASL.js (Port 5000): RESTful API專用服務
//
// 📋 職責分離完成，系統架構清晰化

// =============== WebSocket 即時協作同步（保留） ===============
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('📡 WebSocket 連線建立');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 處理即時協作同步
      if (data.type === 'collaboration_sync') {
        // 廣播給其他連線的用戶
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'sync_update',
              data: data.payload,
              timestamp: new Date().toISOString()
            }));
          }
        });
      }
    } catch (error) {
      console.error('WebSocket 訊息處理錯誤:', error);
    }
  });

  ws.on('close', () => {
    console.log('📡 WebSocket 連線關閉');
  });
});



// =============== 優雅關閉處理 ===============

// 捕獲 SIGTERM 信號進行優雅關閉
process.on('SIGTERM', () => {
  console.log('🛑 收到SIGTERM信號，正在關閉服務器...');

  server.close(() => {
    console.log('✅ HTTP 服務器已關閉');
    process.exit(0);
  });
});

// 捕獲 SIGINT 信號 (Ctrl+C)
process.on('SIGINT', () => {
  console.log('🛑 收到SIGINT信號，正在關閉服務器...');

  server.close(() => {
    console.log('✅ HTTP 服務器已關閉');
    process.exit(0);
  });
});

// =============== 立即啟動LINE Webhook專用服務器 ===============
server.listen(PORT, '0.0.0.0', async () => {
  // 在背景中載入其他模組
    try {
      await loadWebhookModule();
      await loadApplicationModules();
      // console.log('✅ 所有模組載入完成');
    } catch (error) {
      console.error('❌ 系統啟動失敗:', error.message);
    }
});