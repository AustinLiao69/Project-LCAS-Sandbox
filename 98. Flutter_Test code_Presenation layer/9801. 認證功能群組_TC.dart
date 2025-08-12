
/**
 * TC_AUTH_認證功能群組_1.0.0
 * @module 認證功能群組測試
 * @description Flutter認證功能群組Widget測試 - 基於9701測試計畫v1.2.0
 * @update 2025-01-26: 建立完整測試代碼，涵蓋15個核心函數+13個輔助函數
 */

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:provider/provider.dart';

// 引入待測試的模組 - 實際專案中需要調整路徑
// import 'package:lcas_app/modules/8601_auth_module.dart';

// Mock 服務和狀態管理類別
class MockAuthService extends Mock {}

class AuthUiDisplayState extends ChangeNotifier {
  UserMode? _selectedMode;
  bool _isButtonLoading = false;
  String _uiMessage = '';
  bool _isPasswordVisible = false;

  UserMode? get selectedMode => _selectedMode;
  bool get isButtonLoading => _isButtonLoading;
  String get uiMessage => _uiMessage;
  bool get isPasswordVisible => _isPasswordVisible;

  void setSelectedMode(UserMode? mode) {
    _selectedMode = mode;
    notifyListeners();
  }

  void setButtonLoading(bool loading) {
    _isButtonLoading = loading;
    notifyListeners();
  }

  void setUiMessage(String message) {
    _uiMessage = message;
    notifyListeners();
  }

  void togglePasswordVisibility() {
    _isPasswordVisible = !_isPasswordVisible;
    notifyListeners();
  }
}

class AuthFormInputState {
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, bool> _checkboxes = {};

  TextEditingController getController(String key) {
    return _controllers.putIfAbsent(key, () => TextEditingController());
  }

  bool getCheckbox(String key) {
    return _checkboxes[key] ?? false;
  }

  void setCheckbox(String key, bool value) {
    _checkboxes[key] = value;
  }

  void clearInputs() {
    for (var controller in _controllers.values) {
      controller.clear();
    }
    _checkboxes.clear();
  }

  void dispose() {
    for (var controller in _controllers.values) {
      controller.dispose();
    }
  }
}

// 測試輔助工具類別
class AuthWidgetTestHelpers {
  static Widget createTestWrapper({
    required Widget child,
    UserMode? initialMode,
  }) {
    return MaterialApp(
      home: ChangeNotifierProvider<AuthUiDisplayState>(
        create: (_) => AuthUiDisplayState(),
        child: child,
      ),
    );
  }

  static void mockCallback([dynamic param]) {
    // 空實作，用於測試回調
  }

  static RegistrationData createTestRegistrationData({
    String email = 'test@example.com',
    String password = 'TestPassword123',
    String displayName = 'Test User',
    UserMode mode = UserMode.controller,
  }) {
    return RegistrationData(
      email: email,
      password: password,
      displayName: displayName,
      userMode: mode,
      termsAccepted: true,
      privacyAccepted: true,
    );
  }
}

