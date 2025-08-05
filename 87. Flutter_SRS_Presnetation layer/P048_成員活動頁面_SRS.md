
# P048_成員活動頁面_SRS

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

提供詳細的協作成員活動監控和分析功能，包含成員行為統計、活躍度分析、貢獻度評估等，幫助管理者了解團隊協作狀況並優化協作效率。

---

## 2. 使用者故事（User Story）

- 作為帳本管理者，我希望能夠監控成員的活動狀況，以便了解團隊的協作效率。
- 作為協作團隊領導，我希望能夠查看成員的貢獻度分析，以便合理分配工作和給予回饋。
- 作為成員本人，我希望能夠查看自己的活動記錄，以便了解自己的使用習慣。

---

## 3. 前置條件（Preconditions）

- 使用者已登入LCAS系統
- 使用者對該帳本具備檢視權限或以上
- 協作帳本存在且有活動記錄
- 網路連接正常

---

## 4. 功能流程（User Flow / Functional Flow）

### 4.1 活動概覽流程
1. 進入成員活動頁面
2. 載入活動統計摘要
3. 顯示成員活躍度排行
4. 展示活動趨勢圖表

### 4.2 個別成員分析流程
1. 選擇特定成員
2. 載入該成員詳細活動
3. 顯示活動時間線
4. 分析行為模式

### 4.3 活動比較流程
1. 選擇多個成員
2. 設定比較指標
3. 生成比較報表
4. 匯出分析結果

---

## 5. 輸入項目（Inputs）

| 欄位名稱 | 型別 | 限制條件 | UI 顯示 | 備註 |
|----------|------|----------|---------|------|
| 時間範圍 | DateRange | 最多365天 | 日期選擇器 | 預設最近30天 |
| 成員選擇 | Array | 帳本成員清單 | 多選列表 | 可全選 |
| 活動類型 | Array | 預定義活動類型 | 複選框 | 可自訂篩選 |
| 統計維度 | String | daily/weekly/monthly | 單選按鈕 | 統計粒度 |
| 比較模式 | String | individual/group/trend | 選項按鈕 | 分析模式 |

---

## 6. 輸出項目（Outputs / Responses）

### 6.1 活動統計摘要
- 總活動次數和活躍成員數
- 平均每日活動次數
- 活動類型分布統計
- 活躍時段分析

### 6.2 成員活躍度排行
- 成員活動次數排名
- 貢獻度評分
- 最後活動時間
- 活躍度趨勢變化

### 6.3 詳細活動記錄
- 時間軸活動展示
- 活動內容和影響
- 協作互動記錄
- 異常活動標記

---

## 7. 驗證規則（Validation Rules）

### 7.1 查詢參數驗證
- 時間範圍合理性檢查
- 成員存在性驗證
- 查詢複雜度限制

### 7.2 權限驗證
- 活動記錄檢視權限
- 成員隱私設定檢查
- 敏感活動資料權限

### 7.3 資料完整性驗證
- 活動記錄完整性
- 統計資料一致性
- 時間邏輯正確性

---

## 8. 錯誤處理（Error Handling）

### 8.1 查詢錯誤
- **無活動記錄**: 顯示空狀態，建議擴大範圍
- **查詢超時**: 建議縮小查詢範圍
- **資料不完整**: 顯示可用資料，標註缺失

### 8.2 權限錯誤
- **檢視權限不足**: 隱藏敏感資訊
- **成員隱私限制**: 顯示匿名化資料
- **資料存取被拒**: 提示聯絡管理者

### 8.3 系統錯誤
- **載入失敗**: 提供重試選項
- **統計計算錯誤**: 顯示錯誤說明
- **圖表渲染失敗**: 提供替代顯示方式

---

## 9. UI 元件與排版需求（UI Requirements）

### 9.1 頁面佈局結構
```
成員活動頁面
├── 頂部導航列
│   ├── 返回按鈕
│   ├── 頁面標題：「成員活動」
│   └── 匯出按鈕
├── 篩選控制區域
│   ├── 時間範圍選擇器
│   ├── 成員多選器
│   ├── 活動類型篩選
│   └── 統計維度選擇
├── 活動統計摘要
│   ├── 關鍵指標卡片
│   ├── 活動分布圓餅圖
│   └── 趨勢變化折線圖
├── 成員活躍度排行
│   ├── 排行榜列表
│   ├── 活躍度評分
│   ├── 成員頭像
│   └── 快速操作按鈕
├── 活動時間線
│   ├── 時間軸導航
│   ├── 活動事件卡片
│   ├── 成員標識
│   └── 活動詳情
├── 成員比較分析
│   ├── 比較圖表
│   ├── 指標對比表
│   ├── 趨勢比較
│   └── 洞察建議
└── 底部操作列
    ├── 重新整理按鈕
    ├── 設定按鈕
    └── 分享按鈕
```

### 9.2 關鍵UI元件

