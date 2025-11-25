
const admin = require('firebase-admin');

// 如果還沒初始化 Firebase
if (!admin.apps.length) {
  const serviceAccount = require('./path/to/your/serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function initCollaborationCollections() {
  console.log('🚀 開始初始化協作集合...');
  
  try {
    // 1. 建立 collaboration_logs 集合的佔位文檔
    await db.collection('collaboration_logs').doc('_placeholder').set({
      purpose: '確保 collaboration_logs 集合存在',
      createdAt: admin.firestore.Timestamp.now(),
      note: '此文檔可在有實際資料後刪除'
    });
    
    // 2. 建立 member_invitations 集合的佔位文檔
    await db.collection('member_invitations').doc('_placeholder').set({
      purpose: '確保 member_invitations 集合存在',
      createdAt: admin.firestore.Timestamp.now(),
      note: '此文檔可在有實際資料後刪除'
    });
    
    console.log('✅ collaboration_logs 集合已建立');
    console.log('✅ member_invitations 集合已建立');
    console.log('🎉 協作集合初始化完成！');
    
  } catch (error) {
    console.error('❌ 初始化失敗:', error);
  }
}

// 執行初始化
initCollaborationCollections();