// 主要測試套件
void main() {
  group('AUTH 認證功能群組 Widget 測試', () {
    late MockAuthService mockAuthService;
    
    setUp(() {
      mockAuthService = MockAuthService();
    });

    // ==================== Widget建構測試案例 ====================

    group('TC-001 to TC-003: Widget建構測試', () {
      testWidgets('TC-001: 歡迎頁面Widget建構完整性驗證', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: AUTH_buildWelcomePage(
              context: tester.element(find.byType(MaterialApp)),
              selectedMode: null,
              onModeSelected: (mode) {},
              onContinue: () {},
            ),
          ),
        );

        // 驗證Widget元件存在
        expect(find.byType(Scaffold), findsOneWidget);
        expect(find.byType(SafeArea), findsOneWidget);
        expect(find.text('歡迎使用 LCAS 2.0'), findsOneWidget);
        expect(find.byType(GridView), findsOneWidget);
        expect(find.text('開始使用'), findsOneWidget);
      });

      testWidgets('TC-002: 四模式選擇器Widget建構驗證', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildModeSelector(
                context: tester.element(find.byType(MaterialApp)),
                selectedMode: null,
                onModeSelected: (mode) {},
              ),
            ),
          ),
        );

        // 驗證GridView設定
        final gridView = tester.widget<GridView>(find.byType(GridView));
        expect((gridView as GridView).delegate, isA<SliverGridDelegateWithFixedCrossAxisCount>());
        
        // 驗證四個模式選項存在
        expect(find.byType(InkWell), findsNWidgets(4));
        expect(find.text('精準控制者'), findsOneWidget);
        expect(find.text('紀錄習慣者'), findsOneWidget);
        expect(find.text('轉型挑戰者'), findsOneWidget);
        expect(find.text('潛在覺醒者'), findsOneWidget);
      });

      testWidgets('TC-003: 登入頁面條件式內容渲染驗證', (WidgetTester tester) async {
        // 測試Sleeper模式：隱藏Email登入
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: AUTH_buildLoginPage(
              context: tester.element(find.byType(MaterialApp)),
              userMode: UserMode.sleeper,
              onLineLogin: () {},
              onGoogleLogin: () {},
              onAppleLogin: () {},
              onEmailLogin: (email, password) {},
              onForgotPassword: () {},
              onRegister: () {},
            ),
          ),
        );

        // Sleeper模式不應顯示分隔線和Email表單
        expect(find.text('或'), findsNothing);
        expect(find.text('忘記密碼？'), findsNothing);

        // 測試非Sleeper模式：顯示完整選項
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: AUTH_buildLoginPage(
              context: tester.element(find.byType(MaterialApp)),
              userMode: UserMode.controller,
              onLineLogin: () {},
              onGoogleLogin: () {},
              onAppleLogin: () {},
              onEmailLogin: (email, password) {},
              onForgotPassword: () {},
              onRegister: () {},
            ),
          ),
        );

        // Controller模式應顯示分隔線和Email表單
        expect(find.text('或'), findsOneWidget);
        expect(find.text('忘記密碼？'), findsOneWidget);
      });
    });

    // ==================== 使用者互動測試案例 ====================

    group('TC-004 to TC-006: 使用者互動測試', () {
      testWidgets('TC-004: 模式選擇互動流程驗證', (WidgetTester tester) async {
        UserMode? selectedMode;
        
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildModeSelector(
                context: tester.element(find.byType(MaterialApp)),
                selectedMode: selectedMode,
                onModeSelected: (mode) {
                  selectedMode = mode;
                },
              ),
            ),
          ),
        );

        // 點擊精準控制者模式
        await tester.tap(find.text('精準控制者'));
        await tester.pump();

        // 驗證選擇狀態
        expect(selectedMode, equals(UserMode.controller));
      });

      testWidgets('TC-005: 表單輸入互動驗證', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildEmailLoginForm(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.controller,
                onEmailLogin: (email, password) {},
                onForgotPassword: () {},
              ),
            ),
          ),
        );

        // 查找輸入框
        final emailField = find.byType(TextFormField).first;
        final passwordField = find.byType(TextFormField).last;

        // 輸入測試數據
        await tester.enterText(emailField, 'test@example.com');
        await tester.enterText(passwordField, 'password123');
        await tester.pump();

        // 驗證輸入內容
        expect(find.text('test@example.com'), findsOneWidget);
      });

      testWidgets('TC-006: OAuth按鈕互動測試', (WidgetTester tester) async {
        // Controller模式：應該有3個OAuth按鈕
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildOAuthButtons(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.controller,
                onLineLogin: () {},
                onGoogleLogin: () {},
                onAppleLogin: () {},
              ),
            ),
          ),
        );

        expect(find.text('LINE 登入'), findsOneWidget);
        expect(find.text('Google 登入'), findsOneWidget);
        expect(find.text('Apple 登入'), findsOneWidget);

        // Sleeper模式：只有LINE按鈕
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildOAuthButtons(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.sleeper,
                onLineLogin: () {},
                onGoogleLogin: () {},
                onAppleLogin: () {},
              ),
            ),
          ),
        );

        expect(find.text('LINE 登入'), findsOneWidget);
        expect(find.text('Google 登入'), findsNothing);
        expect(find.text('Apple 登入'), findsNothing);
      });
    });

    // ==================== 表單驗證測試案例 ====================

    group('TC-007 to TC-009: 表單驗證測試', () {
      testWidgets('TC-007: Email格式驗證測試', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildEmailLoginForm(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.controller,
                onEmailLogin: (email, password) {},
                onForgotPassword: () {},
              ),
            ),
          ),
        );

        final emailField = find.byType(TextFormField).first;

        // 測試數據驅動
        final emailTestCases = [
          {'input': 'valid@example.com', 'shouldPass': true},
          {'input': 'invalid-email', 'shouldPass': false},
          {'input': '', 'shouldPass': false},
        ];

        for (final testCase in emailTestCases) {
          await tester.enterText(emailField, testCase['input'] as String);
          await tester.pump();

          // 觸發驗證
          final formWidget = tester.widget<Form>(find.byType(Form));
          final isValid = formWidget.key?.currentState?.validate() ?? false;

          if (testCase['shouldPass'] as bool) {
            expect(isValid, isTrue, reason: 'Email ${testCase['input']} should be valid');
          } else {
            expect(isValid, isFalse, reason: 'Email ${testCase['input']} should be invalid');
          }
        }
      });

      testWidgets('TC-008: 密碼強度驗證測試', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildEmailLoginForm(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.controller,
                onEmailLogin: (email, password) {},
                onForgotPassword: () {},
              ),
            ),
          ),
        );

        final passwordField = find.byType(TextFormField).last;

        // 測試密碼太短
        await tester.enterText(passwordField, '123');
        await tester.pump();

        final formWidget = tester.widget<Form>(find.byType(Form));
        final isValid = formWidget.key?.currentState?.validate() ?? false;
        expect(isValid, isFalse, reason: 'Short password should be invalid');
      });

      testWidgets('TC-009: 註冊表單確認密碼驗證', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildRegistrationForm(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.controller,
                onRegister: (data) {},
              ),
            ),
          ),
        );

        final textFields = find.byType(TextFormField);
        expect(textFields, findsNWidgets(4)); // Email, Password, Confirm Password, Display Name

        // 輸入不同的密碼
        await tester.enterText(textFields.at(1), 'password123');
        await tester.enterText(textFields.at(2), 'different123');
        await tester.pump();

        // 觸發驗證
        final formWidget = tester.widget<Form>(find.byType(Form));
        final isValid = formWidget.key?.currentState?.validate() ?? false;
        expect(isValid, isFalse, reason: 'Mismatched passwords should be invalid');
      });
    });

    // ==================== 四模式體驗測試案例 ====================

    group('TC-010 to TC-014: 四模式體驗測試', () {
      testWidgets('TC-010: 精準控制者模式完整體驗測試', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: AUTH_buildControllerModeUI(
              context: tester.element(find.byType(MaterialApp)),
              pageType: AuthPageType.login,
              pageProps: {'child': Container()},
            ),
          ),
        );

        // 驗證專業標題列
        expect(find.text('🎯 精準控制者模式'), findsOneWidget);
        expect(find.byIcon(Icons.engineering), findsOneWidget);
        expect(find.byIcon(Icons.settings), findsOneWidget);

        // 驗證底部安全狀態列
        expect(find.text('高安全性模式已啟用'), findsOneWidget);
        expect(find.byIcon(Icons.security), findsOneWidget);
      });

      testWidgets('TC-011: 潛在覺醒者模式極簡體驗測試', (WidgetTester tester) async {
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: AUTH_buildSleeperModeUI(
              context: tester.element(find.byType(MaterialApp)),
              pageType: AuthPageType.login,
              pageProps: {'child': Container()},
            ),
          ),
        );

        // 驗證極簡標題
        expect(find.text('🌱 輕鬆記帳'), findsOneWidget);
        expect(find.text('簡單開始，輕鬆管理'), findsOneWidget);
        expect(find.byIcon(Icons.eco), findsOneWidget);

        // 驗證友善提示
        expect(find.text('💡 需要幫助嗎？點擊右上角問號'), findsOneWidget);
      });

      testWidgets('TC-012: 模式切換流程測試', (WidgetTester tester) async {
        UserMode? currentMode = UserMode.controller;

        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildModeSelector(
                context: tester.element(find.byType(MaterialApp)),
                selectedMode: currentMode,
                onModeSelected: (mode) {
                  currentMode = mode;
                },
              ),
            ),
          ),
        );

        // 初始Controller模式驗證
        expect(currentMode, equals(UserMode.controller));

        // 切換到Sleeper模式
        await tester.tap(find.text('潛在覺醒者'));
        await tester.pump();

        // 驗證模式切換
        expect(currentMode, equals(UserMode.sleeper));
      });

      testWidgets('TC-013: 模式間視覺差異驗證測試', (WidgetTester tester) async {
        final modeTestCases = {
          UserMode.controller: '精準控制者',
          UserMode.logger: '紀錄習慣者',
          UserMode.struggler: '轉型挑戰者',
          UserMode.sleeper: '潛在覺醒者',
        };

        for (final mode in UserMode.values) {
          await tester.pumpWidget(
            AuthWidgetTestHelpers.createTestWrapper(
              child: Scaffold(
                body: AUTH_buildModeSelector(
                  context: tester.element(find.byType(MaterialApp)),
                  selectedMode: mode,
                  onModeSelected: (selectedMode) {},
                ),
              ),
            ),
          );

          // 驗證模式名稱顯示
          expect(find.text(modeTestCases[mode]!), findsOneWidget);
        }
      });

      testWidgets('TC-014: 模式特定功能選項測試', (WidgetTester tester) async {
        // Controller模式：完整選項
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildOAuthButtons(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.controller,
                onLineLogin: () {},
                onGoogleLogin: () {},
                onAppleLogin: () {},
              ),
            ),
          ),
        );

        expect(find.text('LINE 登入'), findsOneWidget);
        expect(find.text('Google 登入'), findsOneWidget);
        expect(find.text('Apple 登入'), findsOneWidget);

        // Sleeper模式：僅LINE選項
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: Scaffold(
              body: AUTH_buildOAuthButtons(
                context: tester.element(find.byType(MaterialApp)),
                userMode: UserMode.sleeper,
                onLineLogin: () {},
                onGoogleLogin: () {},
                onAppleLogin: () {},
              ),
            ),
          ),
        );

        expect(find.text('LINE 登入'), findsOneWidget);
        expect(find.text('Google 登入'), findsNothing);
        expect(find.text('Apple 登入'), findsNothing);
      });
    });

    // ==================== 輔助函數測試案例 ====================

    group('TC-015 to TC-027: 輔助函數測試', () {
      test('TC-015: 模式顏色獲取函數測試', () {
        expect(_getModeColor(UserMode.controller), equals(const Color(0xFF1976D2)));
        expect(_getModeColor(UserMode.logger), equals(const Color(0xFF6A1B9A)));
        expect(_getModeColor(UserMode.struggler), equals(const Color(0xFFFF6B35)));
        expect(_getModeColor(UserMode.sleeper), equals(const Color(0xFF4CAF50)));
      });

      test('TC-016: 模式圖標獲取函數測試', () {
        expect(_getModeIcon(UserMode.controller), equals(Icons.engineering));
        expect(_getModeIcon(UserMode.logger), equals(Icons.auto_awesome));
        expect(_getModeIcon(UserMode.struggler), equals(Icons.emoji_events));
        expect(_getModeIcon(UserMode.sleeper), equals(Icons.eco));
      });

      test('TC-017: 模式名稱獲取函數測試', () {
        expect(_getModeName(UserMode.controller), equals('精準控制者'));
        expect(_getModeName(UserMode.logger), equals('紀錄習慣者'));
        expect(_getModeName(UserMode.struggler), equals('轉型挑戰者'));
        expect(_getModeName(UserMode.sleeper), equals('潛在覺醒者'));
      });

      test('TC-018: 模式登入標題獲取函數測試', () {
        expect(_getModeLoginTitle(UserMode.controller), equals('精準控制者登入'));
        expect(_getModeLoginTitle(UserMode.logger), equals('紀錄習慣者登入'));
        expect(_getModeLoginTitle(UserMode.struggler), equals('轉型挑戰者登入'));
        expect(_getModeLoginTitle(UserMode.sleeper), equals('潛在覺醒者登入'));
      });

      test('TC-019: 模式登入訊息獲取函數測試', () {
        final controllerMessage = _getModeLoginMessage(UserMode.controller);
        expect(controllerMessage, contains('🎯'));
        expect(controllerMessage, contains('專業記帳'));

        final loggerMessage = _getModeLoginMessage(UserMode.logger);
        expect(loggerMessage, contains('✨'));
        expect(loggerMessage, contains('優雅'));

        final strugglerMessage = _getModeLoginMessage(UserMode.struggler);
        expect(strugglerMessage, contains('💪'));
        expect(strugglerMessage, contains('財務自由'));

        final sleeperMessage = _getModeLoginMessage(UserMode.sleeper);
        expect(sleeperMessage, contains('🌱'));
        expect(sleeperMessage, contains('輕鬆'));
      });

      test('TC-020: 模式註冊標題獲取函數測試', () {
        expect(_getModeRegisterTitle(UserMode.controller), equals('精準控制者註冊'));
        expect(_getModeRegisterTitle(UserMode.logger), equals('紀錄習慣者註冊'));
        expect(_getModeRegisterTitle(UserMode.struggler), equals('轉型挑戰者註冊'));
        expect(_getModeRegisterTitle(UserMode.sleeper), equals('潛在覺醒者註冊'));
      });

      test('TC-021: 模式註冊訊息獲取函數測試', () {
        final controllerRegMsg = _getModeRegistrationMessage(UserMode.controller);
        expect(controllerRegMsg, contains('專業記帳管理'));

        final sleeperRegMsg = _getModeRegistrationMessage(UserMode.sleeper);
        expect(sleeperRegMsg, contains('簡單'));
        expect(sleeperRegMsg, contains('無壓力'));
      });

      test('TC-022: 模式登出訊息獲取函數測試', () {
        final controllerLogoutMsg = _getModeLogoutMessage(UserMode.controller);
        expect(controllerLogoutMsg, contains('快速登出'));
        expect(controllerLogoutMsg, contains('完全登出'));

        final strugglerLogoutMsg = _getModeLogoutMessage(UserMode.struggler);
        expect(strugglerLogoutMsg, contains('💪'));
      });

      test('TC-023: 表單驗證函數測試', () {
        final emailController = TextEditingController();
        final passwordController = TextEditingController();

        // 測試空白表單
        expect(_isFormValid(emailController, passwordController), isFalse);

        // 測試僅Email有值
        emailController.text = 'test@example.com';
        expect(_isFormValid(emailController, passwordController), isFalse);

        // 測試僅密碼有值
        emailController.text = '';
        passwordController.text = 'password123';
        expect(_isFormValid(emailController, passwordController), isFalse);

        // 測試都有值
        emailController.text = 'test@example.com';
        passwordController.text = 'password123';
        expect(_isFormValid(emailController, passwordController), isTrue);

        // 清理
        emailController.dispose();
        passwordController.dispose();
      });

      test('TC-024: 堅持天數獲取函數測試', () {
        final daysCount = _getDaysCount();
        expect(daysCount, isA<int>());
        expect(daysCount, greaterThanOrEqualTo(0));
        expect(daysCount, lessThan(1000));
      });

      testWidgets('TC-025: Email步驟建構函數測試', (WidgetTester tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: _buildEmailStep(
                tester.element(find.byType(MaterialApp)), 
                UserMode.controller, 
                (email) {}, 
                false
              ),
            ),
          ),
        );

        expect(find.byIcon(Icons.email_outlined), findsOneWidget);
        expect(find.text('輸入您的Email地址'), findsOneWidget);
        expect(find.byType(TextFormField), findsOneWidget);
        expect(find.text('發送驗證碼'), findsOneWidget);
      });

      testWidgets('TC-026: 驗證碼步驟建構函數測試', (WidgetTester tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: _buildVerificationStep(
                tester.element(find.byType(MaterialApp)), 
                UserMode.logger, 
                (code) {}, 
                false
              ),
            ),
          ),
        );

        expect(find.byIcon(Icons.security), findsOneWidget);
        expect(find.text('請輸入驗證碼'), findsOneWidget);
        expect(find.text('驗證'), findsOneWidget);
      });

      testWidgets('TC-027: 密碼步驟建構函數測試', (WidgetTester tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: _buildPasswordStep(
                tester.element(find.byType(MaterialApp)), 
                UserMode.sleeper, 
                (password) {}, 
                false
              ),
            ),
          ),
        );

        expect(find.byIcon(Icons.lock_reset), findsOneWidget);
        expect(find.text('設定新密碼'), findsOneWidget);
        expect(find.byType(TextFormField), findsNWidgets(2));
        expect(find.text('完成重設'), findsOneWidget);
      });
    });

    // ==================== 純UI狀態測試案例 ====================

    group('TC-028 to TC-030: 純UI狀態測試', () {
      test('TC-028: UI顯示狀態測試', () {
        final uiState = AuthUiDisplayState();

        // 測試按鈕載入狀態
        uiState.setButtonLoading(true);
        expect(uiState.isButtonLoading, isTrue);

        // 測試UI訊息狀態
        uiState.setUiMessage('操作成功');
        expect(uiState.uiMessage, equals('操作成功'));

        // 測試模式選擇狀態
        uiState.setSelectedMode(UserMode.logger);
        expect(uiState.selectedMode, equals(UserMode.logger));

        // 測試密碼可見性切換
        uiState.togglePasswordVisibility();
        expect(uiState.isPasswordVisible, isTrue);
      });

      test('TC-029: 表單輸入狀態測試', () {
        final formState = AuthFormInputState();

        // 測試輸入控制器獲取
        final emailController = formState.getController('email');
        emailController.text = 'test@example.com';
        expect(emailController.text, equals('test@example.com'));

        // 測試checkbox狀態
        formState.setCheckbox('termsAccepted', true);
        expect(formState.getCheckbox('termsAccepted'), isTrue);

        // 測試表單清理
        formState.clearInputs();
        expect(emailController.text, isEmpty);
        expect(formState.getCheckbox('termsAccepted'), isFalse);

        // 清理
        formState.dispose();
      });

      testWidgets('TC-030: Widget與UI狀態整合測試', (WidgetTester tester) async {
        final uiState = AuthUiDisplayState();

        await tester.pumpWidget(
          ChangeNotifierProvider.value(
            value: uiState,
            child: MaterialApp(
              home: Consumer<AuthUiDisplayState>(
                builder: (context, state, child) {
                  return AUTH_buildWelcomePage(
                    context: context,
                    selectedMode: state.selectedMode,
                    onModeSelected: state.setSelectedMode,
                    onContinue: () {},
                    isLoading: state.isButtonLoading,
                  );
                },
              ),
            ),
          ),
        );

        // 觸發模式選擇
        await tester.tap(find.text('精準控制者'));
        await tester.pump();

        // 驗證UI狀態更新
        expect(uiState.selectedMode, equals(UserMode.controller));
        expect(find.text('精準控制者'), findsOneWidget);
      });
    });

    // ==================== 效能測試案例 ====================

    group('TC-031 to TC-035: 效能測試', () {
      testWidgets('TC-031: Widget建構效能測試', (WidgetTester tester) async {
        final stopwatch = Stopwatch()..start();

        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: AUTH_buildWelcomePage(
              context: tester.element(find.byType(MaterialApp)),
              selectedMode: null,
              onModeSelected: (mode) {},
              onContinue: () {},
            ),
          ),
        );

        stopwatch.stop();
        expect(stopwatch.elapsedMilliseconds, lessThan(50), // 放寬至50ms for CI環境
               reason: 'Widget建構時間應在可接受範圍內');
      });

      testWidgets('TC-032: 狀態更新效能測試', (WidgetTester tester) async {
        final authState = AuthUiDisplayState();

        await tester.pumpWidget(
          ChangeNotifierProvider.value(
            value: authState,
            child: Consumer<AuthUiDisplayState>(
              builder: (context, state, child) {
                return Text(state.selectedMode?.toString() ?? '');
              },
            ),
          ),
        );

        final stopwatch = Stopwatch()..start();
        authState.setSelectedMode(UserMode.controller);
        await tester.pump();
        stopwatch.stop();

        expect(stopwatch.elapsedMilliseconds, lessThan(100),
               reason: '狀態更新回應時間應小於100ms');
      });

      testWidgets('TC-033: 記憶體使用監控測試', (WidgetTester tester) async {
        // 建構複雜Widget
        await tester.pumpWidget(
          AuthWidgetTestHelpers.createTestWrapper(
            child: AUTH_buildLoginPage(
              context: tester.element(find.byType(MaterialApp)),
              userMode: UserMode.controller,
              onLineLogin: () {},
              onGoogleLogin: () {},
              onAppleLogin: () {},
              onEmailLogin: (email, password) {},
              onForgotPassword: () {},
              onRegister: () {},
            ),
          ),
        );

        // 清理Widget
        await tester.pumpWidget(Container());

        // 基本記憶體洩漏檢查：確保Widget能正常清理
        expect(find.byType(Scaffold), findsNothing,
               reason: 'Widget應該被正確清理');
      });
    });
  });
}

