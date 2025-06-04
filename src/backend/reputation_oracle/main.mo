import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Hash "mo:base/Hash";
import Photo "../../types/photo";

actor ReputationOracle {
    // Owner and connected canisters
    private stable var owner : Principal = Principal.fromText("aaaaa-aa");
    private stable var gameEngineCanisterId : ?Principal = null;
    private stable var photoNFTCanisterId : ?Principal = null;
    
    // Custom hash function for Nat
    private func natHash(n: Nat) : Hash.Hash {
        Text.hash(Nat.toText(n));
    };
    
    // Reputation data structures
    public type PhotoReputation = {
        photoId: Nat;
        totalGames: Nat;
        totalHits: Nat; // Games where players scored > 50
        totalBadReports: Nat; // Reports for wrong location, etc.
        currentQuality: Float;
        lastUpdated: Time.Time;
        softBanned: Bool;
        hardBanned: Bool;
    };
    
    public type UserReputation = {
        user: Principal;
        photosUploaded: Nat;
        totalPhotoGames: Nat;
        averageQuality: Float;
        bannedPhotos: Nat;
        lastActivity: Time.Time;
        restricted: Bool;
    };
    
    // Constants
    private stable var ALPHA : Float = 0.8; // EMA smoothing factor
    private stable var SOFT_BAN_THRESHOLD : Float = 0.15;
    private stable var HARD_BAN_THRESHOLD : Float = 0.05;
    private stable var MIN_GAMES_FOR_BAN : Nat = 30;
    private stable var BAD_RATIO_THRESHOLD : Float = 0.5;
    
    // Storage
    private var photoReputations = HashMap.HashMap<Nat, PhotoReputation>(10, Nat.equal, natHash);
    private var userReputations = HashMap.HashMap<Principal, UserReputation>(10, Principal.equal, Principal.hash);
    private stable var photoReputationEntries : [(Nat, PhotoReputation)] = [];
    private stable var userReputationEntries : [(Principal, UserReputation)] = [];
    
    system func preupgrade() {
        photoReputationEntries := Iter.toArray(photoReputations.entries());
        userReputationEntries := Iter.toArray(userReputations.entries());
    };
    
    system func postupgrade() {
        photoReputations := HashMap.fromIter<Nat, PhotoReputation>(photoReputationEntries.vals(), photoReputationEntries.size(), Nat.equal, natHash);
        userReputations := HashMap.fromIter<Principal, UserReputation>(userReputationEntries.vals(), userReputationEntries.size(), Principal.equal, Principal.hash);
    };
    
    // Admin functions
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
    
    public shared(msg) func setPhotoNFTCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set photo NFT canister");
        };
        photoNFTCanisterId := ?canisterId;
        #ok("Photo NFT canister set successfully");
    };
    
    // Calculate quality score F
    private func calculateF(hitRate: Float, badRatio: Float) : Float {
        1.0 - 0.7 * hitRate - 0.3 * badRatio;
    };
    
    // Update photo quality score using EMA
    private func updateQualityScore(oldScore: Float, newF: Float) : Float {
        ALPHA * oldScore + (1.0 - ALPHA) * newF;
    };
    
    // Update photo reputation after a game round
    public shared(msg) func updatePhotoReputation(args: {
        photoId: Nat;
        roundId: Nat;
        playerScores: [Nat];
        badReports: Nat;
    }) : async Result.Result<Text, Text> {
        // Verify caller is GameEngine
        switch (gameEngineCanisterId) {
            case null { #err("Game engine canister not set") };
            case (?engineId) {
                if (msg.caller != engineId) {
                    return #err("Only game engine can update photo reputation");
                };
                
                // Get or create photo reputation
                let currentRep = switch (photoReputations.get(args.photoId)) {
                    case null {
                        {
                            photoId = args.photoId;
                            totalGames = 0;
                            totalHits = 0;
                            totalBadReports = 0;
                            currentQuality = 1.0;
                            lastUpdated = Time.now();
                            softBanned = false;
                            hardBanned = false;
                        };
                    };
                    case (?rep) { rep };
                };
                
                // Count hits (scores > 50)
                var hits = 0;
                for (score in args.playerScores.vals()) {
                    if (score > 50) {
                        hits += 1;
                    };
                };
                
                // Update counters
                let newTotalGames = currentRep.totalGames + 1;
                let newTotalHits = currentRep.totalHits + hits;
                let newTotalBadReports = currentRep.totalBadReports + args.badReports;
                
                // Calculate rates
                let hitRate = Float.fromInt(newTotalHits) / Float.fromInt(newTotalGames);
                let badRatio = Float.fromInt(newTotalBadReports) / Float.fromInt(newTotalGames);
                
                // Calculate new quality score
                let F = calculateF(hitRate, badRatio);
                let newQuality = updateQualityScore(currentRep.currentQuality, F);
                
                // Check ban conditions
                let shouldSoftBan = newQuality < SOFT_BAN_THRESHOLD and newTotalGames >= MIN_GAMES_FOR_BAN;
                let shouldHardBan = newQuality < HARD_BAN_THRESHOLD and badRatio > BAD_RATIO_THRESHOLD;
                
                // Update reputation
                let updatedRep : PhotoReputation = {
                    photoId = args.photoId;
                    totalGames = newTotalGames;
                    totalHits = newTotalHits;
                    totalBadReports = newTotalBadReports;
                    currentQuality = newQuality;
                    lastUpdated = Time.now();
                    softBanned = shouldSoftBan or currentRep.softBanned;
                    hardBanned = shouldHardBan or currentRep.hardBanned;
                };
                
                photoReputations.put(args.photoId, updatedRep);
                
                // Update photo NFT quality score
                switch (photoNFTCanisterId) {
                    case null {};
                    case (?nftCanister) {
                        let nftActor = actor(Principal.toText(nftCanister)) : actor {
                            updateQualityScore : (tokenId: Nat, newScore: Float) -> async Result.Result<Text, Text>;
                        };
                        let _ = await nftActor.updateQualityScore(args.photoId, newQuality);
                    };
                };
                
                // Update user reputation
                await updateUserReputationForPhoto(args.photoId, updatedRep);
                
                #ok("Photo reputation updated. Quality: " # Float.toText(newQuality) # 
                    (if (shouldSoftBan) " (SOFT BANNED)" else if (shouldHardBan) " (HARD BANNED)" else ""));
            };
        };
    };
    
    // Update user reputation based on their photos
    private func updateUserReputationForPhoto(photoId: Nat, photoRep: PhotoReputation) : async () {
        switch (photoNFTCanisterId) {
            case null {};
            case (?nftCanister) {
                let nftActor = actor(Principal.toText(nftCanister)) : actor {
                    icrc7_metadata : (tokenId: Nat) -> async ?Photo.PhotoMeta;
                };
                
                switch (await nftActor.icrc7_metadata(photoId)) {
                    case null {};
                    case (?photoMeta) {
                        let userPrincipal = photoMeta.owner;
                        
                        // Get or create user reputation
                        let currentUserRep = switch (userReputations.get(userPrincipal)) {
                            case null {
                                {
                                    user = userPrincipal;
                                    photosUploaded = 0;
                                    totalPhotoGames = 0;
                                    averageQuality = 1.0;
                                    bannedPhotos = 0;
                                    lastActivity = Time.now();
                                    restricted = false;
                                };
                            };
                            case (?rep) { rep };
                        };
                        
                        // Update user stats (simplified - in real implementation would aggregate all photos)
                        let updatedUserRep : UserReputation = {
                            user = userPrincipal;
                            photosUploaded = currentUserRep.photosUploaded + 1;
                            totalPhotoGames = currentUserRep.totalPhotoGames + photoRep.totalGames;
                            averageQuality = photoRep.currentQuality; // Simplified - should be weighted average
                            bannedPhotos = currentUserRep.bannedPhotos + 
                                (if (photoRep.hardBanned) 1 else 0);
                            lastActivity = Time.now();
                            restricted = currentUserRep.bannedPhotos > 3; // Restrict if too many banned photos
                        };
                        
                        userReputations.put(userPrincipal, updatedUserRep);
                    };
                };
            };
        };
    };
    
    // Report a photo for bad quality/wrong location
    public shared(msg) func reportPhoto(photoId: Nat, reason: Text) : async Result.Result<Text, Text> {
        // In production, would verify reporter has played the round
        switch (photoReputations.get(photoId)) {
            case null { #err("Photo not found in reputation system") };
            case (?rep) {
                let updatedRep = {
                    rep with
                    totalBadReports = rep.totalBadReports + 1;
                };
                photoReputations.put(photoId, updatedRep);
                #ok("Report recorded");
            };
        };
    };
    
    // Query functions
    public query func getPhotoReputation(photoId: Nat) : async ?PhotoReputation {
        photoReputations.get(photoId);
    };
    
    public query func getUserReputation(user: Principal) : async ?UserReputation {
        userReputations.get(user);
    };
    
    public query func getEligiblePhotos(minQuality: Float) : async [Nat] {
        let eligible = Buffer.Buffer<Nat>(10);
        for ((photoId, rep) in photoReputations.entries()) {
            if (rep.currentQuality >= minQuality and not rep.softBanned and not rep.hardBanned) {
                eligible.add(photoId);
            };
        };
        Buffer.toArray(eligible);
    };
    
    public query func getBannedPhotos() : async [(Nat, PhotoReputation)] {
        let banned = Buffer.Buffer<(Nat, PhotoReputation)>(10);
        for ((photoId, rep) in photoReputations.entries()) {
            if (rep.softBanned or rep.hardBanned) {
                banned.add((photoId, rep));
            };
        };
        Buffer.toArray(banned);
    };
    
    public query func getRestrictedUsers() : async [UserReputation] {
        let restricted = Buffer.Buffer<UserReputation>(10);
        for ((_, rep) in userReputations.entries()) {
            if (rep.restricted) {
                restricted.add(rep);
            };
        };
        Buffer.toArray(restricted);
    };
    
    // Admin function to manually adjust reputation
    public shared(msg) func manualAdjustPhotoQuality(photoId: Nat, newQuality: Float) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can manually adjust quality");
        };
        
        switch (photoReputations.get(photoId)) {
            case null { #err("Photo not found") };
            case (?rep) {
                let updatedRep = {
                    rep with
                    currentQuality = newQuality;
                    lastUpdated = Time.now();
                    softBanned = newQuality < SOFT_BAN_THRESHOLD;
                    hardBanned = newQuality < HARD_BAN_THRESHOLD;
                };
                photoReputations.put(photoId, updatedRep);
                
                // Update NFT quality
                switch (photoNFTCanisterId) {
                    case null {};
                    case (?nftCanister) {
                        let nftActor = actor(Principal.toText(nftCanister)) : actor {
                            updateQualityScore : (tokenId: Nat, newScore: Float) -> async Result.Result<Text, Text>;
                        };
                        let _ = await nftActor.updateQualityScore(photoId, newQuality);
                    };
                };
                
                #ok("Quality manually adjusted to " # Float.toText(newQuality));
            };
        };
    };
}