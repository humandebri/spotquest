# Backend v1.0 Implementation Plan

## 概要
このドキュメントは、Guess-the-Spot v1.0設計に基づくバックエンドの修正計画を詳述します。

## アーキテクチャ概要

### Canister間の依存関係
```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  PhotoNFT   │────►│ GameEngine  │────►│  GuessHistory   │
└─────────────┘     └──────┬──────┘     └────────┬────────┘
                           │                      │
                           ▼                      ▼
                    ┌─────────────┐     ┌─────────────────┐
                    │ RewardMint  │◄────│ReputationOracle │
                    └─────────────┘     └─────────────────┘
```

## 1. 新規Canisterの追加

### 1.1 GuessHistory Canister
**目的**: 推測データの保存、集計、ヒートマップAPI提供

```motoko
// src/backend/guess_history/main.mo
import TrieMap "mo:base/TrieMap";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";

actor GuessHistory {
    // 効率的なデータ構造
    private var guessRecords = TrieMap.TrieMap<Nat, Buffer.Buffer<Guess>>(Nat.equal, Hash.hash);
    private stable var guessRecordsStable : [(Nat, [Guess])] = [];
    
    // 品質評価用の集計データ
    private var photoStats = TrieMap.TrieMap<Nat, PhotoStats>(Nat.equal, Hash.hash);
    private stable var photoStatsStable : [(Nat, PhotoStats)] = [];
    
    // メモリ管理用のチャンク化
    private stable var guessChunks : [var ?[Guess]] = Array.init(1000, null);
    private stable var chunkSize = 1000; // 1チャンクあたりのGuess数
    
    public type Guess = {
        player: Principal;
        photoId: Nat;
        lat: Float;
        lon: Float;
        dist: Float;
        sessionId: Text;
        timestamp: Time.Time;
    };
    
    public type PhotoStats = {
        totalGuesses: Nat;
        medianDistance: Float;
        averageDistance: Float;
        qualityScore: Float;
        lastUpdated: Time.Time;
    };
    
    // Stable memory management
    system func preupgrade() {
        guessRecordsStable := [];
        photoStatsStable := [];
        // チャンク単位でシリアライズ
        for ((photoId, guesses) in guessRecords.entries()) {
            guessRecordsStable := Array.append(guessRecordsStable, [(photoId, Buffer.toArray(guesses))]);
        };
    };
    
    system func postupgrade() {
        // データ復元
        for ((photoId, guesses) in guessRecordsStable.vals()) {
            let buffer = Buffer.Buffer<Guess>(guesses.size());
            for (guess in guesses.vals()) {
                buffer.add(guess);
            };
            guessRecords.put(photoId, buffer);
        };
        guessRecordsStable := [];
    };
}
```

## 2. 既存Canisterの修正

### 2.1 GameEngine Canister
**主な変更点**: セッション管理、リトライ機能、新スコアリング、エラーリカバリー

