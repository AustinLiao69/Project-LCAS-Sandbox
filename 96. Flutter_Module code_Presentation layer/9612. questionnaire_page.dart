
/**
 * Flutter展示層模組_使用者模式問卷頁面_2.0.0
 * @module 問卷頁面
 * @description 使用者模式分析問卷 - 引導使用者選擇最適合的使用模式
 * @update 2025-01-27: 初版建立，整合問卷邏輯和模式推薦
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '9602. theme_manager.dart';
import '9605. user_mode_provider.dart';
import '9607. common_widgets.dart';

class QuestionnairePage extends StatefulWidget {
  const QuestionnairePage({super.key});

  @override
  State<QuestionnairePage> createState() => _QuestionnairePageState();
}

class _QuestionnairePageState extends State<QuestionnairePage> {
  final PageController _pageController = PageController();
  int _currentQuestionIndex = 0;
  final List<int?> _answers = List.filled(5, null);
  bool _isLoading = false;

  /// 問卷題目與選項
  final List<Map<String, dynamic>> _questions = [
    {
      'id': 1,
      'title': '您的記帳經驗如何？',
      'options': [
        {'text': '完全沒有經驗', 'score': 0},
        {'text': '偶爾記帳', 'score': 1},
        {'text': '有一定經驗', 'score': 2},
        {'text': '非常有經驗', 'score': 3},
      ],
    },
    {
      'id': 2,
      'title': '您偏好什麼樣的介面？',
      'options': [
        {'text': '極簡易用', 'score': 0},
        {'text': '簡潔美觀', 'score': 1},
        {'text': '功能豐富', 'score': 2},
        {'text': '專業複雜', 'score': 3},
      ],
    },
    {
      'id': 3,
      'title': '美感設計對您有多重要？',
      'options': [
        {'text': '不太重要', 'score': 0},
        {'text': '有點重要', 'score': 1},
        {'text': '很重要', 'score': 2},
        {'text': '極其重要', 'score': 3},
      ],
    },
    {
      'id': 4,
      'title': '您是否喜歡設定明確的財務目標？',
      'options': [
        {'text': '不喜歡', 'score': 0},
        {'text': '偶爾設定', 'score': 1},
        {'text': '經常設定', 'score': 2},
        {'text': '總是設定', 'score': 3},
      ],
    },
    {
      'id': 5,
      'title': '您是否需要與他人協作記帳？',
      'options': [
        {'text': '完全不需要', 'score': 0},
        {'text': '偶爾需要', 'score': 1},
        {'text': '經常需要', 'score': 2},
        {'text': '必須協作', 'score': 3},
      ],
    },
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// 選擇答案
  void _selectAnswer(int optionIndex) {
    setState(() {
      _answers[_currentQuestionIndex] = optionIndex;
    });

    // 提交答案到Provider
    final question = _questions[_currentQuestionIndex];
    final option = question['options'][optionIndex];
    
    final answer = QuestionnaireAnswer(
      questionId: question['id'],
      questionText: question['title'],
      selectedOption: optionIndex,
      optionText: option['text'],
      score: option['score'],
    );

    context.read<UserModeProvider>().submitQuestionnaireAnswer(answer);
  }

  /// 下一題
  void _nextQuestion() {
    if (_currentQuestionIndex < _questions.length - 1) {
      setState(() => _currentQuestionIndex++);
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _completeQuestionnaire();
    }
  }

  /// 上一題
  void _previousQuestion() {
    if (_currentQuestionIndex > 0) {
      setState(() => _currentQuestionIndex--);
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  /// 完成問卷
  Future<void> _completeQuestionnaire() async {
    setState(() => _isLoading = true);

    try {
      final userModeProvider = context.read<UserModeProvider>();
      
      // 分析問卷結果
      final recommendation = userModeProvider.analyzeAndRecommendMode();
      
      // 跳轉至模式設定確認頁面
      if (mounted) {
        Navigator.of(context).pushReplacementNamed(
          '/mode-setup',
          arguments: recommendation,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('問卷分析失敗: $e'),
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
    final progress = (_currentQuestionIndex + 1) / _questions.length;
    
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('個人化設定'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.transparent,
        leading: _currentQuestionIndex > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _previousQuestion,
              )
            : null,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 進度條
            _buildProgressBar(theme, progress),
            
            // 問卷內容
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() => _currentQuestionIndex = index);
                },
                itemCount: _questions.length,
                itemBuilder: (context, index) {
                  return _buildQuestionCard(theme, _questions[index], index);
                },
              ),
            ),
            
            // 底部按鈕
            _buildBottomButtons(theme),
          ],
        ),
      ),
    );
  }

  /// 建立進度條
  Widget _buildProgressBar(ThemeData theme, double progress) {
    return Container(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '問題 ${_currentQuestionIndex + 1} / ${_questions.length}',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.textTheme.bodySmall?.color,
                ),
              ),
              Text(
                '${(progress * 100).round()}%',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.primaryColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: progress,
            backgroundColor: theme.primaryColor.withOpacity(0.2),
            valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
          ),
        ],
      ),
    );
  }

  /// 建立問題卡片
  Widget _buildQuestionCard(ThemeData theme, Map<String, dynamic> question, int questionIndex) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 問題標題
          Text(
            question['title'],
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.textTheme.titleLarge?.color,
            ),
          ),
          
          const SizedBox(height: 32),
          
          // 選項列表
          Expanded(
            child: ListView.separated(
              itemCount: question['options'].length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, optionIndex) {
                final option = question['options'][optionIndex];
                final isSelected = _answers[questionIndex] == optionIndex;
                
                return _buildOptionCard(theme, option['text'], optionIndex, isSelected);
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 建立選項卡片
  Widget _buildOptionCard(ThemeData theme, String text, int optionIndex, bool isSelected) {
    return GestureDetector(
      onTap: () => _selectAnswer(optionIndex),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20.0),
        decoration: BoxDecoration(
          color: isSelected 
              ? theme.primaryColor.withOpacity(0.1)
              : theme.cardColor,
          border: Border.all(
            color: isSelected 
                ? theme.primaryColor 
                : theme.dividerColor,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected 
                    ? theme.primaryColor 
                    : Colors.transparent,
                border: Border.all(
                  color: isSelected 
                      ? theme.primaryColor 
                      : theme.dividerColor,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Icon(
                      Icons.check,
                      size: 16,
                      color: Colors.white,
                    )
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                text,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: isSelected 
                      ? theme.primaryColor 
                      : theme.textTheme.bodyLarge?.color,
                  fontWeight: isSelected 
                      ? FontWeight.w600 
                      : FontWeight.normal,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 建立底部按鈕
  Widget _buildBottomButtons(ThemeData theme) {
    final hasAnswer = _answers[_currentQuestionIndex] != null;
    final isLastQuestion = _currentQuestionIndex == _questions.length - 1;
    
    return Container(
      padding: const EdgeInsets.all(24.0),
      child: Row(
        children: [
          // 跳過按鈕
          if (_currentQuestionIndex > 0)
            Expanded(
              child: AppButton.outline(
                onPressed: _previousQuestion,
                child: const Text('上一題'),
              ),
            ),
          
          if (_currentQuestionIndex > 0)
            const SizedBox(width: 16),
          
          // 下一題/完成按鈕
          Expanded(
            flex: 2,
            child: AppButton(
              onPressed: hasAnswer && !_isLoading ? _nextQuestion : null,
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Text(isLastQuestion ? '完成設定' : '下一題'),
            ),
          ),
        ],
      ),
    );
  }
}
/**
 * 使用者模式問卷頁面_1.0.0
 * @module 展示層問卷系統
 * @description LCAS 2.0 使用者模式分析問卷 - 智慧推薦適合的使用模式
 * @update 2025-01-31: 建立v1.0.0版本，實作模式分析問卷與推薦系統
 */

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// 狀態管理導入
import '9605. user_mode_provider.dart';
import '9604. app_state_provider.dart';