// ==================== 模擬輔助函數實作 ====================

// 這些函數在實際專案中會從8601模組匯入
Color _getModeColor(UserMode mode) {
  switch (mode) {
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

IconData _getModeIcon(UserMode mode) {
  switch (mode) {
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

String _getModeLoginTitle(UserMode mode) {
  return '${_getModeName(mode)}登入';
}

String _getModeRegisterTitle(UserMode mode) {
  return '${_getModeName(mode)}註冊';
}

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

bool _isFormValid(TextEditingController emailController, TextEditingController passwordController) {
  return emailController.text.isNotEmpty && passwordController.text.isNotEmpty;
}

int _getDaysCount() {
  return 23; // 模擬值
}

// 模擬步驟建構函數 - 實際專案中會從8601模組匯入
Widget _buildEmailStep(BuildContext context, UserMode userMode, Function(String) onSendCode, bool isLoading) {
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(Icons.email_outlined, size: 64),
      const SizedBox(height: 32),
      const Text('輸入您的Email地址', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
      const SizedBox(height: 48),
      const TextFormField(decoration: InputDecoration(labelText: 'Email')),
      const SizedBox(height: 32),
      ElevatedButton(
        onPressed: isLoading ? null : () => onSendCode('test@example.com'),
        child: const Text('發送驗證碼'),
      ),
    ],
  );
}

Widget _buildVerificationStep(BuildContext context, UserMode userMode, Function(String) onVerifyCode, bool isLoading) {
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(Icons.security, size: 64),
      const SizedBox(height: 32),
      const Text('請輸入驗證碼', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
      const SizedBox(height: 48),
      const TextFormField(decoration: InputDecoration(labelText: '驗證碼')),
      const SizedBox(height: 32),
      ElevatedButton(
        onPressed: isLoading ? null : () => onVerifyCode('123456'),
        child: const Text('驗證'),
      ),
    ],
  );
}

Widget _buildPasswordStep(BuildContext context, UserMode userMode, Function(String) onResetPassword, bool isLoading) {
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Icon(Icons.lock_reset, size: 64),
      const SizedBox(height: 32),
      const Text('設定新密碼', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
      const SizedBox(height: 48),
      const TextFormField(decoration: InputDecoration(labelText: '新密碼'), obscureText: true),
      const SizedBox(height: 16),
      const TextFormField(decoration: InputDecoration(labelText: '確認新密碼'), obscureText: true),
      const SizedBox(height: 32),
      ElevatedButton(
        onPressed: isLoading ? null : () => onResetPassword('newPassword123'),
        child: const Text('完成重設'),
      ),
    ],
  );
}

// 模擬所需的枚舉和類別
enum UserMode { controller, logger, struggler, sleeper }
enum AuthPageType { welcome, login, register, passwordReset, logout }
enum LogoutType { quick, complete }

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

// 模擬主要Widget函數 - 實際專案中會從8601模組匯入
Widget AUTH_buildWelcomePage({
  required BuildContext context,
  UserMode? selectedMode,
  required Function(UserMode) onModeSelected,
  required VoidCallback onContinue,
  bool isLoading = false,
}) {
  return Scaffold(
    body: SafeArea(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('歡迎使用 LCAS 2.0', style: TextStyle(fontSize: 24)),
          const SizedBox(height: 32),
          AUTH_buildModeSelector(
            context: context,
            selectedMode: selectedMode,
            onModeSelected: onModeSelected,
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: selectedMode != null ? onContinue : null,
            child: const Text('開始使用'),
          ),
        ],
      ),
    ),
  );
}

