# P051_報表範本頁面_SRS

**文件編號**: P051-SRS

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

提供完整的報表範本管理功能，包含範本瀏覽、建立、編輯、分享、匯入匯出等，讓使用者能夠重複使用和分享報表設計，提高報表建立效率。

---

## 2. 使用者故事（User Story）

- 作為財務分析師，我希望能夠建立並儲存報表範本，以便重複生成相同格式的月度報表。
- 作為團隊負責人，我希望能夠分享標準化的報表範本給團隊成員，以便統一報表格式。
- 作為新使用者，我希望能夠使用現成的報表範本快速開始，以便降低學習成本。

---

## 3. 前置條件（Preconditions）

- 使用者已登入LCAS系統
- 使用者具備報表範本存取權限
- 存在可用的記帳資料（適用範本時）
- 網路連接穩定

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 範本瀏覽流程
1. 進入報表範本頁面
2. 瀏覽不同分類的範本
3. 搜尋特定類型範本
4. 預覽範本效果

### 4.2 範本建立流程
1. 選擇從頭建立或基於現有報表
2. 設定範本基本資訊
3. 設計範本版面和元件
4. 設定參數化欄位
5. 儲存並發布範本

### 4.3 範本使用流程
1. 選擇要使用的範本
2. 設定範本參數
3. 預覽生成效果
4. 生成最終報表

### 4.4 範本管理流程
1. 檢視我的範本清單
2. 編輯範本設定
3. 管理範本分享權限
4. 匯出或刪除範本

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 範本名稱 | String | 2-50字元 | 文字輸入 | 必填 |
| 範本描述 | String | 最多200字 | 文字區域 | 可選 |
| 範本分類 | String | 預定義分類清單 | 下拉選單 | 必選 |
| 參數設定 | Array | 參數化欄位定義 | 動態表單 | 可選 |
| 權限設定 | Object | 分享和使用權限 | 權限面板 | 必選 |
| 標籤 | Array | 最多10個標籤 | 標籤輸入 | 可選 |
| 縮圖 | File | 圖片檔案 | 檔案上傳 | 可選 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 範本清單顯示
- 範本縮圖和標題
- 建立者和建立時間
- 使用次數和評分
- 分類和標籤資訊

### 6.2 範本詳情
- 完整的範本描述
- 參數設定說明
- 範本預覽圖片
- 使用指南和範例

### 6.3 範本操作結果
- 範本建立或更新確認
- 分享連結和QR碼
- 使用統計資訊
- 匯出檔案下載連結

---

## 7. 驗證規則（Validation Rules）

### 7.1 範本內容驗證
- 範本名稱唯一性檢查
- 範本結構完整性驗證
- 參數定義正確性確認

### 7.2 權限驗證
- 範本建立權限檢查
- 分享權限等級驗證
- 商業範本使用權限確認

### 7.3 格式驗證
- 縮圖檔案格式和大小限制
- 範本描述內容合規性檢查
- 標籤格式和數量限制

---

## 8. 錯誤處理（Error Handling）

### 8.1 範本操作錯誤
- **範本載入失敗**: 顯示錯誤詳情，提供重試選項
- **範本儲存失敗**: 本地暫存設計，提示網路問題
- **範本刪除失敗**: 確認刪除權限，檢查相依性

### 8.2 使用錯誤
- **參數設定錯誤**: 標示錯誤欄位，提供修正建議
- **資料不相容**: 建議調整參數或選擇其他範本
- **權限不足**: 引導申請權限或選擇其他範本

### 8.3 分享錯誤
- **分享設定失敗**: 檢查網路連接，確認權限設定
- **匯入範本失敗**: 驗證檔案格式，檢查相容性
- **版本衝突**: 提供合併選項或版本比較

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
報表範本頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題：「報表範本」
│   ├── 搜尋輸入框
│   └── 新建範本按鈕
├── 篩選和分類列
│   ├── 分類標籤
│   │   ├── 全部範本
│   │   ├── 我的範本
│   │   ├── 公開範本
│   │   ├── 團隊範本
│   │   └── 商業範本
│   ├── 篩選選項
│   │   ├── 按類型篩選
│   │   ├── 按作者篩選
│   │   ├── 按評分篩選
│   │   └── 按時間篩選
│   └── 排序選項
│       ├── 最新建立
│       ├── 最多使用
│       ├── 最高評分
│       └── 名稱排序
├── 範本網格區域
│   ├── 範本卡片
│   │   ├── 範本縮圖
│   │   ├── 範本標題
│   │   ├── 建立者資訊
│   │   ├── 評分和使用次數
│   │   ├── 標籤顯示
│   │   └── 快速操作按鈕
│   ├── 載入更多按鈕
│   └── 空狀態提示
├── 範本詳情側邊欄（可摺疊）
│   ├── 範本預覽圖
│   ├── 詳細描述
│   ├── 參數說明
│   ├── 使用統計
│   ├── 評分和評論
│   └── 相關範本推薦
└── 底部操作列
    ├── 批次選擇工具
    ├── 匯入範本按鈕
    ├── 匯出範本按鈕
    └── 管理工具
