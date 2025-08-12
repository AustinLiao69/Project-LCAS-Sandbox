
/**
 * AUTH_認證功能群組_2.5.1
 * @module 認證功能群組
 * @description Flutter認證介面群組 - 純Presentation Layer實作
 * @update 2025-08-11: Phase 3優化 - StatefulBuilder優化、輔助函數註解完善、版本升級
 */

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// 使用者模式枚舉
enum UserMode {
  controller, // 精準控制者
  logger,     // 紀錄習慣者
  struggler,  // 轉型挑戰者
  sleeper,    // 潛在覺醒者
}

// 認證頁面類型
enum AuthPageType {
  welcome,
  login,
  register,
  passwordReset,
  logout,
}

// 登出類型
enum LogoutType {
  quick,    // 快速登出
  complete, // 完全登出
}

// 註冊資料類別
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
}

/**
 * 01. 建構歡迎頁面Widget
 * @version 2025-01-21-V2.5.0
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
                  color: Colors.blue.shade100,
                  borderRadius: BorderRadius.circular(60),
                ),
                child: const Icon(
                  Icons.account_balance_wallet,
                  size: 60,
                  color: Colors.blue,
                ),
              ),
            ),
            const SizedBox(height: 32),
            
            // 主標題
            Text(
              '歡迎使用 LCAS 2.0',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            
            // 副標題
            Text(
              '請選擇您的使用者模式',
              style: Theme.of(context).textTheme.bodyLarge,
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
                onPressed: (selectedMode != null && !isLoading) ? onContinue : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: selectedMode != null 
                    ? _getModeColor(selectedMode) 
                    : Colors.grey,
                ),
                child: isLoading
                  ? AUTH_buildLoadingIndicator()
                  : const Text(
                      '開始使用',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
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

/**
 * 02. 建構模式選擇Widget
 * @version 2025-01-21-V2.5.0
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
      final modeColor = _getModeColor(mode);
      
      return InkWell(
        onTap: () => onModeSelected(mode),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            color: isSelected ? modeColor.withOpacity(0.1) : Colors.white,
            border: Border.all(
              color: isSelected ? modeColor : Colors.grey.shade300,
              width: isSelected ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(12),
            boxShadow: isSelected ? [
              BoxShadow(
                color: modeColor.withOpacity(0.2),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ] : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                _getModeIcon(mode),
                size: 32,
                color: modeColor,
              ),
              const SizedBox(height: 8),
              Text(
                _getModeName(mode),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? modeColor : Colors.grey.shade700,
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

/**
 * 03. 建構登入頁面Widget
 * @version 2025-01-21-V2.5.0
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
      title: Text(_getModeLoginTitle(userMode)),
      backgroundColor: _getModeColor(userMode),
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
                color: _getModeColor(userMode),
                fontWeight: FontWeight.bold,
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
                  Expanded(child: Divider(color: Colors.grey.shade300)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      '或',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ),
                  Expanded(child: Divider(color: Colors.grey.shade300)),
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
                  color: _getModeColor(userMode),
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

/**
 * 04. 建構OAuth登入按鈕組
 * @version 2025-01-21-V2.5.0
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
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF00C300),
            foregroundColor: Colors.white,
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
            icon: const Icon(Icons.g_mobiledata),
            label: Text(
              'Google 登入',
              style: TextStyle(fontSize: fontSize),
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
                color: Colors.white,
              ),
            ),
            style: OutlinedButton.styleFrom(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
            ),
          ),
        ),
      ],
    ],
  );
}

/**
 * 05. 建構Email登入表單
 * @version 2025-01-21-V2.5.0
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
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final formKey = GlobalKey<FormState>();
  
  return Form(
    key: formKey,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Email輸入框
        TextFormField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'Email',
            prefixIcon: Icon(Icons.email),
            border: OutlineInputBorder(),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Email不能為空';
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
          decoration: const InputDecoration(
            labelText: '密碼',
            prefixIcon: Icon(Icons.lock),
            border: OutlineInputBorder(),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '密碼不能為空';
            }
            return null;
          },
        ),
        const SizedBox(height: 16),
        
        // 忘記密碼連結
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: onForgotPassword,
            child: Text(
              '忘記密碼？',
              style: TextStyle(color: _getModeColor(userMode)),
            ),
          ),
        ),
        const SizedBox(height: 24),
        
        // 登入按鈕
        SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: (isLoading || !_isFormValid(emailController, passwordController)) 
              ? null 
              : () {
                  if (formKey.currentState?.validate() ?? false) {
                    onEmailLogin(emailController.text, passwordController.text);
                  }
                },
            style: ElevatedButton.styleFrom(
              backgroundColor: _getModeColor(userMode),
            ),
            child: isLoading
              ? AUTH_buildLoadingIndicator()
              : const Text(
                  '登入',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
          ),
        ),
      ],
    ),
  );
}

/**
 * 06. 建構註冊頁面Widget
 * @version 2025-01-21-V2.5.0
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
      title: Text(_getModeRegisterTitle(userMode)),
      backgroundColor: _getModeColor(userMode),
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
                color: _getModeColor(userMode),
                fontWeight: FontWeight.bold,
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
                  color: _getModeColor(userMode),
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

/**
 * 07. 建構註冊表單Widget - 優化StatefulBuilder使用方式
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 建構註冊表單，支援四模式欄位差異，優化狀態管理
 */
