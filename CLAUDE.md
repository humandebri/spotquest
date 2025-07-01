# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SpotQuest** is a photo-based location guessing game running on the Internet Computer Protocol (ICP). It's a React Native + Expo mobile application where users guess photo locations to earn SPOT tokens.

## Development Guidelines

- 作業を行った際はキリのいいところで必ずclaude.mdに行った作業の要約を記録して引き継ぎすること

## Guidelines for AI Interaction

- 回答は日本語で行なってください

## Scoring System (重要)

### スコアリングシステムの整理
現在、ゲーム内で異なるスケールのスコアが混在しており、バグの原因となっています：

1. **ゲームスコア（ユーザー向け）**:
   - 1ラウンド = 最大5000点
   - 5ラウンドのゲーム = 最大25000点（5000点 × 5）
   - フロントエンドで表示される点数

2. **バックエンド内部スコア（現状）**:
   - 内部的に1ラウンド最大100点で計算
   - これが変換エラーやEloレーティング計算のバグを引き起こしている
   - 写真の平均スコアもこの100点スケールで保存されている

3. **Eloレーティングシステム**:
   - 標準的なEloレーティング（初期値1500）を使用
   - 現在、プレイヤースコアと写真平均スコアのスケールが異なるため正しく比較できていない
   - このスケールの不一致により、全てのゲームが「引き分け」と判定されている

### 重要な問題:
- `submitGuess`では5000点満点のスコアをEloレーティングに渡している
- しかし写真の平均スコアは100点満点ベースで保存されている
- 例：プレイヤーが3000点を取った場合、写真の平均が60点だと、3000 > 60となり常に「勝利」と判定される

### 推奨事項:
**システム全体で1ラウンド5000点満点に統一する**ことで、変換エラーを避け、コードの保守性を向上させる。

## Architecture

### Key Components

1. **Frontend**: React Native + Expo mobile app
   - Entry point: `src/frontend/App.tsx`
   - Navigation: React Navigation v6 (Native Stack) via `AppNavigator.tsx`
   - State management: Zustand stores (`gameStore.ts`, `iiAuthStore.ts`)
   - Services: Singleton pattern for canister communication (`photoV2.ts`, `game.ts`)
   - Screen structure: Organized by feature (`game/`, `photo/`, `user/`, `auth/`)
   - Maps: React Native Maps with Google provider for location services

2. **Backend**: Motoko unified canister on ICP
   - Main canister: `src/backend/unified/main.mo` (single canister with all functionality)
   - Modules: `src/backend/unified/modules/` (modular code organization)
   - Photo storage: V2 stable memory with chunk-based upload
   - Game sessions: 5-round games with region filtering support

3. **Authentication**:
   - Production: Internet Identity via `expo-ii-integration`
   - Dev mode: Ed25519KeyIdentity (fixed test principal for consistency)
   - All services require proper identity verification with `verifyQuerySignatures: true`

## Development Commands

### Frontend (React Native/Expo)

```bash
# Navigate to frontend directory
cd src/frontend

# Install dependencies
npm install --legacy-peer-deps

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Build for web
npm run build:web

# Fix TypeScript errors
npx tsc --noEmit

# Clear Expo cache
npx expo start -c

# Update dependencies
npm update --legacy-peer-deps
```

### Backend (ICP Canisters)

```bash
# Deploy to mainnet (データを保持したままアップグレード)
dfx deploy unified --network ic

# ⚠️ 重要: --mode reinstall は使用しない！
# 決して deployの際に --mode reinstallでcanisterを再インストールしないでください
# これは全てのデータ（ゲーム履歴、写真、トークンバランス等）を削除します

# Check canister status
dfx canister --network ic status unified

# View canister logs
dfx canister --network ic logs unified
```

### Deployment Notes
- deployは必ずupgradeモードで行なってください
- mainnetでデプロイ後、`dfx generate unified`でIDLファイルを更新すること
- 新しいAPIを追加した場合は、`src/frontend/src/services/game.ts`のIDL定義も更新が必要

## Key Technical Details

