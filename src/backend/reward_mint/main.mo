import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import ICRC1 "../../types/icrc1";

actor RewardMint {
    private stable var name : Text = "Guess the Spot Token";
    private stable var symbol : Text = "SPOT";
    private stable var decimals : Nat8 = 2;
    private stable var totalSupply : Nat = 0;
    private stable var transferFee : Nat = 1; // 0.01 SPOT
    
    private stable var gameEngineCanisterId : ?Principal = null;
    private stable var owner : Principal = Principal.fromText("aaaaa-aa");
    
    private var balances = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
    private stable var balanceEntries : [(Principal, Nat)] = [];
    
    private var allowances = HashMap.HashMap<(Principal, Principal), Nat>(10, 
        func(a, b) = a.0 == b.0 and a.1 == b.1, 
        func(a) = Principal.hash(a.0) +% Principal.hash(a.1));
    private stable var allowanceEntries : [((Principal, Principal), Nat)] = [];
    
    private stable var transactionId : Nat = 0;
    private stable var transactions : [ICRC1.TransferArgs] = [];
    
    // Treasury and burn address
    private stable var treasuryAddress : Principal = Principal.fromText("aaaaa-aa");
    private stable var totalBurned : Nat = 0;
    
    system func preupgrade() {
        balanceEntries := Iter.toArray(balances.entries());
        allowanceEntries := Iter.toArray(allowances.entries());
    };
    
    system func postupgrade() {
        balances := HashMap.fromIter<Principal, Nat>(balanceEntries.vals(), balanceEntries.size(), Principal.equal, Principal.hash);
        allowances := HashMap.fromIter<(Principal, Principal), Nat>(allowanceEntries.vals(), allowanceEntries.size(), 
            func(a, b) = a.0 == b.0 and a.1 == b.1, 
            func(a) = Principal.hash(a.0) +% Principal.hash(a.1));
    };
    
    public shared(msg) func setOwner(newOwner: Principal) : async Result.Result<Text, Text> {
        if (owner == Principal.fromText("aaaaa-aa")) {
            owner := newOwner;
            #ok("Owner set successfully");
        } else {
            #err("Owner already set");
        };
    };
    
    public shared(msg) func setGameEngineCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set game engine canister");
        };
        gameEngineCanisterId := ?canisterId;
        #ok("Game engine canister set successfully");
    };
    
    public shared(msg) func mint(to: Principal, amount: Nat) : async Result.Result<Nat, Text> {
        switch (gameEngineCanisterId) {
            case null { #err("Game engine canister not set") };
            case (?engineId) {
                if (msg.caller != engineId) {
                    return #err("Only game engine can mint tokens");
                };
                
                let currentBalance = switch (balances.get(to)) {
                    case null { 0 };
                    case (?balance) { balance };
                };
                
                balances.put(to, currentBalance + amount);
                totalSupply += amount;
                transactionId += 1;
                
                #ok(transactionId);
            };
        };
    };
    
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
        
        if (fee != transferFee) {
            return #err(#BadFee { expected_fee = transferFee });
        };
        
        let fromBalance = switch (balances.get(from)) {
            case null { 0 };
            case (?balance) { balance };
        };
        
        let totalCost = amount + fee;
        if (fromBalance < totalCost) {
            return #err(#InsufficientFunds { balance = fromBalance });
        };
        
        balances.put(from, fromBalance - totalCost);
        
        let toBalance = switch (balances.get(to)) {
            case null { 0 };
            case (?balance) { balance };
        };
        balances.put(to, toBalance + amount);
        
        transactionId += 1;
        #ok(transactionId);
    };
    
    public query func icrc1_metadata() : async [ICRC1.Metadata] {
        [
            { key = "icrc1:name"; value = #Text(name) },
            { key = "icrc1:symbol"; value = #Text(symbol) },
            { key = "icrc1:decimals"; value = #Nat(Nat8.toNat(decimals)) },
            { key = "icrc1:fee"; value = #Nat(transferFee) }
        ];
    };
    
    public query func icrc1_supported_standards() : async [ICRC1.SupportedStandard] {
        [
            { name = "ICRC-1"; url = "https://github.com/dfinity/ICRC-1" },
            { name = "ICRC-2"; url = "https://github.com/dfinity/ICRC-1/blob/main/standards/ICRC-2/README.md" }
        ];
    };
    
    // ICRC-2: Approve functionality
    public shared(msg) func icrc2_approve(args: { spender: ICRC1.Account; amount: Nat; expires_at: ?Time.Time; }) : async Result.Result<Nat, ICRC1.TransferError> {
        let owner = msg.caller;
        let spender = args.spender.owner;
        let amount = args.amount;
        
        // Store approval
        allowances.put((owner, spender), amount);
        transactionId += 1;
        
        #ok(transactionId);
    };
    
    // ICRC-2: Transfer from functionality
    public shared(msg) func icrc2_transfer_from(args: {
        from: ICRC1.Account;
        to: ICRC1.Account;
        amount: Nat;
        fee: ?Nat;
        memo: ?Blob;
        created_at_time: ?Time.Time;
    }) : async Result.Result<Nat, ICRC1.TransferError> {
        let spender = msg.caller;
        let from = args.from.owner;
        let to = args.to.owner;
        let amount = args.amount;
        let fee = switch (args.fee) {
            case null { transferFee };
            case (?f) { f };
        };
        
        // Check allowance
        let allowance = switch (allowances.get((from, spender))) {
            case null { 0 };
            case (?a) { a };
        };
        
        if (allowance < amount) {
            return #err(#InsufficientFunds { balance = allowance });
        };
        
        // Check balance
        let fromBalance = switch (balances.get(from)) {
            case null { 0 };
            case (?balance) { balance };
        };
        
        let totalCost = amount + fee;
        if (fromBalance < totalCost) {
            return #err(#InsufficientFunds { balance = fromBalance });
        };
        
        // Update allowance
        allowances.put((from, spender), allowance - amount);
        
        // Transfer
        balances.put(from, fromBalance - totalCost);
        
        let toBalance = switch (balances.get(to)) {
            case null { 0 };
            case (?balance) { balance };
        };
        balances.put(to, toBalance + amount);
        
        transactionId += 1;
        #ok(transactionId);
    };
    
    // ICRC-2: Query allowance
    public query func icrc2_allowance(args: { account: ICRC1.Account; spender: ICRC1.Account }) : async { allowance: Nat; expires_at: ?Time.Time } {
        let allowance = switch (allowances.get((args.account.owner, args.spender.owner))) {
            case null { 0 };
            case (?a) { a };
        };
        { allowance = allowance; expires_at = null };
    };
    
    // Burn functionality for Treasury management
    public shared(msg) func burn(amount: Nat) : async Result.Result<Nat, Text> {
        let caller = msg.caller;
        let balance = switch (balances.get(caller)) {
            case null { 0 };
            case (?b) { b };
        };
        
        if (balance < amount) {
            return #err("Insufficient balance to burn");
        };
        
        balances.put(caller, balance - amount);
        totalSupply -= amount;
        totalBurned += amount;
        transactionId += 1;
        
        #ok(transactionId);
    };
    
    // Query total burned
    public query func getTotalBurned() : async Nat {
        totalBurned;
    };
    
    // Set treasury address (owner only)
    public shared(msg) func setTreasuryAddress(address: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set treasury address");
        };
        treasuryAddress := address;
        #ok("Treasury address updated");
    };
    
    // Query treasury balance
    public query func getTreasuryBalance() : async Nat {
        switch (balances.get(treasuryAddress)) {
            case null { 0 };
            case (?balance) { balance };
        };
    };
}