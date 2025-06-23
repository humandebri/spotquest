import HashMap "mo:base/HashMap";
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
import PhotoModule "modules/PhotoModule";
import PhotoModuleV2 "modules/PhotoModuleV2";
import ReputationModule "modules/ReputationModule";
import IIIntegrationModule "modules/IIIntegrationModule";

// HTTP types
import Blob "mo:base/Blob";
import Map "mo:base/HashMap";

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
    private stable var owner : Principal = Principal.fromText("aaaaa-aa");
    private stable var initialized : Bool = false;
    
    // ======================================
    // MODULE INSTANCES
    // ======================================
    private var tokenManager = TokenModule.TokenManager();
    private var treasuryManager = TreasuryModule.TreasuryManager();
    private var gameEngineManager = GameEngineModule.GameEngineManager();
    private var guessHistoryManager = GuessHistoryModule.GuessHistoryManager();
    private var photoManager = PhotoModule.PhotoManager();
    private var photoManagerV2 = PhotoModuleV2.PhotoManager(); // 新しい写真管理システム
    private var reputationManager = ReputationModule.ReputationManager();
    private var iiIntegrationManager = IIIntegrationModule.IIIntegrationManager();
    
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
    
    private stable var guessHistoryStable : ?{
        totalGuesses: Nat;
        guessRecordsStable: [(Nat, [GuessHistoryModule.Guess])];
        playerHistoryStable: [(Principal, [Nat])];
        photoQualityScoresStable: [(Nat, Float)];
    } = null;
    
    private stable var photoStable : ?{
        photos: [(Nat, PhotoModule.Photo)];
        nextPhotoId: Nat;
        scheduledPhotos: [(Principal, [Photo.ScheduledPhoto])];
        ownerPhotos: [(Principal, [Nat])];
        photoUsageCount: [(Nat, Nat)];
        totalPhotos: Nat;
        bannedPhotos: [(Nat, Time.Time)];
    } = null;
    
    private stable var reputationStable : ?{
        reputations: [(Principal, ReputationModule.Reputation)];
        referrals: [(Principal, [ReputationModule.Referral])];
        referralCodes: [(Text, Principal)];
        userReferralCodes: [(Principal, Text)];
        bannedUsers: [(Principal, Time.Time)];
    } = null;
    
    private stable var iiIntegrationStable : ?[(Text, IIIntegrationModule.SessionData)] = null;
    
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
        cleanupTimer := ?Timer.recurringTimer(#seconds(60), cleanupExpiredSessions);
        
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

    // ======================================
    // GAME ENGINE FUNCTIONS
    // ======================================
    public shared(msg) func createSession() : async Result.Result<GameV2.SessionId, Text> {
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        gameEngineManager.createSession(msg.caller)
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
                            
                            tempSummaries.add({
                                id = session.id;
                                status = status;
                                createdAt = session.startTime;
                                roundCount = session.rounds.size();
                                currentRound = if (session.currentRound > 0) { ?session.currentRound } else { null };
                                totalScore = session.totalScore;
                                duration = duration;
                            });
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
                        // Get photos from region excluding already used ones
                        getRegionPhotoExcluding(region, Buffer.toArray(usedPhotoIds))
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
                                
                                // Update photo quality score
                                let qualityScore = guessHistoryManager.getPhotoQualityScore(currentRound.photoId);
                                ignore photoManager.updatePhotoQualityScore(currentRound.photoId, qualityScore);
                                
                                // Update photo statistics (V2) - track game usage and average score
                                ignore photoManagerV2.updatePhotoStats(currentRound.photoId, roundState.score);
                                
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
                
                // Check auto-burn
                let totalSupply = tokenManager.getTotalSupply();
                if (treasuryManager.shouldAutoBurn(totalSupply)) {
                    let burnAmount = treasuryManager.executeAutoBurn(totalSupply);
                    if (burnAmount > 0) {
                        tokenManager.setTotalSupply(totalSupply - burnAmount);
                    };
                };
                
                // Calculate completed rounds
                let completedRounds = Array.filter<GameV2.RoundState>(
                    session.rounds,
                    func(r) = r.status == #Completed
                ).size();
                
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
                #ok()
            };
        }
    };
    
    /// 写真を検索
    public query func searchPhotosV2(filter: Photo.SearchFilter, cursor: ?Nat, limit: Nat) : async Photo.SearchResult {
        photoManagerV2.search(filter, cursor, Nat.min(limit, 100)) // 最大100件に制限
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
                    qualityScore = photo.qualityScore;
                    timesUsed = photo.timesUsed;
                    lastUsedTime = photo.lastUsedTime;
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
        
        let result = photoManagerV2.search(filter, cursor, Nat.min(limit, 100));
        Debug.print("📸 getUserPhotosV2 found " # Nat.toText(result.photos.size()) # " photos for user " # Principal.toText(msg.caller));
        
        result
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
        photoManager.banPhoto(photoId)
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
        suspiciousActivityFlags: ?Text;
    } {
        // Get user sessions
        let userSessionBuffer = switch(gameEngineManager.getUserSessions(player)) {
            case null { [] };
            case (?buffer) { buffer };
        };
        
        // Debug logging
        Debug.print("📊 getPlayerStats for " # Principal.toText(player) # " - Found " # Nat.toText(userSessionBuffer.size()) # " sessions");
        
        var totalGamesPlayed = 0;
        var totalScore : Nat = 0;
        var bestScore : Nat = 0;
        var completedGames = 0;
        var totalRewardsEarned : Nat = 0;
        
        // Calculate 30-day cutoff time
        let thirtyDaysAgo = Time.now() - (30 * 24 * 60 * 60 * 1000_000_000); // 30 days in nanoseconds
        var totalScore30Days : Nat = 0;
        var totalGamesPlayed30Days : Nat = 0;
        
        // Calculate stats from completed sessions
        for (sessionId in userSessionBuffer.vals()) {
            Debug.print("📊 Checking session: " # sessionId);
            switch(gameEngineManager.getSession(sessionId)) {
                case null { 
                    Debug.print("📊 Session not found: " # sessionId);
                };
                case (?session) {
                    Debug.print("📊 Session " # sessionId # " - endTime: " # 
                        (switch(session.endTime) {
                            case null { "null (active)" };
                            case (?endTime) { "completed at " # Int.toText(endTime) };
                        }) # ", rounds: " # Nat.toText(session.rounds.size()));
                    
                    if (session.endTime != null) {
                        totalGamesPlayed += 1;
                        totalScore += session.totalScore;
                        
                        // Check if session is within 30 days
                        let sessionTime = session.startTime;
                        if (sessionTime >= thirtyDaysAgo) {
                            totalGamesPlayed30Days += 1;
                            totalScore30Days += session.totalScore;
                        };
                        
                        // Check if all rounds completed
                        let completedRounds = Array.filter<GameV2.RoundState>(
                            session.rounds,
                            func(r) = r.status == #Completed
                        ).size();
                        
                        if (completedRounds == session.rounds.size() and completedRounds > 0) {
                            completedGames += 1;
                        };
                        
                        // Track best score
                        if (session.totalScore > bestScore) {
                            bestScore := session.totalScore;
                        };
                        
                        // Calculate rewards (simplified)
                        totalRewardsEarned += calculatePlayerReward(session);
                    };
                };
            };
        };
        
        // Calculate averages
        let averageScore = if (totalGamesPlayed > 0) {
            totalScore / totalGamesPlayed
        } else { 0 };
        
        let averageScore30Days = if (totalGamesPlayed30Days > 0) {
            totalScore30Days / totalGamesPlayed30Days
        } else { 0 };
        
        // Calculate player rank inline (can't await in query)
        var playerScores : [(Principal, Nat)] = [];
        for ((p, sessionIds) in gameEngineManager.getPlayerSessionsMap().vals()) {
            var pBestScore : Nat = 0;
            for (sessionId in sessionIds.vals()) {
                switch(gameEngineManager.getSession(sessionId)) {
                    case null { };
                    case (?session) {
                        if (session.endTime != null and session.totalScore > pBestScore) {
                            pBestScore := session.totalScore;
                        };
                    };
                };
            };
            if (pBestScore > 0) {
                playerScores := Array.append(playerScores, [(p, pBestScore)]);
            };
        };
        
        // Sort by best score (descending)
        let sortedScores = Array.sort(playerScores, func(a: (Principal, Nat), b: (Principal, Nat)) : {#less; #equal; #greater} {
            if (a.1 > b.1) { #less }
            else if (a.1 < b.1) { #greater }
            else { #equal }
        });
        
        // Find player's rank
        var playerRank : ?Nat = null;
        var rank : Nat = 1;
        for ((p, score) in sortedScores.vals()) {
            if (Principal.equal(p, player)) {
                playerRank := ?rank;
            };
            rank += 1;
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
        let winRate = if (totalGamesPlayed > 0) {
            Float.fromInt(completedGames) / Float.fromInt(totalGamesPlayed)
        } else { 0.0 };
        
        // Check for suspicious activity
        let suspiciousFlags = detectSuspiciousActivity(player, "");
        
        {
            totalGamesPlayed = totalGamesPlayed;
            totalPhotosUploaded = totalPhotosUploaded;
            totalRewardsEarned = totalRewardsEarned;
            bestScore = bestScore;
            averageScore = averageScore;
            averageScore30Days = if (totalGamesPlayed30Days > 0) { ?averageScore30Days } else { null };
            rank = playerRank;
            currentStreak = 0; // TODO: Implement streak tracking
            longestStreak = 0; // TODO: Implement streak tracking
            reputation = reputation;
            totalGuesses = totalGuesses;
            winRate = winRate;
            suspiciousActivityFlags = suspiciousFlags;
        }
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
        // Get all players with their best scores
        var playerScores : [(Principal, Nat)] = [];
        
        for ((p, sessionIds) in gameEngineManager.getPlayerSessionsMap().vals()) {
            var bestScore : Nat = 0;
            for (sessionId in sessionIds.vals()) {
                switch(gameEngineManager.getSession(sessionId)) {
                    case null { };
                    case (?session) {
                        if (session.endTime != null and session.totalScore > bestScore) {
                            bestScore := session.totalScore;
                        };
                    };
                };
            };
            if (bestScore > 0) {
                playerScores := Array.append(playerScores, [(p, bestScore)]);
            };
        };
        
        // Sort by best score (descending)
        let sortedScores = Array.sort(playerScores, func(a: (Principal, Nat), b: (Principal, Nat)) : {#less; #equal; #greater} {
            if (a.1 > b.1) { #less }
            else if (a.1 < b.1) { #greater }
            else { #equal }
        });
        
        // Find player's rank
        var rank : Nat = 1;
        for ((p, score) in sortedScores.vals()) {
            if (Principal.equal(p, player)) {
                return ?rank;
            };
            rank += 1;
        };
        
        null // Player not found in rankings
    };
    
    public query func getLeaderboard(limit: Nat) : async [(Principal, Nat)] {
        // Get all players with their best scores
        var playerScores : [(Principal, Nat)] = [];
        
        for ((p, sessionIds) in gameEngineManager.getPlayerSessionsMap().vals()) {
            var bestScore : Nat = 0;
            for (sessionId in sessionIds.vals()) {
                switch(gameEngineManager.getSession(sessionId)) {
                    case null { };
                    case (?session) {
                        if (session.endTime != null and session.totalScore > bestScore) {
                            bestScore := session.totalScore;
                        };
                    };
                };
            };
            if (bestScore > 0) {
                playerScores := Array.append(playerScores, [(p, bestScore)]);
            };
        };
        
        // Sort by best score (descending)
        let sortedScores = Array.sort(playerScores, func(a: (Principal, Nat), b: (Principal, Nat)) : {#less; #equal; #greater} {
            if (a.1 > b.1) { #less }
            else if (a.1 < b.1) { #greater }
            else { #equal }
        });
        
        // Return top N players
        let actualLimit = Nat.min(limit, sortedScores.size());
        Array.tabulate<(Principal, Nat)>(actualLimit, func(i) = sortedScores[i])
    };
    
    // Get leaderboard with detailed player statistics
    public query func getLeaderboardWithStats(limit: Nat) : async [(Principal, {
        score: Nat;
        gamesPlayed: Nat;
        photosUploaded: Nat;
        totalRewards: Nat;
        username: ?Text;
    })] {
        // Get all players with their stats
        var playerStats : [(Principal, { score: Nat; gamesPlayed: Nat; photosUploaded: Nat; totalRewards: Nat; username: ?Text })] = [];
        
        for ((p, sessionIds) in gameEngineManager.getPlayerSessionsMap().vals()) {
            var bestScore : Nat = 0;
            var gamesPlayed : Nat = 0;
            var totalRewards : Nat = 0;
            
            for (sessionId in sessionIds.vals()) {
                switch(gameEngineManager.getSession(sessionId)) {
                    case null { };
                    case (?session) {
                        if (session.endTime != null) {
                            gamesPlayed += 1;
                            if (session.totalScore > bestScore) {
                                bestScore := session.totalScore;
                            };
                            // Calculate rewards for this session
                            totalRewards += calculatePlayerReward(session);
                        };
                    };
                };
            };
            
            if (bestScore > 0) {
                // Get photos uploaded count
                let userPhotoFilter : Photo.SearchFilter = {
                    country = null;
                    region = null;
                    sceneKind = null;
                    tags = null;
                    nearLocation = null;
                    owner = ?p;
                    difficulty = null;
                    status = ?#Active;
                };
                let userPhotosResult = photoManagerV2.search(userPhotoFilter, null, 1000);
                let photosUploaded = userPhotosResult.totalCount;
                
                playerStats := Array.append(playerStats, [(p, {
                    score = bestScore;
                    gamesPlayed = gamesPlayed;
                    photosUploaded = photosUploaded;
                    totalRewards = totalRewards;
                    username = usernames.get(p);
                })]);
            };
        };
        
        // Sort by best score (descending)
        let sortedStats = Array.sort(playerStats, 
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
        let photoStats = photoManager.getPhotoStats();
        let gameMetrics = gameEngineManager.getMetrics();
        
        {
            totalUsers = reputationManager.getLeaderboard(10000).size();
            totalPhotos = photoStats.totalPhotos;
            totalGuesses = guessHistoryManager.getTotalGuesses();
            totalSessions = gameMetrics.totalSessions;
            totalSupply = tokenManager.icrc1_total_supply();
            photoStats = photoStats;
            gameMetrics = gameMetrics;
        }
    };
    
    // ======================================
    // DEBUG FUNCTIONS (temporary)
    // ======================================
    
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
        
        if (rounds == 0) {
            return 0;
        };
        
        var totalReward : Nat = 0;
        
        for (round in session.rounds.vals()) {
            // Each round can earn max 1.0 SPOT (100 units) based on score
            // Formula: (score / 5000) * 100 units
            let roundReward = (round.score * 100) / 5000; // Integer division
            totalReward += roundReward;
        };
        
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
        gameEngineStable := ?gameEngineManager.toStable();
        guessHistoryStable := ?guessHistoryManager.toStable();
        photoStable := ?photoManager.toStable();
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
                gameEngineManager.fromStable(stableData);
                gameEngineStable := null;
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
        
        // Restore photo manager
        switch(photoStable) {
            case null { };
            case (?stableData) {
                photoManager.fromStable(stableData);
                photoStable := null;
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
        photoManagerV2.restoreFromUpgrade();
        
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
        
        // Restart cleanup timer if initialized
        if (initialized) {
            cleanupTimer := ?Timer.recurringTimer(#seconds(60), cleanupExpiredSessions);
        };
    };
}