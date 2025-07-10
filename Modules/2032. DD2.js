
/**
 * DD2_資料處理模組_3.0.0
 * @module 資料處理模組
 * @description LCAS 2.0 資料處理模組 - 完全遷移至Firestore資料庫
 * @update 2025-07-09: 升級版本至3.0.0，完全遷移至Firestore，移除Google Sheets依賴，遵循2011模組資料庫結構
 */

/**
 * 99. 定義配置
 */

// 引入 Firebase Admin SDK
const admin = require('firebase-admin');

// 確保 Firebase 已初始化
if (!admin.apps.length) {
  const serviceAccount = require('./Serviceaccountkey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
}

// 取得 Firestore 實例
const db = admin.firestore();

// Node.js 模組依賴
const { v4: uuidv4 } = require("uuid");

// 設定時區為 UTC+8 (Asia/Taipei)
const TIMEZONE = 'Asia/Taipei';

// 模組配置
const DD_CONFIG = {
  DEBUG: false,
  TIMEZONE: TIMEZONE,
  SYNONYM: {
    FUZZY_MATCH_THRESHOLD: 0.7,
    ENABLE_COMPOUND_WORDS: true
  }
};

/**
 * 01. 配置初始化
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 遷移至Firestore配置
 */
function DD_initConfig() {
  console.log('DD2模組配置初始化 - Firestore版本');

  // 確保配置對象存在
  if (!global.DD_CONFIG) {
    global.DD_CONFIG = DD_CONFIG;
  }

  return true;
}

/**
 * 03. 用戶偏好記憶管理 - Firestore版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 11:40:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} userId - 用戶ID
 * @param {string} inputTerm - 輸入詞彙
 * @param {string} selectedSubjectCode - 用戶選擇的科目代碼
 * @param {boolean} isQuery - 是否為查詢操作
 * @returns {object|null} 查詢操作時返回偏好信息，存儲操作時返回null
 */
async function DD_userPreferenceManager(
  userId,
  inputTerm,
  selectedSubjectCode,
  isQuery = false,
) {
  const upId = Utilities.getUuid().substring(0, 8);
  console.log(
    `${isQuery ? "查詢" : "存儲"}用戶偏好: userId=${userId}, term="${inputTerm}" [${upId}]`,
  );

  try {
    if (!userId || !inputTerm) {
      console.log(`用戶ID或輸入詞彙為空 [${upId}]`);
      return null;
    }

    const normalizedTerm = inputTerm.toLowerCase().trim();

    // 使用 users collection 下的 preferences subcollection
    const preferencesRef = db.collection('users').doc(userId).collection('preferences');

    // 查詢模式
    if (isQuery) {
      const snapshot = await preferencesRef
        .where('inputText', '==', normalizedTerm)
        .orderBy('count', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log(
          `找到用戶偏好: ${data.selectedCategory}, 使用次數=${data.count} [${upId}]`,
        );
        return {
          subjectCode: data.selectedCategory,
          count: data.count,
          lastUse: data.lastUse
        };
      }

      console.log(`未找到用戶偏好 [${upId}]`);
      return null;
    }
    // 存儲模式
    else {
      if (!selectedSubjectCode) {
        console.log(`科目代碼為空，無法存儲 [${upId}]`);
        return null;
      }

      // 查找是否已存在記錄
      const existingSnapshot = await preferencesRef
        .where('inputText', '==', normalizedTerm)
        .where('selectedCategory', '==', selectedSubjectCode)
        .limit(1)
        .get();

      const now = admin.firestore.Timestamp.now();

      if (!existingSnapshot.empty) {
        // 更新現有記錄
        const doc = existingSnapshot.docs[0];
        const currentData = doc.data();
        await doc.ref.update({
          count: (currentData.count || 0) + 1,
          lastUse: now
        });
        console.log(
          `更新用戶偏好: "${inputTerm}" -> ${selectedSubjectCode}, 新計數=${(currentData.count || 0) + 1} [${upId}]`,
        );
      } else {
        // 添加新記錄
        await preferencesRef.add({
          inputText: inputTerm,
          selectedCategory: selectedSubjectCode,
          count: 1,
          lastUse: now,
          context: ""
        });
        console.log(
          `新增用戶偏好: "${inputTerm}" -> ${selectedSubjectCode} [${upId}]`,
        );
      }

      return null;
    }
  } catch (error) {
    console.log(`用戶偏好管理錯誤: ${error} [${upId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_writeToLogSheet(
      "ERROR",
      `用戶偏好管理錯誤: ${error}`,
      "同義詞處理",
      userId,
      "USER_PREF_ERROR",
      "DD",
      error.toString(),
      0,
      "DD_userPreferenceManager",
      "DD_userPreferenceManager"
    );
    return null;
  }
}

/**
 * 04. 同義詞學習函數 - Firestore版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 11:45:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} term - 要學習的詞彙
 * @param {string} subjectCode - 對應的科目代碼
 * @param {string} userId - 用戶ID
 * @returns {boolean} 學習是否成功
 */
async function DD_learnSynonym(term, subjectCode, userId) {
  const lsId = Utilities.getUuid().substring(0, 8);
  console.log(
    `學習同義詞: "${term}" -> ${subjectCode}, userId=${userId} [${lsId}]`,
  );

  try {
    if (!term || !subjectCode) {
      console.log(`詞彙或科目代碼為空 [${lsId}]`);
      return false;
    }

    // 拆分科目代碼
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) {
      console.log(`科目代碼格式錯誤: ${subjectCode} [${lsId}]`);
      return false;
    }

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    // 確定使用者的帳本ID
    const ledgerId = userId ? `user_${userId}` : 'ledger_structure_001';

    // 查找對應的科目
    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`找不到對應科目代碼: ${subjectCode} [${lsId}]`);
      await DD_writeToLogSheet(
        "WARNING",
        `找不到對應科目代碼: ${subjectCode}`,
        "同義詞學習",
        userId,
        "",
        "DD",
        "",
        0,
        "DD_learnSynonym",
        "DD_learnSynonym"
      );
      return false;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // 處理同義詞
    const currentSynonyms = data.同義詞 || "";
    const synonymsList = currentSynonyms
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 檢查同義詞是否已存在
    if (
      synonymsList.some(
        (syn) => syn.toLowerCase() === term.toLowerCase().trim(),
      )
    ) {
      console.log(`同義詞已存在: "${term}" [${lsId}]`);
      return true;
    }

    // 添加新同義詞
    synonymsList.push(term.trim());
    const newSynonyms = synonymsList.join(",");

    // 更新科目文檔
    await doc.ref.update({
      同義詞: newSynonyms,
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log(`成功添加同義詞: "${term}" -> ${subjectCode} [${lsId}]`);
    await DD_writeToLogSheet(
      "INFO",
      `成功添加同義詞: "${term}" -> ${subjectCode}`,
      "同義詞學習",
      userId,
      "",
      "DD",
      "",
      0,
      "DD_learnSynonym",
      "DD_learnSynonym"
    );
    return true;

  } catch (error) {
    console.log(`同義詞學習錯誤: ${error} [${lsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_writeToLogSheet(
      "ERROR",
      `同義詞學習錯誤: ${error}`,
      "同義詞處理",
      userId,
      "SYN_LEARN_ERROR",
      "DD",
      error.toString(),
      0,
      "DD_learnSynonym",
      "DD_learnSynonym"
    );
    return false;
  }
}

/**
 * 05. 從Firestore查詢科目代碼
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore查詢科目代碼
 */
async function DD_getSubjectByCode(subjectCode) {
  try {
    if (!subjectCode) return null;

    // 拆分科目代碼 (格式: majorCode-subCode)
    const codeParts = subjectCode.split("-");
    if (codeParts.length !== 2) return null;

    const majorCode = codeParts[0].trim();
    const subCode = codeParts[1].trim();

    const ledgerId = process.env.DEFAULT_LEDGER_ID || 'ledger_structure_001';

    // 查詢Firestore subjects子集合
    const snapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('subjects')
      .where('大項代碼', '==', majorCode)
      .where('子項代碼', '==', subCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      majorCode: data.大項代碼,
      majorName: data.大項名稱,
      subCode: data.子項代碼,
      subName: data.子項名稱,
      synonyms: data.同義詞 || ''
    };

  } catch (error) {
    console.log(`查詢科目代碼失敗: ${error.toString()}`);
    return null;
  }
}

/**
 * 15. 處理用戶消息並提取記帳信息 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore資料庫，移除預設ledgerId依賴
 * @param {string} message - 用戶輸入的消息
 * @param {string} userId - 用戶ID (必須提供，用於確定用戶帳本)
 * @param {string} timestamp - 時間戳 (可選)
 * @param {string} ledgerId - 帳本ID (可選，不提供時使用用戶的預設帳本)
 * @return {Object} 處理結果
 */
async function DD_processUserMessage(message, userId = "", timestamp = "", ledgerId = "") {
  // 1. 生成處理ID
  const msgId = uuidv4().substring(0, 8);

  // 2. 檢查必要參數
  if (!userId) {
    DD_logError(
      `缺少必要的用戶ID [${msgId}]`,
      "訊息處理",
      "",
      "MISSING_USER_ID",
      "每個用戶都需要獨立的帳本",
      "DD_processUserMessage"
    );

    return {
      type: "記帳",
      processed: false,
      reason: "缺少用戶ID",
      processId: msgId,
      errorType: "MISSING_USER_ID",
      errorData: {
        success: false,
        error: "缺少用戶ID",
        errorType: "MISSING_USER_ID",
        message: "記帳失敗: 每個用戶都需要獨立的帳本",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: false
      }
    };
  }

  // 3. 確定帳本ID - 每個用戶獨立帳本
  if (!ledgerId) {
    ledgerId = `ledger_${userId}`;
  }

  // 4. 開始日誌記錄
  DD_logInfo(
    `處理用戶消息: "${message}" (帳本: ${ledgerId})`,
    "訊息處理",
    userId,
    "DD_processUserMessage"
  );
  console.log(
    `DD_processUserMessage: 開始處理用戶訊息 "${message}" [${msgId}]`,
  );

  try {
    // 5. 確保配置初始化
    DD_initConfig();

    // 6. 檢查空訊息
    if (!message || message.trim() === "") {
      DD_logWarning(
        `空訊息 [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage"
      );

      const errorData = {
        success: false,
        error: "空訊息",
        errorType: "EMPTY_MESSAGE",
        message: "記帳失敗: 空訊息",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: 0,
          rawAmount: "0",
          paymentMethod: "",
          timestamp: new Date().getTime(),
        },
        userFriendlyMessage:
          "記帳處理失敗 (VALIDATION_ERROR)：訊息為空\n請重新嘗試或聯繫管理員。",
      };

      return {
        type: "記帳",
        processed: false,
        reason: "空訊息",
        processId: msgId,
        errorType: "EMPTY_MESSAGE",
        errorData: errorData,
      };
    }

    // 7. 清理輸入訊息
    message = message.trim();
    console.log(`DD_processUserMessage: 清理後訊息: "${message}" [${msgId}]`);

    // 8. 解析輸入格式 (這裡需要實作DD_parseInputFormat)
    const parseResult = await DD_parseInputFormat(message, msgId);
    console.log(
      `DD_processUserMessage: DD_parseInputFormat回傳結果: ${JSON.stringify(parseResult)} [${msgId}]`,
    );

    // 9. 檢查解析結果
    if (!parseResult) {
      DD_logWarning(
        `DD_parseInputFormat回傳null，無法解析訊息格式: "${message}" [${msgId}]`,
        "訊息處理",
        userId,
        "DD_processUserMessage"
      );

      const errorData = {
        success: false,
        error: "無法識別記帳意圖",
        errorType: "FORMAT_NOT_RECOGNIZED",
        message: "記帳失敗: 無法識別記帳意圖",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: true,
        partialData: {
          subject: message,
          amount: 0,
          rawAmount: "0",
          paymentMethod: "",
          timestamp: new Date().getTime(),
        },
      };

      return {
        type: "記帳",
        processed: false,
        reason: "無法識別記帳意圖",
        processId: msgId,
        errorType: "FORMAT_NOT_RECOGNIZED",
        errorData: errorData,
      };
    }

    // 10. 提取成功解析的結果
    const subject = parseResult.subject;
    const amount = parseResult.amount;
    const rawAmount = parseResult.rawAmount || String(amount);
    const paymentMethod = parseResult.paymentMethod;

    console.log(
      `DD_processUserMessage: 成功解析基本資訊 - 科目="${subject}", 金額=${amount}, 支付方式=${paymentMethod || "未指定"} [${msgId}]`,
    );

    // 11. 科目匹配處理
    if (subject) {
      console.log(`DD_processUserMessage: 開始科目匹配階段 [${msgId}]`);

      let subjectInfo = null;
      let matchMethod = "unknown";
      let confidence = 0;
      let originalSubject = subject;

      // 11.1 嘗試用戶偏好匹配
      try {
        const userPref = await DD_userPreferenceManager(userId, subject, "", true, ledgerId);
        if (userPref) {
          const prefSubject = await DD_getSubjectByCode(userPref.subjectCode);
          if (prefSubject) {
            subjectInfo = prefSubject;
            matchMethod = "user_preference";
            confidence = 0.9;
            console.log(
              `DD_processUserMessage: 用戶偏好匹配成功 "${subject}" -> ${prefSubject.subName} [${msgId}]`,
            );
          }
        }
      } catch (prefError) {
        console.log(
          `DD_processUserMessage: 用戶偏好匹配錯誤 ${prefError.toString()} [${msgId}]`,
        );
      }

      // 11.2 嘗試精確匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試精確匹配 [${msgId}]`);

        try {
          subjectInfo = await DD_getSubjectCode(subject, ledgerId);

          if (subjectInfo) {
            matchMethod = "exact_match";
            confidence = 1.0;
            console.log(
              `DD_processUserMessage: 精確匹配成功 "${subject}" -> ${subjectInfo.subName} [${msgId}]`,
            );
          }
        } catch (matchError) {
          console.log(
            `DD_processUserMessage: 精確匹配發生錯誤 ${matchError.toString()} [${msgId}]`,
          );
        }
      }

      // 11.3 嘗試模糊匹配
      if (!subjectInfo) {
        console.log(`DD_processUserMessage: 嘗試模糊匹配 [${msgId}]`);

        try {
          const fuzzyThreshold = DD_CONFIG.SYNONYM?.FUZZY_MATCH_THRESHOLD || 0.7;
          const fuzzyMatch = await DD_fuzzyMatch(subject, fuzzyThreshold, ledgerId);

          if (fuzzyMatch && fuzzyMatch.score >= fuzzyThreshold) {
            subjectInfo = fuzzyMatch;
            matchMethod = "fuzzy_match";
            confidence = fuzzyMatch.score;
            console.log(
              `DD_processUserMessage: 模糊匹配成功 "${subject}" -> ${fuzzyMatch.subName}, 相似度=${fuzzyMatch.score.toFixed(2)} [${msgId}]`,
            );
          }
        } catch (fuzzyError) {
          console.log(
            `DD_processUserMessage: 模糊匹配發生錯誤 ${fuzzyError.toString()} [${msgId}]`,
          );
        }
      }

      // 12. 準備回傳結果
      if (subjectInfo) {
        console.log(
          `DD_processUserMessage: 科目匹配完成，準備回傳結果 [${msgId}]`,
        );

        // 12.1 決定收支類型
        let action = "支出"; // 預設為支出

        if (amount < 0) {
          action = "支出";
          console.log(
            `DD_processUserMessage: 檢測到負數金額: ${amount}，設定為支出類型 [${msgId}]`,
          );
        } else {
          // 根據科目大類判斷收支類型 - 以8開頭的為收入，其他為支出
          if (
            subjectInfo.majorCode &&
            subjectInfo.majorCode.toString().startsWith("8")
          ) {
            action = "收入";
          } else {
            action = "支出";
          }
        }

        // 12.2 建構回傳結果
        const remarkText = DD_removeAmountFromText(message, amount) || subject;

        const result = {
          type: "記帳",
          processed: true,
          subject: subject,
          subjectName: subjectInfo.subName,
          majorCode: subjectInfo.majorCode,
          majorName: subjectInfo.majorName,
          subCode: subjectInfo.subCode,
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          action: action,
          confidence: confidence,
          matchMethod: matchMethod,
          text: remarkText,
          originalSubject: originalSubject,
          processId: msgId,
          ledgerId: ledgerId, // 新增：包含帳本ID
        };

        console.log(
          `DD_processUserMessage: 回傳結果: ${JSON.stringify(result)} [${msgId}]`,
        );
        return result;
      } else {
        // 12.3 科目匹配失敗處理
        console.log(`DD_processUserMessage: 科目匹配失敗 [${msgId}]`);

        const errorData = {
          success: false,
          error: `無法識別科目: "${subject}"`,
          errorType: "UNKNOWN_SUBJECT",
          message: `記帳失敗: 無法識別科目: "${subject}"`,
          errorDetails: {
            processId: msgId,
            errorType: "VALIDATION_ERROR",
            module: "DD2",
          },
          isRetryable: true,
          partialData: {
            subject: subject,
            amount: amount,
            rawAmount: rawAmount,
            paymentMethod: paymentMethod,
            timestamp: new Date().getTime(),
          },
        };

        return {
          type: "記帳",
          processed: false,
          reason: `無法識別科目: "${subject}"`,
          processId: msgId,
          errorType: "UNKNOWN_SUBJECT",
          errorData: errorData,
        };
      }
    } else {
      // 13. 科目缺失處理
      console.log(`DD_processUserMessage: 科目為空 [${msgId}]`);

      const errorData = {
        success: false,
        error: "未指定科目",
        errorType: "MISSING_SUBJECT",
        message: "記帳失敗: 未指定科目",
        errorDetails: {
          processId: msgId,
          errorType: "VALIDATION_ERROR",
          module: "DD2",
        },
        isRetryable: true,
        partialData: {
          subject: "",
          amount: amount,
          rawAmount: rawAmount,
          paymentMethod: paymentMethod,
          timestamp: new Date().getTime(),
        },
      };

      return {
        type: "記帳",
        processed: false,
        reason: "未指定科目",
        processId: msgId,
        errorType: "MISSING_SUBJECT",
        errorData: errorData,
      };
    }
  } catch (error) {
    // 14. 異常處理
    console.log(`DD_processUserMessage異常: ${error.toString()} [${msgId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);

    DD_logError(
      `處理用戶消息時發生異常: ${error.toString()}`,
      "訊息處理",
      userId,
      "PROCESS_ERROR",
      error.toString(),
      "DD_processUserMessage"
    );

    const errorData = {
      success: false,
      error: error.toString(),
      errorType: "PROCESS_ERROR",
      message: `記帳失敗: 處理異常: ${error.toString()}`,
      errorDetails: {
        processId: msgId,
        errorType: "SYSTEM_ERROR",
        module: "DD2",
      },
      isRetryable: false,
    };

    return {
      type: "記帳",
      processed: false,
      reason: error.toString(),
      processId: msgId,
      errorType: "PROCESS_ERROR",
      errorData: errorData,
    };
  }
}

/**
 * 16. 查詢科目代碼表的函數 - Firestore版本
 * @version 2025-07-09-V3.0.0
 * @date 2025-07-09 16:00:00
 * @update: 完全重寫，使用Firestore查詢科目代碼表
 * @param {string} subjectName - 要查詢的科目名稱
 * @param {string} ledgerId - 帳本ID (可選)
 * @returns {object|null} - 如果找到，返回包含科目資訊的物件，否則返回 null
 */
async function DD_getSubjectCode(subjectName, ledgerId = "") {
  const scId = uuidv4().substring(0, 8);
  console.log(`### 使用Firestore版本DD_getSubjectCode ###`);
  console.log(`查詢科目代碼: "${subjectName}", ID=${scId}`);

  try {
    // 檢查參數
    if (!subjectName) {
      console.log(`科目名稱為空 [${scId}]`);
      DD_logWarning(
        `科目名稱為空，無法查詢科目代碼 [${scId}]`,
        "科目查詢",
        "",
        "DD_getSubjectCode"
      );
      return null;
    }

    // 使用預設帳本ID (如果未提供)
    if (!ledgerId) {
      ledgerId = process.env.DEFAULT_LEDGER_ID || 'ledger_structure_001';
    }

    // 標準化輸入科目名稱
    const normalizedInput = String(subjectName).trim();
    const inputLower = normalizedInput.toLowerCase();
    console.log(`標準化後的輸入: "${normalizedInput}" [${scId}]`);

    // 從Firestore查詢科目表
    const snapshot = await db.collection('ledgers')
      .doc(ledgerId)
      .collection('subjects')
      .where('isActive', '==', true)
      .get();

    if (snapshot.empty) {
      console.log(`科目表為空 [${scId}]`);
      DD_logError(
        `科目表為空 [${scId}]`,
        "科目查詢",
        "",
        "EMPTY_SUBJECTS",
        "科目代碼表無數據",
        "DD_getSubjectCode"
      );
      return null;
    }

    console.log(`讀取科目表: ${snapshot.size}筆數據 [${scId}]`);

    // 詳細診斷日誌
    console.log(`---科目查詢診斷信息開始---[${scId}]`);
    console.log(`尋找科目: "${normalizedInput}"`);

    // ===== 第一階段：進行精確匹配 =====
    console.log(`正在進行精確匹配查詢...`);

    let docCount = 0;
    for (const doc of snapshot.docs) {
      if (doc.id === 'template') continue; // 跳過template文件

      const data = doc.data();
      docCount++;

      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
      const synonymsStr = data.同義詞 || "";

      // 標準化表內科目名稱
      const normalizedSubName = String(subName).trim();
      const subNameLower = normalizedSubName.toLowerCase();

      // 記錄查詢過程（前10行及關鍵行）
      if (docCount < 10 || normalizedSubName === normalizedInput) {
        console.log(
          `科目表項目 #${docCount}: 代碼=${majorCode}-${subCode}, 名稱="${normalizedSubName}"`,
        );
      }

      // 精確匹配檢查
      if (subNameLower === inputLower) {
        console.log(`找到精確匹配: "${subNameLower}" === "${inputLower}"`);

        DD_logInfo(
          `成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
          "科目查詢",
          "",
          "DD_getSubjectCode"
        );
        console.log(`---科目查詢診斷信息結束---[${scId}]`);

        return {
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        };
      }

      // 同義詞匹配
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");

        for (let j = 0; j < synonyms.length; j++) {
          const normalizedSynonym = synonyms[j].trim();
          const synonymLower = normalizedSynonym.toLowerCase();

          if (synonymLower === inputLower) {
            console.log(
              `通過同義詞匹配成功: "${synonymLower}" === "${inputLower}"`,
            );

            DD_logInfo(
              `通過同義詞成功查詢科目代碼: ${majorCode}-${subCode} ${normalizedSubName} [${scId}]`,
              "科目查詢",
              "",
              "DD_getSubjectCode"
            );
            console.log(`---科目查詢診斷信息結束---[${scId}]`);

            return {
              majorCode: String(majorCode),
              majorName: String(majorName),
              subCode: String(subCode),
              subName: String(subName),
            };
          }
        }
      }
    }

    // ===== 第二階段: 複合詞匹配 =====
    console.log(`精確匹配失敗，嘗試複合詞匹配...`);

    const matches = [];

    for (const doc of snapshot.docs) {
      if (doc.id === 'template') continue;

      const data = doc.data();
      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
      const synonymsStr = data.同義詞 || "";
      const subNameLower = String(subName).toLowerCase().trim();

      // 檢查科目名是否包含在輸入中
      if (subNameLower.length >= 2 && inputLower.includes(subNameLower)) {
        const score = subNameLower.length / inputLower.length;
        console.log(
          `複合詞包含科目名: 輸入="${inputLower}" 包含科目="${subNameLower}" 分數=${score.toFixed(2)}`,
        );
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
          score: score,
          matchType: "compound_name",
        });
      }

      // 檢查同義詞是否包含在輸入中
      if (synonymsStr) {
        const synonyms = synonymsStr.split(",");
        for (const syn of synonyms) {
          const synonym = syn.trim().toLowerCase();

          if (synonym.length >= 2 && inputLower.includes(synonym)) {
            const score = synonym.length / inputLower.length;
            console.log(
              `複合詞包含同義詞: 輸入="${inputLower}" 包含同義詞="${synonym}" 分數=${score.toFixed(2)}`,
            );
            matches.push({
              majorCode: String(majorCode),
              majorName: String(majorName),
              subCode: String(subCode),
              subName: String(subName),
              score: score,
              matchType: "compound_synonym",
            });
          }
        }
      }
    }

    // 如果找到複合詞匹配，返回最佳匹配
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];

      console.log(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}, 匹配類型=${bestMatch.matchType}`,
      );
      DD_logInfo(
        `複合詞匹配成功: "${normalizedInput}" -> "${bestMatch.subName}", 分數=${bestMatch.score.toFixed(2)}`,
        "複合詞匹配",
        "",
        "DD_getSubjectCode"
      );

      return {
        majorCode: bestMatch.majorCode,
        majorName: bestMatch.majorName,
        subCode: bestMatch.subCode,
        subName: bestMatch.subName,
      };
    }

    // 如果所有匹配都失敗，才返回null
    console.log(`找不到科目: "${normalizedInput}" [${scId}]`);
    DD_logWarning(
      `科目代碼查詢失敗: "${normalizedInput}" [${scId}]`,
      "科目查詢",
      "",
      "DD_getSubjectCode"
    );
    console.log(`---科目查詢診斷信息結束---[${scId}]`);
    return null;
  } catch (error) {
    console.log(`科目查詢出錯: ${error} [${scId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `科目查詢出錯: ${error} [${scId}]`,
      "科目查詢",
      "",
      "QUERY_ERROR",
      error.toString(),
      "DD_getSubjectCode"
    );
    return null;
  }
}

// 格式化時間函數
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// 時間戳轉換函數
function DD_convertTimestamp(timestamp) {
  const tsId = uuidv4().substring(0, 8);
  console.log(`開始轉換時間戳: ${timestamp} [${tsId}]`);

  try {
    if (timestamp === null || timestamp === undefined) {
      console.log(`時間戳為空 [${tsId}]`);
      return null;
    }

    let date;

    if (typeof timestamp === "number" || /^\d+$/.test(timestamp)) {
      date = new Date(Number(timestamp));
    } else if (typeof timestamp === "string" && timestamp.includes("T")) {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) {
      console.log(`無法轉換為有效日期: ${timestamp} [${tsId}]`);
      return null;
    }

    // 轉換為台灣時區
    const taiwanDate = formatDate(date);
    const taiwanTime = formatTime(date);

    const result = {
      date: taiwanDate,
      time: taiwanTime,
    };

    console.log(`時間戳轉換結果: ${taiwanDate} ${taiwanTime} [${tsId}]`);
    return result;
  } catch (error) {
    console.log(`時間戳轉換錯誤: ${error.toString()} [${tsId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    return null;
  }
}

/**
 * 35. 修復版模糊匹配函數 - 優化複合詞處理，支持異步調用
 * @version 2025-07-09-V4.3.0
 * @author AustinLiao69
 * @param {string} input - 用戶輸入的字符串
 * @param {number} threshold - 匹配閾值
 * @param {string} userId - 用戶ID，用於獲取用戶專屬科目
 * @return {Object|null} 匹配結果或null
 */
async function DD_fuzzyMatch(input, threshold = 0.6, userId = null) {
  if (!input) return null;

  // 日誌記錄
  console.log(`【模糊匹配】開始處理: "${input}", 閾值: ${threshold}, 用戶: ${userId || "預設"}`);

  const inputLower = input.toLowerCase().trim();

  // 獲取所有科目 - 使用用戶專屬帳本
  const ledgerId = userId ? `user_${userId}` : null;
  const allSubjects = await DD_getAllSubjects(ledgerId);
  if (!allSubjects || !allSubjects.length) {
    console.log(`【模糊匹配】無法獲取科目列表`);
    return null;
  }

  console.log(`【模糊匹配】科目列表項目數: ${allSubjects.length}`);

  // ===== 最關鍵的修改：優先處理複合詞 =====
  // 檢測輸入(如"家鄉便當")是否包含任何同義詞(如"便當")
  const containsMatches = [];

  allSubjects.forEach((subject) => {
    // 檢查是否包含科目名
    const subNameLower = subject.subName.toLowerCase();
    if (subNameLower.length >= 2 && inputLower.includes(subNameLower)) {
      const score = (subNameLower.length / inputLower.length) * 0.9;
      containsMatches.push({
        ...subject,
        score: Math.min(0.9, score),
        matchType: "input_contains_subject_name",
        matchedTerm: subNameLower,
      });
      console.log(
        `【模糊匹配】輸入包含科目名: ${inputLower} 包含 ${subNameLower}, 分數=${score.toFixed(2)}`,
      );
    }

    // 檢查是否包含同義詞
    if (subject.synonyms) {
      const synonymsList = subject.synonyms
        .split(",")
        .map((syn) => syn.trim().toLowerCase());

      for (const synonym of synonymsList) {
        // 只考慮長度>=2的同義詞，避免單字符誤匹配
        if (synonym.length >= 2 && inputLower.includes(synonym)) {
          const score = (synonym.length / inputLower.length) * 0.95;
          containsMatches.push({
            ...subject,
            score: Math.min(0.95, score),
            matchType: "input_contains_synonym",
            matchedTerm: synonym,
          });
          console.log(
            `【模糊匹配】輸入包含同義詞: ${inputLower} 包含 ${synonym}, 分數=${score.toFixed(2)}`,
          );
        }
      }
    }
  });

  // 如果找到輸入包含科目名或同義詞的匹配
  if (containsMatches.length > 0) {
    // 按分數排序，取最佳匹配
    containsMatches.sort((a, b) => b.score - a.score);
    const bestMatch = containsMatches[0];

    console.log(
      `【模糊匹配】複合詞最佳匹配: "${input}" -> "${bestMatch.subName}", 包含詞: "${bestMatch.matchedTerm}", 分數: ${bestMatch.score.toFixed(2)}`,
    );

    return {
      majorCode: bestMatch.majorCode,
      majorName: bestMatch.majorName,
      subCode: bestMatch.subCode,
      subName: bestMatch.subName,
      synonyms: bestMatch.synonyms,
      score: bestMatch.score,
      matchType: bestMatch.matchType,
    };
  }

  // 標準匹配邏輯 - 保留原有的其他匹配方法
  const matches = [];

  // 1. 直接包含關係匹配
  allSubjects.forEach((subject) => {
    const subNameLower = subject.subName.toLowerCase();

    // 科目名稱包含輸入詞
    if (subNameLower.includes(inputLower)) {
      const score = (inputLower.length / subNameLower.length) * 0.95;
      matches.push({
        ...subject,
        score: Math.min(0.95, score),
        matchType: "contains_match",
      });
    }

    // 檢查同義詞
    if (subject.synonyms) {
      const synonymsList = subject.synonyms
        .split(",")
        .map((s) => s.trim().toLowerCase());

      for (const synonym of synonymsList) {
        // 同義詞包含輸入
        if (synonym.includes(inputLower)) {
          const score = (inputLower.length / synonym.length) * 0.98;
          matches.push({
            ...subject,
            score: Math.min(0.98, score),
            matchType: "synonym_contains",
            matchedSynonym: synonym,
          });
        }
      }
    }
  });

  // 2. Levenshtein距離匹配
  if (matches.length === 0) {
    allSubjects.forEach((subject) => {
      const subNameLower = subject.subName.toLowerCase();

      const distance = calculateLevenshteinDistance(inputLower, subNameLower);
      const maxLength = Math.max(inputLower.length, subNameLower.length);
      const similarityScore = 1 - distance / maxLength;

      if (similarityScore >= threshold) {
        matches.push({
          ...subject,
          score: similarityScore * 0.9,
          matchType: "levenshtein_name",
        });
      }

      // 同樣檢查同義詞的相似度
      if (subject.synonyms) {
        const synonymsList = subject.synonyms
          .split(",")
          .map((s) => s.trim().toLowerCase());

        for (const synonym of synonymsList) {
          const synDistance = calculateLevenshteinDistance(inputLower, synonym);
          const synMaxLength = Math.max(inputLower.length, synonym.length);
          const synSimilarity = 1 - synDistance / synMaxLength;

          if (synSimilarity >= threshold) {
            matches.push({
              ...subject,
              score: synSimilarity * 0.95,
              matchType: "levenshtein_synonym",
              matchedSynonym: synonym,
            });
          }
        }
      }
    });
  }

  // 如果有匹配結果，返回最佳匹配
  if (matches.length > 0) {
    matches.sort((a, b) => b.score - a.score);
    const bestMatch = matches[0];
    bestMatch.score = parseFloat(bestMatch.score.toFixed(2));

    console.log(
      `【模糊匹配】標準匹配成功: "${input}" -> "${bestMatch.subName}" (分數: ${bestMatch.score}, 類型: ${bestMatch.matchType})`,
    );
    return bestMatch;
  }

  // 沒有匹配，返回null
  console.log(`【模糊匹配】無匹配結果: "${input}"`);
  return null;
}

/**
 * 37. 時間感知分類函數 - 根據時間戳判斷最可能的科目類別
 * @param {Array} possibleMatches - 可能的科目匹配結果
 * @param {string} timestamp - 時間戳
 * @returns {object} 最可能的科目匹配
 */
function DD_timeAwareClassification(possibleMatches, timestamp) {
  const tacId = Utilities.getUuid().substring(0, 8);
  console.log(
    `開始時間感知分類，有 ${possibleMatches ? possibleMatches.length : 0} 個可能匹配 [${tacId}]`,
  );

  try {
    if (!possibleMatches || possibleMatches.length === 0) {
      console.log(`無可能匹配項目 [${tacId}]`);
      return null;
    }

    // 只有一個匹配結果時直接返回
    if (possibleMatches.length === 1) {
      console.log(`僅有一個匹配結果，無需時間判斷 [${tacId}]`);
      return possibleMatches[0];
    }

    let hour;
    try {
      // 嘗試解析時間戳
      hour = new Date(Number(timestamp)).getHours();
      if (isNaN(hour)) {
        console.log(`時間戳無效，無法進行時間感知分類 [${tacId}]`);
        return possibleMatches[0]; // 回退到第一個匹配
      }
      console.log(`當前時間: ${hour}時 [${tacId}]`);
    } catch (timeError) {
      console.log(`時間戳解析失敗: ${timeError}, 使用默認匹配 [${tacId}]`);
      return possibleMatches[0]; // 回退到第一個匹配
    }

    // 時段定義
    const timeRanges = {
      breakfast: {
        range: [5, 10],
        names: ["早餐", "早點", "早午餐"],
        priority: 0.9,
      },
      lunch: {
        range: [11, 14],
        names: ["午餐", "中餐", "便當", "午飯"],
        priority: 0.9,
      },
      dinner: {
        range: [17, 21],
        names: ["晚餐", "晚飯", "宵夜"],
        priority: 0.9,
      },
      midnight: {
        range: [22, 4],
        names: ["宵夜", "消夜", "夜宵"],
        priority: 0.8,
      },
    };

    // 確定當前時段
    let currentTimeSlot = null;
    for (const [slot, config] of Object.entries(timeRanges)) {
      const [start, end] = config.range;
      if (
        (start <= end && hour >= start && hour <= end) ||
        (start > end && (hour >= start || hour <= end))
      ) {
        currentTimeSlot = slot;
        console.log(`當前時段: ${currentTimeSlot} [${tacId}]`);
        break;
      }
    }

    if (currentTimeSlot) {
      // 搜尋最匹配當前時段的科目
      for (const match of possibleMatches) {
        const subject = (match.subName || "").toLowerCase();
        const matchNames = timeRanges[currentTimeSlot].names;

        // 檢查科目名稱是否包含當前時段的關鍵字
        if (
          matchNames.some((keyword) => subject.includes(keyword.toLowerCase()))
        ) {
          console.log(
            `找到時段匹配: ${match.subName} 匹配時段 ${currentTimeSlot} [${tacId}]`,
          );
          DD_logInfo(
            `時間感知分類: "${match.subName}" 匹配當前時段 ${currentTimeSlot}`,
            "時間感知",
            "",
            "DD_timeAwareClassification",
          );
          return {
            ...match,
            confidence: timeRanges[currentTimeSlot].priority,
            timeBaseMatched: true,
          };
        }
      }
    }

    // 如果沒有找到時段匹配，返回第一個匹配結果並降低信心度
    console.log(
      `無時段匹配結果，使用第一個匹配: ${possibleMatches[0].subName} [${tacId}]`,
    );
    DD_logDebug(
      `無時段匹配結果，使用第一個匹配: ${possibleMatches[0].subName}`,
      "時間感知",
      "",
      "DD_timeAwareClassification",
    );
    return { ...possibleMatches[0], confidence: 0.7 };
  } catch (error) {
    console.log(`時間感知分類錯誤: ${error} [${tacId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    DD_logError(
      `時間感知分類錯誤: ${error}`,
      "同義詞處理",
      "",
      "TIME_CLASS_ERROR",
      error.toString(),
      "DD_timeAwareClassification",
    );
    return possibleMatches[0]; // 發生錯誤時回退到第一個匹配
  }
}

/**
 * 38. 檢查詞彙是否有多個匹配 - Firestore版本
 * @version 2025-07-09-V2.1.0
 * @date 2025-07-09 12:00:00
 * @update: 完全遷移至Firestore，移除Google Sheets依賴
 * @param {string} term - 需要檢查的詞彙
 * @param {string} userId - 用戶ID
 * @returns {Array|null} - 匹配結果數組，如果沒有匹配則返回null
 */
async function DD_checkMultipleMapping(term, userId = null) {
  const mmId = Utilities.getUuid().substring(0, 8);
  console.log(`檢查詞彙多重映射: "${term}", 用戶: ${userId || "預設"} [${mmId}]`);

  try {
    if (!term) {
      console.log(`輸入詞彙為空 [${mmId}]`);
      return null;
    }

    const normalizedTerm = term.toLowerCase().trim();

    // 確定使用者的帳本ID
    const ledgerId = userId ? `user_${userId}` : 'ledger_structure_001';

    const subjectsRef = db.collection('ledgers').doc(ledgerId).collection('subjects');
    const snapshot = await subjectsRef.where('isActive', '==', true).get();

    if (snapshot.empty) {
      console.log(`沒有找到任何科目資料 [${mmId}]`);
      return null;
    }

    let matches = [];

    // 檢查每個科目
    snapshot.forEach(doc => {
      // 跳過template文件
      if (doc.id === 'template') return;

      const data = doc.data();
      const majorCode = data.大項代碼;
      const majorName = data.大項名稱;
      const subCode = data.子項代碼;
      const subName = data.子項名稱;
      const synonyms = (data.同義詞 || "").split(",").map((s) => s.trim());

      // 檢查科目名稱精確匹配
      if (String(subName).toLowerCase().trim() === normalizedTerm) {
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        });
      }

      // 檢查同義詞
      if (synonyms.some((syn) => syn.toLowerCase().trim() === normalizedTerm)) {
        matches.push({
          majorCode: String(majorCode),
          majorName: String(majorName),
          subCode: String(subCode),
          subName: String(subName),
        });
      }
    });

    if (matches.length > 0) {
      console.log(`詞彙 "${term}" 有 ${matches.length} 個映射 [${mmId}]`);
      await DD_logInfo(
        `詞彙 "${term}" 有 ${matches.length} 個映射`,
        "多重映射",
        userId || "",
        "DD_checkMultipleMapping",
      );
      return matches;
    } else {
      console.log(`詞彙 "${term}" 沒有映射 [${mmId}]`);
      return null;
    }
  } catch (error) {
    console.log(`檢查多重映射錯誤: ${error} [${mmId}]`);
    if (error.stack) console.log(`錯誤堆疊: ${error.stack}`);
    await DD_logError(
      `檢查多重映射錯誤: ${error}`,
      "同義詞處理",
      userId || "",
      "MULTI_MAP_ERROR",
      error.toString(),
      "DD_checkMultipleMapping",
    );
    return null;
  }
}

// calculateLevenshteinDistance 函數 (用於支援模糊匹配)
function calculateLevenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  let matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[len1][len2];
}


// 模組匯出
module.exports = {
  DD_processUserMessage,
  DD_getSubjectCode,
  DD_removeAmountFromText,
  DD_getAllSubjects,
  DD_userPreferenceManager,
  DD_fuzzyMatch,
  DD_convertTimestamp,
  DD_parseInputFormat,
  DD_initConfig,
  DD_log,
  DD_logDebug,
  DD_logInfo,
  DD_logWarning,
  DD_logError,
  DD_logCritical,
  formatDate,
  formatTime,
  calculateLevenshteinDistance,
  DD_CONFIG
};