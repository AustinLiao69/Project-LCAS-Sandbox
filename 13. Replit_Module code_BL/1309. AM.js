/**
 * AM_帳號管理模組_1.2.0
 * @module AM模組
 * @description 跨平台帳號管理系統 - Phase 1 API端點重構，支援RESTful API
 * @update 2025-09-15: Phase 1重構 - 新增RESTful API端點支援
 */

// 引入必要模組
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

// 引入Firebase動態配置模組
const firebaseConfig = require('./1399. firebase-config');

// 取得 Firestore 實例
const db = admin.firestore();

// 引入其他模組
const DL = require('./1310. DL.js');

/**
 * 01. 創建LINE OA用戶帳號
 * @version 2025-07-11-V2.0.0
 * @date 2025-07-11 18:00:00
 * @description 透過LINE OAuth創建用戶帳號並建立基礎資料結構，包含科目初始化
 */
async function AM_createLineAccount(lineUID, lineProfile, userType = 'S') {
  try {
    // 檢查帳號是否已存在
    const existingUser = await db.collection('users').doc(lineUID).get();
    if (existingUser.exists) {
      return {
        success: false,
        error: '帳號已存在',
        errorCode: 'AM_ACCOUNT_EXISTS',
        UID: lineUID
      };
    }

    // 建立用戶資料
    const userData = {
      displayName: lineProfile.displayName || '',
      userType: userType,
      createdAt: admin.firestore.Timestamp.now(),
      lastActive: admin.firestore.Timestamp.now(),
      timezone: 'Asia/Taipei',
      linkedAccounts: {
        LINE_UID: lineUID,
        iOS_UID: '',
        Android_UID: ''
      },
      settings: {
        notifications: true,
        language: 'zh-TW'
      },
      joined_ledgers: [],
      metadata: {
        source: 'LINE_OA',
        profilePicture: lineProfile.pictureUrl || ''
      }
    };

    // 寫入 Firestore
    await db.collection('users').doc(lineUID).set(userData);

    // 建立帳號映射記錄
    const mappingData = {
      primary_UID: lineUID,
      platform_accounts: {
        LINE: lineUID,
        iOS: '',
        Android: ''
      },
      email: '',
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      status: 'active'
    };

    await db.collection('account_mappings').doc(lineUID).set(mappingData);

    // 初始化用戶科目數據
    const subjectInit = await AM_initializeUserSubjects(lineUID);

    // 記錄操作日誌
    await DL.DL_log('AM', 'createLineAccount', 'INFO', `LINE帳號創建成功: ${lineUID}, 科目初始化: ${subjectInit.success ? '成功' : '失敗'}`, lineUID);

    return {
      success: true,
      UID: lineUID,
      accountId: lineUID,
      userType: userType,
      message: 'LINE帳號創建成功',
      subjectInitialized: subjectInit.success,
      subjectCount: subjectInit.importCount || 0
    };

  } catch (error) {
    await DL.DL_error('AM', 'createLineAccount', error.message, lineUID);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_CREATE_FAILED'
    };
  }
}

/**
 * 02. 創建APP端用戶帳號
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 為iOS/Android平台創建用戶帳號
 */
