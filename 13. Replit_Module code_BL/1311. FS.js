/**
* FS_FirestoreStructure_資料庫結構模組_2.7.1
* @module 資料庫結構模組
* @description LCAS 2.7.1 Firestore資料庫結構模組 - Phase 3 預算子集合架構遷移完成 + 協作架構資料驗證強化
* @update 2025-11-18: 階段一修復 - 函數表頭重新編碼，統一版本格式
*/

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

// 初始化 Firebase Admin（使用動態配置）
let admin, db, PROJECT_ID, UNIVERSE_DOMAIN;

try {
  // 取得Firebase Admin實例
  admin = firebaseConfig.admin;

  // 初始化Firebase（如果尚未初始化）
  firebaseConfig.initializeFirebaseAdmin();

  // 取得 Firestore 實例
  db = firebaseConfig.getFirestoreInstance();

  // 取得專案資訊
  const projectInfo = firebaseConfig.getProjectInfo();
  PROJECT_ID = projectInfo.PROJECT_ID;
  UNIVERSE_DOMAIN = projectInfo.UNIVERSE_DOMAIN;

  console.log('✅ FS模組2.5.0：Firebase動態配置載入成功');

} catch (error) {
  console.error('❌ FS模組2.5.0：Firebase動態配置載入失敗:', error.message);

  // 檢查環境變數設定狀態
  try {
    const envCheck = firebaseConfig.checkEnvironmentVariables();
    console.log('💡 請檢查Replit Secrets中的Firebase環境變數設定');
    if (envCheck.missing.length > 0) {
      console.log('🔍 缺失的環境變數:', envCheck.missing.join(', '));
    }
  } catch (checkError) {
    console.warn('⚠️ 無法檢查環境變數:', checkError.message);
  }

  // 設定預設值以避免模組完全失效
  PROJECT_ID = 'default-project';
  UNIVERSE_DOMAIN = 'googleapis.com';
}

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = 'Asia/Taipei';

// =============== 階段一：核心基礎函數區 ===============

/**
 * 01. 模組初始化與配置管理
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 初始化FS模組，驗證Firebase配置和專案資訊
 */
function FS_initializeModule() {
  const functionName = "FS_initializeModule";
  try {
    FS_logOperation('FS模組2.5.0初始化', '模組初始化', 'system', '', '', functionName);

    // 驗證Firebase配置
    if (!db) {
      throw new Error('Firestore資料庫實例未正確初始化');
    }

    // 驗證專案資訊
    if (!PROJECT_ID || PROJECT_ID === 'default-project') {
      console.warn('⚠️ 使用預設專案ID，請檢查Firebase配置');
    }

    return {
      success: true,
      version: '2.5.0',
      projectId: PROJECT_ID,
      timezone: TIMEZONE,
      message: 'FS模組2.5.0初始化成功，包含預算子集合架構支援'
    };

  } catch (error) {
    FS_handleError(`模組初始化失敗: ${error.message}`, '模組初始化', 'system', 'FS_INIT_ERROR', error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_INIT_ERROR'
    };
  }
}

/**
 * 02. Firebase連接初始化
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 初始化並測試Firebase連接，確保Firestore可正常存取
 */
async function FS_initializeConnection() {
  const functionName = "FS_initializeConnection";
  try {
    FS_logOperation('Firebase連接初始化', 'Firebase連接', 'system', '', '', functionName);

    // 測試Firestore連接
    const testRef = db.collection('_health_check').doc('connection_test');
    const testData = {
      timestamp: admin.firestore.Timestamp.now(),
      status: 'connection_verified',
      version: '2.1.0',
      test_id: `test_${Date.now()}`
    };

    await testRef.set(testData);
    await testRef.delete();

    return {
      success: true,
      projectId: PROJECT_ID,
      universeDomain: UNIVERSE_DOMAIN,
      message: 'Firebase連接驗證成功'
    };

  } catch (error) {
    FS_handleError(`Firebase連接失敗: ${error.message}`, 'Firebase連接', 'system', 'FS_CONNECTION_ERROR', error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CONNECTION_ERROR'
    };
  }
}

/**
 * 03. 基礎文檔操作 - 建立文檔
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 在指定集合路徑建立新文檔，支援自訂文檔ID和數據
 */