```motoko
// セッション管理の詳細設計
import TrieMap "mo:base/TrieMap";
import Timer "mo:base/Timer";

public type SessionManager = {
    activeSessions: TrieMap.TrieMap<Principal, [Text]>; // ユーザー毎のセッションID
    sessionTimeouts: TrieMap.TrieMap<Text, Time.Time>;
    maxConcurrentSessions: Nat; // = 2
    sessionTimeout: Nat; // = 30分 (ナノ秒)
};

public type GameSession = {
    id: Text;
    userId: Principal;
    rounds: [var RoundState]; // 可変配列で効率化
    currentRound: Nat;
    totalScore: Nat;
    totalScoreNorm: Nat;  // 0-100正規化スコア
    retryCount: Nat;
    startTime: Time.Time;
    endTime: ?Time.Time;
    lastActivity: Time.Time; // タイムアウト管理用
};

public type RoundState = {
    photoId: Nat;
    status: {#Active; #Completed; #Retried};
    score: Nat;           // 0-5000表示用
    scoreNorm: Nat;       // 0-100報酬用
    guessData: ?GuessData;
    retryAvailable: Bool;
    hintsPurchased: [HintType];
};

// 新規API（エラーリカバリー付き）
public shared(msg) func createSession() : async Result.Result<Text, Text> {
    // 同時セッション数チェック
    let userSessions = switch(activeSessions.get(msg.caller)) {
        case null { [] };
        case (?sessions) { sessions };
    };
    
    if (userSessions.size() >= maxConcurrentSessions) {
        return #err("Maximum concurrent sessions reached");
    };
    
    // セッション作成
    let sessionId = generateSessionId();
    let session = createNewSession(msg.caller, sessionId);
    
    // トランザクション的な処理
    try {
        sessions.put(sessionId, session);
        updateUserSessions(msg.caller, sessionId);
        #ok(sessionId);
    } catch (e) {
        // ロールバック
        sessions.delete(sessionId);
        #err("Failed to create session: " # Error.message(e));
    };
};

// スコアリング関数の更新（固定小数点演算版）
private func calculateScoreFixed(distanceMeters: Nat) : (Nat, Nat) {
    let PRECISION = 1000000; // 6桁精度
    
    // 表示用スコア (0-5000) - 固定小数点
    let alpha = 13 * PRECISION;
    let beta = 1300; // 1.3 * 1000
    
    // 距離をPRECISION単位に変換
    let d = distanceMeters * PRECISION / 1000; // メートルをキロメートルに
    
    // べき乗計算の近似（テーラー展開）
    let dPowBeta = approximatePower(d, beta, PRECISION);
    
    let scoreFixed = 5000 * PRECISION - (alpha * dPowBeta / PRECISION);
    let displayScore = if (scoreFixed < 0) { 0 } else { 
        Nat.min(5000, scoreFixed / PRECISION) 
    };
    
    // 報酬用スコア (0-100)
    let normScore = (displayScore + 49) / 50;
    
    (displayScore, normScore);
};

// タイムアウト処理
system func heartbeat() : async () {
    await cleanupExpiredSessions();
};

private func cleanupExpiredSessions() : async () {
    let now = Time.now();
    for ((sessionId, timeout) in sessionTimeouts.entries()) {
        if (now > timeout) {
            await forceEndSession(sessionId);
        };
    };
};
```

### 2.2 RewardMint Canister
**主な変更点**: Sink機能追加、Treasury管理強化、固定小数点演算

```motoko
// 追加する定数とSink管理
private stable var RETRY_FEE : Nat = 200; // 2.00 SPOT
private stable var HINT_BASIC_FEE : Nat = 100; // 1.00 SPOT
private stable var HINT_PREMIUM_FEE : Nat = 300; // 3.00 SPOT
private stable var PROPOSAL_FEE : Nat = 1000; // 10.00 SPOT
private stable var BOOST_FEE : Nat = 500; // 5.00 SPOT

// Treasury管理
private stable var treasuryBalance : Nat = 0;
private stable var totalSinkAmount : Nat = 0;
private stable var sinkHistory : [(Time.Time, SinkType, Nat)] = [];

public type SinkType = {
    #Retry;
    #HintBasic;
    #HintPremium;
    #Proposal;
    #Boost;
    #PlayFee;
};

// 新規API（二重支払い防止付き）
public shared(msg) func processSinkPayment(
    sinkType: SinkType, 
    transactionId: Text // 冪等性のため
) : async Result.Result<(), Text> {
    // 重複チェック
    if (processedTransactions.get(transactionId) != null) {
        return #err("Transaction already processed");
    };
    
    let amount = getSinkAmount(sinkType);
    let balance = balances.get(msg.caller);
    
    switch(balance) {
        case null { #err("Insufficient balance") };
        case (?bal) {
            if (bal < amount) {
                return #err("Insufficient balance");
            };
            
            // アトミックな処理
            balances.put(msg.caller, bal - amount);
            treasuryBalance += amount;
            totalSinkAmount += amount;
            processedTransactions.put(transactionId, Time.now());
            
            // 記録
            sinkHistory := Array.append(sinkHistory, [(Time.now(), sinkType, amount)]);
            
            #ok()
        };
    };
};

// 報酬計算の更新（固定小数点版）
private func calculateRewardFixed(scoreNorm: Nat, totalRounds: Nat) : (Nat, Nat) {
    let PRECISION = 1000000; // 6桁精度
    
    // B(t) = 1 / (1 + 0.05 * t) where t is in 10k round units
    let t = totalRounds / 10000;
    let decay = PRECISION * 100 / (100 + 5 * t); // 固定小数点でのB(t)
    
    // Y = 0.02 * (scoreNorm/100) * B(t)
    // 0.02 = 20000 / PRECISION
    let baseRewardFixed = 20000 * scoreNorm * decay / (100 * PRECISION);
    let playerReward = baseRewardFixed / 10000; // SPOT単位に変換（decimals=2）
    
    // アップローダー報酬は30%
    let uploaderReward = playerReward * 30 / 100;
    
    (playerReward, uploaderReward)
};

// Treasury自動処理
public shared(msg) func executeTreasuryAction(action: TreasuryAction) : async Result.Result<(), Text> {
    // 権限チェック
    if (not isAuthorized(msg.caller)) {
        return #err("Unauthorized");
    };
    
    switch(action) {
        case (#Burn(amount)) {
            if (treasuryBalance < amount) {
                return #err("Insufficient treasury balance");
            };
            treasuryBalance -= amount;
            totalSupply -= amount;
            totalBurned += amount;
            #ok()
        };
        case (#Transfer(to, amount)) {
            if (treasuryBalance < amount) {
                return #err("Insufficient treasury balance");
            };
            treasuryBalance -= amount;
            switch(balances.get(to)) {
                case null { balances.put(to, amount) };
                case (?bal) { balances.put(to, bal + amount) };
            };
            #ok()
        };
        case (#AutoBurn) {
            // 閾値超過時の自動バーン
            let threshold = totalSupply * 5 / 100; // 総供給量の5%
            if (treasuryBalance > threshold) {
                let burnAmount = treasuryBalance - threshold;
                treasuryBalance = threshold;
                totalSupply -= burnAmount;
                totalBurned += burnAmount;
            };
            #ok()
        };
    };
};
```

