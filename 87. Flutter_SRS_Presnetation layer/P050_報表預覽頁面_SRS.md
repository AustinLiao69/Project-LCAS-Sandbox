# P050_報表預覽頁面_SRS

**文件編號**: P050-SRS  
**版本**: v1.0.0  
**建立日期**: 2025-01-26  
**建立者**: LCAS PM Team

## 文件資訊
- **文件版次**: v1.0.0

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

提供完整的報表預覽功能，支援多種檢視模式、互動式圖表、批註功能、列印預覽等，讓使用者能夠在匯出或分享前詳細檢視報表內容和效果。

---

## 2. 使用者故事（User Story）

- 作為報表建立者，我希望能夠在匯出前預覽報表的完整效果，以便確認格式和內容正確性。
- 作為團隊成員，我希望能夠在報表上新增批註和標記，以便與同事討論和改進報表。
- 作為管理者，我希望能夠以不同格式預覽報表，以便選擇最適合的輸出格式。

---

## 3. 前置條件（Preconditions）

- 使用者已登入LCAS系統
- 存在已生成的報表或報表草稿
- 使用者具備報表檢視權限
- 瀏覽器支援現代Web標準

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 基本預覽流程
1. 進入報表預覽頁面
2. 載入報表內容和樣式
3. 選擇預覽模式和檢視選項
4. 瀏覽報表各個部分

### 4.2 互動式檢視流程
1. 點擊圖表進行互動
2. 檢視詳細數據提示
3. 展開或摺疊表格部分
4. 調整圖表參數

### 4.3 批註協作流程
1. 啟用批註模式
2. 在報表上新增批註點
3. 輸入批註內容
4. 分享批註給團隊成員

### 4.4 列印預覽流程
1. 切換到列印模式
2. 調整頁面設定
3. 預覽分頁效果
4. 設定列印選項

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 預覽模式 | String | web/print/mobile | 標籤選擇 | 切換檢視模式 |
| 縮放比例 | Number | 25%-300% | 滑桿控制 | 調整顯示大小 |
| 頁面導航 | Number | 1-總頁數 | 頁碼輸入 | 多頁報表導航 |
| 批註內容 | String | 最多500字 | 文字區域 | 協作批註 |
| 列印設定 | Object | 紙張、方向等 | 設定面板 | 列印預覽設定 |
| 篩選選項 | Array | 資料篩選條件 | 複選框 | 動態內容篩選 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 報表內容顯示
- 完整的報表版面配置
- 高品質的圖表渲染
- 準確的資料表格顯示
- 樣式和格式呈現

### 6.2 互動式功能
- 圖表懸停數據提示
- 可展開的詳細資料
- 可點擊的導航連結
- 動態篩選結果

### 6.3 預覽資訊
- 報表統計摘要
- 檔案大小估算
- 頁數和版面資訊
- 匯出格式選項

---

## 7. 驗證規則（Validation Rules）

### 7.1 內容完整性驗證
-圖表資料完整性檢查
- 表格資料正確性驗證
- 版面配置合理性確認

### 7.2 格式相容性驗證
- 預覽格式支援性檢查
- 字型和樣式相容性驗證
- 圖片和媒體檔案載入確認

### 7.3 效能驗證
- 大型報表載入時間檢查
- 記憶體使用量監控
- 響應速度評估

---

## 8. 錯誤處理（Error Handling）

### 8.1 載入錯誤
- **報表載入失敗**: 顯示重試選項，提供錯誤詳情
- **圖表渲染失敗**: 顯示文字替代，標示圖表問題
- **樣式載入錯誤**: 使用預設樣式，提示樣式缺失

### 8.2 互動錯誤
- **圖表互動失敗**: 禁用互動功能，保持靜態顯示
- **資料篩選錯誤**: 重置篩選條件，顯示原始資料
- **批註儲存失敗**: 本地暫存批註，提示網路問題

### 8.3 格式錯誤
- **版面配置錯誤**: 自動調整版面，標示調整內容
- **字型不支援**: 使用替代字型，提示字型變更
- **圖片載入失敗**: 顯示佔位圖，標示圖片路徑

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
報表預覽頁面
├── 頂部工具列
│   ├── 返回按鈕
│   ├── 報表標題
│   ├── 檢視模式切換
│   └── 操作選單
├── 預覽控制列
│   ├── 縮放控制
│   │   ├── 縮小按鈕
│   │   ├── 縮放滑桿
│   │   ├── 放大按鈕
│   │   └── 適合頁面
│   ├── 頁面導航
│   │   ├── 上一頁
│   │   ├── 頁碼輸入
│   │   ├── 總頁數顯示
│   │   └── 下一頁
│   ├── 檢視選項
│   │   ├── 全螢幕按鈕
│   │   ├── 批註開關
│   │   ├── 網格顯示
│   │   └── 標尺顯示
│   └── 快速操作
│       ├── 列印按鈕
│       ├── 匯出按鈕
│       ├── 分享按鈕
│       └── 編輯按鈕
├── 主要預覽區域
│   ├── 報表畫布
│   │   ├── 報表內容
│   │   ├── 互動式圖表
│   │   ├── 批註標記
│   │   └── 選取框架
│   ├── 側邊面板（可摺疊）
│   │   ├── 頁面縮圖
│   │   ├── 書籤導航
│   │   ├── 批註清單
│   │   └── 搜尋功能
│   └── 底部資訊列
│       ├── 目前頁面資訊
│       ├── 縮放比例顯示
│       ├── 載入狀態
│       └── 錯誤提示
├── 批註工具列（可隱藏）
│   ├── 批註工具
│   │   ├── 新增批註
│   │   ├── 高亮文字
│   │   ├── 繪製形狀
│   │   └── 插入圖片
│   ├── 批註管理
│   │   ├── 批註清單
│   │   ├── 篩選批註
│   │   ├── 匯出批註
│   │   └── 刪除批註
│   └── 協作功能
│       ├── 分享批註
│       ├── 回覆批註
│       ├── 解決批註
│       └── 批註權限
└── 設定面板（彈出式）
    ├── 顯示設定
    │   ├── 背景顏色
    │   ├── 邊界顯示
    │   ├── 字型渲染
    │   └── 圖片品質
    ├── 列印設定
    │   ├── 紙張大小
    │   ├── 頁面方向
    │   ├── 邊距設定
    │   └── 頁眉頁腳
    └── 匯出設定
        ├── 檔案格式
        ├── 品質選項
        ├── 浮水印
        └── 安全性
