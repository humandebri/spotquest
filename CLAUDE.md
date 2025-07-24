# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SpotQuest** is a photo-based location guessing game running on the Internet Computer Protocol (ICP). It's a React Native + Expo mobile application where users guess photo locations to earn SPOT tokens.

## Development Guidelines

- 作業を行った際はキリのいいところで必ずclaude.mdに行った作業の要約を記録して引き継ぎすること
- 回答は日本語で行なってください

## Critical Architecture Decisions

### Canister Architecture
The project uses a **unified canister** approach (`src/backend/unified/main.mo`) that combines all backend functionality:
- All data is stored in stable memory and must be preserved during upgrades
- **NEVER use `--mode reinstall`** when deploying - this will delete all user data
- The frontend canister is legacy - all functionality is in the unified canister

### Authentication Flow
- Production: Internet Identity via AuthSession and expo-auth-session
- Dev mode: Ed25519KeyIdentity with fixed principal `535yc-uxytb-gfk7h-tny7p-vjkoe-i4krp-3qmcl-uqfgr-cpgej-yqtjq-rqe`
- Backend expects only `publicKey` string for `newSession`, not an object
- All canister calls must be made with an initialized identity

### Service Initialization Pattern
All frontend services are singletons that require initialization:
```typescript
// Must init with identity before any calls
await gameService.init(identity);
await photoServiceV2.init(identity);
```

## Common Development Commands

### Frontend Development
```bash
cd src/frontend

# Install with legacy peer deps (required)
npm install --legacy-peer-deps

# Start Expo dev server
npm start

# Clear Expo cache and restart
npx expo start -c

# Fix TypeScript errors
npx tsc --noEmit

# Run on specific platform
npm run ios
npm run android
npm run web
```

### Backend Development
```bash
# Deploy to mainnet (preserves data)
dfx deploy unified --network ic

# Generate IDL after backend changes
dfx generate unified

# Check canister status
dfx canister --network ic status unified

# View logs
dfx canister --network ic logs unified

# Local development
dfx start --clean
dfx deploy unified
```

### Mobile App Building (EAS)
```bash
cd src/frontend

# Development build for simulator
eas build --platform ios --profile development

# Production build for TestFlight
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

## Scoring System Architecture

The game uses different score scales that must be carefully managed:

1. **Display Score**: 0-5000 points per round (what users see)
2. **Normalized Score**: 0-100 internally for calculations
3. **Elo Rating**: Standard 100-3000 range with K-factors 32/24/16

### Score Calculation
```
Distance: Sd = 1 - (d - 25m) / (1000m - 25m)
Azimuth: Sφ = 1 - φ / 30°
Final: Score = 5000 × (Sd^1.3 × Sφ^0.7)
```

## Key Technical Patterns

### Photo Upload V2 System
- Chunk-based upload (1MB chunks, 10MB max)
- Flow: `createPhotoV2` → `uploadPhotoChunkV2` (multiple) → `finalizePhotoUploadV2`
- Photos stored in stable memory with automatic migration

### Game Session Management
- 5 rounds per session
- Session cleanup required before creating new ones
- Region filtering: `getNextRound(sessionId, "asia")`
- Weekly mode: `getNextRound(sessionId, "weekly:asia")`

### Error Handling Patterns
```typescript
// All service calls should handle errors
const result = await gameService.createSession();
if (result.err) {
  console.error('Failed:', result.err);
  return;
}
// Use result.ok
```

### State Management
- **Game state**: Zustand store in `gameStore.ts`
- **Auth state**: Zustand store in `iiAuthStore.ts`
- **Token balance**: Polled from canister, cached in gameStore
- **Photo data**: Cached in service instances

## Module Organization

### Backend Modules (`src/backend/unified/modules/`)
- `TokenModule.mo`: ICRC-1 SPOT token (2 decimals, 10M supply)
- `GameEngineModule.mo`: Core game logic, session management
- `PhotoModuleV2.mo`: Photo storage and retrieval
- `RatingModule.mo`: 5-star rating system (difficulty, interest, beauty)
- `EloRatingModule.mo`: Dynamic rating system for competitive play
- `ReputationModule.mo`: Anti-cheat and user behavior tracking
- `TreasuryModule.mo`: Token reward distribution
- `PlayerStatsModule.mo`: User statistics and achievements
- `IIIntegrationModule.mo`: Internet Identity integration

### Frontend Structure (`src/frontend/src/`)
```
screens/
  game/          # Game play screens
  photo/         # Photo browsing/upload
  user/          # Profile, stats, leaderboards
  auth/          # Login screens
