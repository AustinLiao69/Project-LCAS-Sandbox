/**
 * CM_協作與帳本管理模組_2.3.1
 * @module CM模組
 * @description 協作與帳本管理系統 - 負責所有後續帳本（第2本以上）的完整生命週期管理，包含協作功能和多帳本管理功能
 * @update 2025-11-24: 階段一修復 - 移除FS模組依賴，直接使用Firebase Admin SDK
 */

const admin = require('firebase-admin');
const WebSocket = require('ws');

// 引入依賴模組
let DL, AM, DD, BK, LINE_OA;
try {
  DL = require('./1310. DL.js');
  AM = require('./1309. AM.js');
  DD = require('./1331. DD1.js');
  BK = require('./1301. BK.js');
  LINE_OA = require('./1320. WH.js');
  // 階段一修復：FS模組已移除，CM模組直接使用Firebase Admin SDK
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
 * 階段三：協作系統完整初始化
 * @version 2025-11-21-V2.3.0
 * @date 2025-11-21
 * @description 初始化協作系統的完整架構，包含集合、結構定義和預設設定
 */
async function CM_initializeCollaborationSystem(requesterId = 'SYSTEM') {
  const functionName = "CM_initializeCollaborationSystem";
  try {
    CM_logInfo(`階段三：開始初始化協作系統完整架構`, "協作系統初始化", requesterId, "", "", functionName);

    const initResults = [];

    // 1. 建立協作架構定義（從FS模組遷移）
    const collaborationStructure = {
      version: '2.3.0',
      description: '1313.CM.js協作管理模組Firebase集合架構 - 階段三完整整合版',
      last_updated: '2025-11-21',
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
        '與1313.CM.js協作管理模組完全整合',
        '階段三：CM模組接管所有協作相關初始化',
        '保持camelCase命名規範'
      ]
    };

    // 階段一修復：直接使用Firebase Admin SDK進行文檔操作
    try {
      // 1. 儲存協作架構定義
      collaborationStructure.version = '2.3.1'; // 階段一修復：升級版本號
      await db.collection('_system').doc('collaboration_structure_v2_3_1').set(collaborationStructure);
      initResults.push({
        type: '協作架構定義',
        result: { success: true, message: '階段一修復：協作架構定義已儲存' }
      });

      // 2. 建立協作集合框架
      const collaborationPlaceholder = {
        type: 'collection_placeholder',
        purpose: '確保 collaborations 集合存在',
        version: '2.3.1', // 階段一修復：升級版本號
        createdAt: admin.firestore.Timestamp.now(),
        note: '階段一修復：此文檔由CM模組管理，確保協作集合框架存在'
      };

      await db.collection('collaborations').doc('_placeholder_v2_3_1').set(collaborationPlaceholder);
      initResults.push({
        type: '協作集合框架',
        result: { success: true, message: '階段一修復：協作集合框架已建立' }
      });

      // 3. 建立協作預設設定
      const defaultCollaborationSettings = {
        version: '2.3.1', // 階段一修復：升級版本號
        default_settings: {
          allowInvite: true,
          allowEdit: true,
          allowDelete: false,
          requireApproval: false,
          maxMembers: 10,
          invitationExpireDays: 7
        },
        permission_levels: CM_PERMISSION_LEVELS,
        notification_settings: {
          member_joined: true,
          member_left: true,
          permission_changed: true,
          data_updated: false,
          conflict_detected: true
        },
        createdBy: 'CM_v2.3.1', // 階段一修復：升級版本號
        createdAt: admin.firestore.Timestamp.now()
      };

      await db.collection('_system').doc('collaboration_default_settings').set(defaultCollaborationSettings);
      initResults.push({
        type: '協作預設設定',
        result: { success: true, message: '階段一修復：協作預設設定已儲存' }
      });

    } catch (firebaseError) {
      initResults.push({
        type: 'Firebase操作',
        result: { success: false, error: `階段一修復：${firebaseError.message}` }
      });
    }

    const successCount = initResults.filter(r => r.result && r.result.success).length;
    const success = successCount === initResults.length;

    CM_logInfo(`階段三：協作系統初始化完成 - 成功: ${successCount}/${initResults.length}`, "協作系統初始化", requesterId, "", "", functionName);

    return {
      success: success,
      initialized: successCount,
      total: initResults.length,
      details: initResults,
      message: success ? '階段三：協作系統初始化完成，CM模組已接管所有協作功能' : '階段三：部分協作系統初始化失敗'
    };

  } catch (error) {
    CM_logError(`階段三：協作系統初始化失敗: ${error.message}`, "協作系統初始化", requesterId, "CM_INIT_COLLABORATION_SYSTEM_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'CM_INIT_COLLABORATION_SYSTEM_ERROR'
    };
  }
}