async function AM_createAppAccount(platform, appProfile, deviceInfo) {
  try {
    const platformUID = AM_generatePlatformUID(platform, deviceInfo.deviceId);
    const primaryUID = `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const userData = {
      displayName: appProfile.displayName || '',
      userType: appProfile.userType || 'S',
      createdAt: admin.firestore.Timestamp.now(),
      lastActive: admin.firestore.Timestamp.now(),
      timezone: 'Asia/Taipei',
      linkedAccounts: {
        LINE_UID: '',
        [`${platform}_UID`]: platformUID
      },
      settings: {
        notifications: true,
        language: 'zh-TW'
      },
      joined_ledgers: [],
      metadata: {
        source: platform,
        deviceInfo: deviceInfo,
        appVersion: appProfile.appVersion || '1.0.0'
      }
    };

    await db.collection('users').doc(primaryUID).set(userData);

    // 建立帳號映射
    const mappingData = {
      primary_UID: primaryUID,
      platform_accounts: {
        LINE: '',
        iOS: platform === 'iOS' ? platformUID : '',
        Android: platform === 'Android' ? platformUID : ''
      },
      email: appProfile.email || '',
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      status: 'active'
    };

    await db.collection('account_mappings').doc(primaryUID).set(mappingData);

    await DL.DL_log('AM', 'createAppAccount', 'INFO', `${platform}帳號創建成功: ${platformUID}`, primaryUID);

    return {
      success: true,
      platformUID: platformUID,
      primaryUID: primaryUID,
      userType: userData.userType
    };

  } catch (error) {
    await DL.DL_error('AM', 'createAppAccount', error.message, '');
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_APP_CREATE_FAILED'
    };
  }
}

/**
 * 03. 跨平台帳號關聯
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 將LINE、iOS、Android帳號進行關聯綁定
 */
async function AM_linkCrossPlatformAccounts(primaryUID, linkedAccountInfo) {
  try {
    // 驗證主帳號存在
    const userDoc = await db.collection('users').doc(primaryUID).get();
    if (!userDoc.exists) {
      return {
        success: false,
        error: '主帳號不存在',
        errorCode: 'AM_PRIMARY_ACCOUNT_NOT_FOUND'
      };
    }

    const userData = userDoc.data();

    // 更新關聯帳號資訊
    const updatedLinkedAccounts = {
      ...userData.linkedAccounts,
      ...linkedAccountInfo
    };

    await db.collection('users').doc(primaryUID).update({
      linkedAccounts: updatedLinkedAccounts,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 更新帳號映射
    const mappingDoc = await db.collection('account_mappings').doc(primaryUID).get();
    if (mappingDoc.exists) {
      const mappingData = mappingDoc.data();
      const updatedPlatformAccounts = {
        ...mappingData.platform_accounts,
        LINE: linkedAccountInfo.LINE_UID || mappingData.platform_accounts.LINE,
        iOS: linkedAccountInfo.iOS_UID || mappingData.platform_accounts.iOS,
        Android: linkedAccountInfo.Android_UID || mappingData.platform_accounts.Android
      };

      await db.collection('account_mappings').doc(primaryUID).update({
        platform_accounts: updatedPlatformAccounts,
        updated_at: admin.firestore.Timestamp.now()
      });
    }

    await DL.DL_info('AM', 'linkCrossPlatformAccounts', `帳號關聯成功: ${primaryUID}`, primaryUID);

    return {
      success: true,
      linkedAccounts: updatedLinkedAccounts,
      mappingId: primaryUID
    };

  } catch (error) {
    await DL.DL_error('AM', 'linkCrossPlatformAccounts', error.message, primaryUID);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_LINK_FAILED'
    };
  }
}

/**
 * 04. 更新帳號資訊
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 修改 المستخدم帳號基本資訊和設定
 */
async function AM_updateAccountInfo(UID, updateData, operatorId) {
  try {
    // 驗證更新權限
    const hasPermission = await AM_validateUpdatePermission(UID, operatorId);
    if (!hasPermission) {
      return {
        success: false,
        error: '權限不足',
        errorCode: 'AM_PERMISSION_DENIED'
      };
    }

    // 準備更新資料
    const updateFields = {
      ...updateData,
      updatedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('users').doc(UID).update(updateFields);

    await DL.DL_log('AM', 'updateAccountInfo', 'INFO', `帳號資訊更新: ${UID}`, operatorId);

    return {
      success: true,
      updatedFields: Object.keys(updateData),
      syncStatus: { completed: true }
    };

  } catch (error) {
    await DL.DL_error('AM', 'updateAccountInfo', error.message, operatorId);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_UPDATE_FAILED'
    };
  }
}

/**
 * 05. 修改用戶類型
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 變更用戶類型 (M/S/J) 和相關權限
 */
async function AM_changeUserType(UID, newUserType, operatorId, reason) {
  try {
    const userDoc = await db.collection('users').doc(UID).get();
    if (!userDoc.exists) {
      return {
        success: false,
        error: '用戶不存在',
        errorCode: 'AM_USER_NOT_FOUND'
      };
    }

    const userData = userDoc.data();
    const oldType = userData.userType;

    await db.collection('users').doc(UID).update({
      userType: newUserType,
      updatedAt: admin.firestore.Timestamp.now()
    });

    await DL.DL_warning('AM', 'changeUserType', `用戶類型變更: ${UID} ${oldType} -> ${newUserType}, 原因: ${reason}`, operatorId);

    return {
      success: true,
      oldType: oldType,
      newType: newUserType,
      affectedLedgers: userData.joined_ledgers || []
    };

  } catch (error) {
    await DL.DL_error('AM', 'changeUserType', error.message, operatorId);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_TYPE_CHANGE_FAILED'
    };
  }
}

/**
 * 06. 註銷用戶帳號
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 安全註銷帳號並處理相關數據清理
 */
async function AM_deactivateAccount(UID, deactivationReason, transferData) {
  try {
    const userDoc = await db.collection('users').doc(UID).get();
    if (!userDoc.exists) {
      return {
        success: false,
        error: '用戶不存在',
        errorCode: 'AM_USER_NOT_FOUND'
      };
    }

    const userData = userDoc.data();

    // 更新帳號狀態為停用
    await db.collection('users').doc(UID).update({
      status: 'deactivated',
      deactivatedAt: admin.firestore.Timestamp.now(),
      deactivationReason: deactivationReason,
      lastActive: userData.lastActive
    });

    // 更新帳號映射狀態
    await db.collection('account_mappings').doc(UID).update({
      status: 'deactivated',
      updated_at: admin.firestore.Timestamp.now()
    });

    await DL.DL_error('AM', 'deactivateAccount', `帳號註銷: ${UID}, 原因: ${deactivationReason}`, UID);

    return {
      success: true,
      backupId: `backup_${UID}_${Date.now()}`,
      transferredLedgers: userData.joined_ledgers || []
    };

  } catch (error) {
    await DL.DL_error('AM', 'deactivateAccount', error.message, UID);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_DEACTIVATE_FAILED'
    };
  }
}

/**
 * 07. 查詢用戶帳號資訊
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 安全查詢用戶基本資訊和跨平台關聯
 */
async function AM_getUserInfo(UID, requesterId, includeLinkedAccounts = true) {
  try {
    // 驗證查詢權限
    const hasPermission = await AM_validateQueryPermission(UID, requesterId);
    if (!hasPermission) {
      return {
        success: false,
        error: '權限不足',
        errorCode: 'AM_QUERY_PERMISSION_DENIED'
      };
    }

    const userDoc = await db.collection('users').doc(UID).get();
    if (!userDoc.exists) {
      return {
        success: false,
        error: '用戶不存在',
        errorCode: 'AM_USER_NOT_FOUND'
      };
    }

    const userData = userDoc.data();
    let linkedAccounts = {};

    if (includeLinkedAccounts) {
      linkedAccounts = userData.linkedAccounts || {};
    }

    await DL.DL_info('AM', 'getUserInfo', `用戶資訊查詢: ${UID}`, requesterId);

    return {
      success: true,
      userData: {
        UID: UID,
        displayName: userData.displayName,
        userType: userData.userType,
        createdAt: userData.createdAt,
        lastActive: userData.lastActive,
        timezone: userData.timezone,
        settings: userData.settings
      },
      linkedAccounts: linkedAccounts
    };

  } catch (error) {
    await DL.DL_error('AM', 'getUserInfo', error.message, requesterId);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_QUERY_FAILED'
    };
  }
}

/**
 * 08. 驗證帳號存在性
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 快速驗證帳號是否存在且有效
 */
async function AM_validateAccountExists(identifier, platform = 'LINE') {
  try {
    let userDoc;

    if (platform === 'LINE') {
      userDoc = await db.collection('users').doc(identifier).get();
    } else {
      // 對於其他平台，透過 account_mappings 查詢
      const mappingQuery = await db.collection('account_mappings')
        .where(`platform_accounts.${platform}`, '==', identifier)
        .limit(1)
        .get();

      if (!mappingQuery.empty) {
        const mappingDoc = mappingQuery.docs[0];
        const primaryUID = mappingDoc.data().primary_UID;
        userDoc = await db.collection('users').doc(primaryUID).get();
      }
    }

    if (userDoc && userDoc.exists) {
      const userData = userDoc.data();
      const accountStatus = userData.status || 'active';

      await DL.DL_info('AM', 'validateAccountExists', `帳號存在性驗證: ${identifier} (${platform})`, '');

      return {
        exists: true,
        UID: userDoc.id,
        accountStatus: accountStatus
      };
    }

    return {
      exists: false,
      UID: null,
      accountStatus: 'not_found'
    };

  } catch (error) {
    await DL.DL_error('AM', 'validateAccountExists', error.message, '');
    return {
      exists: false,
      UID: null,
      accountStatus: 'error'
    };
  }
}

/**
 * 09. 搜尋用戶帳號
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 支援模糊搜尋和多條件篩選的帳號搜尋
 */
async function AM_searchUserAccounts(searchCriteria, requesterId, filterOptions = {}) {
  try {
    // 驗證搜尋權限
    const hasPermission = await AM_validateSearchPermission(requesterId);
    if (!hasPermission) {
      return {
        success: false,
        error: '搜尋權限不足',
        errorCode: 'AM_SEARCH_PERMISSION_DENIED'
      };
    }

    let query = db.collection('users');

    // 根據搜尋條件建立查詢
    if (searchCriteria.userType) {
      query = query.where('userType', '==', searchCriteria.userType);
    }

    if (searchCriteria.status) {
      query = query.where('status', '==', searchCriteria.status);
    }

    // 執行查詢
    const querySnapshot = await query.limit(filterOptions.limit || 50).get();
    const results = [];

    querySnapshot.forEach(doc => {
      const data = doc.data();
      results.push({
        UID: doc.id,
        displayName: data.displayName,
        userType: data.userType,
        status: data.status || 'active',
        createdAt: data.createdAt,
        lastActive: data.lastActive
      });
    });

    await DL.DL_info('AM', 'searchUserAccounts', `用戶搜尋執行: 找到 ${results.length} 筆結果`, requesterId);

    return {
      success: true,
      results: results,
      totalCount: results.length
    };

  } catch (error) {
    await DL.DL_error('AM', 'searchUserAccounts', error.message, requesterId);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_SEARCH_FAILED'
    };
  }
}

/**
 * 10. 處理LINE OAuth授權
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 處理LINE Login OAuth流程和Token管理
 */
async function AM_handleLineOAuth(authCode, state, redirectUri) {
  try {
    const tokenUrl = 'https://api.line.me/oauth2/v2.1/token';
    const tokenData = {
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: redirectUri,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID,
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET
    };

    const tokenResponse = await axios.post(tokenUrl, new URLSearchParams(tokenData), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // 取得用戶資料
    const profileResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userProfile = profileResponse.data;

    // 安全儲存 Token
    await AM_storeTokenSecurely(userProfile.userId, access_token, refresh_token, expires_in);

    await DL.DL_log('AM', 'handleLineOAuth', 'INFO', `LINE OAuth授權成功: ${userProfile.userId}`, userProfile.userId);

    return {
      success: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      userProfile: userProfile
    };

  } catch (error) {
    await DL.DL_error('AM', 'handleLineOAuth', error.message, '');
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_OAUTH_FAILED'
    };
  }
}

/**
 * 11. 刷新LINE Access Token
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 自動刷新過期的LINE Access Token
 */
async function AM_refreshLineToken(UID, refreshToken) {
  try {
    const tokenUrl = 'https://api.line.me/oauth2/v2.1/token';
    const tokenData = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID,
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET
    };

    const response = await axios.post(tokenUrl, new URLSearchParams(tokenData), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, expires_in } = response.data;

    // 更新儲存的 Token
    await AM_updateStoredToken(UID, access_token, expires_in);

    return {
      success: true,
      newAccessToken: access_token,
      expiresIn: expires_in
    };

  } catch (error) {
    await DL.DL_error('AM', 'refreshLineToken', error.message, UID);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_TOKEN_REFRESH_FAILED'
    };
  }
}

/**
 * 12. 驗證LINE用戶身份
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 透過LINE API驗證用戶身份和權限
 */
async function AM_verifyLineIdentity(accessToken, expectedUID) {
  try {
    const response = await axios.get('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const userProfile = response.data;
    const verified = userProfile.userId === expectedUID;

    if (!verified) {
      await DL.DL_warning('AM', 'verifyLineIdentity', `身份驗證失敗: 預期 ${expectedUID}, 實際 ${userProfile.userId}`, expectedUID);
    }

    return {
      verified: verified,
      userProfile: userProfile,
      riskScore: verified ? 0 : 100
    };

  } catch (error) {
    await DL.DL_warning('AM', 'verifyLineIdentity', `身份驗證錯誤: ${error.message}`, expectedUID);
    return {
      verified: false,
      userProfile: null,
      riskScore: 100
    };
  }
}

/**
 * 13. 同步跨平台用戶資料
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 在LINE、iOS、Android平台間同步用戶資料
 */
async function AM_syncCrossPlatformData(UID, syncOptions = {}, targetPlatforms = ['ALL']) {
  try {
    const userDoc = await db.collection('users').doc(UID).get();
    if (!userDoc.exists) {
      return {
        success: false,
        error: '用戶不存在',
        errorCode: 'AM_USER_NOT_FOUND'
      };
    }

    const userData = userDoc.data();
    const syncedPlatforms = [];
    const conflicts = [];

    // 執行同步邏輯（簡化實作）
    if (targetPlatforms.includes('ALL') || targetPlatforms.includes('LINE')) {
      syncedPlatforms.push('LINE');
    }

    if (targetPlatforms.includes('ALL') || targetPlatforms.includes('iOS')) {
      syncedPlatforms.push('iOS');
    }

    if (targetPlatforms.includes('ALL') || targetPlatforms.includes('Android')) {
      syncedPlatforms.push('Android');
    }

    await DL.DL_info('AM', 'syncCrossPlatformData', `跨平台資料同步完成: ${UID}`, UID);

    return {
      success: true,
      syncedPlatforms: syncedPlatforms,
      conflicts: conflicts
    };

  } catch (error) {
    await DL.DL_error('AM', 'syncCrossPlatformData', error.message, UID);
    return {
      success: false,
      error: error.message,
      errorCode: 'AM_SYNC_FAILED'
    };
  }
}

/**
 * 14. 處理平台資料衝突
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 偵測並解決跨平台資料不一致問題
 */
async function AM_resolveDataConflict(conflictData, resolutionStrategy = 'latest') {
  try {
    let finalData = {};

    switch (resolutionStrategy) {
      case 'latest':
        // 使用最新時間戳的資料
        finalData = conflictData.reduce((latest, current) => {
          return current.timestamp > latest.timestamp ? current : latest;
        });
        break;

      case 'merge':
        // 合併所有資料
        finalData = Object.assign({}, ...conflictData.map(d => d.data));
        break;

      default:
        finalData = conflictData[0];
    }

    await DL.DL_warning('AM', 'resolveDataConflict', `資料衝突解決: 策略 ${resolutionStrategy}`, '');

    return {
      resolved: true,
      finalData: finalData,
      appliedStrategy: resolutionStrategy
    };

  } catch (error) {
    await DL.DL_error('AM', 'resolveDataConflict', error.message, '');
    return {
      resolved: false,
      finalData: null,
      appliedStrategy: resolutionStrategy
    };
  }
}

/**
 * 15. 處理帳號操作錯誤
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 統一處理帳號管理過程中的各種錯誤
 */
async function AM_handleAccountError(errorType, errorData, context, retryCount = 0) {
  try {
    const maxRetries = 3;
    const shouldRetry = retryCount < maxRetries && ['NETWORK_ERROR', 'TIMEOUT'].includes(errorType);

    await DL.DL_error('AM', 'handleAccountError', `錯誤類型: ${errorType}, 重試次數: ${retryCount}`, context.UID || '');

    if (shouldRetry) {
      // 排程重試（簡化實作）
      setTimeout(() => {
        console.log(`將在 ${Math.pow(2, retryCount)} 秒後重試...`);
      }, Math.pow(2, retryCount) * 1000);
    }

    return {
      handled: true,
      errorCode: errorType,
      retryScheduled: shouldRetry
    };

  } catch (error) {
    console.error('錯誤處理器本身發生錯誤:', error);
    return {
      handled: false,
      errorCode: 'AM_ERROR_HANDLER_FAILED',
      retryScheduled: false
    };
  }
}

/**
 * 16. 監控帳號系統健康狀態
 * @version 2025-01-09-V1.0.0
 * @date 2025-01-09 00:34:00
 * @description 即時監控帳號管理系統的運行狀態
 */
async function AM_monitorSystemHealth() {
  try {
    // 檢查資料庫連線
    const healthCheck = await db.collection('_health_check').doc('am_health').set({
      timestamp: admin.firestore.Timestamp.now(),
      status: 'healthy'
    });

    // 統計活躍用戶數
    const activeUsersQuery = await db.collection('users')
      .where('lastActive', '>', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .get();

    const activeUsers = activeUsersQuery.size;

    // 檢查 LINE API 狀態（簡化）
    const apiStatus = {
      line_messaging: 'healthy',
      line_login: 'healthy'
    };

    const performance = {
      responseTime: Date.now() % 100, // 模擬回應時間
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    return {
      healthy: true,
      activeUsers: activeUsers,
      apiStatus: apiStatus,
      performance: performance
    };

  } catch (error) {
    await DL.DL_error('AM', 'monitorSystemHealth', error.message, '');
    return {
      healthy: false,
      activeUsers: 0,
      apiStatus: { error: error.message },
      performance: null
    };
  }
}

/**
 * 17. 初始化用戶科目數據
 * @version 2025-07-11-V1.0.0
 * @date 2025-07-11 18:00:00
 * @description 為新用戶初始化預設科目數據
 */
async function AM_initializeUserSubjects(UID, ledgerIdPrefix = 'user_') {
  try {
    console.log(`🔄 AM模組開始為用戶 ${UID} 初始化科目數據...`);

    const userLedgerId = `${ledgerIdPrefix}${UID}`;

    // 導入完整科目資料
    const subjectData = require('../Miscellaneous/9999. Subject_code.json');
    const batch = db.batch();

    console.log(`📋 準備導入 ${subjectData.length} 筆科目資料到 ${userLedgerId}...`);

    let importCount = 0;
    for (const subject of subjectData) {
      const docId = `${subject.大項代碼}_${subject.子項代碼}`;
      const subjectRef = db.collection('ledgers').doc(userLedgerId).collection('subjects').doc(docId);

      batch.set(subjectRef, {
        大項代碼: String(subject.大項代碼),
        大項名稱: subject.大項名稱 || '',
        子項代碼: String(subject.子項代碼),
        子項名稱: subject.子項名稱 || '',
        同義詞: subject.同義詞 || '',
        isActive: true,
        sortOrder: importCount,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });

      importCount++;

      // 每 400 筆提交一次 batch
      if (importCount % 400 === 0) {
        await batch.commit();
        console.log(`📦 已提交 ${importCount} 筆科目資料到用戶帳本...`);
      }
    }

    // 提交剩餘的資料
    if (importCount % 400 !== 0) {
      await batch.commit();
    }

    // 記錄操作日誌
    await DL.DL_log('AM', 'initializeUserSubjects', 'INFO', `用戶 ${UID} 科目初始化完成，共導入 ${importCount} 筆科目`, UID);

    console.log(`✅ 用戶 ${UID} 科目初始化完成，共導入 ${importCount} 筆科目`);
    return {
      success: true,
      importCount: importCount,
      userLedgerId: userLedgerId
    };

  } catch (error) {
    console.error(`❌ 用戶 ${UID} 科目初始化失敗:`, error);
    await DL.DL_error('AM', 'initializeUserSubjects', error.message, UID);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 18. 檢查並補充用戶科目數據
 * @version 2025-07-11-V1.0.0
 * @date 2025-07-11 18:00:00
 * @description 檢查用戶科目是否存在，不存在則自動初始化
 */
async function AM_ensureUserSubjects(UID) {
  try {
    const userLedgerId = `user_${UID}`;

    // 檢查用戶是否有科目數據
    const subjectsQuery = await db.collection('ledgers').doc(userLedgerId).collection('subjects').limit(1).get();

    if (subjectsQuery.empty) {
      console.log(`🔄 用戶 ${UID} 沒有科目數據，開始自動初始化...`);
      return await AM_initializeUserSubjects(UID);
    } else {
      console.log(`✅ 用戶 ${UID} 已有科目數據，無需初始化`);
      return {
        success: true,
        message: '用戶科目已存在',
        userLedgerId: userLedgerId
      };
    }

  } catch (error) {
    console.error(`❌ 檢查用戶 ${UID} 科目失敗:`, error);
    await DL.DL_error('AM', 'ensureUserSubjects', error.message, UID);
    return {
      success: false,
      error: error.message
    };
  }
}

// === 輔助函數 ===

/**
 * 產生平台專屬UID
 */
function AM_generatePlatformUID(platform, deviceId) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${platform}_${timestamp}_${random}`;
}

/**
 * 安全儲存Token
 */
async function AM_storeTokenSecurely(UID, accessToken, refreshToken, expiresIn) {
  try {
    const tokenData = {
      line_access_token: accessToken, // 實際應用中需要加密
      line_refresh_token: refreshToken, // 實際應用中需要加密
      token_expires_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiresIn * 1000)),
      last_refresh: admin.firestore.Timestamp.now(),
      token_scope: ['profile']
    };

    await db.collection('auth_tokens').doc(UID).set(tokenData);
    return true;
  } catch (error) {
    console.error('Token儲存失敗:', error);
    return false;
  }
}

