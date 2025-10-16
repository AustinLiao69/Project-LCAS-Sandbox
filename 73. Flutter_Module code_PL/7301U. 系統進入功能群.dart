
/**
 * 7301U. 系統進入功能群.dart
 * @version v1.0.0
 * @date 2025-10-16
 * @update: 階段一實作完成 - UI邏輯分拆
 *
 * 本模組實現LCAS 2.0系統進入功能群的UI展示層，
 * 專注於Widget實作、Flutter相關功能、使用者介面互動。
 * 業務邏輯由7301. 系統進入功能群.dart提供。
 */

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

// 引入業務邏輯模組
import '7301. 系統進入功能群.dart';

// ===========================================
// UI Widget類別定義
// ===========================================

/// APP啟動頁Widget
class SplashPageWidget extends StatefulWidget {
  final SystemEntryFunctionGroup businessLogic;

  const SplashPageWidget({Key? key, required this.businessLogic}) : super(key: key);

  @override
  State<SplashPageWidget> createState() => _SplashPageWidgetState();
}

class _SplashPageWidgetState extends State<SplashPageWidget> 
    with SingleTickerProviderStateMixin {
  
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  String _statusMessage = '正在啟動應用程式...';

  @override
  void initState() {
    super.initState();
    _initializeAnimations();
    _initializeApp();
  }

  void _initializeAnimations() {
    _animationController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut)
    );
    _animationController.forward();
  }

  void _initializeApp() async {
    try {
      setState(() => _statusMessage = '正在初始化...');
      await widget.businessLogic.initializeApp();
      
      setState(() => _statusMessage = '檢查版本資訊...');
      await widget.businessLogic.checkAppVersion();
      
      setState(() => _statusMessage = '載入使用者狀態...');
      final authState = await widget.businessLogic.loadAuthenticationState();
      
      setState(() => _statusMessage = '初始化模式設定...');
      await widget.businessLogic.initializeModeConfiguration();
      
      setState(() => _statusMessage = '啟動完成');
      
      // 延遲後導航至適當頁面
      await Future.delayed(const Duration(seconds: 1));
      _navigateToNextPage(authState);
      
    } catch (e) {
      setState(() => _statusMessage = '啟動失敗: $e');
    }
  }

  void _navigateToNextPage(AuthState authState) {
    if (authState.isAuthenticated) {
      // 導航至主頁面
      Navigator.of(context).pushReplacementNamed('/main');
    } else {
      // 導航至登入頁面
      Navigator.of(context).pushReplacementNamed('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentMode = widget.businessLogic.currentModeConfig?.userMode ?? UserMode.inertial;
    final theme = widget.businessLogic.loadUserModeTheme(currentMode);
    
    return Scaffold(
      backgroundColor: Color(theme['backgroundColor'] as int),
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // LCAS Logo
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Color(theme['primaryColor'] as int),
                  borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                ),
                child: Icon(
                  Icons.account_balance_wallet,
                  size: 60,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 32),
              
              // 載入指示器
              CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(
                  Color(theme['accentColor'] as int)
                ),
              ),
              const SizedBox(height: 24),
              
              // 狀態訊息
              Text(
                _statusMessage,
                style: TextStyle(
                  fontSize: 16,
                  color: Color(theme['textColor'] as int),
                  fontFamily: theme['fontFamily'] as String,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }
}

/// 登入頁面Widget
class LoginPageWidget extends StatefulWidget {
  final SystemEntryFunctionGroup businessLogic;

  const LoginPageWidget({Key? key, required this.businessLogic}) : super(key: key);

  @override
  State<LoginPageWidget> createState() => _LoginPageWidgetState();
}

class _LoginPageWidgetState extends State<LoginPageWidget> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _rememberMe = false;
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  Widget build(BuildContext context) {
    final currentMode = widget.businessLogic.currentModeConfig?.userMode ?? UserMode.inertial;
    final theme = widget.businessLogic.loadUserModeTheme(currentMode);
    
    return Scaffold(
      backgroundColor: Color(theme['backgroundColor'] as int),
      appBar: AppBar(
        title: const Text('登入'),
        backgroundColor: Color(theme['primaryColor'] as int),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 標題
                Text(
                  '歡迎回到LCAS',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(theme['primaryColor'] as int),
                    fontFamily: theme['fontFamily'] as String,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                
                Text(
                  _getModeSpecificSubtitle(currentMode),
                  style: TextStyle(
                    fontSize: 16,
                    color: Color(theme['secondaryTextColor'] as int),
                    fontFamily: theme['fontFamily'] as String,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),

                // Email欄位
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: 'Email',
                    prefixIcon: const Icon(Icons.email),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                      borderSide: BorderSide(color: Color(theme['primaryColor'] as int)),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return '請輸入Email';
                    }
                    if (!widget.businessLogic.validateEmailFormat(value)) {
                      return 'Email格式不正確';
                    }
                    return null;
                  },
                  onChanged: (value) {
                    // 即時驗證
                    final result = widget.businessLogic.performRealtimeFormValidation('email', value);
                    if (!result['isValid']) {
                      // 可以在這裡顯示即時錯誤提示
                    }
                  },
                ),
                const SizedBox(height: 16),

                // 密碼欄位
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: '密碼',
                    prefixIcon: const Icon(Icons.lock),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                      borderSide: BorderSide(color: Color(theme['primaryColor'] as int)),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return '請輸入密碼';
                    }
                    if (value.length < 6) {
                      return '密碼長度至少6位數';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // 記住我選項
                Row(
                  children: [
                    Checkbox(
                      value: _rememberMe,
                      onChanged: (value) => setState(() => _rememberMe = value ?? false),
                      activeColor: Color(theme['primaryColor'] as int),
                    ),
                    Text(
                      '記住我',
                      style: TextStyle(
                        color: Color(theme['textColor'] as int),
                        fontFamily: theme['fontFamily'] as String,
                      ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: () => Navigator.of(context).pushNamed('/forgot-password'),
                      child: Text(
                        '忘記密碼？',
                        style: TextStyle(color: Color(theme['primaryColor'] as int)),
                      ),
                    ),
                  ],
                ),

                // 錯誤訊息
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Color(theme['errorColor'] as int).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(
                        color: Color(theme['errorColor'] as int),
                        fontFamily: theme['fontFamily'] as String,
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                // 登入按鈕
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(theme['primaryColor'] as int),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          '登入',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            fontFamily: theme['fontFamily'] as String,
                          ),
                        ),
                ),
                const SizedBox(height: 16),

                // Google登入按鈕（根據模式顯示）
                if (_shouldShowGoogleLogin(currentMode)) ...[
                  OutlinedButton.icon(
                    onPressed: _isLoading ? null : _handleGoogleLogin,
                    icon: const Icon(Icons.login),
                    label: Text(
                      '使用Google帳號登入',
                      style: TextStyle(fontFamily: theme['fontFamily'] as String),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: BorderSide(color: Color(theme['primaryColor'] as int)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // 註冊連結
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '還沒有帳號？',
                      style: TextStyle(
                        color: Color(theme['secondaryTextColor'] as int),
                        fontFamily: theme['fontFamily'] as String,
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pushNamed('/register'),
                      child: Text(
                        '立即註冊',
                        style: TextStyle(
                          color: Color(theme['primaryColor'] as int),
                          fontWeight: FontWeight.bold,
                          fontFamily: theme['fontFamily'] as String,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _getModeSpecificSubtitle(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return '專業記帳管理系統';
      case UserMode.inertial:
        return '穩定可靠的記帳體驗';
      case UserMode.cultivation:
        return '培養良好記帳習慣';
      case UserMode.guiding:
        return '簡單輕鬆開始記帳';
    }
  }

  bool _shouldShowGoogleLogin(UserMode mode) {
    // Guiding模式簡化流程，其他模式顯示Google登入
    return mode != UserMode.guiding;
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await widget.businessLogic.loginWithEmail(
        _emailController.text,
        _passwordController.text,
      );

      if (response.success) {
        // 保存登入狀態
        await widget.businessLogic.saveLoginState(response.token!, _rememberMe);
        
        // 導航至主頁面
        Navigator.of(context).pushReplacementNamed('/main');
      } else {
        setState(() => _errorMessage = response.message);
      }
    } catch (e) {
      setState(() => _errorMessage = '登入失敗，請稍後再試');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _handleGoogleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await widget.businessLogic.loginWithGoogle();

      if (response.success) {
        // 保存登入狀態
        await widget.businessLogic.saveLoginState(response.token!, true);
        
        // 導航至主頁面
        Navigator.of(context).pushReplacementNamed('/main');
      } else {
        setState(() => _errorMessage = response.message);
      }
    } catch (e) {
      setState(() => _errorMessage = 'Google登入失敗，請稍後再試');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}

/// 註冊頁面Widget
class RegisterPageWidget extends StatefulWidget {
  final SystemEntryFunctionGroup businessLogic;

  const RegisterPageWidget({Key? key, required this.businessLogic}) : super(key: key);

  @override
  State<RegisterPageWidget> createState() => _RegisterPageWidgetState();
}

class _RegisterPageWidgetState extends State<RegisterPageWidget> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _displayNameController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _errorMessage;
  PasswordStrength? _passwordStrength;

  @override
  Widget build(BuildContext context) {
    final currentMode = widget.businessLogic.currentModeConfig?.userMode ?? UserMode.inertial;
    final theme = widget.businessLogic.loadUserModeTheme(currentMode);
    
    return Scaffold(
      backgroundColor: Color(theme['backgroundColor'] as int),
      appBar: AppBar(
        title: const Text('註冊'),
        backgroundColor: Color(theme['primaryColor'] as int),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 標題
                Text(
                  '加入LCAS',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(theme['primaryColor'] as int),
                    fontFamily: theme['fontFamily'] as String,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                
                Text(
                  _getModeSpecificRegisterSubtitle(currentMode),
                  style: TextStyle(
                    fontSize: 16,
                    color: Color(theme['secondaryTextColor'] as int),
                    fontFamily: theme['fontFamily'] as String,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),

                // 顯示名稱欄位（Guiding模式可選填）
                if (currentMode != UserMode.guiding || _displayNameController.text.isNotEmpty) ...[
                  TextFormField(
                    controller: _displayNameController,
                    decoration: InputDecoration(
                      labelText: currentMode == UserMode.guiding ? '顯示名稱（選填）' : '顯示名稱',
                      prefixIcon: const Icon(Icons.person),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                      ),
                    ),
                    validator: currentMode == UserMode.guiding ? null : (value) {
                      if (value == null || value.isEmpty) {
                        return '請輸入顯示名稱';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // Email欄位
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: 'Email',
                    prefixIcon: const Icon(Icons.email),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return '請輸入Email';
                    }
                    if (!widget.businessLogic.validateEmailFormat(value)) {
                      return 'Email格式不正確';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // 密碼欄位
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: '密碼',
                    prefixIcon: const Icon(Icons.lock),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return '請輸入密碼';
                    }
                    final strength = widget.businessLogic.checkPasswordStrength(value);
                    if (!strength.isAcceptable) {
                      return '密碼強度不足：${strength.suggestions.join('、')}';
                    }
                    return null;
                  },
                  onChanged: (value) {
                    setState(() {
                      _passwordStrength = widget.businessLogic.checkPasswordStrength(value);
                    });
                  },
                ),

                // 密碼強度指示器
                if (_passwordStrength != null && _passwordController.text.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _buildPasswordStrengthIndicator(_passwordStrength!, theme),
                ],

                const SizedBox(height: 16),

                // 確認密碼欄位（Guiding模式可能隱藏）
                if (currentMode != UserMode.guiding || _showConfirmPassword()) ...[
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirmPassword,
                    decoration: InputDecoration(
                      labelText: '確認密碼',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureConfirmPassword ? Icons.visibility : Icons.visibility_off),
                        onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                      ),
                    ),
                    validator: (value) {
                      if (currentMode == UserMode.guiding) return null;
                      if (value == null || value.isEmpty) {
                        return '請確認密碼';
                      }
                      if (value != _passwordController.text) {
                        return '密碼確認不一致';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // 錯誤訊息
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Color(theme['errorColor'] as int).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(
                        color: Color(theme['errorColor'] as int),
                        fontFamily: theme['fontFamily'] as String,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // 註冊按鈕
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleRegister,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(theme['primaryColor'] as int),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          '註冊',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            fontFamily: theme['fontFamily'] as String,
                          ),
                        ),
                ),
                const SizedBox(height: 16),

                // Google註冊按鈕
                if (_shouldShowGoogleRegister(currentMode)) ...[
                  OutlinedButton.icon(
                    onPressed: _isLoading ? null : _handleGoogleRegister,
                    icon: const Icon(Icons.login),
                    label: Text(
                      '使用Google帳號註冊',
                      style: TextStyle(fontFamily: theme['fontFamily'] as String),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: BorderSide(color: Color(theme['primaryColor'] as int)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // 登入連結
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '已經有帳號？',
                      style: TextStyle(
                        color: Color(theme['secondaryTextColor'] as int),
                        fontFamily: theme['fontFamily'] as String,
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(
                        '立即登入',
                        style: TextStyle(
                          color: Color(theme['primaryColor'] as int),
                          fontWeight: FontWeight.bold,
                          fontFamily: theme['fontFamily'] as String,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPasswordStrengthIndicator(PasswordStrength strength, Map<String, dynamic> theme) {
    Color strengthColor;
    switch (strength.level) {
      case 'weak':
        strengthColor = Color(theme['errorColor'] as int);
        break;
      case 'medium':
        strengthColor = Color(theme['warningColor'] as int);
        break;
      case 'strong':
        strengthColor = Color(theme['successColor'] as int);
        break;
      default:
        strengthColor = Color(theme['errorColor'] as int);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '密碼強度：${strength.level}',
              style: TextStyle(
                color: strengthColor,
                fontSize: 12,
                fontFamily: theme['fontFamily'] as String,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: LinearProgressIndicator(
                value: strength.score / 5,
                backgroundColor: strengthColor.withOpacity(0.2),
                valueColor: AlwaysStoppedAnimation<Color>(strengthColor),
              ),
            ),
          ],
        ),
        if (strength.suggestions.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            strength.suggestions.join('、'),
            style: TextStyle(
              color: strengthColor,
              fontSize: 11,
              fontFamily: theme['fontFamily'] as String,
            ),
          ),
        ],
      ],
    );
  }

  String _getModeSpecificRegisterSubtitle(UserMode mode) {
    switch (mode) {
      case UserMode.expert:
        return '專業功能等著您探索';
      case UserMode.inertial:
        return '建立您的穩定記帳習慣';
      case UserMode.cultivation:
        return '開始您的記帳成長之旅';
      case UserMode.guiding:
        return '三步驟輕鬆完成註冊';
    }
  }

  bool _shouldShowGoogleRegister(UserMode mode) {
    return mode != UserMode.guiding;
  }

  bool _showConfirmPassword() {
    // Guiding模式只有在密碼強度不夠時才顯示確認密碼
    if (_passwordStrength != null && !_passwordStrength!.isAcceptable) {
      return true;
    }
    return false;
  }

  void _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final request = RegisterRequest(
        email: _emailController.text,
        password: _passwordController.text,
        confirmPassword: _confirmPasswordController.text.isEmpty 
            ? _passwordController.text 
            : _confirmPasswordController.text,
        displayName: _displayNameController.text.isEmpty ? null : _displayNameController.text,
      );

      final response = await widget.businessLogic.registerWithEmail(request);

      if (response.success) {
        // 註冊成功，導航至模式評估頁面
        Navigator.of(context).pushReplacementNamed('/mode-assessment');
      } else {
        setState(() => _errorMessage = response.message);
      }
    } catch (e) {
      setState(() => _errorMessage = '註冊失敗，請稍後再試');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _handleGoogleRegister() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await widget.businessLogic.registerWithGoogle();

      if (response.success) {
        // 註冊成功，導航至模式評估頁面
        Navigator.of(context).pushReplacementNamed('/mode-assessment');
      } else {
        setState(() => _errorMessage = response.message);
      }
    } catch (e) {
      setState(() => _errorMessage = 'Google註冊失敗，請稍後再試');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _displayNameController.dispose();
    super.dispose();
  }
}

/// 四模式UI適配器
class ModeAdaptiveUI {
  /// 獲取模式專用的按鈕樣式
  static ButtonStyle getModeButtonStyle(UserMode mode, Map<String, dynamic> theme) {
    return ElevatedButton.styleFrom(
      backgroundColor: Color(theme['primaryColor'] as int),
      foregroundColor: Colors.white,
      padding: EdgeInsets.symmetric(
        vertical: mode == UserMode.guiding ? 20 : 16,
        horizontal: mode == UserMode.guiding ? 32 : 24,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
      ),
      elevation: theme['elevation'] as double,
    );
  }

  /// 獲取模式專用的輸入框裝飾
  static InputDecoration getModeInputDecoration(
    UserMode mode, 
    Map<String, dynamic> theme, 
    String labelText,
    {IconData? prefixIcon, Widget? suffixIcon}
  ) {
    return InputDecoration(
      labelText: labelText,
      prefixIcon: prefixIcon != null ? Icon(prefixIcon) : null,
      suffixIcon: suffixIcon,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(theme['borderRadius'] as double),
        borderSide: BorderSide(
          color: Color(theme['primaryColor'] as int),
          width: mode == UserMode.guiding ? 3.0 : 2.0,
        ),
      ),
      filled: mode == UserMode.cultivation,
      fillColor: mode == UserMode.cultivation 
          ? Color(theme['backgroundColor'] as int) 
          : null,
    );
  }

  /// 獲取模式專用的文字樣式
  static TextStyle getModeTextStyle(UserMode mode, Map<String, dynamic> theme, TextStyleType type) {
    double fontSize;
    FontWeight fontWeight;
    Color color;

    switch (type) {
      case TextStyleType.title:
        fontSize = mode == UserMode.guiding ? 32 : 28;
        fontWeight = FontWeight.bold;
        color = Color(theme['primaryColor'] as int);
        break;
      case TextStyleType.subtitle:
        fontSize = mode == UserMode.guiding ? 18 : 16;
        fontWeight = FontWeight.normal;
        color = Color(theme['secondaryTextColor'] as int);
        break;
      case TextStyleType.body:
        fontSize = mode == UserMode.guiding ? 16 : 14;
        fontWeight = FontWeight.normal;
        color = Color(theme['textColor'] as int);
        break;
      case TextStyleType.button:
        fontSize = mode == UserMode.guiding ? 18 : 16;
        fontWeight = FontWeight.bold;
        color = Colors.white;
        break;
    }

    return TextStyle(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      fontFamily: theme['fontFamily'] as String,
    );
  }
}

enum TextStyleType {
  title,
  subtitle,
  body,
  button,
}

/// 系統進入功能群UI控制器
class SystemEntryUIController {
  final SystemEntryFunctionGroup businessLogic;

  SystemEntryUIController({required this.businessLogic});

  /// 處理UI錯誤顯示
  void handleUIError(BuildContext context, String errorCode, Map<String, dynamic>? errorData) {
    final errorInfo = businessLogic.handleAuthenticationError(errorCode, errorData?['message']);
    final displayInfo = businessLogic.displayUserFriendlyErrorMessage(errorCode, errorInfo);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(displayInfo['title']),
        content: Text(displayInfo['message']),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(displayInfo['buttonText']),
          ),
        ],
      ),
    );
  }

  /// 處理表單驗證結果顯示
  Widget buildValidationMessage(Map<String, dynamic> validationResult) {
    if (validationResult['isValid']) {
      return Container();
    }

    return Container(
      padding: const EdgeInsets.all(8),
      margin: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(
        color: Colors.red.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        validationResult['errorMessage'] ?? '驗證失敗',
        style: const TextStyle(color: Colors.red, fontSize: 12),
      ),
    );
  }

  /// 顯示載入對話框
  void showLoadingDialog(BuildContext context, String message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        content: Row(
          children: [
            const CircularProgressIndicator(),
            const SizedBox(width: 16),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }

  /// 隱藏載入對話框
  void hideLoadingDialog(BuildContext context) {
    Navigator.of(context, rootNavigator: true).pop();
  }
}
