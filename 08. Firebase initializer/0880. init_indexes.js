
/**
 * 0880. init_indexes.js - Firebase索引初始化腳本
 * @version 1.0.0
 * @date 2025-11-25
 * @description 讀取0890.firestore.indexes.json配置，自動建立所有必要的Firestore索引
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 初始化Firebase Admin SDK
try {
  const firebaseConfig = require('../13. Replit_Module code_BL/1399. firebase-config.js');
  firebaseConfig.initializeFirebaseAdmin();
  console.log('✅ Firebase Admin SDK初始化成功');
} catch (error) {
  console.error('❌ Firebase初始化失敗:', error.message);
  process.exit(1);
}

/**
 * 讀取索引配置檔案
 */
function loadIndexConfig() {
  try {
    const configPath = path.join(__dirname, '0890. firestore.indexes.json');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    console.log('✅ 索引配置檔案載入成功');
    console.log(`📊 發現 ${config.indexes.length} 個複合索引配置`);
    console.log(`📊 發現 ${config.fieldOverrides.length} 個欄位覆寫配置`);
    
    return config;
  } catch (error) {
    console.error('❌ 索引配置檔案載入失敗:', error.message);
    throw error;
  }
}

/**
 * 檢查索引是否已存在（模擬檢查）
 */
function checkIndexExists(indexConfig) {
  // 注意：Firebase Admin SDK無法直接檢查索引是否存在
  // 這個函數主要用於記錄將要建立的索引
  const fields = indexConfig.fields.map(field => 
    `${field.fieldPath}(${field.order})`
  ).join(' + ');
  
  console.log(`🔍 準備建立索引: ${indexConfig.collectionGroup} - ${fields}`);
  return false; // 總是返回false，讓Firebase CLI決定是否需要建立
}

/**
 * 生成Firebase CLI命令
 */
function generateFirebaseCLICommands(config) {
  console.log('\n🚀 Firebase索引部署指南：\n');
  
  console.log('1. 確認Firebase專案已關聯：');
  console.log('   firebase projects:list');
  console.log('   firebase use <project-id>');
  
  console.log('\n2. 部署Firestore索引：');
  console.log('   firebase deploy --only firestore:indexes');
  
  console.log('\n3. 檢查索引建立狀態：');
  console.log('   firebase firestore:indexes');
  
  console.log('\n📋 將要建立的索引摘要：');
  
  // 按模組分類顯示
  const moduleIndexes = {
    CM: [],
    BM: [],
    WCM: [],
    AM: [],
    其他: []
  };
  
  config.indexes.forEach(index => {
    const collection = index.collectionGroup;
    const fields = index.fields.map(field => 
      `${field.fieldPath}(${field.order})`
    ).join(' + ');
    
    if (collection.includes('collaboration') || collection.includes('member_invitation')) {
      moduleIndexes.CM.push(`${collection}: ${fields}`);
    } else if (collection === 'budgets') {
      moduleIndexes.BM.push(`${collection}: ${fields}`);
    } else if (collection === 'wallets' || collection === 'categories') {
      moduleIndexes.WCM.push(`${collection}: ${fields}`);
    } else if (collection === 'users') {
      moduleIndexes.AM.push(`${collection}: ${fields}`);
    } else {
      moduleIndexes.其他.push(`${collection}: ${fields}`);
    }
  });
  
  Object.entries(moduleIndexes).forEach(([module, indexes]) => {
    if (indexes.length > 0) {
      console.log(`\n📦 ${module}模組索引 (${indexes.length}個):`);
      indexes.forEach(indexDesc => console.log(`   - ${indexDesc}`));
    }
  });
  
  console.log(`\n🎯 總計: ${config.indexes.length} 個複合索引, ${config.fieldOverrides.length} 個欄位覆寫`);
}

/**
 * 驗證索引配置合理性
 */
function validateIndexConfig(config) {
  const validations = [];
  
  config.indexes.forEach((index, i) => {
    // 檢查必要欄位
    if (!index.collectionGroup) {
      validations.push(`索引${i}: 缺少collectionGroup`);
    }
    
    if (!index.fields || index.fields.length === 0) {
      validations.push(`索引${i}: 缺少fields配置`);
    }
    
    // 檢查欄位配置
    if (index.fields) {
      index.fields.forEach((field, j) => {
        if (!field.fieldPath) {
          validations.push(`索引${i}欄位${j}: 缺少fieldPath`);
        }
        if (!field.order || !['ASCENDING', 'DESCENDING'].includes(field.order)) {
          validations.push(`索引${i}欄位${j}: 無效的order值`);
        }
      });
    }
  });
  
  if (validations.length > 0) {
    console.error('❌ 索引配置驗證失敗:');
    validations.forEach(error => console.error(`   - ${error}`));
    return false;
  }
  
  console.log('✅ 索引配置驗證通過');
  return true;
}

/**
 * 主執行函數
 */
async function main() {
  try {
    console.log('🔧 Firebase索引初始化腳本啟動\n');
    
    // 載入配置
    const config = loadIndexConfig();
    
    // 驗證配置
    if (!validateIndexConfig(config)) {
      throw new Error('索引配置驗證失敗');
    }
    
    // 檢查每個索引
    console.log('\n📋 索引配置檢查：');
    config.indexes.forEach((index, i) => {
      checkIndexExists(index);
    });
    
    // 生成部署指令
    generateFirebaseCLICommands(config);
    
    console.log('\n✅ 索引初始化腳本執行完成');
    console.log('⚠️  請注意：實際索引建立需要使用 Firebase CLI');
    console.log('💡 提示：執行 "firebase deploy --only firestore:indexes" 來部署索引');
    
  } catch (error) {
    console.error('❌ 索引初始化失敗:', error.message);
    process.exit(1);
  }
}

// 執行主函數
if (require.main === module) {
  main();
}

module.exports = {
  loadIndexConfig,
  validateIndexConfig,
  generateFirebaseCLICommands
};