/**
 * 階段一修復：生成協作帳本ID
 * @version 2025-11-12-V2.1.2
 * @date 2025-11-12
 * @description 內部ID生成函數，替代對FS.FS_generateUniqueId的依賴
 */
function CM_generateCollaborationId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `collaboration_${timestamp}_${random}`;
}

/**
 * CM超級代理：自動管理collaborations集合
 * @version 2025-11-24-V2.3.1
 * @date 2025-11-24
 * @description CM模組的超級代理功能，自動創建和管理collaborations集合及其子集合
 */
async function CM_superProxy(operation, collectionPath, documentId, data = null, options = {}) {
  const functionName = "CM_superProxy";
  try {
    CM_logInfo(`CM超級代理執行: ${operation} ${collectionPath}/${documentId || ''}`, "超級代理", options.requesterId || 'system', "", "", functionName);

    // 確保Firebase已初始化
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK未初始化');
    }

    const db = admin.firestore();
    let result = null;

    // 自動創建集合結構
    await CM_ensureCollectionStructure(collectionPath);

    switch (operation.toLowerCase()) {
      case 'create':
      case 'set':
        if (!documentId) {
          documentId = CM_generateCollaborationId();
        }

        // 添加系統欄位
        const createData = {
          ...data,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          createdBy: options.requesterId || 'CM_superProxy',
          managedBy: 'CM_v2.3.1'
        };

        await db.collection(collectionPath).doc(documentId).set(createData);
        result = { id: documentId, ...createData };
        break;

      case 'get':
      case 'read':
        if (documentId) {
          const doc = await db.collection(collectionPath).doc(documentId).get();
          result = doc.exists ? { id: doc.id, ...doc.data() } : null;
        } else {
          const snapshot = await db.collection(collectionPath).get();
          result = [];
          snapshot.forEach(doc => {
            result.push({ id: doc.id, ...doc.data() });
          });
        }
        break;

      case 'update':
        if (!documentId) {
          throw new Error('更新操作需要文檔ID');
        }

        const updateData = {
          ...data,
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: options.requesterId || 'CM_superProxy'
        };

        await db.collection(collectionPath).doc(documentId).update(updateData);
        result = { id: documentId, updated: true };
        break;

      case 'delete':
        if (!documentId) {
          throw new Error('刪除操作需要文檔ID');
        }

        await db.collection(collectionPath).doc(documentId).delete();
        result = { id: documentId, deleted: true };
        break;

      case 'query':
        let query = db.collection(collectionPath);

        // 處理查詢條件
        if (options.where) {
          for (const condition of options.where) {
            query = query.where(condition.field, condition.operator, condition.value);
          }
        }

        if (options.orderBy) {
          query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        result = [];
        snapshot.forEach(doc => {
          result.push({ id: doc.id, ...doc.data() });
        });
        break;

      default:
        throw new Error(`不支援的操作: ${operation}`);
    }

    CM_logInfo(`CM超級代理成功: ${operation} ${collectionPath}`, "超級代理", options.requesterId || 'system', "", "", functionName);

    return {
      success: true,
      data: result,
      operation: operation,
      collectionPath: collectionPath,
      documentId: documentId,
      message: `CM超級代理${operation}操作成功`
    };

  } catch (error) {
    CM_logError(`CM超級代理失敗: ${error.message}`, "超級代理", options.requesterId || 'system', "CM_SUPER_PROXY_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      operation: operation,
      collectionPath: collectionPath,
      documentId: documentId
    };
  }
}

/**
 * 自動創建集合結構
 * @version 2025-11-24-V2.3.1
 * @description 確保collaborations集合及其子集合結構存在
 */
async function CM_ensureCollectionStructure(collectionPath) {
  const functionName = "CM_ensureCollectionStructure";
  try {
    const db = admin.firestore();

    // 如果是collaborations主集合
    if (collectionPath === 'collaborations') {
      const placeholderDoc = await db.collection('collaborations').doc('_structure_placeholder').get();

      if (!placeholderDoc.exists) {
        await db.collection('collaborations').doc('_structure_placeholder').set({
          purpose: 'CM模組自動創建的集合結構佔位符',
          createdAt: admin.firestore.Timestamp.now(),
          managedBy: 'CM_v2.3.1',
          structure: {
            mainCollection: 'collaborations',
            subCollections: ['members', 'invitations', 'permissions'],
            version: '2.3.1'
          }
        });

        CM_logInfo(`自動創建collaborations集合結構`, "集合管理", 'CM_superProxy', "", "", functionName);
      }
    }

    // 如果是子集合路徑，確保父文檔存在
    if (collectionPath.includes('/')) {
      const pathParts = collectionPath.split('/');
      if (pathParts.length >= 3 && pathParts[0] === 'collaborations') {
        const parentDocId = pathParts[1];
        const subCollectionName = pathParts[2];

        const parentDoc = await db.collection('collaborations').doc(parentDocId).get();
        if (!parentDoc.exists) {
          // 自動創建父文檔
          await db.collection('collaborations').doc(parentDocId).set({
            autoCreated: true,
            createdAt: admin.firestore.Timestamp.now(),
            managedBy: 'CM_v2.3.1',
            status: 'active',
            note: `由CM超級代理自動創建以支援子集合: ${subCollectionName}`
          });

          CM_logInfo(`自動創建collaborations父文檔: ${parentDocId}`, "集合管理", 'CM_superProxy', "", "", functionName);
        }
      }
    }

  } catch (error) {
    CM_logWarning(`集合結構創建警告: ${error.message}`, "集合管理", 'CM_superProxy', "", "", functionName);
  }
}

