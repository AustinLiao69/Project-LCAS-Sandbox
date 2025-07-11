/**
 * CM_協作管理模組_1.0.0
 * @module CM模組 
 * @description 協作管理系統 - 支援多用戶權限管理、即時同步與協作通知
 * @update 2025-07-07: 初版建立，實現完整協作生態系統
 */

const admin = require('firebase-admin');
const WebSocket = require('ws');

// 引入依賴模組
let DL, MLS, AM, DD, BK, LINE_OA;
try {
  DL = require('./2010. DL.js');
  // MLS = require('./2051. MLS.js');
  // AM = require('./2001. AM.js');
  DD = require('./2031. DD.js');
  BK = require('./2001. BK.js');
  // LINE_OA = require('./2071. LINE_OA.js');
} catch (error) {
  console.warn('CM模組依賴載入警告:', error.message);
}

// Firestore 資料庫連接
const db = admin.firestore();

// 模組初始化狀態
const CM_INIT_STATUS = {
  initialized: false,
  firestoreConnected: false,
  websocketServer: null,
  activeConnections: new Map(),
  lastInitTime: null
};

// 權限等級設定
const CM_PERMISSION_LEVELS = {
  owner: {
    level: 4,
    actions: ["all"]
  },
  admin: {
    level: 3,
    actions: ["invite", "remove", "edit", "view", "manage_permissions"]
  },
  member: {
    level: 2,
    actions: ["edit", "view", "invite_limited"]
  },
  viewer: {
    level: 1,
    actions: ["view"]
  }
};

// WebSocket 事件類型
const CM_WEBSOCKET_EVENTS = {
  MEMBER_JOINED: 'collaboration:member_joined',
  MEMBER_LEFT: 'collaboration:member_left',
  PERMISSION_CHANGED: 'collaboration:permission_changed',
  DATA_UPDATED: 'collaboration:data_updated',
  CONFLICT_DETECTED: 'collaboration:conflict_detected',
  SYNC_REQUIRED: 'collaboration:sync_required',
  NOTIFICATION: 'collaboration:notification'
};

/**
 * 日誌函數封裝
 */
function CM_logInfo(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_info === 'function') {
    DL.DL_info(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.log(`[CM-INFO] ${message}`);
  }
}

function CM_logError(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_error === 'function') {
    DL.DL_error(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.error(`[CM-ERROR] ${message}`, errorDetails);
  }
}

function CM_logWarning(message, operation, userId, errorCode = "", errorDetails = "", functionName = "") {
  if (DL && typeof DL.DL_warning === 'function') {
    DL.DL_warning(message, operation, userId, errorCode, errorDetails, 0, functionName, functionName);
  } else {
    console.warn(`[CM-WARNING] ${message}`);
  }
}

/**
 * 01. 邀請成員加入帳本
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 邀請新成員加入指定帳本並設定初始權限
 */
async function CM_inviteMember(ledgerId, inviterId, inviteeInfo, initialPermission) {
  const functionName = "CM_inviteMember";
  try {
    CM_logInfo(`開始邀請成員加入帳本: ${ledgerId}`, "邀請成員", inviterId, "", "", functionName);

    // 驗證邀請者權限
    const hasPermission = await CM_validatePermission(ledgerId, inviterId, "invite");
    if (!hasPermission.hasPermission) {
      throw new Error(`權限不足：需要 ${hasPermission.requiredLevel} 權限`);
    }

    // 生成邀請ID
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 建立邀請記錄
    const invitationData = {
      invitationId,
      ledgerId,
      inviterId,
      inviteeInfo,
      permissionLevel: initialPermission,
      status: "pending",
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7天後過期
    };

    // 儲存到 Firestore
    await db.collection('member_invitations').doc(invitationId).set(invitationData);

    // 發送邀請通知 (如果 LINE OA 模組可用)
    if (LINE_OA && typeof LINE_OA.sendInvitationNotification === 'function') {
      await LINE_OA.sendInvitationNotification(inviteeInfo, invitationData);
    }

    CM_logInfo(`成員邀請建立成功: ${invitationId}`, "邀請成員", inviterId, "", "", functionName);
    
    return {
      success: true,
      invitationId,
      message: "邀請已發送"
    };

  } catch (error) {
    CM_logError(`邀請成員失敗: ${error.message}`, "邀請成員", inviterId, "CM_INVITE_ERROR", error.toString(), functionName);
    return {
      success: false,
      invitationId: null,
      message: error.message
    };
  }
}

