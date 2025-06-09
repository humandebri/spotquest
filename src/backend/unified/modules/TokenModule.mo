import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Iter "mo:base/Iter";

import ICRC1 "../../../types/icrc1";
import Constants "Constants";

module {
    public class TokenManager() {
        // Token metadata
        private let name : Text = Constants.TOKEN_NAME;
        private let symbol : Text = Constants.TOKEN_SYMBOL;
        private let decimals : Nat8 = Constants.TOKEN_DECIMALS;
        private let transferFee : Nat = Constants.TOKEN_TRANSFER_FEE;
        
        // State variables
        private var totalSupply : Nat = 0;
        private var transactionId : Nat = 0;
        
        // Balances storage
        private var balances = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
        
        // Allowances storage
        private var allowances = HashMap.HashMap<(Principal, Principal), Nat>(10, 
            func(a: (Principal, Principal), b: (Principal, Principal)) : Bool = a.0 == b.0 and a.1 == b.1, 
            func(a: (Principal, Principal)) : Nat32 = Principal.hash(a.0) +% Principal.hash(a.1));
        
        // ======================================
        // ICRC-1 QUERY FUNCTIONS
        // ======================================
        
        public func icrc1_name() : Text {
            name
        };
        
        public func icrc1_symbol() : Text {
            symbol
        };
        
        public func icrc1_decimals() : Nat8 {
            decimals
        };
        
        public func icrc1_fee() : Nat {
            transferFee
        };
        
        public func icrc1_total_supply() : Nat {
            totalSupply
        };
        
        public func icrc1_balance_of(account: ICRC1.Account) : Nat {
            switch (balances.get(account.owner)) {
                case null { 0 };
                case (?balance) { balance };
            }
        };
        
        // ======================================
        // ICRC-1 UPDATE FUNCTIONS
        // ======================================
        
        public func icrc1_transfer(
            from: Principal,
            args: ICRC1.TransferArgs
        ) : Result.Result<Nat, ICRC1.TransferError> {
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
            
            // Execute transfer
            balances.put(from, fromBalance - totalCost);
            balances.put(to, newToBalance);
            
            transactionId := transactionId + 1;
            #ok(transactionId);
        };
        
        // ======================================
        // INTERNAL FUNCTIONS
        // ======================================
        
        // Mint new tokens
        public func mint(to: Principal, amount: Nat) : Result.Result<Nat, Text> {
            // Validate inputs
            if (Principal.toText(to) == "") {
                return #err("Invalid recipient");
            };
            
            if (amount == 0) {
                return #err("Cannot mint zero tokens");
            };
            
            let currentBalance = switch (balances.get(to)) {
                case null { 0 };
                case (?balance) { balance };
            };
            
            // Check for overflow
            let newBalance = currentBalance + amount;
            if (newBalance < currentBalance) {
                return #err("Balance overflow");
            };
            
            let newSupply = totalSupply + amount;
            if (newSupply < totalSupply) {
                return #err("Supply overflow");
            };
            
            balances.put(to, newBalance);
            totalSupply := newSupply;
            transactionId := transactionId + 1;
            
            #ok(transactionId);
        };
        
        // Burn tokens
        public func burn(from: Principal, amount: Nat) : Result.Result<Nat, Text> {
            let currentBalance = switch (balances.get(from)) {
                case null { 0 };
                case (?balance) { balance };
            };
            
            if (currentBalance < amount) {
                return #err("Insufficient balance");
            };
            
            if (totalSupply < amount) {
                return #err("Invalid total supply");
            };
            
            balances.put(from, currentBalance - amount);
            totalSupply := totalSupply - amount;
            transactionId := transactionId + 1;
            
            #ok(transactionId);
        };
        
        // Get balances HashMap (for internal use)
        public func getBalances() : HashMap.HashMap<Principal, Nat> {
            balances
        };
        
        // Get total supply (for internal calculations)
        public func getTotalSupply() : Nat {
            totalSupply
        };
        
        // Set total supply (for burn operations)
        public func setTotalSupply(supply: Nat) {
            totalSupply := supply;
        };
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            totalSupply: Nat;
            transactionId: Nat;
            balanceEntries: [(Principal, Nat)];
            allowanceEntries: [((Principal, Principal), Nat)];
        } {
            {
                totalSupply = totalSupply;
                transactionId = transactionId;
                balanceEntries = Iter.toArray(balances.entries());
                allowanceEntries = Iter.toArray(allowances.entries());
            }
        };
        
        public func fromStable(stableData: {
            totalSupply: Nat;
            transactionId: Nat;
            balanceEntries: [(Principal, Nat)];
            allowanceEntries: [((Principal, Principal), Nat)];
        }) {
            totalSupply := stableData.totalSupply;
            transactionId := stableData.transactionId;
            
            balances := HashMap.fromIter(
                stableData.balanceEntries.vals(),
                stableData.balanceEntries.size(),
                Principal.equal,
                Principal.hash
            );
            
            allowances := HashMap.fromIter(
                stableData.allowanceEntries.vals(),
                stableData.allowanceEntries.size(),
                func(a: (Principal, Principal), b: (Principal, Principal)) : Bool = a.0 == b.0 and a.1 == b.1,
                func(a: (Principal, Principal)) : Nat32 = Principal.hash(a.0) +% Principal.hash(a.1)
            );
        };
    };
}