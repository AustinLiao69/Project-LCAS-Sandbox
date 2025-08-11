
# 8601. 認證功能群組_v2.6.0

## 文件資訊
- **文件標題**: 認證功能群組Flutter實作文件
- **文件版本**: v2.6.0
- **創建日期**: 2025-01-21 10:00:00 +08:00 (台灣時間)
- **創建者**: LCAS PG Team
- **最後更新**: 2025-01-21 10:00:00 +08:00 (台灣時間)
- **對應設計文件**: 8801. 認證功能群組.md v2.5.0
- **對應需求文件**: 8701. 認證流程群組_SRS.md
- **模組代碼**: AUTH (Authentication)

---

## 📑 目次 (Table of Contents)

1. Flutter實作架構
   - 1.1 模組概述
   - 1.2 檔案結構
   - 1.3 依賴關係

2. 核心資料模型
   - 2.1 使用者模式枚舉
   - 2.2 認證頁面類型
   - 2.3 註冊資料模型

3. 歡迎頁面UI實作
   - 3.1 歡迎頁面建構函數
   - 3.2 模式選擇器建構函數

4. 登入頁面UI實作
   - 4.1 登入頁面建構函數
   - 4.2 OAuth按鈕組建構函數
   - 4.3 Email登入表單建構函數

5. 註冊頁面UI實作
   - 5.1 註冊頁面建構函數
   - 5.2 註冊表單建構函數

6. 密碼重設UI實作
   - 6.1 密碼重設頁面建構函數
   - 6.2 重設步驟建構函數

7. 登出確認UI實作
   - 7.1 登出確認頁面建構函數

8. 四模式UI實作
   - 8.1 精準控制者模式UI
   - 8.2 紀錄習慣者模式UI
   - 8.3 轉型挑戰者模式UI
   - 8.4 潛在覺醒者模式UI

9. 共用元件實作
   - 9.1 載入指示器
   - 9.2 主題配置
   - 9.3 輔助函數

10. 版本記錄

---

## 1.0 Flutter實作架構

### 1.1 模組概述

```dart
/**
 * AUTH_認證UI群組_2.6.0
 * @module AUTH-UI模組
 * @description Flutter認證介面群組 - 純Presentation Layer實作
 * @update 2025-01-21: 第一版實作，完整遵循8801設計規範
 */
```

**模組職責：**
- ✅ **UI Widget建構**：15個核心認證UI函數實作
- ✅ **四模式差異化**：精準控制者、紀錄習慣者、轉型挑戰者、潛在覺醒者
- ✅ **視覺呈現**：主題配置、動畫效果、使用者互動回饋
- ❌ **業務邏輯**：由Application Layer處理
- ❌ **資料存取**：由AP Layer提供

### 1.2 檔案結構

```
86. Flutter_Module code_Presentation layer/
├── 8601. 認證功能群組.md (v2.6.0)
├── auth_widgets.dart
├── auth_models.dart
├── auth_themes.dart
└── auth_utils.dart
```

### 1.3 依賴關係

```dart
// auth_widgets.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'auth_models.dart';
import 'auth_themes.dart';
import 'auth_utils.dart';
```

---

## 2.0 核心資料模型

### 2.1 使用者模式枚舉

```dart
/**
 * 使用者模式枚舉
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 定義四種使用者模式類型
 */
enum UserMode {
  controller,  // 精準控制者
  logger,      // 紀錄習慣者
  struggler,   // 轉型挑戰者
  sleeper,     // 潛在覺醒者
}

extension UserModeExtension on UserMode {
  String get displayName {
    switch (this) {
      case UserMode.controller:
        return '精準控制者';
      case UserMode.logger:
        return '紀錄習慣者';
      case UserMode.struggler:
        return '轉型挑戰者';
      case UserMode.sleeper:
        return '潛在覺醒者';
    }
  }

  IconData get icon {
    switch (this) {
      case UserMode.controller:
        return Icons.engineering;
      case UserMode.logger:
        return Icons.auto_awesome;
      case UserMode.struggler:
        return Icons.emoji_events;
      case UserMode.sleeper:
        return Icons.eco;
    }
  }

  Color get primaryColor {
    switch (this) {
      case UserMode.controller:
        return const Color(0xFF1976D2);
      case UserMode.logger:
        return const Color(0xFF6A1B9A);
      case UserMode.struggler:
        return const Color(0xFFFF6B35);
      case UserMode.sleeper:
        return const Color(0xFF4CAF50);
    }
  }
}
```

### 2.2 認證頁面類型

```dart
/**
 * 認證頁面類型枚舉
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 定義認證流程中的頁面類型
 */
enum AuthPageType {
  welcome,        // 歡迎頁面
  login,          // 登入頁面
  register,       // 註冊頁面
  passwordReset,  // 密碼重設頁面
  logout,         // 登出確認頁面
}
```

### 2.3 註冊資料模型

