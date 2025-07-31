
/**
 * Flutter展示層模組_登入頁面_2.0.0
 * @module 登入頁面
 * @description 使用者登入界面 - 支援多種登入方式和四模式主題
 * @update 2025-01-27: 初版建立，整合主題管理和狀態管理
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '9602. theme_manager.dart';
import '9604. app_state_provider.dart';
import '9605. user_mode_provider.dart';
import '9607. common_widgets.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isPasswordVisible = false;
  bool _isLoading = false;
  bool _rememberMe = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// 執行登入流程
  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final appState = context.read<AppStateProvider>();
      final userModeProvider = context.read<UserModeProvider>();
      
      // 模擬登入API調用
      await Future.delayed(const Duration(seconds: 2));
      
      // 登入成功後設定使用者狀態
      await appState.setUserLoggedIn(true);
      
      // 檢查是否已設定使用者模式
      if (userModeProvider.currentMode == null) {
        // 跳轉至問卷頁面
        if (mounted) {
          Navigator.of(context).pushReplacementNamed('/questionnaire');
        }
      } else {
        // 直接跳轉至主頁面
        if (mounted) {
          Navigator.of(context).pushReplacementNamed('/main');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('登入失敗: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  /// 處理第三方登入
  Future<void> _handleSocialLogin(String provider) async {
    setState(() => _isLoading = true);
    
    try {
      // 模擬第三方登入
      await Future.delayed(const Duration(seconds: 1));
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$provider 登入功能開發中')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeManager = context.watch<ThemeManager>();
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 60),
                
                // Logo 區域
                _buildLogo(theme),
                
                const SizedBox(height: 60),
                
                // 標題
                Text(
                  '歡迎回來',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.primaryColor,
                  ),
                  textAlign: TextAlign.center,
                ),
                
                const SizedBox(height: 8),
                
                Text(
                  '請登入您的帳號',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.textTheme.bodyMedium?.color,
                  ),
                  textAlign: TextAlign.center,
                ),
                
                const SizedBox(height: 40),
                
                // 登入表單
                _buildLoginForm(theme),
                
                const SizedBox(height: 24),
                
                // 登入按鈕
                AppButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text('登入'),
                ),
                
                const SizedBox(height: 16),
                
                // 忘記密碼
                TextButton(
                  onPressed: () => Navigator.of(context).pushNamed('/forgot-password'),
                  child: Text(
                    '忘記密碼？',
                    style: TextStyle(color: theme.primaryColor),
                  ),
                ),
                
                const SizedBox(height: 32),
                
                // 分隔線
                _buildDivider(theme),
                
                const SizedBox(height: 32),
                
                // 第三方登入
                _buildSocialLogin(theme),
                
                const SizedBox(height: 40),
                
                // 註冊連結
                _buildSignUpLink(theme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// 建立Logo區域
  Widget _buildLogo(ThemeData theme) {
    return Container(
      height: 100,
      decoration: BoxDecoration(
        color: theme.primaryColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(50),
      ),
      child: Icon(
        Icons.account_balance_wallet,
        size: 60,
        color: theme.primaryColor,
      ),
    );
  }

  /// 建立登入表單
  Widget _buildLoginForm(ThemeData theme) {
    return Column(
      children: [
        // Email 輸入框
        AppTextField(
          controller: _emailController,
          labelText: 'Email',
          keyboardType: TextInputType.emailAddress,
          prefixIcon: Icons.email_outlined,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請輸入Email';
            }
            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
              return '請輸入有效的Email格式';
            }
            return null;
          },
        ),
        
        const SizedBox(height: 16),
        
        // 密碼輸入框
        AppTextField(
          controller: _passwordController,
          labelText: '密碼',
          obscureText: !_isPasswordVisible,
          prefixIcon: Icons.lock_outlined,
          suffixIcon: IconButton(
            icon: Icon(
              _isPasswordVisible ? Icons.visibility_off : Icons.visibility,
            ),
            onPressed: () {
              setState(() => _isPasswordVisible = !_isPasswordVisible);
            },
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請輸入密碼';
            }
            if (value.length < 6) {
              return '密碼至少需要6個字元';
            }
            return null;
          },
        ),
        
        const SizedBox(height: 8),
        
        // 記住我選項
        Row(
          children: [
            Checkbox(
              value: _rememberMe,
              onChanged: (value) {
                setState(() => _rememberMe = value ?? false);
              },
            ),
            Text(
              '記住我',
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
      ],
    );
  }

  /// 建立分隔線
  Widget _buildDivider(ThemeData theme) {
    return Row(
      children: [
        Expanded(child: Divider(color: theme.dividerColor)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            '或使用',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodySmall?.color,
            ),
          ),
        ),
        Expanded(child: Divider(color: theme.dividerColor)),
      ],
    );
  }

  /// 建立第三方登入按鈕
  Widget _buildSocialLogin(ThemeData theme) {
    return Column(
      children: [
        // Google 登入
        AppButton.outline(
          onPressed: _isLoading ? null : () => _handleSocialLogin('Google'),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.g_mobiledata, color: theme.primaryColor),
              const SizedBox(width: 8),
              const Text('使用 Google 登入'),
            ],
          ),
        ),
        
        const SizedBox(height: 12),
        
        // LINE 登入
        AppButton.outline(
          onPressed: _isLoading ? null : () => _handleSocialLogin('LINE'),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.chat, color: Colors.green),
              const SizedBox(width: 8),
              const Text('使用 LINE 登入'),
            ],
          ),
        ),
      ],
    );
  }

  /// 建立註冊連結
  Widget _buildSignUpLink(ThemeData theme) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          '還沒有帳號？',
          style: theme.textTheme.bodyMedium,
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pushNamed('/register'),
          child: Text(
            '立即註冊',
            style: TextStyle(
              color: theme.primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }
}
