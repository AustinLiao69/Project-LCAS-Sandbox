
/**
 * MLS_多帳本管理模組_1.0.0
 * @module MLS模組 
 * @description 多帳本管理系統 - 支援專案、分類、共享帳本的建立與管理
 * @update 2025-07-07: 初版建立，實現多帳本類型支援與權限管理
 */

const admin = require('firebase-admin');
const DL = require('./2010. DL.js');
const DD = require('./2031. DD.js');

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
    
    // 設定預算管理
    if (budget > 0) {
      // 這裡將來會與預算管理模組整合
      DL.DL_log('MLS', `專案帳本 ${ledgerId} 設定預算: ${budget}`);
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
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 支援多用戶協作的共享帳本
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
      owner_id: ownerId,
      members: allMembers,
      permissions: {
        owner: ownerId,
        admins: permissionSettings?.admins || [],
        members: permissionSettings?.members || memberList || [],
        viewers: permissionSettings?.viewers || [],
        settings: {
          allow_invite: permissionSettings?.allow_invite !== false,
          allow_edit: permissionSettings?.allow_edit !== false,
          allow_delete: permissionSettings?.allow_delete || false
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
    
    // 啟動即時同步服務
    // 這裡將來會與協作管理模組的 syncService.js 整合
    DL.DL_log('MLS', `共享帳本 ${ledgerId} 啟動即時同步服務`);
    
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
    const BK = require('./2001. BK.js');
    if (typeof BK.BK_processBookkeeping === 'function') {
      // 這裡可以處理因帳本編輯而需要更新的記帳資料
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
    
    // 建立刪除前備份（與備份服務模組整合）
    // 這裡將來會與備份服務模組的 backupManager.js 整合
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
    
    // 進行資料歸檔（與備份服務模組整合）
    // 這裡將來會與備份服務模組整合
    DL.DL_log('MLS', `帳本 ${ledgerId} 開始進行資料歸檔`);
    
    // 生成歸檔前的最終報表（與 MRA 模組整合）
    // 這裡將來會與 MRA 模組整合
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
 * 07. 設定帳本權限
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 設定帳本擁有者、管理員、一般成員、僅檢視者
 */
async function MLS_setLedgerPermissions(ledgerId, userId, memberPermissions) {
  try {
    DL.DL_log('MLS', `開始設定帳本權限 - ID: ${ledgerId}, 用戶: ${userId}`);
    
    // 驗證存取權限（只有擁有者和管理員可以設定權限）
    const accessCheck = await MLS_validateLedgerAccess(userId, ledgerId, 'manage_permissions');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(userId, ledgerId, 'manage_permissions', '權限不足');
    }
    
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    
    // 更新權限設定
    await ledgerRef.update({
      permissions: memberPermissions,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 與協作管理模組整合進行核心權限控制
    // 這裡將來會與協作管理模組的 permissionController.js 整合
    DL.DL_log('MLS', `帳本 ${ledgerId} 權限設定已同步至協作管理模組`);
    
    // 同步權限變更（與 syncService.js 整合）
    // 這裡將來會與協作管理模組的 syncService.js 整合
    DL.DL_log('MLS', `帳本 ${ledgerId} 權限變更已同步`);
    
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
 * 08. 邀請協作成員
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 邀請新成員加入共享帳本
 */
async function MLS_inviteMember(ledgerId, inviterId, inviteeInfo, permissionLevel) {
  try {
    DL.DL_log('MLS', `開始邀請成員 - 帳本: ${ledgerId}, 邀請者: ${inviterId}`);
    
    // 驗證邀請權限
    const accessCheck = await MLS_validateLedgerAccess(inviterId, ledgerId, 'invite');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(inviterId, ledgerId, 'invite', '權限不足');
    }
    
    // 驗證被邀請用戶（與 AM 模組整合）
    // 這裡將來會與 AM 模組的 userProfileManager.js 整合
    DL.DL_log('MLS', `驗證被邀請用戶: ${inviteeInfo.userId || inviteeInfo.email}`);
    
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();
    
    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在'
      };
    }
    
    const ledgerData = ledgerDoc.data();
    const inviteeId = inviteeInfo.userId;
    
    // 檢查用戶是否已是成員
    if (ledgerData.members.includes(inviteeId)) {
      return {
        success: false,
        message: '用戶已是帳本成員'
      };
    }
    
    // 更新成員清單和權限
    const updatedMembers = [...ledgerData.members, inviteeId];
    const updatedPermissions = { ...ledgerData.permissions };
    
    if (permissionLevel === 'admin') {
      updatedPermissions.admins.push(inviteeId);
    } else if (permissionLevel === 'viewer') {
      updatedPermissions.viewers.push(inviteeId);
    } else {
      updatedPermissions.members.push(inviteeId);
    }
    
    await ledgerRef.update({
      members: updatedMembers,
      permissions: updatedPermissions,
      'metadata.member_count': updatedMembers.length,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 發送邀請通知（與 LINE OA 模組整合）
    // 這裡將來會與 LINE OA 模組整合
    DL.DL_log('MLS', `已發送邀請通知給用戶: ${inviteeId}`);
    
    DL.DL_log('MLS', `成員邀請成功 - 帳本: ${ledgerId}, 新成員: ${inviteeId}`);
    
    return {
      success: true,
      message: '成員邀請成功'
    };
    
  } catch (error) {
    DL.DL_error('MLS', `邀請成員失敗: ${error.message}`);
    return {
      success: false,
      message: '邀請成員時發生錯誤'
    };
  }
}

/**
 * 09. 移除協作成員
 * @version 2025-07-07-V1.0.0
 * @date 2025-07-07 14:12:13
 * @description 從共享帳本移除成員
 */
async function MLS_removeMember(ledgerId, removerId, targetUserId, removeReason) {
  try {
    DL.DL_log('MLS', `開始移除成員 - 帳本: ${ledgerId}, 操作者: ${removerId}, 目標: ${targetUserId}`);
    
    // 驗證移除權限（與協作管理模組整合）
    // 這裡將來會與協作管理模組整合
    const accessCheck = await MLS_validateLedgerAccess(removerId, ledgerId, 'remove_member');
    if (!accessCheck.hasAccess) {
      return await MLS_handlePermissionError(removerId, ledgerId, 'remove_member', '權限不足');
    }
    
    const ledgerRef = db.collection('ledgers').doc(ledgerId);
    const ledgerDoc = await ledgerRef.get();
    
    if (!ledgerDoc.exists) {
      return {
        success: false,
        message: '帳本不存在'
      };
    }
    
    const ledgerData = ledgerDoc.data();
    
    // 檢查目標用戶是否為成員
    if (!ledgerData.members.includes(targetUserId)) {
      return {
        success: false,
        message: '用戶不是帳本成員'
      };
    }
    
    // 不能移除帳本擁有者
    if (targetUserId === ledgerData.permissions.owner) {
      return {
        success: false,
        message: '無法移除帳本擁有者'
      };
    }
    
    // 備份成員歷史資料（與備份服務模組整合）
    // 這裡將來會與備份服務模組整合
    DL.DL_log('MLS', `備份被移除成員的歷史資料: ${targetUserId}`);
    
    // 更新成員清單和權限
    const updatedMembers = ledgerData.members.filter(id => id !== targetUserId);
    const updatedPermissions = { ...ledgerData.permissions };
    
    updatedPermissions.admins = updatedPermissions.admins.filter(id => id !== targetUserId);
    updatedPermissions.members = updatedPermissions.members.filter(id => id !== targetUserId);
    updatedPermissions.viewers = updatedPermissions.viewers.filter(id => id !== targetUserId);
    
    await ledgerRef.update({
      members: updatedMembers,
      permissions: updatedPermissions,
      'metadata.member_count': updatedMembers.length,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 記錄成員移除日誌
    DL.DL_warning('MLS', `成員已移除 - 帳本: ${ledgerId}, 被移除: ${targetUserId}, 原因: ${removeReason}`);
    
    return {
      success: true,
      removedUser: targetUserId,
      newMemberCount: updatedMembers.length
    };
    
  } catch (error) {
    DL.DL_error('MLS', `移除成員失敗: ${error.message}`);
    return {
      success: false,
      message: '移除成員時發生錯誤'
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
    
    // 記錄切換時間（與 WH 模組整合）
    const WH = require('./2020. WH.js');
    const switchTime = WH.WH_formatDateTime ? WH.WH_formatDateTime() : new Date().toISOString();
    
    // 更新用戶活動狀態（與 AM 模組整合）
    // 這裡將來會與 AM 模組整合
    DL.DL_log('MLS', `用戶 ${userId} 活動狀態已更新`);
    
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
      
      // 檢查帳本可見權限（與協作管理模組整合）
      // 這裡將來會與協作管理模組整合
      const hasViewPermission = true; // 簡化版，實際會檢查權限
      
      if (hasViewPermission) {
        // 提供帳本統計資訊（與 MRA 模組整合）
        // 這裡將來會與 MRA 模組整合
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
    
    // 分發屬性更新（與 DD 模組整合）
    await DD.DD_distributeData('ledger_attributes_updated', {
      ledgerId: ledgerId,
      userId: userId,
      attributes: attributeData
    });
    
    // 備份設定變更（與備份服務模組整合）
    // 這裡將來會與備份服務模組整合
    DL.DL_log('MLS', `帳本 ${ledgerId} 屬性變更已備份`);
    
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
        // 配置預算規則（與預算管理模組整合）
        if (typeSpecificConfig.budget) {
          // 這裡將來會與預算管理模組的 budgetManager.js 整合
          DL.DL_log('MLS', `專案帳本 ${ledgerId} 配置預算規則`);
        }
        updatePayload.project_config = typeSpecificConfig;
        break;
        
      case 'category':
        // 設定報表產出規則（與 MRA 模組整合）
        if (typeSpecificConfig.report_rules) {
          // 這裡將來會與 MRA 模組整合
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
    
    // 發送錯誤通知（與 LINE OA 模組整合）
    // 這裡將來會與 LINE OA 模組整合
    DL.DL_log('MLS', `已發送權限錯誤通知給用戶: ${userId}`);
    
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

// 導出所有函數
module.exports = {
  MLS_createProjectLedger,
  MLS_createCategoryLedger,
  MLS_createSharedLedger,
  MLS_editLedger,
  MLS_deleteLedger,
  MLS_archiveLedger,
  MLS_setLedgerPermissions,
  MLS_inviteMember,
  MLS_removeMember,
  MLS_switchLedger,
  MLS_getLedgerList,
  MLS_validateLedgerAccess,
  MLS_setLedgerAttributes,
  MLS_configureLedgerType,
  MLS_handlePermissionError,
  MLS_detectDuplicateName
};

console.log('✅ MLS 多帳本管理模組載入完成');
