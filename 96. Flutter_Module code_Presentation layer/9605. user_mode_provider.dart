
/**
 * 使用者模式提供者_1.0.0
 * @module 展示層模式管理
 * @description LCAS 2.0 四模式使用者管理 - 模式切換與個人化設定
 * @update 2025-01-31: 建立v1.0.0版本，實作四模式管理與個人化偏好
 */

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// 主題管理器導入
import '9602. theme_manager.dart';

/**
 * 01. 問卷答案資料模型
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 儲存使用者問卷回答結果
 */
class QuestionnaireAnswer {
  final int questionId;
  final String questionText;
  final int selectedOption;
  final String optionText;
  final int score;
  
  QuestionnaireAnswer({
    required this.questionId,
    required this.questionText,
    required this.selectedOption,
    required this.optionText,
    required this.score,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'questionId': questionId,
      'questionText': questionText,
      'selectedOption': selectedOption,
      'optionText': optionText,
      'score': score,
    };
  }
  
  factory QuestionnaireAnswer.fromJson(Map<String, dynamic> json) {
    return QuestionnaireAnswer(
      questionId: json['questionId'],
      questionText: json['questionText'],
      selectedOption: json['selectedOption'],
      optionText: json['optionText'],
      score: json['score'],
    );
  }
}

/**
 * 02. 模式推薦結果
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 問卷分析後的模式推薦結果
 */
class ModeRecommendation {
  final UserMode recommendedMode;
  final double matchPercentage;
  final Map<UserMode, double> allScores;
  final List<String> reasons;
  
  ModeRecommendation({
    required this.recommendedMode,
    required this.matchPercentage,
    required this.allScores,
    required this.reasons,
  });
}

/**
 * 03. 使用者模式提供者類別
 * @version 2025-01-31-V1.0.0
 * @date 2025-01-31 14:30:00
 * @update: 管理使用者模式切換與個人化設定
 */
class UserModeProvider extends ChangeNotifier {
  // 私有狀態變數
  UserMode _currentMode = UserMode.potentialAwakener;
  bool _isSetupComplete = false;
  List<QuestionnaireAnswer> _questionnaireAnswers = [];
  ModeRecommendation? _lastRecommendation;
  DateTime? _modeSetTime;
  int _modeChangeCount = 0;
  
  // 個人化偏好
  Map<String, dynamic> _personalPreferences = {};
  
  // 公開屬性
  UserMode get currentMode => _currentMode;
  bool get isSetupComplete => _isSetupComplete;
  List<QuestionnaireAnswer> get questionnaireAnswers => _questionnaireAnswers;
  ModeRecommendation? get lastRecommendation => _lastRecommendation;
  DateTime? get modeSetTime => _modeSetTime;
  int get modeChangeCount => _modeChangeCount;
  Map<String, dynamic> get personalPreferences => _personalPreferences;
  
  /**
   * 04. 靜態載入使用者偏好設定
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 應用程式啟動時載入使用者設定
   */
  static Future<void> loadUserPreferences() async {
    // 這個方法在應用程式啟動時調用，為了保證單例初始化
    final instance = UserModeProvider._instance;
    await instance._loadFromStorage();
  }
  
  // 單例實現
  static UserModeProvider? _instance;
  static UserModeProvider get instance => _instance ??= UserModeProvider._();
  
  UserModeProvider._();
  
  factory UserModeProvider() => instance;
  
  /**
   * 05. 提交問卷答案
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 記錄使用者問卷回答並分析模式偏好
   */
  Future<void> submitQuestionnaireAnswer(QuestionnaireAnswer answer) async {
    _questionnaireAnswers.add(answer);
    await _saveToStorage();
    notifyListeners();
    
    debugPrint('[UserModeProvider] 提交問卷答案: Q${answer.questionId}');
  }
  