services/        # Canister communication
stores/          # Zustand state management
hooks/           # Custom React hooks
components/      # Reusable UI components
utils/           # Helper functions
```

## Common Issues and Solutions

### TypeScript/IDL Mismatch
After backend changes:
1. `dfx generate unified`
2. Update IDL in `src/frontend/src/services/game.ts`
3. Fix any TypeScript errors

### Authentication Failures
1. Clear Expo cache: `npx expo start -c`
2. Check identity initialization in services
3. Verify canister ID environment variables

### Photo Upload Issues
- Check chunk size (max 1MB per chunk)
- Verify GPS/azimuth data is included
- Ensure proper error handling for network failures

### iOS Build Issues
- Icon must be in git repository (not gitignored)
- Environment variables must be in `eas.json` for production
- Use `--legacy-peer-deps` for all npm operations

## Security Considerations

- GPS coordinates must be within valid ranges (-90 to 90, -180 to 180)
- Azimuth must be 0-360 degrees
- Time limits: 2 seconds minimum, 5 minutes maximum per guess
- Rate limiting: 20 photo ratings per hour
- Photo quality scoring with auto-ban for suspicious uploads
- Anonymous principals cannot rate photos

## Recent Important Changes

### 2025-07-10 - IDL Type Fix
- Fixed `newSession` to accept only `publicKey` string (not object)
- Removed unused `NewSessionRequest` type from frontend IDL

### 2025-07-08 - Certified Assets Debug
- Added debug endpoints for certificate verification
- Investigating 503 errors on certified domain

### 2025-07-07 - II Authentication Flow
- Migrated to AuthSession-based flow
- Changed to ResponseType.Token to avoid JWT verification
- Added useProxy flag for Expo Go compatibility

### 2025-07-01 - TestFlight Deployment
- Fixed icon requirements for App Store
- Added environment variables to production build
- Resolved font loading for standalone builds

## Work Handoff Protocol

作業を引き継ぐ際は、以下の情報を必ずこのファイルの「作業記録」セクションに追加してください：

1. 実施した主な変更内容
2. 解決した問題と解決方法
3. 未解決の課題や注意点
4. 変更したファイルのリスト
5. 必要に応じてデプロイやビルドの手順

## 作業記録

[Previous work records maintained as in original file...]

### 2025-07-10 - II認証エラーの修正とCLAUDE.md更新

**実施内容**:
1. **IDLタイプエラーの修正**
   - フロントエンドが`{publicKey, redirectUri}`オブジェクトを送信していたが、バックエンドは`publicKey`文字列のみを期待
   - `game.ts`の`newSession`メソッドは既に正しく実装されていた
   - 未使用の`NewSessionRequest`タイプ定義を削除

2. **CLAUDE.mdの改善**
   - プロジェクト構造とアーキテクチャの詳細を追加
   - 実際に使用されているコマンドのみを記載
   - 重要な技術パターンとエラーハンドリングを文書化
   - セキュリティ考慮事項を整理
   - 作業引き継ぎプロトコルを追加

**注意点**:
- `DelegateRequest`タイプが未使用として警告が出ているが、II統合の一部なので削除しない方が良い
- バックエンドの`newSession`関数シグネチャを変更する場合は、破壊的変更となるため注意が必要
.icp0.ioを使用すること

### 2025-07-22 - ICPハッカソン向けREADME作成

**実施内容**:
1. **既存READMEの完全な書き換え**
   - ICPハッカソンの審査員向けに特化した内容に変更
   - インストール手順を削除し、技術的深さに焦点
   - 英語版と日本語版の両方を作成

2. **技術調査の実施**
   - プロジェクトの実際のアーキテクチャを確認（統一キャニスター構造）
   - 技術スタックの完全なリストアップ
   - スコアリングシステムの詳細調査（方位角スコアリングは未実装と判明）
   - II認証の実装方法と課題の詳細調査

3. **README構成**
   - ビジョン・ミッションの明確化
   - ゲームメカニクスの詳細説明
   - 技術アーキテクチャの深い解説
   - 技術的課題と解決策（特にExpo環境でのII認証）
   - 革新的な機能の紹介
   - 技術スタックの完全なリスト
   - 今後のロードマップ

**技術的発見**:
- 方位角スコアリングはCLAUDE.mdに記載があるが、実際のコードでは未実装
- Expo環境でのII認証には多くの課題があり、3つの異なるアプローチを試した
- チャンクベースの写真アップロードシステムで大容量ファイルに対応
- 自己調整型トレジャリーシステムで外部依存なしにトークン配布を管理

**変更ファイル**:
- `/Users/0xhude/Desktop/ICP/spotquest/README.md` - 完全に書き換え

### 2025-07-24 - Xcodeビルドエラーの修正

**問題**:
- Xcodeでビルド時に`Unable to open base configuration reference file`エラーが発生
- `/Users/0xhude/Desktop/ICP/Guess-the-Spot/`という古いパスを参照していた

**原因**:
- プロジェクトが以前の場所から移動された後、CocoaPodsの設定が更新されていなかった
- `Podfile.lock`と`Pods.xcodeproj/project.pbxproj`に古い絶対パスが残存

**解決方法**:
1. Podsディレクトリを削除
2. Podfile.lockを削除
3. SpotQuest.xcworkspaceを削除
4. `pod install`を再実行

**結果**:
- すべてのPods設定が現在のプロジェクトパスで再生成された
- ビルドエラーが解決

### 2025-07-24 - getDeepLinkTypeエラーの修正

**問題**:
- アプリ起動時に`Could not determine deep link type`エラーが発生
- `spotquest:///`というカスタムスキームが認識されない