```dart
/**
 * 註冊資料模型
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 包含註冊所需的完整資料
 */
class RegistrationData {
  final String email;
  final String password;
  final String? displayName;
  final UserMode userMode;
  final bool termsAccepted;
  final bool privacyAccepted;

  const RegistrationData({
    required this.email,
    required this.password,
    this.displayName,
    required this.userMode,
    required this.termsAccepted,
    required this.privacyAccepted,
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'password': password,
      'display_name': displayName,
      'user_mode': userMode.name,
      'terms_accepted': termsAccepted,
      'privacy_accepted': privacyAccepted,
    };
  }
}
```

---

## 3.0 歡迎頁面UI實作

### 3.1 歡迎頁面建構函數

```dart
/**
 * 01. 建構歡迎頁面Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構歡迎頁面的完整UI結構
 */
Widget AUTH_buildWelcomePage({
  required BuildContext context,
  UserMode? selectedMode,
  required Function(UserMode) onModeSelected,
  required VoidCallback onContinue,
  bool isLoading = false,
}) {
  return Scaffold(
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 品牌標誌
            Center(
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.account_balance_wallet,
                  size: 60,
                  color: Colors.blue.shade600,
                ),
              ),
            ),
            const SizedBox(height: 48),
            
            // 主標題
            Text(
              '歡迎使用 LCAS 2.0',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            
            // 副標題
            Text(
              '請選擇最適合您的記帳模式',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            
            // 模式選擇器
            AUTH_buildModeSelector(
              context: context,
              selectedMode: selectedMode,
              onModeSelected: onModeSelected,
            ),
            const SizedBox(height: 48),
            
            // 開始使用按鈕
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: selectedMode != null && !isLoading ? onContinue : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: selectedMode?.primaryColor ?? Colors.grey,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: isLoading
                    ? AUTH_buildLoadingIndicator()
                    : const Text(
                        '開始使用',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
```

### 3.2 模式選擇器建構函數

```dart
/**
 * 02. 建構模式選擇Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構四模式選擇網格介面
 */
Widget AUTH_buildModeSelector({
  required BuildContext context,
  UserMode? selectedMode,
  required Function(UserMode) onModeSelected,
}) {
  return GridView.count(
    shrinkWrap: true,
    crossAxisCount: 2,
    crossAxisSpacing: 16,
    mainAxisSpacing: 16,
    childAspectRatio: 1.0,
    children: UserMode.values.map((mode) {
      final isSelected = selectedMode == mode;
      
      return InkWell(
        onTap: () => onModeSelected(mode),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            color: isSelected ? mode.primaryColor.withOpacity(0.1) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isSelected ? mode.primaryColor : Colors.grey.shade300,
              width: isSelected ? 3 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: mode.primaryColor.withOpacity(0.2),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [
                    BoxShadow(
                      color: Colors.grey.withOpacity(0.1),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                mode.icon,
                size: 32,
                color: isSelected ? mode.primaryColor : Colors.grey.shade600,
              ),
              const SizedBox(height: 12),
              Text(
                mode.displayName,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? mode.primaryColor : Colors.grey.shade700,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }).toList(),
  );
}
```

---

## 4.0 登入頁面UI實作

### 4.1 登入頁面建構函數

```dart
/**
 * 03. 建構登入頁面Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構登入頁面的完整UI結構，支援四模式差異化
 */
Widget AUTH_buildLoginPage({
  required BuildContext context,
  required UserMode userMode,
  required VoidCallback onLineLogin,
  required VoidCallback onGoogleLogin,
  required VoidCallback onAppleLogin,
  required Function(String email, String password) onEmailLogin,
  required VoidCallback onForgotPassword,
  required VoidCallback onRegister,
  bool isLoading = false,
}) {
  return Scaffold(
    appBar: AppBar(
      title: Text('${userMode.displayName} - 登入'),
      backgroundColor: userMode.primaryColor,
      foregroundColor: Colors.white,
    ),
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            
            // 模式特定歡迎訊息
            Text(
              _getModeLoginMessage(userMode),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: userMode.primaryColor,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            
            // OAuth登入按鈕組
            AUTH_buildOAuthButtons(
              context: context,
              userMode: userMode,
              onLineLogin: onLineLogin,
              onGoogleLogin: onGoogleLogin,
              onAppleLogin: onAppleLogin,
              isLoading: isLoading,
            ),
            
            // 非Sleeper模式才顯示Email登入
            if (userMode != UserMode.sleeper) ...[
              const SizedBox(height: 32),
              
              // 分隔線
              Row(
                children: [
                  Expanded(child: Divider(color: Colors.grey.shade400)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      '或',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ),
                  Expanded(child: Divider(color: Colors.grey.shade400)),
                ],
              ),
              const SizedBox(height: 32),
              
              // Email登入表單
              AUTH_buildEmailLoginForm(
                context: context,
                userMode: userMode,
                onEmailLogin: onEmailLogin,
                onForgotPassword: onForgotPassword,
                isLoading: isLoading,
              ),
            ],
            
            const SizedBox(height: 32),
            
            // 註冊連結
            TextButton(
              onPressed: onRegister,
              child: Text(
                '還沒有帳號？立即註冊',
                style: TextStyle(
                  color: userMode.primaryColor,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

String _getModeLoginMessage(UserMode userMode) {
  switch (userMode) {
    case UserMode.controller:
      return '🎯 精準控制您的財務';
    case UserMode.logger:
      return '✨ 優雅記錄每一筆';
    case UserMode.struggler:
      return '💪 邁向財務自由';
    case UserMode.sleeper:
      return '🌱 輕鬆開始記帳';
  }
}
```