```

### 9.2 關鍵UI元件

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 範本卡片 | TemplateCard | 顯示範本資訊 | 點擊預覽，長按選單 |
| 搜尋篩選器 | SearchFilter | 範本搜尋和篩選 | 實時搜尋結果更新 |
| 參數編輯器 | ParameterEditor | 設定範本參數 | 動態表單生成 |
| 權限管理器 | PermissionManager | 管理分享權限 | 角色選擇和權限設定 |
| 範本預覽器 | TemplatePreview | 預覽範本效果 | 縮放和互動預覽 |
| 評分系統 | RatingSystem | 範本評分和評論 | 星級評分和文字評論 |

---

## 10. API 規格（API Specification）

### 10.1 取得範本清單 API
**端點**: GET /reports/templates  
**對應**: F026 報表範本功能

#### 10.1.1 請求參數
```
category: string (查詢參數) - all|my|public|team|commercial
type: string (查詢參數) - financial|analysis|budget|custom
search: string (查詢參數) - 搜尋關鍵字
sort: string (查詢參數) - newest|popular|rating|name
page: number (查詢參數) - 頁碼
limit: number (查詢參數) - 每頁數量
```

#### 10.1.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "templateId": "string",
        "name": "string",
        "description": "string",
        "category": "financial|analysis|budget|custom",
        "type": "standard|custom|commercial",
        "thumbnail": "string",
        "author": {
          "userId": "string",
          "name": "string",
          "avatar": "string"
        },
        "createdAt": "ISO_8601_datetime",
        "updatedAt": "ISO_8601_datetime",
        "usageCount": "number",
        "rating": {
          "average": "number",
          "count": "number"
        },
        "tags": ["string"],
        "parameters": [
          {
            "name": "string",
            "type": "date|text|number|select",
            "required": "boolean",
            "description": "string"
          }
        ],
        "permissions": {
          "isPublic": "boolean",
          "canEdit": "boolean",
          "canUse": "boolean",
          "canShare": "boolean"
        }
      }
    ],
    "pagination": {
      "currentPage": "number",
      "totalPages": "number",
      "totalCount": "number"
    },
    "categories": [
      {
        "categoryId": "string",
        "name": "string",
        "count": "number"
      }
    ]
  }
}
```

### 10.2 建立範本 API
**端點**: POST /reports/templates

#### 10.2.1 請求（Request）
```json
{
  "name": "string",
  "description": "string",
  "category": "financial|analysis|budget|custom",
  "design": {
    "layout": "object",
    "components": ["object"],
    "styling": "object"
  },
  "parameters": [
    {
      "name": "string",
      "type": "date|text|number|select",
      "required": "boolean",
      "description": "string",
      "defaultValue": "string",
      "options": ["string"]
    }
  ],
  "permissions": {
    "isPublic": "boolean",
    "allowedUsers": ["string"],
    "allowedRoles": ["string"]
  },
  "tags": ["string"],
  "thumbnail": "string"
}
```

#### 10.2.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "templateId": "string",
    "version": "number",
    "createdAt": "ISO_8601_datetime",
    "shareUrl": "string",
    "previewUrl": "string"
  }
}
```

### 10.3 使用範本生成報表 API
**端點**: POST /reports/templates/{templateId}/generate

#### 10.3.1 請求（Request）
```json
{
  "parameters": {
    "dateRange": {
      "startDate": "ISO_8601_date",
      "endDate": "ISO_8601_date"
    },
    "ledgerIds": ["string"],
    "customParameters": {
      "parameterName": "value"
    }
  },
  "outputFormat": "pdf|excel|html",
  "title": "string",
  "description": "string"
}
```

#### 10.3.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "reportId": "string",
    "status": "generating|completed|failed",
    "estimatedTime": "number",
    "previewUrl": "string",
    "downloadUrl": "string"
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 瀏覽狀態
- **範本清單**: 顯示範本卡片網格
- **搜尋結果**: 顯示符合條件的範本
- **分類檢視**: 按分類顯示範本
- **詳情檢視**: 顯示範本詳細資訊

### 11.2 編輯狀態
- **建立模式**: 新建範本編輯器
- **編輯模式**: 修改現有範本
- **預覽模式**: 預覽範本效果
- **發布模式**: 設定分享權限

### 11.3 使用狀態
- **參數設定**: 填寫範本參數
- **生成中**: 顯示報表生成進度
- **完成狀態**: 顯示生成結果
- **錯誤狀態**: 顯示錯誤和解決方案

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 範本存取權限
- 基於角色的範本可見性
- 商業範本授權驗證
- 團隊範本成員資格確認

### 12.2 範本操作權限
- 建立範本權限檢查
- 編輯範本所有權驗證
- 刪除範本權限確認

### 12.3 分享安全
- 分享連結時效控制
- 範本內容敏感資料過濾
- 版權和知識產權保護

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- 範本清單載入時間 < 2秒
- 範本預覽生成時間 < 3秒
- 支援範本清單無限滾動

### 13.2 無障礙設計
- 範本卡片螢幕閱讀器支援
- 鍵盤導航完整支援
- 高對比度範本預覽

### 13.3 多語言支援
- 範本介面元素國際化
- 範本描述多語言支援
- 參數說明本地化

### 13.4 版本記錄
- v1.0.0 - 初始版本，包含基本範本管理功能

---

**文件結束**