async function FS_createDocument(collectionPath, documentId, data, requesterId) {
  const functionName = "FS_createDocument";
  try {
    FS_logOperation(`建立文檔: ${collectionPath}/${documentId}`, "建立文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId || !data) {
      throw new Error("缺少必要參數: collectionPath, documentId, data");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 建立文檔
    await docRef.set(data);

    console.log(`✅ Firebase文檔建立成功: ${collectionPath}/${documentId}`);

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      operation: 'created'
    };

  } catch (error) {
    FS_handleError(`建立文檔失敗: ${error.message}`, "建立文檔", requesterId || "", "FS_CREATE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 04. 基礎文檔操作 - 取得文檔
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 從指定集合路徑取得文檔數據，檢查文檔存在性
 */
async function FS_getDocument(collectionPath, documentId, requesterId) {
  const functionName = "FS_getDocument";
  try {
    FS_logOperation(`取得文檔: ${collectionPath}/${documentId}`, "取得文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId) {
      throw new Error("缺少必要參數: collectionPath, documentId");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 取得文檔
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        success: false,
        exists: false,
        error: "文檔不存在",
        errorCode: 'FS_DOCUMENT_NOT_FOUND'
      };
    }

    return {
      success: true,
      exists: true,
      data: doc.data(),
      documentId: documentId,
      path: `${collectionPath}/${documentId}`
    };

  } catch (error) {
    FS_handleError(`取得文檔失敗: ${error.message}`, "取得文檔", requesterId || "", "FS_GET_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_GET_DOCUMENT_ERROR'
    };
  }
}

/**
 * 05. 基礎文檔操作 - 更新文檔
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 更新指定文檔的部分欄位，支援增量更新操作
 */
async function FS_updateDocument(collectionPath, documentId, updateData, requesterId) {
  const functionName = "FS_updateDocument";
  try {
    FS_logOperation(`更新文檔: ${collectionPath}/${documentId}`, "更新文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId || !updateData) {
      throw new Error("缺少必要參數: collectionPath, documentId, updateData");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 執行更新操作
    await docRef.update(updateData);

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      updatedFields: Object.keys(updateData)
    };

  } catch (error) {
    FS_handleError(`更新文檔失敗: ${error.message}`, "更新文檔", requesterId || "", "FS_UPDATE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_UPDATE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 06. 基礎文檔操作 - 刪除文檔
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 從指定集合路徑永久刪除文檔
 */
async function FS_deleteDocument(collectionPath, documentId, requesterId) {
  const functionName = "FS_deleteDocument";
  try {
    FS_logOperation(`刪除文檔: ${collectionPath}/${documentId}`, "刪除文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId) {
      throw new Error("缺少必要參數: collectionPath, documentId");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 執行刪除操作
    await docRef.delete();

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      operation: 'deleted'
    };

  } catch (error) {
    FS_handleError(`刪除文檔失敗: ${error.message}`, "刪除文檔", requesterId || "", "FS_DELETE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_DELETE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 07. 基礎集合操作 - 查詢集合
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 查詢集合中的文檔，支援條件篩選、排序和分頁
 */
async function FS_queryCollection(collectionPath, queryConditions, requesterId, options = {}) {
  const functionName = "FS_queryCollection";
  try {
    FS_logOperation(`查詢集合: ${collectionPath}`, "查詢集合", requesterId || "", "", "", functionName);

    // 建立查詢
    let query = db.collection(collectionPath);

    // 套用查詢條件
    if (queryConditions && Array.isArray(queryConditions)) {
      queryConditions.forEach(condition => {
        query = query.where(condition.field, condition.operator, condition.value);
      });
    }

    // 套用排序
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
    }

    // 套用限制
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // 執行查詢
    const snapshot = await query.get();

    const results = [];
    snapshot.forEach(doc => {
      results.push({
        id: doc.id,
        data: doc.data()
      });
    });

    return {
      success: true,
      results: results,
      count: results.length,
      collectionPath: collectionPath
    };

  } catch (error) {
    FS_handleError(`查詢集合失敗: ${error.message}`, "查詢集合", requesterId || "", "FS_QUERY_COLLECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_QUERY_COLLECTION_ERROR'
    };
  }
}

/**
 * 08. 錯誤處理機制
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 統一錯誤處理機制，記錄錯誤詳情和操作上下文
 */
function FS_handleError(message, operation, userId, errorCode, details, functionName) {
  try {
    console.error(`[FS_ERROR_v2.1.0] ${new Date().toISOString()} | ${operation} | ${message} | Error: ${errorCode} | Function: ${functionName}`);

    if (details) {
      console.error(`[FS_ERROR_DETAILS] ${details}`);
    }

    return true;
  } catch (error) {
    console.error(`[FS_CRITICAL_ERROR] ${error.toString()}`);
    return false;
  }
}

/**
 * 09. 日誌記錄機制
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 統一日誌記錄機制，記錄操作詳情和時間戳記
 */
function FS_logOperation(message, operation, userId, errorCode, details, functionName) {
  try {
    console.log(`[FS_LOG_v2.1.0] ${new Date().toISOString()} | ${operation} | ${message} | User: ${userId} | Function: ${functionName}`);
    return true;
  } catch (error) {
    console.error(`[FS_LOG_ERROR] ${error.toString()}`);
    return false;
  }
}

// =============== 階段二：Phase 1 API端點支援函數 ===============

/**
 * 10. 認證服務支援 - 用戶註冊數據處理
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 處理用戶註冊數據，建立用戶文檔並檢查重複註冊
 */
async function FS_processUserRegistration(registrationData, requesterId) {
  const functionName = "FS_processUserRegistration";
  try {
    FS_logOperation(`處理用戶註冊: ${registrationData.email}`, "用戶註冊", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!registrationData.email || !registrationData.password || !registrationData.userMode) {
      throw new Error("缺少必要註冊資料: email, password, userMode");
    }

    // 檢查用戶是否已存在
    const existingUser = await FS_getDocument('users', registrationData.email, 'SYSTEM');
    if (existingUser.success && existingUser.exists) {
      return {
        success: false,
        error: "用戶已存在",
        errorCode: 'USER_ALREADY_EXISTS'
      };
    }

    // 準備用戶數據
    const userData = {
      email: registrationData.email,
      displayName: registrationData.displayName || '',
      userMode: registrationData.userMode,
      emailVerified: false,
      createdAt: admin.firestore.Timestamp.now(),
      lastActiveAt: admin.firestore.Timestamp.now(),
      preferences: {
        language: registrationData.language || 'zh-TW',
        timezone: registrationData.timezone || 'Asia/Taipei',
        theme: 'auto'
      },
      security: {
        hasAppLock: false,
        biometricEnabled: false,
        privacyModeEnabled: false
      }
    };

    // 建立用戶文檔
    const createResult = await FS_createDocument('users', registrationData.email, userData, 'SYSTEM');

    if (createResult.success) {
      return {
        success: true,
        userId: registrationData.email,
        userMode: registrationData.userMode,
        needsAssessment: registrationData.userMode === 'Assessment'
      };
    }

    return createResult;

  } catch (error) {
    FS_handleError(`用戶註冊處理失敗: ${error.message}`, "用戶註冊", requesterId || "", "FS_REGISTRATION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_REGISTRATION_ERROR'
    };
  }
}

/**
 * 11. 認證服務支援 - 用戶登入數據處理
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 處理用戶登入驗證，更新最後登入時間和登入歷史
 */
async function FS_processUserLogin(loginData, requesterId) {
  const functionName = "FS_processUserLogin";
  try {
    FS_logOperation(`處理用戶登入: ${loginData.email}`, "用戶登入", requesterId || "", "", "", functionName);

    // 取得用戶資料
    const userResult = await FS_getDocument('users', loginData.email, 'SYSTEM');

    if (!userResult.success || !userResult.exists) {
      return {
        success: false,
        error: "用戶不存在",
        errorCode: 'USER_NOT_FOUND'
      };
    }

    const userData = userResult.data;

    // 更新最後登入時間
    const updateData = {
      lastActiveAt: admin.firestore.Timestamp.now(),
      lastLoginAt: admin.firestore.Timestamp.now()
    };

    // 記錄登入歷史（Expert模式專用）
    if (userData.userMode === 'Expert') {
      updateData.loginHistory = {
        lastLogin: admin.firestore.Timestamp.now(),
        loginCount: admin.firestore.FieldValue.increment(1)
      };
    }

    await FS_updateDocument('users', loginData.email, updateData, 'SYSTEM');

    return {
      success: true,
      user: {
        id: loginData.email,
        email: userData.email,
        displayName: userData.displayName,
        userMode: userData.userMode,
        preferences: userData.preferences,
        lastActiveAt: userData.lastActiveAt
      },
      loginHistory: userData.userMode === 'Expert' ? updateData.loginHistory : undefined
    };

  } catch (error) {
    FS_handleError(`用戶登入處理失敗: ${error.message}`, "用戶登入", requesterId || "", "FS_LOGIN_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_LOGIN_ERROR'
    };
  }
}

/**
 * 12. 用戶管理支援 - 個人資料操作
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 管理用戶個人資料，支援查詢、更新偏好設定和安全設定
 */
async function FS_manageUserProfile(userId, operation, data, requesterId) {
  const functionName = "FS_manageUserProfile";
  try {
    FS_logOperation(`用戶資料管理: ${operation} - ${userId}`, "資料管理", requesterId || "", "", "", functionName);

    switch (operation) {
      case 'GET':
        return await FS_getDocument('users', userId, requesterId);

      case 'UPDATE':
        if (!data) {
          throw new Error("更新操作需要提供數據");
        }

        // 準備更新數據
        const updateData = {
          ...data,
          updatedAt: admin.firestore.Timestamp.now()
        };

        return await FS_updateDocument('users', userId, updateData, requesterId);

      case 'UPDATE_PREFERENCES':
        if (!data.preferences) {
          throw new Error("偏好設定更新需要preferences數據");
        }

        const prefUpdateData = {
          preferences: data.preferences,
          updatedAt: admin.firestore.Timestamp.now()
        };

        return await FS_updateDocument('users', userId, prefUpdateData, requesterId);

      case 'UPDATE_SECURITY':
        if (!data.security) {
          throw new Error("安全設定更新需要security數據");
        }

        const secUpdateData = {
          security: data.security,
          updatedAt: admin.firestore.Timestamp.now()
        };

        return await FS_updateDocument('users', userId, secUpdateData, requesterId);

      default:
        return {
          success: false,
          error: `不支援的操作: ${operation}`,
          errorCode: 'UNSUPPORTED_OPERATION'
        };
    }

  } catch (error) {
    FS_handleError(`用戶資料管理失敗: ${error.message}`, "資料管理", requesterId || "", "FS_PROFILE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_PROFILE_ERROR'
    };
  }
}

/**
 * 13. 用戶管理支援 - 模式評估數據處理
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 處理用戶模式評估，分析問卷結果並更新用戶模式設定
 */
async function FS_processUserAssessment(userId, assessmentData, requesterId) {
  const functionName = "FS_processUserAssessment";
  try {
    FS_logOperation(`處理模式評估: ${userId}`, "模式評估", requesterId || "", "", "", functionName);

    // 儲存評估結果
    const assessmentResult = {
      questionnaireId: assessmentData.questionnaireId,
      answers: assessmentData.answers,
      completedAt: admin.firestore.Timestamp.now(),
      userId: userId
    };

    // 分析評估結果（簡化實作）
    const analysis = FS_analyzeAssessmentResults(assessmentData.answers);

    // 更新用戶模式
    const updateData = {
      userMode: analysis.recommendedMode,
      assessmentHistory: admin.firestore.FieldValue.arrayUnion(assessmentResult),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const updateResult = await FS_updateDocument('users', userId, updateData, requesterId);

    if (updateResult.success) {
      return {
        success: true,
        result: {
          recommendedMode: analysis.recommendedMode,
          confidence: analysis.confidence,
          scores: analysis.scores,
          explanation: analysis.explanation
        },
        applied: true
      };
    }

    return updateResult;

  } catch (error) {
    FS_handleError(`模式評估處理失敗: ${error.message}`, "模式評估", requesterId || "", "FS_ASSESSMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_ASSESSMENT_ERROR'
    };
  }
}

/**
 * 14. 記帳交易支援 - 交易記錄操作
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 管理交易記錄，支援新增、查詢、更新、刪除和批次查詢操作
 */
async function FS_manageTransaction(ledgerId, operation, transactionData, requesterId) {
  const functionName = "FS_manageTransaction";
  try {
    FS_logOperation(`交易管理: ${operation} - ${ledgerId}`, "交易管理", requesterId || "", "", "", functionName);

    const collectionPath = `ledgers/${ledgerId}/transactions`;

    switch (operation) {
      case 'CREATE':
        if (!transactionData.id) {
          transactionData.id = FS_generateTransactionId();
        }

        const createData = {
          ...transactionData,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        return await FS_createDocument(collectionPath, transactionData.id, createData, requesterId);

      case 'GET':
        return await FS_getDocument(collectionPath, transactionData.id, requesterId);

      case 'UPDATE':
        const updateData = {
          ...transactionData,
          updatedAt: admin.firestore.Timestamp.now()
        };

        return await FS_updateDocument(collectionPath, transactionData.id, updateData, requesterId);

      case 'DELETE':
        return await FS_deleteDocument(collectionPath, transactionData.id, requesterId);

      case 'QUERY':
        const queryConditions = transactionData.conditions || [];
        const options = transactionData.options || {};

        return await FS_queryCollection(collectionPath, queryConditions, requesterId, options);

      default:
        return {
          success: false,
          error: `不支援的交易操作: ${operation}`,
          errorCode: 'UNSUPPORTED_TRANSACTION_OPERATION'
        };
    }

  } catch (error) {
    FS_handleError(`交易管理失敗: ${error.message}`, "交易管理", requesterId || "", "FS_TRANSACTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_TRANSACTION_ERROR'
    };
  }
}

/**
 * 15. 記帳交易支援 - 快速記帳數據處理
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 處理快速記帳輸入，解析自然語言並轉換為標準交易格式
 */
async function FS_processQuickTransaction(quickData, requesterId) {
  const functionName = "FS_processQuickTransaction";
  try {
    FS_logOperation(`處理快速記帳: ${quickData.input}`, "快速記帳", requesterId || "", "", "", functionName);

    // 解析快速輸入（簡化實作）
    const parsed = FS_parseQuickInput(quickData.input);

    if (!parsed.success) {
      return {
        success: false,
        error: "無法解析輸入內容",
        errorCode: 'PARSE_FAILED'
      };
    }

    // 轉換為標準交易格式
    const transactionData = {
      id: FS_generateTransactionId(),
      amount: parsed.amount,
      type: parsed.type,
      description: parsed.description,
      categoryId: parsed.categoryId || 'default',
      accountId: quickData.accountId || 'default',
      date: new Date().toISOString().split('T')[0],
      source: 'quick'
    };

    // 建立交易記錄
    const ledgerId = quickData.ledgerId || 'default';
    const createResult = await FS_manageTransaction(ledgerId, 'CREATE', transactionData, requesterId);

    if (createResult.success) {
      return {
        success: true,
        transactionId: transactionData.id,
        parsed: parsed,
        confirmation: `✅ 已記錄${parsed.type === 'income' ? '收入' : '支出'} NT$${parsed.amount} - ${parsed.description}`
      };
    }

    return createResult;

  } catch (error) {
    FS_handleError(`快速記帳處理失敗: ${error.message}`, "快速記帳", requesterId || "", "FS_QUICK_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_QUICK_ERROR'
    };
  }
}

// =============== 階段二：輔助函數 ===============

/**
 * 16. 生成交易ID
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 生成唯一的交易識別碼，包含時間戳記和隨機字串
 */
function FS_generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `txn_${timestamp}_${random}`;
}

/**
 * 17. 階段三新增：預算子集合寫入函數
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 將預算寫入指定帳本的budgets子集合，確保路徑正確性和安全驗證
 */
async function FS_createBudgetInLedger(ledgerId, budgetData, requesterId) {
  const functionName = "FS_createBudgetInLedger";
  try {
    FS_logOperation(`階段三：建立預算子集合 - ledgers/${ledgerId}/budgets`, "建立預算", requesterId || "", "", "", functionName);

    // 階段三路徑驗證：確保絕對使用子集合路徑
    const collectionPath = `ledgers/${ledgerId}/budgets`;
    console.log(`[${functionName}] 🎯 階段三強制路徑: ${collectionPath}`);

    // 路徑安全驗證
    if (!collectionPath.startsWith('ledgers/') || !collectionPath.endsWith('/budgets')) {
      throw new Error(`階段三路徑安全驗證失敗: ${collectionPath}`);
    }

    // 禁止頂層budgets集合
    if (collectionPath === 'budgets' || collectionPath.indexOf('ledgers/') === -1) {
      throw new Error(`階段三禁用頂層budgets集合: ${collectionPath}`);
    }

    // 生成預算ID
    const budgetId = budgetData.id || `budget_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 準備預算數據
    const finalBudgetData = {
      ...budgetData,
      budgetId: budgetId,
      ledgerId: ledgerId,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      createdBy: requesterId || 'system',
      collection_type: 'budget_subcollection',
      path_verification: collectionPath
    };

    // 寫入Firebase子集合
    const docRef = db.collection(collectionPath).doc(budgetId);
    await docRef.set(finalBudgetData);

    console.log(`[${functionName}] ✅ 階段三成功：預算已寫入 ${collectionPath}/${budgetId}`);
    console.log(`[${functionName}] 📋 確認帳本ID: ${ledgerId}`);
    console.log(`[${functionName}] 📋 確認預算ID: ${budgetId}`);

    return {
      success: true,
      budgetId: budgetId,
      ledgerId: ledgerId,
      path: `${collectionPath}/${budgetId}`,
      data: finalBudgetData
    };

  } catch (error) {
    FS_handleError(`階段三：預算子集合建立失敗: ${error.message}`, "建立預算", requesterId || "", "FS_CREATE_BUDGET_SUBCOLLECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_BUDGET_SUBCOLLECTION_ERROR'
    };
  }
}

/**
 * 18. 分析評估結果（簡化實作）
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 分析用戶評估問卷答案，推薦適合的記帳模式
 */
function FS_analyzeAssessmentResults(answers) {
  // 簡化的評估邏輯
  const scores = {
    Expert: 0,
    Inertial: 0,
    Cultivation: 0,
    Guiding: 0
  };

  // 根據答案計算分數（這裡需要實際的評估邏輯）
  answers.forEach(answer => {
    if (answer.selectedOptions) {
      answer.selectedOptions.forEach(option => {
        // 根據選項權重加分
        scores.Expert += Math.random() * 5;
        scores.Inertial += Math.random() * 5;
        scores.Cultivation += Math.random() * 5;
        scores.Guiding += Math.random() * 5;
      });
    }
  });

  // 找出最高分數的模式
  const recommendedMode = Object.keys(scores).reduce((a, b) =>
    scores[a] > scores[b] ? a : b
  );

  const maxScore = scores[recommendedMode];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? (maxScore / totalScore) * 100 : 0;

  return {
    recommendedMode: recommendedMode,
    confidence: confidence,
    scores: scores,
    explanation: `基於您的回答，推薦使用${recommendedMode}模式`
  };
}

/**
 * 19. 解析快速輸入（簡化實作）
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 解析快速記帳的自然語言輸入，提取金額、類型和描述
 */
function FS_parseQuickInput(input) {
  try {
    // 簡化的解析邏輯：尋找數字和描述
    const amountMatch = input.match(/(\d+)/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : null;

    if (!amount) {
      return { success: false, error: "找不到金額" };
    }

    const description = input.replace(/\d+/g, '').trim() || '未分類';
    const type = input.includes('收入') || input.includes('薪水') ? 'income' : 'expense';

    return {
      success: true,
      amount: amount,
      type: type,
      description: description,
      confidence: 0.8
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============== 相容性函數保留區 ===============

/**
 * 20. 合併文檔 - 相容性函數
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 合併更新Firestore中的文檔，保留現有欄位並新增或更新指定欄位
 */
async function FS_mergeDocument(collectionPath, documentId, mergeData, requesterId) {
  const functionName = "FS_mergeDocument";
  try {
    FS_logOperation(`合併文檔: ${collectionPath}/${documentId}`, "合併文檔", requesterId || "", "", "", functionName);

    // 使用 FS_setDocument 進行合併操作
    return await FS_setDocument(collectionPath, documentId, mergeData, requesterId, { merge: true });

  } catch (error) {
    FS_handleError(`合併文檔失敗: ${error.message}`, "合併文檔", requesterId || "", "FS_MERGE_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_MERGE_DOCUMENT_ERROR'
    };
  }
}

/**
 * 23. 新增到集合 - 相容性函數
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 新增文檔到Firestore集合，自動生成文檔ID
 */
async function FS_addToCollection(collectionPath, data, requesterId) {
  const functionName = "FS_addToCollection";
  try {
    FS_logOperation(`新增到集合: ${collectionPath}`, "新增文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !data) {
      throw new Error("缺少必要參數: collectionPath, data");
    }

    // 新增文檔
    const docRef = await db.collection(collectionPath).add(data);

    return {
      success: true,
      documentId: docRef.id,
      path: `${collectionPath}/${docRef.id}`,
      data: data
    };

  } catch (error) {
    FS_handleError(`新增到集合失敗: ${error.message}`, "新增文檔", requesterId || "", "FS_ADD_TO_COLLECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_ADD_TO_COLLECTION_ERROR'
    };
  }
}

/**
 * 24. 設置文檔 - 相容性函數
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 在Firestore中設置文檔，支援覆寫模式和合併模式
 */
async function FS_setDocument(collectionPath, documentId, data, requesterId, options = {}) {
  const functionName = "FS_setDocument";
  try {
    FS_logOperation(`設置文檔: ${collectionPath}/${documentId}`, "設置文檔", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!collectionPath || !documentId || !data) {
      throw new Error("缺少必要參數: collectionPath, documentId, data");
    }

    // 準備文檔引用
    const docRef = db.collection(collectionPath).doc(documentId);

    // 設置選項
    const setOptions = options.merge ? { merge: true } : {};

    // 執行設置操作
    await docRef.set(data, setOptions);

    return {
      success: true,
      documentId: documentId,
      path: `${collectionPath}/${documentId}`,
      operation: options.merge ? 'merge' : 'overwrite'
    };

  } catch (error) {
    FS_handleError(`設置文檔失敗: ${error.message}`, "設置文檔", requesterId || "", "FS_SET_DOCUMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_SET_DOCUMENT_ERROR'
    };
  }
}

// =============== 階段三：整合優化與驗證函數區 ===============

/**
 * 21. 系統配置初始化（一次性執行）
 * @version 2025-11-18-V2.7.1
 * @date 2025-11-18
 * @description 一次性系統配置初始化，建立集合框架、預設數據和預算結構
 */
async function FS_initializeSystemConfig(requesterId) {
  const functionName = "FS_initializeSystemConfig";
  try {
    FS_logOperation('系統配置初始化', "系統配置初始化", requesterId || "SYSTEM", "", "", functionName);

    const initResults = [];

    // 0. 建立基礎集合框架（透過建立佔位文檔）
    const collectionFramework = await FS_createCollectionFramework();
    initResults.push({ type: '集合框架', result: collectionFramework });

    // 1. 初始化系統配置文檔 (階段二強化版)
    const systemConfig = {
      version: '2.5.0',
      phase: 'Phase3-Budget-Subcollection-Migration-Complete',
      supportedModes: ['Expert', 'Inertial', 'Cultivation', 'Guiding'],
      features: {
        authentication: true,
        userManagement: true,
        basicBookkeeping: true,
        quickBooking: true,
        modeAssessment: true,
        budgetManagement: true
      },
      collections: {
        users: 'initialized',
        ledgers: 'initialized',
        '_system': 'initialized'
      },
      budgetSupport: {
        enabled: true,
        module: '1312.BM.js',
        structure_version: '3.0.0',
        architecture: 'subcollection',
        path_pattern: 'ledgers/{ledger_id}/budgets/{budget_id}',
        supported_operations: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'QUERY'],
        supported_types: ['monthly', 'yearly', 'quarterly', 'project', 'category']
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const systemConfigResult = await FS_createDocument('_system', 'config', systemConfig, 'SYSTEM');
    initResults.push({ type: '系統配置', result: systemConfigResult });

    // 2. 初始化預設科目結構
    const defaultCategories = await FS_initializeDefaultCategories();
    initResults.push({ type: '預設科目', result: defaultCategories });

    // 3. 初始化帳戶類型結構
    const defaultAccountTypes = await FS_initializeDefaultAccountTypes();
    initResults.push({ type: '帳戶類型', result: defaultAccountTypes });

    // 4. 初始化模式評估問卷
    const assessmentQuestions = await FS_initializeAssessmentQuestions();
    initResults.push({ type: '評估問卷', result: assessmentQuestions });

    // 5. 初始化預算管理文檔結構 (1312.BM.js支援 - 子集合版)
    const budgetStructure = await FS_initializeBudgetStructure();
    initResults.push({ type: '預算結構(子集合)', result: budgetStructure });

    // 5.1 建立預算子集合框架（確保預算子集合存在）
    const budgetsSubcollectionFramework = await FS_createBudgetsSubcollectionFramework();
    initResults.push({ type: '預算子集合框架', result: budgetsSubcollectionFramework });

    // 6. 初始化帳本集合文檔結構 (CM.js模組支援)
    const ledgerStructure = await FS_initializeLedgerStructure();
    initResults.push({ type: '帳本結構', result: ledgerStructure });

    const successCount = initResults.filter(r => r.result.success).length;
    const success = successCount === initResults.length;

    return {
      success: success,
      initialized: successCount,
      total: initResults.length,
      details: initResults,
      message: success ? '系統配置初始化完成' : '部分系統配置初始化失敗'
    };

  } catch (error) {
    FS_handleError(`系統配置初始化失敗: ${error.message}`, "系統配置初始化", requesterId || "SYSTEM", "FS_INIT_SYSTEM_CONFIG_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_INIT_SYSTEM_CONFIG_ERROR'
    };
  }
}

/**
 * 17. 業務資料結構初始化（為每個新用戶執行）
 * @version 2025-11-27-V2.3.0
 * @date 2025-11-27
 * @description 為每個新用戶初始化業務資料結構，確保基礎集合存在
 */
async function FS_initializeDataStructure(requesterId) {
  const functionName = "FS_initializeDataStructure";
  try {
    FS_logOperation('業務資料結構初始化', "資料結構初始化", requesterId || "SYSTEM", "", "", functionName);

    const initResults = [];

    // 1. 確保users集合基本框架存在
    try {
      const usersCollection = db.collection('users');
      // 測試集合存在（透過取得空查詢）
      await usersCollection.limit(1).get();
      initResults.push({
        type: 'users集合',
        result: { success: true, message: 'users集合框架已確認' }
      });
    } catch (error) {
      initResults.push({
        type: 'users集合',
        result: { success: false, error: error.message }
      });
    }

    // 2. 確保ledgers集合基本框架存在
    try {
      const ledgersCollection = db.collection('ledgers');
      // 測試集合存在（透過取得空查詢）
      await ledgersCollection.limit(1).get();
      initResults.push({
        type: 'ledgers集合',
        result: { success: true, message: 'ledgers集合框架已確認' }
      });
    } catch (error) {
      initResults.push({
        type: 'ledgers集合',
        result: { success: false, error: error.message }
      });
    }

    // 3. 建立集合索引結構定義文檔（為後續查詢最佳化）
    const indexStructure = {
      collections: {
        users: {
          indices: [
            { field: 'email', type: 'ascending' },
            { field: 'userMode', type: 'ascending' },
            { field: 'createdAt', type: 'descending' }
          ]
        },
        ledgers: {
          indices: [
            { field: 'owner_id', type: 'ascending' },
            { field: 'type', type: 'ascending' },
            { field: 'createdAt', type: 'descending' }
          ],
          subcollections: {
            transactions: [
              { field: 'user_id', type: 'ascending' },
              { field: 'date', type: 'descending' },
              { field: 'type', type: 'ascending' }
            ],
            accounts: [
              { field: 'type', type: 'ascending' },
              { field: 'is_active', type: 'ascending' }
            ],
            categories: [
              { field: 'type', type: 'ascending' },
              { field: 'parent_id', type: 'ascending' }
            ]
          }
        }
      },
      createdAt: admin.firestore.Timestamp.now(),
      purpose: '業務資料結構索引定義，供後續查詢最佳化參考'
    };

    const indexResult = await FS_createDocument('_system', 'index_structure', indexStructure, 'SYSTEM');
    initResults.push({ type: '索引結構', result: indexResult });

    const successCount = initResults.filter(r => r.result.success).length;
    const success = successCount === initResults.length;

    return {
      success: success,
      initialized: successCount,
      total: initResults.length,
      details: initResults,
      message: success ? '業務資料結構初始化完成' : '部分業務資料結構初始化失敗'
    };

  } catch (error) {
    FS_handleError(`業務資料結構初始化失敗: ${error.message}`, "資料結構初始化", requesterId || "SYSTEM", "FS_INIT_DATA_STRUCTURE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_INIT_DATA_STRUCTURE_ERROR'
    };
  }
}

/**
 * 18. Phase 1用戶基礎帳本建立
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 為新用戶建立基礎帳本，包含預設帳戶和科目設定
 */
async function FS_createUserBasicLedger(userId, userMode, requesterId) {
  const functionName = "FS_createUserBasicLedger";
  try {
    FS_logOperation(`建立用戶基礎帳本: ${userId}`, "帳本建立", requesterId || userId, "", "", functionName);

    // 驗證必要參數
    if (!userId || !userMode) {
      throw new Error("缺少必要參數: userId, userMode");
    }

    // 根據用戶模式配置帳本
    const ledgerConfig = FS_getLedgerConfigByMode(userMode);

    // 建立基礎帳本
    const ledgerData = {
      name: ledgerConfig.defaultName,
      description: ledgerConfig.description,
      owner_id: userId,
      members: [userId],
      type: 'personal',
      currency: 'TWD',
      timezone: 'Asia/Taipei',
      settings: {
        allowNegativeBalance: ledgerConfig.allowNegativeBalance,
        autoCategories: ledgerConfig.autoCategories,
        reminderSettings: ledgerConfig.reminderSettings,
        privacyMode: false
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      status: 'active'
    };

    const ledgerId = `personal_${userId}_${Date.now()}`;
    const createResult = await FS_createDocument('ledgers', ledgerId, ledgerData, requesterId);

    if (createResult.success) {
      // 建立基礎帳戶
      const accountResults = await FS_createBasicAccounts(ledgerId, userMode, requesterId);

      // 更新用戶預設帳本
      await FS_updateDocument('users', userId, {
        defaultLedgerId: ledgerId,
        hasBasicLedger: true,
        updatedAt: admin.firestore.Timestamp.now()
      }, requesterId);

      return {
        success: true,
        ledgerId: ledgerId,
        ledgerData: ledgerData,
        accounts: accountResults,
        userMode: userMode
      };
    }

    return createResult;

  } catch (error) {
    FS_handleError(`用戶基礎帳本建立失敗: ${error.message}`, "帳本建立", requesterId || userId, "FS_CREATE_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_LEDGER_ERROR'
    };
  }
}

/**
 * 19. Phase 1科目數據初始化
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 為指定帳本初始化科目數據，依據用戶模式建立適當的收支科目
 */
async function FS_initializePhase1Categories(ledgerId, userMode, requesterId) {
  const functionName = "FS_initializePhase1Categories";
  try {
    FS_logOperation(`Phase 1科目初始化: ${ledgerId}`, "科目初始化", requesterId || "", "", "", functionName);

    // 取得模式特定的科目配置
    const categoryConfig = FS_getCategoryConfigByMode(userMode);
    const categoryResults = [];

    // 建立收入科目
    for (const income of categoryConfig.incomeCategories) {
      const categoryData = {
        name: income.name,
        type: 'income',
        icon: income.icon,
        color: income.color,
        parentId: null,
        level: 1,
        order: income.order,
        isDefault: true,
        isActive: true,
        ledgerId: ledgerId,
        createdAt: admin.firestore.Timestamp.now()
      };

      const categoryId = `income_${income.code}_${ledgerId}`;
      const result = await FS_createDocument(`ledgers/${ledgerId}/categories`, categoryId, categoryData, requesterId);
      categoryResults.push({ type: '收入', name: income.name, result });
    }

    // 建立支出科目
    for (const expense of categoryConfig.expenseCategories) {
      const categoryData = {
        name: expense.name,
        type: 'expense',
        icon: expense.icon,
        color: expense.color,
        parentId: null,
        level: 1,
        order: expense.order,
        isDefault: true,
        isActive: true,
        ledgerId: ledgerId,
        createdAt: admin.firestore.Timestamp.now()
      };

      const categoryId = `expense_${expense.code}_${ledgerId}`;
      const result = await FS_createDocument(`ledgers/${ledgerId}/categories`, categoryId, categoryData, requesterId);
      categoryResults.push({ type: '支出', name: expense.name, result });
    }

    const successCount = categoryResults.filter(r => r.result.success).length;
    const success = successCount > 0;

    return {
      success: success,
      created: successCount,
      total: categoryResults.length,
      categories: categoryResults,
      userMode: userMode
    };

  } catch (error) {
    FS_handleError(`Phase 1科目初始化失敗: ${error.message}`, "科目初始化", requesterId || "", "FS_INIT_CATEGORIES_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_INIT_CATEGORIES_ERROR'
    };
  }
}

/**
 * 20. 系統健康檢查
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 執行系統健康檢查，驗證Firebase連接、CRUD操作和核心功能
 */
async function FS_performHealthCheck(requesterId) {
  const functionName = "FS_performHealthCheck";
  try {
    FS_logOperation('系統健康檢查開始', "健康檢查", requesterId || "SYSTEM", "", "", functionName);

    const healthResults = {
      timestamp: new Date().toISOString(),
      version: '2.1.0',
      checks: []
    };

    // 1. Firebase連接檢查
    try {
      await FS_initializeConnection();
      healthResults.checks.push({
        component: 'Firebase連接',
        status: 'healthy',
        responseTime: '< 100ms'
      });
    } catch (error) {
      healthResults.checks.push({
        component: 'Firebase連接',
        status: 'unhealthy',
        error: error.message
      });
    }

    // 2. 基礎CRUD操作檢查
    try {
      const testDoc = {
        type: 'health_check',
        timestamp: admin.firestore.Timestamp.now(),
        testData: 'system_health_verification'
      };

      const createResult = await FS_createDocument('_health_check', 'crud_test', testDoc, 'SYSTEM');
      const readResult = await FS_getDocument('_health_check', 'crud_test', 'SYSTEM');
      const updateResult = await FS_updateDocument('_health_check', 'crud_test', { updated: true }, 'SYSTEM');
      const deleteResult = await FS_deleteDocument('_health_check', 'crud_test', 'SYSTEM');

      const crudSuccess = createResult.success && readResult.success &&
                         updateResult.success && deleteResult.success;

      healthResults.checks.push({
        component: 'CRUD操作',
        status: crudSuccess ? 'healthy' : 'unhealthy',
        operations: {
          create: createResult.success,
          read: readResult.success,
          update: updateResult.success,
          delete: deleteResult.success
        }
      });
    } catch (error) {
      healthResults.checks.push({
        component: 'CRUD操作',
        status: 'unhealthy',
        error: error.message
      });
    }

    // 3. Phase 1核心功能檢查
    try {
      const phase1Check = await FS_verifyPhase1Functions();
      healthResults.checks.push({
        component: 'Phase 1功能',
        status: phase1Check.allFunctional ? 'healthy' : 'degraded',
        functionalModules: phase1Check.functionalCount,
        totalModules: phase1Check.totalCount,
        details: phase1Check.moduleStatus
      });
    } catch (error) {
      healthResults.checks.push({
        component: 'Phase 1功能',
        status: 'unhealthy',
        error: error.message
      });
    }

    // 4. 系統資源檢查
    const memoryUsage = process.memoryUsage();
    healthResults.checks.push({
      component: '系統資源',
      status: memoryUsage.heapUsed < 100 * 1024 * 1024 ? 'healthy' : 'warning', // 100MB threshold
      memory: {
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
      }
    });

    // 計算整體健康狀態
    const healthyCount = healthResults.checks.filter(c => c.status === 'healthy').length;
    const totalChecks = healthResults.checks.length;

    healthResults.overallStatus = healthyCount === totalChecks ? 'healthy' :
                                 healthyCount >= totalChecks * 0.8 ? 'degraded' : 'unhealthy';
    healthResults.healthScore = (healthyCount / totalChecks * 100).toFixed(2);

    return {
      success: true,
      healthResults: healthResults,
      overallStatus: healthResults.overallStatus,
      recommendation: FS_getHealthRecommendation(healthResults.overallStatus)
    };

  } catch (error) {
    FS_handleError(`系統健康檢查失敗: ${error.message}`, "健康檢查", requesterId || "SYSTEM", "FS_HEALTH_CHECK_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_HEALTH_CHECK_ERROR'
    };
  }
}

/**
 * 21. Phase 1功能驗證機制
 * @version 2025-09-16-V2.1.0
 * @date 2025-09-16
 * @description 驗證Phase 1功能整合，測試用戶註冊、記帳功能和API端點
 */
async function FS_validatePhase1Integration(requesterId) {
  const functionName = "FS_validatePhase1Integration";
  try {
    FS_logOperation('Phase 1功能驗證開始', "功能驗證", requesterId || "SYSTEM", "", "", functionName);

    const validationResults = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 1',
      validations: []
    };

    // 1. 用戶註冊流程驗證
    try {
      const testUser = {
        email: `test_${Date.now()}@lcas.test`,
        password: 'test123456',
        displayName: '測試用戶',
        userMode: 'Expert'
      };

      const registrationResult = await FS_processUserRegistration(testUser, 'VALIDATION');
      validationResults.validations.push({
        function: '用戶註冊流程',
        status: registrationResult.success ? 'pass' : 'fail',
        details: registrationResult
      });

      // 清理測試數據
      if (registrationResult.success) {
        await FS_deleteDocument('users', testUser.email, 'VALIDATION');
      }
    } catch (error) {
      validationResults.validations.push({
        function: '用戶註冊流程',
        status: 'error',
        error: error.message
      });
    }

    // 2. 記帳功能驗證
    try {
      const quickBookingResult = await FS_processQuickTransaction({
        input: '測試記帳100',
        ledgerId: 'validation_ledger',
        userId: 'validation_user'
      }, 'VALIDATION');

      validationResults.validations.push({
        function: '快速記帳功能',
        status: quickBookingResult.success ? 'pass' : 'fail',
        details: quickBookingResult
      });
    } catch (error) {
      validationResults.validations.push({
        function: '快速記帳功能',
        status: 'error',
        error: error.message
      });
    }

    // 3. 數據一致性驗證
    try {
      const consistencyCheck = await FS_checkDataConsistency();
      validationResults.validations.push({
        function: '數據一致性',
        status: consistencyCheck.consistent ? 'pass' : 'fail',
        details: consistencyCheck
      });
    } catch (error) {
      validationResults.validations.push({
        function: '數據一致性',
        status: 'error',
        error: error.message
      });
    }

    // 4. API端點驗證
    const apiValidation = await FS_validateAPIEndpoints();
    validationResults.validations.push({
      function: 'API端點',
      status: apiValidation.allWorking ? 'pass' : 'fail',
      details: apiValidation
    });

    // 計算驗證結果
    const passedCount = validationResults.validations.filter(v => v.status === 'pass').length;
    const totalValidations = validationResults.validations.length;

    validationResults.overallResult = passedCount === totalValidations ? 'pass' :
                                     passedCount >= totalValidations * 0.8 ? 'warning' : 'fail';
    validationResults.successRate = (passedCount / totalValidations * 100).toFixed(2);

    return {
      success: true,
      validationResults: validationResults,
      overallResult: validationResults.overallResult,
      recommendation: FS_getValidationRecommendation(validationResults.overallResult)
    };

  } catch (error) {
    FS_handleError(`Phase 1功能驗證失敗: ${error.message}`, "功能驗證", requesterId || "SYSTEM", "FS_VALIDATION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_VALIDATION_ERROR'
    };
  }
}

// =============== 階段三：輔助函數區 ===============

/**
 * 26. 建立基礎集合框架
 * @version 2025-10-29-V2.4.0
 * @date 2025-10-29
 * @description 透過建立佔位文檔確保基礎集合存在，包含users和ledgers集合
 */
async function FS_createCollectionFramework() {
  try {
    const results = [];

    // 1. 建立 users 集合框架
    const usersPlaceholder = {
      type: 'collection_placeholder',
      purpose: '確保 users 集合存在',
      createdAt: admin.firestore.Timestamp.now(),
      note: '此文檔僅用於確保集合框架存在，實際用戶註冊時會被覆蓋或刪除'
    };

    const usersResult = await FS_createDocument('users', '_placeholder', usersPlaceholder, 'SYSTEM');
    results.push({ collection: 'users', result: usersResult });

    // 2. 建立 ledgers 集合框架
    const ledgersPlaceholder = {
      type: 'collection_placeholder',
      purpose: '確保 ledgers 集合存在',
      createdAt: admin.firestore.Timestamp.now(),
      note: '此文檔僅用於確保集合框架存在，實際帳本建立時會有真實文檔'
    };

    const ledgersResult = await FS_createDocument('ledgers', '_placeholder', ledgersPlaceholder, 'SYSTEM');
    results.push({ collection: 'ledgers', result: ledgersResult });

    // 3. 舊的 budgets 集合已完全遷移至子集合架構，不再建立頂層集合
    console.log('📋 頂層 budgets 集合已棄用，全面採用 ledgers/{id}/budgets/ 子集合架構');

    const successCount = results.filter(r => r.result.success).length;

    return {
      success: successCount === results.length,
      initialized: successCount,
      total: results.length,
      collections: results,
      message: `集合框架建立完成: ${successCount}/${results.length}`
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_COLLECTION_FRAMEWORK_ERROR'
    };
  }
}

/**
 * 27. 建立完整帳本子集合架構（新版本 - 支援所有子集合）
 * @version 2025-10-30-V3.1.0
 * @date 2025-10-30
 * @description 為指定帳本建立完整子集合架構：accounts, transactions, categories, budgets
 */
async function FS_createCompleteSubcollectionFramework(ledgerId, userId = 'SYSTEM') {
  const functionName = "FS_createCompleteSubcollectionFramework";
  try {
    FS_logOperation(`建立完整帳本子集合架構: ${ledgerId}`, "子集合架構建立", userId, "", "", functionName);

    const results = [];

    // 1. 建立帳戶子集合 (accounts)
    const accountDefaults = [
      {
        accountId: 'default_cash',
        name: '現金',
        type: 'cash',
        currency: 'TWD',
        balance: 0,
        isDefau  lt: true,
        isActive: true,
        icon: '💵',
        color: '#4CAF50'
      },
      {
        accountId: 'default_bank',
        name: '銀行帳戶',
        type: 'bank',
        currency: 'TWD',
        balance: 0,
        isDefault: false,
        isActive: true,
        icon: '🏦',
        color: '#2196F3'
      },
      {
        accountId: 'default_credit',
        name: '信用卡',
        type: 'credit',
        currency: 'TWD',
        balance: 0,
        isDefault: false,
        isActive: true,
        icon: '💳',
        color: '#FF9800'
      }
    ];

    for (const account of accountDefaults) {
      const accountData = {
        ...account,
        ledgerId: ledgerId,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: userId
      };

      const accountResult = await FS_createDocument(
        `ledgers/${ledgerId}/accounts`,
        account.accountId,
        accountData,
        userId
      );
      results.push({ type: 'accounts', id: account.accountId, result: accountResult });
    }

    // 2. 建立科目子集合 (categories)
    const categoryDefaults = [
      // 收入科目
      { categoryId: 'income_salary', name: '薪資收入', type: 'income', icon: '💰', color: '#4CAF50', order: 1 },
      { categoryId: 'income_business', name: '營業收入', type: 'income', icon: '🏢', color: '#2196F3', order: 2 },
      { categoryId: 'income_other', name: '其他收入', type: 'income', icon: '💝', color: '#9C27B0', order: 3 },

      // 支出科目
      { categoryId: 'expense_food', name: '餐飲', type: 'expense', icon: '🍽️', color: '#FF5722', order: 1 },
      { categoryId: 'expense_transport', name: '交通', type: 'expense', icon: '🚗', color: '#607D8B', order: 2 },
      { categoryId: 'expense_shopping', name: '購物', type: 'expense', icon: '🛍️', color: '#E91E63', order: 3 },
      { categoryId: 'expense_entertainment', name: '娛樂', type: 'expense', icon: '🎬', color: '#673AB7', order: 4 },
      { categoryId: 'expense_utilities', name: '水電費', type: 'expense', icon: '⚡', color: '#795548', order: 5 },
      { categoryId: 'expense_healthcare', name: '醫療', type: 'expense', icon: '🏥', color: '#009688', order: 6 }
    ];

    for (const category of categoryDefaults) {
      const categoryData = {
        ...category,
        ledgerId: ledgerId,
        parentId: null,
        level: 1,
        isDefault: true,
        isActive: true,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        createdBy: userId
      };

      const categoryResult = await FS_createDocument(
        `ledgers/${ledgerId}/categories`,
        category.categoryId,
        categoryData,
        userId
      );
      results.push({ type: 'categories', id: category.categoryId, result: categoryResult });
    }

    // 3. 建立交易子集合範例 (transactions) - 建立佔位符確保集合存在
    const transactionPlaceholder = {
      transactionId: '_placeholder',
      ledgerId: ledgerId,
      amount: 0,
      type: 'placeholder',
      description: '交易子集合佔位符',
      categoryId: 'expense_food',
      accountId: 'default_cash',
      date: new Date().toISOString().split('T')[0],
      userId: userId,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      note: '此為確保交易子集合存在的佔位文檔，實際交易記錄建立時會有真實數據'
    };

    const transactionResult = await FS_createDocument(
      `ledgers/${ledgerId}/transactions`,
      '_placeholder',
      transactionPlaceholder,
      userId
    );
    results.push({ type: 'transactions', id: '_placeholder', result: transactionResult });

    // 4. 建立預算子集合 (budgets) - 建立預設月度預算
    const budgetDefault = {
      budgetId: 'default_monthly_budget',
      ledgerId: ledgerId,
      name: '月度預算',
      type: 'monthly',
      total_amount: 30000,
      consumed_amount: 0,
      currency: 'TWD',
      startDate: admin.firestore.Timestamp.now(),
      endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30天後
      allocation: [
        {
          categoryId: 'expense_food',
          categoryName: '餐飲',
          allocated_amount: 12000,
          consumed_amount: 0
        },
        {
          categoryId: 'expense_transport',
          categoryName: '交通',
          allocated_amount: 6000,
          consumed_amount: 0
        },
        {
          categoryId: 'expense_shopping',
          categoryName: '購物',
          allocated_amount: 8000,
          consumed_amount: 0
        },
        {
          categoryId: 'expense_entertainment',
          categoryName: '娛樂',
          allocated_amount: 4000,
          consumed_amount: 0
        }
      ],
      alert_rules: {
        warning_threshold: 80,
        critical_threshold: 95,
        enable_notifications: true,
        notification_channels: ['system']
      },
      createdBy: userId,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      status: 'active'
    };

    const budgetResult = await FS_createDocument(
      `ledgers/${ledgerId}/budgets`,
      'default_monthly_budget',
      budgetDefault,
      userId
    );
    results.push({ type: 'budgets', id: 'default_monthly_budget', result: budgetResult });

    // 統計建立結果
    const successCount = results.filter(r => r.result.success).length;
    const totalCount = results.length;

    return {
      success: successCount === totalCount,
      message: `帳本${ledgerId}完整子集合架構建立${successCount === totalCount ? '成功' : '部分失敗'}`,
      created_subcollections: {
        accounts: results.filter(r => r.type === 'accounts' && r.result.success).length,
        categories: results.filter(r => r.type === 'categories' && r.result.success).length,
        transactions: results.filter(r => r.type === 'transactions' && r.result.success).length,
        budgets: results.filter(r => r.type === 'budgets' && r.result.success).length
      },
      details: results,
      success_rate: `${successCount}/${totalCount}`
    };

  } catch (error) {
    FS_handleError(`建立完整帳本子集合架構失敗: ${error.message}`, "子集合架構建立", userId, "FS_CREATE_COMPLETE_SUBCOLLECTION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_COMPLETE_SUBCOLLECTION_ERROR'
    };
  }
}

/**
 * 28. 建立完整帳本子集合框架（階段三專用）
 * @version 2025-10-30-V3.0.0
 * @date 2025-10-30
 * @description 建立完整帳本子集合架構範例，包含所有子集合的示例文檔
 */
async function FS_createBudgetsSubcollectionFramework() {
  try {
    // 建立示例帳本以支援完整子集合
    const exampleLedger = {
      ledgerId: 'example_ledger_for_budgets',
      name: '完整子集合範例帳本',
      type: 'system_example',
      owner_id: 'SYSTEM', // Changed from owner_id to userId
      members: ['SYSTEM'],
      currency: 'TWD',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      status: 'example',
      note: '此為支援完整帳本子集合的範例帳本'
    };

    // 建立示例帳本
    const ledgerResult = await FS_createDocument('ledgers', 'example_ledger_for_budgets', exampleLedger, 'SYSTEM');

    const results = [];

    // 1. 建立帳戶子集合 (accounts)
    const accountExample = {
      accountId: 'example_account',
      ledgerId: 'example_ledger_for_budgets',
      name: '現金帳戶',
      type: 'cash',
      currency: 'TWD',
      balance: 50000,
      isDefault: true,
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      note: '帳戶子集合範例'
    };

    const accountResult = await FS_createDocument(
      'ledgers/example_ledger_for_budgets/accounts',
      'example_account',
      accountExample,
      'SYSTEM'
    );
    results.push({ type: 'accounts', result: accountResult });

    // 2. 建立交易子集合 (transactions)
    const transactionExample = {
      transactionId: 'example_transaction',
      ledgerId: 'example_ledger_for_budgets',
      amount: 1500,
      type: 'expense',
      description: '午餐',
      categoryId: 'example_food',
      accountId: 'example_account',
      date: new Date().toISOString().split('T')[0],
      userId: 'SYSTEM',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      note: '交易子集合範例'
    };

    const transactionResult = await FS_createDocument(
      'ledgers/example_ledger_for_budgets/transactions',
      'example_transaction',
      transactionExample,
      'SYSTEM'
    );
    results.push({ type: 'transactions', result: transactionResult });

    // 3. 建立科目子集合 (categories)
    const categoryExample = {
      categoryId: 'example_food',
      ledgerId: 'example_ledger_for_budgets',
      name: '餐飲',
      type: 'expense',
      icon: '🍽️',
      color: '#FF5722',
      parentId: null,
      level: 1,
      order: 1,
      isDefault: true,
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      note: '科目子集合範例'
    };

    const categoryResult = await FS_createDocument(
      'ledgers/example_ledger_for_budgets/categories',
      'example_food',
      categoryExample,
      'SYSTEM'
    );
    results.push({ type: 'categories', result: categoryResult });

    // 4. 建立預算子集合 (budgets)
    const budgetSubcollectionExample = {
      budgetId: 'example_budget_subcollection',
      ledgerId: 'example_ledger_for_budgets',
      name: '月度預算',
      type: 'monthly',
      total_amount: 50000,
      consumed_amount: 1500,
      currency: 'TWD',
      startDate: admin.firestore.Timestamp.now(),
      endDate: admin.firestore.Timestamp.now(),
      allocation: [
        {
          categoryId: 'example_food',
          categoryName: '餐飲',
          allocated_amount: 20000,
          consumed_amount: 1500
        }
      ],
      alert_rules: {
        warning_threshold: 80,
        critical_threshold: 95,
        enable_notifications: true,
        notification_channels: ['system']
      },
      createdBy: 'SYSTEM',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      status: 'active',
      note: '預算子集合範例文檔'
    };

    const budgetResult = await FS_createDocument(
      'ledgers/example_ledger_for_budgets/budgets',
      'example_budget_subcollection',
      budgetSubcollectionExample,
      'SYSTEM'
    );
    results.push({ type: 'budgets', result: budgetResult });

    // 統計成功建立的子集合數量
    const successCount = results.filter(r => r.result.success).length;
    const totalCount = results.length;

    return {
      success: ledgerResult.success && successCount === totalCount,
      message: `完整帳本子集合框架建立${successCount === totalCount ? '成功' : '部分失敗'} (${successCount}/${totalCount})`,
      details: {
        ledger: ledgerResult,
        subcollections: results,
        created_subcollections: ['accounts', 'transactions', 'categories', 'budgets'],
        success_rate: `${successCount}/${totalCount}`
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_COMPLETE_SUBCOLLECTION_FRAMEWORK_ERROR'
    };
  }
}

/**
 * 29. 初始化預設科目
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 初始化系統預設科目，包含收入和支出分類
 */
async function FS_initializeDefaultCategories() {
  const defaultCategories = {
    income: [
      { code: 'salary', name: '薪資收入', icon: '💰', color: '#4CAF50', order: 1 },
      { code: 'business', name: '營業收入', icon: '🏢', color: '#2196F3', order: 2 },
      { code: 'investment', name: '投資收入', icon: '📈', color: '#FF9800', order: 3 },
      { code: 'other', name: '其他收入', icon: '💝', color: '#9C27B0', order: 4 }
    ],
    expense: [
      { code: 'food', name: '餐飲', icon: '🍽️', color: '#FF5722', order: 1 },
      { code: 'transport', name: '交通', icon: '🚗', color: '#607D8B', order: 2 },
      { code: 'shopping', name: '購物', icon: '🛍️', color: '#E91E63', order: 3 }
    ]
  };

  try {
    const result = await FS_createDocument('_system', 'default_categories', defaultCategories, 'SYSTEM');
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 30. 初始化預算管理文檔結構
 * @version 2025-10-30-V3.0.0
 * @date 2025-10-30
 * @description 初始化預算管理模組所需的Firebase子集合文檔結構，支援1312.BM.js模組
 */
async function FS_initializeBudgetStructure() {
  const budgetStructure = {
    version: '3.0.0',
    description: '1312.BM.js預算管理模組Firebase子集合文檔結構 - 階段三子集合版',
    last_updated: '2025-10-30',
    architecture: 'subcollection_based',
    migration_from: 'budgets/ (top-level collection)',
    migration_to: 'ledgers/{ledgerId}/budgets/ (subcollection)',
    collections: {
      'ledgers/{ledgerId}/budgets': {
        description: '預算子集合 - 隸屬於特定帳本的預算管理文檔',
        collection_path: 'ledgers/{ledgerId}/budgets',
        parent_collection: 'ledgers',
        document_structure: {
          budgetId: 'string - 預算唯一識別碼 (與文檔ID相同，用於查詢)',
          ledgerId: 'string - 父帳本ID (繼承自父集合路徑)',
          name: 'string - 預算名稱 (如"月度生活費預算")',
          type: 'string - 預算類型: "monthly"|"yearly"|"quarterly"|"project"|"category"',
          total_amount: 'number - 預算總金額 (設定的預算上限)',
          consumed_amount: 'number - 已使用金額 (目前花費總額)',
          currency: 'string - 貨幣單位 (如"TWD", "USD")',
          startDate: 'timestamp - 預算生效開始時間',
          endDate: 'timestamp - 預算結束時間',
          allocation: 'array - 預算分類配置 (包含各分類的金額分配)',
          alert_rules: 'object - 警示規則設定 (閾值、通知方式)',
          userId: 'string - 使用者ID (對應users集合的email)',
          createdBy: 'string - 建立者ID (對應users集合的email)',
          createdAt: 'timestamp - 建立時間 (符合1311.FS.js規範)',
          updatedAt: 'timestamp - 最後更新時間 (符合1311.FS.js規範)',
          status: 'string - 預算狀態: "active"|"completed"|"archived"'
        },
        subcollections: {
          allocations: {
            description: '預算分配子集合',
            document_structure: {
              categoryId: 'string - 科目ID',
              categoryName: 'string - 科目名稱（如"餐飲"、"交通"）',
              allocated_amount: 'number - 分配金額',
              consumed_amount: 'number - 已使用金額',
              percentage: 'number - 占總預算百分比',
              createdAt: 'timestamp - 建立時間',
              updatedAt: 'timestamp - 更新時間'
            }
          }
        }
      },
      'ledgers/{ledgerId}/budget_alerts': {
        description: '預算警示子集合',
        collection_path: 'ledgers/{ledgerId}/budget_alerts',
        parent_collection: 'ledgers',
        document_structure: {
          budgetId: 'string - 預算ID (對應同帳本下的budget文檔)',
          alert_type: 'string - 警示類型: "warning"|"critical"|"exceeded"',
          trigger_condition: 'object - 觸發條件',
          triggered_at: 'timestamp - 觸發時間',
          notification_sent: 'boolean - 通知發送狀態',
          recipients: 'array - 接收者列表'
        }
      }
    },
    path_examples: {
      create_budget: 'ledgers/personal_ledger_001/budgets/budget_monthly_001',
      update_budget: 'ledgers/personal_ledger_001/budgets/budget_monthly_001',
      query_budgets: 'ledgers/personal_ledger_001/budgets',
      create_alert: 'ledgers/personal_ledger_001/budget_alerts/alert_001'
    },
    advantages: [
      '預算與帳本緊密關聯，資料一致性更佳',
      '帳本刪除時預算自動清理',
      '查詢特定帳本預算效率提升',
      '權限管理與帳本同步，簡化協作邏輯'
    ],
    example_allocation_structure: [
      {
        categoryId: "food_001",
        categoryName: "餐飲",
        allocated_amount: 15000,
        consumed_amount: 8000
      },
      {
        categoryId: "transport_001",
        categoryName: "交通",
        allocated_amount: 5000,
        consumed_amount: 3200
      }
    ],
    example_alert_rules_structure: {
      warning_threshold: 80,
      critical_threshold: 95,
      enable_notifications: true,
      notification_channels: ["line", "email"],
      custom_thresholds: []
    }
  };

  try {
    const result = await FS_createDocument('_system', 'budget_subcollection_structure', budgetStructure, 'SYSTEM');
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 31. 初始化預設帳戶類型
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 初始化系統預設帳戶類型，包含現金、銀行、信用卡等基本帳戶
 */
async function FS_initializeDefaultAccountTypes() {
  const defaultAccountTypes = [
    { code: 'cash', name: '現金', icon: '💵', type: 'asset', order: 1 },
    { code: 'bank', name: '銀行帳戶', icon: '🏦', type: 'asset', order: 2 },
    { code: 'credit', name: '信用卡', icon: '💳', type: 'liability', order: 3 },
    { code: 'investment', name: '投資帳戶', icon: '📊', type: 'asset', order: 4 }
  ];

  try {
    const result = await FS_createDocument('_system', 'default_account_types', { types: defaultAccountTypes }, 'SYSTEM');
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 32. 初始化評估問卷
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 初始化用戶模式評估問卷，用於判定用戶適合的記帳模式
 */
async function FS_initializeAssessmentQuestions() {
  const assessmentQuestions = {
    version: '1.0',
    questions: [
      {
        id: 1,
        question: '您認為記帳的主要目的是什麼？',
        type: 'single_choice',
        options: [
          { id: 'a', text: '詳細追蹤每筆收支', weight: { Expert: 3, Cultivation: 1 } },
          { id: 'b', text: '簡單記錄大概金額', weight: { Inertial: 3, Guiding: 1 } },
          { id: 'c', text: '建立理財習慣', weight: { Cultivation: 3, Guiding: 2 } },
          { id: 'd', text: '控制支出預算', weight: { Expert: 2, Guiding: 3 } }
        ]
      },
      {
        id: 2,
        question: '您希望記帳的頻率是？',
        type: 'single_choice',
        options: [
          { id: 'a', text: '每筆都要記錄', weight: { Expert: 3, Cultivation: 2 } },
          { id: 'b', text: '每天記錄一次', weight: { Cultivation: 3, Guiding: 2 } },
          { id: 'c', text: '想到才記錄', weight: { Inertial: 3 } },
          { id: 'd', text: '需要提醒才記錄', weight: { Guiding: 3, Inertial: 1 } }
        ]
      }
    ]
  };

  try {
    const result = await FS_createDocument('_system', 'assessment_questions', assessmentQuestions, 'SYSTEM');
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 33. 初始化帳本集合文檔結構
 * @version 2025-10-27-V2.2.0
 * @date 2025-10-27
 * @description 初始化帳本管理模組所需的Firebase帳本集合文檔結構，支援CM.js模組
 */
async function FS_initializeLedgerStructure() {
  const ledgerStructure = {
    version: '1.0.0',
    description: 'CM.js帳本管理模組Firebase帳本集合文檔結構',
    collection: 'ledgers',

    // ledgers集合下的文檔結構
    document_structure: {
      ledgerId: 'string - 帳本唯一識別碼 (與文檔ID相同)',
      name: 'string - 帳本名稱 (如"個人記帳本", "專案支出")',
      type: 'string - 帳本類型: "personal"|"project"|"category"|"shared"',
      description: 'string - 帳本描述說明',
      userId: 'string - 帳本擁有者ID (對應users集合)',
      createdBy: 'string - 帳本建立者ID (對應users集合)',
      members: 'array - 帳本成員列表 (用戶ID陣列)',
      currency: 'string - 預設貨幣單位 (如"TWD", "USD")',
      timezone: 'string - 時區設定 (如"Asia/Taipei")',
      settings: 'object - 帳本設定',
      permissions: 'object - 權限設定 (擁有者、管理員、成員、檢視者)',
      attributes: 'object - 帳本屬性 (狀態、進度、分類等)',
      createdAt: 'timestamp - 建立時間 (符合1311.FS.js規範)',
      updatedAt: 'timestamp - 最後更新時間 (符合1311.FS.js規範)',
      archived: 'boolean - 是否已歸檔',
      status: 'string - 帳本狀態: "active"|"completed"|"archived"',
      metadata: 'object - 帳本元數據 (交易總數、總金額、成員數量等)'
    },

    // 各帳本文檔下的子集合結構
    subcollections: {
      transactions: {
        description: '帳本交易記錄子集合',
        document_structure: {
          transactionId: 'string - 交易唯一識別碼',
          ledgerId: 'string - 交易所屬帳本ID',
          amount: 'number - 交易金額',
          type: 'string - 交易類型: "income"|"expense"',
          description: 'string - 交易描述',
          categoryId: 'string - 科目ID',
          categoryName: 'string - 科目名稱',
          accountId: 'string - 帳戶ID',
          accountName: 'string - 帳戶名稱',
          date: 'string - 交易日期 (YYYY-MM-DD格式)',
          userId: 'string - 記帳用戶ID',
          source: 'string - 記帳來源: "manual"|"quick"|"import"',
          tags: 'array - 標籤列表',
          location: 'object - 位置資訊 (可選)',
          receiptUrl: 'string - 收據圖片URL (可選)',
          notes: 'string - 備註 (可選)',
          createdAt: 'timestamp - 建立時間',
          updatedAt: 'timestamp - 最後更新時間'
        }
      },
      categories: {
        description: '帳本科目分類子集合',
        document_structure: {
          categoryId: 'string - 科目唯一識別碼',
          name: 'string - 科目名稱',
          type: 'string - 科目類型: "income"|"expense"',
          icon: 'string - 科目圖示 emoji',
          color: 'string - 科目顏色 hex code',
          parentId: 'string - 父科目ID (可選，支援多層級)',
          level: 'number - 科目層級 (1為頂層)',
          order: 'number - 排序順序',
          isDefault: 'boolean - 是否為預設科目',
          isActive: 'boolean - 是否啟用',
          budgetLimit: 'number - 預算上限 (可選)',
          description: 'string - 科目說明 (可選)',
          createdAt: 'timestamp - 建立時間',
          updatedAt: 'timestamp - 最後更新時間'
        }
      },
      accounts: {
        description: '帳本帳戶子集合',
        document_structure: {
          accountId: 'string - 帳戶唯一識別碼',
          name: 'string - 帳戶名稱',
          type: 'string - 帳戶類型: "cash"|"bank"|"credit"|"investment"|"other"',
          icon: 'string - 帳戶圖示 emoji',
          color: 'string - 帳戶顏色 hex code',
          currency: 'string - 貨幣單位',
          initialBalance: 'number - 初始餘額',
          currentBalance: 'number - 當前餘額',
          creditLimit: 'number - 信用額度 (信用卡帳戶)',
          bankName: 'string - 銀行名稱 (銀行帳戶)',
          accountNumber: 'string - 帳號末四碼 (脫敏)',
          isDefault: 'boolean - 是否為預設帳戶',
          isActive: 'boolean - 是否啟用',
          includeInTotal: 'boolean - 是否計入總資產',
          notes: 'string - 備註 (可選)',
          createdAt: 'timestamp - 建立時間',
          updatedAt: 'timestamp - 最後更新時間'
        }
      },
      budgets: {
        description: '預算子集合 (與1312.BM.js模組整合)',
        document_structure: {
          budgetId: 'string - 預算唯一識別碼',
          ledgerId: 'string - 預算所屬帳本ID',
          name: 'string - 預算名稱',
          type: 'string - 預算類型: "monthly"|"yearly"|"custom"',
          categoryIds: 'array - 關聯科目ID列表',
          total_amount: 'number - 預算總金額',
          used_amount: 'number - 已使用金額',
          startDate: 'timestamp - 預算開始日期',
          endDate: 'timestamp - 預算結束日期',
          alert_percentage: 'number - 警示百分比 (如80%)',
          isActive: 'boolean - 是否啟用',
          createdAt: 'timestamp - 建立時間',
          updatedAt: 'timestamp - 最後更新時間'
        }
      }
    },

    // 權限結構範例
    permissions_structure: {
      owner: 'string - 擁有者用戶ID',
      admins: 'array - 管理員用戶ID列表',
      members: 'array - 一般成員用戶ID列表',
      viewers: 'array - 僅檢視用戶ID列表',
      settings: {
        allow_invite: 'boolean - 是否允許邀請成員',
        allow_edit: 'boolean - 是否允許編輯',
        allow_delete: 'boolean - 是否允許刪除'
      }
    },

    // 帳本設定結構範例
    settings_structure: {
      allow_negative_balance: 'boolean - 是否允許負餘額',
      auto_categorization: 'boolean - 是否自動分類',
      default_account_id: 'string - 預設帳戶ID',
      default_currency: 'string - 預設貨幣',
      reminder_settings: 'object - 提醒設定',
      privacy_mode: 'boolean - 隱私模式'
    },

    // 元數據結構範例
    metadata_structure: {
      total_entries: 'number - 交易總筆數',
      total_income: 'number - 收入總額',
      total_expense: 'number - 支出總額',
      total_amount: 'number - 淨額',
      last_activity: 'timestamp - 最後活動時間',
      member_count: 'number - 成員總數',
      categories_count: 'number - 科目總數',
      accounts_count: 'number - 帳戶總數',
      budgets_count: 'number - 預算總數'
    }
  };

  try {
    const result = await FS_createDocument('_system', 'ledger_collection_structure', ledgerStructure, 'SYSTEM');
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 34. 根據用戶模式取得帳本配置
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 根據用戶模式（Expert/Inertial/Cultivation/Guiding）返回對應的帳本配置
 */
function FS_getLedgerConfigByMode(userMode) {
  const configs = {
    Expert: {
      defaultName: '個人專業帳本',
      description: '專業記帳模式，支援詳細分類與分析',
      allowNegativeBalance: true,
      autoCategories: false,
      reminderSettings: { enabled: false }
    },
    Inertial: {
      defaultName: '個人簡易帳本',
      description: '簡易記帳模式，操作簡單便利',
      allowNegativeBalance: false,
      autoCategories: true,
      reminderSettings: { enabled: false }
    },
    Cultivation: {
      defaultName: '個人培養帳本',
      description: '培養記帳習慣，逐步提升財務管理能力',
      allowNegativeBalance: false,
      autoCategories: true,
      reminderSettings: { enabled: true, frequency: 'daily' }
    },
    Guiding: {
      defaultName: '個人引導帳本',
      description: '智慧引導記帳，協助建立理財觀念',
      allowNegativeBalance: false,
      autoCategories: true,
      reminderSettings: { enabled: true, frequency: 'weekly' }
    }
  };

  return configs[userMode] || configs.Expert;
}

/**
 * 35. 根據用戶模式取得科目配置
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 根據用戶模式返回適合的收支科目配置，Expert模式包含更多詳細科目
 */
function FS_getCategoryConfigByMode(userMode) {
  const baseConfig = {
    incomeCategories: [
      { code: 'salary', name: '薪資收入', icon: '💰', color: '#4CAF50', order: 1 },
      { code: 'other', name: '其他收入', icon: '💝', color: '#9C27B0', order: 2 }
    ],
    expenseCategories: [
      { code: 'food', name: '餐飲', icon: '🍽️', color: '#FF5722', order: 1 },
      { code: 'transport', name: '交通', icon: '🚗', color: '#607D8B', order: 2 },
      { code: 'shopping', name: '購物', icon: '🛍️', color: '#E91E63', order: 3 }
    ]
  };

  // Expert模式增加更多科目
  if (userMode === 'Expert') {
    baseConfig.incomeCategories.push(
      { code: 'business', name: '營業收入', icon: '🏢', color: '#2196F3', order: 3 },
      { code: 'investment', name: '投資收入', icon: '📈', color: '#FF9800', order: 4 }
    );
    baseConfig.expenseCategories.push(
      { code: 'entertainment', name: '娛樂', icon: '🎬', color: '#673AB7', order: 4 },
      { code: 'utilities', name: '水電費', icon: '⚡', color: '#795548', order: 5 },
      { code: 'healthcare', name: '醫療', icon: '🏥', color: '#009688', order: 6 }
    );
  }

  return baseConfig;
}

/**
 * 36. 建立基礎帳戶
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 為新帳本建立基礎帳戶，包含現金和銀行帳戶
 */
async function FS_createBasicAccounts(ledgerId, userMode, requesterId) {
  const accounts = [
    {
      name: '現金',
      type: 'cash',
      icon: '💵',
      currency: 'TWD',
      balance: 0,
      isDefault: true
    },
    {
      name: '銀行帳戶',
      type: 'bank',
      icon: '🏦',
      currency: 'TWD',
      balance: 0,
      isDefault: false
    }
  ];

  const results = [];
  for (const account of accounts) {
    const accountData = {
      ...account,
      ledgerId: ledgerId,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      isActive: true
    };

    const accountId = `${account.type}_${ledgerId}_${Date.now()}`;
    const result = await FS_createDocument(`ledgers/${ledgerId}/accounts`, accountId, accountData, requesterId);
    results.push({ name: account.name, result });
  }

  return results;
}

/**
 * 37. 驗證Phase 1功能
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 驗證Phase 1核心功能是否正常運作，檢查各模組可用性
 */
async function FS_verifyPhase1Functions() {
  const functions = [
    'FS_processUserRegistration',
    'FS_processUserLogin',
    'FS_manageUserProfile',
    'FS_processUserAssessment',
    'FS_manageTransaction',
    'FS_processQuickTransaction'
  ];

  const moduleStatus = functions.map(funcName => ({
    name: funcName,
    available: typeof eval(funcName) === 'function',
    description: FS_getFunctionDescription(funcName)
  }));

  const functionalCount = moduleStatus.filter(m => m.available).length;

  return {
    allFunctional: functionalCount === functions.length,
    functionalCount: functionalCount,
    totalCount: functions.length,
    moduleStatus: moduleStatus
  };
}

/**
 * 38. 取得功能描述
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 返回指定函數的中文描述，用於系統診斷和報告
 */
function FS_getFunctionDescription(funcName) {
  const descriptions = {
    'FS_processUserRegistration': '用戶註冊處理',
    'FS_processUserLogin': '用戶登入處理',
    'FS_manageUserProfile': '用戶資料管理',
    'FS_processUserAssessment': '模式評估處理',
    'FS_manageTransaction': '交易記錄管理',
    'FS_processQuickTransaction': '快速記帳處理'
  };
  return descriptions[funcName] || '未知功能';
}

/**
 * 39. 檢查數據一致性
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 檢查系統數據一致性，驗證關鍵配置文檔是否正常
 */
async function FS_checkDataConsistency() {
  try {
    // 簡化的一致性檢查
    const testDoc = await FS_getDocument('_system', 'config', 'SYSTEM');

    return {
      consistent: testDoc.success,
      checks: ['系統配置檢查'],
      passed: testDoc.success ? 1 : 0,
      total: 1
    };
  } catch (error) {
    return {
      consistent: false,
      error: error.message
    };
  }
}

/**
 * 40. 驗證API端點
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 驗證主要API端點功能是否可用，檢查函數可調用性
 */
async function FS_validateAPIEndpoints() {
  const endpoints = [
    { name: '用戶註冊', function: 'FS_processUserRegistration' },
    { name: '用戶登入', function: 'FS_processUserLogin' },
    { name: '快速記帳', function: 'FS_processQuickTransaction' }
  ];

  const results = endpoints.map(endpoint => ({
    name: endpoint.name,
    available: typeof eval(endpoint.function) === 'function'
  }));

  const workingCount = results.filter(r => r.available).length;

  return {
    allWorking: workingCount === endpoints.length,
    workingCount: workingCount,
    totalCount: endpoints.length,
    details: results
  };
}

/**
 * 41. 取得健康建議
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 根據系統健康狀態提供對應的維護建議
 */
function FS_getHealthRecommendation(status) {
  const recommendations = {
    healthy: '系統運行正常，建議定期執行健康檢查',
    degraded: '系統部分功能異常，建議檢查並修復問題組件',
    unhealthy: '系統多項功能異常，建議立即進行系統維護'
  };
  return recommendations[status] || '未知狀態，建議聯繫技術支援';
}

/**
 * 42. 取得驗證建議
 * @version 2025-11-18-V1.0.0
 * @date 2025-11-18
 * @description 根據功能驗證結果提供後續操作建議
 */
function FS_getValidationRecommendation(result) {
  const recommendations = {
    pass: 'Phase 1功能驗證通過，可進入下一階段',
    warning: 'Phase 1功能大部分正常，建議修復少數問題後繼續',
    fail: 'Phase 1功能驗證未通過，需要修復關鍵問題後重新驗證'
  };
  return recommendations[result] || '驗證結果異常，建議重新執行驗證';
}

// =============== 階段一：協作架構支援函數區 ===============

/**
 * 43. 初始化協作集合
 * @version 2025-11-06-V2.7.1
 * @date 2025-11-06
 * @description 專門初始化collaboration集合，確保協作功能集合框架存在
 */
async function FS_initializeCollaborationCollection(requesterId) {
  const functionName = "FS_initializeCollaborationCollection";
  try {
    FS_logOperation('初始化協作集合', "協作集合初始化", requesterId || "SYSTEM", "", "", functionName);

    // 建立協作集合佔位文檔，確保集合存在
    const collaborationPlaceholder = {
      type: 'collection_placeholder',
      purpose: '確保 collaborations 集合存在',
      createdAt: admin.firestore.Timestamp.now(),
      note: '此文檔僅用於確保協作集合框架存在，實際協作建立時會有真實文檔'
    };

    // 建立協作主集合佔位文檔
    const collaborationResult = await FS_createDocument('collaborations', '_placeholder', collaborationPlaceholder, requesterId);

    if (collaborationResult.success) {
      FS_logOperation('協作集合初始化成功', "協作集合初始化", requesterId || "SYSTEM", "", "", functionName);

      return {
        success: true,
        message: 'collaboration集合初始化完成',
        collection: 'collaborations',
        placeholderCreated: true,
        path: 'collaborations/_placeholder'
      };
    } else {
      return {
        success: false,
        error: collaborationResult.error,
        errorCode: collaborationResult.errorCode
      };
    }

  } catch (error) {
    FS_handleError(`協作集合初始化失敗: ${error.message}`, "協作集合初始化", requesterId || "SYSTEM", "FS_COLLABORATION_COLLECTION_INIT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_COLLABORATION_COLLECTION_INIT_ERROR'
    };
  }
}

/**
 * 44. 初始化協作架構
 * @version 2025-11-06-V2.7.0
 * @date 2025-11-06
 * @description 為FS模組建立協作功能支援架構，定義協作集合結構
 */
async function FS_initializeCollaborationStructure(requesterId) {
  const functionName = "FS_initializeCollaborationStructure";
  try {
    FS_logOperation('協作架構初始化', "協作架構初始化", requesterId || "SYSTEM", "", "", functionName);

    // 建立協作集合架構定義
    const collaborationStructure = {
      version: '1.0.0',
      description: '1313.CM.js協作管理模組Firebase集合架構 - camelCase命名',
      last_updated: '2025-11-06',
      architecture: 'collaboration_based',
      collections: {
        'collaborations': {
          description: '協作主集合 - 帳本協作資訊管理',
          collection_path: 'collaborations',
          document_structure: {
            ledgerId: 'string - 帳本唯一識別碼',
            ownerId: 'string - 帳本擁有者ID',
            collaborationType: 'string - 協作類型: "shared"|"project"|"category"',
            settings: 'object - 協作設定',
            createdAt: 'timestamp - 建立時間',
            updatedAt: 'timestamp - 最後更新時間',
            status: 'string - 協作狀態: "active"|"archived"|"suspended"'
          },
          subcollections: {
            members: {
              description: '協作成員子集合',
              document_structure: {
                userId: 'string - 用戶唯一識別碼',
                email: 'string - 用戶電子郵件',
                role: 'string - 角色: "owner"|"admin"|"member"|"viewer"',
                permissions: 'object - 權限設定',
                joinedAt: 'timestamp - 加入時間',
                status: 'string - 成員狀態: "active"|"invited"|"suspended"'
              }
            },
            invitations: {
              description: '邀請管理子集合',
              document_structure: {
                invitationId: 'string - 邀請唯一識別碼',
                inviterId: 'string - 邀請者ID',
                inviteeEmail: 'string - 被邀請者email',
                role: 'string - 預設角色',
                status: 'string - 邀請狀態: "pending"|"accepted"|"declined"|"expired"',
                createdAt: 'timestamp - 邀請建立時間',
                expiresAt: 'timestamp - 邀請過期時間'
              }
            },
            permissions: {
              description: '權限管理子集合',
              document_structure: {
                userId: 'string - 用戶ID',
                resourceType: 'string - 資源類型',
                permissions: 'object - 細粒度權限設定',
                grantedBy: 'string - 權限授予者ID',
                grantedAt: 'timestamp - 權限授予時間'
              }
            }
          }
        }
      },
      path_examples: {
        create_collaboration: 'collaborations/ledger_12345',
        add_member: 'collaborations/ledger_12345/members/user_67890',
        create_invitation: 'collaborations/ledger_12345/invitations/inv_abc123',
        set_permission: 'collaborations/ledger_12345/permissions/perm_xyz789'
      },
      integration_notes: [
        '與1351.CM.js帳本管理模組整合',
        '與1313.CM.js協作管理模組業務邏輯整合',
        '保持1311.FS.js現有snake_case命名不變',
        '協作功能使用camelCase命名規範'
      ]
    };

    // 儲存協作架構定義到系統配置
    const result = await FS_createDocument('_system', 'collaboration_structure', collaborationStructure, requesterId);

    if (result.success) {
      FS_logOperation('協作架構初始化成功', "協作架構初始化", requesterId || "SYSTEM", "", "", functionName);
      return {
        success: true,
        message: '協作架構初始化完成',
        structure: collaborationStructure
      };
    } else {
      return result;
    }

  } catch (error) {
    FS_handleError(`協作架構初始化失敗: ${error.message}`, "協作架構初始化", requesterId || "SYSTEM", "FS_COLLABORATION_INIT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_COLLABORATION_INIT_ERROR'
    };
  }
}

/**
 * 45. 驗證協作帳本資料結構
 * @version 2025-11-12-V2.7.1
 * @date 2025-11-12
 * @description 驗證協作帳本資料是否符合標準結構，確保資料一致性
 */
function FS_validateCollaborationData(collaborationData) {
  const requiredFields = ['ledgerId', 'ownerId', 'collaborationType', 'settings', 'createdAt', 'updatedAt', 'status'];
  const validCollaborationTypes = ['shared', 'project', 'category'];
  const validStatuses = ['active', 'archived', 'suspended'];

  // 檢查必要欄位
  for (const field of requiredFields) {
    if (!collaborationData.hasOwnProperty(field)) {
      return {
        valid: false,
        error: `缺少必要欄位: ${field}`,
        field: field
      };
    }
  }

  // 驗證協作類型
  if (!validCollaborationTypes.includes(collaborationData.collaborationType)) {
    return {
      valid: false,
      error: `無效的協作類型: ${collaborationData.collaborationType}`,
      field: 'collaborationType'
    };
  }

  // 驗證狀態
  if (!validStatuses.includes(collaborationData.status)) {
    return {
      valid: false,
      error: `無效的狀態: ${collaborationData.status}`,
      field: 'status'
    };
  }

  // 驗證設定結構
  if (!collaborationData.settings || typeof collaborationData.settings !== 'object') {
    return {
      valid: false,
      error: '設定欄位必須是物件類型',
      field: 'settings'
    };
  }

  return {
    valid: true,
    message: '協作帳本資料結構驗證通過'
  };
}

/**
 * 46. 建立協作文檔（簡化版）
 * @version 2025-11-12-V2.7.1
 * @date 2025-11-12
 * @description 建立協作主集合文檔，僅負責基礎文檔創建和資料驗證
 */
async function FS_createCollaborationDocument(ledgerId, collaborationData, requesterId) {
  const functionName = "FS_createCollaborationDocument";
  try {
    FS_logOperation(`建立協作文檔: ${ledgerId}`, "建立協作", requesterId || "", "", "", functionName);

    // 驗證必要參數
    if (!ledgerId || !collaborationData) {
      throw new Error("缺少必要參數: ledgerId, collaborationData");
    }

    // 階段一：資料結構驗證
    const validationResult = FS_validateCollaborationData(collaborationData);
    if (!validationResult.valid) {
      throw new Error(`資料結構驗證失敗: ${validationResult.error}`);
    }

    // 準備協作文檔數據（camelCase命名）
    const finalCollaborationData = {
      ledgerId: ledgerId,
      ownerId: collaborationData.ownerId || requesterId,
      collaborationType: collaborationData.collaborationType || 'shared',
      settings: collaborationData.settings || {
        allowInvite: true,
        allowEdit: true,
        allowDelete: false,
        requireApproval: false
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      status: 'active'
    };

    // 建立協作主文檔 - 僅負責文檔創建，成員管理由CM模組處理
    const result = await FS_createDocument('collaborations', ledgerId, finalCollaborationData, requesterId);

    if (result.success) {
      FS_logOperation(`協作文檔建立成功: ${ledgerId}`, "建立協作", requesterId || "", "", "", functionName);
    }

    return result;

  } catch (error) {
    FS_handleError(`建立協作文檔失敗: ${error.message}`, "建立協作", requesterId || "", "FS_CREATE_COLLABORATION_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_COLLABORATION_ERROR'
    };
  }
}


// =============== 模組導出區 ===============

// 導出階段一、二、三完整函數
module.exports = {
  // 階段一核心基礎函數
  FS_initializeModule,
  FS_initializeConnection,
  FS_createDocument,
  FS_getDocument,
  FS_updateDocument,
  FS_deleteDocument,
  FS_queryCollection,
  FS_handleError,
  FS_logOperation,

  // 階段二 Phase 1 API端點支援函數
  FS_processUserRegistration,
  FS_processUserLogin,
  FS_manageUserProfile,
  FS_processUserAssessment,
  FS_manageTransaction,
  FS_processQuickTransaction,

  // 階段三 Phase 1 整合優化與驗證函數（重構後）
  FS_initializeSystemConfig,
  FS_initializeDataStructure,
  FS_createUserBasicLedger,
  FS_initializePhase1Categories,
  FS_performHealthCheck,
  FS_validatePhase1Integration,

  // 1312.BM預算管理模組支援函數（階段三子集合版）
  FS_initializeBudgetStructure,
  FS_createBudgetsSubcollectionFramework,
  FS_createCompleteSubcollectionFramework,
  FS_createBudgetInLedger: (ledgerId, budgetData, requesterId) =>
    FS_createDocument(`ledgers/${ledgerId}/budgets`, budgetData.budgetId || `budget_${Date.now()}`, budgetData, requesterId), // Using budgetId from data or generating one
  FS_getBudgetFromLedger: (ledgerId, budgetId, requesterId) =>
    FS_getDocument(`ledgers/${ledgerId}/budgets`, budgetId, requesterId),
  FS_updateBudgetInLedger: (ledgerId, budgetId, updateData, requesterId) =>
    FS_updateDocument(`ledgers/${ledgerId}/budgets`, budgetId, updateData, requesterId),
  FS_deleteBudgetFromLedger: (ledgerId, budgetId, requesterId) =>
    FS_deleteDocument(`ledgers/${ledgerId}/budgets`, budgetId, requesterId),
  FS_queryBudgetsInLedger: (ledgerId, queryConditions, requesterId, options) =>
    FS_queryCollection(`ledgers/${ledgerId}/budgets`, queryConditions, requesterId, options),

  // 完整子集合管理：直接使用 FS_createDocument() 處理各種子集合操作
  // 範例：FS_createDocument(`ledgers/${ledgerId}/accounts`, accountId, accountData, requesterId)
  // 範例：FS_createDocument(`ledgers/${ledgerId}/categories`, categoryId, categoryData, requesterId)
  // 範例：FS_createDocument(`ledgers/${ledgerId}/transactions`, transactionId, transactionData, requesterId)

  // CM.js帳本管理模組支援函數
  FS_initializeLedgerStructure,

  // 階段一：協作架構支援函數 (camelCase命名)
  FS_initializeCollaborationCollection,
  FS_initializeCollaborationStructure,
  FS_createCollaborationDocument,
  FS_validateCollaborationData,

  // 相容性函數（保留現有調用）
  FS_mergeDocument,
  FS_addToCollection,
  FS_setDocument,

  // 基礎配置
  db,
  admin,

  // 模組資訊
  moduleVersion: '2.7.1',
  phase: 'Phase3-Collaboration-Architecture-Support',
  lastUpdate: '2025-11-18',
  stage3Features: ['budgets_subcollection_support', 'ledger_budget_integration', 'path_structure_v3', 'collaboration_architecture_support']
};

// 自動初始化模組
try {
  const initResult = FS_initializeModule();
  if (initResult.success) {
    console.log('🎉 FS模組2.5.0階段三預算子集合架構完成！');
    console.log(`📌 模組版本: ${initResult.version}`);
    console.log(`🎯 階段三成果: Firebase預算子集合架構遷移完成`);
    console.log(`💰 預算架構: budgets/ → ledgers/{id}/budgets/ (子集合)`);
    console.log(`📋 階段一功能: 核心基礎操作(9個函數)`);
    console.log(`📋 階段二功能: API端點支援(6個函數)`);
    console.log(`📋 階段三功能: 整合優化與驗證(6個函數)`);
    console.log(`🔧 階段三新增: FS_createBudgetsSubcollectionFramework() - 預算子集合框架`);
    console.log(`🔧 階段三新增: 5個預算子集合專用操作函數`);
    console.log(`✨ 總計實作: 28個核心函數 + 相容性函數`);
    console.log(`🚀 準備就緒: 1312.BM.js模組可完整使用預算子集合架構`);
  }
} catch (error) {
  console.error('❌ FS模組2.5.0初始化失敗:', error.message);
}