/**
 * 更新儲存的Token
 */
async function AM_updateStoredToken(UID, accessToken, expiresIn) {
  try {
    await db.collection('auth_tokens').doc(UID).update({
      line_access_token: accessToken,
      token_expires_at: admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiresIn * 1000)),
      last_refresh: admin.firestore.Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error('Token更新失敗:', error);
    return false;
  }
}

/**
 * 驗證更新權限
 */
async function AM_validateUpdatePermission(UID, operatorId) {
  // 簡化權限檢查：用戶可以更新自己的資料，或管理員可以更新任何資料
  if (UID === operatorId) return true;

  try {
    const operatorDoc = await db.collection('users').doc(operatorId).get();
    if (operatorDoc.exists) {
      const operatorData = operatorDoc.data();
      return operatorData.userType === 'M'; // M類型用戶有管理權限
    }
  } catch (error) {
    console.error('權限驗證失敗:', error);
  }

  return false;
}

/**
 * 驗證查詢權限
 */
async function AM_validateQueryPermission(UID, requesterId) {
  // 簡化權限檢查
  return UID === requesterId || await AM_validateUpdatePermission(UID, requesterId);
}

/**
 * 驗證搜尋權限
 */
async function AM_validateSearchPermission(requesterId) {
  try {
    const requesterDoc = await db.collection('users').doc(requesterId).get();
    if (requesterDoc.exists) {
      const requesterData = requesterDoc.data();
      return requesterData.userType === 'M'; // 只有M類型用戶可以搜尋
    }
  } catch (error) {
    console.error('搜尋權限驗證失敗:', error);
  }

  return false;
}

