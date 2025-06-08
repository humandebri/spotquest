# Guess-the-Spot アーキテクチャ設計書

## 🔄 最新の作業状況 (2025-06-06)

### メモ
- このアプリは速やかに本番環境で使用されます
- デモデータを入れないこと

### 本日の完了事項
1. **ICPメインネットへのデプロイ完了** ✅
   - Backend (unified): `77fv5-oiaaa-aaaal-qsoea-cai`
   - Frontend: `7yetj-dqaaa-aaaal-qsoeq-cai`
   - https://7yetj-dqaaa-aaaal-qsoeq-cai.icp0.io/

2. **バックエンドの修正** ✅
   - Trie API の互換性問題を修正（dfx v0.27.0対応）
   - photo.mo の`type`フィールドを`notificationType`に変更（予約語回避）
   - 既存canisterへの再インストール（データリセット）

3. **フロントエンドの修正** ✅
   - photoService.tsのIDL定義を修正（PhotoUploadRequest形式）
   - エラー「Record is missing key "latitude"」を解決
   - 環境変数設定（.env）でメインネットcanister IDを設定

### 前回の状態（2025-06-05）
- **フロントエンド**: ViteからExpoに移行完了
- **Metro Bundler問題**: 一時的な回避策あり
- **本番環境への注意**: これは実際に本番環境で提供するサービスです

### 完了したタスク
1. ✅ Vite版フロントエンドからExpo/React Nativeへの完全移行
2. ✅ 全画面の実装：
   - LoginScreen（認証）
   - HomeScreen（ホーム）
   - CameraScreen（カメラ・位置情報）
   - GameScreen（ゲーム選択）
   - GamePlayScreen（ゲームプレイ - 600行以上の包括的実装）
   - GameResultScreen（結果表示）
   - LeaderboardScreen（リーダーボード）
   - ProfileScreen（プロフィール）
3. ✅ ナビゲーション設定（React Navigation）
4. ✅ 状態管理（Zustand）
5. ✅ ICP統合用のpolyfills準備

### 重要な開発方針
- **開発ツール**: Motoko Playground（ブラウザ版）を使用しない
- デモデータは絶対に入れないこと

### レイアウト指針
- nativewindを使用してレイアウトすること

### 2025-06-08 更新事項
1. **管理画面の追加** ✅
   - AdminScreenコンポーネントを作成
   - 管理者権限チェック機能をauthStoreに追加（isAdmin状態）
   - 管理者のPrincipal IDリストで権限管理
   - ナビゲーションに管理画面を追加
   - HomeScreenに管理者用ボタンを条件付きで表示

2. **認証システムの本番対応** ✅
   - 開発用モック認証を完全削除
   - モバイル版でもInternet Identity認証対応（WebBrowser使用）
   - expo-web-browserパッケージを追加

3. **管理機能の実装** ✅
   - ダッシュボード（統計情報表示）
   - ゲーム管理（アクティブ/完了ゲーム）
   - 写真管理（一覧表示、削除機能）
   - ユーザー管理（レピュテーション、BAN機能）
   - システム設定（報酬率、手数料の設定）

### ディレクトリ構造（最新）
```
src/frontend/
├── App.tsx (メインアプリ)
├── App-full.tsx (フルアプリ版)
├── src/
│   ├── screens/ (全画面実装済み)
│   │   ├── HomeScreen.tsx (管理者ボタン追加)
│   │   ├── LoginScreen.tsx
│   │   ├── LoginScreenSimple.tsx
│   │   ├── AdminScreen.tsx (管理画面 - 新規追加)
│   │   ├── CameraScreen.tsx
│   │   ├── GameModeScreen.tsx
│   │   ├── GamePlayScreen.tsx
│   │   ├── GameResultScreen.tsx
│   │   ├── GuessMapScreen.tsx
│   │   ├── LeaderboardScreen.tsx
│   │   ├── PhotoUploadScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── navigation/ 
│   │   └── AppNavigator.tsx (Admin画面を含む)
│   ├── services/ 
│   │   ├── auth.ts (getIdentityメソッド追加)
│   │   ├── admin.ts (管理機能API - 新規追加)
│   │   └── photo.ts
│   ├── store/ 
│   │   └── authStore.ts (isAdmin状態管理追加)
│   └── utils/ 
│       └── polyfills.ts
├── package.json (expo-web-browser追加)
├── metro.config.js
├── babel.config.js
└── .env (メインネット設定)
```

### 管理者設定
管理者のPrincipal IDは`src/store/authStore.ts`の`ADMIN_PRINCIPALS`配列で管理:
```typescript
const ADMIN_PRINCIPALS = [
  'lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe', // Example admin principal
];
```

（以下、既存のドキュメントの残りの部分は省略）