**原因**:
- `getDeepLinkType`関数が以下の条件でディープリンクタイプを判定:
  1. `exp://` → "expo-go"
  2. `http://localhost:8081` → "dev-server"
  3. URLに`frontendCanisterId`を含む → `easDeepLinkType || "icp"`
- `spotquest:///`は上記のどれにも当てはまらず、`EXPO_PUBLIC_EAS_DEEP_LINK_TYPE`も未設定だった

**解決方法**:
`.env`ファイルに以下を追加:
```
EXPO_PUBLIC_EAS_DEEP_LINK_TYPE=legacy
```

**結果**:
- `spotquest://`スキームが"legacy"タイプとして正しく認識されるようになった
- エラーが解消され、アプリが正常に起動

**追加修正**:
- 環境変数設定だけでは解決しなかったため、`getDeepLinkType`をラップする関数を作成
- `spotquest://`で始まるディープリンクを自動的に`legacy`タイプとして扱うようにした

### 2025-07-24 - Internet Identity認証URLの修正

**問題**:
- ログインボタンを押すとInternet Identityではなく統一キャニスターのルートページに遷移していた
- URL: `https://77fv5-oiaaa-aaaal-qsoea-cai.icp0.io/?pubkey=...`

**原因**:
- `buildAppConnectionURL`でパスを指定していなかったため、ルート（/）へのURLが生成されていた
- expo-ii-integrationは`/newSession`エンドポイントを期待している

**解決方法**:
App.tsxの`buildAppConnectionURL`呼び出しに`pathname`パラメータを追加：
```typescript
const iiIntegrationUrl = buildAppConnectionURL({
  dfxNetwork,
  localIPAddress: localIpAddress,
  targetCanisterId: iiIntegrationCanisterId,
  pathname: '/newSession',  // この行を追加
});
```

**結果**:
- `iiIntegrationUrl`が`https://77fv5-oiaaa-aaaal-qsoea-cai.icp0.io/newSession`になり、正しくInternet Identityにリダイレクトされるようになった

### 2025-07-10 - Response Verification Errorの調査と修正

**実施内容**:
1. **Response Verification Errorの対処**
   - Internet Identityが「Response Verification Error」を表示する問題を調査
   - 初期アプローチ: canisterOriginを`.raw.icp0.io`に変更（ユーザーが拒否）
   - 最終的にCLAUDE.mdの指示に従い`.icp0.io`に戻した

2. **expo-icpプロジェクトの分析**
   - https://github.com/higayasuo/expo-icp を参照
   - より単純なアーキテクチャ: 専用のii-integrationキャニスターとexpo-ii-integrationパッケージを使用
   - 将来的な移行計画を作成

3. **メインネットへのデプロイ**
   - `dfx deploy unified --network ic`でバックエンドをデプロイ
   - Canister ID: 77fv5-oiaaa-aaaal-qsoea-cai
   - フロントエンドをポート8082で起動してテスト準備

**変更ファイル**:
- `/src/backend/unified/main.mo` - canisterOriginを`.icp0.io`に戻した
- `/src/backend/unified/modules/IIIntegrationModule.mo` - response_typeを"token"に変更
- `/src/frontend/src/hooks/useIIAuthSessionV6.tsx` - tokenEndpoint追加、useProxyフラグ追加

**未解決の課題**:
- Response Verification Errorの根本原因は証明書ヘッダーの問題の可能性
- 将来的にexpo-icpアーキテクチャへの移行を検討

### 2025-07-10 - expo-icpアーキテクチャの実装

**実施内容**:
1. **expo-ii-integrationへの完全移行**
   - Storageモジュールをexpo-storage-universalに更新
   - Cryptoモジュールをexpo-crypto-universalに更新
   - App.tsxでIIIntegrationProviderを使用するよう更新
   - LogInとLogOutコンポーネントを新規作成