### 2.3 ReputationOracle Canister
**主な変更点**: GuessHistoryとの連携、Quality計算の更新

```motoko
// 新しいQuality計算
public shared(msg) func updatePhotoQuality(
    photoId: Nat, 
    medianDistance: Float
) : async Result.Result<Float, Text> {
    // Q = 1 - clamp(d_median / 300, 0, 1)
    let normalizedDist = Float.min(1.0, medianDistance / 300.0);
    let newQuality = 1.0 - normalizedDist;
    
    // Update photo quality
    photoQualities.put(photoId, newQuality);
    
    // Apply consequences if Q < 0.2
    if (newQuality < 0.2) {
        await adjustPhotoFrequency(photoId, 0.1); // 10% of normal frequency
        await adjustPhotoRewardMultiplier(photoId, 0.5); // 50% rewards
    };
    
    #ok(newQuality);
};
```

### 2.4 PhotoNFT Canister
**主な変更点**: Boost機能、Quality表示

```motoko
// 追加するフィールド
public type PhotoMetaV2 = {
    // 既存フィールド...
    boostLevel: Nat;        // 0-3 (normal, bronze, silver, gold)
    boostExpiry: ?Time.Time;
    fixRequests: [FixRequest];
};

// Boost機能
public shared(msg) func boostPhoto(
    photoId: Nat, 
    boostType: BoostType
) : async Result.Result<(), Text>;
```

## 3. 実装フェーズ（改訂版）

### Phase 1: 基盤整備 (3週間)
1. GuessHistory Canisterの新規作成
   - Stable memory設計とチャンク化実装
   - 効率的なデータ構造（TrieMap）の実装
2. 共通型定義の更新 (types/game.mo, types/photo.mo)
3. GameEngineのセッション管理基盤
   - SessionManager実装
   - タイムアウト処理の実装

### Phase 2: コア機能実装 (4週間)
1. GameEngineのセッション制実装
   - 同時セッション制限
   - エラーリカバリー機構
2. 新スコアリングシステム（固定小数点版）
3. RewardMintのSink機能
   - 二重支払い防止
   - トランザクション履歴管理
4. Treasury管理機能
   - 自動バーン機能
   - 権限管理システム

### Phase 3: データ活用機能 (2週間)
1. GuessHistoryのヒートマップAPI
2. ReputationOracleのQuality自動評価
3. PhotoNFTのBoost機能

### Phase 4: 統合・テスト (3週間)
1. Canister間の連携テスト
2. トークンフローのE2Eテスト
3. 負荷テスト・パフォーマンス測定
4. セキュリティ監査準備

**合計期間: 12週間**

## 4. データマイグレーション

### 4.1 既存データの保持
- 既存のゲームラウンドデータは保持
- 新しいセッションIDを既存ラウンドに後付け

### 4.2 スコアの変換
```motoko
// 既存の100点満点スコアから新形式への変換
private func migrateScore(oldScore: Nat) : (Nat, Nat) {
    let displayScore = oldScore * 50; // 0-5000
    let normScore = oldScore;         // 0-100
    (displayScore, normScore);
};
```

## 5. セキュリティ考慮事項

