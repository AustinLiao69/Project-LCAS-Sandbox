
#!/usr/bin/env dart

/**
 * 測試環境檢查腳本 v1.0.0
 * @description 檢查 Dart 測試環境配置是否正確
 * @version 2025-01-27-V1.0.0
 * @update: 初版建立，用於預防測試環境配置問題
 */

import 'dart:io';
import 'dart:convert';

void main() async {
  print('🔍 開始檢查測試環境配置...\n');

  // 1. 檢查 pubspec.yaml
  await checkPubspecConfiguration();
  
  // 2. 檢查依賴是否安裝
  await checkDependencies();
  
  // 3. 檢查 mock 檔案
  await checkMockFiles();
  
  // 4. 檢查測試檔案語法
  await checkTestFileSyntax();
  
  print('\n✅ 測試環境檢查完成！');
}

Future<void> checkPubspecConfiguration() async {
  print('📋 檢查 pubspec.yaml 配置...');
  
  final pubspecFile = File('pubspec.yaml');
  if (!pubspecFile.existsSync()) {
    print('❌ pubspec.yaml 不存在');
    return;
  }
  
  final content = await pubspecFile.readAsString();
  
  // 檢查是否有重複依賴
  if (content.contains('dependencies:') && content.contains('dev_dependencies:')) {
    final dependencies = RegExp(r'dependencies:\s*\n((?:  .*\n)*)', multiLine: true)
        .firstMatch(content)?.group(1) ?? '';
    final devDependencies = RegExp(r'dev_dependencies:\s*\n((?:  .*\n)*)', multiLine: true)
        .firstMatch(content)?.group(1) ?? '';
    
    if (dependencies.contains('test:') && devDependencies.contains('test:')) {
      print('⚠️  警告：test 套件同時存在於 dependencies 和 dev_dependencies');
    }
  }
  
  // 檢查必要的測試依賴
  final requiredDevDeps = ['test:', 'mockito:', 'build_runner:'];
  for (final dep in requiredDevDeps) {
    if (!content.contains(dep)) {
      print('❌ 缺少必要依賴：$dep');
    } else {
      print('✅ 找到依賴：$dep');
    }
  }
}

Future<void> checkDependencies() async {
  print('\n📦 檢查依賴安裝狀態...');
  
  final result = await Process.run('dart', ['pub', 'deps']);
  if (result.exitCode != 0) {
    print('❌ 依賴檢查失敗：${result.stderr}');
  } else {
    print('✅ 所有依賴已正確安裝');
  }
}

Future<void> checkMockFiles() async {
  print('\n🎭 檢查 Mock 檔案...');
  
  final mockFile = File('8501. 認證服務_test.mocks.dart');
  if (!mockFile.existsSync()) {
    print('⚠️  Mock 檔案不存在，需要執行 build_runner');
    print('   執行：dart pub run build_runner build');
  } else {
    print('✅ Mock 檔案存在');
  }
}

Future<void> checkTestFileSyntax() async {
  print('\n🔍 檢查測試檔案語法...');
  
  final testFile = File('8501. 認證服務_test.dart');
  if (!testFile.existsSync()) {
    print('❌ 測試檔案不存在');
    return;
  }
  
  // 檢查語法
  final result = await Process.run('dart', ['analyze', '8501. 認證服務_test.dart']);
  if (result.exitCode != 0) {
    print('❌ 測試檔案語法錯誤：');
    print(result.stdout);
  } else {
    print('✅ 測試檔案語法正確');
  }
}
