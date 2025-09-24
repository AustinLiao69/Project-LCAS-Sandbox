
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

#### 3.2.1 成功回應格式
```javascript
{
  "success": true,
  "data": {
    // API特定的回應數據
  },
  "message": "操作成功",
  "metadata": {
    "timestamp": "2025-09-24T10:00:00.000Z",
    "requestId": "req_123456789",
    "userMode": "Expert",
    "apiVersion": "v1.0.0",
    "processingTimeMs": 150,
    // 四模式特定欄位
    "expertFeatures": {
      "detailedAnalytics": true,
      "advancedOptions": true,
      "performanceMetrics": true
    }
  }
}
```

#### 3.2.2 錯誤回應格式
```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "輸入參數驗證失敗",
    "details": {
      "field": "amount",
      "issue": "金額必須大於0"
    }
  },
  "metadata": {
    "timestamp": "2025-09-24T10:00:00.000Z",
    "requestId": "req_123456789",
    "userMode": "Expert"
  }
}
```

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

### 3.4 BL層標準化改造

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

### 10.1 技術架構文件
- `ASL.js` - 新增統一回應格式處理中介軟體
- `8088. API設計規範.md` - 更新回應格式標準

### 10.2 API規格文件
- `81. Flutter_SRS(API spec)_APL/` - 所有13個API規格文件更新回應格式
- `82. Flutter_LLD_APL/` - 所有13個LLD文件更新回應格式範例

### 10.3 測試相關文件
- `05. SIT_Test plan/0501. SIT_P1.md` - 更新API回應格式測試案例
- `06. SIT_Test code/0603. SIT_TC_P1.js` - 更新測試驗證邏輯

**總計：28 個文件需要更新**

---

## 11. 版本紀錄

| 版本 | 日期 | 修改內容 | 修改者 |
|------|------|----------|--------|
| v1.0.0 | 2025-09-24 | 初版建立，定義ASL.js統一回應格式處理架構 | LCAS SA Team |

---

> **重要提醒**：此變更將對LCAS 2.0系統的API回應格式產生重大影響，涉及所有132個API端點的回應格式標準化。所有開發人員請嚴格遵循實作階段規劃，確保每個階段的驗收標準都能達成，並在生產環境部署前進行充分的回歸測試。