### 4.2 OAuth按鈕組建構函數

```dart
/**
 * 04. 建構OAuth登入按鈕組
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構OAuth登入按鈕，支援四模式樣式差異
 */
Widget AUTH_buildOAuthButtons({
  required BuildContext context,
  required UserMode userMode,
  required VoidCallback onLineLogin,
  required VoidCallback onGoogleLogin,
  required VoidCallback onAppleLogin,
  bool isLoading = false,
}) {
  final buttonHeight = userMode == UserMode.sleeper ? 72.0 : 56.0;
  final buttonSpacing = userMode == UserMode.sleeper ? 16.0 : 12.0;
  final fontSize = userMode == UserMode.sleeper ? 18.0 : 16.0;

  return Column(
    children: [
      // LINE登入按鈕（所有模式）
      SizedBox(
        width: double.infinity,
        height: buttonHeight,
        child: ElevatedButton.icon(
          onPressed: isLoading ? null : onLineLogin,
          icon: const Icon(Icons.chat, color: Colors.white),
          label: Text(
            'LINE 登入',
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF00C300),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
      
      // Google登入按鈕（非Sleeper模式）
      if (userMode != UserMode.sleeper) ...[
        SizedBox(height: buttonSpacing),
        SizedBox(
          width: double.infinity,
          height: buttonHeight,
          child: OutlinedButton.icon(
            onPressed: isLoading ? null : onGoogleLogin,
            icon: Icon(Icons.g_mobiledata, color: Colors.grey.shade700),
            label: Text(
              'Google 登入',
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: Colors.grey.shade400),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ],
      
      // Apple登入按鈕（僅Controller模式）
      if (userMode == UserMode.controller) ...[
        SizedBox(height: buttonSpacing),
        SizedBox(
          width: double.infinity,
          height: buttonHeight,
          child: OutlinedButton.icon(
            onPressed: isLoading ? null : onAppleLogin,
            icon: const Icon(Icons.apple, color: Colors.white),
            label: Text(
              'Apple 登入',
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            style: OutlinedButton.styleFrom(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.black),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ],
    ],
  );
}
```

### 4.3 Email登入表單建構函數

```dart
/**
 * 05. 建構Email登入表單
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構Email登入表單，僅非Sleeper模式顯示
 */
Widget AUTH_buildEmailLoginForm({
  required BuildContext context,
  required UserMode userMode,
  required Function(String email, String password) onEmailLogin,
  required VoidCallback onForgotPassword,
  bool isLoading = false,
}) {
  final formKey = GlobalKey<FormState>();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  return Form(
    key: formKey,
    child: Column(
      children: [
        // Email輸入框
        TextFormField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: 'Email *',
            prefixIcon: const Icon(Icons.email),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請輸入Email';
            }
            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
              return 'Email格式不正確';
            }
            return null;
          },
        ),
        const SizedBox(height: 16),
        
        // 密碼輸入框
        TextFormField(
          controller: passwordController,
          obscureText: true,
          decoration: InputDecoration(
            labelText: '密碼 *',
            prefixIcon: const Icon(Icons.lock),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請輸入密碼';
            }
            return null;
          },
        ),
        const SizedBox(height: 12),
        
        // 忘記密碼連結
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: onForgotPassword,
            child: Text(
              '忘記密碼？',
              style: TextStyle(color: userMode.primaryColor),
            ),
          ),
        ),
        const SizedBox(height: 24),
        
        // 登入按鈕
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: isLoading
                ? null
                : () {
                    if (formKey.currentState?.validate() ?? false) {
                      onEmailLogin(emailController.text, passwordController.text);
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: userMode.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: isLoading
                ? AUTH_buildLoadingIndicator()
                : const Text(
                    '登入',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
          ),
        ),
      ],
    ),
  );
}
```

---

## 5.0 註冊頁面UI實作

### 5.1 註冊頁面建構函數

