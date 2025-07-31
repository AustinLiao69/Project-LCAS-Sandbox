
/**
 * Flutter展示層模組_註冊頁面_2.0.0
 * @module 註冊頁面
 * @description 使用者註冊界面 - 包含表單驗證和服務條款同意
 * @update 2025-01-27: 初版建立，整合主題管理和表單驗證
 */

import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:provider/provider.dart';
import '9602. theme_manager.dart';
import '9604. app_state_provider.dart';
import '9607. common_widgets.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  
  bool _isPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;
  bool _isLoading = false;
  bool _acceptTerms = false;
  bool _acceptPrivacy = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  /// 執行註冊流程
  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;
    
    if (!_acceptTerms || !_acceptPrivacy) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('請同意服務條款和隱私政策'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final appState = context.read<AppStateProvider>();
      
      // 模擬註冊API調用
      await Future.delayed(const Duration(seconds: 2));
      
      // 註冊成功後設定使用者狀態
      await appState.setUserLoggedIn(true);
      
      if (mounted) {
        // 顯示成功訊息
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('註冊成功！歡迎加入LCAS'),
            backgroundColor: Colors.green,
          ),
        );
        
        // 跳轉至問卷頁面
        Navigator.of(context).pushReplacementNamed('/questionnaire');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('註冊失敗: $e'),
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('建立新帳號'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 20),
                
                // 歡迎文字
                _buildWelcomeText(theme),
                
                const SizedBox(height: 40),
                
                // 註冊表單
                _buildRegisterForm(theme),
                
                const SizedBox(height: 24),
                
                // 服務條款同意
                _buildTermsAgreement(theme),
                
                const SizedBox(height: 32),
                
                // 註冊按鈕
                AppButton(
                  onPressed: _isLoading ? null : _handleRegister,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text('建立帳號'),
                ),
                
                const SizedBox(height: 24),
                
                // 登入連結
                _buildLoginLink(theme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// 建立歡迎文字
  Widget _buildWelcomeText(ThemeData theme) {
    return Column(
      children: [
        Text(
          '歡迎加入 LCAS',
          style: theme.textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.primaryColor,
          ),
          textAlign: TextAlign.center,
        ),
        
        const SizedBox(height: 8),
        
        Text(
          '讓我們開始您的智慧記帳之旅',
          style: theme.textTheme.bodyLarge?.copyWith(
            color: theme.textTheme.bodyMedium?.color,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  /// 建立註冊表單
  Widget _buildRegisterForm(ThemeData theme) {
    return Column(
      children: [
        // 姓名輸入框
        AppTextField(
          controller: _nameController,
          labelText: '姓名',
          prefixIcon: Icons.person_outlined,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請輸入姓名';
            }
            if (value.length < 2) {
              return '姓名至少需要2個字元';
            }
            return null;
          },
        ),
        
        const SizedBox(height: 16),
        
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
            if (value.length < 8) {
              return '密碼至少需要8個字元';
            }
            if (!RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)').hasMatch(value)) {
              return '密碼需包含大小寫字母和數字';
            }
            return null;
          },
        ),
        
        const SizedBox(height: 16),
        
        // 確認密碼輸入框
        AppTextField(
          controller: _confirmPasswordController,
          labelText: '確認密碼',
          obscureText: !_isConfirmPasswordVisible,
          prefixIcon: Icons.lock_outlined,
          suffixIcon: IconButton(
            icon: Icon(
              _isConfirmPasswordVisible ? Icons.visibility_off : Icons.visibility,
            ),
            onPressed: () {
              setState(() => _isConfirmPasswordVisible = !_isConfirmPasswordVisible);
            },
          ),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return '請確認密碼';
            }
            if (value != _passwordController.text) {
              return '密碼不一致';
            }
            return null;
          },
        ),
      ],
    );
  }

  /// 建立服務條款同意區域
  Widget _buildTermsAgreement(ThemeData theme) {
    return Column(
      children: [
        // 服務條款
        Row(
          children: [
            Checkbox(
              value: _acceptTerms,
              onChanged: (value) {
                setState(() => _acceptTerms = value ?? false);
              },
            ),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: theme.textTheme.bodyMedium,
                  children: [
                    const TextSpan(text: '我同意 '),
                    TextSpan(
                      text: '服務條款',
                      style: TextStyle(
                        color: theme.primaryColor,
                        decoration: TextDecoration.underline,
                      ),
                      recognizer: TapGestureRecognizer()
                        ..onTap = () {
                          // 跳轉至服務條款頁面
                          Navigator.of(context).pushNamed('/terms');
                        },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        
        // 隱私政策
        Row(
          children: [
            Checkbox(
              value: _acceptPrivacy,
              onChanged: (value) {
                setState(() => _acceptPrivacy = value ?? false);
              },
            ),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: theme.textTheme.bodyMedium,
                  children: [
                    const TextSpan(text: '我同意 '),
                    TextSpan(
                      text: '隱私政策',
                      style: TextStyle(
                        color: theme.primaryColor,
                        decoration: TextDecoration.underline,
                      ),
                      recognizer: TapGestureRecognizer()
                        ..onTap = () {
                          // 跳轉至隱私政策頁面
                          Navigator.of(context).pushNamed('/privacy');
                        },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// 建立登入連結
  Widget _buildLoginLink(ThemeData theme) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          '已經有帳號？',
          style: theme.textTheme.bodyMedium,
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            '立即登入',
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