### Photo Storage System (V2)
- Chunk-based upload system for large photos
- Photos stored in stable memory with automatic migration from legacy storage
- Maximum photo size: 10MB (configurable in Constants.mo)
- Chunk size: 1MB per chunk
- Upload flow: `createPhotoV2` → `uploadPhotoChunkV2` (multiple) → `finalizePhotoUploadV2`

### Game Mechanics
- Distance scoring: `Sd = 1 - (d - 25m) / (1000m - 25m)`
- Azimuth scoring: `Sφ = 1 - φ / 30°`
- Final score: `Score = 100 × Sd^1.3 × Sφ^0.7`
- Rewards calculated based on score with minimum threshold of 10 points

### Rating System
- Users can rate photos after playing them (difficulty, interest, beauty)
- Rate limiting: 20 ratings per hour per user
- Anonymous users cannot rate
- Users cannot rate their own photos
- Ratings stored in stable memory with aggregation

### Token Economy
- SPOT tokens (ICRC-1 compliant)
- Initial supply: 10,000,000 SPOT
- Rewards distributed from treasury based on game performance
- Photo uploaders receive rewards when their photos are played

## Important Patterns

### Service Initialization
All frontend services follow singleton pattern and require initialization with identity:
```typescript
await gameService.init(identity);
```

### Error Handling
- Network errors are handled gracefully with fallback values
- Dev mode provides mock responses for network failures
- All canister calls use try-catch with proper error logging

### State Management
- Game state managed by Zustand (`gameStore.ts`)
- Authentication state in `iiAuthStore.ts`
- Services maintain their own initialization state

### Photo Metadata Structure
Photos include GPS coordinates, azimuth, title, description, difficulty, hint, region tags, and aggregated ratings.

## Security Considerations
- All photo uploads require GPS and azimuth data verification
- Rate limiting on all user actions (uploads, ratings, game sessions)
- Reputation system tracks user behavior with auto-ban for suspicious activity
- Principal-based authentication for all actions
- Photo quality scoring to filter low-quality uploads

## Troubleshooting Common Issues

1. **"Cannot find required field" errors**: Run `dfx generate unified` after backend changes
2. **Authentication failures**: Clear Expo cache and restart the app
3. **Photo upload failures**: Check chunk size limits and network connectivity
4. **Missing ratings**: Ensure user has played the photo in a completed session

## Module Dependencies

Backend modules are organized with clear separation:
- `TokenModule`: ICRC-1 token management
- `GameEngineModule`: Core game logic and session management
- `PhotoModuleV2`: Photo storage and retrieval
- `RatingModule`: Photo rating system
- `ReputationModule`: User reputation tracking
- `TreasuryModule`: Token distribution management
- `EloRatingModule`: Elo rating system for players and photos

## Recent Changes (2024-01-25)

### Cleanup of Unused Files
The following unused files were removed to clean up the codebase:
- Backend: Removed `ii_integration` canister (functionality integrated into unified canister)
- Backend: Removed backup files in `unified/backups/`
- Frontend: Removed unused test and debug files (TestApp.tsx, DebugApp.tsx, etc.)
- Frontend: Removed unused authentication contexts (DirectAuthContext, DirectIIAuthContext)
- Frontend: Removed unused utility files and scripts
- Types: Removed legacy type definitions

Note: `EloRatingModule.mo` and `frontend-vite-backup/` were preserved for future use.

## Recent Changes (2025-01-24)

### セキュリティ強化とレーティングシステムの実装

1. **写真レーティングシステムのセキュリティ強化**
   - `RatingModule.mo`に以下のセキュリティ機能を追加:
     - 匿名プリンシパル（Anonymous principal）のレーティング制限
     - 写真所有者による自分の写真へのレーティング制限
     - 写真の存在確認
     - レート制限を1時間あたり20回に拡張
   - フロントエンドでエラーハンドリングを改善

2. **ユーザー統計表示の追加**
   - `PhotoDetailsScreen.tsx`にユーザー統計を追加:
     - 平均レーティング（難易度、興味、美しさ）
     - 平均ゲームスコア
     - 平均プレイ時間
   - `getUserRatingStats`関数を実装してユーザーのレーティング統計を取得