// 共用元件導入
import '9607. common_widgets.dart';

// 路由導入
import '9603. app_router.dart';

/**
 * 01. 問卷選項數據模型
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:00:00
 * @update: 問卷選項的數據結構
 */
class QuestionOption {
  final int value;
  final String text;
  final String description;
  final int score;
  final IconData? icon;
  
  const QuestionOption({
    required this.value,
    required this.text,
    required this.description,
    required this.score,
    this.icon,
  });
}

/**
 * 02. 問題數據模型
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:00:00
 * @update: 問卷問題的完整數據結構
 */
class Question {
  final int id;
  final String title;
  final String subtitle;
  final List<QuestionOption> options;
  final IconData? icon;
  final bool isRequired;
  
  const Question({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.options,
    this.icon,
    this.isRequired = true,
  });
}

/**
 * 03. 使用者模式問卷頁面
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 16:00:00
 * @update: 智慧分析使用者習慣並推薦適合模式
 */
class QuestionnairePage extends StatefulWidget {
  const QuestionnairePage({super.key});
  
  @override
  State<QuestionnairePage> createState() => _QuestionnairePageState();
}

class _QuestionnairePageState extends State<QuestionnairePage> {
  final PageController _pageController = PageController();
  final Map<int, int> _answers = {};
  int _currentQuestionIndex = 0;
  bool _isSubmitting = false;
  
