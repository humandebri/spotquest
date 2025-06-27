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
        private let maxMemoLength : Nat = Constants.TOKEN_MAX_MEMO_LENGTH;
        
        // Token logo as base64 encoded PNG (256x256)
        private let logo : Text = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAABAKADAAQAAAABAAABAAAAAABn6hpJAAAl1ElEQVR4Ae2dC7AfV33ff2f/j/vS1dXzSpZkW7Jly0iyVGxs4pjyTEhNME1CzDQNwS5D2ulMhxlCOkzTEEyYJinYNJ0QEmaSdNqQQGNnKPGjQ+gQ2QHGIQaMZUnW07qWZUn36nV13//Hnn6/v7OrB35gGckm7Hev9r+7Z885u/vRfn/ndx67a6ZJBERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABERABETgR4RA+BE5D53GjxuB1Xf02sDxVdatZVaL/Wadt1oWhi2PuOdCbhYz/BvF+tctz05YaEfrDyfs2/cd/XFD8aN8PTIAP8r/O//Uzm3du1ZY3V5nMd5kIazH6V8HoUcsGxD6sAXL/JIYcnolHse+KcQLSPMMgr9h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syhWB3wEYMwAunZAd5nRSOfU6D0MbvLT8OABr/wWxje+2nV+Z3PK/YjA/CKoa7YgbxNAMOGrb0YJftrIXKK/kyrv5sA/Lj4s0/Yhp5P2z3q53+l7xIZgFeaeJWOl4zAQ/i+yEKU/3ypCAcEFV2CaPGPcQ7zx207BvlohN+rcmfIALwq2Ct00NQ78LCFHr5P4Hr3A9JAH77b/04bnrzb9qu1/9W6I2QAXi3yVTouewdOv08g3Agj0ML3CO+0Hf13Sfyv7o0gA/Dq8q/O0d0TwDsGY2cQ/QEP2PZ+PEOgOn91bgBdqQiQwJvfjG8N3JnGA4iICIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIiACIhASeD/A48oJ/SS43gMAAAAAElFTkSuQmCC";
        
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
        
        public func icrc1_metadata() : [ICRC1.Metadata] {
            [
                {
                    key = "icrc1:logo";
                    value = #Text(logo);
                },
                {
                    key = "icrc1:decimals";
                    value = #Nat(Nat8.toNat(decimals));
                },
                {
                    key = "icrc1:name";
                    value = #Text(name);
                },
                {
                    key = "icrc1:symbol";
                    value = #Text(symbol);
                },
                {
                    key = "icrc1:fee";
                    value = #Nat(transferFee);
                },
                {
                    key = "icrc1:max_memo_length";
                    value = #Nat(maxMemoLength);
                }
            ];
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