3. **Eloレーティングシステムの実装**
   - `EloRatingModule.mo`を完全実装:
     - プレイヤーとフォトの双方向レーティング計算
     - 動的K係数（レーティングレベルに応じて32/24/16）
     - 勝敗判定（±2%の閾値で引き分け判定）
     - レーティング範囲: 100-3000
   - `submitGuess`でゲーム結果に基づいてレーティングを即座に更新
   - `finalizeSession`でのレーティング計算を削除（重複回避）

4. **フロントエンドの改善**
   - `HomeScreen.tsx`:
     - Eloレーティングの表示を追加
     - ランク表示を写真数とレーティングの間に配置
     - NaN表示の修正
   - `PhotoDetailsScreen.tsx`:
     - 写真のEloレーティング表示
     - 平均スコアとプレイ回数の表示
   - `LeaderboardScreen.tsx`:
     - グローバルランキングをベストスコア順からEloレーティング順に変更
     - `getEloLeaderboardWithStats`を実装
     - ランキング表示をEloレーティングベースに更新

5. **バグ修正**
   - `averageDuration`フィールドの欠落エラーを修正
   - 重複した`getPlayerStats` IDL定義を修正
   - ランクとEloレーティングがnull/undefinedになる問題を修正

### 技術的な詳細

**Eloレーティング計算式**:
- 期待勝率: `E = 1 / (1 + 10^((相手レート - 自分レート) / 400))`
- レート変動: `新レート = 旧レート + K × (実際の結果 - 期待勝率)`
- 勝敗判定: プレイヤースコアが写真の平均スコアの±2%以内なら引き分け

**セキュリティ対策**:
- セッションベースの重複投票防止
- プリンシパル検証
- レート制限（1時間20回）
- 自己レーティング防止

## Recent Changes (2025-01-25)

### SessionDetailsScreenの最適化とPhotoDetailsScreenの機能追加

1. **SessionDetailsScreen メモリリーク修正**
   - 無限レンダリングループの修正（useEffectの依存配列から`rounds`を削除）
   - 距離に基づくマップ表示の最適化:
     - 5000km以上の距離では簡易表示モード
     - マップのタイルキャッシュ問題を解決（`key`プロップを削除）
     - 極端な距離（20GB以上のメモリ使用）での最適化
   - 写真の並列読み込みを復活（50msのstaggered delay）

2. **GameResultScreen の最適化パターンを適用**
   - 距離ベースのズームレベル調整
   - 低スコア時の軽量モード実装
   - マップアニメーションの条件付き実行

