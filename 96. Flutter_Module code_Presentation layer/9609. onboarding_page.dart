
/**
 * 使用者導覽頁面_1.0.0
 * @module 展示層導覽頁面
 * @description LCAS 2.0 首次使用者導覽 - 功能介紹與引導流程
 * @update 2025-01-31: 建立v1.0.0版本，實作滑動導覽與功能介紹
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

// 狀態管理導入
import '9604. app_state_provider.dart';
import '9606. app_pages.dart';
import '9607. common_widgets.dart';

/**
 * 01. 導覽頁面資料模型
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:30:00
 * @update: 定義導覽頁面的內容結構
 */
class OnboardingPageData {
  final String title;
  final String subtitle;
  final String description;
  final IconData icon;
  final Color backgroundColor;
  final Color textColor;
  
  const OnboardingPageData({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.icon,
    required this.backgroundColor,
    required this.textColor,
  });
}

/**
 * 02. 導覽頁面類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:30:00
 * @update: 實作多頁面滑動導覽與功能介紹
 */
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

/**
 * 03. 導覽頁面狀態類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:30:00
 * @update: 管理導覽頁面的滑動與進度狀態
 */
class _OnboardingPageState extends State<OnboardingPage> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  
  /**
   * 04. 導覽頁面資料定義
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 定義四個導覽頁面的內容與視覺設計
   */
  static const List<OnboardingPageData> _pages = [
    OnboardingPageData(
      title: '歡迎使用 LCAS 2.0',
      subtitle: '智慧記帳助手',
      description: '全新升級的個人財務管理平台\n智慧分析，簡化記帳，掌控未來',
      icon: Icons.account_balance_wallet,
      backgroundColor: Color(0xFF4CAF50),
      textColor: Colors.white,
    ),
    OnboardingPageData(
      title: '四種使用者模式',
      subtitle: '找到最適合你的記帳方式',
      description: '從簡單入門到專業分析\n潛在覺醒者、紀錄習慣者、轉型挑戰者、精準控制者',
      icon: Icons.people_outline,
      backgroundColor: Color(0xFFE91E63),
      textColor: Colors.white,
    ),
    OnboardingPageData(
      title: '智慧記帳體驗',
      subtitle: '輕鬆記錄每一筆支出',
      description: 'LINE快速記帳、語音輸入、智慧分類\n讓記帳成為生活的一部分',
      icon: Icons.psychology,
      backgroundColor: Color(0xFFFF9800),
      textColor: Colors.white,
    ),
    OnboardingPageData(
      title: '開始你的財務之旅',
      subtitle: '建立專屬於你的記帳習慣',
      description: '透過個性化問卷，為你量身打造\n最符合需求的記帳體驗',
      icon: Icons.rocket_launch,
      backgroundColor: Color(0xFF1976D2),
      textColor: Colors.white,
    ),
  ];

  /**
   * 05. 釋放資源
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 清理頁面控制器資源
   */
  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /**
   * 06. 下一頁處理
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 處理下一頁導航或完成導覽
   */
  void _onNextPressed() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  /**
   * 07. 跳過導覽處理
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 直接跳過導覽流程
   */
  void _onSkipPressed() {
    _completeOnboarding();
  }

  /**
   * 08. 完成導覽流程
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 標記導覽完成並導航到問卷頁面
   */
  void _completeOnboarding() async {
    final appStateProvider = context.read<AppStateProvider>();
    await appStateProvider.completeFirstTimeSetup();
    
    if (mounted) {
      context.go(AppRoutes.questionnaire);
    }
  }

  /**
   * 09. 建構UI
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 渲染導覽頁面界面
   */
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // 主要內容區域
          PageView.builder(
            controller: _pageController,
            onPageChanged: (int page) {
              setState(() {
                _currentPage = page;
              });
            },
            itemCount: _pages.length,
            itemBuilder: (context, index) {
              return _buildPageContent(_pages[index]);
            },
          ),
          
          // 頂部跳過按鈕
          _buildSkipButton(),
          
          // 底部導航區域
          _buildBottomNavigation(),
        ],
      ),
    );
  }

  /**
   * 10. 建構頁面內容
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 渲染單個導覽頁面的內容
   */
  Widget _buildPageContent(OnboardingPageData pageData) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            pageData.backgroundColor,
            pageData.backgroundColor.withOpacity(0.8),
          ],
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(flex: 1),
              
              // 圖示
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(60),
                ),
                child: Icon(
                  pageData.icon,
                  size: 60,
                  color: pageData.textColor,
                ),
              ),
              
              const SizedBox(height: 40),
              
              // 主標題
              Text(
                pageData.title,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: pageData.textColor,
                  height: 1.2,
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 16),
              
              // 副標題
              Text(
                pageData.subtitle,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w500,
                  color: pageData.textColor.withOpacity(0.9),
                  height: 1.3,
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 24),
              
              // 描述文字
              Text(
                pageData.description,
                style: TextStyle(
                  fontSize: 16,
                  color: pageData.textColor.withOpacity(0.8),
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              
              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }

  /**
   * 11. 建構跳過按鈕
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 渲染右上角的跳過按鈕
   */
  Widget _buildSkipButton() {
    return Positioned(
      top: 50,
      right: 20,
      child: TextButton(
        onPressed: _onSkipPressed,
        child: Text(
          '跳過',
          style: TextStyle(
            color: _pages[_currentPage].textColor.withOpacity(0.8),
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  /**
   * 12. 建構底部導航
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 渲染頁面指示器與導航按鈕
   */
  Widget _buildBottomNavigation() {
    return Positioned(
      bottom: 50,
      left: 20,
      right: 20,
      child: Column(
        children: [
          // 頁面指示器
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              _pages.length,
              (index) => _buildPageIndicator(index),
            ),
          ),
          
          const SizedBox(height: 40),
          
          // 導航按鈕
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // 上一頁按鈕
              _currentPage > 0
                  ? TextButton(
                      onPressed: () {
                        _pageController.previousPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        );
                      },
                      child: Text(
                        '上一頁',
                        style: TextStyle(
                          color: _pages[_currentPage].textColor.withOpacity(0.8),
                          fontSize: 16,
                        ),
                      ),
                    )
                  : const SizedBox(width: 60),
              
              // 下一頁/開始按鈕
              ElevatedButton(
                onPressed: _onNextPressed,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: _pages[_currentPage].backgroundColor,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(25),
                  ),
                ),
                child: Text(
                  _currentPage == _pages.length - 1 ? '開始使用' : '下一頁',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /**
   * 13. 建構頁面指示器
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 渲染單個頁面指示點
   */
  Widget _buildPageIndicator(int index) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: _currentPage == index ? 24 : 8,
      height: 8,
      decoration: BoxDecoration(
        color: _currentPage == index
            ? Colors.white
            : Colors.white.withOpacity(0.5),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
