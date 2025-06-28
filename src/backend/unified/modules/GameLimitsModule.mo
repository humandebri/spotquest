import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";

import Constants "Constants";

module {
    public class GameLimitsManager() {
        // Daily play counts
        private var dailyPlayCounts = HashMap.HashMap<Principal, Nat>(100, Principal.equal, Principal.hash);
        
        // Pro membership expiry times
        private var proMembershipExpiry = HashMap.HashMap<Principal, Time.Time>(100, Principal.equal, Principal.hash);
        
        // Last reset time (Unix timestamp in nanoseconds)
        private var lastResetTime : Time.Time = Time.now();
        
        // Constants
        private let FREE_DAILY_PLAYS : Nat = 3;
        private let PRO_DAILY_PLAYS : Nat = 5;
        private let PRO_MEMBERSHIP_COST : Nat = 50000; // 500 SPOT (in smallest units)
        private let PRO_MEMBERSHIP_DURATION : Int = 30 * 24 * 60 * 60 * 1_000_000_000; // 30 days in nanoseconds
        private let NANOSECONDS_PER_DAY : Int = 24 * 60 * 60 * 1_000_000_000;
        
        // Get the start of the current day (00:00 UTC)
        private func getStartOfDay(timestamp: Time.Time) : Time.Time {
            let daysSinceEpoch = timestamp / NANOSECONDS_PER_DAY;
            daysSinceEpoch * NANOSECONDS_PER_DAY
        };
        
        // Check if user is a Pro member
        public func isProMember(player: Principal) : Bool {
            switch (proMembershipExpiry.get(player)) {
                case null { false };
                case (?expiry) { Time.now() < expiry };
            }
        };
        
        // Check if we need to reset daily counts
        private func checkAndResetIfNeeded() : () {
            let currentTime = Time.now();
            let currentDayStart = getStartOfDay(currentTime);
            let lastResetDayStart = getStartOfDay(lastResetTime);
            
            // If we've crossed into a new day, reset all counts
            if (currentDayStart > lastResetDayStart) {
                Debug.print("🔄 Resetting daily play counts");
                dailyPlayCounts := HashMap.HashMap<Principal, Nat>(100, Principal.equal, Principal.hash);
                lastResetTime := currentTime;
            };
        };
        
        // Get remaining plays for a player
        public func getRemainingPlays(player: Principal) : Nat {
            checkAndResetIfNeeded();
            
            let playCount = switch (dailyPlayCounts.get(player)) {
                case null { 0 };
                case (?count) { count };
            };
            
            let dailyLimit = if (isProMember(player)) { PRO_DAILY_PLAYS } else { FREE_DAILY_PLAYS };
            
            if (playCount >= dailyLimit) {
                0
            } else {
                dailyLimit - playCount
            }
        };
        
        // Consume one play
        public func consumePlay(player: Principal) : Result.Result<(), Text> {
            checkAndResetIfNeeded();
            
            let currentCount = switch (dailyPlayCounts.get(player)) {
                case null { 0 };
                case (?count) { count };
            };
            
            let dailyLimit = if (isProMember(player)) { PRO_DAILY_PLAYS } else { FREE_DAILY_PLAYS };
            
            if (currentCount >= dailyLimit) {
                #err("No plays remaining today")
            } else {
                dailyPlayCounts.put(player, currentCount + 1);
                Debug.print("✅ Play consumed for " # Principal.toText(player) # ". Plays used: " # Nat.toText(currentCount + 1) # "/" # Nat.toText(dailyLimit));
                #ok()
            }
        };
        
        // Get play limit (for display purposes)
        public func getPlayLimit(player: Principal) : Nat {
            if (isProMember(player)) { PRO_DAILY_PLAYS } else { FREE_DAILY_PLAYS }
        };
        
        // Purchase Pro membership
        public func purchaseProMembership(player: Principal) : Result.Result<Time.Time, Text> {
            let now = Time.now();
            let newExpiry = switch (proMembershipExpiry.get(player)) {
                case null { 
                    // New Pro member
                    now + PRO_MEMBERSHIP_DURATION
                };
                case (?currentExpiry) {
                    // Extend existing membership
                    if (currentExpiry > now) {
                        // Still active, extend from current expiry
                        currentExpiry + PRO_MEMBERSHIP_DURATION
                    } else {
                        // Expired, start from now
                        now + PRO_MEMBERSHIP_DURATION
                    }
                };
            };
            
            proMembershipExpiry.put(player, newExpiry);
            Debug.print("✅ Pro membership purchased for " # Principal.toText(player) # ". Expires: " # Int.toText(newExpiry));
            #ok(newExpiry)
        };
        
        // Get Pro membership cost
        public func getProMembershipCost() : Nat {
            PRO_MEMBERSHIP_COST
        };
        
        // Get Pro membership expiry
        public func getProMembershipExpiry(player: Principal) : ?Time.Time {
            switch (proMembershipExpiry.get(player)) {
                case null { null };
                case (?expiry) {
                    if (expiry > Time.now()) { ?expiry } else { null }
                };
            }
        };
        
        // Manual reset (for testing)
        public func resetDailyPlays() : () {
            Debug.print("🔄 Manual reset of daily play counts");
            dailyPlayCounts := HashMap.HashMap<Principal, Nat>(100, Principal.equal, Principal.hash);
            lastResetTime := Time.now();
        };
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            dailyPlayCountsStable: [(Principal, Nat)];
            proMembershipExpiryStable: ?[(Principal, Time.Time)];
            lastResetTime: Time.Time;
        } {
            {
                dailyPlayCountsStable = Iter.toArray(dailyPlayCounts.entries());
                proMembershipExpiryStable = ?Iter.toArray(proMembershipExpiry.entries());
                lastResetTime = lastResetTime;
            }
        };
        
        public func fromStable(stableData: {
            dailyPlayCountsStable: [(Principal, Nat)];
            proMembershipExpiryStable: ?[(Principal, Time.Time)]; // Optional for backward compatibility
            lastResetTime: Time.Time;
        }) {
            dailyPlayCounts := HashMap.fromIter(
                stableData.dailyPlayCountsStable.vals(),
                stableData.dailyPlayCountsStable.size(),
                Principal.equal,
                Principal.hash
            );
            
            // Restore Pro membership data if available
            switch (stableData.proMembershipExpiryStable) {
                case null {
                    proMembershipExpiry := HashMap.HashMap<Principal, Time.Time>(100, Principal.equal, Principal.hash);
                };
                case (?proData) {
                    proMembershipExpiry := HashMap.fromIter(
                        proData.vals(),
                        proData.size(),
                        Principal.equal,
                        Principal.hash
                    );
                };
            };
            
            lastResetTime := stableData.lastResetTime;
            
            // Check if we need to reset after upgrade
            checkAndResetIfNeeded();
        };
    };
}