```

### 9.2 關鍵UI元件

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 報表檢視器 | ReportViewer | 核心預覽功能 | 縮放、平移、選取 |
| 縮放控制器 | ZoomController | 縮放比例控制 | 滑桿、按鈕、手勢 |
| 頁面導航器 | PageNavigator | 多頁報表導航 | 頁碼跳轉、前後翻頁 |
| 批註編輯器 | AnnotationEditor | 批註功能 | 新增、編輯、刪除批註 |
| 互動圖表 | InteractiveChart | 圖表互動 | 懸停、點擊、篩選 |
| 列印預覽器 | PrintPreview | 列印效果預覽 | 分頁、頁面設定 |

---

## 10. API 規格（API Specification）

### 10.1 取得報表預覽資料 API
**端點**: GET /reports/{reportId}/preview  
**對應**: F025 報表預覽功能

#### 10.1.1 請求參數
```
reportId: string (路徑參數)
format: string (查詢參數) - web|print|mobile
quality: string (查詢參數) - high|medium|low
page: number (查詢參數) - 頁碼
```

#### 10.1.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "reportId": "string",
    "title": "string",
    "metadata": {
      "totalPages": "number",
      "pageSize": "string",
      "orientation": "portrait|landscape",
      "fileSize": "number",
      "lastModified": "ISO_8601_datetime"
    },
    "content": {
      "html": "string",
      "css": "string",
      "javascript": "string",
      "assets": [
        {
          "type": "image|chart|table",
          "url": "string",
          "alt": "string"
        }
      ]
    },
    "interactivity": {
      "charts": [
        {
          "chartId": "string",
          "type": "bar|line|pie",
          "data": "object",
          "options": "object"
        }
      ],
      "tables": [
        {
          "tableId": "string",
          "sortable": "boolean",
          "filterable": "boolean",
          "expandable": "boolean"
        }
      ]
    },
    "annotations": [
      {
        "annotationId": "string",
        "type": "comment|highlight|shape",
        "position": {
          "x": "number",
          "y": "number",
          "width": "number",
          "height": "number"
        },
        "content": "string",
        "author": "string",
        "createdAt": "ISO_8601_datetime",
        "resolved": "boolean"
      }
    ]
  }
}
```

### 10.2 新增報表批註 API
**端點**: POST /reports/{reportId}/annotations

#### 10.2.1 請求（Request）
```json
{
  "type": "comment|highlight|shape|drawing",
  "position": {
    "page": "number",
    "x": "number",
    "y": "number",
    "width": "number",
    "height": "number"
  },
  "content": "string",
  "style": {
    "color": "string",
    "backgroundColor": "string",
    "borderWidth": "number",
    "fontSize": "number"
  },
  "visibility": "public|private|team",
  "tags": ["string"]
}
```

#### 10.2.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "annotationId": "string",
    "createdAt": "ISO_8601_datetime",
    "author": {
      "userId": "string",
      "name": "string",
      "avatar": "string"
    }
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 載入狀態
- **初始載入**: 顯示載入動畫和進度
- **內容載入**: 分段載入報表各部分
- **圖表渲染**: 顯示圖表載入狀態
- **批註載入**: 載入協作批註

### 11.2 檢視狀態
- **正常檢視**: 標準預覽模式
- **全螢幕模式**: 隱藏導航元素
- **列印預覽**: 調整為列印版面
- **批註模式**: 顯示批註工具

### 11.3 互動狀態
- **圖表互動**: 顯示數據提示
- **文字選取**: 啟用複製和批註
- **批註編輯**: 顯示編輯工具
- **搜尋模式**: 高亮搜尋結果

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 預覽權限
- 報表檢視權限驗證
- 敏感內容存取控制
- 批註檢視權限確認

### 12.2 內容保護
- 浮水印自動添加
- 右鍵選單禁用
- 截圖保護機制

### 12.3 協作安全
- 批註作者身分驗證
- 批註內容過濾
- 分享權限控制

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- 預覽載入時間 < 3秒
- 圖表互動響應時間 < 0.5秒
- 大型報表分段載入優化

### 13.2 無障礙設計
- 螢幕閱讀器完整支援
- 鍵盤導航功能
- 高對比度顯示選項

### 13.3 多語言支援
- 介面元素國際化
- 批註內容多語言
- 錯誤訊息本地化

### 13.4 版本記錄
- v1.0.0 - 初始版本，包含基本預覽和批註功能

---

**文件結束**