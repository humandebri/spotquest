import HashMap "mo:base/HashMap";
import TrieMap "mo:base/TrieMap";
import Hash "mo:base/Hash";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Timer "mo:base/Timer";
import Option "mo:base/Option";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Random "mo:base/Random";

import ICRC1 "../../types/icrc1";
import GameV2 "../../types/game_v2";
import Photo "../../types/photo";

// Import modules
import Constants "modules/Constants";
import Helpers "modules/Helpers";
import TokenModule "modules/TokenModule";
import TreasuryModule "modules/TreasuryModule";
import GameEngineModule "modules/GameEngineModule";
import GuessHistoryModule "modules/GuessHistoryModule";
import PhotoModuleV2 "modules/PhotoModuleV2";
import ReputationModule "modules/ReputationModule";
import IIIntegrationModule "modules/IIIntegrationModule";
import RatingModule "modules/RatingModule";
import EloRatingModule "modules/EloRatingModule";
import PlayerStatsModule "modules/PlayerStatsModule";
import GameLimitsModule "modules/GameLimitsModule";

// HTTP types
import Blob "mo:base/Blob";
import Map "mo:base/HashMap";
import CertifiedData "mo:base/CertifiedData";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Char "mo:base/Char";

actor GameUnified {
    // ======================================
    // TYPES
    // ======================================
    public type RoundResult = {
        displayScore: Nat;
        normalizedScore: Nat;
        distance: Float;
        actualLocation: {
            lat: Float;
            lon: Float;
        };
        guessLocation: {
            lat: Float;
            lon: Float;
        };
        photoId: Nat;
        // Elo rating changes
        playerRatingChange: Int;
        newPlayerRating: Int;
        photoRatingChange: Int;
        newPhotoRating: Int;
    };
    
    public type HintInfo = {
        #RadiusHint: Nat; // Radius in KM
        #DirectionHint: Text; // Cardinal direction
    };
    
    // HTTP types for II Integration
    public type HttpRequest = {
        url: Text;
        method: Text;
        body: Blob;
        headers: [(Text, Text)];
    };
    
    public type HttpResponse = {
        body: Blob;
        headers: [(Text, Text)];
        status_code: Nat16;
    };
    
    // ======================================
    // SYSTEM CONFIGURATION
    // ======================================
    private stable var owner : Principal = Principal.fromText("lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe");
    private stable var initialized : Bool = false;
    
    // ======================================
    // MODULE INSTANCES
    // ======================================
    private var tokenManager = TokenModule.TokenManager();
    private var treasuryManager = TreasuryModule.TreasuryManager();
    private var gameEngineManager = GameEngineModule.GameEngineManager();
    private var guessHistoryManager = GuessHistoryModule.GuessHistoryManager();
    private var photoManagerV2 = PhotoModuleV2.PhotoManager(); // 新しい写真管理システム
    private var reputationManager = ReputationModule.ReputationManager();
    private var iiIntegrationManager = IIIntegrationModule.IIIntegrationManager();
    private var ratingManager = RatingModule.RatingManager(photoManagerV2); // PhotoModuleV2を渡す
    private var eloRatingManager = EloRatingModule.EloRatingManager(photoManagerV2); // Eloレーティング管理
    private var playerStatsManager = PlayerStatsModule.PlayerStatsManager(); // プレイヤー統計管理
    private var gameLimitsManager = GameLimitsModule.GameLimitsManager(); // プレイ回数制限管理
    
    // Random number generator for photo selection (unique seed to avoid duplicates)
    private var photoSelectionPrng = Random.Finite(
        Blob.fromArray([99,88,77,66,55,44,33,22,11,10,9,8,7,6,5,4,3,2,1,0,100,101,102,103,104,105,106,107,108,109,110,111])
    );
    
    // Counter for additional entropy
    private var prngCounter : Nat = 0;
    
    // Timers
    private var cleanupTimer : ?Timer.TimerId = null;
    
    // ======================================
    // STABLE STORAGE FOR UPGRADES
    // ======================================
    private stable var tokenStable : ?{
        totalSupply: Nat;
        transactionId: Nat;
        balanceEntries: [(Principal, Nat)];
        allowanceEntries: [((Principal, Principal), Nat)];
    } = null;
    
    private stable var treasuryStable : ?{
        treasuryAddress: Principal;
        treasuryBalance: Nat;
        totalBurned: Nat;
        totalSinkAmount: Nat;
        processedTransactionsStable: [(Text, Time.Time)];
        sinkHistory: [(Time.Time, GameV2.SinkType, Nat)];
    } = null;
    
    private stable var gameEngineStable : ?{
        sessionsStable: [(Text, GameV2.GameSession)];
        userSessionsStable: [(Principal, [Text])];
        sessionTimeoutsStable: [(Text, Time.Time)];
        totalSessions: Nat;
        totalRounds: Nat;
        errorCount: Nat;
        totalRequests: Nat;
    } = null;
    
    // New variable for extended game engine data
    private stable var gameEngineExtended : ?{
        sessionPhotosPlayedStable: [(Text, [(Nat, Nat)])];
    } = null;
    
    private stable var guessHistoryStable : ?{
        totalGuesses: Nat;
        guessRecordsStable: [(Nat, [GuessHistoryModule.Guess])];
        playerHistoryStable: [(Principal, [Nat])];
        photoQualityScoresStable: [(Nat, Float)];
    } = null;
    
    
    private stable var reputationStable : ?{
        reputations: [(Principal, ReputationModule.Reputation)];
        referrals: [(Principal, [ReputationModule.Referral])];
        referralCodes: [(Text, Principal)];
        userReferralCodes: [(Principal, Text)];
        bannedUsers: [(Principal, Time.Time)];
    } = null;
    
    private stable var iiIntegrationStable : ?[(Text, IIIntegrationModule.SessionData)] = null;
    
    // Legacy photo stable variable - kept for migration compatibility
    private stable var photoStable : ?{
        bannedPhotos : [(Nat, Time.Time)];
        nextPhotoId : Nat;
        ownerPhotos : [(Principal, [Nat])];
        photoUsageCount : [(Nat, Nat)];
        photos : [(Nat, PhotoModuleV2.Photo)];
        scheduledPhotos : [(Principal, [PhotoModuleV2.ScheduledPhoto])];
        totalPhotos : Nat;
    } = null;
    
    // Photo V2のstable変数 - データ保護のため復活
    private stable var photoV2Stable : ?{
        photos: [(Nat, PhotoModuleV2.Photo)];
        photoChunks: [(Text, PhotoModuleV2.PhotoChunk)];
        nextPhotoId: Nat;
        totalPhotos: Nat;
        totalStorageSize: Nat;
    } = null;
    
    // 写真統計情報の別stable変数（既存型と互換性を保つため）
    private stable var photoStatsStable : ?[(Nat, PhotoModuleV2.PhotoStats)] = null;
    
    // DEPRECATED: 予約投稿システム削除済み - 明示的にnullに設定
    private stable var _photoV2ScheduledStable : ?{
        scheduledPhotos: [(Nat, PhotoModuleV2.ScheduledPhoto)];
        nextScheduledId: Nat;
        userScheduledPhotos: [(Principal, [Nat])];
    } = null;
    
    // User profile storage for usernames
    private stable var userProfileStable : ?{
        usernames: [(Principal, Text)];
    } = null;
    
    // Rating system stable storage
    private stable var ratingStable : ?{
        ratings: [(Text, RatingModule.PhotoRating)];
        aggregated: [(Nat, RatingModule.AggregatedRatings)];
        limits: [(Principal, RatingModule.RateLimitData)];
        distributions: [(Nat, RatingModule.RatingDistribution)];
    } = null;
    
    // Elo rating system stable storage
    private stable var eloRatingStable : ?{
        playerRatings: [(Principal, EloRatingModule.PlayerRating)];
        photoRatings: [(Nat, EloRatingModule.PhotoRating)];
        ratingHistory: [(Text, EloRatingModule.RatingChange)];
    } = null;
    
    // Player stats stable storage
    private stable var playerStatsStable : ?[(Principal, PlayerStatsModule.PlayerStats)] = null;
    
    // Game limits stable storage (old format for compatibility)
    private stable var gameLimitsStable : ?{
        dailyPlayCountsStable: [(Principal, Nat)];
        lastResetTime: Time.Time;
    } = null;
    
    // New game limits stable storage with Pro membership data
    private stable var gameLimitsStableV2 : ?{
        dailyPlayCountsStable: [(Principal, Nat)];
        proMembershipExpiryStable: ?[(Principal, Time.Time)];
        lastResetTime: Time.Time;
    } = null;
    
    // Runtime username map
    private var usernames = HashMap.HashMap<Principal, Text>(100, Principal.equal, Principal.hash);
    
    // ======================================
    // INITIALIZATION
    // ======================================
    public shared(msg) func init() : async Result.Result<(), Text> {
        if (owner == Principal.fromText("aaaaa-aa")) {
            owner := msg.caller;
        } else if (msg.caller != owner) {
            return #err("Only owner can initialize");
        };
        
        if (initialized) {
            return #err("Already initialized");
        };
        
        // Start cleanup timer
        cleanupTimer := ?Timer.recurringTimer<system>(#seconds(60), cleanupExpiredSessions);
        
        // Initialize certified data for HTTP responses
        initCertifiedData();
        
        initialized := true;
        #ok()
    };
    
    // ======================================
    // ===========================================
    // DEBUG FUNCTIONS (temporary)
    // ===========================================
    public query func debugPhotoStorage() : async {
        nextPhotoId: Nat;
        totalPhotos: Nat;
        storageSize: Nat;
        stablePhotosCount: Nat;
        stableChunksCount: Nat;
        firstPhotoIds: [Nat];
    } {
        photoManagerV2.debugPhotoStorage()
    };
    
    public query func debugPhotoStats() : async [(Nat, {
        playCount: Nat;
        totalScore: Nat;
        averageScore: Float;
        bestScore: Nat;
        worstScore: Nat;
    })] {
        photoManagerV2.getPhotoStatsEntries()
    };

    // ICRC-1 TOKEN FUNCTIONS
    // ======================================
    public query func icrc1_name() : async Text {
        tokenManager.icrc1_name()
    };
    
    public query func icrc1_symbol() : async Text {
        tokenManager.icrc1_symbol()
    };
    
    public query func icrc1_decimals() : async Nat8 {
        tokenManager.icrc1_decimals()
    };
    
    public query func icrc1_fee() : async Nat {
        tokenManager.icrc1_fee()
    };
    
    public query func icrc1_total_supply() : async Nat {
        tokenManager.icrc1_total_supply()
    };
    
    public query func icrc1_balance_of(account: ICRC1.Account) : async Nat {
        tokenManager.icrc1_balance_of(account)
    };
    
    public query func icrc1_metadata() : async [ICRC1.Metadata] {
        tokenManager.icrc1_metadata()
    };
    
    public shared(msg) func icrc1_transfer(args: ICRC1.TransferArgs) : async Result.Result<Nat, ICRC1.TransferError> {
        tokenManager.icrc1_transfer(msg.caller, args)
    };
    
    // ======================================
    // HELPER FUNCTIONS FOR PHOTO SELECTION
    // ======================================
    
    // Reseed PRNG with time and counter for better randomness
    private func reseedPrng() {
        prngCounter += 1;
        let now = Time.now();
        let timeBytes = Blob.toArray(Text.encodeUtf8(Int.toText(now)));
        let counterBytes = Blob.toArray(Text.encodeUtf8(Nat.toText(prngCounter)));
        
        // Combine time, counter, and some fixed bytes for 32-byte seed
        var seedArray = Buffer.Buffer<Nat8>(32);
        
        // Add time bytes
        for (b in timeBytes.vals()) {
            if (seedArray.size() < 32) { seedArray.add(b); };
        };
        
        // Add counter bytes
        for (b in counterBytes.vals()) {
            if (seedArray.size() < 32) { seedArray.add(b); };
        };
        
        // Fill remaining with pseudo-random values
        var i = seedArray.size();
        while (i < 32) {
            seedArray.add(Nat8.fromNat((i * 37 + prngCounter) % 256));
            i += 1;
        };
        
        photoSelectionPrng := Random.Finite(Blob.fromArray(Buffer.toArray(seedArray)));
    };
    
    // Get random photo excluding already used ones
    private func getRandomPhotoExcluding(usedPhotoIds: [Nat]) : ?PhotoModuleV2.Photo {
        // Use search with minimal filter to get all active photos
        let filter: Photo.SearchFilter = {
            status = ?#Active;
            country = null;
            region = null;
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = null;
            difficulty = null;
        };
        
        let searchResult = photoManagerV2.search(filter, null, 1000);
        let allPhotos = searchResult.photos;
        let availablePhotos = Buffer.Buffer<PhotoModuleV2.Photo>(allPhotos.size());
        
        // Filter out already used photos
        for (photo in allPhotos.vals()) {
            var isUsed = false;
            for (usedId in usedPhotoIds.vals()) {
                if (photo.id == usedId) {
                    isUsed := true;
                };
            };
            if (not isUsed) {
                availablePhotos.add(photo);
            };
        };
        
        let availableCount = availablePhotos.size();
        if (availableCount == 0) {
            return null;
        };
        
        // Reseed PRNG periodically for better randomness
        if (prngCounter % 10 == 0) {
            reseedPrng();
        };
        
        // Generate random index using PRNG
        // Get multiple bytes for large numbers
        var randomValue : Nat = 0;
        var needReseed = false;
        
        for (i in Iter.range(0, 3)) {
            if (needReseed) {
                reseedPrng();
                needReseed := false;
            };
            
            switch (photoSelectionPrng.byte()) {
                case null {
                    // PRNG exhausted, mark for reseed
                    needReseed := true;
                };
                case (?byte) {
                    randomValue := randomValue * 256 + Nat8.toNat(byte);
                };
            };
        };
        
        // If we still couldn't get enough bytes, use fallback
        if (randomValue == 0) {
            // Fallback to time-based random
            let now = Time.now();
            let seed = Int.abs(now) + prngCounter;
            randomValue := Int.abs(seed);
        };
        
        let randomIndex = randomValue % availableCount;
        ?availablePhotos.get(randomIndex)
    };
    
    // Get region photo excluding already used ones
    private func getRegionPhotoExcluding(region: Text, usedPhotoIds: [Nat]) : ?PhotoModuleV2.Photo {
        // Build filter for region
        // Support both country names (e.g., "Japan") and region names (e.g., "Tokyo, Japan")
        let filter: Photo.SearchFilter = {
            status = ?#Active;
            country = if (not Text.contains(region, #char ',')) { 
                // If no comma, treat as country name
                ?region 
            } else { 
                null 
            };
            region = if (Text.contains(region, #char ',')) { 
                // If has comma, treat as full region name
                ?region 
            } else { 
                null 
            };
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = null;
            difficulty = null;
        };
        
        let searchResult = photoManagerV2.search(filter, null, 1000);
        let regionPhotos = searchResult.photos;
        let availablePhotos = Buffer.Buffer<PhotoModuleV2.Photo>(regionPhotos.size());
        
        // Filter out already used photos
        for (photo in regionPhotos.vals()) {
            var isUsed = false;
            for (usedId in usedPhotoIds.vals()) {
                if (photo.id == usedId) {
                    isUsed := true;
                };
            };
            if (not isUsed) {
                availablePhotos.add(photo);
            };
        };
        
        let availableCount = availablePhotos.size();
        if (availableCount == 0) {
            Debug.print("🎮 No unused photos found in region: " # region # " (total in region: " # Nat.toText(regionPhotos.size()) # ", used: " # Nat.toText(usedPhotoIds.size()) # ")");
            return null;
        };
        
        // Reseed PRNG periodically for better randomness
        if (prngCounter % 10 == 0) {
            reseedPrng();
        };
        
        // Generate random index using PRNG
        // Get multiple bytes for large numbers
        var randomValue : Nat = 0;
        var needReseed = false;
        
        for (i in Iter.range(0, 3)) {
            if (needReseed) {
                reseedPrng();
                needReseed := false;
            };
            
            switch (photoSelectionPrng.byte()) {
                case null {
                    // PRNG exhausted, mark for reseed
                    needReseed := true;
                };
                case (?byte) {
                    randomValue := randomValue * 256 + Nat8.toNat(byte);
                };
            };
        };
        
        // If we still couldn't get enough bytes, use fallback
        if (randomValue == 0) {
            // Fallback to time-based random
            let now = Time.now();
            let seed = Int.abs(now) + prngCounter;
            randomValue := Int.abs(seed);
        };
        
        let randomIndex = randomValue % availableCount;
        ?availablePhotos.get(randomIndex)
    };

    // Get weekly photo (from the last 7 days) excluding already used ones
    private func getWeeklyPhotoExcluding(region: ?Text, usedPhotoIds: [Nat]) : ?PhotoModuleV2.Photo {
        // Calculate timestamp for 7 days ago
        let oneWeekAgo = Time.now() - (7 * 24 * 60 * 60 * 1000000000); // 7 days in nanoseconds
        
        // Search for photos with region filter if provided
        let filter: Photo.SearchFilter = {
            status = ?#Active;
            country = switch(region) {
                case null { null };
                case (?r) { 
                    if (not Text.contains(r, #char ',')) { ?r } else { null }
                };
            };
            region = switch(region) {
                case null { null };
                case (?r) { 
                    if (Text.contains(r, #char ',')) { ?r } else { null }
                };
            };
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = null;
            difficulty = null;
        };
        
        let searchResult = photoManagerV2.search(filter, null, 1000);
        let allPhotos = searchResult.photos;
        let availablePhotos = Buffer.Buffer<PhotoModuleV2.Photo>(allPhotos.size());
        
        // Filter photos from the last 7 days and exclude used photos
        for (photo in allPhotos.vals()) {
            // Check if photo is from the last 7 days
            if (photo.uploadTime >= oneWeekAgo) {
                var isUsed = false;
                for (usedId in usedPhotoIds.vals()) {
                    if (photo.id == usedId) {
                        isUsed := true;
                    };
                };
                if (not isUsed) {
                    availablePhotos.add(photo);
                };
            };
        };
        
        let availableCount = availablePhotos.size();
        if (availableCount == 0) {
            Debug.print("🎮 No unused weekly photos found" # 
                       (switch(region) { 
                           case null { "" }; 
                           case (?r) { " in region: " # r } 
                       }) # 
                       " (total photos: " # Nat.toText(allPhotos.size()) # 
                       ", used: " # Nat.toText(usedPhotoIds.size()) # ")");
            return null;
        };
        
        // Reseed PRNG periodically for better randomness
        if (prngCounter % 10 == 0) {
            reseedPrng();
        };
        
        prngCounter += 1;
        
        // Get random value with multiple attempts and fallback
        var randomValue : Nat = 0;
        var needReseed = false;
        for (_ in Iter.range(0, 7)) {
            if (randomValue > 0) {
                // We have enough randomness
                randomValue := randomValue % availableCount;
                Debug.print("🎮 Selected weekly photo #" # Nat.toText(randomValue) # " from " # Nat.toText(availableCount) # " available photos");
                return ?Buffer.toArray(availablePhotos)[randomValue];
            };
            
            switch (photoSelectionPrng.byte()) {
                case null {
                    // PRNG exhausted, mark for reseed
                    needReseed := true;
                };
                case (?byte) {
                    randomValue := randomValue * 256 + Nat8.toNat(byte);
                };
            };
        };
        
        // If we still couldn't get enough bytes, use fallback
        if (randomValue == 0) {
            // Fallback to time-based random
            let now = Time.now();
            let seed = Int.abs(now) + prngCounter;
            randomValue := Int.abs(seed);
        };
        
        let selectedIndex = randomValue % availableCount;
        Debug.print("🎮 Selected weekly photo at index " # Nat.toText(selectedIndex) # " from " # Nat.toText(availableCount) # " available photos");
        ?Buffer.toArray(availablePhotos)[selectedIndex]
    };
    
    // ======================================
    // GAME ENGINE FUNCTIONS
    // ======================================
    public shared(msg) func createSession() : async Result.Result<GameV2.SessionId, Text> {
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        
        // Check play limits
        switch (gameLimitsManager.consumePlay(msg.caller)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) { /* Continue */ };
        };
        
        // Create the session
        switch(gameEngineManager.createSession(msg.caller)) {
            case (#err(e)) { #err(e) };
            case (#ok(sessionId)) {
                // Get current Elo rating and store it with the session
                let currentEloRating = eloRatingManager.getPlayerRating(msg.caller);
                
                // Update the session with initial Elo rating
                switch(gameEngineManager.getSession(sessionId)) {
                    case null { #ok(sessionId) }; // Shouldn't happen but handle gracefully
                    case (?session) {
                        let updatedSession = {
                            session with
                            initialEloRating = ?currentEloRating;
                        };
                        gameEngineManager.updateSession(sessionId, updatedSession);
                        Debug.print("✅ Created session " # sessionId # " with initialEloRating: " # Int.toText(currentEloRating));
                        #ok(sessionId)
                    };
                };
            };
        };
    };
    
    public query func getUserSessions(player: Principal) : async Result.Result<[GameV2.SessionInfo], Text> {
        switch(gameEngineManager.getUserSessions(player)) {
            case null { #err("No sessions found for user") };
            case (?sessionIds) {
                Debug.print("🎮 getUserSessions for " # Principal.toText(player) # " - Found " # Nat.toText(sessionIds.size()) # " session IDs");
                let sessions = Buffer.Buffer<GameV2.SessionInfo>(sessionIds.size());
                for (sessionId in sessionIds.vals()) {
                    switch(gameEngineManager.getSession(sessionId)) {
                        case null {
                            Debug.print("🎮 Session not found in storage: " # sessionId);
                        };
                        case (?session) {
                            // Determine session status based on endTime
                            let status : GameV2.SessionStatus = switch(session.endTime) {
                                case null { #Active };
                                case (?_) { #Completed };
                            };
                            
                            Debug.print("🎮 Session " # sessionId # " - status: " # 
                                (switch(status) {
                                    case (#Active) { "Active" };
                                    case (#Completed) { "Completed" };
                                    case (#Abandoned) { "Abandoned" };
                                }) # ", rounds: " # Nat.toText(session.rounds.size()));
                            
                            sessions.add({
                                id = session.id;
                                players = [session.userId];
                                status = status;
                                createdAt = session.startTime;
                                roundCount = session.rounds.size();
                                currentRound = if (session.currentRound > 0) { ?session.currentRound } else { null };
                            });
                        };
                    };
                };
                #ok(Buffer.toArray(sessions))
            };
        }
    };
    
    // Get recent sessions with scores for efficient display
    public query func getRecentSessionsWithScores(player: Principal, limit: Nat) : async Result.Result<[GameV2.SessionSummary], Text> {
        switch(gameEngineManager.getUserSessions(player)) {
            case null { #err("No sessions found for user") };
            case (?sessionIds) {
                Debug.print("🏠 getRecentSessionsWithScores for " # Principal.toText(player) # " - Found " # Nat.toText(sessionIds.size()) # " session IDs");
                
                // Convert session IDs to summaries with scores
                let tempSummaries = Buffer.Buffer<GameV2.SessionSummary>(sessionIds.size());
                for (sessionId in sessionIds.vals()) {
                    switch(gameEngineManager.getSession(sessionId)) {
                        case null { };
                        case (?session) {
                            // Debug log for session data
                            Debug.print("🔍 Session " # sessionId # " data:");
                            Debug.print("  - playerReward: " # 
                                (switch(session.playerReward) {
                                    case null { "null" };
                                    case (?r) { Nat.toText(r) };
                                })
                            );
                            Debug.print("  - initialEloRating: " # 
                                (switch(session.initialEloRating) {
                                    case null { "null" };
                                    case (?r) { Int.toText(r) };
                                })
                            );
                            Debug.print("  - endTime: " # 
                                (switch(session.endTime) {
                                    case null { "null (active)" };
                                    case (?t) { "completed" };
                                })
                            );
                            
                            // Determine session status based on endTime
                            let status : GameV2.SessionStatus = switch(session.endTime) {
                                case null { #Active };
                                case (?_) { #Completed };
                            };
                            
                            // Calculate duration if session is completed
                            let duration : ?Nat = switch(session.endTime) {
                                case null { null };
                                case (?endTime) {
                                    ?Int.abs(endTime - session.startTime)
                                };
                            };
                            
                            // Calculate Elo rating change if completed
                            let eloRatingChange : ?Int = switch(session.endTime) {
                                case null { null }; // Session not completed
                                case (?_) {
                                    switch(session.initialEloRating) {
                                        case null { 
                                            // Fallback for old sessions: assume default starting rating
                                            let current = eloRatingManager.getPlayerRating(player);
                                            if (current != 1500) {
                                                ?(current - 1500) // Assume they started at 1500
                                            } else {
                                                null
                                            }
                                        };
                                        case (?initial) {
                                            let current = eloRatingManager.getPlayerRating(player);
                                            ?(current - initial)
                                        };
                                    };
                                };
                            };
                            
                            // Get final Elo rating if completed
                            let finalEloRating : ?Int = switch(session.endTime) {
                                case null { null };
                                case (?_) { 
                                    let rating = eloRatingManager.getPlayerRating(player);
                                    Debug.print("  - Final Elo rating: " # Int.toText(rating));
                                    ?rating
                                };
                            };
                            
                            Debug.print("  - Elo rating change: " # 
                                (switch(eloRatingChange) {
                                    case null { "null" };
                                    case (?change) { Int.toText(change) };
                                })
                            );
                            
                            // Calculate reward if not already stored but session is completed
                            let playerReward : ?Nat = switch(session.playerReward) {
                                case (?reward) { 
                                    Debug.print("  - Using stored playerReward: " # Nat.toText(reward));
                                    ?reward 
                                };
                                case null {
                                    switch(session.endTime) {
                                        case null { null };
                                        case (?_) { 
                                            let calculated = calculatePlayerReward(session);
                                            Debug.print("  - Calculated playerReward: " # Nat.toText(calculated));
                                            ?calculated
                                        };
                                    };
                                };
                            };
                            
                            let summary = {
                                id = session.id;
                                status = status;
                                createdAt = session.startTime;
                                roundCount = session.rounds.size();
                                currentRound = if (session.currentRound > 0) { ?session.currentRound } else { null };
                                totalScore = session.totalScore;
                                duration = duration;
                                playerReward = playerReward;
                                eloRatingChange = eloRatingChange;
                                initialEloRating = session.initialEloRating;
                                finalEloRating = finalEloRating;
                            };
                            
                            Debug.print("  📋 Summary created with:");
                            Debug.print("    - playerReward: " # 
                                (switch(playerReward) {
                                    case null { "null" };
                                    case (?r) { Nat.toText(r) };
                                })
                            );
                            Debug.print("    - eloRatingChange: " # 
                                (switch(eloRatingChange) {
                                    case null { "null" };
                                    case (?c) { Int.toText(c) };
                                })
                            );
                            
                            tempSummaries.add(summary);
                        };
                    };
                };
                
                // Sort by creation time (most recent first)
                let sorted = Array.sort<GameV2.SessionSummary>(
                    Buffer.toArray(tempSummaries),
                    func(a, b) {
                        if (a.createdAt > b.createdAt) { #less }
                        else if (a.createdAt < b.createdAt) { #greater }
                        else { #equal }
                    }
                );
                
                // Return top N sessions
                let actualLimit = Nat.min(limit, sorted.size());
                let result = Array.tabulate<GameV2.SessionSummary>(
                    actualLimit,
                    func(i) = sorted[i]
                );
                
                Debug.print("🏠 Returning " # Nat.toText(result.size()) # " recent sessions with scores");
                #ok(result)
            };
        }
    };
    
    public shared(msg) func getNextRound(sessionId: Text, regionFilter: ?Text) : async Result.Result<GameV2.RoundState, Text> {
        // Get current session to check used photos
        switch(gameEngineManager.getSession(sessionId)) {
            case null { return #err("Session not found") };
            case (?session) {
                if (session.userId != msg.caller) {
                    return #err("Unauthorized");
                };

                // Check if there's an active round that hasn't been completed yet
                if (session.currentRound > 0 and session.currentRound <= session.rounds.size()) {
                    let currentRoundIndex = session.currentRound - 1;
                    let currentRound = session.rounds[currentRoundIndex];
                    if (currentRound.status == #Active) {
                        // There's already an active round, return it instead of creating a new one
                        Debug.print("🎮 Returning existing active round for session: " # sessionId);
                        return #ok(currentRound);
                    };
                };

                // Get list of already used photo IDs in this session
                var usedPhotoIds = Buffer.Buffer<Nat>(session.rounds.size());
                for (round in session.rounds.vals()) {
                    usedPhotoIds.add(round.photoId);
                };

                let selectedPhoto = switch(regionFilter) {
                    case null {
                        // Get random photo excluding already used ones
                        getRandomPhotoExcluding(Buffer.toArray(usedPhotoIds))
                    };
                    case (?region) {
                        // Check if this is a weekly photo request
                        if (Text.startsWith(region, #text "weekly:")) {
                            // Extract actual region filter (if any) after "weekly:"
                            let actualRegion = if (Text.size(region) > 7) {
                                Text.trimStart(region, #text "weekly:")
                            } else {
                                ""
                            };
                            
                            // Get weekly photo
                            if (actualRegion == "") {
                                getWeeklyPhotoExcluding(null, Buffer.toArray(usedPhotoIds))
                            } else {
                                getWeeklyPhotoExcluding(?actualRegion, Buffer.toArray(usedPhotoIds))
                            }
                        } else {
                            // Get photos from region excluding already used ones
                            getRegionPhotoExcluding(region, Buffer.toArray(usedPhotoIds))
                        }
                    };
                };

                switch(selectedPhoto) {
                    case null { 
                        switch(regionFilter) {
                            case null { return #err("No unused photos available") };
                            case (?region) { return #err("No unused photos found in selected region: " # region) };
                        }
                    };
                    case (?photoV2) {
                        // Create round with selected photo
                        switch(gameEngineManager.getNextRound(sessionId, msg.caller, photoV2.id)) {
                            case (#err(e)) { return #err(e) };
                            case (#ok(roundState)) {
                                Debug.print("🎮 Next round photo: " # Nat.toText(photoV2.id) # 
                                           " at (" # Float.toText(photoV2.latitude) # 
                                           ", " # Float.toText(photoV2.longitude) # ")" #
                                           (switch(regionFilter) {
                                               case null { "" };
                                               case (?region) { " [region: " # region # "]" };
                                           }));
                                return #ok(roundState)
                            };
                        }
                    };
                }
            };
        };
    };
    
    public shared(msg) func submitGuess(
        sessionId: Text,
        guessLat: Float,
        guessLon: Float,
        guessAzimuth: ?Float,
        confidenceRadius: Float
    ) : async Result.Result<RoundResult, Text> {
        // 🛡️ ANTI-CHEAT: Validate coordinates
        if (guessLat < -90.0 or guessLat > 90.0) {
            return #err("Invalid latitude: must be between -90 and 90");
        };
        if (guessLon < -180.0 or guessLon > 180.0) {
            return #err("Invalid longitude: must be between -180 and 180");
        };
        
        // 🛡️ ANTI-CHEAT: Validate confidence radius (only allow specific values)
        let allowedRadii : [Float] = [500.0, 1000.0, 2000.0, 5000.0];
        var isValidRadius = false;
        for (allowed in allowedRadii.vals()) {
            if (confidenceRadius == allowed) {
                isValidRadius := true;
            };
        };
        if (not isValidRadius) {
            return #err("Invalid confidence radius: must be one of 500, 1000, 2000, or 5000");
        };
        
        // 🛡️ ANTI-CHEAT: Validate azimuth if provided
        switch(guessAzimuth) {
            case null { }; // OK
            case (?azimuth) {
                if (azimuth < 0.0 or azimuth > 360.0) {
                    return #err("Invalid azimuth: must be between 0 and 360");
                };
            };
        };
        
        // Get session to find photo ID
        switch(gameEngineManager.getSession(sessionId)) {
            case null { #err("Session not found") };
            case (?session) {
                if (session.userId != msg.caller) {
                    return #err("Unauthorized");
                };
                
                if (session.currentRound == 0 or session.currentRound > session.rounds.size()) {
                    return #err("No active round");
                };
                
                let roundIndex = session.currentRound - 1;
                let currentRound = session.rounds[roundIndex];
                
                // 🛡️ ANTI-CHEAT: Check if already submitted
                if (currentRound.guessData != null) {
                    return #err("Guess already submitted for this round");
                };
                
                // 🛡️ ANTI-CHEAT: Timing validation
                let currentTime = Time.now();
                let roundDuration = currentTime - currentRound.startTime;
                let maxRoundTime : Int = 5 * 60 * 1_000_000_000; // 5 minutes in nanoseconds
                
                if (roundDuration > maxRoundTime) {
                    return #err("Round time expired");
                };
                
                // 🛡️ ANTI-CHEAT: Minimum time check (prevent instant submissions)
                let minRoundTime : Int = 2 * 1_000_000_000; // 2 seconds in nanoseconds
                if (roundDuration < minRoundTime) {
                    return #err("Submission too fast - please take time to analyze the photo");
                };
                
                // Get photo location using helper function
                switch(getPhotoFromV2System(currentRound.photoId)) {
                    case null { #err("Photo not found") };
                    case (?location) {
                        // Submit guess
                        switch(gameEngineManager.submitGuess(
                            sessionId, msg.caller,
                            guessLat, guessLon, guessAzimuth, confidenceRadius,
                            location.latitude, location.longitude
                        )) {
                            case (#err(e)) { #err(e) };
                            case (#ok(roundState)) {
                                // 🛡️ ANTI-CHEAT: Check for suspicious activity
                                switch(detectSuspiciousActivity(msg.caller, sessionId)) {
                                    case null { }; // OK
                                    case (?warning) {
                                        // Log suspicious activity but don't block (for now)
                                        // In production, you might want to flag the account
                                        Debug.print("⚠️ ANTI-CHEAT WARNING for " # Principal.toText(msg.caller) # ": " # warning);
                                    };
                                };
                                
                                // Record guess in history
                                let distance = Helpers.calculateHaversineDistance(
                                    guessLat, guessLon,
                                    location.latitude, location.longitude
                                );
                                
                                let guess : GuessHistoryModule.Guess = {
                                    player = msg.caller;
                                    photoId = currentRound.photoId;
                                    lat = guessLat;
                                    lon = guessLon;
                                    dist = distance;
                                    sessionId = sessionId;
                                    timestamp = Time.now();
                                };
                                
                                ignore guessHistoryManager.recordGuess(guess);
                                
                                // Quality score tracking has been removed from the system
                                
                                // Update photo statistics (V2) - track game usage and average score
                                let statsUpdateResult = photoManagerV2.updatePhotoStats(currentRound.photoId, roundState.score);
                                switch(statsUpdateResult) {
                                    case (#ok()) {
                                        Debug.print("[SUBMIT] Successfully updated photo stats for photoId: " # Nat.toText(currentRound.photoId) # " with score: " # Nat.toText(roundState.score));
                                    };
                                    case (#err(msg)) {
                                        Debug.print("[SUBMIT] ERROR: Failed to update photo stats for photoId: " # Nat.toText(currentRound.photoId) # " - " # msg);
                                    };
                                };
                                
                                // Calculate Elo rating changes
                                Debug.print("[SUBMIT] Calculating Elo ratings for player " # Principal.toText(msg.caller) # " on photo " # Nat.toText(currentRound.photoId) # " with score " # Nat.toText(roundState.score));
                                let ratingResult = eloRatingManager.processGameResult(
                                    msg.caller,
                                    currentRound.photoId,
                                    roundState.score
                                );
                                
                                let (playerRatingChange, newPlayerRating, photoRatingChange, newPhotoRating) = switch(ratingResult) {
                                    case (#ok(changes)) {
                                        Debug.print("[SUBMIT] Elo rating updated successfully. Player change: " # Int.toText(changes.playerRatingChange) # ", New rating: " # Int.toText(changes.newPlayerRating));
                                        (changes.playerRatingChange, changes.newPlayerRating, 
                                         changes.photoRatingChange, changes.newPhotoRating)
                                    };
                                    case (#err(err)) {
                                        Debug.print("[SUBMIT] Elo rating calculation failed: " # err);
                                        // Default values if rating calculation fails
                                        (0, eloRatingManager.getPlayerRating(msg.caller), 
                                         0, eloRatingManager.getPhotoRating(currentRound.photoId))
                                    };
                                };
                                
                                // Return result
                                #ok({
                                    displayScore = roundState.score;
                                    normalizedScore = roundState.scoreNorm;
                                    distance = distance;
                                    actualLocation = {
                                        lat = location.latitude;
                                        lon = location.longitude;
                                    };
                                    guessLocation = {
                                        lat = guessLat;
                                        lon = guessLon;
                                    };
                                    photoId = currentRound.photoId;
                                    playerRatingChange = playerRatingChange;
                                    newPlayerRating = newPlayerRating;
                                    photoRatingChange = photoRatingChange;
                                    newPhotoRating = newPhotoRating;
                                })
                            };
                        }
                    };
                }
            };
        }
    };
    
    public shared(msg) func purchaseHint(
        sessionId: Text,
        hintType: GameV2.HintType
    ) : async Result.Result<HintInfo, Text> {
        // Process payment
        let sinkType = switch(hintType) {
            case (#BasicRadius) { #HintBasic };
            case (#PremiumRadius) { #HintPremium };
            case (#DirectionHint) { #HintBasic };
        };
        
        let txId = sessionId # "_hint_" # Int.toText(Time.now());
        
        switch(treasuryManager.processSinkPayment(
            msg.caller, sinkType, txId, tokenManager.getBalances()
        )) {
            case (#err(e)) { #err(e) };
            case (#ok()) {
                // Purchase hint
                switch(gameEngineManager.purchaseHint(sessionId, msg.caller, hintType)) {
                    case (#err(e)) { #err(e) };
                    case (#ok(purchasedType)) {
                        // Get current round
                        switch(gameEngineManager.getSession(sessionId)) {
                            case null { #err("Session not found") };
                            case (?session) {
                                if (session.currentRound == 0 or session.currentRound > session.rounds.size()) {
                                    return #err("No active round");
                                };
                                
                                let currentRound = session.rounds[session.currentRound - 1];
                                
                                // Get photo location using helper function
                                switch(getPhotoFromV2System(currentRound.photoId)) {
                                    case null { #err("Photo not found") };
                                    case (?location) {
                                        // Generate hint info based on type
                                        let hintInfo : HintInfo = switch(hintType) {
                                            case (#BasicRadius) {
                                                #RadiusHint(Constants.BASIC_RADIUS_KM)
                                            };
                                            case (#PremiumRadius) {
                                                #RadiusHint(Constants.PREMIUM_RADIUS_KM)
                                            };
                                            case (#DirectionHint) {
                                                // Calculate direction from center of map to photo
                                                let centerLat = 0.0;
                                                let centerLon = 0.0;
                                                let dLat = location.latitude - centerLat;
                                                let dLon = location.longitude - centerLon;
                                                let azimuth = Float.arctan2(dLon, dLat) * 180.0 / Float.pi;
                                                let normalizedAzimuth = if (azimuth < 0) { azimuth + 360 } else { azimuth };
                                                #DirectionHint(Helpers.getCardinalDirection(normalizedAzimuth))
                                            };
                                        };
                                        
                                        #ok(hintInfo)
                                    };
                                }
                            };
                        }
                    };
                }
            };
        }
    };
    
    public shared(msg) func finalizeSession(sessionId: Text) : async Result.Result<GameV2.SessionResult, Text> {
        switch(gameEngineManager.finalizeSession(sessionId, msg.caller)) {
            case (#err(e)) { #err(e) };
            case (#ok(session)) {
                // Calculate rewards
                let playerReward = calculatePlayerReward(session);
                let uploaderRewards = calculateUploaderRewards(session);
                
                // Update session with player reward
                let updatedSession = {
                    session with
                    playerReward = ?playerReward;
                };
                gameEngineManager.updateSession(sessionId, updatedSession);
                
                // Debug: Verify the update was successful
                Debug.print("💰 finalizeSession - Player: " # Principal.toText(msg.caller));
                Debug.print("💰 finalizeSession - Session total score: " # Nat.toText(session.totalScore));
                Debug.print("💰 finalizeSession - Calculated playerReward: " # Nat.toText(playerReward));
                switch(gameEngineManager.getSession(sessionId)) {
                    case null { Debug.print("❌ ERROR: Session not found after update!") };
                    case (?s) { 
                        Debug.print("✅ Session playerReward after update: " # 
                            (switch(s.playerReward) {
                                case null { "null" };
                                case (?r) { Nat.toText(r) };
                            })
                        );
                    };
                };
                
                // Mint rewards
                if (playerReward > 0) {
                    ignore tokenManager.mint(msg.caller, playerReward);
                };
                
                for ((uploader, reward) in uploaderRewards.vals()) {
                    ignore tokenManager.mint(uploader, reward);
                };
                
                // Update reputation
                let avgScore = session.totalScore / Nat.max(1, session.rounds.size());
                let reputationChange = Float.fromInt(avgScore) / 1000.0; // Scale down
                ignore reputationManager.updateReputation(msg.caller, reputationChange, false, false);
                
                // Update player stats with finalized session data
                let sessionDuration = Int.abs(Time.now() - session.startTime);
                let completedRounds = Array.filter<GameV2.RoundState>(
                    session.rounds,
                    func(r) = r.status == #Completed
                ).size();
                let allRoundsCompleted = completedRounds == session.rounds.size() and completedRounds > 0;
                
                playerStatsManager.updateStatsOnSessionFinalize(
                    msg.caller,
                    session.totalScore,
                    sessionDuration,
                    playerReward,
                    allRoundsCompleted,
                    session.startTime
                );
                
                // Check auto-burn
                let totalSupply = tokenManager.getTotalSupply();
                if (treasuryManager.shouldAutoBurn(totalSupply)) {
                    let burnAmount = treasuryManager.executeAutoBurn(totalSupply);
                    if (burnAmount > 0) {
                        tokenManager.setTotalSupply(totalSupply - burnAmount);
                    };
                };
                
                // Elo ratings are now updated in submitGuess for immediate feedback
                // No need to update them again here
                
                // Add to completion index asynchronously (fire and forget)
                ignore async {
                    gameEngineManager.addToCompletionIndex({
                        timestamp = Time.now();
                        sessionId = sessionId;
                        player = msg.caller;
                        reward = playerReward;
                        score = session.totalScore;
                    });
                };
                
                #ok({
                    sessionId = session.id;
                    userId = msg.caller;
                    totalScore = session.totalScore;
                    totalScoreNorm = session.totalScoreNorm;
                    completedRounds = completedRounds;
                    totalRounds = session.rounds.size();
                    playerReward = playerReward;
                    uploaderRewards = uploaderRewards;
                    duration = Int.abs(Time.now() - session.startTime);
                    rank = null; // TODO: Calculate ranking
                })
            };
        }
    };
    
    // Get specific session
    public query(msg) func getSession(sessionId: Text) : async Result.Result<GameV2.GameSession, Text> {
        switch(gameEngineManager.getSession(sessionId)) {
            case null { #err("Session not found") };
            case (?session) { #ok(session) };
        }
    };
    
    // Debug function to check all sessions for a player
    public query func debugGetPlayerSessions(player: Principal) : async {
        sessionIds: [Text];
        sessions: [{
            id: Text;
            hasEndTime: Bool;
            rounds: Nat;
            totalScore: Nat;
            currentRound: Nat;
        }];
        totalCompleted: Nat;
    } {
        let sessionIds = switch(gameEngineManager.getUserSessions(player)) {
            case null { [] };
            case (?ids) { ids };
        };
        
        var sessions = Buffer.Buffer<{
            id: Text;
            hasEndTime: Bool;
            rounds: Nat;
            totalScore: Nat;
            currentRound: Nat;
        }>(sessionIds.size());
        
        var totalCompleted = 0;
        
        for (sessionId in sessionIds.vals()) {
            switch(gameEngineManager.getSession(sessionId)) {
                case null { };
                case (?session) {
                    let hasEndTime = session.endTime != null;
                    if (hasEndTime) {
                        totalCompleted += 1;
                    };
                    
                    sessions.add({
                        id = session.id;
                        hasEndTime = hasEndTime;
                        rounds = session.rounds.size();
                        totalScore = session.totalScore;
                        currentRound = session.currentRound;
                    });
                };
            };
        };
        
        {
            sessionIds = sessionIds;
            sessions = Buffer.toArray(sessions);
            totalCompleted = totalCompleted;
        }
    };

    // ======================================
    // GUESS HISTORY FUNCTIONS
    // ======================================
    public query func getPhotoGuesses(photoId: Nat, limit: ?Nat) : async [GuessHistoryModule.Guess] {
        guessHistoryManager.getPhotoGuesses(photoId, limit)
    };
    
    public query func getPlayerHistory(player: Principal, limit: ?Nat) : async [Nat] {
        guessHistoryManager.getPlayerHistory(player, limit)
    };
    
    public query func generateHeatmap(photoId: Nat) : async Result.Result<GuessHistoryModule.Heatmap, Text> {
        guessHistoryManager.generateHeatmap(photoId)
    };
    
    // Update photo info using V2 system
    public shared(msg) func updatePhotoInfo(photoId: Nat, updateInfo: {
        title: Text;
        description: Text;
        difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
        hint: Text;
        tags: [Text];
    }) : async Result.Result<(), Text> {
        photoManagerV2.updatePhotoInfo(photoId, msg.caller, updateInfo)
    };
    
    // ======================================
    // PHOTO V2 FUNCTIONS (新しい検索対応版)
    // ======================================
    
    /// 写真のメタデータを作成（チャンクアップロード開始）
    public shared(msg) func createPhotoV2(request: Photo.CreatePhotoRequest) : async Result.Result<Nat, Text> {
        Debug.print("📸 createPhotoV2 called by: " # Principal.toText(msg.caller));
        
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        
        switch(photoManagerV2.createPhoto(request, msg.caller)) {
            case (#err(e)) { #err(e) };
            case (#ok(photoId)) {
                // Update reputation for starting upload
                ignore reputationManager.updateReputation(msg.caller, Constants.UPLOAD_REWARD / 2, true, false);
                #ok(photoId)
            };
        }
    };
    
    /// チャンクをアップロード
    public shared(msg) func uploadPhotoChunkV2(photoId: Nat, chunkIndex: Nat, data: Blob) : async Result.Result<(), Text> {
        photoManagerV2.uploadPhotoChunk(photoId, chunkIndex, data)
    };
    
    /// アップロードを完了
    public shared(msg) func finalizePhotoUploadV2(photoId: Nat) : async Result.Result<(), Text> {
        switch(photoManagerV2.finalizePhotoUpload(photoId)) {
            case (#err(e)) { #err(e) };
            case (#ok()) {
                // Update reputation for completing upload
                ignore reputationManager.updateReputation(msg.caller, Constants.UPLOAD_REWARD / 2, true, false);
                
                // Update player stats for photo upload
                playerStatsManager.incrementPhotoUploads(msg.caller);
                
                #ok()
            };
        }
    };
    
    /// 週間写真を取得（過去7日間の写真）
    public query func getWeeklyPhotos(regionFilter: ?Text, limit: Nat) : async Photo.SearchResult {
        // 過去7日間のタイムスタンプを計算
        let oneWeekAgo = Time.now() - (7 * 24 * 60 * 60 * 1000000000); // 7日間をナノ秒で計算
        
        // まずregionFilterでフィルタリング
        let filter : Photo.SearchFilter = {
            country = null;
            region = switch (regionFilter) {
                case null { null };
                case (?r) { ?r };
            };
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = null;
            difficulty = null;
            status = ?#Active;
        };
        
        // 検索実行（より多くの写真を取得して日付でフィルタリング）
        let searchResult = photoManagerV2.search(filter, null, 1000); // 多めに取得
        
        // 日付でフィルタリング
        let weeklyPhotos = Array.filter<PhotoModuleV2.Photo>(
            searchResult.photos,
            func(photo) : Bool {
                photo.uploadTime >= oneWeekAgo
            }
        );
        
        // 制限数に調整
        let limitedPhotos = if (Array.size(weeklyPhotos) > limit) {
            Array.subArray(weeklyPhotos, 0, limit)
        } else {
            weeklyPhotos
        };
        
        // エンリッチ処理
        let enrichedPhotos = Array.map<PhotoModuleV2.Photo, Photo.PhotoMetaV2>(
            limitedPhotos,
            func(photo) : Photo.PhotoMetaV2 {
                {
                    id = photo.id;
                    owner = photo.owner;
                    uploadTime = photo.uploadTime;
                    
                    latitude = photo.latitude;
                    longitude = photo.longitude;
                    azimuth = photo.azimuth;
                    geoHash = photo.geoHash;
                    
                    title = photo.title;
                    description = photo.description;
                    difficulty = photo.difficulty;
                    hint = photo.hint;
                    
                    country = photo.country;
                    region = photo.region;
                    sceneKind = photo.sceneKind;
                    tags = photo.tags;
                    
                    chunkCount = photo.chunkCount;
                    totalSize = photo.totalSize;
                    uploadState = photo.uploadState;
                    
                    status = photo.status;
                    timesUsed = photo.timesUsed;
                    lastUsedTime = photo.lastUsedTime;
                    
                    aggregatedRatings = null;
                }
            }
        );
        
        {
            photos = enrichedPhotos;
            totalCount = Array.size(weeklyPhotos);
            cursor = ?0;
            hasMore = false;
        }
    };
    
    /// 写真を検索
    public query func searchPhotosV2(filter: Photo.SearchFilter, cursor: ?Nat, limit: Nat) : async Photo.SearchResult {
        let searchResult = photoManagerV2.search(filter, cursor, Nat.min(limit, 100)); // 最大100件に制限
        
        // Enrich photos with ratings
        let enrichedPhotos = Array.map<PhotoModuleV2.Photo, Photo.PhotoMetaV2>(
            searchResult.photos,
            func(photo) : Photo.PhotoMetaV2 {
                {
                    id = photo.id;
                    owner = photo.owner;
                    uploadTime = photo.uploadTime;
                    
                    latitude = photo.latitude;
                    longitude = photo.longitude;
                    azimuth = photo.azimuth;
                    geoHash = photo.geoHash;
                    
                    title = photo.title;
                    description = photo.description;
                    difficulty = photo.difficulty;
                    hint = photo.hint;
                    
                    country = photo.country;
                    region = photo.region;
                    sceneKind = photo.sceneKind;
                    tags = photo.tags;
                    
                    chunkCount = photo.chunkCount;
                    totalSize = photo.totalSize;
                    uploadState = photo.uploadState;
                    
                    status = photo.status;
                    timesUsed = photo.timesUsed;
                    lastUsedTime = photo.lastUsedTime;
                    
                    // Get aggregated ratings
                    aggregatedRatings = ratingManager.getPhotoRatings(photo.id);
                }
            }
        );
        
        {
            photos = enrichedPhotos;
            totalCount = searchResult.totalCount;
            cursor = searchResult.cursor;
            hasMore = searchResult.hasMore;
        }
    };
    
    /// 写真メタデータを取得
    public query func getPhotoMetadataV2(photoId: Nat) : async ?Photo.PhotoMetaV2 {
        switch(photoManagerV2.getPhoto(photoId)) {
            case null { null };
            case (?photo) {
                ?{
                    id = photo.id;
                    owner = photo.owner;
                    uploadTime = photo.uploadTime;
                    
                    latitude = photo.latitude;
                    longitude = photo.longitude;
                    azimuth = photo.azimuth;
                    geoHash = photo.geoHash;
                    
                    title = photo.title;
                    description = photo.description;
                    difficulty = photo.difficulty;
                    hint = photo.hint;
                    
                    country = photo.country;
                    region = photo.region;
                    sceneKind = photo.sceneKind;
                    tags = photo.tags;
                    
                    chunkCount = photo.chunkCount;
                    totalSize = photo.totalSize;
                    uploadState = photo.uploadState;
                    
                    status = photo.status;
                    timesUsed = photo.timesUsed;
                    lastUsedTime = photo.lastUsedTime;
                    
                    // Get aggregated ratings
                    aggregatedRatings = ratingManager.getPhotoRatings(photo.id);
                }
            };
        }
    };
    
    /// 写真のチャンクを取得
    public query func getPhotoChunkV2(photoId: Nat, chunkIndex: Nat) : async ?Blob {
        switch(photoManagerV2.getPhotoChunk(photoId, chunkIndex)) {
            case null { null };
            case (?chunk) { ?chunk.data };
        }
    };
    
    /// 写真の完全なデータを取得（全チャンクを結合済み）
    public query func getPhotoCompleteDataV2(photoId: Nat) : async ?Blob {
        photoManagerV2.getCompletePhotoData(photoId)
    };
    
    /// 写真統計情報を取得
    public query func getPhotoStatsV2() : async PhotoModuleV2.OverallPhotoStats {
        photoManagerV2.getPhotoStats()
    };
    
    /// デバッグ用：移行状況確認（クエリ）
    public query func debugPhotoMigrationStatus() : async {
        legacyPhotos: Nat;
        stablePhotos: Nat;
        legacyChunks: Nat;
        stableChunks: Nat;
    } {
        photoManagerV2.getMigrationStatus()
    };
    
    /// ユーザーの写真を取得
    public shared query(msg) func getUserPhotosV2(cursor: ?Nat, limit: Nat) : async Photo.SearchResult {
        Debug.print("📸 getUserPhotosV2 called by: " # Principal.toText(msg.caller));
        
        let filter : Photo.SearchFilter = {
            country = null;
            region = null;
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = ?msg.caller;
            difficulty = null;
            status = ?#Active;
        };
        
        let searchResult = photoManagerV2.search(filter, cursor, Nat.min(limit, 100));
        Debug.print("📸 getUserPhotosV2 found " # Nat.toText(searchResult.photos.size()) # " photos for user " # Principal.toText(msg.caller));
        
        // Enrich photos with ratings
        let enrichedPhotos = Array.map<PhotoModuleV2.Photo, Photo.PhotoMetaV2>(
            searchResult.photos,
            func(photo) : Photo.PhotoMetaV2 {
                {
                    id = photo.id;
                    owner = photo.owner;
                    uploadTime = photo.uploadTime;
                    
                    latitude = photo.latitude;
                    longitude = photo.longitude;
                    azimuth = photo.azimuth;
                    geoHash = photo.geoHash;
                    
                    title = photo.title;
                    description = photo.description;
                    difficulty = photo.difficulty;
                    hint = photo.hint;
                    
                    country = photo.country;
                    region = photo.region;
                    sceneKind = photo.sceneKind;
                    tags = photo.tags;
                    
                    chunkCount = photo.chunkCount;
                    totalSize = photo.totalSize;
                    uploadState = photo.uploadState;
                    
                    status = photo.status;
                    timesUsed = photo.timesUsed;
                    lastUsedTime = photo.lastUsedTime;
                    
                    // Get aggregated ratings
                    aggregatedRatings = ratingManager.getPhotoRatings(photo.id);
                }
            }
        );
        
        {
            photos = enrichedPhotos;
            totalCount = searchResult.totalCount;
            cursor = searchResult.cursor;
            hasMore = searchResult.hasMore;
        }
    };
    
    /// 写真を削除（V2）
    public shared(msg) func deletePhotoV2(photoId: Nat) : async Result.Result<(), Text> {
        photoManagerV2.deletePhoto(photoId, msg.caller)
    };
    
    /// Update photo statistics (V2)
    public shared(msg) func updatePhotoStatsV2(photoId: Nat, score: Nat) : async Result.Result<(), Text> {
        photoManagerV2.updatePhotoStats(photoId, score)
    };
    
    /// Get photo statistics details (V2)
    public query func getPhotoStatsDetailsV2(photoId: Nat) : async ?PhotoModuleV2.PhotoStats {
        photoManagerV2.getPhotoStatsById(photoId)
    };
    
    // ======================================
    // PHOTO RATING FUNCTIONS
    // ======================================
    
    /// Submit rating for a photo
    public shared(msg) func submitPhotoRating(
        sessionId: Text,
        photoId: Nat,
        roundIndex: Nat,
        ratings: {
            difficulty: Nat;
            interest: Nat;
            beauty: Nat;
        }
    ) : async Result.Result<Text, Text> {
        let userId = msg.caller;
        
        // Verify the user played this photo in the session
        if (not gameEngineManager.verifyRatingEligibility(sessionId, photoId, roundIndex)) {
            return #err("Photo not played in this session/round or round not completed");
        };
        
        // Submit the rating
        ratingManager.submitRating(userId, sessionId, photoId, roundIndex, ratings)
    };
    
    /// Get aggregated ratings for a photo
    public query func getPhotoRatings(photoId: Nat) : async ?RatingModule.AggregatedRatings {
        ratingManager.getPhotoRatings(photoId)
    };
    
    /// Get aggregated ratings for multiple photos
    public query func getMultiplePhotoRatings(photoIds: [Nat]) : async [(Nat, ?RatingModule.AggregatedRatings)] {
        ratingManager.getMultiplePhotoRatings(photoIds)
    };
    
    /// Check if user can rate a specific photo in a session
    public query(msg) func canRatePhoto(sessionId: Text, photoId: Nat) : async Bool {
        ratingManager.canUserRate(msg.caller, sessionId, photoId)
    };
    
    /// Get user's rating status for multiple photos in a session
    public query(msg) func getUserRatingStatus(sessionId: Text, photoIds: [Nat]) : async [(Nat, Bool)] {
        ratingManager.getUserRatingStatus(msg.caller, sessionId, photoIds)
    };
    
    /// Get rating distribution for a photo
    public query func getRatingDistribution(photoId: Nat) : async ?RatingModule.RatingDistribution {
        ratingManager.getRatingDistribution(photoId)
    };
    
    /// Get user's rating history
    public query(msg) func getUserRatingHistory(limit: ?Nat) : async [Nat] {
        ratingManager.getUserRatingHistory(msg.caller, limit)
    };
    
    /// Get rating system statistics
    public query func getRatingStats() : async {
        totalRatings: Nat;
        totalRatedPhotos: Nat;
        totalRatingUsers: Nat;
    } {
        ratingManager.getStats()
    };
    
    /// Get user's rating statistics
    public query(msg) func getUserRatingStats() : async {
        totalRatings: Nat;
        averageDifficulty: Float;
        averageInterest: Float;
        averageBeauty: Float;
    } {
        ratingManager.getUserRatingStats(msg.caller)
    };
    
    // ======================================
    // ADMIN: DATA MIGRATION FUNCTIONS
    // ======================================
    
    /// 🔄 Legacy TrieMapからStableTrieMapにデータを移行（管理者専用）
    public shared(msg) func migrateLegacyPhotoData() : async Result.Result<{
        photosCount: Nat;
        chunksCount: Nat;
        errors: [Text];
    }, Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized: Admin only");
        };
        
        let result = photoManagerV2.migrateLegacyToStable();
        #ok(result)
    };
    
    /// 🔍 移行状況を確認（管理者専用）
    public shared query(msg) func getPhotoMigrationStatus() : async Result.Result<{
        legacyPhotos: Nat;
        stablePhotos: Nat;
        legacyChunks: Nat;
        stableChunks: Nat;
    }, Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized: Admin only");
        };
        
        let status = photoManagerV2.getMigrationStatus();
        #ok(status)
    };
    
    /// 🗑️ 移行完了後にLegacyデータを削除（管理者専用）
    public shared(msg) func clearLegacyPhotoData() : async Result.Result<{
        clearedPhotos: Nat;
        clearedChunks: Nat;
    }, Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized: Admin only");
        };
        
        let result = photoManagerV2.clearLegacyData();
        #ok(result)
    };
    
    
    // ======================================
    // REPUTATION FUNCTIONS
    // ======================================
    public query func getReputation(user: Principal) : async ReputationModule.Reputation {
        reputationManager.getReputation(user)
    };
    
    
    public query func getReputationLeaderboard(limit: Nat) : async [(Principal, Float)] {
        reputationManager.getLeaderboard(limit)
    };
    
    // ======================================
    // ADMIN FUNCTIONS
    // ======================================
    public shared(msg) func adminBanUser(user: Principal) : async Result.Result<(), Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized");
        };
        reputationManager.banUser(user)
    };
    
    public shared(msg) func adminUnbanUser(user: Principal) : async Result.Result<(), Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized");
        };
        reputationManager.unbanUser(user)
    };
    
    public shared(msg) func adminBanPhoto(photoId: Nat) : async Result.Result<(), Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized");
        };
        photoManagerV2.banPhoto(photoId)
    };
    
    public shared(msg) func setPlayFee(fee: Nat) : async Result.Result<(), Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized");
        };
        #ok() // Play fee is now managed in Constants module
    };
    
    public shared(msg) func adminMint(to: Principal, amount: Nat) : async Result.Result<Nat, Text> {
        if (msg.caller != owner) {
            return #err("Unauthorized: Only owner can mint tokens");
        };
        tokenManager.mint(to, amount)
    };
    
    public query func getOwner() : async Principal {
        owner
    };
    
    public shared(msg) func setOwner(newOwner: Principal) : async Result.Result<(), Text> {
        // Only current owner or controller can change owner
        if (msg.caller != owner and msg.caller != Principal.fromText("lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe")) {
            return #err("Unauthorized: Only owner or controller can change owner");
        };
        owner := newOwner;
        #ok()
    };
    
    // Burn tokens from caller's balance
    public shared(msg) func burnTokens(amount: Nat) : async Result.Result<Nat, Text> {
        Debug.print("🔥 Burn request from " # Principal.toText(msg.caller) # " for " # Nat.toText(amount) # " SPOT");
        
        // Check balance
        let account : ICRC1.Account = { owner = msg.caller; subaccount = null };
        let balance = tokenManager.icrc1_balance_of(account);
        if (balance < amount) {
            return #err("Insufficient balance. You have " # Nat.toText(balance / 100) # " SPOT");
        };
        
        // Burn the tokens
        switch (tokenManager.burn(msg.caller, amount)) {
            case (#err(e)) { #err("Failed to burn tokens: " # e) };
            case (#ok(transactionId)) {
                Debug.print("🔥 Successfully burned " # Nat.toText(amount) # " SPOT from " # Principal.toText(msg.caller));
                #ok(transactionId)
            };
        };
    };
    
    // ======================================
    // TREASURY FUNCTIONS
    // ======================================
    public query func getTreasuryStats() : async {
        balance: Nat;
        totalBurned: Nat;
        totalSunk: Nat;
    } {
        treasuryManager.getTreasuryStats()
    };
    
    public query func getSinkHistory(limit: ?Nat) : async [(Time.Time, Text, Nat)] {
        treasuryManager.getSinkHistory(limit)
    };
    
    // ======================================
    // ANTI-CHEAT: Suspicious Activity Detection
    // ======================================
    private func detectSuspiciousActivity(player: Principal, sessionId: Text) : ?Text {
        // Get recent sessions
        switch(gameEngineManager.getUserSessions(player)) {
            case null { null };
            case (?sessionIds) {
                var perfectScoreCount = 0;
                var totalRecentSessions = 0;
                let oneHourAgo = Time.now() - (60 * 60 * 1_000_000_000); // 1 hour
                
                for (sid in sessionIds.vals()) {
                    switch(gameEngineManager.getSession(sid)) {
                        case null { };
                        case (?session) {
                            // Check recent sessions only
                            if (session.startTime > oneHourAgo) {
                                totalRecentSessions += 1;
                                
                                // Count perfect or near-perfect rounds
                                for (round in session.rounds.vals()) {
                                    if (round.score >= 4950) { // 99% perfect
                                        perfectScoreCount += 1;
                                    };
                                };
                            };
                        };
                    };
                };
                
                // 🛡️ Flag if too many perfect scores
                if (perfectScoreCount > 3 and totalRecentSessions > 0) {
                    return ?("Suspicious: Too many perfect scores (" # Nat.toText(perfectScoreCount) # " in recent sessions)");
                };
                
                // 🛡️ Check guess history for patterns
                let recentGuesses = guessHistoryManager.getPlayerHistory(player, ?50);
                if (recentGuesses.size() > 10) {
                    // Check for repeated exact coordinates (bot behavior)
                    var duplicateCount = 0;
                    let guesses = guessHistoryManager.getPhotoGuesses(recentGuesses[0], ?50);
                    
                    for (i in Iter.range(0, guesses.size() - 2)) {
                        for (j in Iter.range(i + 1, guesses.size() - 1)) {
                            if (guesses[i].lat == guesses[j].lat and guesses[i].lon == guesses[j].lon) {
                                duplicateCount += 1;
                            };
                        };
                    };
                    
                    if (duplicateCount > 5) {
                        return ?("Suspicious: Repeated exact coordinates detected");
                    };
                };
                
                null
            };
        }
    };
    
    // ======================================
    // PLAYER STATISTICS
    // ======================================
    public query func getPlayerStats(player: Principal) : async {
        totalGamesPlayed: Nat;
        totalPhotosUploaded: Nat;
        totalRewardsEarned: Nat;
        bestScore: Nat;
        averageScore: Nat;
        averageScore30Days: ?Nat;
        rank: ?Nat;
        winRate: Float;
        currentStreak: Nat;
        longestStreak: Nat;
        reputation: Float;
        totalGuesses: Nat;
        averageDuration: Nat; // 平均プレイ時間（ナノ秒）
        suspiciousActivityFlags: ?Text;
        eloRating: Int; // Eloレーティング
    } {
        // Get stored player stats
        let storedStats = playerStatsManager.getPlayerStats(player);
        
        // Debug logging
        Debug.print("📊 getPlayerStats for " # Principal.toText(player) # " - Using stored stats");
        Debug.print("   totalGamesPlayed: " # Nat.toText(storedStats.totalGamesPlayed));
        Debug.print("   totalScore: " # Nat.toText(storedStats.totalScore));
        Debug.print("   totalRewardsEarned: " # Nat.toText(storedStats.totalRewardsEarned));
        
        // Calculate averages from stored stats
        let averageScore = if (storedStats.totalGamesPlayed > 0) {
            storedStats.totalScore / storedStats.totalGamesPlayed
        } else { 0 };
        
        let averageScore30Days = if (storedStats.gamesPlayed30Days > 0) {
            storedStats.totalScore30Days / storedStats.gamesPlayed30Days
        } else { 0 };
        
        // Calculate average duration
        let averageDuration = if (storedStats.totalGamesPlayed > 0) {
            storedStats.totalDuration / storedStats.totalGamesPlayed
        } else { 0 };
        
        
        // Get player's Elo rank
        // If player has played games but no Elo entry, treat them as having initial rating
        let playerRank = if (storedStats.totalGamesPlayed > 0) {
            switch (eloRatingManager.getPlayerRank(player)) {
                case (?rank) { ?rank };
                case null { 
                    // Player has games but no Elo entry - they should still be ranked
                    // Count as rank 1 if they're the only player with games
                    ?1 
                };
            }
        } else {
            null // No games played = no rank
        };
        
        // Get other stats
        // Use V2 search to count user's photos
        let userPhotoFilter : Photo.SearchFilter = {
            country = null;
            region = null;
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = ?player;
            difficulty = null;
            status = ?#Active;
        };
        let userPhotosResult = photoManagerV2.search(userPhotoFilter, null, 1000); // Get up to 1000 photos
        let totalPhotosUploaded = userPhotosResult.totalCount;
        let reputation = reputationManager.getReputation(player).score;
        let totalGuesses = guessHistoryManager.getPlayerHistory(player, null).size();
        
        // Calculate win rate
        let winRate = if (storedStats.totalGamesPlayed > 0) {
            Float.fromInt(storedStats.completedGames) / Float.fromInt(storedStats.totalGamesPlayed)
        } else { 0.0 };
        
        // Check for suspicious activity
        let suspiciousFlags = detectSuspiciousActivity(player, "");
        
        {
            totalGamesPlayed = storedStats.totalGamesPlayed;
            totalPhotosUploaded = totalPhotosUploaded;
            totalRewardsEarned = storedStats.totalRewardsEarned;
            bestScore = storedStats.bestScore;
            averageScore = averageScore;
            averageScore30Days = if (storedStats.gamesPlayed30Days > 0) { ?averageScore30Days } else { null };
            rank = playerRank;
            currentStreak = storedStats.currentStreak;
            longestStreak = storedStats.longestStreak;
            reputation = reputation;
            totalGuesses = totalGuesses;
            winRate = winRate;
            averageDuration = averageDuration;
            suspiciousActivityFlags = suspiciousFlags;
            eloRating = eloRatingManager.getPlayerRating(player);
        }
    };
    
    // ======================================
    // ELO RATING FUNCTIONS
    // ======================================
    
    // Get Elo leaderboard
    public query func getEloLeaderboard(limit: Nat) : async [(Principal, Int)] {
        eloRatingManager.getTopPlayersByRating(limit)
    };
    
    // Get player's Elo rating details
    public query func getPlayerEloRating(player: Principal) : async {
        rating: Int;
        gamesPlayed: Nat;
        wins: Nat;
        losses: Nat;
        draws: Nat;
        highestRating: Int;
        lowestRating: Int;
    } {
        switch (eloRatingManager.getPlayerRatingDetails(player)) {
            case (?details) {
                {
                    rating = details.rating;
                    gamesPlayed = details.gamesPlayed;
                    wins = details.wins;
                    losses = details.losses;
                    draws = details.draws;
                    highestRating = details.highestRating;
                    lowestRating = details.lowestRating;
                }
            };
            case null {
                {
                    rating = 1500; // Initial rating
                    gamesPlayed = 0;
                    wins = 0;
                    losses = 0;
                    draws = 0;
                    highestRating = 1500;
                    lowestRating = 1500;
                }
            };
        }
    };
    
    // ======================================
    // TIME-BASED LEADERBOARD FUNCTIONS
    // ======================================
    
    // Get weekly leaderboard (last 7 days)
    public query func getWeeklyLeaderboard(limit: Nat) : async [(Principal, Nat, Text)] {
        let oneWeekAgo = Time.now() - (7 * 24 * 60 * 60 * 1_000_000_000);
        let leaderboard = gameEngineManager.getLeaderboardForPeriod(oneWeekAgo, limit);
        
        // Add usernames to the results
        Array.map<(Principal, Nat), (Principal, Nat, Text)>(leaderboard, func((principal, rewards) : (Principal, Nat)) : (Principal, Nat, Text) {
            let username = switch(usernames.get(principal)) {
                case null { "" };
                case (?name) { name };
            };
            (principal, rewards, username)
        })
    };
    
    // Get monthly leaderboard (last 30 days)
    public query func getMonthlyLeaderboard(limit: Nat) : async [(Principal, Nat, Text)] {
        let oneMonthAgo = Time.now() - (30 * 24 * 60 * 60 * 1_000_000_000);
        let leaderboard = gameEngineManager.getLeaderboardForPeriod(oneMonthAgo, limit);
        
        // Add usernames to the results
        Array.map<(Principal, Nat), (Principal, Nat, Text)>(leaderboard, func((principal, rewards) : (Principal, Nat)) : (Principal, Nat, Text) {
            let username = switch(usernames.get(principal)) {
                case null { "" };
                case (?name) { name };
            };
            (principal, rewards, username)
        })
    };
    
    // ======================================
    // USER PROFILE FUNCTIONS
    // ======================================
    
    // Set username for the caller
    public shared(msg) func setUsername(username: Text) : async Result.Result<(), Text> {
        // Validate username
        if (Text.size(username) == 0) {
            return #err("Username cannot be empty");
        };
        
        if (Text.size(username) > 50) {
            return #err("Username must be 50 characters or less");
        };
        
        // TODO: Add more validation (e.g., no offensive words, unique usernames)
        
        usernames.put(msg.caller, username);
        #ok()
    };
    
    // Get username for a principal
    public query func getUsername(principal: Principal) : async ?Text {
        usernames.get(principal)
    };
    
    // ======================================
    // RANKING FUNCTIONS
    // ======================================
    
    // TODO: Future Rating System Implementation
    // Get photo Elo rating and stats
    public query func getPhotoEloRating(photoId: Nat) : async Int {
        eloRatingManager.getPhotoRating(photoId)
    };
    
    public query func getPhotoStatsById(photoId: Nat) : async ?{
        playCount: Nat;
        totalScore: Nat;
        averageScore: Float;
        bestScore: Nat;
        worstScore: Nat;
    } {
        photoManagerV2.getPhotoStatsById(photoId)
    };
    
    // ========================================
    // Debug function to rebuild photo stats from session data
    // ========================================
    public shared(msg) func rebuildPhotoStats() : async Result.Result<Text, Text> {
        if (Principal.toText(msg.caller) != "6lvto-wk4rq-wwea5-neix6-nelpy-tgifs-crt3y-whqnf-5kns5-t3il6-xae") {
            return #err("Unauthorized: Only admin can rebuild stats");
        };
        
        var totalRebuilt = 0;
        var photoStatsMap = TrieMap.TrieMap<Nat, {
            totalScore: Nat;
            playCount: Nat;
            bestScore: Nat;
            worstScore: Nat;
        }>(Nat.equal, Hash.hash);
        
        // Get all sessions through player sessions map
        let playerSessions = gameEngineManager.getPlayerSessionsMap();
        for ((player, sessionIds) in playerSessions.vals()) {
            for (sessionId in sessionIds.vals()) {
                switch (gameEngineManager.getSession(sessionId)) {
                    case null { /* Session not found */ };
                    case (?session) {
            for (round in session.rounds.vals()) {
                if (round.score > 0) {
                    let photoId = round.photoId;
                    switch (photoStatsMap.get(photoId)) {
                        case null {
                            photoStatsMap.put(photoId, {
                                totalScore = round.score;
                                playCount = 1;
                                bestScore = round.score;
                                worstScore = round.score;
                            });
                        };
                        case (?stats) {
                            photoStatsMap.put(photoId, {
                                totalScore = stats.totalScore + round.score;
                                playCount = stats.playCount + 1;
                                bestScore = Nat.max(stats.bestScore, round.score);
                                worstScore = Nat.min(stats.worstScore, round.score);
                            });
                        };
                    };
                };
            };
                    }; // Close session switch
                };
            }
        };
        
        // Update PhotoModuleV2 stats
        for ((photoId, stats) in photoStatsMap.entries()) {
            let avgScore = Float.fromInt(stats.totalScore) / Float.fromInt(stats.playCount);
            let photoStats : PhotoModuleV2.PhotoStats = {
                totalScore = stats.totalScore;
                averageScore = avgScore;
                bestScore = stats.bestScore;
                worstScore = stats.worstScore;
                playCount = stats.playCount;
            };
            switch (photoManagerV2.setPhotoStats(photoId, photoStats)) {
                case (#ok()) {
                    totalRebuilt += 1;
                };
                case (#err(msg)) {
                    Debug.print("[rebuildPhotoStats] Failed to set stats for photoId " # Nat.toText(photoId) # ": " # msg);
                };
            };
        };
        
        #ok("Rebuilt stats for " # Nat.toText(totalRebuilt) # " photos")
    };
    
    // ========================================
    // rating.mdに基づくEloレーティングシステムの実装計画:
    //
    // 1. プレイヤーレーティング（初期値1500）
    //    - 各プレイヤーのスキルレベルを表す数値
    //    - 勝敗に応じて上下する
    //
    // 2. 写真レーティング（初期値1500）
    //    - 各写真の難易度を表す数値
    //    - プレイヤーの成績に応じて調整される
    //
    // 3. 動的K係数
    //    - 低レート（<1600）: K=32
    //    - 中レート（1600-1999）: K=24
    //    - 高レート（≥2000）: K=16
    //
    // 4. 勝敗判定
    //    - プレイヤーのスコア vs 写真の平均スコア
    //    - result = 1 (勝利), 0.5 (引き分け), 0 (敗北)
    //
    // 5. レーティング更新式
    //    - expected = 1 / (1 + 10^((photoRating - playerRating) / 400))
    //    - playerRating += K * (result - expected)
    //
    // 6. インフレ抑制
    //    - レート上限: 2500
    //    - 日次上昇幅制限: +100pt/day
    //
    // 7. 必要な新しいデータ構造
    //    - PlayerRating: HashMap<Principal, { rating: Nat; lastUpdated: Time.Time }>
    //    - PhotoRating: HashMap<Nat, { rating: Nat; avgScore: Float; playCount: Nat }>
    //
    // 実装時の注意:
    // - レーティング計算はゲーム終了時（submitGuess）に実行
    // - 初回プレイヤーは1500から開始
    // - 写真の初期レーティングは難易度に基づいて設定
    // ========================================
    public query func getPlayerRank(player: Principal) : async ?Nat {
        // Use Elo-based ranking
        eloRatingManager.getPlayerRank(player)
    };
    
    public query func getLeaderboard(limit: Nat) : async [(Principal, Nat)] {
        // Get top players by Elo rating
        let topPlayers = eloRatingManager.getTopPlayersByRating(limit);
        
        // Convert Int ratings to Nat for compatibility
        Array.map<(Principal, Int), (Principal, Nat)>(
            topPlayers,
            func((p, rating)) = (p, Int.abs(rating))
        )
    };
    
    // Get leaderboard with detailed player statistics
    public query func getLeaderboardWithStats(limit: Nat) : async [(Principal, {
        score: Nat;
        gamesPlayed: Nat;
        photosUploaded: Nat;
        totalRewards: Nat;
        username: ?Text;
    })] {
        // Get all player stats from PlayerStatsModule
        let allStats = playerStatsManager.getAllStats();
        
        // Convert to the expected format
        var playerStats = Buffer.Buffer<(Principal, { score: Nat; gamesPlayed: Nat; photosUploaded: Nat; totalRewards: Nat; username: ?Text })>(allStats.size());
        
        for ((principal, stats) in allStats.vals()) {
            // Only include players who have played at least one game
            if (stats.totalGamesPlayed > 0) {
                // Get username
                let username = switch(usernames.get(principal)) {
                    case null { null };
                    case (?name) { ?name };
                };
                
                playerStats.add((principal, {
                    score = stats.bestScore;
                    gamesPlayed = stats.totalGamesPlayed;
                    photosUploaded = stats.totalPhotosUploaded;
                    totalRewards = stats.totalRewardsEarned;
                    username = username;
                }));
            };
        };
        
        // Sort by best score (descending)
        let sortedStats = Array.sort(
            Buffer.toArray(playerStats), 
            func(a: (Principal, { score: Nat; gamesPlayed: Nat; photosUploaded: Nat; totalRewards: Nat; username: ?Text }), 
                 b: (Principal, { score: Nat; gamesPlayed: Nat; photosUploaded: Nat; totalRewards: Nat; username: ?Text })) : {#less; #equal; #greater} {
            if (a.1.score > b.1.score) { #less }
            else if (a.1.score < b.1.score) { #greater }
            else { #equal }
        });
        
        // Return top N players
        let actualLimit = Nat.min(limit, sortedStats.size());
        Array.tabulate<(Principal, { score: Nat; gamesPlayed: Nat; photosUploaded: Nat; totalRewards: Nat; username: ?Text })>(
            actualLimit, 
            func(i) = sortedStats[i]
        )
    };

    // Get leaderboard sorted by total rewards earned
    public query func getLeaderboardByRewards(limit: Nat) : async [(Principal, {
        principal: Principal;
        totalRewardsEarned: Nat;
        totalGamesPlayed: Nat;
        bestScore: Nat;
        username: ?Text;
    })] {
        // Get top players by rewards from PlayerStatsModule
        let topPlayersByRewards = playerStatsManager.getTopPlayersByRewards(limit);
        
        // Enrich with additional data
        Array.map<(Principal, Nat), (Principal, {
            principal: Principal;
            totalRewardsEarned: Nat;
            totalGamesPlayed: Nat;
            bestScore: Nat;
            username: ?Text;
        })>(
            topPlayersByRewards,
            func((principal, totalRewardsEarned)) {
                let stats = playerStatsManager.getPlayerStats(principal);
                let username = usernames.get(principal);
                
                (principal, {
                    principal = principal;
                    totalRewardsEarned = totalRewardsEarned;
                    totalGamesPlayed = stats.totalGamesPlayed;
                    bestScore = stats.bestScore;
                    username = username;
                })
            }
        )
    };

    // Debug function to check player stats data
    public query func debugGetAllPlayerStats() : async [(Principal, {
        totalGamesPlayed: Nat;
        totalRewardsEarned: Nat;
        bestScore: Nat;
    })] {
        let allStats = playerStatsManager.getAllStats();
        Array.map<(Principal, PlayerStatsModule.PlayerStats), (Principal, {
            totalGamesPlayed: Nat;
            totalRewardsEarned: Nat;
            bestScore: Nat;
        })>(
            allStats,
            func((principal, stats)) = (principal, {
                totalGamesPlayed = stats.totalGamesPlayed;
                totalRewardsEarned = stats.totalRewardsEarned;
                bestScore = stats.bestScore;
            })
        )
    };
    
    // Get top photos by times used (play count)
    public query func getTopPhotosByUsage(limit: Nat) : async [(Nat, { photoId: Nat; owner: Principal; timesUsed: Nat; title: Text })] {
        // Get all photos with their usage stats
        var photoStats : [(Nat, { photoId: Nat; owner: Principal; timesUsed: Nat; title: Text })] = [];
        
        // Use V2 search to get all active photos
        let filter : Photo.SearchFilter = {
            status = ?#Active;
            country = null;
            region = null;
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = null;
            difficulty = null;
        };
        
        let searchResult = photoManagerV2.search(filter, null, 1000); // Get up to 1000 photos
        
        for (photo in searchResult.photos.vals()) {
            // Get photo stats
            let stats = switch(photoManagerV2.getPhotoStatsById(photo.id)) {
                case null { { playCount = 0; totalScore = 0; averageScore = 0.0 } };
                case (?s) { s };
            };
            
            photoStats := Array.append(photoStats, [(
                photo.id,
                {
                    photoId = photo.id;
                    owner = photo.owner;
                    timesUsed = stats.playCount;
                    title = photo.title;
                }
            )]);
        };
        
        // Sort by times used (descending)
        let sortedPhotos = Array.sort(photoStats, func(a: (Nat, { photoId: Nat; owner: Principal; timesUsed: Nat; title: Text }), 
                                                       b: (Nat, { photoId: Nat; owner: Principal; timesUsed: Nat; title: Text })) : {#less; #equal; #greater} {
            if (a.1.timesUsed > b.1.timesUsed) { #less }
            else if (a.1.timesUsed < b.1.timesUsed) { #greater }
            else { #equal }
        });
        
        // Return top N photos
        let actualLimit = Nat.min(limit, sortedPhotos.size());
        Array.tabulate<(Nat, { photoId: Nat; owner: Principal; timesUsed: Nat; title: Text })>(actualLimit, func(i) = sortedPhotos[i])
    };
    
    // Get top photo uploaders by total photos uploaded
    public query func getTopUploaders(limit: Nat) : async [(Principal, { totalPhotos: Nat; totalTimesUsed: Nat; username: ?Text })] {
        // Map to track uploader stats
        let uploaderStats = HashMap.HashMap<Principal, { totalPhotos: Nat; totalTimesUsed: Nat }>(10, Principal.equal, Principal.hash);
        
        // Use V2 search to get all active photos
        let filter : Photo.SearchFilter = {
            status = ?#Active;
            country = null;
            region = null;
            sceneKind = null;
            tags = null;
            nearLocation = null;
            owner = null;
            difficulty = null;
        };
        
        let searchResult = photoManagerV2.search(filter, null, 1000);
        
        for (photo in searchResult.photos.vals()) {
            // Get photo stats
            let stats = switch(photoManagerV2.getPhotoStatsById(photo.id)) {
                case null { { playCount = 0; totalScore = 0; averageScore = 0.0 } };
                case (?s) { s };
            };
            
            switch(uploaderStats.get(photo.owner)) {
                case null {
                    uploaderStats.put(photo.owner, { 
                        totalPhotos = 1; 
                        totalTimesUsed = stats.playCount 
                    });
                };
                case (?current) {
                    uploaderStats.put(photo.owner, {
                        totalPhotos = current.totalPhotos + 1;
                        totalTimesUsed = current.totalTimesUsed + stats.playCount;
                    });
                };
            };
        };
        
        // Convert to array and sort
        let uploaderArray = Iter.toArray(uploaderStats.entries());
        
        // Sort by total times used (descending), then by total photos
        let sortedUploaders = Array.sort(uploaderArray, func(a: (Principal, { totalPhotos: Nat; totalTimesUsed: Nat }), 
                                                            b: (Principal, { totalPhotos: Nat; totalTimesUsed: Nat })) : {#less; #equal; #greater} {
            if (a.1.totalTimesUsed > b.1.totalTimesUsed) { #less }
            else if (a.1.totalTimesUsed < b.1.totalTimesUsed) { #greater }
            else if (a.1.totalPhotos > b.1.totalPhotos) { #less }
            else if (a.1.totalPhotos < b.1.totalPhotos) { #greater }
            else { #equal }
        });
        
        // Return top N uploaders
        let actualLimit = Nat.min(limit, sortedUploaders.size());
        Array.tabulate<(Principal, { totalPhotos: Nat; totalTimesUsed: Nat; username: ?Text })>(
            actualLimit, 
            func(i) {
                let (principal, stats) = sortedUploaders[i];
                (principal, {
                    totalPhotos = stats.totalPhotos;
                    totalTimesUsed = stats.totalTimesUsed;
                    username = usernames.get(principal);
                })
            }
        )
    };
    
    // ======================================
    // GAME LIMITS FUNCTIONS
    // ======================================
    public query func getRemainingPlays(player: ?Principal) : async {
        remainingPlays: Nat;
        playLimit: Nat;
    } {
        let targetPlayer = switch (player) {
            case null { Principal.fromText("2vxsx-fae") }; // Anonymous principal
            case (?p) { p };
        };
        
        {
            remainingPlays = gameLimitsManager.getRemainingPlays(targetPlayer);
            playLimit = gameLimitsManager.getPlayLimit(targetPlayer);
        }
    };
    
    // Purchase Pro membership
    public shared(msg) func purchaseProMembership() : async Result.Result<{
        expiryTime: Time.Time;
        transactionId: Nat;
    }, Text> {
        let cost = gameLimitsManager.getProMembershipCost();
        
        // Check balance
        let account : ICRC1.Account = { owner = msg.caller; subaccount = null };
        let balance = tokenManager.icrc1_balance_of(account);
        if (balance < cost) {
            return #err("Insufficient balance. Need " # Nat.toText(cost / 100) # " SPOT");
        };
        
        // Process payment
        switch (tokenManager.burn(msg.caller, cost)) {
            case (#err(e)) { return #err("Failed to process payment: " # e) };
            case (#ok(transactionId)) {
                // Activate Pro membership
                switch (gameLimitsManager.purchaseProMembership(msg.caller)) {
                    case (#err(e)) { 
                        // Refund on error
                        ignore tokenManager.mint(msg.caller, cost);
                        #err(e)
                    };
                    case (#ok(expiryTime)) {
                        Debug.print("💎 Pro membership purchased by " # Principal.toText(msg.caller) # " for " # Nat.toText(cost) # " SPOT");
                        #ok({
                            expiryTime = expiryTime;
                            transactionId = transactionId;
                        })
                    };
                };
            };
        };
    };
    
    // Get Pro membership status
    public query func getProMembershipStatus(player: ?Principal) : async {
        isPro: Bool;
        expiryTime: ?Time.Time;
        cost: Nat;
    } {
        let targetPlayer = switch (player) {
            case null { Principal.fromText("2vxsx-fae") }; // Anonymous principal
            case (?p) { p };
        };
        
        {
            isPro = gameLimitsManager.isProMember(targetPlayer);
            expiryTime = gameLimitsManager.getProMembershipExpiry(targetPlayer);
            cost = gameLimitsManager.getProMembershipCost();
        }
    };
    
    // Get Pro membership expiry time for the caller
    public shared query(msg) func getProMembershipExpiry() : async ?Time.Time {
        gameLimitsManager.getProMembershipExpiry(msg.caller)
    };
    
    // ======================================
    // II INTEGRATION PUBLIC FUNCTIONS
    // ======================================
    
    // Create new II integration session
    public func newSession(publicKey: Text) : async IIIntegrationModule.NewSessionResponse {
        let canisterOrigin = "https://77fv5-oiaaa-aaaal-qsoea-cai.raw.icp0.io";
        iiIntegrationManager.newSession(publicKey, canisterOrigin)
    };
    
    // Save delegation for a session
    public func saveDelegate(sessionId: Text, delegation: Text, userPublicKey: Text, delegationPubkey: Text) : async IIIntegrationModule.DelegateResponse {
        iiIntegrationManager.saveDelegate(sessionId, delegation, userPublicKey, delegationPubkey)
    };
    
    // Close a session
    public func closeSession(sessionId: Text) : async Bool {
        iiIntegrationManager.closeSession(sessionId)
    };
    
    // Get session status
    public query func getSessionStatus(sessionId: Text) : async ?IIIntegrationModule.SessionData {
        iiIntegrationManager.getSessionStatus(sessionId)
    };
    
    // Get delegation for closed session
    public query func getDelegation(sessionId: Text) : async ?{delegation: Text; userPublicKey: Text; delegationPubkey: Text} {
        iiIntegrationManager.getDelegation(sessionId)
    };
    
    // ======================================
    // STATS AND METRICS
    // ======================================
    public query func getSystemStats() : async {
        totalUsers: Nat;
        totalPhotos: Nat;
        totalGuesses: Nat;
        totalSessions: Nat;
        totalSupply: Nat;
        photoStats: {
            totalPhotos: Nat;
            activePhotos: Nat;
            bannedPhotos: Nat;
            deletedPhotos: Nat;
        };
        gameMetrics: {
            totalSessions: Nat;
            totalRounds: Nat;
            errorCount: Nat;
            totalRequests: Nat;
        };
    } {
        let photoStatsForSystem = photoManagerV2.getPhotoStatsForSystem();
        let gameMetrics = gameEngineManager.getMetrics();
        
        {
            totalUsers = reputationManager.getLeaderboard(10000).size();
            totalPhotos = photoStatsForSystem.totalPhotos;
            totalGuesses = guessHistoryManager.getTotalGuesses();
            totalSessions = gameMetrics.totalSessions;
            totalSupply = tokenManager.icrc1_total_supply();
            photoStats = {
                totalPhotos = photoStatsForSystem.totalPhotos;
                activePhotos = photoStatsForSystem.activePhotos;
                bannedPhotos = photoStatsForSystem.bannedPhotos;
                deletedPhotos = photoStatsForSystem.deletedPhotos;
            };
            gameMetrics = gameMetrics;
        }
    };
    
    // ======================================
    // DEBUG FUNCTIONS (temporary)
    // ======================================
    
    // Rebuild player stats from existing sessions
    public func rebuildPlayerStats() : async Text {
        var processed = 0;
        var errors = 0;
        
        // Get all player sessions
        let playerSessionsMap = gameEngineManager.getPlayerSessionsMap();
        
        for ((player, sessionIds) in playerSessionsMap.vals()) {
            for (sessionId in sessionIds.vals()) {
                switch (gameEngineManager.getSession(sessionId)) {
                    case null { };
                    case (?session) {
                        // Only process completed sessions
                        if (session.endTime != null) {
                            let sessionDuration = Int.abs(
                                switch(session.endTime) {
                                    case null { 0 };
                                    case (?endTime) { endTime - session.startTime };
                                }
                            );
                            
                            let completedRounds = Array.filter<GameV2.RoundState>(
                                session.rounds,
                                func(r) = r.status == #Completed
                            ).size();
                            
                            let allRoundsCompleted = completedRounds == session.rounds.size() and completedRounds > 0;
                            let reward = switch(session.playerReward) {
                                case null { 
                                    // Recalculate reward for sessions that don't have it stored
                                    Debug.print("⚠️ rebuildPlayerStats - Session " # sessionId # " has null playerReward, recalculating...");
                                    let calculatedReward = calculatePlayerReward(session);
                                    
                                    // Update the session with the calculated reward for future use
                                    let updatedSession = {
                                        session with
                                        playerReward = ?calculatedReward;
                                    };
                                    gameEngineManager.updateSession(sessionId, updatedSession);
                                    Debug.print("✅ Updated session " # sessionId # " with playerReward: " # Nat.toText(calculatedReward));
                                    
                                    calculatedReward
                                };
                                case (?r) { r };
                            };
                            
                            playerStatsManager.updateStatsOnSessionFinalize(
                                player,
                                session.totalScore,
                                sessionDuration,
                                reward,
                                allRoundsCompleted,
                                session.startTime
                            );
                            processed += 1;
                        };
                    };
                };
            };
        };
        
        "Processed " # Nat.toText(processed) # " sessions, errors: " # Nat.toText(errors)
    };
    
    // Debug player stats and rewards
    public query func debugPlayerStatsAndRewards(player: Principal) : async {
        stats: {
            totalGamesPlayed: Nat;
            totalRewardsEarned: Nat;
            totalScore: Nat;
            bestScore: Nat;
        };
        sessions: [{
            sessionId: Text;
            totalScore: Nat;
            storedReward: ?Nat;
            calculatedReward: Nat;
            roundsCompleted: Nat;
        }];
    } {
        let playerStats = playerStatsManager.getPlayerStats(player);
        let stats = {
            totalGamesPlayed = playerStats.totalGamesPlayed;
            totalRewardsEarned = playerStats.totalRewardsEarned;
            totalScore = playerStats.totalScore;
            bestScore = playerStats.bestScore;
        };
        
        var sessions : [{sessionId: Text; totalScore: Nat; storedReward: ?Nat; calculatedReward: Nat; roundsCompleted: Nat}] = [];
        
        switch(gameEngineManager.getUserSessions(player)) {
            case null { };
            case (?sessionIds) {
                for (sessionId in sessionIds.vals()) {
                    switch(gameEngineManager.getSession(sessionId)) {
                        case null { };
                        case (?session) {
                            if (session.endTime != null) {
                                let completedRounds = Array.filter<GameV2.RoundState>(
                                    session.rounds,
                                    func(r) = r.status == #Completed
                                ).size();
                                
                                sessions := Array.append(sessions, [{
                                    sessionId = sessionId;
                                    totalScore = session.totalScore;
                                    storedReward = session.playerReward;
                                    calculatedReward = calculatePlayerReward(session);
                                    roundsCompleted = completedRounds;
                                }]);
                            };
                        };
                    };
                };
            };
        };
        
        {
            stats = stats;
            sessions = sessions;
        }
    };
    
    // Debug reward calculation
    public query func debugCalculatePlayerReward(sessionId: Text) : async {
        sessionFound: Bool;
        roundCount: Nat;
        totalScore: Nat;
        roundDetails: [(Nat, Nat)]; // (round index, score)
        totalReward: Nat;
    } {
        switch(gameEngineManager.getSession(sessionId)) {
            case null { 
                {
                    sessionFound = false;
                    roundCount = 0;
                    totalScore = 0;
                    roundDetails = [];
                    totalReward = 0;
                }
            };
            case (?session) {
                let rounds = session.rounds.size();
                var totalReward : Nat = 0;
                var roundDetails : [(Nat, Nat)] = [];
                
                var index = 0;
                for (round in session.rounds.vals()) {
                    let roundReward = (round.score * 100) / 5000;
                    totalReward += roundReward;
                    roundDetails := Array.append(roundDetails, [(index, round.score)]);
                    index += 1;
                };
                
                {
                    sessionFound = true;
                    roundCount = rounds;
                    totalScore = session.totalScore;
                    roundDetails = roundDetails;
                    totalReward = totalReward;
                }
            };
        }
    };
    
    // ======================================
    // HELPER FUNCTIONS
    // ======================================
    
    // Helper function to get photo from V2 system
    private func getPhotoFromV2System(photoId: Nat) : ?{ 
        owner: Principal; 
        latitude: Float; 
        longitude: Float 
    } {
        switch(photoManagerV2.getPhoto(photoId)) {
            case null { null };
            case (?photoV2) {
                ?{ 
                    owner = photoV2.owner;
                    latitude = photoV2.latitude; 
                    longitude = photoV2.longitude 
                }
            };
        }
    };
    
    private func calculatePlayerReward(session: GameV2.GameSession) : Nat {
        // Simple reward calculation matching frontend
        // Each round: (score / 5000) * 1.0 SPOT = (score / 5000) * 100 units
        let rounds = session.rounds.size();
        
        Debug.print("💰 calculatePlayerReward - Session ID: " # session.id);
        Debug.print("💰 calculatePlayerReward - Rounds count: " # Nat.toText(rounds));
        
        if (rounds == 0) {
            return 0;
        };
        
        var totalReward : Nat = 0;
        
        for (round in session.rounds.vals()) {
            // Each round can earn max 1.0 SPOT (100 units) based on score
            // Formula: (score / 5000) * 100 units
            let roundReward = (round.score * 100) / 5000; // Integer division
            Debug.print("💰 calculatePlayerReward - Round score: " # Nat.toText(round.score) # ", Round reward: " # Nat.toText(roundReward));
            totalReward += roundReward;
        };
        
        Debug.print("💰 calculatePlayerReward - Total reward: " # Nat.toText(totalReward));
        totalReward
    };
    
    private func calculateUploaderRewards(session: GameV2.GameSession) : [(Principal, Nat)] {
        let uploaderRewards = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
        
        for (round in session.rounds.vals()) {
            switch(getPhotoFromV2System(round.photoId)) {
                case null { }; // Photo not found, skip
                case (?photo) {
                    let currentReward = Option.get(uploaderRewards.get(photo.owner), 0);
                    
                    // Uploader gets percentage of player score for this round
                    let roundReward = round.scoreNorm * Constants.UPLOADER_REWARD_RATE / 100;
                    
                    uploaderRewards.put(photo.owner, currentReward + roundReward);
                };
            };
        };
        
        Iter.toArray(uploaderRewards.entries())
    };
    
    private func cleanupExpiredSessions() : async () {
        await gameEngineManager.cleanupExpiredSessions();
    };
    
    // ======================================
    // II INTEGRATION HTTP ENDPOINTS
    // ======================================
    
    // Hash tree type for certification
    type Hash = Blob;
    type Key = Blob;
    type Value = Blob;
    type HashTree = {
        #empty;
        #pruned : Hash;
        #fork : (HashTree, HashTree);
        #labeled : (Key, HashTree);
        #leaf : Value;
    };
    
    // Certified data for root path
    private stable var certifiedRootHash : Blob = Blob.fromArray([]);
    
    // SHA256 constants
    private let K : [Nat32] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    
    // SHA256 implementation
    private func sha256(data: Blob) : Blob {
        let bytes = Blob.toArray(data);
        let msgLen = bytes.size();
        
        // Initialize hash values
        var H : [var Nat32] = [var
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ];
        
        // Pre-processing: adding a single 1 bit
        let paddingLen = if ((msgLen + 9) % 64 == 0) { 9 } else { 64 - ((msgLen + 9) % 64) + 9 };
        let totalLen = msgLen + paddingLen;
        var paddedMsg = Buffer.Buffer<Nat8>(totalLen);
        
        for (b in bytes.vals()) {
            paddedMsg.add(b);
        };
        paddedMsg.add(0x80);
        
        for (i in Iter.range(1, paddingLen - 9)) {
            paddedMsg.add(0x00);
        };
        
        // Append length in bits as 64-bit big-endian
        let lenBits : Nat64 = Nat64.fromNat(msgLen * 8);
        for (i in Iter.range(0, 7)) {
            let shift = 8 * (7 - i);
            paddedMsg.add(Nat8.fromNat(Nat64.toNat((lenBits >> Nat64.fromNat(shift)) & 0xFF)));
        };
        
        let paddedArray = Buffer.toArray(paddedMsg);
        
        // Process message in 512-bit chunks
        let chunks = totalLen / 64;
        for (chunk in Iter.range(0, chunks - 1)) {
            let offset = chunk * 64;
            var W = Buffer.Buffer<Nat32>(64);
            
            // Copy chunk into first 16 words W[0..15]
            for (i in Iter.range(0, 15)) {
                let idx = offset + i * 4;
                let word = (Nat32.fromNat(Nat8.toNat(paddedArray[idx])) << 24) |
                           (Nat32.fromNat(Nat8.toNat(paddedArray[idx + 1])) << 16) |
                           (Nat32.fromNat(Nat8.toNat(paddedArray[idx + 2])) << 8) |
                           Nat32.fromNat(Nat8.toNat(paddedArray[idx + 3]));
                W.add(word);
            };
            
            // Extend the first 16 words into the remaining 48 words W[16..63]
            for (i in Iter.range(16, 63)) {
                let s0 = ((W.get(i-15) >> 7) | (W.get(i-15) << 25)) ^
                         ((W.get(i-15) >> 18) | (W.get(i-15) << 14)) ^
                         (W.get(i-15) >> 3);
                let s1 = ((W.get(i-2) >> 17) | (W.get(i-2) << 15)) ^
                         ((W.get(i-2) >> 19) | (W.get(i-2) << 13)) ^
                         (W.get(i-2) >> 10);
                W.add(W.get(i-16) +% s0 +% W.get(i-7) +% s1);
            };
            
            // Initialize working variables
            var a = H[0];
            var b = H[1];
            var c = H[2];
            var d = H[3];
            var e = H[4];
            var f = H[5];
            var g = H[6];
            var h = H[7];
            
            // Main loop
            for (i in Iter.range(0, 63)) {
                let S1 = ((e >> 6) | (e << 26)) ^ ((e >> 11) | (e << 21)) ^ ((e >> 25) | (e << 7));
                let ch = (e & f) ^ ((^e) & g);
                let temp1 = h +% S1 +% ch +% K[i] +% W.get(i);
                let S0 = ((a >> 2) | (a << 30)) ^ ((a >> 13) | (a << 19)) ^ ((a >> 22) | (a << 10));
                let maj = (a & b) ^ (a & c) ^ (b & c);
                let temp2 = S0 +% maj;
                
                h := g;
                g := f;
                f := e;
                e := d +% temp1;
                d := c;
                c := b;
                b := a;
                a := temp1 +% temp2;
            };
            
            // Add the compressed chunk to the current hash value
            H[0] := H[0] +% a;
            H[1] := H[1] +% b;
            H[2] := H[2] +% c;
            H[3] := H[3] +% d;
            H[4] := H[4] +% e;
            H[5] := H[5] +% f;
            H[6] := H[6] +% g;
            H[7] := H[7] +% h;
        };
        
        // Produce the final hash value as a 32-byte Blob
        let result = Buffer.Buffer<Nat8>(32);
        for (i in Iter.range(0, 7)) {
            let h = H[i];
            result.add(Nat8.fromNat(Nat32.toNat((h >> 24) & 0xFF)));
            result.add(Nat8.fromNat(Nat32.toNat((h >> 16) & 0xFF)));
            result.add(Nat8.fromNat(Nat32.toNat((h >> 8) & 0xFF)));
            result.add(Nat8.fromNat(Nat32.toNat(h & 0xFF)));
        };
        
        Blob.fromArray(Buffer.toArray(result))
    };
    
    // Base64 encoding for certificate header
    private func base64Encode(data: Blob) : Text {
        let base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let bytes = Blob.toArray(data);
        var result = "";
        var i = 0;
        
        while (i < bytes.size()) {
            let b1 = bytes[i];
            let b2 : Nat8 = if (i + 1 < bytes.size()) { bytes[i + 1] } else { 0 : Nat8 };
            let b3 : Nat8 = if (i + 2 < bytes.size()) { bytes[i + 2] } else { 0 : Nat8 };
            
            let n = (Nat32.fromNat(Nat8.toNat(b1)) << 16) | 
                    (Nat32.fromNat(Nat8.toNat(b2)) << 8) | 
                    Nat32.fromNat(Nat8.toNat(b3));
            
            result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 18) & 0x3F)]);
            result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 12) & 0x3F)]);
            result #= if (i + 1 < bytes.size()) {
                Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 6) & 0x3F)])
            } else { "=" };
            result #= if (i + 2 < bytes.size()) {
                Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat(n & 0x3F)])
            } else { "=" };
            
            i += 3;
        };
        
        result
    };
    
    // Base64URL encoding for certificate header (no padding, URL-safe)
    private func base64UrlEncode(data: Blob) : Text {
        let base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let bytes = Blob.toArray(data);
        var result = "";
        var i = 0;
        
        while (i < bytes.size()) {
            let b1 = bytes[i];
            let b2 : Nat8 = if (i + 1 < bytes.size()) { bytes[i + 1] } else { 0 : Nat8 };
            let b3 : Nat8 = if (i + 2 < bytes.size()) { bytes[i + 2] } else { 0 : Nat8 };
            
            let n = (Nat32.fromNat(Nat8.toNat(b1)) << 16) | 
                    (Nat32.fromNat(Nat8.toNat(b2)) << 8) | 
                    Nat32.fromNat(Nat8.toNat(b3));
            
            result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 18) & 0x3F)]);
            result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 12) & 0x3F)]);
            
            // No padding for Base64URL
            if (i + 1 < bytes.size()) {
                result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat((n >> 6) & 0x3F)]);
                if (i + 2 < bytes.size()) {
                    result #= Text.fromChar(Text.toArray(base64Chars)[Nat32.toNat(n & 0x3F)]);
                };
            };
            
            i += 3;
        };
        
        result
    };
    
    // CBOR encoding helpers
    private func cborEncodeBytes(data: Blob) : Blob {
        let bytes = Blob.toArray(data);
        let size = bytes.size();
        
        if (size < 24) {
            // Major type 2 (byte string) with length in lower 5 bits
            Blob.fromArray(Array.append([0x40 + Nat8.fromNat(size)], bytes))
        } else if (size < 256) {
            // Major type 2 with 1-byte length
            Blob.fromArray(Array.append([0x58 : Nat8, Nat8.fromNat(size)], bytes))
        } else {
            // For simplicity, limit to 255 bytes
            Blob.fromArray(Array.append([0x58 : Nat8, 0xFF : Nat8], bytes))
        }
    };
    
    // Encode hash tree for certificate
    private func encodeHashTree(tree: HashTree) : Blob {
        switch (tree) {
            case (#empty) {
                // CBOR array with 0 (empty)
                Blob.fromArray([0x81, 0x00]) // Array of 1 element: 0
            };
            case (#pruned(hash)) {
                // CBOR array with 1 (pruned) and hash
                let encodedHash = cborEncodeBytes(hash);
                Blob.fromArray(Array.append([0x82 : Nat8, 0x01 : Nat8], Blob.toArray(encodedHash))) // Array of 2 elements
            };
            case (#fork(left, right)) {
                // CBOR array with 2 (fork) and two subtrees
                let leftEncoded = encodeHashTree(left);
                let rightEncoded = encodeHashTree(right);
                var result = Buffer.Buffer<Nat8>(10);
                result.add(0x83); // Array of 3 elements
                result.add(0x02); // 2 for fork
                for (b in Blob.toArray(leftEncoded).vals()) { result.add(b) };
                for (b in Blob.toArray(rightEncoded).vals()) { result.add(b) };
                Blob.fromArray(Buffer.toArray(result))
            };
            case (#labeled(key, subtree)) {
                // CBOR array with 3 (labeled), key, and subtree
                let encodedKey = cborEncodeBytes(key);
                let encodedSubtree = encodeHashTree(subtree);
                var result = Buffer.Buffer<Nat8>(10);
                result.add(0x83); // Array of 3 elements
                result.add(0x03); // 3 for labeled
                for (b in Blob.toArray(encodedKey).vals()) { result.add(b) };
                for (b in Blob.toArray(encodedSubtree).vals()) { result.add(b) };
                Blob.fromArray(Buffer.toArray(result))
            };
            case (#leaf(value)) {
                // CBOR array with 4 (leaf) and value
                let encodedValue = cborEncodeBytes(value);
                Blob.fromArray(Array.append([0x82 : Nat8, 0x04 : Nat8], Blob.toArray(encodedValue))) // Array of 2 elements
            };
        }
    };
    
    // Set certified data for root path
    private stable var certifiedRootData : Text = "spotquest-ready";
    
    // Calculate hash of tree for certification
    private func hashOfTree(tree: HashTree) : Blob {
        switch (tree) {
            case (#empty) {
                // Hash of domain separator "ic-hashtree-empty" with length prefix
                let prefixByte = Blob.fromArray([0x10]); // Length prefix: 16
                let labelText = Text.encodeUtf8("ic-hashtree-empty");
                let combined = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                sha256(combined)
            };
            case (#pruned(hash)) {
                hash // Already a hash
            };
            case (#fork(left, right)) {
                let leftHash = hashOfTree(left);
                let rightHash = hashOfTree(right);
                // Hash of domain separator "ic-hashtree-fork" + left hash + right hash
                let prefixByte = Blob.fromArray([0x10]); // Length prefix: 16
                let labelText = Text.encodeUtf8("ic-hashtree-fork");
                let prefixBlob = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                let combined = Buffer.Buffer<Nat8>(prefixBlob.size() + leftHash.size() + rightHash.size());
                for (b in Blob.toArray(prefixBlob).vals()) { combined.add(b) };
                for (b in Blob.toArray(leftHash).vals()) { combined.add(b) };
                for (b in Blob.toArray(rightHash).vals()) { combined.add(b) };
                sha256(Blob.fromArray(Buffer.toArray(combined)))
            };
            case (#labeled(key, subtree)) {
                let subtreeHash = hashOfTree(subtree);
                // Hash of domain separator "ic-hashtree-labeled" + key + subtree hash
                let prefixByte = Blob.fromArray([0x13]); // Length prefix: 19
                let labelText = Text.encodeUtf8("ic-hashtree-labeled");
                let prefixBlob = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                let combined = Buffer.Buffer<Nat8>(prefixBlob.size() + key.size() + subtreeHash.size());
                for (b in Blob.toArray(prefixBlob).vals()) { combined.add(b) };
                for (b in Blob.toArray(key).vals()) { combined.add(b) };
                for (b in Blob.toArray(subtreeHash).vals()) { combined.add(b) };
                sha256(Blob.fromArray(Buffer.toArray(combined)))
            };
            case (#leaf(value)) {
                // Hash of domain separator "ic-hashtree-leaf" + value
                let prefixByte = Blob.fromArray([0x10]); // Length prefix: 16
                let labelText = Text.encodeUtf8("ic-hashtree-leaf");
                let prefixBlob = Blob.fromArray(Array.append(Blob.toArray(prefixByte), Blob.toArray(labelText)));
                let combined = Buffer.Buffer<Nat8>(prefixBlob.size() + value.size());
                for (b in Blob.toArray(prefixBlob).vals()) { combined.add(b) };
                for (b in Blob.toArray(value).vals()) { combined.add(b) };
                sha256(Blob.fromArray(Buffer.toArray(combined)))
            };
        }
    };
    
    // Initialize certified data
    private func initCertifiedData() : () {
        // Hash the actual response body that will be served at root path
        let bodyBlob = Text.encodeUtf8(certifiedRootData);
        certifiedRootHash := sha256(bodyBlob);
        
        // Debug: Log the hash
        Debug.print("🔐 Certified data hash: " # debug_show(Blob.toArray(certifiedRootHash)));
        
        // Create the full 3-layer tree and calculate its root hash
        let tree : HashTree = #labeled(
            Text.encodeUtf8("http_assets"),
            #labeled(
                Text.encodeUtf8("/"),
                #leaf(certifiedRootHash)
            )
        );
        
        // Set the root hash of the tree as certified data
        let treeRootHash = hashOfTree(tree);
        Debug.print("🌳 Tree root hash: " # debug_show(Blob.toArray(treeRootHash)));
        CertifiedData.set(treeRootHash);
    };
    
    // Helper function to create JSON response
    private func jsonResponse(json: Text, statusCode: Nat16) : HttpResponse {
        {
            body = Text.encodeUtf8(json);
            headers = [
                ("Content-Type", "application/json"),
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                ("Access-Control-Allow-Headers", "Content-Type")
            ];
            status_code = statusCode;
        }
    };
    
    // Helper function to create HTML response
    private func htmlResponse(html: Text, statusCode: Nat16) : HttpResponse {
        {
            body = Text.encodeUtf8(html);
            headers = [
                ("Content-Type", "text/html; charset=utf-8"),
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                ("Access-Control-Allow-Headers", "Content-Type")
            ];
            status_code = statusCode;
        }
    };
    
    // Get request body as text
    private func getBodyText(body: Blob) : Text {
        switch (Text.decodeUtf8(body)) {
            case null { "" };
            case (?text) { text };
        }
    };
    
    public query func http_request(req: HttpRequest) : async HttpResponse {
        // Parse URL path - remove query parameters
        let fullPath = req.url;
        let path = switch (Text.split(fullPath, #char '?').next()) {
            case null { fullPath };
            case (?p) { p };
        };
        
        // Handle OPTIONS requests for CORS
        if (req.method == "OPTIONS") {
            return {
                body = Blob.fromArray([]);
                headers = [
                    ("Access-Control-Allow-Origin", "*"),
                    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                    ("Access-Control-Allow-Headers", "Content-Type")
                ];
                status_code = 204;
            };
        };
        
        // Handle root path "/" with certified response for Internet Identity
        if (path == "/" and (req.method == "GET" or req.method == "HEAD")) {
            let bodyBlob = Text.encodeUtf8(certifiedRootData);
            
            // Check if we have a certificate
            switch (CertifiedData.getCertificate()) {
                case null {
                    // No certificate available, return regular response
                    return {
                        body = bodyBlob;
                        headers = [
                            ("Content-Type", "text/plain"),
                            ("Access-Control-Allow-Origin", "*"),
                            ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                            ("Access-Control-Allow-Headers", "Content-Type")
                        ];
                        status_code = 200;
                    };
                };
                case (?cert) {
                    // Create 3-layer hash tree for the response
                    let tree : HashTree = #labeled(
                        Text.encodeUtf8("http_assets"),
                        #labeled(
                            Text.encodeUtf8("/"),
                            #leaf(certifiedRootHash)
                        )
                    );
                    let encodedTree = encodeHashTree(tree);
                    
                    // Return certified response with IC-Certificate header
                    return {
                        body = bodyBlob;
                        headers = [
                            ("Content-Type", "text/plain"),
                            ("IC-Certificate", 
                                "certificate=:" # base64UrlEncode(cert) # ":, " #
                                "tree=:" # base64UrlEncode(encodedTree) # ":"),
                            ("Access-Control-Allow-Origin", "*"),
                            ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
                            ("Access-Control-Allow-Headers", "Content-Type"),
                            ("Access-Control-Expose-Headers", "IC-Certificate")
                        ];
                        status_code = 200;
                    };
                };
            };
        };
        
        // Add debug endpoint
        if (path == "/debug/cert" and req.method == "GET") {
            // Create the tree for debugging
            let debugTree : HashTree = #labeled(
                Text.encodeUtf8("http_assets"),
                #labeled(
                    Text.encodeUtf8("/"),
                    #leaf(certifiedRootHash)
                )
            );
            let debugTreeRoot = hashOfTree(debugTree);
            
            return jsonResponse("{
                \"certifiedData\": \"" # certifiedRootData # "\",
                \"certifiedHash\": \"" # debug_show(Blob.toArray(certifiedRootHash)) # "\",
                \"treeRootHash\": \"" # debug_show(Blob.toArray(debugTreeRoot)) # "\",
                \"hasher\": \"SHA256\" 
            }", 200);
        };
        
        // Handle POST /api/session/new - Create new session
        if (req.method == "POST" and path == "/api/session/new") {
            let bodyText = getBodyText(req.body);
            
            // Debug: ALWAYS log when this endpoint is called
            // This will help us understand if expo-ii-integration is calling this endpoint
            
            // Parse JSON body to get public key and redirect URI
            var publicKey = "";
            var redirectUri = "";
            
            // Parse publicKey
            if (Text.contains(bodyText, #text "\"publicKey\"")) {
                let parts = Text.split(bodyText, #text "\"publicKey\"");
                switch (parts.next()) {
                    case null { };
                    case (?_) {
                        switch (parts.next()) {
                            case null { };
                            case (?part) {
                                let valueParts = Text.split(part, #text "\"");
                                switch (valueParts.next()) {
                                    case null { };
                                    case (?_) {
                                        switch (valueParts.next()) {
                                            case null { };
                                            case (?_) {
                                                switch (valueParts.next()) {
                                                    case null { };
                                                    case (?value) { publicKey := value; };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            
            // Parse redirectUri
            if (Text.contains(bodyText, #text "\"redirectUri\"")) {
                let parts = Text.split(bodyText, #text "\"redirectUri\"");
                switch (parts.next()) {
                    case null { };
                    case (?_) {
                        switch (parts.next()) {
                            case null { };
                            case (?part) {
                                let valueParts = Text.split(part, #text "\"");
                                switch (valueParts.next()) {
                                    case null { };
                                    case (?_) {
                                        switch (valueParts.next()) {
                                            case null { };
                                            case (?_) {
                                                switch (valueParts.next()) {
                                                    case null { };
                                                    case (?value) { redirectUri := value; };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            
            if (publicKey == "") {
                publicKey := "placeholder_public_key"; // Fallback
            };
            
            // Debug: Check what we received
            let debugResponse = "Debug - Received publicKey: " # publicKey # ", redirectUri: " # redirectUri # ", body: " # bodyText;
            
            // Temporary fallback for testing
            if (redirectUri == "") {
                redirectUri := "https://auth.expo.io/@hude/guess-the-spot/auth"; // Test fallback - matches app.json
            };
            
            // Get canister origin
            let canisterOrigin = "https://77fv5-oiaaa-aaaal-qsoea-cai.raw.icp0.io";
            
            // Create new session
            let response = iiIntegrationManager.newSession(publicKey, canisterOrigin);
            
            // Build callback URL with redirect-uri parameter (URL encoded)
            var callbackUrl = canisterOrigin # "/callback";
            if (redirectUri != "") {
                // URL encoding for redirect-uri parameter
                var encodedRedirectUri = redirectUri;
                encodedRedirectUri := Text.replace(encodedRedirectUri, #char ':', "%3A");
                encodedRedirectUri := Text.replace(encodedRedirectUri, #char '/', "%2F");
                encodedRedirectUri := Text.replace(encodedRedirectUri, #char '?', "%3F");
                encodedRedirectUri := Text.replace(encodedRedirectUri, #char '#', "%23");
                encodedRedirectUri := Text.replace(encodedRedirectUri, #char '&', "%26");
                encodedRedirectUri := Text.replace(encodedRedirectUri, #char '=', "%3D");
                encodedRedirectUri := Text.replace(encodedRedirectUri, #char '@', "%40");
                callbackUrl #= "?redirect-uri=" # encodedRedirectUri;
            };
            
            // Build authorize URL with our callback - simplified for debugging
            let authorizeUrl = "https://identity.ic0.app/#authorize?" #
                "client_id=" # canisterOrigin # "&" #
                "redirect_uri=" # callbackUrl # "&" #
                "state=" # response.sessionId # "&" #
                "response_type=id_token";
            
            let json = "{\"sessionId\":\"" # response.sessionId # "\",\"authorizeUrl\":\"" # authorizeUrl # "\"}";
            return jsonResponse(json, 200);
        };
        
        // Handle POST /api/session/:id/delegate - Save delegation
        if (req.method == "POST" and Text.startsWith(path, #text "/api/session/") and Text.endsWith(path, #text "/delegate")) {
            // Extract session ID
            let pathWithoutPrefix = switch (Text.stripStart(path, #text "/api/session/")) {
                case null { "" };
                case (?p) { p };
            };
            let sessionId = switch (Text.stripEnd(pathWithoutPrefix, #text "/delegate")) {
                case null { "" };
                case (?id) { id };
            };
            
            if (sessionId != "") {
                let bodyText = getBodyText(req.body);
                
                // Extract fields from JSON body - simple parsing
                var delegation = "";
                var userPublicKey = "";
                var delegationPubkey = "";
                
                // Parse delegation
                if (Text.contains(bodyText, #text "\"delegation\"")) {
                    let parts = Text.split(bodyText, #text "\"delegation\"");
                    switch (parts.next()) {
                        case null { };
                        case (?_) {
                            switch (parts.next()) {
                                case null { };
                                case (?part) {
                                    let valueParts = Text.split(part, #text "\"");
                                    switch (valueParts.next()) {
                                        case null { };
                                        case (?_) {
                                            switch (valueParts.next()) {
                                                case null { };
                                                case (?_) {
                                                    switch (valueParts.next()) {
                                                        case null { };
                                                        case (?value) { delegation := value; };
                                                    };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                
                // Parse userPublicKey
                if (Text.contains(bodyText, #text "\"userPublicKey\"")) {
                    let parts = Text.split(bodyText, #text "\"userPublicKey\"");
                    switch (parts.next()) {
                        case null { };
                        case (?_) {
                            switch (parts.next()) {
                                case null { };
                                case (?part) {
                                    let valueParts = Text.split(part, #text "\"");
                                    switch (valueParts.next()) {
                                        case null { };
                                        case (?_) {
                                            switch (valueParts.next()) {
                                                case null { };
                                                case (?_) {
                                                    switch (valueParts.next()) {
                                                        case null { };
                                                        case (?value) { userPublicKey := value; };
                                                    };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                
                // Parse delegationPubkey
                if (Text.contains(bodyText, #text "\"delegationPubkey\"")) {
                    let parts = Text.split(bodyText, #text "\"delegationPubkey\"");
                    switch (parts.next()) {
                        case null { };
                        case (?_) {
                            switch (parts.next()) {
                                case null { };
                                case (?part) {
                                    let valueParts = Text.split(part, #text "\"");
                                    switch (valueParts.next()) {
                                        case null { };
                                        case (?_) {
                                            switch (valueParts.next()) {
                                                case null { };
                                                case (?_) {
                                                    switch (valueParts.next()) {
                                                        case null { };
                                                        case (?value) { delegationPubkey := value; };
                                                    };
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                
                let response = iiIntegrationManager.saveDelegate(sessionId, delegation, userPublicKey, delegationPubkey);
                let json = if (response.success) {
                    "{\"success\":true}"
                } else {
                    switch (response.error) {
                        case null { "{\"success\":false,\"error\":\"Unknown error\"}" };
                        case (?err) { "{\"success\":false,\"error\":\"" # err # "\"}" };
                    }
                };
                return jsonResponse(json, if (response.success) { 200 } else { 400 });
            };
        };
        
        // Handle POST /api/session/:id/close - Close session
        if (req.method == "POST" and Text.startsWith(path, #text "/api/session/") and Text.endsWith(path, #text "/close")) {
            // Extract session ID
            let pathWithoutPrefix = switch (Text.stripStart(path, #text "/api/session/")) {
                case null { "" };
                case (?p) { p };
            };
            let sessionId = switch (Text.stripEnd(pathWithoutPrefix, #text "/close")) {
                case null { "" };
                case (?id) { id };
            };
            
            if (sessionId != "") {
                let success = iiIntegrationManager.closeSession(sessionId);
                let json = "{\"success\":" # (if (success) { "true" } else { "false" }) # "}";
                return jsonResponse(json, if (success) { 200 } else { 400 });
            };
        };
        
        // Handle GET /callback - II callback page
        if (req.method == "GET" and path == "/callback") {
            // Callback page that handles II response and redirects to Expo
            let html = "<!DOCTYPE html>" #
                      "<html>" #
                      "<head>" #
                      "<title>Authentication Callback</title>" #
                      "<meta charset='utf-8'>" #
                      "<meta name='viewport' content='width=device-width, initial-scale=1'>" #
                      "</head>" #
                      "<body>" #
                      "<h2>Authentication Complete</h2>" #
                      "<p>Redirecting back to app...</p>" #
                      "<script>" #
                      "(async function() {" #
                      "  console.log('Callback page loaded');" #
                      "  console.log('Full URL:', window.location.href);" #
                      "  console.log('Hash:', window.location.hash);" #
                      "  console.log('Search:', window.location.search);" #
                      "  " #
                      "  const params = new URLSearchParams(window.location.search);" #
                      "  const fragment = new URLSearchParams(window.location.hash.slice(1));" #
                      "  " #
                      "  // Debug" #
                      "  console.log('URL:', window.location.href);" #
                      "  " #
                      "  // Get data from II response" #
                      "  const idToken = fragment.get('id_token') || params.get('id_token');" #
                      "  const delegation = fragment.get('delegation') || params.get('delegation');" #
                      "  const publicKey = fragment.get('publicKey') || fragment.get('public_key') || params.get('publicKey');" #
                      "  const userPublicKey = fragment.get('userPublicKey') || fragment.get('user_public_key') || params.get('userPublicKey');" #
                      "  const state = fragment.get('state') || params.get('state');" #
                      "  const error = fragment.get('error') || params.get('error');" #
                      "  " #
                      "  if (error) {" #
                      "    document.body.innerHTML = '<h2>Authentication Error</h2><p>' + error + '</p>';" #
                      "    return;" #
                      "  }" #
                      "  " #
                      "  // Check if we have required data" #
                      "  if (!state) {" #
                      "    document.body.innerHTML = '<h2>Missing state parameter</h2>';" #
                      "    return;" #
                      "  }" #
                      "  " #
                      "  // Parse id_token if we have it" #
                      "  let parsedDelegation = delegation;" #
                      "  let parsedUserPublicKey = userPublicKey || publicKey;" #
                      "  let parsedDelegationPubkey = '';" #
                      "  " #
                      "  if (idToken && !delegation) {" #
                      "    console.log('Parsing id_token:', idToken);" #
                      "    try {" #
                      "      // II returns a JWT id_token that contains the delegation" #
                      "      // For now, we'll use the id_token as the delegation" #
                      "      parsedDelegation = idToken;" #
                      "      " #
                      "      // Try to decode the JWT to get more info" #
                      "      const parts = idToken.split('.');" #
                      "      if (parts.length === 3) {" #
                      "        // Decode the payload (base64url)" #
                      "        const payload = parts[1];" #
                      "        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));" #
                      "        const jwtData = JSON.parse(decoded);" #
                      "        console.log('JWT payload:', jwtData);" #
                      "        " #
                      "        // Extract delegation data from JWT if available" #
                      "        if (jwtData.delegations && jwtData.delegations.length > 0) {" #
                      "          const del = jwtData.delegations[0];" #
                      "          parsedDelegation = JSON.stringify(del.delegation || del);" #
                      "          parsedUserPublicKey = del.pubkey || jwtData.sub || parsedUserPublicKey;" #
                      "        }" #
                      "      }" #
                      "    } catch (e) {" #
                      "      console.error('Failed to parse id_token:', e);" #
                      "      // Use the raw id_token as delegation" #
                      "      parsedDelegation = idToken;" #
                      "    }" #
                      "  }" #
                      "  " #
                      "  // Save delegation data if we have any" #
                      "  if (parsedDelegation || parsedUserPublicKey) {" #
                      "    try {" #
                      "      const payload = {" #
                      "        delegation: parsedDelegation || ''," #
                      "        userPublicKey: parsedUserPublicKey || ''," #
                      "        delegationPubkey: parsedDelegationPubkey || ''" #
                      "      };" #
                      "      " #
                      "      console.log('Saving delegation payload:', payload);" #
                      "      " #
                      "      const response = await fetch('/api/session/' + state + '/delegate', {" #
                      "        method: 'POST'," #
                      "        headers: { 'Content-Type': 'application/json' }," #
                      "        body: JSON.stringify(payload)" #
                      "      });" #
                      "      const data = await response.json();" #
                      "      console.log('Delegation saved:', data);" #
                      "      " #
                      "      if (data.success) {" #
                      "        // Debug" #
                      "        console.log('Auth saved, redirecting...');" #
                      "        " #
                      "        // Close the session to mark it as ready" #
                      "        await fetch('/api/session/' + state + '/close', {" #
                      "          method: 'POST'" #
                      "        });" #
                      "        " #
                      "        // Get redirect URI from query params (sent by canister)" #
                      "        const urlParams = new URLSearchParams(window.location.search);" #
                      "        const redirectUri = urlParams.get('redirect-uri');" #
                      "        " #
                      "        if (redirectUri) {" #
                      "          // AuthSession needs exact match with its redirectUri" #
                      "          console.log('Redirecting to AuthSession URI:', redirectUri);" #
                      "          document.body.innerHTML = '<p>Redirecting...</p>';" #
                      "          " #
                      "          // Simple redirect" #
                      "          setTimeout(() => {" #
                      "            window.location.replace(redirectUri);" #
                      "          }, 500);" #
                      "        } else {" #
                      "          console.error('No redirect URI found');" #
                      "          document.body.innerHTML = '<h2>Auth Complete</h2><p>Close this window.</p>';" #
                      "        }" #
                      "      } else {" #
                      "        document.body.innerHTML = '<h2>Auth Failed</h2><p>' + (data.error || 'Unknown error') + '</p>';" #
                      "      }" #
                      "    } catch (err) {" #
                      "      console.error('Failed to save delegation:', err);" #
                      "      document.body.innerHTML = '<h2>Error</h2><p>' + err.message + '</p>';" #
                      "    }" #
                      "  } else {" #
                      "    document.body.innerHTML = '<h2>No auth data</h2><p>Check console.</p>';" #
                      "  }" #
                      "})();" #
                      "</script>" #
                      "</body>" #
                      "</html>";
            
            return htmlResponse(html, 200);
        };
        
        // Handle GET /api/session/:id - Get delegation for closed session
        if (req.method == "GET" and Text.startsWith(path, #text "/api/session/")) {
            // Extract session ID from path
            let sessionId = switch (Text.stripStart(path, #text "/api/session/")) {
                case null { "" };
                case (?id) { id };
            };
            
            if (sessionId != "") {
                // Debug: Log all sessions
                let debugSessions = iiIntegrationManager.getAllSessionIds();
                let debugJson = "{\"requestedSession\":\"" # sessionId # "\",\"availableSessions\":" # Nat.toText(debugSessions.size()) # "}";
                
                // Check if this is a polling request (session still open)
                switch (iiIntegrationManager.getSessionStatus(sessionId)) {
                    case null {
                        return jsonResponse(debugJson, 404);
                    };
                    case (?session) {
                        // If session is still open or has delegation but not closed, return pending
                        if (session.status != #Closed) {
                            return jsonResponse("{\"status\":\"pending\"}", 200);
                        };
                        
                        // Session is closed, return delegation data
                        switch (iiIntegrationManager.getDelegation(sessionId)) {
                            case null {
                                return jsonResponse("{\"error\":\"Delegation not found\"}", 404);
                            };
                            case (?data) {
                                // Return the delegation data in the format expo-ii-integration expects
                                let json = "{\"status\":\"success\"," #
                                          "\"delegation\":\"" # data.delegation # "\"," #
                                          "\"userPublicKey\":\"" # data.userPublicKey # "\"," #
                                          "\"delegationPubkey\":\"" # data.delegationPubkey # "\"}";
                                return jsonResponse(json, 200);
                            };
                        };
                    };
                };
            };
        };
        
        // Handle GET / - Check session-id parameter and redirect appropriately
        if (req.method == "GET" and (path == "/" or path == "")) {
            // Parse query parameters
            let urlParts = Text.split(fullPath, #text "?");
            var publicKey = "";
            var sessionId = "";
            var deepLinkType = "";
            var fullQueryString = "";
            
            switch (urlParts.next()) {
                case null { };
                case (?_) {
                    switch (urlParts.next()) {
                        case null { };
                        case (?queryString) {
                            fullQueryString := queryString;
                            let params = Text.split(queryString, #text "&");
                            
                            for (param in params) {
                                let parts = Text.split(param, #text "=");
                                switch (parts.next()) {
                                    case null { };
                                    case (?key) {
                                        switch (parts.next()) {
                                            case null { };
                                            case (?value) {
                                                if (key == "pubkey") {
                                                    publicKey := value;
                                                } else if (key == "session-id") {
                                                    sessionId := value;
                                                } else if (key == "deep-link-type") {
                                                    deepLinkType := value;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
            
            // If publicKey exists, this is the initial request - redirect to II
            if (publicKey != "") {
                // Create a new session synchronously
                let canisterOrigin = "https://77fv5-oiaaa-aaaal-qsoea-cai.raw.icp0.io";
                let response = iiIntegrationManager.newSession(publicKey, canisterOrigin);
                
                // Build callback URL with redirect-uri from original query if present
                var callbackUrl = canisterOrigin # "/callback";
                
                // Extract redirect-uri parameter from original query
                var hasRedirectUri = false;
                if (Text.contains(fullQueryString, #text "redirect-uri=")) {
                    let parts = Text.split(fullQueryString, #text "&");
                    for (part in parts) {
                        if (Text.startsWith(part, #text "redirect-uri=")) {
                            callbackUrl #= "?" # part;
                            hasRedirectUri := true;
                        };
                    };
                };
                
                // If no redirect-uri was provided, use default for Expo Go
                if (not hasRedirectUri) {
                    // Check if this is from a mobile deep link type (likely Expo Go)
                    if (Text.contains(fullQueryString, #text "deep-link-type=expo-go") or 
                        Text.contains(fullQueryString, #text "deep-link-type=legacy") or
                        Text.contains(fullQueryString, #text "deep-link-type=modern")) {
                        // Use Expo Auth Session proxy URL for mobile
                        let defaultRedirectUri = "https://auth.expo.io/@hude/guess-the-spot/auth";
                        var encodedRedirectUri = defaultRedirectUri;
                        encodedRedirectUri := Text.replace(encodedRedirectUri, #char ':', "%3A");
                        encodedRedirectUri := Text.replace(encodedRedirectUri, #char '/', "%2F");
                        encodedRedirectUri := Text.replace(encodedRedirectUri, #char '@', "%40");
                        callbackUrl #= "?redirect-uri=" # encodedRedirectUri;
                    };
                };
                
                // Build authorize URL for II
                let authorizeUrl = "https://identity.ic0.app/#authorize?" #
                    "client_id=" # canisterOrigin # "&" #
                    "redirect_uri=" # callbackUrl # "&" #
                    "state=" # response.sessionId # "&" #
                    "response_type=id_token&" #
                    "scope=openid&" #
                    "nonce=" # response.sessionId;
                
                // Redirect to II immediately
                let redirectHtml = "<!DOCTYPE html>" #
                          "<html>" #
                          "<head>" #
                          "<title>Redirecting...</title>" #
                          "<meta charset='utf-8'>" #
                          "<script>" #
                          "window.location.href = '" # authorizeUrl # "';" #
                          "</script>" #
                          "</head>" #
                          "<body>" #
                          "<h2>Redirecting to Internet Identity...</h2>" #
                          "</body>" #
                          "</html>";
                
                return htmlResponse(redirectHtml, 200);
            };
            
            // Default response if no parameters - return JSON for expo-ii-integration
            return jsonResponse("{\"status\":\"ready\",\"canisterId\":\"77fv5-oiaaa-aaaal-qsoea-cai\"}", 200);
        };
        
        // Default response - return JSON for compatibility
        jsonResponse("{\"error\":\"Not Found\",\"path\":\"" # path # "\"}", 404)
    };
    
    public func http_request_update(req: HttpRequest) : async HttpResponse {
        // All HTTP requests are now handled in http_request for compatibility with raw URLs
        await http_request(req)
    };
    
    // ======================================
    // UPGRADE HOOKS
    // ======================================
    system func preupgrade() {
        tokenStable := ?tokenManager.toStable();
        treasuryStable := ?treasuryManager.toStable();
        let engineData = gameEngineManager.toStable();
        gameEngineStable := ?{
            sessionsStable = engineData.sessionsStable;
            userSessionsStable = engineData.userSessionsStable;
            sessionTimeoutsStable = engineData.sessionTimeoutsStable;
            totalSessions = engineData.totalSessions;
            totalRounds = engineData.totalRounds;
            errorCount = engineData.errorCount;
            totalRequests = engineData.totalRequests;
        };
        gameEngineExtended := ?{
            sessionPhotosPlayedStable = engineData.sessionPhotosPlayedStable;
        };
        guessHistoryStable := ?guessHistoryManager.toStable();
        // photoStable := ?photoManager.toStable(); // Legacy photo system no longer used
        // PhotoV2データの保存 - データ保護のため復活
        let v2Data = photoManagerV2.toStable();
        photoV2Stable := ?{
            photos = v2Data.photos;
            photoChunks = v2Data.photoChunks;
            nextPhotoId = v2Data.nextPhotoId;
            totalPhotos = v2Data.totalPhotos;
            totalStorageSize = v2Data.totalStorageSize;
        };
        photoStatsStable := ?photoManagerV2.getPhotoStatsEntries();
        
        // StableTrieMapのpreupgrade処理
        photoManagerV2.prepareUpgrade();
        reputationStable := ?reputationManager.toStable();
        iiIntegrationStable := ?iiIntegrationManager.preupgrade();
        
        // Save usernames
        userProfileStable := ?{
            usernames = Iter.toArray(usernames.entries());
        };
        
        // Save rating data
        ratingStable := ?ratingManager.getStableData();
        
        // Save Elo rating data
        eloRatingStable := ?eloRatingManager.getStableData();
        
        // Save player stats data
        playerStatsStable := ?playerStatsManager.getAllStats();
        
        // Save game limits data to V2 format
        gameLimitsStableV2 := ?gameLimitsManager.toStable();
        // Clear old format
        gameLimitsStable := null;
    };
    
    system func postupgrade() {
        // Restore token manager
        switch(tokenStable) {
            case null { };
            case (?stableData) {
                tokenManager.fromStable(stableData);
                tokenStable := null;
            };
        };
        
        // Restore treasury manager
        switch(treasuryStable) {
            case null { };
            case (?stableData) {
                treasuryManager.fromStable(stableData);
                treasuryStable := null;
            };
        };
        
        // Restore game engine manager
        switch(gameEngineStable) {
            case null { };
            case (?stableData) {
                // Get photos played data if available
                let photosPlayedData = switch(gameEngineExtended) {
                    case null { null };
                    case (?extended) { ?extended.sessionPhotosPlayedStable };
                };
                
                // Combine the data
                let fullData = {
                    sessionsStable = stableData.sessionsStable;
                    userSessionsStable = stableData.userSessionsStable;
                    sessionTimeoutsStable = stableData.sessionTimeoutsStable;
                    sessionPhotosPlayedStable = photosPlayedData;
                    sessionCompletionIndexStable = null; // New field for completion index
                    totalSessions = stableData.totalSessions;
                    totalRounds = stableData.totalRounds;
                    errorCount = stableData.errorCount;
                    totalRequests = stableData.totalRequests;
                };
                
                gameEngineManager.fromStable(fullData);
                gameEngineStable := null;
                gameEngineExtended := null;
            };
        };
        
        // Restore guess history manager
        switch(guessHistoryStable) {
            case null { };
            case (?stableData) {
                guessHistoryManager.fromStable(stableData);
                guessHistoryStable := null;
            };
        };
        
        
        // Restore reputation manager
        switch(reputationStable) {
            case null { };
            case (?stableData) {
                reputationManager.fromStable(stableData);
                reputationStable := null;
            };
        };
        
        // Restore II Integration manager
        switch(iiIntegrationStable) {
            case null { };
            case (?entries) {
                iiIntegrationManager.postupgrade(entries);
                iiIntegrationStable := null;
            };
        };
        
        // PhotoV2データの復元 - データ保護のため復活
        switch(photoV2Stable) {
            case null { };
            case (?stableData) {
                photoManagerV2.fromStable(stableData);
                photoV2Stable := null;
            };
        };
        
        // Restore photo statistics
        switch(photoStatsStable) {
            case null { };
            case (?statsData) {
                photoManagerV2.restorePhotoStats(statsData);
                photoStatsStable := null;
            };
        };
        
        // StableTrieMapのpostupgrade処理
        // NOTE: Commented out because data is already restored via fromStable() and restorePhotoStats()
        // Calling this would overwrite the stats with empty data
        // photoManagerV2.restoreFromUpgrade();
        
        // Restore usernames
        switch(userProfileStable) {
            case null { };
            case (?profileData) {
                for ((principal, username) in profileData.usernames.vals()) {
                    usernames.put(principal, username);
                };
                userProfileStable := null;
            };
        };
        
        // Restore rating data
        switch(ratingStable) {
            case null { };
            case (?ratingData) {
                ratingManager.loadFromStable(
                    ratingData.ratings,
                    ratingData.aggregated,
                    ratingData.limits,
                    ratingData.distributions
                );
                ratingStable := null;
            };
        };
        
        // Restore Elo rating data
        switch(eloRatingStable) {
            case null { };
            case (?eloData) {
                eloRatingManager.loadFromStable(
                    eloData.playerRatings,
                    eloData.photoRatings,
                    eloData.ratingHistory
                );
                eloRatingStable := null;
            };
        };
        
        // Restore player stats data
        switch(playerStatsStable) {
            case null { };
            case (?statsData) {
                playerStatsManager.restoreStats(statsData);
                playerStatsStable := null;
            };
        };
        
        // Restore game limits data - check V2 first, then fallback to V1
        switch(gameLimitsStableV2) {
            case null { 
                // Try old format
                switch(gameLimitsStable) {
                    case null { };
                    case (?oldData) {
                        // Migrate from old format
                        let migratedData = {
                            dailyPlayCountsStable = oldData.dailyPlayCountsStable;
                            proMembershipExpiryStable = null : ?[(Principal, Time.Time)];
                            lastResetTime = oldData.lastResetTime;
                        };
                        gameLimitsManager.fromStable(migratedData);
                        gameLimitsStable := null;
                    };
                };
            };
            case (?v2Data) {
                gameLimitsManager.fromStable(v2Data);
                gameLimitsStableV2 := null;
            };
        };
        
        // Restart cleanup timer if initialized
        if (initialized) {
            cleanupTimer := ?Timer.recurringTimer<system>(#seconds(60), cleanupExpiredSessions);
        };
        
        // Update certified data for testing
        certifiedRootData := "spotquest-ready";
        
        // Initialize certified data for HTTP responses
        initCertifiedData();
    };
}