# LCAS 2.0 LINE Bot 與記帳系統

## Overview

LCAS 2.0 是一個綜合性的記帳管理系統，支援 LINE OA 和 Flutter 移動應用雙平台。系統採用 Node.js 後端架構，整合 Firebase Firestore 資料庫，提供智慧記帳、帳本管理、預算控制、報表分析等完整功能。

核心特色包括：
- 雙平台支援：LINE OA 快速記帳 + Flutter APP 完整功能
- 四種使用者模式：專家模式、慣性模式、養成模式、引導模式
- 模組化架構：16個核心業務模組，支援高度可擴展性
- Firebase 動態配置：安全的雲端配置管理
- 智慧記帳：自然語言處理與科目智慧匹配

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### 整體架構設計

系統採用三層分離架構：
- **Presentation Layer (PL)**：Flutter 移動端介面
- **Application Logic Layer (APL)**：Dart API 客戶端
- **Business Logic Layer (BL)**：Node.js 後端服務

### 核心模組群組織

**核心業務模組群**：
- `BK.js` - 記帳核心模組（完整記帳功能）
- `LBK.js` - 快速記帳模組（LINE OA 專用）
- `AM.js` - 帳號管理模組（認證與用戶管理）
- `MLS.js` - 多帳本管理模組
- `BM.js` - 預算管理模組
- `CM.js` - 協作管理模組

**進階功能模組群**：
- `SR.js` - 排程提醒模組（智慧通知系統）
- `MRA.js` - 報表分析模組
- `BS.js` - 備份服務模組
- `GR.js` - 報表生成模組

**介面處理模組群**：
- `WH.js` - Webhook處理模組（LINE API 集成）
- `DD1.js` - 核心協調模組（資料分配）
- `DD2.js` - 智慧處理模組（自然語言解析）
- `DD3.js` - 資料服務模組

**系統支援模組群**：
- `FS.js` - Firestore操作模組
- `DL.js` - 診斷日誌模組
- `firebase-config.js` - 動態配置模組

### 資料庫架構

**Firestore 集合結構**：
- `users` - 用戶主資料與設定
- `ledgers` - 帳本結構與權限
  - `subjects` (subcollection) - 科目代碼
  - `entries` (subcollection) - 記帳記錄
  - `log` (subcollection) - 操作日誌
- `log` - 系統全域日誌

### 雙平台處理流程

**LINE OA 快速記帳流程**：
`LINE Webhook` → `WH.js` → `LBK.js` → `Firestore`

**APP 完整功能流程**：
`Flutter App` → `Dart API Client` → `BK.js/其他模組` → `Firestore`

### 四模式差異化支援

系統根據用戶評估結果提供四種體驗模式：
- **專家模式**：完整功能存取，高度客製化
- **慣性模式**：常用功能快速存取
- **養成模式**：引導式功能學習
- **引導模式**：簡化操作介面

### 安全性設計

- Firebase 動態配置管理敏感資訊
- JWT Token 認證機制
- LINE API 簽章驗證
- 用戶資料隔離（每用戶獨立帳本）

## External Dependencies

### 雲端服務

**Firebase 服務套件**：
- Firestore：主要資料庫
- Firebase Admin SDK：後端資料操作
- Firebase Functions：雲端函數（未來擴展）

**LINE 平台整合**：
- LINE Bot SDK：Webhook 處理與訊息回覆
- LINE Login API：OAuth 認證整合
- Rich Menu API：互動式選單

### 第三方服務

**Google 服務**：
- Google OAuth 2.0：第三方登入
- Google Sheets API：資料匯出功能（選用）
- Google Auth Library：認證管理

**Node.js 核心套件**：
- Express.js：Web 服務框架
- Moment-timezone：時區處理
- Node-cron：排程任務
- Crypto-js：加密處理
- Axios：HTTP 客戶端
- UUID：唯一識別碼生成

### 測試與開發工具

**測試框架**：
- Jest：JavaScript 單元測試
- Mockito：Dart 模擬測試
- Jest HTML Reporters：測試報告生成

**開發環境**：
- Replit：雲端開發環境
- Node.js v22.17.0：執行環境
- Dart SDK：Flutter 開發

### API 與資料格式

**通訊協定**：
- RESTful API：標準化介面設計
- WebSocket：即時通訊（協作功能）
- JSON：資料交換格式

**外部資料源**：
- 國定假日 API：排程智慧化
- 匯率 API：多幣別支援（未來擴展）