
# DCN-0015 重構ASL.js建立API統一回應格式

**版本**: v1.0.0  
**建立日期**: 2025-09-24  
**最後更新**: 2025-09-24  
**建立者**: LCAS SA Team  

---

## 目次 (Table of Contents)

### 1. [需求說明](#1-需求說明)
### 2. [業務背景與價值主張](#2-業務背景與價值主張)
   - 2.1 [業務需求](#21-業務需求)
   - 2.2 [預期效益](#22-預期效益)
### 3. [須新增/修改內容](#3-須新增修改內容)
   - 3.1 [ASL.js中介軟體強化](#31-asljs中介軟體強化)
   - 3.2 [統一回應格式規範](#32-統一回應格式規範)
   - 3.3 [四模式差異化處理](#33-四模式差異化處理)
   - 3.4 [BL層標準化改造](#34-bl層標準化改造)
### 4. [技術架構設計](#4-技術架構設計)
   - 4.1 [回應格式處理流程](#41-回應格式處理流程)
   - 4.2 [中介軟體設計架構](#42-中介軟體設計架構)
   - 4.3 [四模式處理機制](#43-四模式處理機制)
### 5. [實作階段規劃](#5-實作階段規劃)
### 6. [API 回應格式標準](#6-api-回應格式標準)
### 10. [文件更新清單](#10-文件更新清單)
### 11. [版本紀錄](#11-版本紀錄)

---

## 1. 需求說明

本次變更目標為：在ASL.js中建立統一的API回應格式處理機制，實現所有132個RESTful API端點的統一回應格式，並支援四種使用者模式的差異化處理。

此變更將解決當前API回應格式不一致的問題，通過在API Service Layer實作統一格式化中介軟體，確保所有API端點回傳一致且符合規範的回應格式。

---

## 2. 業務背景與價值主張

### 2.1 業務需求
- **回應格式統一**：132個API端點需要統一的回應格式規範
- **四模式支援**：支援Expert、Inertial、Cultivation、Guiding四種使用者模式差異化回應
- **職責分離**：API格式化處理應在API層完成，避免BL層職責過載
- **擴展性需求**：支援未來API端點的統一格式處理需求
- **配額管理需求**：P1-2階段需控制Firestore記錄量，避免超過每日配額限制

### 2.2 預期效益
- **開發效率**：統一的回應格式處理，減少重複代碼
- **維護便利**：集中化的格式處理邏輯，便於維護和修改
- **使用者體驗**：四模式差異化回應，提升個人化體驗
- **系統一致性**：所有API端點遵循統一的回應格式標準

---

## 3. 須新增/修改內容

### 3.1 ASL.js中介軟體強化

#### 3.1.1 統一格式化中介軟體
```javascript
// 擴充現有的 res.apiSuccess 和 res.apiError 中介軟體
app.use((req, res, next) => {
  // 統一成功回應格式
  res.apiSuccess = (data, message = '操作成功', userMode = null) => {
    const response = {
      success: true,
      data: data,
      message: message,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || generateRequestId(),
        userMode: userMode || req.user?.mode || 'Inertial',
        apiVersion: 'v1.0.0',
        processingTimeMs: Date.now() - req.startTime
      }
    };

    // 四模式差異化處理
    response.metadata = applyModeSpecificFields(response.metadata, userMode);
    
    res.status(200).json(response);
  };

  // 統一錯誤回應格式
  res.apiError = (message, errorCode, statusCode = 400, details = null) => {
    const response = {
      success: false,
      error: {
        code: errorCode,
        message: message,
        details: details
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || generateRequestId(),
        userMode: req.user?.mode || 'Inertial'
      }
    };

    res.status(statusCode).json(response);
  };

  next();
});
```

#### 3.1.2 四模式差異化處理函數
```javascript
function applyModeSpecificFields(metadata, userMode) {
  switch (userMode) {
    case 'Expert':
      metadata.expertFeatures = {
        detailedAnalytics: true,
        advancedOptions: true,
        performanceMetrics: true
      };
      break;
    case 'Cultivation':
      metadata.cultivationFeatures = {
        achievementProgress: true,
        gamificationElements: true,
        motivationalTips: true
      };
      break;
    case 'Guiding':
      metadata.guidingFeatures = {
        simplifiedInterface: true,
        helpHints: true,
        autoSuggestions: true
      };
      break;
    case 'Inertial':
    default:
      metadata.inertialFeatures = {
        stabilityMode: true,
        consistentInterface: true
      };
      break;
  }
  return metadata;
}
```

### 3.2 統一回應格式規範

#### 3.2.1 統一回應格式（成功與失敗使用相同結構）
**設計原則**：成功與失敗回應使用完全相同的JSON結構，僅透過 `success` 欄位區分狀態。

**統一格式定義**：
```javascript
{
  "success": boolean,           // true=成功, false=失敗
  "data": object | null,        // 成功時包含資料，失敗時為null
  "error": null | object,       // 成功時為null，失敗時包含錯誤資訊
  "metadata": {
    "timestamp": "2025-09-24T10:00:00.000Z",
    "requestId": "req_123456789",
    "userMode": "Expert|Inertial|Cultivation|Guiding",
    "apiVersion": "v1.0.0",
    "processingTimeMs": 150,
    // 四模式特定欄位（動態加入）
    "modeFeatures": {
      // 根據userMode動態加入對應欄位
    }
  }
}
```

**統一格式優勢**：
- **前端處理一致性**：所有API回應使用相同的判斷邏輯
- **減少條件分支**：統一的 `success` 欄位判斷
- **提升可維護性**：一套解析邏輯適用所有API
- **符合RESTful原則**：標準化的回應結構
```

#### 3.2.2 成功回應範例
```javascript
{
  "success": true,
  "data": {
    "transactionId": "txn_123456",
    "amount": 1500,
    "category": "餐飲"
  },
  "error": null,
  "metadata": {
    "timestamp": "2025-09-24T10:00:00.000Z",
    "requestId": "req_123456789",
    "userMode": "Expert",
    "apiVersion": "v1.0.0",
    "processingTimeMs": 150,
    "modeFeatures": {
      "expertAnalytics": true,
      "detailedMetrics": true
    }
  }
}
```

#### 3.2.3 失敗回應範例
```javascript
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "輸入參數驗證失敗",
    "field": "amount",
    "details": {
      "expectedType": "number",
      "actualValue": "abc"
    }
  },
  "metadata": {
    "timestamp": "2025-09-24T10:00:00.000Z",
    "requestId": "req_123456789",
    "userMode": "Expert",
    "apiVersion": "v1.0.0",
    "processingTimeMs": 45
  }
}
```

#### 3.2.4 統一格式優勢
- **前端處理一致性**：所有API回應使用相同的判斷邏輯
- **減少條件分支**：統一的 `success` 欄位判斷
- **提升可維護性**：一套解析邏輯適用所有API
- **符合RESTful原則**：標準化的回應結構

### 3.3 四模式差異化處理

#### 3.3.1 模式特定欄位定義
- **Expert模式**：包含詳細分析數據、進階選項、效能指標
- **Inertial模式**：穩定性導向，一致的介面元素
- **Cultivation模式**：成就進度、遊戲化元素、激勵提示
- **Guiding模式**：簡化介面、幫助提示、自動建議

#### 3.3.2 模式檢測機制
```javascript
function detectUserMode(req) {
  // 1. 從JWT Token中取得使用者模式
  if (req.user && req.user.mode) {
    return req.user.mode;
  }
  
  // 2. 從請求標頭中取得模式設定
  if (req.headers['x-user-mode']) {
    return req.headers['x-user-mode'];
  }
  
  // 3. 預設為Inertial模式
  return 'Inertial';
}
```

### 3.4 回應處理機制規範

#### 3.4.1 APL層模組回應處理規範
**8301-8304.dart模組統一處理邏輯**：
```dart
// 統一的API回應處理
if (response.success) {
  // 成功處理：導航到下一頁面或更新UI狀態
  navigateToNextScreen();
  updateUIState(response.data);
  showSuccessToast(response.metadata.userMode);
} else {
  // 失敗處理：顯示錯誤訊息
  showErrorDialog(response.error.message);
  logError(response.error.code, response.metadata.requestId);
  handleErrorNavigation(response.error.code);
}
```

#### 3.4.2 PL層模組回應處理規範
**7301-7302.dart模組統一處理邏輯**：
```dart
// 根據userMode調整UI回應
switch (response.metadata.userMode) {
  case 'Expert':
    showDetailedResponse(response);
    showAdvancedOptions();
    break;
  case 'Inertial':
    showStandardResponse(response);
    break;
  case 'Cultivation':
    showGamifiedResponse(response);
    showProgressIndicators();
    break;
  case 'Guiding':
    showSimplifiedResponse(response);
    showHelpHints();
    break;
}
```

#### 3.4.3 Flutter UI層回應處理規範
- **Loading狀態控制**：根據API呼叫狀態顯示/隱藏Loading
- **Toast訊息顯示**：根據 `success` 顯示成功或失敗訊息
- **頁面跳轉邏輯**：根據 `error.code` 決定跳轉目標
- **四模式UI調整**：根據 `metadata.userMode` 調整顯示風格
- **錯誤重試機制**：根據 `error.code` 決定是否提供重試選項

### 3.5 配額管理策略（P1-2階段）

#### 3.5.1 Firestore記錄策略
**P1-2階段配額控制**：
- **成功回應**：不記錄至Firestore，僅記錄在記憶體日誌
- **失敗回應**：僅記錄ERROR和CRITICAL等級至Firestore
- **配額監控**：實作智慧記錄策略，避免超過每日限額
- **緊急降級**：配額接近時自動切換至記憶體日誌

#### 3.5.2 記錄等級定義
```javascript
const LOG_LEVELS = {
  SUCCESS: 'SUCCESS',    // P1-2不記錄至Firestore
  INFO: 'INFO',         // P1-2不記錄至Firestore
  WARNING: 'WARNING',   // P1-2不記錄至Firestore
  ERROR: 'ERROR',       // P1-2記錄至Firestore
  CRITICAL: 'CRITICAL'  // P1-2記錄至Firestore
};
```

#### 3.5.3 後續階段擴展
- **P3階段**：加入完整審計日誌功能
- **P4階段**：實作使用者行為追蹤
- **生產階段**：開啟完整的日誌記錄機制

### 3.5 BL層標準化改造

#### 3.4.1 BL層統一回傳格式
```javascript
// BL層函數統一回傳格式
function BL_functionExample(inputData) {
  try {
    // 業務邏輯處理
    const result = processBusinessLogic(inputData);
    
    return {
      success: true,
      data: result,
      message: "業務處理成功"
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "BUSINESS_LOGIC_ERROR",
        message: error.message,
        details: error.details || null
      }
    };
  }
}
```

#### 3.4.2 ASL.js接收處理機制
```javascript
app.post('/api/v1/example', async (req, res) => {
  try {
    // 調用BL層函數
    const blResult = await BL_functionExample(req.body);
    
    if (blResult.success) {
      res.apiSuccess(blResult.data, blResult.message, detectUserMode(req));
    } else {
      res.apiError(
        blResult.error.message,
        blResult.error.code,
        400,
        blResult.error.details
      );
    }
  } catch (error) {
    res.apiError('系統內部錯誤', 'INTERNAL_SERVER_ERROR', 500);
  }
});
```

---

## 4. 技術架構設計

### 4.1 回應格式處理流程
```
客戶端請求 → ASL.js路由 → BL層函數 → 標準化回傳 → ASL.js格式化 → 統一回應格式 → 客戶端
```

### 4.2 中介軟體設計架構
```
請求進入 → 模式檢測中介軟體 → 業務邏輯處理 → 格式化中介軟體 → 回應輸出
```

### 4.3 四模式處理機制
```javascript
// 四模式處理策略
const MODE_STRATEGIES = {
  Expert: {
    includeAnalytics: true,
    includePerformance: true,
    includeAdvancedOptions: true
  },
  Inertial: {
    includeStability: true,
    includeConsistency: true
  },
  Cultivation: {
    includeAchievements: true,
    includeGamification: true,
    includeMotivation: true
  },
  Guiding: {
    includeSimplification: true,
    includeHints: true,
    includeAutoSuggestions: true
  }
};
```

---

## 5. 實作階段規劃

### Phase 1：架構設計與文件建立（Week 1）
- ✅ 撰寫 DCN-0015 文件
- 📝 定義統一回應格式規範
- 📝 設計四模式差異化處理機制
- 📝 更新相關技術文件

### Phase 2：核心功能實作（Week 2-3）
- 🔧 擴充ASL.js中介軟體功能
- 🔧 實作統一格式化處理邏輯
- 🔧 建立四模式差異化處理機制
- 🔧 建立BL層標準化回傳格式

### Phase 3：整合測試與部署（Week 4）
- 🧪 統一回應格式功能測試
- 🧪 四模式差異化處理測試
- 🧪 API端點回歸測試
- 🧪 端到端整合驗證

---

## 6. API 回應格式標準

### 6.1 HTTP狀態碼使用規範
| 狀態碼 | 使用場景 | 說明 |
|--------|----------|------|
| 200 | 成功 | 標準成功回應 |
| 201 | 建立成功 | 資源建立成功 |
| 204 | 無內容 | 刪除成功，無回應內容 |
| 400 | 請求錯誤 | 參數驗證失敗 |
| 401 | 未授權 | 認證失敗 |
| 403 | 權限不足 | 授權失敗 |
| 404 | 找不到資源 | 資源不存在 |
| 422 | 業務邏輯錯誤 | BL層邏輯驗證失敗 |
| 500 | 系統錯誤 | 伺服器內部錯誤 |

### 6.2 錯誤代碼規範
| 錯誤代碼 | 說明 | HTTP狀態碼 |
|----------|------|-----------|
| VALIDATION_ERROR | 輸入驗證錯誤 | 400 |
| AUTHENTICATION_ERROR | 認證錯誤 | 401 |
| AUTHORIZATION_ERROR | 授權錯誤 | 403 |
| RESOURCE_NOT_FOUND | 資源不存在 | 404 |
| BUSINESS_LOGIC_ERROR | 業務邏輯錯誤 | 422 |
| INTERNAL_SERVER_ERROR | 系統內部錯誤 | 500 |

---

## 10. 文件更新清單

### 10.1 核心依賴關係分析

#### 10.1.1 核心實作文件
| 文件 | 依賴類型 | 更新內容 | 優先級 |
|------|----------|----------|--------|
| `ASL.js` | 主要實作 | 新增統一回應格式處理中介軟體 | P0 |
| `8088. API設計規範.md` | 規範定義 | 更新統一回應格式標準 | P0 |
| `DCN-0011 建立API service layer.md` | 架構設計 | 補充統一回應格式機制 | P1 |

#### 10.1.2 BL層依賴文件
| 文件 | 依賴類型 | 更新內容 | 優先級 |
|------|----------|----------|--------|
| `1309. AM.js` | BL層函數 | 標準化回傳格式，移除自定義格式 | P0 |
| `1301. BK.js` | BL層函數 | 標準化回傳格式，移除自定義格式 | P0 |
| `1310. DL.js` | 日誌記錄 | 新增API回應日誌記錄機制 | P1 |
| `1311. FS.js` | 資料庫結構 | 新增API回應日誌Firestore結構 | P1 |

#### 10.1.3 API規格依賴文件
| 文件群組 | 數量 | 更新內容 | 優先級 |
|----------|------|----------|--------|
| `81. Flutter_SRS(API spec)_APL/*.yaml` | 13個 | 更新所有API端點回應格式範例 | P0 |
| `82. Flutter_LLD_APL/*.md` | 13個 | 更新所有LLD文件回應格式設計 | P1 |

#### 10.1.4 APL層依賴文件
| 文件 | 依賴類型 | 更新內容 | 優先級 |
|------|----------|----------|--------|
| `8301. 認證服務.dart` | API客戶端 | 更新回應解析邏輯 | P0 |
| `8302. 用戶管理服務.dart` | API客戶端 | 更新回應解析邏輯 | P0 |
| `8303. 記帳交易服務.dart` | API客戶端 | 更新回應解析邏輯 | P0 |
| `8304. 帳本管理服務.dart` | API客戶端 | 更新回應解析邏輯 | P0 |

#### 10.1.5 測試文件依賴
| 文件 | 依賴類型 | 更新內容 | 優先級 |
|------|----------|----------|--------|
| `0603. SIT_TC_P1.js` | 整合測試 | 更新API回應格式驗證邏輯 | P0 |
| `0692. SIT_TestData_P1.json` | 測試資料 | 更新測試資料回應格式 | P0 |
| `85號資料夾測試檔案` | 3個 | 更新APL層測試案例 | P1 |

### 10.2 執行Action清單

#### 10.2.1 Phase 1 - 核心架構建立（Week 1）
**必須執行的Action**：
1. **更新ASL.js統一回應格式**：
   - 實作統一回應格式中介軟體
   - 整合四模式差異化處理邏輯
   - 實作配額管理機制
   
2. **更新8088 API設計規範**：
   - 定義統一回應格式標準
   - 更新錯誤處理規範
   - 新增四模式支援規範

3. **更新BL層函數標準化**：
   - AM.js標準化回傳格式
   - BK.js標準化回傳格式
   - 移除自定義回應格式

4. **更新SIT測試邏輯**：
   - 修改0603.js測試邏輯
   - 更新0692.json測試資料格式
   - 新增統一格式驗證測試

#### 10.2.2 Phase 2 - 文件同步更新（Week 2）
**必須執行的Action**：
1. **更新API規格文件群**：
   - 81號資料夾13個.yaml檔案回應格式更新
   - 統一錯誤處理範例
   - 四模式差異化回應範例

2. **更新LLD設計文件群**：
   - 82號資料夾13個.md檔案
   - 新增回應處理機制規範
   - 更新四模式支援設計

3. **更新APL層模組**：
   - 8301-8304.dart回應解析邏輯
   - 統一錯誤處理機制
   - 四模式UI調整邏輯

4. **更新測試相關檔案**：
   - 84號資料夾測試計劃更新
   - 85號資料夾測試代碼更新
   - SIT測試資料格式調整

#### 10.2.3 Phase 3 - 驗證與部署（Week 3）
**必須執行的Action**：
1. **執行完整回歸測試**：
   - 所有132個API端點功能測試
   - 統一回應格式驗證測試
   - 四模式差異化測試

2. **效能與監控建立**：
   - API回應時間監控機制
   - Firestore配額監控系統
   - 錯誤率統計儀表板

3. **文件審查與確認**：
   - 所有文件更新完成性檢查
   - 跨文件一致性驗證
   - 技術債務清理

4. **生產環境準備**：
   - 部署檢查清單建立
   - 回滾機制準備
   - 監控告警設定

**總計影響文件數量：42個文件需要更新**
**預估工作量：3週（21個工作天）**
**關鍵里程碑**：
- Week 1 End：核心統一回應格式機制完成
- Week 2 End：所有文件同步更新完成  
- Week 3 End：完整測試驗證通過，準備生產部署

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-09-24 | 初版建立，定義ASL.js統一回應格式處理架構 | LCAS SA Team |

---

> **重要提醒**：此變更將對LCAS 2.0系統的API回應格式產生重大影響，涉及所有132個API端點的回應格式標準化。所有開發人員請嚴格遵循實作階段規劃，確保每個階段的驗收標準都能達成，並在生產環境部署前進行充分的回歸測試。