Widget AUTH_buildModeSelector({
  required BuildContext context,
  UserMode? selectedMode,
  required Function(UserMode) onModeSelected,
}) {
  return GridView.count(
    shrinkWrap: true,
    crossAxisCount: 2,
    children: UserMode.values.map((mode) {
      return InkWell(
        onTap: () => onModeSelected(mode),
        child: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            border: Border.all(
              color: selectedMode == mode ? _getModeColor(mode) : Colors.grey,
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(_getModeIcon(mode)),
              Text(_getModeName(mode)),
            ],
          ),
        ),
      );
    }).toList(),
  );
}

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
    appBar: AppBar(title: Text(_getModeLoginTitle(userMode))),
    body: Column(
      children: [
        Text(_getModeLoginMessage(userMode)),
        AUTH_buildOAuthButtons(
          context: context,
          userMode: userMode,
          onLineLogin: onLineLogin,
          onGoogleLogin: onGoogleLogin,
          onAppleLogin: onAppleLogin,
        ),
        if (userMode != UserMode.sleeper) ...[
          const Text('或'),
          AUTH_buildEmailLoginForm(
            context: context,
            userMode: userMode,
            onEmailLogin: onEmailLogin,
            onForgotPassword: onForgotPassword,
          ),
        ],
      ],
    ),
  );
}

