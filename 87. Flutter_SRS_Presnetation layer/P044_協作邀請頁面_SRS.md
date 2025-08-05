
# P044_協作邀請頁面_SRS

**文件版本**: v1.0.0  
**建立日期**: 2025-01-26  
**最後更新**: 2025-01-26  
**負責團隊**: LCAS PM Team

---

## 目次

1. [功能目的（Purpose）](#1-功能目的purpose)
2. [使用者故事（User Story）](#2-使用者故事user-story)
3. [前置條件（Preconditions）](#3-前置條件preconditions)
4. [功能流程（User Flow / Functional Flow）](#4-功能流程user-flow--functional-flow)
5. [輸入項目（Inputs）](#5-輸入項目inputs)
6. [輸出項目（Outputs / Responses）](#6-輸出項目outputs--responses)
7. [驗證規則（Validation Rules）](#7-驗證規則validation-rules)
8. [錯誤處理（Error Handling）](#8-錯誤處理error-handling)
9. [UI 元件與排版需求（UI Requirements）](#9-ui-元件與排版需求ui-requirements)
10. [API 規格（API Specification）](#10-api-規格api-specification)
11. [狀態與畫面切換（State Handling）](#11-狀態與畫面切換state-handling)
12. [安全性與權限檢查（Security / Access Control）](#12-安全性與權限檢查security--access-control)
13. [其他補充需求（Others）](#13-其他補充需求others)

---

## 1. 功能目的（Purpose）

提供帳本管理者邀請新成員加入協作的完整功能，包含邀請連結生成、權限設定、邀請管理等功能，確保安全且便利的成員邀請流程。

---

## 2. 使用者故事（User Story）

- 作為帳本管理者，我希望能夠邀請他人加入我的帳本，以便進行協作記帳。
- 作為被邀請者，我希望能夠輕鬆接受邀請並了解帳本的基本資訊，以便決定是否加入。
- 作為帳本管理者，我希望能夠設定邀請的權限和有效期限，以便控制帳本的安全性。

---

## 3. 前置條件（Preconditions）

- 使用者已登入LCAS系統
- 使用者對該帳本具備管理者或邀請權限
- 帳本狀態為啟用中
- 網路連接正常

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 發送邀請流程
1. 點擊「邀請成員」按鈕
2. 選擇邀請方式（EMAIL/連結/QR Code）
3. 設定被邀請者權限
4. 設定邀請有效期限
5. 輸入邀請訊息（可選）
6. 發送邀請

### 4.2 管理邀請流程
1. 查看待處理邀請清單
2. 檢視邀請狀態
3. 重新發送或取消邀請
4. 修改邀請權限設定

### 4.3 接受邀請流程（被邀請者）
1. 收到邀請通知或點擊邀請連結
2. 查看帳本基本資訊
3. 確認加入或拒絕邀請
4. 系統自動加入帳本成員清單

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 邀請方式 | String | email/link/qrcode | 選項按鈕 | 必選 |
| 被邀請者EMAIL | String | 有效EMAIL格式 | 文字輸入框 | EMAIL邀請時必填 |
| 權限等級 | String | viewer/editor/admin | 下拉選單 | 預設viewer |
| 邀請有效期 | Number | 1-30天 | 數字選擇器 | 預設7天 |
| 邀請訊息 | String | 最多500字 | 文字區域 | 可選 |
| 允許轉邀 | Boolean | true/false | 開關 | 預設false |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 邀請結果
- 邀請連結或QR Code
- 邀請發送狀態
- 邀請ID及追蹤資訊

### 6.2 邀請清單
- 待處理邀請清單
- 邀請狀態（待處理/已接受/已拒絕/已過期）
- 邀請詳細資訊

### 6.3 統計資訊
- 發送邀請總數
- 接受率統計
- 有效邀請數量

---

## 7. 驗證規則（Validation Rules）

### 7.1 邀請權限驗證
- 發送者必須具備邀請權限
- 被邀請者不能已是帳本成員
- 邀請數量不超過帳本上限

### 7.2 輸入驗證
- EMAIL格式驗證
- 權限等級合規性檢查
- 有效期限合理範圍

### 7.3 安全驗證
- 邀請頻率限制（每小時最多10個）
- 重複邀請檢查
- 帳本狀態確認

---

## 8. 錯誤處理（Error Handling）

### 8.1 邀請發送錯誤
- **EMAIL無效**: 顯示格式錯誤提示
- **用戶已存在**: 提示該用戶已是成員
- **權限不足**: 提示需要管理者權限

### 8.2 系統錯誤
- **網路錯誤**: 提示重試，暫存邀請資料
- **伺服器錯誤**: 顯示錯誤訊息，提供技術支援
- **郵件服務錯誤**: 提供連結邀請替代方案

### 8.3 邀請狀態錯誤
- **邀請已過期**: 提供重新邀請選項
- **帳本已滿**: 提示升級帳本或移除成員
- **被邀請者已拒絕**: 記錄拒絕原因

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
協作邀請頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題：「邀請成員」
│   └── 說明按鈕
├── 邀請方式選擇區域
│   ├── EMAIL邀請卡片
│   ├── 連結邀請卡片
│   └── QR Code邀請卡片
├── 邀請設定區域
│   ├── 權限設定
│   ├── 有效期設定
│   ├── 邀請訊息輸入
│   └── 進階選項
├── 邀請預覽區域
│   ├── 帳本資訊摘要
│   ├── 邀請訊息預覽
│   └── 發送按鈕
├── 邀請管理區域
│   ├── 待處理邀請清單
│   ├── 邀請狀態標籤
│   └── 操作按鈕
└── 底部統計資訊
    ├── 邀請統計
    ├── 成員上限提示
    └── 邀請額度顯示
```

### 9.2 關鍵UI元件

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 邀請方式卡片 | Card | 選擇邀請方式 | 單選，顯示不同選項 |
| 權限選擇器 | Dropdown | 設定成員權限 | 顯示權限說明 |
| 有效期滑桿 | Slider | 設定邀請期限 | 1-30天範圍 |
| QR Code顯示器 | QRCodeWidget | 生成分享QR | 支援儲存分享 |
| 邀請狀態標籤 | StatusBadge | 顯示邀請狀態 | 顏色區分狀態 |
| 邀請清單項目 | ListTile | 顯示邀請資訊 | 支援操作選單 |

---

## 10. API 規格（API Specification）

### 10.1 發送邀請 API
**端點**: POST /collaboration/invitations  
**對應**: F021 成員邀請功能

#### 10.1.1 請求（Request）
```json
{
  "ledgerId": "string",
  "inviteType": "email|link|qrcode",
  "inviteeEmail": "string",
  "permission": "viewer|editor|admin",
  "expiryDays": "number",
  "message": "string",
  "allowReinvite": "boolean"
}
```

#### 10.1.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "invitationId": "string",
    "inviteLink": "string",
    "qrCodeData": "string",
    "expiresAt": "ISO_8601_datetime",
    "emailSent": "boolean"
  }
}
```

### 10.2 邀請清單 API
**端點**: GET /collaboration/invitations/{ledgerId}

#### 10.2.1 回應（Response）
```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "invitationId": "string",
        "inviteeEmail": "string",
        "permission": "string",
        "status": "pending|accepted|rejected|expired",
        "createdAt": "ISO_8601_datetime",
        "expiresAt": "ISO_8601_datetime"
      }
    ],
    "totalCount": "number",
    "memberLimit": "number"
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 邀請發送狀態
- **編輯中**: 邀請表單編輯
- **發送中**: 顯示載入動畫
- **發送成功**: 顯示成功訊息和結果
- **發送失敗**: 顯示錯誤訊息

### 11.2 邀請管理狀態
- **載入中**: 邀請清單載入
- **顯示清單**: 正常邀請管理介面
- **處理中**: 邀請操作執行中
- **更新完成**: 重新載入清單

### 11.3 權限限制狀態
- **完整權限**: 所有邀請功能可用
- **限制權限**: 部分功能被限制
- **無權限**: 顯示權限不足提示

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 邀請權限驗證
- 邀請者權限等級檢查
- 被邀請者權限不可超過邀請者
- 帳本邀請功能開關檢查

### 12.2 邀請安全措施
- 邀請連結時效性控制
- 邀請使用次數限制
- IP限制和異常偵測

### 12.3 隱私保護
- 邀請資訊加密傳輸
- 敏感資料遮罩顯示
- 邀請歷史記錄保護

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- 邀請發送響應時間 < 3秒
- 邀請清單載入時間 < 2秒
- QR Code生成時間 < 1秒

### 13.2 無障礙設計
- 螢幕閱讀器支援邀請資訊
- 鍵盤導航支援
- 高對比度邀請狀態顯示

### 13.3 多語言支援
- 邀請訊息國際化
- 邀請狀態多語言顯示
- EMAIL邀請多語言模板

### 13.4 版本記錄
- v1.0.0 - 初始版本，包含基本邀請功能

---

**文件結束**