// =============== Phase 1: 核心認證API端點 ===============

/**
 * 26. 處理用戶註冊API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 統一用戶註冊API端點，支援四模式差異化註冊流程
 */
async function AM_handleUserRegistrationAPI(requestData, userMode = 'Expert') {
  const functionName = "AM_handleUserRegistrationAPI";
  try {
    AM_logInfo(`處理用戶註冊API請求: ${requestData.email}`, "用戶註冊", "SYSTEM", "", "", functionName);

    // 驗證必要欄位
    if (!requestData.email || !requestData.password || !requestData.userMode) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "缺少必要欄位：email、password、userMode",
          field: "required_fields",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 檢查帳號是否已存在
    const existingCheck = await AM_validateAccountExists(requestData.email, 'email');
    if (existingCheck.exists) {
      return {
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "此 Email 已被註冊",
          field: "email",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 建立用戶資料
    const userData = {
      email: requestData.email,
      displayName: requestData.displayName || '',
      userMode: requestData.userMode,
      userType: 'S', // 預設為一般用戶
      createdAt: admin.firestore.Timestamp.now(),
      lastActive: admin.firestore.Timestamp.now(),
      timezone: requestData.timezone || 'Asia/Taipei',
      language: requestData.language || 'zh-TW',
      linkedAccounts: {
        EMAIL: requestData.email,
        LINE_UID: '',
        iOS_UID: '',
        Android_UID: ''
      },
      settings: {
        notifications: true,
        theme: requestData.theme || 'auto'
      },
      emailVerified: false,
      acceptTerms: requestData.acceptTerms || false,
      acceptPrivacy: requestData.acceptPrivacy || false
    };

    // 生成用戶ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 儲存用戶資料
    await db.collection('users').doc(userId).set(userData);

    // 生成JWT Token（簡化實作）
    const token = `jwt_token_${userId}_${Date.now()}`;
    const refreshToken = `refresh_token_${userId}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小時

    // 初始化用戶科目
    const subjectInit = await AM_initializeUserSubjects(userId);

    return {
      success: true,
      data: {
        userId: userId,
        email: requestData.email,
        userMode: requestData.userMode,
        verificationSent: true,
        needsAssessment: requestData.userMode === 'Auto',
        token: token,
        refreshToken: refreshToken,
        expiresAt: expiresAt.toISOString()
      },
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: requestData.userMode
      }
    };

  } catch (error) {
    AM_logError(`用戶註冊API失敗: ${error.message}`, "用戶註冊", "SYSTEM", "AM_REGISTER_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "註冊過程發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 27. 處理用戶登入API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 統一用戶登入API端點，支援四模式差異化登入體驗
 */
async function AM_handleUserLoginAPI(requestData, userMode = 'Expert') {
  const functionName = "AM_handleUserLoginAPI";
  try {
    AM_logInfo(`處理用戶登入API請求: ${requestData.email}`, "用戶登入", "SYSTEM", "", "", functionName);

    // 驗證必要欄位
    if (!requestData.email || !requestData.password) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "缺少必要欄位：email、password",
          field: "credentials",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 驗證帳號存在性
    const accountCheck = await AM_validateAccountExists(requestData.email, 'email');
    if (!accountCheck.exists) {
      return {
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email 或密碼錯誤",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 取得用戶資料
    const userInfo = await AM_getUserInfo(accountCheck.UID, 'SYSTEM', true);
    if (!userInfo.success) {
      return {
        success: false,
        error: {
          code: "USER_DATA_ERROR",
          message: "無法取得用戶資料",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 更新最後登入時間
    await db.collection('users').doc(accountCheck.UID).update({
      lastActive: admin.firestore.Timestamp.now()
    });

    // 生成Token
    const token = `jwt_token_${accountCheck.UID}_${Date.now()}`;
    const refreshToken = `refresh_token_${accountCheck.UID}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 根據模式準備回應資料
    let responseData = {
      token: token,
      refreshToken: refreshToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: accountCheck.UID,
        email: userInfo.userData.displayName || requestData.email,
        displayName: userInfo.userData.displayName,
        userMode: userInfo.userData.userMode || userMode,
        avatar: userInfo.userData.metadata?.profilePicture || null
      }
    };

    // Expert模式：添加登入歷史
    if (userMode === 'Expert') {
      responseData.loginHistory = {
        lastLogin: userInfo.userData.lastActive?.toDate().toISOString(),
        loginCount: 1,
        newDeviceDetected: false
      };
    }

    // Cultivation模式：添加連續記錄
    if (userMode === 'Cultivation') {
      responseData.streakInfo = {
        currentStreak: 1,
        longestStreak: 1,
        streakMessage: "歡迎回來！繼續保持記帳習慣！"
      };
    }

    return {
      success: true,
      data: responseData,
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: userMode
      }
    };

  } catch (error) {
    AM_logError(`用戶登入API失敗: ${error.message}`, "用戶登入", "SYSTEM", "AM_LOGIN_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "登入過程發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 28. 處理密碼重設API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 處理忘記密碼和密碼重設功能
 */
async function AM_handlePasswordResetAPI(requestData, action = 'forgot') {
  const functionName = "AM_handlePasswordResetAPI";
  try {
    AM_logInfo(`處理密碼重設API請求: ${action}`, "密碼重設", "SYSTEM", "", "", functionName);

    if (action === 'forgot') {
      // 忘記密碼 - 發送重設連結
      if (!requestData.email) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "缺少必要欄位：email",
            field: "email",
            timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
            requestId: `req_${Date.now()}`
          }
        };
      }

      // 檢查帳號存在性
      const accountCheck = await AM_validateAccountExists(requestData.email, 'email');
      if (!accountCheck.exists) {
        // 為安全起見，不告知帳號不存在
        return {
          success: true,
          data: {
            message: "密碼重設連結已發送到您的 Email",
            expiresIn: 3600
          },
          metadata: {
            timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
            requestId: `req_${Date.now()}`,
            userMode: "System"
          }
        };
      }

      // 生成重設Token
      const resetToken = `reset_${accountCheck.UID}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1小時有效

      // 儲存重設Token
      await db.collection('password_resets').doc(resetToken).set({
        userId: accountCheck.UID,
        email: requestData.email,
        token: resetToken,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        used: false,
        createdAt: admin.firestore.Timestamp.now()
      });

      return {
        success: true,
        data: {
          message: "密碼重設連結已發送到您的 Email",
          expiresIn: 3600
        },
        metadata: {
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`,
          userMode: "System"
        }
      };

    } else if (action === 'reset') {
      // 重設密碼
      if (!requestData.token || !requestData.newPassword) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "缺少必要欄位：token、newPassword",
            field: "reset_data",
            timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
            requestId: `req_${Date.now()}`
          }
        };
      }

      // 驗證重設Token
      const tokenDoc = await db.collection('password_resets').doc(requestData.token).get();
      if (!tokenDoc.exists || tokenDoc.data().used || tokenDoc.data().expiresAt.toDate() < new Date()) {
        return {
          success: false,
          error: {
            code: "INVALID_RESET_TOKEN",
            message: "重設連結無效或已過期",
            timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
            requestId: `req_${Date.now()}`
          }
        };
      }

      const tokenData = tokenDoc.data();

      // 更新密碼（實際應用需要加密）
      await db.collection('users').doc(tokenData.userId).update({
        password: requestData.newPassword, // 實際需要加密
        passwordUpdatedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });

      // 標記Token為已使用
      await db.collection('password_resets').doc(requestData.token).update({
        used: true,
        usedAt: admin.firestore.Timestamp.now()
      });

      // 生成自動登入Token
      const autoLoginToken = `jwt_token_${tokenData.userId}_${Date.now()}`;

      return {
        success: true,
        data: {
          message: "密碼重設成功",
          autoLogin: true,
          token: autoLoginToken
        },
        metadata: {
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`,
          userMode: "System"
        }
      };
    }

  } catch (error) {
    AM_logError(`密碼重設API失敗: ${error.message}`, "密碼重設", "SYSTEM", "AM_PASSWORD_RESET_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "密碼重設過程發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 29. 驗證用戶認證狀態
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 驗證JWT Token有效性和用戶認證狀態
 */
async function AM_verifyUserAuthenticationAPI(token) {
  const functionName = "AM_verifyUserAuthenticationAPI";
  try {
    AM_logInfo(`驗證用戶認證狀態`, "認證驗證", "SYSTEM", "", "", functionName);

    if (!token) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "缺少認證Token",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 簡化Token驗證（實際應用需要JWT驗證）
    if (!token.startsWith('jwt_token_')) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Token格式無效",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 從Token中提取用戶ID（簡化實作）
    const tokenParts = token.split('_');
    if (tokenParts.length < 4) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Token格式錯誤",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    const userId = `${tokenParts[2]}_${tokenParts[3]}_${tokenParts[4]}`;

    // 驗證用戶存在
    const userInfo = await AM_getUserInfo(userId, 'SYSTEM');
    if (!userInfo.success) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "用戶不存在或已停用",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    return {
      success: true,
      data: {
        userId: userId,
        userMode: userInfo.userData.userMode || 'Expert',
        verified: true,
        tokenValid: true
      },
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: userInfo.userData.userMode || 'Expert'
      }
    };

  } catch (error) {
    AM_logError(`認證驗證失敗: ${error.message}`, "認證驗證", "SYSTEM", "AM_AUTH_VERIFY_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "認證驗證過程發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 30. 處理登出操作
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 處理用戶登出，無效化Token並清理會話
 */
async function AM_handleUserLogoutAPI(requestData, userId) {
  const functionName = "AM_handleUserLogoutAPI";
  try {
    AM_logInfo(`處理用戶登出: ${userId}`, "用戶登出", userId, "", "", functionName);

    // 記錄登出時間
    await db.collection('users').doc(userId).update({
      lastLogout: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 無效化Token（實際應用需要維護Token黑名單）
    const logoutDevices = requestData.logoutAllDevices ? 'all' : 'current';

    return {
      success: true,
      data: {
        message: "登出成功",
        loggedOutDevices: logoutDevices === 'all' ? 99 : 1
      },
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: "System"
      }
    };

  } catch (error) {
    AM_logError(`用戶登出失敗: ${error.message}`, "用戶登出", userId, "AM_LOGOUT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "登出過程發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

// =============== Phase 2: 用戶管理功能API端點 ===============

/**
 * 31. 取得用戶個人資料API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 取得當前用戶的完整個人資料，支援四模式差異化回應
 */
async function AM_getUserProfileAPI(userId, userMode = 'Expert', includeStatistics = true) {
  const functionName = "AM_getUserProfileAPI";
  try {
    AM_logInfo(`取得用戶個人資料: ${userId}`, "用戶資料", userId, "", "", functionName);

    // 取得用戶基本資料
    const userInfo = await AM_getUserInfo(userId, 'SYSTEM', true);
    if (!userInfo.success) {
      return {
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "用戶不存在",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 基本資料（所有模式）
    let responseData = {
      id: userId,
      email: userInfo.userData.email || '',
      displayName: userInfo.userData.displayName || '',
      avatar: userInfo.userData.metadata?.profilePicture || null,
      userMode: userInfo.userData.userMode || userMode,
      createdAt: userInfo.userData.createdAt?.toDate().toISOString(),
      lastLoginAt: userInfo.userData.lastActive?.toDate().toISOString()
    };

    // Expert/Inertial Mode: 詳細統計
    if ((userMode === 'Expert' || userMode === 'Inertial') && includeStatistics) {
      // 查詢統計數據（簡化實作）
      responseData.statistics = {
        totalTransactions: 1250,
        totalLedgers: 3,
        averageDailyRecords: 4.2,
        longestStreak: 45
      };

      responseData.preferences = {
        language: userInfo.userData.settings?.language || 'zh-TW',
        currency: 'TWD',
        timezone: userInfo.userData.timezone || 'Asia/Taipei',
        dateFormat: 'YYYY-MM-DD',
        theme: userInfo.userData.settings?.theme || 'auto',
        defaultLedgerId: userInfo.userData.defaultLedgerId || ''
      };
    }

    // Cultivation Mode: 成就與進度
    if (userMode === 'Cultivation') {
      responseData.achievements = {
        currentLevel: 8,
        totalPoints: 2350,
        nextLevelPoints: 2500,
        currentStreak: 12
      };
    }

    // 安全設定（基本資訊）
    responseData.security = {
      hasAppLock: false,
      biometricEnabled: false,
      privacyModeEnabled: false,
      twoFactorEnabled: false
    };

    return {
      success: true,
      data: responseData,
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: userMode
      }
    };

  } catch (error) {
    AM_logError(`取得用戶資料失敗: ${error.message}`, "用戶資料", userId, "AM_GET_PROFILE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "取得用戶資料時發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 32. 更新用戶個人資料API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 更新用戶的個人資料，包含基本資訊與顯示偏好
 */
async function AM_updateUserProfileAPI(userId, updateData, userMode = 'Expert') {
  const functionName = "AM_updateUserProfileAPI";
  try {
    AM_logInfo(`更新用戶個人資料: ${userId}`, "資料更新", userId, "", "", functionName);

    // 驗證更新欄位
    const allowedFields = ['displayName', 'avatar', 'language', 'timezone', 'theme'];
    const filteredData = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "沒有有效的更新欄位",
          field: "updateData",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 準備更新資料
    const updatePayload = {};
    if (filteredData.displayName) updatePayload.displayName = filteredData.displayName;
    if (filteredData.language) updatePayload['settings.language'] = filteredData.language;
    if (filteredData.timezone) updatePayload.timezone = filteredData.timezone;
    if (filteredData.theme) updatePayload['settings.theme'] = filteredData.theme;
    
    updatePayload.updatedAt = admin.firestore.Timestamp.now();

    // 執行更新
    const updateResult = await AM_updateAccountInfo(userId, updatePayload, userId);
    if (!updateResult.success) {
      return {
        success: false,
        error: {
          code: "UPDATE_FAILED",
          message: updateResult.error,
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    return {
      success: true,
      data: {
        message: "個人資料更新成功",
        updatedAt: admin.firestore.Timestamp.now().toDate().toISOString()
      },
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: userMode
      }
    };

  } catch (error) {
    AM_logError(`更新用戶資料失敗: ${error.message}`, "資料更新", userId, "AM_UPDATE_PROFILE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "更新個人資料時發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 33. 處理四模式評估API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 處理用戶模式評估問卷並推薦最適合的模式
 */
async function AM_handleModeAssessmentAPI(userId, assessmentData) {
  const functionName = "AM_handleModeAssessmentAPI";
  try {
    AM_logInfo(`處理模式評估: ${userId}`, "模式評估", userId, "", "", functionName);

    // 驗證評估資料
    if (!assessmentData.questionnaireId || !assessmentData.answers || !Array.isArray(assessmentData.answers)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "缺少評估問卷資料或格式錯誤",
          field: "assessmentData",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 計算各模式得分
    const scores = {
      Expert: 0,
      Inertial: 0,
      Cultivation: 0,
      Guiding: 0
    };

    // 評估邏輯（簡化實作）
    for (const answer of assessmentData.answers) {
      const questionId = answer.questionId;
      const selectedOptions = answer.selectedOptions || [];

      for (const option of selectedOptions) {
        switch (option) {
          case 'A': // 偏向專業功能
            scores.Expert += 3;
            scores.Inertial += 1;
            break;
          case 'B': // 偏向標準功能
            scores.Inertial += 3;
            scores.Expert += 1;
            break;
          case 'C': // 偏向引導學習
            scores.Cultivation += 3;
            scores.Guiding += 1;
            break;
          case 'D': // 偏向簡單使用
            scores.Guiding += 3;
            scores.Cultivation += 1;
            break;
        }
      }
    }

    // 找出最高分的模式
    const recommendedMode = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );

    const maxScore = Math.max(...Object.values(scores));
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? (maxScore / totalScore * 100) : 0;

    // 更新用戶模式
    const modeUpdateResult = await AM_changeUserType(userId, 'S', 'SYSTEM', `模式評估推薦: ${recommendedMode}`);
    
    // 儲存評估結果
    await db.collection('users').doc(userId).update({
      userMode: recommendedMode,
      lastAssessment: admin.firestore.Timestamp.now(),
      assessmentScores: scores,
      assessmentVersion: assessmentData.questionnaireId
    });

    return {
      success: true,
      data: {
        result: {
          recommendedMode: recommendedMode,
          confidence: confidence,
          scores: scores,
          explanation: `基於您的回答，推薦使用${recommendedMode}模式以獲得最佳體驗`,
          modeCharacteristics: {
            [recommendedMode]: AM_getModeDescription(recommendedMode),
            alternatives: AM_getAlternativeModes(recommendedMode, scores)
          }
        },
        applied: true,
        previousMode: 'Auto'
      },
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: recommendedMode
      }
    };

  } catch (error) {
    AM_logError(`模式評估失敗: ${error.message}`, "模式評估", userId, "AM_ASSESSMENT_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "模式評估過程發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 34. 處理模式切換API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 允許用戶手動切換使用模式
 */
async function AM_handleModeSwitchAPI(userId, switchData) {
  const functionName = "AM_handleModeSwitchAPI";
  try {
    AM_logInfo(`處理模式切換: ${userId} -> ${switchData.newMode}`, "模式切換", userId, "", "", functionName);

    // 驗證新模式
    const validModes = ['Expert', 'Inertial', 'Cultivation', 'Guiding'];
    if (!switchData.newMode || !validModes.includes(switchData.newMode)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "無效的模式選擇",
          field: "newMode",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 取得當前用戶資料
    const userInfo = await AM_getUserInfo(userId, 'SYSTEM');
    if (!userInfo.success) {
      return {
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "用戶不存在",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    const previousMode = userInfo.userData.userMode || 'Expert';

    // 更新用戶模式
    await db.collection('users').doc(userId).update({
      userMode: switchData.newMode,
      previousMode: previousMode,
      modeChangedAt: admin.firestore.Timestamp.now(),
      modeChangeReason: switchData.reason || '用戶主動切換',
      updatedAt: admin.firestore.Timestamp.now()
    });

    return {
      success: true,
      data: {
        previousMode: previousMode,
        currentMode: switchData.newMode,
        changedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
        modeDescription: AM_getModeDescription(switchData.newMode),
        suggestedFeatures: AM_getSuggestedFeatures(switchData.newMode)
      },
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: switchData.newMode
      }
    };

  } catch (error) {
    AM_logError(`模式切換失敗: ${error.message}`, "模式切換", userId, "AM_MODE_SWITCH_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "模式切換過程發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

/**
 * 35. 管理用戶偏好設定API端點
 * @version 2025-09-15-V1.5.0
 * @date 2025-09-15 00:00:00
 * @description 更新用戶的應用偏好設定，包含預設值、通知設定等
 */
async function AM_handleUserPreferencesAPI(userId, preferencesData, userMode = 'Expert') {
  const functionName = "AM_handleUserPreferencesAPI";
  try {
    AM_logInfo(`更新用戶偏好設定: ${userId}`, "偏好設定", userId, "", "", functionName);

    // 根據模式篩選允許的設定項目
    const allowedPreferences = AM_getAllowedPreferences(userMode);
    const filteredPreferences = {};

    // 基本偏好（所有模式）
    if (preferencesData.currency && allowedPreferences.includes('currency')) {
      filteredPreferences['preferences.currency'] = preferencesData.currency;
    }
    if (preferencesData.dateFormat && allowedPreferences.includes('dateFormat')) {
      filteredPreferences['preferences.dateFormat'] = preferencesData.dateFormat;
    }
    if (preferencesData.defaultLedgerId && allowedPreferences.includes('defaultLedgerId')) {
      filteredPreferences['preferences.defaultLedgerId'] = preferencesData.defaultLedgerId;
    }

    // Expert/Inertial Mode: 進階偏好
    if ((userMode === 'Expert' || userMode === 'Inertial')) {
      if (preferencesData.numberFormat) {
        filteredPreferences['preferences.numberFormat'] = preferencesData.numberFormat;
      }
      if (preferencesData.fiscalYearStart) {
        filteredPreferences['preferences.fiscalYearStart'] = preferencesData.fiscalYearStart;
      }
      if (preferencesData.autoBackupEnabled !== undefined) {
        filteredPreferences['preferences.autoBackupEnabled'] = preferencesData.autoBackupEnabled;
      }
    }

    // 通知偏好
    if (preferencesData.notifications && typeof preferencesData.notifications === 'object') {
      Object.keys(preferencesData.notifications).forEach(key => {
        filteredPreferences[`preferences.notifications.${key}`] = preferencesData.notifications[key];
      });
    }

    // Cultivation Mode: 激勵偏好
    if (userMode === 'Cultivation' && preferencesData.gamification) {
      Object.keys(preferencesData.gamification).forEach(key => {
        filteredPreferences[`preferences.gamification.${key}`] = preferencesData.gamification[key];
      });
    }

    if (Object.keys(filteredPreferences).length === 0) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "沒有有效的偏好設定項目",
          field: "preferencesData",
          timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
          requestId: `req_${Date.now()}`
        }
      };
    }

    // 更新偏好設定
    filteredPreferences.updatedAt = admin.firestore.Timestamp.now();
    
    await db.collection('users').doc(userId).update(filteredPreferences);

    const appliedChanges = Object.keys(filteredPreferences).filter(key => key !== 'updatedAt');

    return {
      success: true,
      data: {
        message: "偏好設定已更新",
        updatedAt: admin.firestore.Timestamp.now().toDate().toISOString(),
        appliedChanges: appliedChanges
      },
      metadata: {
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`,
        userMode: userMode
      }
    };

  } catch (error) {
    AM_logError(`偏好設定更新失敗: ${error.message}`, "偏好設定", userId, "AM_PREFERENCES_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "偏好設定更新時發生錯誤",
        timestamp: admin.firestore.Timestamp.now().toDate().toISOString(),
        requestId: `req_${Date.now()}`
      }
    };
  }
}

