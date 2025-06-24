/**
 * index.js_v1.0.4
 */

const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();

// 設定解析 JSON 請求
app.use(express.json());

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// Google Sheets 設定
async function getGoogleSheet() {
  try {
    const creds = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);

    const serviceAccountAuth = new JWT({
      email: creds.client_email,
      key: creds.private_key.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    console.log('成功連接到 Google Sheets:', doc.title);

    return doc.sheetsByIndex[0];
  } catch (error) {
    console.error('Google Sheets 連接錯誤:', error);
    throw new Error(`Google Sheets API 錯誤: ${error.message}`);
  }
}

// 處理 LINE 訊息
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;
  const userId = event.source.userId;
  const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

  console.log(`收到訊息: ${userMessage} 來自用戶: ${userId}`);

  try {
    const sheet = await getGoogleSheet();

    const rows = await sheet.getRows();
    if (rows.length === 0) {
      await sheet.setHeaderRow(['時間', '用戶ID', '訊息']);
    }

    await sheet.addRow({
      '時間': timestamp,
      '用戶ID': userId,
      '訊息': userMessage,
    });

    console.log('成功寫入 Google Sheets');

    const allRows = await sheet.getRows();

    const replyText = `✅ 已收到您的訊息：${userMessage}\n📊 目前共有 ${allRows.length} 筆記錄\n⏰ 記錄時間：${timestamp}`;

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyText,
    });

  } catch (error) {
    console.error('處理訊息錯誤:', error);

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `❌ 發生錯誤，請稍後再試\n錯誤訊息：${error.message}`,
    });
  }
}

// Webhook 端點
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Webhook 錯誤:', err);
      res.status(500).send('Webhook 錯誤');
    });
});

// 測試端點
app.get('/', (req, res) => {
  res.send(`
    <h1>LINE Bot is running! 🤖</h1>
    <p>Webhook URL: <code>${req.protocol}://${req.get('host')}/webhook</code></p>
    <p>時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
  `);
});

// 測試 Google Sheets 連接
app.get('/test-sheets', async (req, res) => {
  try {
    const sheet = await getGoogleSheet();
    const rows = await sheet.getRows();
    res.json({
      success: true,
      sheetTitle: sheet.title,
      rowCount: rows.length,
      message: 'Google Sheets 連接成功！',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 端口佔用檢查並自動切換端口
let port = process.env.PORT || 3000;

function startServer() {
  const server = app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`📅 啟動時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is already in use. Trying port ${port + 1}...`);
      port += 1;
      startServer();
    } else {
      console.error(`❌ Unexpected error: ${err.message}`);
      process.exit(1);
    }
  });
}

startServer();