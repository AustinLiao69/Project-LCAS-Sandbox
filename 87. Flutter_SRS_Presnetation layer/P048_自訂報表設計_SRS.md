
# P052_自訂報表設計_SRS

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

提供視覺化的自訂報表設計工具，讓使用者能夠根據個人需求建立客製化的財務報表，包含資料來源選擇、欄位設定、圖表配置、版面設計等功能。

---

## 2. 使用者故事（User Story）

- 作為進階使用者，我希望能夠建立符合特定需求的客製化報表，以便滿足個人化的分析需求。
- 作為企業財務人員，我希望能夠設計符合公司格式的報表範本，以便標準化財務報告流程。
- 作為數據分析師，我希望能夠靈活配置圖表和數據視覺化，以便進行深度財務分析。

---

## 3. 前置條件（Preconditions）

- 使用者已登入LCAS系統
- 使用者具備進階報表功能權限
- 存在可用的記帳資料
- 網路連接穩定

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 報表設計初始化流程
1. 進入自訂報表設計頁面
2. 選擇建立新報表或編輯現有報表
3. 設定報表基本資訊
4. 選擇報表類型和範本

### 4.2 資料來源配置流程
1. 選擇要包含的帳本
2. 設定時間範圍和篩選條件
3. 選擇要顯示的資料欄位
4. 預覽資料來源

### 4.3 報表版面設計流程
1. 拖拽設計報表版面
2. 新增圖表和表格元件
3. 配置元件屬性和樣式
4. 調整版面配置和排版

### 4.4 報表預覽與儲存流程
1. 即時預覽報表效果
2. 測試不同資料範圍
3. 儲存報表設計
4. 設定為範本（可選）

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 報表名稱 | String | 2-50字元 | 文字輸入框 | 必填 |
| 報表描述 | String | 最多200字 | 文字區域 | 可選 |
| 資料來源 | Array | 使用者帳本清單 | 多選列表 | 必選至少一個 |
| 時間範圍 | DateRange | 1天~無限制 | 日期選擇器 | 必填 |
| 顯示欄位 | Array | 可用欄位清單 | 複選框 | 必選至少一個 |
| 圖表類型 | Array | 支援圖表類型 | 圖表選擇器 | 可選 |
| 版面配置 | Object | 拖拽配置物件 | 視覺化編輯器 | 必選 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 設計工作區顯示
- 即時報表預覽
- 元件屬性面板
- 工具箱和元件庫
- 版面配置網格

### 6.2 資料預覽
- 選定欄位的資料樣本
- 統計資訊摘要
- 圖表效果預覽
- 資料完整性狀態

### 6.3 儲存結果
- 報表設計檔案ID
- 範本儲存狀態
- 分享設定資訊
- 版本控制資訊

---

## 7. 驗證規則（Validation Rules）

### 7.1 基本資訊驗證
- 報表名稱唯一性檢查
- 描述內容合規性驗證
- 權限等級確認

### 7.2 資料來源驗證
- 帳本存取權限確認
- 資料範圍合理性檢查
- 欄位可用性驗證

### 7.3 設計配置驗證
- 版面元素重疊檢查
- 圖表資料匹配驗證
- 輸出格式相容性確認

---

## 8. 錯誤處理（Error Handling）

### 8.1 設計工具錯誤
- **元件配置錯誤**: 顯示配置指引，提供修正建議
- **版面衝突**: 自動調整重疊元件，標示衝突區域
- **資料綁定失敗**: 提示重新選擇資料來源

### 8.2 預覽錯誤
- **資料載入失敗**: 使用示例資料，標示資料來源問題
- **圖表渲染失敗**: 提供替代圖表類型建議
- **格式不相容**: 建議調整欄位配置

### 8.3 儲存錯誤
- **儲存空間不足**: 提示清理舊設計或升級容量
- **版本衝突**: 提供合併選項或另存新檔
- **權限不足**: 調整分享設定或申請權限

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
自訂報表設計頁面
├── 頂部工具列
│   ├── 返回按鈕
│   ├── 報表名稱編輯
│   ├── 儲存按鈕
│   └── 預覽按鈕
├── 左側工具面板
│   ├── 元件庫
│   │   ├── 表格元件
│   │   ├── 圖表元件
│   │   ├── 文字元件
│   │   └── 統計元件
│   ├── 資料來源設定
│   │   ├── 帳本選擇
│   │   ├── 時間範圍
│   │   ├── 欄位選擇
│   │   └── 篩選條件
│   └── 樣式設定
│       ├── 顏色主題
│       ├── 字型設定
│       ├── 間距設定
│       └── 邊框設定
├── 中央設計畫布
│   ├── 標尺和網格
│   ├── 拖拽區域
│   ├── 元件選取框
│   └── 即時預覽
├── 右側屬性面板
│   ├── 選中元件屬性
│   ├── 資料綁定設定
│   ├── 樣式調整
│   └── 行為設定
└── 底部狀態列
    ├── 縮放控制
    ├── 網格開關
    ├── 元件對齊工具
    └── 儲存狀態