```dart
/**
 * 06. 建構註冊頁面Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構註冊頁面的完整UI結構
 */
Widget AUTH_buildRegisterPage({
  required BuildContext context,
  required UserMode userMode,
  required Function(RegistrationData) onRegister,
  required VoidCallback onLogin,
  bool isLoading = false,
}) {
  return Scaffold(
    appBar: AppBar(
      title: Text('${userMode.displayName} - 註冊'),
      backgroundColor: userMode.primaryColor,
      foregroundColor: Colors.white,
    ),
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            
            // 模式特定歡迎訊息
            Text(
              _getModeRegistrationMessage(userMode),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: userMode.primaryColor,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            
            // 註冊表單
            AUTH_buildRegistrationForm(
              context: context,
              userMode: userMode,
              onRegister: onRegister,
              isLoading: isLoading,
            ),
            
            const SizedBox(height: 32),
            
            // 登入連結
            TextButton(
              onPressed: onLogin,
              child: Text(
                '已有帳號？立即登入',
                style: TextStyle(
                  color: userMode.primaryColor,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

String _getModeRegistrationMessage(UserMode userMode) {
  switch (userMode) {
    case UserMode.controller:
      return '🎯 開始精準掌控財務';
    case UserMode.logger:
      return '✨ 開啟優雅記帳之旅';
    case UserMode.struggler:
      return '💪 踏出轉型第一步';
    case UserMode.sleeper:
      return '🌱 簡單開始記帳生活';
  }
}
```

### 5.2 註冊表單建構函數

```dart
/**
 * 07. 建構註冊表單Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構註冊表單，支援四模式欄位差異
 */
Widget AUTH_buildRegistrationForm({
  required BuildContext context,
  required UserMode userMode,
  required Function(RegistrationData) onRegister,
  bool isLoading = false,
}) {
  return StatefulBuilder(
    builder: (context, setState) {
      final formKey = GlobalKey<FormState>();
      final emailController = TextEditingController();
      final passwordController = TextEditingController();
      final confirmPasswordController = TextEditingController();
      final displayNameController = TextEditingController();
      bool termsAccepted = false;
      bool privacyAccepted = false;

      return Form(
        key: formKey,
        child: Column(
          children: [
            // Email輸入框（所有模式）
            TextFormField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Email *',
                prefixIcon: const Icon(Icons.email),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return '請輸入Email';
                }
                if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                  return 'Email格式不正確';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            
            // 密碼輸入框（所有模式）
            TextFormField(
              controller: passwordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: '密碼 *',
                prefixIcon: const Icon(Icons.lock),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return '請輸入密碼';
                }
                if (value.length < 8) {
                  return '密碼至少需要8個字元';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            
            // 確認密碼輸入框（非Sleeper模式）
            if (userMode != UserMode.sleeper) ...[
              TextFormField(
                controller: confirmPasswordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: '確認密碼 *',
                  prefixIcon: const Icon(Icons.lock_outline),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '請再次輸入密碼';
                  }
                  if (value != passwordController.text) {
                    return '密碼不一致';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ],
            
            // 顯示名稱輸入框（非Sleeper模式）
            if (userMode != UserMode.sleeper) ...[
              TextFormField(
                controller: displayNameController,
                decoration: InputDecoration(
                  labelText: '顯示名稱 *',
                  prefixIcon: const Icon(Icons.person),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return '請輸入顯示名稱';
                  }
                  if (value.length < 2) {
                    return '顯示名稱至少需要2個字元';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
            ],
            
            // 服務條款同意
            CheckboxListTile(
              value: termsAccepted,
              onChanged: (value) => setState(() => termsAccepted = value ?? false),
              title: const Text('我同意服務條款'),
              activeColor: userMode.primaryColor,
              controlAffinity: ListTileControlAffinity.leading,
            ),
            
            // 隱私政策同意
            CheckboxListTile(
              value: privacyAccepted,
              onChanged: (value) => setState(() => privacyAccepted = value ?? false),
              title: const Text('我同意隱私政策'),
              activeColor: userMode.primaryColor,
              controlAffinity: ListTileControlAffinity.leading,
            ),
            
            const SizedBox(height: 32),
            
            // 註冊按鈕
            SizedBox(
              width: double.infinity,
              height: userMode == UserMode.sleeper ? 72 : 56,
              child: ElevatedButton(
                onPressed: !isLoading && termsAccepted && privacyAccepted
                    ? () {
                        if (formKey.currentState?.validate() ?? false) {
                          final registrationData = RegistrationData(
                            email: emailController.text,
                            password: passwordController.text,
                            displayName: userMode != UserMode.sleeper 
                                ? displayNameController.text 
                                : null,
                            userMode: userMode,
                            termsAccepted: termsAccepted,
                            privacyAccepted: privacyAccepted,
                          );
                          onRegister(registrationData);
                        }
                      }
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: userMode.primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: isLoading
                    ? AUTH_buildLoadingIndicator()
                    : Text(
                        '完成註冊',
                        style: TextStyle(
                          fontSize: userMode == UserMode.sleeper ? 20 : 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
          ],
        ),
      );
    },
  );
}
```

---

## 6.0 密碼重設UI實作

### 6.1 密碼重設頁面建構函數

