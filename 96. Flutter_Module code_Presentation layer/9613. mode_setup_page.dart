
/**
 * Flutter展示層模組_模式設定確認頁面_2.0.0
 * @module 模式設定確認頁面
 * @description 使用者模式推薦結果展示與確認 - 讓使用者確認或修改推薦的模式
 * @update 2025-01-27: 初版建立，整合模式推薦展示和確認流程
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '9602. theme_manager.dart';
import '9605. user_mode_provider.dart';
import '9607. common_widgets.dart';

class ModeSetupPage extends StatefulWidget {
  final ModeRecommendation? recommendation;
  
  const ModeSetupPage({
    super.key,
    this.recommendation,
  });

  @override
  State<ModeSetupPage> createState() => _ModeSetupPageState();
}

class _ModeSetupPageState extends State<ModeSetupPage> with TickerProviderStateMixin {
  late TabController _tabController;
  UserMode? _selectedMode;
  bool _isLoading = false;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _selectedMode = widget.recommendation?.recommendedMode ?? UserMode.potentialAwakener;
    
    // 設定推薦模式的Tab為初始選中
    final modeIndex = UserMode.values.indexOf(_selectedMode!);
    _tabController.index = modeIndex;
    
    // 動畫設定
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _slideAnimation = Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
    );
    
    _animationController.forward();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  /// 確認模式選擇
  Future<void> _confirmModeSelection() async {
    if (_selectedMode == null) return;
    
    setState(() => _isLoading = true);

    try {
      final userModeProvider = context.read<UserModeProvider>();
      
      // 設定使用者模式
      await userModeProvider.setUserMode(_selectedMode!);
      
      // 完成設定流程
      await userModeProvider.completeSetup();
      
      if (mounted) {
        // 顯示成功訊息
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('已設定為${_getModeDisplayInfo(_selectedMode!)['name']}模式'),
            backgroundColor: Colors.green,
          ),
        );
        
        // 跳轉至主頁面
        Navigator.of(context).pushNamedAndRemoveUntil('/main', (route) => false);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('設定失敗: $e'),
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

  /// 重新進行問卷
  void _retakeQuestionnaire() {
    Navigator.of(context).pushReplacementNamed('/questionnaire');
  }

  /// 取得模式顯示資訊
  Map<String, dynamic> _getModeDisplayInfo(UserMode mode) {
    return context.read<UserModeProvider>().getModeDisplayInfo(mode);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
            child: Column(
              children: [
                // 標題區域
                _buildHeader(theme),
                
                // 推薦結果展示
                if (widget.recommendation != null)
                  _buildRecommendationResult(theme),
                
                // 模式選擇Tab
                _buildModeSelector(theme),
                
                // 模式詳情展示
                Expanded(
                  child: _buildModeDetails(theme),
                ),
                
                // 底部按鈕
                _buildBottomButtons(theme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// 建立標題區域
  Widget _buildHeader(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          Icon(
            Icons.psychology,
            size: 60,
            color: theme.primaryColor,
          ),
          const SizedBox(height: 16),
          Text(
            '選擇您的模式',
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.textTheme.titleLarge?.color,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '根據您的回答，我們為您推薦了最適合的模式',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodySmall?.color,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  /// 建立推薦結果展示
  Widget _buildRecommendationResult(ThemeData theme) {
    final recommendation = widget.recommendation!;
    final recommendedModeInfo = _getModeDisplayInfo(recommendation.recommendedMode);
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
      padding: const EdgeInsets.all(20.0),
      decoration: BoxDecoration(
        gradient: recommendedModeInfo['gradient'],
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: recommendedModeInfo['color'].withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.recommend,
                color: Colors.white,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(
                '為您推薦',
                style: theme.textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(
                recommendedModeInfo['icon'],
                color: Colors.white,
                size: 32,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      recommendedModeInfo['name'],
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      '${recommendation.matchPercentage.round()}% 符合',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withOpacity(0.9),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 建立模式選擇器
  Widget _buildModeSelector(ThemeData theme) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24.0),
      child: TabBar(
        controller: _tabController,
        onTap: (index) {
          setState(() {
            _selectedMode = UserMode.values[index];
          });
        },
        isScrollable: true,
        labelColor: theme.primaryColor,
        unselectedLabelColor: theme.textTheme.bodySmall?.color,
        indicatorColor: theme.primaryColor,
        tabs: UserMode.values.map((mode) {
          final modeInfo = _getModeDisplayInfo(mode);
          return Tab(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(modeInfo['icon'], size: 20),
                const SizedBox(height: 4),
                Text(
                  modeInfo['name'],
                  style: const TextStyle(fontSize: 12),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  /// 建立模式詳情展示
  Widget _buildModeDetails(ThemeData theme) {
    return TabBarView(
      controller: _tabController,
      children: UserMode.values.map((mode) {
        final modeInfo = _getModeDisplayInfo(mode);
        final isRecommended = mode == widget.recommendation?.recommendedMode;
        
        return Container(
          margin: const EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 模式卡片
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24.0),
                  decoration: BoxDecoration(
                    gradient: modeInfo['gradient'],
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: modeInfo['color'].withOpacity(0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            modeInfo['icon'],
                            color: Colors.white,
                            size: 40,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      modeInfo['name'],
                                      style: theme.textTheme.headlineSmall?.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (isRecommended) ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withOpacity(0.2),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          '推薦',
                                          style: theme.textTheme.bodySmall?.copyWith(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  modeInfo['description'],
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: Colors.white.withOpacity(0.9),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 24),
                
                // 特色功能
                Text(
                  '特色功能',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                ...modeInfo['features'].map<Widget>((feature) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Icon(
                        Icons.check_circle,
                        color: modeInfo['color'],
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          feature,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                )).toList(),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  /// 建立底部按鈕
  Widget _buildBottomButtons(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        children: [
          // 確認按鈕
          AppButton(
            onPressed: _isLoading ? null : _confirmModeSelection,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text('確認選擇'),
          ),
          
          const SizedBox(height: 12),
          
          // 重新測試按鈕
          AppButton.outline(
            onPressed: _isLoading ? null : _retakeQuestionnaire,
            child: const Text('重新測試'),
          ),
        ],
      ),
    );
  }
}
