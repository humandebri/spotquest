import TrieMap "mo:base/TrieMap";
import HashMap "mo:base/HashMap";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Text "mo:base/Text";
import Iter "mo:base/Iter";

import Constants "Constants";
import PhotoTypes "../../../types/photo";
import PhotoModule "PhotoModuleV2";

module {
    // Types
    public type Reputation = {
        user: Principal;
        score: Float;
        uploads: Nat;
        validations: Nat;
        lastUpdated: Time.Time;
    };
    
    public type Referral = {
        referrer: Principal;
        referee: Principal;
        timestamp: Time.Time;
        rewardsClaimed: Bool;
    };
    
    public class ReputationManager() {
        // Reputation storage
        private var reputations = TrieMap.TrieMap<Principal, Reputation>(Principal.equal, Principal.hash);
        
        // Referral tracking
        private var referrals = TrieMap.TrieMap<Principal, Buffer.Buffer<Referral>>(Principal.equal, Principal.hash);
        private var referralCodes = HashMap.HashMap<Text, Principal>(10, Text.equal, Text.hash);
        private var userReferralCodes = HashMap.HashMap<Principal, Text>(10, Principal.equal, Principal.hash);
        
        // Admin features
        private var bannedUsers = TrieMap.TrieMap<Principal, Time.Time>(Principal.equal, Principal.hash);
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        // Get or create reputation
        public func getReputation(user: Principal) : Reputation {
            switch(reputations.get(user)) {
                case null {
                    let newRep : Reputation = {
                        user = user;
                        score = Constants.DEFAULT_REPUTATION;
                        uploads = 0;
                        validations = 0;
                        lastUpdated = Time.now();
                    };
                    reputations.put(user, newRep);
                    newRep
                };
                case (?rep) { rep };
            }
        };
        
        // Update reputation score
        public func updateReputation(
            user: Principal,
            scoreChange: Float,
            isUpload: Bool,
            isValidation: Bool
        ) : Result.Result<Reputation, Text> {
            if (Principal.toText(user) == "") {
                return #err("Invalid user principal");
            };
            
            if (bannedUsers.get(user) != null) {
                return #err("User is banned");
            };
            
            let currentRep = getReputation(user);
            
            // Calculate new score
            var newScore = currentRep.score + scoreChange;
            
            // Clamp score between min and max
            if (newScore < Constants.MIN_REPUTATION) {
                newScore := Constants.MIN_REPUTATION;
            } else if (newScore > Constants.MAX_REPUTATION) {
                newScore := Constants.MAX_REPUTATION;
            };
            
            // Update counts
            let newUploads = if (isUpload) { currentRep.uploads + 1 } else { currentRep.uploads };
            let newValidations = if (isValidation) { currentRep.validations + 1 } else { currentRep.validations };
            
            let updatedRep : Reputation = {
                user = user;
                score = newScore;
                uploads = newUploads;
                validations = newValidations;
                lastUpdated = Time.now();
            };
            
            reputations.put(user, updatedRep);
            
            #ok(updatedRep)
        };
        
        // Generate referral code
        public func generateReferralCode(user: Principal) : Result.Result<Text, Text> {
            // Check if user already has a code
            switch(userReferralCodes.get(user)) {
                case (?code) { return #ok(code) };
                case null { };
            };
            
            // Generate unique code
            let timestamp = Int.abs(Time.now());
            let principalText = Principal.toText(user);
            let timestampText = Int.toText(timestamp);
            
            // Get first 6 chars of principal and last 4 digits of timestamp
            let principalChars = Text.toArray(principalText);
            let principalPrefix = if (principalChars.size() >= 6) {
                Text.fromIter(Array.subArray(principalChars, 0, 6).vals())
            } else {
                principalText
            };
            
            let timestampChars = Text.toArray(timestampText);
            let timestampSize = timestampChars.size();
            let timestampSuffix = if (timestampSize >= 4) {
                Text.fromIter(Array.subArray(timestampChars, timestampSize - 4, 4).vals())
            } else {
                timestampText
            };
            
            let code = Text.toLowercase(principalPrefix # "_" # timestampSuffix);
            
            // Ensure uniqueness
            if (referralCodes.get(code) != null) {
                return #err("Code generation collision, please try again");
            };
            
            // Store mappings
            referralCodes.put(code, user);
            userReferralCodes.put(user, code);
            
            #ok(code)
        };
        
        // Apply referral code
        public func applyReferralCode(referee: Principal, code: Text) : Result.Result<(), Text> {
            // Validate inputs
            if (Principal.toText(referee) == "") {
                return #err("Invalid referee principal");
            };
            
            if (code == "") {
                return #err("Invalid referral code");
            };
            
            // Check if referee already used a referral
            switch(referrals.get(referee)) {
                case (?refs) {
                    if (refs.size() > 0) {
                        return #err("User has already used a referral code");
                    };
                };
                case null { };
            };
            
            // Find referrer
            switch(referralCodes.get(code)) {
                case null { #err("Invalid referral code") };
                case (?referrer) {
                    if (referrer == referee) {
                        return #err("Cannot use your own referral code");
                    };
                    
                    // Create referral
                    let referral : Referral = {
                        referrer = referrer;
                        referee = referee;
                        timestamp = Time.now();
                        rewardsClaimed = false;
                    };
                    
                    // Add to referrer's referrals
                    let referrerReferrals = switch(referrals.get(referrer)) {
                        case null {
                            let buffer = Buffer.Buffer<Referral>(10);
                            referrals.put(referrer, buffer);
                            buffer
                        };
                        case (?buffer) { buffer };
                    };
                    
                    referrerReferrals.add(referral);
                    
                    // Also track for referee
                    let refereeReferrals = Buffer.Buffer<Referral>(1);
                    refereeReferrals.add(referral);
                    referrals.put(referee, refereeReferrals);
                    
                    #ok()
                };
            }
        };
        
        // Get referral statistics
        public func getReferralStats(user: Principal) : {
            referralCode: ?Text;
            totalReferrals: Nat;
            unclaimedRewards: Nat;
        } {
            let code = userReferralCodes.get(user);
            
            let stats = switch(referrals.get(user)) {
                case null { (0, 0) };
                case (?refs) {
                    var total = 0;
                    var unclaimed = 0;
                    
                    for (ref in refs.vals()) {
                        if (ref.referrer == user) {
                            total += 1;
                            if (not ref.rewardsClaimed) {
                                unclaimed += 1;
                            };
                        };
                    };
                    
                    (total, unclaimed)
                };
            };
            
            {
                referralCode = code;
                totalReferrals = stats.0;
                unclaimedRewards = stats.1;
            }
        };
        
        // Mark referral rewards as claimed
        public func markReferralsClaimed(user: Principal) : Result.Result<Nat, Text> {
            switch(referrals.get(user)) {
                case null { #err("No referrals found") };
                case (?refs) {
                    var claimedCount = 0;
                    
                    for (i in Iter.range(0, refs.size() - 1)) {
                        let ref = refs.get(i);
                        if (ref.referrer == user and not ref.rewardsClaimed) {
                            refs.put(i, {
                                ref with
                                rewardsClaimed = true;
                            });
                            claimedCount += 1;
                        };
                    };
                    
                    if (claimedCount == 0) {
                        return #err("No unclaimed rewards");
                    };
                    
                    #ok(claimedCount)
                };
            }
        };
        
        // Ban user
        public func banUser(user: Principal) : Result.Result<(), Text> {
            if (bannedUsers.get(user) != null) {
                return #err("User already banned");
            };
            
            bannedUsers.put(user, Time.now());
            
            // Reset reputation
            let bannedRep : Reputation = {
                user = user;
                score = 0.0;
                uploads = 0;
                validations = 0;
                lastUpdated = Time.now();
            };
            
            reputations.put(user, bannedRep);
            
            #ok()
        };
        
        // Unban user
        public func unbanUser(user: Principal) : Result.Result<(), Text> {
            switch(bannedUsers.remove(user)) {
                case null { #err("User not banned") };
                case (?_) {
                    // Reset to default reputation
                    let unbannedRep : Reputation = {
                        user = user;
                        score = Constants.DEFAULT_REPUTATION;
                        uploads = 0;
                        validations = 0;
                        lastUpdated = Time.now();
                    };
                    
                    reputations.put(user, unbannedRep);
                    
                    #ok()
                };
            }
        };
        
        // Check if user is banned
        public func isBanned(user: Principal) : Bool {
            bannedUsers.get(user) != null
        };
        
        // Get leaderboard
        public func getLeaderboard(limit: Nat) : [(Principal, Float)] {
            // Convert to array and sort by reputation score
            let allReps = Iter.toArray(
                Iter.map<(Principal, Reputation), (Principal, Float)>(
                    reputations.entries(),
                    func(entry) = (entry.0, entry.1.score)
                )
            );
            
            let sorted = Array.sort<(Principal, Float)>(
                allReps,
                func(a, b) = Float.compare(b.1, a.1) // Descending order
            );
            
            // Return top N
            let actualLimit = Nat.min(limit, sorted.size());
            Array.tabulate<(Principal, Float)>(
                actualLimit,
                func(i) = sorted[i]
            )
        };
        
        // Process photo validation
        public func processPhotoValidation(
            photo: PhotoModule.Photo,
            isValid: Bool,
            validator: Principal
        ) : Result.Result<(), Text> {
            // Update validator reputation
            let scoreChange = if (isValid) {
                Constants.VALIDATION_REWARD
            } else {
                -Constants.VALIDATION_PENALTY
            };
            
            ignore updateReputation(validator, scoreChange, false, true);
            
            // Update photo owner reputation if invalid
            if (not isValid) {
                ignore updateReputation(photo.owner, -Constants.INVALID_PHOTO_PENALTY, false, false);
            };
            
            #ok()
        };
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            reputations: [(Principal, Reputation)];
            referrals: [(Principal, [Referral])];
            referralCodes: [(Text, Principal)];
            userReferralCodes: [(Principal, Text)];
            bannedUsers: [(Principal, Time.Time)];
        } {
            {
                reputations = Iter.toArray(reputations.entries());
                referrals = Array.map<(Principal, Buffer.Buffer<Referral>), (Principal, [Referral])>(
                    Iter.toArray(referrals.entries()),
                    func(entry) = (entry.0, Buffer.toArray(entry.1))
                );
                referralCodes = Iter.toArray(referralCodes.entries());
                userReferralCodes = Iter.toArray(userReferralCodes.entries());
                bannedUsers = Iter.toArray(bannedUsers.entries());
            }
        };
        
        public func fromStable(stableData: {
            reputations: [(Principal, Reputation)];
            referrals: [(Principal, [Referral])];
            referralCodes: [(Text, Principal)];
            userReferralCodes: [(Principal, Text)];
            bannedUsers: [(Principal, Time.Time)];
        }) {
            reputations := TrieMap.fromEntries(stableData.reputations.vals(), Principal.equal, Principal.hash);
            bannedUsers := TrieMap.fromEntries(stableData.bannedUsers.vals(), Principal.equal, Principal.hash);
            
            referralCodes := HashMap.fromIter(
                stableData.referralCodes.vals(),
                stableData.referralCodes.size(),
                Text.equal,
                Text.hash
            );
            
            userReferralCodes := HashMap.fromIter(
                stableData.userReferralCodes.vals(),
                stableData.userReferralCodes.size(),
                Principal.equal,
                Principal.hash
            );
            
            referrals := TrieMap.TrieMap<Principal, Buffer.Buffer<Referral>>(Principal.equal, Principal.hash);
            for ((user, refs) in stableData.referrals.vals()) {
                let buffer = Buffer.Buffer<Referral>(refs.size());
                for (ref in refs.vals()) {
                    buffer.add(ref);
                };
                referrals.put(user, buffer);
            };
        };
    };
}