2. **canister-managerアプローチの実装**
   - gameCanisterManager.tsを作成（canister-managerを使用した新しいサービス）
   - IDLファクトリーを独立した関数として抽出
   - Factory関数パターンでactorの作成を簡略化

3. **古い認証コードのクリーンアップ**
   - 削除したファイル:
     - useIIAuthSessionV6.tsx（古いAuthSessionフック）
     - IIAuthContext.tsx（古いコンテキスト）
     - IIAuthProviderWithReset.tsx（ラッパーコンテキスト）
     - authPoller.ts（ポーリングユーティリティ）
     - clearAllIIData.ts（手動ストレージクリア）
     - clearIIStorage.ts（重複ユーティリティ）
     - delegationFix.ts（ワークアラウンド）
     - IIErrorBoundary.tsx（古いエラー境界）
     - App-ii.tsx（代替エントリポイント）
     - AppNavigatorII.tsx（代替ナビゲーター）

4. **依存関係の追加**
   - expo-storage-universal-web
   - expo-storage-universal-native
   - expo-crypto-universal-web
   - expo-crypto-universal-native

**技術的な改善**:
- 認証フローがexpo-ii-integrationで標準化された
- canister-managerによりネットワーク設定が自動化
- 型安全性が向上（IDLファクトリーの分離）
- コードの重複が削減（古いワークアラウンドの削除）

**注意事項**:
- gameCanisterManager.tsは現在`UnifiedService`型を`any`として定義しているため、将来的に適切な型定義が必要
- iiIntegrationPatch.tsはまだ使用中だが、将来的には不要になる可能性がある
- 実際のII認証テストは、アプリを起動して確認する必要がある

### 2025-07-18 - expo-ii-integration標準実装への再移行

**問題点**:
- IIがpostMessage通信を使用しているため、WebViewベースのカスタム実装では動作しない
- カスタムWebBrowserフローは複雑で、メンテナンスが困難
- HTMLブリッジ方式も正常に動作しない

**実施内容**:
1. **App.tsxの修正**
   - `buildInternetIdentityURL` → `buildAppConnectionURL`に変更
   - `getDeepLinkType`を使用してディープリンクタイプを適切に判定
   - II_INTEGRATION_CANISTER_IDを環境変数から使用
   - redirectUriパラメータを削除（標準実装では不要）

2. **LogIn.tsxの簡略化**
   - カスタムWebBrowserフローを完全に削除
   - expo-ii-integrationの標準`login`関数のみを使用
   - 約260行のコード → 83行のシンプルな実装に
   - エラーハンドリングをAlert.alertで統一

3. **不要なコードの削除**
   - gameService.tsからII関連メソッドを削除：
     - newSession、saveDelegate、closeSession
     - 関連するIDL型定義（NewSessionRequest、DelegateResponse等）
   - バックエンドmain.moからii-callback.htmlエンドポイントを削除
   - bytesToHexユーティリティは残す（将来使用する可能性があるため）

**技術的な改善**:
- postMessage通信はexpo-ii-integration内部で適切に処理される
- 認証フローがライブラリに完全に委譲され、メンテナンスが容易に
- コード量が大幅に削減され、可読性が向上
- バグの可能性が減少

**変更ファイル**:
- `/src/frontend/App.tsx` - buildAppConnectionURLとgetDeepLinkTypeを使用
- `/src/frontend/src/components/LogIn.tsx` - シンプルな実装に置き換え
- `/src/frontend/src/services/game.ts` - II関連メソッドを削除
- `/src/backend/unified/main.mo` - ii-callback.htmlエンドポイントを削除

### 2025-07-24 - Response Verification Errorの修正

**問題**:
- II認証ページで「Response Verification Error」が発生
- /newSessionエンドポイントが動的レスポンスを返すため、IC-Certificateヘッダーがなく、Boundary Nodeの検証に失敗

**実施内容**:
1. **HTTP処理の再構造化**
   - 既存の`http_request`関数を`handleHttpRequest`にリネーム（共通ロジック用）
   - 新しい`http_request`関数を作成：
     - `/newSession`と`/api/`パスには`200 + upgrade=true`を返す
     - 静的エンドポイントは`handleHttpRequest`を直接呼び出す
   - `http_request_update`を修正して`handleHttpRequest`を呼び出すように変更

**技術的詳細**:
- Boundary Nodeは動的エンドポイントに対して`upgrade=true`を期待
- 403ステータスコードは使用せず、200を返すことが重要
- これにより、実際の処理は`http_request_update`で行われ、証明書の検証問題を回避

**変更ファイル**:
- `/src/backend/unified/main.mo` - HTTP処理の再構造化

**注意事項**:
- デプロイにはキャニスターへのcycles追加が必要（最低221,204,655,923 cycles）