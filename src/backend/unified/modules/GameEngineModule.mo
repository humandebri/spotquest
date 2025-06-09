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
    public class GameEngineManager() {
        // Session management
        private var sessions = TrieMap.TrieMap<Text, GameV2.GameSession>(Text.equal, Text.hash);
        private var userSessions = TrieMap.TrieMap<Principal, Buffer.Buffer<Text>>(Principal.equal, Principal.hash);
        private var sessionTimeouts = TrieMap.TrieMap<Text, Time.Time>(Text.equal, Text.hash);
        
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
            userSessions.put(userId, activeSessionIds);
            
            if (activeSessionIds.size() >= Constants.MAX_CONCURRENT_SESSIONS) {
                errorCount += 1;
                return #err("Maximum concurrent sessions reached");
            };
            
            // Generate session ID
            let sessionId = Helpers.generateSessionId(userId, prng);
            
            // Create session
            let now = Time.now();
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
            };
            
            // Store session
            sessions.put(sessionId, session);
            activeSessionIds.add(sessionId);
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
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            sessionsStable: [(Text, GameV2.GameSession)];
            userSessionsStable: [(Principal, [Text])];
            sessionTimeoutsStable: [(Text, Time.Time)];
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
            
            totalSessions := stableData.totalSessions;
            totalRounds := stableData.totalRounds;
            errorCount := stableData.errorCount;
            totalRequests := stableData.totalRequests;
        };
    };
}