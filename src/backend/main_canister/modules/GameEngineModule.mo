import TrieMap "mo:base/TrieMap";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Random "mo:base/Random";
import Blob "mo:base/Blob";
import Nat8 "mo:base/Nat8";
import Option "mo:base/Option";
import Iter "mo:base/Iter";

import Constants "Constants";
import Helpers "Helpers";
import GameV2 "../../../types/game_v2";

module {
    // Session completion record for time-based indexing
    public type SessionCompletionRecord = {
        timestamp: Time.Time;
        sessionId: Text;
        player: Principal;
        reward: Nat;
        score: Nat;
    };

    public class GameEngineManager() {
        // Session management
        private var sessions = TrieMap.TrieMap<Text, GameV2.GameSession>(Text.equal, Text.hash);
        private var userSessions = TrieMap.TrieMap<Principal, Buffer.Buffer<Text>>(Principal.equal, Principal.hash);
        private var sessionTimeouts = TrieMap.TrieMap<Text, Time.Time>(Text.equal, Text.hash);
        
        // Photo tracking for rating system
        private var sessionPhotosPlayed = TrieMap.TrieMap<Text, [(Nat, Nat)]>(Text.equal, Text.hash); // sessionId -> [(roundIndex, photoId)]
        
        // Session completion index for time-based queries
        private var sessionCompletionIndex = Buffer.Buffer<SessionCompletionRecord>(1000);
        
        // Metrics
        private var totalSessions : Nat = 0;
        private var totalRounds : Nat = 0;
        private var errorCount : Nat = 0;
        private var totalRequests : Nat = 0;
        
        // Random number generation
        private var prng = Random.Finite(Blob.fromArray([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]));
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        // Create new game session
        public func createSession(userId: Principal) : Result.Result<GameV2.SessionId, Text> {
            totalRequests += 1;
            
            // Check concurrent sessions
            let userSessionBuffer = switch(userSessions.get(userId)) {
                case null {
                    let buffer = Buffer.Buffer<Text>(Constants.MAX_CONCURRENT_SESSIONS);
                    userSessions.put(userId, buffer);
                    buffer
                };
                case (?buffer) { buffer };
            };
            
            // Clean up any expired or completed sessions for this user
            let activeSessionIds = Buffer.Buffer<Text>(userSessionBuffer.size());
            let cleanedSessionIds = Buffer.Buffer<Text>(userSessionBuffer.size());
            let now = Time.now();
            
            for (sessionId in userSessionBuffer.vals()) {
                switch(sessions.get(sessionId)) {
                    case null { 
                        // Session doesn't exist, remove from user sessions
                    }; 
                    case (?session) {
                        // Add to cleaned list (includes both active and completed)
                        cleanedSessionIds.add(sessionId);
                        
                        // Check if session should be considered active
                        let isActive = session.endTime == null and 
                                      session.currentRound < Constants.ROUNDS_PER_SESSION;
                        
                        // Also check timeout
                        switch(sessionTimeouts.get(sessionId)) {
                            case null { };
                            case (?timeout) {
                                if (now > timeout) {
                                    // Session timed out, mark as ended
                                    let timedOutSession = {
                                        session with
                                        endTime = ?now;
                                    };
                                    sessions.put(sessionId, timedOutSession);
                                };
                            };
                        };
                        
                        if (isActive and session.endTime == null) {
                            activeSessionIds.add(sessionId);
                        };
                    };
                };
            };
            // Update with cleaned sessions (preserves both active and completed)
            userSessions.put(userId, cleanedSessionIds);
            
            // If still at limit, force finalize oldest sessions
            if (activeSessionIds.size() >= Constants.MAX_CONCURRENT_SESSIONS) {
                // Force finalize all active sessions for this user to ensure clean start
                for (sessionId in activeSessionIds.vals()) {
                    switch(sessions.get(sessionId)) {
                        case null { };
                        case (?session) {
                            let finalizedSession = {
                                session with
                                endTime = ?now;
                            };
                            sessions.put(sessionId, finalizedSession);
                        };
                    };
                };
                // Keep completed sessions but clear active ones
                // No need to clear - cleanedSessionIds already has the correct state
            };
            
            // Generate session ID
            let sessionId = Helpers.generateSessionId(userId, prng);
            
            // Create session
            let session : GameV2.GameSession = {
                id = sessionId;
                userId = userId;
                rounds = [];
                currentRound = 0;
                totalScore = 0;
                totalScoreNorm = 0;
                retryCount = 0;
                startTime = now;
                endTime = null;
                lastActivity = now;
                initialEloRating = null;  // Will be set by main.mo when creating session
                playerReward = null;      // Will be set when session is finalized
            };
            
            // Store session
            sessions.put(sessionId, session);
            cleanedSessionIds.add(sessionId);
            sessionTimeouts.put(sessionId, now + Constants.SESSION_TIMEOUT);
            
            totalSessions += 1;
            
            #ok(sessionId)
        };
        
        // Get next round in session
        public func getNextRound(sessionId: Text, userId: Principal, photoId: Nat) : Result.Result<GameV2.RoundState, Text> {
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
                    if (session.userId != userId) {
                        errorCount += 1;
                        return #err("Unauthorized");
                    };
                    
                    if (session.endTime != null) {
                        return #err("Session already ended");
                    };
                    
                    if (session.currentRound >= Constants.ROUNDS_PER_SESSION) {
                        return #err("Session complete");
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
                    sessionTimeouts.put(sessionId, now + Constants.SESSION_TIMEOUT);
                    
                    // Track photo for rating system
                    let currentPhotosPlayed = switch(sessionPhotosPlayed.get(sessionId)) {
                        case null { [] };
                        case (?photos) { photos };
                    };
                    let updatedPhotosPlayed = Array.append(currentPhotosPlayed, [(session.currentRound, photoId)]);
                    sessionPhotosPlayed.put(sessionId, updatedPhotosPlayed);
                    
                    totalRounds += 1;
                    
                    #ok(roundState)
                };
            };
        };
        
        // Submit guess for current round
        public func submitGuess(
            sessionId: Text,
            userId: Principal,
            guessLat: Float,
            guessLon: Float,
            guessAzimuth: ?Float,
            confidenceRadius: Float,
            photoLat: Float,
            photoLon: Float
        ) : Result.Result<GameV2.RoundState, Text> {
            totalRequests += 1;
            
            // Validate input parameters
            if (sessionId == "") {
                errorCount += 1;
                return #err("Invalid session ID");
            };
            
            // Validate coordinates
            if (not Helpers.isValidLatitude(guessLat)) {
                errorCount += 1;
                return #err("Invalid latitude");
            };
            
            if (not Helpers.isValidLongitude(guessLon)) {
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
                    if (session.userId != userId) {
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
                    
                    // Calculate distance
                    let distance = Helpers.calculateHaversineDistance(
                        guessLat, guessLon,
                        photoLat, photoLon
                    );
                    
                    // Calculate scores - convert Float to Nat
                    let distanceNat = Int.abs(Float.toInt(distance));
                    let (displayScore, normScore) = Helpers.calculateScoreFixed(distanceNat);
                    
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
                    
                    #ok(updatedRound)
                };
            };
        };
        
        // Purchase hint for current round
        public func purchaseHint(
            sessionId: Text,
            userId: Principal,
            hintType: GameV2.HintType
        ) : Result.Result<GameV2.HintType, Text> {
            switch(sessions.get(sessionId)) {
                case null { #err("Session not found") };
                case (?session) {
                    if (session.userId != userId) {
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
                    
                    #ok(hintType)
                };
            };
        };
        
        // Finalize session
        public func finalizeSession(sessionId: Text, userId: Principal) : Result.Result<GameV2.GameSession, Text> {
            switch(sessions.get(sessionId)) {
                case null { #err("Session not found") };
                case (?session) {
                    if (session.userId != userId) {
                        return #err("Unauthorized");
                    };
                    
                    if (session.endTime != null) {
                        return #err("Session already finalized");
                    };
                    
                    let now = Time.now();
                    
                    // Update session
                    let finalizedSession = {
                        session with
                        endTime = ?now;
                    };
                    
                    sessions.put(sessionId, finalizedSession);
                    
                    #ok(finalizedSession)
                };
            };
        };
        
        // Clean up expired sessions
        public func cleanupExpiredSessions() : async () {
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
        
        // Get session
        public func getSession(sessionId: Text) : ?GameV2.GameSession {
            sessions.get(sessionId)
        };
        
        // Update session
        public func updateSession(sessionId: Text, session: GameV2.GameSession) : () {
            sessions.put(sessionId, session);
        };
        
        // Get user sessions
        public func getUserSessions(userId: Principal) : ?[Text] {
            switch(userSessions.get(userId)) {
                case null { null };
                case (?buffer) { ?Buffer.toArray(buffer) };
            }
        };
        
        // Get player sessions map (returns Principal -> [SessionId] mapping)
        public func getPlayerSessionsMap() : [(Principal, [Text])] {
            Array.map<(Principal, Buffer.Buffer<Text>), (Principal, [Text])>(
                Iter.toArray(userSessions.entries()),
                func(entry) = (entry.0, Buffer.toArray(entry.1))
            )
        };
        
        // Get metrics
        public func getMetrics() : {
            totalSessions: Nat;
            totalRounds: Nat;
            errorCount: Nat;
            totalRequests: Nat;
        } {
            {
                totalSessions = totalSessions;
                totalRounds = totalRounds;
                errorCount = errorCount;
                totalRequests = totalRequests;
            }
        };
        
        // Verify rating eligibility - for rating system integration
        public func verifyRatingEligibility(sessionId: Text, photoId: Nat, roundIndex: Nat) : Bool {
            switch(sessionPhotosPlayed.get(sessionId)) {
                case null { false };
                case (?photosPlayed) {
                    // Check if the photo was played in the specified round
                    for ((round, photo) in photosPlayed.vals()) {
                        if (round == roundIndex and photo == photoId) {
                            // Also verify the round is completed
                            switch(sessions.get(sessionId)) {
                                case null { return false };
                                case (?session) {
                                    if (roundIndex < session.rounds.size()) {
                                        let round = session.rounds[roundIndex];
                                        return round.status == #Completed;
                                    };
                                    return false;
                                };
                            };
                        };
                    };
                    false
                };
            }
        };
        
        // Get photos played in a session - for rating system
        public func getSessionPhotosPlayed(sessionId: Text) : ?[(Nat, Nat)] {
            sessionPhotosPlayed.get(sessionId)
        };
        
        // Add completion record to index
        public func addToCompletionIndex(record: SessionCompletionRecord) : () {
            sessionCompletionIndex.add(record);
        };
        
        // Get rewards for a player within a time period
        public func getRewardsForPeriod(player: Principal, startTime: Time.Time) : Nat {
            var totalRewards = 0;
            for (record in sessionCompletionIndex.vals()) {
                if (record.player == player and record.timestamp >= startTime) {
                    totalRewards += record.reward;
                };
            };
            totalRewards
        };
        
        // Get leaderboard for a time period
        public func getLeaderboardForPeriod(startTime: Time.Time, limit: Nat) : [(Principal, Nat)] {
            // Aggregate rewards by player
            let playerRewards = TrieMap.TrieMap<Principal, Nat>(Principal.equal, Principal.hash);
            
            for (record in sessionCompletionIndex.vals()) {
                if (record.timestamp >= startTime) {
                    let current = Option.get(playerRewards.get(record.player), 0);
                    playerRewards.put(record.player, current + record.reward);
                };
            };
            
            // Convert to array and sort by rewards (descending)
            let entries = Iter.toArray(playerRewards.entries());
            let sorted = Array.sort(entries, func(a: (Principal, Nat), b: (Principal, Nat)) : { #less; #equal; #greater } {
                if (b.1 > a.1) { #less }
                else if (b.1 < a.1) { #greater }
                else { #equal }
            });
            
            // Return top N entries
            let resultSize = Nat.min(limit, sorted.size());
            Array.tabulate<(Principal, Nat)>(resultSize, func(i: Nat) : (Principal, Nat) = sorted[i])
        };
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            sessionsStable: [(Text, GameV2.GameSession)];
            userSessionsStable: [(Principal, [Text])];
            sessionTimeoutsStable: [(Text, Time.Time)];
            sessionPhotosPlayedStable: [(Text, [(Nat, Nat)])];
            sessionCompletionIndexStable: [SessionCompletionRecord];
            totalSessions: Nat;
            totalRounds: Nat;
            errorCount: Nat;
            totalRequests: Nat;
        } {
            {
                sessionsStable = Iter.toArray(sessions.entries());
                userSessionsStable = Array.map<(Principal, Buffer.Buffer<Text>), (Principal, [Text])>(
                    Iter.toArray(userSessions.entries()),
                    func(entry) = (entry.0, Buffer.toArray(entry.1))
                );
                sessionTimeoutsStable = Iter.toArray(sessionTimeouts.entries());
                sessionPhotosPlayedStable = Iter.toArray(sessionPhotosPlayed.entries());
                sessionCompletionIndexStable = Buffer.toArray(sessionCompletionIndex);
                totalSessions = totalSessions;
                totalRounds = totalRounds;
                errorCount = errorCount;
                totalRequests = totalRequests;
            }
        };
        
        public func fromStable(stableData: {
            sessionsStable: [(Text, GameV2.GameSession)];
            userSessionsStable: [(Principal, [Text])];
            sessionTimeoutsStable: [(Text, Time.Time)];
            sessionPhotosPlayedStable: ?[(Text, [(Nat, Nat)])]; // Optional for backward compatibility
            sessionCompletionIndexStable: ?[SessionCompletionRecord]; // Optional for backward compatibility
            totalSessions: Nat;
            totalRounds: Nat;
            errorCount: Nat;
            totalRequests: Nat;
        }) {
            sessions := TrieMap.fromEntries(stableData.sessionsStable.vals(), Text.equal, Text.hash);
            sessionTimeouts := TrieMap.fromEntries(stableData.sessionTimeoutsStable.vals(), Text.equal, Text.hash);
            
            userSessions := TrieMap.TrieMap<Principal, Buffer.Buffer<Text>>(Principal.equal, Principal.hash);
            for ((user, sessionIds) in stableData.userSessionsStable.vals()) {
                let buffer = Buffer.Buffer<Text>(sessionIds.size());
                for (sessionId in sessionIds.vals()) {
                    buffer.add(sessionId);
                };
                userSessions.put(user, buffer);
            };
            
            // Restore sessionPhotosPlayed if available
            switch (stableData.sessionPhotosPlayedStable) {
                case null { 
                    sessionPhotosPlayed := TrieMap.TrieMap<Text, [(Nat, Nat)]>(Text.equal, Text.hash);
                };
                case (?photosData) {
                    sessionPhotosPlayed := TrieMap.fromEntries(photosData.vals(), Text.equal, Text.hash);
                };
            };
            
            // Restore sessionCompletionIndex if available
            switch (stableData.sessionCompletionIndexStable) {
                case null { 
                    sessionCompletionIndex := Buffer.Buffer<SessionCompletionRecord>(1000);
                };
                case (?indexData) {
                    sessionCompletionIndex := Buffer.Buffer<SessionCompletionRecord>(indexData.size());
                    for (record in indexData.vals()) {
                        sessionCompletionIndex.add(record);
                    };
                };
            };
            
            totalSessions := stableData.totalSessions;
            totalRounds := stableData.totalRounds;
            errorCount := stableData.errorCount;
            totalRequests := stableData.totalRequests;
        };
    };
}