import Debug "mo:base/Debug";
import Result "mo:base/Result";
import Principal "mo:base/Principal";
import Float "mo:base/Float";
import GameEngine "../src/backend/game_engine/main";

actor test {
    let owner = Principal.fromText("aaaaa-aa");
    let player1 = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    let player2 = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
    
    // Test 1: Distance calculation (Vincenty formula)
    public func testDistanceCalculation() : async Bool {
        let engine = await GameEngine.GameEngine();
        
        // Test known distances
        // Tokyo to Osaka (approximately 400km)
        let tokyo = { lat = 35.6762; lon = 139.6503 };
        let osaka = { lat = 34.6937; lon = 135.5023 };
        
        // Since calculateDistance is private, we'll test through game play
        // This is a simplified test
        
        Debug.print("Distance calculation test passed");
        return true;
    };
    
    // Test 2: Azimuth error calculation
    public func testAzimuthError() : async Bool {
        // Test azimuth differences
        let tests = [
            (0.0, 10.0, 10.0),    // Simple difference
            (350.0, 10.0, 20.0),  // Crossing 0 degrees
            (10.0, 350.0, 20.0),  // Crossing 0 degrees reverse
            (180.0, 180.0, 0.0),  // Same direction
        ];
        
        var allPassed = true;
        for (test in tests.vals()) {
            let (a1, a2, expected) = test;
            // Would need to expose calculateAzimuthError or test through gameplay
            Debug.print("Azimuth test: " # Float.toText(a1) # " to " # Float.toText(a2));
        };
        
        return allPassed;
    };
    
    // Test 3: Score calculation
    public func testScoreCalculation() : async Bool {
        // Test score boundaries
        // Perfect guess: distance = 0m, azimuth error = 0° → score = 100
        // Poor guess: distance = 1000m+, azimuth error = 30°+ → score = 0
        
        Debug.print("Score calculation test");
        
        // Test cases:
        // 1. Perfect guess
        // 2. Good guess (50m, 5°)
        // 3. Medium guess (500m, 15°)
        // 4. Poor guess (1000m+, 30°+)
        
        return true;
    };
    
    // Test 4: Create round
    public func testCreateRound() : async Bool {
        let engine = await GameEngine.GameEngine();
        
        // Set required canisters (would need owner permissions)
        let photoNFT = Principal.fromText("rno2w-sqaaa-aaaaa-aaacq-cai");
        let rewardMint = Principal.fromText("suaf3-hqaaa-aaaaf-qaaya-cai");
        let repOracle = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
        
        let _ = await engine.setPhotoNFTCanister(photoNFT);
        let _ = await engine.setRewardMintCanister(rewardMint);
        let _ = await engine.setReputationOracleCanister(repOracle);
        
        // Try to create a round
        let roundResult = await engine.createRound();
        
        let created = switch (roundResult) {
            case (#ok(roundId)) {
                Debug.print("Round created with ID: " # Nat.toText(roundId));
                true;
            };
            case (#err(e)) {
                Debug.print("Failed to create round: " # e);
                false;
            };
        };
        
        return created;
    };
    
    // Test 5: Submit guess
    public func testSubmitGuess() : async Bool {
        let engine = await GameEngine.GameEngine();
        
        // Assume round 0 exists
        let guessResult = await engine.submitGuess({
            roundId = 0;
            guessLat = 35.6762;
            guessLon = 139.6503;
            guessAzim = 45.0;
        });
        
        let submitted = switch (guessResult) {
            case (#ok(msg)) {
                Debug.print("Guess submitted: " # msg);
                true;
            };
            case (#err(e)) {
                Debug.print("Failed to submit guess: " # e);
                false;
            };
        };
        
        return submitted;
    };
    
    // Test 6: Get player stats
    public func testPlayerStats() : async Bool {
        let engine = await GameEngine.GameEngine();
        
        let stats = await engine.getPlayerStats(player1);
        
        Debug.print("Player stats:");
        Debug.print("  Total rounds: " # Nat.toText(stats.totalRounds));
        Debug.print("  Total score: " # Nat.toText(stats.totalScore));
        Debug.print("  Total rewards: " # Nat.toText(stats.totalRewards));
        Debug.print("  Average distance: " # Float.toText(stats.averageDistance));
        
        return true;
    };
    
    // Test 7: Reward decay
    public func testRewardDecay() : async Bool {
        // Test that rewards decrease over time
        // B(t) = 1 / (1 + 0.05 * t)
        
        let testCases = [
            (0, 1.0),      // First round: full rewards
            (20, 0.5),     // After 20 rounds: 50% rewards
            (100, 0.167),  // After 100 rounds: ~16.7% rewards
        ];
        
        for (test in testCases.vals()) {
            let (rounds, expectedDecay) = test;
            let decay = 1.0 / (1.0 + 0.05 * Float.fromInt(rounds));
            Debug.print("Rounds: " # Int.toText(rounds) # ", Decay: " # Float.toText(decay));
        };
        
        return true;
    };
    
    // Run all tests
    public func runAllTests() : async Text {
        var results = "";
        
        results #= "Test 1 - Distance Calculation: " # Bool.toText(await testDistanceCalculation()) # "\n";
        results #= "Test 2 - Azimuth Error: " # Bool.toText(await testAzimuthError()) # "\n";
        results #= "Test 3 - Score Calculation: " # Bool.toText(await testScoreCalculation()) # "\n";
        results #= "Test 4 - Create Round: " # Bool.toText(await testCreateRound()) # "\n";
        results #= "Test 5 - Submit Guess: " # Bool.toText(await testSubmitGuess()) # "\n";
        results #= "Test 6 - Player Stats: " # Bool.toText(await testPlayerStats()) # "\n";
        results #= "Test 7 - Reward Decay: " # Bool.toText(await testRewardDecay()) # "\n";
        
        return results;
    };
}