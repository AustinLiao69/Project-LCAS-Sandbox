
/**
 * ValidationUtils_驗證工具類別_1.0.0
 * @module ValidationUtils
 * @description 統一的資料驗證工具函數
 * @update 2025-01-23: 初版建立，提供常用的資料驗證功能
 */

import 'dart:core';

class ValidationUtils {
  // 常用正則表達式
  static final RegExp _emailRegex = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
  );
  
  static final RegExp _phoneRegex = RegExp(
    r'^09\d{8}$'
  );
  
  static final RegExp _passwordRegex = RegExp(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$'
  );
  
  static final RegExp _taiwanIdRegex = RegExp(
    r'^[A-Z][12]\d{8}$'
  );

  /**
   * 01. 驗證是否為空字串或null
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查字串是否為空或null
   */
  static bool isEmpty(String? value) {
    return value == null || value.trim().isEmpty;
  }

  /**
   * 02. 驗證字串長度
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查字串長度是否在指定範圍內
   */
  static bool isValidLength(String? value, {int? minLength, int? maxLength}) {
    if (value == null) return false;
    
    final length = value.length;
    
    if (minLength != null && length < minLength) return false;
    if (maxLength != null && length > maxLength) return false;
    
    return true;
  }

  /**
   * 03. 驗證Email格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查Email格式是否正確
   */
  static bool isValidEmail(String? email) {
    if (isEmpty(email)) return false;
    return _emailRegex.hasMatch(email!.trim());
  }

  /**
   * 04. 驗證手機號碼格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查台灣手機號碼格式是否正確
   */
  static bool isValidPhone(String? phone) {
    if (isEmpty(phone)) return false;
    return _phoneRegex.hasMatch(phone!.trim());
  }

  /**
   * 05. 驗證密碼強度
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查密碼是否符合安全要求
   */
  static bool isValidPassword(String? password) {
    if (isEmpty(password)) return false;
    return _passwordRegex.hasMatch(password!);
  }

  /**
   * 06. 驗證台灣身分證字號
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查台灣身分證字號格式是否正確
   */
  static bool isValidTaiwanId(String? id) {
    if (isEmpty(id)) return false;
    
    final idStr = id!.trim().toUpperCase();
    if (!_taiwanIdRegex.hasMatch(idStr)) return false;
    
    // 台灣身分證字號檢查碼驗證
    const letterMapping = {
      'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15,
      'G': 16, 'H': 17, 'I': 34, 'J': 18, 'K': 19, 'L': 20,
      'M': 21, 'N': 22, 'O': 35, 'P': 23, 'Q': 24, 'R': 25,
      'S': 26, 'T': 27, 'U': 28, 'V': 29, 'W': 32, 'X': 30,
      'Y': 31, 'Z': 33
    };
    
    final firstLetter = idStr[0];
    final letterValue = letterMapping[firstLetter]!;
    
    int sum = (letterValue ~/ 10) + (letterValue % 10) * 9;
    
    for (int i = 1; i < 9; i++) {
      sum += int.parse(idStr[i]) * (9 - i);
    }
    
    final checksum = (10 - (sum % 10)) % 10;
    return checksum == int.parse(idStr[9]);
  }

  /**
   * 07. 驗證數字格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查字串是否為有效數字
   */
  static bool isValidNumber(String? value) {
    if (isEmpty(value)) return false;
    return double.tryParse(value!.trim()) != null;
  }

  /**
   * 08. 驗證整數格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查字串是否為有效整數
   */
  static bool isValidInteger(String? value) {
    if (isEmpty(value)) return false;
    return int.tryParse(value!.trim()) != null;
  }

  /**
   * 09. 驗證金額格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查金額格式是否正確（正數，最多兩位小數）
   */
  static bool isValidAmount(String? amount) {
    if (isEmpty(amount)) return false;
    
    final value = double.tryParse(amount!.trim());
    if (value == null || value < 0) return false;
    
    // 檢查小數位數
    final parts = amount.split('.');
    if (parts.length > 2) return false;
    if (parts.length == 2 && parts[1].length > 2) return false;
    
    return true;
  }

  /**
   * 10. 驗證日期格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查日期字串格式是否正確
   */
  static bool isValidDate(String? date, {String format = 'yyyy-MM-dd'}) {
    if (isEmpty(date)) return false;
    
    try {
      DateTime.parse(date!);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 11. 驗證URL格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查URL格式是否正確
   */
  static bool isValidUrl(String? url) {
    if (isEmpty(url)) return false;
    
    try {
      final uri = Uri.parse(url!.trim());
      return uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https');
    } catch (e) {
      return false;
    }
  }

  /**
   * 12. 驗證科目代碼格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查記帳科目代碼格式是否正確
   */
  static bool isValidSubjectCode(String? code) {
    if (isEmpty(code)) return false;
    
    final codeStr = code!.trim();
    // 科目代碼應為4位數字
    return RegExp(r'^\d{4}$').hasMatch(codeStr);
  }

  /**
   * 13. 驗證使用者名稱格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查使用者名稱格式是否正確
   */
  static bool isValidUsername(String? username) {
    if (isEmpty(username)) return false;
    
    final name = username!.trim();
    // 用戶名稱應為2-20個字元，包含中英文數字底線
    return RegExp(r'^[\u4e00-\u9fa5a-zA-Z0-9_]{2,20}$').hasMatch(name);
  }

  /**
   * 14. 驗證帳本名稱格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查帳本名稱格式是否正確
   */
  static bool isValidLedgerName(String? name) {
    if (isEmpty(name)) return false;
    
    final ledgerName = name!.trim();
    // 帳本名稱應為1-50個字元
    return isValidLength(ledgerName, minLength: 1, maxLength: 50);
  }

  /**
   * 15. 驗證記帳描述格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查記帳描述格式是否正確
   */
  static bool isValidDescription(String? description) {
    if (description == null) return true; // 描述可為空
    
    final desc = description.trim();
    if (desc.isEmpty) return true;
    
    // 描述最多200個字元
    return isValidLength(desc, maxLength: 200);
  }

  /**
   * 16. 驗證預算金額範圍
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查預算金額是否在合理範圍內
   */
  static bool isValidBudgetAmount(String? amount) {
    if (!isValidAmount(amount)) return false;
    
    final value = double.parse(amount!.trim());
    // 預算金額應在1到10億之間
    return value >= 1 && value <= 1000000000;
  }

  /**
   * 17. 驗證記帳金額範圍
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查記帳金額是否在合理範圍內
   */
  static bool isValidEntryAmount(String? amount) {
    if (!isValidAmount(amount)) return false;
    
    final value = double.parse(amount!.trim());
    // 記帳金額應在0.01到1億之間
    return value >= 0.01 && value <= 100000000;
  }

  /**
   * 18. 驗證時區格式
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查時區格式是否正確
   */
  static bool isValidTimezone(String? timezone) {
    if (isEmpty(timezone)) return false;
    
    // 簡單的時區格式驗證，如 Asia/Taipei
    return RegExp(r'^[A-Za-z_]+/[A-Za-z_]+$').hasMatch(timezone!.trim());
  }

  /**
   * 19. 取得Email驗證錯誤訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 取得Email驗證失敗的具體錯誤訊息
   */
  static String? getEmailErrorMessage(String? email) {
    if (isEmpty(email)) {
      return 'Email不能為空';
    }
    
    if (!isValidEmail(email)) {
      return 'Email格式不正確';
    }
    
    return null;
  }

  /**
   * 20. 取得密碼驗證錯誤訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 取得密碼驗證失敗的具體錯誤訊息
   */
  static String? getPasswordErrorMessage(String? password) {
    if (isEmpty(password)) {
      return '密碼不能為空';
    }
    
    if (!isValidLength(password, minLength: 8)) {
      return '密碼至少需要8個字元';
    }
    
    if (!isValidPassword(password)) {
      return '密碼需包含大小寫字母、數字及特殊符號';
    }
    
    return null;
  }

  /**
   * 21. 取得手機號碼驗證錯誤訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 取得手機號碼驗證失敗的具體錯誤訊息
   */
  static String? getPhoneErrorMessage(String? phone) {
    if (isEmpty(phone)) {
      return '手機號碼不能為空';
    }
    
    if (!isValidPhone(phone)) {
      return '請輸入正確的台灣手機號碼格式（09xxxxxxxx）';
    }
    
    return null;
  }

  /**
   * 22. 取得金額驗證錯誤訊息
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 取得金額驗證失敗的具體錯誤訊息
   */
  static String? getAmountErrorMessage(String? amount, {bool isEntry = false}) {
    if (isEmpty(amount)) {
      return '金額不能為空';
    }
    
    if (!isValidNumber(amount)) {
      return '請輸入有效的數字';
    }
    
    final value = double.parse(amount!.trim());
    if (value < 0) {
      return '金額不能為負數';
    }
    
    if (isEntry && !isValidEntryAmount(amount)) {
      return '記帳金額應在0.01到1億之間';
    }
    
    if (!isEntry && !isValidBudgetAmount(amount)) {
      return '預算金額應在1到10億之間';
    }
    
    return null;
  }

  /**
   * 23. 批量驗證
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 批量執行多個驗證規則
   */
  static Map<String, String> validateFields(Map<String, dynamic> fields) {
    final errors = <String, String>{};
    
    fields.forEach((key, value) {
      switch (key) {
        case 'email':
          final error = getEmailErrorMessage(value);
          if (error != null) errors[key] = error;
          break;
          
        case 'password':
          final error = getPasswordErrorMessage(value);
          if (error != null) errors[key] = error;
          break;
          
        case 'phone':
          final error = getPhoneErrorMessage(value);
          if (error != null) errors[key] = error;
          break;
          
        case 'amount':
          final error = getAmountErrorMessage(value, isEntry: true);
          if (error != null) errors[key] = error;
          break;
          
        case 'budget':
          final error = getAmountErrorMessage(value, isEntry: false);
          if (error != null) errors[key] = error;
          break;
      }
    });
    
    return errors;
  }

  /**
   * 24. 清理輸入資料
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 清理和標準化輸入資料
   */
  static String sanitizeInput(String? input) {
    if (input == null) return '';
    
    return input
        .trim() // 移除前後空白
        .replaceAll(RegExp(r'\s+'), ' ') // 多個空白替換為單一空白
        .replaceAll(RegExp(r'[^\w\s\u4e00-\u9fa5@.-]'), ''); // 移除特殊字元（保留中文、英數字、@.-）
  }

  /**
   * 25. 檢查必填欄位
   * @version 2025-01-23-V1.0.0
   * @date 2025-01-23 13:00:00
   * @description 檢查必填欄位是否都已填寫
   */
  static Map<String, String> checkRequiredFields(
    Map<String, dynamic> data, 
    List<String> requiredFields
  ) {
    final errors = <String, String>{};
    
    for (String field in requiredFields) {
      if (!data.containsKey(field) || isEmpty(data[field]?.toString())) {
        errors[field] = '此欄位為必填';
      }
    }
    
    return errors;
  }
}
