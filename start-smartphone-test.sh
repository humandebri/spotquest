#!/bin/bash

echo "📱 Guess the Spot - スマートフォンテスト用セットアップ"
echo ""

# Kill existing processes
echo "🔄 既存のプロセスを終了中..."
pkill -f expo || true
pkill -f metro || true
pkill -f node || true

# Clear caches
echo "🧹 キャッシュをクリア中..."
cd /Users/0xhude/Desktop/ICP/Guess-the-Spot/src/frontend
rm -rf .expo
rm -rf node_modules/.cache

# Start Expo with clear output
echo ""
echo "🚀 Expoサーバーを起動中..."
echo ""
echo "📱 スマートフォンでテストする方法:"
echo "1. Expo Goアプリをインストール"
echo "2. 下記のQRコードをスキャン"
echo ""

# Start expo with specific host
npx expo start --host localhost --clear