| 元件名稱 | 類型 | 功能 | 互動說明 |
|----------|------|------|----------|
| 活動統計卡片 | StatsCard | 顯示關鍵指標 | 點擊查看詳情 |
| 成員排行榜 | LeaderBoard | 活躍度排名 | 支援排序和篩選 |
| 活動時間線 | ActivityTimeline | 時序活動展示 | 滾動載入更多 |
| 趨勢圖表 | TrendChart | 活動趨勢視覺化 | 支援縮放和篩選 |
| 成員比較器 | MemberComparator | 多成員指標比較 | 拖拽選擇成員 |
| 活動熱力圖 | HeatMap | 活動時間分布 | 顯示活躍時段 |

---

## 10. API 規格（API Specification）

### 10.1 取得成員活動統計 API
**端點**: GET /collaboration/member-activities/{ledgerId}  
**對應**: F025 成員活動分析功能

#### 10.1.1 請求（Request）
```json
{
  "timeRange": {
    "startDate": "ISO_8601_date",
    "endDate": "ISO_8601_date"
  },
  "memberIds": ["string"],
  "activityTypes": ["string"],
  "granularity": "daily|weekly|monthly",
  "includeDetails": "boolean"
}
```

#### 10.1.2 回應（Response）
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalActivities": "number",
      "activeMembers": "number",
      "averageDailyActivities": "number",
      "topActivityType": "string"
    },
    "memberRankings": [
      {
        "memberId": "string",
        "memberName": "string",
        "avatar": "string",
        "activityCount": "number",
        "contributionScore": "number",
        "lastActivity": "ISO_8601_datetime",
        "trend": "up|down|stable"
      }
    ],
    "activityDistribution": {
      "byType": {
        "entry_create": "number",
        "entry_edit": "number",
        "entry_delete": "number",
        "budget_update": "number"
      },
      "byTime": [
        {
          "period": "string",
          "count": "number"
        }
      ]
    },
    "memberComparison": [
      {
        "memberId": "string",
        "metrics": {
          "totalEntries": "number",
          "averageAmount": "number",
          "categoryUsage": "object",
          "peakHours": ["string"]
        }
      }
    ]
  }
}
```

### 10.2 取得成員詳細活動 API
**端點**: GET /collaboration/member-activities/{ledgerId}/member/{memberId}

#### 10.2.1 回應（Response）
```json
{
  "success": true,
  "data": {
    "memberInfo": {
      "memberId": "string",
      "memberName": "string",
      "joinDate": "ISO_8601_date",
      "role": "string",
      "status": "active|inactive"
    },
    "activityTimeline": [
      {
        "activityId": "string",
        "timestamp": "ISO_8601_datetime",
        "type": "string",
        "description": "string",
        "impact": "low|medium|high",
        "relatedData": "object"
      }
    ],
    "behaviorAnalysis": {
      "mostActiveHours": ["string"],
      "preferredCategories": ["string"],
      "averageEntryAmount": "number",
      "collaborationStyle": "frequent|periodic|sporadic"
    },
    "contributionMetrics": {
      "entriesCreated": "number",
      "budgetsManaged": "number",
      "membersInvited": "number",
      "conflictsResolved": "number"
    }
  }
}
```

---

## 11. 狀態與畫面切換（State Handling）

### 11.1 載入狀態
- **初始載入**: 顯示統計載入骨架
- **資料載入中**: 分段載入統計資料
- **載入完成**: 顯示完整活動分析
- **增量載入**: 載入更多歷史資料

### 11.2 篩選狀態
- **無篩選**: 顯示全部成員活動
- **篩選啟用**: 依條件顯示子集
- **無結果**: 顯示空狀態建議
- **篩選重置**: 恢復預設顯示

### 11.3 比較分析狀態
- **單一成員**: 個人活動詳情
- **多成員比較**: 並排比較介面
- **趨勢分析**: 時間序列圖表
- **洞察模式**: AI分析建議

---

## 12. 安全性與權限檢查（Security / Access Control）

### 12.1 活動資料權限
- 基於角色的資料存取
- 個人隱私設定遵循
- 敏感活動資料保護

### 12.2 隱私保護
- 個人活動資料匿名化選項
- 敏感時間段資料遮罩
- 跨成員資料關聯限制

### 12.3 資料安全
- 活動查詢日誌記錄
- 異常查詢行為偵測
- 資料匯出權限控制

---

## 13. 其他補充需求（Others）

### 13.1 效能需求
- 統計資料載入時間 < 3秒
- 圖表渲染時間 < 2秒
- 大量活動記錄分頁載入

### 13.2 無障礙設計
- 圖表資料表格替代檢視
- 統計資料螢幕閱讀器支援
- 鍵盤導航完整支援

### 13.3 多語言支援
- 活動描述國際化
- 統計標籤多語言
- 分析洞察本地化

### 13.4 版本記錄
- v1.0.0 - 初始版本，包含完整成員活動分析功能

---

**文件結束**