  /**
   * 04. 問卷問題定義
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 定義完整的模式分析問卷
   */
  static const List<Question> _questions = [
    Question(
      id: 1,
      title: '您的記帳經驗如何？',
      subtitle: '幫助我們了解您的記帳基礎',
      icon: Icons.timeline,
      options: [
        QuestionOption(
          value: 0,
          text: '從未記帳',
          description: '完全沒有記帳經驗',
          score: 0,
          icon: Icons.help_outline,
        ),
        QuestionOption(
          value: 1,
          text: '偶爾記帳',
          description: '有時會記錄一些重要支出',
          score: 1,
          icon: Icons.access_time,
        ),
        QuestionOption(
          value: 2,
          text: '定期記帳',
          description: '有固定的記帳習慣',
          score: 2,
          icon: Icons.schedule,
        ),
        QuestionOption(
          value: 3,
          text: '專業記帳',
          description: '有豐富的財務管理經驗',
          score: 3,
          icon: Icons.expert_mode,
        ),
      ],
    ),
    Question(
      id: 2,
      title: '您偏好哪種複雜度的工具？',
      subtitle: '選擇符合您使用習慣的介面風格',
      icon: Icons.tune,
      options: [
        QuestionOption(
          value: 0,
          text: '極簡風格',
          description: '只要基本功能，介面越簡單越好',
          score: 0,
          icon: Icons.minimize,
        ),
        QuestionOption(
          value: 1,
          text: '簡潔美觀',
          description: '功能適中，注重視覺美感',
          score: 1,
          icon: Icons.palette,
        ),
        QuestionOption(
          value: 2,
          text: '功能豐富',
          description: '需要較多進階功能',
          score: 2,
          icon: Icons.dashboard,
        ),
        QuestionOption(
          value: 3,
          text: '專業級別',
          description: '需要完整的財務分析工具',
          score: 3,
          icon: Icons.analytics,
        ),
      ],
    ),
    Question(
      id: 3,
      title: '介面美感對您重要嗎？',
      subtitle: '了解您對視覺設計的重視程度',
      icon: Icons.color_lens,
      options: [
        QuestionOption(
          value: 0,
          text: '不重要',
          description: '只要功能正常即可',
          score: 0,
          icon: Icons.functions,
        ),
        QuestionOption(
          value: 1,
          text: '稍微重要',
          description: '希望不要太醜就好',
          score: 1,
          icon: Icons.sentiment_neutral,
        ),
        QuestionOption(
          value: 2,
          text: '很重要',
          description: '美觀的介面讓我更願意使用',
          score: 2,
          icon: Icons.favorite,
        ),
        QuestionOption(
          value: 3,
          text: '極其重要',
          description: '美感是我選擇工具的重要因素',
          score: 3,
          icon: Icons.auto_awesome,
        ),
      ],
    ),
    Question(
      id: 4,
      title: '您是目標導向的人嗎？',
      subtitle: '了解您的理財目標設定習慣',
      icon: Icons.flag,
      options: [
        QuestionOption(
          value: 0,
          text: '隨性生活',
          description: '沒有特定的財務目標',
          score: 0,
          icon: Icons.explore,
        ),
        QuestionOption(
          value: 1,
          text: '偶有計畫',
          description: '有時會設定一些小目標',
          score: 1,
          icon: Icons.bookmark_border,
        ),
        QuestionOption(
          value: 2,
          text: '目標明確',
          description: '有明確的理財規劃',
          score: 2,
          icon: Icons.track_changes,
        ),
        QuestionOption(
          value: 3,
          text: '高度自律',
          description: '嚴格執行財務目標',
          score: 3,
          icon: Icons.military_tech,
        ),
      ],
    ),
    Question(
      id: 5,
      title: '您需要與他人協作記帳嗎？',
      subtitle: '了解您的協作需求',
      icon: Icons.group,
      options: [
        QuestionOption(
          value: 0,
          text: '個人使用',
          description: '只有我一個人記帳',
          score: 0,
          icon: Icons.person,
        ),
        QuestionOption(
          value: 1,
          text: '偶爾分享',
          description: '有時會與家人朋友分享',
          score: 1,
          icon: Icons.share,
        ),
        QuestionOption(
          value: 2,
          text: '家庭記帳',
          description: '需要與家人共同管理',
          score: 2,
          icon: Icons.family_restroom,
        ),
        QuestionOption(
          value: 3,
          text: '團隊協作',
          description: '需要多人協作功能',
          score: 3,
          icon: Icons.groups,
        ),
      ],
    ),
  ];
  
  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('使用者模式分析'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: _currentQuestionIndex > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _goToPreviousQuestion,
              )
            : null,
      ),
      body: Column(
        children: [
          /**
           * 05. 進度指示器
           * @version 2025-01-31-V1.0.0
           * @date 2025-01-31 16:00:00
           * @update: 顯示問卷完成進度
           */
          Container(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '問題 ${_currentQuestionIndex + 1} / ${_questions.length}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                    Text(
                      '${((_currentQuestionIndex + 1) / _questions.length * 100).round()}%',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: (_currentQuestionIndex + 1) / _questions.length,
                  backgroundColor: theme.colorScheme.outline.withOpacity(0.3),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),
          
          /**
           * 06. 問題內容區域
           * @version 2025-01-31-V1.0.0
           * @date 2025-01-31 16:00:00
           * @update: 問卷問題展示區域
           */
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: (index) {
                setState(() {
                  _currentQuestionIndex = index;
                });
              },
              itemCount: _questions.length,
              itemBuilder: (context, index) {
                return _buildQuestionPage(_questions[index]);
              },
            ),
          ),
          
          /**
           * 07. 操作按鈕區域
           * @version 2025-01-31-V1.0.0
           * @date 2025-01-31 16:00:00
           * @update: 問卷導航與提交按鈕
           */
          Container(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                if (_currentQuestionIndex > 0) ...[
                  Expanded(
                    child: LCASButton(
                      text: '上一題',
                      onPressed: _goToPreviousQuestion,
                      isSecondary: true,
                      icon: Icons.chevron_left,
                    ),
                  ),
                  const SizedBox(width: 16),
                ],
                Expanded(
                  child: LCASButton(
                    text: _currentQuestionIndex == _questions.length - 1
                        ? '分析結果'
                        : '下一題',
                    onPressed: _isCurrentQuestionAnswered()
                        ? (_currentQuestionIndex == _questions.length - 1
                            ? _submitQuestionnaire
                            : _goToNextQuestion)
                        : null,
                    isLoading: _isSubmitting,
                    icon: _currentQuestionIndex == _questions.length - 1
                        ? Icons.analytics
                        : Icons.chevron_right,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  /**
   * 08. 建構問題頁面
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 單一問題的完整UI建構
   */
  Widget _buildQuestionPage(Question question) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 問題標題
          LCASCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (question.icon != null) ...[
                  Icon(
                    question.icon,
                    size: 32,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 12),
                ],
                Text(
                  question.title,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  question.subtitle,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 16),
          
          // 選項列表
          ...question.options.map((option) => _buildOptionCard(
            question.id,
            option,
          )).toList(),
        ],
      ),
    );
  }
  
  /**
   * 09. 建構選項卡片
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 單一選項的卡片UI
   */
  Widget _buildOptionCard(int questionId, QuestionOption option) {
    final theme = Theme.of(context);
    final isSelected = _answers[questionId] == option.value;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: isSelected 
            ? theme.colorScheme.primaryContainer
            : theme.colorScheme.surface,
        elevation: isSelected ? 4 : 2,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: () => _selectOption(questionId, option),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: isSelected
                  ? Border.all(
                      color: theme.colorScheme.primary,
                      width: 2,
                    )
                  : Border.all(
                      color: theme.colorScheme.outline.withOpacity(0.3),
                      width: 1,
                    ),
            ),
            child: Row(
              children: [
                if (option.icon != null) ...[
                  Icon(
                    option.icon,
                    color: isSelected
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurface.withOpacity(0.7),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        option.text,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                          color: isSelected
                              ? theme.colorScheme.primary
                              : theme.colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        option.description,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withOpacity(0.7),
                        ),
                      ),
                    ],
                  ),
                ),
                if (isSelected)
                  Icon(
                    Icons.check_circle,
                    color: theme.colorScheme.primary,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
  
  /**
   * 10. 選擇選項
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 處理選項選擇邏輯
   */
  void _selectOption(int questionId, QuestionOption option) {
    setState(() {
      _answers[questionId] = option.value;
    });
    
    // 提交答案到狀態管理
    final question = _questions.firstWhere((q) => q.id == questionId);
    final answer = QuestionnaireAnswer(
      questionId: questionId,
      questionText: question.title,
      selectedOption: option.value,
      optionText: option.text,
      score: option.score,
    );
    
    context.read<UserModeProvider>().submitQuestionnaireAnswer(answer);
    
    // 短暫延遲後自動進入下一題（除了最後一題）
    if (_currentQuestionIndex < _questions.length - 1) {
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          _goToNextQuestion();
        }
      });
    }
  }
  
  /**
   * 11. 檢查當前問題是否已回答
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 驗證問卷完成狀態
   */
  bool _isCurrentQuestionAnswered() {
    final currentQuestion = _questions[_currentQuestionIndex];
    return _answers.containsKey(currentQuestion.id);
  }
  
  /**
   * 12. 前往下一題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 問卷導航控制
   */
  void _goToNextQuestion() {
    if (_currentQuestionIndex < _questions.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }
  
  /**
   * 13. 前往上一題
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 問卷導航控制
   */
  void _goToPreviousQuestion() {
    if (_currentQuestionIndex > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }
  
  /**
   * 14. 提交問卷
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 分析問卷結果並導航到結果頁面
   */
  Future<void> _submitQuestionnaire() async {
    if (_answers.length != _questions.length) {
      _showIncompleteDialog();
      return;
    }
    
    setState(() {
      _isSubmitting = true;
    });
    
    try {
      // 分析問卷結果
      final userModeProvider = context.read<UserModeProvider>();
      final recommendation = userModeProvider.analyzeAndRecommendMode();
      
      // 標記完成狀態
      context.read<AppStateProvider>().setLoadingState(false);
      
      // 導航到模式設定頁面
      if (mounted) {
        AppRouter.pushReplacementNamed(context, '/mode-setup');
      }
      
    } catch (error) {
      debugPrint('[QuestionnairePage] 問卷提交錯誤: $error');
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('分析過程發生錯誤，請重試'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }
  
  /**
   * 15. 顯示未完成對話框
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 16:00:00
   * @update: 提醒使用者完成所有問題
   */
  void _showIncompleteDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('問卷未完成'),
        content: const Text('請回答所有問題後再進行分析。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('我知道了'),
          ),
        ],
      ),
    );
  }
}
