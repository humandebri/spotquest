import TrieMap "mo:base/TrieMap";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Option "mo:base/Option";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import PhotoModuleV2 "PhotoModuleV2";

module {
    // ======================================
    // 型定義
    // ======================================
    
    /// 個別の評価レコード
    public type PhotoRating = {
        userId: Principal;
        photoId: Nat;
        sessionId: Text;
        roundIndex: Nat;
        difficulty: Nat;  // 1-5 stars
        interest: Nat;    // 1-5 stars  
        beauty: Nat;      // 1-5 stars
        timestamp: Time.Time;
    };

    /// 写真ごとの集計評価
    public type AggregatedRatings = {
        photoId: Nat;
        difficulty: { total: Nat; count: Nat; average: Float };
        interest: { total: Nat; count: Nat; average: Float };
        beauty: { total: Nat; count: Nat; average: Float };
        lastUpdated: Time.Time;
    };

    /// レート制限データ
    public type RateLimitData = {
        lastRatingTime: Time.Time;
        ratingsInWindow: Nat;
        windowStart: Time.Time;
    };

    /// 評価分布情報
    public type RatingDistribution = {
        difficulty: [Nat]; // [1星の数, 2星の数, ..., 5星の数]
        interest: [Nat];
        beauty: [Nat];
        totalRatings: Nat;
    };

    // ======================================
    // 定数
    // ======================================
    
    // レート制限設定
    let RATE_LIMIT_WINDOW : Nat = 3600_000_000_000; // 1時間（ナノ秒）
    let MAX_RATINGS_PER_WINDOW : Nat = 20; // 1時間あたり最大20評価
    let MAX_RATING_HISTORY_PER_USER : Nat = 1000;

    // ======================================
    // RatingManagerクラス
    // ======================================
    public class RatingManager(photoManagerV2: PhotoModuleV2.PhotoManager) {
        // PhotoModuleV2への参照
        private let photoManager = photoManagerV2;
        
        // ✨ Stableストレージ（永続化） - var変数で管理（main.moからstable restore）
        private var stableRatingsEntries : [(Text, PhotoRating)] = [];
        private var stableAggregatedRatingsEntries : [(Nat, AggregatedRatings)] = [];
        private var stableRateLimitsEntries : [(Principal, RateLimitData)] = [];
        private var stableDistributionsEntries : [(Nat, RatingDistribution)] = [];
        
        // TrieMapでのアクセス（自動復元）
        private var stableRatings = TrieMap.fromEntries<Text, PhotoRating>(stableRatingsEntries.vals(), Text.equal, Text.hash);
        private var stableAggregatedRatings = TrieMap.fromEntries<Nat, AggregatedRatings>(stableAggregatedRatingsEntries.vals(), Nat.equal, Hash.hash);
        private var stableRateLimits = TrieMap.fromEntries<Principal, RateLimitData>(stableRateLimitsEntries.vals(), Principal.equal, Principal.hash);
        private var stableDistributions = TrieMap.fromEntries<Nat, RatingDistribution>(stableDistributionsEntries.vals(), Nat.equal, Hash.hash);
        
        // ユーザーの評価履歴（検索用）
        private var userRatingHistory = TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
        
        // 統計情報
        private var totalRatings : Nat = 0;
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        /// 写真の評価を送信
        public func submitRating(
            userId: Principal,
            sessionId: Text,
            photoId: Nat,
            roundIndex: Nat,
            ratings: {
                difficulty: Nat;
                interest: Nat;
                beauty: Nat;
            }
        ) : Result.Result<Text, Text> {
            // 1. 評価値の検証
            if (ratings.difficulty < 1 or ratings.difficulty > 5 or
                ratings.interest < 1 or ratings.interest > 5 or
                ratings.beauty < 1 or ratings.beauty > 5) {
                return #err("Invalid rating values (must be 1-5)");
            };
            
            // 2. 写真の存在確認と所有者チェック
            switch (photoManager.getPhoto(photoId)) {
                case null { return #err("Photo not found") };
                case (?photo) {
                    // 自分の写真は評価できない
                    if (photo.owner == userId) {
                        return #err("Cannot rate your own photo");
                    };
                };
            };
            
            // 3. レート制限チェック
            switch (checkRateLimit(userId)) {
                case (#err(e)) { return #err(e) };
                case (#ok()) {};
            };
            
            // 4. 重複チェック
            let ratingKey = sessionId # ":" # Nat.toText(photoId);
            switch (stableRatings.get(ratingKey)) {
                case (?_) { return #err("Already rated this photo in this session") };
                case null {};
            };
            
            // 5. 新しい評価を作成
            let now = Time.now();
            let newRating : PhotoRating = {
                userId = userId;
                photoId = photoId;
                sessionId = sessionId;
                roundIndex = roundIndex;
                difficulty = ratings.difficulty;
                interest = ratings.interest;
                beauty = ratings.beauty;
                timestamp = now;
            };
            
            // 6. 保存
            stableRatings.put(ratingKey, newRating);
            
            // 7. ユーザー履歴を更新
            updateUserHistory(userId, photoId);
            
            // 8. 集計を更新
            updateAggregatedRatings(photoId, ratings);
            
            // 9. 分布を更新
            updateDistribution(photoId, ratings);
            
            totalRatings += 1;
            
            #ok("Rating submitted successfully")
        };
        
        /// 写真の集計評価を取得
        public func getPhotoRatings(photoId: Nat) : ?AggregatedRatings {
            stableAggregatedRatings.get(photoId)
        };
        
        /// 複数写真の集計評価を一括取得
        public func getMultiplePhotoRatings(photoIds: [Nat]) : [(Nat, ?AggregatedRatings)] {
            Array.map<Nat, (Nat, ?AggregatedRatings)>(photoIds, func(id) = (id, stableAggregatedRatings.get(id)))
        };
        
        /// ユーザーが特定の写真を評価できるかチェック
        public func canUserRate(userId: Principal, sessionId: Text, photoId: Nat) : Bool {
            let ratingKey = sessionId # ":" # Nat.toText(photoId);
            switch (stableRatings.get(ratingKey)) {
                case (?rating) { rating.userId != userId }; // 他のユーザーの評価
                case null { true }; // まだ評価されていない
            }
        };
        
        /// ユーザーの評価履歴を取得
        public func getUserRatingHistory(userId: Principal, limit: ?Nat) : [Nat] {
            switch (userRatingHistory.get(userId)) {
                case null { [] };
                case (?history) {
                    let actualLimit = switch(limit) {
                        case null { history.size() };
                        case (?l) { Nat.min(l, history.size()) };
                    };
                    
                    if (actualLimit == history.size()) {
                        Buffer.toArray(history)
                    } else {
                        let result = Buffer.Buffer<Nat>(actualLimit);
                        let start = history.size() - actualLimit;
                        for (i in Iter.range(start, history.size() - 1)) {
                            result.add(history.get(i));
                        };
                        Buffer.toArray(result)
                    }
                };
            }
        };
        
        /// ユーザーの評価状況を一括取得
        public func getUserRatingStatus(userId: Principal, sessionId: Text, photoIds: [Nat]) : [(Nat, Bool)] {
            Array.map<Nat, (Nat, Bool)>(photoIds, func(photoId) {
                let ratingKey = sessionId # ":" # Nat.toText(photoId);
                let hasRated = switch (stableRatings.get(ratingKey)) {
                    case (?rating) { rating.userId == userId };
                    case null { false };
                };
                (photoId, hasRated)
            })
        };
        
        /// 評価分布を取得
        public func getRatingDistribution(photoId: Nat) : ?RatingDistribution {
            stableDistributions.get(photoId)
        };
        
        /// 統計情報を取得
        public func getStats() : {
            totalRatings: Nat;
            totalRatedPhotos: Nat;
            totalRatingUsers: Nat;
        } {
            {
                totalRatings = totalRatings;
                totalRatedPhotos = stableAggregatedRatings.size();
                totalRatingUsers = userRatingHistory.size();
            }
        };
        
        /// ユーザーの評価統計を取得
        public func getUserRatingStats(userId: Principal) : {
            totalRatings: Nat;
            averageDifficulty: Float;
            averageInterest: Float;
            averageBeauty: Float;
        } {
            var totalDifficulty : Nat = 0;
            var totalInterest : Nat = 0;
            var totalBeauty : Nat = 0;
            var count : Nat = 0;
            
            // 全ての評価を走査してユーザーの評価を集計
            for ((key, rating) in stableRatings.entries()) {
                if (rating.userId == userId) {
                    totalDifficulty += rating.difficulty;
                    totalInterest += rating.interest;
                    totalBeauty += rating.beauty;
                    count += 1;
                };
            };
            
            {
                totalRatings = count;
                averageDifficulty = if (count > 0) { Float.fromInt(totalDifficulty) / Float.fromInt(count) } else { 0.0 };
                averageInterest = if (count > 0) { Float.fromInt(totalInterest) / Float.fromInt(count) } else { 0.0 };
                averageBeauty = if (count > 0) { Float.fromInt(totalBeauty) / Float.fromInt(count) } else { 0.0 };
            }
        };
        
        // ======================================
        // PRIVATE FUNCTIONS
        // ======================================
        
        /// レート制限チェック
        private func checkRateLimit(userId: Principal) : Result.Result<(), Text> {
            // 匿名プリンシパルのチェック
            if (Principal.isAnonymous(userId)) {
                return #err("Anonymous users cannot rate photos");
            };
            
            let now = Time.now();
            switch (stableRateLimits.get(userId)) {
                case (?limit) {
                    if (Int.abs(now - limit.windowStart) > RATE_LIMIT_WINDOW) {
                        // 新しいウィンドウ
                        stableRateLimits.put(userId, {
                            lastRatingTime = now;
                            ratingsInWindow = 1;
                            windowStart = now;
                        });
                        #ok()
                    } else if (limit.ratingsInWindow >= MAX_RATINGS_PER_WINDOW) {
                        #err("Rate limit exceeded. Please wait before rating again.")
                    } else {
                        // ウィンドウ内で制限以下
                        stableRateLimits.put(userId, {
                            limit with
                            ratingsInWindow = limit.ratingsInWindow + 1;
                            lastRatingTime = now;
                        });
                        #ok()
                    }
                };
                case null {
                    // 初回
                    stableRateLimits.put(userId, {
                        lastRatingTime = now;
                        ratingsInWindow = 1;
                        windowStart = now;
                    });
                    #ok()
                }
            }
        };
        
        /// ユーザー履歴を更新
        private func updateUserHistory(userId: Principal, photoId: Nat) {
            let history = switch (userRatingHistory.get(userId)) {
                case null {
                    let buffer = Buffer.Buffer<Nat>(10);
                    userRatingHistory.put(userId, buffer);
                    buffer
                };
                case (?buffer) { buffer };
            };
            
            // 重複を避ける
            let alreadyRated = Buffer.contains<Nat>(history, photoId, Nat.equal);
            if (not alreadyRated) {
                if (history.size() >= MAX_RATING_HISTORY_PER_USER) {
                    // 古い履歴を削除
                    ignore history.remove(0);
                };
                history.add(photoId);
            };
        };
        
        /// 集計評価を更新
        private func updateAggregatedRatings(photoId: Nat, ratings: { difficulty: Nat; interest: Nat; beauty: Nat }) {
            let now = Time.now();
            
            let updated = switch (stableAggregatedRatings.get(photoId)) {
                case null {
                    // 初回評価
                    {
                        photoId = photoId;
                        difficulty = { 
                            total = ratings.difficulty; 
                            count = 1; 
                            average = Float.fromInt(ratings.difficulty) 
                        };
                        interest = { 
                            total = ratings.interest; 
                            count = 1; 
                            average = Float.fromInt(ratings.interest) 
                        };
                        beauty = { 
                            total = ratings.beauty; 
                            count = 1; 
                            average = Float.fromInt(ratings.beauty) 
                        };
                        lastUpdated = now;
                    }
                };
                case (?existing) {
                    // 既存の評価を更新
                    {
                        photoId = photoId;
                        difficulty = {
                            total = existing.difficulty.total + ratings.difficulty;
                            count = existing.difficulty.count + 1;
                            average = Float.fromInt(existing.difficulty.total + ratings.difficulty) / 
                                     Float.fromInt(existing.difficulty.count + 1);
                        };
                        interest = {
                            total = existing.interest.total + ratings.interest;
                            count = existing.interest.count + 1;
                            average = Float.fromInt(existing.interest.total + ratings.interest) / 
                                     Float.fromInt(existing.interest.count + 1);
                        };
                        beauty = {
                            total = existing.beauty.total + ratings.beauty;
                            count = existing.beauty.count + 1;
                            average = Float.fromInt(existing.beauty.total + ratings.beauty) / 
                                     Float.fromInt(existing.beauty.count + 1);
                        };
                        lastUpdated = now;
                    }
                };
            };
            
            stableAggregatedRatings.put(photoId, updated);
        };
        
        /// 分布を更新
        private func updateDistribution(photoId: Nat, ratings: { difficulty: Nat; interest: Nat; beauty: Nat }) {
            let updated = switch (stableDistributions.get(photoId)) {
                case null {
                    // 初回評価 - 新しい分布を作成
                    let difficultyDist = Array.init<Nat>(5, 0);
                    let interestDist = Array.init<Nat>(5, 0);
                    let beautyDist = Array.init<Nat>(5, 0);
                    
                    difficultyDist[ratings.difficulty - 1] := 1;
                    interestDist[ratings.interest - 1] := 1;
                    beautyDist[ratings.beauty - 1] := 1;
                    
                    {
                        difficulty = Array.freeze(difficultyDist);
                        interest = Array.freeze(interestDist);
                        beauty = Array.freeze(beautyDist);
                        totalRatings = 1;
                    }
                };
                case (?existing) {
                    // 既存の分布を更新
                    let difficultyDist = Array.thaw<Nat>(existing.difficulty);
                    let interestDist = Array.thaw<Nat>(existing.interest);
                    let beautyDist = Array.thaw<Nat>(existing.beauty);
                    
                    difficultyDist[ratings.difficulty - 1] += 1;
                    interestDist[ratings.interest - 1] += 1;
                    beautyDist[ratings.beauty - 1] += 1;
                    
                    {
                        difficulty = Array.freeze(difficultyDist);
                        interest = Array.freeze(interestDist);
                        beauty = Array.freeze(beautyDist);
                        totalRatings = existing.totalRatings + 1;
                    }
                };
            };
            
            stableDistributions.put(photoId, updated);
        };
        
        // ======================================
        // Stable復元用関数
        // ======================================
        
        /// Stable変数をTrieMapに復元
        public func loadFromStable(
            ratings: [(Text, PhotoRating)],
            aggregated: [(Nat, AggregatedRatings)],
            limits: [(Principal, RateLimitData)],
            distributions: [(Nat, RatingDistribution)]
        ) {
            stableRatingsEntries := ratings;
            stableAggregatedRatingsEntries := aggregated;
            stableRateLimitsEntries := limits;
            stableDistributionsEntries := distributions;
            
            stableRatings := TrieMap.fromEntries<Text, PhotoRating>(ratings.vals(), Text.equal, Text.hash);
            stableAggregatedRatings := TrieMap.fromEntries<Nat, AggregatedRatings>(aggregated.vals(), Nat.equal, Hash.hash);
            stableRateLimits := TrieMap.fromEntries<Principal, RateLimitData>(limits.vals(), Principal.equal, Principal.hash);
            stableDistributions := TrieMap.fromEntries<Nat, RatingDistribution>(distributions.vals(), Nat.equal, Hash.hash);
            
            // ユーザー履歴を再構築
            for ((key, rating) in stableRatings.entries()) {
                updateUserHistory(rating.userId, rating.photoId);
            };
            
            // 総評価数を再計算
            totalRatings := stableRatings.size();
        };
        
        /// Stable変数として保存用のデータを取得
        public func getStableData() : {
            ratings: [(Text, PhotoRating)];
            aggregated: [(Nat, AggregatedRatings)];
            limits: [(Principal, RateLimitData)];
            distributions: [(Nat, RatingDistribution)];
        } {
            {
                ratings = Iter.toArray(stableRatings.entries());
                aggregated = Iter.toArray(stableAggregatedRatings.entries());
                limits = Iter.toArray(stableRateLimits.entries());
                distributions = Iter.toArray(stableDistributions.entries());
            }
        };
    };
}