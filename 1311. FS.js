/**
 * 階段三新增：預算創建函數 (支援子集合架構)
 * @version 2025-10-30-V2.2.0
 * @description 建立預算記錄，使用子集合架構 ledgers/{ledger_id}/budgets/{budget_id}
 */
async function FS_createBudget(budgetData) {
  const functionName = "FS_createBudget";
  try {
    console.log(`[${functionName}] 🎯 階段三：建立預算 - 資料:`, JSON.stringify(budgetData, null, 2));

    // 參數驗證
    if (!budgetData.ledgerId) {
      throw new Error('缺少帳本ID (ledgerId)');
    }

    // 使用子集合架構創建預算
    const result = await FS_createBudgetInLedger(budgetData.ledgerId, budgetData, budgetData.userId || 'system');

    console.log(`[${functionName}] ✅ 預算子集合創建結果:`, result);
    return result;

  } catch (error) {
    console.error(`[${functionName}] ❌ 預算創建失敗:`, error);
    return {
      success: false,
      error: error.message,
      errorCode: 'FS_CREATE_BUDGET_ERROR'
    };
  }
}

// =============== 階段三：輔助函數區 ===============