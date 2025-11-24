
/**
 * Firestore 索引創建腳本
 * @description 根據 CM 模組查詢需求創建必要的 Firestore 索引
 * @version 1.0.0
 * @date 2025-11-24
 */

const admin = require('firebase-admin');

// 初始化 Firebase Admin SDK
async function initializeFirebase() {
  try {
    // 如果還沒初始化，則使用配置初始化
    if (!admin.apps.length) {
      const firebaseConfig = require('./13. Replit_Module code_BL/1399. firebase-config.js');
      await firebaseConfig.validateFirebaseConfig();
      firebaseConfig.initializeFirebaseAdmin();
    }
    
    console.log('✅ Firebase 初始化成功');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Firebase 初始化失敗:', error.message);
    throw error;
  }
}

// 索引配置定義
const FIRESTORE_INDEXES = {
  // ledgers 集合的索引配置
  ledgers: [
    // 索引 1: archived + type + updated_at
    {
      fields: [
        { fieldPath: 'archived', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'updated_at', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION',
      description: '支援按類型和更新時間查詢非歸檔帳本'
    },
    
    // 索引 2: archived + type + lastActivity
    {
      fields: [
        { fieldPath: 'archived', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'lastActivity', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION',
      description: '支援按類型和最後活動時間查詢非歸檔帳本'
    },
    
    // 索引 3: archived + created_at (基本排序)
    {
      fields: [
        { fieldPath: 'archived', order: 'ASCENDING' },
        { fieldPath: 'created_at', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION',
      description: '支援按創建時間查詢非歸檔帳本'
    },
    
    // 索引 4: owner_id + type + updated_at (用戶特定查詢)
    {
      fields: [
        { fieldPath: 'owner_id', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'updated_at', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION',
      description: '支援用戶特定帳本類型和更新時間查詢'
    },
    
    // 索引 5: status + type + updated_at (狀態查詢)
    {
      fields: [
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'updated_at', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION',
      description: '支援按狀態和類型查詢帳本'
    }
  ],
  
  // collaborations 集合的索引配置
  collaborations: [
    // 索引 1: ownerId + status + updatedAt
    {
      fields: [
        { fieldPath: 'ownerId', order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'updatedAt', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION',
      description: '支援協作擁有者和狀態查詢'
    },
    
    // 索引 2: collaborationType + status + createdAt
    {
      fields: [
        { fieldPath: 'collaborationType', order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' }
      ],
      queryScope: 'COLLECTION',
      description: '支援協作類型和狀態查詢'
    }
  ]
};

// 生成 Firebase CLI 索引創建命令
function generateFirebaseCLICommands() {
  const commands = [];
  
  Object.keys(FIRESTORE_INDEXES).forEach(collectionName => {
    const indexes = FIRESTORE_INDEXES[collectionName];
    
    indexes.forEach((index, i) => {
      const fieldsStr = index.fields.map(field => {
        const order = field.order === 'DESCENDING' ? 'desc' : 'asc';
        return `${field.fieldPath}:${order}`;
      }).join(',');
      
      const command = `firebase firestore:indexes:create ` +
        `--collection-group=${collectionName} ` +
        `--fields="${fieldsStr}" ` +
        `--query-scope=${index.queryScope.toLowerCase()}`;
      
      commands.push({
        command,
        description: index.description,
        collection: collectionName,
        index: i + 1
      });
    });
  });
  
  return commands;
}

// 生成 firestore.indexes.json 配置文件
function generateFirestoreIndexesConfig() {
  const config = {
    indexes: [],
    fieldOverrides: []
  };
  
  Object.keys(FIRESTORE_INDEXES).forEach(collectionName => {
    const indexes = FIRESTORE_INDEXES[collectionName];
    
    indexes.forEach(index => {
      config.indexes.push({
        collectionGroup: collectionName,
        queryScope: index.queryScope,
        fields: index.fields.map(field => ({
          fieldPath: field.fieldPath,
          order: field.order
        }))
      });
    });
  });
  
  return config;
}

// 輸出索引創建信息
async function displayIndexInfo() {
  console.log('\n🔥 Firestore 索引創建腳本');
  console.log('=====================================\n');
  
  console.log('📋 需要創建的索引：');
  
  const commands = generateFirebaseCLICommands();
  commands.forEach((cmd, i) => {
    console.log(`\n${i + 1}. ${cmd.collection} 集合 - 索引 ${cmd.index}`);
    console.log(`   描述：${cmd.description}`);
    console.log(`   命令：${cmd.command}`);
  });
  
  console.log('\n\n🛠️ 使用方法：');
  console.log('1. 手動執行上述 Firebase CLI 命令');
  console.log('2. 或者將生成的 firestore.indexes.json 部署到 Firebase');
  console.log('3. 或者直接點擊錯誤訊息中的 Firebase Console 連結');
  
  console.log('\n🔗 快速連結（從錯誤訊息）：');
  console.log('https://console.firebase.google.com/v1/r/project/spheric-crow-352809/firestore/indexes');
  
  return commands;
}

// 創建 firestore.indexes.json 文件
async function createFirestoreIndexesFile() {
  const fs = require('fs').promises;
  const config = generateFirestoreIndexesConfig();
  
  try {
    await fs.writeFile(
      'firestore.indexes.json',
      JSON.stringify(config, null, 2),
      'utf8'
    );
    
    console.log('\n✅ firestore.indexes.json 文件已創建');
    console.log('使用以下命令部署索引：');
    console.log('firebase deploy --only firestore:indexes');
    
  } catch (error) {
    console.error('❌ 創建索引配置文件失敗:', error.message);
  }
}

// 檢查現有索引狀態
async function checkExistingIndexes(db) {
  try {
    console.log('\n🔍 檢查現有索引狀態...');
    
    // 嘗試執行問題查詢來檢查索引是否存在
    const testQueries = [
      {
        name: 'archived + type + updated_at',
        query: () => db.collection('ledgers')
          .where('archived', '==', false)
          .where('type', '==', 'shared')
          .orderBy('updated_at', 'desc')
          .limit(1)
      },
      {
        name: 'archived + created_at',
        query: () => db.collection('ledgers')
          .where('archived', '==', false)
          .orderBy('created_at', 'desc')
          .limit(1)
      }
    ];
    
    for (const test of testQueries) {
      try {
        await test.query().get();
        console.log(`✅ 索引 "${test.name}" 已存在`);
      } catch (error) {
        if (error.code === 9) { // FAILED_PRECONDITION
          console.log(`❌ 索引 "${test.name}" 不存在`);
        } else {
          console.log(`⚠️ 索引 "${test.name}" 檢查失敗: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('檢查索引狀態失敗:', error.message);
  }
}

// 主執行函數
async function main() {
  try {
    console.log('🚀 開始索引創建腳本...\n');
    
    // 初始化 Firebase
    const db = await initializeFirebase();
    
    // 檢查現有索引
    await checkExistingIndexes(db);
    
    // 顯示索引信息
    await displayIndexInfo();
    
    // 創建索引配置文件
    await createFirestoreIndexesFile();
    
    console.log('\n✨ 索引創建腳本完成！');
    console.log('\n📝 後續步驟：');
    console.log('1. 檢查生成的 firestore.indexes.json 文件');
    console.log('2. 執行 firebase deploy --only firestore:indexes');
    console.log('3. 或使用 Firebase Console 手動創建索引');
    console.log('4. 等待索引構建完成（可能需要幾分鐘）');
    
  } catch (error) {
    console.error('❌ 索引創建腳本執行失敗:', error.message);
    console.error('錯誤堆疊:', error.stack);
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  main().catch(console.error);
}

// 導出功能供其他模組使用
module.exports = {
  generateFirebaseCLICommands,
  generateFirestoreIndexesConfig,
  createFirestoreIndexesFile,
  displayIndexInfo,
  FIRESTORE_INDEXES
};