```dart
/**
 * 08. 建構密碼重設頁面Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構密碼重設頁面的完整UI結構
 */
Widget AUTH_buildPasswordResetPage({
  required BuildContext context,
  required UserMode userMode,
  required int currentStep,
  required Function(String email) onSendCode,
  required Function(String code) onVerifyCode,
  required Function(String password) onResetPassword,
  bool isLoading = false,
}) {
  return Scaffold(
    appBar: AppBar(
      title: const Text('重設密碼'),
      backgroundColor: userMode.primaryColor,
      foregroundColor: Colors.white,
    ),
    body: Column(
      children: [
        // 進度指示器（非Sleeper模式）
        if (userMode != UserMode.sleeper) ...[
          LinearProgressIndicator(
            value: (currentStep + 1) / 3,
            valueColor: AlwaysStoppedAnimation<Color>(userMode.primaryColor),
            backgroundColor: Colors.grey.shade300,
          ),
          const SizedBox(height: 32),
        ],
        
        // 步驟內容
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: AUTH_buildResetSteps(
              context: context,
              userMode: userMode,
              currentStep: currentStep,
              onSendCode: onSendCode,
              onVerifyCode: onVerifyCode,
              onResetPassword: onResetPassword,
              isLoading: isLoading,
            ),
          ),
        ),
      ],
    ),
  );
}
```

### 6.2 重設步驟建構函數

```dart
/**
 * 09. 建構重設步驟Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構密碼重設的三步驟介面
 */
Widget AUTH_buildResetSteps({
  required BuildContext context,
  required UserMode userMode,
  required int currentStep,
  required Function(String email) onSendCode,
  required Function(String code) onVerifyCode,
  required Function(String password) onResetPassword,
  bool isLoading = false,
}) {
  switch (currentStep) {
    case 0:
      return _buildEmailStep(context, userMode, onSendCode, isLoading);
    case 1:
      return _buildVerificationStep(context, userMode, onVerifyCode, isLoading);
    case 2:
      return _buildPasswordStep(context, userMode, onResetPassword, isLoading);
    default:
      return Container();
  }
}

Widget _buildEmailStep(
  BuildContext context,
  UserMode userMode,
  Function(String email) onSendCode,
  bool isLoading,
) {
  final emailController = TextEditingController();
  
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(
        Icons.email_outlined,
        size: 64,
        color: userMode.primaryColor,
      ),
      const SizedBox(height: 32),
      
      Text(
        '輸入您的Email地址',
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w600,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 16),
      
      Text(
        '我們將發送驗證碼到您的信箱',
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
          color: Colors.grey.shade600,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 48),
      
      TextFormField(
        controller: emailController,
        keyboardType: TextInputType.emailAddress,
        decoration: InputDecoration(
          labelText: 'Email',
          prefixIcon: const Icon(Icons.email),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      const SizedBox(height: 32),
      
      SizedBox(
        width: double.infinity,
        height: userMode == UserMode.sleeper ? 72 : 56,
        child: ElevatedButton(
          onPressed: isLoading
              ? null
              : () => onSendCode(emailController.text),
          style: ElevatedButton.styleFrom(
            backgroundColor: userMode.primaryColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: isLoading
              ? AUTH_buildLoadingIndicator()
              : const Text(
                  '發送驗證碼',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
        ),
      ),
    ],
  );
}

Widget _buildVerificationStep(
  BuildContext context,
  UserMode userMode,
  Function(String code) onVerifyCode,
  bool isLoading,
) {
  final codeController = TextEditingController();
  
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(
        Icons.security,
        size: 64,
        color: userMode.primaryColor,
      ),
      const SizedBox(height: 32),
      
      Text(
        '請輸入驗證碼',
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w600,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 16),
      
      Text(
        '請檢查您的信箱並輸入收到的驗證碼',
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
          color: Colors.grey.shade600,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 48),
      
      TextFormField(
        controller: codeController,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(
          labelText: '驗證碼',
          prefixIcon: const Icon(Icons.pin),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      const SizedBox(height: 32),
      
      SizedBox(
        width: double.infinity,
        height: userMode == UserMode.sleeper ? 72 : 56,
        child: ElevatedButton(
          onPressed: isLoading
              ? null
              : () => onVerifyCode(codeController.text),
          style: ElevatedButton.styleFrom(
            backgroundColor: userMode.primaryColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: isLoading
              ? AUTH_buildLoadingIndicator()
              : const Text(
                  '驗證',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
        ),
      ),
    ],
  );
}

Widget _buildPasswordStep(
  BuildContext context,
  UserMode userMode,
  Function(String password) onResetPassword,
  bool isLoading,
) {
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final formKey = GlobalKey<FormState>();
  
  return Form(
    key: formKey,
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          Icons.lock_reset,
          size: 64,
          color: userMode.primaryColor,
        ),
        const SizedBox(height: 32),
        
        Text(
          '設定新密碼',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        
        Text(
          '請輸入您的新密碼',
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: Colors.grey.shade600,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 48),
        
        TextFormField(
          controller: passwordController,
          obscureText: true,
          decoration: InputDecoration(
            labelText: '新密碼',
            prefixIcon: const Icon(Icons.lock),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請輸入新密碼';
            }
            if (value.length < 8) {
              return '密碼至少需要8個字元';
            }
            return null;
          },
        ),
        const SizedBox(height: 16),
        
        TextFormField(
          controller: confirmPasswordController,
          obscureText: true,
          decoration: InputDecoration(
            labelText: '確認新密碼',
            prefixIcon: const Icon(Icons.lock_outline),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請再次輸入新密碼';
            }
            if (value != passwordController.text) {
              return '密碼不一致';
            }
            return null;
          },
        ),
        const SizedBox(height: 32),
        
        SizedBox(
          width: double.infinity,
          height: userMode == UserMode.sleeper ? 72 : 56,
          child: ElevatedButton(
            onPressed: isLoading
                ? null
                : () {
                    if (formKey.currentState?.validate() ?? false) {
                      onResetPassword(passwordController.text);
                    }
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: userMode.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: isLoading
                ? AUTH_buildLoadingIndicator()
                : const Text(
                    '完成重設',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
          ),
        ),
      ],
    ),
  );
}
```

