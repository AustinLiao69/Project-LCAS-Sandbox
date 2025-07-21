
# BR-0008 導入SR_排程提醒模組功能

## 1. 需求說明
本次變更目標為：導入 SR_排程提醒模組到 LCAS 2.0 系統，實現智慧記帳自動化核心功能，包含定期記帳提醒、自動推播服務、Quick Reply 統計查詢及付費功能控制機制。

此模組將為 LCAS 2.0 提供完整的排程自動化能力，支援免費用戶基礎功能和付費用戶進階功能的差異化服務。

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **使用者需求**：需要定期記帳提醒和自動化財務管理功能
- **商業價值**：透過付費功能差異化提升用戶轉換率
- **競爭優勢**：智慧化排程和個人化提醒系統

### 2.2 預期效益
- **用戶體驗提升**：自動化減少手動記帳負擔
- **營收增長**：付費功能驅動訂閱轉換
- **系統效能**：智慧排程引擎優化資源使用
- **擴展性**：模組化架構支援未來功能擴展

---

## 3. 須新增/修改內容

### 3.1 新增 SR 排程提醒模組

#### 3.1.1 排程管理層函數（6個）
- `SR_createScheduledReminder` - 建立排程提醒設定
- `SR_updateScheduledReminder` - 修改現有排程設定
- `SR_deleteScheduledReminder` - 安全刪除排程提醒
- `SR_executeScheduledTask` - 執行到期的排程任務
- `SR_processHolidayLogic` - 處理國定假日邏輯
- `SR_optimizeReminderTime` - 智慧時間最佳化（付費功能）

#### 3.1.2 付費功能控制層函數（4個）
- `SR_validatePremiumFeature` - 驗證付費功能權限
- `SR_checkSubscriptionStatus` - 檢查訂閱狀態
- `SR_enforceFreeUserLimits` - 強制免費用戶限制
- `SR_upgradeFeatureAccess` - 升級功能存取權限

#### 3.1.3 推播服務層函數（4個）
- `SR_sendDailyFinancialSummary` - 發送每日財務摘要（付費功能）
- `SR_sendBudgetWarning` - 發送預算警告（付費功能）
- `SR_sendMonthlyReport` - 發送月度報告（付費功能）
- `SR_processQuickReplyStatistics` - 處理 Quick Reply 統計

#### 3.1.4 數據整合層函數（4個）
- `SR_syncWithAccountModule` - 與 AM 模組同步
- `SR_syncWithDataDistribution` - 與 DD 模組同步
- `SR_logScheduledActivity` - 記錄排程活動
- `SR_handleSchedulerError` - 處理排程器錯誤

#### 3.1.5 Quick Reply 專用層函數（3個）
- `SR_handleQuickReplyInteraction` - 統一處理 Quick Reply 互動
- `SR_generateQuickReplyOptions` - 動態生成 Quick Reply 選項
- `SR_handlePaywallQuickReply` - 處理付費功能牆 Quick Reply

### 3.2 WH 模組重大升級

#### 3.2.1 新增 SR 路由處理
- 新增 SR 模組引入和初始化邏輯
- 實作 Quick Reply 事件路由到 SR 模組
- 整合付費功能驗證流程

#### 3.2.2 Quick Reply 架構擴展
- 新增 `WH_handleQuickReplyEvent` 函數
- 實作 `WH_routeToSRModule` 路由機制
- 支援 Quick Reply 按鈕動態生成

#### 3.2.3 訊息格式擴展
- 支援 SR 模組回覆格式驗證
- 擴展 `WH_replyMessage` 支援 Quick Reply 訊息
- 新增付費功能升級提示訊息格式

### 3.3 跨模組整合修改

#### 3.3.1 AM 模組擴展
- 新增付費功能權限檢查 API
- 整合訂閱狀態管理
- 支援 SR 模組的用戶配額查詢

#### 3.3.2 FS 模組擴展
- 新增 SR 專用資料庫集合結構
- 實作排程資料 CRUD 操作
- 支援 Quick Reply 會話管理

#### 3.3.3 DD 模組協作
- 整合 SR 統計查詢處理
- 支援排程相關資料分發
- 協調跨模組資料同步

### 3.4 系統基礎設施

#### 3.4.1 排程引擎
- 整合 node-cron 排程系統
- 實作時區和假日處理機制
- 建立排程任務監控和重試機制

#### 3.4.2 付費功能架構
- 建立功能權限矩陣
- 實作免費/付費功能邊界控制
- 整合升級引導流程

#### 3.4.3 Quick Reply 基礎設施
- 建立 Quick Reply 會話管理
- 實作動態按鈕生成機制
- 支援付費功能牆互動

---

## 4. 技術架構設計

### 4.1 模組依賴關係
```
SR 排程提醒模組 (v1.0)
├── WH 模組 (升級至 v2.1) - 路由和回覆處理
├── AM 模組 (擴展) - 用戶權限和訂閱管理
├── FS 模組 (擴展) - 資料庫操作
├── DD 模組 (協作) - 資料查詢和分發
├── DL 模組 (整合) - 日誌記錄
├── BK/LBK 模組 (協作) - 自動記帳處理
├── MRA 模組 (整合) - 報告生成
└── Node-cron - 排程引擎
```

