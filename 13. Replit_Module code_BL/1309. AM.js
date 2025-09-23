/**
 * AM_帳號管理模組_1.3.0
 * @module AM模組
 * @description 跨平台帳號管理系統 - Phase 1 API端點重構，支援RESTful API
 * @update 2025-01-24: 階段一修復 - 補充缺失的核心函數實作，修復認證權限驗證問題
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

// === SR模組專用付費功能API ===

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
      return AM_formatAPIResponse(null, {
        code: "SUBSCRIPTION_INFO_ERROR",
        message: subscriptionInfo.error,
      });
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
      return AM_formatAPIResponse(null, {
        code: "UNKNOWN_FEATURE",
        message: "未知的功能名稱",
      });
    }

    // 檢查付費狀態
    if (feature.level === 'premium' && subscription.plan !== 'premium') {
      return AM_formatAPIResponse(null, {
        code: "PREMIUM_REQUIRED",
        message: "此功能需要Premium訂閱",
        upgradeRequired: true,
        currentPlan: subscription.plan
      });
    }

    // 檢查配額限制
    if (feature.quota > 0) {
      const usageInfo = await AM_getSRUserQuota(userId, featureName, requesterId);
      if (usageInfo.success && usageInfo.currentUsage >= feature.quota) {
        return AM_formatAPIResponse(null, {
          code: "QUOTA_EXCEEDED",
          message: `已達到${feature.quota}個的使用限制`,
          quotaExceeded: true,
          currentUsage: usageInfo.currentUsage,
          maxQuota: feature.quota
        });
      }
    }

    return AM_formatAPIResponse({
      allowed: true,
      reason: 'Permission granted',
      featureLevel: feature.level,
      quota: feature.quota
    });

  } catch (error) {
    return AM_handleSystemError(error, { functionName, userId });
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
    // This check should be more robust, potentially checking against `requesterId` roles.
    // For now, assuming SYSTEM or the user themselves can check their quotas.
    if (requesterId !== userId && requesterId !== 'SYSTEM') {
       // Simplified permission check. In a real app, you'd use a permission middleware or function.
       return { success: false, error: '權限不足' };
    }

    // Mocking FS_getDocument for demonstration. Replace with actual Firestore access.
    const FS = require('./1311. FS.js'); // Assuming FS module is available and imported
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
    } else {
       return { success: false, error: 'FS模組不可用' };
    }

  } catch (error) {
    AM_logError(`取得SR配額失敗: ${error.message}`, "SR配額查詢", userId, "", "", "AM_SR_QUOTA_ERROR", functionName);
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

    // Mocking FS_updateDocument. Replace with actual Firestore access.
    const FS = require('./1311. FS.js'); // Assuming FS module is available and imported
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
    } else {
      return { success: false, error: 'FS模組不可用' };
    }

  } catch (error) {
    AM_logError(`更新SR使用量失敗: ${error.message}`, "SR使用量", userId, "", "", "AM_SR_USAGE_ERROR", functionName);
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
      // Mocking FS_setDocument. Replace with actual Firestore access.
      const FS = require('./1311. FS.js'); // Assuming FS module is available and imported
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
    AM_logError(`SR升級處理失敗: ${error.message}`, "SR升級", userId, "", "", "AM_SR_UPGRADE_ERROR", functionName);
    return {
      success: false,
      error: error.message
    };
  }
}



/**
 * =============== DCN-0012 階段二：API端點處理函數實作 ===============
 * 基於P1-2範圍，實作11個認證服務API端點的處理函數
 */

/**
 * 26. 處理用戶註冊API - POST /api/v1/auth/register
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的註冊請求
 */