/**
 * 02. 處理成員加入請求
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 處理用戶接受邀請或申請加入帳本
 */
async function CM_processMemberJoin(invitationId, userId, responseType) {
  const functionName = "CM_processMemberJoin";
  try {
    CM_logInfo(`處理成員加入請求: ${invitationId}`, "處理加入", userId, "", "", functionName);

    // 取得邀請資訊
    const invitationDoc = await db.collection('member_invitations').doc(invitationId).get();
    if (!invitationDoc.exists) {
      throw new Error("邀請不存在或已過期");
    }

    const invitationData = invitationDoc.data();
    
    // 檢查邀請狀態
    if (invitationData.status !== "pending") {
      throw new Error(`邀請狀態無效: ${invitationData.status}`);
    }

    // 檢查是否過期
    if (invitationData.expiresAt.toDate() < new Date()) {
      throw new Error("邀請已過期");
    }

    if (responseType === "accept") {
      // 接受邀請 - 加入協作
      const memberId = `member_${Date.now()}_${userId}`;
      
      // 建立成員記錄
      const memberData = {
        memberId,
        userId,
        ledgerId: invitationData.ledgerId,
        permissionLevel: invitationData.permissionLevel,
        joinedAt: admin.firestore.Timestamp.now(),
        invitedBy: invitationData.inviterId,
        status: "active"
      };

      // 更新協作設定
      const collaborationRef = db.collection('collaborations').doc(invitationData.ledgerId);
      await collaborationRef.update({
        members: admin.firestore.FieldValue.arrayUnion(memberData),
        updatedAt: admin.firestore.Timestamp.now()
      });

      // 設定成員權限
      await CM_setMemberPermission(invitationData.ledgerId, userId, invitationData.permissionLevel, invitationData.inviterId);

      // 更新邀請狀態
      await invitationDoc.ref.update({ status: "accepted" });

      // 廣播成員加入事件
      await CM_broadcastEvent(invitationData.ledgerId, CM_WEBSOCKET_EVENTS.MEMBER_JOINED, {
        memberId,
        userId,
        permissionLevel: invitationData.permissionLevel
      });

      CM_logInfo(`成員成功加入協作: ${memberId}`, "處理加入", userId, "", "", functionName);
      
      return {
        success: true,
        memberId,
        permissions: CM_PERMISSION_LEVELS[invitationData.permissionLevel]
      };

    } else if (responseType === "decline") {
      // 拒絕邀請
      await invitationDoc.ref.update({ status: "declined" });
      
      return {
        success: true,
        memberId: null,
        permissions: null
      };
    } else {
      throw new Error(`無效的回應類型: ${responseType}`);
    }

  } catch (error) {
    CM_logError(`處理成員加入失敗: ${error.message}`, "處理加入", userId, "CM_JOIN_ERROR", error.toString(), functionName);
    return {
      success: false,
      memberId: null,
      permissions: null
    };
  }
}

/**
 * 03. 移除協作成員
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 從帳本移除指定成員（含退出和被移除）
 */