---

## 7.0 登出確認UI實作

### 7.1 登出確認頁面建構函數

```dart
/**
 * 10. 建構登出確認頁面Widget
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構登出確認頁面，支援四模式差異化選項
 */
Widget AUTH_buildLogoutPage({
  required BuildContext context,
  required UserMode userMode,
  required Function(String logoutType) onLogout,
  required VoidCallback onCancel,
  bool isLoading = false,
}) {
  return Scaffold(
    appBar: AppBar(
      title: const Text('登出'),
      backgroundColor: userMode.primaryColor,
      foregroundColor: Colors.white,
    ),
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.logout,
              size: 64,
              color: userMode.primaryColor,
            ),
            const SizedBox(height: 32),
            
            Text(
              '確定要登出嗎？',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            
            Text(
              _getModeLogoutMessage(userMode),
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.grey.shade600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            
            // 模式差異化登出選項
            if (userMode == UserMode.controller) ...[
              // 精準控制者：兩個選項
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : () => onLogout('quick'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: isLoading
                      ? AUTH_buildLoadingIndicator()
                      : const Text(
                          '快速登出（保留設定）',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 16),
              
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : () => onLogout('complete'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: isLoading
                      ? AUTH_buildLoadingIndicator()
                      : const Text(
                          '完全登出（清除資料）',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ] else ...[
              // 其他模式：單一選項
              SizedBox(
                width: double.infinity,
                height: userMode == UserMode.sleeper ? 72 : 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : () => onLogout('normal'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: userMode.primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: isLoading
                      ? AUTH_buildLoadingIndicator()
                      : Text(
                          '確定登出',
                          style: TextStyle(
                            fontSize: userMode == UserMode.sleeper ? 20 : 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ],
            
            const SizedBox(height: 16),
            
            // 取消按鈕
            SizedBox(
              width: double.infinity,
              height: userMode == UserMode.sleeper ? 72 : 56,
              child: OutlinedButton(
                onPressed: onCancel,
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: userMode.primaryColor),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  '取消',
                  style: TextStyle(
                    fontSize: userMode == UserMode.sleeper ? 20 : 18,
                    fontWeight: FontWeight.w600,
                    color: userMode.primaryColor,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

String _getModeLogoutMessage(UserMode userMode) {
  switch (userMode) {
    case UserMode.controller:
      return '您可以選擇保留設定或完全清除資料';
    case UserMode.logger:
      return '您的優雅記帳歷程將暫時停止';
    case UserMode.struggler:
      return '暫停挑戰，隨時可以重新開始！';
    case UserMode.sleeper:
      return '記帳資料將安全保存';
  }
}
```

---

## 8.0 四模式UI實作

### 8.1 精準控制者模式UI

```dart
/**
 * 11. 建構精準控制者模式UI
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構專業完整的認證介面
 */
Widget AUTH_buildControllerModeUI({
  required BuildContext context,
  required AuthPageType pageType,
  required Map<String, dynamic> pageProps,
}) {
  return Theme(
    data: Theme.of(context).copyWith(
      primaryColor: const Color(0xFF1976D2),
      colorScheme: Theme.of(context).colorScheme.copyWith(
        primary: const Color(0xFF1976D2),
        secondary: const Color(0xFF37474F),
      ),
    ),
    child: Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFAFAFA),
        border: Border(
          left: BorderSide(
            color: Color(0xFF1976D2),
            width: 4,
          ),
        ),
      ),
      child: Column(
        children: [
          // 專業標題列
          Container(
            color: const Color(0xFF1976D2),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(
                  Icons.engineering,
                  color: Colors.white,
                  size: 24,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    '🎯 精準控制者模式',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () {},
                  icon: const Icon(
                    Icons.settings,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          
          // 主要內容區域
          Expanded(
            child: _buildPageContent(pageType, pageProps),
          ),
          
          // 底部狀態列
          Container(
            color: const Color(0xFFE3F2FD),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: const Row(
              children: [
                Icon(
                  Icons.security,
                  size: 16,
                  color: Color(0xFF1976D2),
                ),
                SizedBox(width: 8),
                Text(
                  '高安全性模式已啟用',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF1976D2),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
```

### 8.2 紀錄習慣者模式UI