### 4.2 資料流架構
```
排程提醒流程：
SR 排程引擎 → 條件判斷 → 付費功能檢查 → WH 推播 → 用戶接收

Quick Reply 流程：
用戶點擊 → WH 路由 → SR 處理 → 權限檢查 → 動態選項 → WH 回覆

付費功能流程：
功能請求 → SR 權限驗證 → AM 訂閱檢查 → 功能執行/升級提示
```

---

## 5. 實作階段規劃

### Phase 1：核心模組建立（Week 1-2）
- 建立 SR 模組檔案結構
- 實作 21 個核心函數
- 基礎功能單元測試

### Phase 2：WH 模組整合（Week 3）
- WH 模組升級至 v2.1
- Quick Reply 路由實作
- SR 模組引入和初始化

### Phase 3：跨模組協作（Week 4）
- AM、FS、DD 模組擴展
- 資料庫結構建立
- 模組間 API 整合

### Phase 4：排程引擎部署（Week 5）
- Node-cron 排程系統整合
- 時區和假日處理實作
- 付費功能控制機制

### Phase 5：Quick Reply 功能（Week 6）
- Quick Reply 互動流程
- 動態按鈕生成
- 付費功能牆實作

### Phase 6：測試和優化（Week 7-8）
- 完整端到端測試
- 效能優化和監控
- 生產環境部署準備

---

## 6. 資料庫架構需求

### 6.1 新增 Firestore 集合
```
scheduled_reminders/ - 排程提醒設定
user_quotas/ - 用戶配額管理
holiday_calendar/ - 假日日曆
scheduler_logs/ - 排程活動日誌
quick_reply_sessions/ - Quick Reply 會話
user_interactions/ - 用戶互動記錄
```

### 6.2 現有集合擴展
- `users/{userId}/subscription` - 訂閱狀態管理
- `ledgers/{userId}/preferences` - 用戶偏好設定

---

## 7. API 介面規格

### 7.1 新增 REST API 端點
```
POST   /api/v1/scheduler/reminder/create      - 建立排程提醒
PUT    /api/v1/scheduler/reminder/{id}/update - 更新排程設定
DELETE /api/v1/scheduler/reminder/{id}/delete - 刪除排程提醒
GET    /api/v1/scheduler/reminders/user/{uid} - 查詢使用者排程清單
POST   /api/v1/scheduler/quickreply/handle    - 處理 Quick Reply 互動
GET    /api/v1/scheduler/quota/user/{uid}     - 查詢使用者配額
```

### 7.2 WH 模組 API 擴展
- 支援 Quick Reply 事件處理
- 整合 SR 模組回覆格式
- 新增付費功能驗證流程

---

## 8. 版本升級計畫

### 8.1 模組版本升級
- **SR 模組**：新建 v1.0.0
- **WH 模組**：2.0.22 → 2.1.0（重大功能升級）
- **AM 模組**：擴展付費功能 API
- **FS 模組**：新增 SR 資料庫操作

### 8.2 函數版本升級
- 所有新增函數：v1.0.0
- WH 模組修改函數：版本號遞增
- 跨模組協作函數：版本號遞增

---

## 9. 測試策略

### 9.1 單元測試
- SR 模組 21 個函數完整測試
- WH 模組 Quick Reply 功能測試
- 付費功能權限驗證測試

### 9.2 整合測試
- 模組間互動測試
- 排程引擎準確性測試
- Quick Reply 互動流程測試

### 9.3 效能測試
- 大量排程並發處理測試
- Quick Reply 回應時間測試
- 付費功能切換效能測試

---

## 10. 風險評估與緩解

### 10.1 技術風險
- **風險**：排程引擎複雜度高，可能影響系統穩定性
- **緩解**：分階段實作，充分測試，建立監控機制

### 10.2 整合風險
- **風險**：多模組協作可能產生相依性問題
- **緩解**：明確定義模組介面，建立完整的整合測試

### 10.3 商業風險
- **風險**：付費功能實作不當可能影響用戶體驗
- **緩解**：友善的升級引導，清楚的功能邊界說明

---

## 11. 驗收標準

### 11.1 功能驗收
- [ ] SR 模組 21 個函數正常運作
- [ ] WH 模組 Quick Reply 功能完整
- [ ] 付費功能控制機制準確
- [ ] 排程引擎穩定執行

### 11.2 效能驗收
- [ ] 排程執行延遲 < 30 秒
- [ ] Quick Reply 回應時間 < 2 秒
- [ ] 並發處理能力 > 1000 個排程
- [ ] 系統穩定性 > 99.9%

### 11.3 整合驗收
- [ ] 所有模組協作正常
- [ ] 資料庫操作穩定
- [ ] 跨模組同步準確
- [ ] 錯誤處理完善

---

## 12. 其他注意事項

### 12.1 開發規範
- 遵循現有代碼風格和註解規範
- 所有函數需要完整的錯誤處理和日誌記錄
- 測試覆蓋率需達到 90% 以上

### 12.2 文件維護
- 完整的 API 文件
- 詳細的部署指南
- 使用者操作手冊

### 12.3 上線準備
- 生產環境配置檢查
- 資料庫遷移腳本
- 監控和報警設置

---

> **重要提醒**：此需求將為 LCAS 2.0 引入複雜的排程和付費功能系統，需要謹慎規劃和充分測試。所有開發人員請嚴格遵循分階段實作計畫，確保系統穩定性和用戶體驗。