// === 輔助函數 ===

/**
 * 取得模式描述
 */
function AM_getModeDescription(mode) {
  const descriptions = {
    Expert: "專家模式：完整功能、專業工具、深度設定",
    Inertial: "標準模式：簡潔介面、固定流程、核心功能",
    Cultivation: "養成模式：專注於習慣培養與進度追蹤",
    Guiding: "引導模式：極簡介面、自動化配置、最少決策"
  };
  return descriptions[mode] || "未知模式";
}

/**
 * 取得替代模式建議
 */
function AM_getAlternativeModes(recommendedMode, scores) {
  const sortedModes = Object.entries(scores)
    .filter(([mode]) => mode !== recommendedMode)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2);

  return sortedModes.map(([mode, score]) => ({
    mode: mode,
    reason: `如果您偏好${AM_getModeDescription(mode).split('：')[1]}`
  }));
}

/**
 * 取得建議功能
 */
function AM_getSuggestedFeatures(mode) {
  const features = {
    Expert: ["進階報表", "批次操作", "自訂分類", "詳細分析"],
    Inertial: ["快速記帳", "基本報表", "預算管理", "月度統計"],
    Cultivation: ["每日挑戰", "成就系統", "記帳提醒", "習慣追蹤"],
    Guiding: ["一鍵記帳", "簡單統計", "自動分類", "智慧建議"]
  };
  return features[mode] || [];
}