1. **Sink支払い検証**: 二重支払い防止
2. **セッション整合性**: 同時セッション制限
3. **Treasury権限**: マルチシグ準備
4. **レート制限**: Hint/Retry乱用防止

## 6. パフォーマンス最適化

1. **バッチ処理**: セッション終了時の一括処理
2. **キャッシュ**: 頻繁にアクセスされるQualityデータ
3. **インデックス**: PhotoId → Guess検索の高速化

## 7. 今後の拡張性

1. **DAO統合準備**: Proposal/Voting機能のインターフェース
2. **ステーキング準備**: 残高ロック機能
3. **APIバージョニング**: 将来の仕様変更に対応

## 8. テスト計画

### 単体テスト
- 各Canisterの新機能
- スコア計算の正確性
- トークン計算の検証

### 統合テスト
- セッションライフサイクル
- Canister間通信
- エラーハンドリング

### 負荷テスト
- 同時セッション数の限界
- GuessHistory書き込み性能
- ヒートマップAPI応答時間

---

## 実装優先順位

1. **必須機能** (MVP):
   - セッション管理
   - 新スコアリング
   - 基本的なSink (Retry/Hint)

2. **重要機能** (v1.0):
   - GuessHistory
   - Quality自動評価
   - Treasury管理

3. **拡張機能** (v1.1以降):
   - コミュニティ修正
   - 高度なヒント機能
   - DAO統合

## 9. 監視とアラート

### 9.1 メトリクス収集
```motoko
public type Metrics = {
    canisterMemoryUsage: Nat;
    activeSessionCount: Nat;
    dailyActiveUsers: Nat;
    totalTransactions: Nat;
    errorRate: Float;
    averageResponseTime: Nat; // ナノ秒
    treasuryBalance: Nat;
    totalSupply: Nat;
};

public shared query func getMetrics() : async Metrics {
    {
        canisterMemoryUsage = Prim.rts_memory_size();
        activeSessionCount = sessions.size();
        dailyActiveUsers = calculateDAU();
        totalTransactions = transactionCount;
        errorRate = Float.fromInt(errorCount) / Float.fromInt(totalRequests);
        averageResponseTime = totalResponseTime / totalRequests;
        treasuryBalance = treasuryBalance;
        totalSupply = totalSupply;
    }
};
```

### 9.2 アラート条件
- Canister容量 > 3GB → 警告
- エラー率 > 5% → 警告
- Treasury残高 > 総供給量の10% → 自動バーン検討
- 同時セッション数 > 1000 → スケーリング検討

## 10. 運用手順書

### 10.1 アップグレード手順
```bash
# 1. バックアップ
dfx canister call guess_history exportData > backup.json

# 2. アップグレード前チェック
dfx canister call guess_history preupgradeCheck

# 3. アップグレード実行
dfx canister install --mode upgrade guess_history

# 4. 動作確認
dfx canister call guess_history postUpgradeCheck
```

### 10.2 障害対応フロー
1. **症状確認**
   - エラーログ収集
   - メトリクス確認
   - ユーザー影響範囲特定

2. **一次対応**
   - 問題のあるセッションの強制終了
   - 一時的な機能制限（サーキットブレーカー）

3. **根本対応**
   - ホットフィックス適用
   - データ整合性チェック
   - 段階的復旧

### 10.3 バックアップ・リストア
```motoko
// 定期バックアップ
public shared(msg) func exportData() : async BackupData {
    assert(isAdmin(msg.caller));
    {
        guesses = Iter.toArray(guessRecords.entries());
        stats = Iter.toArray(photoStats.entries());
        timestamp = Time.now();
    }
};

// リストア
public shared(msg) func restoreData(data: BackupData) : async Result.Result<(), Text> {
    assert(isAdmin(msg.caller));
    // データ検証後、リストア実行
};
```

## 11. スケーラビリティ対策

### 11.1 Canisterシャーディング
```motoko
// PhotoIdベースのシャーディング
actor class GuessHistoryShard(shardId: Nat) {
    private func belongsToShard(photoId: Nat) : Bool {
        (photoId % TOTAL_SHARDS) == shardId
    };
    
    public shared func recordGuess(guess: Guess) : async Result.Result<(), Text> {
        if (not belongsToShard(guess.photoId)) {
            return #err("Wrong shard");
        };
        // 記録処理
    };
};
```

### 11.2 段階的ロールアウト
1. **カナリアリリース**: 5%のユーザーで新機能テスト
2. **機能フラグ**: ランタイムで機能のON/OFF切り替え
3. **ロールバック準備**: 問題発生時の即座の切り戻し