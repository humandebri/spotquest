# SpotQuest - Photo-Based Location Guessing Game on Internet Computer

[English](#english) | [日本語](#japanese)

---

<a id="english"></a>
## 🌍 SpotQuest: Where Photos Meet Blockchain Gaming

SpotQuest is a revolutionary photo-based location guessing game built on the Internet Computer Protocol (ICP), combining the addictive gameplay of location guessing with blockchain technology and tokenomics. Players explore the world through real photos, guess their locations, and earn SPOT tokens for accurate predictions.

### 🎯 Vision & Mission

**Vision**: Create the world's first truly decentralized photo exploration game where every photo becomes a gateway to discover new places while earning rewards.

**Mission**: Bridge the gap between casual mobile gaming and Web3 by providing an intuitive, rewarding experience that showcases the power of blockchain technology without complexity.

### 🚀 Why Internet Computer?

We chose ICP for its unique capabilities:
- **100% On-Chain**: All game logic, photo storage, and token transactions run entirely on-chain
- **Web Speed**: Sub-second finality enables real-time gaming experience
- **Reverse Gas Model**: Players never pay transaction fees - the game handles all costs
- **Stable Memory**: Permanent data storage without traditional database dependencies
- **Internet Identity**: Seamless Web3 authentication without seed phrases

## 🎮 Game Mechanics

### Core Gameplay Loop

1. **Start Session**: Players begin a 5-round game session
2. **View Photo**: Real-world photo with GPS metadata hidden
3. **Make Guess**: Drop a pin on the interactive map
4. **Score Points**: Earn 0-5000 points based on distance accuracy
5. **Earn Rewards**: Receive SPOT tokens for completing sessions

### Scoring System

```
Distance Score = 5000 × e^(-0.15 × distance_in_km)

Perfect guess (≤10m) = 5000 points
1km away ≈ 4300 points
10km away ≈ 1100 points
50km away ≈ 30 points
```

### Token Economy

- **Token**: SPOT (SpotQuest Token)
- **Supply**: 10,000,000 SPOT (fixed)
- **Decimals**: 2
- **Player Rewards**: 200 SPOT per completed session
- **Uploader Rewards**: 30% of player rewards when their photos are played

## 🏗️ Technical Architecture

### Main Canister Architecture

We implemented a monolithic canister design that consolidates all functionality:

```
main_canister/
├── TokenModule (ICRC-1)      # SPOT token implementation
├── GameEngineModule          # Core game logic
├── PhotoModuleV2             # Photo storage & retrieval
├── RatingModule              # 5-star rating system
├── EloRatingModule           # Dynamic difficulty
├── TreasuryModule            # Automated token distribution
├── PlayerStatsModule         # Statistics tracking
└── IIIntegrationModule       # Internet Identity
```

**Benefits**:
- Atomic operations across modules
- Simplified deployment and upgrades
- Reduced inter-canister calls
- Single source of truth

### Mobile-First Development

Built with React Native + Expo for optimal mobile experience:
- Native performance on iOS and Android
- Hardware access for camera and GPS
- Offline capability with smart caching
- Push notifications for game events

## 🔧 Technical Challenges & Solutions

### 1. Internet Identity in Expo Environment

**Challenge**: Internet Identity uses postMessage API designed for web browsers, incompatible with React Native's WebView.

**Our Journey**:
1. **Initial Attempt**: Custom WebView with injected JavaScript bridge
2. **Second Attempt**: AuthSession with token interception
3. **Final Solution**: expo-ii-integration package with custom patches

**Key Learnings**:
- WebView's JavaScript context isolation prevents direct postMessage interception
- Expo's AuthSession provides the correct browser environment for II
- Required extensive patching of crypto and storage modules for React Native compatibility

**Implementation Details**:
```typescript
// Critical patches applied at app startup
patchEd25519KeyIdentity();      // Fix key generation
patchExpoIIIntegration();        // Enable II communication
patchStorageForIIIntegration();  // Adapt storage for mobile
patchIIIntegrationFetch();       // Handle network requests
```

### 2. Chunk-Based Photo Upload System

**Challenge**: ICP message size limit of 2MB vs typical photo sizes of 5-10MB.

**Solution**: Implemented chunked upload protocol:
```
1. createPhotoV2() → returns upload ID
2. uploadPhotoChunkV2() → upload 1MB chunks
3. finalizePhotoUploadV2() → reassemble & store
```

**Features**:
- Progress tracking per chunk
- Automatic retry on failure
- Parallel chunk processing
- Integrity verification

### 3. Real-Time Token Economy

**Challenge**: Managing token distribution without external oracles or timing services.

**Solution**: Self-regulating treasury system:
- Automatic reward calculation based on game completion
- Treasury balance monitoring
- Auto-burn mechanism when treasury exceeds 5% of supply
- No external dependencies

## 🌟 Innovative Features

### 1. Elo Rating System
- **Dynamic Difficulty**: Photos and players have Elo ratings
- **Matchmaking**: Players face appropriately challenging photos
- **Progression**: Rating changes based on performance vs photo difficulty

### 2. Five-Star Photo Rating System
Players rate photos on three dimensions:
- **Difficulty**: How challenging to guess
- **Interest**: How engaging the location
- **Beauty**: Visual appeal

Ratings influence:
- Photo selection algorithm
- Uploader reputation
- Bonus rewards

### 3. Advanced Photo Management
- **GeoHash Indexing**: Efficient location-based queries
- **Scene Classification**: Nature, buildings, shops, facilities
- **Tag System**: Community-driven categorization
- **Quality Scoring**: Automatic detection of low-quality uploads

### 4. Comprehensive Player Statistics
- Total/completed games
- Best scores and streaks
- 30-day rolling statistics
- Time-based performance analytics
- Token earning history

### 5. Reputation System
- Upload quality impacts reputation (0.0-1.0 score)
- High reputation unlocks features
- Bad actors automatically restricted
- Community-driven moderation

## 🛠️ Technology Stack

### Frontend
- **React Native** 0.79.4 - Cross-platform mobile framework
- **Expo** 53.0.13 - Development platform and build tools
- **TypeScript** 5.8.3 - Type safety
- **NativeWind** 4.1.23 - Tailwind CSS for React Native
- **Zustand** 4.5.0 - State management
- **React Navigation** 6.x - Navigation
- **React Native Maps** 1.20.1 - Interactive maps

### ICP Integration
- **@dfinity/agent** 0.20.2 - ICP communication
- **expo-ii-integration** 0.1.24 - Internet Identity for Expo
- **canister-manager** 0.1.7 - Simplified canister interactions

### Backend (Motoko)
- **Stable Memory** - Persistent storage
- **Certified Assets** - Secure content delivery
- **ICRC-1 Standard** - Token implementation
- **Timer Module** - Scheduled tasks

## 🔐 Google Sign-In Setup

- Env vars (create `src/frontend/.env.local`):
  - `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` = iOS OAuth client ID (ends with `.apps.googleusercontent.com`)
  - `EXPO_PUBLIC_GOOGLE_CLIENT_ID` = Web OAuth client ID (for Expo Go / web proxy)
  - `EXPO_PUBLIC_AUTH_PROXY_URL` = `https://auth.expo.dev/@<your-expo-account>/<project-slug>`

- Google Cloud Console:
  - iOS client: Bundle ID `com.spotquest.app`
  - Web client: Add `EXPO_PUBLIC_AUTH_PROXY_URL` to Authorized redirect URIs

- Run and verify:
  - Expo Go: uses Web/Proxy flow. Log shows `usingIOSClient: false` and redirect includes `auth.expo.dev`
  - Dev Client/Standalone iOS: uses native flow. Log shows `usingIOSClient: true` and redirect like `com.googleusercontent.apps.<id>:/oauthredirect`

- Troubleshooting:
  - `invalid_request`: most often redirect URI mismatch or missing nonce. Check env, proxy URL, and logs printed by `GoogleAuth config`.

## 🔮 Future Roadmap

### Phase 1: Azimuth Scoring (Q1 2024)
Currently, only distance affects scoring. We plan to implement compass direction scoring:
```
Azimuth Score = 1 - (angle_difference / 30°)
Combined Score = Distance^1.3 × Azimuth^0.7
```

### Phase 2: Pro Features (Q2 2024)
- Custom photo collections
- Private leagues
- Advanced statistics
- NFT photo ownership

### Phase 3: Global Expansion (Q3 2024)
- Multi-language support
- Regional leaderboards
- Cultural landmarks mode
- Educational partnerships

### Phase 4: Ecosystem Development (Q4 2024)
- Photo marketplace
- Creator tools
- API for third-party integration
- DAO governance

## 🏆 Why SpotQuest Stands Out

1. **First Mobile-Native ICP Game**: Pioneering React Native + ICP integration
2. **Innovative Tokenomics**: Self-sustaining economy with automatic balancing
3. **Real Utility**: Photos have inherent value through gameplay
4. **Technical Excellence**: Solved complex challenges in II authentication and data storage
5. **User Experience**: Blockchain complexity hidden behind intuitive interface

---

<a id="japanese"></a>
## 🌍 SpotQuest: 写真とブロックチェーンゲームが出会う場所

SpotQuestは、Internet Computer Protocol (ICP) 上に構築された革新的な写真ベースの位置当てゲームです。位置推測の中毒性のあるゲームプレイとブロックチェーン技術、トークノミクスを組み合わせています。プレイヤーは実際の写真を通じて世界を探索し、その場所を推測し、正確な予測に対してSPOTトークンを獲得します。

### 🎯 ビジョンとミッション

**ビジョン**: すべての写真が新しい場所を発見し、報酬を獲得するためのゲートウェイとなる、世界初の真に分散化された写真探索ゲームを作成する。

**ミッション**: 複雑さを排除しながらブロックチェーン技術の力を示す、直感的でやりがいのある体験を提供することで、カジュアルモバイルゲームとWeb3のギャップを埋める。

### 🚀 なぜInternet Computerなのか？

ICPの独自の機能を選んだ理由：
- **100%オンチェーン**: すべてのゲームロジック、写真ストレージ、トークン取引が完全にオンチェーンで実行
- **Webスピード**: サブ秒のファイナリティがリアルタイムゲーム体験を可能に
- **リバースガスモデル**: プレイヤーは取引手数料を支払わない - ゲームがすべてのコストを処理
- **ステーブルメモリ**: 従来のデータベース依存なしの永続的なデータストレージ
- **Internet Identity**: シードフレーズなしのシームレスなWeb3認証

## 🎮 ゲームメカニクス

### コアゲームプレイループ

1. **セッション開始**: プレイヤーは5ラウンドのゲームセッションを開始
2. **写真を見る**: GPSメタデータが隠された実世界の写真
3. **推測する**: インタラクティブマップにピンをドロップ
4. **ポイント獲得**: 距離の精度に基づいて0-5000ポイントを獲得
5. **報酬獲得**: セッション完了でSPOTトークンを受け取る

### スコアリングシステム

```
距離スコア = 5000 × e^(-0.15 × 距離_km)

完璧な推測 (≤10m) = 5000ポイント
1km離れ ≈ 4300ポイント
10km離れ ≈ 1100ポイント
50km離れ ≈ 30ポイント
```

### トークンエコノミー

- **トークン**: SPOT (SpotQuest Token)
- **供給量**: 10,000,000 SPOT (固定)
- **小数点**: 2桁
- **プレイヤー報酬**: 完了セッションごとに200 SPOT
- **アップローダー報酬**: 写真がプレイされた時のプレイヤー報酬の30%

## 🏗️ 技術アーキテクチャ

### 統一キャニスターアーキテクチャ

すべての機能を統合するモノリシックキャニスター設計を実装：

```
unified_canister/
├── TokenModule (ICRC-1)      # SPOTトークン実装
├── GameEngineModule          # コアゲームロジック
├── PhotoModuleV2             # 写真保存と取得
├── RatingModule              # 5つ星評価システム
├── EloRatingModule           # 動的難易度
├── TreasuryModule            # 自動トークン配布
├── PlayerStatsModule         # 統計追跡
└── IIIntegrationModule       # Internet Identity
```

**利点**:
- モジュール間のアトミック操作
- デプロイとアップグレードの簡素化
- キャニスター間呼び出しの削減
- 単一の真実の情報源

### モバイルファースト開発

最適なモバイル体験のためReact Native + Expoで構築：
- iOSとAndroidでのネイティブパフォーマンス
- カメラとGPSへのハードウェアアクセス
- スマートキャッシングによるオフライン機能
- ゲームイベントのプッシュ通知

## 🔧 技術的な課題と解決策

### 1. Expo環境でのInternet Identity

**課題**: Internet IdentityはWebブラウザ用に設計されたpostMessage APIを使用し、React NativeのWebViewと互換性がない。

**私たちの道のり**:
1. **最初の試み**: JavaScriptブリッジを注入したカスタムWebView
2. **2回目の試み**: トークン傍受を使用したAuthSession
3. **最終解決策**: カスタムパッチを適用したexpo-ii-integrationパッケージ

**主な学び**:
- WebViewのJavaScriptコンテキスト分離により、直接的なpostMessage傍受が不可能
- ExpoのAuthSessionがII用の正しいブラウザ環境を提供
- React Native互換性のためのcryptoとstorageモジュールの広範なパッチが必要

**実装詳細**:
```typescript
// アプリ起動時に適用される重要なパッチ
patchEd25519KeyIdentity();      // キー生成の修正
patchExpoIIIntegration();        // II通信の有効化
patchStorageForIIIntegration();  // モバイル用ストレージの適応
patchIIIntegrationFetch();       // ネットワークリクエストの処理
```

### 2. チャンクベースの写真アップロードシステム

**課題**: ICPメッセージサイズ制限2MB vs 典型的な写真サイズ5-10MB。

**解決策**: チャンクアップロードプロトコルの実装：
```
1. createPhotoV2() → アップロードIDを返す
2. uploadPhotoChunkV2() → 1MBチャンクをアップロード
3. finalizePhotoUploadV2() → 再構築して保存
```

**機能**:
- チャンクごとの進捗追跡
- 失敗時の自動リトライ
- 並列チャンク処理
- 整合性検証

### 3. リアルタイムトークンエコノミー

**課題**: 外部オラクルやタイミングサービスなしでトークン配布を管理。

**解決策**: 自己調整型トレジャリーシステム：
- ゲーム完了に基づく自動報酬計算
- トレジャリー残高監視
- 供給量の5%を超えた時の自動バーンメカニズム
- 外部依存なし

## 🌟 革新的な機能

### 1. Eloレーティングシステム
- **動的難易度**: 写真とプレイヤーがEloレーティングを持つ
- **マッチメイキング**: プレイヤーは適切に挑戦的な写真に直面
- **進行**: 写真の難易度に対するパフォーマンスに基づいてレーティングが変化

### 2. 5つ星写真評価システム
プレイヤーは3つの次元で写真を評価：
- **難易度**: 推測の難しさ
- **興味**: 場所の魅力度
- **美しさ**: 視覚的魅力

評価が影響するもの：
- 写真選択アルゴリズム
- アップローダーの評判
- ボーナス報酬

### 3. 高度な写真管理
- **GeoHashインデックス**: 効率的な位置ベースのクエリ
- **シーン分類**: 自然、建物、店舗、施設
- **タグシステム**: コミュニティ主導の分類
- **品質スコアリング**: 低品質アップロードの自動検出

### 4. 包括的なプレイヤー統計
- 総ゲーム数/完了ゲーム数
- ベストスコアとストリーク
- 30日間のローリング統計
- 時間ベースのパフォーマンス分析
- トークン獲得履歴

### 5. 評判システム
- アップロード品質が評判に影響（0.0-1.0スコア）
- 高い評判で機能がアンロック
- 悪質な行為者は自動的に制限
- コミュニティ主導のモデレーション

## 🛠️ 技術スタック

### フロントエンド
- **React Native** 0.79.4 - クロスプラットフォームモバイルフレームワーク
- **Expo** 53.0.13 - 開発プラットフォームとビルドツール
- **TypeScript** 5.8.3 - 型安全性
- **NativeWind** 4.1.23 - React Native用Tailwind CSS
- **Zustand** 4.5.0 - 状態管理
- **React Navigation** 6.x - ナビゲーション
- **React Native Maps** 1.20.1 - インタラクティブマップ

### ICP統合
- **@dfinity/agent** 0.20.2 - ICP通信
- **expo-ii-integration** 0.1.24 - Expo用Internet Identity
- **canister-manager** 0.1.7 - 簡素化されたキャニスター相互作用

### バックエンド (Motoko)
- **Stable Memory** - 永続ストレージ
- **Certified Assets** - セキュアなコンテンツ配信
- **ICRC-1標準** - トークン実装
- **Timerモジュール** - スケジュールされたタスク

## 🔮 今後のロードマップ

### フェーズ1: 方位角スコアリング (2024年Q1)
現在、距離のみがスコアに影響します。コンパス方向スコアリングの実装を計画：
```
方位角スコア = 1 - (角度差 / 30°)
総合スコア = 距離^1.3 × 方位角^0.7
```

### フェーズ2: プロ機能 (2024年Q2)
- カスタム写真コレクション
- プライベートリーグ
- 高度な統計
- NFT写真所有権

### フェーズ3: グローバル展開 (2024年Q3)
- 多言語サポート
- 地域別リーダーボード
- 文化的ランドマークモード
- 教育パートナーシップ

### フェーズ4: エコシステム開発 (2024年Q4)
- 写真マーケットプレイス
- クリエイターツール
- サードパーティ統合用API
- DAOガバナンス

## 🏆 SpotQuestが際立つ理由

1. **初のモバイルネイティブICPゲーム**: React Native + ICP統合の先駆者
2. **革新的なトークノミクス**: 自動バランシングを備えた自己持続型経済
3. **実用性**: ゲームプレイを通じて写真が本質的な価値を持つ
4. **技術的卓越性**: II認証とデータストレージの複雑な課題を解決
5. **ユーザー体験**: 直感的なインターフェースの背後にブロックチェーンの複雑さを隠蔽