Widget AUTH_buildOAuthButtons({
  required BuildContext context,
  required UserMode userMode,
  required VoidCallback onLineLogin,
  required VoidCallback onGoogleLogin,
  required VoidCallback onAppleLogin,
  bool isLoading = false,
}) {
  return Column(
    children: [
      ElevatedButton(onPressed: onLineLogin, child: const Text('LINE 登入')),
      if (userMode != UserMode.sleeper)
        ElevatedButton(onPressed: onGoogleLogin, child: const Text('Google 登入')),
      if (userMode == UserMode.controller)
        ElevatedButton(onPressed: onAppleLogin, child: const Text('Apple 登入')),
    ],
  );
}

Widget AUTH_buildEmailLoginForm({
  required BuildContext context,
  required UserMode userMode,
  required Function(String email, String password) onEmailLogin,
  required VoidCallback onForgotPassword,
  bool isLoading = false,
}) {
  return Form(
    child: Column(
      children: [
        TextFormField(
          decoration: const InputDecoration(labelText: 'Email'),
          validator: (value) {
            if (value == null || value.isEmpty) return 'Email不能為空';
            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
              return 'Email格式不正確';
            }
            return null;
          },
        ),
        TextFormField(
          decoration: const InputDecoration(labelText: '密碼'),
          obscureText: true,
          validator: (value) => value?.isEmpty ?? true ? '密碼不能為空' : null,
        ),
        TextButton(onPressed: onForgotPassword, child: const Text('忘記密碼？')),
        ElevatedButton(
          onPressed: () => onEmailLogin('test@example.com', 'password'),
          child: const Text('登入'),
        ),
      ],
    ),
  );
}

