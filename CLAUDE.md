# Guess-the-Spot アーキテクチャ設計書

## 🔄 最新の作業状況 (2025-06-05)

### 現在の状態
- **フロントエンド**: ViteからExpoに移行完了
- **問題**: Metro Bundlerが正常に起動しない（localhost:8081でアクセス不可）
- **原因**: watchmanが未インストール、Metro設定の問題
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

### GamePlayScreenの主要機能
- 写真表示とズーム機能
- 6種類のヒントシステム（地域、気候、ランドマーク、文化、植生、タイムゾーン）
- インタラクティブな地図（推測マーカー、信頼度半径、方位角ライン）
- リアルタイムスコア予測
- 難易度設定（EASY、NORMAL、HARD、EXTREME）
- タイマーシステム
- 複数のモーダル（ヒント、写真分析、ズーム）

### 未解決の問題
1. **Metro Bundler起動問題**:
   ```bash
   # 解決策1: watchmanインストール
   brew install watchman
   
   # 解決策2: キャッシュクリア
   cd src/frontend
   rm -rf node_modules .expo
   rm -rf $TMPDIR/metro-*
   npm install --legacy-peer-deps
   npx expo start --clear
   ```

2. **依存関係の警告** - `npx expo install --fix`で修正可能

### 次回再開時のステップ
1. Metro Bundler問題の解決
2. 実機でのテスト（Expo Go使用）
3. ICP統合の実装
4. トークン/NFT機能の接続

### ディレクトリ構造
```
src/frontend/
├── App.tsx (現在はシンプル版)
├── App-full.tsx (フルアプリ版)
├── src/
│   ├── screens/ (全画面実装済み)
│   ├── navigation/ (AppNavigator.tsx)
│   ├── services/ (auth.ts)
│   ├── store/ (authStore.ts)
│   └── utils/ (polyfills.ts)
├── package.json (Expo依存関係)
└── metro.config.js (設定ファイル)
```

### 重要なコマンド
```bash
# 開発サーバー起動
cd src/frontend
npx expo start

# テスト用
open https://snack.expo.dev  # オンラインテスト
```

### セキュリティガイドライン
- **セキュリティ対策**: セキュリティホールがないか常にチェックしあれば優先して修正すること

### 開発メモ
- 新しいファイルを作るたびにclaude.meにプロジェクト全体のファイル構成を書き直すこと

---

# Guess-the-Spot アーキテクチャ設計書

## 🏗️ システムアーキテクチャ

### 統合Canister設計 (2025-06-04更新)

レイテンシー削減とパフォーマンス向上のため、すべての機能を単一のcanister (`unified`) に統合しました。

```
┌─────────────────────────────────────────────────┐
│              Unified Canister                    │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐              │
│  │ ICRC-1 Token│  │ ICRC-7 NFT  │              │
│  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐              │
│  │ Game Engine │  │ Reputation  │              │
│  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐              │
│  │User Profile │  │  Security   │              │
│  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────┘
```

### 設計の利点
- **レイテンシー削減**: Inter-canister callsを排除
- **トランザクション効率**: 内部関数呼び出しで即座に実行
- **コスト削減**: 単一canisterでcycles使用量を最小化
- **管理の簡素化**: デプロイとアップグレードが一元化

### 開発メモ
- expoで開発してください

## 📊 データ構造設計

### 1. トークン管理 (ICRC-1)
```motoko
// トークン基本情報
private stable var tokenName = "Guess the Spot Token";
private stable var tokenSymbol = "SPOT";
private stable var tokenDecimals : Nat8 = 2;

// 残高管理
private var tokenBalances = HashMap<Principal, Nat>;
private var tokenAllowances = HashMap<(Principal, Principal), Nat>;

// 経済パラメータ
private stable var tokenTransferFee : Nat = 1;     // 0.01 SPOT
private stable var playFee : Nat = 10;             // 0.10 SPOT
private stable var BASE_REWARD : Nat = 100;        // 1.00 SPOT
private stable var UPLOADER_REWARD_RATIO = 0.30;   // 30%
```

### 2. NFT管理 (ICRC-7)
```motoko
public type PhotoMeta = {
    id: Nat;
    owner: Principal;
    lat: Float;                    // 緯度
    lon: Float;                    // 経度
    azim: Float;                   // 方位角
    timestamp: Time.Time;          // 撮影時刻
    quality: Float;                // 品質スコア
    uploadTime: Time.Time;         // アップロード時刻
    chunkCount: Nat;               // チャンク数
    totalSize: Nat;                // 合計サイズ
    perceptualHash: ?Text;         // 重複検出用ハッシュ
};

// NFT所有権とメタデータ
private var nftOwners = HashMap<Nat, Principal>;
private var photoMetadata = HashMap<Nat, PhotoMeta>;

// Stable Memory管理
private stable var photoRegions : [Region.Region] = [];
private let CHUNK_SIZE = 256 * 1024;  // 256KB
```

### 3. ゲーム管理
```motoko
public type GameRound = {
    id: Nat;
    photoId: Nat;
    photoMeta: PhotoMeta;
    startTime: Time.Time;
    endTime: ?Time.Time;
    correctLat: Float;
    correctLon: Float;
    totalPlayers: Nat;
    totalRewards: Nat;
};

public type GameGuess = {
    player: Principal;
    roundId: Nat;
    guessLat: Float;
    guessLon: Float;
    guessAzim: Float;
    distance: Float;
    azimuthError: Float;
    score: Nat;
    reward: Nat;
    timestamp: Time.Time;
};

// ゲーム状態管理
private var activeRounds = HashMap<Nat, GameRound>;
private var completedRounds = HashMap<Nat, GameRound>;
private var roundGuesses = HashMap<Nat, Buffer<GameGuess>>;
```

### 4. レピュテーション管理
```motoko
public type PhotoReputation = {
    photoId: Nat;
    owner: Principal;
    qualityScore: Float;      // EMA品質スコア
    totalGuesses: Nat;
    correctGuesses: Nat;
    reportCount: Nat;
    lastUpdated: Time.Time;
    isBanned: Bool;
};

public type UserReputation = {
    user: Principal;
    uploaderScore: Float;     // アップローダーとしての評価
    playerScore: Float;       // プレイヤーとしての評価
    totalUploads: Nat;
    totalPlays: Nat;
    isBanned: Bool;
    banReason: ?Text;
    lastUpdated: Time.Time;
};

// レピュテーションパラメータ
private let ALPHA = 0.8;                    // EMA重み
private let SOFT_BAN_THRESHOLD = 0.15;      // ソフトBAN閾値
private let HARD_BAN_THRESHOLD = 0.05;      // ハードBAN閾値
```

### 5. ユーザー管理
```motoko
public type UserProfile = {
    principal: Principal;
    username: ?Text;
    avatar: ?Text;
    totalGamesPlayed: Nat;
    totalPhotosUploaded: Nat;
    totalRewardsEarned: Nat;
    bestScore: Nat;
    joinDate: Time.Time;
};

public type GameHistory = {
    roundId: Nat;
    photoId: Nat;
    score: Nat;
    reward: Nat;
    distance: Float;
    timestamp: Time.Time;
};

public type UserStats = {
    avgScore: Float;
    avgDistance: Float;
    winRate: Float;
    uploaderRating: Float;
    playerRating: Float;
};
```

（以下、既存のドキュメントの残りの部分は省略）

---
*最終更新: 2025-06-04*