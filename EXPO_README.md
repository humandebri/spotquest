# Guess the Spot - Expo Mobile App

React Native（Expo）を使用したGuess the Spotモバイルアプリケーション。

## 🚀 セットアップ

### 前提条件
- Node.js 18.x以上
- npm または yarn
- Expo Go アプリ（iOS/Android）
- iOS開発の場合：Xcode
- Android開発の場合：Android Studio

### インストール

```bash
# frontendディレクトリに移動
cd src/frontend

# 依存関係をインストール
npm install
```

## 📱 開発

### Expo Goで実行（推奨）

```bash
# 開発サーバーを起動
npm start

# または特定のプラットフォーム向けに起動
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web Browser
```

QRコードが表示されたら、スマートフォンのExpo Goアプリでスキャンして実行できます。

### 開発ビルド

```bash
# EAS CLIをインストール
npm install -g eas-cli

# EASにログイン
eas login

# 開発ビルドを作成
eas build --profile development --platform ios
eas build --profile development --platform android
```

## 🔧 主な機能

### ✅ 実装済み機能

1. **位置情報取得（Expo Location）**
   - 高精度GPS追跡
   - リアルタイム位置情報更新
   - iOS/Android両対応

2. **カメラ機能（Expo Camera）**
   - 写真撮影
   - フロント/バックカメラ切り替え
   - 画像ギャラリーアクセス

3. **認証（開発中）**
   - Internet Identity（Web版のみ）
   - モバイル向け認証（計画中）

4. **ゲームプレイ**
   - 地図表示（react-native-maps）
   - 位置推測
   - スコア計算

## 📂 プロジェクト構造

```
src/frontend/
├── App.tsx                 # メインアプリコンポーネント
├── app.json               # Expo設定
├── src/
│   ├── screens/           # 画面コンポーネント
│   │   ├── HomeScreen.tsx
│   │   ├── CameraScreen.tsx
│   │   ├── GameScreen.tsx
│   │   └── ...
│   ├── navigation/        # ナビゲーション設定
│   ├── services/          # APIサービス
│   │   └── auth.ts
│   ├── store/            # 状態管理（Zustand）
│   ├── utils/            # ユーティリティ
│   │   └── polyfills.ts  # ICP統合用ポリフィル
│   └── types/            # TypeScript型定義
└── assets/               # 画像・アイコン
```

## 🔌 ICP統合

### Canister接続設定

```typescript
// .env または expo constants で設定
EXPO_PUBLIC_CANISTER_ID=your-canister-id
EXPO_PUBLIC_HOST=https://ic0.app
EXPO_PUBLIC_IDENTITY_PROVIDER=https://identity.ic0.app
```

### 開発環境でのモック認証

開発中はモック認証が自動的に有効になります：

```typescript
// src/services/auth.ts
if (__DEV__) {
  // モックプリンシパルを使用
}
```

## 🐛 トラブルシューティング

### 位置情報が取得できない場合

1. **iOS**
   - 設定 → プライバシー → 位置情報サービス → オン
   - アプリの権限を「常に許可」または「使用中のみ許可」に設定

2. **Android**
   - 設定 → 位置情報 → オン
   - アプリの権限を許可

3. **Expo Go**
   - Expo Goアプリ自体に位置情報権限を付与

### カメラが動作しない場合

```bash
# キャッシュをクリア
expo start -c
```

### Metro bundlerエラー

```bash
# node_modulesを再インストール
rm -rf node_modules
npm install

# Metroキャッシュをクリア
npx react-native start --reset-cache
```

## 📝 開発のヒント

1. **ホットリロード**
   - シェイクジェスチャーで開発メニューを開く
   - Fast Refreshを有効化

2. **デバッグ**
   - React Native Debuggerを使用
   - console.logはExpoログに表示

3. **パフォーマンス**
   - FlatListを使用してリストを最適化
   - 画像は適切なサイズに圧縮
   - メモ化を活用（React.memo, useMemo）

## 🚀 ビルド＆デプロイ

### プロダクションビルド

```bash
# iOS App Store向け
eas build --platform ios --profile production

# Android Play Store向け
eas build --platform android --profile production
```

### OTAアップデート

```bash
# JavaScriptバンドルのみ更新
eas update --branch production
```

## 📱 テスト

### デバイステスト

```bash
# 実機でテスト
expo run:ios --device
expo run:android --device
```

### E2Eテスト（計画中）

- Detoxを使用予定

## 🤝 貢献

1. Issueを作成
2. フィーチャーブランチを作成
3. プルリクエストを送信

## 📄 ライセンス

MIT License