async function CM_removeMember(ledgerId, targetUserId, operatorId, removeType) {
  const functionName = "CM_removeMember";
  try {
    CM_logInfo(`開始移除協作成員: ${targetUserId}`, "移除成員", operatorId, "", "", functionName);

    // 如果是主動退出，允許操作；如果是被移除，需要驗證權限
    if (removeType === "kicked" && targetUserId !== operatorId) {
      const hasPermission = await CM_validatePermission(ledgerId, operatorId, "remove");
      if (!hasPermission.hasPermission) {
        throw new Error("權限不足：無法移除其他成員");
      }
    }

    // 取得協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      throw new Error("協作帳本不存在");
    }

    const collaborationData = collaborationDoc.data();
    const updatedMembers = collaborationData.members.filter(member => member.userId !== targetUserId);

    // 備份成員資料 (如果備份服務可用)
    if (typeof BS_createMemberBackup === 'function') {
      await BS_createMemberBackup(ledgerId, targetUserId);
    }

    // 更新成員清單
    await collaborationDoc.ref.update({
      members: updatedMembers,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 廣播成員離開事件
    await CM_broadcastEvent(ledgerId, CM_WEBSOCKET_EVENTS.MEMBER_LEFT, {
      userId: targetUserId,
      removeType,
      operatorId
    });

    CM_logWarning(`成員已移除: ${targetUserId}, 類型: ${removeType}`, "移除成員", operatorId, "", "", functionName);
    
    return {
      success: true,
      removedUser: targetUserId,
      newMemberCount: updatedMembers.length
    };

  } catch (error) {
    CM_logError(`移除成員失敗: ${error.message}`, "移除成員", operatorId, "CM_REMOVE_ERROR", error.toString(), functionName);
    return {
      success: false,
      removedUser: null,
      newMemberCount: 0
    };
  }
}

/**
 * 04. 取得帳本成員清單
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 查詢指定帳本的所有成員及其權限狀態
 */
async function CM_getMemberList(ledgerId, requesterId, includePermissions = true) {
  const functionName = "CM_getMemberList";
  try {
    CM_logInfo(`查詢帳本成員清單: ${ledgerId}`, "查詢成員", requesterId, "", "", functionName);

    // 驗證查詢權限
    const hasPermission = await CM_validatePermission(ledgerId, requesterId, "view");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法查詢成員清單");
    }

    // 取得協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      throw new Error("協作帳本不存在");
    }

    const collaborationData = collaborationDoc.data();
    let members = collaborationData.members || [];

    // 如果需要包含詳細權限資訊
    if (includePermissions) {
      members = members.map(member => ({
        ...member,
        permissionDetails: CM_PERMISSION_LEVELS[member.permissionLevel] || {},
        canEdit: CM_PERMISSION_LEVELS[member.permissionLevel]?.actions.includes("edit") || false,
        canInvite: CM_PERMISSION_LEVELS[member.permissionLevel]?.actions.includes("invite") || false
      }));
    }

    return {
      members,
      totalCount: members.length,
      permissions: includePermissions ? CM_PERMISSION_LEVELS : null
    };

  } catch (error) {
    CM_logError(`查詢成員清單失敗: ${error.message}`, "查詢成員", requesterId, "CM_GET_MEMBERS_ERROR", error.toString(), functionName);
    return {
      members: [],
      totalCount: 0,
      permissions: null
    };
  }
}

/**
 * 05. 設定成員權限
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 設定或修改指定成員的帳本權限等級
 */
async function CM_setMemberPermission(ledgerId, targetUserId, newPermission, operatorId) {
  const functionName = "CM_setMemberPermission";
  try {
    CM_logInfo(`設定成員權限: ${targetUserId} -> ${newPermission}`, "設定權限", operatorId, "", "", functionName);

    // 驗證操作者權限
    const hasPermission = await CM_validatePermission(ledgerId, operatorId, "manage_permissions");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法管理權限");
    }

    // 驗證新權限等級是否有效
    if (!CM_PERMISSION_LEVELS[newPermission]) {
      throw new Error(`無效的權限等級: ${newPermission}`);
    }

    // 取得協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      throw new Error("協作帳本不存在");
    }

    const collaborationData = collaborationDoc.data();
    const members = collaborationData.members || [];
    
    // 找到目標成員並更新權限
    const targetMemberIndex = members.findIndex(member => member.userId === targetUserId);
    if (targetMemberIndex === -1) {
      throw new Error("目標成員不存在於此帳本");
    }

    const oldPermission = members[targetMemberIndex].permissionLevel;
    members[targetMemberIndex].permissionLevel = newPermission;
    members[targetMemberIndex].permissionUpdatedAt = admin.firestore.Timestamp.now();
    members[targetMemberIndex].permissionUpdatedBy = operatorId;

    // 更新協作設定
    await collaborationDoc.ref.update({
      members,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 即時同步權限變更 (如果 DD 模組可用)
    if (DD && typeof DD.DD_distributeData === 'function') {
      await DD.DD_distributeData({
        type: "permission_change",
        ledgerId,
        targetUserId,
        oldPermission,
        newPermission,
        operatorId
      });
    }

    // 廣播權限變更事件
    await CM_broadcastEvent(ledgerId, CM_WEBSOCKET_EVENTS.PERMISSION_CHANGED, {
      targetUserId,
      oldPermission,
      newPermission,
      operatorId
    });

    CM_logInfo(`權限設定成功: ${targetUserId} ${oldPermission} -> ${newPermission}`, "設定權限", operatorId, "", "", functionName);
    
    return {
      success: true,
      oldPermission,
      newPermission
    };

  } catch (error) {
    CM_logError(`設定權限失敗: ${error.message}`, "設定權限", operatorId, "CM_SET_PERMISSION_ERROR", error.toString(), functionName);
    return {
      success: false,
      oldPermission: null,
      newPermission: null
    };
  }
}