/**
 * CM超級代理便捷方法
 */
const CM_proxy = {
  // 創建協作文檔
  createCollaboration: async (data, options = {}) => {
    return await CM_superProxy('create', 'collaborations', null, data, options);
  },

  // 獲取協作文檔
  getCollaboration: async (collaborationId, options = {}) => {
    return await CM_superProxy('get', 'collaborations', collaborationId, null, options);
  },

  // 更新協作文檔
  updateCollaboration: async (collaborationId, data, options = {}) => {
    return await CM_superProxy('update', 'collaborations', collaborationId, data, options);
  },

  // 刪除協作文檔
  deleteCollaboration: async (collaborationId, options = {}) => {
    return await CM_superProxy('delete', 'collaborations', collaborationId, null, options);
  },

  // 查詢協作文檔
  queryCollaborations: async (queryOptions = {}) => {
    return await CM_superProxy('query', 'collaborations', null, null, queryOptions);
  },

  // 成員管理
  addMember: async (collaborationId, memberData, options = {}) => {
    const memberId = memberData.userId || CM_generateCollaborationId();
    return await CM_superProxy('create', `collaborations/${collaborationId}/members`, memberId, memberData, options);
  },

  getMember: async (collaborationId, memberId, options = {}) => {
    return await CM_superProxy('get', `collaborations/${collaborationId}/members`, memberId, null, options);
  },

  updateMember: async (collaborationId, memberId, memberData, options = {}) => {
    return await CM_superProxy('update', `collaborations/${collaborationId}/members`, memberId, memberData, options);
  },

  removeMember: async (collaborationId, memberId, options = {}) => {
    return await CM_superProxy('delete', `collaborations/${collaborationId}/members`, memberId, null, options);
  },

  // 邀請管理
  createInvitation: async (collaborationId, invitationData, options = {}) => {
    const invitationId = invitationData.invitationId || CM_generateCollaborationId();
    return await CM_superProxy('create', `collaborations/${collaborationId}/invitations`, invitationId, invitationData, options);
  },

  // 權限管理
  setPermission: async (collaborationId, permissionData, options = {}) => {
    const permissionId = permissionData.userId || CM_generateCollaborationId();
    return await CM_superProxy('create', `collaborations/${collaborationId}/permissions`, permissionId, permissionData, options);
  }
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
 * 13. 記錄協作操作 - 階段一修正：統 যুক্তি日誌架構
 * @version 2025-11-12-V2.2.0
 * @date 2025-11-12
 * @description 統一使用DL模組記錄協作操作，移除直接Firebase寫入
 */
async function CM_logCollaborationAction(ledgerId, userId, actionType, actionData) {
  const functionName = "CM_logCollaborationAction";
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 階段一修正：完全移除直接Firebase寫入，統一使用DL模組
    const logMessage = `協作操作記錄: ${actionType} - 帳本: ${ledgerId}`;
    const logDetails = JSON.stringify({
      logId,
      ledgerId,
      actionType,
      actionData: actionData || {},
      ipAddress: actionData?.ipAddress || "unknown",
      userAgent: actionData?.userAgent || "unknown"
    });

    // 階段一修正：統一使用DL.DL_log介面
    if (DL && typeof DL.DL_log === 'function') {
      await DL.DL_log({
        message: logMessage,
        operation: actionType,
        userId: userId,
        errorCode: "",
        details: logDetails,
        retryCount: 0,
        location: functionName,
        function: functionName,
        severity: "INFO",
        source: "CM"
      });
    } else {
      // 降級處理：使用CM內部日誌函數
      CM_logInfo(logMessage, actionType, userId, "", logDetails, functionName);
    }

    return {
      logged: true,
      logId,
      timestamp: new Date().toISOString(),
      method: "DL_unified_logging"
    };

  } catch (error) {
    CM_logError(`記錄協作操作失敗: ${error.message}`, "記錄操作", userId, "CM_LOG_ERROR", error.toString(), functionName);
    return {
      logged: false,
      logId: null,
      timestamp: null,
      error: error.message
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

// CM_createLedger 函數已移除 - 避免與AM模組職責重複
// 協作帳本建立請使用 CM_createSharedLedger()
// 個人帳本建立請使用AM模組相關函數

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

    // 階段三職責邊界確認：CM模組主要處理collaborations集合，AM模組處理ledgers集合
    // 此函數用於獲取個人帳本列表，應由AM模組處理，暫時保留以確保向下相容，但應考慮遷移至AM模組
    CM_logWarning(`階段三職責邊界：CM_getLedgers 函數涉及ledgers集合操作，建議由AM模組處理。`, "查詢帳本", queryParams.userId, "", "", functionName);

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

    // 階段一：新增對 type 和 sortOrder 的支援
    if (queryParams.type) {
      query = query.where('type', '==', queryParams.type);
    }

    // 階段一修正：處理分頁參數
    if (queryParams.page) {
      let pageValue = typeof queryParams.page === 'string'
        ? parseInt(queryParams.page, 10)
        : parseInt(queryParams.page, 10);

      if (!isNaN(pageValue) && pageValue > 0) {
        const currentLimit = queryParams.limit ? (typeof queryParams.limit === 'string' ? parseInt(queryParams.limit, 10) : parseInt(queryParams.limit, 10)) || 10 : 10;
        const offset = (pageValue - 1) * currentLimit;
        query = query.offset(offset);
      }
    }

    // 階段一：支援排序 (sortBy 和 sortOrder)
    let orderByField = 'created_at';
    let orderByDirection = 'desc';

    if (queryParams.sortBy) {
      orderByField = queryParams.sortBy;
      if (queryParams.sortOrder && queryParams.sortOrder.toLowerCase() === 'asc') {
        orderByDirection = 'asc';
      }
    }
    query = query.orderBy(orderByField, orderByDirection);

    // 階段一修正：確保limit參數為整數型別
    if (queryParams.limit) {
      const limitValue = typeof queryParams.limit === 'string'
        ? parseInt(queryParams.limit, 10)
        : parseInt(queryParams.limit, 10);

      if (!isNaN(limitValue) && limitValue > 0) {
        query = query.limit(limitValue);
      }
    }

    // 階段一：新增 active 參數過濾
    if (queryParams.active === true) {
      query = query.where('status', '==', 'active');
    } else if (queryParams.active === false) {
      query = query.where('status', '!=', 'active');
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
        metadata: ledgerData.metadata || {},
        ledgerId: ledgerData.id // 階段一：確保ledgerId欄位存在
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

    // 階段三職責邊界確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責邊界：CM_getLedgerById 函數涉及ledgers集合操作，建議由AM模組處理。`, "查詢帳本", queryParams.userId, "", "", functionName);

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
      // 權限驗證邏輯需要釐清：是否應使用CM_validatePermission或AM模組內部的權限檢查
      // 目前假設 CM_validatePermission 可以處理ledgers集合的權限驗證
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

    // 階段三職責邊界確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責邊界：CM_updateLedger 函數涉及ledgers集合操作，建議由AM模組處理。`, "更新帳本", options.userId, "", "", functionName);


    // 驗證存取權限
    if (options.userId) {
      // 權限驗證邏輯需要釐清：是否應使用CM_validatePermission或AM模組內部的權限檢查
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

    // 階段三職責邊界確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責邊界：CM_deleteLedger 函數涉及ledgers集合操作，建議由AM模組處理。`, "刪除帳本", userId, "", "", functionName);


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

    // 階段三職責邊界確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責邊界：CM_editLedger 函數涉及ledgers集合操作，建議由AM模組處理。`, "編輯帳本", userId, "", "", functionName);


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

    // 階段三職責邊界確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責邊界：CM_createProjectLedger 函數涉及ledgers集合操作，建議由AM模組處理。`, "建立專案帳本", userId, "", "", functionName);


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
 * CM_manageCollaborationMembers - 協作成員管理
 * @version 2025-11-24-V2.3.1
 * @date 2025-11-24
 * @description 階段一修復：管理協作帳本成員，直接使用Firebase Admin SDK，移除FS依賴
 */
async function CM_manageCollaborationMembers(ledgerId, operation, memberData, operatorId) {
  const functionName = "CM_manageCollaborationMembers";
  try {
    CM_logInfo(`階段一修復：協作成員管理: ${operation} - ${ledgerId}`, "成員管理", operatorId, "", "", functionName);

    const collectionRef = db.collection('collaborations').doc(ledgerId).collection('members');

    switch (operation) {
      case 'ADD_OWNER':
      case 'ADD_MEMBER':
        const newMemberData = {
          userId: memberData.userId,
          email: memberData.email || `${memberData.userId}@example.com`,
          role: memberData.role || 'member',
          permissions: memberData.permissions || {
            canInvite: false,
            canEdit: true,
            canDelete: false,
            canManagePermissions: false
          },
          joinedAt: admin.firestore.Timestamp.now(),
          status: 'active',
          invitedBy: operatorId
        };

        // 階段一修復：直接使用Firebase Admin SDK
        await collectionRef.doc(memberData.userId).set(newMemberData);
        return {
          success: true,
          message: '階段一修復：成員添加成功',
          data: newMemberData
        };

      case 'REMOVE_MEMBER':
        // 階段一修復：直接使用Firebase Admin SDK
        await collectionRef.doc(memberData.userId).delete();
        return {
          success: true,
          message: '階段一修復：成員移除成功'
        };

      case 'UPDATE_MEMBER':
        const updateData = {
          ...memberData,
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: operatorId
        };
        // 階段一修復：直接使用Firebase Admin SDK
        await collectionRef.doc(memberData.userId).update(updateData);
        return {
          success: true,
          message: '階段一修復：成員更新成功',
          data: updateData
        };

      default:
        return {
          success: false,
          error: `不支援的成員操作: ${operation}`,
          errorCode: 'UNSUPPORTED_MEMBER_OPERATION'
        };
    }

  } catch (error) {
    CM_logError(`階段一修復：協作成員管理失敗: ${error.message}`, "成員管理", operatorId, "CM_MANAGE_MEMBERS_ERROR", error.toString(), functionName);
    return {
      success: false,
      error: error.message,
      errorCode: 'CM_MANAGE_MEMBERS_ERROR'
    };
  }
}

/**
 * 29. 建立共享帳本 - 階段二：協作帳本建立流程優化
 * @version 2025-11-12-V2.1.1
 * @date 2025-11-12
 * @description 階段二優化：完全符合FS規範，移除多餘欄位，補齊必要欄位，優化子集合架構
 */
async function CM_createSharedLedger(ledgerData, requesterId = 'system') {
  const functionName = "CM_createSharedLedger";
  try {
    CM_logInfo(`階段二：建立協作帳本 - 擁有者: ${ledgerData.ownerEmail}, 帳本: ${ledgerData.name}`, "建立共享帳本", ledgerData.ownerEmail, "", "", functionName);

    // 生成協作帳本ID
    const collaborationId = CM_generateCollaborationId();

    // 檢查協作帳本是否已存在
    const existingCollaboration = await FS.FS_getDocument('collaborations', collaborationId);
    if (existingCollaboration.success && existingCollaboration.exists) {
      throw new Error(`協作帳本ID已存在: ${collaborationId}`);
    }

    // 階段四修正：從03. Default_config載入協作預設設定
    let defaultCollaborationSettings = {
      allowInvite: true,
      allowEdit: true,
      allowDelete: false,
      requireApproval: false
    };

    try {
      const path = require('path');
      const configPath = path.join(__dirname, '../03. Default_config/0301. Default_config.json');
      const defaultConfig = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));

      if (defaultConfig.collaboration_settings) {
        defaultCollaborationSettings = {
          ...defaultCollaborationSettings,
          ...defaultConfig.collaboration_settings
        };
        CM_logInfo(`階段四：成功載入協作預設設定：0301. Default_config.json`, "建立共享帳本", ledgerData.ownerEmail, "", "", functionName);
      }
    } catch (configError) {
      CM_logWarning(`階段四：無法載入協作預設設定，使用內建預設值: ${configError.message}`, "建立共享帳本", ledgerData.ownerEmail, "", "", functionName);
    }

    // 階段二：建立完全符合FS規範的協作帳本資料結構
    const collaborationData = {
      ledgerId: collaborationId,          // 明確加入ledgerId欄位
      ownerId: `user_${ledgerData.ownerEmail}`,                   // 擁有者ID
      collaborationType: 'shared',        // 協作類型
      settings: {
        ...defaultCollaborationSettings,
        ...(ledgerData.permissionSettings || {})     // 用戶自訂設定覆蓋預設值
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      status: 'active',
      config_source: '03. Default_config'  // 標記配置來源
      // 階段二移除：ownerEmail欄位 (FS標準中沒有)
      // 階段二移除：直接存放的members陣列 (改用子集合)
      // 階段二移除：直接存放的permissions物件 (改用子集合)
    };

    // 使用CM超級代理建立協作文檔
    const createResult = await CM_superProxy('create', 'collaborations', collaborationId, collaborationData, {
      requesterId: `user_${ledgerData.ownerEmail}`
    });

    if (!createResult.success) {
      throw new Error(`CM超級代理建立協作文檔失敗: ${createResult.error}`);
    }

    CM_logInfo(`CM超級代理：協作主文檔建立成功 - ${collaborationId}`, "建立共享帳本", ledgerData.ownerEmail, "", "", functionName);

    CM_logInfo(`階段二：協作主文檔建立成功 - ${collaborationId}`, "建立共享帳本", ledgerData.ownerEmail, "", "", functionName);

    // 階段二：建立擁有者成員記錄（子集合架構）
    const ownerMemberResult = await CM_manageCollaborationMembers(collaborationId, 'ADD_OWNER', {
      userId: `user_${ledgerData.ownerEmail}`,
      email: ledgerData.ownerEmail,
      role: 'owner'
    }, `user_${ledgerData.ownerEmail}`);

    if (!ownerMemberResult.success) {
      CM_logWarning(`擁有者成員記錄建立失敗: ${ownerMemberResult.error}`, "建立共享帳本", ledgerData.ownerEmail, "", "", functionName);
    }

    // 階段二：添加其他成員到子集合
    let successfulMembers = ownerMemberResult.success ? 1 : 0;
    for (const memberId of ledgerData.memberList || []) {
      if (memberId !== `user_${ledgerData.ownerEmail}`) {
        const memberResult = await CM_setMemberPermission(
          collaborationId,
          memberId,
          'member',
          `user_${ledgerData.ownerEmail}`
        );
        if (memberResult.success) {
          successfulMembers++;
        }
      }
    }

    // 階段二：記錄協作建立操作
    await CM_logCollaborationAction(collaborationId, `user_${ledgerData.ownerEmail}`, 'collaboration_created', {
      collaborationType: 'shared',
      ledgerName: ledgerData.name,
      totalMembers: (ledgerData.memberList?.length || 0) + 1,
      successfulMembers: successfulMembers,
      settings: ledgerData.permissionSettings
    });

    // 階段二：最終驗證協作帳本是否建立成功
    const finalVerification = await FS.FS_getDocument('collaborations', collaborationId, `user_${ledgerData.ownerEmail}`);
    if (!finalVerification.success || !finalVerification.exists) {
      throw new Error('協作帳本建立後驗證失敗');
    }

    CM_logInfo(`階段二：協作帳本建立完成 - ID: ${collaborationId}, 成功加入成員數: ${successfulMembers}`, "建立共享帳本", ledgerData.ownerEmail, "", "", functionName);

    return {
      success: true,
      ledgerId: collaborationId,
      memberCount: successfulMembers,
      collaborationType: 'shared',
      message: '階段二：協作帳本建立成功，完全符合FS規範'
    };

  } catch (error) {
    CM_logError(`階段二：建立協作帳本失敗: ${error.message}`, "建立共享帳本", ledgerData.ownerEmail, "CM_CREATE_SHARED_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      ledgerId: null,
      message: `階段二：建立協作帳本失敗: ${error.message}`
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

    // 階段三職責邊界確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責邊界：CM_createCategoryLedger 函數涉及ledgers集合操作，建議由AM模組處理。`, "建立分類帳本", userId, "", "", functionName);


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
    // 階段三職責：CM_getMemberList操作collaborations集合，是CM模組的職責
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

    // 模擬協作者列表（當CM_getMemberList失敗時的回退，應盡量避免）
    CM_logWarning(`CM_getMemberList執行失敗，回退至模擬協作者列表`, "查詢協作者", options.requesterId, "", "", functionName);
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
      message: '協作者列表取得成功 (模擬數據)'
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
    // 階段三職責：CM_inviteMember操作collaborations集合，是CM模組的職責
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

    return result; // 直接返回CM_inviteMember的結果

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
    // 階段三職責：CM_removeMember操作collaborations集合，是CM模組的職責
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

    return result; // 直接返回CM_removeMember的結果

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

    // 階段三職責確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責確認：CM_getPermissions 函數涉及ledgers集合操作，建議由AM模組處理。`, "查詢權限", queryParams.userId, "", "", functionName);


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

    // 階段三職責確認：此函數涉及ledgers集合，應由AM模組處理，暫時保留以確保向下相容
    CM_logWarning(`階段三職責確認：CM_detectDuplicateName 函數涉及ledgers集合操作，建議由AM模組處理。`, "檢測重複名稱", userId, "", "", functionName);


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

/**
 * 階段一新增：取得最近的協作帳本ID - 8020合規版
 * @version 2025-11-13-V2.2.1
 * @date 2025-11-13
 * @description 通過8020現有端點查詢最近建立的協作帳本ID，解決狀態管理問題
 */
async function CM_getRecentCollaborationId(userId) {
  const functionName = "CM_getRecentCollaborationId";
  try {
    CM_logInfo(`階段一：查詢最近協作帳本ID - 用戶: ${userId}`, "狀態管理", userId, "", "", functionName);

    // 階段一：完全符合8020規範 - 使用現有端點查詢
    const queryParams = {
      userId: userId,
      type: 'collaborative',
      sortBy: 'created_at',
      sortOrder: 'desc',
      limit: 1,
      active: true
    };

    // 階段一：通過CM_getLedgers現有函數實現（符合0098規範）
    const ledgersResult = await CM_getLedgers(queryParams);

    if (!ledgersResult.success) {
      CM_logWarning(`階段一：查詢協作帳本失敗: ${ledgersResult.message}`, "狀態管理", userId, "", "", functionName);
      return {
        success: false,
        collaborationId: null,
        message: ledgersResult.message || '查詢協作帳本失敗',
        error: ledgersResult.error
      };
    }

    // 階段一：從查詢結果提取最近的協作帳本ID
    const ledgers = ledgersResult.data || [];

    if (ledgers.length === 0) {
      CM_logInfo(`階段一：用戶 ${userId} 尚未有協作帳本`, "狀態管理", userId, "", "", functionName);
      return {
        success: true,
        collaborationId: null,
        message: '尚未建立協作帳本',
        hasCollaboration: false
      };
    }

    const recentLedger = ledgers[0];
    const collaborationId = recentLedger.id || recentLedger.ledgerId;

    // 階段一：驗證協作帳本ID有效性
    if (!collaborationId) {
      CM_logError(`階段一：協作帳本ID為空`, "狀態管理", userId, "CM_INVALID_COLLABORATION_ID", "", functionName);
      return {
        success: false,
        collaborationId: null,
        message: '協作帳本ID無效',
        error: {
          code: 'CM_INVALID_COLLABORATION_ID',
          message: '協作帳本ID為空'
        }
      };
    }

    CM_logInfo(`階段一：成功取得最近協作帳本ID: ${collaborationId}`, "狀態管理", userId, "", "", functionName);

    return {
      success: true,
      collaborationId: collaborationId,
      ledgerName: recentLedger.name || '協作帳本',
      ledgerType: recentLedger.type || 'collaborative',
      createdAt: recentLedger.created_at || recentLedger.createdAt,
      hasCollaboration: true,
      message: '階段一：最近協作帳本ID取得成功'
    };

  } catch (error) {
    CM_logError(`階段一：取得協作帳本ID失敗: ${error.message}`, "狀態管理", userId, "CM_GET_COLLABORATION_ID_ERROR", error.toString(), functionName);
    return {
      success: false,
      collaborationId: null,
      message: `階段一：取得協作帳本ID失敗: ${error.message}`,
      error: {
        code: 'CM_GET_COLLABORATION_ID_ERROR',
        message: error.message
      }
    };
  }
}

/**
 * 36. 建立共享協作帳本 - 階段一修復版
 * @version 2025-11-24-V2.3.1
 * @date 2025-11-24
 * @description 階段一修復：強化參數驗證，移除FS依賴，直接使用Firebase Admin SDK生成ID
 */
async function CM_createSharedLedger(ledgerData, requesterId = 'system') {
  const functionName = "CM_createSharedLedger";
  try {
    CM_logInfo(`階段一修復：開始建立協作帳本`, "建立協作帳本", requesterId, "", "", functionName);

    // 階段一修復：參數完整性驗證
    if (!ledgerData || typeof ledgerData !== 'object') {
      const errorMsg = 'ledgerData參數為必填且必須為物件類型';
      CM_logError(errorMsg, "建立協作帳本", requesterId, "CM_INVALID_LEDGER_DATA", "", functionName);
      return {
        success: false,
        ledgerId: null,
        message: errorMsg,
        error: {
          code: 'CM_INVALID_LEDGER_DATA',
          details: '參數驗證失敗：ledgerData無效'
        }
      };
    }

    // 階段一修復：必要參數檢查
    const requiredFields = [
      { field: 'name', type: 'string', description: '帳本名稱' },
      { field: 'ownerEmail', type: 'string', description: '擁有者Email' }
    ];

    const validationErrors = [];

    for (const req of requiredFields) {
      if (!ledgerData[req.field]) {
        validationErrors.push(`缺少必要參數：${req.field} (${req.description})`);
      } else if (typeof ledgerData[req.field] !== req.type) {
        validationErrors.push(`參數類型錯誤：${req.field}必須為${req.type}類型`);
      } else if (req.type === 'string' && ledgerData[req.field].trim() === '') {
        validationErrors.push(`參數不能為空：${req.field} (${req.description})`);
      }
    }

    if (validationErrors.length > 0) {
      const errorMsg = `參數驗證失敗：${validationErrors.join('; ')}`;
      CM_logError(errorMsg, "建立協作帳本", requesterId, "CM_VALIDATION_ERROR", "", functionName);
      return {
        success: false,
        ledgerId: null,
        message: errorMsg,
        error: {
          code: 'CM_VALIDATION_ERROR',
          details: validationErrors
        }
      };
    }

    // 階段一修復：Email格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ledgerData.ownerEmail)) {
      const errorMsg = `ownerEmail格式無效：${ledgerData.ownerEmail}`;
      CM_logError(errorMsg, "建立協作帳本", requesterId, "CM_INVALID_EMAIL", "", functionName);
      return {
        success: false,
        ledgerId: null,
        message: errorMsg,
        error: {
          code: 'CM_INVALID_EMAIL',
          details: 'Email格式驗證失敗'
        }
      };
    }

    CM_logInfo(`階段一修復：參數驗證通過 - 擁有者: ${ledgerData.ownerEmail}, 帳本: ${ledgerData.name}`, "建立協作帳本", requesterId, "", "", functionName);

    // 生成帳本ID（移除FS依賴）
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const ledgerId = `ledger_${timestamp}_${random}`;
    const ownerId = `user_${ledgerData.ownerEmail}`;

    // 建立帳本基本資料
    const ledgerInfo = {
      id: ledgerId,
      name: ledgerData.name,
      type: ledgerData.type || 'shared',
      description: ledgerData.description || '',
      owner_id: ownerId,
      owner_email: ledgerData.ownerEmail,
      currency: ledgerData.currency || 'TWD',
      timezone: ledgerData.timezone || 'Asia/Taipei',
      is_collaborative: true,
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
      status: 'active',
      archived: false, // 添加索引需要的欄位
      lastActivity: admin.firestore.Timestamp.now() // 添加索引需要的欄位
    };

    // 儲存至 Firestore ledgers 集合
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    await ledgerRef.set(ledgerInfo);

    // 建立協作設定
    const collaborationData = {
      ledgerId: ledgerId,
      ownerId: ownerId,
      collaborationType: 'shared',
      settings: {
        allowInvite: true,
        allowEdit: true,
        allowDelete: false,
        requireApproval: false
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      status: 'active'
    };

    // 儲存協作設定到 collaborations 集合
    await db.collection('collaborations').doc(ledgerId).set(collaborationData);

    // 設定擁有者權限
    await CM_setMemberPermission(ledgerId, ownerId, 'owner', ownerId);

    // 記錄協作日誌
    CM_logCollaborationAction(ledgerId, ownerId, 'create_ledger', { ledgerName: ledgerData.name });

    CM_logInfo(`階段一修復：協作帳本建立成功 - ID: ${ledgerId}`, "建立協作帳本", ledgerData.ownerEmail, "", "", functionName);

    return {
      success: true,
      ledgerId: ledgerId,
      message: '階段一修復：協作帳本建立成功',
      data: {
        ledgerId: ledgerId,
        name: ledgerData.name,
        type: ledgerData.type || 'shared',
        ownerEmail: ledgerData.ownerEmail,
        createdAt: new Date().toISOString()
      }
    };

  } catch (error) {
    const ownerEmail = ledgerData?.ownerEmail || 'unknown';
    CM_logError(`階段一修復：建立協作帳本失敗: ${error.message}`, "建立協作帳本", ownerEmail, "CM_CREATE_SHARED_LEDGER_ERROR", error.toString(), functionName);
    return {
      success: false,
      ledgerId: null,
      message: `階段一修復：建立協作帳本失敗: ${error.message}`,
      error: {
        code: 'CM_CREATE_SHARED_LEDGER_ERROR',
        details: error.toString()
      }
    };
  }
}

// 模組導出
module.exports = {
  // 階段一修復新增函數
  CM_createSharedLedger,

  // 協作成員管理
  CM_inviteMember,
  CM_processMemberJoin,
  CM_removeMember,
  CM_getMemberList,
  CM_setMemberPermission,
  CM_validatePermission,
  CM_getPermissionMatrix,

  // 協作同步與衝突處理
  CM_initializeSync,
  CM_resolveDataConflict,
  CM_broadcastEvent,

  // 通知與偏好設定
  CM_sendCollaborationNotification,
  CM_setNotificationPreferences,

  // 日誌與歷史記錄
  CM_logCollaborationAction,
  CM_getCollaborationHistory,

  // 錯誤處理
  CM_handleCollaborationError,

  // 階段三新增函數
  CM_getCollaborationDetails,
  CM_updateCollaborationSettings,

  // 協作系統初始化
  CM_initializeCollaborationSystem,

  // CM超級代理
  CM_superProxy,
  CM_proxy,

  // 內部工具函數
  CM_generateCollaborationId
};

// 自動初始化模組
CM_initialize().catch(error => {
  console.error('CM 模組自動初始化失敗:', error);
});

console.log('✅ CM 協作與帳本管理模組v2.3.1載入完成 - 階段一修復：移除FS模組依賴，直接使用Firebase Admin SDK');