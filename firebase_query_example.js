
/**
 * Firebase查詢示例
 * @version 2025-01-01
 * @description 展示如何使用函數查詢Firebase的各種方式
 */

const admin = require('firebase-admin');

// 引入現有的Firebase配置
const firebaseConfig = require('./13. Replit_Module code_BL/1399. firebase-config.js');
const FS = require('./13. Replit_Module code_BL/1311. FS.js');

// 確保Firebase已初始化
let db;
try {
  db = firebaseConfig.getFirestoreInstance();
} catch (error) {
  console.error('Firebase初始化失敗:', error);
}

/**
 * 1. 基礎查詢 - 取得單一文檔
 */
async function queryUserById(userId) {
  try {
    console.log(`🔍 查詢用戶ID: ${userId}`);
    
    // 方法1: 直接使用Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ 用戶資料:', userData);
      return {
        success: true,
        data: userData,
        id: userDoc.id
      };
    } else {
      console.log('❌ 用戶不存在');
      return {
        success: false,
        message: '用戶不存在'
      };
    }
  } catch (error) {
    console.error('❌ 查詢失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 2. 使用FS模組查詢 - 更安全的方式
 */
async function queryUserWithFS(userId) {
  try {
    console.log(`🔍 使用FS模組查詢用戶: ${userId}`);
    
    const result = await FS.FS_getDocument('users', userId, 'SYSTEM');
    
    if (result.success) {
      console.log('✅ FS模組查詢成功:', result.data);
      return result;
    } else {
      console.log('❌ FS模組查詢失敗:', result.message);
      return result;
    }
  } catch (error) {
    console.error('❌ FS模組查詢異常:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 3. 查詢集合 - 取得多筆資料
 */
async function queryUsersByEmail(email) {
  try {
    console.log(`🔍 根據Email查詢用戶: ${email}`);
    
    const querySnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    const users = [];
    querySnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ 找到 ${users.length} 個用戶`);
    return {
      success: true,
      data: users,
      count: users.length
    };
  } catch (error) {
    console.error('❌ 集合查詢失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 4. 複合查詢 - 多條件查詢
 */
async function queryActiveUsersWithMode(userMode, limit = 10) {
  try {
    console.log(`🔍 查詢活躍的${userMode}模式用戶`);
    
    const querySnapshot = await db.collection('users')
      .where('status', '==', 'active')
      .where('userMode', '==', userMode)
      .orderBy('lastActiveAt', 'desc')
      .limit(limit)
      .get();
    
    const users = [];
    querySnapshot.forEach(doc => {
      users.push({
        id: doc.id,
        displayName: doc.data().displayName,
        email: doc.data().email,
        userMode: doc.data().userMode,
        lastActiveAt: doc.data().lastActiveAt
      });
    });
    
    console.log(`✅ 找到 ${users.length} 個活躍${userMode}用戶`);
    return {
      success: true,
      data: users,
      count: users.length
    };
  } catch (error) {
    console.error('❌ 複合查詢失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 5. 子集合查詢 - 查詢帳本的交易記錄
 */
async function queryTransactionsByLedger(ledgerId, startDate, endDate) {
  try {
    console.log(`🔍 查詢帳本 ${ledgerId} 的交易記錄`);
    
    let query = db.collection('ledgers').doc(ledgerId).collection('transactions');
    
    // 添加日期範圍條件
    if (startDate && endDate) {
      query = query.where('date', '>=', admin.firestore.Timestamp.fromDate(startDate))
                  .where('date', '<=', admin.firestore.Timestamp.fromDate(endDate));
    }
    
    // 按日期排序
    query = query.orderBy('date', 'desc').limit(50);
    
    const querySnapshot = await query.get();
    
    const transactions = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        amount: data.amount,
        type: data.type,
        description: data.description,
        date: data.date.toDate(),
        categoryId: data.categoryId
      });
    });
    
    console.log(`✅ 找到 ${transactions.length} 筆交易記錄`);
    return {
      success: true,
      data: transactions,
      count: transactions.length
    };
  } catch (error) {
    console.error('❌ 子集合查詢失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 6. 聚合查詢 - 統計資料
 */
async function queryUserStatistics() {
  try {
    console.log('🔍 查詢用戶統計資料');
    
    // 查詢所有用戶
    const usersSnapshot = await db.collection('users').get();
    
    const stats = {
      totalUsers: 0,
      activeUsers: 0,
      usersByMode: {},
      usersByStatus: {}
    };
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      stats.totalUsers++;
      
      // 統計狀態
      const status = data.status || 'unknown';
      stats.usersByStatus[status] = (stats.usersByStatus[status] || 0) + 1;
      
      // 統計模式
      const mode = data.userMode || 'unknown';
      stats.usersByMode[mode] = (stats.usersByMode[mode] || 0) + 1;
      
      // 統計活躍用戶（最近7天有活動）
      if (data.lastActiveAt) {
        const lastActive = data.lastActiveAt.toDate();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (lastActive > sevenDaysAgo) {
          stats.activeUsers++;
        }
      }
    });
    
    console.log('✅ 統計完成:', stats);
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('❌ 統計查詢失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 7. 示例執行函數
 */
async function runQueryExamples() {
  console.log('🚀 開始Firebase查詢示例...\n');
  
  try {
    // 1. 基礎查詢
    console.log('=== 1. 基礎查詢示例 ===');
    const userResult = await queryUserById('expert.valid@test.lcas.app');
    console.log('基礎查詢結果:', userResult);
    console.log('');
    
    // 2. FS模組查詢
    console.log('=== 2. FS模組查詢示例 ===');
    const fsResult = await queryUserWithFS('expert.valid@test.lcas.app');
    console.log('FS模組查詢結果:', fsResult);
    console.log('');
    
    // 3. 集合查詢
    console.log('=== 3. 集合查詢示例 ===');
    const emailResult = await queryUsersByEmail('expert.valid@test.lcas.app');
    console.log('Email查詢結果:', emailResult);
    console.log('');
    
    // 4. 複合查詢
    console.log('=== 4. 複合查詢示例 ===');
    const activeResult = await queryActiveUsersWithMode('Expert', 5);
    console.log('活躍用戶查詢結果:', activeResult);
    console.log('');
    
    // 5. 統計查詢
    console.log('=== 5. 統計查詢示例 ===');
    const statsResult = await queryUserStatistics();
    console.log('統計查詢結果:', statsResult);
    console.log('');
    
  } catch (error) {
    console.error('❌ 示例執行失敗:', error);
  }
}

// 導出所有函數
module.exports = {
  queryUserById,
  queryUserWithFS,
  queryUsersByEmail,
  queryActiveUsersWithMode,
  queryTransactionsByLedger,
  queryUserStatistics,
  runQueryExamples
};

// 如果直接執行此文件，則運行示例
if (require.main === module) {
  runQueryExamples();
}