```dart
/**
 * 12. 建構紀錄習慣者模式UI
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構優雅美觀的認證介面
 */
Widget AUTH_buildLoggerModeUI({
  required BuildContext context,
  required AuthPageType pageType,
  required Map<String, dynamic> pageProps,
}) {
  return Theme(
    data: Theme.of(context).copyWith(
      primaryColor: const Color(0xFF6A1B9A),
      colorScheme: Theme.of(context).colorScheme.copyWith(
        primary: const Color(0xFF6A1B9A),
        secondary: const Color(0xFFE1BEE7),
      ),
    ),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 800),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF3E5F5),
            Colors.white,
          ],
        ),
      ),
      child: Column(
        children: [
          // 優雅標題區域
          Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.auto_awesome,
                  color: Color(0xFF6A1B9A),
                  size: 24,
                ),
                const SizedBox(width: 12),
                Text(
                  '✨ 優雅記帳體驗',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade800,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          
          // 內容區域動畫
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 600),
              transitionBuilder: (child, animation) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.0, 0.1),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: Container(
                key: ValueKey(pageType),
                margin: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF6A1B9A).withOpacity(0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: _buildPageContent(pageType, pageProps),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
```

### 8.3 轉型挑戰者模式UI

```dart
/**
 * 13. 建構轉型挑戰者模式UI
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構激勵導向的認證介面
 */
Widget AUTH_buildStruggleModeUI({
  required BuildContext context,
  required AuthPageType pageType,
  required Map<String, dynamic> pageProps,
}) {
  return Theme(
    data: Theme.of(context).copyWith(
      primaryColor: const Color(0xFFFF6B35),
      colorScheme: Theme.of(context).colorScheme.copyWith(
        primary: const Color(0xFFFF6B35),
        secondary: const Color(0xFFFFE0B2),
      ),
    ),
    child: Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFFF3E0),
      ),
      child: Column(
        children: [
          // 激勵標題區域
          Container(
            decoration: const BoxDecoration(
              color: Color(0xFFFF6B35),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(20),
                bottomRight: Radius.circular(20),
              ),
            ),
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.emoji_events,
                      color: Colors.white,
                      size: 28,
                    ),
                    SizedBox(width: 12),
                    Text(
                      '💪 轉型挑戰者',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '每一步都是朝著目標前進！',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.orange.shade50,
                  ),
                ),
              ],
            ),
          ),
          
          // 激勵訊息卡片
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFFFF6B35),
                width: 2,
              ),
            ),
            child: const Row(
              children: [
                Icon(
                  Icons.trending_up,
                  color: Color(0xFFFF6B35),
                  size: 24,
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '堅持記帳，實現財務自由夢想！',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFFFF6B35),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // 主要內容區域
          Expanded(
            child: _buildPageContent(pageType, pageProps),
          ),
          
          // 底部激勵列
          Container(
            color: const Color(0xFFFFE0B2),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.star,
                  color: Color(0xFFFF6B35),
                  size: 16,
                ),
                const SizedBox(width: 8),
                Text(
                  '已堅持 ${_getDaysCount()} 天',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFFF6B35),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

int _getDaysCount() {
  // 模擬堅持天數計算
  return 15;
}
```

### 8.4 潛在覺醒者模式UI

```dart
/**
 * 14. 建構潛在覺醒者模式UI
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構極簡易用的認證介面
 */
Widget AUTH_buildSleeperModeUI({
  required BuildContext context,
  required AuthPageType pageType,
  required Map<String, dynamic> pageProps,
}) {
  return Theme(
    data: Theme.of(context).copyWith(
      primaryColor: const Color(0xFF4CAF50),
      colorScheme: Theme.of(context).colorScheme.copyWith(
        primary: const Color(0xFF4CAF50),
        secondary: const Color(0xFFC8E6C9),
      ),
    ),
    child: Container(
      decoration: const BoxDecoration(
        color: Color(0xFFE8F5E8),
      ),
      child: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 溫和視覺元素
            const Icon(
              Icons.eco,
              size: 64,
              color: Color(0xFF4CAF50),
            ),
            const SizedBox(height: 24),
            
            const Text(
              '🌱 輕鬆記帳',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2E7D32),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            
            Text(
              '簡單開始，輕鬆管理',
              style: TextStyle(
                fontSize: 18,
                color: Colors.green.shade700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            
            // 極簡內容容器
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 32),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF4CAF50).withOpacity(0.1),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: _buildPageContent(pageType, pageProps),
            ),
            
            const SizedBox(height: 48),
            
            // 友善提示文字
            Text(
              '💡 需要幫助嗎？點擊右上角問號',
              style: TextStyle(
                fontSize: 14,
                color: Colors.green.shade600,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );
}
```

---

## 9.0 共用元件實作

### 9.1 載入指示器

```dart
/**
 * 15. 建構載入指示器
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 建構通用載入指示器
 */
Widget AUTH_buildLoadingIndicator({
  Color color = Colors.white,
  double size = 20.0,
}) {
  return SizedBox(
    width: size,
    height: size,
    child: CircularProgressIndicator(
      strokeWidth: 2.0,
      valueColor: AlwaysStoppedAnimation<Color>(color),
    ),
  );
}
```

