
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
/**
 * 模式設定確認頁面_1.0.0
 * @module 展示層模式設定
 * @description LCAS 2.0 使用者模式設定確認 - 展示推薦結果並確認模式選擇
 * @update 2025-01-31: 建立v1.0.0版本，實作模式推薦結果展示與確認
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// 狀態管理導入
import '9605. user_mode_provider.dart';
import '9604. app_state_provider.dart';
import '9602. theme_manager.dart';

// 共用元件導入
import '9607. common_widgets.dart';

// 路由導入
import '9603. app_router.dart';

/**
 * 01. 模式設定確認頁面
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:30:00
 * @update: 展示問卷分析結果並讓使用者確認模式選擇
 */
class ModeSetupPage extends StatefulWidget {
  const ModeSetupPage({super.key});
  
  @override
  State<ModeSetupPage> createState() => _ModeSetupPageState();
}

class _ModeSetupPageState extends State<ModeSetupPage>
    with TickerProviderStateMixin {
  UserMode? _selectedMode;
  bool _isConfirming = false;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  
  @override
  void initState() {
    super.initState();
    
    // 初始化動畫
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
    
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    ));
    
    // 取得推薦模式
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final recommendation = context.read<UserModeProvider>().lastRecommendation;
      if (recommendation != null) {
        setState(() {
          _selectedMode = recommendation.recommendedMode;
        });
      }
      _animationController.forward();
    });
  }
  
  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return Consumer<UserModeProvider>(
      builder: (context, userModeProvider, child) {
        final recommendation = userModeProvider.lastRecommendation;
        
        if (recommendation == null) {
          return const Scaffold(
            body: LCASLoading(message: '正在分析您的回答...'),
          );
        }
        
        return Scaffold(
          body: SafeArea(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SlideTransition(
                position: _slideAnimation,
                child: Column(
                  children: [
                    /**
                     * 02. 頂部標題區域
                     * @version 2025-01-31-V1.0.0
                     * @date 2025-01-31 16:30:00
                     * @update: 頁面標題與說明
                     */
                    Container(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        children: [
                          Icon(
                            Icons.psychology,
                            size: 64,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '分析完成！',
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '基於您的回答，我們為您推薦最適合的使用模式',
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                    
                    /**
                     * 03. 推薦結果展示
                     * @version 2025-01-31-V1.0.0
                     * @date 2025-01-31 16:30:00
                     * @update: 顯示推薦的使用者模式
                     */
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 24.0),
                        child: Column(
                          children: [
                            _buildRecommendedModeCard(recommendation),
                            const SizedBox(height: 24),
                            _buildAllModesComparison(recommendation),
                            const SizedBox(height: 24),
                            _buildRecommendationReasons(recommendation),
                          ],
                        ),
                      ),
                    ),
                    
                    /**
                     * 04. 操作按鈕區域
                     * @version 2025-01-31-V1.0.0
                     * @date 2025-01-31 16:30:00
                     * @update: 確認與重選按鈕
                     */
                    Container(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        children: [
                          LCASButton(
                            text: '確認使用此模式',
                            onPressed: _selectedMode != null ? _confirmMode : null,
                            isLoading: _isConfirming,
                            icon: Icons.check_circle_outline,
                            width: double.infinity,
                          ),
                          const SizedBox(height: 12),
                          LCASButton(
                            text: '重新選擇模式',
                            onPressed: _showModeSelectionDialog,
                            isSecondary: true,
                            icon: Icons.swap_horiz,
                            width: double.infinity,
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: _retakeQuestionnaire,
                            child: Text(
                              '重新填寫問卷',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
  
  /**
   * 05. 建構推薦模式卡片
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 展示主要推薦的使用者模式
   */
  Widget _buildRecommendedModeCard(ModeRecommendation recommendation) {
    final modeInfo = context.read<UserModeProvider>()
        .getModeDisplayInfo(recommendation.recommendedMode);
    
    return LCASCard(
      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      child: Column(
        children: [
          // 推薦標籤
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              '為您推薦 ${recommendation.matchPercentage.round()}% 匹配',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Theme.of(context).colorScheme.onPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          
          const SizedBox(height: 20),
          
          // 模式圖標和名稱
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: modeInfo['gradient'] as LinearGradient,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(
              modeInfo['icon'] as IconData,
              size: 40,
              color: Colors.white,
            ),
          ),
          
          const SizedBox(height: 16),
          
          Text(
            modeInfo['name'] as String,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          
          const SizedBox(height: 8),
          
          Text(
            modeInfo['description'] as String,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.8),
            ),
            textAlign: TextAlign.center,
          ),
          
          const SizedBox(height: 16),
          
          // 特色功能
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: (modeInfo['features'] as List<String>)
                .map((feature) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        feature,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
  
  /**
   * 06. 建構所有模式比較
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 展示所有模式的適配分數
   */
  Widget _buildAllModesComparison(ModeRecommendation recommendation) {
    final userModeProvider = context.read<UserModeProvider>();
    
    return LCASCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '所有模式適配度',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          
          ...UserMode.values.map((mode) {
            final modeInfo = userModeProvider.getModeDisplayInfo(mode);
            final score = recommendation.allScores[mode] ?? 0.0;
            final isRecommended = mode == recommendation.recommendedMode;
            
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                onTap: () => setState(() => _selectedMode = mode),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _selectedMode == mode
                        ? Theme.of(context).colorScheme.primaryContainer.withOpacity(0.5)
                        : null,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        modeInfo['icon'] as IconData,
                        color: modeInfo['color'] as Color,
                        size: 24,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  modeInfo['name'] as String,
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                if (isRecommended) ...[
                                  const SizedBox(width: 8),
                                  Icon(
                                    Icons.star,
                                    size: 16,
                                    color: Theme.of(context).colorScheme.primary,
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 4),
                            LinearProgressIndicator(
                              value: score / 100,
                              backgroundColor: Theme.of(context).colorScheme.outline.withOpacity(0.3),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                modeInfo['color'] as Color,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '${score.round()}%',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: modeInfo['color'] as Color,
                        ),
                      ),
                      if (_selectedMode == mode)
                        const Icon(Icons.radio_button_checked)
                      else
                        const Icon(Icons.radio_button_unchecked),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ],
      ),
    );
  }
  
  /**
   * 07. 建構推薦原因
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 顯示推薦此模式的具體原因
   */
  Widget _buildRecommendationReasons(ModeRecommendation recommendation) {
    return LCASCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '為什麼推薦這個模式？',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          
          ...recommendation.reasons.asMap().entries.map((entry) {
            final index = entry.key;
            final reason = entry.value;
            
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.onPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      reason,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }
  
  /**
   * 08. 確認模式選擇
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 設定使用者模式並完成初始設定
   */
  Future<void> _confirmMode() async {
    if (_selectedMode == null) return;
    
    setState(() {
      _isConfirming = true;
    });
    
    try {
      final userModeProvider = context.read<UserModeProvider>();
      
      // 設定使用者模式
      await userModeProvider.setUserMode(_selectedMode!);
      
      // 完成初始設定
      await userModeProvider.completeSetup();
      
      // 更新應用狀態
      context.read<AppStateProvider>().setLoadingState(false);
      
      // 導航到主頁面
      if (mounted) {
        AppRouter.pushReplacementNamed(context, '/main');
      }
      
    } catch (error) {
      debugPrint('[ModeSetupPage] 模式確認錯誤: $error');
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('設定過程發生錯誤，請重試'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isConfirming = false;
        });
      }
    }
  }
  
  /**
   * 09. 顯示模式選擇對話框
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 允許使用者手動選擇其他模式
   */
  void _showModeSelectionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('選擇使用模式'),
        content: const Text('您可以選擇任何適合的模式，之後也可以在設定中隨時更改。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              // 在上面的比較區域中選擇即可
            },
            child: const Text('我知道了'),
          ),
        ],
      ),
    );
  }
  
  /**
   * 10. 重新填寫問卷
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:30:00
   * @update: 重置問卷數據並返回問卷頁面
   */
  Future<void> _retakeQuestionnaire() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('重新填寫問卷'),
        content: const Text('這會清除您目前的回答，確定要重新開始嗎？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('確定'),
          ),
        ],
      ),
    );
    
    if (confirmed == true && mounted) {
      // 重置問卷數據
      await context.read<UserModeProvider>().resetQuestionnaire();
      
      // 返回問卷頁面
      AppRouter.pushReplacementNamed(context, '/questionnaire');
    }
  }
}