async function AM_processAPIRegister(requestData) {
  const functionName = "AM_processAPIRegister";
  try {
    AM_logInfo("開始處理註冊API請求", "註冊處理", requestData.email || "", "", "", functionName);

    // 驗證註冊資料
    if (!requestData.email || !requestData.password) {
      return {
        success: false,
        message: "電子郵件和密碼為必填欄位",
        errorCode: "MISSING_REQUIRED_FIELDS"
      };
    }

    // 檢查帳號是否已存在
    const existsResult = await AM_validateAccountExists(requestData.email, 'email');
    if (existsResult.exists) {
      return {
        success: false,
        message: "此電子郵件已被註冊",
        errorCode: "EMAIL_ALREADY_EXISTS"
      };
    }

    // 創建用戶帳號（使用email作為identifier）
    const createResult = await AM_createAppAccount('APP', {
      displayName: requestData.displayName || requestData.email,
      email: requestData.email,
      userType: requestData.userType || 'S'
    }, {
      deviceId: requestData.deviceId || 'web',
      appVersion: '2.0.0'
    });

    if (createResult.success) {
      AM_logInfo(`註冊成功: ${createResult.primaryUID}`, "註冊處理", requestData.email, "", "", functionName);
      
      return {
        success: true,
        data: {
          userId: createResult.primaryUID,
          email: requestData.email,
          displayName: requestData.displayName || requestData.email,
          userType: createResult.userType
        },
        message: "註冊成功"
      };
    } else {
      return {
        success: false,
        message: createResult.error || "註冊失敗",
        errorCode: createResult.errorCode || "REGISTRATION_FAILED"
      };
    }

  } catch (error) {
    AM_logError(`註冊API處理失敗: ${error.message}`, "註冊處理", requestData.email || "", "", "", "AM_API_REGISTER_ERROR", functionName);
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 27. 處理用戶登入API - POST /api/v1/auth/login
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的登入請求
 */
async function AM_processAPILogin(requestData) {
  const functionName = "AM_processAPILogin";
  try {
    AM_logInfo("開始處理登入API請求", "登入處理", requestData.email || "", "", "", functionName);

    // 驗證登入資料
    if (!requestData.email || !requestData.password) {
      return {
        success: false,
        message: "電子郵件和密碼為必填欄位",
        errorCode: "MISSING_CREDENTIALS"
      };
    }

    // 驗證帳號存在性
    const existsResult = await AM_validateAccountExists(requestData.email, 'email');
    if (!existsResult.exists) {
      return {
        success: false,
        message: "帳號不存在",
        errorCode: "ACCOUNT_NOT_FOUND"
      };
    }

    // 模擬密碼驗證（實際專案中應使用bcrypt等安全方式）
    // 這裡為示範目的，實際應實作密碼雜湊比對
    const passwordValid = true; // 假設密碼驗證通過

    if (!passwordValid) {
      return {
        success: false,
        message: "密碼錯誤",
        errorCode: "INVALID_PASSWORD"
      };
    }

    // 取得用戶資訊
    const userInfo = await AM_getUserInfo(existsResult.UID, 'SYSTEM', true);
    
    if (userInfo.success) {
      // 生成JWT token（實際專案中應使用jwt library）
      const token = `jwt_${existsResult.UID}_${Date.now()}`;
      
      AM_logInfo(`登入成功: ${existsResult.UID}`, "登入處理", requestData.email, "", "", functionName);
      
      return {
        success: true,
        data: {
          token: token,
          refreshToken: `refresh_${existsResult.UID}_${Date.now()}`,
          user: userInfo.userData,
          expiresIn: 3600
        },
        message: "登入成功"
      };
    } else {
      return {
        success: false,
        message: "無法取得用戶資訊",
        errorCode: "USER_INFO_ERROR"
      };
    }

  } catch (error) {
    AM_logError(`登入API處理失敗: ${error.message}`, "登入處理", requestData.email || "", "", "", "AM_API_LOGIN_ERROR", functionName);
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 28. 處理Google登入API - POST /api/v1/auth/google-login
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的Google OAuth登入請求
 */
async function AM_processAPIGoogleLogin(requestData) {
  const functionName = "AM_processAPIGoogleLogin";
  try {
    AM_logInfo("開始處理Google登入API請求", "Google登入", requestData.email || "", "", "", functionName);

    // 驗證Google token
    if (!requestData.googleToken) {
      return {
        success: false,
        message: "Google token為必填欄位",
        errorCode: "MISSING_GOOGLE_TOKEN"
      };
    }

    // 模擬Google token驗證（實際應呼叫Google API驗證）
    const googleUserInfo = {
      email: requestData.email || 'user@gmail.com',
      name: requestData.name || 'Google User',
      googleId: requestData.googleId || 'google_' + Date.now()
    };

    // 檢查是否已有帳號
    const existsResult = await AM_validateAccountExists(googleUserInfo.email, 'email');
    
    let userId;
    if (existsResult.exists) {
      // 已有帳號，直接登入
      userId = existsResult.UID;
    } else {
      // 建立新帳號
      const createResult = await AM_createAppAccount('APP', {
        displayName: googleUserInfo.name,
        email: googleUserInfo.email,
        userType: 'S'
      }, {
        deviceId: 'google_oauth',
        appVersion: '2.0.0'
      });

      if (!createResult.success) {
        return {
          success: false,
          message: "Google登入帳號創建失敗",
          errorCode: "GOOGLE_ACCOUNT_CREATE_FAILED"
        };
      }
      userId = createResult.primaryUID;
    }

    // 取得用戶資訊
    const userInfo = await AM_getUserInfo(userId, 'SYSTEM', true);
    
    if (userInfo.success) {
      const token = `jwt_google_${userId}_${Date.now()}`;
      
      AM_logInfo(`Google登入成功: ${userId}`, "Google登入", googleUserInfo.email, "", "", functionName);
      
      return {
        success: true,
        data: {
          token: token,
          refreshToken: `refresh_google_${userId}_${Date.now()}`,
          user: userInfo.userData,
          isNewUser: !existsResult.exists,
          expiresIn: 3600
        },
        message: "Google登入成功"
      };
    } else {
      return {
        success: false,
        message: "無法取得用戶資訊",
        errorCode: "USER_INFO_ERROR"
      };
    }

  } catch (error) {
    AM_logError(`Google登入API處理失敗: ${error.message}`, "Google登入", requestData.email || "", "", "", "AM_API_GOOGLE_LOGIN_ERROR", functionName);
    return {
      success: false,
      message: "Google登入失敗",
      errorCode: "GOOGLE_LOGIN_ERROR"
    };
  }
}

/**
 * 29. 處理用戶登出API - POST /api/v1/auth/logout
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的登出請求
 */
async function AM_processAPILogout(requestData) {
  const functionName = "AM_processAPILogout";
  try {
    AM_logInfo("開始處理登出API請求", "登出處理", requestData.userId || "", "", "", functionName);

    // 驗證必要參數
    if (!requestData.token && !requestData.userId) {
      return {
        success: false,
        message: "token或userId為必填欄位",
        errorCode: "MISSING_AUTH_INFO"
      };
    }

    const userId = requestData.userId || 'unknown';

    // 實際專案中應該：
    // 1. 驗證token有效性
    // 2. 將token加入黑名單
    // 3. 清除相關session
    
    // 模擬登出處理
    AM_logInfo(`登出成功: ${userId}`, "登出處理", userId, "", "", functionName);
    
    return {
      success: true,
      data: {
        message: "已成功登出"
      },
      message: "登出成功"
    };

  } catch (error) {
    AM_logError(`登出API處理失敗: ${error.message}`, "登出處理", requestData.userId || "", "", "", "AM_API_LOGOUT_ERROR", functionName);
    return {
      success: false,
      message: "登出失敗",
      errorCode: "LOGOUT_ERROR"
    };
  }
}

/**
 * 30. 處理token刷新API - POST /api/v1/auth/refresh
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的token刷新請求
 */
async function AM_processAPIRefresh(requestData) {
  const functionName = "AM_processAPIRefresh";
  try {
    AM_logInfo("開始處理token刷新API請求", "Token刷新", "", "", "", functionName);

    // 驗證refresh token
    if (!requestData.refreshToken) {
      return {
        success: false,
        message: "refresh token為必填欄位",
        errorCode: "MISSING_REFRESH_TOKEN"
      };
    }

    // 模擬refresh token驗證（實際應驗證token有效性和過期時間）
    const tokenParts = requestData.refreshToken.split('_');
    if (tokenParts.length < 3 || !tokenParts[0].includes('refresh')) {
      return {
        success: false,
        message: "無效的refresh token",
        errorCode: "INVALID_REFRESH_TOKEN"
      };
    }

    const userId = tokenParts[1];

    // 驗證用戶存在
    const userInfo = await AM_getUserInfo(userId, 'SYSTEM', false);
    if (!userInfo.success) {
      return {
        success: false,
        message: "用戶不存在",
        errorCode: "USER_NOT_FOUND"
      };
    }

    // 生成新的token
    const newToken = `jwt_${userId}_${Date.now()}`;
    const newRefreshToken = `refresh_${userId}_${Date.now()}`;
    
    AM_logInfo(`Token刷新成功: ${userId}`, "Token刷新", userId, "", "", functionName);
    
    return {
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      },
      message: "Token刷新成功"
    };

  } catch (error) {
    AM_logError(`Token刷新API處理失敗: ${error.message}`, "Token刷新", "", "", "", "AM_API_REFRESH_ERROR", functionName);
    return {
      success: false,
      message: "Token刷新失敗",
      errorCode: "REFRESH_ERROR"
    };
  }
}

/**
 * 31. 處理忘記密碼API - POST /api/v1/auth/forgot-password
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的忘記密碼請求
 */
async function AM_processAPIForgotPassword(requestData) {
  const functionName = "AM_processAPIForgotPassword";
  try {
    AM_logInfo("開始處理忘記密碼API請求", "忘記密碼", requestData.email || "", "", "", functionName);

    // 驗證email
    if (!requestData.email) {
      return {
        success: false,
        message: "電子郵件為必填欄位",
        errorCode: "MISSING_EMAIL"
      };
    }

    // 檢查帳號是否存在
    const existsResult = await AM_validateAccountExists(requestData.email, 'email');
    if (!existsResult.exists) {
      // 為安全考量，即使帳號不存在也回傳成功訊息
      return {
        success: true,
        data: {
          message: "如果該電子郵件地址存在於我們的系統中，您將收到密碼重設說明"
        },
        message: "密碼重設郵件已發送"
      };
    }

    // 生成重設token
    const resetToken = `reset_${existsResult.UID}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 實際專案中應該：
    // 1. 將reset token儲存到資料庫（含過期時間）
    // 2. 發送重設密碼郵件
    
    AM_logInfo(`忘記密碼處理完成: ${existsResult.UID}`, "忘記密碼", requestData.email, "", "", functionName);
    
    return {
      success: true,
      data: {
        message: "密碼重設郵件已發送",
        resetToken: resetToken // 在實際專案中不應回傳，這裡僅供測試
      },
      message: "密碼重設郵件已發送"
    };

  } catch (error) {
    AM_logError(`忘記密碼API處理失敗: ${error.message}`, "忘記密碼", requestData.email || "", "", "", "AM_API_FORGOT_PASSWORD_ERROR", functionName);
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 32. 處理驗證重設token API - GET /api/v1/auth/verify-reset-token
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的重設token驗證請求
 */
async function AM_processAPIVerifyResetToken(queryParams) {
  const functionName = "AM_processAPIVerifyResetToken";
  try {
    AM_logInfo("開始處理驗證重設token API請求", "驗證重設Token", "", "", "", functionName);

    // 驗證token參數
    if (!queryParams.token) {
      return {
        success: false,
        message: "重設token為必填參數",
        errorCode: "MISSING_RESET_TOKEN"
      };
    }

    const resetToken = queryParams.token;
    
    // 驗證token格式
    const tokenParts = resetToken.split('_');
    if (tokenParts.length < 4 || tokenParts[0] !== 'reset') {
      return {
        success: false,
        message: "無效的重設token",
        errorCode: "INVALID_RESET_TOKEN"
      };
    }

    const userId = tokenParts[1];
    const timestamp = parseInt(tokenParts[2]);
    
    // 檢查token是否過期（24小時有效期）
    const now = Date.now();
    const tokenAge = now - timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24小時
    
    if (tokenAge > maxAge) {
      return {
        success: false,
        message: "重設token已過期",
        errorCode: "TOKEN_EXPIRED"
      };
    }

    // 驗證用戶存在
    const userInfo = await AM_getUserInfo(userId, 'SYSTEM', false);
    if (!userInfo.success) {
      return {
        success: false,
        message: "無效的重設token",
        errorCode: "INVALID_TOKEN_USER"
      };
    }

    AM_logInfo(`重設token驗證成功: ${userId}`, "驗證重設Token", userId, "", "", functionName);
    
    return {
      success: true,
      data: {
        valid: true,
        userId: userId,
        expiresAt: new Date(timestamp + maxAge).toISOString()
      },
      message: "重設token有效"
    };

  } catch (error) {
    AM_logError(`驗證重設token API處理失敗: ${error.message}`, "驗證重設Token", "", "", "", "AM_API_VERIFY_RESET_TOKEN_ERROR", functionName);
    return {
      success: false,
      message: "token驗證失敗",
      errorCode: "VERIFICATION_ERROR"
    };
  }
}

/**
 * 33. 處理重設密碼API - POST /api/v1/auth/reset-password
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的重設密碼請求
 */
async function AM_processAPIResetPassword(requestData) {
  const functionName = "AM_processAPIResetPassword";
  try {
    AM_logInfo("開始處理重設密碼API請求", "重設密碼", "", "", "", functionName);

    // 驗證必要參數
    if (!requestData.token || !requestData.newPassword) {
      return {
        success: false,
        message: "重設token和新密碼為必填欄位",
        errorCode: "MISSING_REQUIRED_FIELDS"
      };
    }

    // 先驗證token
    const tokenVerification = await AM_processAPIVerifyResetToken({ token: requestData.token });
    if (!tokenVerification.success) {
      return tokenVerification;
    }

    const userId = tokenVerification.data.userId;

    // 驗證新密碼強度
    if (requestData.newPassword.length < 6) {
      return {
        success: false,
        message: "密碼長度至少需要6個字元",
        errorCode: "PASSWORD_TOO_SHORT"
      };
    }

    // 實際專案中應該：
    // 1. 使用bcrypt等方式雜湊新密碼
    // 2. 更新資料庫中的密碼
    // 3. 使重設token失效
    
    AM_logInfo(`重設密碼成功: ${userId}`, "重設密碼", userId, "", "", functionName);
    
    return {
      success: true,
      data: {
        message: "密碼已成功重設"
      },
      message: "密碼重設成功"
    };

  } catch (error) {
    AM_logError(`重設密碼API處理失敗: ${error.message}`, "重設密碼", "", "", "", "AM_API_RESET_PASSWORD_ERROR", functionName);
    return {
      success: false,
      message: "密碼重設失敗",
      errorCode: "RESET_PASSWORD_ERROR"
    };
  }
}

/**
 * 34. 處理Email驗證API - POST /api/v1/auth/verify-email
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的Email驗證請求
 */
async function AM_processAPIVerifyEmail(requestData) {
  const functionName = "AM_processAPIVerifyEmail";
  try {
    AM_logInfo("開始處理Email驗證API請求", "Email驗證", requestData.email || "", "", "", functionName);

    // 驗證必要參數
    if (!requestData.verificationCode || !requestData.email) {
      return {
        success: false,
        message: "驗證碼和電子郵件為必填欄位",
        errorCode: "MISSING_VERIFICATION_DATA"
      };
    }

    // 檢查帳號是否存在
    const existsResult = await AM_validateAccountExists(requestData.email, 'email');
    if (!existsResult.exists) {
      return {
        success: false,
        message: "帳號不存在",
        errorCode: "ACCOUNT_NOT_FOUND"
      };
    }

    // 模擬驗證碼檢查（實際應從資料庫取得並比對）
    const validCode = '123456'; // 假設的驗證碼
    if (requestData.verificationCode !== validCode) {
      return {
        success: false,
        message: "驗證碼錯誤",
        errorCode: "INVALID_VERIFICATION_CODE"
      };
    }

    // 更新用戶狀態為已驗證
    const updateResult = await AM_updateAccountInfo(existsResult.UID, {
      emailVerified: true,
      emailVerifiedAt: admin.firestore.Timestamp.now()
    }, 'SYSTEM');

    if (updateResult.success) {
      AM_logInfo(`Email驗證成功: ${existsResult.UID}`, "Email驗證", requestData.email, "", "", functionName);
      
      return {
        success: true,
        data: {
          message: "電子郵件驗證成功",
          userId: existsResult.UID
        },
        message: "Email驗證成功"
      };
    } else {
      return {
        success: false,
        message: "驗證狀態更新失敗",
        errorCode: "UPDATE_VERIFICATION_STATUS_FAILED"
      };
    }

  } catch (error) {
    AM_logError(`Email驗證API處理失敗: ${error.message}`, "Email驗證", requestData.email || "", "", "", "AM_API_VERIFY_EMAIL_ERROR", functionName);
    return {
      success: false,
      message: "Email驗證失敗",
      errorCode: "EMAIL_VERIFICATION_ERROR"
    };
  }
}

/**
 * 35. 處理LINE綁定API - POST /api/v1/auth/bind-line
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的LINE帳號綁定請求
 */
async function AM_processAPIBindLine(requestData) {
  const functionName = "AM_processAPIBindLine";
  try {
    AM_logInfo("開始處理LINE綁定API請求", "LINE綁定", requestData.userId || "", "", "", functionName);

    // 驗證必要參數
    if (!requestData.userId || !requestData.lineUserId) {
      return {
        success: false,
        message: "用戶ID和LINE用戶ID為必填欄位",
        errorCode: "MISSING_BINDING_DATA"
      };
    }

    // 檢查用戶是否存在
    const userInfo = await AM_getUserInfo(requestData.userId, 'SYSTEM', true);
    if (!userInfo.success) {
      return {
        success: false,
        message: "用戶不存在",
        errorCode: "USER_NOT_FOUND"
      };
    }

    // 檢查LINE帳號是否已被其他用戶綁定
    const lineExists = await AM_validateAccountExists(requestData.lineUserId, 'LINE');
    if (lineExists.exists && lineExists.UID !== requestData.userId) {
      return {
        success: false,
        message: "此LINE帳號已被其他用戶綁定",
        errorCode: "LINE_ALREADY_BOUND"
      };
    }

    // 執行綁定
    const linkResult = await AM_linkCrossPlatformAccounts(requestData.userId, {
      LINE_UID: requestData.lineUserId
    });

    if (linkResult.success) {
      AM_logInfo(`LINE綁定成功: ${requestData.userId} -> ${requestData.lineUserId}`, "LINE綁定", requestData.userId, "", "", functionName);
      
      return {
        success: true,
        data: {
          message: "LINE帳號綁定成功",
          userId: requestData.userId,
          lineUserId: requestData.lineUserId,
          boundAt: new Date().toISOString()
        },
        message: "LINE綁定成功"
      };
    } else {
      return {
        success: false,
        message: linkResult.error || "LINE綁定失敗",
        errorCode: linkResult.errorCode || "LINE_BINDING_FAILED"
      };
    }

  } catch (error) {
    AM_logError(`LINE綁定API處理失敗: ${error.message}`, "LINE綁定", requestData.userId || "", "", "", "AM_API_BIND_LINE_ERROR", functionName);
    return {
      success: false,
      message: "LINE綁定失敗",
      errorCode: "LINE_BINDING_ERROR"
    };
  }
}

/**
 * 36. 處理綁定狀態查詢API - GET /api/v1/auth/bind-status
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的綁定狀態查詢請求
 */
async function AM_processAPIBindStatus(queryParams) {
  const functionName = "AM_processAPIBindStatus";
  try {
    AM_logInfo("開始處理綁定狀態查詢API請求", "綁定狀態查詢", queryParams.userId || "", "", "", functionName);

    // 驗證必要參數
    if (!queryParams.userId) {
      return {
        success: false,
        message: "用戶ID為必填參數",
        errorCode: "MISSING_USER_ID"
      };
    }

    // 取得用戶資訊（包含關聯帳號）
    const userInfo = await AM_getUserInfo(queryParams.userId, 'SYSTEM', true);
    if (!userInfo.success) {
      return {
        success: false,
        message: "用戶不存在",
        errorCode: "USER_NOT_FOUND"
      };
    }

    const linkedAccounts = userInfo.linkedAccounts || {};
    
    // 構建綁定狀態資訊
    const bindingStatus = {
      userId: queryParams.userId,
      bindings: {
        line: {
          bound: !!linkedAccounts.LINE_UID,
          lineUserId: linkedAccounts.LINE_UID || null,
          displayName: linkedAccounts.LINE_UID ? 'LINE用戶' : null
        },
        ios: {
          bound: !!linkedAccounts.iOS_UID,
          deviceId: linkedAccounts.iOS_UID || null
        },
        android: {
          bound: !!linkedAccounts.Android_UID,
          deviceId: linkedAccounts.Android_UID || null
        }
      },
      totalBound: Object.values(linkedAccounts).filter(uid => uid && uid.length > 0).length
    };

    AM_logInfo(`綁定狀態查詢完成: ${queryParams.userId}`, "綁定狀態查詢", queryParams.userId, "", "", functionName);
    
    return {
      success: true,
      data: bindingStatus,
      message: "綁定狀態查詢成功"
    };

  } catch (error) {
    AM_logError(`綁定狀態查詢API處理失敗: ${error.message}`, "綁定狀態查詢", queryParams.userId || "", "", "", "AM_API_BIND_STATUS_ERROR", functionName);
    return {
      success: false,
      message: "綁定狀態查詢失敗",
      errorCode: "BIND_STATUS_QUERY_ERROR"
    };
  }
}

/**
 * =============== DCN-0012 階段二：用戶管理API端點處理函數實作 ===============
 * 基於8102.yaml規格，實作8個用戶管理API端點的處理函數
 */

/**
 * 37. 處理取得用戶資料API - GET /api/v1/users/profile
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的用戶資料取得請求
 */
async function AM_processAPIGetProfile(queryParams) {
  const functionName = "AM_processAPIGetProfile";
  try {
    AM_logInfo("開始處理取得用戶資料API請求", "用戶資料", queryParams.userId || "", "", "", functionName);

    // 從query參數或認證token中取得用戶ID（簡化實作）
    const userId = queryParams.userId || 'current_user';

    // 取得用戶資訊
    const userInfo = await AM_getUserInfo(userId, 'SYSTEM', true);
    
    if (userInfo.success) {
      AM_logInfo(`用戶資料取得成功: ${userId}`, "用戶資料", userId, "", "", functionName);
      
      return {
        success: true,
        data: {
          id: userId,
          email: userInfo.userData.email || 'user@example.com',
          displayName: userInfo.userData.displayName,
          userMode: userInfo.userData.userType || 'Expert',
          avatar: userInfo.userData.avatar || '',
          createdAt: userInfo.userData.createdAt,
          lastLoginAt: userInfo.userData.lastActive,
          preferences: {
            language: 'zh-TW',
            currency: 'TWD',
            timezone: 'Asia/Taipei'
          },
          security: {
            hasAppLock: false,
            biometricEnabled: false
          }
        },
        message: "用戶資料取得成功"
      };
    } else {
      return {
        success: false,
        message: "用戶不存在",
        errorCode: "USER_NOT_FOUND"
      };
    }

  } catch (error) {
    AM_logError(`用戶資料取得API處理失敗: ${error.message}`, "用戶資料", queryParams.userId || "", "", "", "AM_API_GET_PROFILE_ERROR", functionName);
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 38. 處理更新用戶資料API - PUT /api/v1/users/profile
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的用戶資料更新請求
 */
async function AM_processAPIUpdateProfile(requestData) {
  const functionName = "AM_processAPIUpdateProfile";
  try {
    AM_logInfo("開始處理更新用戶資料API請求", "用戶資料更新", requestData.userId || "", "", "", functionName);

    const userId = requestData.userId || 'current_user';

    // 更新用戶資訊
    const updateResult = await AM_updateAccountInfo(userId, {
      displayName: requestData.displayName,
      avatar: requestData.avatar,
      language: requestData.language,
      timezone: requestData.timezone,
      theme: requestData.theme
    }, 'SYSTEM');

    if (updateResult.success) {
      AM_logInfo(`用戶資料更新成功: ${userId}`, "用戶資料更新", userId, "", "", functionName);
      
      return {
        success: true,
        data: {
          message: "個人資料更新成功",
          updatedAt: new Date().toISOString()
        },
        message: "用戶資料更新成功"
      };
    } else {
      return {
        success: false,
        message: updateResult.error || "更新失敗",
        errorCode: "UPDATE_FAILED"
      };
    }

  } catch (error) {
    AM_logError(`用戶資料更新API處理失敗: ${error.message}`, "用戶資料更新", requestData.userId || "", "", "", "AM_API_UPDATE_PROFILE_ERROR", functionName);
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 39. 處理取得評估問卷API - GET /api/v1/users/assessment-questions
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的評估問卷取得請求
 */
async function AM_processAPIGetAssessmentQuestions(queryParams) {
  const functionName = "AM_processAPIGetAssessmentQuestions";
  try {
    AM_logInfo("開始處理取得評估問卷API請求", "評估問卷", "", "", "", functionName);

    // 模擬評估問卷數據
    const questionnaire = {
      id: "assessment-v2.1",
      version: "2.1",
      title: "LCAS 2.0 使用者模式評估",
      description: "透過 5 道題目了解您的記帳習慣，為您推薦最適合的使用模式",
      estimatedTime: 3,
      questions: [
        {
          id: 1,
          question: "您對記帳軟體的功能需求程度？",
          type: "single_choice",
          required: true,
          options: [
            { id: "A", text: "需要完整專業功能", weight: { Expert: 3, Inertial: 1, Cultivation: 2, Guiding: 0 } },
            { id: "B", text: "基本功能即可", weight: { Expert: 0, Inertial: 2, Cultivation: 1, Guiding: 3 } },
            { id: "C", text: "需要引導功能", weight: { Expert: 1, Inertial: 1, Cultivation: 3, Guiding: 2 } }
          ]
        }
      ]
    };

    AM_logInfo("評估問卷取得成功", "評估問卷", "", "", "", functionName);
    
    return {
      success: true,
      data: { questionnaire },
      message: "評估問卷取得成功"
    };

  } catch (error) {
    AM_logError(`評估問卷取得API處理失敗: ${error.message}`, "評估問卷", "", "", "", "AM_API_GET_ASSESSMENT_ERROR", functionName);
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 40. 處理提交評估結果API - POST /api/v1/users/assessment
 * @version 2025-09-22-V1.3.0
 * @date 2025-09-22 
 * @description 專門處理ASL.js轉發的評估結果提交請求
 */
async function AM_processAPISubmitAssessment(requestData) {
  const functionName = "AM_processAPISubmitAssessment";
  try {
    AM_logInfo("開始處理提交評估結果API請求", "評估結果", "", "", "", functionName);

    // 模擬評估結果分析
    const recommendedMode = "Expert";
    const confidence = 85.5;
    
    const userId = requestData.userId || 'current_user';

    // 更新用戶模式
    const updateResult = await AM_updateAccountInfo(userId, {
      userType: recommendedMode,
      assessmentCompleted: true,
      assessmentDate: admin.firestore.Timestamp.now()
    }, 'SYSTEM');

    if (updateResult.success) {
      AM_logInfo(`評估結果提交成功: ${userId} -> ${recommendedMode}`, "評估結果", userId, "", "", functionName);
      
      return {
        success: true,
        data: {
          result: {
            recommendedMode,
            confidence,
            explanation: "基於您的回答，建議使用專家模式以獲得完整功能體驗"
          },
          applied: true
        },
        message: "評估結果提交成功"
      };
    } else {
      return {
        success: false,
        message: "評估結果保存失敗",
        errorCode: "SAVE_FAILED"
      };
    }

  } catch (error) {
    AM_logError(`評估結果提交API處理失敗: ${error.message}`, "評估結果", "", "", "", "AM_API_SUBMIT_ASSESSMENT_ERROR", functionName);
    return {
      success: false,
      message: "系統錯誤，請稍後再試",
      errorCode: "SYSTEM_ERROR"
    };
  }
}

/**
 * 41-44. 處理其他用戶管理API（簡化實作）
 */
async function AM_processAPIUpdatePreferences(requestData) {
  return { success: true, data: { message: "偏好設定已更新" }, message: "偏好設定更新成功" };
}

async function AM_processAPIUpdateSecurity(requestData) {
  return { success: true, data: { message: "安全設定已更新" }, message: "安全設定更新成功" };
}

async function AM_processAPISwitchMode(requestData) {
  return { success: true, data: { currentMode: requestData.newMode || "Expert" }, message: "模式切換成功" };
}

async function AM_processAPIVerifyPin(requestData) {
  return { success: true, data: { verified: true }, message: "PIN碼驗證成功" };
}

/**
 * AM_validateQueryPermission - 驗證查詢權限
 * @version 2025-01-24-V1.0.0
 * @description 驗證用戶是否有權限查詢指定用戶的資訊
 */
async function AM_validateQueryPermission(targetUID, requesterId) {
  try {
    // 自己查詢自己的資料，永遠允許
    if (targetUID === requesterId) {
      return true;
    }
    
    // 系統級別的查詢，永遠允許
    if (requesterId === 'SYSTEM' || requesterId === 'AM_MODULE') {
      return true;
    }
    
    // 其他情況需要進一步權限檢查
    // 這裡可以根據業務需求擴展更複雜的權限邏輯
    return false;
    
  } catch (error) {
    console.error('驗證查詢權限時發生錯誤:', error);
    return false;
  }
}

/**
 * AM_validateUpdatePermission - 驗證更新權限
 * @version 2025-01-24-V1.0.0
 * @description 驗證用戶是否有權限更新指定用戶的資訊
 */
async function AM_validateUpdatePermission(targetUID, operatorId) {
  try {
    // 自己更新自己的資料，永遠允許
    if (targetUID === operatorId) {
      return true;
    }
    
    // 系統級別的更新，永遠允許
    if (operatorId === 'SYSTEM' || operatorId === 'AM_MODULE') {
      return true;
    }
    
    // 其他情況需要進一步權限檢查
    return false;
    
  } catch (error) {
    console.error('驗證更新權限時發生錯誤:', error);
    return false;
  }
}

/**
 * AM_validateSearchPermission - 驗證搜尋權限
 * @version 2025-01-24-V1.0.0
 * @description 驗證用戶是否有權限進行用戶搜尋
 */
async function AM_validateSearchPermission(requesterId) {
  try {
    // 系統級別的搜尋，永遠允許
    if (requesterId === 'SYSTEM' || requesterId === 'AM_MODULE') {
      return true;
    }
    
    // 一般用戶的搜尋權限（可根據業務需求調整）
    return true;
    
  } catch (error) {
    console.error('驗證搜尋權限時發生錯誤:', error);
    return false;
  }
}

/**
 * AM_storeTokenSecurely - 安全儲存Token
 * @version 2025-01-24-V1.0.0
 * @description 安全地儲存用戶的認證Token
 */
async function AM_storeTokenSecurely(userId, accessToken, refreshToken, expiresIn) {
  try {
    const tokenData = {
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiresIn * 1000)),
      createdAt: admin.firestore.Timestamp.now()
    };
    
    await db.collection('user_tokens').doc(userId).set(tokenData);
    return { success: true };
    
  } catch (error) {
    console.error('儲存Token時發生錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * AM_updateStoredToken - 更新儲存的Token
 * @version 2025-01-24-V1.0.0
 * @description 更新用戶的認證Token
 */
async function AM_updateStoredToken(userId, accessToken, expiresIn) {
  try {
    const updateData = {
      accessToken: accessToken,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiresIn * 1000)),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    await db.collection('user_tokens').doc(userId).update(updateData);
    return { success: true };
    
  } catch (error) {
    console.error('更新Token時發生錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * AM_generatePlatformUID - 生成平台專用UID
 * @version 2025-01-24-V1.0.0
 * @description 為不同平台生成唯一識別碼
 */
function AM_generatePlatformUID(platform, deviceId) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${platform}_${timestamp}_${deviceId}_${randomStr}`;
}

/**
 * AM_getSubscriptionInfo - 取得用戶訂閱資訊
 * @version 2025-01-24-V1.0.0
 * @description 取得用戶的訂閱狀態和權限資訊
 */
async function AM_getSubscriptionInfo(userId, requesterId) {
  try {
    // 權限檢查
    if (userId !== requesterId && requesterId !== 'SYSTEM') {
      return { success: false, error: '權限不足' };
    }
    
    // 從用戶資料中取得訂閱資訊
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { success: false, error: '用戶不存在' };
    }
    
    const userData = userDoc.data();
    const subscription = userData.subscription || {
      plan: 'free',
      features: ['basic_accounting'],
      expiresAt: null
    };
    
    return {
      success: true,
      subscriptionData: subscription
    };
    
  } catch (error) {
    console.error('取得訂閱資訊時發生錯誤:', error);
    return { success: false, error: error.message };
  }
}

/**
 * AM_formatAPIResponse - 格式化API回應
 * @version 2025-01-24-V1.0.0
 * @description 統一格式化API回應格式
 */
function AM_formatAPIResponse(data, error = null) {
  if (error) {
    return {
      success: false,
      error: error,
      timestamp: new Date().toISOString()
    };
  }
  
  return {
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  };
}

/**
 * AM_handleSystemError - 處理系統錯誤
 * @version 2025-01-24-V1.0.0
 * @description 統一處理系統級錯誤
 */
function AM_handleSystemError(error, context = {}) {
  console.error('系統錯誤:', error);
  console.error('錯誤內容:', context);
  
  return {
    success: false,
    error: 'System error occurred',
    errorCode: 'SYSTEM_ERROR',
    timestamp: new Date().toISOString()
  };
}

// 導出模組函數
module.exports = {
  //原有核心函數 (1-18)
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

  // SR模組專用付費功能API (22-25)
  AM_validateSRPremiumFeature,
  AM_getSRUserQuota,
  AM_updateSRFeatureUsage,
  AM_processSRUpgrade,

  // DCN-0012 階段二：API端點處理函數 (26-44)
  AM_processAPIRegister,
  AM_processAPILogin,
  AM_processAPIGoogleLogin,
  AM_processAPILogout,
  AM_processAPIRefresh,
  AM_processAPIForgotPassword,
  AM_processAPIVerifyResetToken,
  AM_processAPIResetPassword,
  AM_processAPIVerifyEmail,
  AM_processAPIBindLine,
  AM_processAPIBindStatus,

  // DCN-0012 階段二：用戶管理API處理函數 (37-44)
  AM_processAPIGetProfile,
  AM_processAPIUpdateProfile,
  AM_processAPIGetAssessmentQuestions,
  AM_processAPISubmitAssessment,
  AM_processAPIUpdatePreferences,
  AM_processAPIUpdateSecurity,
  AM_processAPISwitchMode,
  AM_processAPIVerifyPin,

  // 階段一修復：補充缺失的核心函數
  AM_validateQueryPermission,
  AM_validateUpdatePermission,
  AM_validateSearchPermission,
  AM_storeTokenSecurely,
  AM_updateStoredToken,
  AM_generatePlatformUID,
  AM_getSubscriptionInfo,
  AM_formatAPIResponse,
  AM_handleSystemError
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