# Guess-the-Spot アーキテクチャ設計書

## 🔄 最新の作業状況 (2025-06-09)

### 本日の完了事項
1. **GameResultScreenのエラー修正** ✅
   - `TypeError: Cannot read property 'length' of undefined`エラーを解決
   - 原因：Animated.Textでの二重interpolationが問題だった
   - 修正：シンプルなTextコンポーネントに変更してスコアを直接表示
   ```typescript
   // 修正前（エラーの原因）
   <Animated.Text style={styles.scoreValue}>
     {scoreAnim.interpolate({...}).interpolate(...)}
   </Animated.Text>
   
   // 修正後
   <Text style={styles.scoreValue}>
     {score || 0}
   </Text>
   ```

2. **ナビゲーションフローの改善** ✅
   - GuessMapScreenが開いたままになる問題を修正
   - `navigation.navigate`から`navigation.replace`に変更
   - 推測送信後にguessをリセットする機能を追加
   ```typescript
   // Reset the guess in the store
   setGameGuess(null, 1000);
   
   // Navigate to GameResult and remove this screen from stack
   navigation.replace('GameResult', resultParams);
   ```

3. **GameResultScreen機能** ✅
   - 地図上に推測地点と実際の撮影位置の両方のピンを表示
   - 2点間の距離をPolylineで表示
   - 距離オーバーレイで距離を明確に表示
   - マップレジェンドで各ピンの意味を説明

4. **UIデザインの維持** ✅
   - ボタンデザインを元のスタイルに戻した
   - ユーザーフィードバック：「ボタンのデザインがダサくなりました」への対応

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

#### フロントエンド構造
```
src/frontend/
├── App.tsx (メインアプリ)
├── App-full.tsx (フルアプリ版)
├── src/
│   ├── screens/ (全画面実装済み)
│   │   ├── HomeScreen.tsx (管理者ボタン追加)
│   │   ├── LoginScreen.tsx
│   │   ├── LoginScreenSimple.tsx
│   │   ├── AdminScreen.tsx (管理画面)
│   │   ├── CameraScreen.tsx
│   │   ├── GameModeScreen.tsx
│   │   ├── GamePlayScreen.tsx (画像パン・ズーム機能)
│   │   ├── GameResultScreen.tsx (エラー修正済み、地図表示改善)
│   │   ├── GameResultScreenSimple.tsx (デバッグ用)
│   │   ├── GuessMapScreen.tsx (ナビゲーション改善)
│   │   ├── LeaderboardScreen.tsx
│   │   ├── PhotoUploadScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── ScheduledPhotosScreen.tsx
│   ├── navigation/ 
│   │   └── AppNavigator.tsx (全画面のナビゲーション設定)
│   ├── services/ 
│   │   ├── auth.ts (Internet Identity統合)
│   │   ├── admin.ts (管理機能API)
│   │   └── photo.ts
│   ├── store/ 
│   │   ├── authStore.ts (isAdmin状態管理)
│   │   └── gameStore.ts (ゲーム状態管理)
│   ├── components/ (共通コンポーネント)
│   ├── utils/ 
│   │   └── polyfills.ts (ICP統合用)
│   └── global.css (NativeWind用)
├── package.json (依存関係)
├── metro.config.js
├── babel.config.js
├── tailwind.config.js (NativeWind設定)
├── nativewind-env.d.ts
└── .env (環境変数)
```

#### プロジェクト全体構造
```
Guess-the-Spot/
├── src/
│   ├── frontend/ (Expo/React Native)
│   ├── backend/
│   │   ├── unified/ (統合Canister)
│   │   ├── game_engine/
│   │   ├── photo_nft/
│   │   ├── reputation_oracle/
│   │   └── reward_mint/
│   └── types/ (共通型定義)
├── dfx.json (ICP設定)
├── package.json
├── CLAUDE.md (このドキュメント)
├── README.md
├── whitepaper.md
└── scripts/ (デプロイスクリプト)
```

### 管理者設定
管理者のPrincipal IDは`src/store/authStore.ts`の`ADMIN_PRINCIPALS`配列で管理:
```typescript
const ADMIN_PRINCIPALS = [
  'lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe', // Example admin principal
];
```

### 技術的な修正詳細

#### GameResultScreenエラーの原因と解決
1. **問題の症状**
   - `Warning: TypeError: Cannot read property 'length' of undefined`
   - GameResultScreenに遷移時に発生
   - 画面が表示されない

2. **デバッグプロセス**
   - MapViewを一時的にコメントアウトして問題を切り分け
   - GameResultScreenSimpleを作成してシンプルな実装でテスト
   - エラーがMapViewではなくAnimated.Textにあることを特定

3. **根本原因**
   - Animated.Valueのinterpolateを二重に呼び出していた
   - 内部的にlengthプロパティを参照する処理でエラー

4. **解決策**
   - Animated.Textを通常のTextコンポーネントに変更
   - スコアを直接表示するシンプルな実装に修正

#### ナビゲーション改善
1. **GuessMapScreenの問題**
   - `navigation.navigate`使用時、画面がスタックに残る
   - ユーザー体験：「開いたままなのでわかりづらかった」

2. **解決策**
   - `navigation.replace`を使用してスタックから削除
   - 推測送信時にguessをリセット

#### 主要な依存関係
- React Native: 0.76.6
- Expo: ~53.0.10
- React Navigation: ^7.0.11
- React Native Maps: 1.18.0
- NativeWind: ^4.0.1
- Zustand: ^5.0.2
- @dfinity/agent: ^2.2.0
- @dfinity/identity: ^2.2.0
- @dfinity/principal: ^2.2.0

### 今後の課題
- [ ] スコア計算ロジックの実装（現在はハードコード）
- [ ] 実際の写真データとの統合
- [ ] パフォーマンス最適化
- [ ] エラーハンドリングの強化