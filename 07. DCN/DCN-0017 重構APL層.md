
# DCN-0017 重構APL層

**版本**: v1.0.0  
**建立日期**: 2025-10-14  
**最後更新**: 2025-10-14  
**建立者**: LCAS PM Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [建立統一APL Gateway模組](#31-建立統一apl-gateway模組)
   - 3.2 [功能整合與代碼遷移](#32-功能整合與代碼遷移)
   - 3.3 [舊模組移除與清理](#33-舊模組移除與清理)
   - 3.4 [版本升級機制](#34-版本升級機制)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [統一Gateway架構](#41-統一gateway架構)
   - 4.2 [API路由映射設計](#42-api路由映射設計)
   - 4.3 [統一錯誤處理機制](#43-統一錯誤處理機制)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [API端點整合清單](#6-api端點整合清單)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：重構APL層架構，將現有4個獨立模組（8301-8304）整合為單一統一Gateway模組，實現與ASL層相同的轉發窗口設計模式。

根據9901文件的PG角色定位與MVP階段需求，此變更專注於解決當前架構不一致性問題，建立統一的API轉發機制，提升代碼維護性與開發效率。

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **架構一致性需求**：APL層與ASL層採用相同的單一模組設計模式
- **維護效率提升**：減少代碼重複，統一維護入口
- **MVP快速迭代**：簡化架構支援快速功能開發
- **開發資源優化**：降低跨模組維護成本

### 2.2 預期效益
- **開發效率提升50%**：統一模組減少重複代碼開發工作
- **維護成本降低**：單一入口點便於問題追蹤和修復
- **架構統一性**：與ASL.js設計保持一致，降低學習成本
- **擴展性提升**：新增API功能只需修改單一模組

---

## 3. 須新增/修改內容

### 3.1 建立統一APL Gateway模組

#### 3.1.1 新建模組規格
- **檔案名稱**：`8300. APL_Gateway.dart`
- **模組版本**：v1.0.0
- **主要職責**：統一處理Flutter APP與ASL層的API轉發
- **架構模式**：單一Gateway轉發所有API請求

#### 3.1.2 核心功能設計
```dart
class APLGateway {
  // 統一HTTP客戶端
  final http.Client _httpClient;
  
  // API路由映射表
  final Map<String, String> _routeMapping;
  
  // 統一請求處理方法
  Future<UnifiedApiResponse<T>> forwardRequest<T>(
    String method,
    String endpoint, 
    Map<String, dynamic>? body,
    T Function(dynamic) dataParser
  );
  
  // 各服務的專門方法
  AuthService get auth => AuthService(this);
  UserService get user => UserService(this);  
  TransactionService get transaction => TransactionService(this);
  LedgerService get ledger => LedgerService(this);
}
```

#### 3.1.3 統一API轉發機制
- **目標服務器**：`http://0.0.0.0:5000` (ASL.js)
- **轉發策略**：純轉發，不修改請求內容
- **回應處理**：統一解析ASL回應格式
- **錯誤處理**：統一錯誤處理邏輯

### 3.2 功能整合與代碼遷移

#### 3.2.1 模組功能整合範圍

**8301. 認證服務.dart** → 整合至APLGateway
- 19個認證API端點轉發邏輯
- OAuth Google登入處理
- Token管理與刷新機制
- 密碼重設流程

**8302. 用戶管理服務.dart** → 整合至APLGateway  
- 11個用戶管理API端點
- 個人資料CRUD操作
- 用戶偏好設定管理
- 帳戶狀態管理

**8303. 記帳交易服務.dart** → 整合至APLGateway
- 20個記帳交易API端點
- 交易CRUD操作
- 統計數據查詢
- 圖表資料處理

**8304. 帳本管理服務.dart** → 整合至APLGateway
- 14個帳本管理API端點
- 帳本CRUD操作
- 共享帳本管理
- 帳本權限控制

#### 3.2.2 統一資料模型管理
```dart
// 統一回應模型
class UnifiedApiResponse<T> {
  final bool success;
  final T? data;
  final String message;
  final Map<String, dynamic>? metadata;
  final ApiError? error;
}

// 統一錯誤模型
class ApiError {
  final String code;
  final String message;
  final Map<String, dynamic>? details;
}
```

### 3.3 舊模組移除與清理

#### 3.3.1 段階式移除策略
1. **Phase 1**: 建立新的APLGateway，保留舊模組向後相容
2. **Phase 2**: 逐步遷移功能，測試驗證
3. **Phase 3**: 移除舊模組檔案，更新相關引用

#### 3.3.2 相容性處理
```dart
// 提供舊模組相容性接口（暫時保留）
@Deprecated('使用APLGateway.auth替代')
class AuthService extends APLGateway {
  // 向後相容的包裝方法
}
```

### 3.4 版本升級機制

#### 3.4.1 版本規劃
- **8300. APL_Gateway.dart**: v1.0.0 → v1.2.0 (完整版)
- **83號資料夾結構更新**: 移除8301-8304.dart

#### 3.4.2 函數版次升級
- 所有轉發函數版次升級至對應的1.1.x版本
- 新增統一處理函數版次為1.0.x版本

---

## 4. 技術架構設計

### 4.1 統一Gateway架構

#### 4.1.1 服務分層設計
```
Flutter APP → APL Gateway (8300.dart) → ASL.js (Port 5000) → BL層函數
```

#### 4.1.2 技術優勢分析
- **單一職責原則**：一個模組專責API轉發
- **代碼複用性**：共用HTTP處理邏輯
- **維護便利性**：統一錯誤處理和日誌記錄
- **擴展靈活性**：新增API只需添加路由映射

### 4.2 API路由映射設計

#### 4.2.1 路由映射表結構
```dart
final Map<String, String> apiRouteMapping = {
  // 認證服務路由 (19個端點)
  'auth.register': '/api/v1/auth/register',
  'auth.login': '/api/v1/auth/login',
  'auth.googleLogin': '/api/v1/auth/google-login',
  // ... 其他認證端點
  
  // 用戶管理路由 (11個端點)
  'users.profile': '/api/v1/users/profile',
  'users.updateProfile': '/api/v1/users/profile',
  // ... 其他用戶管理端點
  
  // 記帳交易路由 (20個端點)
  'transactions.list': '/api/v1/transactions',
  'transactions.create': '/api/v1/transactions',
  // ... 其他交易端點
  
  // 帳本管理路由 (14個端點)
  'ledgers.list': '/api/v1/ledgers',
  'ledgers.create': '/api/v1/ledgers',
  // ... 其他帳本端點
};
```

### 4.3 統一錯誤處理機制

#### 4.3.1 錯誤分類與處理
```dart
enum ApiErrorType {
  network,      // 網路連線錯誤
  server,       // 伺服器錯誤
  validation,   // 資料驗證錯誤
  business,     // 業務邏輯錯誤
  auth,         // 認證錯誤
}

class ErrorHandler {
  static void handleError(ApiError error, BuildContext context) {
    switch (error.type) {
      case ApiErrorType.network:
        showNetworkErrorDialog(context);
        break;
      case ApiErrorType.auth:
        redirectToLogin(context);
        break;
      // ... 其他錯誤處理
    }
  }
}
```

---

## 5. 實作階段規劃

### 階段一：架構設計與統一模組建立（Week 1）

**目標**：建立統一的APL Gateway模組

**具體任務**：
1. 建立 `8300. APL_Gateway.dart` 作為統一轉發窗口
2. 整合現有4個模組的路由定義
3. 實作統一的HTTP請求處理機制
4. 建立統一的錯誤處理邏輯

**版本升級**：
- 新建模組：8300. APL_Gateway.dart v1.0.0
- 整合原有功能但架構完全重新設計

**驗收標準**：
- APL Gateway基礎架構建立完成
- 基本API轉發功能正常運作
- 統一錯誤處理機制實作完成

### 階段二：功能整合與程式碼遷移（Week 2）

**目標**：將4個模組功能整合至統一Gateway

**具體任務**：
1. 遷移認證服務API呼叫邏輯（19個端點）
2. 遷移用戶管理API呼叫邏輯（11個端點）  
3. 遷移記帳交易API呼叫邏輯（20個端點）
4. 遷移帳本管理API呼叫邏輯（14個端點）
5. 建立統一的資料模型管理

**版本升級**：
- 8300. APL_Gateway.dart → v1.1.0
- 標記舊模組為deprecated但保留向後相容

**驗收標準**：
- 所有64個API端點轉發功能正常
- 統一資料模型處理完成
- 向後相容性驗證通過

### 階段三：整合驗證與舊模組移除（Week 3）

**目標**：完成統一Gateway並移除舊模組

**具體任務**：
1. 驗證統一Gateway所有API功能正常
2. 更新相關文件和測試代碼
3. 移除8301-8304舊模組檔案
4. 更新83號資料夾結構

**版本升級**：
- 8300. APL_Gateway.dart → v1.2.0 (正式版)
- 移除8301.dart-8304.dart

**驗收標準**：
- 統一Gateway完整功能驗證通過
- 舊模組完全移除並清理
- 相關文件更新完成
- SIT測試P1-2完全通過

---

## 6. API端點整合清單

### 6.1 認證服務端點整合（19個端點）
```dart
// 從8301遷移至8300的端點清單
'POST /api/v1/auth/register'              // 用戶註冊
'POST /api/v1/auth/login'                 // 用戶登入
'POST /api/v1/auth/google-login'          // Google OAuth登入
'POST /api/v1/auth/logout'                // 用戶登出
'POST /api/v1/auth/refresh'               // Token刷新
'POST /api/v1/auth/forgot-password'       // 忘記密碼
'GET /api/v1/auth/verify-reset-token'     // 驗證重設Token
'POST /api/v1/auth/reset-password'        // 重設密碼
'POST /api/v1/auth/verify-email'          // Email驗證
'POST /api/v1/auth/bind-line'             // 綁定LINE帳號
'GET /api/v1/auth/bind-status'            // 查詢綁定狀態
// ... 其他8個認證端點
```

### 6.2 用戶管理端點整合（11個端點）
```dart
// 從8302遷移至8300的端點清單
'GET /api/v1/users/profile'               // 取得個人資料
'PUT /api/v1/users/profile'               // 更新個人資料
'DELETE /api/v1/users/account'            // 刪除帳戶
'GET /api/v1/users/preferences'           // 取得用戶偏好
'PUT /api/v1/users/preferences'           // 更新用戶偏好
// ... 其他6個用戶管理端點
```

### 6.3 記帳交易端點整合（20個端點）
```dart
// 從8303遷移至8300的端點清單
'GET /api/v1/transactions'                // 取得交易列表
'POST /api/v1/transactions'               // 建立新交易
'GET /api/v1/transactions/:id'            // 取得交易詳情
'PUT /api/v1/transactions/:id'            // 更新交易
'DELETE /api/v1/transactions/:id'         // 刪除交易
'GET /api/v1/transactions/statistics'     // 取得統計資料
'GET /api/v1/transactions/recent'         // 取得近期交易
'GET /api/v1/transactions/charts'         // 取得圖表資料
// ... 其他12個記帳交易端點
```

### 6.4 帳本管理端點整合（14個端點）
```dart
// 從8304遷移至8300的端點清單
'GET /api/v1/ledgers'                     // 取得帳本列表
'POST /api/v1/ledgers'                    // 建立新帳本
'GET /api/v1/ledgers/:id'                 // 取得帳本詳情
'PUT /api/v1/ledgers/:id'                 // 更新帳本
'DELETE /api/v1/ledgers/:id'              // 刪除帳本
'POST /api/v1/ledgers/:id/share'          // 分享帳本
'GET /api/v1/ledgers/:id/members'         // 取得帳本成員
// ... 其他7個帳本管理端點
```

---

## 10. 文件更新清單

### 10.1 核心架構文件更新
- `80. Flutter_PRD_APL/8001. PRD_APL.md`
  - 更新模組架構設計
  - 新增統一Gateway規格說明
  - 更新API轉發機制描述

### 10.2 LLD技術文件更新（1個新增）
- `82. Flutter_LLD_APL/8200. APL_Gateway.md`
  - 新增統一Gateway詳細設計文件
  - 包含架構設計、API路由映射、錯誤處理機制

### 10.3 測試計劃文件更新（5個）
- `84. Flutter_Test plan_APL/8400. APL_Gateway.md` - 新增統一測試計劃
- `85. Flutter_Test_code_APL/8500. APL_Gateway_test.dart` - 新增統一測試代碼
- 更新現有8501-8503測試代碼，適配新的Gateway架構

### 10.4 API規格文件標註
- `80. Flutter_PRD_APL/8020. API list.md` - 標註API實作位置變更
- `80. Flutter_PRD_APL/8025. API-BL mapping list.md` - 更新映射關係

**總計：10個文件需要更新或新增**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-10-14 | 初版建立，定義APL層統一Gateway重構計畫 | LCAS PM Team |

---

> **重要提醒**：此變更將對LCAS 2.0 APL層架構產生重大影響，實現與ASL層一致的單一模組設計。所有開發人員請嚴格遵循三階段實作規劃，確保每個階段的驗收標準都能達成，並在完成後進行充分的整合測試驗證。

> **MVP原則堅持**：本次重構專注於解決當前架構不一致性問題，避免過度工程，確保在提升維護性的同時不影響現有功能的穩定性。