Widget AUTH_buildRegistrationForm({
  required BuildContext context,
  required UserMode userMode,
  required Function(RegistrationData) onRegister,
  bool isLoading = false,
}) {
  return Form(
    child: Column(
      children: [
        TextFormField(decoration: const InputDecoration(labelText: 'Email')),
        TextFormField(decoration: const InputDecoration(labelText: '密碼'), obscureText: true),
        if (userMode != UserMode.sleeper) ...[
          TextFormField(decoration: const InputDecoration(labelText: '確認密碼'), obscureText: true),
          TextFormField(decoration: const InputDecoration(labelText: '顯示名稱')),
        ],
        CheckboxListTile(
          value: false,
          onChanged: (value) {},
          title: const Text('同意服務條款'),
        ),
        CheckboxListTile(
          value: false,
          onChanged: (value) {},
          title: const Text('同意隱私政策'),
        ),
        ElevatedButton(
          onPressed: () => onRegister(AuthWidgetTestHelpers.createTestRegistrationData()),
          child: const Text('註冊'),
        ),
      ],
    ),
  );
}

Widget AUTH_buildControllerModeUI({
  required BuildContext context,
  required AuthPageType pageType,
  required Map<String, dynamic> pageProps,
}) {
  return Container(
    child: Column(
      children: [
        Container(
          color: const Color(0xFF1976D2),
          child: Row(
            children: [
              const Icon(Icons.engineering, color: Colors.white),
              const Text('🎯 精準控制者模式', style: TextStyle(color: Colors.white)),
              IconButton(icon: const Icon(Icons.settings, color: Colors.white), onPressed: () {}),
            ],
          ),
        ),
        Expanded(child: pageProps['child'] ?? Container()),
        Container(
          color: const Color(0xFFE3F2FD),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.security, color: Colors.blue.shade800),
              Text('高安全性模式已啟用', style: TextStyle(color: Colors.blue.shade800)),
            ],
          ),
        ),
      ],
    ),
  );
}

Widget AUTH_buildSleeperModeUI({
  required BuildContext context,
  required AuthPageType pageType,
  required Map<String, dynamic> pageProps,
}) {
  return Container(
    child: Column(
      children: [
        Icon(Icons.eco, size: 64, color: Colors.green.shade600),
        const Text('🌱 輕鬆記帳', style: TextStyle(fontSize: 28)),
        const Text('簡單開始，輕鬆管理', style: TextStyle(fontSize: 18)),
        Expanded(child: pageProps['child'] ?? Container()),
        const Text('💡 需要幫助嗎？點擊右上角問號'),
      ],
    ),
  );
}
