const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // 請確認路徑正確

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initUserData() {
  // 從 Replit Secrets 讀取測試 UID
  const lineUID = process.env.UID_TEST;
  if (!lineUID) {
    console.error('❌ 找不到 UID_TEST 環境變數，請在 Replit Secrets 中設定');
    return;
  }

  const ledgerId = 'ledger_test_001';
  const currentTime = new Date(); // 2025-07-01 07:18:12 UTC
  const taiwanTime = new Date(currentTime.getTime() + 8 * 60 * 60 * 1000); // UTC+8
  const currentDateStr = '2025/07/01'; // 格式化為你的日期格式
  const currentTimeStr = '15:18'; // 台灣時間

  try {
    console.log(`🚀 開始初始化用戶資料... (執行者: AustinLiao69)`);
    console.log(`⏰ 當前 UTC 時間: 2025-07-01 07:18:12`);
    console.log(`🇹🇼 台灣時間: ${taiwanTime.toLocaleString('zh-TW')}`);

    // 1. 建立使用者文件
    await db.collection('users').doc(lineUID).set({
      nickname: 'AustinLiao69',
      realName: 'Austin Liao',
      createdAt: admin.firestore.Timestamp.now(),
      joined_ledgers: [ledgerId],
      createdBy: 'AustinLiao69'
    });

    // 2. 建立帳本文件
    await db.collection('ledgers').doc(ledgerId).set({
      name: 'LCAS 2.0 測試帳本 - AustinLiao69',
      description: '由 AustinLiao69 於 2025-07-01 建立的測試帳本',
      owner: lineUID,
      members: [lineUID],
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: 'AustinLiao69'
    });

    // 3. 建立科目代碼表 (subjects) - 對應 997. 科目代碼_測試
    const subjects = [
      {
        大項代碼: '100',
        大項名稱: '食物飲料',
        子項代碼: '10001',
        子項名稱: '早餐',
        同義詞: '早飯,morning meal,breakfast,麥當勞,早點'
      },
      {
        大項代碼: '100',
        大項名稱: '食物飲料', 
        子項代碼: '10002',
        子項名稱: '午餐',
        同義詞: '中餐,lunch,便當,外食'
      },
      {
        大項代碼: '100',
        大項名稱: '食物飲料',
        子項代碼: '10003',
        子項名稱: '晚餐',
        同義詞: '晚飯,dinner,宵夜,夜市'
      },
      {
        大項代碼: '100',
        大項名稱: '食物飲料',
        子項代碼: '10004',
        子項名稱: '咖啡飲料',
        同義詞: 'coffee,星巴克,手搖飲,珍奶'
      },
      {
        大項代碼: '200',
        大項名稱: '交通費用',
        子項代碼: '20001',
        子項名稱: '捷運',
        同義詞: 'MRT,地鐵,metro,悠遊卡'
      },
      {
        大項代碼: '200',
        大項名稱: '交通費用',
        子項代碼: '20002',
        子項名稱: '公車',
        同義詞: 'bus,客運,市區公車'
      },
      {
        大項代碼: '200',
        大項名稱: '交通費用',
        子項代碼: '20003',
        子項名稱: '計程車',
        同義詞: 'taxi,uber,計程車費'
      },
      {
        大項代碼: '300',
        大項名稱: '生活用品',
        子項代碼: '30001',
        子項名稱: '日用品',
        同義詞: '生活用品,daily necessities,全聯,家樂福'
      },
      {
        大項代碼: '400',
        大項名稱: '娛樂休閒',
        子項代碼: '40001',
        子項名稱: '電影',
        同義詞: 'movie,cinema,威秀,國賓'
      },
      {
        大項代碼: '500',
        大項名稱: '醫療保健',
        子項代碼: '50001',
        子項名稱: '看醫生',
        同義詞: '醫療費,診所,醫院,健保'
      },
      {
        大項代碼: '800',
        大項名稱: '薪資收入',
        子項代碼: '80001',
        子項名稱: '正職薪水',
        同義詞: '月薪,salary,工資,本薪'
      },
      {
        大項代碼: '900',
        大項名稱: '其他收入',
        子項代碼: '90001',
        子項名稱: '副業收入',
        同義詞: '兼職,side job,freelance,外快'
      }
    ];

    for (const subject of subjects) {
      await db.collection('ledgers').doc(ledgerId).collection('subjects').doc(subject.子項代碼).set({
        ...subject,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: 'AustinLiao69'
      });
    }

    // 4. 建立帳本紀錄 (entries) - 對應 999. Test ledger
    const entries = [
      {
        收支ID: '20250701-00001',
        使用者類型: 'S', // S:單帳本使用者
        日期: currentDateStr,
        時間: '08:30',
        大項代碼: '100',
        子項代碼: '10001',
        支付方式: '現金',
        子項名稱: '早餐',
        登錄者: lineUID,
        備註: '麥當勞早餐套餐 - 大麥克餐',
        收入: null,
        支出: 120,
        同義詞: '',
        timestamp: admin.firestore.Timestamp.now(),
        createdBy: 'AustinLiao69'
      },
      {
        收支ID: '20250701-00002',
        使用者類型: 'S',
        日期: currentDateStr,
        時間: '09:15',
        大項代碼: '100',
        子項代碼: '10004',
        支付方式: '行動支付',
        子項名稱: '咖啡飲料',
        登錄者: lineUID,
        備註: '星巴克拿鐵 - 上班提神',
        收入: null,
        支出: 165,
        同義詞: '',
        timestamp: admin.firestore.Timestamp.now(),
        createdBy: 'AustinLiao69'
      },
      {
        收支ID: '20250701-00003',
        使用者類型: 'S',
        日期: currentDateStr,
        時間: '12:15',
        大項代碼: '200',
        子項代碼: '20001',
        支付方式: '悠遊卡',
        子項名稱: '捷運',
        登錄者: lineUID,
        備註: '台北車站到信義區 - 上班通勤',
        收入: null,
        支出: 25,
        同義詞: '',
        timestamp: admin.firestore.Timestamp.now(),
        createdBy: 'AustinLiao69'
      },
      {
        收支ID: '20250701-00004',
        使用者類型: 'S',
        日期: currentDateStr,
        時間: currentTimeStr,
        大項代碼: '800',
        子項代碼: '80001',
        支付方式: '轉帳',
        子項名稱: '正職薪水',
        登錄者: lineUID,
        備註: '七月份薪資入帳 - LCAS專案開發',
        收入: 50000,
        支出: null,
        同義詞: '',
        timestamp: admin.firestore.Timestamp.now(),
        createdBy: 'AustinLiao69'
      },
      {
        收支ID: '20250701-00005',
        使用者類型: 'S',
        日期: currentDateStr,
        時間: '14:30',
        大項代碼: '300',
        子項代碼: '30001',
        支付方式: '刷卡',
        子項名稱: '日用品',
        登錄者: lineUID,
        備註: '全聯購買生活用品 - 衛生紙、洗衣精',
        收入: null,
        支出: 450,
        同義詞: '',
        timestamp: admin.firestore.Timestamp.now(),
        createdBy: 'AustinLiao69'
      }
    ];

    for (const entry of entries) {
      await db.collection('ledgers').doc(ledgerId).collection('entries').add(entry);
    }

    // 5. 建立 Log 紀錄 - 對應 Log欄位_v1.2
    const logs = [
      {
        時間: admin.firestore.Timestamp.now(),
        訊息: 'LCAS 2.0 系統成功初始化用戶資料',
        操作類型: '系統初始化',
        使用者ID: lineUID,
        錯誤代碼: null,
        來源: 'Replit',
        錯誤詳情: `執行者: AustinLiao69, UTC時間: 2025-07-01 07:18:12`,
        重試次數: 0,
        程式碼位置: 'initUserData.js:line_150',
        嚴重等級: 'INFO'
      },
      {
        時間: admin.firestore.Timestamp.now(),
        訊息: '科目代碼表建立完成',
        操作類型: '資料建立',
        使用者ID: lineUID,
        錯誤代碼: null,
        來源: 'Firestore',
        錯誤詳情: `建立了 ${subjects.length} 個科目代碼，執行者: AustinLiao69`,
        重試次數: 0,
        程式碼位置: 'initUserData.js:line_115',
        嚴重等級: 'INFO'
      },
      {
        時間: admin.firestore.Timestamp.now(),
        訊息: '帳本紀錄建立完成',
        操作類型: '資料建立',
        使用者ID: lineUID,
        錯誤代碼: null,
        來源: 'Firestore',
        錯誤詳情: `建立了 ${entries.length} 筆帳本紀錄，執行者: AustinLiao69`,
        重試次數: 0,
        程式碼位置: 'initUserData.js:line_140',
        嚴重等級: 'INFO'
      }
    ];

    for (const log of logs) {
      await db.collection('ledgers').doc(ledgerId).collection('log').add(log);
    }

    console.log('✅ LCAS 2.0 用戶資料初始化完成！');
    console.log(`✅ UTC 時間: 2025-07-01 07:18:12`);
    console.log(`✅ 執行者: AustinLiao69`);
    console.log(`✅ 使用者 ID: ${lineUID}`);
    console.log(`✅ 帳本 ID: ${ledgerId}`);
    console.log(`✅ 建立了 ${subjects.length} 個科目代碼`);
    console.log(`✅ 建立了 ${entries.length} 筆帳本紀錄`);
    console.log(`✅ 建立了 ${logs.length} 筆 Log 紀錄`);
    console.log('🎉 所有資料已成功匯入到 Firestore！');

  } catch (error) {
    console.error('❌ 用戶資料初始化失敗:', error);

    // 錯誤時也記錄到 log
    try {
      await db.collection('ledgers').doc(ledgerId).collection('log').add({
        時間: admin.firestore.Timestamp.now(),
        訊息: '用戶資料初始化過程發生錯誤',
        操作類型: '系統初始化',
        使用者ID: lineUID || 'unknown',
        錯誤代碼: error.code || 'UNKNOWN_ERROR',
        來源: 'Replit',
        錯誤詳情: `錯誤訊息: ${error.message}, 執行者: AustinLiao69, UTC時間: 2025-07-01 07:18:12`,
        重試次數: 0,
        程式碼位置: 'initUserData.js:catch_block',
        嚴重等級: 'ERROR'
      });
    } catch (logError) {
      console.error('❌ 連錯誤 Log 都寫入失敗:', logError);
    }
  }
}

// 執行用戶資料初始化
initUserData();