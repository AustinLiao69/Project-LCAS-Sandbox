
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
