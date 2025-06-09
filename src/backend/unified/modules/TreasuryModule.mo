import HashMap "mo:base/HashMap";
import TrieMap "mo:base/TrieMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Iter "mo:base/Iter";

import Constants "Constants";
import GameV2 "../../../types/game_v2";

module {
    public class TreasuryManager() {
        // State variables
        private var treasuryAddress : Principal = Principal.fromText("aaaaa-aa");
        private var treasuryBalance : Nat = 0;
        private var totalBurned : Nat = 0;
        private var totalSinkAmount : Nat = 0;
        
        // Transaction tracking for idempotency
        private var processedTransactions = TrieMap.TrieMap<Text, Time.Time>(Text.equal, Text.hash);
        
        // Sink history
        private var sinkHistory : [(Time.Time, GameV2.SinkType, Nat)] = [];
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        // Process sink payment
        public func processSinkPayment(
            user: Principal,
            sinkType: GameV2.SinkType,
            txId: Text,
            balances: HashMap.HashMap<Principal, Nat>
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
            recordSinkHistory(sinkType, amount);
            
            #ok()
        };
        
        // Check if auto-burn should occur
        public func shouldAutoBurn(totalSupply: Nat) : Bool {
            if (totalSupply == 0) {
                return false;
            };
            
            let treasuryRatio = Float.fromInt(treasuryBalance) / Float.fromInt(totalSupply);
            treasuryRatio > Constants.TREASURY_BURN_THRESHOLD
        };
        
        // Execute auto-burn
        public func executeAutoBurn(totalSupply: Nat) : Nat {
            if (not shouldAutoBurn(totalSupply)) {
                return 0;
            };
            
            // Burn 50% of treasury balance
            let burnAmount = treasuryBalance / 2;
            treasuryBalance := treasuryBalance - burnAmount;
            totalBurned := totalBurned + burnAmount;
            
            burnAmount
        };
        
        // Get treasury statistics
        public func getTreasuryStats() : {
            balance: Nat;
            totalBurned: Nat;
            totalSunk: Nat;
        } {
            {
                balance = treasuryBalance;
                totalBurned = totalBurned;
                totalSunk = totalSinkAmount;
            }
        };
        
        // Get sink history
        public func getSinkHistory(limit: ?Nat) : [(Time.Time, Text, Nat)] {
            let actualLimit = switch(limit) {
                case null { sinkHistory.size() };
                case (?l) { Nat.min(l, sinkHistory.size()) };
            };
            
            // Convert enum to text for external API
            let convertedHistory = Array.map<(Time.Time, GameV2.SinkType, Nat), (Time.Time, Text, Nat)>(
                if (actualLimit == sinkHistory.size()) {
                    sinkHistory
                } else {
                    // Get last N entries
                    Array.tabulate<(Time.Time, GameV2.SinkType, Nat)>(
                        actualLimit,
                        func(i) = sinkHistory[sinkHistory.size() - actualLimit + i]
                    )
                },
                func(entry) = (entry.0, sinkTypeToText(entry.1), entry.2)
            );
            
            convertedHistory
        };
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            treasuryAddress: Principal;
            treasuryBalance: Nat;
            totalBurned: Nat;
            totalSinkAmount: Nat;
            processedTransactionsStable: [(Text, Time.Time)];
            sinkHistory: [(Time.Time, GameV2.SinkType, Nat)];
        } {
            {
                treasuryAddress = treasuryAddress;
                treasuryBalance = treasuryBalance;
                totalBurned = totalBurned;
                totalSinkAmount = totalSinkAmount;
                processedTransactionsStable = Iter.toArray(processedTransactions.entries());
                sinkHistory = sinkHistory;
            }
        };
        
        public func fromStable(stableData: {
            treasuryAddress: Principal;
            treasuryBalance: Nat;
            totalBurned: Nat;
            totalSinkAmount: Nat;
            processedTransactionsStable: [(Text, Time.Time)];
            sinkHistory: [(Time.Time, GameV2.SinkType, Nat)];
        }) {
            treasuryAddress := stableData.treasuryAddress;
            treasuryBalance := stableData.treasuryBalance;
            totalBurned := stableData.totalBurned;
            totalSinkAmount := stableData.totalSinkAmount;
            
            processedTransactions := TrieMap.fromEntries(
                stableData.processedTransactionsStable.vals(),
                Text.equal,
                Text.hash
            );
            
            sinkHistory := stableData.sinkHistory;
        };
        
        // ======================================
        // PRIVATE HELPERS
        // ======================================
        
        private func getSinkAmount(sinkType: GameV2.SinkType) : Nat {
            switch(sinkType) {
                case (#Retry) { Constants.RETRY_FEE };
                case (#HintBasic) { Constants.HINT_BASIC_FEE };
                case (#HintPremium) { Constants.HINT_PREMIUM_FEE };
                case (#Proposal) { Constants.PROPOSAL_FEE };
                case (#Boost) { Constants.BOOST_FEE };
                case (#PlayFee) { Constants.PLAY_FEE };
            }
        };
        
        private func sinkTypeToText(sinkType: GameV2.SinkType) : Text {
            switch(sinkType) {
                case (#Retry) { "Retry" };
                case (#HintBasic) { "HintBasic" };
                case (#HintPremium) { "HintPremium" };
                case (#Proposal) { "Proposal" };
                case (#Boost) { "Boost" };
                case (#PlayFee) { "PlayFee" };
            }
        };
        
        private func recordSinkHistory(sinkType: GameV2.SinkType, amount: Nat) {
            let historyEntry = (Time.now(), sinkType, amount);
            
            if (sinkHistory.size() >= Constants.MAX_SINK_HISTORY) {
                // Remove oldest entries
                sinkHistory := Array.tabulate<(Time.Time, GameV2.SinkType, Nat)>(
                    Constants.MAX_SINK_HISTORY - 1,
                    func(i) = sinkHistory[i + 1]
                );
            };
            
            sinkHistory := Array.append(sinkHistory, [historyEntry]);
        };
    };
}