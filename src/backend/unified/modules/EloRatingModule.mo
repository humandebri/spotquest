import TrieMap "mo:base/TrieMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Hash "mo:base/Hash";
import PhotoModuleV2 "PhotoModuleV2";

module {
    // ======================================
    // 型定義
    // ======================================
    
    /// プレイヤーレーティング
    public type PlayerRating = {
        principal: Principal;
        rating: Int;              // Eloレーティング（初期値1500）
        gamesPlayed: Nat;         // プレイしたゲーム数
        wins: Nat;                // 勝利数（スコア > 平均スコア）
        losses: Nat;              // 敗北数
        draws: Nat;               // 引き分け数
        lastUpdated: Time.Time;
        highestRating: Int;       // 最高到達レーティング
        lowestRating: Int;        // 最低レーティング
    };
    
    /// 写真レーティング
    public type PhotoRating = {
        photoId: Nat;
        rating: Int;              // 写真の難易度レーティング（初期値1500）
        averageScore: Float;      // 現在の平均スコア
        playCount: Nat;           // プレイされた回数
        totalScore: Nat;          // 累計スコア
        lastUpdated: Time.Time;
    };
    
    /// レーティング変更記録
    public type RatingChange = {
        timestamp: Time.Time;
        playerId: Principal;
        photoId: Nat;
        playerRatingBefore: Int;
        playerRatingAfter: Int;
        photoRatingBefore: Int;
        photoRatingAfter: Int;
        playerScore: Nat;
        photoAvgScore: Float;
        result: Float;           // 1.0=勝利, 0.5=引き分け, 0.0=敗北
    };
    
    // ======================================
    // 定数
    // ======================================
    
    let INITIAL_RATING : Int = 1500;     // 初期レーティング
    let MAX_RATING : Int = 2500;         // レーティング上限
    let MIN_RATING : Int = 100;          // レーティング下限（0以下にならないように）
    let DRAW_THRESHOLD : Float = 0.02;   // 引き分け判定の閾値（±2%）
    
    // ======================================
    // EloRatingManagerクラス
    // ======================================
    public class EloRatingManager(photoManagerV2: PhotoModuleV2.PhotoManager) {
        // PhotoModuleV2への参照
        private let photoManager = photoManagerV2;
        
        // ✨ Stableストレージ（永続化）
        private var stablePlayerRatingsEntries : [(Principal, PlayerRating)] = [];
        private var stablePhotoRatingsEntries : [(Nat, PhotoRating)] = [];
        private var stableRatingHistoryEntries : [(Text, RatingChange)] = [];
        
        // TrieMapでのアクセス
        private var playerRatings = TrieMap.fromEntries<Principal, PlayerRating>(
            stablePlayerRatingsEntries.vals(), 
            Principal.equal, 
            Principal.hash
        );
        private var photoRatings = TrieMap.fromEntries<Nat, PhotoRating>(
            stablePhotoRatingsEntries.vals(), 
            Nat.equal, 
            Hash.hash
        );
        private var ratingHistory = TrieMap.fromEntries<Text, RatingChange>(
            stableRatingHistoryEntries.vals(), 
            Text.equal, 
            Text.hash
        );
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        /// ゲーム結果を処理してレーティングを更新
        public func processGameResult(
            playerId: Principal,
            photoId: Nat,
            playerScore: Nat
        ) : Result.Result<{
            playerRatingChange: Int;
            newPlayerRating: Int;
            photoRatingChange: Int;
            newPhotoRating: Int;
        }, Text> {
            // 1. 現在のレーティングを取得（なければ初期値）
            let currentPlayerRating = switch (playerRatings.get(playerId)) {
                case (?rating) { rating.rating };
                case null { INITIAL_RATING };
            };
            
            let (currentPhotoRating, photoAvgScore) = switch (photoRatings.get(photoId)) {
                case (?rating) { (rating.rating, rating.averageScore) };
                case null { 
                    // 写真のレーティングがない場合は、写真の統計から計算
                    switch (photoManager.getPhotoStatsById(photoId)) {
                        case (?stats) {
                            let avgScore = if (stats.playCount > 0) {
                                Float.fromInt(stats.totalScore) / Float.fromInt(stats.playCount)
                            } else { 0.0 };
                            (INITIAL_RATING, avgScore)
                        };
                        case null { (INITIAL_RATING, 0.0) };
                    }
                };
            };
            
            // 2. 勝敗判定
            let result = determineResult(playerScore, photoAvgScore);
            
            // 3. レーティング計算
            let updates = updateRatings(
                currentPlayerRating,
                currentPhotoRating,
                result
            );
            
            // 4. プレイヤーレーティングを更新
            updatePlayerRating(playerId, updates.newPlayerRating, result);
            
            // 5. 写真レーティングと統計を更新
            updatePhotoRating(photoId, updates.newPhotoRating, playerScore);
            
            // 6. 履歴を記録
            let now = Time.now();
            let changeId = Principal.toText(playerId) # "_" # Nat.toText(photoId) # "_" # Int.toText(now);
            ratingHistory.put(changeId, {
                timestamp = now;
                playerId = playerId;
                photoId = photoId;
                playerRatingBefore = currentPlayerRating;
                playerRatingAfter = updates.newPlayerRating;
                photoRatingBefore = currentPhotoRating;
                photoRatingAfter = updates.newPhotoRating;
                playerScore = playerScore;
                photoAvgScore = photoAvgScore;
                result = result;
            });
            
            #ok({
                playerRatingChange = updates.playerRatingChange;
                newPlayerRating = updates.newPlayerRating;
                photoRatingChange = updates.photoRatingChange;
                newPhotoRating = updates.newPhotoRating;
            })
        };
        
        /// プレイヤーのレーティングを取得
        public func getPlayerRating(playerId: Principal) : Int {
            switch (playerRatings.get(playerId)) {
                case (?rating) { rating.rating };
                case null { INITIAL_RATING };
            }
        };
        
        /// プレイヤーの詳細レーティング情報を取得
        public func getPlayerRatingDetails(playerId: Principal) : ?PlayerRating {
            playerRatings.get(playerId)
        };
        
        /// 写真のレーティングを取得
        public func getPhotoRating(photoId: Nat) : Int {
            switch (photoRatings.get(photoId)) {
                case (?rating) { rating.rating };
                case null { INITIAL_RATING };
            }
        };
        
        /// トップレーティングのプレイヤーを取得
        public func getTopPlayersByRating(limit: Nat) : [(Principal, Int)] {
            let allRatings = Iter.toArray(
                Iter.map<(Principal, PlayerRating), (Principal, Int)>(
                    playerRatings.entries(),
                    func((p, r)) = (p, r.rating)
                )
            );
            
            // レーティング順にソート（降順）
            let sorted = Array.sort<(Principal, Int)>(
                allRatings,
                func(a, b) {
                    if (a.1 > b.1) { #less }
                    else if (a.1 < b.1) { #greater }
                    else { #equal }
                }
            );
            
            // 上位N件を返す
            let actualLimit = Nat.min(limit, sorted.size());
            Array.tabulate<(Principal, Int)>(
                actualLimit,
                func(i) = sorted[i]
            )
        };
        
        /// プレイヤーのランクを取得
        public func getPlayerRank(playerId: Principal) : ?Nat {
            let allRatings = getTopPlayersByRating(1000); // 上位1000人まで
            var rank : Nat = 1;
            for ((p, _) in allRatings.vals()) {
                if (Principal.equal(p, playerId)) {
                    return ?rank;
                };
                rank += 1;
            };
            
            // 1000位以内にいない場合
            if (playerRatings.get(playerId) != null) {
                ?rank // 1001位以降として扱う
            } else {
                null // レーティングなし
            }
        };
        
        // ======================================
        // PRIVATE FUNCTIONS
        // ======================================
        
        /// 勝敗判定（±2%を引き分けとする）
        private func determineResult(playerScore: Nat, avgScore: Float) : Float {
            let playerScoreFloat = Float.fromInt(playerScore);
            let upperBound = avgScore * (1.0 + DRAW_THRESHOLD);
            let lowerBound = avgScore * (1.0 - DRAW_THRESHOLD);
            
            if (playerScoreFloat > upperBound) { 1.0 }      // 勝利
            else if (playerScoreFloat < lowerBound) { 0.0 } // 敗北
            else { 0.5 }                                     // 引き分け
        };
        
        /// 期待勝率を計算（Elo式）
        private func calculateExpectedScore(myRating: Int, opponentRating: Int) : Float {
            1.0 / (1.0 + Float.pow(10.0, Float.fromInt(opponentRating - myRating) / 400.0))
        };
        
        /// 動的K係数を取得
        private func getDynamicK(rating: Int) : Int {
            if (rating < 1600) { 32 }
            else if (rating < 2000) { 24 }
            else { 16 }
        };
        
        /// レーティングを更新
        private func updateRatings(
            currentPlayerRating: Int,
            currentPhotoRating: Int,
            result: Float
        ) : {
            newPlayerRating: Int;
            playerRatingChange: Int;
            newPhotoRating: Int;
            photoRatingChange: Int;
        } {
            // プレイヤー視点の期待値
            let playerExpected = calculateExpectedScore(currentPlayerRating, currentPhotoRating);
            let playerK = getDynamicK(currentPlayerRating);
            let playerChange = Float.toInt(Float.fromInt(playerK) * (result - playerExpected));
            
            // 写真視点の期待値（プレイヤーと逆）
            let photoExpected = 1.0 - playerExpected;
            let photoK = getDynamicK(currentPhotoRating);
            let photoChange = Float.toInt(Float.fromInt(photoK) * ((1.0 - result) - photoExpected));
            
            // 新レーティング（上限・下限を適用）
            let newPlayerRating = Int.max(MIN_RATING, Int.min(currentPlayerRating + playerChange, MAX_RATING));
            let newPhotoRating = Int.max(MIN_RATING, Int.min(currentPhotoRating + photoChange, MAX_RATING));
            
            {
                newPlayerRating = newPlayerRating;
                playerRatingChange = playerChange;
                newPhotoRating = newPhotoRating;
                photoRatingChange = photoChange;
            }
        };
        
        /// プレイヤーレーティングを更新
        private func updatePlayerRating(playerId: Principal, newRating: Int, result: Float) {
            let now = Time.now();
            
            let updated = switch (playerRatings.get(playerId)) {
                case (?existing) {
                    {
                        principal = playerId;
                        rating = newRating;
                        gamesPlayed = existing.gamesPlayed + 1;
                        wins = if (result == 1.0) { existing.wins + 1 } else { existing.wins };
                        losses = if (result == 0.0) { existing.losses + 1 } else { existing.losses };
                        draws = if (result == 0.5) { existing.draws + 1 } else { existing.draws };
                        lastUpdated = now;
                        highestRating = Int.max(existing.highestRating, newRating);
                        lowestRating = Int.min(existing.lowestRating, newRating);
                    }
                };
                case null {
                    {
                        principal = playerId;
                        rating = newRating;
                        gamesPlayed = 1;
                        wins = if (result == 1.0) { 1 } else { 0 };
                        losses = if (result == 0.0) { 1 } else { 0 };
                        draws = if (result == 0.5) { 1 } else { 0 };
                        lastUpdated = now;
                        highestRating = newRating;
                        lowestRating = newRating;
                    }
                };
            };
            
            playerRatings.put(playerId, updated);
        };
        
        /// 写真レーティングを更新
        private func updatePhotoRating(photoId: Nat, newRating: Int, newScore: Nat) {
            let now = Time.now();
            
            let updated = switch (photoRatings.get(photoId)) {
                case (?existing) {
                    let newTotalScore = existing.totalScore + newScore;
                    let newPlayCount = existing.playCount + 1;
                    {
                        photoId = photoId;
                        rating = newRating;
                        averageScore = Float.fromInt(newTotalScore) / Float.fromInt(newPlayCount);
                        playCount = newPlayCount;
                        totalScore = newTotalScore;
                        lastUpdated = now;
                    }
                };
                case null {
                    // 写真の既存統計を取得
                    let (totalScore, playCount) = switch (photoManager.getPhotoStatsById(photoId)) {
                        case (?stats) { (stats.totalScore + newScore, stats.playCount + 1) };
                        case null { (newScore, 1) };
                    };
                    
                    {
                        photoId = photoId;
                        rating = newRating;
                        averageScore = Float.fromInt(totalScore) / Float.fromInt(playCount);
                        playCount = playCount;
                        totalScore = totalScore;
                        lastUpdated = now;
                    }
                };
            };
            
            photoRatings.put(photoId, updated);
        };
        
        // ======================================
        // Stable復元用関数
        // ======================================
        
        /// Stable変数をTrieMapに復元
        public func loadFromStable(
            stablePlayerRatings: [(Principal, PlayerRating)],
            stablePhotoRatings: [(Nat, PhotoRating)],
            stableRatingHistory: [(Text, RatingChange)]
        ) {
            stablePlayerRatingsEntries := stablePlayerRatings;
            stablePhotoRatingsEntries := stablePhotoRatings;
            stableRatingHistoryEntries := stableRatingHistory;
            
            playerRatings := TrieMap.fromEntries<Principal, PlayerRating>(
                stablePlayerRatings.vals(), 
                Principal.equal, 
                Principal.hash
            );
            photoRatings := TrieMap.fromEntries<Nat, PhotoRating>(
                stablePhotoRatings.vals(), 
                Nat.equal, 
                Hash.hash
            );
            ratingHistory := TrieMap.fromEntries<Text, RatingChange>(
                stableRatingHistory.vals(), 
                Text.equal, 
                Text.hash
            );
        };
        
        /// Stable変数として保存用のデータを取得
        public func getStableData() : {
            playerRatings: [(Principal, PlayerRating)];
            photoRatings: [(Nat, PhotoRating)];
            ratingHistory: [(Text, RatingChange)];
        } {
            {
                playerRatings = Iter.toArray(playerRatings.entries());
                photoRatings = Iter.toArray(photoRatings.entries());
                ratingHistory = Iter.toArray(ratingHistory.entries());
            }
        };
    };
}