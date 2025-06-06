// 新しいディレクトリでシンプルなExpoアプリを作成

const { execSync } = require('child_process');
const path = require('path');

console.log('Creating simple test app...');

// ディレクトリ作成
const testDir = '/Users/0xhude/Desktop/ICP/Guess-the-Spot/test-app';

try {
  // 新しいExpoアプリを作成
  execSync(`npx create-expo-app test-app --template blank-typescript`, {
    cwd: '/Users/0xhude/Desktop/ICP/Guess-the-Spot',
    stdio: 'inherit'
  });
  
  console.log('✅ Test app created successfully!');
  console.log('📁 Location: ' + testDir);
  console.log('🚀 Run: cd test-app && npm start');
  
} catch (error) {
  console.error('❌ Error creating test app:', error.message);
}