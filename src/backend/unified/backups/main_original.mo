import HashMap "mo:base/HashMap";
import TrieMap "mo:base/TrieMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Random "mo:base/Random";
import Nat64 "mo:base/Nat64";
import Timer "mo:base/Timer";
import Option "mo:base/Option";
import Blob "mo:base/Blob";
import Hash "mo:base/Hash";

import ICRC1 "../../types/icrc1";
import GameV2 "../../types/game_v2";
import Photo "../../types/photo";

actor GameUnified {
    // ======================================
    // SYSTEM CONFIGURATION
    // ======================================
    private stable var owner : Principal = Principal.fromText("aaaaa-aa");
    private stable var initialized : Bool = false;
    
    // ======================================
    // REWARD MINT (ICRC-1 TOKEN)
    // ======================================
    private stable var name : Text = "Guess the Spot Token";
    private stable var symbol : Text = "SPOT";
    private stable var decimals : Nat8 = 2;
    private stable var totalSupply : Nat = 0;
    private stable var transferFee : Nat = 1; // 0.01 SPOT
    
    private var balances = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
    private stable var balanceEntries : [(Principal, Nat)] = [];
    
    private var allowances = HashMap.HashMap<(Principal, Principal), Nat>(10, 
        func(a, b) = a.0 == b.0 and a.1 == b.1, 
        func(a) = Principal.hash(a.0) +% Principal.hash(a.1));
    private stable var allowanceEntries : [((Principal, Principal), Nat)] = [];
    
    private stable var transactionId : Nat = 0;
    
    // Treasury and burn management
    private stable var treasuryAddress : Principal = Principal.fromText("aaaaa-aa");
    private stable var treasuryBalance : Nat = 0;
    private stable var totalBurned : Nat = 0;
    private stable var totalSinkAmount : Nat = 0;
    
    // Sink fee constants (in 0.01 SPOT units, decimals=2)
    private stable var RETRY_FEE : Nat = 200; // 2.00 SPOT
    private stable var HINT_BASIC_FEE : Nat = 100; // 1.00 SPOT
    private stable var HINT_PREMIUM_FEE : Nat = 300; // 3.00 SPOT
    private stable var PROPOSAL_FEE : Nat = 1000; // 10.00 SPOT
    private stable var BOOST_FEE : Nat = 500; // 5.00 SPOT
    private stable var PLAY_FEE : Nat = 0; // 0.00 SPOT (free to play initially)
    
    // Transaction tracking for idempotency
    private var processedTransactions = TrieMap.TrieMap<Text, Time.Time>(Text.equal, Text.hash);
    private stable var processedTransactionsStable : [(Text, Time.Time)] = [];
    
    // Sink history
    private stable var sinkHistory : [(Time.Time, GameV2.SinkType, Nat)] = [];
    private let MAX_SINK_HISTORY : Nat = 10000;
    
    // ======================================
    // GAME ENGINE V2
    // ======================================
    // Constants
    private let MAX_CONCURRENT_SESSIONS : Nat = 2;
    private let SESSION_TIMEOUT : Nat = 1_800_000_000_000; // 30 minutes in nanoseconds
    private let ROUNDS_PER_SESSION : Nat = 10;
    private let RETRY_SCORE_THRESHOLD : Nat = 60; // Must score >= 60 to retry
    private let MAX_RETRIES_PER_SESSION : Nat = 2;
    
    // Score calculation constants (fixed point)
    private let PRECISION : Nat = 1_000_000; // 6 decimal places
    private let ALPHA : Nat = 13 * PRECISION;
    private let BETA : Nat = 1300; // 1.3 * 1000
    private let MAX_SCORE : Nat = 5000;
    
    // Session management
    private var sessions = TrieMap.TrieMap<Text, GameV2.GameSession>(Text.equal, Text.hash);
    private var userSessions = TrieMap.TrieMap<Principal, Buffer.Buffer<Text>>(Principal.equal, Principal.hash);
    private var sessionTimeouts = TrieMap.TrieMap<Text, Time.Time>(Text.equal, Text.hash);
    
    // Stable storage for upgrades
    private stable var sessionsStable : [(Text, GameV2.GameSession)] = [];
    private stable var userSessionsStable : [(Principal, [Text])] = [];
    private stable var sessionTimeoutsStable : [(Text, Time.Time)] = [];
    
    // Metrics
    private stable var totalSessions : Nat = 0;
    private stable var totalRounds : Nat = 0;
    private stable var errorCount : Nat = 0;
    private stable var totalRequests : Nat = 0;
    
    // Random number generation
    private var prng = Random.Finite(Blob.fromArray([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]));
    
    // Timers
    private var cleanupTimer : ?Timer.TimerId = null;
    
    // ======================================
    // GUESS HISTORY
    // ======================================
    public type Guess = {
        player: Principal;
        photoId: Nat;
        lat: Float;
        lon: Float;
        dist: Float;
        sessionId: Text;
        timestamp: Time.Time;
    };
    
    public type Heatmap = {
        photoId: Nat;
        heatmap: [[Float]]; // 2D grid of guess density
        bounds: { minLat: Float; maxLat: Float; minLon: Float; maxLon: Float };
        gridSize: Nat;
        totalGuesses: Nat;
    };
    
    private var guessRecords = TrieMap.TrieMap<Nat, Buffer.Buffer<Guess>>(Nat.equal, Hash.hash);
    private var playerHistory = TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
    private stable var totalGuesses : Nat = 0;
    private stable var guessRecordsStable : [(Nat, [Guess])] = [];
    private stable var playerHistoryStable : [(Principal, [Nat])] = [];
    
    // Constants
    private let MAX_GUESSES_PER_PHOTO : Nat = 10_000;
    private let MAX_PLAYER_HISTORY : Nat = 1_000;
    private let GRID_SIZE : Nat = 50; // 50x50 heatmap grid
    
    // Photo quality scores cache
    private var photoQualityScores = TrieMap.TrieMap<Nat, Float>(Nat.equal, Hash.hash);
    private stable var photoQualityScoresStable : [(Nat, Float)] = [];
    
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
    // GAME ENGINE FUNCTIONS
    // ======================================
    // Create new game session
    public shared(msg) func createSession() : async Result.Result<GameV2.SessionId, Text> {
        totalRequests += 1;
        
        // Check concurrent sessions
        let userSessionBuffer = switch(userSessions.get(msg.caller)) {
            case null {
                let buffer = Buffer.Buffer<Text>(MAX_CONCURRENT_SESSIONS);
                userSessions.put(msg.caller, buffer);
                buffer
            };
            case (?buffer) { buffer };
        };
        
        // Clean up any expired sessions for this user
        let activeSessionIds = Buffer.Buffer<Text>(userSessionBuffer.size());
        for (sessionId in userSessionBuffer.vals()) {
            switch(sessions.get(sessionId)) {
                case null { }; // Session doesn't exist
                case (?session) {
                    if (session.endTime == null) {
                        activeSessionIds.add(sessionId);
                    };
                };
            };
        };
        userSessions.put(msg.caller, activeSessionIds);
        
        if (activeSessionIds.size() >= MAX_CONCURRENT_SESSIONS) {
            errorCount += 1;
            return #err("Maximum concurrent sessions reached");
        };
        
        // Generate session ID
        let sessionId = generateSessionId(msg.caller);
        
        // Create session
        let now = Time.now();
        let session : GameV2.GameSession = {
            id = sessionId;
            userId = msg.caller;
            rounds = [];
            currentRound = 0;
            totalScore = 0;
            totalScoreNorm = 0;
            retryCount = 0;
            startTime = now;
            endTime = null;
            lastActivity = now;
        };
        
        // Store session
        sessions.put(sessionId, session);
        activeSessionIds.add(sessionId);
        sessionTimeouts.put(sessionId, now + SESSION_TIMEOUT);
        
        totalSessions += 1;
        
        #ok(sessionId)
    };
    
    // Get next round in session
    public shared(msg) func getNextRound(sessionId: Text) : async Result.Result<GameV2.RoundState, Text> {
        totalRequests += 1;
        
        // Validate sessionId
        if (sessionId == "") {
            errorCount += 1;
            return #err("Invalid session ID");
        };
        
        // Verify session ownership
        switch(sessions.get(sessionId)) {
            case null {
                errorCount += 1;
                #err("Session not found")
            };
            case (?session) {
                if (session.userId != msg.caller) {
                    errorCount += 1;
                    return #err("Unauthorized");
                };
                
                if (session.endTime != null) {
                    return #err("Session already ended");
                };
                
                if (session.currentRound >= ROUNDS_PER_SESSION) {
                    return #err("Session complete");
                };
                
                // Get random photo (simplified for now)
                let photoId = 1; // TODO: Implement actual photo selection
                let photoMeta = {
                    lat = 35.6762;
                    lon = 139.6503;
                    azim = 45.0;
                    owner = Principal.fromText("aaaaa-aa");
                };
                
                let now = Time.now();
                let roundState : GameV2.RoundState = {
                    photoId = photoId;
                    status = #Active;
                    score = 0;
                    scoreNorm = 0;
                    guessData = null;
                    retryAvailable = true;
                    hintsPurchased = [];
                    startTime = now;
                    endTime = null;
                };
                
                // Update session
                let updatedRounds = Array.append(session.rounds, [roundState]);
                let updatedSession = {
                    session with
                    rounds = updatedRounds;
                    currentRound = session.currentRound + 1;
                    lastActivity = now;
                };
                
                sessions.put(sessionId, updatedSession);
                sessionTimeouts.put(sessionId, now + SESSION_TIMEOUT);
                
                totalRounds += 1;
                
                #ok(roundState)
            };
        };
    };
    
    // Submit guess for current round
    public shared(msg) func submitGuess(
        sessionId: Text,
        guessLat: Float,
        guessLon: Float,
        guessAzimuth: ?Float,
        confidenceRadius: Float
    ) : async Result.Result<GameV2.RoundState, Text> {
        totalRequests += 1;
        
        // Validate input parameters
        if (sessionId == "") {
            errorCount += 1;
            return #err("Invalid session ID");
        };
        
        // Validate coordinates
        if (guessLat < -90.0 or guessLat > 90.0) {
            errorCount += 1;
            return #err("Invalid latitude");
        };
        
        if (guessLon < -180.0 or guessLon > 180.0) {
            errorCount += 1;
            return #err("Invalid longitude");
        };
        
        if (confidenceRadius < 0.0) {
            errorCount += 1;
            return #err("Invalid confidence radius");
        };
        
        switch(sessions.get(sessionId)) {
            case null { 
                errorCount += 1;
                #err("Session not found") 
            };
            case (?session) {
                if (session.userId != msg.caller) {
                    errorCount += 1;
                    return #err("Unauthorized");
                };
                
                if (session.currentRound == 0 or session.currentRound > session.rounds.size()) {
                    errorCount += 1;
                    return #err("No active round");
                };
                
                let roundIndex = session.currentRound - 1;
                if (roundIndex >= session.rounds.size()) {
                    errorCount += 1;
                    return #err("Invalid round index");
                };
                
                let currentRound = session.rounds[roundIndex];
                
                if (currentRound.status != #Active) {
                    return #err("Round not active");
                };
                
                // Get photo metadata (simplified for now)
                let photoMeta = {
                    lat = 35.6762;
                    lon = 139.6503;
                    azim = 45.0;
                    owner = Principal.fromText("aaaaa-aa");
                };
                
                // Calculate distance
                let distance = calculateHaversineDistance(
                    guessLat, guessLon,
                    photoMeta.lat, photoMeta.lon
                );
                
                // Calculate scores - convert Float to Nat
                let distanceNat = Int.abs(Float.toInt(distance));
                let (displayScore, normScore) = calculateScoreFixed(distanceNat);
                
                // Create guess data
                let guessData : GameV2.GuessData = {
                    lat = guessLat;
                    lon = guessLon;
                    azimuth = guessAzimuth;
                    confidenceRadius = confidenceRadius;
                    submittedAt = Time.now();
                };
                
                // Update round
                let updatedRound = {
                    currentRound with
                    status = #Completed;
                    score = displayScore;
                    scoreNorm = normScore;
                    guessData = ?guessData;
                    endTime = ?Time.now();
                };
                
                // Update session
                var updatedRounds = Buffer.fromArray<GameV2.RoundState>(session.rounds);
                updatedRounds.put(roundIndex, updatedRound);
                
                let updatedSession = {
                    session with
                    rounds = Buffer.toArray(updatedRounds);
                    totalScore = session.totalScore + displayScore;
                    totalScoreNorm = session.totalScoreNorm + normScore;
                    lastActivity = Time.now();
                };
                
                sessions.put(sessionId, updatedSession);
                
                // Record guess in history
                let guessRecord : Guess = {
                    player = msg.caller;
                    photoId = currentRound.photoId;
                    lat = guessLat;
                    lon = guessLon;
                    dist = distance;
                    sessionId = sessionId;
                    timestamp = Time.now();
                };
                
                ignore recordGuessInternal(guessRecord);
                
                #ok(updatedRound)
            };
        };
    };
    
    // Purchase hint for current round
    public shared(msg) func purchaseHint(
        sessionId: Text,
        hintType: GameV2.HintType
    ) : async Result.Result<GameV2.HintData, Text> {
        switch(sessions.get(sessionId)) {
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
                
                if (currentRound.status != #Active) {
                    return #err("Round not active");
                };
                
                // Check if hint already purchased
                if (Array.find<GameV2.HintType>(
                    currentRound.hintsPurchased,
                    func(h) = h == hintType
                ) != null) {
                    return #err("Hint already purchased");
                };
                
                // Process hint payment
                let sinkType = switch(hintType) {
                    case (#BasicRadius) { #HintBasic };
                    case (#PremiumRadius) { #HintPremium };
                    case (#DirectionHint) { #HintBasic };
                };
                
                // Generate unique transaction ID
                let txId = Principal.toText(msg.caller) # "_hint_" # sessionId # "_" # Int.toText(Time.now());
                
                switch(processSinkPaymentInternal(msg.caller, sinkType, txId)) {
                    case (#err(e)) { #err("Payment failed: " # e) };
                    case (#ok()) {
                        // Generate hint
                        let hintData = generateHintInternal(currentRound.photoId, hintType);
                        
                        // Update round with purchased hint
                        var updatedRounds = Buffer.fromArray<GameV2.RoundState>(session.rounds);
                        let updatedRound = {
                            currentRound with
                            hintsPurchased = Array.append(currentRound.hintsPurchased, [hintType]);
                        };
                        updatedRounds.put(roundIndex, updatedRound);
                        
                        let updatedSession = {
                            session with
                            rounds = Buffer.toArray(updatedRounds);
                            lastActivity = Time.now();
                        };
                        
                        sessions.put(sessionId, updatedSession);
                        
                        #ok(hintData)
                    };
                };
            };
        };
    };
    
    // Finalize session and calculate rewards
    public shared(msg) func finalizeSession(sessionId: Text) : async Result.Result<GameV2.SessionResult, Text> {
        switch(sessions.get(sessionId)) {
            case null { #err("Session not found") };
            case (?session) {
                if (session.userId != msg.caller) {
                    return #err("Unauthorized");
                };
                
                if (session.endTime != null) {
                    return #err("Session already finalized");
                };
                
                let now = Time.now();
                
                // Calculate rewards
                let (playerReward, uploaderRewards) = calculateSessionRewardsInternal(session);
                
                // Mint player rewards
                switch(mintInternal(msg.caller, playerReward)) {
                    case (#err(e)) { return #err("Failed to mint player rewards: " # e) };
                    case (#ok(_)) { };
                };
                
                // Mint uploader rewards
                for ((uploader, reward) in uploaderRewards.vals()) {
                    switch(mintInternal(uploader, reward)) {
                        case (#err(e)) { 
                            // Log error but continue
                            Debug.print("Failed to mint uploader reward: " # e);
                        };
                        case (#ok(_)) { };
                    };
                };
                
                // Update session
                let finalizedSession = {
                    session with
                    endTime = ?now;
                };
                
                sessions.put(sessionId, finalizedSession);
                
                // Create result
                let result : GameV2.SessionResult = {
                    sessionId = sessionId;
                    userId = msg.caller;
                    totalScore = session.totalScore;
                    totalScoreNorm = session.totalScoreNorm;
                    completedRounds = Array.filter<GameV2.RoundState>(
                        session.rounds,
                        func(r) = r.status == #Completed
                    ).size();
                    totalRounds = session.rounds.size();
                    playerReward = playerReward;
                    uploaderRewards = uploaderRewards;
                    duration = Int.abs(now - session.startTime);
                    rank = null; // TODO: Calculate ranking
                };
                
                #ok(result)
            };
        };
    };
    
    // ======================================
    // TOKEN FUNCTIONS (ICRC-1)
    // ======================================
    public query func icrc1_name() : async Text {
        name;
    };
    
    public query func icrc1_symbol() : async Text {
        symbol;
    };
    
    public query func icrc1_decimals() : async Nat8 {
        decimals;
    };
    
    public query func icrc1_fee() : async Nat {
        transferFee;
    };
    
    public query func icrc1_total_supply() : async Nat {
        totalSupply;
    };
    
    public query func icrc1_balance_of(account: ICRC1.Account) : async Nat {
        switch (balances.get(account.owner)) {
            case null { 0 };
            case (?balance) { balance };
        };
    };
    
    public shared(msg) func icrc1_transfer(args: ICRC1.TransferArgs) : async Result.Result<Nat, ICRC1.TransferError> {
        let from = msg.caller;
        let to = args.to.owner;
        let amount = args.amount;
        let fee = switch (args.fee) {
            case null { transferFee };
            case (?f) { f };
        };
        
        // Validate inputs
        if (Principal.toText(to) == "") {
            return #err(#GenericError { error_code = 1; message = "Invalid recipient" });
        };
        
        if (amount == 0) {
            return #err(#GenericError { error_code = 2; message = "Zero amount transfer" });
        };
        
        if (fee != transferFee) {
            return #err(#BadFee { expected_fee = transferFee });
        };
        
        let fromBalance = switch (balances.get(from)) {
            case null { 0 };
            case (?balance) { balance };
        };
        
        // Check for overflow
        let totalCost = amount + fee;
        if (totalCost < amount) { // Overflow check
            return #err(#GenericError { error_code = 3; message = "Arithmetic overflow" });
        };
        
        if (fromBalance < totalCost) {
            return #err(#InsufficientFunds { balance = fromBalance });
        };
        
        // Check if transfer would overflow recipient balance
        let toBalance = switch (balances.get(to)) {
            case null { 0 };
            case (?balance) { balance };
        };
        
        let newToBalance = toBalance + amount;
        if (newToBalance < toBalance) { // Overflow check
            return #err(#GenericError { error_code = 4; message = "Recipient balance overflow" });
        };
        
        balances.put(from, fromBalance - totalCost);
        balances.put(to, newToBalance);
        
        transactionId := transactionId + 1;
        #ok(transactionId);
    };
    
    // ======================================
    // GUESS HISTORY FUNCTIONS
    // ======================================
    public shared(msg) func recordGuess(guess: Guess) : async Result.Result<Nat, Text> {
        recordGuessInternal(guess)
    };
    
    public query func getPhotoGuesses(photoId: Nat, limit: ?Nat) : async [Guess] {
        switch(guessRecords.get(photoId)) {
            case null { [] };
            case (?guesses) {
                let actualLimit = switch(limit) {
                    case null { guesses.size() };
                    case (?l) { Nat.min(l, guesses.size()) };
                };
                
                // Return most recent guesses
                if (actualLimit == guesses.size()) {
                    Buffer.toArray(guesses)
                } else {
                    let result = Buffer.Buffer<Guess>(actualLimit);
                    let start = guesses.size() - actualLimit;
                    for (i in Iter.range(start, guesses.size() - 1)) {
                        result.add(guesses.get(i));
                    };
                    Buffer.toArray(result)
                }
            };
        }
    };
    
    public query func getPlayerHistory(player: Principal, limit: ?Nat) : async [Nat] {
        switch(playerHistory.get(player)) {
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
    
    public query func getPhotoQuality(photoId: Nat) : async Float {
        switch(photoQualityScores.get(photoId)) {
            case null { 0.0 };
            case (?quality) { quality };
        }
    };
    
    public query func getHeatmap(photoId: Nat) : async ?Heatmap {
        switch(guessRecords.get(photoId)) {
            case null { null };
            case (?guesses) {
                if (guesses.size() == 0) { return null };
                
                // Find bounds
                var minLat = guesses.get(0).lat;
                var maxLat = guesses.get(0).lat;
                var minLon = guesses.get(0).lon;
                var maxLon = guesses.get(0).lon;
                
                for (guess in guesses.vals()) {
                    if (guess.lat < minLat) { minLat := guess.lat };
                    if (guess.lat > maxLat) { maxLat := guess.lat };
                    if (guess.lon < minLon) { minLon := guess.lon };
                    if (guess.lon > maxLon) { maxLon := guess.lon };
                };
                
                // Create grid
                let latRange = maxLat - minLat;
                let lonRange = maxLon - minLon;
                let grid = Array.init<[var Float]>(GRID_SIZE, Array.init(GRID_SIZE, 0.0));
                
                // Populate grid
                for (guess in guesses.vals()) {
                    let latIndex = Int.abs(Float.toInt((guess.lat - minLat) / latRange * Float.fromInt(GRID_SIZE - 1)));
                    let lonIndex = Int.abs(Float.toInt((guess.lon - minLon) / lonRange * Float.fromInt(GRID_SIZE - 1)));
                    
                    if (latIndex < GRID_SIZE and lonIndex < GRID_SIZE) {
                        grid[latIndex][lonIndex] := grid[latIndex][lonIndex] + 1.0;
                    };
                };
                
                // Convert to immutable
                let heatmapGrid = Array.tabulate<[Float]>(GRID_SIZE, func(i) {
                    Array.freeze(grid[i])
                });
                
                ?{
                    photoId = photoId;
                    heatmap = heatmapGrid;
                    bounds = { minLat; maxLat; minLon; maxLon };
                    gridSize = GRID_SIZE;
                    totalGuesses = guesses.size();
                }
            };
        }
    };
    
    // ======================================
    // HELPER FUNCTIONS
    // ======================================
    private func generateSessionId(user: Principal) : Text {
        let time = Int.toText(Time.now());
        let userText = Principal.toText(user);
        let randomByte = switch(prng.byte()) {
            case null { 0 };
            case (?b) { Nat8.toNat(b) };
        };
        userText # "_" # time # "_" # Nat.toText(randomByte)
    };
    
    private func calculateHaversineDistance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) : Float {
        let R = 6371000.0; // Earth's radius in meters
        let phi1 = lat1 * Float.pi / 180.0;
        let phi2 = lat2 * Float.pi / 180.0;
        let deltaPhi = (lat2 - lat1) * Float.pi / 180.0;
        let deltaLambda = (lon2 - lon1) * Float.pi / 180.0;
        
        let a = Float.sin(deltaPhi/2) * Float.sin(deltaPhi/2) +
                Float.cos(phi1) * Float.cos(phi2) *
                Float.sin(deltaLambda/2) * Float.sin(deltaLambda/2);
        let c = 2 * Float.arctan2(Float.sqrt(a), Float.sqrt(1-a));
        
        R * c
    };
    
    private func calculateScoreFixed(distanceMeters: Nat) : (Nat, Nat) {
        // Convert distance to km with fixed point
        let distKm = distanceMeters * PRECISION / 1000;
        
        // Approximate d^1.3 using fixed point arithmetic
        // For simplicity, using linear approximation
        let dPower = distKm * 13 / 10; // Approximation of d^1.3
        
        // Calculate score
        let maxScoreFixed = MAX_SCORE * PRECISION;
        let reduction = ALPHA * dPower / PRECISION;
        let scoreFixed = if (maxScoreFixed > reduction) { maxScoreFixed - reduction } else { 0 };
        let displayScore = scoreFixed / PRECISION;
        
        // Ensure score is within bounds
        let finalScore = Nat.min(MAX_SCORE, displayScore);
        
        // Calculate normalized score
        let normScore = (finalScore + 49) / 50;
        
        (finalScore, normScore)
    };
    
    private func cleanupExpiredSessions() : async () {
        let now = Time.now();
        let expired = Buffer.Buffer<Text>(10);
        
        for ((sessionId, timeout) in sessionTimeouts.entries()) {
            if (now > timeout) {
                expired.add(sessionId);
            };
        };
        
        for (sessionId in expired.vals()) {
            sessionTimeouts.delete(sessionId);
            switch(sessions.get(sessionId)) {
                case null { };
                case (?session) {
                    if (session.endTime == null) {
                        // Mark session as timed out
                        let timedOutSession = {
                            session with
                            endTime = ?now;
                        };
                        sessions.put(sessionId, timedOutSession);
                    };
                };
            };
        };
    };
    
    // Internal mint function
    private func mintInternal(to: Principal, amount: Nat) : Result.Result<Nat, Text> {
        let currentBalance = switch (balances.get(to)) {
            case null { 0 };
            case (?balance) { balance };
        };
        
        balances.put(to, currentBalance + amount);
        totalSupply := totalSupply + amount;
        transactionId := transactionId + 1;
        
        #ok(transactionId);
    };
    
    // Internal sink payment processing
    private func processSinkPaymentInternal(
        user: Principal,
        sinkType: GameV2.SinkType, 
        txId: Text
    ) : Result.Result<(), Text> {
        // Check for duplicate transaction
        switch(processedTransactions.get(txId)) {
            case (?_) { return #err("Transaction already processed") };
            case null { };
        };
        
        // Get sink amount
        let amount = getSinkAmount(sinkType);
        if (amount == 0) {
            // Free action, just record it
            processedTransactions.put(txId, Time.now());
            return #ok();
        };
        
        // Get user balance
        let balance = switch (balances.get(user)) {
            case null { 0 };
            case (?bal) { bal };
        };
        
        if (balance < amount) {
            return #err("Insufficient balance");
        };
        
        // Atomic transaction
        balances.put(user, balance - amount);
        treasuryBalance := treasuryBalance + amount;
        totalSinkAmount := totalSinkAmount + amount;
        processedTransactions.put(txId, Time.now());
        
        // Record in history
        let historyEntry = (Time.now(), sinkType, amount);
        if (sinkHistory.size() >= MAX_SINK_HISTORY) {
            // Remove oldest entries
            sinkHistory := Array.tabulate<(Time.Time, GameV2.SinkType, Nat)>(
                MAX_SINK_HISTORY - 1,
                func(i) = sinkHistory[i + 1]
            );
        };
        sinkHistory := Array.append(sinkHistory, [historyEntry]);
        
        #ok()
    };
    
    // Helper function to get sink amount
    private func getSinkAmount(sinkType: GameV2.SinkType) : Nat {
        switch(sinkType) {
            case (#Retry) { RETRY_FEE };
            case (#HintBasic) { HINT_BASIC_FEE };
            case (#HintPremium) { HINT_PREMIUM_FEE };
            case (#Proposal) { PROPOSAL_FEE };
            case (#Boost) { BOOST_FEE };
            case (#PlayFee) { PLAY_FEE };
        }
    };
    
    // Generate hint data
    private func generateHintInternal(photoId: Nat, hintType: GameV2.HintType) : GameV2.HintData {
        // Get photo metadata (simplified for now)
        let meta = {
            lat = 35.6762;
            lon = 139.6503;
            azim = 45.0;
        };
        
        let hintContent = switch(hintType) {
            case (#BasicRadius) {
                #RadiusHint({
                    centerLat = meta.lat;
                    centerLon = meta.lon;
                    radius = 50.0;
                });
            };
            case (#PremiumRadius) {
                #RadiusHint({
                    centerLat = meta.lat;
                    centerLon = meta.lon;
                    radius = 25.0;
                });
            };
            case (#DirectionHint) {
                // Calculate cardinal direction
                let direction = if (meta.azim < 22.5 or meta.azim >= 337.5) { "North" }
                               else if (meta.azim < 67.5) { "Northeast" }
                               else if (meta.azim < 112.5) { "East" }
                               else if (meta.azim < 157.5) { "Southeast" }
                               else if (meta.azim < 202.5) { "South" }
                               else if (meta.azim < 247.5) { "Southwest" }
                               else if (meta.azim < 292.5) { "West" }
                               else { "Northwest" };
                #DirectionHint(direction);
            };
        };
        
        {
            hintType = hintType;
            data = hintContent;
        };
    };
    
    // Calculate session rewards
    private func calculateSessionRewardsInternal(session: GameV2.GameSession) : (Nat, [(Principal, Nat)]) {
        // Validate session data
        if (session.rounds.size() == 0) {
            return (0, []);
        };
        
        // Calculate rewards with decay formula
        let completedRounds = Array.filter<GameV2.RoundState>(
            session.rounds,
            func(r) = r.status == #Completed
        ).size();
        
        if (completedRounds == 0) {
            return (0, []);
        };
        
        // B(t) = 1 / (1 + 0.05 * t) where t is in 10k round units
        let t = totalRounds / 10000;
        // Prevent division by zero
        let denominator = 100 + 5 * t;
        if (denominator == 0) {
            return (0, []);
        };
        let decay = PRECISION * 100 / denominator;
        
        // Base reward calculation with overflow protection
        let scoreProduct = session.totalScoreNorm * decay;
        if (scoreProduct > 0 and scoreProduct / decay != session.totalScoreNorm) {
            // Overflow detected
            return (0, []);
        };
        
        let baseRewardFixed = 20000 * scoreProduct / (100 * PRECISION);
        let playerReward = baseRewardFixed / 10000;
        
        // Calculate uploader rewards (30% of player reward per photo)
        let uploaderRewardsBuffer = Buffer.Buffer<(Principal, Nat)>(completedRounds);
        
        for (round in session.rounds.vals()) {
            if (round.status == #Completed) {
                // Get photo metadata (simplified for now)
                let photoOwner = Principal.fromText("aaaaa-aa"); // TODO: Get actual owner
                
                // Validate owner
                if (Principal.toText(photoOwner) != "") {
                    let uploaderReward = (round.scoreNorm * 2 * 30) / 100;
                    uploaderRewardsBuffer.add((photoOwner, uploaderReward));
                };
            };
        };
        
        (playerReward, Buffer.toArray(uploaderRewardsBuffer))
    };
    
    // Internal guess recording
    private func recordGuessInternal(guess: Guess) : Result.Result<Nat, Text> {
        // Validate input
        if (Principal.toText(guess.player) == "") {
            return #err("Invalid player principal");
        };
        
        if (guess.lat < -90.0 or guess.lat > 90.0) {
            return #err("Invalid latitude");
        };
        
        if (guess.lon < -180.0 or guess.lon > 180.0) {
            return #err("Invalid longitude");
        };
        
        if (guess.dist < 0.0) {
            return #err("Invalid distance");
        };
        
        // Get or create buffer for this photo
        let photoGuesses = switch(guessRecords.get(guess.photoId)) {
            case null {
                let buffer = Buffer.Buffer<Guess>(100);
                guessRecords.put(guess.photoId, buffer);
                buffer
            };
            case (?buffer) { buffer };
        };
        
        // Check capacity
        if (photoGuesses.size() >= MAX_GUESSES_PER_PHOTO) {
            // Remove oldest guess
            ignore photoGuesses.removeLast();
        };
        
        // Add new guess
        photoGuesses.add(guess);
        
        // Update player history
        let history = switch(playerHistory.get(guess.player)) {
            case null {
                let buffer = Buffer.Buffer<Nat>(100);
                playerHistory.put(guess.player, buffer);
                buffer
            };
            case (?buffer) { buffer };
        };
        
        if (history.size() >= MAX_PLAYER_HISTORY) {
            ignore history.removeLast();
        };
        
        history.add(guess.photoId);
        
        // Update quality score
        updatePhotoQuality(guess.photoId);
        
        totalGuesses += 1;
        #ok(totalGuesses)
    };
    
    private func updatePhotoQuality(photoId: Nat) : () {
        switch(guessRecords.get(photoId)) {
            case null { };
            case (?guesses) {
                if (guesses.size() < 10) { return };
                
                // Calculate median distance
                let distances = Buffer.Buffer<Float>(guesses.size());
                for (guess in guesses.vals()) {
                    distances.add(guess.dist);
                };
                
                // Simple bubble sort for median
                let arr = Buffer.toArray(distances);
                let sortedArr = Array.sort(arr, Float.compare);
                
                let medianDist = if (sortedArr.size() % 2 == 0) {
                    let mid = sortedArr.size() / 2;
                    (sortedArr[mid - 1] + sortedArr[mid]) / 2.0
                } else {
                    sortedArr[sortedArr.size() / 2]
                };
                
                // Quality score: Q = 1 - clamp(d_median / 300km, 0, 1)
                let normalizedDist = medianDist / 300000.0; // 300km in meters
                let clampedDist = Float.max(0.0, Float.min(1.0, normalizedDist));
                let quality = 1.0 - clampedDist;
                
                photoQualityScores.put(photoId, quality);
            };
        };
    };
    
    // ======================================
    // SYSTEM FUNCTIONS
    // ======================================
    system func preupgrade() {
        // Token data
        balanceEntries := Iter.toArray(balances.entries());
        allowanceEntries := Iter.toArray(allowances.entries());
        processedTransactionsStable := Iter.toArray(processedTransactions.entries());
        
        // Game session data
        sessionsStable := Iter.toArray(sessions.entries());
        
        let userSessionsBuffer = Buffer.Buffer<(Principal, [Text])>(userSessions.size());
        for ((user, buffer) in userSessions.entries()) {
            userSessionsBuffer.add((user, Buffer.toArray(buffer)));
        };
        userSessionsStable := Buffer.toArray(userSessionsBuffer);
        
        sessionTimeoutsStable := Iter.toArray(sessionTimeouts.entries());
        
        // Guess history data
        let guessRecordsBuffer = Buffer.Buffer<(Nat, [Guess])>(guessRecords.size());
        for ((photoId, guesses) in guessRecords.entries()) {
            guessRecordsBuffer.add((photoId, Buffer.toArray(guesses)));
        };
        guessRecordsStable := Buffer.toArray(guessRecordsBuffer);
        
        let playerHistoryBuffer = Buffer.Buffer<(Principal, [Nat])>(playerHistory.size());
        for ((player, history) in playerHistory.entries()) {
            playerHistoryBuffer.add((player, Buffer.toArray(history)));
        };
        playerHistoryStable := Buffer.toArray(playerHistoryBuffer);
        
        photoQualityScoresStable := Iter.toArray(photoQualityScores.entries());
    };
    
    system func postupgrade() {
        // Token data
        balances := HashMap.fromIter<Principal, Nat>(balanceEntries.vals(), balanceEntries.size(), Principal.equal, Principal.hash);
        allowances := HashMap.fromIter<(Principal, Principal), Nat>(allowanceEntries.vals(), allowanceEntries.size(), 
            func(a, b) = a.0 == b.0 and a.1 == b.1, 
            func(a) = Principal.hash(a.0) +% Principal.hash(a.1));
        
        // Restore processed transactions
        for ((txId, time) in processedTransactionsStable.vals()) {
            processedTransactions.put(txId, time);
        };
        processedTransactionsStable := [];
        
        // Game session data
        for ((sessionId, session) in sessionsStable.vals()) {
            sessions.put(sessionId, session);
        };
        sessionsStable := [];
        
        for ((user, sessionIds) in userSessionsStable.vals()) {
            let buffer = Buffer.fromArray<Text>(sessionIds);
            userSessions.put(user, buffer);
        };
        userSessionsStable := [];
        
        for ((sessionId, timeout) in sessionTimeoutsStable.vals()) {
            sessionTimeouts.put(sessionId, timeout);
        };
        sessionTimeoutsStable := [];
        
        // Guess history data
        for ((photoId, guesses) in guessRecordsStable.vals()) {
            let buffer = Buffer.fromArray<Guess>(guesses);
            guessRecords.put(photoId, buffer);
        };
        guessRecordsStable := [];
        
        for ((player, history) in playerHistoryStable.vals()) {
            let buffer = Buffer.fromArray<Nat>(history);
            playerHistory.put(player, buffer);
        };
        playerHistoryStable := [];
        
        for ((photoId, quality) in photoQualityScoresStable.vals()) {
            photoQualityScores.put(photoId, quality);
        };
        photoQualityScoresStable := [];
        
        // Restart cleanup timer
        cleanupTimer := ?Timer.recurringTimer(#seconds(60), cleanupExpiredSessions);
    };
}