3. **PhotoDetailsScreen に Community Ratings Card を追加**
   - 3つのカテゴリー（Difficulty、Interest、Scenery）の平均評価を表示
   - 各カテゴリーに色分けされた円形バッジ:
     - Difficulty: 赤 (#ef4444)
     - Interest: 青 (#3b82f6)  
     - Scenery: 緑 (#10b981)
   - 星評価の視覚的表示と投票数
   - 総合平均評価の表示
   - レーティングがない場合の表示（"No ratings yet"）

4. **自分の写真への評価制限**
   - 通常ユーザーは自分の写真を評価不可
   - 開発者プリンシパル例外を実装:
     - `6lvto-wk4rq-wwea5-neix6-nelpy-tgifs-crt3y-whqnf-5kns5-t3il6-xae`
   - UIメッセージの使い分け:
     - 自分の写真: "Cannot rate your own photo"
     - 開発者モード: "Developer mode: You can rate your own photo for testing"

5. **バックエンドのレーティング永続化**
   - RatingModuleで完全な永続化を実装:
     - `stableRatings`: 個別評価の保存
     - `stableAggregatedRatings`: 集計評価の保存
     - `stableDistributions`: 評価分布の保存
   - 自動集計機能（評価送信時に平均値を更新）

### 技術的な改善点

**メモリ最適化**:
- MapViewの条件付きレンダリング
- 写真データの効率的なキャッシング
- 大距離表示時の軽量モード

**用語の統一**:
- **Elo Rating**: プレイヤー/写真の競技レーティング
- **Rating/評価**: 写真への5段階評価（difficulty, interest, scenery）

## Recent Updates (2025-06-28)

### 開発者プリンシパルの特別扱いを削除とトークンBurn機能の追加

**変更内容**:
1. **フロントエンドから開発者プリンシパルの特別扱いを削除**:
   - `GameModeScreen.tsx`: 
     - 開発者プリンシパル(6lvto-wk4rq-...)が常にProメンバーとして扱われる処理を削除
     - 週間写真モードで開発者プリンシパルが全写真を利用できる特別処理を削除
   - `PhotoDetailsScreen.tsx`:
     - 開発者プリンシパルが自分の写真を評価できる特別処理を削除

2. **トークンBurn機能を追加**:
   - `main.mo`: `burnTokens`関数を追加 - ユーザーが自分のトークンをburnできる
   - `game.ts`: IDL定義とサービスメソッドに`burnTokens`を追加

3. **ProメンバーシップのSPOT処理について確認**:
   - `purchaseProMembership`関数でSPOTトークンは正しくburnされている（line 2567）
   - 500 SPOT（50000最小単位）がProメンバーシップ購入時にburnされる

**注意事項**:
- 誤って50,000 SPOTをmintした場合は、`burnTokens(BigInt(4950000))`を呼び出して余分な49,500 SPOTをburnできる
- バックエンドで`dfx canister call unified burnTokens '(4950000)' --network ic`でも実行可能

## Recent Updates (2025-06-27)

### 1. Recent Activity表示の修正
**問題**: HomeScreenのRecent ActivityセクションでSPOTトークン報酬とELO変動が0と表示される
**原因**: 古いセッションに`initialEloRating`フィールドがなく、`playerReward`が正しく永続化されていなかった
**修正内容**:
- `getRecentSessionsWithScores`に古いセッション用のフォールバック処理を追加
- `finalizeSession`でのデバッグログ追加による永続化確認
- `initialEloRating`がnullの場合、現在のレーティングと初期値(1500)の差分を計算

### 2. Player Stats表示の修正
**問題**: HomeScreenでGames数とAvg Scoreが0と表示される
**原因**: PlayerStatsModuleが最近追加されたため、過去のセッションデータが統計に反映されていなかった
**修正内容**:
- `updateStatsOnSessionFinalize`の呼び出しを確認
- `rebuildPlayerStats`関数を追加し、既存セッションから統計を再構築可能に
- デバッグログの追加により問題の特定を容易に

### 3. 修正ファイル一覧
- `src/backend/unified/main.mo`
  - `getRecentSessionsWithScores`: フォールバック処理追加
  - `finalizeSession`: デバッグログ追加
  - `rebuildPlayerStats`: 新規追加（統計再構築用）
  - `debugGetAllPlayerStats`: 新規追加（デバッグ用）
- `src/backend/unified/modules/PlayerStatsModule.mo`
  - デバッグログの追加
- `src/backend/unified/modules/PhotoModuleV2.mo`
  - `getPhotoStats` → `getPhotoStatsForSystem`に名前変更（重複定義エラー修正）
- `src/frontend/src/services/game.ts`
  - デバッグログの追加（フロントエンド修正は不要）

### 4. トラブルシューティング
Player Statsが0と表示される場合：
```bash
# 既存セッションから統計を再構築
dfx canister --network ic call unified rebuildPlayerStats
```

### 5. 今後の注意点
- 新しいプレイヤーは初回ゲーム完了時に統計が自動的に作成される
- `finalizeSession`が正しく呼ばれることで統計が更新される
- canisterアップグレード時はPlayerStatsのstable変数が保持される

## 作業記録 (2025-06-30)

### SpotQuestプロジェクトの構造理解
1. **フロントエンドアーキテクチャ**
   - React Native + Expoによるモバイルアプリ
   - Internet Identity認証（開発モードではEd25519KeyIdentity）
   - Zustandによる状態管理（ゲームセッション、ラウンド、トークン残高）
   - React Navigation v6でのナビゲーション管理

2. **バックエンドアーキテクチャ**
   - 統合キャニスター（unified）にすべての機能を実装
   - モジュール化されたコード構成：
     - TokenModule: ICRC-1標準のSPOTトークン（小数点2桁）
     - GameEngineModule: 5ラウンド制のゲームロジック
     - PhotoModuleV2: チャンク分割による大容量写真アップロード
     - EloRatingModule: プレイヤーと写真の動的レーティング
     - RatingModule: 写真への5段階評価システム

3. **ゲームメカニクス**
   - スコア計算: 距離精度(Sd)と方位精度(Sφ)から最大5000点
   - アンチチート: 座標検証、時間制限（2秒〜5分）、信頼半径制限
   - 報酬システム: プレイヤーとアップロード者への自動配分
   - Eloレーティング: K係数32/24/16での動的調整

4. **パフォーマンス最適化**
   - GameResultScreen: 低スコア時の軽量モード実装
   - SessionDetailsScreen: 大距離時のマップ表示最適化
   - 写真データのメモリ効率的な管理

### ビルドエラーの修正
- **問題**: `Error: ENOENT: no such file or directory, open './src/assets/app_icon.png'`
- **原因**: app.jsonで指定された画像パスと実際のファイル位置の不一致
- **修正内容**:
  1. app_icon.pngをassets/icon.pngにコピー
  2. AndroidのstatusBarHidden/navigationBarHidden設定を削除（非推奨）
  3. 必要なアイコンファイルを適切な場所に配置
- **注意**: `npx expo install --check`で依存関係の更新も推奨

### EASビルドの設定
- **依存関係の競合解決**: `npm install --legacy-peer-deps`を使用
- **eas.jsonの修正**: 開発プロファイルにiOSシミュレータービルドを設定
  ```json
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "ios": {
      "simulator": true
    }
  }
  ```
- **ビルド開始**: `eas build --platform ios --profile development`でシミュレータービルド実行
- **メリット**: Appleの署名証明書不要でローカル開発可能

### App Storeバリデーションエラーの修正 (2025-06-30)
- **問題**: Missing Info.plist value: CFBundleIconName + 必要なアイコンサイズの欠如
- **修正内容**:
  1. app.jsonのアイコンパスを標準的な "./assets/icon.png" に変更
  2. iOS設定にCFBundleIconNameを追加:
     ```json
     "infoPlist": {
       "CFBundleIconName": "AppIcon",
       ...
     }
     ```
  3. buildNumberを"3"に設定（EASが自動的に4にインクリメント）
  4. `npx expo prebuild --clean`でネイティブプロジェクトを再生成
- **ビルドコマンド**: `eas build --platform ios --profile production`
- **注意**: アイコンファイルは1024x1024のPNG（透明背景なし）が必要
- **追記**: アイコンパスを間違えて`./assets/icon.png`に変更してしまったが、正しくは`./src/assets/app_icon.png`

### アイコン設定の完全整理 (2025-06-30)
- **問題**: TestFlight提出時にCFBundleIconNameとアイコンサイズ不足のエラー
- **整理内容**:
  1. アイコンを標準的な`assets/app_icon.png`に配置
  2. `app.json`のアイコンパスを`"./assets/app_icon.png"`に統一
  3. `icon.png`と`app_icon.png`を同一にして混乱を防ぐ
  4. buildNumberを5に更新
  5. `rm -rf ios android && npx expo prebuild --clean`で完全再生成
- **確認事項**:
  - CFBundleIconNameがInfo.plistに存在 ✓
  - 1024x1024のPNGアイコンが正しい場所に配置 ✓
  - EASビルド時に自動的にすべてのアイコンサイズが生成される

### TestFlightエラーの根本解決 (2025-07-01)
- **問題**: ローカルprebuildで生成されたアイコンセットが不完全（1024x1024のみ）
- **原因**: EASビルドがローカルのiosフォルダをそのまま使用し、必要なアイコンサイズが含まれない
- **解決策**:
  1. `rm -rf ios android` でネイティブフォルダを削除
  2. `.gitignore`に`ios/`と`android/`を追加
  3. buildNumberを8に更新
  4. EASビルドにネイティブコードの生成を完全に任せる
- **結果**: EASがリモートで正しいprebuildを実行し、すべての必要なアイコンサイズを生成
- **コマンド**: `eas build --platform ios --profile production`

### EASビルドエラーの解決 (2025-07-01)
- **問題**: EASビルドで`ENOENT: no such file or directory, open './assets/app_icon.png'`エラー
- **原因**: ルートの`.gitignore`に`*.png`があり、アイコンファイルがgitに含まれていなかった
- **解決策**:
  1. ルート`.gitignore`の`*.png`ルールをコメントアウト
  2. `git add assets/app_icon.png`でアイコンファイルを追加
  3. 関連するPNGファイルもすべてgitに追加
- **教訓**: EASビルドはgitリポジトリの内容を使用するため、必要なファイルはすべてコミットする必要がある

## Recent Updates (2025-06-27) - アプリ名とアイコンの変更

### アプリ名を「SpotQuest」に変更
**変更内容**:
1. **app.json**
   - name: "Guess the Spot" → "SpotQuest"
   - slug: "guess-the-spot" → "spotquest"
   - bundleIdentifier/package: "com.guessthespot.app" → "com.spotquest.app"
   - scheme: "guessthespot" → "spotquest"
   - 権限メッセージ内のアプリ名も更新

2. **アイコンの更新**
   - `src/frontend/src/assets/app_icon.png`を新しいアプリアイコンとして設定
   - icon.pngとadaptive-icon.pngにコピー

3. **UIとドキュメントの更新**
   - LoginScreen.tsx: タイトル表示を"SpotQuest"に変更
   - README.md: プロジェクト名を更新
   - CLAUDE.md: プロジェクト概要を更新
   - package.json（ルート）: パッケージ名を更新

**注意事項**:
- 新規ビルド時は`expo prebuild --clear`を実行してキャッシュをクリア
- EASビルドする場合は新しいバンドルIDで証明書の再設定が必要

### SPOTトークンにicrc1_metadataを実装
**変更内容**:
1. **Constants.mo**
   - TOKEN_NAME: "SpotQuest Token"に更新
   - TOKEN_MAX_MEMO_LENGTH: 32を追加

2. **TokenModule.mo**
   - トークンロゴのbase64エンコード画像を追加（256x256サイズ）
   - `icrc1_metadata()`メソッドを実装
   - 以下のメタデータを返す:
     - icrc1:logo - PNGロゴのbase64 data URI
     - icrc1:decimals - 2
     - icrc1:name - "SpotQuest Token"
     - icrc1:symbol - "SPOT" 
     - icrc1:fee - 1 (0.01 SPOT)
     - icrc1:max_memo_length - 32

3. **main.mo**
   - `icrc1_metadata`のpublic query関数を追加

4. **game.ts (フロントエンド)**
   - IDL定義にMetadataとMetadataValueタイプを追加
   - サービス定義に`icrc1_metadata`関数を追加

**テスト方法**:
```bash
# ローカルネットワーク
./test_icrc1_metadata.sh local

# メインネット
./test_icrc1_metadata.sh
```

## Recent Updates (2025-06-27) - DetailedStatsScreenのカテゴリ別分析機能

### カテゴリ別パフォーマンス分析を実装

1. **機能追加**
   - 難易度別統計（Easy、Normal、Hard、Extreme）の表示
   - 地域別統計（上位10地域）の表示
   - 各カテゴリごとの平均スコア、勝率、誤差距離を計算

2. **実装詳細**
   - セッションからラウンドデータを抽出し、写真IDを収集
   - photoServiceV2を使用して写真メタデータ（地域、難易度）を取得
   - 地域と難易度でデータを集計し、統計を計算
   - 学習タブに新しい「カテゴリ別パフォーマンス」セクションを追加

3. **バグ修正**
   - totalScoreフィールドの欠落エラーを修正（totalRewardsEarnedを使用）
   - "Text strings must be rendered within a Text component"エラーを修正
     - 条件演算子の文字列結合を改善（`{isPositive ? '+' : ''}{point.change}` → `{isPositive ? \`+${point.change}\` : \`${point.change}\`}`）
   - タブレイアウトの改善（高さ制限とパディング調整）

4. **追加機能**
   - 難易度別のカラーコーディング（Easy: 青緑、Normal: 薄緑、Hard: オレンジ、Extreme: 赤）
   - 高難易度での苦戦を検出してアドバイスを表示
   - 地域別の詳細な統計情報（プレイ回数順で上位10地域）

5. **技術的な詳細**
   - RoundDataインターフェースにtimestampフィールドを追加
   - カテゴリデータの集計にMapを使用して効率的に処理
   - 勝率計算では3000点以上を「勝利」として定義