### 9.2 主題配置

```dart
/**
 * 主題配置類別
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 四模式主題配置
 */
class AuthThemeConfig {
  static ThemeData getThemeForMode(UserMode mode) {
    final baseTheme = ThemeData(
      fontFamily: 'Roboto',
      useMaterial3: true,
    );

    switch (mode) {
      case UserMode.controller:
        return baseTheme.copyWith(
          primaryColor: const Color(0xFF1976D2),
          colorScheme: baseTheme.colorScheme.copyWith(
            primary: const Color(0xFF1976D2),
            secondary: const Color(0xFF37474F),
            surface: const Color(0xFFFAFAFA),
          ),
        );

      case UserMode.logger:
        return baseTheme.copyWith(
          primaryColor: const Color(0xFF6A1B9A),
          colorScheme: baseTheme.colorScheme.copyWith(
            primary: const Color(0xFF6A1B9A),
            secondary: const Color(0xFFE1BEE7),
            surface: Colors.white,
          ),
        );

      case UserMode.struggler:
        return baseTheme.copyWith(
          primaryColor: const Color(0xFFFF6B35),
          colorScheme: baseTheme.colorScheme.copyWith(
            primary: const Color(0xFFFF6B35),
            secondary: const Color(0xFFFFE0B2),
            surface: const Color(0xFFFFF3E0),
          ),
        );

      case UserMode.sleeper:
        return baseTheme.copyWith(
          primaryColor: const Color(0xFF4CAF50),
          colorScheme: baseTheme.colorScheme.copyWith(
            primary: const Color(0xFF4CAF50),
            secondary: const Color(0xFFC8E6C9),
            surface: const Color(0xFFE8F5E8),
          ),
        );
    }
  }
}
```

### 9.3 輔助函數

```dart
/**
 * 輔助函數集合
 * @version 2025-01-21-V2.6.0
 * @date 2025-01-21 10:00:00
 * @description 認證UI相關輔助函數
 */
class AuthUIHelper {
  static Widget _buildPageContent(AuthPageType pageType, Map<String, dynamic> props) {
    switch (pageType) {
      case AuthPageType.welcome:
        return props['child'] ?? Container();
      case AuthPageType.login:
        return props['child'] ?? Container();
      case AuthPageType.register:
        return props['child'] ?? Container();
      case AuthPageType.passwordReset:
        return props['child'] ?? Container();
      case AuthPageType.logout:
        return props['child'] ?? Container();
    }
  }

  static String formatErrorMessage(String error, UserMode userMode) {
    switch (userMode) {
      case UserMode.controller:
        return '錯誤：$error';
      case UserMode.logger:
        return '✨ 操作遇到問題，請稍後再試';
      case UserMode.struggler:
        return '💪 遇到小挫折！讓我們再試一次！';
      case UserMode.sleeper:
        return '🌱 操作失敗，請重新嘗試';
    }
  }

  static Widget buildErrorContainer(String message, UserMode userMode) {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        border: Border.all(color: Colors.red.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red.shade600),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              formatErrorMessage(message, userMode),
              style: TextStyle(color: Colors.red.shade800),
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## 10.0 版本記錄

| 版本 | 日期 | 修改者 | 修改內容 |
|------|------|--------|----------|
| **v2.6.0** | **2025-01-21 10:00:00 +08:00** | **LCAS PG Team** | **🚀 第一版實作建立** |
|  |  |  | **• 完整實作15個核心認證UI函數** |
|  |  |  | **• 四模式UI差異化實現** |
|  |  |  | **• 資料模型與主題配置建立** |
|  |  |  | **• 純Presentation Layer實作** |
|  |  |  | **• 遵循8801設計規範v2.5.0** |
|  |  |  | **• 所有函數版本為V2.6.0** |

---

## 總結

### 🎯 實作成果
- ✅ **15個核心函數**：完整實作所有認證UI函數
- ✅ **四模式差異化**：精準控制者、紀錄習慣者、轉型挑戰者、潛在覺醒者
- ✅ **資料模型完整**：UserMode、AuthPageType、RegistrationData
- ✅ **主題配置系統**：支援動態主題切換
- ✅ **輔助函數齊全**：載入指示器、錯誤處理、格式化工具

### 📝 設計特點
- **職責單一**：純Presentation Layer實作，不涉及業務邏輸
- **模式導向**：每個函數都考慮四種模式的UI差異
- **使用者友善**：直觀的操作介面和視覺回饋
- **可維護性**：清晰的函數結構和文件化

### 🔄 與8801文件對應
本實作完全遵循8801 TDD設計文件v2.5.0的規範，實現了所有15個核心函數的設計意圖，提供四模式差異化的使用者體驗。

---

**🎉 認證功能群組 Flutter實作 v2.6.0 - 純Presentation Layer，四模式差異化UI完整實現！**
