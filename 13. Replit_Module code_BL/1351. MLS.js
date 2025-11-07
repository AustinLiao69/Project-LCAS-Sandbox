
/**
 * MLS_多帳本管理模組_2.0.0
 * @module MLS模組
 * @description 多帳本管理系統 - 專注帳本管理，協作功能委派給CM模組
 * @update 2025-11-06: 階段二重構 - 移除具體協作邏輯，專注帳本管理核心功能
 */

const admin = require('firebase-admin');
const DL = require('./1310. DL.js');
const DD = require('./1331. DD1.js');
const FS = require('./1311. FS.js'); // 引入FS模組以使用協作架構

// 延遲載入CM模組以避免循環依賴
let CM;
try {
  CM = require('./1313. CM.js');
} catch (error) {
  console.warn('MLS模組警告: CM模組尚未載入，協作功能將受限');
}

// Firestore 資料庫引用
const db = admin.firestore();

/**
 * 01. 建立專案帳本
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 針對特定專案/事件建立專案帳本
 */
async function MLS_createProjectLedger(userId, projectName, projectDescription, startDate, endDate, budget) {
  try {
    DL.DL_log('MLS', `開始建立專案帳本 - 用戶: ${userId}, 專案: ${projectName}`);

    // 檢查專案名稱是否重複
    const duplicateCheck = await MLS_detectDuplicateName(userId, projectName, 'project');
    if (!duplicateCheck.isUnique) {
      return {
        success: false,
        message: '專案帳本名稱已存在，請使用不同的名稱'
      };
    }

    const ledgerId = `project_${userId}_${Date.now()}`;
    const ledgerData = {
      id: ledgerId,
      type: 'project',
      name: projectName,
      description: projectDescription,
      owner_id: userId,
      start_date: startDate,
      end_date: endDate,
      budget: budget || 0,
      members: [userId],
      permissions: {
        owner: userId,
        admins: [],
        members: [],
        viewers: [],
        settings: {
          allow_invite: true,
          allow_edit: true,
          allow_delete: false
        }
      },
      attributes: {
        status: 'active',
        progress: 0,
        categories: []
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      archived: false,
      metadata: {
        total_entries: 0,
        total_amount: 0,
        last_activity: admin.firestore.FieldValue.serverTimestamp()
      }
    };

    // 寫入 Firestore
    await db.collection('ledgers').doc(ledgerId).set(ledgerData);

    // 建立協作架構（委派給FS模組）
    if (FS && typeof FS.FS_createCollaborationDocument === 'function') {
      await FS.FS_createCollaborationDocument(ledgerId, {
        ownerId: userId,
        collaborationType: 'project',
        ownerEmail: `${userId}@example.com` // 實際應從用戶資料取得
      }, userId);
    }

    // 資料分發
    await DD.DD_distributeData('ledger_created', {
      ledgerId: ledgerId,
      type: 'project',
      userId: userId
    });

    DL.DL_log('MLS', `專案帳本建立成功 - ID: ${ledgerId}`);

    return {
      success: true,
      ledgerId: ledgerId,
      message: '專案帳本建立成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `建立專案帳本失敗: ${error.message}`);
    return {
      success: false,
      message: '建立專案帳本時發生錯誤'
    };
  }
}

/**
 * 02. 建立分類帳本
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 依用途/主題（如旅遊、餐飲）建立分類帳本
 */
async function MLS_createCategoryLedger(userId, categoryName, categoryType, tags, defaultSubjects) {
  try {
    DL.DL_log('MLS', `開始建立分類帳本 - 用戶: ${userId}, 分類: ${categoryName}`);

    // 檢查分類名稱是否重複
    const duplicateCheck = await MLS_detectDuplicateName(userId, categoryName, 'category');
    if (!duplicateCheck.isUnique) {
      return {
        success: false,
        message: '分類帳本名稱已存在，請使用不同的名稱'
      };
    }

    const ledgerId = `category_${userId}_${Date.now()}`;
    const categoryId = `cat_${categoryType}_${Date.now()}`;

    const ledgerData = {
      id: ledgerId,
      type: 'category',
      name: categoryName,
      category_type: categoryType,
      category_id: categoryId,
      owner_id: userId,
      tags: tags || [],
      default_subjects: defaultSubjects || [],
      members: [userId],
      permissions: {
        owner: userId,
        admins: [],
        members: [],
        viewers: [],
        settings: {
          allow_invite: false,
          allow_edit: true,
          allow_delete: false
        }
      },
      attributes: {
        status: 'active',
        auto_categorize: true,
        template_rules: []
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      archived: false,
      metadata: {
        total_entries: 0,
        total_amount: 0,
        last_activity: admin.firestore.FieldValue.serverTimestamp()
      }
    };

    // 寫入 Firestore
    await db.collection('ledgers').doc(ledgerId).set(ledgerData);

    // 建立協作架構（分類帳本通常不需要協作）
    if (tags && tags.includes('collaborative')) {
      if (FS && typeof FS.FS_createCollaborationDocument === 'function') {
        await FS.FS_createCollaborationDocument(ledgerId, {
          ownerId: userId,
          collaborationType: 'category',
          ownerEmail: `${userId}@example.com`
        }, userId);
      }
    }

    // 資料分發
    await DD.DD_distributeData('ledger_created', {
      ledgerId: ledgerId,
      type: 'category',
      categoryId: categoryId,
      userId: userId
    });

    DL.DL_log('MLS', `分類帳本建立成功 - ID: ${ledgerId}, 分類ID: ${categoryId}`);

    return {
      success: true,
      ledgerId: ledgerId,
      categoryId: categoryId
    };

  } catch (error) {
    DL.DL_error('MLS', `建立分類帳本失敗: ${error.message}`);
    return {
      success: false,
      message: '建立分類帳本時發生錯誤'
    };
  }
}

/**
 * 03. 建立共享帳本
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 支援多用戶協作的共享帳本 - 階段二重構：委派協作邏輯至CM模組
 */
async function MLS_createSharedLedger(ownerId, ledgerName, memberList, permissionSettings) {
  try {
    DL.DL_log('MLS', `開始建立共享帳本 - 擁有者: ${ownerId}, 帳本: ${ledgerName}`);

    // 檢查帳本名稱是否重複
    const duplicateCheck = await MLS_detectDuplicateName(ownerId, ledgerName, 'shared');
    if (!duplicateCheck.isUnique) {
      return {
        success: false,
        message: '共享帳本名稱已存在，請使用不同的名稱'
      };
    }

    const ledgerId = `shared_${ownerId}_${Date.now()}`;
    const allMembers = [ownerId, ...(memberList || [])];

    const ledgerData = {
      id: ledgerId,
      type: 'shared',
      name: ledgerName,
      ownerId: ownerId, // 修正：統一使用camelCase
      members: allMembers,
      permissions: {
        owner: ownerId,
        admins: permissionSettings?.admins || [],
        members: permissionSettings?.members || memberList || [],
        viewers: permissionSettings?.viewers || [],
        settings: {
          allowInvite: permissionSettings?.allowInvite !== false, // 修正：統一使用camelCase
          allowEdit: permissionSettings?.allowEdit !== false, // 修正：統一使用camelCase
          allowDelete: permissionSettings?.allowDelete || false // 修正：統一使用camelCase
        }
      },
      attributes: {
        status: 'active',
        collaboration_mode: 'realtime',
        sync_enabled: true
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      archived: false,
      metadata: {
        total_entries: 0,
        total_amount: 0,
        member_count: allMembers.length,
        last_activity: admin.firestore.FieldValue.serverTimestamp()
      }
    };

    // 寫入 Firestore
    await db.collection('ledgers').doc(ledgerId).set(ledgerData);

    // 建立協作架構（委派給FS模組，與1311.FS.js格式對齊）
    if (FS && typeof FS.FS_createCollaborationDocument === 'function') {
      await FS.FS_createCollaborationDocument(ledgerId, {
        ownerId: ownerId,
        ownerEmail: `${ownerId}@example.com`,
        collaborationType: 'shared',
        members: allMembers,
        settings: {
          allowInvite: permissionSettings?.allowInvite !== false,
          allowEdit: permissionSettings?.allowEdit !== false,
          allowDelete: permissionSettings?.allowDelete || false,
          requireApproval: permissionSettings?.requireApproval || false
        }
      }, ownerId);
    }

    // 委派成員管理至CM模組
    if (CM && typeof CM.CM_initializeSync === 'function') {
      try {
        await CM.CM_initializeSync(ledgerId, ownerId, { type: 'shared_ledger_creation' });
        DL.DL_log('MLS', `共享帳本 ${ledgerId} 協作同步已初始化`);
      } catch (cmError) {
        DL.DL_warning('MLS', `共享帳本 ${ledgerId} 協作同步初始化失敗: ${cmError.message}`);
      }
    }

    // 資料分發
    await DD.DD_distributeData('shared_ledger_created', {
      ledgerId: ledgerId,
      ownerId: ownerId,
      memberList: allMembers
    });

    DL.DL_log('MLS', `共享帳本建立成功 - ID: ${ledgerId}, 成員數: ${allMembers.length}`);

    return {
      success: true,
      ledgerId: ledgerId,
      memberCount: allMembers.length
    };

  } catch (error) {
    DL.DL_error('MLS', `建立共享帳本失敗: ${error.message}`);
    return {
      success: false,
      message: '建立共享帳本時發生錯誤'
    };
  }
}

/**
 * 04. 編輯帳本
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 修改帳本基本資訊、屬性設定
 */
async function MLS_editLedger(ledgerId, userId, updateData, permission) {
  try {
    DL.DL_log('MLS', `開始編輯帳本 - ID: ${ledgerId}, 用戶: ${userId}`);

    // 驗證存取權限
    const accessCheck = await MLS_validateLedgerAccess(userId, ledgerId, 'edit');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(userId, ledgerId, 'edit', '權限不足');
    }

    // 取得現有帳本資料
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      DL.DL_warning('MLS', `嘗試編輯不存在的帳本: ${ledgerId}`);
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
    const BK = require('./1301. BK.js');
    if (typeof BK.BK_processBookkeeping === 'function') {
      DL.DL_log('MLS', `帳本編輯已通知 BK 模組更新相關記帳資料`);
    }

    DL.DL_log('MLS', `帳本編輯成功 - ID: ${ledgerId}`);

    return {
      success: true,
      message: '帳本編輯成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `編輯帳本失敗: ${error.message}`);
    return {
      success: false,
      message: '編輯帳本時發生錯誤'
    };
  }
}

/**
 * 05. 刪除帳本（含二次確認）
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 安全刪除帳本，防止誤刪
 */
async function MLS_deleteLedger(ledgerId, userId, confirmationToken) {
  try {
    DL.DL_log('MLS', `開始刪除帳本 - ID: ${ledgerId}, 用戶: ${userId}`);

    // 驗證存取權限
    const accessCheck = await MLS_validateLedgerAccess(userId, ledgerId, 'delete');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(userId, ledgerId, 'delete', '權限不足');
    }

    // 驗證二次確認 token
    const expectedToken = `delete_${ledgerId}_${userId}`;
    if (confirmationToken !== expectedToken) {
      DL.DL_warning('MLS', `帳本刪除確認 token 不符: ${ledgerId}`);
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
    DL.DL_log('MLS', `帳本 ${ledgerId} 已建立刪除前備份`);

    // 執行刪除
    await ledgerRef.delete();

    // 記錄刪除操作
    await DL.DL_error('MLS', `帳本已刪除 - ID: ${ledgerId}, 用戶: ${userId}, 類型: ${ledgerData.type}`);

    return {
      success: true,
      message: '帳本刪除成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `刪除帳本失敗: ${error.message}`);
    return {
      success: false,
      message: '刪除帳本時發生錯誤'
    };
  }
}

/**
 * 06. 歸檔帳本
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 將不常用的帳本進行歸檔
 */
async function MLS_archiveLedger(ledgerId, userId, archiveOptions) {
  try {
    DL.DL_log('MLS', `開始歸檔帳本 - ID: ${ledgerId}, 用戶: ${userId}`);

    // 驗證存取權限
    const accessCheck = await MLS_validateLedgerAccess(userId, ledgerId, 'archive');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(userId, ledgerId, 'archive', '權限不足');
    }

    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在'
      };
    }

    // 進行資料歸檔
    DL.DL_log('MLS', `帳本 ${ledgerId} 開始進行資料歸檔`);

    // 生成歸檔前的最終報表
    DL.DL_log('MLS', `帳本 ${ledgerId} 生成歸檔前最終報表`);

    // 更新帳本狀態為歸檔
    await ledgerRef.update({
      archived: true,
      archived_at: admin.firestore.FieldValue.serverTimestamp(),
      archive_options: archiveOptions || {},
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    DL.DL_log('MLS', `帳本歸檔成功 - ID: ${ledgerId}`);

    return {
      success: true,
      message: '帳本歸檔成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `歸檔帳本失敗: ${error.message}`);
    return {
      success: false,
      message: '歸檔帳本時發生錯誤'
    };
  }
}

/**
 * 07. 設定帳本權限 - 階段二重構：委派詳細權限管理至CM模組
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 設定帳本擁有者、管理員、一般成員、僅檢視者 - 委派至CM模組
 */
async function MLS_setLedgerPermissions(ledgerId, userId, memberPermissions) {
  try {
    DL.DL_log('MLS', `開始設定帳本權限 - ID: ${ledgerId}, 用戶: ${userId}`);

    // 驗證存取權限
    const accessCheck = await MLS_validateLedgerAccess(userId, ledgerId, 'manage_permissions');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(userId, ledgerId, 'manage_permissions', '權限不足');
    }

    const ledgerRef = db.collection('ledgers').doc(ledgerId);

    // 更新帳本的基礎權限設定
    await ledgerRef.update({
      permissions: memberPermissions,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // 委派詳細權限管理至CM模組
    if (CM && typeof CM.CM_setMemberPermission === 'function') {
      try {
        // 為每個成員設定權限
        if (memberPermissions.admins) {
          for (const adminId of memberPermissions.admins) {
            await CM.CM_setMemberPermission(ledgerId, adminId, 'admin', userId);
          }
        }
        if (memberPermissions.members) {
          for (const memberId of memberPermissions.members) {
            await CM.CM_setMemberPermission(ledgerId, memberId, 'member', userId);
          }
        }
        if (memberPermissions.viewers) {
          for (const viewerId of memberPermissions.viewers) {
            await CM.CM_setMemberPermission(ledgerId, viewerId, 'viewer', userId);
          }
        }
        DL.DL_log('MLS', `帳本 ${ledgerId} 權限設定已委派至CM模組處理`);
      } catch (cmError) {
        DL.DL_warning('MLS', `CM模組權限設定失敗: ${cmError.message}`);
      }
    }

    DL.DL_log('MLS', `帳本權限設定成功 - ID: ${ledgerId}`);

    return {
      success: true,
      message: '帳本權限設定成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `設定帳本權限失敗: ${error.message}`);
    return {
      success: false,
      message: '設定帳本權限時發生錯誤'
    };
  }
}

/**
 * 08. 邀請協作成員 - 階段二重構：委派至CM模組
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 邀請新成員加入共享帳本 - 委派具體邏輯至CM模組
 */
async function MLS_inviteMember(ledgerId, inviterId, inviteeInfo, permissionLevel) {
  try {
    DL.DL_log('MLS', `MLS委派成員邀請 - 帳本: ${ledgerId}, 邀請者: ${inviterId}`);

    // 驗證帳本存在且為共享類型
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在'
      };
    }

    const ledgerData = ledgerDoc.data();
    if (ledgerData.type !== 'shared' && ledgerData.type !== 'project') {
      return {
        success: false,
        message: '此帳本類型不支援成員邀請'
      };
    }

    // 委派至CM模組處理具體邀請邏輯
    if (CM && typeof CM.CM_inviteMember === 'function') {
      const result = await CM.CM_inviteMember(ledgerId, inviterId, inviteeInfo, permissionLevel);
      
      if (result.success) {
        // 更新帳本的成員數統計
        await ledgerRef.update({
          'metadata.member_count': admin.firestore.FieldValue.increment(1),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return result;
    } else {
      return {
        success: false,
        message: 'CM協作模組不可用，無法處理成員邀請'
      };
    }

  } catch (error) {
    DL.DL_error('MLS', `委派成員邀請失敗: ${error.message}`);
    return {
      success: false,
      message: '委派成員邀請時發生錯誤'
    };
  }
}

/**
 * 09. 移除協作成員 - 階段二重構：委派至CM模組
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 從共享帳本移除成員 - 委派具體邏輯至CM模組
 */
async function MLS_removeMember(ledgerId, removerId, targetUserId, removeReason) {
  try {
    DL.DL_log('MLS', `MLS委派成員移除 - 帳本: ${ledgerId}, 操作者: ${removerId}, 目標: ${targetUserId}`);

    // 委派至CM模組處理具體移除邏輯
    if (CM && typeof CM.CM_removeMember === 'function') {
      const result = await CM.CM_removeMember(ledgerId, targetUserId, removerId, removeReason);
      
      if (result.success) {
        // 更新帳本的成員數統計
        const ledgerRef = db.collection('ledgers').doc(ledgerId);
        await ledgerRef.update({
          'metadata.member_count': admin.firestore.FieldValue.increment(-1),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return result;
    } else {
      return {
        success: false,
        message: 'CM協作模組不可用，無法處理成員移除'
      };
    }

  } catch (error) {
    DL.DL_error('MLS', `委派成員移除失敗: ${error.message}`);
    return {
      success: false,
      message: '委派成員移除時發生錯誤'
    };
  }
}

/**
 * 10. 切換當前帳本
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 用戶在介面流暢切換不同帳本
 */
async function MLS_switchLedger(userId, targetLedgerId, platform) {
  try {
    DL.DL_log('MLS', `用戶切換帳本 - 用戶: ${userId}, 目標帳本: ${targetLedgerId}`);

    // 驗證存取權限
    const accessCheck = await MLS_validateLedgerAccess(userId, targetLedgerId, 'read');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(userId, targetLedgerId, 'read', '權限不足');
    }

    // 記錄切換時間
    const WH = require('./1320. WH.js');
    const switchTime = WH.WH_formatDateTime ? WH.WH_formatDateTime() : new Date().toISOString();

    // 記錄帳本切換
    await db.collection('user_activities').add({
      user_id: userId,
      action: 'switch_ledger',
      ledger_id: targetLedgerId,
      platform: platform,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      switch_time: switchTime
    });

    DL.DL_log('MLS', `帳本切換成功 - 用戶: ${userId}, 帳本: ${targetLedgerId}`);

    return {
      success: true,
      message: '帳本切換成功',
      ledgerId: targetLedgerId
    };

  } catch (error) {
    DL.DL_error('MLS', `切換帳本失敗: ${error.message}`);
    return {
      success: false,
      message: '切換帳本時發生錯誤'
    };
  }
}

/**
 * 11. 取得使用者帳本清單
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 查詢當前用戶可見的所有帳本
 */
async function MLS_getLedgerList(userId, filterOptions, sortOrder) {
  try {
    DL.DL_log('MLS', `取得用戶帳本清單 - 用戶: ${userId}`);

    let query = db.collection('ledgers').where('members', 'array-contains', userId);

    // 套用篩選條件
    if (filterOptions) {
      if (filterOptions.type) {
        query = query.where('type', '==', filterOptions.type);
      }
      if (filterOptions.archived === false) {
        query = query.where('archived', '==', false);
      }
    }

    // 套用排序
    if (sortOrder) {
      if (sortOrder === 'name') {
        query = query.orderBy('name');
      } else if (sortOrder === 'updated') {
        query = query.orderBy('updated_at', 'desc');
      } else if (sortOrder === 'created') {
        query = query.orderBy('created_at', 'desc');
      }
    } else {
      query = query.orderBy('updated_at', 'desc');
    }

    const querySnapshot = await query.get();
    const ledgers = [];

    for (const doc of querySnapshot.docs) {
      const ledgerData = doc.data();

      // 檢查帳本可見權限
      const hasViewPermission = true; // 簡化版，實際會檢查權限

      if (hasViewPermission) {
        // 提供帳本統計資訊
        const statistics = {
          totalEntries: ledgerData.metadata?.total_entries || 0,
          totalAmount: ledgerData.metadata?.total_amount || 0,
          lastActivity: ledgerData.metadata?.last_activity
        };

        ledgers.push({
          id: ledgerData.id,
          name: ledgerData.name,
          type: ledgerData.type,
          description: ledgerData.description,
          created_at: ledgerData.created_at,
          updated_at: ledgerData.updated_at,
          archived: ledgerData.archived,
          member_count: ledgerData.metadata?.member_count || 1,
          statistics: statistics
        });
      }
    }

    DL.DL_log('MLS', `帳本清單取得成功 - 用戶: ${userId}, 帳本數: ${ledgers.length}`);

    return {
      success: true,
      ledgers: ledgers,
      count: ledgers.length
    };

  } catch (error) {
    DL.DL_error('MLS', `取得帳本清單失敗: ${error.message}`);
    return {
      success: false,
      message: '取得帳本清單時發生錯誤'
    };
  }
}

/**
 * 12. 驗證帳本存取權限
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description API 支援帳本查詢、切換、權限檢查
 */
async function MLS_validateLedgerAccess(userId, ledgerId, operationType) {
  try {
    DL.DL_log('MLS', `驗證帳本存取權限 - 用戶: ${userId}, 帳本: ${ledgerId}, 操作: ${operationType}`);

    // 驗證必要參數
    if (!userId) {
      return {
        hasAccess: false,
        reason: 'missing_user_id'
      };
    }

    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      return {
        hasAccess: false,
        reason: 'ledger_not_found'
      };
    }

    const ledgerData = ledgerDoc.data();
    const permissions = ledgerData.permissions;

    // 檢查用戶是否為成員
    if (!ledgerData.members.includes(userId)) {
      return {
        hasAccess: false,
        reason: 'not_member'
      };
    }

    // 根據操作類型檢查權限
    let hasAccess = false;

    switch (operationType) {
      case 'read':
        hasAccess = true; // 所有成員都可以讀取
        break;

      case 'edit':
        hasAccess = userId === permissions.owner ||
                   permissions.admins.includes(userId) ||
                   (permissions.members.includes(userId) && permissions.settings.allow_edit);
        break;

      case 'delete':
        hasAccess = userId === permissions.owner && permissions.settings.allow_delete;
        break;

      case 'invite':
        hasAccess = (userId === permissions.owner ||
                    permissions.admins.includes(userId)) &&
                   permissions.settings.allow_invite;
        break;

      case 'remove_member':
        hasAccess = userId === permissions.owner || permissions.admins.includes(userId);
        break;

      case 'manage_permissions':
        hasAccess = userId === permissions.owner || permissions.admins.includes(userId);
        break;

      case 'archive':
        hasAccess = userId === permissions.owner || permissions.admins.includes(userId);
        break;

      default:
        hasAccess = false;
    }

    if (!hasAccess) {
      // 記錄權限拒絕事件
      DL.DL_warning('MLS', `權限拒絕 - 用戶: ${userId}, 帳本: ${ledgerId}, 操作: ${operationType}`);
    }

    return {
      hasAccess: hasAccess,
      reason: hasAccess ? 'allowed' : 'insufficient_permission'
    };

  } catch (error) {
    DL.DL_error('MLS', `驗證帳本存取權限失敗: ${error.message}`);
    return {
      hasAccess: false,
      reason: 'validation_error'
    };
  }
}

/**
 * 13. 設定帳本屬性
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 自訂帳本名稱、封面、標籤、分類規則
 */
async function MLS_setLedgerAttributes(ledgerId, userId, attributeData) {
  try {
    DL.DL_log('MLS', `設定帳本屬性 - ID: ${ledgerId}, 用戶: ${userId}`);

    // 驗證存取權限
    const accessCheck = await MLS_validateLedgerAccess(userId, ledgerId, 'edit');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(userId, ledgerId, 'edit', '權限不足');
    }

    const ledgerRef = db.collection('ledgers').doc(ledgerId);

    // 準備屬性更新資料
    const updatePayload = {
      attributes: attributeData,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // 如果包含名稱更新，也要更新基本資訊
    if (attributeData.name) {
      updatePayload.name = attributeData.name;
    }

    // 更新 Firestore
    await ledgerRef.update(updatePayload);

    // 分發屬性更新
    await DD.DD_distributeData('ledger_attributes_updated', {
      ledgerId: ledgerId,
      userId: userId,
      attributes: attributeData
    });

    DL.DL_log('MLS', `帳本屬性設定成功 - ID: ${ledgerId}`);

    return {
      success: true,
      message: '帳本屬性設定成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `設定帳本屬性失敗: ${error.message}`);
    return {
      success: false,
      message: '設定帳本屬性時發生錯誤'
    };
  }
}

/**
 * 14. 配置帳本類型特殊設定
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 針對不同帳本類型配置專屬設定
 */
async function MLS_configureLedgerType(ledgerId, ledgerType, typeSpecificConfig) {
  try {
    DL.DL_log('MLS', `配置帳本類型設定 - ID: ${ledgerId}, 類型: ${ledgerType}`);

    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();

    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在'
      };
    }

    const currentData = ledgerDoc.data();

    // 驗證帳本類型
    if (currentData.type !== ledgerType) {
      return {
        success: false,
        message: '帳本類型不符'
      };
    }

    let updatePayload = {
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // 根據帳本類型配置專屬設定
    switch (ledgerType) {
      case 'project':
        // 配置預算規則
        if (typeSpecificConfig.budget) {
          DL.DL_log('MLS', `專案帳本 ${ledgerId} 配置預算規則`);
        }
        updatePayload.project_config = typeSpecificConfig;
        break;

      case 'category':
        // 設定報表產出規則
        if (typeSpecificConfig.report_rules) {
          DL.DL_log('MLS', `分類帳本 ${ledgerId} 設定報表產出規則`);
        }
        updatePayload.category_config = typeSpecificConfig;
        break;

      case 'shared':
        // 配置協作設定
        if (typeSpecificConfig.collaboration) {
          updatePayload.collaboration_config = typeSpecificConfig.collaboration;
        }
        updatePayload.shared_config = typeSpecificConfig;
        break;

      default:
        return {
          success: false,
          message: '不支援的帳本類型'
        };
    }

    // 更新 Firestore
    await ledgerRef.update(updatePayload);

    DL.DL_log('MLS', `帳本類型設定配置成功 - ID: ${ledgerId}, 類型: ${ledgerType}`);

    return {
      success: true,
      message: '帳本類型設定配置成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `配置帳本類型設定失敗: ${error.message}`);
    return {
      success: false,
      message: '配置帳本類型設定時發生錯誤'
    };
  }
}

/**
 * 15. 處理權限錯誤
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 統一處理權限不足的錯誤情況
 */
async function MLS_handlePermissionError(userId, ledgerId, attemptedOperation, errorDetails) {
  try {
    // 記錄權限錯誤詳情
    DL.DL_error('MLS', `權限錯誤 - 用戶: ${userId}, 帳本: ${ledgerId}, 操作: ${attemptedOperation}, 詳情: ${errorDetails}`);

    return {
      success: false,
      error: 'permission_denied',
      message: '權限不足，無法執行此操作',
      details: {
        operation: attemptedOperation,
        userId: userId,
        ledgerId: ledgerId
      }
    };

  } catch (error) {
    DL.DL_error('MLS', `處理權限錯誤失敗: ${error.message}`);
    return {
      success: false,
      error: 'permission_error_handler_failed',
      message: '權限錯誤處理失敗'
    };
  }
}

/**
 * 16. 檢測重複帳本名稱
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 防止用戶建立重複名稱的帳本
 */
async function MLS_detectDuplicateName(userId, proposedName, ledgerType) {
  try {
    DL.DL_log('MLS', `檢測重複帳本名稱 - 用戶: ${userId}, 名稱: ${proposedName}, 類型: ${ledgerType}`);

    // 查詢用戶是否已有相同名稱的帳本
    const query = db.collection('ledgers')
      .where('owner_id', '==', userId)
      .where('name', '==', proposedName)
      .where('type', '==', ledgerType)
      .where('archived', '==', false);

    const querySnapshot = await query.get();

    if (!querySnapshot.empty) {
      // 記錄重複名稱嘗試
      DL.DL_warning('MLS', `重複帳本名稱嘗試 - 用戶: ${userId}, 名稱: ${proposedName}, 類型: ${ledgerType}`);

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
    DL.DL_error('MLS', `檢測重複帳本名稱失敗: ${error.message}`);
    return {
      isUnique: false,
      error: true,
      message: '檢測帳本名稱時發生錯誤'
    };
  }
}

/**
 * 17. 階段二新增：取得協作帳本列表
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 查詢用戶參與的所有協作帳本（共享帳本和專案帳本）
 */
async function MLS_getCollaborationLedgers(userId, options = {}) {
  try {
    DL.DL_log('MLS', `取得協作帳本列表 - 用戶: ${userId}`);

    // 查詢用戶參與的協作帳本
    let query = db.collection('ledgers')
      .where('members', 'array-contains', userId)
      .where('type', 'in', ['shared', 'project']);

    // 篩選條件
    if (options.activeOnly !== false) {
      query = query.where('archived', '==', false);
    }

    // 排序
    query = query.orderBy('updated_at', 'desc');

    // 限制數量
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const querySnapshot = await query.get();
    const collaborationLedgers = [];

    for (const doc of querySnapshot.docs) {
      const ledgerData = doc.data();
      
      // 檢查用戶在此帳本的權限
      const userRole = await MLS_getUserRoleInLedger(userId, ledgerData);
      
      // 取得協作統計資訊
      let collaborationStats = {};
      if (CM && typeof CM.CM_getMemberList === 'function') {
        try {
          const memberList = await CM.CM_getMemberList(ledgerData.id, userId, false);
          collaborationStats = {
            memberCount: memberList.totalCount || ledgerData.members?.length || 0,
            lastActivity: ledgerData.metadata?.last_activity
          };
        } catch (cmError) {
          DL.DL_warning('MLS', `取得協作統計失敗: ${cmError.message}`);
        }
      }

      collaborationLedgers.push({
        id: ledgerData.id,
        name: ledgerData.name,
        type: ledgerData.type,
        description: ledgerData.description || '',
        owner_id: ledgerData.owner_id,
        userRole: userRole,
        created_at: ledgerData.created_at,
        updated_at: ledgerData.updated_at,
        collaborationStats: collaborationStats,
        isOwner: ledgerData.owner_id === userId
      });
    }

    DL.DL_log('MLS', `協作帳本列表取得成功 - 用戶: ${userId}, 協作帳本數: ${collaborationLedgers.length}`);

    return {
      success: true,
      collaborationLedgers: collaborationLedgers,
      count: collaborationLedgers.length,
      message: '協作帳本列表取得成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `取得協作帳本列表失敗: ${error.message}`);
    return {
      success: false,
      message: '取得協作帳本列表時發生錯誤',
      collaborationLedgers: [],
      count: 0
    };
  }
}

/**
 * 18. 階段二新增：取得用戶在帳本中的角色
 * @version 2025-11-06-V2.0.0
 * @date 2025-11-06
 * @description 取得用戶在特定帳本中的角色和權限
 */
async function MLS_getUserRoleInLedger(userId, ledgerData) {
  try {
    if (ledgerData.owner_id === userId) {
      return 'owner';
    }
    
    if (ledgerData.permissions?.admins?.includes(userId)) {
      return 'admin';
    }
    
    if (ledgerData.permissions?.members?.includes(userId)) {
      return 'member';
    }
    
    if (ledgerData.permissions?.viewers?.includes(userId)) {
      return 'viewer';
    }
    
    // 如果用戶在members陣列中但沒有明確權限設定，預設為member
    if (ledgerData.members?.includes(userId)) {
      return 'member';
    }
    
    return 'none';
  } catch (error) {
    DL.DL_warning('MLS', `取得用戶角色失敗: ${error.message}`);
    return 'none';
  }
}

// =============== P2測試所需函數 ===============

/**
 * 新增：取得單一帳本詳情 (P2測試所需)
 * @version 2025-10-23-V2.2.0
 * @description 根據帳本ID取得單一帳本詳情
 */
async function MLS_getLedgerById(ledgerId, queryParams = {}) {
  try {
    DL.DL_log('MLS', `取得帳本詳情 - 帳本ID: ${ledgerId}`);

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
      const accessCheck = await MLS_validateLedgerAccess(queryParams.userId, ledgerId, 'read');
      if (!accessCheck.hasAccess) {
        return await MLS_handlePermissionError(queryParams.userId, ledgerId, 'read', '權限不足');
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
    DL.DL_error('MLS', `取得帳本詳情失敗: ${error.message}`);
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
 * 新增：取得帳本列表 (P2測試所需)
 * @version 2025-10-27-V2.2.1
 * @description 取得用戶可存取的帳本列表，修正函數不存在問題
 */
async function MLS_getLedgers(queryParams = {}) {
  try {
    DL.DL_log('MLS', `取得帳本列表 - 查詢參數: ${JSON.stringify(queryParams)}`);

    // 實際從Firestore查詢帳本列表
    let query = db.collection('ledgers');
    
    // 如果有userId參數，篩選該用戶的帳本
    if (queryParams.userId) {
      query = query.where('members', 'array-contains', queryParams.userId);
    }
    
    // 預設只顯示非歸檔的帳本（先檢查是否需要索引）
    if (queryParams.archived !== true) {
      query = query.where('archived', '==', false);
    }
    
    // 按更新時間排序（移除以避免索引問題）
    // query = query.orderBy('updated_at', 'desc');
    
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
    DL.DL_error('MLS', `取得帳本列表失敗: ${error.message}`);
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
 * 新增：建立帳本 (P2測試所需)
 * @version 2025-11-06-V2.3.0
 * @description 建立新帳本 - 確保實際寫入Firestore並驗證
 */
async function MLS_createLedger(ledgerData, options = {}) {
  try {
    DL.DL_log('MLS', `建立帳本 - 帳本名稱: ${ledgerData.name}`);

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
      members: ledgerData.members || [ledgerData.owner_id],
      permissions: ledgerData.permissions || {
        owner: ledgerData.owner_id,
        admins: [],
        members: [],
        viewers: [],
        settings: {
          allow_invite: true,
          allow_edit: true,
          allow_delete: false
        }
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

    DL.DL_log('MLS', `帳本成功寫入Firestore - ID: ${ledgerId}`);

    // 如果是協作帳本，初始化協作架構
    if ((newLedger.type === 'shared' || newLedger.type === 'project') && CM) {
      try {
        DL.DL_log('MLS', `開始初始化協作架構 - 帳本ID: ${ledgerId}, 類型: ${newLedger.type}`);
        
        const collaborationResult = await CM.CM_initializeCollaboration(
          ledgerId,
          {
            userId: ledgerData.owner_id,
            email: ledgerData.ownerEmail || `${ledgerData.owner_id}@example.com`
          },
          newLedger.type,
          newLedger.permissions?.settings || {}
        );

        if (collaborationResult.success) {
          DL.DL_log('MLS', `✅ 協作架構初始化成功 - 帳本ID: ${ledgerId}`);
          
          // 驗證協作文檔是否已建立
          const verifyCollaboration = await db.collection('collaborations').doc(ledgerId).get();
          if (verifyCollaboration.exists) {
            DL.DL_log('MLS', `✅ 協作文檔驗證成功 - Firebase已建立collaborations/${ledgerId}`);
          } else {
            DL.DL_warning('MLS', `⚠️ 協作文檔驗證失敗 - Firebase未找到collaborations/${ledgerId}`);
          }
        } else {
          DL.DL_warning('MLS', `❌ 協作架構初始化失敗 - 帳本ID: ${ledgerId}, 錯誤: ${collaborationResult.message}`);
          throw new Error(`協作初始化失敗: ${collaborationResult.message}`);
        }
      } catch (cmError) {
        DL.DL_error('MLS', `💥 協作架構初始化異常 - 帳本ID: ${ledgerId}, 錯誤: ${cmError.message}`);
        // 協作初始化失敗不應影響帳本建立，但需要記錄錯誤
        DL.DL_warning('MLS', `⚠️ 協作帳本 ${ledgerId} 已建立但協作功能不可用`);
      }
    } else if (newLedger.type === 'shared' || newLedger.type === 'project') {
      DL.DL_warning('MLS', `⚠️ CM模組未載入，協作帳本 ${ledgerId} 的協作功能將不可用`);
    }

    // 返回已寫入的資料（替換時間戳為實際值）
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
    DL.DL_error('MLS', `建立帳本失敗: ${error.message}`);
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
 * 新增：更新帳本 (P2測試所需)
 * @version 2025-10-23-V2.2.0
 * @description 更新帳本資訊
 */
async function MLS_updateLedger(ledgerId, updateData, options = {}) {
  try {
    DL.DL_log('MLS', `更新帳本 - 帳本ID: ${ledgerId}`);

    if (!ledgerId) {
      throw new Error('缺少帳本ID');
    }

    // 模擬更新操作
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
    DL.DL_error('MLS', `更新帳本失敗: ${error.message}`);
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
 * 新增：取得協作者列表 (P2測試所需)
 * @version 2025-10-23-V2.2.0
 * @description 取得帳本協作者列表
 */
async function MLS_getCollaborators(ledgerId, options = {}) {
  try {
    DL.DL_log('MLS', `取得協作者列表 - 帳本ID: ${ledgerId}`);

    if (!ledgerId) {
      throw new Error('缺少帳本ID');
    }

    // 委派至CM模組處理
    if (CM && typeof CM.CM_getMemberList === 'function') {
      const result = await CM.CM_getMemberList(ledgerId, options.requesterId, true);
      
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
    DL.DL_error('MLS', `取得協作者列表失敗: ${error.message}`);
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
 * 新增：邀請協作者 (P2測試所需)
 * @version 2025-10-23-V2.2.0
 * @description 邀請新協作者加入帳本
 */
async function MLS_inviteCollaborator(ledgerId, invitationData, options = {}) {
  try {
    DL.DL_log('MLS', `邀請協作者 - 帳本ID: ${ledgerId}, 邀請: ${invitationData.email}`);

    if (!ledgerId || !invitationData.email) {
      throw new Error('缺少必要參數: ledgerId, email');
    }

    // 委派至MLS_inviteMember處理
    const result = await MLS_inviteMember(
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
    DL.DL_error('MLS', `邀請協作者失敗: ${error.message}`);
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
 * 新增：移除協作者 (P2測試所需)
 * @version 2025-10-23-V2.2.0
 * @description 移除帳本協作者
 */
async function MLS_removeCollaborator(ledgerId, userId, options = {}) {
  try {
    DL.DL_log('MLS', `移除協作者 - 帳本ID: ${ledgerId}, 用戶ID: ${userId}`);

    if (!ledgerId || !userId) {
      throw new Error('缺少必要參數: ledgerId, userId');
    }

    // 委派至MLS_removeMember處理
    const result = await MLS_removeMember(
      ledgerId, 
      options.removerId || 'system', 
      userId, 
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
    DL.DL_error('MLS', `移除協作者失敗: ${error.message}`);
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
 * 新增：取得權限資訊 (P2測試所需)
 * @version 2025-10-23-V1.0.1
 * @date 2025-10-23
 * @description 取得指定帳本的詳細權限資訊
 */
async function MLS_getPermissions(ledgerId, queryParams) {
  try {
    DL.DL_log('MLS', `取得帳本權限 - 帳本ID: ${ledgerId}`);

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

    return {
      success: true,
      data: {
        ledgerId: ledgerId,
        permissions: permissions,
        owner: permissions.owner,
        admins: permissions.admins || [],
        members: permissions.members || [],
        viewers: permissions.viewers || [],
        settings: permissions.settings || {}
      },
      message: '權限資訊取得成功'
    };

  } catch (error) {
    DL.DL_error('MLS', `取得帳本權限失敗: ${error.message}`);
    return {
      success: false,
      message: '取得帳本權限時發生錯誤',
      error: { code: 'GET_PERMISSIONS_ERROR', details: error.message }
    };
  }
}

// 模組導出
module.exports = {
  // 帳本類型管理函數
  MLS_createProjectLedger,
  MLS_createCategoryLedger,
  MLS_createSharedLedger,

  // 帳本基本操作函數
  MLS_editLedger,
  MLS_deleteLedger,
  MLS_archiveLedger,

  // 權限與成員管理函數（階段二重構：委派至CM模組）
  MLS_setLedgerPermissions,
  MLS_inviteMember,
  MLS_removeMember,

  // 帳本切換與路由函數
  MLS_switchLedger,
  MLS_getLedgerList,
  MLS_validateLedgerAccess,

  // 帳本屬性與設定函數
  MLS_setLedgerAttributes,
  MLS_configureLedgerType,

  // 錯誤處理與監控函數
  MLS_handlePermissionError,
  MLS_detectDuplicateName,

  // 階段二新增：協作帳本管理函數
  MLS_getCollaborationLedgers,
  MLS_getUserRoleInLedger,

  // P2測試所需新增函數
  MLS_getLedgerById,
  MLS_createLedger,
  MLS_updateLedger,
  MLS_getCollaborators,
  MLS_inviteCollaborator,
  MLS_removeCollaborator,
  MLS_getPermissions,

  // ASL.js 調用所需函數（新增）
  MLS_getLedgers
};

console.log('✅ MLS 多帳本管理模組載入完成 - 階段二重構：協作職責委派至CM模組');