/**
 * 06. 驗證用戶操作權限
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 檢查用戶是否有權限執行特定操作
 */
async function CM_validatePermission(ledgerId, userId, operationType) {
  const functionName = "CM_validatePermission";
  try {
    // 取得協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      return {
        hasPermission: false,
        currentLevel: null,
        requiredLevel: null
      };
    }

    const collaborationData = collaborationDoc.data();
    const members = collaborationData.members || [];
    
    // 找到用戶成員資訊
    const userMember = members.find(member => member.userId === userId);
    if (!userMember) {
      return {
        hasPermission: false,
        currentLevel: null,
        requiredLevel: "member"
      };
    }

    const userPermission = CM_PERMISSION_LEVELS[userMember.permissionLevel];
    if (!userPermission) {
      return {
        hasPermission: false,
        currentLevel: userMember.permissionLevel,
        requiredLevel: "member"
      };
    }

    // 檢查是否有權限執行操作
    const hasPermission = userPermission.actions.includes("all") || userPermission.actions.includes(operationType);
    
    return {
      hasPermission,
      currentLevel: userMember.permissionLevel,
      requiredLevel: hasPermission ? userMember.permissionLevel : "admin"
    };

  } catch (error) {
    CM_logWarning(`權限驗證失敗: ${error.message}`, "驗證權限", userId, "CM_VALIDATE_ERROR", error.toString(), functionName);
    return {
      hasPermission: false,
      currentLevel: null,
      requiredLevel: null
    };
  }
}

/**
 * 07. 取得權限矩陣
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 取得完整的權限配置矩陣和操作規則
 */
async function CM_getPermissionMatrix(ledgerId, userId) {
  const functionName = "CM_getPermissionMatrix";
  try {
    CM_logInfo(`取得權限矩陣: ${ledgerId}`, "查詢權限", userId, "", "", functionName);

    // 驗證用戶權限
    const userPermission = await CM_validatePermission(ledgerId, userId, "view");
    if (!userPermission.hasPermission) {
      throw new Error("權限不足：無法查詢權限矩陣");
    }

    // 取得用戶當前權限等級
    const currentPermissionLevel = CM_PERMISSION_LEVELS[userPermission.currentLevel];
    
    // 建立允許操作清單
    const allowedOperations = currentPermissionLevel ? currentPermissionLevel.actions : [];

    return {
      permissionMatrix: CM_PERMISSION_LEVELS,
      allowedOperations,
      currentLevel: userPermission.currentLevel,
      canManagePermissions: allowedOperations.includes("manage_permissions") || allowedOperations.includes("all")
    };

  } catch (error) {
    CM_logError(`取得權限矩陣失敗: ${error.message}`, "查詢權限", userId, "CM_GET_MATRIX_ERROR", error.toString(), functionName);
    return {
      permissionMatrix: {},
      allowedOperations: [],
      currentLevel: null,
      canManagePermissions: false
    };
  }
}

/**
 * 08. 初始化協作同步
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 為帳本建立即時協作同步連線
 */
