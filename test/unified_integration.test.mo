import Debug "mo:base/Debug";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Array "mo:base/Array";
import Option "mo:base/Option";
import Blob "mo:base/Blob";

import ICRC1 "../src/types/icrc1";
import GameV2 "../src/types/game_v2";
import Photo "../src/types/photo";
import GameUnified "canister:main_canister";

// Test framework
actor UnifiedIntegrationTest {
    // Test principals
    private let owner = Principal.fromText("2vxsx-fae");
    private let player1 = Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai");
    private let player2 = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    private let uploader1 = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
    private let treasury = Principal.fromText("aaaaa-aa");
    
    // Test data
    private let testPhoto : Photo.PhotoMeta = {
        id = 1;
        owner = uploader1;
        lat = 35.6762;
        lon = 139.6503;
        azim = 45.0;
        timestamp = Time.now();
        quality = 0.9;
        uploadTime = Time.now();
        chunkCount = 1;
        totalSize = 1024;
        perceptualHash = null;
    };
    
    // Test results storage
    private var testResults : [(Text, Bool, Text)] = [];
    
    // ======================================
    // TEST EXECUTION
    // ======================================
    public func runAllTests() : async [(Text, Bool, Text)] {
        Debug.print("Starting Unified Canister Integration Tests...\n");
        
        // Clear previous results
        testResults := [];
        
        // Run test suites
        await testInitialization();
        await testTokenOperations();
        await testGameSessions();
        await testHintSystem();
        await testGuessHistory();
        await testTreasury();
        await testPhotoOperations();
        await testReputationSystem();
        await testErrorCases();
        await testConcurrency();
        
        // Print summary
        let passed = Array.filter<(Text, Bool, Text)>(testResults, func(r) = r.1).size();
        let failed = Array.filter<(Text, Bool, Text)>(testResults, func(r) = not r.1).size();
        
        Debug.print("\n========================================");
        Debug.print("Test Summary:");
        Debug.print("Total tests: " # Nat.toText(testResults.size()));
        Debug.print("Passed: " # Nat.toText(passed));
        Debug.print("Failed: " # Nat.toText(failed));
        Debug.print("========================================\n");
        
        testResults
    };
    
    // ======================================
    // TEST SUITES
    // ======================================
    
    // Test initialization
    private func testInitialization() : async () {
        Debug.print("\n=== Testing Initialization ===");
        
        // Test 1: Initialize canister
        try {
            let result = await GameUnified.init();
            addResult("Initialize canister", Result.isOk(result), 
                switch(result) {
                    case (#ok()) { "Success" };
                    case (#err(e)) { "Error: " # e };
                });
        } catch (e) {
            addResult("Initialize canister", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Double initialization should fail
        try {
            let result = await GameUnified.init();
            addResult("Prevent double initialization", Result.isErr(result),
                switch(result) {
                    case (#ok()) { "Should have failed" };
                    case (#err(e)) { "Correctly rejected: " # e };
                });
        } catch (e) {
            addResult("Prevent double initialization", false, "Exception: " # Error.message(e));
        };
    };
    
    // Test token operations (ICRC-1)
    private func testTokenOperations() : async () {
        Debug.print("\n=== Testing Token Operations (ICRC-1) ===");
        
        // Test 1: Token metadata
        try {
            let name = await GameUnified.icrc1_name();
            let symbol = await GameUnified.icrc1_symbol();
            let decimals = await GameUnified.icrc1_decimals();
            let fee = await GameUnified.icrc1_fee();
            
            addResult("Token metadata", 
                name == "Guess the Spot Token" and 
                symbol == "SPOT" and 
                decimals == 2 and 
                fee == 1,
                "Name: " # name # ", Symbol: " # symbol # 
                ", Decimals: " # Nat8.toText(decimals) # ", Fee: " # Nat.toText(fee));
        } catch (e) {
            addResult("Token metadata", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Check initial balances
        try {
            let balance1 = await GameUnified.icrc1_balance_of({ owner = player1; subaccount = null });
            let balance2 = await GameUnified.icrc1_balance_of({ owner = player2; subaccount = null });
            
            addResult("Initial balances", balance1 == 0 and balance2 == 0,
                "Player1: " # Nat.toText(balance1) # ", Player2: " # Nat.toText(balance2));
        } catch (e) {
            addResult("Initial balances", false, "Exception: " # Error.message(e));
        };
        
        // Test 3: Mint tokens (admin function would be needed)
        // Note: This would require admin minting function in the actual implementation
        
        // Test 4: Transfer tokens
        // Note: This would require tokens to be minted first
    };
    
    // Test game sessions
    private func testGameSessions() : async () {
        Debug.print("\n=== Testing Game Sessions ===");
        
        var sessionId : Text = "";
        
        // Test 1: Create session
        try {
            let result = await GameUnified.createSession();
            switch(result) {
                case (#ok(id)) {
                    sessionId := id;
                    addResult("Create session", true, "Session ID: " # id);
                };
                case (#err(e)) {
                    addResult("Create session", false, "Error: " # e);
                };
            };
        } catch (e) {
            addResult("Create session", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Get next round
        if (sessionId != "") {
            try {
                let result = await GameUnified.getNextRound(sessionId);
                switch(result) {
                    case (#ok(round)) {
                        addResult("Get next round", true, 
                            "Photo ID: " # Nat.toText(round.photoId) # 
                            ", Status: Active");
                    };
                    case (#err(e)) {
                        addResult("Get next round", false, "Error: " # e);
                    };
                };
            } catch (e) {
                addResult("Get next round", false, "Exception: " # Error.message(e));
            };
        };
        
        // Test 3: Submit guess
        if (sessionId != "") {
            try {
                let result = await GameUnified.submitGuess(
                    sessionId,
                    35.6800,  // Close to actual location
                    139.6510,
                    ?45.0,    // Azimuth guess
                    100.0     // Confidence radius
                );
                switch(result) {
                    case (#ok(round)) {
                        addResult("Submit guess", true,
                            "Score: " # Nat.toText(round.score) # 
                            ", Normalized: " # Nat.toText(round.scoreNorm));
                    };
                    case (#err(e)) {
                        addResult("Submit guess", false, "Error: " # e);
                    };
                };
            } catch (e) {
                addResult("Submit guess", false, "Exception: " # Error.message(e));
            };
        };
        
        // Test 4: Finalize session
        if (sessionId != "") {
            try {
                let result = await GameUnified.finalizeSession(sessionId);
                switch(result) {
                    case (#ok(sessionResult)) {
                        addResult("Finalize session", true,
                            "Total score: " # Nat.toText(sessionResult.totalScore) # 
                            ", Rewards: " # Nat.toText(sessionResult.playerReward));
                    };
                    case (#err(e)) {
                        addResult("Finalize session", false, "Error: " # e);
                    };
                };
            } catch (e) {
                addResult("Finalize session", false, "Exception: " # Error.message(e));
            };
        };
    };
    
    // Test hint system
    private func testHintSystem() : async () {
        Debug.print("\n=== Testing Hint System ===");
        
        var sessionId : Text = "";
        
        // Create a new session for hint testing
        try {
            let result = await GameUnified.createSession();
            switch(result) {
                case (#ok(id)) { sessionId := id; };
                case (#err(_)) { };
            };
        } catch (e) { };
        
        if (sessionId != "") {
            // Get a round first
            let _ = await GameUnified.getNextRound(sessionId);
            
            // Test 1: Purchase basic hint
            try {
                let result = await GameUnified.purchaseHint(sessionId, #BasicRadius);
                switch(result) {
                    case (#ok(hintData)) {
                        let success = switch(hintData.data) {
                            case (#RadiusHint(data)) { true };
                            case (_) { false };
                        };
                        addResult("Purchase basic hint", success,
                            "Hint type: BasicRadius");
                    };
                    case (#err(e)) {
                        addResult("Purchase basic hint", false, "Error: " # e);
                    };
                };
            } catch (e) {
                addResult("Purchase basic hint", false, "Exception: " # Error.message(e));
            };
            
            // Test 2: Try to purchase same hint again (should fail)
            try {
                let result = await GameUnified.purchaseHint(sessionId, #BasicRadius);
                addResult("Prevent duplicate hint", Result.isErr(result),
                    switch(result) {
                        case (#ok(_)) { "Should have failed" };
                        case (#err(e)) { "Correctly rejected: " # e };
                    });
            } catch (e) {
                addResult("Prevent duplicate hint", false, "Exception: " # Error.message(e));
            };
        };
    };
    
    // Test guess history
    private func testGuessHistory() : async () {
        Debug.print("\n=== Testing Guess History ===");
        
        // Test 1: Record a guess
        let testGuess : GameUnified.Guess = {
            player = player1;
            photoId = 1;
            lat = 35.6800;
            lon = 139.6510;
            dist = 500.0;
            sessionId = "test_session_1";
            timestamp = Time.now();
        };
        
        try {
            let result = await GameUnified.recordGuess(testGuess);
            addResult("Record guess", Result.isOk(result),
                switch(result) {
                    case (#ok(count)) { "Total guesses: " # Nat.toText(count) };
                    case (#err(e)) { "Error: " # e };
                });
        } catch (e) {
            addResult("Record guess", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Get photo guesses
        try {
            let guesses = await GameUnified.getPhotoGuesses(1, ?10);
            addResult("Get photo guesses", guesses.size() > 0,
                "Found " # Nat.toText(guesses.size()) # " guesses");
        } catch (e) {
            addResult("Get photo guesses", false, "Exception: " # Error.message(e));
        };
        
        // Test 3: Get player history
        try {
            let history = await GameUnified.getPlayerHistory(player1, ?10);
            addResult("Get player history", history.size() > 0,
                "Player has " # Nat.toText(history.size()) # " photos guessed");
        } catch (e) {
            addResult("Get player history", false, "Exception: " # Error.message(e));
        };
        
        // Test 4: Generate heatmap
        try {
            let result = await GameUnified.generateHeatmap(1);
            switch(result) {
                case (#ok(heatmap)) {
                    addResult("Generate heatmap", true,
                        "Grid size: " # Nat.toText(heatmap.gridSize) # 
                        ", Total guesses: " # Nat.toText(heatmap.totalGuesses));
                };
                case (#err(e)) {
                    addResult("Generate heatmap", false, "Error: " # e);
                };
            };
        } catch (e) {
            addResult("Generate heatmap", false, "Exception: " # Error.message(e));
        };
    };
    
    // Test treasury and sink functions
    private func testTreasury() : async () {
        Debug.print("\n=== Testing Treasury Functions ===");
        
        // Test 1: Get treasury stats
        try {
            let stats = await GameUnified.getTreasuryStats();
            addResult("Get treasury stats", true,
                "Balance: " # Nat.toText(stats.balance) # 
                ", Total sunk: " # Nat.toText(stats.totalSunk));
        } catch (e) {
            addResult("Get treasury stats", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Get sink history
        try {
            let history = await GameUnified.getSinkHistory(?10);
            addResult("Get sink history", true,
                "History entries: " # Nat.toText(history.size()));
        } catch (e) {
            addResult("Get sink history", false, "Exception: " # Error.message(e));
        };
    };
    
    // Test photo operations
    private func testPhotoOperations() : async () {
        Debug.print("\n=== Testing Photo Operations ===");
        
        // Test 1: Upload photo metadata
        let uploadRequest : Photo.PhotoUploadRequest = {
            meta = testPhoto;
            totalChunks = 1;
            scheduledPublishTime = null;
            title = "Test Photo";
            description = "Test description";
            difficulty = #NORMAL;
            hint = "Test hint";
            tags = ["test", "integration"];
        };
        
        try {
            let result = await GameUnified.uploadPhoto(uploadRequest);
            switch(result) {
                case (#ok(photoId)) {
                    addResult("Upload photo", true, "Photo ID: " # Nat.toText(photoId));
                };
                case (#err(e)) {
                    addResult("Upload photo", false, "Error: " # e);
                };
            };
        } catch (e) {
            addResult("Upload photo", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Get photo metadata
        try {
            let result = await GameUnified.getPhotoMeta(1);
            addResult("Get photo metadata", Option.isSome(result),
                switch(result) {
                    case (?meta) { "Owner: " # Principal.toText(meta.owner) };
                    case (null) { "Photo not found" };
                });
        } catch (e) {
            addResult("Get photo metadata", false, "Exception: " # Error.message(e));
        };
        
        // Test 3: Get user photos
        try {
            let photos = await GameUnified.getUserPhotos(uploader1);
            addResult("Get user photos", true,
                "User has " # Nat.toText(photos.size()) # " photos");
        } catch (e) {
            addResult("Get user photos", false, "Exception: " # Error.message(e));
        };
    };
    
    // Test reputation system
    private func testReputationSystem() : async () {
        Debug.print("\n=== Testing Reputation System ===");
        
        // Test 1: Get user reputation
        try {
            let result = await GameUnified.getUserReputation(player1);
            switch(result) {
                case (?rep) {
                    addResult("Get user reputation", true,
                        "Uploader score: " # Float.toText(rep.uploaderScore) # 
                        ", Player score: " # Float.toText(rep.playerScore));
                };
                case (null) {
                    addResult("Get user reputation", true, "New user (no reputation yet)");
                };
            };
        } catch (e) {
            addResult("Get user reputation", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Get photo reputation
        try {
            let result = await GameUnified.getPhotoReputation(1);
            switch(result) {
                case (?rep) {
                    addResult("Get photo reputation", true,
                        "Quality score: " # Float.toText(rep.qualityScore) # 
                        ", Total guesses: " # Nat.toText(rep.totalGuesses));
                };
                case (null) {
                    addResult("Get photo reputation", true, "Photo has no reputation yet");
                };
            };
        } catch (e) {
            addResult("Get photo reputation", false, "Exception: " # Error.message(e));
        };
    };
    
    // Test error cases
    private func testErrorCases() : async () {
        Debug.print("\n=== Testing Error Cases ===");
        
        // Test 1: Invalid session ID
        try {
            let result = await GameUnified.getNextRound("");
            addResult("Reject empty session ID", Result.isErr(result),
                switch(result) {
                    case (#ok(_)) { "Should have failed" };
                    case (#err(e)) { "Correctly rejected: " # e };
                });
        } catch (e) {
            addResult("Reject empty session ID", false, "Exception: " # Error.message(e));
        };
        
        // Test 2: Invalid coordinates
        try {
            let result = await GameUnified.submitGuess(
                "test_session",
                91.0,  // Invalid latitude
                139.0,
                null,
                100.0
            );
            addResult("Reject invalid coordinates", Result.isErr(result),
                switch(result) {
                    case (#ok(_)) { "Should have failed" };
                    case (#err(e)) { "Correctly rejected: " # e };
                });
        } catch (e) {
            addResult("Reject invalid coordinates", false, "Exception: " # Error.message(e));
        };
        
        // Test 3: Unauthorized access
        try {
            let result = await GameUnified.finalizeSession("nonexistent_session");
            addResult("Reject unauthorized access", Result.isErr(result),
                switch(result) {
                    case (#ok(_)) { "Should have failed" };
                    case (#err(e)) { "Correctly rejected: " # e };
                });
        } catch (e) {
            addResult("Reject unauthorized access", false, "Exception: " # Error.message(e));
        };
    };
    
    // Test concurrency limits
    private func testConcurrency() : async () {
        Debug.print("\n=== Testing Concurrency Limits ===");
        
        // Test 1: Create multiple sessions
        var sessions : [Text] = [];
        
        // Create first session
        try {
            let result1 = await GameUnified.createSession();
            switch(result1) {
                case (#ok(id)) { sessions := Array.append(sessions, [id]); };
                case (#err(_)) { };
            };
        } catch (e) { };
        
        // Create second session
        try {
            let result2 = await GameUnified.createSession();
            switch(result2) {
                case (#ok(id)) { sessions := Array.append(sessions, [id]); };
                case (#err(_)) { };
            };
        } catch (e) { };
        
        addResult("Create multiple sessions", sessions.size() == 2,
            "Created " # Nat.toText(sessions.size()) # " sessions");
        
        // Test 2: Try to exceed session limit
        try {
            let result3 = await GameUnified.createSession();
            addResult("Enforce session limit", Result.isErr(result3),
                switch(result3) {
                    case (#ok(_)) { "Should have failed (exceeded limit)" };
                    case (#err(e)) { "Correctly rejected: " # e };
                });
        } catch (e) {
            addResult("Enforce session limit", false, "Exception: " # Error.message(e));
        };
    };
    
    // ======================================
    // HELPER FUNCTIONS
    // ======================================
    
    private func addResult(testName: Text, passed: Bool, details: Text) {
        testResults := Array.append(testResults, [(testName, passed, details)]);
        Debug.print(testName # ": " # (if (passed) { "✅ PASSED" } else { "❌ FAILED" }) # " - " # details);
    };
}
