# BR-0006 後端DB由Google Sheet改為Firestore

## 1. 需求說明
本次變更目標為：將LCAS專案後端資料存取方式，由現行Google Sheet全面切換至Firestore，並比照`Codes/2011. FS.js`所定義的資料結構與欄位設計。預期最終完成LINE OA → Replit Node.js → Firestore的完整串接。

---

## 2. 須修改/新增內容

### 2.1 Firestore資料結構（依`2011. FS.js`設計）
- 各主要collection與document規格如下：
  - `users`：以uid為doc，紀錄用戶註冊、帳本參加情形、設定等
  - `ledgers`：帳本主結構，欄位有ledgername、description、ownerUID、MemberUID、createdAt、updatedAt
    - `subjects`（sub-collection）：帳本下的科目代碼
    - `entries`（sub-collection）：帳本紀錄（記帳資料）
    - `log`（sub-collection）：操作日誌（欄位依照2011. FS.js）

### 2.2 程式端調整
- 移除所有Google Sheet相關資料操作與邏輯
- 建立/調整 Firestore CRUD function，資料存取請直接參照`Codes/2011. FS.js`範例（統一使用`FB_Serviceaccountkey.js`匯出的admin/db實例）
- 新增或重構資料存取層（Data Access Layer），使其專注處理Firestore存取
- 保持現有API與function參數命名/格式不變，僅更換底層存取

### 2.3 認證與安全
- Firestore service account密鑰統一存放於Replit Secrets，由`FB_Serviceaccountkey.js`統一呼叫
- 若需更進階權限控管規劃，可另行提出

### 2.4 日誌寫入
- 所有資料操作、錯誤皆需依2011模組`log`設計寫入Firestore（log collection）
- 保留console log協助除錯（如有需可同步寫file）

---

## 3. 不在本次範圍
- 不進行舊有Google Sheet資料遷移
- 不需支援回退（因目前僅於Sandbox驗證）
- 前端/LINE OA API規格不變，只需確保API回傳格式一致即可

---

## 4. 預期產出

- 完成全新以Firestore為底層的資料存取邏輯
- 所有collection、subcollection及欄位均符合`2011. FS.js`規格
- 完整測試LINE OA→Replit→Firestore全流程，包含正常/異常/失敗情境
- 日誌成功寫入Firestore log collection
- 開發與驗證過程如有新增欄位或調整，請即時文件化

---

## 5. 其他注意事項

- 若有Firestore結構設計變更，請同步修正`2011. FS.js`並回報
- 請持續將service account憑證維持於Replit Secrets，勿硬編碼於程式
- 開發過程如遇Firestore效能或結構問題，請即時提出討論

---
> 請所有開發人員以此需求單為依據實作，資料結構與欄位命名皆以`Codes/2011. FS.js`為準，不得自創欄位或隨意更動。