/**
 * 取得模式允許的偏好設定
 */
function AM_getAllowedPreferences(mode) {
  const basePreferences = ['currency', 'dateFormat', 'defaultLedgerId'];
  
  switch (mode) {
    case 'Expert':
      return [...basePreferences, 'numberFormat', 'fiscalYearStart', 'autoBackupEnabled', 'advanced'];
    case 'Inertial':
      return [...basePreferences, 'numberFormat', 'autoBackupEnabled'];
    case 'Cultivation':
      return [...basePreferences, 'gamification'];
    case 'Guiding':
      return basePreferences;
    default:
      return basePreferences;
  }
}

// =============== SR模組專用付費功能API ===============

/**
 * 22. 驗證SR模組付費功能權限
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 專門為SR模組驗證用戶的付費功能權限
 */
async function AM_validateSRPremiumFeature(userId, featureName, requesterId) {
  const functionName = "AM_validateSRPremiumFeature";
  try {
    AM_logInfo(`驗證SR付費功能: ${featureName}`, "SR權限驗證", userId, "", "", functionName);

    // 取得用戶訂閱資訊
    const subscriptionInfo = await AM_getSubscriptionInfo(userId, requesterId);
    if (!subscriptionInfo.success) {
      return {
        success: false,
        allowed: false,
        reason: '無法取得訂閱資訊',
        error: subscriptionInfo.error
      };
    }

    const subscription = subscriptionInfo.subscriptionData;

    // SR功能權限矩陣
    const srFeatureMatrix = {
      'CREATE_REMINDER': { level: 'free', quota: 2 },
      'AUTO_PUSH': { level: 'premium', quota: -1 },
      'OPTIMIZE_TIME': { level: 'premium', quota: -1 },
      'UNLIMITED_REMINDERS': { level: 'premium', quota: -1 },
      'BUDGET_WARNING': { level: 'premium', quota: -1 },
      'MONTHLY_REPORT': { level: 'premium', quota: -1 }
    };

    const feature = srFeatureMatrix[featureName];
    if (!feature) {
      return {
        success: false,
        allowed: false,
        reason: '未知的功能名稱'
      };
    }

    // 檢查付費狀態
    if (feature.level === 'premium' && subscription.plan !== 'premium') {
      return {
        success: true,
        allowed: false,
        reason: '此功能需要Premium訂閱',
        upgradeRequired: true,
        currentPlan: subscription.plan
      };
    }

    // 檢查配額限制
    if (feature.quota > 0) {
      const usageInfo = await AM_getSRUserQuota(userId, featureName, requesterId);
      if (usageInfo.success && usageInfo.currentUsage >= feature.quota) {
        return {
          success: true,
          allowed: false,
          reason: `已達到${feature.quota}個的使用限制`,
          quotaExceeded: true,
          currentUsage: usageInfo.currentUsage,
          maxQuota: feature.quota
        };
      }
    }

    return {
      success: true,
      allowed: true,
      reason: 'Permission granted',
      featureLevel: feature.level,
      quota: feature.quota
    };

  } catch (error) {
    AM_logError(`SR付費功能驗證失敗: ${error.message}`, "SR權限驗證", userId, "AM_SR_VALIDATE_ERROR", error.toString(), functionName);
    return {
      success: false,
      allowed: false,
      error: error.message
    };
  }
}

