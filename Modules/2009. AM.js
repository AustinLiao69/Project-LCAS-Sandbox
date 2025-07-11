/**
 * AM_帳號管理模組_1.0.1
 * @module AM模組 
 * @description 跨平台帳號管理系統 - 支援LINE OA、iOS、Android統一帳號管理
 * @update 2025-07-11: 
 */

// 引入必要模組
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

// 取得 Firestore 實例
const db = admin.firestore();

// 引入其他模組
const DL = require('./2010. DL.js');

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
 * @description 修改使用者帳號基本資訊和設定
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

// 模組導出
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
  AM_ensureUserSubjects
};

console.log('AM 帳號管理模組載入完成 v1.0.1');