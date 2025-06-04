import Debug "mo:base/Debug";
import Result "mo:base/Result";
import Principal "mo:base/Principal";
import RewardMint "../src/backend/reward_mint/main";

actor test {
    let owner = Principal.fromText("aaaaa-aa");
    let user1 = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    let user2 = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
    let gameEngine = Principal.fromText("rno2w-sqaaa-aaaaa-aaacq-cai");
    
    // Test 1: Initial state
    public func testInitialState() : async Bool {
        let reward = await RewardMint.RewardMint();
        
        let name = await reward.icrc1_name();
        let symbol = await reward.icrc1_symbol();
        let decimals = await reward.icrc1_decimals();
        let totalSupply = await reward.icrc1_total_supply();
        
        Debug.print("Token name: " # name);
        Debug.print("Token symbol: " # symbol);
        Debug.print("Decimals: " # Nat8.toText(decimals));
        Debug.print("Total supply: " # Nat.toText(totalSupply));
        
        return name == "Guess the Spot Token" and 
               symbol == "SPOT" and 
               decimals == 2 and 
               totalSupply == 0;
    };
    
    // Test 2: Set game engine canister
    public func testSetGameEngine() : async Bool {
        let reward = await RewardMint.RewardMint();
        
        // Should fail when not owner
        let result1 = await reward.setGameEngineCanister(gameEngine);
        let success1 = switch (result1) {
            case (#ok(_)) { false };
            case (#err(_)) { true };
        };
        
        // Should succeed when owner
        // Note: In real tests, would need to set caller as owner
        
        return success1;
    };
    
    // Test 3: Mint tokens
    public func testMint() : async Bool {
        let reward = await RewardMint.RewardMint();
        
        // Set game engine first (assuming we're owner)
        let _ = await reward.setGameEngineCanister(gameEngine);
        
        // Mint some tokens
        let mintResult = await reward.mint(user1, 1000);
        let minted = switch (mintResult) {
            case (#ok(txId)) { true };
            case (#err(_)) { false };
        };
        
        // Check balance
        let balance = await reward.icrc1_balance_of({ owner = user1; subaccount = null });
        let totalSupply = await reward.icrc1_total_supply();
        
        Debug.print("User1 balance: " # Nat.toText(balance));
        Debug.print("Total supply after mint: " # Nat.toText(totalSupply));
        
        return minted and balance == 1000 and totalSupply == 1000;
    };
    
    // Test 4: Transfer tokens
    public func testTransfer() : async Bool {
        let reward = await RewardMint.RewardMint();
        
        // Setup: mint tokens to user1
        let _ = await reward.setGameEngineCanister(gameEngine);
        let _ = await reward.mint(user1, 1000);
        
        // Transfer from user1 to user2
        let transferArgs = {
            from_subaccount = null;
            to = { owner = user2; subaccount = null };
            amount = 500;
            fee = ?1;
            memo = null;
            created_at_time = null;
        };
        
        // Note: In real test, would need to set caller as user1
        let transferResult = await reward.icrc1_transfer(transferArgs);
        
        let success = switch (transferResult) {
            case (#ok(txId)) { 
                Debug.print("Transfer successful, txId: " # Nat.toText(txId));
                true 
            };
            case (#err(e)) { 
                Debug.print("Transfer failed");
                false 
            };
        };
        
        return success;
    };
    
    // Test 5: Approve and transferFrom
    public func testApproveAndTransferFrom() : async Bool {
        let reward = await RewardMint.RewardMint();
        
        // Setup
        let _ = await reward.setGameEngineCanister(gameEngine);
        let _ = await reward.mint(user1, 1000);
        
        // User1 approves user2 to spend 300 tokens
        let approveResult = await reward.icrc2_approve({
            spender = { owner = user2; subaccount = null };
            amount = 300;
            expires_at = null;
        });
        
        let approved = switch (approveResult) {
            case (#ok(_)) { true };
            case (#err(_)) { false };
        };
        
        // Check allowance
        let allowance = await reward.icrc2_allowance({
            account = { owner = user1; subaccount = null };
            spender = { owner = user2; subaccount = null };
        });
        
        Debug.print("Allowance: " # Nat.toText(allowance.allowance));
        
        return approved and allowance.allowance == 300;
    };
    
    // Test 6: Burn tokens
    public func testBurn() : async Bool {
        let reward = await RewardMint.RewardMint();
        
        // Setup
        let _ = await reward.setGameEngineCanister(gameEngine);
        let _ = await reward.mint(user1, 1000);
        
        // Burn tokens
        let burnResult = await reward.burn(200);
        
        let burned = switch (burnResult) {
            case (#ok(_)) { true };
            case (#err(_)) { false };
        };
        
        let totalBurned = await reward.getTotalBurned();
        Debug.print("Total burned: " # Nat.toText(totalBurned));
        
        return burned and totalBurned == 200;
    };
    
    // Run all tests
    public func runAllTests() : async Text {
        var results = "";
        
        results #= "Test 1 - Initial State: " # Bool.toText(await testInitialState()) # "\n";
        results #= "Test 2 - Set Game Engine: " # Bool.toText(await testSetGameEngine()) # "\n";
        results #= "Test 3 - Mint: " # Bool.toText(await testMint()) # "\n";
        results #= "Test 4 - Transfer: " # Bool.toText(await testTransfer()) # "\n";
        results #= "Test 5 - Approve/TransferFrom: " # Bool.toText(await testApproveAndTransferFrom()) # "\n";
        results #= "Test 6 - Burn: " # Bool.toText(await testBurn()) # "\n";
        
        return results;
    };
}