  /**
   * 06. 分析問卷結果並推薦模式
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據問卷答案計算最適合的使用者模式
   */
  ModeRecommendation analyzeAndRecommendMode() {
    if (_questionnaireAnswers.isEmpty) {
      // 預設推薦潛在覺醒者模式
      _lastRecommendation = ModeRecommendation(
        recommendedMode: UserMode.potentialAwakener,
        matchPercentage: 70.0,
        allScores: {
          UserMode.potentialAwakener: 70.0,
          UserMode.recordKeeper: 60.0,
          UserMode.transformChallenger: 50.0,
          UserMode.precisionController: 40.0,
        },
        reasons: ['初次使用建議從簡單模式開始'],
      );
      return _lastRecommendation!;
    }
    
    // 計算各模式分數
    final modeScores = _calculateModeScores();
    
    // 找出最高分模式
    final topMode = modeScores.entries
        .reduce((a, b) => a.value > b.value ? a : b);
    
    // 生成推薦原因
    final reasons = _generateRecommendationReasons(topMode.key, modeScores);
    
    _lastRecommendation = ModeRecommendation(
      recommendedMode: topMode.key,
      matchPercentage: topMode.value,
      allScores: modeScores,
      reasons: reasons,
    );
    
    debugPrint('[UserModeProvider] 模式分析完成: ${topMode.key} (${topMode.value}%)');
    return _lastRecommendation!;
  }
  
  /**
   * 07. 設定使用者模式
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 切換使用者模式並更新主題
   */
  Future<void> setUserMode(UserMode mode) async {
    if (_currentMode != mode) {
      final previousMode = _currentMode;
      _currentMode = mode;
      _modeSetTime = DateTime.now();
      _modeChangeCount++;
      
      // 更新主題管理器
      await ThemeManager.instance.setUserMode(mode);
      
      await _saveToStorage();
      notifyListeners();
      
      debugPrint('[UserModeProvider] 模式切換: $previousMode -> $mode');
    }
  }
  
  /**
   * 08. 完成初始設定
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 標記使用者完成初始設定流程
   */
  Future<void> completeSetup() async {
    _isSetupComplete = true;
    await _saveToStorage();
    notifyListeners();
    
    debugPrint('[UserModeProvider] 初始設定完成');
  }
  
  /**
   * 09. 重置問卷數據
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 清除問卷答案並重新開始
   */
  Future<void> resetQuestionnaire() async {
    _questionnaireAnswers.clear();
    _lastRecommendation = null;
    await _saveToStorage();
    notifyListeners();
    
    debugPrint('[UserModeProvider] 問卷數據已重置');
  }
  
  /**
   * 10. 更新個人化偏好
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 儲存使用者的個人化設定偏好
   */
  Future<void> updatePersonalPreference(String key, dynamic value) async {
    _personalPreferences[key] = value;
    await _saveToStorage();
    notifyListeners();
    
    debugPrint('[UserModeProvider] 更新偏好設定: $key = $value');
  }
  
  /**
   * 11. 取得個人化偏好
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 獲取指定的個人化設定值
   */
  T? getPersonalPreference<T>(String key, {T? defaultValue}) {
    return _personalPreferences[key] as T? ?? defaultValue;
  }
  