async function CM_initializeSync(ledgerId, userId, clientInfo) {
  const functionName = "CM_initializeSync";
  try {
    CM_logInfo(`初始化協作同步: ${ledgerId}`, "初始化同步", userId, "", "", functionName);

    // 驗證同步權限
    const hasPermission = await CM_validatePermission(ledgerId, userId, "view");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法建立同步連線");
    }

    // 建立同步ID和頻道ID
    const syncId = `sync_${Date.now()}_${userId}`;
    const channelId = `channel_${ledgerId}`;

    // 取得當前連線的用戶清單
    const connectedUsers = Array.from(CM_INIT_STATUS.activeConnections.keys())
      .filter(connKey => connKey.startsWith(ledgerId));

    // 記錄同步連線
    CM_INIT_STATUS.activeConnections.set(`${ledgerId}_${userId}`, {
      syncId,
      userId,
      ledgerId,
      clientInfo,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    CM_logInfo(`協作同步初始化成功: ${syncId}`, "初始化同步", userId, "", "", functionName);
    
    return {
      syncId,
      channelId,
      connectedUsers: connectedUsers.map(key => key.split('_')[1])
    };

  } catch (error) {
    CM_logError(`初始化同步失敗: ${error.message}`, "初始化同步", userId, "CM_INIT_SYNC_ERROR", error.toString(), functionName);
    return {
      syncId: null,
      channelId: null,
      connectedUsers: []
    };
  }
}

/**
 * 09. 處理資料同步衝突
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 偵測並解決多用戶同時編輯的資料衝突
 */
async function CM_resolveDataConflict(conflictData, resolutionStrategy = "timestamp") {
  const functionName = "CM_resolveDataConflict";
  try {
    CM_logWarning(`偵測到資料衝突，開始解決`, "解決衝突", "", "CM_CONFLICT_DETECTED", JSON.stringify(conflictData), functionName);

    let finalData = null;
    const conflictLog = [];

    switch (resolutionStrategy) {
      case "timestamp":
        // 以最新時間戳為準
        const latestData = conflictData.reduce((latest, current) => 
          new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
        );
        finalData = latestData.data;
        conflictLog.push(`採用時間戳策略，選擇 ${latestData.userId} 在 ${latestData.timestamp} 的版本`);
        break;

      case "merge":
        // 嘗試智慧合併
        finalData = Object.assign({}, ...conflictData.map(item => item.data));
        conflictLog.push("採用合併策略，嘗試整合所有變更");
        break;

      case "manual":
        // 需要手動處理
        finalData = null;
        conflictLog.push("標記為需要手動處理的衝突");
        break;

      default:
        throw new Error(`不支援的解決策略: ${resolutionStrategy}`);
    }

    // 如果有備份服務，建立衝突前狀態備份
    if (typeof BS_createConflictBackup === 'function') {
      await BS_createConflictBackup(conflictData);
    }

    const resolved = finalData !== null;
    if (resolved) {
      CM_logInfo(`資料衝突解決成功，策略: ${resolutionStrategy}`, "解決衝突", "", "", "", functionName);
    }

    return {
      resolved,
      finalData,
      conflictLog,
      strategy: resolutionStrategy
    };

  } catch (error) {
    CM_logError(`解決資料衝突失敗: ${error.message}`, "解決衝突", "", "CM_RESOLVE_ERROR", error.toString(), functionName);
    return {
      resolved: false,
      finalData: null,
      conflictLog: [error.message],
      strategy: resolutionStrategy
    };
  }
}

/**
 * 10. 廣播協作事件
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 向所有協作成員廣播重要事件變更
 */
async function CM_broadcastEvent(ledgerId, eventType, eventData, excludeUsers = []) {
  const functionName = "CM_broadcastEvent";
  try {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 取得該帳本的所有連線用戶
    const targetConnections = Array.from(CM_INIT_STATUS.activeConnections.entries())
      .filter(([key, conn]) => 
        conn.ledgerId === ledgerId && 
        !excludeUsers.includes(conn.userId)
      );

    let deliveredCount = 0;

    // WebSocket 即時廣播
    if (CM_INIT_STATUS.websocketServer) {
      const broadcastData = {
        eventId,
        eventType,
        ledgerId,
        data: eventData,
        timestamp: new Date().toISOString()
      };

      targetConnections.forEach(([key, conn]) => {
        try {
          if (conn.websocket && conn.websocket.readyState === WebSocket.OPEN) {
            conn.websocket.send(JSON.stringify(broadcastData));
            deliveredCount++;
          }
        } catch (wsError) {
          CM_logWarning(`WebSocket廣播失敗: ${conn.userId}`, "廣播事件", "", "WS_BROADCAST_ERROR", wsError.toString(), functionName);
        }
      });
    }

    // LINE OA 離線用戶通知 (如果模組可用)
    if (LINE_OA && typeof LINE_OA.sendOfflineNotification === 'function') {
      const offlineUsers = targetConnections
        .filter(([key, conn]) => !conn.websocket || conn.websocket.readyState !== WebSocket.OPEN)
        .map(([key, conn]) => conn.userId);
      
      if (offlineUsers.length > 0) {
        await LINE_OA.sendOfflineNotification(offlineUsers, {
          eventType,
          ledgerId,
          eventData
        });
      }
    }

    CM_logInfo(`事件廣播完成: ${eventType}, 送達 ${deliveredCount} 個連線`, "廣播事件", "", "", "", functionName);
    
    return {
      broadcasted: true,
      deliveredCount,
      eventId
    };

  } catch (error) {
    CM_logError(`廣播事件失敗: ${error.message}`, "廣播事件", "", "CM_BROADCAST_ERROR", error.toString(), functionName);
    return {
      broadcasted: false,
      deliveredCount: 0,
      eventId: null
    };
  }
}

/**
 * 11. 發送協作通知
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 向相關成員發送協作事件通知
 */
async function CM_sendCollaborationNotification(notificationType, recipientList, notificationData) {
  const functionName = "CM_sendCollaborationNotification";
  try {
    CM_logInfo(`發送協作通知: ${notificationType}`, "發送通知", "", "", "", functionName);

    const notificationId = `notify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const deliveredChannels = [];

    // LINE OA 通知發送
    if (LINE_OA && typeof LINE_OA.sendCollaborationNotification === 'function') {
      try {
        await LINE_OA.sendCollaborationNotification(recipientList, {
          type: notificationType,
          data: notificationData,
          notificationId
        });
        deliveredChannels.push("LINE");
      } catch (lineError) {
        CM_logWarning(`LINE通知發送失敗`, "發送通知", "", "LINE_NOTIFY_ERROR", lineError.toString(), functionName);
      }
    }

    // 記錄通知發送狀態
    CM_logInfo(`協作通知發送完成: ${notificationId}`, "發送通知", "", "", "", functionName);
    
    return {
      sent: true,
      deliveredChannels,
      notificationId
    };

  } catch (error) {
    CM_logError(`發送協作通知失敗: ${error.message}`, "發送通知", "", "CM_NOTIFY_ERROR", error.toString(), functionName);
    return {
      sent: false,
      deliveredChannels: [],
      notificationId: null
    };
  }
}

/**
 * 12. 設定通知偏好
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 讓用戶自訂協作事件的通知設定
 */
async function CM_setNotificationPreferences(userId, ledgerId, preferences) {
  const functionName = "CM_setNotificationPreferences";
  try {
    CM_logInfo(`設定通知偏好: ${userId}`, "設定偏好", userId, "", "", functionName);

    // 驗證偏好設定格式
    const validPreferences = {
      memberJoined: preferences.memberJoined || false,
      memberLeft: preferences.memberLeft || false,
      permissionChanged: preferences.permissionChanged || false,
      dataUpdated: preferences.dataUpdated || false,
      conflictDetected: preferences.conflictDetected || true, // 預設開啟衝突通知
      channels: preferences.channels || ["LINE"], // 預設使用 LINE
      quietHours: preferences.quietHours || { start: "22:00", end: "08:00" }
    };

    // 儲存到 Firestore
    await db.collection('notification_preferences').doc(`${userId}_${ledgerId}`).set({
      userId,
      ledgerId,
      preferences: validPreferences,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 同步偏好設定變更 (如果 DD 模組可用)
    if (DD && typeof DD.DD_distributeData === 'function') {
      await DD.DD_distributeData({
        type: "notification_preferences_update",
        userId,
        ledgerId,
        preferences: validPreferences
      });
    }

    return {
      updated: true,
      preferences: validPreferences,
      message: "通知偏好設定已更新"
    };

  } catch (error) {
    CM_logError(`設定通知偏好失敗: ${error.message}`, "設定偏好", userId, "CM_PREF_ERROR", error.toString(), functionName);
    return {
      updated: false,
      preferences: null,
      message: error.message
    };
  }
}

/**
 * 13. 記錄協作操作
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 詳細記錄所有協作相關的操作日誌
 */
async function CM_logCollaborationAction(ledgerId, userId, actionType, actionData) {
  const functionName = "CM_logCollaborationAction";
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const logData = {
      logId,
      ledgerId,
      userId,
      actionType,
      actionData,
      timestamp: admin.firestore.Timestamp.now(),
      ipAddress: actionData.ipAddress || "unknown",
      userAgent: actionData.userAgent || "unknown"
    };

    // 儲存到 Firestore
    await db.collection('collaboration_logs').add(logData);

    // 整合系統日誌
    CM_logInfo(`協作操作記錄: ${actionType}`, actionType, userId, "", JSON.stringify(actionData), functionName);
    
    return {
      logged: true,
      logId,
      timestamp: logData.timestamp.toDate().toISOString()
    };

  } catch (error) {
    CM_logError(`記錄協作操作失敗: ${error.message}`, "記錄操作", userId, "CM_LOG_ERROR", error.toString(), functionName);
    return {
      logged: false,
      logId: null,
      timestamp: null
    };
  }
}

/**
 * 14. 查詢協作歷史
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 查詢指定帳本的協作操作歷史記錄
 */
async function CM_getCollaborationHistory(ledgerId, userId, filterOptions = {}) {
  const functionName = "CM_getCollaborationHistory";
  try {
    CM_logInfo(`查詢協作歷史: ${ledgerId}`, "查詢歷史", userId, "", "", functionName);

    // 驗證歷史查詢權限
    const hasPermission = await CM_validatePermission(ledgerId, userId, "view");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法查詢協作歷史");
    }

    // 建立查詢條件
    let query = db.collection('collaboration_logs').where('ledgerId', '==', ledgerId);
    
    // 套用過濾條件
    if (filterOptions.actionType) {
      query = query.where('actionType', '==', filterOptions.actionType);
    }
    
    if (filterOptions.startDate) {
      query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(filterOptions.startDate)));
    }
    
    if (filterOptions.endDate) {
      query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(new Date(filterOptions.endDate)));
    }

    // 執行查詢
    query = query.orderBy('timestamp', 'desc').limit(filterOptions.limit || 100);
    const snapshot = await query.get();

    const history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({
        logId: data.logId,
        actionType: data.actionType,
        userId: data.userId,
        actionData: data.actionData,
        timestamp: data.timestamp.toDate().toISOString()
      });
    });

    // 生成統計資訊
    const statistics = {
      totalActions: history.length,
      actionTypes: {},
      activeUsers: new Set(history.map(h => h.userId)).size,
      timeRange: {
        earliest: history.length > 0 ? history[history.length - 1].timestamp : null,
        latest: history.length > 0 ? history[0].timestamp : null
      }
    };

    // 統計動作類型分布
    history.forEach(h => {
      statistics.actionTypes[h.actionType] = (statistics.actionTypes[h.actionType] || 0) + 1;
    });

    return {
      history,
      totalCount: history.length,
      statistics
    };

  } catch (error) {
    CM_logError(`查詢協作歷史失敗: ${error.message}`, "查詢歷史", userId, "CM_HISTORY_ERROR", error.toString(), functionName);
    return {
      history: [],
      totalCount: 0,
      statistics: {}
    };
  }
}

/**
 * 15. 處理協作錯誤
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 統一處理協作過程中的各種錯誤情況
 */
async function CM_handleCollaborationError(errorType, errorData, context) {
  const functionName = "CM_handleCollaborationError";
  try {
    const errorCode = `CM_${errorType.toUpperCase()}_ERROR`;
    const timestamp = new Date().toISOString();

    // 記錄詳細錯誤資訊
    CM_logError(`協作錯誤: ${errorType}`, "錯誤處理", context.userId || "", errorCode, JSON.stringify(errorData), functionName);

    let recoveryAction = "none";
    
    // 根據錯誤類型執行恢復操作
    switch (errorType) {
      case "permission_denied":
        recoveryAction = "redirect_to_request_access";
        break;
        
      case "connection_lost":
        recoveryAction = "attempt_reconnection";
        // 嘗試重新建立連線
        if (context.ledgerId && context.userId) {
          setTimeout(() => {
            CM_initializeSync(context.ledgerId, context.userId, { reconnect: true });
          }, 5000);
        }
        break;
        
      case "data_conflict":
        recoveryAction = "automatic_resolution";
        // 嘗試自動解決衝突
        if (errorData.conflictData) {
          await CM_resolveDataConflict(errorData.conflictData, "timestamp");
        }
        break;
        
      case "sync_failure":
        recoveryAction = "force_refresh";
        break;
        
      default:
        recoveryAction = "manual_intervention_required";
    }

    // 發送錯誤通知 (如果 LINE OA 模組可用)
    if (LINE_OA && typeof LINE_OA.sendErrorNotification === 'function' && context.userId) {
      await LINE_OA.sendErrorNotification(context.userId, {
        errorType,
        errorCode,
        timestamp,
        recoveryAction
      });
    }

    return {
      handled: true,
      errorCode,
      recoveryAction,
      timestamp
    };

  } catch (handleError) {
    console.error(`處理協作錯誤時發生異常:`, handleError);
    return {
      handled: false,
      errorCode: "CM_ERROR_HANDLER_FAILED",
      recoveryAction: "system_restart_required",
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 16. 監控協作狀態
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:19:46
 * @description 即時監控協作系統的健康狀態
 */
async function CM_monitorCollaborationHealth(ledgerId = null) {
  const functionName = "CM_monitorCollaborationHealth";
  try {
    const monitoringData = {
      timestamp: new Date().toISOString(),
      healthy: true,
      activeUsers: 0,
      performance: {}
    };

    // 檢查 WebSocket 連線狀態
    if (CM_INIT_STATUS.websocketServer) {
      const totalConnections = CM_INIT_STATUS.activeConnections.size;
      const specificLedgerConnections = ledgerId 
        ? Array.from(CM_INIT_STATUS.activeConnections.keys()).filter(key => key.startsWith(ledgerId)).length
        : totalConnections;
        
      monitoringData.activeUsers = specificLedgerConnections;
      monitoringData.performance.websocketConnections = totalConnections;
    } else {
      monitoringData.healthy = false;
      monitoringData.performance.websocketStatus = "disconnected";
    }

    // 檢查 Firestore 連線狀態
    try {
      const testQuery = await db.collection('collaborations').limit(1).get();
      monitoringData.performance.firestoreStatus = "connected";
      monitoringData.performance.firestoreLatency = Date.now(); // 簡化的延遲測量
    } catch (firestoreError) {
      monitoringData.healthy = false;
      monitoringData.performance.firestoreStatus = "error";
      monitoringData.performance.firestoreError = firestoreError.message;
    }

    // 檢查記憶體使用狀況
    const memUsage = process.memoryUsage();
    monitoringData.performance.memoryUsage = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
    };

    // 系統負載檢查
    monitoringData.performance.uptime = Math.round(process.uptime());
    
    // 如果有 MRA 模組，生成詳細效能報表
    if (typeof MRA_generatePerformanceReport === 'function') {
      monitoringData.detailedReport = await MRA_generatePerformanceReport('collaboration');
    }

    if (monitoringData.healthy) {
      CM_logInfo(`協作系統健康檢查通過`, "系統監控", "", "", "", functionName);
    } else {
      CM_logWarning(`協作系統健康檢查發現問題`, "系統監控", "", "CM_HEALTH_WARNING", JSON.stringify(monitoringData.performance), functionName);
    }

    return monitoringData;

  } catch (error) {
    CM_logError(`協作狀態監控失敗: ${error.message}`, "系統監控", "", "CM_MONITOR_ERROR", error.toString(), functionName);
    return {
      timestamp: new Date().toISOString(),
      healthy: false,
      activeUsers: 0,
      performance: {
        error: error.message
      }
    };
  }
}

/**
 * 模組初始化函數
 */
async function CM_initialize() {
  const functionName = "CM_initialize";
  try {
    console.log('🤝 CM 協作管理模組初始化中...');
    
    // 檢查 Firestore 連線
    if (!admin.apps.length) {
      throw new Error("Firebase Admin 未初始化");
    }

    // 設定模組初始化狀態
    CM_INIT_STATUS.initialized = true;
    CM_INIT_STATUS.firestoreConnected = true;
    CM_INIT_STATUS.lastInitTime = new Date();

    CM_logInfo("CM 協作管理模組初始化完成", "模組初始化", "", "", "", functionName);
    console.log('✅ CM 協作管理模組已成功啟動');
    
    return true;
  } catch (error) {
    CM_logError(`CM 模組初始化失敗: ${error.message}`, "模組初始化", "", "CM_INIT_ERROR", error.toString(), functionName);
    console.error('❌ CM 協作管理模組初始化失敗:', error);
    return false;
  }
}

// 導出模組函數
module.exports = {
  // 成員管理函數
  CM_inviteMember,
  CM_processMemberJoin,
  CM_removeMember,
  CM_getMemberList,
  
  // 權限管理函數
  CM_setMemberPermission,
  CM_validatePermission,
  CM_getPermissionMatrix,
  
  // 即時同步函數
  CM_initializeSync,
  CM_resolveDataConflict,
  CM_broadcastEvent,
  
  // 協作通知函數
  CM_sendCollaborationNotification,
  CM_setNotificationPreferences,
  
  // 變更紀錄函數
  CM_logCollaborationAction,
  CM_getCollaborationHistory,
  
  // 錯誤處理與監控函數
  CM_handleCollaborationError,
  CM_monitorCollaborationHealth,
  
  // 模組初始化
  CM_initialize,
  
  // 常數與配置
  CM_PERMISSION_LEVELS,
  CM_WEBSOCKET_EVENTS,
  CM_INIT_STATUS
};

// 自動初始化模組
CM_initialize().catch(error => {
  console.error('CM 模組自動初始化失敗:', error);
});
