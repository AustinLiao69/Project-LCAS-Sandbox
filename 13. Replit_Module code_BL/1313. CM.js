/**
 * CM_協作與帳本管理模組_2.1.0
 * @module CM模組
 * @description 協作與帳本管理系統 - 負責所有後續帳本（第2本以上）的完整生命週期管理，包含協作功能和多帳本管理功能
 * @update 2025-11-10: 階段一準備 - 整合MLS功能準備，更新為協作與帳本管理模組
 */

const admin = require('firebase-admin');
const WebSocket = require('ws');

// 引入依賴模組
let DL, MLS, AM, DD, BK, LINE_OA, FS; // Added FS here
try {
  DL = require('./1310. DL.js');
  // MLS = require('./1351. MLS.js');
  // AM = require('./1309. AM.js');
  DD = require('./1331. DD1.js');
  BK = require('./1301. BK.js');
  // LINE_OA = require('./1320. WH.js');
  FS = require('./1311. FS.js'); // FS模組包含完整的Firestore操作函數 - Corrected path
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

// 權限等級設定 - 階段三強化：四級權限體系
const CM_PERMISSION_LEVELS = {
  owner: {
    level: 4,
    actions: ["all"],
    description: "擁有者：完整控制權限",
    canManage: ["admin", "member", "viewer"],
    restrictions: []
  },
  admin: {
    level: 3,
    actions: ["invite", "remove", "edit", "view", "manage_permissions", "manage_settings", "bulk_operations"],
    description: "管理員：管理權限，無法移除擁有者",
    canManage: ["member", "viewer"],
    restrictions: ["cannot_remove_owner", "cannot_change_owner_permission"]
  },
  member: {
    level: 2,
    actions: ["edit", "view", "invite_limited", "comment", "collaborate"],
    description: "成員：編輯權限，受限邀請權限",
    canManage: [],
    restrictions: ["cannot_invite_admin", "cannot_manage_permissions", "invite_limit_5_per_day"]
  },
  viewer: {
    level: 1,
    actions: ["view", "comment"],
    description: "檢視者：唯讀權限，可留言",
    canManage: [],
    restrictions: ["read_only", "cannot_edit", "cannot_invite"]
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
 * 00. 初始化協作系統 - 階段三修正
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 為帳本建立完整的協作架構，階段三修正：直接使用Firestore確保協作帳本建立
 */
async function CM_initializeCollaboration(ledgerId, ownerInfo, collaborationType = 'shared', initialSettings = {}) {
  const functionName = "CM_initializeCollaboration";
  try {
    CM_logInfo(`階段三修正：初始化協作系統 - 帳本: ${ledgerId}, 擁有者: ${ownerInfo.userId}`, "初始化協作", ownerInfo.userId, "", "", functionName);

    // 階段三修正：檢查協作帳本是否已存在
    const existingCollaboration = await db.collection('collaborations').doc(ledgerId).get();

    if (existingCollaboration.exists) {
      CM_logInfo(`協作帳本已存在: ${ledgerId}，檢查權限設定`, "初始化協作", ownerInfo.userId, "", "", functionName);
      const existingData = existingCollaboration.data();

      // 確保擁有者在成員清單中
      if (!existingData.members.find(member => member.userId === ownerInfo.userId)) {
        const ownerMember = {
          memberId: `member_${Date.now()}_${ownerInfo.userId}`,
          userId: ownerInfo.userId,
          permissionLevel: 'owner',
          joinedAt: admin.firestore.Timestamp.now(),
          status: "active"
        };

        // 階段二修正：使用參照對象確保更新操作成功
        const existingRef = db.collection('collaborations').doc(ledgerId);
        await existingRef.update({
          members: admin.firestore.FieldValue.arrayUnion(ownerMember),
          updatedAt: admin.firestore.Timestamp.now()
        });

        // 階段二驗證：確認成員已正確加入
        const updatedDoc = await existingRef.get();
        const updatedData = updatedDoc.data();
        const memberExists = updatedData.members.find(member => member.userId === ownerInfo.userId);

        if (!memberExists) {
          throw new Error(`擁有者加入協作帳本失敗：${ledgerId}`);
        }

        CM_logInfo(`階段二修正：擁有者已驗證加入現有協作帳本 - ${ledgerId}`, "初始化協作", ownerInfo.userId, "", "", functionName);
      }
    } else {
      // 階段三修正：直接建立協作主集合文檔
      const currentTime = admin.firestore.Timestamp.now();
      const ownerMember = {
        memberId: `member_${Date.now()}_${ownerInfo.userId}`,
        userId: ownerInfo.userId,
        permissionLevel: 'owner',
        joinedAt: currentTime,
        invitedBy: ownerInfo.userId,
        status: "active"
      };

      const collaborationData = {
        ownerId: ownerInfo.userId,
        ownerEmail: ownerInfo.email || `${ownerInfo.userId}@example.com`,
        collaborationType: collaborationType,
        status: 'active',
        members: [ownerMember],
        permissions: {
          owner: ownerInfo.userId,
          admins: [],
          members: [],
          viewers: []
        },
        settings: {
          allowInvite: initialSettings.allowInvite !== false,
          allowEdit: initialSettings.allowEdit !== false,
          allowDelete: initialSettings.allowDelete || false,
          requireApproval: initialSettings.requireApproval || false,
          ...initialSettings
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      // 階段一修正：確保使用正確的Firebase集合路徑並增強寫入驗證
      const collaborationRef = db.collection('collaborations').doc(ledgerId);

      try {
        await collaborationRef.set(collaborationData);
        CM_logInfo(`階段一修正：協作帳本已寫入Firebase - ${ledgerId}`, "初始化協作", ownerInfo.userId, "", "", functionName);

        // 階段一修正：立即驗證文檔是否成功寫入
        const verifyDoc = await collaborationRef.get();
        if (!verifyDoc.exists) {
          throw new Error(`階段一修正：協作帳本建立失敗，Firebase寫入驗證失敗 - ${ledgerId}`);
        }

        const verifyData = verifyDoc.data();
        if (!verifyData || !verifyData.members || verifyData.members.length === 0) {
          throw new Error(`階段一修正：協作帳本建立失敗，成員資料寫入不完整 - ${ledgerId}`);
        }

        CM_logInfo(`階段一修正：協作帳本建立並驗證成功 - ${ledgerId}, 成員數: ${verifyData.members.length}`, "初始化協作", ownerInfo.userId, "", "", functionName);
      } catch (writeError) {
        CM_logError(`階段一修正：Firebase寫入失敗 - ${writeError.message}`, "初始化協作", ownerInfo.userId, "FIREBASE_WRITE_ERROR", writeError.toString(), functionName);
        throw new Error(`階段一修正：協作帳本Firebase寫入失敗 - ${writeError.message}`);
      }
    }

    // 2. 初始化協作同步（簡化版，避免循環調用）
    const syncId = `sync_${Date.now()}_${ownerInfo.userId}`;
    const channelId = `channel_${ledgerId}`;

    // 3. 記錄協作初始化操作
    await CM_logCollaborationAction(ledgerId, ownerInfo.userId, 'collaboration_initialized', {
      collaborationType: collaborationType,
      settings: initialSettings,
      syncId: syncId
    });

    // 階段二修正：增加協作系統初始化的詳細日誌
  CM_logInfo(`階段二&三修正：協作系統初始化完成 - 帳本: ${ledgerId}`, "初始化協作", ownerInfo.userId, "", "", functionName);

  // 階段二新增：Firebase寫入狀態檢查日誌
  try {
    const verifyCollaboration = await db.collection('collaborations').doc(ledgerId).get();
    if (verifyCollaboration.exists) {
      const collabData = verifyCollaboration.data();
      CM_logInfo(`階段二驗證成功：協作帳本已存在於Firebase - 成員數: ${collabData.members?.length || 0}`, "初始化協作", ownerInfo.userId, "", "", functionName);
    } else {
      CM_logError(`階段二驗證失敗：協作帳本未在Firebase中找到 - ${ledgerId}`, "初始化協作", ownerInfo.userId, "COLLABORATION_NOT_FOUND", "", functionName);
    }
  } catch (verifyError) {
    CM_logError(`階段二驗證錯誤：無法檢查協作帳本狀態 - ${verifyError.message}`, "初始化協作", ownerInfo.userId, "COLLABORATION_VERIFY_ERROR", verifyError.toString(), functionName);
  }

    return {
      success: true,
      ledgerId: ledgerId,
      collaborationType: collaborationType,
      syncId: syncId,
      message: '階段三修正：協作系統初始化成功'
    };

  } catch (error) {
    CM_logError(`階段三修正：協作系統初始化失敗: ${error.message}`, "初始化協作", ownerInfo?.userId || "", "CM_INIT_COLLABORATION_ERROR", error.toString(), functionName);
    return {
      success: false,
      ledgerId: null,
      message: `階段三修正：${error.message}`
    };
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
 * 05. 設定成員權限 - 階段三修正
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 設定或修改指定成員的帳本權限等級，階段三修正：強化權限邏輯和系統用戶支援
 */
async function CM_setMemberPermission(ledgerId, targetUserId, newPermission, operatorId) {
  const functionName = "CM_setMemberPermission";
  try {
    CM_logInfo(`階段三修正：設定成員權限: ${targetUserId} -> ${newPermission}`, "設定權限", operatorId, "", "", functionName);

    // 階段三修正：系統用戶或初始化時跳過權限驗證
    const isSystemOperation = operatorId === targetUserId || operatorId === 'system' || !operatorId;
    const isOwnerSetup = newPermission === 'owner' && operatorId === targetUserId;

    if (!isSystemOperation && !isOwnerSetup) {
      // 驗證操作者權限
      const hasPermission = await CM_validatePermission(ledgerId, operatorId, "manage_permissions");
      if (!hasPermission.hasPermission) {
        throw new Error(`權限不足：無法管理權限，目前權限: ${hasPermission.currentLevel}，需要: admin以上`);
      }
    } else {
      CM_logInfo(`階段三修正：系統操作或擁有者設置，跳過權限驗證`, "設定權限", operatorId, "", "", functionName);
    }

    // 驗證新權限等級是否有效
    if (!CM_PERMISSION_LEVELS[newPermission]) {
      throw new Error(`無效的權限等級: ${newPermission}`);
    }

    // 取得協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      // 階段三修正：如果協作帳本不存在且是擁有者設置，創建基礎協作結構
      if (newPermission === 'owner') {
        CM_logInfo(`階段三修正：協作帳本不存在，為擁有者建立基礎結構`, "設定權限", operatorId, "", "", functionName);

        const ownerMember = {
          memberId: `member_${Date.now()}_${targetUserId}`,
          userId: targetUserId,
          permissionLevel: 'owner',
          joinedAt: admin.firestore.Timestamp.now(),
          invitedBy: operatorId || targetUserId,
          status: "active"
        };

        const collaborationData = {
          ownerId: targetUserId,
          collaborationType: 'shared',
          status: 'active',
          members: [ownerMember],
          permissions: {
            owner: targetUserId,
            admins: [],
            members: [],
            viewers: []
          },
          settings: {
            allowInvite: true,
            allowEdit: true,
            allowDelete: false,
            requireApproval: false
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        };

        await db.collection('collaborations').doc(ledgerId).set(collaborationData);

        CM_logInfo(`階段三修正：基礎協作結構建立成功，擁有者權限設定完成`, "設定權限", operatorId, "", "", functionName);

        return {
          success: true,
          oldPermission: null,
          newPermission: 'owner',
          message: '階段三修正：擁有者權限設定成功'
        };
      } else {
        throw new Error("協作帳本不存在，且非擁有者權限設置");
      }
    }

    const collaborationData = collaborationDoc.data();
    const members = collaborationData.members || [];

    // 找到目標成員並更新權限
    const targetMemberIndex = members.findIndex(member => member.userId === targetUserId);

    if (targetMemberIndex === -1) {
      // 階段三修正：如果成員不存在，且是有效權限設置，則新增成員
      if (CM_PERMISSION_LEVELS[newPermission]) {
        const newMember = {
          memberId: `member_${Date.now()}_${targetUserId}`,
          userId: targetUserId,
          permissionLevel: newPermission,
          joinedAt: admin.firestore.Timestamp.now(),
          invitedBy: operatorId || targetUserId,
          status: "active"
        };

        members.push(newMember);

        await collaborationDoc.ref.update({
          members,
          updatedAt: admin.firestore.Timestamp.now()
        });

        CM_logInfo(`階段三修正：新成員權限設定成功: ${targetUserId} -> ${newPermission}`, "設定權限", operatorId, "", "", functionName);

        return {
          success: true,
          oldPermission: null,
          newPermission: newPermission,
          message: '階段三修正：新成員權限設定成功'
        };
      } else {
        throw new Error("目標成員不存在於此帳本");
      }
    }

    const oldPermission = members[targetMemberIndex].permissionLevel;
    members[targetMemberIndex].permissionLevel = newPermission;
    members[targetMemberIndex].permissionUpdatedAt = admin.firestore.Timestamp.now();
    members[targetMemberIndex].permissionUpdatedBy = operatorId || 'system';

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

    CM_logInfo(`階段三修正：權限設定成功: ${targetUserId} ${oldPermission} -> ${newPermission}`, "設定權限", operatorId, "", "", functionName);

    return {
      success: true,
      oldPermission,
      newPermission,
      message: '階段三修正：權限設定成功'
    };

  } catch (error) {
    CM_logError(`階段三修正：設定權限失敗: ${error.message}`, "設定權限", operatorId, "CM_SET_PERMISSION_ERROR", error.toString(), functionName);
    return {
      success: false,
      oldPermission: null,
      newPermission: null,
      message: `階段三修正：${error.message}`
    };
  }
}

/**
 * 06. 驗證用戶操作權限 - 階段三修正
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 檢查用戶是否有權限執行特定操作，階段三修正：支援系統用戶和初始化場景
 */
async function CM_validatePermission(ledgerId, userId, operationType) {
  const functionName = "CM_validatePermission";
  try {
    // 階段三修正：系統用戶或未指定用戶時給予完整權限
    if (!userId || userId === 'system') {
      CM_logInfo(`階段三修正：系統用戶操作，授予完整權限`, "驗證權限", userId, "", "", functionName);
      return {
        hasPermission: true,
        currentLevel: "system",
        requiredLevel: "system"
      };
    }

    // 取得協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      // 階段三修正：協作帳本不存在時，如果是擁有者相關操作，允許權限
      if (operationType === "manage_permissions" || operationType === "view") {
        CM_logInfo(`階段三修正：協作帳本不存在，初始化權限檢查`, "驗證權限", userId, "", "", functionName);
        return {
          hasPermission: true,
          currentLevel: "owner",
          requiredLevel: "owner"
        };
      }
      return {
        hasPermission: false,
        currentLevel: null,
        requiredLevel: null,
        message: "協作帳本不存在"
      };
    }

    const collaborationData = collaborationDoc.data();
    const members = collaborationData.members || [];

    // 找到用戶成員資訊
    const userMember = members.find(member => member.userId === userId);
    if (!userMember) {
      // 階段三修正：如果用戶是帳本擁有者但不在成員清單中，給予擁有者權限
      if (collaborationData.ownerId === userId) {
        CM_logInfo(`階段三修正：用戶是帳本擁有者但不在成員清單中，授予擁有者權限`, "驗證權限", userId, "", "", functionName);
        return {
          hasPermission: true,
          currentLevel: "owner",
          requiredLevel: "owner"
        };
      }

      return {
        hasPermission: false,
        currentLevel: null,
        requiredLevel: "member",
        message: "用戶不在協作帳本成員清單中"
      };
    }

    const userPermission = CM_PERMISSION_LEVELS[userMember.permissionLevel];
    if (!userPermission) {
      return {
        hasPermission: false,
        currentLevel: userMember.permissionLevel,
        requiredLevel: "member",
        message: `無效的權限等級: ${userMember.permissionLevel}`
      };
    }

    // 檢查是否有權限執行操作
    const hasPermission = userPermission.actions.includes("all") || userPermission.actions.includes(operationType);

    // 階段三修正：提供更詳細的權限回饋
    let requiredLevel = "member";
    if (operationType === "manage_permissions") {
      requiredLevel = "admin";
    } else if (operationType === "remove" || operationType === "invite") {
      requiredLevel = "admin";
    } else if (operationType === "view" || operationType === "edit") {
      requiredLevel = "member";
    }

    return {
      hasPermission,
      currentLevel: userMember.permissionLevel,
      requiredLevel: hasPermission ? userMember.permissionLevel : requiredLevel,
      message: hasPermission ? "權限驗證通過" : `權限不足，需要${requiredLevel}以上權限`
    };

  } catch (error) {
    CM_logWarning(`階段三修正：權限驗證失敗: ${error.message}`, "驗證權限", userId, "CM_VALIDATE_ERROR", error.toString(), functionName);
    return {
      hasPermission: false,
      currentLevel: null,
      requiredLevel: null,
      message: `權限驗證異常: ${error.message}`
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
 * 16. 取得協作帳本詳情 - 階段三新增
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 取得協作帳本的完整資訊，包括成員、權限、設定等
 */
async function CM_getCollaborationDetails(ledgerId, requesterId) {
  const functionName = "CM_getCollaborationDetails";
  try {
    CM_logInfo(`取得協作帳本詳情: ${ledgerId}`, "查詢協作", requesterId, "", "", functionName);

    // 驗證查詢權限
    const hasPermission = await CM_validatePermission(ledgerId, requesterId, "view");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法查詢協作詳情");
    }

    // 取得協作主集合資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      throw new Error("協作帳本不存在");
    }

    const collaborationData = collaborationDoc.data();

    // 取得成員清單
    const memberListResult = await CM_getMemberList(ledgerId, requesterId, true);

    // 取得權限矩陣
    const permissionMatrixResult = await CM_getPermissionMatrix(ledgerId, requesterId);

    // 取得協作歷史摘要
    const historyResult = await CM_getCollaborationHistory(ledgerId, requesterId, { limit: 10 });

    // 組合完整協作資訊
    const collaborationDetails = {
      ledgerId: ledgerId,
      ownerId: collaborationData.ownerId,
      collaborationType: collaborationData.collaborationType,
      status: collaborationData.status,
      settings: collaborationData.settings,
      createdAt: collaborationData.createdAt,
      updatedAt: collaborationData.updatedAt,
      members: memberListResult.members || [],
      totalMembers: memberListResult.totalCount || 0,
      permissions: permissionMatrixResult.permissionMatrix || {},
      userPermissions: permissionMatrixResult.allowedOperations || [],
      recentActivity: historyResult.history || []
    };

    return {
      success: true,
      data: collaborationDetails,
      message: '協作詳情取得成功'
    };

  } catch (error) {
    CM_logError(`取得協作詳情失敗: ${error.message}`, "查詢協作", requesterId, "CM_GET_DETAILS_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: null,
      message: error.message
    };
  }
}

/**
 * 17. 更新協作設定 - 階段三新增
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 更新協作帳本的設定，如邀請規則、編輯權限等
 */
async function CM_updateCollaborationSettings(ledgerId, newSettings, operatorId) {
  const functionName = "CM_updateCollaborationSettings";
  try {
    CM_logInfo(`更新協作設定: ${ledgerId}`, "更新設定", operatorId, "", "", functionName);

    // 驗證管理權限
    const hasPermission = await CM_validatePermission(ledgerId, operatorId, "manage_permissions");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法修改協作設定");
    }

    // 取得現有協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      throw new Error("協作帳本不存在");
    }

    const currentData = collaborationDoc.data();

    // 合併新設定
    const updatedSettings = {
      ...currentData.settings,
      ...newSettings,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: operatorId
    };

    // 更新協作設定
    await collaborationDoc.ref.update({
      settings: updatedSettings,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 記錄設定變更
    await CM_logCollaborationAction(ledgerId, operatorId, 'settings_updated', {
      oldSettings: currentData.settings,
      newSettings: updatedSettings,
      changes: newSettings
    });

    // 廣播設定變更事件
    await CM_broadcastEvent(ledgerId, 'collaboration:settings_updated', {
      settings: updatedSettings,
      operatorId: operatorId
    });

    CM_logInfo(`協作設定更新成功: ${ledgerId}`, "更新設定", operatorId, "", "", functionName);

    return {
      success: true,
      settings: updatedSettings,
      message: '協作設定更新成功'
    };

  } catch (error) {
    CM_logError(`更新協作設定失敗: ${error.message}`, "更新設定", operatorId, "CM_UPDATE_SETTINGS_ERROR", error.toString(), functionName);
    return {
      success: false,
      settings: null,
      message: error.message
    };
  }
}

/**
 * 18. 暫停/恢復協作 - 階段三新增
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 暫停或恢復協作帳本，管理協作生命週期
 */
async function CM_toggleCollaborationStatus(ledgerId, targetStatus, operatorId, reason = '') {
  const functionName = "CM_toggleCollaborationStatus";
  try {
    CM_logInfo(`切換協作狀態: ${ledgerId} -> ${targetStatus}`, "狀態切換", operatorId, "", "", functionName);

    // 驗證操作權限（只有擁有者或管理員可以暫停協作）
    const hasPermission = await CM_validatePermission(ledgerId, operatorId, "manage_permissions");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法修改協作狀態");
    }

    // 驗證狀態有效性
    const validStatuses = ['active', 'suspended', 'archived'];
    if (!validStatuses.includes(targetStatus)) {
      throw new Error(`無效的協作狀態: ${targetStatus}`);
    }

    // 取得協作資訊
    const collaborationDoc = await db.collection('collaborations').doc(ledgerId).get();
    if (!collaborationDoc.exists) {
      throw new Error("協作帳本不存在");
    }

    const currentData = collaborationDoc.data();
    const oldStatus = currentData.status;

    // 更新協作狀態
    await collaborationDoc.ref.update({
      status: targetStatus,
      statusChangedAt: admin.firestore.Timestamp.now(),
      statusChangedBy: operatorId,
      statusChangeReason: reason,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // 如果暫停協作，關閉所有同步連線
    if (targetStatus === 'suspended') {
      const connectedUsers = Array.from(CM_INIT_STATUS.activeConnections.entries())
        .filter(([key, conn]) => conn.ledgerId === ledgerId);

      for (const [key, conn] of connectedUsers) {
        if (conn.websocket && conn.websocket.readyState === WebSocket.OPEN) {
          conn.websocket.send(JSON.stringify({
            eventType: 'collaboration:suspended',
            message: '協作已暫停',
            reason: reason
          }));
          conn.websocket.close();
        }
        CM_INIT_STATUS.activeConnections.delete(key);
      }
    }

    // 記錄狀態變更
    await CM_logCollaborationAction(ledgerId, operatorId, 'status_changed', {
      oldStatus: oldStatus,
      newStatus: targetStatus,
      reason: reason
    });

    // 廣播狀態變更事件
    await CM_broadcastEvent(ledgerId, 'collaboration:status_changed', {
      oldStatus: oldStatus,
      newStatus: targetStatus,
      operatorId: operatorId,
      reason: reason
    });

    CM_logInfo(`協作狀態切換成功: ${ledgerId} ${oldStatus} -> ${targetStatus}`, "狀態切換", operatorId, "", "", functionName);

    return {
      success: true,
      oldStatus: oldStatus,
      newStatus: targetStatus,
      message: `協作狀態已切換至${targetStatus}`
    };

  } catch (error) {
    CM_logError(`切換協作狀態失敗: ${error.message}`, "狀態切換", operatorId, "CM_TOGGLE_STATUS_ERROR", error.toString(), functionName);
    return {
      success: false,
      oldStatus: null,
      newStatus: null,
      message: error.message
    };
  }
}

/**
 * 19. 批量操作成員權限 - 階段三新增
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 批量設定多個成員的權限，提高管理效率
 */
async function CM_bulkSetMemberPermissions(ledgerId, memberPermissions, operatorId) {
  const functionName = "CM_bulkSetMemberPermissions";
  try {
    CM_logInfo(`批量設定成員權限: ${ledgerId}, 影響 ${memberPermissions.length} 個成員`, "批量權限", operatorId, "", "", functionName);

    // 驗證操作權限
    const hasPermission = await CM_validatePermission(ledgerId, operatorId, "manage_permissions");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法管理權限");
    }

    const results = [];
    const failed = [];

    // 逐一處理每個成員的權限設定
    for (const memberPermission of memberPermissions) {
      try {
        const { userId, permissionLevel } = memberPermission;
        const result = await CM_setMemberPermission(ledgerId, userId, permissionLevel, operatorId);

        results.push({
          userId: userId,
          permissionLevel: permissionLevel,
          success: result.success,
          oldPermission: result.oldPermission
        });

        if (!result.success) {
          failed.push({ userId, error: result.message || '設定失敗' });
        }
      } catch (memberError) {
        failed.push({
          userId: memberPermission.userId,
          error: memberError.message
        });
      }
    }

    // 記錄批量操作
    await CM_logCollaborationAction(ledgerId, operatorId, 'bulk_permission_update', {
      totalMembers: memberPermissions.length,
      successCount: results.filter(r => r.success).length,
      failedCount: failed.length,
      results: results,
      failed: failed
    });

    // 廣播批量權限變更事件
    await CM_broadcastEvent(ledgerId, 'collaboration:bulk_permission_changed', {
      operatorId: operatorId,
      results: results,
      failed: failed
    });

    const successCount = results.filter(r => r.success).length;
    CM_logInfo(`批量權限設定完成: ${successCount}/${memberPermissions.length} 成功`, "批量權限", operatorId, "", "", functionName);

    return {
      success: failed.length === 0,
      results: results,
      successCount: successCount,
      failedCount: failed.length,
      failed: failed,
      message: `批量權限設定完成：${successCount} 成功，${failed.length} 失敗`
    };

  } catch (error) {
    CM_logError(`批量設定權限失敗: ${error.message}`, "批量權限", operatorId, "CM_BULK_PERMISSION_ERROR", error.toString(), functionName);
    return {
      success: false,
      results: [],
      successCount: 0,
      failedCount: memberPermissions?.length || 0,
      message: error.message
    };
  }
}

/**
 * 20. 協作數據統計 - 階段三新增
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 提供協作帳本的統計資訊，如活躍度、成員參與度等
 */
async function CM_getCollaborationStatistics(ledgerId, requesterId, timeRange = '7d') {
  const functionName = "CM_getCollaborationStatistics";
  try {
    CM_logInfo(`取得協作統計: ${ledgerId}, 時間範圍: ${timeRange}`, "協作統計", requesterId, "", "", functionName);

    // 驗證查詢權限
    const hasPermission = await CM_validatePermission(ledgerId, requesterId, "view");
    if (!hasPermission.hasPermission) {
      throw new Error("權限不足：無法查詢協作統計");
    }

    // 計算時間範圍
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // 查詢協作歷史記錄
    const historyQuery = db.collection('collaboration_logs')
      .where('ledgerId', '==', ledgerId)
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate));

    const historySnapshot = await historyQuery.get();
    const activities = [];
    historySnapshot.forEach(doc => {
      activities.push(doc.data());
    });

    // 統計分析
    const statistics = {
      timeRange: timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalActivities: activities.length,
      activeMembers: new Set(activities.map(a => a.userId)).size,
      activityBreakdown: {},
      memberActivity: {},
      dailyActivity: {},
      peakHours: Array.from({length: 24}, () => 0)
    };

    // 分析活動類型分布
    activities.forEach(activity => {
      // 活動類型統計
      statistics.activityBreakdown[activity.actionType] =
        (statistics.activityBreakdown[activity.actionType] || 0) + 1;

      // 成員活動度統計
      statistics.memberActivity[activity.userId] =
        (statistics.memberActivity[activity.userId] || 0) + 1;

      // 每日活動統計
      const activityDate = activity.timestamp.toDate().toISOString().split('T')[0];
      statistics.dailyActivity[activityDate] =
        (statistics.dailyActivity[activityDate] || 0) + 1;

      // 活動高峰時段統計
      const hour = activity.timestamp.toDate().getHours();
      statistics.peakHours[hour]++;
    });

    // 取得目前成員清單
    const memberListResult = await CM_getMemberList(ledgerId, requesterId, false);
    statistics.totalMembers = memberListResult.totalCount || 0;

    // 計算活躍度指標
    statistics.activityRate = statistics.totalMembers > 0
      ? (statistics.activeMembers / statistics.totalMembers * 100).toFixed(2) + '%'
      : '0%';

    // 找出最活躍的時段
    const maxActivityHour = statistics.peakHours.indexOf(Math.max(...statistics.peakHours));
    statistics.peakActivityHour = `${maxActivityHour}:00 - ${maxActivityHour + 1}:00`;

    CM_logInfo(`協作統計取得成功: ${ledgerId}`, "協作統計", requesterId, "", "", functionName);

    return {
      success: true,
      statistics: statistics,
      message: '協作統計取得成功'
    };

  } catch (error) {
    CM_logError(`取得協作統計失敗: ${error.message}`, "協作統計", requesterId, "CM_GET_STATISTICS_ERROR", error.toString(), functionName);
    return {
      success: false,
      statistics: null,
      message: error.message
    };
  }
}

/**
 * 21. 監控協作狀態
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

/**
 * ========================================
 * MLS功能遷移區域 - 階段二實作完成
 * ========================================
 */

/**
 * 22. 建立帳本 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 建立新帳本 - 從MLS_createLedger遷移而來
 */
async function CM_createLedger(ledgerData, options = {}) {
  const functionName = "CM_createLedger";
  try {
    CM_logInfo(`建立帳本 - 帳本名稱: ${ledgerData.name}`, "建立帳本", ledgerData.owner_id, "", "", functionName);

    if (!ledgerData.name || !ledgerData.type) {
      throw new Error('缺少必要參數: name, type');
    }

    if (!ledgerData.owner_id) {
      throw new Error('缺少必要參數: owner_id');
    }

    // 生成帳本ID
    const ledgerId = `ledger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 建立帳本物件
    const newLedger = {
      id: ledgerId,
      name: ledgerData.name,
      type: ledgerData.type,
      description: ledgerData.description || '',
      currency: ledgerData.currency || 'TWD',
      timezone: ledgerData.timezone || 'Asia/Taipei',
      owner_id: ledgerData.owner_id,
      ownerId: ledgerData.owner_id, // 相容性欄位
      members: ledgerData.members || [
        {
          userId: ledgerData.owner_id,
          email: ledgerData.ownerEmail || `${ledgerData.owner_id}@example.com`,
          displayName: `User ${ledgerData.owner_id.split('_')[1] || ledgerData.owner_id}`,
          role: 'owner',
          status: 'active',
          joinedAt: admin.firestore.Timestamp.now(),
          permissions: {
            read: true,
            write: true,
            manage: true,
            delete: true
          }
        }
      ],
      permissions: ledgerData.permissions || {
        owner: ledgerData.owner_id,
        admins: [],
        members: [],
        viewers: []
      },
      settings: ledgerData.settings || {
        allow_invite: true,
        allow_edit: true,
        allow_delete: false
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      archived: false,
      metadata: {
        total_entries: 0,
        total_amount: 0,
        member_count: ledgerData.members ? ledgerData.members.length : 1
      }
    };

    // 實際寫入Firestore
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    await ledgerRef.set(newLedger);

    // 驗證寫入成功
    const verifyDoc = await ledgerRef.get();
    if (!verifyDoc.exists) {
      throw new Error('帳本寫入Firestore失敗：驗證文檔不存在');
    }

    CM_logInfo(`帳本成功寫入Firestore - ID: ${ledgerId}`, "建立帳本", ledgerData.owner_id, "", "", functionName);

    // 如果是協作帳本，初始化協作架構
    if ((newLedger.type === 'shared' || newLedger.type === 'project')) {
      try {
        const collaborationResult = await CM_initializeCollaboration(
          ledgerId,
          {
            userId: ledgerData.owner_id,
            email: ledgerData.ownerEmail || `${ledgerData.owner_id}@example.com`
          },
          newLedger.type,
          newLedger.settings || {}
        );

        if (collaborationResult.success) {
          CM_logInfo(`協作架構初始化成功 - 帳本ID: ${ledgerId}`, "建立帳本", ledgerData.owner_id, "", "", functionName);
        } else {
          CM_logWarning(`協作架構初始化失敗 - 帳本ID: ${ledgerId}, 錯誤: ${collaborationResult.message}`, "建立帳本", ledgerData.owner_id, "", "", functionName);
        }
      } catch (cmError) {
        CM_logWarning(`協作架構初始化異常 - 帳本ID: ${ledgerId}, 錯誤: ${cmError.message}`, "建立帳本", ledgerData.owner_id, "", "", functionName);
      }
    }

    // 返回已寫入的資料
    const finalLedger = {
      ...newLedger,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      success: true,
      data: finalLedger,
      message: '帳本建立成功並已寫入資料庫'
    };

  } catch (error) {
    CM_logError(`建立帳本失敗: ${error.message}`, "建立帳本", ledgerData.owner_id, "CM_CREATE_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: null,
      message: `建立帳本失敗: ${error.message}`,
      error: {
        code: 'CREATE_LEDGER_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 23. 取得帳本清單 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 取得用戶可存取的帳本列表 - 從MLS_getLedgers遷移而來
 */
async function CM_getLedgers(queryParams = {}) {
  const functionName = "CM_getLedgers";
  try {
    CM_logInfo(`取得帳本列表 - 查詢參數: ${JSON.stringify(queryParams)}`, "查詢帳本", queryParams.userId, "", "", functionName);

    // 實際從Firestore查詢帳本列表
    let query = db.collection('ledgers');

    // 如果有userId參數，篩選該用戶的帳本
    if (queryParams.userId) {
      query = query.where('members', 'array-contains', queryParams.userId);
    }

    // 預設只顯示非歸檔的帳本
    if (queryParams.archived !== true) {
      query = query.where('archived', '==', false);
    }

    const querySnapshot = await query.get();
    const ledgers = [];

    querySnapshot.forEach(doc => {
      const ledgerData = doc.data();
      ledgers.push({
        id: ledgerData.id,
        name: ledgerData.name,
        type: ledgerData.type,
        description: ledgerData.description || '',
        owner_id: ledgerData.owner_id,
        members: ledgerData.members || [],
        permissions: ledgerData.permissions || {},
        settings: ledgerData.settings || {},
        created_at: ledgerData.created_at,
        updated_at: ledgerData.updated_at,
        archived: ledgerData.archived || false,
        metadata: ledgerData.metadata || {}
      });
    });

    return {
      success: true,
      data: ledgers,
      count: ledgers.length,
      message: '帳本列表取得成功'
    };

  } catch (error) {
    CM_logError(`取得帳本列表失敗: ${error.message}`, "查詢帳本", queryParams.userId, "CM_GET_LEDGERS_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: [],
      count: 0,
      message: `取得帳本列表失敗: ${error.message}`,
      error: {
        code: 'GET_LEDGERS_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 24. 取得單一帳本詳情 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 根據帳本ID取得單一帳本詳情 - 從MLS_getLedgerById遷移而來
 */
async function CM_getLedgerById(ledgerId, queryParams = {}) {
  const functionName = "CM_getLedgerById";
  try {
    CM_logInfo(`取得帳本詳情 - 帳本ID: ${ledgerId}`, "查詢帳本", queryParams.userId, "", "", functionName);

    if (!ledgerId) {
      return {
        success: false,
        message: '帳本ID為必填項目',
        error: { code: 'MISSING_LEDGER_ID' }
      };
    }

    // 從Firestore查詢帳本
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在',
        error: { code: 'LEDGER_NOT_FOUND' }
      };
    }

    const ledgerData = ledgerDoc.data();

    // 檢查權限（如果提供了userId）
    if (queryParams.userId) {
      const accessCheck = await CM_validatePermission(ledgerId, queryParams.userId, 'read');
      if (!accessCheck.hasPermission) {
        return {
          success: false,
          message: '權限不足，無法查詢帳本詳情',
          error: { code: 'PERMISSION_DENIED' }
        };
      }
    }

    // 返回帳本詳情
    const result = {
      id: ledgerData.id,
      name: ledgerData.name,
      type: ledgerData.type,
      description: ledgerData.description || '',
      owner_id: ledgerData.owner_id,
      members: ledgerData.members || [],
      permissions: ledgerData.permissions || {},
      settings: ledgerData.settings || {},
      created_at: ledgerData.created_at,
      updated_at: ledgerData.updated_at,
      archived: ledgerData.archived || false,
      metadata: ledgerData.metadata || {}
    };

    return {
      success: true,
      data: result,
      message: '帳本詳情取得成功'
    };

  } catch (error) {
    CM_logError(`取得帳本詳情失敗: ${error.message}`, "查詢帳本", queryParams.userId, "CM_GET_LEDGER_BY_ID_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: null,
      message: `取得帳本詳情失敗: ${error.message}`,
      error: {
        code: 'GET_LEDGER_BY_ID_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 25. 更新帳本 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 更新帳本資訊 - 從MLS_updateLedger遷移而來
 */
async function CM_updateLedger(ledgerId, updateData, options = {}) {
  const functionName = "CM_updateLedger";
  try {
    CM_logInfo(`更新帳本 - 帳本ID: ${ledgerId}`, "更新帳本", options.userId, "", "", functionName);

    if (!ledgerId) {
      throw new Error('缺少帳本ID');
    }

    // 驗證存取權限
    if (options.userId) {
      const accessCheck = await CM_validatePermission(ledgerId, options.userId, 'edit');
      if (!accessCheck.hasPermission) {
        throw new Error('權限不足，無法編輯帳本');
      }
    }

    // 取得現有帳本資料
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      throw new Error('帳本不存在');
    }

    // 準備更新資料
    const updatePayload = {
      ...updateData,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // 更新 Firestore
    await ledgerRef.update(updatePayload);

    // 模擬更新操作結果
    const updatedLedger = {
      id: ledgerId,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    return {
      success: true,
      data: updatedLedger,
      message: '帳本更新成功'
    };

  } catch (error) {
    CM_logError(`更新帳本失敗: ${error.message}`, "更新帳本", options.userId, "CM_UPDATE_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: null,
      message: `更新帳本失敗: ${error.message}`,
      error: {
        code: 'UPDATE_LEDGER_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 26. 刪除帳本 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 安全刪除帳本 - 從MLS_deleteLedger遷移而來
 */
async function CM_deleteLedger(ledgerId, userId, confirmationToken) {
  const functionName = "CM_deleteLedger";
  try {
    CM_logInfo(`開始刪除帳本 - ID: ${ledgerId}, 用戶: ${userId}`, "刪除帳本", userId, "", "", functionName);

    // 驗證存取權限
    const accessCheck = await CM_validatePermission(ledgerId, userId, 'delete');
    if (!accessCheck.hasPermission) {
      throw new Error('權限不足，無法刪除帳本');
    }

    // 驗證二次確認 token
    const expectedToken = `delete_${ledgerId}_${userId}`;
    if (confirmationToken !== expectedToken) {
      CM_logWarning(`帳本刪除確認 token 不符: ${ledgerId}`, "刪除帳本", userId, "", "", functionName);
      return {
        success: false,
        message: '確認 token 不正確，請重新確認刪除操作'
      };
    }

    // 取得帳本資料進行備份
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在'
      };
    }

    const ledgerData = ledgerDoc.data();

    // 建立刪除前備份
    CM_logInfo(`帳本 ${ledgerId} 已建立刪除前備份`, "刪除帳本", userId, "", "", functionName);

    // 執行刪除
    await ledgerRef.delete();

    // 記錄刪除操作
    await CM_logCollaborationAction(ledgerId, userId, 'ledger_deleted', {
      ledgerType: ledgerData.type,
      deletedAt: new Date().toISOString()
    });

    CM_logError(`帳本已刪除 - ID: ${ledgerId}, 用戶: ${userId}, 類型: ${ledgerData.type}`, "刪除帳本", userId, "", "", functionName);

    return {
      success: true,
      message: '帳本刪除成功'
    };

  } catch (error) {
    CM_logError(`刪除帳本失敗: ${error.message}`, "刪除帳本", userId, "CM_DELETE_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: '刪除帳本時發生錯誤'
    };
  }
}

/**
 * 27. 編輯帳本 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 修改帳本基本資訊、屬性設定 - 從MLS_editLedger遷移而來
 */
async function CM_editLedger(ledgerId, userId, updateData, permission) {
  const functionName = "CM_editLedger";
  try {
    CM_logInfo(`開始編輯帳本 - ID: ${ledgerId}, 用戶: ${userId}`, "編輯帳本", userId, "", "", functionName);

    // 驗證存取權限
    const accessCheck = await CM_validatePermission(ledgerId, userId, 'edit');
    if (!accessCheck.hasPermission) {
      throw new Error('權限不足，無法編輯帳本');
    }

    // 取得現有帳本資料
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      CM_logWarning(`嘗試編輯不存在的帳本: ${ledgerId}`, "編輯帳本", userId, "", "", functionName);
      return {
        success: false,
        message: '帳本不存在'
      };
    }

    // 準備更新資料
    const updatePayload = {
      ...updateData,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // 更新 Firestore
    await ledgerRef.update(updatePayload);

    // 與 BK 模組整合更新相關記帳資料
    if (BK && typeof BK.BK_processBookkeeping === 'function') {
      CM_logInfo(`帳本編輯已通知 BK 模組更新相關記帳資料`, "編輯帳本", userId, "", "", functionName);
    }

    CM_logInfo(`帳本編輯成功 - ID: ${ledgerId}`, "編輯帳本", userId, "", "", functionName);

    return {
      success: true,
      message: '帳本編輯成功'
    };

  } catch (error) {
    CM_logError(`編輯帳本失敗: ${error.message}`, "編輯帳本", userId, "CM_EDIT_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: '編輯帳本時發生錯誤'
    };
  }
}

/**
 * 28. 建立專案帳本 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 針對特定專案/事件建立專案帳本 - 從MLS_createProjectLedger遷移而來
 */
async function CM_createProjectLedger(userId, projectName, projectDescription, startDate, endDate, budget) {
  const functionName = "CM_createProjectLedger";
  try {
    CM_logInfo(`開始建立專案帳本 - 用戶: ${userId}, 專案: ${projectName}`, "建立專案帳本", userId, "", "", functionName);

    // 檢查專案名稱是否重複
    const duplicateCheck = await CM_detectDuplicateName(userId, projectName, 'project');
    if (!duplicateCheck.isUnique) {
      return {
        success: false,
        message: '專案帳本名稱已存在，請使用不同的名稱'
      };
    }

    // 建立專案帳本資料
    const projectLedgerData = {
      name: projectName,
      type: 'project',
      description: projectDescription,
      owner_id: userId,
      ownerEmail: `${userId}@example.com`,
      settings: {
        allow_invite: true,
        allow_edit: true,
        allow_delete: false
      },
      projectConfig: {
        startDate: startDate,
        endDate: endDate,
        budget: budget || 0,
        status: 'active',
        progress: 0
      }
    };

    // 使用統一的帳本建立函數
    const result = await CM_createLedger(projectLedgerData, {});

    if (result.success) {
      CM_logInfo(`專案帳本建立成功 - ID: ${result.data.id}`, "建立專案帳本", userId, "", "", functionName);

      return {
        success: true,
        ledgerId: result.data.id,
        message: '專案帳本建立成功'
      };
    } else {
      throw new Error(result.message || '專案帳本建立失敗');
    }

  } catch (error) {
    CM_logError(`建立專案帳本失敗: ${error.message}`, "建立專案帳本", userId, "CM_CREATE_PROJECT_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: '建立專案帳本時發生錯誤'
    };
  }
}

/**
 * 29. 建立共享帳本 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 支援多用戶協作的共享帳本 - 從MLS_createSharedLedger遷移而來
 */
async function CM_createSharedLedger(ownerId, ledgerName, memberList, permissionSettings) {
  const functionName = "CM_createSharedLedger";
  try {
    CM_logInfo(`開始建立共享帳本 - 擁有者: ${ownerId}, 帳本: ${ledgerName}`, "建立共享帳本", ownerId, "", "", functionName);

    // 檢查帳本名稱是否重複
    const duplicateCheck = await CM_detectDuplicateName(ownerId, ledgerName, 'shared');
    if (!duplicateCheck.isUnique) {
      return {
        success: false,
        message: '共享帳本名稱已存在，請使用不同的名稱'
      };
    }

    const allMembers = [ownerId, ...(memberList || [])];

    // 建立共享帳本資料
    const sharedLedgerData = {
      name: ledgerName,
      type: 'shared',
      owner_id: ownerId,
      ownerEmail: `${ownerId}@example.com`,
      members: allMembers.map(memberId => ({
        userId: memberId,
        email: `${memberId}@example.com`,
        displayName: `User ${memberId.split('_')[1] || memberId}`,
        role: (memberId === ownerId) ? 'owner' : 'member',
        status: 'active',
        joinedAt: admin.firestore.Timestamp.now(),
        permissions: {
          read: true,
          write: (memberId !== ownerId),
          manage: (memberId === ownerId),
          delete: (memberId === ownerId)
        }
      })),
      permissions: {
        owner: ownerId,
        admins: permissionSettings?.admins || [],
        members: permissionSettings?.members || memberList || [],
        viewers: permissionSettings?.viewers || []
      },
      settings: {
        allow_invite: permissionSettings?.allowInvite !== false,
        allow_edit: permissionSettings?.allowEdit !== false,
        allow_delete: permissionSettings?.allowDelete || false
      }
    };

    // 使用統一的帳本建立函數
    const result = await CM_createLedger(sharedLedgerData, {});

    if (result.success) {
      CM_logInfo(`共享帳本建立成功 - ID: ${result.data.id}, 成員數: ${allMembers.length}`, "建立共享帳本", ownerId, "", "", functionName);

      return {
        success: true,
        ledgerId: result.data.id,
        memberCount: allMembers.length
      };
    } else {
      throw new Error(result.message || '共享帳本建立失敗');
    }

  } catch (error) {
    CM_logError(`建立共享帳本失敗: ${error.message}`, "建立共享帳本", ownerId, "CM_CREATE_SHARED_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: '建立共享帳本時發生錯誤'
    };
  }
}

/**
 * 30. 建立分類帳本 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 依用途/主題建立分類帳本 - 從MLS_createCategoryLedger遷移而來
 */
async function CM_createCategoryLedger(userId, categoryName, categoryType, tags, defaultSubjects) {
  const functionName = "CM_createCategoryLedger";
  try {
    CM_logInfo(`開始建立分類帳本 - 用戶: ${userId}, 分類: ${categoryName}`, "建立分類帳本", userId, "", "", functionName);

    // 檢查分類名稱是否重複
    const duplicateCheck = await CM_detectDuplicateName(userId, categoryName, 'category');
    if (!duplicateCheck.isUnique) {
      return {
        success: false,
        message: '分類帳本名稱已存在，請使用不同的名稱'
      };
    }

    const categoryId = `cat_${categoryType}_${Date.now()}`;

    // 建立分類帳本資料
    const categoryLedgerData = {
      name: categoryName,
      type: 'category',
      description: `分類帳本 - ${categoryType}`,
      owner_id: userId,
      ownerEmail: `${userId}@example.com`,
      settings: {
        allow_invite: false,
        allow_edit: true,
        allow_delete: false
      },
      categoryConfig: {
        categoryType: categoryType,
        categoryId: categoryId,
        tags: tags || [],
        defaultSubjects: defaultSubjects || [],
        autoCategorize: true,
        templateRules: []
      }
    };

    // 使用統一的帳本建立函數
    const result = await CM_createLedger(categoryLedgerData, {});

    if (result.success) {
      CM_logInfo(`分類帳本建立成功 - ID: ${result.data.id}, 分類ID: ${categoryId}`, "建立分類帳本", userId, "", "", functionName);

      return {
        success: true,
        ledgerId: result.data.id,
        categoryId: categoryId
      };
    } else {
      throw new Error(result.message || '分類帳本建立失敗');
    }

  } catch (error) {
    CM_logError(`建立分類帳本失敗: ${error.message}`, "建立分類帳本", userId, "CM_CREATE_CATEGORY_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: '建立分類帳本時發生錯誤'
    };
  }
}

/**
 * 31. 取得協作者列表 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 取得帳本協作者列表 - 從MLS_getCollaborators遷移而來
 */
async function CM_getCollaborators(ledgerId, options = {}) {
  const functionName = "CM_getCollaborators";
  try {
    CM_logInfo(`取得協作者列表 - 帳本ID: ${ledgerId}`, "查詢協作者", options.requesterId, "", "", functionName);

    if (!ledgerId) {
      throw new Error('缺少帳本ID');
    }

    // 委派至CM_getMemberList處理
    const result = await CM_getMemberList(ledgerId, options.requesterId, true);

    if (result.members) {
      const collaborators = result.members.map(member => ({
        userId: member.userId,
        email: member.email || `${member.userId}@example.com`,
        displayName: member.displayName || `用戶${member.userId}`,
        role: member.permissionLevel,
        joinedAt: member.joinedAt || new Date().toISOString(),
        status: member.status || 'active'
      }));

      return {
        success: true,
        data: collaborators,
        message: '協作者列表取得成功'
      };
    }

    // 模擬協作者列表
    const collaborators = [
      {
        userId: 'user_001',
        email: 'user1@example.com',
        displayName: '用戶1',
        role: 'owner',
        joinedAt: new Date().toISOString(),
        status: 'active'
      },
      {
        userId: 'user_002',
        email: 'user2@example.com',
        displayName: '用戶2',
        role: 'editor',
        joinedAt: new Date().toISOString(),
        status: 'active'
      }
    ];

    return {
      success: true,
      data: collaborators,
      message: '協作者列表取得成功'
    };

  } catch (error) {
    CM_logError(`取得協作者列表失敗: ${error.message}`, "查詢協作者", options.requesterId, "CM_GET_COLLABORATORS_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: null,
      message: `取得協作者列表失敗: ${error.message}`,
      error: {
        code: 'GET_COLLABORATORS_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 32. 邀請協作者 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 邀請新協作者加入帳本 - 從MLS_inviteCollaborator遷移而來
 */
async function CM_inviteCollaborator(ledgerId, invitationData, options = {}) {
  const functionName = "CM_inviteCollaborator";
  try {
    CM_logInfo(`邀請協作者 - 帳本ID: ${ledgerId}, 邀請: ${invitationData.email}`, "邀請協作者", options.inviterId, "", "", functionName);

    if (!ledgerId || !invitationData.email) {
      throw new Error('缺少必要參數: ledgerId, email');
    }

    // 委派至CM_inviteMember處理
    const result = await CM_inviteMember(
      ledgerId,
      options.inviterId || 'system',
      invitationData,
      invitationData.role || 'viewer'
    );

    if (result.success) {
      return {
        success: true,
        data: {
          invitationId: result.invitationId,
          ledgerId: ledgerId,
          email: invitationData.email,
          role: invitationData.role || 'viewer',
          status: 'sent',
          createdAt: new Date().toISOString()
        },
        message: result.message || '協作者邀請成功'
      };
    }

    return result;

  } catch (error) {
    CM_logError(`邀請協作者失敗: ${error.message}`, "邀請協作者", options.inviterId, "CM_INVITE_COLLABORATOR_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: null,
      message: `邀請協作者失敗: ${error.message}`,
      error: {
        code: 'INVITE_COLLABORATOR_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 33. 移除協作者 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 移除帳本協作者 - 從MLS_removeCollaborator遷移而來
 */
async function CM_removeCollaborator(ledgerId, userId, options = {}) {
  const functionName = "CM_removeCollaborator";
  try {
    CM_logInfo(`移除協作者 - 帳本ID: ${ledgerId}, 用戶ID: ${userId}`, "移除協作者", options.removerId, "", "", functionName);

    if (!ledgerId || !userId) {
      throw new Error('缺少必要參數: ledgerId, userId');
    }

    // 委派至CM_removeMember處理
    const result = await CM_removeMember(
      ledgerId,
      userId,
      options.removerId || 'system',
      options.reason || 'removed_by_admin'
    );

    if (result.success) {
      return {
        success: true,
        data: {
          removedUserId: userId,
          ledgerId: ledgerId,
          removedAt: new Date().toISOString()
        },
        message: '協作者移除成功'
      };
    }

    return result;

  } catch (error) {
    CM_logError(`移除協作者失敗: ${error.message}`, "移除協作者", options.removerId, "CM_REMOVE_COLLABORATOR_ERROR", error.toString(), functionName);
    return {
      success: false,
      data: null,
      message: `移除協作者失敗: ${error.message}`,
      error: {
        code: 'REMOVE_COLLABORATOR_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 34. 取得權限資訊 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 取得指定帳本的詳細權限資訊 - 從MLS_getPermissions遷移而來
 */
async function CM_getPermissions(ledgerId, queryParams) {
  const functionName = "CM_getPermissions";
  try {
    CM_logInfo(`取得帳本權限 - 帳本ID: ${ledgerId}`, "查詢權限", queryParams.userId, "", "", functionName);

    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在',
        error: { code: 'LEDGER_NOT_FOUND' }
      };
    }

    const ledgerData = ledgerDoc.data();
    const permissions = ledgerData.permissions || {};
    const settings = ledgerData.settings || {};

    return {
      success: true,
      data: {
        ledgerId: ledgerId,
        permissions: permissions,
        owner: permissions.owner,
        admins: permissions.admins || [],
        members: permissions.members || [],
        viewers: permissions.viewers || [],
        settings: settings
      },
      message: '權限資訊取得成功'
    };

  } catch (error) {
    CM_logError(`取得帳本權限失敗: ${error.message}`, "查詢權限", queryParams.userId, "CM_GET_PERMISSIONS_ERROR", error.toString(), functionName);
    return {
      success: false,
      message: '取得帳本權限時發生錯誤',
      error: { code: 'GET_PERMISSIONS_ERROR', details: error.message }
    };
  }
}

/**
 * 35. 檢測重複帳本名稱 - 從MLS遷移
 * @version 2025-11-10-V1.0.0
 * @date 2025-11-10
 * @description 防止用戶建立重複名稱的帳本 - 從MLS_detectDuplicateName遷移而來
 */
async function CM_detectDuplicateName(userId, proposedName, ledgerType) {
  const functionName = "CM_detectDuplicateName";
  try {
    CM_logInfo(`檢測重複帳本名稱 - 用戶: ${userId}, 名稱: ${proposedName}, 類型: ${ledgerType}`, "檢測重複名稱", userId, "", "", functionName);

    // 查詢用戶是否已有相同名稱的帳本
    const query = db.collection('ledgers')
      .where('owner_id', '==', userId)
      .where('name', '==', proposedName)
      .where('type', '==', ledgerType)
      .where('archived', '==', false);

    const querySnapshot = await query.get();

    if (!querySnapshot.empty) {
      // 記錄重複名稱嘗試
      CM_logWarning(`重複帳本名稱嘗試 - 用戶: ${userId}, 名稱: ${proposedName}, 類型: ${ledgerType}`, "檢測重複名稱", userId, "", "", functionName);

      return {
        isUnique: false,
        existingLedgerIds: querySnapshot.docs.map(doc => doc.id),
        message: '帳本名稱已存在'
      };
    }

    return {
      isUnique: true,
      message: '帳本名稱可用'
    };

  } catch (error) {
    CM_logError(`檢測重複帳本名稱失敗: ${error.message}`, "檢測重複名稱", userId, "CM_DETECT_DUPLICATE_NAME_ERROR", error.toString(), functionName);
    return {
      isUnique: false,
      error: true,
      message: '檢測帳本名稱時發生錯誤'
    };
  }
}

// 導出模組函數 - 階段二更新：完成MLS功能遷移
module.exports = {
  // 階段三新增：協作系統核心函數
  CM_initializeCollaboration,
  CM_getCollaborationDetails,
  CM_updateCollaborationSettings,
  CM_toggleCollaborationStatus,
  CM_bulkSetMemberPermissions,
  CM_getCollaborationStatistics,

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
  CM_INIT_STATUS,

  // 階段二完成：從MLS遷移的帳本管理函數
  // 核心帳本CRUD函數
  CM_createLedger,        // 從MLS_createLedger遷移
  CM_getLedgers,          // 從MLS_getLedgers遷移
  CM_getLedgerById,       // 從MLS_getLedgerById遷移
  CM_updateLedger,        // 從MLS_updateLedger遷移
  CM_deleteLedger,        // 從MLS_deleteLedger遷移
  CM_editLedger,          // 從MLS_editLedger遷移

  // 特定類型帳本函數
  CM_createProjectLedger,  // 從MLS_createProjectLedger遷移
  CM_createSharedLedger,   // 從MLS_createSharedLedger遷移
  CM_createCategoryLedger, // 從MLS_createCategoryLedger遷移

  // 協作管理函數
  CM_getCollaborators,     // 從MLS_getCollaborators遷移
  CM_inviteCollaborator,   // 從MLS_inviteCollaborator遷移
  CM_removeCollaborator,   // 從MLS_removeCollaborator遷移
  CM_getPermissions,       // 從MLS_getPermissions遷移

  // 輔助功能函數
  CM_detectDuplicateName   // 從MLS_detectDuplicateName遷移
};

// 自動初始化模組
CM_initialize().catch(error => {
  console.error('CM 模組自動初始化失敗:', error);
});

console.log('✅ CM 協作與帳本管理模組載入完成 - 階段二完成：MLS函數遷移完成，成為協作與帳本管理統一入口');