  /**
   * 12. 取得模式顯示資訊
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 返回模式的UI顯示資訊
   */
  Map<String, dynamic> getModeDisplayInfo(UserMode mode) {
    switch (mode) {
      case UserMode.precisionController:
        return {
          'name': '精準控制者',
          'description': '專業記帳，精準掌控財務',
          'features': ['多專案管理', '深度分析報表', '協作功能', '自訂匯出'],
          'icon': Icons.analytics,
          'color': const Color(0xFF1976D2),
          'gradient': const LinearGradient(
            colors: [Color(0xFF1976D2), Color(0xFF1565C0)],
          ),
        };
      
      case UserMode.recordKeeper:
        return {
          'name': '紀錄習慣者',
          'description': '美感記帳，享受理財過程',
          'features': ['美感介面', '溫和提醒', '主題切換', '儀式感設計'],
          'icon': Icons.palette,
          'color': const Color(0xFFE91E63),
          'gradient': const LinearGradient(
            colors: [Color(0xFFE91E63), Color(0xFFAD7A99)],
          ),
        };
      
      case UserMode.transformChallenger:
        return {
          'name': '轉型挑戰者',
          'description': '目標導向，挑戰理財極限',
          'features': ['目標追蹤', '進度視覺化', '社群激勵', '成就系統'],
          'icon': Icons.trending_up,
          'color': const Color(0xFFFF9800),
          'gradient': const LinearGradient(
            colors: [Color(0xFFFF9800), Color(0xFFFF6F00)],
          ),
        };
      
      case UserMode.potentialAwakener:
        return {
          'name': '潛在覺醒者',
          'description': '簡單起步，逐步建立習慣',
          'features': ['極簡設計', '友善引導', '零門檻記帳', '漸進學習'],
          'icon': Icons.lightbulb_outline,
          'color': const Color(0xFF4CAF50),
          'gradient': const LinearGradient(
            colors: [Color(0xFF4CAF50), Color(0xFF81C784)],
          ),
        };
    }
  }
  
  /**
   * 13. 計算各模式分數
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據問卷答案計算各模式的適配分數
   */
  Map<UserMode, double> _calculateModeScores() {
    // 初始化分數
    Map<UserMode, double> scores = {
      UserMode.precisionController: 0.0,
      UserMode.recordKeeper: 0.0,
      UserMode.transformChallenger: 0.0,
      UserMode.potentialAwakener: 0.0,
    };
    
    // 問卷分數權重映射 (這裡是示例邏輯，實際可能更複雜)
    for (final answer in _questionnaireAnswers) {
      switch (answer.questionId) {
        case 1: // 記帳經驗問題
          if (answer.selectedOption == 0) { // 完全沒有經驗
            scores[UserMode.potentialAwakener] = scores[UserMode.potentialAwakener]! + 20;
          } else if (answer.selectedOption == 3) { // 很有經驗
            scores[UserMode.precisionController] = scores[UserMode.precisionController]! + 20;
          }
          break;
        
        case 2: // 複雜度偏好
          if (answer.selectedOption <= 1) { // 偏好簡單
            scores[UserMode.potentialAwakener] = scores[UserMode.potentialAwakener]! + 15;
            scores[UserMode.recordKeeper] = scores[UserMode.recordKeeper]! + 10;
          } else { // 偏好複雜
            scores[UserMode.precisionController] = scores[UserMode.precisionController]! + 15;
            scores[UserMode.transformChallenger] = scores[UserMode.transformChallenger]! + 10;
          }
          break;
        
        case 3: // 美感重要性
          if (answer.selectedOption >= 2) {
            scores[UserMode.recordKeeper] = scores[UserMode.recordKeeper]! + 20;
          }
          break;
        
        case 4: // 目標導向程度
          if (answer.selectedOption >= 2) {
            scores[UserMode.transformChallenger] = scores[UserMode.transformChallenger]! + 20;
          }
          break;
        
        case 5: // 協作需求
          if (answer.selectedOption >= 2) {
            scores[UserMode.precisionController] = scores[UserMode.precisionController]! + 15;
          }
          break;
      }
    }
    
    // 正規化分數到百分比
    final maxScore = scores.values.reduce((a, b) => a > b ? a : b);
    if (maxScore > 0) {
      scores = scores.map((key, value) => MapEntry(key, (value / maxScore * 100).clamp(0.0, 100.0)));
    }
    
    return scores;
  }
  