```

### 9.2 關鍵UI元件

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 拖拽畫布 | DragCanvas | 視覺化設計區域 | 支援拖拽、縮放、多選 |
| 元件庫 | ComponentLibrary | 報表元件選擇 | 拖拽新增到畫布 |
| 屬性編輯器 | PropertyEditor | 元件屬性設定 | 即時預覽屬性變更 |
| 資料綁定器 | DataBinder | 資料來源配置 | 視覺化資料欄位選擇 |
| 圖表設計器 | ChartDesigner | 圖表客製化 | 支援多種圖表類型 |
| 版面對齊工具 | AlignmentTool | 元件對齊輔助 | 智慧對齊線和網格 |

---

## 10. API 規格（API Specification）

### 10.1 儲存報表設計 API
**端點**: POST /reports/custom-design  
**對應**: F023 自訂報表功能

#### 10.1.1 請求（Request）
```json
{
  "reportName": "string",
  "description": "string",
  "designConfig": {
    "layout": {
      "width": "number",
      "height": "number",
      "margin": "object",
      "orientation": "portrait|landscape"
    },
    "dataSource": {
      "ledgerIds": ["string"],
      "defaultDateRange": {
        "startDate": "ISO_8601_date",
        "endDate": "ISO_8601_date"
      },
      "filters": ["object"],
      "selectedFields": ["string"]
    },
    "components": [
      {
        "componentId": "string",
        "type": "table|chart|text|summary",
        "position": {
          "x": "number",
          "y": "number",
          "width": "number",
          "height": "number"
        },
        "properties": {
          "title": "string",
          "dataBinding": "string",
          "style": "object",
          "chartType": "bar|line|pie|area",
          "aggregation": "sum|avg|count|max|min"
        }
      }
    ],
    "theme": {
      "primaryColor": "string",
      "fontFamily": "string",
      "fontSize": "number"
    }
  },
  "isTemplate": "boolean",
  "shareSettings": {
    "isPublic": "boolean",
    "allowedUsers": ["string"]
  }
}
```

#### 10.1.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "designId": "string",
    "version": "number",
    "createdAt": "ISO_8601_datetime",
    "previewUrl": "string",
    "templateId": "string",
    "shareUrl": "string"
  }
}
```

### 10.2 預覽報表設計 API
**端點**: POST /reports/preview-design

#### 10.2.1 請求（Request）
```json
{
  "designConfig": "object",
  "previewData": {
    "dateRange": {
      "startDate": "ISO_8601_date",
      "endDate": "ISO_8601_date"
    },
    "sampleSize": "number"
  }
}
```

#### 10.2.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "previewHtml": "string",
    "previewImage": "string",
    "componentPreviews": [
      {
        "componentId": "string",
        "data": "object",
        "chartData": "object",
        "status": "success|warning|error",
        "message": "string"
      }
    ],
    "dataStats": {
      "recordCount": "number",
      "dateRange": "string",
      "completeness": "number"
    }
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 設計模式狀態
- **新建模式**: 空白設計畫布
- **編輯模式**: 載入現有設計
- **預覽模式**: 報表效果預覽
- **測試模式**: 不同資料測試

### 11.2 元件操作狀態
- **選擇狀態**: 元件選中高亮
- **拖拽狀態**: 拖拽移動元件
- **調整狀態**: 調整元件大小
- **配置狀態**: 屬性面板編輯

### 11.3 儲存狀態
- **編輯中**: 即時自動儲存
- **儲存中**: 顯示儲存進度
- **儲存成功**: 確認儲存完成
- **儲存失敗**: 顯示錯誤和重試

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 設計權限
- 自訂報表建立權限驗證
- 進階功能使用權限檢查
- 範本發布權限確認

### 12.2 資料安全
- 資料來源存取權限驗證
- 敏感欄位存取控制
- 設計檔案加密儲存

### 12.3 分享安全
- 分享權限細粒度控制
- 存取日誌完整記錄
- 異常操作監控

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- 即時預覽響應時間 < 1秒
- 複雜設計載入時間 < 5秒
- 大量元件操作流暢度保證

### 13.2 無障礙設計
- 設計工具鍵盤操作支援
- 元件屬性螢幕閱讀器友好
- 高對比度設計模式

### 13.3 多語言支援
- 設計工具介面國際化
- 元件屬性多語言支援
- 報表內容本地化

### 13.4 版本記錄
- v1.0.0 - 初始版本，包含基本拖拽設計功能

---

**文件結束**