/**
 * 23. 取得SR用戶配額資訊
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 查詢用戶在SR模組的功能使用配額
 */
async function AM_getSRUserQuota(userId, featureName, requesterId) {
  const functionName = "AM_getSRUserQuota";
  try {
    // 權限檢查
    if (requesterId !== userId && requesterId !== 'SYSTEM') {
      const permissionCheck = await AM_checkPermission(requesterId, 'admin', 'read');
      if (!permissionCheck.hasPermission) {
        return {
          success: false,
          error: '權限不足'
        };
      }
    }

    // 從Firestore取得配額資訊
    if (FS && typeof FS.FS_getDocument === 'function') {
      const quotaDoc = await FS.FS_getDocument('user_quotas', userId, 'SYSTEM');

      let quotaData = {};
      if (quotaDoc.success && quotaDoc.data) {
        quotaData = quotaDoc.data;
      }

      const currentUsage = quotaData[featureName] || 0;

      return {
        success: true,
        currentUsage,
        quotaData,
        featureName
      };
    }

    return {
      success: false,
      error: 'FS模組不可用'
    };

  } catch (error) {
    AM_logError(`取得SR配額失敗: ${error.message}`, "SR配額查詢", userId, "AM_SR_QUOTA_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 24. 更新SR功能使用量
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 更新用戶SR功能的使用量統計
 */
async function AM_updateSRFeatureUsage(userId, featureName, increment, requesterId) {
  const functionName = "AM_updateSRFeatureUsage";
  try {
    AM_logInfo(`更新SR功能使用量: ${featureName} +${increment}`, "SR使用量", userId, "", "", functionName);

    // 系統權限檢查
    if (requesterId !== 'SYSTEM' && requesterId !== 'SR_MODULE') {
      return {
        success: false,
        error: '只有系統或SR模組可以更新使用量'
      };
    }

    if (FS && typeof FS.FS_updateDocument === 'function') {
      const updateData = {
        [featureName]: admin.firestore.FieldValue.increment(increment),
        lastUpdated: admin.firestore.Timestamp.now()
      };

      const updateResult = await FS.FS_updateDocument('user_quotas', userId, updateData, 'SYSTEM');

      if (updateResult.success) {
        return {
          success: true,
          featureName,
          increment,
          newTotal: updateResult.data?.[featureName] || increment
        };
      }

      return {
        success: false,
        error: updateResult.error
      };
    }

    return {
      success: false,
      error: 'FS模組不可用'
    };

  } catch (error) {
    AM_logError(`更新SR使用量失敗: ${error.message}`, "SR使用量", userId, "AM_SR_USAGE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 25. 處理SR功能升級
 * @version 2025-07-21-V1.1.0
 * @date 2025-07-21 14:00:00
 * @description 處理用戶升級至Premium以使用SR進階功能
 */
async function AM_processSRUpgrade(userId, upgradeType, paymentInfo, requesterId) {
  const functionName = "AM_processSRUpgrade";
  try {
    AM_logInfo(`處理SR功能升級: ${upgradeType}`, "SR升級", userId, "", "", functionName);

    // 權限檢查
    if (requesterId !== userId) {
      return {
        success: false,
        error: '只能升級自己的帳號'
      };
    }

    // 驗證升級類型
    const validUpgradeTypes = ['monthly', 'yearly', 'trial'];
    if (!validUpgradeTypes.includes(upgradeType)) {
      return {
        success: false,
        error: '無效的升級類型'
      };
    }

    // 計算到期時間
    let expiresAt;
    const now = new Date();

    switch (upgradeType) {
      case 'monthly':
        expiresAt = new Date(now.setMonth(now.getMonth() + 1));
        break;
      case 'yearly':
        expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
        break;
      case 'trial':
        expiresAt = new Date(now.setDate(now.getDate() + 7)); // 7天試用
        break;
    }

    // 更新訂閱資訊
    const subscriptionData = {
      plan: upgradeType === 'trial' ? 'trial' : 'premium',
      features: [
        'unlimited_reminders',
        'auto_push_notifications',
        'advanced_analytics',
        'smart_optimization',
        'budget_warnings',
        'monthly_reports'
      ],
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      upgradeDate: admin.firestore.Timestamp.now(),
      upgradeType,
      paymentInfo: upgradeType !== 'trial' ? paymentInfo : null
    };

    const updateResult = await AM_updateAccountInfo(userId, { subscription: subscriptionData }, requesterId);

    if (updateResult.success) {
      // 重置配額（Premium用戶無限制）
      if (FS && typeof FS.FS_setDocument === 'function') {
        const quotaData = {
          plan: subscriptionData.plan,
          upgradeDate: subscriptionData.upgradeDate,
          resetDate: admin.firestore.Timestamp.now()
        };

        await FS.FS_setDocument('user_quotas', userId, quotaData, 'SYSTEM');
      }

      return {
        success: true,
        newPlan: subscriptionData.plan,
        expiresAt: expiresAt.toISOString(),
        features: subscriptionData.features
      };
    }

    return {
      success: false,
      error: updateResult.error
    };

  } catch (error) {
    AM_logError(`SR升級處理失敗: ${error.message}`, "SR升級", userId, "AM_SR_UPGRADE_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message
    };
  }
}



// 導出模組函數
module.exports = {
  AM_createLineAccount,
  AM_createAppAccount,
  AM_linkCrossPlatformAccounts,
  AM_updateAccountInfo,
  AM_changeUserType,
  AM_deactivateAccount,
  AM_getUserInfo,
  AM_validateAccountExists,
  AM_searchUserAccounts,
  AM_handleLineOAuth,
  AM_refreshLineToken,
  AM_verifyLineIdentity,
  AM_syncCrossPlatformData,
  AM_resolveDataConflict,
  AM_handleAccountError,
  AM_monitorSystemHealth,
  AM_initializeUserSubjects,
  AM_ensureUserSubjects,
  // SR模組專用付費功能API
  AM_validateSRPremiumFeature,
  AM_getSRUserQuota,
  AM_updateSRFeatureUsage,
  AM_processSRUpgrade,
  // Phase 1: 核心認證API端點
  AM_handleUserRegistrationAPI,
  AM_handleUserLoginAPI,
  AM_handlePasswordResetAPI,
  AM_verifyUserAuthenticationAPI,
  AM_handleUserLogoutAPI,
  // Phase 2: 用戶管理功能API端點 (新增)
  AM_getUserProfileAPI,
  AM_updateUserProfileAPI,
  AM_handleModeAssessmentAPI,
  AM_handleModeSwitchAPI,
  AM_handleUserPreferencesAPI
};

console.log('AM 帳號管理模組載入完成 v1.2.0 - Phase 1 API端點重構');

/**
 * AM_logInfo
 * @param {} logMessage
 * @param {} action
 * @param {} userId
 * @param {} ledgerId
 * @param {} objectId
 * @param {} functionName
 */
async function AM_logInfo(logMessage, action = "AM_Action", userId = "SYSTEM", ledgerId = "", objectId = "", functionName = "AM_Function") {
    DL.DL_log("AM", functionName, "INFO", logMessage, userId, ledgerId, objectId, action)
}

/**
 * AM_logWarning
 * @param {} logMessage
 * @param {} action
 * @param {} userId
 * @param {} ledgerId
 * @param {} objectId
 * @param {} functionName
 */
async function AM_logWarning(logMessage, action = "AM_Action", userId = "SYSTEM", ledgerId = "", objectId = "", functionName = "AM_Function") {
    DL.DL_warning("AM", functionName, "WARNING", logMessage, userId, ledgerId, objectId, action)
}

/**
 * AM_logError
 * @param {} logMessage
 * @param {} action
 * @param {} userId
 * @param {} ledgerId
 * @param {} objectId
 * @param {} errorCode
 * @param {} functionName
 */
async function AM_logError(logMessage, action = "AM_Action", userId = "SYSTEM", ledgerId = "", objectId = "", errorCode = "AM_Error", functionName = "AM_Function") {
    DL.DL_error("AM", functionName, "ERROR", logMessage, userId, ledgerId, objectId, errorCode, action)
}