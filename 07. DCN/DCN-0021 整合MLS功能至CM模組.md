
# DCN-0021 整合MLS功能至CM模組

**版本**: v1.0.0  
**建立日期**: 2025-11-10  
**最後更新**: 2025-11-10  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [模組職責重新定義](#31-模組職責重新定義)
   - 3.2 [功能遷移計劃](#32-功能遷移計劃)
   - 3.3 [API端點重新映射](#33-api端點重新映射)
   - 3.4 [依賴關係清理](#34-依賴關係清理)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [新職責劃分架構](#41-新職責劃分架構)
   - 4.2 [函數遷移映射設計](#42-函數遷移映射設計)
   - 4.3 [版本升級機制](#43-版本升級機制)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [功能遷移清單](#6-功能遷移清單)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：整合MLS多帳本管理模組功能至CM協作管理模組，解決模組職責重疊問題。根據AM模組成功經驗，建立清晰的帳本管理職責邊界，提升系統架構一致性。

此變更將實現：
1. 重新定義模組職責：AM負責首本帳本，CM負責所有後續帳本
2. 將MLS核心函數完整遷移至CM模組
3. 清理ASL.js中的模組依賴關係
4. 完全廢棄MLS模組，簡化系統架構

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **架構一致性需求**：解決MLS與CM職責重疊，建立清晰邊界
- **維護效率提升**：統一帳本管理入口，降低跨模組維護複雜度
- **MVP聚焦原則**：專注解決當前問題，避免過度工程化
- **可持續發展**：為後續功能擴展建立穩固基礎

### 2.2 預期效益
- **開發效率提升**：統一模組減少重複開發工作
- **維護成本降低**：單一入口降低維護複雜度
- **架構統一性**：遵循AM模組成功模式
- **系統穩定性**：減少模組間耦合，提升系統穩定性

---

## 3. 須新增/修改內容

### 3.1 模組職責重新定義

#### 3.1.1 新職責劃分
- **AM模組**：僅負責用戶註冊和第一本個人帳本創建
- **CM模組**：負責所有後續帳本（第2本以上）的完整生命週期，包括：
  - 個人帳本（personal、category類型）
  - 協作帳本（shared、project類型）
- **MLS模組**：完全廢棄，功能整合至CM

#### 3.1.2 模組描述更新
```javascript
// CM.js 模組描述更新
/**
 * 1313. CM.js - 協作與帳本管理模組 v2.1.0
 * @description 負責所有後續帳本（第2本以上）的完整生命週期管理
 * 包含協作功能和多帳本管理功能
 */
```

### 3.2 功能遷移計劃

#### 3.2.1 核心函數遷移映射
```javascript
// 從MLS遷移至CM的核心函數
MLS_createProjectLedger → CM_createProjectLedger
MLS_createCategoryLedger → CM_createCategoryLedger  
MLS_createSharedLedger → CM_createSharedLedger
MLS_getLedgerList → CM_getLedgerList
MLS_editLedger → CM_editLedger
MLS_deleteLedger → CM_deleteLedger
MLS_getLedgerById → CM_getLedgerById
MLS_createLedger → CM_createLedger
MLS_updateLedger → CM_updateLedger
MLS_getCollaborators → CM_getCollaborators
MLS_inviteCollaborator → CM_inviteCollaborator
MLS_removeCollaborator → CM_removeCollaborator
MLS_getPermissions → CM_getPermissions
```

#### 3.2.2 版本升級規劃
- **CM模組**：2.0.3 → 2.1.0（重大功能擴充）
- **遷移函數**：統一版本為V1.0.0
- **LLD文件**：更新為協作與帳本管理模組

### 3.3 API端點重新映射

#### 3.3.1 ASL.js端點調整
```javascript
// 原本調用MLS的端點改為調用CM
GET /api/v1/ledgers → CM.CM_getLedgers (原MLS.MLS_getLedgers)
POST /api/v1/ledgers → CM.CM_createLedger (原MLS.MLS_createLedger)
GET /api/v1/ledgers/:id → CM.CM_getLedgerById (原MLS.MLS_getLedgerById)
PUT /api/v1/ledgers/:id → CM.CM_updateLedger (原MLS.MLS_updateLedger)
DELETE /api/v1/ledgers/:id → CM.CM_deleteLedger (原MLS.MLS_deleteLedger)
GET /api/v1/ledgers/:id/collaborators → CM.CM_getCollaborators
POST /api/v1/ledgers/:id/invitations → CM.CM_inviteCollaborator
DELETE /api/v1/ledgers/:id/collaborators/:userId → CM.CM_removeCollaborator
GET /api/v1/ledgers/:id/permissions → CM.CM_getPermissions
```

### 3.4 依賴關係清理

#### 3.4.1 需要修改的文件清單
**主要文件：**
1. `ASL.js` - 移除MLS模組載入，更新所有MLS調用為CM
2. `13. Replit_Module code_BL/1351. MLS.js` - 完全刪除
3. `13. Replit_Module code_BL/1313. CM.js` - 整合MLS功能

**依賴模組檢查：**
- `13. Replit_Module code_BL/1301. BK.js` - 檢查MLS依賴
- `13. Replit_Module code_BL/1309. AM.js` - 檢查MLS依賴
- 其他BL層模組 - 全面檢查MLS依賴關係

**文檔文件：**
- `12. Replit_LLD_BL/1211. MLS_多帳本模組.md` - 標記為deprecated
- `12. Replit_LLD_BL/1213. CM_協作管理模組.md` - 更新為協作與帳本管理模組
- `14. Replit_Test plan_BL/1451. MLS_多帳本管理模組.md` - 標記為deprecated
- `15. Replit_Test Code_BL/1551. TC_MLS.js` - 更新為測試CM模組

---

## 4. 技術架構設計

### 4.1 新職責劃分架構

#### 4.1.1 帳本生命週期管理
```
用戶註冊 → AM創建首本帳本 → CM管理所有後續帳本
```

#### 4.1.2 模組邊界設計
- **清晰邊界**：避免跨模組委派調用
- **單一職責**：每個模組負責明確的業務範圍
- **統一入口**：CM成為所有後續帳本管理的唯一入口

### 4.2 函數遷移映射設計

#### 4.2.1 函數分類遷移
```javascript
// 帳本CRUD操作
MLS_createLedger → CM_createLedger
MLS_getLedgerList → CM_getLedgerList
MLS_updateLedger → CM_updateLedger
MLS_deleteLedger → CM_deleteLedger

// 協作管理功能
MLS_getCollaborators → CM_getCollaborators
MLS_inviteCollaborator → CM_inviteCollaborator
MLS_removeCollaborator → CM_removeCollaborator
MLS_getPermissions → CM_getPermissions

// 特定類型帳本
MLS_createProjectLedger → CM_createProjectLedger
MLS_createSharedLedger → CM_createSharedLedger
MLS_createCategoryLedger → CM_createCategoryLedger
```

### 4.3 版本升級機制

#### 4.3.1 版本控制策略
- **CM模組**：2.0.3 → 2.1.0（功能擴充版本升級）
- **函數版次**：新增函數統一為V1.0.0
- **向後兼容**：確保現有API調用不受影響

---

## 5. 實作階段規劃

### 階段一：模組職責重新定義（即時生效）

**目標**：明確新的職責劃分

**具體任務**：
1. 更新CM模組描述為「協作與帳本管理模組」
2. 在CM.js中規劃MLS函數遷移空間
3. 更新相關LLD文件

**版本升級**：CM模組 → v2.1.0（準備階段）

**驗收標準**：
- 職責邊界文檔化完成
- CM模組結構準備完成

### 階段二：功能遷移實作（可測試階段）

**目標**：完整遷移MLS核心函數至CM

**具體任務**：
1. 在CM.js中實作所有MLS核心函數
2. 確保函數邏輯完全一致
3. 實作DCN-0015統一回應格式
4. 更新函數版次為V1.0.0

**驗收標準**：
- 所有MLS函數在CM中完整實作
- 功能測試通過
- 回應格式符合DCN-0015規範

### 階段三：API端點重新映射（可測試階段）

**目標**：更新ASL.js中的API端點映射

**具體任務**：
1. 將所有MLS調用改為CM調用
2. 更新health check中的模組狀態檢查
3. 驗證所有帳本相關API正常運作

**驗收標準**：
- 所有API端點正常運作
- 端到端測試通過
- 無MLS依賴殘留

### 階段四：清理MLS模組（可測試階段）

**目標**：完全移除MLS模組和相關依賴

**具體任務**：
1. 從ASL.js移除MLS模組載入
2. 檢查並更新所有模組的MLS依賴
3. 刪除MLS.js文件
4. 更新測試代碼和文檔

**驗收標準**：
- MLS模組完全移除
- 所有依賴關係清理完成
- 系統功能正常運作

---

## 6. 功能遷移清單

### 6.1 核心帳本管理函數（8個）
- `MLS_createLedger` → `CM_createLedger`
- `MLS_getLedgerList` → `CM_getLedgerList`
- `MLS_getLedgerById` → `CM_getLedgerById`
- `MLS_updateLedger` → `CM_updateLedger`
- `MLS_deleteLedger` → `CM_deleteLedger`
- `MLS_editLedger` → `CM_editLedger`

### 6.2 特定類型帳本函數（3個）
- `MLS_createProjectLedger` → `CM_createProjectLedger`
- `MLS_createSharedLedger` → `CM_createSharedLedger`
- `MLS_createCategoryLedger` → `CM_createCategoryLedger`

### 6.3 協作管理函數（4個）
- `MLS_getCollaborators` → `CM_getCollaborators`
- `MLS_inviteCollaborator` → `CM_inviteCollaborator`
- `MLS_removeCollaborator` → `CM_removeCollaborator`
- `MLS_getPermissions` → `CM_getPermissions`

### 6.4 API端點映射（9個）
- `GET /api/v1/ledgers`
- `POST /api/v1/ledgers`
- `GET /api/v1/ledgers/:id`
- `PUT /api/v1/ledgers/:id`
- `DELETE /api/v1/ledgers/:id`
- `GET /api/v1/ledgers/:id/collaborators`
- `POST /api/v1/ledgers/:id/invitations`
- `DELETE /api/v1/ledgers/:id/collaborators/:userId`
- `GET /api/v1/ledgers/:id/permissions`

---

## 10. 文件更新清單

### 10.1 核心模組文件更新（2個）
- `13. Replit_Module code_BL/1313. CM.js` - 整合MLS功能，升級至v2.1.0
- `13. Replit_Module code_BL/1351. MLS.js` - 完全刪除

### 10.2 API服務層文件更新（1個）
- `ASL.js` - 移除MLS依賴，更新所有MLS調用為CM

### 10.3 LLD技術文件更新（2個）
- `12. Replit_LLD_BL/1213. CM_協作管理模組.md` - 更新為協作與帳本管理模組
- `12. Replit_LLD_BL/1211. MLS_多帳本模組.md` - 標記為deprecated

### 10.4 測試相關文件更新（2個）
- `14. Replit_Test plan_BL/1451. MLS_多帳本管理模組.md` - 標記為deprecated
- `15. Replit_Test Code_BL/1551. TC_MLS.js` - 更新為測試CM模組功能

**總計：7個文件需要更新或刪除**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-11-10 | 初版建立，定義MLS與CM模組整合計畫 | LCAS PM Team |

---

> **重要提醒**：此變更將對LCAS 2.0帳本管理架構產生重大影響，實現統一帳本管理模式。所有開發人員請嚴格遵循四階段實作規劃，確保每個階段的驗收標準都能達成。

> **MVP原則堅持**：本次整合專注於解決當前模組職責重疊問題，避免過度工程化設計，確保在簡化架構的同時建立可持續發展的基礎。

> **關鍵Insight**：模組職責清晰是MVP成功的關鍵。CM模組統一管理所有後續帳本不僅解決當前問題，更為系統長期發展建立穩固基礎，符合敏捷開發的可持續性原則。
