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
    private var reputationManager = ReputationModule.ReputationManager();
    private var iiIntegrationManager = IIIntegrationModule.IIIntegrationManager();
    
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
    // GAME ENGINE FUNCTIONS
    // ======================================
    public shared(msg) func createSession() : async Result.Result<GameV2.SessionId, Text> {
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        gameEngineManager.createSession(msg.caller)
    };
    
    public shared(msg) func getNextRound(sessionId: Text) : async Result.Result<GameV2.RoundState, Text> {
        // Get random photo
        switch(photoManager.getRandomPhoto()) {
            case null { #err("No photos available") };
            case (?photo) {
                gameEngineManager.getNextRound(sessionId, msg.caller, photo.id)
            };
        }
    };
    
    public shared(msg) func submitGuess(
        sessionId: Text,
        guessLat: Float,
        guessLon: Float,
        guessAzimuth: ?Float,
        confidenceRadius: Float
    ) : async Result.Result<RoundResult, Text> {
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
                
                // Get photo location
                switch(photoManager.getPhoto(currentRound.photoId)) {
                    case null { #err("Photo not found") };
                    case (?photo) {
                        // Submit guess
                        switch(gameEngineManager.submitGuess(
                            sessionId, msg.caller,
                            guessLat, guessLon, guessAzimuth, confidenceRadius,
                            photo.latitude, photo.longitude
                        )) {
                            case (#err(e)) { #err(e) };
                            case (#ok(roundState)) {
                                // Record guess in history
                                let distance = Helpers.calculateHaversineDistance(
                                    guessLat, guessLon,
                                    photo.latitude, photo.longitude
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
                                
                                // Return result
                                #ok({
                                    displayScore = roundState.score;
                                    normalizedScore = roundState.scoreNorm;
                                    distance = distance;
                                    actualLocation = {
                                        lat = photo.latitude;
                                        lon = photo.longitude;
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
                                
                                // Get photo
                                switch(photoManager.getPhoto(currentRound.photoId)) {
                                    case null { #err("Photo not found") };
                                    case (?photo) {
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
                                                let dLat = photo.latitude - centerLat;
                                                let dLon = photo.longitude - centerLon;
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
    
    // ======================================
    // PHOTO FUNCTIONS
    // ======================================
    public shared(msg) func uploadPhoto(request: Photo.PhotoUploadRequest) : async Result.Result<Nat, Text> {
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        
        switch(photoManager.uploadPhoto(request, msg.caller)) {
            case (#err(e)) { #err(e) };
            case (#ok(photoId)) {
                // Update reputation for upload
                ignore reputationManager.updateReputation(msg.caller, Constants.UPLOAD_REWARD, true, false);
                #ok(photoId)
            };
        }
    };
    
    public shared(msg) func schedulePhotoUpload(request: PhotoModule.ScheduledUploadRequest) : async Result.Result<Text, Text> {
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        photoManager.schedulePhotoUpload(request, msg.caller)
    };
    
    public query func getPhotosByOwner(owner: Principal) : async [PhotoModule.Photo] {
        photoManager.getPhotosByOwner(owner)
    };
    
    public query func getScheduledPhotos(userId: Principal) : async [Photo.ScheduledPhoto] {
        photoManager.getScheduledPhotos(userId)
    };
    
    public shared(msg) func cancelScheduledPhoto(scheduledId: Text) : async Result.Result<(), Text> {
        photoManager.cancelScheduledPhoto(scheduledId, msg.caller)
    };
    
    public shared(msg) func deletePhoto(photoId: Nat) : async Result.Result<(), Text> {
        photoManager.deletePhoto(photoId, msg.caller)
    };
    
    // ======================================
    // REPUTATION FUNCTIONS
    // ======================================
    public query func getReputation(user: Principal) : async ReputationModule.Reputation {
        reputationManager.getReputation(user)
    };
    
    public shared(msg) func generateReferralCode() : async Result.Result<Text, Text> {
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        reputationManager.generateReferralCode(msg.caller)
    };
    
    public shared(msg) func applyReferralCode(code: Text) : async Result.Result<(), Text> {
        if (reputationManager.isBanned(msg.caller)) {
            return #err("User is banned");
        };
        reputationManager.applyReferralCode(msg.caller, code)
    };
    
    public query func getReferralStats(user: Principal) : async {
        referralCode: ?Text;
        totalReferrals: Nat;
        unclaimedRewards: Nat;
    } {
        reputationManager.getReferralStats(user)
    };
    
    public query func getLeaderboard(limit: Nat) : async [(Principal, Float)] {
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
    // HELPER FUNCTIONS
    // ======================================
    private func calculatePlayerReward(session: GameV2.GameSession) : Nat {
        // Base reward calculation
        let totalScoreNorm = session.totalScoreNorm;
        let rounds = session.rounds.size();
        
        if (rounds == 0) {
            return 0;
        };
        
        // Average normalized score
        let avgScoreNorm = totalScoreNorm / rounds;
        
        // Time decay
        let elapsed = Time.now() - session.startTime;
        let daysElapsed = Helpers.getDaysElapsed(session.startTime, Time.now());
        let decay = Constants.PRECISION * 100 / (100 + 5 * daysElapsed);
        
        // Calculate reward with fixed point arithmetic
        let baseRewardFixed = Constants.BASE_REWARD_PLAYER * avgScoreNorm * decay / (100 * Constants.PRECISION);
        
        baseRewardFixed
    };
    
    private func calculateUploaderRewards(session: GameV2.GameSession) : [(Principal, Nat)] {
        let uploaderRewards = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
        
        for (round in session.rounds.vals()) {
            switch(photoManager.getPhoto(round.photoId)) {
                case null { };
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
        ignore await photoManager.processScheduledPhotos();
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
            
            // Get canister origin
            let canisterOrigin = "https://77fv5-oiaaa-aaaal-qsoea-cai.raw.icp0.io";
            
            // Create new session
            let response = iiIntegrationManager.newSession(publicKey, canisterOrigin);
            
            // Build callback URL with redirect URI parameter
            var callbackUrl = canisterOrigin # "/callback";
            if (redirectUri != "") {
                callbackUrl #= "?redirect-uri=" # redirectUri;
            };
            
            // Build authorize URL with our callback
            let authorizeUrl = "https://identity.ic0.app/#authorize?" #
                "client_id=" # canisterOrigin # "&" #
                "redirect_uri=" # callbackUrl # "&" #
                "state=" # response.sessionId # "&" #
                "response_type=id_token&" #
                "scope=openid&" #
                "nonce=" # response.sessionId;
            
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
                      "  const params = new URLSearchParams(window.location.search);" #
                      "  const fragment = new URLSearchParams(window.location.hash.slice(1));" #
                      "  " #
                      "  // Get data from II response" #
                      "  const delegation = fragment.get('delegation') || params.get('delegation');" #
                      "  const userPublicKey = fragment.get('user_public_key') || params.get('user_public_key');" #
                      "  const delegationPubkey = fragment.get('delegation_pubkey') || params.get('delegation_pubkey');" #
                      "  const state = fragment.get('state') || params.get('state');" #
                      "  const error = fragment.get('error') || params.get('error');" #
                      "  " #
                      "  console.log('Callback data:', { delegation: !!delegation, userPublicKey: !!userPublicKey, delegationPubkey: !!delegationPubkey, state, error });" #
                      "  " #
                      "  if (error) {" #
                      "    document.body.innerHTML = '<h2>Authentication Error</h2><p>' + error + '</p>';" #
                      "    return;" #
                      "  }" #
                      "  " #
                      "  if (!delegation || !userPublicKey || !delegationPubkey || !state) {" #
                      "    document.body.innerHTML = '<h2>Missing authentication data</h2><p>No authentication data received.</p>';" #
                      "    return;" #
                      "  }" #
                      "  " #
                      "  // Save delegation first" #
                      "  try {" #
                      "    const response = await fetch('/api/session/' + state + '/delegate', {" #
                      "      method: 'POST'," #
                      "      headers: { 'Content-Type': 'application/json' }," #
                      "      body: JSON.stringify({ delegation, userPublicKey, delegationPubkey })" #
                      "    });" #
                      "    const data = await response.json();" #
                      "    console.log('Delegation saved:', data);" #
                      "    " #
                      "    if (data.success) {" #
                      "      // Close the session to mark it as ready" #
                      "      await fetch('/api/session/' + state + '/close', {" #
                      "        method: 'POST'" #
                      "      });" #
                      "      " #
                      "      // Get redirect URI from query params" #
                      "      const urlParams = new URLSearchParams(window.location.search);" #
                      "      const redirectUri = urlParams.get('redirect-uri');" #
                      "      " #
                      "      if (redirectUri) {" #
                      "        // Add session ID to the redirect URI" #
                      "        const finalRedirectUrl = redirectUri + '&ii_session_id=' + state;" #
                      "        console.log('Redirecting to:', finalRedirectUrl);" #
                      "        window.location.replace(finalRedirectUrl);" #
                      "      } else {" #
                      "        // Fallback if no redirect URI" #
                      "        console.error('No redirect URI found');" #
                      "        document.body.innerHTML = '<h2>Authentication Complete</h2><p>But no redirect URI was provided. You can close this window.</p>';" #
                      "      }" #
                      "    } else {" #
                      "      document.body.innerHTML = '<h2>Failed to save authentication</h2><p>' + (data.error || 'Unknown error') + '</p>';" #
                      "    }" #
                      "  } catch (err) {" #
                      "    console.error('Failed to save delegation:', err);" #
                      "    document.body.innerHTML = '<h2>Error</h2><p>Failed to complete authentication: ' + err.message + '</p>';" #
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
                switch (iiIntegrationManager.getDelegation(sessionId)) {
                    case null {
                        return jsonResponse("{\"error\":\"Delegation not found\"}", 404);
                    };
                    case (?data) {
                        let json = "{\"delegation\":\"" # data.delegation # "\"," #
                                  "\"userPublicKey\":\"" # data.userPublicKey # "\"," #
                                  "\"delegationPubkey\":\"" # data.delegationPubkey # "\"}";
                        return jsonResponse(json, 200);
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
                
                // Build callback URL with original query parameters
                let callbackUrl = canisterOrigin # "/callback?" # fullQueryString;
                
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
            
            // Default response if no parameters
            return htmlResponse("<h1>II Integration Canister</h1>", 200);
        };
        
        // Default response - more helpful for debugging
        {
            body = Text.encodeUtf8("Not Found - Path: " # path # ", Full URL: " # fullPath);
            headers = [
                ("Content-Type", "text/plain"),
                ("Access-Control-Allow-Origin", "*")
            ];
            status_code = 404;
        }
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
        reputationStable := ?reputationManager.toStable();
        iiIntegrationStable := ?iiIntegrationManager.preupgrade();
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
        
        // Restart cleanup timer if initialized
        if (initialized) {
            cleanupTimer := ?Timer.recurringTimer(#seconds(60), cleanupExpiredSessions);
        };
    };
}