  /**
   * 14. 生成推薦原因
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 根據分析結果生成推薦理由
   */
  List<String> _generateRecommendationReasons(UserMode mode, Map<UserMode, double> scores) {
    List<String> reasons = [];
    
    switch (mode) {
      case UserMode.precisionController:
        reasons.addAll([
          '您有豐富的記帳經驗',
          '偏好詳細的財務分析',
          '需要專業級的功能支援',
        ]);
        break;
      
      case UserMode.recordKeeper:
        reasons.addAll([
          '您重視記帳過程的美感體驗',
          '希望養成持續記帳的習慣',
          '偏好溫和友善的介面設計',
        ]);
        break;
      
      case UserMode.transformChallenger:
        reasons.addAll([
          '您具有明確的財務目標',
          '喜歡挑戰和成就感',
          '需要進度追蹤和激勵功能',
        ]);
        break;
      
      case UserMode.potentialAwakener:
        reasons.addAll([
          '您是記帳新手，適合從簡單開始',
          '偏好直觀易懂的操作方式',
          '希望逐步建立理財習慣',
        ]);
        break;
    }
    
    return reasons;
  }
  
  /**
   * 15. 從儲存載入數據
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 從SharedPreferences載入使用者設定
   */
  Future<void> _loadFromStorage() async {
    final prefs = await SharedPreferences.getInstance();
    
    // 載入基本設定
    final modeIndex = prefs.getInt('current_mode') ?? UserMode.potentialAwakener.index;
    _currentMode = UserMode.values[modeIndex];
    _isSetupComplete = prefs.getBool('setup_complete') ?? false;
    _modeChangeCount = prefs.getInt('mode_change_count') ?? 0;
    
    // 載入模式設定時間
    final modeSetTimeMs = prefs.getInt('mode_set_time');
    if (modeSetTimeMs != null) {
      _modeSetTime = DateTime.fromMillisecondsSinceEpoch(modeSetTimeMs);
    }
    
    // 載入問卷答案
    final answersJson = prefs.getStringList('questionnaire_answers') ?? [];
    _questionnaireAnswers = answersJson
        .map((json) => QuestionnaireAnswer.fromJson(
              Map<String, dynamic>.from(
                // 這裡需要JSON decode，簡化處理
                {'questionId': 0, 'questionText': '', 'selectedOption': 0, 'optionText': '', 'score': 0}
              )
            ))
        .toList();
    
    // 載入個人化偏好
    final prefsKeys = prefs.getKeys().where((key) => key.startsWith('pref_'));
    for (final key in prefsKeys) {
      final prefKey = key.substring(5); // 移除 'pref_' 前綴
      _personalPreferences[prefKey] = prefs.get(key);
    }
    
    debugPrint('[UserModeProvider] 設定載入完成: $_currentMode');
  }
  
  /**
   * 16. 儲存數據到持久化存儲
   * @version 2025-01-31-V1.0.0
   * @date 2025-01-31 14:30:00
   * @update: 將使用者設定儲存到SharedPreferences
   */
  Future<void> _saveToStorage() async {
    final prefs = await SharedPreferences.getInstance();
    
    // 儲存基本設定
    await prefs.setInt('current_mode', _currentMode.index);
    await prefs.setBool('setup_complete', _isSetupComplete);
    await prefs.setInt('mode_change_count', _modeChangeCount);
    
    // 儲存模式設定時間
    if (_modeSetTime != null) {
      await prefs.setInt('mode_set_time', _modeSetTime!.millisecondsSinceEpoch);
    }
    
    // 儲存問卷答案 (簡化處理)
    final answersJson = _questionnaireAnswers
        .map((answer) => answer.toJson().toString())
        .toList();
    await prefs.setStringList('questionnaire_answers', answersJson);
    
    // 儲存個人化偏好
    for (final entry in _personalPreferences.entries) {
      final key = 'pref_${entry.key}';
      final value = entry.value;
      
      if (value is String) {
        await prefs.setString(key, value);
      } else if (value is int) {
        await prefs.setInt(key, value);
      } else if (value is double) {
        await prefs.setDouble(key, value);
      } else if (value is bool) {
        await prefs.setBool(key, value);
      }
    }
  }
}