Widget AUTH_buildRegistrationForm({
  required BuildContext context,
  required UserMode userMode,
  required Function(RegistrationData) onRegister,
  bool isLoading = false,
}) {
  return _RegistrationFormWidget(
    userMode: userMode,
    onRegister: onRegister,
    isLoading: isLoading,
  );
}

// 優化的註冊表單Widget類別
class _RegistrationFormWidget extends StatefulWidget {
  final UserMode userMode;
  final Function(RegistrationData) onRegister;
  final bool isLoading;

  const _RegistrationFormWidget({
    required this.userMode,
    required this.onRegister,
    required this.isLoading,
  });

  @override
  State<_RegistrationFormWidget> createState() => _RegistrationFormWidgetState();
}

class _RegistrationFormWidgetState extends State<_RegistrationFormWidget> {
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController confirmPasswordController = TextEditingController();
  final TextEditingController displayNameController = TextEditingController();
  final GlobalKey<FormState> formKey = GlobalKey<FormState>();
  
  bool termsAccepted = false;
  bool privacyAccepted = false;

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    confirmPasswordController.dispose();
    displayNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Email輸入框（所有模式）
          TextFormField(
            controller: emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email *',
              prefixIcon: Icon(Icons.email),
              border: OutlineInputBorder(),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Email不能為空';
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
            decoration: const InputDecoration(
              labelText: '密碼 *',
              prefixIcon: Icon(Icons.lock),
              border: OutlineInputBorder(),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return '密碼不能為空';
              }
              if (value.length < 8) {
                return '密碼至少需要8個字元';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          
          // 確認密碼輸入框（非Sleeper模式）
          if (widget.userMode != UserMode.sleeper) ...[
            TextFormField(
              controller: confirmPasswordController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: '確認密碼 *',
                prefixIcon: Icon(Icons.lock_outline),
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value != passwordController.text) {
                  return '密碼不一致';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
          ],
          
          // 顯示名稱輸入框（非Sleeper模式）
          if (widget.userMode != UserMode.sleeper) ...[
            TextFormField(
              controller: displayNameController,
              decoration: const InputDecoration(
                labelText: '顯示名稱 *',
                prefixIcon: Icon(Icons.person),
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return '顯示名稱不能為空';
                }
                if (value.length < 2) {
                  return '顯示名稱至少需要2個字元';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),
          ],
          
          // 條款同意區域
          CheckboxListTile(
            value: termsAccepted,
            onChanged: (value) => setState(() => termsAccepted = value ?? false),
            title: const Text('我同意服務條款'),
            activeColor: _getModeColor(widget.userMode),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          CheckboxListTile(
            value: privacyAccepted,
            onChanged: (value) => setState(() => privacyAccepted = value ?? false),
            title: const Text('我同意隱私政策'),
            activeColor: _getModeColor(widget.userMode),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          const SizedBox(height: 32),
          
          // 註冊按鈕
          SizedBox(
            height: widget.userMode == UserMode.sleeper ? 72 : 56,
            child: ElevatedButton(
              onPressed: _canSubmit() 
                ? () => _handleSubmit()
                : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _getModeColor(widget.userMode),
              ),
              child: widget.isLoading
                ? AUTH_buildLoadingIndicator()
                : Text(
                    '註冊',
                    style: TextStyle(
                      fontSize: widget.userMode == UserMode.sleeper ? 20 : 18,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
            ),
          ),
        ],
      ),
    );
  }

  bool _canSubmit() {
    return !widget.isLoading && termsAccepted && privacyAccepted;
  }

  void _handleSubmit() {
    if (formKey.currentState?.validate() ?? false) {
      final registrationData = RegistrationData(
        email: emailController.text,
        password: passwordController.text,
        displayName: widget.userMode != UserMode.sleeper 
          ? displayNameController.text 
          : null,
        userMode: widget.userMode,
        termsAccepted: termsAccepted,
        privacyAccepted: privacyAccepted,
      );
      widget.onRegister(registrationData);
    }
  }
}

/**
 * 08. 建構密碼重設頁面Widget
 * @version 2025-01-21-V2.5.0
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
      backgroundColor: _getModeColor(userMode),
      foregroundColor: Colors.white,
    ),
    body: SafeArea(
      child: Column(
        children: [
          // 進度指示器（非Sleeper模式）
          if (userMode != UserMode.sleeper) ...[
            Container(
              padding: const EdgeInsets.all(16),
              child: LinearProgressIndicator(
                value: (currentStep + 1) / 3,
                valueColor: AlwaysStoppedAnimation<Color>(_getModeColor(userMode)),
                backgroundColor: Colors.grey.shade300,
              ),
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
    ),
  );
}

/**
 * 09. 建構重設步驟Widget
 * @version 2025-01-21-V2.5.0
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

/**
 * 10. 建構登出確認頁面Widget
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 建構登出確認頁面，支援四模式差異化選項
 */
Widget AUTH_buildLogoutPage({
  required BuildContext context,
  required UserMode userMode,
  required Function(LogoutType) onLogout,
  required VoidCallback onCancel,
  bool isLoading = false,
}) {
  return Scaffold(
    appBar: AppBar(
      title: const Text('登出'),
      backgroundColor: _getModeColor(userMode),
      foregroundColor: Colors.white,
    ),
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 登出圖標
            Icon(
              Icons.logout,
              size: 64,
              color: _getModeColor(userMode),
            ),
            const SizedBox(height: 32),
            
            // 主標題
            Text(
              '確定要登出嗎？',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            
            // 模式特定訊息
            Text(
              _getModeLogoutMessage(userMode),
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            
            // 登出選項（根據模式差異化）
            if (userMode == UserMode.controller) ...[
              // 精準控制者：兩個選項
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : () => onLogout(LogoutType.quick),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange,
                  ),
                  child: isLoading
                    ? AUTH_buildLoadingIndicator()
                    : const Text(
                        '快速登出（保留本地設定）',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : () => onLogout(LogoutType.complete),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                  ),
                  child: const Text(
                    '完全登出（清除所有資料）',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ] else ...[
              // 其他模式：單一選項
              SizedBox(
                height: userMode == UserMode.sleeper ? 72 : 56,
                child: ElevatedButton(
                  onPressed: isLoading ? null : () => onLogout(LogoutType.complete),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _getModeColor(userMode),
                  ),
                  child: isLoading
                    ? AUTH_buildLoadingIndicator()
                    : Text(
                        '確定登出',
                        style: TextStyle(
                          fontSize: userMode == UserMode.sleeper ? 20 : 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            
            // 取消按鈕
            SizedBox(
              height: userMode == UserMode.sleeper ? 72 : 56,
              child: OutlinedButton(
                onPressed: onCancel,
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: _getModeColor(userMode)),
                ),
                child: Text(
                  '取消',
                  style: TextStyle(
                    fontSize: userMode == UserMode.sleeper ? 20 : 18,
                    fontWeight: FontWeight.w600,
                    color: _getModeColor(userMode),
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

/**
 * 11. 建構精準控制者模式UI
 * @version 2025-01-21-V2.5.0
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
        secondary: const Color(0xFF37474F),
      ),
    ),
    child: Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFAFAFA),
        border: Border(
          left: BorderSide(color: Color(0xFF1976D2), width: 4),
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
                const Icon(Icons.engineering, color: Colors.white),
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
                  icon: const Icon(Icons.settings, color: Colors.white),
                  onPressed: () {},
                ),
              ],
            ),
          ),
          
          // 主要內容區域
          Expanded(
            child: pageProps['child'] ?? Container(),
          ),
          
          // 底部狀態列
          Container(
            color: const Color(0xFFE3F2FD),
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.security, size: 16, color: Colors.blue.shade800),
                const SizedBox(width: 8),
                Text(
                  '高安全性模式已啟用',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.blue.shade800,
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

/**
 * 12. 建構紀錄習慣者模式UI
 * @version 2025-01-21-V2.5.0
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
    ),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 800),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF3E5F5), Colors.white],
        ),
      ),
      child: Column(
        children: [
          // 優雅標題區域
          Container(
            padding: const EdgeInsets.all(20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.auto_awesome, size: 24, color: Colors.purple.shade600),
                const SizedBox(width: 12),
                Text(
                  '✨ 優雅記帳體驗',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w500,
                    color: Colors.purple.shade600,
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
                margin: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.purple.withOpacity(0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: pageProps['child'] ?? Container(),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

/**
 * 13. 建構轉型挑戰者模式UI
 * @version 2025-01-21-V2.5.0
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
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.emoji_events, size: 28, color: Colors.white),
                    const SizedBox(width: 12),
                    const Text(
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
                const Text(
                  '每一步都是朝著目標前進！',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white,
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
              border: Border.all(color: const Color(0xFFFF6B35), width: 2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.trending_up, color: Colors.orange.shade600),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    '堅持記帳，實現財務自由夢想！',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // 主要內容區域
          Expanded(
            child: pageProps['child'] ?? Container(),
          ),
          
          // 底部激勵列
          Container(
            color: const Color(0xFFFFE0B2),
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.star, size: 16, color: Colors.orange.shade700),
                const SizedBox(width: 8),
                Text(
                  '已堅持 ${_getDaysCount()} 天！繼續加油！',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.orange.shade700,
                    fontWeight: FontWeight.w600,
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

/**
 * 14. 建構潛在覺醒者模式UI
 * @version 2025-01-21-V2.5.0
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
            Padding(
              padding: const EdgeInsets.all(32.0),
              child: Column(
                children: [
                  Icon(
                    Icons.eco,
                    size: 64,
                    color: Colors.green.shade600,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    '🌱 輕鬆記帳',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w600,
                      color: Colors.green.shade700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '簡單開始，輕鬆管理',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.green.shade600,
                    ),
                  ),
                ],
              ),
            ),
            
            // 極簡內容容器
            Expanded(
              child: Container(
                margin: const EdgeInsets.all(24),
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.green.withOpacity(0.1),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: pageProps['child'] ?? Container(),
              ),
            ),
            
            // 友善提示文字
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Text(
                '💡 需要幫助嗎？點擊右上角問號',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.green.shade600,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/**
 * 15. 建構載入指示器
 * @version 2025-01-21-V2.5.0
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

// ==================== 輔助函數 ====================

/**
 * 16. 獲取模式對應顏色
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的主題顏色
 */
Color _getModeColor(UserMode mode) {
  switch (mode) {
    case UserMode.controller:
      return const Color(0xFF1976D2); // 專業藍色
    case UserMode.logger:
      return const Color(0xFF6A1B9A); // 優雅紫色
    case UserMode.struggler:
      return const Color(0xFFFF6B35); // 活力橙色
    case UserMode.sleeper:
      return const Color(0xFF4CAF50); // 自然綠色
  }
}

/**
 * 17. 獲取模式對應圖標
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的圖標
 */
IconData _getModeIcon(UserMode mode) {
  switch (mode) {
    case UserMode.controller:
      return Icons.engineering;     // 工程圖標
    case UserMode.logger:
      return Icons.auto_awesome;    // 星光圖標
    case UserMode.struggler:
      return Icons.emoji_events;    // 獎盃圖標
    case UserMode.sleeper:
      return Icons.eco;             // 生態圖標
  }
}

/**
 * 18. 獲取模式對應名稱
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的中文名稱
 */
String _getModeName(UserMode mode) {
  switch (mode) {
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

/**
 * 19. 獲取模式對應登入標題
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的登入頁面標題
 */
String _getModeLoginTitle(UserMode mode) {
  switch (mode) {
    case UserMode.controller:
      return '精準控制者登入';
    case UserMode.logger:
      return '紀錄習慣者登入';
    case UserMode.struggler:
      return '轉型挑戰者登入';
    case UserMode.sleeper:
      return '潛在覺醒者登入';
  }
}

/**
 * 20. 獲取模式對應登入訊息
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的登入歡迎訊息
 */
String _getModeLoginMessage(UserMode mode) {
  switch (mode) {
    case UserMode.controller:
      return '🎯 歡迎回來，精準控制者！\n讓我們繼續您的專業記帳之旅';
    case UserMode.logger:
      return '✨ 歡迎回來！\n優雅的記帳體驗等待著您';
    case UserMode.struggler:
      return '💪 歡迎回來，挑戰者！\n繼續朝著財務自由的目標前進';
    case UserMode.sleeper:
      return '🌱 歡迎回來！\n輕鬆開始您的記帳旅程';
  }
}

/**
 * 21. 獲取模式對應註冊標題
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的註冊頁面標題
 */
String _getModeRegisterTitle(UserMode mode) {
  switch (mode) {
    case UserMode.controller:
      return '精準控制者註冊';
    case UserMode.logger:
      return '紀錄習慣者註冊';
    case UserMode.struggler:
      return '轉型挑戰者註冊';
    case UserMode.sleeper:
      return '潛在覺醒者註冊';
  }
}

/**
 * 22. 獲取模式對應註冊訊息
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的註冊歡迎訊息
 */
String _getModeRegistrationMessage(UserMode mode) {
  switch (mode) {
    case UserMode.controller:
      return '🎯 加入精準控制者行列\n開啟專業記帳管理體驗';
    case UserMode.logger:
      return '✨ 開始優雅的記帳習慣\n讓每一筆記錄都充滿美感';
    case UserMode.struggler:
      return '💪 開啟轉型挑戰之旅\n每一步都朝著目標前進';
    case UserMode.sleeper:
      return '🌱 輕鬆開始記帳旅程\n簡單、自然、無壓力';
  }
}

/**
 * 23. 獲取模式對應登出訊息
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 根據使用者模式回傳對應的登出確認訊息
 */
String _getModeLogoutMessage(UserMode mode) {
  switch (mode) {
    case UserMode.controller:
      return '您可以選擇快速登出保留設定，或完全登出清除資料';
    case UserMode.logger:
      return '✨ 感謝您的優雅記帳時光，期待下次相遇';
    case UserMode.struggler:
      return '💪 休息是為了走更長遠的路，加油！';
    case UserMode.sleeper:
      return '🌱 隨時歡迎您回來繼續輕鬆記帳';
  }
}

/**
 * 24. 檢查表單是否有效
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 檢查Email和密碼輸入框是否有內容
 */
bool _isFormValid(TextEditingController emailController, TextEditingController passwordController) {
  return emailController.text.isNotEmpty && passwordController.text.isNotEmpty;
}

/**
 * 25. 獲取堅持天數
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 模擬獲取使用者堅持記帳的天數，實際應從狀態管理或API獲取
 */
int _getDaysCount() {
  // 模擬堅持天數，實際應從狀態管理或API獲取
  return 23;
}

// ==================== 密碼重設步驟輔助函數 ====================

/**
 * 26. 建構Email輸入步驟
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 建構密碼重設第一步驟 - Email輸入介面
 */
Widget _buildEmailStep(BuildContext context, UserMode userMode, Function(String) onSendCode, bool isLoading) {
  final emailController = TextEditingController();
  
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Icon(
        Icons.email_outlined,
        size: 64,
        color: _getModeColor(userMode),
      ),
      const SizedBox(height: 32),
      Text(
        '輸入您的Email地址',
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.bold,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 16),
      Text(
        '我們將發送驗證碼到您的信箱',
        style: Theme.of(context).textTheme.bodyLarge,
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 48),
      
      TextFormField(
        controller: emailController,
        keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(
          labelText: 'Email',
          prefixIcon: Icon(Icons.email),
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 32),
      
      SizedBox(
        height: userMode == UserMode.sleeper ? 72 : 56,
        child: ElevatedButton(
          onPressed: isLoading ? null : () => onSendCode(emailController.text),
          style: ElevatedButton.styleFrom(
            backgroundColor: _getModeColor(userMode),
          ),
          child: isLoading
            ? AUTH_buildLoadingIndicator()
            : Text(
                '發送驗證碼',
                style: TextStyle(
                  fontSize: userMode == UserMode.sleeper ? 20 : 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
        ),
      ),
    ],
  );
}

/**
 * 27. 建構驗證碼輸入步驟
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 建構密碼重設第二步驟 - 驗證碼輸入介面
 */
Widget _buildVerificationStep(BuildContext context, UserMode userMode, Function(String) onVerifyCode, bool isLoading) {
  final codeController = TextEditingController();
  
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Icon(
        Icons.security,
        size: 64,
        color: _getModeColor(userMode),
      ),
      const SizedBox(height: 32),
      Text(
        '請輸入驗證碼',
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.bold,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 16),
      Text(
        '請檢查您的Email信箱',
        style: Theme.of(context).textTheme.bodyLarge,
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 48),
      
      TextFormField(
        controller: codeController,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(
          labelText: '驗證碼',
          prefixIcon: Icon(Icons.security),
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 32),
      
      SizedBox(
        height: userMode == UserMode.sleeper ? 72 : 56,
        child: ElevatedButton(
          onPressed: isLoading ? null : () => onVerifyCode(codeController.text),
          style: ElevatedButton.styleFrom(
            backgroundColor: _getModeColor(userMode),
          ),
          child: isLoading
            ? AUTH_buildLoadingIndicator()
            : Text(
                '驗證',
                style: TextStyle(
                  fontSize: userMode == UserMode.sleeper ? 20 : 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
        ),
      ),
    ],
  );
}

/**
 * 28. 建構新密碼設定步驟
 * @version 2025-01-21-V2.5.0
 * @date 2025-01-21 10:00:00
 * @description 建構密碼重設第三步驟 - 新密碼設定介面
 */
Widget _buildPasswordStep(BuildContext context, UserMode userMode, Function(String) onResetPassword, bool isLoading) {
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final formKey = GlobalKey<FormState>();
  
  return Form(
    key: formKey,
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          Icons.lock_reset,
          size: 64,
          color: _getModeColor(userMode),
        ),
        const SizedBox(height: 32),
        Text(
          '設定新密碼',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 48),
        
        TextFormField(
          controller: passwordController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: '新密碼',
            prefixIcon: Icon(Icons.lock),
            border: OutlineInputBorder(),
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '密碼不能為空';
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
          decoration: const InputDecoration(
            labelText: '確認新密碼',
            prefixIcon: Icon(Icons.lock_outline),
            border: OutlineInputBorder(),
          ),
          validator: (value) {
            if (value != passwordController.text) {
              return '密碼不一致';
            }
            return null;
          },
        ),
        const SizedBox(height: 32),
        
        SizedBox(
          height: userMode == UserMode.sleeper ? 72 : 56,
          child: ElevatedButton(
            onPressed: isLoading ? null : () {
              if (formKey.currentState?.validate() ?? false) {
                onResetPassword(passwordController.text);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _getModeColor(userMode),
            ),
            child: isLoading
              ? AUTH_buildLoadingIndicator()
              : Text(
                  '完成重設',
                  style: TextStyle(
                    fontSize: userMode == UserMode.sleeper ? 20 : 18,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
          ),
        ),
      ],
    ),
  );
}
